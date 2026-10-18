# Aufgabenbereich · Bedienung und Umsetzungsstand

Stand: 17.10.2026

## Eigenständiges Projekt

`game-server/public/projects/Aufgabenbereich-Karteikasten.json` enthält links den Aufgabenbereich und rechts eine einfache Event-Testspielwelt. Turmbau, Flussbrücke und Puzzle werden durch dieses Projekt nicht umgebaut.

Die Planung steht in [Aufgabenbereich-Plan-und-Eventvertrag.md](Aufgabenbereich-Plan-und-Eventvertrag.md). Dieses Dokument beschreibt den tatsächlich implementierten ersten Stand.

## Start und Bedienung

1. Das Projekt als eigenen Entwurf öffnen beziehungsweise das ZIP als neues GCS-Spiel hochladen.
2. Für einen echten Kindertest gelten die üblichen Spiel-, Haus- und Raumfreigaben. Das Kind benötigt eigene beziehungsweise zugeordnete und freigegebene Karten.
3. Oben den ganzen Karteikasten oder einen einzelnen Stapel wählen. Zusätzlich kann ein Leitner-Fach gewählt werden.
4. Rechts per Button zwischen „Computer-Reaktion“ und „User-Interaktion“ wechseln. Standard ist Computer-Reaktion. Der Modus gilt für alle drei Antwortereignisse und wird gespeichert; ein Wechsel gilt ab dem nächsten Event. Bereits offene Interaktionen bleiben bestätigungspflichtig.
5. „Starten / Fortsetzen“ öffnet die erste Papierkarte und liest die Aufgabe vor.
6. Antworten antippen, bei freien Textkarten eingeben oder „Sprache“ aktivieren. „Maus / Touch“ beendet die Spracheingabe wieder.
7. „Noch einmal vorlesen“ wiederholt die sichtbare Frage beziehungsweise Fehlerlösung. „Ton aus“ schaltet das automatische Vorlesen aus; manuelles Wiederholen bleibt möglich.

Die gemeinsame Hülle unterstützt Bilderzählkarten und gewöhnliche Rechen-/Textkarten. Karten mit drei geeigneten Auswahlantworten bekommen drei Buttons; andere gewöhnliche Karten verwenden ein Textfeld. Die Bilder sind Assets des GCS-Pakets. Fehlende Bilder sperren die Antwortbedienung, statt eine unlösbare leere Zählaufgabe zu bewerten.

Die drei unteren Kartenlabels zeigen Stapelname, Stapelart beziehungsweise Fach und Stapelersteller. Das Papierlayout ist dem vorhandenen Karteikasten-Quiz entnommen.

## Bewertungsablauf

### Richtige Antwort

Der Server prüft und speichert die Antwort und den Leitner-Wechsel genau einmal. Anschließend wird `AntwortRichtig` an den Testempfänger übergeben. Im Animationsmodus erscheint unmittelbar die nächste Karte. Es gibt keine zusätzliche Erfolgsseite und keinen Weiter-Button.

### Falsche Antwort

Die Karte wird sofort serverseitig auf Fach 1 gesetzt. `AntwortFalsch` geht an den Empfänger. Die Papierkarte dreht sich mit einer ungefähr 1.100 ms langen Animation; auf der Rückseite steht die richtige Lösung. Diese wird vorgelesen.

Automatisch weiter geht es erst, wenn die Lesezeit und die Vorlesephase beendet sind. Bei ausgeschaltetem Ton beziehungsweise einem Audiofehler genügt die Lesezeit. Die Lösung kann erneut vorgelesen werden, wodurch sich der Wechsel entsprechend verschiebt.

Die falsche Karte wird nach zwei anderen bewerteten Karten bevorzugt erneut gezogen. Ist sie die einzige verfügbare Karte, kommt sie unmittelbar nach der Lösungsphase wieder. Jede pädagogische erneute Vorlage erhält eine neue Versuchskennung und kann einen neuen Leitner-Wechsel auslösen. Ein technischer Retry derselben Anfrage tut das nicht.

Die Sitzung ist fortlaufend, nicht auf zehn verschiedene Karten begrenzt. Sie wird mit „Beenden“ abgeschlossen. Bereits gelernte Karten in Fach 6 werden nicht erneut aus der normalen Auswahl gezogen.

### Nicht verstandene Sprache

Eine fehlende oder nicht eindeutig zuordenbare Sprachantwort erzeugt `AntwortNichtVerstanden`. Fach und Antwortzähler ändern sich nicht; die gleiche Karte bleibt offen. Das Kind kann erneut Sprache aktivieren oder antippen. Ein technischer Mikrofonfehler wird als Eingabeproblem gemeldet und nicht als falsche Antwort verbucht.

## Event-Testempfänger

Das rechte Label zeigt das zuletzt **tatsächlich empfangene** Event, beispielsweise:

```text
AntwortFalsch
Richtig: 3
Falsch: 1
```

Das Label wird vom Empfangs-Task aktualisiert, nicht vom Bewertungs-Task. Beim Neuladen kann der zuletzt vom Server bestätigte Empfang wiederhergestellt werden. „Empfänger trennen“ unterbricht die Übergabe testweise: Eine Antwort wird weiterhin sicher gebucht, aber das Empfangslabel behauptet keinen neuen Empfang. Nach dem Wiederverbinden wird derselbe Vorgang zugestellt, ohne die Antwort erneut zu buchen.

### Interaktion simulieren

Bei „Interaktion“ bleibt der Aufgabenbereich nach dem betreffenden Ereignis gesperrt. Rechts erscheint **„Interaktion beenden“**. Dieser Testbutton sendet die Kennung des ausstehenden Ereignisses zurück.

- Richtig: Danach erscheint die nächste Karte.
- Falsch: Nächste Karte erst nach Abschluss sowohl der Lösung als auch der simulierten Interaktion. Die Reihenfolge ist beliebig.
- Nicht verstanden: Danach wird dieselbe Karte wieder freigegeben.

Die Rückmeldung wird exakt dem ausstehenden Ereignis zugeordnet. Alte, fremde und doppelte Freigaben schalten keine spätere Karte weiter.

Beim Beenden wird zusätzlich `RundeBeendet` zugestellt. Dieses Ereignis zählt nicht als richtige Antwort.

## Filter, Pause und Wiederaufnahme

Die Standards sind „Gesamter Karteikasten“ und Lernfächer 1–5. Das Stapeldropdown ist zunächst eine Einzelauswahl. Eine Filteränderung während einer bereits bewerteten Karte oder ausstehenden Interaktion wird für danach vorgemerkt. Fach- und Stapelwechsel setzen die Sitzungszähler nicht zurück.

Pause stoppt Vorlesen und Mikrofon. Fortsetzen stellt denselben Kartenversuch wieder her. Eine Fehlerlösung kann dabei erneut vorgelesen werden. Auch nach einem Neuladen bleibt eine offene Interaktionssperre erhalten, ohne doppelte Lernbuchung.

Es gibt verständliche Meldungen für leere Lernfächer, vollständig gelernte Auswahl, nicht unterstützte Karten und noch nicht veröffentlichte zugeordnete Stapel. Die bisherige Veröffentlichungspolitik wird nicht verändert.

## Technischer Aufbau

- `scripts/cms/cms-build-task-area.cjs`: erzeugt das editierbare GCS-Projekt aus normalen Komponenten, Aktionen und Tasks.
- `scripts/cms/cms-task-events.cjs`: eigenständiger, versionierter Aufgabenvertrag, serverseitige Wiederholungswarteschlange, Ergebnisereignisse und Rückkanal.
- `playSessions.taskArea`: Zustand dieser fortlaufenden Sitzung; bestehende `mathRound`-Verträge bleiben getrennt.
- `cms-card-points.cjs`: wiederverwendete Leitner- und Lernpunktebuchung.
- `TSprite.onImageReady` / `onImageError`: Bildbereitschaft für die neue Aufgabenbedienung; andere Sprites ohne diese Handler bleiben unverändert.

Der neue Vertrag wird über den vorhandenen, autorisierten CMS-Spielkanal mit Profil `task-area-v1` und expliziten Befehlen übertragen. Er verwendet Sitzungskennung, Versuchskennung, Ereigniskennung, Revisionsschutz und idempotente Befehlskennungen. Die Zustellung kann wiederholt werden; ihre fachliche Wirkung wird dedupliziert. Die Sitzung ist auch im SQLite-Store speicher- und wiederherstellbar.

Die Gegenstelle erhält den versionierten Ergebnisumschlag ohne Frage, Musterlösung, Roh-Audio oder Kinderklarnamen. Die rechte Fläche bleibt ein lokaler Diagnoseempfänger. Eine spätere echte Spielwelt muss über denselben Adapter angeschlossen und zusätzlich abgenommen werden.

## Dateien und Befehle

```powershell
npm run build:task-area
npm run test:task-area
npm run test:task-area:ui
node scripts/install-task-area.cjs --apply
```

Der Installer registriert ausschließlich einen neuen Entwurf „Aufgabenbereich · Karteikasten“ beim SuperAdmin, mit Store-Backup und ohne Hausfreigaben. Die Datenbank darf dafür nicht von einem zweiten CMS-Prozess geöffnet sein. Wird das ZIP über die normale Spieleverwaltung hochgeladen, ist dieser lokale Installer nicht zusätzlich erforderlich.

Pakete liegen in `artifacts/task-area/`:

- `Aufgabenbereich-Karteikasten.zip` mit separaten Bilddateien.
- `Aufgabenbereich-Karteikasten-portable.json` mit eingebetteten Bildern.
- Desktop-/Tablet-Screenshots und `browser-report.json`.

Der CMS muss nach Aktualisierung des serverseitigen Aufgabenvertrags neu gestartet werden. Für Änderungen am Runtime-Bundle ist die Spielseite neu zu laden.

## Geprüft und bewusst begrenzt

Geprüft werden gemischte Bilder-/Einmaleinskarten, echte Bilder aus dem ZIP, Flip und Lösungsanzeige, automatischer Übergang, schnelle Wiederholung, tatsächlich empfangenes Event, Trennung und Wiederverbindung, Spracheingabe mit kontrolliertem Adapter, Nichtverstehen, Pause/Fortsetzen, Interaktionsfreigabe und Neuladen ohne Doppelbuchung. Modulprüfungen sichern zusätzlich Filter, Rechte, Wiederholungsbelege und SQLite-Wiederaufnahme ab.

Die Sprachtests prüfen den Ablauf mit einem kontrollierten Adapter, keine reale Mikrofon- oder Lautsprecherhardware. Die Testspielwelt zeigt Events ohne grafische Fortschrittsanimation. Ein Antwortzeitlimit ist nicht aktiviert. Selbsteinschätzung ist noch kein abgenommener Aufgabentyp dieses neuen Ablaufs und wird transparent ausgelassen. Ein grafischer Editor für neue Bildkarten-Präsentationsdaten gehört ebenfalls nicht zu diesem Bauschritt.
