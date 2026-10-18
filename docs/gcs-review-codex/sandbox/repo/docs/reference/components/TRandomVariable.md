# TRandomVariable

> Generierte Referenzkarte — Quelle: `src/components/TRandomVariable.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0062` |
| Kategorie | variablen |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TRandomVariable` |
| Legacy-Typnamen (typeMapping) | Random |
| Schema-Datei | docs/schemas/schema_variables.json |
| Verwendung in Projekten | 4 |
| Server-Methoden | — |
| Umfang | 77 Zeilen |

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `min` | Minimum | number | Random |
| `max` | Maximum | number | Random |
| `isInteger` | Nur Ganzzahlen | boolean | Random |
| `value` | Aktueller Wert | number | Random |

## Ereignisse

`onGenerated`

## Öffentliche Methoden

`getInspectorProperties`, `getEvents`, `toDTO`, `generate`

## Getter

`randomValue`

## Verwendete in Projekten

- `game-server\public\projects\Kopfrechnen.json`
- `game-server\public\projects\LeonasAxolotlSpiel.json`
- `game-server\public\projects\Zahlen-Duell.json`
- `public\test-projects\ZahlenDuell.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `tests\mathe_quiz.test.ts`

## Quellen

- `src/components/TRandomVariable.ts`
- `docs/schemas/schema_variables.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
