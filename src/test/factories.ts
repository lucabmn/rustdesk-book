import { user } from '#/db/schema'
import type { TestDb } from './db'
import { signIn, type TestUser } from './session'

/**
 * Create a `user` row and make it the signed-in caller. Router procedures write
 * foreign keys against `user.id`, so the row has to exist for real.
 */
export async function createUser(
  db: TestDb,
  overrides: Partial<TestUser> = {},
): Promise<TestUser> {
  const signed = signIn(overrides)
  await db
    .insert(user)
    .values({
      id: signed.id,
      name: signed.name,
      email: signed.email,
      role: signed.role,
      banned: signed.banned ?? false,
    })
    .onConflictDoNothing()
  return signed
}
