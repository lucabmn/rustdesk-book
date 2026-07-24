import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { invitation, user } from '#/db/schema'
import {
  AccountBanned,
  assertNotBanned,
  consumeInvitations,
  isFirstUser,
  RegistrationDenied,
  resolveSignUpRole,
} from '#/lib/auth-policy'
import { invitedRegistration } from '#/lib/registration-context'
import { createTestDb, type TestDb } from '#/test/db'

let db: TestDb

async function seedUser(overrides: Partial<typeof user.$inferInsert> = {}) {
  await db
    .insert(user)
    .values({
      id: 'user-1',
      name: 'Existing',
      email: 'existing@example.com',
      ...overrides,
    })
    .onConflictDoNothing()
}

beforeEach(async () => {
  db = await createTestDb()
})

afterEach(async () => {
  await db.$close()
})

describe('isFirstUser', () => {
  it('is true only while the instance is empty', async () => {
    expect(await isFirstUser(db as never)).toBe(true)
    await seedUser()
    expect(await isFirstUser(db as never)).toBe(false)
  })
})

describe('resolveSignUpRole', () => {
  it('promotes the very first account to admin', async () => {
    expect(await resolveSignUpRole(db as never, 'First@Example.com')).toBe(
      'admin',
    )
  })

  it('refuses a later sign-up outside an invited registration', async () => {
    await seedUser()
    await expect(
      resolveSignUpRole(db as never, 'someone@example.com'),
    ).rejects.toThrow(RegistrationDenied)
  })

  it('refuses a sign-up whose email does not match the invite', async () => {
    await seedUser()
    await invitedRegistration.run(
      { email: 'invited@example.com', role: 'member' },
      async () => {
        await expect(
          resolveSignUpRole(db as never, 'attacker@example.com'),
        ).rejects.toThrow(RegistrationDenied)
      },
    )
  })

  it('takes the role from the validated invitation', async () => {
    await seedUser()
    await invitedRegistration.run(
      { email: 'invited@example.com', role: 'admin' },
      async () => {
        // Case differences must not defeat the match.
        expect(
          await resolveSignUpRole(db as never, 'Invited@Example.com'),
        ).toBe('admin')
      },
    )
  })
})

describe('consumeInvitations', () => {
  it('marks pending invitations for that address as accepted', async () => {
    const expiresAt = new Date(Date.now() + 86_400_000)
    await db.insert(invitation).values([
      { email: 'invited@example.com', token: 'a', expiresAt },
      { email: 'other@example.com', token: 'b', expiresAt },
    ])

    await consumeInvitations(db as never, 'Invited@Example.com')

    const rows = await db.select().from(invitation)
    const mine = rows.find((r) => r.email === 'invited@example.com')
    const other = rows.find((r) => r.email === 'other@example.com')
    expect(mine?.acceptedAt).not.toBeNull()
    expect(other?.acceptedAt).toBeNull()
  })
})

describe('assertNotBanned', () => {
  it('passes for an active account and an unknown id', async () => {
    await seedUser()
    await expect(
      assertNotBanned(db as never, 'user-1'),
    ).resolves.toBeUndefined()
    await expect(assertNotBanned(db as never, 'ghost')).resolves.toBeUndefined()
  })

  it('rejects a banned account', async () => {
    await seedUser({ banned: true })
    await expect(assertNotBanned(db as never, 'user-1')).rejects.toThrow(
      AccountBanned,
    )
  })
})
