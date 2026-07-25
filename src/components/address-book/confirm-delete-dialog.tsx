import { ConfirmDialog } from '#/components/ui'
import type { Device } from '#/orpc/schema'
import { m } from '#/paraglide/messages'

/** Accessible confirmation before deleting a device. */
export function ConfirmDeleteDialog({
  device,
  onOpenChange,
  onConfirm,
}: {
  device: Device | null
  onOpenChange: (open: boolean) => void
  onConfirm: (device: Device) => void
}) {
  return (
    <ConfirmDialog
      open={device !== null}
      onOpenChange={onOpenChange}
      title={m.delete_title()}
      description={device ? m.confirm_delete({ alias: device.alias }) : ''}
      confirmLabel={m.common_delete()}
      onConfirm={() => device && onConfirm(device)}
    />
  )
}
