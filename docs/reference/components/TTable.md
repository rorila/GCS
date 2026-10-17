# TTable

> Generierte Referenzkarte — Quelle: `src/components/TTable.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0108` |
| Kategorie | daten |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TTable` |
| Legacy-Typnamen (typeMapping) | Table |
| Schema-Datei | docs/schemas/schema_table_data.json |
| Verwendung in Projekten | 7 |
| Server-Methoden | — |
| Umfang | 123 Zeilen |

## Beschreibung

TTable - Eine dynamische Tabellen-Komponente. Visualisiert Arrays von Objekten (z.B. aus APIs oder Variablen). Besitzt Auto-Column-Generierung als Fallback in Stage.ts.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `dataSource` | Objektliste (Datenquelle) | select | Tabelle |
| `keyField` | Schlüsselfeld | string | Tabelle |
| `selectedKey` | Ausgewählter Schlüssel | string | Auswahl |
| `selectedRecord` | Ausgewählter Datensatz | json | Auswahl |
| `data` | Daten-Basis (JSON) | json | Tabelle |
| `columns` | Spalten (JSON) | json | Tabelle |
| `displayMode` | Anzeige-Modus | select | Tabelle |
| `flippable` | Karten umdrehbar | boolean | Tabelle |
| `cardConfig` | Karten-Design (JSON) | json | Tabelle |
| `rowHeight` | Zeilenhöhe (px) | number | Tabelle |
| `showHeader` | Kopfzeile zeigen | boolean | Tabelle |
| `striped` | Zebra-Streifen | boolean | Tabelle |

## Ereignisse

`onSelect`, `onRowClick`, `onSelectionChanged`, `onDoubleClick`, `onAction`

## Öffentliche Methoden

`initRuntime`, `onRuntimeUpdate`, `onRuntimeStop`, `setDataContext`, `getRows`, `selectRow`, `getEvents`, `getInspectorProperties`, `toDTO`

## Verwendete in Projekten

- `game-server\public\projects\GCS-CMS.json`
- `game-server\public\projects\GCS-FeatureVideos.json`
- `game-server\public\projects\GCS-SQL-Tool.json`
- `game-server\public\projects\Mathe-Insel-Flussbruecke.json`
- `game-server\public\projects\Mathe-Rechenballons.json`
- `game-server\public\projects\Mathe-Rechenpuzzle.json`
- `game-server\public\projects\Mathe-Zaehlen-Turmbau.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `scripts\test-cms-resident-create-avatar-emoji.cjs`
- `scripts\test-cms-role-choice.cjs`
- `scripts\test-katalog-3-eltern.cjs`
- `scripts\test_runner.ts`
- `tests\table_unwrapping.test.ts`

## Quellen

- `src/components/TTable.ts`
- `docs/schemas/schema_table_data.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
