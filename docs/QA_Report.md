# 🛡️ QA Test Report

**Generiert am**: 9.3.2026, 18:08:41
**Status**: ❌ FEHLER GEFUNDEN

## 📊 Visuelle Übersicht
```mermaid
pie title Test-Status (Gesamt: 77)
    "Bestanden ✅" : 76
    "Fehlgeschlagen ❌" : 1
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
| Action Create<br><small>Action erfolgreich in Projekt-Liste erstellt.</small> | ActionCRUD | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Action Read<br><small>Action-Eigenschaften korrekt gelesen.</small> | ActionCRUD | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Action Update (Rename)<br><small>Refactoring erfolgreich: Task & FlowChart aktualisiert.</small> | ActionCRUD | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Action Delete<br><small>Aktion (Normal & Data) restlos entfernt.</small> | ActionCRUD | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| should resolve numeric bindings in x and y coordinates | Happy Path | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| should resolve numeric bindings in width and height | Happy Path | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| should handle nested math in coordinates | Happy Path | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Hydrate: TButton<br><small>className=TButton, name=TestButton, caption=Klick mich</small> | Serialization | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Hydrate: TIntegerVariable<br><small>className=TIntegerVariable, value=42, isVariable=true</small> | Serialization | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Hydrate: isVariable bleibt true<br><small>isVariable=true</small> | Serialization | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Hydrate: Unknown Class (kein Crash)<br><small>Ergebnis-Länge=0 (erwartet: 0)</small> | Serialization | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Hydrate: Round-Trip (toJSON → hydrate)<br><small>name=MyShape, x=50, text=⭐</small> | Serialization | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Hydrate: Container mit Children<br><small>Children-Anzahl=2, Typen=[TButton, TLabel]</small> | Serialization | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Hydrate: Events/Tasks-Fallback<br><small>events.onClick=DoLogin</small> | Serialization | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Hydrate: Style-Merge<br><small>bgColor=#333, borderRadius=8px</small> | Serialization | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Rename Task: AttemptLogin → DoLogin<br><small>Task=true, Event=true, ObjEvent=true, FlowChart=true</small> | Refactoring | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Rename Action: ValidatePin → CheckPinCode<br><small>Action=true, Sequence=true, Flow=false</small> | Refactoring | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Rename Variable: currentUser → activeUser<br><small>Var=true, Formula=true, ResultVar=true</small> | Refactoring | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Rename Object: LoginButton → SignInButton<br><small>Object=true, ActionTarget=true</small> | Refactoring | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Delete Task: AttemptLogin<br><small>TaskGone=true, EventCleared=true, FlowChartGone=true, ObjEventCleared=true</small> | Refactoring | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Delete Action: SetupVars<br><small>ActionGone=true, SequenceCleaned=true</small> | Refactoring | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Delete Variable: pin<br><small>VariableGone=true</small> | Refactoring | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Usage Report: AttemptLogin<br><small>Referenzen=1, Orte=1</small> | Refactoring | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
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
| Projekt laden<br><small>Stages: 2</small> | Integrity | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
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
| E2E: Use Case: Komponente & Inspector (D&D, Rename, JSON Sync, Delete)<br><small>Browser: chromium - Fehler</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| E2E: Use Case: Flow-Editor & Refactoring (Task/Action, Linking, JSON)<br><small>Browser: chromium - Fehler</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| E2E: Use Case: Run-Mode & Execution<br><small>Browser: chromium - Fehler</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| E2E: Use Case: Stage-Switch-Action (Anforderung 4)<br><small>Browser: chromium - Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoContainText[2m([22m[32mexpected[39m[2m)[22m failed

Locator: locator('#debug-log-panel')
Timeout: 15000ms
[32m- Expected substring  -   1[39m
[31m+ Received string     + 118[39m

[32m- TStageController[39m
[31m+ DEBUG LOG VIEWER✕[39m
[31m+ [43m            [49m[39m
[31m+                  Event[39m
[31m+                  Task[39m
[31m+                  Action[39m
[31m+                  Variable[39m
[31m+                  Condition[39m
[31m+                  System[39m
[31m+                  Details[39m
[31m+ [43m            [49m[39m
[31m+ [43m            [49m[39m
[31m+                 All ObjectsButton_12Label_13LocalStoreToasterUserDataassignedPlayerscurrentPINcurrentRoomAdminUserscurrentUsergameQueue🖥️ API Server[39m
[31m+                 All Events[39m
[31m+ [43m            [49m[39m
[31m+ [43m            [49m[39m
[31m+                 Clear All[39m
[31m+                 Pause[39m
[31m+ [43m            [49m[39m
[31m+ [43m        [49m[39m
[31m+ [43m             [49m[39m
[31m+ [43m            [49m[39m
[31m+ [43m                [49m[39m
[31m+                     [Variable] 🖥️ API Server.style changed: {"backgroundColor":"#1a1a2e","borderColor":"#4fc3f -> {"backgroundColor":"#1a1a2e","borderColor":"#4fc3f[39m
[31m+ [43m                [49m[39m
[31m+ [43m                [49m[39m
[31m+ [43m            [49m[39m
[31m+             06:08:20 PM[39m
[31m+ [43m        [49m[39m
[31m+ [43m             [49m[39m
[31m+ [43m            [49m[39m
[31m+ [43m                [49m[39m
[31m+                     [Variable] UserData.style changed: {"backgroundColor":"#2c3e50","borderColor":"#bdc3c -> {"backgroundColor":"#2c3e50","borderColor":"#bdc3c[39m
[31m+ [43m                [49m[39m
[31m+ [43m                [49m[39m
[31m+ [43m            [49m[39m
[31m+             06:08:20 PM[39m
[31m+ [43m        [49m[39m
[31m+ [43m             [49m[39m
[31m+ [43m            [49m[39m
[31m+ [43m                [49m[39m
[31m+                     [Variable] Toaster.style changed: {"backgroundColor":"transparent","borderColor":"tr -> {"backgroundColor":"transparent","borderColor":"tr[39m
[31m+ [43m                [49m[39m
[31m+ [43m                [49m[39m
[31m+ [43m            [49m[39m
[31m+             06:08:20 PM[39m
[31m+ [43m        [49m[39m
[31m+ [43m             [49m[39m
[31m+ [43m            [49m[39m
[31m+ [43m                [49m[39m
[31m+                     [Variable] LocalStore.style changed: {"backgroundColor":"#2c3e50","borderColor":"#bdc3c -> {"backgroundColor":"#2c3e50","borderColor":"#bdc3c[39m
[31m+ [43m                [49m[39m
[31m+ [43m                [49m[39m
[31m+ [43m            [49m[39m
[31m+             06:08:20 PM[39m
[31m+ [43m        [49m[39m
[31m+ [43m             [49m[39m
[31m+ [43m            [49m[39m
[31m+ [43m                [49m[39m
[31m+                     [Variable] currentPIN.style changed: {"backgroundColor":"#2c3e50","borderColor":"#bdc3c -> {"backgroundColor":"#2c3e50","borderColor":"#bdc3c[39m
[31m+ [43m                [49m[39m
[31m+ [43m                [49m[39m
[31m+ [43m            [49m[39m
[31m+             06:08:20 PM[39m
[31m+ [43m        [49m[39m
[31m+ [43m             [49m[39m
[31m+ [43m            [49m[39m
[31m+ [43m                [49m[39m
[31m+                     [Variable] assignedPlayers.style changed: {"backgroundColor":"#009688","borderColor":"#00796 -> {"backgroundColor":"#009688","borderColor":"#00796[39m
[31m+ [43m                [49m[39m
[31m+ [43m                [49m[39m
[31m+ [43m            [49m[39m
[31m+             06:08:20 PM[39m
[31m+ [43m        [49m[39m
[31m+ [43m             [49m[39m
[31m+ [43m            [49m[39m
[31m+ [43m                [49m[39m
[31m+                     [Variable] gameQueue.style changed: {"backgroundColor":"#009688","borderColor":"#00796 -> {"backgroundColor":"#009688","borderColor":"#00796[39m
[31m+ [43m                [49m[39m
[31m+ [43m                [49m[39m
[31m+ [43m            [49m[39m
[31m+             06:08:20 PM[39m
[31m+ [43m        [49m[39m
[31m+ [43m             [49m[39m
[31m+ [43m            [49m[39m
[31m+ [43m                [49m[39m
[31m+                     [Variable] currentUser.style changed: {"backgroundColor":"#d1c4e9","borderColor":"#9575c -> {"backgroundColor":"#d1c4e9","borderColor":"#9575c[39m
[31m+ [43m                [49m[39m
[31m+ [43m                [49m[39m
[31m+ [43m            [49m[39m
[31m+             06:08:20 PM[39m
[31m+ [43m        [49m[39m
[31m+ [43m             [49m[39m
[31m+ [43m            [49m[39m
[31m+ [43m                [49m[39m
[31m+                     [Variable] currentRoomAdminUsers.style changed: {"backgroundColor":"#d1c4e9","borderColor":"#9575c -> {"backgroundColor":"#d1c4e9","borderColor":"#9575c[39m
[31m+ [43m                [49m[39m
[31m+ [43m                [49m[39m
[31m+ [43m            [49m[39m
[31m+             06:08:20 PM[39m
[31m+ [43m        [49m[39m
[31m+ [43m             [49m[39m
[31m+ [43m            [49m[39m
[31m+ [43m                [49m[39m
[31m+                     [Variable] Button_12.style changed: {"backgroundColor":"#007bff","borderColor":"#00000 -> {"backgroundColor":"#007bff","borderColor":"#00000[39m
[31m+ [43m                [49m[39m
[31m+ [43m                [49m[39m
[31m+ [43m            [49m[39m
[31m+             06:08:20 PM[39m
[31m+ [43m        [49m[39m
[31m+ [43m             [49m[39m
[31m+ [43m            [49m[39m
[31m+ [43m                [49m[39m
[31m+                     [Variable] Label_13.style changed: {"backgroundColor":"transparent","borderColor":"tr -> {"backgroundColor":"transparent","borderColor":"tr[39m
[31m+ [43m                [49m[39m
[31m+ [43m                [49m[39m
[31m+ [43m            [49m[39m
[31m+             06:08:20 PM[39m
[31m+ [43m        [49m[39m

Call log:
[2m  - Expect "toContainText" with timeout 15000ms[22m
[2m  - waiting for locator('#debug-log-panel')[22m
[2m    18 × locator resolved to <div id="debug-log-panel">…</div>[22m
[2m       - unexpected value "DEBUG LOG VIEWER✕[22m
[2m            [22m
[2m                 Event[22m
[2m                 Task[22m
[2m                 Action[22m
[2m                 Variable[22m
[2m                 Condition[22m
[2m                 System[22m
[2m                 Details[22m
[2m            [22m
[2m            [22m
[2m                All ObjectsButton_12Label_13LocalStoreToasterUserDataassignedPlayerscurrentPINcurrentRoomAdminUserscurrentUsergameQueue🖥️ API Server[22m
[2m                All Events[22m
[2m            [22m
[2m            [22m
[2m                Clear All[22m
[2m                Pause[22m
[2m            [22m
[2m        [22m
[2m             [22m
[2m            [22m
[2m                [22m
[2m                    [Variable] 🖥️ API Server.style changed: {"backgroundColor":"#1a1a2e","borderColor":"#4fc3f -> {"backgroundColor":"#1a1a2e","borderColor":"#4fc3f[22m
[2m                [22m
[2m                [22m
[2m            [22m
[2m            06:08:20 PM[22m
[2m        [22m
[2m             [22m
[2m            [22m
[2m                [22m
[2m                    [Variable] UserData.style changed: {"backgroundColor":"#2c3e50","borderColor":"#bdc3c -> {"backgroundColor":"#2c3e50","borderColor":"#bdc3c[22m
[2m                [22m
[2m                [22m
[2m            [22m
[2m            06:08:20 PM[22m
[2m        [22m
[2m             [22m
[2m            [22m
[2m                [22m
[2m                    [Variable] Toaster.style changed: {"backgroundColor":"transparent","borderColor":"tr -> {"backgroundColor":"transparent","borderColor":"tr[22m
[2m                [22m
[2m                [22m
[2m            [22m
[2m            06:08:20 PM[22m
[2m        [22m
[2m             [22m
[2m            [22m
[2m                [22m
[2m                    [Variable] LocalStore.style changed: {"backgroundColor":"#2c3e50","borderColor":"#bdc3c -> {"backgroundColor":"#2c3e50","borderColor":"#bdc3c[22m
[2m                [22m
[2m                [22m
[2m            [22m
[2m            06:08:20 PM[22m
[2m        [22m
[2m             [22m
[2m            [22m
[2m                [22m
[2m                    [Variable] currentPIN.style changed: {"backgroundColor":"#2c3e50","borderColor":"#bdc3c -> {"backgroundColor":"#2c3e50","borderColor":"#bdc3c[22m
[2m                [22m
[2m                [22m
[2m            [22m
[2m            06:08:20 PM[22m
[2m        [22m
[2m             [22m
[2m            [22m
[2m                [22m
[2m                    [Variable] assignedPlayers.style changed: {"backgroundColor":"#009688","borderColor":"#00796 -> {"backgroundColor":"#009688","borderColor":"#00796[22m
[2m                [22m
[2m                [22m
[2m            [22m
[2m            06:08:20 PM[22m
[2m        [22m
[2m             [22m
[2m            [22m
[2m                [22m
[2m                    [Variable] gameQueue.style changed: {"backgroundColor":"#009688","borderColor":"#00796 -> {"backgroundColor":"#009688","borderColor":"#00796[22m
[2m                [22m
[2m                [22m
[2m            [22m
[2m            06:08:20 PM[22m
[2m        [22m
[2m             [22m
[2m            [22m
[2m                [22m
[2m                    [Variable] currentUser.style changed: {"backgroundColor":"#d1c4e9","borderColor":"#9575c -> {"backgroundColor":"#d1c4e9","borderColor":"#9575c[22m
[2m                [22m
[2m                [22m
[2m            [22m
[2m            06:08:20 PM[22m
[2m        [22m
[2m             [22m
[2m            [22m
[2m                [22m
[2m                    [Variable] currentRoomAdminUsers.style changed: {"backgroundColor":"#d1c4e9","borderColor":"#9575c -> {"backgroundColor":"#d1c4e9","borderColor":"#9575c[22m
[2m                [22m
[2m                [22m
[2m            [22m
[2m            06:08:20 PM[22m
[2m        [22m
[2m             [22m
[2m            [22m
[2m                [22m
[2m                    [Variable] Button_12.style changed: {"backgroundColor":"#007bff","borderColor":"#00000 -> {"backgroundColor":"#007bff","borderColor":"#00000[22m
[2m                [22m
[2m                [22m
[2m            [22m
[2m            06:08:20 PM[22m
[2m        [22m
[2m             [22m
[2m            [22m
[2m                [22m
[2m                    [Variable] Label_13.style changed: {"backgroundColor":"transparent","borderColor":"tr -> {"backgroundColor":"transparent","borderColor":"tr[22m
[2m                [22m
[2m                [22m
[2m            [22m
[2m            06:08:20 PM[22m
[2m        "[22m
</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | Abgelehnt | ❌ |
| E2E: sollte den Editor korrekt laden<br><small>Browser: chromium - Fehler</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| E2E: sollte zwischen Views umschalten können<br><small>Browser: chromium - Fehler</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| E2E: sollte die Komponenten-Palette in der Toolbox anzeigen<br><small>Browser: chromium - Fehler</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| E2E: Kompletter Flow: Erzeugung, Metadata, Dirty-Check, Stages & Grid<br><small>Browser: chromium - Fehler</small> | E2E Browser | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |

---
*Hinweis: Dieser Bericht wurde automatisch vom GCS Regression Test Runner erstellt.*