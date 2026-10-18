# TSpeechRecognition

> Generierte Referenzkarte — Quelle: `src/components/TSpeechRecognition.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0093` |
| Kategorie | media |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TSpeechRecognition` |
| Legacy-Typnamen (typeMapping) | SpeechRecognition |
| Schema-Datei | docs/schemas/schema_media.json |
| Verwendung in Projekten | 7 |
| Server-Methoden | — |
| Umfang | 79 Zeilen |

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `language` | Sprache | string | Spracheingabe |
| `maxDurationMs` | Maximale Aufnahme (ms) | number | Spracheingabe |
| `silenceMs` | Sprechpause bis Abschluss (ms) | number | Spracheingabe |
| `prompt` | Erkennungshinweis | string | Spracheingabe |
| `available` | Verfügbar | boolean | Status |

## Ereignisse

`onReady`, `onListening`, `onResult`, `onNoSpeech`, `onError`

## Öffentliche Methoden

`initRuntime`, `prepare`, `start`, `stop`, `cancel`, `onRuntimeStop`, `getEvents`, `getInspectorProperties`, `toDTO`

## Verwendete in Projekten

- `game-server\public\projects\Aufgabenbereich-Karteikasten.json`
- `game-server\public\projects\Karteikasten-Quiz.json`
- `game-server\public\projects\Lernspiel-Geruest.json`
- `game-server\public\projects\Mathe-Insel-Flussbruecke.json`
- `game-server\public\projects\Mathe-Rechenballons.json`
- `game-server\public\projects\Mathe-Rechenpuzzle.json`
- `game-server\public\projects\Mathe-Zaehlen-Turmbau.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `tests\speech_quiz.test.ts`

## Quellen

- `src/components/TSpeechRecognition.ts`
- `docs/schemas/schema_media.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
