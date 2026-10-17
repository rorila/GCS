# Referenz: Multiplayer-Runtime

> **Status:** `entwurf` · **Analyse-Basis:** Working Tree (uncommittet)
> **Quellen:** `src/runtime/MultiplayerManager.ts` (313 Z.), `src/multiplayer/Protocol.ts` (35), `src/multiplayer/NetworkManager.ts`, `src/multiplayer/InputSyncer.ts`, `src/multiplayer/CollisionSyncer.ts`, `src/multiplayer/JSONMultiplayerLobby.ts`, `src/runtime/core/GameRuntimeMultiplayer.ts` (71), `game-server/src/Protocol.ts` (Server-Seite)

## 1. Architektur im Überblick

```
Client A ──WebSocket──> game-server (/ws/game) ──WebSocket──> Client B
   │                                                               │
MultiplayerManager                                          MultiplayerManager
   │                                                               │
GameRuntimeMultiplayer ← remote_* ──────────── Protocol-Messages ──→
   │
TaskExecutor.execute(taskName, …, isRemoteExecution=true)
```

Der Server ist ein **relaying Room-Server** (keine Game-Logik): 2-Spieler-Räume, Room-Code, Heartbeat, Message-Forwarding. Alle Game-spezifische Synchronisation läuft deklarativ über `triggerMode` und die `remote_*`-Messages.

## 2. Protokoll (`Protocol.ts`)

**Client → Server:**

| `type` | Payload |
|---|---|
| `create_room` | `gameName?` |
| `join_room` | `roomCode` |
| `rejoin_room` | `roomCode`, `playerNumber` (1\|2) |
| `ready` | — |
| `input` | `key`, `action` (`down`/`up`) |
| `trigger_event` | `objectId`, `eventName`, `params?` |
| `broadcast_action` | `action` (beliebiges Action-Objekt) |
| `state_sync` | `objectId`, `state` (`x`, `y`, `vx`, `vy`, `text`, `value`) |
| `sync_project` | `project` (Master schickt Projekt-JSON) |
| `trigger_task` | `taskName`, `params?` (Modus: broadcast) |
| `sync_task` | `taskName`, `params?` (Modus: local-sync) |

**Server → Client:**

`room_created` {roomCode} · `room_joined` {roomCode, playerNumber, gameName?} · `player_joined` {playerNumber} · `player_left` {playerNumber} · `game_start` {yourPlayer, seed} · `remote_input` {player, key, action} · `remote_event` {player, objectId, eventName, params?} · `remote_action` {player, action} · `remote_state` {player, objectId, state} · `project_data` {project} · `remote_task` {player, taskName, params?, mode: `broadcast`|`sync`} · `error` {message} · plus `pong`/`player_timeout` (Heartbeat, server-seitig, im Manager gehandhabt).

## 3. `MultiplayerManager` — Client-Fassade

`src/runtime/MultiplayerManager.ts`:

- `connect()` → `gameServerWs()` (same-origin `/ws/game` in Prod, dev-Backend `:8080` unter Vite-Port `5173`); Nachrichten werden vor `OPEN` **gequeued** (Z. 53, 136)
- `createRoom(game)`, `joinRoom(code)`, `rejoinRoom(code, n)`, `ready()`
- `sendInput(key, down|up)`, `sendStateSync(objectId, {x,y,vx,vy,text,value})`
- `sendTriggerTask(taskName, params)` → `trigger_task` (Modus broadcast), `sendSyncTask(...)` → `sync_task` (Modus local-sync)
- **Heartbeat:** `startHeartbeat()` nach `game_start` — `ping` alle `pingInterval` ms (Default 5000); `missedPongs > timeoutThreshold` (Default 3) → `onPlayerTimeout({playerNumber:0, reason:'heartbeat'})`
- `onGameStart`-Callback wird **gepuffert** (`gameStartMsg`), damit spät registrierte Handler das Event noch bekommen (Z. 114–124)
- `player_left` → `window.location.href = '/'` — **harter Redirect** (kein Event)

Callbacks: `onRemoteState`, `onRemoteInput`, `onRemoteTask`, `onRoomCreated`, `onRoomJoined`, `onPlayerJoined`, `onPlayerTimeout`, `onPong`, `onGameStart`.

## 4. `triggerMode` — deklarative Synchronisation

Auf Task-Ebene (`types.ts` Z. 291): `'local' | 'local-sync' | 'broadcast'`, Default `'local-sync'`.

| Modus | Verhalten |
|---|---|
| `local` | Task nur lokal, keine Netz-Interaktion |
| `local-sync` | lokal ausführen, **danach** `sync_task` an den anderen Spieler — der führt `remote_task` lokal aus (`isRemoteExecution=true` verhindert Rücksendung, TaskExecutor Z. 258) |
| `broadcast` | Nicht-Host schickt `trigger_task` an **Host** (playerNumber 1) — Host führt aus |

Empfangene `remote_task` → `GameRuntimeMultiplayer.executeRemoteTask(taskName, params, mode)` → `taskExecutor.execute(...)` (Z. 65–69).

Echtes Beispiel — `Aufgabenbereich-Karteikasten.json`, Task `Area_StopMedia`: `triggerMode: "local-sync"`.

## 5. State/Input/Collision-Syncer (`src/multiplayer/`)

Spezialisierte Client-Side-Synchronisierer (PingPong-Projekt als Leitbeispiel):

| Modul | Zweck |
|---|---|
| `NetworkManager.ts` | Singleton-Fassade um den Socket (`network.on(handler)`-Subscriber) |
| `InputSyncer.ts` | Remote-Paddle mit hybrider Korrektur: Input-Events steuern sofort, Position-Sync korrigiert Drift (`correctionRate 0.15`) |
| `CollisionSyncer.ts` | „Owner decides": Paddle-Kollision meldet der Paddle-Besitzer, Score meldet der **Punkter** |
| `JSONMultiplayerLobby.ts` | JSON-basierte Lobby-Logik (Raumliste, Beitritt) |
| `MultiplayerLobby.ts` | UI-Lobby |

## 6. `GameRuntimeMultiplayer` — Einkoppung in die Runtime

`src/runtime/core/GameRuntimeMultiplayer.ts`:

- `mp.on(msg)`-Subscriber leitet Server-Events an Komponenten weiter: `THandshake` bekommt `onRoomCreated`/`onRoomJoined`/`onGameStart` (+ `_setRoomInfo`, `_setStatus`), `THeartbeat` bekommt `pong`/`player_timeout`
- `updateRemoteState(idOrName, state)` → `Object.assign(obj, state)` + `triggerRender()`
- `triggerRemoteEvent(objectId, eventName, params)` → `handleEvent` (normaler Event-Pfad)
- `executeRemoteAction(action)` → `actionExecutor.execute(action, {vars: contextVars, contextVars})`
- `executeRemoteTask` → siehe §4

## 7. Action-Typen mit Multiplayer-Bezug

| Typ | Flag |
|---|---|
| `create_room` (`game`) | `requiresMultiplayer` |
| `join_room` (`code`) | `requiresMultiplayer` |
| (alle anderen) | Multiplayer-Sync läuft über `triggerMode`, nicht über dedizierte Actions |

## 8. Bekannte Einschränkungen &amp; Fehler

- **2-Spieler-Limit** — `playerNumber: 1|2` ist im Protokoll fix verdrahtet.
- **`player_left` ist destruktiv** — harter `window.location.href='/'`-Redirect, kein deklaratives Event.
- **Heartbeat nur client-seitig gezählt** — Server schickt `pong`, `player_timeout` kommt vom Server zusätzlich; `onPlayerTimeout` wird bei `playerNumber: 0` für eigenen Timeout gefeuert.
- **`isRejoin`-Logik** in `room_joined` basiert auf Vorhandensein von `roomCode` — implizit, nicht explizit.
- **Keine Verschlüsselung/Authentifizierung im Protokoll** — Room-Code ist die einzige Access-Barriere.
- `multiplayerManager` wird über `options` **oder** globales `window.multiplayerManager` aufgelöst (Z. 13) — zwei Verdrahtungswege.

## 9. Tests

Keine dedizierten Multiplayer-Tests gefunden — die Remote-Projekte (`ElinsMemoryRemote.json`, `PingPongRemote*`) sind manuell zu prüfen. Siehe `docs/PingPong-Remote-Synchronisationsplan.md` (Inventar: `nicht bewertet`).
