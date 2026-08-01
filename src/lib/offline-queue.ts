/**
 * The devices created while offline, from the moment the form is submitted to
 * the moment the server has them.
 *
 * Plain data and pure functions: a queue that loses an entry is the failure
 * this whole feature is judged by, so what happens to an entry is decided here
 * and provable, and the parts that cannot be — storage, the network — are
 * somebody else's job (`offline-store.ts`, `offline-sync.ts`).
 *
 * Two rules are structural rather than remembered:
 *
 *  - an entry carries no password. The form disables the field offline
 *    because the key that would protect the value lives on the server, and
 *    {@link newQueueEntry} drops one even if it is handed one.
 *  - an entry knows the id of the row it will become before it is ever sent.
 *    That is what makes a resend after a lost reply land on the row it already
 *    created instead of a second one.
 */
import type { DisplayDevice } from '#/lib/offline-cache'
import type { DeviceInput } from '#/orpc/schema'

/**
 * What is stored for a queued device: the form, minus the password, minus the
 * two fields that describe the entry itself rather than the device.
 */
export type QueuedInput = Omit<
  DeviceInput,
  'password' | 'id' | 'offlineCreatedAt'
>

/**
 * `pending` — waiting for a connection, or for its turn.
 * `conflict` — the RustDesk id already exists; the user has to decide.
 * `failed`   — the server refused it or could not be reached; retryable.
 *
 * There is no `done`: an entry that arrived is removed, and the device it
 * became is in the address book.
 */
export type QueueState = 'pending' | 'conflict' | 'failed'

export interface QueueEntry {
  /** The `devices.id` this entry will occupy. Generated in the browser. */
  id: string
  /** ISO stamp of when the user submitted the form. */
  createdAt: string
  input: QueuedInput
  state: QueueState
  /** Readable reason the entry is stuck, shown next to it. */
  error?: string
  /** The device it collides with, set when `state` is `conflict`. */
  conflictId?: string
}

/**
 * A queue entry from a submitted form. `password` is dropped rather than
 * rejected: the caller is the device form, and refusing the whole entry over a
 * field the user could not have filled in offline would lose the device.
 */
export function newQueueEntry(
  id: string,
  input: DeviceInput,
  createdAt: string,
): QueueEntry {
  const { password: _password, id: _id, offlineCreatedAt: _at, ...rest } = input
  return { id, createdAt, input: rest, state: 'pending' }
}

/** The entry as `devices.create` takes it. */
export function toCreateInput(entry: QueueEntry): DeviceInput {
  return {
    ...entry.input,
    id: entry.id,
    offlineCreatedAt: entry.createdAt,
    // Explicit, not omitted: there is no password to set, and an empty one
    // means exactly that to the procedure.
    password: '',
  }
}

/** Append, or replace an entry already queued under the same id. */
export function appendEntry(
  queue: QueueEntry[],
  entry: QueueEntry,
): QueueEntry[] {
  const without = queue.filter((e) => e.id !== entry.id)
  return [...without, entry]
}

/** Apply a state change to one entry, leaving the order untouched. */
export function markEntry(
  queue: QueueEntry[],
  id: string,
  patch: Partial<Omit<QueueEntry, 'id'>>,
): QueueEntry[] {
  return queue.map((entry) =>
    entry.id === id ? { ...entry, ...patch } : entry,
  )
}

export function removeEntry(queue: QueueEntry[], id: string): QueueEntry[] {
  return queue.filter((entry) => entry.id !== id)
}

/**
 * What a retry would send, oldest first. `failed` entries are included — a
 * server that was down is the usual reason to be in that state, and the next
 * attempt is the point.
 */
export function sendableEntries(queue: QueueEntry[]): QueueEntry[] {
  return queue.filter((entry) => entry.state !== 'conflict')
}

/** How many devices are still on their way, for the count in the app. */
export function pendingCount(queue: QueueEntry[]): number {
  return queue.filter((entry) => entry.state === 'pending').length
}

/** The entries stopped on a decision only the user can make. */
export function conflictEntries(queue: QueueEntry[]): QueueEntry[] {
  return queue.filter((entry) => entry.state === 'conflict')
}

/** The entries the user has to look at: stuck, or waiting on a decision. */
export function stuckEntries(queue: QueueEntry[]): QueueEntry[] {
  return queue.filter((entry) => entry.state !== 'pending')
}

function isQueueEntry(value: unknown): value is QueueEntry {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Partial<QueueEntry>
  return (
    typeof entry.id === 'string' &&
    typeof entry.createdAt === 'string' &&
    typeof entry.state === 'string' &&
    typeof entry.input === 'object' &&
    entry.input !== null &&
    typeof (entry.input as QueuedInput).rustdeskId === 'string' &&
    typeof (entry.input as QueuedInput).alias === 'string'
  )
}

/**
 * The queue as it is stored, with the user it belongs to.
 *
 * The owner is what the snapshot has had all along, and the queue needs it for
 * a sharper reason: the devices in it are transferred under whichever session
 * is signed in when they go out, and the audit entry names that user. Handing
 * one person's queue to the next person at this browser would put their name
 * on somebody else's work.
 *
 * It is null when the entries were written without a session — the offline
 * view has none to read — and the next signed-in user to touch the queue in
 * this browser adopts it, which is the same person who queued them.
 */
export interface QueueRecord {
  userId: string | null
  entries: QueueEntry[]
}

export function queueRecord(
  userId: string | null,
  entries: QueueEntry[],
): QueueRecord {
  return { userId, entries }
}

/** The owner of a stored queue, or null for "whoever is at this browser". */
export function queueOwner(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null
  const owner = (value as Partial<QueueRecord>).userId
  return typeof owner === 'string' ? owner : null
}

/**
 * Read a stored queue back, keeping every entry that still makes sense.
 *
 * A malformed entry is dropped instead of failing the read: losing one device
 * is bad, losing the queue because of one is worse. A queue belonging to
 * somebody else is refused whole — see {@link QueueRecord}.
 */
export function readQueue(value: unknown, userId?: string): QueueEntry[] {
  if (typeof value !== 'object' || value === null) return []
  const record = value as Partial<QueueRecord>
  if (!Array.isArray(record.entries)) return []
  const owner = queueOwner(value)
  if (userId !== undefined && owner !== null && owner !== userId) return []
  return record.entries.filter(isQueueEntry)
}

/**
 * Queue entries as rows the three views can render without knowing about any
 * of this. Marked `pending`, which is what keeps them from being drawn as
 * ordinary records — and what makes {@link displayStatus} report them as
 * unknown rather than repeat the status the form was filled in with.
 */
export function queuedDevices(queue: readonly QueueEntry[]): DisplayDevice[] {
  return queue.map((entry) => ({
    id: entry.id,
    rustdeskId: entry.input.rustdeskId,
    alias: entry.input.alias,
    customer: entry.input.customer || null,
    // Only the name travels with an offline entry: the customer may not exist
    // yet, and the server resolves it on arrival.
    customerId: null,
    osKey: entry.input.osKey ?? null,
    tags: entry.input.tags ?? [],
    status: entry.input.status ?? 'offline',
    lastSeen: null,
    hasPassword: false,
    isFavorite: false,
    notes: entry.input.notes || null,
    createdAt: entry.createdAt,
    updatedAt: entry.createdAt,
    pending: true,
  }))
}
