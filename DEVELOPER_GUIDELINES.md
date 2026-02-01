# Developer Guidelines

## Modulare Architektur (Monolithen-Aufteilung)
Um die Wartbarkeit zu verbessern und Token-Limit-Fehler zu vermeiden, wurden die Hauptklassen modularisiert:

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
- **Workflow**: Änderungen an der Fachlogik sollten bevorzugt in den jeweiligen Managern vorgenommen werden. `FlowEditor` fungiert primär als UI-Host und Event-Verteiler.
- **Koordinaten & NaN-Safety**:
    - Der Flow-Editor nutzt einen **Canvas-World-Koordinatenraum** (0 bis 5000px). Maus-Events müssen stets um den `scrollLeft`/`scrollTop` des Canvas korrigiert werden, um absolute Welt-Koordinaten zu erhalten.
    - Die `cellSize` ist eine kritische Eigenschaft für das Grid-Snapping. Alle Manager müssen via `host.cellSize` (lowercase!) darauf zugreifen. Fehlende cellSize führt zu `NaN`-Werten.
    - `FlowSyncManager.restoreNode` enthält redundante `isNaN`-Prüfungen als Sicherheitsnetz für beschädigte Projektdaten.

### Inspector Integration for Flow Elements
- **Events**: Flow elements (running in the Editor context) must implement `public getEvents(): string[]` (returning `[]` if none) to bypass the `ComponentRegistry` lookup. The `JSONInspector` prefers this method over the registry to avoid warnings for non-GameObjects.
- **Deletion**: Deleting elements via the Inspector requires explicit routing in `Editor.ts`. If the `FlowEditor` is active (`currentView === 'flow'`), delete requests for Flow nodes must be delegated to `FlowEditor.deleteNode()` to handle reference checks and specific cleanup logic.


### Stage-Awareness in der Entwicklung
- **Code-Generierung**: Bei der Generierung von Code (z.B. `PascalGenerator`) muss immer projektweit gesucht werden (Global + alle Stages), da Tasks und Aktionen in verschiedenen Scopes liegen können.
- **Refactoring**: Operationen wie Löschen (`deleteTask`, `deleteAction`) oder Bereinigen (`cleanActionSequences`) müssen zwingend alle Stages iterieren, um verwaiste Referenzen oder Datenleichen in nicht-aktiven Stages zu vermeiden.
- **Primat der Stages**: Da der Editor zunehmend stage-basiert arbeitet, sollten neue Funktionen standardmäßig stage-übergreifend implementiert werden.

### Runtime-Architektur
Die Klasse `GameRuntime.ts` delegiert ihre Kernaufgaben an:
- **RuntimeStageManager.ts**: Auflösung der Vererbungskette (`inheritsFrom`), Mergen von Objekten/Tasks aus mehreren Ebenen.
- **RuntimeVariableManager.ts**: Verwaltung des Variablen-Kontexts, Scoping-Präzedenz (Local > Global) und reaktive Trigger-Logik.
- **GameRuntime implements IVariableHost**: Ermöglicht dem VariableManager den Zugriff auf Timer und Event-Execution ohne zirkuläre Abhängigkeiten.

## Rendering & Game Loop
- **GameLoopManager (Singleton)**: Verwende den `GameLoopManager.getInstance()` für alle Spielobjekt-Updates und Kollisionsprüfungen. Er ist KEIN Stage-Objekt und umgeht somit Proxy-Binding-Probleme.
- **GameRuntime Authority**: Die `GameRuntime` ist die "Source of Truth" für den Spielzustand im Run-Modus.
- **Keine manuelle GameLoop-Init**: Der `Editor` darf den `TGameLoop` nicht manuell initialisieren (`init/start`). Die `GameRuntime.start()` Methode übernimmt dies via `GameLoopManager`.
- **Ticker-Synchronisation**: Falls der `Editor` einen Fallback-Animations-Ticker verwendet (z.B. wenn keine `GameLoop` vorhanden ist), muss dieser gestoppt werden (`stopAnimationTicker`), sobald eine echte `GameLoop` zur Laufzeit erscheint (z.B. nach einem Stage-Switch).
- **Stage-Cleanup**: Bei jedem Stage-Wechsel MÜSSEN `ReactiveRuntime.clear()` und `AnimationManager.getInstance().clear()` aufgerufen werden, um persistente Objekte oder laufende Animationen der vorherigen Stage zu entfernen.
- **Stage-Diagnostics**: Bei leeren Bildschirmen im Run-Mode ist die erste Prüfung die Kalkulation der Stage-Größe. `Stage.ts` loggt `Game Stage Size` beim Update. Eine Größe von 0x0px deutet auf CSS-Layout-Probleme im Host-Container hin.
- **Interaktions-Garantie**: `TButton` Komponenten sollten im Run-Mode immer als klickbar (`cursor: pointer`) markiert werden, auch ohne explizite Task-Zuweisung, um generische Events für die `GameRuntime` abfangbar zu machen.
- **Render-Callback**: Übergib den Render-Callback (`onRender`) direkt an den `GameRuntime`-Konstruktor (`options.onRender`).
- **Proxy-Verwendung**: Verwende immer die Objekte aus `runtime.getObjects()` für das Rendering, da diese die reaktiven Proxies enthalten.
- **Migration**: Das Root-Level `objects` Array in Projektdateien ist veraltet. Objekte sollten ausschließlich innerhalb des `stages`-Arrays gespeichert werden. Nutze Migrationsscripte, um Redundanzen zu entfernen.
- **Hybrides Variablen-System**: 
    Die Komponente `TVariable` (und abgeleitete Klassen wie `TTimer`, `TGameLoop`) werden im Editor als visuelle Objekte behandelt, aber im JSON getrennt im `variables`-Array gespeichert.
    Dazu implementiert **Editor.ts** eine Logik, die beim Speichern (`syncStageObjectsToProject`) die `currentObjects` filtert und in die entsprechenden Arrays aufteilt.
    WICHTIG: Sollten neue Variablen-Typen hinzugefügt werden, müssen diese:
    1. Das Flag `isVariable = true` setzen.
    2. Im `Serialization.ts` -> `hydrateObjects` ihre spezifischen Properties wiederherstellen.
    Das `ProjectVariable`-Interface in `types.ts` wurde erweitert, um auch Geometrie-Daten (x, y) optional zu speichern, damit die Position im Editor erhalten bleibt.
    Der `Editor` nutzt Getter/Setter (`currentObjects`), um diese Listen zur Laufzeit für den Stage-Renderer zu mergen und beim Speichern wieder sauber zu trennen.
    - **Wichtig**: Bei der Hydrierung in `loadProject` müssen beide Arrays getrennt verarbeitet werden.

## Editor -> Runtime Transition
- **Data Sync**: Vor dem Start der Runtime (`new GameRuntime`) müssen die aktuellen Editor-Objekte explizit in das Projekt-JSON serialisiert werden (`syncStageObjectsToProject`), damit Änderungen (z.B. neue Bilder) übernommen werden.
- **View Restore**: Beim Beenden des Run-Modes muss sichergestellt werden, dass die Editor-Ansicht sauber neu geladen wird (z.B. via `switchStage`), um Runtime-Proxies zu entfernen und den Editor-Status wiederherzustellen.
- **Z-Index Strategy**: Um Sichtbarkeitsprobleme bei Overlays zu vermeiden, aggregiert die `GameRuntime` z-Indices rekursiv (`effectiveZ = parentZ + currentZ`). Container wie `TSplashScreen` (`z=1000`) müssen ihre Inhalte als echte `children` speichern, damit dieses Stacking funktioniert. `TPanel` und `TWindow` Subklassen müssen daher `children` serialisieren.
- **Loop Termination**: Fallback-Animations-Loops im Editor müssen robust gestoppt werden, wenn der Run-Modus endet oder eine echte `GameLoop` übernimmt.

## FlowChart-Daten (Single Source of Truth)
- **Link-basierte Architektur**: Action-Daten werden NICHT mehr redundant in FlowCharts gespeichert. FlowChart-Elemente halten nur noch einen Link (`isLinked: true`) auf die globale Definition in `project.actions`.
- **Automatische Migration**: Beim Laden in `restoreNode` (FlowEditor.ts) werden Legacy-Daten automatisch als Links markiert, falls sie in `project.actions` existieren.
- **Speichern**: `FlowAction.toJSON()` stellt sicher, dass verlinkte Assets nur mit Name und Flag gespeichert werden.
- **Schutzmechanismus**: `updateGlobalActionDefinition` verhindert, dass valide globale Definitionen durch minimale Link-Daten (nur Name) überschrieben werden.
- **Copy vs Link**: Kopien (`Embed Action (Copy)`) erstellen neue, unabhängige Archive in `project.actions` mit eindeutigen Namen.

## Task-Logik (Primat der FlowCharts)
- **Master-Status**: Flow-Diagramme sind die primäre Quelle für die Task-Logik. Die `actionSequence` wird bei jedem Speichern/Export automatisch aus dem Diagramm regeneriert.
- **UI-Sperre**: Wenn ein Flow existiert, muss die Listen-Ansicht (`TaskEditor.ts`) schreibgeschützt sein. Verwende das `isReadOnly`-Flag in `createSequenceItemElement`.
- **Synchronisation**: Rufe vor allen Persistenz-Operationen `flowEditor.syncAllTasksFromFlow(project)` auf, um Datenkonsistenz zu garantieren.

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
    - **Sichtbarkeit**: Die `visible`-Eigenschaft in der JSON steuert das Ausblenden. Bei gruppierten Feldern (Label + Input) muss dies in `renderInlineRow` im `JSONInspector.ts` explizit geprüft werden.
    - **Caching**: Um sicherzustellen, dass Änderungen an der JSON-Konfiguration sofort sichtbar sind, werden fetch-Aufrufe mit einem Cache-Buster (`?v=Date.now()`) versehen.
    - **Metadaten (Main Stage)**: Globale Spiel-Metadaten (Name, Autor) werden bevorzugt in der Haupt-Stage (`type: 'main'`) gespeichert (`gameName`, `author`). Der Inspector bindet diese via `activeStage.*`. Generatoren und Exporter müssen dies berücksichtigen und die Haupt-Stage-Werte gegenüber `project.meta` priorisieren.
- **Sichtbarkeit von Komponenten**:
    - **System- & Variablen-Komponenten**: Komponenten wie `TGameLoop`, `TInputController`, `TTimer` und alle spezialisierten Variablen (`isVariable: true`) sind nur im **Editor-Modus** sichtbar.
    - **Editor-Anzeige**: Diese Komponenten zeigen im Editor ihren `name` als Text an, um die Identifizierung zu erleichtern (statt z.B. den aktuellen Wert einer Variable).
    - **Run-Modus / Export**: Diese Komponenten müssen via `display: none` ausgeblendet werden. Im `GameExporter` sollten sie zudem aus dem `objects`-Array gefiltert werden, da sie als Daten bereits im `variables`-Array existieren.
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
  - Beim Speichern (`handleObjectChange`) erkennt der Inspector verlinkte Elemente und schreibt Änderungen via `editor.getTarget...` direkt in die Original-Definition zurück.
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
    - Globale Variablen liegen in `project.variables`.
    - Lokale Variablen liegen in `activeStage.variables`.

- **Dropdown Verhalten**: Alle Dropdowns im Action Editor sollten einen Platzhalter ("--- bitte wählen ---") verwenden, wenn noch kein Wert ausgewählt ist. Dies stellt sicher, dass jede Auswahl (auch die erste) ein `onchange` Event auslöst.
- **Dependency Resets**: Beim Ändern eines Primär-Feldes (z.B. Target Object oder Action Type) müssen abhängige Felder (z.B. Method Name) explizit gelöscht werden, um inkonsistente Zustände in der UI zu vermeiden.
- **Re-rendering**: Jede Änderung an einem zentralen `dialogData` Feld, die die Sichtbarkeit anderer Felder beeinflusst, erfordert einen expliziten Aufruf von `this.render()`.
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
- **Task-Selektion**: Das Flow-Dropdown zeigt ALLE im aktuellen Scope (Stage oder Global) definierten Tasks an, auch wenn diese noch kein Flow-Diagramm besitzen. Dies erleichtert das Initialisieren neuer Diagramme für bestehende Tasks.

### [JSON Viewer & Isolated Stages](file:///c:/Users/rolfr/.gemini/antigravity/scratch/game-builder-v1/src/editor/Editor.ts)
Wenn eine Stage isoliert im JSON-Tab angezeigt wird (`activeStage`), werden globale Daten (Tasks UND Actions), die für diese Stage relevant sind (d.h. dort benutzt werden), manuell injiziert, damit sie bearbeitbar bleiben und vollständig sind.
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
- **Kontext-Sensitivität**: `JSONInspector.ts` lädt automatisch das passende Template basierend auf dem Typ des selektierten Objekts (`selectedObject.getType()`: 'Task', 'Action' oder className).
- **Hybrid-Modus**: Für Flow-Elemente (`Task`, `Action`) unterstützt der Inspector einen Hybrid-Modus:
  - **Statische Eigenschaften**: Werden aus der JSON geladen (z.B. Header, Name, Typ).
  - **Dynamische Eigenschaften**: Werden (falls implementiert) über `getInspectorProperties()` generiert (z.B. variable Parameter-Listen bei Tasks).
  - **Duplikate vermeiden**: Eigenschaften, die bereits in der statischen JSON-Datei definiert sind, **DÜRFEN NICHT** zusätzlich in `getInspectorProperties()` zurückgegeben werden. Dies ist essenziell für eine saubere UI (wie z.B. bei `FlowVariable` umgesetzt).
- **Action-Properties**: `FlowAction` fungiert als Proxy für die globale `project.actions` Definition. Getters/Setters wie `actionType`, `target`, `changesJSON` wandeln die internen Strukturen für den Inspector in Strings oder primitive Werte um.
- **Datenquellen**: `TSelect` Komponenten unterstützen dynamische Quellen via `source`:
  - `tasks`, `actions`, `variables`, `stages`, `objects`, `services` und `easing-functions`.
- **Dynamische Action-Parameter (TActionParams)**:
  - Jede neue Aktion muss in der `ActionRegistry.ts` (und optional in `StandardActions.ts`) registriert werden.
  - Die UI für Parameter wird automatisch aus dem `parameters`-Array der Metadaten generiert.
  - Verwende `source: 'variables' | 'objects' | 'stages' | 'services' | 'easing-functions'`, um Dropdowns automatisch zu befüllen.
  - Komplexere Aktionen (wie `animate`) können so ohne Änderungen an JSON-Dateien oder Dialog-Renderern hinzugefügt werden.
- **Dialog-Expressions**:
  - Im `JSONDialogRenderer` müssen Variablen in Properties wie `source` zwingend mit `${...}` umschlossen werden (z.B. `"source": "${dialogData.images}"`), damit sie als Expression ausgewertet werden. Ohne `${}` wird der Wert als String-Literal behandelt.

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
Um die Anzeige von `[object Object]` im UI zu vermeiden, verfügt der `ExpressionParser` über eine hierarchische Umwandlungslogik (`valueToString`):
1. **Variable**: Inhalt (`value`) anzeigen.
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

### Multi-Stage-Merging für globale Objekte
In Projekten mit mehreren Stages müssen globale Komponenten (insbesondere Variablen) aus der `Main`-Stage in jede andere Stage übernommen werden:
1. **RuntimeStageManager**: Mergt beim Laden einer Stage alle Objekte der `Main`-Stage, die `scope: 'global'` haben oder Variablen sind.
2. **RuntimeVariableManager**: Initialisiert beim Start zusätzlich alle Variablen aus der `Main`-Stage in den globalen `projectVariables` Pool.
3. **Vorteil**: Globale Variablen müssen nicht manuell in jede Stage kopiert werden; sie stehen automatisch für Reaktivität und Tasks (z.B. Punkteanzeige in Level 2 für Variable aus dem Startscreen) zur Verfügung.

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
## [Eigenschaftsauswertung & Sichtbarkeit](file:///c:/Users/rolfr/.gemini/antigravity/scratch/game-builder-v1/src/runtime/PropertyHelper.ts) (v2.1.6)
- **Template-Interpolation**: Der `PropertyHelper.interpolate` unterstützt Literale (`true`, `false`, Zahlen) innerhalb von `${}`. Leerzeichen werden getrimmt. Dies ist essenziell für Aktionen, die Booleans via Template-Syntax setzen (z.B. `${true }`).
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

