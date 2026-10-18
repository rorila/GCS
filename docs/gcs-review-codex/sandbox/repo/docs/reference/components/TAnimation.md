# TAnimation

> Generierte Referenzkarte — Quelle: `src/components/TAnimation.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0002` |
| Kategorie | spiel |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TAnimation` |
| Legacy-Typnamen (typeMapping) | Animation |
| Schema-Datei | — |
| Verwendung in Projekten | 3 |
| Server-Methoden | — |
| Umfang | 150 Zeilen |

## Beschreibung

TAnimation - Zyklisches Sprite-Sheet-Animation Kann einem oder mehreren Sprites zugeordnet werden. Das Sprite trägt `animationId` = Name dieser TAnimation.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `imageListId` | Image List | select | ANIMATION |
| `imageCount` | Anzahl Bilder | number | ANIMATION |
| `frameDuration` | Dauer pro Bild (ms) | number | ANIMATION |
| `loop` | Wiederholen | boolean | ANIMATION |
| `enabled` | Aktiviert | boolean | ANIMATION |

## Öffentliche Methoden

`getInspectorProperties`, `initRuntime`, `onRuntimeStart`, `onRuntimeUpdate`, `onRuntimeStop`, `toDTO`

## Verwendete in Projekten

- `game-server\public\projects\Kopfrechnen.json`
- `game-server\public\projects\LeonasAxolotlSpiel.json`
- `game-server\public\projects\Mathe-Insel-Flussbruecke.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `tests\nonvisual_inspector.test.ts`

## Quellen

- `src/components/TAnimation.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
