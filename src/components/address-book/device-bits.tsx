import { Power, Star } from 'lucide-react'

import { Badge, Button } from '#/components/ui'
import { formatRustdeskId } from '#/lib/device-meta'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'

/** Device-specific pieces shared by the three views and the detail drawer. */

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
}: {
  active: boolean
  onToggle: () => void
}) {
  const label = active ? m.favorite_remove() : m.favorite_add()
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={active ? 'text-accent hover:text-accent' : undefined}
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
}: {
  onClick: () => void
  className?: string
}) {
  return (
    <Button
      variant="accent"
      size="xs"
      className={className}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      <Power />
      {m.common_connect()}
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
