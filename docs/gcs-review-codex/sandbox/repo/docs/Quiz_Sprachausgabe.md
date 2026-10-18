# Sprachausgabe im Karteikasten-Quiz

Die Datei `game-server/public/projects/Karteikasten-Quiz.json` verwendet
`TTextToSpeech` (`SprachAusgabe`) aus der Blueprint-Stage. Die Fragen werden
vorgelesen. Erst danach beginnt die lokale Spracheingabe. Bei falschen Antworten
wird die erste hinterlegte richtige Antwort vorgelesen; alle Antwortvarianten
bleiben wie bisher auf dem Bildschirm sichtbar. Die nächste Karte folgt erst nach
erfolgreicher Buchung, mindestens zwei Sekunden Anzeige **und** Audio-Ende.
Selbstbewertungskarten sprechen die Lösung nach „Antwort zeigen“.

## Start

Alle Komponenten liegen in game-builder-v2. Die Python-Umgebung ist
`game-server/tts/.venv`, Stimmen liegen in `game-server/tts/voices` und
Whisper liegt in `tools/speech-service`. Eine Abhaengigkeit von einem anderen
Game-Builder-Projekt besteht nicht.

Normaler Projektstart (Editor, Game-Server, CMS, Piper und Whisper):

```powershell
npm start
```

Nur den CMS starten:

```powershell
npm run start:cms
# alternativ: node scripts/cms/cms-server.cjs oder Start_CMS.bat
```

Der normale CMS-Start startet die benoetigten lokalen Sprachdienste automatisch.
Er verwendet ausschliesslich die Installation in diesem Projekt. Bereits durch
diesen Projektstart verwaltete Dienste werden anhand ihres lokalen Dienststatus
und einer Bereitschaftspruefung erkannt. Andere Dienste werden nicht beendet;
bei belegtem Sprachdienst-Port wird automatisch ein freier Port verwendet.
Beim regulaeren Beenden werden nur selbst gestartete Dienste gestoppt.
Die vorhandenen Start_Quiz_TTS-Dateien sind Kompatibilitaetsaufrufe fuer denselben
CMS-Start, ohne eigenen Dienststartcode. Ein separates TTS-Skript ist nicht noetig.

Einmalige Einrichtung auf einem neuen Rechner:

```powershell
npm run setup:speech
```

Der Installer erstellt eine eigene virtuelle Umgebung aus dem System-Python,
installiert Piper/FFmpeg und die drei Modelle und richtet bei Bedarf Whisper ein.
Die bestehende Installation in diesem Projekt wurde bereits eingerichtet und
mit Python 3.14 geprueft. Fuer den laufenden Betrieb erfolgen keine Downloads.

CMS und Editor verwenden getrennte Audio-Caches: `game-server/data/tts-cache`
fuer den CMS und `game-server/data/tts-editor-cache` fuer den Editor. So schreiben
nicht zwei Prozesse in denselben Cache. Der gemeinsame Projektstart uebergibt
den Diensten die automatisch ermittelten lokalen Sprach-Endpunkte.

Im Editor die Quizdatei neu von der Platte laden; ein alter offener Stand darf die
Änderung nicht per AutoSave überschreiben. Im CMS das Spiel schließen und neu
starten. Browser-Audioregeln gelten weiter; falls Wiedergabe gesperrt ist, bleibt
die Textaufgabe sichtbar und bedienbar.

## GCS und CMS

Die Abläufe sind normale Tasks/Actions im Quiz-JSON. `cms-quiz-tts.cjs` erweitert
auch den bestehenden Quizgenerator idempotent; erneut erzeugte Quizdateien behalten
die Sprachintegration. Ein Originalbackup liegt neben der Quizdatei als
`Karteikasten-Quiz.json.before-tts.bak`.

Der `CmsSpeechAudioAdapter` sendet Texte per `postMessage` an `CmsTtsHost` im
vertrauenswürdigen Spielhost. Dort ruft der Host `/api/cms/tts` auf. Der Server
prüft Origin, Launch-Key, laufende eigene Spielsitzung und Spielberechtigung.
Audio wird nach der Prüfung über die Bridge als MP3 übertragen und im Spielframe
als kurzlebige Blob-URL abgespielt. Die bestehenden Sandbox-/CSP- und
Mikrofonfreigabegrenzen werden nicht geöffnet. Blob-URLs werden beim Abbruch,
Runtime-Ende und Verwerfen vorgeladener Ansagen freigegeben.

Der gemeinsame Piper-/MP3-Cache-Kern befindet sich für den CMS-Betrieb in
`scripts/cms/tts/*.cjs`. Die entsprechenden TypeScript-Module unter
`game-server/src/tts` bieten außerdem die normale Editor-API `/api/tts`.
Nach Änderungen am gemeinsamen Kern beide Varianten konsistent halten.
Der Cache liegt in `game-server/data/tts-cache`, Standardlimit 5 GiB;
`TTS_CACHE_MAX_BYTES` ist konfigurierbar. Kein Cloud-Fallback und kein LLM.
Ein Serverprozess pro Cache-Verzeichnis; bei getrenntem Editor-/CMS-Betrieb
separate Cache-Verzeichnisse verwenden. Der normale Editor-Endpunkt benötigt
`TTS_PIPER_URL`, der CMS-Endpunkt verwendet `CMS_TTS_URL`.

## Prüfung

`npm run test:fast` aktualisiert den QA-Bericht ohne Dienststarts.
Die Sprachtests prüfen den echten Task-/Timer-Ablauf mit simulierter Wiedergabe,
Mikrofonstart nach Audio-Ende, Fehlerfallback, Buchungsablauf und CMS-Zugriff.
TypeScript-Prüfungen erfolgen ohne Build. Für den Player ist das aktualisierte
Standalone-Runtime-Bundle erforderlich. Whisper wurde mit einer synthetischen deutschen Testaufnahme geprüft: „Die richtige Antwort ist 56.“ wurde in etwa 2,4 Sekunden erkannt. Ein Mikrofontest im laufenden Spiel steht noch aus.

## Mikrofon-Pegel im laufenden Spiel

Der Mikrofonbereich des Spielhosts zeigt während der tatsächlichen Aufnahme einen Eingangspegel. „Ton kommt an“ bestätigt gemessene Audiodaten, unabhängig davon, ob Whisper die Antwort erkennt. „Mikrofon freigegeben“ bedeutet nur, dass die Aufnahme erlaubt ist. Nach der Aufnahme bleiben Tonankunft, fehlende Audiodaten oder zu leiser/kurzer Ton sichtbar. Erkennungsergebnis und Dienstfehler werden nicht mehr sofort durch „Mikrofon bereit“ ersetzt.

Nach dem Update die CMS-Seite mit Strg+F5 neu laden und das Spiel neu starten. Die Anzeige nimmt nur während der vorhandenen Spielaufnahme Ton auf. Geprüft mit simulierten Audiodaten im Browser (Pegel, Ende, Text und Fehlermeldung) sowie den Aufnahme- und Regressionstests; die Ursache eines weiterhin ausbleibenden Ergebnisses am echten Mikrofon muss anhand dieser Anzeige eingegrenzt werden.
Laufzeitkorrektur: Native AbortController bleiben wie AbortSignal und Audioelemente außerhalb der GCS-Proxies. Dadurch funktioniert TTextToSpeech.stop beim Bewerten, Tastaturwechsel und Beenden ohne Illegal invocation. Der Fehler wurde im echten Browser reproduziert und nach der Korrektur mit demselben Aufruf geprüft; ein dauerhafter Regressionstest deckt das Abbrechen des Requests ab.


## Stimmenauswahl und SuperAdmin-Audioübersicht

Im Spielhost befindet sich oben links die aufklappbare Stimmenauswahl mit Hörprobe.
Thorsten, Kerstin und Ramona sind als lokale Piper-Modelle vorgesehen. Die Wahl wird
über den CMS-Store im Personenprofil als ttsVoice gespeichert und gilt ab der
nächsten Ansage. Eine laufende Ansage wird dadurch nicht unterbrochen. Falls eine
Stimme ausfällt oder gesperrt wird, wird die freigegebene Standardstimme verwendet.
Die Hörprobe verwendet einen festen kurzen Beispieltext.

SuperAdmins öffnen „Stimmen & Audio-Cache“ auf der Super-Administrationsseite
oder /super/audio. Die gewählte SuperAdmin-Rolle und eine aktive Admin-Sitzung
sind für Seite und jede API-Aktion erforderlich. Dort gibt es Textsuche,
Stimmenfilter, nach Stimme/Text geordnete Seiten mit je 100 Dateien, Wiedergabe,
Speicherverbrauch pro Stimme, Freigaben und Standardstimme sowie Neuerzeugung.
Die Vorbereitung erzeugt höchstens 100 unterschiedliche bekannte Frage-/Lösungstexte
pro freigegebener Stimme, seriell und mit Fortschritt/Abbruch. Sie endet bei
Verlust der Admin-Berechtigung. Der zuletzt laufende Auftrag wird noch fertiggestellt.

Neben jeder MP3 wird eine JSON-Metadatendatei mit Text, Stimme, Engine und
Erfassungsdatum atomar gespeichert. Unbekannte Altdateien bleiben sichtbar und
abspielbar. Beim ersten Öffnen und über „Alte Audios zuordnen“ werden bekannte
Karteikastenfragen sowie die beiden Lösungsansagen gegen alte Hashes abgeglichen.
Es werden keine Audios für diesen Abgleich erzeugt. Ein Cachetreffer ergänzt die
Metadaten ebenfalls. Die Cacheidentität enthält das einzelne Modell, sodass das
Hinzufügen einer weiteren Stimme vorhandene Audios nicht entwertet.

Die zusätzlichen Modelle stammen aus rhasspy/piper-voices:
https://huggingface.co/rhasspy/piper-voices/tree/main/de/de_DE/kerstin/low
https://huggingface.co/rhasspy/piper-voices/tree/main/de/de_DE/ramona/low
Modelkarten liegen zusammen mit den Modellen im lokalen Stimmenordner.
Die Stimmeigenschaften beurteilt man anhand der Hörproben; „low“ bezeichnet die
Modellqualitätsstufe, keine zugesicherte emotionale Eigenschaft.

Der normale CMS-Start verwaltet die Sprachdienste automatisch; siehe Abschnitt Start.

### Verifikation der Erweiterung

28 Sprach-, Transport- und Quizablauftests erfolgreich:

```powershell
node --import tsx --test tests/quiz_tts_transport.test.ts tests/quiz_tts_voices.test.ts tests/speech_quiz.test.ts tests/speech_quiz_flow.test.ts tests/speech_transport.test.ts
node scripts/test-quiz-tts-ui.cjs
```

Der Browsertest prüft Suche, Gruppierung, Wiedergabe, Speichern der Standardstimme,
Profilwahl, Hörprobe und Schließen im vollständigen Spielhost anhand temporärer
Testdaten. Er startet weder den Produktions-CMS noch eine Mikrofonaufnahme.
TypeScript-Prüfungen für Client und Game-Server sind erfolgreich.
Die echte lokale Synthese wurde mit allen drei Modellen geprüft.
Alle 47 vorher vorhandenen MP3s wurden den bekannten Texten zugeordnet;
zusätzlich wurden drei Hörproben erzeugt (50 Audios mit Metadaten).
Der dafür gestartete Piper-Testdienst wurde wieder beendet.

### Verifikation des konsolidierten Starts

Drei zusätzliche Tests prüfen Portkonflikte, Wiederverwendung eigener Dienste und
Aufräumen bei einem abgebrochenen Start:

```powershell
node --import tsx --test tests/cms_local_services.test.ts
node scripts/test-start-local.cjs
```

Der gemeinsame Start wurde mit isolierten CMS-Testdaten und freien Testports
geprüft: Editor, Game-Server und CMS waren erreichbar; beim Beenden wurden alle
eigenen Server sowie Piper und Whisper beendet. Bereits laufende fremde Dienste
blieben bestehen. Der normale CMS-Start wurde zusätzlich mit echter Synthese für
alle drei Stimmen und echter Whisper-Erkennung geprüft. Die Sprachkomponenten
verwenden ausschließlich die lokale Installation in game-builder-v2.
