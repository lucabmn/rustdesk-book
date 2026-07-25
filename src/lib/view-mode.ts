import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'

export const VIEW_MODES = ['table', 'grouped', 'cards'] as const
export type ViewMode = (typeof VIEW_MODES)[number]

/**
 * The chosen view lives in a cookie rather than localStorage on purpose: the
 * page is server-rendered, and only a cookie is readable before the first byte
 * of HTML. Restoring it on the client instead would render one view on the
 * server and swap to another on hydration — the flash we are avoiding.
 */
export const VIEW_COOKIE = 'rustdesk-book-view'

const ONE_YEAR = 60 * 60 * 24 * 365

export function isViewMode(value: unknown): value is ViewMode {
  return VIEW_MODES.includes(value as ViewMode)
}

/** Pick the view out of a `Cookie:` header value. Falls back to the default. */
export function parseViewCookie(header: string | null | undefined): ViewMode {
  for (const part of (header ?? '').split(';')) {
    const [name, ...rest] = part.split('=')
    if (name.trim() !== VIEW_COOKIE) continue
    const value = decodeURIComponent(rest.join('=').trim())
    if (isViewMode(value)) return value
  }
  return 'table'
}

/** Persist the choice. Client-only — the server never writes it. */
export function writeViewCookie(view: ViewMode): void {
  if (typeof document === 'undefined') return
  // biome-ignore lint/suspicious/noDocumentCookie: the suggested CookieStore API is still unavailable in Firefox and Safari, and this writes a single known-safe enum value
  document.cookie = `${VIEW_COOKIE}=${view}; path=/; max-age=${ONE_YEAR}; samesite=lax`
}

const fetchViewMode = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ViewMode> => parseViewCookie(getRequestHeader('cookie')),
)

/**
 * The view to render first. On the client the cookie is right there, so this
 * stays synchronous-ish and costs no request; only the server render pays for
 * a lookup.
 */
export async function loadViewMode(): Promise<ViewMode> {
  if (typeof document !== 'undefined') return parseViewCookie(document.cookie)
  return fetchViewMode()
}
