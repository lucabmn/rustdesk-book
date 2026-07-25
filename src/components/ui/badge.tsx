import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '#/lib/utils'

/** Small status/label pill. Tone is semantic — never decorative. */
const badge = cva(
  'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-px font-medium text-2xs leading-4',
  {
    variants: {
      tone: {
        neutral: 'bg-sunken text-muted ring-1 ring-line ring-inset',
        accent: 'bg-accent-soft text-accent ring-1 ring-accent-line ring-inset',
        ok: 'bg-ok-soft text-ok',
        warn: 'bg-warn-soft text-warn',
        danger: 'bg-danger-soft text-danger',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...props} />
}

/**
 * Tag chip that can be toggled on/off — used for the tag facets. Rendered as
 * a button so keyboard users get the same affordance as the mouse.
 */
export function TagChip({
  active,
  count,
  className,
  children,
  ...props
}: React.ComponentProps<'button'> & { active?: boolean; count?: number }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'inline-flex h-[22px] items-center gap-1 rounded-full border px-2.5 font-medium text-2xs transition-colors',
        active
          ? 'border-accent-line bg-accent-soft text-accent'
          : 'border-line bg-sunken text-muted hover:border-line-strong hover:text-text',
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined ? (
        <span className="tnum opacity-60">{count}</span>
      ) : null}
    </button>
  )
}
