# TThresholdVariable

> Generierte Referenzkarte — Quelle: `src/components/TThresholdVariable.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0113` |
| Kategorie | variablen |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TThresholdVariable` |
| Legacy-Typnamen (typeMapping) | Threshold |
| Schema-Datei | docs/schemas/schema_variables.json |
| Verwendung in Projekten | — |
| Server-Methoden | — |
| Umfang | 70 Zeilen |

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `value` | Wert | number | Threshold |
| `threshold` | Schwellenwert | number | Threshold |
| `comparison` | Vergleich | select | Threshold |

## Ereignisse

`onThresholdReached`, `onThresholdLeft`, `onThresholdExceeded`

## Öffentliche Methoden

`getInspectorProperties`, `isThresholdReached`, `getEvents`, `toDTO`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `tests\agent_controller_core.test.ts`

## Einschränkungen

- In keinem mitgelieferten Projekt verwendet.

## Quellen

- `src/components/TThresholdVariable.ts`
- `docs/schemas/schema_variables.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
