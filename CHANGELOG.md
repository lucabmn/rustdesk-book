# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0] - 2026-08-02

### Added
- The app is installable: `public/manifest.webmanifest`, a rendered icon set
  (192, 512, maskable and an Apple touch icon) and the head data in
  `src/lib/pwa.ts`, so it starts standalone from a home screen. The maskable
  and Apple icons are full-bleed and opaque, because a launcher clips them and
  iOS composites transparency onto black
- A service worker built into the client output by a Vite plugin. Every
  decision it makes lives in `src/lib/sw-core.ts`, where what may be cached is
  an allowlist: hashed build assets, the icons, the manifest and the offline
  document. oRPC, better-auth, `/mcp`, server functions and every SSR document
  go to the network untouched
- `/offline` is a route, not a hand-written file, so the offline start renders
  in the app's own design and without JavaScript. A failed navigation is
  redirected there rather than served in place
- A new worker installs and waits: the user is offered the update and the
  running version keeps serving until they accept
- The address book stays readable without a connection, out of a snapshot in
  IndexedDB, and a device created offline is held in a queue that transfers
  itself once there is a connection again
- `devices.create` accepts an optional `id` and `offlineCreatedAt`. A replayed
  create returns the existing device instead of a second row, and only then is
  a `rustdeskId` already in use reported as a conflict — reversed, a resend
  after a lost reply would conflict with itself. Online behaviour is unchanged
- Sign-out wipes the queue and the snapshot, and the queue carries an owner
  stamp: the actor recorded for a transfer is whoever was signed in for it

### Changed
- The no-caching rule from the service worker is narrowed for device master
  data only, as a list of field names in `src/lib/offline-cache.ts`: ids,
  alias, customer *name*, OS, tags, notes, status, timestamps, plus
  `hasPassword` and `isFavorite`. Never a cleartext password,
  `passwordCipher`, a session or an enrollment token. Anything the server
  projection gains later is dropped until it is added to that list on purpose
- The password field is disabled offline. The key that protects it
  (`APP_ENCRYPTION_KEY`) exists on the server only, and a queue entry
  structurally cannot carry one
- `displayStatus` is the single funnel a status reaches the screen through, so
  a row from the snapshot or the queue reports `unknown` rather than the green
  of a live device. The status filter goes through the same funnel; the group
  filter is hidden offline, as membership is not carried
- Safe-area insets on the auth frame — installed, there is no browser chrome
  to keep the card clear of a cutout or the home indicator

## [0.6.0] - 2026-07-30

### Added
- The app works on a phone. `touch:` and `mouse:` variants in `styles.css`
  drive it: controls grow under `touch:`, and anything a hover revealed is
  unconditional there, through a shared `hoverReveal` class
- The filter sidebar folds into a left sheet below `lg`, reached from the top
  bar and rendered from the same body as the permanent column
- Safe-area handling — `viewport-fit=cover` plus `pb-safe`/`px-safe`, so
  footers, the toast and the shell clear a notch and the home indicator
- Audit coverage for every security-relevant action: authentication (sign-in,
  failed sign-in, sign-out, password change), devices, customers, users,
  invitations, enrollment tokens and import/export. Entries record the *names*
  of changed fields, never their values, and a mutation that changed nothing
  writes no entry
- Export moved to a server-side procedure, so the audited count is observed
  rather than reported by the client

### Changed
- Dialogs dock to the bottom edge and slide up below `sm`; from `sm` they are
  the centred panel they were
- The table drops columns by priority instead of squeezing them, bounds a long
  alias so it cannot push the action column off the edge, and makes Connect
  icon-only until there is room for its label. It now fits its container at
  every width a finger uses — 375, 430, 640, 768 and 820px
- Grouped rows stack their id and alias below `sm`, cards go one per row, and
  the content header's sync, import and export fold into one menu on a phone
- Text fields return to 16px under `touch:`, so iOS stops zooming the viewport
  in on focus and leaving it there
- `dvh` replaces `vh` for the shell, drawers and dialogs, so a mobile browser's
  collapsing address bar is no longer counted as usable height

### Fixed
- Row actions were revealed by `:hover` alone, which on a touch screen left
  Connect, edit and delete unreachable rather than merely subtle
- Dialog and drawer widths came from `style.maxWidth`, and an inline style
  outranks the stylesheet — it silently cancelled any responsive width
- `theme-color` was keyed off `prefers-color-scheme`, but the theme comes from
  `data-theme` and defaults to dark, so a phone set to light drew a light
  address bar around a dark app
- The user-menu trigger was a 28px tap target

## [0.5.0] - 2026-07-25

### Added
- Tailwind v4 token set as the visual language: one accent, borders over
  shadows, 6px radii, tool-sized type scale, light and dark themes
- `src/components/ui` primitive layer (button, inputs, dialog/confirm, drawer,
  menu, table, badge, nav/segmented/rail, status), so `components.json` finally
  points at something real
- Search affordance in the top bar with a Cmd/Ctrl+K shortcut

### Changed
- App shell, auth screens, device views, detail drawer and every dialog
  rewritten on the new primitives; auth screens share one `AuthLayout`
- `STATUS_META` exposes a semantic `STATUS_TONE` instead of class strings, so
  `lib/` says what a status means and `ui/` decides how it looks
- Table and grouped rows use an outline Connect button; the accent hue now only
  marks the primary action and the active nav item

### Fixed
- Tailwind v4 was wired into Vite but never imported by `styles.css`, so no
  utility applied
- Combobox list rides a Radix Popover: inside a dialog the panel was clipped,
  and picking a row could close the dialog
- Enrollment script region is focusable again for keyboard scrolling
- Device form comboboxes get ids so their labels point at them

### Removed
- `src/styles/tenvima`, `ui-bits.tsx` and `drawer-parts.tsx`

## [0.4.0] - 2026-07-25

### Added
- Biome as linter and formatter, with `lint`, `lint:fix` and `format` scripts
- In-memory (PGlite) test database that runs the real migrations, plus an oRPC
  call helper — every router and the enrollment flow are now covered end to end
- Coverage reporting with thresholds enforced in CI (97% statements)
- Docker build check and Dependabot in CI

### Changed
- Address book split from one 1325-line component into a shell, chrome,
  sidebar, toolbar, view and state-hook modules; no source file exceeds 300
  lines any more
- Database schema, enrollment flow and deployment scripts split into focused
  modules behind their existing entry points
- Registration and ban policy extracted from the better-auth wiring into
  `lib/auth-policy`, where it is directly testable
- Floating `latest` dependency ranges pinned to their resolved versions

### Fixed
- Unbanning an unknown user reported success instead of `NOT_FOUND`
- Clickable device rows and cards are now keyboard operable, and every button
  declares an explicit type
- `latest` container tag can no longer be claimed by a pre-release or by a
  patch tag cut from an older branch

## [0.3.0] - 2026-07-24

### Added
- Operating-system combobox with autocomplete in address book form and filter

## [0.2.0] - 2026-07-23

### Added
- Customer combobox with autocomplete in address book form and filter

### Fixed
- Stamp `lastSeen` timestamp when connecting from the address book
- Keep card-view edit button positioned inside the card bounds

## [0.1.0] - 2026-07-15

### Initial Release
- Core address book functionality with customer management
- Authentication with rate limiting and trusted origins
- Multi-language support (German/English) with language switcher
- Audit logging and confirm-before-delete dialogs
- Docker containerization with build-time encryption
- Unit tests for crypto, device metadata, and safe projections
