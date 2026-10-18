# CMS — Benutzerperspektive und Funktionsumfang

Dokumentationsstatus: **entwurf** (quellverifiziert + vorhandene Screenshots; keine eigene UI-Sitzung)
Analyse-Stand: `53e3dfb` + uncommittete Änderungen · 2026-10-17

Das CMS (`scripts/cms/`, Port 8081, nur `127.0.0.1`) ist die organisatorische
Hülle um die Spiele: Personen, Häuser/Räume, Rollen, Spiel-Freigaben,
Karteikästen, Lernpunkte und Sponsoren. Die Oberfläche ist selbst ein
**GCS-Projekt** (`game-server/public/projects/GCS-CMS.json`) — Stages werden
serverseitig gerendert (`renderCms`).

> Benutzerperspektive: Dieses Dokument beschreibt, **was eine Person im CMS
> sieht und tun kann** — nach Rolle getrennt. Technische Sicherheit:
> `docs/features/multiplayer/sicherheit.md`.

## 1. Rollen und Ansichten

| Rolle | Einstieg | Was sie sieht |
|---|---|---|
| **Kind / Bewohner** | Emoji-Bildpasswort (4 Bilder aus Katalog) | Eigene Räume → Galerie der freigegebenen Spiele → Spiel starten; eigene Karteikarten-Lernstände |
| **Elternteil (`parent`)** | `/parent` — Account-Login | Kinder-Übersicht, Lernpunkte, Karteikasten-Verwaltung, Fortschritt |
| **HouseAdmin (`areaAdmin`)** | `/admin` → `/roles` | Hausverwaltung: Bewohner anlegen (idempotent), Räume, Spiel-Freigaben („welche Spiele im Raum erlaubt sind"), Avatare |
| **SuperAdmin (`superAdmin`@root)** | `/super` | Häuser, Sponsoren, Diagnose (`CMS_TRACE_ADMIN`), `GCS-SQL-Tool` (read-only) |
| **Sponsor** | `/sponsor` | Belohnungs-/Einladungsverwaltung für Karteikasten-Lernpunkte |
| **Observer** | `/observer` | Lesezugriff auf Fortschritt (z. B. Therapeut/Lehrer) |

Screenshots der Ansichten (Bestand, wiederverwendet):
`docs/cms-anmeldung*.png` (Einwahl), `cms-galerie.png`, `cms-hausverwaltung.png`,
`cms-superadmin*.png`, `cms-profil.png`, `cms-spiele-upload.png`,
`cms-avatar-upload.png`, `cms-room-table.png`, `cms-unified-stages.png`,
`cms-workflows.png`.

## 2. Einwahl (Kind)

Aus `docs/GCS-CMS-START.md` + `cms-anmeldung*.png` — **UI-getestet** (Bestandsdoku):

1. Profil wählen (Avatar + Name)
2. Vier Bilder in der gelernten Reihenfolge antippen (z. B. Hund→Baum→Haus→Elefant), `✓` bestätigen, `⌫` löscht letztes Bild
3. Erfolg → Raumliste („Spielegarten", „Sternenzimmer"); Sperre → Fehlermeldung
4. Tür-Symbol meldet ab; im Spiel führt ⬅ 🏠 zurück zur Galerie

Sitzung: zufälliges Cookie, 1 h, **keine** Adminrechte. Emoji-Passwort editierbar
(HouseAdmin), Avatar aus Katalog oder eigenem Upload (`uploads.normalizeAvatar`).

## 3. Spiel starten (Kind)

Galerie zeigt nur Spiele, die **dem Raum zugeordnet und für das Kind
freigegeben** sind (`can('play')`, siehe `sicherheit.md` §3–4):

```text
Klick auf Spielkachel → POST /launch → Einmal-Token
   → CMS prüft Session + Raum + Freigabe → 303 zum Spieleplayer
   → Fehlfall: 403 'Spiel nicht freigegeben'
```

Die Freigabe-Logik („HouseAdmin bestimmt welche Spiele im Raum gespielt werden
dürfen") ist das ursprüngliche Geschäftsziel — implementiert über
Raum↔Spiel-Zuordnung + `can('play')`.

## 4. Hausverwaltung (HouseAdmin)

Aus `GCS-CMS-HAUSVERWALTUNG.md` + `cms-hausverwaltung.png`:

- **Bewohner anlegen** — idempotent (doppeltes Anlegen erzeugt kein Duplikat),
  Avatar aus Katalog oder Upload, Emoji-Passwort vergeben/editieren
- **Räume verwalten** — Spiele Räumen zuordnen/entziehen
- **Bewohner-Detailstages** — Profil, Passwort-Reset, Zugehörigkeiten
- **Temporärer Raumzutritt** — `temporaryRoomAccess` mit `expiresAt`
  (z. B. Spielbesuch)

## 5. Eltern (`/parent`)

- Kinderliste mit Fortschritt und **Lernpunkten**
- **Karteikasten-Verwaltung** — Karten des Kindes ansehen/anlegen
  (`manageCards`, `viewCards` — nur eigene Kinder oder Eigendatensatz)
- Decks: `viewDeck`/`importDeck` mit `deckVisibleForChild`-Filter

## 6. Sponsor (`/sponsor`)

- Belohnungen an Lernpunkte des Karteikasten-Quiz koppeln
  (`docs/CMS-Karteikasten-Lernpunkte.md`, `docs/CMS-Sponsor-Umsetzungsplan.md`,
  `docs/sponsor-verbesserungen.md`)
- Einladungen/Tickets (`enrollSponsor`)

## 7. SuperAdmin (`/super`)

- Häuser- und Personenstamm, Sponsoren-Stammdaten
- `cms-super.cjs` `isSuper` prüft `superAdmin@root` mit aktivem `root`-Area
- Diagnose-Endpunkte hinter `CMS_TRACE_ADMIN` + SuperAdmin-Pflicht
  (`cms-server.cjs` Z. 125)
- `GCS-SQL-Tool`: deklaratives, read-only-SQL-Tool mit SuperAdmin-Auth
  (`scripts/cms/cms-sql-tool.cjs`, Test `test-cms-sql-tool.cjs` ✔ 11/11)

## 8. Serverseitige Stages

`renderCms` rendert GCS-Projektstages serverseitig zu HTML —
die Oberfläche ist **kein** separates Frontend, sondern das deklarative
Projekt `GCS-CMS.json` (`TServerStage`, `TServerEndpoint`, `onRequest`-Tasks).
Details: `docs/GCS-CMS-STAGES.md`, `docs/GCS-CMS-WORKFLOWS.md`.

## 9. Datenhaltung

- `game-server/data/cms-v1.json` — Arbeitsdatei (beim ersten Start aus
  `cms-demo.json` angelegt, nie überschrieben); `CMS_STORAGE=sqlite` aktiviert
  SQLite-Backend (Desktop-Default), Migrationsplan in
  `docs/CMS-Datenseparierung-und-DB-Migrationsplan.md`
- Idempotente Migrationen (v5→v6 u. a. `flashcards`-Collection)
- Backups: Infrastruktur vorhanden (`test-cms-sqlite.cjs` 12/12 ✔)

## 10. Nachweis-Status (Audit-Anforderung)

Klare Trennung zwischen dokumentiertem Code, Beispielen und getesteten Abläufen:

| Aussage | Nachweis-Status |
|---|---|
| Rollen, `can()`-Regeln, Cookies, Launch-Kette | **quellverifiziert** (`cms-core.cjs`, `cms-server.cjs` — Zeilenanker im Text) |
| Emoji-Einwahl, Galerie, ⬅🏠-Rückkehr, Sitzungsdauer | **UI-getestet** laut Bestandsdoku (`GCS-CMS-START.md` + `cms-anmeldung*.png`) — nicht von uns nachgespielt |
| Bewohner-Anlage, Avatar-Upload, Emoji-Passwort-Edit | **automatisiert getestet** (`test-cms-resident-create-avatar-emoji.cjs` 6/6 ✔, `test-cms-role-model.cjs` 93/93 ✔) |
| `GCS-SQL-Tool` (SuperAdmin, read-only) | **automatisiert getestet** (`test-cms-sqlite.cjs`/`test-cms-sql-tool.cjs` ✔) |
| Karteikasten, Lernpunkte, Sponsor-Flows | **dokumentiert, nicht eigenständig UI-geprüft** — Bestandsdoku + Beispielprojekte |
| HouseAdmin-Raum↔Spiel-Freigabe | **quellverifiziert** (`can('play')` + Raum-Zuordnung) — UI-Ablauf aus Bestandsdoku |

**Nicht geprüft in dieser Phase:** kein eigener CMS-Start, keine eigene
Browser-Session. Alle „UI-getestet"-Angaben stammen aus `docs/cms-*.png` +
Bestandsdokumenten, nicht aus eigener Durchführung.

## 11. Bekannte Grenzen (Bestandsdoku)

- **Kein** Live-Entzug eines laufenden Spiels — Sperre verhindert nur neue
  Starts (`GCS-CMS-START.md` „Befund")
- Öffentliche Spielkopien auf dem alten Plattformserver sind nicht geschützt
- Änderungen an `cms-v1.json` nur bei gestopptem Dienst
- `TAuthService`-Tokens der Engine sind simuliert — CMS nutzt eigenes
  Cookie/Session-Modell

## Verwandte Bestandsdokumente (Referenz, nicht dupliziert)

`GCS-CMS-START.md` (Einrichtung), `GCS-CMS-ANMELDUNG.md`, `GCS-CMS-SPIELSTART.md`,
`GCS-CMS-VERWALTUNG.md`, `GCS-CMS-PROFIL.md`, `GCS-CMS-UPLOADS.md`,
`GCS-CMS-SUPERADMIN.md`, `GCS-CMS-WORKFLOWS.md`, `CMS-Rollenmodell-Haus-Raum.md`,
`CMS-Spielstart-Vertrag.md`, `CMS-Testkatalog*.md`, `CMS-Datenschutz-Kinderschutz-Audit.md`
