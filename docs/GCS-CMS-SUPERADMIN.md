# GCS-CMS – SuperAdmin-Verwaltung

Stand: 09.09.2026. Implementiert und getestet. Die erstmalige SuperAdmin-Zuweisung an den vorhandenen Zugang verwaltung wartet auf ausdrückliche Bestätigung; Kontorechte wurden nicht verändert.

## Einstieg nach Freischaltung
http://localhost:8081/super öffnen, Verwaltung anmelden und oben SuperAdmin wählen.

1. Alle Häuser wählen. Hausnamen eingeben und Anlegen drücken.
2. Neue verantwortliche Person mit Anzeigenamen anlegen oder eine bestehende Person wählen. Bei mehr als vier Einträgen mit den Pfeilen blättern.
3. Unter HouseAdmins die Person anklicken und die Zuweisung ausdrücklich bestätigen. ✓ zeigt die explizite HouseAdmin-Rolle für das gewählte Haus.
4. Zugang einrichten erzeugt einen Link im Eingabefeld. Vollständig kopieren und der vorgesehenen erwachsenen Person persönlich zur Verfügung stellen. Es wird keine Nachricht automatisch verschickt.
5. Über den Link vergibt die Person einen Benutzernamen und ein Passwort. Der Link gilt 24 Stunden, ist einmal verwendbar und wird durch einen neu erzeugten Link ersetzt.
6. Danach kann sie ihr zugewiesenes Haus verwalten. Andere Häuser bleiben ohne zusätzliche Zuständigkeit gesperrt.

Eine Person kann mehrere Häuser verwalten, ein Haus mehrere HouseAdmins besitzen. Weitere Zuweisungen verwenden denselben Zugang. Bestehende Passwörter werden nicht überschrieben. Entzug betrifft nur die gewählte explizite Hausrolle; andere Rollen bleiben erhalten.

## Häuser und Spielerzugang
Haus auswählen, Namen ändern und Speichern wählen. An/Aus deaktiviert oder reaktiviert das Haus. Räume, Personen, Mitgliedschaften und Freigaben bleiben erhalten. Deaktivierung sperrt neue Zugriffe und Spielstarts; bereits geladene Spiele werden nicht aktiv beendet.

Spieler-Link zeigt den Einwahllink mit Hauskontext: http://localhost:8081/?house=HAUS-ID. Damit kann dieselbe Emoji-Folge in unterschiedlichen Häusern unterschiedliche Personen bezeichnen. Ohne Parameter bleibt das Demo-Haus vorbelegt. Die sichtbaren Demo-Hinweise gelten noch für dieses Demo-Haus und stellen keine Zugänge für ein neues Haus dar.

## Rechte und Einrichtung
Superaktionen verlangen bei jeder Anfrage eine aktive SuperAdmin-Rolle im aktiven Wurzelbereich. HouseAdmins können sie nicht ausführen. Einrichtungslinks werden in den privaten CMS-Daten nur als Hash gespeichert. Vor Einlösung prüft der Server Ablauf, Aussteller, Person, aktives Haus und HouseAdmin-Zuweisung erneut. Passwörter verarbeitet ein separates Formular, damit sie nicht in GCS-Action-Protokolle gelangen; serverseitig wird ein scrypt-Hash gespeichert.

Die Verwaltungsoberfläche besteht aus nativen GCS-Komponenten, Variablen, HTTP-Actions und Tasks. Dateien: game-server/public/projects/GCS-CMS-SuperAdmin.json; scripts/build-cms-super.ts; scripts/cms/cms-super.cjs; scripts/test-cms-super.cjs. Der Generator benötigt zum Überschreiben --replace-generated. Eigene Änderungen vorher sichern.

scripts/cms/cms-enable-super.cjs ist der vorbereitete lokale Bootstrap für das Konto verwaltung. Er wurde noch nicht ausgeführt. Er würde diesem Konto SuperAdmin im Wurzelbereich zuweisen, mit Vorversion und Audit, ohne Passwortänderung. Eine Oberfläche für weitere SuperAdmin-Vergaben ist nicht Bestandteil dieses Schritts.

Spieleigentum und Aufsicht bleiben getrennt: SuperAdmin gewährt weder eine Aufsichtsrolle noch Bearbeitungsrechte für fremde Spiele. Eigene Spieleverwaltung und Aufsichtsoberfläche folgen gesondert. Dienst und Links bleiben lokal auf diesem Rechner.

## Prüfung
25 neue SuperAdmin-Prüfungen bestanden, darunter Hausverwaltung, einmalige Zugangseinrichtung, HouseAdmin-Isolation, Rechteentzug in bestehenden Sitzungen und Browserablauf. Insgesamt 96 gezielte CMS-Prüfungen und 354 Regressionstests bestanden. Allgemeine Browser-E2E-Suite ohne Game-Server auf 8080 übersprungen; separate CMS-Browsertests erfolgreich. Testhäuser und Testzugänge lagen ausschließlich in temporären Dateien.

## Freischaltung bestätigt
Der Nutzer hat die dauerhafte SuperAdmin-Zuweisung für das bestehende Konto verwaltung ausdrücklich genehmigt. Der Bootstrap wurde ausgeführt und die gespeicherte Rolle im Wurzelbereich geprüft. Die Auth-Datei blieb unverändert. Frühere Hinweise auf eine ausstehende Freischaltung sind damit erledigt.

## Fehlerbehebung: leere Häuserliste (10.09.2026)
Beim gemeldeten Fehler lief auf Port 8081 kein CMS-Dienst. Eine geöffnete Seite blieb sichtbar, konnte aber keine Daten nachladen. Dienst erneut gestartet; die authentifizierte Live-API lieferte Spielhaus mit HTTP 200. SuperAdmin lädt Häuser nun beim Öffnen automatisch. Bei Ladefehlern werden alte Karten ausgeblendet und eine verständliche Meldung angezeigt. Nach einem Dienstneustart neu anmelden.

Falls der Dienst nach einem Rechnerneustart nicht läuft: im V2-Verzeichnis `node scripts/cms/cms-server.cjs` starten. Er ist kein automatisch gestarteter Windows-Dienst.
