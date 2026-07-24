import { describe, expect, it } from 'vitest'

import {
  buildDeploymentScript,
  buildDeploymentScripts,
  DEFAULT_RUSTDESK_VERSION,
} from './deployment-script'

describe('deployment scripts', () => {
  const options = {
    baseUrl: 'https://book.example.test/some/path',
    token: 'rdb_test-token',
    installIfMissing: true,
    rustdeskConfig: "host=desk.example,key=it's-public",
  }

  it('generates scripts for every supported desktop platform', () => {
    const scripts = buildDeploymentScripts(options)

    for (const script of Object.values(scripts)) {
      expect(script).toContain('https://book.example.test/api/enroll/claim')
      expect(script).toContain('https://book.example.test/api/enroll/finalize')
      expect(script).toContain('rdb_test-token')
      expect(script).toContain('--get-id')
      expect(script).toContain('--password')
      expect(script).toContain('--config')
      expect(script).not.toContain('--deploy')
      expect(script).not.toContain('rustdesk-server-pro')
    }
  })

  it('finds RustDesk without assuming one fixed installation path', () => {
    const scripts = buildDeploymentScripts(options)

    expect(scripts.windows).toContain('Win32_Service')
    expect(scripts.windows).toContain('Uninstall\\*')
    expect(scripts.linux).toContain('command -v rustdesk')
    expect(scripts.linux).toContain('systemctl cat rustdesk.service')
    expect(scripts.macos).toContain('mdfind')
    expect(scripts.macos).toContain('/Applications/RustDesk.app')
  })

  it('only includes package download execution when installation is enabled', () => {
    const enabled = buildDeploymentScript('windows', options)
    const disabled = buildDeploymentScript('windows', {
      ...options,
      installIfMissing: false,
    })

    expect(enabled).toContain('$InstallIfMissing = $true')
    expect(disabled).toContain('$InstallIfMissing = $false')
    expect(disabled).toContain("if (-not $InstallIfMissing)")
  })

  it('uses a pinned and checksum-verified official RustDesk OSS release', () => {
    const scripts = buildDeploymentScripts(options)
    expect(scripts.linux).toContain(`RUSTDESK_VERSION='${DEFAULT_RUSTDESK_VERSION}'`)
    expect(scripts.linux).toContain('github.com/rustdesk/rustdesk/releases/download')
    expect(scripts.linux).toContain('verify_sha256')
    expect(scripts.windows).toContain('Get-FileHash')
    expect(scripts.windows).toContain('Get-AuthenticodeSignature')
    expect(scripts.macos).toContain('codesign --verify')
  })

  it('claims before changing the password and keeps recovery data until finalize succeeds', () => {
    const scripts = buildDeploymentScripts(options)
    for (const script of Object.values(scripts)) {
      expect(script.indexOf('/api/enroll/claim')).toBeLessThan(script.indexOf('--password'))
      expect(script).toContain('recovery')
      expect(script).toContain('/api/enroll/finalize')
    }
    expect(scripts.windows).toContain('RandomNumberGenerator]::Create()')
    expect(scripts.windows).toContain('$recovery.expiresAt')
    expect(scripts.windows).not.toContain('RandomNumberGenerator]::Fill(')
    for (const script of [scripts.linux, scripts.macos]) {
      expect(script).toContain('CLAIM_EXPIRES')
      expect(script).toContain('date +%s')
      expect(script).toMatch(/\\\n\s+--header/)
      expect(script).not.toMatch(/\\\\\n\s+--header/)
    }
  })

  it('quotes config values for PowerShell and POSIX shells', () => {
    const scripts = buildDeploymentScripts(options)
    expect(scripts.windows).toContain("key=it''s-public")
    expect(scripts.linux).toContain(`key=it'"'"'s-public`)
    expect(scripts.macos).toContain(`key=it'"'"'s-public`)
  })
})
