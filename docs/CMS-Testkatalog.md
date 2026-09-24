# CMS-Testkatalog — manueller Abnahmetest

**Stand:** nach Phase 4 (Multiplayer) + deklarative Server-Migration (alle Endpunkte als Server-Stages in `GCS-CMS.json`; externe Verträge unverändert). Testet den aktuellen Datenstand und die UI.
**Vorgehen:** Nur tatsächlich geprüfte Punkte abhaken `[x]`. Bei Abweichung Abschnitt, Szenario-ID und Beobachtung notieren.

**Erweiterung:** Rollen- und Mandantenszenarien RS01–RS16 aus `CMS-Plan.md` §12 sowie T-L1–T-L7 aus `CMS-Testluecken.md` sind unten fachlich einsortiert. Aufnahme bedeutet weder Implementierung noch bestandenen Test. Fehlende Fixtures oder offene Fachregeln als **blockiert** protokollieren, nicht überspringen oder abhaken.

**Automatische Auswertung:** Bestehende Abschnittsnummern und Checkboxpositionen bleiben erhalten; neue Fälle stehen in eigenen Unterabschnitten. Auch die historische doppelte Überschrift 1.5 bleibt vorerst erhalten (`1.5#2` im Reporter). Korrigierte Alt-Erwartungen müssen bei der nächsten Testanpassung mit den automatisierten Assertions abgeglichen werden. Alte Ergebnisdateien sind kein Nachweis für diesen erweiterten Katalog; den nächsten Lauf frisch beginnen.

---

## Aufbau ab null — verbindlicher Ablauf für die nächste Implementierung

**Status: Aufbauläufe implementiert und grün — Abdeckung teilweise
(s. Zuordnung unten).** Dieser Abschnitt bestimmt Aufgabenreihenfolge und
Abhängigkeiten; die nummerierten Kapitel darunter liefern die Detailprüfungen.
Es entsteht kein zweiter Katalog. Der komplette Aufbau ist der fachliche
Abnahmeweg; vorhandene Seed-Tests bleiben ergänzende Einzelregression.

### Zwei ausdrücklich getrennte Betriebsarten

- **Aufbaulauf:** frisches temporäres CMS mit notwendiger Plattformstruktur, genau
  einer aktiven SuperAdmin-Person, deren Root-Rolle und Testzugang. Keine Häuser,
  Räume, weiteren Personen, Beziehungen, Einladungen oder Spielsitzungen vorbereiten.
  Leere schemaerforderliche Collections sind erlaubt. Fachliche Daten ausschließlich
  über reale CMS-Bedienwege erzeugen. Der bisherige Seed-Befehl ist hierfür ungeeignet.
- **Einzelregression:** vorbereitete synthetische Fixtures gemäß Kapitel 0 nutzen.
  Sie helfen bei Diagnose, beweisen aber nicht deren Einrichtung über die Oberfläche.
- Reale neu erzeugte IDs unter logischen Schlüsseln wie `hausSonne` speichern;
  nicht die festen Seed-IDs erwarten. Passwörter/Tickets nicht in Berichte schreiben.
- Testspielpakete dürfen lokale Eingabedateien sein, müssen im Aufbaulauf aber über
  den vorgesehenen CMS-Weg bereitgestellt werden. Fehlenden Bedienweg als Lücke melden.

### Aufgaben mit stabilen IDs

Reihenfolge ist eine Ausführungsempfehlung, keine pauschale Abhängigkeit. Eine Zeile
mit mehreren unabhängigen Aktionen wird bei Implementierung in stabile Unter-IDs
(z. B. `RAUM-02-a`) zerlegt. Jede Unteraufgabe hat ein eigenes Ergebnis.

| ID | Rolle / Handlung | Notwendige Voraussetzung | Erwartung / Detailvertrag |
|---|---|---|---|
| BASIS-01 | Minimalbestand validieren und SuperAdmin anmelden | Isolierte Umgebung | Genau ein Konto; `stage_super`, verständliche Leerzustände; 1.1 |
| HAUS-01 | SuperAdmin legt Sonne an | BASIS-01 | Haus gespeichert, ohne Räume; 1.2 |
| ADMIN-01 | Person anlegen und Hausrolle Sonne zuweisen | HAUS-01 | Sichtbare Person und Zuständigkeit; 1.3.1 |
| ADMIN-02 | Einladen und Zugang einrichten | ADMIN-01 | Einmaliger Link, verwendbarer eigener Zugang; 1.3.1 |
| ADMIN-03 | Neuer HouseAdmin in eigenem Kontext anmelden | ADMIN-02 | `stage_house`, leeres Haus bedienbar; 2.1.2 |
| RAUM-01 | HouseAdmin legt Spielraum an | ADMIN-03 | Raum gehört zu Sonne; 2.2 |
| RAUM-02 | Raum umbenennen | RAUM-01 | Änderung gespeichert; 2.2; kein Erfordernis für Spielfreigabe |
| RAUM-03 | Zweiten Raum Lernraum anlegen | ADMIN-03 | Unabhängig von RAUM-01/02 ausführbar; 2.2 |
| ERZ-01 | Reinen RaumAdmin einrichten und anmelden | RAUM-01 | Zugang über realen Einrichtungsweg; nur Spielraum; 3.1 |
| KIND-01 | Kind im Spielraum anlegen und anmelden | RAUM-01 | Profil und erlaubte Raumsicht; 2.3, 6.1 |
| ADMIN-04 | Zweiten HouseAdmin für Bestätigungen einrichten | HAUS-01, BASIS-01 | Eigenständiger Zugang; keine Direktinjektion in Daten |
| ELTERN-01 | Elternteil einladen, einlösen, erforderliche Bestätigungen durchführen | KIND-01, ADMIN-04 | Bestätigte Beziehung über realen Vertrag; 2.5, 4.6 |
| ELTERN-02 | Eltern anmelden, eigene/fremde Sicht prüfen | ELTERN-01; fremdes Kind für Negativfall | Private Daten nur gemäß Beziehung; 4.2–4.5 |
| OBS-01 | Beobachter einrichten und anmelden | RAUM-01 | Nur erlaubte Aggregate; 2.6, 5 |
| HAUS-02 | SuperAdmin legt Mond an | BASIS-01 | Unabhängig von Sonne-Aufgaben; 1.2 |
| MOND-01 | Eigenen HouseAdmin, Raum und Kind in Mond aufbauen | HAUS-02 | ADMIN-/RAUM-/KIND-Abläufe mit eigenem Kontext wiederverwenden |
| HAUS-03 | Drittes aktives Kontrollhaus anlegen | BASIS-01 | Fremde aktive Ressource für Zweihäuser-Negativtest |
| GRENZE-01 | Sonne-Admin greift auf Mond zu | ADMIN-03, MOND-01 | Lesen/Schreiben abgewiesen, eigene Kontrolle erfolgreich; 2.8 |
| MULTI-01 | Sonne-Admin zusätzlich Mond zuweisen | ADMIN-03, HAUS-02 | Zwei Häuser, Kontextwechsel; drittes Haus gesperrt bei HAUS-03; 2.1.1 |
| MULTI-02 | Admin zusätzlich bestätigte Elternbeziehung geben | KIND-01, ADMIN-04; passendes Admin-Konto | Getrennte Verwaltungs-/Privatrechte; 4.1.1 |
| MULTI-03 | Hausrolle Sonne + reine Raumrolle Mond kombinieren | ADMIN-03, MOND-01; separates Konto | Kein Hausrecht in Mond; 2.8; nicht MULTI-01-Konto wiederverwenden |
| SUPER-01 | Weiteren SuperAdmin einrichten und anmelden | BASIS-01 | Vollständiger Lifecycle statt Seed-Login; 1.4.1 |
| SPIEL-01 | SuperAdmin stellt Testspiel bereit | BASIS-01; gültiges Testspielpaket | Realer Bereitstellungsweg und Status; 1.5 |
| SPIEL-02 | HouseAdmin gibt Spiel frei | ADMIN-03, RAUM-01, SPIEL-01 | Freigabe im richtigen Raum; 2.4 |
| SPIEL-03 | Kind spielt; Eltern prüfen Aktivität | KIND-01, SPIEL-02; ELTERN-01 nur für Elternprüfung | Start/Zeit/Bewertung getrennt prüfen; 4.3–4.5, 6.2–6.5 |
| LEBEN-01 | Reset, Deaktivierung, Rollen-/Beziehungsentzug | Jeweils eingerichtete betroffene Konten | Getrennte Unterfälle; 1.3.2, 7.1.1; andere Aufgaben nicht beschädigen |
| SESSION-01 | Fehlende/abgelaufene Sitzung und Personenwechsel | BASIS-01; weitere Konten je Unterfall | 7.1.2; bewusst geteilter Kontext nur beim Gerätewechseltest |
| DATEN-01 | Export, Löschung, Restore | Entsprechende synthetische Daten | Späte separate Varianten; 7.2–7.4 |
| UMGEBUNG-01 | Editor-Run, Serverstand, Dateilocks | Jeweilige Umgebung | 0.6, 7.3.1/7.3.2; nicht pauschal automatisierbar |

Diese Tabelle ist die erste Arbeitsaufteilung, keine Behauptung vollständiger
Automatisierung. Vor Abschluss jede Checkbox aus Kapitel 0–8 einer Aufgaben-ID
oder einem ausdrücklich manuellen Nachweis zuordnen; insbesondere weitere Kinder,
Mehrfachrollenvarianten und Multiplayer als eigene Unteraufgaben ergänzen.

### Zuordnung: ausführbare Aufbauläufe (scripts/test-aufbau-*.cjs)

Alle Läufe starten auf dem Minimalbestand (`bootMinimal`), bedienen die UI mit
echten Klicks und bewerten Aufgaben einzeln; `dep(...)` prüft Ressourcen statt
nur Aufgabenerfolg. Stand der automatisierten Abdeckung:

| Lauf | Abgedeckte IDs |
|---|---|
| `test-aufbau-0-basis.cjs` | BASIS-01, HAUS-01 |
| `test-aufbau-1-admin.cjs` | ADMIN-01 … ADMIN-03 |
| `test-aufbau-2-raeume.cjs` | RAUM-01, RAUM-02, RAUM-03, RAUM-04 (Umbenennen/Aktivstatus), GRENZE-02 (unbekanntes Haus) |
| `test-aufbau-3-personen.cjs` | KIND-01, ELTERN-01 (Einladung + Zweitbestätigung), OBS-01 — ELTERN-02a deckte Befund **T-L9** auf (`guardian-approve` meldete falschen Erfolg); Fix umgesetzt, der Test verifiziert ihn beim nächsten Lauf (erwartet 409 + unveränderten Bestand) |
| `test-aufbau-4-mandant.cjs` | HAUS-02, MOND-01 (ohne Kind), GRENZE-01 (exakte Mengen + Kontrollaktion), MULTI-01 |
| `test-aufbau-5-spiele.cjs` | SPIEL-01, SPIEL-02, SPIEL-03 (UI-Launch über `/api/cms/launch` mit Sitzungsnachweis; Freigabeentzug → exakt 403) |
| `test-aufbau-6-leben.cjs` | LEBEN-01 … LEBEN-03 (Reset invalidiert eine frisch angelegte Sitzung), SESSION-01 |

**Noch nicht durch Aufbauläufe abgedeckt:** ERZ-01 (Bedienweg fehlt produktseitig),
HAUS-03, MULTI-02, MULTI-03, SUPER-01, ELTERN-02 (Elternsicht eigene/fremde Daten
inkl. Negativfall mit realem fremden Kind), OBS-01-Datenumfang (nur Aggregate),
SPIEL-03-Zeit/Bewertung und Elternprüfung, LEBEN-Beziehungsentzug, DATEN-01,
UMGEBUNG-01, Session-Unterfälle (abgelaufen/Personenwechsel).

### Fehlerfortsetzung und Sitzungsisolation

1. Pro Person eigenen Playwright-Browserkontext mit echten Login-Cookies verwenden.
   Tabs desselben Kontexts sind keine unabhängigen Sitzungen. Alle Kontexte verwenden
   denselben isolierten Testserver und damit denselben fachlichen Datenbestand.
2. Vor jeder Aufgabe konkrete benötigte Ressourcen/Rechte prüfen. Nicht einfach
   den Erfolg der gesamten vorherigen Aufgabe verlangen: Ein Raum kann trotz
   fehlerhafter Erfolgsmeldung nachweislich angelegt sein. Ursprungsfehler bleibt rot.
3. Zustände: `bestanden`, `fehlgeschlagen`, `blockiert` (fehlende Voraussetzung samt
   Erzeuger-ID), `nicht ausgeführt` (z. B. manuell/offen). Keine stillen grünen Skips.
4. Bei Fehler Screenshot, sichere technische Fehlermeldung und Soll/Ist sichern;
   danach Seite neu öffnen und Zustand prüfen. Keine beliebigen Sleeps oder
   blinden Wiederholungen schreibender Aktionen: doppelte Personen wären ein Folgefehler.
5. Unabhängige Aufgaben weiter ausführen, auch bei Assertion- oder Bedienfehlern.
   Nicht nur Assertions weich machen: auch fehlgeschlagene UI-Aktionen behandeln.
   Unbekannten Datenzustand nicht mit direkten JSON-Schreibzugriffen reparieren.
6. Bei Serverausfall keine irreführenden Produktfehler für jede weitere Aufgabe
   erzeugen: Infrastrukturfehler melden, betroffene Aufgaben begründet blockieren.
7. Deaktivierung/Löschung mit eigenen Testpersonen oder als späte Varianten ausführen.
   Mehrfachrollen nicht nachträglich auf das Konto des reinen RaumAdmin-Tests mischen.
8. Am Ende alle Ergebnisse berichten. Fehler ergeben einen fehlschlagenden Prozessstatus;
   blockierte oder nicht ausgeführte Pflichtprüfungen erlauben ebenfalls keine Gesamtabnahme.
9. Bericht je Aufgabe: ID, Rolle, logische Ressourcen, Voraussetzungen, Soll/Ist,
   Status, Fehlerbeleg, Folgeblockaden. Keine Passwörter, Cookies oder Einladungslinks.
10. Vorhandener Reporter verwendet Positionen und bildet diese Zustände noch nicht
    vollständig ab. Erst kontrolliert auf stabile IDs umstellen; Altzuordnungen
    explizit abbilden und testen, keine Ergebnisdateien nachträglich grün übertragen.

## 0 · Vorbereitung (bestehende Seed-Einzelregression)

- [ ] **0.1** Testdaten frisch erzeugen: `node scripts/cms/cms-seed-testdata.cjs`
- [ ] **0.2** Testserver nach expliziter Datenerzeugung aus 0.1 starten (nicht auf automatische Erzeugung fehlender Dateien verlassen):
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

### 0.5 Isolierung, Zusatzfixtures und Nachweisregeln

- [ ] Ausschließlich synthetischen Testbestand verwenden; keine echten CMS-Daten oder Zugangsdaten verändern. Build-/Startbefehle führt der Nutzer aus, sofern nicht ausdrücklich delegiert.
- [ ] Ausgangsstand je Szenario wiederherstellen; unabhängige Browserkontexte verwenden. Nur Sitzungswechseltests teilen absichtlich einen Kontext.
- [ ] Für RS03 zusätzliches Konto mit Hausrollen auf Sonne UND Mond sowie ein drittes **aktives**, fremdes Haus vorbereiten. Benutzername und stabile IDs im Ergebnis notieren; diese Zusatzfixture ist noch umzusetzen.
- [ ] Zusatzfixtures für RS06 (RaumAdmin + bestätigter Elternteil), RS07 (inaktive Rolle), RS09 (inaktive Person), RS10 (aktives + inaktives Haus), RS14 (Haus ohne Räume) und RS15 (Hausrolle Sonne + Raumrolle Mond) bereitstellen. Keine erfundenen Rollennamen: `areaAdmin` auf Haus bzw. Raum; Elternrecht über Guardian-Beziehung.
- [ ] Erwartete erlaubte und verbotene IDs vor Testbeginn festhalten. Listen als exakte Mengen prüfen, nicht nur auf Vorhandensein eines erlaubten Eintrags.
- [ ] Zu jeder abgewiesenen Mutation passende erlaubte Kontrollaktion testen. Danach persistierte Fachdaten unverändert nachweisen; erwartete Auditänderungen separat behandeln.
- [ ] Bei unbestimmten Statuscodes/Fachregeln Vertrag zuerst abstimmen. Kein beliebiger Fehler und insbesondere kein 500 gilt als bestandene Autorisierungsprüfung.

### 0.6 Laufender Serverstand (T-L5)

- [ ] Tatsächlich verwendeten Prozess, Port, Projektstand und Runtime-Stand dokumentieren; alter Prozess darf nicht unbemerkt als aktueller Teststand gelten.
- [ ] **Noch umzusetzender Vertrag:** Server-Buildkennung mit erwartetem Stand vergleichen; Vorschlag `GET /api/cms/version` mit `version`, `builtAt`, `gitSha`. Fehlender Endpunkt bleibt offen, nicht als vorhanden voraussetzen.
- [ ] Nach Implementierung absichtlich abweichenden Serverstand erkennen; Testlauf meldet Abweichung deutlich statt unbemerkt weiterzulaufen.

## 1 · SuperAdmin (`super`)

### 1.1 Anmeldung & Übersicht (Landingpage `stage_super`)
- [ ] `/admin` → `super` + Passwort → landet **sofort** auf `stage_super` (Übersicht, kein Zwischenschritt)
- [ ] Direkt-URL `/super` → Übersicht erscheint ebenfalls
- [ ] Falsches Passwort → generische Fehlermeldung, keine Details
- [ ] Nach 10 Fehlversuchen → Rate-Limit (429, „Bitte kurz warten")
- [ ] **Sidebar links:** Einträge „Übersicht · Häuser · SuperAdmins · Meine Spiele · Anmeldung", aktiver Eintrag mit `▸` markiert — auf **allen** Super-Stages identisch
- [ ] **Aufgabenkarten:** drei Karten (Häuser / SuperAdmins / Meine Spiele) führen in die jeweilige Unter-Stage
- [ ] **Kennzahlen:** „Häuser: X aktiv von Y · SuperAdmins: Z"

### 1.2 Häuser verwalten (`stage_super_houses`)
- [ ] **Tabelle:** Häuser als Zeilen mit Spalten *Haus · HouseAdmins · Personen · Räume · Aktiv* (Zusatzinfos direkt sichtbar)
- [ ] **Karten ⇄ Tabelle:** „⇄ als Karten"-Button schaltet die Ansicht um — Karten zeigen dieselben Zusatzinfos; zurückschalten möglich
- [ ] **Anlegen:** Feld „Hausname" + „Anlegen" → neues Haus erscheint als Tabellenzeile
- [ ] **Doppelt:** gleichen Namen nochmal → Fehler „existiert bereits"
- [ ] **Zeile anklicken** (oder Karte) → `stage_super_house` mit Kontextpfad „Plattform › Häuser › <Name>"

### 1.3 Haus-Details & HouseAdmins (`stage_super_house`)
- [ ] „← Häuser" (oder Sidebar) führt zurück zur Übersichtsliste — Hausauswahl bleibt während des Besuchs erhalten
- [ ] **Ändern:** Haus umbenennen → Name übernommen (auch im Kontextpfad)
- [ ] **Deaktivieren:** „Haus Mond" deaktivieren → HouseAdmin `admin.mond` kann sich **nicht** mehr anmelden; Kind Mia **nicht** mehr per Emoji einloggen
- [ ] **Reaktivieren:** Haus Mond wieder aktivieren → beide Zugänge funktionieren wieder
- [ ] **Spieler-Link:** Button erzeugt Einwahllink `/?house=…` für das Haus
- [ ] **HouseAdmin-Tabelle:** Personen mit Spalten *Name · Zugang · Weitere Häuser · Admin*
- [ ] Neue Person anlegen → erscheint in der Tabelle
- [ ] Person in Tabelle wählen → „Einladen" erzeugt Einrichtungslink (24 h gültig); **zweites** Öffnen → „bereits verwendet"
- [ ] Zuständigkeit: Zeile wählen → Bestätigungsbutton → zuweisen/entziehen; Entzug wirkt sofort (auch in laufender Sitzung)

### 1.3.1 Vollständiger HouseAdmin-Lebenszyklus (RS02, T-L2, T-L3)

- [ ] Neue synthetische Person über echte UI anlegen; erscheint mit verständlichem Kontostatus. Noch keine Zuständigkeit oder fertigen Zugang suggerieren.
- [ ] Person wählen, HouseAdmin-Zuständigkeit ausdrücklich bestätigen; Hausbezug und Rollenstatus werden sichtbar aktualisiert.
- [ ] Einladung erstellen, Link im separaten Browserkontext öffnen und Zugang einrichten; danach wirklich mit den neuen Credentials anmelden.
- [ ] Neuer HouseAdmin landet direkt auf `stage_house`, nicht auf Raumverwaltung oder SuperAdmin; sieht ausschließlich sein Haus.
- [ ] Abgebrochene/fehlgeschlagene Schritte zeigen verständliche Rückmeldung und erlauben Fortsetzung; kein interner Dateipfad in der UI.

### 1.3.2 Admin-Detailverwaltung und Zugang (T-L7, RS09)

- [ ] Admin auswählen → Detailseite mit korrekter Person und korrektem Haus; Zurück führt ins gewählte Haus. Profil, Hauszuständigkeit und globaler Kontostatus sind getrennt beschriftet.
- [ ] Name und Avatar ändern, speichern, Detailseite erneut öffnen: gespeicherte Werte und aktualisierte Übersicht stimmen überein.
- [ ] Aktivstatus ändern: Abbrechen verändert nichts; Bestätigen ändert Status sichtbar. Inaktive Person bleibt verwaltbar.
- [ ] Eigenes Konto deaktivieren wird serverseitig abgelehnt; fremdes inaktives Konto kann sich nicht anmelden.
- [ ] Bereits angemeldetes Konto deaktivieren: nächster geschützter Request und UI-Zugriff werden abgewiesen, nicht erst nach Browser-Neustart.
- [ ] Passwort-Reset abbrechen verändert nichts; bestätigen erzeugt gültigen Reset-Link, Benutzername bleibt erhalten.
- [ ] Reset-Link tatsächlich im Browser einlösen, neues Passwort setzen und neu anmelden; altes Passwort wird abgewiesen. Vorherige Sitzung separat auf Ungültigkeit prüfen.
- [ ] Reset-Link erneut verwenden, ablaufen lassen und durch neuen Link ersetzen: Wiederverwendung, abgelaufener und ersetzter Link werden abgewiesen.
- [ ] Person ohne erforderliche aktive Zuständigkeit: Einladung/Reset gemäß freigegebenem Vertrag gesperrt; kein scheinbar nutzbarer Link mit irreführender Erfolgsmeldung.
- [ ] Felder und Aktionen bleiben innerhalb der Stage-Fläche, überdecken sich nicht und sind tatsächlich per Maus/Tastatur bedienbar.

### 1.4 SuperAdmins verwalten (`stage_super_admins`)
- [ ] Tabelle aller Personen mit Spalten *Name · Zugang · SuperAdmin* (Kartenansicht umschaltbar)
- [ ] Zeile wählen + bestätigen → SuperAdmin-Rolle vergeben (plattformweit)
- [ ] Eigene SuperAdmin-Rolle entziehen → wird abgelehnt („eigene Rolle kann nicht entzogen werden")
- [ ] SuperAdmin-Einladungslink für neue Person → Einrichtung → Login landet auf `stage_super`

### 1.4.1 Neuer SuperAdmin statt Seed-Konto (RS11, T-L1, T-L3)

- [ ] Neue Person anlegen → Zeile wählen → SuperAdmin-Rolle bestätigen → einladen; Zwischenzustände der Tabelle und Linkausgabe prüfen.
- [ ] Einrichtungslink in frischem Browserkontext einlösen → mit neuem Konto anmelden → unmittelbar `stage_super`; eine erlaubte SuperAdmin-Aktion durchführen.
- [ ] Neue Verwaltungsrolle gewährt keine private Elternsicht; fremde Bewertungen bleiben gesperrt (zusätzlich zu Abgrenzung 1.5).

### 1.5 Spielekatalog (`stage_library`, Sidebar ebenfalls vorhanden)
- [ ] Spielliste zeigt alle 5 Spiele mit Status (published/draft/blocked)
- [ ] Spiel „Unfertiges Spiel" ist `draft` → Kinder sehen es nicht

### 1.5 Abgrenzung
- [ ] SuperAdmin sieht **keine** Kinderdaten (keine Elternsicht, kein room-pulse)
- [ ] SuperAdmin kann keine Eltern-Funktionen aufrufen (403)

---

## 2 · HouseAdmin (`admin.sonne`)

### 2.1 Anmeldung & Bereich
- [ ] `/admin` → `admin.sonne` anmelden → landet unmittelbar auf `stage_house` (Hausverwaltung), nicht auf der Raumverwaltung
- [ ] Navigation „Haus" → Hausverwaltung; bei **einem** Haus wird dieses automatisch geöffnet (keine Zwischenwahl)
- [ ] Hausliste lädt **automatisch** beim Öffnen der Stage — kein manueller „Laden"-Klick nötig
- [ ] Fremdes Haus per Direktaufruf (manipulierte `houseId`) → 403

### 2.1.1 Mehrere Häuser und Kontextwechsel (RS02, RS03)

- [ ] Einhaus-Konto `admin.sonne`: Hausliste enthält exakt Sonne; Mond ist nicht sichtbar.
- [ ] Zweihäuser-Konto anmelden → `stage_house`; Sonne UND Mond verfügbar, drittes aktives Kontrollhaus nicht sichtbar.
- [ ] Beide erlaubten Häuser nacheinander öffnen und jeweils eine erlaubte Änderung durchführen; Persistenz im richtigen Haus nachweisen.
- [ ] Haus wechseln: Tabellen, Auswahl und Formularwerte passen zum neuen Haus. Keine Aktion verwendet unbemerkt eine alte Haus-/Raum-ID.

### 2.1.2 Neues Haus ohne Räume (RS14)

- [ ] HouseAdmin des leeren Hauses anmelden → Hausverwaltung mit verständlichem Leerzustand und erreichbarer Aktion „Raum anlegen“.
- [ ] Ersten Raum anlegen → erscheint im gewählten Haus; anschließend Spielerzuordnung möglich. Keine Vorbedingung eines bereits vorhandenen Raums.

### 2.2 Räume (Tab „Räume")
- [ ] **Anlegen:** Raum „Familienraum Test" → erscheint in der Liste, aktiv
- [ ] **Doppelt:** gleicher Name → abgelehnt
- [ ] **Ändern:** Raum anklicken → umbenennen + deaktivieren → „Speichern"/„An-Aus" → Status sichtbar
- [ ] Deaktivierter Raum: Kinder sehen ihn nicht in ihrer Raumliste; kein Spielstart
- [ ] Reaktivieren → wieder sichtbar

### 2.3 Kinder & Profile
- [ ] Tab „Räume" → Raum wählen → Formular „Neues Spielerprofil": Name, Avatar, 4 Bild-IDs → „Profil anlegen"
- [ ] Tab „Kinder" → Liste zeigt nur Kinder des eigenen Hauses
- [ ] **Doppelte Emoji-Folge** (z. B. Linas Code nochmal vergeben) → abgelehnt
- [ ] Kind kann sich nach dem Anlegen sofort per Emoji anmelden

### 2.4 Spielfreigaben
- [ ] Raumverwaltung (`/admin`): Snake für Spielraum aktivieren → Kind sieht es in der Liste
- [ ] Freigabe entziehen → Spielstart verweigert, auch **in laufender Sitzung**

### 2.5 Eltern-Einladung + Zweitbestätigung
- [ ] Tab „Kinder" → Kind wählen (z. B. Emil) → Elternname eingeben → „Elternteil einladen" → Link erscheint
- [ ] Tab „Eltern" → neue Zuordnung steht als `ausstehend` in der Liste
- [ ] **Selbstbestätigung verboten:** die Person, die eingeladen hat, kann nicht selbst bestätigen → 409
- [ ] Zweiter HouseAdmin (`admin.paul`) bestätigt die Zuordnung → Status `bestätigt`
- [ ] **Erst danach** sieht der Elternteil das Kind

### 2.6 Beobachter einladen + Zuständigkeiten (Tab „Zuständigkeiten")
- [ ] Raum wählen (Tab „Räume") → Tab „Zuständigkeiten" → RaumAdmin-Liste des Raums (nur Erwachsene mit Hausbezug, Kinder tauchen nicht auf)
- [ ] Beobachter: Name eingeben → „Beobachter einladen" → Einladungslink (**raumgebunden**, kein Haus-Zugriff)
- [ ] RaumAdmin anklicken + bestätigen → Zuständigkeit vergeben/entzogen; wirkt sofort

### 2.7 Abgrenzung
- [ ] HouseAdmin sieht keine Kinder anderer Häuser
- [ ] HouseAdmin allein hat **keine** Elternsicht (`admin.sonne` → „Meine Kinder" leer)

---

### 2.8 Fremdes aktives Haus und gemischte Zuständigkeit (RS04, RS15)

- [ ] Als `admin.sonne` Haus Mond per direkter API lesen UND verändern: abgewiesen, keine fremden Daten ausgegeben oder verändert; entsprechende Operation in Sonne funktioniert.
- [ ] Fremde Raum-ID aus Mond sowie widersprüchliches Paar Sonne + Mondraum senden: keine Mandantengrenze umgehbar.
- [ ] Fremde Personen-/Kind-ID in einem ansonsten erlaubten Request verwenden: keine Rechteausweitung; persistierte Fachdaten bleiben unverändert.
- [ ] Zweihäuser-Konto aus RS03 darf das dritte aktive Haus weder lesen noch verändern.
- [ ] Gemischtes Konto (HausAdmin Sonne + RaumAdmin Mond/Spielraum): Sonne verwalten und den zugewiesenen Mondraum bearbeiten; keine Hausverwaltung für Mond und kein Zugriff auf dessen andere Räume.
- [ ] Direkt `/super` als HouseAdmin öffnen: kein SuperAdmin-Zugriff; rollenrichtige Weiterleitung und zusätzlich gesperrte SuperAdmin-API nachweisen.

## 3 · Erzieher / RaumAdmin (`erzieher.tobias`)

- [ ] `/admin` → Login → „Verwaltung öffnen" → Raumliste lädt automatisch; bei **einem** Raum wird dieser direkt geöffnet
- [ ] Nur „Spielraum" Sonne sichtbar (nicht Lernraum, nicht Mond)
- [ ] Spielfreigaben im eigenen Raum ändern → wirkt sofort
- [ ] **Kein** Zugriff auf Hausverwaltung (Räume anlegen, Eltern einladen → verweigert; Nav-Button „Haus" ausgeblendet)
- [ ] **Keine** Delegation möglich (kann keine weiteren Admins ernennen)
- [ ] Emoji-Code-Werkzeuge nur mit Hausrecht sichtbar (Tobias sieht sie nicht)
- [ ] Raumsicherung speichern → nach Freigabe-Änderung „wiederherstellen" → alte Freigaben zurück
- [ ] Entzug der RaumAdmin-Rolle (durch HouseAdmin) → Tobias verliert Zugriff sofort

---

### 3.1 Reiner und neu eingerichteter RaumAdmin (RS01, T-L2)

- [ ] Fixture prüfen: nur `areaAdmin` auf einem Raum, keine zusätzliche Haus-/SuperAdmin-Rolle; Login führt direkt zu `stage_admin`.
- [ ] Eigene Raumoperation funktioniert; dieselbe Operation im Lernraum Sonne und in Mond wird serverseitig abgewiesen.
- [ ] `/house` und `/super` direkt aufrufen: keine zusätzlichen Rechte; geschützte APIs ebenfalls gesperrt, nicht nur Navigation ausgeblendet.
- [ ] Neuen RaumAdmin über freigegebenen Einrichtungsweg anlegen → Zugang einrichten → wirklich anmelden → `stage_admin` mit exakt zugewiesenem Raum. Fehlender Einrichtungsweg wird als Lücke protokolliert.

## 4 · Eltern

### 4.1 Gemeinsamer Erwachsenen-Login
- [ ] `/admin` → `eltern.petra` → **kein** Verwaltungszugang, aber Kontext-Button „Meine Kinder"
- [ ] Kinderliste lädt **automatisch** beim Öffnen — kein „Laden"-Klick nötig
- [ ] `admin.paul` → bekommt **beide** Kontexte („Haus verwalten" + „Meine Kinder") — sichtbarer Wechsel; in der Elternansicht sind Verwaltungs-Nav-Buttons sichtbar, bei `eltern.petra` nicht
- [ ] `beobachter.olga` → Kontext „Beobachtung"
- [ ] `kontakt.rita` → Login ok, aber Kinderliste leer (widerrufene Beziehung)

### 4.1.1 Mehrfachrollen ohne Vermischung privater Rechte (RS05, RS06)

- [ ] `admin.paul` als HouseAdmin + bestätigter Elternteil: Verwaltung nutzbar, Elternsicht enthält ausschließlich Lina, nicht alle Kinder seines Hauses.
- [ ] RaumAdmin-Elternteil anmelden: eigene Raumverwaltung und bestätigtes eigenes Kind erreichbar, aber keine Hausverwaltung.
- [ ] In beiden Szenarien Bewertungen fremder Kinder direkt anfragen, auch aus dem eigenen verwalteten Raum/Haus: abgewiesen.
- [ ] Zwischen Verwaltungs- und Elternkontext wechseln: Auswahl und angezeigte Daten passen zum Kontext; keine fremden Kinderdaten aus vorherigen Ansichten.
- [ ] Guardian-Beziehung widerrufen: private Sicht entfällt sofort; unabhängig bestehende Verwaltungszuständigkeit bleibt gemäß Vertrag erhalten.

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
- [ ] `beobachter.olga` → „Beobachtung" → Aggregatliste lädt **automatisch** beim Öffnen
- [ ] Zahlen pro Raum: verbunden/spielend/pausiert/getrennt
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

### 7.1.1 Inaktive Rollen, Personen und Häuser (RS07–RS10, RS16)

- [ ] Aktive Person mit Credentials, aber einziger Verwaltungsrolle `active: false`: kein Verwaltungszugang.
- [ ] Aktive Rolle in inaktivem Haus: weder Haus noch untergeordnete Räume zugänglich; kein Verwaltungslogin ohne weitere gültige Zuständigkeit.
- [ ] Person deaktivieren, Rolle und Haus aktiv lassen: neuer Login abgewiesen; bestehende Sitzung beim nächsten geschützten Request ebenfalls gesperrt (siehe 1.3.2).
- [ ] Konto mit einem aktiven und einem inaktiven Haus: aktives Haus bleibt nutzbar, inaktives Haus bleibt gesperrt.
- [ ] Zweihäuser-Konto angemeldet lassen; über echten Verwaltungsablauf eine Hausrolle entziehen: nächster Request dort abgewiesen, verbleibendes Haus weiter nutzbar gemäß bestätigtem Sitzungsvertrag.
- [ ] Wiedererteilung/Reaktivierung separat prüfen; keine alte UI-Auswahl darf entzogene Rechte ersetzen.

### 7.1.2 Anmeldung und Sitzung am gemeinsam genutzten Gerät (RS12, RS13)

- [ ] Frischer Browser ohne Sitzung: Verwaltungsseiten führen zur Anmeldung; APIs liefern 401, keine geschützten Daten.
- [ ] Tatsächlich abgelaufene Sitzung: nächster Request gesperrt, UI fordert Anmeldung; nicht lediglich ein fehlendes Cookie als Ablauf simulieren.
- [ ] SuperAdmin anmelden, danach Loginseite öffnen: aktuelle Identität mit Weiter/Abmelden sichtbar; keine allgemeine Verwaltungsnavigation und kein irreführendes leeres Loginformular.
- [ ] Abmelden → als reiner HouseAdmin anmelden: nur dessen Rechte und Hausdaten sichtbar.
- [ ] Separater Fall mit erneut aktiver SuperAdmin-Sitzung: neuen Loginversuch mit falschem Passwort senden; anschließend alte SuperAdmin-API gesperrt. Fehler darf alte Sitzung nicht erhalten.
- [ ] Dasselbe mit Person ohne aktive Verwaltungszuständigkeit: keine Fortführung vorheriger SuperAdmin-Rechte.
- [ ] Abmelden und Browser-Zurück: geschützte Aktionen bleiben gesperrt; keine erneute Nutzung gecachter Verwaltungsdaten als aktive Sitzung.

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

### 7.3.1 Persistenz unter echtem Windows-Dateilock (T-L6)

- [ ] Nur synthetische Zieldatei verwenden; echten exklusiven Lock kontrolliert erzeugen. Im Editor geöffnet bedeutet nicht automatisch gesperrt.
- [ ] Schreiboperation während kurzzeitigem Lock auslösen und Lock innerhalb des vereinbarten Retry-Fensters lösen: Erfolg und vollständige, valide gespeicherte Daten nachweisen.
- [ ] Lock über das Retry-Fenster halten: kontrollierter Fehler, keine beschädigte/halb geschriebene Datei, keine internen Dateipfade in der UI. Nicht pauschal HTTP 200 bei dauerhaftem Lock verlangen.
- [ ] Nach Lockfreigabe erneut speichern und laden: Erfolg ohne Datenverlust; temporäre Testartefakte sauber beenden.

### 7.3.2 Editor-Run und Standalone getrennt prüfen (T-L4, T-L7)

- [ ] Im Standalone Haus auswählen → Hausdetail → Admin-Detail → zurück: `GewaehltesHaus` und Personenkontext bleiben korrekt.
- [ ] Denselben Ablauf mit über `EditorProjectLoader` geladenem Projekt im Editor-Run ausführen; Stage-Wechsel erhält deklarierte Variablen.
- [ ] Hauswechsel und erneutes Öffnen der Detailseite zeigen neue Auswahl, keine veralteten Daten.
- [ ] Detailseite in beiden Betriebsarten tatsächlich bedienen und visuell prüfen: keine Überlagerungen oder Elemente außerhalb des Rasters.
- [ ] Wenn nur Standalone geprüft wurde, Editor-Run ausdrücklich offen lassen; direkter Runtime-Eventaufruf ersetzt keinen DOM-Bedientest.

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
