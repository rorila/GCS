# Aufgabenbereich: Ablauf, Karteikarten und Eventvertrag

Stand: 17.10.2026 · **Planungsdokument. Der inzwischen gebaute erste Stand ist in [Bedienung und Umsetzungsstand](Aufgabenbereich-Bedienung-und-Umsetzungsstand.md) beschrieben.**

## 1. Auftrag und Umfang

Wir bauen zunächst ausschließlich den wiederverwendbaren **Aufgabenbereich**. Eine echte Spielwelt wird in diesem Schritt nicht erstellt oder erweitert.

Der Aufgabenbereich zeigt Karten aus dem persönlichen Karteikasten, liest Aufgaben vor, nimmt Antworten entgegen, lässt sie serverseitig prüfen und führt den gemeinsamen Leitner-Lernstand fort. Die Darstellung der Vorderseite ergibt sich aus dem Kartentyp.

Als Gegenstelle wird ein kleiner **Testempfänger** vorgesehen. Er stellt keine Spielwelt dar. Sein sichtbares Label zeigt das zuletzt vom Aufgabenbereich gesendete und tatsächlich empfangene Event. So können wir die Schnittstelle prüfen, bevor beispielsweise Turmbau, Hausbau oder Puzzle angeschlossen werden.

Dieses Dokument beschreibt das gewünschte Zielverhalten. Die vorhandenen Mathe-Abenteuer sind eine technische Grundlage, entsprechen aber noch nicht in allen Punkten diesem Ablauf.

## 2. Gemeinsames Grundprinzip

| Teil | Verantwortung |
| --- | --- |
| Aufgabenbereich | Karte anzeigen, vorlesen, Eingabe und Rückmeldung darstellen; nächste Karte erst bei erfüllten Bedingungen zeigen |
| Lernsteuerung auf dem Server | Berechtigungen und Filter prüfen, Karten auswählen, Antworten prüfen, Lernstand speichern, Wiederholungen und eindeutige Ergebnisvorgänge verwalten |
| Spielwelt-Adapter | Ergebnisereignisse an den angeschlossenen Empfänger übergeben und Rückmeldungen zuordnen |
| Testempfänger, später Spielwelt | Ereignis empfangen; zunächst Label aktualisieren, später Animation oder Kinderinteraktion ausführen |

Die Karte bestimmt das Aufgabenlayout. Sie bestimmt weder die Spielwelt noch deren Fortschritt. Ein Wechsel zwischen Bilderzählkarten und Einmaleinskarten darf eine angeschlossene Spielwelt nicht zurücksetzen.

Die Spielwelt prüft keine Antworten und verändert keine Leitner-Fächer. Umgekehrt kennt der Aufgabenbereich keine Bausteine, Brücken, Spielfiguren oder Puzzleteile.

## 3. Verbindlich besprochene Anforderungen

1. Die Frage wird automatisch vorgelesen.
2. Ein Lautsprecherbutton wiederholt die Frage auf der Vorderseite beziehungsweise die Lösung auf der Rückseite.
3. Die Aufgabe erscheint auf einer echten Karteikarte im Stil von `Karteikasten-Quiz.json`.
4. Bei richtiger Antwort wird `AntwortRichtig` an die Gegenstelle gesendet. Im Animationsmodus folgt sofort die nächste Karte, sobald das Ergebnis sicher gespeichert ist.
5. Bei falscher Antwort wird `AntwortFalsch` gesendet. Die Karte wandert in Fach 1, dreht sich animiert um und zeigt die richtige Lösung. Die Lösung wird vorgelesen.
6. Nach einer falschen Antwort gibt es keinen regulären Button „Nächste Karte“, auf den das Kind zum Weiterlernen zwingend klicken muss. Der Ablauf geht automatisch weiter, sobald Lösungsdarstellung und eine gegebenenfalls erforderliche Spielwelt-Interaktion abgeschlossen sind.
7. Falsch beantwortete Karten werden sehr bald erneut vorgelegt.
8. Ein Dropdown enthält „Gesamter Karteikasten“ und die für das Kind verfügbaren eigenen beziehungsweise zugeordneten Stapel. Zusätzlich bleibt ein Filter nach Leitner-Fächern erhalten.
9. Zwischen Spracheingabe und Maus-/Touchbedienung kann umgeschaltet werden.
10. Nicht verstandene Sprache ist kein fachlicher Fehler. Sie erzeugt `AntwortNichtVerstanden`; dieselbe Karte bleibt offen und der Lernstand unverändert.
11. Vorlesen und Spracherkennung laufen nicht gleichzeitig.
12. Doppelklicks, verspätete Sprachereignisse und wiederholte Netzwerkanfragen erzeugen keine Doppelbuchungen oder doppelten Spielwelterfolge.
13. Filterwechsel, Pause und Wiederaufnahme erhalten den Spielwelt-Fortschritt.
14. Fehlende Karten oder Freigaben erhalten verständliche Meldungen, keine leere Karte.
15. Eine Spielwelt kann nur automatisch reagieren oder eine Kinderinteraktion verlangen. Im zweiten Fall wartet der Aufgabenbereich auf das Rückereignis `SpielweltBereit`.

Die folgenden konkreten Zeiten und Auswahlregeln sind **Umsetzungsvorschläge**. Sie sind als konfigurierbare Vorgaben zu verstehen, nicht als zusätzlich bereits bestätigte pädagogische Festlegungen.

## 4. Gemeinsame Karteikarten-Hülle

### 4.1 Aufbau

```text
AUFGABENBEREICH                              TESTEMPFÄNGER

Stapel: [ Gesamter Karteikasten v ]           Letztes empfangenes Event:
Lernfach: [ Alle Lernfächer 1–5 v ]           AntwortRichtig · Richtig: 3
Eingabe: [ Sprache | Maus / Touch ]

┌──────────────────────────────────────┐     Verbindung: Bereit
│                 ?                    │
│       Wie viele Füchse siehst du?     │     Nur im Interaktions-Test:
│                                      │     [ SpielweltBereit simulieren ]
│        [Fuchs] [Fuchs] [Fuchs]        │
│                                      │
│           [2]   [3]   [4]             │
│                                      │
│          [ Noch einmal vorlesen ]     │
│                                      │
│ [Stapelname] [Stapelart] [Ersteller]  │
└──────────────────────────────────────┘

Status: Du kannst antworten.
[ Pause ]                         [ Beenden ]
```

Die Skizze ist eine textuelle Anordnungshilfe. Der rechte Bereich ist zunächst ausschließlich die technische Gegenstelle, keine bereits gestaltete Spielwelt.

### 4.2 Feste Bestandteile

- Kartenpapier, Rand und Grundgestaltung wie im vorhandenen Karteikasten-Quiz.
- Vorderseite mit Frage, gegebenenfalls Bildern und passender Antwortbedienung.
- Rückseite mit zentrierter richtiger Lösung; keine Antwortauswahl auf der Rückseite.
- Lautsprecherbutton zum Wiederholen der aktuell sichtbaren Seite.
- Drei feste Informationslabels: **Stapelname**, **Stapelart**, **Name des Stapelerstellers**. Bei Stapelart wird zunächst das vorhandene Fach-/Subject-Feld genutzt; die Oberfläche führt keinen zweiten konkurrierenden Metadatenwert ein.
- Allgemeiner Eingabe-/Lade-/Wartestatus außerhalb der Karte.
- Pause und Beenden außerhalb der Karte.

Bei Karten ohne Quellstapel muss ein ehrlicher Ersatz angezeigt werden, beispielsweise „Eigene Karte“. Fehlende Metadaten bleiben nicht als technische Variablennamen sichtbar.

### 4.3 Inhalt nach Kartentyp

| Kartentyp | Vorderseite | Eingabe |
| --- | --- | --- |
| Bilder zählen (`count-images`) | Frage und exakt die hinterlegte Bildanzahl | Drei Zahlen zur Auswahl; alternativ gesprochene Zahl |
| Gewöhnliche Rechenkarte | Rechenaufgabe, z. B. `2 × 6 = ?` | Drei Auswahlantworten, wenn passende Alternativen vorhanden sind; sonst Texteingabe oder Sprache |
| Gewöhnliche Textkarte | Frage als Text | Antwortauswahl, sofern vorhanden; ansonsten Texteingabe oder Sprache |
| Selbsteinschätzung | Frage und nach Aufdecken die Vergleichslösung | Eigener Ablauf mit „Gewusst / Noch üben“; als gesonderter Adapter, nicht als automatisch geprüfte Antwort behandeln |

Die ersten Abnahmen konzentrieren sich auf **Bilder zählen und Einmaleins/Rechnen**, damit Mirias gemischter Karteikasten konkret funktioniert. Selbsteinschätzung darf erst dann als gleichwertig unterstützt gelten, wenn ihre bestehende Lernpunkte-/Anerkennungsregel und der neue Ablauf gemeinsam getestet sind. Bis dahin wird sie gegebenenfalls transparent als noch nicht unterstützter Typ ausgewiesen.

Das Layout wird anhand des Kartentyps gewählt. Ein Stapel bündelt Karten, ist aber kein fest verdrahteter Bildschirm. Dadurch bleiben auch Stapel mit unterschiedlichen Kartentypen möglich.

## 5. Ablauf einer richtigen Antwort

1. Das Kind antwortet über den aktuell gewählten Eingabemodus.
2. Der Aufgabenbereich sperrt weitere Einsendungen für diesen Versuch und beendet Vorlesen beziehungsweise Zuhören.
3. Der Server prüft Antwort, Kartenversuch, Person und Berechtigungen.
4. Antwort und Leitner-Wechsel werden atomar und genau einmal gespeichert.
5. Der bestätigte Ergebnisvorgang wird mit seiner Ereigniskennung an den Spielwelt-Adapter übergeben.
6. Der Testempfänger beziehungsweise die Spielwelt empfängt `AntwortRichtig`.
7. Abhängig vom vereinbarten Reaktionsmodus:
   - **Animation:** Die nächste Karte wird sofort geladen und dargestellt. Eine Animation der Spielwelt läuft unabhängig weiter.
   - **Interaktion:** Der Aufgabenbereich zeigt „Jetzt ist deine Spielwelt dran“ und wartet auf das passende `SpielweltBereit`.

„Sofort“ bedeutet ohne zusätzliche Erfolgsseite, Bestätigungsbutton oder künstliche Wartezeit. Es bedeutet nicht, dass die Oberfläche eine unbestätigte Antwort bereits als Erfolg buchen darf.

Die Karte steigt nach der vorhandenen Leitner-Regel um ein Fach auf. Fach 6 bleibt die Ablage gelernter Karten. Der aktuelle Plan setzt diese Grundregel nicht durch eine eigene Punkteberechnung im Client außer Kraft.

## 6. Ablauf einer falschen Antwort

1. Eingabe für den Versuch sperren und Spracheingabe beenden.
2. Der Server bestätigt die falsche Antwort und setzt die Karte auf Fach 1.
3. `AntwortFalsch` wird an den Adapter gesendet. Die Spielwelt darf sofort reagieren.
4. Die Karte wird animiert umgedreht. Die Frage und Antwortauswahl verschwinden spätestens am Wendepunkt.
5. Auf der Rückseite erscheint ausschließlich die richtige Lösung als zentraler Inhalt. Die festen Karteninformationen und der Lautsprecherbutton können erhalten bleiben.
6. Erst bei sichtbarer Rückseite wird die Lösung vorgelesen.
7. Die Rückseite bleibt lang genug sichtbar, um die Lösung wahrzunehmen.
8. Nach Abschluss der Lösungsdarstellung und gegebenenfalls der Spielwelt-Interaktion wird automatisch die nächste Karte gezogen.
9. Die falsch beantwortete Karte erhält einen bevorzugten Platz in der Wiederholungswarteschlange.

### 6.1 Vorschlag für Darstellung und Zeitverhalten

- Flip-Dauer: ungefähr **1.100 ms**, angelehnt an das bestehende Papierkarten-Quiz.
- Mindestlesezeit der vollständig sichtbaren Rückseite: zunächst **2 Sekunden**, bei längeren Lösungen entsprechend länger.
- Automatischer Wechsel erst nach `max(Mindestlesezeit, Dauer der Lösungsansage)` und eventuell noch ausstehendem `SpielweltBereit`.
- Wiederholtes Vorlesen stoppt den anstehenden Wechsel und verlängert die Lösungsphase bis zum Ende der Wiederholung. So wird die Lösung nicht während einer erneuten Ansage ausgeblendet.
- Bei deaktiviertem Ton oder ausgefallener Sprachausgabe reicht die angemessene Lesezeit. Der Ablauf darf nicht auf ein nie eintreffendes Audioereignis warten.
- Für reduzierte Bewegung kann der Seitenwechsel ohne Drehung erfolgen; die Rückseite bleibt dennoch sichtbar.

### 6.2 Schnelle Wiederholung

Vorgeschlagene Grundeinstellung: eine falsch beantwortete Karte nach **ein bis zwei anderen bearbeiteten Karten** erneut vorlegen. Bei nur einer verfügbaren Karte erfolgt die Wiederholung nach ihrer Lösungsphase direkt.

Dabei gelten folgende Regeln:

- Die Wiederholungswarteschlange ist serverseitiger Lernzustand, kein nur lokal laufender Timer.
- Ein falscher Versuch erzeugt nicht mehrere identische Warteschlangeneinträge für dieselbe Karte.
- Vor dem erneuten Ziehen werden Aktivität, Zuordnung und aktuelle Filter erneut geprüft.
- Verlässt die Karte durch einen Filterwechsel die Auswahl, wird sie bis zu einer passenden Auswahl nicht vorgelegt.
- Bei erneuter Vorlage wird ein **neuer Kartenversuch** mit neuer `attemptId` erzeugt.
- Erst dieser neue Versuch kann eine neue Leitner-Buchung auslösen. Es wird nicht derselbe bereits bewertete Versuch erneut gebucht.
- Ein nachträglicher HTTP-Retry des alten Versuchs bleibt derselbe Vorgang und löst keinen zweiten Effekt aus.

Damit unterscheiden wir einen **technischen Wiederholungsaufruf** von einer **pädagogischen erneuten Vorlage** derselben Karte.

## 7. Spracheingabe und Nichtverstehen

### 7.1 Sichtbare Zustände

| Zustand | Anzeige und Verhalten |
| --- | --- |
| Vorlesen | „Ich lese vor …“; Mikrofon hört nicht zu |
| Antwortbereit | „Du kannst antworten.“; passende Auswahl oder Texteingabe aktiv |
| Zuhören | „Ich höre zu …“; neue Spracherkennung für genau den aktuellen Versuch |
| Nicht verstanden | „Ich habe dich nicht verstanden. Sprich noch einmal oder tippe eine Antwort an.“ |
| Antwort wird geprüft | Eingaben gesperrt; keine zweite parallele Antwort |
| Lösung | Rückseite sichtbar, Lösung vorlesen oder wiederholen |
| Warte auf Spielwelt | Eingaben für die abgeschlossene Karte bleiben gesperrt |

### 7.2 Fachlicher Fehler versus Erkennungsproblem

- Eine eindeutig erkannte, aber inhaltlich falsche Antwort erzeugt `AntwortFalsch`.
- Keine Sprache, ein uneindeutiges Ergebnis oder ein nicht zuverlässig zuordenbarer Zahlenwert erzeugt `AntwortNichtVerstanden`.
- Bei Nichtverstehen ändern sich weder Fach, richtige Antworten noch falsche Antworten im Lernzähler.
- Für einen neuen Spracherkennungsdurchlauf kann erneut ein Nichtverstehen-Event entstehen. Doppelte Abschlussmeldungen desselben Durchlaufs werden dagegen dedupliziert.
- Mikrofonberechtigung verweigert, Gerät nicht verfügbar oder ein technischer Dienstfehler werden als verständlicher technischer Status behandelt. Sie gelten nicht als fachlich falsche Antwort. Maus/Touch beziehungsweise Tastatur bleiben als Ausweg verfügbar.
- Ein reiner Audioausgabefehler ist ebenfalls kein Antwortereignis.

Im Animationsmodus bleibt dieselbe Karte nach einem Nichtverstehen-Event offen und wieder bedienbar. Falls eine spätere Spielwelt für dieses Event eine Interaktion verlangt, bleibt ebenfalls dieselbe Karte offen; nur die erneute Eingabe wartet auf `SpielweltBereit`. Nichtverstehen zieht niemals selbst die nächste Karte.

## 8. Eventvertrag zwischen Aufgabenbereich und Gegenstelle

### 8.1 Ereignisse vom Aufgabenbereich

| Name | Wann gesendet? | Lernwirkung |
| --- | --- | --- |
| `AntwortRichtig` | Nach serverseitig bestätigter richtiger Antwort | Einmaliger bestätigter Leitner-Wechsel für den Versuch |
| `AntwortFalsch` | Nach serverseitig bestätigter falscher Antwort | Karte einmalig auf Fach 1 setzen |
| `AntwortNichtVerstanden` | Abschluss eines Spracherkennungsdurchlaufs ohne eindeutige Antwort | Keine Änderung |
| `RundeBeendet` | Eine definierte Runde wird regulär abgeschlossen | Kein zusätzlicher Antworterfolg |

Die ersten drei Events bilden die minimale Ergebnisschnittstelle. `RundeBeendet` ist ein Lebenszyklusereignis und darf von einer Spielwelt nicht als weitere richtige Antwort interpretiert werden.

Pause, Beenden und Wiederaufnahme werden separat als Steuerzustand behandelt. Sie werden nicht als richtige oder falsche Antwort verkleidet.

### 8.2 Gemeinsamer Ereignisumschlag

Beispiel eines vorgesehenen Vertrags, unabhängig von der konkreten GCS-Implementierung:

```json
{
  "schemaVersion": 1,
  "eventId": "event-unique-123",
  "type": "AntwortRichtig",
  "sessionId": "learning-session-123",
  "attemptId": "card-attempt-456",
  "sequence": 7,
  "occurredAt": "2026-10-17T09:00:00.000Z",
  "progress": {
    "correctAnswers": 3,
    "wrongAnswers": 1,
    "reviewedAttempts": 4
  }
}
```

- `eventId`: identifiziert genau ein logisches Event und bleibt bei erneuter Zustellung gleich.
- `sessionId`: bindet das Event an die aktuelle Lern-/Spielweltsitzung.
- `attemptId`: bindet die Antwort an den Kartenversuch. Nichtverstehen erhält zusätzlich eine Kennung des Spracherkennungsdurchlaufs zur Deduplizierung.
- `sequence`: monoton steigende Reihenfolge innerhalb der Sitzung.
- `progress`: bestätigter Gesamtstand der Sitzung, nicht nur eine unzuverlässige „plus eins“-Nachricht.
- `occurredAt`: fachlicher Ereigniszeitpunkt, nicht Zeitpunkt eines späteren Wiederholungsversands.

Im Event stehen **keine Frage, Musterlösung, Roh-Audiodaten, Transkripte oder Kinderklarnamen**. Die Gegenstelle benötigt diese Informationen nicht.

### 8.3 Bedeutung der Zähler

- `correctAnswers` zählt korrekt abgeschlossene Kartenversuche in dieser Sitzung.
- `wrongAnswers` zählt falsch abgeschlossene Kartenversuche.
- `reviewedAttempts` ist die Summe dieser fachlich bewerteten Versuche.
- Nichtverstehen verändert keinen dieser Zähler.
- Eine später erneut vorgelegte und richtig beantwortete Karte ist ein neuer Versuch und kann einen weiteren richtigen Abschluss liefern.
- Derselbe technisch erneut versandte Vorgang erhöht den Zähler nicht.
- Diese Zähler sind **nicht** gleichbedeutend mit Lernpunkten, Anzahl verschiedener gelernter Karten oder Anzahl erreichter Leitner-Fächer.

Die Spielwelt entscheidet selbst, ob beispielsweise jede richtige Antwort einen Stein gibt oder erst jede zweite. Sie verändert die gelieferten Lernzähler dabei nicht.

### 8.4 Rückereignis der Gegenstelle

```json
{
  "schemaVersion": 1,
  "type": "SpielweltBereit",
  "sessionId": "learning-session-123",
  "forEventId": "event-unique-123"
}
```

`forEventId` verweist exakt auf das Ereignis, dessen Interaktion abgeschlossen ist. Ein allgemeines „bereit = ja“ ohne Zuordnung reicht nicht aus.

Eine Rückmeldung aus einer anderen Sitzung, für einen alten Vorgang oder eine bereits erledigte Interaktion wird ignoriert. Mehrfach empfangenes `SpielweltBereit` schaltet höchstens einmal weiter.

## 9. Zwei Reaktionsmodi und der Übergang zur nächsten Karte

### 9.1 Modus wird vor dem Versand vereinbart

Die Gegenstelle beschreibt bei der Verbindung, ob sie für einen Ereignistyp nur animiert oder eine Interaktion verlangt. Beispiel:

```json
{
  "contractVersion": 1,
  "reactionModes": {
    "AntwortRichtig": "interaction",
    "AntwortFalsch": "animation",
    "AntwortNichtVerstanden": "animation"
  }
}
```

So ist vor Versand klar, ob auf eine Rückmeldung gewartet werden muss. Die technische Zustellung und die Beendigung einer Kinderinteraktion sind zwei verschiedene Dinge.

Für diesen ersten Bauschritt ist der Testempfänger standardmäßig im **Animationsmodus**. Ein eigener Testmodus kann die Interaktionssperre simulieren, ohne dafür bereits ein Spiel zu bauen.

### 9.2 Übergangsregeln

| Ergebnis | Animationsmodus | Interaktionsmodus |
| --- | --- | --- |
| Richtig | Sofort nächste Karte nach bestätigter Buchung und erfolgreicher Übergabe | Nächste Karte nach passendem `SpielweltBereit` |
| Falsch | Nach Flip, Lösung und Lese-/Vorlesephase automatisch nächste Karte | Zusätzlich auf passendes `SpielweltBereit` warten |
| Nicht verstanden | Dieselbe Karte wieder zur Antwort freigeben | Dieselbe Karte nach passendem `SpielweltBereit` wieder freigeben |

Bei einer falschen Antwort sind **Lösung fertig** und **Interaktion fertig** unabhängig. Die Reihenfolge ihrer Abschlussmeldungen ist beliebig. Der Übergang erfolgt genau einmal, wenn beide erforderlichen Bedingungen erfüllt sind.

### 9.3 Schutz gegen Rennen und verlorene Meldungen

1. Ergebnisvorgang mit Eventkennung und gegebenenfalls ausstehender Interaktion speichern.
2. Erst danach Event zustellen. Eine sofortige Rückmeldung kann dadurch bereits sicher zugeordnet werden.
3. Der Empfänger verarbeitet dieselbe Eventkennung höchstens einmal als neue Spielaktion.
4. Nach Verbindungsunterbrechung kann dasselbe Event erneut zugestellt werden. Es erhält keine neue Kennung.
5. Ein bereits abgeschlossener Empfänger darf für dieses Event erneut `SpielweltBereit` bestätigen, führt die Spielaktion aber nicht erneut aus.
6. Ein fehlender Empfänger oder Zustellfehler wird sichtbar gemeldet. Das Label darf keinen Empfang behaupten, der nicht stattgefunden hat.
7. Eine hängende Interaktion wird nicht nach einem willkürlichen Timeout automatisch als erledigt gewertet. Pause/Beenden und ein sichtbarer Wiederverbindungs-/Wiederholungsweg müssen verfügbar bleiben.

## 10. Das gewünschte Event-Label

### 10.1 Ort und Darstellung

Rechts neben dem Aufgabenbereich befindet sich für die erste Umsetzung eine kleine Testfläche. Sie ersetzt die spätere Spielwelt vollständig.

Vorgesehene Komponenten:

| Komponente | Inhalt |
| --- | --- |
| `EventMonitorTitle` | „Letztes empfangenes Event“ |
| `EventMonitorLabel` | Beispielsweise `AntwortFalsch · Richtig: 3 · Falsch: 1` |
| `EventMonitorStatus` | „Bereit“, „Warte auf Interaktion“, „Rückmeldung gesendet“ oder verständlicher Übertragungsfehler |
| `SimulateWorldReady` | Nur im Interaktions-Testmodus sichtbar: „SpielweltBereit simulieren“ |

Vor dem ersten Event lautet der Labeltext **„Noch kein Event empfangen“**.

Das Ergebnis bleibt sichtbar, bis ein neues Event eingeht. Die nächste Karte löscht den Text nicht. Lange technische Kennungen dürfen in einer zusätzlichen Diagnoseansicht stehen; sie müssen die kindgerechte Anzeige nicht überladen.

### 10.2 Wichtiger Nachweis: Empfang statt bloßer Versandabsicht

**Das Label wird ausschließlich im Empfangs-Task des Testempfängers aktualisiert.** Der Aufgabenbereich darf es nicht direkt beim Prüfen einer Antwort setzen.

Der Prüfweg lautet:

```text
Aufgabenbereich
    → bestätigtes Ergebnis
    → Events_Senden
    → angeschlossener Spielwelt-Adapter
    → Testempfaenger_Empfangen
    → EventMonitorLabel aktualisieren
```

Wenn der Empfänger nicht angeschlossen ist, bleibt der letzte empfangene Wert erhalten und der Verbindungsstatus zeigt den Fehler. Dadurch beweist das Label tatsächlich, dass der vereinbarte Übergabepunkt erreicht wurde.

Im ersten Schritt belegt dieser Testempfänger die Schnittstelle. Dass eine später gebaute echte Spielwelt Events verarbeitet, muss anschließend zusätzlich mit genau dieser Welt geprüft werden.

### 10.3 Interaktionsmodus ohne echte Spielwelt prüfen

Im Testmodus kann für `AntwortRichtig` eine Interaktion verlangt werden:

1. Kind beantwortet die Karte.
2. Label zeigt `AntwortRichtig` und den neuen Zähler.
3. Aufgabenbereich wartet.
4. Testperson betätigt „SpielweltBereit simulieren“.
5. Der Testempfänger sendet die Kennung des ausstehenden Events zurück.
6. Aufgabenbereich zeigt die nächste Karte.

Diese Schaltfläche ist ein Diagnosewerkzeug. Sie ist keine reguläre Kinderaktion und kein Ersatz für das spätere Spielwelt-Design.

## 11. Stapel, Fachfilter und Berechtigungen

- Standard: gesamter persönlicher Karteikasten, Lernfächer 1–5.
- Stapeldropdown: „Gesamter Karteikasten“ plus verfügbare eigene und zugeordnete Stapel. Bei diesem ersten gemeinsamen Bildschirm ist das Dropdown eine Einzelauswahl; eine spätere Mehrfachauswahl kann ergänzt werden, ohne den Eventvertrag zu ändern.
- Fachfilter: alle aktiven Lernfächer oder ein bestimmtes Fach. Fach 6 bleibt außerhalb der normalen Lernrunde.
- Eine Änderung wird zwischen zwei Karten wirksam. Während einer bereits eingesandten Antwort oder einer ausstehenden Spielwelt-Interaktion wird sie vorgemerkt, nicht rückwirkend angewendet.
- Die aktuelle Lösung und erforderliche Interaktion werden vor dem Wechsel abgeschlossen.
- Filterwechsel setzen weder Ergebniszähler noch Spielwelt-Fortschritt zurück.
- Zuordnung, Sichtbarkeit und Kartenaktivität werden bei jedem neuen Ziehen geprüft.

### 11.1 Bekannte Unstimmigkeit ausdrücklich berücksichtigen

Im aktuellen System kann eine Elternperson einen noch unveröffentlichten Stapel zuordnen; die Spielauswahl kann dessen Karten anschließend wegen fehlender Veröffentlichung ausschließen. Die Zuordnung existiert dann, die Meldung „Keine Karten vorhanden“ ist jedoch irreführend.

Für den neuen Aufgabenbereich muss die Meldung diesen Zustand unterscheiden, beispielsweise:

> „Dein zugeordneter Stapel ist noch nicht freigegeben. Bitte einen Erwachsenen darum, die Freigabe zu prüfen.“

Die Veröffentlichungspolitik wird in diesem Bauschritt nicht stillschweigend verändert. Ob eine direkte Elternzuordnung künftig selbst als Freigabe genügt, ist eine gesonderte fachliche Entscheidung. Bis dahin wird die bestehende Berechtigung korrekt und verständlich dargestellt.

### 11.2 Weitere leere oder nicht darstellbare Zustände

| Ursache | Verhalten |
| --- | --- |
| Kein Stapel zugeordnet und keine eigenen Karten | Hinweis auf fehlende Aufgabenquelle |
| Keine Karte im gewählten Fach | Filteränderung anbieten |
| Alle passenden Karten in Fach 6 | „Alle Karten dieser Auswahl gelernt“ |
| Zuordnung oder Freigabe entzogen | Erklärung und erneute Auswahl; keine Ersatzkarte aus fremden Stapeln |
| Kartentyp noch nicht unterstützt | Betroffene Karten erkennbar benennen beziehungsweise zählen und passende andere Karten anbieten; keine leere Frage |
| Bild fehlt oder lädt nicht | Aufgabe nicht zur Bewertung freigeben; erneutes Laden anbieten, ohne Fehlversuch zu buchen |

## 12. Pause, Beenden, Wiederaufnahme und optionale Zeitbegrenzung

### Pause

- Vorlesen und Spracherkennung stoppen.
- Eingaben und Antwortzeit anhalten.
- Karte, Seite, Lernversuch, Wiederholungswarteschlange, Ergebniszähler und ausstehende Interaktion erhalten.
- Späte Audio-/Sprachereignisse dürfen in der Pause keine Antwort auslösen.

### Wiederaufnahme

- Vom Server bestätigten Zustand wiederherstellen.
- Eine bereits gebuchte Antwort nicht neu bewerten.
- Ein noch nicht bestätigtes Ergebnis gegebenenfalls mit derselben Vorgangskennung erneut anfordern.
- Ausstehende Spielweltereignisse idempotent erneut zustellen.
- Eine offene Lösung oder Interaktionssperre nicht durch eine neue Karte überspringen.

### Beenden

- Medien und Eingaben stoppen und die Sitzung sauber beenden.
- Eine unbeantwortete Karte nicht als falsch werten.
- Ein Abbruch erzeugt keinen zusätzlichen Antworterfolg.

### Zeitlimit

Standardmäßig ausgeschaltet. Ein später eingeschaltetes Limit läuft nur während einer tatsächlich antwortbereiten Aufgabe, nicht beim Vorlesen, in der Lösungsphase, in der Pause oder beim Warten auf die Spielwelt.

Ein Zeitablauf ist keine vom Kind abgegebene falsche Antwort. Seine fachliche Bewertung und sein eventueller eigener Eventtyp müssen vor Aktivierung gesondert festgelegt werden. Die frühere Timeout-Regel der Mathe-Spiele wird für diesen neuen gemeinsamen Ablauf nicht ungeprüft übernommen.

## 13. Technische Umsetzung nach GCS-Prinzipien

### 13.1 Vorhandene Grundlagen

| Datei | Aktueller Nutzen |
| --- | --- |
| `scripts/cms/cms-task-presentation.cjs` | Kartentyp und Bilddaten validieren |
| `scripts/cms/cms-task-layout.cjs` | Bisheriges umschaltbares Layout und Wiederholungsbutton |
| `scripts/cms/cms-quiz-card.cjs` | Papierkarten-Hülle und animierter Seitenwechsel |
| `scripts/cms/cms-quiz-counting-layout.cjs` | Bilder innerhalb der Papierkarte darstellen |
| `scripts/cms/cms-cardbox-selection.cjs` | Persönliche Karten und berechtigte Stapel auswählen |
| `scripts/cms/cms-cardbox-round.cjs` | Bisherige sichere Rundenvorgänge und Antwortbelege |
| `scripts/cms/cms-card-points.cjs` | Gemeinsame Leitner-/Lernpunktebuchung |
| `scripts/cms/cms-math-voice-timer.cjs` | Bestehende Sprach- und Zeitsteuerung als Grundlage |
| `src/utils/ImageSource.ts` | Einheitliche Bildpfade für ZIP-Medien und eingebettete Bilder |

Diese Bausteine werden gezielt wiederverwendet. Es wird nicht das gesamte Turmbau-Projekt als Voraussetzung für einen Aufgabenbereich benötigt.

### 13.2 Neues wiederverwendbares GCS-Modul

Vorgeschlagene Artefakte:

- `game-server/public/projects/Aufgabenbereich-Karteikasten.json`: allein lauffähiges Prüfprojekt mit Aufgabenbereich und Testempfänger.
- `scripts/cms/cms-build-task-area.cjs`: wiederholbarer Generator für die gemeinsamen Komponenten, Aktionen und Tasks.
- `scripts/cms/cms-task-events.cjs`: serverseitiger Vertrag für Ergebniskennungen, Zähler und sichere Wiederaufnahme, soweit nicht in bestehende Lernsteuerung integrierbar.
- `docs/Aufgabenbereich-Plan-und-Eventvertrag.md`: dieses verbindende Planungsdokument.

Die Namen sind Vorschläge für die Implementierung, keine Behauptung, dass diese Dateien bereits vorhanden sind.

Darstellung und Abläufe bleiben als normale GCS-Komponenten, Aktionen und Tasks im Projekt editierbar. Beispielhafte Tasks:

- `Aufgabe_Laden`, `Aufgabe_Anzeigen`, `Aufgabe_Vorlesen`.
- `Antwort_Pruefen`, `Antwort_Richtig`, `Antwort_Falsch`.
- `Karte_Umdrehen`, `Loesung_Vorlesen`, `Loesung_Fertig`.
- `Events_Senden`, `Testempfaenger_Empfangen`, `Spielwelt_Bereit_Empfangen`.
- `Weiter_Pruefen`, `Filter_Vormerken`, `Pause`, `Fortsetzen`, `Beenden`.

Für den ersten lokalen Aufbau genügt eine explizite GCS-Task-/Adapter-Schnittstelle mit einem versionierten Ereignisobjekt. Ein allgemeiner neuer Netzwerk- oder Eventbus wird nur eingeführt, wenn die vorhandenen Mittel nicht ausreichen. Client-Events ersetzen keine serverseitige Antwortprüfung.

### 13.3 Erforderliche Änderung am bestehenden Rundenmodell

Die derzeitigen Karteikasten-Abenteuer verwenden eine vorab gebildete Liste mit höchstens zehn verschiedenen Karten. Ein falscher erster Versuch kann bisher noch innerhalb derselben Aufgabe wiederholt werden. Das ist **nicht** identisch mit dem neu vereinbarten Ablauf „falsch → Lösung zeigen → andere Karte → dieselbe Karte bald erneut ziehen“.

Deshalb benötigt der neue Aufgabenbereich eine ausdrücklich versionierte Lernsteuerung mit Wiederholungswarteschlange. Alte gespeicherte Runden werden nicht stillschweigend als neue Runden interpretiert.

Erforderlicher Zustand:

- Aktuelle Auswahl und vorgemerkte Filteränderung.
- Aktuelle Karte und aktuelle `attemptId`.
- Bewerteter Ergebnisvorgang und stabile Eventkennung.
- Fachlicher Gesamtstand der Sitzung.
- Bevorzugte Wiederholungskarten und Fälligkeit nach weiteren Bearbeitungen.
- Ob die Lösungsphase bereits abgeschlossen wurde.
- Ob und für welches Event eine Spielwelt-Rückmeldung aussteht.
- Zustell-/Bestätigungsstand für eine sichere Wiederaufnahme.

Die richtige Lösung wird vom Server erst für eine berechtigt abgeschlossene falsche Antwort beziehungsweise einen zulässigen Aufdeckvorgang ausgeliefert. Sie wird nicht schon als verborgenes Lösungsfeld auf der Vorderseite an die Spielwelt weitergereicht.

Eine feste Rundengröße ist kein Bestandteil des Eventvertrags. Für den ersten Aufgabenbereich bietet sich eine fortlaufende Sitzung bis „Beenden“ an. Falls später feste Rundenlängen gewünscht sind, müssen schnelle Wiederholungen und deren Zählung ausdrücklich mitberücksichtigt werden.

## 14. Zustandsmodell als Umsetzungshilfe

| Zustand | Zulässiger nächster Schritt |
| --- | --- |
| Laden | Karte und verfügbare Medien prüfen; dann Vorderseite anzeigen |
| Frage vorlesen | Auf Sprachende oder Audiofehler warten; dann antwortbereit |
| Antwortbereit | Eingabe, erneutes Vorlesen, zulässiger Filterwechsel oder Pause |
| Antwort prüfen | Bestätigte Serverantwort abwarten; keine zweite Einsendung |
| Richtig bestätigt | Event übergeben; anschließend nächste Karte oder Interaktionssperre |
| Falsch bestätigt | Event übergeben; Flip starten |
| Lösung zeigen/vorlesen | Lösungsabschluss abwarten; bei Bedarf parallel Interaktionssperre beachten |
| Warte auf Spielwelt | Nur passende Bereitschaftsmeldung, Pause, Beenden oder Wiederverbindung |
| Nicht verstanden | Event übergeben; dieselbe Karte erneut freigeben oder auf dazugehörige Interaktion warten |
| Pausiert | Zustand erhalten; Fortsetzen oder Beenden |
| Fehler/keine Karten | Verständliche Meldung, Filteränderung beziehungsweise erneutes Laden |
| Beendet | Keine weiteren Antwort- oder Fortschrittsereignisse erzeugen |

Das Wechseln zur nächsten Karte wird zentral in `Weiter_Pruefen` entschieden. Mehrere voneinander unabhängige Timer dürfen nicht jeweils selbst eine neue Karte ziehen.

## 15. Umsetzungsschritte – ausschließlich Aufgabenbereich

### Schritt A: Verträge und Gegenstelle

- Ergebnis- und Bereitschaftsvertrag versionieren.
- Zähler und Deduplizierungsregeln implementieren.
- Testempfänger mit `EventMonitorLabel` erstellen.
- Animations- und Interaktionsmodus des Testempfängers ohne echte Welt prüfbar machen.

**Ergebnis:** Ein synthetisches Testevent erreicht den Empfänger; das Label wird dort aktualisiert. Das ist zunächst ein Schnittstellentest, noch kein Nachweis einer echten Antwortbuchung.

### Schritt B: Karteikarten-Hülle und gemischte Karten

- Papierkarte, feste Informationslabels und Lautsprecherbutton integrieren.
- Bilderzählkarten und Rechenkarten innerhalb derselben Hülle darstellen.
- Genau passende Antwortbedienung bereitstellen.
- Fehlende Bilder und nicht unterstützte Kartentypen sichtbar behandeln.

**Ergebnis:** Bilder und Einmaleins wechseln innerhalb desselben Aufgabenbereichs, ohne den Empfänger oder seine Zähler neu zu erzeugen.

### Schritt C: Richtige Antwort und Lernbuchung

- Vorhandene serverseitige Prüfung und Leitner-Buchung nutzen.
- Bestätigtes `AntwortRichtig` genau einmal übergeben.
- Animationsmodus: direkt neue Karte.
- Interaktionsmodus: auf passende Rückmeldung warten.

### Schritt D: Falsche Antwort und schnelle Wiederholung

- Karte in Fach 1 setzen und `AntwortFalsch` senden.
- Flip, zentrierte Lösung und Vorlesen implementieren.
- Automatischen Übergang mit beiden Freigabebedingungen integrieren.
- Wiederholungswarteschlange und neue Versuchskennungen umsetzen.

### Schritt E: Sprache und Nichtverstehen

- Mikrofon-/Maus-/Touchumschaltung integrieren.
- Vorlesen und Zuhören sauber gegeneinander sperren.
- `AntwortNichtVerstanden` ohne Lernbuchung senden.
- Wiederholungsbutton auf Vorder- und Rückseite prüfen.

### Schritt F: Filter, Pause und Wiederaufnahme

- Stapeldropdown und Fachfilter integrieren.
- Filterwechsel sicher vormerken.
- Zustellungswiederholung, ausstehende Interaktion und Lernwarteschlange wiederherstellen.
- Verständliche Meldungen zu Freigaben und leeren Auswahlen ergänzen.

### Schritt G: Abnahme und Paket

- GCS-Projekt, portables JSON und ZIP mit vorhandenen Assets erzeugen.
- Modul- und Browserprüfungen abschließen.
- Einen echten gemischten Karteikasten in einer isolierten Testumgebung durchspielen.
- Prüfanleitung und dokumentierte Grenzen liefern.

**Nicht Teil dieses Bauschritts:** Turm-, Haus- oder Puzzlespielwelt entwickeln, neue Belohnungslogik festlegen, Hausfreigaben automatisch ändern oder die Veröffentlichungspolitik von Stapeln umstellen.

## 16. Konkrete Abnahmekriterien

### Darstellung und Medien

- Eine Bilderzählkarte zeigt exakt die erwartete Anzahl geladener Bilder, nicht nur Komponenten mit `visible = true`.
- Füchse, Elefanten, Pandas und Papageien funktionieren aus einem echten ZIP mit separaten Medien und aus eingebetteten Bildern.
- Eine Einmaleinskarte verwendet dieselbe Papierkarten-Hülle ohne übrig gebliebene Tierbilder.
- Die drei Informationslabels zeigen Stapelname, Stapelart und Ersteller.
- Desktop und Tablet haben keine überdeckten Eingabe-, Filter- oder Vorlesebuttons.

### Antwortablauf und Leitner

- Richtig: genau eine Buchung und ein logisch einmaliges `AntwortRichtig`.
- Falsch: genau eine Buchung nach Fach 1, genau ein `AntwortFalsch`, sichtbarer Flip, sichtbare und vorgelesene Lösung.
- Nach falscher Antwort ist kein manueller Weiter-Klick erforderlich.
- Die Karte erscheint nach der eingestellten kurzen Wiederholungsdistanz erneut und besitzt dann eine neue Versuchskennung.
- Ein technischer Retry erzeugt dagegen weder eine neue Bewertung noch einen zusätzlichen Erfolg.

### Events und Rückkanal

- Das Empfängerlabel zeigt `AntwortRichtig`, `AntwortFalsch` und `AntwortNichtVerstanden` ausschließlich nach tatsächlichem Empfang.
- Ein abgetrennter Empfänger führt zu einem sichtbaren Verbindungsproblem statt zu einem vorgetäuschten Empfang.
- Im Animationsmodus wartet die nächste richtige Aufgabe nicht auf eine Spielanimation.
- Im Interaktionsmodus bleibt der Aufgabenbereich gesperrt, bis das passende `SpielweltBereit` eintrifft.
- Bei falscher Antwort funktioniert sowohl „Interaktion zuerst fertig“ als auch „Lösung zuerst fertig“.
- Ein altes, fremdes oder doppeltes Bereitschaftsevent schaltet keine spätere Karte weiter.
- Bei Nichtverstehen bleibt dieselbe Karte aktiv; der richtige/falsche Zähler und das Leitner-Fach bleiben unverändert.

### Stabilität und Wiederaufnahme

- Filterwechsel erhält den Gesamtfortschritt und vermeidet Karten außerhalb der neuen Auswahl.
- Pause stoppt Mikrofon, Vorlesen und optionale Antwortzeit.
- Neuladen erhält die bestätigte Buchung und eine ausstehende Interaktionssperre.
- Späte Sprachmeldungen und schnelle Doppelklicks werden sicher ignoriert.
- Kartenfreigaben und Aktivität werden serverseitig geprüft; keine Aufgaben anderer Kinder werden verwendet.
- Fehlende Veröffentlichung wird als solche erklärt, statt pauschal „keine Karten“ zu melden.

## 17. Vorschläge, die bei der Umsetzung ausdrücklich konfigurierbar bleiben

| Thema | Vorgeschlagener Ausgangswert |
| --- | --- |
| Schnelle Wiederholung | Nach ein bis zwei anderen bewerteten Karten |
| Flip | Etwa 1.100 ms; reduzierte Bewegung möglich |
| Mindestlesezeit Lösung | Mindestens 2 Sekunden, bei langen Texten mehr |
| Antwortzeit | Kein Limit |
| Testempfänger | Animationsmodus als Standard |
| Stapelauswahl | Ein Dropdown mit Gesamtkasten oder einem Stapel |
| Sitzungsende | Zunächst durch „Beenden“, keine ungeprüfte starre Zehn-Karten-Grenze |

Diese Vorschläge blockieren die Planung nicht. Sie sind von den bereits vereinbarten Grundregeln getrennt, damit sie später ohne Umbau der Schnittstelle angepasst werden können.
