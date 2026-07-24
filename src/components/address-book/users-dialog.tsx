import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertDialog, Dialog } from 'radix-ui'
import { X } from 'lucide-react'

import { orpc } from '#/orpc/client'
import { m } from '#/paraglide/messages'
import { useToast } from './toast'
import { BanUserDialog, EditUserDialog } from './user-dialogs'
import { UserTable } from './user-table'

export type ManagedUser = {
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
            <Dialog.Title className="tv-dialog__title">
              {m.users_title()}
            </Dialog.Title>
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
              <UserTable
                users={users}
                currentUserId={currentUserId}
                onEdit={setEditing}
                onBan={setBanning}
                onUnban={(user) => unbanMut.mutate({ id: user.id })}
                onDelete={setDeleting}
              />
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
      <AlertDialog.Root
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="tv-dialog-overlay" />
          <AlertDialog.Content className="tv-dialog" style={{ maxWidth: 400 }}>
            <div className="tv-dialog__header">
              <AlertDialog.Title className="tv-dialog__title">
                {m.users_delete_title()}
              </AlertDialog.Title>
              <AlertDialog.Description className="tv-dialog__description">
                {deleting
                  ? m.users_delete_confirm({ name: deleting.name })
                  : ''}
              </AlertDialog.Description>
            </div>
            <div className="tv-dialog__footer">
              <AlertDialog.Cancel asChild>
                <button
                  type="button"
                  className="tv-btn tv-btn--outline tv-btn--sm"
                >
                  {m.common_cancel()}
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  type="button"
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
