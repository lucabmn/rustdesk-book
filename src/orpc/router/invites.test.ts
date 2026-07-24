import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'

import { invitation } from '#/db/schema'
import * as invites from './invites'
import { createTestDb, type TestDb } from '#/test/db'
import { createUser } from '#/test/factories'
import { rpc } from '#/test/rpc'
import { signIn } from '#/test/session'

let db: TestDb
let callRpc: ReturnType<typeof rpc>

beforeEach(async () => {
  db = await createTestDb()
  callRpc = rpc(db)
  await createUser(db, { id: 'admin-1', email: 'admin@example.com' })
})

afterEach(async () => {
  await db.$close()
})

const create = (email: string, role: 'admin' | 'member' = 'member') =>
  callRpc(invites.create, { email, role }) as Promise<{
    token: string
    email: string
  }>

describe('create', () => {
  it('issues a random token bound to a normalized email', async () => {
    const first = await create('  New.User@Example.COM  ')
    const second = await create('other@example.com')
    expect(first.email).toBe('new.user@example.com')
    expect(first.token).toHaveLength(64)
    expect(first.token).not.toBe(second.token)

    const rows = await db.select().from(invitation)
    expect(rows).toHaveLength(2)
    expect(rows[0].invitedBy).toBe('admin-1')
    expect(rows[0].expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('rejects a malformed email', async () => {
    await expect(create('not-an-email')).rejects.toThrow()
  })

  it('is admin-only', async () => {
    signIn({ role: 'member' })
    await expect(create('x@example.com')).rejects.toThrow(/Administratorrechte/)
  })
})

describe('list', () => {
  it('shows only pending invitations', async () => {
    await create('pending@example.com')
    const accepted = await create('accepted@example.com')
    await db
      .update(invitation)
      .set({ acceptedAt: new Date() })
      .where(eq(invitation.token, accepted.token))

    const rows = (await callRpc(invites.list)) as Array<{ email: string }>
    expect(rows.map((r) => r.email)).toEqual(['pending@example.com'])
  })
})

describe('revoke', () => {
  it('deletes an invitation', async () => {
    await create('x@example.com')
    const [row] = await db.select().from(invitation)
    await callRpc(invites.revoke, { id: row.id })
    expect(await db.select().from(invitation)).toHaveLength(0)
  })
})
