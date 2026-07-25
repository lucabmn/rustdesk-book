import { AlertDialog } from 'radix-ui'

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
    <AlertDialog.Root open={device !== null} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="tv-dialog-overlay" />
        <AlertDialog.Content className="tv-dialog" style={{ maxWidth: 400 }}>
          <div className="tv-dialog__header">
            <AlertDialog.Title className="tv-dialog__title">
              {m.delete_title()}
            </AlertDialog.Title>
            <AlertDialog.Description className="tv-dialog__description">
              {device ? m.confirm_delete({ alias: device.alias }) : ''}
            </AlertDialog.Description>
          </div>
          <div className="tv-dialog__footer">
            <AlertDialog.Cancel asChild>
              <button
                type="button"
                className="tv-btn tv-btn--outline tv-btn--sm"
              >
                {m.common_cancel()}
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                type="button"
                className="tv-btn tv-btn--destructive tv-btn--sm"
                onClick={() => device && onConfirm(device)}
              >
                {m.common_delete()}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
