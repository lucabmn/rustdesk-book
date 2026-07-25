import {
  DEFAULT_RUSTDESK_VERSION,
  DOWNLOAD_SHA256,
  normalizedOrigin,
  shellQuote,
  type DeploymentScriptOptions,
} from './shared'

export function macosScript(options: DeploymentScriptOptions): string {
  const origin = normalizedOrigin(options.baseUrl)
  const version = DEFAULT_RUSTDESK_VERSION
  const config = options.rustdeskConfig?.trim() ?? ''
  const macosHashes = DOWNLOAD_SHA256.macos

  return String.raw`#!/bin/sh
# rustdesk-book deployment for macOS (RustDesk OSS)
# This file contains a bearer token. Store it as root-only and delete it when no longer needed.
set -eu
CLAIM_URL=${shellQuote(`${origin}/api/enroll/claim`)}
FINALIZE_URL=${shellQuote(`${origin}/api/enroll/finalize`)}
ENROLLMENT_TOKEN=${shellQuote(options.token)}
INSTALL_IF_MISSING=${options.installIfMissing ? '1' : '0'}
RUSTDESK_VERSION=${shellQuote(version)}
RUSTDESK_CONFIG=${shellQuote(config)}

if [ "$(id -u)" -ne 0 ]; then
  echo 'Run this deployment as root (sudo or MDM).' >&2
  exit 1
fi

find_rustdesk() {
  if command -v rustdesk >/dev/null 2>&1; then command -v rustdesk; return; fi
  for candidate in \
    /Applications/RustDesk.app/Contents/MacOS/RustDesk \
    /Applications/rustdesk.app/Contents/MacOS/RustDesk \
    /Users/*/Applications/RustDesk.app/Contents/MacOS/RustDesk; do
    if [ -x "$candidate" ]; then printf '%s\n' "$candidate"; return; fi
  done
  if command -v mdfind >/dev/null 2>&1; then
    candidate=$(mdfind 'kMDItemCFBundleIdentifier == "com.carriez.RustDesk"' | head -n 1 || true)
    if [ -n "$candidate" ] && [ -x "$candidate/Contents/MacOS/RustDesk" ]; then printf '%s\n' "$candidate/Contents/MacOS/RustDesk"; return; fi
  fi
}

RUSTDESK=$(find_rustdesk || true)
if [ -z "$RUSTDESK" ]; then
  if [ "$INSTALL_IF_MISSING" != '1' ]; then
    echo 'RustDesk is not installed or could not be found. Enable automatic installation or install RustDesk first.' >&2
    exit 1
  fi

  case "$(uname -m)" in
    arm64) asset_arch=aarch64; expected_hash='${macosHashes.aarch64}' ;;
    x86_64) asset_arch=x86_64; expected_hash='${macosHashes.x86_64}' ;;
    *) echo 'Unsupported macOS architecture.' >&2; exit 1 ;;
  esac
  tmpdir=$(mktemp -d)
  trap 'hdiutil detach "$tmpdir/mount" >/dev/null 2>&1 || true; rm -rf "$tmpdir"' EXIT
  mkdir -p "$tmpdir/mount"
  curl -fL "https://github.com/rustdesk/rustdesk/releases/download/$RUSTDESK_VERSION/rustdesk-$RUSTDESK_VERSION-$asset_arch.dmg" -o "$tmpdir/rustdesk.dmg"
  actual_hash=$(shasum -a 256 "$tmpdir/rustdesk.dmg" | awk '{print $1}')
  if [ "$actual_hash" != "$expected_hash" ]; then echo 'RustDesk DMG checksum verification failed.' >&2; exit 1; fi
  hdiutil attach "$tmpdir/rustdesk.dmg" -mountpoint "$tmpdir/mount" -nobrowse >/dev/null
  codesign --verify --deep --strict "$tmpdir/mount/RustDesk.app"
  spctl --assess --type execute "$tmpdir/mount/RustDesk.app"
  rm -rf /Applications/RustDesk.app
  cp -R "$tmpdir/mount/RustDesk.app" /Applications/RustDesk.app
  hdiutil detach "$tmpdir/mount" >/dev/null
  RUSTDESK=$(find_rustdesk || true)
  if [ -z "$RUSTDESK" ]; then echo 'RustDesk was installed but its executable could not be located.' >&2; exit 1; fi
fi

"$RUSTDESK" --server >/dev/null 2>&1 &
sleep 2
if [ -n "$RUSTDESK_CONFIG" ]; then
  if ! CONFIG_OUTPUT=$("$RUSTDESK" --config "$RUSTDESK_CONFIG" 2>&1); then echo "RustDesk configuration failed: $CONFIG_OUTPUT" >&2; exit 1; fi
  if printf '%s' "$CONFIG_OUTPUT" | grep -Eqi 'required|failed|disabled'; then echo "RustDesk configuration failed: $CONFIG_OUTPUT" >&2; exit 1; fi
fi

RUSTDESK_ID=
tries=0
while [ -z "$RUSTDESK_ID" ] && [ "$tries" -lt 30 ]; do
  RUSTDESK_ID=$("$RUSTDESK" --get-id 2>/dev/null | tr -cd '0-9' || true)
  [ -n "$RUSTDESK_ID" ] || sleep 2
  tries=$((tries + 1))
done
case "$RUSTDESK_ID" in ''|*[!0-9]*) echo 'RustDesk did not return a valid device ID.' >&2; exit 1 ;; esac

HOSTNAME_VALUE=$(scutil --get ComputerName 2>/dev/null || hostname)
OS_VALUE="macOS $(sw_vers -productVersion)"
VERSION_VALUE=$("$RUSTDESK" --version 2>/dev/null || true)
RECOVERY_DIR='/Library/Application Support/rustdesk-book'
RECOVERY_FILE="$RECOVERY_DIR/enrollment-recovery-$RUSTDESK_ID"
mkdir -p "$RECOVERY_DIR"
chmod 700 "$RECOVERY_DIR"
CLAIM_TOKEN=
CLAIM_EXPIRES=0
RUSTDESK_PASSWORD=
if [ -s "$RECOVERY_FILE" ]; then
  CLAIM_TOKEN=$(sed -n '1p' "$RECOVERY_FILE")
  RUSTDESK_PASSWORD=$(sed -n '2p' "$RECOVERY_FILE")
  CLAIM_EXPIRES=$(sed -n '3p' "$RECOVERY_FILE")
fi
if ! printf '%s' "$RUSTDESK_PASSWORD" | grep -Eq '^[a-f0-9]{32}$'; then RUSTDESK_PASSWORD=; fi
case "$CLAIM_EXPIRES" in ''|*[!0-9]*) CLAIM_EXPIRES=0 ;; esac
if ! printf '%s' "$CLAIM_TOKEN" | grep -Eq '^rdc_[A-Za-z0-9_-]{43}$' || [ "$CLAIM_EXPIRES" -le "$(date +%s)" ]; then CLAIM_TOKEN=; fi
if [ -z "$CLAIM_TOKEN" ]; then
  CLAIM_RESULT=$(curl --fail --show-error --silent --request POST "$CLAIM_URL" \
    --header "Authorization: Bearer $ENROLLMENT_TOKEN" \
    --header 'Accept: text/plain' \
    --data-urlencode "rustdeskId=$RUSTDESK_ID" \
    --data-urlencode "alias=$HOSTNAME_VALUE" \
    --data-urlencode "hostname=$HOSTNAME_VALUE" \
    --data-urlencode "os=$OS_VALUE" \
    --data-urlencode "rustdeskVersion=$VERSION_VALUE")
  if [ "$CLAIM_RESULT" = ALREADY ]; then
    rm -f "$RECOVERY_FILE"
    printf 'Device %s (%s) is already present in rustdesk-book.\n' "$HOSTNAME_VALUE" "$RUSTDESK_ID"
    exit 0
  fi
  CLAIM_TOKEN=$(printf '%s\n' "$CLAIM_RESULT" | sed -n '1p')
  CLAIM_EXPIRES=$(printf '%s\n' "$CLAIM_RESULT" | sed -n '2p')
  if ! printf '%s' "$CLAIM_TOKEN" | grep -Eq '^rdc_[A-Za-z0-9_-]{43}$' || ! printf '%s' "$CLAIM_EXPIRES" | grep -Eq '^[0-9]+$'; then echo 'rustdesk-book returned an invalid enrollment claim.' >&2; exit 1; fi
  if [ -z "$RUSTDESK_PASSWORD" ]; then RUSTDESK_PASSWORD=$(openssl rand -hex 16); fi
  umask 077
  RECOVERY_TMP="$RECOVERY_FILE.$$"
  printf '%s\n%s\n%s\n' "$CLAIM_TOKEN" "$RUSTDESK_PASSWORD" "$CLAIM_EXPIRES" > "$RECOVERY_TMP"
  mv -f "$RECOVERY_TMP" "$RECOVERY_FILE"
fi
if ! PASSWORD_OUTPUT=$("$RUSTDESK" --password "$RUSTDESK_PASSWORD" 2>&1); then echo "Setting the RustDesk password failed: $PASSWORD_OUTPUT" >&2; exit 1; fi
if printf '%s' "$PASSWORD_OUTPUT" | grep -Eqi 'required|failed|disabled'; then echo "Setting the RustDesk password failed: $PASSWORD_OUTPUT" >&2; exit 1; fi

completed=0
attempt=0
while [ "$attempt" -lt 5 ]; do
  if curl --fail --show-error --silent --request POST "$FINALIZE_URL" \
    --header "Authorization: Bearer $CLAIM_TOKEN" \
    --data-urlencode "password=$RUSTDESK_PASSWORD" >/dev/null; then completed=1; break; fi
  attempt=$((attempt + 1))
  sleep $((1 << attempt))
done
if [ "$completed" != 1 ]; then echo "Enrollment could not be finalized. Re-run this script; recovery data remains at $RECOVERY_FILE." >&2; exit 1; fi
rm -f "$RECOVERY_FILE"
printf 'Device %s (%s) was added to rustdesk-book.\n' "$HOSTNAME_VALUE" "$RUSTDESK_ID"
printf 'Important: grant RustDesk Accessibility, Screen Recording and Input Monitoring permissions through System Settings or MDM/PPPC.\n'
`
}
