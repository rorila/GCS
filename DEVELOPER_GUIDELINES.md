# Developer Guidelines

> [!CAUTION]
> **PFLICHT-REGEL F?R KI-AGENTEN**: Jede Code-?nderung MUSS mit `npm run test` (oder `run_tests.bat`) validiert werden. Der `docs/QA_Report.md` ist Teil der ?Definition of Done". Tests VOR der Nutzer-Benachrichtigung ausf?hren.

> [!IMPORTANT]
> **CleanCode Transformation ? Phase 1-3 abgeschlossen (v3.22.0)**
> Phase 1 (Unidirektionaler Datenfluss), Phase 2 (Domain Model Trennung) und Phase 3 (Hexagonale Architektur) sind abgeschlossen.
> Phase 4 (E2E-Test-Netz) steht noch aus. Details in `docs/CleanCodeTransformation.md`.
> Bei neuen I/O-Features: `IStorageAdapter` nutzen (`src/ports/IStorageAdapter.ts`). Electron-Kompatibilit?t pr?fen.

---

## 1. Schnellstart & Kernregeln

- **Sprache**: Die gesamte Kommunikation und Dokumentation erfolgt auf Deutsch.
- **Modularisierung**: Max. 1000 Zeilen pro Datei. Bei ?berschreitung: Modul-Aufteilung anwenden.
- **Global Hosting**: Alle globalen Variablen, Komponenten, Tasks und Actions geh?ren in die `stage_blueprint`.
- **GCS_FEATURE_MAP**: Bevor Code gel?scht oder massiv umgebaut wird, MUSS `docs/GCS_FEATURE_MAP.md` gepr?ft werden. Jedes neue Feature dort dokumentieren.
- **Synchronit?t**: ?nderungen in Inspector/Flow-Editor m?ssen konsistent in JSON und Pascal reflektiert werden.
- **ComponentSchema (Agent-Wissensbasis)**: Neue Komponenten MÃœSSEN im passenden Schema-Modul unter `docs/schemas/` dokumentiert werden (Properties, Methods, Events, Beispiel). Der `SchemaLoader` (`src/services/SchemaLoader.ts`) merged alle Module beim Start und Ã¼bergibt sie an `AgentController.setComponentSchema()`. NICHT das monolithische `docs/ComponentSchema.json` direkt editieren â€” es enthÃ¤lt nur die Basis-Definitionen.

## 2. Tooling

| Befehl | Zweck |
|:---|:---|
| `npm run test` | Vollst?ndige Regression-Suite |
| `npm run validate` | Projekt-Validierung |
| `npm run build` | Produktions-Build |
| `npm run bundle:runtime` | Runtime-Bundle (zwingend nach Runtime-?nderungen!) |

## 3. State & Datenfluss

> [!IMPORTANT]
> **JSON ist die einzige Wahrheit (SSoT).** Alle Editoren (Flow, Inspector, Pascal) schreiben ?nderungen in die JSON-Daten. Aus JSON werden Stages und Flow-Diagramme beim Laden erzeugt.

- **Single Source of Truth:** `ProjectStore.ts` ist der einzige Weg, das GameProject zu mutieren. Keine direkte Mutation ohne `ProjectStore`-Action!
- **ProjectStore ? setProject() Pflicht:** Bei JEDEM Projektwechsel (`Editor.setProject()`, Fallback-Pfad in `EditorDataManager.loadProject()`) MUSS `projectStore.setProject(project)` aufgerufen werden. Ohne diesen Aufruf arbeitet der Store mit einer veralteten Referenz.
- **Undo / Redo:** Der einzige zust?ndige Manager ist der **`SnapshotManager`**. Der alte `ChangeRecorder`/`EditorUndoManager` ist obsolet. Bei jeder Wiederherstellung tauscht der Editor das Projekt tiefgreifend aus (`this.loadProject(JSON)`).
- **Two-Way-Binding Kollisionen:** Vermeide direkte Schreibzugriffe auf `obj.name` ?ber UI-Events, *bevor* eine zentrale Validierung wie `EditorCommandManager.renameObject` angesto?en wird! Der `EditorCommandManager` muss die Mutation sicher atomar durchf?hren.
- **Vermeidung redundanter Render-Zyklen:** `.onChange()` Listener filtern `{x, y, isEditorSelected, width, height, isMoving, isHiddenInRun}` heraus, wenn diese ohnehin zu 60FPS durch lokale Animationen geregelt werden.
- **DO NOT:** Die Abfrage `obj.scope === 'global'` verwenden, um Objekte exklusiv als Variablen zu klassifizieren! RegulÃ¤re Stage-Komponenten (Buttons, Images), die sich auf der Blueprint-Stage befinden, erben ebenfalls den Scope `global`. Nutze stattdessen immer das spezifische Flag `obj.isVariable` fÃ¼r strikte TypprÃ¼fungen bei Refactoring-Analysen.

### Speichermanagement (aktualisiert v3.22.0)
- **Adapter-basiert**: `ProjectPersistenceService` delegiert an `IStorageAdapter`-Implementierungen. Kein direkter `fetch()`- oder `localStorage`-Zugriff in Business-Logik.
- **Dirty-Flag Pflicht**: Jede ?nderung MUSS das `isProjectDirty`-Flag setzen (automatisch ?ber `MediatorEvents.DATA_CHANGED`).
- **Zustands-Reset**: Nach `saveProject` oder `loadProject` das Flag zwingend auf `false` setzen.
- **Initial-Load Originator**: Beim ersten Laden `notifyDataChanged(project, 'editor-load')` verwenden, damit das Dirty-Flag nicht sofort auf `true` springt.
- **isProjectDirty ? Originator pr?fen**: In `EditorViewManager.initMediator` wird `isProjectDirty = true` NUR bei echten User-?nderungen gesetzt. Events mit `'editor-load'` oder `'autosave'` werden ignoriert.
- **saveProjectToFile ? Reihenfolge**: `isProjectChangeAvailable.defaultValue` und `isProjectDirty` m?ssen VOR `JSON.stringify` zur?ckgesetzt werden.
- **loadProject ? isProjectDirty**: `isProjectDirty=false` muss NACH `setProject()` und `notifyDataChanged()` gesetzt werden (synchron + `setTimeout(100)`).

## 4. Inspector & Flow-Editor

### Synchronisation
- **Persistenz von Flow-Nodes**: Der `FlowNodeHandler` muss globale Listen (`project.actions`) UND `flowCharts` durchsuchen, um ?unlinked" Actions zu finden.
- **Typ-Wechsel**: Bei ?nderungen des Aktions-Typs im Inspector `mediatorService.notifyDataChanged` aufrufen.
- **Server-Sync**: `EditorDataManager.updateProjectJSON` nutzt `JSON.stringify()` direkt ?ber die Adapter-Architektur.

### Inspector-Patterns
- **IInspectable (v3.14.0)**: Flow-Objekte implementieren `getInspectorSections()`. ?nderungen ?ber `eventHandler.handleControlChange()` delegieren. `applyChange()` nur f?r Re-Render-Checks (Typ-Wechsel). Neue Flow-Objekte M?SSEN `getInspectorSections()` implementieren.
- **TComponent IInspectable (v3.14.3)**: Alle UI-Komponenten implementieren automatisch `IInspectable` ?ber `TComponent`. Neue Gruppen-Icons in `GROUP_ICONS` Map in `TComponent.ts` hinzuf?gen.
- **Inspector-Typen im Model-Layer (v3.21.0)**: `TPropertyDef`, `InspectorSection`, `IInspectable` leben in `src/model/InspectorTypes.ts`. NICHT aus `src/editor/inspector/types` importieren.
- **Inspector-Typen**: `type: "color"` zeigt Farbw?hler, `inline: true` gruppiert horizontal.
- **Inspector Dropdowns**: Alle Listen f?r Tasks, Actions und Variablen ?ber `ProjectRegistry.getTasks('all')` etc. speisen. Events-Dropdown in `InspectorContextBuilder.ts`: `getTasks('all')` statt `getTasks('active')`.
- **FlowAction Proxy-Regel**: Neue Felder in `StandardActions.ts` oder `action_rules.json` M?SSEN auch als Getter/Setter in `FlowAction.ts` implementiert werden. In `mapParameterTypeToInspector()` MUSS `'object'` auf `'select'` gemappt werden.
- **Geometrie-Plausi (v3.23.0)**: `x/y/width/height` in `TWindow.getInspectorProperties()` haben **dynamische** min/max basierend auf `coreStore.getActiveStage().grid`. Negative Positionen sind **nicht erlaubt** (min: 0). Regel: `x + width <= cols`, `y + height <= rows`. Neue Komponenten, die TWindow erben, profitieren automatisch.
- **E2E-Tests**: Input name=`{propName}Input`, Select name=`controlName || propName`.

### SyncValidator (v3.14.1)
- Nach jeder `syncToProject()` pr?ft `SyncValidator.validate()` automatisch 6 Konsistenzregeln.
- Bei neuen Sync-relevanten Datenstrukturen: Validierungsregel in `SyncValidator.ts` erg?nzen.
- **Sync-Blacklist**: Die `taskFields` Liste in `FlowSyncManager.ts` darf keine Felder enthalten, die f?r Aktionen essentiell sind (`value`, `params`, `body`, `source`).

## 5. Flow-Editor & Verbindungen

- **Flow-Typen**: Typ-Bezeichner (`getType()`) m?ssen IMMER kleingeschrieben sein ('task', 'action').
- **Floating Connections**: Der `FlowGraphHydrator` nutzt Koordinaten als Fallback, wenn keine Node-Zuweisung existiert.
- **Drag-Stabilit?t**: `pointer-events: none` auf Linien beim Ziehen von Verbindungen setzen.
- **Race-Conditions**: Kein `autoSaveToLocalStorage` w?hrend des aktiven Drag-Vorgangs. `selectConnection` erst NACH `AttachEnd`.
- **Rendering & Scaling**: Neue UI-Komponenten (TDataList) m?ssen explizit im `StageRenderer` registriert sein.

### Task/Action Speicherort
- Tasks und Actions geh?ren in `stage.tasks` / `stage.actions` der **aktiven Stage**.
- Globale Elemente geh?ren in die **Blueprint-Stage** (`s.type === 'blueprint'`).
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
- `buildSequence(targetId)` f?gt Actions zur Sequenz hinzu
- Action-Name: `node.data?.name || node.properties?.name`

## 6. Run-Mode & Rendering

- **Koordinaten & Dimensionen**: In `GameRuntime.getObjects()` Bindings f?r x, y, width, height explizit via `resolveCoord` aufl?sen.
- **Blueprint-Objekte**: Service-Objekte und globale Variablen nur auf der `blueprint`-Stage anzeigen (`this.host.isBlueprint`).
- **Variablen-Visualisierung**: Variablen zeigen Name + aktuellen Wert in Klammern an.
- **Stage-Vererbung**: NIEMALS `inheritsFrom` f?r Stage-zu-Stage Vererbung. Nur Blueprint-Merge erlaubt.

## 7. Logging & Diagnose

- **Keine `console.log`**: NIEMALS `console.log`, `console.warn` oder `console.error` direkt im Produktivcode verwenden.
- **Logger-Pflicht**: Immer den zentralen Logger nutzen: `private static logger = Logger.get('ClassName', 'UseCaseId');`
- **UseCases**: Logs einem funktionalen UseCase zuordnen (siehe `UseCaseManager.ts`).
- **Fehler**: `logger.error` wird immer angezeigt. `debug/info/warn` nur, wenn der UseCase im Inspector aktiv ist.
- **Circular Deps**: Bei Utility-Modulen auf kreisf?rmige Abh?ngigkeiten achten (siehe Filter-Pattern in `Logger.ts`).
- **Logging-Pr?fix**: `[TRACE]` f?r die Synchronisierungs-Pipeline (SyncManager/Hydrator/Manager).

## 8. Action-Persistenz & Suche

- **Index-Lookup**: F?r Action-/Task-Definitionen immer `ProjectRegistry.getActions('all')` bzw. `getTasks('all')` nutzen (SSoT-Prinzip: Referenzen auf Original-Objekte im RAM).
- **Broad-Field Matching**: Suche robust ?ber `data.actionName`, `data.name`, `properties.name`, `properties.text` (da Flow-Actions oft unvollst?ndig sind).
- **Case-Insensitivity**: Namen immer Case-Insensitive vergleichen, `.trim()` verwenden.
- **Bereinigung**: `SanitizationService` entfernt automatisch verwaiste Action-Referenzen aus Sequenzen.

## 9. Best Practices

- **Interface Konsistenz**: Host-Objekte f?r Manager-Klassen m?ssen Anforderungen in einem dedizierten Interface definieren. Siehe `IViewHost` in `EditorViewManager.ts`.
- **GCS Dashboard Pattern**: F?r Dashboards `TTable` im `displayMode: "cards"` verwenden. Datenquellen: `TObjectList`-Variablen in der `stage_blueprint`.
- **Expert-Wizard Dynamisierung**: In der Regel-JSON `type: "select"` und `options: "@objects"` verwenden. Aufl?sung zur Laufzeit via `ProjectRegistry`.
- **Expert-Wizard Prompts**: Platzhalter in geschweiften Klammern (z.B. `"Wert f?r {target}.{property}?"`) werden automatisch durch Session-Werte ersetzt.
- **ComponentData vs TWindow**: Im Datenmodell `ComponentData[]` verwenden. `TWindow` nur wo Methoden aufgerufen werden (`Serialization.ts`, `GameRuntime.ts`).
- **Storage ?ber IStorageAdapter**: Neuer I/O-Code MUSS ?ber `IStorageAdapter` laufen (`src/ports/IStorageAdapter.ts`). Adapter in `src/adapters/`.
- **Electron-Vorbereitung**: `NativeFileAdapter` erwartet `window.electronFS`-IPC-Bridge. Kein `showSaveFilePicker` ohne Fallback.

## 10. Architektur-Hinweise (Sync-Strategie)

- **Aktueller Zustand:** Bidirektionaler Sync zwischen Flow-Graph-Objekten ? JSON (`FlowSyncManager.ts`). Funktioniert, war aber fehleranf?llig.
- **Ziel-Architektur:** Unidirektionaler Datenfluss ? Editoren schreiben direkt JSON-Patches, Views rendern nur aus JSON.
- **Pragmatik:** Solange Sync stabil l?uft ? nicht anfassen. Tests sind das Sicherheitsnetz. Bei Sync-Problemen ? unidirektionalen Umbau priorisieren.

## 11. LLM-Trainingsdaten

> [!IMPORTANT]
> Ziel: Ein lokales LLM (3-7B Parameter) finetunen, das aus nat?rlicher Sprache GCS-Komponenten ?ber die `AgentController`-API erzeugt.

- **Export-Trigger:** Nach Feature-Implementierungen den `TrainingDataExporter` (`src/tools/TrainingDataExporter.ts`) ausf?hren.
- **Format:** JSONL-Paare aus nat?rlichsprachigem Input und AgentController-API-Aufrufen.
- **Speicherort:** `data/training/` im Projektroot.
- **Varianten:** Pro Use Case min. 3 nat?rlichsprachige Input-Varianten.
- **Validierung:** Outputs gegen `src/tools/agent-api-schema.json` validieren.
- **Tooling:** QLoRA-Finetuning mit [Unsloth](https://github.com/unslothai/unsloth), Modelle: Phi-3-mini (3.8B) oder Qwen2.5-7B.

## 12. Object Pooling f?r dynamische Sprites

- **Problem**: `spawnObject`-Aufrufe erzeugten ?Geister-Sprites" (Logik-Objekte ohne DOM-Elemente).
- **L?sung:** Object Pool Pattern (`SpritePool.ts`). Alle Instanzen werden VOR `initMainGame` vorhydriert.
- **Verwendung:**
  1. `TSpriteTemplate` platzieren, `poolSize`, `autoRecycle` und `lifetime` konfigurieren.
  2. Action `spawn_object` nutzt eine Pool-Instanz (Clone). Position/Velocity wird tempor?r ?berschrieben.
  3. Action `destroy_object` (`Target: %Self%`) blendet aus und legt ins Pool zur?ck (`visible: false`).
- **Performance:** Die GameLoop ?berspringt alle `visible: false` Objekte.

---

## 13. DO NOT ? Verbotsliste (Anti-Patterns & Regression-Pr?vention)

> [!CAUTION]
> Die folgenden Regeln verhindern bekannte Regressionen. Jeder Eintrag basiert auf einem konkreten Bug-Report.

### Allgemein
- **Placeholder-Code**: KEINE `// ... restlicher Code`-Kommentare. Jede Datei muss vollst?ndig sein.
- **Node/PowerShell String-Injection**: NIEMALS Code-Edits ?ber `node -e "..."` in der PowerShell ausf?hren, da Backticks und `${...}` unvorhersehbar interpoliert werden. IMMER die nativen `replace_file_content`-Tools verwenden!
- **PowerShell Syntax**: NIEMALS `&&` zur Verkettung von Befehlen verwenden (f?hrt zu `ParserError`). IMMER das Semikolon `;` zur Verkettung nutzen (z.B. `git add . ; git commit -m "..."`).
- **JSON-Validierung**: NIEMALS manuell generierte JSON-Dateien ungetestet ?bergeben. Immer mit `node -e "require('./path.json')"` validieren.
- **Dummy-Tests**: KEINE Tests, die Logik nur simulieren (Mocks). Reale Engines (`GameRuntime`, `TaskExecutor`) nutzen.
- **Playwright-Parallelit?t**: KEINE parallelen Worker bei geteiltem Dev-Server/State. Immer `workers: 1`, `fullyParallel: false`.

### Typsicherheit & Naming
- **Case-Sensitive Typ-Pr?fungen**: NIEMALS ohne `.toLowerCase()` f?r Flow-Elemente.
- **Rename-Vakuum**: NIEMALS Namen im Inspector ?ndern ohne `RefactoringManager`-Synchronisation.
- **ID-Instabilit?t**: NIEMALS Namen als Prim?rschl?ssel f?r Flow-Diagramme, wenn Umbenennung m?glich ist.
- **findObjectById**: `EditorCommandManager.findObjectById` muss Objekte via String-Namen aufl?sen. Basis-Tasks/Actions m?ssen als Entity gefunden werden, sonst greift Refactoring ins Leere.

### Flow-Editor & Sync
- **Two-Way-Binding bei Umbenennungen**: Flow-Nodes niemals ohne eindeutige Node-ID in `project.actions` synchronisieren. Sonst erkennt der Validator die bearbeitete Action als Duplikat.
- **FlowEditor isDirty-Guard**: Externe Aufrufer M?SSEN `syncToProjectIfDirty()` statt `syncToProject()` verwenden. Letzteres ?berschreibt die `actionSequence` auch ohne ?nderungen.
- **initMediator store-dispatch**: Bei Originator `'store-dispatch'` KEIN `refreshAllViews()` ? nur `render()`. Sonst springen Drag-Objekte zur?ck.
- **projectRef in FlowNodeFactory**: NIEMALS die Zuweisung vergessen f?r neue Knoten-Typen.
- **deleteAction Sub-Typen**: Beim L?schen ALLE Sub-Typen (`DataAction`, `HttpAction`) im Filter ber?cksichtigen.
- **FlowSyncManager Condition Anchors**: Branch-Erkennung: `startAnchorType: 'right'` (True) und `'bottom'` (False) + Flags `isTrueBranch`/`isFalseBranch` als OR-Bedingung pr?fen.
- **Action Scopes**: Actions M?SSEN im selben `actions`-Array liegen wie die nutzenden Tasks. Blueprint-Task ? Blueprint-Action, sonst: kaputte Fallback-Dummys.
- **Action-Typ Inferierung**: `ActionExecutor` braucht das `type`-Feld. Flow-Editor-Aktionen ohne `type` M?SSEN zur Laufzeit inferiert werden (`target` + `changes` ? `property`).

### Inspector
- **getOriginalObject() findet keine FlowNodes**: FlowActions haben UUIDs als `.id`, die NICHT in `project.actions` vorkommen. Persistenz AUSSCHLIESSLICH ?ber `FlowNodeHandler.handlePropertyChange()`.
- **resolveValue ? Doppelte Template-Aufl?sung**: Werte mit `${...}`-Templates d?rfen NICHT erneut durch den Template-Parser.
- **Variable Picker**: Immer `VariablePickerDialog.show()` verwenden, nicht `prompt()`.
- **Parameter-Typ-Umbau**: Bei jedem Umbau (String?Object) die GESAMTE Rendering-Kette validieren. Fehlender Playwright-Test ? User warnen.
- **IInspectable.applyChange() Umgehung**: Wenn das Objekt `IInspectable` implementiert, MUSS `applyChange()` gerufen werden. Nicht direkt via `PropertyHelper` im `data`-Objekt manipulieren.
- **Select-Dropdowns ohne Leer-Option**: Wenn ein `type: 'select'`-Feld mit `source:` eine dynamische Liste l?dt und der Initialwert leer (`''`) ist, MUSS die Optionsliste eine Leer-Option `{ value: '', label: '? Keine ?' }` enthalten. Ohne sie kann der User nicht von "leer" auf einen Wert wechseln, weil kein `onchange`-Event feuert (Browser-Default identisch mit erstem Eintrag).

### Serialization & Hydration
- **Serialization reservedKeys**: Read-Only Properties M?SSEN in `Serialization.ts` ? `reservedKeys` stehen. Sonst: `TypeError: Cannot set property which has only a getter`.
- **Neue Komponenten in hydrateObjects()**: IMMER den `case 'TKomponente':` hinzuf?gen! Sonst verschwindet die Komponente beim Laden.
- **hydrateObjects() Instanz-Wiederverwendung**: Bei Service-Komponenten VOR `init()/start()` ein Force-Reset durchf?hren (`stop()` + `isActive = false`).
- **Export DeepClean**: NIEMALS blind Properties mit Unterstrich (`_`) beim `deepClean` / Export l?schen! Interne Vue / Reactivity Properties fangen ebenfalls mit `_` (wie `_backgroundImage` oder `__v_isRef`) an. Nutze stattdessen Whitelists (wie `__v_isRef`) und bereinige nur explizite Editor-Metadaten.

### Rendering & Performance
- **console.log in Game-Loop-Pfaden**: NIEMALS in 60Hz-Funktionen (`update()`, `loop()`, `renderLogs()`). Blockiert den Main-Thread.
- **translate3d ?berschreiben**: NIEMALS `el.style.transform = obj.style.transform` im RunMode wenn letzteres leer sein kann. Custom-Transforms AN das berechnete `translate3d` anh?ngen.
- **Sprite-Rendering**: NIEMALS den vollen `editor.render()`-Pfad f?r Sprite-Positionen. `spriteRenderCallback` in `GameLoopManager` nutzen. CSS-Transitions auf Sprites vermeiden.
- **handleRuntimeEvent() ? Kein doppeltes Render**: Events triggern ?ber GlobalListener bereits ein Render.
- **CSS background-image f?r Sprites**: NIEMALS im RunMode. CPU-Rasterung bei `translate3d` ? Jitter. Immer natives `<img>`-Tag verwenden.
- **isHiddenInRun**: MUSS in `renderObjects()` explizit gepr?ft werden. Wird NICHT durch `obj.visible` abgedeckt.
- **SPRITE_PROPS Filter**: JEDE TSprite-Property im 60Hz Fast-Path MUSS im `SPRITE_PROPS`-Filter stehen (`x, y, velocityX, velocityY, errorX, errorY, visible`).
- **Doppel-Loops**: NIEMALS einen zweiten `requestAnimationFrame`-Ticker neben dem `GameLoopManager`. Verursacht Physics-Jitter.

### Runtime-Spezifisch
- **Kein window.editor in Komponenten**: Laufzeit-Komponenten (`TWindow`, `TSprite`, etc.) d?rfen NICHT auf `(window as any).editor` zugreifen. Context-Daten als Properties injizieren.
- **TInputController.start()/stop()**: NICHT f?r Keyboard-Listener nutzen. `EditorRunManager.setupKeyboardListeners()` verwaltet Window-Listener direkt.
- **GameRuntime.start() und Splash-Screen**: Bei aktivem Splash wird `initMainGame()` NICHT aufgerufen. Komponenten, die vorher funktionieren m?ssen, extern initialisieren.
- **resolveTarget**: IMMER `context.eventData` als 4. Argument ?bergeben (enth?lt `{self, other, hitSide}`).
- **Ghost-Sprites**: `collisionEnabled` ist standardm??ig `false`. Explizit `"collisionEnabled": true` setzen f?r Bounce/Hit-Events.
- **Scope Bleeding bei globalen Filtern**: NIEMALS globale `Set`/`Map` ?ber Stage-Iterationen hinweg. Sets f?r Deduplikation INNERHALB der Stage-Schleife anlegen.
- **String-Conditions bevorzugen**: `"condition": "${hitSide} == 'top'"` statt Objekt-Conditions. Letztere bereinigen Single-Quotes nicht.
- **Calculate-Formeln**: Template-Syntax `${score} + 1` direkt verwenden. Keine Type-Cast-Hacks wie `Number(score || 0) + 1`.
- **Property-Action Format**: `changes` ist ein Schl?ssel-Wert-Objekt, `target` ist der visuelle Objektname.

---

## Fachliche Dokumentation

- [??? Architektur & Module](docs/architecture.md)
- [?? Runtime & Execution](docs/runtime-guide.md)
- [?? Coding Standards](docs/coding-standards.md)
- [??? UI & Inspector Guide](docs/ui-inspector-guide.md)
- [?? UseCase Index](docs/use_cases/UseCaseIndex.txt)
- [?? AI Agent Integration](docs/AI_Agent_Integration_Plan.md)
- [? Flow Safety (Self-Healing)](docs/coding-standards.md#ai-agent-api--flow-safety)

Letzte Aktualisierung: v3.30.0 (TImageList+TSprite Integration & Bugfix, 2026-04-02)

### Inspector visibleWhen Fallstricke
- **DO NOT**: Verlassen Sie sich bei Dropdowns nicht darauf, dass der Inspector automatisch verbundene \isibleWhen\-Sektionen neu zeichnet.
- **DO**: Sorgen Sie in \FlowAction.ts\ -> \pplyChange\ zwingend daf?r, dass bei allen Attributen (wie \	ype\, \ctionType\, \effect\), die andere visuelle Ausgaben steuern, \	rue\ zur?ckgegeben wird, damit ein voller Re-Render getriggert wird!

### Z-Index und StageRendering
- **DO**: Stelle in der \StageRenderer.ts\ bei der Sortierung der Elemente immer sicher, dass bei gleichem \zIndex\ die Hierarchie bedacht wird (\getDepth()\). Kinder m?ssen im DOM nach den Eltern eingef?gt werden (h?herer Index im Array), sonst fangen die Layer der Eltern (z.B. bei TGroupPanel) Pointer-Events wie Klicks ab und die Kinder werden in der GUI unmarkierbar/unabgreifbar.


### TypeScript any-Audit Regeln
- **DO**: Verwende \unknown\ statt \ny\ bei unbekanntem Input (API-Responses, JSON.parse). \unknown\ erzwingt Type Guards.
- **DO**: Verwende \Record<string, unknown>\ statt \Record<string, any>\ f?r generische Key-Value-Maps.
- **DO NOT**: \ny\ als Default-Typ verwenden. Frage: 'Kenne ich die Shape des Werts?' ? Wenn ja, tippe es.
- **DO NOT**: \s any\ ohne Kommentar. Wenn du casten musst, dokumentiere warum.
- **ERLAUBT**: Index-Signaturen (\[key: string]: any\) bei offenen Schemas (z.B. ComponentData) ? M?SSEN aber kommentiert sein.
- **Referenz**: Vollst?ndiges Audit-Dokument unter \ToDoList/TypeScript_Any_Audit.md\`n


 # # #   R U N T I M E   &   E X P O R T 
 -   * * S t a n d a l o n e   E x p o r t   T e s t i n g : * *   D e r   S t a n d a l o n e   E x p o r t   g r e i f t   a u f   e i n   v o r k o m p i l i e r t e s   B u n d l e   z u r ? c k .   W e n n   d e r   C o d e   i m   \ s r c / \   V e r z e i c h n i s   b e z ? g l i c h   d e r   L a u f z e i t   o d e r   d e n   K o m p o n e n t e n   v e r ? n d e r t   w u r d e ,   M U S S   z w i n g e n d   \ 
 p m   r u n   b u n d l e : r u n t i m e \   a u s g e f ? h r t   w e r d e n ,   b e v o r   d e r   n e u e   S t a n d   i m   E x p o r t   g e t e s t e t   w e r d e n   k a n n .   S o n s t   w i r d   d i e   a l t e   \ p u b l i c / r u n t i m e - s t a n d a l o n e . j s \   b e n u t z t ! 
 
 
## Testing Standalone Execution
- Always use the **Run (IFrame)** tab in the Editor to test gameplay exactly how it behaves in full Standalone mode. The IFrame isolates memory and fully replicates Export logic by consuming GameExporter.getCleanProject(). The legacy DOM-based 'Run' tab may drift from standalone behavior.


### Touch & Input Simulation
- **DO**: Nutze f?r Multiplatform-UI immer \PointerEvent\ (\pointerdown\, \pointerup\) anstatt \MouseEvent\ (\mousedown\, \mouseup\), da diese nativ f?r Touch, Stift und Maus funktionieren.
- **DO**: Stelle sicher, dass synthetische Browser-Events (z.B. Keyboard-Simulationen f?r das TInputController-Objekt) via \document.dispatchEvent(new KeyboardEvent(...))\ abgefeuert werden, damit die GameRuntime und eventuelle React/Native Event-Listener im Container sie sauber fangen.

 
 # #   G a m e p a d   &   S e r i a l i z a t i o n   L e s s o n s   L e a r n e d   ( v 3 . x ) 
 -   * * D O   N O T * *   c r e a t e   a   n e w   c o m p o n e n t   c l a s s   ( e . g .   \ T V i r t u a l G a m e p a d \ )   w i t h o u t   i m m e d i a t e l y   a d d i n g   i t   t o   t h e   \ h y d r a t e O b j e c t s \   s w i t c h - s t a t e m e n t   i n   \ s r c / u t i l s / S e r i a l i z a t i o n . t s \ .   F a i l i n g   t o   d o   s o   c a u s e s   t h e   c o m p o n e n t   t o   b e   s i l e n t l y   d r o p p e d   d u r i n g   p r o j e c t   l o a d   o r   I F r a m e   e x p o r t ! 
 -   * * D O   N O T * *   d i s p a t c h   s y n t h e t i c   \ K e y b o a r d E v e n t \ s   w i t h o u t   \ {   b u b b l e s :   t r u e   } \   i f   y o u   e x p e c t   g l o b a l   w i n d o w   l i s t e n e r s   ( l i k e   t h e   \ G a m e R u n t i m e \   l o o p )   t o   c a p t u r e   t h e m .   T o u c h   O v e r l a y s   m u s t   s t r i c t l y   u s e   b u b b l i n g   e v e n t s . 
 
 
 
### iOS Safari Double-Tap Zoom Praevention
- **DO NOT**: Setzen Sie Flaechen, die keine Interaktionselemente sind (wie grosse Layout-Zonen, leftZone, rightZone), **niemals** auf pointer-events: auto;. Wenn verfehlt wird, gehen diese Touch-Events sonst passiv an den Browser weiter und loesen den nativen iOS Safari Double-Tap-Zoom aus.
- **DO**: Legen Sie pointer-events: none auf die nicht-klickbaren Wrapper-Container. Nur die eigentlichen Touch-Flaechen (Buttons) erhalten pointer-events: auto; sowie unbedingt 	ouch-action: none;.
- **DO**: Fuer kritische, schnelle Taps (wie Gamepad-Buttons) faengt Event-Delegation am Haupt-Container mit einem nicht-passiven 	ouchstart-Listener das Event ab und ruft dort ein dediziertes e.preventDefault() auf, sobald das Event auf einer legitimen Schaltflaeche ausgeloest wurde.

## DO NOT: Absolute Pfade in Electron / Export
- **DON'T:** Verwende keine absoluten Pfade (beginnend mit '/'), wenn du referenzierte Assets (z.B. Bilder, iframes) einbindest.
- **DON'T:** Beim Exportieren von Dateien d?rfen Fetch-Aufrufe (wie `fetch('/runtime-standalone.js')`) NIEMALS absolut sein, da die exportierten `.html`-Dateien im Endkunden-Rechner unter `file:///C:/...` l?ufen und der absolute Pfad Root-Traversals erzwingt.
- **DO:** Nutze im Dual-Mode immer relative Pfade (z.B. `./images/Ufos/ufo.png` statt `/images/Ufos/ufo.png`).
- **DO:** F?r dynamische Pfad-Aufl?sung beim Export immer `new URL(relativePath, window.location.href).href` nutzen.

## 10. Vite Dev Server Proxy
- **DO**: Stelle sicher, dass die Proxy-Konfiguration in ite.config.ts f?r den Game-Server (z.B. /api auf http://localhost:8080) korrekt gesetzt ist, falls lokales Speichern via Dev-Server nicht erreichbar ist.
- **DON'T**: Entferne nicht blindlings proxy Server-Konfigurationen aus Vite, wenn nicht-native Backends (wie der game-server) im Einsatz sind.
- **DON'T**: Reiche keine Design-Zeit-JSON-Objekte direkt an die Game-Engine weiter. Die Runtime modifiziert Stages und hydratisiert Objekte doppelt, was Setter (wie 'align') ueberspringt und das originale Design-Data kontaminiert. Nutze immer 'safeDeepCopy' im EditorRunManager.

### Architectural Registries
- **DO NOT** use a monolithic ProjectRegistry. It has been decentralized.
- **DO** use the domain-specific registries under `src/services/registry/` (e.g., `projectObjectRegistry`, `coreStore`) to guarantee single-source-of-truth and avoid circular dependencies.


- **safeDeepCopy() mit Getter-Properties**: Object.keys() und or...in ignorieren Getter/Setter-Properties, die auf dem Prototyp einer Klasse definiert sind (TSprite.backgroundImage). Wenn man Instanzen (TWindow) via generischem JSON.stringify oder manual iterierenden safeDeepCopy klont, gehen diese Properties verloren. **L?sung**: safeDeepCopy pr?fen lassen, ob ein Objekt eine .toDTO()-Methode besitzt, und diese nutzen, da sie alle via getInspectorProperties() deklarierten Getter inkludiert.
- **DO NOT**: Verwenden Sie niemals crypto.randomUUID() implizit in der Editor-/Web-Umgebung. Da das GameBuilder-Projekt sowohl im Browser als auch im nativen Electron-Dual-Mode ohne strikten HTTPS Secure Context l?uft, wird die Web-Crypto-API teils blockiert. Nutzen Sie immer den Fallback: `typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'obj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)`.

### TRichText & HTML Component Hydrierung
- **DO**: Wenn ihr Komponenten erstellt, die HTML injizieren (wie TRichText), legt zwingend .style.color und .style.fontSize im Constructor als Fallback fest. Andernfalls zerbricht das Skalierungssystem der GameRuntime / des Editor-StageRenderers und die Typografien unterscheiden sich zwischen IFrame und Editor eklatant.
- **DO**: Vergiss niemals, _jede_ neue Komponente per `ComponentRegistry.register(ClassName, ...)` am Dateiende zu registrieren, sonst l?scht das Hydrations-System (Serialization.ts) die Component beim Wechsel in den Run-Mode spurlos aus dem RAM!


- **DO NOT**: Erstelle NIEMALS eine neue Component-Property, die per 	oDTO() / safeDeepCopy() serialisiert werden muss, OHNE sie in getInspectorProperties() zu registrieren. Die 	oDTO()-Methode (TComponent.ts) iteriert NUR ueber die von getInspectorProperties() zurueckgegebenen Properties. Fehlt eine Property dort, geht sie beim Deep-Copy (Run-Mode, IFrame-Export) verloren und die Runtime bekommt nur den Konstruktor-Default. Typ 'hidden' verwenden, wenn die Property nicht im Inspector angezeigt werden soll.
- **DO**: Beim Rendering von WYSIWYG-HTML-Inhalten (z.B. TRichText) muessen deprecated <font color> Tags zu <span style="color:..."> konvertiert werden, da <font>-Presentational-Hints (CSS-Spezifitaet 0) von Klassen-Regeln wie .game-object { color: #333 } ueberschrieben werden.
### Inspector Input-Validierung
- **DO**: Jede numerische Property in getInspectorProperties() MUSS min, max und step Werte definieren. Der InspectorSectionRenderer nutzt diese fuer native HTML5-Input-Constraints, Live-Validierung und Auto-Clamping.
- **DO**: Nutze 	ype: 'hidden' fuer Properties die serialisiert (toDTO) aber nicht im Inspector angezeigt werden sollen (z.B. htmlContent bei TRichText).
- **DO NOT**: Akzeptiere keine ungeprueften User-Eingaben im Inspector. Die Validierungs-Pipeline (Live oninput + Auto-Clamp onchange) verhindert ungueltige Werte.
- **DO**: Verwende das alidate Callback in TPropertyDef fuer komponentenspezifische Validierungslogik die ueber min/max hinausgeht.

*   **DO NOT DO INSTANCEOF BEFORE PROXY SAFEGUARDS:** Wenn das proxy \makeReactive\ Pattern benutzt wird, stelle IMMER sicher, dass ein \__isProxy__ === true\ Loop-Schutz an ALLER ERSTER STELLE greift, noch BEVOR \instanceof HTMLElement\ etc. ausgelï¿½st werden. \instanceof\ erzeugt einen Getter-Scope auf \[Symbol.hasInstance]\, welcher bei falsch ineinandergesteckten Proxies sofort eine "Maximum call stack size exceeded"-Rekursionsbombe zï¿½nden kann.


### Autosave, Debouncing & FileSystem Access API Safeguards
- **DO NOT**: Entferne niemals den Debouncer (setTimeout) aus der performDiskSave bzw. updateProjectJSON Aufrufkette im EditorDataManager. Das DOM-Event-System (Drag, Text-Interpolation etc.) triggert massive Mengen an synchronen Saves. Die Chrome FileSystem Access API (createWritable) wirft sofort eine Collision-Exception ("The associated file is already being written"), was das Speichern komplett zerstï¿½rt und den Dev-Server abstï¿½rzen lï¿½sst. Belasse den Disk-Save-Debouncer immer zwingend bei 1000ms.
- **DO NOT**: Entferne niemals die 2-Sekunden-Grace-Period (	imeSinceLoad < 2000) am Anfang der Autosaves. Komponenten feuern im ersten Rendern Post-Load-Events, die ohne diese Guard kï¿½nstliche Speichervorgï¿½nge mit leeren Updates auslï¿½sen.
- **DO NOT**: Im MenuBar.render() wird container.innerHTML = '' ausgefï¿½hrt. Sï¿½mtliche lose per JavaScript assoziierten DOM-Nodes (wie der utosaveWrapper) werden gnadenlos abgetrennt und vom GC gelï¿½scht. Solche dynamischen UI Widgets Mï¿½SSEN am Ende der 
ender() Methode zwingend wieder mit ppendChild() re-attached werden!

### Autosave & UI Interaktionen
- **DO:** Wenn in der UI (z.B. Context Menu) direkte nderungen am in-memory Stage-Objekt durchgefhrt werden (ohne den ProjectStore-Reducer zu durchlaufen), muss zwingend ein leerer UPDATE_PROJECT Dispatch abgesetzt werden: 	his.host.projectStore.dispatch({ type: 'UPDATE_PROJECT' });. Andernfalls blockiert der Debouncer/Grace-Period das Speichern dieser Zustnde dauerhaft (siehe Blueprint Exclusion Fix).


### Runtime & Standalone Player Updates
- **DO:** Wenn du core/runtime/Dateien wie \RuntimeStageManager.ts\, \ReactiveRuntime.ts\ oder Komponenten modifizierst, reicht der normale Vite-HMR (Hot Module Replacement) fï¿½r den Editor vollkommen aus.
- **CRITICAL:** Der IFrame-Player (\Run (IFrame)\ Tab) lï¿½dt jedoch IMMER die kompilierte statische \public/runtime-standalone.js\. Wenn du Funktionalitï¿½t in der Kern-Runtime anpasst, MUSS anschlieï¿½end IMMER \
pm run bundle:runtime\ ausgefï¿½hrt werden, damit deine Code-Fixes auch im IFrame wirksam werden!


### Keydown Events and Active Elements
- **DO**: Use a robust check for document.activeElement before intercepting global keyboard events (like Delete or Backspace or Undo shortcuts). ALWAYS account for isContentEditable and variables that may be inside a shadowRoot.
- **DON'T**: Blindly intercept shortcuts without checking if the user is typing in an input field (e.g. INPUT, TEXTAREA, SELECT, isContentEditable), otherwise users cannot rename or input settings in the Inspector.


- **DO NOT**: Verwenden Sie in Editor-Services NIEMALS native lert(), confirm() oder prompt(). In Electron frieren diese Aufrufe teilweise den Renderer-Thread und den Keyboard-Focus (Cursor-Blinken/Tasteneingaben werden ignoriert) unwiederbringlich ein. Nutzen Sie stattdessen immer die asynchronen HTML-Entsprechungen NotificationToast, ConfirmDialog und PromptDialog.

### Drag & Drop Snipping for Nested Blueprint Panels
- **DO**: When dropping or panning items inside nested containers (especially Blueprint child objects which may have non-integer offsets due to .align configs), **always calculate the snapping on the relative coordinate**, not the absolute stage coordinate. Example: Math.round((absMouseX - parentAbs.x) / cellSize) instead of Math.round(absMouseX / cellSize) - parentAbs.x. Doing the latter will cause a sub-pixel shift against the visual grid boundary.

### Grid Snapping Convention
- **DO**: Use Math.floor(value / cellSize) for snapping raw pixel coordinates to grid coordinates. Components should snap strictly to the grid cell containing their top-left coordinate, rather than jumping to the nearest grid cell at the 50% mark using Math.round. Standardize all snap methods along this convention unless specifically centering.

### Global Stage Alignment for Nested Elements
- **DO**: When dropping or moving elements inside a nested container (e.g. nested Panels), calculate the snapped absolute coordinate based on the Global Stage Grid first (Math.floor(absolutePixel / cellSize)), and THEN subtract the parent absolute grid offset to get the relative local coordinate for storage. This guarantees the nested item always aligns perfectly with the visual stage lines, even if the container is fractionally aligned.

### Read-Only Hit Testing (Blueprint Boundaries)
- **DO**: Filter out isInherited elements during hit-testing for Drag and Drop (handleDrop and handleMouseUp). The Engines internal state manager (reduceReparentObject) structurally prohibits moving cross-stage objects into inherited children arrays because Blueprint components serve as read-only global templates on the Active Stage. Allowing drops over inherited boundaries creates silent desyncs between Visual Grid State and ProjectStore JSON State.

### Animations-Drift bei verschachtelten Containern (TGroupPanel, TPanel, TDialogRoot)
- **DO NOT**: Animiere NIEMALS Kinder von Container-Komponenten (Objekte mit `parentId`) unabhaengig mit positionsbasierten Stage-Animationen (slide-up, Fly-Patterns). Ihre x/y-Koordinaten sind RELATIV zum Parent. Der StageRenderer berechnet die absolute Position rekursiv ueber die parentId-Kette. Wenn sowohl Parent als auch Kind gleichzeitig von Off-Screen einfliegen, entsteht ein doppelter Offset (Kind fliegt eigenstaendig + StageRenderer addiert den animierten Parent-Offset).
- **DO**: Pruefe in `triggerStartAnimation()` immer auf `obj.parentId` und ueberspringe solche Objekte bei Positions-Tweens. Kinder bewegen sich automatisch mit ihrem animierten Parent-Container mit.
- **AUSNAHME**: Opacity-Animationen (fade-in) muessen auch Kinder einschliessen, da die DOM-Elemente flach im Stage-Container liegen und CSS-Opacity nicht kaskadiert.

### IFrame-Runner: Container-Kinder im Fast-Path Rendering
- **DO NOT**: Erzwinge NIEMALS Full-Render-Zyklen (`needsFullRender = true` in `GameRuntime` oder Bypasses in `GameLoopManager`) nur weil animierte Objekte Kinder besitzen. Full-Renders verursachen Layout-Thrashing (Browser-Freezes) und zerstÃ¶ren flÃ¼ssige Animationen bei 60fps.
- **DO**: Sorge dafÃ¼r, dass PositionsÃ¤nderungen (`x`, `y`) JEDES Objekts ausschlieÃŸlich Ã¼ber den asynchronen 60fps Fast-Path (`StageRenderer.updateSpritePositions`) laufen. Die Berechnungslogik innerhalb von `updateSpritePositions` iteriert rekursiv Ã¼ber alle Eltern (`parentId`), um absolute Screen-Koordinaten zu addieren und verschiebt abhÃ¤ngige DOM-Kinder hardwarebeschleunigt in Echtzeit mit.
- **WICHTIG**: Beim Bearbeiten von IFrame/Player-spezifischem Code immer `npm run bundle:runtime` aufrufen. Der Run(IFrame)-Modus nutzt keinen Live-Dev-Server, sondern serviert `public/runtime-standalone.js`.

### GameRuntime: getObjects() vs. getRawObject() - Mutations-Regel
- **DO NOT**: Verwende GameRuntime.getObjects() NIEMALS fuer direkte Mutations-Operationen auf Objekten (z.B. obj.visible = false). getObjects() erstellt fuer jedes Objekt eine Spread-Kopie. Mutationen auf diesen Kopien werden vom ReactiveProperty-Proxy und PropertyWatcher NICHT registriert und haben KEINEN Effekt auf den Backend-State.
- **DO**: Nutze stets GameRuntime.getRawObject(id) wenn du Properties eines Runtime-Objekts waehrend der Laufzeit mutieren willst. Diese Methode gibt das echte reaktive Proxy-Objekt aus this.objects zurueck.
- **BEISPIEL**: Der X-Button Handler in ComplexComponentRenderer nutzt ctx.host.runtime.getRawObject(id) und dann .visible = false direkt darauf.

### Flache parentId-Kinder vs. children-Array
- **DO NOT**: Verlasse dich in `GameRuntime.getObjects()` NICHT ausschliesslich auf die `obj.children`-Rekursion, um alle Kinder eines Containers zu erreichen. Projekte koennen Kinder als flache Objekte mit `parentId` auf derselben Ebene wie den Container definieren (statt als verschachteltes `children`-Array). Diese â€žverwaisten" Kinder muessen nach der children-Rekursion separat eingesammelt werden.
- **DO**: Pruefe nach `process(topLevelObjects)` in `getObjects()` immer, ob Objekte mit `parentId` existieren, die nicht ueber die Rekursion erreicht wurden, und fuege sie mit korrekter Getter-Kopie und zIndex-Berechnung in die Ergebnisliste ein.
- **HINTERGRUND**: Im Edit-Modus (`getResolvedInheritanceObjects()`) werden alle Objekte flach zurueckgegeben â€” inklusive der parentId-Kinder. Im Run-Modus (`getObjects()`) filtert `topLevelObjects = this.objects.filter(o => !o.parentId)` diese jedoch heraus. Wenn der Container kein `children`-Array hat, verschwinden die Kinder komplett.

### Animation & CSS Properties
**DO NOT** animate or define CSS properties (opacity, 	ransform) as flat object properties (e.g. obj.opacity) if the StageRenderer prioritizes obj.style.opacity. Animations must be targeted cleanly to avoid overwriting or property shadowing. 
**DO NOT** duplicate animation triggers in initialization routines (e.g. initMainGame). Stage initializations must fire through handleStageChange to avoid redundant Tween overlaps.

 -   * * D O   N O T * *   r e m o v e   \ 	 r i g g e r S t a r t A n i m a t i o n ( t h i s . s t a g e ) \   f r o m   \ G a m e R u n t i m e . i n i t M a i n G a m e ( ) \ .   W h i l e   \ h a n d l e S t a g e C h a n g e ( ) \   a l s o   t r i g g e r s   a n i m a t i o n s ,   i t   i s   O N L Y   c a l l e d   f o r   s u b s e q u e n t   s t a g e   s w i t c h e s .   T h e   i n i t i a l   p r o j e c t   s t a r t u p   r e l i e s   e n t i r e l y   o n   \ i n i t M a i n G a m e ( ) \   t o   t r i g g e r   t h e   v e r y   f i r s t   a n i m a t i o n . 
 
 -   T y p e S c r i p t   E S 2 0 2 2 +   c l a s s   f i e l d s   w e r d e n   N A C H   d e m   s u p e r ( )   A u f r u f   i n i t i a l i s i e r t   u n d   k o e n n e n   R e f e r e n z e n   z e r s c h i e ß e n ,   w e n n   d i e s e   i n   c r e a t e R o o t   a n g e l e g t   w u r d e n .   N u t z e   z . B .   R e - A c q u i r e m e n t   i m   K o n s t r u k t o r . 
 
 -   V i t e   H o t - R e l o a d   b l o c k i e r t   s t i l l s c h w e i g e n d   b e i   j e g l i c h e n   T S - K o m p i l i e r u n g s f e h l e r n   ( z . B .   T S 6 1 3 3   u n u s e d   v a r ) .   D i e s   f ü h r t   z u   i r r e f ü h r e n d e n   A l t - Z u s t ä n d e n   b e i m   T e s t e n   i m   B r o w s e r . 
 
 
## Regel: getRawObject() vs getObjects() fuer State-Mutationen
- **DO NOT** Objekte aus GameRuntime.getObjects() mutieren. getObjects() gibt Spread-Kopien (`{ ...obj }`) zurueck — Mutationen werden vom PropertyWatcher nicht registriert.
- **IMMER** GameRuntime.getRawObject(id) verwenden wenn ein Objekt-Property aus der UI geaendert werden soll (z.B. close-Button setzt visible=false).
- **KRITISCH (EditorRunManager)**: runStage.runtime = this.runtime MUSS nach `new GameRuntime()` gesetzt werden. Vorher ist this.runtime = null und ctx.host.runtime = undefined in allen Renderern.

### Manager-Tab (EditorViewManager)
- **DO NOT**: `coreStore.activeStageId` als zuverlaessig voraussetzen. `FlowEditor.switchActionFlow()` setzt diesen Wert bei globalem Task-Kontext auf `null`. Code der `getActiveStage()` nutzt MUSS immer einen Fallback implementieren: `this.host.getActiveStage() || blueprintStage || stages[0]`.
- **DO NOT**: In `handleManagerRowClick` fuer Actions/Variables `switchView('stage')` aufrufen. Diese sind keine visuellen Stage-Objekte. Der View-Wechsel loest einen Sync-Zyklus aus, der bei gleichnamigen Actions zu Datenverlust fuehrt.

### Reactive Bindings & Type Coercion
- **DO**: Wenn Variablen (z.B. aus einer TStringMap) an Eigenschaften gebunden werden, die spezifische Typen wie `number` erwarten (z.B. `borderWidth`, `Rahmenbreite`, `Abrundung`), findet in der `ReactiveRuntime.ts` nun eine automatische Type-Coercion (String -> Number) statt. Dies ist "defensiv" programmiert und greift nur bei bekannten numerischen Eigenschaften oder bei Ziel-Eigenschaften vom Typ `number`. Erweitere das Array `germanNumericProps` oder `numericProps` in `ReactiveRuntime.ts`, falls weitere UI-Felder in Zukunft eine implizite Konvertierung benötigen.
