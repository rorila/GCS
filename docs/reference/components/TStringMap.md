# TStringMap

> Generierte Referenzkarte — Quelle: `src/components/TStringMap.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0103` |
| Kategorie | daten |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TStringMap` |
| Legacy-Typnamen (typeMapping) | StringMap |
| Schema-Datei | docs/schemas/schema_variables.json |
| Verwendung in Projekten | 3 |
| Server-Methoden | — |
| Umfang | 167 Zeilen |

## Beschreibung

TStringMap - Eine Key-Value-Komponente für Texte. Speichert benannte Strings (z.B. Button-Texte, Labels, Übersetzungen). Zugriff zur Laufzeit via: ${MapName.key} Beispiel: ${Texte.btnLogin} → "Anmelden" Der value-Getter gibt entries zurück, damit PropertyHelper.resolveValue() die Map korrekt auflöst (isVariable → val.value → entries).

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `editEntries` | 📝 Einträge bearbeiten... | button | STRINGMAP |

## Ereignisse

`onEntryChanged`

## Öffentliche Methoden

`set`, `get`, `has`, `delete`, `getInspectorProperties`, `getEvents`, `executeAction`, `getAvailableActions`, `toDTO`

## Getter

`value`, `count`

## Verwendete in Projekten

- `game-server\public\projects\Tetris_Classic.json`
- `game-server\public\projects\UfoShoter4.json`
- `public\test-projects\UfoShoter4.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `scripts\test_classic_flow.ts`
- `tests\nonvisual_inspector.test.ts`

## Quellen

- `src/components/TStringMap.ts`
- `docs/schemas/schema_variables.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
