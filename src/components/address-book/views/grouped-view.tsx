import { Building2 } from 'lucide-react'

import { formatRustdeskId, osLabel } from '#/lib/device-meta'
import type { Device } from '#/orpc/schema'
import { ConnectButton, DeviceTags, StatusDot } from '../ui-bits'

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {groups.map((g) => (
        <div key={g.name} className="tv-card tv-flush">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '11px 14px',
              borderBottom: '1px solid var(--bd-subtle)',
            }}
          >
            <Building2
              size={15}
              strokeWidth={1.5}
              style={{ color: 'var(--fg-3)' }}
            />
            <span style={{ fontWeight: 600, fontSize: 13 }}>{g.name}</span>
            <span className="tv-badge tv-badge--secondary">{g.items.length}</span>
          </div>
          {g.items.map((d) => (
            <div
              key={d.id}
              className="tv-row-click"
              onClick={() => onOpen(d)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '9px 14px',
                borderBottom: '1px solid var(--bd-subtle)',
              }}
            >
              <StatusDot status={d.status} />
              <span
                className="mono"
                style={{ fontSize: 12, color: 'var(--fg-2)', width: 110 }}
              >
                {formatRustdeskId(d.rustdeskId)}
              </span>
              <span
                style={{
                  fontWeight: 600,
                  width: 160,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {d.alias}
              </span>
              <span style={{ color: 'var(--fg-3)', flex: 1 }}>
                {osLabel(d.osKey)}
              </span>
              <DeviceTags tags={d.tags} />
              <ConnectButton onClick={() => onConnect(d)} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
