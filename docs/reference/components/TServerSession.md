# TServerSession

> Generierte Referenzkarte — Quelle: `src/components/TServerSession.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0081` |
| Kategorie | server |
| Basisklasse | TServerDesignComponent |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TServerSession` |
| Legacy-Typnamen (typeMapping) | ServerSession |
| Schema-Datei | docs/schemas/schema_server.json |
| Verwendung in Projekten | 2 |
| Server-Methoden | 8 (`requireRole`, `logout`, `roles`, `chooseRole`, `createAdmin`, `createAccount`, `logoutAccount`, `roomPresence`) |
| Umfang | 11 Zeilen |

## Beschreibung

Erstellt nur nach erfolgreicher serverseitiger Prüfung eine Verwaltungssitzung.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `sessionPolicy` | Verbindlicher Sitzungsschutz | string | SERVER / SICHERHEIT |

## Öffentliche Methoden

`getInspectorProperties`

## Verwendete in Projekten

- `game-server\public\projects\GCS-CMS.json`
- `game-server\public\projects\GCS-SQL-Tool.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `scripts\test-cms-parent-role-choice.cjs`
- `scripts\test-cms-room-presence.cjs`
- `scripts\test-cms-stages.cjs`

## Quellen

- `src/components/TServerSession.ts`
- `scripts/cms/cms-server-components.cjs` (Server-Methoden)
- `docs/schemas/schema_server.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
