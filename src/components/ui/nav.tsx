import { cn } from '#/lib/utils'

/**
 * Sidebar row: icon, label, optional trailing count. The active state is the
 * only place besides the primary button where the accent appears in the shell.
 */
export function NavItem({
  icon: Icon,
  label,
  count,
  active,
  className,
  ...props
}: React.ComponentProps<'button'> & {
  icon: React.ComponentType<{ className?: string }>
  label: string
  count?: number | string
  active?: boolean
}) {
  return (
    <button
      type="button"
      aria-current={active ? 'true' : undefined}
      className={cn(
        'group flex h-7 w-full items-center gap-2 rounded-md px-2 text-left transition-colors',
        active
          ? 'bg-accent-soft font-medium text-accent'
          : 'text-muted hover:bg-hover hover:text-text',
        className,
      )}
      {...props}
    >
      <Icon className={cn('size-3.5 shrink-0', active ? '' : 'text-faint')} />
      <span className="min-w-0 flex-1 truncate text-xs">{label}</span>
      {count !== undefined ? (
        <span className="tnum shrink-0 text-2xs text-faint">{count}</span>
      ) : null}
    </button>
  )
}

/**
 * Segmented control for small, mutually exclusive choices (view mode, locale).
 * A single bordered track so it reads as one control, not three buttons.
 */
export function Segmented({
  className,
  ...props
}: React.ComponentProps<'fieldset'>) {
  return (
    <fieldset
      className={cn(
        'inline-flex items-center gap-px rounded-md border border-line bg-sunken p-px',
        className,
      )}
      {...props}
    />
  )
}

export function SegmentedItem({
  active,
  className,
  ...props
}: React.ComponentProps<'button'> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-[5px] px-2 font-medium text-2xs transition-colors [&_svg]:size-3.5',
        active
          ? 'bg-surface text-text shadow-[0_1px_2px_rgb(0_0_0/0.06)]'
          : 'text-muted hover:text-text',
        className,
      )}
      {...props}
    />
  )
}

/** Vertical icon rail on the far left of the app shell. */
export function RailButton({
  icon: Icon,
  label,
  active,
  className,
  ...props
}: React.ComponentProps<'button'> & {
  icon: React.ComponentType<{ className?: string }>
  label: string
  active?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        'flex size-8 items-center justify-center rounded-md transition-colors',
        active
          ? 'bg-accent-soft text-accent'
          : 'text-faint hover:bg-hover hover:text-text',
        className,
      )}
      {...props}
    >
      <Icon className="size-4" />
    </button>
  )
}
