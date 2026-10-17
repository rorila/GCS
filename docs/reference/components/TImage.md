# TImage

> Generierte Referenzkarte — Quelle: `src/components/TImage.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0035` |
| Kategorie | media |
| Basisklasse | TPanel |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TImage` |
| Legacy-Typnamen (typeMapping) | Image |
| Schema-Datei | docs/schemas/schema_display.json |
| Verwendung in Projekten | 11 |
| Server-Methoden | — |
| Umfang | 109 Zeilen |

## Beschreibung

TImage - Eigenständige Bild-Komponente Zeigt ein Bild an, das auf dem Server gespeichert ist. Erbt von TPanel für Container-Funktionalität. Das eigentliche Rendering erfolgt durch den Stage-Renderer, diese Klasse hält nur die Daten.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `src` | Bildquelle | image_picker | BILD |
| `objectFit` | Skalierung | select | BILD |
| `alt` | Alt-Text | string | BILD |
| `imageOpacity` | Bild-Deckkraft | number | BILD |
| `fallbackColor` | Fallback-Farbe | color | BILD |
| `matchValue` | Match-Wert | number | DATEN |

## Öffentliche Methoden

`getInspectorProperties`

## Getter

`src`, `backgroundImage`, `objectFit`, `imageOpacity`

## Verwendete in Projekten

- `game-server\public\projects\ElinsMemory.json`
- `game-server\public\projects\ElinsMemoryRemote.json`
- `game-server\public\projects\GCS-CMS.json`
- `game-server\public\projects\Madn-Remote.json`
- `game-server\public\projects\Madn.json`
- `game-server\public\projects\MauMau.json`
- `game-server\public\projects\PingPong-Remote.json`
- `game-server\public\projects\PingPong.json`
- `public\projects\Madn.json`
- `public\projects\MauMau.json`
- `public\test-projects\PingPong.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `scripts\test-cms-resident-create-avatar-emoji.cjs`
- `scripts\test-maumau.cjs`
- `tests\editor_shelf.test.ts`
- `tests\image_gallery.test.ts`
- `tests\image_splitter.test.ts`
- `tests\nonvisual_inspector.test.ts`

## Quellen

- `src/components/TImage.ts`
- `docs/schemas/schema_display.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
