/**
 * Standalone database migrator. Bundled with esbuild at image-build time into
 * a single file so the runtime container needs no node_modules — only the
 * compiled bundle and the ./drizzle SQL folder. Run before the server starts.
 */
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('[migrate] DATABASE_URL is required')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: url })
const db = drizzle(pool)

try {
  console.log('[migrate] applying migrations…')
  await migrate(db, {
    migrationsFolder: process.env.MIGRATIONS_FOLDER ?? './drizzle',
  })
  console.log('[migrate] up to date')
} catch (err) {
  console.error('[migrate] failed:', err)
  process.exit(1)
} finally {
  await pool.end()
}
