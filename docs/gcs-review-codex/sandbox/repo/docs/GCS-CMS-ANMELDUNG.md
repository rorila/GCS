# Verwaltungsanmeldung als GCS-Projekt

## Bearbeiten

Öffne im GCS `game-server/public/projects/GCS-CMS-Anmeldung.json`.

- **Stage „Verwaltung anmelden“:** Beschriftungen, Eingabefelder, Anmeldebutton, Rückmeldung und Links gestalten.
- **Inspector:** Texte, Farben, Größen und Positionen bearbeiten. Das Passwortfeld ist ein TEdit mit Eingabetyp `password` und Autovervollständigung `current-password`.
- **User Stories:** Feature „Bei der Verwaltung anmelden“ enthält die zugehörigen Tasks.
- **Flow:** Anmeldung_Starten → Eingaben_Pruefen → Anmeldung_Anfordern → Anmeldung_Auswerten → Erfolg oder Fehler anzeigen. Verwaltung_Oeffnen ruft die Link-Komponente auf.

Das Projekt in genau diese Datei speichern und die Anmeldeseite neu laden. Der Server liest das Dialogprojekt bei jedem Aufruf: Kein HTML-Export und kein Serverneustart für Dialogänderungen erforderlich. Ein bereits angemeldeter Browser zeigt unter /admin die Verwaltung; zum Prüfen des Dialogs vorher abmelden oder ein privates Browserfenster verwenden.

Das Passwortfeld nach einem Test nicht mit einem echten Passwort als Vorgabewert speichern.

## Serverkonfiguration

Öffne `game-server/public/projects/GCS-Server-Verwaltungsanmeldung.json`.

Der onRequest-Task verwendet fünf gekapselte Komponenten:

1. TServerEndpoint empfängt POST /api/cms/admin-login.
2. TServerValidate prüft Benutzername und Passwort auf vorhandene Werte und zulässige Länge.
3. TServerAuthenticate prüft Versuchslimit, Passwort, aktive Person und Verwaltungszuständigkeit.
4. TServerSession erstellt ausschließlich nach erfolgreicher Prüfung eine Sitzung.
5. TServerResponse stellt die JSON-Rückmeldung zusammen.

Fehler- und Erfolgstexte werden in den Komponenten konfiguriert. Nach dem Speichern dieses Serverprojekts den CMS-Server neu starten. Die feste Sicherheitsreihenfolge wird beim Laden validiert; das Entfernen oder Umgehen der Prüfung führt zu einem Fehler. Frei programmierbare Prüfregeln oder beliebige neue Routen sind noch nicht Teil dieses Bausteinsatzes.

Die Sitzung bleibt 30 Minuten gültig und wird ausschließlich als HttpOnly-/SameSite-Cookie übertragen. Das JSON enthält keinen Sitzungsschlüssel. Bestehende Konten, Passwort-Hashes und Rollen bleiben erhalten.

## Testen und nachvollziehen

http://localhost:8081/admin?trace=1 öffnen und anmelden. Anschließend im Debug-Log-Viewer **HTTP / Server** wählen und den Request aufklappen. Request, Serverprüfungen, Sitzungserstellung und Response gehören über eine Vorgangs-ID zusammen. Passwörter und Cookies werden maskiert. Vollständige interne Serverdetails benötigen eine berechtigte globale Verwaltungssitzung; nach erfolgreicher SuperAdmin-Anmeldung steht diese bereits für das Abholen des Login-Traces zur Verfügung. Ein anonymer Fehlversuch gibt keine internen Serverdaten frei.

Nach Erfolg bleibt der Dialog mit „Verwaltung öffnen“ sichtbar. Dadurch kann der Vorgang vor dem Seitenwechsel betrachtet werden. Ein Klick öffnet die Verwaltung im selben Fenster. Fehlerhafte Eingaben und Verbindungsfehler bleiben im Dialog sichtbar; das Passwort wird nach einer Anfrage geleert.

Die Eingaberollen `username` und `password` sind im gelieferten Workflow referenziert. Beim Umbenennen auch die Referenzen in den Actions anpassen. HTTP-Bodywerte werden als Objekt konfiguriert und erst nach der Werteauflösung als JSON kodiert; dadurch bleiben Anführungszeichen und Backslashes korrekt erhalten.

## Umfang und technische Dateien

Der bisherige handgeschriebene Verwaltungs-Anmeldedialog wurde entfernt. Der verbleibende HTML-Rahmen lädt ausschließlich die allgemeine GCS-Runtime und das gespeicherte Projekt; er enthält keine Eingabefelder oder fachliche Dialoglogik. Das separate Einrichtungsformular für neue Konten ist noch nicht umgebaut.

- `scripts/build-cms-login.ts`: geschützter Generator für die beiden Ausgangsprojekte; nicht zum Aktualisieren eigener Gestaltung verwenden.
- `scripts/cms/cms-admin-workflow.cjs`: überprüft und führt den Server-Workflow aus; rendert den allgemeinen Projekt-Host.
- `scripts/cms/cms-admin.cjs`: vorhandene Passwortprüfung, getrennte geprüfte Sitzungserstellung und Verwaltungsfunktionen.
- `src/components/TServerSession.ts`: neuer Sitzungsbaustein in der Server-Toolbox.
- TEdit ergänzt Eingabetyp und Autovervollständigung; TLink ergänzt das Zielfenster `_self`.

Der bisherige POST-Endpunkt /admin-login bleibt für bestehende Clients kompatibel. Der neue GCS-Dialog verwendet ausschließlich /api/cms/admin-login mit dem konfigurierten Komponentenablauf.

Prüfung: 18 spezielle Login-Prüfungen, 98 CMS-Prüfungen, 21 Emoji-Pilotprüfungen und 354 allgemeine Regressionstests bestanden. Allgemeine Playwright-Tests für Port 8080 wurden vom Test-Runner übersprungen; die separaten CMS-Browsertests liefen auf isolierten Testservern. Ergebnis: `docs/cms-login-test.json`.
