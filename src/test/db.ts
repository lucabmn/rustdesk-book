import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'

import * as schema from '#/db/schema'

export type TestDb = ReturnType<typeof drizzle<typeof schema>> & {
  $close: () => Promise<void>
}

/**
 * Spin up an isolated in-memory Postgres (PGlite) with the production schema
 * applied via drizzle-kit's generated migrations. Every test file gets its own
 * instance, so tests never share state and no external database is required.
 */
export async function createTestDb(): Promise<TestDb> {
  const client = new PGlite()
  const db = drizzle(client, { schema })
  const { migrate } = await import('drizzle-orm/pglite/migrator')
  await migrate(db, { migrationsFolder: 'drizzle' })
  return Object.assign(db, {
    $close: () => client.close(),
  }) as TestDb
}
