import { Badge, Section } from '#/components/ui'
import { formatLastSeen } from '#/lib/format'
import { auditActionLabel } from '#/lib/i18n-labels'
import { m } from '#/paraglide/messages'

export interface HistoryEntry {
  id: string
  action: string
  createdAt: string
  userName: string | null
  userEmail: string | null
}

/** Connect / reveal history for one device, most recent first. */
export function DeviceHistoryList({ history }: { history: HistoryEntry[] }) {
  return (
    <Section title={m.drawer_history()}>
      {history.length === 0 ? (
        <p className="text-faint text-xs">{m.drawer_history_none()}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {history.map((h) => (
            <li key={h.id} className="flex items-center gap-2 text-xs">
              {/* A revealed password is the entry worth noticing, so it alone
                  carries a warning tone. */}
              <Badge tone={h.action === 'connect' ? 'neutral' : 'warn'}>
                {auditActionLabel(h.action)}
              </Badge>
              <span className="min-w-0 flex-1 truncate text-muted">
                {h.userName ?? h.userEmail ?? '—'}
              </span>
              <span className="tnum whitespace-nowrap text-faint">
                {formatLastSeen(h.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
