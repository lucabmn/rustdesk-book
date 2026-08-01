import { BrandMark } from '#/components/brand-mark'
import { LanguageSwitcher } from '#/components/language-switcher'
import { Card } from '#/components/ui'

/**
 * Shared frame for the sign-in and invite screens: a single narrow card on the
 * app canvas. No hero, no illustration — this is a door, not a landing page.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: React.ReactNode
  children: React.ReactNode
}) {
  return (
    /* Two boxes rather than one because `px-safe` sets the horizontal padding
       outright: the insets belong on the frame, the 16px gutter on the box
       inside it. Installed there is no browser chrome to keep the card clear
       of a cutout in landscape, or of the home indicator on a long form. */
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-safe py-10">
      <div className="flex w-full justify-center px-4 pb-[env(safe-area-inset-bottom)]">
        <Card className="w-full max-w-[380px] p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <BrandMark />
            <LanguageSwitcher />
          </div>
          <h1 className="font-semibold text-text text-xl tracking-tight">
            {title}
          </h1>
          <p className="mt-1 text-muted text-xs">{subtitle}</p>
          <div className="mt-5">{children}</div>
        </Card>
      </div>
    </div>
  )
}

/** Inline form error. Quiet enough to sit in a card, loud enough to notice. */
export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-md border border-danger/30 bg-danger-soft px-2.5 py-2 text-danger text-xs"
    >
      {children}
    </p>
  )
}
