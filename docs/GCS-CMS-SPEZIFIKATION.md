# GCS-CMS – vereinbarte Spezifikation

Stand: 09.09.2026. Planungsstand, noch keine implementierten CMS-Funktionen.

## Ziel
Ein schrittweise ausgebautes, erweiterbares Spiele-CMS mit GCS-Bordmitteln. Kinder ohne Lesekenntnisse, Schüler und Erwachsene wählen ihr Profil und erreichen freigegebene Spiele. Oberflächen und Abläufe sollen GCS-Komponenten, Objektlisten, Tasks und Actions verwenden. Vor Implementierung vorhandene Datenzugriffe, Navigation und Authentifizierung prüfen; notwendige serverseitige Ergänzungen gezielt ergänzen.

## Bereiche und Personen
Bereiche besitzen ID, Name, Typ und optionale Eltern-ID. Haus und Raum bilden den ersten Ausbau; Straße, Stadt und weitere Ebenen bleiben möglich. Zusätzliche Ebenen sind optional. Ein späteres Umhängen erhält Bereichs-IDs und Zuordnungen. Zyklen sind unzulässig.

Personen besitzen stabile IDs. Mitgliedschaften und Rollenzuordnungen sind getrennte Datensätze. Eine Person kann mehrere Rollen an mehreren Orten besitzen. Rollenwechsel und Ortswechsel werden sichtbar angeboten. Der Kontextwechsel allein verleiht keine Rechte.

- Spieler: freigegebene Spiele nutzen; unabhängig vom Alter.
- RaumAdmin: Mitglieder und Spielefreigaben seiner Räume verwalten.
- HouseAdmin: Räume und RaumAdmin-Zuordnungen seines Hauses verwalten und deren Aufgaben übernehmen.
- SuperAdmin: Häuser und HouseAdmin-Zuordnungen verwalten.
- StreetAdmin, TownAdmin und weitere BereichsAdmins: spätere Erweiterungen über denselben bereichsbezogenen Berechtigungsmechanismus.
- Aufsicht: eigenständige Rolle zur Prüfung aller Spiele, einschließlich unveröffentlichter Spiele; sperren und gegebenenfalls löschen.

Rechte werden ausdrücklich festgelegt, einschließlich Geltung in Unterbereichen und Delegierbarkeit. Niemand darf mehr Rechte vergeben als im eigenen Bereich delegierbar sind. Bereichshierarchie gewährt nicht automatisch Zugriff auf sämtliche personenbezogenen Daten. Bereichsverwaltung und Mitgliederdatenzugriff getrennt behandeln.

Erziehungsberechtigung ist eine bestätigte Beziehung zwischen Personen. Ein Kind kann mehrere Erziehungsberechtigte haben, eine Person mehrere Kinder vertreten. Keine automatische Raumverwaltung durch diese Beziehung. Bestätigung und konkrete Befugnisse vor Umsetzung spezifizieren.

## Einwahl und Berechtigungen
Emoji-Einwahl mit vier sichtbaren Plätzen, großen Bildtasten, Löschen und Bestätigen. Stabile Emoji-IDs statt dargestellter Zeichen speichern. Haus oder Raum bildet den Einwahlkontext, beispielsweise durch einen QR-Code. Emoji-Folgen innerhalb des gewählten Kontexts eindeutig halten; Mehrdeutigkeiten zurückweisen.

Emoji-Folge dient zur einfachen Spieler-Profilauswahl. Sie allein schaltet keine Verwaltungsrechte frei. Verwaltung benötigt zusätzliche Authentifizierung. Berechtigungen serverseitig bei jedem geschützten Zugriff prüfen, einschließlich direkter Spielaufrufe. Persönliche Daten nicht über eine öffentlich abrufbare Personendatei ausliefern. Dateien können zunächst serverseitiger Speicher sein; Browser erhält nur erforderliche Daten.

## Spiele und Eigentümerschaft
Spiele veröffentlichen ist eine eigene Berechtigung. Im MVP erhalten ausschließlich SuperAdmins diese Berechtigung. Andere Rollen können später ausdrücklich berechtigt werden.

Ein SuperAdmin darf nur Spiele bearbeiten, veröffentlichen, zurückziehen oder löschen, die er selbst eingebracht hat. SuperAdmin allein gewährt keine Änderung fremder Spiele. Aufsicht kann alle Spiele prüfen, sperren und löschen; die Rolle wird nicht automatisch an SuperAdmins vergeben. Mehrfachrollen bleiben möglich.

RaumAdmins und HouseAdmins wählen verfügbare Spiele für ihre Bereiche aus. Entfernen einer Bereichsfreigabe löscht kein Original. Eine Aufsichtssperre gilt überall, auch bei direktem Aufruf. Wiederherstellbare Entfernung und endgültige Löschung unterscheiden; endgültige Löschung ausdrücklich bestätigen. Änderungen und Aufsichtsentscheidungen mit Akteur, Zeitpunkt und Begründung protokollieren.

Spielinformationen: ID, Eigentümer-ID, Titel, Vorschaubild, Projektverweis, Status (Entwurf/veröffentlicht/gesperrt/gelöscht), Bedienung, Lesebedarf, Schwierigkeit und unterstützte Geräte. Bereichsfreigaben separat speichern.

## Datenbereiche
Personen; Bereiche; Mitgliedschaften; bereichsbezogene Rollenzuordnungen; bestätigte Erziehungsberechtigten-Beziehungen; Spielekatalog; Spielefreigaben; Spielmeldungen; Änderungs- und Aufsichtsprotokoll. Stabile IDs und ein versioniertes Datenformat verwenden. Speicherung hinter einer gemeinsamen Schnittstelle halten, damit Dateien später ablösbar sind.

## MVP und Reihenfolge
1. Vorhandene GCS-Funktionen prüfen. Datenmodell, Berechtigungsmatrix und sichere Verwaltungsanmeldung konkretisieren.
2. Ein Haus, zwei Räume, kontextbezogene Emoji-Einwahl und bildgestützte Galerie: Profil wählen, Raum wählen, Spiel starten, zurückkehren und abmelden.
3. Eigene Spiele durch SuperAdmins einbringen und verwalten; RaumAdmins verwalten Mitglieder und Spielefreigaben.
4. HouseAdmins verwalten Räume und RaumAdmins; SuperAdmins verwalten Häuser und HouseAdmins. Mehrfachrollen und Bereichsgrenzen prüfen.
5. Spielmeldungen, Aufsicht, Sperren, Wiederherstellen sowie Sicherung und Wiederherstellung bereitstellen.

MVP berücksichtigt außerdem optionale Sprachausgabe, verständliche Symbole, Spielinformationen und sichtbaren Rollen-/Ortswechsel. Kein unleserlicher Text als einzige Rückmeldung für Kinder. Erziehungsberechtigten-Zuordnungen und deren Bestätigung werden mitgeführt; konkrete Verwaltungsbefugnisse werden vor Umsetzung festgelegt.

Abnahme: Ein Kind kann ohne Lesen sein Profil und einen zugänglichen Raum wählen, ein freigegebenes Spiel starten und zur Galerie zurückkehren. Eine Person kann mehrere Rollen in unterschiedlichen Bereichen ausüben. Fremde Spiele sind für SuperAdmins nicht veränderbar. Nicht berechtigte Zugriffe werden auch über direkte Serveraufrufe abgewiesen. Aufsichtssperren verhindern weitere Starts. Sicherungen sind wiederherstellbar.

## Nächste Ausbaustufen
- Spielversionen, Wiederherstellung und Regeln zur erneuten Raumfreigabe wesentlich geänderter Spiele.
- Favoriten und zuletzt gespielte Spiele.
- Optionale Spielstände über eine gemeinsame GCS-Schnittstelle.
- Einladungen und befristete Rollen.
- Kontrollierte Eigentumsübertragung für Spiele.
- StreetAdmins, TownAdmins und weitere Bereichsebenen.
- Weitere Inhalte und Lernangebote; Lernfortschritt erst als gesonderter Ausbau.

## Vor Umsetzung zu konkretisieren
Konkrete Verwaltungsanmeldung; Bestätigung der Erziehungsberechtigung; Rechte je Aktion und Bereich einschließlich Konflikten mehrerer Rollen; Verhalten bereits laufender Spiele bei Sperrung; Sicherungsablauf und Aufbewahrung; veröffentlichte Spielversionen und Ressourcen auf erlaubte Ausführung begrenzen. Diese technischen Detailentscheidungen sind noch keine zugesagten Implementierungen.

## Umsetzungserlaubnis: fehlende GCS-Komponenten
Vom Nutzer ausdrücklich autorisiert: Für das CMS erforderliche, noch fehlende GCS-Komponenten entwickeln und in GCS integrieren. Zuerst vorhandene Komponenten, Actions und Dienste prüfen; Bestehendes wiederverwenden oder sinnvoll erweitern. Neue Komponenten allgemein wiederverwendbar gestalten und erst bei einem konkreten Bedarf implementieren.

Zur Integration gehören das passende Komponenten-Schema, Inspector-Konfiguration, erforderliche Runtime-Unterstützung, Persistenz sowie die relevanten Editor-/Agent-Schnittstellen. Projektkonventionen beachten, insbesondere ProjectStore, Feature-Map, passende Tests und QA-Bericht. Authentifizierung und Berechtigungsprüfung bleiben serverseitige Aufgaben; eine UI-Komponente ersetzt diese nicht.
