# TServerDecks

> Generierte Referenzkarte — Quelle: `src/components/TServerDecks.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0069` |
| Kategorie | server |
| Basisklasse | TServerDesignComponent |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TServerDecks` |
| Legacy-Typnamen (typeMapping) | ServerDecks |
| Schema-Datei | — |
| Verwendung in Projekten | 1 |
| Server-Methoden | 15 (`dto`, `decks`, `deckInfo`, `decksManage`, `deckCards`, `deckSave`, `deckRemove`, `deckCardSave`, `deckCardRemove`, `deckPublish`, `deckApprove`, `deckAssign`, `deckAssignables`, `deckFromTopic`, `deckImport`) |
| Umfang | 11 Zeilen |

## Beschreibung

Verwaltet nur serverseitig Kartenstapel (cardDecks) — Zuordnung an Kinder, Erwachsenen-Freigabe für Kind-Stapel und Kopier-Übernahme werden hier erzwungen.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `deckPolicy` | Verbindliche Stapelregel | string | SERVER / SICHERHEIT |

## Öffentliche Methoden

`getInspectorProperties`

## Verwendete in Projekten

- `game-server\public\projects\GCS-CMS.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `scripts\test-adult-learners.cjs`

## Quellen

- `src/components/TServerDecks.ts`
- `scripts/cms/cms-server-components.cjs` (Server-Methoden)

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
