# TCmsLiveSync

> Generierte Referenzkarte — Quelle: `src/components/TCmsLiveSync.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0012` |
| Kategorie | system |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TCmsLiveSync` |
| Schema-Datei | — |
| Verwendung in Projekten | 3 |
| Server-Methoden | — |
| Umfang | 387 Zeilen |

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `launchKey` | Launch-Key | string | Live-Sync |
| `partyId` | Partie-ID | string | Live-Sync |
| `enabled` | Aktiviert | boolean | Live-Sync |
| `endpointPath` | Live-Endpunkt | string | Live-Sync |
| `status` | Status | string | Live-Sync |
| `lastSeq` | Letzte Aktions-Seq | number | Live-Sync |
| `inputSeq` | Eingabe-Seq | number | Live-Sync |
| `stateTick` | State-Tick | number | Live-Sync |
| `seatIndex` | Eigener Sitzplatz | number | Live-Sync |
| `lastError` | Letzter Fehler | string | Live-Sync |

## Ereignisse

`onConnected`, `onDisconnected`, `onLive`, `onError`

## Öffentliche Methoden

`getInspectorProperties`, `getEvents`, `initRuntime`, `sendInput`, `sendState`, `sendGameState`, `sendIntent`, `poll`, `applyBall`, `applyPaddle`, `applyRemoteInput`, `syncRemotePaddle`, `onRuntimeStop`

## Getter

`pushConnected`

## Verwendete in Projekten

- `game-server\public\projects\ElinsMemoryRemote.json`
- `game-server\public\projects\Madn-Remote.json`
- `game-server\public\projects\PingPong-Remote.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `scripts\test-editor-cms-memory.cjs`
- `scripts\test-editor-multiplayer.cjs`
- `tests\collection_actions.test.ts`

## Quellen

- `src/components/TCmsLiveSync.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
