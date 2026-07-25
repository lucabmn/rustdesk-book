import { Ban, Pencil, ShieldCheck, Trash2, Undo2 } from 'lucide-react'

import {
  Avatar,
  Badge,
  Button,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from '#/components/ui'
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
    <Table className="min-w-[680px]">
      <THead>
        <TH>{m.users_th_user()}</TH>
        <TH>{m.users_th_role()}</TH>
        <TH>{m.users_th_status()}</TH>
        <TH align="right">{m.users_th_devices()}</TH>
        <TH>{m.users_th_joined()}</TH>
        <TH align="right">{m.th_action()}</TH>
      </THead>
      <TBody>
        {users.map((u) => {
          // An admin must not be able to lock or delete themselves out.
          const isSelf = u.id === currentUserId
          return (
            <TR key={u.id}>
              <TD>
                <div className="flex items-center gap-2.5 py-1">
                  <Avatar initials={u.name.slice(0, 2).toUpperCase()} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-medium">
                      {u.name}
                      {isSelf && <Badge>{m.users_self_badge()}</Badge>}
                    </div>
                    <div className="truncate text-2xs text-muted">
                      {u.email}
                    </div>
                  </div>
                </div>
              </TD>
              <TD>
                <Badge tone={u.role === 'admin' ? 'accent' : 'neutral'}>
                  {u.role === 'admin' && <ShieldCheck className="size-3" />}
                  {roleLabel(u.role)}
                </Badge>
              </TD>
              <TD>
                {u.banned ? (
                  <Badge
                    tone="warn"
                    title={
                      u.banReason
                        ? m.users_banned_reason({ reason: u.banReason })
                        : undefined
                    }
                  >
                    {m.users_status_banned()}
                  </Badge>
                ) : (
                  <Badge tone="ok">{m.users_status_active()}</Badge>
                )}
              </TD>
              <TD className="tnum text-right text-muted">{u.deviceCount}</TD>
              <TD className="tnum whitespace-nowrap text-muted">
                {new Date(u.createdAt).toLocaleDateString()}
              </TD>
              <TD>
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    title={m.users_edit()}
                    aria-label={m.users_edit()}
                    onClick={() => onEdit(u)}
                  >
                    <Pencil />
                  </Button>
                  {u.banned ? (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      title={m.users_unban()}
                      aria-label={m.users_unban()}
                      onClick={() => onUnban(u)}
                    >
                      <Undo2 />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      title={m.users_ban()}
                      aria-label={m.users_ban()}
                      disabled={isSelf}
                      className="hover:bg-warn-soft hover:text-warn"
                      onClick={() => onBan(u)}
                    >
                      <Ban />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    title={m.common_delete()}
                    aria-label={m.common_delete()}
                    disabled={isSelf}
                    className="hover:bg-danger-soft hover:text-danger"
                    onClick={() => onDelete(u)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </TD>
            </TR>
          )
        })}
      </TBody>
    </Table>
  )
}
