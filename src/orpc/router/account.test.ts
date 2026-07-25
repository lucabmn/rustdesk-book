import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { invitation } from '#/db/schema'
import * as account from './account'
import { createTestDb, type TestDb } from '#/test/db'
import { createUser } from '#/test/factories'
import { rpc } from '#/test/rpc'
import { resetSignUpCalls, signOut, signUpCalls } from '#/test/session'

let db: TestDb
let callRpc: ReturnType<typeof rpc>

const credentials = {
  name: 'First Admin',
  email: 'admin@example.com',
  password: 'a-long-password',
}

async function insertInvite(
  overrides: Partial<{
    email: string
    token: string
    role: string
    expiresAt: Date
    acceptedAt: Date | null
  }> = {},
) {
  const [row] = await db
    .insert(invitation)
    .values({
      email: overrides.email ?? 'invited@example.com',
      token: overrides.token ?? 'invite-token',
      role: overrides.role ?? 'member',
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 86_400_000),
      acceptedAt: overrides.acceptedAt ?? null,
    })
    .returning()
  return row
}

beforeEach(async () => {
  db = await createTestDb()
  callRpc = rpc(db)
  resetSignUpCalls()
  // Every procedure in this router is public.
  signOut()
})

afterEach(async () => {
  await db.$close()
})

describe('status', () => {
  it('reports bootstrap as needed while no user exists', async () => {
    expect(await callRpc(account.status)).toEqual({ needsBootstrap: true })
    await createUser(db)
    signOut()
    expect(await callRpc(account.status)).toEqual({ needsBootstrap: false })
  })
})

describe('bootstrap', () => {
  it('creates the first account', async () => {
    expect(await callRpc(account.bootstrap, credentials)).toEqual({ ok: true })
    expect(signUpCalls).toHaveLength(1)
    expect(signUpCalls[0].email).toBe('admin@example.com')
    // Bootstrap must not claim to be an invited registration.
    expect(signUpCalls[0].invited).toBeUndefined()
  })

  it('is refused once an account exists', async () => {
    await createUser(db)
    signOut()
    await expect(callRpc(account.bootstrap, credentials)).rejects.toThrow(
      /bereits ein Konto/,
    )
    expect(signUpCalls).toHaveLength(0)
  })

  it('rejects a short password', async () => {
    await expect(
      callRpc(account.bootstrap, { ...credentials, password: 'short' }),
    ).rejects.toThrow()
  })
})

describe('getInvite', () => {
  it('resolves a pending invite to its bound email', async () => {
    await insertInvite()
    expect(await callRpc(account.getInvite, { token: 'invite-token' })).toEqual(
      { email: 'invited@example.com' },
    )
  })

  it('rejects unknown, accepted and expired invites', async () => {
    await expect(callRpc(account.getInvite, { token: 'nope' })).rejects.toThrow(
      /ungültig oder abgelaufen/,
    )

    await insertInvite({ token: 'used', acceptedAt: new Date() })
    await expect(callRpc(account.getInvite, { token: 'used' })).rejects.toThrow(
      /ungültig oder abgelaufen/,
    )

    await insertInvite({
      token: 'stale',
      expiresAt: new Date(Date.now() - 1000),
    })
    await expect(
      callRpc(account.getInvite, { token: 'stale' }),
    ).rejects.toThrow(/ungültig oder abgelaufen/)
  })
})

describe('acceptInvite', () => {
  it('signs up inside the invited-registration context', async () => {
    await insertInvite({ role: 'admin' })
    const result = await callRpc(account.acceptInvite, {
      token: 'invite-token',
      name: 'Invited User',
      password: 'a-long-password',
    })

    expect(result).toEqual({ email: 'invited@example.com' })
    expect(signUpCalls).toHaveLength(1)
    // The role comes from the invitation, never from client input.
    expect(signUpCalls[0].invited).toEqual({
      email: 'invited@example.com',
      role: 'admin',
    })
  })

  it('refuses an invalid token without signing anyone up', async () => {
    await expect(
      callRpc(account.acceptInvite, {
        token: 'nope',
        name: 'Nobody',
        password: 'a-long-password',
      }),
    ).rejects.toThrow(/ungültig oder abgelaufen/)
    expect(signUpCalls).toHaveLength(0)
  })
})
