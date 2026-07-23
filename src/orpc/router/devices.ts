import { ORPCError } from '@orpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { authed } from '#/orpc/context'
import {
  DeviceInputSchema,
  DeviceListFilterSchema,
  DeviceSchema,
} from '#/orpc/schema'
import { queryDevices, toPublicDevice } from '#/lib/device-service'
import { decryptSecret, encryptSecret } from '#/lib/crypto'
import { auditLog, devices } from '#/db/schema'
import type { AuditAction } from '#/db/schema'

const IdInput = z.object({ id: z.string().uuid() })

async function loadDeviceRow(db: typeof import('#/db').db, id: string) {
  const [row] = await db.select().from(devices).where(eq(devices.id, id)).limit(1)
  if (!row) throw new ORPCError('NOT_FOUND', { message: 'Gerät nicht gefunden.' })
  return row
}

async function audit(
  db: typeof import('#/db').db,
  action: AuditAction,
  deviceId: string,
  userId: string,
) {
  await db.insert(auditLog).values({ action, deviceId, userId })
}

export const list = authed
  .input(DeviceListFilterSchema.partial())
  .output(z.array(DeviceSchema))
  .handler(async ({ input, context }) => {
    const rows = await queryDevices(context.db, input)
    return rows.map(toPublicDevice)
  })

export const get = authed
  .input(IdInput)
  .output(DeviceSchema)
  .handler(async ({ input, context }) => {
    const row = await loadDeviceRow(context.db, input.id)
    return toPublicDevice(row)
  })

/** Sidebar / filter facets, aggregated from the whole address book. */
export const stats = authed.handler(async ({ context }) => {
  const rows = await queryDevices(context.db, {})
  const customers = new Map<string, number>()
  const tags = new Map<string, number>()
  let online = 0
  for (const d of rows) {
    if (d.status === 'online') online++
    const c = d.customer?.trim()
    if (c) customers.set(c, (customers.get(c) ?? 0) + 1)
    for (const t of d.tags ?? []) tags.set(t, (tags.get(t) ?? 0) + 1)
  }
  const sortByName = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name, 'de')
  return {
    total: rows.length,
    online,
    customers: [...customers.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort(sortByName),
    tags: [...tags.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort(sortByName),
  }
})

export const create = authed
  .input(DeviceInputSchema)
  .output(DeviceSchema)
  .handler(async ({ input, context }) => {
    const [row] = await context.db
      .insert(devices)
      .values({
        rustdeskId: input.rustdeskId,
        alias: input.alias,
        customer: input.customer || null,
        osKey: input.osKey ?? null,
        tags: input.tags,
        status: input.status,
        notes: input.notes || null,
        passwordCipher: input.password ? encryptSecret(input.password) : null,
        createdBy: context.user.id,
      })
      .returning()
    return toPublicDevice(row)
  })

export const update = authed
  .input(z.object({ id: z.string().uuid(), data: DeviceInputSchema }))
  .output(DeviceSchema)
  .handler(async ({ input, context }) => {
    const existing = await loadDeviceRow(context.db, input.id)
    const { data } = input
    // Empty password on update means "leave the stored secret unchanged".
    const passwordCipher = data.password
      ? encryptSecret(data.password)
      : existing.passwordCipher

    const [row] = await context.db
      .update(devices)
      .set({
        rustdeskId: data.rustdeskId,
        alias: data.alias,
        customer: data.customer || null,
        osKey: data.osKey ?? null,
        tags: data.tags,
        status: data.status,
        notes: data.notes || null,
        passwordCipher,
        updatedAt: new Date(),
      })
      .where(eq(devices.id, input.id))
      .returning()
    return toPublicDevice(row)
  })

export const remove = authed
  .input(IdInput)
  .handler(async ({ input, context }) => {
    await context.db.delete(devices).where(eq(devices.id, input.id))
    return { ok: true }
  })

/**
 * Return the cleartext password for a single device. Authenticated and
 * audited. This is one of only two paths where a secret leaves the server.
 */
export const revealPassword = authed
  .input(IdInput)
  .output(z.object({ password: z.string() }))
  .handler(async ({ input, context }) => {
    const row = await loadDeviceRow(context.db, input.id)
    if (!row.passwordCipher) {
      throw new ORPCError('NOT_FOUND', {
        message: 'Für dieses Gerät ist kein Passwort hinterlegt.',
      })
    }
    await audit(context.db, 'reveal_password', row.id, context.user.id)
    return { password: decryptSecret(row.passwordCipher) }
  })

/**
 * Build the RustDesk connect URI SERVER-SIDE and return it ready to launch.
 * The raw (unformatted) id is used and the password is percent-encoded so
 * special characters (#, @, !, …) never truncate the URI.
 */
export const connect = authed
  .input(IdInput)
  .output(z.object({ uri: z.string() }))
  .handler(async ({ input, context }) => {
    const row = await loadDeviceRow(context.db, input.id)
    let uri = `rustdesk://${row.rustdeskId}`
    if (row.passwordCipher) {
      const password = decryptSecret(row.passwordCipher)
      uri += `?password=${encodeURIComponent(password)}`
    }
    // An address-book-triggered connect is a manual "last seen" signal:
    // stamp lastSeen now. status is left untouched — it stays a
    // deliberately manual field.
    await context.db
      .update(devices)
      .set({ lastSeen: new Date() })
      .where(eq(devices.id, row.id))
    await audit(context.db, 'connect', row.id, context.user.id)
    return { uri }
  })

/** Import devices from JSON. Passwords are encrypted on the way in. */
export const importDevices = authed
  .input(z.object({ devices: z.array(DeviceInputSchema.partial()) }))
  .output(z.object({ imported: z.number() }))
  .handler(async ({ input, context }) => {
    const rows = input.devices
      .filter((d) => d.rustdeskId && d.alias)
      .map((d) => ({
        rustdeskId: d.rustdeskId!,
        alias: d.alias!,
        customer: d.customer || null,
        osKey: d.osKey ?? null,
        tags: d.tags ?? [],
        status: d.status ?? 'offline',
        notes: d.notes || null,
        passwordCipher: d.password ? encryptSecret(d.password) : null,
        createdBy: context.user.id,
      }))
    if (rows.length) await context.db.insert(devices).values(rows)
    return { imported: rows.length }
  })
