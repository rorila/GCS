# Raketen-Countdown Demo

## Ziel
Demo-Projekt für Neu-User: Variablentypen vorstellen.  
Einfacher Workflow: **Button drücken → Countdown 10→0 → Rakete startet.**

## MainStage: 1280×800

## Komponenten

| # | Typ | Name | Details |
|---|-----|------|---------|
| 1 | `TSprite` | `Rakete` | Schmales Rechteck (30×80), unten Mitte, `velocityY: 0` → wird bei Start auf `-5` gesetzt. Platzhalter für späteres Image. |
| 2 | `TButton` | `StartButton` | Beschriftung „🚀 Start", löst den Countdown aus |
| 3 | `TLabel` | `CountdownLabel` | Zeigt `${Countdown}`, Binding an Variable, große Schrift |
| 4 | `TTimer` | `CountdownTimer` | `interval: 1000ms`, `maxInterval: 10`, `enabled: false` (startet erst per Action) |
| 5 | `TIntegerVariable` | `Countdown` | Startwert `10`, wird jede Sekunde um 1 reduziert. Global (Blueprint-Stage). |

## Tasks & Events

| Task | Auslöser | Was passiert |
|------|----------|-------------|
| `StartCountdown` | `StartButton.onClick` | Timer starten (`call_method: timerStart()`), Button deaktivieren |
| `OnTimerTick` | `CountdownTimer.onTimer` | `Countdown -= 1` |
| `OnCountdownFinish` | `CountdownTimer.onMaxIntervalReached` | Rakete `velocityY = -5` (startet Flug nach oben) |

## Actions (global, Blueprint-Stage)

| Action | Typ | Parameter |
|--------|-----|-----------|
| `TimerStarten` | `call_method` | target: `CountdownTimer`, method: `timerStart` |
| `ButtonDeaktivieren` | `set_property` | target: `StartButton`, property: `enabled`, value: `false` |
| `CountdownReduzieren` | `set_property` | target: `Countdown`, property: `value`, value: `${Countdown} - 1` |
| `RaketeStarten` | `set_property` | target: `Rakete`, property: `velocityY`, value: `-5` |

## Umsetzung
Wird als Unit-Test über den `AgentController.executeBatch()` erzeugt und als JSON exportiert.
