# Multiplayer — Game Server, Räume, Synchronisation

Dokumentationsstatus: **entwurf** (quellverifiziert, nicht UI-getestet)
Analyse-Stand: Arbeitsstand `53e3dfb` + uncommittete Änderungen · 2026-10-17

Der Multiplayer-Betrieb läuft über einen eigenständigen Node-Server
(`game-server/`) — getrennt vom CMS (Port 8081) und vom Editor-Frontend.

## 1. Server-Architektur

`game-server/src/server.ts`:

```text
HTTP (express)                 WebSocket (ws)
─────────────────────          ──────────────────────────────
GET  /            player.html  create_room / join_room / rejoin_room
GET  /platform/games           ready
POST /api/auth/…  (JWT)        input / trigger_event / state_sync
api/rooms, media, data…        broadcast_action / sync_project
                               trigger_task / sync_task
                               agent_call / ping
```

- **Bind:** `GCS_HOST` (Standard `127.0.0.1` — LAN-Öffnung nur bewusst via `0.0.0.0`), `PORT` (Standard `8080`)
- **Editor-API-Gate:** `GCS_EDITOR_APIS=off` blendet `/api/dev|agent|data|upload|tts|training|library`, `/kb/*` und mutierende `/platform/games`-Aufrufe per 404 aus (`server.ts` Z. 48–62). **Greift nur für HTTP — der WS-Pfad bleibt offen (TD-013).**
- **JWT:** `JWT_SECRET` ist in Produktion **Pflicht** (`server.ts` Z. 30–32) — fehlt er, wirft der Server beim Start; Fallback `'dev-secret-key-change-in-prod'` nur außerhalb `NODE_ENV=production`.
- **Graceful Shutdown:** SIGTERM/SIGINT → `server.close()` + 10 s Fallback-Exit (Z. 104–112).

## 2. Room-Modell (`game-server/src/Room.ts`)

```text
code: string            6-Zeichen-Code (A–Z ohne I,O,0,1 + 2–9)
player1/player2         WebSocket-Slots — max. 2 Spieler
gameStarted             ready-Handshake beider Spieler
project                 komplettes Projekt-JSON vom Master (P1)
metadata                {hostName, hostAvatar} — Platform-Anzeige
player1Ready/player2Ready
```

Zwei-Spieler-Hartkodierung: `addPlayer` → `1 | 2 | null` (Z. 31–42), dritter
Client erhält `Room is full`. Rejoin (`rejoinPlayer`, Z. 48–70) erlaubt
Wiederverbindung in den **eigenen** Slot — nur wenn der Slot keine aktive
Verbindung hat; `gameStarted` wird zurückgesetzt, beide durchlaufen den
Ready-Handshake erneut.

## 3. Protokoll (`game-server/src/Protocol.ts` ↔ `src/multiplayer/Protocol.ts`)

Client → Server:

| Typ | Zweck | Server-Behandlung |
|---|---|---|
| `create_room` | Raum anlegen (gameName, hostName/hostAvatar optional) | neuer `Room`, `room_created` |
| `join_room` | per `roomCode` beitreten | `room_joined` + ggf. `project_data` |
| `rejoin_room` | Slot-Wiederbelegung mit `playerNumber` | **ungeprüfter Claim** (SEC-MP-08) |
| `ready` | Spieler bereit | beide ready → `game_start` mit Seed |
| `input` | Tastatur/Touch-Event | relayed als `remote_input` (nur `gameStarted`) |
| `trigger_event` | Objekt-Event | relayed als `remote_event` |
| `state_sync` | Objekt-State | relayed als `remote_state` |
| `broadcast_action` | Action auf Gegenseite ausführen | relayed als `remote_action` — **ohne `gameStarted`-Prüfung** (SEC-MP-07) |
| `sync_project` | Master pusht Projekt | nur `player1` (Z. 205–211) → `project_data` an P2 |
| `trigger_task` | Task soll auf Host laufen | an **P1** als `remote_task` mit `mode:'broadcast'` |
| `sync_task` | Task-Ergebnis angleichen | relayed als `remote_task` mit `mode:'sync'` |
| `agent_call` | Agent-API über WS | **ohne Auth** (TD-013) — liest/schreibt `public/project.json` |
| `ping` | Heartbeat | sofort `pong` mit `serverTime` |

Server → Client (Auswahl): `room_created`, `room_joined`, `player_joined`,
`game_start{yourPlayer,seed}`, `remote_input`, `remote_event`, `remote_state`,
`remote_action`, `remote_task`, `project_data`, `player_left`, `agent_result`,
`pong`, `error`, `player_timeout`.

`player_timeout` ist ein Protokoll-Typ, wird aber **nicht vom Server** erzeugt —
Timeouts detektiert der Client (`missedPongs`) und meldet sie selbst (SEC-MP-06).

## 4. Sync-Semantik (Client-Seite)

`src/runtime/MultiplayerManager.ts` + Task-`triggerMode`:

| triggerMode | Wer führt aus | Sync-Pfad |
|---|---|---|
| `local` | nur der auslösende Client | — |
| `local-sync` | lokal, danach `sync_task` → Peer führt nach | beide Clients laufen denselben Task |
| `broadcast` | der Aufruf geht per `trigger_task` an P1 (Host); Host führt aus und synct Ergebnis | autoritativ beim Host |

Details, Parameter und `$event`-Brücke: `docs/reference/multiplayer-runtime.md`.

## 5. Reconnect &amp; Cleanup

- `handleDisconnect` entfernt den Spieler, löscht den Raum aber erst nach
  **30 s Grace Period**, wenn er dann noch leer ist (Z. 314–321) — deckt
  Browser-Navigation ab.
- `removePlayer` sendet `player_left` an den verbleibenden Spieler → der Client
  macht daraus aktuell einen harten Redirect auf `/` (SEC-MP-04).
- Room-Codes sind 6-stellig aus 32 Zeichen (~1 Mrd. Kombinationen) — knapp für
  ungeschütztes Erraten, aber ohne Auth ist der Code die einzige Hürde (SEC-MP-01).

## 6. `agent_call` — WS-Agent-API

`roomManager.ts` Z. 255–286: Ein unauthentifizierter WS-Client kann
`AGENT_METHODS` (aus `routes/agentRoutes.ts`) aufrufen. ReadOnly-Liste
(`listStages`, `listTasks`, `listActions`, `listVariables`, `listObjects`,
`getTaskDetails`, `validate`) ist definiert; alle **anderen** Methoden schreiben
sofort nach `public/project.json` (`fs.writeFileSync`, Z. 276). → TD-013 / SEC-MP-09.

## Bekannte Einschränkungen

- **2 Spieler pro Raum** — Beobachter, Teams, >2 nicht vorgesehen.
- `input`/`trigger_event`/`state_sync`/Tasks relayed erst ab `gameStarted`;
  `broadcast_action` und `sync_project` **nicht**.
- Kein Rate-Limiting auf WS-Ebene.
- `roomManager` schreibt bei `agent_call` synchron — große Projekte blockieren den Event-Loop.

## Quellen

- `game-server/src/server.ts`, `game-server/src/websocket/roomManager.ts`, `game-server/src/Room.ts`, `game-server/src/Protocol.ts`
- `src/multiplayer/Protocol.ts`, `src/runtime/MultiplayerManager.ts`, `src/runtime/core/GameRuntimeMultiplayer.ts`
