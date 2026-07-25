import { cn } from '#/lib/utils'

/**
 * Data table. Rows are 34px and separated by hairlines rather than zebra
 * striping — at this density stripes fight with the status column.
 */

export function Table({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
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
        'h-8 px-3 font-medium text-2xs text-faint uppercase tracking-wide',
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
          'cursor-pointer transition-colors hover:bg-hover focus-visible:bg-hover',
        className,
      )}
      {...props}
    />
  )
}

export function TD({ className, ...props }: React.ComponentProps<'td'>) {
  return <td className={cn('h-[34px] px-3 text-text', className)} {...props} />
}
