# TEdit

> Generierte Referenzkarte — Quelle: `src/components/TEdit.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0020` |
| Kategorie | eingabe |
| Basisklasse | TTextControl |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TEdit` |
| Legacy-Typnamen (typeMapping) | Edit |
| Schema-Datei | docs/schemas/schema_inputs.json |
| Verwendung in Projekten | 10 |
| Server-Methoden | — |
| Umfang | 107 Zeilen |

## Beschreibung

TEdit - Text input component Allows users to enter and edit text in the game. Useful for forms, name input, chat, etc. Events (inherited from TWindow): onClick  - Fires when clicked onFocus  - Fires when input gains focus onBlur   - Fires when input loses focus Events (specific to TEdit): onChange - Fires when text changes onEnter  - Fires when Enter key is pressed

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `inputType` | Eingabetyp | select | EINGABE |
| `autocomplete` | Autovervollständigung | select | EINGABE |
| `placeholder` | Platzhalter | string | EINGABE |
| `maxLength` | Max. Länge | number | EINGABE |

## Ereignisse

`onChange`, `onEnter`

## Öffentliche Methoden

`triggerChange`, `triggerEnter`, `setOnChange`, `setOnEnter`, `getInspectorProperties`

## Getter

`caption`

## Verwendete in Projekten

- `game-server\public\projects\Aufgabenbereich-Karteikasten.json`
- `game-server\public\projects\GCS-CMS.json`
- `game-server\public\projects\GCS-SQL-Tool.json`
- `game-server\public\projects\Karteikasten-Quiz.json`
- `game-server\public\projects\Lernspiel-Geruest.json`
- `game-server\public\projects\Mathe-Insel-Flussbruecke.json`
- `game-server\public\projects\Mathe-Rechenballons.json`
- `game-server\public\projects\Mathe-Rechenpuzzle.json`
- `game-server\public\projects\Mathe-Zaehlen-Turmbau.json`
- `game-server\public\projects\project.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `scripts\test-cms-resident-create-avatar-emoji.cjs`
- `tests\mathe_quiz.test.ts`
- `tests\refactoring_manager.test.ts`

## Quellen

- `src/components/TEdit.ts`
- `docs/schemas/schema_inputs.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
