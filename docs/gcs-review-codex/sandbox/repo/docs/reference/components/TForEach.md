# TForEach

> Generierte Referenzkarte — Quelle: `src/components/TForEach.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0025` |
| Kategorie | struktur |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | — |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TForEach` |
| Schema-Datei | — |
| Verwendung in Projekten | 2 |
| Server-Methoden | — |
| Umfang | 457 Zeilen |

## Beschreibung

TForEach — Deklarativer Repeater-Container. Erzeugt zur Laufzeit dynamisch Kinder-Komponenten basierend auf einer Listen- oder Map-Variable. Jedes Item der Source bekommt einen Klon des Templates zugewiesen. Properties (Design-Time): - source: Name der Quell-Variable (Array oder Object/Map) - template: JSON-Definition der zu klonenden Komponente - layout: 'grid' | 'horizontal' | 'vertical' - cols: Spaltenanzahl bei layout='grid' - gap: Abstand zwischen Items (in Grid-Cells) - itemWidth: Breite pro Item (in Grid-Cells) - itemHeight: Höhe pro Item (in Grid-Cells) - namePattern: Naming-Pattern für Klone (default: '{name}_{index}') Template-Bindings: - ${item} → Aktuelles Element (Wert oder Objekt) - ${item.property} → Property eines Objekt-Elements - ${index} → 0-basierter Index des Elements - ${key} → Schlüssel bei Map-Iteration

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `source` | Quell-Variable | string | DATEN |
| `layout` | Layout | select | DATEN |
| `cols` | Spalten (grid) | number | DATEN |
| `rows` | Zeilen (max) | number | DATEN |
| `gap` | Abstand (Grid-Cells) | number | DATEN |
| `itemWidth` | Item-Breite (Cells) | number | DATEN |
| `itemHeight` | Item-Höhe (Cells) | number | DATEN |
| `namePattern` | Name-Pattern | string | DATEN |
| `emptyMessage` | Leer-Nachricht | string | DATEN |

## Öffentliche Methoden

`getInspectorProperties`, `initRuntime`, `onRuntimeStart`, `onRuntimeUpdate`, `onRuntimeStop`

## Verwendete in Projekten

- `public\projects\MemoryGame.json`
- `public\test-projects\MemoryGame.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `tests\foreach_repeater.test.ts`

## Einschränkungen

- In der Editor-Registry (services/ComponentRegistry) nicht registriert — nicht über die normale Toolbox erzeugbar.

## Quellen

- `src/components/TForEach.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
