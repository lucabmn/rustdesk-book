import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { devices } from '#/db/schema'
import * as groups from './groups'
import * as devicesRouter from './devices'
import { createTestDb, type TestDb } from '#/test/db'
import { createUser } from '#/test/factories'
import { rpc } from '#/test/rpc'
import { signIn } from '#/test/session'
import { auditActions, auditEntries } from '#/test/audit'

let db: TestDb
let callRpc: ReturnType<typeof rpc>
let deviceId: string

const asOwner = () =>
  signIn({ id: 'user-1', email: 'one@example.com', role: 'member' })
const asOther = () =>
  signIn({ id: 'user-2', email: 'two@example.com', role: 'member' })

beforeEach(async () => {
  db = await createTestDb()
  callRpc = rpc(db)
  await createUser(db, { id: 'user-1', email: 'one@example.com' })
  await createUser(db, { id: 'user-2', email: 'two@example.com' })
  asOwner()
  const [device] = await db
    .insert(devices)
    .values({ rustdeskId: '123456789', alias: 'PC' })
    .returning({ id: devices.id })
  deviceId = device.id
})

afterEach(async () => {
  await db.$close()
})

const createGroup = (name: string) =>
  callRpc(groups.create, { name }) as Promise<{ id: string; name: string }>

describe('create / list', () => {
  it('lists the caller`s own groups with member counts', async () => {
    const group = await createGroup('Field')
    await callRpc(groups.setMembership, {
      groupId: group.id,
      deviceId,
      member: true,
    })
    expect(await callRpc(groups.list)).toEqual([
      { id: group.id, name: 'Field', count: 1 },
    ])
  })

  it('rejects a duplicate name for the same user', async () => {
    await createGroup('Field')
    await expect(createGroup('Field')).rejects.toThrow(/existiert bereits/)
  })

  it('lets a different user reuse the same group name', async () => {
    await createGroup('Field')
    asOther()
    await expect(createGroup('Field')).resolves.toMatchObject({ name: 'Field' })
    expect(await callRpc(groups.list)).toHaveLength(1)
  })
})

describe('ownership', () => {
  it('hides another user`s group from rename, delete and membership', async () => {
    const group = await createGroup('Field')
    asOther()
    await expect(
      callRpc(groups.rename, { id: group.id, name: 'Stolen' }),
    ).rejects.toThrow(/nicht gefunden/)
    await expect(callRpc(groups.remove, { id: group.id })).rejects.toThrow(
      /nicht gefunden/,
    )
    await expect(
      callRpc(groups.setMembership, {
        groupId: group.id,
        deviceId,
        member: true,
      }),
    ).rejects.toThrow(/nicht gefunden/)
  })

  it('never leaks a foreign group through the device list filter', async () => {
    const group = await createGroup('Field')
    await callRpc(groups.setMembership, {
      groupId: group.id,
      deviceId,
      member: true,
    })
    asOther()
    expect(
      await callRpc(devicesRouter.list, { groupId: group.id }),
    ).toHaveLength(0)
  })

  it('reports only the caller`s groups for a device', async () => {
    const group = await createGroup('Field')
    await callRpc(groups.setMembership, {
      groupId: group.id,
      deviceId,
      member: true,
    })
    expect(await callRpc(groups.forDevice, { deviceId })).toEqual([group.id])
    asOther()
    expect(await callRpc(groups.forDevice, { deviceId })).toEqual([])
  })
})

describe('membership', () => {
  it('is idempotent in both directions', async () => {
    const group = await createGroup('Field')
    const set = (member: boolean) =>
      callRpc(groups.setMembership, { groupId: group.id, deviceId, member })

    await set(true)
    await set(true)
    expect(
      await callRpc(devicesRouter.list, { groupId: group.id }),
    ).toHaveLength(1)
    await set(false)
    await set(false)
    expect(
      await callRpc(devicesRouter.list, { groupId: group.id }),
    ).toHaveLength(0)
  })

  it('filters the device list down to the group', async () => {
    await db.insert(devices).values({ rustdeskId: '222222222', alias: 'Other' })
    const group = await createGroup('Field')
    await callRpc(groups.setMembership, {
      groupId: group.id,
      deviceId,
      member: true,
    })
    expect(await callRpc(devicesRouter.list, {})).toHaveLength(2)
    expect(
      await callRpc(devicesRouter.list, { groupId: group.id }),
    ).toHaveLength(1)
  })
})

describe('rename / remove', () => {
  it('renames a group', async () => {
    const group = await createGroup('Field')
    await callRpc(groups.rename, { id: group.id, name: 'Depot' })
    expect(await callRpc(groups.list)).toEqual([
      { id: group.id, name: 'Depot', count: 0 },
    ])
  })

  it('removes a group and its memberships', async () => {
    const group = await createGroup('Field')
    await callRpc(groups.setMembership, {
      groupId: group.id,
      deviceId,
      member: true,
    })
    await callRpc(groups.remove, { id: group.id })
    expect(await callRpc(groups.list)).toEqual([])
  })
})

describe('audit trail', () => {
  it('records a membership change once and ignores a repeat', async () => {
    const group = await createGroup('Site A')
    await callRpc(groups.setMembership, {
      groupId: group.id,
      deviceId,
      member: true,
    })
    const [entry] = await auditEntries(db)
    expect(entry).toMatchObject({
      action: 'device_group_changed',
      targetType: 'device',
      targetId: deviceId,
      targetLabel: 'PC',
    })
    expect(entry.metadata).toEqual({ group: 'Site A', member: true })

    // Idempotent repeat: nothing moved, so nothing is recorded.
    await callRpc(groups.setMembership, {
      groupId: group.id,
      deviceId,
      member: true,
    })
    expect(await auditActions(db)).toEqual(['device_group_changed'])

    await callRpc(groups.setMembership, {
      groupId: group.id,
      deviceId,
      member: false,
    })
    expect(await auditActions(db)).toEqual([
      'device_group_changed',
      'device_group_changed',
    ])
  })

  it('records nothing when the group belongs to someone else', async () => {
    const group = await createGroup('Site A')
    asOther()
    await expect(
      callRpc(groups.setMembership, {
        groupId: group.id,
        deviceId,
        member: true,
      }),
    ).rejects.toThrow(/nicht gefunden/)
    expect(await auditActions(db)).toEqual([])
  })
})
