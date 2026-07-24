import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog } from 'radix-ui'
import { Plus, Save, Trash2, X } from 'lucide-react'

import { orpc } from '#/orpc/client'
import { m } from '#/paraglide/messages'
import { useToast } from './toast'

/**
 * Manage customers as first-class records: rename (propagates to every linked
 * device), edit contact/notes, add or delete. Deleting a customer leaves its
 * devices in place but unassigned.
 */
export function CustomersDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [newName, setNewName] = useState('')

  const query = useQuery(
    orpc.customers.list.queryOptions({ input: {}, enabled: open }),
  )
  const customers = query.data ?? []

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: orpc.customers.key() })
    queryClient.invalidateQueries({ queryKey: orpc.devices.key() })
  }

  const createMut = useMutation(
    orpc.customers.create.mutationOptions({
      onSuccess: () => {
        invalidate()
        setNewName('')
      },
      onError: (e) => toast(e.message),
    }),
  )

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="tv-dialog-overlay" />
        <Dialog.Content className="tv-dialog" style={{ maxWidth: 640 }}>
          <div className="tv-dialog__header">
            <Dialog.Title className="tv-dialog__title">
              {m.customers_title()}
            </Dialog.Title>
            <Dialog.Description className="tv-dialog__description">
              {m.customers_description()}
            </Dialog.Description>
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
            <input
              className="tv-input"
              value={newName}
              placeholder={m.customers_new_placeholder()}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newName.trim()) {
                  createMut.mutate({ name: newName.trim() })
                }
              }}
            />
            <button
              className="tv-btn tv-btn--default tv-btn--sm"
              disabled={!newName.trim() || createMut.isPending}
              onClick={() => createMut.mutate({ name: newName.trim() })}
            >
              <Plus size={14} />
              {m.common_add()}
            </button>
          </div>

          {customers.length === 0 ? (
            <span style={{ fontSize: 12.5, color: 'var(--fg-4)' }}>
              {m.customers_none()}
            </span>
          ) : (
            <div style={{ maxHeight: '55vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {customers.map((c) => (
                <CustomerRow key={c.id} customer={c} onChanged={invalidate} />
              ))}
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
    </Dialog.Root>
  )
}

function CustomerRow({
  customer,
  onChanged,
}: {
  customer: {
    id: string
    name: string
    contact: string | null
    notes: string | null
    count: number
  }
  onChanged: () => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState(customer.name)
  const [contact, setContact] = useState(customer.contact ?? '')
  const [notes, setNotes] = useState(customer.notes ?? '')

  const dirty =
    name.trim() !== customer.name ||
    contact.trim() !== (customer.contact ?? '') ||
    notes.trim() !== (customer.notes ?? '')

  const updateMut = useMutation(
    orpc.customers.update.mutationOptions({
      onSuccess: onChanged,
      onError: (e) => toast(e.message),
    }),
  )
  const removeMut = useMutation(
    orpc.customers.remove.mutationOptions({
      onSuccess: onChanged,
      onError: (e) => toast(e.message),
    }),
  )

  return (
    <div
      style={{
        border: '1px solid var(--bd-1)',
        borderRadius: 8,
        padding: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        background: 'var(--bg-sunken)',
      }}
    >
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          className="tv-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label={m.common_name()}
          style={{ flex: 1 }}
        />
        <span className="tv-badge tv-badge--secondary" title={m.customers_device_count()}>
          {customer.count}
        </span>
        <button
          className="tv-btn tv-btn--default tv-btn--icon-sm"
          disabled={!dirty || !name.trim() || updateMut.isPending}
          title={m.common_save()}
          aria-label={m.common_save()}
          onClick={() =>
            updateMut.mutate({
              id: customer.id,
              name: name.trim(),
              contact: contact.trim() || undefined,
              notes: notes.trim() || undefined,
            })
          }
        >
          <Save size={14} />
        </button>
        <button
          className="tv-btn tv-btn--ghost tv-btn--icon-sm"
          title={m.common_delete()}
          aria-label={m.common_delete()}
          style={{ color: 'var(--s-err)' }}
          onClick={() => removeMut.mutate({ id: customer.id })}
        >
          <Trash2 size={14} />
        </button>
      </div>
      <input
        className="tv-input"
        value={contact}
        placeholder={m.customers_contact_placeholder()}
        onChange={(e) => setContact(e.target.value)}
        aria-label={m.customers_contact_placeholder()}
      />
      <textarea
        className="tv-input"
        value={notes}
        placeholder={m.customers_notes_placeholder()}
        onChange={(e) => setNotes(e.target.value)}
        aria-label={m.customers_notes_placeholder()}
        rows={2}
        style={{ resize: 'vertical', minHeight: 34 }}
      />
    </div>
  )
}
