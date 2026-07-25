import { Segmented, SegmentedItem } from '#/components/ui'
import { availableLocales, useLocale } from '#/lib/i18n'
import { m } from '#/paraglide/messages'

/** Compact de/en switch. */
export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale()
  return (
    <Segmented aria-label={m.language()}>
      {availableLocales.map((l) => (
        <SegmentedItem
          key={l}
          active={l === locale}
          onClick={() => setLocale(l)}
        >
          {l.toUpperCase()}
        </SegmentedItem>
      ))}
    </Segmented>
  )
}
