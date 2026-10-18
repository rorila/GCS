# Karteikasten-Quiz — Spielbeschreibung

Quelle: `game-server/public/projects/Karteikasten-Quiz.json` (Stage `stage_quiz`, Typ `standard`)

Das Spiel ist ein **persönlicher Lernkarten-Loop** (Leitner-Prinzip): Das Kind bekommt aus seinem Karteikasten die nächste Karte, die Frage wird per Sprachausgabe (TTS) vorgelesen, die Antwort kommt per **Spracheingabe** (lokale Whisper-Erkennung) oder **Tastatur**. Der Server bewertet den Lernstand: richtige Antworten wandern ein Fach weiter (Fach 5 → Ablage 6), falsche kommen **hinten in Fach 1** zurück.

## Startvoraussetzungen (Schritte bis zum Spielstart)

1. **CMS-Server läuft** (`npm run start:cms`) — verwaltet Piper (TTS) und Whisper (Erkennung) selbst.
2. **Spiel wird über den CMS-Spielhost gestartet** — entweder produktiv über `/play/<launchKey>` oder im Editor über den **CMS-Testkontext** (`/api/cms/editor-test/page/<key>`). Dabei wird die Variable **`CMS_LAUNCH`** mit dem 48-stelligen Sitzungsschlüssel befüllt; ohne ihn antwortet der Server nicht.
3. Im Spiel sichtbar: Titel, Fach-/Zählerzeile, Statuszeile („Klicke auf Start und gib das Mikrofon frei."), Buttons **Start**, **Tastatur verwenden**, **Beenden**.
4. **Klick auf Start** → `Quiz_Start`: Spracheingabe wird vorbereitet (`prepare` mit `CMS_LAUNCH`), der Spielhost blendet unten links das **Mikrofon-Panel** ein → dort „Mikrofon freigeben" + Browser-Berechtigung bestätigen.
5. `onReady` der Spracheingabe → `Sprache_Bereit` → erste Karte wird gezogen (`cardNext`), Frage erscheint und wird **vorgelesen**, danach startet automatisch die Aufnahme.
6. Alternativ **„Tastatur verwenden"** — jederzeit umstellbar, funktioniert ohne Mikrofon und ohne Whisper.

## Phasenmodell (Variable `Phase`)

```
idle → preparing → next → loading → reading → answering → saving|feedback → next …
                                  ↘ load-error        ↘ speech-error / save-error
                                              → ended / complete
```

| Phase | Bedeutung |
|---|---|
| `idle` | Startbildschirm |
| `preparing` | Mikrofon-Freigabe läuft im Host |
| `next` | bereit, nächste Karte anzufordern |
| `loading` | `cardNext`-Anfrage läuft |
| `reading` | Frage wird per TTS vorgelesen |
| `answering` | Aufnahme/Tastatureingabe aktiv |
| `saving` | „Richtig" wird gebucht (kein Lösungsbild) |
| `feedback` | falsche Antwort: Lösung sichtbar + angesagt, LoesungsTimer läuft |
| `load-error` / `speech-error` / `save-error` | Fehlerzustände mit Wiederhol- bzw. Abbruchpfad |
| `ended` / `complete` | Sitzung beendet bzw. alle Karten der Runde richtig |

## Objekte (Bühne)

| Objekt | Klasse | Zweck | Anfangszustand |
|---|---|---|---|
| `Titel` | TLabel | „KARTEIKASTEN-QUIZ" | sichtbar |
| `FachLabel` | TLabel | „Fach · Thema · Fach n" der Karte | sichtbar, leer |
| `ZaehlerLabel` | TLabel | „Richtig: n · Falsch: n" | sichtbar |
| `FrageLabel` | TLabel | Fragetext | sichtbar, leer |
| `LoesungLabel` | TLabel | richtige Antwort | sichtbar, leer |
| `SpielerAntwortLabel` | TLabel | „Deine letzte Antwort: …" | sichtbar, leer |
| `SprachStatus` | TLabel | TTS-Fehlerhinweis | sichtbar, leer |
| `StatusLabel` | TLabel | Status-/Rückmeldungstext | sichtbar |
| `AntwortEdit` | TEdit | Tastatureingabe (maxLength 100) | unsichtbar |
| `AntwortZeigen` | TButton | Lösung aufdecken (Selbstbewertung) | unsichtbar |
| `Pruefen` | TButton | Tastaturantwort prüfen | unsichtbar |
| `RichtigSelbst` / `FalschSelbst` | TButton | Selbstbewertung 👍/👎 | unsichtbar |
| `Naechste` | TButton | „Erneut laden" bei Ladefehler | unsichtbar |
| `Wiederholen` | TButton | „Noch einmal sprechen" | unsichtbar |
| `Tastatur` | TButton | auf Tastaturmodus wechseln | sichtbar |
| `Start` | TButton | Spielstart | sichtbar |
| `Beenden` | TButton | Sitzung beenden | sichtbar |
| `QuizInit` | TTimer | 400 ms, maxInterval 1 — `enabled: false`, aktuell ungenutzt | deaktiviert |
| `LoesungsTimer` | TTimer | 2 000 ms, maxInterval 1 — Mindestanzeige der Lösung | deaktiviert |
| `Spracheingabe` | TSpeechRecognition | Sprachaufnahme: `language: de-DE`, `maxDurationMs: 12000`, `silenceMs: 1000`, `prompt: "Mögliche Antworten sind Zahlen: …"` | Dienst |
| `SprachAusgabe` (Blueprint-Stage, global) | TTextToSpeech | TTS über `/api/tts`, `voice: default` | Dienst |

## Variablen

| Variable | Typ | Anfang | Zweck |
|---|---|---|---|
| `CMS_LAUNCH` | string | "" | Sitzungsschlüssel — wird vom Spielhost injiziert |
| `KartenFach` | string | `"Mathe"` | Fachfilter für `cardNext` (subject) |
| `KartenThema` | string | "" | Themenfilter (topic) |
| `GezogeneIds` | string | "" | kommagetrennte Liste — verhindert Wiederholungen in der Runde (`excludeIds`) |
| `AktuelleKarte` | object | null | Kartenobjekt des Servers (`id`, `question`, `answers[]`, `answerFormat`, `box`, …) |
| `KartenAntwort` | object | null | Ergebnis von `cardNext` |
| `BewertungAntwort` | object | null | Ergebnis von `cardAnswer` |
| `EndeAntwort` | object | null | Ergebnis von `end` |
| `Richtig` / `Falsch` | integer | 0 | Rundenzähler |
| `Busy` | integer | 0 | Sperrflag während Serveranfragen |
| `AktuelleAntwort` | string | "" | zuletzt eingegebene/erkannte Antwort |
| `AntwortPruefung` | object | null | `{valid, correct, solution}` aus `checkNumberAnswer` |
| `Phase` | string | `"idle"` | Zustandsmaschine (s. o.) |
| `EingabeModus` | string | `"speech"` | `speech` oder `keyboard` |
| `AnsageArt` | string | "" | `question` / `solution` / `self` — steuert, was `Ansage_Ende` als Nächstes tut |
| `FeedbackFertig` | boolean | false | LoesungsTimer (≥ 2 s) abgelaufen |
| `SprachFeedbackFertig` | boolean | true | TTS-Ansage der Lösung zu Ende |
| `BuchungFertig` | boolean | false | `cardAnswer` erfolgreich gebucht |

## Interaktionen (Objekt → Event → Task → Actions)

### 1. Spielstart

**Start** (TButton) → `onClick` → **Quiz_Start** *(Bedingung: Phase in `idle`, `speech-error`)*

| # | Action | Typ | Konfiguration |
|---|---|---|---|
| 1 | `Act_Start_Sprache` | property | `Phase="preparing"`, `EingabeModus="speech"`, `Start.visible=false`, `StatusLabel="Mikrofon im Spielhost freigeben."` |
| 2 | `Act_Sprache_Vorbereiten` | call_method | `Spracheingabe.prepare("${CMS_LAUNCH}")` — öffnet im Host das Mikrofon-Panel |

→ Erfolg: `Spracheingabe.onReady` → **Sprache_Bereit** *(Phase == `preparing`)*:
- `AktuelleKarte` vorhanden → `Act_Sprache_Fortsetzen` (`Phase="answering"`) → Task `Eingabe_Bereit`
- sonst → `Act_Naechste_Bereit` (`Phase="next"`, `Busy=0`) → Task `Karte_Ziehen`

→ Fehler: `Spracheingabe.onError` → **Sprachfehler** *(Phase in `preparing`, `answering`)* → `Act_Sprachfehler`: `Phase="speech-error"`, Fehlermeldung ins StatusLabel, `Start.visible=true` (Neustart möglich)

### 2. Tastatur-Modus wählen

**Tastatur** (TButton) → `onClick` → **Tastatur_Waehlen** *(Phase in `idle`, `preparing`, `answering`, `speech-error`, `reading`)*

| # | Action | Konfiguration |
|---|---|---|
| 1 | `Act_Ansage_Stop` | `SprachAusgabe.stop()` |
| 2 | `Act_Sprache_Abbrechen` | `Spracheingabe.cancel()` |
| 3 | `Act_Tastatur_Waehlen` | `EingabeModus="keyboard"`, `Start.visible=false` |
| 4 | Karte vorhanden → `Act_Tastatur_Fortsetzen` (`Phase="answering"`) → `Eingabe_Bereit`; sonst → `Act_Naechste_Bereit` → `Karte_Ziehen` |

### 3. Karte ziehen (interner Task, kein direkter Klick)

**Karte_Ziehen** *(Phase == `next`)*

| # | Action | Typ | Konfiguration |
|---|---|---|---|
| 1 | `Act_Ansage_Stop` / `Act_Sprache_Abbrechen` | call_method | laufende Ansage/Aufnahme beenden |
| 2 | `Act_Ziehen_Start` | property | alle Eingabe-Buttons ausblenden, `Phase="loading"`, `Busy=1`, `StatusLabel="Aufgabe wird geladen."`, Lösung/Antwort leeren, `LoesungsTimer.enabled=false` |
| 3 | `Act_Karte_Server` | http | `POST /api/cms/play` — `{"launchKey","action":"cardNext","subject":${KartenFach},"topic":${KartenThema},"formats":["text","self"],"excludeIds":${GezogeneIds}}` → `KartenAntwort` |
| 4a | Karte da (`KartenAntwort.ok` ∧ `.card` truthy) | | `Act_Karte_Objekt` (`KartenAntwort.card` → `AktuelleKarte`), `Act_Karte_Uebernehmen` (`FrageLabel=question`, `FachLabel="subject · topic · Fach n"`, `Busy=0`, `Phase="answering"`) → Task `Eingabe_Bereit` |
| 4b | Stapel leer | | `Act_QuizEnde` (`Phase="complete"`, „Fertig!…") → Task `Quiz_Beenden` |
| 4c | Serverfehler | | `Act_ZiehFehler` (`Phase="load-error"`, `Busy=0`, Fehlermeldung, `Naechste.visible=true`) |

### 4. Frage vorlesen und Eingabe bereitstellen

**Eingabe_Bereit** *(Phase == `answering`)*

| # | Action | Konfiguration |
|---|---|---|
| 1 | `Act_Ansage_Stop` / `Act_Sprache_Abbrechen` | Sicherheitsreset |
| 2 | `Act_Frage_Vorlesen` | `Phase="reading"`, `AnsageArt="question"`, `StatusLabel="Die Frage wird vorgelesen."`, Eingabe-UI aus |
| 3 | `Act_Frage_Sprechen` | `SprachAusgabe.speak("${AktuelleKarte.question}")` |

→ `SprachAusgabe.onEnded` → **Ansage_Ende**: `AnsageArt="question"` ∧ `Phase="reading"` → `Act_Frage_Gelesen` (`Phase="answering"`, `AnsageArt=""`) → Task `AntwortEingabe_Bereit`.
→ `SprachAusgabe.onError` → **Ansage_Fehler** → `Act_Ansage_Fehler` („Bitte den Text lesen.") → trotzdem `Ansage_Ende`.

**AntwortEingabe_Bereit** (keine Phasenbedingung)

| # | Action | Konfiguration |
|---|---|---|
| 1 | `Act_Eingabe_Zuruecksetzen` | alle Buttons aus, `StatusLabel`/`AntwortEdit` leeren |
| 2a | `AktuelleKarte.answerFormat == "self"` | `Act_SelfBereit`: `AntwortZeigen` + `AntwortEdit` sichtbar, „…Lösung aufdecken und selbst bewerten." |
| 2b | `EingabeModus == "speech"` | `Act_Sprechbereit` („Bitte antworte laut.") + `Act_Sprache_Hoeren` → `Spracheingabe.start()` — Aufnahme bis zu 12 s, endet nach 1 s Sprechpause |
| 2c | sonst (Tastatur) | `Act_TextBereit`: `AntwortEdit` + `Pruefen` sichtbar |

### 5. Sprachantwort auswerten

**Spracheingabe** → `onResult` → **Sprachantwort_Pruefen** *(Phase == `answering`)*

- `EingabeModus == "speech"` → `Act_Sprachantwort` (`Spracheingabe.transcript` → `AktuelleAntwort`) → Task `Antwort_Auswerten`

**Spracheingabe** → `onNoSpeech` → **Antwort_Unverstanden** *(answering)*: `Act_Unverstanden` („Keine eindeutige Zahl verstanden…") + im Sprachmodus `Act_Wiederholen_Sichtbar` (`Wiederholen.visible=true`)

**Wiederholen** (TButton) → `onClick` → **Sprache_Wiederholen** *(answering ∧ speech)* → `Act_Erneut_Hoeren` + `Act_Sprache_Hoeren` (neue Aufnahme)

### 6. Tastaturantwort prüfen

**Pruefen** (TButton) → `onClick` → **Antwort_Pruefen** *(answering)* → `Act_Texteingabe` (`AntwortEdit.text` → `AktuelleAntwort`) → Task `Antwort_Auswerten`

### 7. Antwort auswerten (gemeinsamer Kern)

**Antwort_Auswerten** *(answering)*

| # | Action | Konfiguration |
|---|---|---|
| 1 | `Act_Antwort_Anzeigen` | `SpielerAntwortLabel="Deine letzte Antwort: ${AktuelleAntwort}"` |
| 2 | `Act_Zahlantwort_Pruefen` | `calculate`: `checkNumberAnswer(AktuelleAntwort, AktuelleKarte.value.answers)` → `AntwortPruefung` — Zahlwort-/Ziffer-Normalisierung inkl. Verhörer-Tabelle |
| 3 | `AntwortPruefung.valid` | falsch → `Antwort_Unverstanden`; `correct` → `Bewerten_Richtig`, sonst `Bewerten_Falsch` |

### 8. Selbstbewertung (Karten mit `answerFormat: "self"`)

**AntwortZeigen** (TButton) → `onClick` → **Antwort_Zeigen** *(answering)*

| # | Action | Konfiguration |
|---|---|---|
| 1 | `Act_Texteingabe` | `AntwortEdit.text` → `AktuelleAntwort` |
| 2 | `Act_Antwort_Anzeigen` | eigene Antwort anzeigen |
| 3 | `Act_Loesung_Anzeigen` | `LoesungLabel="${AktuelleKarte.answers}"`, `RichtigSelbst` + `FalschSelbst` sichtbar, `AntwortZeigen` aus |
| 4 | `Act_SelbstLoesung_Vorlesen` | `AnsageArt="self"` |
| 5 | `Act_SelbstLoesung_Sprechen` | `speak("Die Antwort ist ${AktuelleKarte.answers.0}.")` |

**RichtigSelbst** → `onClick` → **Selbst_Richtig** → Task `Bewerten_Richtig`
**FalschSelbst** → `onClick` → **Selbst_Falsch** → Task `Bewerten_Falsch`

### 9. Richtig bewerten

**Bewerten_Richtig** *(answering)*

| # | Action | Konfiguration |
|---|---|---|
| 1 | `Act_Ansage_Stop`, `Act_Sprache_Abbrechen` | Ausgabe/Aufnahme beenden |
| 2 | `Act_BewertenR_Start` | UI aus, `Phase="saving"`, `Busy=1`, „Richtig. Lernstand wird gespeichert." |
| 3 | `Act_BewertungR_Server` | http `POST /api/cms/play` — `{"action":"cardAnswer","cardId":${AktuelleKarte.id},"correct":true}` → `BewertungAntwort` (Leitner +1, Fach 5 → Ablage) |
| 4 | ok → `Act_Richtig_Plus` (`Richtig = Richtig + 1`), `Act_BewertetR` (`GezogeneIds += Kartenid`, Zähler aktualisieren), `Act_Naechste_Bereit` → `Karte_Ziehen`; Fehler → `Buchungsfehler` |

### 10. Falsch bewerten

**Bewerten_Falsch** *(answering)*

| # | Action | Konfiguration |
|---|---|---|
| 1 | `Act_Ansage_Stop`, `Act_Sprache_Abbrechen` | |
| 2 | `Act_BewertenF_Start` | UI aus, `Phase="feedback"`, `FeedbackFertig=false`, `BuchungFertig=false`, `LoesungLabel="Richtige Antwort: …"`, „Die Karte kommt hinten in Fach 1.", `LoesungsTimer` startet (2 s, einmalig) |
| 3 | `Act_Loesung_Vorlesen` + `Act_Loesung_Sprechen` | `AnsageArt="solution"`, `SprachFeedbackFertig=false`, `speak("Die richtige Antwort ist …")` |
| 4 | `Act_BewertungF_Server` | http `cardAnswer` mit `correct:false` |
| 5 | `Phase=="feedback"` ∧ `BewertungAntwort.ok` → `Act_Falsch_Plus`, `Act_BewertetF` (`BuchungFertig=true`, Zähler) → `Weiter_Nach_Feedback`; Fehler → `Buchungsfehler` |

### 11. Mindestanzeige der falschen Lösung

**LoesungsTimer** (TTimer, 2 000 ms, einmalig) → `onTimer` → **Loesungszeit_Vorbei** *(Phase == `feedback`)* → `Act_Feedback_Ende` (`FeedbackFertig=true`, Timer aus) → `Weiter_Nach_Feedback`

**Weiter_Nach_Feedback** — wartet, bis **alle drei** Bedingungen erfüllt sind: `SprachFeedbackFertig` (Ansage zu Ende, `AnsageArt="solution"` → `Act_Loesung_Gelesen` setzt es), `Phase=="feedback"`, `FeedbackFertig` (≥ 2 s), `BuchungFertig` → dann `Act_Naechste_Bereit` + `Karte_Ziehen`. Damit bleibt die falsche Lösung **mindestens zwei Sekunden sichtbar und bis zum Ende der Ansage**.

### 12. Ladefehler wiederholen

**Naechste** (TButton „Erneut laden") → `onClick` → **Laden_Wiederholen** *(Phase == `load-error`)* → `Act_Naechste_Bereit` → `Karte_Ziehen`

### 13. Buchungsfehler

**Buchungsfehler** (intern) → `Act_Buchungsfehler`: `Phase="save-error"`, Timer aus, „Lernstand konnte nicht sicher gespeichert werden…" — bewusster Stopp statt falscher Lernstände.

### 14. Spiel beenden

**Beenden** (TButton) → `onClick` → **Quiz_Beenden** *(Phase != `ended`)*

| # | Action | Konfiguration |
|---|---|---|
| 1 | `Act_Ansage_Stop`, `Act_Quiz_Stop` (UI aus, `Phase="ended"`, `Busy=1`, Endstand ins StatusLabel), `Act_Sprache_Abbrechen` | |
| 2 | `Act_Sitzung_Ende` | http `POST /api/cms/play` — `{"action":"end"}` → `EndeAntwort` (Zeitbuchung abschließen) |
| 3 | `EndeAntwort.ok != true` → `Act_Ende_Fehler` („Sitzungsende nicht bestätigt…") | |

## Serveranbindung (durch die Host-Bridge)

Alle HTTP-Aktionen laufen über `POST /api/cms/play` mit `launchKey=${CMS_LAUNCH}`:

| action | Zweck |
|---|---|
| `cardNext` | nächste fällige Karte (subject/topic-Filter, `formats:["text","self"]`, `excludeIds`) |
| `cardAnswer` | Leitner-Buchung `correct:true` (+1 Fach) / `correct:false` (hinten in Fach 1) |
| `end` | Spielsitzung beenden, Zeitbuchung abschließen |

Sprache: `Spracheingabe` (Aufnahme → Whisper via `/api/cms/speech`, Header `X-Speech-Prompt` trägt den Erkennungshinweis) und `SprachAusgabe` (Piper via TTS-Host) laufen über `gcs-speech`-/`gcs-tts`-Nachrichten an den Spielhost — die Sandbox selbst hat kein Netzwerk.

## Feature-Hinweis

Die Stage trägt das Feature `quiz-karteikasten` mit den Blueprint-Tasks `Quiz_Start`, `Karte_Ziehen`, `Antwort_Pruefen`, `Bewerten_Richtig`, `Bewerten_Falsch` — als Overlay-/Kopiervorlage für andere Spiele gedacht (`KartenFach`/`KartenThema` leer = alle Karten).
