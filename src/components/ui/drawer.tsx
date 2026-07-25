import { Dialog } from 'radix-ui'
import { X } from 'lucide-react'

import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'
import { Button } from './button'

/**
 * Right-hand side sheet for inspecting one record without losing the list
 * behind it. Same surface and rhythm as the page — it slides, it doesn't pop.
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  subtitle,
  actions,
  footer,
  width = 380,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Icon buttons shown next to the close control. */
  actions?: React.ReactNode
  footer?: React.ReactNode
  width?: number
  children: React.ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/35 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-line border-l bg-surface shadow-overlay data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
          style={{ maxWidth: width }}
        >
          <header className="flex shrink-0 items-start gap-2 border-line border-b px-4 py-3">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate font-semibold text-sm text-text">
                {title}
              </Dialog.Title>
              {subtitle ? (
                <Dialog.Description className="mt-0.5 truncate text-muted text-xs">
                  {subtitle}
                </Dialog.Description>
              ) : null}
            </div>
            {actions}
            <Dialog.Close asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={m.common_close()}
              >
                <X />
              </Button>
            </Dialog.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

          {footer ? (
            <footer className="flex shrink-0 items-center gap-2 border-line border-t bg-sunken px-4 py-3">
              {footer}
            </footer>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** A titled block inside a drawer or dialog body. */
export function Section({
  title,
  action,
  className,
  children,
}: {
  title: string
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn('px-4 py-3.5', className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-medium text-2xs text-faint uppercase tracking-wide">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  )
}

/** Label/value pair. Use inside a <dl> so the two columns stay aligned. */
export function Meta({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <>
      <dt className="py-1 text-muted text-xs">{label}</dt>
      <dd className="py-1 text-right text-text text-xs">{children}</dd>
    </>
  )
}

/** Two-column grid for a run of {@link Meta} rows. */
export function MetaList({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4">
      {children}
    </dl>
  )
}
