# Die Insel der Zahlen – Finns Flussbrücke

> Aktueller Spielstand: Diese drei Lernabenteuer verwenden jetzt standardmäßig den gemeinsamen Karteikasten mit Stapel- und Leitner-Fachfiltern. Die frühere Generatorauswahl wurde ersetzt. Maßgeblich ist [Karteikasten-Abenteuer](Karteikasten-Abenteuer.md).


Stand: 16.10.2026. Erste spielbare Szene des Mathematik-Abenteuers.

## Spielablauf

Finn möchte über den Fluss nach Hause. Das Kind startet eine Runde mit zehn Aufgaben. Links stehen Aufgabe, drei Antworten, Hilfe und Lösungsanzeige; rechts liegen Wald, Fluss und Finns Haus. Nach jeder abgeschlossenen Aufgabe schwebt ein Holzteil auf die Brücke und Finn läuft ein Stück weiter. Nach dem zehnten Teil erreicht er sein Haus.

Ein einzelner Fehlversuch baut kein Teil. Nach erneutem Versuch oder angezeigter Lösung geht es trotzdem weiter. Die bestehende Mathematikauswertung unterscheidet weiterhin zwischen sofort richtig, mit Unterstützung und Lösung angesehen. Die Brücke zeigt bearbeitete Aufgaben, keine ausschließlich fehlerfreien Antworten.

Verfügbar sind die vorhandenen Profile Plus und Minus mit Zehnerübergang sowie freigegebene Einmaleins-Lückenstapel. Vorlesen, Spracheingabe, Antippen und Antwortzeit verwenden dieselben GCS-Abläufe wie die anderen Mathematikspiele. Der Timer bietet 30 Sekunden, 60 Sekunden und unbegrenzte Zeit. Spracheingabe benötigt die vorhandene Sprachkonfiguration und Browserfreigabe.

Leise Hintergrundmusik begleitet das Rechnen. Brückenbau und Abschluss haben eigene Klänge. Die Musik pausiert vor Sprachabläufen und stoppt beim Pausieren oder Beenden. Musik und Bewegung lassen sich getrennt abschalten; bereits gestartete kurze Bewegungen laufen noch aus. Musik startet nach einer Benutzeraktion. Der Schalter für Sprachausgabe steuert die Ansagen; der Musikschalter steuert die Hintergrundmusik.

## Dateien und Import

- Bearbeitbares Projekt: `game-server/public/projects/Mathe-Insel-Flussbruecke.json`.
- Empfohlenes CMS-Importpaket: `artifacts/mathe-insel/Mathe-Insel-Flussbruecke.zip`. Es enthält genau ein GCS-Projekt und alle verwendeten Medien mit relativen Pfaden.
- Alternative mit eingebetteten Medien: `artifacts/mathe-insel/Mathe-Insel-Flussbruecke-portable.json`.
- Bilder: `public/images/mathe-insel/`.
- Audios: `public/audio/mathe-insel/`.

Das ZIP über den bestehenden Spiele-Upload importieren, als Mathematikspiel führen und zunächst als Entwurf in der Vorschau prüfen. Anschließend können Veröffentlichung und Haus-/Raumfreigabe über die vorhandene Verwaltung erfolgen. Der Builder veröffentlicht nichts und verändert keine produktiven Sitzungen oder Lerndaten. Für den Einzeldatei-Import das portable JSON verwenden; das bearbeitbare JSON benötigt seine externen Medien.

Reproduzierbarer Build: `npm run build:math:island`. Browserprüfung mit temporärer Testdatenbank: `npm run test:math:island:ui`. Ein laufender produktiver CMS-Server muss dafür nicht beendet werden.

## GCS-Aufbau

Die komplette Spiellogik liegt deklarativ in Tasks, Actions und Features des Projekts. Gemeinsame Variablen sind im Blueprint hinterlegt. Die Spielstage heißt „Finns Flussbrücke“. Bestehende Komponenten übernehmen Darstellung und Verhalten:

- `TSprite`, `TImageList`, `TAnimation`: Landschaft und Finns Idle-/Laufanimation.
- `TPanel`, `move_to`, `TTimer`: zehn Brückenteile, Wolken, Wasserbewegung und Übergänge.
- `TAudio`: Musikschleife, Baugeräusch und Abschlussklang.
- Vorhandene Mathematik-HTTP-Aktionen: serverseitige Aufgaben und Antwortprüfung.
- Vorhandene Sprach- und Timer-Tasks: Vorlesen, Spracheingabe, Pause und Antwortzeit.

Es gibt keine separate HTML-Spiellogik und keine neue Engine-Komponente. Der Builder ist ein Offline-Werkzeug zum Erzeugen des editierbaren GCS-Projekts. Die Serverseite bleibt die Autorität über Aufgaben und Ergebnisse. Das Abschließen einer Aufgabe erhöht den Brückenfortschritt einmal; das Öffnen von Hilfe oder ein einzelner Fehlversuch erhöht ihn nicht.

## Heruntergeladene Medien

Alle verwendeten Medien sind als CC0 gekennzeichnet; ein Runway-Konto ist nicht erforderlich:

| Verwendung | Autor und Quelle |
| --- | --- |
| Landschaft, Bäume, Wolken, Haus, Sonne | [Kenney – Background Elements Remastered](https://kenney.nl/assets/background-elements-remastered) |
| Soundeffekte | [Kenney – Interface Sounds](https://kenney.nl/assets/interface-sounds) |
| Animierter Fuchs | [HDST – Fox Animated](https://opengameart.org/content/fox-animated) |
| Waldmusik | [beardalaxy – Iremos Forest Theme Loop](https://opengameart.org/content/iremos-forest-theme-loop) |

Die beiden Asset-Ordner enthalten `SOURCES.json` mit Quelldateien, Autoren, Lizenz und SHA-256-Prüfsummen sowie Lizenznachweise. Zur Laufzeit werden die heruntergeladenen Dateien lokal aus dem Spielpaket geladen. Es werden keine externen Medienkonten benötigt.

## Prüfungen und Grenzen

Der eigene Browsertest verwendet den echten CMS-Server, das ZIP mit separaten Medien, den produktiven Spielhost und dessen Upload-Sandbox. Er prüft Aufgaben und Antworten, fehlenden Fortschritt bei Fehlversuch, Hilfe, Lösungsanzeige, Pause/Fortsetzen, zehn Brückenteile, Finns Position, Spriteanimation und Sitzungsabschluss. Screenshots und Ergebnis liegen in `artifacts/mathe-insel/`.

Die automatische Audioprüfung bestätigt die erfolgreiche Wiedergabe im Browser. Eine subjektive Hörprobe für Lautstärke und Mischung bleibt sinnvoll. Die erste Szene ist vollständig spielbar; zusätzliche Kapitel, ein zusammenhängender Erzählbogen und weitere Figuren sind spätere Erweiterungen.

Allgemeine Regression: Der Schnelllauf meldet 387/390 erfolgreiche Prüfungen. Zwei bestehende Export-Prüfsummen und eine CMS-Integritätssuite sind offen. Der zusätzliche vollständige Lauf wurde nach wiederholten unabhängigen Editor-Timeouts beendet; er ist nicht vollständig bestanden. Details stehen in `docs/QA_Report.md` und den Regressionsprotokollen.
