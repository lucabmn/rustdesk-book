# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
