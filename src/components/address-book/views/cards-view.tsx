import { Monitor, Pencil, Power } from 'lucide-react'

import { formatRustdeskId, osLabel, STATUS_META } from '#/lib/device-meta'
import { statusLabel } from '#/lib/i18n-labels'
import type { Device } from '#/orpc/schema'
import { m } from '#/paraglide/messages'
import { formatLastSeen } from '../device-detail-drawer'
import { DeviceTags, FavoriteButton } from '../ui-bits'

export interface CardsViewProps {
  devices: Device[]
  onOpen: (device: Device) => void
  onConnect: (device: Device) => void
  onEdit: (device: Device) => void
  onToggleFavorite: (device: Device) => void
}

/** Card grid — the touch-friendly, scan-at-a-glance view. */
export function CardsView({
  devices,
  onOpen,
  onConnect,
  onEdit,
  onToggleFavorite,
}: CardsViewProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill,minmax(288px,1fr))',
        gap: 14,
      }}
    >
      {devices.map((d) => (
        <div
          key={d.id}
          className="tv-card tv-row-click"
          onClick={() => onOpen(d)}
          style={{ gap: 10, padding: '14px 0' }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '0 14px',
            }}
          >
            <span
              className="tv-avatar tv-avatar--sm"
              style={{ background: 'var(--bg-sunken)', color: 'var(--fg-3)' }}
            >
              <Monitor size={14} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 13,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {d.alias}
              </div>
              <div className="mono" style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
                {formatRustdeskId(d.rustdeskId)}
              </div>
            </div>
            <FavoriteButton
              active={d.isFavorite}
              onToggle={() => onToggleFavorite(d)}
            />
            <span className={STATUS_META[d.status].chip}>
              {statusLabel(d.status)}
            </span>
          </div>
          <div
            style={{
              padding: '0 14px',
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: '4px 10px',
              fontSize: 12,
              color: 'var(--fg-3)',
            }}
          >
            <span>{m.label_customer()}</span>
            <span style={{ color: 'var(--fg-2)', textAlign: 'right' }}>
              {d.customer || '—'}
            </span>
            <span>{m.label_os()}</span>
            <span style={{ color: 'var(--fg-2)', textAlign: 'right' }}>
              {osLabel(d.osKey)}
            </span>
            <span>{m.label_last()}</span>
            <span style={{ color: 'var(--fg-2)', textAlign: 'right' }}>
              {formatLastSeen(d.lastSeen)}
            </span>
          </div>
          {d.tags.length > 0 && (
            <div
              style={{
                padding: '0 14px',
                display: 'flex',
                gap: 4,
                flexWrap: 'wrap',
              }}
            >
              <DeviceTags tags={d.tags} />
            </div>
          )}
          <div
            style={{
              padding: '10px 14px 0',
              marginTop: 2,
              borderTop: '1px solid var(--bd-subtle)',
              display: 'flex',
              gap: 6,
            }}
          >
            <button
              className="tv-btn tv-btn--default tv-btn--sm"
              style={{ flex: 1, minWidth: 0 }}
              onClick={(e) => {
                e.stopPropagation()
                onConnect(d)
              }}
            >
              <Power size={14} strokeWidth={1.75} />
              {m.common_connect()}
            </button>
            <button
              className="tv-btn tv-btn--outline tv-btn--icon-sm"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(d)
              }}
            >
              <Pencil size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
