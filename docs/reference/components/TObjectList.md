# TObjectList

> Generierte Referenzkarte — Quelle: `src/components/TObjectList.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0055` |
| Kategorie | daten |
| Basisklasse | TTable |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TObjectList` |
| Legacy-Typnamen (typeMapping) | ObjectList |
| Schema-Datei | docs/schemas/schema_table_data.json |
| Verwendung in Projekten | 20 |
| Server-Methoden | — |
| Umfang | 239 Zeilen |

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `sourceMode` | Datenmodus | select | List |
| `records` | Datensätze (JSON) | json | List |
| `recordKey` | Datensatz-Schlüssel | string | List |
| `fields` | Record-Felder (Schema) | record_schema | RECORDS |
| `items` | Enthaltene Objekte | object_list | List |
| `searchValue` | Suche (Wert) | string | List |
| `searchProperty` | Suche (Property) | string | List |

## Öffentliche Methoden

`tryReplaceRecords`, `getInspectorProperties`, `toDTO`, `replaceRecords`, `shuffle`, `ensureDefaults`, `getRecordValue`, `setRecordValue`, `resetField`, `rebuildData`, `applyChange`, `emitRecordEvent`, `initRuntime`

## Getter

`value`

## Verwendete in Projekten

- `game-server\public\projects\Breakout-Lernprojekt.json`
- `game-server\public\projects\ElinsMemory.json`
- `game-server\public\projects\ElinsMemoryRemote.json`
- `game-server\public\projects\GCS-CMS.json`
- `game-server\public\projects\GCS-FeatureVideos.json`
- `game-server\public\projects\GCS-SQL-Tool.json`
- `game-server\public\projects\Madn-Remote.json`
- `game-server\public\projects\Madn.json`
- `game-server\public\projects\Mathe-Insel-Flussbruecke.json`
- `game-server\public\projects\Mathe-Rechenballons.json`
- `game-server\public\projects\Mathe-Rechenpuzzle.json`
- `game-server\public\projects\Mathe-Zaehlen-Turmbau.json`
- `game-server\public\projects\MathePuzzle.json`
- `game-server\public\projects\MauMau.json`
- `game-server\public\projects\Mine2D.json`
- `game-server\public\projects\PuzzleNeu.json`
- `game-server\public\projects\Snake-Lernprojekt.json`
- `public\projects\Madn.json`
- `public\projects\MauMau.json`
- `public\test-projects\PuzzleNeu.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `scripts\test-cms-role-choice.cjs`
- `scripts\test-maumau.cjs`
- `scripts\test_mine2d.ts`
- `scripts\test_puzzle.ts`
- `tests\agent_controller_core.test.ts`
- `tests\image_gallery.test.ts`
- `tests\image_splitter.test.ts`
- `tests\nonvisual_inspector.test.ts`
- `tests\puzzle_neu_flow.test.ts`
- `tests\table_unwrapping.test.ts`

## Quellen

- `src/components/TObjectList.ts`
- `docs/schemas/schema_table_data.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
