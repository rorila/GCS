# Developer Guidelines

> [!CAUTION]
> **PFLICHT-REGEL FÜR KI-AGENTEN**: Jede Code-Änderung MUSS mit `npm run test` (oder `run_tests.bat`) validiert werden. Der `docs/QA_Report.md` ist Teil der „Definition of Done". Tests VOR der Nutzer-Benachrichtigung ausführen.

> [!IMPORTANT]
> **CleanCode Transformation — Phase 1–3 abgeschlossen (v3.22.0)**
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
- **ComponentSchema (Agent-Wissensbasis)**: Neue Komponenten MÜSSEN im passenden Schema-Modul unter `docs/schemas/` dokumentiert werden (Properties, Methods, Events, Beispiel). Der `SchemaLoader` (`src/services/SchemaLoader.ts`) merged alle Module beim Start und übergibt sie an `AgentController.setComponentSchema()`. NICHT das monolithische `docs/ComponentSchema.json` direkt editieren — es enthält nur die Basis-Definitionen.

- **Auswirkungsanalyse (Impact Analysis)**: Bevor an zentralen Systemen (z. B. Inspector, Projekt-Speicherung, UI-Typisierung) Änderungen vorgenommen werden, MUSS eine systemweite Suchabfrage (grep_search) durchgeführt werden, um Seiteneffekte auszuschließen. "Blindes" Ändern von Laufzeit-Abfragen oder Magic-Strings ohne Prüfung der Querverweise ist strikt untersagt.

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
- **ProjectStore — setProject() Pflicht:** Bei JEDEM Projektwechsel MUSS `projectStore.setProject(project)` aufgerufen werden. Ohne diesen Aufruf arbeitet der Store mit einer veralteten Referenz.
- **Undo / Redo:** Der einzige zuständige Manager ist der **`SnapshotManager`**. Der alte `ChangeRecorder`/`EditorUndoManager` ist obsolet.
- **Two-Way-Binding Kollisionen:** Vermeide direkte Schreibzugriffe auf `obj.name` über UI-Events, *bevor* eine zentrale Validierung wie `EditorCommandManager.renameObject` angestoßen wird.
- **Vermeidung redundanter Render-Zyklen:** `.onChange()` Listener filtern `{x, y, isEditorSelected, width, height, isMoving, isHiddenInRun}` heraus, wenn diese ohnehin zu 60 FPS durch lokale Animationen geregelt werden.
- **DO NOT:** Die Abfrage `obj.scope === 'global'` verwenden, um Objekte exklusiv als Variablen zu klassifizieren! Reguläre Stage-Komponenten auf der Blueprint-Stage erben ebenfalls den Scope `global`. Nutze stattdessen `obj.isVariable`.

### Speichermanagement (aktualisiert v3.22.0)

- **Adapter-basiert**: `ProjectPersistenceService` delegiert an `IStorageAdapter`-Implementierungen. Kein direkter `fetch()`- oder `localStorage`-Zugriff in Business-Logik.
- **Dirty-Flag Pflicht**: Jede Änderung MUSS das `isProjectDirty`-Flag setzen (automatisch über `MediatorEvents.DATA_CHANGED`).
- **Zustands-Reset**: Nach `saveProject` oder `loadProject` das Flag zwingend auf `false` setzen.
- **Initial-Load Originator**: Beim ersten Laden `notifyDataChanged(project, 'editor-load')` verwenden, damit das Dirty-Flag nicht sofort auf `true` springt.
- **isProjectDirty — Originator prüfen**: In `EditorViewManager.initMediator` wird `isProjectDirty = true` NUR bei echten User-Änderungen gesetzt.
- **saveProjectToFile — Reihenfolge**: `isProjectChangeAvailable.defaultValue` und `isProjectDirty` müssen VOR `JSON.stringify` zurückgesetzt werden.
- **loadProject — isProjectDirty**: `isProjectDirty=false` muss NACH `setProject()` und `notifyDataChanged()` gesetzt werden (synchron + `setTimeout(100)`).

## 4. Inspector & Flow-Editor

### Synchronisation

- **Persistenz von Flow-Nodes**: Der `FlowNodeHandler` muss globale Listen (`project.actions`) UND `flowCharts` durchsuchen, um „unlinked" Actions zu finden.
- **Typ-Wechsel**: Bei Änderungen des Aktions-Typs im Inspector `mediatorService.notifyDataChanged` aufrufen.
- **Server-Sync**: `EditorDataManager.updateProjectJSON` nutzt `JSON.stringify()` direkt über die Adapter-Architektur.

### Inspector-Patterns

- **IInspectable (v3.14.0)**: Flow-Objekte implementieren `getInspectorSections()`. Änderungen über `eventHandler.handleControlChange()` delegieren. `applyChange()` nur für Re-Render-Checks (Typ-Wechsel).
- **TComponent IInspectable (v3.14.3)**: Alle UI-Komponenten implementieren automatisch `IInspectable` über `TComponent`. Neue Gruppen-Icons in `GROUP_ICONS` Map in `TComponent.ts` hinzufügen.
- **Inspector-Typen im Model-Layer (v3.21.0)**: `TPropertyDef`, `InspectorSection`, `IInspectable` leben in `src/model/InspectorTypes.ts`. NICHT aus `src/editor/inspector/types` importieren.
- **Inspector-Typen**: `type: "color"` zeigt Farbwähler, `inline: true` gruppiert horizontal.
- **Inspector Dropdowns**: Alle Listen für Tasks, Actions und Variablen über `ProjectRegistry.getTasks('all')` etc. speisen.
- **FlowAction Proxy-Regel**: Neue Felder in `StandardActions.ts` oder `action_rules.json` MÜSSEN auch als Getter/Setter in `FlowAction.ts` implementiert werden. In `mapParameterTypeToInspector()` MUSS `'object'` auf `'select'` gemappt werden.
- **FlowAction applyChange() — SSoT-First (v3.24.0)**: `applyChange()` schreibt IMMER direkt in `actionDef[prop]` und `this.data[prop]`. Setter werden nur aufgerufen, wenn ein TypeScript-Setter existiert (für Side-Effects wie Styling-Updates). **DO NOT** `PropertyHelper.setPropertyValue(this, prop, val)` in `applyChange()` verwenden — das funktioniert nur für Properties mit explizitem Setter und schreibt bei Registry-basierten Parametern (effect, duration, targetScale, etc.) nur auf den Canvas-Proxy statt in die SSoT!
- **Geometrie-Plausi (v3.23.0)**: `x/y/width/height` in `TWindow.getInspectorProperties()` haben **dynamische** min/max basierend auf `coreStore.getActiveStage().grid`. Negative Positionen sind **nicht erlaubt** (min: 0). Regel: `x + width <= cols`, `y + height <= rows`.
- **E2E-Tests**: Input name=`{propName}Input`, Select name=`controlName || propName`.

### SyncValidator (v3.14.1)

- Nach jeder `syncToProject()` prüft `SyncValidator.validate()` automatisch 6 Konsistenzregeln.
- Bei neuen Sync-relevanten Datenstrukturen: Validierungsregel in `SyncValidator.ts` ergänzen.
- **Sync-Blacklist**: Die `taskFields` Liste in `FlowSyncManager.ts` darf keine Felder enthalten, die für Aktionen essentiell sind (`value`, `params`, `body`, `source`).

## 5. Flow-Editor & Verbindungen

- **Flow-Typen**: Typ-Bezeichner (`getType()`) müssen IMMER kleingeschrieben sein (`'task'`, `'action'`).
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
- `nodes.find(n => n.getType() === 'task')` nutzen, um den auto-generierten Knoten zu referenzieren.

### restoreConnection API

- `restoreConnection({ id, startTargetId, endTargetId, startX, startY, endX, endY, data: { startAnchorType, endAnchorType } })`
- Muss **nach** `createNode` aufgerufen werden, damit die Nodes im Array vorhanden sind.

### syncTaskFromFlow Traversierung

- Startpunkt: `elements.find(e => type === 'task')`
- Ausgehende Connections: `connections.filter(c => c.startTargetId === startNode.id)`
- `buildSequence(targetId)` fügt Actions zur Sequenz hinzu
- Action-Name: `node.data?.name || node.properties?.name`

## 6. Run-Mode & Rendering

- **Koordinaten & Dimensionen (ARCHITEKTUR 2026-04-26)**: Positionen werden in **Grid-Zellen** relativ zum Parent gespeichert. `GameRuntime.getObjects()` gibt **Original-Proxy-Referenzen** zurueck (keine Spread-Kopien!). Die Umrechnung in absolute Pixel-Koordinaten erfolgt **ausschliesslich** im `StageRenderer` ueber `parentId`-Chain-Traversal. Bindings (`${...}`) werden von der `ReactiveRuntime` beim Registrieren aufgeloest.
- **Blueprint-Objekte**: Service-Objekte und globale Variablen nur auf der `blueprint`-Stage anzeigen (`this.host.isBlueprint`).
- **Variablen-Visualisierung**: Variablen zeigen Name + aktuellen Wert in Klammern an.
- **Stage-Vererbung**: NIEMALS `inheritsFrom` für Stage-zu-Stage Vererbung. Nur Blueprint-Merge erlaubt.

### Runtime & Standalone Player (bundle:runtime-Pflicht)

- **Editor vs. IFrame**: Änderungen an `core/runtime/`-Dateien (`RuntimeStageManager.ts`, `ReactiveRuntime.ts` etc.) werden im Editor via Vite-HMR sofort wirksam.
- **CRITICAL**: Der IFrame-Player (`Run (IFrame)`-Tab) lädt IMMER das kompilierte statische `public/runtime-standalone.js`. Wenn du Funktionalität in der Kern-Runtime anpasst, MUSS anschließend IMMER `npm run bundle:runtime` ausgeführt werden, damit deine Code-Fixes auch im IFrame wirksam werden.
- **Run (IFrame) als Referenz**: Use the **Run (IFrame)** tab in the Editor to test gameplay exactly how it behaves in full Standalone mode. The IFrame isolates memory and fully replicates Export logic by consuming `GameExporter.getCleanProject()`. The legacy DOM-based `Run` tab may drift from standalone behavior.

## 7. Logging & Diagnose

- **Keine `console.log`**: NIEMALS `console.log`, `console.warn` oder `console.error` direkt im Produktivcode verwenden.
- **Logger-Pflicht**: Immer den zentralen Logger nutzen: `private static logger = Logger.get('ClassName', 'UseCaseId');`
- **UseCases**: Logs einem funktionalen UseCase zuordnen (siehe `UseCaseManager.ts`).
- **Fehler**: `logger.error` wird immer angezeigt. `debug/info/warn` nur, wenn der UseCase im Inspector aktiv ist.
- **Circular Deps**: Bei Utility-Modulen auf kreisförmige Abhängigkeiten achten (siehe Filter-Pattern in `Logger.ts`).
- **Logging-Präfix**: `[TRACE]` für die Synchronisierungs-Pipeline (SyncManager/Hydrator/Manager).

## 8. Action-Persistenz & Suche

- **Index-Lookup**: Für Action-/Task-Definitionen immer `ProjectRegistry.getActions('all')` bzw. `getTasks('all')` nutzen (SSoT-Prinzip: Referenzen auf Original-Objekte im RAM).
- **Broad-Field Matching**: Suche robust über `data.actionName`, `data.name`, `properties.name`, `properties.text`.
- **Case-Insensitivity**: Namen immer Case-Insensitive vergleichen, `.trim()` verwenden.
- **Bereinigung**: `SanitizationService` entfernt automatisch verwaiste Action-Referenzen aus Sequenzen.
- **Stage-bewusstes Refactoring (v2026-05-05)**: Alle `rename*`-Methoden in den Refactoring-Services akzeptieren einen optionalen `activeStageId`-Parameter. Regel: Stage-lokale Elemente werden nur in der aktiven Stage + Blueprint refactored. Blueprint-Elemente werden projektweit refactored. Zentrale Logik: `RefactoringUtils.getStagesToProcess()`. Der `EditorCommandManager` uebergibt automatisch `project.activeStageId`.
- **DO NOT**: Refactoring-Services NIEMALS ohne `activeStageId` aufrufen, wenn der Kontext eine bestimmte Stage betrifft. Sonst werden identisch benannte Elemente in anderen Stages unbeabsichtigt mitgeaendert.

## 9. Best Practices

- **Interface Konsistenz**: Host-Objekte für Manager-Klassen müssen Anforderungen in einem dedizierten Interface definieren. Siehe `IViewHost` in `EditorViewManager.ts`.
- **GCS Dashboard Pattern**: Für Dashboards `TTable` im `displayMode: "cards"` verwenden. Datenquellen: `TObjectList`-Variablen in der `stage_blueprint`.
- **Expert-Wizard Dynamisierung**: In der Regel-JSON `type: "select"` und `options: "@objects"` verwenden. Auflösung zur Laufzeit via `ProjectRegistry`.
- **Expert-Wizard Prompts**: Platzhalter in geschweiften Klammern (z. B. `"Wert für {target}.{property}?"`) werden automatisch durch Session-Werte ersetzt.
- **ComponentData vs TWindow**: Im Datenmodell `ComponentData[]` verwenden. `TWindow` nur wo Methoden aufgerufen werden (`Serialization.ts`, `GameRuntime.ts`).
- **Storage über IStorageAdapter**: Neuer I/O-Code MUSS über `IStorageAdapter` laufen (`src/ports/IStorageAdapter.ts`). Adapter in `src/adapters/`.
- **Electron-Vorbereitung**: `NativeFileAdapter` erwartet `window.electronFS`-IPC-Bridge. Kein `showSaveFilePicker` ohne Fallback.

### Architectural Registries

- **DO NOT** use a monolithic `ProjectRegistry`. It has been decentralized.
- **DO** use the domain-specific registries under `src/services/registry/` (z. B. `projectObjectRegistry`, `coreStore`), um Single-Source-of-Truth zu garantieren und zirkuläre Abhängigkeiten zu vermeiden.

## 10. Architektur-Hinweise (Sync-Strategie)

- **Aktueller Zustand:** Bidirektionaler Sync zwischen Flow-Graph-Objekten ↔ JSON (`FlowSyncManager.ts`). Funktioniert, war aber fehleranfällig.
- **Ziel-Architektur:** Unidirektionaler Datenfluss — Editoren schreiben direkt JSON-Patches, Views rendern nur aus JSON.
- **Pragmatik:** Solange Sync stabil läuft — nicht anfassen. Tests sind das Sicherheitsnetz.

## 11. LLM-Trainingsdaten

> [!IMPORTANT]
> Ziel: Ein lokales LLM (3–7 B Parameter) finetunen, das aus natürlicher Sprache GCS-Komponenten über die `AgentController`-API erzeugt.

- **Export-Trigger:** Nach Feature-Implementierungen den `TrainingDataExporter` (`src/tools/TrainingDataExporter.ts`) ausführen.
- **Format:** JSONL-Paare aus natürlichsprachigem Input und AgentController-API-Aufrufen.
- **Speicherort:** `data/training/` im Projektroot.
- **Varianten:** Pro Use Case min. 3 natürlichsprachige Input-Varianten.
- **Validierung:** Outputs gegen `src/tools/agent-api-schema.json` validieren.
- **Tooling:** QLoRA-Finetuning mit [Unsloth](https://github.com/unslothai/unsloth), Modelle: Phi-3-mini (3.8 B) oder Qwen2.5-7B.

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

### 13.1 Allgemein

- **Placeholder-Code**: KEINE `// ... restlicher Code`-Kommentare. Jede Datei muss vollständig sein.
- **Node/PowerShell String-Injection**: NIEMALS Code-Edits über `node -e "..."` in der PowerShell ausführen, da Backticks und `${...}` unvorhersehbar interpoliert werden. IMMER die nativen `replace_file_content`-Tools verwenden!
- **PowerShell Syntax**: NIEMALS `&&` zur Verkettung von Befehlen verwenden (führt zu `ParserError`). IMMER das Semikolon `;` zur Verkettung nutzen (z. B. `git add . ; git commit -m "..."`).
- **JSON-Validierung**: NIEMALS manuell generierte JSON-Dateien ungetestet übergeben. Immer mit `node -e "require('./path.json')"` validieren.
- **Dummy-Tests**: KEINE Tests, die Logik nur simulieren (Mocks). Reale Engines (`GameRuntime`, `TaskExecutor`) nutzen.

### 13.2 Typsicherheit & Naming

- **Case-Sensitive Typ-Prüfungen**: NIEMALS ohne `.toLowerCase()` für Flow-Elemente.
- **Rename-Vakuum**: NIEMALS Namen im Inspector ändern ohne `RefactoringManager`-Synchronisation.
- **ID-Instabilität**: NIEMALS Namen als Primärschlüssel für Flow-Diagramme, wenn Umbenennung möglich ist.
- **findObjectById**: `EditorCommandManager.findObjectById` muss Objekte via String-Namen auflösen. Basis-Tasks/Actions müssen als Entity gefunden werden, sonst greift Refactoring ins Leere.
- **`String.lastIndexOf` mit Backslashes**: NIEMALS `.substring(0, filepath.lastIndexOf('/'))` verwenden, ohne vorher `filepath.replace(/\\/g, '/')` auszuführen, da Dateipfade auf Windows Backslashes enthalten können und so der korrekte Ordnersuch-Index `-1` wird!

### 13.3 Naming & Registry (Shadowing-Prävention)

- **Namenskonflikte**: Erlaube im Editor niemals, dass ein lokales Objekt/Task/Action denselben Namen erhält wie ein globales Element. Dies führt in der Engine dazu, dass das globale Element (z. B. aus der Blueprint-Stage) unerwartet von der lokalen Instanz überschrieben wird (Shadowing).
- **Validierung bei Umbenennung**: Löse Namensänderungen nie ohne Validierung gegen das `ProjectRegistry` aus (immer `ProjectRegistry.validateTaskName`/`validateActionName` nutzen).

### 13.4 TypeScript `any`-Audit

- **DO**: Verwende `unknown` statt `any` bei unbekanntem Input (API-Responses, `JSON.parse`). `unknown` erzwingt Type Guards.
- **DO**: Verwende `Record<string, unknown>` statt `Record<string, any>` für generische Key-Value-Maps.
- **DO NOT**: `any` als Default-Typ verwenden. Frage: „Kenne ich die Shape des Werts?" — Wenn ja, tippe es.
- **DO NOT**: `as any` ohne Kommentar. Wenn du casten musst, dokumentiere warum.
- **ERLAUBT**: Index-Signaturen (`[key: string]: any`) bei offenen Schemas (z. B. `ComponentData`) — MÜSSEN aber kommentiert sein.
- **Referenz**: Vollständiges Audit-Dokument unter `ToDoList/TypeScript_Any_Audit.md`.

### 13.5 Flow-Editor & Sync

- **Two-Way-Binding bei Umbenennungen**: Flow-Nodes niemals ohne eindeutige Node-ID in `project.actions` synchronisieren. Sonst erkennt der Validator die bearbeitete Action als Duplikat.
- **FlowEditor isDirty-Guard**: Externe Aufrufer MÜSSEN `syncToProjectIfDirty()` statt `syncToProject()` verwenden. Letzteres überschreibt die `actionSequence` auch ohne Änderungen.
- **initMediator store-dispatch**: Bei Originator `'store-dispatch'` KEIN `refreshAllViews()` — nur `render()`. Sonst springen Drag-Objekte zurück.
- **projectRef in FlowNodeFactory**: NIEMALS die Zuweisung vergessen für neue Knoten-Typen.
- **deleteAction Sub-Typen**: Beim Löschen ALLE Sub-Typen (`DataAction`, `HttpAction`) im Filter berücksichtigen.
- **FlowSyncManager Condition Anchors**: Branch-Erkennung: `startAnchorType: 'right'` (True) und `'bottom'` (False) + Flags `isTrueBranch`/`isFalseBranch` als OR-Bedingung prüfen.
- **Action Scopes**: Actions MÜSSEN im selben `actions`-Array liegen wie die nutzenden Tasks. Blueprint-Task → Blueprint-Action, sonst: kaputte Fallback-Dummys.
- **Action-Typ Inferierung**: `ActionExecutor` braucht das `type`-Feld. Flow-Editor-Aktionen ohne `type` MÜSSEN zur Laufzeit inferiert werden (`target` + `changes` → `property`).

### 13.6 Inspector

- **getOriginalObject() findet keine FlowNodes**: FlowActions haben UUIDs als `.id`, die NICHT in `project.actions` vorkommen. Persistenz AUSSCHLIESSLICH über `FlowNodeHandler.handlePropertyChange()`.
- **resolveValue — Doppelte Template-Auflösung**: Werte mit `${...}`-Templates dürfen NICHT erneut durch den Template-Parser.
- **Variable Picker**: Immer `VariablePickerDialog.show()` verwenden, nicht `prompt()`.
- **Parameter-Typ-Umbau**: Bei jedem Umbau (String → Object) die GESAMTE Rendering-Kette validieren. Fehlender Playwright-Test → User warnen.
- **IInspectable.applyChange() Umgehung**: Wenn das Objekt `IInspectable` implementiert, MUSS `applyChange()` gerufen werden. Nicht direkt via `PropertyHelper` im `data`-Objekt manipulieren.
- **Select-Dropdowns ohne Leer-Option**: Wenn ein `type: 'select'`-Feld mit `source:` eine dynamische Liste lädt und der Initialwert leer (`''`) ist, MUSS die Optionsliste eine Leer-Option `{ value: '', label: '— Keine —' }` enthalten. Ohne sie kann der User nicht von „leer" auf einen Wert wechseln, weil kein `onchange`-Event feuert.
- **ObjectStore-Hydration**: Verlasse dich bei der Inspector-Darstellung nicht darauf, dass Objekte aus dem `ObjectStore` noch Methoden von `TComponent` besitzen (wie `getInspectorSections`). Da der `ObjectStore` auf serialisierbarem Zustand (`__rawSource`) basiert, müssen diese Komponentenstrukturen im Inspector zunächst mittels `ComponentRegistry.createInstance` „hydriert" werden.
- **Object Identification Fallback**: Tasks und Actions haben evtl. nur `name` oder `Name` (kein `id`). Immer `update.object.id || update.oldValue` bzw. `.name` als Fallback nutzen, wenn Eigenschaftsänderungen an Manager delegiert werden.
- **Inspector `visibleWhen` Fallstricke**: Verlasse dich bei Dropdowns nicht darauf, dass der Inspector automatisch verbundene `visibleWhen`-Sektionen neu zeichnet. Sorge in `FlowAction.ts` → `applyChange` zwingend dafür, dass bei allen Attributen (wie `type`, `actionType`, `effect`), die andere visuelle Ausgaben steuern, `true` zurückgegeben wird, damit ein voller Re-Render getriggert wird!

### 13.7 Inspector Input-Validierung

- **DO**: Jede numerische Property in `getInspectorProperties()` MUSS `min`, `max` und `step` definieren. Der `InspectorSectionRenderer` nutzt diese für native HTML5-Input-Constraints, Live-Validierung und Auto-Clamping.
- **DO**: Nutze `type: 'hidden'` für Properties, die serialisiert (`toDTO`) aber nicht im Inspector angezeigt werden sollen (z. B. `htmlContent` bei `TRichText`).
- **DO NOT**: Akzeptiere keine ungeprüften User-Eingaben im Inspector. Die Validierungs-Pipeline (Live `oninput` + Auto-Clamp `onchange`) verhindert ungültige Werte.
- **DO**: Verwende das `validate`-Callback in `TPropertyDef` für komponentenspezifische Validierungslogik, die über `min`/`max` hinausgeht.

### 13.8 Serialization & Hydration

- **Serialization `reservedKeys`**: Read-Only Properties MÜSSEN in `Serialization.ts` → `reservedKeys` stehen. Sonst: `TypeError: Cannot set property which has only a getter`.
- **Neue Komponenten in `hydrateObjects()`**: IMMER den `case 'TKomponente':` hinzufügen! Sonst verschwindet die Komponente beim Laden.
- **`hydrateObjects()` Instanz-Wiederverwendung**: Bei Service-Komponenten VOR `init()/start()` ein Force-Reset durchführen (`stop()` + `isActive = false`).
- **Export DeepClean**: NIEMALS blind Properties mit Unterstrich (`_`) beim `deepClean` / Export löschen! Interne Vue- / Reactivity-Properties fangen ebenfalls mit `_` an (wie `_backgroundImage` oder `__v_isRef`). Nutze stattdessen Whitelists (wie `__v_isRef`) und bereinige nur explizite Editor-Metadaten.
- **`safeDeepCopy()` mit Getter-Properties**: `Object.keys()` und `for...in` ignorieren Getter/Setter-Properties, die auf dem Prototyp einer Klasse definiert sind (z. B. `TSprite.backgroundImage`). Wenn man Instanzen (`TWindow`) via generischem `JSON.stringify` oder manual iterierendem `safeDeepCopy` klont, gehen diese Properties verloren. **Lösung**: `safeDeepCopy` prüfen lassen, ob ein Objekt eine `.toDTO()`-Methode besitzt, und diese nutzen, da sie alle via `getInspectorProperties()` deklarierten Getter inkludiert.
- **`crypto.randomUUID()` Fallback**: NIEMALS `crypto.randomUUID()` implizit in der Editor-/Web-Umgebung verwenden. Da das GameBuilder-Projekt sowohl im Browser als auch im nativen Electron-Dual-Mode ohne strikten HTTPS Secure Context läuft, wird die Web-Crypto-API teils blockiert. Nutze immer den Fallback: `typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'obj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)`.
- **`toDTO()` und `getInspectorProperties()`**: DO NOT — Erstelle NIEMALS eine neue Component-Property, die per `toDTO()` / `safeDeepCopy()` serialisiert werden muss, OHNE sie in `getInspectorProperties()` zu registrieren. Die `toDTO()`-Methode (`TComponent.ts`) iteriert NUR über die von `getInspectorProperties()` zurückgegebenen Properties. Fehlt eine Property dort, geht sie beim Deep-Copy (Run-Mode, IFrame-Export) verloren und die Runtime bekommt nur den Konstruktor-Default. Typ `'hidden'` verwenden, wenn die Property nicht im Inspector angezeigt werden soll.
- **Gamepad & Serialization Lessons Learned (v3.x)**:
  - DO NOT create a new component class (e.g. `TVirtualGamepad`) without immediately adding it to the `hydrateObjects` switch-statement in `src/utils/Serialization.ts`. Failing to do so causes the component to be silently dropped during project load or IFrame export!
  - DO NOT dispatch synthetic `KeyboardEvent`s without `{ bubbles: true }` if you expect global window listeners (like the `GameRuntime` loop) to capture them. Touch overlays must strictly use bubbling events.
- **ComponentRegistry-Registrierung**: Vergiss niemals, *jede* neue Komponente per `ComponentRegistry.register(ClassName, ...)` am Dateiende zu registrieren, sonst löscht das Hydrations-System (`Serialization.ts`) die Komponente beim Wechsel in den Run-Mode spurlos aus dem RAM!
- **TRichText & HTML Component Hydrierung**: Wenn Komponenten erstellt werden, die HTML injizieren (wie `TRichText`), legt zwingend `.style.color` und `.style.fontSize` im Constructor als Fallback fest. Andernfalls zerbricht das Skalierungssystem der `GameRuntime` / des Editor-`StageRenderer` und die Typografien unterscheiden sich zwischen IFrame und Editor eklatant.
- **TRichText `<font>`-Migration**: Beim Rendering von WYSIWYG-HTML-Inhalten (z. B. `TRichText`) müssen deprecated `<font color>`-Tags zu `<span style="color:...">` konvertiert werden, da `<font>`-Presentational-Hints (CSS-Spezifität 0) von Klassen-Regeln wie `.game-object { color: #333 }` überschrieben werden.

### 13.9 Rendering & Performance

- **`console.log` in Game-Loop-Pfaden**: NIEMALS in 60 Hz-Funktionen (`update()`, `loop()`, `renderLogs()`). Blockiert den Main-Thread.
- **`translate3d` überschreiben**: NIEMALS `el.style.transform = obj.style.transform` im RunMode, wenn letzteres leer sein kann. Custom-Transforms AN das berechnete `translate3d` anhängen.
- **Sprite-Rendering**: NIEMALS den vollen `editor.render()`-Pfad für Sprite-Positionen. `spriteRenderCallback` in `GameLoopManager` nutzen. CSS-Transitions auf Sprites vermeiden.
- **`handleRuntimeEvent()` — Kein doppeltes Render**: Events triggern über GlobalListener bereits ein Render.
- **CSS `background-image` für Sprites**: NIEMALS im RunMode. CPU-Rasterung bei `translate3d` → Jitter. Immer natives `<img>`-Tag verwenden.
- **`isHiddenInRun`**: MUSS in `renderObjects()` explizit geprüft werden. Wird NICHT durch `obj.visible` abgedeckt.
- **`SPRITE_PROPS` Filter**: JEDE `TSprite`-Property im 60 Hz Fast-Path MUSS im `SPRITE_PROPS`-Filter stehen (`x, y, velocityX, velocityY, errorX, errorY, visible`).
- **Doppel-Loops**: NIEMALS einen zweiten `requestAnimationFrame`-Ticker neben dem `GameLoopManager`. Verursacht Physics-Jitter.
- **Hardcoded Styles in spezialisierten Renderern**: NIEMALS Style-Properties (`borderRadius`, `color`, `fontSize`, `fontWeight`, `boxShadow` etc.) in `ComplexComponentRenderer`, `TextObjectRenderer` oder in `createRuntimeElement()` mit festen Werten setzen. Der `StageRenderer` wendet `obj.style.*` bereits generisch an (`StageRenderer.ts` Zeile 430–466). Spezialisierte Renderer müssen `obj.style?.propertyName || fallbackValue` lesen, damit Inspector-Änderungen wirksam werden. Ausnahme: Strukturelle Styles wie `flexDirection`, `overflow`, `position` dürfen hardcoded bleiben.
- **Animation & CSS Properties**:
  - DO NOT animate or define CSS properties (`opacity`, `transform`) as flat object properties (e.g. `obj.opacity`) if the `StageRenderer` prioritizes `obj.style.opacity`. Animations must be targeted cleanly to avoid overwriting or property shadowing.
  - DO NOT duplicate animation triggers in initialization routines (e.g. `initMainGame`). Stage initializations must fire through `handleStageChange` to avoid redundant Tween overlaps.
- **Animations-Drift bei verschachtelten Containern (`TGroupPanel`, `TPanel`, `TDialogRoot`)**:
  - DO NOT: Animiere NIEMALS Kinder von Container-Komponenten (Objekte mit `parentId`) unabhängig mit positionsbasierten Stage-Animationen (slide-up, Fly-Patterns). Ihre `x/y`-Koordinaten sind RELATIV zum Parent. Der `StageRenderer` berechnet die absolute Position rekursiv über die `parentId`-Kette. Wenn sowohl Parent als auch Kind gleichzeitig von Off-Screen einfliegen, entsteht ein doppelter Offset.
  - DO: Prüfe in `triggerStartAnimation()` immer auf `obj.parentId` und überspringe solche Objekte bei Positions-Tweens. Kinder bewegen sich automatisch mit ihrem animierten Parent-Container mit.
  - AUSNAHME: Opacity-Animationen (`fade-in`) müssen auch Kinder einschließen, da die DOM-Elemente flach im Stage-Container liegen und CSS-Opacity nicht kaskadiert.
- **DO NOT remove `triggerStartAnimation(this.stage)`** from `GameRuntime.initMainGame()`. While `handleStageChange()` also triggers animations, it is ONLY called for subsequent stage switches. The initial project startup relies entirely on `initMainGame()` to trigger the very first animation.
- **Z-Index und StageRendering**: Stelle in `StageRenderer.ts` bei der Sortierung der Elemente immer sicher, dass bei gleichem `zIndex` die Hierarchie bedacht wird (`getDepth()`). Kinder müssen im DOM nach den Eltern eingefügt werden (höherer Index im Array), sonst fangen die Layer der Eltern (z. B. bei `TGroupPanel`) Pointer-Events wie Klicks ab und die Kinder werden in der GUI unmarkierbar.
- **IFrame-Runner Container-Kinder im Fast-Path**:
  - DO NOT: Erzwinge NIEMALS Full-Render-Zyklen (`needsFullRender = true` in `GameRuntime` oder Bypasses in `GameLoopManager`) nur weil animierte Objekte Kinder besitzen. Full-Renders verursachen Layout-Thrashing (Browser-Freezes) und zerstören flüssige Animationen bei 60 fps.
  - DO: Sorge dafür, dass Positionsänderungen (`x`, `y`) JEDES Objekts ausschließlich über den asynchronen 60 fps Fast-Path (`StageRenderer.updateSpritePositions`) laufen. Die Berechnungslogik innerhalb von `updateSpritePositions` iteriert rekursiv über alle Eltern (`parentId`), um absolute Screen-Koordinaten zu addieren und verschiebt abhängige DOM-Kinder hardwarebeschleunigt in Echtzeit mit.

### 13.10 Runtime-Spezifisch

- **Kein `window.editor` in Komponenten**: Laufzeit-Komponenten (`TWindow`, `TSprite`, etc.) dürfen NICHT auf `(window as any).editor` zugreifen. Context-Daten als Properties injizieren.
- **`TInputController.start()/stop()`**: NICHT für Keyboard-Listener nutzen. `EditorRunManager.setupKeyboardListeners()` verwaltet Window-Listener direkt.
- **`GameRuntime.start()` und Splash-Screen**: Bei aktivem Splash wird `initMainGame()` NICHT aufgerufen. Komponenten, die vorher funktionieren müssen, extern initialisieren.
- **`resolveTarget`**: IMMER `context.eventData` als 4. Argument übergeben (enthält `{self, other, hitSide}`).
- **Ghost-Sprites**: `collisionEnabled` ist standardmäßig `false`. Explizit `"collisionEnabled": true` setzen für Bounce/Hit-Events.
- **Bedingte Physik / Panel-Kollision**: Sprites prallen an Stage-Grenzen, Panels oder anderen Sprites NUR DANN physikalisch ab (Clamp/Push-Out), wenn sie entsprechende Events (`onBoundaryHit`, `onCollision` etc.) definiert haben. Ohne Event zeigen sie "Geister-Verhalten" und durchfliegen Hindernisse. Panels triggern keine eigenen Physik-Events, sondern sind passive Boundaries.
- **Scope Bleeding bei globalen Filtern**: NIEMALS globale `Set`/`Map` über Stage-Iterationen hinweg. Sets für Deduplikation INNERHALB der Stage-Schleife anlegen.
- **String-Conditions bevorzugen**: `"condition": "${hitSide} == 'top'"` statt Objekt-Conditions. Letztere bereinigen Single-Quotes nicht.
- **Calculate-Formeln**: Template-Syntax `${score} + 1` direkt verwenden. Keine Type-Cast-Hacks wie `Number(score || 0) + 1`.
- **Property-Action Format**: `changes` ist ein Schlüssel-Wert-Objekt, `target` ist der visuelle Objektname.
- **`GameRuntime.getObjects()` – Original-Referenzen (ARCHITEKTUR 2026-04-26)**:
  - **AKTUELL**: `getObjects()` gibt seit dem Refactoring (2026-04-26) **Original-Proxy-Referenzen** zurück (`[...this.objects]`) — KEINE Spread-Kopien mehr! Mutationen auf diesen Objekten WERDEN vom `ReactiveProperty`-Proxy und `PropertyWatcher` erkannt.
  - `getRawObject(id)` ist weiterhin verfügbar als schneller ID-basierter Einzelzugriff, liefert aber funktional identische Referenzen wie `getObjects().find(o => o.id === id)`.
  - KRITISCH (`EditorRunManager`): `runStage.runtime = this.runtime` MUSS nach `new GameRuntime()` gesetzt werden.
- **Positions-Architektur (Single Source of Truth)**:
  - Positionen (x, y) werden in **Grid-Zellen relativ zum Parent** gespeichert.
  - Die Umrechnung in absolute Pixel-Koordinaten erfolgt **ausschließlich im `StageRenderer`** über `parentId`-Chain-Traversal. KEINE andere Stelle im Code darf absolute Positionen berechnen.
  - Die `RuntimeStageManager` flacht die Objekt-Hierarchie ab und setzt `parentId`-Referenzen. Children werden als eigenständige Einträge im flachen `this.objects`-Array geführt.
  - Start-Animationen (fade-in, slide-up, fly-in) animieren NUR Top-Level-Objekte (`!obj.parentId`). Kinder reiten visuell auf dem Parent mit.
- **Reactive Bindings & Type Coercion**: Wenn Variablen (z. B. aus einer `TStringMap`) an Eigenschaften gebunden werden, die spezifische Typen wie `number` erwarten (z. B. `borderWidth`, `Rahmenbreite`, `Abrundung`), findet in der `ReactiveRuntime.ts` eine automatische Type-Coercion (String → Number) statt. Dies ist „defensiv" programmiert und greift nur bei bekannten numerischen Eigenschaften oder bei Ziel-Eigenschaften vom Typ `number`. Erweitere die Arrays `germanNumericProps` oder `numericProps` in `ReactiveRuntime.ts`, falls weitere UI-Felder eine implizite Konvertierung benötigen.
- **Reactivity Issues: Dialog Visibility vs. StageRenderer Clones**: Das Objekt `_dialogObj`, welches im DOM des Editors gespeichert wird, stammt aus dem `mergedObjectsArray`. Im Run-Mode (`GameRuntime`) ist dies oftmals ein SHALLOW ARRAY COPY (bzw. Proxy), was dazu führt, dass die Referenzen abweichen. Mutationen an `currentObj.visible = false` verändern nicht automatisch das Master-Objekt aus `GameRuntime.objects`. Nutze immer den Lookup über `ctx.host.getObjects()`, um State-Veränderungen an UI-Komponenten sicher auszuführen. Ein Umgehen dieser Regel führt zu verwaisten und nicht-reaktiven Zuständen (z. B. dem 2-Click-Bug am Toggle-Button).
- **`PropertyWatcher.clear()` darf `globalListeners` nicht löschen**: NIEMALS `this.globalListeners.clear()` in `PropertyWatcher.clear()` aufrufen. GlobalListeners sind die stabile Rendering-Brücke zwischen `ReactiveRuntime` und `StageRenderer`, werden einmalig im `GameRuntime`-Konstruktor registriert und müssen Stage-Wechsel überleben. Wenn sie gelöscht werden, funktioniert nach dem ersten Stage-Wechsel kein reaktives Rendering mehr (`onComponentUpdate`, `onRender` werden nicht mehr ausgelöst).
- **`Array.splice()` in `setTimeout` bei synchroner `while`-Schleife**: NIEMALS `Array.splice()` in einen `setTimeout`-Callback verschieben, wenn die Array-Länge in einer synchronen `while`-Schleife geprüft wird (z. B. `TToast.show()`). Das führt zu einer Endlosschleife, da die Länge synchron nie sinkt. Fix: `splice()` immer synchron ausführen, nur die DOM-Animation darf im `setTimeout` laufen.
- **`instanceof` vor Proxy-Safeguards**: DO NOT DO `instanceof` BEFORE PROXY SAFEGUARDS — Wenn das Proxy `makeReactive`-Pattern benutzt wird, stelle IMMER sicher, dass ein `__isProxy__ === true`-Loop-Schutz an ALLER ERSTER STELLE greift, noch BEVOR `instanceof HTMLElement` etc. ausgelöst werden. `instanceof` erzeugt einen Getter-Scope auf `[Symbol.hasInstance]`, welcher bei falsch ineinandergesteckten Proxies sofort eine „Maximum call stack size exceeded"-Rekursionsbombe zünden kann.
- **Design-Zeit-JSON nicht an Runtime weiterreichen**: Reiche keine Design-Zeit-JSON-Objekte direkt an die Game-Engine weiter. Die Runtime modifiziert Stages und hydratisiert Objekte doppelt, was Setter (wie `align`) überspringt und das originale Design-Data kontaminiert. Nutze immer `safeDeepCopy` im `EditorRunManager`.
- **Electron IFrame IPC Race Condition**: Die `iframe-runner.html` erwartet Projekt-Daten über `postMessage`. Der integrierte `UniversalPlayer` lädt als Fallback standardmäßig das `project.json` via Fetch-API, falls `window.PROJECT` undefiniert ist. In gesicherten Umgebungen wie Electron (`contextIsolation`, no frameElement access) führt der Fallback dazu, dass VOR dem Eintreffen der `postMessage` eine veraltete JSON-Version geladen und gerendert wird. Um dies zu verhindern, wurde das Flag `window.WAIT_FOR_PROJECT = true` im Runner-HTML integriert.
- **TypeScript ES2022+ class fields**: Werden NACH dem `super()`-Aufruf initialisiert und können Referenzen zerschießen, wenn diese in `createRoot` angelegt wurden. Nutze z. B. Re-Acquirement im Konstruktor.
- **Vite Hot-Reload stillschweigende Blockade**: Vite Hot-Reload blockiert stillschweigend bei jeglichen TS-Kompilierungsfehlern (z. B. TS6133 unused var). Dies führt zu irreführenden Alt-Zuständen beim Testen im Browser.

### 13.11 Electron-Spezifisch

- **Keine nativen Blocking-Dialoge**: Verwenden Sie in Editor-Services NIEMALS native `alert()`, `confirm()` oder `prompt()`. In Electron frieren diese Aufrufe teilweise den Renderer-Thread und den Keyboard-Focus (Cursor-Blinken/Tasteneingaben werden ignoriert) unwiederbringlich ein. Nutzen Sie stattdessen immer die asynchronen HTML-Entsprechungen `NotificationToast`, `ConfirmDialog` und `PromptDialog`. Alle Methoden, die diese Dialoge nutzen, müssen `async` sein.
- **Electron Input / Menu**: NIEMALS `win.removeMenu()` am `BrowserWindow` auf Windows aufrufen. Das bricht die nativen Input-Events in Chrome/Electron für normale Tast- und Text-Felder. VERWENDE STATTDESSEN immer `win.setMenuBarVisibility(false)` und `win.setAutoHideMenuBar(true)`.
- **Absolute Pfade in Electron / Export**:
  - DO NOT: Verwende keine absoluten Pfade (beginnend mit `/`), wenn du referenzierte Assets (z. B. Bilder, iframes) einbindest.
  - DO NOT: Beim Exportieren von Dateien dürfen Fetch-Aufrufe (wie `fetch('/runtime-standalone.js')`) NIEMALS absolut sein, da die exportierten `.html`-Dateien im Endkunden-Rechner unter `file:///C:/...` laufen und der absolute Pfad Root-Traversals erzwingt.
  - DO: Nutze im Dual-Mode immer relative Pfade (z. B. `./images/Ufos/ufo.png` statt `/images/Ufos/ufo.png`).
  - DO: Für dynamische Pfad-Auflösung beim Export immer `new URL(relativePath, window.location.href).href` nutzen.

### 13.12 Build & Runtime-Infrastruktur

- **`player-standalone.ts` nicht in Vite `rollupOptions.input`**: Führe `src/player-standalone.ts` NIEMALS in der `vite.config.ts` über `rollupOptions.input` mit auf. Vite baut standardmäßig ES-Module, woraufhin das `runtime-standalone.js` IIFE-Bundle im Ordner `dist` mit einem ES-Modul überschrieben wird. Da die Electron-App den IFrame lokal über `file://` lädt, greifen strikte CORS/MIME-Restriktionen, die das Skript blockieren (`Cannot use import statement outside a module` / `Error: Runtime-Standalone fehlt!`). Nutze für die Standalone-Runtime immer ein IIFE-Bundle (via `npm run bundle:runtime`).
- **Vite Dev Server Proxy**:
  - DO: Stelle sicher, dass die Proxy-Konfiguration in `vite.config.ts` für den Game-Server (z. B. `/api` auf `http://localhost:8080`) korrekt gesetzt ist, falls lokales Speichern via Dev-Server nicht erreichbar ist.
  - DON'T: Entferne nicht blindlings `proxy` Server-Konfigurationen aus Vite, wenn nicht-native Backends (wie der `game-server`) im Einsatz sind.

### 13.13 Testing & Playwright

- **Playwright-Parallelität**: KEINE parallelen Worker bei geteiltem Dev-Server/State. Immer `workers: 1`, `fullyParallel: false`.
- **Keine `page.on('dialog')`**: DO NOT use `page.on('dialog')` or expect native alerts (`window.alert`) in E2E tests, as the application uses custom HTML-based `NotificationToast` and `ConfirmDialog`. Focus DOM element locators like `.notification-toast` instead.

### 13.14 Autosave, Debouncing & FileSystem Access API Safeguards

- **DO NOT**: Entferne niemals den Debouncer (`setTimeout`) aus der `performDiskSave` bzw. `updateProjectJSON` Aufrufkette im `EditorDataManager`. Das DOM-Event-System (Drag, Text-Interpolation etc.) triggert massive Mengen an synchronen Saves. Die Chrome FileSystem Access API (`createWritable`) wirft sofort eine Collision-Exception (`The associated file is already being written`), was das Speichern komplett zerstört und den Dev-Server abstürzen lässt. Belasse den Disk-Save-Debouncer immer zwingend bei 1000 ms.
- **DO NOT**: Entferne niemals die 2-Sekunden-Grace-Period (`timeSinceLoad < 2000`) am Anfang der Autosaves. Komponenten feuern im ersten Rendern Post-Load-Events, die ohne diese Guard künstliche Speichervorgänge mit leeren Updates auslösen.
- **DO NOT**: Im `MenuBar.render()` wird `container.innerHTML = ''` ausgeführt. Sämtliche lose per JavaScript assoziierten DOM-Nodes (wie der `AutosaveWrapper`) werden gnadenlos abgetrennt und vom GC gelöscht. Solche dynamischen UI-Widgets MÜSSEN am Ende der `render()`-Methode zwingend wieder mit `appendChild()` re-attached werden!
- **DO**: Wenn in der UI (z. B. Context Menu) direkte Änderungen am in-memory Stage-Objekt durchgeführt werden (ohne den `ProjectStore`-Reducer zu durchlaufen), muss zwingend ein leerer `UPDATE_PROJECT`-Dispatch abgesetzt werden: `this.host.projectStore.dispatch({ type: 'UPDATE_PROJECT' });`. Andernfalls blockiert der Debouncer/Grace-Period das Speichern dieser Zustände dauerhaft (siehe Blueprint Exclusion Fix).

### 13.15 Input & Keyboard Events

- **Keydown Events and Active Elements**:
  - DO: Use a robust check for `document.activeElement` before intercepting global keyboard events (like Delete, Backspace, or Undo shortcuts). ALWAYS account for `isContentEditable` and variables that may be inside a `shadowRoot`.
  - DON'T: Blindly intercept shortcuts without checking if the user is typing in an input field (e. g. `INPUT`, `TEXTAREA`, `SELECT`, `isContentEditable`), otherwise users cannot rename or input settings in the Inspector.
- **Touch & Input Simulation**:
  - DO: Nutze für Multiplatform-UI immer `PointerEvent` (`pointerdown`, `pointerup`) anstatt `MouseEvent` (`mousedown`, `mouseup`), da diese nativ für Touch, Stift und Maus funktionieren.
  - DO: Stelle sicher, dass synthetische Browser-Events (z. B. Keyboard-Simulationen für das `TInputController`-Objekt) via `document.dispatchEvent(new KeyboardEvent(...))` abgefeuert werden, damit die `GameRuntime` und eventuelle React/Native Event-Listener im Container sie sauber fangen.
- **iOS Safari Double-Tap Zoom Prävention**:
  - DO NOT: Setzen Sie Flächen, die keine Interaktionselemente sind (wie große Layout-Zonen, `leftZone`, `rightZone`), **niemals** auf `pointer-events: auto;`. Wenn verfehlt wird, gehen diese Touch-Events sonst passiv an den Browser weiter und lösen den nativen iOS Safari Double-Tap-Zoom aus.
  - DO: Legen Sie `pointer-events: none` auf die nicht-klickbaren Wrapper-Container. Nur die eigentlichen Touch-Flächen (Buttons) erhalten `pointer-events: auto;` sowie unbedingt `touch-action: none;`.
  - DO: Für kritische, schnelle Taps (wie Gamepad-Buttons) fängt Event-Delegation am Haupt-Container mit einem nicht-passiven `touchstart`-Listener das Event ab und ruft dort ein dediziertes `e.preventDefault()` auf, sobald das Event auf einer legitimen Schaltfläche ausgelöst wurde.

- **Mouse & Hover Events für UI-Komponenten**:
  - DO: Verwende ausschließlich `onMouseEnter`, `onMouseLeave` und `onDoubleClick` für Maus-Interaktionen auf UI-Komponenten.
  - DON'T: Verwende niemals Tastatur-Events wie `onFocus` oder `onBlur`, um Hover-Zustände abzubilden.


### 13.16 Drag & Drop / Grid-Snapping

- **Drag & Drop Snipping for Nested Blueprint Panels**: When dropping or panning items inside nested containers (especially Blueprint child objects which may have non-integer offsets due to `.align` configs), **always calculate the snapping on the relative coordinate**, not the absolute stage coordinate. Example: `Math.round((absMouseX - parentAbs.x) / cellSize)` instead of `Math.round(absMouseX / cellSize) - parentAbs.x`. Doing the latter will cause a sub-pixel shift against the visual grid boundary.
- **Grid Snapping Convention**: Use `Math.floor(value / cellSize)` for snapping raw pixel coordinates to grid coordinates. Components should snap strictly to the grid cell containing their top-left coordinate, rather than jumping to the nearest grid cell at the 50% mark using `Math.round`. Standardize all snap methods along this convention unless specifically centering.
- **Global Stage Alignment for Nested Elements**: When dropping or moving elements inside a nested container (e. g. nested Panels), calculate the snapped absolute coordinate based on the Global Stage Grid first (`Math.floor(absolutePixel / cellSize)`), and THEN subtract the parent absolute grid offset to get the relative local coordinate for storage. This guarantees the nested item always aligns perfectly with the visual stage lines, even if the container is fractionally aligned.
- **Read-Only Hit Testing (Blueprint Boundaries)**: Filter out `isInherited` elements during hit-testing for Drag and Drop (`handleDrop` and `handleMouseUp`). The Engine's internal state manager (`reduceReparentObject`) structurally prohibits moving cross-stage objects into inherited children arrays, because Blueprint components serve as read-only global templates on the Active Stage. Allowing drops over inherited boundaries creates silent desyncs between Visual Grid State and `ProjectStore` JSON State.

### 13.17 Manager-Tab & View-Wechsel

- **DO NOT**: `coreStore.activeStageId` als zuverlässig voraussetzen. `FlowEditor.switchActionFlow()` setzt diesen Wert bei globalem Task-Kontext auf `null`. Code der `getActiveStage()` nutzt, MUSS immer einen Fallback implementieren: `this.host.getActiveStage() || blueprintStage || stages[0]`.
- **DO NOT**: In `handleManagerRowClick` für Actions/Variables `switchView('stage')` aufrufen. Diese sind keine visuellen Stage-Objekte. Der View-Wechsel löst einen Sync-Zyklus aus, der bei gleichnamigen Actions zu Datenverlust führt.

---

## 14. GCS Spieleplattform (`game-server/`)

Diese Sektion dokumentiert die technischen Muster und Anforderungen für die Entwicklung der GCS-Spieleplattform (bisher eigenständige `game-server/DEVELOPER_GUIDELINES.md`).

### 14.1 Datenmodell & Hierarchie

Die Plattform nutzt eine hierarchische Struktur in `game-server/data/db.json`:

- **Stadt**: Globale Einheit.
- **Haus**: Gehört zu einer Stadt.
- **Raum**: Gehört zu einem Haus.
- **Rollen**: `superadmin`, `cityadmin`, `houseadmin`, `roomadmin`, `player`.
- **Berechtigungen**: Höhere Rollen erben automatisch die Sichtbarkeit der untergeordneten Ebenen.

### 14.2 Authentifizierung (Emoji-Auth)

- Nutzer melden sich mit einem **Emoji-PIN** an.
- Der Server empfängt den PIN als Array oder String und vergleicht ihn mit `db.json`.
- GCS-Projekte nutzen Strings (z. B. `"🚀⭐"`) für das PIN-Handling, da dies nativ in Formeln unterstützt wird.

### 14.3 Rollenwahl für Admins

- Admins (`superadmin`, `cityadmin`, `houseadmin`, `roomadmin`) müssen nach dem Login wählen, ob sie die administrativen Funktionen nutzen oder als normaler Spieler beitreten möchten.
- Die Auswahl wird in der globalen Variable `activeRole` im GCS-Projekt gespeichert.

### 14.4 Lobby & Session-Anzeige

- Die Komponente `TGameCard` wird für die Anzeige aktiver Spiel-Sessions genutzt.
- Properties: `gameName`, `hostName`, `hostAvatar`, `roomCode`.
- Der Standalone-Player (`player-standalone.ts`) kümmert sich um das Rendering dieser Karten und die Navigations-Logik beim Klicken auf „Beitreten".

### 14.5 Admin-Zentrale

- Administratoren verfügen über eine dedizierte Stage `stage_admin_dashboard`.
- Beim Betreten wird der Kontext (Stadt/Haus) vom Server geladen und in `adminContext` gespeichert.
- Untergeordnete Entitäten werden dynamisch über `/api/platform/children` abgerufen.

### 14.6 Kommunikation (Platform ↔ Game)

- **Platform → Game**: Injektion von `Platform-Context`-JSON über `initialGlobalVars` der `GameRuntime`.
- **Game → Platform**: Rückkanal über `http`-Aktionen oder spezielle GCS-Events.

### 14.7 Dateistruktur

| Pfad | Zweck |
|:---|:---|
| `game-server/src/server.ts` | Hauptlogik & API |
| `game-server/data/db.json` | Mock-Datenbank |
| `game-server/public/platform/` | GCS-Projekte für die Plattform-UI |

---

## Fachliche Dokumentation

- [🏗 Architektur & Module](docs/architecture.md)
- [🎮 Runtime & Execution](docs/runtime-guide.md)
- [📐 Coding Standards](docs/coding-standards.md)
- [🖼 UI & Inspector Guide](docs/ui-inspector-guide.md)
- [📋 UseCase Index](docs/use_cases/UseCaseIndex.txt)
- [🤖 AI Agent Integration](docs/AI_Agent_Integration_Plan.md)
- [🛡 Flow Safety (Self-Healing)](docs/coding-standards.md#ai-agent-api--flow-safety)

---

*Letzte Aktualisierung: Merge von Root + `docs/` + `game-server/` Developer-Guidelines (v3.30.x, 2026-04-23). Duplikate entfernt, Encoding auf UTF-8 normalisiert.*

## Learnings: KI-Generierung (TForEach / EventContext)
- Nutze TForEach mit Diff-Reconciliation für dynamische Kartenspiele. Ersetze nie das Array komplett, wenn du Flackern vermeiden willst.
- Greife auf Properties des aufrufenden Objekts via ${self.propertyName} oder ${.source.propertyName} zu.

### Container & Verschachtelung
Objekte wie \TGroupPanel\ oder \TCard\ k�nnen Kinder enthalten (\isContainer = true\). Bei jeglicher Iteration �ber \stage.objects\ (z.B. in Registry oder CommandManager zum L�schen) **MUSS** rekursiv iteriert werden (z.B. mittels \lattenObjects\ oder \
emoveDeep\), da sonst tief verschachtelte Elemente in Dropdowns fehlen oder als Dateileichen zur�ckbleiben.

### Tauri UI / Electron UI
Modale Dialoge (wie PropertyPicker, VariablePicker, ConfirmDialog) m�ssen zwingend einen extrem hohen z-index (z.B. 99999) f�r ihr Overlay verwenden, da in der Tauri-App ansonsten andere UI-Layer des Editors die Dialoge �berlagern und diese unsichtbar machen.
- DO NOT: Beim Implementieren von Reparenting-Logiken (Drag & Drop) in flachen Datenstrukturen (\stage.objects\ mit \parentId\) niemals abbrechen, nur weil Quell- und Ziel-Array identisch sind (\sourceArray === targetArray\). Die \parentId\ muss zwingend gelöscht oder auf die neue ID gesetzt werden, auch wenn sich das Objekt weiterhin im gleichen globalen Array befindet!



### 17. Single Source of Truth f�r den Komponenten-Baum
- **DO NOT** ersetze das gesamte ctiveStage.objects-Array durch eine abgeflachte Liste aus der Registry (projectObjectRegistry.getObjects()). Das Zerst�ren der Baumstruktur (mit children-Arrays) f�hrt dazu, dass Container-Kinder ihre parentId-Bindungen doppelt generieren oder verlieren, was zu unvorhersehbarem Zappeln im Run-Mode (Konflikt global vs. relativ) und kaputtem Drag & Drop f�hrt.
- **DO** operiere stets direkt auf dem referenzierten Baum (ctiveStage.objects.push() oder splice() �ber rekursive Finder wie 
emoveObjectSilent) und belasse die Array-Referenz unangetastet.
- NIEMALS Core-Runtime-Änderungen (AnimationManager, GameRuntime etc.) durchführen, ohne anschließend 
pm run bundle:runtime auszuführen! Der Standalone-Player (IFrame-Run-Mode) verwendet das vorkompilierte Bundle public/runtime-standalone.js. Ohne Neubau werden im Editor funktionierende Änderungen im IFrame schlichtweg ignoriert.

### 18. Refactoring & Objektnamen
- **DO NOT** ersetze beim Umbenennen eines Objekts blind alle Objekte mit demselben Namen (wie bisher in ObjectRefactoringService.ts). Es darf nur das ausgewaehlte Objekt umbenannt werden (was der ProjectStore bereits via SET_PROPERTY erledigt), sowie dessen *Referenzen* (in Actions, Tasks, Conditions).
- Nutze fuer replaceInObjectRecursive die ignoreKeys-Whitelist (z.B. ['name', 'id', 'type', 'className']), um bei der Referenz-Aktualisierung nicht aus Versehen die Metadaten anderer Objekte zu ueberschreiben.

### 19. Variable-Binding in numerischen Inspector-Feldern
- **DO NOT**: `input.type = 'number'` verwenden wenn der Wert ein Binding-String (`${...}`) sein koennte. Browser blockieren nicht-numerische Zeichen in number-Inputs und setzen den Wert stillschweigend auf 0.
- **DO**: Pruefen ob der aktuelle Wert ein Binding ist: `const isBinding = typeof val === 'string' && val.includes('${')`. Falls ja: `input.type = 'text'` setzen.
- **DO NOT**: V-Button (`pickVariable`) bei `param.type === 'number'` blockieren. Numerische Felder muessen auch Variable-Bindings akzeptieren koennen.
- **DO NOT**: In `onchange`-Handlern Binding-Strings durch `Number()` oder `autoConvert()` verarbeiten. Pruefen ob `raw.includes('${')` und den Wert als String belassen.
- **ExpressionParser BUG (behoben)**: Im `MemberExpression`-Case darf das Identifier-Objekt NICHT via `resolveValue` aufgeloest werden, weil sonst TVariable-Objekte vorzeitig zu Primitiven werden und `.value`-Zugriff `undefined` ergibt.
- **VariableActions/CalculateActions**: Wenn `variableName` oder `resultVariable` einen Punkt enth�lt (z.B. `MyVar.value`), muss der Wert sowohl als flacher Key in `context.vars` als auch via `setPropertyValue` auf dem TVariable-Objekt geschrieben werden.


### 20. FlowNode Property-Shadowing (x/y Namenskonflikt)
- **DO NOT**: `PropertyHelper.getPropertyValue(flowNode, paramName)` verwenden, um Action-Parameter aus FlowNodes zu lesen. FlowElement (Basisklasse) besitzt `this.x` und `this.y` als Canvas-Position. Actions wie `move_to` definieren ebenfalls Parameter namens `x` und `y`. PropertyHelper liest dann die Canvas-Koordinate (z.B. 40) statt den Action-Parameter (z.B. `$`{MyVar.value}`).
- **DO**: Fuer FlowNodes mit `getActionDefinition()` immer die Action-Definition (SSoT) nutzen: `const actionDef = obj.getActionDefinition(); currentValue = actionDef[paramName]`. Dies ist die gleiche Methode, die alle FlowAction-Getter (`target`, `formula`, `value`, etc.) intern verwenden.
- **ACHTUNG Rendering-Pfade**: FlowActions mit `getInspectorSections()` werden durch `InspectorSectionRenderer.renderProperty()` gerendert, NICHT durch `InspectorRenderer.renderActionParams()`. Fixes muessen in `InspectorSectionRenderer.ts` erfolgen.
- **Schreiben**: `FlowNodeHandler.handlePropertyChange()` muss Action-Parameter via `getActionDefinition()` in die JSON-Definition schreiben UND in `object.data` synchronisieren. Niemals `PropertyHelper.setPropertyValue(flowNode, 'x', value)` - das ueberschreibt die Canvas-Position.

### 21. Flow-lokale Variablen (scope='local')
- **Konzept**: Variablen mit `scope='local'` existieren nur waehrend der Ausfuehrung eines Tasks. Jeder Task-Aufruf bekommt seine eigene Kopie – kein Shared-State zwischen mehreren Sprites.
- **SSoT**: Lokale Variablen werden im FlowChart-Node gespeichert (toJSON speichert komplette Definition), NICHT in `stage.variables` oder `project.variables`.
- **FlowSyncManager**: `syncVariablesFromFlow()` ueberspringt Variablen mit `scope='local'`.
- **Runtime**: `TaskExecutor.executeFlowChart()` initialisiert lokale Variablen als TVariable-like Objekte in `vars`, bevor der Task-Graph abgelaufen wird.
- **Visuell**: Lokale Variablen zeigen ein Schloss-Icon (statt Paket-Icon) und gruene Textfarbe im FlowDiagramm.


- **DO NOT** use input.name in handleControlChange when the input's name has an 'Input' suffix appended (e.g. image_picker). Always use propDef.name to ensure the correct object property is targeted.

### 22. Collision-Event-Guard (GameLoopManager)
- **Regel**: Collision-Events (onCollision, onCollisionTop/Bottom/Left/Right) und die physische Push-Out-Separation finden NUR statt, wenn mindestens eines der beiden kollidierenden Sprites ein entsprechendes Event in seinen `events` definiert hat.
- **Hintergrund**: Ohne diesen Guard wurden Pool-Sprites (z.B. Ufos untereinander) physisch auseinandergeschoben, obwohl kein Collision-Handler definiert war. Das fuehrte zu ungewollten Y-Positions-Aenderungen.
- **DO NOT**: Die Push-Out-Logik in `checkCollisions()` ohne Event-Pruefung ausfuehren. Sprites ohne Collision-Handler sollen frei durcheinander fliegen koennen.

### DOM Queries & Blueprint-Stage Falle
- **DO NOT** use a simple \document.querySelector('[data-id=...]')\ when resolving stage objects in the DOM, because objects that exist in both the Blueprint Stage and the Main Stage will have duplicate IDs in the DOM. The Blueprint element is usually \display: none\ (hidden), but \querySelector\ will still return it first, leading to a \ x0\ BoundingClientRect.
- **DO** use \document.querySelectorAll\ and filter by \el.offsetWidth > 0 && el.offsetHeight > 0\ to guarantee you are targeting the actually *visible* element on the active stage.

### CSS Transitions & Neu erstellte DOM-Elemente
- **DO NOT** set target transition properties (e.g. \	ransform\, \opacity: 0\) on a newly created and appended DOM element synchronously or within a single \equestAnimationFrame\. The browser will merge the initial and target states in the same layout pass, completely skipping the CSS transition.
- **DO** force a synchronous layout reflow (e.g. \oid document.body.offsetHeight;\) OR use a short \setTimeout(..., 30)\ before assigning the target properties to ensure the browser has painted the initial state first.

