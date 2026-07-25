/**
 * Which customer groups the user has folded shut in the grouped view.
 *
 * Stored as the *collapsed* set rather than the expanded one so a customer that
 * appears later starts open, and so the common case (nothing collapsed) stores
 * nothing. Unlike the view mode this never renders on the server — the grouped
 * view only exists once the device list has loaded — so localStorage is enough.
 */

export const COLLAPSED_GROUPS_KEY = 'rustdesk-book-collapsed-groups'

/** Parse the stored payload. This is user-writable storage, so trust nothing. */
export function parseCollapsedGroups(raw: string | null): Set<string> {
  if (!raw) return new Set()
  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return new Set()
    return new Set(value.filter((v): v is string => typeof v === 'string'))
  } catch {
    return new Set()
  }
}

export function serializeCollapsedGroups(keys: ReadonlySet<string>): string {
  return JSON.stringify([...keys].sort())
}

/** Fold a group shut, or open it again. Returns a new set. */
export function toggleCollapsed(
  current: ReadonlySet<string>,
  key: string,
): Set<string> {
  const next = new Set(current)
  if (!next.delete(key)) next.add(key)
  return next
}

export function readCollapsedGroups(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    return parseCollapsedGroups(
      window.localStorage.getItem(COLLAPSED_GROUPS_KEY),
    )
  } catch {
    return new Set()
  }
}

export function writeCollapsedGroups(keys: ReadonlySet<string>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      COLLAPSED_GROUPS_KEY,
      serializeCollapsedGroups(keys),
    )
  } catch {
    /* ignore storage errors (private mode, quota) */
  }
}
