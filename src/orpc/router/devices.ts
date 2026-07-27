import { ORPCError } from '@orpc/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { authed } from '#/orpc/context'
import {
  DeviceInputSchema,
  DeviceListFilterSchema,
  DeviceSchema,
} from '#/orpc/schema'
import { recordAuditEvent } from '#/lib/audit-service'
import {
  customerNameOf,
  favoriteIdsFor,
  loadDeviceRow,
  queryDevices,
  resolveCustomerId,
  toPublicDevice,
} from '#/lib/device-service'
import { groupMemberIds } from '#/lib/group-service'
import {
  isSyncEnabled,
  lastSyncedAt,
  maybeSyncStatuses,
} from '#/lib/rustdesk-sync'
import { osLabel } from '#/lib/device-meta'
import { decryptSecret, encryptSecret } from '#/lib/crypto'
import { deviceFavorites, devices } from '#/db/schema'

const IdInput = z.object({ id: z.string().uuid() })

type AuditedDevice = Awaited<ReturnType<typeof loadDeviceRow>>
type AuditingContext = {
  headers: Headers
  user: { id: string; name: string; email: string }
}

/** Actor + target snapshot for an audit event about a single device. */
function deviceAuditEvent(context: AuditingContext, row: AuditedDevice) {
  return {
    actor: {
      id: context.user.id,
      name: context.user.name,
      email: context.user.email,
    },
    target: {
      type: 'device' as const,
      id: row.id,
      label: row.alias,
    },
    headers: context.headers,
  }
}

export const list = authed
  .input(DeviceListFilterSchema.partial())
  .output(z.array(DeviceSchema))
  .handler(async ({ input, context }) => {
    // Refresh live statuses from the configured RustDesk server (no-op and
    // instant when sync is disabled or within the TTL window).
    await maybeSyncStatuses(context.db)
    const favoriteIds = await favoriteIdsFor(context.db, context.user.id)
    let rows = await queryDevices(context.db, input)
    if (input.favorite) rows = rows.filter((r) => favoriteIds.has(r.id))
    if (input.groupId) {
      const members = await groupMemberIds(
        context.db,
        context.user.id,
        input.groupId,
      )
      rows = rows.filter((r) => members.has(r.id))
    }
    return rows.map((row) => toPublicDevice(row, favoriteIds, row.customerName))
  })

export const get = authed
  .input(IdInput)
  .output(DeviceSchema)
  .handler(async ({ input, context }) => {
    const row = await loadDeviceRow(context.db, input.id)
    const favoriteIds = await favoriteIdsFor(context.db, context.user.id)
    const customerName = await customerNameOf(context.db, row.customerId)
    return toPublicDevice(row, favoriteIds, customerName)
  })

/** Star / unstar a device for the current user. Idempotent. */
export const setFavorite = authed
  .input(z.object({ id: z.string().uuid(), favorite: z.boolean() }))
  .output(z.object({ favorite: z.boolean() }))
  .handler(async ({ input, context }) => {
    if (input.favorite) {
      await context.db
        .insert(deviceFavorites)
        .values({ userId: context.user.id, deviceId: input.id })
        .onConflictDoNothing()
    } else {
      await context.db
        .delete(deviceFavorites)
        .where(
          and(
            eq(deviceFavorites.userId, context.user.id),
            eq(deviceFavorites.deviceId, input.id),
          ),
        )
    }
    return { favorite: input.favorite }
  })

/** Whether live-status sync is configured, and when it last ran. */
export const syncInfo = authed
  .output(z.object({ enabled: z.boolean(), lastSyncedAt: z.number() }))
  .handler(async () => ({
    enabled: isSyncEnabled(),
    lastSyncedAt: lastSyncedAt(),
  }))

/** Force an immediate live-status poll (bypasses the TTL). */
export const syncNow = authed
  .output(z.object({ enabled: z.boolean(), updated: z.number() }))
  .handler(async ({ context }) => {
    if (!isSyncEnabled()) return { enabled: false, updated: 0 }
    const updated = await maybeSyncStatuses(context.db, true)
    return { enabled: true, updated }
  })

/** Sidebar / filter facets, aggregated from the whole address book. */
export const stats = authed.handler(async ({ context }) => {
  const rows = await queryDevices(context.db, {})
  const customers = new Map<string, number>()
  const operatingSystems = new Map<string, number>()
  const tags = new Map<string, number>()
  let online = 0
  for (const d of rows) {
    if (d.status === 'online') online++
    const c = d.customerName?.trim()
    if (c) customers.set(c, (customers.get(c) ?? 0) + 1)
    const os = d.osKey?.trim()
    if (os) {
      const label = osLabel(os)
      operatingSystems.set(label, (operatingSystems.get(label) ?? 0) + 1)
    }
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
    operatingSystems: [...operatingSystems.entries()]
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
    const customerId = await resolveCustomerId(context.db, input.customer)
    const [row] = await context.db
      .insert(devices)
      .values({
        rustdeskId: input.rustdeskId,
        alias: input.alias,
        customerId,
        osKey: input.osKey ?? null,
        tags: input.tags,
        status: input.status,
        notes: input.notes || null,
        passwordCipher: input.password ? encryptSecret(input.password) : null,
        createdBy: context.user.id,
      })
      .returning()
    return toPublicDevice(row, undefined, input.customer?.trim() || null)
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
    const customerId = await resolveCustomerId(context.db, data.customer)

    const [row] = await context.db
      .update(devices)
      .set({
        rustdeskId: data.rustdeskId,
        alias: data.alias,
        customerId,
        osKey: data.osKey ?? null,
        tags: data.tags,
        status: data.status,
        notes: data.notes || null,
        passwordCipher,
        updatedAt: new Date(),
      })
      .where(eq(devices.id, input.id))
      .returning()
    return toPublicDevice(row, undefined, data.customer?.trim() || null)
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
    await recordAuditEvent(context.db, {
      action: 'reveal_password',
      ...deviceAuditEvent(context, row),
      metadata: { rustdeskId: row.rustdeskId },
    })
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
    await recordAuditEvent(context.db, {
      action: 'connect',
      ...deviceAuditEvent(context, row),
      metadata: {
        rustdeskId: row.rustdeskId,
        withPassword: Boolean(row.passwordCipher),
      },
    })
    return { uri }
  })

/** Import devices from JSON. Passwords are encrypted on the way in. */
export const importDevices = authed
  .input(z.object({ devices: z.array(DeviceInputSchema.partial()) }))
  .output(z.object({ imported: z.number() }))
  .handler(async ({ input, context }) => {
    const valid = input.devices.filter((d) => d.rustdeskId && d.alias)
    const rows = await Promise.all(
      valid.map(async (d) => ({
        rustdeskId: d.rustdeskId!,
        alias: d.alias!,
        customerId: await resolveCustomerId(context.db, d.customer),
        osKey: d.osKey ?? null,
        tags: d.tags ?? [],
        status: d.status ?? 'offline',
        notes: d.notes || null,
        passwordCipher: d.password ? encryptSecret(d.password) : null,
        createdBy: context.user.id,
      })),
    )
    if (rows.length) await context.db.insert(devices).values(rows)
    return { imported: rows.length }
  })
