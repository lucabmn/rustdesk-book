import { useEffect, useState } from 'react'
import { Dialog } from 'radix-ui'
import { Copy, Eye, EyeOff, Pencil, Power, Trash2, X } from 'lucide-react'

import {
  STATUS_META,
  formatRustdeskId,
  osLabel,
} from '#/lib/device-meta'
import type { Device } from '#/orpc/schema'

const STATUS_LABELS: Record<string, string> = {
  online: 'Online',
  away: 'Abwesend',
  offline: 'Offline',
}

interface Props {
  device: Device | null
  onOpenChange: (open: boolean) => void
  onConnect: (device: Device) => void
  onEdit: (device: Device) => void
  onDelete: (device: Device) => void
  onCopyId: (device: Device) => void
  reveal: (device: Device) => Promise<string>
}

export function DeviceDetailDrawer({
  device,
  onOpenChange,
  onConnect,
  onEdit,
  onDelete,
  onCopyId,
  reveal,
}: Props) {
  const [password, setPassword] = useState<string | null>(null)
  const [revealing, setRevealing] = useState(false)

  // Forget any revealed secret when the drawer target changes or closes.
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
          style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,.12)' }}
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
                <span className={`tv-dot ${meta.dot}`} style={{ width: 9, height: 9 }} />
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
                  <div className="mono" style={{ fontSize: 12, color: 'var(--fg-3)' }}>
                    {formatRustdeskId(device.rustdeskId)}
                  </div>
                </div>
                <span className={meta.chip}>{STATUS_LABELS[device.status]}</span>
                <Dialog.Close asChild>
                  <button
                    className="tv-btn tv-btn--ghost tv-btn--icon-sm"
                    aria-label="Schließen"
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
                  className="tv-btn tv-btn--default tv-btn--block"
                  style={{ height: 34 }}
                  onClick={() => onConnect(device)}
                >
                  <Power size={16} strokeWidth={1.75} />
                  RustDesk-Sitzung öffnen
                </button>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr',
                    gap: '10px 14px',
                    fontSize: 12.5,
                  }}
                >
                  <Meta label="Kunde">{device.customer || '—'}</Meta>
                  <Meta label="Betriebssystem">{osLabel(device.osKey)}</Meta>
                  <Meta label="Letzte Verbindung">
                    {formatLastSeen(device.lastSeen)}
                  </Meta>
                  <span style={{ color: 'var(--fg-3)' }}>RustDesk-ID</span>
                  <span
                    className="mono tv-row-click"
                    style={{ color: 'var(--fg-1)', textAlign: 'right' }}
                    onClick={() => onCopyId(device)}
                    title="Kopieren"
                  >
                    {formatRustdeskId(device.rustdeskId)}
                    <Copy size={12} style={{ marginLeft: 6, verticalAlign: -1 }} />
                  </span>
                </div>

                <Section title="Passwort">
                  {device.hasPassword ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 10px',
                        border: '1px solid var(--bd-1)',
                        borderRadius: 6,
                        background: 'var(--bg-sunken)',
                      }}
                    >
                      <span
                        className="mono"
                        style={{ flex: 1, letterSpacing: 1, color: 'var(--fg-1)' }}
                      >
                        {password ?? '••••••••'}
                      </span>
                      <button
                        className="tv-btn tv-btn--ghost tv-btn--icon-xs"
                        onClick={toggleReveal}
                        disabled={revealing}
                        aria-label={password ? 'Passwort verbergen' : 'Passwort anzeigen'}
                      >
                        {password ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: 12.5, color: 'var(--fg-4)' }}>
                      Kein Passwort hinterlegt.
                    </span>
                  )}
                </Section>

                {device.tags.length > 0 && (
                  <Section title="Tags">
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
                  <Section title="Notizen">
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
                  className="tv-btn tv-btn--outline tv-btn--sm tv-btn--block"
                  onClick={() => onEdit(device)}
                >
                  <Pencil size={14} />
                  Bearbeiten
                </button>
                <button
                  className="tv-btn tv-btn--destructive tv-btn--sm"
                  onClick={() => onDelete(device)}
                >
                  <Trash2 size={14} />
                  Löschen
                </button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span style={{ color: 'var(--fg-3)' }}>{label}</span>
      <span style={{ color: 'var(--fg-1)', textAlign: 'right' }}>{children}</span>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '.05em',
          color: 'var(--fg-4)',
          marginBottom: 7,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

export function formatLastSeen(iso: string | null): string {
  if (!iso) return 'Nie'
  const d = new Date(iso)
  return d.toLocaleString('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
