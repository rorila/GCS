# Mein Bereich für Spieler

Nach der Emoji-Anmeldung oben auf 👤 klicken. Dort lassen sich der Anzeigename und eines der acht Avatar-Emojis auswählen und mit „✓ Speichern“ dauerhaft übernehmen. „⬅ Räume“ führt zurück zur Raumauswahl.

„🆘 Zugangshilfe“ merkt eine Bitte für die zuständige Verwaltung vor. In deren Mitgliederliste erscheint „🆘 Zugangshilfe“ bei der Person. Eine erneute Anfrage erzeugt keinen doppelten offenen Eintrag. Nach der administrativen Änderung der Emoji-Folge wird die Anfrage als erledigt markiert.

Die Person wird ausschließlich aus der Sitzung ermittelt. Eine mitgeschickte fremde Person-ID erlaubt keinen Zugriff auf fremde Profile. Rollen und Zuständigkeiten lassen sich hier nicht ändern.

## Im GCS bearbeiten

- Oberfläche und Tasks: `game-server/public/projects/GCS-CMS.json`, Feature „Meinen persönlichen Bereich verwalten“.
- Serverablauf und Rückmeldungen: `game-server/public/projects/GCS-Server-Profil.json`, Komponente TServerProfile.
- Serverausführung: `scripts/cms/cms-profile.cjs`.
- Additive Migration: `scripts/add-cms-profile.ts`; verweigert eine doppelte Anwendung. Vorherige Dateien liegen als `.before-profile` vor.

Serverkonfiguration wird beim Start geladen. Änderungen daran benötigen einen Serverneustart. Die bestehende CMS-HTML-Ausgabe enthält weiterhin einen Projektstand; für spätere Layoutänderungen diesen wie die übrigen CMS-Oberflächen aktualisieren.

Diese Ausbaustufe umfasst Anzeigename, Emoji-Avatar und Zugangshilfe für Spieler. Eigene Bilddateien hochladen, Passwort ändern und Emoji-Folgen selbst ändern sind noch nicht eingebaut. Zugangshilfe setzt kein Passwort automatisch zurück.

## Abschlussprüfung

14 Profilprüfungen, 23 Spieler-CMS-Prüfungen und 21 Verwaltungsprüfungen bestanden. Browserprüfung einschließlich dauerhafter Änderung, Zurücknavigation und Abmeldung erfolgreich. Allgemeine Regression: 366 von 369 bestanden; drei Prüfsummenabweichungen in player-standalone.ts, GameRuntime.ts und GameLoopManager.ts durch zwischenzeitliche anderweitige Änderungen. Prüfsummen nicht blind aktualisiert. Der allgemeine Runner überspringt seine Port-8080-Browsertests; die separaten CMS-Browsertests wurden ausgeführt.

## Getrennte Stages
Die Profiloberfläche liegt jetzt in stage_profile (Mein Bereich). stage_main enthält Einwahl und Galerie. Die Blueprint-Stage enthält weiterhin gemeinsame Dienste, Tasks und Sitzungsvariablen. 👤 wechselt in die Profil-Stage; Räume und Abmelden führen ins Spielhaus zurück. Das Projekt im Editor neu laden, um beide Oberflächen getrennt zu bearbeiten.
