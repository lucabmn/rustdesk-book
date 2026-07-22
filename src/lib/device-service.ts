/**
 * Device read/query helpers shared by the oRPC API and the MCP server.
 * Centralising the public projection guarantees that neither surface can
 * accidentally leak the stored password ciphertext.
 */
import { and, desc, eq } from 'drizzle-orm'

import type { db as Database } from '#/db'
import { devices } from '#/db/schema'
import type { Device, DeviceListFilterSchema } from '#/orpc/schema'
import type { DeviceStatus } from '#/lib/device-meta'
import type { z } from 'zod'

type DeviceRow = typeof devices.$inferSelect
type DeviceFilter = z.infer<typeof DeviceListFilterSchema>

/** Row → safe public projection. Password ciphertext is reduced to a boolean. */
export function toPublicDevice(row: DeviceRow): Device {
  return {
    id: row.id,
    rustdeskId: row.rustdeskId,
    alias: row.alias,
    customer: row.customer,
    osKey: row.osKey,
    tags: row.tags ?? [],
    status: row.status as DeviceStatus,
    lastSeen: row.lastSeen ? row.lastSeen.toISOString() : null,
    hasPassword: Boolean(row.passwordCipher),
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
): Promise<DeviceRow[]> {
  const conditions = []
  if (filter.status) conditions.push(eq(devices.status, filter.status))
  if (filter.osKey) conditions.push(eq(devices.osKey, filter.osKey))
  if (filter.customer) conditions.push(eq(devices.customer, filter.customer))

  let rows = await db
    .select()
    .from(devices)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(devices.updatedAt))

  const q = filter.search?.trim().toLowerCase()
  if (q) {
    rows = rows.filter((d) => {
      const hay = [
        d.rustdeskId,
        d.alias,
        d.customer ?? '',
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
