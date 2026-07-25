/**
 * Device read/query helpers shared by the oRPC API and the MCP server.
 * Centralising the public projection guarantees that neither surface can
 * accidentally leak the stored password ciphertext.
 */
import { and, desc, eq } from 'drizzle-orm'

import type { db as Database } from '#/db'
import {
  auditLog,
  customers,
  deviceFavorites,
  devices,
  type AuditAction,
} from '#/db/schema'
import { ORPCError } from '@orpc/server'
import type { Device, DeviceListFilterSchema } from '#/orpc/schema'
import { osLabel, type DeviceStatus } from '#/lib/device-meta'
import type { z } from 'zod'

type DeviceRow = typeof devices.$inferSelect
type DeviceFilter = z.infer<typeof DeviceListFilterSchema>

/** A device row joined with its customer's display name (null if unassigned). */
export type DeviceRowView = DeviceRow & { customerName: string | null }

/**
 * Row → safe public projection. Password ciphertext is reduced to a boolean.
 * `favoriteIds` is the set of device ids the current user has starred; when
 * omitted (e.g. the user-less MCP surface) every device reads as not favorite.
 */
export function toPublicDevice(
  row: DeviceRow,
  favoriteIds?: ReadonlySet<string>,
  customerName: string | null = null,
): Device {
  return {
    id: row.id,
    rustdeskId: row.rustdeskId,
    alias: row.alias,
    customer: customerName,
    customerId: row.customerId,
    osKey: row.osKey,
    tags: row.tags ?? [],
    status: row.status as DeviceStatus,
    lastSeen: row.lastSeen ? row.lastSeen.toISOString() : null,
    hasPassword: Boolean(row.passwordCipher),
    isFavorite: favoriteIds?.has(row.id) ?? false,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/**
 * Query devices with optional filters. Scalar filters (status/os/customer) run
 * in SQL; free-text search and tag matching are applied in memory — the
 * self-hosted address book is small and this keeps the logic obviously correct.
 */
export async function queryDevices(
  db: typeof Database,
  filter: DeviceFilter = {},
): Promise<DeviceRowView[]> {
  const conditions = []
  if (filter.status) conditions.push(eq(devices.status, filter.status))
  // Customer is filtered by its (now canonical) display name via the join.
  if (filter.customer) conditions.push(eq(customers.name, filter.customer))

  const joined = await db
    .select({ device: devices, customerName: customers.name })
    .from(devices)
    .leftJoin(customers, eq(customers.id, devices.customerId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(devices.updatedAt))

  let rows: DeviceRowView[] = joined.map((r) => ({
    ...r.device,
    customerName: r.customerName,
  }))

  // OS is matched on its display label so legacy keys ('win11') and free-text
  // values ('Windows 11') filter identically.
  if (filter.osKey) {
    const wanted = filter.osKey
    rows = rows.filter((d) => osLabel(d.osKey) === wanted)
  }

  const q = filter.search?.trim().toLowerCase()
  if (q) {
    rows = rows.filter((d) => {
      const hay = [
        d.rustdeskId,
        d.alias,
        d.customerName ?? '',
        d.notes ?? '',
        (d.tags ?? []).join(' '),
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }

  if (filter.tags?.length) {
    const wanted = filter.tags
    rows = rows.filter((d) => wanted.some((t) => (d.tags ?? []).includes(t)))
  }

  return rows
}

/**
 * Resolve a free-text customer name to a customer id, creating the customer
 * on first use. Empty/whitespace clears the assignment (null). This keeps the
 * device form's name-based combobox working while customers live in their own
 * table — one canonical row per name.
 */
export async function resolveCustomerId(
  db: typeof Database,
  name: string | null | undefined,
): Promise<string | null> {
  const trimmed = name?.trim()
  if (!trimmed) return null
  const [existing] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.name, trimmed))
    .limit(1)
  if (existing) return existing.id
  const [created] = await db
    .insert(customers)
    .values({ name: trimmed })
    .onConflictDoNothing()
    .returning({ id: customers.id })
  if (created) return created.id
  // Lost a race — the row now exists, fetch it.
  const [row] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.name, trimmed))
    .limit(1)
  return row?.id ?? null
}

/** Fetch a customer's display name by id (null id → null). */
export async function customerNameOf(
  db: typeof Database,
  id: string | null,
): Promise<string | null> {
  if (!id) return null
  const [row] = await db
    .select({ name: customers.name })
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1)
  return row?.name ?? null
}

/** Set of device ids the given user has starred. */
export async function favoriteIdsFor(
  db: typeof Database,
  userId: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ deviceId: deviceFavorites.deviceId })
    .from(deviceFavorites)
    .where(eq(deviceFavorites.userId, userId))
  return new Set(rows.map((r) => r.deviceId))
}

export async function loadDeviceRow(db: typeof Database, id: string) {
  const [row] = await db
    .select()
    .from(devices)
    .where(eq(devices.id, id))
    .limit(1)
  if (!row)
    throw new ORPCError('NOT_FOUND', { message: 'Gerät nicht gefunden.' })
  return row
}

export async function audit(
  db: typeof Database,
  action: AuditAction,
  deviceId: string,
  userId: string,
) {
  await db.insert(auditLog).values({ action, deviceId, userId })
}
