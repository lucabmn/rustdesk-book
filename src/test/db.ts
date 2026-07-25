import { PGlite } from '@electric-sql/pglite'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'

import * as schema from '#/db/schema'

export type TestDb = ReturnType<typeof drizzle<typeof schema>> & {
  /** Releases the database for the next test. See {@link createTestDb}. */
  $close: () => Promise<void>
}

/**
 * One in-memory Postgres per worker process. Booting PGlite and running the
 * migrations costs ~2s, which is far too much to pay per test — so the
 * instance is created once and every test starts from a truncated copy
 * instead. Vitest isolates files in their own workers, so files still never
 * share state.
 */
let instance: Promise<{ db: TestDb; truncate: () => Promise<void> }> | null =
  null

async function boot() {
  const client = new PGlite()
  const db = drizzle(client, { schema }) as TestDb
  const { migrate } = await import('drizzle-orm/pglite/migrator')
  await migrate(db, { migrationsFolder: 'drizzle' })

  // Every application table, resolved once from the catalog so a new table
  // can never silently leak rows from one test into the next.
  const tables = (
    await db.execute<{ tablename: string }>(sql`
      select tablename from pg_tables
      where schemaname = 'public' and tablename <> '__drizzle_migrations'
    `)
  ).rows.map((row) => `"${row.tablename}"`)

  const truncate = async () => {
    await db.execute(
      sql.raw(`truncate table ${tables.join(', ')} restart identity cascade`),
    )
  }

  db.$close = async () => {
    /* the instance is reused; state is reset on the next createTestDb() */
  }
  return { db, truncate }
}

/**
 * An empty database with the production schema applied, backed by the
 * migrations in `drizzle/`. Call it in `beforeEach`; the returned handle is
 * cheap and always starts empty.
 */
export async function createTestDb(): Promise<TestDb> {
  instance ??= boot()
  const { db, truncate } = await instance
  await truncate()
  return db
}
