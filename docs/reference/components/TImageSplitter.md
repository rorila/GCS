# TImageSplitter

> Generierte Referenzkarte — Quelle: `src/components/TImageSplitter.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0038` |
| Kategorie | media |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TImageSplitter` |
| Legacy-Typnamen (typeMapping) | ImageSplitter |
| Schema-Datei | docs/schemas/schema_media.json |
| Verwendung in Projekten | 3 |
| Server-Methoden | — |
| Umfang | 127 Zeilen |

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `imageSource` | Bildquelle | image_picker | BILD |
| `rows` | Zeilen | number | AUFTEILUNG |
| `columns` | Spalten | number | AUFTEILUNG |
| `pieceShape` | Teileform | select | AUFTEILUNG |
| `tabSize` | Zapfengröße | number | AUFTEILUNG |
| `pieceCount` | Anzahl der Teile | number | AUFTEILUNG |
| `coverToAspect` | Auf Splitter-Seitenverhältnis zuschneiden | boolean | VORSCHAU |
| `showLines` | Trennlinien anzeigen | boolean | VORSCHAU |
| `lineColor` | Linienfarbe | color | VORSCHAU |
| `previewGap` | Vorschau-Abstand | number | VORSCHAU |
| `outputList` | Ausgabeliste | select | AUSGABE |
| `generatePieces` | Teile erzeugen | button | AUSGABE |

## Öffentliche Methoden

`getInspectorProperties`, `applyChange`, `initRuntime`, `onRuntimeStop`, `generatePieces`

## Getter

`imageBounds`, `fittedPieceWidth`, `fittedPieceHeight`, `tabDepth`, `trayLayout`, `pieceCount`, `pieceWidth`, `pieceHeight`

## Verwendete in Projekten

- `game-server\public\projects\MathePuzzle.json`
- `game-server\public\projects\PuzzleNeu.json`
- `public\test-projects\PuzzleNeu.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `tests\image_gallery.test.ts`
- `tests\image_splitter.test.ts`

## Quellen

- `src/components/TImageSplitter.ts`
- `docs/schemas/schema_media.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
