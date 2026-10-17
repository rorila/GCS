# Karteikasten als Standardquelle für die drei Abenteuer

Stand: 16.10.2026. Gilt für `Mathe-Rechenballons.json`, `Mathe-Rechenpuzzle.json` und `Mathe-Insel-Flussbruecke.json`.

## Bedienung

Alle drei Spiele starten standardmäßig mit dem **persönlichen Karteikasten des angemeldeten Kindes**. Eine Plus-/Minus-Auswahl entfällt. Für diese Spieloberflächen gibt es keine automatisch erzeugten Ersatzaufgaben.

Über **📚 Stapel & Lernfächer** öffnet das Kind die gemeinsame Filterstage. In der Tabelle lassen sich mehrere eigene beziehungsweise ausdrücklich zugeordnete Stapel durch Antippen auswählen. Eine Markierung zeigt die Auswahl; erneutes Antippen entfernt sie. Ohne Stapelmarkierung gilt der gesamte zulässige Karteikasten einschließlich eigener Einzelkarten. Zusätzlich kann das Kind ein bestimmtes **Leitner-Fach 1–5** auswählen. **Alle Karten** setzt beide Filter zurück. Die Anzeige nennt die Zahl passender Karten. **Auswahl übernehmen** führt ins Spiel zurück.

Ohne Fachfilter werden zunächst Karten aus niedrigeren Fächern gewählt, innerhalb eines Fachs die am längsten nicht geprüften Karten (`lastReviewedAt`, ersatzweise `createdAt`). Dies entspricht der bestehenden Reihenfolge des Karteikastens. Fach 6 ist die Ablage für gelernte Karten und wird nicht gezogen. Ein gleiches Haus allein macht fremde Stapel nicht zu Spielinhalten.

Eine Runde umfasst **bis zu zehn unterschiedliche Karten**. Gibt es im gewählten Ausschnitt weniger, wird die Runde kürzer. Gibt es keine, erscheint eine Meldung; andere Stapel oder ein Rechengenerator springen nicht ein. Es werden keine Karten wiederholt, um eine Szene künstlich auf zehn Aufgaben aufzufüllen. Puzzle und Brücke schließen ihre restlichen visuellen Teile am Ende einer kurzen Runde ab; diese zusätzlichen Teile erzeugen keine weiteren Lernbuchungen.

Die laufende Karte zeigt ihren Stapel und ihr ursprüngliches Lernfach. Die Rückmeldung zeigt das Ergebnis der Leitner-Verbuchung. Eine bereits begonnene Runde wird fortgesetzt; ihre gespeicherte Auswahl bleibt verbindlich. Neue Filter gelten für neue Runden. Zum Wechsel während einer laufenden Runde diese zunächst beenden und das Spiel erneut öffnen.

## Unterstützte Karten

- **Antwortauswahl:** Die vorhandenen richtigen und falschen Antworten werden verwendet. Der gemeinsame Quiz-Helfer ergänzt bei reinen Zahlen bei Bedarf passende Zahlenalternativen; Frage und richtige Lösung stammen immer aus der Karte.
- **Textantwort:** Fehlen für einen Text zwei eindeutige falsche Antworten, zeigt das Spiel ein Eingabefeld. Akzeptierte Varianten entsprechen denen des Karteikastens. Zahlenwörter werden wie im bestehenden Quiz geprüft.
- **Selbsteinschätzung:** Karten mit `answerFormat: self` bieten „Das wusste ich“ und „Noch üben“. Die bestehende Lernpunkteverbuchung kennzeichnet diese als gemeldete Selbsteinschätzung; sie wird dadurch nicht zu einer automatisch verifizierten Leistung.

Vorlesen, Spracheingabe und Antwortzeit bleiben erhalten. Bei Selbsteinschätzung erfolgt die Bewertung per Schaltfläche. Für die echte Sprachverwendung gelten die vorhandene lokale Sprachinstallation, Gerätefreigabe und HTTPS-Anforderungen. Die automatische Sprachprüfung verwendet kontrollierte Adapter, keine echte Mikrofonaufnahme.

## Gemeinsamer Lernstand

Die Spiele aktualisieren **die tatsächliche Karte im Kasten des Kindes**, keine isolierte Kopie des Lernstands:

- Erste richtige Antwort: Aufstieg um ein Fach; aus Fach 5 in Fach 6.
- Erste falsche Antwort: zurück in Fach 1.
- Lösung anzeigen oder Zeitablauf: nicht selbst gelöst, zurück in Fach 1.
- Hilfe allein bucht nichts. Ist die erste Antwort danach richtig, greift der normale Aufstieg; die Rundenauswertung zählt die Unterstützung separat.

**Pro Karte und Runde zählt genau ein Lernversuch.** Nach einem Fehlversuch kann das Kind zur Übung noch einmal antworten; eine danach richtige Antwort erzeugt keinen zweiten Aufstieg und keine zweiten Lernpunkte. Die Rückmeldung zeigt deshalb gegebenenfalls „Richtig“ zusammen mit „zurück in Fach 1“. Ein neuer Lernversuch ist eine spätere Runde.

Die vorhandenen Regeln für Lernpunkte, Rückfallabzug und Sponsorvereinbarungen bleiben wirksam. Kartenergebnis, Fachwechsel, Punktjournal und Anfragebeleg werden zusammen gespeichert. Wiederholte identische Requests, Doppelklicks und erneutes Laden buchen nicht erneut. Eine angezeigte Lösung wird mit einem eigenen internen Grund gespeichert, ohne eine vom Kind angeblich eingegebene falsche Antwort zu erfinden.

Zugriff und Inhalt werden erneut geprüft. Entzogene Stapel, fremde Kinder, entfernte oder zwischenzeitlich geänderte Karten können nicht weiter verbucht werden. Die Zuordnung eines Stapels übernimmt bereits über die bestehende Verwaltung dessen Karten in den persönlichen Kasten; diese vorhandene Import-/Deduplizierungslogik wird nicht durch einen zweiten Lernstand ersetzt.

## GCS und Dateien

Oberfläche, Filter und Spielabläufe bleiben reguläre editierbare GCS-Stages mit Tasks und Actions. `cms-math-cardbox-ui.cjs` verwendet vorhandene Komponenten und ergänzt `stage_cardbox_filters`. Neue gemeinsame Filtervariablen liegen im Blueprint. Die bestehenden Builder binden die Erweiterung ein; `cms-math-card-source.cjs` aktualisiert vorhandene Projekte gezielt und erhält deren Layout.

Die bisherigen `/api/cms/play`-Aktionen bleiben bestehen. Das Profil `cardbox-v1` verwendet `cms-cardbox-selection.cjs` und `cms-cardbox-round.cjs`. Eine Karteikastenrunde wird als `mathRound.version: 2` in der vorhandenen Spielsitzung gespeichert. Die früheren Generatorrunden bleiben als Version 1 lesbar; sie werden nicht während einer laufenden Sitzung stillschweigend umgewandelt. Bei einer solchen Alt-Runde meldet das neue Spiel, dass sie beendet und neu gestartet werden muss.

Die gemeinsame Verbuchung erfolgt über `cms-card-points.cjs`. Es gibt keine zusätzliche Lernstandstabelle und keine Änderung an bestehenden Lernpunkteregeln. JSON und SQLite speichern die Runde mit ihren Anfragebelegen. Eine Wiederaufnahme nach echtem SQLite-Schließen und Wiederöffnen ist getestet.

Karten erhalten durch ihre Verwendung im Spiel **keine automatische Lehrplanzuordnung**. Die fachliche Ausrichtung folgt den gepflegten Karten und der Stapelauswahl.

## Betrieb und aktuelle Importpakete

Nach der Servererweiterung den **CMS-Server einmal neu starten** und die Browserseite neu laden. Die drei genannten Projektdateien sind aktualisiert.

Wurde ein Spiel zuvor als eigene CMS-Uploadkopie importiert, verwendet diese weiterhin ihren bisherigen Inhalt. Dafür liegen aktualisierte ZIP-Pakete und portable JSON-Dateien in `artifacts/cardbox-adventures/`, jeweils unter dem ursprünglichen Projektnamen. Das Insel-ZIP enthält seine lokalen Medien. Die bisherigen Insel-Artefakte unter `artifacts/mathe-insel/` sind ebenfalls aktualisiert. Kein Spiel wurde automatisch veröffentlicht oder einem anderen Haus zugeordnet.

```powershell
npm run build:cardbox:adventures
npm run test:cardbox:adventures
npm run test:cardbox:adventures:ui
npm run test:math:voice:ui
```

Die bisherigen Einzelbefehle `test:math:ui`, `test:math:puzzle:ui` und `test:math:island:ui` prüfen jetzt den jeweiligen Karteikasten-Ablauf. Regressionsbelege und Screenshots liegen in `artifacts/cardbox-adventures/`. Die frühere Dokumentation zum Generatorpilot beschreibt nicht mehr die Standardauswahl dieser drei Spieloberflächen.
