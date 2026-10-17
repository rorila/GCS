# Aufgabenbereich und Spielwelt · Bilder zählen

## Vereinbartes Prinzip

Links liegt der **Aufgabenbereich**. Der Aufgabentyp der Karte bestimmt seine Darstellung. Rechts liegt die **Spielwelt**. Sie reagiert auf Ergebnisse; ein Wechsel der Karte oder ihres Layouts setzt den Spielfortschritt nicht zurück.

Der Karteikasten des Kindes bleibt die Standardquelle. Zugeordnete Stapel und Leitner-Fächer 1–5 lassen sich vor einer Runde filtern. Ein Spiel erzeugt keine Ersatzkarten, wenn die Auswahl leer ist. Fach 6 bleibt die Ablage gelernter Karten.

## Erstes Lernziel und Stapel

Katalogeintrag `by.gs.math.12.area.1.1`: „Zahlen darstellen und vergleichen“, Bayern, Grundschule 1/2. Die erste Umsetzung deckt **Anzahlen erfassen und Zahlen zuordnen von 1 bis 10** ab. Vergleichen, Zerlegen und der weitere Zahlenraum bis 100 sind damit noch nicht abgedeckt. Der Katalog zeigt die Teilabdeckung, die Stapelnamen und das Spielprojekt an. Der pädagogische Prüfstatus bleibt offen.

| Stapel | Karten | Inhalt |
| --- | ---: | --- |
| Anzahlen 1–5 | 10 | Je zwei unterschiedliche Tiermotive für jede Anzahl 1–5 |
| Anzahlen 5–10 | 12 | Je zwei unterschiedliche Tiermotive für jede Anzahl 5–10 |

Die 5 ist absichtlich in beiden Stapeln enthalten. Erstellerin ist Wiebke. Jede Karte enthält eine richtige und zwei verschiedene falsche Antworten aus dem jeweiligen Zahlenbereich. Die Position der richtigen Antwort wird durch die vorhandene Antwortauswahl gemischt.

Die Stapel werden als Entwürfe angelegt. Wiebke kann sie im vorhandenen Stapelbereich prüfen, veröffentlichen und Kindern zuordnen. Zuordnung kopiert die Karten samt Aufgabentyp und Bilddaten in Fach 1; vorhandene fremde oder nicht zugeordnete Stapel werden nicht automatisch freigegeben.

## Versionierter Karteninhalt

```json
{
  "question": "Wie viele Füchse siehst du?",
  "answers": ["4"],
  "wrongAnswers": ["3", "5"],
  "answerFormat": "text",
  "taskType": "count-images",
  "presentation": { "version": 1, "assetId": "fox", "count": 4, "layoutSeed": 8 },
  "objectiveIds": ["by.gs.math.12.area.1.1"]
}
```

`taskType` und `presentation` gehören zur Karte, nicht zum Spiel. Ein Stapel kann die Typen seiner Karten ausweisen. Karten ohne diese Erweiterung behalten die gewöhnliche Frage-/Antwortdarstellung. Das `layoutSeed` ist für spätere Anordnungsvarianten reserviert; zunächst ist die Anordnung bewusst ruhig in zwei Reihen mit höchstens fünf Bildern.

Bildquellen werden über eine lokale Positivliste aufgelöst. Die Anzahl ist auf 1–10 begrenzt; die korrekte Antwort muss ihr entsprechen. Importieren, Zuordnen und „Thema als Stapel teilen“ erhalten die Metadaten. Die bisherige Textbearbeitung verhindert widersprüchliche Lösungen zu einer bestehenden Bilderzählkarte. Eine grafische Bearbeitung der neuen Präsentationsdaten im Karteneditor ist noch nicht Teil dieser Umsetzung.

## Aufgabenbereich

`cms-task-layout.cjs` erzeugt ausschließlich normale GCS-Komponenten und deklarative Aktionen/Tasks. Der Renderer zeigt bei `count-images` die passende Anzahl Tiere und genau drei Zahlen an. Andere Karten verwenden weiterhin Textantwort oder Selbstbewertung, sofern sie keine drei Auswahlantworten besitzen.

Die Frage wird mit dem vorhandenen `TTextToSpeech` vorgelesen. „Noch einmal vorlesen“ wiederholt sie; währenddessen pausieren Antwortzeit und Eingabe. Bei einem Audiofehler bleibt die Aufgabe bedienbar. Für den Turmbau ist standardmäßig kein Zeitlimit gesetzt; die vorhandene Zeitwahl erlaubt 30 oder 60 Sekunden. Spracheingabe und Antippen bleiben verfügbar.

Dasselbe Aufgabenlayout ist in Rechenballons, Rechenpuzzle und Flussbrücke eingebunden. Das Karteikasten-Quiz stellt die neuen Bilder innerhalb seiner bestehenden Papierkarte dar und blendet sie beim Umdrehen aus.

## Spielwelt: Turmbau

Projekt: `game-server/public/projects/Mathe-Zaehlen-Turmbau.json`.

Der Server liefert zusätzlich einen aufgabenunabhängigen Fortschrittsvertrag:

```json
{ "gameProgress": { "version": 1, "units": 3, "total": 10 } }
```

Die Turm-Tasks lesen ausschließlich diesen Fortschritt. Sie kennen weder Tiermotiv, Bildanzahl, Antwortzahl noch Aufgabentyp. Pro richtig gelöster Karte erscheint ein animierter Baustein mit Baulaut. Ein falscher Versuch, eine angezeigte Lösung oder ein Zeitablauf fügt keinen Stein hinzu und entfernt keinen vorhandenen Stein. „Bewegung aus“ zeigt Steine unmittelbar an.

Der Fortschritt wird aus den gespeicherten Rundenergebnissen rekonstruiert und bleibt bei Layoutwechsel, Pause und Neuladen erhalten. Runden enthalten höchstens zehn Karten. Kürzere Runden haben entsprechend weniger Bausteine; es werden keine erfundenen Lernerfolge ergänzt. Eine abgeschlossene Runde mit angesehenen Lösungen muss keinen vollständigen Turm ergeben.

Leitner wird unverändert einmal je Kartenversuch gebucht: erste richtige Antwort → nächstes Fach; erste falsche Antwort → Fach 1. Richtig nach einem Fehler lässt den Turm wachsen, hebt den bereits gebuchten Rückfall aber nicht wieder auf. Wiederholte HTTP-Anfragen vergeben keinen zusätzlichen Lernfortschritt.

## Assets, Installation und Pakete

Die Tierbilder wurden unverändert aus `public/images/Avatars_allgemein` nach `public/images/counting` kopiert; `SOURCES.json` dokumentiert die Herkunft. Landschaft und Baulaut stammen aus dem vorhandenen `mathe-insel`-Bestand mit dessen Quellen-/Lizenznachweisen. Es wurden keine zusätzlichen externen Bilder oder Audios bezogen.

```powershell
node scripts/create-counting-decks.cjs          # Plan und exportierte Stapel
node scripts/create-counting-decks.cjs --apply  # Backup, 2 Stapel + Spielentwurf in SQLite
node scripts/cms/cms-build-counting-tower.cjs    # GCS-Projekt, portables JSON und ZIP
```

Der Datenbankimport ist wiederholbar und erzeugt keine Duplikate. Er benutzt den regulären CMS-Store mit Schreibsperre, Backup und Audit; der CMS muss dafür beendet sein. Er registriert das Spiel als Entwurf beim SuperAdmin und vergibt keine Haus- oder Raumfreigaben. Der SuperAdmin veröffentlicht es und ordnet es den gewünschten Häusern zu; der HouseAdmin weist es anschließend dem Raum zu. Die Stapel werden separat Kindern zugeordnet.

Pakete: `artifacts/counting-game/Mathe-Zaehlen-Turmbau.zip` und `Mathe-Zaehlen-Turmbau-portable.json`. Hochgeladene ältere Kopien anderer Spiele müssen für das neue Aufgabenlayout aktualisiert werden. Der CMS muss den geänderten Servercode nach einem Neustart laden.

## Prüfung

- `node --test scripts/test-counting-tower.cjs`: Bereichsgrenzen, verschiedene Motive, Import/Zuordnung, widersprüchliche Bearbeitung, gemeinsamer Lernstand, korrekte Ergebnisereignisse, unveränderte Wiederholung, geänderte Präsentation, GCS-Integrität und ZIP-Medien.
- `node scripts/test-counting-tower-ui.cjs`: echter CMS-Upload im Sandbox-iframe; exakt 4/10 Bilder, drei Antworten, automatisches Vorlesen und Wiederholung, falsche/richtige Antworten, Textkarte zwischen Bildkarten, Pause/Fortsetzen, Neuladen und Desktop-/Tablet-Screenshots. Der Sprachadapter ist kontrolliert; echte Lautsprecherausgabe ist damit nicht geprüft.
- Bestehende Karteikasten-, Stapel-, Lernzielkatalog- und Lernpunktprüfungen bleiben maßgeblich.

## Korrektur: Bilder aus ZIP-Paketen (16.10.2026)

Die Sprite-Darstellung ergänzte bei bereits mit `images/` beginnenden Pfaden ein weiteres `images/`. Beispielsweise wurde `images/counting/fox.svg` zu `./images/images/counting/fox.svg`. Karteninhalt und ZIP-Dateien waren vorhanden, die Anzeige lud jedoch die falsche Adresse. Tests mit eingebetteten Data-URLs konnten das nicht erkennen.

`normalizeImageSource` wird jetzt von Sprite-Darstellung und Vorlader gemeinsam verwendet. Es bewahrt Paketverzeichnisse, bereits relative Referenzen sowie eingebettete und externe Bilder. Die Runtime wurde neu gebaut. Bereits hochgeladene Turmbau-ZIPs müssen nicht ersetzt werden; die Spielseite muss neu geladen werden.

Der Browsertest prüft standardmäßig das echte ZIP mit separaten Bildern und fordert für sichtbare Bildkomponenten `img.complete` sowie positive natürliche Bildmaße. Er umfasst Füchse, Elefanten, Pandas und Papageien. Mit `--portable` wird zusätzlich die Variante mit eingebetteten Bildern geprüft. Reine Sichtbarkeitsflags gelten nicht mehr als Nachweis geladener Bilder.
