# Recherche: automatisiertes RustDesk-Client-Enrollment in rustdesk-book

**Stand:** 24. Juli 2026  
**Untersuchte Primärquellen:** offizielle RustDesk-Dokumentation, offizieller RustDesk-Client-Quellcode und öffentliches RustDesk-Server-Pro-Repository.  
**Geprüfte Stände:** `rustdesk/rustdesk` Commit [`b4af821`](https://github.com/rustdesk/rustdesk/commit/b4af82157bc5b44b62e66c1e7b50cc945bc42532), Release `1.4.9`; `rustdesk/doc.rustdesk.com` Commit [`4f6c2b5`](https://github.com/rustdesk/doc.rustdesk.com/commit/4f6c2b52178ac1e7fa0ff969a753ad471f4aceeb); `rustdesk/rustdesk-server-pro` Commit [`2494b75`](https://github.com/rustdesk/rustdesk-server-pro/commit/2494b75b802d6008b6d7c877acf8b39a84a9fb8c).

## Kurzfazit

Das gewünschte Ziel ist technisch umsetzbar, aber **nicht allein mit einem vorhandenen RustDesk-„Device Token“**:

1. RustDesk lässt sich auf Windows, Linux und macOS unbeaufsichtigt installieren, konfigurieren und per CLI nach ID sowie permanentem Kennwort einrichten. Die offizielle Deployment-Dokumentation zeigt dafür `--silent-install`, `--config`, `--password` und `--get-id` auf den drei Desktop-Plattformen.[^deployment]
2. RustDesk Server OSS registriert einen konfigurierten Client beim ersten Kontakt automatisch am Server; dafür ist standardmäßig kein gesonderter Deployment-Token nötig.[^deployment-normal]
3. RustDesk Server Pro besitzt berechtigungsgebundene **API-Tokens**. Wenn „Require deployment for new devices“ aktiviert ist, kann ein Client mit `rustdesk --deploy --token …` registriert werden. Optional kann dabei eine eigene ID gesetzt werden.[^deployment-explicit]
4. In den geprüften offiziellen Quellen ist **kein einmalig verwendbarer Enrollment-/Device-Token** für Desktop-Clients dokumentiert. Der RustDesk-Begriff „One-time password“ bezeichnet ein temporäres Fernzugriffskennwort, nicht ein Enrollment-Token.[^client-overview]
5. Damit Name, RustDesk-ID und permanentes Kennwort in **rustdesk-book** landen, benötigt rustdesk-book einen eigenen Enrollment-Endpunkt und eigene einmalige bzw. statische Tokens. Das Installationsskript meldet die Daten nach erfolgreicher Installation per HTTPS an diesen Endpunkt.

**Empfehlung:** Das Enrollment in rustdesk-book als eigene, schmale Enrollment-API implementieren. RustDesk-Server-Konfiguration und RustDesk-Pro-API-Token sind getrennte Vertrauensdomänen. Einen langlebigen RustDesk-Pro-Admin-Token niemals in öffentlich abrufbare Skripte einbetten.

---

## 1. Was RustDesk bereits offiziell unterstützt

### 1.1 Plattformübergreifende CLI

Der aktuelle Client behandelt unter anderem folgende Befehle:

| Befehl | Zweck | Voraussetzungen laut Quellcode |
|---|---|---|
| `--get-id` | aktuelle RustDesk-ID ausgeben | laufender/installierter Client bzw. IPC |
| `--password <wert>` | permanentes Kennwort setzen | installiert und mit Admin-/Root-Rechten |
| `--config <config-string>` | ID-Server, Key, API- und Relay-Server aus Config-String setzen | installiert und mit Admin-/Root-Rechten |
| `--option <key> [value]` | einzelne Option lesen/setzen | installiert und mit Admin-/Root-Rechten |
| `--set-id <id>` | ID ändern | installiert, privilegiert, sofern Policy es erlaubt |
| `--assign --token …` | Pro-Zuordnungen, Adressbuch, Gruppe, Alias usw. | installiert, privilegiert, Pro-API-Token |
| `--deploy --token … [--id …]` | explizites Pro-Deployment | installiert, privilegiert, Pro-API-Token |

Diese Prüfungen stehen direkt im Client-Einstiegspunkt [`src/core_main.rs`](https://github.com/rustdesk/rustdesk/blob/b4af82157bc5b44b62e66c1e7b50cc945bc42532/src/core_main.rs#L439-L694). `--password` schreibt nur bei installierter Anwendung und administrativen Rechten; `--get-id` liest die ID über IPC; `--config` zerlegt den exportierten Config-String und setzt `key`, `custom-rendezvous-server`, `api-server` und `relay-server`.[^client-core]

Der Config-String kann aus der RustDesk-Pro-Webkonsole oder über „Settings → Network → Export Server Config“ bezogen werden.[^client-config]

### 1.2 Benötigte Serverwerte

Für einen selbst gehosteten Client nennt RustDesk:

- **ID Server:** `hbbs`-Host/IP, erforderlich;
- **Key:** öffentlicher Ed25519-Server-Key, erforderlich für die verschlüsselte Verbindung;
- **API Server:** Pro-Funktionen wie Login/Webkonsole;
- **Relay Server:** häufig optional, weil RustDesk ihn ableiten kann.[^client-config]

Der `Key` ist der öffentliche Verbindungsschlüssel (`id_ed25519.pub`), **nicht** der Pro-Lizenzschlüssel und kein Geheimnis.[^client-config]

### 1.3 Standardregistrierung und explizites Pro-Deployment

Im normalen Modus registriert sich ein neuer Client beim ersten Kontakt selbst am selbst gehosteten RustDesk-Server.[^deployment-normal] Server Pro kann stattdessen unter „Settings → Others → Require deployment for new devices“ eine explizite Freigabe verlangen. Dann gilt:

```text
rustdesk --deploy --token <api_token>
rustdesk --deploy --token <api_token> --id <custom_id>
```

Der Token benötigt laut Dokumentation **Devices: Read and write**. Die Funktion ist ab Server Pro `1.8.3` und Client `1.4.7` dokumentiert.[^console-token]

Der Client sendet bei diesem Vorgang RustDesk-ID, Maschinen-UUID und den öffentlichen Client-Key als JSON an `<api-server>/api/devices/deploy`; der Bearer-Token steht im Authorization-Header.[^deploy-source] Das ist wichtig: Ein reiner rustdesk-book-Backend-Aufruf kann den Vorgang nicht ohne Weiteres ersetzen, weil die maschinengebundene UUID und der Client-Public-Key beteiligt sind.

### 1.4 Pro-Zuordnung und Pro-Adressbuch

Mit `--assign --token …` kann ein installierter Client unter anderem Benutzer, Strategie, Gerätegruppe oder ein Pro-Adressbuch zugeordnet bekommen. Dokumentiert sind auch Alias, Passwort und Notiz für den Adressbucheintrag:[^console-token]

```text
rustdesk --assign --token <token> \
  --address_book_name <name> \
  --address_book_alias <alias> \
  --address_book_password <password> \
  --device_name <hostname>
```

Dies schreibt in die RustDesk-Pro-Verwaltung, **nicht automatisch in rustdesk-book**.

---

## 2. Rollout je Betriebssystem

### 2.1 Windows

**Bevorzugt für GPO/Intune:** MSI mit `msiexec /qn`. RustDesk dokumentiert Parameter für Installationsordner, Startmenü-/Desktop-Verknüpfungen und Druckerkomponente.[^msi]

```powershell
msiexec /i RustDesk-1.4.9-x86_64.msi /qn `
  CREATEDESKTOPSHORTCUTS="N" INSTALLPRINTER="N" /l*v install.log

$exe = "$env:ProgramFiles\RustDesk\rustdesk.exe"
& $exe --config $ConfigString | Out-String
& $exe --password $GeneratedPassword | Out-String
$RustDeskId = (& $exe --get-id | Out-String).Trim()
```

Alternativ unterstützt die EXE `--silent-install`; das offizielle PowerShell-Beispiel installiert zusätzlich den Dienst und wartet auf dessen Start.[^deployment]

Hinweise für eine robuste Implementierung:

- auf den Windows-Dienst und eine nichtleere ID mit Timeout warten, nicht mit festen 20 Sekunden;
- Prozess-Exitcodes und Ausgabe prüfen;
- x64/ARM64 anhand der Architektur auswählen;
- eine freigegebene Version pinnen statt bei jedem Lauf unkontrolliert „latest“ zu laden;
- Kennwort, Token und Config-String nicht in Installationslogs ausgeben.

### 2.2 Linux

RustDesk dokumentiert native Pakete für Debian/Ubuntu (`apt`), Fedora/CentOS (`yum`), Arch (`pacman`) und openSUSE (`zypper`).[^linux]

```sh
apt-get install -fy ./rustdesk-1.4.9-x86_64.deb
rustdesk --config "$CONFIG_STRING"
rustdesk --password "$GENERATED_PASSWORD"
RUSTDESK_ID="$(rustdesk --get-id)"
systemctl restart rustdesk
```

Die offizielle Deployment-Seite enthält ein vollständiges Root-Skript für `.deb` und `.rpm`, inklusive Kennwortsetzung, Config-Import, ID-Ausgabe und Dienstneustart.[^deployment]

Betriebliche Grenze: Wayland-Unterstützung ist laut RustDesk experimentell; Zugriff auf den grafischen Login-Screen benötigt weiterhin X11/GDM mit deaktiviertem Wayland.[^linux]

### 2.3 macOS

Die offizielle Vorlage lädt das passende DMG für Intel oder Apple Silicon, mountet es, kopiert `RustDesk.app` nach `/Applications`, startet den Serverprozess und verwendet ebenfalls `--password`, `--config` und `--get-id`.[^deployment]

```sh
BIN=/Applications/RustDesk.app/Contents/MacOS/RustDesk
"$BIN" --server &
"$BIN" --config "$CONFIG_STRING"
"$BIN" --password "$GENERATED_PASSWORD"
RUSTDESK_ID="$("$BIN" --get-id)"
```

**Entscheidende Einschränkung:** Installation und Registrierung bedeuten noch nicht, dass unbeaufsichtigte Fernsteuerung funktioniert. RustDesk benötigt auf macOS `Accessibility`, `Screen Recording` und teilweise `Input Monitoring`; die offizielle Anleitung führt den Benutzer dafür in die Systemeinstellungen.[^mac]

Für verwaltete Macs sollte der Rollout daher aus zwei Teilen bestehen:

1. App/Daemon und RustDesk-Konfiguration per MDM/Jamf/Intune-Shellscript;
2. passende PPPC-/TCC-Konfigurationsprofile nach den Regeln der verwendeten macOS-Version und der tatsächlich signierten RustDesk-App.

Ohne MDM muss mit einem manuellen Freigabeschritt gerechnet werden. Eine normale Root-Shell darf TCC-Freigaben nicht einfach zuverlässig „wegskripten“; `tccutil reset` setzt Berechtigungen nur zurück und erteilt sie nicht.[^mac]

---

## 3. Gibt es den gewünschten Device Token bereits in RustDesk?

### RustDesk OSS

Für OSS ist in den geprüften offiziellen Quellen kein Webportal mit Geräte-Enrollment-Tokens oder dokumentierter Geräteverwaltungs-REST-API vorhanden. Der normale Mechanismus ist die automatische Registrierung beim ersten Kontakt mit `hbbs`.[^deployment-normal]

### RustDesk Server Pro

Pro bietet berechtigungsgebundene API-Tokens unter „Settings → Tokens“. Sie werden als Bearer-Tokens für CLI- und Python-Managementfunktionen verwendet.[^console-token] Für das explizite Deployment ist `Devices: Read and write` nötig.[^deployment-explicit]

Die geprüften Quellen dokumentieren dabei **keinen Single-Use-/Enrollment-Token-Lebenszyklus**. Daher sollte ein RustDesk-Pro-API-Token als langlebiges, extrahierbares Administrationsgeheimnis behandelt werden, solange die konkrete eingesetzte Pro-Version nicht nachweislich zusätzliche Ablauf-/Einmalfunktionen anbietet.

### Nicht verwechseln: RustDesk One-time Password

RustDesk zeigt neben der ID ein „One Time Password“ für eine Fernwartungssitzung an.[^client-overview] Dieses Kennwort ist kein Deployment- oder Geräte-Enrollment-Token und eignet sich nicht als Portal-Berechtigung.

---

## 4. Empfohlene Architektur für rustdesk-book

### 4.1 Trennung der Geheimnisse

Es sollten drei verschiedene Werte existieren:

1. **rustdesk-book Enrollment-Token** – berechtigt ausschließlich zum Registrieren/Aktualisieren eines Geräts in rustdesk-book;
2. **RustDesk-Server-Config-String** – enthält Serveradressen und öffentlichen Key;
3. **RustDesk-Pro-API-Token** – nur erforderlich für `--deploy`/`--assign`; niemals mit dem Enrollment-Token gleichsetzen.

### 4.2 Portalmodell

Ein Administrator erstellt ein **Enrollment-Profil** mit:

- Kunde/Mandant;
- Tags, Notiz und Aliasstrategie, z. B. Hostname;
- erlaubten Betriebssystemen;
- RustDesk-Config-String oder Verweis auf serverseitig gespeicherte Konfiguration;
- Tokenmodus `single_use` oder `reusable`;
- Ablaufdatum, optional CIDR-/Gerätebeschränkung;
- optionaler Pro-Modus (`normal`, `deploy`, `assign`).

Das Portal zeigt anschließend OS-spezifische Befehle an. Beispiel:

```powershell
$EnrollmentToken = '<einmaliger-wert>'
$Headers = @{ Authorization = "Bearer $EnrollmentToken" }
Invoke-RestMethod -Headers $Headers `
  -Uri 'https://book.example/api/enrollment/script/windows' |
  Invoke-Expression
```

Für Produktion ist ein signiertes Paket bzw. ein heruntergeladenes, lokal verifiziertes Skript sicherer als eine ungeprüfte Pipe in den Interpreter. Das Token sollte im Authorization-Header und nicht in Query-String, Dateiname oder Access-Log stehen.

### 4.3 Empfohlener Ablauf

```text
Admin erstellt Profil + Enrollment-Token
              │
Client ── POST /api/enrollments/claim ──> rustdesk-book
              │                           Token prüfen, Claim sperren,
              │                           kurze Session-Credential ausstellen
              ▼
Installiere gepinnte RustDesk-Version
Setze Config-String
Starte/prüfe Dienst
Generiere starkes permanentes Kennwort
Setze Kennwort mit --password
Lese ID mit --get-id
              │
Client ── POST /api/enrollments/finalize ─> rustdesk-book
         {id, hostname, os, version,
          password, claimNonce}
              │                           atomarer Upsert,
              │                           Passwort AES-256-GCM verschlüsseln,
              │                           Single-Use-Token verbrauchen
              ▼
Gerät erscheint im rustdesk-book
```

`finalize` sollte idempotent sein, damit ein Netzwerkabbruch nicht zu Dubletten führt. Ein einmaliger Token wird beim `claim` kurzzeitig reserviert und erst bei erfolgreichem `finalize` endgültig verbraucht; abgelaufene Claims werden freigegeben.

### 4.4 API-Vorschlag

```text
POST /api/enrollments/claim
Authorization: Bearer <enrollment-token>

200 {
  "claimToken": "kurzlebig-und-an-claim-gebunden",
  "configString": "...",
  "client": { "version": "1.4.9", "url": "...", "sha256": "..." },
  "profile": { "customer": "...", "tags": ["..."] }
}

POST /api/enrollments/finalize
Authorization: Bearer <claim-token>
Content-Type: application/json

{
  "rustdeskId": "123456789",
  "alias": "PC-123",
  "hostname": "PC-123",
  "os": "windows",
  "clientVersion": "1.4.9",
  "password": "zufällig-generiert",
  "machineFingerprint": "optional-stabiler-hash"
}
```

Die Antwort von `finalize` darf das Kennwort nicht zurückgeben. Request-Bodies dieses Endpunkts dürfen nicht geloggt oder in Traces/APM aufgenommen werden.

### 4.5 Datenmodell

Zusätzlich zu `devices` werden mindestens folgende Tabellen/Felder benötigt:

```text
enrollment_profiles
  id, name, customer, tags, allowed_os, token_mode,
  expires_at, disabled_at, created_by, created_at

enrollment_tokens
  id, profile_id, token_hash, token_prefix,
  max_uses, use_count, expires_at, revoked_at,
  last_used_at, created_at

enrollment_claims
  id, token_id, nonce_hash, state,
  claimed_at, expires_at, finalized_at,
  resulting_device_id
```

Empfehlungen:

- nur einen HMAC-/Hash-Prüfwert des Enrollment-Tokens speichern, nie den Klartext;
- mindestens 256 Bit Zufall für Tokens;
- atomare Prüfung/Erhöhung von `use_count` in einer DB-Transaktion;
- Rate Limits und Audit-Ereignisse für `created`, `claimed`, `finalized`, `failed`, `revoked`;
- eindeutige Geräteidentität als Kombination aus RustDesk-Server und RustDesk-ID bzw. zusätzlichem Maschinen-Fingerprint;
- bestehende Geräte nur aktualisieren, wenn Profil/Claim dazu berechtigt ist.

Der aktuelle rustdesk-book-Code verschlüsselt Gerätekennwörter bereits mit AES-256-GCM und gibt sie in Listen/Details nicht aus. `devices.rustdesk_id` ist derzeit jedoch nur indiziert, nicht eindeutig; ein Enrollment-Upsert benötigt deshalb eine explizite Identitäts- und Konfliktregel (`src/db/schema.ts`, `src/orpc/router/devices.ts`).

---

## 5. Einmaliger Token versus statischer GPO-/MDM-Token

| Eigenschaft | Einmaliger Token | Statischer Token |
|---|---|---|
| Standardfall | einzelne manuelle Installation | GPO, Intune, Jamf, RMM |
| Maximalnutzung | 1 | konfigurierbar/unbegrenzt |
| Ablauf | kurz, z. B. 24 Stunden | Rotation, z. B. 30–90 Tage |
| Schaden bei Diebstahl | ein fremdes Enrollment | Enrollment beliebig vieler Geräte bis Sperrung |
| Empfohlene Bindung | Profil + OS + kurzer Claim | Profil + Kunde + OS + Netz/MDM-Kontext |

Für GPO ist zu beachten: Ein in SYSVOL oder einem Computer-Startskript gespeicherter Bearer-Token kann von berechtigten Domänencomputern und Administratoren ausgelesen werden. Sicherer sind, in dieser Reihenfolge:

1. Geräteauthentisierung per mTLS/MDM-Zertifikat;
2. Abruf eines kurzlebigen Enrollment-Tokens über die Maschinenidentität;
3. pro OU/Kunde getrennte, rotierbare statische Tokens mit geringer Berechtigung;
4. ein globaler statischer Token nur als letzte Option.

Ein statischer rustdesk-book-Token darf nur `claim/finalize` ausführen und niemals Geräte lesen, Kennwörter anzeigen oder RustDesk-Pro administrieren.

---

## 6. Zusammenspiel mit RustDesk Server Pro

### Variante A – empfohlen, wenn möglich

„Require deployment for new devices“ bleibt aus. Der Client konfiguriert sich für den privaten Server, registriert sich beim ersten Kontakt normal und meldet ID/Kennwort separat an rustdesk-book. Es muss kein Pro-API-Token auf dem Client verteilt werden.

### Variante B – Pro verlangt explizites Deployment

Nach Installation und `--config` muss zusätzlich ausgeführt werden:

```text
rustdesk --deploy --token <pro-api-token>
```

Problem: Das Pro-API-Token landet zumindest kurzzeitig auf dem Endgerät und in der Prozesskommandozeile. Ein dedizierter Token mit ausschließlich der minimal erforderlichen Geräteberechtigung begrenzt das Risiko, ist laut Dokumentation aber weiterhin ein wiederverwendbarer API-Token.[^deployment-explicit]

Für echte Single-Use-Sicherheit wären eine serverseitig unterstützte kurzlebige Pro-Credential, eine Erweiterung des RustDesk-Pro-Deployments oder ein eigener, sorgfältig geprüfter Broker nötig. Ein Broker kann den offiziellen Clientaufruf nicht trivial ersetzen, weil `/api/devices/deploy` auch UUID und Public Key des Clients erwartet.[^deploy-source]

### Variante C – zusätzlich RustDesk-Pro-Adressbuch pflegen

Nach dem rustdesk-book-Finalize kann optional `--assign` mit demselben Alias/Kennwort ausgeführt werden. Dadurch entstehen allerdings zwei Passwortspeicher und zwei Konsistenzdomänen. Wenn rustdesk-book der führende Tresor sein soll, sollte diese Synchronisation optional und klar gekennzeichnet sein.

---

## 7. Sicherheitsanforderungen

1. Ausschließlich HTTPS; HSTS und keine sensitiven Request-Logs.
2. Token und Kennwort nie als URL-Parameter oder Skriptausgabe verwenden.
3. Clientseitig kryptographisch starkes Kennwort erzeugen; nicht das temporäre RustDesk-One-Time-Passwort erfassen.
4. Kennwort sofort mit `--password` setzen und einmalig an rustdesk-book übertragen; dort bestehende AES-256-GCM-Verschlüsselung verwenden.
5. Beachten, dass CLI-Argumente kurzfristig für privilegierte lokale Prozesse sichtbar sein können. RustDesk dokumentiert derzeit nur die Kennwortübergabe als Argument.
6. Installationsartefakte nach Architektur und OS pinnen und gegen einen serverseitig gepflegten Hash prüfen; keine ungeprüfte „latest“-Datei in einer Flotte ausrollen.
7. Enrollment-Endpunkte rate-limiten, Nutzlast begrenzen und gegen Replay schützen.
8. Single-Use-Verbrauch und Geräte-Upsert in einer Transaktion abschließen.
9. Statische Tokens pro Kunde/OU trennen, Nutzung überwachen und rotierbar/revozierbar machen.
10. RustDesk-Pro-Token niemals in einem öffentlich abrufbaren Skript, einer URL oder rustdesk-book-Datenantwort ausliefern, sofern Variante B nicht ausdrücklich und risikobewusst gewählt wurde.

---

## 8. Empfohlener Umsetzungsumfang für rustdesk-book

### MVP

- Enrollment-Profile im Adminbereich;
- einmalige und wiederverwendbare Token;
- `claim`/`finalize`-API;
- Windows-PowerShell-, Linux-Shell- und macOS-Shell-Generator;
- atomarer Device-Upsert und verschlüsselte Kennwortübernahme;
- Enrollment-Audit und Token-Widerruf;
- RustDesk-Config-String je Profil;
- getestete, gepinnte RustDesk-Version je Plattform.

### Danach

- GPO/MSI-Beispielpaket;
- Intune/Jamf/RMM-Vorlagen;
- mTLS bzw. OIDC Device Authorization für wiederholbare Flottenrollouts;
- optionaler RustDesk-Pro-Connector für Geräteabgleich und `--assign`;
- Heartbeat/Last-Seen-Agent oder Abgleich mit der Pro-Geräte-API;
- Token-Rotation und Anomalieerkennung.

## Entscheidung

**Ja, das Vorhaben ist realistisch.** Die sauberste Lösung ist nicht, einen RustDesk-Token zum rustdesk-book-Token umzudeuten, sondern:

- RustDesk über dessen offizielle CLI installieren und konfigurieren;
- ID und permanentes Kennwort lokal erzeugen/auslesen;
- diese Daten über einen eigenen, minimal berechtigten Enrollment-Flow in rustdesk-book registrieren;
- RustDesk-Pro-Deployment nur als optionalen zweiten Schritt behandeln.

So funktioniert derselbe Portal-Workflow mit RustDesk OSS und Pro, während GPO/MDM einen statischen Token verwenden können und Einzelinstallationen standardmäßig einen einmaligen Token erhalten.

---

## Primärquellen

[^deployment]: RustDesk, **Client Deployment** – offizielle Skripte für PowerShell, Batch, macOS und Linux sowie `--config`, `--password`, `--get-id`: https://rustdesk.com/docs/en/self-host/client-deployment/ (Quellstand: https://github.com/rustdesk/doc.rustdesk.com/blob/4f6c2b52178ac1e7fa0ff969a753ad471f4aceeb/content/self-host/client-deployment/_index.en.md)
[^deployment-normal]: RustDesk, **Explicit deployment for new devices** – normale automatische Registrierung beim ersten Serverkontakt: https://rustdesk.com/docs/en/self-host/client-deployment/#explicit-deployment-for-new-devices
[^deployment-explicit]: RustDesk, **Explicit deployment for new devices** – `--deploy --token`, erforderliche Berechtigung und optionale ID: https://rustdesk.com/docs/en/self-host/client-deployment/#explicit-deployment-for-new-devices
[^client-config]: RustDesk, **Client Configuration** – ID/Relay/API/Key, Export und `--config`: https://rustdesk.com/docs/en/self-host/client-configuration/ (Quelle: https://github.com/rustdesk/doc.rustdesk.com/blob/4f6c2b52178ac1e7fa0ff969a753ad471f4aceeb/content/self-host/client-configuration/_index.en.md)
[^msi]: RustDesk, **Windows MSI** – stille Installation und MSI-Parameter: https://rustdesk.com/docs/en/client/windows/msi/ (Quelle: https://github.com/rustdesk/doc.rustdesk.com/blob/4f6c2b52178ac1e7fa0ff969a753ad471f4aceeb/content/client/windows/MSI/_index.en.md)
[^linux]: RustDesk, **Linux Client** – Paketformate, Installationsbefehle und Wayland-Grenzen: https://rustdesk.com/docs/en/client/linux/ (Quelle: https://github.com/rustdesk/doc.rustdesk.com/blob/4f6c2b52178ac1e7fa0ff969a753ad471f4aceeb/content/client/linux/_index.en.md)
[^mac]: RustDesk, **macOS Client** – Accessibility, Screen Recording, Input Monitoring und TCC-Reset: https://rustdesk.com/docs/en/client/mac/ (Quelle: https://github.com/rustdesk/doc.rustdesk.com/blob/4f6c2b52178ac1e7fa0ff969a753ad471f4aceeb/content/client/mac/_index.en.md)
[^console-token]: RustDesk Server Pro, **Web Console → API Token** – Tokenberechtigungen, `--assign`, `--deploy` und Management-CLI: https://rustdesk.com/docs/en/self-host/rustdesk-server-pro/console/#api-token (Quelle: https://github.com/rustdesk/doc.rustdesk.com/blob/4f6c2b52178ac1e7fa0ff969a753ad471f4aceeb/content/self-host/rustdesk-server-pro/console/_index.en.md)
[^client-core]: RustDesk Client, CLI-Verarbeitung im offiziellen Quellcode: https://github.com/rustdesk/rustdesk/blob/b4af82157bc5b44b62e66c1e7b50cc945bc42532/src/core_main.rs#L439-L694
[^deploy-source]: RustDesk Client, Implementierung von `deploy_device`, Request an `/api/devices/deploy` mit ID, UUID und Public Key: https://github.com/rustdesk/rustdesk/blob/b4af82157bc5b44b62e66c1e7b50cc945bc42532/src/ui_interface.rs#L1049-L1097
[^client-overview]: RustDesk, **Client overview** – angezeigte ID und „One Time Password“: https://rustdesk.com/docs/en/client/ (Quelle: https://github.com/rustdesk/doc.rustdesk.com/blob/4f6c2b52178ac1e7fa0ff969a753ad471f4aceeb/content/client/_index.en.md)
