import { Pencil } from 'lucide-react'

import { activatable, Button, Card, StatusBadge } from '#/components/ui'
import { osLabel } from '#/lib/device-meta'
import { formatLastSeen } from '#/lib/format'
import { type DisplayDevice, displayStatus } from '#/lib/offline-cache'
import { m } from '#/paraglide/messages'
import {
  ConnectButton,
  DeviceId,
  DeviceTags,
  FavoriteButton,
  PendingBadge,
} from '../device-bits'

export interface CardsViewProps {
  devices: DisplayDevice[]
  onOpen: (device: DisplayDevice) => void
  onConnect: (device: DisplayDevice) => void
  onEdit: (device: DisplayDevice) => void
  onToggleFavorite: (device: DisplayDevice) => void
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="truncate text-right text-text">{value}</dd>
    </>
  )
}

/** Card grid — the touch-friendly, scan-at-a-glance view. */
export function CardsView({
  devices,
  onOpen,
  onConnect,
  onEdit,
  onToggleFavorite,
}: CardsViewProps) {
  return (
    // One card per row on a phone. `auto-fill` with a 272px floor would still
    // fit a single column there, but only just — and not at all once a narrow
    // viewport pays for the gutter.
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(272px,1fr))]">
      {devices.map((d) => (
        <Card
          key={d.id}
          {...activatable(() => onOpen(d))}
          className="cursor-pointer transition-colors hover:border-line-strong"
        >
          <div className="flex items-start gap-2 px-3.5 pt-3">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-sm text-text">
                {d.alias}
              </div>
              <DeviceId id={d.rustdeskId} className="text-2xs" />
            </div>
            {d.pending ? (
              <PendingBadge />
            ) : (
              <>
                <StatusBadge status={displayStatus(d)} />
                <FavoriteButton
                  active={d.isFavorite}
                  onToggle={() => onToggleFavorite(d)}
                />
              </>
            )}
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-3.5 py-3 text-xs">
            <Row label={m.label_customer()} value={d.customer || '—'} />
            <Row label={m.label_os()} value={osLabel(d.osKey)} />
            <Row label={m.label_last()} value={formatLastSeen(d.lastSeen)} />
          </dl>

          {d.tags.length > 0 && (
            <div className="px-3.5 pb-3">
              <DeviceTags tags={d.tags} />
            </div>
          )}

          {/* Nothing to act on until the device exists: connecting needs the
              server to build the URI, and editing a queued entry is out of
              scope for the offline feature by design. */}
          {!d.pending && (
            <div className="flex gap-1.5 border-line border-t px-3.5 py-2.5">
              <ConnectButton
                onClick={() => onConnect(d)}
                className="h-7 flex-1 text-xs"
              />
              <Button
                size="icon-sm"
                title={m.common_edit()}
                aria-label={m.common_edit()}
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(d)
                }}
              >
                <Pencil />
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}
