# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
