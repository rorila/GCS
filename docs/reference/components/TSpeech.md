# TSpeech

> Generierte Referenzkarte — Quelle: `src/components/TSpeech.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0092` |
| Kategorie | media |
| Basisklasse | TWindow |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TSpeech` |
| Legacy-Typnamen (typeMapping) | Speech |
| Schema-Datei | docs/schemas/schema_media.json |
| Verwendung in Projekten | 1 |
| Server-Methoden | — |
| Umfang | 160 Zeilen |

## Beschreibung

TSpeech — Sprachausgabe über die Web Speech API (speechSynthesis). Service-Komponente: kein sichtbares Element, steuerbar über call_method. Funktioniert auf Desktop und Tablet; die erste Ausgabe muss aus einer Nutzeraktion (Tap/Klick) kommen — Browser-Autoplay-Policy.

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `text` | Text | string | Sprache |
| `lang` | Sprache (BCP-47) | string | Sprache |
| `voice` | Stimme (Name) | string | Sprache |
| `rate` | Sprechtempo (0.1–10) | number | Sprache |
| `pitch` | Tonhöhe (0–2) | number | Sprache |
| `volume` | Lautstärke (0–1) | number | Sprache |
| `speaking` | Spricht gerade | boolean | Status |
| `paused` | Pausiert | boolean | Status |
| `lastError` | Letzter Fehler | string | Status |

## Ereignisse

`onStart`, `onEnd`, `onError`, `onPause`, `onResume`

## Öffentliche Methoden

`getInspectorProperties`, `getEvents`, `toDTO`, `initRuntime`, `onRuntimeStart`, `onRuntimeStop`, `speak`, `stop`, `pause`, `resume`, `getVoices`

## Verwendete in Projekten

- `game-server\public\projects\PingPong.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `tests\speech_quiz.test.ts`

## Quellen

- `src/components/TSpeech.ts`
- `docs/schemas/schema_media.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
