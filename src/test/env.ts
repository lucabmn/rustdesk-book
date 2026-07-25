/**
 * Normalize the environment tests run in.
 *
 * Some runners (Bun) auto-load the repo's `.env`, which would make the suite
 * depend on the machine it runs on — a configured RUSTDESK_API_URL would flip
 * live-sync on, a different APP_ENCRYPTION_KEY would break fixtures. Anything
 * a test cares about is therefore set or cleared explicitly here.
 */
export function normalizeTestEnv(): void {
  // Deterministic 32-byte key (all zeros) so the crypto module loads. Not a
  // real secret.
  process.env.APP_ENCRYPTION_KEY =
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
  // Never connected to — `#/db` builds a lazy pool at import time and the
  // procedures under test receive an in-memory PGlite handle instead.
  process.env.DATABASE_URL =
    'postgres://user:pass@127.0.0.1:5432/rustdesk_book_test'

  for (const key of [
    'RUSTDESK_API_URL',
    'RUSTDESK_API_KEY',
    'RUSTDESK_API_PATH',
    'RUSTDESK_SYNC_TTL',
    'BETTER_AUTH_URL',
    'TRUST_PROXY_HEADERS',
  ]) {
    delete process.env[key]
  }
}
