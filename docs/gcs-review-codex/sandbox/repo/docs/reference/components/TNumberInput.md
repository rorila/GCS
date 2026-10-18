# TNumberInput

> Generierte Referenzkarte — Quelle: `src/components/TNumberInput.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0053` |
| Kategorie | eingabe |
| Basisklasse | TTextControl |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TNumberInput` |
| Legacy-Typnamen (typeMapping) | NumberInput |
| Schema-Datei | docs/schemas/schema_inputs.json |
| Verwendung in Projekten | 1 |
| Server-Methoden | — |
| Umfang | 78 Zeilen |

## Beschreibung

TNumberInput - Specialized number input component Allows users to enter numeric values with constraints. Useful for coordinates, sizes, speeds, and other numeric properties.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `value` | Value | number | Specifics |
| `min` | Min | number | Specifics |
| `max` | Max | number | Specifics |
| `step` | Step | number | Specifics |

## Öffentliche Methoden

`setValue`, `increment`, `decrement`, `getInspectorProperties`, `toDTO`

## Verwendete in Projekten

- `game-server\public\projects\GCS-CMS.json`

## Quellen

- `src/components/TNumberInput.ts`
- `docs/schemas/schema_inputs.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
