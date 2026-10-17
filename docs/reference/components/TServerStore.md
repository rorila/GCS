# TServerStore

> Generierte Referenzkarte — Quelle: `src/components/TServerStore.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0085` |
| Kategorie | server |
| Basisklasse | TServerDesignComponent |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TServerStore` |
| Legacy-Typnamen (typeMapping) | ServerStore |
| Schema-Datei | — |
| Verwendung in Projekten | 1 |
| Server-Methoden | 17 (`create`, `update`, `delete`, `upsert`, `setRole`, `setRoomAdmin`, `replaceRoomAdmin`, `personActive`, `setEmojiCode`, `roomBackup`, `roomRestore`, `budgetSet`, `budgetPropose`, `budgetApprove`, `createHouseResident`, `setHouseMembership`, `createPlayer`) |
| Umfang | 11 Zeilen |

## Beschreibung

Schreibt nur serverseitig in den CMS-Datenbestand — jede Änderung läuft über den Audit-Commit.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `storePolicy` | Verbindliche Schreibregel | string | SERVER / SICHERHEIT |

## Öffentliche Methoden

`getInspectorProperties`

## Verwendete in Projekten

- `game-server\public\projects\GCS-CMS.json`

## Quellen

- `src/components/TServerStore.ts`
- `scripts/cms/cms-server-components.cjs` (Server-Methoden)

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
