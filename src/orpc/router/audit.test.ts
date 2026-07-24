import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { auditLog, devices } from '#/db/schema'
import * as audit from './audit'
import { createTestDb, type TestDb } from '#/test/db'
import { createUser } from '#/test/factories'
import { rpc } from '#/test/rpc'
import { signIn } from '#/test/session'

let db: TestDb
let callRpc: ReturnType<typeof rpc>
let deviceId: string

beforeEach(async () => {
  db = await createTestDb()
  callRpc = rpc(db)
  await createUser(db, { id: 'admin-1', email: 'admin@example.com' })
  const [device] = await db
    .insert(devices)
    .values({ rustdeskId: '123456789', alias: 'PC' })
    .returning({ id: devices.id })
  deviceId = device.id
  await db.insert(auditLog).values([
    { action: 'connect', deviceId, userId: 'admin-1' },
    { action: 'reveal_password', deviceId, userId: 'admin-1' },
  ])
})

afterEach(async () => {
  await db.$close()
})

describe('list', () => {
  it('joins device and user details onto every entry', async () => {
    const rows = (await callRpc(audit.list)) as Array<{
      action: string
      deviceAlias: string | null
      userEmail: string | null
      createdAt: string
    }>
    expect(rows).toHaveLength(2)
    expect(rows[0].deviceAlias).toBe('PC')
    expect(rows[0].userEmail).toBe('admin@example.com')
    expect(() => new Date(rows[0].createdAt).toISOString()).not.toThrow()
  })

  it('keeps entries after their device is deleted', async () => {
    await db.delete(devices)
    const rows = (await callRpc(audit.list)) as Array<{
      deviceAlias: string | null
    }>
    expect(rows).toHaveLength(2)
    expect(rows[0].deviceAlias).toBeNull()
  })

  it('is admin-only', async () => {
    signIn({ role: 'member' })
    await expect(callRpc(audit.list)).rejects.toThrow(/Administratorrechte/)
  })
})

describe('listForDevice', () => {
  it('returns the history of a single device to any signed-in user', async () => {
    signIn({ id: 'admin-1', email: 'admin@example.com', role: 'member' })
    const rows = (await callRpc(audit.listForDevice, { deviceId })) as Array<{
      action: string
    }>
    expect(rows).toHaveLength(2)
  })

  it('returns nothing for an unrelated device', async () => {
    const [other] = await db
      .insert(devices)
      .values({ rustdeskId: '222222222', alias: 'Other' })
      .returning({ id: devices.id })
    expect(await callRpc(audit.listForDevice, { deviceId: other.id })).toEqual(
      [],
    )
  })
})
