import {
  DEFAULT_RUSTDESK_VERSION,
  DOWNLOAD_SHA256,
  normalizedOrigin,
  powershellQuote,
  type DeploymentScriptOptions,
} from './shared'

export function windowsScript(options: DeploymentScriptOptions): string {
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
