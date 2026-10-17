# TGridBoard

> Generierte Referenzkarte — Quelle: `src/components/TGridBoard.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0031` |
| Kategorie | spiel |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TGridBoard` |
| Legacy-Typnamen (typeMapping) | GridBoard |
| Schema-Datei | — |
| Verwendung in Projekten | 2 |
| Server-Methoden | — |
| Umfang | 279 Zeilen |

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `cols` | Spalten | number | RASTER |
| `rows` | Zeilen | number | RASTER |
| `palette` | Palette (JSON-Array) | json | RASTER |
| `cells` | Zellen (JSON-Matrix) | json | RASTER |
| `gridLines` | Gitterlinien zeigen | boolean | RASTER |
| `gridColor` | Gitterfarbe | color | RASTER |
| `overlayText` | Hinweistext | string | RASTER |

## Ereignisse

`onCellClick`, `onChanged`

## Öffentliche Methoden

`initRuntime`, `onRuntimeStop`, `setCell`, `getCell`, `fillAll`, `clearBoard`, `countFilled`, `canPlaceShape`, `placeShape`, `removeShape`, `findFullRows`, `removeRows`, `clearFullRows`, `setOverlay`, `clearOverlay`, `setGhost`, `clearGhost`, `setOverlayText`, `emitCellClick`, `getEvents`, `getInspectorProperties`, `toDTO`

## Verwendete in Projekten

- `game-server\public\projects\Mine2D.json`
- `game-server\public\projects\Tetris_Classic.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `scripts\test_classic_flow.ts`
- `scripts\test_gridboard.ts`
- `scripts\test_mine2d.ts`

## Quellen

- `src/components/TGridBoard.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
