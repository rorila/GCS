# CMS — Bekannte Testlücken

Erweiterungs-Backlog für `docs/CMS-Testkatalog.md`. Jeder Eintrag entstand aus
einem realen Befund, den die Suites nicht gefunden haben. Bei Fund neuer
Lücken hier ergänzen; bei Umsetzung in den Katalog verschieben.

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

Analog zu T-L1: neuer Verwaltungszugang mit Haus-Rolle → Login →
`stage_admin` bzw. `stage_house` (nicht `stage_super`, nicht Login-Wand).

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

`cms-v1.json` im Editor geöffnet halten → beliebige Schreiboperation
(z.B. Person anlegen) → muss 200 liefern. Abdeckung des
Retry/Copy-Fallbacks in `cms-store.cjs`. Auf Windows nur sinnvoll mit
echtem Datei-Lock — als manueller/Integrationstest markieren.

### T-L7 · Admin-Verwaltung — verbleibende Lücken

Abgedeckt sind inzwischen: `scripts/test-cms-admin-management.cjs`
(10 Vertragsprüfungen der Server-Flows) und `scripts/test-cms-super.cjs`
(Browser: Admin hinzufügen → zuweisen → Detailseite → einladen → Profil/Avatar
→ Konto an/aus mit Bestätigung/Abbrechen → Passwort-Reset). Noch offen:

- Reset-Link im Browser **einlösen** und mit neuem Passwort anmelden;
  altes Passwort abgewiesen, alte Sitzung beendet (`authVersion`)
- Deaktiviertes Konto: laufende Verwaltungssitzung sofort ungültig (UI)
- Detailseite im Editor-Run-Mode (siehe T-L4)
- Katalogpunkte in `CMS-Testkatalog.md` für Detailseite ergänzen

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
