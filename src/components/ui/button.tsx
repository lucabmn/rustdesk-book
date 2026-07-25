import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'

import { cn } from '#/lib/utils'

/**
 * The only button in the app. `accent` is reserved for the single primary
 * action on a surface — everything else is outline or ghost, which is what
 * keeps one accent hue readable as "this is the thing to press".
 */
const button = cva(
  'inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md border font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        accent:
          'border-transparent bg-accent text-accent-fg hover:bg-accent-hover',
        outline:
          'border-line bg-surface text-text hover:border-line-strong hover:bg-hover',
        ghost: 'border-transparent text-muted hover:bg-hover hover:text-text',
        subtle: 'border-transparent bg-sunken text-text hover:bg-hover',
        danger:
          'border-transparent bg-danger text-white hover:bg-danger-hover dark:text-canvas',
        link: 'h-auto border-transparent p-0 text-accent underline-offset-4 hover:underline',
      },
      size: {
        xs: 'h-6 px-2 text-2xs [&_svg]:size-3',
        sm: 'h-7 px-2.5 text-xs [&_svg]:size-3.5',
        md: 'h-8 px-3 text-sm [&_svg]:size-4',
        lg: 'h-9 px-4 text-sm [&_svg]:size-4',
        'icon-xs': 'size-6 [&_svg]:size-3.5',
        'icon-sm': 'size-7 [&_svg]:size-4',
        'icon-md': 'size-8 [&_svg]:size-4',
      },
    },
    defaultVariants: { variant: 'outline', size: 'sm' },
  },
)

export type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof button> & {
    /** Render the child element instead of a <button> (Radix `asChild`). */
    asChild?: boolean
  }

export function Button({
  className,
  variant,
  size,
  asChild,
  type = 'button',
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button'
  return (
    <Comp
      // Slot forwards to whatever the child renders, which may not take `type`.
      {...(asChild ? {} : { type })}
      className={cn(button({ variant, size }), className)}
      {...props}
    />
  )
}

export { button as buttonVariants }
