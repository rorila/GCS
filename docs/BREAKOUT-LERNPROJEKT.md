> Aktuelle Version: Objektliste mit gemeinsamer Stein-Logik. Details in [BREAKOUT-OBJEKTLISTE.md](BREAKOUT-OBJEKTLISTE.md). Aktuelle Version: 30 Tasks, 34 Actions, 17 Trainingsbeispiele.

# NEON / BREAK – Breakout-Lernprojekt

## Spielen und im Editor lernen

Bei laufender V2: **http://localhost:5173/breakout.html** öffnet die spielbare Vorschau.
Im GCS-Editor das Projekt **Breakout-Lernprojekt.json** aus `game-server/public/projects` öffnen. V1 und bestehende Spiele wurden nicht geändert.

- Leertaste oder START / BALL: Aufschlag. Nach dem Spielende wird zunächst ein neuer Ball bereitgelegt.
- Pfeile links/rechts: Schläger bewegen. Bildschirmtasten verschieben ihn um drei Rasterzellen pro Klick.
- P oder PAUSE: pausieren/fortsetzen. NEUSTART setzt alle Spielwerte zurück.
- 40 Steine, 5 Reihen. Von oben nach unten: 50/40/30/20/10 Punkte. Maximal 1200 Punkte.
- Drei Leben. Nach Ballverlust startet der nächste Ball erst auf ausdrücklichen Start.
- Am Schlägerrand wird der Ball stärker seitlich abgelenkt; in der Mitte fliegt er steiler.

## Architektur zum Nachvollziehen

Das Spiel verwendet native GCS-Komponenten und Actions, keinen eingebetteten JavaScript-Spielmotor.
Blueprint: TGameLoop (60 FPS, bounce, oberer/unterer Abstand 5), TGameState, TInputController sowie Reststeine/Links/Rechts als globale Ganzzahlen.
Spielfeld: Ball, Schläger und 40 Steine als TSprite, Textanzeigen als TLabel, fünf TButton und zwei dekorative TPanel.

Sechs Features sind mit User Stories und Abnahmekriterien in GCS hinterlegt: Aufbau, Steuerung, Physik, Punkte, Leben und Ablauf.

Wichtige Task-Ketten:
1. Tastatur.onKeyDown_ArrowRight → RechtsDruecken → RichtungAktualisieren → Schlaeger.velocityX.
2. Ball.onCollision → BallKontakt → SchlaegerKontakt oder SteinReflexion.
3. Stein.onCollision → SteinTreffer → SteinPruefen → SteinWerten → Record markieren, self ausblenden, Punkte aus dem Record übernehmen, Reststeine per record_count ermitteln → ggf. Sieg.
4. Ball.onBoundaryHit → Wandkontakt → LebenVerlieren → VerlustAktiv → EndePruefen → BallBereit/Niederlage.
5. PauseWechsel → Pausieren/Fortsetzen. NeuesSpiel stellt Steine und Startwerte wieder her.

Es gibt 30 Tasks. Die TObjectList Steine verwaltet 40 Mitglieder mit zerstoert und punkte. Drei gemeinsame Treffer-Tasks sowie record_reset und foreach ersetzen die steinspezifische Logik. Die Flow-Darstellungen werden im Editor aus den Sequenzen erzeugt.

## Trainingsdateien

Unter `training-data/breakout`:
- breakout-gesamt.jsonl: alle 17 Beispiele.
- komponenten.jsonl, steuerung.jsonl, ablauf.jsonl, punkte.jsonl: dieselben Beispiele nach Thema getrennt.
- pruefauftraege.txt: vier separate Prüfaufträge, eine Zeile pro Auftrag.

Entweder die Gesamtdatei oder eine Themendatei wählen; nicht zusätzlich zusammenfügen, sonst entstehen Duplikate. Beispiele enthalten jeweils eine kleine API-Aufgabe und eine Antwort. Benötigte bestehende Tasks/Objekte werden im Auftrag genannt. Die Dateien sind keine kompletten, einzeln importierbaren Spielprojekte.

Für den ersten Versuch die Gesamtdatei wählen, die vier Prüfaufträge kopieren und **17 Schritte** einstellen. Es wird ein Durchgang trainiert, keine Qualitätsgarantie. Der Startadapter kommt weiterhin aus der lokalen settings.json; frühere Jobs werden nicht automatisch übernommen. Kein Training wurde während der Breakout-Erstellung gestartet.

Die Prüfaufträge verlangen record_get, record_count, record_reset und gemeinsame Event-Verknüpfungen. Sinngleiche korrekte API-Aufrufe akzeptieren. Dies prüft kleine Übertragungen und belegt noch keine allgemeine Spielerzeugung.

## Prüfung und Grenzen

Die echte GCS-Runtime wurde im Edge-Browser geprüft: Tastaturstart und Bewegung, Pause, physische Stein-/Schläger-/Wandkollision, Doppelwertungsschutz, drei Lebensverluste, Niederlage, Reset und Sieg mit 1200 Punkten. Für den Siegpfad wurden die übrigen Treffer gezielt als Events eingespeist; kein komplettes Match wurde autonom durchgespielt. Siehe `docs/breakout-test.json` und die Screenshots.

Ein Level, keine Sounds, Power-ups oder dauerhafte Highscore-Speicherung. Die Bildschirmtasten sind Klicksteuerung, kein kontinuierliches Touch-Joystick-System.

## Reproduzieren

- `node node_modules/tsx/dist/cli.mjs scripts/build-breakout.ts`: erzeugt ein neues Projekt, verweigert vorhandene Datei.
- `--replace-generated`: ersetzt ausdrücklich das generierte Breakout; vorher eigene Änderungen sichern!
- `node scripts/test-breakout.cjs`: isolierte Runtime-Prüfung auf Port 15175.
- `npm run test`: gesamte bestehende GCS-Regression.

Die Vorschau verwendet `public/runtime-standalone.js`. Der Generator setzt eindeutige IDs und legt globale Variablen in die Blueprint-Stage. Änderungen am Spiel deshalb vorzugsweise über den Generator oder regulär über GCS durchführen.
