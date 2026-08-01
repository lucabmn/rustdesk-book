import { CloudUpload, Power, Star } from 'lucide-react'

import { Badge, Button } from '#/components/ui'
import { formatRustdeskId } from '#/lib/device-meta'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'

/** Device-specific pieces shared by the three views and the detail drawer. */

/**
 * Marks a device that exists only in this browser so far.
 *
 * It is deliberately a visible label rather than a shade of grey: a row the
 * server has never seen is not a normal record, and the difference has to
 * survive a screenshot, a colour-blind reader and a phone in sunlight.
 */
export function PendingBadge({ className }: { className?: string }) {
  return (
    <Badge tone="accent" className={cn('gap-1', className)}>
      <CloudUpload className="size-3" />
      {m.offline_pending_badge()}
    </Badge>
  )
}

/**
 * A RustDesk id. Always monospaced and tabular so ids line up in a column and
 * a wrong digit is visible at a glance.
 */
export function DeviceId({
  id,
  className,
}: {
  id: string
  className?: string
}) {
  return (
    <span className={cn('tnum font-mono text-muted text-xs', className)}>
      {formatRustdeskId(id)}
    </span>
  )
}

export function FavoriteButton({
  active,
  onToggle,
  className,
}: {
  active: boolean
  onToggle: () => void
  className?: string
}) {
  const label = active ? m.favorite_remove() : m.favorite_add()
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(active && 'text-accent hover:text-accent', className)}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    >
      <Star className={active ? 'fill-current' : undefined} />
    </Button>
  )
}

export function ConnectButton({
  onClick,
  className,
  /**
   * Accent is for the one primary action on a surface. In a list every row
   * would claim it, so rows pass `variant="outline"` and only the card and the
   * drawer — where Connect really is *the* action — keep the accent.
   */
  variant = 'accent',
  /**
   * Drop the label until `lg`. Only the table needs this: its row already
   * spends its width on an id, an alias and up to four controls, and the label
   * is what pushes the last of them off the edge — on a phone, and again on a
   * tablet once the columns come back. The icon keeps its accessible name.
   */
  compact = false,
}: {
  onClick: () => void
  className?: string
  variant?: 'accent' | 'outline'
  compact?: boolean
}) {
  return (
    <Button
      variant={variant}
      size="xs"
      className={className}
      title={m.common_connect()}
      aria-label={m.common_connect()}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      <Power />
      <span className={compact ? 'hidden lg:inline' : undefined}>
        {m.common_connect()}
      </span>
    </Button>
  )
}

export function DeviceTags({
  tags,
  className,
}: {
  tags: string[]
  className?: string
}) {
  if (tags.length === 0) return null
  return (
    <span className={cn('inline-flex flex-wrap gap-1', className)}>
      {tags.map((t) => (
        <Badge key={t}>{t}</Badge>
      ))}
    </span>
  )
}

/** Password column: presence only, never the value. */
export function PasswordMask({ hasPassword }: { hasPassword: boolean }) {
  return (
    <span className="font-mono text-faint text-xs tracking-widest">
      {hasPassword ? '••••••' : '—'}
    </span>
  )
}
