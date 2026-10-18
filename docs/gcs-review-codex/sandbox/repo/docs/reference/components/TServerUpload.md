# TServerUpload

> Generierte Referenzkarte — Quelle: `src/components/TServerUpload.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0086` |
| Kategorie | server |
| Basisklasse | TServerDesignComponent |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TServerUpload` |
| Legacy-Typnamen (typeMapping) | ServerUpload |
| Schema-Datei | docs/schemas/schema_server.json |
| Verwendung in Projekten | 1 |
| Server-Methoden | 2 (`process`, `remove`) |
| Umfang | 9 Zeilen |

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `kind` | Dateiverwendung | select | SERVER / PRÜFUNG |
| `maxBytes` | Maximale Bytes | number | SERVER / PRÜFUNG |
| `successMessage` | Erfolgsmeldung | string | SERVER / RÜCKMELDUNG |
| `failureMessage` | Formatfehler | string | SERVER / RÜCKMELDUNG |

## Ereignisse

`onRequest`

## Öffentliche Methoden

`getEvents`, `getInspectorProperties`

## Verwendete in Projekten

- `game-server\public\projects\GCS-CMS.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `scripts\test-cms-parent-child-profile.cjs`

## Quellen

- `src/components/TServerUpload.ts`
- `scripts/cms/cms-server-components.cjs` (Server-Methoden)
- `docs/schemas/schema_server.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
