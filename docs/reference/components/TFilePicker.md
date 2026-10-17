# TFilePicker

> Generierte Referenzkarte — Quelle: `src/components/TFilePicker.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0022` |
| Kategorie | eingabe |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TFilePicker` |
| Legacy-Typnamen (typeMapping) | FilePicker |
| Schema-Datei | docs/schemas/schema_server.json |
| Verwendung in Projekten | 1 |
| Server-Methoden | — |
| Umfang | 20 Zeilen |

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `accept` | Dateitypen | string | DATEIAUSWAHL |
| `maxBytes` | Maximale Bytes | number | DATEIAUSWAHL |

## Ereignisse

`onSelected`, `onCancel`, `onError`

## Öffentliche Methoden

`initRuntime`, `choose`, `clear`, `getFile`, `onRuntimeStop`, `getEvents`, `getInspectorProperties`

## Verwendete in Projekten

- `game-server\public\projects\GCS-CMS.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `scripts\test-aufbau-5-spiele.cjs`
- `scripts\test-cms-resident-create-avatar-emoji.cjs`

## Quellen

- `src/components/TFilePicker.ts`
- `docs/schemas/schema_server.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
