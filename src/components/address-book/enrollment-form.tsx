import { useState } from 'react'
import { Laptop } from 'lucide-react'

import { Button, Field, Input, Select, Textarea } from '#/components/ui'
import { m } from '#/paraglide/messages'
import { CustomerCombobox } from './customer-combobox'

export interface EnrollmentFormValues {
  name: string
  kind: 'single' | 'permanent'
  installIfMissing: boolean
  customer: string
  tags: string[]
  rustdeskConfig: string
}

export interface EnrollmentFormProps {
  customerNames: string[]
  busy: boolean
  onSubmit: (values: EnrollmentFormValues) => void
}

/** The "issue a new enrollment token" form. Owns its own field state. */
export function EnrollmentForm({
  customerNames,
  busy,
  onSubmit,
}: EnrollmentFormProps) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'single' | 'permanent'>('single')
  const [installIfMissing, setInstallIfMissing] = useState(true)
  const [customer, setCustomer] = useState('')
  const [tags, setTags] = useState('')
  const [rustdeskConfig, setRustdeskConfig] = useState('')

  function submit() {
    onSubmit({
      name: name.trim(),
      kind,
      installIfMissing,
      customer: customer.trim(),
      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      rustdeskConfig: rustdeskConfig.trim(),
    })
    setName('')
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label={m.enrollment_name()} htmlFor="enrollment-name">
          <Input
            id="enrollment-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={m.enrollment_name_placeholder()}
          />
        </Field>
        <Field label={m.enrollment_type()} htmlFor="enrollment-kind">
          <Select
            id="enrollment-kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as typeof kind)}
          >
            <option value="single">{m.enrollment_type_single()}</option>
            <option value="permanent">{m.enrollment_type_permanent()}</option>
          </Select>
        </Field>

        <Field label={m.form_customer_label()} htmlFor="enrollment-customer">
          <CustomerCombobox
            id="enrollment-customer"
            value={customer}
            onChange={setCustomer}
            options={customerNames}
            placeholder={m.form_customer_ph()}
            commitMode="change"
            allowCreate
            className="h-8 text-sm"
            aria-label={m.form_customer_label()}
          />
        </Field>
        <Field label={m.form_tags_label()} htmlFor="enrollment-tags">
          <Input
            id="enrollment-tags"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder={m.form_tags_ph()}
          />
        </Field>

        <Field
          label={m.enrollment_config()}
          htmlFor="enrollment-config"
          hint={m.enrollment_config_hint()}
          className="col-span-2"
        >
          <Textarea
            id="enrollment-config"
            value={rustdeskConfig}
            onChange={(event) => setRustdeskConfig(event.target.value)}
            placeholder={m.enrollment_config_placeholder()}
            className="min-h-16 font-mono text-xs"
          />
        </Field>
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-line bg-sunken p-2.5">
        <input
          type="checkbox"
          checked={installIfMissing}
          onChange={(event) => setInstallIfMissing(event.target.checked)}
          className="mt-px size-3.5 accent-accent"
        />
        <span>
          <span className="block font-medium text-text text-xs">
            {m.enrollment_install_missing()}
          </span>
          <span className="block text-2xs text-muted">
            {m.enrollment_install_missing_hint()}
          </span>
        </span>
      </label>

      <Button
        variant="accent"
        size="md"
        className="self-start"
        disabled={!name.trim() || busy}
        onClick={submit}
      >
        <Laptop /> {m.enrollment_create()}
      </Button>
    </div>
  )
}
