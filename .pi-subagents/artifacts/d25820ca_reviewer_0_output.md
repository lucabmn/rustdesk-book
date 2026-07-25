## Review
- **Correct:** Keine Blocker oder hohen Fehler gefunden.
- Token-Löschen sperrt bei aktiven Claims und Geräte bleiben durch `ON DELETE SET NULL` erhalten (`src/orpc/router/enrollments.ts:188-223`, `src/db/schema.ts:182-185`).
- Widerrufene Tokens verhindern neue Claims; bestehende Claims können weiterhin finalisiert werden (`src/lib/enrollment.ts:218-247`).
- Permanente Tokens werden verschlüsselt gespeichert; erneuter Skriptabruf und Legacy-Rotation erfolgen unter Row-Lock (`src/orpc/router/enrollments.ts:128-185`).
- Kunden stammen aus `customers.list`; Enrollment verwendet `CustomerCombobox` (`src/components/address-book/address-book.tsx:98-105`, `src/components/address-book/enrollment-dialog.tsx:262-275`).
- Typecheck, 36 Tests und Production-Build erfolgreich.