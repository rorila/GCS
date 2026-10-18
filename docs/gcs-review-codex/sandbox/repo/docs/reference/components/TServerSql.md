# TServerSql

> Generierte Referenzkarte — Quelle: `src/components/TServerSql.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0084` |
| Kategorie | server |
| Basisklasse | TServerDesignComponent |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TServerSql` |
| Legacy-Typnamen (typeMapping) | ServerSql |
| Schema-Datei | docs/schemas/schema_server.json |
| Verwendung in Projekten | 1 |
| Server-Methoden | 1 (`query`) |
| Umfang | 11 Zeilen |

## Beschreibung

Führt serverseitig eine lesende Rohe-SQL-Abfrage auf dem SQLite-Bestand aus (readOnly-Verbindung, Zeilenlimit).

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `queryPolicy` | Verbindliche Abfrageregel | string | SERVER / SICHERHEIT |

## Öffentliche Methoden

`getInspectorProperties`

## Verwendete in Projekten

- `game-server\public\projects\GCS-SQL-Tool.json`

## Quellen

- `src/components/TServerSql.ts`
- `scripts/cms/cms-server-components.cjs` (Server-Methoden)
- `docs/schemas/schema_server.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
