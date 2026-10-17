# TSpeedlines

> Generierte Referenzkarte — Quelle: `src/components/TSpeedlines.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0094` |
| Kategorie | anzeige |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | — |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TSpeedlines` |
| Schema-Datei | — |
| Verwendung in Projekten | 1 |
| Server-Methoden | — |
| Umfang | 128 Zeilen |

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `lineCount` | Anzahl Linien | number | KONFIGURATION |
| `speed` | Geschwindigkeit (s) | number | KONFIGURATION |
| `lineColor` | Linien-Farbe | string | KONFIGURATION |
| `overlayOpacity` | Overlay-Deckkraft | number | KONFIGURATION |
| `lineWidth` | Linien-Breite (px) | number | KONFIGURATION |
| `lineLength` | Linien-Länge (px) | number | KONFIGURATION |

## Öffentliche Methoden

`getInspectorProperties`, `setElement`, `toDTO`

## Verwendete in Projekten

- `game-server\public\projects\LeonasAxolotlSpiel.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `tests\jumpandrun_components.test.ts`

## Einschränkungen

- In der Editor-Registry (services/ComponentRegistry) nicht registriert — nicht über die normale Toolbox erzeugbar.

## Quellen

- `src/components/TSpeedlines.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
