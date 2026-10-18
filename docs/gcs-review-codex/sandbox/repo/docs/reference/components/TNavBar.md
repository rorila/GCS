# TNavBar

> Generierte Referenzkarte — Quelle: `src/components/TNavBar.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0052` |
| Kategorie | container |
| Basisklasse | TPanel |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TNavBar` |
| Schema-Datei | — |
| Verwendung in Projekten | — |
| Server-Methoden | — |
| Umfang | 66 Zeilen |

## Beschreibung

TNavBar - Eine Sidebar für die CMS-Navigation. Unterstützt vertikale Ausrichtung und Stage-Wechsel.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `navItems` | Menü-Items (JSON) | json | NAVIGATION |
| `activeId` | Aktive ID | string | NAVIGATION |
| `collapsed` | Eingeklappt | boolean | NAVIGATION |

## Ereignisse

`onSelect`, `onCollapse`, `onExpand`

## Öffentliche Methoden

`getEvents`, `getInspectorProperties`, `toDTO`

## Einschränkungen

- In keinem mitgelieferten Projekt verwendet.

## Quellen

- `src/components/TNavBar.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
