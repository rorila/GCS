# CMS — Bekannte Testlücken

Erweiterungs-Backlog für `docs/CMS-Testkatalog.md`. Jeder Eintrag entstand aus
einem realen Befund, den die Suites nicht gefunden haben. Bei Fund neuer
Lücken hier ergänzen. Die Prüfpunkte sind inzwischen fachlich in den Katalog
integriert; dieser Bestand bleibt als Befundhistorie und Automatisierungs-Backlog
erhalten. **Katalogisiert bedeutet nicht implementiert, ausgeführt oder geschlossen.**

## Aktueller Einstieg für die weitere Arbeit

Der Abschnitt **„Aufbau ab null“** in `CMS-Testkatalog.md` ist der fachliche
Hauptablauf: nur ein SuperAdmin vorbereitet, weitere Daten über echte CMS-Aktionen.
Unabhängige Aufgaben laufen trotz Fehlern weiter; nur fehlende Voraussetzungen
blockieren. Die kleinen KI-Arbeitspakete P0–P7 stehen in `CMS-Plan.md` §12.13.
Start mit P0, nicht sofort alle Fixtures oder Tests implementieren. Bestehende
Seed-Tests bleiben Einzelregression, nicht Nachweis des erfolgreichen Aufbaus.
Diese Übergabe ist dokumentiert; Minimalbestand, neue Teststeuerung und stabile
ID-Auswertung sind damit noch nicht implementiert.

## Zuordnung zum erweiterten Testkatalog

| Lücke | Abschnitt in `CMS-Testkatalog.md` | Verbleibender Nachweis |
|---|---|---|
| T-L1 | 1.4.1 | Kompletter neuer SuperAdmin-Lebenszyklus |
| T-L2 | 1.3.1, 3.1 | Neuer HouseAdmin → `stage_house`; neuer RaumAdmin → `stage_admin` |
| T-L3 | 1.3.1, 1.4.1 | Reale UI-Schritte und sichtbare Zwischenzustände |
| T-L4 | 7.3.2 | Editor-Run zusätzlich zum Standalone |
| T-L5 | 0.6 | Versionsvertrag noch umzusetzen; laufenden Stand nachweisen |
| T-L6 | 7.3.1 | Echter Windows-Lock, Retry-Erfolg und kontrollierter Dauerfehler |
| T-L7 | 1.3.2, 7.1.1, 7.3.2 | Reset einlösen, neu anmelden, alte Sitzung prüfen, Editor-Run |
| T-L8 | 1.3.1, 2.1 | Früh geklickter „Admin hinzufügen" wird vom Init-Timer zurückgesetzt |

Rollenfälle aus `CMS-Plan.md` §12 sind ebenfalls einsortiert: RS01 → 3.1;
RS02 → 1.3.1/2.1.1; RS03 → 2.1.1/2.8; RS04/RS15 → 2.8;
RS05/RS06 → 4.1.1; RS07–RS10/RS16 → 7.1.1; RS11 → 1.4.1;
RS12/RS13 → 7.1.2; RS14 → 2.1.2. Fehlende Zusatzfixtures stehen in 0.5.
Die Aufnahme der Detailseite in den Katalog ist erledigt; die übrigen Nachweise
bleiben bis zur tatsächlichen Prüfung offen.

## Grundsätzliche Blindstellen

- **Stale Server**: Die Suites starten jedes Mal einen frischen Prozess mit
  aktuellem Code — sie können niemals „veralteter laufender Server" finden.
  Gegenmittel: `GET /api/cms/version` (Build-Stand/Commit), den `boot()`
  beim Start prüft.
- **Editor-Run vs. Player**: Alle Suites laufen gegen den Standalone-Player
  (`runtime-standalone.js` via `/admin`). Der Editor-Run-Mode
  (`EditorRunManager`, Vite `:5173`) hat ein abweichendes Projektmodell —
  siehe Fall `GewaehltesHaus`. Kein Suite läuft im Editor.
- **Datei-Locks (Windows)**: Geöffnete `cms-v1.json` blockierte
  `renameSync` → `EPERM` bis zur GUI. Tests schreiben in `data/test/` und
  öffnen die Zieldatei nie im Editor. `atomicWrite` hat jetzt
  Retry + Copy-Fallback, aber der Testpfad deckt das nicht ab.

## Offene Testpunkte

### T-L1 · Neu angelegter SuperAdmin landet auf `stage_super`

Fund: 2026-09-23 — „Mambio" landete nach Login auf der Raumverwaltung.
Ursache war ein veralteter Server (`super` fehlte in der Login-Antwort),
aber der Pfad war nicht katalogisiert.

Ablauf: Person anlegen → Zeile wählen → Rolle bestätigen → Einladen →
Einrichtungslink einlösen → Login → **Assertion: `stage.id === 'stage_super'`**.

Abgrenzung zum bestehenden Punkt 1.1 (Seed-Admin `super` → `stage_super`):
hier geht es um den kompletten Lifecycle einer *neu* angelegten Person.

### T-L2 · Neu angelegter HouseAdmin/RaumAdmin landet korrekt

Analog zu T-L1: neuer Verwaltungszugang → Login → mit Haus-Rolle
`stage_house`, mit reiner Raum-Rolle `stage_admin` (nicht `stage_super`, nicht Login-Wand).

### T-L3 · Person-anlegen-Flow als geführter Dreischritt

Fund: 2026-09-23 — „Person anlegen" zeigte nach EPERM den tmp-Pfad als
Status und die Erwartung „Name erscheint sofort in Tabelle + fertig" war
ungewohnt. Der reale Ablauf ist: anlegen → Zeile wählen → Rolle
bestätigen → einladen. Katalogpunkt sollte den **kompletten UI-Pfad**
durchlaufen (inkl. Zwischenstände in der Tabelle: „Zugang: —" → nach
Rolle „SuperAdmin" → nach Einladen Link-Feld gefüllt).

### T-L4 · Editor-Run-Mode: Variablen überleben Stage-Wechsel

Fund: 2026-09-22 — `GewaehltesHaus` (damals undeclariert im Editor-Modell)
überlebte den Wechsel `stage_super_houses → stage_super_house` nur im
Player, nicht im Editor. Minimaler Check: Projekt durch den
`EditorProjectLoader` laden → GameRuntime anlegen → Variable setzen →
Stage wechseln → Wert prüfen. Aufwand mittel (DOM-Kontext nötig).

### T-L5 · Server meldet Build-Stand

Kein Endpunkt für „welcher Code läuft". Vorschlag: `GET /api/cms/version`
liefert `{ version, builtAt, gitSha }`; `boot()` der Suites prüft
Abweichung zum Repo-Stand und warnt. Fängt die Fehlerklasse „richtiger
Code, falscher Prozess" ab — die zwei reale Befunde erzeugt hat
(GewaehltesHaus-Symptomdiagnose, Mambio-Login).

### T-L6 · atomicWrite unter geöffneter Zieldatei

Ausschließlich synthetische Testdatei mit echtem Windows-Lock sperren;
eine im Editor geöffnete Datei allein beweist keinen Lock. Schreiboperation
bei rechtzeitiger Freigabe erfolgreich; bei dauerhaftem Lock kontrollierter
Fehler ohne Datenbeschädigung oder interne Pfade. Retry/Copy-Fallback in
`cms-store.cjs` als manuellen/Integrationstest gemäß Katalog 7.3.1 prüfen.

### T-L7 · Admin-Verwaltung — verbleibende Lücken

Abgedeckt sind inzwischen: `scripts/test-cms-admin-management.cjs`
(10 Vertragsprüfungen der Server-Flows) und `scripts/test-cms-super.cjs`
(Browser: Admin hinzufügen → zuweisen → Detailseite → einladen → Profil/Avatar
→ Konto an/aus mit Bestätigung/Abbrechen → Passwort-Reset). Noch offen:

- Reset-Link im Browser **einlösen** und mit neuem Passwort anmelden;
  altes Passwort abgewiesen, alte Sitzung beendet (`authVersion`)
- Deaktiviertes Konto: laufende Verwaltungssitzung sofort ungültig (UI)
- Detailseite im Editor-Run-Mode (siehe T-L4)
- Katalogpunkte für Detailseite: inzwischen unter 1.3.2 aufgenommen; Ausführung und zusätzliche Automatisierung bleiben separat nachzuweisen

### T-L8 · Init-Timer setzt frühe Benutzerauswahl zurück (Race)

Fund: 2026-09-25 — Aufbautest `test-aufbau-1-admin.cjs`. `InitialLaden`
(TTimer, 350 ms, einmalig) auf `stage_super_house` feuert → `Zugang_Pruefen`
→ `HouseInit` → `Act_Modus_Zugeordnet` setzt `ListModus` zurück auf
`assigned` und lädt die Adminliste erneut. Klickt ein Nutzer **vor Ablauf
des Timers** auf „+ Admin hinzufügen" (Modus → `all`), wird die
Personenauswahl wenige hundert Millisekunden später verworfen: die Liste
springt auf die leere Zuordnungssicht, neu angelegte Personen sind nicht
sichtbar/anklickbar. Nachweis im Request-Log: `listMode` ging als
`[all, all, assigned]` an `/api/cms/admin/super-admins`, obwohl kein
zweiter Umschaltklick erfolgte.

Betroffene Stages: gleiches Muster (`InitialLaden` → `Zugang_Pruefen` →
Init-Task) liegt auf `stage_admin`, `stage_house`, `stage_super`,
`stage_library`, `stage_super_houses`, `stage_super_admins`,
`stage_super_admin_detail` — überall kann ein Init-Ladevorgang eine
bereits getätigte Auswahl überschreiben, wenn er spät feuert.

Fachliche Zielrichtung: Verwaltungsaktionen erst freigeben, wenn
Sitzungsprüfung und initiales Laden abgeschlossen sind — oder
Init-Ergebnisse nicht mehr anwenden, sobald der Nutzer bereits
interagiert hat. **Produktfix steht aus**; der Aufbautest wartet den
Init-Request derzeit explizit ab, deckt den Fall aber nicht als
Fehlerfall ab. Eigener Negativtest nötig (sofortiger Klick nach
Stage-Enter → Auswahl muss bestehen bleiben bzw. Aktion erst nach
Ladebereitschaft möglich sein).

## Bereits geschlossene Lücken (Historie)

| Fund | Lücke | Fix |
|---|---|---|
| 2026-09-22 | Globals in Nicht-Blueprint-Stages wurden vom Editor beim Laden gelöscht | `EditorProjectLoader` verschiebt sie jetzt dedupliziert in den Blueprint |
| 2026-09-22 | Generator schrieb Globals nach `stage_super` (5× dupliziert) | `cms-add-parent-stages.cjs` schreibt sie dedupliziert in den Blueprint |
| 2026-09-23 | Server-500 gab interne Fehlermeldung mit Dateipfaden an Client | `cms-runtime.cjs` antwortet generisch, loggt serverseitig |
| 2026-09-24 | Admin-Panel lag außerhalb der Stage (Zeile 52 bei 40 Rasterzeilen) | Migration prüft Rasterbereich; Hausübersicht + eigene Detailseite |
| 2026-09-24 | Passwort-Reset löschte Zugang vor Neueinrichtung | Reset-Ticket (1 h, einmalig, an Passwortstand gebunden); Benutzername bleibt |
| 2026-09-24 | Anmeldeseite zeigte Bereichsnavigation + Formular trotz aktiver Sitzung einer anderen Person → „Haus" öffnete deren Daten | Keine Navigation auf der Anmeldeseite; „Angemeldet als …" mit Weiter/Abmelden; jeder Anmeldeversuch beendet die vorherige Sitzung; Verwaltungsseiten leiten ohne Sitzung zur Anmeldung (`test-cms-login-session.cjs`) |
| 2026-09-24 | Katalog-Suite 5 beendete sich nicht (Neustart-Server blieb offen, Port belegt) | `katalog-report.cjs` schließt den aktuellen Server |
| 2026-09-25 | `guardian-approve` meldete `{ok:true,'…bestätigt.'}`, obwohl `approveGuardian` die Selbstbestätigung der einladenden Person intern ablehnte (`Ergebnis.ok` wurde im deklarativen Task ignoriert; Zuordnung blieb korrekt `pending`, aber UI/API logen den Erfolg) | `Server_ElternZuordnung_Verarbeiten` prüft jetzt `Ergebnis.ok` und sendet bei Ablehnung `Ergebnis.status`/`-message` (409 Vier-Augen) — Fix in `GCS-CMS.json` und Generator `cms-add-admin-server-stages.cjs`; Aufbautest ELTERN-02a (409 + unveränderter Bestand) als Nachweis beim nächsten Lauf |
