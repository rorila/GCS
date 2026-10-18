# Antwortauswahl für Karteikarten

In der Kopfrechnen-App werden drei gemischte Antwortbuttons angeboten. Beispiel: `8 × 7` → `54`, `56`, `60`.

Nach der ersten Auswahl sind alle drei Antworten gesperrt. Sowohl bei richtiger als auch bei falscher Auswahl erscheint **„Die richtige Antwort ist 56.“**. Nach mindestens zwei Sekunden und bestätigter Speicherung folgt die nächste Aufgabe. Die erste Auswahl zählt; Doppelklicks erzeugen keinen zweiten Bewertungsaufruf. Der bestehende serverseitige Versuchsschlüssel (`attemptId`) schützt zusätzlich vor doppelter Buchung bei wiederholten Anfragen. Der Server überprüft die ausgewählte Antwort gegen die gültigen Lösungen.

Bei Speicherfehlern bleibt die App stehen und zeigt einen Hinweis. Ein unbestätigtes Ergebnis wird nicht als gespeichert ausgegeben und nicht automatisch erneut versendet. Beenden stoppt den Feedbacktimer; verspätete Antworten starten keine neue Aufgabe.

## Karten bearbeiten

Im CMS unter „Karte bearbeiten“ gibt es das optionale Feld **„Falsche Antworten“**. Mehrere Werte werden mit Semikolon getrennt, beispielsweise `54; 60`. Das Feld „Richtige Antworten“ enthält ausschließlich gültige Lösungen und deren akzeptierte Varianten.

Die zusätzlichen Werte werden als `wrongAnswers` an der Karte gespeichert und über die Karten-API bereitgestellt. Alte Karten benötigen keine Migration. Speichern über ältere Clients ohne dieses Feld behält vorhandene Werte; ein ausdrücklich leeres Feld entfernt sie. Falsche Antworten, die einer akzeptierten Lösung entsprechen, werden vom Server zurückgewiesen.

Ohne zwei geeignete Vorgaben ergänzt die Kopfrechnen-App bei numerischen Lösungen Alternativen. Für `56` sind die ersten Vorschläge `54` und `60`. Doppelte oder ebenfalls richtige Zahlen werden ausgeschlossen. Bei nichtnumerischen Lösungen werden keine falschen Fakten erfunden: Es müssen zwei falsche Möglichkeiten vorgegeben sein, andernfalls erscheint ein Hinweis.

Die Karten-Daten sind projektübergreifend verfügbar. Der neue Auswahlablauf ist in **Kopfrechnen-App.json** eingebaut. Andere Spiele können die gemeinsame Ausdrucksfunktion `createAnswerChoices(AktuelleKarte)` verwenden; bestehende Sprach-, Tastatur- und Selbstbewertungsspiele werden nicht automatisch umgestellt.

## Umsetzung und Prüfung

- `src/utils/AnswerChoices.ts`: Erzeugen und Mischen der Antwortmöglichkeiten.
- `scripts/cms/cms-quiz-choice.cjs`: deklarativer Spielablauf einschließlich Phasen und Timer; wird vom Kopfrechnen-Generator aufgerufen.
- `scripts/cms/cms-card-choice-editor.cjs`: Erweiterung des Karteneditors und Weitergabe der Werte an die Server-Stage; wird vom Karten-Generator aufgerufen.
- Die vorhandenen JSON-Projekte wurden gezielt ergänzt; vollständige Neugenerierung des CMS wurde vermieden.

Gezielte Tests:

```
node --import tsx --test tests/answer_choices.test.ts
node --test scripts/test-card-choice-storage.cjs
node scripts/test-cms-card-points.cjs
```

Die ersten beiden prüfen Auswahl, Rückmeldung, Doppelklicks, verzögerte/fehlgeschlagene Buchung, Beenden, Speicherung und Konfiguration. Die bestehenden Lernpunkte-Tests prüfen insbesondere die serverseitig einmalige Buchung und Antwortprüfung. Eine isolierte Browserprüfung mit Testkarten bestätigt Anzeige, Sperre und Aufgabenwechsel für richtige und falsche Auswahl.

Nach Übernahme der Änderungen einen bereits laufenden CMS-Server neu starten, damit er die ergänzten Kartenmethoden lädt. Geöffnete Spielseiten anschließend neu laden. Produktive Kartendaten wurden bei der Umsetzung nicht verändert.
