# Änderungen der technischen Kopie

## 2026-10-17 (Lernspiel-Gerüst mit eingebetteter Spielwelt)

- Ein editierbares Hausbau-Gerüst verwendet dieselbe Welt-Stage frei oder neben dem vorhandenen Aufgabenbereich. Die Spielhülle skaliert die Darstellung und erhält Zellkoordinaten, Aufgabenfilter und Event-Rückkanal.
- Drei Bauteile belegen eine Freigabe pro richtiger Antwort; falsche Ablage verbraucht sie nicht. Schmale Bildschirme verwenden Reiter bei weiterlaufenden Ansichten.
- MessagePort-Transport für eingebettete Stage-Events sowie vorhandene CMS-/Sprach-Adapter; Sandbox bleibt ohne eigene Netzwerkrechte. Pakete und Anleitung: `docs/Lernspiel-Geruest.md`.


## 2026-10-17 (Externe Stage-Schnittstellen)

- Jede Stage kann benannte Eingänge mit Task-Zuordnungen und benannte Ausgänge deklarieren. Neuer Inspector-Dialog mit Lern-Event-Preset und Vertragstest.
- Neue Flow-Actions `stage_input` und `stage_output`, externe Runtime-API mit JSON-Nutzdaten, Korrelationskennung, begrenztem Empfangsspeicher und Rückmeldung bei Ausführungsfehlern.
- Event-Testspielwelt nutzt den Vertrag bereits. Editor-/Runtime-Browsertest und Modultests vorhanden; Anleitung: `docs/Stage-Schnittstellen.md`.


## 2026-10-17 (Eigenständiger Aufgabenbereich und Event-Testempfänger)

- Neues editierbares GCS-Projekt `Aufgabenbereich-Karteikasten.json`: Papierkarte, gemischte Bilder-/Rechenkarten, Vorlesen, Sprache und Maus/Touch, Stapeldropdown und Fachfilter. Keine Spielwelt enthalten.
- Neuer isolierter Aufgabenvertrag mit Leitner-Buchung, sofortigem Fehler-Flip, vorgelesener Lösung und automatischer Fortsetzung; schnelle erneute Vorlage nach zwei anderen Bearbeitungen mit neuer Versuchskennung.
- Ereignisse AntwortRichtig, AntwortFalsch und AntwortNichtVerstanden mit tatsächlich empfangenem Event-Label. Wahlweise auf passende SpielweltBereit-Rückmeldung warten. Wiederverbindung, Pause und SQLite-Wiederaufnahme ohne Doppelbuchung.
- Paket und Nachweise unter `artifacts/task-area/`; Bedienung und Grenzen in `docs/Aufgabenbereich-Bedienung-und-Umsetzungsstand.md`. Bestehende Spielwelten und Veröffentlichungsregeln bleiben unverändert.

## 2026-10-16 (Tierbilder aus Turmbau-ZIP korrekt laden)

- Sprite-Darstellung und Bild-Vorlader nutzen dieselbe Pfadauflösung. Referenzen wie `images/counting/elephant.png` bleiben relativ zum Spielpaket und erhalten kein zweites `images/` mehr. Bereits hochgeladene Pakete funktionieren mit der aktualisierten Runtime.
- Browserprüfung verwendet jetzt auch das echte ZIP mit separaten Medien statt ausschließlich eingebetteter Bilder. Sie prüft tatsächliches Laden/Dekodieren aller vier Tiermotive; zusätzliche Pfadtests sind im zentralen Testlauf registriert.

## 2026-10-16 (Bilder zählen: Aufgabenbereich und Spielwelt)

- Zwei Karteistapel unter Wiebke: Anzahlen 1–5 (10 Karten), Anzahlen 5–10 (12 Karten), jeweils drei Auswahlantworten und Bezug zum ersten Lernziel.
- Versionierter Aufgabentyp `count-images`; Bilddaten bleiben bei Zuordnung und Import erhalten. Gemeinsames GCS-Aufgabenlayout einschließlich Vorlesen und Wiederholungsbutton; Unterstützung in den drei Lernabenteuern und im Papierkarten-Quiz.
- Neues Projekt `Mathe-Zaehlen-Turmbau.json`: unabhängige Spielwelt mit animierten Bausteinen, Baulaut und gespeicherter Wiederaufnahme. Nur richtige Antworten bauen weiter; Layoutwechsel erhält den Turm. Standardmäßig ohne Zeitlimit.
- Backup und wiederholbarer SQLite-Import für Stapel und SuperAdmin-Spielentwurf. Keine automatische Kind-, Haus- oder Raumfreigabe. Anleitung: `docs/Aufgabenbereich-Spielwelt-Turmbau.md`.

## 2026-10-16 (Karteikasten als Standard der drei Lernabenteuer)

- Rechenballons, Rechenpuzzle und Finns Flussbrücke verwenden standardmäßig den persönlichen Karteikasten; die Plus-/Minus-Auswahl entfällt.
- Gemeinsame GCS-Filterstage mit Mehrfachauswahl eigener/zugeordneter Stapel und Leitner-Fachfilter. Quelle und Lernfach bleiben im Spiel sichtbar; leere Filter erzeugen keine Ersatzaufgaben.
- Antworten aktualisieren den tatsächlichen Leitner-Lernstand und das vorhandene Lernpunktejournal atomar und einmal je Karte/Runde. Wiederholung und Neuladen bleiben ohne Doppelbuchung. Lösungsanzeige/Zeitablauf erhalten einen expliziten serverinternen Buchungsgrund.
- Zahlen-/Textauswahl, freie Textantwort und Selbsteinschätzung; Runden mit weniger als zehn Karten schließen auch Puzzle und Brücke ab.
- Neue serverseitige, UI- und Persistenztests; bestehende Lernpunkte- und Belohnungstests bleiben erfolgreich. Anleitung: `docs/Karteikasten-Abenteuer.md`. Aktualisierte CMS-Pakete: `artifacts/cardbox-adventures/`.

## 2026-10-16 (Filterbarer Lernzielkatalog)

- Gemeinsame GCS-Stage „Mathematik · Lernzielkatalog“ mit Zugängen in der Hausverwaltung, Elternübersicht und im Kinddetail.
- Kombinierbare Filter für Bundesland, Klasse und Aufgabenprofil-Verfügbarkeit, Textsuche, scrollbare Tabelle und auswählbare Detailansicht mit Lehrplanquelle und Prüfstatus.
- Getrennte Katalogdaten mit bayerischer Bereichsübersicht 1/2 und 3/4 sowie fünf vorhandenen Übungsprofilen; weitere Länder und Klassen erscheinen nach Datenpflege automatisch in den Filtern.
- Serverseitiger Lesezugriff nur für aktive Haus-/SuperAdmins und bestätigte Eltern mit Kontoanmeldung. Keine Kindzuordnung oder Änderung von Lerndaten.
- Datentests, echter CMS-Browsertest und Dokumentation in `docs/Lernzielkatalog.md`.

## 2026-10-16 (Mathe-Insel: Finns Flussbrücke)

- Neue editierbare GCS-Spielszene mit zehn animierten Brückenteilen, Fuchs-Spriteanimation, bewegten Wolken und Wasser, Musikschleife und Soundeffekten.
- Wiederverwendung der serverseitigen Mathematikrunden sowie Sprach- und Antwortzeit-Steuerung; gemeinsame Variablen im Blueprint. Musik stoppt vor Sprachabläufen und beim Beenden, Bewegung ist abschaltbar.
- Heruntergeladene CC0-Medien lokal in `public/images/mathe-insel` und `public/audio/mathe-insel`, mit Quellen, Lizenzen und Prüfsummen; kein Runway-Konto erforderlich.
- Offline-Builder erzeugt Projekt, portables JSON und CMS-ZIP. Eigener Browsertest prüft das ZIP im echten Upload-Sandbox mit isolierter Datenbank. Keine automatische Veröffentlichung oder Hausfreigabe.
- Anleitung: `docs/Mathe-Insel-Flussbruecke.md`; Browserbelege: `artifacts/mathe-insel`.

## 2026-10-11 (Interaktive Spielablauf- & Lifecycle-Übersicht)

- **Game Lifecycle Analysis:** Neues Analyse-Modul `src/model/GameLifecycleAnalysis.ts` liest das Spielprojekt rein passiv (Read-Only) aus und identifiziert Phasen (Stages), Stage-Übergänge (`navigate_stage`), Features und Tasks inklusive Auslösern (Events & Klicks).
- **Interaktiver Flow-Lifecycle-Viewer:** Neues Modul `src/editor/services/flow/GameLifecycleManager.ts` visualisiert den Spielablauf direkt im Flow-Tab als Mermaid-SVG mit Klick-Verknüpfung zu Tasks (`switchActionFlow(task)`) und Features (`switchActionFlow('feature:' + id)`), Kopierfunktion für Mermaid-Code und Quelltextansicht.
- **Flow-Menü & Toolbar:** Schnelleinstieg-Button `🎮 Spielablauf` in der Flow-Toolbar und Menüoption `🎮 Spielablauf (Lifecycle)` unter `🗺️ OVERVIEWS` im Flow-Dropdown integriert.
- **Sicherheit & Kapselung:** Bestehender Core-Code blieb bis auf Menü-Weiterleitungen unberührt; der Kontext `game-lifecycle` ist read-only und gegen ungewolltes Überschreiben abgesichert.
- **Tests & Qualität:** Neue Unit-Tests (`tests/game_lifecycle_analysis.test.ts`), QA-Report grün, 1000-Zeilen-Limit für alle Dateien eingehalten.
- **Vertikales Layout:** Task→Task-Aufrufe werden als Pfeile dargestellt, Einstiegs-Tasks im 4-Spalten-Raster umgebrochen, leere Blueprint-Phase ausgeblendet; neuer Zoom-Umschalter „🔍 Einpassen / 100 %“.
- **Fix Klick-Zuordnung:** Tasks werden über die Mermaid-Knoten-ID verlinkt (vorher öffnete z. B. `Eingabe_Bereit` fälschlich auch `AntwortEingabe_Bereit`).
- **Fix Kontextwechsel:** Die Übersicht wird beim Öffnen eines Tasks, bei „Zurück“ und beim Dropdown-Wechsel aus dem Canvas entfernt (`FlowGraphHydrator.loadFromProject()`, `GameLifecycleManager.removeOverview()`).

## 2026-10-07 (Autosave-Revision-Guard & KI-Schutz)

- **Schutz gegen Überschreiben externer KI-Optimierungen:** Neuer Server-Endpunkt `POST /api/dev/project-file` liest Projektdateien und SHA-256 Revisionen atomar direkt aus `game-server/public` (mit UTF-8 BOM Toleranz), anstatt über Vite-URLs (`/projects/...`), die auf veraltete Root-Stände zielten.
- **DiskRevisionGuard:** Ausgelagertes Guard-Modul (`src/editor/services/DiskRevisionGuard.ts`) entscheidet anhand von Basis-Revision und Plattenrevision über Ladeannahme oder Konfliktsperre.
- **Sperre & Nutzer-Bestätigung:** Im `EditorProjectLoader` wird bei abweichender Plattenrevision der AutoSave blockiert und ein Dialog zur Übernahme des Plattenstands oder expliziten Bestätigung angeboten.
- **Cache-Sicherung:** `EditorProjectSaver` und `EditorSessionManager` überschreiben `_diskRevision` im Browser-Speicher nicht mehr blind mit `null`.
- **Tests:** 17 neue Unit-/Integrationstests (`tests/disk_revision_guard.test.ts`) sowie Playwright-E2E-Tests (`tests/e2e/project-revision-guard.spec.ts`) validiert.

## 2026-09-06

- Bereinigte technische Kopie des vollständigen lokalen v1-Arbeitsstands erstellt.
- KI-Markdown, Komponentenschemas, persistierte Wissensbasis und Trainingsbeispiel erhalten.
- KI-Dokumente und Schemas in die Vite-Produktionsausgabe aufgenommen.
- AgentController: fehlende IDs gelten nicht mehr als übereinstimmende Objektidentitäten;
  drei Regressionstests prüfen Neuanlage und Upsert über Name bzw. ID.
- StageInteractionHost als separate Typdatei ausgelagert, bisheriger Importpfad bleibt per Re-Export gültig.
- Zwei direkte Konsolenwarnungen auf den vorhandenen Logger umgestellt.
- tsx als feste Entwicklungsabhängigkeit deklariert.
- Regressionstests mit temporärer Datenbank und expliziter Trennung vom E2E-Lauf ausgestattet.
- Projektvalidator akzeptiert einen Dateiparameter und hat eine vorhandene Standardressource.
- Ortsunabhängigen gemeinsamen Starter mit Portprüfung ergänzt; keine fremden Prozesse werden beendet.
- Lokale Konfiguration und neu erzeugbare Laufzeit-/Builddateien in .gitignore ergänzt.

Änderungen gelten ausschließlich für game-builder-v2. Der ursprüngliche Verlauf bleibt in v1.

## Inspector für nicht visuelle Komponenten

- Rein visuelle Basisfelder werden bei Variablen, Timern und Services ausgeblendet, einschließlich Geometrie, Sichtbarkeit, Kollision, Typografie, Stil und Schatten.
- Funktionale Einstellungen, Ereignisse und die JSON-Serialisierung bleiben erhalten.
- Sprite-Vorlagen, Toasts, Statusleisten und Editornotizen behalten ihre visuelle Konfiguration.
- Regressionstests prüfen Filterung, gespeicherte Werte, funktionale Einstellungen und visuelle Ausnahmen.
