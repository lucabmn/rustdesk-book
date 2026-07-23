import { describe, expect, it } from 'vitest'

import { formatRustdeskId, osLabel } from './device-meta'

describe('device-meta', () => {
  it('formats a RustDesk id into groups of three', () => {
    expect(formatRustdeskId('482910375')).toBe('482 910 375')
    expect(formatRustdeskId('1234567890')).toBe('123 456 789 0')
    expect(formatRustdeskId('12')).toBe('12')
    expect(formatRustdeskId('4a8b')).toBe('48')
  })

  it('maps known OS keys to labels and falls back gracefully', () => {
    expect(osLabel('win11')).toBe('Windows 11')
    expect(osLabel('ubuntu')).toBe('Ubuntu 22.04')
    expect(osLabel('freebsd')).toBe('freebsd')
    expect(osLabel(null)).toBe('—')
    expect(osLabel(undefined)).toBe('—')
  })
})
