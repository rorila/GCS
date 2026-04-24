# Changelog (v3.31.0 - Unreleased)

### 2026-04-24 (Bugfix: Fehlende Hover-Events für Buttons und Runtime-Engine)
- **Bugfix (Events)**: `onMouseEnter` und `onMouseLeave` (sowie `onDoubleClick`) fehlten in der Standard-Eventauswahl für UI-Komponenten (z.B. `TButton`) im Inspector und im Flow-Editor. Die abstrakte Basisklasse `TComponent` hat nun eine `getEvents()`-Methode erhalten, welche diese Events bereitstellt, und der Fallback in `ComponentRegistry.ts` wurde ebenfalls aktualisiert. Dadurch können Hover-Actions nun reibungslos angebunden werden.
- **Bugfix (Runtime Engine)**: Die konfigurierten Hover-Events wurden in der Runtime-Engine nicht ausgelöst. Der `StageRenderer` bindet nun dynamisch alle im Task/Event-Objekt hinterlegten Maus-Interaktionen (`onMouseEnter`, `onMouseLeave`, `onDoubleClick`) an die generierten DOM-Elemente und leitet sie korrekt über `onEvent` an das Backend weiter. Für `TButton` wurde der `TextObjectRenderer` entsprechend ergänzt, da dieser visuelle Filter überschreibt.
### 2026-04-23 (Bugfix: Runtime Freeze bei wiederholten Dialog-Interaktionen)
- **Bugfix (TToast Endlosschleife — CRITICAL):** Die App fror ein wenn mehr als `maxVisible` Toasts gleichzeitig angezeigt werden sollten. Ursache: `removeToast()` führte `Array.splice()` erst nach 300ms im `setTimeout`-Callback aus (für die CSS-Animation), aber `show()` prüfte `_toasts.length` in einer synchronen `while`-Schleife. Da die Länge synchron nie sank, entstand eine Endlosschleife. Fix: `splice()` wird jetzt sofort synchron ausgeführt, nur die DOM-Animation wartet im `setTimeout`.
- **Bugfix (PropertyWatcher GlobalListener — CRITICAL):** Nach einem Stage-Wechsel funktionierte das reaktive Rendering nicht mehr. Ursache: `PropertyWatcher.clear()` löschte auch die `globalListeners`, die die zentrale Rendering-Brücke zwischen `ReactiveRuntime` und `StageRenderer` bilden. Diese Listener werden einmalig im `GameRuntime`-Konstruktor registriert und müssen Stage-Wechsel überleben. Fix: `clear()` löscht jetzt nur object-spezifische Watchers, nicht die globalListeners.
- **Bugfix (Doppelte GameLoopManager-Initialisierung):** `handleStageChange` rief `glm.init()` auf und danach `this.start()` → `initMainGame()` → nochmals `glm.init()`. Das redundante `glm.init()` in `handleStageChange` wurde entfernt. Zusätzlich werden alte Objekte jetzt vor `this.start()` via `onRuntimeStop()` sauber heruntergefahren, um Timer-Leaks zu verhindern.
- **Cleanup:** Alle temporären Diagnose-Logs (`🔬 DIAG-CYCLE`, `🔬 STAGE-CHANGE`, `💥 Voll-Render`) aus `GameRuntime.ts` entfernt.

### 2026-04-23 (Bugfix: Inspector-Properties an Renderer anbinden)
- **Bugfix (Inspector-Properties):** Umfassende Bereinigung wirkungsloser Inspector-Felder in 5 Komponenten. Die Renderer (`ComplexComponentRenderer`, `createRuntimeElement()`) lesen nun die `style.*`-Properties (borderRadius, color, fontSize, fontWeight, fontFamily, fontStyle, textAlign, boxShadow) tatsächlich aus dem Objekt, statt hardcoded Werte zu verwenden. Betroffene Komponenten:
  - **TInfoWindow**: borderRadius, Textfarbe, Schriftgröße, Schriftgewicht, Schriftart, Textausrichtung, boxShadow werden nun konfigurierbar. Duplikat-Property `borderRadius` zugunsten von `style.borderRadius` entfernt.
  - **TDialogRoot**: borderRadius, Titelfarbe, Titel-Schriftgröße, Schriftgewicht, Schriftart werden nun aus style.* gelesen (Editor + Runtime).
  - **TSidePanel**: Titel-Schriftfarbe, -größe, -gewicht, -art werden nun konfigurierbar (Editor + Runtime).
  - **TToast**: Eigene Properties (fontSize, borderRadius, padding, textColor) synchronisieren nun mit style.* als Fallback.
  - **TStatusBar**: textColor, fontSize, fontFamily synchronisieren nun mit style.* als Fallback.
- **Bugfix (Variablen-Refactoring bei verschachtelten Bindings):** Bei der Umbenennung einer Variablen (Inspector/Variable-Manager) wurden String-Interpolationen (z.B. `${meineVariable}`) in Eigenschaften von tief verschachtelten Objekten (z.B. ein `TLabel` in einem `TGroupPanel`) oder von Blueprint-Objekten bisher ignoriert. Der `VariableRefactoringService` traversiert nun den gesamten Komponentenbaum inklusive aller globalen Objekte rekursiv über den aktualisierten Helper `RefactoringUtils.replaceInObjectRecursive`, wobei direkte Match-Ersetzungen per neuem `exactMatch`-Parameter für Variablen blockiert werden, um ungewollte Kollisionen mit Objektnamen zu verhindern.
- **Bugfix (Hover-Cursor bei Container-Komponenten):** Ein UX-Fehler wurde behoben, bei dem der Mauszeiger beim Hovern über eine interaktive `TGroupPanel` oder andere Container im Run-Modus fälschlicherweise als Text-Cursor (I-Beam) dargestellt wurde. Die Ursache lag im `TextObjectRenderer`, welcher für `TLabel` standardmäßig `cursor: text` und `userSelect: text` erzwang. Diese Werte wurden nun auf `cursor: inherit` und `userSelect: none` korrigiert. Dadurch erben die Labels nun sauber den `pointer`-Cursor des klickbaren Parents und lassen sich nicht mehr versehentlich markieren.
- **Bugfix (Font-Scaling Standalone-Player):** Ein Layout-Fehler wurde behoben, bei dem Text in Komponenten (TLabel, TPanel, TButton, Input-Felder) im IFrame-Runner abgeschnitten oder unverhältnismäßig riesig dargestellt wurde, wenn die Komponente keine explizite `fontSize` definiert hatte. Ursache war der Fallback auf den Browser-Standard (`16px`) anstelle des Editor-Standards (`14px`), der nach der CSS `transform: scale()` Skalierung zu abweichenden Zeilenumbrüchen führte. `TextObjectRenderer` und `InputRenderer` verwenden nun einheitlich einen Fallback von `14px`, bevor die Skalierung angewandt wird.
- **Bugfix (TInfoWindow/TDialogRoot Reactivity):** Ein Reaktivitäts-Desync wurde behoben, bei dem sich InfoWindow/Dialog nach dem Schließen über die internen OK/Cancel/Close-Buttons nicht mehr per Action öffnen ließen. Die Button-Event-Handler im `ComplexComponentRenderer` modifizieren nun via `ctx.host.runtime.getRawObject(obj.id)` das echte reaktive Proxy-Objekt statt der `getObjects()`-Spread-Kopie. Dadurch weiß das Backend wieder, dass die Fenster geschlossen wurden.
- **Bugfix (PropertyWatcher Logs):** Massive Log-Flut (`[Variable] *.style.opacity changed`) beim Wechseln der Stages im Debug-Log-Viewer behoben. `opacity` und `style.opacity` wurden als hochfrequente Animations-Properties deklariert (`HIGH_FREQ_ANIM_PROPS`) und werden nicht mehr sekündlich 60-mal für jedes animierte Objekt während des Fade-In-Übergangs in den Event-Log geschrieben.

### 2026-04-22 (Bugfixes: TInfoWindow Buttons & TGroupPanel Copy-Paste)
- **Bugfix (TInfoWindow):** OK- und Cancel-Buttons im RunMode schließen das Fenster nun sofort, indem sie neben `visible = false` auch direkt das DOM-Element und das modale Overlay auf `display: none` setzen. Zuvor blieb das Fenster sichtbar, da die reaktive Pipeline den StageRenderer nicht schnell genug zum Verstecken aufgefordert hat.
- **Bugfix (TGroupPanel Copy-Paste):** Beim Kopieren (Ctrl+C / Ctrl+V) und beim Ctrl-Drag eines TGroupPanels mit Kindern verschwanden die Children aus dem Original. Ursache war, dass die serialisierten Kinder-Objekte im DTO die gleichen IDs wie die Originale behielten, wodurch im Datenmodell zwei Eltern dieselben Kind-IDs beanspruchten. Fix: `onPasteCallback` und `onObjectCopy` vergeben nun rekursiv neue eindeutige IDs, `parentId`-Referenzen und Namen an alle Children (inkl. verschachtelter Kinder).

- **Bugfix (TInfoWindow):** Ein Fehler wurde behoben, bei dem das `TInfoWindow` nicht auf reaktive Status-Änderungen (z.B. über die Action "Eigenschaft ändern" `visible = true`) reagierte und im Editor-RunMode unsichtbar blieb. Die Komponente wurde nun korrekt in den `StageRenderer` (via `ComplexComponentRenderer`) integriert, sodass das Fenster als vollflächiges modales Overlay gerendert wird. Zudem wurden die fehlenden Events `onCancel`, `onConfirm` und `onAutoClose` für den Inspector registriert und korrekt in die Game-Engine (via `GameRuntime_Event`) geroutet.
- **Feature (Inspector):** `PropertyPickerDialog` eingeführt. Beim Klicken auf "Eigenschaft hinzufügen" (z.B. in Property-Actions) öffnet sich nun ein modaler Dialog, der alle konfigurierbaren Eigenschaften des Zielobjekts übersichtlich nach Gruppen (Sektionen) sortiert anzeigt.
- **Feature (Runtime):** Automatische Type-Coercion (String -> Number) bei reaktiven Bindings für numerische Eigenschaften wie Rahmenbreite hinzugefügt. Wenn eine Variable (z.B. aus einer TStringMap) einen numerischen String liefert und die Ziel-Eigenschaft eine Zahl erwartet (z.B. `borderWidth`, `Rahmenbreite`), wird der Wert nun automatisch umgewandelt. Dies verhindert Fehler im StageRenderer bei string-basierten Themes.
- **Bugfix (Editor Drag&Drop):** Behebung eines Drag-and-Drop Ausfalls im Editor und Flow-Editor beim Hineinziehen neuer Komponenten aus der Toolbox (HTML5 Drag-API). Ursache war die Tauri v2 Engine unter Windows (WebView2), deren nativer File-Drop-Interceptor das interne HTML-Dragging blockierte. Der native Interceptor wurde über `"dragDropEnabled": false` in der `tauri.conf.json` deaktiviert, wodurch das interne Ziehen von Elementen wieder einwandfrei funktioniert.

### 2026-04-21 (Feature: Sticky-Node Manager Tab)
- **Feature (Manager-Tab)**: Neue Projekt-Übersicht "Notizen" (`📝`) hinzugefügt. Sie sammelt vollautomatisch alle `TStickyNote` Objekte aus den Editor-Stages sowie sämtliche Flow-Notizen (Kommentare) aus allen Diagrammen. Notizen werden nach Typ (Stage vs. Flow) getrennt und dann nach Kategorie-Farbe (Information, Erfolg, Struktur, Achtung) gruppiert dargestellt. Per Klick springt der Editor und Flow-Viewer automatisch zur richtigen Stage/FlowChart und wählt die Notiz an.
- **Bugfix**: Fehlende Typisierung von `el.data` in Custom-FlowElements behoben.
- **Bugfix**: Regression in `EditorViewManager.ts` behoben, bei der das Anklicken von Variablen (ohne ID) und Actions im Manager nicht funktionierte (fälschlicherweise als Flow-Charts klassifiziert). Sie laden jetzt korrekt im StageInspector.
- **Bugfix (Kritisch)**: Manager-Tab zeigte leere Tabellen für Tasks, Actions, Variables und FlowCharts. Ursache: `coreStore.activeStageId` wurde in `FlowEditor.switchActionFlow()` auf `null` gesetzt (bei globalem Task-Kontext). `renderManagementView()` hat dann kein Stage-Objekt erhalten und den gesamten Tabellen-Block übersprungen. Fix: Robuster Stage-Fallback auf Blueprint-Stage oder erste verfügbare Stage.
- **Bugfix**: `handleManagerRowClick` für Actions/Variables ruft nun kein `switchView('stage')` mehr auf. Actions und Variablen sind keine visuellen Stage-Objekte und der View-Wechsel löste unnötige Sync-Zyklen aus, die bei gleichnamigen Actions zu Datenverlust führen konnten.

## [Unreleased]

### ✨ Features & UI
- **Manager-Tab (Scope-Umschalter)**: Die Manager-Ansichten (Tasks, Aktionen, Variablen, Ablaufdiagramme, Visuelle Objekte) verfÃƒÂ¼gen nun ÃƒÂ¼ber ein neu integriertes Dropdown-MenÃƒÂ¼ im Header. Nutzer kÃƒÂ¶nnen flexibel zwischen der "Aktuelle Stage"-Ansicht und dem gesamten "Projekt"-Scope umschalten. Dies ermÃƒÂ¶glicht einen globalen ÃƒÅ“berblick ÃƒÂ¼ber alle Projektressourcen, inklusive intelligenter Standort-Kennzeichnung (📍 Stage: xyz) fÃƒÂ¼r dezentrale Elemente.
- **Manager-Tab (Redesign)**: Das Listen-Design im Manager-Tab (Tasks, Actions, Variablen, FlowCharts, Stages) wurde komplett modernisiert. Anstelle von reinen HTML-Tabellen werden die Elemente nun als interaktive Cards im "Notizen"-Design gerendert (mit Farb-Akzenten, Hover-Animationen und ÃƒÂ¼bersichtlicherem Spalten-Layout). ZusÃƒÂ¤tzlich zeigen alle UI-Cards nun direkt in der ersten Zeile unter dem Namen ihren exakten Standort an (📍 Globale Ebene, Stage, Lokal oder System-Bibliothek).
### 🐛 Bug Fixes
- **Manager-Tab (Ablaufdiagramme)**: Behebung eines Fehlers, der dazu führte, dass die Liste der Ablaufdiagramme leer blieb. Nach der internen Migration (FlowCharts zu Tasks `flowLayout`) liefert `MediatorService.getFlowCharts()` nun wieder alle regulären Tasks als Ablaufdiagramme aus.
- **Manager-Tab (Variablen)**: `VariableRegistry` durchsucht nun neben `stage.variables[]` auch erzeugte visuelle Objekte in `stage.objects[]` nach Variablen (Option A aus Implementation Plan), wodurch Blueprint-platzierte Variablen im Manager wieder korrekt gelistet werden.
- **Manager-Tab (Render-Lifecycle)**: Behebung eines kritischen Fehlers in der Funktion `renderManagementView()`, der dazu führte, dass die Tabellen komplett ausgeblendet wurden, wenn `coreStore.activeStageId` gleich `null` war. Nun wird der Fallback zur Blueprint-Stage verwendet.
- **Manager-Tab (Navigation)**: Korrektur von `handleManagerRowClick()`. Das Selektieren logischer Objekte (Actions, Variablen) triggert nun keine fehlerhaften `switchView('stage')` Events mehr. Dadurch werden redundante Synchronisations-Zyklen vermieden, die zuvor teilweise zum Datenverlust beim Umbenennen von Actions geführt haben.

### 2026-04-19 (Security Hardening Phase 1 & 2 & Technical Debt Cleanup)
- **Security (XSS)**: Kritische XSS-Gefahr beim Standalone HTML-Export (standalone-export) behoben. `generateStandaloneHTML` in `GameExporter.ts` nutzt nun ein konsequentes Escaping fÃ¼r `</script>`-Tags, das Breakouts aus `type="application/json"` verhindert.
- **Security (Electron Sandbox & Policy)**: Electron-Main (`main.cjs`) massiv gehÃ¤rtet:
  1. `session.defaultSession` erzwingt nun strenges Content-Security-Policy (CSP) Headersetting.
  2. `will-navigate` Handle eingefÃ¼hrt um willkÃ¼rliche External-Navigations im IFrame/Main-Window zu blockieren.
  3. Window.open (Exfiltration) wird explizit durch `setWindowOpenHandler` gecancelt.
  4. Die IPC-Bridge fÃ¼r `fs:allowPath` validiert nun den Zielpfad aktiv gegen eine Whitelist-Basis (`appPath`, `userData`, `cwd`), um Directory-Traversal Attacken (`../../../windows/system32`) restlos zu verhindern.
- **Security (RCE LÃ¼cke)**: Den hochkritischen Arbitrary-Code-Execution (S-02) Vektor in `DialogExpressionEvaluator.ts` geschlossen. Statt `new Function()` wird nun exklusiv der AST-basierte JSEP-Parser (`ExpressionParser`) genutzt. Dem `ExpressionParser` wurde via `allowedCalls` die MÃ¶glichkeit verliehen, sichere, editor-spezifische Methode (wie `ServiceRegistry.get`) punktgenau zu erlauben.
- **Refactoring (Logger Migration)**: Alle restlichen `console.warn`/`console.error`/`console.log` Debugging-Ausgaben im Quellcode (`GameRuntime`, `ReactiveRuntime`, `ProjectStore`, `StageInteractionManager`, `MultiplayerManager`, `SchemaLoader`) auf den zentralisierten Logger-Service umgestellt.
- **Refactoring (Dead Code)**: Alte Stubs (`src/stubs/node-stub.ts`), der veraltete Engine-Ordner `src/engine/` und vÃ¶llig ungenutzte Generierungsmethoden im `PascalGenerator` wurden entfernt.
- **Bugfix (TSidePanel Tests)**: Fehlerhafte NodeJS Referenz auf das DOM-Objekt `document` im Property-Watcher (`updateRuntimeVisibility`) von `TSidePanel` mit einem Typ-Check abgefangen (Tests sind wieder komplett grÃ¼n).

### 2026-04-19 (Bugfix Root-Cause: Dialog-SchlieÃŸen â€“ runtime-Referenz zu frÃ¼h gesetzt)
- **Bugfix (EditorRunManager.ts)**: `runStage.runtime = this.runtime` wurde auf Zeile 92 gesetzt â€” zu einem Zeitpunkt wo `this.runtime` noch `null` war (GameRuntime wird erst auf Zeile 108 erstellt). Dadurch war `ctx.host.runtime` im `ComplexComponentRenderer` immer `undefined`, was dazu fÃ¼hrte, dass der X-Button `visible=false` auf einer Spread-Kopie statt auf dem echten reaktiven Master-Objekt setzte.
  - *Symptom*: `getRawObject gefunden: false, runtime vorhanden: false` â€” der close-btn mutierte die falsche Referenz.
  - *LÃ¶sung*: `runStage.runtime = this.runtime` nach der `new GameRuntime(...)` Erstellung gesetzt (Zeile ~163). AuÃŸerdem `private runtime` in `UniversalPlayer` auf `public` geÃ¤ndert damit `StageHost`-Interface kompatibel bleibt.
  - *Betroffene Dateien*: `src/editor/services/EditorRunManager.ts`, `src/player-standalone.ts`, `src/editor/services/StageRenderer.ts`

### 2026-04-19 (Bugfix: Dialog/SidePanel X-SchlieÃŸen synchronisiert Backend nicht)

- **Bugfix (ComplexComponentRenderer + GameRuntime)**: Das SchlieÃŸen eines modalen Dialogs oder SidePanels per X-Button setzte `visible=false` auf einer Spread-**Kopie** des Objekts (aus `getObjects()`), nicht auf dem echten reaktiven Proxy-Objekt in `GameRuntime.this.objects`. Dadurch blieb `visible=true` im Backend erhalten, was beim nÃ¤chsten Toggle-Klick einen fehlerhaften State-Flip verursachte (Dialog erschien nicht beim 1. Klick).
  - *Ursache*: `getObjects()` gibt `{ ...obj }` Shallow-Copies zurÃ¼ck (fÃ¼r absolute KoordinatenauflÃ¶sung). Mutationen auf diesen Kopien werden vom `PropertyWatcher`/`ReactiveProperty` **nicht** registriert.
  - *LÃ¶sung*: Neue Methode `GameRuntime.getRawObject(id)` gibt das echte reaktive Proxy-Objekt direkt aus `this.objects` zurÃ¼ck. `ComplexComponentRenderer` nutzt jetzt diese Methode im X-Button Handler anstelle von `getObjects().find()`.
  - *Betroffene Dateien*: `src/runtime/GameRuntime.ts`, `src/editor/services/renderers/ComplexComponentRenderer.ts`
- **Chore (Stage.ts + EditorRunManager.ts)**: `Stage` erhÃ¤lt eine optionale `runtime?: any` Property. `EditorRunManager` injiziert beim Erstellen der Run-Stage die aktive `GameRuntime`-Referenz.

### 2026-04-18 (Bugfix: Flache parentId-Kinder im Run-Modus unsichtbar)

- **Bugfix (GameRuntime.getObjects)**: Objekte, die per `parentId`-Referenz auf einen Container verweisen (z.B. TGroupPanel-Kinder aus flachen JSON-Definitionen), aber NICHT im `children`-Array des Containers stehen, wurden im Run-Modus komplett verschluckt und nicht gerendert.
  - *Ursache*: `getObjects()` filterte alle Objekte mit `parentId` aus der `topLevelObjects`-Liste. AnschlieÃŸend rekursierte es nur Ã¼ber `obj.children`-Arrays. Da flache JSON-Definitionen (wie im Tutor-Projekt) die Kinder nicht als verschachteltes `children`-Array, sondern als eigenstÃ¤ndige Objekte mit `parentId` auf der gleichen Ebene speichern, wurden diese Objekte nie in die `results`-Liste aufgenommen.
  - *Auswirkung*: Im Edit-Modus war alles korrekt (dort verwendet `getResolvedInheritanceObjects()` alle Objekte flach). Im Run-Modus verschwanden alle flachen parentId-Kinder.
  - *LÃ¶sung*: Nach der children-Rekursion werden alle â€žverwaisten" Objekte (mit `parentId`, aber nicht Ã¼ber `children` erreicht) nachtrÃ¤glich gesammelt und mit korrekter Getter-Kopie und zIndex-Berechnung in die Ergebnisliste aufgenommen. Der StageRenderer lÃ¶st dann wie gewohnt die parentId-Kette fÃ¼r die absolute Positionierung auf.
  - *Datei*: `src/runtime/GameRuntime.ts` (Methode `getObjects`)

### 2026-04-18 (Bugfix: Stage Transition Animations in Run-Mode)
- **Bugfix (Start-Animations Timing)**: Ein gravierender Fehler wurde behoben, bei dem die Start-Animationen der BÃ¼hne (Fade-In, Slide, Positional) nach dem Wechsel vom Editor in den Run-Modus ("Run" Button) anfangs Ã¼berhaupt nicht abgespielt wurden.
  - *Ursache 1 (Fehlender Aufruf)*: Die Methode `triggerStartAnimation` wurde zuvor aus der initialisierenden `initMainGame()`-Methode entfernt. Dadurch wurden die Startanimationen fÃ¼r das erste Frame des Projekts nie angestoÃŸen, es sei denn, man wechselte nachtrÃ¤glich die BÃ¼hne zur Laufzeit (via `handleStageChange`).
  - *Ursache 2 (Default JSON Fallback)*: Der Check in `GameRuntime` auf die Existenz der Animation war strikt (`this.stage?.startAnimation`). Da Stages standardmÃ¤ÃŸig keine Speicherung des `startAnimation`-Werts im JSON anlegen (sofern der Nutzer im Inspektor keinen Typ manuell auswÃ¤hlt), evaluierte die PrÃ¼fung bei Default-Konfigurationen fÃ¤lschlicherweise auf falsy und ignorierte den eingebauten `fade-in` Fallback komplett.
  - *Ursache 3 (Style vs Opacity Kollision)*: Hatte eine Komponente im Runtime zwar visuelle Styling-Attribute (wie `color: 'red'`), jedoch noch keine explizit gesetzte Deckkraft (`opacity`), animierte das System standardmÃ¤ÃŸig die Root-Property `obj.opacity = 0`. Der `StageRenderer` ignoriert bei vorhandenem DOM-Style-Objekt jedoch die Root-Property, sodass das Element sofort sichtbar auf 100% einrastete und den visuellen Fade-In komplett unterdrÃ¼ckte.
  - *LÃ¶sung*: Die Initialisierung der Animation (inklusive des zwingend nÃ¶tigen Fallbacks) ist zurÃ¼ck im initialen `GameRuntime.start()` Lebenszyklus eingehÃ¤ngt. AuÃŸerdem targeten Opacity-Animationen jetzt immer strikt die `style.opacity`-Property, solange ein `style`-Block im Objekt existiert.
  - *Dateien*: `src/runtime/GameRuntime.ts`, `src/editor/services/StageRenderer.ts`, `src/editor/services/EditorRunManager.ts`

### 2026-04-18 (Feature: TDialogRoot Runtime Logic)
- **Feature (Dialog-Eigenschaften)**: Die in der TDialogRoot-Komponente deklarierten Eigenschaften `modal`, `closable`, `draggableAtRuntime` und `centerOnShow` wurden im `ComplexComponentRenderer` fÃ¼r den Run-Modus implementiert.
  - *Modal*: Es wird ein Overlay-Div via `document.createElement` unterhalb des Dialogs erzeugt. Ein Fehler, bei dem Z-Indizes von Dialog und Overlay durcheinander gerieten und das Overlay den Dialog blockierte, wurde behoben. Der Dialog erhÃ¤lt jetzt immer einen garantierten, hÃ¶heren Z-Index (Default 20000) als sein Overlay (19999). ZusÃ¤tzlich wird der Z-Index aller Child-Elemente gezielt angehoben (20001), da sie andernfalls vom Modal-Overlay verschluckt und unklickbar blieben.
  - *Closable*: In der Titelleiste wird bei Sichtbarkeit automatisch ein `âœ•`-Button eingefÃ¼gt, der den Dialog bei Klick schlieÃŸt (`obj.visible = false`).
  - *Draggable*: Manuelles Setzen des Positionierungs-Anchors (`obj.x` und `obj.y`) im Grid-System via Pointer-Events (`onpointerdown/move/up`), sodass der Dialog mitsamt reaktiver Update-Schleife der Runtime bewegt wird.
  - *Center on Show*: Wechselt der Dialog-Status auf `visible = true`, errechnet das Grid-System dynamisch die BÃ¼hne-Mitte in **Gitter-Zellen (Cells) statt Pixeln** (`Math.floor` vor der ZellengrÃ¶ÃŸenberechnung, um Fraktionen zu meiden). Der Fehler, dass Parent-Dialoge nicht wanderten (nur deren Children zentrierten sich), wurde behoben: Anstatt fehlerhaft `style.left/top` zu verwenden â€“ das sich mit der Run-Mode `style.translate` Position addierte und den Dialog ans falsche Ende verschob â€“, wird nun exklusiv die `translate`-Property des Parents Ã¼berschrieben.
- **Bugfix (Runtime Rendering â€” Erstaufruf)**: Behebung eines kritischen Layout-Fehlers, bei dem Kind-Komponenten in Containern (TGroupPanel, TPanel) beim ersten Laden einer Stage nicht sichtbar waren, aber beim zweiten Aufruf korrekt gerendert wurden.
  - *Ursache*: Drei zusammenhÃ¤ngende Probleme:
    1. **Global-Listener Shortcut**: Im `GameRuntime`-Konstruktor fing der `onComponentUpdate`-Shortcut `x`/`y`-Ã„nderungen von Containern ab und rief `updateSingleObject()` auf, das **keine PositionsÃ¤nderungen** verarbeitet. Der `return` verhinderte den Full-Render. Beim 2. Aufruf (`handleStageChange`) fehlte dieser Shortcut, daher funktionierte es dort.
    2. **GLM Fast-Path**: Der `GameLoopManager` nutzte den `spriteRenderCallback`-Fast-Path (`updateSpritePositions`), der `obj.x * cellSize` direkt berechnet, ohne die Parent-Chain fÃ¼r Kinder rekursiv aufzulÃ¶sen. Da alle DOM-Elemente flache Geschwister sind (kein DOM-Nesting), bewegen sich Kinder NICHT automatisch mit dem Parent.
    3. **IFrame-Bundle veraltet**: Das pre-built IIFE-Bundle `public/runtime-standalone.js` fÃ¼r den IFrame-Runner wurde nicht automatisch vom Vite Dev-Server aktualisiert und musste manuell neugebaut werden.
  - *LÃ¶sung*:
    - `GameRuntime.ts`: `needsFullRender = true` wenn `x`/`y` eines Objekts mit `children` sich Ã¤ndert â†’ Full-Render statt `updateSingleObject`
    - `GameLoopManager.ts`: `hasContainerAnimation`-Check â†’ Full-Render statt Fast-Path wenn animierte Objekte Kinder haben
    - Runtime-Bundle neugebaut (`npx vite build --config vite.runtime.config.ts`)
  - *Fixed*:
    - **Dialog State Desync (Run Mode & StageRenderer):** Behoben, dass das SchlieÃŸen eines `TDialogRoot` oder `TSidePanel` Ã¼ber das 'X' den Master-Zustand des Objekts in der `GameRuntime` nicht aktualisierte, wodurch ein anschlieÃŸender Klick auf eine Toggle-Aktion erst beim zweimaligen BetÃ¤tigen funktionierte. Der Workaround, der auf eine Proxy-Umgehung basierte, wurde entfernt.
    - **SidePanel Resurrection Bug:** Behoben, dass beim SchlieÃŸen eines Dialogs per 'X' und dem anschlieÃŸenden Anzeigen eines SidePanels der zuvor versteckte Dialog wieder sichtbar wurde, was an divergenten Master-/Clone-Statuten im `StageRenderer` lag.
  - *Dateien*: `src/runtime/GameRuntime.ts`, `src/runtime/GameLoopManager.ts`, `public/runtime-standalone.js`

### 2026-04-17 (Bugfix: Animations-Drift bei Stage-Transitionen)
- **Bugfix (Koordinaten-Drift nach Stage-Animation)**: Behebung eines kritischen Layout-Fehlers, bei dem Komponenten innerhalb von Container-Elementen (TGroupPanel, TPanel, TDialogRoot) nach positionsbasierten Stage-Animationen (slide-up, Fly-Patterns) an falschen absoluten Positionen landeten. 
  - *Ursache*: `triggerStartAnimation()` iterierte Ã¼ber die flache Objekt-Liste (`flattenWithChildren`) und animierte Kind-Elemente mit eigenen absoluten Startpositionen. Da deren x/y-Koordinaten aber **relativ** zum Parent sind und der `StageRenderer` die absoluten Positionen rekursiv Ã¼ber die `parentId`-Kette berechnet, entstand ein doppelter Offset: Das Kind flog eigenstÃ¤ndig von Off-Screen ein, wÃ¤hrend der StageRenderer zusÃ¤tzlich den animierten Parent-Offset addierte.
  - *LÃ¶sung*: Objekte mit `parentId` werden bei positionsbasierten Animationen Ã¼bersprungen. Sie bewegen sich automatisch mit ihrem animierten Parent-Container mit. Opacity-Animationen (fade-in) bleiben fÃ¼r alle Objekte aktiv, da die DOM-Elemente flach im Stage-Container liegen und CSS-Opacity nicht kaskadiert.
  - *Datei*: `src/runtime/GameRuntime.ts` (Methode `triggerStartAnimation`)

### 2026-04-16 (Stage Data Persistence Hotfix)
- **Bugfix (Leere Objekte nach Stage Import)**: Ein kritischer Datenverlust-Bug wurde behoben, bei dem BÃ¼hnen-Objekte nach einem Stage-Import im Projekt als leeres Array (`"objects": []`) gespeichert wurden.
  - *Ursache*: In Produktions-Builds minimiert der Bundler `constructor.name` zu kurzen Strings wie `"$t"`. Bei manueller Instanziierung via `ComponentRegistry.createInstance()` erbte die Instanz diesen Namen, woraufhin die spÃ¤tere Speicherungs-Serialisierung (`toDTO()`) ihn in die Projekt-JSON schrieb. Beim nÃ¤chsten Ladevorgang konnte `hydrateObjects` die Klasse `"$t"` nicht finden und lÃ¶schte folglich alle derartigen Objekte. 
  - *LÃ¶sung*: `EditorStageManager` nutzt nun beim Import die komplette Logik von `hydrateObjects()`. Zudem zwingt `ComponentRegistry.createInstance()` neue Instanzen dazu, stets den originalen `className`-Bezeichner (aus der Registrierung) zu nutzen und so den Minifier-Schutz aus der Haupt-Deserialisierung auch auf alle dynamisch erzeugten Laufzeitobjekte zu Ã¼bertragen.
- **UI Verbesserung**: Das Dropdown-MenÃ¼ fÃ¼r Stages im Top-MenÃ¼ sowie **alle Kontext-MenÃ¼s (Rechtsklick) im gesamten Projekt** haben nun eine maximale HÃ¶he (`80vh` bzw. `60vh`) und eine native Scrollbar (`overflow-y: auto`), damit lange Listen (wie Stages, Tasks oder Actions) nicht mehr unten aus dem Bildschirm herausschneiden.

### 2026-04-16 (Feature / Bugfix)
- **Bugfix (Z-Index der System-Dialoge)**: Der `ConfirmDialog` und `PromptDialog` wurden hinter Editor-Modals (wie der Stage-Verwaltung) versteckt, da deren Z-Index zu niedrig (`10000`) gegenÃƒÂ¼ber den Editor-MenÃƒÂ¼s (`20000`) war. Der Z-Index fÃƒÂ¼r alle modalen Dialoge und Toasts wurde auf `99999` bzw. `999999` erhÃƒÂ¶ht, um sicherzustellen, dass LÃƒÂ¶schbestÃƒÂ¤tigungen immer im Vordergrund liegen.
- **Bugfix (Stage Import Cache)**: Fehler behoben, bei dem importierte Stages im Standalone-Run-Modus (IFrame) nicht auftauchten, da die Projektdaten nach dem Import nicht automatisch im LocalStorage-Cache (`autoSaveToLocalStorage`) persistiert wurden.
- **Stage Import UX Verbesserung**: Eine "Alle auswÃƒÂ¤hlen" Checkbox wurde zum Import-Dialog fÃƒÂ¼r Stages hinzugefÃƒÂ¼gt, mit der Nutzer nun mit einem Klick alle Checkboxen auf einmal ab- oder anwÃƒÂ¤hlen kÃƒÂ¶nnen.

### 2026-04-13 (Architectural Feature)
- **Flow-Action 'Theme (TStringMap) laden' eingefÃƒÂ¼hrt**: Das Umschalten von String-Bibliotheken (Themes) wird nun nicht mehr ÃƒÂ¼ber abstrakte Code-Routinen, sondern komfortabel ÃƒÂ¼ber die neue Dropdown-Aktion \Theme (TStringMap) laden\ konfiguriert. Beide Parameter (Ziel und Quelle) haben im Editor dedizierte Dropdowns mit Objektlisten, was Fehleingaben ausschlieÃƒÅ¸t.

### 2026-04-12 (Feature)
- **Theme-Umschaltung via TStringMap**: Die Aktion \LoadFromOtherStringMap\ wurde zur Komponente \TStringMap\ hinzugefgt. Damit lsst sich zur Laufzeit ein Set von String-Werten (z.B. ein komplettes Theme) in eine aktive Map berschreiben, wodurch gebundene Komponenten sich sofort anpassen.

### 2026-04-12 (Hotfix 2)
- **Bugfix (Stage Background im Editor)**: Ein FlÃƒÂ¼chtigkeitsfehler im vorherigen Rendering-Fix (EditorRenderManager.ts) wurde korrigiert. 
esolveObjectPreview gibt ein geklontes Objekt zurÃƒÂ¼ck, anstatt das Argument zu formen. Dies fÃƒÂ¼hrte dazu, dass der Hintergrund weiterhin als reiner String interpretiert wurde. Der Zuweisungsfehler wurde behoben.

### 2026-04-12 (Hotfix)
- **Bugfix (PropertyHelper / Editor-Interpolation)**: Es wurde ein Fehler behoben, bei dem TStringMap im Editor-Design-Modus nicht als Variable entpackt und deshalb als \undefined\ berechnet wurde. Der Grund dafr war, dass DTOs aus dem Blueprint-Stage-Kontext kein \isVariable\ Eigenschafts-Flag bestitzen. \PropertyHelper.resolveValue()\ und \getPropertyValue\ werten den className 'TStringMap' nun zuverlssig aus, sodass EintrÃƒÂ¤ge in .entries korrekt fr Farben und Live-Vorschauen im Designer gefunden werden.

### 2026-04-12
- **Bugfix (Reactive Bindings & IFrame Rendering)**: Fehler behoben, bei dem die reaktiven Style-Bindings (z.B. ${MainThemes.color}) im IFrame-Player nur fÃƒÂ¼r den TButton, aber nicht fÃƒÂ¼r TShape oder den Stage-Hintergrund (grid) aktualisiert wurden. Dies lag daran, dass GameRuntime.bindObjectProperties() bei der Suche nach Expressions rekursiv nur style, events und Tasks traversierte, was den grid-Knoten und andere Properties ignorierte.
- **Wichtig**: Um sicherzustellen, dass IFrame-Ãƒâ€žnderungen an der Runtime Anwendung finden, wurde public/runtime-standalone.js fÃƒÂ¼r den Run(IFrame)-Modus per npm run bundle:runtime neu gebÃƒÂ¼ndelt.

### 2026-04-09
- **Refactoring (Speicher-Logik)**: Die doppelte Speicher-Logik im `EditorDataManager` (`saveProjectToFile` und `saveProjectAs`) wurde entfernt. Zuvor umging der EditorDataManager den `ProjectPersistenceService` und rief bei Electron oder Native File System Access die APIs direkt auf. Nun wurde ein Getter (`getNativeAdapter()`) im `ProjectPersistenceService` exponiert. Der `EditorDataManager` nutzt ausschlieÃƒÆ’Ã…Â¸lich den NativeAdapter (`nativeAdapter.save()`). Dies zentralisiert die Speicherlogik, behebt redundanten Code und erleichtert kÃƒÆ’Ã‚Â¼nftige Systemerweiterungen.
- **Security Bugfix (Path Traversal)**: Eine SicherheitslÃƒÆ’Ã‚Â¼cke in der Electron-Bridge (`electron/main.cjs`) wurde geschlossen. Bisher akzeptierten die IPC-Handler `fs:readFile` und `fs:writeFile` jeglichen absoluten Dateipfad, was theoretisch arbitrary File Read/Write fÃƒÆ’Ã‚Â¼r jedes bÃƒÆ’Ã‚Â¶sartige Skript im Renderer-Prozess erlaubte. Es wurde ein Sandbox-Mechanismus (`isPathAllowed`) eingefÃƒÆ’Ã‚Â¼hrt: Zugriffe sind nur noch in den System-Verzeichnissen der App (UserData, AppPath, CWD, Temp) erlaubt, oder wenn der Pfad zuvor explizit ÃƒÆ’Ã‚Â¼ber einen User-ausgelÃƒÆ’Ã‚Â¶sten nativen File-Dialog (`fs:showOpenDialog` oder `fs:showSaveDialog`) freigegeben wurde.
- **Bugfix (Electron app exit)**: Behebt das Problem, dass sich die Electron-App bei vorhandenen ungespeicherten ÃƒÆ’Ã¢â‚¬Å¾nderungen nicht schlieÃƒÆ’Ã…Â¸en lieÃƒÆ’Ã…Â¸. Bisher hÃƒÆ’Ã‚Â¤ngte sich der SchlieÃƒÆ’Ã…Â¸vorgang aufgrund der fehlenden Reaktion auf das `will-prevent-unload`-Event durch `e.returnValue` auf. In der `electron/main.cjs` wurde nun ein nativer `dialog.showMessageBoxSync` hinzugefÃƒÆ’Ã‚Â¼gt, sodass Nutzer auf Wunsch das Unload erzwingen kÃƒÆ’Ã‚Â¶nnen (`event.preventDefault()`).
- **Bugfix (MediaPicker Electron)**: Fehler behoben, welcher dazu fÃƒÆ’Ã‚Â¼hrte, dass die Audio- und Image-Ordner im Electron Build scheinbar leer waren. Ursache war ein HTTP Fetch mit absolutem Pfad (`/media-manifest.json` und `/images`), der im Packaged-Environment (`file://`) Root-Pfade ansprach anstatt den lokalen dist-Ordner. Die Pfade im `MediaPickerDialog` wurden auf relative Pfade (`./media-manifest.json`, `./images`) umgestellt.
- **Build (Vite)**: Das Vite Build-Skript `vite.config.ts` wurde korrigiert. Die Datei `src/player-standalone.ts` (die `runtime-standalone.js` erzeugt) wurde aus dem `rollupOptions.input` ausgetragen. Vorher hat der `vite build` Schritt das von `esbuild` generierte IIFE-Bundle im `dist/`-Verzeichnis durch ein neu transpiliertes ES-Modul ÃƒÆ’Ã‚Â¼berschrieben. Da ES-Module durch CORS-Restriktionen ÃƒÆ’Ã‚Â¼ber das `file://`-Protokoll in Electron nicht laufen (und `iframe-runner.html` kein `type="module"` Tag verwendet), fÃƒÆ’Ã‚Â¼hrte das zum `Error: Runtime-Standalone fehlt!`. Vite kopiert nun ausschlieÃƒÆ’Ã…Â¸lich das funktionierende IIFE-Bundle.
- **Build (Electron)**: Die `target`-Option in `package.json` wurde von `"portable"` auf `"dir"` geÃƒÆ’Ã‚Â¤ndert, um Konflikte mit Microsoft Smart App Control (SAC) zu vermeiden. Die Portable-Version (ein selbstentpackendes Archiv, das in den temporÃƒÆ’Ã‚Â¤ren Windows-Ordner extrahiert) wird von den Windows-Sicherheits-Heuristiken oft fÃƒÆ’Ã‚Â¤lschlicherweise als Schadsoftware eingestuft und blockiert, wenn kein Codesigning-Zertifikat vorhanden ist. Der `dir`-Build erzeugt stattdessen ein simples Verzeichnis mit einer direkten `.exe`.
### 2026-04-12
- **Feature (TRichText)**: TRichText unterstÃƒÆ’Ã‚Â¼tzt nun Inline-Links (`<a>`), die visuell abgesetzt werden. Im Editor-Modus sind sie nicht navigierbar. Im Run-Modus routet das Anklicken von `stage:ID`-Links das native Runtime-Event `__SYSTEM_NAVIGATE__` an den `GameRuntime.handleEvent()` Handler. Dadurch verhalten sich Inline-Links identisch zur regulÃƒÆ’Ã‚Â¤ren Stage-Navigation via `NavigationActions`, wobei der Wechsel nahtlos vom `UniversalPlayer` (Standalone) oder `EditorRunManager` (Editor) ausgefÃƒÆ’Ã‚Â¼hrt wird.
- **Bugfix (RichTextEditorDialog)**: Die Selektions-Auswahl (Range) ging beim ÃƒÆ’Ã¢â‚¬â€œffnen des Link-Modals verloren. Dies wurde behoben, indem wir die Selektion vor dem ÃƒÆ’Ã¢â‚¬â€œffnen speichern, den Fokus auf das Eingabefeld lenken, und beim SchlieÃƒÆ’Ã…Â¸en des Modals die gesicherte Range vor dem AusfÃƒÆ’Ã‚Â¼hren des `document.execCommand('createLink')` reaktivieren.

### 2026-04-16
- **Bugfix (Inspector)**: Behebung eines Fehlers, bei dem sich Tasks im Flow-Editor bzw. Inspector nicht mehr umbenennen lieÃŸen. Da Tasks im Datenmodell keine UUID besitzen, schlug die ID-basierte Suche in `EditorCommandManager.renameObject` mit `undefined` fehl. Dies wurde korrigiert, indem auf den bisherigen Namen (oldValue) als Fallback-Identifikator zurÃ¼ckgegriffen wird (`update.object.id || update.oldValue`).
- **Bugfix (Runtime Layer)**: TDialogRoot Slides/Animationen wurden zur Laufzeit nicht mehr ausgefÃ¼hrt, wenn die Eigenschaft *visible* per Action geÃ¤ndert wurde. Ursache: Die ReactiveRuntime delegierte das Update an das performante `StageRenderer.updateSingleObject()`, welches nur Hintergrund/Farben updatet. FÃ¼r Dialog-Animationen und deren Kinder wurde nun ein Full-Render Fallback (in `GameRuntime.ts`) konfiguriert.
- **Bugfix (FlowEditor)**: Behebung eines Fehlers, bei dem die Umbenennung eines Tasks dazu fÃ¼hrte, dass fÃ¤lschlicherweise in die ElementenÃ¼bersicht gesprungen wurde, da das Dropdown-MenÃ¼ durch den `Safety Check` vorzeitig aktualisiert wurde, noch bevor das Projekt-Modell die NamensÃ¤nderung reflektiert hatte.
- **Bugfix (FlowEditor)**: In der Landkarte (Event-Map) wurden an Kind-Komponenten (z.B. Buttons in TGroupPanel/TDialogRoot) angebundene Tasks nicht angezeigt. `FlowEditor.getCurrentObjects()` wurde so refakturiert, dass durch eine Rekursion alle verschachtelten UI-Objekte transparent an die Landkarte geliefert werden.



- **Refactoring (GameRuntime)**: Aufteilung des 1140-Zeilen "God-Objects" `GameRuntime.ts` in modularere Services. Input-Logik in `GameRuntimeInput.ts` und Multiplayer-Logik in `GameRuntimeMultiplayer.ts` extrahiert.
- **Refactoring (FlowSyncManager)**: Aufteilung des 1200-Zeilen Managers in `FlowDataParser.ts`, `FlowSequenceBuilder.ts` und `FlowRegistrySync.ts` inklusive Wrapper zur Wahrung der AbwÃƒÆ’Ã‚Â¤rtskompatibilitÃƒÆ’Ã‚Â¤t.
- **Feature (Flow-Editor)**: EinfÃƒÆ’Ã‚Â¼hrung visueller Auto-Formatierung fÃƒÆ’Ã‚Â¼r horizontale Layouts. Verbindungen (z.B. von rechtem auf linken Anker) werden nicht mehr vertikal gezwungen, sondern als geometrisch horizontale Achse wiederhergestellt und exportiert/gespeichert.
- **Typescript-Typing**: Elimination unsicherer `any`-Datenstrukturen in `RuntimeStageManager` und `MediatorService` durch Einsatz dedizierter Domain-Modelle (`GameTask`, `GameAction`, `ComponentData`). Dies behebt mÃƒÆ’Ã‚Â¶gliche "Silent Bugs" durch Typos bei Properties.

### 2026-03-31
- **Feature**: Die neue TGroupPanel Komponente wurde als transparenter Container eingefÃƒÆ’Ã‚Â¼hrt, der verschachtelte Kind-Komponenten aufnehmen kann.
- **Feature (Templates & ObjectPool)**: TGroupPanels kÃƒÆ’Ã‚Â¶nnen nun als "isTemplate=true" deklariert werden. `spawn_object` clont das Panel mitsamt allen Children zur Laufzeit rekursiv und erweckt sie zum Leben.
- **Feature (Action)**: Neue Action `set_child_property` hinzugefÃƒÆ’Ã‚Â¼gt, um gezielt Sub-Elemente in einem gespawnten TGroupPanel ÃƒÆ’Ã‚Â¼ber ihren Namen anzusprechen und zu verÃƒÆ’Ã‚Â¤ndern.
- **Refactoring (StageRenderer)**: `renderObjects` rekursiv erweitert, sodass Groups auch in der IDE mitsamt ihren Kind-Elementen navigierbar und global verschiebbar bleiben.
### 2026-03-31\n- StageRenderer Refactoring (God-Class): Auslagerung der spezifischen Rendering-Methoden fÃƒÆ’Ã‚Â¼r UI-Komponenten (Sprite, Shape, Inputs, Complex Components, System Components) in das neue Verzeichnis src/editor/services/renderers.\n\n
 # # #   2 0 2 6 - 0 3 - 3 1 
 -   A b g e s c h l o s s e n e   M i g r a t i o n   a l l e r   c o n s o l e . *   A u f r u f e   a u f   d e n   p r o j e k t w e i t e n   L o g g e r - D i e n s t   i m   g e s a m t e n   s r c /   O r d n e r   z u r   b e s s e r e n   D i a g n o s e   u n d   F e h l e r v e r f o l g u n g . 
 ÃƒÂ¯Ã‚Â¿Ã‚Â½ÃƒÂ¯Ã‚Â¿Ã‚Â½-   [ 2 0 2 6 - 0 3 - 0 9 ]   * * P r o j e k t   E r s t e l l e n   U s e   C a s e   ( E 2 E   T e s t ) * * :   E 2 E - T e s t   f ÃƒÂ¯Ã‚Â¿Ã‚Â½ r   P r o j e c t C r e a t i o n . s p e c . t s   v o l l s t ÃƒÂ¯Ã‚Â¿Ã‚Â½ n d i g   i m p l e m e n t i e r t   u n d   s t a b i l i s i e r t   ( D e b o u n c i n g - F i x e s ) .   D e c k t   A r r a y s ,   S n a p - T o - G r i d ,   R a s t e r - E i n s t e l l u n g e n ,   M e t a d a t e n   u n d   S t a g e - R e n a m e   a b ,   w i e   i m   U s e C a s e   s p e z i f i z i e r t . 
 
 # #   2 0 2 6 - 0 3 - 0 3 :   C o m p o n e n t   D e f a u l t   S i z e   F i x 
 
 -   * * B u g f i x * * :   B e h e b u n g   d e s   ' D a t e n   h a b e n   s i c h   n i c h t   g e ÃƒÂ¯Ã‚Â¿Ã‚Â½ n d e r t ' - F e h l e r s   b e i m   S p e i c h e r n   v o n   F l o w - D i a g r a m m e n .   D i e   ÃƒÂ¯Ã‚Â¿Ã‚Â½ n d e r u n g s p r ÃƒÂ¯Ã‚Â¿Ã‚Â½ f u n g   ( i s P r o j e c t D i r t y )   s c h e i t e r t e   b e i   P r o j e k t e n   o h n e   d i e   g l o b a l e   V a r i a b l e   ' i s P r o j e c t C h a n g e A v a i l a b l e ' .   D i e s e   w i r d   n u n   a u t o m a t i s c h   v o m   F a l l b a c k - M e c h a n i s m u s   i m   B l u e p r i n t - S c o p e   e r z e u g t ,   f a l l s   s i e   f e h l t . 
 
 -   F a l l b a c k   a u f   W i d t h = 5   u n d   H e i g h t = 2   f ÃƒÂ¯Ã‚Â¿Ã‚Â½ r   n e u   d r o p p e n d e   C o m p o n e n t s   e i n g e b a u t   i n   E d i t o r C o m m a n d M a n a g e r . t s x ,   w e n n   d i e s e   o h n e   G r ÃƒÂ¯Ã‚Â¿Ã‚Â½ ÃƒÂ¯Ã‚Â¿Ã‚Â½ e n a n g a b e   k o m m e n   ( B u g f i x ) 
 
 # #   2 0 2 6 - 0 3 - 0 4 :   T D a t a L i s t   B a s i s   K o m p o n e n t e n - S e t u p 
 
 -   T D a t a L i s t   ( V i s u a l   R o w   D e s i g n e r   f ÃƒÂ¯Ã‚Â¿Ã‚Â½ r   R e p e a t e r   L a y o u t )   a l s   B a s i s - K o m p o n e n t e   a n g e l e g t   u n d   i n   C o m p o n e n t R e g i s t r y   r e g i s t r i e r t . 
 
 -   E d i t o r C o m m a n d M a n a g e r   s o   a n g e p a s s t ,   d a s s   e r   b e i m   E i n f ÃƒÂ¯Ã‚Â¿Ã‚Â½ g e n   e i n e r   T D a t a L i s t   a u t o m a t i s c h   e i n   i n i t i a l e s   R o w - T e m p l a t e   P a n e l   e r z e u g t . 
 
 
 
 
 
 # # #   2 0 2 6 - 0 3 - 1 9 
 
 -   * * B u g f i x   ( F l o w S y n c M a n a g e r ) * * :   V e r h i n d e r u n g   v o n   D u p l i k a t e n   b e i   C o n d i t i o n - N o d e s   i m   F l o w   E d i t o r .   K o r r i g i e r t e   S t a n d a l o n e - N o d e - E r k e n n u n g   d u r c h   V e r w e n d u n g   e i n e s   V i s i t e d - S e t s   w ÃƒÂ¯Ã‚Â¿Ã‚Â½ h r e n d   d e r   G r a p h e n t r a v e r s i e r u n g   a n s t e l l e   e i n e s   s t r i n g - b a s i e r t e n   N a m e n s a b g l e i c h s . 
 
 -   * * T e s t i n g * * :   R e g r e s s i o n - S u i t e   w i e d e r   k o m p l e t t   g r ÃƒÂ¯Ã‚Â¿Ã‚Â½ n   ( E 2 E   T e s t s   i n k l u s i v e   T a s k - A c t i o n   L i n k i n g ) . 
 
 
 
 -   * * B u g f i x   ( I n s p e c t o r ) * * :   B e h e b u n g   e i n e s   U I - F e h l e r s ,   b e i   d e m   d i e   A k t i o n   ' W e r t   n e g i e r e n '   ( z . B .   f ÃƒÂ¯Ã‚Â¿Ã‚Â½ r   B o u n c e X )   a u f g r u n d   e i n e s   T y p - K o n f l i k t s   ( N u m b e r   v s .   B o o l e a n )   a u f   n u m e r i s c h e n   E i g e n s c h a f t e n   e i n   l e e r e s   E i n g a b e f e l d   a n z e i g t e .   D i e s   f ÃƒÂ¯Ã‚Â¿Ã‚Â½ h r t e   b e i m   S p e i c h e r n   z u m   V e r l u s t   d e r   E i g e n s c h a f t .   D a s   I n s p e c t o r - F e l d   e r z w i n g t   n u n   f ÃƒÂ¯Ã‚Â¿Ã‚Â½ r   ' n e g a t e '   v i a   ' v a l u e T y p e :   b o o l e a n '   s t e t s   e i n e   C h e c k b o x . 
 
 
 # # #   2 0 2 6 - 0 3 - 2 9 
 -   * * B u g f i x   ( I n s p e c t o r ) * * :   F e h l e n d e   I n s p e c t o r - E i g e n s c h a f t e n   ( i n k l .   ' G E O M E T R I E ' )   f ÃƒÂ¯Ã‚Â¿Ã‚Â½ r   B l u e p r i n t - K o m p o n e n t e n   b e h o b e n ,   i n d e m   d a s   J S O N - D a t e n o b j e k t   v o r   d e r   A n z e i g e   m i t t e l s   C o m p o n e n t R e g i s t r y   h y d r i e r t   w i r d . 
 -   * * F e a t u r e   ( V a l i d a t i o n ) * * :   P r o j e k t w e i t e   E i n d e u t i g k e i t s p r ÃƒÂ¯Ã‚Â¿Ã‚Â½ f u n g   f ÃƒÂ¯Ã‚Â¿Ã‚Â½ r   A c t i o n -   u n d   T a s k - N a m e n   (  a l i d a t e T a s k N a m e ,    a l i d a t e A c t i o n N a m e )   i m   E d i t o r C o m m a n d M a n a g e r . t s   i m p l e m e n t i e r t ,   u m   N a m e n s - S h a d o w i n g   u n d   R e f a c t o r i n g - K o n f l i k t e   z u   v e r h i n d e r n . 
 
 

### 13.04.2026
- **FIX**: Blueprint Global Variables (wie TStringMap) behalten nun korrekterweise ihren Status bei Stage-Wechseln und werden nicht mehr von identisch benannten, leeren lokalen Stage-Variablen ÃƒÂ¼berschrieben (Fix in GameRuntime.ts via obj.scope === 'global'). Duplicate locale Maps in project_GCS_Doku.json entfernt.

### 2026-04-16 (Hotfix)
- **Bugfix (Stage-Import Persistence in Electron Run-Mode)**: Ein Race Condition-Fehler wurde behoben, bei dem der IFrame Run-Mode in Electron auf project.json aus dem Cache/Dateisystem zurÃ¼ckfiel, bevor die neue Projektstruktur Ã¼ber postMessage (START_RUN) bereit stand. Dadurch wurden erst kÃ¼rzlich importierte Stages, die noch nicht auf der Festplatte via NativeFileAdapter gespeichert waren, durch den veralteten Fallback-Fetch Ã¼berschrieben. Eine window.WAIT_FOR_PROJECT Flag stellt nun sicher, dass der Standalone-Player priorisiert das Laufzeit-Projekt lÃ¤dt.
# # #   F i x e d   T S i d e P a n e l   A n i m a t i o n   i n   R u n M o d e  
 
### Fixed
- **Sticky Notes Inspector Sync**: Fixed Case-Sensitivity Issue for Inspector Properties (Name/Width/Height) to synchronize with PropertyHelper.
- **Sticky Notes Selection Focus**: Adjusted FlowInteractionManager to abort dragging if an input element is targetted, allowing native focus while retaining Global Selection.
\n- **Security Guards:** Native NodeJS Implementierung für 'T-06', 'T-11', 'T-13', 'T-14' und 'T-15'. Bugfix im Prototype Pollution Regression Test in serialization.test.ts (Payload muss über JSON.parse generiert werden).

- **Component Registry:** Registry-Missing Bugs im Bereich TAuthService, TDebugLog und TUserManager aus Component_Registration_Findings.md behoben. Whitelist in T-11 erweitert.

- **Error Logging (B-2):** Stille Registry-Regressionen (Savegame-Fehler, Hydration) lösen nun eine explizite Error-Warnung in Serialization.ts und eine rote Error-Notification im Editor aus.

- **Code Quality (B-1):** Guard T-11b eingeführt: Stellt strukturell sicher, dass jede Komponente mit toDTO() zwingend auch eine Registry-Factory besitzt.
\n### Feature: Sticky-Notes\n- Vollwertige Sticky-Note UnterstÃ¼tzung fÃ¼r Visual-Editor (TStickyNote) und Flow-Editor (FlowCommentNode).\n- 4-Color Semantic Coding (Gelb=Info, GrÃ¼n=Success/Tipp, Blau=Structure, Rot=Warning).\n- TStickyNote ist komplett aus Run(iframe) ausgeschlossen.

### 20.04.2026 - TStickyNote Titel & Layout
- **TStickyNote** wurde um ein \	itle\ Property ergänzt.
- **TextObjectRenderer** zeichnet Sticky Notes nun identisch zu FlowCommentNodes (Headline + Body getrennt, 100% Deckkraft, Schatten).
- **Toolbox**-Kategorie \Standard\ ist nun by Default \expanded: true\.
