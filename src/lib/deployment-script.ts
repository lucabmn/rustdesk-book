export const DEFAULT_RUSTDESK_VERSION = '1.4.9'

export type DeploymentPlatform = 'windows' | 'linux' | 'macos'

export interface DeploymentScriptOptions {
  baseUrl: string
  token: string
  installIfMissing: boolean
  rustdeskConfig?: string | null
}

const DOWNLOAD_SHA256 = {
  windows: {
    x86_64: 'c87d2f4cef2a5acd6003b6507dcfbf5d5168a256db082cd90b54d35193224aaa',
    aarch64: '30bc8925e62c7ade52371758c2b944036ed2386f6c554e9e59f3bcfef06c7cd9',
  },
  deb: {
    x86_64: '7244ba47c40e804172044bfbe659467c54ce46554c98e78c8c0406f1d612fda3',
    aarch64: 'ce62c996f14d33f3bbe3a330e953644a44bace7f05885a7953f7395d69fb49c0',
  },
  rpm: {
    x86_64: 'eb1b053ac5b2f774f2271f7fbbfd2ea475899f7a55135c5e172bc54b9388f108',
    aarch64: '3e523df7ceb6f3804b047a3cac797354c4bf46ec19f2d7ff5e198787003cb092',
  },
  suse: {
    x86_64: 'b28bdb5a4afcd3f0475664ad2e635eb4209f15ed44566f83469453b175e8a197',
    aarch64: 'e426192be57357eb9178f886b92188d6839eeb438d64a206fcea9dfb49eaee59',
  },
  arch: '679760e1a1f1b930529069edfaec219afa16b5efe44c1bc593cede0e65576c11',
  macos: {
    x86_64: 'fa1129a0635019f9c5841937942cc2b08be028a192f47c009edde7e53812904e',
    aarch64: 'f7935597b247d42c8f2a2ed71176a9f5868018cd9e1a33b8096418a668c8caf0',
  },
} as const

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`
}

function powershellQuote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

function normalizedOrigin(value: string): string {
  return new URL(value).origin
}

function windowsScript(options: DeploymentScriptOptions): string {
  const origin = normalizedOrigin(options.baseUrl)
  const version = DEFAULT_RUSTDESK_VERSION
  const config = options.rustdeskConfig?.trim() ?? ''
  const windowsHashes = DOWNLOAD_SHA256.windows

  return String.raw`# rustdesk-book deployment for Windows (RustDesk OSS)
# Run in an elevated PowerShell or as SYSTEM (GPO/Intune/RMM).
# This file contains a bearer token. Restrict access and delete it when no longer needed.
$ErrorActionPreference = 'Stop'
$ClaimUrl = ${powershellQuote(`${origin}/api/enroll/claim`)}
$FinalizeUrl = ${powershellQuote(`${origin}/api/enroll/finalize`)}
$EnrollmentToken = ${powershellQuote(options.token)}
$InstallIfMissing = $${options.installIfMissing ? 'true' : 'false'}
$RustDeskVersion = ${powershellQuote(version)}
$RustDeskConfig = ${powershellQuote(config)}

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Run this deployment as Administrator or SYSTEM.'
}

function Find-RustDesk {
  $service = Get-CimInstance Win32_Service -Filter "Name='RustDesk'" -ErrorAction SilentlyContinue
  if ($service -and $service.PathName) {
    $servicePath = [regex]::Match($service.PathName, '^(?:"([^"]+)"|([^ ]+))').Groups
    $candidate = if ($servicePath[1].Value) { $servicePath[1].Value } else { $servicePath[2].Value }
    if (Test-Path $candidate) { return (Resolve-Path $candidate).Path }
  }

  $uninstallRoots = @(
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
  )
  foreach ($entry in Get-ItemProperty $uninstallRoots -ErrorAction SilentlyContinue) {
    if ($entry.DisplayName -like 'RustDesk*') {
      if ($entry.InstallLocation) {
        $candidate = Join-Path $entry.InstallLocation 'rustdesk.exe'
        if (Test-Path $candidate) { return (Resolve-Path $candidate).Path }
      }
      if ($entry.DisplayIcon) {
        $candidate = ($entry.DisplayIcon -replace ',\d+$', '').Trim('"')
        if (Test-Path $candidate) { return (Resolve-Path $candidate).Path }
      }
    }
  }

  foreach ($candidate in @(
    "$env:ProgramFiles\RustDesk\rustdesk.exe",
    "${'${env:ProgramFiles(x86)}'}\RustDesk\rustdesk.exe",
    "$env:LOCALAPPDATA\Programs\RustDesk\rustdesk.exe"
  )) {
    if ($candidate -and (Test-Path $candidate)) { return (Resolve-Path $candidate).Path }
  }

  $command = Get-Command rustdesk.exe -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  return $null
}

$RustDesk = Find-RustDesk
if (-not $RustDesk) {
  if (-not $InstallIfMissing) {
    throw 'RustDesk is not installed or could not be found. Enable automatic installation or install RustDesk first.'
  }

  $arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') { 'aarch64' } else { 'x86_64' }
  $expectedHash = if ($arch -eq 'aarch64') { '${windowsHashes.aarch64}' } else { '${windowsHashes.x86_64}' }
  $msi = Join-Path $env:TEMP "rustdesk-$RustDeskVersion-$arch.msi"
  $download = "https://github.com/rustdesk/rustdesk/releases/download/$RustDeskVersion/rustdesk-$RustDeskVersion-$arch.msi"
  Invoke-WebRequest -UseBasicParsing -Uri $download -OutFile $msi
  $actualHash = (Get-FileHash -Algorithm SHA256 $msi).Hash.ToLowerInvariant()
  if ($actualHash -ne $expectedHash) { Remove-Item $msi -Force; throw 'RustDesk MSI checksum verification failed.' }
  $signature = Get-AuthenticodeSignature $msi
  if ($signature.Status -ne 'Valid') { Remove-Item $msi -Force; throw "RustDesk MSI signature verification failed: $($signature.Status)" }
  $process = Start-Process msiexec.exe -Wait -PassThru -ArgumentList @('/i', $msi, '/qn', 'CREATEDESKTOPSHORTCUTS=N', 'INSTALLPRINTER=N')
  Remove-Item $msi -Force -ErrorAction SilentlyContinue
  if ($process.ExitCode -notin @(0, 1641, 3010)) { throw "RustDesk MSI installation failed with exit code $($process.ExitCode)." }
  $RustDesk = Find-RustDesk
  if (-not $RustDesk) { throw 'RustDesk was installed but its executable could not be located.' }
}

if ($RustDeskConfig) {
  $configOutput = (& $RustDesk --config $RustDeskConfig 2>&1 | Out-String)
  if ($LASTEXITCODE -ne 0 -or $configOutput -match 'required|failed|disabled') { throw "RustDesk configuration failed: $configOutput" }
}

$RustDeskId = ''
for ($attempt = 0; $attempt -lt 30 -and -not $RustDeskId; $attempt++) {
  $RustDeskId = ((& $RustDesk --get-id 2>$null | Out-String) -replace '[^0-9]', '').Trim()
  if (-not $RustDeskId) { Start-Sleep -Seconds 2 }
}
if ($RustDeskId -notmatch '^\d{6,12}$') { throw 'RustDesk did not return a valid device ID.' }

$recoveryDir = Join-Path $env:ProgramData 'rustdesk-book'
$recoveryPath = Join-Path $recoveryDir "enrollment-recovery-$RustDeskId.json"
New-Item -ItemType Directory -Force -Path $recoveryDir | Out-Null
& icacls.exe $recoveryDir /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not secure the rustdesk-book recovery directory.' }

$recovery = $null
if (Test-Path $recoveryPath) {
  try { $recovery = Get-Content $recoveryPath -Raw | ConvertFrom-Json } catch { $recovery = $null }
}
$RustDeskPassword = $null
$ClaimToken = $null
if ($recovery -and $recovery.rustdeskId -eq $RustDeskId -and $recovery.password) {
  $RustDeskPassword = $recovery.password
  try {
    if ($recovery.claimToken -and $recovery.expiresAt -and [DateTimeOffset]::Parse($recovery.expiresAt) -gt [DateTimeOffset]::UtcNow) {
      $ClaimToken = $recovery.claimToken
    }
  } catch { $ClaimToken = $null }
}
if (-not $ClaimToken) {
  $claimPayload = @{
    rustdeskId = $RustDeskId
    alias = $env:COMPUTERNAME
    hostname = $env:COMPUTERNAME
    os = (Get-CimInstance Win32_OperatingSystem).Caption
    rustdeskVersion = (& $RustDesk --version 2>$null | Out-String).Trim()
  } | ConvertTo-Json
  $claim = Invoke-RestMethod -Method Post -Uri $ClaimUrl -Headers @{ Authorization = "Bearer $EnrollmentToken" } -ContentType 'application/json' -Body $claimPayload
  if ($claim.alreadyEnrolled) {
    Remove-Item $recoveryPath -Force -ErrorAction SilentlyContinue
    Write-Host "Device $env:COMPUTERNAME ($RustDeskId) is already present in rustdesk-book."
    exit 0
  }
  $ClaimToken = $claim.claimToken
  if (-not $RustDeskPassword) {
    $passwordBytes = [byte[]]::new(16)
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($passwordBytes) } finally { $rng.Dispose() }
    $RustDeskPassword = -join ($passwordBytes | ForEach-Object { $_.ToString('x2') })
  }
  @{ rustdeskId = $RustDeskId; password = $RustDeskPassword; claimToken = $ClaimToken; expiresAt = $claim.expiresAt } | ConvertTo-Json | Set-Content -Encoding UTF8 $recoveryPath
  & icacls.exe $recoveryPath /inheritance:r /grant:r '*S-1-5-18:F' '*S-1-5-32-544:F' | Out-Null
  if ($LASTEXITCODE -ne 0) { Remove-Item $recoveryPath -Force -ErrorAction SilentlyContinue; throw 'Could not secure the rustdesk-book recovery file.' }
}

$passwordOutput = (& $RustDesk --password $RustDeskPassword 2>&1 | Out-String)
if ($LASTEXITCODE -ne 0 -or $passwordOutput -match 'required|failed|disabled') { throw "Setting the RustDesk password failed: $passwordOutput" }

$finalPayload = @{ password = $RustDeskPassword } | ConvertTo-Json
$completed = $false
for ($attempt = 0; $attempt -lt 5 -and -not $completed; $attempt++) {
  try {
    Invoke-RestMethod -Method Post -Uri $FinalizeUrl -Headers @{ Authorization = "Bearer $ClaimToken" } -ContentType 'application/json' -Body $finalPayload | Out-Null
    $completed = $true
  } catch {
    if ($attempt -ge 4) { throw "Enrollment could not be finalized. Re-run this script; recovery data remains at $recoveryPath. $($_.Exception.Message)" }
    Start-Sleep -Seconds ([math]::Pow(2, $attempt))
  }
}
Remove-Item $recoveryPath -Force -ErrorAction SilentlyContinue
Write-Host "Device $env:COMPUTERNAME ($RustDeskId) was added to rustdesk-book."
`
}

function linuxScript(options: DeploymentScriptOptions): string {
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

function macosScript(options: DeploymentScriptOptions): string {
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

export function buildDeploymentScript(
  platform: DeploymentPlatform,
  options: DeploymentScriptOptions,
): string {
  if (platform === 'windows') return windowsScript(options)
  if (platform === 'linux') return linuxScript(options)
  return macosScript(options)
}

export function buildDeploymentScripts(options: DeploymentScriptOptions) {
  return {
    windows: buildDeploymentScript('windows', options),
    linux: buildDeploymentScript('linux', options),
    macos: buildDeploymentScript('macos', options),
  }
}
