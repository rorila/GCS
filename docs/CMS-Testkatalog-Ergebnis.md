# CMS-Testkatalog — Ergebnis (automatisch)
> **Live-Lauf:** test-katalog-5-querschnitt · Fortschritt 148/148 · aktuell: §8 Punkt 10 · 23.9.2026, 19:18:00


**Stand:** nach Phase 4 (Multiplayer) + deklarative Server-Migration (alle Endpunkte als Server-Stages in `GCS-CMS.json`; externe Verträge unverändert). Testet den aktuellen Datenstand und die UI.
**Vorgehen:** Jeden Punkt abhaken `[x]`. Bei Abweichung Zeilennummer + Beobachtung notieren.

---

## 0 · Vorbereitung

- [x] **0.1** Testdaten frisch erzeugen: `node scripts/cms/cms-seed-testdata.cjs`
- [x] **0.2** Testserver starten (erzeugt Testdaten + Zugangsdaten automatisch, falls sie fehlen):
  `node scripts/start-testserver.cjs` — läuft auf `http://localhost:8081`, beenden mit Strg+C
- [x] **0.4** Basis-URL erreichbar: `http://localhost:8081` zeigt die Emoji-Anmeldung

### Zugangsdaten (alle Passwörter: `Nur-Fuer-Tests!2025`)

| Rolle | Benutzername | Person | Haus |
|---|---|---|---|
| SuperAdmin | `super` | Sara SuperAdmin | alle |
| HouseAdmin Sonne | `admin.sonne` | Anna | Haus Sonne |
| HouseAdmin+Vater | `admin.paul` | Paul | Haus Sonne (auch Elternteil von Lina) |
| HouseAdmin Mond | `admin.mond` | Mia | Haus Mond |
| Erzieher/RaumAdmin | `erzieher.tobias` | Tobias | nur Spielraum Sonne |
| Beobachterin | `beobachter.olga` | Olga | Spielraum Sonne (nur Aggregate) |
| Mutter v. Lina | `eltern.petra` | Petra | sieht nur Lina |
| Vater v. Finn+Emil | `eltern.martin` | Martin | sieht Finn + Emil |
| Mutter v. Tom | `eltern.tina` | Tina | sieht nur Tom |
| Vater v. Tom | `eltern.tim` | Tim | sieht nur Tom (+ offene Einladung für Emil) |
| Früherer Kontakt | `kontakt.rita` | Rita | widerrufen — sieht niemanden |

### Kinder — Emoji-Anmeldung (Haus Sonne)

| Kind | Emoji-Sequenz | Budget | Besonderheit |
|---|---|---|---|
| Lina | 🐶 🐱 🌳 🏠 | 45 min | läuft gerade aktiv (12 min verbraucht) |
| Tom | 🦉 🌷 🐷 🐘 | 30 min | pausiert, 28 min verbraucht |
| Finn | 🐱 🐶 🌷 🌳 | 20 min | Budget heute erschöpft |
| Emil | 🏠 🌳 🦉 🐷 | keins | Lernraum, Verbindung getrennt |
| Sven (gesperrt) | 🐷 🐷 🐷 🐷 | — | inaktiv |
| Lea (ausgetreten) | 🌷 🌷 🌷 🌷 | — | Mitgliedschaft inaktiv |
| Mia (Mond) | 🐶 🐱 🌳 🏠 | — | Haus Mond |

**Einladungs-Tickets:** gültig `test-token-valid` (Tim→Emil), abgelaufen `test-token-expired`, benutzt `test-token-used`, Beobachter `test-token-observer` (Lernraum).

---

## 1 · SuperAdmin (`super`)

### 1.1 Anmeldung & Übersicht (Landingpage `stage_super`)
- [x] `/admin` → `super` + Passwort → landet **sofort** auf `stage_super` (Übersicht, kein Zwischenschritt)
- [x] Direkt-URL `/super` → Übersicht erscheint ebenfalls
- [x] Falsches Passwort → generische Fehlermeldung, keine Details
- [x] Nach 10 Fehlversuchen → Rate-Limit (429, „Bitte kurz warten")
- [x] **Sidebar links:** Einträge „Übersicht · Häuser · SuperAdmins · Meine Spiele · Anmeldung", aktiver Eintrag mit `▸` markiert — auf **allen** Super-Stages identisch
- [x] **Aufgabenkarten:** drei Karten (Häuser / SuperAdmins / Meine Spiele) führen in die jeweilige Unter-Stage
- [x] **Kennzahlen:** „Häuser: X aktiv von Y · SuperAdmins: Z"

### 1.2 Häuser verwalten (`stage_super_houses`)
- [x] **Tabelle:** Häuser als Zeilen mit Spalten *Haus · HouseAdmins · Personen · Räume · Aktiv* (Zusatzinfos direkt sichtbar)
- [x] **Karten ⇄ Tabelle:** „⇄ als Karten"-Button schaltet die Ansicht um — Karten zeigen dieselben Zusatzinfos; zurückschalten möglich
- [x] **Anlegen:** Feld „Hausname" + „Anlegen" → neues Haus erscheint als Tabellenzeile
- [x] **Doppelt:** gleichen Namen nochmal → Fehler „existiert bereits"
- [x] **Zeile anklicken** (oder Karte) → `stage_super_house` mit Kontextpfad „Plattform › Häuser › <Name>"

### 1.3 Haus-Details & HouseAdmins (`stage_super_house`)
- [x] „← Häuser" (oder Sidebar) führt zurück zur Übersichtsliste — Hausauswahl bleibt während des Besuchs erhalten
- [x] **Ändern:** Haus umbenennen → Name übernommen (auch im Kontextpfad)
- [x] **Deaktivieren:** „Haus Mond" deaktivieren → HouseAdmin `admin.mond` kann sich **nicht** mehr anmelden; Kind Mia **nicht** mehr per Emoji einloggen
- [x] **Reaktivieren:** Haus Mond wieder aktivieren → beide Zugänge funktionieren wieder
- [x] **Spieler-Link:** Button erzeugt Einwahllink `/?house=…` für das Haus
- [x] **HouseAdmin-Tabelle:** Personen mit Spalten *Name · Zugang · Weitere Häuser · Admin*
- [x] Neue Person anlegen → erscheint in der Tabelle
- [x] Person in Tabelle wählen → „Einladen" erzeugt Einrichtungslink (24 h gültig); **zweites** Öffnen → „bereits verwendet"
- [x] Zuständigkeit: Zeile wählen → Bestätigungsbutton → zuweisen/entziehen; Entzug wirkt sofort (auch in laufender Sitzung)

### 1.4 SuperAdmins verwalten (`stage_super_admins`)
- [x] Tabelle aller Personen mit Spalten *Name · Zugang · SuperAdmin* (Kartenansicht umschaltbar)
- [x] Zeile wählen + bestätigen → SuperAdmin-Rolle vergeben (plattformweit)
- [x] Eigene SuperAdmin-Rolle entziehen → wird abgelehnt („eigene Rolle kann nicht entzogen werden")
- [x] SuperAdmin-Einladungslink für neue Person → Einrichtung → Login landet auf `stage_super`

### 1.5 Spielekatalog (`stage_library`, Sidebar ebenfalls vorhanden)
- [x] Spielliste zeigt alle 5 Spiele mit Status (published/draft/blocked)
- [x] Spiel „Unfertiges Spiel" ist `draft` → Kinder sehen es nicht

### 1.5 Abgrenzung
- [x] SuperAdmin sieht **keine** Kinderdaten (keine Elternsicht, kein room-pulse)
- [x] SuperAdmin kann keine Eltern-Funktionen aufrufen (403)

---

## 2 · HouseAdmin (`admin.sonne`)

### 2.1 Anmeldung & Bereich
- [x] `/admin` → `admin.sonne` → Erfolgsansicht → „Verwaltung öffnen" → landet auf der Raumverwaltung
- [x] Navigation „Haus" → Hausverwaltung; bei **einem** Haus wird dieses automatisch geöffnet (keine Zwischenwahl)
- [x] Hausliste lädt **automatisch** beim Öffnen der Stage — kein manueller „Laden"-Klick nötig
- [x] Fremdes Haus per Direktaufruf (manipulierte `houseId`) → 403

### 2.2 Räume (Tab „Räume")
- [x] **Anlegen:** Raum „Familienraum Test" → erscheint in der Liste, aktiv
- [x] **Doppelt:** gleicher Name → abgelehnt
- [x] **Ändern:** Raum anklicken → umbenennen + deaktivieren → „Speichern"/„An-Aus" → Status sichtbar
- [x] Deaktivierter Raum: Kinder sehen ihn nicht in ihrer Raumliste; kein Spielstart
- [x] Reaktivieren → wieder sichtbar

### 2.3 Kinder & Profile
- [x] Tab „Räume" → Raum wählen → Formular „Neues Spielerprofil": Name, Avatar, 4 Bild-IDs → „Profil anlegen"
- [x] Tab „Kinder" → Liste zeigt nur Kinder des eigenen Hauses
- [x] **Doppelte Emoji-Folge** (z. B. Linas Code nochmal vergeben) → abgelehnt
- [x] Kind kann sich nach dem Anlegen sofort per Emoji anmelden

### 2.4 Spielfreigaben
- [x] Raumverwaltung (`/admin`): Snake für Spielraum aktivieren → Kind sieht es in der Liste
- [x] Freigabe entziehen → Spielstart verweigert, auch **in laufender Sitzung**

### 2.5 Eltern-Einladung + Zweitbestätigung
- [x] Tab „Kinder" → Kind wählen (z. B. Emil) → Elternname eingeben → „Elternteil einladen" → Link erscheint
- [x] Tab „Eltern" → neue Zuordnung steht als `ausstehend` in der Liste
- [x] **Selbstbestätigung verboten:** die Person, die eingeladen hat, kann nicht selbst bestätigen → 409
- [x] Zweiter HouseAdmin (`admin.paul`) bestätigt die Zuordnung → Status `bestätigt`
- [x] **Erst danach** sieht der Elternteil das Kind

### 2.6 Beobachter einladen + Zuständigkeiten (Tab „Zuständigkeiten")
- [x] Raum wählen (Tab „Räume") → Tab „Zuständigkeiten" → RaumAdmin-Liste des Raums (nur Erwachsene mit Hausbezug, Kinder tauchen nicht auf)
- [x] Beobachter: Name eingeben → „Beobachter einladen" → Einladungslink (**raumgebunden**, kein Haus-Zugriff)
- [x] RaumAdmin anklicken + bestätigen → Zuständigkeit vergeben/entzogen; wirkt sofort

### 2.7 Abgrenzung
- [x] HouseAdmin sieht keine Kinder anderer Häuser
- [x] HouseAdmin allein hat **keine** Elternsicht (`admin.sonne` → „Meine Kinder" leer)

---

## 3 · Erzieher / RaumAdmin (`erzieher.tobias`)

- [x] `/admin` → Login → „Verwaltung öffnen" → Raumliste lädt automatisch; bei **einem** Raum wird dieser direkt geöffnet
- [x] Nur „Spielraum" Sonne sichtbar (nicht Lernraum, nicht Mond)
- [x] Spielfreigaben im eigenen Raum ändern → wirkt sofort
- [x] **Kein** Zugriff auf Hausverwaltung (Räume anlegen, Eltern einladen → verweigert; Nav-Button „Haus" ausgeblendet)
- [x] **Keine** Delegation möglich (kann keine weiteren Admins ernennen)
- [x] Emoji-Code-Werkzeuge nur mit Hausrecht sichtbar (Tobias sieht sie nicht)
- [x] Raumsicherung speichern → nach Freigabe-Änderung „wiederherstellen" → alte Freigaben zurück
- [x] Entzug der RaumAdmin-Rolle (durch HouseAdmin) → Tobias verliert Zugriff sofort

---

## 4 · Eltern

### 4.1 Gemeinsamer Erwachsenen-Login
- [x] `/admin` → `eltern.petra` → **kein** Verwaltungszugang, aber Kontext-Button „Meine Kinder"
- [x] Kinderliste lädt **automatisch** beim Öffnen — kein „Laden"-Klick nötig
- [x] `admin.paul` → bekommt **beide** Kontexte („Haus verwalten" + „Meine Kinder") — sichtbarer Wechsel; in der Elternansicht sind Verwaltungs-Nav-Buttons sichtbar, bei `eltern.petra` nicht
- [x] `beobachter.olga` → Kontext „Beobachtung"
- [x] `kontakt.rita` → Login ok, aber Kinderliste leer (widerrufene Beziehung)

### 4.2 Meine Kinder — Sichtbarkeit
- [x] `eltern.petra` sieht **nur** Lina (nicht Finn, Tom, Emil, Mia)
- [x] `eltern.martin` sieht Finn **und** Emil
- [x] `eltern.tim` sieht Tom; Emil nur als „ausstehend" (Einladung nicht bestätigt)
- [x] Fremdes Kind direkt anfragen (manipulierte ID) → 403

### 4.3 Aktivität (Live-Sicht)
- [x] Lina zeigt: läuft gerade, Spiel „Mathe-Abenteuer", 12 min verbraucht, Rest 33
- [x] Tom zeigt: pausiert, 28/30 min
- [x] Emil zeigt: Verbindung getrennt (Heartbeat älter als 2 min)
- [x] Finn zeigt: heute erschöpft

### 4.4 Bewertungen
- [x] Lina hat 4 Meldungen (tasks_done 8, tasks_correct 7, hints_used 2, round_complete)
- [x] Bewertungen nur für eigene Kinder; fremde → 403
- [x] Spiele ohne Bewertung (Snake) zeigen leere Liste, kein Fehler

### 4.5 Zeitbudget — Zweitbestätigungsregel
- [x] **Verschärfung sofort:** Tina setzt Tom 30→15 min → gilt sofort
- [x] **Lockerung braucht zweites Elternteil:** Tina setzt Tom 15→60 → Status „ausstehend", Tom spielt weiter mit 15
- [x] Tim bestätigt → 60 aktiv
- [x] Tim lehnt ab → bleibt 15
- [x] Hausvorgabe deckelt: Haus Sonne max. 120 min — Elternwert darüber wird auf 120 begrenzt

### 4.6 Einladung einlösen
- [x] `/parent-enroll?ticket=test-token-valid` → Benutzername+Passwort wählen → Konto aktiv
- [x] Ablauf: `test-token-expired` → „abgelaufen"; `test-token-used` → „bereits verwendet"
- [x] Nach Einlösung: Zuordnung steht `ausstehend`, bis HouseAdmin bestätigt

---

## 5 · Beobachter

### 5.1 Enroll
- [x] `/observer-enroll?ticket=test-token-observer` → Konto anlegen → aktiviert Observer-Rolle für **Lernraum**
- [x] Ticket zweimal nutzen → „bereits verwendet"

### 5.2 Sicht (nur Aggregate)
- [x] `beobachter.olga` → „Beobachtung" → Aggregatliste lädt **automatisch** beim Öffnen
- [x] Zahlen pro Raum: verbunden/spielend/pausiert/getrennt
- [x] **Keine** Namen, keine Einzelkinder, keine Bewertungen
- [x] Direktaufruf Eltern-Endpunkt → 403

---

## 6 · Kind / Spieler

### 6.1 Anmeldung
- [x] Lina: 🐶🐱🌳🏠 auf Haus Sonne → Raumliste zeigt Spielraum + Lernraum
- [x] Tom: 🦉🌷🐷🐘 → nur Spielraum
- [x] Sven: 🐷🐷🐷🐷 → abgelehnt (deaktiviert)
- [x] Lea: 🌷🌷🌷🌷 → Raumliste leer (Mitgliedschaft inaktiv)
- [x] Mia auf Haus Mond: gleiche Sequenz wie Lina, aber anderes Haus → funktioniert (hausunabhängig)
- [x] Falsche Sequenz → generische Ablehnung
- [x] 20 Fehlversuche → Rate-Limit

### 6.2 Spielliste & Start
- [x] Spielraum zeigt: Snake, Mathe-Abenteuer, Zahlen-Duell (nicht: draft, blocked)
- [x] Lernraum zeigt: Mathe-Abenteuer (Snake-Freigabe dort widerrufen → nicht sichtbar)
- [x] Spiel starten → `/play/<key>` lädt
- [x] Draft-Start (manipuliert) → 403; gesperrtes Spiel → 403

### 6.3 Spielzeit & Einzelsitzung
- [x] Heartbeat läuft (alle 30 s); nach ~2 min Tab-Inaktivität → Status „getrennt" für Eltern
- [x] **Einzelsitzung:** Lina startet auf zweitem Gerät → 409 „läuft bereits"
- [x] Nach Beenden auf Gerät 1 → Gerät 2 darf starten
- [x] Pause → zählt nicht als Spielzeit; Resume → weiter
- [x] Tom (28/30): Warnung „Noch 1 Minute"; bei 0 → Abschlussfrist, dann Sitzung endet
- [x] Finn (20/20): Start → „Tagesbudget aufgebraucht"
- [x] Tageswechsel: gestrige Minuten zählen nicht

### 6.4 Multiplayer — Zahlen-Duell (zwei Browser/Fenster)
- [x] Tom startet Zahlen-Duell → „Mitspielen" → Partie erstellt (er ist Gastgeber)
- [x] Lina startet Zahlen-Duell → „Mitspielen" → tritt Toms Partie bei
- [x] Tom: „Partie starten" → beide sehen die Aufgabe
- [x] Lina antwortet richtig → Team-Punkt + neue Aufgabe bei beiden
- [x] Tom-Tab schließen → bei Lina erscheint Tom als „getrennt"
- [x] Mia (Haus Mond) kann **nicht** beitreten → 403
- [x] Finn kann nicht beitreten (Budget erschöpft) → 403
- [x] Partie voll (max. 4) → fünftes Kind abgewiesen
- [x] Host beendet Partie → beide Sitzungen enden, beide sehen „beendet"
- [x] Kind mit laufender Einzelsitzung → „Mitspielen" verwendet dieselbe Sitzung (kein 409)

### 6.5 Bewertungsmeldung
- [x] Mathe-Abenteuer meldet Aufgaben → bei Petra unter „Bewertungen" sichtbar
- [x] Gleiche Meldung zweimal (Refresh/Doppelklick) → nur ein Eintrag

---

## 7 · Querschnitt: Daten & Datenschutz

### 7.1 Ändern wirkt sofort
- [x] Freigabe entziehen → laufender Spielstart blockiert
- [x] Rolle entziehen → laufende Admin-Sitzung verliert Rechte
- [x] Kind deaktivieren → dessen Session + Login blockiert

### 7.2 Export & Löschung (DSGVO)
- [x] Export einer Person → alle personenbezogenen Daten (Mitgliedschaften, Sitzungen, Bewertungen, Einladungen)
- [x] Emoji-Sequenzen im Export nur als Länge, nie im Klartext
- [x] Person löschen → anonymisiert (`[gelöscht]`), ihre Kanten entfernt
- [x] Gelöschte Person in Partie → Mitgliedschaft beendet, Aktionslog anonymisiert
- [x] **Restore-Test:** Backup vor Löschung → nach Restore bleibt Person gelöscht (Löschliste überlebt)

### 7.3 Persistenz
- [x] Server-Neustart → Personen, Räume, Freigaben, Partien bleiben
- [x] Aktive Sitzungen nach Neustart weg (RAM) — erwartetes Verhalten
- [x] Alte Daten (Schema v1/v2) werden beim Laden automatisch migriert

### 7.4 Audit
- [x] Jede Änderung schreibt Audit-Eintrag (wer, was, wo, wann)
- [x] Audit bleibt bei Löschung erhalten (Verwaltungsnachweis)

---

## 8 · Negativfälle (gezielt brechen)

- [x] Fremder `Origin`-Header → 403
- [x] Admin-API ohne Cookie → 401
- [x] `personId` im Request manipulieren → keine Rechteausweitung
- [x] Fremde `partyId` → 404
- [x] Party-Aktion ohne Mitgliedschaft → 403
- [x] Heartbeat mit manipulierter `playSessionId` → 404
- [x] Doppelte `eventId` bei Bewertung → dedupliziert
- [x] Einladungstoken raten → 404/„ungültig"
- [x] Aktionen vor Partie-Beginn → 409
- [x] Versionswechsel des Spiels während Partie → neue Beitritte blockiert

---

## Ergebnis-Notizen

| Datum | Tester | Version | Befunde |
|---|---|---|---|
| | | | |

| 2026-09-23 | automatisch (test-katalog-5-querschnitt) | HEAD | 148/148 bestanden |
