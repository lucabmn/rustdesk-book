import { expect, it } from 'vitest'

import { user } from '#/db/schema'
import { createTestDb } from './db'

it('applies the migrations to an in-memory database', async () => {
  const db = await createTestDb()
  await db.insert(user).values({ id: 'u1', name: 'A', email: 'a@example.com' })
  expect(await db.select().from(user)).toHaveLength(1)
  await db.$close()
})
