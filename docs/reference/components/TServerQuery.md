# TServerQuery

> Generierte Referenzkarte — Quelle: `src/components/TServerQuery.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0078` |
| Kategorie | server |
| Basisklasse | TServerDesignComponent |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TServerQuery` |
| Legacy-Typnamen (typeMapping) | ServerQuery |
| Schema-Datei | — |
| Verwendung in Projekten | 1 |
| Server-Methoden | 21 (`list`, `optionList`, `find`, `exists`, `areaActive`, `can`, `houseOf`, `codeTaken`, `backup`, `childCard`, `childCards`, `recentSessions`, `progressList`, `childRooms`, `setChildMembership`, `contexts`, `roomsFor`, `gamesFor`, `page`, `pulse`, `libraryList`) |
| Umfang | 11 Zeilen |

## Beschreibung

Führt nur serverseitig deklarative Abfragen gegen den CMS-Datenbestand aus (Spec liegt in den Action-Params).

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `queryPolicy` | Verbindliche Abfrageregel | string | SERVER / SICHERHEIT |

## Öffentliche Methoden

`getInspectorProperties`

## Verwendete in Projekten

- `game-server\public\projects\GCS-CMS.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `scripts\test-cms-room-presence.cjs`
- `scripts\test-cms-testdata.cjs`

## Quellen

- `src/components/TServerQuery.ts`
- `scripts/cms/cms-server-components.cjs` (Server-Methoden)

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
