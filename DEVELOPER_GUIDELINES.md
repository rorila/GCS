# Developer Guidelines

> [!CAUTION]
> **MANDATORY AI AGENT RULE**: Every code modification MUST be followed by executing `npm run test`. Verification of the `docs/QA_Report.md` is required for the "Definition of Done". Do NOT notify the user before running tests.

## Action System (Standardisierung / OOP)
- Jede neue Action muss ein entsprechendes Interface in `src/model/types.ts` erhalten, das von `BaseAction` erbt.
- Property-Namen im Modell müssen exakt den Feldnamen (`name` oder `actionData.field`) in der `dialog_action_editor.json` entsprechen.
- Vermeide Ad-hoc Mappings im `JSONDialogRenderer.ts`. Der "Gerade Weg" (Straight Path) ist die bevorzugte Methode: UI-Element-Name == Model-Property.
- Standard-Namen für Parameter:
    - `service`: Name des Services (statt `serviceName`)
    - `method`: Name der Methode (statt `serviceMethod` oder `serviceAction`)
    - `resultVariable`: Zielvariable für Ergebnisse (konsistent über alle Typen)
    - `formula`: Berechnungsformel für `calculate` Actions
    - `variableName`: Name einer zu lesenden/schreibenden Variable (statt `variable`)

    - `variableName`: Name einer zu lesenden/schreibenden Variable (statt `variable`)

## AI Agent API & Flow Safety (v3.3.6)
- **AgentController**: Alle programmatischen Änderungen am Projekt (durch Scripts/AI) MÜSSEN über den `AgentController` laufen. Direkte Manipulation von `project.json` ist verboten, um Inkonsistenzen zu vermeiden.
- **Scorched Earth Strategy (Flow)**:
    - Wenn Logik (Tasks/Actions) programmatisch geändert wird, muss das zugehörige `flowChart` gelöscht werden (`invalidateTaskFlow`).
    - Der `FlowEditor` besitzt eine automatische **Self-Healing-Funktion** (`generateFlowFromActionSequence`), die beim Öffnen aus der Logik ein perfektes Diagramm regeneriert.
    - Versuche NIEMALS, Flow-Diagramme (Nodes/Edges) manuell via Skript zu patchen. Das führt zu Desynchronisation. Löschen und Regenerieren lassen ist sicherer.
- **Inline-Action Verbot**:
    - Programmatisch erstellte Tasks dürfen KEINE kompletten Action-Objekte in `actionSequence` enthalten.
    - **Korrekter Weg**: Action global definieren (`project.actions.push({...})`) -> Im Task nur Referenz speichern (`{ type: 'action', name: '...' }`).

## Stage-Navigation – Robuster Dispatch (v3.3.7)
- **Primärer Pfad**: `navigate_stage` nutzt `TStageController.goToStage()` direkt (funktioniert in Editor, Standalone-Player, Embedded).
- **Fallback**: Wenn kein `TStageController` vorhanden, wird `onNavigate('stage:...')` genutzt (Editor-only).
- **DO NOT**: Navigiere NIEMALS direkt über `onNavigate` ohne Fallback – der Standalone-Player unterstützt nur `game:`, `host:`, `lobby`, `room:` und `stage:` Prefixes.

## Blueprint Flow Visualisierung (v3.3.8 → v3.3.14)

> [!CAUTION]
> **VERALTET (v3.3.8–v3.3.12)**: Der alte Ansatz nutzte ein statisches Mermaid-Diagramm (`#blueprint-viewer`, `renderFlowDiagram()`). Dieser wurde in **v3.3.13 vollständig entfernt**.

- **Aktuelles Konzept (v3.3.13+)**: Die Blueprint-Stage nutzt im Flow-Tab denselben **interaktiven FlowEditor** (`#flow-viewer`) wie alle anderen Stages. Keine Sonderbehandlung in `Editor.ts`.
- **`blueprintContainer` entfernt**: Das Feld, der Initialisierungsblock und alle Render-Aufrufe wurden aus `Editor.ts` entfernt.
- **Stage View**: Zeigt globale Objekte (Services, Variablen) auf dem Stage-Canvas.
- **Flow View**: Zeigt interaktives Flow-Diagramm mit allen Blueprint-Tasks im Dropdown.

## Blueprint View Separation (v3.3.11–v3.3.14)
- **Stage-Tab vs. Flow-Tab**: `Editor.render()` nutzt den `isStageOrRunView`-Guard, damit `stage-wrapper` nur bei `currentView === 'stage'` oder `'run'` eingeblendet wird.
- **Visibility-Fix**: Globale Elemente (Services) sind auf normalen Stages (`type: 'standard'`) strikt unsichtbar, es sei denn, sie werden explizit importiert.

## Blueprint Flow-System (v3.3.14)
- **SSoT für globale Tasks**: Alle globalen Tasks und FlowCharts liegen in `stage_blueprint.tasks[]` und `stage_blueprint.flowCharts{}`.
  - Root-Level (`project.tasks`, `project.flowCharts`) = nur Legacy-Fallback.
- **Dropdown-Aufbau** (`FlowEditor.updateFlowSelector()`, L535–605):
  1. **Block 0**: `activeStage.flowCharts` scannen (Tasks MIT Flow-Diagramm).
  2. **Block 0b**: `activeStage.tasks` scannen (Tasks OHNE Flow-Diagramm).
  3. Deduplication via `stageTaskKeys`.
  4. Legacy: `project.flowCharts` → `project.tasks` (Fallback).
- **Gruppe heißt**: `🔷 Blueprint / Global` (statt "Global / Projekt (Infrastruktur)").
- **Self-Healing**: Wenn ein Blueprint-Task noch kein FlowChart hat, generiert `generateFlowFromActionSequence` beim Öffnen ein sauberes Diagramm.
- **AgentController-Integration**: `AgentController.createTask('blueprint', name)` legt neue Tasks korrekt in `stage_blueprint.tasks[]` ab → erscheinen sofort im Dropdown.
- **DO NOT**: Niemals nur `project.tasks` für Blueprint-Tasks scannen. Immer `activeStage.tasks` priorisieren.
- **UseCase-Dokument**: `docs/use_cases/BlueprintFlowDropdown.md`
- **Agenten-Workflow**: `/blueprint-flow-dropdown`

## Inspector & Refactoring (v2.16.21)
- **Inspector JSON-Konfiguration**: Für Flow-Elemente mit spezifischem Layout (wie `DataAction`) ist die Verwendung einer dedizierten JSON-Datei (z.B. `public/inspector_data_action.json`) der Standard.
    - **Two-Way-Binding**: Um Felder editierbar zu machen, muss das Binding direkt auf das Property zeigen (z.B. `${selectedObject.Name}` statt `${selectedObject.name || ...}`).
    - **Vermeidung von Komplexität**: Komplexe Ausdrücke im `text`-Property verhindern das Rückschreiben von Werten.
- **Automatische Labels & Filterung (v3.1.0)**:
    - Wenn ein Template ein `label` Feld enthält, wird dieses automatisch als `TLabel` über dem Control gerendert.
    - Spezialisierte Templates (alles außer `inspector.json`) unterdrücken nun automatisch die Anzeige der generischen "Allgemeine Info"-Felder am Ende der Liste.
    - Nutze `placeholder` in `TDropdown` Definitionen für leere Startzustände.
- **DataAction Renaming**:
    - `DataActions` sind vollwertige Actions und müssen im `RefactoringManager` explizit behandelt werden (`item.type === 'data_action'`).
    - Das Umbenennen im Inspector ändert die ID (`Name`), was sicher ist, solange der Reset des RefactoringManagers greift.
- **Getter/Setter auf Flow-Elementen**:
    - Achtung bei `FlowElement.ts`: `name` (kleingeschrieben) ist ein read-only Getter (ID).
    - `Name` (Großgeschrieben) ist der Setter für den Anzeigenamen. Im Inspector-Handler muss zwingend `object.Name = newValue` verwendet werden, um TypeErrors zu vermeiden.
- **Dynamische Dropdowns**:
    - Verwende wann immer möglich `source: 'tasks'`, `source: 'actions'` etc. in `TPropertyDef` statt statischer `options`.
    - Dies stellt sicher, dass Dropdowns immer den aktuellen Projektzustand widerspiegeln (keine Stale Data nach Löschung).
- **Smart Variable Inspector (v3.2.0)**:
    - **Sichtbarkeits-Logik (`visible`)**: Nutze die `visible`-Eigenschaft in JSON-Templates (`inspector_variable.json`), um Felder basierend auf regulären Expressions (z.B. `${selectedObject.type === 'timer'}`) ein- oder auszublenden. Die Evaluierung erfolgt im `InspectorHost.ts` via `resolveRawValue`.
    - **Event-Templates**: Handler können spezialisierte Event-Templates via `getEventsTemplate(obj)` bereitstellen. Für Variablen wird `inspector_variable_events.json` verwendet, das typspezifische Events (wie `onTimer` oder `onGenerated`) anbietet.
    - **Scope-Selection**: Das `scope`-Feld in der `inspector_variable.json` ermöglicht die Auswahl zwischen `global` (🌎) und `stage` (🎭) Scopes.

## UseCase-Index-System
Zur besseren Wartbarkeit und schnelleren Orientierung im Code pflegen wir ein UseCase-System in `docs/use_cases/`.
- **Zweck**: Dokumentation technischer Abläufe über Dateigrenzen hinweg.
- **Index**: Die Datei `UseCaseIndex.txt` gibt eine Übersicht über alle UseCases. Das ist die erste Anlaufstelle für die Suche.
- **Details**: Jede `.md` Datei in diesem Ordner dokumentiert einen UseCase mit:
    - **Ablaufdiagramm** (Mermaid) zur Visualisierung der Interaktionen.
    - **Beteiligte Dateien & Methoden**: Immer spezifische Methodennamen und aktuelle Zeilenbereiche (z.B. L123-145) angeben. Dies dient als Anker für die schnelle Suche.
    - **Datenfluss** (Input/Output).
    - **Zustandsänderungen** (globaler/lokaler State).
- **Struktur-Besonderheiten**: (z.B. Branching Actions wie DataAction).
- **Pflicht**: Neue komplexe Features oder Refactorings müssen dort dokumentiert werden. Nutze `UseCaseTemplate.md` als Basis.

## Reactive Bindings & Variablen
- **Namens-Konsistenz**:
    - `RuntimeVariableManager` muss Variablen immer unter ihrem **Namen** (z.B. `currentUser`) speichern, auch wenn Actions sie via ID (`var_currentUser`) ansprechen.
    - Dies ist kritisch für `ReactiveRuntime`, da Bindings (`${currentUser.name}`) auf den Namen warten.
- **Priorität im Context**:
    - Im `ExpressionParser`-Context haben Variablen-Werte (`this.variables`) Vorrang vor Komponenten-Objekten (`this.objectsByName`).
    - Wenn eine Variable und eine Komponente denselben Namen haben, wird der Variablen-Wert verwendet (unwrap).
- **Global Definitions**:
    - Der `RuntimeVariableManager` baut beim Start einen globalen Index (`globalDefinitions`) aus allen Stages auf. Dies ermöglicht Cross-Stage-Zugriffe.

## Modulare Architektur (Monolithen-Aufteilung)
Um die Wartbarkeit zu verbessern und Token-Limit-Fehler zu vermeiden, wurden die Hauptklassen modularisiert:

### Inspector-Architektur (v3.0.0 / OO-Refactoring)
Der monolithische Inspector (ehemals JSONInspector.ts) wurde durch ein modulares, objektorientiertes System ersetzt:
- **InspectorHost.ts**: Das Herzstück. Orchestiert das Laden von Templates, das Rendering und die Event-Verarbeitung.
- **InspectorRenderer.ts**: Kapselt die Logik für visuelle Komponenten. Unterstützt nun auch `TNumberInput`, `TCheckbox` und rekursive `TPanel`-Strukturen für komplexe Layouts.
- **InspectorRegistry.ts**: Mappt Objekt-Klassen auf die passenden JSON-Templates.
- **InspectorEventHandler.ts**: Zentraler Hub für alle UI-Events. Delegiert komplexe Logik an spezialisierte Handler.
- **Handler-Pattern**: Neue Fachlogik sollte in spezialisierten Handlern (z.B. `VariableHandler.ts`, `FlowNodeHandler.ts`) implementiert werden.
- **Design-Time Runtime (v3.1.0)**: Der Inspector benötigt eine `ReactiveRuntime` zur Evaluation von Bindings (`${...}`). Für den Editor-Betrieb ohne aktives Spiel wird eine `designRuntime` in `Editor.ts` verwendet, um konsistentes Rendering zu garantieren.
- **Expression Evaluation**: Der Inspector nutzt den `ExpressionParser`, um Bindings robust aufzulösen. Dabei wird das `selectedObject` automatisch in den Kontext injiziert.

### Editor-Architektur
Die Klasse `Editor.ts` fungiert nur noch als Orchestrator. Die Fachlogik liegt in:
- **EditorStageManager.ts**: Alles rund um das Verwalten von Stages (Neu, Klonen, Löschen, Templates).
- **EditorViewManager.ts**: Steuerung der Tabs und Ansichten (Stage, Flow, JSON, Pascal).
- **RefactoringManager.ts**: Projektweite Umbenennungen und Referenz-Updates.

### FlowEditor-Architektur (v2.5.0)
Die Klasse `FlowEditor.ts` wurde modularisiert, um die Komplexität zu reduzieren:
- **FlowSyncManager.ts**: Übernimmt die gesamte Synchronisations-Logik zwischen dem visuellen Diagramm und dem Datenmodell (JSON/Pascal). Beinhaltet Methoden wie `syncVariablesFromFlow`, `syncTaskFromFlow`, `restoreNode` und `generateFlowFromActionSequence`.
- **FlowStateManager.ts**: Verwaltet den UI-Zustand des Editors (z.B. Detailtiefe der Nodes, Zoom).
- **FlowMapManager.ts**: (v2.5.1) Kapselt die Generierung der "Landkarte" (Events/Links) und der "Elementenübersicht" sowie die "Action-Check" Logik.
- **FlowContextMenuProvider.ts**: (v2.6.0) Zentralisiert die gesamte Logik für Kontextmenüs (Knoten, Verbindungen, Canvas). Ermöglicht das schnelle Erstellen von Elementen via Rechtsklick.
- **Node-Labels (v2.6.3)**:
    - Um den Kontext einer Aktion im Diagramm sofort erkennbar zu machen, folgen die Node-Labels dem Schema `Taskname ---- Actionname`.

## API & DataAction Robustness (v2.16.23)
- **Global Actions**:
    - `DataActions` (oder komplexe Action-Typen) sollten idealerweise **global oder auf Stage-Ebene** im `actions`-Array registriert sein.
    - **Problem**: Inline-Actions (direkt in der `actionSequence` eines Tasks) werden vom `TaskExecutor` oft nur mit ihren Rumpfdaten (`name`, `type`) geladen. Metadaten wie `url` oder `resource` fehlen dann.
    - **Lösung**: Verschiebe die Action in die Registry und referenziere sie nur im Task.
- **TaskExecutor Resolution**:
    - Der `TaskExecutor` muss in `resolveAction` so robust sein, dass er Actions **unabhängig vom Typ** anhand des Namens in der Registry findet (nicht nur `type === 'action'`).
- **Robustes Parameter-Parsing**:
    - **ApiSimulator (Editor)**: Relatives URL-Parsing (`pathname`, `searchParams`) erfordert eine Dummy-Base (`new URL(url, 'http://localhost')`), da der Browser sonst bei `/api/...` wirft.
    - **ActionApiHandler (Server)**: Implementiere **Fallback-Parsing**! Verlasse dich nicht darauf, dass der Aufrufer (Editor/Runtime) `query` bereits perfekt geparst hat. Parse Parameter im Zweifel selbst aus dem `path`.

## Quality Assurance & Regression-Prävention (v2.17.0)
Um zu verhindern, dass Features nach Änderungen wieder kaputt gehen, gilt ab sofort:
1.  **Impact-Analyse**: Vor jeder Änderung muss ich (die KI) folgende Fragen beantworten:
    - Welche anderen Komponenten nutzen diese Funktion/Datei?
    - Gibt es einen Regression-Test (z.B. in `scripts/`), der diesen Bereich abdeckt?
2.  **Test-Pflicht**: Nach jeder Änderung an der Kernlogik (Sync, Executor, API) **muss** `npm run test` ausgeführt werden.
3.  **Test-Daten**: Nutze für Tests ausschließlich die in `db.json` via `npm run test:seed` erstellten Test-User (`TestAdmin`, `TestUser`).
4.  **Kein "Frickeln"**: Wenn eine Änderung mehrere Fallback-Layer erfordert, ist oft die Architektur das Problem. Refactoring der Kern-Methode ist dem "Dran-Patchen" vorzuziehen.


    - Bei Untertasks oder Map-Events wird das Präfix automatisch aus den Metadaten des Knotens (`taskName` oder `sourceTaskName`) generiert.
- **Flow Cleanup Logic**:
    - Der `FlowSyncManager` verfügt über eine `cleanCorruptTaskData` Methode. Diese entfernt automatisch fehlerhafte Einträge (wie `"elements"` oder `"connections"`), die durch fehlerhafte Speichervorgänge fälschlicherweise in der Task-Liste gelandet sind.
    - Dieser Cleanup wird automatisch beim Laden eines Projekts in `Editor.loadProject` ausgeführt.
- **Koordinaten-Ausrichtung (v2.10.1)**:
    - Der Flow-Editor nutzt ein Grid-System. Historisch gewachsene Offsets (z.B. -80px auf der X-Achse) wurden entfernt, um eine konsistente Ausrichtung zwischen Knoten und Verbindungen zu gewährleisten.
    - Achte darauf, dass beim Generieren neuer Diagramme keine künstlichen Offsets in `FlowSyncManager.generateFlowFromActionSequence` eingeführt werden.
- **Action-Anzeige & Synchronisation (v2.16.19)**:
    - Die visuelle Beschreibung einer Action im Flow-Editor (z.B. `a := b + c`) wird NICHT mehr vom Flow-Editor selbst berechnet.
    - **Single Source of Truth**: Die Quelle ist das Feld `details` im Action-Objekt des JSON-Modells.
    - Dieses Feld wird vom `JSONDialogRenderer.generateActionDetails` beim Speichern im Action-Editor befüllt.
    - `FlowAction.getActionDetails` priorisiert dieses Feld und nutzt eine interne Logik nur noch als Fallback (z.B. für manuelle Pascal-Edits).
    - Dies stellt sicher, dass Änderungen im Dialog sofort und konsistent im Diagramm sichtbar sind.
- **Typ-Vollständigkeit im Sync (v2.16.23)**:
    - Der `FlowSyncManager.syncToProject` muss jeden Knotentyp (z.B. `'Action'`, `'DataAction'`) explizit in seiner Registrierungsschleife unterstützen. Neue Knotentypen müssen dort nachgetragen werden, damit sie beim Erstellen sofort im Projektmodell angemeldet werden.
- **Persistenz & Scoping (v2.10.1)**:
    - FlowChart-Daten (`elements`, `connections`) müssen IMMER unter dem Namen des Tasks als Key in der `flowCharts` Collection gespeichert werden (z.B. `targetCharts[taskName] = chartData`).
    - Ein direktes Speichern auf dem Collection-Objekt führt dazu, dass sich Diagramme verschiedener Tasks gegenseitig überschreiben.
    - Verwende das `isLoading` Flag im `FlowEditor`, um zu verhindern, dass während des Ladevorgangs unvollständige Daten zurück in das Projekt synchronisiert werden.
- **Task-Suche (v2.16.14)**:
    - ⚠️ **NIEMALS nur `project.tasks` durchsuchen!** Tasks leben primär in `stage.tasks` (pro Stage), nicht im Root-Array.
    - Korrekte Suchreihenfolge: **Aktive Stage → Alle Stages → Root** (`project.tasks`).
    - Verwende `TaskEditor.findTaskAndContainer()` als Referenz-Implementierung.
    - Beim Erstellen neuer Tasks: bevorzugt in die aktive Stage einfügen, nicht ins Root-Array.
- Task-Umbenennung & Sync (v2.16.15):
    - Nutze in Flow-Knoten (`FlowElement.ts`) statische Importe für den `RefactoringManager`, um projektweite Umbenennungen zu garantieren.
    - Synchronisiere bei Namensänderungen im Inspector immer den `localStorage` (`gcs_last_flow_context`) und aktualisiere den `FlowEditor` Pointer, um Kontext-Verluste zu vermeiden.
- Projekt-Hygiene (v2.16.15): `RefactoringManager.sanitizeProject` bereinigt nun automatisch Duplikate zwischen Root und Stages. Globale Tasks, die bereits in einer Stage existieren, werden aus `project.tasks` entfernt.

- **Logik-Standardisierung (v2.7.0)**:
    - **Inline-Actions**: Das Verwenden von Inline-Aktionen innerhalb der `actionSequence` eines Tasks ist veraltet. Aktionen sollten IMMER im `actions`-Array der Stage (oder global) als benannte Entitäten definiert werden.
    - **Referenzierung**: In Tasks erfolgt der Aufruf ausschließlich via `{ "action": "Name", "params": { ... } }`.
- **Workflow**: Änderungen an der Fachlogik sollten bevorzugt in den jeweiligen Managern vorgenommen werden. `FlowEditor` fungiert primär als UI-Host und Event-Verteiler.
- **Koordinaten & NaN-Safety**:
    - Der Flow-Editor nutzt einen **Canvas-World-Koordinatenraum** (0 bis 5000px). Maus-Events müssen stets um den `scrollLeft`/`scrollTop` des Canvas korrigiert werden, um absolute Welt-Koordinaten zu erhalten.
    - Die `cellSize` ist eine kritische Eigenschaft für das Grid-Snapping. Alle Manager müssen via `host.cellSize` (lowercase!) darauf zugreifen. Fehlende cellSize führt zu `NaN`-Werten.
    - `FlowSyncManager.restoreNode` enthält redundante `isNaN`-Prüfungen als Sicherheitsnetz für beschädigte Projektdaten.

### Inspector Integration for Flow Elements
- **Events**: Flow elements (running in the Editor context) must implement `public getEvents(): string[]` (returning `[]` if none) to bypass the `ComponentRegistry` lookup. The `InspectorHost` prefers this method over the registry to avoid warnings for non-GameObjects.
- **Deletion**: Deleting elements via the Inspector requires explicit routing in `Editor.ts`. If the `FlowEditor` is active (`currentView === 'flow'`), delete requests for Flow nodes must be delegated to `FlowEditor.deleteNode()` to handle reference checks and specific cleanup logic.


### Stage-Awareness in der Entwicklung
- **Code-Generierung**: Bei der Generierung von Code (z.B. `PascalGenerator`) muss immer projektweit gesucht werden (Global + alle Stages), da Tasks und Aktionen in verschiedenen Scopes liegen können.
- **Refactoring**: Operationen wie Löschen (`deleteTask`, `deleteAction`) oder Bereinigen (`cleanActionSequences`) müssen zwingend alle Stages iterieren, um verwaiste Referenzen oder Datenleichen in nicht-aktiven Stages zu vermeiden.
- **Primat der Stages**: Da der Editor zunehmend stage-basiert arbeitet, sollten neue Funktionen standardmäßig stage-übergreifend implementiert werden.

### Datenmodell: Events vs Tasks vs Actions (v2.16.17)
- **Events** (`"events": Record<string, string>`): Mappings auf Objekten und Stages. Verknüpfen UI-Trigger mit Tasks.
    - **WICHTIG**: Historisch wurde hierfür teilweise der Key `Tasks` verwendet. Das System wurde auf `events` vereinheitlicht, bietet aber Fallback-Support für `Tasks`.
    - Auf Objekten: `"events": { "onClick": "DoLogin", "onSelect": "HandleChoice" }`
    - Auf Stages: `"events": { "onRuntimeStart": "InitStage" }`
- **Tasks** (`"tasks": GameTask[]`): Workflow-Definitionen mit `actionSequence`. Ein Task referenziert Actions.
  - `"tasks": [{ "name": "DoLogin", "actionSequence": [{ "type": "action", "name": "ValidateInput" }] }]`
- **Actions** (`"actions": GameAction[]`): Einzelne Logik-Schritte (calculate, navigate_stage, http, etc.).
  - `"actions": [{ "name": "ValidateInput", "type": "condition", "body": [...] }]`

### Punkt-Notation zur Task-Auflösung (v2.16.17)
- **Konzept**: Die Notation `ObjektName.EventName` (z.B. `PinPicker.onSelect`) wird vom `TaskExecutor` rekursiv aufgelöst.
- **Auflösungs-Strategien**:
    1. **Direct Resolution**: Falls das auslösende Objekt (`contextObj`) namentlich passt, wird direkt in dessen `events`-Map nachgeschlagen (Performanteste Methode).
    2. **Deep Search (Fallback)**: Rekursiver Scan über:
        - Alle Stages (Objekte & Variablen)
        - Globale Projekt-Variablen
        - Root Projekt-Objekte
- **Optionale Events**: Lifecycle-Events wie `onStart`, `onLoad` etc. lösen keine Warnungen aus, wenn sie nicht im Projekt definiert sind.

### Hosting-Regeln für globale Daten (v2.16.13)
- **Globale Variablen**: Werden ausschließlich in `stage_blueprint.variables` mit `scope: "global"` gehostet. NICHT in `project.variables` (Root bleibt `[]`).
- **Globale Objekte/Services**: Werden ausschließlich in `stage_blueprint.objects` gehostet. NICHT in `project.objects` (Root bleibt `[]`).
- **`ProjectRegistry.getVariables()`**: Lädt Globals aus der Blueprint-Stage (type === 'blueprint'). Bei aktiver Blueprint-Ansicht werden diese Variablen als `uiScope: 'global'` behandelt, NICHT als Stage-Variablen.
- **`ProjectRegistry.getObjects()`**: Lädt globale Objekte aus allen Stages (inkl. Blueprint) via Dedup-Logik.
- **Sichtbarkeit (v2.16.12)**: Vererbte Blueprint-Objekte werden auf normalen Stages im Editor ausgeblendet (`isFromBlueprint`), um die UI sauber zu halten. Sie bleiben im Hintergrund (Runtime) voll funktionsfähig.

### DataActions & Auto-Magic Simulation (v2.16.10)
- **Konzept**: `DataActions` (typ: `data_action` oder `http`) unterstützen eine automatisierte Ressourcen-Simulation, die den echten Server spiegelt.
- **Auto-Routing**: Wenn eine URL mit `/api/data/` beginnt, verarbeitet der `ApiSimulator` im Editor die Anfrage automatisch gegen die `db.json` via `DataService`. 
    - **WICHTIG**: In diesem Fall ist KEIN manueller `HandleApiRequest` Task im Flow-Editor erforderlich.
- **Konfiguration**:
    - Nutze `resource` (z.B. `users`), `queryProperty` (z.B. `authCode`) und `queryValue` (z.B. `${pin}`), um Abfragen strukturiert zu definieren.
    - Die `http` Aktion konstruiert daraus automatisch die korrekte Route.
- **Ergebnis-Mapping**: Nutze `resultVariable` für das Ziel und optional `resultPath` (z.B. `0` für das erste Element eines Arrays), um die Antwort zu extrahieren.
- **Smart-Access & Universal-Unwrapping (v2.18.12.2)**: Dank der Logik in `PropertyHelper.ts` (L18-24) und `StandardActions.ts` (L367/L407) werden API-Resultat-Arrays mit nur einem Element jetzt automatisch "an der Quelle" entpackt. 
    - **Vorteil**: `${currentUser.name}` kann direkt verwendet werden, da `currentUser` als sauberes Objekt gespeichert wird.
    - **Vereinheitlichung**: Der `ExpressionParser.ts` (L192-195) nutzt nun konsistent den `PropertyHelper` für alle Pfad-Auflösungen.
- **Reaktive Pfad-Auflösung (Transparency vs. Metadata Fallback) (v2.18.12.5)**: 
    - Um Variablen-Komponenten (`TVariable`) gleichzeitig als Daten-Container (Spiellogik) und als editierbare Komponenten (Inspector) zu unterstützen, nutzt `PropertyHelper.getPropertyValue` eine Fallback-Logik.
    - **Regel**: Der Helper versucht zuerst, die Eigenschaft im **Inhalt** (resolved value) der Variable zu finden (Transparenz).
    - **Fallback**: Wird die Eigenschaft im Inhalt nicht gefunden (z.B. `.value` oder `.defaultValue` bei einem String-Inhalt), wird automatisch auf die Eigenschaften der **Variablen-Komponente selbst** zurückgegriffen.
    - Dies erlaubt Ausdrücke wie `${currentUser.name}` (Datenzugriff) und gleichzeitig `${selectedObject.value}` (Inspector-Binding/Metadaten) ohne gegenseitige Störung.
- **Beginner-Safe Variable Picker (v2.18.12.4)**: Alle `TEdit`-Felder im Inspector verfügen über ein automatisches Variablen-Dropdown (📦). 
    - **Funktion**: Erlaubt das Einfügen von Variablen per Klick an der aktuellen Cursor-Position, ohne `${}` tippen zu müssen.
    - **Implementierung**: Geregelt über `renderEditWithVariablePicker` (InspectorRenderer.ts).
- **Keep it Simple**: Bevorzuge immer die automatisierte Simulation für Standard-CRUD-Operationen. Nur für komplexe Spezial-Logik sollten manuelle API-Event-Tasks (`onRequest`) verwendet werden.

### Variablen-Scoping & Inspector (v2.16.12)
- **Kontext-Synchronisation**: Der InspectorHost im Flow-Editor benötigt den korrekten Stage-Kontext (`activeStageId` in `ProjectRegistry`), um stagelokale Variablen anzuzeigen.
- **Automatisches Umschalten**: Beim Wechsel des Tasks im Flow-Editor (`switchActionFlow`) wird die Stage automatisch via `projectRegistry.getTaskContainer` ermittelt und gesetzt.
- **Lokale Parameter**: Für task-lokale Variablen muss der Task-Name als Context an `getVariables()` übergeben werden. Der Inspector nutzt dafür den `localStorage` Key `gcs_last_flow_context`.
- **Best Practice**: Greife immer über `projectRegistry.getVariables(context)` auf Variablen zu, um die volle Vererbungshierarchie (Global > Stage > Local) abzubilden.

### Runtime-Architektur
Die Klasse `GameRuntime.ts` delegiert ihre Kernaufgaben an:
- **RuntimeStageManager.ts**: Auflösung der Vererbungskette (`inheritsFrom`), Mergen von Objekten/Tasks aus mehreren Ebenen.
- **RuntimeVariableManager.ts**: Verwaltung des Variablen-Kontexts, Scoping-Präzedenz (Local > Global) und reaktive Trigger-Logik.
- **GameRuntime implements IVariableHost**: Ermöglicht dem VariableManager den Zugriff auf Timer und Event-Execution ohne zirkuläre Abhängigkeiten.

- **Explizite Event-Triggerung (v2.16.3)**: 
    - Variablen-Events (`onValueChanged`, `onThresholdReached`, etc.) werden nur noch dann ausgelöst, wenn sie im Flow-Editor explizit einem Task zugeordnet wurden (Eintrag im `Tasks`-Objekt der Variable).
    - Dies verhindert, dass das System automatisch nach Tasks mit dem Namen `Variable.Event` sucht und diese ausführt, was zu unerwünschten Seiteneffekten führen konnte.
    - Die `onValueChanged`-Kette läuft nun asynchron via `await`, um Race-Conditions bei aufeinanderfolgenden Aktionen zu minimieren.

## Rendering & Game Loop
- **GameLoopManager (Singleton)**: Verwende den `GameLoopManager.getInstance()` für alle Spielobjekt-Updates und Kollisionsprüfungen. Er ist KEIN Stage-Objekt und umgeht somit Proxy-Binding-Probleme.
- **GameRuntime Authority**: Die `GameRuntime` ist die "Source of Truth" für den Spielzustand im Run-Modus.
- **Keine manuelle GameLoop-Init**: Der `Editor` darf den `TGameLoop` nicht manuell initialisieren (`init/start`). Die `GameRuntime.start()` Methode übernimmt dies via `GameLoopManager`.
- **Ticker-Synchronisation**: Falls der `Editor` einen Fallback-Animations-Ticker verwendet (z.B. wenn keine `GameLoop` vorhanden ist), muss dieser gestoppt werden (`stopAnimationTicker`), sobald eine echte `GameLoop` zur Laufzeit erscheint (z.B. nach einem Stage-Switch).
- **Stage-Cleanup**: Bei jedem Stage-Wechsel MÜSSEN `ReactiveRuntime.clear()` und `AnimationManager.getInstance().clear()` aufgerufen werden, um persistente Objekte oder laufende Animationen der vorherigen Stage zu entfernen.
- **Stage-Diagnostics**: Bei leeren Bildschirmen im Run-Mode ist die erste Prüfung die Kalkulation der Stage-Größe. `Stage.ts` loggt `Game Stage Size` beim Update. Eine Größe von 0x0px deutet auf CSS-Layout-Probleme im Host-Container hin.
- **Interaktions-Garantie**: `TButton` Komponenten sollten im Run-Modus immer als klickbar (`cursor: pointer`) markiert werden, auch ohne explizite Task-Zuweisung, um generische Events für die `GameRuntime` abfangbar zu machen.
- **Render-Callback**: Übergib den Render-Callback (`onRender`) direkt an den `GameRuntime`-Konstruktor (`options.onRender`).
- **Komponenten-Status-Synchronisation (v2.16.2)**:
  - **Problem**: Bei Events, die Daten übergeben (z.B. `TEmojiPicker.onSelect`), kann es zu Race Conditions kommen, wenn die Runtime-Instanz der Komponente noch nicht aktualisiert wurde, bevor Actions ausgeführt werden.
  - **Lösung**: In `GameRuntime.handleEvent` muss der Status der Runtime-Komponente explizit mit den Event-Daten synchronisiert werden, *bevor* `actionExecutor` oder `taskExecutor` aufgerufen werden.
  - **Pattern**:
    ```typescript
    // In GameRuntime.handleEvent
    if (obj.className === 'MyComponent' && eventName === 'onDataChange') {
        obj.value = data; // Expliziter Sync VOR Action-Ausführung
    }
    // ... danach erst Action-Execution
    ```

- **Hybrides Variablen-System (v2.7.0)**: 
    Die Komponente `TVariable` (und abgeleitete Klassen wie `TTimer`, `TGameLoop`) werden im Editor als visuelle Objekte behandelt, aber im JSON getrennt im `variables`-Array gespeichert.
    - **Visualisierung**: Damit Variablen auf der Stage gerendert werden können, müssen sie in der `variables`-Sektion folgende Eigenschaften besitzen: `x`, `y`, `width`, `height`, `isVariable: true` und `className: "TVariable"`.
### Variablen-Design & Scoping (v2.9.0)

Variablen folgen einem spezialisierten GCS-Schema für verbesserte Übersicht und Architektur:

- **Spezialisierte Typen**: Verwende spezialisierte Klassen statt der generischen `TVariable`:
  - `TStringVariable` (Emojis: `📝`)
  - `TIntegerVariable` (Emojis: `🔢`)
  - `TBooleanVariable` (Emojis: `⚖️`)
  - `TRealVariable` (Emojis: `📏`)
  - `TObjectVariable` (Emojis: `📦`)
- **Persistenz & Core Identity (v2.17.0)**:
  - Bei Komponenten mit spezialisierten Unterklassen (wie `TVariable`), muss sichergestellt werden, dass Änderungen an Typ-Eigenschaften (z.B. `type`) sofort den `className` des Objekts aktualisieren.
  - **Morphing Pattern (v2.17.1)**: Wenn eine Typs-Änderung eine fundamentale Klassen-Änderung zur Folge hat (z.B. `TIntegerVariable` zu `TObjectVariable`), muss die gesamte Instanz im Projektmodell ausgetauscht werden.
  - Nutze dazu `editor.morphVariable(obj, newType)` in `Editor.ts`. Diese Methode erstellt eine neue Klassen-Instanz, kopiert ID, Name und Metadaten und ersetzt das alte Objekt in allen relevanten Listen (Global/Stage).
  - Dies verhindert Race-Conditions und Inkonsistenzen zwischen Prototype/Methoden und den gespeicherten Daten.
- **Expression Context Priority** (v2.18.4): In Berechnungen haben Variablen-Proxy-Werte Vorrang vor Komponenten-Objekten.
- **Action System Closure-Free** (v2.18.5): Aktionen dürfen keine Spiel-Objekte per Closure binden. Stattdessen MUSS `context.objects` verwendet werden, um sicherzustellen, dass immer die aktuelle Objektliste der ausführenden Komponente (Runtime/Editor) genutzt wird.
- **Serialization Integrity** (v2.18.5): Bei der Erweiterung der Serialisierung in Unterklassen (z.B. `TVariable`) muss IMMER `super.toJSON()` aufgerufen werden, um den Verlust von Basis-Eigenschaften zu vermeiden.
- **SSoT-Schutz & Design-Values** (v2.18.6):
  - **Erhaltung von Formeln**: Bindungen (Formeln wie `${...}`) werden im `DESIGN_VALUES` Symbol der Instanz gespeichert.
  - **Persistenz**: `toJSON` priorisiert `DESIGN_VALUES` vor den aktuellen (evaluierten) Property-Werten.
  - **Inspector-Anzeige**: Der `InspectorHost` liest bevorzugt aus `DESIGN_VALUES`, um dem Benutzer die Formel zur Bearbeitung anzuzeigen, während die Stage den Laufzeit-Wert rendert.
  - **Action-Context**: Beim Aufruf von `actionExecutor.execute` muss die Variablen-Liste im 3. Parameter (`globalContext`) übergeben werden, damit die `contextVars` der Runtime aktualisiert werden.
- **Serialization Robustness (v2.18.4)**:
  - Bei der Hydrierung von Objekten in `Serialization.ts` muss die `isVariable`-Eigenschaft explizit geschützt werden. 
  - Sie darf nur dann überschrieben werden, wenn sie im JSON-Datensatz explizit vorhanden ist, um zu verhindern, dass sie fälschlicherweise auf `false` (Default-Zuweisung) zurückfällt und so die Variablen-Synchronisation unterbricht.
- **Visualisierung & Scoping**:
  - Globale Variablen (`scope: "global"`) und Service-Komponenten werden visuell nur noch auf Stages vom Typ `blueprint` (z.B. `stage_blueprint`) gerendert.
  - Auf Standard-Stages sind nur noch Stage-lokale Variablen (`scope: "stage"`) visuell präsent.
  - Logisch bleiben globale Variablen über Expressions (`${varName}`) auf allen Stages erreichbar.
- **Maße & Layout**:
  - Alle Variablen-Icons haben eine Standardgröße von **6x2 Einheiten**.
  - Anordnung: Vertikale Stapelung am linken Rand (X=0). Globale Variablen starten bei Y=0, Stage-Variablen bei Y=12.
- **Farbschema**: Schwarz (`#000000`) auf Hellviolett (`#d1c4e9`) mit dunklerer Umrandung (`#9575cd`).
- **Persistenz**: `EditorStageManager.syncStageObjectsToProject` sorgt für die saubere Trennung beim Speichern.
- **Variablen-Wert-Konsolidierung & Reaktivität (v2.12.1)**:
  - **Single Source of Truth**: Die Methode `PropertyHelper.resolveValue(obj)` extrahiert zuverlässig den Inhalt einer Variablen-Komponente (`.value` oder `.items`). Sie muss in allen Logik-Komponenten verwendet werden.
  - **Context Precedence**: In `ReactiveRuntime.getContext()` haben explizite Variablen-Werte Vorrang vor Objekt-Proxies gleichen Namens, um Shadowing-Probleme zu vermeiden.
  - **Präzise Synchronisation**: Der `RuntimeVariableManager` synchronisiert Werte zu Komponenten-Instanzen immer über deren eindeutige `id` (nicht nur via `name`), um Verwechslungen bei gleichnamigen Variablen in unterschiedlichen Scopes auszuschließen.
  - **JS-Formeln**: `ExpressionParser.evaluate` löst nun automatisch alle Kontext-Variablen via `resolveValue()` auf, BEVOR der JS-Ausdruck evaluiert wird. Dies stellt sicher, dass Operatoren wie `+` mit Primitiven (Strings/Zahlen) arbeiten und nicht mit Proxy-Objekten (`[object Object]`).
  - **Synchronisations-Reihenfolge**: Im `RuntimeVariableManager` muss die visuelle Komponente (`component.value = ...`) ZUERST aktualisiert werden, bevor `reactiveRuntime.setVariable` aufgerufen wird. Dies verhindert, dass Bindings bei einer Benachrichtigung noch den alten Wert im Kontext vorfinden.
  - **ActionExecutor & Proxies**: Wenn sich eine Stage ändert (`GameRuntime.handleStageChange`), muss der `ActionExecutor` explizit mit der Liste der neuen Proxies (`reactiveRuntime.getObjects()`) aktualisiert werden, damit Aktionen direkt auf den reaktiven Instanzen operieren.
  - **valueOf() Support**: Alle Komponenten erben `valueOf()` von `TComponent`, was bei Variablen automatisch `.value` zurückgibt – ein Sicherheitsnetz für direkte JS-Interaktionen.
  - **Proxy-Aware Expression Parsing (v2.18.7)**: Der `ExpressionParser` nutzt statische Analyse (`extractDependencies`), um Variablen in Expressions zu finden. Dies ist notwendig, da Proxies (wie `contextVars`) oft ihre Keys nicht proaktiv via `Object.keys()` preisgeben. Der Parser filtert dabei geschickt Property-Accesses (z.B. `.selectedEmoji`) aus den Root-Abhängigkeiten heraus.
  - **Undefined-Safe Strings (v2.18.8)**: Um die Anzeige von `"undefined"` in der UI zu verhindern (z.B. bei String-Konkatenation `currentPIN + emoji`), werden `undefined` oder `null` Werte im Evaluierungs-Kontext automatisch durch leere Strings (`""`) ersetzt.
217: 
- **Expression Context Priority (v2.18.4)**: 
    - In Berechnungs-Ausdrücken (z.B. `calculate` Aktionen) ist die Reihenfolge beim Mergen des Variablen-Kontexts entscheidend. 
    - **Regel**: Die `objectMap` (Komponenten-Instanzen) muss ZUERST gespreadet werden, gefolgt von den tatsächlichen Variablen-Contexts (`contextVars`, `vars`).
    - Dies stellt sicher, dass wenn ein Name sowohl als Komponente als auch als primitiver Variablen-Wert existiert, der aktuelle Wert aus dem Proxy Vorrang hat und nicht durch das initiale Komponenten-Objekt überschrieben wird.
    - Implementierung in `StandardActions.ts`:
      ```typescript
      const result = ExpressionParser.evaluate(action.formula, {
          ...objectMap,        // Komponenten (Fallback)
          ...contextVars,      // Variablen-Werte (Priorität)
          ...vars,
          $eventData: eventData
      });
      ```

- **Read Variable Aktion (v2.16.4 / v2.16.5)**:
    - Die Aktion `variable` (Label: "Read Variable") ist nun hochflexibel.
    - **Quellen**: Sie unterstützt sowohl Komponenten-Instanzen (via `sourceProperty`) als auch direkte Variablen-Namen.
    - **Auflösung**: Wenn ein Objekt-Name angegeben ist, wird dessen Eigenschaft gelesen. Falls kein Objekt gefunden wird, sucht das System in `context.vars` (Local/Global) nach einer gleichnamigen Variable.
    - **UI-Unterscheidung (v2.16.5)**: Für die visuelle Trennung zwischen "Lesen" und "Setzen" im Editor wurde der Alias `set_variable` eingeführt. In `StandardActions.ts` nutzen beide denselben Handler.
    - **Editor**: Im `JSONDialogRenderer` wird beim Öffnen des Aktions-Editors der Kontext (`taskName`, `actionId`) an die `ProjectRegistry` übergeben, damit auch lokale Variablen in den Dropdowns zur Auswahl stehen.

> [!IMPORTANT]
> **Stage-Synchronisation (v2.16.5)**:
> Beim Wechsel der Stage (`editor.switchStage`) muss zwingend `this.stage.isBlueprint` auf den korrekten Typ der neuen Stage gesetzt werden. Ohne diesen Sync werden Variablen auf Standard-Stages im Editor-Modus ausgeblendet.


## Editor -> Runtime Transition
- **Data Sync**: Vor dem Start der Runtime (`new GameRuntime`) müssen die aktuellen Editor-Objekte explizit in das Projekt-JSON serialisiert werden (`syncStageObjectsToProject`), damit Änderungen (z.B. neue Bilder)- [x] Korrekte Verwendung von `Name` (Setter) vs. `name` (Getter) bei Flow-Elementen sichergestellt.
- [x] **Flow-Editor:** Für Operationen mit logischen Verzweigungen (z.B. HTTP Requests) muss die **DataAction** (blau) verwendet werden, da nur diese über Success/Error-Anker verfügt.
 werden, dass die Editor-Ansicht sauber neu geladen wird (z.B. via `switchStage`), um Runtime-Proxies zu entfernen und den Editor-Status wiederherzustellen.
- **Z-Index Strategy**: Um Sichtbarkeitsprobleme bei Overlays zu vermeiden, aggregiert die `GameRuntime` z-Indices rekursiv (`effectiveZ = parentZ + currentZ`). Container wie `TSplashScreen` (`z=1000`) müssen ihre Inhalte als echte `children` speichern, damit dieses Stacking funktioniert. `TPanel` und `TWindow` Subklassen müssen daher `children` serialisieren.
- **Loop Termination**: Fallback-Animations-Loops im Editor müssen robust gestoppt werden, wenn der Run-Modus endet oder eine echte `GameLoop` übernimmt.

## FlowChart-Daten (Single Source of Truth)
- **Link-basierte Architektur**: Action-Daten werden NICHT mehr redundant in FlowCharts gespeichert. FlowChart-Elemente halten nur noch einen Link (`isLinked: true`) auf die globale Definition in `project.actions`.
- **Automatische Migration**: Beim Laden in `restoreNode` (FlowEditor.ts) werden Legacy-Daten automatisch als Links markiert, falls sie in `project.actions` existieren.
- **Speichern**: `FlowAction.toJSON()` stellt sicher, dass verlinkte Assets nur mit Name und Flag gespeichert werden.
- **Schutzmechanismus**: `updateGlobalActionDefinition` verhindert, dass valide globale Definitionen durch minimale Link-Daten (nur Name) überschrieben werden.
- **Local Mirroring (v3.2.1)**: 
    - Bei verlinkten Flow-Knoten (`isLinked: true`) müssen die Eigenschaften IMMER sowohl in der globalen Definition als auch lokal in `this.data` gespeichert werden.
    - **Warum**: Dies stellt sicher, dass die Daten auch dann im `flowChart` Teil des JSON sichtbar und persistent sind, wenn die globale Referenz temporär nicht aufgelöst werden kann oder nur der Task-Flow serialisiert wird.
    - **Implementierung**: Alle Setter in spezialisierten `FlowAction`-Klassen (wie `FlowDataAction.ts`) müssen beide Ziele (`this.data` und `getActionDefinition()`) aktualisieren.
- **Copy vs Link**: Kopien (`Embed Action (Copy)`) erstellen neue, unabhängige Archive in `project.actions` mit eindeutigen Namen.

## Task-Logik (Primat der FlowCharts)
- **Master-Status**: Flow-Diagramme sind die primäre Quelle für die Task-Logik. Die `actionSequence` wird bei jedem Speichern/Export automatisch aus dem Diagramm regeneriert.
- **Diagramm-Struktur**: Ein Task-Diagramm MUSS das **Task-Objekt** als Wurzelknoten verwenden. Generische `Start`-Knoten sind zugunsten der semantischen Klarheit (GCS-Konformität) veraltet. Es muss eine direkte Verbindung vom Task zur ersten Action bestehen.
- **Stage-Isolation (v2.10.0)**:
  - **Funktionale Stages**: Zeigen im Flow-Editor ausschließlich ihre lokalen Tasks und Actions.
  - **Blueprint-Stage**: Dient als Hub für alle globalen (Projekt-Wurzel) Tasks und Actions.
  - **Sichtbarkeit**: Diese Trennung verhindert das "Zumüllen" der Diagramme durch Infrastruktur-Elemente in der UI-Logik.
- **UI-Sperre**: Wenn ein Flow existiert, muss die Listen-Ansicht (`TaskEditor.ts`) schreibgeschützt sein. Verwende das `isReadOnly`-Flag in `createSequenceItemElement`.
- **Synchronisation**: Rufe vor allen Persistenz-Operationen `flowEditor.syncAllTasksFromFlow(project)` auf, um Datenkonsistenz zu garantieren.

### Mediator-gesteuerte Synchronisation (Trinity-Sync v2.16.1 / v2.16.23)
- **Problem**: Änderungen im Inspector oder Flow-Editor müssen sofort in allen Editoren (Flow, JSON, Pascal) reflektiert werden.
- **Lösung**: Der `MediatorService` dient als zentrales Benachrichtigungssystem via `DATA_CHANGED`.
- **Abonnement**: Komponenten wie `FlowEditor` hören auf dieses Event und aktualisieren ihre UI.
- **Sofortige JSON-Sichtbarkeit (v2.16.23)**: `Editor.ts` reagiert auf `DATA_CHANGED` Events vom `flow-editor` nun mit einem vollständigen `refreshAllViews()`. Dies garantiert, dass der JSON-Tree und der Pascal-Code unmittelbar aktualisiert werden, sobald ein Knoten im Flow-Canvas erstellt oder verschoben wird.
- **Context-Preservation**: Bei Umbenennung des aktuell angezeigten Kontexts wird der `oldValue` aus dem Event genutzt, um den internen Status (`currentFlowContext`) nahtlos zu aktualisieren, ohne dass der Benutzer die Ansicht verliert.

### Force Reload & LocalStorage Bypass (v3.3.0)
- **Problem**: Der Editor lädt Projektdaten bevorzugt aus dem `localStorage`. Manuelle Änderungen an der `project.json` auf dem Server werden dadurch ignoriert, solange der Browser-Cache aktiv ist.
- **Lösung**: Implementierung einer Force-Reload-Funktion (`Editor.loadFromServer`).
    - Nutze `ProjectPersistenceService.fetchProjectFromServer()`, um die JSON direkt vom Server abzurufen.
    - Überschreibe explizit den Schlüssel `gcs_last_project` im `localStorage`.
    - Nutze `window.location.reload()`, um den Editor mit den neuen Daten neu zu initialisieren.
- **Best Practice**: Biete diese Funktion immer an, wenn Versionierungs- oder Synchronisationsprobleme zwischen Client und Server auftreten können.

## Synchronisation & Persistenz
- **Pascal -> Flow Sync**: Änderungen im Pascal-Code müssen explizit in den Flow-Editor synchronisiert werden. Nutze dazu `flowEditor.syncActionsFromProject()`. Dies ist besonders wichtig, da Flow-Knoten ihre Daten (`node.data`) teilweise redundant halten, um die UI-Performance zu verbessern.
- **Local Storage Authority**: Der einzige gültige Schlüssel für die automatische Speicherung im Local Storage ist `gcs_last_project`. Verwende den `ProjectPersistenceService.autoSaveToLocalStorage()`, anstatt `localStorage` direkt anzusprechen.
- **Save Hooks**: Persistenz-Calls (Auto-Save) sollten immer nach erfolgreichem Parsing (Pascal) oder nach Mediator-Events (Objekt-Manipulation) erfolgen.

### Action-Check & Referenzsuche (v2.5.2)
- **Aufgabe**: Der Action-Check identifiziert unbenutzte Tasks, Aktionen und Variablen projektweit.
- **Logik (Statischer Deep-Scan)**: `ProjectRegistry.getLogicalUsage()` scannt das gesamte Projekt-JSON rekursiv nach Namensvorkommen.
- **Exklusion**: Um "Self-Usage" zu vermeiden, werden die `name`-Felder der Definitionsobjekte (`definitionObjects`) ignoriert.
- **Tooltips im Flow-Editor**:
    - ⚡ für Events / Trigger (z.B. Clicked, Collision)
    - ➡️ für Task-Aufrufe (Explizite Aufrufer)
    - 🎬 für Aktionen (Action-Ebene)
    - 📦 für Variablen-Referenzen (Task/Aktions-Ebene)
    - 🔗 für Objekt-Bindings (Stage-Ebene)
- **Visualisierung**: Verwaiste Elemente pulsieren rot. Detail-Infos (Trigger/Aufrufer) sind via Hover-Tooltip verfügbar.

## Debugging
- **JSON-Vergleich**: Nutze `JSON.stringify`, um tiefere Unterschiede in Objekt-Strukturen zu erkennen, falls die Identität gleich scheint.
- **Debug-Log System (Runtime Recording)**: 
    - Der `DebugLogService` (Singleton) sammelt Ereignisse während der Ausführung. 
    - **Anbindung**:
        - `GameRuntime.handleEvent`: Primärer Einstiegspunkt für Benutzerinteraktionen (`Event`).
        - `PropertyWatcher.notify`: Automatische Erfassung von Eigenschafts- und Variablenänderungen (`Variable`).
        - `TaskExecutor / ActionExecutor`: Protokollierung der Logik-Ausführung (`Task`, `Action`, `Condition`).
    - **Hierarchie**: Übergebe beim Start einer Kette (z.B. in `handleEvent`) die resultierende `logId` als `parentId` an nachfolgende Aufrufe. Dies ermöglicht die eingerückte Darstellung im Panel.
    - **Filter**: Das Panel filtert nach Typ, Objekt und Event. Die Filter sind unabhängig voneinander.

## Internationalisierung (i18n)
- **Browser-Übersetzung kontrollieren**: Code-Bereiche (Pascal, JSON, Flow-Details, Expressions) müssen mit `translate="no"` markiert werden, um Browser-Übersetzungen (Google Translate etc.) zu verhindern.
- **Betroffene Elemente**: `<pre>`, monospace-Bereiche, JSON-Tree, FlowAction-Details, ActionEditor-Vorschauen.
- **Muster**: `<pre translate="no">` oder `element.setAttribute('translate', 'no')`.
- **UI-Texte**: Button-Labels, Tooltips, Menüs sollen übersetzbar bleiben (kein `translate="no"`).

## Infrastruktur & Port-Konfiguration
- **Standard-Port (8080)**: Der Game-Server nutzt standardmäßig Port 8080. Dies ist in `game-server/src/server.ts` definiert.
- **Vite Proxy**: Der Frontend-Dev-Server (`vite.config.ts`) leitet Anfragen an `/games`, `/rooms` und `/api` automatisch an `http://localhost:8080` weiter.
- **Client-Verbindung**: `NetworkManager` und `TGameServer` nutzen `ws://localhost:8080` als Default-WebSocket-URL.
- **Deployment**: In `Dockerfile` und `fly.toml` muss Port 8080 exposed bzw. als `internal_port` konfiguriert sein.

## Daten-Persistenz & Synchronisierung (v2.11.0)
- **Dual-Storage**: Der `DataService` abstrahiert den Zugriff auf Daten. Im Browser (Editor/Player) wird `localStorage` verwendet, im Server-Modus (Node.js) das Dateisystem (`fs`).
- **Editor-Simulator**: Im Editor läuft das Spiel im Browser-Kontext. Um auf Server-Daten (z.B. `users.json`) zuzugreifen, nutzen wir "Seeding".
- **Seeding**: Beim Start des Editors werden kritische Daten (wie Benutzerkonten) automatisch vom lokalen Dev-Server (`/api/dev/data/:file`) abgerufen und in den `localStorage` des Simulators kopiert. Dies ermöglicht realistische Login-Tests ohne manuelle Datenpflege.
- **Debugging**: Datenbank-Aktionen (`db_find`, `db_save`) loggen nun im Debug Log Viewer detaillierte Informationen über Abfragen und Ergebnismengen ("Found X items...").

## Export-System (GameExporter)
- **Meta-Filterung**: Der Exporter nutzt eine Whitelist für Top-Level-Keys und eine rekursive `deepClean` Funktion.
- **Editor-Daten**: Keys mit `_` Präfix oder in der `editorOnlyKeys` Liste (`flow`, `flowCharts`, `nodePositions`, etc.) werden automatisch entfernt.
- **Autarkie**: Bilder werden als Base64 eingebettet, damit die HTML-Datei ohne externe Abhängigkeiten funktioniert.
- **Versionierung**: Die `RUNTIME_VERSION` in `GameExporter.ts` steuert die Kompatibilität mit der Plattform.

## Proxy-Objekte & Reactive Runtime
- **Spread-Operator Limitation**: Der Spread-Operator (`{...obj}`) kopiert KEINE Getter-basierten Properties von Proxy-Objekten oder Prototypen.
- **Lösung (Allgemeingültig)**: 
  - **Run-Modus**: `GameRuntime.getObjects()` scannt die Prototyp-Hierarchie und kopiert Getter manuell in den Snapshot.
  - **Editor-Modus**: `resolveObjectPreview` in `Editor.ts` nutzt `Object.create(Object.getPrototypeOf(obj))`, um die Klassen-Struktur (und damit alle Getter für Bilder/Videos) im Preview-Snapshot zu erhalten.
- **Vorteil**: Bilder (`TImage.src`), Videos (`TVideo.videoSource`) und andere zustandsabhängige Ansichten bleiben in allen Modi konsistent sichtbar, ohne die Original-Objekte (Proxies) zu verändern.
- **Symptom bei Fehlern**: Bilder verschwinden im Editor oder Run-Modus, obwohl die Daten im Model vorhanden sind.

## Standalone Runtime & Export Build-Prozess
- **Bundle erforderlich**: Nach jeder Änderung an TypeScript-Dateien, die die Runtime betreffen (`GameRuntime.ts`, `GameLoopManager.ts`, `player-standalone.ts`, etc.), MUSS `npm run bundle:runtime` ausgeführt werden.
- **Warum**: Der HTML-Export nutzt `public/runtime-standalone.js` (esbuild-Bundle), nicht die TypeScript-Quelldateien.
- **Dynamische Imports verboten**: `import()` Aufrufe (dynamic imports) funktionieren NICHT in gebündelten Exports. Der Bundler löst sie nicht korrekt auf, und Module wie `ProjectRegistry` sind im Standalone-Kontext nicht initialisiert.
- **Lösung**: Ersetze dynamische Imports durch direkten Zugriff auf bereits vorhandene Daten (z.B. `project.stages.find()` statt `import('../services/ProjectRegistry')`).
- **Stage-Switch Fix**: Bei Stage-Wechseln werden System-Objekte (TGameLoop, TInputController, etc.) aus der Main-Stage in die Ziel-Stage gemergt, sofern diese keine eigenen besitzt.

## Medien-Komponenten (TImage, TVideo)
- **Pfad-Auflösung**: Alle Medienpfade werden relativ zum `./images/` Verzeichnis im Export-Bundle aufgelöst, sofern sie nicht mit `http`, `/` oder `data:` beginnen.
- **Dateinamen & Encoding**: `Stage.ts` wendet automatisch `encodeURIComponent` auf Bildpfade an, um Leerzeichen und Sonderzeichen zu unterstützen. **Best Practice**: Verwende dennoch stets "web-safe" Dateinamen (keine Leerzeichen, keine Umlaute, Bindestriche statt Leerzeichen).
- **Diagnose**: `Stage.ts` prüft im Hintergrund die Erreichbarkeit von Bildern und loggt `SUCCESS` oder `ERROR` in die Konsole.
- `TVideo` und `TSplashScreen` nutzen HTML5 Video. Für die Synchronisation zwischen Runtime-Modell und DOM-Element wird die Eigenschaft `isPlaying` verwendet.
- **Wichtig**: Autoplay-Einschränkungen moderner Browser beachten (Videos sollten standardmäßig `muted` sein, wenn sie automatisch starten sollen).

## Multi-Stage Architektur
- **StageDefinition**: Enthält `id`, `name`, `type` ('standard'|'splash'|'main'), `objects[]`, `grid` (Raster-Konfig), `description`, `startAnimation`, `duration` und `easing`.
- **TSplashStage**: Neue Klasse die von `TStage` erbt, mit splash-spezifischen Properties.
- **Nur ein Splash**: Pro Projekt ist maximal ein Splashscreen erlaubt.
- **Hauptstage ('main')**: Die primäre Stage, die globale Metadaten (Spielname, Autor, Beschreibung) trägt.
- **Grid-Konfiguration**:
  - Jede Stage hat ein eigenes `grid`-Objekt (`GridConfig`).
  - Änderungen am Raster (Hintergrundfarbe, Spalten, Zellgröße) wirken nur auf die jeweilige Stage.
  - Der Editor synchronisiert das `this.stage.grid` des Renderers bei jedem Stage-Wechsel oder Inspector-Update.
- **Start-Animationen**:
  - Jede Stage kann eine eigene `startAnimation` definieren.
  - Wird beim Laden der Stage in der `GameRuntime` ausgelöst.
- **Legacy-Migration**: Alte Projekte mit `objects/splashObjects` werden beim Laden automatisch in `stages[]` migriert. Jede Stage erhält dabei eine Kopie des ursprünglichen globalen Grids.
- **Editor-Steuerung**:
  - Stage-Menü für Verwaltung (Neue Stage, Neuer Splash, Stage löschen).
  - `switchStage(stageId)` wechselt zwischen Stages.
  - `currentObjects` getter greift auf die aktive Stage zu.
  - **Kontextsensitiver Inspector**: 
    - Der Stage-Inspector nutzt die reaktive Variable `activeStage`, um Eigenschaften der aktuell gewählten Stage anzuzeigen.
    - Bindings in `inspector_stage.json` sollten bevorzugt auf `activeStage.*` verweisen, mit Fallback auf `selectedObject.stage.*` (global).
    - **Sichtbarkeit**: Die `visible`-Eigenschaft in der JSON steuert das Ausblenden. Bei gruppierten Feldern (Label + Input) muss dies in `renderInlineRow` im `InspectorRenderer.ts` explizit geprüft werden.
    - **Caching**: Um sicherzustellen, dass Änderungen an der JSON-Konfiguration sofort sichtbar sind, werden fetch-Aufrufe mit einem Cache-Buster (`?v=Date.now()`) versehen.
    - **Metadaten (Main Stage)**: Globale Spiel-Metadaten (Name, Autor) werden bevorzugt in der Haupt-Stage (`type: 'main'`) gespeichert (`gameName`, `author`). Der Inspector bindet diese via `activeStage.*`. Generatoren und Exporter müssen dies berücksichtigen und die Haupt-Stage-Werte gegenüber `project.meta` priorisieren.
- **Sichtbarkeit von Komponenten**:
    - **Metadaten-Flags (v2.11.0)**: Die Sichtbarkeit wird zentral über Flags in `TComponent` gesteuert:
        - `isService`: Markiert die Komponente als System-Dienst (wird global über Stages gemergt).
        - `isHiddenInRun`: Wenn `true`, wird die Komponente im Run-Modus (Spiel-Modus) ausgeblendet.
        - `isBlueprintOnly`: Wenn `true`, ist die Komponente im Editor NUR auf Stages vom Typ `blueprint` sichtbar.
    - **Editor-Anzeige**: System-Komponenten zeigen im Editor ihren `name` als Text an, um die Identifizierung zu erleichtern.
    - **Umsetzung**: `Stage.renderObjects` wertet diese Flags aus. Der `Editor` muss beim Rendern das `isBlueprint`-Flag auf der Stage setzen.
- **Runtime-Navigation**: Die Action `navigate_stage` ermöglicht Stage-Wechsel zur Laufzeit:
  ```json
  { "type": "navigate_stage", "params": { "stageId": "level-2" } }
  // oder: { "stageId": "next" } für nächste Stage
  ```
- **GameRuntime**: Initialisiert beim Start die Objekte und Konfiguration (Grid, Animation) der aktiven Stage. `switchToStage(stageId)` wechselt zur Laufzeit zwischen Stages. `nextStage()` wechselt zur nächsten Stage in der Reihenfolge.

### Lokale Logik-Scopes (Phase 1)
- **Kapselung**: Jede Stage besitzt nun eigene Listen für `tasks`, `actions` und `variables`. Dies verhindert Namenskollisionen und ermöglicht "selbstversorgende" Minigame-Stages.
- **Routing-Regeln (Editor)**:
  - Neue Tasks/Actions werden standardmäßig in der aktiven Stage gespeichert (`getTargetTaskCollection()`).
  - Wenn ein Element mit dem Namen bereits global existiert, wird die globale Definition aktualisiert (Single Source of Truth).
- **Auflösungs-Reihenfolge**:
  - Runtime & Editor priorisieren IMMER lokale Elemente vor globalen Elementen.
  - Namenskollisionen: Lokale Tasks "überschreiben" globale Tasks mit gleichem Namen für die Dauer der Stage-Aktivität.
- **Speicherstruktur**:
  - Global: `project.tasks`, `project.actions`, `project.flowCharts.global`.
  - Stage: `stage.tasks`, `stage.actions`, `stage.flowCharts` (enthält alle Diagramme der Stage).
- **Refactoring & Registry**:
  - `ProjectRegistry.getTasks()` / `getActions()` liefern automatisch die aggregierte Liste (Global + alle Stages), sofern nicht explizit eingeschränkt.
  - `renameTask` und `findReferences` führen einen Full-Scan über alle hierarchischen Layer durch.
- **Runtime Sync**:
  - Die `GameRuntime` muss bei jedem Stage-Wechsel die lokalen Logik-Pakete in den `TaskExecutor` injizieren: `taskExecutor.setTasks(mergedTasks)`, `taskExecutor.setActions(mergedActions)`.

### Smart-Sync & Scoping (v2.1.5)
- **Explizites Scoping**: `GameAction` und `GameTask` besitzen eine `scope`-Eigenschaft (`global` | `stage`).
- **Standard-Verhalten**: Neue Actions werden standardmäßig im `stage`-Scope der aktiven Stage angelegt.
- **Hierarchische Auflösung**: Der `Editor` nutzt `getTargetActionCollection()` und `getTargetTaskCollection()`, um basierend auf dem Namen und dem gesetzten Scope das richtige Register (global vs. lokal) für Schreibvorgänge zu identifizieren.
- **Smart-Sync im Inspector**: 
  - Verlinkte Elemente (Actions/Tasks) sind im `JSONInspector` editierbar.
  - Beim Speichern (`handleAutoSave`) erkennt der Inspector verlinkte Elemente und schreibt Änderungen via `editor.getTarget...` direkt in die Original-Definition zurück.
  - Dies stellt sicher, dass Änderungen an einer globalen Action an allen Verwendungsstellen sofort wirksam werden (Single Source of Truth).
- **Visuelle Indikatoren**: Verwende Emojis (🌎 `global`, 🎭 `stage`) in UI-Listen und im Inspector-Header, um den Scope einer Ressource zu verdeutlichen.

### Variable Scopes & Visibility (Phase 3)
- **Scoping-Regeln (Automatisch)**:
    - **Main-Stage**: Beim Hinzufügen von Variablen in der Main-Stage wird standardmäßig der Scope `global` zugewiesen.
    - **andere Stages**: Beim Hinzufügen in Standard-Stages wird standardmäßig der Scope `stage` (lokal) zugewiesen.
    - **Manuelle Änderung**: Der Scope kann jederzeit im Inspector angepasst werden.
- **Cross-Stage Referenzen**:
    - **Import**: Globale Variablen (`scope: 'global'`) können via `Editor.importGlobalObject(id)` in andere Stages eingebunden werden. Dies erstellt eine Referenz in der lokalen Objektliste, die auf die globale Instanz zeigt.
- **Auflösung (Precedence)**: `GameRuntime.createVariableContext` (Proxy) priorisiert `local` vor `global` (Shadowing erlaubt).
- **Speicherort**:
    - **Action-Sequenzen**: In Tasks müssen Sequenz-Items immer das Format `{ "type": "action", "name": "..." }` oder `{ "type": "task", "name": "..." }` verwenden. Das Feld `"action": "..."` ist veraltet.
- **Speicherort**:
    - Globale Variablen liegen in `project.variables`.
    - Lokale Variablen liegen in `activeStage.variables`.

- **Dropdown Verhalten**: Alle Dropdowns im Action Editor sollten einen Platzhalter ("--- bitte wählen ---") verwenden, wenn noch kein Wert ausgewählt ist. Dies stellt sicher, dass jede Auswahl (auch die erste) ein `onchange` Event auslöst.
- **Dependency Resets**: Beim Ändern eines Primär-Feldes (z.B. Target Object oder Action Type) müssen abhängige Felder (z.B. Method Name) explizit gelöscht werden, um inkonsistente Zustände in der UI zu vermeiden.
- **Re-rendering**: Jede Änderung an einem zentralen `dialogData` Feld, die die Sichtbarkeit anderer Felder beeinflusst, erfordert einen explizit Aufruf von `this.render()`.
- **Rendering-Guard (isCollectingData)**: Nutze dieses Flag im `JSONDialogRenderer`, um Re-Renders während der Formular-Datensammlung zu verhindern. Dies schützt vor Datenverlust durch DOM-Manipulationen während der Serialisierung.
- **SSoT-Synchronisation (FlowSyncManager)**: Bei der grafischen Synchronisierung von canvas-nodes (`isLinked: true`) dürfen globale Definitionen nur dann aktualisiert werden, wenn der Knoten vollständige Logik-Daten enthält. Sparse Metadata-Updates (nur Name/Position) müssen von Logik-Updates getrennt bleiben, um ein Überschreiben der vollen Aktionsdefinition durch Minimaldaten zu verhindern.
- **Typwechsel-Logik**: Beim Wechsel von Aktionstypen im Dialog sollte die Definition ersetzt statt gemergt werden, um inkompatible Felder (z.B. alte Variablenreferenzen) restlos zu entfernen.
    - Während dieses Flag aktiv ist, müssen alle `render()`-Aufrufe (z.B. ausgelöst durch `updateModelValue`) unterdrückt werden.
    - Dies verhindert, dass das DOM während der Iteration über die Eingabefelder geleert und neu aufgebaut wird, was zu unvollständigen Datensätzen im Projekt-JSON führt.
- **Smart-Sync für linked Actions (v2.18.12)**:
    - Verlinkte Flow-Knoten (`isLinked: true`) halten im `node.data` nur Minimal-Informationen (Name).
    - **Problem**: Ein naiver Sync überschreibt die reichhaltige Aktions-Definition im Projekt-Registry mit diesen Minimaldaten.
    - **Lösung**: Der `InspectorActionHandler.ts` nutzt eine typsensible Merge-Logik. Bei `Action` oder `DataAction` werden die Daten des Knotens vorsichtig mit der Original-Definition gemergt (`{ ...original, ...nodeData }`), anstatt sie zu ersetzen. Dies schützt Felder wie `url`, `dataStore` oder `body`.
- **ApiSimulator Persistence (v2.18.12)**:
    - Der `ApiSimulator` in `Editor.ts` akzeptiert nun einen optionalen `storageFile`-Parameter.
    - Damit können `DataAction`s gezielt auf verschiedene Datenquellen (z.B. `users.json`) zugreifen, indem sie eine `TDataStore`-Komponente referenzieren.
    - Der `http`-Handler in `StandardActions.ts` löst den `storagePath` der Komponente zur Laufzeit auf.
- **Method Mapping**: Beim Hinzufügen neuer Komponenten-Klassen muss deren Methoden-Liste in `JSONDialogRenderer.getMethodsForObject` ergänzt werden, damit sie im Action Editor auftaucht.

## Variablen als Logik-Objekte (OOP)
- **Spezialisierte Klassen**: Variablen werden im Flow-Editor durch spezialisierte Unterklassen von `FlowVariable` dargestellt (z.B. `FlowThresholdVariable`, `FlowTimerVariable`).
- **Icons & Visualisierung**: Jede Spezialisierung hat ein eindeutiges Icon (📊, ⏳, 🎯 etc.) und eine spezifische Farbe für den Text, um die Unterscheidung im Diagramm zu erleichtern.
- **Inspector-Integration**: Diese Klassen überschreiben `getInspectorProperties()` und `getEvents()`, um typspezifische Eigenschaften (z.B. Schwellenwert) und Events (z.B. `onThresholdReached`) im "Properties" bzw. "Events" Tab des Inspectors anzuzeigen.
- **Implizite Erkennung**: Beim Laden (`restoreNode` in `FlowEditor.ts`) werden spezialisierte Klassen automatisch anhand ihrer Datenfelder (z.B. Vorhandensein von `threshold` oder `duration`) instanziiert.
- **Action-Target**: Variablen sind im `ActionEditor` als Ziele ("Targets") für Property-Änderungen (`property`-Action) verfügbar. Dabei werden kontextsensitiv variablenspezifische Properties wie `value`, `threshold` oder `min/max` zur Auswahl angeboten.

## Pascal-Generierung & Metadaten
- **Metadaten in Kommentaren**: Der `PascalGenerator` fügt spezialisierte Eigenschaften (Threshold, Duration, etc.) als Kommentar hinter die Variablendeklaration ein, um die Logik-Konfiguration im Code-Viewer lesbar zu machen.
- **Generische Event-Entdeckung**: Variablen-Events werden im Pascal-Generator dynamisch erkannt (Pattern: `on...`). Da Variablen von `TComponent` erben, prüft der Generator sowohl die Top-Level-Properties der Variable als auch das `Tasks`-Unterobjekt (Wiring), um sicherzustellen, dass Events für alle Typen (Trigger, Range, etc.) korrekt in Pascal-Prozeduren übersetzt werden.
- **Intelligente Synchronisation (v1.9.9) - Smart-Sync**:
  - **Reihenfolge & Wiederverwendung**: Der Parser vergleicht die aktuelle Code-Zeile bevorzugt mit dem Element an der gleichen Position in der ursprünglichen `actionSequence`, um Aktionsnamen zu erhalten.
  - **Casing-Konsistenz (Smart-Sync)**: Da Pascal case-insensitive ist, die Engine aber camelCase (z.B. `fillColor`) erwartet, nutzt der Parser eine projektweite Suche nach der bevorzugten Schreibweise. Wenn ein Key (z.B. `fillColor`) bereits im Projekt existiert, wird dieser exakt so genutzt. Fallback ist Kleinschreibung.
  - **FlowChart-Trigger**: Nach jeder Code-Änderung wird das Flow-Diagramm des Tasks invalidiert (Auto-Layout Trigger).
- **Live-Synchronisation**: Änderungen im Inspector triggern über `refreshPascalView` (Editor.ts) sofort eine Aktualisierung des generierten Pascal-Codes.
- **Deep Cloning bei Sync**: Bei der Synchronisation von Daten zwischen verschiedenen Editoren (z.B. `FlowEditor.syncActionsFromProject`) MÜSSEN Objekte tiefenkopiert werden (`JSON.parse(JSON.stringify(obj))`). Dies verhindert, dass sich Änderungen in einem Editor unkontrolliert auf andere Editoren oder das zentrale Datenmodell auswirken (Shared References).
- **Typkonvertierung (autoConvert)**: Benutzereingaben aus Textfeldern sind im DOM immer Strings. Nutze `PropertyHelper.autoConvert(value)` nach der Interpolation, um Werte intelligent zurück in `number` oder `boolean` zu wandeln. Dies ist essenziell für Methoden wie `moveTo`, die numerische Parameter erwarten.
- **Bereitstellung von Hilfsfunktionen (Scope)**:
  - Funktionen, die in Dialog-Expressions (`${...}`) genutzt werden sollen, müssen sowohl in `JSONDialogRenderer.evaluateExpression` auch in `replaceTemplateVars` registriert werden.
  - Aktuelle Standard-Funktionen: `getMethodSignature(target, method)`, `getStageOptions()`, `getMethods(target)`, `getProperties(target)`.
- **Methoden-Registrierung**:
  - Neue Methoden für Komponenten MÜSSEN in der `MethodRegistry.ts` (Parameter-Definitionen) UND im `methodMap` von `JSONDialogRenderer.getMethodsForObject` (Sichtbarkeit im Dropdown) eingetragen werden.
  - Visuelle Standard-Methoden wie `moveTo` sollten für alle von `TWindow` erbenden Komponenten im `methodMap` freigeschaltet sein.
- **Dialog-Binding (v2.16.18)**:
    - Damit Eingabefelder in JSON-Dialogen (`dialog_action_editor.json`) ihren Wert ins Modell (`dialogData`) zurückschreiben, MÜSSEN sie das Binding `"action": "updateValue"` besitzen.
    - Ohne dieses Binding wird zwar der Text angezeigt, aber Änderungen (Eingaben) werden nicht im Modell gespeichert und gehen beim Klick auf "Speichern" verloren.
### [Refactoring & Umbenennung](file:///c:/Users/rolfr/.gemini/antigravity/scratch/game-builder-v1/src/editor/RefactoringManager.ts)
- **Multi-Stage Awareness**: Referenzen (Tasks, Objekte, Variablen) müssen in allen Stages aktualisiert werden (`project.stages`).
- **Cross-Refactoring (v2.0)**: 
    - Objekte sind oft Namensbestandteil von Actions (z.B. `Label.setCaption`). `RefactoringManager.renameObject` prüft dies automatisch und benennt solche Aktionen ebenfalls um (`NewName.setCaption`).
- **Flow-Chart Consistency**: 
    - Da der `FlowEditor` Tasks basierend auf Diagrammen regeneriert, MÜSSEN Änderungen rekursiv in die `flowCharts` (Global & Stages) geschrieben werden. Ein reines Update von `project.tasks` reicht nicht aus, da es beim nächsten Speichern überschrieben würde.
    - Nutze `replaceInObjectRecursive` für robuste Ersetzungen in tief verschachtelten Node-Daten.

### [FlowCharts & Task-Diagramme](file:///c:/Users/rolfr/.gemini/antigravity/scratch/game-builder-v1/src/editor/FlowEditor.ts)
- **Doppelklick-Logik**: Standard-Doppelklick öffnet IMMER den Editor (Task/Action). Die Expansion von Tasks (Sub-Flow anzeigen) wurde vom Doppelklick entfernt und ist nur über das Kontextmenü möglich ("Ausklappen").
- **Speicherorte**: Flow-Diagramme können in `task.flowChart`, `project.flowCharts` oder `stage.flowCharts` liegen.
- **Visual Branching (FlowCondition)**: (v2.6.0) Condition-Nodes nutzen eine Diamantform und verfügen über zwei dedizierte Output-Anchors: `true` und `false`. Die Logik-Zuweisung erfolgt über das Feld `condition` in den `properties`.
- **Task-Selektion**: Das Flow-Dropdown zeigt ALLE im aktuellen Scope (Stage oder Global) definierten Tasks an, auch wenn diese noch kein Flow-Diagramm besitzen. Dies erleichtert das Initialisieren neuer Diagramme für bestehende Tasks.

- **JSON Viewer & Isolated Stages (v2.6.3)**:
  - Wenn eine Stage isoliert im JSON-Tab angezeigt wird (`activeStage`), können Benutzer über einen **Scope-Toggle** in der Toolbar wählen, ob nur die Daten der aktuellen Stage oder das gesamte Projekt angezeigt werden sollen.
  - Globale Daten (Tasks UND Actions), die für eine Stage relevant sind, werden bei der Stage-Ansicht injiziert, um die Bearbeitbarkeit sicherzustellen.
  - Der Toggle verhindert Datenverlust beim Speichern, da er sicherstellt, dass der `Editor` immer den korrekten Datenkontext (Local vs. Global) schreibt.
- **Sichere Serialisierung (`safeDeepCopy`)**:
  - Live-Objekte im Editor (z.B. reaktive Proxies oder Komponenten-Instanzen) enthalten oft zirkuläre Referenzen. 
  - **WICHTIG**: Nutze NIEMALS `JSON.stringify` direkt auf dem `project`-Objekt für UI-Anzeigen oder Kopien innerhalb des Editors. Dies führt bei zirkulären Referenzen (z.B. durch reaktive Proxies) zu sofortigen Abstürzen.
  - Verwende stattdessen konsequent `safeDeepCopy(obj)` aus `src/utils/DeepCopy.ts`. Diese Methode handhabt Zyklen, entpackt Proxies und filtert problematische Objekte wie DOM-Elemente automatisch.
- **Fehlerbehandlung**: 
  - Die Methode `refreshJSONView` in `Editor.ts` muss IMMER in `try-catch` Blöcke gefasst sein. 
  - Bei Serialisierungsfehlern soll ein visuelles Feedback im JSON-Panel erscheinen (Fehler-Bildschirm mit Reload-Option), statt die UI einzufrieren.
- **Scoping & Refactoring**:
  - Beim Umbenennen (Refactoring) von Tasks, Aktionen oder Variablen müssen IMMER alle Scopes (`project.tasks/actions` UND alle `project.stages[].tasks/actions`) gescannt werden. Siehe `RefactoringManager.ts`.
  - Die isolierte JSON-Ansicht einer Stage (`Editor.refreshJSONView`) muss lokale Daten (`actions`, `tasks`) erhalten und darf sie nicht durch globale Listen überschreiben (Merge-Logik).
- **Re-rendering**: Änderungen an `TargetObjectSelect` oder `MethodSelect` im Action Editor MÜSSEN einen `this.render()` Aufruf in `updateModelValue` auslösen, damit die Parameter-Eingabefelder dynamisch regeneriert werden.
- **JSON Inspector & Circularity**:
    - Der `JSONTreeViewer` nutzt eine pfad-basierte Zirkularitäts-Prüfung (`pathStack`), um echte Loops von einfachen geteilten Objektreferenzen zu unterscheiden.
    - Warnungen wie `[Zirkuläre Referenz]` erscheinen nur dann, wenn ein Objekt innerhalb seiner eigenen Ahnenreihe erneut vorkommt. Mehrfaches Vorkommen desselben Objekts an unterschiedlichen Stellen im Baum wird als valide Referenz akzeptiert.
- **Runtime Event Logging**:
    - Alle Ereignisse, die einen Task oder eine Aktion auslösen, MÜSSEN im `DebugLogService` mit `log('Event', ...)` protokolliert werden.
    - Dies gilt nicht nur für DOM-Events (Buttons), sondern auch für Variablen-Events (`onTriggerEnter`) und Timer-Events (`onTimerEnd`).
    - Die `logId` des Events sollte als `parentId` an den `TaskExecutor` oder `ActionExecutor` übergeben werden, damit die Hierarchie im Log erhalten bleibt.
- **Expression Scoping**: Beim Erweitern der Dialog-Evaluation (`evaluateExpression`) darauf achten, dass alle benötigten Variablen (wie `dialogData`, `project`) explizit als Funktionsargumente übergeben werden. Direkter Zugriff auf Model-Eigenschaften ohne `dialogData.` Präfix führt zu ReferenceErrors, wenn sie nicht explizit in der Argument liste stehen.
- **Data Collection**: Jede neue Input-Komponente im Dialog-System muss das Attribut `data-name` setzen, damit `collectFormData` sie beim finalen Speichern erfassen kann.



## Library & Tasks
- **Library Export**: Nutze den Endpunkt `POST /api/library/tasks` für automatisierte Speichervorgänge in die `public/library.json`.
- **Dialog-Komponenten**: Neue UI-Elemente wie `TMemo` müssen im `DialogManager.ts` (renderObject, collectDialogData, populateDialogData) registriert werden, um in JSON-Dialogen korrekt zu funktionieren.

## Stage Inheritance & Templates
- **Datenmodell**: `inheritsFrom` Property im `StageDefinition` Interface. `type: 'template'` für Blueprint-Stages.
- **Auflösungslogik**:
  - `GameRuntime` merged beim Start einer Stage rekursiv Daten von Parent-Stages.
  - **Order**: Elterndaten zuerst, Kinddaten überschreiben ("Last Write Wins").
  - **Scope**: Objekte, Tasks, Actions und Variablen werden vererbt.
- **Editor-Verhalten**:
  - **Ghosting**: `getResolvedInheritanceObjects` (Editor.ts) liefert die kombinierte Objektliste für den Renderer. Geerbte Objekte erhalten das Flag `isInherited: true`.
  - **Visualisierung**: `Stage.ts` rendert inherited Objekte mit `opacity: 0.5` und `pointer-events: none` (außer bei expliziter Selektion via Baum).
  - **Materialisierung**: Beim Editieren eines Ghost-Objekts im `JSONInspector` wird es automatisch in die `objects`-Liste der aktuellen Stage kopiert (`activeStage.objects.push(copy)`), wodurch es lokal "überschrieben" wird.
  - **Navigation**: `findObjectById` sucht nun in der aufgelösten Kette, nicht nur in der lokalen Liste.
  - **Instanziierung**: Beim Erstellen einer neuen Stage aus einem Template ("New from Template") werden alle Objekt-IDs neu generiert (`regenerateIds`), um Eindeutigkeit über alle Stages hinweg zu garantieren. Dies verhindert Konflikte im Inspector und ermöglicht unabhängiges Editieren.

## Spieleplattform Integration (GCS-Base)

- **Platform-Bootstrapping**:
    - Der Einstiegspunkt ist `game-server/public/player.html`. Diese Datei lädt die GCS-Runtime (`v1.0.0.js`).
    - Ohne URL-Parameter (`?game=...`) lädt die Runtime standardmäßig `/platform/project.json`.
- **Barrierefreie Authentifizierung**:
    - Kinderfreundlich: Login erfolgt ausschließlich über visuelle **Emoji-PINs**.
    - Backend: `server.ts` unterstützt einen "Name-losen" Login via `authCode`. Der Name ist rein optional für Admins.
- **Multi-Stage Robustheit**:
    - Bei Änderungen am `UniversalPlayer` (`player-standalone.ts`) muss die Runtime via `npm run bundle:runtime` neu gebaut und nach `game-server/runtimes/v1.0.0.js` kopiert werden.
    - Der Player muss sowohl Einzel-Stage (`project.stage`) als auch Multi-Stage (`project.stages[]`) Projekte unterstützen.

## Asynchrone Runtime & Logik-Ausführung

- **Promise-Chain**: Die Methoden `TaskExecutor.execute` und `ActionExecutor.execute` sind nun asynchron (`Promise<void>`).
- **Warten auf Ergebnisse**: Alle Aufgaben-Schleifen (`for...of`) und Condition-Zweige verwenden `await`, um sicherzustellen, dass Aktionen (insbesondere HTTP-Anfragen) abgeschlossen sind, bevor die nächste Aktion startet.
- **HTTP Action Standard**:
    - Verwende immer `method: 'POST'` für Logins oder Statusänderungen.
    - JSON-Bodies werden automatisch unterstützt und variablen-interpoliert.
    - Das Ergebnis wird in der `resultVariable` gespeichert. Bei Fehlern enthält die Variable ein Objekt mit `{ success: false, status, error }`.
- **GameRuntime Events**: `handleEvent` ist nun `async`. Event-Trigger aus dem UI (z.B. `onClick`) sollten im Player-Code asynchron aufgerufen werden, um die Kette nicht zu brechen.

## UI-Komponenten & Interaktion (v1.1.0)

### Geometrische Formen (TShape)
`TShape` ist die bevorzugte Komponente für einfache Grafiken, Avatare und interaktive Buttons.
- **Inhalt**: Nutze die Eigenschaften `text` (für Emojis/Texte) und `contentImage` (für Bilder) direkt auf dem Shape. Dies vermeidet unnötige Kind-Elemente und ist im Editor einfacher zu handhaben.
- **Rendering**: Shapes nutzen eine interne SVG `viewBox`. Dies ermöglicht flüssiges Resizing in Echtzeit, während die Rahmenstärke durch `vector-effect="non-scaling-stroke"` optisch konstant bleibt.
- **Resizing**: Für Kreise wird im Editor ein quadratisches Seitenverhältnis (1:1) erzwungen, um Verzerrungen zu vermeiden. Ellipsen können weiterhin frei skaliert werden.
- **Sichtbarkeit**: Shapes werden direkt aus den Grid-Koordinaten des Modell-Objekts gerendert, was eine sofortige Sichtbarkeit bei der Erstellung garantiert. Standardmäßig sind neue Shapes transparent mit einem blauen Rahmen.

### Drag & Drop System
- Setze `draggable: true` auf Komponenten, die bewegt werden sollen.
- Nutze `dragMode: 'copy'` für Werkzeugleisten oder Paletten (Original bleibt erhalten).
- Reagiere auf das `onDrop` Ereignis des Ziel-Objekts (`droppable: true`), um Logik auszuführen.

### Variablen-Werte
- **Werte-Persistenz**:
  - `defaultValue`: Der initiale Wert beim Starten des Projekts/Stages.
  - `value`: Der aktuelle Laufzeit-Wert (kann im Inspector editiert werden und wird gespeichert).
  - Falls `value` nicht gesetzt ist, wird `defaultValue` verwendet.

## Inspector Configuration
- **Deklarative Templates**: Der Inspector wird primär durch JSON-Dateien (`inspector.json`, `inspector_task.json`, `inspector_action.json`) konfiguriert. Diese definieren das Layout, die Felder und die Bindings (`${variableName}`).
- **Kontext-Sensitivität**: `InspectorHost.ts` lädt automatisch das passende Template basierend auf dem Typ des selektierten Objekts (`selectedObject.getType()`: 'Task', 'Action' oder className).
- **Hybrid-Modus**: Für Flow-Elemente (`Task`, `Action`) unterstützt der Inspector einen Hybrid-Modus:
  - **Statische Eigenschaften**: Werden aus der JSON geladen (z.B. Header, Name, Typ).
  - **Dynamische Eigenschaften**: Werden (falls implementiert) über `getInspectorProperties()` generiert (z.B. variable Parameter-Listen bei Tasks).
  - **Duplikate vermeiden**: Eigenschaften, die bereits in der statischen JSON-Datei definiert sind, **DÜRFEN NICHT** zusätzlich in `getInspectorProperties()` zurückgegeben werden. Dies ist essenziell für eine saubere UI (wie z.B. bei `FlowVariable` umgesetzt).
- **Action-Properties**: `FlowAction` fungiert als Proxy für die globale `project.actions` Definition. Getters/Setters wie `actionType`, `target`, `changesJSON` wandeln die internen Strukturen für den Inspector in Strings oder primitive Werte um.
  - **WICHTIG (v2.14.0)**: Nutze innerhalb der Proxies immer `this.getActionDefinition()`, um sicherzustellen, dass sowohl eigenständige als auch verlinkte Aktionen korrekt gelesen/geschrieben werden.

- **JWT-Automatisierung (v3.3.3)**:
  - Wenn `requestJWT: true` gesetzt ist, führt die `http` Action (und somit auch `DataAction`) zwei automatische Schritte bei erfolgreicher Antwort durch:
    1.  **Token-Speicherung**: Prüft auf `response.token` und speichert es automatisch im `localStorage` unter `auth_token`. Dies macht separate `store_token` Actions oft überflüssig.
    2.  **User-Unwrapping**: Prüft auf `response.user`. Wenn vorhanden, wird *nur* das User-Objekt in die `resultVariable` geschrieben, anstatt der gesamten Response. Dies erleichtert den direkten Zugriff auf User-Daten (z.B. `${currentUser.name}`).
  - **Sicherheit**: Dies geschieht sowohl in der Simulation (`ApiSimulator`) als auch im echten Request (`fetch`).

- **DataAction Pattern (v2.14.0)**:
  - `DataAction` ist ein spezialisierter Knoten für asynchrone Server-Operationen mit visueller Branching-Logik (Success/Error).
  - Konfiguration erfolgt über `inspector_data_action.json`.
  - Variablen-Auswahl: Nutze `${availableVariablesWithScope}`, um dem Benutzer via Emojis den Scope (🌎 Global, 🎭 Stage) anzuzeigen.
- **Action Persistence**: Für jede neue Action-Property muss ein Getter/Setter-Proxy in `FlowAction.ts` existieren.
- **Variablen-Typen**: Nutze `json` oder `any` für API-Ergebnisse, um Modell-Zwang zu umgehen.
- **Dynamische Action-Parameter (TActionParams)**:
  - Jede neue Aktion muss in der `ActionRegistry.ts` (und optional in `StandardActions.ts`) registriert werden.
  - Die UI für Parameter wird automatisch aus dem `parameters`-Array der Metadaten generiert.
  - Verwende `source: 'variables' | 'objects' | 'stages' | 'services' | 'easing-functions'`, um Dropdowns automatisch zu befüllen.
  - Komplexere Aktionen (wie `animate`) können so ohne Änderungen an JSON-Dateien oder Dialog-Renderern hinzugefügt werden.

> [!TIP]
> **Robuste Typ-Auswahl (v2.16.5)**:
> Nutze in `TDropdown` oder `TSelect` für Aktions-Typen immer Objekte mit `value` und `label` statt einfacher Strings. Dies schützt vor Fehlern bei Emoji-Änderungen oder Übersetzungen, da intern nur der stabile `value` (z.B. `property`, `set_variable`) verarbeitet wird.
- **Dialog-Expressions**:
  - Im `JSONDialogRenderer` müssen Variablen in Properties wie `source` zwingend mit `${...}` umschlossen werden (z.B. `"source": "${dialogData.images}"`), damit sie als Expression ausgewertet werden. Ohne `${}` wird der Wert als String-Literal behandelt.

### [Inspector-Property-Sync (v2.14.0)](file:///c:/Users/rolfr/.gemini/antigravity/scratch/game-builder-v1/src/editor/inspector/InspectorHost.ts)
- **Namenskonvention**: Damit der `InspectorHost` Änderungen automatisch in das Fachmodell (`selectedObject`) zurückschreiben kann, müssen die Namen (`name`) der Inspector-Objekte dem Schema `<propertyName>Input` folgen (z.B. `resourceInput` für die Eigenschaft `resource`).
- **Suffix-Handling**: Der `InspectorHost` entfernt beim Speichern (`handleAutoSave`) automatisch den Suffix `Input`, um den Ziel-Property-Namen zu ermitteln.
- **Re-rendering**: Wenn eine Änderung an einer Eigenschaft die Sichtbarkeit anderer Felder beeinflusst (z.B. `resource` oder `queryProperty`), muss in `handleAutoSave` explizit `this.render()` aufgerufen werden, um die UI-Struktur zu aktualisieren.
- **Daten-Abruf**: Nutze `fetchResourceProperties` in `InspectorHost`, um beim Wechsel einer Ressource automatisch deren Metadaten (Properties) abzufragen und als reaktive Variable `availableResourceProperties` zur Verfügung zu stellen.

## Namensgebung & Eindeutigkeit
- **Eindeutigkeit**: Namen für Variablen, Actions und Tasks müssen projektweit eindeutig sein.
- **Automatik**: Bei der Erstellung über den Flow-Editor wird automatisch eine laufende Nummer angehängt, falls der Name bereits vergeben ist (`generateUniqueActionName`, `generateUniqueVariableName`, `generateUniqueTaskName`).
- **PascalCase**: Tasks sollten stets in PascalCase benannt werden (z.B. `MoveAndJump`).

## Fortgeschrittene Reaktive Logik (v1.6.0)

### Proxy-Identität & Unwrapping
Ein häufiges Problem in reaktiven Systemen ist die Diskrepanz zwischen **Proxy-Objekten** (die vom Watcher beobachtet werden) und **rohen Objekten** (die die Benachrichtigungen senden).
- **Regel**: Der `PropertyWatcher` muss alle eingehenden Objekte via `unwrap(obj)` (aus `ReactiveProperty.ts`) behandeln. Dies stellt sicher, dass Watcher für Proxies auch dann ausgelöst werden, wenn die Benachrichtigung vom zugrunde liegenden rohen Objekt kommt.
- **Implementierung**: Methoden wie `watch`, `unwatch` und `notify` im `PropertyWatcher` nutzen konsistent das unwrapped Objekt als Schlüssel in der Map.

### Deep Dependency Tracking für Variablen
Benutzer binden oft direkt an das Variablen-Objekt (z.B. `${Score}`), erwarten aber eine Aktualisierung, wenn sich dessen Wert (`Score.value`) ändert.
- **Automatisierung**: Die `ReactiveRuntime` erkennt beim Binden, ob das Ziel-Objekt eine Variable ist (`isVariable: true`). Ist dies der Fall, wird automatisch ein zusätzlicher Watcher auf die Eigenschaften `.value` und `.items` registriert.
- **Vorteil**: Vereinfachung der UI-Expressions für den Benutzer, ohne die reaktive Kette zu unterbrechen.

### Intelligente Stringifizierung
Um die Anzeige von `[object Object]` im UI zu vermeiden, verfügt der `ExpressionParser` über eine hierarchische Umwandlungslogik (`valueToString`), die intern `PropertyHelper.resolveValue()` nutzt:
1. **Variable**: Inhalt (`value` oder `items`) anzeigen.
2. **Array**: Elemente kommagetrennt auflisten.
3. **Komponente**: Name der Komponente anzeigen (z.B. `Ball`).
4. **Objekt**: Klassennamen (z.B. `[TSprite]`) oder JSON-Vorschau anzeigen.

### Debugging des reaktiven Flusses
Zur Analyse von Bindungsproblemen ist in der Konsole ein farbcodierter Flow implementiert:
- **BLAU (`[Proxy]`)**: Ein Wert wurde in einem reaktiven Objekt gesetzt.
- **DUNKELGRAU (`[PropertyWatcher]`)**: Ein Beobachter wurde für eine Änderung gefunden und wird benachrichtigt.
- **VIOLETT (`[Binding]`)**: Eine UI-Eigenschaft wurde aufgrund einer Abhängigkeit aktualisiert.
- **Kontext-Priorität (Object-over-Data)**: Im Auswertungs-Kontext (`getContext`) haben registrierte Objekt-Proxies IMMER Vorrang vor den Map-Einträgen in `variables`. Dies stellt sicher, dass Bindungen an Variablen-Komponenten (`TVariable`) deren aktuelles Verhalten (isVariable-Logik, Live-Werte) nutzen und nicht auf veraltete primitive Datensätze zurückfallen.
- **INITIAL SYNC**: Die `GameRuntime` synchronisiert beim Start einmalig alle `value`-Eigenschaften von Variablen-Komponenten in das `variableManager`-System. Dies garantiert, dass Live-Edits im Editor (die in `component.value` gespeichert sind) sofort für Bindungen und Logik verfügbar sind.
- **Initialisierungs-Sicherheit**: Alle Variablen (Projekt-global, Main-Stage und aktuelle Start-Stage) werden beim Konstruieren der `GameRuntime` via `initializeVariables` und `initializeStageVariables` geladen, bevor Bindungen erstellt werden.

### Multi-Stage-Merging & Blueprints (v2.10.3)
In Projekten mit mehreren Stages werden globale Komponenten und Logik-Elemente (Tasks/Actions) aus spezialisierten Stages übernommen:
1. **RuntimeStageManager**: 
   - Mergt beim Laden einer Stage automatisch ALLE Objekte, Tasks und Actions aus JEDER Stage vom Typ `blueprint`. 
   - Dies ermöglicht eine systemweite Verfügbarkeit von Infrastruktur-Diensten (z.B. `TAPIServer`) und deren globaler Logik, ohne dass diese manuell in jede Stage kopiert werden müssen.
   - **Präzidenz**: Blueprint-Daten bilden die Basis. Die Daten der aktuellen Stage (und ihrer Vererbungskette via `inheritsFrom`) überschreiben Blueprint-Daten bei Namensgleichheit ("Last Write Wins").
2. **RuntimeVariableManager**: Initialisiert beim Start zusätzlich alle Variablen aus der `Main`-Stage in den globalen `projectVariables` Pool.
3. **Vorteil**: Globale Dienste müssen nur einmal auf einer Blueprint-Stage visualisiert und konfiguriert werden; sie stehen automatisch für Reaktivität und Logik auf allen funktionalen Stages (z.B. Login, Dashboard) zur Verfügung.

### Eigenschafts-Standards & Reaktivität
- **Standard-Inhalt (`text`)**: Alle Komponenten, die Text anzeigen (Labels, Buttons, Statusbars), MÜSSEN die Eigenschaft `text` für ihren Inhalt verwenden. 
- **Alias-Vermeidung**: Vermeide Getter/Setter für reaktive Felder, da diese am Proxy vorbeioperieren können. `TWindow` bietet `text` als einfache Property an.
- **JSON-Kompatibilität**: Falls `caption` im JSON vorhanden ist, wird es via Getter/Setter in `TWindow` automatisch auf `text` umgeleitet.

### Event-Resolution
- **Zentralisierung**: Logik-Events (Trigger, Clicks, etc.) werden IMMER über den `TaskExecutor` mit der Notation `ObjektName.EventName` aufgelöst.
- **Keine Spezial-Lookups**: Komponenten-spezifische Manager (wie `VariableManager`) sollten keine eigene Suchlogik für Tasks implementieren, sondern den `TaskExecutor` beauftragen.

### Variable Lifecycle & Priorität
- **Standard-Initialisierung**: Variablen-Komponenten (`TVariable`, `TTriggerVariable` etc.) initialisieren `value` und `defaultValue` mit `undefined`. Dies verhindert "Verschmutzung" des Projekt-JSONs durch Standard-Nullen und stellt sicher, dass nur explizit vom Benutzer gesetzte Werte gespeichert werden.
- **Start-Priorität**: Beim Spielstart (Initialisierung im `RuntimeVariableManager`) wird `defaultValue` gegenüber `value` bevorzugt. `defaultValue` repräsentiert den beabsichtigten Startzustand des Designs, während `value` den (potenziell im Editor flüchtigen) aktuellen Zustand widerspiegelt.
- **Initial-Sync**: Die `GameRuntime` führt nach der Initialisierung des `VariableManager` einen obligatorischen Rück-Sync in die Komponenten-Instanzen durch (`syncVariableComponents`). Dies ist kritisch, damit die Proxies in der `ReactiveRuntime` von Beginn an die korrekten Werte für Datenbindungen (`${...}`) besitzen.
- **Stage-Wechsel**: Der Variablen-Sync wird bei jedem Stage-Wechsel automatisch wiederholt, um lokale Variablen der neuen Stage korrekt zu laden.

## [Undo/Redo & Recording (ChangeRecorder)](file:///c:/Users/rolfr/.gemini/antigravity/scratch/game-builder-v1/src/services/ChangeRecorder.ts)
- **Service:** `src/services/ChangeRecorder.ts` verwaltet zwei Stacks (`history` und `future`).
- **Aktionen:** Aktionen werden über `changeRecorder.record({ ... })` aufgezeichnet.
- **Batches:** Verwende `startBatch()` und `endBatch()` für zusammenhängende Operationen (z.B. Multi-Selection Drag oder Delete).
- **Interpolation:** Drag-Aktionen speichern einen Pfad (`DragPoint[]`). Die `PlaybackEngine` interpoliert diese Punkte beim Abspielen für flüssige Animationen.
- **UI Integration:** Editor-Fenster (wie `PlaybackControls`) sollten direkt in den DOM des Editor-Containers gerendert werden, um unabhängig vom Stage-Zustand zu sein.
- **Shortcuts:** `Editor.initKeyboardShortcuts()` registriert dumentweite Listeners für `Strg+Z/Y`.

## Trinity-Synchronisation (Pascal | JSON | Flow)

### Zentrale Kopplung (refreshAllViews)
Der `Editor` fungiert als Sync-Hub. Nach jeder strukturellen Änderung (z.B. Task-Umbenennung, neue Action, Variablen-Update) MUSS `refreshAllViews()` aufgerufen werden. Diese Methode orchestriert:
1. `render()`: UI-Vorschau aktualisieren.
2. `updateAvailableActions()`: Kontextsensitive Aktions-Listen (Stage-aware) neu filtern.
3. `refreshJSONView()`: Den JSON-Baum (ggf. mit Stage-Isolierung) neu zeichnen.
4. `refreshPascalView()`: Den Pascal-Code neu generieren und im Viewer/Editor highlighten.

### Intelligente Task-Identifikation (Logik-Signatur)
Tasks werden nicht nur über ihren Namen, sondern über eine **Logik-Signatur** (`PascalGenerator.getLogicSignature`) identifiziert. Dies ermöglicht:
- **Umbenennungs-Erkennung**: Wenn ein Task-Name im Code geändert wird, vergleicht der Parser die Logik mit dem Projektstand und erkennt die Umbenennung, anstatt den alten Task zu löschen und einen neuen zu erstellen.
- **Referenz-Sync**: Beim Erkennen einer Umbenennung aktualisiert die `ProjectRegistry` automatisch alle Aufrufe und Event-Mappings (Wiring) im gesamten Projekt.

### Pascal-Parser Kopplung
- **Parameter & Variablen**: Lokale Prozedur-Parameter (`procedure MyTask(val: number)`) und `VAR`-Blöcke werden direkt in das JSON-Datenmodell synchronisiert.
- **Action-Discovery**: Der Parser versucht, bestehende Aktionen anhand ihrer Logik wiederzuverwenden. Neue Aktionen erhalten sprechende Namen (Muster: `Target_Property_Value`).

### Lifecycle & Cleanup
- **Orphan Cleanup**: `ProjectRegistry.deleteTask` entfernt automatisch alle Aktionen, die ausschließlich von diesem Task genutzt wurden (Dependency Indexing).
- **Stage-Isolierung**: In der JSON-Ansicht einer Stage werden globale Abhängigkeiten (Tasks/Actions) temporär injiziert, um eine vollständige Bearbeitbarkeit ohne Datenverlust zu gewährleisten.
## [Eigenschaftsauswertung & Sichtbarkeit](file:///c:/Users/rolfr/.gemini/antigravity/scratch/game-builder-v1/src/runtime/PropertyHelper.ts) (v2.1.6 / v2.10.2)
- **Template-Interpolation**: Der `PropertyHelper.interpolate` unterstützt Literale (`true`, `false`, Zahlen) innerhalb von `${}`.
- **Automatisches Dereferenzieren (v2.10.2)**: 
    - Variablen-Komponenten (z.B. `TStringVariable`) werden bei der Interpolation automatisch aufgelöst. `${myVar}` gibt direkt den Wert von `myVar.value` zurück.
    - Dies gilt auch, wenn kein expliziter Pfad wie `.value` angegeben ist.
    - Objekte ohne Punkt-Notation werden nun korrekt aufgelöst, sofern sie in der `objects`-Liste existieren.
- **Kontext-Merging**: In Aktionen (`StandardActions.ts`) wird stets ein kombinierter Kontext aus `contextVars` (global) und `vars` (lokal) verwendet. Globale Objekte haben im Zweifelsfall Vorrang vor lokalen Variablen gleichen Namens, um Infrastruktur-Konflikte zu vermeiden.
- **Sichtbarkeit Priorität**: Die Eigenschaft `visible` hat im Stage-Renderer IMMER Vorrang. Vermeide "Force-Visible"-Logiken (z.B. bei Vorhandensein eines Bildes), da diese die reaktive Logik der Engine unterlaufen.
- **Auto-Konvertierung**: Nutze `PropertyHelper.autoConvert`, um String-Ergebnisse der Interpolation (`"true"`, `"123"`) wieder in ihre korrekten Typen (`boolean`, `number`) zu wandeln, bevor sie auf Komponenten-Eigenschaften angewendet werden.

## Visual vs. Data Integrity (Kürzung & Links)
- **Visuelle Textkürzung**: Um FlowCharts kompakt zu halten, werden lange Texte (z.B. in `FlowAction`) in der Diagrammansicht visuell gekürzt.
- **Datenintegrität**: Diese Kürzung darf NUR beim Rendern erfolgen.
    - **FlowAction**: Methoden wie `getActionDetails` müssen stets den VOLLSTÄNDIGEN Datensatz zurückgeben. Die Kürzung passiert erst im HTML-Template (`slice` auf View-Ebene).
    - **FlowTask**: Verwende `white-space: nowrap`, damit Layout-Berechnungen (`autoSize`) auf der realen Textbreite basieren und nicht auf umgebrochenen Fragmenten. Dies verhindert, dass Nodes zu klein gerendert werden.
- **Single Source of Truth (SSoT)**:
    - **Actions**: Global definierte Aktionen sind die Quelle der Wahrheit. Verlinkte Nodes speichern nur eine Referenz (`isLinked: true`, `name`).
    - **Kritische Pfade**: Beim Speichern (`toJSON`) dürfen verlinkte Daten NICHT überschrieben werden. Kopiere niemals gekürzte View-Daten zurück in das Datenmodell.

### Management-Tab & Mediator
Der Management-Tab (`EditorViewManager.renderManagementView`) dient als zentrale Übersicht. Er ist vollständig von der Stage entkoppelt.

**Wichtige Implementierungshilfen:**
- **Manager-Listen**: Werden im `MediatorService` erzeugt und über `isTransient = true` markiert. Sie werden **nie** permanent in die Stage-Objekte gespeichert.
- **Rendering**: Nutzt `Stage.renderTable(el, obj)`. Diese Methode ist statisch und konfiguriert das DOM basierend auf dem `columns`-Array des Objekts.
- **Daten-Mapping**: Komplexe Eigenschaften (wie Aktions-Änderungen) sollten im `MediatorService` für die Anzeige vor-formatiert werden (z.B. `changesDisplay`).
- **Sanitizer**: Der `RefactoringManager` muss bei signifikanten Änderungen am Datenmodell aktualisiert werden, um "Leichen" in alten Projektdateien automatisch zu entfernen.
- **Rolle als Mediator**: Der `MediatorService` dient als zentrale Anlaufstelle ("Broker"). Er reichert Rohdaten (Tasks, Aktionen etc.) zur Laufzeit mit Metadaten an (z.B. Link-Counter, Scope-Emojis).
- **Interaktive Navigation**: Die Tabellen unterstützen `onRowClick`. Im `EditorViewManager` wird dies genutzt, um bei Klick auf visuelle Objekte oder Variablen die `Stage.focusObject(id)` Methode aufzurufen, die das Objekt zentriert und optisch hervorhebt. Bei Tasks wird automatisch in den Flow-Editor gewechselt.
- **Reaktive Synchronisation (Mediator)**: 
    - Der `Editor` emittiert Events (`OBJECT_SELECTED`, `DATA_CHANGED`) bei Interaktionen auf der Stage.
    - Andere Komponenten (wie `EditorViewManager` für den Management-Tab) abonnieren diese Events, um ihre Daten reaktiv zu aktualisieren, ohne dass ein manueller Reload nötig ist.
    - **Vermeidung von Zirkularität**: Beim Versenden von `DATA_CHANGED` kann ein `originator` (z.B. `'pascal-editor'`) angegeben werden. Abonnenten können prüfen, ob sie selbst der Auslöser waren, um unnötige Re-Updates zu vermeiden.
    - **Wichtig**: Nutze beim Versenden von Daten-Änderungen (`DATA_CHANGED`) immer die debounced Version des Mediators, um Performance-Einbußen bei kontinuierlichen Operationen (Drag, Resize) zu vermeiden.
- **Vorteile**:
    - **Saubere Stage**: Die Spiel-Stage im Design-Modus ist frei von transienten Tabellen.
    - **Schnelle Navigation**: Direktes Anfahren von Ressourcen aus einer zentralen Liste.
    - **Datenintegrität**: Der Mediator stellt sicher, dass alle Sichten (Flow, Code, Tabelle) auf denselben konsistenten Datenbestand zugreifen.
- **ComponentRegistry & Hydrierung**: (NEU) Alle GCS-Komponenten sind in der `ComponentRegistry` registriert.
    - **SSoT**: Anstatt Metadaten (Events, Properties) im Inspektor hart zu codieren, nutzt der Inspektor die Registry, um eine temporäre Instanz zu erzeugen ("Hydrierung") und diese direkt zu befragen (`getEvents()`, `getInspectorProperties()`).
    - **Vorteil**: Neue Komponenten funktionieren sofort ("Plug & Play"), da sie ihr eigenes Wissen mitbringen.
- **Status (Aktuell)**: Der `MediatorService` verwaltet diese Manager zentral. Sie nutzen die `TTable`-Komponente zur Darstellung.
    - **isTransient**: Manager-Komponenten sind transient – sie werden im Editor dargestellt, aber NICHT im Projekt-JSON gespeichert.
    - **Manager-Übersicht**:
        - **VisualObjects**: Alle Objekte der Stage (inkl. Klassenname und Scope).
        - **Tasks**: Alle Workflows inkl. Link-Counter (`usageCount`).
        - **Actions**: Alle atomaren Operationen inkl. Ziel und Scope.
        - **Variables**: Alle Datenzustände inkl. Initialwert.
        - **FlowCharts**: Alle Diagramme der Stage inkl. Node-Anzahl.

### TTable Komponente & Statisches Rendering
Die `TTable` ist eine Erweiterung von `TWindow`. Für die Nutzung in Sichten außerhalb der Stage (wie dem Management-Tab) bietet die `Stage` Klasse die statische Methode `Stage.renderTable(element, object)`. Dies ermöglicht es, die mächtige Tabellen-Rendering-Logik überall in der Editor-UI wiederzuverwenden.

### Serialisierung & Trinity-Sync (v2.3.1)
- **Zentralisierung**: Die `toJSON`-Logik wurde in `TComponent.ts` zentralisiert. Subklassen sollten `toJSON` nur in Ausnahmefällen überschreiben.
- **Verschachtelte Pfade**: Der Serialisierer unterstützt nun Punkt-Notation in Property-Namen (z.B. `style.visible`). Dies erzeugt automatisch verschachtelte Objekte im JSON, was für den Renderer essenziell ist.
- **Vermeidung von Datenverlust**: Durch die Automatisierung über `getInspectorProperties` wird sichergestellt, dass alle persistierbaren Eigenschaften (inkl. Sichtbarkeit) bei Synchronisationen (z.B. nach Pascal-Änderungen) erhalten bleiben.

### ServiceRegistry & Typisierung (v2.3.2)
- **Singleton-Pattern**: Die `serviceRegistry` muss explizit mit `ServiceRegistryClass` typisiert werden, um `any`-Inferenz in abhängigen Dateien (ActionEditor, JSONInspector) zu vermeiden.
- **Dienste-Aufruf**: Nutze die typisierte `serviceRegistry.listServices()` und `serviceRegistry.getService(name)` für sichere Interaktionen.
- **Build-Pipeline**: Führe nach größeren Refactorings IMMER `npm run build` (beinhaltet `tsc`) aus. Ein erfolgreiches Durchlaufen der `tsc`-Prüfung ist Voraussetzung für die Stabilität der modularisierten Architektur.

### Mediator-Datenmodelle
- **getVisualObjects**: Gibt angereicherte Datenobjekte (`any[]`) zurück, die zusätzliche Metadaten wie `uiScope` enthalten. Diese Objekte dienen rein der Visualisierung im Management-Tab und entsprechen nicht zwingend der strengen `TWindow`-Klassendefinition.

## [Server-Architektur & Headless-Betrieb](file:///c:/Users/rolfr/.gemini/antigravity/scratch/game-builder-v1/implementation_plan.md) (v2.6.0)

### Service Blueprint Stage
In Projekten vom Typ "Server" (Stage-lose Applikationen) wird die Stage als **System-Topologie** umgedeutet.
- **Visualisierung**: Services (`TAPIServer`, `TDatabase`) und globale Variablen werden als funktionale Knoten (Nodes) auf der Stage platziert.
- **Dashboard**: Die Stage dient im Run-Modus als Dashboard, das den Status der Services (aktiv, verarbeitend, Fehler) signalisiert.

### Server Run-Mode & Simulation
- **Sandbox**: Die `GameRuntime` fungiert als lokaler Server-Container.
- **Request-Timeline**: Das Debug-Log visualisiert einlaufende API-Requests und deren logische Verarbeitungskette in Echtzeit.
- **API-Tester (Simulator)**: 
    - Der `TAPIServer` kann im Editor via Inspector mit Test-Daten (Method, Path, Body) versorgt werden.
    - Klick auf **🚀 Request Senden** ruft die Methode `simulateRequest()` auf, die ein `onRequest`-Event mit dem Flag `isSimulation: true` auslöst.
    - Ein Mock-`HttpServer` Service in `Editor.ts` fängt die Antwort der `respond_http` Action ab (erkenntlich an der `sim-` requestId) und schreibt den Status/Body zurück in die `testResponse` Property des Servers.
- **Datenbankschicht (TDataStore)**:
    - Ermöglicht CRUD-Operationen via Flow-Editor.
    - Nutzt den `DataService` (Singleton) zur Persistenz.
    - **Editor**: Speicherung im `localStorage` unter `gcs_db_${storagePath}`.
    - **Server**: Speicherung als echte JSON-Dateien im Verzeichnis `./data/`.
    - **Actions**: `db_save` (Upsert), `db_find` (Filter) und `db_delete` (via ID).

### Export & Deployment (Fly.io)
- **Server-Bundle**: Export erfolgt als Node.js-Paket inkl. `project.json` und `Headless-Runtime`.
- **Fly.io Integration**: Automatische Generierung von `Dockerfile` und `fly.toml`. Unterstützung für Fly Volumes (persistente Daten) und Secrets.
- **Deployment**: `fly launch` / `fly deploy` als Standard-Workflow für Cloud-Hosting.
### JSON-Eigenschaften & Komplexe Daten (v2.6.2)
- **Typ `'json'`**: Das `TPropertyDef` Interface unterstützt nun den Typ `'json'`. Dies ermöglicht es, komplexe Arrays oder Objekte (wie die Emoji-Liste im `TEmojiPicker`) als Roh-JSON im Inspector zu editieren.
- **Implementierung**: Der `JSONInspector` rendert Eigenschaften vom Typ `'json'` automatisch als `TEdit` (Textfeld) mit entsprechendem Platzhalter.
- **Best Practice**: Nutze den Typ `'json'` für Konfigurationsdaten, die selten geändert werden oder eine hohe Flexibilität erfordern, bevor eine spezialisierte UI-Komponente (z.B. ein dedizierter Tabellen-Editor) implementiert wird.

### UI-Komponenten Muster (TEmojiPicker)
- **Rendering**: Komponenten mit komplexen UI-Strukturen (wie Grids) sollten eine statische `render...` Methode in `Stage.ts` besitzen, um die DOM-Erzeugung zu kapseln.
- **Zustand**: Verwende reaktive Properties (z.B. `selectedEmoji`), um den Zustand der Komponente zu halten, sodass der `JSONInspector` und andere Komponenten darauf reagieren können.
- **Events**: Löse fachliche Events (wie `onSelect`) immer über den `onEvent`-Callback der Stage aus, um die Anbindung an den Flow-Editor zu gewährleisten.

### Event-Persistenz & Mapping (v2.16.17)
- **Standardisierung**: Event-Mappings werden ausschließlich im `events`-Property des Objekts gespeichert (`"events": { "onSelect": "TaskName" }`).
- **Legacy-Support**: Das veraltete `Tasks`-Property wird von der Runtime noch lesend unterstützt, aber vom Editor beim Speichern automatisch nach `events` migriert.
- **Inspector**: Der `JSONInspector` visualisiert und schreibt Events nun direkt in `events`.
- **Best Practice**: Vermeide manuelle Eingriffe in `project.json`, die `Tasks` verwenden. Nutze den Editor oder migriere manuell zu `events`.

## Object Interpolation & Data Integrity (v2.11.0)
- **Object vs String**: `PropertyHelper.interpolate` gibt bei komplexen Ausdrücken (`${user} ${role}`) immer einen String zurück. Dies zerstört die Objektreferenz.
- **Lösung (ExpressionParser.evaluate)**:
    - Wenn ein Ausdruck NUR eine Variable enthält (z.B. `${currentUser}`), muss `ExpressionParser.evaluate` verwendet werden.
    - Dies gibt das rohe Objekt (Referenz) zurück, anstatt `[object Object]` oder eine String-Repräsentation.
    - **Anwendung**: In Aktionen wie `respond_http` oder `db_save`, die strukturierte Daten erwarten, muss zwingend geprüft werden, ob es sich um einen "Simple Expression" handelt.
- **Deep Interpolation**: Beim Durchlaufen von verschachtelten Objekten (z.B. `body` in einem API-Request) muss die Rekursion (Deep Clone) erhalten bleiben, um z.B. `user.role` auch in Unterobjekten korrekt aufzulösen.

## Editor Runtime Navigation
- **onNavigate Handler**: Die `GameRuntime` kennt nur `options.onNavigate`.
- **Implementierung**: Der Host (z.B. `EditorRunManager`) muss diesen Handler implementieren und die Navigation logisch ausführen:
    1. Parsing des Targets (`stage:ID` oder `ID`).
    2. Validierung der Stage-ID.
    3. **WICHTIG**: Aufruf von `editor.switchStage(id)`, um den Editor-State (und damit die aktive Stage für den Renderer) zu aktualisieren.
    4. Ein reiner View-Wechsel (`switchView`) reicht nicht aus, da die `GameRuntime` sonst auf der alten Stage weiterläuft (Geister-Zustand).

## [Patching großer Projektdateien](file:///c:/Users/rolfr/.gemini/antigravity/scratch/game-builder-v1/patch_project.cjs) (v2.13.0)
Bei sehr großen `project.json` Dateien (über 1500 Zeilen) können Standard-Editoren an ihre Grenzen stoßen (Token-Limits oder Match-Fehler durch komplexe JSON-Strukturen).
- **Lösung**: Nutze ein Node.js Patch-Skript (`.cjs`), um strukturelle Änderungen via `JSON.parse` und `JSON.stringify` vorzunehmen.
- **Workflow**: 
    1. Skript erstellen, das die Stage via ID sucht.
    2. Gewünschte Arrays (`actions`, `tasks`, `variables`) direkt im Objekt-Modell ersetzen.
    3. Datei zurückschreiben.
- **Vorteil**: 100%ige Integrität der JSON-Syntax und Vermeidung von Zeilenverschiebungs-Problemen.

## [Room Management & Kontext-Auflösung](file:///c:/Users/rolfr/.gemini/antigravity/scratch/game-builder-v1/game-server/src/server.ts) (v2.13.0)
- **Kontext-Endpoint**: Nutze `/api/platform/context/:userId`, um beim Start eines Dashboards die gesamte Hierarchie (City -> House -> Room) des Benutzers in einer einzigen Anfrage aufzulösen.
- **Speicherung**: Context-Daten im Dashboard sollten in einer globalen oder Stage-lokalen Variable `userContext` vorgehalten werden, um Referenzen in Formeln (z.B. `userContext.house.id`) zu ermöglichen.
- **API-First**: Das Erstellen von Ressourcen (Räume, User) sollte IMMER über den `TAPIServer` (POST-Request) erfolgen, um die Backend-Validierung und Hierarchie-Logik (z.B. automatisches Zuweisen des Admins zum Raum) zu nutzen.

## Modularer Login & Session-Flow (v2.15.0)
Zur Verbesserung der Übersichtlichkeit wurde der Login-Prozess in drei funktionale Einheiten unterteilt, die sowohl im Code als auch im Flow-Editor modular abgebildet werden:

1. **LoginFlow (Eingabe & API)**:
    - **Quelle**: Die Variable `currentPIN` (Stage-Scope) sammelt die Emojis des Benutzers.
    - **Aktion**: `SubmitLogin` führt den HTTP-POST aus und speichert das Ergebnis in `loginResult` (Erfolg) oder `loginError` (Fehler).
    - **Visuelle Verzweigung**: Im Diagramm werden die Verbindungen explizit als **GUT-FALL** (führt zu `ProcessSession`) und **SCHLECHT-FALL** (zeigt Toast-Fehler) benannt.
2. **ProcessSession (Datenhaltung & Weiche)**:
    - Extrahiert `token` und `user` aus `loginResult`.
    - Entscheidet basierend auf der Rollen-Anzahl:
        - `roles.length > 1` -> Navigation zu `stage_role_select`.
        - `else` -> Aufruf des `AutoDispatch` Tasks.
3. **AutoDispatch (Routing)**:
    - Prüft die primäre Rolle (`currentUser.roles[0]`).
    - Navigiert zur entsprechenden Ziel-Stage (`stage_super_dashboard`, `stage_admin_dashboard`, `stage_player_lobby`).
### [Action-Speicherung & Sequenz-Struktur](file:///c:/Users/rolfr/.gemini/antigravity/scratch/game-builder-v1/src/editor/services/FlowSyncManager.ts) (v2.16.23)
Es gibt zwei grundlegend verschiedene Arten, wie Aktionen in der `actionSequence` eines Tasks im JSON gespeichert werden:

1. **Lineare Aktionen (Standard)**:
   - **Typ**: `action`
   - **Struktur**: `{ "type": "action", "name": "ActionName", "params": { ... } }`
   - **Verhalten**: Sie sind einfache Referenzen auf eine globale oder lokale Aktions-Definition. Sie haben keinen eigenen "Body".
   
2. **Branching Actions (DataAction / Condition)**:
   - **Typ**: `data_action` oder `condition`
   - **Struktur**: 
     ```json
     { 
       "type": "data_action", 
       "name": "MyDataAction",
       "successBody": [ ... Sequenz für Erfolg ... ],
       "errorBody": [ ... Sequenz für Fehler ... ],
       "resource": "...", 
       "method": "...",
       ... (weitere Datenfelder)
     }
     ```
   - **Verhalten**: Sie sind "Container-Aktionen". Sie enthalten ihre Logik-Zweige (`successBody`/`errorBody`) direkt in der Sequenz des Tasks. 
   - **Wichtig**: Bei `DataAction` wird im Flow-Sync (`syncTaskFromFlow`) die Definition (URL, Method, etc.) aus der Bibliothek in das Sequenz-Item kopiert, falls der Knoten verlinkt ist (`isLinked`), während der `successBody` exklusiv aus dem Diagramm-Pfad generiert wird.

> [!IMPORTANT]
> Beim Erstellen von Tools oder Refactorings muss beachtet werden, dass `DataActions` nicht nur in `project.actions` leben, sondern ihre verzweigte Struktur innerhalb der `actionSequence` der Tasks persistiert wird. Ein Umbenennen einer DataAction muss daher sowohl die globale Definition als auch das `name`-Feld im Sequenz-Item aktualisieren.

### Best Practices für Multi-Stage Navigation
- **Dynamische Listen**: Komponenten wie `TList` (z.B. `RoleList`) sollten beim Stage-Start (`onRuntimeStart`) via Task befüllt werden, indem die Daten aus dem globalen Kontext (`currentUser`) in die `items` Property der Komponente geschrieben werden.
- **Task-Referenzen**: Komplexe Diagramme sollten durch den Aufruf von Unter-Tasks (`type: task`) modularisiert werden, statt alle Logik in ein einziges Diagramm zu packen. Dies erhöht die visuelle Scannbarkeit im Flow-Editor.

### [Dynamische Action-UI](file:///c:/Users/rolfr/.gemini/antigravity/scratch/game-builder-v1/src/editor/inspector/InspectorHost.ts) (v2.16.24)
- **Problem**: Spezialisierte Actions (wie `http`, `store_token`) benötigen unterschiedliche Eingabefelder im Inspector, wurden aber bisher pauschal auf das statische `inspector_action.json` Template gezwungen.
- **Lösung**:
    - Der `FlowEditor` speichert den Subtype (z.B. `http`) in `node.data.type`.
    - Der `JSONInspector` prüft auf spezielle Action-Typen und wechselt bei Bedarf auf den generischen `inspector_header.json` (plus dynamische Properties aus `getInspectorProperties`), statt das Action-Template zu nutzen.
- **Implementierung**: Wenn eine neue Action mit spezieller UI eingeführt wird:
    1. Sicherstellen, dass der Typ im Toolbox-Item als `Action:my_type` definiert ist.
    2. In der `FlowAction`-Klasse (oder Subklasse) muss `getInspectorProperties` die passenden Felder liefern.
    3. Der `JSONInspector` erkennt den Typ automatisch und rendert die dynamischen Felder.

## [Lern-Schleife & Anti-Patterns] (v3.0.1)

### DO NOT: Globale Präfixe in Expressions
In der `project.json` sollten globale Variablen (aus der `stage_blueprint`) DIREKT ohne das Präfix `global.` referenziert werden (z.B. `${currentPIN}`). 
- **Problem**: Der `ExpressionParser` sucht bereits in der globalen Map; ein zusätzliches `global.` führt zu einer misslungenen Auflösung (Empty String).
- **Fix**: Immer `${Variable}` statt `${global.Variable}` verwenden.
