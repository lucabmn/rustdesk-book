/**
 * Device read/query helpers shared by the oRPC API and the MCP server.
 * Centralising the public projection guarantees that neither surface can
 * accidentally leak the stored password ciphertext.
 */
import { and, desc, eq } from 'drizzle-orm'

import type { db as Database } from '#/db'
import { customers, devices } from '#/db/schema'
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
