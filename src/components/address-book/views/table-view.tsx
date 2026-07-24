import { Pencil, Trash2 } from 'lucide-react'

import { formatRustdeskId, osLabel } from '#/lib/device-meta'
import type { Device } from '#/orpc/schema'
import { m } from '#/paraglide/messages'
import { formatLastSeen } from '../device-detail-drawer'
import {
  ConnectButton,
  DeviceTags,
  FavoriteButton,
  StatusDot,
} from '../ui-bits'

export interface TableViewProps {
  devices: Device[]
  onOpen: (device: Device) => void
  onConnect: (device: Device) => void
  onEdit: (device: Device) => void
  onDelete: (device: Device) => void
  onToggleFavorite: (device: Device) => void
}

/** Dense tabular view — the default for keyboard-driven work. */
export function TableView({
  devices,
  onOpen,
  onConnect,
  onEdit,
  onDelete,
  onToggleFavorite,
}: TableViewProps) {
  return (
    <div className="tv-card tv-flush">
      <div style={{ overflowX: 'auto' }}>
        <table className="tv-table" style={{ minWidth: 960 }}>
          <thead>
            <tr>
              <th style={{ width: 34 }} />
              <th>{m.th_id()}</th>
              <th>{m.th_alias()}</th>
              <th>{m.th_customer()}</th>
              <th>{m.th_tags()}</th>
              <th>{m.th_os()}</th>
              <th>{m.th_last_seen()}</th>
              <th>{m.th_password()}</th>
              <th style={{ textAlign: 'right' }}>{m.th_action()}</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.id} className="tv-row-click" onClick={() => onOpen(d)}>
                <td>
                  <StatusDot status={d.status} />
                </td>
                <td
                  className="mono"
                  style={{ fontSize: 12, color: 'var(--fg-2)' }}
                >
                  {formatRustdeskId(d.rustdeskId)}
                </td>
                <td style={{ fontWeight: 600, color: 'var(--fg-1)' }}>
                  {d.alias}
                </td>
                <td style={{ color: 'var(--fg-2)' }}>{d.customer || '—'}</td>
                <td>
                  <DeviceTags tags={d.tags} />
                </td>
                <td style={{ color: 'var(--fg-2)' }}>{osLabel(d.osKey)}</td>
                <td style={{ color: 'var(--fg-3)' }}>
                  {formatLastSeen(d.lastSeen)}
                </td>
                <td
                  className="mono"
                  style={{ color: 'var(--fg-4)', letterSpacing: 1 }}
                >
                  {d.hasPassword ? '••••••••' : '—'}
                </td>
                <td>
                  <span
                    style={{
                      display: 'flex',
                      gap: 4,
                      justifyContent: 'flex-end',
                    }}
                  >
                    <FavoriteButton
                      active={d.isFavorite}
                      onToggle={() => onToggleFavorite(d)}
                    />
                    <ConnectButton onClick={() => onConnect(d)} />
                    <button
                      type="button"
                      className="tv-btn tv-btn--ghost tv-btn--icon-xs"
                      title={m.common_edit()}
                      onClick={(e) => {
                        e.stopPropagation()
                        onEdit(d)
                      }}
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      className="tv-btn tv-btn--ghost tv-btn--icon-xs"
                      title={m.common_delete()}
                      style={{ color: 'var(--s-err)' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(d)
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
