# TTextToSpeech

> **Kuratierte Referenzkarte** (Qualitätsvorlage) — `docStatus: technisch geprüft`.
> `manualReview: true` im Inventar; `generate-component-cards.cjs` überschreibt sie nicht (außer mit `--force`).

| Feld | Wert |
|---|---|
| ID | `COMP-0111` |
| Kategorie | media |
| Vererbungskette | `TTextToSpeech` → `TWindow` → `TComponent` (implementiert `IRuntimeComponent`) |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden (indirekt über CMS-/Lernprojekt-Tests; dedizierter TTS-Test nicht belegt) |
| Dokumentationsstatus | technisch geprüft |
| Registrierung | Editor-Registry ✔ · Runtime-Factory ✔ (`'TTextToSpeech'`), Legacy-Alias `TextToSpeech` |
| Schema | `docs/schemas/schema_media.json` |
| Verwendung | 5+ Projekte (Aufgabenbereich-Karteikasten, Karteikasten-Quiz, Lernspiel-Geruest, Mathe-Insel-Flussbruecke …) |
| Umfang | `src/components/TTextToSpeech.ts` — 153 Zeilen |

## Zweck

Deklarativ konfigurierbarer Sprachausgabe-Dienst: **nicht visuell**
(`isService = true`, `isHiddenInRun = true`, Konstruktor Z. 31–32). Die
eigentliche I/O läuft über einen austauschbaren Port `ISpeechAudioAdapter`
(Standard: `CmsSpeechAudioAdapter` → Endpoint `/api/tts` des Servers,
`game-server/src/tts/`).

## Eigene Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `endpoint` | Sprachserver-URL | string | Sprache |
| `text` | Sprechtext | string | Sprache |
| `voice` | Stimmen-ID | string | Sprache |
| `volume` | Lautstärke | number (0–1) | Sprache |
| `active` | Aktiv | boolean | Sprache |

## Ereignisse (eigen)

`onReady` (Audio vorbereitet, Payload `{audioUrl}`), `onPlay`, `onEnded`,
`onStop`, `onError` (Payload `{message}`) — `getEvents()`, Z. 47.
Geerbt: Standardereignisse aus `TComponent`/`TWindow` (durch
`isHiddenInRun` zur Laufzeit deaktiviert — `TWindow.getEvents()` filtert
UI-Events bei versteckten Komponenten).

## Methoden (runtime-relevant)

| Methode | Verhalten (Quelle) |
|---|---|
| `speak(text?)` | Bereitet Audio vor und spielt ab; Fehler brechen den Task **nicht** ab (Z. 94, 125) |
| `prefetch(text?)` | Lädt die nächste Ansage vor; Cache max. 2 Einträge, ältester wird freigegeben (Z. 66–93) |
| `stop(notify?)` | Bricht ab, invalidiert laufende Generation, feuert `onStop` (Z. 142–151) |
| `initRuntime`/`onRuntimeStop` | Lifecycle: bindet `handleEvent`, liest `contextVars.CMS_LAUNCH` (Launch-Key), räumt Requests/Audio ab (Z. 51–63) |

Implementierungsdetails: Generationszähler verhindert, dass veraltete
async-Antworten Events feuern (Z. 99, 107, 114, 118–121); pro Request
`AbortController` mit 60-s-Timeout; `lastError`/`audioUrl` sind als
öffentliche Properties aus Tasks lesbar.

## Verwendung

Aus deklarativen Tasks per `method`-/`call_method`-Action: z. B.
`component: 'Sprachausgabe', method: 'speak', params: […]` — eingesetzt in
den Lernprojekten für gesprochene Aufgaben/Antworten. Serverseitig liefert
der Game-Server über `SpeechRouter`/`PiperEngine` die Audiodaten
(`game-server/src/tts/`).

## Einschränkungen

- Ohne erreichbaren TTS-Endpunkt schlägt `speak()` in `onError` — kein
  Offline-Fallback in der Komponente selbst.
- Prefetch-Cache auf 2 Ansagen begrenzt (bewusste Speicherlogik, Z. 81–85).

## Quellen

- `src/components/TTextToSpeech.ts` (153 Z.)
- `src/adapters/CmsSpeechAudioAdapter.ts`, `src/ports/ISpeechAudioAdapter.ts`
- `game-server/src/tts/` (Piper-Sprachsynthese, SpeechRouter)
- `docs/schemas/schema_media.json`

_Analyse: 2026-10-17 · Commit `53e3dfb` + Arbeitsstand · Devin (Cognition) — SWE-2 High_
