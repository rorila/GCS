# Developer Guidelines

## Rendering & Game Loop
- **GameLoopManager (Singleton)**: Verwende den `GameLoopManager.getInstance()` für alle Spielobjekt-Updates und Kollisionsprüfungen. Er ist KEIN Stage-Objekt und umgeht somit Proxy-Binding-Probleme.
- **GameRuntime Authority**: Die `GameRuntime` ist die "Source of Truth" für den Spielzustand im Run-Modus.
- **Keine manuelle GameLoop-Init**: Der `Editor` darf den `TGameLoop` nicht manuell initialisieren (`init/start`). Die `GameRuntime.start()` Methode übernimmt dies via `GameLoopManager`.
- **Stage-Cleanup**: Bei jedem Stage-Wechsel MÜSSEN `ReactiveRuntime.clear()` und `AnimationManager.getInstance().clear()` aufgerufen werden, um persistente Objekte oder laufende Animationen der vorherigen Stage zu entfernen.
- **Render-Callback**: Übergib den Render-Callback (`onRender`) direkt an den `GameRuntime`-Konstruktor (`options.onRender`).
- **Proxy-Verwendung**: Verwende immer die Objekte aus `runtime.getObjects()` für das Rendering, da diese die reaktiven Proxies enthalten.
- **Migration**: Das Root-Level `objects` Array in Projektdateien ist veraltet. Objekte sollten ausschließlich innerhalb des `stages`-Arrays gespeichert werden. Nutze Migrationsscripte, um Redundanzen zu entfernen.

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

## Export-System
- **Formate**: Plain (lesbar) und gZip (komprimiert, ~70% kleiner).
- **gZip-Frontend**: `JSON → gzipSync (fflate) → Base64 → PROJECT_DATA` (HTML) oder `{_compressed: true, data: "..."}` (JSON). Siehe `GameExporter.ts`.
- **Runtime-Kompatibilität**: `player-standalone.ts` erkennt automatisch komprimierte Daten und dekomprimiert via `gunzipSync`.
- **Backend-Dekomprimierung**: Die Game Platform (`server.ts`) dekomprimiert hochgeladene, komprimierte JSONs on-the-fly (`zlib.gunzipSync`), um dem Spieler unabhängig vom Speicherformat immer valides JSON zu liefern.
- **Bibliotheken**: `fflate` im Frontend, `zlib` im Backend.

## Medien-Komponenten (TImage, TVideo)
- Alle Medienpfade werden relativ zum `./images/` Verzeichnis im Export-Bundle aufgelöst, sofern sie nicht mit `http`, `/` oder `data:` beginnen.
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

### Stage-spezifische Flow-Diagramme
- **Konzept**: Jede Stage kann eigene Landkarten, Elementeübersichten und Task-Diagramme besitzen.
- **Isolation**:
  - `generateEventMap` und `generateElementOverview` filtern Objekte basierend auf der aktiven Stage via `getCurrentObjects()`.
  - `loadFromProject` verhindert Fallbacks auf den globalen Flow, wenn eine spezifische Stage aktiv ist.
- **Speicherung**:
  - Global: `project.flowCharts` (für projektweite Logik).
  - Stage-spezifisch: `stage.flowCharts` (für lokale Stage-Logik).
- **Entscheidungslogik**: Der `FlowEditor` lädt bevorzugt aus dem `flowCharts`-Objekt der aktuellen `activeStageId`.
- **Globaler Sync**: `FlowEditor.syncAllTasksFromFlow` stellt sicher, dass alle Task-Abläufe (global und stage-spezifisch) synchron mit den JSON-Definitionen bleiben.

- **Dropdown Verhalten**: Alle Dropdowns im Action Editor sollten einen Platzhalter ("--- bitte wählen ---") verwenden, wenn noch kein Wert ausgewählt ist. Dies stellt sicher, dass jede Auswahl (auch die erste) ein `onchange` Event auslöst.
- **Dependency Resets**: Beim Ändern eines Primär-Feldes (z.B. Target Object oder Action Type) müssen abhängige Felder (z.B. Method Name) explizit gelöscht werden, um inkonsistente Zustände in der UI zu vermeiden.
- **Re-rendering**: Jede Änderung an einem zentralen `dialogData` Feld, die die Sichtbarkeit anderer Felder beeinflusst, erfordert einen expliziten Aufruf von `this.render()`.
- **Method Mapping**: Beim Hinzufügen neuer Komponenten-Klassen muss deren Methoden-Liste in `JSONDialogRenderer.getMethodsForObject` ergänzt werden, damit sie im Action Editor auftaucht.

## Actions & Expressions (Action Editor)
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

### [JSON Viewer & Isolated Stages](file:///c:/Users/rolfr/.gemini/antigravity/scratch/game-builder-v1/src/editor/Editor.ts)
Wenn eine Stage isoliert im JSON-Tab angezeigt wird (`activeStage`), werden globale Daten (Tasks UND Actions), die für diese Stage relevant sind (d.h. dort benutzt werden), manuell injiziert, damit sie bearbeitbar bleiben und vollständig sind.
- **Re-rendering**: Änderungen an `TargetObjectSelect` oder `MethodSelect` im Action Editor MÜSSEN einen `this.render()` Aufruf in `updateModelValue` auslösen, damit die Parameter-Eingabefelder dynamisch regeneriert werden.

## Library & Tasks
- **Library Export**: Nutze den Endpunkt `POST /api/library/tasks` für automatisierte Speichervorgänge in die `public/library.json`.
- **Dialog-Komponenten**: Neue UI-Elemente wie `TMemo` müssen im `DialogManager.ts` (renderObject, collectDialogData, populateDialogData) registriert werden, um in JSON-Dialogen korrekt zu funktionieren.
