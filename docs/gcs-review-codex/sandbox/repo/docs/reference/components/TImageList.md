# TImageList

> Generierte Referenzkarte — Quelle: `src/components/TImageList.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0037` |
| Kategorie | media |
| Basisklasse | TImage |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TImageList` |
| Legacy-Typnamen (typeMapping) | ImageList |
| Schema-Datei | docs/schemas/schema_media.json |
| Verwendung in Projekten | 6 |
| Server-Methoden | — |
| Umfang | 162 Zeilen |

## Beschreibung

TImageList - Sprite-Sheet-Komponente Zeigt ein einzelnes Teilbild aus einem Sprite-Sheet (Raster-Bild) an. Das Quellbild wird durch `imageCountHorizontal` × `imageCountVertical` in gleichgroße Frames aufgeteilt. `currentImageNumber` (0-basiert) bestimmt, welcher Frame sichtbar ist. Verwaltung erfolgt über den dedizierten ImageListEditorDialog. Rendering: Der StageRenderer nutzt CSS `background-position` + `background-size` um den korrekten Ausschnitt des Sprite-Sheets sichtbar zu machen.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `imageCountHorizontal` | Spalten (H) | number | SPRITE SHEET |
| `imageCountVertical` | Zeilen (V) | number | SPRITE SHEET |
| `currentImageNumber` | Aktuelles Bild | number | SPRITE SHEET |
| `maxImageCount` | Max. Bilder | number | SPRITE SHEET |
| `openImageListEditor` | 🎞️ Editor öffnen | button | SPRITE SHEET |

## Ereignisse

`onFrameChange`

## Öffentliche Methoden

`getInspectorProperties`, `toDTO`

## Getter

`maxImageCount`, `frameWidthPercent`, `frameHeightPercent`, `currentColumn`, `currentRow`, `backgroundPositionX`, `backgroundPositionY`

## Verwendete in Projekten

- `game-server\public\projects\Kopfrechnen.json`
- `game-server\public\projects\LeonasAxolotlSpiel.json`
- `game-server\public\projects\Mathe-Insel-Flussbruecke.json`
- `game-server\public\projects\MathePuzzle.json`
- `game-server\public\projects\PuzzleNeu.json`
- `public\test-projects\PuzzleNeu.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `tests\editor_shelf.test.ts`
- `tests\nonvisual_inspector.test.ts`

## Quellen

- `src/components/TImageList.ts`
- `docs/schemas/schema_media.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
