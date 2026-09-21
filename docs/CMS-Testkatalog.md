# CMS-Testkatalog — manueller Abnahmetest

**Stand:** nach Phase 4 (Multiplayer). Testet den aktuellen Datenstand und die UI.
**Vorgehen:** Jeden Punkt abhaken `[x]`. Bei Abweichung Zeilennummer + Beobachtung notieren.

---

## 0 · Vorbereitung

- [ ] **0.1** Testdaten frisch erzeugen: `node scripts/cms/cms-seed-testdata.cjs`
- [ ] **0.2** Testserver starten (erzeugt Testdaten + Zugangsdaten automatisch, falls sie fehlen):
  `node scripts/start-testserver.cjs` — läuft auf `http://localhost:8081`, beenden mit Strg+C
- [ ] **0.4** Basis-URL erreichbar: `http://localhost:8081` zeigt die Emoji-Anmeldung

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

### 1.1 Anmeldung
- [ ] `/admin` → `super` + Passwort → landet **sofort** auf `stage_super` (SuperAdmin-Stage, kein Zwischenschritt)
- [ ] Direkt-URL `/super` → SuperAdmin-Stage erscheint ebenfalls
- [ ] Falsches Passwort → generische Fehlermeldung, keine Details
- [ ] Nach 10 Fehlversuchen → Rate-Limit (429, „Bitte kurz warten")

### 1.2 Häuser verwalten (CRUD) — **nur auf `/super` (stage_super), nicht auf der HouseAdmin-Stage**
- [ ] **Anlegen:** Neues Haus „Haus Regenbogen" → erscheint in der Liste
- [ ] **Doppelt:** gleichen Namen nochmal → Fehler „existiert bereits"
- [ ] **Ändern:** Haus umbenennen → Name übernommen
- [ ] **Deaktivieren:** „Haus Mond" deaktivieren → HouseAdmin `admin.mond` kann sich **nicht** mehr anmelden; Kind Mia **nicht** mehr per Emoji einloggen
- [ ] **Reaktivieren:** Haus Mond wieder aktivieren → beide Zugänge funktionieren wieder

### 1.3 HouseAdmin einrichten
- [ ] Neue Person anlegen (z. B. „Neue Hausleitung")
- [ ] Einrichtungslink erzeugen → Link wird angezeigt (24 h gültig)
- [ ] Link einmal öffnen → Einrichtung möglich; **zweites** Öffnen → „bereits verwendet"
- [ ] Zuständigkeit zuweisen mit expliziter Bestätigung → Person sieht nur ihr Haus
- [ ] Zuständigkeit ohne Bestätigung → wird abgelehnt
- [ ] Zuständigkeit entziehen → Admin verliert Zugriff sofort (auch in laufender Sitzung)

### 1.4 Spielekatalog
- [ ] Spielliste zeigt alle 5 Spiele mit Status (published/draft/blocked)
- [ ] Spiel „Unfertiges Spiel" ist `draft` → Kinder sehen es nicht

### 1.5 Abgrenzung
- [ ] SuperAdmin sieht **keine** Kinderdaten (keine Elternsicht, kein room-pulse)
- [ ] SuperAdmin kann keine Eltern-Funktionen aufrufen (403)

---

## 2 · HouseAdmin (`admin.sonne`)

### 2.1 Anmeldung & Bereich
- [ ] `/admin` → `admin.sonne` → nur „Haus Sonne" wählbar, **kein** „Haus Mond"
- [ ] Direkter Aufruf fremder Haus-ID → 403

### 2.2 Räume (CRUD)
- [ ] **Anlegen:** Raum „Familienraum Test" → erscheint, aktiv
- [ ] **Doppelt:** gleicher Name → abgelehnt
- [ ] **Ändern:** umbenennen + deaktivieren → Status sichtbar
- [ ] Deaktivierter Raum: Kinder sehen ihn nicht in ihrer Raumliste; kein Spielstart
- [ ] Reaktivieren → wieder sichtbar

### 2.3 Kinder & Profile (CRUD)
- [ ] Kinderliste zeigt nur Kinder des eigenen Hauses
- [ ] Neues Profil anlegen → Emoji-Code vergeben → Kind kann sich anmelden
- [ ] **Doppelte Emoji-Folge** (z. B. Linas Code nochmal vergeben) → abgelehnt
- [ ] Person deaktivieren → deren Login schlägt fehl

### 2.4 Spielfreigaben
- [ ] Snake für Spielraum aktivieren → Kind sieht es in der Liste
- [ ] Freigabe entziehen → Spielstart verweigert, auch **in laufender Sitzung**

### 2.5 Eltern-Einladung + Zweitbestätigung
- [ ] Tab „Eltern" → Kind wählen (z. B. Emil) → „Einladen" → Link erscheint
- [ ] Neue Zuordnung steht als `ausstehend` in der Liste
- [ ] **Selbstbestätigung verboten:** die Person, die eingeladen hat, kann nicht selbst bestätigen → 409
- [ ] Zweiter HouseAdmin (`admin.paul`) bestätigt die Zuordnung → Status `bestätigt`
- [ ] **Erst danach** sieht der Elternteil das Kind

### 2.6 Beobachter einladen
- [ ] Tab „Beobachter" → Raum wählen + Name → Einladungslink
- [ ] Beobachter-Einladung ist **raumgebunden** (kein Haus-Zugriff)

### 2.7 Abgrenzung
- [ ] HouseAdmin sieht keine Kinder anderer Häuser
- [ ] HouseAdmin allein hat **keine** Elternsicht (`admin.sonne` → „Meine Kinder" leer)

---

## 3 · Erzieher / RaumAdmin (`erzieher.tobias`)

- [ ] `/admin` → Login → nur „Spielraum" Sonne sichtbar (nicht Lernraum, nicht Mond)
- [ ] Spielfreigaben im eigenen Raum ändern → wirkt sofort
- [ ] **Kein** Zugriff auf Hausverwaltung (Räume anlegen, Eltern einladen → verweigert)
- [ ] **Keine** Delegation möglich (kann keine weiteren Admins ernennen)
- [ ] Raumsicherung speichern → nach Freigabe-Änderung „wiederherstellen" → alte Freigaben zurück
- [ ] Entzug der RaumAdmin-Rolle (durch HouseAdmin) → Tobias verliert Zugriff sofort

---

## 4 · Eltern

### 4.1 Gemeinsamer Erwachsenen-Login
- [ ] `/admin` → `eltern.petra` → **kein** Verwaltungszugang, aber Kontext-Button „Meine Kinder"
- [ ] `admin.paul` → bekommt **beide** Kontexte („Haus verwalten" + „Meine Kinder") — sichtbarer Wechsel
- [ ] `beobachter.olga` → Kontext „Beobachtung"
- [ ] `kontakt.rita` → Login ok, aber Kinderliste leer (widerrufene Beziehung)

### 4.2 Meine Kinder — Sichtbarkeit
- [ ] `eltern.petra` sieht **nur** Lina (nicht Finn, Tom, Emil, Mia)
- [ ] `eltern.martin` sieht Finn **und** Emil
- [ ] `eltern.tim` sieht Tom; Emil nur als „ausstehend" (Einladung nicht bestätigt)
- [ ] Fremdes Kind direkt anfragen (manipulierte ID) → 403

### 4.3 Aktivität (Live-Sicht)
- [ ] Lina zeigt: läuft gerade, Spiel „Mathe-Abenteuer", 12 min verbraucht, Rest 33
- [ ] Tom zeigt: pausiert, 28/30 min
- [ ] Emil zeigt: Verbindung getrennt (Heartbeat älter als 2 min)
- [ ] Finn zeigt: heute erschöpft

### 4.4 Bewertungen
- [ ] Lina hat 4 Meldungen (tasks_done 8, tasks_correct 7, hints_used 2, round_complete)
- [ ] Bewertungen nur für eigene Kinder; fremde → 403
- [ ] Spiele ohne Bewertung (Snake) zeigen leere Liste, kein Fehler

### 4.5 Zeitbudget — Zweitbestätigungsregel
- [ ] **Verschärfung sofort:** Tina setzt Tom 30→15 min → gilt sofort
- [ ] **Lockerung braucht zweites Elternteil:** Tina setzt Tom 15→60 → Status „ausstehend", Tom spielt weiter mit 15
- [ ] Tim bestätigt → 60 aktiv
- [ ] Tim lehnt ab → bleibt 15
- [ ] Hausvorgabe deckelt: Haus Sonne max. 120 min — Elternwert darüber wird auf 120 begrenzt

### 4.6 Einladung einlösen
- [ ] `/parent-enroll?ticket=test-token-valid` → Benutzername+Passwort wählen → Konto aktiv
- [ ] Ablauf: `test-token-expired` → „abgelaufen"; `test-token-used` → „bereits verwendet"
- [ ] Nach Einlösung: Zuordnung steht `ausstehend`, bis HouseAdmin bestätigt

---

## 5 · Beobachter

### 5.1 Enroll
- [ ] `/observer-enroll?ticket=test-token-observer` → Konto anlegen → aktiviert Observer-Rolle für **Lernraum**
- [ ] Ticket zweimal nutzen → „bereits verwendet"

### 5.2 Sicht (nur Aggregate)
- [ ] `beobachter.olga` → „Beobachtung" → Zahlen pro Raum: verbunden/spielend/pausiert/getrennt
- [ ] **Keine** Namen, keine Einzelkinder, keine Bewertungen
- [ ] Direktaufruf Eltern-Endpunkt → 403

---

## 6 · Kind / Spieler

### 6.1 Anmeldung
- [ ] Lina: 🐶🐱🌳🏠 auf Haus Sonne → Raumliste zeigt Spielraum + Lernraum
- [ ] Tom: 🦉🌷🐷🐘 → nur Spielraum
- [ ] Sven: 🐷🐷🐷🐷 → abgelehnt (deaktiviert)
- [ ] Lea: 🌷🌷🌷🌷 → Raumliste leer (Mitgliedschaft inaktiv)
- [ ] Mia auf Haus Mond: gleiche Sequenz wie Lina, aber anderes Haus → funktioniert (hausunabhängig)
- [ ] Falsche Sequenz → generische Ablehnung
- [ ] 20 Fehlversuche → Rate-Limit

### 6.2 Spielliste & Start
- [ ] Spielraum zeigt: Snake, Mathe-Abenteuer, Zahlen-Duell (nicht: draft, blocked)
- [ ] Lernraum zeigt: Mathe-Abenteuer (Snake-Freigabe dort widerrufen → nicht sichtbar)
- [ ] Spiel starten → `/play/<key>` lädt
- [ ] Draft-Start (manipuliert) → 403; gesperrtes Spiel → 403

### 6.3 Spielzeit & Einzelsitzung
- [ ] Heartbeat läuft (alle 30 s); nach ~2 min Tab-Inaktivität → Status „getrennt" für Eltern
- [ ] **Einzelsitzung:** Lina startet auf zweitem Gerät → 409 „läuft bereits"
- [ ] Nach Beenden auf Gerät 1 → Gerät 2 darf starten
- [ ] Pause → zählt nicht als Spielzeit; Resume → weiter
- [ ] Tom (28/30): Warnung „Noch 1 Minute"; bei 0 → Abschlussfrist, dann Sitzung endet
- [ ] Finn (20/20): Start → „Tagesbudget aufgebraucht"
- [ ] Tageswechsel: gestrige Minuten zählen nicht

### 6.4 Multiplayer — Zahlen-Duell (zwei Browser/Fenster)
- [ ] Tom startet Zahlen-Duell → „Mitspielen" → Partie erstellt (er ist Gastgeber)
- [ ] Lina startet Zahlen-Duell → „Mitspielen" → tritt Toms Partie bei
- [ ] Tom: „Partie starten" → beide sehen die Aufgabe
- [ ] Lina antwortet richtig → Team-Punkt + neue Aufgabe bei beiden
- [ ] Tom-Tab schließen → bei Lina erscheint Tom als „getrennt"
- [ ] Mia (Haus Mond) kann **nicht** beitreten → 403
- [ ] Finn kann nicht beitreten (Budget erschöpft) → 403
- [ ] Partie voll (max. 4) → fünftes Kind abgewiesen
- [ ] Host beendet Partie → beide Sitzungen enden, beide sehen „beendet"
- [ ] Kind mit laufender Einzelsitzung → „Mitspielen" verwendet dieselbe Sitzung (kein 409)

### 6.5 Bewertungsmeldung
- [ ] Mathe-Abenteuer meldet Aufgaben → bei Petra unter „Bewertungen" sichtbar
- [ ] Gleiche Meldung zweimal (Refresh/Doppelklick) → nur ein Eintrag

---

## 7 · Querschnitt: Daten & Datenschutz

### 7.1 Ändern wirkt sofort
- [ ] Freigabe entziehen → laufender Spielstart blockiert
- [ ] Rolle entziehen → laufende Admin-Sitzung verliert Rechte
- [ ] Kind deaktivieren → dessen Session + Login blockiert

### 7.2 Export & Löschung (DSGVO)
- [ ] Export einer Person → alle personenbezogenen Daten (Mitgliedschaften, Sitzungen, Bewertungen, Einladungen)
- [ ] Emoji-Sequenzen im Export nur als Länge, nie im Klartext
- [ ] Person löschen → anonymisiert (`[gelöscht]`), ihre Kanten entfernt
- [ ] Gelöschte Person in Partie → Mitgliedschaft beendet, Aktionslog anonymisiert
- [ ] **Restore-Test:** Backup vor Löschung → nach Restore bleibt Person gelöscht (Löschliste überlebt)

### 7.3 Persistenz
- [ ] Server-Neustart → Personen, Räume, Freigaben, Partien bleiben
- [ ] Aktive Sitzungen nach Neustart weg (RAM) — erwartetes Verhalten
- [ ] Alte Daten (Schema v1/v2) werden beim Laden automatisch migriert

### 7.4 Audit
- [ ] Jede Änderung schreibt Audit-Eintrag (wer, was, wo, wann)
- [ ] Audit bleibt bei Löschung erhalten (Verwaltungsnachweis)

---

## 8 · Negativfälle (gezielt brechen)

- [ ] Fremder `Origin`-Header → 403
- [ ] Admin-API ohne Cookie → 401
- [ ] `personId` im Request manipulieren → keine Rechteausweitung
- [ ] Fremde `partyId` → 404
- [ ] Party-Aktion ohne Mitgliedschaft → 403
- [ ] Heartbeat mit manipulierter `playSessionId` → 404
- [ ] Doppelte `eventId` bei Bewertung → dedupliziert
- [ ] Einladungstoken raten → 404/„ungültig"
- [ ] Aktionen vor Partie-Beginn → 409
- [ ] Versionswechsel des Spiels während Partie → neue Beitritte blockiert

---

## Ergebnis-Notizen

| Datum | Tester | Version | Befunde |
|---|---|---|---|
| | | | |
