import { cn } from '#/lib/utils'

/** Shared shape for every text-entry control, so they line up in a form grid. */
const fieldBase =
  'w-full rounded-md border border-line bg-surface text-sm text-text transition-colors placeholder:text-faint hover:border-line-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-60'

/*
 * The `touch:` heights are not paired with the desktop ones by `cn`, so a
 * caller passing a denser `h-7` still gets the finger-sized box on a phone —
 * which is what the global 16px field rule in styles.css needs room for.
 */
export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(fieldBase, 'h-8 px-2.5 touch:h-10', className)}
      {...props}
    />
  )
}

export function Textarea({
  className,
  ...props
}: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(fieldBase, 'min-h-16 resize-y px-2.5 py-1.5', className)}
      {...props}
    />
  )
}

/**
 * Native select. A custom listbox buys nothing here — these are short,
 * known option sets and the OS picker is faster on touch and keyboard alike.
 */
export function Select({
  className,
  ...props
}: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        fieldBase,
        'h-8 cursor-pointer px-2 pr-7 touch:h-10',
        className,
      )}
      {...props}
    />
  )
}

/** Label + control + optional hint, stacked with the app's field rhythm. */
export function Field({
  label,
  hint,
  htmlFor,
  className,
  children,
}: {
  label: string
  hint?: React.ReactNode
  htmlFor?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="text-2xs font-medium tracking-wide text-muted uppercase"
      >
        {label}
      </label>
      {children}
      {hint ? <p className="text-2xs text-faint">{hint}</p> : null}
    </div>
  )
}

export { fieldBase }
