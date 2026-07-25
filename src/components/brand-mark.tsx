import { cn } from '#/lib/utils'

/**
 * The mark: a screen that is also a book. The frame plus the spine rule on the
 * left read as a bound volume large and as a remote display small; the dot is
 * the session that is up.
 *
 * Kept byte-identical in geometry to `public/favicon.svg` and `public/icon.svg`
 * so the tab, the installed icon and the app never drift apart.
 */
export function BrandGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      // Decorative: the wordmark next to it already names the app.
      role="presentation"
      aria-hidden
      className={cn('size-5 shrink-0', className)}
    >
      <title>rustdesk-book</title>
      {/* Solid spine, not a hairline: a thin rule reads as the ubiquitous
          "toggle sidebar" icon at small sizes, a filled band reads as a book. */}
      <path
        d="M6 3h3v18H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z"
        fill="currentColor"
      />
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="15" cy="12" r="2.5" className="fill-accent" />
    </svg>
  )
}

/** Glyph plus wordmark. `sm` is the in-app size, `md` the auth screens. */
export function BrandMark({
  size = 'md',
  className,
}: {
  size?: 'sm' | 'md'
  className?: string
}) {
  const small = size === 'sm'
  return (
    <span className={cn('inline-flex items-center gap-2 text-text', className)}>
      <BrandGlyph className={small ? 'size-[18px]' : 'size-6'} />
      <span
        className={cn(
          'font-semibold tracking-tight',
          small ? 'text-xs' : 'text-base',
        )}
      >
        rustdesk<span className="text-faint">/</span>book
      </span>
    </span>
  )
}
