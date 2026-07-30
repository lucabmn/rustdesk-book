export type Theme = 'light' | 'dark'

export const THEME_KEY = 'rustdesk-book-theme'

/**
 * What the browser paints its own chrome with — the address bar on a phone,
 * which is flush against the app and looks broken in the opposite theme.
 *
 * These mirror `--canvas` in styles.css and have to be literal: a meta tag
 * cannot read a custom property. Keep them in step when the canvas changes.
 *
 * Note this cannot key off `prefers-color-scheme`: the app's theme comes from
 * `data-theme` and defaults to dark whatever the OS prefers, so a media query
 * here would light up the bar around a dark app on most first visits.
 */
export const THEME_COLOR: Record<Theme, string> = {
  light: '#f9fafb',
  dark: '#111315',
}

/** Point the browser-chrome colour at the theme actually applied. */
function syncThemeColor(theme: Theme): void {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  meta.content = THEME_COLOR[theme]
}

/** Read the theme currently applied to the document. */
export function getCurrentTheme(): Theme {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

/** Apply a theme and persist the choice. */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  syncThemeColor(theme)
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* ignore storage errors (private mode etc.) */
  }
}

/**
 * Inline script injected into <head> so the stored theme is applied before
 * first paint — avoids a light/dark flash on load.
 *
 * It creates the `theme-color` meta itself rather than letting the route's
 * head render one: this runs before that markup exists, and the browser chrome
 * has to be right from the first paint too, not a frame later.
 */
export const themeInitScript = `(function(){var t='dark';try{t=localStorage.getItem('${THEME_KEY}')==='light'?'light':'dark';}catch(e){}document.documentElement.dataset.theme=t;var m=document.createElement('meta');m.name='theme-color';m.content=t==='light'?'${THEME_COLOR.light}':'${THEME_COLOR.dark}';document.head.appendChild(m);})();`
