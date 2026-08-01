/**
 * The service worker itself: event wiring, nothing else. Every decision it
 * makes lives in `#/lib/sw-core`, which is plain code with tests around it —
 * a worker is close to untestable, so the only thing that should be in here is
 * what cannot be moved out.
 *
 * `scripts/service-worker-plugin.ts` bundles this file into the client build as
 * `/sw.js` and injects the two constants below. It is deliberately not a Vite
 * entry: the worker is served from the root of the origin, unhashed, and must
 * not exist in dev — see `#/lib/sw-client`, which only registers it in a
 * production build.
 */

import {
  SW_MESSAGE,
  type CacheStorageLike,
  createServiceWorkerCore,
} from '#/lib/sw-core'

/** Content hash of the build, injected at bundle time. */
declare const __SW_VERSION__: string
/** The shell to store at install, injected at bundle time. */
declare const __SW_PRECACHE__: string[]

interface ExtendableEventLike {
  waitUntil(promise: Promise<unknown>): void
}

interface FetchEventLike extends ExtendableEventLike {
  request: Request
  respondWith(response: Promise<Response>): void
}

interface MessageEventLike extends ExtendableEventLike {
  data: unknown
}

interface ServiceWorkerGlobalScopeLike {
  location: { origin: string }
  caches: CacheStorage
  skipWaiting(): Promise<void>
  clients: { claim(): Promise<void> }
  addEventListener(
    type: 'install' | 'activate',
    listener: (event: ExtendableEventLike) => void,
  ): void
  addEventListener(
    type: 'fetch',
    listener: (event: FetchEventLike) => void,
  ): void
  addEventListener(
    type: 'message',
    listener: (event: MessageEventLike) => void,
  ): void
}

declare const self: ServiceWorkerGlobalScopeLike

const core = createServiceWorkerCore({
  version: __SW_VERSION__,
  precache: __SW_PRECACHE__,
  origin: self.location.origin,
  // The core describes the cache API by the handful of members it uses, which
  // is what lets it run under a fake in tests. The real `CacheStorage` has all
  // of them; only its wider parameter types keep TypeScript from saying so.
  caches: self.caches as unknown as CacheStorageLike,
  fetch: (request, init) => fetch(request as RequestInfo, init),
  redirect: (path) =>
    Response.redirect(new URL(path, self.location.origin).toString(), 302),
})

self.addEventListener('install', (event) => {
  // No `skipWaiting()` here on purpose: a new worker waits until the user
  // accepts the update prompt, so a running app is never swapped out from
  // under a half-filled form.
  event.waitUntil(core.install())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(core.activate().then(() => self.clients.claim()))
})

self.addEventListener('fetch', (event) => {
  const response = core.handleFetch(event.request)
  if (response) event.respondWith(response as Promise<Response>)
})

self.addEventListener('message', (event) => {
  if (event.data === SW_MESSAGE.skipWaiting) {
    event.waitUntil(self.skipWaiting())
    return
  }
  event.waitUntil(core.handleMessage(event.data))
})
