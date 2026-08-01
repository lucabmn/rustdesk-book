/**
 * Sending the offline queue once the connection is back.
 *
 * The engine is a plain function over the queue and a `create` callback, so
 * every way a transfer can end is a test rather than something to find out in
 * a browser at an airport. Two rules run through all of it:
 *
 *  - entries go in the order they were created. A user who added three
 *    devices gets them back in that order, and an entry never overtakes one
 *    the server has not seen yet.
 *  - nothing is dropped for any reason other than having arrived. Failure
 *    changes an entry's state; it never shortens the queue.
 */
import {
  markEntry,
  type QueueEntry,
  removeEntry,
  sendableEntries,
  toCreateInput,
} from '#/lib/offline-queue'
import type { DeviceInput } from '#/orpc/schema'

/**
 * `unauthorized` — the session is gone; nothing else will work either.
 * `conflict`     — the RustDesk id is taken; only the user can settle it.
 * `unreachable`  — no answer, or the server is unwell. Worth another try.
 * `rejected`     — the server understood and refused. Another try will not
 *                  help; the entry needs the user.
 */
export type SyncFailure =
  | 'unauthorized'
  | 'conflict'
  | 'unreachable'
  | 'rejected'

interface ErrorLike {
  status?: number
  code?: string
  message?: string
  data?: { existing?: { id?: string } }
}

function asErrorLike(error: unknown): ErrorLike {
  return typeof error === 'object' && error !== null ? (error as ErrorLike) : {}
}

/**
 * What kind of failure this was. Written against the shape of an oRPC error
 * rather than its class: a request that never reached a server rejects with a
 * `TypeError` from fetch, and that case has to be read too.
 */
export function classifySyncError(error: unknown): SyncFailure {
  const { status, code } = asErrorLike(error)
  if (status === 401 || code === 'UNAUTHORIZED') return 'unauthorized'
  if (status === 409 || code === 'CONFLICT') return 'conflict'
  // No status at all: the request never got an answer.
  if (typeof status !== 'number') return 'unreachable'
  return status >= 500 ? 'unreachable' : 'rejected'
}

export interface SyncOutcome {
  /** The queue as it stands afterwards — the value to store. */
  queue: QueueEntry[]
  /** Entries the server now has. Their devices are in the address book. */
  transferred: string[]
  /** Entries that hit a RustDesk id already in use. */
  conflicts: string[]
  /** Entries the server refused. Retryable by hand, discardable. */
  failed: string[]
  /**
   * Why the run ended before the queue did. Both reasons are about the
   * connection or the session rather than about any single entry, so the rest
   * of the queue is left untouched and pending.
   */
  stoppedBy?: 'unauthorized' | 'unreachable'
}

/** Sends one queued device. Rejects the way the oRPC client rejects. */
export type CreateDevice = (input: DeviceInput) => Promise<unknown>

/**
 * Send everything sendable, oldest first, and report what happened.
 *
 * The caller gets one summary rather than a running commentary — three
 * devices transferred is one sentence, not three toasts — and the queue to
 * write back.
 */
export async function syncQueue(
  queue: QueueEntry[],
  create: CreateDevice,
): Promise<SyncOutcome> {
  const outcome: SyncOutcome = {
    queue,
    transferred: [],
    conflicts: [],
    failed: [],
  }

  for (const entry of sendableEntries(queue)) {
    try {
      await create(toCreateInput(entry))
      outcome.queue = removeEntry(outcome.queue, entry.id)
      outcome.transferred.push(entry.id)
    } catch (error) {
      const failure = classifySyncError(error)
      const { message, data } = asErrorLike(error)

      if (failure === 'unauthorized') {
        // Untouched: the entry did nothing wrong, and the user is about to be
        // asked to sign in again. Marking it failed would make a login look
        // like data loss.
        outcome.stoppedBy = 'unauthorized'
        return outcome
      }

      if (failure === 'unreachable') {
        outcome.stoppedBy = 'unreachable'
        return outcome
      }

      // Only a conflict that names the device it collided with can be offered
      // as a choice — adopting means writing to that row. Without an id there
      // is nothing to adopt, so the entry is stuck rather than decidable, and
      // it says so instead of showing a button that does nothing.
      if (failure === 'conflict' && data?.existing?.id) {
        outcome.queue = markEntry(outcome.queue, entry.id, {
          state: 'conflict',
          conflictId: data.existing.id,
          error: message,
        })
        outcome.conflicts.push(entry.id)
        continue
      }

      outcome.queue = markEntry(outcome.queue, entry.id, {
        state: 'failed',
        error: message,
      })
      outcome.failed.push(entry.id)
    }
  }

  return outcome
}
