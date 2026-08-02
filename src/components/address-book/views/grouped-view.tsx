import { useId, useState } from 'react'
import { Building2, ChevronRight } from 'lucide-react'

import { activatable, Badge, Card, StatusDot } from '#/components/ui'
import {
  readCollapsedGroups,
  toggleCollapsed,
  writeCollapsedGroups,
} from '#/lib/collapsed-groups'
import { osLabel } from '#/lib/device-meta'
import { type DisplayDevice, displayStatus } from '#/lib/offline-cache'
import { cn } from '#/lib/utils'
import {
  ConnectButton,
  DeviceId,
  DeviceTags,
  PendingBadge,
} from '../device-bits'

export interface DeviceGroup {
  /** Stable identity — the customer name, or '' for the unassigned bucket. */
  key: string
  name: string
  items: DisplayDevice[]
}

export interface GroupedViewProps {
  groups: DeviceGroup[]
  onOpen: (device: DisplayDevice) => void
  onConnect: (device: DisplayDevice) => void
}

/** Devices bucketed by customer, one foldable card per customer. */
export function GroupedView({ groups, onOpen, onConnect }: GroupedViewProps) {
  const baseId = useId()

  // Read straight from storage as the initial value, so a group that was left
  // collapsed is collapsed in this component's very first paint rather than
  // rendering open and snapping shut afterwards.
  const [collapsed, setCollapsed] = useState(readCollapsedGroups)

  function toggle(key: string) {
    const next = toggleCollapsed(collapsed, key)
    setCollapsed(next)
    writeCollapsedGroups(next)
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map((g) => {
        const open = !collapsed.has(g.key)
        const panelId = `${baseId}-${g.key || 'unassigned'}`
        return (
          <Card key={g.key}>
            <h2>
              <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => toggle(g.key)}
                className="flex w-full items-center gap-2 rounded-lg px-3.5 py-2.5 text-left transition-colors hover:bg-hover"
              >
                <ChevronRight
                  className={cn(
                    'size-3.5 shrink-0 text-faint transition-transform',
                    open && 'rotate-90',
                  )}
                />
                <Building2 className="size-3.5 shrink-0 text-faint" />
                <span className="truncate font-medium text-sm text-text">
                  {g.name}
                </span>
                {/* The count is what makes a folded group still informative. */}
                <Badge className="tnum">{g.items.length}</Badge>
              </button>
            </h2>

            {open && (
              <div id={panelId} className="border-line border-t">
                {g.items.map((d) => (
                  <div
                    key={d.id}
                    {...activatable(() => onOpen(d))}
                    className="flex cursor-pointer items-center gap-3 border-line border-b px-3.5 py-2 transition-colors last:border-b-0 hover:bg-hover"
                  >
                    <StatusDot status={displayStatus(d)} />
                    {/* One column of fixed-width fields reads well across a
                        desk and not at all across a phone, so below `sm` the
                        id and alias stack and the rest gives way to Connect. */}
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
                      <DeviceId
                        id={d.rustdeskId}
                        className="shrink-0 sm:w-28"
                      />
                      <span className="truncate font-medium text-text text-xs sm:w-40 sm:shrink-0">
                        {d.alias}
                      </span>
                      <span className="hidden min-w-0 flex-1 truncate text-muted text-xs sm:block">
                        {osLabel(d.osKey)}
                      </span>
                    </div>
                    <DeviceTags
                      tags={d.tags}
                      className="hidden flex-nowrap lg:inline-flex"
                    />
                    {d.pending ? (
                      <PendingBadge />
                    ) : (
                      <ConnectButton
                        variant="outline"
                        onClick={() => onConnect(d)}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
