# TServerResponse

> Generierte Referenzkarte — Quelle: `src/components/TServerResponse.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0079` |
| Kategorie | server |
| Basisklasse | TServerComponent |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TServerResponse` |
| Legacy-Typnamen (typeMapping) | ServerResponse |
| Schema-Datei | docs/schemas/schema_server.json |
| Verwendung in Projekten | 2 |
| Server-Methoden | 2 (`send`, `fail`) |
| Umfang | 15 Zeilen |

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `successMessage` | Erfolgsmeldung | string | SERVER / RÜCKMELDUNG |
| `responseFormat` | Antwortformat | string | SERVER / RESPONSE |
| `secretPolicy` | Schutz im Debug-Protokoll | string | SERVER / DIAGNOSE |

## Öffentliche Methoden

`getInspectorProperties`

## Verwendete in Projekten

- `game-server\public\projects\GCS-CMS.json`
- `game-server\public\projects\GCS-SQL-Tool.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `scripts\test-admin-login.cjs`
- `scripts\test-server-components.cjs`

## Quellen

- `src/components/TServerResponse.ts`
- `scripts/cms/cms-server-components.cjs` (Server-Methoden)
- `docs/schemas/schema_server.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
