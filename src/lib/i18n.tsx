import { Fragment, createContext, useContext, useEffect, useState } from 'react'

import {
  assertIsLocale,
  baseLocale,
  isLocale,
  locales,
  overwriteGetLocale,
} from '#/paraglide/runtime'

/**
 * Locale handling that keeps SSR and the first client render in agreement
 * (both render the base locale, so no hydration mismatch), then applies the
 * stored/browser locale after mount.
 *
 * The locale lives in React state and is synced into paraglide *during render*
 * via overwriteGetLocale, so message functions read the current value. Because
 * message calls like `m.foo()` are plain calls (not context consumers), a state
 * change alone would not re-render them — so the message-using subtree is keyed
 * on the locale and remounts on change, forcing every `m.*()` to re-evaluate.
 */
const STORAGE_KEY = 'rustdesk-book-locale'

// Default for any message call before the provider first renders (e.g. the
// document <head> meta). Overridden during the provider's render.
overwriteGetLocale(() => baseLocale)

export const availableLocales = locales

interface LocaleContextValue {
  locale: string
  setLocale: (locale: string) => void
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within <LocaleProvider>')
  return ctx
}

function detectInitialLocale(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && isLocale(stored)) return stored
  } catch {
    /* storage unavailable */
  }
  const nav =
    typeof navigator !== 'undefined' ? navigator.language?.slice(0, 2) : null
  return nav && isLocale(nav) ? nav : null
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<string>(baseLocale)

  // Sync paraglide during render so `children` (remounted below) read this
  // locale immediately, on both server and client.
  overwriteGetLocale(() => assertIsLocale(locale))

  // biome-ignore lint/correctness/useExhaustiveDependencies: one-shot detection on mount; re-running on every locale change would undo a manual switch
  useEffect(() => {
    const initial = detectInitialLocale()
    if (initial && initial !== locale) setLocaleState(initial)
  }, [])

  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = locale
  }, [locale])

  function setLocale(next: string) {
    if (!isLocale(next) || next === locale) return
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* storage unavailable */
    }
    setLocaleState(next)
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      <Fragment key={locale}>{children}</Fragment>
    </LocaleContext.Provider>
  )
}
