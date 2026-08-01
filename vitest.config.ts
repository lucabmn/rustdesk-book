import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '#': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
    // Booting the in-memory Postgres once per worker takes a moment; the
    // default 5s is tight for the first test on a busy machine or in an IDE.
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // Deterministic 32-byte key (all zeros) so the crypto module loads in tests.
    // Not a real secret.
    env: {
      APP_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      // Never connected to — `#/db` builds a lazy pool at import time and the
      // procedures under test receive an in-memory PGlite handle instead.
      DATABASE_URL: 'postgres://user:pass@127.0.0.1:5432/rustdesk_book_test',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov'],
      include: ['src/lib/**', 'src/orpc/**', 'src/utils/**'],
      exclude: [
        'src/**/*.test.ts',
        'src/lib/auth-client.ts',
        'src/lib/auth-server.ts',
        // Pure better-auth wiring; the policy it delegates to (auth-policy.ts)
        // is covered directly.
        'src/lib/auth.ts',
        'src/lib/i18n.tsx',
        // Browser plumbing around the worker: registration, `controllerchange`,
        // `postMessage`. Everything it decides lives in sw-core.ts, which is
        // covered directly; what is left here needs a real service worker.
        'src/lib/sw-client.ts',
        'src/lib/theme.ts',
        'src/orpc/client.ts',
      ],
      // Ratchet: raise these as coverage grows, never lower them.
      thresholds: {
        statements: 95,
        branches: 88,
        functions: 95,
        lines: 95,
      },
    },
  },
})
