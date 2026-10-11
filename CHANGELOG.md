# Änderungen der technischen Kopie

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
