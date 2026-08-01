import { STATUS_TONE } from '#/lib/device-meta'
import { statusLabel } from '#/lib/i18n-labels'
import type { DisplayStatus } from '#/lib/offline-cache'
import { cn } from '#/lib/utils'
import { Badge } from './badge'

const DOT: Record<string, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  neutral: 'bg-faint',
}

/**
 * `unknown` is not in {@link STATUS_TONE}: it is not a state a device can be
 * in, it is what the app says about a row it cannot vouch for. It reads as
 * neutral, which is the point — never as the green of a live device.
 */
function toneOf(status: DisplayStatus): 'ok' | 'warn' | 'neutral' {
  return status === 'unknown' ? 'neutral' : STATUS_TONE[status]
}

/**
 * Status as a coloured dot. Carries its label as a title so the meaning
 * doesn't depend on colour alone.
 */
export function StatusDot({
  status,
  className,
}: {
  status: DisplayStatus
  className?: string
}) {
  const label = statusLabel(status)
  return (
    <span
      className={cn(
        'inline-block size-2 shrink-0 rounded-full',
        DOT[toneOf(status)],
        // A hollow dot for a state nobody knows: it reads as absent rather
        // than as a fourth kind of "offline".
        status === 'unknown' && 'bg-transparent ring-1 ring-faint',
        className,
      )}
      title={label}
      aria-label={label}
      role="img"
    />
  )
}

/** Status as a labelled pill, for cards and the detail drawer. */
export function StatusBadge({ status }: { status: DisplayStatus }) {
  return <Badge tone={toneOf(status)}>{statusLabel(status)}</Badge>
}
