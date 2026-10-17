# TImageGallery

> Generierte Referenzkarte — Quelle: `src/components/TImageGallery.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0036` |
| Kategorie | media |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TImageGallery` |
| Legacy-Typnamen (typeMapping) | ImageGallery |
| Schema-Datei | docs/schemas/schema_media.json |
| Verwendung in Projekten | 3 |
| Server-Methoden | — |
| Umfang | 53 Zeilen |

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `folder` | Bilderordner | string | BILDER |
| `columns` | Spalten | number | RASTER |
| `tileHeight` | Kachelhöhe | number | RASTER |
| `gap` | Abstand | number | RASTER |
| `selectionColor` | Auswahlfarbe | color | AUSWAHL |
| `showFileNames` | Dateinamen anzeigen | boolean | AUSWAHL |
| `selectedImage` | Gewähltes Bild | string | AUSWAHL |

## Ereignisse

`onSelectionChanged`

## Öffentliche Methoden

`getInspectorProperties`, `getEvents`, `initRuntime`, `selectImage`, `getSelectedImage`

## Verwendete in Projekten

- `game-server\public\projects\MathePuzzle.json`
- `game-server\public\projects\PuzzleNeu.json`
- `public\test-projects\PuzzleNeu.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `tests\image_gallery.test.ts`

## Quellen

- `src/components/TImageGallery.ts`
- `docs/schemas/schema_media.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
