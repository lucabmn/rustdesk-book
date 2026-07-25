# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
