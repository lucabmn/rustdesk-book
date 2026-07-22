# Mitwirken

Beiträge sind willkommen – ob Bugfix, Feature oder Doku. Ein paar Hinweise, damit
Reviews schnell gehen.

## Entwicklungsumgebung

Voraussetzungen: Node 22, pnpm, eine PostgreSQL-Datenbank.

```bash
pnpm install
cp .env.example .env.local          # Werte eintragen (Schlüssel generieren!)
pnpm db:migrate                      # Schema anlegen
pnpm dev                             # http://localhost:3000
```

Beim ersten Aufruf legst du das Administrator-Konto an.

## Vor dem Pull Request

- `pnpm typecheck` und `pnpm build` müssen fehlerfrei durchlaufen.
- Schema geändert? Migration mit `pnpm db:generate` erzeugen und **mit einchecken**.
- Keine Secrets, echten Passwörter oder RustDesk-IDs im Diff.

## Commit-Konventionen

Wir nutzen [Conventional Commits](https://www.conventionalcommits.org/):
`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `ci:` …

```
feat: geräte-tags im detail-drawer filtern
fix: passwort-eingabe im edit-formular nicht vorbelegen
```

Kleine, thematisch fokussierte Commits sind einfacher zu reviewen als ein großer.

## Architektur in Kürze

- **TanStack Start** (React, SSR) mit dateibasiertem Routing in `src/routes/`.
- **oRPC** als typsichere API-Schicht (`src/orpc/`); Prozeduren sind über die
  `authed`-Basis abgesichert.
- **Drizzle + PostgreSQL** (`src/db/`); Migrationen liegen in `drizzle/`.
- **better-auth** für Sessions und die einladungsbasierte Registrierung.
- **Tenvima Design System** (`src/styles/tenvima/`) als einzige UI-Sprache.

## Sicherheit

Bitte lies [SECURITY.md](./SECURITY.md). Änderungen an Passwort-Handling, Auth oder
Einladungen brauchen besondere Sorgfalt – beschreibe im PR, was du geprüft hast.
Schwachstellen bitte vertraulich melden, nicht als Issue.
