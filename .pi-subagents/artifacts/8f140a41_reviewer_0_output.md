## Review
- **Correct:** Abgelaufene Claims lösen auf Windows, Linux und macOS einen neuen Claim aus, während das Recovery-Passwort erhalten bleibt (`src/lib/deployment-script.ts:153-184`, `:323-355`, `:462-494`); serverseitig werden abgelaufene offene Claims freigegeben (`src/lib/enrollment.ts:166-188`).
- **Correct:** Windows nutzt `RandomNumberGenerator.Create()` mit `GetBytes()` statt neuerer APIs und ist damit PowerShell-5.1-kompatibel (`src/lib/deployment-script.ts:178-182`).
- **Correct:** Die RustDesk-ID wird per transaktionalem Advisory Lock serialisiert und anschließend tokenübergreifend gegen alle aktiven Claims geprüft (`src/lib/enrollment.ts:96`, `:122-137`).
- **Note:** `pnpm test` mit 27 Tests sowie `pnpm typecheck` laufen fehlerfrei, allerdings fehlen gezielte Verhaltenstests für diese drei Regressionen.
- **Blocker:** Durch die drei Korrekturen ist kein neuer Blocker erkennbar.