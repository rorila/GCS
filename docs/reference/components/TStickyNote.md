# TStickyNote

> Generierte Referenzkarte — Quelle: `src/components/TStickyNote.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0102` |
| Kategorie | anzeige |
| Basisklasse | TTextControl |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TStickyNote` |
| Legacy-Typnamen (typeMapping) | StickyNote |
| Schema-Datei | — |
| Verwendung in Projekten | 2 |
| Server-Methoden | — |
| Umfang | 74 Zeilen |

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `title` | Titel | string | INHALT |
| `noteColor` | Kategorie | select | DARSTELLUNG |

## Öffentliche Methoden

`getInspectorProperties`, `toDTO`

## Getter

`hasVisualInspector`, `noteColor`

## Verwendete in Projekten

- `game-server\public\projects\UfoShoter4.json`
- `public\test-projects\UfoShoter4.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `tests\editor_shelf.test.ts`
- `tests\nonvisual_inspector.test.ts`

## Quellen

- `src/components/TStickyNote.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
