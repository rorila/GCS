# TServerValidate

> Generierte Referenzkarte — Quelle: `src/components/TServerValidate.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0087` |
| Kategorie | server |
| Basisklasse | TServerComponent |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TServerValidate` |
| Legacy-Typnamen (typeMapping) | ServerValidate |
| Schema-Datei | docs/schemas/schema_server.json |
| Verwendung in Projekten | 1 |
| Server-Methoden | 17 (`avatar`, `residentAvatar`, `requestId`, `text`, `textOptional`, `boolean`, `confirmed`, `choice`, `choiceDefault`, `minutes`, `windows`, `number`, `nonempty`, `object`, `adminInput`, `loginInput`, `emojiSeq`) |
| Umfang | 14 Zeilen |

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `validationRule` | Verbindliche Eingaberegel | string | SERVER / PRÜFUNG |
| `failureMessage` | Hinweis bei ungültiger Eingabe | string | SERVER / RÜCKMELDUNG |

## Öffentliche Methoden

`getInspectorProperties`

## Verwendete in Projekten

- `game-server\public\projects\GCS-CMS.json`

## Quellen

- `src/components/TServerValidate.ts`
- `scripts/cms/cms-server-components.cjs` (Server-Methoden)
- `docs/schemas/schema_server.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
