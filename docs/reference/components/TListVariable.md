# TListVariable

> Generierte Referenzkarte — Quelle: `src/components/TListVariable.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0050` |
| Kategorie | variablen |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TListVariable` |
| Legacy-Typnamen (typeMapping) | List |
| Schema-Datei | docs/schemas/schema_variables.json |
| Verwendung in Projekten | 13 |
| Server-Methoden | — |
| Umfang | 45 Zeilen |

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `items` | Werte | value_list | List |

## Ereignisse

`onItemAdded`, `onItemRemoved`, `onCleared`

## Öffentliche Methoden

`getInspectorProperties`, `getEvents`, `toDTO`

## Verwendete in Projekten

- `game-server\public\projects\ElinsMemory.json`
- `game-server\public\projects\ElinsMemoryRemote.json`
- `game-server\public\projects\Madn-Remote.json`
- `game-server\public\projects\Madn.json`
- `game-server\public\projects\MauMau.json`
- `game-server\public\projects\Mine2D.json`
- `game-server\public\projects\Snake-Lernprojekt.json`
- `game-server\public\projects\SuperMario_Templates.json`
- `game-server\public\projects\Tetris_Classic.json`
- `public\projects\Madn.json`
- `public\projects\MauMau.json`
- `public\projects\MemoryGame.json`
- `public\test-projects\MemoryGame.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `scripts\test-export-patterns.cjs`
- `scripts\test_classic_flow.ts`
- `tests\foreach_repeater.test.ts`
- `tests\nonvisual_inspector.test.ts`
- `tests\table_unwrapping.test.ts`

## Quellen

- `src/components/TListVariable.ts`
- `docs/schemas/schema_variables.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
