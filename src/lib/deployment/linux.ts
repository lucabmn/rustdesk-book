import {
  DEFAULT_RUSTDESK_VERSION,
  DOWNLOAD_SHA256,
  normalizedOrigin,
  shellQuote,
  type DeploymentScriptOptions,
} from './shared'

export function linuxScript(options: DeploymentScriptOptions): string {
  const origin = normalizedOrigin(options.baseUrl)
  const version = DEFAULT_RUSTDESK_VERSION
  const config = options.rustdeskConfig?.trim() ?? ''
  const hashes = DOWNLOAD_SHA256

  return String.raw`#!/bin/sh
# rustdesk-book deployment for Linux (RustDesk OSS)
# This file contains a bearer token. Store it as root-only and delete it when no longer needed.
set -eu
CLAIM_URL=${shellQuote(`${origin}/api/enroll/claim`)}
FINALIZE_URL=${shellQuote(`${origin}/api/enroll/finalize`)}
ENROLLMENT_TOKEN=${shellQuote(options.token)}
INSTALL_IF_MISSING=${options.installIfMissing ? '1' : '0'}
RUSTDESK_VERSION=${shellQuote(version)}
RUSTDESK_CONFIG=${shellQuote(config)}

verify_sha256() {
  file=$1
  expected=$2
  if command -v sha256sum >/dev/null 2>&1; then actual=$(sha256sum "$file" | awk '{print $1}'); else actual=$(shasum -a 256 "$file" | awk '{print $1}'); fi
  if [ "$actual" != "$expected" ]; then echo 'RustDesk package checksum verification failed.' >&2; exit 1; fi
}

if [ "$(id -u)" -ne 0 ]; then
  echo 'Run this deployment as root (sudo).' >&2
  exit 1
fi

find_rustdesk() {
  if command -v rustdesk >/dev/null 2>&1; then command -v rustdesk; return; fi
  for candidate in /usr/bin/rustdesk /usr/local/bin/rustdesk /opt/rustdesk/rustdesk /opt/RustDesk/rustdesk; do
    if [ -x "$candidate" ]; then printf '%s\n' "$candidate"; return; fi
  done
  if command -v systemctl >/dev/null 2>&1; then
    candidate=$(systemctl cat rustdesk.service 2>/dev/null | awk -F= '/^ExecStart=/{print $2}' | cut -d' ' -f1 | head -n 1 || true)
    if [ -n "$candidate" ] && [ -x "$candidate" ]; then printf '%s\n' "$candidate"; return; fi
  fi
}

RUSTDESK=$(find_rustdesk || true)
if [ -z "$RUSTDESK" ]; then
  if [ "$INSTALL_IF_MISSING" != '1' ]; then
    echo 'RustDesk is not installed or could not be found. Enable automatic installation or install RustDesk first.' >&2
    exit 1
  fi

  arch=$(uname -m)
  case "$arch" in
    x86_64|amd64) asset_arch=x86_64 ;;
    aarch64|arm64) asset_arch=aarch64 ;;
    *) echo "Unsupported CPU architecture: $arch" >&2; exit 1 ;;
  esac

  tmpdir=$(mktemp -d)
  trap 'rm -rf "$tmpdir"' EXIT
  if [ -f /etc/os-release ]; then . /etc/os-release; else ID=unknown; ID_LIKE=; fi
  family="${'${ID_LIKE:-}'} $ID"
  case "$family" in
    *debian*|*ubuntu*)
      package="$tmpdir/rustdesk.deb"
      curl -fL "https://github.com/rustdesk/rustdesk/releases/download/$RUSTDESK_VERSION/rustdesk-$RUSTDESK_VERSION-$asset_arch.deb" -o "$package"
      if [ "$asset_arch" = aarch64 ]; then expected='${hashes.deb.aarch64}'; else expected='${hashes.deb.x86_64}'; fi
      verify_sha256 "$package" "$expected"
      apt-get install -fy "$package"
      ;;
    *fedora*|*rhel*|*centos*|*rocky*|*almalinux*)
      package="$tmpdir/rustdesk.rpm"
      curl -fL "https://github.com/rustdesk/rustdesk/releases/download/$RUSTDESK_VERSION/rustdesk-$RUSTDESK_VERSION-0.$asset_arch.rpm" -o "$package"
      if [ "$asset_arch" = aarch64 ]; then expected='${hashes.rpm.aarch64}'; else expected='${hashes.rpm.x86_64}'; fi
      verify_sha256 "$package" "$expected"
      if command -v dnf >/dev/null 2>&1; then dnf install -y "$package"; else yum localinstall -y "$package"; fi
      ;;
    *suse*)
      package="$tmpdir/rustdesk.rpm"
      curl -fL "https://github.com/rustdesk/rustdesk/releases/download/$RUSTDESK_VERSION/rustdesk-$RUSTDESK_VERSION-0.$asset_arch-suse.rpm" -o "$package"
      if [ "$asset_arch" = aarch64 ]; then expected='${hashes.suse.aarch64}'; else expected='${hashes.suse.x86_64}'; fi
      verify_sha256 "$package" "$expected"
      zypper --non-interactive install --allow-unsigned-rpm "$package"
      ;;
    *arch*)
      if [ "$asset_arch" != x86_64 ]; then echo 'The official Arch package is currently only available for x86_64.' >&2; exit 1; fi
      package="$tmpdir/rustdesk.pkg.tar.zst"
      curl -fL "https://github.com/rustdesk/rustdesk/releases/download/$RUSTDESK_VERSION/rustdesk-$RUSTDESK_VERSION-0-x86_64.pkg.tar.zst" -o "$package"
      verify_sha256 "$package" '${hashes.arch}'
      pacman --noconfirm -U "$package"
      ;;
    *) echo "Unsupported Linux distribution: $ID. Install RustDesk manually and run the script again." >&2; exit 1 ;;
  esac
  RUSTDESK=$(find_rustdesk || true)
  if [ -z "$RUSTDESK" ]; then echo 'RustDesk was installed but its executable could not be located.' >&2; exit 1; fi
fi

if [ -n "$RUSTDESK_CONFIG" ]; then
  if ! CONFIG_OUTPUT=$("$RUSTDESK" --config "$RUSTDESK_CONFIG" 2>&1); then echo "RustDesk configuration failed: $CONFIG_OUTPUT" >&2; exit 1; fi
  if printf '%s' "$CONFIG_OUTPUT" | grep -Eqi 'required|failed|disabled'; then echo "RustDesk configuration failed: $CONFIG_OUTPUT" >&2; exit 1; fi
fi
if command -v systemctl >/dev/null 2>&1; then systemctl restart rustdesk.service 2>/dev/null || true; fi

RUSTDESK_ID=
tries=0
while [ -z "$RUSTDESK_ID" ] && [ "$tries" -lt 30 ]; do
  RUSTDESK_ID=$("$RUSTDESK" --get-id 2>/dev/null | tr -cd '0-9' || true)
  [ -n "$RUSTDESK_ID" ] || sleep 2
  tries=$((tries + 1))
done
case "$RUSTDESK_ID" in ''|*[!0-9]*) echo 'RustDesk did not return a valid device ID.' >&2; exit 1 ;; esac

HOSTNAME_VALUE=$(hostname 2>/dev/null || uname -n)
if [ -f /etc/os-release ]; then . /etc/os-release; OS_VALUE="${'${PRETTY_NAME:-Linux}'}"; else OS_VALUE=$(uname -srm); fi
VERSION_VALUE=$("$RUSTDESK" --version 2>/dev/null || true)
RECOVERY_DIR=/var/lib/rustdesk-book
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
`
}
