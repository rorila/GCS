# TServerParentAccount

> Generierte Referenzkarte — Quelle: `src/components/TServerParentAccount.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0073` |
| Kategorie | server |
| Basisklasse | TServerDesignComponent |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TServerParentAccount` |
| Legacy-Typnamen (typeMapping) | ServerParentAccount |
| Schema-Datei | docs/schemas/schema_server_cms.json |
| Verwendung in Projekten | 1 |
| Server-Methoden | 3 (`childProfile`, `updateChildProfile`, `setChildCode`) |
| Umfang | 13 Zeilen |

## Beschreibung

Liefert nur serverseitig die Elternsicht — Kindbezug wird je Aufruf gegen bestätigte Zuordnungen geprüft.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `parentPolicy` | Verbindliche Elternsicht-Regel | string | SERVER / SICHERHEIT |

## Öffentliche Methoden

`getInspectorProperties`

## Verwendete in Projekten

- `game-server\public\projects\GCS-CMS.json`

## Quellen

- `src/components/TServerParentAccount.ts`
- `scripts/cms/cms-server-components.cjs` (Server-Methoden)
- `docs/schemas/schema_server_cms.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
