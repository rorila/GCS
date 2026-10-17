# TFileUpload

> Generierte Referenzkarte — Quelle: `src/components/TFileUpload.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0023` |
| Kategorie | eingabe |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TFileUpload` |
| Legacy-Typnamen (typeMapping) | FileUpload |
| Schema-Datei | docs/schemas/schema_server.json |
| Verwendung in Projekten | 1 |
| Server-Methoden | — |
| Umfang | 32 Zeilen |

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `picker` | Dateiauswahl-Komponente | string | UPLOAD |
| `endpoint` | CMS-Endpunkt | string | UPLOAD |

## Ereignisse

`onStarted`, `onProgress`, `onSuccess`, `onError`, `onCancel`

## Öffentliche Methoden

`initRuntime`, `start`, `startResidentCreate`, `cancel`, `onRuntimeStop`, `getEvents`, `getInspectorProperties`

## Verwendete in Projekten

- `game-server\public\projects\GCS-CMS.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `scripts\test-cms-resident-create-avatar-emoji.cjs`

## Quellen

- `src/components/TFileUpload.ts`
- `docs/schemas/schema_server.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
