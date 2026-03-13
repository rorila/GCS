## [3.14.1] - 2026-03-13
### Added (Sync-Robustheit)
- **`SyncValidator`** (`src/editor/services/SyncValidator.ts`) [NEU]:
  - Automatische Konsistenzprüfung nach jeder `syncToProject()`-Operation
  - 6 Validierungsregeln: R1 (Action-Referenzen), R2 (FlowChart-Task-Konsistenz), R3 (Connection-Validität), R4 (Property-Sync), R5 (Duplikate), R6 (FlowChart-Speicherort)
  - Auto-Repair für unkritische Fälle (verwaiste Referenzen, FlowChart-Duplikate)
  - Spot-Validierung in `FlowNodeHandler.handlePropertyChange()` für sofortige Desync-Erkennung
  - 10 Unit-Tests (Gutfall, Erkennung und Auto-Repair für R1/R2/R3/R5/R6, Spot-Validierung)

## [3.14.0] - 2026-03-13
### Added (Inspector Refactoring: Component-Owned Inspector)
- **`IInspectable` Interface** (`src/editor/inspector/types.ts`):
  - Neues Interface für selbstbeschreibende Inspectoren: `getInspectorSections()` und `applyChange()`
  - `InspectorSection` Typ mit einklappbaren Sektionen, Icons und Properties
  - `isInspectable()` Type Guard für polymorphe Erkennung
- **`FlowElement.ts`**: Default `getInspectorSections()` und `applyChange()` als Basis-Implementierung
- **`FlowAction.ts`**: Dynamische Sektionen basierend auf Action-Typ (property/method/event/registry)
  - `applyChange()` gibt `true` für Typ-Wechsel zurück → triggert Inspector Re-Render
  - Legacy `getInspectorProperties()` leitet aus Sektionen ab
- **`FlowTask.ts`**: 3 Sektionen (Allgemein/Konfiguration/Aktionen) mit Ausführungsmodus und Scope
- **`InspectorHost.ts`**: Neuer IInspectable-Render-Pfad mit einklappbaren Sektionen
  - `renderInspectableSections()` rendert Sektionen mit Icons und Collapse-Toggle
  - `renderInspectableProperty()` delegiert Änderungen an `eventHandler.handleControlChange()`
  - Fallback auf JSON-Template-Pfad für Objekte ohne IInspectable
  - E2E-Kompatibilität: Input name=`{prop}Input`, Select name=`controlName || propName`

### Changed
- **Inspector Rendering**: FlowAction/FlowTask rendern jetzt über IInspectable-Pfad statt JSON-Templates
- **Handler-Delegation**: Änderungen laufen weiterhin über `FlowNodeHandler` für Refactoring-Kompatibilität

## [3.13.0] - 2026-03-13
### Added (API-Realisierung Phase 1-5)
- **API-Referenzdokument** (`docs/AgentAPI.md`):
  - Vollständige Referenz aller 45+ Methoden mit Signatur, Parametern, Rückgabewerten
  - **Action-Typ-Katalog**: Alle 22 Typen mit Pflichtfeldern und Beispielen
  - **Event-Katalog**: onClick, onCollision, onBoundaryHit, onStart, onKeyDown etc.
  - **Komponenten-Katalog**: TSprite, TLabel, TButton, TPanel, TInputController
  - **Batch-API Doku**: Transaktionen mit Rollback-Semantik
  - **WebSocket-API Doku**: agent_call/agent_result Echtzeit-Protokoll
  - **KI-Prompt-Template** für externe KI-Agenten
  - **Vollständiges PingPong-Beispiel** zur Demonstration aller API-Methoden
- **AgentController.ts** — 5 neue Methoden:
  - `addTaskCall(taskName, calledTaskName)` — Task-Referenz in Sequenz
  - `setTaskTriggerMode(taskName, mode)` — broadcast/local-sync/local setzen
  - `addTaskParam(taskName, paramName, type, defaultValue)` — Task-Parameter
  - `moveActionInSequence(taskName, fromIndex, toIndex)` — Reihenfolge ändern
  - `executeBatch(operations[])` — Batch-API mit Rollback
- **AgentShortcuts.ts** [NEU] — Convenience-Layer:
  - `createSprite()`, `createLabel()`, `createButton()`, `setSpriteCollision()`, `setSpriteVelocity()`
  - `createBounceLogic()`, `createScoreSystem()`, `createPaddleControls()`
- **HTTP-Endpoints** in `game-server/src/server.ts`:
  - `POST /api/agent/:method` — Einzeln-Aufrufe
  - `POST /api/agent/batch` — Batch/Transaktionen mit Rollback
- **WebSocket-Kanal** `agent_call` / `agent_result` in `Protocol.ts` + `server.ts`
- **Tests** (`tests/agent_controller.test.ts`): 12 Tests (PingPong + Tennis-Batch + Rollback)

## [3.12.4] - 2026-03-13
### Added
- **F5-Reload Dialog (Session-Wiederherstellung)**:
  - Bei F5/Reload vergleicht der Editor jetzt LocalStorage-Projekt mit Server-Datei (`project.json`).
  - Wenn sich die Projekte unterscheiden → modaler Dialog: "📂 Lokale Version laden" vs. "🌐 Server-Version laden".
  - Zeigt Projektname und letzten Speicherzeitpunkt der lokalen Version.
  - `autoSaveToLocalStorage()` schreibt jetzt Zeitstempel (`gcs_last_save_time`).
  - Vorher: Immer hardcoded `./platform/project.json` geladen — lokale Änderungen gingen bei F5 verloren.

## [3.12.3] - 2026-03-12
### Added (Editor / Debugging)
- **Keyboard- & Runtime-Logs via UseCaseManager**: Neuer UseCase `Input_Handling` in `UseCaseManager.ts` hinzugefügt. `TInputController` wurde darauf umgestellt. `TaskExecutor` (`[TaskExecutor] EXECUTING: ...`) und `EditorRunManager` (`[RunManager] handleRuntimeEvent: ...`) verwenden nun ebenfalls konsequent die Logger-API (`Logger.get(..., 'Runtime_Execution')`). Alle störenden Event- und Ausführungs-Logs lassen sich nun gezielt im Inspector "Logs"-Tab de- und aktivieren.

### Added (Game Logic / PingPong)
- **Regelkonforme Event-Actions (`PingPong.json`)**:
  - Sämtliche vormals "inline" oder fehlerhaft referenzierten `negate`-Verhaltensweisen für den Abprall wurden zu korrekten, globalen Actions konvertiert (Regel: *Keine Inline-Actions*).
  - Die Action `NegateBallY` (Abprallen an oberer/unterer Begrenzung) ist nun als globales Element vom Typ `negate` für `BallSprite` (`velocityY: true`) in der Blueprint-Stage verankert.
- **Ball-Reset bei Aus (`PingPong.json`)**: Implementierung der Fehler-Bedingung (Ball berührt linken oder rechten Spielfeldrand).
  - Globale Action `ResetBall` vom Typ `property` erstellt, die den Ball zentriert (Grid-Koordinaten x: 32, y: 19) und die X/Y-Geschwindigkeit zurücksetzt.
  - Task `HandleBallBoundary` zu einem komplexen Ablauf umgebaut, welcher die `hitSide` Eigenschaft per konditionalen Verzweigungen testet: `top`/`bottom` führen wie bisher zu Abprallern (`NegateBallY`), `left`/`right` führen zum Aufruf von `ResetBall`.

### Fixed
- **FlowSyncManager (Condition-Nodes Bug)**:
  - Behoben: Beim Speichern (FlowChart -> actionSequence) und Parsen (actionSequence -> FlowChart) von `condition` Nodes wurden strukturierte Objektdaten (`data.condition`) zu einem platten String `text` reduziert, was zum vollständigen Verlust der Bedingungs-Logik führte.
  - Das Serialisieren/Deserialisieren unterstützt nun korrekt die Erhaltung von `data.condition` für die Editor-Anzeige und die Laufzeitauswertung.
- **Inspector Dropdowns (Variablen)**:
  - Behoben: Bislang wurden Task-bezogene Parameter (Eingangsparameter wie `hitSide`) im Variablen-Dropdown des Inspectors (z.B. in der Condition-Node) nicht angezeigt, wodurch man als User nicht sehen konnte, auf welche Laufzeit-Variablen man Zugriff hat. Der `InspectorContextBuilder` liest nun dynamisch die `params` aller Tasks in der aktuellen Stage und führt sie mit Büroklammer-Icon (📎) regulär in der Dropdown-Liste.
- **FlowCondition Text-Anzeige im Flow-Diagramm**:
  - Behoben: FlowCondition-Nodes (lila Rauten) zeigten nach dem Laden eines Projekts keinen Bedingungstext an (z.B. "hitSide == top"). Ursache: `refreshVisuals()` wurde für Condition-Nodes im `FlowSyncManager.restoreNode()` nicht aufgerufen. Der Fix ist eine einzige Zeile, die sicherstellt, dass `updateText()` nach dem Laden der `data.condition` Daten getriggert wird.
- **FlowSyncManager Connection-Matching (ROOT CAUSE BOUNCING-BUG)**:
  - Behoben: `syncToProject()` suchte true-branch Connections ausschließlich via `startAnchorType === 'true'`. FlowCondition-Connections nutzen jedoch `startAnchorType: 'right'` mit dem Flag `isTrueBranch: true`. Die Connection wurde dadurch nie gefunden, das generierte `body`-Array blieb leer und keine Action wurde bei Boundary-Hits ausgelöst. Fix: Connection-Erkennung erweitert um `'right'`/`'bottom'` Anchor-Typen und `isTrueBranch`/`isFalseBranch` Flags.
- **PascalCodeGenerator TypeError & Action-Support**:
  - Behoben: `TypeError: Cannot read properties of undefined (reading 'toString')` — der Generator erwartete `cond.value`, aber nach dem FlowSyncManager-Fix wurden Conditions mit `leftValue`/`rightValue` exportiert. Beide Formate werden jetzt unterstützt, mit durchgehender Null-Safety (`String()` statt `.toString()`).
  - Neu: `negate`-Actions werden als Pascal-Zuweisungen dargestellt (`Target.Prop := -Target.Prop;`).
  - Neu: Actions aus der Blueprint-Stage werden jetzt korrekt bei der Suche berücksichtigt.
- **Stage Start-Animation Fix**:
  - `GameRuntime.triggerStartAnimation()` unterstützt jetzt alle 12 TStage Fly-Patterns (UpLeft, BottomLeft, ChaosIn, Matrix, Random, etc.).
  - Vorher wurden nur `fade-in` und `slide-up` erkannt — alle Inspector-konfigurierten Patterns (z.B. `BottomLeft`) wurden ignoriert.
  - Easing-Konfiguration (`startAnimationEasing`) wird jetzt korrekt aus der Stage-Config gelesen.
  - **Lazy-Init Fix in AnimationManager**: `startTime` wird erst beim ersten `update()`-Aufruf gesetzt (statt bei Tween-Erstellung). Behebt Timing-Bug wo Tweens sofort als "completed" markiert wurden weil sie zwischen Game-Loop-Zyklen erstellt wurden.
  - **Einheiten-Bug behoben**: Startpositionen wurden in Pixeln (1152×720) statt Grid-Zellen (64×40) berechnet → Objekte starteten 97% der Dauer unsichtbar. `outsideMargin` auf 10 Grid-Zellen reduziert.
- **DebugLogService Performance-Fix**:
  - `maxChildren=50` pro Parent-Log verhindert unbegrenztes Speicherwachstum bei verschachtelten Logs.
  - `scheduleNotify()` via `requestAnimationFrame` reduziert Listener-Benachrichtigungen von hunderten/sec auf max. 1/Frame.
  - `isNotifying`-Guard verhindert rekursive Log-Kaskaden.
  - O(1) `entryMap` HashMap ersetzt rekursive `findEntry()` Baumsuche — bei 1000 Logs mit je 50 Kindern wurde der Baum bei JEDEM `log()`-Aufruf komplett durchsucht, was progressives Stottern verursachte.
  - **TDebugLog Visibility-Guard:** Der Subscribe-Callback und `renderLogs()` prüfen jetzt `isVisible` — kein DOM-Rebuild wenn das Panel unsichtbar ist. Vorher wurden 1000+ DOM-Elemente bei JEDEM Frame neu erstellt, obwohl das Panel per `translateX(100%)` ausgeblendet war.
- **FlowEditor isDirty-Guard (Robustheit)**:
  - `syncToProject()` wird jetzt NUR ausgeführt wenn tatsächlich Änderungen im Flow-Editor vorgenommen wurden (`isFlowDirty`-Flag).
  - Beim bloßen View-Wechsel (Flow → Code/Run) oder Speichern ohne Änderungen wird `syncToProjectIfDirty()` aufgerufen, das den Guard prüft.
  - Verhindert, dass korrupte `actionSequence`-Daten im LocalStorage/Autosave landen, wenn die Connection-Matching-Logik Edge-Cases nicht abfängt.
- **Pascal-Code Task-Filter (NEU)**:
  - In der Code-View (Pascal-Tab) gibt es nun ein Task-Dropdown, mit dem ein einzelner Task ausgewählt werden kann.
  - Bei Auswahl werden nur die relevanten Prozeduren angezeigt: der Task als Hauptprozedur, alle referenzierten Actions als Sub-Prozeduren, Task-Parameter als VAR-Deklarationen und Event-Auslöser als Kommentare.
  - `PascalCodeGenerator.generateForTask()` sammelt Actions rekursiv aus `actionSequence` (inkl. `body`, `elseBody`, `thenAction`, `elseAction`).
- **Paddle Collision Bounce (`PingPong.json`)**: Implementierung des Abpralls an den Paddles (X-Achse).
  - Globale Action `NegateBallX` vom Typ `negate` erstellt, welche `velocityX` umkehrt.
  - Neuer Task `HandlePaddleCollision` auf `stage_main` angelegt, der `NegateBallX` aufruft.
  - Event-Binding `onCollision` auf dem `BallSprite` konfiguriert, sodass der Task bei jeder Sprite-Kollision (hier: Paddles) automatisch triggert.
- **Top/Bottom Ball Bounce (`PingPong.json`)**: Implementierung des Abpralls an der oberen und unteren Begrenzung.
  - Globale Action `NegateBallY` vom Typ `negate` erstellt, welche `velocityY` umkehrt. (Nutzt die automatische Fallback-Logik in `StandardActions.ts`, die `_prevVelocityY` heranzieht, wenn `velocityY` durch die Engine temporär auf 0 gesetzt wurde).
  - Neuer Task `HandleBallBoundary` auf `stage_main` angelegt, der `NegateBallY` aufruft.
  - Event-Binding `onBoundaryHit` auf dem `BallSprite` konfiguriert, sodass der Task bei Randerkennung automatisch triggert.

### Fixed (Performance / Stottern)
- **Kollisions-Lags behoben (`GameRuntime.ts`, `GameLoopManager.ts`, `StandardActions.ts`)**: Stark frequentierte Debug-Logs (`console.info`, `console.warn` bei Event-Routing) und speicherintensive `DebugLogService`-Aufrufe in der `negate`-Action auskommentiert, da diese bei jeder Ball-Paddle/Wand Berührung synchrone Time-Gaps (Stottern) verursachten.

### Fixed (Paddle-Steuerung / InputController)
- **Direkte Keyboard-Verwaltung** (`EditorRunManager.ts`): Keyboard-Listener werden jetzt direkt im EditorRunManager via `setupKeyboardListeners()`/`removeKeyboardListeners()` verwaltet, statt über `TInputController.start()`/`stop()`. Behebt: IC's interne Methoden griffen nicht zuverlässig (Splash-Screen verhindert `initMainGame()`, HMR-Instanz-Inkonsistenzen).
- **InputController-Initialisierung vor Splash-Check** (`GameRuntime.ts`): Neue Methode `initInputControllers()` wird VOR dem Splash-Check in `start()` aufgerufen, damit Keyboard-Events sofort nach Spielstart funktionieren.
- **Events-Dropdown zeigt alle Tasks** (`InspectorContextBuilder.ts`): `availableTasks` nutzt jetzt `getTasks('all')` statt `getTasks('active')`, damit globale Objekte (InputController auf Blueprint-Stage) auch Spielfeld-Tasks im Dropdown sehen.

## [3.12.2] - 2026-03-12
### Fixed (Abwärtskompatibilität älterer Spiele)
- **`self`/`other` Auflösung in Actions** (`StandardActions.ts`): `resolveTarget()` löst jetzt `self` und `other` korrekt über `eventData` auf. Bei Kollisionen enthält eventData `{self, other, hitSide}`. Vorher wurde `self`/`other` nie aufgelöst → alle `variable`-Actions mit `source: 'self'/'other'` scheiterten.
- **`calcSteps`-Auswertung im `calculate`-Handler** (`StandardActions.ts`): Wenn `formula`/`expression` fehlt aber `calcSteps` vorhanden sind, werden die Steps sequentiell ausgewertet. Unterstützt `operandType: 'variable'`, `'objectProperty'` und `constant` mit Operatoren `+`, `-`, `*`, `/`.
- **`self`/`other` im Evaluationskontext**: Der `calculate`-Handler injiziert jetzt `self`/`other` aus `eventData` in den `evalContext`, damit Formeln wie `self.y` oder `other.height` funktionieren.
- **`negate`-Action hinzugefügt** (`StandardActions.ts`): Negiert numerische Properties (z.B. `velocityX * -1`). Wird in Arkanoid/Tennis für Ball-Richtungsänderung bei Kollision verwendet.
- **Alle Action-Handler konsistent**: `property`, `variable`, `animate`, `move_to`, `call_method` verwenden jetzt `context.eventData` für Target-Auflösung.

## [3.12.1] - 2026-03-11
### Performance (Runde 2 — Smooth 60fps)
- **Direkte Sprite-Referenzen statt stale Copies** (`GameLoopManager.ts`, `EditorRunManager.ts`): `spriteRenderCallback` übergibt jetzt `this.sprites` (aktuelle Referenzen vom GameLoopManager) direkt an `renderSpritesOnly()`. Vorher wurden stale Deep-Copies aus `getObjects()` genutzt — Positionen blieben beim Startwert.
- **RAF-Debounce für GlobalListener** (`GameRuntime.ts`): Der `onRender`-Callback wird jetzt per `requestAnimationFrame` debounced. Egal wie viele Properties sich pro Frame ändern (Score + Label + Toast + ...), es gibt nur EIN `editor.render()` pro Frame.
- **TDebugLog console.log-Spam eliminiert** (`TDebugLog.ts`): `shouldShowRecursive()` loggte bei JEDEM `renderLogs()`-Aufruf für ALLE matching Einträge → exponentielles Wachstum. `subscribe`-Callback jetzt ebenfalls per RAF debounced.
- **AnimationManager Logging bereinigt** (`AnimationManager.ts`): `update()` loggte 60x/sec in die Console. Alle High-Frequency-Logs auskommentiert, `Tween completed`-Log beibehalten.

## [3.12.0] - 2026-03-11
### Performance
- **Editor-Rendering-Optimierung (60fps Sprite-Bewegung)**: Separater Fast-Path für Sprite-Positionen im Editor Run-Modus implementiert. Sprites werden jetzt direkt per `style.left/top` aktualisiert (ähnlich dem Standalone-Player), statt den gesamten DOM-Render-Zyklus zu durchlaufen.
  - `GameLoopManager.ts`: Neuer `spriteRenderCallback` als Fast-Path — nur Sprite-Positionen statt volles DOM-Rebuild.
  - `StageRenderer.ts`: Neue Methode `updateSpritePositions()` für direkte Pixel-Positionierung. CSS-Transition (`left 33ms linear`) entfernt, da sie mit `requestAnimationFrame`-Timing kollidiert.
  - `GameRuntime.ts`: Neues `onSpriteRender` Feld in `RuntimeOptions`, durchgereicht an `GameLoopManager`.
  - `EditorRunManager.ts`: Neue Methode `renderSpritesOnly()` filtert Sprites und ruft Fast-Path auf. `handleRuntimeEvent()` ruft kein doppeltes `editor.render()` mehr auf.
  - `Stage.ts`: `updateSpritePositions()` Delegierungsmethode (renderer bleibt private).

## [3.11.9] - 2026-03-10
### Added
- **Glow/Shadow-Effekt für alle Komponenten** (`src/components/TWindow.ts`, `src/editor/services/StageRenderer.ts`): Neue Properties `glowColor`, `glowBlur`, `glowSpread` und `boxShadow` (CSS-String) im Inspector unter Gruppe "GLOW-EFFEKT". Wirkt auf alle TWindow-Ableitungen (TPanel, TButton, TLabel, etc.).
- **AgentController API vervollständigt** (`src/services/AgentController.ts`): 22 neue Methoden — Delete (Task/Action/Object/Stage/Variable), Rename (Task/Action), Read (listStages/listTasks/listActions/listVariables/listObjects/getTaskDetails), UI (setProperty/bindVariable/connectEvent), Workflow (duplicateTask), Validation (validate).

### Fixed
- **AgentController.generateTaskFlow()**: Connection-IDs, Start/End-Koordinaten und Type-Casing (kleingeschrieben) korrigiert für korrekte FlowEditor-Darstellung.
- **Inspector Scroll-Position**: Bleibt nach Property-Änderung erhalten (kein doppeltes update bei originator='inspector').
- **Server-Endpoint** `GET /api/dev/list-projects`: Listet alle Ordner und JSON-Dateien unter `projects/` auf.
- **Dynamischer Speicherpfad** (`src/editor/services/EditorDataManager.ts`): `saveProjectToFile` nutzt jetzt `currentSavePath` statt festen Pfad `projects/master_test/`. "Speichern unter" setzt diesen Pfad via Dialog.
- **VariablePickerDialog** (`src/editor/inspector/VariablePickerDialog.ts`): Neuer modaler Dialog zur Variablen-Auswahl im Inspector. Ersetzt den bisherigen `prompt()`-Dialog. Zeigt globale und Stage-Variablen mit Subeigenschaften als Baumstruktur, Suchfeld und Gruppierung (🌐 Global / 🎭 Stage / 🔄 Repeater).

### Fixed
- **Binding-Anzeige im Inspector** (`src/editor/inspector/InspectorHost.ts`): `resolveValue()` bewahrt jetzt Binding-Werte (z.B. `${currentUser.name}`) als Rohtext, statt sie erneut durch den Template-Parser zu schicken. Verhindert doppelte Template-Auflösung, die Binding-Werte zu leeren Strings machte.
- **findObjectById gibt Original statt Preview** (`src/editor/services/EditorCommandManager.ts`): `findObjectById()` gab Preview-Objekte aus dem ObjectStore zurück, in denen Bindings bereits aufgelöst (= leer) waren. Jetzt wird über `__rawSource` das Original-Objekt mit den Roh-Binding-Werten zurückgegeben.
- **Falsches Dirty-Flag nach Startup** (`src/editor/EditorViewManager.ts`): `isProjectDirty` wurde bei JEDEM `DATA_CHANGED`-Event auf `true` gesetzt, auch beim initialen Laden. Jetzt wird der Originator geprüft: Events mit `'editor-load'` oder `'autosave'` setzen das Flag nicht mehr.
- **Circular JSON beim Serialisieren** (`src/services/ProjectPersistenceService.ts`): Neuer `safeReplacer()` filtert zirkuläre Properties (`renderer`, `host`, `parent`, `stage`, `editor`, `__rawSource`) bei ALLEN `JSON.stringify`-Aufrufen (autoSave, saveProject, saveProjectToFile).
- **Stage-Menü nach Laden** (`src/editor/services/EditorDataManager.ts`): `updateStagesMenu()` wird jetzt verzögert am Ende von `loadProject()` aufgerufen, damit neue Stages zuverlässig im Menü erscheinen.

### Changed
- **InspectorActionHandler** (`src/editor/inspector/InspectorActionHandler.ts`): `handlePickVariable()` nutzt jetzt den neuen `VariablePickerDialog` statt `prompt()`. Vereinfachte Wert-Persistierung (keine Konkatenation mehr, direktes Ersetzen).

## [3.11.8] - 2026-03-10
### Added
- **E2E-Test: Stage erzeugen** (`tests/e2e/05_StageCreation.spec.ts`): UseCase "Eine neue Stage erzeugen" — Menü: Stages → Neue Stage, Umbenennung zu HighscoreStage, Validierung in project.stages, Speicherung.
- **E2E-Test: Action Typ ändern** (`tests/e2e/06_ActionTypeChange.spec.ts`): UseCase "Action Typ ändern" — Flow-Tab → VerifyTask-Flow → VerifyAction anklicken → ActionTypeSelect auf navigate_stage, stageId auf HighscoreStage.
- **E2E-Test: RunButton erzeugen** (`tests/e2e/07_RunButtonCreation.spec.ts`): UseCase "RunButton erzeugen" — Stage-Tab → Toolbox → Button platzieren → Inspector caption auf 'run' setzen.
- **UseCase-Beschreibungen** (`docs/UseCaseBeschreibungen/`): 3 neue UseCase-Dateien für Stage erzeugen, Action Typ ändern, RunButton erzeugen.

### Fixed
- **getStageOptions Bugfix** (`src/editor/JSONDialogRenderer.ts`, L91-95): `getStageOptions()` nutzt jetzt `this.project.stages` statt `this.enrichedProject.stages`. Das `enrichedProject` war ein Snapshot vom Dialog-Konstruktor und konnte neue Stages (z.B. HighscoreStage) nicht enthalten.

### Changed
- **Test-Nummerierung**: `05_ProjectSaving.spec.ts` → `08_ProjectSaving.spec.ts` (Tests 05-07 sind die neuen UseCase-Tests).

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
