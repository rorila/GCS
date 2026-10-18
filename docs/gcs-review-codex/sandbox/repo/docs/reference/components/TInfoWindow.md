# TInfoWindow

> Generierte Referenzkarte — Quelle: `src/components/TInfoWindow.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0039` |
| Kategorie | overlay |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TInfoWindow` |
| Legacy-Typnamen (typeMapping) | InfoWindow |
| Schema-Datei | — |
| Verwendung in Projekten | — |
| Server-Methoden | — |
| Umfang | 451 Zeilen |

## Beschreibung

TInfoWindow - Modal info window for feedback and waiting states Shows messages with optional spinner, cancel/confirm buttons, and auto-close functionality.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `title` | Title | string | Content |
| `message` | Message | string | Content |
| `icon` | Icon | image_picker | Content |
| `iconSize` | Icon Size | number | Content |
| `showCancelButton` | Show Cancel | boolean | Buttons |
| `cancelButtonText` | Cancel Text | string | Buttons |
| `showConfirmButton` | Show Confirm | boolean | Buttons |
| `confirmButtonText` | Confirm Text | string | Buttons |
| `showSpinner` | Show Spinner | boolean | Behavior |
| `autoClose` | Auto Close | boolean | Behavior |
| `autoCloseDelay` | Auto Close Delay (ms) | number | Behavior |
| `padding` | Padding | number | Style |

## Ereignisse

`onCancel`, `onConfirm`, `onAutoClose`

## Öffentliche Methoden

`showMessage`, `setMessage`, `hide`, `handleCancel`, `handleConfirm`, `getInspectorProperties`, `getEvents`, `getInspectorEvents`, `toDTO`, `createRuntimeElement`

## Einschränkungen

- In keinem mitgelieferten Projekt verwendet.

## Quellen

- `src/components/TInfoWindow.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
