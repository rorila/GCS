# TServerLiveSync

> Generierte Referenzkarte — Quelle: `src/components/TServerLiveSync.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0072` |
| Kategorie | server |
| Basisklasse | TServerDesignComponent |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TServerLiveSync` |
| Legacy-Typnamen (typeMapping) | ServerLiveSync |
| Schema-Datei | docs/schemas/schema_server_cms.json |
| Verwendung in Projekten | 1 |
| Server-Methoden | 3 (`input`, `state`, `snapshot`) |
| Umfang | 32 Zeilen |

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `endpointPath` | Live-Endpunkt | string | SERVER / LIVE-SYNC |
| `maxPayloadBytes` | Payload-Limit (Bytes) | number | SERVER / LIVE-SYNC |
| `maxMessagesPerSecond` | Nachrichten/Sekunde | number | SERVER / LIVE-SYNC |
| `inputTtlMs` | Eingabe-Gültigkeit (ms) | number | SERVER / LIVE-SYNC |
| `maxStateAgeMs` | State-Alter (ms) | number | SERVER / LIVE-SYNC |
| `livePolicy` | Verbindliche Sync-Regel | string | SERVER / SICHERHEIT |

## Öffentliche Methoden

`getInspectorProperties`

## Verwendete in Projekten

- `game-server\public\projects\GCS-CMS.json`

## Quellen

- `src/components/TServerLiveSync.ts`
- `scripts/cms/cms-server-components.cjs` (Server-Methoden)
- `docs/schemas/schema_server_cms.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
