# UseCase SekundenZähler – Trainings- und Prüfdateien

Ziel: Das Modell erzeugt AgentController-Aufrufe für genau zwei Objekte, einen Task und eine Action. Das ist eine Codegenerierungsaufgabe; kein direkt importierbares Spielprojekt oder gespeicherter User-Story-Datensatz.

## Anwendung
1. sekundenzaehler-training.jsonl auswählen (8 Beispiele mit verschiedenen Intervallen, Grenzen und Namen).
2. Inhalt von sekundenzaehler-pruefauftrag.txt ins Prüffragenfeld kopieren (eine lange Zeile).
3. Zunächst 8 Trainingsschritte, also einmal jedes Beispiel; Beispiele prüfen, freigeben, starten.
4. Vorher/Nachher mit sekundenzaehler-erwartet.js vergleichen. Semantisch gleichwertige Ausgabe akzeptieren, keine reine Textgleichheit verlangen.

Die Kombination 1000 ms / 10 Takte / SekundenZähler / Act_IncLabel bleibt dem Prüfauftrag vorbehalten. Acht nahe verwandte Beispiele sind ein begrenztes Experiment, kein Nachweis allgemeiner Spielerzeugung. Kein neuer Trainingslauf wurde gestartet.

## Abnahmekriterien
- Genau TTimer SekundenTimer und TLabel SekundenLabel, Label startet bei 0.
- Timer: interval=1000, maxInterval=10, currentInterval=0, enabled=true.
- Task SekundenZähler, genau eine increment-Action Act_IncLabel mit changes {'SekundenLabel.text':1}.
- Timer onTimer ist mit dem Task verbunden; das Event gehört an den Timer, nicht an die Action.
- Laufzeit: nach dem n-ten Takt zeigt das Label n, nach dem zehnten 10. Ein weiterer Zeitabschnitt darf den Wert nicht erhöhen. Zeitmessung mit Toleranz; Browser-Timer sind nicht echtzeitfähig.
- Quelltextbelege: src/components/TTimer.ts, src/runtime/actions/handlers/CalculateActions.ts (increment), src/services/AgentController.ts.

## Grenzen der aktuellen Trainingsoberfläche
Die Vorher-/Nachher-Generierung wurde für diese Codeantworten von 128 auf 512 neue Tokens erweitert. Automatische Ausführung und Laufzeit-Abnahme sind noch nicht angeschlossen. Die Referenz wurde anhand der API und des Handlers erstellt, hier noch nicht im Spiel ausgeführt. Voraussetzung ist eine leere vorhandene Stage stage_main; nicht blind in ein belegtes Projekt ausführen.
