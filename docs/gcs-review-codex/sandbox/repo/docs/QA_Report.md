# 🛡️ QA Test Report

**Generiert am**: 18.10.2026, 11:28:07
**Status**: ❌ FEHLER GEFUNDEN
**Gesamtlauf**: 12.6s

## 📊 Visuelle Übersicht
```mermaid
pie title Test-Status (Gesamt: 404)
    "Bestanden ✅" : 399
    "Fehlgeschlagen ❌" : 5
```

## ⏱ Timing-Übersicht (sortiert nach Dauer)

| Suite | Dauer | Status |
|:---|---:|:---:|
| Spracheingabe und Karteikasten-Quiz | 3059ms | ✅ |
| Code Quality & Security Guards | 2567ms | ✅ |
| CMS SuperAdmin Sponsorverwaltung | 1730ms | ✅ |
| Eigenständiger Aufgabenbereich | 926ms | ✅ |
| Karteikasten-Abenteuer | 750ms | ✅ |
| CMS Sponsor-Berechtigungen und Workflows | 651ms | ✅ |
| CMS UI-Integritaet | 583ms | ✅ |
| Bilder zählen und Turmbau | 581ms | ✅ |
| Externe Stage-Schnittstellen | 442ms | ✅ |
| Lernzielkatalog | 399ms | ✅ |
| Bildpfade in Spielpaketen | 361ms | ✅ |
| AgentScriptIO | 170ms | ✅ |
| Handbuch-HTML | 169ms | ✅ |
| Stage-Transition Regression | 56ms | ✅ |
| AgentController | 31ms | ✅ |
| Export Integrity | 15ms | ✅ |
| Coordinate Binding | 14ms | ✅ |
| Component Events | 12ms | ✅ |
| Mathe-Quiz | 11ms | ✅ |
| RefactoringManager | 9ms | ✅ |
| TTimer/TIntervalTimer Reactive Properties | 8ms | ✅ |
| TaskExecutor | 6ms | ✅ |
| SyncValidator | 4ms | ✅ |
| SyncRefactor P1: SchemaMigrator | 4ms | ✅ |
| ProjectStore | 4ms | ✅ |
| GameLoopManager Physics | 4ms | ✅ |
| Stage-Import | 4ms | ✅ |
| Project Integrity | 4ms | ✅ |
| Serialization | 3ms | ✅ |
| VideoToSpriteSheet Tool | 3ms | ✅ |
| FlowDataAction Inspector | 2ms | ✅ |
| Smart-Mapping & Discovery | 2ms | ✅ |
| SpawnObject Variable Support | 2ms | ✅ |
| Login-Logic | 2ms | ✅ |
| Action Stage Routing & Duplicates | 2ms | ✅ |
| Pascal Code Generator | 2ms | ✅ |
| Unification & Auto-Unwrap | 2ms | ✅ |
| SidePanel | 2ms | ✅ |
| SnapshotManager | 1ms | ✅ |
| Jump & Run Components | 1ms | ✅ |
| Raketen-Countdown | 1ms | ✅ |
| Action CRUD | 1ms | ✅ |
| Action Registration | 1ms | ✅ |
| Sprite-Geometrie | 1ms | ✅ |
| TTimer Variable Resolution | 1ms | ✅ |
| SyncRefactor P0: FlowAction Aliases | 1ms | ✅ |
| SyncRefactor P0: SyncValidator Strict | 1ms | ✅ |
| Event Actions (bind/unbind) | 1ms | ✅ |
| SyncRefactor P0: Inspector Writeback | 1ms | ✅ |
| FlowSync | 1ms | ✅ |
| Virtual Gamepad | 1ms | ✅ |
| SyncRefactor P0: Store SET_PROPERTY | 1ms | ✅ |
| Electron Security | 1ms | ✅ |
| Gezieltes Auffrischen | 1ms | ✅ |
| Renaming Robustness | 1ms | ✅ |
| TTable Smart-Unwrap | 0ms | ✅ |
| SELECT COUNT(*) | 0ms | ✅ |
| Playwright E2E | 0ms | ✅ |
| CMS-Aufbauläufe | 0ms | ✅ |

**Summe Suiten**: 12614ms
**Gesamtlauf inkl. Setup/Report**: 12618ms
**Budget-Warnschwelle**: 180000ms (Einzelsuite 🐌 ab 5000ms)

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
| Discovery: DB Keys found<br><small>Keys: users</small> | Discovery | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Discovery: Users collection exists | Discovery | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Unification: PropertyHelper Traversal<br><small>Value: Rolf (Expected: 'Rolf')</small> | Smart Mapping | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Unification: ExpressionParser Interpolation<br><small>Result: Hello Rolf</small> | Smart Mapping | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Unification: Source-Level Unwrapping (Sim)<br><small>Type: object, IsArray: false</small> | Smart Mapping | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Unification: Deep Path Auto-Unwrap<br><small>Version: 123</small> | Smart Mapping | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TTable: Smart-Unwrap TObjectList<br><small>Data: 1, Cols: 1 (Inherited: Name)</small> | Smart Mapping | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TTable: Smart-Unwrap TListVariable<br><small>Data: 2, First: Value 1</small> | Smart Mapping | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TDataAction: SELECT count(*) Only<br><small>Expected: 3, Got: 3</small> | Happy Path | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TDataAction: SELECT id, count(*)<br><small>Expected: Array(3) with count:1, Got: {"id":1,"count":1}</small> | Happy Path | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| SpriteGeometry: Verzerrung 16:9-Frame in 5:3-Box<br><small>Frame 256x144, Verzerrung 1.0667 (erwartet > 1.02)</small> | Happy Path | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| SpriteGeometry: scaleX und scaleY getrennt ausgewiesen<br><small>scaleX=1.280 scaleY=1.200 (erwartet 1.280 / 1.200)</small> | Happy Path | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| SpriteGeometry: containFit zentriert ohne Verzerrung<br><small>w=100% h=93.75% top=3.125% (erwartet 100 / 93.75 / 3.125)</small> | Happy Path | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| SpriteGeometry: 1:1-Sheet bleibt unangetastet<br><small>Verzerrung 1.0000, Fit 100x100%, scale 1.000</small> | Edge Case | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| SpriteGeometry: hoher Frame in breiter Box<br><small>w=30.00% left=35.00% (erwartet 30 / 35)</small> | Edge Case | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| SpriteGeometry: kleinste verzerrungsfreie Zellengroesse<br><small>Vorschlag 16x9 Zellen = 320x180px (erwartet 16x9 = 320x180)</small> | Happy Path | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| SpriteGeometry: unpraktikables Verhaeltnis wird abgelehnt<br><small>255:143 ergibt 0 Vorschlaege (erwartet 0)</small> | Edge Case | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| SpriteGeometry: empfohlene Sheet-Groesse fuer 1:1<br><small>400x360 (erwartet 400x360)</small> | Happy Path | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| SpriteGeometry: Frame-Verschiebung 2x3, Frame 4<br><small>tx=0% ty=-66.667% (erwartet 0 / -66.667)</small> | Happy Path | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| SpriteGeometry: letztes Frame verschiebt nicht ueber das Blatt hinaus<br><small>tx=-50% ty=-66.667% (erwartet -50 / -66.667)</small> | Edge Case | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| SpriteGeometry: Einzelbild ohne Verschiebung<br><small>tx=0% ty=0%</small> | Edge Case | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| SpriteGeometry: fehlende Masse ergeben null<br><small>analyze() liefert null statt NaN-Werten</small> | Error Handling | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| SpriteGeometry: wholeFrameSize rundet auf ganze Frames<br><small>399x288@2x2 -> 400x288 (Frame 200x144)</small> | Unit | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| SpriteGeometry: wholeFrameSize haelt Frame-Raster ein<br><small>511x300@3x2 -> 510x300 (Frame 170x150)</small> | Unit | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| SpriteGeometry: wholeFrameSize beschuetzt vor Null<br><small>0x0@2x2 -> 1x1 pro Frame</small> | Error Handling | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| ReactiveRuntime: nur abhaengige Objekte je Variable<br><small>1 Objekt(e) fuer "timeLeft" (erwartet 1: Zeitanzeige)</small> | Happy Path | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| ReactiveRuntime: alle Abhaengigen einer Variable<br><small>2 Objekt(e) fuer "score" (erwartet 2)</small> | Happy Path | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| ReactiveRuntime: unbekannte Variable meldet leer<br><small>0 Objekt(e) (erwartet 0 als Rueckfall-Signal)</small> | Edge Case | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| ReactiveRuntime: zusammengesetzte Abhaengigkeit erkannt<br><small>1 Objekt(e) fuer "StageTimer" (erwartet 1)</small> | Happy Path | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| ReactiveRuntime: Zeitanzeige frischt nicht die Karten auf<br><small>1 von 33 Objekten (vorher alle 33)</small> | Happy Path | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Action-Registrierung beim Drop<br><small>Action gefunden, Target=Box1</small> | ActionRegistration | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Global Scope Handling<br><small>In Projekt-Aktionen gefunden</small> | ActionRegistration | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Stage-Scope Fix: Action in Task-Stage registriert<br><small>Action in Stage A gefunden (nicht in Stage B)</small> | ActionRegistration | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Action Create<br><small>Action erfolgreich in Blueprint-Stage erstellt.</small> | ActionCRUD | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Action Read<br><small>Action-Eigenschaften korrekt gelesen.</small> | ActionCRUD | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Action Update (Rename)<br><small>Refactoring erfolgreich: Task & FlowChart aktualisiert.</small> | ActionCRUD | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Action Delete<br><small>Aktion (Normal & Data) restlos entfernt.</small> | ActionCRUD | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| should resolve numeric bindings in x and y coordinates | Happy Path | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| should resolve numeric bindings in width and height | Happy Path | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| should handle nested math in coordinates | Happy Path | ✅ **Gut-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| GameLoopManager Tests | Physics | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Record-API: list/field ohne erfundenes key | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Record-API: fehlende Listenparameter ablehnen | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| addObject — verschiedene Namen ohne IDs | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| addObject — Upsert über vorhandenen Namen | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| addObject — Upsert über vorhandene ID | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| addTaskCall — Gutfall<br><small>Task-Referenz korrekt eingefügt.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| addTaskCall — Schlechtfall<br><small>Fehler korrekt geworfen.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| setTaskTriggerMode — Gutfall<br><small>TriggerMode korrekt gesetzt.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| setTaskTriggerMode — Schlechtfall<br><small>Fehler korrekt geworfen.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| addTaskParam — Gutfall<br><small>2 Parameter korrekt hinzugefügt.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| addTaskParam — Update<br><small>Param aktualisiert, kein Duplikat.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| moveActionInSequence — Gutfall<br><small>Reihenfolge korrekt: B, C, A.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| moveActionInSequence — Schlechtfall<br><small>Fehler korrekt geworfen.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| createSprite — Gutfall<br><small>Sprite mit Physik-Defaults korrekt erstellt.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| createLabel — Gutfall<br><small>Label mit Binding + Style korrekt erstellt.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| setSpriteCollision — Gutfall<br><small>Collision korrekt gesetzt.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| setSpriteVelocity — Gutfall<br><small>Velocity korrekt gesetzt.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| getComponentSchema — Gutfall<br><small>TSprite: 27 Props, 12 Events. TTimer: 3 Methods. Unknown: null.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| addVariable — Threshold mit Tasks<br><small>Threshold-Variable korrekt mit Tasks erstellt.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| connectVariableEvent — Gutfall<br><small>Variable-Event korrekt verbunden.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| connectVariableEvent — Schlechtfall<br><small>Fehler korrekt geworfen.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| createTimer / createIntervalTimer<br><small>Timer korrekt erstellt.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| createThresholdVariable<br><small>Stage-Threshold-Variable korrekt erstellt.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| addAction — Neue Action-Typen<br><small>Neue Action-Typen korrekt erstellt.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| validate — keine fehlenden Referenzen<br><small>Validierung ohne Fehler.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Integration: PingPong via API<br><small>Vollständiges PingPong erstellt: 5 Objekte, 3 Tasks, 2 Variablen, Events gebunden. Validierung: 3 Warnungen, 0 Fehler.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| executeBatch — Gutfall<br><small>4 Ops erfolgreich: Variable + Task + Action + TriggerMode.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| executeBatch — Rollback<br><small>Fehler erkannt + Variable rollbacked.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Integration: Tennis via Batch<br><small>Tennis-Spiel komplett: 20 Batch-Ops, 3 Stages, 6 Objekte, 3 Tasks, 3 Variablen, Events gebunden, Validierung OK.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Integration: Spiel mit Shortcuts<br><small>5 Objekte (3 Sprites + 2 Labels), 2 Variablen, 1 Task, Event gebunden.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| addForeach — Gutfall<br><small>ForEach-Sequenzitem korrekt erstellt.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| addForeach — Schlechtfall (leere sourceArray)<br><small>Fehler korrekt geworfen.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| addWhile — Gutfall<br><small>While-Sequenzitem korrekt erstellt.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| addWhile — Schlechtfall (leere conditionVariable)<br><small>Fehler korrekt geworfen.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| addFor — Gutfall<br><small>For-Sequenzitem korrekt erstellt.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| addFor — Schlechtfall (step = 0)<br><small>Fehler korrekt geworfen.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| validate — Loop-Body-Actions nicht als verwaist markiert<br><small>Validierung korrekt: keine Fehler, keine false-positiven Warnungen.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| generateTaskFlow — Loop-Node in flowLayout<br><small>Loop-Node 'ForEach: el in list' korrekt im flowLayout.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| addForeach — Map iterationMode=keys<br><small>Map-Keys-Iteration korrekt konfiguriert.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| addForeach — Map iterationMode=values<br><small>Map-Values-Iteration korrekt konfiguriert.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| addForeach — Map iterationMode=entries<br><small>Map-Entries-Iteration korrekt konfiguriert.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| addForeach — Schlechtfall (entries ohne keyVar)<br><small>Fehler korrekt geworfen.</small> | AgentController | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Export Objekt (backgroundImage) | AgentScriptIO | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Export Task | AgentScriptIO | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Export Task (Stage-Action) | AgentScriptIO | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Export Scope | AgentScriptIO | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Export Stage Config | AgentScriptIO | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Import Stage Config | AgentScriptIO | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Stage-Config Roundtrip (generisch) | AgentScriptIO | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| ID-Mismatch Fallback | AgentScriptIO | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Condition Roundtrip (Array-Form) | AgentScriptIO | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Condition Roundtrip (Shortcut-Form) | AgentScriptIO | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Condition Roundtrip (body/elseBody-Form) | AgentScriptIO | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Variablen-Scope Roundtrip (global bleibt global) | AgentScriptIO | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Import Variable | AgentScriptIO | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Konflikt Error-Modus | AgentScriptIO | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Konflikt Rename-Modus | AgentScriptIO | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| DryRun | AgentScriptIO | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Asset Export | AgentScriptIO | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Asset Warnung | AgentScriptIO | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Validator Methode | AgentScriptIO | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Asset Remap | AgentScriptIO | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Konflikt Override | AgentScriptIO | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Selection Export | AgentScriptIO | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Repository | AgentScriptIO | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| createFeature — Gutfall | AgentScriptIO | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| createFeature — Update (kein Duplikat) | AgentScriptIO | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| createFeature — featureId-Sync | AgentScriptIO | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| createFeature — featureId-Entfernung | AgentScriptIO | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| createFeature — Schlechtfall (fehlende id)<br><small>Feature requires an id.</small> | AgentScriptIO | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| createFeature — Schlechtfall (Stage nicht gefunden)<br><small>Stage 'stage_ghost' not found.</small> | AgentScriptIO | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| deleteFeature — Gutfall | AgentScriptIO | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| exportFeature — Gutfall | AgentScriptIO | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| exportFeature — Schlechtfall (keine Tasks)<br><small>Keine Tasks für Feature 'feat-empty' gefunden.</small> | AgentScriptIO | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Guard: Daten frisch von Platte (kein Feld) → accept | DiskRevisionGuard | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Guard: Basis == Platte → accept | DiskRevisionGuard | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Guard: neue Datei (null == null) → accept | DiskRevisionGuard | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Guard (Schlechtfall): alter Browserstand R1, KI-Datei R2 → conflict | DiskRevisionGuard | 🛡️ **Schlecht-Test** | Abgelehnt | Abgelehnt | ✅ |
| Guard (Schlechtfall): unverifizierter Browserstand (null), Datei existiert → conflict | DiskRevisionGuard | 🛡️ **Schlecht-Test** | Abgelehnt | Abgelehnt | ✅ |
| Guard: Undo-Snapshot nach eigenem AutoSave (Session-Revision) → accept | DiskRevisionGuard | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Guard (Schlechtfall): Session-Revision unverifiziert → conflict | DiskRevisionGuard | 🛡️ **Schlecht-Test** | Abgelehnt | Abgelehnt | ✅ |
| readBaseRevision unterscheidet „fehlt" von „null" | DiskRevisionGuard | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| isServerManagedPath: relativ ja, Windows-absolut nein | DiskRevisionGuard | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| stampDiskProject setzt _sourcePath und _diskRevision | DiskRevisionGuard | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| project-file liefert Inhalt aus game-server/public (inkl. BOM-Toleranz) | DiskRevisionGuard | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| project-file und project-version liefern identische Revision | DiskRevisionGuard | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Kette (Schlechtfall): Browserstand R1 vs. KI-Datei R2 → Konflikt erkannt | DiskRevisionGuard | 🛡️ **Schlecht-Test** | Abgelehnt | Abgelehnt | ✅ |
| Kette: AutoSave mit Basis-Revision wird abgelehnt (409), KI-Stand bleibt erhalten | DiskRevisionGuard | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| project-file: fehlende Datei → exists=false | DiskRevisionGuard | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| project-file (Schlechtfall): Pfad außerhalb projects/ → 403 | DiskRevisionGuard | 🛡️ **Schlecht-Test** | Abgelehnt | Abgelehnt | ✅ |
| project-file (Schlechtfall): ungültiges JSON → 422 | DiskRevisionGuard | 🛡️ **Schlecht-Test** | Abgelehnt | Abgelehnt | ✅ |
| Handbuch-HTML (Argon): Alle Dateien in docs/handbook-html/Argon/ existieren | Handbuch-HTML | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Handbuch-HTML (Argon Shared): Alle 23 Kapitel inkl. Sprecher-Drehbücher und Checklisten vorhanden<br><small>Argon-Kapitel: 23</small> | Handbuch-HTML | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Handbuch-HTML (Argon GCS Native): 26 Stages, Blueprint-Host, 0 Inline-Actions & 0 Integritätsfehler<br><small>0 Befunde</small> | Handbuch-HTML | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| GCS Doc Portal (Argon): Alle -argon-Dateien existieren und halten das 1000-Zeilen-Limit ein | Handbuch-HTML | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| GCS Doc Portal (Argon): Vollständige Datenbasis (23 Kapitel, 128 Komponenten, 12 Features, 4 Architektur-Doks, 59 Actions, 242 Docs)<br><small>Kapitel: 23, Komp.: 128, Features: 12, Sucheinträge: 246</small> | Handbuch-HTML | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| GCS Doc Portal (Argon): Bidirektionale Querverweise (TSprite ↔ Kapitel/Features) & SWE-2-Datenschnittstelle dokumentiert | Handbuch-HTML | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| GCS Doc Portal (Argon): Views rendern Portal-Home, Komponenten-Steckbrief (TSprite) und Action-Katalog fehlerfrei | Handbuch-HTML | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| GCS Doc Portal (Argon Schlechtfall): Rohe <script>-Tags in Markdown werden bei der HTML-Generierung entschärft<br><small>Kein unausgefiltertes <script>-Tag im generierten HTML enthalten</small> | Handbuch-HTML | 🛡️ **Schlecht-Test** | Abgelehnt | Abgelehnt | ✅ |
| Integration: Raketen-Countdown via Batch<br><small>Vollständiges Raketen-Demo: 20 Batch-Ops, 4 Objekte, 2 Blueprint-Objekte (GameLoop+GameState), 3 Tasks, 6 Actions, 1 Variable, 3 Events, Binding OK. Validierung: 3 Warnungen, 0 Fehler.</small> | RaketenCountdown | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Struktur: Sprite + Task + Action<br><small>Sprite mit velocityY=0, Task mit set_property Action korrekt erstellt.</small> | RaketenCountdown | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| JumpAndRun Komponenten registriert | JumpAndRunComponents | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TParallaxBackground lokale Scroll-Integration | JumpAndRunComponents | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TParallaxBackground scrollSource Binding | JumpAndRunComponents | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TSpawner Spawn & Recycle | JumpAndRunComponents | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TSpeedlines Properties | JumpAndRunComponents | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TSprite Gravity | JumpAndRunComponents | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| EffectActions shake_screen Registration | JumpAndRunComponents | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
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
| Guard: Component Registrierung (Barrel + Registry)<br><small>Alle 114 Komponenten korrekt registriert</small> | System-Guard | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Guard: DTO-to-Registry Compliance (T-11b)<br><small>Alle serialisierbaren Klassen haben eine Factory</small> | System-Guard | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Guard: Keine unerlaubten console.* Aufrufe<br><small>Erlaubt (Baseline 32), Aktuell: 14</small> | System-Guard | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Guard: Dateigroesse < 1000 Zeilen<br><small>Baseline 12 eingehalten, Aktuell: 3</small> | System-Guard | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Guard: bundle:runtime Freshness<br><small>Bundle aktuell</small> | System-Guard | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
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
| Delete Task: Bereinigt Variablen-Events<br><small>varEventCleared=true</small> | Refactoring | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Execute: Stage-Task → 1 Action<br><small>Ausgeführt: [StageAction]</small> | TaskExecutor | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Execute: Blueprint-Lookup (Hierarchie)<br><small>Ausgeführt: [GlobalAction1, GlobalAction2]</small> | TaskExecutor | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Execute: Unbekannter Task (kein Crash)<br><small>Ausgeführt: 0 (erwartet: 0)</small> | TaskExecutor | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Execute: Action Resolution (Name → Definition)<br><small>Target=LoginBtn (erwartet: LoginBtn)</small> | TaskExecutor | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Execute: Condition TRUE → thenTask<br><small>Ausgeführt: [StageAction]</small> | TaskExecutor | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Execute: Condition FALSE → elseTask<br><small>Ausgeführt: [GlobalAction1, GlobalAction2]</small> | TaskExecutor | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Execute: Max Recursion Depth Guard<br><small>Kein Endlos-Loop</small> | TaskExecutor | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Execute: Task in Composite Action<br><small>Ausgeführt: [InnerAction, FinalAction]</small> | TaskExecutor | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Execute: Blueprint-Referenz verdeckt echte Action nicht<br><small>Ausgeführt: [EnableMoving:property]</small> | TaskExecutor | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
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
| R5: Task-Duplikat erkennen<br><small>Keine R5-Verletzung (Cross-Stage Overrides erlaubt)</small> | SyncValidator | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
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
| Export-Integrität: player-standalone.ts<br><small>Hash geändert! Erwartet: F3C723666F024A1E..., Aktuell: A26D33D4ECA055C2... → npx tsx tests/export_integrity.test.ts --update</small> | Export-Integrität | 🛡️ **Schlecht-Test** | OK/Erwartet | Abgelehnt | ❌ |
| Export-Integrität: GameRuntime.ts<br><small>Hash geändert! Erwartet: 4FC3CB4AB28CEA66..., Aktuell: 45A4A93D92342BB6... → npx tsx tests/export_integrity.test.ts --update</small> | Export-Integrität | 🛡️ **Schlecht-Test** | OK/Erwartet | Abgelehnt | ❌ |
| Export-Integrität: GameLoopManager.ts<br><small>Hash geändert! Erwartet: 069063538D76F5EF..., Aktuell: F96BB8B4C916658D... → npx tsx tests/export_integrity.test.ts --update</small> | Export-Integrität | 🛡️ **Schlecht-Test** | OK/Erwartet | Abgelehnt | ❌ |
| Nested Task Declaration Generation<br><small>Recursive Tasks successfully output</small> | Pascal Generator | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Basis-Import (Objekte, Tasks, Actions, Variables)<br><small>2 Objekte, 1 Task, 2 Actions, 1 Variable korrekt kopiert</small> | Stage-Import | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| ID-Remap (keine Original-IDs)<br><small>Alle IDs neu generiert</small> | Stage-Import | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Blueprint-Merge (GlobalAction + GlobalTimer)<br><small>GlobalAction=true, GlobalTimer=true</small> | Stage-Import | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Duplikat-Schutz (kein Blueprint-Duplikat)<br><small>GlobalAction-Anzahl=1, Stages=4</small> | Stage-Import | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Blueprint → Standard (Type-Konvertierung)<br><small>Type=standard</small> | Stage-Import | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Stage ohne Abhängigkeiten<br><small>1 Objekt, keine Tasks/Actions, Blueprint bleibt leer</small> | Stage-Import | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Events bleiben erhalten (Rakete.onClick)<br><small>onClick=StartCountdown</small> | Stage-Import | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| navigate_stage Auto-Remap<br><small>GoToSpiel.stageId=stage_import_1792315677472_pq (erwartet: stage_import_1792315677472_pq), BackToLobby.stageId=stage_import_1792315677472_pj (erwartet: stage_import_1792315677472_pj)</small> | Stage-Import | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
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
| Runtime-Lifecycle: API (direkt) | StageTransition-Behavior | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Runtime-Lifecycle: Controller (direkt) | StageTransition-Behavior | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Runtime-Lifecycle: Direkt (direkt) | StageTransition-Behavior | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Runtime-Lifecycle: Splash (direkt) | StageTransition-Behavior | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Runtime-Lifecycle: Legacy-Splash (direkt) | StageTransition-Behavior | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Runtime-Lifecycle: Reset (direkt) | StageTransition-Behavior | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Runtime-Lifecycle: Reset verzögert (direkt) | StageTransition-Behavior | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Runtime-Lifecycle: API (reaktiv) | StageTransition-Behavior | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Runtime-Lifecycle: Controller (reaktiv) | StageTransition-Behavior | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Runtime-Lifecycle: Direkt (reaktiv) | StageTransition-Behavior | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Runtime-Lifecycle: Splash (reaktiv) | StageTransition-Behavior | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Runtime-Lifecycle: Legacy-Splash (reaktiv) | StageTransition-Behavior | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Runtime-Lifecycle: Reset (reaktiv) | StageTransition-Behavior | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Runtime-Lifecycle: Reset verzögert (reaktiv) | StageTransition-Behavior | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Defaults und Vererbung (TDialogRoot)<br><small>Alle Defaults korrekt (modal=false, centerOnShow=false).</small> | TSidePanel | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Synchronisation von side und slideDirection<br><small>Eigenschaft panelSide steuert slideDirection mit.</small> | TSidePanel | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Serialisierung toDTO<br><small>Alle Side-Panel Eigenschaften korrekt serialisiert.</small> | TSidePanel | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| DOM Runtime Element<br><small>Methodengarantie: createRuntimeElement ist überladen.</small> | TSidePanel | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TComponent.getEvents includes Hover Events<br><small>Found: onClick, onDoubleClick, onMouseEnter, onMouseLeave, onDragStart, onDragEnd, onDrop, onTouchStart, onTouchMove, onTouchEnd, onFlipMidpoint, onFocus, onBlur</small> | Component Events | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| ComponentRegistry Fallback includes Hover Events<br><small>Found: onClick, onDoubleClick, onMouseEnter, onMouseLeave, onDragStart, onDragEnd, onDrop, onTouchStart, onTouchMove, onTouchEnd</small> | Component Events | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Nonvisual Inspector: TVariable | Inspector | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Nonvisual Inspector: TIntegerVariable | Inspector | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Nonvisual Inspector: TListVariable | Inspector | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Nonvisual Inspector: TStringMap | Inspector | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Nonvisual Inspector: TTimer | Inspector | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Nonvisual Inspector: TIntervalTimer | Inspector | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Nonvisual Inspector: TGameLoop | Inspector | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Nonvisual Inspector: TGameState | Inspector | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Nonvisual Inspector: TInputController | Inspector | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Nonvisual Inspector: TAudio | Inspector | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Nonvisual Inspector: TSpawner | Inspector | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Nonvisual Inspector: TAnimation | Inspector | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Nonvisual Inspector: TDataStore | Inspector | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Nonvisual Inspector: TAPIServer | Inspector | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Nonvisual Inspector: TGameServer | Inspector | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Nonvisual Inspector: THandshake | Inspector | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Nonvisual Inspector: THeartbeat | Inspector | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Nonvisual Inspector: TStageController | Inspector | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Nonvisual Inspector: TObjectList | Inspector | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Nonvisual Inspector: TImageList | Inspector | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Nonvisual Inspector: DTO-Werte bleiben erhalten | Inspector | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Visueller Inspector bleibt erhalten: TButton | Inspector | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Visueller Inspector bleibt erhalten: TSprite | Inspector | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Visueller Inspector bleibt erhalten: TSpriteTemplate | Inspector | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Visueller Inspector bleibt erhalten: TToast | Inspector | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Visueller Inspector bleibt erhalten: TStatusBar | Inspector | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Visueller Inspector bleibt erhalten: TStickyNote | Inspector | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| bind_event registered | Event Actions | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| unbind_event registered | Event Actions | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| bind_event sets events[event] = task<br><small>{"onClick":"TaskA"}</small> | Event Actions | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| bind_event with empty task removes binding<br><small>{}</small> | Event Actions | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| bind_event overwrites existing binding<br><small>{"onClick":"NewTask"}</small> | Event Actions | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| unbind_event removes only specified event<br><small>{"onHover":"TaskB"}</small> | Event Actions | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| bind_event initializes events object if missing<br><small>{"onCollision":"Boom"}</small> | Event Actions | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| bind_event with unknown target does not throw | Event Actions | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| bind_event ignores empty event name | Event Actions | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| bind_event metadata exposes target/event/task params<br><small>params: target,event,task</small> | Event Actions | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TC-1 createAction routes to target stage (not blueprint)<br><small>Action in stage_main, nicht in Blueprint.</small> | ActionStageRouting | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TC-2 fallback routes to active stage (not blueprint)<br><small>Fallback in Blueprint-Stage (korrekt ohne Editor).</small> | ActionStageRouting | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TC-3 cross-stage override allowed (per-stage uniqueness only)<br><small>Beide Definitionen koexistieren mit eigenen Werten.</small> | ActionStageRouting | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TC-4 minimal link skipped<br><small>Reine Referenz erzeugt keine Action-Definition.</small> | ActionStageRouting | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TC-5 validator ignores cross-stage same-name (allowed override)<br><small>Kein Konflikt gemeldet.</small> | ActionStageRouting | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TC-6 validator detects intra-stage duplicate<br><small>Intra-Stage-Duplikat als error gemeldet.</small> | ActionStageRouting | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TC-7 auto-repair removes intra-stage phantom hull<br><small>Phantom entfernt, echte Definition bleibt.</small> | ActionStageRouting | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TC-7b auto-repair preserves real intra-stage duplicates<br><small>Beide bleiben, error gemeldet.</small> | ActionStageRouting | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TC-8 update keeps single entry, fields refreshed<br><small>Update korrekt; keine Duplikate.</small> | ActionStageRouting | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| LayerA: SET_PROPERTY mutiert Ziel-Objekt<br><small>x: 10 → 99, dispatch=true</small> | SyncRefactor-Phase0 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| LayerA: SET_PROPERTY mit Dot-Path (style.textAlign)<br><small>style.textAlign=right, dispatch=true</small> | SyncRefactor-Phase0 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| LayerA: SET_PROPERTY ohne Projekt → false<br><small>dispatch=false</small> | SyncRefactor-Phase0 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| LayerA: Listener wird nach Mutation aufgerufen<br><small>listenerCalled=true, mutation.path=y</small> | SyncRefactor-Phase0 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| LayerA: SET_PROPERTY auf Action-Definition<br><small>type=navigate, dispatch=true</small> | SyncRefactor-Phase0 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| LayerA: SET_PROPERTY Isolation — andere Objekte unverändert<br><small>target.x=42, action.type=property (unverändert: property)</small> | SyncRefactor-Phase0 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Strict R0: Sauberes Projekt → 0 Verletzungen<br><small>Keine Verletzungen</small> | SyncRefactor-Phase0 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Strict R1: Verwaiste Action erkannt, NICHT repariert<br><small>R1-Verletzungen=1, Ghost noch da=true</small> | SyncRefactor-Phase0 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Strict R2: FlowChart ohne Task erkannt, NICHT repariert<br><small>R2-Verletzungen=1, Phantom noch da=true</small> | SyncRefactor-Phase0 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Strict R3: Kaputte Connection erkannt<br><small>R3-Verletzungen=1</small> | SyncRefactor-Phase0 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Strict R4: Typ-Desync erkannt<br><small>R4-Verletzungen=1, msg=Action "BlueprintAction": Flow-Node hat type="navigate", Definition hat type="property" — Typ-Desync!</small> | SyncRefactor-Phase0 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Strict R5: Task-Duplikat erkannt<br><small>R5-Verletzungen=0</small> | SyncRefactor-Phase0 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Strict R6: FlowChart Split-Brain erkannt, NICHT repariert<br><small>R6-Verletzungen=1, Root noch da=true</small> | SyncRefactor-Phase0 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Alias: actionType setzt type korrekt<br><small>def.type=navigate, proxy.type=navigate, proxy.actionType=navigate</small> | SyncRefactor-Phase0 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Alias: changes liest both propertyChanges und changes<br><small>A(propertyChanges)=true, B(changes)=true</small> | SyncRefactor-Phase0 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Alias: changes-Setter schreibt korrektes Feld<br><small>Legacy→propertyChanges=true, Modern→changes=true</small> | SyncRefactor-Phase0 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Alias: variable ↔ variableName bidirektional<br><small>read=true, write=true, final=lives</small> | SyncRefactor-Phase0 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Alias: method liest method und methodName<br><small>Legacy(methodName)=true, Modern(method)=true</small> | SyncRefactor-Phase0 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Alias: formula-Setter löscht Legacy expression<br><small>read=true, write=true, legacyDeleted=true, alias=true</small> | SyncRefactor-Phase0 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Writeback: applyChange schreibt in SSoT<br><small>actionDef.target=NewSprite</small> | SyncRefactor-Phase0 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Writeback: applyChange spiegelt in this.data<br><small>data.target=NewSprite</small> | SyncRefactor-Phase0 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Writeback: type-Wechsel → Re-Render-Signal<br><small>reRender=true, type=navigate</small> | SyncRefactor-Phase0 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Writeback: effect-Wechsel → Re-Render-Signal<br><small>reRender=true, effect=explode</small> | SyncRefactor-Phase0 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Writeback: normaler Change → kein Re-Render<br><small>reRender=false</small> | SyncRefactor-Phase0 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Writeback: Registry-Parameter ohne Setter → SSoT + data<br><small>SSoT.duration=500, data.duration=500</small> | SyncRefactor-Phase0 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Writeback: changes-Objekt → SSoT + data<br><small>SSoT.changes={"visible":false,"opacity":0.5}, data.changes={"visible":false,"opacity":0.5}</small> | SyncRefactor-Phase0 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Writeback: Konsistenz nach Mehrfach-applyChange<br><small>SSoT: target=B, type=navigate, url=/menu</small> | SyncRefactor-Phase0 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Writeback: FlowNodeFactory.createNode füllt Defaults<br><small>data.effect=fade, data.duration=300</small> | SyncRefactor-Phase0 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Phase1: Alle Aliase normalisiert<br><small>type=property, changes=true, variableName=score, method=doStuff, formula=2 + 2</small> | SyncRefactor-Phase1 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Phase1: Gemischt → kanonisch gewinnt<br><small>type=navigate, changes.x=1, aliasDeleted=true</small> | SyncRefactor-Phase1 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Phase1: schemaVersion = 4.0.0<br><small>schemaVersion=4.0.0</small> | SyncRefactor-Phase1 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Phase1: Idempotenz (2. Aufruf = 0 Änderungen)<br><small>1. Durchlauf: 13 migriert, 2. Durchlauf: 0 migriert, JSON identisch: true</small> | SyncRefactor-Phase1 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Phase1: Leeres Projekt → keine Exception<br><small>null=0, empty=0, minimal=0</small> | SyncRefactor-Phase1 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Phase1: FlowChart node.data migriert<br><small>type=animate, formula=shake, method=play</small> | SyncRefactor-Phase1 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Phase1: Stage-Actions migriert<br><small>type=property, changes.color=red</small> | SyncRefactor-Phase1 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Phase1: Rückgabewert = korrekte Anzahl<br><small>count=13 (erwartet: 13)</small> | SyncRefactor-Phase1 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Phase2: Registry-Defaults aufgefüllt<br><small>filled=3, effect=shake, duration=500, targetScale=2, target=Sprite1</small> | SyncRefactor-Phase1 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Phase2: Vorhandene Werte nicht überschrieben<br><small>filled=0, effect=explode, duration=1000</small> | SyncRefactor-Phase1 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Phase2: Unbekannter Typ → 0 Defaults<br><small>filled=0</small> | SyncRefactor-Phase1 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Phase2: Stage-Actions erhalten Defaults<br><small>filled=2, effect=shake, duration=500</small> | SyncRefactor-Phase1 | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TTimer: Auflösung aus contextVars<br><small>Ergebnis: 5 (erwartet: 5)</small> | TTimer | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TTimer: Mathematische Ausdrücke<br><small>Ergebnis: 13 (erwartet: 13)</small> | TTimer | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TTimer: Fallback bei fehlenden Variablen<br><small>Ergebnis: 0 (erwartet: 0)</small> | TTimer | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| spawn_object: Resolve templateId from variable<br><small>Expected bullet_id/50/60, got bullet_id/50/60</small> | SpawnObject | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| spawn_object: Resolve referenceObject from variable<br><small>Expected bullet_id/110/220, got bullet_id/110/220</small> | SpawnObject | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| spawn_object: Metadata check<br><small>templateId type: string, refObj type: string</small> | SpawnObject | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TTimer: Standardmäßig nicht aktiviert (enabled=false)<br><small>enabled: false</small> | TimerReactive | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TIntervalTimer: Standardmäßig nicht aktiviert (enabled=false)<br><small>enabled: false</small> | TimerReactive | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TTimer: Reaktives Starten bei enabled = true zur Laufzeit<br><small>Vorher Intervalle: 0, Nachher: 1</small> | TimerReactive | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TTimer: Reaktives Stoppen bei enabled = false zur Laufzeit<br><small>Gestartet: true, Nach enabled=false Intervalle: 0</small> | TimerReactive | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TIntervalTimer: Reaktives Starten bei enabled = true zur Laufzeit<br><small>Vorher Timeouts: 0, Nachher: 1</small> | TimerReactive | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TIntervalTimer: Reaktives Stoppen bei enabled = false zur Laufzeit<br><small>Gestartet: true, Nach enabled=false Timeouts: 0</small> | TimerReactive | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TTimer: currentInterval Tick-Updates lösen reaktiv Watcher aus<br><small>Intervals: 2 (erwartet: 2), Watcher-Triggers: 2 (erwartet: 2)</small> | TimerReactive | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| TTimer: TLabel Binding an StageTimer.currentInterval wird reaktiv aktualisiert<br><small>Initial: "2" (erwartet: 0), Tick 1: "2" (erwartet: 1), Tick 2: "2" (erwartet: 2)</small> | TimerReactive | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| VideoToSpriteSheet Tool | Media-Tool | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Spracheingabe, Quizablauf und Transportgrenzen<br><small>36 Einzeltests bestanden</small> | CMS Regression | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Karteikasten-Abenteuer: Auswahl, Leitner und sichere Wiederholung<br><small>8 Einzeltests bestanden</small> | CMS Regression | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Bildpfade: ZIP, relative Referenzen und eingebettete Bilder<br><small>3 Einzeltests bestanden</small> | CMS Regression | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Stage-Eingänge, Ausgänge und Task-Refactoring<br><small>6 Einzeltests bestanden</small> | Runtime Regression | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Aufgabenbereich: Events, Leitner, Wiederholung und SQLite<br><small>11 Einzeltests bestanden</small> | CMS Regression | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Bilder zählen: Karten, Aufgabenlayout und unabhängige Spielwelt<br><small>6 Einzeltests bestanden</small> | CMS Regression | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| Lernzielkatalog: Filter, Erweiterbarkeit und Berechtigungen<br><small>5 Einzeltests bestanden</small> | CMS Regression | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| CMS UI-Integritaet und Generator-Wiederholung<br><small>TAP version 13
# Subtest: Bereinigung bewahrt Layout, IDs, Editorverknuepfungen und fremde Inhalte
ok 1 - Bereinigung bewahrt Layout, IDs, Editorverknuepfungen und fremde Inhalte
  ---
  duration_ms: 2.3677
  ...
# Subtest: Widerspruechliche Duplikate werden ohne Aenderung abgewiesen
ok 2 - Widerspruechliche Duplikate werden ohne Aenderung abgewiesen
  ---
  duration_ms: 0.4483
  ...
# Subtest: Generator-Registrierung ist idempotent und behaelt bestehende IDs
ok 3 - Generator-Registrierung ist idempotent und behaelt bestehende IDs
  ---
  duration_ms: 0.924
  ...
# Subtest: Bereinigung entfernt nur bekannte veraltete Property-Ziele
ok 4 - Bereinigung entfernt nur bekannte veraltete Property-Ziele
  ---
  duration_ms: 0.307
  ...
# Subtest: Panelnamen kollidieren weder mit Editorobjekten noch mit Blueprintnamen
ok 5 - Panelnamen kollidieren weder mit Editorobjekten noch mit Blueprintnamen
  ---
  duration_ms: 0.1945
  ...
# Subtest: Deck-Generator erzeugt auch nach zwei Laeufen keine doppelten Actions
not ok 6 - Deck-Generator erzeugt auch nach zwei Laeufen keine doppelten Actions
  ---
  duration_ms: 191.6631
  location: 'C:\\Users\\rolfr\\.gemini\\antigravity\\scratch\\game-builder-v2\\scripts\\test-cms-ui-integrity.cjs:97:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected
    
    + [
    +   {
    +     level: 'fehler',
    +     message: 'Action KindExport_Exportieren: Zielkomponente fehlt: Privatsphaere',
    +     stage: 'stage_server_parent'
    +   },
    +   {
    +     level: 'fehler',
    +     message: 'Action KindLoeschen_Loeschen: Zielkomponente fehlt: Privatsphaere',
    +     stage: 'stage_server_parent'
    +   }
    + ]
    - []
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
  actual:
    0:
      stage: 'stage_server_parent'
      level: 'fehler'
      message: 'Action KindExport_Exportieren: Zielkomponente fehlt: Privatsphaere'
    1:
      stage: 'stage_server_parent'
      level: 'fehler'
      message: 'Action KindLoeschen_Loeschen: Zielkomponente fehlt: Privatsphaere'
  operator: 'deepStrictEqual'
  stack: |-
    TestContext.<anonymous> (C:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v2\scripts\test-cms-ui-integrity.cjs:101:12)
    Test.runInAsyncScope (node:async_hooks:211:14)
    Test.run (node:internal/test_runner/test:979:25)
    Test.processPendingSubtests (node:internal/test_runner/test:677:18)
    Test.postRun (node:internal/test_runner/test:1090:19)
    Test.run (node:internal/test_runner/test:1018:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:677:7)
  ...
# Subtest: Eltern-Generator erzeugt auch nach zwei Laeufen keine doppelten Actions
not ok 7 - Eltern-Generator erzeugt auch nach zwei Laeufen keine doppelten Actions
  ---
  duration_ms: 153.1231
  location: 'C:\\Users\\rolfr\\.gemini\\antigravity\\scratch\\game-builder-v2\\scripts\\test-cms-ui-integrity.cjs:105:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    
    2 !== 0
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 0
  actual: 2
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (C:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v2\scripts\test-cms-ui-integrity.cjs:113:12)
    Test.runInAsyncScope (node:async_hooks:211:14)
    Test.run (node:internal/test_runner/test:979:25)
    Test.processPendingSubtests (node:internal/test_runner/test:677:18)
    Test.postRun (node:internal/test_runner/test:1090:19)
    Test.run (node:internal/test_runner/test:1018:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:677:7)
  ...
# Subtest: CMS-Master hat weder Integritaetsfehler noch Warnungen
not ok 8 - CMS-Master hat weder Integritaetsfehler noch Warnungen
  ---
  duration_ms: 10.9374
  location: 'C:\\Users\\rolfr\\.gemini\\antigravity\\scratch\\game-builder-v2\\scripts\\test-cms-ui-integrity.cjs:117:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected
    
    + [
    +   {
    +     level: 'fehler',
    +     message: 'Action KindExport_Exportieren: Zielkomponente fehlt: Privatsphaere',
    +     stage: 'stage_server_parent'
    +   },
    +   {
    +     level: 'fehler',
    +     message: 'Action KindLoeschen_Loeschen: Zielkomponente fehlt: Privatsphaere',
    +     stage: 'stage_server_parent'
    +   }
    + ]
    - []
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
  actual:
    0:
      stage: 'stage_server_parent'
      level: 'fehler'
      message: 'Action KindExport_Exportieren: Zielkomponente fehlt: Privatsphaere'
    1:
      stage: 'stage_server_parent'
      level: 'fehler'
      message: 'Action KindLoeschen_Loeschen: Zielkomponente fehlt: Privatsphaere'
  operator: 'deepStrictEqual'
  stack: |-
    TestContext.<anonymous> (C:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v2\scripts\test-cms-ui-integrity.cjs:118:10)
    Test.runInAsyncScope (node:async_hooks:211:14)
    Test.run (node:internal/test_runner/test:979:25)
    Test.processPendingSubtests (node:internal/test_runner/test:677:18)
    Test.postRun (node:internal/test_runner/test:1090:19)
    Test.run (node:internal/test_runner/test:1018:12)
    async Test.processPendingSubtests (node:internal/test_runner/test:677:7)
  ...
# Subtest: Theme erzeugt eindeutige Panelnamen auch bei Wiederholung
ok 9 - Theme erzeugt eindeutige Panelnamen auch bei Wiederholung
  ---
  duration_ms: 0.5599
  ...
# Subtest: Galerie-Tasks sind im Blueprint definiert und vollstaendig verdrahtet
ok 10 - Galerie-Tasks sind im Blueprint definiert und vollstaendig verdrahtet
  ---
  duration_ms: 0.673
  ...
1..10
# tests 10
# suites 0
# pass 7
# fail 3
# cancelled 0
# skipped 0
# todo 0
# duration_ms 498.4463
</small> | CMS Regression | 🛡️ **Schlecht-Test** | OK/Erwartet | Abgelehnt | ❌ |
| CMS Sponsor-Berechtigungen und Workflows<br><small>{"passed":24,"failed":0}</small> | CMS Regression | 🛡️ **Schlecht-Test** | OK/Erwartet | OK/Erhalten | ✅ |
| CMS SuperAdmin Sponsorverwaltung<br><small>[Rollenwahl] requireRole(superAdmin) ← KEINE Session
OK Nur ausgewählte aktive SuperAdmin-Sitzung verwaltet Sponsoren
OK Alle erwachsenen Rollen erhalten Sponsor zusätzlich ohne Einladung
OK Kinder und inaktive Konten werden abgewiesen
OK Ungültige oder unbestätigte Änderungen mutieren nichts
</small> | CMS Regression | 🛡️ **Schlecht-Test** | OK/Erwartet | Abgelehnt | ❌ |

---
*Hinweis: Dieser Bericht wurde automatisch vom GCS Regression Test Runner erstellt.*