import { useState } from 'react'
import { Laptop } from 'lucide-react'

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
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
        }}
      >
        <div className="tv-field">
          <label className="tv-label" htmlFor="enrollment-name">
            {m.enrollment_name()}
          </label>
          <input
            id="enrollment-name"
            className="tv-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={m.enrollment_name_placeholder()}
          />
        </div>
        <div className="tv-field">
          <label className="tv-label" htmlFor="enrollment-kind">
            {m.enrollment_type()}
          </label>
          <select
            id="enrollment-kind"
            className="tv-select"
            value={kind}
            onChange={(event) => setKind(event.target.value as typeof kind)}
          >
            <option value="single">{m.enrollment_type_single()}</option>
            <option value="permanent">{m.enrollment_type_permanent()}</option>
          </select>
        </div>
        <div className="tv-field">
          <label className="tv-label" htmlFor="enrollment-customer">
            {m.form_customer_label()}
          </label>
          <CustomerCombobox
            id="enrollment-customer"
            value={customer}
            onChange={setCustomer}
            options={customerNames}
            placeholder={m.form_customer_ph()}
            commitMode="change"
            allowCreate
            aria-label={m.form_customer_label()}
          />
        </div>
        <div className="tv-field">
          <label className="tv-label" htmlFor="enrollment-tags">
            {m.form_tags_label()}
          </label>
          <input
            id="enrollment-tags"
            className="tv-input"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder={m.form_tags_ph()}
          />
        </div>
        <div className="tv-field" style={{ gridColumn: '1 / -1' }}>
          <label className="tv-label" htmlFor="enrollment-config">
            {m.enrollment_config()}
          </label>
          <textarea
            id="enrollment-config"
            className="tv-input"
            value={rustdeskConfig}
            onChange={(event) => setRustdeskConfig(event.target.value)}
            placeholder={m.enrollment_config_placeholder()}
            style={{ minHeight: 62, resize: 'vertical' }}
          />
          <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>
            {m.enrollment_config_hint()}
          </span>
        </div>
        <label
          style={{
            gridColumn: '1 / -1',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={installIfMissing}
            onChange={(event) => setInstallIfMissing(event.target.checked)}
          />
          <span>
            <strong>{m.enrollment_install_missing()}</strong>
            <span
              style={{
                display: 'block',
                fontSize: 11,
                color: 'var(--fg-4)',
              }}
            >
              {m.enrollment_install_missing_hint()}
            </span>
          </span>
        </label>
      </div>

      <button
        type="button"
        className="tv-btn tv-btn--default tv-btn--sm"
        disabled={!name.trim() || busy}
        onClick={submit}
        style={{ alignSelf: 'flex-start' }}
      >
        <Laptop size={14} /> {m.enrollment_create()}
      </button>
    </>
  )
}
