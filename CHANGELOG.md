## [3.10.0] - 2026-02-27
- **Pascal-Editor (Architectural Refactoring)**: Modularisierung des massiven `PascalGenerator.ts` (1100+ Zeilen).
  - Aufteilung in [PascalCodeGenerator.ts](file:///c:/Users/rolfr/.gemini/antigravity/scratch/game-builder-v1/src/editor/PascalCodeGenerator.ts) (Erzegung) und [PascalCodeParser.ts](file:///c:/Users/rolfr/.gemini/antigravity/scratch/game-builder-v1/src/editor/PascalCodeParser.ts) (Parsing).
  - `PascalGenerator.ts` fungiert nun als schlanke Fassade (Facade-Pattern).
- **Pascal-Editor (Features)**:
  - **Komponenten-Deklaration**: Automatische Deklaration aller Stage-Objekte im Pascal-Sourcecode unter `VAR { STAGE COMPONENTS }`.
  - **Parser-Upgrade**: Volle Unterstützung für `WHILE`, `FOR`, `IF-THEN-ELSE` und Inkrement/Berechnungs-Aktionen im Round-Trip.
  - **Logger-Integration**: Der Parser nutzt den zentralen `Logger`-Service zur Protokollierung des Sync-Vorgangs.
- **Config**: `src/config.ts` um Sicherheitsprüfungen für `import.meta.env` erweitert, um Kompatibilität mit Node/TSX-Testumgebungen sicherzustellen.

## [3.9.1] - 2026-02-27
- **Standalone Player (Refactoring)**: Vollständige Integration des `StageRenderer` in `player-standalone.ts`.
  - Elimination von ~300 Zeilen redundantem Rendering-Code.
  - Implementierung des `StageHost` Interfaces im `UniversalPlayer`.
  - Einheitliches Rendering-System für Editor und Standalone-Player.
- **Dokumentation (Restrukturierung)**: Aufteilung der `DEVELOPER_GUIDELINES.md` in spezialisierte Module.
  - Neue Dateien unter `docs/`: `architecture.md`, `runtime-guide.md`, `coding-standards.md`, `ui-inspector-guide.md`.
  - Fokus auf Cloud-native und Agent-first Entwicklungsprinzipien.
- **Cleanup (Prio 3)**: Finale Entfernung der Legacy-Module `TaskEditor.ts` und `ActionEditor.ts`.
  - Bereinigung aller Callsites im Inspector und Entkopplung via `MediatorService`.
- **Versionierung**: Projektversion in `package.json` auf 3.9.1 angehoben.

## [3.9.0] - 2026-02-27
- **Architecture (Modularisierung)**: Umfassende Modularisierung von `RefactoringManager.ts` und `TaskExecutor.ts`.
  - Extraktion der Refactoring-Logik in spezialisierte Services: `VariableRefactoringService`, `TaskRefactoringService`, `ActionRefactoringService`, `ObjectRefactoringService` und `SanitizationService`.
  - Einführung von `RefactoringUtils` für shared helper Methoden.
  - Slim-down von `RefactoringManager.ts` zu einem reinen Delegator (Facade).
- **Runtime (Performance & Clutter)**: Modularisierung des `TaskExecutor.ts`.
  - Extraktion von `TaskConditionEvaluator` und `TaskLoopHandler` in das neue Verzeichnis `src/runtime/executor`.
  - Reduktion der Dateigröße und Verbesserung der Testbarkeit der Kern-Logik.
- **Typ-Sicherheit**: Einführung des globalen `UsageReport` Interfaces in `src/model/types.ts`.
- **Cleanup**: Finale Bereinigung des Projekt-Wurzelverzeichnisses von verwaisten Batch-Dateien und temporären Logs.

## [3.8.0] - 2026-02-27
- **Core (Type Safety)**: Vollständige Entfernung des `any`-Typs von `GameAction` in `types.ts`.
  - Behebung von ~13 TypeScript-Build-Fehlern in `PascalGenerator.ts`, `FlowAction.ts`, `MediatorService.ts`, `AgentController.ts` und `RefactoringManager.ts`.
  - Implementierung von Robustheits-Casts (`as any`) an strategischen Stellen, um dynamische Properties typsicher zu handhaben.
- **Cleanup (Repository)**: Bereinigung des Root-Verzeichnisses von 17 veralteten Hilfsskripten und JSON-Konfigurationen (u.a. `run_all.bat`, `temp_...`, `fix_ssot.bat`).
- **Feature (TaskExecutor Tests)**: Massive Erweiterung der Test-Suite in `tests/task_executor.expand.test.ts`. 
  - 8 neue Szenarien: Verschachtelte Bedingungen (Branching), FOR-Loops, FOREACH-Loops, Action-Bodys mit Parameter-Interpolation (`${$params.msg}`).
- **Gesamt-Status**: P1 erfolgreich abgeschlossen. Build ist sauber, alle 65 Tests (57 bestehende + 8 neue) sind grün.

## [3.7.1] - 2026-02-27
- **Cleanup (P0 Dead Code)**: Entfernung von ~577 KB Legacy-Code zur Reduktion der Wartungsschuld.
  - Gelöschte Dateien: `TaskEditor.ts`, `ActionEditor.ts`, `FlowDiagramGenerator.ts`, `old_editor.ts`, `old_editor_temp.ts`, `FlowEditor_old.ts.tmp`.
- **Architecture (Flow-Navigation)**: Umstellung von modalen "TaskEditor"-Fenstern auf direkte Navigation im `FlowEditor`.
  - Doppelklick auf einen Task-Knoten führt nun direkt zum entsprechenden Diagramm via `switchActionFlow`.
  - Einführung des `SWITCH_FLOW_CONTEXT` Events im `MediatorService` zur Entkopplung von Inspector und FlowEditor.
- **Fix (FlowEditor)**: Syntaxfehler und Import-Probleme während der Migration behoben. `cleanCorruptTaskData` wiederhergestellt.
- **Feature (Test-Suite)**: Umfassende Test-Suite als Sicherheitsnetz für Refactoring implementiert. 36 neue Tests in 5 Modulen:
  - `serialization.test.ts` (8 Tests): JSON ↔ Objekt Round-Trip, `hydrateObjects`, Container-Children, Event-Fallback, Style-Merge.
  - `refactoring_manager.test.ts` (9 Tests): Rename/Delete für Tasks, Actions, Variablen, Objekte; Usage-Report; Sanitize.
  - `task_executor.test.ts` (7 Tests): Stage-Task, Blueprint-Hierarchie-Lookup, Action-Resolution, Condition-Branching, Recursion-Guard.
  - `flow_sync.test.ts` (5 Tests): Element/Sequence-Konsistenz, Action-Namen-Match, Blueprint/Stage-Duplikate, Connection-Validierung, korrupte Task-Erkennung.
  - `project_integrity.test.ts` (8 Tests): Orphaned FlowCharts, Task-Duplikate, Event→Task-Mappings, Undefined Actions, Blueprint-Existenz, korrupte Einträge, **Inline-Action-Erkennung**.
- **Bug Discovery**: 2 Bugs im `RefactoringManager` aufgedeckt und **behoben**:
  - Bug #1: `renameTask` aktualisiert jetzt auch Stage-Events (`onEnter`, `onLeave`) – neuer Schritt 8.
  - Bug #2: `renameVariable` iteriert jetzt über alle Actions (Root + Stage) und aktualisiert auch `formula`-Felder.
- **Infrastructure**: `test_runner.ts` erweitert um 5 neue Importe. `TestResult.type` auf `string` erweitert für neue Kategorien.
- **Gesamt-Status**: 57/57 Tests grün (20 bestehende + 37 neue).

## [3.6.0] - 2026-02-26
- **Architecture (ObjectStore)**: Einführung von `ObjectStore.ts` als **Single Source of Truth** für alle aktuell gerenderten Objekte. Ersetzt die 4 parallelen Listen (`lastRenderedObjects`, `currentObjects`, `getResolvedInheritanceObjects()`, `runtime.getObjects()`).
- **Architecture (Run-Mode Schutz)**: Guards in `Editor.switchStage()` und `EditorViewManager.switchView()` verhindern, dass die Runtime im Run-Mode zerstört wird.
- **Architecture (findObjectById)**: `EditorCommandManager.findObjectById()` liest jetzt ZUERST aus dem ObjectStore statt aus `getResolvedInheritanceObjects()` — behebt leeren Inspector nach Stage-Wechsel.
- **API**: Neuer `Editor.isRunning()` Getter und `IViewHost.isRunning()` Interface.
- **Fix (Stage Navigation)**: `switchStage()` hat jetzt `keepView` Parameter — `switchView('stage')` wird nur im Editor-Modus aufgerufen.
- **Docs**: Neue Sektion "Architektur-Regeln (v3.6.0)" in DEVELOPER_GUIDELINES.md mit ObjectStore- und Run-Mode-Schutz-Regeln.

## [3.5.17] - 2026-02-26
- **Fix (Flow Editor)**: Behebung der Lösch-Inkonsistenz durch Umstellung auf ID-basierte Löschung in `FlowGraphManager.ts`.
- **Fix (UX)**: Konsolidierung der Lösch-Bestätigungsdialoge — nur noch 1x Frage statt 2-3x (`InspectorActionHandler`, `FlowGraphManager.deleteNodeSilent`, `Editor.removeObjectWithConfirm`).
- **Fix (Runtime)**: Regression-Fix für `${currentUser.name}` Binding nach Stage-Wechsel. Globale Variablen-Komponenten werden in `GameRuntime.handleStageChange()` nicht mehr über `registerObject` neu registriert (Ergänzung zu `GlobalVariablePersistence` & `GlobalElementPersistenceFix`).
- **Workflow**: Konsolidierung aller Wartungs-Skripte in `run_all.bat` (CMD-kompatibel als PowerShell-Fallback).

## [3.5.16] - 2026-02-26
- **Fix (Data Model)**: `project.json` bereinigt und mit der neuen Blueprint-Architektur synchronisiert (`currentUser` Refactoring).
- **Fix (Validation)**: Validator `validate_project.cjs` an Blueprint-SSoT angepasst und eingebettete FlowCharts extrahiert.
- **Cleanup**: Entfernung von Platzhalter-Tasks und Konsolidierung der Action-Referenzen in `stage_login`.

## [3.5.15] - 2026-02-26
- **Fix (Environment)**: PowerShell-Skripte (`npm run test`) durch CMD-kompatible Batch-Dateien (`.bat`) ergänzt, um native Windows-Kompatibilität bei beschädigter PowerShell-Umgebung sicherzustellen.
- **Workflow**: Einführung von `run_tests.bat`, `validate_project.bat` und `fix_ssot.bat` im Root-Verzeichnis.

## [3.5.14] - 2026-02-26
- **Fix (Dragging Precision)**: Präzision beim Ziehen von Komponenten verbessert durch Berücksichtigung der Browser-Skalierung (Zoom).
- **Performance**: DOM-Element Caching während des Draggings implementiert, um Verzögerungen in `handleMouseMove` zu minimieren.
- **Improved UX**: Skalierungskorrektur für Rectangle Selection und Komponenten-Drop aus der Palette.
- **Bugfix (Snap-Back)**: Fehler behoben, bei dem Objekte nach dem Drag an ihre alte Position zurücksprangen (fehlendes `render()` nach Style-Reset).
- **Fix (Project Creation)**: Projekt-Neuerstellung über das Menü (Datei > Neues Projekt) wiederhergestellt.
- **Architecture**: "New Project" initialisiert jetzt direkt eine Blueprint-Stage gemäß den SSoT-Regeln.

## [3.5.13] - 2026-02-26
- **Fix (Deletion Logic)**: Wiederherstellung der Löschfunktion für Stage-Komponenten und Flow-Diagramm-Elemente.
- **Improved UX**: Implementierung von `removeMultipleObjectsWithConfirm` für das sichere Löschen mehrerer Objekte mit Referenzprüfung.
- **Recursive Deletion**: `EditorCommandManager.removeObjectSilent` wurde um die rekursive Löschung verschachtelter Objekte (z.B. in Dialogen) erweitert.
- **Flow Editor**: Entschärfung des `isLinked` Checks im `FlowGraphManager`, um das Löschen von verlinkten Knoten aus dem Diagramm zu ermöglichen.

## [3.5.12] - 2026-02-25
- **Feature (Inspector Discovery)**: Implementierung der dynamischen Modell- und Feld-Erkennung im `InspectorContextBuilder`. Modelle werden nun direkt aus der `db.json` geladen.
- **Auto-Sync**: Einführung von automatischem Daten-Seeding beim Projekt-Laden (`EditorDataManager`), um die Konsistenz zwischen Server-Daten und LocalStorage zu garantieren.
- **Improved UX**: Kontextsensitive Singular/Plural-Vorschläge basierend auf dem Variablentyp (`object` vs `object_list`).
- **Path Resolution**: Dynamische Ermittlung des `storagePath` aus vorhandenen `TDataStore`-Objekten.

## [3.5.11] - 2026-02-25
- **Feature (Advanced Refactoring)**: Implementation eines projektweiten Refactoring-Systems.
- **Unified Deletion**: Zentralisierte Lösch-Bestätigung mit Nutzungsberichten für Variablen, Tasks, Aktionen und Objekte.
- **Seamless Renaming**: Automatische Aktualisierung aller Referenzen bei Namensänderungen im Inspector.
- **RefactoringManager**: Erweiterte Usage-Reporting-Engine zur Identifikation von Abhängigkeiten in Flow-Charts und Objekt-Mappings.

## [3.5.10] - 2026-02-25
- **Fix (Deletion)**: Behebung des Fehlers beim Löschen von Variablen und Objekten. `EditorCommandManager.removeObject` löscht nun permanent via `removeObjectSilent`.
- **Fix (Inspector)**: Löschfunktion im Inspector repariert (fehlende Action-Property und Verknüpfung zum Editor korrigiert).
- **Integrität**: Stage-Events für `delete` und `deleteMultiple` in `EditorInteractionManager` angebunden, um Löschen via Entf-Taste und Kontextmenü zu unterstützen.

## [3.5.9] - 2026-02-25
- **Fix (Inspector)**: Behebung des Selektions-Problems für Variablen-Objekte (`TObjectVariable`) auf der Stage. Diese werden nun korrekt über die zentrale Objekt-Auflösung erkannt und im Inspector angezeigt.
- **Architektur (SSoT)**: Konsolidierung der Flow-Variablen auf Single Source of Truth (SSoT). Visualisierungs-Knoten halten nun Referenzen auf Projekt-Variablen statt Kopien.
- **Integrität**: Implementierung und Ausführung eines SSoT-Cleanup-Skripts zur automatischen Bereinigung redundanter Flow-Daten in der `project.json`.
- **Validierung**: Erfolgreicher Regression-Test aller kritischen Pfade (QA-Report grün).

## [3.5.8] - 2026-02-25
- **Fix (Build)**: TypeScript-Fehler in `RefactoringManager.ts` behoben (ungenutzte Variable `originalCount` entfernt).
- **Validierung**: Vollständiger Projekt-Build und Regression-Tests erfolgreich durchgeführt. QA-Report ist grün.

## [3.5.7] - 2026-02-24
- **Fix (Integrität)**: Backend-Synchronisation für den Editor implementiert. Die `project.json` wird nun beim Start vom Server geladen und überschreibt den lokalen `localStorage`, um Konsistenz sicherzustellen.
- **Fix (UX)**: Automatischer Wechsel zur visuellen 'Stage'-Ansicht, wenn über das Menü oder bei Neuanlage eine Stage gewechselt wird. Dies verhindert Verwirrung, wenn man sich in anderen Ansichten (Flow/Code) befindet.
- **Fix (Flow-Editor)**: Blueprint-Flow-Diagramme (Main Flow und Tasks) werden nun korrekt im Dropdown angezeigt und geladen, auch wenn man sich in einer anderen Stage befindet. Dies stellt sicher, dass globale Logik jederzeit editierbar ist.
- **Fix (Login)**: Der `ApiSimulator` delegiert Login- ( `/api/platform/login`) und Datenanfragen (`/api/data/*`) nun per Proxy direkt an den Server. Dadurch bleibt die `db.json` auf der Festplatte die alleinige Source of Truth und der Login im Run-Mode funktioniert zuverlässig ohne manuelles Seeding.

## [3.5.6] - 2026-02-24

- **Feature (Flow Editor)**: Globale/Blueprint-Tasks sind nun von JEDER Stage aus im Dropdown sichtbar. Die Gruppe "Global / Blueprint" wird permanent eingeblendet.
- **Fix (Refactoring)**: Task-Löschung ist nun robust gegen Case-Sensitivity (z.B. attemptLogin vs AttemptLogin).
- **Fix (Integrität)**: Automatische Bereinigung von Task-Duplikaten in `project.json` beim Laden via `RefactoringManager.sanitizeProject`.
- **Integrität**: `AttemptLogin` Task in `stage_login` konsolidiert und verwaiste Duplikate in anderen Stages entfernt.
- **Fix (JSON)**: Reparatur der `project.json` nach struktureller Korruption im `stage_login` Bereich. Alle Tasks, Aktionen und FlowCharts sind nun wieder syntaktisch korrekt und konsistent.

## [3.5.5] - 2026-02-24
- **Hotfix (Flow Robustheit)**: Implementierung eines mehrstufigen "Magnet-Effekts". Verbindungen rasten nun extrem zuverlässig ein (Anker-Puffer 15px, Knoten-Körper-Magnet 25px).
- **Hotfix (Flow Logik)**: Korrektur eines Priorisierungsfehlers im Hit-Test, der zu instabilem Verhalten beim Verbinden von eng beieinander liegenden Knoten führte.

## [3.5.4] - 2026-02-24

## [3.5.3] - 2026-02-24
- **Hotfix (Flow Interaktion)**: Behebung des Problems, dass bestehende Verbindungen nicht mehr gelöst werden konnten (Detachment-Logik in `updatePath`).
- **Hotfix (Selection & Focus)**: Korrektur des Fokusverlusts bei Verbindungen. Neue Verbindungen bleiben selektiert und werden korrekt an den Inspector gemeldet.
- **Hotfix (Inspector Support)**: `FlowConnection` bietet nun eigene Inspector-Eigenschaften zur Identifikation und Bearbeitung (Beschriftung).

## [3.5.2] - 2026-02-24

## [3.5.1] - 2026-02-24
- **Hotfix (Flow Verbindungen v2)**: Verfeinerter Anchor-Hit-Test erkennt nun auch `success`/`error` Ports und bietet 5px Puffer für einfachere Bedienung.
- **Hotfix (Flow Sync)**: Erweitertes Logging im `FlowSyncManager` zur Verifizierung von verzweigten Aktionen (DataAction/Condition).
- **Hotfix (Flow Verbindungen v1)**: Behebung verschwindender Verbindungen durch sofortiges Attaching beim Erstellen.
- **Hotfix (Flow Toolbox)**: Behebung der unsichtbaren Toolbox im Flow-Editor durch Ergänzung des fehlenden `render()`-Aufrufs und Korrektur der Layout-Toggle-ID.
- **Hotfix (Stages Menü)**: Wiederherstellung der dynamischen Stage-Liste im Hauptmenü durch Korrektur der Menü-ID (`Project` -> `stages`) und automatische Aktualisierung bei Projekt-Änderungen.
- **Hotfix (MenuBar Container)**: Behebung eines UI-Crashs durch Korrektur der DOM-ID `menu-bar` in `Editor.ts`.
- **Hotfix (FlowEditor UI)**: Wiederherstellung des Flow-Editors durch Korrektur der IDs `flow-viewer` und `toolbox-content`.
- **Hotfix (Stabilität)**: Einführung von Error-Handling (Try-Catch) für alle Kern-UI-Komponenten in `Editor.ts`.
- **Fix**: Snap-Back Effekt beim Dragging behoben (fehlendes `render()` nach Style-Reset).
- **Dragging**: Browser-Zoom Korrektur für alle Bühnen-Interaktionen implementiert.
- **Stage Refactoring (Phase 1 & 2)**: Vollständige Modularisierung der Stage.ts zur Komplexitätsreduktion.
  - StageRenderer.ts: Übernimmt das gesamte HTML/SVG Rendering der Bühne.
  - StageInteractionManager.ts: Verwaltet alle Benutzerinteraktionen (Drag, Resize, Selection, ContextMenu).
  - Stage.ts: Fungiert nun als schlanker Orchestrator zwischen den Services.
- **Ultra-Lean FlowEditor**: Vollständige Modularisierung von `FlowEditor.ts` abgeschlossen. Die Dateigröße wurde massiv reduziert, indem fast alle Fachlogiken in spezialisierte Manager-Services extrahiert wurden.
- **Neue Manager-Services**:
  - `FlowUIController`: Übernimmt Grid-Management, Zoom, Scroll-Area Updates und die Mediator-Initialisierung.
  - `FlowTaskManager`: Verwaltet Task-Registry-Operationen (`rebuildActionRegistry`, `ensureTaskExists`).
  - `FlowNodeFactory`: Zentralisiert die Erstellung aller Flow-Elemente (`Action`, `Task`, `Condition`, `Variable`, `Start`).
- **Delegations-Architektur**: `FlowEditor` fungiert nun primär als Orchestrator ("Lean Host"), was die Testbarkeit und Wartbarkeit erheblich verbessert.
- **Bugfix (Type Error)**: Behebung von Linting-Fehlern in `FlowEditor.ts` durch typsichere Delegation an Manager.
- **Fehlerbehebung (TypeScript/Linting)**: Vollständige Implementierung aller Host-Interfaces in `Editor.ts` (z.B. `EditorDataHost`, `EditorRenderHost`, `EditorMenuHost`). Ergänzung fehlender Methoden in `EditorStageManager.ts` (`getResolvedInheritanceObjects`, `deleteCurrentStage`, etc.) und Behebung der `JSONComponentPalette` Konstruktor-Signatur.
- **Dokumentation**: Aktualisierung der `DEVELOPER_GUIDELINES.md` und des `UseCaseIndex.txt` zur Abbildung der neuen Multi-Manager-Architektur.
11: 
12: ## [3.3.24] - 2026-02-23
- **FlowEditor Modularisierung (Phase 2)**: Extraktion von Navigations-Logik (`FlowNavigationManager`) und Graph-Hydrierung/Import-Logik (`FlowGraphHydrator`) aus `FlowEditor.ts`.
- **Interface-Compliance**: Vollständige Umsetzung der Host-Interfaces für alle Manager-Klassen zur Sicherstellung einer sauberen Delegation.
- **Bereinigung**: Reduzierung der Zeilenanzahl von `FlowEditor.ts` und Entfernung redundanter Methoden.
- **Login Restrukturierung**: Verschiebung der Login-Tasks (`AttemptLogin`, `createAnEmojiPin`) und zugehöriger Aktionen von `stage_blueprint` in die spezialisierte `stage_login` zur besseren Kapselung.
- **SSoT Enforcement**: Vollständige Bereinigung der `project.json` von redundanten und verwaisten Flow-Diagrammen ("Geister-Diagramme"). Alle globalen Diagramme liegen nun exklusiv in `stage_blueprint.flowCharts`.
- **Project Validator**: Erfolgreiche Validierung des Projekts auf "Healthy" nach der Umstrukturierung.
- **Smart Variable Deletion**: Implementierung einer intelligenten Lösch-Synchronisation für Variablen im Flow-Editor. Beinhaltet eine projektweite Nutzungsprüfung (`getVariableUsageCount`) und einen Bestätigungsdialog vor der globalen Löschung.
- **RefactoringManager**: Neue Methoden `getVariableUsageCount` und `deleteVariable` zur projektweiten Verwaltung von Variablen-Definitionen.
- **Project Validator**: Implementierung eines automatisierten Integritäts-Checks (`scripts/validate_project.cjs`). Das Script prüft die Konsistenz zwischen Events, Tasks, Actions und Ressourcen-Referenzen in Pascal-Ausdrücken sowie die Synchronität visueller Flow-Diagramme mit der logischen Sequenz.
- **Workflow-Integration**: Neues npm-Script `npm run validate` zur projektweiten Qualitätssicherung.

### Changed
- **Action Editor Deprecation**: Der Legacy-Dialog `dialog_action_editor` wurde vollständig zugunsten des modularen `InspectorHost` abgelöst. Aktionen werden nun exklusiv über den Inspector bearbeitet.
- **InspectorHost Action Renaming**: Die projektweite Umbenennung von Aktionen (`RefactoringManager.renameAction`) wurde nun beim Ändern des Namensfeldes direkt in den `InspectorHost` integriert.
- **FlowAction & FlowDataAction**: Implementierung von `getInspectorProperties` auf den Flow-Knoten, um Aktionsspezifische Parameter (HTTP, Request, Query, Target etc.) dynamisch im Inspector bereitzustellen.

### Fixed
- **FlowEditor**: Behebung von massiven Syntaxfehlern in `selectNode` und Reintegration der Klassenstrukturen.
- **FlowEditor**: Integration der Variablen-Löschung in den `deleteNode`-Workflow (Smart Delete).
- **RefactoringManager**: Behebung von Typ-Warnungen und Bereinigung von statischen Methoden-Aufrufen (`filterSequenceItems`).
- **Data Integrity**: Sicherstellung der Konsistenz zwischen visuellen Flow-Knoten (`VariableDecl`) und globalen Projekt-Variablen.
- **AttemptLogin**: Synchronisierung des Flow-Diagramms durch Ergänzung des fehlenden `httpLogin`-Knotens.
- **Fix**: Projekt-Neuerstellung über das Menü (Datei > Neues Projekt) wiederhergestellt.
- **Architecture**: "New Project" initialisiert jetzt direkt eine Blueprint-Stage gemäß den SSoT-Regeln.
- **Admin Dashboard**: Korrektur des fehlerhaften `onEnter`-Events in der `stage_admin_dashboard` und Definition der zuvor fehlenden `SendApiResponse`-Aktion.
- **Blueprint-Stage**: Behebung struktureller JSON-Inkonsistenzen durch Bereinigung doppelter Eigenschafts-Keys.
- **Data Integrity**: Veraltete eingebettete `flowChart`-Eigenschaften aus Tasks (`AttemptLogin`, `createAnEmojiPin`, `GetRoomAdminData`) entfernt und korrekt in die `flowCharts`-Mappings überführt. Project Validator läuft nun zu 100% sauber durch.

## [3.3.23] - 2026-02-23
### Fixed
- **TaskExecutor**: Implementierung einer hierarchischen Task-Auflösung (Aktive Stage -> Blueprint-Stage -> Legacy Root). Behebt das Problem, dass globale Tasks im Blueprint von der Runtime nicht gefunden wurden.
- **Flow Editor**: Behebung des "Split-Brain" Synchronisationsfehlers bei Tasks (speziell `GetRoomAdminData`).
- **Flow Engine**: Hierarchische Task-Auflösung (Active Stage -> Blueprint -> Global) implementiert.
- **Data Integrity**: Bereinigungslogik für redundante FlowCharts im `FlowSyncManager` hinzugefügt.
- **Rules**: Blueprint-Stage wird nun strikt als Single Source of Truth für globale Elemente bevorzugt.
- **Projekt-Design (Regel 3)**: Erneute Bereinigung von Inline-Actions in `AttemptLogin` und `GetRoomAdminData`. Alle Aktionen werden nun strikt als Referenzen auf globale Definitionen geführt.
- **Daten-Integrität**: Behebung von JSON-Syntaxfehlern in der `project.json` (falsche Arrays und Klammern in der Blueprint-Stage).
- **Entwicklung**: Aktualisierung der `DEVELOPER_GUIDELINES.md` zur Task-Suche und Inline-Actions.


## [3.3.22] - 2026-02-22
### Fixed
- **Inspector**: Fehlende Events für Flow-Elements (DataActions) behoben. Durch die Einführung einer dynamischen Event-Ermittlung in `InspectorHost.ts` werden `onSuccess` und `onError` nun korrekt angezeigt.
- **Inspector**: Absturz bei der Verwendung von String-Styles in JSON-Templates (`CSSStyleDeclaration` Fehler) behoben durch robustere `applyStyle`-Logik in `InspectorRenderer.ts`.
- **Inspector**: Fehlerbehebung bei der Anzeige von Event-Labels ("undefined") und der Task-Auswahl durch Korrektur der Kontext-Auflösung in `InspectorTemplateLoader.ts`.
- **Inspector**: Persistenz-Fix für Event-Mappings: Auswahl bleibt nun erhalten durch korrektes Pfad-Mapping (`event_` -> `events.`) in `InspectorEventHandler.ts`.
- **Inspector**: Refaktoring der Property-Bindung: Einführung des expliziten `property`-Attributs in JSON-Templates für robustere Datenbindung und Ablösung der namensbasierten Heuristik (inkl. Legacy-Fallback).
- **Inspector**: Integration von `availableTasks` in den Datenkontext (`InspectorContextBuilder.ts`) und Implementierung der `map_event`-Aktion.

## [3.3.21] - 2026-02-22
### Fixed
- **Variable Inspector**: Behebung eines Fehlers in `PropertyHelper.ts`, durch den Metadaten (wie `type` oder `defaultValue`) im Inspector nicht mehr angezeigt wurden, sobald eine Variable einen Wert enthielt.
- **DataAction Inspector**: Hinzufügen von Feldern für `Name` und `Beschreibung` im spezialisierten DataAction-Inspector.
- **Property Resolution**: Implementierung eines Fallbacks in `getPropertyValue`, der bei fehlerhafter Inhalts-Auflösung auf die Eigenschaften der Ursprungskomponente zurückgreift.
- **Testing**: Neuer Regressionstest `tests/variable_inspector.test.ts` zur Absicherung der Eigenschafts-Auflösung.

## [3.3.20] - 2026-02-22
### Added
- **Dynamic Card Gallery**: Erhebliche Erweiterung der `TTable` Komponente um eine Gallerie-Ansicht (`displayMode: 'cards'`).
- **Absolute Positioning**: Unterstützung für `x`, `y`, `width` und `height` innerhalb von Karten, was ein stage-ähnliches Layout ermöglicht.
- **Card-Slot-Types**: Neue Slot-Typen `image`, `header`, `badge` und `meta` für standardisiertes Kartendesign.
- **Dynamic Data Binding**: Vollständige Integration mit Stage-Variablen (`TListVariable`) und reaktivem Unwrapping.
- **Inspector Upgrade**: Konditionale Sichtbarkeit für Karten- vs. Tabellen-Konfiguration in `inspector_table.json`.

### Changed
- **Stage Migration**: Die `stage_room_management` wurde vollständig von statischen Mockups auf dynamische `TObjectList`-Komponenten umgestellt.
- **Capacity Tracking**: Die Kapazitätsanzeige reagiert nun dynamisch auf die Anzahl der geladenen Spieler.

## [3.3.19] - 2026-02-22
### Added
- **TDataAction SQL-Style**: Umstrukturierung des Inspectors nach SQL-Logik (SELECT, FROM, WHERE, INTO).
- **Property Projection**: Unterstützung für `selectFields` in der `TDataAction` zur Filterung von Ergebnis-Objekten.
- **Auto-Schema-Detection**: '*' Support für SELECT-Felder im Inspector-Dropdown.

### [3.3.18] - 2026-02-21
### [2026-02-21] - TTable & Binding Fixes (Runtime Optimization)
- **ReactiveRuntime**: Umstellung auf Proxy-basierte Namespace-Auflösung (`global.`, `stage.`) im `getContext`. Gewährleistet zuverlässiges Binding von globalen Komponenten und Variablen.
- **PropertyHelper**: Fix für Property-Shadowing. Verhindert, dass Komponenten-Metadaten (z. B. `.name`) Variablen-Inhalte überschreiben, wenn diese noch leer sind (behebt "currentUser" Anzeige-Bug).
- **TTable**: Smart-Unwrapping für `TObjectList`-Datenquellen und automatisches Column-Inheritance implementiert.
- **ReactiveRuntime**: Deep-Watching für `.data` und `.items` Properties zur automatischen UI-Aktualisierung bei Listen-Änderungen.
- **Tracing**: Spezielle Diagnose-Logs für die Registrierung und Auflösung von `currentRooms` in der Runtime hinzugefügt.

### Hinzugefügt
- **Stage Events Support**: Unterstützung für `onEnter`, `onLeave` und `onRuntimeStart` Events für Stages. Konfiguration direkt über den Inspector ermöglicht.
- **Toolbox Erweiterung**: Neue Kategorie "Daten & Auth" mit `TDataStore`, `TAuthService` und `TUserManager`.
- **Intelligente Stage-Selektion**: Der Editor wählt nun automatisch die Stage-Eigenschaften im Inspector aus, wenn kein Objekt selektiert ist oder über das Menü "Stage-Einstellungen".
- **Variablen-Dropdown Upgrade**: Unterstützung für Untereigenschaften (z.B. `currentUser.id`) in Dropdown-Listen für eine präzisere Datenkonfiguration.
- **Scoped Variable Resolution**: Korrektur der Laufzeit-Auflösung für Variablen mit `global.` und `stage.` Präfix, um Konsistenz zwischen Inspector-Anzeige und Runtime-Execution zu gewährleisten.

### Gefixt
- **Debug-Log-Viewer Spam & Zuverlässigkeit (v3.4.2)**: 
  - `GameRuntime` loggt keine "leeren" `onStart`-Events mehr für Komponenten ohne Flow-Logik.
  - Interne Property-Änderungen (z.B. `eventCallback`) werden im `PropertyWatcher` maskiert.
  - Zuweisungen von HTTP-Ergebnissen (`DataAction`) an Variablen werden nun prominent im Log angezeigt.
  - Stage-Lifecycle-Events (`onEnter`, `onRuntimeStart`) werden nun korrekt im Logbuch protokolliert.
  - RuntimeVariableManager nutzt nun lesbare Variablennamen statt IDs in der Console.
  - **Behoben**: Heimlicher Absturz beim Loggen von unsauberen Objekten durch `JSON.stringify`.
  - **Behoben**: Debug-Log brach nach JEDEM erfolgreichen Stage-Wechsel (z. B. durch `navigate_stage` -> Dashboard) aufgrund eines Fehlers in `EditorViewManager.switchView()` vorzeitig ab.
- **RuntimeStageManager Caching**: 
  - Globale Variablen und Objekte (aus `blueprint` und `main` Stages) werden nun im Speicher gecacht anstatt bei jedem Stage-Wechsel neu aus dem JSON instanziiert zu werden. Dies verhindert den "Gedächtnisverlust" von globalen Variablen während Stage-Übergängen im Play-Modus.
- **TTable Komponente (Dynamische Tabelle)**:
  - Vollwertige `TTable` Komponente hinzugefügt und in `ComponentRegistry` sowie Toolboxen eingebunden.
  - Das HTML-Rendering in `Stage.ts` (Methode `renderTable`) greift direkt auf die gebundenen Runtime-Daten (z.B. `currentRooms.data`) zu.
  - Erlaubt Konfiguration individueller Spalten über die Eigenschaft `columns` (als JSON formatiert via `inspector_table.json`).
  - **Auto-Columns**: Ist keine Konfiguration hinterlegt, werden die Eigenschaften (Keys) des ersten Daten-Elements automatisch als Spalten generiert!
- **MockTaskExecutor**: Fehlende Methoden für Unit-Tests ergänzt (`setActions`, `setFlowCharts`, etc.).
- **Global Variable Cleanup**: Bereinigung von fälschlicherweise in normalen Stages gespeicherten globalen Variablen beim Laden.
- **Fix (Stage Events)**: Exponierung von Stage-Events (`onEnter`, `onLeave`, `onRuntimeStart`) im Inspector.
  - Dediziertes `inspector_stage_events.json` Template und `StageHandler.ts` für die spezialisierte Behandlung von Stages im Inspector.
  - **Fix: Dynamische Ressourcen-Eigenschaften**: Der Inspector zeigt nun basierend auf dem gewählten `DataStore` (z.B. Rooms vs. Users) automatisch die korrekten Felder für die Suche an. Umgesetzt in `InspectorContextBuilder.ts`.
  - **Fix: Inspector Regressionen**: Behebung leerer Dropdowns durch korrekte Auflösung von Ausdruck-Optionen (`${...}`) in `InspectorHost.ts` und `InspectorRenderer.ts`.
  - **Fix: Property Mapping**: Verbessertes Mapping für `FlowNodes` in `PropertyHelper.ts`, um Daten konsistent aus der `project.json` in den Inspector zu laden.
  - **Fix: Room Data Fetch**: Fehlerbehebung beim Laden von Raumdaten durch Flachklopfen der `db.json` Struktur, Korrektur der `queryProperty` (`adminId`) und URLs in `project.json` sowie Bereinigung von Task-Inkonsistenzen.
  - **Fix: Room Data Synchronisation**: `RuntimeVariableManager.ts` synchronisiert nun `.data`-Properties für `TObjectList`-Komponenten. Auto-Unwrapping von Single-Element-Arrays in `StandardActions.ts` auf JWT-Login-Responses eingeschränkt. Spalten von `currentRooms` auf Room-Felder (`name`, `houseId`, `adminId`) korrigiert.
  - Menü-Integration: Neuer Punkt "Stage-Einstellungen" im Stages-Menü zur schnellen Konfiguration der aktuellen Stage.
  - UI-Refinement: Automatisches Selektieren der aktiven Stage im Inspector beim Klicken auf den Bühnenhintergrund (Deselektion von Objekten).
  - Unterstützung für das Fetch-Pattern: Ermöglicht den automatischen Datenabruf via JWT beim Eintritt in eine Stage (`onEnter`).
  - Verifizierung: Neuer Regressionstest `tests/stage_events.test.ts` zur Absicherung der Event-Trigger in der `GameRuntime`.

- **Fix (JSON Workflow Consistency)**: Vollständige Abbildung des Workflows im JSON-Modell.
  - **FlowSyncManager Fix**: `DataAction`-Knoten unterstützen nun den generischen `output`-Anker als Fallback für `success`, was das korrekte Verfolgen von Verzweigungen in der `actionSequence` sicherstellt.
  - **Recursive Registration**: Unter-Aktionen in `successBody`, `errorBody` und `elseBody` werden nun zuverlässig in die globale `actions`-Liste des Projekts aufgenommen.
  - **Single Source of Truth**: `getTargetFlowCharts` in `FlowEditor.ts` korrigiert, um redundante Speicherung von Task-Diagrammen in Stages zu verhindern. Globale Tasks werden nun primär in `project.flowCharts` gespeichert.
  - **Data Patch**: `project.json` bereinigt und `AttemptLogin` als globalen Task mit vollständiger logischer Sequenz (inkl. `Condition`) etabliert.
- **Feature (FlowCondition Inspector Editor)**: Vollumfängliche Konfiguration von Bedingungen im Flow-Editor.
  - Unterstützung für modulare Operanden (Variable, Literal, Element-Eigenschaft).
  - Kontextsensitives UI-Template (`inspector_condition.json`) mit dynamischen Dropdowns für Objekt-Eigenschaften.
  - Runtime-Support im `TaskExecutor` für komplexere Vergleiche (z.B. `Label1.text == 'Login'`) und verschachtelte Variablenpfade (z.B. `${global.currentUser.role}`).
  - Fix: `InspectorTemplateLoader` unterstützt jetzt sowohl Array- als auch Objekt-Wrapper-Strukturen in JSON-Templates.
  - Abwärtskompatibilität für bestehende einfache `variable`/`value`-Bedingungen gewährleistet.
- **Feature (Universal Actions)**: Universell konfigurierbare Aktionen im UI.
  - Einführung der `TActionParams`-Komponente für dynamische Parameter-Rendering in Inspector und Action-Dialog.
  - Dynamische Methodenparameter: `call_method` Aktionen laden nun Parameter-Signaturen direkt aus der `MethodRegistry.ts`.
  - Inspector-Erweiterung: `ActionTypeSelect` erlaubt den Typwechsel direkt im Inspector mit sofortigem UI-Update.
  - Bereinigung: `dialog_action_editor.json` wurde auf das neue generische System (TActionParams) umgestellt, was Redundanzen eliminiert.
  - Fixes: `navigate_stage` und `call_method` sind nun vollständig über das UI konfigurierbar.
  - **Fix (Data Binding)**: Intelligentes Daten-Binding via `PropertyHelper` implementiert. Erlaubt automatischen Zugriff auf verschachtelte `.data`-Objekte von FlowNodes, wodurch Aktions-Parameter nun konsistent im Inspector angezeigt und gespeichert werden.
  - **Feature (Variable Picker)**: Wiederherstellung des Variable Pickers im Inspector. Textfelder (z.B. `Label.text`) und Aktions-Parameter (z.B. `ShowMessage`) erhalten einen Button 'V', um Variablen-Tokens `${...}` einzufügen.
  - **Fix (Variable Binding)**: Behebung des Fehlers, bei dem Variablen-Ausdrücke wie `${currentUser.name}` im Inspector nicht aufgelöst wurden. Der `InspectorContextBuilder` stellt nun alle Variablen-Werte (inkl. Präfix-Support für `global.` und `stage.`) bereit.
  - **Fix (Runtime Persistence)**: Behebung des "Gedächtnisverlusts" beim Stage-Wechsel. Die `ReactiveRuntime` bewahrt globale Variablen nun persistent über Stage-Grenzen hinweg auf.
  - **Fix (Editor Preview)**: Konsistente Variablen-Auflösung in der Stage-Vorschau durch Angleichung des `VariableContext` an die Inspector-Logik.
  - **Fix (Live-Mode Navigation)**: Behebung des Fehlers, bei dem die Sandbox-Engine (`GameRuntime`) im Editor durch den Stage-Wechsel-Aufruf (`onNavigate`) komplett beendet und neu instanziiert wurde. Der Live-Modus weitet die Navigation jetzt durch die neue Methode `switchToStage` direkt auf die laufende Engine aus, was die Zustandserhaltung garantiert.
  - **SSoT-Synchronisation (FlowSyncManager)**: Bei der grafischen Synchronisierung von canvas-nodes (`isLinked: true`) dürfen globale Definitionen nur dann aktualisiert werden, wenn der Knoten vollständige Logik-Daten enthält. Sparse Metadata-Updates (nur Name/Position) müssen von Logik-Updates getrennt bleiben, um ein Überschreiben der vollen Aktionsdefinition durch Minimaldaten durch Minimaldaten zu verhindern.
- **Datenverlust-Schutz (type)**: In `updateGlobalActionDefinition` muss sichergestellt werden, dass ein bereits existierender `type` im globalen Register NICHT durch `undefined` aus den Knotendaten überschrieben wird. Dies ist entscheidend für neue Nodes, deren Metadaten noch nicht vollständig im Diagramm-Zustand repliziert wurden.
- **Stabile Knoten-Referenzierung**: Verwende in Synchronisations- und Wiederherstellungs-Routinen (wie `restoreConnection`) IMMER die technische `id` des Knotens. Der Getter `name` auf `FlowElement` ist ein Alias für die `id`, aber für die Suche in Listen sollte robust gegen beide Felder (`id` ODER `name`) geprüft werden, um Abwärtskompatibilität zu gewährleisten.
- **Typwechsel-Logik**: Beim Wechsel von Aktionstypen im Dialog sollte die Definition ersetzt statt gemergt werden, um inkompatible Felder (z.B. alte Variablenreferenzen) restlos zu entfernen. Zusätzlich wurde eine Endlos-Bootschleife beim Stage-Wechsel im Live-Modus via `EditorRunManager.setRunMode` durch einen Early Return behoben.
  - **Fix (Live Mode Variable Reset)**: Verhinderung des fehlerhaften `INITIAL SYNC`-Überschreibens in `GameRuntime.ts`. Globale Variablen, die beim Live-Stage-Wechsel persistent bleiben, werden nun vor dem Überschreiben mit Default-Werten aus Stage-Komponenten geschützt.
### [3.3.17] - 2026-02-19
- **Fix (StandardActions)**: `call_method` als neuer Action-Handler registriert. Löst `ShowLoginError` (Toaster.show) im Error-Pfad der DataAction korrekt auf. Reihenfolge: Projekt-Objekt → Service-Registry → Spezialfall Toaster.show.
- **Fix (StandardActions)**: `variable`/`set_variable`-Handler: `action.value` als direkter Literal-Fallback wenn `source` fehlt. Löst `ClearPIN` mit `{variableName: 'currentPIN', value: ''}` korrekt auf (leerer String = valider Wert).

### [3.3.16] - 2026-02-19
- **Refactor (AttemptLogin Flow)**: Redundante Condition-Raute `Login Check` entfernt. `doTheAuthenfification` (DataAction) ist jetzt direkt mit `GotoDashboard` (via `success`-Anker) und `ShowLoginError` → `ClearPIN` (via `error`-Anker) verbunden. Die DataAction-eigenen Ausgänge ersetzen die Raute vollständig.
  - `platform/project.json`: FlowChart-Elemente und -Verbindungen angepasst.
  - `actionSequence`: DataAction enthält jetzt korrekte `successBody`/`errorBody`.

### [v3.5.5] - 24.02.2026
- **Fix (Flow Editor):** Selektions-Flimmern durch Originator-Abgleich behoben ('flow-editor').
- **Fix (Inspector):** Automatisches Laden von Daten für existierende Aktionen (SSoT-Logic) in `FlowAction` & `FlowDataAction`.
- **Feature (Inspector):** Connections im Flow-Editor sind nun selektierbar und im Inspector konfigurierbar.
### [3.3.15] - 2026-02-19
- **Fix (FlowSyncManager)**: `doTheAuthenfification` (und alle weiteren DataActions mit `isLinked: true`) werden im Flow-Diagramm jetzt korrekt als **DataAction-Knoten** (blau, mit Success/Error-Ankern) dargestellt.
  - **Bug 1 – `restoreNode()`**: Lädt ForChart-Element mit `type:'Action'`, erkennt aber jetzt über die globale Def `type:'data_action'` und tauscht den instanziierten `FlowAction`-Knoten atomisch gegen `FlowDataAction` aus.
  - **Bug 2 – `generateFlowFromActionSequence()`**: `data_action`-Items in der `actionSequence` erzeugen jetzt `type:'DataAction'` statt `type:'Action'` im generierten FlowChart.
  - **Bug 3 – `syncTaskFromFlow()`**: Beim Zurückschreiben der Sequenz aus dem Canvas wird der echte Typ der verlinkten globalen Action nachgeschlagen (`data_action` statt pauschales `action`).
  - **Data-Patch**: `platform/project.json` FlowChart-Element und `actionSequence` des `AttemptLogin`-Tasks wurden direkt korrigiert (via Node-Script).

### [3.3.14] - 2026-02-19
- **Fix (FlowEditor)**: Blueprint-Stage Tasks (z.B. `AttemptLogin`) erscheinen jetzt im Flow-Dropdown.
  - `FlowEditor.ts` `updateFlowSelector()`: Im Blueprint-Zweig werden nun zuerst `activeStage.flowCharts` und `activeStage.tasks` (stage_blueprint) aufgelistet, bevor Legacy `project.flowCharts`/`project.tasks` folgen.
  - Blueprint-Gruppe im Dropdown heißt jetzt `🔷 Blueprint / Global`.

### [3.3.13] - 2026-02-19
- **Fix (Editor)**: Blueprint-Stage Flow-Tab zeigt nun den **normalen interaktiven FlowEditor** statt eines statischen Mermaid-Diagramms.
  - Entfernung des `blueprintContainer`-Blocks und `renderFlowDiagram()`-Aufrufs aus `Editor.ts` (`render()`, L458-471).
  - Entfernung der `#blueprint-viewer` DOM-Element-Initialisierung (L1789-1797) und des `blueprintContainer`-Feldes.
  - Blueprint-Stage und alle anderen Stages verhalten sich im Flow-Tab nun identisch.

### [3.3.12] - 2026-02-19
- **Fix (Editor)**: Stage/Flow-Tab Trennung vollständig wiederhergestellt.
  - `Editor.ts` (`render()`, L465-470): `stage-wrapper` wird jetzt nur noch bei `currentView === 'stage'` oder `'run'` eingeblendet.
  - Bisher wurde `stage-wrapper` im `else`-Zweig bedingungslos auf `flex` gesetzt, was dazu führte, dass Stage-Elemente (z.B. Login-UI) auch im Flow-, JSON-, Pascal- und Manager-Tab sichtbar waren.
  - **Alle** Stage-Typen (Blueprint, Login, Dashboard etc.) sind nun korrekt: Stage-Tab zeigt Grafik/Variablen, Flow-Tab zeigt ausschließlich den Flow-Editor.

### [3.3.11] - 2026-02-19
- **Fix (Editor)**: Blueprint-View-Trennung implementiert. Mermaid-Diagramme erscheinen nur noch im Flow-Tab, Stage-Tab ist grafisch bearbeitbar.
- **Fix (Sichtbarkeit)**: Globale Elemente (Services, Variablen) sind auf normalen Stages nun strikt unsichtbar (Regression des `isService`-Checks behoben).
- **Fix (Mermaid)**: Syntax-Error durch Leerzeichen in IDs behoben (`querySelector` failure).
- **Fix (Runtime)**: `switchStage` Logik korrigiert, um Rendering veralteter Runtime-Objekte beim Stage-Wechsel zu verhindern.
- **Cleanup**: HTML-Overlays aus Mermaid-Diagrammen entfernt für saubere Darstellung.

### [3.3.10] - 2026-02-19
- **Fix (FlowDiagramGenerator)**: Unterstützung für das `events` Property (neben `Tasks`) implementiert.
- **Fix (FlowDiagramGenerator)**: Der Generator durchsucht nun alle Stages nach Objekten, Tasks und Aktionen, um vollständige Diagramme im Blueprint zu gewährleisten.
- **Fix (Editor)**: Sichtbarkeit von Elementen auf der Blueprint-Stage wiederhergestellt (Layering-Fix für `stage-wrapper`).
- **Deduplizierung**: Flow-Diagramme werden nun pro Objekt+Event eindeutig identifiziert.

### [3.3.9] - 2026-02-19
### Architektur-Anpassung: Blueprint-as-SSoT
- **Core**: Die `blueprint`-Stage ist nun die "Single Source of Truth" (SSoT) für alle globalen Elemente (Tasks, Aktionen, Variablen, Dienste).
- **Registry**: `ProjectRegistry` angepasst, um globale Elemente dynamisch aus der Blueprint-Stage aufzulösen, auch wenn keine Wurzel-Arrays im JSON vorhanden sind.
- **Sichtbarkeit**: Globale Dienste (wie API-Server) werden nun auf allen Stages als Referenz-Objekte ("Ghosts") angezeigt.
- **Visualisierung**: `FlowDiagramGenerator` korrigiert, um Diagramme basierend auf der Blueprint-Logik stage-übergreifend zu generieren.
- **Automation**: `AgentController` aktualisiert, damit neue globale Logik direkt in der Blueprint-Stage angelegt wird.

## [3.3.8] - 2026-02-19
- **Feature**: Blueprint-Flow-Visualisierung implementiert.
    - Automatisches Rendering aller Task-Flows via Mermaid beim Betreten der Blueprint-Stage.
    - Dedizierter `#blueprint-viewer` Container und CSS-Optimierung.
- **Fix**: Datenbereinigung in `project.json`.
    - Redundante globale Actions (`GotoDashboard`, `ShowLoginError`, `ClearPIN`) entfernt.
    - Single Source of Truth: Diese Aktionen werden nun korrekt aus der Blueprint-Stage geladen.

### [3.3.7] - 2026-02-19
- **Fix**: Robuste Stage-Navigation implementiert.
    - `navigate_stage` nutzt jetzt primär `TStageController.goToStage()` direkt (host-unabhängig).
    - `UniversalPlayer.handleNavigation()` um `stage:`-Behandlung erweitert (Fallback).
    - Standalone-Player kann jetzt Stage-Wechsel korrekt durchführen.
- **Feature**: Erster UseCase via AgentController API (`build_login_flow.ts`).
    - `AttemptLogin` Task um Login-Branch erweitert (Gutfall/Schlechtfall).
    - Actions `GotoDashboard`, `ShowLoginError`, `ClearPIN` programmatisch erstellt.
    - Flow-Diagramm wird beim Öffnen automatisch regeneriert (Self-Healing).

### [3.3.6] - 2026-02-19
- **Feature**: AI Agent Controller API (`AgentController.ts`) eingeführt.
    - Bietet eine typsichere "High-Level" API für AI-Agenten zur Projekt-Manipulation.
    - **Architektur-Schutz**: Verhindert aktiv die Erstellung von Inline-Actions (erzwingt globale Definition + Referenz) und stellt konsistente Task-Registrierung (Global + Stage) sicher.
    - **Flow-Konsistenz**: Implementierung der "Scorched Earth" Strategie für FlowCharts – bei logischen Änderungen am Task wird das Diagramm gelöscht, um eine saubere Neu-Generierung durch den `FlowEditor` zu erzwingen.

### [3.3.5] - 2026-02-19
- **Bugfix**: `RuntimeVariableManager` loggte Variablen-Änderungen als `[object Object]`.
    - Behoben durch explizite `JSON.stringify` Konvertierung von Objekten im Logging.
    - Zudem wurde der Variablen-Lookup verbessert, sodass `currentUser` auch gefunden wird, wenn der Zugriff über die ID `var_currentUser` erfolgt.
- **Bugfix**: `RuntimeVariableManager` speicherte Variablen unter ihrer ID (`var_...`), wenn diese so gesetzt wurden.
    - Behoben: Variablen werden nun *immer* unter ihrem Namen (`currentUser`) gespeichert, selbst wenn der Setter die ID verwendet.
    - **Fuzzy-Lookup**: Falls der exakte Match fehlschlägt, wird versucht, das Präfix `var_` zu ignorieren, um die Variable zu finden.
- **Refactoring (Global Variables)**: `RuntimeVariableManager` baut nun beim Start einen Index aller globalen Variablen aus *allen* Stages auf.
    - Damit werden Variablen wie `currentUser` (definiert in `Blueprint`, genutzt in `Login`) korrekt gefunden und aufgelöst.
    - Das behebt alle Probleme mit Cross-Stage-Bindings und Variable-Settern.
- **Bugfix (Reactive Binding)**: Bindings wie `${currentUser.name}` funktionierten nicht, weil `ReactiveRuntime` Updates unter der ID (`var_currentUser`) erhielt, aber Bindings auf den Namen (`currentUser`) warteten.
    - Behoben: `RuntimeVariableManager` aktualisiert nun `ReactiveRuntime` immer unter dem Variablennamen (`actualProp`).
    - **Ergebnis**: Variablen-Werte haben nun korrekt Vorrang vor Komponenten-Objekten gleichen Namens. `${score}` liefert den Wert, nicht das Objekt.

### [3.3.4] - 2026-02-19
- **Tweak**: Verbesserte Debug-Ausgaben in `StandardActions.ts` (http/JWT).
    - **Namen statt IDs**: Das Log zeigt nun den sprechenden Variablennamen (z.B. "currentUser") anstelle der internen ID ("var_currentUser"), sofern auflösbar.
    - **Objekt-Darstellung**: JSON-Objekte werden explizit als String (`JSON.stringify`) geloggt, um `[object Object]`-Anzeigen im Log (insb. DebugLogViewer) zu vermeiden.

### [3.3.3] - 2026-02-19
- **Feature**: Automatische JWT-Verarbeitung in `StandardActions.ts` (Action: `http`).
    - **Token**: Wird bei erfolgreichem Login (`requestJWT: true`) automatisch in `localStorage` (`auth_token`) gespeichert.
    - **User-Unwrapping**: Falls die Antwort ein `user`-Objekt enthält, wird dieses nun direkt in die `resultVariable` geschrieben (anstatt der vollen Response), um den Zugriff (z.B. `${currentUser.name}`) zu vereinfachen.
- **Doku**: Aktualisierung der `DEVELOPER_GUIDELINES.md` bezüglich der neuen "Magic"-Logik.

### [3.3.2] - 2026-02-19
- **Refactoring**: Entfernung aller verbleibenden Referenzen auf `JSONInspector.ts` in der Dokumentation (`DEVELOPER_GUIDELINES.md`, `UseCaseIndex.txt`, etc.). Das System nutzt nun vollständig die modulare `InspectorHost`-Architektur.
- **Refactoring**: Konsistente Umbenennung von `jsonInspector` zu `inspector` im gesamten Codebase (`Editor.ts`, `EditorCommandManager.ts`).
- **Fix**: Behebung diverser TypeScript-Fehler (unused parameters, potentially undefined objects) während des Refactorings.

### [3.3.1] - 2026-02-19
- **Fixed**: Vite-Proxy für `/platform` hinzugefügt (behebt JSON-Parsing-Fehler beim Force Reload).
- **Changed**: Menü-Struktur bereinigt (Redundanzen entfernt, neue Kategorien "Plattform" und "Werkzeuge").
- **Fixed**: AuthCode/currentPIN Interpolationsfehler in `project.json` behoben.

### [3.3.0] - 2026-02-19
- **Force Reload**: Implementierung einer "Vom Server neu laden" Funktion im Editor (`Editor.ts`, `PPersistenceService.ts`), um den LocalStorage gezielt zu überschreiben.
- **Login AuthCode Fix**: Behebung des "Missing authCode" Fehlers durch Korrektur der Variablen-Referenz (`global.currentPIN` -> `currentPIN`) in der `project.json`.
- **Architecture**: Umzug der Login-Tasks/Actions in die globale `stage_blueprint`.
- **Inline-Action Cleanup**: Vollständige Entfernung redundanter Inline-Aktionen aus `stage_login` und `stage_role_select`.
- **Lint**: Behebung eines Trailing-Comma Fehlers in der `project.json`.

- **JWT Runtime Safety**: Automatische URL- und Method-Absicherung in `StandardActions.ts` für `requestJWT` Anfragen.
- **DataAction Persistence Fix**: Robuste Eigenschafts-Synchronisation in `FlowDataAction.ts` (Mirroring) und Legacy-Fallbacks (`resource`, `property`, `variable`) in Editor und Runtime zur Sicherstellung der Datenkonsistenz.

### [0.9.4] - 2026-02-18
### Added
- **Smart Variable Inspector**: Kontextsensitive Anzeige von Feldern (Min/Max, Intervalle, Trigger) basierend auf dem gewählten Variablentyp via `visible`-Property in JSON-Templates.
- **Threshold Events**: Neue Events für Schwellwerte (`onThresholdReached`, `onThresholdLeft`, `onThresholdExceeded`) im Inspector hinzugefügt.
- **Variable Scope**: Auswahl des Geltungsbereichs (🌎 Global vs 🎭 Stage) im Inspector wiederhergestellt.
- **Event-Templates**: Unterstützung für spezialisierte Event-Templates in Handlern (`getEventsTemplate`) und Implementierung von `inspector_variable_events.json` für typspezifische Events.
- **InspectorContextBuilder**: Erweitert um `availableModels` zur Auswahl von Daten-Schemata bei Objekt-Variablen.
- **InspectorHost**: Implementierung der `visible`-Evaluierung für UI-Elemente und dynamisches Rendering des "Events"-Reiters.

### Fixed
- **Inspector Tab-Switch Fix**: Behebung des Fehlers "Kein Objekt ausgewählt" beim Umschalten zwischen Eigenschaften und Events durch interne Selektions-Persistenz im `InspectorHost`.

### [0.9.3] - 2026-02-17
### Added
- **Inspector**: Support for specialized, minimal templates for Flow nodes and Variables.
- **Inspector**: Added `inspector_flow.json` and `inspector_variable.json` to reduce UI clutter.
- **Inspector**: Fixed name editing in Flow nodes by binding to the `Name` property.
- **Inspector**: Removed geometry and parameter clutter from Task Inspector.
- **Inspector**: Added support for rendering klickable buttons in dynamic property lists.
- **Refactoring**: Fixed a crash in `RefactoringManager` during Task renaming when encountering malformed action sequences.
- **Refactoring**: Enabled reliable Task renaming via the Inspector.
### Fixed
- **Inspector**: Dropdowns für Tasks und Actions werden nun dynamisch via `ProjectRegistry` befüllt (`source: 'tasks'`), was "Geister-Einträge" nach dem Löschen verhindert.
- **Flow Editor:** Fix für die Synchronisation des Task-Dropdowns bei Umbenennungen.
- **Inspector**: Automatisches Labeling für JSON-Templates via `label` Property implementiert.
- **Inspector**: `InspectorContextBuilder` eingeführt, um Dropdown-Listen (`availableDataStores`, `availableVariablesAsTokens`, etc.) dynamisch zu befüllen.
- **Inspector**: Refinement der Dropdowns (Namen statt IDs, benutzerfreundliche Variablen-Tokens, Feldvorschläge angepasst an `db.json`).
- **Inspector**: Verhindert doppelte Anzeige von Standard-Eigenschaften, wenn ein spezialisiertes Template aktiv ist.
- **Inspector**: Unterstützung für Platzhalter (`placeholder`) in Dropdowns hinzugefügt.
- **Runtime:** Verbesserung der `http` Action; unterstützt nun explizite `false` Rückgabewerte bei 401/Simulationsfehlern zur Triggerung von Flow-Verzweigungen.
- **Doku:** Neuer Umsetzungsplan für JWT-Authentifizierung via `DataAction` (blau) Nodes.
- **FlowEditor**: Optimierung: Verhindert unnötiges Neuladen des Diagramms (`setProject` im `Editor` für Inspector-Events deaktiviert) und erzwingt die Auswahl des neuen Namens (Auto-Recovery).
- [x] Korrekte Verwendung von `Name` (Setter) vs. `name` (Getter) bei Flow-Elementen sichergestellt.
- [x] Flow-Editor: Unterscheidung zwischen `Action` (orange/linear) und `DataAction` (blau/verzweigend). Nur `DataAction` unterstützt grafische Success/Error-Abzweigungen.
- **Dialogs**: Auch Action-Dialoge nutzen nun die dynamische `ProjectRegistry`-Quelle für Parameter-Dropdowns.
### Changed
- **Inspector**: Extended `IInspectorHandler` interface to allow handlers to define custom templates.

## [0.9.2] - 2026-02-17
### Fixed
- [x] Fix Flow Editor selection flickering (Originator: 'flow-editor')
- [x] Bind `flowEditor.onObjectSelect` in `Editor.ts`
- [x] Assign unique IDs to `FlowConnection`
- [x] Search for connections in `EditorCommandManager.findObjectById`
- [x] Fix `DataAction` Inspector Synchronization
    - [x] Update `FlowAction.getActionDefinition` (implicit naming lookup)
    - [x] Update `FlowDataAction.getActionDefinition` (implicit naming lookup)
    - [x] Set `isLinked` automatically on name match
    - [x] Verify fix with `npm run test`
- [x] Documentation & Finalization
    - [x] Update `UseCaseIndex.txt`
    - [x] Update `CHANGELOG.md`
    - [x] Final QA Report check
- **Fix:** Expression-Resolution im Inspector via `ExpressionParser` (unterstützt komplexe Bindings & selectedObject).

### [0.9.0] - 2026-02-17
### Added
- **Major Architecture Upgrade: Modular OO-Inspector**: 
  - Umstellung des `JSONInspector` auf eine objektorientierte Architektur (`InspectorHost`, `InspectorRenderer`, `InspectorEventHandler`, `InspectorRegistry`).
  - Modularisierung der Logik in spezialisierte Handler (`VariableHandler`, `FlowNodeHandler`, `InspectorActionHandler`).
  - Behebung von technischer Schuld: Eliminierung des 1600+ Zeilen Monolithen durch modernstes Clean-Code Design.
  - Implementierung einer Legacy-Kompatibilitätsschicht für stabilen Editor-Betrieb.

## [3.0.0] - 2026-02-17
### Added
- **Major Architecture Upgrade: Modular OO-Inspector**: 
  - Umstellung des `JSONInspector` auf eine objektorientierte Architektur (`InspectorHost`, `InspectorRenderer`, `InspectorEventHandler`, `InspectorRegistry`).
  - Modularisierung der Logik in spezialisierte Handler (`VariableHandler`, `FlowNodeHandler`, `InspectorActionHandler`).
  - Behebung von technischer Schuld: Eliminierung des 1600+ Zeilen Monolithen durch modernstes Clean-Code Design.
  - Implementierung einer Legacy-Kompatibilitätsschicht für stabilen Editor-Betrieb.

## [2.18.14] - 2026-02-17
### Added
- **Checkpoint**: "Vor Inspector Umbau" - Vorbereitung für das Major-Refactoring des `JSONInspector`.

## [2.18.13.1] - 2026-02-17
### Fixed
- **Variable Persistence**: Fehler behoben, bei dem String-Variablen-Werte im Inspector gelöscht wurden (PropertyHelper Fallback-Logik).
- **Type Stability**: Morphing-Logik für `any` und `json` Typen korrigiert.
- **Task Renaming Investigation**: Root-Cause für fehlerhaftes Task-Renaming identifiziert (Whitelist & Raw-Object-Check).

## [2.18.13] - 2026-02-16
### Fixed
- **Ghost Run Fix**: Das Laden eines Projekts erzwingt nun ein sofortiges `autoSaveToLocalStorage`.
  - Dies verhindert, dass ein Page-Reload (`Ctrl+F5`) direkt nach dem Laden zu einem leeren Default-Projekt führt (Ghost Run).
  - Der Browser-Speicher spiegelt nun immer exakt das zuletzt geladene Projekt wider.

## [2.18.13] - 2026-02-19
### Added
- **API Persistence**: Implementierung des Server-Endpoints `POST /api/dev/save-project` in `server.ts` ermöglicht nun die dauerhafte Speicherung der Plattform-Konfiguration (`project.json`) auf der Festplatte.
### Changed
- **SSoT (Zentralisierung)**: Konsolidierung von `GetRoomAdminData` und anderen globalen Tasks. Redundante Definitionen in lokalen Stages (`stage_dashboard`, `stage_player_lobby`) wurden entfernt und durch einheitliche Referenzen auf die `blueprint`-Stage ersetzt.
- **Editor-Integration**: `Editor.ts` triggert nun bei jeder Änderung (`updateProjectJSON`) den neuen Server-seitigen Speichervorgang, zusätzlich zur lokalen `localStorage`-Sicherung.
- **JSON Cleanup**: Bereinigung der `project.json` von doppelten `events`-Keys und Syntax-Fragmenten.

## [2.18.12] - 2026-02-16
### Added
- **Inspector**: Anzeige von Klasse und ID des selektierten Objekts im Header (hilft bei Identifikation von `TLabel` vs `TStringVariable` etc.).
### Changed
- **Architecture**: `DataAction` integriert nun vollständig mit `TDataStore`. Direkte Dateipfad-Referenzen wurden durch Komponenten-Referenzen (`UserData`) ersetzt.
- **API Simulator**: Der Simulator in `Editor.ts` unterstützt nun flexible Datenquellen via `storageFile`-Parameter, der aus der `dataStore`-Komponente aufgelöst wird.
- **GCS Core**: Unterstützung für generische Variablentypen (`any`, `json`) hinzugefügt, um komplexe API-Antworten ohne festes Datenmodell zu speichern.
- **Flow Editor Selection Fix**: Behobener Bug, bei dem die Selektion im Diagramm sofort wieder auf `null` zurückgesetzt wurde (Ursache: Originator-Mismatch 'flow' vs 'flow-editor' im RenderManager).
- **Inspector Sync Fix**: Wiederherstellung der Datenanzeige im Inspector für selektierte Flow-Elemente (Nodes & Connections) durch Implementierung von IDs für Verbindungen und Binding des `onObjectSelect` Callbacks in `Editor.ts`.
- **Magnet-Effekt (Robustness)**: 15px Puffer für direkte Anker-Treffer + 25px "Magnet" für Knoten-Bodies (Nearest-Anchor-Heuristik).
- **Detachment-Logik**: Verbindungen können nun manuell von Ankern "abgezogen" werden (X/Y Delta Tracking).
- **Hit-Test Fix**: Priorisierung von direkten Anker-Treffern vor Magnet-Effekten zur Vermeidung von Overwrites im Loop.
- **Action Persistence**: Fix für die Persistenz von `http` Aktionen durch Getter/Setter-Proxys in `FlowAction`.
- **Flow Editor**: Korrektur der Node-Details Anzeige (keine `undefined` Werte mehr).
- **Persistence**: Implementierung von OOP-Getters/Settern in `FlowDataAction.ts` und Optimierung der `Smart-Sync`-Logik im `InspectorHost.ts` zur Vermeidung von Datenverlust bei verlinkten Elementen.
- **API Handler**: `ActionApiHandler` löst nun `dataStore`-Referenzen auf und nutzt deren Konfiguration (`storagePath`, `collection`).
- **API**: Implementierung einer rekursiven Pfad-Ermittlung (`getDeepPaths`) im Backend zur Unterstützung tiefer JSON-Sektoren.
- **UI Refinement**: `DataAction`-Inspector bereinigt. Redundantes `resource`-Feld entfernt, URL/Route schreibgeschützt (Auto-Update), und `resultPath` (Daten-Pfad) als Dropdown mit "Deep-Scan" Support und "Gesamte Daten"-Option implementiert.
- **Fix (FlowSync)**: Einführung einer hierarchischen Task-Auflösung (Blueprint > Global > Local) zur Vermeidung von Split-Brain Zuständen.
- **SSoT (Blueprint-Stage)**: Konsolidierung aller globalen Tasks und Aktionen in der `stage_blueprint`.
- **Cleanup (Rule 3)**: Entfernung von Inline-Actions in `GetRoomAdminData` und Bereinigung redundanter Daten-Blobs in Flow-Knoten.
- **Fix (JSON)**: Fehlerbehebung bei Syntax (Kommas) und ungültigen Task-Referenzen in der Projektdatei.
- **Persistence Fix**: Behebung von Diskrepanzen zwischen Flow-Diagramm und Projektmodell durch proaktive Bereinigung redundanter Felder in `project.json`.
- **Bugfix**: Korrektur der Dropdown-Initialisierung im Inspector; Ressourceneigenschaften werden nun beim Auswählen einer `DataAction` sofort geladen.
- **Universal Smart-Unwrap (v2.18.12.2)**: `StandardActions.ts` entpackt Single-Item API-Resultate nun direkt an der Quelle. `ExpressionParser.ts` wurde vereinheitlicht und nutzt nun den `PropertyHelper` für robustes Traversal.
- **Beginner-Safe Variable Picker (v2.18.12.4)**: Einführung des "Magic Dropdown" (📦) im Inspector. Erlaubt das einfache Einfügen von Variablen per Mausklick an der aktuellen Cursor-Position in allen Textfeldern.
- **Variable IntelliSense (v2.18.12.5)**: Erweiterung des Magic Dropdowns (📦). Verknüpfte Objekt-Variablen (`objectModel`) bieten nun automatisch ihre Felder (z.B. `${currentUser.name}`) basierend auf der `db.json` an.
- **Smart-Access**: Implementierung von "Smart-Access" in `PropertyHelper.ts`. Erlaubt direkten Zugriff auf Properties von Arrays mit einem Element (z.B. `${currentUser.name}`).
- **API Simulation Fix (v2.18.12.1)**: `DataService.ts` erlernt "Smart Match" für Arrays. Ermöglicht den Vergleich von String-Queries gegen Emoji-Arrays (z.B. Login mit PIN).
- **API Simulation Fix**: `ApiSimulator` in `Editor.ts` korrigiert; Query-Parameter werden nun korrekt an den `DataService` weitergeleitet, was präzise Filterung ermöglicht.
- **Persistence**: `Object-Model` Dropdown im Inspector sortiert nun Entitäten alphabetisch und erzwingt eine explizite Auswahl (`Modell wählen...`), um versehentliche Falsch-Zuweisungen ("Games" statt "Users") zu verhindern. Zusätzliches Logging für Transparenz.
- **Wiederherstellung (Blueprint)**: Kritischer Datenverlust der Blueprint-Services (Server, DB, Auth) durch Wiederherstellung aus der Git-Historie behoben.
- **Safety Check**: `Editor.ts` verhindert nun aktiv das Speichern einer leeren Blueprint-Stage, um Zerstörung der globalen Dienste durch Race-Conditions zu unterbinden.
- **Blueprint-Globals Resolution**: `RuntimeVariableManager` priorisiert nun Variablen aus der `blueprint` Stage als globale Variablen. Behebt das Problem, dass `currentUser` nach der Wiederherstellung nicht aufgelöst wurde. `project.variables` dient nur noch als Legacy-Fallback.

## [2.18.11] - 2026-02-15
### Changed
- **Refactoring & Cleanup**: Das redundante Feld `isBlueprintOnly` wurde vollständig aus der Codebasis (`TComponent.ts` etc.) und der `project.json` entfernt. Die Sichtbarkeit von Komponenten wird nun ausschließlich über `scope` ('global' vs 'stage') und die Editor-Logik gesteuert.
- **Project Structure**: Alle globalen Variablen wurden in der `project.json` zentralisiert und befinden sich nun korrekt unter `stage_blueprint`.

## [2.18.10] - 2026-02-15
### Fixed
- **Variable Visibility**: Variablen mit `isBlueprintOnly: true` (wie globale Variablen) werden nun auf Standard-Stages im Editor korrekt angezeigt, sofern sie direkt auf der Stage platziert wurden. Die Ausblend-Logik wurde so verfeinert, dass nur noch geerbte Blueprint-Objekte unterdrückt werden.

## [2.18.9] - 2026-02-15
### Added
- **Dokumentation**: Neuer UseCase `ExecuteCalculateVariable.md` dokumentiert den detaillierten Ablauf der Variablen-Berechnung.
- **Testing**: Regressionstest `test_calculate_robustness.ts` zur Absicherung komplexer Expressions (Proxy-Support, Emojis, Undefined-Handling).
### Changed
- **ExpressionParser**: `extractDependencies` verbessert, um verschachtelte Properties (z.B. `.selectedEmoji`) von Root-Variablen zu unterscheiden.
- **Guidelines**: `DEVELOPER_GUIDELINES.md` um Best-Practices für reaktive Expressions erweitert.

## [2.18.8] - 2026-02-15
### Fixed
- **ExpressionParser**: "Undefined-Safe" Evaluierung implementiert. `undefined` oder `null` Werte in Variablen werden nun automatisch als leere Strings (`""`) behandelt, um die Anzeige von `"undefined"` in der Benutzeroberfläche (z.B. bei der PIN-Eingabe) zu verhindern.

## [2.18.7] - 2026-02-15
### Fixed
- **ExpressionParser**: Refaktorierung von `evaluate()`, um Variablen auch in Proxies (z.B. `contextVars`) zuverlässig zu finden. Nutzt nun statische Analyse der Abhängigkeiten statt `Object.keys()`.
- **StandardActions**: 'calculate' Aktion unterstützt nun `formula` und `expression` als Aliase.
- **Variable Sync**: Verbesserte Protokollierung von Variablen-Updates im `RuntimeVariableManager`.

### Added
- **Aggressives Tracing**: Detaillierte Konsolen-Logs für Aktions-Kontexte und Berechnungs-Ergebnisse zur Fehlerdiagnose.

## [2.18.6] - 2026-02-15
### Fixed
- **Action Execution**: Kritischer Bugfix in `GameRuntime.ts`. Parameter-Slot für `contextVars` korrigiert, wodurch Berechnungs-Ergebnisse wieder korrekt in Variablen gespeichert werden.
- **SSoT Integrity**: Einführung von `DESIGN_VALUES` Symbol in `TComponent` und `ReactiveRuntime`.
- **Binding Protection**: Bindungen (Formeln) werden nun vor dem Überschreiben durch Laufzeit-Werte geschützt und im Editor korrekt als Formeln angezeigt.
- **JSON Serialization**: `toJSON` nutzt nun bevorzugt Design-Werte, um Datenverlust bei Bindungen zu verhindern.

## [2.18.5] - 2026-02-15
### Changed
- **Action System Refactoring**: Entfernung von Closure-basierten Objekt-Bindungen in `StandardActions.ts`. Alle Handler nutzen nun dynamisch `context.objects`.
- **Serialization Integrity**: Korrektur von `TVariable.toJSON()` (Aufruf von `super.toJSON()`) zur Beibehaltung von Basis-Metadaten.

## [v2.18.4] - 2026-02-15
### Fixed
- **Emoji PIN Task Fix**: Vollständige Korrektur der kumulativen PIN-Erstellung.
  - **Serialization Robustness**: Fix in `Serialization.ts` zur korrekten Beibehaltung der `isVariable`-Eigenschaft bei der Projekthydrierung.
  - **Variable Sync Fix**: `RuntimeVariableManager` erkennt Variablen nun zuverlässiger (auch über den Klassennamen), was die visuelle und logische Synchronisation sicherstellt.
  - **Expression Context Priority**: In `StandardActions.ts` (calculate) haben Variablen-Werte aus dem Proxy nun Vorrang vor den Komponenten-Objekten. Dies verhindert, dass in Formeln wie `currentPIN + emoji` das veraltete Objekt den aktuellen Wert überschreibt.

## [v2.18.3] - 2026-02-14
### Fixed
- **Variable Morphing Persistence**: Kritischer Bugfix beim Typwechsel (z.B. Integer -> Object).
  - **ID Preservation**: `Editor.ts` überträgt nun garantiert die ursprüngliche ID auf die neue Instanz, um Referenzen (Bindings, Skripte) zu erhalten.
  - **Inspector Display**: `InspectorHost.ts` priorisiert nun `prop.selectedValue` über Bindings, was das visuelle "Zurückspringen" des Typs (Anzeige-Bug) behebt.
  - **Type Property**: Explizites `selectedValue: 'object'` in `TVariable.ts` hinzugefügt, um den korrekten Status im UI zu erzwingen.
- **Data Initialization Robustness**:
  - **Seeding Fallback**: Implementierung einer Fallback-Logik im `JSONInspector`, die fehlende Entitäten (`users`, `cities` etc.) durch ein erzwungenes Re-Seeding vom Server (`/api/dev/data/db.json`) wiederherstellt.
  - **Diagnose-Logging**: Erweitertes Error-Tracing in `DataService.ts`.
- **Quality Assurance**:
  - Neuer Regressionstest `scripts/test_variable_morphing_robustness.ts` zur Absicherung der Morphing-Logik.
  - Technische Dokumentation `docs/use_cases/VariableMorphing.md` erstellt.


### Fixed
- **ROOT CAUSE: Variable Type Serialization**: `JSON.stringify` ignorierte den Prototype-Getter `type` in `TVariable`. Dadurch wurde `_type` nie korrekt serialisiert – der Typ ging bei jedem Neuladen verloren.
  - **Fix 1**: `TVariable.toJSON()` implementiert, die `type` explizit als JSON-Key exportiert statt des privaten `_type`.
  - **Fix 2**: `Serialization.ts` – `_type` zu reservedKeys hinzugefügt. Stattdessen wird `type` explizit via Setter restauriert.
- **Deep Sanitization**: `RefactoringManager.sanitizeProject` entfernt globale Variablen-Duplikate aus allen Stages.
- **Forced Auto-Save**: Morphing-Vorgänge triggern sofort eine Persistierung.

## [v2.18.1] - 2026-02-14
### Fixed
- **Variable Duplication & Persistence**: Der Fehler, bei dem globale Variablen in Stages dupliziert wurden und so den Morph-Vorgang sabotierten, wurde behoben.
- **Sync-Logik**: `syncStageObjectsToProject` filtert nun strikt nach Scope, um Redundanzen im Projekt-JSON zu vermeiden.
- **Self-Healing Morph**: `morphVariable` bereinigt nun automatisch veraltete Duplikate in allen Stages, um korrupte Projektdaten zu heilen.

### Added
- **Automatisierte Regression-Suite (🛡️ Quality Offensive)**:
    - Einführung von `npm run test` zur automatisierten Validierung kritischer Pfade (Login, API).
    - Zentrale Test-Infrastruktur (`scripts/test_runner.ts`, `scripts/test_login_logic.ts`).
    - **Visuelles QA-Dashboard**: Generierung von `docs/QA_Report.md` mit Mermaid-Statusdiagrammen und detaillierter Gut/Schlecht-Test-Übersicht.
    - **AI Mission Control**: Neue `README-AI.md` und verschärfte `DEVELOPER_GUIDELINES.md` zur Durchsetzung von Test-Standards bei allen KI-Modellen.
- **Seeding-Logik v2**: `scripts/seed_test_data.ts` nutzt nun `db.json` als Single-Source-of-Truth und unterstützt das neue `authCode` (Emoji-Array) Schema.

### Fixed
- **Daten-Integrität**: Erroneous `users.json` gelöscht; alle Test-User werden nun in der zentralen `db.json` verwaltet.
- **API Simulation**: Fix des URL-Parsings im Editor (`Editor.ts`) und Server (`ActionApiHandler.ts`) für robustere Parameter-Extrahierung.

## [v2.16.23] - 2026-02-13
### Added
- Detaillierte Trace-Logs für den Flow-Synchronisationsprozess in `FlowEditor.ts`, `FlowSyncManager.ts` und `Editor.ts`.
### Fixed
- Sofortige JSON-Synchronisation: `Editor.ts` aktualisiert nun bei Mediator-Events (`DATA_CHANGED`) alle Sichten (`refreshAllViews`), was unmittelbare Sichtbarkeit im JSON-Editor nach Änderungen im Flow-Editor gewährleistet.
- **Inline-Action Fix**: Die `DataAction1` im Task `AttemptLogin` wurde von einer Inline-Action in eine verlinkte Action umgewandelt und modularisiert, um die korrekte Darstellung im Flow-Editor sicherzustellen.
- **API Simulation Fix**: `StandardActions.ts` liest nun `requestId` korrekt aus `vars.eventData`.
- **DataAction URL Fix**: `DataAction1` globalisiert, damit URL-Parameter korrekt aufgelöst werden.
- **ActionApiHandler Robustness**: Fallback-Logik implementiert, die Query-Parameter (`code`, `pin`, `authCode`) direkt aus dem Pfad parst, falls das `query`-Objekt fehlt. Dies behebt Login-Probleme bei fehlender Editor-Unterstützung für URL-Parsing.
- **TaskExecutor Resolve Fix**: Actions werden nun auch korrekt aufgelöst, wenn sie nicht vom Typ `action` sind (z.B. `data_action`), indem primär auf den Namen geprüft wird.

## [v2.17.1] - 2026-02-14
### Hinzugefügt
- **Variable Morphing Architecture**: Implementierung eines sauberen "Morphing"-Ansatzes beim Ändern des Variablentyps. Statt nur das Property zu mutieren, wird die gesamte Instanz gegen die korrekte Unterklasse (z.B. `TObjectVariable`) ausgetauscht. Dies garantiert volle Persistenz und korrektes Klassenverhalten.
- **Editor.morphVariable**: Zentrale Methode in `Editor.ts` zur Steuerung des Instanz-Austauschs unter Beibehaltung von ID, Name und Verbindungen.

### Behoben
- **Variable Type Persistence**: Vollständige Behebung des Bugs, bei dem der Typ `object` sofort auf `integer` zurückfiel. Durch den Instanz-Tausch im `JSONInspector` via `morphVariable` wird die Single Source of Truth im Projektmodell nun korrekt und stabil aktualisiert.

## [v2.17.0] - 2026-02-14
### Hinzugefügt
- **Smart Mapping**: Neuer `resultPath` Parameter für `http` und `data_action`. Ermöglicht das Extrahieren tiefer Datenstrukturen in flache Variablen.
- **Dynamic Modeling**: Unterstützung für explizite Modell-Typisierung von Objekten (`objectModel`).
- **Entity Discovery**: Automatische Erkennung von Datenbank-Entitäten aus `db.json` zur Auswahl im Editor.
- **VariableType Fix**: Korrektur der Persistenz-Sperre für das `type`-Property (reservedKeys) und systemweite Unifizierung von `variableType` auf `type`. Behebung des Revert-Bug im Inspector durch erzwungenes Re-Rendering bei Typ-Änderung und Anpassung der Serialisierung bleiben gewählte Typen (wie `object`) nun beim Speichern und Laden dauerhaft erhalten.
- **TPropertyDef**: Unterstützung für dynamische Dropdown-Quellen (`source`).

## [2.16.22] - 2026-02-13
### Fixed
- **FlowSyncManager Persistence Critical Fix**:
  - Behebung eines kritischen Fehlers in `syncAllTasksFromFlow`, bei dem die Map-Struktur der FlowCharts falsch adressiert wurde, was zum Leeren der `actionSequence` führte.
  - **Metadata Merging**: Verlinkte `DataAction`-Knoten laden nun beim Synchronisieren ihre vollständigen Metadaten (URL, Method etc.) aus dem Projektmodell in das Sequenz-Item.
- **FlowDataAction.ts Logic**:
  - Bereinigung von Syntax-Fehlern und Konsolidierung der `getActionDefinition` Methode.
  - Safeguards hinzugefügt, um sicherzustellen, dass `data_action` Typen im Modell korrekt gesetzt bleiben.



## [v2.16.20] - 2026-02-13
### Fixed
- **Flow Editor Synchronization Fix**:
  - `DataAction` (z.B. `SubmitLogin`) werden nun korrekt aus Sequenzen gelöscht.
  - `RefactoringManager` durchsucht nun rekursiv `successBody`, `errorBody` und `elseBody`.
  - Unterscheidung zwischen "Force Delete" (User-Aktion) und "Smart Cleanup" (Automatisch) im `FlowEditor` geschärft.
  - Logging für Synchronisations-Prozesse erweitert (`[FlowEditor]`, `[RefactoringManager]`).

## [v2.16.19] - 2026-02-13
### Fixed
- **Action Visualisierungs-Synchronisation**: Vollständige Umsetzung der "Geraden Linie" zwischen Action-Editor und Flow-Editor.
    - Der Flow-Editor nutzt nun primär das `details`-Feld aus dem JSON-Modell (`Single Source of Truth`).
    - `JSONDialogRenderer.ts` generiert beim Speichern fachliche Beschreibungen (Pascal-Syntax).
    - `FlowAction.ts` zeigt diese 1:1 an, was absolute Konsistenz garantiert.
    - Synchronisation von Berechnungs-Aktionen (`calculate`) verbessert: Anzeige der Formel statt nur "(Berechnung)".
    - Konsolidierung der Variablen-Anzeige (`variable`, `set_variable`).

## [v2.16.18] - 2026-02-13
### Fixed
- **Fix**: Tiefgreifende Behebung des Variablentyp-Resets durch Synchronisation von `type` und `className` in `TVariable.ts`.
- **Fix**: Robustere Hydrierung in `Serialization.ts` (Priorisierung von `type` vor legacy Aliassen).
- **Fix**: UI-Re-rendering im `InspectorHost.ts` bei Typänderungen sichergestellt.
- **Calculate Action Save Fix**: Behebung des Datenverlusts von `resultVariable` und `formula` bei 'calculate' Actions.
  - Ergänzung der `action: "updateValue"` Bindings für `CalcResultVariable` und `CalcFormulaInput` in `dialog_action_editor.json`.
  - Erweiterung des `JSONDialogRenderer.ts` (`updateModelValue`), um auch `ResultVariableInput` (Service-Aktionen) korrekt auf `dialogData.resultVariable` zu mappen.
    - Dies stellt sicher, dass Dropdowns immer den aktuellen Projektzustand widerspiegeln (keine Stale Data nach Löschung).
- **Getter/Setter auf Flow-Elementen**:
    - Achtung bei `FlowElement.ts`: `name` (kleingeschrieben) ist ein read-only Getter (ID).
    - `Name` (Großgeschrieben) ist der Setter für den Anzeigenamen. Im Inspector-Handler muss zwingend `object.Name = newValue` verwendet werden, um TypeErrors zu vermeiden.

## [v2.16.17] - 2026-02-12
### Fixed
- Systemweite Vereinheitlichung der Event-Task-Zuordnung von `Tasks` auf `events`.
- Behebung von Ladefehlern bei Stage-Events (onEnter, onLeave).
- Korrektur der Speicherlogik im JSON-Inspektor für Event-Mappings (Schreiben in `events` statt `Tasks`).
- Migration der Event-Anzeige im Inspector auf das `events`-Property.
- Wiederherstellung fehlender Event-Mappings (PinPicker, LoginButton) und Tasks (AttemptLogin) in `project.json`.
- Fallback-Support für Altdaten im `Tasks`-Feld in der Serialisierungs- und Auflösungslogik.
- **Task Resolution Fix**: Implementierung einer robusten Auflösungslogik für punkt-separierte Task-Namen (z.B. `PinPicker.onSelect`).
    - Unterstützung für Direct Resolution via `contextObj`.
    - Vollständiger Fallback-Scan über alle Stages, Variablen und Legacy-Objekte.
    - Optimiertes Warning-Handling: Unterdrückung von Warnungen für optionale Lifecycle-Events (`onStart`, `onLoad`, etc.).

## v2.16.16 (2026-02-12)
- **Calculate Action Fix**: Wiederherstellung und Erweiterung des `calculate` Typs.
- **Formula Generation**: Der `ActionEditor` generiert nun automatisch eine JavaScript-konforme `formula` aus den visuellen Schritten.
- **String/Emoji Support**: Operanden in Berechnungen unterstützen nun Text und Emojis (automatische Anführung in der Formel).
- **Visibility Fix**: Der Typ 'calculate' ist nun zuverlässig in allen Action-Dropdowns (Inspector & Dialoge) sichtbar. Korrektur der hartcodierten Mapping-Logik in `JSONDialogRenderer.ts` und Ergänzung in `dialog_action_editor.json`.
- **Method Mapping**: Beim Hinzufügen neuer Komponenten-Klassen muss deren Methoden-Liste in `JSONDialogRenderer.getMethodsForObject` ergänzt werden, damit sie im Action Editor auftaucht.
- **Pascal Sync**: Der Pascal-Generator und -Parser wurden erweitert, um komplexe Berechnungen (`Var := A + B`) zu unterstützen und Bidirektionalität zu gewährleisten.
- **Typen-Update**: `GameAction` unterstützt nun das Feld `formula` für die Runtime-Ausführung.

## v2.16.15 (2026-02-12)
- **Task-Sync Fix**: Korrektur der Task-Synchronisation nach Umbenennung im Inspector.
- **Refactoring Fix**: Statischer Import des `RefactoringManager` in `FlowElement.ts` für zuverlässigere projektweite Umbenennungen.
- **Hygiene**: Automatische Bereinigung von Task-Duplikaten (Root vs. Stage) in `RefactoringManager.sanitizeProject`.
- **UI**: Verbessertes Filtering im Flow-Editor Dropdown zur Vermeidung von redundanten Einträgen.

## v2.16.14 (2026-02-12)

## v2.16.13 (2026-02-12)
- **Bereinigung (project.json)**: Vollständiger Neustart – alle Tasks, Actions und FlowCharts entfernt. JSON-Schlüssel korrigiert (`events`-Arrays → korrekt `tasks`).
- **Variablen-Hosting**: Globale Variablen werden jetzt ausschließlich in `stage_blueprint` gehostet (keine Duplikate mehr in `project.variables`).
- **Objekte-Hosting**: Globale Objekte werden jetzt ausschließlich in `stage_blueprint` gehostet (`project.objects` geleert). Doppelter Toaster entfernt.
- **Code**: `ProjectRegistry.getVariables()` lädt globale Variablen nun aus der Blueprint-Stage (primäre Quelle) und dedupliziert korrekt bei aktiver Blueprint-Ansicht.

## v2.16.12 (2026-02-12)
- **Fix (Flow-Editor)**: Löschen von Aktionen im Flow-Diagramm entfernt nun auch verwaiste Aktions-Definitionen aus dem Projekt-JSON (Smart Delete).
    - Generische Aktionen (z.B. `Action1`, `Aufruf`) werden automatisch bereinigt.
    - Bei benannten Aktionen erfolgt eine Sicherheitsabfrage.
- **Fix (Projekt-Daten)**: Bereinigung duplizierter globaler Variablen in `stage_login`, die fälschlicherweise als lokale Kopien gespeichert wurden.
- **Refactoring (ProjectRegistry)**: `getActionUsage` berücksichtigt nun auch visuelle Referenzen in FlowCharts, um versehentliches Löschen verwendeter Aktionen zu verhindern.
- **Fix (Blueprint)**: Wiederherstellung der visuellen Variablen in `stage_blueprint` und Implementierung einer Deduplizierungslogik in `ProjectRegistry` (Stage > Global).
- **Refactoring (JSON)**: Umbenennung des Legacy-Keys `Tasks` (Events) zu `events` in `project.json`, `GameRuntime.ts` und Templates, um Namenskonflikte mit dem `tasks`-Array (Logik) zu beheben.

## v2.16.12 (2026-02-15)
- **Fix (Sichtbarkeit)**: Blueprint-Services (Toaster, DataStore etc.) werden nun auch dann im Editor ausgeblendet, wenn sie als Duplikate in Stages existieren (via `isBlueprintOnly` & `isService` Flags).
- **Bereinigung (project.json)**: Korrektur der Scopes für globale Services (Toaster, LocalStore, API Server, UserData) in der `stage_blueprint` auf `global`.
- **Refactoring (Editor)**: Synchronisation der Vererbungs-Baseline zwischen Editor und Runtime. Globale Blueprint-Objekte werden nun konsistent beim Projektstart geladen.
- **Fix (Inspector)**: Vollständige Variablenliste im Flow-Editor wiederhergestellt. Der Inspector erkennt nun zuverlässig globale, stagelokale und task-lokale Variablen (Parameter).
- **Refactoring (FlowEditor)**: Automatische Synchronisation der `activeStageId` in der `ProjectRegistry` beim Wechsel des Flow-Kontextes.
- **Service (ProjectRegistry)**: Neue Methode `getTaskContainer` ermöglicht die Lokalisierung von Tasks über Stage-Grenzen hinweg.

## v2.16.11
- Verbesserung (Debug-Log): Tooltips für lange Zeilen hinzugefügt und manuelle Text-Kürzungen entfernt.

## v2.16.10 (2026-02-15)
- **Architektur-Refactoring (DataActions)**: Automatische Ressourcen-Simulation ("Auto-Magic") im `ApiSimulator` für `/api/data/*` Anfragen. Ermöglicht Datenabfragen ohne manuelle Simulationstasks.
- **Fix (Aktion)**: `http` Aktion unterstützt nun native Ressourcen-Eigenschaften (`resource`, `queryProperty`, `queryValue`).
- **Fix (Aktions-Editor)**: Robusterer String-Vergleich im `TDropdown` Renderer stellt sicher, dass geladene Quell-Objekte (Source) korrekt vorselektiert werden.
- **Clean-up**: Entfernung redundanter Daten-Handler-Tasks zugunsten der automatischen Simulation.

## v2.16.9
- Fix (Aktions-Editor): Korrekte Anzeige des Aktionstyps beim Öffnen des Dialogs (Fix der `TDropdown` `selectedIndex` Evaluierung).

## v2.16.8
 (2026-02-12)
- **Fix (Aktions-Editor)**: Fehlerbehebung bei der Typ-Synchronisation. Der Aktionstyp wird nun korrekt beim Wechsel im Dropdown aktualisiert.
- **Fix (Aktions-Editor)**: Automatische Aktualisierung des `details`-Feldes beim Speichern, für eine konsistente Anzeige im Flow-Editor.
- **Fix (Aktions-Editor)**: Korrekte Verarbeitung des `sync`-Flags in der Projekt-JSON.

## v2.16.7 (2026-02-12)
- **Refactoring**: Syntax-Bereinigung und Wiederherstellung von Member-Methoden im `JSONDialogRenderer.ts`.

## v2.16.5 (2026-02-12)
- Fix: Blueprint-Objekte (Toaster, LocalStore) werden nun korrekt vererbt und auf normalen Stages ausgeblendet.
- Fix: Wiederherstellung der HTTP-Abfrage-Funktionalität durch Korrektur der `UserData`-Referenzen.
- Refactor: Methodenerkennung in `ServiceRegistry` für plain Objekte verbessert.
- **Fix (Editor)**: Variablen werden nun korrekt auf allen Stages angezeigt. Der `isBlueprint`-Status der Stage wird jetzt beim Wechsel (switchStage) synchronisiert.
- **Fix (Komponente)**: `TVariable` ist nicht mehr auf Blueprints beschränkt (`isBlueprintOnly = false`), um die Sichtbarkeit im Editor zu gewährleisten.
- **Fix (Aktions-Editor)**: Auswahl des Aktions-Typs in `dialog_action_editor.json` auf Objekt-Basis umgestellt (value/label), um fragile String-Vergleiche mit Emojis zu vermeiden.
- **Fix (Runtime)**: `set_variable` als Alias für `variable` in `StandardActions.ts` registriert, um UI-Konsistenz bei gleichbleibender Funktionalität zu erhalten.

## v2.16.4 (2026-02-12)
- **Fix (Read Variable)**: Die Aktion "Read Variable" (intern `variable`) unterstützt nun auch Variablen als Quelle. 
- **Fix (Editor)**: Variablen-Listen im Flow-Editor (JSONDialogRenderer) sind nun kontextsensitiv und zeigen auch lokale Task-Variablen an.
- **Fix (Aktions-Editor)**: Das Eingabefeld für die Ziel-Variable in `dialog_action_editor.json` wurde repariert (fehlende `className`) und durch ein Auswahl-Dropdown ergänzt.
- **Logik**: Der `variable`-Handler löst Quellen nun robuster auf (Objekt -> Variable -> Interpolation) und bietet detailliertes Logging im Debug-Log.

## v2.16.3 (2026-02-12)
- **Fix (Variable Events)**: Automatische Triggerung von Variablen-Events unterbunden. Events wie `onValueChanged` lösen nur noch aus, wenn sie im Flow-Editor explizit verknüpft wurden.
- **Fix (StandardActions)**: Doppelte Zuweisung in der `calculate`-Aktion entfernt, um redundante Proxy-Trigger zu vermeiden.
- **Runtime**: `onValueChanged`-Ketten werden nun asynchron (`await`) ausgeführt, um Race-Conditions zu verhindern.
- **Debug Log**: Einführung eines Kontext-Stacks, damit Variablenänderungen im Protokoll nun korrekt unter der auslösenden Aktion verschachtelt werden (behebt unsaubere Reihenfolge).
- **Dokumentation**: `DEVELOPER_GUIDELINES.md` bezüglich der neuen Event-Trigger-Logik aktualisiert.

## v2.16.1 (2026-02-11)
- Bugfix: "Ghost-Einträge" (alte Namen) im Task-Dropdown nach Umbenennung behoben (RefactoringManager fix).
- Bugfix: Kontexterhalt im Flow Editor nach Umbenennung (localStorage Sync in JSONInspector).
- Mediator-Integration im Flow Editor zur reaktiven UI-Aktualisierung hinzugefügt.
- Trinity-Sync in Editor.ts optimiert (refreshAllViews bei Inspector-updates).

## [v2.16.0] - 2026-02-11
### Entfernt
- Alle Tasks, Actions und FlowCharts der Login-Stage auf Benutzerwunsch gelöscht.
- Task-Referenzen in Login-UI-Objekten (LoginButton, PinPicker) entfernt.

## [v2.15.0] - 2026-02-11
### Hinzugefügt
- **Modularer Login-Workflow (Refined)**:
    - Explizite Definition der Variablen `loginResult` (Ergebnis-Speicher) und `currentPIN` (Eingabequelle).
    - Einführung von `loginError` zur sauberen Fehlerbehandlung ("Schlechtfall").
    - Benennung der Verbindungen im Flow-Editor ("GUT-FALL" / "SCHLECHT-FALL").
    - Reduzierung der `SubmitLogin` Action auf den reinen API-Call zur Vermeidung von Redundanz.
- **Rollen-basiertes Routing & Multi-Role Support**:
    - Neue Stage `stage_role_select` für Benutzer mit mehreren Rollen.
    - Dynamische Befüllung der Rollenliste (`PopulateRoles`) basierend auf den Server-Daten.
    - Automatisches Dispatching (`AutoDispatch`) für Single-Role Benutzer zu ihren Dashboards (SuperAdmin, Admin, Player).
- **Session-Management im Flow**:
    - Task `ProcessSession` zur zentralen Speicherung von `authToken`, `currentUser` und Login-Status.
- **Visualisierung im Flow-Editor**:
    - Task-Knoten-Referenzen innerhalb von Diagrammen zur Verknüpfung modularer Workflows (z.B. `LoginFlow` -> `ProcessSession`).

### Behoben
- **JSON-Integrität**:
    - Fix von Syntaxfehlern (Klammersetzung) am Ende der `project.json`.
    - Entfernung von Dubletten und Konsolidierung der `flowCharts` Speicherstruktur.

## [v2.14.0] - 2026-02-09
### Hinzugefügt
- **DataAction Visualisierung & Konfiguration**:
    - Neue spezialisierte Inspector-Sicht (`inspector_data_action.json`) für `DataAction` Knoten.
    - Unterstützung für Route, Methode (GET/POST/etc.), Body (JSON) und Ziel-Variable.
    - **Variable Dropdown**: Scope-bewusste Anzeige von Variablen mit Emojis (🌎, 🎭, 📚) zur besseren Unterscheidung.
    - **URL Suggestions**: Integrierte Datalist für Server-Routen (Suggestions) in der `DataAction`.
- **FlowAction Refactoring**:
    - Umstellung der Inspector-Proxies auf `getActionDefinition()`, um Datenverlust bei verknüpften Aktionen zu verhindern.

### Behoben
- **JSONInspector Stabilität**:
    - [x] Behebung einer kritischen Fehlstruktur in der `update()` Methode, die zu zahlreichen Abstürzen führte.
    - [x] Korrektur der Fallback-Logik: Spezialisierte Templates (DataAction, Task) werden nicht mehr durch die generische `inspector.json` überschrieben.
    - [x] Unterbindung von Eigenschafts-Duplizierung im Inspector, wenn spezialisierte Templates verwendet werden.
    - [x] Fix: Variablen-Dropdown in der `DataAction` repariert (Type-Preservation in `ExpressionParser` verhindert Stringifizierung von Arrays).
    - [x] Layout-Korrektur im Inspector: Fix für Flex-Overflow und fehlerhafte Zeilen-Gruppierung von Info-Labels.
    - [x] **Inspector-Synchronisation**: Behebung des Problems, dass Suchfelder nach Ressourcen-Wahl nicht erschienen (Triggered Re-render + Naming Standardisierung).
- **Dynamisches Ressourcen-Management (Phase 2)**:
    - No-Code Suche: Automatisches Abfragen von Objekt-Eigenschaften via Server-Endpoint.
    - Intelligente UI: Dynamische Dropdowns und automatische URL-Generierung basierend auf der Feld-Auswahl.
- **Stage Management**:
    - Automatische Synchronisation der `activeStageId` im `ProjectRegistry` beim Stage-Wechsel im Editor, was die korrekte Variablen-Auflösung ermöglicht.
- **TDropdown**:
    - Korrekte Unterstützung von Placeholdern und leeren Werten ("-- Keine --").
- **UI Refinement**:
    - **DataAction Inspector**: Vereinheitlichung der UI. `queryValue` ist nun ein Dropdown mit Variablen-Support.
    - Überflüssiger Token-Button `{..}` aus dem `urlInput` entfernt.

## [2.12.0] - 2026-02-08
### Behoben
- **AppendEmoji Action ("calculate")**: Behebung des Fehlers, bei dem Variablen-Komponenten als Objekte (`[object Object]`) statt als Werte in Berechnungen verwendet wurden.

### [v2.13.0] - 2026-02-08
- **Feat**: Admin Dashboard Erweiterung (Raum-Management).
  - Implementierung einer dynamischen Raum-Liste mit Filterung nach Admin-Zuständigkeit (`managedRooms`).
  - Neue UI-Elemente: `TList` für Räume, `TButton` zum Erstellen, `TPanel` für Details.
  - Automatisierte Kontext-Auflösung via `/api/platform/context/:userId` beim Dashboard-Start.
  - Server-Anbindung für Raum-Erstellung (`POST /api/platform/rooms`) inklusive automatischer Hierarchie-Aktualisierung.
- **Tools**: Einführung von Node.js Patch-Skripten (`patch_project.cjs`) zur sicheren Manipulation sehr großer Projekt-JSON-Dateien ohne Match-Fehler.

### [v2.12.1] - 2026-02-08
- **Fix**: Reaktivitäts-Fehler bei shadowing Variablen (Global vs. Stage) behoben.
- **Fix**: `ReactiveRuntime.getContext()` bevorzugt nun explizite Variablen-Werte vor Objekt-Proxies gleichen Namens.
- **Fix**: `RuntimeVariableManager` nutzt nun die Komponenten-ID für präzise Wert-Synchronisation (löst Konflikte bei Shadowing).
- **Logging**: Detaillierte Warnungen für fehlgeschlagene Bindings mit Kontext-Analyse hinzugefügt.

- **Variablen-Konsolidierung & Reaktivität**: Systemweite Vereinheitlichung der Variablen-Auflösung ("Typ-Gewissheit").
  - **ExpressionParser Optimierung**: Alle Kontext-Variablen werden nun vor der Evaluierung in `new Function()` automatisch via `resolveValue()` aufgelöst. Dies verhindert `[object Proxy]` oder `[object Object]` Fehler in JS-Formeln.
  - **GameRuntime Fix**: Korrektur der `handleStageChange` Sequenz. Der `ActionExecutor` wird nun erst aktualisiert, nachdem alle Stage-Objekte in reaktive Proxies umgewandelt wurden.
  - **Reaktivitäts-Synchronität**: Behebung einer Race-Condition im `RuntimeVariableManager`, durch die Bindings benachrichtigt wurden, bevor die visuelle Komponente ihren neuen Wert erhalten hatte.
  - **Basis-Support**: Einführung von `valueOf()` und `toString()` in der Basisklasse `TComponent`, um Variablen direkt in JS-Ausdrücken nutzbar zu machen.
  - **Zentrale Auflösung**: Implementierung der `resolveValue()` Logik in `PropertyHelper`, die den Inhalt von Variablen (`.value` oder `.items`) extrahiert.

## [2.11.0] - 2026-02-07
### Hinzugefügt
- **Metadaten-gesteuerte Sichtbarkeit**: Einführung eines generischen Systems zur Steuerung der Sichtbarkeit von Komponenten.
  - Neue Flags in `TComponent`: `isService`, `isHiddenInRun`, `isBlueprintOnly`.
  - Automatische Persistenz dieser Flags in der `project.json` via `toJSON`.
- **System-Komponenten Optimierung**: Über 15 System-Komponenten (API-Server, Datenbank, GameLoop etc.) wurden auf das neue Sichtbarkeits-System umgestellt.
- **Daten-Synchronisierung**: Automatisches Spiegeln von Server-Daten (z.B. `users.json`) in den Simulator des Editors via `DataService.seedFromUrl`.
- **API-Simulator**: Neue Dev-Route im Game-Server (`/api/dev/data/:file`) zur Bereitstellung von Mock-Daten.
- **Debug-Logging**: Erweitertes Logging für Datenbank-Aktionen (`db_find`, `db_save`) und HTTP-Anfragen.

### Geändert
- **Zentralisierte Filter-Logik**: 
  - `Stage.renderObjects` nutzt nun die neuen Metadaten-Flags statt hartkodierter Listen.
  - System-Komponenten werden im Run-Modus sowie auf nicht-Blueprint-Stages im Editor automatisch ausgeblendet.
  - `ProjectRegistry.getObjects` erkennt Services nun dynamisch anhand der Metadaten.
- **Editor-Integration**: Der `Editor` übergibt nun den aktuellen Stage-Typ ('blueprint') an die Renderschicht.

### Behoben
- **Variablen-Sichtbarkeit**: Behebung eines Fehlers, bei dem Variablen im Run-Modus weiterhin als Boxen sichtbar waren. 
  - `TVariable` setzt nun standardmäßig `isHiddenInRun = true` und `isBlueprintOnly = true`.
  - `Stage.ts` filtert Variablen im Run-Modus nun implizit aus, auch wenn die Metadaten-Flags im JSON fehlen.
- **Build-Stabilität**: Behebung von Lint-Fehlern (ungenutzte Parameter) in `Editor.ts`.
- **System-Dienste**: Korrektur von `TStatusBar` und `TToast`, um diese im Run-Modus ebenfalls standardmäßig auszublenden.

## [2.10.3] - 2026-02-07
### Hinzugefügt
- **Automatische Blueprint-Vererbung**: Der `RuntimeStageManager` mergt nun automatisch alle Stages vom Typ `blueprint` in die aktuelle Stage. Dies ermöglicht eine systemweite Verfügbarkeit von globalen Diensten (API-Server, Datenbanken) und deren Logik (Tasks/Actions).

### Behoben
- **API-Simulation**: Behebung des "Stummen Login"-Fehlers durch Beseitigung einer Blueprint-Dublette im `project.json` und Aktivierung der Datenbank-gestützten PIN-Prüfung.
- **Variablen-Interpolation**: Systemweite Korrektur der String-Interpolation (`${...}`).
  - `PropertyHelper.interpolate` erkennt nun automatisch Variablen-Komponenten (TStringVariable etc.) und dereferenziert deren `.value`.
  - Auflösung von Objekten ohne Punkt-Notation (z.B. `${currentPIN}`) gefixt.
  - Zusammenführung von lokalem und globalem Kontext in allen Standard-Aktionen (`StandardActions.ts`).
  - Behebung von Namenskonflikten zwischen lokalen Stage-Variablen und globalen Projekt-Variablen.
  - **Dot-Notation Support**: 
    - `PropertyHelper` unterstützt nun verschachtelte Variablenpfade wie `${$params.pin}` in lokalen Scopes.
    - `TaskExecutor` löst Parameter nun rekursiv und korrekt auf, was den Login-Flow repariert hat.
- **Daten-Integrität**:
  - Hotfix in `RefactoringManager`, um korrupte `UserData` Namen (`🗄️ Benutzer-DB`) beim Laden automatisch zu korrigieren.
- **Routing & Navigation**:
  - **Feat**: Rollen-basiertes Routing in `SubmitLogin` implementiert (Superadmin -> Super Dashboard, etc.).
  - **Fix**: `StandardActions.ts` (`respond_http`) korrigiert, um Objekte bei Interpolation nicht in Strings umzuwandeln (ermöglicht Zugriff auf `user.role`).
  - **Fix**: `EditorRunManager.ts` aktualisiert, damit `navigate_stage` im Run-Modus auch tatsächlich die Stage wechselt.

## [2.10.1] - 2026-02-07
### Behoben
- **Flow-Editor Ausrichtung**: Fix des 80px Offsets bei Knoten-Koordinaten (X-Achse). Knoten und Verbindungen liegen nun wieder korrekt auf der Grid-Ebene.
- **Flow-Diagramm Persistenz**: Korrektur der `syncToProject` Logik in `FlowSyncManager.ts`. Diagramm-Daten werden nun korrekt pro Task gespeichert (statt sich gegenseitig zu überschreiben).
- **Daten-Integrität**: Implementierung eines `isLoading` Flags in `FlowEditor.ts`, um korrupte Synchronisation während des Ladevorgangs zu verhindern.
- **Render-Stabilität**: `ProjectRegistry.ts` prüft nun mit `Array.isArray` auf valide Action-Sequenzen. Dies verhindert TypeErrors bei beschädigten oder leeren Projektdaten.

## [2.10.0] - 2026-02-07
### Hinzugefügt
- **Flow-Diagramm Refactoring**: Task-Objekte dienen nun als visuelle Wurzel-Knoten in Task-Diagrammen (Ersatz der generischen Start-Knoten).
- **Obligatorische Task-Action Verbindung**: Task-Knoten sind nun zwingend mit der nachfolgenden Aktionskette verbunden.

### Geändert
- **Strikte Flow-Isolation**: Der Flow-Editor filtert nun strikt zwischen globalen und lokalen Elementen.
  - Standard-Stages zeigen nur noch ihre eigenen (lokalen) Tasks und Actions.
  - Globale "Infrastruktur"-Tasks und Actions werden ausschließlich auf der Blueprint-Stage visualisiert.
  - Dies beseitigt redundante "Müll"-Einträge in funktionalen Stages.
- **FlowMapManager & FlowSyncManager**: Logik zur Übersichtsberechnung und Flow-Generierung für das neue Scoping angepasst.

## [2.9.0] - 2026-02-07
### Hinzugefügt
- Spezialisierte GCS-Variablentypen: `TStringVariable`, `TIntegerVariable`, `TBooleanVariable`, `TRealVariable`, `TObjectVariable`.
- Automatische Icons (Emojis) für verschiedene Variablentypen (`📝`, `🔢`, `⚖️`, `📏`, `📦`).
- Blueprint-Stage Typ (`stage_blueprint`) für systemweite Service-Visualisierung.

### Geändert
- Variablen-Scoping: Globale Variablen und Service-Objekte werden im Editor visuell nur noch auf Stages vom Typ `blueprint` gerendert.
- `EditorStageManager` refaktoriert: Nutzt nun `ProjectRegistry.getObjects()` als Single Source of Truth für die Objekt-Auflösung.
- `ProjectRegistry.getObjects()` angepasst, um das neue Blueprint-Scoping zu unterstützen.
- `project.json` aktualisiert: Alle Variablen auf spezialisierte Typen umgestellt.

## [2.8.0] - 2026-02-07
### Hinzugefügt
- **Variablen-Design Verfeinerung**: Globales Redesign aller Projekt-Variablen.
- Standard-Dimensionen für Variablen auf 6x2 (Grid-Einheiten) gesetzt.
- Vertikale Anordnung der Variablen (global und lokal) implementiert.
- Schriftfarbe für Variablen auf Schwarz (`#000000`) gesetzt.
- Hintergrundfarbe für Variablen auf helles Lila (`#d1c4e9`) angepasst für optimalen Kontrast.
- `TVariable` Komponenten-Klasse mit neuen Standardwerten aktualisiert.

## [2.7.0] - 2026-02-06
### Hinzugefügt
- **Variablen-Sichtbarkeit & Rendering**: 
    - Variablen in der `variables`-Sektion besitzen nun visuelle Eigenschaften (`x`, `y`, `width`, `height`, `isVariable: true`, `className: "TVariable"`).
    - Diese Variablen werden nun automatisch auf den Stages gerendert, ohne dass sie redundant im `objects`-Array vorhanden sein müssen.
    - Unterstützung für globale Projekt-Variablen: Diese werden auf ALLEN Stages gerendert und sind zentral verschiebbar.
- **System-Synchronisation**: 
    - `Editor`, `EditorStageManager` und `ProjectRegistry` wurden synchronisiert, um Variablen als vollwertige, renderbare Objekte zu behandeln.
    - Fix für die Persistenz: `Editor.ts` nutzt nun Objektreferenzen statt Klone für aktive Stage-Elemente, wodurch Positionsänderungen im Editor korrekt gespeichert werden.
- **Daten-Bereinigung**: 
    - Redundante `TVariable`-Einträge aus den `objects`-Arrays in `project.json` wurden entfernt.
    - Alle 8 CRM-Stages wurden auf dieses neue, saubere Format migriert.

## [Unreleased] - 2026-02-05
### Hinzugefügt
- **FlowCondition**: Neuer diamantförmiger Knoten für visuelle If/Else-Logik im Flow-Editor.
- **Canvas-Kontextmenü**: Rechtsklick auf den Flow-Canvas ermöglicht nun das direkte Erstellen von Aktionen, Bedingungen und Tasks.
- **Visual Branching**: Unterstützung für spezialisierte 'true' und 'false' Output-Anchors für verzweigte Logik.
- **Konzept: Server-Architektur**: Vorbereitung der Infrastruktur für Fly.io Deployment und Service-Blueprints.

### Behoben
- **FlowEditor**: 
    - Der Flow-Generator erkennt nun alle Aktionstypen (`http`, `db_*`, `timeout`, `custom`).
    - Korrupte Task-Einträge (`elements`, `connections`) werden automatisch beim Laden bereinigt.
    - Node-Labels folgen nun dem Format `Taskname ---- Actionname` für besseren Kontext.
- **JSON-Ansicht**: 
    - Scope-Toggle (Stage vs. Projekt) in der Toolbar implementiert, um Datenverlust beim Speichern zu vermeiden.
- **EditorViewManager**: Fehlende UI-Referenz (`this.editor`) im View-Filter korrigiert.

## [2.6.0] - 2026-02-06
### Hinzugefügt
- **Phase 3: Headless Runtime & Export**: 
    - **HeadlessRuntime**: Node.js-kompatible Engine-Laufzeit ohne DOM-Abhängigkeiten.
    - **HeadlessServer**: Express-Integration zum Mapping von HTTP-Requests auf GCS-Flows.
    - **Cloud-Export**: Automatisierte Generierung von ZIP-Bundles inklusive Dockerfile und `fly.toml` für Fly.io.
    - **Action `respond_http`**: Neue Flow-Action zum Senden von Server-Antworten.
- **Phase 4: API-Tester**: Integrierter Simulator im Inspector für den `TAPIServer`.
- **Phase 5: Datenbank-Integration**: Neue Komponente `TDataStore` und Actions (`db_save`, `db_find`, `db_delete`) für persistente Datenspeicherung (JSON/localStorage).
- **Konzept: Server-Architektur ("Service Blueprint")**: Umfassende Neuausrichtung für Stage-lose Applikationen.
    - **Blueprint-Stage**: Verwendung der Stage als System-Topologie zur Visualisierung von Services und Variablen.
    - **Live-Simulation**: Nutzung der `GameRuntime` als Server-Sandbox mit Echtzeit-Debugging im Editor.
    - **Fly.io Integration**: Docker-Ready Export und Deployment-Optimierung für Cloud-Hosting.
### [Phase 2] - CRM Frontend & Login-Flow
- **Modernisierung stage_login**: Austausch der Drag-and-Drop Slots durch die neue `TEmojiPicker`-Komponente.
- **PIN-Logik**: Implementierung des `HandleEmojiPin`-Tasks für die sequentielle PIN-Eingabe.
- **Asynchrone Authentifizierung**: Integration der `http` Action für API-Abgleiche und `store_token` für das Session-Handling.
- **Dashboard Basis**: Erstellung der `stage_main` als Navigationsziel nach erfolgreichem Login.
- **Feedback-System**: Integration der `TToast`-Komponente für Nutzer-Benachrichtigungen.
- **Implementierung Phase 1 (Basiskomponenten)**:
    - **Spezial-Actions**: `http`, `store_token` und `show_toast` vollständig in der `ActionRegistry` und im Laufzeitsystem integriert.
    - **TAPIServer**: Neue visuelle System-Komponente zur Darstellung von Backend-Diensten und API-Endpunkten.
    - **TEmojiPicker**: Interaktive UI-Komponente zur Emoji-Auswahl, bereit für das Login-Flow-System.
- **Inspector-Erweiterung**: Unterstützung für den Eigenschaftstyp `json` hinzugefügt, inklusive automatischer Rendering-Logik im `JSONInspector`.
- **Typ-Sicherheit**: Erweiterung von `TPropertyDef` um den Typ `'json'`, um komplexe Datenstrukturen wie Emoji-Listen nativ zu unterstützen.
    - **Action-Parameter**: Unterstützung für vordefinierte `options` (Dropdowns) in den Aktions-Parametern.
    - **Design-System**: Einführung von `borderRadius` als Kern-Eigenschaft für alle visuellen Komponenten.
    - **Infrastruktur**: Registrierung von `TAPIServer` und `TToast` in der zentralen `ComponentRegistry`.

## [2026-02-01] - FlowEditor Modularisierung (Phase 2)
- **FlowContextMenuProvider**: Extraktion der gesamten Kontextmenü-Logik für Knoten, Verbindungen und Canvas in einen dedizierten Service.
- **Library-Task Integration**: Vollständige Portierung der komplexen "Library-Task als Vorlage"-Logik inklusive Flowchart-Cloning und Namens-Prompt in den Provider.
- **Code-Qualität**: Reduzierung der Monolithen-Größe von `FlowEditor.ts` und Bereinigung von Schnittstellen-Inkonsistenzen in `FlowSyncHost`.

## [2026-02-01] - Robuster Action-Check & Deep-Scan
- **Strategiewechsel Action-Check**: Radikale Vereinfachung durch Umstellung von Mark-and-Sweep auf statischen Deep-Scan des gesamten Projekt-JSONs.
- **Fehlerbehebung Toggle-Bug**: Robuste objektbasierte Erkennung von Definitionen verhindert Fehlmarkierungen bei wiederholtem Check.
- **Verbesserte Task-Hints**: Detaillierte Tooltips im Flow-Editor zeigen nun Trigger-Events und Aufruferketten mit Emojis (⚡, ➡️, 🎬, 📦).
- **Bereinigung**: Redundante und fehleranfällige Pfadanalyse-Methoden in `ProjectRegistry` entfernt.

## [2.5.1] - 2026-02-01
### Hinzugefügt
- **Projektweiter Action-Check (Mark-and-Sweep)**: Grundlegende Neuentwicklung der verwaisten Element-Erkennung.
    - **Statischer Deep-Scan (v2.5.2)**: Radikale Vereinfachung der `getLogicalUsage` Methode in `ProjectRegistry.ts`. Statt Mark-and-Sweep wird nun das gesamte Projekt-JSON nach Namensreferenzen gescannt. Dies ist robuster gegenüber komplexen Aufrufpfaden.
    - **Live-Check**: Der Action-Check im Flow-Editor arbeitet nun mit Live-Daten statt mit statischen Flags, was Stale-Data Fehler eliminiert.
    - **Vollständigkeit**: Einbeziehung von Tasks, Actions UND Variablen in die Analyse. Korrektur der Erkennung von direkten Action-Aufrufen in Events und erweitertes Variablen-Scanning (CalcSteps, Property-Names).
    - **Visualisierung**: Verwaiste Elemente werden im Flow-Editor rot pulsierend markiert, wobei die logische Erreichbarkeit Vorrang vor der visuellen Präsenz hat.

## [2.5.0] - 2026-02-01
### Geändert
- **FlowEditor Modularisierung (Phase 1 & 2)**: Massive Bereinigung und Strukturierung der `FlowEditor.ts`.
    - **Modularisierung**: Extraktion der Synchronisations-Logik von Visual Flow zu JSON/Pascal in den neuen `FlowSyncManager.ts`.
    - **Bereinigung**: Entfernung veralteter Overview-Methoden (`generateEventMap`, `generateElementOverview`, `toggleActionCheckMode`).
    - **UI-Cleanup**: Entfernung redundanter Buttons (Action-Check) und Filter-Eingaben aus der Header-Leiste des Flow-Editors.
    - **Code-Qualität**: Beseitigung von redundanten Props, toten Imports und ungenutzten Hilfsmethoden; Reduzierung der Dateigröße um ca. 600 Zeilen.
- **FlowEditor Interaktion & Bugfixes**:
    - **NaN Safety & cellSize Fix**: Behebung eines kritischen Fehlers, bei dem fehlende `cellSize`-Informationen beim Laden zu `NaN`-Koordinaten führten. Automatische Reparatur betroffener Knoten implementiert.
    - **Filter-Priorität**: Korrektur der Filter-Logik in der Elementübersicht; Filter werden nun vor den lokalen/globalen Ausnahmeregeln geprüft.
    - **Inspector Log Fix**: Eliminierung von `ComponentRegistry`-Warnungen durch Einführung von `getEvents()` für Flow-Knoten und Optimierung der Typerkennung im `JSONInspector`.
    - **Events**: Definition in `getEvents()`, Ausführung via `triggerEvent()`.
- **Daten-Typisierung**:
    - Variablen vom Typ `object` oder `object_list` sollten ein `objectModel` (z.B. 'users') zugewiesen bekommen.
    - Bei API-Anfragen (`DataAction`) sollte der `resultPath` genutzt werden, um flache Zugriffspfade (`currentUser.name`) zu ermöglichen.
    - Dynamische Dropdowns im Inspector werden über `source: 'availableModels'` in der `TPropertyDef` realisiert.
    - **Inspector Delete Routing**: Korrektur der Lösch-Funktion im Inspector; Löschbefehle für Flow-Elemente werden nun korrekt an den `FlowEditor` weitergeleitet (inkl. Referenzprüfung).
    - **Scroll-Offset Korrektur**: Behebung von 'dangling' Connections und fehlerhaften Snap-Punkten durch Einbeziehung des Canvas-Scroll-Offsets.
    - **Robustes Dragging**: Bereinigung der Drag-Logik in `FlowEditor.ts`; Nutzung von `node.onMove` zur Synchronisierung von Verbindungen während der Bewegung.
- **Wiederherstellung von Overviews**:
    - **Modularisierte Restauration**: "Landkarte" und "Elementenübersicht" wurden in `FlowMapManager.ts` wiederhergestellt und modularisiert.
    - **Action-Check**: Die visuelle Überprüfung auf ungenutzte Elemente (Actions/Tasks) ist wieder verfügbar.
    - **Action Visualization:** Fixed synchronization issue where deleting global actions in the Flow Editor did not correctly update project data.
- **Refactoring:** Converted `SubmitLogin` to a `DataAction` structure with `successBody` and `errorBody` for better flow visualization.
- **New Action:** Added `execute_login_request` as a primitive action for Login DataAction.-Steuerung.
    - **Integration**: Nahtlose Einbindung der neuen Manager in die `FlowEditor` Toolbar und Kontext-Steuerung.


## [2.4.2] - 2026-02-01
### Behoben
- **Pascal Synchronisation**: Automatisches Update des Flow-Editors bei Code-Änderungen im Pascal-Editor.
    - Integration von `flowEditor.syncActionsFromProject()` in den `oninput`-Handler des Pascal-Editors.
    - Robustere Suche nach Aktionen über alle Stages hinweg in `FlowEditor.ts`.
- **Zirkuläre Referenzen**: Behebung fälschlicher Warnungen im JSON-Inspector.
    - **Fix (Circular References)**: Zirkularitäts-Warnungen im JSON-Inspector korrigiert (pfad-basierte Prüfung statt globaler WeakSet).
- **Fix (Event Logging)**: Variablen-Events (z.B. `onTriggerEnter`, `onTimerEnd`) werden nun korrekt im Debug-Log als Event-Einträge protokolliert.
- **Sync (FlowEditor)**: Deep Cloning bei der Synchronisation von Aktionen implementiert, um Shared References zu vermeiden.
- **Persistenz & Local Storage**: Beseitigung redundanter Einträge und Vereinheitlichung der Speicherung.
    - Umstellung aller Speicheroperationen auf den einheitlichen Key `gcs_last_project`.
    - Konsolidierung der Speicherlogik in `Editor.ts` durch Nutzung des `ProjectPersistenceService`.

## [2.4.1] - 2026-02-01
### Behoben
- **Debug-Log System**: Vollständige Wiederherstellung der Funktionalität und Sichtbarkeit.
    - **Logging-Anbindung**: Integration von `GameRuntime` (Events), `PropertyWatcher` (Variablen), `ActionExecutor` (Aktionen) und `TaskExecutor` (Tasks/Conditions) an den `DebugLogService`.
    - **Hierarchische Ansicht**: Korrekte Einrückung von Kind-Aktionen unter dem auslösenden Ereignis/Task.
    - **Filter-Logik**: Entschärfung der Typ-Filter (Unabhängigkeit der Checkboxen).
    - **Lifecycle-Fix**: Behebung eines Bugs im `EditorRunManager`, der das System beim Beenden des Run-Modus zerstörte.
    - **UI-Stabilität**: Einführung eines internen Sichtbarkeits-Flags und robusterer CSS-Steuerung.

## [2.4.0] - 2026-02-01
### Behoben
- **Stage-Editor UI**: Wiederherstellung der Toolbox und des Inspectors.
    - Korrektur der Container-IDs (`json-inspector-content`, `json-toolbox-content`) in `Editor.ts`.
    - Implementierung des fehlenden Ladevorgangs für `toolbox.json`.
    - Wiederherstellung des 'Debug Logs' Buttons durch Einführung eines `toolbox-footer` Containers und Fix der Initialisierung.
 in der modernisierten `Editor.ts`.
    - Erweiterung der Sichtbarkeitssteuerung im `EditorViewManager.ts` für die `stage`- und `flow`-Ansichten.
- **Build-Stabilität**: Erfolgreiche Verifizierung des gesamten Refactorings durch `npm run build`.
Status: [x] Abgeschlossen

## Checkliste
- [x] Ursachenanalyse (Fehlender Case im MenuManager)
- [x] Implementierung `newProject` in `Editor.ts`
- [x] Verknüpfung im `EditorMenuManager.ts`
- [x] Verifizierung

## [Refactoring] - 2026-01-31
- **Editor.ts**: Massive Modularisierung und Bereinigung. Die Datei fungiert nun als schlanker Orchestrator.
- **EditorCommandManager**: Neue Komponente für Objekt-Manipulation und Befehlsausführung (Undo/Redo Support).
- **EditorRunManager**: Neue Komponente für die Verwaltung der Game-Runtime und des Game-Loops.
- **EditorStageManager**: Neue Komponente für Stage-spezifische Operationen und Objekt-Synchronisation.
- **UI-Verbesserung**: `selectedEmoji` ist nun im Inspector der `TEmojiPicker`-Komponente sichtbar (schreibgeschützt).
- **Bugfix (Critical)**: `TEmojiPicker` synchronisiert nun `selectedEmoji` auch bei globalen Tasks korrekt mit der Runtime.
- **Runtime-Erweiterung**: `StandardActions` (calculate) hat nun Zugriff auf alle Komponenten (`objectMap`) und Event-Daten (`$eventData`).
- **Trinity-Sync v2.16.1**: Fix für Task-Umbenennungssynchronisierung und Kontexterhalt.
- **Trinity-Sync**: Konsolidierung der Synchronisation zwischen Stage-Editor, JSON-Code und Pascal-Sicht.
- **Build & Typ-Sicherheit**:
  - Sämtliche TypeScript-Fehler (8 Fehler in 6 Dateien) behoben.
  - `ServiceRegistry` wurde korrekt typisiert, um `any`-Inferenz zu vermeiden.
  - Fehlende `renderJSONTree`-Methode in `EditorViewManager` implementiert.
  - Syntaxfehler und verwaiste Imports in `ActionEditor.ts` und `MediatorService.ts` bereinigt.
  - Erfolgreiche Verifizierung durch `npm run build`.
- **Fehlerbehebung**: Beseitigung zahlreicher Code-Duplikate und Syntaxfehler, die durch fehlerhafte Merges entstanden waren.

## [2.3.0] - 2026-01-31
### Hinzugefügt
- **Management-Tab**: Einführung eines dedizierten Tabs zur zentralen Ressourcenverwaltung.
- **Interaktive Navigation**: Klick auf Tabellenzeilen fokussiert Objekte auf der Stage (mit Highlight-Effekt) oder öffnet den Flow-Editor.
- **Event-Präzision**: Spezialisierte Variablen (Timer, Trigger, etc.) zeigen im Inspektor nur noch ihre klassenspezifischen Events an.
- **Daten-Anreicherung**: Anzeige von X/Y-Positionen, Klassen, Typen, Zielobjekten und aktuellen Werten.
- **TTable-Komponente**: Statischer Renderer für systemweite Tabellen-Visualisierung.
- **Reaktive Synchronisation**: Kopplung des Editors an den `MediatorService`. Interaktionen auf der Stage (Selektion, Verschieben, Skalieren) triggern nun automatische Updates in allen anderen Ansichten (insbes. Management-Tab).
- **Cross-Tool Synchronisation**: Nahtloser Datenfluss zwischen JSON-, Pascal-, Action- und Flow-Editor. Änderungen in einem Tool werden sofort in allen anderen Ansichten reflektiert, ohne zirkuläre Event-Schleifen zu erzeugen (Trinity-Sync).
- **Robuste Serialisierung**: Zentralisierte `toJSON`-Logik in `TComponent` unterstützt nun verschachtelte Objekt-Pfade (z.B. `style.visible`) und automatische Kind-Serialisierung.

### Behoben
- **Variablenwert-Löschung**: Fix für das sofortige Löschen von eingegebenen Werten in Variablen durch Korrektur der Auflösungs-Logik in `PropertyHelper.ts`.
- **Variablentyp-Persistenz**: Fix für das Zurückspringen von Typen (z.B. `any`, `json`) auf `integer` beim Morphing im `Editor.ts`.
- **Stage-Bereinigung**: Korrektur der Rendering-Logik; Manager-Tabellen werden nicht mehr auf der Stage angezeigt.
- **Sanitizer-Härtung**: Automatische Entfernung transienter Management-Objekte aus Projektdaten.
- **Button-Rendering**: Zusätzliche Texte auf Buttons ("(0 Einträge)") wurden entfernt.
- **TObjectList Refactoring**: Erbt nun von `TTable`, um tabellarische Eigenschaften direkt zu nutzen.
- **Image-Sichtbarkeit**: Behebung eines Fehlers, bei dem Bilder nach Pascal-Änderungen ihre Sichtbarkeitseinstellungen verloren haben.
- **Tool-Sync Stabilität**: Flow-Editor wird nicht mehr bei eigenen Änderungen neu initialisiert.

### Action-System & UI (v2.16.24)
- **Dynamische Action-UI**: Der `JSONInspector` unterstützt nun `actionType`-spezifische Layouts (z.B. für `http` oder `store_token`), indem er auf `inspector_header.json` zurückfällt und die dynamischen Properties der Action anzeigt, statt das statische `inspector_action.json` zu erzwingen.
- **Subtype-Parsing**: `FlowEditor.createNode` extrahiert nun Action-Subtypes (z.B. `Action:http` -> `http`) und speichert sie in `node.data.type`, was die korrekte UI-Generierung ermöglicht.
