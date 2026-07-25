import { Loader2 } from 'lucide-react'

import { cn } from '#/lib/utils'

/** Small shared pieces that aren't worth a file of their own. */

/**
 * Props that turn a non-interactive container (a card, a row) into something a
 * keyboard user can operate: it takes focus, announces itself as a button and
 * activates on Enter/Space just like a click.
 */
export function activatable(onActivate: () => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick: onActivate,
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      // Space would otherwise scroll the list out from under the user.
      event.preventDefault()
      onActivate()
    },
  }
}

/** A bordered surface. The default container for anything list-shaped. */
export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-lg border border-line bg-surface', className)}
      {...props}
    />
  )
}

/** Uppercase label that opens a sidebar or dialog section. */
export function SectionLabel({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'font-medium text-2xs text-faint uppercase tracking-wide',
        className,
      )}
      {...props}
    />
  )
}

/**
 * Nothing-here state. Deliberately plain: a line of text at the density of the
 * data it replaces, not a centred illustration.
 */
export function EmptyState({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('px-4 py-10 text-center text-muted text-xs', className)}>
      {children}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-4 animate-spin', className)} />
}

/** Hairline divider matching the app's border colour. */
export function Divider({
  vertical,
  className,
}: {
  vertical?: boolean
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'shrink-0 bg-line',
        vertical ? 'h-5 w-px' : 'h-px w-full',
        className,
      )}
    />
  )
}

export function Avatar({
  initials,
  className,
}: {
  initials: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-2xs text-accent',
        className,
      )}
    >
      {initials}
    </span>
  )
}

/** Keyboard hint, e.g. the search shortcut. */
export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-sunken px-1 py-px font-sans font-medium text-[10px] text-faint">
      {children}
    </kbd>
  )
}
