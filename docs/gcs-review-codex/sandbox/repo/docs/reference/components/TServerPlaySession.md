# TServerPlaySession

> Generierte Referenzkarte — Quelle: `src/components/TServerPlaySession.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0076` |
| Kategorie | server |
| Basisklasse | TServerDesignComponent |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TServerPlaySession` |
| Legacy-Typnamen (typeMapping) | ServerPlaySession |
| Schema-Datei | docs/schemas/schema_server_cms.json |
| Verwendung in Projekten | 1 |
| Server-Methoden | 12 (`load`, `activeSession`, `budgetLeft`, `reconnect`, `start`, `heartbeat`, `setStatus`, `launchGame`, `reportProgress`, `sweep`, `mathCommand`, `mathSummary`) |
| Umfang | 14 Zeilen |

## Beschreibung

Führt nur serverseitig Spielsitzungen — Zeitbuchung, Zeitbudget und Einzelsitzungsregel liegen ausschließlich hier.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `heartbeatMs` | Heartbeat-Intervall (ms) | number | SERVER / SITZUNG |
| `disconnectGraceMs` | Trennungs-Grace (ms) | number | SERVER / SITZUNG |
| `graceMinutes` | Budget-Nachlauf (min) | number | SERVER / SITZUNG |
| `playPolicy` | Verbindliche Sitzungsregel | string | SERVER / SICHERHEIT |

## Öffentliche Methoden

`getInspectorProperties`

## Verwendete in Projekten

- `game-server\public\projects\GCS-CMS.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `scripts\test-cms-mp.cjs`

## Quellen

- `src/components/TServerPlaySession.ts`
- `scripts/cms/cms-server-components.cjs` (Server-Methoden)
- `docs/schemas/schema_server_cms.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
