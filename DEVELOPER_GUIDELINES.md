# Developer Guidelines

> [!CAUTION]
> **MANDATORY AI AGENT RULE**: Every code modification MUST be followed by executing `npm run test` (oder `run_tests.bat`, falls PowerShell blockiert). Verification of the `docs/QA_Report.md` is required for the "Definition of Done". Do NOT notify the user before running tests.

## Schnellstart & Kernregeln
- **Sprache**: Die gesamte Kommunikation und Dokumentation erfolgt auf Deutsch.
- **GCS Dashboard Pattern**: Für moderne Dashboards (z.B. `roomDashboard`) die `TTable` im `displayMode: "cards"` verwenden. Datenquellen dafür sind bevorzugt `TObjectList`-Variablen in der `stage_blueprint`.
- **Global Hosting**: Gemäß Antigravity-Regeln MÜSSEN alle globalen Variablen und Komponenten in der `stage_blueprint` definiert sein.
- **DO NOT**: Playwright-Tests in parallelen Workern ausführen, wenn der Dev-Server (Vite) oder der State (LocalStorage) geteilt wird. Dies führt zu unvorhersehbaren Race Conditions. Immer `workers: 1` und `fullyParallel: false` in der Konfiguration nutzen.
- **Modularisierung**: Max. 1000 Zeilen pro Datei. Bei Überschreitung: Modul-Aufteilung anwenden.
- **Synchronität**: Änderungen in Inspector/Flow-Editor müssen konsistent in JSON und Pascal reflektiert werden.
- **Flow-Typen**: Typ-Bezeichner für Flow-Elemente (`getType()`) müssen IMMER kleingeschrieben sein (z.B. 'task', 'action'). Dies sichert die Konsistenz mit dem Datenmodell und dem Refactoring-System.
- **Expert-Wizard Dynamisierung**: Um im Wizard Auswahl-Listen statt Textfeldern zu zeigen, in der Regel-JSON `type: "select"` und `options: "@objects"` (oder andere Key-Platzhalter) verwenden. Die Auflösung erfolgt zur Laufzeit via `ProjectRegistry`.
- **Inspector-Typen**: 
  - `type: "color"`: Zeigt einen Farbwähler (🎨-Icon) an.
  - `inline: true`: Gruppiert aufeinanderfolgende Eigenschaften horizontal (ideal für Checkboxen wie Fett/Kursiv).
- **FlowAction Proxy-Regel**: Wenn neue Felder in `StandardActions.ts` oder `action_rules.json` hinzugefügt werden (z.B. für neue Aktions-Typen), MÜSSEN diese auch als Getter/Setter in `FlowAction.ts` implementiert werden, damit der Inspector sie bearbeiten kann.
- **IInspectable Pattern (v3.14.0)**: Flow-Objekte (`FlowAction`, `FlowTask`) implementieren `getInspectorSections()` zur Deklaration der Inspector-UI. Änderungen werden weiterhin über `eventHandler.handleControlChange()` delegiert (nicht über `applyChange()` im onchange-Handler). `applyChange()` wird nur für Re-Render-Checks (z.B. Typ-Wechsel) verwendet. Neue Flow-Objekte MÜSSEN `getInspectorSections()` implementieren. Für E2E-Tests: Input name=`{propName}Input`, Select name=`controlName || propName`.
- **SyncValidator (v3.14.1)**: Nach jeder `syncToProject()`-Operation prüft `SyncValidator.validate()` automatisch 6 Konsistenzregeln. Verletzungen werden über den Logger geloggt. Bei neuen Sync-relevanten Datenstrukturen: entsprechende Validierungsregel in `SyncValidator.ts` ergänzen.
- **TComponent IInspectable (v3.14.3)**: Alle UI-Komponenten (TButton, TLabel, etc.) implementieren automatisch `IInspectable` über TComponent. `getInspectorSections()` konvertiert `getInspectorProperties()` Gruppen zu Sektionen. Neue Gruppen-Icons in `GROUP_ICONS` Map in `TComponent.ts` hinzufügen.
- **SnapshotManager (v3.14.4)**: Projekt-Level Undo/Redo via `snapshotManager.pushSnapshot()` vor Property-Änderungen. Ergänzt den bestehenden `ChangeRecorder` (feingranulares Action-Undo). Bei neuen Daten-Mutationspunkten: `snapshotManager.pushSnapshot(project, label)` aufrufen.
- **ProjectStore (v3.15.0)**: Zentraler State-Manager. Alle Datenänderungen SOLLTEN über `projectStore.dispatch()` laufen. Views registrieren sich über `projectStore.onChange()`. Neue Mutations-Typen in `ProjectMutation` hinzufügen und `reduce()` erweitern.
- **Sync-Blacklist**: Die `taskFields` Liste in `FlowSyncManager.ts` darf keine Felder enthalten, die für Aktionen (Global oder Embedded) essentiell sind (z.B. `value`, `params`, `body`, `source`).

## Synchronisation von Inspector und Flow-Editor
- **Persistenz von Flow-Nodes**: Beim Bearbeiten von Action-Nodes im Inspector muss der `FlowNodeHandler` nicht nur globale Listen (`project.actions`), sondern auch die `flowCharts` des Projekts durchsuchen, um "unlinked" / lokale Actions zu finden und zu aktualisieren.
- **Typ-Wechsel**: Bei Änderungen des Aktions-Typs im Inspector muss `mediatorService.notifyDataChanged` aufgerufen werden, damit der Flow-Editor die Sequenzen neu berechnet und der Inspector passende Parameter-Felder einblendet.
- **Server-Sync**: `EditorDataManager.updateProjectJSON` sollte bei Inspector-Änderungen einen Server-Dateisystem-Sync auslösen, um Konsistenz zwischen UI-State und JSON-View zu wahren.

## DO NOT
- **Expert-Wizard Prompts**: Prompts unterstützen Platzhalter in geschweiften Klammern (z.B. `"Wert für {target}.{property}?"`). Diese werden automatisch durch bereits gesammelte Werte aus der Session ersetzt.
- **Serialization reservedKeys**: Wenn neue Komponenten Read-Only Properties (nur `get`, kein `set`) einführen, MUSS der Property-Name zur `reservedKeys`-Liste in `Serialization.ts` hinzugefügt werden. Anderenfalls schmeisst die `hydrateObjects`-Funktion einen `TypeError: Cannot set property ... which has only a getter` beim Laden. Bekannte Beispiele: `currentStageId`, `currentStageName`, `currentStageType`, `currentStageIndex`, `stageCount`, `mainStageId`, `isOnMainStage`, `isOnSplashStage`.
- **saveProjectToFile – Reihenfolge**: `isProjectChangeAvailable.defaultValue` und `isProjectDirty` müssen VOR dem `JSON.stringify`-Aufruf zurückgesetzt werden, damit der gespeicherte Snapshot den korrekten Zustand enthält.
- **loadProject – isProjectDirty**: `isProjectDirty=false` muss NACH `setProject()` und `notifyDataChanged()` gesetzt werden (synchron + `setTimeout(100)`), da diese Aufrufe `DATA_CHANGED` auslösen und `isProjectDirty` wieder auf `true` setzen.
- **Inspector resolveValue – Doppelte Template-Auflösung**: Wenn `resolveValue()` einen Wert auflöst, der selbst `${...}`-Templates enthält (z.B. Binding-Variablen wie `${currentUser.name}`), darf das Ergebnis NICHT erneut durch den Template-Parser geschickt werden. Siehe Bugfix in `InspectorHost.resolveValue()`.
- **Inspector Variable Picker**: Für Variablen-Auswahl im Inspector immer `VariablePickerDialog.show()` verwenden (nicht `prompt()`). Der Dialog ist in `src/editor/inspector/VariablePickerDialog.ts`.
- **Sprite-Rendering im Run-Modus**: Sprite-Positionen (x, y) NIEMALS über den vollen `editor.render()`-Pfad aktualisieren (verursacht Frame-Drops). Stattdessen den `spriteRenderCallback` in `GameLoopManager` nutzen, der `StageRenderer.updateSpritePositions()` aufruft (nur `style.left/top`). CSS-Transitions auf Sprite-Elementen vermeiden — sie kollidieren mit `requestAnimationFrame`-Timing.
- **handleRuntimeEvent() – Kein doppeltes Render**: In `EditorRunManager.handleRuntimeEvent()` darf KEIN `editor.render()` aufgerufen werden. Events lösen Property-Änderungen aus, die über den GlobalListener der ReactiveRuntime bereits ein Render triggern. Doppeltes Rendering führt zu Frame-Drops.
- **isProjectDirty – Originator prüfen**: In `EditorViewManager.initMediator` wird `isProjectDirty = true` NUR bei echten User-Änderungen gesetzt. Events mit Originator `'editor-load'` oder `'autosave'` werden ignoriert. Wenn neue `notifyDataChanged()`-Aufrufe hinzugefügt werden, MUSS ein sinnvoller Originator übergeben werden.
- **resolveTarget – immer `context.eventData` übergeben**: Alle Action-Handler in `StandardActions.ts` MÜSSEN `context.eventData` (nicht `context.contextVars`) als 4. Argument an `resolveTarget()` übergeben. `eventData` enthält bei Kollisionen `{self, other, hitSide}` und ermöglicht die Auflösung von `target: 'self'/'other'`.
- **console.log in Game-Loop-Pfaden**: NIEMALS `console.log` in Funktionen platzieren, die 60x/sec aufgerufen werden (`update()`, `loop()`, `renderLogs()`, `shouldShowRecursive()`). Dies blockiert den Main-Thread und tötet die Performance. Bei Debug-Bedarf `console.debug` oder auskommentierte Logs verwenden.
- **TInputController.start()/stop() NICHT für Keyboard-Listener nutzen**: Die `start()`/`stop()`-Methoden des TInputController sind unzuverlässig im Editor-Kontext (HMR-Teilupdates, Proxy-Instanz-Inkonsistenzen, Splash-Screen blockiert `initMainGame()`). Stattdessen verwaltet `EditorRunManager.setupKeyboardListeners()` die `window.keydown`/`keyup`-Listener DIREKT und leitet Game-Keys (W/S/↑/↓) an `handleRuntimeEvent()` weiter. Bei `stopRuntime()` werden die Listener über `removeKeyboardListeners()` sauber entfernt. Dieser Ansatz garantiert zuverlässige Keyboard-Events bei jedem Run-Modus-Eintritt.
- **GameRuntime.start() und Splash-Screen**: Wenn ein Splash-Screen aktiv ist, wird `initMainGame()` NICHT aufgerufen (early return in `start()`). Das bedeutet: `initRuntime()` und `onRuntimeStart()` werden für KEINE Objekte ausgeführt. Wenn Komponenten (wie InputController) schon während oder direkt nach dem Splash funktionieren müssen, muss ihre Initialisierung VOR dem Splash-Check erfolgen oder extern verwaltet werden (z.B. durch `EditorRunManager`).
- **Inspector Events-Dropdown – getTasks('all') verwenden**: `InspectorContextBuilder.ts` muss für `availableTasks` `getTasks('all')` statt `getTasks('active')` verwenden, damit globale Objekte (wie InputController auf Blueprint-Stage) auch Tasks von anderen Stages (z.B. Spielfeld) im Event-Dropdown sehen.
- **FlowSyncManager – Connection Anchor-Types für Conditions**: Bei der Branch-Erkennung in `syncToProject()` dürfen Condition-Connections NICHT nur via `startAnchorType === 'true'/'false'` gesucht werden. FlowCondition-Nodes benutzen `startAnchorType: 'right'` (True-Branch) und `startAnchorType: 'bottom'` (False-Branch), zusammen mit den Flags `isTrueBranch`/`isFalseBranch`. Alle drei Varianten müssen als OR-Bedingung geprüft werden. Ohne dies bleiben die `body`/`elseBody`-Arrays leer und keine Aktion wird ausgeführt.
- **FlowEditor isDirty-Guard – IMMER `syncToProjectIfDirty()` verwenden**: Externe Aufrufer (EditorViewManager, EditorDataManager) dürfen NICHT direkt `syncToProject()` aufrufen, da dies die `actionSequence` überschreibt — auch wenn keine Änderungen vorgenommen wurden. Stattdessen `syncToProjectIfDirty()` verwenden, das nur synchronisiert wenn `isFlowDirty === true`. Nur interne Service-Manager (FlowInteractionManager, FlowNodeFactory, etc.) rufen `syncToProject()` direkt auf, weil diese immer nach einer echten Benutzer-Interaktion feuern.

## Fachliche Dokumentation
Ausführliche Details findest du in den spezialisierten Dokumenten:

- [🏗️ Architektur & Module](docs/architecture.md)
- [⚙️ Runtime & Execution](docs/runtime-guide.md)
- [📂 Coding Standards](docs/coding-standards.md)
- [🖥️ UI & Inspector Guide](docs/ui-inspector-guide.md)
- [🔍 UseCase Index](docs/use_cases/UseCaseIndex.txt)

## Tooling
- **Tests**: `npm run test`
- **Validierung**: `npm run validate`
- **Build**: `npm run build`
- **Runtime Bundle**: `npm run bundle:runtime` (Zwingend nach Runtime-Änderungen!)

## AI Agent Integration
- [🤖 AI Agent Integration Plan](docs/AI_Agent_Integration_Plan.md)
- [⚡ Flow Safety (Self-Healing)](docs/coding-standards.md#ai-agent-api--flow-safety)

## 7. LOGGING & DIAGNOSE
- **Keine `console.log`**: Verwende NIEMALS `console.log`, `console.warn` or `console.error` direkt im Code.
- **Logger-Pflicht**: Nutze immer den zentralen Logger: `private static logger = Logger.get('ClassName', 'UseCaseId');`.
- **UseCases**: Ordne Logs immer einem funktionalen UseCase zu (siehe `UseCaseManager.ts`).
- **Fehler**: `logger.error` wird immer angezeigt. `debug/info/warn` nur, wenn der UseCase im Inspector aktiv ist.
- **Circular Deps**: Wenn ein Utility-Modul den Logger braucht, achte darauf, dass keine kreisförmigen Abhängigkeiten entstehen (siehe Filter-Pattern in `Logger.ts`).

---
---
- **DO NOT**: Verwende NIEMALS Case-Sensitive Typ-Prüfungen für Flow-Elemente (immer `.toLowerCase()` nutzen).
- **DO NOT**: Vergesse NIEMALS die `projectRef` Zuweisung in der `FlowNodeFactory` für neue Knoten-Typen.
- **DO NOT**: Vergesse NIEMALS, beim Löschen von Actions (`deleteAction`) alle Sub-Typen wie `DataAction` oder `HttpAction` im Filter zu berücksichtigen, um verwaiste Knoten-Reste in Flow-Charts zu vermeiden.
- **DO NOT**: Verlasse dich bei der Referenzprüfung (`ProjectRegistry`) niemals auf exakte Typ-Übereinstimmungen ohne Normalisierung (Bugfix v3.15.2).
- **DO NOT**: Vergiss NIEMALS, dass `EditorCommandManager.findObjectById` Objekte via String-Namen auflösen muss, wenn UI-Handler (wie `InspectorActionHandler` oder `FlowContextMenuProvider`) ein Umbenennen triggern. Es muss sichergestellt werden, dass Basis-Tasks/Actions dort als Entity gefunden werden, sonst greift das projektweite Refactoring ins Leere and nur das isolierte JSON-Objekt ändert seinen Namen (Bugfix v3.15.3).
- **DO NOT**: Vergiss NIEMALS beim Erstellen neuer Komponenten den `case 'TKomponente':` in `Serialization.ts` -> `hydrateObjects()` hinzuzufügen! Fehlt dieser Case, verschwindet die Komponente beim Laden/Reload.
- **DO NOT**: Verlasse dich NIEMALS darauf, dass `InspectorEventHandler.getOriginalObject()` FlowNodes (FlowAction/FlowTask) findet! Diese haben UUIDs als `.id`, die nicht in `project.actions`/`project.tasks` vorkommen. Die Persistenz für FlowNodes erfolgt AUSSCHLIESSLICH über `FlowNodeHandler.handlePropertyChange()`.
- **Action-Persistenz & Suche (v3.11.x)**:
  - **Index-Lookup**: Nutze für die Suche nach Action- oder Task-Definitionen immer die `ProjectRegistry.getActions('all')` bzw. `getTasks('all')`. Dies stellt sicher, dass Sie Referenzen auf die *Original-Objekte* im RAM erhalten (SSoT-Prinzip), wodurch Änderungen direkt in die `project.json` fließen.
  - **Broad-Field Matching**: Da Fly-Actions in Diagrammen oft unvollständige Daten haben (z.B. nur `actionName` statt `name`), muss die Suche robust über mehrere Felder erfolgen (`data.actionName`, `data.name`, `properties.name`, `properties.text`). Siehe Implementierung in `FlowNodeHandler.findActionDefinition`.
  - **Case-Insensitivity**: Vergleiche Namen immer Case-Insensitive und verwende `.trim()`, um Tippfehler abzufangen.
  - **Bereinigung**: Verlasse dich bei der Datenintegrität auf den `SanitizationService`. Er entfernt automatisch verwaiste Action-Referenzen aus Sequenzen, falls die Definition gelöscht wurde.

- **Stattdessen**: Editoren (wie EditorInteractionManager) müssen über Hilfsfunktionen wie getOriginalObject auf das originale JSON-Objekt im Speicher zugreifen und nur dort spezifische Eigenschaften (wie x, y, width, height) aktualisieren, **bevor** der Autosave angestoßen wird.

- **Speichermanagement (v3.10.x)**:
  - **Kein automatischer Disk-Save**: `EditorDataManager.updateProjectJSON` sichert Änderungen NUR noch im `LocalStorage` (Crash-Schutz). Das echte Speichern auf Disk (Server-Fetch) erfolgt AUSSCHLIESSLICH manuell durch den Nutzer über `saveProject()`.
  - **Dirty-Flag Pflicht**: Jede Änderung am Projekt MUSS das `isProjectDirty` Flag des ViewManagers (oder Hosts) auf `true` setzen. Dies geschieht in der Regel automatisch über das `MediatorEvents.DATA_CHANGED` Event.
  - **Zustands-Reset**: Nach erfolgreichem `saveProject` (auf Disk) oder `loadProject` MUSS das `isProjectDirty` Flag zwingend wieder auf `false` gesetzt werden.
  - **Initial-Load Originator**: Beim ersten Laden eines Projekts (oder Erstellen eines Default-Projekts) muss `mediatorService.notifyDataChanged(project, 'editor-load')` aufgerufen werden. Der Originator `editor-load` verhindert, dass das Dirty-Flag fälschlicherweise sofort auf `true` springt (v3.11.4).

Letzte Aktualisierung: v3.9.6 (E2E-Stability & Hydration Fix)

## Flow-Editor & Verbindungen (v3.9.7)
- **Floating Connections**: Verbindungen ohne startTargetId / endTargetId müssen unterstützt werden. Der FlowGraphHydrator nutzt die Koordinaten (startX, startY) als Fallback, wenn keine Node-Zuweisung existiert.
- **Drag-Stabilität**: Während des Ziehens von Verbindungen muss pointer-events: none auf die Linie gesetzt werden, damit die Anchor-Punkte darunterliegender Nodes erreichbar bleiben.
- **Race-Conditions**: Vermeide autoSaveToLocalStorage während des aktiven Drag-Vorgangs. Verschiebe die globale Selektion (selectConnection) auf den Zeitpunkt **nach** dem AttachEnd.
- **Logging**: Nutze das Präfix [TRACE] für die Synchronisierungs-Pipeline (SyncManager/Hydrator/Manager).

- [2026-03-05] Rendering & Scaling: Neue UI-Komponenten (TDataList) müssen explizit im StageRenderer registriert sein. Die cellSize wird beim Laden der Stage im UniversalPlayer synchronisiert.

## Run-Mode Layout & Sichtbarkeit (v3.9.15)
- **Koordinaten & Dimensionen**: In GameRuntime.getObjects() müssen Bindings für x, y, width und height explizit via resolveCoord aufgelöst werden, um NaN-Fehler bei der Layout-Berechnung im Renderer zu vermeiden.
- **Blueprint-Objekte**: Service-Objekte (z.B. `StageController`) und globale Variablen werden im Renderer (`StageRenderer.ts`) nur angezeigt, wenn die aktuelle Stage die `blueprint`-Stage ist (`this.host.isBlueprint`). Auf regulären Stages bleiben diese Elemente ausgeblendet (v3.11.4).
- **Variablen-Visualisierung**: Variablen auf der Stage zeigen standardmäßig ihren Namen und den aktuellen Wert in Klammern an. Im Inspector werden diese einheitlich als Textfelder (`TEdit`) dargestellt (Nutzerpräferenz für explizite Werten wie "true"/"false").
- **Stage-Vererbung**: Nutze NIEMALS inheritsFrom für Stage-zu-Stage Vererbung. Nur der Blueprint-Merge ist als globale Basis erlaubt.

## 8. ANTI-PATTERNS (DO NOT)
- **Dummy-Tests**: KEINE Tests erstellen, die Logik nur simulieren (Mocks), statt die realen Engines (`GameRuntime`, `TaskExecutor`) zu nutzen.
- **Rename-Vakuum**: NIEMALS Namen im Inspector ändern, ohne den `RefactoringManager` für die systemweite Synchronisation zu triggern.
- **ID-Instabilität**: NIEMALS Namen als Primärschlüssel für Flow-Diagramme verwenden, wenn eine Umbenennung droht (Sync-Bridge nutzen).
- **Placeholder**: KEINE "// ... restlicher Code" Kommentare hinterlassen. Jede Datei muss vollständig sein.
- **JSON Syntax & Validation**: NIEMALS manuell generierte oder modifizierte JSON-Dateien ungetestet übergeben. IMMER mit `node -e "require('./path.json')"` validieren, um versehentliche Skript-Killer (wie `]` statt `}`) zu vermeiden.
- **Action Scopes (Blueprint vs Main)**: Actions MÜSSEN zwingend in demselben `actions`-Array der Stage liegen wie die Tasks, die sie verwenden. Ruft ein Blueprint-Task eine Main-Stage-Action auf, findet der FlowEditor diese nicht und generiert kaputte Fallback-Dummys (`auto_action_0...`).
- **Property-Action Format**: Die `changes`-Eigenschaft einer `type: "property"` Action speichert die Änderungen als klassisches Schlüssel-Wert-Objekt (z.B. `changes: { "velocityY": 0.5 }`). Als `target` wird der visuelle **Name** des Zielobjekts (z.B. `"LeftPaddle"`) gespeichert, was der FlowAction Parser voraussetzt!
- **Ghost-Sprites (Kollision)**: `collisionEnabled` ist standardmäßig `false`. Will man Bounce- oder Hit-Events, MUSS explizit `"collisionEnabled": true` im JSON (unter `properties`) gesetzt sein, andernfalls fliegen Objekte wie Geister nacheinander durch und bleiben ggf. am Map-Rand kleben.
- **Object-Conditions vs String-Conditions**: Nutze bevorzugt nativ geparste String-Conditions (z.B. `"condition": "${hitSide} == 'top'"`) anstatt nackter Objekt-Conditions. Bei Objekt-Conditions werden Literal-Werte (`"rightValue": "'top'"`) im `TaskConditionEvaluator` NICHT von ihren Single-Quotes bereinigt, was zu stillschweigenden Evaluierungs-Fehlern (`"top" === "'top'" -> false`) und unleserlichen Debug-Logs (`undefined == "undefined"`) führt!
## 9. BEST PRACTICES (NEU)
- **Interface Konsistenz**: Host-Objekte für Manager-Klassen (z.B. `EditorDataManager`) müssen ihre Anforderungen in einem dedizierten Interface definieren. Stellen Sie sicher, dass der `Editor` (oder andere Hosts) dieses Interface vollständig implementiert, um Laufzeitfehler wie `TypeError` zu vermeiden. Siehe Fix in `EditorViewManager.ts` (`IViewHost`).

## 10. FLOW-EDITOR REGELN (E2E Testing & API)

### switchActionFlow & Task-Knoten
- **`switchActionFlow(taskName)` erzeugt automatisch** einen Task-Knoten als Startpunkt (via `generateFlowFromActionSequence()`). KEIN weiteres `createNode('Task', ...)` aufrufen!
- Ein zweites `createNode('Task', ...)` im gleichen Kontext erzeugt **ZWEI** Task-Knoten. `syncTaskFromFlow` findet nur den **ersten** (per `elements.find(e => e.type === 'task')`) → der hat keine Connection → leere `actionSequence`.
- **Korrekt**: `nodes.find(n => n.getType() === 'task')` nutzen um den auto-generierten Knoten zu referenzieren.

### Task/Action Speicherort
- Tasks und Actions gehören in `stage.tasks` / `stage.actions` der **aktiven Stage** (z. B. `mainStage`).
- Globale Elemente gehören in die **Blueprint-Stage** (`s.type === 'blueprint'` oder `s.id === 'stage_blueprint'` oder `s.id === 'blueprint'`).
- **DO NOT**: Niemals `project.tasks`, `project.actions` oder `project.variables` (Root-Level) verwenden. Diese Arrays existieren zwar noch im Type, dürfen aber nicht mehr beschrieben werden.
- `migrateRootToBlueprint()` (FlowEditor) migriert beim Laden automatisch Legacy-Daten von Root in die Blueprint-Stage.
- Fallback-Logik: Wenn keine `activeStage` vorhanden, immer `getBlueprintStage()` statt Root-Level nutzen.

### restoreConnection API
- `restoreConnection({ id, startTargetId, endTargetId, startX, startY, endX, endY, data: { startAnchorType, endAnchorType } })`
- `startTargetId`/`endTargetId` = `node.id` (UUID wie `node-1234567890`)
- Muss **nach** `createNode` aufgerufen werden, damit die Nodes im `this.host.nodes[]` Array vorhanden sind.

### syncTaskFromFlow Traversierung
- `startNode = elements.find(e => type === 'task')` → Task-Knoten als Startpunkt
- `initialOutgoing = connections.filter(c => c.startTargetId === startNode.id)` → alle ausgehenden Verbindungen
- Von jedem Ziel wird `buildSequence(targetId)` aufgerufen → fügt Actions zur Sequenz hinzu
- `actionName = node.data?.name || node.properties?.name` für Action-Knoten

## Architektur-Hinweise (Sync-Strategie)

> [!IMPORTANT]
> **JSON ist die einzige Wahrheit (SSoT).** Alle Editoren (Flow, Inspector, Pascal) schreiben Änderungen in die JSON-Daten. Aus JSON werden Stages und Flow-Diagramme beim Laden erzeugt. Ein Teil der JSON-Daten dient dem Standalone-Player und der Game-Engine.

- **Aktueller Zustand (2026-03-10):** Bidirektionaler Sync zwischen Flow-Graph-Objekten ↔ JSON (`FlowSyncManager.ts`, 48KB). Funktioniert, war aber in der Vergangenheit fehleranfällig (Action-Typen, Namen, Duplikate).
- **Ziel-Architektur (bei zukünftigem Refactoring):** Unidirektionaler Datenfluss — Editoren schreiben direkt JSON-Patches, Views rendern nur aus JSON. Dadurch entfällt die Rück-Synchronisation.
- **Analysebericht:** Siehe Artefakt `implementation_plan.md` vom 2026-03-10 (Verwaister Code, Redundanzen, Vereinfachungsvorschläge).
- **Pragmatik:** Solange Sync stabil läuft → nicht anfassen. Tests (`npm run test`) sind das Sicherheitsnetz. Bei erneuten Sync-Problemen → unidirektionalen Umbau priorisieren.

## 11. LLM-TRAININGSDATEN-PFLICHT

> [!IMPORTANT]
> Ziel: Ein lokales kleines LLM (3-7B Parameter) finetunen, das aus natürlicher Sprache GCS-Komponenten über die `AgentController`-API erzeugt.

- **Export-Trigger:** Nach jeder Feature-Implementierung, die neue Komponenten, Tasks oder Actions erzeugt, MUSS der `TrainingDataExporter` (`src/tools/TrainingDataExporter.ts`) ausgeführt werden.
- **Format:** JSONL mit Paaren aus natürlichsprachigem Input und AgentController-API-Aufrufen:
  ```jsonl
  {"input": "Erstelle ein Login-Formular", "output": [{"method":"addObject","params":[...]}]}
  ```
- **Speicherort:** `data/training/` Verzeichnis im Projektroot.
- **Varianten:** Pro Use Case mindestens 3 natürlichsprachige Varianten des Inputs erzeugen.
- **Validierung:** Jeder Output muss gegen `src/tools/agent-api-schema.json` validierbar sein.
- **Constrained Decoding:** Bei der Inferenz wird das JSON-Schema genutzt, um nur gültige API-Aufrufe zu erzeugen (z.B. via llama.cpp Grammar oder Outlines).
- **Tooling:** QLoRA-Finetuning mit [Unsloth](https://github.com/unslothai/unsloth), Modelle: Phi-3-mini (3.8B) oder Qwen2.5-7B.

