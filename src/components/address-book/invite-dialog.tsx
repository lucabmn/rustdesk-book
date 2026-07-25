import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Trash2 } from 'lucide-react'

import {
  Button,
  Dialog,
  DialogBody,
  EmptyState,
  Field,
  Input,
  Select,
} from '#/components/ui'
import { roleLabel } from '#/lib/i18n-labels'
import { orpc } from '#/orpc/client'
import { m } from '#/paraglide/messages'
import { useToast } from './toast'

/** Admin-only dialog for creating and managing invitations. */
export function InviteDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'member'>('member')

  const listQuery = useQuery(
    orpc.invites.list.queryOptions({ input: {}, enabled: open }),
  )
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: orpc.invites.key() })

  const createMut = useMutation(
    orpc.invites.create.mutationOptions({
      onSuccess: (invite) => {
        invalidate()
        setEmail('')
        // The link is the whole point of creating one — hand it over at once.
        void copyLink(invite.token)
        toast(m.toast_invite_created())
      },
      onError: (e) => toast(e.message),
    }),
  )
  const revokeMut = useMutation(
    orpc.invites.revoke.mutationOptions({
      onSuccess: () => {
        invalidate()
        toast(m.toast_invite_revoked())
      },
    }),
  )

  function inviteLink(token: string) {
    return `${window.location.origin}/register?token=${token}`
  }
  async function copyLink(token: string) {
    try {
      await navigator.clipboard.writeText(inviteLink(token))
    } catch {
      /* ignore */
    }
  }

  const invites = listQuery.data ?? []

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={m.invite_title()}
      description={m.invite_description()}
      width={520}
    >
      <DialogBody className="flex flex-col gap-4">
        <div className="flex items-end gap-2">
          <Field
            label={m.invite_email_label()}
            htmlFor="invite-email"
            className="flex-1"
          >
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={m.invite_email_ph()}
            />
          </Field>
          <Select
            value={role}
            onChange={(e) => setRole(e.target.value as 'admin' | 'member')}
            aria-label={m.invite_role()}
            className="w-auto"
          >
            <option value="member">{m.common_role_member()}</option>
            <option value="admin">{m.common_role_admin()}</option>
          </Select>
          <Button
            variant="accent"
            size="md"
            disabled={!email.trim() || createMut.isPending}
            onClick={() => createMut.mutate({ email: email.trim(), role })}
          >
            {m.invite_submit()}
          </Button>
        </div>

        {invites.length === 0 ? (
          <EmptyState>{m.invite_none()}</EmptyState>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center gap-2 rounded-md border border-line bg-sunken py-1.5 pr-1.5 pl-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-text text-xs">
                    {inv.email}
                  </div>
                  <div className="text-2xs text-faint">
                    {m.invite_valid_until({
                      role: roleLabel(inv.role),
                      date: new Date(inv.expiresAt).toLocaleDateString(),
                    })}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title={m.invite_copy_link()}
                  aria-label={m.invite_copy_link()}
                  onClick={() => {
                    void copyLink(inv.token)
                    toast(m.toast_link_copied())
                  }}
                >
                  <Copy />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title={m.invite_revoke()}
                  aria-label={m.invite_revoke()}
                  className="hover:bg-danger-soft hover:text-danger"
                  onClick={() => revokeMut.mutate({ id: inv.id })}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogBody>
    </Dialog>
  )
}
