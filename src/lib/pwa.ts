import { THEME_COLOR } from '#/lib/theme'

/**
 * Everything the app needs to be installable: the icon set and the head tags
 * that point at it. No service worker — the app is online-only by design.
 *
 * The icons live in `public/` as committed PNGs, generated from the brand mark
 * by `scripts/generate-icons.mjs`. They are data here rather than literals in
 * `__root.tsx` so `src/test/pwa-manifest.test.ts` can check the descriptors
 * against the files that are really served: a wrong path or a `sizes` that
 * disagrees with the pixels is dropped silently by every browser.
 */

export interface AppIcon {
  src: string
  sizes: string
  type: 'image/png'
  /**
   * `any` icons are shown as drawn, so they keep the mark's rounded tile.
   * A `maskable` icon is clipped to whatever shape the launcher wants, which
   * means it has to be full-bleed and opaque — the rounded tile's transparent
   * corners would otherwise show through the mask.
   */
  purpose: 'any' | 'maskable'
}

/**
 * Chrome refuses to offer an install unless there is an icon of at least 192px
 * and one of at least 512px, and its manifest inspector warns when none is
 * maskable. These three cover all of it.
 */
export const APP_ICONS: AppIcon[] = [
  { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  {
    src: '/icon-maskable-512.png',
    sizes: '512x512',
    type: 'image/png',
    purpose: 'maskable',
  },
]

/**
 * The colour behind the splash screen and in the task switcher. It matches the
 * dark `--canvas`, not the icon's tile: the splash hands straight over to the
 * app, and the app opens dark unless the user has stored otherwise.
 */
export const PWA_BACKGROUND_COLOR = THEME_COLOR.dark

export const PWA_HEAD_LINKS = [
  { rel: 'manifest', href: '/manifest.webmanifest' },
  // iOS ignores SVG here and every size but 180 gets rescaled, so this is a
  // 180px PNG with no alpha — iOS composites transparency onto black and the
  // rounded tile would come back with dark corners.
  { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: '180x180' },
]

export const PWA_HEAD_META = [
  { name: 'mobile-web-app-capable', content: 'yes' },
  // Still required alongside the standard name: iOS reads only this one.
  { name: 'apple-mobile-web-app-capable', content: 'yes' },
  // `default` keeps iOS reserving the status bar for itself, so the layout is
  // the same one the browser tab already gets. `black-translucent` would slide
  // the web view up under the clock and every screen would need a new top
  // inset; the app only pads left/right/bottom (see `px-safe` in styles.css).
  { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
]
