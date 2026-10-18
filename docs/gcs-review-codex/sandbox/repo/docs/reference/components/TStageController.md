# TStageController

> Generierte Referenzkarte — Quelle: `src/components/TStageController.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0100` |
| Kategorie | system |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TStageController` |
| Legacy-Typnamen (typeMapping) | StageController |
| Schema-Datei | — |
| Verwendung in Projekten | 11 |
| Server-Methoden | — |
| Umfang | 291 Zeilen |

## Beschreibung

TStageController - Zentrale Komponente für Stage-Verwaltung Verhält sich wie TGameState, TInputController etc. Kann im Editor platziert und im Flow-Editor gesteuert werden. Konzept: - Es gibt genau EINE HauptStage (type: 'main') mit Meta-Properties (Name, Author, Description) - Es kann beliebig viele Standard-Stages geben (type: 'standard') - Es gibt maximal EINE SplashStage (type: 'splash') - Reihenfolge: Splash → Main → Standard-Stages

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `currentStageId` | Current Stage ID | string | Stage Info |
| `currentStageName` | Current Stage Name | string | Stage Info |
| `currentStageType` | Current Stage Type | string | Stage Info |
| `stageCount` | Total Stages | number | Stage Info |
| `isOnMainStage` | Is Main Stage | boolean | Stage Info |
| `isOnSplashStage` | Is Splash Stage | boolean | Stage Info |

## Ereignisse

`onStageChange`, `onAllStagesCompleted`, `onSplashFinished`

## Öffentliche Methoden

`getCurrentStageObjects`, `setOnStageChangeCallback`, `setStages`, `setCurrentStageId`, `nextStage`, `previousStage`, `goToStage`, `goToMainStage`, `goToFirstStage`, `hasStage`, `hasSplashStage`, `hasMainStage`, `getEvents`, `getInspectorProperties`, `toDTO`

## Getter

`currentStageId`, `currentStageIndex`, `stageCount`, `mainStageId`, `currentStageName`, `currentStageType`, `isOnMainStage`, `isOnSplashStage`

## Verwendete in Projekten

- `game-server\public\projects\BonsaiTetris.json`
- `game-server\public\projects\ElinsMemory.json`
- `game-server\public\projects\ElinsMemoryRemote.json`
- `game-server\public\projects\LeonasAxolotlSpiel.json`
- `game-server\public\projects\MathePuzzle.json`
- `game-server\public\projects\MyCoolGame.json`
- `game-server\public\projects\PingPong-Remote.json`
- `game-server\public\projects\PingPong.json`
- `game-server\public\projects\PuzzleNeu.json`
- `public\test-projects\PingPong.json`
- `public\test-projects\PuzzleNeu.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `scripts\test_puzzle.ts`
- `tests\image_gallery.test.ts`
- `tests\nonvisual_inspector.test.ts`

## Quellen

- `src/components/TStageController.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
