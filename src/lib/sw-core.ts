/**
 * Everything the service worker decides, with no worker globals in sight.
 *
 * The worker itself (`src/sw/entry.ts`) is a few lines of event wiring around
 * this module; the rules live here because they are the part that has to be
 * provable. A cache is not a place to be casual about: the app holds device
 * credentials, so the split between "may be stored" and "must never be stored"
 * is an allowlist, not a list of exceptions.
 *
 * Cacheable, and only this:
 *   - the built client assets under `/assets/` — hashed, so never stale
 *   - the static files listed in the injected precache manifest (icons, the
 *     web app manifest, the offline document)
 *
 * Everything else — the oRPC API, the MCP endpoint, server functions, every
 * SSR document that could carry a session — is passed straight to the network
 * and never touches storage. See `sw-core.test.ts`, which asserts exactly that.
 */

/** Marks the caches as ours so `activate` can clear old ones without guessing. */
export const CACHE_PREFIX = 'rustdesk-book-'

/** The document served when a navigation cannot reach the server. */
export const OFFLINE_URL = '/offline'

export const SW_MESSAGE = {
  /** Client asks the waiting worker to take over now (the update prompt). */
  skipWaiting: 'SKIP_WAITING',
  /** Client asks for everything cached outside the shell to be dropped. */
  clearRuntimeCache: 'CLEAR_RUNTIME_CACHE',
} as const

/** Precached at install, replaced wholesale on every new version. */
export function shellCacheName(version: string): string {
  return `${CACHE_PREFIX}shell-${version}`
}

/**
 * Filled as assets are requested; droppable at any time (e.g. on sign-out).
 *
 * It is not dead weight next to the shell: right after a deploy, a page still
 * running the old version asks for the new build's assets, which the shell of
 * either version does not have.
 */
export function runtimeCacheName(version: string): string {
  return `${CACHE_PREFIX}runtime-${version}`
}

/** A runtime cache of any version — what a sign-out drops. */
export function isRuntimeCacheName(key: string): boolean {
  return key.startsWith(`${CACHE_PREFIX}runtime-`)
}

/** Cache names that belong to us but not to the version now activating. */
export function staleCacheNames(keys: string[], version: string): string[] {
  const current = new Set([shellCacheName(version), runtimeCacheName(version)])
  return keys.filter((key) => key.startsWith(CACHE_PREFIX) && !current.has(key))
}

/** What the worker does with a request. `passthrough` means "hands off". */
export type RequestPlan = 'document' | 'static' | 'passthrough'

/* --- the minimum of the worker's world this module needs to know about --- */

export interface ResponseLike {
  ok: boolean
  status: number
  clone(): ResponseLike
}

export interface RequestLike {
  method: string
  url: string
  mode?: string
}

export interface CacheLike {
  match(
    request: RequestLike | string,
    options?: { ignoreVary?: boolean },
  ): Promise<ResponseLike | undefined>
  put(request: RequestLike | string, response: ResponseLike): Promise<void>
}

export interface CacheStorageLike {
  open(name: string): Promise<CacheLike>
  keys(): Promise<string[]>
  delete(name: string): Promise<boolean>
}

export interface ServiceWorkerConfig {
  /** Content hash of this build; scopes the caches and forces a clean swap. */
  version: string
  /** Paths stored at install time, injected by the build. */
  precache: string[]
  /** Origin the app is served from; anything else is somebody else's. */
  origin: string
  caches: CacheStorageLike
  fetch: (
    request: RequestLike | string,
    init?: { credentials?: 'omit'; cache?: 'reload' },
  ) => Promise<ResponseLike>
  /** Builds the redirect that sends a failed navigation to the offline view. */
  redirect: (path: string) => ResponseLike
}

export interface ServiceWorkerCore {
  install(): Promise<void>
  activate(): Promise<void>
  /** A response to answer with, or `null` to leave the request to the browser. */
  handleFetch(request: RequestLike): Promise<ResponseLike> | null
  handleMessage(data: unknown): Promise<void>
  plan(request: RequestLike): RequestPlan
}

export function createServiceWorkerCore(
  config: ServiceWorkerConfig,
): ServiceWorkerCore {
  const { version, origin, caches, fetch, redirect } = config
  const precache = [...new Set([OFFLINE_URL, ...config.precache])]
  const cacheable = new Set(precache)
  const shellName = shellCacheName(version)
  const runtimeName = runtimeCacheName(version)

  function plan(request: RequestLike): RequestPlan {
    // A cache entry is only ever a GET response, and only ever this origin's.
    if (request.method !== 'GET') return 'passthrough'
    let path: string
    try {
      const url = new URL(request.url)
      if (url.origin !== origin) return 'passthrough'
      path = url.pathname
    } catch {
      return 'passthrough'
    }
    // Navigations are served from the network and never stored — an SSR
    // document is rendered for one signed-in user.
    if (request.mode === 'navigate') return 'document'
    if (path.startsWith('/assets/')) return 'static'
    return cacheable.has(path) ? 'static' : 'passthrough'
  }

  async function install(): Promise<void> {
    const cache = await caches.open(shellName)
    // `credentials: 'omit'` so the offline document is rendered for nobody:
    // whatever lands in the cache is served to whoever opens the app next.
    const store = async (path: string) => {
      const response = await fetch(path, {
        credentials: 'omit',
        cache: 'reload',
      })
      if (!response.ok) throw new Error(`${path} responded ${response.status}`)
      await cache.put(path, response)
    }
    // The offline document is the one file the worker is useless without, so
    // a failure there fails the install. A missing asset only costs polish,
    // and failing the whole install over it would leave the app with no
    // worker at all until the next deploy.
    await store(OFFLINE_URL)
    await Promise.all(
      precache
        .filter((path) => path !== OFFLINE_URL)
        .map((path) => store(path).catch(() => undefined)),
    )
  }

  async function activate(): Promise<void> {
    const keys = await caches.keys()
    await Promise.all(
      staleCacheNames(keys, version).map((key) => caches.delete(key)),
    )
  }

  async function respondWithDocument(
    request: RequestLike,
  ): Promise<ResponseLike> {
    try {
      return await fetch(request)
    } catch (error) {
      const cache = await caches.open(shellName)
      // `ignoreVary` because the SSR response was stored under a `Vary` the
      // live request does not repeat, and a miss here means the browser's own
      // error page — the one thing this whole feature exists to avoid.
      const offline = await cache.match(OFFLINE_URL, { ignoreVary: true })
      if (!offline) throw error
      // Handing the offline document back under the address that was asked for
      // would paint the right page and then lose it: the app hydrates against
      // the URL in the address bar, so the router would load `/`, try to fetch
      // a session and replace the view with an error. Redirecting first makes
      // document and address agree, and the second navigation lands here again
      // with `/offline` — which is the branch below.
      return new URL(request.url).pathname === OFFLINE_URL
        ? offline
        : redirect(OFFLINE_URL)
    }
  }

  async function respondWithStatic(
    request: RequestLike,
  ): Promise<ResponseLike> {
    const shell = await caches.open(shellName)
    const precached = await shell.match(request, { ignoreVary: true })
    if (precached) return precached

    const runtime = await caches.open(runtimeName)
    const cached = await runtime.match(request, { ignoreVary: true })
    if (cached) return cached

    const response = await fetch(request)
    // Only a plain 200: a 206 range or an opaque response is not something to
    // hand back on a later, unrelated request.
    if (response.status === 200) await runtime.put(request, response.clone())
    return response
  }

  function handleFetch(request: RequestLike): Promise<ResponseLike> | null {
    switch (plan(request)) {
      case 'document':
        return respondWithDocument(request)
      case 'static':
        return respondWithStatic(request)
      default:
        return null
    }
  }

  async function handleMessage(data: unknown): Promise<void> {
    if (data !== SW_MESSAGE.clearRuntimeCache) return
    // The shell survives: it holds the credential-free static app, fetched
    // without cookies, and re-fetching it is exactly what a signed-out user
    // cannot do offline.
    const keys = await caches.keys()
    await Promise.all(
      keys.filter(isRuntimeCacheName).map((key) => caches.delete(key)),
    )
  }

  return { install, activate, handleFetch, handleMessage, plan }
}
