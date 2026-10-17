# TTimer

> **Kuratierte Referenzkarte** — `docStatus: technisch geprüft` · Quelle: `src/components/TTimer.ts`

| Feld | Wert |
|---|---|
| Kategorie | spiel |
| Vererbungskette | `TTimer → TWindow → TComponent` (`IRuntimeComponent`) |
| Entwicklungsstatus | implementiert |

## Zweck

Wiederkehrender **Countdown-/Intervall-Timer**: feuert `onTimer` alle
`interval` ms; bei `maxInterval > 0` stoppt er nach N Intervallen mit
`onMaxIntervalReached`.

## Eigene Felder

| Name | Typ | Zweck |
|---|---|---|
| `interval` | number | ms zwischen Ticks (default 1000) |
| `enabled` | boolean (get/set) | Setter startet/stoppt den Timer (Z. 20–33) — `enabled=true` im laufenden Betrieb ruft `start()` |
| `maxInterval` | number\|string | `0` = unendlich; `>0` = Anzahl Ticks |
| `currentInterval` | number | aktueller Tick-Zähler |
| `onEvent` / `watcherQuery` / `runtimeContextVars` | Callbacks | Brücke zu Events/Expressions |

## Eigene Events (Z. 62–66)

`onTimer` (Z. 167), `onMaxIntervalReached` (Z. 178).

## Verhalten

- Ticks werden über `GameLoopManager.enqueueTimerTick()` **gebündelt** im
  nächsten Loop-Frame ausgeführt — auch im `sleeping`-Zustand wacht der Loop
  dafür auf (`spielablauf.md` §3).
- `__proxy__`-Fallback (Z. 27): im Reactive-Proxy-Kontext wird `start` auf dem
  Proxy aufgerufen, nicht auf `this`.

## Einschränkungen

- `maxInterval` als **string** wird akzeptiert (`number|string`) — implizite
  Konvertierung, Dokumentation empfiehlt Zahl.
- Timer-Ticks sind nicht präzise getaktet — sie hängen am Frame-Tick.

## Beispiel

```json
{ "type": "TTimer", "name": "Countdown",
  "interval": 1000, "maxInterval": 10, "enabled": true,
  "events": { "onTimer": "Countdown.tick", "onMaxIntervalReached": "GameOver.show" } }
```

## Quellen

- `src/components/TTimer.ts` (enabled-Setter Z. 20–33, getEvents Z. 62–66, onTimer-Call Z. 167, maxInterval Z. 178)
- `src/runtime/GameLoopManager.ts` Z. 310–325 (pendingTimerTicks)

_Analyse: 2026-10-17 · Commit 53e3dfb + Worktree · Devin (Cognition) — SWE-2 High_
