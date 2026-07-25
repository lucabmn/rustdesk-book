import { cn } from '#/lib/utils'

/** Positions in the 3x3 mark; index 4 is the centre, the lit one. */
const CELLS = [0, 1, 2, 3, 4, 5, 6, 7, 8]

/**
 * Wordmark. The mark is a nine-cell grid — a RustDesk id is nine digits, and
 * one cell is lit because exactly one machine is the one you are on.
 */
export function BrandMark({
  size = 'md',
  className,
}: {
  size?: 'sm' | 'md'
  className?: string
}) {
  const small = size === 'sm'
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        aria-hidden
        className={cn(
          'grid shrink-0 grid-cols-3 gap-[2px] rounded-md border border-line bg-sunken',
          small ? 'size-[22px] p-[4px]' : 'size-7 p-[5px]',
        )}
      >
        {CELLS.map((cell) => (
          <span
            key={cell}
            className={cn(
              'rounded-[1px]',
              cell === 4 ? 'bg-accent' : 'bg-line-strong',
            )}
          />
        ))}
      </span>
      <span
        className={cn(
          'font-semibold tracking-tight text-text',
          small ? 'text-xs' : 'text-sm',
        )}
      >
        rustdesk<span className="text-faint">/</span>book
      </span>
    </span>
  )
}
