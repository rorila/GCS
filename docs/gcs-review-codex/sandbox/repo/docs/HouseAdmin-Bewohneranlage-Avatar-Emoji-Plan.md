# HouseAdmin: Bewohneranlage mit Avatar-Bild und Emoji-Passwort

Stand: 14. Oktober 2026

Status: Technischer Umsetzungsplan; noch nicht implementiert.

## Ziel und Umfang

Die Bewohneranlage erhält zwei klar getrennte Bereiche: **Profilbild** und **Spielerpasswort**. Beide werden visuell bedient. Technische Kennungen wie `dog` bleiben intern.

Der Plan betrifft zunächst die Anlage durch den HouseAdmin. Die vorhandene Bewohnerliste und Detailansicht müssen das dabei gespeicherte Bild korrekt übernehmen. Eine vollständige Entfernung des bisherigen Feldes `avatar` ist eine separate Aufgabe.

## 1. Formular und Bedienung

Die bisherige kompakte Eingabezeile wird zu einem übersichtlichen Formular:

| Bereich | Bedienung |
|---|---|
| Bewohner | Anzeigename und Auswahl „Kind“ / „Erwachsener“ |
| Avatar | Bildvorschau, „Bild hochladen“ und Auswahl von Standardbildern |
| Spielerpasswort | Emoji-Auswahl, vier sichtbare Positionen und Korrekturmöglichkeiten |
| Abschluss | „Bewohner anlegen“, Fortschritt und verständliche Fehlermeldungen |

Beim Öffnen ist ein neutraler Standardavatar vorausgewählt. Dadurch kann ein Bewohner auch ohne eigenes Bild angelegt werden.

Das Formular behält alle Eingaben, wenn eine Prüfung oder das Speichern fehlschlägt. Nach erfolgreicher Anlage wird es zurückgesetzt und die Bewohnerliste aktualisiert.

## 2. Avatar-Auswahl

Der HouseAdmin kann zwischen zwei Quellen wählen:

- **Eigenes Bild:** Datei auswählen, Vorschau ansehen und bei Bedarf ersetzen oder entfernen.
- **Standardbild:** Ein Bild aus einer kleinen Galerie auswählen. Die aktive Auswahl erhält eine deutlich sichtbare Markierung.

Als erste Ausstattung sind acht klar unterscheidbare Standardbilder vorgeschlagen, beispielsweise Tiermotive, plus der neutrale Standardavatar. Die Motive sind ein Umsetzungsvorschlag, noch keine festgelegte Gestaltung. Sie werden als feste Dateien mit stabilen Kennungen bereitgestellt. Standardbilder und Passwortsymbole werden räumlich und durch Beschriftungen getrennt.

Vorhandene Komponenten können verwendet werden:

- `TFilePicker` für die Dateiauswahl.
- `TImage` für die Vorschau.
- Eine Bildgalerie beziehungsweise Bildkarten für die Standardauswahl.
- Die vorhandene Upload-Verarbeitung als Grundlage für Größenprüfung, Bilderkennung und Konvertierung.

Der bestehende Avatar-Upload akzeptiert PNG, JPEG und WebP und speichert verarbeitete Bilder als PNG. Für das neue Formular wird zunächst das vorhandene Limit von **2 MB** übernommen.

## 3. Speicherung des Avatar-Bildes

Das maßgebliche Anzeigefeld bleibt `person.avatarImage`.

Für Standardbilder sendet das Formular eine feste Kennung, beispielsweise:

```json
{
  "avatarPresetId": "fox"
}
```

Der Server übersetzt diese Kennung über einen festgelegten Katalog in den Bildpfad. Er akzeptiert keine beliebigen vom Browser angegebenen Dateipfade.

Für eigene Bilder wird die Datei übertragen und nach erfolgreicher Prüfung unter `/avatars/…` gespeichert.

Das bisherige Feld `avatar` bleibt vorerst aus Kompatibilitätsgründen erhalten und erhält bei neuen Bewohnern einen neutralen Wert. Eine vollständige Entfernung dieses Feldes würde weitere Anzeigen und Bearbeitungswege betreffen und erfolgt separat.

## 4. Bewohner und Bild gemeinsam anlegen

Der vorhandene Upload ordnet Bilder einer **bereits existierenden Person** zu. Im Anlageformular gibt es diese Person noch nicht.

Empfohlen wird deshalb ein gemeinsamer Anlageweg für Bewohner mit eigenem Bild:

1. Berechtigung des HouseAdmins für das gewählte Haus prüfen.
2. Name, Bewohnerart und Emoji-Passwort prüfen.
3. Prüfen, ob das Passwort bereits vergeben ist.
4. Bild prüfen und konvertieren.
5. Bilddatei mit eindeutigem Namen schreiben.
6. Bewohner, Hausmitgliedschaft, Spielerrolle, Passwort und Bildzuordnung in einem Datenbank-Commit speichern.
7. Bei fehlgeschlagenem Commit die neu geschriebene Datei entfernen.

Für Standardbilder genügt der bestehende JSON-Endpunkt `/api/cms/admin/house-person-create`, erweitert um die Standardbild-Kennung. Für eigene Bilder kommt ein Upload-Endpunkt mit denselben fachlichen Prüfungen hinzu. Beide verwenden dieselbe interne Anlageoperation, damit sich ihr Verhalten nicht auseinanderentwickelt. Der konkrete Pfad des neuen Upload-Endpunkts wird bei der Implementierung festgelegt.

Dateisystem und Datenbank bilden keine gemeinsame Transaktion. Deshalb braucht dieser Ablauf Fehlerbereinigung. Nach einem abrupten Prozessabbruch können unzugeordnete Bilddateien übrig bleiben. Eine gezielte Bereinigung berücksichtigt nur solche Dateien und schützt bereits zugeordnete Bilder sowie Uploads, die noch verarbeitet werden.

## 5. Emoji-Passwort

Die vorhandene Komponente `TEmojiPicker` stellt die Auswahl dar. Sie wird auf die acht Symbole beschränkt, die das CMS bereits unterstützt:

**🐶 🐱 🌳 🏠 🐘 🦉 🌷 🐷**

Darüber erscheinen vier nummerierte Positionen:

```text
[1: 🐶]  [2: 🌳]  [3: —]  [4: —]
```

Die Bedienung wird eindeutig definiert:

- Ein Klick auf ein Emoji füllt die nächste freie Position.
- Ein Klick auf eine bereits belegte Position aktiviert sie zum Ersetzen.
- „Letztes entfernen“ löscht den letzten Eintrag.
- „Zurücksetzen“ leert die gesamte Folge.
- Sind vier Positionen belegt, wird ohne aktivierte Position nichts zusätzlich angehängt.
- Wiederholte Symbole bleiben erlaubt, entsprechend der bisherigen Serverprüfung.

Intern hält das Formular eine geordnete Liste der Symbolkennungen:

```json
{
  "sequence": ["dog", "tree", "house", "elephant"]
}
```

Die Oberfläche zeigt ausschließlich die zugehörigen Emojis. Die Anmeldung bleibt mit dem vorhandenen Format kompatibel.

## 6. Validierung und Zustände

Der Button „Bewohner anlegen“ wird erst freigegeben, wenn:

- ein gültiger Anzeigename eingegeben ist,
- eine Bewohnerart ausgewählt ist,
- ein Standardbild oder eine gültige Bilddatei vorliegt,
- genau vier Passwortsymbole ausgewählt sind.

Alle Prüfungen werden zusätzlich auf dem Server ausgeführt. Ein bereits vergebenes Emoji-Passwort führt zu einer verständlichen Meldung. Name, Avatar und Auswahl bleiben erhalten.

Während der Anlage verhindert ein `Busy`-Zustand weitere Klicks. Bei einem Verbindungsabbruch mit unklarem Ergebnis muss eine erneute Anfrage über eine eindeutige Anfragekennung dieselbe Anlage wiederfinden, statt einen zweiten Bewohner anzulegen. Die Kennung muss serverseitig zusammen mit dem erfolgreichen Anlageergebnis gespeichert und an den anfragenden Account gebunden werden. Für einen erneuten Versuch derselben Anlage bleibt sie erhalten; nach Erfolg oder einem bewusst begonnenen neuen Anlagevorgang wird sie erneuert.

## 7. Betroffene technische Stellen

Die Pfade sind relativ zum Projektverzeichnis.

| Datei / Bereich | Änderung |
|---|---|
| `scripts/cms/cms-build-role-workspaces.cjs` | Neues Formular, Avatar-Auswahl und Passwort-Bedienung |
| `game-server/public/projects/GCS-CMS.json` | Tatsächlich verwendete Stage `stage_house_residents`, Tasks und Actions |
| `scripts/cms/cms-add-admin-server-stages.cjs` | Erweiterte Anlageprüfung und Server-Actions |
| `scripts/cms/cms-server-components.cjs` | Gemeinsame Anlageoperation mit `avatarImage` |
| `scripts/cms/cms-server.cjs` | Übertragung von Bilddatei und Anlage-Metadaten |
| `scripts/cms/cms-add-resident-avatar-upload.cjs` | Abstimmung mit bestehender Bildbearbeitung |
| `src/components/TEmojiPicker.ts` | Vorhandene Komponente für die einzelne Symbolauswahl; Erweiterung nur bei Bedarf |
| Statische Bilddateien und Katalog | Standardavatar-Auswahl mit stabilen Kennungen |

`TEmojiPicker` bietet bereits die einzelne Symbolauswahl. Die Verwaltung der vier Positionen wird darüber als eigener Formularzustand ergänzt. Die Generatoren werden zusammen mit der Projektdatei angepasst, damit eine spätere Neuerzeugung die Änderung erhält.

## 8. Umsetzungsschritte

1. Formularzustände und Standardbild-Katalog definieren.
2. Emoji-Auswahl mit Vorschau und Korrektur einbauen.
3. Avatar-Auswahl und lokale Bildvorschau ergänzen.
4. Server-Anlage und Bildspeicherung verbinden.
5. Bewohnerliste und Detailansicht prüfen.
6. Fehlerfälle und Berechtigungen testen.
7. Das vollständige Formular im Browser visuell prüfen.

## 9. Prüfung und Abnahme

Die Abnahme umfasst:

- Anlage mit Standardbild und mit eigenem Bild.
- Vorschau, Austausch und Entfernen eines ausgewählten Bildes.
- Auswahl von genau vier Passwortsymbolen in der richtigen Reihenfolge.
- Ersetzen und Entfernen von Passwortsymbolen sowie Zurücksetzen der Folge.
- Anmeldung mit dem neu angelegten Emoji-Passwort.
- Ungültige oder zu große Dateien.
- Bereits vergebene Emoji-Passwörter.
- Fehlende Berechtigung für das gewählte Haus.
- Fehler beim Speichern und Bereinigung einer dabei geschriebenen Bilddatei.
- Wiederholte Anfrage nach einem Verbindungsfehler ohne doppelte Bewohneranlage.
- Korrekte Bilddarstellung in Bewohnerliste, Detailansicht und Elternübersicht.
- Prüfung der Stage-Verknüpfungen und der reproduzierbaren Generatorausgabe.

Fertig ist die Änderung, wenn ein HouseAdmin **ohne Texteingabe für Avatar oder Passwortsymbole** einen Bewohner anlegen kann und dessen Bild anschließend korrekt in der Bewohner- und Elternübersicht erscheint.
