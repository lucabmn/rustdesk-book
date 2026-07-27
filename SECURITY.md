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

**Jede sicherheitsrelevante Aktion wird auditiert.** An-/Abmeldungen, fehlgeschlagene
Anmeldeversuche und Passwortänderungen, Änderungen an Geräten, Kunden, Benutzern,
Einladungen und Enrollment-Tokens sowie Import und Export. Jeder Eintrag nennt Actor,
Ziel und Zeitpunkt; bei Änderungen hält das Metadata-Feld die *Namen* der geänderten
Felder fest – Werte nur dort, wo sie selbst kein Geheimnis sind (etwa die neue Rolle
eines Benutzers). Klartext-Passwörter, Token-Werte und Schlüssel
tauchen in keinem Eintrag auf. Fehlgeschlagene Anmeldeversuche werden ohne Session
mit der versuchten E-Mail-Adresse aufgezeichnet; die IP steht darin, sobald
`TRUST_PROXY_HEADERS=true` gesetzt ist – ohne vertrauenswürdigen Proxy wäre sie
fälschbar und bleibt daher leer.

**Registrierung ist einladungsbasiert.** Das erste Konto wird beim ersten Start als
Administrator angelegt. Danach ist die Registrierung gesperrt; weitere Konten
entstehen nur über zeitlich begrenzte Einladungslinks.

**Der MCP-Endpunkt ist abgesichert.** `/mcp` ist deaktiviert, solange kein
`MCP_API_KEY` gesetzt ist, und verlangt sonst einen Bearer-Token. Die Tools sind
lesend und geben niemals Passwörter zurück.

**Client-Enrollment verwendet getrennte Bearer-Tokens.** Deployment-Tokens werden
mit 256 Bit Zufall erzeugt. Einmal-Tokens werden nur gehasht gespeichert;
permanente Tokens werden für spätere Skript-Downloads zusätzlich mit
`APP_ENCRYPTION_KEY` verschlüsselt. Einmal-Tokens dürfen genau ein Gerät
registrieren; permanente Tokens können widerrufen oder gelöscht werden. Vor dem
Ändern des RustDesk-Passworts reserviert das Skript einen kurzlebigen Claim. Bis
zur bestätigten Registrierung liegt eine Recovery-Datei ausschließlich für
root/SYSTEM vor. Deployment-Skripte enthalten den Bearer-Token im Klartext und
müssen daher zugriffsgeschützt verteilt und nach Gebrauch gelöscht werden.

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
