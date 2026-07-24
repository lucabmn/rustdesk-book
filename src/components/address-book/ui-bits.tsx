import { MonitorDot, Power, Star } from 'lucide-react'

import { STATUS_META } from '#/lib/device-meta'
import { statusLabel } from '#/lib/i18n-labels'
import type { Device } from '#/orpc/schema'
import { m } from '#/paraglide/messages'

/** Small presentational pieces shared by the address-book shell and its views. */

export function BrandLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 22,
          height: 22,
          borderRadius: 6,
          backgroundImage: 'var(--brand-gradient)',
          color: 'var(--brand-fg)',
        }}
      >
        <MonitorDot size={14} strokeWidth={2} />
      </span>
      <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '-0.01em' }}>
        rustdesk<span style={{ color: 'var(--brand)' }}>·</span>book
      </span>
    </div>
  )
}

export function SidebarHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '14px 14px 6px',
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: '.05em',
        textTransform: 'uppercase',
        color: 'var(--fg-4)',
      }}
    >
      {children}
    </div>
  )
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{ padding: 40, textAlign: 'center', color: 'var(--fg-4)', fontSize: 13 }}
    >
      {children}
    </div>
  )
}

export function StatusDot({ status }: { status: Device['status'] }) {
  return (
    <span
      className={`tv-dot ${STATUS_META[status].dot}`}
      style={{ width: 8, height: 8 }}
      title={statusLabel(status)}
    />
  )
}

export function FavoriteButton({
  active,
  onToggle,
}: {
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      className="tv-btn tv-btn--ghost tv-btn--icon-xs"
      title={active ? m.favorite_remove() : m.favorite_add()}
      aria-label={active ? m.favorite_remove() : m.favorite_add()}
      aria-pressed={active}
      style={active ? { color: 'var(--brand)' } : undefined}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    >
      <Star size={13} style={active ? { fill: 'currentColor' } : undefined} />
    </button>
  )
}

export function ConnectButton({
  onClick,
}: {
  onClick: (e: React.MouseEvent) => void
}) {
  return (
    <button
      className="tv-btn tv-btn--default tv-btn--xs"
      onClick={(e) => {
        e.stopPropagation()
        onClick(e)
      }}
    >
      <Power size={12} strokeWidth={1.75} />
      {m.common_connect()}
    </button>
  )
}

export function DeviceTags({ tags }: { tags: string[] }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
      {tags.map((t) => (
        <span key={t} className="tv-chip tv-chip--neutral">
          {t}
        </span>
      ))}
    </span>
  )
}
