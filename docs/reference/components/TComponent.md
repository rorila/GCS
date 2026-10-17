# TComponent

> Generierte Referenzkarte — Quelle: `src/components/TComponent.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0014` |
| Kategorie | basis |
| Basisklasse | — |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | — |
| Runtime-Registry (utils, Selbstreg.) | — |
| Schema-Datei | — |
| Verwendung in Projekten | — |
| Server-Methoden | — |
| Umfang | 360 Zeilen |

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `name` | Name | string | IDENTITÄT |
| `draggable` | Draggable | boolean | INTERAKTION |
| `droppable` | Droppable | boolean | INTERAKTION |
| `dragMode` | Drag Mode | select | INTERAKTION |

## Ereignisse

`onClick`, `onDoubleClick`, `onMouseEnter`, `onMouseLeave`, `onDragStart`, `onDragEnd`, `onDrop`, `onTouchStart`, `onTouchMove`, `onTouchEnd`, `onFlipMidpoint`

## Öffentliche Methoden

`getInspectorSections`, `applyChange`, `getEvents`, `getInspectorEvents`, `toDTO`, `toJSON`, `addChild`, `removeChild`, `findChild`, `valueOf`, `toString`

## Getter

`hasVisualInspector`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `tests\component_events.test.ts`
- `tests\flow_data_action.test.ts`
- `tests\guards.test.ts`
- `tests\nonvisual_inspector.test.ts`

## Quellen

- `src/components/TComponent.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
