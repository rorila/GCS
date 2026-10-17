# Sprache und Antwortzeit für Rechenballons und Rechenpuzzle

> Aktueller Spielstand: Diese drei Lernabenteuer verwenden jetzt standardmäßig den gemeinsamen Karteikasten mit Stapel- und Leitner-Fachfiltern. Die frühere Generatorauswahl wurde ersetzt. Maßgeblich ist [Karteikasten-Abenteuer](Karteikasten-Abenteuer.md).


Beide Spielprojekte enthalten jetzt dieselbe deklarative Erweiterung aus `scripts/cms/cms-math-voice-timer.cjs`. Sie verwendet die bereits im Karteikasten-Quiz vorhandenen Komponenten `TTextToSpeech` und `TSpeechRecognition` sowie den CMS-Spielhost. Ein zweites Sprachsystem wird nicht angelegt.

## Bedienung

- Aufgaben werden standardmäßig vorgelesen. „Ton aus“ schaltet dies ab und gibt bei einer laufenden Ansage die Antwortflächen frei.
- Über „Antworten“ mit dem Mikrofonsymbol wird das Mikrofon im Spielhost freigegeben. Die Aufnahme beginnt nach der Ansage. Anschließend werden neue Aufgaben nach dem Vorlesen ebenfalls zur Spracheingabe angeboten.
- „Antippen“ beendet die Aufnahme. Die drei Antwortflächen bleiben als Alternative verfügbar.
- Unverständliche Sprache und Mikrofonfehler buchen keinen Fehlversuch. Das Kind kann erneut das Mikrofon wählen oder eine Zahl antippen.
- Zahlenwörter werden mit derselben deutschen Zahlenerkennung wie im Quiz verarbeitet. Der Server prüft die erkannte Zahl gegen die mathematische Lösung. Bei Spracheingabe sind auch Zahlen außerhalb der drei angebotenen Alternativen zulässig; falsche Zahlen zählen als Fehlversuch.

## Antwortzeit

Vor dem Start lässt sich die Zeitlimit-Schaltfläche zwischen **30 Sekunden**, **60 Sekunden** und **ohne Limit** umschalten. Während der Runde bleibt die Auswahl fest. Ein sichtbares Label zeigt die verbleibenden Sekunden.

Der Countdown beginnt nach dem Vorlesen der Aufgabe. Er pausiert bei einer Ansage, beim Vorlesen einer Hilfe, bei der Mikrofonfreigabe, während einer Serveranfrage und bei einer Spielpause. Ein Fehlversuch beziehungsweise eine Hilfe setzt die verbleibende Zeit nicht zurück. Das Einsetzen eines Puzzleteils hat kein Zeitlimit.

Nach Ablauf wird die Aufnahme abgebrochen und der Lösungsweg eingeblendet. Die Aufgabe zählt als **Lösung gezeigt**, zusätzlich wird `timedOut` gespeichert. Es wird weder eine richtige Antwort noch ein zusätzlicher falscher Antwortversuch gebucht. Im Puzzle wird das Teil anschließend wie nach einer angezeigten Lösung freigegeben.

Der Countdown ist eine Bedienungsfunktion im Browser, keine manipulationssichere Prüfungsfrist. Bei vollständigem Neuladen beginnt die Antwortzeit für die aktuelle Aufgabe erneut; eine normale Pause/Fortsetzung erhält den Restwert. Bestehende Punkte- und Leitner-Regeln werden nicht verändert.

## Speicherung und Auslieferung

Die Projektbuilder erzeugen die Erweiterung reproduzierbar. Die zusätzlichen Serveroperationen heißen `mathSpeechAnswer` und `mathTimeout` und werden über die bestehenden Launch-Berechtigungen angesprochen. Doppelte Anfragen, bereits abgeschlossene Aufgaben und verspätete Antworten werden weiterhin abgefangen. Die Antwortprüfung und die Timeout-Buchung erfolgen auf dem Server.

Der bereits vorhandene Upload **MatheBallons** wurde vor der Erweiterung als `.before-voice-timer-…bak` gesichert und direkt um die neuen Komponenten und Tasks ergänzt. Das Rechenpuzzle-Projekt liegt aktualisiert unter `game-server/public/projects/Mathe-Rechenpuzzle.json`. Neue Freigaben oder Veröffentlichungen wurden nicht angelegt.

Nach den Serveränderungen den CMS-Server vollständig neu starten und die Browserseite neu laden. Die Spracheingabe benötigt den Start über den CMS-Spielhost und eine Mikrofonfreigabe; ein direkter Editorstart hat diese Berechtigung nicht.

## Prüfstand

`npm run test:math` prüft unter anderem unverständliche Eingaben, gültige gesprochene Zahlen, falsche Antworten außerhalb der Auswahl, Timeout-Buchung und Wiederholungen. `npm run test:math:voice:ui` verwendet den echten Browser, die echte Runtime und einen isolierten CMS-Server mit kontrollierten Sprachadaptern. Geprüft werden Ansage vor Aufnahme, Hilfen, verbleibende Zeit, Sprachantwort, Timeout, Pause, Audio-/Mikrofonfehler, Antipp-Alternative und verspätete Ereignisse. Auch die Zeitlimit-Auswahl und der Betrieb ohne Countdown werden geprüft.

Die Sprachadapter sind in diesem automatisierten Test simuliert. Die tatsächliche Mikrofonaufnahme und die Erkennungsqualität mit Kinderstimmen müssen am Zielgerät ausprobiert werden. Die vorhandenen CMS-Sprachdienste und ihre Berechtigungen werden unverändert wiederverwendet.

Browserbelege liegen unter `artifacts/math-voice/`.
