# TServerCards

> Generierte Referenzkarte — Quelle: `src/components/TServerCards.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0068` |
| Kategorie | server |
| Basisklasse | TServerDesignComponent |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TServerCards` |
| Legacy-Typnamen (typeMapping) | ServerCards |
| Schema-Datei | — |
| Verwendung in Projekten | 1 |
| Server-Methoden | 11 (`dto`, `list`, `info`, `save`, `remove`, `answer`, `filter`, `pick`, `pointSummary`, `cardPointSummary`, `setPointMode`) |
| Umfang | 11 Zeilen |

## Beschreibung

Verwaltet nur serverseitig persönliche Karteikästen (Leitner) — Besitzer-, Ersteller- und Ablageregeln werden hier erzwungen.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `cardPolicy` | Verbindliche Kartenregel | string | SERVER / SICHERHEIT |

## Öffentliche Methoden

`getInspectorProperties`

## Verwendete in Projekten

- `game-server\public\projects\GCS-CMS.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `scripts\test-card-choice-storage.cjs`
- `scripts\test-deck-card-editor-server.cjs`

## Quellen

- `src/components/TServerCards.ts`
- `scripts/cms/cms-server-components.cjs` (Server-Methoden)

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
