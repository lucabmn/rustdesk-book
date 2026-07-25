import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { orpc } from '#/orpc/client'
import { m } from '#/paraglide/messages'
import { useToast } from './toast'

/**
 * Toggle chips for adding/removing a device to/from the current user's private
 * groups. Rendered inside the device detail drawer.
 */
export function GroupMembership({ deviceId }: { deviceId: string }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const groupsQuery = useQuery(orpc.groups.list.queryOptions({ input: {} }))
  const memberQuery = useQuery(
    orpc.groups.forDevice.queryOptions({ input: { deviceId } }),
  )
  const groups = groupsQuery.data ?? []
  const memberIds = new Set(memberQuery.data ?? [])

  const setMut = useMutation(
    orpc.groups.setMembership.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.groups.key() })
        queryClient.invalidateQueries({ queryKey: orpc.devices.key() })
      },
      onError: (e) => toast(e.message),
    }),
  )

  if (groups.length === 0) {
    return (
      <span style={{ fontSize: 12.5, color: 'var(--fg-4)' }}>
        {m.group_none_hint()}
      </span>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      {groups.map((g) => {
        const on = memberIds.has(g.id)
        return (
          <button
            type="button"
            key={g.id}
            onClick={() =>
              setMut.mutate({ groupId: g.id, deviceId, member: !on })
            }
            aria-pressed={on}
            style={{
              height: 24,
              padding: '0 10px',
              borderRadius: 999,
              border: `1px solid ${on ? 'var(--brand)' : 'var(--bd-1)'}`,
              background: on ? 'var(--brand-soft)' : 'var(--bg-sunken)',
              color: on ? 'var(--brand)' : 'var(--fg-2)',
              fontFamily: 'var(--font-sans)',
              fontSize: 11.5,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {on ? '✓ ' : '+ '}
            {g.name}
          </button>
        )
      })}
    </div>
  )
}
