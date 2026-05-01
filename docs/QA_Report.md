# 🛡️ QA Test Report

**Generiert am**: 1.5.2026, 17:13:36
**Status**: ❌ FEHLER GEFUNDEN

## 📊 Visuelle Übersicht
```mermaid
pie title Test-Status (Gesamt: 195)
    "Bestanden ✅" : 193
    "Fehlgeschlagen ❌" : 2
```

## 🧪 Test-Details
| Test-Fall | Kategorie | Typ | Erwartet | Ergebnis | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TestUser Login | Happy Path | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Admin Login | Happy Path | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Bug User Login | Edge Case | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Ungültiger PIN | Security | 🛡️ **Schlecht-Test** | Abgelehnt | Abgelehnt | ✅ |
| Teil-Eingabe (Prefix) | Security | 🛡️ **Schlecht-Test** | Abgelehnt | Abgelehnt | ✅ |
| SmartMapping: Root Extraction<br><small>Path: </small> | Smart Mapping | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| SmartMapping: Single Level<br><small>Path: success</small> | Smart Mapping | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| SmartMapping: Nested Level<br><small>Path: data.user</small> | Smart Mapping | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| SmartMapping: Deep Property<br><small>Path: data.user.name</small> | Smart Mapping | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| SmartMapping: Invalid Path<br><small>Path: data.unknown</small> | Smart Mapping | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Discovery: DB Keys found<br><small>Keys: users, cities, houses, rooms, games, instances</small> | Discovery | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Discovery: Users collection exists | Discovery | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Unification: PropertyHelper Traversal<br><small>Value: Rolf (Expected: 'Rolf')</small> | Smart Mapping | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Unification: ExpressionParser Interpolation<br><small>Result: Hello Rolf</small> | Smart Mapping | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Unification: Source-Level Unwrapping (Sim)<br><small>Type: object, IsArray: false</small> | Smart Mapping | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Unification: Deep Path Auto-Unwrap<br><small>Version: 123</small> | Smart Mapping | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TTable: Smart-Unwrap TObjectList<br><small>Data: 1, Cols: 1 (Inherited: Name)</small> | Smart Mapping | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TTable: Smart-Unwrap TListVariable<br><small>Data: 2, First: Value 1</small> | Smart Mapping | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TDataAction: SELECT count(*) Only<br><small>Expected: 3, Got: 3</small> | Happy Path | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TDataAction: SELECT id, count(*)<br><small>Expected: Array(3) with count:1, Got: {"id":1,"count":1}</small> | Happy Path | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Action-Registrierung beim Drop<br><small>Action gefunden, Target=Box1</small> | ActionRegistration | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Global Scope Handling<br><small>In Projekt-Aktionen gefunden</small> | ActionRegistration | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Action Create<br><small>Action erfolgreich in Blueprint-Stage erstellt.</small> | ActionCRUD | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Action Read<br><small>Action-Eigenschaften korrekt gelesen.</small> | ActionCRUD | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Action Update (Rename)<br><small>Refactoring erfolgreich: Task & FlowChart aktualisiert.</small> | ActionCRUD | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Action Delete<br><small>Aktion (Normal & Data) restlos entfernt.</small> | ActionCRUD | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| should resolve numeric bindings in x and y coordinates | Happy Path | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| should resolve numeric bindings in width and height | Happy Path | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| should handle nested math in coordinates | Happy Path | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| GameLoopManager Tests | Physics | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| addTaskCall — Gutfall<br><small>Task-Referenz korrekt eingefügt.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| addTaskCall — Schlechtfall<br><small>Fehler korrekt geworfen.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| setTaskTriggerMode — Gutfall<br><small>TriggerMode korrekt gesetzt.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| setTaskTriggerMode — Schlechtfall<br><small>Fehler korrekt geworfen.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| addTaskParam — Gutfall<br><small>2 Parameter korrekt hinzugefügt.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| addTaskParam — Update<br><small>Param aktualisiert, kein Duplikat.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| moveActionInSequence — Gutfall<br><small>Reihenfolge korrekt: B, C, A.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| moveActionInSequence — Schlechtfall<br><small>Fehler korrekt geworfen.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Integration: PingPong via API<br><small>Vollständiges PingPong erstellt: 5 Objekte, 3 Tasks, 2 Variablen, Events gebunden. Validierung: 3 Warnungen, 0 Fehler.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| executeBatch — Gutfall<br><small>4 Ops erfolgreich: Variable + Task + Action + TriggerMode.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| executeBatch — Rollback<br><small>Fehler erkannt + Variable rollbacked.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Integration: Tennis via Batch<br><small>Tennis-Spiel komplett: 20 Batch-Ops, 3 Stages, 6 Objekte, 3 Tasks, 3 Variablen, Events gebunden, Validierung OK.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| createSprite — Gutfall<br><small>Sprite mit Physik-Defaults korrekt erstellt.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| createLabel — Gutfall<br><small>Label mit Binding + Style korrekt erstellt.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| setSpriteCollision — Gutfall<br><small>Collision korrekt gesetzt.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| setSpriteVelocity — Gutfall<br><small>Velocity korrekt gesetzt.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| getComponentSchema — Gutfall<br><small>TSprite: 18 Props, 12 Events. TTimer: 3 Methods. Unknown: null.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Integration: Spiel mit Shortcuts<br><small>5 Objekte (3 Sprites + 2 Labels), 2 Variablen, 1 Task, Event gebunden.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Integration: Raketen-Countdown via Batch<br><small>Vollständiges Raketen-Demo: 20 Batch-Ops, 4 Objekte, 2 Blueprint-Objekte (GameLoop+GameState), 3 Tasks, 6 Actions, 1 Variable, 3 Events, Binding OK. Validierung: 3 Warnungen, 0 Fehler.</small> | RaketenCountdown | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Struktur: Sprite + Task + Action<br><small>Sprite mit velocityY=0, Task mit set_property Action korrekt erstellt.</small> | RaketenCountdown | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Grundstruktur: 2 Stages<br><small>Blueprint + Quiz</small> | MatheQuiz | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Blueprint: GameLoop + GameState<br><small>GameLoop=true, GameState=true</small> | MatheQuiz | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Quiz-Objekte: Random, Score, Timer, Edit<br><small>Zahl1=true, Zahl2=true, Score=true, Timer=true, Edit=true</small> | MatheQuiz | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| 5 Tasks vorhanden<br><small>Tasks: NeueAufgabe, QuizStarten, OnTimerTick, AntwortPruefen, QuizBeenden</small> | MatheQuiz | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| AntwortPruefen: Condition-Branch<br><small>Verzweigung für Richtig/Falsch vorhanden</small> | MatheQuiz | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Bindings: Zahl1Label + ScoreLabel<br><small>Zahl1Label.text="${Zahl1}", ScoreLabel.text="${Score}"</small> | MatheQuiz | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Events: Start, OK, Timer, GameOver<br><small>Start=QuizStarten, OK=AntwortPruefen, Timer=OnTimerTick, Max=QuizBeenden</small> | MatheQuiz | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TaskCall: QuizStarten → NeueAufgabe<br><small>Task-Aufruf vorhanden</small> | MatheQuiz | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| FlowLayouts: Alle 5 Tasks haben Layouts<br><small>5/5 Tasks mit FlowLayout</small> | MatheQuiz | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Validierung: 0 Fehler<br><small>0 Warnungen, 0 Fehler</small> | MatheQuiz | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TVirtualGamepad detects keys from TInputController | VirtualGamepad | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TVirtualGamepad property check | VirtualGamepad | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Hydrate: TButton<br><small>className=TButton, name=TestButton, caption=Klick mich</small> | Serialization | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Hydrate: TIntegerVariable<br><small>className=TIntegerVariable, value=42, isVariable=true</small> | Serialization | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Hydrate: isVariable bleibt true<br><small>isVariable=true</small> | Serialization | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Hydrate: Unknown Class (kein Crash)<br><small>Ergebnis-Länge=0 (erwartet: 0)</small> | Serialization | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Hydrate: Round-Trip (toJSON → hydrate)<br><small>name=MyShape, x=50, text=⭐</small> | Serialization | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Hydrate: Container mit Children<br><small>Children-Anzahl=2, Typen=[TButton, TLabel]</small> | Serialization | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Hydrate: Events/Tasks-Fallback<br><small>events.onClick=DoLogin</small> | Serialization | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Hydrate: Style-Merge<br><small>bgColor=#333, borderRadius=8px</small> | Serialization | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Hydrate: TSprite ImageList<br><small>imageListId=imglist_hero, imageIndex=2</small> | Serialization | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Hydrate: Prototype Pollution Regression<br><small>Object.prototype blieb unveraendert</small> | Serialization | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Guard: Component Registrierung (Barrel + Registry)<br><small>Alle 70 Komponenten korrekt registriert</small> | System-Guard | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Guard: DTO-to-Registry Compliance (T-11b)<br><small>Alle serialisierbaren Klassen haben eine Factory</small> | System-Guard | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Guard: Keine unerlaubten console.* Aufrufe<br><small>Erlaubt (Baseline 32), Aktuell: 29</small> | System-Guard | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Guard: Dateigroesse < 1000 Zeilen<br><small>Zu gross: src/editor/EditorViewManager.ts (1164), src/editor/flow/FlowAction.ts (1021), src/editor/inspector/InspectorRenderer.ts (1239), src/editor/inspector/renderers/InspectorSectionRenderer.ts (1001), src/editor/services/StageRenderer.ts (1140), src/runtime/GameRuntime.ts (1108), src/services/AgentController.ts (1302)</small> | System-Guard | 🛡️ **Schlecht-Test** | OK/Erwartet | Abgelehnt | ❌ |
| Guard: bundle:runtime Freshness<br><small>Bundle 3219s veraltet (juengste Quelle: src/runtime/TaskExecutor.ts). Bitte "npm run bundle:runtime" ausfuehren!</small> | System-Guard | 🛡️ **Schlecht-Test** | OK/Erwartet | Abgelehnt | ❌ |
| Guard: Kein new Function() RCE-Risiko<br><small>Sauber</small> | System-Guard | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Rename Task: AttemptLogin → DoLogin<br><small>Task=true, Event=true, ObjEvent=true, FlowChart=true</small> | Refactoring | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Rename Action: ValidatePin → CheckPinCode<br><small>Action=true, Sequence=true, Flow=false</small> | Refactoring | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Rename Variable: currentUser → activeUser<br><small>Var=true, Formula=true, ResultVar=true</small> | Refactoring | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Rename Object: LoginButton → SignInButton<br><small>Object=true, ActionTarget=true</small> | Refactoring | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Delete Task: AttemptLogin<br><small>TaskGone=true, EventCleared=true, FlowChartGone=true, ObjEventCleared=true</small> | Refactoring | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Delete Action: SetupVars<br><small>ActionGone=true, SequenceCleaned=true</small> | Refactoring | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Delete Variable: pin<br><small>VariableGone=true</small> | Refactoring | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Usage Report: AttemptLogin<br><small>Referenzen=2, Orte=2</small> | Refactoring | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Sanitize: Root-Duplikate entfernt<br><small>Root-Tasks nach Sanitize=0</small> | Refactoring | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Execute: Stage-Task → 1 Action<br><small>Ausgeführt: [StageAction]</small> | TaskExecutor | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Execute: Blueprint-Lookup (Hierarchie)<br><small>Ausgeführt: [GlobalAction1, GlobalAction2]</small> | TaskExecutor | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Execute: Unbekannter Task (kein Crash)<br><small>Ausgeführt: 0 (erwartet: 0)</small> | TaskExecutor | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Execute: Action Resolution (Name → Definition)<br><small>Target=LoginBtn (erwartet: LoginBtn)</small> | TaskExecutor | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Execute: Condition TRUE → thenTask<br><small>Ausgeführt: [StageAction]</small> | TaskExecutor | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Execute: Condition FALSE → elseTask<br><small>Ausgeführt: [GlobalAction1, GlobalAction2]</small> | TaskExecutor | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Execute: Max Recursion Depth Guard<br><small>Kein Endlos-Loop</small> | TaskExecutor | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| FlowSync: Elemente = Sequence-Länge<br><small>Flow-Actions=2, Sequence=2</small> | FlowSync | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| FlowSync: Action-Namen konsistent<br><small>Flow=[ResetScore,ShowWelcome], Seq=[ResetScore,ShowWelcome]</small> | FlowSync | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| FlowSync: Keine Blueprint/Stage Task-Duplikate<br><small>Duplikate=[]</small> | FlowSync | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| FlowSync: Connections referenzieren gültige Elemente<br><small>Alle Connections gültig</small> | FlowSync | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| FlowSync: Korrupte Task-Daten erkannt<br><small>Gefunden: 2 korrupte Einträge</small> | FlowSync | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Projekt laden<br><small>Stages: 4</small> | Integrity | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Integrität: Keine verwaisten FlowCharts<br><small>Alle FlowCharts haben Tasks</small> | Integrity | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Integrität: Keine Task-Duplikate<br><small>Keine Duplikate</small> | Integrity | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Integrität: Event→Task-Mappings gültig<br><small>Alle Mappings OK</small> | Integrity | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Integrität: Actions in Sequences definiert<br><small>Alle Actions gefunden</small> | Integrity | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Integrität: Blueprint-Stage vorhanden<br><small>stage_blueprint gefunden</small> | Integrity | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Integrität: Keine korrupten Task-Einträge<br><small>Alle Task-Namen gültig</small> | Integrity | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Integrität: Keine Inline-Actions<br><small>Alle Sequences nutzen Referenzen</small> | Integrity | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Multi-Feld-Matching: Erfasst teil-aktualisierte Knoten<br><small>data.taskName=SolidTask, properties.name=SolidTask</small> | Robustness | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Condition-Update: thenTask/elseTask Referenzen<br><small>thenTask=SolidTask</small> | Robustness | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Case-Insensitivity: Erkennt "task" und "TASK"<br><small>lower=New, upper=New2</small> | Robustness | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| R0: Sauberes Projekt → 0 Verletzungen<br><small>Keine Verletzungen</small> | SyncValidator | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| R1: Verwaiste Action-Referenz erkennen<br><small>Erkannt: Task "BlueprintTask": 1 verwaiste Action-Referenz(en): [NichtExistierendeAction]</small> | SyncValidator | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| R1: Auto-Repair entfernt verwaiste Referenz<br><small>Vorher: 2, Nachher: 1</small> | SyncValidator | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| R2: FlowChart ohne Task erkennen<br><small>Erkannt: Stage "MainStage": FlowChart "PhantomTask" hat keine zugehörige Task-Definition.</small> | SyncValidator | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| R2: Auto-Repair entfernt verwaisten FlowChart<br><small>PhantomTask-Schlüssel entfernt</small> | SyncValidator | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| R3: Kaputte Connection erkennen<br><small>Erkannt: Flow "BlueprintTask": Connection "broken-conn" zeigt auf nicht-existierenden Start-Node "non-existent-node".</small> | SyncValidator | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| R5: Task-Duplikat erkennen<br><small>Erkannt: Task "BlueprintTask" existiert doppelt: in Stage "MainStage" und in Stage "Blueprint".</small> | SyncValidator | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| R6: FlowChart Split-Brain erkennen<br><small>Erkannt: FlowChart "BlueprintTask" existiert sowohl in Root als auch in Stage "Blueprint" — Split-Brain!</small> | SyncValidator | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| R6: Auto-Repair entfernt Root-Duplikat<br><small>Root-FlowChart entfernt, Stage-Version behalten</small> | SyncValidator | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Spot-Validierung: Konsistentes Objekt → 0 Verletzungen<br><small>Keine Desync</small> | SyncValidator | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| SnapshotManager Tests | Undo/Redo | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| ProjectStore Tests | State-Management | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Inspector enthält selectFields<br><small>selectFields: vorhanden</small> | FlowDataAction | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Sektionen-Reihenfolge korrekt<br><small>Erwartet: Allgemein → FROM / Datenquelle → SELECT / Felder → INTO / Ergebnis → WHERE / Filter → HTTP / Request → Aktionen, Gefunden: Allgemein → FROM / Datenquelle → SELECT / Felder → INTO / Ergebnis → WHERE / Filter → HTTP / Request → Aktionen</small> | FlowDataAction | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| dataStore source=dataStores<br><small>Source: dataStores</small> | FlowDataAction | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| queryProperty source=dataStoreFields<br><small>Source: dataStoreFields</small> | FlowDataAction | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| queryProperty type=select<br><small>Type: select</small> | FlowDataAction | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| resultVariable in INTO-Sektion<br><small>Sektion: INTO / Ergebnis</small> | FlowDataAction | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| GROUP_COLORS Mapping<br><small>Einträge: 29, FROM: true, WHERE: true</small> | FlowDataAction | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Erweiterte Operatoren (CONTAINS, IN)<br><small>CONTAINS: true, IN: true</small> | FlowDataAction | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Export-Integrität: GameExporter.ts | Export-Integrität | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Export-Integrität: ProjectPersistenceService.ts | Export-Integrität | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Export-Integrität: player-standalone.ts | Export-Integrität | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Export-Integrität: GameRuntime.ts | Export-Integrität | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Export-Integrität: GameLoopManager.ts | Export-Integrität | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Nested Task Declaration Generation<br><small>Recursive Tasks successfully output</small> | Pascal Generator | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Basis-Import (Objekte, Tasks, Actions, Variables)<br><small>2 Objekte, 1 Task, 2 Actions, 1 Variable korrekt kopiert</small> | Stage-Import | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| ID-Remap (keine Original-IDs)<br><small>Alle IDs neu generiert</small> | Stage-Import | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Blueprint-Merge (GlobalAction + GlobalTimer)<br><small>GlobalAction=true, GlobalTimer=true</small> | Stage-Import | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Duplikat-Schutz (kein Blueprint-Duplikat)<br><small>GlobalAction-Anzahl=1, Stages=4</small> | Stage-Import | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Blueprint → Standard (Type-Konvertierung)<br><small>Type=standard</small> | Stage-Import | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Stage ohne Abhängigkeiten<br><small>1 Objekt, keine Tasks/Actions, Blueprint bleibt leer</small> | Stage-Import | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Events bleiben erhalten (Rakete.onClick)<br><small>onClick=StartCountdown</small> | Stage-Import | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| navigate_stage Auto-Remap<br><small>GoToSpiel.stageId=stage_import_1777648332590_6n (erwartet: stage_import_1777648332590_6n), BackToLobby.stageId=stage_import_1777648332590_1n (erwartet: stage_import_1777648332590_1n)</small> | Stage-Import | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Safe Path Access (Inside UserData) | Security | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Path Traversal Breakout 1 (../ trick) | Security | 🛡️ **Schlecht-Test** | Abgelehnt | Abgelehnt | ✅ |
| Arbitrary Absolute File Path Access | Security | 🛡️ **Schlecht-Test** | Abgelehnt | Abgelehnt | ✅ |
| Temp Directory Access | Security | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Dynamic Whitelist (Dialog File Selection) | Security | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| A1: handleStageChange enthält glm.init()<br><small>GameLoopManager wird bei Stage-Wechsel korrekt re-initialisiert.</small> | StageTransition-Regression | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| A2: slide-up nutzt cellSize-Division<br><small>slide-up Offset wird korrekt durch cellSize geteilt (Grid-Zellen statt Pixel).</small> | StageTransition-Regression | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| A3: handleStageChange KEIN eigener triggerStartAnimation<br><small>Korrekt: Animation wird nur über start() → initMainGame() ausgelöst.</small> | StageTransition-Regression | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| A4: updateSpritePositions dedupliziert via Map<br><small>Map-basierte Deduplizierung vorhanden → kein Rubber-Banding.</small> | StageTransition-Regression | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| A5: shouldAnimate filtert parentId-Kinder<br><small>parentId-Filter aktiv → Kinder reiten auf dem Parent mit (kein Drift).</small> | StageTransition-Regression | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| A6: initMainGame enthält triggerStartAnimation<br><small>Animation wird korrekt in initMainGame ausgelöst (einziger Aufrufpunkt).</small> | StageTransition-Regression | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| B1: TDialogRoot Default-Werte<br><small>Alle Defaults korrekt: modal=true, closable=true, draggable=true, centerOnShow=true, visible=false</small> | StageTransition-Regression | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| B2: show()/hide() Toggle-Zyklus<br><small>show/hide wechseln Sichtbarkeit korrekt, Doppelaufrufe sind idempotent.</small> | StageTransition-Regression | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| B3: close() setzt visible=false<br><small>close() macht Dialog unsichtbar.</small> | StageTransition-Regression | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| B4: cancel() setzt visible=false<br><small>cancel() macht Dialog unsichtbar.</small> | StageTransition-Regression | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| B5: toggle() Zyklus<br><small>toggle() wechselt korrekt: false→true→false→true</small> | StageTransition-Regression | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| B6: toDTO() serialisiert Dialog-Properties<br><small>Alle Properties (modal, closable, draggable, centerOnShow, slideDirection, title, Events) korrekt serialisiert.</small> | StageTransition-Regression | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Defaults und Vererbung (TDialogRoot)<br><small>Alle Defaults korrekt (modal=false, centerOnShow=false).</small> | TSidePanel | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Synchronisation von side und slideDirection<br><small>Eigenschaft panelSide steuert slideDirection mit.</small> | TSidePanel | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Serialisierung toDTO<br><small>Alle Side-Panel Eigenschaften korrekt serialisiert.</small> | TSidePanel | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| DOM Runtime Element<br><small>Methodengarantie: createRuntimeElement ist überladen.</small> | TSidePanel | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TComponent.getEvents includes Hover Events<br><small>Found: onClick, onDoubleClick, onMouseEnter, onMouseLeave, onDragStart, onDragEnd, onDrop, onTouchStart, onTouchMove, onTouchEnd, onFlipMidpoint, onFocus, onBlur</small> | Component Events | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| ComponentRegistry Fallback includes Hover Events<br><small>Found: onClick, onDoubleClick, onMouseEnter, onMouseLeave, onDragStart, onDragEnd, onDrop, onTouchStart, onTouchMove, onTouchEnd</small> | Component Events | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| E2E: Kompletter Flow: Erzeugung, Metadata, Dirty-Check, Stages & Grid<br><small>Browser: chromium</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| E2E: Kompletter Flow: Task erzeugen, umbenennen und Action hinzufügen<br><small>Browser: chromium</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| E2E: Kompletter Flow: Action erzeugen und via Inspector umbenennen<br><small>Browser: chromium</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| E2E: Kompletter Flow: Task→Action Verbindung per Anchor-Drag herstellen<br><small>Browser: chromium</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| E2E: Kompletter Flow: Neue Stage über Menü erzeugen<br><small>Browser: chromium</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| E2E: Kompletter Flow: Action-Typ auf navigate_stage ändern<br><small>Browser: chromium</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| E2E: Kompletter Flow: Button auf MainStage erzeugen und mit run beschriften<br><small>Browser: chromium</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| E2E: MyCoolGame.json auf Disk vollständig validieren<br><small>Browser: chromium</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| E2E: Roundtrip: Werte bleiben nach Speichern und Laden konsistent<br><small>Browser: chromium</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| E2E: sollte den Run-Modus starten und stoppen können<br><small>Browser: chromium</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| E2E: sollte den Run-Modus erneut starten können (Restart)<br><small>Browser: chromium</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| E2E: sollte das Stages-Menü anzeigen<br><small>Browser: chromium</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| E2E: sollte zur Blueprint-Stage wechseln können<br><small>Browser: chromium</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| E2E: sollte nach Stage-Wechsel zurückkehren können<br><small>Browser: chromium</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| E2E: Szenario 1: JSON Import Injection wird vom StageRenderer blockiert<br><small>Browser: chromium</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| E2E: Szenario 2: Inspector UI (Rich-Text Dialog) Injection wird gefiltert<br><small>Browser: chromium</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| E2E: Szenario 3: Laden einer manipulierten externen JSON-Datei (Drag Drop Simulation)<br><small>Browser: chromium</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| E2E: Kein Overlay-Leak nach Dialog-Schließen<br><small>Browser: chromium</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| E2E: Fokus-Restore: Input bleibt editierbar nach Dialog<br><small>Browser: chromium</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| E2E: Delete-Taste in Input löscht keine Stage-Objekte<br><small>Browser: chromium</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| E2E: 3x Dialog-Zyklus: Fokus bleibt stabil<br><small>Browser: chromium</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| E2E: E1: Run-Modus zeigt Objekte innerhalb der Bühne<br><small>Browser: chromium</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| E2E: E2: Objekt-Positionen korrekt nach Animations-Ende<br><small>Browser: chromium</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| E2E: E3: Stage-Wechsel im Run-Modus friert nicht ein<br><small>Browser: chromium</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| E2E: sollte den Editor korrekt laden<br><small>Browser: chromium</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| E2E: sollte zwischen Views umschalten können<br><small>Browser: chromium</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| E2E: sollte die Komponenten-Palette in der Toolbox anzeigen<br><small>Browser: chromium</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| E2E: Memory Game Cards Visible<br><small>Browser: chromium</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |

---
*Hinweis: Dieser Bericht wurde automatisch vom GCS Regression Test Runner erstellt.*