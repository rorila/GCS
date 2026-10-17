# TAudio

> Generierte Referenzkarte — Quelle: `src/components/TAudio.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0003` |
| Kategorie | media |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TAudio` |
| Legacy-Typnamen (typeMapping) | Audio |
| Schema-Datei | docs/schemas/schema_media.json |
| Verwendung in Projekten | 5 |
| Server-Methoden | — |
| Umfang | 113 Zeilen |

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `src` | Audio Datei | audio_picker | Audio |
| `volume` | Lautstärke (0.0-1.0) | number | Audio |
| `loop` | Wiederholen (Loop) | boolean | Audio |
| `preload` | Preload in RAM (Zero-Latency) | boolean | Audio |
| `active` | Aktiv | boolean | Audio |

## Ereignisse

`onPlay`, `onStop`

## Öffentliche Methoden

`getInspectorProperties`, `getEvents`, `toDTO`, `initRuntime`, `onRuntimeStart`, `onRuntimeStop`, `play`, `stop`

## Getter

`active`

## Verwendete in Projekten

- `game-server\public\projects\LeonasAxolotlSpiel.json`
- `game-server\public\projects\Mathe-Insel-Flussbruecke.json`
- `game-server\public\projects\Mathe-Zaehlen-Turmbau.json`
- `game-server\public\projects\UfoShoter4.json`
- `public\test-projects\UfoShoter4.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `tests\nonvisual_inspector.test.ts`

## Quellen

- `src/components/TAudio.ts`
- `docs/schemas/schema_media.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
