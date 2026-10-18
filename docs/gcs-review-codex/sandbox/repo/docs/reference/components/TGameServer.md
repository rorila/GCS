# TGameServer

> Generierte Referenzkarte — Quelle: `src/components/TGameServer.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0029` |
| Kategorie | system |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TGameServer` |
| Legacy-Typnamen (typeMapping) | GameServer |
| Schema-Datei | — |
| Verwendung in Projekten | — |
| Server-Methoden | — |
| Umfang | 248 Zeilen |

## Beschreibung

TGameServer - A stage-placeable component that manages multiplayer server connection. Place on stage, configure in Inspector, and use events to trigger Tasks.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `serverUrl` | Server URL | string | Server |
| `autoConnect` | Auto Connect | boolean | Server |

## Ereignisse

`onConnected`, `onDisconnected`, `onRoomCreated`, `onRoomJoined`, `onPlayerJoined`, `onPlayerLeft`, `onGameStart`, `onError`

## Öffentliche Methoden

`getInspectorProperties`, `getEvents`, `toDTO`, `initRuntime`, `onRuntimeStart`, `onRuntimeStop`, `setEventCallback`, `connect`, `disconnect`, `createRoom`, `joinRoom`, `ready`, `start`, `stop`

## Getter

`connected`, `roomCode`, `playerNumber`, `isHost`, `lastError`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `tests\nonvisual_inspector.test.ts`

## Einschränkungen

- In keinem mitgelieferten Projekt verwendet.

## Quellen

- `src/components/TGameServer.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
