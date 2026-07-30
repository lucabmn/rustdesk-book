import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, FolderClosed, Plus, Trash2 } from 'lucide-react'

import {
  Button,
  hoverReveal,
  Input,
  NavItem,
  SectionLabel,
} from '#/components/ui'
import { orpc } from '#/orpc/client'
import { m } from '#/paraglide/messages'
import { useToast } from './toast'

/**
 * Sidebar section for the current user's private device groups: select one to
 * filter the list, create a new group inline, or delete an existing one.
 */
export function GroupSidebar({
  activeGroupId,
  onSelect,
}: {
  activeGroupId: string | null
  onSelect: (id: string | null) => void
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  const groupsQuery = useQuery(orpc.groups.list.queryOptions({ input: {} }))
  const groups = groupsQuery.data ?? []

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: orpc.groups.key() })
    queryClient.invalidateQueries({ queryKey: orpc.devices.key() })
  }

  const createMut = useMutation(
    orpc.groups.create.mutationOptions({
      onSuccess: () => {
        invalidate()
        setName('')
        setAdding(false)
      },
      onError: (e) => toast(e.message),
    }),
  )
  const removeMut = useMutation(
    orpc.groups.remove.mutationOptions({
      onSuccess: (_r, vars) => {
        invalidate()
        if (activeGroupId === vars.id) onSelect(null)
      },
      onError: (e) => toast(e.message),
    }),
  )

  function submit() {
    const trimmed = name.trim()
    if (trimmed) createMut.mutate({ name: trimmed })
    else cancel()
  }

  function cancel() {
    setAdding(false)
    setName('')
  }

  return (
    <div className="px-2 pt-4">
      <div className="flex h-6 items-center justify-between gap-2 px-2">
        <SectionLabel>{m.section_groups()}</SectionLabel>
        <Button
          variant="ghost"
          size="icon-xs"
          title={m.group_create()}
          aria-label={m.group_create()}
          onClick={() => (adding ? cancel() : setAdding(true))}
        >
          <Plus />
        </Button>
      </div>

      {adding && (
        <div className="mt-1 flex gap-1 px-2">
          <Input
            // biome-ignore lint/a11y/noAutofocus: the field only exists once the user opened this inline editor, so focus follows their action
            autoFocus
            value={name}
            placeholder={m.group_new_placeholder()}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
              else if (e.key === 'Escape') cancel()
            }}
            className="h-7 text-xs"
          />
          <Button
            variant="accent"
            size="icon-sm"
            onClick={submit}
            disabled={createMut.isPending}
            aria-label={m.group_create()}
          >
            <Check />
          </Button>
        </div>
      )}

      {groups.length === 0 && !adding ? (
        <p className="px-2 py-1 text-2xs text-faint">{m.group_none()}</p>
      ) : (
        <div className="mt-0.5 flex flex-col gap-px">
          {groups.map((g) => (
            <div key={g.id} className="group/row flex items-center">
              <NavItem
                icon={FolderClosed}
                label={g.name}
                count={g.count}
                active={activeGroupId === g.id}
                className="min-w-0 flex-1"
                onClick={() => onSelect(activeGroupId === g.id ? null : g.id)}
              />
              <Button
                variant="ghost"
                size="icon-xs"
                title={m.group_delete()}
                aria-label={m.group_delete()}
                className={hoverReveal}
                onClick={() => removeMut.mutate({ id: g.id })}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
