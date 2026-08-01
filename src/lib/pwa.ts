/**
 * The head tags that make the app installable. No service worker — the app is
 * online-only by design, and nothing here implies otherwise.
 *
 * The manifest and the icons it lists are static files under `public/`,
 * generated from the brand mark by `scripts/generate-icons.mjs`.
 * `src/test/pwa-manifest.test.ts` checks them against what is really on disk:
 * a wrong path or a `sizes` that disagrees with the pixels is dropped silently
 * by every browser, and no build step would catch it.
 */

export const PWA_HEAD_LINKS = [
  { rel: 'manifest', href: '/manifest.webmanifest' },
  // iOS ignores SVG here and rescales anything that is not 180px, so this is a
  // 180px PNG with no alpha — iOS composites transparency onto black and the
  // mark's rounded tile would come back with dark corners.
  { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: '180x180' },
]

export const PWA_HEAD_META = [
  { name: 'mobile-web-app-capable', content: 'yes' },
  // Still required alongside the standard name: iOS reads only this one.
  { name: 'apple-mobile-web-app-capable', content: 'yes' },
  // Without this iOS labels the home screen icon with the full <title>,
  // subtitle and all. The manifest's `short_name` covers the same job on
  // Android, which never reads these.
  { name: 'apple-mobile-web-app-title', content: 'rustdesk-book' },
  // `default` keeps iOS reserving the status bar for itself, so the layout is
  // the one the browser tab already gets. `black-translucent` would slide the
  // web view up under the clock and every screen would need a new top inset;
  // the app only pads left/right/bottom (see `px-safe` in styles.css).
  { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
]
