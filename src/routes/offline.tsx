import { useEffect, useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Plus } from 'lucide-react'

import { BrandMark } from '#/components/brand-mark'
import { SearchField } from '#/components/address-book/chrome'
import { DeviceFormDialog } from '#/components/address-book/device-form-dialog'
import { OfflineNotice } from '#/components/address-book/offline-notice'
import { QueueDialog } from '#/components/address-book/queue-dialog'
import { ToastProvider, useToast } from '#/components/address-book/toast'
import { useOfflineBook } from '#/components/address-book/use-offline-book'
import { CardsView } from '#/components/address-book/views/cards-view'
import { Button, Card, EmptyState } from '#/components/ui'
import { EMPTY_FILTERS, localDevices } from '#/lib/address-book-filters'
import { stuckEntries } from '#/lib/offline-queue'
import type { DeviceInput } from '#/orpc/schema'
import { m } from '#/paraglide/messages'

/**
 * What the service worker serves when a navigation cannot reach the server.
 *
 * A real route rather than a static HTML file, so the page is built from the
 * same primitives as the rest of the app and cannot drift from it. Two rules
 * follow from where it is used, though:
 *
 *  - it must render something useful without JavaScript. The worker stores
 *    this document at install time and hands it back on a cold, offline start.
 *  - it must hold nothing user-specific. The worker fetches it without
 *    credentials and serves the one copy to whoever opens the app next.
 *
 * Which is why the card below is what the server renders and what a browser
 * without JavaScript keeps — "retry" is a link, not a button, so an anchor to
 * `/` re-runs the navigation with no script involved. The stored address book
 * appears only after hydration, out of this browser's own IndexedDB: it is
 * data about one person and has no business in a document served to everyone.
 *
 * The text is the base locale (German) until the app hydrates, which offline
 * it may never do — accepted, the alternative is a second locale mechanism
 * that works without the router.
 */
export const Route = createFileRoute('/offline')({
  component: OfflinePage,
})

function OfflinePage() {
  // False through SSR and the first paint, which is exactly the window in
  // which this document is the shared, credential-free one.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])

  if (!hydrated) return <OfflineCard />
  return (
    <ToastProvider>
      <OfflineBookView />
    </ToastProvider>
  )
}

/** The document as it is stored, rendered, and served without a session. */
function OfflineCard() {
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

/**
 * The address book from the last session, plus whatever has been added since.
 *
 * Deliberately less than the signed-in app: reading and adding, and nothing
 * that needs a server — no connect, no reveal, no editing, no administration.
 * Everything here works out of this browser's storage alone.
 */
function OfflineBookView() {
  const router = useRouter()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)

  const book = useOfflineBook({
    // Something got through, so there is a session to check again: hand over
    // to the real app rather than keep a second one running beside it.
    onSynced: (outcome) => {
      if (outcome.transferred.length) void router.navigate({ to: '/' })
    },
  })

  const devices = localDevices(book.snapshot, book.queue, {
    ...EMPTY_FILTERS,
    search,
  })

  function submit(input: DeviceInput) {
    book.enqueue(input)
    toast(m.toast_queued())
    setFormOpen(false)
  }

  return (
    <div className="flex min-h-dvh flex-col bg-canvas px-safe text-text">
      <header className="flex h-12 shrink-0 items-center gap-2 border-line border-b bg-surface px-3 sm:gap-3 sm:px-4">
        <BrandMark size="sm" className="shrink-0" />
        {/* The same field the top bar uses, without the shortcut hint: there
            is no keyboard handler on this page to earn one. */}
        <SearchField value={search} onChange={setSearch} />
        <Button
          variant="accent"
          onClick={() => setFormOpen(true)}
          title={m.device_add()}
          aria-label={m.device_add()}
        >
          <Plus />
          <span className="hidden sm:inline">{m.device_add()}</span>
        </Button>
      </header>

      <OfflineNotice
        offline={!book.online}
        fetchedAt={book.snapshot?.fetchedAt}
        pending={book.pendingCount}
        stuck={stuckEntries(book.queue).length}
        onReview={() => setQueueOpen(true)}
      />

      <main className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        {devices.length === 0 ? (
          <EmptyState className="py-20">
            {book.ready ? m.empty_devices() : m.loading()}
          </EmptyState>
        ) : (
          <CardsView
            devices={devices}
            // Every one of these is a server round trip. Offline the cards are
            // there to be read, so the callbacks are wired to nothing rather
            // than to something that would fail when pressed.
            onOpen={() => undefined}
            onConnect={() => undefined}
            onEdit={() => undefined}
            onToggleFavorite={() => undefined}
          />
        )}
      </main>

      <DeviceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        device={null}
        // No suggestions to offer: both lists come from the server, and a
        // free-text field is what the combobox falls back to anyway.
        customers={[]}
        operatingSystems={[]}
        onSubmit={submit}
        offline
      />
      <QueueDialog
        open={queueOpen}
        onOpenChange={setQueueOpen}
        queue={book.queue}
        offline={!book.online}
        // Adopting is a write, so it is not offered here — a conflict can only
        // be found while online, and the signed-in app is where it is settled.
        conflictNames={{}}
        onAdopt={() => undefined}
        onDiscard={book.discard}
        onRetry={book.retry}
      />
    </div>
  )
}
