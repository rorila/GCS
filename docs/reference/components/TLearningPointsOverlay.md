# TLearningPointsOverlay

> Generierte Referenzkarte — Quelle: `src/components/TLearningPointsOverlay.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0047` |
| Kategorie | overlay |
| Basisklasse | TInlineOverlay |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TLearningPointsOverlay` |
| Legacy-Typnamen (typeMapping) | LearningPointsOverlay |
| Schema-Datei | docs/schemas/schema_display.json |
| Verwendung in Projekten | 1 |
| Server-Methoden | — |
| Umfang | 207 Zeilen |

## Beschreibung

TLearningPointsOverlay – zentrale Karteikasten-Lernpunkte im Spiel. Zeigt den CMS-gefuehrten Punktestand des Kindes (gepruefte Buchungen) kompakt an und klappt auf Wunsch eine Detailansicht auf. Die Komponente meldet selbst niemals Punkte — sie konsumiert ausschliess- lich die geteilte Datenquelle LearningPointsController (Launch-gesch- uetzter /api/cms/play-Weg). Eigene Events: onPointsChanged, onDataUpdated, onDataError Eigene Methoden: refresh(), applyLearningResult(result)

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `refreshIntervalSeconds` | Abrufintervall (s) | number | DATENANBINDUNG |

## Ereignisse

`onPointsChanged`, `onDataUpdated`, `onDataError`

## Öffentliche Methoden

`refresh`, `applyLearningResult`, `applyEndResult`, `renderCompactContent`, `renderExpandedContent`, `initRuntime`, `onRuntimeStop`, `getEvents`, `getInspectorProperties`

## Verwendete in Projekten

- `game-server\public\projects\Karteikasten-Quiz.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `scripts\test-cms-card-points-ui.cjs`
- `scripts\test-inline-overlays.ts`

## Quellen

- `src/components/TLearningPointsOverlay.ts`
- `docs/schemas/schema_display.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
