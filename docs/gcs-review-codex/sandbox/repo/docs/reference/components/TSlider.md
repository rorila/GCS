# TSlider

> Generierte Referenzkarte — Quelle: `src/components/TSlider.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0090` |
| Kategorie | eingabe |
| Basisklasse | TWindow |
| Entwicklungsstatus | experimentell |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | — |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TSlider` |
| Schema-Datei | — |
| Verwendung in Projekten | — |
| Server-Methoden | — |
| Umfang | 77 Zeilen |

## Beschreibung

TSlider - Schieberegler (modernes Design) Rendert ein natives <input type="range"> mit modernem Track/Thumb-Styling. Feuert bei jeder Aenderung das Event `onChange` mit { value }. Properties: min / max / step: Wertebereich value: aktueller Wert orientation: 'horizontal' | 'vertical' accentColor: Farbe von Track-Fuellung und Daumen showValue: Wert-Anzeige neben dem Regler

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `min` | Minimum | number | Slider |
| `max` | Maximum | number | Slider |
| `step` | Schrittweite | number | Slider |
| `value` | Wert | number | Slider |
| `orientation` | Ausrichtung | select | Slider |
| `accentColor` | Akzentfarbe | color | Slider |
| `showValue` | Wert anzeigen | boolean | Slider |

## Ereignisse

`onChange`

## Öffentliche Methoden

`setValue`, `getInspectorProperties`, `getEvents`, `toDTO`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `scripts\test_puzzle.ts`

## Einschränkungen

- In der Editor-Registry (services/ComponentRegistry) nicht registriert — nicht über die normale Toolbox erzeugbar.
- In keinem mitgelieferten Projekt verwendet.

## Quellen

- `src/components/TSlider.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
