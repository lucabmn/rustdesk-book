import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertDialog, Dialog } from 'radix-ui'
import { Ban, Pencil, ShieldCheck, Trash2, Undo2, X } from 'lucide-react'

import { orpc } from '#/orpc/client'
import { roleLabel } from '#/lib/i18n-labels'
import { m } from '#/paraglide/messages'
import { useToast } from './toast'

type ManagedUser = {
  id: string
  name: string
  email: string
  role: 'admin' | 'member'
  banned: boolean
  banReason: string | null
  emailVerified: boolean
  deviceCount: number
  createdAt: string
}

/** Admin-only overview for editing, banning and deleting users. */
export function UsersDialog({
  open,
  onOpenChange,
  currentUserId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserId: string
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [editing, setEditing] = useState<ManagedUser | null>(null)
  const [banning, setBanning] = useState<ManagedUser | null>(null)
  const [deleting, setDeleting] = useState<ManagedUser | null>(null)

  const listQuery = useQuery(
    orpc.users.list.queryOptions({ input: {}, enabled: open }),
  )
  const users = listQuery.data ?? []
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: orpc.users.key() })

  const unbanMut = useMutation(
    orpc.users.unban.mutationOptions({
      onSuccess: () => {
        invalidate()
        toast(m.toast_user_unbanned())
      },
      onError: (e) => toast(e.message),
    }),
  )
  const removeMut = useMutation(
    orpc.users.remove.mutationOptions({
      onSuccess: () => {
        invalidate()
        toast(m.toast_user_deleted())
        setDeleting(null)
      },
      onError: (e) => {
        toast(e.message)
        setDeleting(null)
      },
    }),
  )

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="tv-dialog-overlay" />
        <Dialog.Content className="tv-dialog" style={{ maxWidth: 760 }}>
          <div className="tv-dialog__header">
            <Dialog.Title className="tv-dialog__title">{m.users_title()}</Dialog.Title>
            <Dialog.Description className="tv-dialog__description">
              {m.users_description()}
            </Dialog.Description>
          </div>

          {users.length === 0 ? (
            <span style={{ fontSize: 12.5, color: 'var(--fg-4)' }}>
              {listQuery.isLoading ? m.loading() : m.users_none()}
            </span>
          ) : (
            <div style={{ maxHeight: '58vh', overflowY: 'auto' }}>
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span
                              className="tv-avatar tv-avatar--sm"
                              style={{ background: 'var(--brand-soft)', color: 'var(--brand)', fontSize: 11 }}
                            >
                              {u.name.slice(0, 2).toUpperCase()}
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                {u.name}
                                {isSelf && (
                                  <span className="tv-badge tv-badge--secondary">
                                    {m.users_self_badge()}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>{u.email}</div>
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
                            {u.role === 'admin' && <ShieldCheck size={11} strokeWidth={2} />}
                            {roleLabel(u.role)}
                          </span>
                        </td>
                        <td>
                          {u.banned ? (
                            <span
                              className="tv-chip tv-chip--warn"
                              title={u.banReason ? m.users_banned_reason({ reason: u.banReason }) : undefined}
                            >
                              {m.users_status_banned()}
                            </span>
                          ) : (
                            <span className="tv-chip tv-chip--ok">{m.users_status_active()}</span>
                          )}
                        </td>
                        <td className="mono tnum" style={{ textAlign: 'right', color: 'var(--fg-2)' }}>
                          {u.deviceCount}
                        </td>
                        <td style={{ color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td>
                          <span style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            <button
                              className="tv-btn tv-btn--ghost tv-btn--icon-xs"
                              title={m.users_edit()}
                              onClick={() => setEditing(u)}
                            >
                              <Pencil size={13} />
                            </button>
                            {u.banned ? (
                              <button
                                className="tv-btn tv-btn--ghost tv-btn--icon-xs"
                                title={m.users_unban()}
                                onClick={() => unbanMut.mutate({ id: u.id })}
                              >
                                <Undo2 size={13} />
                              </button>
                            ) : (
                              <button
                                className="tv-btn tv-btn--ghost tv-btn--icon-xs"
                                title={m.users_ban()}
                                disabled={isSelf}
                                style={{ color: isSelf ? undefined : 'var(--s-warn)' }}
                                onClick={() => setBanning(u)}
                              >
                                <Ban size={13} />
                              </button>
                            )}
                            <button
                              className="tv-btn tv-btn--ghost tv-btn--icon-xs"
                              title={m.common_delete()}
                              disabled={isSelf}
                              style={{ color: isSelf ? undefined : 'var(--s-err)' }}
                              onClick={() => setDeleting(u)}
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
            </div>
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

      <EditUserDialog
        user={editing}
        canDemote={editing ? editing.id !== currentUserId : false}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={() => {
          invalidate()
          toast(m.toast_user_updated())
          setEditing(null)
        }}
      />
      <BanUserDialog
        user={banning}
        onOpenChange={(o) => !o && setBanning(null)}
        onBanned={() => {
          invalidate()
          toast(m.toast_user_banned())
          setBanning(null)
        }}
      />
      <AlertDialog.Root open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="tv-dialog-overlay" />
          <AlertDialog.Content className="tv-dialog" style={{ maxWidth: 400 }}>
            <div className="tv-dialog__header">
              <AlertDialog.Title className="tv-dialog__title">
                {m.users_delete_title()}
              </AlertDialog.Title>
              <AlertDialog.Description className="tv-dialog__description">
                {deleting ? m.users_delete_confirm({ name: deleting.name }) : ''}
              </AlertDialog.Description>
            </div>
            <div className="tv-dialog__footer">
              <AlertDialog.Cancel asChild>
                <button className="tv-btn tv-btn--outline tv-btn--sm">
                  {m.common_cancel()}
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  className="tv-btn tv-btn--destructive tv-btn--sm"
                  disabled={removeMut.isPending}
                  onClick={(e) => {
                    e.preventDefault()
                    if (deleting) removeMut.mutate({ id: deleting.id })
                  }}
                >
                  {m.common_delete()}
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </Dialog.Root>
  )
}

/* -------------------------------------------------------------------------- */

function EditUserDialog({
  user,
  canDemote,
  onOpenChange,
  onSaved,
}: {
  user: ManagedUser | null
  canDemote: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [role, setRole] = useState<'admin' | 'member'>('member')

  // Sync form state whenever a different user is opened.
  const [syncedId, setSyncedId] = useState<string | null>(null)
  if (user && user.id !== syncedId) {
    setSyncedId(user.id)
    setName(user.name)
    setRole(user.role)
  }

  const updateMut = useMutation(
    orpc.users.update.mutationOptions({
      onSuccess: onSaved,
      onError: (e) => toast(e.message),
    }),
  )

  return (
    <Dialog.Root open={user !== null} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="tv-dialog-overlay" />
        <Dialog.Content className="tv-dialog" style={{ maxWidth: 420 }}>
          <div className="tv-dialog__header">
            <Dialog.Title className="tv-dialog__title">{m.users_edit_title()}</Dialog.Title>
            <Dialog.Description className="tv-dialog__description">
              {m.users_edit_description()}
            </Dialog.Description>
          </div>

          <div className="tv-field">
            <label className="tv-label" htmlFor="user-name">{m.common_name()}</label>
            <input
              id="user-name"
              className="tv-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="tv-field">
            <label className="tv-label" htmlFor="user-email">{m.common_email()}</label>
            <input id="user-email" className="tv-input" value={user?.email ?? ''} disabled />
          </div>
          <div className="tv-field">
            <label className="tv-label" htmlFor="user-role">{m.users_role_label()}</label>
            <select
              id="user-role"
              className="tv-select"
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'member')}
              disabled={user?.role === 'admin' && !canDemote}
            >
              <option value="member">{m.common_role_member()}</option>
              <option value="admin">{m.common_role_admin()}</option>
            </select>
          </div>

          <div className="tv-dialog__footer">
            <Dialog.Close asChild>
              <button className="tv-btn tv-btn--outline tv-btn--sm">{m.common_cancel()}</button>
            </Dialog.Close>
            <button
              className="tv-btn tv-btn--default tv-btn--sm"
              disabled={!name.trim() || updateMut.isPending}
              onClick={() =>
                user && updateMut.mutate({ id: user.id, name: name.trim(), role })
              }
            >
              {m.common_save()}
            </button>
          </div>

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

function BanUserDialog({
  user,
  onOpenChange,
  onBanned,
}: {
  user: ManagedUser | null
  onOpenChange: (open: boolean) => void
  onBanned: () => void
}) {
  const { toast } = useToast()
  const [reason, setReason] = useState('')

  const [syncedId, setSyncedId] = useState<string | null>(null)
  if (user && user.id !== syncedId) {
    setSyncedId(user.id)
    setReason('')
  }

  const banMut = useMutation(
    orpc.users.ban.mutationOptions({
      onSuccess: onBanned,
      onError: (e) => toast(e.message),
    }),
  )

  return (
    <Dialog.Root open={user !== null} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="tv-dialog-overlay" />
        <Dialog.Content className="tv-dialog" style={{ maxWidth: 420 }}>
          <div className="tv-dialog__header">
            <Dialog.Title className="tv-dialog__title">{m.users_ban_title()}</Dialog.Title>
            <Dialog.Description className="tv-dialog__description">
              {user ? m.users_ban_description({ name: user.name }) : ''}
            </Dialog.Description>
          </div>

          <div className="tv-field">
            <label className="tv-label" htmlFor="ban-reason">{m.users_ban_reason_label()}</label>
            <input
              id="ban-reason"
              className="tv-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={m.users_ban_reason_ph()}
            />
          </div>

          <div className="tv-dialog__footer">
            <Dialog.Close asChild>
              <button className="tv-btn tv-btn--outline tv-btn--sm">{m.common_cancel()}</button>
            </Dialog.Close>
            <button
              className="tv-btn tv-btn--destructive tv-btn--sm"
              disabled={banMut.isPending}
              onClick={() =>
                user && banMut.mutate({ id: user.id, reason: reason.trim() || undefined })
              }
            >
              <Ban size={13} />
              {m.users_ban_confirm()}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
