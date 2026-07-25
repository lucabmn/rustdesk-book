import { Pencil, Trash2 } from 'lucide-react'

import {
  Button,
  StatusDot,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from '#/components/ui'
import { osLabel } from '#/lib/device-meta'
import { formatLastSeen } from '#/lib/format'
import type { Device } from '#/orpc/schema'
import { m } from '#/paraglide/messages'
import {
  ConnectButton,
  DeviceId,
  DeviceTags,
  FavoriteButton,
  PasswordMask,
} from '../device-bits'

export interface TableViewProps {
  devices: Device[]
  onOpen: (device: Device) => void
  onConnect: (device: Device) => void
  onEdit: (device: Device) => void
  onDelete: (device: Device) => void
  onToggleFavorite: (device: Device) => void
}

/** Dense tabular view — the default for keyboard-driven work. */
export function TableView({
  devices,
  onOpen,
  onConnect,
  onEdit,
  onDelete,
  onToggleFavorite,
}: TableViewProps) {
  return (
    <Table flush className="min-w-[960px]">
      <THead>
        <TH className="w-9" />
        <TH>{m.th_id()}</TH>
        <TH>{m.th_alias()}</TH>
        <TH>{m.th_customer()}</TH>
        <TH>{m.th_tags()}</TH>
        <TH>{m.th_os()}</TH>
        <TH>{m.th_last_seen()}</TH>
        <TH>{m.th_password()}</TH>
        <TH align="right">{m.th_action()}</TH>
      </THead>
      <TBody>
        {devices.map((d) => (
          // The row actions live in the last cell and stop propagation, so a
          // click anywhere else safely means "inspect this device".
          <TR key={d.id} interactive onClick={() => onOpen(d)}>
            <TD>
              <StatusDot status={d.status} />
            </TD>
            <TD>
              <DeviceId id={d.rustdeskId} />
            </TD>
            <TD className="font-medium">{d.alias}</TD>
            <TD className="text-muted">{d.customer || '—'}</TD>
            <TD>
              {/* No wrapping here — a second chip row would make this one row
                  taller than the rest and break the scan down the column. */}
              <DeviceTags tags={d.tags} className="flex-nowrap" />
            </TD>
            <TD className="text-muted">{osLabel(d.osKey)}</TD>
            <TD className="tnum whitespace-nowrap text-muted">
              {formatLastSeen(d.lastSeen)}
            </TD>
            <TD>
              <PasswordMask hasPassword={d.hasPassword} />
            </TD>
            <TD>
              {/* Actions stay out of the way until the row is pointed at or
                  tabbed into — a favourited star still shows, because that is
                  data about the device rather than an action on it. */}
              <div className="flex justify-end gap-1">
                <FavoriteButton
                  active={d.isFavorite}
                  onToggle={() => onToggleFavorite(d)}
                  className={
                    d.isFavorite
                      ? undefined
                      : 'opacity-0 transition-opacity focus-visible:opacity-100 group-hover/row:opacity-100'
                  }
                />
                <div className="flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100">
                  <ConnectButton
                    variant="outline"
                    onClick={() => onConnect(d)}
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    title={m.common_edit()}
                    aria-label={m.common_edit()}
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit(d)
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    title={m.common_delete()}
                    aria-label={m.common_delete()}
                    className="hover:bg-danger-soft hover:text-danger"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(d)
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  )
}
