# TMemo

> Generierte Referenzkarte — Quelle: `src/components/TMemo.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0051` |
| Kategorie | eingabe |
| Basisklasse | TTextControl |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TMemo` |
| Schema-Datei | docs/schemas/schema_inputs.json |
| Verwendung in Projekten | 2 |
| Server-Methoden | — |
| Umfang | 53 Zeilen |

## Beschreibung

TMemo - Multi-line text component Allows users to display or edit multiple lines of text. Perfect for logs, large descriptions, or JSON data.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `text` | Text | string | Specifics |
| `placeholder` | Placeholder | string | Specifics |
| `readOnly` | Read Only | boolean | Specifics |

## Öffentliche Methoden

`getInspectorProperties`, `toDTO`

## Verwendete in Projekten

- `game-server\public\projects\GCS-CMS.json`
- `game-server\public\projects\GCS-SQL-Tool.json`

## Quellen

- `src/components/TMemo.ts`
- `docs/schemas/schema_inputs.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
