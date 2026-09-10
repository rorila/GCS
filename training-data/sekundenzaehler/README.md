# SekundenZähler – überarbeiteter Test
12 Beispiele mit einheitlicher API: createLabel, createTimer, createTask, addAction, connectEvent.
Die vorherige Fassung liegt im Unterordner vorher-*; Adapter und Modell wurden nicht verändert.

1. sekundenzaehler-training.jsonl im Dateiauswahldialog erneut auswählen.
2. sekundenzaehler-pruefauftrag.txt unverändert in das Prüffragenfeld kopieren. Dieser bisher verwendete Auftrag ist ein Regressionstest, kein neuer unabhängiger Test.
3. Zunächst 24 Schritte einstellen (zwei Durchgänge über 12 Beispiele), Beispiele prüfen und freigeben.
4. Vorher/Nachher mit sekundenzaehler-erwartet.js vergleichen. Korrekte semantische Varianten sind erlaubt.

Abnahme: zwei Objekte, Label beginnt bei 0; Timer interval=1000, maxInterval=10, currentInterval=0, enabled=true; Task SekundenZähler enthält genau Act_IncLabel vom Typ increment mit changes {'SekundenLabel.text':1}; connectEvent verbindet Timer/onTimer mit dem bereits angelegten Task. Keine neue Stage und keine erfundenen API-Methoden.

Noch kein automatischer Laufzeittest oder Import. Der Startadapter stammt weiterhin aus settings.json; vorherige Trainingsjobs werden nicht automatisch fortgesetzt. 24 Schritte sind ein begrenzter Versuch, keine Erfolgsgarantie.
