import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog } from 'radix-ui'
import { Copy, Download, Laptop, Plus, ShieldOff, Trash2, X } from 'lucide-react'

import { orpc } from '#/orpc/client'
import { m } from '#/paraglide/messages'
import { CustomerCombobox } from './customer-combobox'
import { useToast } from './toast'

type Platform = 'windows' | 'linux' | 'macos'

type CreatedEnrollment = {
  id: string
  kind: 'single' | 'permanent'
  rustdeskVersion: string
  scripts: Record<Platform, string>
}

const PLATFORMS: Array<{ id: Platform; label: string; extension: string }> = [
  { id: 'windows', label: 'Windows', extension: 'ps1' },
  { id: 'linux', label: 'Linux', extension: 'sh' },
  { id: 'macos', label: 'macOS', extension: 'sh' },
]

export function EnrollmentDialog({
  open,
  onOpenChange,
  customerNames,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerNames: string[]
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'single' | 'permanent'>('single')
  const [installIfMissing, setInstallIfMissing] = useState(true)
  const [customer, setCustomer] = useState('')
  const [tags, setTags] = useState('')
  const [rustdeskConfig, setRustdeskConfig] = useState('')
  const [created, setCreated] = useState<CreatedEnrollment | null>(null)
  const [scriptSaved, setScriptSaved] = useState(false)
  const [platform, setPlatform] = useState<Platform>('windows')

  const listQuery = useQuery(
    orpc.enrollments.list.queryOptions({ input: {}, enabled: open }),
  )
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: orpc.enrollments.key() })

  const createMut = useMutation(
    orpc.enrollments.create.mutationOptions({
      onSuccess: (result) => {
        setCreated(result)
        setScriptSaved(false)
        setPlatform('windows')
        setName('')
        invalidate()
        toast(m.enrollment_created())
      },
      onError: (error) => toast(error.message),
    }),
  )
  const scriptsMut = useMutation(
    orpc.enrollments.scripts.mutationOptions({
      onSuccess: (result) => {
        setCreated(result)
        setScriptSaved(false)
        setPlatform('windows')
        if (result.rotated) toast(m.enrollment_token_rotated())
      },
      onError: (error) => toast(error.message),
    }),
  )
  const revokeMut = useMutation(
    orpc.enrollments.revoke.mutationOptions({
      onSuccess: () => {
        invalidate()
        toast(m.enrollment_revoked())
      },
      onError: (error) => toast(error.message),
    }),
  )
  const removeMut = useMutation(
    orpc.enrollments.remove.mutationOptions({
      onSuccess: () => {
        invalidate()
        toast(m.enrollment_deleted())
      },
      onError: (error) => toast(error.message),
    }),
  )

  function createToken() {
    createMut.mutate({
      name: name.trim(),
      kind,
      installIfMissing,
      customer: customer.trim(),
      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      rustdeskConfig: rustdeskConfig.trim(),
      baseUrl: window.location.origin,
    })
  }

  async function copyScript() {
    if (!created) return
    try {
      await navigator.clipboard.writeText(created.scripts[platform])
      setScriptSaved(true)
      toast(m.enrollment_script_copied())
    } catch {
      toast(m.enrollment_copy_failed())
    }
  }

  function downloadScript() {
    if (!created) return
    const meta = PLATFORMS.find((item) => item.id === platform)!
    const blob = new Blob([created.scripts[platform]], { type: 'text/plain' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `rustdesk-book-deploy-${platform}.${meta.extension}`
    link.click()
    setScriptSaved(true)
    setTimeout(() => URL.revokeObjectURL(link.href), 1000)
  }

  const currentScript = created?.scripts[platform] ?? ''

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (
          !next &&
          created?.kind === 'single' &&
          !scriptSaved &&
          !window.confirm(m.enrollment_close_warning())
        ) {
          return
        }
        onOpenChange(next)
        if (!next) setCreated(null)
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="tv-dialog-overlay" />
        <Dialog.Content className="tv-dialog" style={{ maxWidth: 760, maxHeight: '90vh' }}>
          <div className="tv-dialog__header">
            <Dialog.Title className="tv-dialog__title">
              {m.enrollment_title()}
            </Dialog.Title>
            <Dialog.Description className="tv-dialog__description">
              {m.enrollment_description()}
            </Dialog.Description>
          </div>

          {created ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--s-warn)',
                  background: 'color-mix(in srgb, var(--s-warn) 10%, transparent)',
                  fontSize: 12,
                }}
              >
                <strong>
                  {created.kind === 'permanent'
                    ? m.enrollment_token_permanent_title()
                    : m.enrollment_token_once_title()}
                </strong>{' '}
                {created.kind === 'permanent'
                  ? m.enrollment_token_permanent_hint()
                  : m.enrollment_token_once_hint()}
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {PLATFORMS.map((item) => (
                  <button
                    key={item.id}
                    className={`tv-btn tv-btn--sm ${platform === item.id ? 'tv-btn--default' : 'tv-btn--ghost'}`}
                    onClick={() => setPlatform(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
                <span style={{ flex: 1 }} />
                <button className="tv-btn tv-btn--ghost tv-btn--sm" onClick={copyScript}>
                  <Copy size={13} /> {m.enrollment_copy_script()}
                </button>
                <button className="tv-btn tv-btn--ghost tv-btn--sm" onClick={downloadScript}>
                  <Download size={13} /> {m.enrollment_download_script()}
                </button>
              </div>

              <textarea
                className="tv-input"
                readOnly
                value={currentScript}
                aria-label={m.enrollment_script_label()}
                style={{
                  minHeight: 300,
                  resize: 'vertical',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 11,
                  lineHeight: 1.45,
                  whiteSpace: 'pre',
                }}
              />
              <div style={{ fontSize: 11.5, color: 'var(--fg-4)' }}>
                {platform === 'windows'
                  ? m.enrollment_run_windows()
                  : m.enrollment_run_unix()}
              </div>
              <button className="tv-btn tv-btn--default tv-btn--sm" onClick={() => setCreated(null)}>
                <Plus size={13} /> {m.enrollment_create_another()}
              </button>
            </div>
          ) : (
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
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--fg-4)' }}>
                      {m.enrollment_install_missing_hint()}
                    </span>
                  </span>
                </label>
              </div>

              <button
                className="tv-btn tv-btn--default tv-btn--sm"
                disabled={!name.trim() || createMut.isPending}
                onClick={createToken}
                style={{ alignSelf: 'flex-start' }}
              >
                <Laptop size={14} /> {m.enrollment_create()}
              </button>

              <div style={{ borderTop: '1px solid var(--bd-1)', paddingTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                  {m.enrollment_existing()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {listQuery.data?.length === 0 && (
                    <span style={{ fontSize: 12, color: 'var(--fg-4)' }}>
                      {m.enrollment_none()}
                    </span>
                  )}
                  {listQuery.data?.map((token) => {
                    const inactive = Boolean(token.revokedAt) ||
                      (token.kind === 'single' && token.useCount > 0)
                    return (
                      <div
                        key={token.id}
                        style={{
                          display: 'flex',
                          gap: 10,
                          alignItems: 'center',
                          padding: '8px 10px',
                          border: '1px solid var(--bd-1)',
                          borderRadius: 6,
                          background: 'var(--bg-sunken)',
                          opacity: inactive ? 0.65 : 1,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                            <strong style={{ fontSize: 12.5 }}>{token.name}</strong>
                            <span className="tv-chip">
                              {token.kind === 'single'
                                ? m.enrollment_type_single_short()
                                : m.enrollment_type_permanent_short()}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 2 }}>
                            {token.tokenPrefix} · {m.enrollment_uses({ count: token.useCount })}
                            {token.customer ? ` · ${token.customer}` : ''}
                            {inactive ? ` · ${m.enrollment_inactive()}` : ''}
                          </div>
                        </div>
                        {token.kind === 'permanent' && !token.revokedAt && (
                          <button
                            className="tv-btn tv-btn--ghost tv-btn--icon-xs"
                            title={m.enrollment_download_again()}
                            aria-label={m.enrollment_download_again()}
                            disabled={scriptsMut.isPending}
                            onClick={() =>
                              scriptsMut.mutate({
                                id: token.id,
                                baseUrl: window.location.origin,
                              })
                            }
                          >
                            <Download size={14} />
                          </button>
                        )}
                        {!token.revokedAt && (
                          <button
                            className="tv-btn tv-btn--ghost tv-btn--icon-xs"
                            title={m.enrollment_revoke()}
                            aria-label={m.enrollment_revoke()}
                            style={{ color: 'var(--s-err)' }}
                            onClick={() => revokeMut.mutate({ id: token.id })}
                          >
                            <ShieldOff size={14} />
                          </button>
                        )}
                        <button
                          className="tv-btn tv-btn--ghost tv-btn--icon-xs"
                          title={m.enrollment_delete()}
                          aria-label={m.enrollment_delete()}
                          style={{ color: 'var(--s-err)' }}
                          disabled={removeMut.isPending}
                          onClick={() => {
                            if (window.confirm(m.enrollment_delete_confirm({ name: token.name }))) {
                              removeMut.mutate({ id: token.id })
                            }
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          <Dialog.Close asChild>
            <button
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
