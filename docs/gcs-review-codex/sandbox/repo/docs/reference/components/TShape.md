# TShape

> Generierte Referenzkarte — Quelle: `src/components/TShape.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0088` |
| Kategorie | anzeige |
| Basisklasse | TPanel |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TShape` |
| Legacy-Typnamen (typeMapping) | Shape |
| Schema-Datei | docs/schemas/schema_display.json |
| Verwendung in Projekten | 1 |
| Server-Methoden | — |
| Umfang | 75 Zeilen |

## Beschreibung

TShape - Vielseitige Grafik-Komponente Unterstützt verschiedene geometrische Formen und dient als Container für Kind-Komponenten (z.B. Emojis via TLabel).

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `shapeType` | Form-Typ | select | FORM |
| `fillColor` | Füllfarbe | color | FORM |
| `strokeColor` | Linienfarbe (Rand) | color | FORM |
| `strokeWidth` | Linienstärke | number | FORM |
| `opacity` | Deckkraft | number | FORM |
| `text` | Text/Emoji | string | INHALT |
| `contentImage` | Bild-Inhalt | image_picker | INHALT |

## Öffentliche Methoden

`getInspectorProperties`, `toDTO`

## Verwendete in Projekten

- `game-server\public\projects\GCS-CMS.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `tests\serialization.test.ts`

## Quellen

- `src/components/TShape.ts`
- `docs/schemas/schema_display.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
