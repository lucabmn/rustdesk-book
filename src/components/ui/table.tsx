import { cn } from '#/lib/utils'

/**
 * Data table. Rows are 34px and separated by hairlines rather than zebra
 * striping — at this density stripes fight with the status column.
 *
 * `flush` bleeds the table into its container and makes the wrapper the scroll
 * area, which is what lets {@link THead} actually stick. Without it the table
 * is a bordered card that grows with its content (dialogs, short lists).
 */
export function Table({
  flush,
  className,
  children,
}: {
  flush?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'overflow-auto overscroll-contain',
        flush ? 'h-full' : 'rounded-lg border border-line bg-surface',
      )}
    >
      <table
        className={cn('w-full border-collapse text-left text-xs', className)}
      >
        {children}
      </table>
    </div>
  )
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 bg-sunken">
      <tr className="border-line border-b">{children}</tr>
    </thead>
  )
}

export function TH({
  className,
  align,
  ...props
}: React.ComponentProps<'th'> & { align?: 'left' | 'right' }) {
  return (
    <th
      scope="col"
      className={cn(
        'h-8 whitespace-nowrap px-2 font-medium text-2xs text-faint uppercase tracking-wide sm:px-3 touch:h-10',
        align === 'right' && 'text-right',
        className,
      )}
      {...props}
    />
  )
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody>{children}</tbody>
}

export function TR({
  interactive,
  className,
  ...props
}: React.ComponentProps<'tr'> & { interactive?: boolean }) {
  return (
    <tr
      className={cn(
        'border-line border-b last:border-b-0',
        interactive &&
          'group/row cursor-pointer transition-colors hover:bg-hover focus-within:bg-hover',
        className,
      )}
      {...props}
    />
  )
}

export function TD({ className, ...props }: React.ComponentProps<'td'>) {
  // Cells never wrap: the table already scrolls horizontally below its
  // min-width, and a wrapped id or alias destroys the row rhythm. Chips inside
  // a cell still wrap — their own flex container governs that.
  return (
    <td
      className={cn(
        'h-[34px] whitespace-nowrap px-2 text-text sm:px-3 touch:h-12',
        className,
      )}
      {...props}
    />
  )
}
