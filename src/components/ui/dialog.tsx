import { AlertDialog, Dialog as RadixDialog } from 'radix-ui'
import { X } from 'lucide-react'

import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'
import { Button } from './button'

/*
 * Dialogs are the one place shadows are allowed — they genuinely float. Their
 * internals reuse the app's section rhythm so a dialog reads as the same
 * surface as the page behind it, only closer.
 */

const overlay =
  'fixed inset-0 z-50 bg-black/45 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0'

const panel =
  'fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-line bg-elevated shadow-overlay data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95'

export interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  /** Rendered in the sticky footer, right-aligned. */
  footer?: React.ReactNode
  /** Max panel width in px. Dialogs stay narrow unless they hold a table. */
  width?: number
  className?: string
  children: React.ReactNode
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  footer,
  width = 480,
  className,
  children,
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={overlay} />
        <RadixDialog.Content
          className={cn(panel, className)}
          style={{ maxWidth: width }}
        >
          <header className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
            <div className="min-w-0">
              <RadixDialog.Title className="text-sm font-semibold text-text">
                {title}
              </RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="mt-0.5 text-xs text-muted">
                  {description}
                </RadixDialog.Description>
              ) : null}
            </div>
            <RadixDialog.Close asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="-mr-1 -mt-0.5"
                aria-label={m.common_close()}
              >
                <X />
              </Button>
            </RadixDialog.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

          {footer ? (
            <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-sunken px-4 py-3">
              {footer}
            </footer>
          ) : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

/** Standard body padding — opt out by passing your own container instead. */
export function DialogBody({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={cn('px-4 py-3.5', className)}>{children}</div>
}

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: React.ReactNode
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
}

/** Blocking yes/no. Separate from {@link Dialog} because it traps escape. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = true,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={overlay} />
        <AlertDialog.Content className={cn(panel, 'max-w-[380px]')}>
          <div className="px-4 pt-4 pb-3">
            <AlertDialog.Title className="text-sm font-semibold text-text">
              {title}
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-1.5 text-xs leading-relaxed text-muted">
              {description}
            </AlertDialog.Description>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-line bg-sunken px-4 py-3">
            <AlertDialog.Cancel asChild>
              <Button variant="outline">
                {cancelLabel ?? m.common_cancel()}
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                variant={destructive ? 'danger' : 'accent'}
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
