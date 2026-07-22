# Sicherheit

rustdesk-book verwaltet Zugangsdaten für Fernwartung. Sicherheit hat entsprechend
Priorität. Dieses Dokument beschreibt das Sicherheitsmodell ehrlich – inklusive
seiner Grenzen – und wie du Schwachstellen meldest.

## Schwachstelle melden

Bitte **keine** öffentlichen Issues für Sicherheitsprobleme. Melde sie vertraulich
über die [GitHub Security Advisories](https://github.com/lucabmn/rustdesk-book/security/advisories/new).
Ich bemühe mich, innerhalb weniger Tage zu reagieren, und stimme die Offenlegung
mit dir ab.

## Sicherheitsmodell

**Passwörter werden verschlüsselt gespeichert.** Gerätepasswörter liegen
ausschließlich als AES-256-GCM-Chiffrat in der Datenbank. Der Schlüssel stammt aus
`APP_ENCRYPTION_KEY` (getrennt vom Session-Secret) und wird nie mitgespeichert.
List- und Detail-Antworten enthalten das Passwort in keiner Form – weder Klartext
noch Chiffrat, sondern nur die Information, *ob* ein Passwort hinterlegt ist.

**Klartext nur auf explizite, protokollierte Anfrage.** Ein Passwort verlässt den
Server nur über zwei authentifizierte Wege: das Anzeigen im Detail-Bereich und das
Öffnen einer Sitzung. Beide Vorgänge werden im Audit-Log festgehalten (wer, welches
Gerät, wann – niemals der Wert selbst).

**Registrierung ist einladungsbasiert.** Das erste Konto wird beim ersten Start als
Administrator angelegt. Danach ist die Registrierung gesperrt; weitere Konten
entstehen nur über zeitlich begrenzte Einladungslinks.

**Der MCP-Endpunkt ist abgesichert.** `/mcp` ist deaktiviert, solange kein
`MCP_API_KEY` gesetzt ist, und verlangt sonst einen Bearer-Token. Die Tools sind
lesend und geben niemals Passwörter zurück.

### Was die Verschlüsselung *nicht* leistet

Die Verschlüsselung schützt die Daten **im Ruhezustand** – also Datenbank und
Backups. Um eine RustDesk-Sitzung zu starten, muss das Passwort zwangsläufig als
Klartext an den authentifizierten Browser übergeben werden (`rustdesk://…`). Das ist
**keine** Ende-zu-Ende-Verschlüsselung: Wer Zugriff auf eine angemeldete Sitzung oder
den Server-Speicher zur Laufzeit hat, kann Passwörter sehen. Behandle die Instanz
entsprechend wie einen Passwort-Tresor.

## Betriebsempfehlungen

- `APP_ENCRYPTION_KEY` **getrennt** von der Datenbank sichern. Geht der Schlüssel
  verloren, sind alle Passwörter unwiederbringlich verloren.
- Instanz nur über HTTPS und in vertrauenswürdigen Netzen betreiben.
- Regelmäßige Datenbank-Backups; Zugriff auf Server und Backups strikt begrenzen.
- Nur benötigte Personen einladen; Admin-Rolle sparsam vergeben.

## Umfang

Betroffen ist der Code in diesem Repository. Für RustDesk selbst (hbbs/hbbr, Clients)
gelten die Sicherheitshinweise des jeweiligen Projekts.
