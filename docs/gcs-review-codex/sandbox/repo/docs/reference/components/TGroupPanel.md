# TGroupPanel

> Generierte Referenzkarte — Quelle: `src/components/TGroupPanel.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0032` |
| Kategorie | container |
| Basisklasse | TPanel |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TGroupPanel` |
| Legacy-Typnamen (typeMapping) | GroupPanel |
| Schema-Datei | docs/schemas/schema_containers.json |
| Verwendung in Projekten | 2 |
| Server-Methoden | — |
| Umfang | 39 Zeilen |

## Beschreibung

TGroupPanel Ein unsichtbarer logischer Container, in den andere Komponenten gedropped werden können. Alle Children bewegen sich relativ zu diesem Container mit. Eignet sich hervorragend als Vorlage/Template für den ObjectPool.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `isHiddenInRun` | Als Template verbergen | boolean | KONFIGURATION |

## Öffentliche Methoden

`getInspectorProperties`

## Verwendete in Projekten

- `game-server\public\projects\Mine2D.json`
- `game-server\public\projects\SuperMario_Templates.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `scripts\test_mario_flow.ts`
- `scripts\test_mario_templates.ts`
- `scripts\test_mine2d.ts`
- `tests\game_loop_manager.test.ts`

## Quellen

- `src/components/TGroupPanel.ts`
- `docs/schemas/schema_containers.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
