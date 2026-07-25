import { useEffect, useState } from 'react'
import { Dialog } from 'radix-ui'
import { X } from 'lucide-react'

import { DEVICE_STATUSES, osLabel } from '#/lib/device-meta'
import { statusLabel } from '#/lib/i18n-labels'
import { m } from '#/paraglide/messages'
import type { Device } from '#/orpc/schema'
import type { DeviceInput } from '#/orpc/schema'

import { CustomerCombobox } from './customer-combobox'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Device being edited, or null when adding. */
  device: Device | null
  /** Existing customer names, suggested while typing. */
  customers: string[]
  /** Existing operating systems, suggested while typing. */
  operatingSystems: string[]
  onSubmit: (input: DeviceInput) => void
  busy?: boolean
}

const empty = {
  rustdeskId: '',
  alias: '',
  customer: '',
  osKey: '',
  tags: '',
  status: 'offline' as string,
  password: '',
  notes: '',
}

export function DeviceFormDialog({
  open,
  onOpenChange,
  device,
  customers,
  operatingSystems,
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
            osKey: device.osKey ? osLabel(device.osKey) : '',
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
      osKey: form.osKey.trim() || undefined,
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
              {device ? m.form_edit_title() : m.form_add_title()}
            </Dialog.Title>
            <Dialog.Description className="tv-dialog__description">
              {m.form_description()}
            </Dialog.Description>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
            }}
          >
            <Field label={m.form_id_label()}>
              <input
                className="tv-input mono"
                value={form.rustdeskId}
                onChange={(e) => set('rustdeskId', e.target.value)}
                placeholder="123456789"
                inputMode="numeric"
              />
            </Field>
            <Field label={m.form_alias_label()}>
              <input
                className="tv-input"
                value={form.alias}
                onChange={(e) => set('alias', e.target.value)}
                placeholder={m.form_alias_ph()}
              />
            </Field>
            <Field label={m.form_customer_label()}>
              <CustomerCombobox
                value={form.customer}
                onChange={(v) => set('customer', v)}
                options={customers}
                placeholder={m.form_customer_ph()}
                commitMode="change"
                allowCreate
                aria-label={m.form_customer_label()}
              />
            </Field>
            <Field label={m.form_os_label()}>
              <CustomerCombobox
                value={form.osKey}
                onChange={(v) => set('osKey', v)}
                options={operatingSystems}
                placeholder={m.form_os_ph()}
                commitMode="change"
                allowCreate
                aria-label={m.form_os_label()}
              />
            </Field>
            <Field label={m.form_status_label()}>
              <select
                className="tv-select"
                style={{ width: '100%' }}
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
              >
                {DEVICE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={m.form_tags_label()}>
              <input
                className="tv-input"
                value={form.tags}
                onChange={(e) => set('tags', e.target.value)}
                placeholder={m.form_tags_ph()}
              />
            </Field>
            <Field label={m.form_password_label()} full>
              <input
                className="tv-input mono"
                type="password"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                placeholder={
                  device ? m.form_password_ph_edit() : m.form_password_ph_new()
                }
                autoComplete="new-password"
              />
            </Field>
            <Field label={m.form_notes_label()} full>
              <textarea
                className="tv-input"
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder={m.form_notes_ph()}
              />
            </Field>
          </div>

          <div className="tv-dialog__footer">
            <Dialog.Close asChild>
              <button
                type="button"
                className="tv-btn tv-btn--outline tv-btn--sm"
              >
                {m.common_cancel()}
              </button>
            </Dialog.Close>
            <button
              type="button"
              className="tv-btn tv-btn--default tv-btn--sm"
              onClick={submit}
              disabled={busy}
            >
              {device ? m.common_save() : m.common_add()}
            </button>
          </div>

          <Dialog.Close asChild>
            <button
              type="button"
              className="tv-btn tv-btn--ghost tv-btn--icon-sm"
              aria-label={m.common_close()}
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
