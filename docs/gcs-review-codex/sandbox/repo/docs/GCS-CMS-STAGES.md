# Ein CMS-Projekt mit getrennten Stages

Bearbeitungsquelle: `game-server/public/projects/GCS-CMS.json`.
Der CMS-Server liest für sämtliche Oberflächen dieselbe Datei. Navigation erfolgt durch native GCS-Buttons, Tasks und `navigate_stage`-Actions, ohne Projektwechsel.

| Stage | Aufgabe |
|---|---|
| Blueprint · Gemeinsame Sitzungsabläufe | Spieler-Token, gemeinsame Eingabesperre, Abmeldung und übergreifende Übergänge/Fehlermeldungen |
| Spielhaus · Emoji-Anmeldung | Vier Bilder eingeben und anmelden |
| Spielhaus · Räume und Spiele | Zugewiesene Räume und freigegebene Spiele auswählen |
| Mein Bereich | Name, Emoji, Avatarbild und Zugangshilfe |
| Verwaltung · Anmeldung | Verwaltungszugang mit Benutzername und Passwort |
| RaumAdmin · Räume verwalten | Raumbezogene Freigaben, Mitgliedschaften, Codes und Sicherungen |
| HouseAdmin · Haus verwalten | Räume, Spieler und RaumAdmin-Zuständigkeiten |
| SuperAdmin · Häuser und Zuständigkeiten | Häuser und HouseAdmins verwalten |
| SuperAdmin · Eigene Spiele | Spielprojekt auswählen, hochladen und veröffentlichen |
| Server · Emoji-Anmeldung | Eingabeprüfung, Authentifizierung und Antwort |
| Server · Verwaltungsanmeldung | Passwortprüfung, Sitzung und Antwort |
| Server · Persönliche Daten | Profil lesen, speichern und Zugangshilfe anfordern |
| Server · Spiele und Avatare hochladen | Beide Upload-Konfigurationen |

## Weshalb die Oberflächen zuvor übereinander erschienen

Die Profil-Stage war vorhanden. Der Laufzeit-Fallback übernimmt jedoch zusätzlich die Objekte einer Stage mit `type: main` in andere normale Stages. Alle CMS-Oberflächen haben jetzt `type: standard`; nur die gemeinsame Blueprint-Stage wird geerbt. Die Startauswahl erfolgt über `activeStageId`, nicht über den Typ `main`.

## Bearbeiten und prüfen

1. Im Editor die aktuelle `GCS-CMS.json` erneut öffnen. Ein bereits geladenes Projekt wird durch Änderungen auf der Festplatte nicht automatisch ersetzt.
2. Im Stage-Menü die gewünschte Oberfläche wählen. Komponenten, lokale Variablen, Tasks, Actions und Features liegen bei dieser Stage.
3. Rückmeldungstexte in den betreffenden Server-Komponenten im Inspector ändern und das Projekt speichern.
4. Nach Änderungen an Server-Konfigurationen den CMS-Server neu starten; diese Konfigurationen werden beim Start geladen. Oberflächenänderungen werden beim erneuten Aufrufen der CMS-Seite gelesen.
5. Auf `http://localhost:8081/` neu laden. `/admin`, `/house`, `/super` und `/library` sind weiterhin direkte Einstiegspunkte in dasselbe Projekt. Serverrechte werden unabhängig von der sichtbaren Stage geprüft.

Die Server-Stages bleiben in der Projektdatei bearbeitbar, werden beim Ausliefern an den Browser aber herausgefiltert. `scripts/cms/cms-project.cjs` wählt serverseitig die konkrete Stage; ähnlich benannte Komponenten verschiedener Abläufe werden dadurch nicht vermischt. Servertraces verweisen auf `GCS-CMS.json` und die tatsächliche Server-Stage.

## Sicherungen und Grenzen

Die neun früheren Einzelprojekte liegen unter `game-server/project-archive/cms-before-unification/`, außerhalb der aktiven Projektauswahl. Der komplette Ausgangsstand einschließlich Spielerprojekt ist zusätzlich unter `backups/cms-before-unification-*` gesichert. Personen, Rollen, Passwörter, Spiele und Upload-Dateien wurden durch die Migration nicht verändert.

Die bisherigen `build-cms*`-Generatoren sind historische Erzeugungsskripte für Einzelprojekte und dürfen nicht als Aktualisierung des zusammengeführten Projekts verwendet werden. Die öffentlichen HTML-Dateien sind nur Kompatibilitätskopien; der CMS-Server verwendet die JSON-Datei direkt.

Einzelne Spiele bleiben selbstständige GCS-Projekte. Der bisherige einmalige Einrichtungslink `/admin-enroll` und der Spiel-IFrame-Host sind weiterhin serverseitige Hilfsoberflächen; sie wurden in dieser Stage-Migration nicht als neue GCS-Oberflächen umgesetzt.

## Verifikation

`scripts/test-cms-stages.cjs` prüft eindeutige IDs, Feature-Zuordnungen, die Trennung der Oberflächen, Server-Stage-Auswahl und native Navigation ohne Seitenreload. Zusätzlich werden bestehende Profil-, Upload-, Verwaltungs- und Serverprüfungen verwendet. Ergebnisse stehen in den `docs/cms-*-test.json`-Dateien; der allgemeine Prüflauf in `docs/QA_Report.md`.

Ergebnis der Migration am 11.09.2026: 177 gezielte Prüfungen bestanden (Stages 24, Profil 17, Uploads 22, RaumAdmin 21, HouseAdmin 27, SuperAdmin 27, Verwaltungsanmeldung 18, Server-Pilot 21). Allgemeine Suite: 365 von 369 bestanden; vier bereits vorhandene Prüfsummenabweichungen in GameExporter.ts, player-standalone.ts, GameRuntime.ts und GameLoopManager.ts. Diese Dateien wurden bei der CMS-Migration nicht geändert. Der separate allgemeine Browserlauf für Port 8080 wurde übersprungen; die gezielten CMS-Browsertests liefen auf isolierten Testports.
