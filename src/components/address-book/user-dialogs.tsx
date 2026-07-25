import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Dialog } from 'radix-ui'
import { Ban, X } from 'lucide-react'

import { orpc } from '#/orpc/client'
import { m } from '#/paraglide/messages'
import { useToast } from './toast'
import type { ManagedUser } from './users-dialog'

/** Edit and ban dialogs opened from the user overview. */

export function EditUserDialog({
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
            <Dialog.Title className="tv-dialog__title">
              {m.users_edit_title()}
            </Dialog.Title>
            <Dialog.Description className="tv-dialog__description">
              {m.users_edit_description()}
            </Dialog.Description>
          </div>

          <div className="tv-field">
            <label className="tv-label" htmlFor="user-name">
              {m.common_name()}
            </label>
            <input
              id="user-name"
              className="tv-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="tv-field">
            <label className="tv-label" htmlFor="user-email">
              {m.common_email()}
            </label>
            <input
              id="user-email"
              className="tv-input"
              value={user?.email ?? ''}
              disabled
            />
          </div>
          <div className="tv-field">
            <label className="tv-label" htmlFor="user-role">
              {m.users_role_label()}
            </label>
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
              <button
                type="button"
                className="tv-btn tv-btn--outline tv-btn--sm"
              >
                {m.common_cancel()}
              </button>
            </Dialog.Close>
            <button
              type="button"
              className="tv-btn tv-btn--default tv-btn--sm"
              disabled={!name.trim() || updateMut.isPending}
              onClick={() =>
                user &&
                updateMut.mutate({ id: user.id, name: name.trim(), role })
              }
            >
              {m.common_save()}
            </button>
          </div>

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

export function BanUserDialog({
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
            <Dialog.Title className="tv-dialog__title">
              {m.users_ban_title()}
            </Dialog.Title>
            <Dialog.Description className="tv-dialog__description">
              {user ? m.users_ban_description({ name: user.name }) : ''}
            </Dialog.Description>
          </div>

          <div className="tv-field">
            <label className="tv-label" htmlFor="ban-reason">
              {m.users_ban_reason_label()}
            </label>
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
              <button
                type="button"
                className="tv-btn tv-btn--outline tv-btn--sm"
              >
                {m.common_cancel()}
              </button>
            </Dialog.Close>
            <button
              type="button"
              className="tv-btn tv-btn--destructive tv-btn--sm"
              disabled={banMut.isPending}
              onClick={() =>
                user &&
                banMut.mutate({
                  id: user.id,
                  reason: reason.trim() || undefined,
                })
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
