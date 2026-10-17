# TGameState

> **Kuratierte Referenzkarte** — `docStatus: technisch geprüft` · Quelle: `src/components/TGameState.ts`

| Feld | Wert |
|---|---|
| Kategorie | spiel |
| Vererbungskette | `TGameState → TWindow → TComponent` |
| Entwicklungsstatus | implementiert |
| Meta-Flags | `isVariable=true`, `isService=true`, `isHiddenInRun=true` |

## Zweck

Zentraler **Spielstand-Container**: `state` (`menu|playing|paused|gameover|won`)
plus `score`, `level`, `lives`/`maxLives`, `spritesMoving`,
`collisionsEnabled`. Wird vom `GameLoopManager` (Z. 132) als `gameState`
registriert — der Loop fragt `spritesMoving`/`collisionsEnabled` ab.

## Eigene Events (Z. 42–48)

`onStateChanged`, `onGameOver`, `onLifeLost`, `onScoreChanged` —
feuern beim Setzen der entsprechenden Felder (durch `property`-/`set_variable`-
Actions oder Runtime).

## Verhalten

- `isHiddenInRun` → unsichtbar zur Laufzeit; `getEvents()` liefert über
  `TWindow`-Regel trotzdem die Spielstand-Events (Service-Komponente).
- `isVariable` → Werte sind als Variablen les-/schreibbar (`${GameState.score}`).

## Einschränkungen

- Genau **ein** TGameState pro Stage sinnvoll — `gameState`-Referenz im
  GameLoopManager ist ein Singleton-Feld.
- `lives`/`maxLives` werden nicht automatisch dekrementiert — das macht die
  Spiellogik (Task auf `onLifeLost`).

## Beispiel

```json
{ "type": "TGameState", "name": "GameState",
  "state": "menu", "score": 0, "level": 1, "lives": 3, "maxLives": 3,
  "spritesMoving": false, "collisionsEnabled": true }
```

## Quellen

- `src/components/TGameState.ts` (Felder Z. 5–10, Events Z. 42–48)
- `src/runtime/GameLoopManager.ts` (Registrierung Z. 132)

_Analyse: 2026-10-17 · Commit 53e3dfb + Worktree · Devin (Cognition) — SWE-2 High_
