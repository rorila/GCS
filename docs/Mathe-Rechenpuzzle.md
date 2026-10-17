# Mathe-Rechenpuzzle

> Aktueller Spielstand: Diese drei Lernabenteuer verwenden jetzt standardmäßig den gemeinsamen Karteikasten mit Stapel- und Leitner-Fachfiltern. Die frühere Generatorauswahl wurde ersetzt. Maßgeblich ist [Karteikasten-Abenteuer](Karteikasten-Abenteuer.md).


Das eigenständige Spiel `game-server/public/projects/Mathe-Rechenpuzzle.json` verwendet die Puzzlekomponenten aus `PuzzleNeu.json` und den geprüften Mathematikablauf der Rechenballons. Die Vorlage bleibt unverändert. Der produktive Spielebestand und seine Freigaben werden durch den Builder nicht verändert.

## Spielen

1. Oben eines der drei Tierbilder auswählen.
2. Plus oder Minus mit Zehnerübergang wählen. Alternativ über „Einmaleins · Stapel wählen“ einen passenden, für das Kind freigegebenen Stapel auswählen.
3. Starten. Nach Abschluss einer Aufgabe erscheint eines von zehn Puzzleteilen unter dem Bild.
4. Das Teil an die passende Stelle ziehen. Bei einer falschen Ablage springt es zurück. Alternativ „Teil einsetzen“ verwenden; dieser Weg erfordert keine genaue Ziehbewegung.
5. Erst nach dem Einsetzen wird „Weiter“ freigegeben. Nach zehn Teilen zeigt das Spiel das fertige Bild und eine kurze Abschlussanimation. „Runde abschließen“ speichert das Ergebnis und beendet die Spielsitzung.

Auch nach einer Hilfe oder einer angezeigten Lösung wird ein Teil freigegeben. So kann jedes Kind das Bild fertigstellen. Die Auswertung unterscheidet weiterhin sofort richtige Antworten, Antworten mit Unterstützung und nur angezeigte Lösungen. Ein fertiges Puzzle ist keine Aussage, dass alle Aufgaben selbstständig gelöst wurden.

## Vorlage und Umsetzung

- Die Zielplattform und die Sprite-Vorlage stammen aus `PuzzleNeu.json`.
- Der vorhandene `ImageSplitterModel.createImagePieces` erzeugt zehn zusammenpassende Puzzleteile in einem Raster mit fünf Spalten und zwei Zeilen. Die echten Puzzlekanten werden weiterverwendet.
- Drei bereits vorhandene Bilder aus dem Tierbilderordner werden auf eine einheitliche Bildfläche gebracht und in das JSON eingebettet. In der Upload-Sandbox sind keine zusätzlichen Medienordner oder Netzwerkzugriffe für die Bilder nötig.
- Die bisherige ordnerbasierte Bildgalerie wird im Spiel durch drei direkt wählbare Vorschaubilder ersetzt. Technische Buttons wie „Teile erzeugen“ sind für Kinder nicht nötig.
- Aufgaben, Hilfen, Einmaleins-Stapel, Zugangsprüfung und Auswertung verwenden denselben Serververtrag wie die Rechenballons. Karten und Leitner-Fächer werden nicht verändert.
- Das gewählte Bild wird als Index in der Mathematikrunde gespeichert und beim Wiederöffnen derselben Runde wiederhergestellt. Teile früherer Aufgaben werden an ihrer Zielposition rekonstruiert. Das Teil der aktuellen, bereits bearbeiteten Aufgabe wird gegebenenfalls erneut zum Einsetzen angeboten; ein eigener dauerhafter Speicher für freie Teilpositionen ist nicht erforderlich.
- Das Einsetzen ist ein lokaler Spielschritt. Die fachliche Leistungsbewertung kommt weiterhin ausschließlich aus den serverseitig geprüften Antworten.

## Start über GCS

Den aktuellen CMS-Server nach den Serveränderungen neu starten. Danach das JSON als neues Spiel hochladen, gezielt einem Haus freigeben und einem Raum zuordnen. Das Spiel muss über GCS gestartet werden, damit es seine begrenzte Launch-Berechtigung erhält. Ein reiner Editorstart besitzt diese Berechtigung nicht.

Bestehende Rechenballons-Uploads brauchen für dieses neue Spiel nicht überschrieben zu werden. Der Name der neuen Datei ist **Mathe-Rechenpuzzle.json**.

## Erzeugen und Prüfen

```powershell
node scripts/cms/cms-build-math-puzzle.cjs
node scripts/test-cms-math-puzzle-ui.cjs
node scripts/test-cms-math-upload-ui.cjs game-server/public/projects/Mathe-Rechenpuzzle.json
npm run test:math
```

Der Builder liest die vorhandene Vorlage und Bilder. Er erzeugt zusätzlich einen CommonJS-Build des vorhandenen Bildaufteilungsmodells für die Projekterzeugung. Keine neue Puzzle-Engine ist nötig.

Der Browserdurchlauf verwendet isolierte Testdaten und prüft Bildauswahl, serverseitige Aufgaben, sichtbare Antworten, Hilfen, falsche Antworten, Lösung, falschen Ablageort, echten Drag-and-drop, unterstütztes Einsetzen, gesperrtes Weiter, zehn Teile, Abschluss, Pause, Wiederöffnung und Elternübersicht. Die zusätzliche Uploadprüfung verwendet die tatsächliche CMS-Sandbox und den vollständigen Klickweg von der Anmeldung über den Raum zum Spiel.

Belege liegen in `artifacts/math-puzzle/`, unter anderem `feedback.png`, `finished.png`, `multiplication-tablet-viewport.png` und `browser-report.json`. Die Vorprüfung in einem Tablet-Browserfenster ersetzt noch keinen Durchlauf auf einem tatsächlichen Android-Gerät.

Prüfstand: Der vollständige neue Browserablauf und der zusätzliche Sandbox-Test bestehen, ebenso die Mathematiktests. Die ergänzend ausgeführten älteren Tests `tests/puzzle_neu_flow.test.ts` haben acht erfolgreiche und fünf fehlgeschlagene Prüfungen zur bisherigen Vorlage beziehungsweise ihren Geometrieannahmen. Die ursprüngliche Projektdatei und die Puzzlekomponenten wurden für diesen Auftrag nicht geändert. Der Integritätscheck des neuen Projekts meldet keine Fehler, aber zwei Warnungen zu `self.x` und `self.y`; diese Ziele werden beim Ablegen absichtlich aus dem Ereigniskontext aufgelöst und sind im Browser geprüft.
