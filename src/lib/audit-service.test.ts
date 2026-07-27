import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { auditLog, devices, user } from '#/db/schema'
import { recordAuditEvent } from './audit-service'
import { createTestDb, type TestDb } from '#/test/db'
import { createUser } from '#/test/factories'

let db: TestDb
let deviceId: string

const actor = {
  id: 'admin-1',
  name: 'Admin One',
  email: 'admin@example.com',
}

beforeEach(async () => {
  db = await createTestDb()
  await createUser(db, { id: actor.id, name: actor.name, email: actor.email })
  const [device] = await db
    .insert(devices)
    .values({ rustdeskId: '123456789', alias: 'PC' })
    .returning({ id: devices.id })
  deviceId = device.id
})

afterEach(async () => {
  delete process.env.TRUST_PROXY_HEADERS
  await db.$close()
})

const deviceEvent = (headers = new Headers()) =>
  ({
    action: 'connect',
    actor,
    target: { type: 'device', id: deviceId, label: 'PC' },
    headers,
  }) as const

const onlyEntry = async () => {
  const [entry] = await db.select().from(auditLog)
  return entry
}

describe('recordAuditEvent', () => {
  it('stores the actor and target snapshots alongside the references', async () => {
    await recordAuditEvent(db as never, deviceEvent())
    const entry = await onlyEntry()
    expect(entry).toMatchObject({
      action: 'connect',
      userId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      targetType: 'device',
      targetId: deviceId,
      targetLabel: 'PC',
    })
  })

  it('keeps the actor readable after the user is deleted', async () => {
    await recordAuditEvent(db as never, deviceEvent())
    await db.delete(user)
    const entry = await onlyEntry()
    expect(entry.userId).toBeNull()
    expect(entry.actorName).toBe(actor.name)
    expect(entry.actorEmail).toBe(actor.email)
  })

  it('keeps the target label readable after the device is deleted', async () => {
    await recordAuditEvent(db as never, deviceEvent())
    await db.delete(devices)
    const entry = await onlyEntry()
    expect(entry.deviceId).toBeNull()
    expect(entry.targetId).toBe(deviceId)
    expect(entry.targetLabel).toBe('PC')
  })

  it('records the request context of the triggering request', async () => {
    process.env.TRUST_PROXY_HEADERS = 'true'
    await recordAuditEvent(
      db as never,
      deviceEvent(
        new Headers({ 'x-forwarded-for': '1.2.3.4', 'user-agent': 'curl/8' }),
      ),
    )
    const entry = await onlyEntry()
    expect(entry.ipAddress).toBe('1.2.3.4')
    expect(entry.userAgent).toBe('curl/8')
  })

  it('leaves the request context null when the headers carry none', async () => {
    await recordAuditEvent(db as never, deviceEvent())
    const entry = await onlyEntry()
    expect(entry.ipAddress).toBeNull()
    expect(entry.userAgent).toBeNull()
  })

  it('stores action-specific metadata and defaults it to null', async () => {
    await recordAuditEvent(db as never, {
      ...deviceEvent(),
      metadata: { fields: ['alias'] },
    })
    expect((await onlyEntry()).metadata).toEqual({ fields: ['alias'] })

    await db.delete(auditLog)
    await recordAuditEvent(db as never, deviceEvent())
    expect((await onlyEntry()).metadata).toBeNull()
  })

  it('fills the legacy device_id only for device targets', async () => {
    await recordAuditEvent(db as never, deviceEvent())
    expect((await onlyEntry()).deviceId).toBe(deviceId)

    await db.delete(auditLog)
    await recordAuditEvent(db as never, {
      action: 'connect',
      actor,
      target: { type: 'user', id: actor.id, label: actor.email },
      headers: new Headers(),
    })
    const entry = await onlyEntry()
    expect(entry.deviceId).toBeNull()
    expect(entry.targetType).toBe('user')
    expect(entry.targetId).toBe(actor.id)
  })
})
