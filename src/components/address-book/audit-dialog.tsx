import { useQuery } from '@tanstack/react-query'

import {
  Badge,
  Dialog,
  DialogBody,
  EmptyState,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from '#/components/ui'
import { formatRustdeskId } from '#/lib/device-meta'
import { auditActionLabel } from '#/lib/i18n-labels'
import { orpc } from '#/orpc/client'
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
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={m.audit_title()}
      description={m.audit_description()}
      width={720}
    >
      <DialogBody>
        {entries.length === 0 ? (
          <EmptyState>{m.audit_none()}</EmptyState>
        ) : (
          <Table>
            <THead>
              <TH>{m.audit_th_time()}</TH>
              <TH>{m.th_action()}</TH>
              <TH>{m.audit_th_device()}</TH>
              <TH>{m.audit_th_user()}</TH>
            </THead>
            <TBody>
              {entries.map((e) => (
                <TR key={e.id}>
                  <TD className="tnum whitespace-nowrap text-muted">
                    {new Date(e.createdAt).toLocaleString()}
                  </TD>
                  <TD>
                    <Badge tone={e.action === 'connect' ? 'neutral' : 'warn'}>
                      {auditActionLabel(e.action)}
                    </Badge>
                  </TD>
                  <TD>
                    {e.deviceAlias ? (
                      <span className="flex items-baseline gap-1.5">
                        <span className="font-medium">{e.deviceAlias}</span>
                        <span className="tnum font-mono text-2xs text-faint">
                          {e.deviceRustdeskId
                            ? formatRustdeskId(e.deviceRustdeskId)
                            : ''}
                        </span>
                      </span>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </TD>
                  <TD className="text-muted">
                    {e.userName ?? e.userEmail ?? '—'}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </DialogBody>
    </Dialog>
  )
}
