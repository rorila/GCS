# Lernspiel-Gerüst: eine Spielwelt, zwei Einstiege

## Öffnen und bearbeiten

Projektdatei: `game-server/public/projects/Lernspiel-Geruest.json`.

Das Projekt besitzt vier Stages:

| Stage | Verwendung |
|---|---|
| Blueprint · Aufgabenbereich | Gemeinsame Variablendefinitionen des vorhandenen Aufgabenbereichs |
| Spielhülle · hier starten | Startpunkt für die Auswahl „Lernen & Spielen“ oder „Frei spielen“ |
| Aufgabenbereich · eingebettet | Vorhandene Papierkarten, Stapelfilter, Lernfachfilter, Vorlesen und Eingabe |
| Spielwelt · hier dein Spiel bauen | Deine normale, vollständige Spielwelt-Stage |

**Dein Spiel baust du in der letzten Stage.** Ihre Zellgröße, Koordinaten und Objektgrößen bleiben unverändert. Es gibt genau eine Definition der Spielwelt. Die Spielhülle verwendet sie in beiden Modi.

Im Editor die Stage auswählen und die üblichen Objekte, Tasks und Actions bearbeiten. Zum Starten des gesamten Projekts „Spielhülle · hier starten“ wählen, den Run-Modus öffnen und über **CMS-Testkontext → Test starten** starten. Der lokale CMS-Server muss laufen. Der vorhandene Editor-Testkontext verwendet synthetische Testpersonen und Karten; echte Lernstände werden nicht verändert. Alternativ das ZIP regulär im CMS hochladen und als Testspiel freigeben.

## Wie die Teile zusammenspielen

Die Spielhülle zeigt links den Aufgabenbereich und rechts dieselbe Spielwelt. Beide haben eine eigene Runtime und ein eigenes Dokument. So teilen sie weder Koordinaten noch globale Spielvariablen, Timer oder Tastatureingaben. Jede Ansicht passt ihre vollständige Stage proportional in ihre Fläche ein. Freie Ränder sind möglich; die Zellgröße der Projektdatei wird nicht verändert.

Auf schmalen Bildschirmen gibt es Reiter „Aufgaben“ und „Spielwelt“. Beide Ansichten bleiben dabei aufgebaut. Nach einer richtigen Antwort wechselt die Anzeige zur Spielwelt, nach dem Einbauen zurück zur Aufgabe.

Die Verbindung nutzt ausschließlich die Stage-Schnittstelle:

1. Der Aufgabenbereich prüft und bucht die Antwort auf dem CMS-Server.
2. Sein Ausgang `LernEvent` übergibt das bestätigte Antwort-Event an die Spielhülle.
3. Diese liefert `AntwortRichtig`, `AntwortFalsch` oder `AntwortNichtVerstanden` an die Spielwelt.
4. Bei `AntwortRichtig` wartet der Aufgabenbereich. Die Spielwelt gibt ein Bauteil frei.
5. Nach erfolgreichem Einbauen sendet die Spielwelt `SpielweltBereit` mit der ursprünglichen Event-Kennung als `correlationId`.
6. Der Aufgabenbereich bestätigt genau dieses ausstehende Server-Event und zieht die nächste Karte.

Falsche Antworten und nicht verstandene Eingaben erzeugen keine Baufreigabe. Die Fehlerlösung und das Vorlesen bleiben Aufgabe des Aufgabenbereichs.

## Kleines Hausbau-Beispiel

Drei Bauteile – Fundament, Wände und Dach – zeigen den Ablauf. Dies ist eine Funktionsvorlage und kein fertig gestaltetes Hausbau-Spiel.

- **Frei spielen:** Alle noch nicht eingebauten Teile lassen sich direkt ziehen.
- **Lernen & Spielen:** Eine richtige Antwort erteilt genau eine Baufreigabe. Ein beliebiges verbleibendes Teil kann auf seine passende Fläche gezogen werden.
- Falsche Ablage oder Abbruch setzt das Teil zurück; die Freigabe bleibt erhalten.
- Erfolgreiche Ablage verbraucht die Freigabe. Weitere Teile sind wieder gesperrt, bis eine neue richtige Antwort vorliegt.
- Nach dem dritten Teil meldet die Welt `ZielErreicht`; die Spielhülle beendet die Lernrunde regulär.

Die zentralen Welt-Variablen:

| Name | Bedeutung |
|---|---|
| `LearningMode` | Wird von der Spielhülle gesetzt. Frei: false; mit Aufgaben: true |
| `Credits` | Aktuell verfügbare Baufreigabe |
| `CanBuild` | Darf ein weiteres Teil bewegt werden? |
| `PendingLearningEvent` | Eingangskennung für die spätere Fertigmeldung |
| `BuiltCount` | Bereits eingebaute Teile |
| `Built0` bis `Built2` | Zustand der drei Beispielteile |

Für dein eigenes Spiel ersetzt du die Beispielobjekte und die Tasks `Part_Drop0` bis `Part_Drop2`. Die zentrale Freigabe bleibt erhalten: freie Nutzung bei `LearningMode=false`, sonst nur mit verdienter Freigabe. Belohnung und Rückmeldung sind kein zweites Spiel, sondern eine zusätzliche Steuerung derselben Spielmechanik.

Neue öffentliche Eingänge und Ausgänge lassen sich über **Stage → Eigenschaften → Externe Schnittstelle** konfigurieren. Erklärung: `docs/Stage-Schnittstellen.md`.

## Pakete und Start im echten CMS

- Editierbares Projekt: `game-server/public/projects/Lernspiel-Geruest.json`
- ZIP mit benötigten Assets: `artifacts/learning-shell/Lernspiel-Geruest.zip`
- Einzeldatei mit eingebetteten Bildern: `artifacts/learning-shell/Lernspiel-Geruest-portable.json`

Im SuperAdmin-Bereich das ZIP als Spiel hochladen. Veröffentlichen und Haus-/Raumfreigaben erfolgen wie bei anderen Lernspielen. Der Lernmodus verwendet den persönlichen Karteikasten des angemeldeten Kindes oder Erwachsenen. Beim freien Einstieg werden keine Karten beantwortet und keine Lernpunkte gebucht.

Nach dieser Engine-Erweiterung CMS-Server neu starten und Editor/Browser neu laden. Es wurde kein neues Spiel automatisch veröffentlicht oder einem Haus zugewiesen.

## Technische Grenzen dieses Gerüsts

Der Lernstand bleibt serverseitig gespeichert. Der grafische Baustand wird in diesem Gerüst noch nicht dauerhaft gespeichert und beginnt nach Neuladen neu. Eine aktuell ausstehende, bereits verdiente Baufreigabe wird beim Fortsetzen erneut an die neue Spielwelt zugestellt, ohne die Antwort noch einmal zu buchen. Dauerhafte Spielwelt-Snapshots sind ein eigener nächster Ausbauschritt.

Ein Modus wird beim Start gewählt; zum Wechseln das Spiel schließen und neu öffnen. Mehrere Freigaben sammeln, zehn Aufgaben pro Bauteil und eine konfigurierbare Belohnungstabelle sind noch nicht Teil des Beispiels.

Die eingebetteten Ansichten bleiben in Sandbox-Frames ohne eigene Netzwerkfreigabe. Der Aufgabenbereich verwendet den vorhandenen CMS-Transport über einen ausdrücklich verbundenen MessagePort. Speech und TTS werden an den vorhandenen CMS-Sprachhost weitergereicht. Es wird kein neuer Sprachdienst eingerichtet. Mikrofon und Lautsprecher sind hardwareabhängig und nicht Bestandteil des automatisierten Browsernachweises.

## Erzeugen und prüfen

```text
npm run build:learning-shell
npm run bundle:runtime
npm run test:learning-shell
npm run test:learning-shell:ui
```

Der Browser-Test startet einen eigenen lokalen CMS-Testserver mit temporären Daten. Er prüft die tatsächliche Sandbox, unveränderte Zellgröße, Ziehen bei kleiner Darstellung, falsche Ablage, eine Freigabe pro Antwort, Rückmeldung, doppelte Events, Neuladen, mobile Reiter, Zielabschluss und den freien Modus. Zusätzlich prüft er den isolierten Editor-Testkontext.
