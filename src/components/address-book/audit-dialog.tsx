import { useQuery } from '@tanstack/react-query'
import { Dialog } from 'radix-ui'
import { X } from 'lucide-react'

import { orpc } from '#/orpc/client'
import { auditActionLabel } from '#/lib/i18n-labels'
import { formatRustdeskId } from '#/lib/device-meta'
import { m } from '#/paraglide/messages'

/** Admin-only view of the reveal/connect audit trail. */
export function AuditDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const query = useQuery(
    orpc.audit.list.queryOptions({ input: {}, enabled: open }),
  )
  const entries = query.data ?? []

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="tv-dialog-overlay" />
        <Dialog.Content className="tv-dialog" style={{ maxWidth: 640 }}>
          <div className="tv-dialog__header">
            <Dialog.Title className="tv-dialog__title">
              {m.audit_title()}
            </Dialog.Title>
            <Dialog.Description className="tv-dialog__description">
              {m.audit_description()}
            </Dialog.Description>
          </div>

          {entries.length === 0 ? (
            <span style={{ fontSize: 12.5, color: 'var(--fg-4)' }}>
              {m.audit_none()}
            </span>
          ) : (
            <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
              <table className="tv-table">
                <thead>
                  <tr>
                    <th>{m.audit_th_time()}</th>
                    <th>{m.th_action()}</th>
                    <th>{m.audit_th_device()}</th>
                    <th>{m.audit_th_user()}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td
                        style={{ color: 'var(--fg-3)', whiteSpace: 'nowrap' }}
                      >
                        {new Date(e.createdAt).toLocaleString()}
                      </td>
                      <td>
                        <span
                          className={
                            e.action === 'connect'
                              ? 'tv-chip tv-chip--info'
                              : 'tv-chip tv-chip--warn'
                          }
                        >
                          {auditActionLabel(e.action)}
                        </span>
                      </td>
                      <td>
                        {e.deviceAlias ? (
                          <span>
                            <span style={{ fontWeight: 600 }}>
                              {e.deviceAlias}
                            </span>{' '}
                            <span
                              className="mono"
                              style={{ color: 'var(--fg-3)', fontSize: 11.5 }}
                            >
                              {e.deviceRustdeskId
                                ? formatRustdeskId(e.deviceRustdeskId)
                                : ''}
                            </span>
                          </span>
                        ) : (
                          <span style={{ color: 'var(--fg-4)' }}>—</span>
                        )}
                      </td>
                      <td style={{ color: 'var(--fg-2)' }}>
                        {e.userName ?? e.userEmail ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

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
