# TCardZone

> Generierte Referenzkarte — Quelle: `src/components/TCardZone.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0010` |
| Kategorie | spiel |
| Basisklasse | TTable |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TCardZone` |
| Legacy-Typnamen (typeMapping) | CardZone |
| Schema-Datei | — |
| Verwendung in Projekten | 2 |
| Server-Methoden | — |
| Umfang | 161 Zeilen |

## Beschreibung

TCardZone - Datengebundene Anzeige fuer eine Kartensammlung. Die Karten sind Datensaetze einer TObjectList. Die Zone filtert und sortiert diese Datensaetze und rendert sie als klickbare Bildkarten. So bleibt der Fachzustand deklarativ in den Records, ohne fuer jede Karte ein eigenes visuelles Stage-Objekt verwalten zu muessen.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `itemWidth` | Kartenbreite (Cells) | number | LAYOUT |
| `itemHeight` | Kartenhöhe (Cells) | number | LAYOUT |
| `gap` | Abstand (Cells) | number | LAYOUT |
| `orientation` | Ausrichtung | select | LAYOUT |
| `searchProperty` | Filterfeld | string | DATEN |
| `searchValue` | Filterwert | string | DATEN |
| `sortField` | Sortierfeld | string | DATEN |
| `imageField` | Bildfeld | string | KARTEN |
| `faceUpField` | Aufgedeckt-Feld | string | KARTEN |
| `src` | Rückseite | string | KARTEN |
| `highlightField` | Markierungsfeld | string | KARTEN |
| `selectionColor` | Auswahlfarbe | color | AUSWAHL |

## Öffentliche Methoden

`initRuntime`, `onRuntimeStop`, `onRuntimeUpdate`, `getRows`, `applyChange`, `getInspectorProperties`, `toDTO`

## Verwendete in Projekten

- `game-server\public\projects\MauMau.json`
- `public\projects\MauMau.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `scripts\test-maumau.cjs`

## Quellen

- `src/components/TCardZone.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
