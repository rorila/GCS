# TInputController

> **Kuratierte Referenzkarte** — `docStatus: technisch geprüft` · Quelle: `src/components/TInputController.ts`

| Feld | Wert |
|---|---|
| Kategorie | spiel |
| Vererbungskette | `TInputController → TWindow → TComponent` |
| Entwicklungsstatus | implementiert |
| Laufzeit-Verwaltung | `InputManager` via `GameLoopManager` (Z. 120) |

## Zweck

Stage-platzierbare **Tastatur-Steuerung**: bindet Tasten an Sprites/Events.
Die Komponente selbst installiert **keine** `window`-Listener — das übernimmt
`GameRuntime.initInputControllers()` über ein Single-Global-Handler-Pattern
(Kommentar Z. 5–9), um stale Listener bei `hydrateObjects()`-
Instanzwiederverwendung zu verhindern.

## Eigene Felder

| Name | Typ | Zweck |
|---|---|---|
| `enabled` | boolean | Controller aktiv |
| `keysPressed` | `Set<string>` | aktuell gedrückte Tasten |
| `isActive` | boolean | Controller hat Fokus/Teilnahme |
| `eventCallback` | fn | Brücke zum Event-System |
| `keyupTimeouts` | `Map<string,number>` | verzögertes Key-up (Dauer-Events) |
| `_instanceId` | string | Debug-Instanz-ID |

## Eigene Events (Z. 202–210)

`onKeyDown_KeyW`, `onKeyDown_KeyS`, `onKeyDown_KeyA`, `onKeyDown_KeyD`, … —
pro Taste ein dediziertes Event (`onKeyDown_<Code>`).

## Einschränkungen

- Nur **Tastatur** — Touch/Gamepad laufen über `TouchHardening`/`InputManager`,
  nicht über diese Komponenten-Events.
- `keyupTimeouts` erzeugen „gehaltene" Tasten — sehr schnelles Tippen kann
  Events bündeln.

## Beispiel

```json
{ "type": "TInputController", "name": "Player1Keys",
  "enabled": true,
  "events": { "onKeyDown_KeyW": "Paddle1.up" } }
```

## Quellen

- `src/components/TInputController.ts` (Header-Kommentar Z. 1–9, Felder Z. 13–22, Events Z. 202–210)
- `src/runtime/InputManager.ts`, `src/runtime/GameLoopManager.ts` Z. 120

_Analyse: 2026-10-17 · Commit 53e3dfb + Worktree · Devin (Cognition) — SWE-2 High_
