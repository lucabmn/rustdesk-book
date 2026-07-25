import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Save, Trash2 } from 'lucide-react'

import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  EmptyState,
  Input,
  Textarea,
} from '#/components/ui'
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

  function create() {
    if (newName.trim()) createMut.mutate({ name: newName.trim() })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={m.customers_title()}
      description={m.customers_description()}
      width={640}
    >
      <DialogBody className="flex flex-col gap-3">
        <div className="flex gap-1.5">
          <Input
            value={newName}
            placeholder={m.customers_new_placeholder()}
            aria-label={m.customers_new_placeholder()}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
          />
          <Button
            variant="accent"
            size="md"
            disabled={!newName.trim() || createMut.isPending}
            onClick={create}
          >
            <Plus />
            {m.common_add()}
          </Button>
        </div>

        {customers.length === 0 ? (
          <EmptyState>{m.customers_none()}</EmptyState>
        ) : (
          <div className="flex flex-col gap-2">
            {customers.map((c) => (
              <CustomerRow key={c.id} customer={c} onChanged={invalidate} />
            ))}
          </div>
        )}
      </DialogBody>
    </Dialog>
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
    <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-sunken p-2.5">
      <div className="flex items-center gap-1.5">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label={m.common_name()}
          className="flex-1"
        />
        <Badge className="tnum" title={m.customers_device_count()}>
          {customer.count}
        </Badge>
        {/* Save stays disabled until something actually changed, so the row
            never invites a pointless write. */}
        <Button
          variant="accent"
          size="icon-md"
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
          <Save />
        </Button>
        <Button
          variant="ghost"
          size="icon-md"
          title={m.common_delete()}
          aria-label={m.common_delete()}
          className="hover:bg-danger-soft hover:text-danger"
          onClick={() => removeMut.mutate({ id: customer.id })}
        >
          <Trash2 />
        </Button>
      </div>
      <Input
        value={contact}
        placeholder={m.customers_contact_placeholder()}
        onChange={(e) => setContact(e.target.value)}
        aria-label={m.customers_contact_placeholder()}
      />
      <Textarea
        value={notes}
        rows={2}
        placeholder={m.customers_notes_placeholder()}
        onChange={(e) => setNotes(e.target.value)}
        aria-label={m.customers_notes_placeholder()}
      />
    </div>
  )
}
