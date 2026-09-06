# Runtime Guide

## GameRuntime & Lifecycle
Die Klasse `GameRuntime.ts` ist das Herzstück des Spielbetriebs.
- **Delegation**: Kernaufgaben liegen in `RuntimeStageManager` (Vererbung/Merging) und `RuntimeVariableManager` (Scoping/Reaktivität).
- **Initialization**: Beim Start werden Objekte und Konfigurationen der aktiven Stage geladen.
- **Stage-Switching**: `switchToStage(stageId)` wechselt zur Laufzeit zwischen Stages.

## Task & Action Executor
- **TaskExecutor**: Löst Taskname-Referenzen (z.B. `Object.onClick`) in `actionSequence` auf.
  - Suchreihenfolge: Aktive Stage -> Blueprint-Stage -> Projekt-Wurzel.
- **ActionExecutor**: Führt die einzelnen Logik-Schritte aus. Parameter-Interpolation (`${...}`) erfolgt hier.

## Variablen & Scoping
- **Hierarchische Auflösung**: Local (Stage) > Global (Blueprint).
- **Reaktivität**: Änderungen an Variablen triggern reaktive Bindings in Komponenten.
- **Timer-Events**: `onTimerEnd` wird direkt vom VariableManager über die Runtime getriggert.

## Reactive Bindings
- Komponenten können Properties via `${variable}` binden.
- Der `PropertyHelper` übernimmt die Auflösung und Typkonvertierung.
- **Priorität**: Variablen-Werte haben Vorrang vor Komponenten-Proxies gleichen Namens.

## Stage Navigation
- Primärer Pfad: `TStageController.goToStage()`.
- Fallback: `onNavigate('stage:...')` (Editor-only).

## Rendering & Game Loop
- **GameLoopManager**: Zentrales Singleton für Updates und Kollisionen.
- **StageRenderer**: Gemeinsame Rendering-Logik für Editor und Player.
- **Z-Index**: Wird rekursiv berechnet (`parentZ + currentZ`).
