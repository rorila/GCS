# Phase 0 — Bestandsaufnahme GCS-CMS

Stand: Analyse von `game-server/public/projects/GCS-CMS.json`,
`scripts/cms/*.cjs` und `game-server/data/cms-v1.json`.
Zugehöriger Plan: `docs/CMS-Plan.md` (P0.1, P0.2).

## 1. Feature-Inventar (Feature-Schablone, §4.4 des Plans)

### F-01 Emoji-Anmeldung (Kind)

- **Status:** umgesetzt
- **Client:** `stage_main` — 8 Emoji-Buttons → `SetAImoji` → `SetTheEmojiToTheRightPlace`
  → `Act_SetCode0–3` (schreiben `${self.text}`, also Emoji-**Zeichen**) → `Anmeldung`
  → `POST /api/cms/login` → `Angemeldet`/`AnmeldeFehler`
- **Server:** `stage_server_login` — `TServerEndpoint` → `TServerValidate` →
  `TServerAuthenticate` → `TServerResponse` (vertraglich geprüft durch
  `cms-login-workflow.cjs`)
- **Daten:** `codes` (personId + areaId + sequence), `people`, `areas`
- **Sicherheit:** Rate-Limit 20/min je IP; Session-Token 32 Byte, 1h Gültigkeit
- **Befund:** zwei konkurrierende Eingabepfade — `Waehle_*`-Tasks schreiben
  IDs (`dog`), sind aber **toter Code** (kein Event referenziert sie).
  Formatkonflikt Glyphen↔IDs → **behoben** durch kanonische Normalisierung
  in `cms-core.cjs` (`canonEmojiSeq`), `cms-admin.cjs`, `cms-house.cjs`.

### F-02 Raum- und Spielegalerie

- **Status:** umgesetzt
- **Client:** `stage_gallery` — `POST /api/cms/rooms`, `/games`, `/launch`,
  `/logout`; `TObjectList`/`TTable`, 4 Karten-Slots mit Paging
- **Server:** Direkte Routen in `cms-server.cjs`; `can('play')` =
  aktive Mitgliedschaft + Raum aktiv + `grant` + Spiel `published`
- **Daten:** `areas`, `memberships`, `games`, `grants`
- **Launch:** einmaliger `/play/<48hex>`-Token, gebunden an Session+Spiel;
  Uploads mit CSP `sandbox`/`connect-src 'none'`

### F-03 Eigenes Profil

- **Status:** umgesetzt
- **Client:** `stage_profile` — Name, Avatar, `TFilePicker`/`TFileUpload`
- **Server:** `stage_server_profile` — `TServerProfile` (read/save/help),
  geprüft durch `cms-profile.cjs`; `profileRequests` für Zugangshilfe
- **Upload:** `/api/cms/upload/avatar` — Bearer-Token, `sharp`-Re-Encode
  256px PNG, Auslieferung nur für referenzierte Avatare

### F-04 Verwaltungsanmeldung

- **Status:** umgesetzt
- **Client:** `stage_admin_login` → `POST /api/cms/admin-login`
- **Server:** `stage_server_admin_login` — Endpoint → Validate → Authenticate →
  `TServerSession` → Response (`cms-admin-workflow.cjs`)
- **Sicherheit:** scrypt + timingSafeEqual, Rate-Limit 10/min,
  HttpOnly+SameSite=Strict Cookie, 30min, `verified`-WeakSet gegen
  ungeprüfte Sitzungserstellung

### F-05 RaumAdmin (`stage_admin`)

- **Status:** umgesetzt — Mitglieder, Spielfreigaben (`grant`), Emoji-Code-Vergabe,
  Raum-Backup/Restore (grants+memberships)
- **Server:** `cms-admin.cjs`, Zuständigkeit über `can('manageArea')` + `within()`

### F-06 HouseAdmin (`stage_house`)

- **Status:** umgesetzt — Räume anlegen/aktualisieren, Spielerprofile mit
  Emoji-Code anlegen, RaumAdmin zuweisen (`cms-house.cjs`)

### F-07 SuperAdmin (`stage_super`, `stage_library`)

- **Status:** umgesetzt — Häuser, HouseAdmin-Zuweisung, Einladungslinks
  (24h, einmalig, sha256-gehasht, Issuer muss berechtigt bleiben),
  `/admin-enroll`-Formular, eigene Spiele-Uploads + `publish/draft`

## 2. Endpunkt-Abgleich (Client ↔ Server)

24 unterschiedliche Client-Aufrufe — alle haben Server-Handler.
Auffällig: `/api/cms/admin/${VerwaltungsModus}` als dynamische Route-Variable.

## 3. Datenmodell (Ist)

`people`, `areas` (root/house/room, parentId-Hierarchie), `memberships`,
`roles` (player/areaAdmin/superAdmin/oversight — harte Strings),
`guardians` (**angelegt, aber von keinem Endpunkt genutzt**), `games`,
`grants`, `codes`, `audit`, `profileRequests`, `adminInvites`,
`roomBackups`, `version:1`.

## 4. Berechtigungsmatrix (Ist)

| Aktion | Regel (Ist) |
|---|---|
| Spiel starten | aktive Mitgliedschaft + Raum aktiv + `grant` + `published` |
| Raum verwalten | `areaAdmin` innerhalb der Hierarchie |
| Haus verwalten | `areaAdmin` auf dem Haus |
| SuperAdmin | `superAdmin` auf `root` |
| Spiel-Upload | SuperAdmin + Eigentümer; Status `draft` |
| Avatar-Upload | angemeldeter Spieler, nur eigenes |
| Profil | nur eigenes |
| Eltern-Sicht | **fehlt** — `guardians` wird nicht abgefragt |
| Beobachter | **fehlt** |

## 5. Vorhandene Schutzmaßnahmen (verifiziert)

scrypt+timingSafeEqual · Rate-Limits · einmalige gehashte Einladungen ·
atomare Speicherung (tmp+rename, `.previous`) · Schema-Validierung je Commit ·
Upload-Strukturprüfung (kein `__proto__`, keine externen Medienpfade,
Größenlimits aus `TServerUpload`) · `sharp`-Re-Encode · CSP-Sandbox für
Uploads · Host-/Origin-Prüfung · Trace-Maskierung + SuperAdmin-Gate ·
Audit-Collection.

## 6. Befunde / Lücken

| # | Befund | Status |
|---|---|---|
| 1 | Emoji-Code-Formatkonflikt (Glyphen↔IDs) | **behoben** via `canonEmojiSeq` |
| 2 | `guardians` ungenutzt | offen |
| 3 | `can()` hartcodierte Rollen, keine Capability-Listen | offen |
| 4 | Kein API-Versioning | offen |
| 5 | Sessions im RAM (Neustart = Logout) | akzeptabel v1, dokumentieren |
| 6 | Cookie ohne `Secure`, Origin-Check statt CSRF-Token | für Internetbetrieb ergänzen |
| 7 | Nur localhost-Bindung | für Internet-Multiplayer zu klären |
| 8 | Nur eine Sicherungsebene (`.previous`) | offen |
| 9 | `cms-shell.js` nutzt Runtime-Interna + 100ms-Polling | fragil |
| 10 | iframe `allow-scripts allow-same-origin` selbst-entfernbar | prüfen |
| 11 | `test-cms-*` (10 Skripte) nicht in `npm test` | offen |
| 11a | `test-cms.cjs` ist veraltet: erwartet die alte Karten-UI (`Karte0–3`), seit der Tabellen-Umstellung zeigt `RaumTabelle` (TTable) die Räume — verifiziert: `RaumTabelle.data` enthält beide Räume korrekt | Test aktualisieren oder durch `test-cms-room-table.cjs` ersetzen |
| 12 | Keine Spielsitzungen/Zeitbuchung/Bewertungen/Pairing | Phase 3/4 |

## 7. Empfohlene neue Server-Komponenten

`TServerAuthorize` (sichtbarer Rechteschritt), `TServerRateLimit`,
`TServerGuardian` (Beziehungen — Collection existiert), `TServerPlaySession`,
`TServerProgress`, `TServerAudit`, `TServerInvite` (generisch),
`TServerMedia` (Bibliothek).

Nicht nötig als eigene Komponenten: Benachrichtigungen, Backup-Scheduler,
Suche — vorerst normale Admin-Endpunkte.

## 8. Korrigierter Emoji-Befund (Fix vom 22.09.)

- Live-Pfad sendet Emoji-**Zeichen** (`${self.text}`); Daten speichern Zeichen →
  Login funktionierte für Bestandsdaten.
- Admin-UI (`code`, `person-create`) speicherte dagegen **IDs** →
  admin-vergebene Codes konnten sich nie einloggen.
- `Waehle_*`-Tasks (ID-basiert) sind toter Code.
- Fix: kanonische Normalisierung auf IDs beim Vergleich (`core.login`),
  beim Speichern (`admin`, `house`) und in der Duplikatprüfung (`validate`).
  Keine Datenmigration nötig; beide Formate funktionieren.
- Verifiziert: Glyph-Login, ID-Login, Admin-ID-Code + Glyph-Login,
  formatübergreifende Duplikaterkennung.
