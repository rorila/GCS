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
- **Sync-Blacklist**: Die `taskFields` Liste in `FlowSyncManager.ts` darf keine Felder enthalten, die für Aktionen (Global oder Embedded) essentiell sind (z.B. `value`, `params`, `body`, `source`).

## Synchronisation von Inspector und Flow-Editor
- **Persistenz von Flow-Nodes**: Beim Bearbeiten von Action-Nodes im Inspector muss der `FlowNodeHandler` nicht nur globale Listen (`project.actions`), sondern auch die `flowCharts` des Projekts durchsuchen, um "unlinked" / lokale Actions zu finden und zu aktualisieren.
- **Typ-Wechsel**: Bei Änderungen des Aktions-Typs im Inspector muss `mediatorService.notifyDataChanged` aufgerufen werden, damit der Flow-Editor die Sequenzen neu berechnet und der Inspector passende Parameter-Felder einblendet.
- **Server-Sync**: `EditorDataManager.updateProjectJSON` sollte bei Inspector-Änderungen einen Server-Dateisystem-Sync auslösen, um Konsistenz zwischen UI-State und JSON-View zu wahren.

## DO NOT
- **Expert-Wizard Prompts**: Prompts unterstützen Platzhalter in geschweiften Klammern (z.B. `"Wert für {target}.{property}?"`). Diese werden automatisch durch bereits gesammelte Werte aus der Session ersetzt.

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

## 9. BEST PRACTICES (NEU)
- **Interface Konsistenz**: Host-Objekte für Manager-Klassen (z.B. `EditorDataManager`) müssen ihre Anforderungen in einem dedizierten Interface definieren. Stellen Sie sicher, dass der `Editor` (oder andere Hosts) dieses Interface vollständig implementiert, um Laufzeitfehler wie `TypeError` zu vermeiden. Siehe Fix in `EditorViewManager.ts` (`IViewHost`).
