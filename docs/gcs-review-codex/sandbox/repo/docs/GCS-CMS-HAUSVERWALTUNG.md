# GCS-CMS – Haus- und Personenverwaltung

Stand: 09.09.2026, dritter lokaler Ausbauschritt.

## Einstieg
Unter http://localhost:8081/admin mit den bisherigen Zugangsdaten anmelden, anschließend oben **Hausverwaltung** wählen. Direktadresse: http://localhost:8081/house. Nach einem Dienstneustart erneut anmelden.

1. **Meine Häuser** anklicken und **Spielhaus** wählen.
2. Raumname **Familie** eingeben und **Anlegen** wählen. Der neue Raum ist danach ausgewählt; die Kontextzeile zeigt Haus und Raum.
3. Anzeigename und Avatar für ein neues Spielerprofil eintragen. Vier Bild-IDs eingeben, etwa `owl,flower,pig,cat`, dann **Spielerprofil anlegen**.
4. Zur **Raumverwaltung** wechseln, **Meine Räume → Familie → Spiele** wählen und Snake freigeben.
5. Über **Spielen** zur Emoji-Einwahl zurückkehren. Mit der neuen Folge anmelden: Nur die zugeordneten aktiven Räume und deren Spiele sind erreichbar.

Gültige Bild-IDs: dog (Hund), cat (Katze), tree (Baum), house (Haus), elephant (Elefant), owl (Eule), flower (Blume), pig (Schwein). Die Folge ist innerhalb des Hauses eindeutig. Die neue Person erhält eine stabile ID, eine Mitgliedschaft im ausgewählten Raum und die Rolle Spieler. Erziehungsbeziehungen werden nicht automatisch behauptet oder angelegt.

## Räume bearbeiten
Unter **Räume** einen Eintrag auswählen. Der Raumname wird ins Eingabefeld übernommen. **Speichern** benennt ihn um. **An/Aus** deaktiviert beziehungsweise reaktiviert den Raum. Die Liste zeigt auch deaktivierte Räume, sodass eine Reaktivierung möglich bleibt. Mitgliedschaften, Spielefreigaben und IDs bleiben dabei erhalten. Deaktivierte Räume sind für Spieler und deren neue Spielstarts gesperrt. Bereits geladene Spielinstanzen werden weiterhin nicht aktiv beendet.

## RaumAdmins zuweisen
Haus und Raum wählen, dann **RaumAdmins** öffnen. Die Liste enthält bekannte Personen des eigenen Hauses; ✓ kennzeichnet eine explizite RaumAdmin-Zuweisung für diesen Raum. Person anklicken und die Änderung mit dem zusätzlichen Button bestätigen. Andere Rollen und andere Raumzuständigkeiten bleiben unverändert. Ein HouseAdmin kann weiterhin geerbte Rechte haben, auch wenn keine zusätzliche explizite RaumAdmin-Zuweisung angezeigt wird.

Nur die übergeordnete Hauszuständigkeit erlaubt die Vergabe. Ein reiner RaumAdmin kann weder Häuser verwalten noch Adminrechte weitergeben. Entzug wird bei der nächsten Anfrage auch in einer bestehenden Sitzung geprüft. Die Kontextzeile hält das gewählte Haus und den Raum sichtbar.

### Eigener Zugang für einen neuen Administrator
Eine Rollenzuweisung erzeugt absichtlich kein gemeinsames Passwort. Personen mit bestehendem Verwaltungszugang können ihre zusätzlichen Räume direkt verwenden. Für eine Person ohne Zugang steht zunächst dieses lokale Einrichtungswerkzeug bereit:

```powershell
node scripts/cms/cms-provision-admin.cjs PERSON-ID BENUTZERNAME
```

Die Person-ID steht in der Mitgliederliste der Raumverwaltung. Das Werkzeug verlangt eine aktive Verwaltungsrolle, vergibt ein zufälliges Passwort, speichert serverseitig dessen scrypt-Hash und legt eine private Übergabedatei `game-server/data/CMS-ZUGANG-PERSON-ID.txt` an. Bestehende Personen-Zugänge und Benutzernamen werden nicht überschrieben. Die Einrichtung erfolgt lokal; ein Einladungsbildschirm für selbstständige Passwortvergabe ist noch nicht enthalten. Niemals Verwaltungszugänge als Kinder-Spielerzugang verwenden.

## Technischer Aufbau
- `scripts/cms/cms-house.cjs`: Hausaktionen mit Zuständigkeitsprüfung und bestehenden atomaren Commits/Audit.
- `scripts/cms/cms-core.cjs`: aktive Bereichsvorfahren werden bei Zugang und Rollen berücksichtigt.
- `scripts/build-cms-house.ts`: Generator für das native GCS-Projekt.
- `game-server/public/projects/GCS-CMS-Hausverwaltung.json`: im Editor einsehbare Komponenten, Tasks, Actions und Variablen.
- `public/cms-house.html`: Vorschau über den lokalen CMS-Dienst.
- `scripts/test-cms-house.cjs` / `docs/cms-house-test.json`: gezielte Abnahme und Browserprüfungen.

Die Oberfläche verwendet vorhandene GCS-Komponenten; keine neue Komponente war erforderlich. Generatoren überschreiben bestehende Ergebnisse nur mit `--replace-generated`; eigene Projektänderungen vorher sichern. Der Server speichert neue Personen und Räume in derselben privaten CMS-Datei. Bestehende Daten werden nicht durch Demodaten ersetzt.

## Grenzen und nächste Ausbaustufen
Der Bildschirm verwaltet Räume innerhalb vorhandener Häuser. Neue Häuser, HouseAdmin-Vergabe, bestätigte Erziehungsbeziehungen, selbstständige Admin-Einladungen und Aufsicht bleiben weitere Schritte. Die Spieler-Einwahl ist weiterhin auf das Demo-Haus voreingestellt; freie Hauswahl und QR-Einladungen folgen gesondert. Das ist ein lokaler Entwicklungsstand.

## Prüfung
27 neue Haus-/Personen-/Mehrfachrollenprüfungen bestanden, darunter Browseranlage von Raum und Spieler sowie bestätigte Vergabe und Entzug einer RaumAdmin-Rolle. 23 bestehende CMS-Prüfungen, 21 Verwaltungsprüfungen und 354 allgemeine Regressionstests bestanden. Allgemeine Browser-E2E-Suite ohne Game-Server auf 8080 übersprungen; separate CMS-Browsertests erfolgreich. Alle Abnahmetests verwenden temporäre Datendateien und Zugangsdaten. Der Test-Raum Familie und Testpersonen wurden nicht in deine laufenden Daten geschrieben.

## SuperAdmin-Ausbaustufe
Häuser verwalten, HouseAdmins zuweisen/entziehen und einmalige Einrichtungslinks sind implementiert. Erstmalige Kontofreischaltung wartet auf Bestätigung. Anleitung: docs/GCS-CMS-SUPERADMIN.md. Spieler-Einwahl unterstützt Hauskontext-Links.
