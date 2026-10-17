# TRangeVariable

> Generierte Referenzkarte — Quelle: `src/components/TRangeVariable.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0063` |
| Kategorie | variablen |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TRangeVariable` |
| Legacy-Typnamen (typeMapping) | Range |
| Schema-Datei | docs/schemas/schema_variables.json |
| Verwendung in Projekten | — |
| Server-Methoden | — |
| Umfang | 51 Zeilen |

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `value` | Wert | number | Range |
| `min` | Minimum | number | Range |
| `max` | Maximum | number | Range |

## Ereignisse

`onMinReached`, `onMaxReached`, `onInside`, `onOutside`

## Öffentliche Methoden

`getInspectorProperties`, `getEvents`, `toDTO`

## Einschränkungen

- In keinem mitgelieferten Projekt verwendet.

## Quellen

- `src/components/TRangeVariable.ts`
- `docs/schemas/schema_variables.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
