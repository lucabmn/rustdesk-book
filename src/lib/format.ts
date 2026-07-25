import { m } from '#/paraglide/messages'

/**
 * Human-readable "last seen" stamp. Null means the device has never been
 * reached — never rendered as an epoch date.
 */
export function formatLastSeen(iso: string | null): string {
  if (!iso) return m.last_seen_never()
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return m.last_seen_never()
  return date.toLocaleString('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
