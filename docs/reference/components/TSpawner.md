# TSpawner

> Generierte Referenzkarte — Quelle: `src/components/TSpawner.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0091` |
| Kategorie | spiel |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TSpawner` |
| Legacy-Typnamen (typeMapping) | Spawner |
| Schema-Datei | — |
| Verwendung in Projekten | 1 |
| Server-Methoden | — |
| Umfang | 201 Zeilen |

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `templateName` | Template-Name | string | SPAWNER ALLGEMEIN |
| `enabled` | Aktiviert | boolean | SPAWNER ALLGEMEIN |
| `spawnInterval` | Spawn-Intervall (s) | number | SPAWNER ALLGEMEIN |
| `spawnAxis` | Spawn-Achse | select | SPAWNER ALLGEMEIN |
| `spawnCountStart` | Start-Spawns | number | SPAWNER ALLGEMEIN |
| `recycleOffScreen` | Recyclen wenn außerhalb | boolean | SPAWNER ALLGEMEIN |
| `spawnY` | Spawn-Y (fix, wenn X) | number | SPAWNER X |
| `spawnXMin` | Spawn-X Min (Zellen) | number | SPAWNER X |
| `spawnXMax` | Spawn-X Max (Zellen) | number | SPAWNER X |
| `randomizeX` | X zufällig | boolean | SPAWNER X |
| `spawnX` | Spawn-X (fix, wenn Y) | number | SPAWNER Y |
| `spawnYMin` | Spawn-Y Min (Zellen) | number | SPAWNER Y |
| `spawnYMax` | Spawn-Y Max (Zellen) | number | SPAWNER Y |
| `randomizeY` | Y zufällig | boolean | SPAWNER Y |

## Öffentliche Methoden

`getInspectorProperties`, `initRuntime`, `onRuntimeStart`, `onRuntimeStop`, `onRuntimeUpdate`, `toDTO`

## Verwendete in Projekten

- `game-server\public\projects\LeonasAxolotlSpiel.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `tests\jumpandrun_components.test.ts`
- `tests\nonvisual_inspector.test.ts`

## Quellen

- `src/components/TSpawner.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
