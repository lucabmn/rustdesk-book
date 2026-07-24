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
        'src/lib/i18n.tsx',
        'src/lib/theme.ts',
        'src/orpc/client.ts',
      ],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
})
