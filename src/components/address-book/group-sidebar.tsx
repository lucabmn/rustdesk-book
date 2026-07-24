import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, FolderClosed, Plus, Trash2, X } from 'lucide-react'

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
    else setAdding(false)
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 14px 6px',
        }}
      >
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: '.05em',
            textTransform: 'uppercase',
            color: 'var(--fg-4)',
          }}
        >
          {m.section_groups()}
        </span>
        <button
          className="tv-btn tv-btn--ghost tv-btn--icon-xs"
          title={m.group_create()}
          aria-label={m.group_create()}
          onClick={() => setAdding((v) => !v)}
        >
          <Plus size={14} />
        </button>
      </div>

      {adding && (
        <div style={{ display: 'flex', gap: 4, padding: '0 14px 6px' }}>
          <input
            className="tv-input"
            autoFocus
            value={name}
            placeholder={m.group_new_placeholder()}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
              else if (e.key === 'Escape') {
                setAdding(false)
                setName('')
              }
            }}
            style={{ height: 26 }}
          />
          <button
            className="tv-btn tv-btn--default tv-btn--icon-sm"
            onClick={submit}
            disabled={createMut.isPending}
            aria-label={m.group_create()}
          >
            <Check size={14} />
          </button>
        </div>
      )}

      {groups.length === 0 && !adding && (
        <div style={{ padding: '0 14px 6px', fontSize: 11.5, color: 'var(--fg-4)' }}>
          {m.group_none()}
        </div>
      )}

      {groups.map((g) => (
        <div
          key={g.id}
          style={{ display: 'flex', alignItems: 'center', paddingRight: 8 }}
        >
          <button
            className="tv-navitem"
            data-active={activeGroupId === g.id}
            style={{ flex: 1, minWidth: 0 }}
            onClick={() => onSelect(activeGroupId === g.id ? null : g.id)}
          >
            <FolderClosed className="tv-navitem__icon" />
            <span className="tv-navitem__label">{g.name}</span>
            <span className="tv-navitem__count">{g.count}</span>
          </button>
          <button
            className="tv-btn tv-btn--ghost tv-btn--icon-xs"
            title={m.group_delete()}
            aria-label={m.group_delete()}
            style={{ color: 'var(--fg-4)' }}
            onClick={() => removeMut.mutate({ id: g.id })}
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}

      {adding && groups.length === 0 && (
        <button
          className="tv-btn tv-btn--ghost tv-btn--xs"
          style={{ margin: '0 14px' }}
          onClick={() => {
            setAdding(false)
            setName('')
          }}
        >
          <X size={12} /> {m.common_cancel()}
        </button>
      )}
    </>
  )
}
