# TDataList

> Generierte Referenzkarte — Quelle: `src/components/TDataList.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0015` |
| Kategorie | daten |
| Basisklasse | TPanel |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TDataList` |
| Legacy-Typnamen (typeMapping) | DataList |
| Schema-Datei | — |
| Verwendung in Projekten | — |
| Server-Methoden | — |
| Umfang | 274 Zeilen |

## Beschreibung

TDataList - Repeater-Container für dynamisches Karten-/Zeilendesign Hostet ein inneres TPanel als Karten-Vorlage (erstes Kind). Zur Laufzeit wird dieses Template pro Datensatz geklont, und ${item.xyz}-Expressions in den Children aufgelöst. Design-Time: 1 TPanel-Kind (Karten-Template) mit Labels, Buttons etc. Runtime: N geklonte Karten, eine pro Datensatz aus der DataAction

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `dataAction` | Datenquelle (DataAction) | select | DATENBINDUNG |
| `rowHeight` | Kartenhöhe (px) | number | LAYOUT |
| `rowGap` | Kartenabstand (px) | number | LAYOUT |

## Ereignisse

`onRowClick`, `onRowDoubleClick`

## Öffentliche Methoden

`getEvents`, `getInspectorProperties`, `toDTO`, `initRuntime`, `onRuntimeUpdate`, `buildRuntimeRows`

## Einschränkungen

- In keinem mitgelieferten Projekt verwendet.

## Quellen

- `src/components/TDataList.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
