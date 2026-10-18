# TServerEndpoint

> Generierte Referenzkarte — Quelle: `src/components/TServerEndpoint.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0070` |
| Kategorie | server |
| Basisklasse | TServerComponent |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TServerEndpoint` |
| Legacy-Typnamen (typeMapping) | ServerEndpoint |
| Schema-Datei | docs/schemas/schema_server.json |
| Verwendung in Projekten | 2 |
| Server-Methoden | — |
| Umfang | 16 Zeilen |

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `endpointPath` | Anfragepfad (Anmelde-Pilot) | string | SERVER / REQUEST |
| `httpMethod` | HTTP-Methode | string | SERVER / REQUEST |
| `traceEnabled` | Diagnose bei Debug-Anfragen erfassen | boolean | SERVER / DIAGNOSE |

## Ereignisse

`onRequest`

## Öffentliche Methoden

`getEvents`, `getInspectorProperties`

## Verwendete in Projekten

- `game-server\public\projects\GCS-CMS.json`
- `game-server\public\projects\GCS-SQL-Tool.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `scripts\test-admin-login.cjs`
- `scripts\test-cms-cards.cjs`
- `scripts\test-cms-parent.cjs`
- `scripts\test-server-pilot.cjs`

## Quellen

- `src/components/TServerEndpoint.ts`
- `docs/schemas/schema_server.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
