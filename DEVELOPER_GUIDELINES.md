# Developer Guidelines

> [!CAUTION]
> **PFLICHT-REGEL FÜR KI-AGENTEN**: Jede Code-Änderung MUSS mit `npm run test` (oder `run_tests.bat`) validiert werden. Der `docs/QA_Report.md` ist Teil der „Definition of Done". Tests VOR der Nutzer-Benachrichtigung ausführen.

> [!IMPORTANT]
> **CleanCode Transformation — Phase 1-3 abgeschlossen (v3.22.0)**
> Phase 1 (Unidirektionaler Datenfluss), Phase 2 (Domain Model Trennung) und Phase 3 (Hexagonale Architektur) sind abgeschlossen.
> Phase 4 (E2E-Test-Netz) steht noch aus. Details in `docs/CleanCodeTransformation.md`.
> Bei neuen I/O-Features: `IStorageAdapter` nutzen (`src/ports/IStorageAdapter.ts`). Electron-Kompatibilität prüfen.

---

## 1. Schnellstart & Kernregeln

- **Sprache**: Die gesamte Kommunikation und Dokumentation erfolgt auf Deutsch.
- **Modularisierung**: Max. 1000 Zeilen pro Datei. Bei Überschreitung: Modul-Aufteilung anwenden.
- **Global Hosting**: Alle globalen Variablen, Komponenten, Tasks und Actions gehören in die `stage_blueprint`.
- **GCS_FEATURE_MAP**: Bevor Code gelöscht oder massiv umgebaut wird, MUSS `docs/GCS_FEATURE_MAP.md` geprüft werden. Jedes neue Feature dort dokumentieren.
- **Synchronität**: Änderungen in Inspector/Flow-Editor müssen konsistent in JSON und Pascal reflektiert werden.

## 2. Tooling

| Befehl | Zweck |
|:---|:---|
| `npm run test` | Vollständige Regression-Suite |
| `npm run validate` | Projekt-Validierung |
| `npm run build` | Produktions-Build |
| `npm run bundle:runtime` | Runtime-Bundle (zwingend nach Runtime-Änderungen!) |

## 3. State & Datenfluss

> [!IMPORTANT]
> **JSON ist die einzige Wahrheit (SSoT).** Alle Editoren (Flow, Inspector, Pascal) schreiben Änderungen in die JSON-Daten. Aus JSON werden Stages und Flow-Diagramme beim Laden erzeugt.

- **Single Source of Truth:** `ProjectStore.ts` ist der einzige Weg, das GameProject zu mutieren. Keine direkte Mutation ohne `ProjectStore`-Action!
- **ProjectStore – setProject() Pflicht:** Bei JEDEM Projektwechsel (`Editor.setProject()`, Fallback-Pfad in `EditorDataManager.loadProject()`) MUSS `projectStore.setProject(project)` aufgerufen werden. Ohne diesen Aufruf arbeitet der Store mit einer veralteten Referenz.
- **Undo / Redo:** Der einzige zuständige Manager ist der **`SnapshotManager`**. Der alte `ChangeRecorder`/`EditorUndoManager` ist obsolet. Bei jeder Wiederherstellung tauscht der Editor das Projekt tiefgreifend aus (`this.loadProject(JSON)`).
- **Two-Way-Binding Kollisionen:** Vermeide direkte Schreibzugriffe auf `obj.name` über UI-Events, *bevor* eine zentrale Validierung wie `EditorCommandManager.renameObject` angestoßen wird! Der `EditorCommandManager` muss die Mutation sicher atomar durchführen.
- **Vermeidung redundanter Render-Zyklen:** `.onChange()` Listener filtern `{x, y, isEditorSelected, width, height, isMoving, isHiddenInRun}` heraus, wenn diese ohnehin zu 60FPS durch lokale Animationen geregelt werden.

### Speichermanagement (aktualisiert v3.22.0)
- **Adapter-basiert**: `ProjectPersistenceService` delegiert an `IStorageAdapter`-Implementierungen. Kein direkter `fetch()`- oder `localStorage`-Zugriff in Business-Logik.
- **Dirty-Flag Pflicht**: Jede Änderung MUSS das `isProjectDirty`-Flag setzen (automatisch über `MediatorEvents.DATA_CHANGED`).
- **Zustands-Reset**: Nach `saveProject` oder `loadProject` das Flag zwingend auf `false` setzen.
- **Initial-Load Originator**: Beim ersten Laden `notifyDataChanged(project, 'editor-load')` verwenden, damit das Dirty-Flag nicht sofort auf `true` springt.
- **isProjectDirty – Originator prüfen**: In `EditorViewManager.initMediator` wird `isProjectDirty = true` NUR bei echten User-Änderungen gesetzt. Events mit `'editor-load'` oder `'autosave'` werden ignoriert.
- **saveProjectToFile – Reihenfolge**: `isProjectChangeAvailable.defaultValue` und `isProjectDirty` müssen VOR `JSON.stringify` zurückgesetzt werden.
- **loadProject – isProjectDirty**: `isProjectDirty=false` muss NACH `setProject()` und `notifyDataChanged()` gesetzt werden (synchron + `setTimeout(100)`).

## 4. Inspector & Flow-Editor

### Synchronisation
- **Persistenz von Flow-Nodes**: Der `FlowNodeHandler` muss globale Listen (`project.actions`) UND `flowCharts` durchsuchen, um „unlinked" Actions zu finden.
- **Typ-Wechsel**: Bei Änderungen des Aktions-Typs im Inspector `mediatorService.notifyDataChanged` aufrufen.
- **Server-Sync**: `EditorDataManager.updateProjectJSON` nutzt `JSON.stringify()` direkt über die Adapter-Architektur.

### Inspector-Patterns
- **IInspectable (v3.14.0)**: Flow-Objekte implementieren `getInspectorSections()`. Änderungen über `eventHandler.handleControlChange()` delegieren. `applyChange()` nur für Re-Render-Checks (Typ-Wechsel). Neue Flow-Objekte MÜSSEN `getInspectorSections()` implementieren.
- **TComponent IInspectable (v3.14.3)**: Alle UI-Komponenten implementieren automatisch `IInspectable` über `TComponent`. Neue Gruppen-Icons in `GROUP_ICONS` Map in `TComponent.ts` hinzufügen.
- **Inspector-Typen im Model-Layer (v3.21.0)**: `TPropertyDef`, `InspectorSection`, `IInspectable` leben in `src/model/InspectorTypes.ts`. NICHT aus `src/editor/inspector/types` importieren.
- **Inspector-Typen**: `type: "color"` zeigt Farbwähler, `inline: true` gruppiert horizontal.
- **Inspector Dropdowns**: Alle Listen für Tasks, Actions und Variablen über `ProjectRegistry.getTasks('all')` etc. speisen. Events-Dropdown in `InspectorContextBuilder.ts`: `getTasks('all')` statt `getTasks('active')`.
- **FlowAction Proxy-Regel**: Neue Felder in `StandardActions.ts` oder `action_rules.json` MÜSSEN auch als Getter/Setter in `FlowAction.ts` implementiert werden. In `mapParameterTypeToInspector()` MUSS `'object'` auf `'select'` gemappt werden.
- **E2E-Tests**: Input name=`{propName}Input`, Select name=`controlName || propName`.

### SyncValidator (v3.14.1)
- Nach jeder `syncToProject()` prüft `SyncValidator.validate()` automatisch 6 Konsistenzregeln.
- Bei neuen Sync-relevanten Datenstrukturen: Validierungsregel in `SyncValidator.ts` ergänzen.
- **Sync-Blacklist**: Die `taskFields` Liste in `FlowSyncManager.ts` darf keine Felder enthalten, die für Aktionen essentiell sind (`value`, `params`, `body`, `source`).

## 5. Flow-Editor & Verbindungen

- **Flow-Typen**: Typ-Bezeichner (`getType()`) müssen IMMER kleingeschrieben sein ('task', 'action').
- **Floating Connections**: Der `FlowGraphHydrator` nutzt Koordinaten als Fallback, wenn keine Node-Zuweisung existiert.
- **Drag-Stabilität**: `pointer-events: none` auf Linien beim Ziehen von Verbindungen setzen.
- **Race-Conditions**: Kein `autoSaveToLocalStorage` während des aktiven Drag-Vorgangs. `selectConnection` erst NACH `AttachEnd`.
- **Rendering & Scaling**: Neue UI-Komponenten (TDataList) müssen explizit im `StageRenderer` registriert sein.

### Task/Action Speicherort
- Tasks und Actions gehören in `stage.tasks` / `stage.actions` der **aktiven Stage**.
- Globale Elemente gehören in die **Blueprint-Stage** (`s.type === 'blueprint'`).
- NIEMALS `project.tasks`, `project.actions` oder `project.variables` (Root-Level) beschreiben.
- `migrateRootToBlueprint()` migriert beim Laden automatisch Legacy-Daten.

### switchActionFlow & Task-Knoten
- `switchActionFlow(taskName)` erzeugt automatisch einen Task-Knoten. KEIN weiteres `createNode('Task', ...)` aufrufen!
- `nodes.find(n => n.getType() === 'task')` nutzen um den auto-generierten Knoten zu referenzieren.

### restoreConnection API
- `restoreConnection({ id, startTargetId, endTargetId, startX, startY, endX, endY, data: { startAnchorType, endAnchorType } })`
- Muss **nach** `createNode` aufgerufen werden, damit die Nodes im Array vorhanden sind.

### syncTaskFromFlow Traversierung
- Startpunkt: `elements.find(e => type === 'task')`
- Ausgehende Connections: `connections.filter(c => c.startTargetId === startNode.id)`
- `buildSequence(targetId)` fügt Actions zur Sequenz hinzu
- Action-Name: `node.data?.name || node.properties?.name`

## 6. Run-Mode & Rendering

- **Koordinaten & Dimensionen**: In `GameRuntime.getObjects()` Bindings für x, y, width, height explizit via `resolveCoord` auflösen.
- **Blueprint-Objekte**: Service-Objekte und globale Variablen nur auf der `blueprint`-Stage anzeigen (`this.host.isBlueprint`).
- **Variablen-Visualisierung**: Variablen zeigen Name + aktuellen Wert in Klammern an.
- **Stage-Vererbung**: NIEMALS `inheritsFrom` für Stage-zu-Stage Vererbung. Nur Blueprint-Merge erlaubt.

## 7. Logging & Diagnose

- **Keine `console.log`**: NIEMALS `console.log`, `console.warn` oder `console.error` direkt im Produktivcode verwenden.
- **Logger-Pflicht**: Immer den zentralen Logger nutzen: `private static logger = Logger.get('ClassName', 'UseCaseId');`
- **UseCases**: Logs einem funktionalen UseCase zuordnen (siehe `UseCaseManager.ts`).
- **Fehler**: `logger.error` wird immer angezeigt. `debug/info/warn` nur, wenn der UseCase im Inspector aktiv ist.
- **Circular Deps**: Bei Utility-Modulen auf kreisförmige Abhängigkeiten achten (siehe Filter-Pattern in `Logger.ts`).
- **Logging-Präfix**: `[TRACE]` für die Synchronisierungs-Pipeline (SyncManager/Hydrator/Manager).

## 8. Action-Persistenz & Suche

- **Index-Lookup**: Für Action-/Task-Definitionen immer `ProjectRegistry.getActions('all')` bzw. `getTasks('all')` nutzen (SSoT-Prinzip: Referenzen auf Original-Objekte im RAM).
- **Broad-Field Matching**: Suche robust über `data.actionName`, `data.name`, `properties.name`, `properties.text` (da Flow-Actions oft unvollständig sind).
- **Case-Insensitivity**: Namen immer Case-Insensitive vergleichen, `.trim()` verwenden.
- **Bereinigung**: `SanitizationService` entfernt automatisch verwaiste Action-Referenzen aus Sequenzen.

## 9. Best Practices

- **Interface Konsistenz**: Host-Objekte für Manager-Klassen müssen Anforderungen in einem dedizierten Interface definieren. Siehe `IViewHost` in `EditorViewManager.ts`.
- **GCS Dashboard Pattern**: Für Dashboards `TTable` im `displayMode: "cards"` verwenden. Datenquellen: `TObjectList`-Variablen in der `stage_blueprint`.
- **Expert-Wizard Dynamisierung**: In der Regel-JSON `type: "select"` und `options: "@objects"` verwenden. Auflösung zur Laufzeit via `ProjectRegistry`.
- **Expert-Wizard Prompts**: Platzhalter in geschweiften Klammern (z.B. `"Wert für {target}.{property}?"`) werden automatisch durch Session-Werte ersetzt.
- **ComponentData vs TWindow**: Im Datenmodell `ComponentData[]` verwenden. `TWindow` nur wo Methoden aufgerufen werden (`Serialization.ts`, `GameRuntime.ts`).
- **Storage über IStorageAdapter**: Neuer I/O-Code MUSS über `IStorageAdapter` laufen (`src/ports/IStorageAdapter.ts`). Adapter in `src/adapters/`.
- **Electron-Vorbereitung**: `NativeFileAdapter` erwartet `window.electronFS`-IPC-Bridge. Kein `showSaveFilePicker` ohne Fallback.

## 10. Architektur-Hinweise (Sync-Strategie)

- **Aktueller Zustand:** Bidirektionaler Sync zwischen Flow-Graph-Objekten ↔ JSON (`FlowSyncManager.ts`). Funktioniert, war aber fehleranfällig.
- **Ziel-Architektur:** Unidirektionaler Datenfluss — Editoren schreiben direkt JSON-Patches, Views rendern nur aus JSON.
- **Pragmatik:** Solange Sync stabil läuft → nicht anfassen. Tests sind das Sicherheitsnetz. Bei Sync-Problemen → unidirektionalen Umbau priorisieren.

## 11. LLM-Trainingsdaten

> [!IMPORTANT]
> Ziel: Ein lokales LLM (3-7B Parameter) finetunen, das aus natürlicher Sprache GCS-Komponenten über die `AgentController`-API erzeugt.

- **Export-Trigger:** Nach Feature-Implementierungen den `TrainingDataExporter` (`src/tools/TrainingDataExporter.ts`) ausführen.
- **Format:** JSONL-Paare aus natürlichsprachigem Input und AgentController-API-Aufrufen.
- **Speicherort:** `data/training/` im Projektroot.
- **Varianten:** Pro Use Case min. 3 natürlichsprachige Input-Varianten.
- **Validierung:** Outputs gegen `src/tools/agent-api-schema.json` validieren.
- **Tooling:** QLoRA-Finetuning mit [Unsloth](https://github.com/unslothai/unsloth), Modelle: Phi-3-mini (3.8B) oder Qwen2.5-7B.

## 12. Object Pooling für dynamische Sprites

- **Problem**: `spawnObject`-Aufrufe erzeugten „Geister-Sprites" (Logik-Objekte ohne DOM-Elemente).
- **Lösung:** Object Pool Pattern (`SpritePool.ts`). Alle Instanzen werden VOR `initMainGame` vorhydriert.
- **Verwendung:**
  1. `TSpriteTemplate` platzieren, `poolSize`, `autoRecycle` und `lifetime` konfigurieren.
  2. Action `spawn_object` nutzt eine Pool-Instanz (Clone). Position/Velocity wird temporär überschrieben.
  3. Action `destroy_object` (`Target: %Self%`) blendet aus und legt ins Pool zurück (`visible: false`).
- **Performance:** Die GameLoop überspringt alle `visible: false` Objekte.

---

## 13. DO NOT — Verbotsliste (Anti-Patterns & Regression-Prävention)

> [!CAUTION]
> Die folgenden Regeln verhindern bekannte Regressionen. Jeder Eintrag basiert auf einem konkreten Bug-Report.

### Allgemein
- **Placeholder-Code**: KEINE `// ... restlicher Code`-Kommentare. Jede Datei muss vollständig sein.
- **JSON-Validierung**: NIEMALS manuell generierte JSON-Dateien ungetestet übergeben. Immer mit `node -e "require('./path.json')"` validieren.
- **Dummy-Tests**: KEINE Tests, die Logik nur simulieren (Mocks). Reale Engines (`GameRuntime`, `TaskExecutor`) nutzen.
- **Playwright-Parallelität**: KEINE parallelen Worker bei geteiltem Dev-Server/State. Immer `workers: 1`, `fullyParallel: false`.

### Typsicherheit & Naming
- **Case-Sensitive Typ-Prüfungen**: NIEMALS ohne `.toLowerCase()` für Flow-Elemente.
- **Rename-Vakuum**: NIEMALS Namen im Inspector ändern ohne `RefactoringManager`-Synchronisation.
- **ID-Instabilität**: NIEMALS Namen als Primärschlüssel für Flow-Diagramme, wenn Umbenennung möglich ist.
- **findObjectById**: `EditorCommandManager.findObjectById` muss Objekte via String-Namen auflösen. Basis-Tasks/Actions müssen als Entity gefunden werden, sonst greift Refactoring ins Leere.

### Flow-Editor & Sync
- **Two-Way-Binding bei Umbenennungen**: Flow-Nodes niemals ohne eindeutige Node-ID in `project.actions` synchronisieren. Sonst erkennt der Validator die bearbeitete Action als Duplikat.
- **FlowEditor isDirty-Guard**: Externe Aufrufer MÜSSEN `syncToProjectIfDirty()` statt `syncToProject()` verwenden. Letzteres überschreibt die `actionSequence` auch ohne Änderungen.
- **initMediator store-dispatch**: Bei Originator `'store-dispatch'` KEIN `refreshAllViews()` — nur `render()`. Sonst springen Drag-Objekte zurück.
- **projectRef in FlowNodeFactory**: NIEMALS die Zuweisung vergessen für neue Knoten-Typen.
- **deleteAction Sub-Typen**: Beim Löschen ALLE Sub-Typen (`DataAction`, `HttpAction`) im Filter berücksichtigen.
- **FlowSyncManager Condition Anchors**: Branch-Erkennung: `startAnchorType: 'right'` (True) und `'bottom'` (False) + Flags `isTrueBranch`/`isFalseBranch` als OR-Bedingung prüfen.
- **Action Scopes**: Actions MÜSSEN im selben `actions`-Array liegen wie die nutzenden Tasks. Blueprint-Task → Blueprint-Action, sonst: kaputte Fallback-Dummys.
- **Action-Typ Inferierung**: `ActionExecutor` braucht das `type`-Feld. Flow-Editor-Aktionen ohne `type` MÜSSEN zur Laufzeit inferiert werden (`target` + `changes` → `property`).

### Inspector
- **getOriginalObject() findet keine FlowNodes**: FlowActions haben UUIDs als `.id`, die NICHT in `project.actions` vorkommen. Persistenz AUSSCHLIESSLICH über `FlowNodeHandler.handlePropertyChange()`.
- **resolveValue – Doppelte Template-Auflösung**: Werte mit `${...}`-Templates dürfen NICHT erneut durch den Template-Parser.
- **Variable Picker**: Immer `VariablePickerDialog.show()` verwenden, nicht `prompt()`.
- **Parameter-Typ-Umbau**: Bei jedem Umbau (String→Object) die GESAMTE Rendering-Kette validieren. Fehlender Playwright-Test → User warnen.
- **IInspectable.applyChange() Umgehung**: Wenn das Objekt `IInspectable` implementiert, MUSS `applyChange()` gerufen werden. Nicht direkt via `PropertyHelper` im `data`-Objekt manipulieren.

### Serialization & Hydration
- **Serialization reservedKeys**: Read-Only Properties MÜSSEN in `Serialization.ts` → `reservedKeys` stehen. Sonst: `TypeError: Cannot set property which has only a getter`.
- **Neue Komponenten in hydrateObjects()**: IMMER den `case 'TKomponente':` hinzufügen! Sonst verschwindet die Komponente beim Laden.
- **hydrateObjects() Instanz-Wiederverwendung**: Bei Service-Komponenten VOR `init()/start()` ein Force-Reset durchführen (`stop()` + `isActive = false`).

### Rendering & Performance
- **console.log in Game-Loop-Pfaden**: NIEMALS in 60Hz-Funktionen (`update()`, `loop()`, `renderLogs()`). Blockiert den Main-Thread.
- **translate3d überschreiben**: NIEMALS `el.style.transform = obj.style.transform` im RunMode wenn letzteres leer sein kann. Custom-Transforms AN das berechnete `translate3d` anhängen.
- **Sprite-Rendering**: NIEMALS den vollen `editor.render()`-Pfad für Sprite-Positionen. `spriteRenderCallback` in `GameLoopManager` nutzen. CSS-Transitions auf Sprites vermeiden.
- **handleRuntimeEvent() – Kein doppeltes Render**: Events triggern über GlobalListener bereits ein Render.
- **CSS background-image für Sprites**: NIEMALS im RunMode. CPU-Rasterung bei `translate3d` → Jitter. Immer natives `<img>`-Tag verwenden.
- **isHiddenInRun**: MUSS in `renderObjects()` explizit geprüft werden. Wird NICHT durch `obj.visible` abgedeckt.
- **SPRITE_PROPS Filter**: JEDE TSprite-Property im 60Hz Fast-Path MUSS im `SPRITE_PROPS`-Filter stehen (`x, y, velocityX, velocityY, errorX, errorY, visible`).
- **Doppel-Loops**: NIEMALS einen zweiten `requestAnimationFrame`-Ticker neben dem `GameLoopManager`. Verursacht Physics-Jitter.

### Runtime-Spezifisch
- **Kein window.editor in Komponenten**: Laufzeit-Komponenten (`TWindow`, `TSprite`, etc.) dürfen NICHT auf `(window as any).editor` zugreifen. Context-Daten als Properties injizieren.
- **TInputController.start()/stop()**: NICHT für Keyboard-Listener nutzen. `EditorRunManager.setupKeyboardListeners()` verwaltet Window-Listener direkt.
- **GameRuntime.start() und Splash-Screen**: Bei aktivem Splash wird `initMainGame()` NICHT aufgerufen. Komponenten, die vorher funktionieren müssen, extern initialisieren.
- **resolveTarget**: IMMER `context.eventData` als 4. Argument übergeben (enthält `{self, other, hitSide}`).
- **Ghost-Sprites**: `collisionEnabled` ist standardmäßig `false`. Explizit `"collisionEnabled": true` setzen für Bounce/Hit-Events.
- **Scope Bleeding bei globalen Filtern**: NIEMALS globale `Set`/`Map` über Stage-Iterationen hinweg. Sets für Deduplikation INNERHALB der Stage-Schleife anlegen.
- **String-Conditions bevorzugen**: `"condition": "${hitSide} == 'top'"` statt Objekt-Conditions. Letztere bereinigen Single-Quotes nicht.
- **Calculate-Formeln**: Template-Syntax `${score} + 1` direkt verwenden. Keine Type-Cast-Hacks wie `Number(score || 0) + 1`.
- **Property-Action Format**: `changes` ist ein Schlüssel-Wert-Objekt, `target` ist der visuelle Objektname.

---

## Fachliche Dokumentation

- [🏗️ Architektur & Module](docs/architecture.md)
- [⚙️ Runtime & Execution](docs/runtime-guide.md)
- [📂 Coding Standards](docs/coding-standards.md)
- [🖥️ UI & Inspector Guide](docs/ui-inspector-guide.md)
- [🔍 UseCase Index](docs/use_cases/UseCaseIndex.txt)
- [🤖 AI Agent Integration](docs/AI_Agent_Integration_Plan.md)
- [⚡ Flow Safety (Self-Healing)](docs/coding-standards.md#ai-agent-api--flow-safety)

Letzte Aktualisierung: v3.29.4 (CleanCode Audit & Konsolidierung, 2026-03-31)
