# TList

> Generierte Referenzkarte — Quelle: `src/components/TList.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0049` |
| Kategorie | daten |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TList` |
| Schema-Datei | — |
| Verwendung in Projekten | — |
| Server-Methoden | — |
| Umfang | 54 Zeilen |

## Beschreibung

TList - Eine datengetriebene Listen-Komponente. Zeigt eine Liste von Elementen an und erlaubt Selektion. Verwendet Grid-Zellen für die Dimensionierung.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `items` | Items (JSON) | json | LISTE |
| `displayField` | Anzeige-Feld | string | LISTE |
| `itemHeight` | Zeilenhöhe (Cells) | number | LISTE |
| `selectedIndex` | Gewählter Index | number | LISTE |

## Ereignisse

`onSelect`, `onDoubleClick`

## Öffentliche Methoden

`getEvents`, `getInspectorProperties`, `toDTO`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `scripts\test-export-patterns.cjs`
- `scripts\test_classic_flow.ts`
- `tests\foreach_repeater.test.ts`
- `tests\nonvisual_inspector.test.ts`
- `tests\table_unwrapping.test.ts`

## Einschränkungen

- In keinem mitgelieferten Projekt verwendet.

## Quellen

- `src/components/TList.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
