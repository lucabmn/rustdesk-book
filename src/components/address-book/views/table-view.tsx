import { Pencil, Trash2 } from 'lucide-react'

import {
  Button,
  hoverReveal,
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
import { cn } from '#/lib/utils'
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

/*
 * Columns in priority order. Below its breakpoint a column is dropped rather
 * than squeezed: the identity (status, id, alias) and the action are what a
 * row is for, and everything dropped is still one tap away in the drawer.
 */
const AT_SM = 'hidden sm:table-cell'
const AT_MD = 'hidden md:table-cell'
const AT_LG = 'hidden lg:table-cell'
const AT_XL = 'hidden xl:table-cell'

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
    // The min-width grows with the number of columns actually on screen, so a
    // phone gets a table that fits instead of one it has to pan across.
    <Table flush className="md:min-w-[720px] xl:min-w-[960px]">
      <THead>
        <TH className="w-7 sm:w-9" />
        <TH>{m.th_id()}</TH>
        <TH>{m.th_alias()}</TH>
        <TH className={AT_SM}>{m.th_customer()}</TH>
        <TH className={AT_XL}>{m.th_tags()}</TH>
        <TH className={AT_MD}>{m.th_os()}</TH>
        <TH className={AT_LG}>{m.th_last_seen()}</TH>
        <TH className={AT_XL}>{m.th_password()}</TH>
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
            <TD className="font-medium">
              {/* A long alias in a nowrap cell sets the table's width, which on
                  a phone pushes the action column past the edge. Bounding it
                  to roughly a third of the viewport keeps the row on screen. */}
              <div className="max-w-[34vw] truncate sm:max-w-none">
                {d.alias}
              </div>
            </TD>
            <TD className={cn('text-muted', AT_SM)}>{d.customer || '—'}</TD>
            <TD className={AT_XL}>
              {/* No wrapping here — a second chip row would make this one row
                  taller than the rest and break the scan down the column. */}
              <DeviceTags tags={d.tags} className="flex-nowrap" />
            </TD>
            <TD className={cn('text-muted', AT_MD)}>{osLabel(d.osKey)}</TD>
            <TD className={cn('tnum whitespace-nowrap text-muted', AT_LG)}>
              {formatLastSeen(d.lastSeen)}
            </TD>
            <TD className={AT_XL}>
              <PasswordMask hasPassword={d.hasPassword} />
            </TD>
            <TD>
              {/* Actions stay out of the way until the row is pointed at or
                  tabbed into — a favourited star still shows, because that is
                  data about the device rather than an action on it. On touch
                  `hoverReveal` is inert and all of this is simply present.

                  Edit and delete wait for `md`: four controls do not fit beside
                  an id and a customer, and the drawer this row opens offers
                  both anyway. */}
              <div className="flex justify-end gap-1">
                <FavoriteButton
                  active={d.isFavorite}
                  onToggle={() => onToggleFavorite(d)}
                  className={d.isFavorite ? undefined : hoverReveal}
                />
                <div className={cn('flex gap-1', hoverReveal)}>
                  <ConnectButton
                    variant="outline"
                    compact
                    onClick={() => onConnect(d)}
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="hidden md:inline-flex"
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
                    className="hidden hover:bg-danger-soft hover:text-danger md:inline-flex"
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
