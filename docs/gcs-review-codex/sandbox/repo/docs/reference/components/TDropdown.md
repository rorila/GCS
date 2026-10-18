# TDropdown

> Generierte Referenzkarte — Quelle: `src/components/TDropdown.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0019` |
| Kategorie | eingabe |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TDropdown` |
| Legacy-Typnamen (typeMapping) | Dropdown |
| Schema-Datei | docs/schemas/schema_inputs.json |
| Verwendung in Projekten | 8 |
| Server-Methoden | — |
| Umfang | 79 Zeilen |

## Beschreibung

TDropdown - Dropdown/Select component Allows users to select from a list of options. Useful for property editors, settings, menus, etc.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `options` | Options (comma-separated) | string | Specifics |
| `selectedIndex` | Selected Index | number | Specifics |
| `selectedValue` | Selected Value | string | Specifics |
| `style.color` | Text Color | color | Style |
| `style.borderColor` | Border Color | color | Style |

## Ereignisse

`onChange`

## Öffentliche Methoden

`selectValue`, `selectIndex`, `getInspectorProperties`, `toDTO`

## Verwendete in Projekten

- `game-server\public\projects\Aufgabenbereich-Karteikasten.json`
- `game-server\public\projects\GCS-CMS.json`
- `game-server\public\projects\Lernspiel-Geruest.json`
- `game-server\public\projects\Mathe-Insel-Flussbruecke.json`
- `game-server\public\projects\Mathe-Rechenballons.json`
- `game-server\public\projects\Mathe-Rechenpuzzle.json`
- `game-server\public\projects\Mathe-Zaehlen-Turmbau.json`
- `game-server\public\projects\project.json`

## Quellen

- `src/components/TDropdown.ts`
- `docs/schemas/schema_inputs.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
