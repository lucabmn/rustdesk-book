import { Building2 } from 'lucide-react'

import { activatable, Badge, Card, StatusDot } from '#/components/ui'
import { osLabel } from '#/lib/device-meta'
import type { Device } from '#/orpc/schema'
import { ConnectButton, DeviceId, DeviceTags } from '../device-bits'

export interface DeviceGroup {
  name: string
  items: Device[]
}

export interface GroupedViewProps {
  groups: DeviceGroup[]
  onOpen: (device: Device) => void
  onConnect: (device: Device) => void
}

/** Devices bucketed by customer, one card per customer. */
export function GroupedView({ groups, onOpen, onConnect }: GroupedViewProps) {
  return (
    <div className="flex flex-col gap-3">
      {groups.map((g) => (
        <Card key={g.name}>
          <header className="flex items-center gap-2 border-line border-b px-3.5 py-2.5">
            <Building2 className="size-3.5 text-faint" />
            <h2 className="font-medium text-sm text-text">{g.name}</h2>
            <Badge className="tnum">{g.items.length}</Badge>
          </header>
          {g.items.map((d) => (
            <div
              key={d.id}
              {...activatable(() => onOpen(d))}
              className="flex cursor-pointer items-center gap-3 border-line border-b px-3.5 py-2 transition-colors last:border-b-0 hover:bg-hover"
            >
              <StatusDot status={d.status} />
              <DeviceId id={d.rustdeskId} className="w-28 shrink-0" />
              <span className="w-40 shrink-0 truncate font-medium text-text text-xs">
                {d.alias}
              </span>
              <span className="min-w-0 flex-1 truncate text-muted text-xs">
                {osLabel(d.osKey)}
              </span>
              <DeviceTags tags={d.tags} className="flex-nowrap" />
              <ConnectButton variant="outline" onClick={() => onConnect(d)} />
            </div>
          ))}
        </Card>
      ))}
    </div>
  )
}
