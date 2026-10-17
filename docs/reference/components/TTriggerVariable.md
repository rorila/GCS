# TTriggerVariable

> Generierte Referenzkarte — Quelle: `src/components/TTriggerVariable.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0116` |
| Kategorie | variablen |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TTriggerVariable` |
| Legacy-Typnamen (typeMapping) | Trigger |
| Schema-Datei | docs/schemas/schema_variables.json |
| Verwendung in Projekten | — |
| Server-Methoden | — |
| Umfang | 46 Zeilen |

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `value` | Wert | string | Trigger |
| `triggerValue` | Trigger-Wert | string | Trigger |

## Ereignisse

`onTriggerEnter`, `onTriggerExit`

## Öffentliche Methoden

`getInspectorProperties`, `getEvents`, `toDTO`

## Einschränkungen

- In keinem mitgelieferten Projekt verwendet.

## Quellen

- `src/components/TTriggerVariable.ts`
- `docs/schemas/schema_variables.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
