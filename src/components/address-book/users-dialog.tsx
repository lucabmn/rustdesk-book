import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { ConfirmDialog, Dialog, DialogBody, EmptyState } from '#/components/ui'
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
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title={m.users_title()}
        description={m.users_description()}
        width={820}
      >
        <DialogBody>
          {users.length === 0 ? (
            <EmptyState>
              {listQuery.isLoading ? m.loading() : m.users_none()}
            </EmptyState>
          ) : (
            <UserTable
              users={users}
              currentUserId={currentUserId}
              onEdit={setEditing}
              onBan={setBanning}
              onUnban={(user) => unbanMut.mutate({ id: user.id })}
              onDelete={setDeleting}
            />
          )}
        </DialogBody>
      </Dialog>

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
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={m.users_delete_title()}
        description={
          deleting ? m.users_delete_confirm({ name: deleting.name }) : ''
        }
        confirmLabel={m.common_delete()}
        onConfirm={() => {
          if (deleting) removeMut.mutate({ id: deleting.id })
        }}
      />
    </>
  )
}
