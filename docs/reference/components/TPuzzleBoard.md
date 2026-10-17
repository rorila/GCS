# TPuzzleBoard

> Generierte Referenzkarte — Quelle: `src/components/TPuzzleBoard.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0061` |
| Kategorie | spiel |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TPuzzleBoard` |
| Legacy-Typnamen (typeMapping) | PuzzleBoard |
| Schema-Datei | docs/schemas/schema_game.json |
| Verwendung in Projekten | 4 |
| Server-Methoden | — |
| Umfang | 175 Zeilen |

## Beschreibung

TPuzzleBoard – Zielablage fuer Puzzleteile (Kleinkind-Modus). Zeigt das Zielbild transparent als Orientierungshilfe (Geisterbild). Puzzleteile, die in der Naehe ihrer Zielzelle fallen gelassen werden, rasten automatisch ein und werden arretiert (draggable=false). Typischer Flow: onDrop (dieses Board) → Task → call_method tryPlacePiece(${draggedObj}) Events: onPiecePlaced – ein Teil wurde korrekt eingerastet (data: piece, placedCount) onComplete    – alle Zellen belegt (placedCount === columns * rows)

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `imageSource` | Zielbild | image_picker | BILD |
| `columns` | Spalten | number | RASTER |
| `rows` | Zeilen | number | RASTER |
| `ghostOpacity` | Bild-Transparenz | number | VORSCHAU |
| `snapRadius` | Einrast-Genauigkeit (Zellen) | number | ABLEGEN |
| `placedCount` | Gelegte Teile | number | STATUS |

## Ereignisse

`onPiecePlaced`, `onComplete`

## Öffentliche Methoden

`getInspectorProperties`, `initRuntime`, `onRuntimeStop`, `tryPlacePiece`, `resetBoard`, `getEvents`

## Verwendete in Projekten

- `game-server\public\projects\Mathe-Rechenpuzzle.json`
- `game-server\public\projects\MathePuzzle.json`
- `game-server\public\projects\PuzzleNeu.json`
- `public\test-projects\PuzzleNeu.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `tests\puzzle_neu_flow.test.ts`

## Quellen

- `src/components/TPuzzleBoard.ts`
- `docs/schemas/schema_game.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
