import { describe, expect, it } from 'vitest'

import { decryptSecret, encryptSecret, safeEqual } from './crypto'

describe('crypto', () => {
  it('round-trips secrets including special and unicode characters', () => {
    for (const s of [
      'kR7#m@2p!x',
      'Datev!77x',
      'n@s_backup9',
      '',
      'ünïcödeЫ 🔐',
    ]) {
      expect(decryptSecret(encryptSecret(s))).toBe(s)
    }
  })

  it('produces different ciphertext each time (random IV)', () => {
    expect(encryptSecret('same input')).not.toBe(encryptSecret('same input'))
  })

  it('rejects a tampered payload (GCM auth tag)', () => {
    const buf = Buffer.from(encryptSecret('secret'), 'base64')
    buf[buf.length - 1] ^= 0xff
    expect(() => decryptSecret(buf.toString('base64'))).toThrow()
  })

  it('rejects a malformed/truncated payload', () => {
    expect(() => decryptSecret('abc')).toThrow()
  })

  it('safeEqual compares in constant time by value', () => {
    expect(safeEqual('token', 'token')).toBe(true)
    expect(safeEqual('token', 'Token')).toBe(false)
    expect(safeEqual('token', 'token-longer')).toBe(false)
  })
})
