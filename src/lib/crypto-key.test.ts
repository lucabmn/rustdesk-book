import { describe, expect, it } from 'vitest'

import { decryptSecret, encryptSecret, loadEncryptionKey } from '#/lib/crypto'

const VALID_BASE64 = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
const VALID_HEX = '00'.repeat(32)

describe('loadEncryptionKey', () => {
  it('refuses to start without a key', () => {
    expect(() => loadEncryptionKey({})).toThrow(/APP_ENCRYPTION_KEY is not set/)
  })

  it('refuses a key of the wrong length', () => {
    expect(() => loadEncryptionKey({ APP_ENCRYPTION_KEY: 'c2hvcnQ=' })).toThrow(
      /must decode to 32 bytes/,
    )
  })

  it('accepts hex and base64 encodings of the same key', () => {
    const fromHex = loadEncryptionKey({ APP_ENCRYPTION_KEY: VALID_HEX })
    const fromBase64 = loadEncryptionKey({ APP_ENCRYPTION_KEY: VALID_BASE64 })
    expect(fromHex).toHaveLength(32)
    expect(fromHex.equals(fromBase64)).toBe(true)
  })

  it('is the key the module actually encrypts with', () => {
    // The configured test key is the all-zero one; a payload written by the
    // module must therefore decrypt with it.
    expect(process.env.APP_ENCRYPTION_KEY).toBe(VALID_BASE64)
    expect(decryptSecret(encryptSecret('secret'))).toBe('secret')
  })
})
