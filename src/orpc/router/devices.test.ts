import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { auditLog, devices as devicesTable } from '#/db/schema'
import * as devices from './devices'
import { createTestDb, type TestDb } from '#/test/db'
import { createUser } from '#/test/factories'
import { rpc } from '#/test/rpc'
import { signOut } from '#/test/session'
import { auditActions, auditEntries } from '#/test/audit'

let db: TestDb
let callRpc: ReturnType<typeof rpc>

const input = {
  rustdeskId: '123456789',
  alias: 'Reception PC',
  customer: 'Acme',
  osKey: 'win11',
  tags: ['office'],
  status: 'online' as 'online' | 'away' | 'offline',
  notes: 'front desk',
  password: 's3cret',
}

beforeEach(async () => {
  db = await createTestDb()
  callRpc = rpc(db)
  await createUser(db)
})

afterEach(async () => {
  await db.$close()
})

async function createDevice(overrides: Partial<typeof input> = {}) {
  return (await callRpc(devices.create, { ...input, ...overrides })) as {
    id: string
    customer: string | null
    hasPassword: boolean
  }
}

describe('create', () => {
  it('stores the password as ciphertext only', async () => {
    const created = await createDevice()
    expect(created.hasPassword).toBe(true)
    expect(created).not.toHaveProperty('password')
    const [row] = await db.select().from(devicesTable)
    expect(row.passwordCipher).toBeTruthy()
    expect(row.passwordCipher).not.toContain('s3cret')
  })

  it('creates the customer on first use and reuses it afterwards', async () => {
    const first = await createDevice()
    const second = await createDevice({ rustdeskId: '987654321' })
    expect(first.customer).toBe('Acme')
    const rows = await db.select().from(devicesTable)
    expect(rows[0].customerId).toBe(rows[1].customerId)
    expect(second.customer).toBe('Acme')
  })

  it('leaves the customer unassigned for blank names', async () => {
    await createDevice({ customer: '   ' })
    const [row] = await db.select().from(devicesTable)
    expect(row.customerId).toBeNull()
  })

  it('rejects a malformed RustDesk id', async () => {
    await expect(createDevice({ rustdeskId: 'abc' })).rejects.toThrow()
  })

  it('rejects unauthenticated callers', async () => {
    signOut()
    await expect(createDevice()).rejects.toThrow(/Authentication required/)
  })

  it('rejects banned users', async () => {
    await createUser(db, { id: 'banned-1', email: 'b@x.de', banned: true })
    await expect(createDevice()).rejects.toThrow(/gesperrt/)
  })
})

describe('update', () => {
  it('keeps the stored secret when the password field is empty', async () => {
    const created = await createDevice()
    const [before] = await db.select().from(devicesTable)
    await callRpc(devices.update, {
      id: created.id,
      data: { ...input, password: '' },
    })
    const [after] = await db.select().from(devicesTable)
    expect(after.passwordCipher).toBe(before.passwordCipher)
  })

  it('replaces the secret when a new password is supplied', async () => {
    const created = await createDevice()
    const [before] = await db.select().from(devicesTable)
    await callRpc(devices.update, {
      id: created.id,
      data: { ...input, password: 'other' },
    })
    const [after] = await db.select().from(devicesTable)
    expect(after.passwordCipher).not.toBe(before.passwordCipher)
  })

  it('fails for an unknown device', async () => {
    await expect(
      callRpc(devices.update, {
        id: '00000000-0000-0000-0000-000000000000',
        data: input,
      }),
    ).rejects.toThrow(/nicht gefunden/)
  })
})

describe('list', () => {
  it('filters by status, customer, tag, os and free text', async () => {
    await createDevice()
    await createDevice({
      rustdeskId: '222222222',
      alias: 'Warehouse',
      customer: 'Globex',
      status: 'offline',
      tags: ['depot'],
      osKey: 'ubuntu',
    })

    expect(await callRpc(devices.list, {})).toHaveLength(2)
    expect(await callRpc(devices.list, { status: 'offline' })).toHaveLength(1)
    expect(await callRpc(devices.list, { customer: 'Acme' })).toHaveLength(1)
    expect(await callRpc(devices.list, { tags: ['depot'] })).toHaveLength(1)
    expect(await callRpc(devices.list, { search: 'warehouse' })).toHaveLength(1)
    expect(await callRpc(devices.list, { osKey: 'Windows 11' })).toHaveLength(1)
    expect(await callRpc(devices.list, { search: 'nothing' })).toHaveLength(0)
  })

  it('never exposes the password ciphertext', async () => {
    await createDevice()
    const rows = (await callRpc(devices.list, {})) as Array<
      Record<string, unknown>
    >
    expect(rows[0]).not.toHaveProperty('passwordCipher')
    expect(rows[0].hasPassword).toBe(true)
  })
})

describe('favorites', () => {
  it('stars, filters and unstars idempotently', async () => {
    const created = await createDevice()
    await callRpc(devices.setFavorite, { id: created.id, favorite: true })
    await callRpc(devices.setFavorite, { id: created.id, favorite: true })

    const starred = (await callRpc(devices.list, { favorite: true })) as Array<{
      isFavorite: boolean
    }>
    expect(starred).toHaveLength(1)
    expect(starred[0].isFavorite).toBe(true)

    await callRpc(devices.setFavorite, { id: created.id, favorite: false })
    expect(await callRpc(devices.list, { favorite: true })).toHaveLength(0)
  })

  it('keeps favorites private to their owner', async () => {
    const created = await createDevice()
    await callRpc(devices.setFavorite, { id: created.id, favorite: true })
    await createUser(db, { id: 'user-2', email: 'two@example.com' })
    expect(await callRpc(devices.list, { favorite: true })).toHaveLength(0)
  })
})

describe('secret access', () => {
  it('reveals the password and writes an audit entry', async () => {
    const created = await createDevice()
    const revealed = (await callRpc(devices.revealPassword, {
      id: created.id,
    })) as { password: string }
    expect(revealed.password).toBe('s3cret')
    const [entry] = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'reveal_password'))
    expect(entry.action).toBe('reveal_password')
    expect(entry.userId).toBe('user-1')
    expect(entry.deviceId).toBe(created.id)
    expect(entry.targetType).toBe('device')
    expect(entry.targetId).toBe(created.id)
    expect(entry.targetLabel).toBe(input.alias)
    expect(entry.actorName).toBe('Test User')
    expect(entry.actorEmail).toBe('test@example.com')
  })

  it('records the request context of the revealing request', async () => {
    process.env.TRUST_PROXY_HEADERS = 'true'
    try {
      const created = await createDevice()
      const withHeaders = rpc(db, {
        'x-forwarded-for': '1.2.3.4',
        'user-agent': 'curl/8',
      })
      await withHeaders(devices.revealPassword, { id: created.id })
      const [entry] = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.action, 'reveal_password'))
      expect(entry.ipAddress).toBe('1.2.3.4')
      expect(entry.userAgent).toBe('curl/8')
    } finally {
      delete process.env.TRUST_PROXY_HEADERS
    }
  })

  it('audits a connect against the device target', async () => {
    const created = await createDevice()
    await callRpc(devices.connect, { id: created.id })
    const [entry] = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'connect'))
    expect(entry.action).toBe('connect')
    expect(entry.targetType).toBe('device')
    expect(entry.targetLabel).toBe(input.alias)
    expect(entry.metadata).toEqual({
      rustdeskId: input.rustdeskId,
      withPassword: true,
    })
  })

  it('fails when no password is stored', async () => {
    const created = await createDevice({ password: '' })
    await expect(
      callRpc(devices.revealPassword, { id: created.id }),
    ).rejects.toThrow(/kein Passwort/)
  })

  it('percent-encodes the password in the connect URI', async () => {
    const created = await createDevice({ password: 'a#b@c d' })
    const { uri } = (await callRpc(devices.connect, { id: created.id })) as {
      uri: string
    }
    expect(uri).toBe('rustdesk://123456789?password=a%23b%40c%20d')
    const [row] = await db.select().from(devicesTable)
    expect(row.lastSeen).not.toBeNull()
  })

  it('omits the query string when no password is stored', async () => {
    const created = await createDevice({ password: '' })
    const { uri } = (await callRpc(devices.connect, { id: created.id })) as {
      uri: string
    }
    expect(uri).toBe('rustdesk://123456789')
  })
})

describe('stats', () => {
  it('aggregates counts per customer, os and tag', async () => {
    await createDevice()
    await createDevice({
      rustdeskId: '222222222',
      customer: 'Globex',
      status: 'offline',
      osKey: 'win11',
      tags: ['office', 'depot'],
    })
    const result = (await callRpc(devices.stats)) as {
      total: number
      online: number
      customers: Array<{ name: string; count: number }>
      operatingSystems: Array<{ name: string; count: number }>
      tags: Array<{ name: string; count: number }>
    }
    expect(result.total).toBe(2)
    expect(result.online).toBe(1)
    expect(result.customers).toEqual([
      { name: 'Acme', count: 1 },
      { name: 'Globex', count: 1 },
    ])
    expect(result.operatingSystems).toEqual([{ name: 'Windows 11', count: 2 }])
    expect(result.tags).toEqual([
      { name: 'depot', count: 1 },
      { name: 'office', count: 2 },
    ])
  })
})

describe('remove / get / import', () => {
  it('deletes a device', async () => {
    const created = await createDevice()
    await callRpc(devices.remove, { id: created.id })
    expect(await db.select().from(devicesTable)).toHaveLength(0)
  })

  it('returns a single device by id', async () => {
    const created = await createDevice()
    const found = (await callRpc(devices.get, { id: created.id })) as {
      alias: string
      customer: string | null
    }
    expect(found.alias).toBe('Reception PC')
    expect(found.customer).toBe('Acme')
  })

  it('imports only rows carrying an id and an alias', async () => {
    const result = (await callRpc(devices.importDevices, {
      devices: [
        { rustdeskId: '111111111', alias: 'One', customer: 'Acme' },
        { rustdeskId: '222222222' },
        { alias: 'No id' },
      ],
    })) as { imported: number }
    expect(result.imported).toBe(1)
    expect(await db.select().from(devicesTable)).toHaveLength(1)
  })

  it('imports nothing without failing on an empty payload', async () => {
    const result = (await callRpc(devices.importDevices, { devices: [] })) as {
      imported: number
    }
    expect(result.imported).toBe(0)
  })
})

describe('sync', () => {
  it('reports sync as disabled when no server is configured', async () => {
    // lastSyncedAt is process-wide bookkeeping, so only `enabled` is asserted
    // here — the poller's own suite covers the timestamp.
    expect(await callRpc(devices.syncInfo)).toMatchObject({ enabled: false })
    expect(await callRpc(devices.syncNow)).toEqual({
      enabled: false,
      updated: 0,
    })
  })
})

describe('audit trail', () => {
  const actionsSince = async (before: number) =>
    (await auditActions(db)).slice(before)

  it('records exactly one entry per device lifecycle step', async () => {
    const created = await createDevice()
    expect(await auditActions(db)).toEqual(['device_created'])

    await callRpc(devices.update, {
      id: created.id,
      data: { ...input, alias: 'Renamed', password: '' },
    })
    expect(await actionsSince(1)).toEqual(['device_updated'])

    const [entry] = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'device_updated'))
    expect(entry.metadata).toEqual({ fields: ['alias'] })
    expect(entry.targetLabel).toBe('Renamed')

    await callRpc(devices.remove, { id: created.id })
    expect(await actionsSince(2)).toEqual(['device_deleted'])
  })

  it('records an update that changed nothing as no entry at all', async () => {
    const created = await createDevice()
    await callRpc(devices.update, {
      id: created.id,
      data: { ...input, password: '' },
    })
    expect(await auditActions(db)).toEqual(['device_created'])
  })

  it('separates a reassignment and a password change from the update', async () => {
    const created = await createDevice()
    await callRpc(devices.update, {
      id: created.id,
      data: { ...input, customer: 'Other Corp', password: 'new-secret' },
    })
    expect(await auditActions(db)).toEqual([
      'device_created',
      'device_updated',
      'device_reassigned',
      'device_password_changed',
    ])
  })

  it('keeps the deleted device readable and drops the dangling reference', async () => {
    const created = await createDevice()
    await callRpc(devices.remove, { id: created.id })
    const [entry] = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'device_deleted'))
    expect(entry.deviceId).toBeNull()
    expect(entry.targetId).toBe(created.id)
    expect(entry.targetLabel).toBe(input.alias)
  })

  it('writes no entry when the delete matched nothing', async () => {
    await callRpc(devices.remove, {
      id: '00000000-0000-0000-0000-000000000000',
    })
    expect(await auditActions(db)).toEqual([])
  })

  it('rejects an unauthenticated call without recording anything', async () => {
    signOut()
    await expect(callRpc(devices.create, input)).rejects.toThrow(
      /Authentication required/,
    )
    expect(await auditActions(db)).toEqual([])
  })

  it('records one entry for an import and one for an export', async () => {
    await callRpc(devices.importDevices, {
      devices: [{ rustdeskId: '111111111', alias: 'One' }],
    })
    await callRpc(devices.exportDevices)
    const entries = await auditEntries(db)
    expect(entries.map((e) => e.action)).toEqual(['import_data', 'export_data'])
    expect(entries[0].metadata).toEqual({ imported: 1 })
    expect(entries[1].metadata).toEqual({ exported: 1 })
  })

  it('records no import entry when nothing was imported', async () => {
    await callRpc(devices.importDevices, { devices: [{ alias: 'No id' }] })
    expect(await auditActions(db)).toEqual([])
  })
})
