# THandshake

> Generierte Referenzkarte — Quelle: `src/components/THandshake.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0033` |
| Kategorie | system |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `THandshake` |
| Legacy-Typnamen (typeMapping) | Handshake |
| Schema-Datei | — |
| Verwendung in Projekten | 2 |
| Server-Methoden | — |
| Umfang | 150 Zeilen |

## Beschreibung

THandshake Component Manages the connection handshake in multiplayer mode. Only active when isMultiplayer = true. Events: - onConnected: WebSocket connection established - onRoomCreated: Host has created a room - onRoomJoined: Client has joined a room - onPeerJoined: Other player has joined - onPeerReady: Other player is ready - onGameStart: Both players ready, game starts - onVersionMismatch: Protocol versions incompatible

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `protocolVersion` | Protokoll-Version | string | Handshake |
| `enabled` | Aktiviert | boolean | Handshake |
| `status` | Status | string | Handshake |
| `roomCode` | Raum-Code | string | Handshake |
| `playerNumber` | Spieler-Nr. | number | Handshake |
| `isHost` | Ist Host | boolean | Handshake |

## Ereignisse

`onConnected`, `onRoomCreated`, `onRoomJoined`, `onPeerJoined`, `onPeerReady`, `onGameStart`, `onPeerLeft`, `onVersionMismatch`

## Öffentliche Methoden

`getInspectorProperties`, `getEvents`, `toDTO`, `createRoom`, `joinRoom`, `ready`, `_fireEvent`, `_setStatus`, `_setRoomInfo`, `_setPeerVersion`

## Verwendete in Projekten

- `game-server\public\projects\PingPong.json`
- `public\test-projects\PingPong.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `tests\nonvisual_inspector.test.ts`

## Quellen

- `src/components/THandshake.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
