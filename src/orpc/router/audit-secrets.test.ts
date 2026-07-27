/**
 * One test for the rule that outranks every other audit requirement: a secret
 * never reaches the audit log. It drives the audited mutations with sentinel
 * secrets and then searches the SERIALIZED rows — every column, metadata and
 * target label included — so a new action can not quietly leak a value.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import * as devices from './devices'
import * as enrollments from './enrollments'
import * as invites from './invites'
import { createTestDb, type TestDb } from '#/test/db'
import { createUser } from '#/test/factories'
import { rpc } from '#/test/rpc'
import { auditEntries } from '#/test/audit'

let db: TestDb
let callRpc: ReturnType<typeof rpc>

const DEVICE_PASSWORD = 'SENTINEL-device-pw'
const IMPORT_PASSWORD = 'SENTINEL-import-pw'

beforeEach(async () => {
  db = await createTestDb()
  callRpc = rpc(db)
  await createUser(db, { id: 'admin-1', email: 'admin@example.com' })
})

afterEach(async () => {
  await db.$close()
})

const deviceInput = {
  rustdeskId: '123456789',
  alias: 'Reception PC',
  customer: 'Acme',
  osKey: 'win11',
  tags: ['office'],
  status: 'online' as const,
  notes: 'front desk',
  password: DEVICE_PASSWORD,
}

describe('secrets in the audit log', () => {
  it('records no cleartext password, token value or encryption key', async () => {
    const created = (await callRpc(devices.create, deviceInput)) as {
      id: string
    }
    await callRpc(devices.update, {
      id: created.id,
      data: { ...deviceInput, password: `${DEVICE_PASSWORD}-rotated` },
    })
    await callRpc(devices.revealPassword, { id: created.id })
    await callRpc(devices.connect, { id: created.id })
    await callRpc(devices.importDevices, {
      devices: [
        { rustdeskId: '222222222', alias: 'Two', password: IMPORT_PASSWORD },
      ],
    })
    await callRpc(devices.exportDevices, {})
    await callRpc(devices.remove, { id: created.id })

    const invite = (await callRpc(invites.create, {
      email: 'invited@example.com',
      role: 'member',
    })) as { token: string }

    const enrollment = (await callRpc(enrollments.create, {
      name: 'Fleet rollout',
      kind: 'permanent',
      installIfMissing: true,
      customer: 'Acme',
      tags: [],
      rustdeskConfig: '',
      baseUrl: 'https://book.example.com',
    })) as { id: string; token: string }
    await callRpc(enrollments.revoke, { id: enrollment.id })

    const entries = await auditEntries(db)
    expect(entries.length).toBeGreaterThan(0)
    const serialized = JSON.stringify(entries)
    for (const secret of [
      DEVICE_PASSWORD,
      `${DEVICE_PASSWORD}-rotated`,
      IMPORT_PASSWORD,
      invite.token,
      enrollment.token,
      process.env.APP_ENCRYPTION_KEY as string,
    ]) {
      expect(secret).toBeTruthy()
      expect(serialized).not.toContain(secret)
    }
  })

  it('names only the prefix of an enrollment token', async () => {
    const enrollment = (await callRpc(enrollments.create, {
      name: 'Fleet rollout',
      kind: 'permanent',
      installIfMissing: true,
      customer: '',
      tags: [],
      rustdeskConfig: '',
      baseUrl: 'https://book.example.com',
    })) as { token: string }
    const [entry] = await auditEntries(db)
    const metadata = entry.metadata as { tokenPrefix: string }
    expect(metadata.tokenPrefix).toBe(`${enrollment.token.slice(0, 12)}…`)
    expect(metadata.tokenPrefix.length).toBeLessThan(enrollment.token.length)
  })

  it('names the changed fields of an update rather than their values', async () => {
    const created = (await callRpc(devices.create, deviceInput)) as {
      id: string
    }
    await callRpc(devices.update, {
      id: created.id,
      data: { ...deviceInput, notes: 'moved to the back office', password: '' },
    })
    const entries = await auditEntries(db)
    const update = entries.find((e) => e.action === 'device_updated')
    expect(update?.metadata).toEqual({ fields: ['notes'] })
    expect(JSON.stringify(update)).not.toContain('back office')
  })
})
