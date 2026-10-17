# TTetris

> Generierte Referenzkarte — Quelle: `src/components/TTetris.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0109` |
| Kategorie | spiel |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TTetris` |
| Legacy-Typnamen (typeMapping) | Tetris |
| Schema-Datei | — |
| Verwendung in Projekten | — |
| Server-Methoden | — |
| Umfang | 397 Zeilen |

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `cols` | Spalten | number | SPIELFELD |
| `rows` | Zeilen | number | SPIELFELD |
| `baseInterval` | Startgeschwindigkeit (ms) | number | SPIELFELD |
| `levelLines` | Reihen pro Level | number | SPIELFELD |
| `showGhost` | Ghost-Piece zeigen | boolean | SPIELFELD |
| `state` | Zustand | string | STATUS |
| `score` | Punkte | number | STATUS |
| `lines` | Reihen | number | STATUS |
| `level` | Level | number | STATUS |
| `highScore` | Highscore | number | STATUS |
| `nextPiece` | Nächster Stein | string | STATUS |

## Ereignisse

`onGameOver`, `onLineClear`, `onLevelUp`, `onStateChanged`, `onSpawn`, `onLock`

## Öffentliche Methoden

`initRuntime`, `onRuntimeStop`, `startGame`, `resetGame`, `togglePause`, `pauseGame`, `resumeGame`, `moveLeft`, `moveRight`, `rotatePiece`, `rotatePieceCCW`, `softDrop`, `hardDrop`, `getGhostY`, `getNextMatrix`, `getActivePiece`, `getClearingRows`, `getEvents`, `getInspectorProperties`, `toDTO`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `scripts\test_tetris_engine.ts`

## Einschränkungen

- In keinem mitgelieferten Projekt verwendet.

## Quellen

- `src/components/TTetris.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
