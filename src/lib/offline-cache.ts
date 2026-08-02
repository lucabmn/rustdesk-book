/**
 * What of the address book may live on the user's own device, and how it is
 * allowed to be shown once it does.
 *
 * Issue #26 put the rule for the service worker's caches as an allowlist:
 * build assets and the offline document, nothing else, and never an API
 * response. Issue #37 amends it for one kind of data — device master records —
 * so the address book stays readable without a connection. The amendment is
 * narrow and it is written down here as a list of field names, not as a list
 * of exceptions:
 *
 *   allowed — id, RustDesk id, alias, customer, operating system, tags,
 *             notes, status/lastSeen (never presented as current), timestamps
 *   never   — a cleartext password, `passwordCipher`, a session token, an
 *             enrollment token
 *
 * The reason the password is on the second list and not merely "left out for
 * now": the key that protects it (`APP_ENCRYPTION_KEY`) exists on the server
 * only. A password in IndexedDB would be a second, unprotected place for the
 * one secret this application is built to keep.
 */
import type { DeviceStatus } from '#/lib/device-meta'
import type { Device } from '#/orpc/schema'

/**
 * The device fields that may be written to disk. Anything the server projection
 * gains later is dropped until somebody adds it here on purpose.
 */
export const CACHEABLE_DEVICE_FIELDS = [
  'id',
  'rustdeskId',
  'alias',
  // The name, never `customerId`: issue #37 carries customers offline as text
  // and nothing here needs the key. Leaving a foreign key out is also what
  // keeps the stored book from referring to rows it cannot check.
  'customer',
  'osKey',
  'tags',
  'status',
  'lastSeen',
  // Presence, not the secret: the list shows whether a password is stored, and
  // the value stays where the key to it is.
  'hasPassword',
  'isFavorite',
  'notes',
  'createdAt',
  'updatedAt',
] as const satisfies readonly (keyof Device)[]

export type CachedDevice = Pick<
  Device,
  (typeof CACHEABLE_DEVICE_FIELDS)[number]
>

/** A device row reduced to the fields that may be stored. */
export function cacheableDevice(device: Device): CachedDevice {
  const cached = {} as Record<string, unknown>
  for (const field of CACHEABLE_DEVICE_FIELDS) cached[field] = device[field]
  return cached as CachedDevice
}

/**
 * The address book as it was last read from the server, with the two things
 * needed to be honest about it later: whose it is, and when it was true.
 */
export interface DeviceCache {
  /** The signed-in user the snapshot was read for. */
  userId: string
  /** Epoch milliseconds of the response it was built from. */
  fetchedAt: number
  devices: CachedDevice[]
}

export function snapshotDevices(
  userId: string,
  devices: Device[],
  now: number,
): DeviceCache {
  return { userId, fetchedAt: now, devices: devices.map(cacheableDevice) }
}

/**
 * Read a stored snapshot back.
 *
 * `userId` is the user the snapshot is about to be shown to. A snapshot
 * written by somebody else is refused rather than rendered — the wipe on
 * sign-out is what should have removed it, and this is the guard for the case
 * where it did not. It is omitted where there is no session to compare
 * against: the offline view runs without one, and the data there belongs to
 * whoever last used this browser profile.
 */
export function readDeviceCache(
  value: unknown,
  userId?: string,
): DeviceCache | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Partial<DeviceCache>
  if (typeof record.userId !== 'string') return null
  if (typeof record.fetchedAt !== 'number') return null
  if (!Array.isArray(record.devices)) return null
  if (userId !== undefined && record.userId !== userId) return null
  return {
    userId: record.userId,
    fetchedAt: record.fetchedAt,
    devices: record.devices,
  }
}

/**
 * A device as a view renders it: the server's projection plus where it came
 * from. Both marks answer the same question — is what this row says about the
 * device true right now — and both are set by this module and the queue, never
 * by a component.
 */
export interface DisplayDevice extends Device {
  /** Read from the local snapshot: true when it was stored, not necessarily now. */
  stale?: boolean
  /** Created offline and still waiting to be transferred. */
  pending?: boolean
}

/** A status as it may be shown. `unknown` is the honest answer for old data. */
export type DisplayStatus = DeviceStatus | 'unknown'

/**
 * The only way a view is allowed to turn a status into something on screen.
 *
 * `status` and `lastSeen` come from the RustDesk sync and are stale the moment
 * the connection drops; a device that was online an hour ago may be anything
 * now. Rather than paint a green dot that means nothing, a row from the cache
 * — or one the server has never seen — reports that its state is unknown.
 */
export function displayStatus(device: {
  status: DeviceStatus
  stale?: boolean
  pending?: boolean
}): DisplayStatus {
  return device.stale || device.pending ? 'unknown' : device.status
}

/** Every row of a snapshot, marked as the old news it is. */
export function staleDevices(cache: DeviceCache): DisplayDevice[] {
  return cache.devices.map((device) => ({
    ...device,
    // Not stored, and not invented either: offline a customer is a name.
    customerId: null,
    stale: true,
  }))
}
