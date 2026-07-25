## Review
- **Blocker:** Keine hohen Correctness- oder Security-Fehler gefunden.
- **Correct:** Recovery/Claim-Erneuerung, RNG, globale ID-Reservierung und Lockreihenfolge sind konsistent umgesetzt (`src/lib/enrollment.ts:84-188`, `:218-247`; `src/lib/deployment-script.ts:149-203`, `:323-370`, `:462-509`).
- **Correct:** `pnpm test` (27 Tests), Typecheck, Build sowie `sh -n` für Linux/macOS erfolgreich.