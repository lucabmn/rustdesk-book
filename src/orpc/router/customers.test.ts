import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { customers as customersTable, devices } from '#/db/schema'
import * as customers from './customers'
import { createTestDb, type TestDb } from '#/test/db'
import { createUser } from '#/test/factories'
import { rpc } from '#/test/rpc'
import { signIn } from '#/test/session'
import { auditActions, auditEntries } from '#/test/audit'

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

const create = (name: string) =>
  callRpc(customers.create, { name, contact: '', notes: '' }) as Promise<{
    id: string
  }>

describe('create', () => {
  it('stores blank contact/notes as null', async () => {
    const { id } = await create('Acme')
    const [row] = await db.select().from(customersTable)
    expect(row.id).toBe(id)
    expect(row.contact).toBeNull()
    expect(row.notes).toBeNull()
  })

  it('rejects a duplicate name', async () => {
    await create('Acme')
    await expect(create('Acme')).rejects.toThrow(/existiert bereits/)
  })

  it('is admin-only', async () => {
    signIn({ role: 'member' })
    await expect(create('Acme')).rejects.toThrow(/Administratorrechte/)
  })
})

describe('list', () => {
  it('counts the devices per customer, alphabetically', async () => {
    const { id } = await create('Acme')
    await create('Globex')
    await db.insert(devices).values({
      rustdeskId: '123456789',
      alias: 'PC',
      customerId: id,
    })

    const rows = (await callRpc(customers.list)) as Array<{
      name: string
      count: number
    }>
    expect(rows.map((r) => [r.name, r.count])).toEqual([
      ['Acme', 1],
      ['Globex', 0],
    ])
  })

  it('is readable by members', async () => {
    signIn({ role: 'member' })
    await expect(callRpc(customers.list)).resolves.toEqual([])
  })
})

describe('update', () => {
  it('renames a customer and keeps its own name free', async () => {
    const { id } = await create('Acme')
    await callRpc(customers.update, {
      id,
      name: 'Acme',
      contact: 'ops@acme.test',
      notes: 'VIP',
    })
    const [row] = await db.select().from(customersTable)
    expect(row.contact).toBe('ops@acme.test')
    expect(row.notes).toBe('VIP')
  })

  it('rejects renaming onto an existing name', async () => {
    await create('Acme')
    const { id } = await create('Globex')
    await expect(
      callRpc(customers.update, { id, name: 'Acme' }),
    ).rejects.toThrow(/existiert bereits/)
  })

  it('rejects an unknown customer', async () => {
    await expect(
      callRpc(customers.update, {
        id: '00000000-0000-0000-0000-000000000000',
        name: 'Ghost',
      }),
    ).rejects.toThrow(/nicht gefunden/)
  })
})

describe('remove', () => {
  it('unassigns devices instead of deleting them', async () => {
    const { id } = await create('Acme')
    await db.insert(devices).values({
      rustdeskId: '123456789',
      alias: 'PC',
      customerId: id,
    })
    await callRpc(customers.remove, { id })

    expect(await db.select().from(customersTable)).toHaveLength(0)
    const [device] = await db.select().from(devices)
    expect(device.customerId).toBeNull()
  })
})

describe('audit trail', () => {
  it('records create, update and delete once each', async () => {
    const { id } = await create('Acme')
    expect(await auditActions(db)).toEqual(['customer_created'])

    await callRpc(customers.update, {
      id,
      name: 'Acme GmbH',
      contact: '',
      notes: '',
    })
    const entries = await auditEntries(db)
    expect(entries.map((e) => e.action)).toEqual([
      'customer_created',
      'customer_updated',
    ])
    expect(entries[1].metadata).toEqual({ fields: ['name'] })
    expect(entries[1].targetLabel).toBe('Acme GmbH')

    await callRpc(customers.remove, { id })
    expect(await auditActions(db)).toEqual([
      'customer_created',
      'customer_updated',
      'customer_deleted',
    ])
  })

  it('records nothing when an update changed no field', async () => {
    const { id } = await create('Acme')
    await callRpc(customers.update, {
      id,
      name: 'Acme',
      contact: '',
      notes: '',
    })
    expect(await auditActions(db)).toEqual(['customer_created'])
  })

  it('records nothing for a rejected call', async () => {
    await create('Acme')
    await expect(create('Acme')).rejects.toThrow(/existiert bereits/)
    signIn({ role: 'member' })
    await expect(create('Other')).rejects.toThrow(/Administratorrechte/)
    expect(await auditActions(db)).toEqual(['customer_created'])
  })
})
