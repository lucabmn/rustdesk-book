import { useState } from 'react'
import { CloudUpload, RefreshCw, TriangleAlert, Trash2 } from 'lucide-react'

import { Badge, Button, Dialog, DialogBody, EmptyState } from '#/components/ui'
import { formatRustdeskId } from '#/lib/device-meta'
import type { QueueEntry } from '#/lib/offline-queue'
import { m } from '#/paraglide/messages'

export interface QueueDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  queue: QueueEntry[]
  /** True while there is no connection: only discarding works then. */
  offline: boolean
  /** Names of the devices entries collide with, by device id. */
  conflictNames: Record<string, string | undefined>
  onAdopt: (entryId: string) => void
  onDiscard: (entryId: string) => void
  onRetry: (entryId: string) => void
}

/** Why this entry is still here, in one sentence. */
function entryReason(entry: QueueEntry, conflictWith?: string): string {
  if (entry.state === 'conflict') {
    return m.queue_conflict({
      rustdeskId: formatRustdeskId(entry.input.rustdeskId),
      existing: conflictWith ?? '—',
    })
  }
  if (entry.state === 'failed')
    return m.queue_failed({ error: entry.error ?? '—' })
  return m.queue_waiting()
}

function QueueRow({
  entry,
  offline,
  conflictWith,
  onAdopt,
  onDiscard,
  onRetry,
}: {
  entry: QueueEntry
  offline: boolean
  conflictWith?: string
  onAdopt: () => void
  onDiscard: () => void
  onRetry: () => void
}) {
  const [busy, setBusy] = useState(false)

  const run = async (action: () => void | Promise<void>) => {
    setBusy(true)
    try {
      await action()
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="rounded-md border border-line bg-sunken p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-medium text-text text-xs">
          {entry.input.alias}
        </span>
        <span className="tnum font-mono text-2xs text-muted">
          {formatRustdeskId(entry.input.rustdeskId)}
        </span>
        <Badge tone={entry.state === 'pending' ? 'accent' : 'warn'}>
          {entry.state === 'pending' ? (
            <CloudUpload className="size-3" />
          ) : (
            <TriangleAlert className="size-3" />
          )}
        </Badge>
      </div>

      <p className="mt-1 text-muted text-xs leading-relaxed">
        {entryReason(entry, conflictWith)}
      </p>

      {entry.state !== 'pending' && (
        // Wrapping: three controls in a row do not fit at 375px, and a
        // decision this final should not be made with a mis-tap.
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {entry.state === 'conflict' && (
            <Button
              size="xs"
              variant="accent"
              disabled={offline || busy}
              onClick={() => run(onAdopt)}
            >
              {m.queue_adopt()}
            </Button>
          )}
          {entry.state === 'failed' && (
            <Button
              size="xs"
              disabled={offline || busy}
              onClick={() => run(onRetry)}
            >
              <RefreshCw />
              {m.queue_retry()}
            </Button>
          )}
          <Button
            size="xs"
            variant="danger"
            disabled={busy}
            onClick={onDiscard}
          >
            <Trash2 />
            {m.queue_discard()}
          </Button>
        </div>
      )}
    </li>
  )
}

/**
 * Everything the offline queue is holding, and the two decisions only the user
 * can make about an entry that will not go through: take the device that is
 * already there, or let this one go.
 *
 * Nothing in here decides on its own. An entry stays in the queue until it is
 * transferred or explicitly discarded — that is the promise the whole feature
 * rests on, and a dialog that quietly tidied up would break it.
 */
export function QueueDialog({
  open,
  onOpenChange,
  queue,
  offline,
  conflictNames,
  onAdopt,
  onDiscard,
  onRetry,
}: QueueDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={m.queue_title()}
      description={m.queue_description()}
      width={560}
      footer={
        <Button onClick={() => onOpenChange(false)}>{m.common_close()}</Button>
      }
    >
      <DialogBody>
        {queue.length === 0 ? (
          <EmptyState className="py-10">{m.queue_empty()}</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {queue.map((entry) => (
              <QueueRow
                key={entry.id}
                entry={entry}
                offline={offline}
                conflictWith={
                  entry.conflictId ? conflictNames[entry.conflictId] : undefined
                }
                onAdopt={() => onAdopt(entry.id)}
                onDiscard={() => onDiscard(entry.id)}
                onRetry={() => onRetry(entry.id)}
              />
            ))}
          </ul>
        )}
      </DialogBody>
    </Dialog>
  )
}
