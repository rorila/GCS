# TInlineOverlay

> Generierte Referenzkarte — Quelle: `src/components/TInlineOverlay.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0040` |
| Kategorie | overlay |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TInlineOverlay` |
| Legacy-Typnamen (typeMapping) | InlineOverlay |
| Schema-Datei | docs/schemas/schema_dialogs.json |
| Verwendung in Projekten | 1 |
| Server-Methoden | — |
| Umfang | 460 Zeilen |

## Beschreibung

TInlineOverlay – platzierbare Einblendung direkt in der Stage-Runtime. Zwei deklarierte Flaechen: kompakt (x/y/width/height) und aufgeklappt (expandedBounds). Die Komponente kennt keine Fachdaten und laed kein eigenes Projekt — sie verwaltet nur Zustand, Geometrie, Interaktion und Fokus. Fachliche Inhalte liefern Unterklassen ueber renderExpandedContent() bzw. renderCompactContent(). Laufzeitkontrakt: - getEffectiveBounds() liefert die wirksame Raster-Geometrie; Renderer und Layout-Engine fragen sie ab (kein Klassenname-Hack). - activate(source) fuehrt zuerst den eingebauten Zustandswechsel aus (activationAction) und feuert danach onClick mit dem neuen Zustand — genau einmal pro Aktivierung. - interactionMode 'passthrough': kein Zeiger-/Tastaturziel, Klicks gehen durch die Flaeche hindurch. Events: onClick {source, expanded}, onExpanded {bounds}, onCollapsed {reason}, onShown/onHidden (via visible)

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `text` | Titel/Text | string | DARSTELLUNG |
| `expandedText` | Detailtext | string | DARSTELLUNG |
| `expandedBounds.x` | Detail X | number | DETAILANSICHT |
| `expandedBounds.y` | Detail Y | number | DETAILANSICHT |
| `expandedBounds.width` | Detail Breite | number | DETAILANSICHT |
| `expandedBounds.height` | Detail Höhe | number | DETAILANSICHT |
| `initialState` | Startzustand | select | DETAILANSICHT |
| `previewExpanded` | Vorschau aufgeklappt | boolean | DETAILANSICHT |
| `interactionMode` | Interaktion | select | INTERAKTION |
| `activationAction` | Aktivierung | select | INTERAKTION |
| `expandedModal` | Detail modal | boolean | INTERAKTION |
| `showCloseButton` | Schliessen-Button | boolean | INTERAKTION |
| `closeOnEscape` | Escape schliesst | boolean | INTERAKTION |
| `pauseGame` | Spiel pausieren | boolean | INTERAKTION |
| `isExpanded` | Aufgeklappt | boolean | STATUS |

## Ereignisse

`onExpanded`, `onCollapsed`, `onShown`, `onHidden`

## Öffentliche Methoden

`getEffectiveBounds`, `isActivatable`, `getRuntimePointerMode`, `activate`, `expand`, `collapse`, `toggleExpanded`, `show`, `hide`, `requestClose`, `renderCompactContent`, `renderExpandedContent`, `initRuntime`, `onRuntimeRendered`, `onRuntimeStop`, `getEvents`, `getInspectorProperties`

## Verwendete in Projekten

- `game-server\public\projects\Karteikasten-Quiz.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `scripts\test-inline-overlays.ts`

## Quellen

- `src/components/TInlineOverlay.ts`
- `docs/schemas/schema_dialogs.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
