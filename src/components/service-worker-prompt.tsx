import { useEffect, useState } from 'react'

import { Button } from '#/components/ui'
import { applyUpdate, setupServiceWorker } from '#/lib/sw-client'
import { m } from '#/paraglide/messages'

/**
 * Registers the service worker and, when a deploy has brought a new version
 * that is installed and waiting, asks before swapping it in.
 *
 * Asking rather than reloading is the point: the app is a place where someone
 * is mid-edit on a device or has a password revealed, and a silent reload
 * would take that away. Until it is accepted, the running version keeps
 * serving — the new one is already on disk and costs nothing to sit on.
 *
 * Renders nothing on the server and nothing until there is something to say,
 * so it is safe to mount at the root of every page.
 */
export function ServiceWorkerPrompt() {
  const [waiting, setWaiting] = useState(false)

  useEffect(() => setupServiceWorker(() => setWaiting(true)), [])

  if (!waiting) return null

  return (
    <div
      role="status"
      /* On a phone the toast owns the bottom edge across the full width, so
         this sits a toast-height above it; with a cursor the two are in
         opposite corners and the offset does not apply. */
      className="fade-in-0 slide-in-from-bottom-2 fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-60 flex animate-in items-center gap-3 rounded-lg border border-line bg-elevated px-3 py-2.5 shadow-pop sm:right-4 sm:bottom-9 sm:left-auto sm:max-w-sm"
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-text text-xs">{m.sw_update_title()}</p>
        <p className="mt-0.5 text-2xs text-muted">{m.sw_update_body()}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={() => setWaiting(false)}>
        {m.sw_update_dismiss()}
      </Button>
      <Button variant="accent" size="sm" onClick={() => void applyUpdate()}>
        {m.sw_update_action()}
      </Button>
    </div>
  )
}
