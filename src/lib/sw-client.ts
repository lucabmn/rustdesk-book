/**
 * The browser half of the service worker: registering it, noticing that a new
 * version is waiting, and clearing what was cached when a user signs out.
 *
 * Only a production build registers anything. In dev the worker does not even
 * exist (`scripts/service-worker-plugin.ts` only runs on build), and a leftover
 * registration from a local production run would happily serve a stale bundle
 * over the dev server — so dev actively tears one down instead.
 */

import { CACHE_PREFIX, SW_MESSAGE } from '#/lib/sw-core'

const SW_URL = '/sw.js'

/** Set when *this* tab asked the waiting worker to take over. */
let updateRequested = false

function supported(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator
}

/**
 * Remove any worker and cache this origin picked up earlier — the escape hatch
 * for `pnpm dev` on the same localhost a production build was tried on.
 */
async function unregisterAll(): Promise<void> {
  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.all(registrations.map((r) => r.unregister()))
  // Straight from the page, not by message: the worker that would have
  // answered one was just unregistered.
  if (!('caches' in window)) return
  const keys = await caches.keys()
  await Promise.all(
    keys
      .filter((key) => key.startsWith(CACHE_PREFIX))
      .map((k) => caches.delete(k)),
  )
}

/**
 * Register the worker and report when an update is installed and waiting.
 *
 * Returns a cleanup function; safe to call in any environment, it simply does
 * nothing where service workers are unavailable.
 */
export function setupServiceWorker(onUpdateWaiting: () => void): () => void {
  if (!supported()) return () => {}

  if (!import.meta.env.PROD) {
    void unregisterAll().catch(() => undefined)
    return () => {}
  }

  let disposed = false

  const watch = (registration: ServiceWorkerRegistration) => {
    if (disposed) return
    // A worker already waiting when the page loads (the user reloaded without
    // accepting) has no `updatefound` left to fire — check for it directly.
    if (registration.waiting && navigator.serviceWorker.controller) {
      onUpdateWaiting()
    }
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing
      if (!installing) return
      installing.addEventListener('statechange', () => {
        // `controller` is null on the very first install: that worker is the
        // first version, not an update, and prompting for it would be noise.
        if (
          installing.state === 'installed' &&
          navigator.serviceWorker.controller &&
          !disposed
        ) {
          onUpdateWaiting()
        }
      })
    })
  }

  const onControllerChange = () => {
    // Only the tab that accepted the update reloads. `clients.claim()` fires
    // this on first install too, where a reload would be a mystery to the user.
    if (!updateRequested) return
    updateRequested = false
    window.location.reload()
  }
  navigator.serviceWorker.addEventListener(
    'controllerchange',
    onControllerChange,
  )

  navigator.serviceWorker
    .register(SW_URL, { scope: '/' })
    .then(watch)
    .catch(() => undefined)

  return () => {
    disposed = true
    navigator.serviceWorker.removeEventListener(
      'controllerchange',
      onControllerChange,
    )
  }
}

/**
 * Let the waiting worker take over. The reload follows from
 * `controllerchange`, once the new worker is actually in control — reloading
 * any earlier would just load the old version again.
 */
export async function applyUpdate(): Promise<void> {
  if (!supported()) return
  const registration = await navigator.serviceWorker.getRegistration()
  const waiting = registration?.waiting
  if (!waiting) {
    window.location.reload()
    return
  }
  updateRequested = true
  waiting.postMessage(SW_MESSAGE.skipWaiting)
}

/**
 * Drop everything cached outside the static shell. Called on sign-out: the
 * shell is the credential-free app itself, fetched without cookies, but
 * nothing else that a session touched should outlive it on this device.
 */
export async function clearRuntimeCache(): Promise<void> {
  try {
    if (supported()) {
      const registration = await navigator.serviceWorker.getRegistration()
      registration?.active?.postMessage(SW_MESSAGE.clearRuntimeCache)
    }
  } catch {
    /* a cache that cannot be cleared must never block a sign-out */
  }
}
