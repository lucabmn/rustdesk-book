/**
 * Symmetric encryption for device passwords (secrets at rest).
 *
 * RustDesk connect URIs need the password in cleartext, so hashing is not an
 * option — secrets are encrypted reversibly with AES-256-GCM and only ever
 * decrypted server-side, on an explicit authenticated request.
 *
 * Stored payload layout (base64-encoded): iv(12) ‖ authTag(16) ‖ ciphertext.
 *
 * The key comes from APP_ENCRYPTION_KEY and is REQUIRED — the process refuses
 * to start without a valid one. It must be distinct from BETTER_AUTH_SECRET.
 *
 * ⚠ Losing APP_ENCRYPTION_KEY means every stored password is unrecoverable.
 *   Keep it backed up separately from the database.
 */
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_BYTES = 32
const IV_BYTES = 12
const TAG_BYTES = 16

function loadKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      'APP_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32` ' +
        'and set it in the environment. Without it, device passwords cannot be stored.',
    )
  }

  // Accept either base64 (recommended) or hex encoding.
  let key: Buffer
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, 'hex')
  } else {
    key = Buffer.from(raw, 'base64')
  }

  if (key.length !== KEY_BYTES) {
    throw new Error(
      `APP_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (got ${key.length}). ` +
        'Use `openssl rand -base64 32` to generate a valid key.',
    )
  }
  return key
}

// Fail fast at module load: a misconfigured key must never be discovered
// lazily on the first write.
const key = loadKey()

/** Encrypt a UTF-8 secret. Returns a self-describing base64 payload. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ciphertext]).toString('base64')
}

/** Decrypt a payload produced by {@link encryptSecret}. Throws if tampered. */
export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, 'base64')
  if (buf.length < IV_BYTES + TAG_BYTES) {
    throw new Error('Encrypted payload is malformed or truncated.')
  }
  const iv = buf.subarray(0, IV_BYTES)
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8')
}

/** Constant-time string comparison for secrets (e.g. the MCP API key). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}
