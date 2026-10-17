# TIntervalTimer

> Generierte Referenzkarte — Quelle: `src/components/TIntervalTimer.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0044` |
| Kategorie | zeitgeber |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TIntervalTimer` |
| Legacy-Typnamen (typeMapping) | Repeater, IntervalTimer, TRepeater |
| Schema-Datei | docs/schemas/schema_timers.json |
| Verwendung in Projekten | 3 |
| Server-Methoden | — |
| Umfang | 178 Zeilen |

## Beschreibung

TIntervalTimer – Intervall-basierter Timer (Ersatz für TRepeater) Feuert `onIntervall` bei jedem Durchlauf und `onTimeout` wenn die konfigurierte Anzahl erreicht ist. Verwendung: - duration (ms): Dauer eines Intervalls - count: Anzahl der Intervalle (0 = unendlich) - enabled: Ob der Timer beim Runtime-Start automatisch losläuft Events: - onIntervall: Wird bei jedem abgelaufenen Intervall gefeuert - onTimeout:   Wird gefeuert wenn alle Intervalle durchlaufen sind (count erreicht)

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `duration` | Dauer (ms) | number | Intervall |
| `count` | Anzahl (0=∞) | number | Intervall |
| `enabled` | Aktiviert | boolean | Intervall |

## Ereignisse

`onIntervall`, `onTimeout`

## Öffentliche Methoden

`getInspectorProperties`, `getEvents`, `toDTO`, `initRuntime`, `onRuntimeStart`, `onRuntimeStop`, `start`, `stop`, `reset`

## Getter

`enabled`

## Verwendete in Projekten

- `game-server\public\projects\ElinsMemory.json`
- `game-server\public\projects\ElinsMemoryRemote.json`
- `game-server\public\projects\LeonasAxolotlSpiel.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `scripts\test_runner.ts`
- `tests\agent_controller_core.test.ts`
- `tests\nonvisual_inspector.test.ts`
- `tests\timer_reactive.test.ts`

## Quellen

- `src/components/TIntervalTimer.ts`
- `docs/schemas/schema_timers.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
