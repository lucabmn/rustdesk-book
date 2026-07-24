import { Ban, Pencil, ShieldCheck, Trash2, Undo2 } from 'lucide-react'

import { roleLabel } from '#/lib/i18n-labels'
import { m } from '#/paraglide/messages'
import type { ManagedUser } from './users-dialog'

export interface UserTableProps {
  users: ManagedUser[]
  currentUserId: string
  onEdit: (user: ManagedUser) => void
  onBan: (user: ManagedUser) => void
  onUnban: (user: ManagedUser) => void
  onDelete: (user: ManagedUser) => void
}

/** The user overview table, including the per-row admin actions. */
export function UserTable({
  users,
  currentUserId,
  onEdit,
  onBan,
  onUnban,
  onDelete,
}: UserTableProps) {
  return (
    <table className="tv-table" style={{ minWidth: 680 }}>
      <thead>
        <tr>
          <th>{m.users_th_user()}</th>
          <th>{m.users_th_role()}</th>
          <th>{m.users_th_status()}</th>
          <th style={{ textAlign: 'right' }}>{m.users_th_devices()}</th>
          <th>{m.users_th_joined()}</th>
          <th style={{ textAlign: 'right' }}>{m.th_action()}</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => {
          const isSelf = u.id === currentUserId
          return (
            <tr key={u.id}>
              <td>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <span
                    className="tv-avatar tv-avatar--sm"
                    style={{
                      background: 'var(--brand-soft)',
                      color: 'var(--brand)',
                      fontSize: 11,
                    }}
                  >
                    {u.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {u.name}
                      {isSelf && (
                        <span className="tv-badge tv-badge--secondary">
                          {m.users_self_badge()}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
                      {u.email}
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <span
                  className={
                    u.role === 'admin'
                      ? 'tv-chip tv-chip--info'
                      : 'tv-chip tv-chip--neutral'
                  }
                >
                  {u.role === 'admin' && (
                    <ShieldCheck size={11} strokeWidth={2} />
                  )}
                  {roleLabel(u.role)}
                </span>
              </td>
              <td>
                {u.banned ? (
                  <span
                    className="tv-chip tv-chip--warn"
                    title={
                      u.banReason
                        ? m.users_banned_reason({
                            reason: u.banReason,
                          })
                        : undefined
                    }
                  >
                    {m.users_status_banned()}
                  </span>
                ) : (
                  <span className="tv-chip tv-chip--ok">
                    {m.users_status_active()}
                  </span>
                )}
              </td>
              <td
                className="mono tnum"
                style={{ textAlign: 'right', color: 'var(--fg-2)' }}
              >
                {u.deviceCount}
              </td>
              <td style={{ color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>
                {new Date(u.createdAt).toLocaleDateString()}
              </td>
              <td>
                <span
                  style={{
                    display: 'flex',
                    gap: 4,
                    justifyContent: 'flex-end',
                  }}
                >
                  <button
                    type="button"
                    className="tv-btn tv-btn--ghost tv-btn--icon-xs"
                    title={m.users_edit()}
                    onClick={() => onEdit(u)}
                  >
                    <Pencil size={13} />
                  </button>
                  {u.banned ? (
                    <button
                      type="button"
                      className="tv-btn tv-btn--ghost tv-btn--icon-xs"
                      title={m.users_unban()}
                      onClick={() => onUnban(u)}
                    >
                      <Undo2 size={13} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="tv-btn tv-btn--ghost tv-btn--icon-xs"
                      title={m.users_ban()}
                      disabled={isSelf}
                      style={{
                        color: isSelf ? undefined : 'var(--s-warn)',
                      }}
                      onClick={() => onBan(u)}
                    >
                      <Ban size={13} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="tv-btn tv-btn--ghost tv-btn--icon-xs"
                    title={m.common_delete()}
                    disabled={isSelf}
                    style={{
                      color: isSelf ? undefined : 'var(--s-err)',
                    }}
                    onClick={() => onDelete(u)}
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
