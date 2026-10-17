# TTabControl

> Generierte Referenzkarte — Quelle: `src/components/TTabControl.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0107` |
| Kategorie | container |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TTabControl` |
| Legacy-Typnamen (typeMapping) | TabControl |
| Schema-Datei | — |
| Verwendung in Projekten | — |
| Server-Methoden | — |
| Umfang | 99 Zeilen |

## Beschreibung

TTabControl - Tab navigation component Allows switching between different content panels using tabs. Useful for organizing complex UIs like the Inspector.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `tabs` | Tabs (comma-separated) | string | Specifics |
| `activeTabIndex` | Active Tab Index | number | Specifics |
| `activeTabName` | Active Tab Name | string | Specifics |
| `style.color` | Text Color | color | Style |
| `style.borderColor` | Border Color | color | Style |

## Öffentliche Methoden

`selectTabByIndex`, `selectTabByName`, `addTab`, `removeTab`, `getInspectorProperties`, `toDTO`

## Einschränkungen

- In keinem mitgelieferten Projekt verwendet.

## Quellen

- `src/components/TTabControl.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
