import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Plus } from 'lucide-react'

import { TagChip } from '#/components/ui'
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
    return <p className="text-faint text-xs">{m.group_none_hint()}</p>
  }

  return (
    <div className="flex flex-wrap gap-1">
      {groups.map((g) => {
        const on = memberIds.has(g.id)
        return (
          <TagChip
            key={g.id}
            active={on}
            onClick={() =>
              setMut.mutate({ groupId: g.id, deviceId, member: !on })
            }
          >
            {on ? <Check className="size-3" /> : <Plus className="size-3" />}
            {g.name}
          </TagChip>
        )
      })}
    </div>
  )
}
