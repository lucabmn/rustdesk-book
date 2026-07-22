import { useEffect, useState } from 'react'
import { Dialog } from 'radix-ui'
import { X } from 'lucide-react'

import { OS_OPTIONS, DEVICE_STATUSES } from '#/lib/device-meta'
import type { Device } from '#/orpc/schema'
import type { DeviceInput } from '#/orpc/schema'

const STATUS_LABELS: Record<string, string> = {
  online: 'Online',
  away: 'Abwesend',
  offline: 'Offline',
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Device being edited, or null when adding. */
  device: Device | null
  onSubmit: (input: DeviceInput) => void
  busy?: boolean
}

const empty = {
  rustdeskId: '',
  alias: '',
  customer: '',
  osKey: 'win11' as string,
  tags: '',
  status: 'offline' as string,
  password: '',
  notes: '',
}

export function DeviceFormDialog({
  open,
  onOpenChange,
  device,
  onSubmit,
  busy,
}: Props) {
  const [form, setForm] = useState(empty)

  // Reset the form whenever the dialog opens (never prefill the password).
  useEffect(() => {
    if (!open) return
    setForm(
      device
        ? {
            rustdeskId: device.rustdeskId,
            alias: device.alias,
            customer: device.customer ?? '',
            osKey: device.osKey ?? 'win11',
            tags: device.tags.join(', '),
            status: device.status,
            password: '',
            notes: device.notes ?? '',
          }
        : empty,
    )
  }, [open, device])

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }))

  function submit() {
    onSubmit({
      rustdeskId: form.rustdeskId.trim(),
      alias: form.alias.trim(),
      customer: form.customer.trim(),
      osKey: form.osKey as DeviceInput['osKey'],
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      status: form.status as DeviceInput['status'],
      password: form.password,
      notes: form.notes.trim(),
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="tv-dialog-overlay" />
        <Dialog.Content className="tv-dialog" style={{ maxWidth: 460 }}>
          <div className="tv-dialog__header">
            <Dialog.Title className="tv-dialog__title">
              {device ? 'Gerät bearbeiten' : 'Gerät hinzufügen'}
            </Dialog.Title>
            <Dialog.Description className="tv-dialog__description">
              RustDesk-Gerät im Adressbuch pflegen. Das Passwort wird verschlüsselt
              gespeichert.
            </Dialog.Description>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
            }}
          >
            <Field label="RustDesk-ID *">
              <input
                className="tv-input mono"
                value={form.rustdeskId}
                onChange={(e) => set('rustdeskId', e.target.value)}
                placeholder="123456789"
                inputMode="numeric"
              />
            </Field>
            <Field label="Alias / Anzeigename *">
              <input
                className="tv-input"
                value={form.alias}
                onChange={(e) => set('alias', e.target.value)}
                placeholder="Empfang-PC"
              />
            </Field>
            <Field label="Kunde / Mandant">
              <input
                className="tv-input"
                value={form.customer}
                onChange={(e) => set('customer', e.target.value)}
                placeholder="Bäckerei Krause GmbH"
              />
            </Field>
            <Field label="Betriebssystem">
              <select
                className="tv-select"
                style={{ width: '100%' }}
                value={form.osKey}
                onChange={(e) => set('osKey', e.target.value)}
              >
                {OS_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                className="tv-select"
                style={{ width: '100%' }}
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
              >
                {DEVICE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tags (kommagetrennt)">
              <input
                className="tv-input"
                value={form.tags}
                onChange={(e) => set('tags', e.target.value)}
                placeholder="Server, Kasse"
              />
            </Field>
            <Field label="Passwort" full>
              <input
                className="tv-input mono"
                type="password"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                placeholder={device ? '•••••••• (unverändert lassen)' : '••••••••'}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Notizen" full>
              <textarea
                className="tv-input"
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="z.B. Standort, Ansprechpartner, Zugangshinweise…"
              />
            </Field>
          </div>

          <div className="tv-dialog__footer">
            <Dialog.Close asChild>
              <button className="tv-btn tv-btn--outline tv-btn--sm">Abbrechen</button>
            </Dialog.Close>
            <button
              className="tv-btn tv-btn--default tv-btn--sm"
              onClick={submit}
              disabled={busy}
            >
              {device ? 'Speichern' : 'Hinzufügen'}
            </button>
          </div>

          <Dialog.Close asChild>
            <button
              className="tv-btn tv-btn--ghost tv-btn--icon-sm"
              aria-label="Schließen"
              style={{ position: 'absolute', top: 8, right: 8 }}
            >
              <X size={16} />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Field({
  label,
  children,
  full,
}: {
  label: string
  children: React.ReactNode
  full?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        gridColumn: full ? '1 / -1' : undefined,
      }}
    >
      <span className="tv-label">{label}</span>
      {children}
    </div>
  )
}
