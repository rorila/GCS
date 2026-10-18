# TInspectorTemplate

> Generierte Referenzkarte — Quelle: `src/components/TInspectorTemplate.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0042` |
| Kategorie | struktur |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | nicht getestet |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TInspectorTemplate` |
| Legacy-Typnamen (typeMapping) | InspectorTemplate |
| Schema-Datei | — |
| Verwendung in Projekten | — |
| Server-Methoden | — |
| Umfang | 177 Zeilen |

## Beschreibung

Property Layout Configuration for a single property / export interface PropertyLayoutConfig { name: string; label: string; type: string; visible: boolean; groupId: string; order: number; style?: { color?: string; fontSize?: string; fontFamily?: string; backgroundColor?: string; }; } /** Group Configuration for Inspector layout / export interface GroupConfig { id: string; label: string; order: number; collapsed: boolean; } /** Complete Inspector Layout Configuration / export interface InspectorLayoutConfig { version: string; groups: GroupConfig[]; properties: Record<string, PropertyLayoutConfig>; } /** TInspectorTemplate - Visual Inspector Layout Designer A component that can be placed on the stage to visually design the layout of the Inspector panel. Shows example properties for all supported types and allows drag & drop reordering.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `title` | Titel | string | Template |

## Öffentliche Methoden

`getInspectorProperties`, `exportLayoutJSON`, `importLayout`, `toDTO`

## Einschränkungen

- In keinem mitgelieferten Projekt verwendet.

## Quellen

- `src/components/TInspectorTemplate.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
