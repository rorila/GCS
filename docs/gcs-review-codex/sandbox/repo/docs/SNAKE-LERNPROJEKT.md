# Snake als GCS-Lernprojekt

Start: `/snake.html`; im Editor `Snake-Lernprojekt.json` aus den Projekten laden. Pfeiltasten oder WASD steuern, Leertaste startet, P pausiert. Bildschirmtasten und Neustart sind vorhanden.

## Aufbau

Das Spiel besteht aus nativen GCS-Komponenten, 45 Tasks, 67 Actions und sechs Features mit User Stories. Es gibt keine zusätzliche JavaScript-Spielengine. Der Generator `scripts/build-snake.ts` verwendet den AgentController. Seine erneute Ausführung mit `--replace-generated` überschreibt das generierte Snake-Projekt und dessen Vorschau; vorher eigene Änderungen sichern.

`Schlange` ist eine TObjectList mit einem Pool von 192 Segment-IDs. Nur die ersten `Laenge` Einträge sind aktiv. Record-Felder `spalte` und `zeile` speichern die logischen Positionen; daraus werden Sprite-Koordinaten berechnet. Anfangslänge: vier. Das Spielfeld hat 16 × 12 Zellen.

`Takt.onTimer` ruft `Ticken` auf. `Schritt` berechnet den nächsten Kopf und prüft Kollisionen. `SchiebeSegment` trägt die alte Vorgängerposition durch die geordnete Liste. Bei Futter wächst die aktive Länge um eins und Score um zehn. Das frei werdende Schwanzfeld darf betreten werden, sofern die Schlange nicht wächst.

Eine Belegungsliste ermöglicht die Futterplatzierung: Ab einem zufälligen Startindex werden höchstens 192 Zellen geprüft. Die Auswahl ist nicht gleichverteilt über freie Felder. Ein vollständig belegtes Feld ergibt einen Sieg. Richtungswechsel sind auf einen je Takt begrenzt; direktes Umkehren ist gesperrt.

Der Timer pausiert während der asynchronen Task-Verarbeitung. Das Intervall beträgt 180 ms zuzüglich Verarbeitungszeit. Das schützt vor überlappenden Schritten; große Schlangen können langsamer werden. Die Task-Aufrufkette bleibt innerhalb der bestehenden GCS-Tiefengrenze. Pause erhält den Zustand, Neustart stellt vier Segmente und null Punkte her.

## Prüfung und Lernen

17 gezielte Prüfungen in der echten Browser-Runtime: Bewegung, Tastatur, automatischer Timer, Umkehrschutz, Pause, Wachstum, vollständige Belegungskarte, freie Futterzelle, Reset, Wand, Selbstkollision, erlaubtes Schwanzfeld und Sieg. Grenzfälle nutzen kontrollierte Ausgangszustände; kein vollständig autonom gespieltes Match. Bericht: `docs/snake-test.json`.

Die zwölf Trainingsbeispiele und fünf separat formulierten Prüffragen liegen in `training-data/snake`. Sie lehren einzelne API-Bausteine. Ein vollständiges Spiel aus einer freien Beschreibung bleibt ein separates Lernziel.
