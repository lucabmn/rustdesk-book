import { afterEach, describe, expect, it, vi } from 'vitest'

const VALID_BASE64 = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
const VALID_HEX = '00'.repeat(32)

/** The key is read once at module load, so each case needs a fresh import. */
async function loadWithKey(key: string | undefined) {
  vi.resetModules()
  if (key === undefined) delete process.env.APP_ENCRYPTION_KEY
  else process.env.APP_ENCRYPTION_KEY = key
  return import('#/lib/crypto')
}

afterEach(() => {
  process.env.APP_ENCRYPTION_KEY = VALID_BASE64
  vi.resetModules()
})

describe('key loading', () => {
  it('refuses to start without a key', async () => {
    await expect(loadWithKey(undefined)).rejects.toThrow(
      /APP_ENCRYPTION_KEY is not set/,
    )
  })

  it('refuses a key of the wrong length', async () => {
    await expect(loadWithKey('c2hvcnQ=')).rejects.toThrow(
      /must decode to 32 bytes/,
    )
  })

  it('accepts hex and base64 keys interchangeably', async () => {
    const hex = await loadWithKey(VALID_HEX)
    const cipher = hex.encryptSecret('secret')
    const base64 = await loadWithKey(VALID_BASE64)
    expect(base64.decryptSecret(cipher)).toBe('secret')
  })
})
