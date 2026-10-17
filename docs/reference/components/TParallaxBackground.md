# TParallaxBackground

> Generierte Referenzkarte — Quelle: `src/components/TParallaxBackground.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0059` |
| Kategorie | spiel |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TParallaxBackground` |
| Legacy-Typnamen (typeMapping) | ParallaxBackground |
| Schema-Datei | — |
| Verwendung in Projekten | 1 |
| Server-Methoden | — |
| Umfang | 471 Zeilen |

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `layers` | Parallax-Ebenen (JSON) | json | KONFIGURATION |
| `velocityX` | Geschwindigkeit-X (Zellen/Frame) | number | KONFIGURATION |
| `scrollSource` | Scroll-Quelle (optional, z.B. ${globalGameTime}) | string | KONFIGURATION |
| `repeat` | Nahtlos wiederholen | boolean | KONFIGURATION |
| `direction` | Richtung | select | KONFIGURATION |
| `addLayer` | + Ebene hinzufügen | button | KONFIGURATION |

## Öffentliche Methoden

`getInspectorProperties`, `getInspectorSections`, `initRuntime`, `onRuntimeStart`, `onRuntimeStop`, `onRuntimeUpdate`, `setElement`, `toDTO`

## Verwendete in Projekten

- `game-server\public\projects\LeonasAxolotlSpiel.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `tests\jumpandrun_components.test.ts`

## Quellen

- `src/components/TParallaxBackground.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
