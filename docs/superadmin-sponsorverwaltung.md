# SuperAdmin: Sponsoren verwalten

Stand: 12.10.2026. Die Erweiterung ist im CMS-Master `GCS-CMS.json` enthalten.

## Bedienung

1. Als SuperAdmin anmelden und gegebenenfalls die SuperAdmin-Rolle auswählen.
2. In der Seitennavigation **Sponsoren** öffnen.
3. Eine bestehende erwachsene Person auswählen und **Sponsor zuweisen** drücken. Die Sponsorrolle wird zusätzlich vergeben; alle anderen Rollen, Haus-/Raumzuordnungen und Zugangsdaten bleiben erhalten. Das gilt auch für Eltern, Beobachter, erwachsene Spieler, Raum-/HausAdmins und SuperAdmins. Kinder und inaktive Konten werden abgewiesen.
4. Ausschließlich für eine neue Person einen Namen eintragen und **Neue Person einladen** wählen. Den angezeigten Link kopieren und persönlich weitergeben. Es wird keine E-Mail automatisch versendet.
5. Die eingeladene Person richtet über den Link ihren Benutzernamen und ihr Passwort ein. Erst dann wird die Sponsorrolle aktiviert. Anschließend kann sie sich über die gemeinsame CMS-Anmeldung anmelden.

Bei bestehenden Konten wird keine neue Einladung erzeugt. Personen mit Passwortzugang verwenden ihren bisherigen Zugang. Die Übersicht zeigt ausdrücklich, wenn eine bestehende Person noch keinen Passwortzugang besitzt; eine Rollenvergabe erzeugt oder ersetzt keine Zugangsdaten. Die Sponsor-Funktionen benötigen weiterhin eine Kontositzung mit Passwortanmeldung; ein Emoji-Profil wird dadurch nicht zu einem Passwortkonto.

Nach einer neuen Rollenvergabe einmal neu anmelden, damit die gemeinsame Anmeldung alle aktuellen Kontexte berücksichtigt. Erwachsene mit Sponsor- und weiteren Kontorollen erhalten im CMS ein Menü **Meine Rollen**, über das sie zwischen Verwaltung, Eltern-/Beobachterbereich und Sponsorbereich wechseln können.

## Einladungen und Entzug

- Einladungslinks gelten 24 Stunden und sind einmal verwendbar. In den CMS-Daten wird nur der Token-Hash gespeichert; Passwörter werden mit scrypt gehasht.
- Für ausgewählte neue, noch nicht eingerichtete Personen kann die Einladung erneuert oder widerrufen werden. Erneuern macht den vorherigen Link ungültig. Abgelaufene und widerrufene Tickets sowie Tickets eines inzwischen entmachteten SuperAdmins werden abgewiesen.
- Bestehende Namen werden bei der Neuanlage abgefangen. Bei verschiedenen Personen mit gleichem Namen muss ein unterscheidbarer Anzeigename gewählt werden, damit nicht versehentlich ein vorhandenes Konto dupliziert wird.
- **Sponsor entziehen** erfordert einen zweiten bestätigenden Klick. Der Entzug beendet offene Begleitungen, widerruft deren Sichtfreigaben und informiert die Beteiligten. Erreichte Belohnungsansprüche bleiben erhalten. Andere Rollen werden nicht entzogen.
- Eine spätere erneute Rollenvergabe reaktiviert keine beendeten Begleitungen. Für neue Begleitungen gelten weiterhin Kontaktcode und Zustimmung der Eltern.

## Umsetzung

| Datei | Aufgabe |
| --- | --- |
| `scripts/cms/cms-sponsor-admin.cjs` | SuperAdmin-Berechtigung, Erwachsenenliste, additive Rollenvergabe/-entzug, Einladung und Registrierung. |
| `scripts/cms/cms-server-components.cjs` | Registrierung der Operationen an `TServerAccess`. |
| `scripts/cms/cms-add-super-sponsor-stages.cjs` | Idempotente Ergänzung der Server-Endpunkte, Sponsor-Verwaltungsseite, Navigation und Registrierungsstage. |
| `game-server/public/projects/GCS-CMS.json` | Deklarative CMS-Oberfläche und Serverabläufe. |
| `scripts/cms/cms-add-super-server-stage.cjs` | Bewahrt die Erweiterung bei erneutem Aufbau der SuperAdmin-Serverstage. |
| `scripts/cms/cms-add-upload-enroll-server-stages.cjs` | Sponsor-Registrierung auch im allgemeinen Einrichtungsbuilder. |
| `scripts/cms/cms-server.cjs` | GET-Formular und POST-Registrierung unter `/sponsor-enroll`; bestehende gemeinsame Anmeldung. |
| `scripts/cms/cms-shell.js` | Wechsel zwischen mehreren erwachsenen Kontorollen. |
| `src/components/TServerEnroll.ts` und `docs/schemas/schema_server_cms.json` | Beschreibung der zusätzlichen Einrichtungsart. |
| `scripts/test-cms-sponsor-admin.cjs`, `scripts/test-cms-sponsor-admin-ui.cjs` | Fach-/Runtime-/Storetests und echter HTTP-/Browsertest mit isolierten Daten. |
| `scripts/test_runner.ts`, `package.json` | Einbindung und ausführbare Testbefehle. |

API-Endpunkte: `POST /api/cms/admin/super-sponsors`, `super-sponsor-set`, `super-sponsor-invite`, `super-sponsor-invite-revoke`. Alle prüfen sowohl den ausgewählten SuperAdmin-Kontext als auch die weiterhin aktive Personenrolle. Die Registrierung ist über das Einladungsticket geschützt und vergibt ausschließlich die Sponsorrolle, keine Verwaltungs- oder Elternrechte.

## Prüfung

- `npm run test:cms:sponsor-admin`: 13 Testgruppen bestanden. Dazu gehören Berechtigungen, alle bestehenden Erwachsenenrollen, Kinder-/Inaktiv-Sperre, fehlende Bestätigung, Erneuern/Widerrufen/Ablauf, Benutzername-Konflikt, Einmaligkeit, Rücknahme der Zugangsdaten bei Speicherfehlern und Erhalt anderer Rollen/Ansprüche.
- `npm run test:cms:sponsor-admin:ui`: bestanden. Echter lokaler CMS-Server und Edge prüfen Navigation, Personenauswahl, zweistufigen Entzug, Zuweisung, Mehrfachrollen-Menü, Linkanzeige, Formularregistrierung, gesperrte Wiederverwendung und Sponsorlogin. Die neue Verwaltungsseite wurde zusätzlich anhand eines Screenshots geprüft.
- `npm run test:cms:sponsor`: 24 bestehende Regressionstestgruppen bestanden.
- `node --test scripts/test-cms-ui-integrity.cjs`: 10 Tests bestanden; CMS-Master ohne Integritätsfehler/Warnungen.
- `npm run build`: erfolgreich mit bestehenden Vite-Hinweisen zu externen Node-Modulen, dynamischen Imports und Chunk-Größe.
- `git diff --check`: keine Whitespace-Fehler.

Alle Tests verwenden synthetische Daten. Es wurde kein produktiver CMS-Bestand geändert und keine Bereitstellung ausgeführt. Der Registrierungstest deckt normale Speicherfehler ab; CMS-Daten und Passwortdatei bleiben zwei separate Dateien, ohne gemeinsame crashsichere Datenbanktransaktion.
