## [3.11.7] - 2026-03-09
### Added
- **UseCase: Projekt speichern** (`src/editor/services/EditorDataManager.ts`): `saveProjectToFile()` implementiert. Speichert das Projekt gemäß den 4 UseCase-Schritten: Änderungsstatus prüfen, Spielname validieren (kein 'Haupt-Level'), Datei-Existenz prüfen + Überschreiben-Dialog, Speichern via `/api/dev/save-custom`. `isProjectChangeAvailable` wird VOR dem JSON.stringify zurückgesetzt.
- **Menu-Integration**: `EditorMenuManager.ts`: Case `'save'` leitet jetzt zu `saveProjectToFile()` um. Neuer Case `'save-dev'` ruft das alte `saveProject()` auf.
- **E2E-Test: Projekt speichern** (`tests/e2e/ProjectSaving.spec.ts`): 3 Tests für alle UseCase-Schritte (Abbruch kein Change, Abbruch Standard-Name, Erfolgreiche Speicherung + Round-Trip JSON-Validierung). Alle 3 passed (3.1s) ✅.

### Fixed
- **Serialization: Read-Only Getter-Fehler** (`src/utils/Serialization.ts`): Alle Read-Only Getter von `TStageController` zur `reservedKeys`-Liste hinzugefügt: `currentStageId`, `currentStageName`, `currentStageType`, `currentStageIndex`, `stageCount`, `mainStageId`, `isOnMainStage`, `isOnSplashStage`. Verhindert mehrfache `TypeError: Cannot set property ... which has only a getter` beim Laden.
- **Laden: Endlosschleife am Lade-Dialog** (`src/editor/services/EditorDataManager.ts`): `isProjectDirty=false` wird jetzt NACH `notifyDataChanged()` (synchron + `setTimeout(100)`) in `loadProject()` gesetzt. `setProject()` und `autoSaveToLocalStorage()` lösten `DATA_CHANGED` aus → `isProjectDirty=true`. Reset wurde dadurch überschrieben.
- **`saveProjectToFile()` Ablauf-Bug**: `changeVar.defaultValue = false` wird korrekt VOR dem `JSON.stringify`-Aufruf gesetzt.

## [3.11.6] - 2026-03-09
### Added
- **E2E-Test: Task mit Action verknüpfen** (`tests/e2e/TaskActionLinking.spec.ts`): Vollständiger E2E-Test für den UseCase "Task mit Action verknüpfen" via Flow-Editor API. Testet den gesamten Flow: Projekt erstellen, Task und Action in MainStage ablegen, auto-generierten Task-Knoten wiederverwenden, Action-Knoten erzeugen, Verbindung über `restoreConnection()` herstellen, JSON-Validierung (Connection + actionSequence) und Manager-View UI-Prüfung.

### Fixed
- **Flow-Editor Knoten-Duplikat-Problem**: `switchActionFlow()` erzeugt automatisch einen Task-Knoten als Startpunkt. Ein zusätzlicher `createNode('Task', ...)` Aufruf im gleichen Kontext erzeugt einen Konflikt. Korrekte Lösung: auto-generierten Knoten per `nodes.find(n => type === 'task')` referenzieren.
- **Task/Action Speicherort**: Tasks und Actions gehören in `stage.tasks` / `stage.actions` der aktiven Stage (z.B. `mainStage`), nicht in `project.tasks` (Root-Level).

## [3.11.5] - 2026-03-09
### Added
- **E2E-Test: Action Umbenennen** (`tests/e2e/ActionRenaming.spec.ts`): Vollständiger E2E-Test für den UseCase "Eine Action umbenennen" via Inspector UI. Testet den gesamten Flow: Projekt erstellen, VerifyTask anlegen, Action erzeugen, per Inspector umbenennen, JSON-Validierung (alle Speicherorte) und Manager-View Prüfung.

### Fixed
- **Action-Speicherort-Logik**: Test-Assertions robustifiziert, um alle möglichen Action-Speicherorte zu berücksichtigen (Root-Level, alle Stages inkl. Blueprint, alle FlowCharts-Einträge). Actions werden gemäß `getTargetActionCollection`-Logik in `activeStage.actions` gespeichert.
- **syncToProject nach Rename**: Explizites Aufrufen von `syncToProject()` nach dem Inspector-Rename stellt sicher, dass die Änderung in der Projektstruktur persistiert wird.

## [3.11.4] - 2026-03-09
### Added
- **Blueprint-Visualisierung**: Service-Objekte (z. B. `StageController`) und globale Variablen sind nun exklusiv in der `blueprint`-Stage sichtbar.
- **Variablen-Werte auf Stage**: Variablen zeigen nun ihren Namen und ihren aktuellen Wert (oder Defaultwert) direkt auf der Stage an.

### Changed
- **Variablen-Inspector**: Variablen werden einheitlich als Textfelder (`TEdit`) dargestellt, um die explizite Anzeige von Werten wie "true" oder "false" zu ermöglichen (Nutzerpräferenz). Labels wurden auf "Default-Wert" und "Aktueller Wert" angepasst.
- **Stage-Menü Synchronisierung**: Namen von Stages werden nun bei einer Änderung im Inspector sofort im "Stages"-Menü der MenuBar aktualisiert.
- **Snap-To-Grid**: Neue Option im Stage-Inspector, um das Einrasten am Raster beim Verschieben/Resizen zu aktivieren oder zu deaktivieren.

### Fixed
- **Datenbindung im Inspector**: Fehler behoben, bei dem Boolean `false` und `undefined` in Textfeldern verschluckt wurden.
- **Serialization-Stabilität**: `TypeError` beim Laden von Objekten mit Read-Only Properties (z.B. `currentStageId`) behoben.

## [3.11.3] - 2026-03-09
### Fixed
- **Action-Typ-Persistenz**: Stabilisierung der strukturellen Knoten-Identität in `FlowAction.ts`.
- **TypeScript-Fix**: Behebung des Fehlers TS2339 in `FlowGraphHydrator.ts` durch korrektes Casting.
- **Sync-Stabilität**: Sicherstellung, dass Typ-Änderungen im Inspector konsistent in `project.json` gespeichert werden.

## [3.11.2] - 2026-03-09
### Fixed
- **Action-Typ-Persistenz**: Behebung des Fehlers, bei dem Typ-Änderungen im Inspector (z. B. zu `data_action`) nicht gespeichert wurden.
- **Dynamische Typ-Erkennung**: `FlowAction.getType()` ermittelt den Typ nun zur Laufzeit aus den Model-Daten, was eine korrekte Serialisierung in `project.json` garantiert.
- **Auto-Morphed Nodes**: Automatische Erzeugung von Success/Error-Ports bei Typ-Wechsel zu `data_action` ohne Instanz-Austausch.

## [3.11.1] - 2026-03-09
### Fixed
- **Action-Persistenz (Index-basiert)**: Umstellung der Action-Suche im `FlowNodeHandler` auf einen hochperformanten Index-Lookup via `ProjectRegistry`. Verhindert zuverlässig "Action not found" Fehler.
- **Broad-Field Matching**: Unterstützung für robuste Identifizierung von Action-Knoten über verschiedene Felder (`name`, `actionName`, `data.name`, `properties.name`, `properties.text`).
- **Orphaned Action Cleanup**: Automatische Bereinigung von verwaisten Action-Referenzen in `actionSequence`-Listen durch den `SanitizationService`.
- **Flow-Synchronisation**: Korrekte Typ-Behandlung (`actionType` -> `type`) und Synchronisation verlinkter Actions im `FlowSyncManager`.

## [3.10.1] - 2026-03-08
### Fixed
- **Legacy-Ladefehler**: `TypeError: this.host.setProject is not a function` beim Laden von Projekten behoben.
- **Interface-Konsistenz**: `IViewHost` wurde um `setProject` erweitert.

Alle relevanten Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

## [3.10.0] - 2026-03-07
### Added
- **Intelligentes Speichermanagement**: Einführung eines `isProjectDirty` Flags zur Erkennung ungespeicherter Änderungen.
- **Browser-Schutz**: `window.onbeforeunload` Guard warnt vor dem Verlassen der Seite bei ungespeicherten Daten.
- **Sicherheitsabfragen**: Bestätigungsdialoge beim Erstellen neuer Projekte oder beim Laden, falls Änderungen vorliegen.

### Changed
- **Entkoppeltes Speichern**: Automatisches Speichern schreibt nur noch in den `LocalStorage` (Crash-Schutz). Das Schreiben auf die Festplatte (`project.json`) erfolgt nur noch explizit durch den Nutzer via "Speichern"-Button.

### Fixed
- Wiederherstellung der `project.json` aus der Git-Historie nach versehentlichem Überschreiben.
- **E2E-Reporting**: Rekursives Parsing von Test-Ergebnissen im Test-Runner zur Unterstützung verschachtelter Test-Suites.
- **Server-Check**: Automatisierte Prüfung der Game-Server Erreichbarkeit vor E2E-Tests.
- **E2E-Stabilität**: Fix der Inspector-Hydrierung in `deep_integration.spec.ts` durch Umstellung von `setProject` auf `loadProject`.
- **Code-Cleanup**: Entfernen ungenutzter Variablen und Imports in der Runtime (TSC-Fix).

## [3.9.1] - 2026-03-06
### Added
- **Phase 6.2: Deep E2E Integration**: Vollständige Browser-Automatisierung für Kern-Use-Cases.
- `tests/e2e/deep_integration.spec.ts`: Komplexer Integrationstest (D&D, Inspector, Flow, Run-Mode).
- Playwright-Konfiguration für stabile sequentielle Testausführung.

### Fixed
- Stabilität der Drag-and-Drop Operationen im E2E-Test.
- Ambiguität der Inspector-Selektoren im Playwright-Kontext.
- Toolbox-Kategorien-Expansion in `editor_smoke.spec.ts`.

## [3.9.0] - 2026-03-06
### Added
- **Phase 5 & 6**: Implementierung des Master-Test-Projekts und Playwright E2E-Infrastruktur.
- `scripts/seed_test_data.ts`: Generator für komplexes 3-Stage Projekt.
- `tests/e2e/editor_smoke.spec.ts`: Erster automatisierter Browser-Smoke-Test.

[... weitere Einträge siehe Archiv ...]
