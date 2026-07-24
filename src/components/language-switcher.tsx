import { availableLocales, useLocale } from '#/lib/i18n'
import { m } from '#/paraglide/messages'

/** Compact segmented de/en switcher built on the Tenvima segmented control. */
export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale()
  return (
    <div className="tv-seg" role="toolbar" aria-label={m.language()}>
      {availableLocales.map((l) => (
        <button
          key={l}
          data-active={l === locale}
          onClick={() => setLocale(l)}
          type="button"
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
