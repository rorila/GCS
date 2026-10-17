# TToast

> Generierte Referenzkarte — Quelle: `src/components/TToast.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0115` |
| Kategorie | overlay |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TToast` |
| Legacy-Typnamen (typeMapping) | Toast |
| Schema-Datei | — |
| Verwendung in Projekten | 4 |
| Server-Methoden | — |
| Umfang | 448 Zeilen |

## Beschreibung

Toast notification type / export type ToastType = 'info' | 'success' | 'warning' | 'error'; /** Toast animation type / export type ToastAnimation = 'slide-left' | 'slide-up' | 'fade' | 'bounce'; /** Toast position / export type ToastPosition = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'; /** Internal toast item / interface ToastItem { id: number; message: string; type: ToastType; element: HTMLElement; } /** TToast - Toast notification component Shows brief, animated notifications that auto-dismiss. Configurable animations, positions, and styling.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `animation` | Animation | select | Animation |
| `position` | Position | select | Animation |
| `duration` | Duration (ms) | number | Timing |
| `maxVisible` | Max Visible | number | Timing |
| `infoColor` | Info Color | color | Colors |
| `successColor` | Success Color | color | Colors |
| `warningColor` | Warning Color | color | Colors |
| `errorColor` | Error Color | color | Colors |
| `textColor` | Text Color | color | Colors |
| `fontSize` | Font Size | number | Style |
| `borderRadius` | Border Radius | number | Style |
| `padding` | Padding | number | Style |

## Öffentliche Methoden

`show`, `info`, `success`, `warning`, `error`, `clear`, `getInspectorProperties`, `toDTO`, `createRuntimeElement`

## Getter

`hasVisualInspector`

## Verwendete in Projekten

- `game-server\public\projects\MathePuzzle.json`
- `game-server\public\projects\PingPong-Remote.json`
- `game-server\public\projects\PingPong.json`
- `public\test-projects\PingPong.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `tests\nonvisual_inspector.test.ts`

## Quellen

- `src/components/TToast.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
