# TNumberLabel

> Generierte Referenzkarte — Quelle: `src/components/TNumberLabel.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0054` |
| Kategorie | anzeige |
| Basisklasse | TTextControl |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TNumberLabel` |
| Legacy-Typnamen (typeMapping) | NumberLabel |
| Schema-Datei | docs/schemas/schema_display.json |
| Verwendung in Projekten | 6 |
| Server-Methoden | — |
| Umfang | 165 Zeilen |

## Beschreibung

TNumberLabel - A specialized component for displaying and managing numeric values. It provides methods for incrementing and decrementing values and fires events when maximum or minimum values are reached.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `startValue` | Anfangswert | number | Numeric |
| `value` | Aktueller Wert | number | Numeric |
| `minValue` | Minimalwert (Optional) | number | Numeric |
| `maxValue` | Maximalwert (Optional) | number | Numeric |
| `step` | Schrittweite | number | Numeric |

## Ereignisse

`onMaxValueReached`, `onMinValueReached`

## Öffentliche Methoden

`applyChange`, `incValue`, `decValue`, `reset`, `getEvents`, `getInspectorProperties`, `toDTO`

## Getter

`value`, `caption`

## Verwendete in Projekten

- `game-server\public\projects\ElinsMemory.json`
- `game-server\public\projects\ElinsMemoryRemote.json`
- `game-server\public\projects\LeonasAxolotlSpiel.json`
- `game-server\public\projects\PingPong-Remote.json`
- `game-server\public\projects\PingPong.json`
- `public\test-projects\PingPong.json`

## Quellen

- `src/components/TNumberLabel.ts`
- `docs/schemas/schema_display.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
