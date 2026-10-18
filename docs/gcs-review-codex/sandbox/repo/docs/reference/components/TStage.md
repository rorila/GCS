# TStage

> **Kuratierte Referenzkarte** — `docStatus: technisch geprüft` · Quelle: `src/components/TStage.ts`

| Feld | Wert |
|---|---|
| Kategorie | basis |
| Vererbungskette | `TStage → TWindow → TComponent` |
| Entwicklungsstatus | implementiert |

## Zweck

Ein **Screen/Level** des Spiels. Trägt die `StageConfig` (`cols`, `rows`,
`cellSize`, `snapToGrid`, `showGrid`) — die Stage ist das Raster, auf dem alle
Objekte liegen. Konstruktor rechnet `cols*cellSize × rows*cellSize` in
Pixelgröße um (Z. 25–27).

## Eigene Eigenschaften

| Name | Typ | Zweck |
|---|---|---|
| `config` | `StageConfig` | Grid: cols/rows/cellSize/snapToGrid/showGrid |
| `description` | string | Freitext-Beschreibung |
| `_backgroundImage` | string | Hintergrundbild-Pfad |
| `_objectFit` | `ImageFit` | Bildanpassung (`IMAGE_DEFAULTS.objectFit`) |
| `startAnimation` | string | Fly-In-Pattern bei Spielstart (`'none'` default) |
| `startAnimationDuration` | number | Dauer ms (1000) |
| `startAnimationEasing` | string | `'easeOut'` |
| `startLogicAfterAnimation` | boolean | Tasks erst nach Intro-Animation starten |

## Verhalten

- `navigate_stage` baut über `RuntimeStageManager` die Objektmenge der
  Ziel-Stage auf; `GameLoopManager.init()` wird neu registriert
  (`spielablauf.md` §5).
- `startLogicAfterAnimation` verzögert Task-Start bis das Intro fertig ist —
  relevant für Countdowns.

## Einschränkungen

- Grid ist **Pixel-gebunden** (`cellSize` × cols/rows) — keine prozentuale/
  responsive Stage; Editor zeigt Grid-Linien zur Orientierung.
- Hintergrundbild wird pro Stage geladen — kein Atlas/Tiling.

## Beispiel

```json
{ "type": "TStage", "name": "Level1", "config": {"cols":32,"rows":24,"cellSize":20,"snapToGrid":true,"showGrid":true},
  "startAnimation": "flyIn", "startAnimationDuration": 800 }
```

## Quellen

- `src/components/TStage.ts` (StageConfig Z. 1–8, Felder Z. 10–17, Konstruktor Z. 18–27)
- `src/runtime/RuntimeStageManager.ts`, `src/runtime/GameLoopManager.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb + Worktree · Devin (Cognition) — SWE-2 High_
