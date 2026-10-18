# TSidePanel

> Generierte Referenzkarte — Quelle: `src/components/TSidePanel.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0089` |
| Kategorie | container |
| Basisklasse | TDialogRoot |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TSidePanel` |
| Legacy-Typnamen (typeMapping) | SidePanel |
| Schema-Datei | docs/schemas/schema_dialogs.json |
| Verwendung in Projekten | — |
| Server-Methoden | — |
| Umfang | 377 Zeilen |

## Beschreibung

TSidePanel — Generisches Side-Panel (erbt von TDialogRoot) Ein Container-Panel, das von der Seite (links/rechts) einschiebt. Unterstützt Kinder-Komponenten, Overlay-Dimming, Resize im Run-Modus, und alle Dialog-Features (closable, show/hide/toggle, Events). Unterschiede zu TDialogRoot: - Dockt an linken oder rechten Bühnenrand an (side-Property) - Volle Bühnenhöhe (Full Height) - Resize-Handle im Run-Modus (resizable) - overlayDimming separat steuerbar - modal default = false (Side-Panel blockiert Hintergrund normalerweise nicht) - centerOnShow = false (Side-Panel dockt am Rand an) - draggableAtRuntime = false (Side-Panel ist nicht verschiebbar)

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `side` | Seite | select | Side Panel |
| `resizable` | Resize (Run) | boolean | Side Panel |
| `overlayDimming` | Hintergrund dimmen | boolean | Side Panel |
| `pauseGame` | Spiel pausieren | boolean | Side Panel |

## Öffentliche Methoden

`getInspectorProperties`, `toDTO`, `createRuntimeElement`, `updateRuntimeVisibility`

## Getter

`panelSide`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `tests\side_panel.test.ts`

## Einschränkungen

- In keinem mitgelieferten Projekt verwendet.

## Quellen

- `src/components/TSidePanel.ts`
- `docs/schemas/schema_dialogs.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
