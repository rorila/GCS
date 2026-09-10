# Timer-Lernexperiment

14 Beispiele: 12 Timer-Beispiele aus src/components/TTimer.ts und zwei Wiederholungsbeispiele zum Erhalt bisheriger Fähigkeiten. Keine vollständigen importierbaren Spielprojekte und kein automatischer Runtime-Test.

1. timer-training.jsonl in der Wissensbasis auswählen und prüfen.
2. Den Inhalt von timer-prueffragen.txt in das Feld für separate Prüffragen kopieren.
3. Für einen ersten Durchgang 14 Schritte einstellen: Damit wird jedes Beispiel einmal verwendet. Mehr Schritte garantieren kein besseres Ergebnis.
4. Freigeben, starten und Vorher/Nachher vergleichen. Kein Lernerfolg allein aus sinkendem Loss ableiten.

Erwartungen (nicht in das Prüffragenfeld kopieren):
- Frage 1: interval=2000, enabled=true, maxInterval=4, currentInterval=0; viermal onTimer, danach onMaxIntervalReached und Stopp.
- Frage 2: Nein. 250 ist das Zeitintervall in Millisekunden; maxInterval=0 begrenzt die Taktanzahl nicht.
- Frage 3: currentInterval erreicht die positive maxInterval-Grenze; onMaxIntervalReached folgt auf das letzte onTimer und der Timer stoppt.
- Frage 4: Rolf Rieckmann.

Die Fragen stehen nicht wortgleich in den Trainingsbeispielen. Sie prüfen Regelanwendung; vier Fragen sind kein umfassender Qualitätsnachweis. Der aktuelle Startadapter wird durch settings.json festgelegt. Ein neuer Lauf übernimmt vorherige Trainingsjobs noch nicht automatisch. Das aktive Ollama-Modell wird weiterhin erst durch einen späteren Export aktualisiert.
