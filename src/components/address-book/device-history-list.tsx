import { auditActionLabel } from '#/lib/i18n-labels'
import { formatLastSeen } from '#/lib/format'
import { m } from '#/paraglide/messages'
import { Section } from './drawer-parts'

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
        <span style={{ fontSize: 12.5, color: 'var(--fg-4)' }}>
          {m.drawer_history_none()}
        </span>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {history.map((h) => (
            <div
              key={h.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
              }}
            >
              <span
                className={
                  h.action === 'connect'
                    ? 'tv-chip tv-chip--info'
                    : 'tv-chip tv-chip--warn'
                }
              >
                {auditActionLabel(h.action)}
              </span>
              <span
                style={{
                  color: 'var(--fg-2)',
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {h.userName ?? h.userEmail ?? '—'}
              </span>
              <span
                style={{
                  color: 'var(--fg-4)',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatLastSeen(h.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}
