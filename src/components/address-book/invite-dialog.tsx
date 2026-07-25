import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog } from 'radix-ui'
import { Copy, Trash2, X } from 'lucide-react'

import { orpc } from '#/orpc/client'
import { roleLabel } from '#/lib/i18n-labels'
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

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="tv-dialog-overlay" />
        <Dialog.Content className="tv-dialog" style={{ maxWidth: 480 }}>
          <div className="tv-dialog__header">
            <Dialog.Title className="tv-dialog__title">
              {m.invite_title()}
            </Dialog.Title>
            <Dialog.Description className="tv-dialog__description">
              {m.invite_description()}
            </Dialog.Description>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div className="tv-field" style={{ flex: 1 }}>
              <label className="tv-label" htmlFor="invite-email">
                {m.invite_email_label()}
              </label>
              <input
                id="invite-email"
                type="email"
                className="tv-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={m.invite_email_ph()}
              />
            </div>
            <select
              className="tv-select"
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'member')}
              aria-label={m.invite_role()}
            >
              <option value="member">{m.common_role_member()}</option>
              <option value="admin">{m.common_role_admin()}</option>
            </select>
            <button
              type="button"
              className="tv-btn tv-btn--default tv-btn--sm"
              disabled={!email.trim() || createMut.isPending}
              onClick={() => createMut.mutate({ email: email.trim(), role })}
            >
              {m.invite_submit()}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {listQuery.data?.length === 0 && (
              <span style={{ fontSize: 12, color: 'var(--fg-4)' }}>
                {m.invite_none()}
              </span>
            )}
            {listQuery.data?.map((inv) => (
              <div
                key={inv.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  border: '1px solid var(--bd-1)',
                  borderRadius: 6,
                  background: 'var(--bg-sunken)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500 }}>
                    {inv.email}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg-4)' }}>
                    {m.invite_valid_until({
                      role: roleLabel(inv.role),
                      date: new Date(inv.expiresAt).toLocaleDateString(),
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  className="tv-btn tv-btn--ghost tv-btn--icon-xs"
                  title={m.invite_copy_link()}
                  onClick={() => {
                    void copyLink(inv.token)
                    toast(m.toast_link_copied())
                  }}
                >
                  <Copy size={13} />
                </button>
                <button
                  type="button"
                  className="tv-btn tv-btn--ghost tv-btn--icon-xs"
                  title={m.invite_revoke()}
                  style={{ color: 'var(--s-err)' }}
                  onClick={() => revokeMut.mutate({ id: inv.id })}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
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
