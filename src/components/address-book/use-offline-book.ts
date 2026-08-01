import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  type DeviceCache,
  readDeviceCache,
  snapshotDevices,
} from '#/lib/offline-cache'
import {
  appendEntry,
  markEntry,
  newQueueEntry,
  pendingCount as countPending,
  type QueueEntry,
  readQueue,
  removeEntry,
  sendableEntries,
} from '#/lib/offline-queue'
import {
  createOfflineStore,
  OFFLINE_KEYS,
  type OfflineStore,
} from '#/lib/offline-store'
import { type SyncOutcome, syncQueue } from '#/lib/offline-sync'
import { client } from '#/orpc/client'
import type { Device, DeviceInput } from '#/orpc/schema'

/**
 * The offline half of the address book: what was last read from the server,
 * what the user has added since, and getting the second into the first.
 *
 * Every decision it makes lives in `lib/offline-*` and is tested there. What is
 * left here is React: when to read storage, when to write it, and when a
 * connection coming back should start a transfer.
 */

/** Whether the browser thinks it can reach the network. */
function useOnline(): boolean {
  // Optimistic until the browser says otherwise: this renders on the server
  // too, and starting "offline" would flash the notice on every page load.
  const [online, setOnline] = useState(true)

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  return online
}

export interface UseOfflineBookOptions {
  /**
   * The signed-in user, when there is one. A snapshot written by somebody else
   * is refused rather than shown; the offline view passes nothing, because it
   * runs without a session and the data belongs to this browser profile.
   */
  userId?: string
  /** Reports the result of a transfer so the caller can say it once. */
  onSynced?: (outcome: SyncOutcome) => void
}

export function useOfflineBook({ userId, onSynced }: UseOfflineBookOptions) {
  const online = useOnline()
  const store: OfflineStore = useMemo(() => createOfflineStore(), [])

  const [ready, setReady] = useState(false)
  const [snapshot, setSnapshot] = useState<DeviceCache | null>(null)
  const [queue, setQueue] = useState<QueueEntry[]>([])

  // The latest callback without making every effect depend on its identity.
  const onSyncedRef = useRef(onSynced)
  onSyncedRef.current = onSynced
  // The queue as the sync loop should see it, which is not what a closure
  // captured when the effect was set up.
  const queueRef = useRef(queue)
  queueRef.current = queue
  const syncing = useRef(false)

  const writeQueue = useCallback(
    (next: QueueEntry[]) => {
      queueRef.current = next
      setQueue(next)
      void store.write(OFFLINE_KEYS.queue, next)
    },
    [store],
  )

  // Read both records once. Until this has run there is nothing to show and,
  // more importantly, nothing to write — an empty queue written over a full
  // one before it was read would be exactly the data loss to avoid.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [devices, stored] = await Promise.all([
        store.read(OFFLINE_KEYS.devices),
        store.read(OFFLINE_KEYS.queue),
      ])
      if (cancelled) return
      const cache = readDeviceCache(devices, userId)
      setSnapshot(cache)
      const entries = readQueue(stored)
      queueRef.current = entries
      setQueue(entries)
      setReady(true)
      // A snapshot belonging to somebody else is not just hidden: it is
      // dropped, so it cannot be found by anything looking later.
      if (devices !== undefined && cache === null) {
        void store.write(OFFLINE_KEYS.devices, null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [store, userId])

  /** Store the address book as the server just returned it. */
  const remember = useCallback(
    (devices: Device[]) => {
      if (!userId) return
      const next = snapshotDevices(userId, devices, Date.now())
      setSnapshot(next)
      void store.write(OFFLINE_KEYS.devices, next)
    },
    [store, userId],
  )

  /** Take a device the user just filled in. Returns the id it will have. */
  const enqueue = useCallback(
    (input: DeviceInput): string => {
      const id = crypto.randomUUID()
      writeQueue(
        appendEntry(
          queueRef.current,
          newQueueEntry(id, input, new Date().toISOString()),
        ),
      )
      return id
    },
    [writeQueue],
  )

  const sync = useCallback(async (): Promise<SyncOutcome | null> => {
    // One transfer at a time: the reconnect effect and a manual retry can
    // easily land together, and sending an entry twice is safe but pointless.
    if (syncing.current) return null
    if (sendableEntries(queueRef.current).length === 0) return null
    syncing.current = true
    try {
      const outcome = await syncQueue(queueRef.current, (device) =>
        client.devices.create(device),
      )
      writeQueue(outcome.queue)
      onSyncedRef.current?.(outcome)
      return outcome
    } finally {
      syncing.current = false
    }
  }, [writeQueue])

  // The connection coming back is the whole trigger — no button to press, and
  // no step for the user to forget.
  useEffect(() => {
    if (!ready || !online) return
    void sync()
  }, [ready, online, sync])

  /**
   * Merge a queued entry into the device it collided with.
   *
   * The existing status is read and written back unchanged: it comes from the
   * RustDesk sync, and the value captured offline is exactly the kind of stale
   * truth this feature refuses to present as current.
   */
  const adopt = useCallback(
    async (entryId: string) => {
      const entry = queueRef.current.find((e) => e.id === entryId)
      if (!entry?.conflictId) return
      const existing = await client.devices.get({ id: entry.conflictId })
      await client.devices.update({
        id: entry.conflictId,
        data: {
          rustdeskId: entry.input.rustdeskId,
          alias: entry.input.alias,
          customer: entry.input.customer ?? '',
          osKey: entry.input.osKey,
          tags: entry.input.tags ?? [],
          notes: entry.input.notes ?? '',
          status: existing.status,
          // Empty means "leave the stored secret alone" — an offline entry
          // never carried one.
          password: '',
        },
      })
      writeQueue(removeEntry(queueRef.current, entryId))
    },
    [writeQueue],
  )

  /** Drop an entry on the user's say-so. The only way one leaves unsent. */
  const discard = useCallback(
    (entryId: string) => writeQueue(removeEntry(queueRef.current, entryId)),
    [writeQueue],
  )

  /** Put a stuck entry back in line and try again straight away. */
  const retry = useCallback(
    async (entryId: string) => {
      writeQueue(
        markEntry(queueRef.current, entryId, {
          state: 'pending',
          error: undefined,
          conflictId: undefined,
        }),
      )
      await sync()
    },
    [sync, writeQueue],
  )

  /** Sign-out: the snapshot and the queue leave this device with the session. */
  const wipe = useCallback(async () => {
    setSnapshot(null)
    queueRef.current = []
    setQueue([])
    await store.clear()
  }, [store])

  return {
    ready,
    online,
    snapshot,
    queue,
    pendingCount: countPending(queue),
    remember,
    enqueue,
    sync,
    adopt,
    discard,
    retry,
    wipe,
  }
}

export type OfflineBook = ReturnType<typeof useOfflineBook>
