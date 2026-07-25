import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Ban } from 'lucide-react'

import {
  Button,
  Dialog,
  DialogBody,
  Field,
  Input,
  Select,
} from '#/components/ui'
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
    <Dialog
      open={user !== null}
      onOpenChange={onOpenChange}
      title={m.users_edit_title()}
      description={m.users_edit_description()}
      width={420}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>
            {m.common_cancel()}
          </Button>
          <Button
            variant="accent"
            disabled={!name.trim() || updateMut.isPending}
            onClick={() =>
              user && updateMut.mutate({ id: user.id, name: name.trim(), role })
            }
          >
            {m.common_save()}
          </Button>
        </>
      }
    >
      <DialogBody className="flex flex-col gap-4">
        <Field label={m.common_name()} htmlFor="user-name">
          <Input
            id="user-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label={m.common_email()} htmlFor="user-email">
          <Input id="user-email" value={user?.email ?? ''} disabled />
        </Field>
        <Field label={m.users_role_label()} htmlFor="user-role">
          <Select
            id="user-role"
            value={role}
            onChange={(e) => setRole(e.target.value as 'admin' | 'member')}
            // The last admin must not be able to demote themselves away.
            disabled={user?.role === 'admin' && !canDemote}
          >
            <option value="member">{m.common_role_member()}</option>
            <option value="admin">{m.common_role_admin()}</option>
          </Select>
        </Field>
      </DialogBody>
    </Dialog>
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
    <Dialog
      open={user !== null}
      onOpenChange={onOpenChange}
      title={m.users_ban_title()}
      description={user ? m.users_ban_description({ name: user.name }) : ''}
      width={420}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>
            {m.common_cancel()}
          </Button>
          <Button
            variant="danger"
            disabled={banMut.isPending}
            onClick={() =>
              user &&
              banMut.mutate({ id: user.id, reason: reason.trim() || undefined })
            }
          >
            <Ban />
            {m.users_ban_confirm()}
          </Button>
        </>
      }
    >
      <DialogBody>
        <Field label={m.users_ban_reason_label()} htmlFor="ban-reason">
          <Input
            id="ban-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={m.users_ban_reason_ph()}
          />
        </Field>
      </DialogBody>
    </Dialog>
  )
}
