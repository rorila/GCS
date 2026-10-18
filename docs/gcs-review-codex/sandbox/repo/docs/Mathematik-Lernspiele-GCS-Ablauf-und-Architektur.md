# Mathematik-Lernspiele in GCS: Ablauf und Architekturvorschlag

Stand: 15.10.2026 · Zielgruppe: Grundschule Bayern, Jahrgangsstufen 1–4

**Status: Konzept zur Abstimmung. Dieses Dokument implementiert keine neuen Spiel- oder Serverfunktionen.**

Umsetzungsschritt 1 wurde am 15.10.2026 als isolierte Schnittstellenprobe abgeschlossen. Ergebnisse und Grenzen stehen im [Phase-1-Prüfbericht](Mathematik-Phase1-Schnittstellenpruefung.md). Die produktiven Mathematikfunktionen sind weiterhin Planung.

## 1. Ziel und Entscheidungsvorschlag

GCS erhält einen Mathematik-Lernbereich, der vorhandene Spiele, Karteistapel, Benutzer, Häuser, Räume und Spielsitzungen weiterverwendet. Fachlich geprüfte Aufgaben sollen in unterschiedlichen Spieloberflächen erscheinen können. Der erste vollständige Durchlauf wird mit **Rechenballons für Addition und Subtraktion im Zahlenraum bis 100** umgesetzt.

Die Reihenfolge lautet:

**Lernziel auswählen → Aufgabenquelle festlegen → Aufgaben prüfen → Spielentwurf erzeugen → Vorschau testen → veröffentlichen und Häusern zuordnen → Raumfreigabe → spielen → hilfreiches Feedback → Lernfortschritt speichern → weitere Übung empfehlen.**

Die KI unterstützt später beim Entwurf. Für den ersten Prototyp sind ein geprüfter Spielbauplan und deterministische Mathematik ausreichend. Damit bleibt der Lernbetrieb auch ohne erreichbares Sprachmodell möglich.

### Umfang des ersten spielbaren Prototyps

- Eine wiederverwendbare Auswahlmechanik mit drei ruhenden Ballons.
- Addition und Subtraktion mit ganzzahligen Aufgaben und Ergebnissen zwischen 0 und 100.
- Zehn Aufgaben pro Runde, ohne Zeitdruck.
- Genau eine richtige und zwei unterschiedliche falsche Antwortmöglichkeiten.
- Ein fachlich passender Hinweis und ein nachvollziehbarer Lösungsweg.
- Speicherung von Erstlösung, Lösung mit Hilfe und angezeigter Lösung.
- Start, Pause, Wiederaufnahme und Beenden über die bestehende GCS-Sitzungsverwaltung.
- Vorbereitete Aufgabenserien; automatische Anpassung während der Runde erst später.

Nicht zum ersten Prototyp gehören eine vollständige Lehrplanabdeckung, alle vier Spieloberflächen, eine automatische Einstufung von Kindern oder eine autonome KI-Veröffentlichung.

## 2. Bestandsaufnahme: vorhandene Anknüpfungspunkte

Die folgenden Angaben beruhen auf einer gezielten Quellcodesichtung. Sie ersetzen noch keine vollständige Prüfung sämtlicher Editor-, Export- und Laufzeitwege.

| Bereich | Vorhanden im Projekt | Konsequenz für die Erweiterung |
|---|---|---|
| Spieldefinition und Speicherung | `src/model/types.ts`, `src/services/ProjectPersistenceService.ts`; JSON-Projekte in `game-server/public/projects/` | Lernspiele bleiben reguläre GCS-Projekte. |
| Spielbetrieb | `src/runtime/GameRuntime.ts`, `src/player-standalone.ts` | Bestehende Runtime und derselbe Exportweg. |
| Aufgabenabläufe | `src/runtime/TaskExecutor.ts`, `src/runtime/ActionExecutor.ts` | Runden und Eingaben als Tasks, Actions und Events beschreiben. |
| Objekt- und Variablenverwaltung | `src/services/AgentController.ts` | Bestehende Operationen verwenden; Signaturen stehen unten. |
| KI-Planung | `src/ai/planner/Planner.ts`, `src/ai/config/AIConfig.ts` | Vorhandenen Zwischenplan erweitern, keinen zweiten Planner aufbauen. |
| KI-Skripterzeugung und Prüfung | `src/ai/generation/AgentScriptGenerator.ts`, `src/ai/validation/AIValidator.ts` | Fachliche Prüfung zusätzlich zur vorhandenen technischen Prüfung. |
| Antwortmöglichkeiten | `src/utils/AnswerChoices.ts` | Vorhandenes Mischen und Vermeiden doppelter Antworten weiterverwenden; fachliche Distraktoren ergänzen. |
| Karteistapel | `scripts/cms/cms-server-decks.cjs` | Vorhandene Stapel als zweite Aufgabenquelle anbinden. |
| Kartenlernen und Lösungsprüfung | `scripts/cms/cms-card-points.cjs`, `scripts/cms/cms-spoken-number.cjs` | Prüf- und Buchungsmuster übernehmen; allgemeines Mathematiklernen nicht automatisch als Leitner-Aufstieg behandeln. |
| Fortschritt und Leistungspunkte | `scripts/cms/cms-performance.cjs`, `TServerPlaySession.reportProgress` in `scripts/cms/cms-server-components.cjs` | Übungsfortschritt von überprüften Belohnungspunkten trennen. |
| GCS-Serverabläufe | `scripts/cms/cms-runtime.cjs` und Server-Stages im CMS-Projekt | Neue Serverabläufe in das bestehende deklarative Modell integrieren. |
| Persistenz | `scripts/cms/cms-store.cjs`, `scripts/cms/cms-sqlite-store.cjs` | Über Store-Commits und Migrationen schreiben; keine parallelen Direktzugriffe auf die laufende Datenbank. |
| Freigaben | `scripts/cms/cms-game-availability.cjs`, `scripts/cms/cms-core.cjs` | Veröffentlichung, Hausverfügbarkeit und Raumzuordnung bleiben wirksam. |

### Tatsächlich vorhandene Editoroperationen

In `AgentController.ts` sind unter anderem folgende Methoden vorhanden:

```ts
createStage(id, name, type, config?)
addObject(stageId, objectData)
addVariable(name, type, initialValue, scope?, options?)
createTask(stageId, taskName, description?)
addAction(taskName, actionType, actionName, params?)
addTaskCall(taskName, calledTaskName)
addTaskParam(taskName, paramName, type?, defaultValue?)
setProperty(stageId, objectName, property, value)
bindVariable(stageId, objectName, property, expression)
connectEvent(stageId, objectName, eventName, taskName)
```

Das sind vorhandene Einstiegspunkte, aber noch kein Nachweis, dass jeder gewünschte Mathematikablauf darüber unverändert erzeugt werden kann. Vor der Implementierung sind insbesondere Task-Parameter, verschachtelte Objekte, Referenzen und Variablenbindung mit einem kleinen ausführbaren Muster zu prüfen.

**Wichtig:** Alle nachfolgend eingeführten Mathematiktypen, Methoden- und Routennamen sind Vorschläge. Sie sind keine bereits vorhandenen GCS-Operationen.

## 3. Rollen und Verantwortlichkeiten

| Beteiligte | Aufgabe |
|---|---|
| Inhaltspflege | Offizielle Quellen prüfen, eigene Lernziele ableiten, Aufgabenprofile und Hinweise fachlich prüfen. |
| Spielautor | Lernziel, Aufgabenquelle und Spielmechanik kombinieren; Entwurf und Vorschau bearbeiten. |
| SuperAdmin | Spiel gemäß bestehendem Veröffentlichungsmodell veröffentlichen; allen oder ausgewählten Häusern verfügbar machen. |
| HouseAdmin | Verfügbare Spiele in den Hauskatalog aufnehmen und bestimmten Räumen zuordnen. |
| Eltern/Betreuende | Im bestehenden Berechtigungsrahmen Inhalte auswählen und Fortschritt des eigenen Kindes einsehen. |
| Kind | Freigegebenes Spiel im eigenen Raum starten und Aufgaben bearbeiten. |
| KI | Ideen und Entwürfe vorschlagen; keine eigenständige fachliche Freigabe oder Punktevergabe. |

Die fachliche Prüfung eines Inhalts ist von seiner technischen Veröffentlichung getrennt. Die konkrete Zuordnung der Inhaltspflege zu vorhandenen GCS-Rollen wird in Phase 1 festgelegt; hierfür ist nicht automatisch eine neue Benutzerrolle erforderlich.

## 4. Lernzielkatalog und Lehrplanbezug

### 4.1 Drei getrennte Ebenen

1. **Offizielle Kompetenzreferenz:** Fundstelle, Lehrplanbereich und nachvollziehbare Quellenangaben.
2. **Abgeleitetes Lernziel:** Eigene, überprüfbare Beschreibung einer kleineren Fertigkeit.
3. **Konkrete Aufgabe:** Beispielsweise `27 + 8 = ?` mit geprüfter Lösung und Hinweisen.

Die offizielle Struktur führt Mathematik in den Jahrgangsstufenbereichen **1/2** und **3/4**. Eine Zuordnung ausschließlich zur zweiten Klasse ist eine eigene didaktische Empfehlung, keine zusätzliche offizielle Lehrplanfestlegung. Die Bereiche umfassen Zahlen und Operationen, Raum und Form, Größen und Messen sowie Daten und Zufall. Quellen: [Mathematik 1/2](https://www.lehrplanplus.bayern.de/fachlehrplan/grundschule/2/mathematik), [Mathematik 3/4](https://www.lehrplanplus.bayern.de/fachlehrplan/grundschule/3/mathematik).

### 4.2 Vorgeschlagenes Datenmodell

| Datensatz | Wichtige Felder |
|---|---|
| `CurriculumReference` | Interne ID, Bundesland, Schulart, Fach, Jahrgangsstufenbereich, Lernbereich, offizieller Abschnittscode, Quellen-URL, Abrufdatum, bekannte Veröffentlichungsfassung oder `null`, eigener Katalogstand, Prüfstatus. |
| `LearningObjective` | Eigene stabile ID, Version, Bezeichnung, Kompetenzreferenzen, Fertigkeiten, Voraussetzungen, empfohlene Jahrgänge, erlaubte Aufgabenprofile, geeignete Mechaniken, Prüfstatus. |
| `TaskProfile` | Versionierte mathematische Einschränkungen, Aufgabentyp, Zahlenraum, Darstellungsform, Hilfestrategie und Distraktorregeln. |
| `MathTask` | Instanz-ID, inhaltlicher Schlüssel, Lernziel und Version, mathematische Struktur, korrekte Lösung, Antwortmöglichkeiten, Hinweis und Lösungsweg. |

Zusatzregeln:

- IDs bleiben stabil, wenn nur eine Bezeichnung geändert wird.
- Inhaltliche Änderungen erzeugen eine neue Version.
- Abrufdatum, Lehrplanfassung und eigener Katalogstand sind unterschiedliche Angaben.
- Ein eigener Dateihash dokumentiert einen Abrufstand, ist aber keine amtliche Versionsnummer.
- Originaltext wird nur übernommen, wenn die Nutzung geklärt ist; zunächst Fundstellen und eigene Kurzbeschreibungen speichern.
- Ein eigener Text erhält ausdrücklich `origin: "derived"` oder `"example"` statt `"official"`.
- Nicht erreichbare Quellen führen zu einem ungeprüften Entwurf, nicht zu erfundenen amtlichen Kompetenzen.

### 4.3 Erstes abgeleitetes Lernziel

**Eigene ID:** `by.gs.math.12.addition.bridge-ten.to100`

**Eigene Beschreibung:** Das Kind löst Additionsaufgaben bis 100 mit Zehnerübergang, indem es den zweiten Summanden passend zerlegt.

**Voraussetzungen:** Zahlen bis 100 erkennen, Ergänzen zum nächsten Zehner, Zerlegen kleiner Zahlen.

**Offizieller Bezug:** Mathematik 1/2, Abschnitt M1/2 1.2. Die nachfolgende Übung konkretisiert den dort beschriebenen Einsatz von Rechenstrategien. Beschreibung und ID sind eigene Ableitungen; sie sind kein amtlicher Kompetenztext. [Quelle](https://www.lehrplanplus.bayern.de/fachlehrplan/grundschule/2/mathematik).

Ein zweites, eigenständiges Lernziel beschreibt Subtraktion über den Zehner. Für beide werden eigene Aufgabenprofile gepflegt.

## 5. Vollständiger Ablauf: Von der Auswahl bis zum Lernergebnis

### Schritt 1: Lernziel und Aufgabenprofil auswählen

Die erwachsene Person wählt Fach, Lernziel und ein passendes Profil. Beispielsweise:

- Mathematik, Jahrgangsbereich 1/2.
- Addition bis 100 mit Zehnerübergang.
- Zehn Aufgaben, drei Antwortmöglichkeiten.
- Hilfestellung „zum nächsten Zehner ergänzen“.
- Spieloberfläche „Rechenballons“.

Die Oberfläche beschreibt den Schwierigkeitsgrad mit verständlichen Regeln. Eine alleinstehende Zahl wie „Schwierigkeit 3“ genügt nicht.

### Schritt 2: Aufgabenquelle bestimmen

**Quelle A – Generator:** Erzeugt Aufgaben aus einem geprüften Profil.

**Quelle B – Karteistapel:** Verwendet gespeicherte Fragen, richtige Antworten und Distraktoren. Beispielsweise können Wiebkes zwanzig Einmaleins-Lückenstapel später dieselbe Ballonmechanik nutzen.

Die Quellen sind auswählbar, werden aber im ersten Prototyp nicht unbemerkt gemischt. Die Runde dokumentiert, welche Quelle und Version verwendet wurde.

Ein gewöhnlicher Karteitext ist noch kein formal geprüftes Mathematikobjekt. Für bestehende Karten sind entweder eine explizite fachliche Freigabe oder ein unterstütztes, eindeutig parsebares Aufgabenformat erforderlich. Einfache Muster wie `3 × ? = 12` können ein späterer Adapter verarbeiten. Beliebige Texte werden nicht mit `eval` ausgewertet und erhalten keine automatische Lehrplanzuordnung.

### Schritt 3: Aufgabenserie erzeugen und prüfen

Der Generator erstellt einen endlichen Vorrat gültiger Aufgaben, wählt daraus mit einem gespeicherten Seed und verhindert unerwünschte Wiederholungen.

Vor der Anzeige werden geprüft:

- Aufgabe erfüllt sämtliche Profilgrenzen.
- Lösung ist mathematisch richtig und bei Lückenaufgaben eindeutig.
- Alle Antwortmöglichkeiten sind unterschiedlich; genau eine ist richtig.
- Falsche Antworten sind im erlaubten Antwortbereich und lösen die Aufgabe tatsächlich nicht.
- Hinweis und Lösungsweg passen zur konkreten Aufgabe.
- Es gibt genügend unterschiedliche Aufgaben für die gewünschte Serienlänge.

Ist das Profil zu eng, erscheint eine verständliche Rückmeldung. Der Generator erweitert nicht selbstständig den Zahlenraum und läuft nicht endlos auf Zufallssuche.

### Schritt 4: Spielentwurf bauen

Eine geprüfte Spielvorlage erzeugt ein reguläres GCS-Projekt. Lernziel, Aufgabenprofil und Versionen werden als zusätzliche Metadaten referenziert. Aufgabenerzeugung, Lösungsprüfung und Oberfläche bleiben getrennt.

Zunächst genügen zwei Stages:

1. `stage_math_play`: Startansicht, laufende Runde, Hilfe, Pause und Fehlerrückmeldungen.
2. `stage_math_result`: Zusammenfassung und Rückkehr zur GCS-Spieleauswahl.

Die konkrete Konfiguration wird vorerst vom Spielautor vorgenommen. Eine umfangreiche Konfigurationsoberfläche für Kinder ist nicht nötig.

### Schritt 5: Vorschau und Freigabe

Die Vorschau verwendet synthetische Testdaten und bucht keine Lern- oder Belohnungspunkte. Geprüft werden Mathematik, Texte, Touch-Bedienung, Layout und vollständiger Rundenabschluss.

Ein Spiel wird erst nach erfolgreicher Prüfung veröffentlicht. Danach legt der SuperAdmin fest, ob alle oder nur ausgewählte Häuser Zugriff haben. Der HouseAdmin ordnet es den gewünschten Räumen zu. Ein neues Spiel wird keinem Haus automatisch zugeordnet.

### Schritt 6: Kind startet im Raum

Das Kind meldet sich an, öffnet seinen Raum und wählt das Lernspiel. GCS prüft Veröffentlichung, Hausverfügbarkeit, Hauskatalog, Raumfreigabe und Zutritt.

Der Start verwendet die bestehende Spielsitzung und den begrenzten Launch-Zugang. Bei einer bereits laufenden Sitzung bleibt die bestehende Möglichkeit zum Beenden beziehungsweise Fortsetzen verfügbar. Ein Kind erhält keine zweite parallele Sitzung, um eine Fehlermeldung zu umgehen.

Das Spiel zeigt eine kurze Erklärung: „Tippe auf den Ballon mit der richtigen Zahl.“ Vorlesen ist optional. Die Runde beginnt über „Start“; ein Mikrofon wird nicht benötigt.

### Schritt 7: Aufgabe anzeigen

Beispiel:

```text
                  27 + 8 = ?

          🎈 34       🎈 35       🎈 25

        Aufgabe 1 von 10       💡 Hilfe
        Pause                 Spiel beenden
```

Die Reihenfolge der Antworten wird einmal je Aufgabe bestimmt. Ein erneutes Rendern mischt sie nicht um. Die Ballons bewegen sich im ersten Prototyp nicht; damit beeinflusst die Geschicklichkeit nicht die Rechenleistung.

### Schritt 8: Antwort prüfen

Beim ersten Tippen sperrt die Oberfläche weitere Antworten für dieselbe Prüfung. Der Server erhält Aufgabeninstanz und ausgewählte Antwort. Er liest die korrekte Lösung aus seiner eigenen Aufgabeninstanz; vom Browser mitgesendete Ergebnisse werden nicht übernommen.

Für die Prüfung wird eine stabile Anfrage-ID verwendet. Ein erneuter Versand derselben Anfrage nach Verbindungsproblemen erzeugt dasselbe Ergebnis und keine zusätzliche Buchung.

Die Antwortmöglichkeiten sind im Browser sichtbar; dieser Ansatz verhindert daher keinen absichtlichen Blick in Browserdaten. Er stellt sicher, dass Clientmeldungen allein keine ungeprüften Leistungspunkte erzeugen.

### Schritt 9a: Richtige Antwort

Der richtige Ballon erhält eine kurze Bestätigung, beispielsweise einen kleinen Plopp-Effekt. Daneben steht „Richtig!“. Rückmeldung erfolgt auch über Text oder Symbol, nicht allein über Farbe oder Ton.

„Weiter“ wird freigegeben, sobald die Antwort bestätigt ist. Ein automatischer Wechsel ist später optional; im ersten Prototyp bestimmt das Kind das Lesetempo selbst.

### Schritt 9b: Falsche Antwort und Hilfe

Die Oberfläche zeigt beispielsweise: „Schau noch einmal. Wie viel fehlt von 27 bis 30?“

Der gewählte falsche Ballon wird als geprüft markiert und nicht erneut angeboten. Die Positionen der anderen Antworten bleiben gleich. Nach einem Hinweis gibt es einen weiteren Versuch.

Für das Beispiel lautet der geprüfte Lösungsweg:

```text
8 = 3 + 5
27 + 3 = 30
30 + 5 = 35
```

Nach einem zweiten Fehler oder über „Lösung zeigen“ wird dieser Weg angezeigt. Die Aufgabe endet dann als „Lösung gezeigt“, nicht als selbstständig richtig gelöst. Auch ein zweiter richtiger Versuch ohne eingeblendeten Hinweis bleibt als Lösung nach einem vorherigen Fehler erkennbar.

### Schritt 10: Nächste Aufgabe

Die nächste Aufgabe wird erst nach bestätigter Speicherung und ausdrücklichem „Weiter“ geöffnet. Ein Netzfehler erzeugt den Zustand „Speicherung ausstehend“. Die bisherige Aufgabe bleibt erhalten; ein Wiederholungsversuch bucht sie nicht doppelt.

Eine falsch beantwortete Aufgabe kann später erneut geübt werden. Diese Wiederholung erhält eine neue Aufgabeninstanz und verweist auf ihren Ursprung. Der erste Fehler wird dabei nicht nachträglich gelöscht.

### Schritt 11: Rundenabschluss

Die Zusammenfassung könnte lauten:

```text
Du hast 10 Aufgaben bearbeitet.
7 beim ersten Versuch richtig
2 nach einem weiteren Versuch / mit Hilfe richtig
1 Lösung gemeinsam angesehen

[Ähnliche Aufgaben üben]  [Zur Spieleauswahl]
```

Eine bloß angezeigte Lösung zählt nicht als richtige Antwort. Das Beispiel ist eine Rückmeldung zu dieser Runde, keine Einstufung als „Lernziel beherrscht“.

Beim Abschluss wird die bestehende Spielsitzung ordnungsgemäß beendet und ein Ergebnis gespeichert. Ein erneuter Abschlussaufruf hat keine zweite Punktebuchung zur Folge.

### Schritt 12: Betreuung und nächste Übung

Berechtigte Personen sehen eine verständliche Zusammenfassung pro Lernziel und Profil. Als nächste Übung wird zunächst dasselbe oder ein einfacheres Profil vorgeschlagen. Änderungen werden erklärt, beispielsweise „Wir üben das Ergänzen zum Zehner noch einmal“.

Eine automatische Anpassung während der Runde bleibt zunächst ausgeschaltet. Später muss sie auf mehreren Beobachtungen beruhen, Hilfen berücksichtigen und für Betreuende nachvollziehbar sein.

## 6. Mathematikmodell und deterministischer Generator

### 6.1 Vorgeschlagene Konfiguration

```json
{
  "schemaVersion": 1,
  "objectiveId": "by.gs.math.12.addition.bridge-ten.to100",
  "objectiveVersion": 1,
  "profileId": "addition-to100-cross-ten-v1",
  "recommendedGrade": 2,
  "operation": "addition",
  "unknown": "result",
  "operandRange": { "min": 1, "max": 99 },
  "resultRange": { "min": 0, "max": 100 },
  "crossingTen": "required",
  "count": 10,
  "choiceCount": 3,
  "seed": "runde-beispiel-001",
  "generatorVersion": 1,
  "mechanic": "balloon-choice"
}
```

Diese Struktur ist ein neuer Fachvorschlag, keine vorhandene GCS-Action. Eine Regel erlaubt nur sinnvolle Kombinationen; `operation` und das gewählte Profil dürfen sich nicht widersprechen.

### 6.2 Mathematische Struktur statt Textauswertung

Eine Aufgabe speichert ihre Struktur, beispielsweise Operation, Operanden und Position der Unbekannten. Text, Ballonbeschriftung und Sprache werden daraus abgeleitet. Für das erste Beispiel:

```json
{
  "taskInstanceId": "server-generated-id",
  "contentKey": "add:27:8:result",
  "math": { "operation": "addition", "left": 27, "right": 8, "unknown": "result" },
  "prompt": "27 + 8 = ?",
  "solution": 35,
  "choices": [34, 35, 25],
  "hintStrategy": "bridge-ten",
  "solutionSteps": ["8 = 3 + 5", "27 + 3 = 30", "30 + 5 = 35"]
}
```

Das Beispiel beschreibt die interne vollständige Aufgabe. Die Lösung wird im produktiven Prüfmodus nicht als separates Lösungsfeld an den Browser geschickt. Nach einer Auswertung können passende Rückmeldungen und Lösungsschritte freigegeben werden.

### 6.3 Mathematische Grenzen

- Addition: Operanden **und Ergebnis** müssen im definierten Bereich liegen.
- Subtraktion: Für den Prototyp `left >= right`; keine negativen Ergebnisse.
- Zehnerübergang: Für Addition und Subtraktion ausdrücklich und getrennt definieren; Grenzfälle mit 0 und glatten Zehnern testen.
- Multiplikation später: Faktorenbereiche getrennt vom Ergebnisbereich speichern.
- Division später: Divisor niemals 0; Rest ausdrücklich erlauben oder ausschließen.
- Lückenaufgaben: Bei `0 × ? = 0` fehlt eine eindeutige Lösung; solche Aufgaben werden abgewiesen oder als eigenes Aufgabenformat modelliert.
- Größen später: Einheit und kanonischen Zahlenwert getrennt speichern.
- Brüche später: Zähler und Nenner ganzzahlig speichern, Gleichwertigkeit exakt prüfen; keine Prüfung über unkontrollierte Gleitkommawerte.
- Darstellung: Komma, Minuszeichen und Malzeichen werden für die Anzeige lokalisiert; der mathematische Datensatz bleibt sprachunabhängig.

### 6.4 Seed, Wiederholbarkeit und IDs

Ein Seed allein genügt nicht. Die Reproduktion benötigt zusätzlich Profilversion, Generatorversion, feste Kandidatensortierung und einen festgelegten Zufallsalgorithmus. Die Erzeugung verwendet kein unkontrolliertes `Math.random`.

`taskInstanceId` bezeichnet einen konkreten Lernversuch; `contentKey` bezeichnet den mathematischen Inhalt. Dieselbe Aufgabe in einer späteren Runde hat denselben Inhaltsschlüssel, aber eine neue Instanz-ID.

Für den ersten Prototyp wird die tatsächlich erzeugte Serie auf dem Server gespeichert. So bleibt die Wiederaufnahme auch nach einer Generatoraktualisierung möglich.

### 6.5 Falsche Antworten und Hinweise

Fachliche Distraktoren werden vor dem bestehenden Mischen erzeugt. Beispiele: Einerfehler, vergessener Zehnerübertrag oder Verwechslung der Rechenart. Ein solcher Kandidat wird nur verwendet, wenn er im konkreten Fall plausibel, erlaubt und falsch ist.

Die Auswahl einer falschen Antwort ist höchstens ein Hinweis auf einen möglichen Fehlerweg. Sie beweist nicht, dass das Kind genau diesen Denkfehler gemacht hat.

Reichen fachliche Kandidaten nicht aus, dürfen geprüfte numerische Alternativen ergänzt werden. Reichen auch diese nicht aus, wird eine andere Aufgabe gewählt. Die richtige Antwort darf nie als Distraktor erscheinen.

Hinweise entstehen zunächst aus deterministischen Vorlagen. Spätere KI-Erklärungen dürfen weder ungeprüfte Rechenschritte einführen noch eine andere Lösung behaupten.

## 7. GCS-Umsetzung des Prototyps

### 7.1 Vorgeschlagene Komponenten und Variablen

| Element | Umsetzungsidee |
|---|---|
| Aufgabenanzeige | Vorhandenes `TLabel`. |
| Antwortballons | Drei vorhandene `TButton`-Objekte mit einfacher lokaler SVG-Gestaltung. |
| Hilfetext | `TLabel` beziehungsweise vorhandene Textdarstellung. |
| Rundenstand | `TLabel`, zunächst „Aufgabe n von 10“. |
| Hilfe, Weiter, Pause, Beenden | Vorhandene Buttons und Events. |
| Bestätigung | Kurze vorhandene Animation; keine dauernde Bewegung. |
| Fachkontext | Objektvariable für Aufgabeninstanz und Antwortmöglichkeiten. |
| Ablaufschutz | Eindeutig benannte Variable `MathPhase` statt allgemeiner Namen, die mit vorhandenen Objekten kollidieren können. |

Weitere vorgeschlagene Variablen sind `MathRoundId`, `MathTaskIndex`, `MathAttemptId`, `MathSelectedChoice`, `MathHintUsed`, `MathSubmitPending` und `MathSummary`. Variablen erhalten den erforderlichen Stage- oder Blueprint-Scope; eine globale Variable entsteht nur, wenn sie tatsächlich über einen Stagewechsel hinweg benötigt wird.

Wichtige Tasks heißen beispielsweise `Mathe_Starten`, `Mathe_Aufgabe_Anzeigen`, `Mathe_Antwort_Pruefen`, `Mathe_Hilfe_Anzeigen`, `Mathe_Weiter`, `Mathe_Pausieren` und `Mathe_Beenden`. Das sind zu erstellende Projektinhalte.

### 7.2 Explizite Zustände

| Zustand | Zulässige Eingaben | Nächster Zustand |
|---|---|---|
| `ready` | Start, Beenden | `loading`, `ended` |
| `loading` | Beenden | `answering`, `error`, `ended` |
| `answering` | Antwort, Hilfe, Pause, Beenden | `submitting`, `hint`, `paused`, `ended` |
| `submitting` | Keine zweite Antwort | `feedback`, `retryableError` |
| `hint` | Weiterer Versuch, Lösung zeigen, Beenden | `answering`, `submitting`, `ended` |
| `feedback` | Weiter nach bestätigtem Ergebnis, Beenden | `loading`, `completed`, `ended` |
| `paused` | Fortsetzen, Beenden | Vorheriger zulässiger Zustand, `ended` |
| `retryableError` | Dieselbe Anfrage erneut senden, Beenden | `submitting`, `ended` |
| `completed` | Neue Runde, Rückkehr | `ready`, `ended` |
| `ended` | Rückkehr | GCS-Spieleauswahl |

Verspätete HTTP-, Audio- und Animationsereignisse müssen Runde, Aufgabeninstanz und aktuellen Zustand prüfen. Ein Callback darf nach „Beenden“ weder eine neue Aufgabe öffnen noch einen Timer starten.

### 7.3 Neue fachliche Serveroperationen als Vorschlag

Empfohlen ist ein kleiner registrierter Mathematikdienst innerhalb der bestehenden CMS-Runtime. Seine Methoden werden über deklarative Server-Tasks aufgerufen. Die konkrete Komponentenklasse und Routenbenennung wird erst bei der Implementierung festgelegt.

| Vorgeschlagene Fachoperation | Verantwortung |
|---|---|
| `startMathRound` | Aktive eigene Spielsitzung prüfen, Lernziel/Profil freigeben, Serie erzeugen und speichern. |
| `getMathTask` | Aktuelle Aufgabeninstanz und eingefrorene Antwortreihenfolge liefern. |
| `requestMathHint` | Hinweisnutzung speichern, bevor der Hinweis ausgeliefert wird. |
| `submitMathAnswer` | Antwort prüfen, Ergebnis und Versuchszähler atomar speichern, Duplikate abfangen. |
| `revealMathSolution` | Aufgabe als „Lösung gezeigt“ abschließen und geprüften Lösungsweg liefern. |
| `finishMathRound` | Runde genau einmal abschließen und Zusammenfassung liefern. |

Diese Operationen verwenden die vorhandene Launch-/Sitzungsidentität. `childId`, richtige Lösung und Punktzahl werden nicht aus ungeprüften Browserangaben übernommen. Die bestehenden Berechtigungsprüfungen bleiben auch nach einem Freigabeentzug wirksam.

Die bestehende allgemeine Fortschrittsmeldung reicht für diesen Fachvertrag allein nicht aus: Sie beschreibt Metrikmeldungen, aber noch keine serverseitig geprüfte Mathematikaufgabe mit Hilfen und mehreren Versuchen.

## 8. Fortschritt, Speicherung und Verlässlichkeit

### 8.1 Vorgeschlagene Speicherung

Neue Sammlungen beziehungsweise Tabellen sind erst nach Prüfung des bestehenden Schemas festzulegen. Fachlich werden benötigt:

- Versionierte Lernzielreferenzen und Aufgabenprofile.
- Runde mit Kindbezug aus der Sitzung, Spiel, Profilversion, Serie und aktuellem Zustand.
- Aufgabeninstanz mit Ergebnisstatus, Anzahl Antworten und Hinweisnutzung.
- Zusammenfassung pro Lernziel und Profil.

Mögliche Ergebnisstatus:

| Status | Bedeutung |
|---|---|
| `correctFirstTry` | Erste Antwort richtig, vorher kein Hinweis ausgeliefert. |
| `correctAfterSupport` | Richtig nach Fehler oder angefordertem Hinweis. |
| `solutionShown` | Lösung wurde angezeigt; kein selbstständiger Lösungsnachweis. |
| `skipped` | Aufgabe ausdrücklich übersprungen, falls diese Funktion später angeboten wird. |
| `abandoned` | Runde vor Abschluss dieser Aufgabe verlassen. |

Fehlversuche werden zusätzlich gezählt. Die Summe abgeschlossener Aufgaben darf nicht mit der Summe aller Antwortklicks verwechselt werden. Beispielsweise ist eine Aufgabe mit zwei falschen Antworten weiterhin eine Aufgabe, nicht zwei falsch abgeschlossene Aufgaben.

### 8.2 Atomare Prüfung und Schutz vor Doppelbuchungen

Eine Antwort trägt eine eindeutige Anfrage-ID und eine erwartete Aufgabenrevision. Prüfung, Statusänderung, Versuchserfassung und gegebenenfalls verifizierte Punkte werden in einem Store-Commit gespeichert.

- Derselbe wiederholte Request liefert dasselbe Ergebnis.
- Eine andere Antwort unter derselben Anfrage-ID wird abgewiesen.
- Zwei konkurrierende Anfragen können eine abgeschlossene Aufgabe nicht zweimal zählen.
- Das Kind kann ausschließlich die eigene aktive Runde verändern.
- Ein Serverfehler führt nicht zu einer positiven Rückmeldung ohne gespeichertes Ergebnis.

### 8.3 Verhältnis zu Karteikasten und Belohnungspunkten

Ein Ballonspiel mit einer Stapelkarte verändert deren Leitner-Fach im ersten Prototyp **nicht automatisch**. Eine spätere Anbindung muss ausdrücklich entscheiden, welcher Versuch den Lernfachwechsel auslöst und wie Doppelbuchungen gegenüber dem Karteikasten-Quiz verhindert werden.

Übungsergebnisse sind ebenfalls nicht automatisch Sponsor- oder Belohnungspunkte. Erst eine explizite, veröffentlichte Regel und eine passende serverseitige Verifikation dürfen solche Punkte erzeugen. Die bestehende Trennung im Performance-Ledger bleibt erhalten.

### 8.4 Unterbrechungen und Wiederaufnahme

- Bei kurzer Verbindungsunterbrechung bleibt die Aufgabe sichtbar; ein offener Versand wird mit derselben ID wiederholt.
- Der Server ist die maßgebliche Quelle für abgeschlossene Aufgaben und Hilfen.
- Nach einem Neuladen wird die bestehende Runde wiederhergestellt oder verständlich als beendet angezeigt.
- Ein Browserabbruch wird über die vorhandene Sitzungsverwaltung behandelt; keine zweite Sitzungsverwaltung einführen.
- Vollständiges Offline-Spielen mit späterer Synchronisation ist ein späterer Ausbauschritt. Offline-Ergebnisse werden bis zur Prüfung nicht als verifizierte Punkte ausgewiesen.

### 8.5 Datensparsamkeit

Für den Prototyp genügen pseudonyme Personenreferenz, Lernziel, Profil, Ergebnisse, Hinweisnutzung und grobe Zeitangaben. Vollständige Klickverläufe, Audioaufnahmen und personenbezogene KI-Prompts sind nicht nötig.

Detaildaten werden nur im erforderlichen Umfang gespeichert. Eine vorgeschlagene begrenzte Aufbewahrungsfrist ist vor Einführung als Produktentscheidung festzulegen; daraus wird keine rechtliche Aufbewahrungspflicht abgeleitet. Export, Löschung und bestehende Anonymisierung müssen neue Lernsammlungen mit erfassen.

## 9. Bedienung und technische Gestaltung

- Große, ruhende Antwortflächen; als Entwurfsziel mindestens 48 CSS-Pixel in der tatsächlichen Anzeige nach Skalierung.
- Lesbare Zahlen, deutliche Kontraste, sichtbarer Tastaturfokus.
- Tasten 1–3 als ergänzende Antwortmöglichkeit; Touch bleibt vollständig nutzbar.
- Kein Ziehen als einzige Eingabemöglichkeit für eine Auswahlaufgabe.
- Feedback nie ausschließlich durch Rot/Grün, Ton oder Bewegung.
- Wenige kurze Animationen; reduzierte Bewegung berücksichtigen.
- Lokale, kleine SVG-Ballons statt einer neuen Grafikbibliothek.
- Feste Positionen und Abstände für Aufgabentext, Antwortwerte und Bedienbuttons.
- Auf Tablets im Hoch- und Querformat prüfen; maßgeblich sind reale Geräte und ein vereinbartes Mindestgerät.
- Beim Vorlesen keine Antwort erzwingen, bevor die Ansage verstanden werden konnte.
- Erstlösung und mathematisches Verständnis nicht anhand bloßer Geschwindigkeit bewerten.

Für den ersten Prototyp stehen alle drei Ballons in einem festen Container. Karten- oder Tabellenvorlagen mit absolut positionierten Feldern werden nur mit expliziten Feldkoordinaten verwendet. Die zuletzt aufgetretenen Überlappungen sollen dadurch nicht wieder entstehen.

## 10. Spätere KI-Integration

Die spätere Eingabe könnte lauten:

> Erstelle ein Mathematikspiel für die zweite Klasse in Bayern. Übe Addition bis 100 mit Zehnerübergang. Verwende Ballons zur Auswahl der Ergebnisse.

Vorgeschlagene Verarbeitung:

1. Lernziel und Voraussetzungen aus dem freigegebenen Katalog auflösen.
2. Ein kompatibles Aufgabenprofil und eine Mechanik auswählen.
3. Einen vorhandenen GCS-Implementierungsplan erzeugen.
4. AgentScript mit erlaubten vorhandenen Operationen erzeugen.
5. Technische Referenzen, Ereignisse, Bindungen und Layout prüfen.
6. Aufgaben unabhängig vom Sprachmodell mathematisch prüfen.
7. Einen Entwurf mit nachvollziehbarem Änderungsumfang erstellen.
8. Vorschau und Freigabe durch die berechtigte Person.

Der vorhandene `AIImplementationPlan` besitzt unter anderem `goal`, `existingEntities`, `entitiesToCreate`, `steps`, `assumptions` und `risks`. Lernziel-, Profil- und Vorlagenversionen benötigen ergänzende Metadaten oder einen zugeordneten Konfigurationsdatensatz; sie sind dort aktuell kein eigenständiger Mathematikvertrag.

Der Planner soll bevorzugt geprüfte Vorlagen parametrisieren. Falls er freie Änderungen erzeugt, müssen diese durch dieselben technischen und fachlichen Prüfungen laufen. Lehrplantext oder Aufgabeninhalt gilt als Datenquelle, nicht als ausführbare Anweisung.

Das Sprachmodell benötigt keine Namen, Häuser oder individuellen Rohverläufe von Kindern, um einen Spielentwurf zu erstellen.

## 11. Erweiterung auf weitere Spielideen

| Spielidee | Wiederverwendete Grundlage | Zusätzlich nötig |
|---|---|---|
| Apfelzähler | Auswahlprüfung, Runde, Fortschritt | Mengenobjekte mit eindeutig zählbarer Darstellung; Anzahl nicht versehentlich durch Überdeckung verfälschen. |
| Rechenpuzzle | Derselbe Aufgabenvertrag | Zuordnung geprüfter Aufgabenergebnisse zu freigeschalteten Bildteilen. |
| Einmaleins-Ballons | Stapeladapter, Auswahlmechanik | Profile für Faktor-Lücken und Prüfung der Eindeutigkeit. |
| Bruch-Pizza | Runde, Hilfen, Fortschritt | Exaktes Bruchmodell, gleich große Teilflächen, alternative Bedienung zum Ziehen. |
| Größenaufgaben | Strukturierte Mathematikaufgabe | Einheitensystem, fachlich passende Eingaben und exakte Umrechnungen. |

Die visuelle Mechanik bestimmt nicht die Jahrgangsstufe. Ein Ballonspiel kann sowohl Mengen bis 10 als auch Einmaleins-Lücken darstellen. Welche Lernziele zur Bruch-Pizza passen, wird anhand konkreter Lehrplanstellen festgelegt; daraus entsteht nicht automatisch ein allgemeiner Bruchrechenkurs.

## 12. Vorgeschlagene Codeänderungen

Alle neuen Dateinamen in dieser Tabelle sind Planungsvorschläge.

| Arbeit | Bestehender Anschluss | Vorgeschlagene Änderung |
|---|---|---|
| Fachtypen | `src/model/types.ts` und vorhandene Projektmetadaten | Neue klar getrennte Typen, etwa in `src/math/MathTypes.ts`; optionale Lernspielreferenz im Projektmodell. |
| Katalog | Projekt-/Serverdaten und vorhandene Persistenz | Versionierte Katalogdatei als Einstieg; spätere Verwaltungsdaten nur mit geprüfter Schemaerweiterung. |
| Generator | Vorhandene TypeScript-Toolchain | Deterministischer, DOM-freier Kern, etwa `src/math/MathTaskGenerator.ts`. |
| Lösungen und Hinweise | Generator und Serveradapter | Unabhängiger Validator, Distraktorregeln und geprüfte Hinweisvorlagen. |
| Antwortauswahl | `src/utils/AnswerChoices.ts` | Fachliche Kandidaten zuführen; bestehende Aufrufer und Akzeptanzvarianten erhalten. |
| Stapeladapter | `scripts/cms/cms-server-decks.cjs` | Karten in einen gemeinsamen Aufgabenvertrag überführen; Validierungsstatus erhalten. |
| Spielvorlage | `AgentController` und JSON-Projekte | Rechenballons mit bestehenden Komponenten, Tasks und Events erstellen. |
| Serverseitige Runde | `cms-runtime.cjs`, Serverkomponenten und Server-Stages | Registrierte Mathematikmethoden samt deklarativen Endpunkt-Tasks. |
| Datenspeicherung | `cms-migrations.cjs`, Store, SQLite-Schema | Versionierte Migrationen, Schlüssel und Referenzen; Backup-, Restore- und Löschwege erweitern. |
| Fortschritt | `cms-performance.cjs` und bestehende Profilansichten | Fachliche Zusammenfassung; verifizierte Punkte nur nach ausdrücklicher Regel. |
| KI später | Planner, Generator und Validator | Geprüfte Lernziele/Vorlagen auflösen und Fachprüfung einbauen. |
| Export | Vorhandene Projektpersistenz und Runtime-Bundle | Fachmodul reproduzierbar bündeln; keine unregistrierten Runtime-Aufrufe. |

Ein eigener React-Unterbau, ein zweiter Login, eine getrennte Spieleplattform und ein neues allgemeines Animationssystem sind hierfür nicht erforderlich.

Der gemeinsame Mathematikkern muss für Browser und Node verwendbar sein. Da der bestehende CMS-Server CommonJS verwendet, ist ein kleiner Build-/Adapterweg festzulegen. Zwei unabhängig gepflegte Kopien derselben Rechenlogik sind zu vermeiden.

## 13. Kleine, testbare Umsetzungsschritte

Aktueller technischer Stand und Abweichungen vom Plan: [Mathematik-Umsetzungsstand](Mathematik-Umsetzungsstand.md). Der Rechenballons-Pilot ist umgesetzt; pädagogische Freigabe, Veröffentlichung und Tablet-Abnahme stehen noch aus.

| Schritt | Ergebnis | Abnahme |
|---|---|---|
| 1 | Vollständiger Schnittstellen- und Datenflussabgleich | Eine Mini-Stage lässt sich über vorhandene Operationen erzeugen, speichern, laden und starten. |
| 2 | Ein freigegebenes Lernziel und zwei Aufgabenprofile | Offizielle Referenz und eigene Ableitung sind klar getrennt; Grenzen sind eindeutig. |
| 3 | Deterministischer Generator und Validator | Grenzfälle, gleiche Seeds, endlicher Vorrat und mathematische Ergebnisse automatisiert geprüft. |
| 4 | Serverseitiger Runden- und Versuchsvertrag | Fremdzugriff, doppelte Anfragen, konkurrierende Antworten und Abbruch getestet. |
| 5 | Rechenballons mit lokaler Vorschau | Zehn Aufgaben, korrekte Auswahl, Hilfe, Lösung und Abschluss ohne Layoutfehler. |
| 6 | Verbindung mit realer GCS-Spielsitzung | Start, Budget, Haus-/Raumfreigabe, Pause und Beenden funktionieren. |
| 7 | Ergebnisansicht für Kind und Berechtigte | Erstlösung, Hilfe und gezeigte Lösung werden korrekt getrennt. |
| 8 | Optionaler Einmaleins-Stapeladapter | Ein geeigneter vorhandener Stapel läuft mit derselben Mechanik; Leitner-Fächer ändern sich nicht unbeabsichtigt. |
| 9 | Tablet-Pilot | Ein kurzer beaufsichtigter Durchlauf auf einem vereinbarten Android-Mindestgerät ist bedienbar und stabil. |
| 10 | Entscheidung über nächste Mechanik | Erst nach dem Pilot weitere Spieloberflächen oder KI-Erzeugung ergänzen. |

Die Schritte 1–7 ergeben den ersten vollständigen produktnahen Ablauf. Einmaleins, weitere Mechaniken und KI sind bewusst nachgelagert. Eine belastbare Aufwandsschätzung folgt nach Schritt 1; dieses Dokument verspricht keinen festen Kalendertermin.

## 14. Verbindliche Prüffälle für den ersten Prototyp

### Mathematik

- Randwerte 0, 1, 9, 10, 99 und 100; Ergebnisse überschreiten die Profilgrenze nicht.
- Addition und Subtraktion mit und ohne Zehnerübergang gemäß expliziter Profildefinition.
- Genau eine richtige Wahl; keine äquivalenten richtigen Distraktoren.
- Reproduzierbare Serie für Seed und sämtliche Versionen.
- Zu wenige mögliche Aufgaben führen zu einem erklärten Fehler.
- Jeder angezeigte Lösungsschritt ist rechnerisch richtig.

### Ablauf und Speicherung

- Doppeltes Tippen führt nur zu einer Antwortverarbeitung.
- Wiederholter HTTP-Versand zählt weder Aufgabe noch Punkte doppelt.
- Ein angeforderter Hinweis schließt die Wertung „ohne Hilfe“ aus.
- Nach einem zweiten Fehlversuch ist eine gezeigte Lösung keine selbstständige Erstlösung.
- Neuladen oder Beenden während einer Anfrage verändert das falsche Aufgabenobjekt nicht.
- Ein fremdes Kind kann weder Antworten senden noch Ergebnisse der Runde lesen.
- Haus- oder Raumfreigabeentzug verhindert einen weiteren unzulässigen Start.
- Eine bereits laufende Spielsitzung wird verständlich behandelt.
- Backup, Restore und Anonymisierung berücksichtigen neue Lernrecords.

### Darstellung

- Drei lesbare Antwortwerte, feste Antwortreihenfolge, keine verdeckten Buttons.
- Bedienung mit Touch und Tastatur.
- Verständliche Rückmeldung ohne Ton und ohne Farberkennung.
- Hoch- und Querformat auf einem leistungsschwächeren Tablet.
- Bestehende Karteikasten- und Kopfrechenspiele bleiben funktionsfähig.

## 15. Noch zu bestätigende Produktentscheidungen

Empfohlene Ausgangswerte, damit die technische Planung konkret bleibt:

| Entscheidung | Empfehlung für den Start |
|---|---|
| Erste Inhalte | Addition und Subtraktion bis 100; getrennte Profile für Zehnerübergang. |
| Rundenlänge | Zehn Aufgaben. |
| Zeitdruck | Keiner. |
| Weitere Versuche | Nach dem ersten Fehler Hinweis; nach dem zweiten Fehler Lösungsweg. |
| Automatischer Wechsel | Zunächst ausdrücklicher Weiter-Button. |
| Punkte | Übungsfortschritt speichern; keine neue automatische Sponsorwertung. |
| Adaptivität | Nur nachvollziehbare Empfehlung nach der Runde, noch kein automatischer Wechsel. |
| Offline | Verständliche Wiederholungslogik bei kurzer Unterbrechung; vollständiger Offline-Modus später. |
| Veröffentlichung | Entwurf, Vorschau, berechtigte Freigabe und ausdrückliche Häuserzuordnung. |
| KI | Nach dem funktionierenden und geprüften Ablauf ergänzen. |

Diese Empfehlungen sind keine bereits erteilte Freigabe zur Implementierung.

## 16. Quellen und Prüfstand

Offizielle Lehrplanseiten, abgerufen am 15.10.2026:

- [LehrplanPLUS Mathematik 1/2](https://www.lehrplanplus.bayern.de/fachlehrplan/grundschule/2/mathematik)
- [LehrplanPLUS Mathematik 3/4](https://www.lehrplanplus.bayern.de/fachlehrplan/grundschule/3/mathematik)

Für dieses Konzept wurden die Struktur und ausgewählte fachliche Bezüge geprüft. Es wurde kein vollständiger Lehrplan importiert und keine abschließende Prüfung der Nutzungsbedingungen für eine umfangreiche Textübernahme vorgenommen.

Technischer Prüfstand: gezielte Sichtung der in Abschnitt 2 genannten Dateien und der bestehenden GCS-Karten-, Freigabe- und Sitzungsabläufe. Vorgeschlagene neue Mathematikverträge wurden noch nicht implementiert oder im Produkt erprobt. Als nächster Schritt ist der vollständige Schnittstellenabgleich mit einem kleinen ausführbaren Muster vorgesehen.
