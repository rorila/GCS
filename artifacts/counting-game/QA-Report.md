# Prüfung · Bilder zählen und Turmbau · 16.10.2026

- SQLite-Import erfolgreich: 2 Stapel, 22 Karten unter Wiebke und 1 Spielentwurf „Zählabenteuer · Turmbau“. Reguläres Store-Backup vor dem Import; Bestand anschließend unabhängig erneut gelesen und geprüft.
- Stapel und Spiel sind Entwürfe. Keine automatischen Zuordnungen an Kinder, Häuser oder Räume.
- 6 neue Modulprüfungen erfolgreich: vollständige Zahlenbereiche einschließlich 1/5/10, zwei unterschiedliche Motive je Anzahl, Metadaten bei Zuordnung/Import, widersprüchliche Bearbeitung, Lernstand und idempotente Antworten, geänderte Bilddaten, Spielentwurf und Hausfreigaben, GCS-Integrität und ZIP-Medien.
- 8 bestehende Karteikasten- und 5 Katalogprüfungen erfolgreich.
- Bestehende Stapelprüfungen 29/29 und Lernpunkteprüfungen 17/17 erfolgreich.
- Browser: Turmbau als hochgeladenes Projekt im echten CMS-Sandbox-iframe. Vier und zehn sichtbare Bilder, genau drei Antworten, automatisches Vorlesen plus Wiederholungsbutton, falsche Antwort ohne Baustein, richtige Antwort mit Baustein, Textkarte zwischen Bildkarten, Pause/Fortsetzen und Wiederaufnahme nach Neuladen ohne Doppelbuchung. Keine JavaScript-Seitenfehler.
- Browser: Alle drei bisherigen Mathe-Abenteuer erfolgreich, einschließlich neuer Bilderzählkarte mit fünf sichtbaren Füchsen, Stapel-/Fachfilter und gemeinsamem Lernstand.
- Browser: Bestehendes Karteikasten-Quiz mit vier sichtbaren Füchsen, Antwortprüfung, Lernpunkten, Abschluss und Elternnavigation erfolgreich.
- Screenshots der Turmbau-Oberfläche bei 1400×1100 und 1024×768 visuell geprüft; überlappende untere Bedienelemente korrigiert und erneut geprüft. Papierkarten-Quiz ebenfalls visuell geprüft.
- Sprachablauf im Turmbau mit kontrolliertem Adapter geprüft; keine Prüfung der tatsächlichen Lautsprecherausgabe. Kein vollständiger allgemeiner Editor-/E2E-Suitenlauf für diese Änderung.

Die erste Umsetzung ist eine Teilübung zum Katalogbereich „Zahlen darstellen und vergleichen“: Anzahlen bis 10 erfassen und Zahlen zuordnen. Sie deckt nicht den gesamten Lehrplanbereich ab.

Der neue Aufgabentyp wird zunächst durch den Stapelgenerator erzeugt. Eine grafische Pflege von Bildmotiv und Anzahl im bisherigen Karteneditor ist noch nicht implementiert.

## Nachprüfung: fehlende Tierbilder aus ZIP-Paketen

- Fehler mit echtem Turmbau-ZIP vor der Korrektur reproduziert: sichtbare Bildkomponenten, aber keine dekodierten Bilder. Die vorherige Prüfung allein mit portablen Data-URLs war dafür unzureichend.
- Ursache: SpriteRenderer ergänzte `images/` auch bei bereits vorhandener Verzeichnisangabe. Bild-Vorlader und Darstellung verwendeten unterschiedliche Regeln.
- Gemeinsame Pfadauflösung implementiert; öffentliche Runtime neu gebaut. Keine Änderung an Helenas Karten, Lernstand oder laufender Runde nötig.
- Drei neue Pfadtests und vierzehn Karteikasten-/Turmbau-Modulprüfungen erfolgreich.
- Browserprüfung mit echtem ZIP und separat mit portablem JSON erfolgreich: geladene Bilder aller vier Motive (Fuchs, Panda, Elefant, Papagei), kontrolliertes Vorlesen, Wiederholung, Text-/Bildkartenwechsel, Turmfortschritt, Pause und Wiederaufnahme.
- Prüfnachweis verlangt echte `img`-Elemente mit `complete` und positiven natürlichen Bildmaßen. Berichte: `browser-report-zip.json` und `browser-report-portable.json`.
- Zentralen Testlauf um die Pfadtests ergänzt; der vollständige allgemeine Testlauf wurde hierfür nicht erneut ausgeführt.
