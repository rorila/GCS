# TVariable

> Generierte Referenzkarte — Quelle: `src/components/TVariable.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0118` |
| Kategorie | variablen |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TVariable` |
| Legacy-Typnamen (typeMapping) | Variable |
| Schema-Datei | — |
| Verwendung in Projekten | 13 |
| Server-Methoden | — |
| Umfang | 112 Zeilen |

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `type` | Typ | select | Variable |
| `defaultValue` | Standardwert | string | Variable |
| `value` | Aktueller Wert | string | Variable |
| `objectModel` | Modell (Entität) | select | Variable |

## Ereignisse

`onValueChanged`

## Öffentliche Methoden

`getInspectorProperties`, `getEvents`, `toDTO`

## Getter

`type`, `variableType`

## Verwendete in Projekten

- `game-server\public\projects\BonsaiTetris.json`
- `game-server\public\projects\ElinsMemory.json`
- `game-server\public\projects\ElinsMemoryRemote.json`
- `game-server\public\projects\GCS-CMS.json`
- `game-server\public\projects\LeonasAxolotlSpiel.json`
- `game-server\public\projects\Madn-Remote.json`
- `game-server\public\projects\Madn.json`
- `game-server\public\projects\MauMau.json`
- `game-server\public\projects\MyCoolGame.json`
- `game-server\public\projects\UfoShoter4.json`
- `public\projects\Madn.json`
- `public\projects\MauMau.json`
- `public\test-projects\UfoShoter4.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `scripts\test-export-patterns.cjs`
- `scripts\test_variable_morphing_robustness.ts`
- `tests\editor_shelf.test.ts`
- `tests\guards.test.ts`
- `tests\nonvisual_inspector.test.ts`
- `tests\serialization.test.ts`
- `tests\sprite_pool_variable.test.ts`
- `tests\stage_import.test.ts`
- `tests\variable_inspector.test.ts`

## Quellen

- `src/components/TVariable.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
