import { type DeviceStatus, STATUS_TONE } from '#/lib/device-meta'
import { statusLabel } from '#/lib/i18n-labels'
import { cn } from '#/lib/utils'
import { Badge } from './badge'

const DOT: Record<string, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  neutral: 'bg-faint',
}

/**
 * Status as a coloured dot. Carries its label as a title so the meaning
 * doesn't depend on colour alone.
 */
export function StatusDot({
  status,
  className,
}: {
  status: DeviceStatus
  className?: string
}) {
  const label = statusLabel(status)
  return (
    <span
      className={cn(
        'inline-block size-2 shrink-0 rounded-full',
        DOT[STATUS_TONE[status]],
        className,
      )}
      title={label}
      aria-label={label}
      role="img"
    />
  )
}

/** Status as a labelled pill, for cards and the detail drawer. */
export function StatusBadge({ status }: { status: DeviceStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{statusLabel(status)}</Badge>
}
