# TEmojiPicker

> Generierte Referenzkarte — Quelle: `src/components/TEmojiPicker.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0021` |
| Kategorie | eingabe |
| Basisklasse | TPanel |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TEmojiPicker` |
| Legacy-Typnamen (typeMapping) | EmojiPicker |
| Schema-Datei | — |
| Verwendung in Projekten | 1 |
| Server-Methoden | — |
| Umfang | 75 Zeilen |

## Beschreibung

TEmojiPicker - Eine Komponente zur Auswahl von Emojis. Ideal für kinderfreundliche Logins oder Interfaces.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `columns` | Spalten | number | PICKER |
| `itemSize` | Emoji-Größe (Cells) | number | PICKER |
| `emojis` | Emoji-Liste (JSON) | json | PICKER |
| `selectedEmoji` | Selektiertes Emoji | string | PICKER |
| `selectedId` | Selektierte Kennung | string | PICKER |
| `requestId` | Anfragekennung | string | PICKER |

## Ereignisse

`onSelect`, `onClick`, `onFocus`, `onBlur`

## Öffentliche Methoden

`initRuntime`, `newRequestId`, `getEvents`, `getInspectorProperties`, `toDTO`

## Verwendete in Projekten

- `game-server\public\projects\GCS-CMS.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `scripts\test-cms-resident-create-avatar-emoji.cjs`

## Quellen

- `src/components/TEmojiPicker.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
