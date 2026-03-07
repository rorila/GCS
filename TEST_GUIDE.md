# 🧪 Detaillierte Test-Spezifikation (Game Builder v1)

Diese Dokumentation beschreibt jeden einzelnen Testfall, seinen Zweck und den zugehörigen Use Case.

## 🌐 1. Browser-Tests (End-to-End)
Diese Tests verifizieren das Zusammenspiel zwischen UI, Editor-Logik und Game-Engine.

### `tests/e2e/deep_integration.spec.ts`
*   **Test 1: Komponente & Inspector (D&D, Rename, JSON Sync, Delete)**
    *   **Sinn**: Verifiziert den vollständigen Lebenszyklus eines Objekts auf der Stage.
    *   **UseCase**: UC-001 (Platzieren), UC-005 (Konfigurieren), UC-008 (Löschen).
    *   **Details**: Prüft, ob ein auf die Stage gezogener Button im Inspector umbenannt werden kann, ob dieser Name sofort im JSON-Viewer erscheint und ob das Objekt restlos von der Stage verschwindet, wenn es gelöscht wird.
*   **Test 2: Flow-Editor & Refactoring (Task/Action, Linking, JSON)**
    *   **Sinn**: Stellt sicher, dass visuelle Logik-Programmierung im Flow-Editor korrekt in das Projektmodell übersetzt wird.
    *   **UseCase**: UC-020 (Flow-Erstellung), UC-025 (Linking), UC-030 (Refactoring-Sync).
    *   **Details**: Erzeugt einen Task und eine Action, verbindet diese visuell und prüft, ob im JSON eine korrekte Referenz (keine Inline-Action!) angelegt wurde. Verifiziert zudem, dass Umbenennungen im Flow-Editor synchron zum Modell verlaufen.
*   **Test 3: Run-Mode & Execution**
    *   **Sinn**: Der "Master-Test" für die Funktionalität des Spiels.
    *   **UseCase**: UC-050 (Event-Binding), UC-100 (Spiel-Ausführung).
    *   **Details**: Verknüpft einen Button-Klick mit einem Task, startet den "Run"-Modus, klickt den Button und verifiziert über den Debug-Log, dass der Task tatsächlich ausgeführt wurde.

### `tests/e2e/editor_smoke.spec.ts`
*   **Test 1: Editor korrekt laden**
    *   **Sinn**: Basis-Sanity-Check.
    *   **Details**: Prüft, ob alle Hauptpanels (Toolbox, Stage, Inspector) beim Start sichtbar sind.
*   **Test 2: View-Umschaltung**
    *   **Sinn**: Verifiziert die Navigation im Editor.
    *   **Details**: Schaltet zwischen Stage, JSON, Flow und Code-Ansicht um.
*   **Test 3: Komponenten-Palette**
    *   **Sinn**: Prüft die Toolbox-Integrität.
    *   **Details**: Klappt Kategorien auf und prüft, ob Basiselemente (Button, Panel) vorhanden sind.

---

## 🛡️ 2. Logik- & Regressions-Tests (Headless)
Diese Tests laufen im Hintergrund und sichern die Datenintegrität.

### `RefactoringManager` Tests
*   **Sinn**: Schutz vor "Broken Links".
*   **UseCase**: UC-030 (Systemweites Refactoring).
*   **Details**: Wenn ein Task umbenannt wird, müssen alle Buttons, die diesen Task aufrufen, automatisch aktualisiert werden. Dieser Test prüft das für Tasks, Actions, Variablen und Objekte.

### `TaskExecutor` Tests
*   **Sinn**: Verifizierung der Runtime-Logik.
*   **UseCase**: UC-105 (Skript-Interpretation).
*   **Details**: Prüft, ob `if-then-else` Bedingungen korrekt ausgewertet werden, ob globale Tasks (Blueprint) gefunden werden und ob Endlosschleifen (Recursion Guard) verhindert werden.

### `Serialization / Serialization` (ProjectRegistry)
*   **Sinn**: Sicherung der Speicherstände.
*   **UseCase**: UC-010 (Projekt-Persistenz).
*   **Details**: Führt "Round-Trips" durch: Ein Objekt wird in JSON umgewandelt und wieder zurück (Hydrierung). Es darf kein Datenverlust (z.B. Events, Styles) auftreten.

### `FlowSync` Tests
*   **Sinn**: Synchronität zwischen Grafik und Daten.
*   **Details**: Stellt sicher, dass jedes Icon im Flow-Editor exakt einem Eintrag im `flowCharts`-Array des Projekts entspricht. Verhindert "Geister-Knoten".

### `Project Integrity` Tests
*   **Sinn**: Plausibilitätsprüfung des gesamten Projekts.
*   **Details**: Sucht nach verwaisten Daten, doppelten IDs oder ungültigen Referenzen (z.B. ein Button ruft einen Task auf, den es gar nicht gibt).

---

## � Manuelle Test-Ausführung

| Befehl | Ziel | Wann nutzen? |
| :--- | :--- | :--- |
| `npm run test` | **Alle Tests** | Vor jedem Commit / Abschluss einer Aufgabe. |
| `npm run test:e2e:ui` | **Visuelle E2E** | Wenn du sehen willst, wo genau der Browser hängen bleibt. |
| `npx playwright test` | **Schnelle E2E** | Kurze Validierung der UI-Funktionen. |

> [!IMPORTANT]
> Ein grüner Haken in der Konsole bedeutet: Die App ist stabil, die Logik ist konsistent und die Core-Use-Cases funktionieren im Browser.
