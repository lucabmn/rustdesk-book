export type Theme = 'light' | 'dark'

export const THEME_KEY = 'rustdesk-book-theme'

/** Read the theme currently applied to the document. */
export function getCurrentTheme(): Theme {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

/** Apply a theme and persist the choice. */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* ignore storage errors (private mode etc.) */
  }
}

/**
 * Inline script injected into <head> so the stored theme is applied before
 * first paint — avoids a light/dark flash on load.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');document.documentElement.dataset.theme=(t==='dark'?'dark':'light');}catch(e){document.documentElement.dataset.theme='light';}})();`
