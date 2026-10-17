# TGameLoop

> **Kuratierte Referenzkarte** — `docStatus: technisch geprüft` · Quelle: `src/components/TGameLoop.ts`

| Feld | Wert |
|---|---|
| ID | `COMP-0028` |
| Kategorie | spiel |
| Vererbungskette | `TGameLoop → TWindow → TComponent` |
| Entwicklungsstatus | implementiert · Test: test vorhanden |
| Verwendung | 10 Projekte (u. a. Breakout, PingPong, MemoryGame) |

## Zweck

**Konfigurations-Container** für den zentralen Game-Loop — die Komponente
startet **keinen eigenen Loop** (Kommentar in Quelle). Der Singleton
`GameLoopManager` liest ihre Werte bei `GameRuntime.initMainGame()` aus und
betreibt Sprite-Updates, Kollisionen und Boundary-Checks (`spielablauf.md`).

## Eigene Inspector-Eigenschaften

| Name | Typ | Zweck |
|---|---|---|
| `targetFPS` | number | Ziel-Framerate |
| `autoAdjustFPS` | boolean | FPS bei Last automatisch senken |
| `boundaryMode` | select | `clamp`/`wrap`/`kill`/`bounce` (Randbehandlung) |
| `boundsOffsetTop` / `boundsOffsetBottom` | number | Spielfeld ober-/unterhalb beschneiden |

## Eigene Events

`onFrame` (Z. 94–97 — wird zu den Basis-Events ergänzt) — pro Loop-Frame;
teuer, nur für frame-genaue Logik.

## Verhalten

- Getter `boundsWidth`/`boundsHeight` liefern die effektive Spielfläche
  (Grid minus Offsets).
- `initRuntime`/`onRuntimeStart`/`onRuntimeStop` hängen den Lebenszyklus an
  den Stage-Wechsel.

## Einschränkungen

- **Ein** TGameLoop pro Spiel — die `gameLoopRef` im Manager ist ein einzelnes
  Feld; zwei Instanzen überschreiben sich.
- `boundaryMode` wirkt nur auf vom Loop verwaltete `TSprite`s — statische
  Objekte ignorieren ihn.
- `onFrame` wird pro Tick ausgewertet — schwere Logik dort bremst das Spiel.

## Beispiel

```json
{ "type": "TGameLoop", "name": "GameLoop",
  "targetFPS": 60, "autoAdjustFPS": true,
  "boundaryMode": "kill", "boundsOffsetTop": 20, "boundsOffsetBottom": 20 }
```

## Quellen

- `src/components/TGameLoop.ts` (getEvents Z. 94–97)
- `src/runtime/GameLoopManager.ts` (Registrierung Z. 138), `src/runtime/LoopLifecycle.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb + Worktree · Devin (Cognition) — SWE-2 High_
