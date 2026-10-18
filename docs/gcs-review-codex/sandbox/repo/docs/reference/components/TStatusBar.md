# TStatusBar

> Generierte Referenzkarte — Quelle: `src/components/TStatusBar.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0101` |
| Kategorie | anzeige |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TStatusBar` |
| Legacy-Typnamen (typeMapping) | StatusBar |
| Schema-Datei | — |
| Verwendung in Projekten | 3 |
| Server-Methoden | — |
| Umfang | 308 Zeilen |

## Beschreibung

Status bar section configuration / export interface StatusSection { id: string; text: string; icon?: string; width?: number | 'auto'; align?: 'left' | 'center' | 'right'; clickTask?: string;  // Task name to execute on click } /** TStatusBar - Persistent status bar component Shows persistent status information in sections. Can be placed at the bottom of the screen or anywhere in the scene.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `text` | Status Text | string | Basic |
| `textColor` | Text Color | color | Style |
| `fontSize` | Font Size | number | Style |
| `paddingX` | Padding X | number | Style |
| `paddingY` | Padding Y | number | Style |
| `sectionGap` | Section Gap | number | Style |
| `separatorColor` | Separator Color | color | Style |
| `showSeparators` | Show Separators | boolean | Style |
| `style.borderColor` | Border Color | color | Style |

## Öffentliche Methoden

`setSection`, `getSection`, `removeSection`, `setConnectionStatus`, `setPlayerInfo`, `clear`, `getInspectorProperties`, `toDTO`, `createRuntimeElement`, `getRuntimeElement`

## Getter

`hasVisualInspector`

## Verwendete in Projekten

- `game-server\public\projects\PingPong-Remote.json`
- `game-server\public\projects\PingPong.json`
- `public\test-projects\PingPong.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `tests\nonvisual_inspector.test.ts`

## Quellen

- `src/components/TStatusBar.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
