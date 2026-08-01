import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CACHE_PREFIX,
  OFFLINE_URL,
  SW_MESSAGE,
  type CacheLike,
  type CacheStorageLike,
  type RequestLike,
  type ResponseLike,
  createServiceWorkerCore,
  runtimeCacheName,
  shellCacheName,
  staleCacheNames,
} from '#/lib/sw-core'

/**
 * The worker is the one place in the app that writes responses to disk, so
 * these tests are less about behaviour than about a promise: nothing but the
 * static shell is ever stored. `storedPaths` at the end of a run is the whole
 * evidence — if a session document, an API response or a server function reply
 * ever shows up in it, the guarantee in the ticket is broken.
 */

const ORIGIN = 'https://book.example.com'
const VERSION = 'testhash'

/** Cache Storage, minus the parts the worker never uses. */
class FakeCache implements CacheLike {
  entries = new Map<string, ResponseLike>()

  async match(
    request: RequestLike | string,
  ): Promise<ResponseLike | undefined> {
    return this.entries.get(keyOf(request))
  }

  async put(request: RequestLike | string, response: ResponseLike) {
    this.entries.set(keyOf(request), response)
  }
}

class FakeCaches implements CacheStorageLike {
  caches = new Map<string, FakeCache>()

  async open(name: string): Promise<FakeCache> {
    const existing = this.caches.get(name)
    if (existing) return existing
    const created = new FakeCache()
    this.caches.set(name, created)
    return created
  }

  async keys() {
    return [...this.caches.keys()]
  }

  async delete(name: string) {
    return this.caches.delete(name)
  }

  /** Every path stored anywhere, which is what the guarantees are about. */
  storedPaths(): string[] {
    return [...this.caches.values()]
      .flatMap((cache) => [...cache.entries.keys()])
      .map((url) => new URL(url, ORIGIN).pathname)
      .sort()
  }
}

/** Cache keys are URLs; a bare path is resolved the way the browser would. */
function keyOf(request: RequestLike | string): string {
  const url = typeof request === 'string' ? request : request.url
  return new URL(url, ORIGIN).toString()
}

function response(body: string, init: { status?: number } = {}): ResponseLike {
  const status = init.status ?? 200
  const value: ResponseLike = {
    ok: status >= 200 && status < 300,
    status,
    clone: () => value,
  }
  return Object.assign(value, { body })
}

function get(path: string, init: Partial<RequestLike> = {}): RequestLike {
  return { method: 'GET', url: new URL(path, ORIGIN).toString(), ...init }
}

/** Stands in for `Response.redirect`, which needs a worker to exist. */
function redirect(path: string): ResponseLike {
  const value: ResponseLike = { ok: false, status: 302, clone: () => value }
  return Object.assign(value, { redirectedTo: path })
}

const PRECACHE = [
  '/assets/app-abc123.js',
  '/assets/app-abc123.css',
  '/icon.svg',
]

let caches: FakeCaches
let fetched: string[]
let offline: boolean

function setup(precache: string[] = PRECACHE) {
  caches = new FakeCaches()
  fetched = []
  offline = false
  const fetchMock = vi.fn(
    async (
      request: RequestLike | string,
      _init?: { credentials?: 'omit'; cache?: 'reload' },
    ) => {
      const path = new URL(keyOf(request)).pathname
      fetched.push(path)
      if (offline) throw new TypeError('Failed to fetch')
      return response(`body of ${path}`)
    },
  )
  return {
    core: createServiceWorkerCore({
      version: VERSION,
      precache,
      origin: ORIGIN,
      caches,
      fetch: fetchMock,
      redirect,
    }),
    fetchMock,
  }
}

describe('what the worker will and will not touch', () => {
  beforeEach(() => setup())

  const passthrough = [
    ['the oRPC API', get('/api/rpc/devices.list')],
    ['the auth endpoints', get('/api/auth/get-session')],
    ['the MCP endpoint', get('/mcp')],
    ['a server function', get('/_serverFn/fetchSession?payload=%7B%7D')],
    ['the enrollment claim', get('/api/enroll/claim?token=secret')],
    [
      'a write of any kind',
      { ...get('/assets/app-abc123.js'), method: 'POST' },
    ],
    ['another origin', get('https://rustdesk.example.com/api/devices')],
    ['an unknown static path', get('/uploads/export.json')],
  ] as const

  it.each(passthrough)('leaves %s to the browser', (_label, request) => {
    const { core } = setup()
    expect(core.plan(request)).toBe('passthrough')
    expect(core.handleFetch(request)).toBeNull()
  })

  it('handles navigations, so an offline start has something to show', () => {
    const { core } = setup()
    expect(core.plan(get('/', { mode: 'navigate' }))).toBe('document')
    expect(core.plan(get('/login', { mode: 'navigate' }))).toBe('document')
  })

  it('serves the hashed build assets and the precached files', () => {
    const { core } = setup()
    expect(core.plan(get('/assets/chunk-later.js'))).toBe('static')
    expect(core.plan(get('/icon.svg'))).toBe('static')
    expect(core.plan(get(OFFLINE_URL))).toBe('static')
  })

  it('ignores a request whose URL it cannot even parse', () => {
    const { core } = setup()
    expect(core.plan({ method: 'GET', url: 'not-a-url' })).toBe('passthrough')
  })
})

describe('install', () => {
  it('stores the offline document and the shell, without credentials', async () => {
    const { core, fetchMock } = setup()
    await core.install()

    expect(caches.storedPaths()).toEqual([
      '/assets/app-abc123.css',
      '/assets/app-abc123.js',
      '/icon.svg',
      OFFLINE_URL,
    ])
    for (const call of fetchMock.mock.calls) {
      expect(call[1]).toMatchObject({ credentials: 'omit' })
    }
  })

  it('keeps going when a single asset is missing', async () => {
    // A stale filename in the precache list would otherwise leave the app with
    // no worker at all until the next deploy — too steep a price for one icon.
    const store = new FakeCaches()
    const core = createServiceWorkerCore({
      version: VERSION,
      precache: ['/assets/app-abc123.js', '/assets/gone.js'],
      origin: ORIGIN,
      caches: store,
      redirect,
      fetch: async (request) => {
        const path = new URL(keyOf(request)).pathname
        return path === '/assets/gone.js'
          ? response('not found', { status: 404 })
          : response(`body of ${path}`)
      },
    })

    await core.install()

    expect(store.storedPaths()).toEqual(['/assets/app-abc123.js', OFFLINE_URL])
  })

  it('fails when the offline document itself cannot be fetched', async () => {
    const failing = createServiceWorkerCore({
      version: VERSION,
      precache: PRECACHE,
      origin: ORIGIN,
      caches: new FakeCaches(),
      redirect,
      fetch: async () => response('gateway', { status: 502 }),
    })
    await expect(failing.install()).rejects.toThrow(/502/)
  })
})

describe('activate', () => {
  it('drops the caches of every other version and nothing else', async () => {
    const { core } = setup()
    await caches.open(shellCacheName('older'))
    await caches.open(runtimeCacheName('older'))
    await caches.open(shellCacheName(VERSION))
    await caches.open('workbox-precache-someone-else')

    await core.activate()

    expect(await caches.keys()).toEqual([
      shellCacheName(VERSION),
      'workbox-precache-someone-else',
    ])
  })

  it('names the stale caches by version, not by age', () => {
    const keys = [
      shellCacheName('old'),
      runtimeCacheName(VERSION),
      shellCacheName(VERSION),
      'unrelated',
    ]
    expect(staleCacheNames(keys, VERSION)).toEqual([shellCacheName('old')])
    expect(shellCacheName(VERSION).startsWith(CACHE_PREFIX)).toBe(true)
  })
})

describe('serving a navigation', () => {
  it('goes to the network first and stores nothing of what comes back', async () => {
    const { core } = setup()
    await core.install()
    const before = caches.storedPaths()

    const served = await core.handleFetch(get('/', { mode: 'navigate' }))

    expect(served).toMatchObject({ body: 'body of /' })
    expect(caches.storedPaths()).toEqual(before)
  })

  it('sends a failed navigation to the offline address, not just the page', async () => {
    // Handing the document back under the requested address paints the right
    // page and then loses it: the app hydrates against the URL in the address
    // bar and would load the route that just failed.
    const { core } = setup()
    await core.install()
    offline = true

    const served = await core.handleFetch(get('/', { mode: 'navigate' }))

    expect(served).toMatchObject({ status: 302, redirectedTo: OFFLINE_URL })
  })

  it('serves the cached document once the redirect comes back around', async () => {
    const { core } = setup()
    await core.install()
    offline = true

    const served = await core.handleFetch(
      get(OFFLINE_URL, { mode: 'navigate' }),
    )

    expect(served).toMatchObject({ body: `body of ${OFFLINE_URL}` })
  })

  it('lets the browser show its own error if there is nothing cached', async () => {
    const { core } = setup()
    offline = true
    await expect(
      core.handleFetch(get('/', { mode: 'navigate' })),
    ).rejects.toThrow(/Failed to fetch/)
  })
})

describe('serving an asset', () => {
  it('answers from the shell without going to the network', async () => {
    const { core } = setup()
    await core.install()
    fetched.length = 0

    const served = await core.handleFetch(get('/assets/app-abc123.js'))

    expect(served).toMatchObject({ body: 'body of /assets/app-abc123.js' })
    expect(fetched).toEqual([])
  })

  it('fills the runtime cache for an asset the shell does not have', async () => {
    const { core } = setup()
    await core.install()

    await core.handleFetch(get('/assets/lazy-chunk.js'))
    fetched.length = 0
    const again = await core.handleFetch(get('/assets/lazy-chunk.js'))

    expect(again).toMatchObject({ body: 'body of /assets/lazy-chunk.js' })
    expect(fetched).toEqual([])
    const runtime = await caches.open(runtimeCacheName(VERSION))
    expect([...runtime.entries.keys()]).toEqual([
      `${ORIGIN}/assets/lazy-chunk.js`,
    ])
  })

  it('does not store anything but a plain 200', async () => {
    setup()
    const core = createServiceWorkerCore({
      version: VERSION,
      precache: [],
      origin: ORIGIN,
      caches,
      redirect,
      fetch: async () => response('redirect', { status: 304 }),
    })
    const served = await core.handleFetch(get('/assets/app-abc123.js'))

    expect(served).toMatchObject({ status: 304 })
    const runtime = await caches.open(runtimeCacheName(VERSION))
    expect(runtime.entries.size).toBe(0)
  })
})

describe('messages', () => {
  it('drops the runtime cache on sign-out but keeps the shell', async () => {
    const { core } = setup()
    await core.install()
    await core.handleFetch(get('/assets/lazy-chunk.js'))

    await core.handleMessage(SW_MESSAGE.clearRuntimeCache)

    expect(await caches.keys()).toEqual([shellCacheName(VERSION)])
    expect(caches.storedPaths()).toContain(OFFLINE_URL)
  })

  it('clears runtime caches left behind by older versions too', async () => {
    const { core } = setup()
    await caches.open(runtimeCacheName('older'))

    await core.handleMessage(SW_MESSAGE.clearRuntimeCache)

    expect(await caches.keys()).toEqual([])
  })

  it('leaves messages it does not know alone', async () => {
    const { core } = setup()
    await caches.open(runtimeCacheName(VERSION))

    // `skipWaiting` is ours too, but it needs the worker global and is
    // answered in `src/sw/entry.ts` before this ever sees it.
    await core.handleMessage(SW_MESSAGE.skipWaiting)
    await core.handleMessage(null)

    expect(await caches.keys()).toEqual([runtimeCacheName(VERSION)])
  })
})
