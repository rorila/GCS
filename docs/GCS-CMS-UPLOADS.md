# Spiele und Avatare hochladen

## Spiele

1. Als SuperAdmin anmelden und in der SuperAdmin-Ansicht **Meine Spiele** öffnen; direkt: http://localhost:8081/library.
2. Titel und optional eine Beschreibung eingeben.
3. **Datei auswählen**: ein gespeichertes GCS-Projekt als JSON, maximal 10 MB.
4. **Hochladen**. Das Spiel wird als eigener Entwurf gespeichert.
5. Das Spiel in der Liste auswählen und **Veröffentlichen** drücken.
6. In der bestehenden Raumverwaltung unter Spiele das veröffentlichte Spiel für den gewünschten Raum freigeben. Erst dann können dessen Spieler es starten.

**Als Entwurf zurückziehen** verhindert weitere Spielstarts. Ein SuperAdmin kann nur eigene Spiele veröffentlichen oder zurückziehen. Der Eigentümer stammt aus der Verwaltungssitzung, nicht aus der hochgeladenen Datei.

Diese erste Upload-Version nimmt GCS-JSON-Projekte mit einer spielbaren Start-Stage und eindeutigen Komponenten-IDs an. HTML-Dateien, ZIP-Pakete und externe Medienpakete werden nicht unterstützt. Medien müssen eingebettet sein. Der Strukturtest ersetzt keinen vollständigen Spieltest. Hochgeladene Spiele laufen in einer isolierten Browser-Sandbox ohne Netzwerkzugriff; Online-/Multiplayer-Funktionen sind dort nicht verfügbar.

## Avatarbilder

Nach der Spieleranmeldung **👤 → Eigenes Bild → Übertragen** wählen. PNG, JPEG und WebP sind erlaubt, maximal 2 MB. Der Server prüft den tatsächlichen Bildinhalt und speichert ein PNG mit höchstens 256 × 256 Pixeln. SVG wird nicht akzeptiert. Das Bild erscheint im persönlichen Bereich; die vorhandenen Emoji-Symbole in anderen Ansichten bleiben erhalten.

## Wiederverwendbare GCS-Komponenten

| Komponente | Inspector | Methoden und Ereignisse |
| --- | --- | --- |
| TFilePicker | Dateitypen, maximale Bytes | choose; onSelected, onCancel, onError |
| TFileUpload | Dateiauswahl-Komponente, CMS-Endpunkt | start(title, description, token), cancel; onStarted, onProgress, onSuccess, onError, onCancel |
| TServerUpload | game/avatar, maximale Bytes, Erfolgs- und Fehlertext | onRequest → Task → execute |

Die Toolbox-Kategorie heißt **Dateien und Upload**. Die Komponenten sind nicht visuell; Buttons, Beschriftungen und Bilder werden als normale GCS-Komponenten gestaltet. Native Dateiobjekte werden nicht in die Projektdatei geschrieben. Dateiname, Status, Fortschritt und Ergebnis sind für die GCS-Tasks zugänglich.

- **GCS-CMS-Spiele.json**: Spieleoberfläche und benannte Tasks/Actions.
- **GCS-CMS.json**: Avatar-Upload im persönlichen Bereich.
- **GCS-Server-Uploads.json**: Serverkomponenten und Ereigniszuordnungen; Änderungen nach Serverneustart wirksam.

Auf dem Server sind 10 MB für Spiele und 2 MB für Avatare die festen Obergrenzen; Komponenten können kleinere Grenzen konfigurieren. Ein Abbruch beendet eine laufende Übertragung. Bereits serverseitig gespeicherte Dateien werden durch einen späteren Abbruch nicht rückgängig gemacht.

## Diagnose und Speicherung

Mit `?trace=1` den Debug-Viewer aktivieren und **HTTP / Server** öffnen. Metadaten, Fortschritt, serverseitige Prüfungen und Response sind nachvollziehbar. Binärinhalte werden nicht protokolliert; Zugangsdaten werden maskiert. Interne Server-Traces benötigen eine globale Verwaltungsberechtigung.

Dateien liegen unter `game-server/data/uploads`, die Zuordnung und der Veröffentlichungsstatus in der bestehenden CMS-Datendatei. Dateinamen werden serverseitig erzeugt. Das ursprüngliche lokale Spiel wird nicht verändert.

Die Dateiübertragung verwendet den separaten Port IUploadAdapter; IStorageAdapter bleibt für GameProject-Persistenz zuständig. Browser und Electron-Renderer mit DOM können den BrowserUploadAdapter verwenden; ein eigenständiger Electron-Host wurde nicht separat getestet. Beim RunTab bleibt der CMS-Server erforderlich. Das Starten hochgeladener Spiele bitte auf der CMS-Seite prüfen.

## Verifikation

22 Upload-Prüfungen, 23 Galerieprüfungen, 14 Profilprüfungen und 27 SuperAdmin-Prüfungen bestanden. Enthalten: echte Dateiauswahl, Fortschritt, Abbruch, Größenfehler, Rollen-/Eigentümerschutz, Avataranzeige und Start eines hochgeladenen Testspiels.

Allgemeine Regression: 365 von 369 bestanden. Vier Prüfsummenabweichungen an anderweitig geänderten Export-/Runtime-Dateien bleiben dokumentiert; deren Baselines wurden nicht ungeprüft angepasst. Allgemeine Port-8080-Browsertests wurden vom Runner übersprungen; die separaten CMS-Browsertests liefen auf isolierten Testservern.
