import { CloudOff, CloudUpload, TriangleAlert } from 'lucide-react'

import { Button } from '#/components/ui'
import { cacheAgeLabel } from '#/lib/i18n-labels'
import { m } from '#/paraglide/messages'

export interface OfflineNoticeProps {
  offline: boolean
  /** When the stored address book was read, if there is one. */
  fetchedAt?: number
  /** Devices waiting to be transferred. */
  pending: number
  /** Entries that need the user: a conflict, or a refusal. */
  stuck: number
  onReview: () => void
}

/**
 * The one line that says what the app is currently able to tell the truth
 * about: whether there is a connection, how old what is on screen is, and what
 * is still on its way.
 *
 * In normal flow rather than fixed or floating, for two reasons: a fixed strip
 * would sit on top of the toast, which already owns the bottom of a phone
 * screen, and pushing the content down is exactly the right amount of
 * interruption for "what you are reading is not live".
 */
export function OfflineNotice({
  offline,
  fetchedAt,
  pending,
  stuck,
  onReview,
}: OfflineNoticeProps) {
  if (!offline && pending === 0 && stuck === 0) return null

  const age =
    fetchedAt === undefined
      ? m.offline_stale_unknown()
      : m.offline_stale_notice({ age: cacheAgeLabel(fetchedAt, Date.now()) })

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-line border-b bg-sunken px-3 py-2 text-xs sm:px-4"
    >
      {offline && (
        <span className="flex items-center gap-1.5 text-muted">
          <CloudOff className="size-3.5 shrink-0 text-warn" />
          {age}
        </span>
      )}

      {pending > 0 && (
        <span className="flex items-center gap-1.5 text-muted">
          <CloudUpload className="size-3.5 shrink-0 text-accent" />
          {m.offline_pending_count({ count: pending })}
        </span>
      )}

      {stuck > 0 && (
        <span className="flex items-center gap-1.5 text-muted">
          <TriangleAlert className="size-3.5 shrink-0 text-warn" />
          {m.offline_stuck_count({ count: stuck })}
        </span>
      )}

      {/* Last and pushed to the end, so on a 375px screen the counts wrap
          before the control does and nothing lands on top of the toolbar. */}
      {(pending > 0 || stuck > 0) && (
        <Button size="xs" className="ml-auto" onClick={onReview}>
          {m.offline_review()}
        </Button>
      )}
    </div>
  )
}
