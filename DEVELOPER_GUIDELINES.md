# Developer Guidelines

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

## Debugging
- **Identitäts-Prüfung**: Bei Verdacht auf "Geister-Objekte" (Logik läuft, Rendering steht), prüfe die Objekt-Identität mit einem temporären "Tag" (`__debugId`), das vor der Proxy-Erstellung angehängt wird.
- **JSON-Vergleich**: Nutze `JSON.stringify`, um tiefere Unterschiede in Objekt-Strukturen zu erkennen, falls die Identität gleich scheint.

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

## Export-System
- **Formate**: Plain (lesbar) und gZip (komprimiert, ~70% kleiner).
- **gZip-Frontend**: `JSON → gzipSync (fflate) → Base64 → PROJECT_DATA` (HTML) oder `{_compressed: true, data: "..."}` (JSON). Siehe `GameExporter.ts`.
- **Runtime-Kompatibilität**: `player-standalone.ts` erkennt automatisch komprimierte Daten und dekomprimiert via `gunzipSync`.
- **Backend-Dekomprimierung**: Die Game Platform (`server.ts`) dekomprimiert hochgeladene, komprimierte JSONs on-the-fly (`zlib.gunzipSync`), um dem Spieler unabhängig vom Speicherformat immer valides JSON zu liefern.
- **Bibliotheken**: `fflate` im Frontend, `zlib` im Backend.

## Proxy-Objekte & Reactive Runtime
- **Spread-Operator Limitation**: Der Spread-Operator (`{...obj}`) kopiert KEINE Getter-basierten Properties von Proxy-Objekten. Bei reaktiven Komponenten (TImage, TSprite, TPanel) müssen image-relevante Properties (`backgroundImage`, `src`, `objectFit`, `imageOpacity`) explizit kopiert werden.
- **Betroffene Stelle**: `GameRuntime.getObjects()` - hier werden alle Properties für das Rendering aufbereitet.
- **Symptom**: Bilder werden im Run-Modus nicht angezeigt, obwohl die Daten korrekt im Projekt gespeichert sind.

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

### Variable Scopes & Visibility (Phase 3)
- **Scoping-Regeln**:
  - `global`: Variable ist projektweit persistent und für alle Stages sichtbar/beschreibbar.
  - `local`: Variable ist stufenspezifisch (Stage). Jede Stage besitzt ihre eigene Instanz dieser Variable.
- **Auflösung (Precedance)**: `GameRuntime.createVariableContext` (Proxy) priorisiert `local` vor `global` (Shadowing erlaubt).
- **Cross-Stage Zugriff**:
  - Syntax: `${StageName.VariableName}`.
  - Zugriff ist **Read-Only** und nur für Variablen mit `isPublic: true` gestattet.
  - Schreibversuche oder Zugriff auf private Variablen werden mit einer Console-Warnung abgelehnt.
- **Speicherort**:
  - Globale Variablen liegen in `project.variables`.
  - Lokale Variablen liegen in `activeStage.variables`.
  - Variablen in `project.variables` mit `scope: 'local'` dienen als Blueprint und werden in JEDER Stage beim Start als lokale Instanz initialisiert.

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
- **Live-Synchronisation**: Änderungen im Inspector triggern über `refreshPascalView` (Editor.ts) sofort eine Aktualisierung des generierten Pascal-Codes.
- **Typkonvertierung (autoConvert)**: Benutzereingaben aus Textfeldern sind im DOM immer Strings. Nutze `PropertyHelper.autoConvert(value)` nach der Interpolation, um Werte intelligent zurück in `number` oder `boolean` zu wandeln. Dies ist essenziell für Methoden wie `moveTo`, die numerische Parameter erwarten.
- **Bereitstellung von Hilfsfunktionen (Scope)**:
  - Funktionen, die in Dialog-Expressions (`${...}`) genutzt werden sollen, müssen sowohl in `JSONDialogRenderer.evaluateExpression` als auch in `replaceTemplateVars` registriert werden.
  - Aktuelle Standard-Funktionen: `getMethodSignature(target, method)`, `getStageOptions()`, `getMethods(target)`, `getProperties(target)`.
- **Methoden-Registrierung**:
  - Neue Methoden für Komponenten MÜSSEN in der `MethodRegistry.ts` (Parameter-Definitionen) UND im `methodMap` von `JSONDialogRenderer.getMethodsForObject` (Sichtbarkeit im Dropdown) eingetragen werden.
  - Visuelle Standard-Methoden wie `moveTo` sollten für alle von `TWindow` erbenden Komponenten im `methodMap` freigeschaltet sein.
-### [Refactoring & Umbenennung](file:///c:/Users/rolfr/.gemini/antigravity/scratch/game-builder-v1/src/editor/RefactoringManager.ts)
Bei der Implementierung von Refactoring-Logik muss darauf geachtet werden, dass das Projekt eine Multi-Stage-Architektur hat. Referenzen (Umbenennungen von Variablen, Tasks, Objekten) müssen in allen Stages (`project.stages`) aktualisiert werden, da diese eigene Objekt-Listen und FlowCharts führen können.

### [FlowCharts & Task-Diagramme](file:///c:/Users/rolfr/.gemini/antigravity/scratch/game-builder-v1/src/editor/FlowEditor.ts)
- **Doppelklick-Logik**: Standard-Doppelklick öffnet IMMER den Editor (Task/Action). Die Expansion von Tasks (Sub-Flow anzeigen) wurde vom Doppelklick entfernt und ist nur über das Kontextmenü möglich ("Ausklappen").
- **Speicherorte**: Flow-Diagramme können in `task.flowChart`, `project.flowCharts` oder `stage.flowCharts` liegen.
- **Task-Selektion**: Das Flow-Dropdown zeigt ALLE im aktuellen Scope (Stage oder Global) definierten Tasks an, auch wenn diese noch kein Flow-Diagramm besitzen. Dies erleichtert das Initialisieren neuer Diagramme für bestehende Tasks.

### [JSON Viewer & Isolated Stages](file:///c:/Users/rolfr/.gemini/antigravity/scratch/game-builder-v1/src/editor/Editor.ts)
Wenn eine Stage isoliert im JSON-Tab angezeigt wird (`activeStage`), werden globale Daten (Tasks UND Actions), die für diese Stage relevant sind (d.h. dort benutzt werden), manuell injiziert, damit sie bearbeitbar bleiben und vollständig sind.
- **Scoping & Refactoring**:
  - Beim Umbenennen (Refactoring) von Tasks, Aktionen oder Variablen müssen IMMER alle Scopes (`project.tasks/actions` UND alle `project.stages[].tasks/actions`) gescannt werden. Siehe `RefactoringManager.ts`.
  - Die isolierte JSON-Ansicht einer Stage (`Editor.refreshJSONView`) muss lokale Daten (`actions`, `tasks`) erhalten und darf sie nicht durch globale Listen überschreiben (Merge-Logik).
- **Re-rendering**: Änderungen an `TargetObjectSelect` oder `MethodSelect` im Action Editor MÜSSEN einen `this.render()` Aufruf in `updateModelValue` auslösen, damit die Parameter-Eingabefelder dynamisch regeneriert werden.
- **Expression Scoping**: Beim Erweitern der Dialog-Evaluation (`evaluateExpression`) darauf achten, dass alle benötigten Variablen (wie `dialogData`, `project`) explizit als Funktionsargumente übergeben werden. Direkter Zugriff auf Model-Eigenschaften ohne `dialogData.` Präfix führt zu ReferenceErrors, wenn sie nicht explizit in der Argumentliste stehen.
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
  - `tasks`, `actions`, `variables`, `stages`, `objects` und neu `services`.
- **Dialog-Expressions**:
  - Im `JSONDialogRenderer` müssen Variablen in Properties wie `source` zwingend mit `${...}` umschlossen werden (z.B. `"source": "${dialogData.images}"`), damit sie als Expression ausgewertet werden. Ohne `${}` wird der Wert als String-Literal behandelt.

## Namensgebung & Eindeutigkeit
- **Eindeutigkeit**: Namen für Variablen, Actions und Tasks müssen projektweit eindeutig sein.
- **Automatik**: Bei der Erstellung über den Flow-Editor wird automatisch eine laufende Nummer angehängt, falls der Name bereits vergeben ist (`generateUniqueActionName`, `generateUniqueVariableName`, `generateUniqueTaskName`).
- **PascalCase**: Tasks sollten stets in PascalCase benannt werden (z.B. `MoveAndJump`).

