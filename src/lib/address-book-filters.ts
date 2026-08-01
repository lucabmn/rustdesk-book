/**
 * Pure address-book view logic: turning the UI's filter state into a list
 * query, and shaping the results for the grouped view. Framework-free so it can
 * be unit-tested without React.
 */
import { OS_OPTIONS, osLabel } from '#/lib/device-meta'
import {
  type DeviceCache,
  type DisplayDevice,
  displayStatus,
  staleDevices,
} from '#/lib/offline-cache'
import { type QueueEntry, queuedDevices } from '#/lib/offline-queue'
import type { Device } from '#/orpc/schema'

/** Sentinel used by the select/combobox inputs for "no restriction". */
export const ANY = 'all'

export interface FilterState {
  search: string
  status: string
  osKey: string
  customer: string
  favorite: boolean
  groupId: string | null
  tags: string[]
}

export const EMPTY_FILTERS: FilterState = {
  search: '',
  status: ANY,
  osKey: ANY,
  customer: ANY,
  favorite: false,
  groupId: null,
  tags: [],
}

export interface DeviceListInput {
  search?: string
  status?: Device['status']
  osKey?: string
  customer?: string
  tags?: string[]
  favorite?: true
  groupId?: string
}

/** Filter state → list procedure input. Inactive filters are omitted entirely. */
export function buildListInput(filters: FilterState): DeviceListInput {
  return {
    search: filters.search.trim() || undefined,
    status:
      filters.status !== ANY ? (filters.status as Device['status']) : undefined,
    osKey: filters.osKey !== ANY ? filters.osKey : undefined,
    customer: filters.customer !== ANY ? filters.customer : undefined,
    tags: filters.tags.length ? filters.tags : undefined,
    favorite: filters.favorite || undefined,
    groupId: filters.groupId ?? undefined,
  }
}

/** Whether anything is narrowing the list — drives the "reset" affordance. */
export function hasActiveFilters(filters: FilterState): boolean {
  return (
    filters.search !== '' ||
    filters.status !== ANY ||
    filters.osKey !== ANY ||
    filters.customer !== ANY ||
    filters.favorite ||
    filters.groupId !== null ||
    filters.tags.length > 0
  )
}

/** Toggle one tag in the active set, preserving the order of the rest. */
export function toggleTag(tags: string[], name: string): string[] {
  return tags.includes(name) ? tags.filter((t) => t !== name) : [...tags, name]
}

/**
 * OS suggestions: the built-in presets merged with any custom values already
 * stored — so known systems are found and new ones can still be added.
 */
export function mergeOsOptions(stored: readonly string[] = []): string[] {
  return [...new Set([...OS_OPTIONS.map((o) => o.label), ...stored])].sort(
    (a, b) => a.localeCompare(b, 'de'),
  )
}

/**
 * The same filtering the `devices.list` procedure does, applied to a list the
 * browser already has.
 *
 * It exists for the offline view, where there is no server to ask and the
 * snapshot holds the whole address book. The rules deliberately mirror
 * `queryDevices` in `lib/device-service.ts` — status and customer by exact
 * value, operating system by its display label, free text across the same
 * fields, tags matching any — so a filter does not quietly mean two different
 * things depending on the connection.
 *
 * Two filters cannot be answered from a snapshot, and neither is guessed at:
 *
 *  - status is matched on what the row may be *shown* as, not on what it
 *    stored. A stale row reads as `unknown` everywhere else in the app, so
 *    asking for the devices that are online offline correctly finds none
 *    rather than a list of green dots from an hour ago.
 *  - group membership lives in a table the snapshot does not carry, so it is
 *    ignored here — and the sidebar hides the groups while offline, so it is
 *    not something the user can ask for in the first place.
 */
export function filterDevices<T extends Device>(
  devices: readonly T[],
  filters: FilterState,
): T[] {
  const search = filters.search.trim().toLowerCase()
  return devices.filter((device) => {
    if (filters.status !== ANY && displayStatus(device) !== filters.status)
      return false
    if (
      filters.customer !== ANY &&
      (device.customer ?? '') !== filters.customer
    )
      return false
    if (filters.osKey !== ANY && osLabel(device.osKey) !== filters.osKey)
      return false
    if (filters.favorite && !device.isFavorite) return false
    if (
      filters.tags.length &&
      !filters.tags.some((t) => device.tags.includes(t))
    )
      return false
    if (!search) return true
    const haystack = [
      device.rustdeskId,
      device.alias,
      device.customer ?? '',
      device.notes ?? '',
      device.tags.join(' '),
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(search)
  })
}

/**
 * The address book as it can be assembled without a server: what was queued
 * here, then what was stored the last time there was one.
 *
 * Queued devices come first because they are the ones the user just typed and
 * the ones they will look for. Both halves go through the same filters, so a
 * search offline covers what is on its way as well as what is already there.
 */
export function localDevices(
  snapshot: DeviceCache | null,
  queue: readonly QueueEntry[],
  filters: FilterState,
): DisplayDevice[] {
  return [
    ...filterDevices(queuedDevices(queue), filters),
    ...(snapshot ? filterDevices(staleDevices(snapshot), filters) : []),
  ]
}

/** Bucket devices by customer for the grouped view, alphabetically. */
/**
 * Identity of the "no customer" bucket. Distinct from its label because the
 * label is translated — keying anything durable (collapsed state) on the label
 * would lose track of the bucket the moment the user switches locale.
 */
export const UNASSIGNED_KEY = ''

export function groupByCustomer<T extends Device>(
  devices: readonly T[],
  unassignedLabel: string,
): Array<{ key: string; name: string; items: T[] }> {
  const map = new Map<string, T[]>()
  for (const device of devices) {
    const key = device.customer || UNASSIGNED_KEY
    const items = map.get(key) ?? []
    items.push(device)
    map.set(key, items)
  }
  return [...map.entries()]
    .map(([key, items]) => ({ key, name: key || unassignedLabel, items }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))
}

/** Two-letter avatar initials for a display name. */
export function initialsOf(name: string): string {
  return name.slice(0, 2).toUpperCase()
}
