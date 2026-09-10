# GCS-CMS – Raumverwaltung

Stand: 09.09.2026. Zweiter lokaler Ausbauschritt.

## Einstieg
http://localhost:8081/admin öffnen. Zugangsdaten stehen ausschließlich in der privaten Übergabedatei `game-server/data/CMS-VERWALTUNGSZUGANG.txt`. Benutzername ist `verwaltung`. Das zufällig erzeugte Passwort nach Möglichkeit in ein Passwortprogramm übernehmen; die Übergabedatei kann danach entfernt werden. Der Server verwendet nur den scrypt-Hash in `cms-admin-auth.json`.

Der Zugang gehört dem bestehenden Demo-Profil Eulenfreund. Seine Hauszuständigkeit berechtigt zur Verwaltung beider Räume. Die Emoji-Einwahl allein gewährt weiterhin keine Verwaltungsrechte. Die zusätzliche Sitzung läuft nach 30 Minuten ab und wird bei Abmeldung widerrufen. Beim Serverneustart enden alle Sitzungen.

## Erster Ablauf
1. Verwaltung anmelden und **Meine Räume** auswählen.
2. **Sternenzimmer** öffnen. Die Spieleliste zeigt ✓ bei freigegebenen Spielen.
3. **Breakout** anklicken: Die Freigabe wird umgeschaltet und sofort gespeichert.
4. Über **Spielen** zur Emoji-Einwahl wechseln. Fuchskind anmelden und Sternenzimmer öffnen: Breakout ist verfügbar.
5. In der Verwaltung erneut Breakout anklicken: Die Freigabe wird entzogen. Eine neu geladene Galerie enthält es nicht mehr; direkte neue CMS-Spielstarts werden ebenfalls abgewiesen. Bereits geladene Spiele werden nicht aktiv beendet.

## Weitere Funktionen
- **Mitglieder:** Personen aus den eigenen verwaltbaren Räumen zuordnen oder Zuordnung deaktivieren. Klick schaltet den Zustand um. Neue Personen anlegen und Einladungen sind noch nicht enthalten.
- **Emoji ändern:** Person-ID aus der Mitgliederliste eintragen (z. B. demo-child), vier Bild-IDs mit Komma angeben und speichern. Zulässig: dog, cat, tree, house, elephant, owl, flower, pig. Die Folge muss im Haus eindeutig sein. Hausrechte sind erforderlich, da diese Einwahl auch andere Räume im Haus betrifft. Reine RaumAdmins dürfen den Hauscode nicht ändern.
- **Raum sichern:** Aktuelle Mitgliedschaften und Spielefreigaben des gewählten Raums sichern. Pro Raum wird eine Sicherung gehalten; erneutes Sichern ersetzt sie.
- **Wiederherstellen:** Zeigt einen zusätzlichen Bestätigungsbutton. Die Wiederherstellung betrifft nur Mitgliedschaften und Spielefreigaben dieses Raums. Emoji-Codes, Personen, Rollen und Spiele selbst bleiben außerhalb dieser Raumsicherung.
- Jede erfolgreiche Änderung erhält einen Eintrag in `audit` mit Akteur, Zeitpunkt, Aktion und Raum. Ein eigener Protokollbildschirm folgt später.

## Technik
Die Verwaltungsoberfläche ist `game-server/public/projects/GCS-CMS-Verwaltung.json`, erzeugt mit `scripts/build-cms-admin.ts`. Sie verwendet vorhandene GCS-Buttons, Eingabefelder, Variablen, HTTP-Actions und Tasks. Eine erneute Generierung benötigt `--replace-generated` und überschreibt die generierte Version; eigene Änderungen vorher sichern.

Die Passwortanmeldung verwendet bewusst ein separates Formular im CMS-Host. Die vorhandene HTTP-Action protokolliert Anfrageinhalte, weshalb Passwörter nicht durch GCS-Actions transportiert werden. Nach Anmeldung laufen Verwaltungsaktionen als GCS-Tasks über die HttpOnly-/SameSite-Sitzung. Der Server prüft Sitzung, Herkunft und aktuelle Zuständigkeit bei jedem Zugriff. Der lokale Dienst bleibt auf 127.0.0.1 beschränkt. Dies ist noch keine Veröffentlichung für den Internetbetrieb.

`cms-admin.cjs` trennt Verwaltungslogik und Dateispeicherung über einen injizierbaren Speicheradapter. Der vorhandene `IStorageAdapter` ist für GameProject typisiert; CMS-Personen- und Berechtigungsdaten werden nicht als GameProject gespeichert. Änderungen werden validiert, zuerst in eine temporäre Datei geschrieben und dann atomar umbenannt. Erst nach erfolgreichem Speichern ändert sich der Laufzeitzustand. Zusätzlich wird die vorherige vollständige Datei als `cms-v1.json.previous` gehalten. Das ersetzt keine Sicherung auf einem anderen Datenträger. Rollen-/Hausverwaltung und vollständige Datenwiederherstellung bleiben nächste Ausbaustufen.

Dateien mit Zugangsdaten sowie die CMS-Daten werden nicht über HTTP ausgeliefert. Die lokale Einrichtung überschreibt keinen vorhandenen Zugang. Für einen anderen Administrator ist noch ein eigener Einrichtungs-/Verwaltungsablauf erforderlich.

## Prüfung
21 Verwaltungsprüfungen und 23 bestehende CMS-Prüfungen bestanden. Getestet wurden unter anderem Anmeldung, Bereichsgrenzen, Freigabe und Entzug, Neustartpersistenz, Raumsicherung, Emoji-Duplikate, Mitgliedschaftsentzug, Audit sowie Rollback bei Speicherfehlern und die native GCS-Verwaltungsoberfläche im Browser. Tests verwenden temporäre Daten und Zugangsdaten. 354 allgemeine Regressionstests bestanden; die allgemeine Browser-E2E-Suite ohne Game-Server auf 8080 wurde übersprungen. Separate CMS-Browsertests liefen erfolgreich.

## Aktualisierung: Haus- und Personenverwaltung
Personenanlage, Räume anlegen/umbenennen/deaktivieren und explizite RaumAdmin-Zuweisungen sind jetzt ergänzt. Siehe [GCS-CMS-HAUSVERWALTUNG.md](GCS-CMS-HAUSVERWALTUNG.md). Neue Häuser und HouseAdmin-Vergabe bleiben zukünftige Ausbauschritte.
