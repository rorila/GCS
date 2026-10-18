# Spielablauf — Game Loop, Stages, Kollisionen

Dokumentationsstatus: **entwurf** (quellverifiziert, nicht UI-getestet)
Analyse-Stand: Arbeitsstand `53e3dfb` + uncommittete Änderungen · 2026-10-17

Der eigentliche Spielbetrieb (Sprites bewegen, Kollisionen, Ränder, Rendern) läuft
parallel zum deklarativen Task-System. Dieses Dokument beschreibt die Maschinerie
unterhalb der Tasks/Actions.

## 1. Komponenten des Spielablaufs

| Baustein | Quelle | Aufgabe |
|---|---|---|
| `GameLoopManager` (Singleton) | `src/runtime/GameLoopManager.ts` | Zentrales Tick-/Update-/Render-Orakel; verwaltet Sprites, InputController, Panels, `TGameState`, `TGameLoop` |
| `LoopLifecycle` | `src/runtime/LoopLifecycle.ts` | Zustandsmaschine `idle → running → paused → sleeping`; `wakeUp()` bei neuer Arbeit |
| `RenderLoop` | `src/runtime/RenderLoop.ts` | `requestAnimationFrame`-Treiber mit fixed-timestep + Interpolations-`alpha` |
| `CollisionManager` | `src/runtime/CollisionManager.ts` | Kollisionserkennung inkl. `BoundsInfo` (Rand-Modi) |
| `InputManager` | `src/runtime/InputManager.ts` | Tastatur/Touch → `TInputController`-Bindings |
| `RuntimeStageManager` | `src/runtime/RuntimeStageManager.ts` | Stage-Wechsel (`navigate_stage`), Auf-/Abbau der Objekte |
| `SpritePool` | `src/runtime/SpritePool.ts` | Wiederverwendung von Sprite-Instanzen bei `spawn_object`/`destroy_object` |
| `PhysicsEngine` | `src/runtime/PhysicsEngine.ts` | Kleiner Physik-Teil (115 Z.) — Bewegung/Kollision soweit nicht im GameLoop |
| `AnimationManager` | `src/runtime/AnimationManager.ts` | `animate`-Action (Tween-Handling) |
| `AudioManager` | `src/runtime/AudioManager.ts` | `TAudio`-Wiedergabe |

`GameLoopManager` ist bewusst **kein** Stage-Objekt und läuft außerhalb des
Reactive-Proxys — Kommentar Z. 1–12 erklärt das wegen `this`-Binding-Problemen.

## 2. Registrierungslogik — was „am Spiel" teilnimmt

`init()` klassifiziert Objekte nach `className`/`constructor.name` (Z. 108–138):

```text
TSprite            → sprites[]        (bewegt sich im Loop)
TInputController   → inputControllers[]
TPanel/TGroupPanel → panels[]
TGameState         → gameState        (Score/Lives/Flags)
TGameLoop          → gameLoopRef      (Konfiguration: BoundaryMode, Offsets)
```

`TGameLoop` ist damit die **deklarative Konfigurationskomponente** des Loops —
über ihr werden `boundaryMode` (`clamp`/`wrap`/`kill`/`bounce`), `boundsOffsetTop`/`Bottom` und das Grid bezogen.

## 3. Tick-Pipeline (vereinfacht)

```text
RenderLoop (rAF)
  └─ GameLoopManager.processFrame(steps, alpha, fixedDt)
       ├─ pendingTimerTicks ausführen (Timer-Events, Z. 310–325)
       ├─ InputManager → InputController-States
       ├─ updateSprites(fixedDt, spritesMoving)   (Z. 424)
       │     ├─ velocity/bounce/collisions via CollisionManager
       │     └─ BoundsInfo → boundaryMode-Auswertung
       ├─ runtimeUpdatables (z. B. TParallaxBackground)
       └─ render(alpha) → Canvas
```

- **Fixed-Timestep:** physikalische Updates in festen `fixedDt`-Schritten, Rendering mit `alpha`-Interpolation → flüssige Bewegung unabhängig von der Bildrate.
- **Sleep/Wake:** `LoopLifecycle` versetzt den Loop in `sleeping`, wenn nichts läuft; `enqueueTimerTick()` und `wakeUp()` (Z. 306–313) holen ihn zurück — Timer feuern also auch im Schlafzustand (über den Tick-Puffer).
- **Pause:** mehrere „Pause-Eigentümer" (`pauseOwners` Set) + `manualPause` — der Loop pausiert erst, wenn **alle** freigeben.

## 4. Ränder und Kollisionen

`boundaryMode` auf `TGameLoop` steuert Randbehandlung:

| Modus | Wirkung |
|---|---|
| `clamp` | Sprite bleibt im Grid-Bereich (Standard) |
| `wrap` | Sprite läuft auf der gegenüberliegenden Seite wieder ein |
| `kill` | Sprite wird zerstört, sobald es die Bounds verlässt |
| `bounce` | Geschwindigkeit invertiert am Rand |

Sprite-vs-Sprite-Kollisionen meldet der `CollisionManager` an das Event-System →
`onCollision`-Events auf den beteiligten Objekten (siehe `events.md`).

## 5. Stage-Wechsel

`navigate_stage` → `RuntimeStageManager`:

1. Laufende Stage herunterfahren (Objekte freigeben, Loop-Registrierung leeren)
2. Ziel-Stage instanziieren (Objekte via Runtime-`ComponentRegistry.create()`)
3. `GameLoopManager.init()` für die neue Objektmenge
4. Stage-Variablen/Bindings aktivieren → `stage_init`-Event

Details siehe `docs/architecture/execution-flow.md` (Ende der Pipeline).

## 6. Headless-Betrieb

`HeadlessRuntime`/`HeadlessServer` führen denselben Loop ohne Canvas aus —
Grundlage für `test-headless-runtime.cjs` und serverseitige Simulations-Endpunkte
(`TAPIServer`).

## Abhängigkeiten &amp; Einschränkungen

- `GameLoopManager` ist ein **Singleton** — nur ein Spiel-Loop pro Seite; mehrere
  parallele GameStages sind nicht vorgesehen.
- Physik ist minimal (Velocity, Bounce, Bounds) — keine Kollisions-Layer, keine
  Massen/Impulse; `PhysicsEngine.ts` ist mit 115 Zeilen bewusst schlank.
- `pendingTimerTicks` puffern Timer-Callbacks — Timer feuern gebündelt im
  nächsten Tick, nicht exakt zum Zeitpunkt (Reihenfolge siehe `variables.md` §Timer).
- Sleep-Modus: Bei rein animierten Szenen ohne Bewegung kann der Loop schlafen —
  `wakeUp()` muss von Interaktionen/Events ausgelöst werden.

## Tests

| Test | Status |
|---|---|
| `test-headless-runtime.cjs` | vorhanden, nicht ausgeführt |
| `ReactiveRuntime.test.ts`, `PropertyWatcher.test.ts`, `CoordinateBinding.test.ts`, `VariableConsolidation.test.ts` | vorhanden, nicht ausgeführt |
| Keine dedizierten Collision-/GameLoop-Tests gefunden | — |
