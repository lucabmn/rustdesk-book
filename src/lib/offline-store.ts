/**
 * Where the offline snapshot and the queue actually live.
 *
 * IndexedDB rather than `localStorage`: the queue is structured data that has
 * to survive a browser restart, and a synchronous store on the main thread is
 * the wrong place for a list that grows with every device added while away.
 *
 * The rest of the offline code talks to the {@link OfflineStore} port and
 * never to a browser global, so what is decided — the field allowlist, the
 * queue's lifecycle, the order things are sent in — stays testable. What is
 * left in here is the part a test could only re-implement: opening a database
 * and reading a key.
 */

const DB_NAME = 'rustdesk-book-offline'
const DB_VERSION = 1
const STORE_NAME = 'state'

/** The two records kept. Named here so a typo cannot invent a third. */
export const OFFLINE_KEYS = {
  /** The address book as last read from the server. */
  devices: 'devices',
  /** Devices created offline and not yet transferred. */
  queue: 'queue',
} as const

export interface OfflineStore {
  read(key: string): Promise<unknown>
  write(key: string, value: unknown): Promise<void>
  /** Drops everything. What a sign-out calls. */
  clear(): Promise<void>
}

/**
 * A store that keeps nothing, used where IndexedDB is not available — a
 * private window, an embedded browser, or the server during SSR.
 *
 * Offline support degrades to nothing there, which is the honest outcome: the
 * alternative is a queue that reports devices as safely stored and loses them
 * on the next navigation.
 */
export function nullStore(): OfflineStore {
  return {
    read: async () => undefined,
    write: async () => undefined,
    clear: async () => undefined,
  }
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    // A version change from another tab that this one is blocking. Nothing to
    // do but let it time out rather than hang the caller forever.
    req.onblocked = () => reject(new Error('indexedDB open blocked'))
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const db = await openDatabase()
  try {
    return await run(db.transaction(STORE_NAME, mode).objectStore(STORE_NAME))
  } finally {
    db.close()
  }
}

/**
 * The real store, or {@link nullStore} where IndexedDB is missing.
 *
 * Every operation swallows its own failure. Storage is a convenience for
 * reading and a safety net for writing; neither is a reason to break the app
 * in front of the user, and a failed read is indistinguishable from an empty
 * one to everything above.
 */
export function createOfflineStore(): OfflineStore {
  if (typeof indexedDB === 'undefined') return nullStore()

  return {
    async read(key) {
      try {
        return await withStore('readonly', (store) => request(store.get(key)))
      } catch {
        return undefined
      }
    },
    async write(key, value) {
      try {
        await withStore('readwrite', (store) => request(store.put(value, key)))
      } catch {
        /* nothing stored; the app keeps working, offline does not */
      }
    },
    async clear() {
      try {
        await withStore('readwrite', (store) => request(store.clear()))
      } catch {
        // A sign-out is never blocked by storage. What a failure here could
        // leave behind is caught by the owner stamp on the snapshot: the next
        // user to sign in on this browser is refused it (see
        // `readDeviceCache`) and gets their own from the server.
      }
    },
  }
}
