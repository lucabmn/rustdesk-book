import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Dialog } from 'radix-ui'
import { Copy, Pencil, Power, Star, Trash2, X } from 'lucide-react'

import { STATUS_META, formatRustdeskId, osLabel } from '#/lib/device-meta'
import { orpc } from '#/orpc/client'
import { statusLabel } from '#/lib/i18n-labels'
import { m } from '#/paraglide/messages'
import type { Device } from '#/orpc/schema'
import { formatLastSeen } from '#/lib/format'
import { DeviceHistoryList } from './device-history-list'
import { DevicePasswordField } from './device-password-field'
import { Meta, Section } from './drawer-parts'
import { GroupMembership } from './group-membership'

interface Props {
  device: Device | null
  onOpenChange: (open: boolean) => void
  onConnect: (device: Device) => void
  onEdit: (device: Device) => void
  onDelete: (device: Device) => void
  onCopyId: (device: Device) => void
  onToggleFavorite: (device: Device) => void
  reveal: (device: Device) => Promise<string>
}

export function DeviceDetailDrawer({
  device,
  onOpenChange,
  onConnect,
  onEdit,
  onDelete,
  onCopyId,
  onToggleFavorite,
  reveal,
}: Props) {
  const [password, setPassword] = useState<string | null>(null)
  const [revealing, setRevealing] = useState(false)

  const historyQuery = useQuery(
    orpc.audit.listForDevice.queryOptions({
      input: { deviceId: device?.id ?? '' },
      enabled: device !== null,
    }),
  )
  const history = historyQuery.data ?? []

  // Forget any revealed secret when the drawer target changes or closes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the device id only — a new object identity for the same device must not re-hide a revealed secret
  useEffect(() => {
    setPassword(null)
    setRevealing(false)
  }, [device?.id])

  const open = device !== null
  const meta = device ? STATUS_META[device.status] : STATUS_META.offline

  async function toggleReveal() {
    if (!device) return
    if (password !== null) {
      setPassword(null)
      return
    }
    setRevealing(true)
    try {
      setPassword(await reveal(device))
    } finally {
      setRevealing(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 40,
            background: 'rgba(0,0,0,.12)',
          }}
        />
        <Dialog.Content
          aria-describedby={undefined}
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: 400,
            maxWidth: '100vw',
            zIndex: 41,
            background: 'var(--bg-panel)',
            borderLeft: '1px solid var(--bd-1)',
            boxShadow: 'var(--sh-pop)',
            display: 'flex',
            flexDirection: 'column',
            animation: 'tvSlideIn .18s ease',
          }}
        >
          {device && (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--bd-1)',
                }}
              >
                <span
                  className={`tv-dot ${meta.dot}`}
                  style={{ width: 9, height: 9 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Dialog.Title
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {device.alias}
                  </Dialog.Title>
                  <div
                    className="mono"
                    style={{ fontSize: 12, color: 'var(--fg-3)' }}
                  >
                    {formatRustdeskId(device.rustdeskId)}
                  </div>
                </div>
                <span className={meta.chip}>{statusLabel(device.status)}</span>
                <button
                  type="button"
                  className="tv-btn tv-btn--ghost tv-btn--icon-sm"
                  title={
                    device.isFavorite ? m.favorite_remove() : m.favorite_add()
                  }
                  aria-label={
                    device.isFavorite ? m.favorite_remove() : m.favorite_add()
                  }
                  aria-pressed={device.isFavorite}
                  style={
                    device.isFavorite ? { color: 'var(--brand)' } : undefined
                  }
                  onClick={() => onToggleFavorite(device)}
                >
                  <Star
                    size={16}
                    style={
                      device.isFavorite ? { fill: 'currentColor' } : undefined
                    }
                  />
                </button>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="tv-btn tv-btn--ghost tv-btn--icon-sm"
                    aria-label={m.common_close()}
                  >
                    <X size={16} />
                  </button>
                </Dialog.Close>
              </div>

              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                <button
                  type="button"
                  className="tv-btn tv-btn--default tv-btn--block"
                  style={{ height: 34 }}
                  onClick={() => onConnect(device)}
                >
                  <Power size={16} strokeWidth={1.75} />
                  {m.drawer_open_session()}
                </button>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr',
                    gap: '10px 14px',
                    fontSize: 12.5,
                  }}
                >
                  <Meta label={m.th_customer()}>{device.customer || '—'}</Meta>
                  <Meta label={m.drawer_os()}>{osLabel(device.osKey)}</Meta>
                  <Meta label={m.drawer_last_seen()}>
                    {formatLastSeen(device.lastSeen)}
                  </Meta>
                  <span style={{ color: 'var(--fg-3)' }}>{m.th_id()}</span>
                  <button
                    type="button"
                    className="mono tv-row-click"
                    style={{
                      color: 'var(--fg-1)',
                      textAlign: 'right',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      font: 'inherit',
                      cursor: 'pointer',
                    }}
                    onClick={() => onCopyId(device)}
                    title={m.drawer_copy()}
                    aria-label={m.drawer_copy()}
                  >
                    {formatRustdeskId(device.rustdeskId)}
                    <Copy
                      size={12}
                      style={{ marginLeft: 6, verticalAlign: -1 }}
                    />
                  </button>
                </div>

                <DevicePasswordField
                  hasPassword={device.hasPassword}
                  password={password}
                  revealing={revealing}
                  onToggleReveal={toggleReveal}
                />

                {device.tags.length > 0 && (
                  <Section title={m.th_tags()}>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {device.tags.map((t) => (
                        <span key={t} className="tv-chip tv-chip--brand">
                          {t}
                        </span>
                      ))}
                    </div>
                  </Section>
                )}

                {device.notes && (
                  <Section title={m.form_notes_label()}>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: 'var(--fg-2)',
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {device.notes}
                    </div>
                  </Section>
                )}

                <Section title={m.drawer_groups()}>
                  <GroupMembership deviceId={device.id} />
                </Section>

                <DeviceHistoryList history={history} />
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  padding: '12px 16px',
                  borderTop: '1px solid var(--bd-1)',
                }}
              >
                <button
                  type="button"
                  className="tv-btn tv-btn--outline tv-btn--sm tv-btn--block"
                  onClick={() => onEdit(device)}
                >
                  <Pencil size={14} />
                  {m.common_edit()}
                </button>
                <button
                  type="button"
                  className="tv-btn tv-btn--destructive tv-btn--sm"
                  onClick={() => onDelete(device)}
                >
                  <Trash2 size={14} />
                  {m.common_delete()}
                </button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
