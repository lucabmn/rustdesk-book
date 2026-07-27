import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'

import { session as sessionTable, user as userTable } from '#/db/schema'
import * as users from './users'
import { createTestDb, type TestDb } from '#/test/db'
import { createUser } from '#/test/factories'
import { rpc } from '#/test/rpc'
import { signIn } from '#/test/session'
import { auditActions, auditEntries } from '#/test/audit'

let db: TestDb
let callRpc: ReturnType<typeof rpc>

const asAdmin = () =>
  signIn({ id: 'admin-1', email: 'admin@example.com', role: 'admin' })

async function row(id: string) {
  const [found] = await db.select().from(userTable).where(eq(userTable.id, id))
  return found
}

beforeEach(async () => {
  db = await createTestDb()
  callRpc = rpc(db)
  await createUser(db, { id: 'admin-1', email: 'admin@example.com' })
  await createUser(db, {
    id: 'member-1',
    email: 'member@example.com',
    role: 'member',
  })
  asAdmin()
})

afterEach(async () => {
  await db.$close()
})

describe('list', () => {
  it('returns every user with their device counts', async () => {
    const rows = (await callRpc(users.list)) as Array<{
      id: string
      deviceCount: number
      role: string
    }>
    expect(rows.map((r) => r.id).sort()).toEqual(['admin-1', 'member-1'])
    expect(rows.every((r) => r.deviceCount === 0)).toBe(true)
  })

  it('is refused for non-admins', async () => {
    signIn({ id: 'member-1', email: 'member@example.com', role: 'member' })
    await expect(callRpc(users.list)).rejects.toThrow(/Administratorrechte/)
  })
})

describe('update', () => {
  it('renames a user and promotes them', async () => {
    await callRpc(users.update, {
      id: 'member-1',
      name: 'Renamed',
      role: 'admin',
    })
    const member = await row('member-1')
    expect(member.name).toBe('Renamed')
    expect(member.role).toBe('admin')
  })

  it('refuses self-demotion', async () => {
    await expect(
      callRpc(users.update, { id: 'admin-1', name: 'Admin', role: 'member' }),
    ).rejects.toThrow(/nicht selbst die Administratorrechte/)
  })

  it('demotes another admin while one remains', async () => {
    await createUser(db, { id: 'admin-2', email: 'a2@example.com' })
    asAdmin()
    await expect(
      callRpc(users.update, { id: 'admin-2', name: 'Two', role: 'member' }),
    ).resolves.toEqual({ ok: true })
    expect((await row('admin-2')).role).toBe('member')
  })

  it('refuses demoting the last remaining admin', async () => {
    // member-1 is promoted to caller but stays a member row; admin-1 is the
    // only admin left, so demoting it must be refused.
    signIn({ id: 'member-1', email: 'member@example.com', role: 'admin' })
    await expect(
      callRpc(users.update, { id: 'admin-1', name: 'Admin', role: 'member' }),
    ).rejects.toThrow(/letzte Administrator/)
  })

  it('rejects an unknown user', async () => {
    await expect(
      callRpc(users.update, { id: 'ghost', name: 'X', role: 'member' }),
    ).rejects.toThrow(/nicht gefunden/)
  })
})

describe('ban / unban', () => {
  it('bans a user and revokes their sessions', async () => {
    await db.insert(sessionTable).values({
      id: 's1',
      token: 't1',
      userId: 'member-1',
      expiresAt: new Date(Date.now() + 3_600_000),
    })
    await callRpc(users.ban, { id: 'member-1', reason: 'spam' })

    const member = await row('member-1')
    expect(member.banned).toBe(true)
    expect(member.banReason).toBe('spam')
    expect(await db.select().from(sessionTable)).toHaveLength(0)
  })

  it('stores no reason when none is given', async () => {
    await callRpc(users.ban, { id: 'member-1' })
    expect((await row('member-1')).banReason).toBeNull()
  })

  it('refuses self-ban and unknown users', async () => {
    await expect(callRpc(users.ban, { id: 'admin-1' })).rejects.toThrow(
      /nicht selbst sperren/,
    )
    await expect(callRpc(users.ban, { id: 'ghost' })).rejects.toThrow(
      /nicht gefunden/,
    )
  })

  it('lifts a ban', async () => {
    await callRpc(users.ban, { id: 'member-1', reason: 'spam' })
    await callRpc(users.unban, { id: 'member-1' })
    const member = await row('member-1')
    expect(member.banned).toBe(false)
    expect(member.banReason).toBeNull()
    expect(member.bannedAt).toBeNull()
  })

  it('rejects unbanning an unknown user', async () => {
    await expect(callRpc(users.unban, { id: 'ghost' })).rejects.toThrow(
      /nicht gefunden/,
    )
  })
})

describe('remove', () => {
  it('deletes a user', async () => {
    await callRpc(users.remove, { id: 'member-1' })
    expect(await db.select().from(userTable)).toHaveLength(1)
  })

  it('refuses self-deletion and unknown users', async () => {
    await expect(callRpc(users.remove, { id: 'admin-1' })).rejects.toThrow(
      /eigenes Konto/,
    )
    await expect(callRpc(users.remove, { id: 'ghost' })).rejects.toThrow(
      /nicht gefunden/,
    )
  })

  it('refuses deleting the only remaining admin', async () => {
    signIn({ id: 'member-1', email: 'member@example.com', role: 'admin' })
    await expect(callRpc(users.remove, { id: 'admin-1' })).rejects.toThrow(
      /letzte Administrator/,
    )
  })
})

describe('audit trail', () => {
  it('records a role change, a ban, an unban and a deletion', async () => {
    await callRpc(users.update, {
      id: 'member-1',
      name: 'Member',
      role: 'admin',
    })
    const [roleEntry] = await auditEntries(db)
    expect(roleEntry).toMatchObject({
      action: 'user_role_changed',
      targetType: 'user',
      targetId: 'member-1',
      targetLabel: 'member@example.com',
    })
    expect(roleEntry.metadata).toEqual({
      fields: ['role'],
      from: 'member',
      to: 'admin',
    })

    await callRpc(users.ban, { id: 'member-1', reason: 'spam' })
    await callRpc(users.unban, { id: 'member-1' })
    await callRpc(users.remove, { id: 'member-1' })
    expect(await auditActions(db)).toEqual([
      'user_role_changed',
      'user_banned',
      'user_unbanned',
      'user_deleted',
    ])
  })

  it('records a rename that left the role alone as no role change', async () => {
    await callRpc(users.update, {
      id: 'member-1',
      name: 'Renamed',
      role: 'member',
    })
    expect(await auditActions(db)).toEqual([])
  })

  it('records nothing for a rejected call', async () => {
    await expect(callRpc(users.remove, { id: 'admin-1' })).rejects.toThrow(
      /eigenes Konto/,
    )
    signIn({ id: 'member-1', email: 'member@example.com', role: 'member' })
    await expect(callRpc(users.ban, { id: 'admin-1' })).rejects.toThrow(
      /Administratorrechte/,
    )
    expect(await auditActions(db)).toEqual([])
  })
})
