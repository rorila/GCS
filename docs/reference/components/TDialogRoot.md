# TDialogRoot

> Generierte Referenzkarte — Quelle: `src/components/TDialogRoot.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0018` |
| Kategorie | overlay |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TDialogRoot` |
| Legacy-Typnamen (typeMapping) | DialogRoot |
| Schema-Datei | docs/schemas/schema_dialogs.json |
| Verwendung in Projekten | 2 |
| Server-Methoden | — |
| Umfang | 435 Zeilen |

## Beschreibung

TDialogRoot - Container component for dialogs Extends TWindow directly (not TPanel to avoid internal label issues). Objects placed inside the dialog bounds become children. Provides modal/non-modal behavior and show/hide functionality.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `title` | Title | string | Dialog |
| `modal` | Modal | boolean | Dialog |
| `closable` | Closable | boolean | Dialog |
| `draggableAtRuntime` | Draggable | boolean | Dialog |
| `centerOnShow` | Center on Show | boolean | Dialog |
| `slideDirection` | Slide-Richtung | select | Dialog |
| `style.borderColor` | Border Color | color | Style |
| `style.borderWidth` | Border Width | number | Style |

## Öffentliche Methoden

`show`, `hide`, `close`, `cancel`, `toggle`, `containsPoint`, `containsObject`, `getInspectorProperties`, `getInspectorEvents`, `toDTO`, `createRuntimeElement`, `getContentContainer`, `updateRuntimeVisibility`

## Getter

`title`, `caption`

## Verwendete in Projekten

- `public\projects\MemoryGame.json`
- `public\test-projects\MemoryGame.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `tests\editor_shelf.test.ts`
- `tests\side_panel.test.ts`
- `tests\stage_transition_regression.test.ts`

## Quellen

- `src/components/TDialogRoot.ts`
- `docs/schemas/schema_dialogs.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
