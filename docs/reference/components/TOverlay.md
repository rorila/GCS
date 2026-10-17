# TOverlay

> Generierte Referenzkarte — Quelle: `src/components/TOverlay.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0057` |
| Kategorie | overlay |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | — |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TOverlay` |
| Schema-Datei | docs/schemas/schema_dialogs.json |
| Verwendung in Projekten | 1 |
| Server-Methoden | — |
| Umfang | 289 Zeilen |

## Beschreibung

TOverlay – Bettenet ein anderes Projekt als modale Overlay-Karte ein. show() erzeugt einen Abdunkel-Backdrop ueber der Stage und einen iframe (./player.html?game=<overlayProject>&params=...) INNERHALB der Komponenten- Box. Das Overlay laeuft in einer eigenen Runtime und sieht nur die uebergebenen params. Das Overlay-Projekt schliesst sich ueber die Action 'close_overlay' (postMessage an das Elternfenster); das Ergebnis wird als onOverlayResult-Event an den Flow gemeldet. Events: onOverlayResult – data: Felder des result-Objekts onOverlayClosed – Overlay wurde geschlossen (auch ohne Ergebnis)

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `overlayProject` | Overlay-Projekt | string | OVERLAY |
| `params` | Übergabedaten (JSON) | json | OVERLAY |
| `pauseGame` | Spiel pausieren | boolean | OVERLAY |
| `dimOpacity` | Abdunkelung (0–1) | number | OVERLAY |
| `closable` | X-Button anzeigen | boolean | OVERLAY |
| `closeOnEscape` | Escape schliesst | boolean | OVERLAY |
| `isOpen` | Geöffnet | boolean | STATUS |

## Ereignisse

`onOverlayResult`, `onOverlayClosed`

## Öffentliche Methoden

`getInspectorProperties`, `initRuntime`, `onRuntimeStop`, `show`, `close`, `getEvents`, `toDTO`

## Verwendete in Projekten

- `game-server\public\projects\MathePuzzle.json`

## Einschränkungen

- In der Editor-Registry (services/ComponentRegistry) nicht registriert — nicht über die normale Toolbox erzeugbar.

## Quellen

- `src/components/TOverlay.ts`
- `docs/schemas/schema_dialogs.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
