import { useEffect, useState } from 'react'

import {
  Button,
  Dialog,
  DialogBody,
  Field,
  Input,
  Select,
  Textarea,
} from '#/components/ui'
import { DEVICE_STATUSES, osLabel } from '#/lib/device-meta'
import { statusLabel } from '#/lib/i18n-labels'
import type { Device, DeviceInput } from '#/orpc/schema'
import { m } from '#/paraglide/messages'
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

  function submit(e: React.FormEvent) {
    e.preventDefault()
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
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={device ? m.form_edit_title() : m.form_add_title()}
      description={m.form_description()}
      width={520}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>
            {m.common_cancel()}
          </Button>
          <Button
            variant="accent"
            type="submit"
            form="device-form"
            disabled={busy}
          >
            {device ? m.common_save() : m.common_add()}
          </Button>
        </>
      }
    >
      <DialogBody>
        <form
          id="device-form"
          onSubmit={submit}
          className="grid grid-cols-2 gap-3"
        >
          <Field label={m.form_id_label()} htmlFor="f-id">
            <Input
              id="f-id"
              className="tnum font-mono"
              value={form.rustdeskId}
              onChange={(e) => set('rustdeskId', e.target.value)}
              placeholder="123456789"
              inputMode="numeric"
            />
          </Field>
          <Field label={m.form_alias_label()} htmlFor="f-alias">
            <Input
              id="f-alias"
              value={form.alias}
              onChange={(e) => set('alias', e.target.value)}
              placeholder={m.form_alias_ph()}
            />
          </Field>

          <Field label={m.form_customer_label()} htmlFor="f-customer">
            <CustomerCombobox
              id="f-customer"
              value={form.customer}
              onChange={(v) => set('customer', v)}
              options={customers}
              placeholder={m.form_customer_ph()}
              commitMode="change"
              allowCreate
              aria-label={m.form_customer_label()}
            />
          </Field>
          <Field label={m.form_os_label()} htmlFor="f-os">
            <CustomerCombobox
              id="f-os"
              value={form.osKey}
              onChange={(v) => set('osKey', v)}
              options={operatingSystems}
              placeholder={m.form_os_ph()}
              commitMode="change"
              allowCreate
              aria-label={m.form_os_label()}
            />
          </Field>

          <Field label={m.form_status_label()} htmlFor="f-status">
            <Select
              id="f-status"
              value={form.status}
              onChange={(e) => set('status', e.target.value)}
            >
              {DEVICE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={m.form_tags_label()} htmlFor="f-tags">
            <Input
              id="f-tags"
              value={form.tags}
              onChange={(e) => set('tags', e.target.value)}
              placeholder={m.form_tags_ph()}
            />
          </Field>

          <Field
            label={m.form_password_label()}
            htmlFor="f-password"
            className="col-span-2"
          >
            <Input
              id="f-password"
              type="password"
              className="font-mono"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              placeholder={
                device ? m.form_password_ph_edit() : m.form_password_ph_new()
              }
              autoComplete="new-password"
            />
          </Field>
          <Field
            label={m.form_notes_label()}
            htmlFor="f-notes"
            className="col-span-2"
          >
            <Textarea
              id="f-notes"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder={m.form_notes_ph()}
            />
          </Field>
        </form>
      </DialogBody>
    </Dialog>
  )
}
