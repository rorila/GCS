# THeartbeat

> Generierte Referenzkarte — Quelle: `src/components/THeartbeat.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0034` |
| Kategorie | zeitgeber |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `THeartbeat` |
| Legacy-Typnamen (typeMapping) | Heartbeat |
| Schema-Datei | — |
| Verwendung in Projekten | 2 |
| Server-Methoden | — |
| Umfang | 218 Zeilen |

## Beschreibung

THeartbeat Component Monitors connection quality during multiplayer games. Starts automatically after game_start. Events: - onPing: Ping was sent - onPong: Pong was received - onLatencyWarning: Latency above threshold (500ms) - onMissedPong: A pong was missed - onPeerTimeout: Other player not responding - onReconnecting: Connection is being restored - onReconnected: Connection was restored - onConnectionLost: Own connection lost

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `pingInterval` | Ping-Intervall (ms) | number | Heartbeat |
| `timeoutThreshold` | Max. verpasste Pongs | number | Heartbeat |
| `latencyWarningThreshold` | Latenz-Warnung (ms) | number | Heartbeat |
| `enabled` | Aktiviert | boolean | Heartbeat |
| `latency` | Aktuelle Latenz | number | Status |
| `missedPongs` | Verpasste Pongs | number | Status |
| `status` | Status | string | Status |

## Ereignisse

`onPing`, `onPong`, `onLatencyWarning`, `onMissedPong`, `onPeerTimeout`, `onReconnecting`, `onReconnected`, `onConnectionLost`

## Öffentliche Methoden

`getInspectorProperties`, `getEvents`, `toDTO`, `start`, `stop`, `forcePing`, `_startTimer`, `_stopTimer`, `_handlePong`, `_fireEvent`, `_setConnectionLost`

## Verwendete in Projekten

- `game-server\public\projects\PingPong.json`
- `public\test-projects\PingPong.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `tests\nonvisual_inspector.test.ts`

## Quellen

- `src/components/THeartbeat.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
