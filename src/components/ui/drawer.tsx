import { Dialog } from 'radix-ui'
import { X } from 'lucide-react'

import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages'
import { Button } from './button'

/**
 * Edge sheet for inspecting one record — or, from the left, for the navigation
 * that has no room to stay on screen — without losing the page behind it. Same
 * surface and rhythm as the page: it slides, it doesn't pop.
 *
 * On a phone it is simply full width, which is why `width` is a ceiling rather
 * than a size.
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  subtitle,
  actions,
  footer,
  width = 380,
  side = 'right',
  className,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Icon buttons shown next to the close control. */
  actions?: React.ReactNode
  footer?: React.ReactNode
  /** Widest the sheet may get. Below it the sheet fills the viewport. */
  width?: number
  /** Which edge it docks to. Records come from the right, navigation the left. */
  side?: 'left' | 'right'
  className?: string
  children: React.ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/35 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            // `h-dvh` rather than `inset-y-0`: a fixed element resolves against
            // the large viewport, so on mobile the footer would sit behind the
            // browser's own address bar.
            'fixed top-0 z-50 flex h-dvh w-full flex-col bg-surface shadow-overlay',
            'data-[state=closed]:animate-out data-[state=open]:animate-in',
            side === 'right'
              ? 'right-0 border-line border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right'
              : 'left-0 border-line border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
            // A ceiling expressed as a class, not `style.maxWidth` — an inline
            // style outranks the stylesheet and cannot be overridden per use.
            'max-w-(--sheet-w)',
            className,
          )}
          style={{ '--sheet-w': `${width}px` } as React.CSSProperties}
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

          <div
            className={cn(
              'min-h-0 flex-1 overflow-y-auto overscroll-contain',
              !footer && 'pb-[env(safe-area-inset-bottom)]',
            )}
          >
            {children}
          </div>

          {footer ? (
            <footer className="flex shrink-0 items-center gap-2 border-line border-t bg-sunken px-4 pt-3 pb-safe">
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
