import { createFileRoute } from '@tanstack/react-router'

import { BrandMark } from '#/components/brand-mark'
import { Button, Card } from '#/components/ui'
import { m } from '#/paraglide/messages'

/**
 * What the service worker serves when a navigation cannot reach the server.
 *
 * A real route rather than a static HTML file, so the page is built from the
 * same primitives as the rest of the app and cannot drift from it. Two rules
 * follow from where it is used, though:
 *
 *  - it must render something useful without JavaScript. The worker stores
 *    this document at install time and hands it back on a cold, offline start,
 *    where the route's own chunk may not have been fetched yet.
 *  - it must hold nothing user-specific. The worker fetches it without
 *    credentials and serves the one copy to whoever opens the app next.
 *
 * Which is why "retry" is a link and not a button: an anchor to `/` re-runs the
 * navigation with no script involved. The text is the base locale (German)
 * until the app hydrates, which offline it may never do — accepted, the
 * alternative is a second locale mechanism that works without the router.
 */
export const Route = createFileRoute('/offline')({
  component: OfflinePage,
})

function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-safe py-10">
      <div className="flex w-full justify-center px-4 pb-[env(safe-area-inset-bottom)]">
        <Card className="w-full max-w-[380px] p-6">
          <BrandMark />
          <h1 className="mt-5 font-semibold text-text text-xl tracking-tight">
            {m.offline_title()}
          </h1>
          <p className="mt-1 text-muted text-xs">{m.offline_subtitle()}</p>
          <p className="mt-4 text-muted text-xs leading-relaxed">
            {m.offline_body()}
          </p>
          <Button asChild variant="accent" size="md" className="mt-5 w-full">
            <a href="/">{m.offline_retry()}</a>
          </Button>
        </Card>
      </div>
    </div>
  )
}
