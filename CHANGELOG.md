
## 18.04.2026

### Fix: Runtime Render Loop (Full-Render Explosion) behoben
- **VERHALTEN**: Bei Animationen von Container-Objekten (z. B. "slide-up" an einem `TPanel`) löste jede Pixeländerung (60 pro Sekunde) einen kompletten `Full-Render` (Zerstörung und Neuaufbau aller DOM-Nodes) aus. Folgende Animationen liefen "ausser Rand und Band" oder froren den Browser ein.
- **URSACHE**: Ein vorheriger Patch, der das Problem verschachtelter Child-Bewegungen beheben sollte, forcierte das reaktive Fallback `needsFullRender = true`, sobald sich die `x`- oder `y`-Eigenschaft von Objekten mit `.children` änderte. Da die `AnimationManager`-Schleife `x`/`y` ständig abänderte, überschrieb dies den effizienten 60fps-Hardware-Pfad komplett.
- **FIX**: Der reaktive `hasChildren`-Check in `GameRuntime.ts` sowie der asynchrone Redraw-Bypass in `GameLoopManager.ts` wurden endgültig entfernt. Der `StageRenderer.updateSpritePositions` (`Fast-Path`) berechnet stattdessen nun die Koordinaten (`absX`, `absY`) komplett rekursiv hoch bis zum Parent und iteriert tief in Container-Strukturen (`getChildren`), um auch unbewegte, aber gefangene Children nahtlos Hardware-zu-verschieben, OHNE einen Single-Render-Cycle der DOM-Engine auszulösen.
- **DATEIEN**: `src/runtime/GameRuntime.ts`, `src/runtime/GameLoopManager.ts`, `src/editor/services/StageRenderer.ts`


### Fix: Umbenennung von Flow-Tasks zerstört keine Child-Events mehr
- **VERHALTEN**: Wenn man im Flow-Editor oder Inspector einen Task umbenannte, blieb an verschachtelten Buttons (oder Variablen-Komponenten) der alte Taskname hängen, was die Verbindung als "nicht in Stage" im Dropdown ausgab.
- **FIX**: Der Task-Scanner arbeitet nun vollständig rekursiv (`updateEventsRecursively`). Er durchforstet restlos alle ComponentData-Einträge inklusive deren `children`-Arrays in unbegrenzter Tiefe sowie den Pool der `stage.variables`.
- **DATEIEN**: `src/editor/refactoring/TaskRefactoringService.ts`

### Fix: TDialogRoot Drag & Drop Child/Relative Position Fix
- **FIX**: (RunMode) Behebung eines Fehlers, bei dem Kind-Komponenten eines `TDialogRoot` beim Schließen oder Draggen (Verschieben per Maus) an ihrem alten Platz verblieben oder aufgrund falsch addierter Relativ-Koordinaten unkontrolliert durchs Bild sprangen. 
- **REFACTOR**: Die Event-Handler für Close, Click und Drag in `ComplexComponentRenderer` manipulieren nun das DOM direkt für sofortiges Feedback (`el.style.translate`), wodurch Full-Renders vermieden werden. Sie synchronisieren dabei die absoluten Screen-Koordinaten (`Parent.x + Child.x`) interaktiv für alle Kinder, ohne die reinen Daten-Strukturen zu zerschießen.
- **DATEIEN**: `src/editor/services/renderers/ComplexComponentRenderer.ts`

## 16.04.2026

### Feature: TDialogRoot Slide-Animation & Toggle Action
- **FEATURE**: TDialogRoot hat nun ein Property slideDirection (left/right) und verwendet im Runtime-Modus CSS-Transitions für eine geschmeidige Slide-In-Animation.
- **FEATURE**: Neue Runtime Action 	oggle_dialog (Modus: toggle, show, hide) entwickelt. Diese erlaubt es per Flow-Editor (z.B. durch Klick auf ein Toast-Icon), Dialoge animiert einfahren und ausblenden zu lassen.
- **DATEIEN**: src/components/TDialogRoot.ts, src/runtime/actions/handlers/DialogActions.ts



### Fix: Letzte native confirm()-Aufrufe in Editor.ts ersetzt
- **FIX**: (Electron) Die 4 verbliebenen nativen `confirm()`-Aufrufe in `Editor.ts` (`removeObjectWithConfirm`, `removeMultipleObjectsWithConfirm`) wurden auf `await ConfirmDialog.show()` umgestellt. Diese blocking Dialoge waren der letzte bekannte Trigger für den Electron-Fokus-Bug, der nach dem Löschen von Objekten die Eingabefelder im Inspector unbedienbar machte.
- **REFACTOR**: Beide Methoden sind jetzt `async` (Rückgabetyp `Promise<void>`). Das Interface `EditorInteractionHost` wurde entsprechend auf `void | Promise<void>` aktualisiert.

### Fix: Dialog-Fokus-Lifecycle (Root Cause)
- **FIX**: (Electron/Browser) `ConfirmDialog` und `PromptDialog` haben beim Schließen den Fokus nicht auf das vorher aktive Element zurückgegeben. Nach `overlay.remove()` landete `document.activeElement` auf `<body>` — in Electron führte das dazu, dass Inspector-Inputs danach keinen Fokus mehr annehmen konnten. Beide Dialoge speichern jetzt `document.activeElement` beim Öffnen und rufen `.focus()` beim Schließen auf dem gespeicherten Element auf.
- **FIX**: `StageInteractionManager.handleKeyDown()` — Die Delete-Taste hat bei fokussierten Input-Feldern trotzdem Objekte gelöscht, weil die `isInputFocused`-Guard fehlte.
- **DATEIEN**: `src/editor/ui/ConfirmDialog.ts`, `src/editor/ui/PromptDialog.ts`, `src/editor/services/StageInteractionManager.ts` (Z.705).

## 14.04.2026

### Refactoring Electron Blocking Dialogs
- **FIX**: (Electron) Behebung des Renderer-Hangs durch vollständigen Ersatz blockierender Dialoge (lert/confirm/prompt) durch non-blocking Promise-basierte HTML-Dialoge (NotificationToast, ConfirmDialog, PromptDialog) in allen Editor-Modulen (EditorMenuManager, EditorDataManager, InspectorActionHandler, DialogActionHandler, SaveAsDialog, GameExporter).
- **FEATURE**: Alle Service-basierten Handler-Aufrufe, die jetzt asynchron ablaufen, wurden auf asynchrone Promise-Auflösung umgestellt.

## [2026-04-14] - Inspector Input Action Fix
### Fixed
- **FlowEditor / StageInteractionManager / EditorKeyboardManager**: Ein Fehler wurde behoben, bei dem die globale TastenÃ¼berwachung (z. B. Entf, Backspace oder Nudging via Pfeiltasten) Inputs in Inspektor-Feldern oder ContentEditable-Bereichen blockierte oder ungewollt Flow-Knoten lÃ¶schte. Die PrÃ¼fung (`isInputFocused`) berÃ¼cksichtigt nun zunÃ¤chst korrekt Shadow-DOM-Elemente (falls verwendet) sowie `isContentEditable`-Tags darÃ¼ber hinaus konsequent Ã¼berall. So lÃ¤sst sich Text wieder fehlerfrei im Flow-Inspector bearbeiten, ohne dass Projekt-Elemente verschwinden oder Tastatureingaben vom System verschluckt werden.

## [2026-04-14] - Prevent Initial Render Saves
### Fixed
- **EditorDataManager**: Ein Fehler wurde behoben, durch den unmittelbar nach dem Laden eines Projekts (\~1 Sekunde\) der Autosave-Z�hler bereits auf 1 sprang, ohne dass der Nutzer interagiert hatte. Dies passierte, da das initiale DOM-Rendering der Editor-B�hne k�nstliche \onPropertyChange\-Events triggert. Eine 2000-Millisekunden-Sperre im \updateProjectJSON()\ sorgt nun daf�r, dass Post-Load-Events nicht mehr den Festplatten-Stream ausl�sen und der Z�hler stabil auf 0 verbleibt.
- **Fixed:** Electron text input block (by using win.setMenuBarVisibility(false) instead of removeMenu()).
- **Fixed:** Saving path issue (sanitizes backslashes to resolve folders correctly on Windows).

## [2026-04-14] - Reset Autosave Counter on Project Load
### Fixed
- **EditorDataManager / MenuBar**: Der AutoSave-Z�hler wurde beim Laden eines neuen oder bestehenden Projekts nicht zur�ckgesetzt und hat den Wert des alten Projekts einfach weiter hochgez�hlt. Die \loadProject()\-Routine resettet nun beim Ladevorgang den internen \_autoSaveCount\ auf 0 und �bergibt dies trigger-los an die \MenuBar\ (ohne den gr�nen Flash-Effekt), sodass beim Wechsel eines Projekts eine saubere Null-Basis existiert.

## [2026-04-14] - Autosave Concurrency Fix
### Fixed
- **Autosave / Native File System API**: Es wurde behoben, dass das Speichern nach einer UI-Eingabe gar nicht mehr funktionierte und der AutoSave-Z�hler unverh�ltnism��ig schnell hochgez�hlt hat (teilweise 4-mal). Ursache war, dass durch das DOM/Event-System (z.B. Hover, Click, Edit) in Sekundenbruchteilen simultan auf den nativen Dateistream zugegriffen wurde. Die Browser-Sicherheitsarchitektur blockierte dies daraufhin als �berschneidung ("Stream already locked") und st�rzte in den Fallback ab. Der Speichervorgang auf die Disk (\performDiskSave\) ist jetzt durch einen 1000ms Debounce-Timer gekapselt, welcher simultane Aufrufe zuverl�ssig b�ndelt.

## [2026-04-14] - Fix Autosave Indicator UI Rendering Bug
### Fixed
- **MenuBar**: Es wurde bemerkt, dass der neu eingef�hrte AutoSave-Z�hler in der Statusleiste nach dem initialen Laden des Projekts verschwand. Ursache war, dass der \utosaveWrapper\ im initialen Constructor injiziert wurde, jedoch bei der Ausf�hrung der dynamischen Men�-\
ender()\ Methode nicht erneut in den DOM-Baum gehangen wurde und somit vom Garbage-Collector entfernt wurde. Dies wurde korrigiert. Der Z�hler bleibt nun permanent erhalten und leuchtet bei Speichervorg�ngen.

## [2026-04-14] - Fix Hardcoded Project Filename Display
### Fixed
- **MenuBar / ProjectPersistenceService**: Ein Fehler wurde behoben, bei dem nach dem Laden eines Projekts �ber die Web FileSystem Access API oder Electron der Projektpfad in der Men�leiste starr als \loaded_project.json\ angezeigt wurde. \NativeFileAdapter\ liest nun den tats�chlichen Dateinamen (\handle.name\) oder den absoluten Pfad (\currentPath\) aus und leitet diesen korrekt an die \EditorDataManager\ Anzeige weiter.

## [2026-04-14] - Autosave UI-Indicator & Safari/Chrome Native Fix
### Fixed
- **Autosave / NativeFileAdapter**: Ein Fehler im Autosave-Fallback wurde behoben. Wenn der Editor im Web-Modus lief und \currentHandle\ aufgrund von fehlenden Rechtefreigaben nicht sofort beschreibbar war (oder fehlschlug), hat die \utoSave()\ Methode leise \alse\ zur�ckgegeben. Die Fallback-Kette delegierte dies jedoch historisch bedingt in ein Nichts. Nun weicht das System in diesem Fall korrekt wieder auf den Dev-Server ab (\	ryFetchFallback\), sodass keine �nderungen in lokalen Sitzungen mehr verloren gehen.
### Added
- **MenuBar**: Es gibt nun einen prominenten "Autosave"-Z�hler rechts in der Statusleiste. Dieser blitzt kurz gr�n auf, sobald ein Speichervorgang im Hintergrund (Disk oder Dev-Server) erfolgreich durchgef�hrt und garantiert gesichert wurde.

## [2026-04-13] - Autosave Native Adapter Fix
### Fixed
- **Autosave / NativeFileAdapter**: Der Autosave-Mechanismus im Editor (der alle paar Sekunden �nderungen speichert) nutzte im reinen Web-Browser (Native FileSystem Access) f�lschlicherweise immer den Backend-Dev-Server-Pfad als Fallback, statt die ge�ffnete lokale Desktop-Datei nahtlos zu updaten. Der \NativeFileAdapter\ wurde um ein ger�uschloses \utoSave()\ erweitert, sodass \updateProjectJSON\ nun korrekterweise direkt auf die Festplatte des Users synct, sofern Schreibrechte f�r das ge�ffnete File-Handle bestehen.

## [2026-04-13] - ReactiveRuntime Maximum Call Stack Fixes
### Fixed
- **ReactiveProperty**: Behobenen \RangeError: Maximum call stack size exceeded\ (Endlosschleife) im Standalone-Player beim �bergang zur n�chsten Stage mit assoziierten Proxy-Komponenten.
- **Proxy-Loop-Schutz**: Die \__isProxy__\-Pr�fung im get-Trap von \makeReactive\ wurde VOR die crashende \instanceof HTMLElement\ Pr�fung verschoben, um doppeltes Wrappen und endlose JS-Engine-Prototypenketten-Traversierungen sicher zu vermeiden.

## [2026-04-12] - TRichText Inline Links Support
### Added
- **RichTextEditorDialog**: Die Toolbar enthÃ¤lt nun einen nativen Link-Button ("🔗"). Ein neues modales Dialogfenster erlaubt es, Texte als Weblink (URL) oder als direkte Stage-Navigation (`stage:ID`) zu markieren.
- **TextObjectRenderer**: Abfangen von `<a>`-Klicks zur Laufzeit. Normale Links (Web) werden in einem neuen Tab geÃ¶ffnet. Interne Links (`stage:ID`) fÃ¼hren Ã¼ber den globalen `TStageController` nahtlos zu anderen Stages aus dem Inline-Text heraus, ohne dass Flow-Tasks benÃ¶tigt werden.

## [2026-04-12] - Inspector UI Styling Update
### Changed
- Die Schriftgröße der Inspector-Validierungshinweise (`.inspector-hint`) wurde auf 9px verkleinert und die Farbe auf ein moderneres Orange (`#ffa726`) angepasst.

## [2026-04-11] - Stage-basierte Geometrie-Plausibilitaetspruefung
### Added
- Dynamische min/max-Berechnung fuer x/y/width/height basierend auf aktiver Stage-GridConfig
- Neue Methode TWindow.getGeometryConstraints(): berechnet Grenzen so, dass Komponenten vollstaendig auf der Stage liegen
- Constraints: x >= 0, y >= 0, x + width <= cols, y + height <= rows
- Tooltip auf x/y zeigt Stage-Groesse in Zellen an (z.B. "Stage: 64x40 Zellen")
- Negative Positionen nicht mehr erlaubt (vorher min: -100)
- Fallback-Kette: Stage-Grid -> Projekt-Grid -> Defaults (64x40)

## [2026-04-10] - Inspector Input-Validierung
### Added
- Inline-Validierung fuer Inspector-Felder: Number-Inputs mit type='number', min/max/step
- Live-Feedback bei Eingabe: roter Rand bei NaN, oranger Rand bei out-of-range
- Auto-Clamp bei onblur/onchange: Werte werden auf min/max begrenzt mit Shake-Animation
- Binding-Syntax-Validierung: { und } muessen paarweise sein
- TPropertyDef: 'hidden' Typ fuer Serialisierungs-only Properties, 'validate' Callback
- CSS-Klassen: inspector-input-error, inspector-input-warning, inspector-input-valid, inspector-hint
- TWindow: Geometrie-Limits (x/y min:-100/max:200, width/height min:1/max:200, zIndex max:9999, borderWidth max:20, borderRadius max:100)
## [2026-04-10] - TRichText Serialization Fix (Root-Cause)
### Fixed
- htmlContent fehlte in getInspectorProperties() und wurde von toDTO() nicht serialisiert
- Beim safeDeepCopy fuer Run-Mode/IFrame ging der WYSIWYG-Inhalt mit Formatierungen verloren
- Deprecated font-color Tags werden jetzt zu span-inline-styles konvertiert (CSS-Spezifitaet)
- Debug-Logs aus vorheriger Analyse-Session entfernt
## [2026-04-10] - TRichText Rendering Overhaul
### Fixed
- renderRichText: fehlende fontSize-Skalierung via scaleFontSize ergaenzt
- renderRichText: falscher Color-Fallback im Editor entfernt
- renderRichText: Padding-Anwendung ergaenzt
- renderRichText: fontWeight/fontStyle robuster
- Debug-Logs entfernt und Runtime-Bundle aktualisiert

## [2026-04-10] - Kopier-Funktion Fix
### Fixed
- Das EinfÃ¼gen von kopierten Objekten im Editor schlug fehl, weil die `crypto.randomUUID()` API je nach Electron/Vite Sicherheitskontext nicht konsistent verfÃ¼gbar ist. Diese Aufrufe wurden im `EditorInteractionManager.ts` und im `EditorStageManager.ts` durch robuste `Math.random` Fallbacks ersetzt.
### Added
- **TStringMap in Toolbox integriert**: Die Komponente `TStringMap` wurde in den Toolbars (`toolbox.json` und `toolbox_horizontal.json`) unter der Kategorie "Variablen" registriert, sodass sie nun per Drag & Drop im Editor nutzbar ist.
- **TStringMap in ComponentRegistry**: Das Klassennamen-Mapping (Alias 'StringMap' -> 'TStringMap') und die native Registrierung in der globalen `ComponentRegistry` wurde hinzugefÃ¼gt, sodass Instanzen beim Droppen aus der Component-Palette erfolgreich instanziiert werden.
- **Variable-Bindings fÃ¼r Komponenten**: Der "V"-Button (Pick Variable) wurde im neuen `InspectorSectionRenderer` hinzugefÃ¼gt. Dieser ermÃ¶glicht es nun, auch bei TextFields, TextAreas (z.B. Inhalt von TButton/TLabel) und NumberFields reaktive Bindings wie `${score}` im UI per Klick auszuwÃ¤hlen und zuzuweisen.
- **TRichText Komponente inkl. Editor**: Die neue Komponente `TRichText` wurde implementiert (abgeleitet von `TPanel`). Im Inspector kann man Ã¼ber "ðŸ–‹ï¸� Text bearbeiten" nun einen modalen native WYSIWYG Editor-Dialog Ã¶ffnen. Dieser verwendet DOMParser zur XSS Sanitisierung (unterbindet script-Tags). Die Textausgabe (`renderRichText`) erlaubt saubere Formatierung direkt auf der Stage.


## [2026-04-08] - JSON Asset Pfad Fix
### Fixed
- Alte json-Projektdaten mit absoluten Pfaden (/images/ und /audio/) werfen in der ausfÃ¼hrbaren Electron-App jetzt keine Fehler mehr und verursachen kein Flattern in der Render-Schleife, da alle Strings in den Renderern abgefangen und als relative Pfade (./) ausgegeben werden.


## [2026-04-08] - Electron Pfad Fix
### Fixed
- iframe-runner.html laedt runtime-standalone.js ueber relativen Pfad

## [3.35.5] - 2026-04-08
### Refactored
- **Architectural "Hard Break" (ProjectRegistry Decentralization)**: The monolithic `ProjectRegistry.ts` (`>1000 LOC`) was entirely decommissioned and deleted. It has been completely decoupled into domain-specific, independent modules located under `src/services/registry/`:
  - `VariableRegistry.ts` (State & Variable resolving)
  - `TaskRegistry.ts` (Flow logic & Task sequencing)
  - `ActionRegistry.ts` (Action instances & parameters)
  - `ObjectRegistry.ts` (DOM/UI Object instances)
  - `ReferenceTracker.ts` (Cross-domain dependencies)
  - `CoreStore.ts` (Base Project state and UI stage logic)
  All Editor, Runtime, Component and UI elements have been migrated to the new namespaced registry dependencies (e.g. `import { projectObjectRegistry } ...`). This fulfills the strict architectural compliance rules and dramatically improves developer velocity.

### Fixed
- **TypeScript Compilation Target**: Replaced numerous legacy occurrences of `ProjectRegistry.getInstance()` across `EditorStageManager`, `SpriteRenderer`, `InspectorContextBuilder`, and test scripts to correctly resolve via the new `projectObjectRegistry` and `coreStore` endpoints.

## [3.35.4] - 2026-04-08
### Fixed
- **Double Hydration Shield (Ansatz A + B)**: Die kritische Schutzschicht gegen versehentliche Doppel-Hydratisierung wurde auf zwei Ebenen massiv gehÃ¤rtet:
  1. *Offensiv (RuntimeStageManager)*: Ein neuer `isAlreadyHydrated`-Check (PrÃ¼fung auf `instanceof TWindow`) wertet noch *vor* dem Schleifen-Durchlauf aus, ob das Array bereits lebende Instanzen enthÃ¤lt, und umgeht den Hydrierungszyklus komplett.
  2. *Defensiv (Serialization.ts)*: Der "Idempotency Check" wurde explizit als Hard-Fallback wieder in `hydrateObjects` integriert (`if (objData instanceof TWindow) ... return`). 
  Diese kombinierte Architektur garantiert nun ausnahmslose StabilitÃ¤t, selbst wenn kÃ¼nftige Refactorings (wie die geplante SSoT-Trennung) DatenstrÃ¶me unbemerkt verÃ¤ndern sollten.
- **Dead Code in Serialization.ts**: Behebung eines Fehlers, bei dem das interne `isInternalContainer` Flag nicht mehr auf interne Komponenten (`TDataList`, `TTable`, `TObjectList`, `TEmojiPicker`) angewandt wurde. Durch das vorherige Registry-Refactoring wurde das Setzen der Eigenschaft unabsichtlich in einen toten Code-Pfad *vor* die eigentliche Objekterstellung (`ComponentRegistry.create`) verschoben. 
- **Double Action Logs Bug**: Behebung eines rein kosmetischen UI-Bugs, bei dem regulÃ¤re Actions (ohne Body) wie `Action_DestroyBullet` doppelt in der Runtime-Debugger-Ansicht protokolliert wurden.
  - *Ursache:* Sowohl der `TaskExecutor` als auch der `ActionExecutor` schrieben beim Aufruf einen Log-Eintrag in den `DebugLogService`.
  - *LÃ¶sung:* Das redundante Logging im `TaskExecutor` wurde entfernt. Der `TaskExecutor` loggt nun nur noch dann einen separaten Eintrag, wenn eine Action ein komplexes Kompositum (mit Body-Array) ist und schiebt diesen korrekterweise in den Context-Stack, wÃ¤hrend einfache AusfÃ¼hrungen exklusiv dem `ActionExecutor` Ã¼berlassen werden.
- **Double Hydration Bug (Stage-Anzeige im Run-Mode)**: Behebung eines kritischen Fehlers, bei dem die Stage-Anzeige (Grid/Background) im Run-Mode korrupt werden konnte, da die Editor-Objekte doppelt hydratisiert und ihre Referenzen in der Runtime weiterverwendet wurden.
  - *LÃ¶sung:* In `EditorRunManager.ts` wird nun `safeDeepCopy(this.editor.project)` verwendet, um das Projekt strikt in ein rein datenbasiertes (JSON-Plain-Object) DTO zu entkoppeln *bevor* The Runtime startet.
- **Run-Mode Crash bei TInputController (Set/Map Clone Bug)**: Nach der EinfÃ¼hrung von `safeDeepCopy` kam es beim Starten des Run-Modes durch den `TInputController` zu einem Crash (`keysPressed.clear is not a function`).
  - *Ursache:* `safeDeepCopy` klonte `Set`- und `Map`-Strukturen fehlerhaft zu reinen Objekten (`{}`). Beim anschlieÃŸenden `hydrateObjects` wurde das `commands: new Set()` des `TInputController` mit dem defekten leeren Objekt Ã¼berschrieben.
  - *LÃ¶sung:* `safeDeepCopy` in `DeepCopy.ts` unterstÃ¼tzt nun natives Auslesen und Klonen von `Set` und `Map`.

### Refactored
- **Dynamische Getter-PrÃ¼fung per Reflection**: Die stark fehleranfÃ¤llige und manuelle `reservedKeys`-Ausschlussliste in `Serialization.ts` (welche alle Getter-only Properties diverser Komponenten hÃ¤ndisch ausschlieÃŸen musste) wurde komplett eliminiert. Die Serialisierung iteriert stattdessen live via `Object.getOwnPropertyDescriptor` Ã¼ber die Prototypen-Kette der Zielklasse, und prÃ¼ft exakt zur Laufzeit, ob einer Eigenschaft ein `set`-Accessor zur VerfÃ¼gung steht oder ob diese dynamisch schreibbar (`writable: true`) ist. Dies lÃ¶st eine massive Frustrationsquelle bei der Komponentenerweiterung vollstÃ¤ndig auf.
- **Code-Duplizierung in ComponentRegistry**: Die verschachtelte IIFE-Factory der `TSplashStage` (welche fÃ¤lschlicherweise manuell `duration` und `autoHide` setzte) wurde zu einem sauberen Lambda-Einzeiler refactored. Diese spezifischen Parameterzuweisungen waren redundant, da der Magic Loop der Laufzeitumgebung sie sowieso dynamisch bedient.

- **Code-Duplizierung in Serialization.ts (Property-Zuweisung)**: Ca. 150 Zeilen redundante, statische und manuell gecastete `(newObj as any).XYZ` Property-Wiederherstellungen wurden komplett gelÃ¶scht. Diese FunktionalitÃ¤t wurde de facto durch den bereits existierenden, generischen "Magic Loop" erledigt, wodurch dieser massive Block komplett redundant und fehleranfÃ¤llig war. ZukÃ¼nftige Komponentenerweiterungen profitieren nun verlustfrei von der automatischen GenerizitÃ¤t.
- **Open/Closed Principle in Serialization.ts**: Der 566-zeilige unersÃ¤ttliche Switch-Case in `hydrateObjects` wurde durch eine dynamische `ComponentRegistry` (`src/utils/ComponentRegistry.ts`) abgelÃ¶st. Um manuelle Boilerplate zu vermeiden, inkludiert nun jedes `src/components/*.ts`-Modul sein eigenes `ComponentRegistry.register()` Statement am unteren Dateiende. Eine dynamisch generierte Import-Map (`src/components/index.ts`) stellt sicher, dass alle Module wÃ¤hrend des Application-Starts geparst und registriert werden, was nun nahtloses Skalieren der UI-Komponenten ohne Editieren der Kern-Logik ermÃ¶glicht.

## [3.35.3] - 2026-04-07
- **Run-Tab UI Aktualisierungsfehler (Bindings)**: Behebung eines kritischen Fehlers, bei dem reaktive UI-Bindings (wie `Score: ${score.value}`) im Standalone-IFrame zwar korrekt aktualisiert wurden, im internen Editor-Run-Tab jedoch nicht sichtbar waren. 
  - *Ursache:* Durch frÃ¼here Refactorings wurde die Stage-Renderer-Referenz im `EditorRunManager` ungÃ¼ltig (`this.editor.renderer` anstatt `this.editor.stage.renderer`). Dadurch verpufften die `updateSingleObject`-Signale der Game Engine stumm im Nichts, ohne den DOM zu erreichen.
  - *LÃ¶sung:* Der Pfad wurde repariert und `StageRenderer` korrekt verÃ¶ffentlicht. Variablen-Ã„nderungen flieÃŸen nun wieder augenblicklich als UI-Updates in den DOM.
- **Log Cleaning**: Umfangreiche Bereinigung von redundanten Debugging-Meldungen (`RUNTIME G...` console.errors und blockierende `alert`-Aufrufe) aus `GameRuntime.ts` und `EditorRunManager.ts`, die fÃ¼r die Spurensuche des Silent Crashs benÃ¶tigt wurden.

## [3.35.2] - 2026-04-07
- **Vite Dev-Server Proxy**: Die fehlende Proxy-Konfiguration fÃ¼r `/api` und `/platform` wurde in der `vite.config.ts` wiederhergestellt. Dadurch ist der Game-Server via `localhost:8080` wieder fÃ¼r den Editor (unter `localhost:5173`) erreichbar. Dies behebt den Fehler "Kritischer Fehler beim Speichern (Server nicht erreichbar)".

## [3.35.0] - 2026-04-07
### Added
- **Electron Desktop App Infrastruktur**: 
  - Einrichtung eines neuen `electron/` Ordners mit `main.cjs` (Hauptprozess) und `preload.cjs` (ContextBridge).
  - Umstieg auf direkten Dateizugriff des Betriebssystems (nativ) Ã¼ber `window.electronFS` statt lokaler Express Server.
  - EinfÃ¼hrung des Single Codebase "Dual-Modes": Web-Dienste (`fetch('/api...')`) bleiben bestehen, aber im Offline-Kontext (`window.electronFS`) werden OS-native Ã„quivalente bevorzugt. Die Web-Version bleibt also intakt!
  - `GameExporter`: Modifiziert, damit er im Offline-Modus das `runtime-standalone.js` direkt ins ZIP/HTML bundeln kann, statt es via Fetch zu laden.
  - Integration von nativen OS-Dialogen (`showOpenDialog`, `showSaveDialog`) ins Dateisystem, damit Benutzer Projekte Ã¼berall abspeichern kÃ¶nnen.
  - Migration von `EditorDataManager` (`saveProjectAs` / `saveProjectToFile`), sodass dieser via IPC native asynchrone File-Wrights durchfÃ¼hrt.
  - Implementierung sicherer IPC-Handler (`fs:readFile`, `fs:writeFile`, `fs:listFiles`, `fs:showOpenDialog`, `fs:showSaveDialog`) via `ipcMain` und `contextBridge` unter strikter Nutzung von `contextIsolation: true` und `nodeIntegration: false`.
  - `package.json` um `dev:electron` und `build:electron` Skripte erweitert und `electron`/`electron-builder` hinzugefÃ¼gt.
  - `vite.config.ts`: Proxy-Server Config auskommentiert, da Dev-Server wegfÃ¤llt.

## [3.35.1] - 2026-04-07
### Fixed
- **IFrame Run-Tab**: Die Zuweisung des `iframe.src` im `EditorViewManager` wurde angepasst. Anstatt einen harten abslouten Pfad (`/iframe-runner.html`) zu setzen, der im Electron-Modus auf das Root-Laufwerk verweist, wird nun abhÃ¤ngig vom Protokoll `file:` oder `http/https` flexibel auf `iframe-runner.html` oder `/iframe-runner.html` zurÃ¼ckgegriffen.
- **Demo-Projektdaten (Spawning Shooter Demo)**: Sprite-Bilder im `Spawning_Shooter_Demo` nutzten absolute URLs (`/images/Ufos/ufo_transparet.png`), was in lokalen `file://`/Electron-Umgebungen fehlschlug. Alle Pfade in der Projekt-Datei verwenden jetzt einen relativen Start (`./images/...`).

## [3.35.0] - 2026-04-07
### Added
- **Virtual Gamepad Layout Anpassung**: 
  - Die `TVirtualGamepad` Komponente unterstÃ¼tzt nun die Eigenschaft `splitVerticalAlignment` (Vertikale Ausrichtung).
  - Ist das Layout auf "split" gestellt, kÃ¶nnen die Buttons wahlweise am unteren Bildschirmrand ("bottom") oder vertikal zentriert ("middle") platziert werden (nutzbar Ã¼ber den Inspector).

- **Ruckelfreies Label Update & Optimierung (Targeted Rendering)**: 
  - Wiederherstellung des "Targeted Rendering", um zu verhindern, dass hÃ¤ufige Variablen-Updates (z.B. Score, Timer) die gesamte Stage neu rendern lassen und Jitter auf mobilen EndgerÃ¤ten verursachen.
  - `GameRuntime.ts`: Global-Listener umgeht Full-Render fÃ¼r Eigenschaften und ruft `onComponentUpdate` auf. FÃ¼r Variablen-Updates (z.B. Score) wurde ein **"Soft-Render"** eingefÃ¼hrt, der statt eines DOM-Rebuilds alle UI-Komponenten in-place aktualisiert.
  - `StageRenderer.ts`: `updateSingleObject()` weiter verbessert und integriert, um einzelne Elemente DOM-schonend zu aktualisieren. Migration von `transform: translate3d` zu nativem CSS `translate`.
  - `style.css`: GPU-Compositing via `contain: layout style paint` fÃ¼r game-objects.

- **Touch & Pointer Support**: Das GCS unterstÃ¼tzt nun offiziell Touch-GerÃ¤te (Smartphones & Tablets)!
  - **Pointer-Events:** Die `GameRuntime` und der `StageRenderer` fangen nun Pointer-Events (`onpointerdown`, `onpointermove`, `onpointerup`) ab, um eine einheitliche Eingabeverarbeitung fÃ¼r Maus, Touch und Stift zu gewÃ¤hrleisten. Drag & Drop im Standalone-Export nutzt ebenfalls Pointer-Events mit `setPointerCapture`.
  - **Event-Namen fÃ¼r Non-Coders:** Im Editor und Inspector heiÃŸen die Events intuitiv `onTouchStart`, `onTouchMove` und `onTouchEnd`. So bleibt die Bedienung einfach.
  - **Performance:** Touch-Bewegungen (`onTouchMove`) sind via `requestAnimationFrame` optimiert, um 60fps bei gleichmÃ¤ÃŸiger Netzersparnis zu erhalten.
  - **CSS:** Touch-Action Scrolling/Zooming im Spielfeld Ã¼ber `touch-action: none` auf dem Container unterbunden.
  - **VerfÃ¼gbarkeit:** Die neuen Events sind als Standard-Events an allen GCS-Komponenten (`TComponent`) registriert und kÃ¶nnen im Inspector fÃ¼r Flow-Tasks gebunden werden.
- **TVirtualGamepad**: Ein intelligenter, adaptiver Gamepad-Simulator (`VirtualGamepadRenderer`) fÃ¼r Touch-GerÃ¤te.
  - Nutzt Layout-Eigenschaften: D-Pad, Xbox-Rautenform und dynamische Action-Bars berechnen sich automatisch.
  - Skaliert mit Grid und registriert automatisiert die Tasten des bestehenden `TInputController`.
  - Zeigt sich nur auf Touch-GerÃ¤ten (Auto-Hide auf PC).

## [3.33.0] - 2026-04-03
- **IFrame Run-Tab**: Ein neues Standalone-Preview Feature! Statt die GameRuntime invasiv ins Editor-DOM zu quetschen, erstellt der neue Tab `Run (IFrame)` ein abgekapseltes `<iframe src="/iframe-runner.html">` und speist es via `postMessage` mit exakt demselben sauberen JSON-Objekt, das auch `GameExporter.getCleanProject()` exportiert. Bietet 100% Export-ParitÃ¤t und lÃ¶st Runtime/Editor Memory Leaks auf Knopfdruck ("MÃ¼llabfuhr-Prinzip").

## [3.32.1] - 2026-04-03
### Fixed
- **GroupPanel Layout Export:** Fehler im Standalone Export behoben, durch den Kind-Elemente von GroupPanels (die auch eine hierarchische Position besitzen) verschoben exportiert wurden oder unsichtbar verschachtelt waren. GameRuntime nutzt nun streng die relativen Koordinaten (copy.x = rx), was den Double-Offsetting-Bug des StageRenderer endgÃ¼ltig beseitigt und gleichzeitig die Parent-ID fÃ¼r den Z-Index beibehÃ¤lt.


## [3.32.0] - 2026-04-03
### Improved (CleanCode)
- **TypeScript `any`-Audit â€” Quick-Wins** (6 Dateien, ~30 `any` eliminiert):
  - `types.ts`: Neue Interfaces `FlowElementData` / `FlowConnectionData` fÃ¼r typisierte FlowCharts. `ProjectVariable.style` nutzt nun `ComponentStyle`. `LegacyGameTask` und `GameObject` mit `@deprecated` und `unknown` statt `any`.
  - `InspectorTypes.ts`: `TPropertyDef.style` â†’ `Record<string, string>`, `actionData` â†’ `Record<string, unknown>`.
  - `TComponent.ts`: `IRuntimeComponent.initRuntime` mit `GridConfig` und `ComponentData[]` statt `any`.
  - `ActionRegistry.ts`: `getVisibleActionTypes(project: GameProject | null)` mit typisierten Callback-Lambdas.
  - `config.ts`: `parsePrefixLogLevels(env: Record<string, string | undefined>)`.
  - `player-standalone.ts`: 13 `any`-Vorkommen durch `GameProject`, `ComponentData`, `StageDefinition`, `ServerMessage` und `HTMLElement | null` ersetzt.

## [3.31.2] - 2026-04-03
- **GroupPanel Editor-Sichtbarkeit** (`StageRenderer.ts`):
  - Wenn ein GroupPanel im Editor nicht markiert war und keine eigene Hintergrundfarbe definiert hatte, versank es in der Unsichtbarkeit, da das Standard-`TGroupPanel`-Styling (`0px solid transparent`) den Fallback-Border Ã¼berschrieben hat. Das Panel hat nun im Editor-Modus stets einen leicht durchsichtigen Hintergrund und einen "dashed" (gestrichelten) Rand, der erst im Run/Standalone-Modus verschwindet.
- **GroupPanel Kind-Selektion** (`StageRenderer.ts`, `InspectorHeaderRenderer.ts`):
  - Klick-Interaktionen fÃ¼r verschachtelte Elemente in `TGroupPanel`s behoben. Die Render-Reihenfolge nutzt nun die Eltern-Kind-Hierarchietiefe als Fallback fÃ¼r den `zIndex`, wodurch Kinder verlÃ¤sslich Ã¼ber ihrem Panel gezeichnet und somit wieder anklickbar (markierbar) werden.
  - Im Inspector-Dropdown werden untergeordnete Elemente von GroupPanels nicht mehr fÃ¤lschlicherweise als `(Global)` gekennzeichnet, sondern erhalten den korrekten Tag `(Child)`.

## [3.31.1] - 2026-04-02
- **Dynamic Inspector Bugfix** (`FlowAction.ts`):
  - Behebung eines kritischen UI-Status-Fehlers, bei dem sich der Inspector nach einem Wechsel der `effect`-Eigenschaft fÃ¼r `visibleWhen` nicht neu gezeichnet hat.
  - HinzufÃ¼gen von `defaultValue` zum Konfigurationsobjekt der Flow-Actions, wodurch leere Number-Inputs im Inspector (z.B. bei der "Dauer") behoben wurden.

## [3.31.0] - 2026-04-02
- **Sprite-Animations-Effekte** (`AnimationManager.ts`, `AnimationActions.ts`):
  - 9 neue Animations-Effekte fÃ¼r das `animate`-Action:
    - `grow` â€” Sprite wÃ¤chst (width + height Tween, beeinflusst Hitbox)
    - `shrink` â€” Sprite schrumpft (Gegenteil von grow, bei â‰ˆ0 â†’ `visible=false`)
    - `explode` ðŸ’¥ â€” Fragment-basiertes Platzen: Sprite wird in N StÃ¼cke (konfigurierbar) zerlegt, die in zufÃ¤llige Richtungen wegfliegen mit Rotation, Skalierungâ†’0 und Fade-out. UnterstÃ¼tzt Direktbilder, Sprite-Sheet-Frames und einfarbige Sprites.
    - `pop` â€” Kombination: Kurz aufblÃ¤hen (grow 1.3x) â†’ dann explode. Simuliert Platzen wie bei Luftballon.
    - `fadeIn` â€” Sanftes Einblenden (visible=true + Opacity 0â†’1)
    - `fadeOut` â€” Sanftes Ausblenden (Opacity 1â†’0 â†’ visible=false)
    - `spin` â€” Rotation um eigene Achse (konfigurierbare Gradzahl)
    - `wobble` â€” Wackel-Effekt (Sinus-basierte Hin-und-Her-Rotation mit DÃ¤mpfung)
  - Neue dedizierte Action `sprite_animate`: Frame-Animation fÃ¼r TImageList (imageIndex von Frame A â†’ Frame B, einmalig)
  - **Dynamic Inspector (visibleWhen)** (`InspectorRenderer.ts`, `ActionRegistry.ts`): Parameter in Actions unterstÃ¼tzen jetzt bedingte Sichtbarkeit. ActionParams wie `targetScale` oder `fragments` werden nur noch angezeigt, wenn der entsprechende Effekt (z.B. grow oder explode) ausgewÃ¤hlt ist. 

## [3.30.0] - 2026-04-02
### Added
- **TSprite + TImageList Integration** (`src/components/TSprite.ts`, `SpriteRenderer.ts`):
  - Sprites kÃ¶nnen nun optional ein Teilbild aus einem Sprite-Sheet (`TImageList`) anstelle eines direkten Bildes (`backgroundImage`) anzeigen.
  - Neue Properties: `imageListId` (Verweis auf eine TImageList) und `imageIndex` (0-basierter Index des Teilbildes).
  - Der `SpriteRenderer` erkennt die VerknÃ¼pfung und wendet (falls die Liste existiert) die passende `background-position` auf ein inneres DIV-Layer an. Bei Nicht-Auffinden auf der Stage wird die `ProjectRegistry` konsultiert (Fallback fÃ¼r ungesyncte globale ImageLists).
  - RÃ¼ckwÃ¤rtskompatibilitÃ¤t bleibt bestehen: Ohne ImageList rendert TSprite weiterhin als performantes `<img />`-Tag mit Hardware-Beschleunigung.

### Fixed
- **Sprite-Sheet-Rendering im Editor** (`SpriteRenderer.ts`, `InspectorRenderer.ts`):
  - Bug behoben: Das Ã„ndern von `imageListId` und `imageIndex` im Inspector lÃ¶ste keine visuelle Aktualisierung der Stage aus.
  - Ursache: Die `imageLists`-Dropdown-Source generierte kein Leer-Option; ohne diese konnte kein initialer Wechsel von â€žleer" zu einer konkreten TImageList erfolgen.
  - Fix: Leere â€žâ€” Keine â€”"-Option als Standardwert im `imageLists`-Dropdown hinzugefÃ¼gt.
  - RÃ¼ckwÃ¤rtskompatibilitÃ¤t bleibt bestehen: Ohne ImageList rendert TSprite weiterhin als performantes `<img />`-Tag mit Hardware-Beschleunigung.
- **TImageList â€” Sprite-Sheet-Komponente** (`src/components/TImageList.ts` [NEU]):
  - Erbt von `TImage`. Zeigt ein einzelnes Teilbild aus einem Sprite-Sheet (Rasterbild) an.
  - Properties: `imageCountHorizontal`, `imageCountVertical`, `currentImageNumber` (0-basiert).
  - Berechnete Read-Only Properties: `maxImageCount` (H Ã— V), `frameWidthPercent`, `frameHeightPercent`, `currentRow`, `currentColumn`, `backgroundPositionX`, `backgroundPositionY`.
  - Inspector-Button â€žðŸŽžï¸� Editor Ã¶ffnen" startet den dedizierten ImageListEditor-Dialog.
  - Event: `onFrameChange`.
- **ImageListEditorDialog** (`src/editor/inspector/ImageListEditorDialog.ts` [NEU]):
  - Modaler Dialog zur visuellen Konfiguration von Sprite-Sheets.
  - Links: Canvas-basierte Sprite-Sheet-Vorschau mit Raster-Overlay (gestrichelte Linien), klickbare Einzelbilder.
  - Rechts: Raster-Konfiguration (H/V), Frame-Navigation (â—€ â–¶), Einzelbild-Vorschau mit Schachbrett-Transparenz.
  - Quellbild-Auswahl via MediaPickerDialog.
  - Ã„hnliche Architektur wie `MediaPickerDialog` (statische `show()`-Methode, Promise-basiert).
- **Integration**:
  - `ComponentRegistry.ts`: Register + TypeMapping (`ImageList` â†’ `TImageList`).
  - `Serialization.ts`: Hydration-Case fÃ¼r TImageList und TSprite-Properties.
  - `toolbox.json`: Eintrag in Kategorie Media (Icon: ðŸŽžï¸�, Label: Image List).
  - `StageRenderer.ts`: Rendering via CSS `background-size`/`background-position` Sprite-Clipping. Im Editor-Modus mit Frame-Nummer-Badge.
  - `InspectorRenderer.ts`: Die DataSource `imageLists` ermÃ¶glicht die Auswahl dynamischer ImageList-Instanzen im Inspector.
  - `InspectorActionHandler.ts`: Action `openImageListEditor` Ã¶ffnet den Dialog und wendet Ergebnisse Ã¼ber ProjectStore an.

### Fixed
- **Default-GrÃ¶ÃŸen: Pixel statt Grid-Zellen bei 10 Komponenten** â€” Beim Erstellen via Toolbox waren folgende Komponenten massiv zu groÃŸ, da die Konstruktoren Pixelwerte statt Grid-Zellen-Werte verwendeten:
  - `TImage` 100Ã—100 â†’ **8Ã—6**, `TImageList` 100Ã—100 â†’ **8Ã—6**, `TShape` 100Ã—100 â†’ **4Ã—4**
  - `TLabel` 100Ã—20 â†’ **8Ã—2**, `TNumberLabel` 100Ã—20 â†’ **8Ã—2**
  - `TGameState` 100Ã—40 â†’ **4Ã—2** (Service-Komponente)
  - `TDialogRoot` 400Ã—300 â†’ **20Ã—15** (Position 100,100 â†’ **5,5**)
  - `TInfoWindow` 320Ã—180 â†’ **16Ã—9**
  - `TStatusBar` 800Ã—28 â†’ **40Ã—2**, `TToast` 320Ã—60 â†’ **16Ã—3**
- **Drag & Drop Positionierungs-Bug (Snap-Back)** â€” Ein Regression-Bug, der dafÃ¼r sorgte, dass gezogene Objekte auf der Stage wieder an ihre alte Position zurÃ¼cksprangen oder der Inspector nicht synchron aktualisiert wurde, ist behoben.
  - Ursache: Die strikte Regel, im `store-dispatch` Flow kein `refreshAllViews()` aufzurufen, verhinderte das Springen der DOM-Elemente, koppelte den Inspector jedoch von Live-Updates ab.
  - Fix: `Editor.ts` ruft nun bei Store-Dispatches fÃ¼r das *gerade selektierte* Element gezielt `inspector.update()` auf. Der Drag ist nun performant, ohne DOM-Recreation-Blinken, und der Inspector fliegt live mit.
- **Serialization Proxy Bug** â€” Ein TypeError beim Laden ("Cannot set property maxImageCount... which has only a getter") wurde gefixt, indem Getter-Only-Properties (wie das neue `maxImageCount` bei `TImageList`) in `Serialization.ts` konsistent der `reservedKeys`-Liste hinzugefÃ¼gt wurden.
- **Inspector `boxShadow`** â€” `boxShadow` wurde als editierbare Eigenschaft im Inspector fÃ¼r alle Komponenten unter der Gruppe "GLOW-EFFEKT" nutzbar gemacht, sodass nun individuelle visuelle Styles direkt in der UI angepasst werden kÃ¶nnen.
- **Transparente Bilder (PNG) Hintergrund-Fix** â€” `TImage` und `TImageList` haben nun standardmÃ¤ÃŸig `backgroundColor = 'transparent'`. Der stÃ¶rende schwarze Hintergrund beim Rendern von transparenten PNGs in der Game Engine wurde dadurch behoben. Der globale `box-shadow` fÃ¼r `.game-object` in `style.css`, welcher unerwÃ¼nschte Rahmen um eigentlich transparente Bilder erzeugte, wurde entfernt.
- **Export-Rendering Bug (DeepClean ZerstÃ¶rung)** â€” Beim Standalone-HTML-Export (`bundle:runtime`) wurden fÃ¤lschlicherweise alle Instanz-Variablen mit PrÃ¤fix `_` (wie `_backgroundImage` und viele Vue/Reactive Interna wie `__v_isRef`) in `GameExporter.ts` bereinigt. Dadurch waren alle exportierten Objekte unsichtbar oder besaÃŸen keine Styles mehr. Die pauschale Bereinigung wurde durch eine auf Editor-Keys beschrÃ¤nkte Whitelist abgelÃ¶st.
- **Button Hover/Klick-Animation Bug (Transform-ZerstÃ¶rung)** â€” Ein Fehler bei der Darstellung geklickter Buttons im Game/Runtime-Mode wurde behoben. Die bisherige Zuweisung `el.style.scale = '0.98'` manipulierte das Ã¼bergeordnete `translate3d`-Koordinatensystem und fÃ¼hrte zu PositionssprÃ¼ngen des Buttons zur Mitte (origin) der Stage. Der Renderer hÃ¤ngt die Skalierung nun sauber an die bestehende GPU-Transformation an (`transform += ' scale(0.98)'`), sodass der Button nur noch in sich schrumpft und stabil an seiner Koordinate verankert bleibt.

## [3.29.6] - 2026-03-31
### Refactoring & CleanCode
- **FlowEditor God-Class weiter entschlackt:** Die Datei `FlowEditor.ts` (1273 Zeilen) wurde modularisiert und hÃ¤lt nun das <1000 Zeilen Limit streng ein (~900 Zeilen). DOM-Generierung fÃ¼r die Toolbar sowie komplexe Dropdown-Logiken (`updateFlowSelector`) wurden in `FlowToolbarManager` verschoben. Das Live-Code Overlay (Pascal) wird nun Ã¼ber den `FlowPascalManager` aufgebaut und gerendert.

### Refactoring & CleanCode
- **JSONDialogRenderer God-Class aufgelÃ¶st:** Die Datei `JSONDialogRenderer.ts` (1302 Zeilen) wurde vollstÃ¤ndig modularisiert und das Interface `IDialogContext` eingefÃ¼hrt. Renderer und Code-DOM-Manipulationen wurden in `DialogDOMBuilder`, `DialogActionHandler`, `DialogStateManager`, `DialogExpressionEvaluator` und `DialogDomainHelper` abstrahiert. Dadurch ist die Hauptdatei auf saubere ~230 Zeilen gesunken.
- **StandardActions God-Class aufgelÃ¶st:** Die Datei `StandardActions.ts` (1305 Zeilen) wurde modularisiert und als Facade restrukturiert. Aktionen sind jetzt in dedizierten Dateien unter `src/runtime/actions/handlers/` gruppiert (`PropertyActions.ts`, `VariableActions.ts`, `CalculateActions.ts`, `HttpActions.ts` etc.). Die Hauptdatei hat nur noch ~20 Zeilen. Code-Duplikate (z.B. redundantes Registrieren der 'animate'-Aktion) wurden bereinigt.
- **InspectorHost God-Class aufgelÃ¶st:** Die Datei `InspectorHost.ts` wurde von massiven 1491 Zeilen auf schlanke 196 Zeilen reduziert (Einhaltung der <1000 Zeilen Guideline).
- **ZustÃ¤ndigkeits-Trennung (Module):** Komplexes Rendering in spezialisierte Klassen ausgelagert (`InspectorHeaderRenderer`, `InspectorPropertiesRenderer`, `InspectorSectionRenderer`, `InspectorLegacyRenderer`, `InspectorEventsRenderer`, `InspectorLogsRenderer`), gebunden Ã¼ber neues `IInspectorContext`-Interface. Das Inspector-System ist nun extrem wartbar und komponentenbasiert.

## [3.29.4] - 2026-03-30
### Fixed
- **Action Umbenennen E2E Fix & Two-Way-Binding KollisionsprÃ¼fung:**
  - Das "Action Name existiert bereits"-Alert erschien fÃ¤lschlicherweise bei der Eingabe im Inspector. Ursache: `FlowNodeHandler` manipulierte den Namen der Action direkt im Projekt (`Two-Way-Binding`), bevor `EditorCommandManager.renameObject` die globale Validierung (`projectRegistry.getActions()`) ausfÃ¼hrte. Die Validierung fand dadurch die grade eben umbenannte "eigene" Action und blockierte. 
  - Fix: Vorzeitiges Ãœberschreiben in `FlowNodeHandler` entfernt. Atomares Refactoring durch `EditorCommandManager`. 
  - E2E Test Locator `.context-menu-item` an aktuelle DOM-Struktur (`.context-menu div`) angepasst.
- **Flow-Condition Persistenz & Action-Typ-Inferenz:**
  - `FlowCondition.ts` nutzt nun direkte Setter in `applyChange()`, anstatt dass `PropertyHelper` die internen Datenstrukturen bypasst. `FlowNodeHandler` delegiert nun korrekt an `object.applyChange()` fÃ¼r Nodes, die `IInspectable` implementieren.
  - Im `TaskConditionEvaluator` greift `resolveVarPath` nun auf `globalVars` zurÃ¼ck, um Komponenten-Referenzen in If-Verzweigungen aufzulÃ¶sen. Die `GameRuntime` injiziert hierfÃ¼r alle Komponentenobjekte direkt in die `eventVars`.
  - Fix im `ActionExecutor`: Wenn aus dem Projekt-JSON benutzerdefinierte Actions ohne explizite `type`-Definition aber mit `target` und `changes` geladen werden (Standard-Verhalten des FlowEditors), greift nun eine automatische Typ-Inferenz (`type = 'property'`). Bisher wurden diese Actions ohne Fehler stumm vom Executor Ã¼bersprungen, was dazu fÃ¼hrte, dass visuelle Flows an dieser Stelle abbrachen.

### Added
- **ElementÃ¼bersicht: LÃ¶sch-Funktion fÃ¼r unbenutzte Elemente** (`FlowContextMenuProvider.ts`):
  - Neues dediziertes KontextmenÃ¼ (`showOverviewContextMenu`) fÃ¼r Nodes in der ElementÃ¼bersicht.
  - **LÃ¶sch-Option** (ðŸ—‘ï¸�) fÃ¼r unbenutzte Actions, Tasks und Variablen, die in keinem Flow-Diagramm referenziert sind.
  - **Referenz-Info** (ðŸ“‹) zeigt Verwendungsorte aktiver Elemente als Alert-Dialog.
  - **Schutzmechanismus** (ðŸ”’) fÃ¼r verwendete Elemente â€” LÃ¶schen wird mit BegrÃ¼ndung blockiert.
  - Navigation (âž”) zum Task-Flow direkt aus der Ãœbersicht.
  - LÃ¶schung erfolgt direkt Ã¼ber `RefactoringManager.deleteAction/deleteTask/deleteVariable` mit anschlieÃŸendem automatischen Reload der Ãœbersicht (Bypass `this.host.currentFlowContext = ''`).

### Added
- **FlowCondition Inspector (If-Knoten):** Dynamisches Dropdown-Formular fÃ¼r *Links Wert* und *Rechts Wert* implementiert (Auswahl aus existierenden Variablen und Komponenten-Eigenschaften statt reiner Text-Eingabe).

### Fixed
- **MenuBar/UI-Sync:** Das Label der aktuellen Stage ("Aktuelle Stage: ...") in der horizontalen MenÃ¼leiste aktualisiert sich nun reaktiv (live), wenn eine Stage umbenannt wird.
- **Rename-Validator Bug (Actions & Tasks)**: Behebung eines Fehlers in `EditorCommandManager.renameObject`, der das Umbenennen mit "Name existiert bereits" blockierte. Die Validierung fÃ¼r `validateTaskName` und Action-Umbenennungen ignoriert nun ordnungsgemÃ¤ÃŸ die jeweils eigene Knoten-ID, damit Two-Way-Bindings die PrÃ¼fung nicht zerschieÃŸen.

### Improved
- **Inspector UX - Scope-Verschlankung:** Das Property `scope` (global, stage) wurde ersatzlos aus dem Eigenschafts-Editor aller Komponenten und Variablen entfernt. Globale Elemente definieren sich von Natur aus exklusiv durch ihre physikalische ZugehÃ¶rigkeit zur *Blueprint-Stage*. Globale Elemente werden nun nur noch Ã¼ber den Mechanismus "Verschieben/Kopieren in Blueprint Stage" orchestriert, um die Single Source of Truth aufrechtzuerhalten.
- **ElementÃ¼bersicht UX & Visualisierung** (`FlowElement.ts`, `InspectorHost.ts`):
  - **Unbenutzte Elemente:** Neben der roten Umrandung wird nun ein deutlicher "âš ï¸� UNBENUTZT"-Badge an verwaisten Tasks/Actions angezeigt.
  - **Hover Usage-Info:** Das native Browser-Tooltip (`title`) fÃ¼r Verwendungs-Referenzen (das eine ZeitverzÃ¶gerung hatte) wurde durch einen sofort sichtbaren, benutzerdefinierten HTML-Tooltip (mit Glassmorphism-Design) ersetzt. FÃ¤hrt der User Ã¼ber eine Aktion oder einen Task, wird sofort ein Fenster eingebunden, das explizit alle referenzierten Tasks, Target-Objekte oder Caller-Events auflistet. Tooltips Ã¼berlappen jetzt durch Z-Index Elevation garantiert umliegende Knoten.
  - **Inspector Header Dropdown:** Im Inspector-Header blendet sich das Dropdown (Komponenten/Variablen-Auswahl) bei FlowNodes. Projekt, oder globaler Stage-Selektion jetzt konsequent aus. Stattdessen wird nur das simple statische Label gerendert, da Dropdown-Wechsel in FlowNodes oder abstrakten Game Objects sinnfrei ist.

### Fixed
- **ElementÃ¼bersicht: Ungewollte Stage-Fokussierung** (`EditorCommandManager.ts`):
  - Klickte man in der ElementÃ¼bersicht auf den leeren Hintergrund (Deselect All), wurde standardmÃ¤ÃŸig das globale "Active Stage"-System-Objekt in den Inspector geladen, was verwirrend war. Dies wurde unterbunden: Im Kontext `element-overview` fÃ¼hrt ein Deselect() nun ordnungsgemÃ¤ÃŸ zu einem leeren Inspector ("Kein Objekt ausgewÃ¤hlt").
- **ElementÃ¼bersicht: KontextmenÃ¼ zeigte falsches Embedded-MenÃ¼** (`FlowContextMenuProvider.ts`):
  - Overview-Nodes erben `isLinked: true` durch das Spreizen der Action-Daten (`{ ...action, isOverviewLink: true }`).
  - Der `isOverviewLink`-Check wird nun **vor** dem `isLinked`-Check ausgefÃ¼hrt, damit das korrekte Overview-MenÃ¼ angezeigt wird.
- **ElementÃ¼bersicht: UI aktualisierte sich nicht nach LÃ¶schvorgÃ¤ngen** (`FlowContextMenuProvider.ts`):
  - Der Aufruf von `switchActionFlow('element-overview')` brach frÃ¼hzeitig ab (`this.currentFlowContext === context`), wodurch die Ãœbersicht nach dem LÃ¶schen nicht re-rendert wurde. Behoben durch explizites ZurÃ¼cksetzen des `currentFlowContext` auf einen leeren String vor dem Switch.

## [3.29.3] - 2026-03-29
### Improved
- **Event-AufrÃ¤umung: Nicht-sichtbare Komponenten** (`TWindow.ts`):
  - `TWindow.getEvents()` filtert jetzt UI-Events (`onClick`, `onFocus`, `onBlur`, `onDragStart`, `onDragEnd`, `onDrop`) automatisch aus, wenn die Komponente `isHiddenInRun = true` ist.
  - Betrifft ~18 Unterklassen: TTimer, TGameLoop, TInputController, TAudio, TVariable (+ alle Variablen-Unterklassen), THeartbeat, THandshake, TStageController, TSpriteTemplate, TStatusBar, TToast, TGameServer, TGameState.
  - Zentrale LÃ¶sung: Alle betroffenen Komponenten profitieren automatisch Ã¼ber Vererbung (`...super.getEvents()` liefert jetzt `[]` statt der UI-Events).

### Changed
- **TRepeater â†’ TIntervalTimer** (`TIntervalTimer.ts` [NEU], `TRepeater.ts` [GELÃ–SCHT]):
  - `TRepeater` wurde durch eine neue, saubere Komponente `TIntervalTimer` ersetzt.
  - Neue Eigenschaften: `duration` (Intervall-Dauer in ms), `count` (Anzahl, 0=âˆž), `enabled`.
  - Neue Events: `onIntervall` (pro abgelaufenem Intervall), `onTimeout` (alle Intervalle abgelaufen).
  - AbwÃ¤rtskompatibilitÃ¤t: Alte Projekte mit `className: "TRepeater"` werden automatisch als TIntervalTimer geladen.
  - Migriert in: `Serialization.ts`, `ComponentRegistry.ts`, `StageRenderer.ts`, `JSONDialogRenderer.ts`, `toolbox_horizontal.json`.
  - Toolbox: Kategorie "System", Icon â�±ï¸�, Label "Intervall-Timer".

### Added
- **TGameServer Events** (`TGameServer.ts`):
  - Neue `getEvents()` Methode mit 8 Events: `onConnected`, `onDisconnected`, `onRoomCreated`, `onRoomJoined`, `onPlayerJoined`, `onPlayerLeft`, `onGameStart`, `onError`.
  - Diese Events wurden bereits programmatisch via `triggerEvent()` gefeuert â€“ bisher fehlte nur die Deklaration fÃ¼r den Inspector/Flow-Editor.
- **TGameState Events** (`TGameState.ts`):
  - Neue `getEvents()` Methode mit 4 Events: `onStateChanged`, `onGameOver`, `onLifeLost`, `onScoreChanged`.

## [3.29.2] - 2026-03-28
### Improved
- **Flow-Editor Toolbox aufgerÃ¤umt**:
  - UnnÃ¶tige/redundante Flow-Elemente aus der Toolbox (`FlowToolbox.ts`) entfernt, um die Ãœbersicht fÃ¼r den User zu maximieren: `Variable`, `Store Token`, `Variable Set`, `For Loop`, `While Loop` und `Repeat Until`.
  - Statt dedizierter Nodes sollen Variablen und Tokens Ã¼ber den Action-Configurator (mit Dropdown) modifiziert werden, und Loops kÃ¶nnen Ã¼ber die Pfeil-Architektur / Task-Routing gelÃ¶st werden, was visuell wesentlich Ã¼bersichtlicher ist.
  - **Dynamischer Filter (Toolbox & Inspector Settings):** `HTTP Request` und `Data Action` tauchen in der Toolbox nun *nur dann* auf, wenn das Projekt einen aktiven `TGameServer` enthÃ¤lt. Wird dieser gelÃ¶scht, verschwinden die Actions automatisch wieder aus der Ansicht. Ebenso werden im Action-Type-Dropdown (Inspector) stark Server-bezogene Funktionen wie `HTTP Antwort senden` und `API Request verarbeiten` nur bei Server-Projekten angeboten. Multiplayer-Aktionen (`Raum erstellen/beitreten`) sind an die Existenz eines `TRemoteGameManager` gekoppelt. Redundante oder verwirrende Typen (`Variable setzen (doppelt)`, `Spiel wechseln`, `Login Request`, `Token speichern/lÃ¶schen`) wurden aus den Dropdowns komplett versteckt.
- **Standalone Export (Runtime-Bundle) & Rendering-Optimierungen aktualisiert** (`player-standalone.ts`):
  - Der `UniversalPlayer` (standalone Engine) Ã¼berschrieb im 60Hz Fast-Path fÃ¤lschlicherweise die GPU-Beschleunigung durch direkte DOM-Manipulation (`el.style.left/top`). Der Render-Pfad delegiert nun direkt an den performanten `StageRenderer.updateSpritePositions(sprites)`.
  - `public/runtime-standalone.js` neu kompiliert: Alle Render-Optimierungen aus dem Editor (Jitter-Fix, transparente Bild-HintergrÃ¼nde statt roter Artefakte, Ghost-Blink Fix bei Full Renders) greifen nun 1:1 im exportierten Spiel.
- **Bugfix: TSpriteTemplate Sichtbarkeit**:
  - `TSpriteTemplate` tauchte im Run-Modus fehlerhaft auf der BÃ¼hne auf. Ursache war die Methode `updateSpritePositions(sprites)` im `StageRenderer`, die durch den Performance-Fast-Path das Flag `isHiddenInRun` ignorierte und das CSS `display`-Property hart auf `flex` zurÃ¼cksetzte. Die SichtbarkeitsprÃ¼fung berÃ¼cksichtigt jetzt `isHiddenInRun` strikt auch im 60fps-Loop. (Bundle neu erzeugt).
- **Feature: Konfigurierbare Hitboxen fÃ¼r Sprites** (`TSprite.ts`, `StageRenderer.ts`):
  - Sprites verfÃ¼gen jetzt Ã¼ber eine optionale, frei konfigurierbare Hitbox (`customHitbox`), die von der visuellen GrÃ¶ÃŸe abweichen kann.
  - Neue Inspector-Eigenschaften: `hitboxOffsetX`, `hitboxOffsetY`, `hitboxWidth`, `hitboxHeight` sowie `hitboxShape` (`auto`, `rect`, `circle`).
  - Eine kreisfÃ¶rmige Kollisionsabfrage (`circle`) berechnet echte radiale Distanzen (anstatt AABB/Rechtecke). Im Falle von `rect` vs. `circle` wird eine prÃ¤zise AABB-zu-Kreis-DistanzprÃ¼fung durchgefÃ¼hrt.
  - SÃ¤mtliche Boundary- (`isWithinBounds`) und Kollisions-Logik (`checkCollision`, `getCollisionOverlap`) basiert nun auf der logischen Hitbox und nicht mehr hart verdrahtet auf `x`/`width`.
  - Im Editor (Bau-Modus) wird eine benutzerdefinierte Hitbox durch einen roten, gestrichelten Rahmen visuell dargestellt, damit der Nutzer die Offsets pixelgenau prÃ¼fen kann. Zur Laufzeit ist die Hitbox-Skizze unsichtbar. Aufgenommen in das Standalone-Bundle.
- **Architektur & Feature: Globales Undo/Redo an UI angeschlossen**:
  - Die im Hintergrund bereits mitlaufenden Snapshots (`SnapshotManager`) wurden systemweit ins User-Interface Ã¼berfÃ¼hrt. Dazu wurde eine neue MenÃ¼-Kategorie "Bearbeiten" generiert (`menu_bar.json`), die die Buttons "RÃ¼ckgÃ¤ngig" (`Strg+Z`) und "Wiederholen" (`Strg+Y`) enthÃ¤lt.
  - Der alte, fehleranfÃ¤llige `EditorUndoManager` sowie der `ChangeRecorder` wurden abgekoppelt; das BetÃ¤tigen der Buttons oder Hotkeys erzwingt nun ein exaktes ZurÃ¼ckladen (inkl. Neu-Rendern) von vollstÃ¤ndigen JSON-Kopien (Project SSoT). Fehlerhafte Ansichten durch desynchronisierte ZustÃ¤nde gehÃ¶ren damit der Vergangenheit an.
- **GPU-Textur-Compositing fÃ¼r Image-Sprites** (`StageRenderer.ts`):
  - Sprite-Bilder werden nicht mehr als CSS `background-image` gerendert (CPU-Rasterung bei translate3d), sondern als natives `<img class="sprite-image-layer">` Tag (eigene GPU-VRAM-Textur, hardwarebeschleunigtes Compositing).
  - `Math.round()` fÃ¼r translate3d-Koordinaten entfernt: Durch die <img>-Tag-Umstellung sind Subpixel-genaue Positionierungen jetzt jitterfrei mÃ¶glich.
  - Debug-Logging (`[Jitter-Debug]`) aus dem Fast-Path `updateSpritePositions()` entfernt.
  - Skalierbar fÃ¼r 50+ gleichzeitig animierte Sprites ohne Performanceverlust.
### Fixed
- **Top-Left (0,0) Ghost-Blink bei JEDEM Full Render behoben** (`StageRenderer.ts`):
  - Der `FULL RENDER` Ã¼berschrieb fÃ¤lschlicherweise das hardwarebeschleunigte `translate3d(x,y,0)` mit einem leeren String, falls das Objekt (Player, Target, Bullets) keine benutzerdefinierte CSS-Transform besaÃŸ. Dadurch wachten alle Objekte bei jedem Score-Update fÃ¼r einen Sekundenbruchteil ohne Koordinaten bei (0,0) oben links auf, bevor der 60Hz Fast-Path sie wieder auf ihre korrekten Koordinaten teleportierte.
- **Pool-Sprite Aufblitz-Bug** (`StageRenderer.ts`):
  - Pool-Sprites (Bullets etc.) blitzten beim Spawnen/Despawnen kurz an Position (0,0) auf, weil die `visible`-Property im 60Hz Fast-Path `updateSpritePositions()` nicht synchronisiert wurde. Der Fast-Path prÃ¼ft jetzt `obj.visible` und setzt `display: none/flex` sofort, ohne auf den nÃ¤chsten vollen Render-Zyklus zu warten.
- **Ghost-Image-Bug bei TSpriteTemplate** (`StageRenderer.ts`):
  - `isHiddenInRun` wurde in der Haupt-Visibility-Logik von `renderObjects()` nicht geprÃ¼ft. Dadurch waren Objekte wie TSpriteTemplate (BulletTemplate) mit `visible:true` und `isHiddenInRun:true` im Run-Mode sichtbar â€“ inklusive ihrem Bild. Das Template-Bild erschien als â€žGeister-Image" beim SchieÃŸen/Spawnen.
- **Bildschirm-Blink bei SpritePool.acquire() / Target-Bounces** (`GameRuntime.ts`):
  - `visible`, `_prevVelocityX`, `_prevVelocityY`, `_prevX` und `_prevY` fehlten im SPRITE_PROPS Reactive-Filter. Jeder `SpritePool.acquire()` oder Boundary-Bounce (Kollisionsabpraller beim Target) lÃ¶ste einen **vollstÃ¤ndigen** `renderObjects()` Re-Render ALLER Objekte aus. Dadurch blitzten Player, Target und alle Pool-Sprites stÃ¤ndig auf. Fix: Diese Fast-Path-Handled-Properties triggern keinen globalen Stage-Redraw mehr.
- **Top-Left (0,0) Ghost-Blink beim SchieÃŸen behoben** (`GameRuntime.ts`):
  - `spawnObject` und `destroyObject` haben explizit `this.options.onRender()` aufgerufen, um das DOM-Element der erzeugten Kugel sichtbar zu machen. Da die Sichtbarkeit (`display: none` zu `flex`) jedoch bereits hochperformant im 60Hz-Fast-Path (`updateSpritePositions`) erledigt wird, war dieser zusÃ¤tzliche Full-Render redundant und verursachte ein kurzes Aufblitzen aller UI-Elemente und Sprites an der Nullposition (Top-Left) vor dem Hardware-Transform. Der Aufruf wurde restlos entfernt.
- **Anti-Blink bei DOM-Element-Erstellung** (`StageRenderer.ts`):
  - Neue DOM-Elemente starteten mit `display: flex` und wurden sofort an den DOM angehÃ¤ngt, bevor Position/Transform gesetzt wurde â†’ kurzes Aufblitzen bei (0,0). Fix: Neue Elemente starten jetzt mit `display: none` und werden erst nach vollstÃ¤ndiger Konfiguration sichtbar.

## [3.29.1] - 2026-03-27
### Added
- **Import-Tab** in der Toolbox-Sidebar (`EditorViewManager.ts`):
  - Textarea zum EinfÃ¼gen von Projekt-JSON (Ctrl+V)
  - Live-Validierung: JSON-Syntax + GCS-Projektstruktur (Name, Stages, Komponenten, Tasks)
  - "ðŸ“¥ Laden" Button (mit BestÃ¤tigungsdialog)
  - "ðŸ“‹ Aktuelles Projekt kopieren" Button (JSON â†’ Zwischenablage)
- **Media-Picker Dialoge** (`MediaPickerDialog.ts`):
  - **Image-Picker:** Thumbnail-Grid (4 Spalten) mit Ordner-Navigation und Breadcrumb. Ersetzt `prompt()`.
  - **Audio-Picker:** Dateiliste mit â–¶ï¸� Play / â�¹ Stop Buttons und Inline-Playback.
  - **Video-Picker:** Dateiliste mit â–¶ï¸� Vorschau und Inline-Video-Player.
  - Neues Manifest-Script: `scripts/generate-media-manifest.ts` scannt `public/images/`, `audio/`, `videos/`.
- **Neue Property-Types** (`InspectorTypes.ts`): `audio_picker`, `video_picker` im Union-Type.
### Improved
- **GPU-Hardwarebeschleunigung (Anti-Jitter) in StageRenderer** (`StageRenderer.ts`):
  - Um das Ruckeln (Choppiness) bewegter Image-Sprites im Run-Mode zu verhindern, wurde das klassische Layout (`left`, `top`) komplett auf Hardware-`translate3d` umgestellt.
  - Das Grid-Resizing-System (cellSize) bleibt dabei vollstÃ¤ndig intakt, jedoch lÃ¤uft die Subpixel-Positionierung der Bilder nun auf der dedizierten Grafikkarte butterweich bei 60 FPS.
  - Fix **Subpixel Tearing** *(ZwischenlÃ¶sung, ersetzt in v3.29.2)*: Float-Koordinaten bei Bitmaps wurden via `Math.round()` als Integer auf die GPU gesendet. Ersetzt durch natives `<img>`-Tag GPU-Compositing in v3.29.2.
  - Fix **Doppel-Loops & Fallback-Ticker**: Der `AnimationTicker` Fallback im EditorRunMode wurde entfernt, die GameRuntime initialisiert und startet den GameLoopManager nun EXKLUSIV, was extreme Physics-Microstutter eliminiert.
  - Fix **DeltaTime-Smoothing**: In `GameLoopManager.ts` wird das errechnete `deltaTime` nun fÃ¼r 60FPS Frameraten auf exakte `0.016666s` geclampt, um Physik-Ruckler durch Browser-Timer InstabilitÃ¤ten aus der Berechnung fernzuhalten.
- **Inspector-Bereinigung fÃ¼r unsichtbare Komponenten** (`TComponent.ts`):
  - Service-Komponenten und Variablen (`isHiddenInRun = true`) zeigen im Inspector keine rein visuellen Property-Gruppen mehr an (STIL, GLOW-EFFEKT, TYPOGRAFIE, INTERAKTION, GEOMETRIE). Nur noch funktional relevante Gruppen (IDENTITÃ„T, komponentenspezifische) werden angezeigt.
  - Betrifft 22 Komponenten automatisch Ã¼ber Vererbung.
- **VergrÃ¶ÃŸerte Darstellung unsichtbarer Komponenten**:
  - StandardgrÃ¶ÃŸe von 3Ã—1 auf 4Ã—2 Grid-Einheiten erhÃ¶ht fÃ¼r bessere Lesbarkeit der Komponentennamen auf der Stage.
  - Betrifft: TTimer, TRepeater, TInputController, TGameServer, TGameLoop, TAudio, TTriggerVariable, TThresholdVariable, TRangeVariable, TRandomVariable, THeartbeat, THandshake, TListVariable, TBadge.

## [3.29.0] - 2026-03-26
### Added
- **Object Pool Pattern fÃ¼r dynamische Sprites** (`TSpriteTemplate.ts`, `SpritePool.ts`):
  - Neue Komponente `TSpriteTemplate` (Blueprint) mit Pool-Konfiguration (`poolSize`, `autoRecycle`, `lifetime`).
  - Neue Actions `spawn_object` und `destroy_object` zur Interaktion mit dem Pool zur Laufzeit.
  - LeistungsfÃ¤higes Instanz-Management: Alle Pool-Objekte werden beim Start vorhydriert und erhalten permanente DOM-Elemente. Dies lÃ¶st das bisherige Problem "Rendering-Disconnect", bei dem Klone nicht sichtbar wurden.
  - Unsichtbare Sprites (`visible: false`) im Leerlauf werden nun von den Physik-Checks (`updateSprites`, `checkCollisions`, `checkBoundaries`) des `GameLoopManager` ignoriert, was die CPU schont.
- **Normalisierte Target-AuflÃ¶sung** (`StandardActions.ts`):
  - Target-Strings wie `%Self%`, `%self%` oder `%Other%` werden vor der AuflÃ¶sung normalisiert.
  - Verbesserte UnterstÃ¼tzung in Actions (`spawn_object`, `destroy_object`, `negate`, etc.).
- **Intuitive Mathematische Formeln** (`ExpressionParser.ts`):
  - `type: 'calculate'` Actions und Expressions erlauben nun die direkte Eingabe nativer Template-Strings wie `${score} + 1` oder `${health} - 10`.
  - Die `evaluate()`-Methode wurde um einen Pre-Processor erweitert, der stÃ¶rende `${ }` und `%` Tags automatisch herausfiltert.
  - **Bugfix NaN/Suspicious Result:** Unbekannte Variablen (z. B. uninitialisiert vor Spielstart) werden konsequent als echter `ReferenceError` gefangen und zu `undefined` konvertiert, anstatt fÃ¤lschlicherweise als gebundene `undefined`-Parameter fÃ¼r die JavaScript Engine bereitgestellt zu werden. Dies verhindert das kollabieren zu `NaN`.
  - Dadurch entfallen Type-Cast-Hacks wie `Number(score || 0) + 1` im Inspector. Die Syntax fÃ¼r den Benutzer wird drastisch lesbarer.
- **Bugfixes fÃ¼r Variablen-Verlust zur Laufzeit** (`AgentController.ts`, `RuntimeVariableManager.ts`):
  - **Bugfix AgentController & Serialization:** Globale Variablen, die per Skript `addVariable` oder UI angelegt werden, erhalten nun strikt einen `className` (z. B. `TIntegerVariable`) zugewiesen. Ohne diesen wurden Variablen in `hydrateObjects()` beim Laden aus der Runtime stillschweigend verworfen, was zu `ReferenceErrors` beim Zugriff fÃ¼hrte.
  - **Bugfix Proxy Enumeration:** Ein doppelter und teilweise fehlgeschlagener `ownKeys` Proxy-Trap im `RuntimeVariableManager` wurde korrigiert. Der Spread-Operator bei der Bildung von `evalContext` kann nun wieder korrekt Ã¼ber die Variablen aus den Stages iterieren.
  - **Bugfix Inspector Rendering (Calculate Actions):** Fehlen von Formeln im FlowEditor-Inspector behoben. `FlowAction.ts` stellt nun native Getter/Setter fÃ¼r `formula` und das veraltete Attribut `expression` bereit, womit der Formulareditor diese Properties wieder korrekt befÃ¼llt und beim Ã„ndern migriert.
  - **Bugfix Run2 Event Loss / Session Cleanup (CRITICAL):** Bei aufeinanderfolgenden LÃ¤ufen (Run â†’ Stop â†’ Run) registrierte der `TInputController` keine Keyboard-Events mehr. **Root Cause:** `hydrateObjects()` gibt `instanceof TWindow`-Objekte unverÃ¤ndert zurÃ¼ck, so dass dieselbe TInputController-Instanz Ã¼ber Runs hinweg wiederverwendet wurde. Durch den Self-Heal-Mechanismus in `onKeyDown()` wurde `isActive` fÃ¤lschlich auf `true` gesetzt, obwohl die Window-Listener bereits entfernt waren â€” der Guard in `start()` verhinderte dann die Neuregistrierung. **Fix:** 1) `GameRuntime.initInputControllers()` fÃ¼hrt jetzt vor `init()/start()` ein `stop()` + `isActive=false` Force-Reset durch. 2) Self-Heal setzt `isActive` nicht mehr auf `true`.
  - **UX Bugfix Space-Key:** Die Leertaste (`Space`) sowie `Enter` wurden im `TInputController` in die Liste der `preventDefault()` Tasten aufgenommen. Dadurch lÃ¶st die Leertaste im Spielmodus nicht lÃ¤nger ungewollt Scroll-Bewegungen oder das Klicken auf IDE-Buttons aus.

## [3.28.0] - 2026-03-25
### Added
- **Inspector Visual Mockup Generator**: Ein neues Skript (`/tmp/gen_inspector_mockups_all.js`) erzeugt exakte visuelle Nachbildungen der Inspector-Ansichten (Glow, Stil, IdentitÃ¤t, Raster, Geometrie, Typografie, Ãœbersicht) als spielbare GCS-Stages. Diese kÃ¶nnen interaktiv zur Dokumentation im System genutzt werden.
- **TColorPicker Native Inspector-Farbwahl**: Die Laufzeit-Komponente `TColorPicker` bettet jetzt nativ das OS-Farbauswahl-UI (HTML5 `input type='color'`) via `StageRenderer` (`opacity: 0`) ein. So kÃ¶nnen im Run-Modus System-Farbdialoge aufgerufen werden, und ihr Wert wird dem `onChange` Event der Komponente weitergeleitet.
- **TDropdown Select Integration**: Ã„hnlich wie beim ColorPicker bettet die `TDropdown` Komponente nun ein funktionell nutzbares `<select>` Dropdown im Run-Modus des `StageRenderers` ein. Die `options` Property (kommagetrennter String) wird automatisch in native Html-Optionen gemappt, und bei Auswahl wird das `onChange` Event geworfen.
- **Stage Keyboard Nudging**: Markierte Komponenten lassen sich im GUI-Editor nun intuitiv mit den Pfeiltasten (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`) verschieben. Die Schrittweite betrÃ¤gt standardmÃ¤ÃŸig 1 Einheit (fÃ¼r Feinjustierung) und mit gehaltener `SHIFT`-Taste 5 Einheiten (fÃ¼r schnellere Positionierung). Eingaben in Textfelder unterbrechen den Nudge-Modus automatisch.

## [3.27.0] - 2026-03-24
### Added
- **TProgressBar** (`TProgressBar.ts`): Neuer Fortschrittsbalken-Baustein mit `value`, `maxValue`, `barColor`, `barBackgroundColor`, `showText`, `textTemplate`, `animateChanges`. Events: `onComplete`, `onEmpty`. Registriert in ComponentRegistry, Serialization und Toolbox (Kategorie: Game).
- **TGameState: Spielstand-Properties** (`TGameState.ts`): `score`, `level`, `lives`, `maxLives` + Inspector-Gruppe "Spielstand". State-Option `"won"` hinzugefÃ¼gt.
- **TThresholdVariable: Vergleichs-Operator** (`TThresholdVariable.ts`): Neues Property `comparison` (>=, <=, ==, >, <, !=) + Methode `isThresholdReached()`.
- **Inspector Textarea-Support** (`InspectorHost.ts`, `InspectorRenderer.ts`): native, mehrzeilige Textfelder (`type: 'textarea'`) werden im Inspector unterstÃ¼tzt, inkl. "Ãœbernehmen" Button fÃ¼r direkte Speicher-Anwendung.
- **TLabel Mehrzeilen-UnterstÃ¼tzung** (`TTextControl.ts`): Die Eigenschaft `text` nutzt nun den neuen Textarea-Typ, um lange FlieÃŸtexte in Dokumentations-Stages leichter pflegen zu kÃ¶nnen.
- **Stage Duplikation & Reordering** (`EditorStageManager.ts`, `MenuBar.ts`): Eine komplette Stage kann per Knopfdruck inkl. Tasks und Actions tiefen-geklont werden (neue IDs, alte Namen), ohne das Projekt zu korrumpieren. ZusÃ¤tzlich wurden Buttons zum Ã„ndern der Stage-Reihenfolge (Hoch/Runter) ins UI integriert.
- **System-Clipboard fÃ¼r Multi-Component Copy** (`EditorInteractionManager.ts`, `StageInteractionManager.ts`): Beim Markieren mehrerer Objekte und STRG+C wandern diese in ein globales Objekt, das Stage-Ã¼bergreifend gÃ¼ltig ist. Beim STRG+V werden die Namen in der Ziel-Stage geprÃ¼ft: wenn frei, bleibt der Originalname, sonst wird mit `_1` etc. hochgezÃ¤hlt.

### Changed
- **TRepeater â†’ Intervall-Timer** (`toolbox.json`): Toolbox-Label von "Repeater" auf "Intervall-Timer" umbenannt. Klassenname TRepeater bleibt zur KompatibilitÃ¤t.

### Fixed
- **SanitizationService: Task-Verlust durch Scope-Bleeding** (`SanitizationService.ts` -> `sanitizeProject()[L109-120]`): Behoben, dass valide, Stage-lokale Tasks (z. B. "NavNext") in Multi-Stage-Projekten nach dem Speichern vom Editor gelÃ¶scht wurden. Die Duplikat-Erkennung nutzte ein globales `seenTasks`-Set Ã¼ber alle Stages hinweg, was legitime gleichnamige Tasks in nachfolgenden Stages fÃ¤lschlicherweise als Duplikate flaggte und eliminierte. Das Set ist nun strikt an den Iterationszyklus einer einzelnen Stage gekapselt.
- **Inspector: Doppelte Typografie-Felder** (`TTextControl.ts`, `TWindow.ts`): TYPOGRAFIE-Gruppe wurde doppelt angezeigt da `TTextControl.getInspectorProperties()` dieselben Felder wie `TWindow` hinzufÃ¼gte. Doppelte EintrÃ¤ge aus TTextControl entfernt. `TWindow.fontFamily` von Freitext auf Select-Dropdown geÃ¤ndert.
- **TPanel Rendering-Bug** (`TPanel.ts`): Die harte VerknÃ¼pfung von `get caption()` an `this.name` wurde entfernt. Panels rendern nun nicht mehr fÃ¤lschlicherweise ihren Engine-Namen in GUI-Szenen und kÃ¶nnen vollstÃ¤ndig text-los (transparent) bleiben.
- **Inspector Textarea-Layout** (`InspectorHost.ts`): Das seitliche Label ("Inhalt") fÃ¼r Textareas wurde im Inspektor ausgeblendet, wodurch mehrzeilige Textfelder nun die vollen 100% Breite nutzen kÃ¶nnen.

## [3.26.4] - 2026-03-24
### Changed
- **Pascal-Panel: Task-gefilterter Code** (`FlowEditor.ts`, `PascalCodeGenerator.ts`):
  - Das Pascal-Panel zeigt jetzt nur den Code des aktuell geÃ¶ffneten Tasks (statt das gesamte Programm).
  - VAR-Sektion zeigt nur die im Task verwendeten Variablen, Komponenten und Task-Parameter.
  - Neue Methode `collectVariableNames()` sammelt rekursiv Variablen-Referenzen aus Conditions, Calculations, set_variable, increment und `${}`-Referenzen.
  - Bei globaler Ansicht / Ãœbersicht wird weiterhin das vollstÃ¤ndige Programm angezeigt.


### Fixed
- **Inspector: Objekt-Dropdown fÃ¼r registry-basierte Actions** (`FlowAction.ts`):
  - Actions wie `play_audio` und `stop_audio`, die einen `type: 'object'`-Parameter mit `source: 'objects'` verwenden, zeigten im Inspector kein Dropdown zur Auswahl der Zielkomponente (z.B. TAudio).
  - Ursache: `mapParameterTypeToInspector()` mappte `'object'` auf `'TObjectSelect'`, einen nicht existierenden Inspector-Typ. Dadurch wurde der Parameter als Freitext-Feld statt als Select-Dropdown gerendert.
  - Fix: Mapping von `'object'` auf `'select'` geÃ¤ndert. Die `source: 'objects'`-Property wird nun korrekt an `getOptionsFromSource()` weitergereicht, das alle Objekte der aktuellen Stage + Blueprint-Services auflistet.
- **TAudio: Kein Sound bei play_audio / stop_audio** (`Serialization.ts`):
  - `TAudio` fehlte im `case`-Block von `hydrateObjects()`. Dadurch wurde die Komponente beim Laden nicht als Klasseninstanz instanziiert, sondern blieb ein flaches JSON-Objekt ohne `play()` und `stop()` Methoden.
  - Der `play_audio`-Handler prÃ¼ft `typeof targetObj.play === 'function'`, was `false` ergab â†’ kein Sound.
  - Fix: `import { TAudio }` und `case 'TAudio'` im switch-Block hinzugefÃ¼gt. TAudio-Properties (`src`, `volume`, `loop`, `preload`) werden automatisch durch die Generic Property Restoration wiederhergestellt.
- **Audio-Assets: Fester Ordner `public/audio/`** (Projekt-JSON):
  - Audio-Dateien nach `public/audio/` verschoben (Vite liefert diese automatisch als statische Assets aus).
  - `Audio_25.src` von absolutem Windows-Pfad (`C:\Users\...`) auf relativen Web-Pfad (`/audio/ball_lost.wav`) korrigiert.
  - Unterverzeichnisse mÃ¶glich (z.B. `public/audio/Knalleffekte/`, `public/audio/Sirenen/`).


### Added (UX: Inspector & Sichtbarkeit)
- **Inspector Dropdown fÃ¼r Objekt-Auswahl** (`InspectorHost.ts`):
  - Der Inspector-Header enthÃ¤lt nun ein Dropdown, das alle Komponenten (Objekte & Variablen) der aktuellen Stage sowie globale (Blueprint) Komponenten auflistet.
  - ErmÃ¶glicht das schnelle Finden und Markieren von Komponenten, insbesondere von unsichtbaren.
- **Sichtbarkeits-Indikator im Editor** (`StageRenderer.ts`):
  - Komponenten, deren `visible`-Eigenschaft auf `false` gesetzt ist, verschwinden im Design-Modus nicht mehr komplett von der Stage.
  - Sie werden stattdessen halb-transparent (`opacity: 0.4`) und mit einem roten, gestrichelten Rahmen dargestellt.
  - Im Run-Modus verhalten sie sich weiterhin korrekt und sind unsichtbar.
### Added
- **TAudio Komponente (Zero-Latency Audio)**:
  - Komplett latenzfreie, auf der Web Audio API (`AudioContext`) basierende Audio-LÃ¶sung fÃ¼r GCS-Spiele.
  - Der `AudioManager` in der Engine lÃ¤dt Audio-Dateien beim Start in den RAM (`AudioBuffer`), um sofortige Starts (Polyphonie) zu ermÃ¶glichen.
  - Zwei neue Flow-Actions (`play_audio`, `stop_audio`) zur exakten Steuerung der Wiedergabe.
  - **Standalone Audio Export**: Der `GameExporter` konvertiert nun `TAudio.src` Pfade automatisch nativ in Base64 Data URLs, damit exportierte Spiele offline lauffÃ¤hig bleiben.
- **Neue Action: Komponenten animieren (`StandardActions.ts`)**:
  - Neue Action `animate` hinzugefÃ¼gt, mit der Komponenten (z. B. TButton, TLabel) dynamisch animiert werden kÃ¶nnen.
  - UnterstÃ¼tzte Effekte: `shake`, `pulse`, `bounce`, `fade`.
  - **Multi-Targeting:** Die Action akzeptiert als "Target" eine kommaseparierte Liste (z.B. `Zahl1, Zahl2, Ergebnis`), um mehrere Komponenten exakt synchron wackeln oder hÃ¼pfen zu lassen.
- **Erweitertes Animations-Core (`AnimationManager.ts`)**:
  - `addTween` unterstÃ¼tzt nun einen `onUpdate`-Callback fÃ¼r komplexe CSS-Transform-Animationen (scale, translateY).
### Added (UX: Debug Logging)
- **Copy-Button im Debug-Log-Viewer** (`TDebugLog.ts`):
  - Ein neuer Button "Copy" ermÃ¶glicht das Kopieren der aktuell angezeigten Logs in die Zwischenablage.
### Fixed (Runtime & Action-Logik)
- **Animation Bugfix (`require is not defined`)** (`AnimationManager.ts`):
  - In der Methode `addTween` kam es durch ein hart codiertes `require('./GameLoopManager')` in Browser-Umgebungen (wie Vite) zum Absturz, was alle Stage-Animationen blockierte.
  - Fix: Der Aufruf wurde durch ein asynchrones, natives ESM-`import()` ersetzt. ZirkulÃ¤re AbhÃ¤ngigkeiten werden weiterhin lazy aufgelÃ¶st, aber nativ und crashfrei. Die Stage-Animationen laufen wieder.
- **ExpressionParser `evaluate` Bug Fix** (`ExpressionParser.ts`):
  - Literale Zahlen wie `"0"`, `"60"` oder `"1"` wurden fÃ¤lschlicherweise als nested Properties ausgewertet (weil sie die Regex `^[\w.]+$` matchten) und lieferten `undefined` statt ihres Wertes zurÃ¼ck.
  - Fix: Direkte Erkennung und RÃ¼ckgabe von Zahlen sowie Booleans/Null/Undefined vor dem Regex-Match.
  - Verhindert NaN-Kollabieren von Timern und fehlerhafte Objekt-Stringifizierungen in der UI (`{"className":"TIntegerVariable"...}`).
- **`variable` Action: TVariable Update** (`StandardActions.ts`):
  - Action vom Typ `variable` hat den Wert zwar ins `context.vars` geschrieben, aber das zugrundeliegende `TVariable` Objekt (anders als bei `calculate`) nicht explizit aktualisiert.
  - Fix: Explizites Suchen und Setzen der `.value` Property des zugehÃ¶rigen `TVariable` Objekts eingebaut, damit der `PropertyWatcher` zuverlÃ¤ssig UI-Updates feuert.

## [3.26.1] - 2026-03-22
### Fixed
- **Drag-and-Drop Regression behoben** (`Editor.ts`):
  - Objekte sprangen nach Verschieben auf Stage an alte Position zurÃ¼ck
  - Root Cause: `ProjectStore.dispatch` â†’ Mediator-Bridge `'store-dispatch'` â†’ `refreshAllViews()` â†’ voller `flowEditor.setProject()` Rebuild
  - Fix: `'store-dispatch'`-Originator im `initMediator`-Listener gefiltert â€” nur `render()`, kein `setProject()`

## [3.26.0] - 2026-03-22
### Added (Demo 3: Mathe-Quiz)
- **Mathe-Quiz Builder** (`demos/builders/mathe-quiz.builder.ts`):
  - Additions-Quiz fÃ¼r Klasse 1 mit TRandomVariable, Conditions, Timer, Score
  - 5 Tasks, 26 Actions, 12 Objekte, Bindings, Event-Verkettung
  - Verzweigungen (addBranch) fÃ¼r Richtig/Falsch-PrÃ¼fung
  - TaskCalls (addTaskCall) fÃ¼r Task-Verkettung
- **ProjectBuilder erweitert** (`scripts/agent-run.ts`):
  - 8 neue Methoden: addVariable, bindVariable, setProperty, addBranch, addTaskCall, createSprite, createLabel
  - CLI-Guard fÃ¼r sauberen Import (kein process.exit bei Import als Modul)
- **Tests** (`tests/mathe_quiz.test.ts`): 10 Tests (Struktur, Objekte, Tasks, Branch, Bindings, Events, TaskCalls, Flows, Validierung)

## [3.25.0] - 2026-03-22
### Added (API-Realisierung Phase 2)
- **Sprite-Shortcuts** (`AgentController.ts`):
  - `createSprite()` â€” TSprite mit Physik-Defaults (velocity, collision, shape)
  - `createLabel()` â€” TLabel mit Binding + Style-Shortcuts
  - `setSpriteCollision()` â€” Kollisions-Konfiguration
  - `setSpriteVelocity()` â€” Geschwindigkeit setzen
- **Schema-API** (`AgentController.ts`):
  - `getComponentSchema(className)` â€” Properties, Methods, Events aus ComponentSchema.json
  - `setComponentSchema(schema)` â€” Schema laden (ESM-kompatibel)
- **Tests** (`agent_controller.test.ts`): 7 neue Tests (Phase 2 Sprite-Shortcuts + Schema)
- **Doku** (`AgentAPI.md`): Sprite-Shortcuts und Schema-API Sektionen hinzugefÃ¼gt

### Fixed
- **Flow-Editor** (`FlowAction.ts`): navigate_stage zeigt jetzt Stage-Name statt roher ID

## [3.24.0] - 2026-03-22
### Added (Stage-Import)
- **`EditorStageManager.importStageFromProject()`** (`EditorStageManager.ts`):
  - Importiert eine Stage aus einem externen Projekt inkl. aller AbhÃ¤ngigkeiten
  - Deep-Clone mit automatischer ID-Generierung (keine Kollisionen)
  - Blueprint-Merge: Referenzierte Actions, Tasks und Variablen aus dem Quell-Blueprint werden in den Ziel-Blueprint kopiert
  - Transitive Dependency-Resolution: Blueprint-Action-Targets werden rekursiv aufgelÃ¶st
  - Duplikat-Schutz: Bereits vorhandene Blueprint-Elemente werden nicht dupliziert
- **`Editor.importStageFromFile()`** (`Editor.ts`):
  - File-Picker fÃ¼r JSON-Projekte
  - Stage-Auswahl-Dialog (Dark-Theme, Checkboxen mit Statistiken)
  - Einzel- und Multi-Stage-Import unterstÃ¼tzt
- **MenÃ¼-Eintrag** (`EditorMenuManager.ts`): "ðŸ“¥ Stage importieren" im Stages-MenÃ¼
- **Tests** (`stage_import.test.ts`): 7 Tests (Basis, ID-Remap, Blueprint-Merge, Duplikat, Type-Konvertierung, Events)
### Added (API-Realisierung Phase 1 + 1.5)
- **Schema-Registry** (`docs/ComponentSchema.json`) [NEU]:
  - 13 Komponenten-Schemata (TSprite, TButton, TLabel, TTimer, TGameLoop, TGameState, TInputController, TIntegerVariable, TBooleanVariable, TStringVariable, TRandomVariable, TEdit)
  - 14 Action-Typen mit Pflichtparametern und Beispielen
  - 15 Variable-Typen katalogisiert
  - 7-Schritte-Semantik (Ziel â†’ Objekte â†’ Variablen â†’ Actions â†’ Tasks â†’ Events â†’ Test)
  - Lessons-Learned-Regeln (DO/DON'T)
- **API-Referenz** (`docs/AgentAPI.md`) [NEU]:
  - VollstÃ¤ndige Methoden-Referenz mit Signaturen, Parametern und Beispielen
  - Inventar-Tabellen (listStages, listTasks, listActions, etc.)
  - DO/DON'T-Regeln aus echten Fehlern der Raketen-Countdown-Entwicklung
- **CLI-Runner** (`scripts/agent-run.ts`) [NEU]:
  - Headless ProjectBuilder (keine Browser-AbhÃ¤ngigkeiten)
  - API-kompatible Schnittstelle: createStage, addObject, createTask, addAction, connectEvent
  - Flow-Layout-Generierung, Validierung, JSON-Export
  - Aufruf: `npx tsx scripts/agent-run.ts <builder> [output.json]`
- **Builder-PoC** (`demos/builders/raketen-countdown.builder.ts`) [NEU]:
  - Raketen Countdown komplett Ã¼ber ProjectBuilder-API erstellt
  - Folgt der 7-Schritte-Semantik
  - Erzeugt: 2 Stages, 3 Tasks, 6 Actions, 3 FlowCharts
- **ToDoList erweitert** (`ToDoList/api_realisierung.md`):
  - Phase 1.5 (CLI-Runner) integriert
  - Demo-Roadmap: Mathe-Quiz als Runde 3
  - 9 Lessons Learned dokumentiert

### Chore
- `loaded_project.json` aus Git entfernt + `.gitignore` aktualisiert (Laufzeit-Kopie)

### Improved (Rendering)
- **SchriftgrÃ¶ÃŸen-Skalierung relativ zur CellSize** (`StageRenderer.ts`):
  - Neue `scaleFontSize()` Methode: `fontSize Ã— (cellSize / 20)`
  - Bei CellSize 20 (Referenz): keine Ã„nderung
  - Bei CellSize 10: halbe SchriftgrÃ¶ÃŸe, bei CellSize 30: 1.5Ã—
  - Betrifft alle 7 Rendering-Stellen: allgemein, Checkbox, NumberInput, TextInput, Button, Label, Panel
  - Gespeicherte Werte im JSON bleiben unverÃ¤ndert (immer Referenzwerte)

### Added (Game Engine: Boundary-Steuerung)
- **`TGameLoop.boundaryMode`** (`TGameLoop.ts`):
  - Neues Property mit 3 Modi: `clamp` (Default), `event-only`, `bounce`
  - `clamp`: Sprites werden am Rand gestoppt (bisheriges Verhalten)
  - `event-only`: Sprites fliegen durch den Rand, nur Events werden gefeuert
  - `bounce`: Velocity wird automatisch umgekehrt + Position korrigiert
  - Inspector-Dropdown in der Gruppe "Boundaries"
- **`TSprite.onStageExit`** (`TSprite.ts`):
  - Neues Event: wird gefeuert wenn ein Sprite die Stage **komplett** verlassen hat
  - eventData: `{ exitSide: 'top' | 'bottom' | 'left' | 'right' }`
  - Nur relevant im Modus `event-only` (bei clamp/bounce verlÃ¤sst kein Sprite die Stage)
  - Pro Sprite nur einmal gefeuert (exitedSprites-Tracking)
- **`GameLoopManager.checkStageExits()`** (`GameLoopManager.ts`):
  - PrÃ¼ft jeden Frame ob Sprites vollstÃ¤ndig auÃŸerhalb der Stage-Grenzen sind
  - exitedSprites-Set wird bei Stop/Reset geleert

### Added (CleanCode Phase 4: E2E-Test-Netz)
- `10_PlayModeLifecycle.spec.ts` [NEU]: Run-Start/Stop/Restart E2E-Test.
- `11_StageSwitching.spec.ts` [NEU]: Stage-MenÃ¼, Blueprint-Wechsel, Hin-und-ZurÃ¼ck.
- 13 E2E-Tests insgesamt (vorher 11).

### Fixed
- `DEVELOPER_GUIDELINES.md`: 5 WidersprÃ¼che nach CleanCode-Transformation bereinigt (CleanCode-Status, Server-Sync, Speichermanagement, Versionsnummer, Adapter-Hinweise).

## [3.22.0] - 2026-03-20
### Added (CleanCode Phase 3: Hexagonale Architektur)
- **Slice 3.1 â€“ Port-Interfaces** (`src/ports/IStorageAdapter.ts` [NEU]):
  - `IStorageAdapter`: `save()`, `load()`, `list()`, `isAvailable()`.
  - `IExportAdapter`: `export()` mit `formatName` und `fileExtension`.
- **Slice 3.2 â€“ Storage-Adapter** (3 neue Dateien):
  - `ServerStorageAdapter`: Express Dev-API (`/api/dev/save-project`).
  - `LocalStorageAdapter`: Browser-Fallback (nicht primÃ¤r fÃ¼r Electron).
  - `NativeFileAdapter`: FileSystem Access API (Browser) + Electron IPC-Bridge (`window.electronFS`).
- **Slice 3.3 â€“ ProjectPersistenceService refactored:**
  - Adapter-Initialisierung mit automatischer Erkennung (Electron > FS API > Server > LocalStorage).
  - `saveProject()`, `autoSaveToLocalStorage()`, `fetchProjectFromServer()`, `triggerLoad()` delegieren an Adapter.
  - Neue Methode `saveToServer()` fÃ¼r expliziten Server-Sync.
- **Slice 3.4 â€“ Export Electron-kompatibel:**
  - `GameExporter.downloadFile()` 3-stufiger Fallback: Electron IPC â†’ FileSystem Access â†’ Blob.
- Letzter `safeReplacer()`-Aufruf in `autoSaveToLocalStorage()` eliminiert.

## [3.21.0] - 2026-03-20
### Changed (CleanCode Phase 2: Domain Model Trennung)
- **Slice 2.1 â€“ IInspectable aus Runtime extrahiert** (`src/model/InspectorTypes.ts` [NEU]):
  - `TPropertyDef`, `InspectorSection`, `IInspectable` und `isInspectable` leben jetzt im Model-Layer.
  - `TComponent.ts` importiert nicht mehr aus `src/editor/inspector/types.ts` (Editor-Modul), sondern aus `src/model/InspectorTypes.ts`.
  - `src/editor/inspector/types.ts` re-exportiert die Typen fÃ¼r AbwÃ¤rtskompatibilitÃ¤t.
- **Slice 2.2 â€“ TWindow.align vom Editor entkoppelt** (`TWindow.ts`, `EditorDataManager.ts`):
  - `TWindow.align`-Setter greift nicht mehr auf `window.editor` zu.
  - Grid-Dimensionen werden Ã¼ber `_gridCols`/`_gridRows`-Properties bereitgestellt.
  - `EditorDataManager.loadProject()` injiziert Grid-Werte beim Hydratisieren.
  - `safeReplacer` in `ProjectPersistenceService.ts` filtert die neuen internen Properties.
- **Slice 2.3 â€“ ComponentData DTO eingefÃ¼hrt** (`types.ts`, `ProjectRegistry.ts`, `EditorStageManager.ts`, `Editor.ts`):
  - Neues `ComponentData`-Interface als reine Datenstruktur fÃ¼r Komponenten im Projekt-JSON.
  - `StageDefinition.objects`, `GameProject.objects/splashObjects` verwenden `ComponentData[]` statt `TWindow[]`.
  - `ProjectRegistry.getObjects()`, `EditorStageManager.currentObjects()`, `Editor.currentObjects` auf `ComponentData[]` umgestellt.
  - `TWindow`-Import aus `Editor.ts` und `ProjectRegistry.ts` entfernt.
- **Slice 2.5 â€“ toDTO() Konvertierung** (`TComponent.ts`, `ProjectPersistenceService.ts`):
  - `TComponent.toDTO(): ComponentData` extrahiert nur serialisierbare Properties (keine Zirkelreferenzen).
  - `toJSON()` delegiert an `toDTO()` fÃ¼r AbwÃ¤rtskompatibilitÃ¤t.
  - `saveProject()` nutzt `JSON.stringify(null, 2)` statt `safeReplacer` â€” erster Schritt zur Eliminierung der Serialisierungs-Hacks.

## [3.20.1] - 2026-03-20
### Fixed (CleanCode Phase 1: Unidirektionaler Datenfluss)
- **ProjectStore-Referenz-Fix** (`Editor.ts`):
  - `projectStore.setProject(project)` fehlte in `Editor.setProject()`. Dadurch arbeitete der Store nach einem Projektwechsel (Neues Projekt / Laden) mit einer veralteten Referenz.
  - Auswirkungen: Inspector-Ã„nderungen (gameName, author) wurden auf dem alten Projekt-Objekt geschrieben. Canvas-Drag-Operationen (Move, Resize) wurden zwar dispatched, aber auf dem falschen Objekt angewandt, weshalb Komponenten nach dem Loslassen zurÃ¼cksprangen.
- **E2E-Test-Fix** (`01_ProjectCreation.spec.ts`):
  - Fehlerhafter `evaluate`-Block entfernt, der auf nicht-existierendes `ed.inspectorEventHandler` zugriff und den Test crashte.
- **Debug-Cleanup**: Alle temporÃ¤ren `console.log`/`console.warn`-Trace-Ausgaben aus `StageHandler.ts` und `EditorInteractionManager.ts` entfernt.

## [3.20.0] - 2026-03-20
### Added (Native Dateiverwaltung)
- **File System Access API (Desktop/Electron Modus)** (`ProjectPersistenceService.ts`, `EditorDataManager.ts`):
  - Komplett Ã¼berarbeitetes Lade- und Speicherverhalten fÃ¼r einen nativen "Desktop App"-Workflow.
  - Projekte werden nun Ã¼ber `showOpenFilePicker()` geladen, wodurch der Editor ein echtes Datei-Handle behÃ¤lt.
  - Klicks auf "Speichern" schreiben nun *direkt auf die Originaldatei* auf der Festplatte zurÃ¼ck (z. B. im \`demos\`-Ordner), anstatt sie blind an das \`game-server\`-Backend (\`projects/\` Verzeichnis) zu senden.
  - "Speichern unter" (`saveProjectAs`) nutzt `showSaveFilePicker()` und merkt sich den neuen Pfad/das neue File Handle.
  - ErhÃ¶hte UX-Transparenz: Die Projekt-Pfade werden jetzt mit "[Lokal] Dateiname" statt "projects/Dateiname" im Editor tituliert, wenn sie lokal bezogen wurden.
  - Fallback fÃ¼r den Dev-Server-Ordner (\`/api/dev/save-custom\`) sowie Standard-HTML-Dialoge bleibt fÃ¼r Browser ohne API-Support aktiv.

## [3.19.1] - 2026-03-17
### Added (UX: Stage-Anzeige)
- **Aktuelle Stage in MenÃ¼zeile** (`MenuBar.ts`, `Editor.ts`):
  - Prominentes Label â€žðŸŽ­ Aktuelle Stage: \<name\>" mittig in der MenÃ¼leiste
  - Aktualisiert sich bei Stage-Wechsel, Projekt-Laden und Projekt-Reset
  - Styling: halbtransparenter Hintergrund, fetter Text, dezenter Rahmen
### Changed (UX: Flow-Editor & Inspector)
- **Blueprint-Tasks im Flow-Dropdown** (`FlowEditor.ts`):
  - Blueprint-Tasks (globale Tasks) werden im Flow-Dropdown nun *ausschlieÃŸlich* angezeigt, wenn die aktive Stage die Blueprint-Stage ist.
  - Fehler behoben: Die Ausblend-Bedingung fÃ¼r `isBlueprint` wurde entspannt (unterstÃ¼tzt nun Fallback auf ID `blueprint`), um zu garantieren, dass Blueprint-Tasks im Blueprint-Editor-Modus sicher angezeigt werden.
  - Fallback-Rendering fÃ¼r verwaiste Root-Tasks (`project.tasks`) in der Blueprint-Stage wiederhergestellt, fÃ¼r Legacy-Projekte, bei denen die Migration noch aussteht.
  - **Fix:** Der hartcodierte Eintrag "Main Flow (Stage)" (intern 'global') wurde fÃ¼r regulÃ¤re Stages aus dem Dropdown entfernt, da er irritierte und von Benutzern als globaler Task verstanden wurde.
### Features
- **FlowEditor (3.19.1):** Ein neues, einklappbares und in der Breite ziehbares ("resizable") Sidepanel fÃ¼r Pascal-Code integriert. Es dockt sich rechtsbÃ¼ndig im Canvas an, verfÃ¼gt Ã¼ber ein modernes Glas-Design (`backdrop-filter: blur(12px)`) und zeigt in Echtzeit den generierten Pascal-Code der gewÃ¤hlten Stage oder Node.
- **FlowEditor (3.19.1):** Layout-Bug behoben, der das Pascal-Panel beim Initial-Laden als durchgehendes Band am unteren Rand statt andockend positionierte. Code wird zudem dauerhaft fÃ¼r das komplette Programm aus der Stage (`generateFullProgram`) gerendert.
- **FlowEditor (3.19.1):** Automatischer Formatierungsschritt hinzugefÃ¼gt: Beim Umschalten zwischen Kompakt- und Detail-Ansicht formatiert sich der Flow-Graph nun automatisch neu, um schrÃ¤ge Verbindungslinien durch geÃ¤nderte KnotengrÃ¶ÃŸen zu korrigieren.
- **FlowEditor (3.19.1):** KontextmenÃ¼ auf dem Canvas erweitert: Nutzer kÃ¶nnen nun Ã¼ber einen Rechtsklick auf den Canvas bestehende Actions (`Vorhandene Aktion einfÃ¼gen`) und globale Tasks (`Globalen Task einfÃ¼gen`) direkt als verlinkte ("Linked") Knoten in den Flow einhÃ¤ngen.

### Fixes
- **PascalCodeGenerator (3.19.1):** Fehler behoben, bei dem die eigentliche Prozedur-Deklaration (`PROCEDURE MyTask;`) fÃ¼r global aufgerufene Tasks (z.B. `BackToMainStage`) im generierten Code fehlte, wenn diese nur "verlinkt" waren. Der Generator lÃ¶st Tasks nun rekursiv anhand der ActionSequences auf.
- **FlowTask (3.19.1):** Scope-Wechsel im Inspector (von "Stage-lokal" auf "Global") umgestellt: Das Heraufstufen von Tasks in den globalen Bereich nutzt nun korrekterweise die moderne "Blueprint-Stage" als Target, verschiebt saubere Referenzen und inkludiert die dazugehÃ¶rigen Flowcharts des Tasks beim Umzug.
- **FlowEditor (3.19.1):** StageLabel in der Top-Menu-Bar ergÃ¤nzt (Update bei Projekt-Setup und Stage-Switching).
- **FlowEditor (3.19.1):** Blueprint-Tasks sind nun exklusiv in der Blueprint-Stage im Dropdown sichtbar.
- **FlowEditor (3.19.1):** Entfernung der verwirrenden Option `Main Flow (Stage)` in Non-Blueprint Stages.
- **FlowEditor (3.19.1):** Ghosting-Bug beim Stage-Switching (`switchActionFlow`) behoben, indem nicht existierende Tasks einen expliziten Fallback in die "ElementenÃ¼bersicht" durchfÃ¼hren.
- **Inspector (3.19.1):** Schwerwiegenden Anzeige-Bug im Dropdown behoben: Wenn das Ziel-Objekt einer Action in der aktuellen Stage (z.B. Blueprint) nicht sichtbar war, fiel das HTML-Select stumm auf den ersten Eintrag ('GameLoop' etc.) zurÃ¼ck. Die UI zeigt fehlende Referenzen nun explizit als "[Wert] (ausgeblendet / nicht in Stage)" an.
- **Inspector (3.19.1):** Das `onFrame`-Event des `TGameLoop`-Objekts wurde im Inspector freigeschaltet. Zuvor war es zwar engine-seitig funktional, aber fÃ¼r Anwender im UI unsichtbar.
- **Demo Projekt (3.19.1):** Die leeren und fehlerhaften Tasks `MainGameLoop` und `PlayStateLoop` wurden aus der `RetroTennis.json` komplett entfernt, um 60-FPS-Leidlauf zu verhindern. Das Demo-Spiel nutzt fÃ¼r Ballbewegung und Kollision ohnehin die nativen Engine-Funktionen.
- **Demo Projekt (3.19.1):** Fehlerhaftes UI-Rendering im Task `CheckWallCollisions` behoben. Conditions waren als native Strings abgelegt, weshalb der Flow-Editor den Text nicht ins UI-Element mappen konnte und Fallback-Beschriftungen ("Bedingung") erzeugte. Die EintrÃ¤ge wurden ins korrekte Objektformat (`leftValue`, `operator`, `rightValue`) Ã¼bersetzt.
- **Inspector (3.19.1):** Bugfix fÃ¼r leere/unsichtbare Werte bei Key-Value-Eigenschaften vom Typ Boolean (z.B. in der `negate` Action). Der Key-Value-Renderer schrÃ¤nkte das Rendering auf den Action-Typ `property` ein, woraufhin ein Fallback-Renderer fÃ¤lschlicherweise ein statisches Number-Feld aufspannte.
- **Flow Editor (3.19.1):** Bugfix fÃ¼r die Text-AuflÃ¶sung auf Action-Knoten (Detail-Ansicht). Objekte (wie z.B. das `changes`-Objekt) wurden bei der ZusammenfÃ¼hrung implizit zu `[object Object]` stringifiziert. Die Text-Engine parst sie nun sauber als kompaktes JSON.
- **Inspector (3.19.1):** Die Action-UI fÃ¼r "Wert negieren" (negate) von einfachem String zu einem 'keyvalue'-Dictionary (`changes`) umgebaut, da Eigenschaften sonst unsichtbar und inkompatibel zur Engine blieben.
- **Physics Engine (3.19.1):** Fehler behoben, bei dem die Retro Tennis Demo nicht funktionierte, da Kollisionen implizit im JSON deaktiviert waren und Boundary-Events durch fehlerhafte Objekt-Conditions geloggt wurden. Fehlerhafte Conditions wurden durch nativ verarbeitete String-Conditions ersetzt (`${hitSide} == 'top'`).
- **Engine Runtime (3.19.1):** Autoresolve-Fallback fÃ¼r Event-Variablen eingebaut. Condition-Parameter wie `${hitSide}` grasen nun automatisch das `eventData`-Root-Objekt des Call-Contexts ab, falls sie nicht direkt im `vars`-Root des Scopes existieren, wodurch User das `eventData.`-PrÃ¤fix nicht zwingend kennen/schreiben mÃ¼ssen.
- **Logging (3.19.1):** Der `TaskExecutor` formatiert Condition-Logs bei strukturierten Bedingungen (`leftValue`/`rightValue`) wieder sauber mit echten Variablen-Namen, anstatt `undefined == undefined` auszugeben.
- **Inspector (3.19.1):** Dropdowns fÃ¼r Tasks und Actions beziehen globale Elemente nun einheitlich Ã¼ber `ProjectRegistry.getTasks('all')` anstatt der veralteten Root-Level Collection.
- **FlowEditor (3.19.1):** Bugfix fÃ¼r die "Landkarte (Events/Links)" und die "ElementenÃ¼bersicht", welche in der Blueprint-Stage leere Graphen dargestellt hatten. Beide Ãœbersichten beziehen globale Ressourcen nun fehlerfrei aus den Stage-Daten via ProjectRegistry.
- **FlowEditor (3.19.1):** Bugfix fÃ¼r die "Landkarte", da diese Events von Objekten Ã¼ber die veraltete Property `.Tasks` geholt hat anstatt der neuen Standard-Property `.events`.
- **FlowEditor & PascalCodeGenerator (3.19.1):** Unbekannte oder Plugin-Actions (wie `navigate_stage`) zeigen in der Node-Ansicht und im generierten Pascal-Code nun ihre echten Parameter-Werte (dynamisch aus der `ActionRegistry` bezogen) anstatt nur ihre Typ-Bezeichnung an.
- **PascalCodeGenerator (3.19.1):** Fehlende Event-Handler (z.B. `onClick`) von Stage-Komponenten wurden durch Umstellung auf die moderne `.events` Property wiederhergestellt.
- **Inspector-Task- und Action-Dropdowns** (`InspectorRenderer.ts`):
  - FÃ¼r Ereignis-Inputs und Eigenschafts-Dropdowns (Tasks, Actions) wird nun projektÃ¼bergreifend `projectRegistry.getTasks('all')` genutzt, damit Aufgaben der Blueprint-Stage auch als Zielaktionen abgebildet und nicht ausgeblendet werden.
- **Fehlerbehebung nach Stage-Wechsel ("Ghosting" von globalen Tasks)** (`FlowEditor.ts`):
  - Wenn ein globaler Task wie `BackToMainStage` im Blueprint gezeichnet wird und man in eine regulÃ¤re Stage wechselt, schaltet der Flow-Editor nun zwingend auf die "ElementenÃ¼bersicht" dieser Stage um. Zuvor wurde der Task Ã¼ber einen fehlerhaften Safety-Check wieder ans Ende des Dropdowns gedrÃ¼ckt, selbst wenn er nicht zur Stage gehÃ¶rte.

## [3.19.0] - 2026-03-17
### Architecture (Root-Level Collections eliminiert)
- **Migration bei Projektladen** (`FlowEditor.ts`):
  - Neue Methode `migrateRootToBlueprint()` migriert beim Laden Root-Level `project.tasks`, `project.actions`, `project.variables`, `project.flowCharts` automatisch in die Blueprint-Stage
  - Root-Arrays werden nach Migration geleert
- **6 Root-Fallbacks entfernt**:
  - `FlowSyncManager.ensureTaskExists()`: Blueprint-Stage statt `project.tasks`
  - `FlowSyncManager.updateGlobalActionDefinition()`: Blueprint-Stage statt `project.actions`
  - `FlowSyncManager.syncVariablesFromFlow()`: Blueprint-Stage statt `project.variables`
  - `EditorStageManager.getTargetActionCollection()`: Blueprint-Stage statt `project.actions`
  - `EditorStageManager.getTargetTaskCollection()`: Blueprint-Stage statt `project.tasks`
  - `FlowTaskManager.ensureTaskExists()`: Blueprint-Stage statt `project.tasks`
- **Flow-Dropdown bereinigt** (`FlowEditor.ts`):
  - Legacy-Block entfernt der Root-Level `project.tasks`/`project.flowCharts` im Dropdown anzeigte
  - Nur noch Blueprint-Stage-Tasks im Global-Bereich
- **Test-Anpassung** (`action_crud.test.ts`):
  - Blueprint-Stage zum Test-Projekt hinzugefÃ¼gt
  - Assertions prÃ¼fen `blueprintStage.actions` statt `project.actions`

## [3.18.1] - 2026-03-16
### Added (Export-IntegritÃ¤t)
- **Checksummen-Test** (`tests/export_integrity.test.ts`):
  - SHA-256-PrÃ¼fung von 5 Export-Dateien (GameExporter, PersistenceService, player-standalone, GameRuntime, GameLoopManager)
  - Baseline in `tests/export_checksums.json`
  - Aktualisierung bei bewussten Ã„nderungen: `npx tsx tests/export_integrity.test.ts --update`

## [3.18.0] - 2026-03-15
### Improved (Runtime-Optimierung)
- **Bundle-GrÃ¶ÃŸe halbiert** (`package.json`):
  - `--minify` zum esbuild-Befehl hinzugefÃ¼gt: 580 KB â†’ 294 KB (-50%)
- **TGameLoop stark reduziert** (`TGameLoop.ts`):
  - Von 412 auf 95 Zeilen â€” nur noch Konfigurations-Container (boundsOffset, targetFPS)
  - Kompletter eigener Game-Loop entfernt (war Duplikat vom GameLoopManager)
- **Sprite Fast-Path** (`player-standalone.ts`):
  - `onSpriteRender` Callback: Pro Frame nur `style.left/top` der Sprites statt Full-DOM-Rebuild
  - Deutlich bessere 60fps-StabilitÃ¤t bei vielen Sprites
- **Console-Logs entfernt** (`GameLoopManager.ts`):
  - Alle Debug-Logs aus dem Game-Loop entfernt (liefen 60Ã—/sec)
### Added (Export-MenÃ¼)
- **Komprimierte Export-Optionen** (`menu_bar.json`):
  - "Export als HTML (komprimiert)" im Plattform-MenÃ¼
  - "Export als JSON (komprimiert)" im Plattform-MenÃ¼
  - Nutzt gzip+Base64 Komprimierung (70-80% kleiner)

## [3.17.0] - 2026-03-15
### Fixed (HTML-Export Runtime)
- **Splash-Stage bleibt stehen** (`GameExporter.ts`):
  - `splashAutoHide` und `splashDuration` zur Export-Whitelist hinzugefÃ¼gt â€” ohne diese Properties startet kein Timer und der Splash bleibt ewig
  - `objects` und `flowCharts` zur Whitelist fÃ¼r Legacy-Format-KompatibilitÃ¤t
- **Ball bewegt sich doppelt so schnell** (`player-standalone.ts`):
  - `AnimationTicker` lief parallel zum `GameLoopManager` â†’ doppeltes `AnimationManager.update()` und Rendering
  - Fix: Ticker prÃ¼ft jetzt `GameLoopManager.isRunning()` und Ã¼berspringt eigenes Update/Render
  - Veraltete `getAnimationManager()` Methode entfernt, direkte Imports verwendet
- **Reactive Bindings fehlten** (`player-standalone.ts`):
  - `makeReactive: true` in `UniversalPlayer.startProject()` hinzugefÃ¼gt â€” ohne dieses Flag funktionieren keine Variablen-Bindings, Expressions oder automatische Re-Renders
- **Build-Pipeline** (`vite.runtime.config.ts`, `src/stubs/node-stub.ts`):
  - Separater Vite-Build als IIFE-Bundle (293 KB minifiziert) erstellt
  - Node.js-Module (fs, path, express) per `resolve.alias` auf Stub-Datei umgeleitet

## [3.16.2] - 2026-03-14
### Improved (Inspector Layout & Rasterfarbe)
- **Inspector horizontales Layout** (`InspectorHost.ts`):
  - Labels werden links neben den Eingabefeldern angezeigt (Flexbox) statt darÃ¼ber
  - Inline-Properties: Konsekutive `inline: true` Properties werden paarweise in einer Zeile gruppiert (max. 2 pro Zeile)
  - Inline-Labels werden dynamisch schmal gehalten, normale Labels haben feste Breite (70-90px)
- **Fett/Kursiv als Boolean-Checkboxen** (`TWindow.ts`, `InspectorHost.ts`):
  - `style.fontWeight` und `style.fontStyle` werden als Checkboxen (statt Select-Dropdowns) gerendert
  - Automatische CSS-Wert-Konvertierung: checked â†’ `bold`/`italic`, unchecked â†’ `normal`
  - Fett/Kursiv Duplikat behoben: Properties nur in `TTextControl` deklariert, nicht zusÃ¤tzlich in `TWindow`
- **Stage-Rasterfarbe konfigurierbar** (`Stage.ts`, `inspector_stage.json`):
  - Hardcoded `#ddd` durch `gridConfig.gridColor` ersetzt (Fallback: `#dddddd`)
  - Neues Farbpicker-Feld "Rasterfarbe" im Stage-Inspector (RASTER-Sektion, nach Checkboxen)
  - Raster wird im Run-Mode nicht angezeigt (`visible && !runMode`)

## [3.16.1] - 2026-03-14
### Fixed (Inspector-Farben & Flow-Sync)
- **Inspector-Farben sichtbar** (`InspectorHost.ts`):
  - `require()` â†’ statischer ESM-Import fÃ¼r `GROUP_COLORS` â€” Farben werden jetzt im Inspector angezeigt
- **Flow-Sync: DataActionâ†’Action Kette** (`FlowSyncManager.ts`):
  - `output`-Anker wird jetzt als success-Branch erkannt (Fix fÃ¼r Taskâ†’DataActionâ†’Action Sequenz)
  - `buildSequence()`: Action-Knoten mit `data.type='data_action'` werden korrekt als DataAction-Branching behandelt
  - Verlinkte Actions prÃ¼fen globale Definition auf `type: 'data_action'`
- **ESM-Import-Fixes** (`FlowDataAction.ts`):
  - `actionRegistry` Import von `require()` auf statischen Import umgestellt

## [3.16.0] - 2026-03-14
### Added (DataAction Inspector & Expert-Wizard Enhancements)
- **Inspector SQL-Gruppen** (`FlowDataAction.ts`):
  - Neue Gruppen-Reihenfolge: ALLGEMEIN â†’ FROM â†’ SELECT â†’ INTO â†’ WHERE â†’ HTTP
  - Neues `selectFields`-Property (SELECT-Felder) mit Platzhalter `* (alle Felder)`
  - `queryProperty` (WHERE-Feld) ist jetzt Select-Dropdown mit `source: 'dataStoreFields'`
  - `dataStore` (FROM) verwendet neuen `source: 'dataStores'` (filtert nur TDataStore-Objekte)
  - Erweiterte Operatoren: `>=`, `<=`, `CONTAINS`, `IN`
- **Farbige Inspector-Gruppen** (`TComponent.ts`, `InspectorHost.ts`):
  - `GROUP_COLORS` Mapping: FROM (blau #2980b9), SELECT (grÃ¼n #27ae60), INTO (orange #e67e22), WHERE (rot #c0392b), HTTP (grau #7f8c8d)
  - Sektionen mit 3px farbiger BordÃ¼re, getÃ¶ntem Hintergrund und farbigem Header-Text
- **InspectorRenderer** neue Sources: `'dataStores'` und `'dataStoreFields'` mit dynamischer Feld-Erkennung
- **Expert-Wizard Redesign** (`data_action_rules.json`):
  - Neuer Flow: Name â†’ DataStore â†’ Resource â†’ SELECT â†’ INTO â†’ WHERE (mit bedingter Verzweigung)
  - HTTP/JWT/Body aus dem Wizard-Flow entfernt (nur noch im Inspector)
  - Optionale Felder dÃ¼rfen leer bleiben
- **Hybrid-Felder** (`ExpertDialog.ts`):
  - String-Eingabe mit â€žV"-Button fÃ¼r Variablen-Picker (`${variablenName}`)
  - Dynamisches Dropdown zur Variablen-Auswahl
- **Dynamic Resolver** (`FlowContextMenuProvider.ts`):
  - `@dataStores` â€” nur TDataStore-Objekte
  - `@dataStoreFields` â€” DataStore-Felder abhÃ¤ngig vom gewÃ¤hlten DataStore
  - `@variables` â€” Projekt-Variablen fÃ¼r den Expert-Wizard
- **AgentAPI.md**: `data_action`-Sektion aktualisiert (FROM/SELECT/INTO/WHERE Parameter)
- **LLM-Training-Infrastruktur** [NEU]:
  - `src/tools/TrainingDataExporter.ts` â€” project.json â†’ JSONL Exporter
  - `src/tools/agent-api-schema.json` â€” JSON-Schema fÃ¼r Constrained Decoding
  - `src/tools/prompt-templates/` â€” JSONL-Vorlagen (Login, CRUD)
  - Regel 11 in `DEVELOPER_GUIDELINES.md` fÃ¼r Trainingsdaten-Pflicht
- **Unit-Test** (`tests/flow_data_action.test.ts`): 8 Tests (Gruppen-Reihenfolge, Sources, Colors, Operatoren)

## [3.15.0] - 2026-03-13
### Added (Unidirektionaler Datenfluss â€” Phase 1)
- **`ProjectStore`** (`src/services/ProjectStore.ts`) [NEU]:
  - Zentraler State-Manager mit dispatch/reduce/onChange Pattern
  - 11 Mutations-Typen: SET_PROPERTY, RENAME_ACTION/TASK, ADD/REMOVE ACTION/TASK/OBJECT, SET_STAGE, BATCH
  - Automatischer Snapshot vor jeder Mutation (SnapshotManager-Integration)
  - Guard gegen verschachtelte Dispatches
  - 10 Unit-Tests (SET_PROPERTY, RENAME, ADD/REMOVE, onChange, BATCH)

## [3.14.4] - 2026-03-13
### Added (Undo/Redo Snapshots)
- **`SnapshotManager`** (`src/editor/services/SnapshotManager.ts`) [NEU]:
  - Projekt-Level Undo/Redo via Deep-Copy Snapshots (ergÃ¤nzt den bestehenden ChangeRecorder)
  - Integration in `InspectorEventHandler`: Snapshot VOR jeder Property-Ã„nderung
  - Stack-Limit (30), Throttling (500ms), isRestoring Guard
  - 10 Unit-Tests (Stack-Lifecycle, Deep Copy, Throttle, Restore-Callback, clear)

## [3.14.3] - 2026-03-13
### Added (IInspectable fÃ¼r UI-Komponenten)
- **`TComponent` implementiert `IInspectable`** (`src/components/TComponent.ts`):
  - Auto-Konvertierung: `getInspectorProperties()` Gruppen werden automatisch zu `InspectorSection[]`
  - Alle 66 UI-Komponenten (TButton, TLabel, TPanel, etc.) bekommen IInspectable ohne Ã„nderung
  - Icon-Mapping fÃ¼r 13 bekannte Gruppen (IDENTITÃ„T, GEOMETRIE, DARSTELLUNG, etc.)
  - `applyChange()` signalisiert Re-Render bei Name/Scope-Ã„nderungen
  - `getInspectorEvents()` exportiert Event-Bindings fÃ¼r den Inspector

## [3.14.2] - 2026-03-13
### Added (Sync-Robustheit)
- **E2E Roundtrip-Test** (`tests/e2e/09_SyncRoundtrip.spec.ts`) [NEU]:
  - Szenario A: Action-Typ-Ã„nderung (navigate_stage) â†’ prÃ¼ft JSON + Flow-Node + Pascal + JSON-View
  - Szenario B: Action-Umbenennung â†’ prÃ¼ft JSON + Flow-Node + ActionSequence + JSON-View
  - Beide Tests mit automatischem Cleanup (ZurÃ¼ckbenennen + Speichern)

## [3.14.1] - 2026-03-13
### Added (Sync-Robustheit)
- **`SyncValidator`** (`src/editor/services/SyncValidator.ts`) [NEU]:
  - Automatische KonsistenzprÃ¼fung nach jeder `syncToProject()`-Operation
  - 6 Validierungsregeln: R1 (Action-Referenzen), R2 (FlowChart-Task-Konsistenz), R3 (Connection-ValiditÃ¤t), R4 (Property-Sync), R5 (Duplikate), R6 (FlowChart-Speicherort)
  - Auto-Repair fÃ¼r unkritische FÃ¤lle (verwaiste Referenzen, FlowChart-Duplikate)
  - Spot-Validierung in `FlowNodeHandler.handlePropertyChange()` fÃ¼r sofortige Desync-Erkennung
  - 10 Unit-Tests (Gutfall, Erkennung und Auto-Repair fÃ¼r R1/R2/R3/R5/R6, Spot-Validierung)

## [3.14.0] - 2026-03-13
### Added (Inspector Refactoring: Component-Owned Inspector)
- **`IInspectable` Interface** (`src/editor/inspector/types.ts`):
  - Neues Interface fÃ¼r selbstbeschreibende Inspectoren: `getInspectorSections()` und `applyChange()`
  - `InspectorSection` Typ mit einklappbaren Sektionen, Icons und Properties
  - `isInspectable()` Type Guard fÃ¼r polymorphe Erkennung
- **`FlowElement.ts`**: Default `getInspectorSections()` und `applyChange()` als Basis-Implementierung
- **`FlowAction.ts`**: Dynamische Sektionen basierend auf Action-Typ (property/method/event/registry)
  - `applyChange()` gibt `true` fÃ¼r Typ-Wechsel zurÃ¼ck â†’ triggert Inspector Re-Render
  - Legacy `getInspectorProperties()` leitet aus Sektionen ab
- **`FlowTask.ts`**: 3 Sektionen (Allgemein/Konfiguration/Aktionen) mit AusfÃ¼hrungsmodus und Scope
- **`InspectorHost.ts`**: Neuer IInspectable-Render-Pfad mit einklappbaren Sektionen
  - `renderInspectableSections()` rendert Sektionen mit Icons und Collapse-Toggle
  - `renderInspectableProperty()` delegiert Ã„nderungen an `eventHandler.handleControlChange()`
  - Fallback auf JSON-Template-Pfad fÃ¼r Objekte ohne IInspectable
  - E2E-KompatibilitÃ¤t: Input name=`{prop}Input`, Select name=`controlName || propName`

### Changed
- **Inspector Rendering**: FlowAction/FlowTask rendern jetzt Ã¼ber IInspectable-Pfad statt JSON-Templates
- **Handler-Delegation**: Ã„nderungen laufen weiterhin Ã¼ber `FlowNodeHandler` fÃ¼r Refactoring-KompatibilitÃ¤t

## [3.13.0] - 2026-03-13
### Added (API-Realisierung Phase 1-5)
- **API-Referenzdokument** (`docs/AgentAPI.md`):
  - VollstÃ¤ndige Referenz aller 45+ Methoden mit Signatur, Parametern, RÃ¼ckgabewerten
  - **Action-Typ-Katalog**: Alle 22 Typen mit Pflichtfeldern und Beispielen
  - **Event-Katalog**: onClick, onCollision, onBoundaryHit, onStart, onKeyDown etc.
  - **Komponenten-Katalog**: TSprite, TLabel, TButton, TPanel, TInputController
  - **Batch-API Doku**: Transaktionen mit Rollback-Semantik
  - **WebSocket-API Doku**: agent_call/agent_result Echtzeit-Protokoll
  - **KI-Prompt-Template** fÃ¼r externe KI-Agenten
  - **VollstÃ¤ndiges PingPong-Beispiel** zur Demonstration aller API-Methoden
- **AgentController.ts** â€” 5 neue Methoden:
  - `addTaskCall(taskName, calledTaskName)` â€” Task-Referenz in Sequenz
  - `setTaskTriggerMode(taskName, mode)` â€” broadcast/local-sync/local setzen
  - `addTaskParam(taskName, paramName, type, defaultValue)` â€” Task-Parameter
  - `moveActionInSequence(taskName, fromIndex, toIndex)` â€” Reihenfolge Ã¤ndern
  - `executeBatch(operations[])` â€” Batch-API mit Rollback
- **AgentShortcuts.ts** [NEU] â€” Convenience-Layer:
  - `createSprite()`, `createLabel()`, `createButton()`, `setSpriteCollision()`, `setSpriteVelocity()`
  - `createBounceLogic()`, `createScoreSystem()`, `createPaddleControls()`
- **HTTP-Endpoints** in `game-server/src/server.ts`:
  - `POST /api/agent/:method` â€” Einzeln-Aufrufe
  - `POST /api/agent/batch` â€” Batch/Transaktionen mit Rollback
- **WebSocket-Kanal** `agent_call` / `agent_result` in `Protocol.ts` + `server.ts`
- **Tests** (`tests/agent_controller.test.ts`): 12 Tests (PingPong + Tennis-Batch + Rollback)

## [3.12.4] - 2026-03-13
### Added
- **F5-Reload Dialog (Session-Wiederherstellung)**:
  - Bei F5/Reload vergleicht der Editor jetzt LocalStorage-Projekt mit Server-Datei (`project.json`).
  - Wenn sich die Projekte unterscheiden â†’ modaler Dialog: "ðŸ“‚ Lokale Version laden" vs. "ðŸŒ� Server-Version laden".
  - Zeigt Projektname und letzten Speicherzeitpunkt der lokalen Version.
  - `autoSaveToLocalStorage()` schreibt jetzt Zeitstempel (`gcs_last_save_time`).
  - Vorher: Immer hardcoded `./platform/project.json` geladen â€” lokale Ã„nderungen gingen bei F5 verloren.

## [3.12.3] - 2026-03-12
### Added (Editor / Debugging)
- **Keyboard- & Runtime-Logs via UseCaseManager**: Neuer UseCase `Input_Handling` in `UseCaseManager.ts` hinzugefÃ¼gt. `TInputController` wurde darauf umgestellt. `TaskExecutor` (`[TaskExecutor] EXECUTING: ...`) und `EditorRunManager` (`[RunManager] handleRuntimeEvent: ...`) verwenden nun ebenfalls konsequent die Logger-API (`Logger.get(..., 'Runtime_Execution')`). Alle stÃ¶renden Event- und AusfÃ¼hrungs-Logs lassen sich nun gezielt im Inspector "Logs"-Tab de- und aktivieren.

### Added (Game Logic / PingPong)
- **Regelkonforme Event-Actions (`PingPong.json`)**:
  - SÃ¤mtliche vormals "inline" oder fehlerhaft referenzierten `negate`-Verhaltensweisen fÃ¼r den Abprall wurden zu korrekten, globalen Actions konvertiert (Regel: *Keine Inline-Actions*).
  - Die Action `NegateBallY` (Abprallen an oberer/unterer Begrenzung) ist nun als globales Element vom Typ `negate` fÃ¼r `BallSprite` (`velocityY: true`) in der Blueprint-Stage verankert.
- **Ball-Reset bei Aus (`PingPong.json`)**: Implementierung der Fehler-Bedingung (Ball berÃ¼hrt linken oder rechten Spielfeldrand).
  - Globale Action `ResetBall` vom Typ `property` erstellt, die den Ball zentriert (Grid-Koordinaten x: 32, y: 19) und die X/Y-Geschwindigkeit zurÃ¼cksetzt.
  - Task `HandleBallBoundary` zu einem komplexen Ablauf umgebaut, welcher die `hitSide` Eigenschaft per konditionalen Verzweigungen testet: `top`/`bottom` fÃ¼hren wie bisher zu Abprallern (`NegateBallY`), `left`/`right` fÃ¼hren zum Aufruf von `ResetBall`.

### Fixed
- **FlowSyncManager (Condition-Nodes Bug)**:
  - Behoben: Beim Speichern (FlowChart -> actionSequence) und Parsen (actionSequence -> FlowChart) von `condition` Nodes wurden strukturierte Objektdaten (`data.condition`) zu einem platten String `text` reduziert, was zum vollstÃ¤ndigen Verlust der Bedingungs-Logik fÃ¼hrte.
  - Das Serialisieren/Deserialisieren unterstÃ¼tzt nun korrekt die Erhaltung von `data.condition` fÃ¼r die Editor-Anzeige und die Laufzeitauswertung.
- **Inspector Dropdowns (Variablen)**:
  - Behoben: Bislang wurden Task-bezogene Parameter (Eingangsparameter wie `hitSide`) im Variablen-Dropdown des Inspectors (z.B. in der Condition-Node) nicht angezeigt, wodurch man als User nicht sehen konnte, auf welche Laufzeit-Variablen man Zugriff hat. Der `InspectorContextBuilder` liest nun dynamisch die `params` aller Tasks in der aktuellen Stage und fÃ¼hrt sie mit BÃ¼roklammer-Icon (ðŸ“Ž) regulÃ¤r in der Dropdown-Liste.
- **FlowCondition Text-Anzeige im Flow-Diagramm**:
  - Behoben: FlowCondition-Nodes (lila Rauten) zeigten nach dem Laden eines Projekts keinen Bedingungstext an (z.B. "hitSide == top"). Ursache: `refreshVisuals()` wurde fÃ¼r Condition-Nodes im `FlowSyncManager.restoreNode()` nicht aufgerufen. Der Fix ist eine einzige Zeile, die sicherstellt, dass `updateText()` nach dem Laden der `data.condition` Daten getriggert wird.
- **FlowSyncManager Connection-Matching (ROOT CAUSE BOUNCING-BUG)**:
  - Behoben: `syncToProject()` suchte true-branch Connections ausschlieÃŸlich via `startAnchorType === 'true'`. FlowCondition-Connections nutzen jedoch `startAnchorType: 'right'` mit dem Flag `isTrueBranch: true`. Die Connection wurde dadurch nie gefunden, das generierte `body`-Array blieb leer und keine Action wurde bei Boundary-Hits ausgelÃ¶st. Fix: Connection-Erkennung erweitert um `'right'`/`'bottom'` Anchor-Typen und `isTrueBranch`/`isFalseBranch` Flags.
- **PascalCodeGenerator TypeError & Action-Support**:
  - Behoben: `TypeError: Cannot read properties of undefined (reading 'toString')` â€” der Generator erwartete `cond.value`, aber nach dem FlowSyncManager-Fix wurden Conditions mit `leftValue`/`rightValue` exportiert. Beide Formate werden jetzt unterstÃ¼tzt, mit durchgehender Null-Safety (`String()` statt `.toString()`).
  - Neu: `negate`-Actions werden als Pascal-Zuweisungen dargestellt (`Target.Prop := -Target.Prop;`).
  - Neu: Actions aus der Blueprint-Stage werden jetzt korrekt bei der Suche berÃ¼cksichtigt.
- **Stage Start-Animation Fix**:
  - `GameRuntime.triggerStartAnimation()` unterstÃ¼tzt jetzt alle 12 TStage Fly-Patterns (UpLeft, BottomLeft, ChaosIn, Matrix, Random, etc.).
  - Vorher wurden nur `fade-in` und `slide-up` erkannt â€” alle Inspector-konfigurierten Patterns (z.B. `BottomLeft`) wurden ignoriert.
  - Easing-Konfiguration (`startAnimationEasing`) wird jetzt korrekt aus der Stage-Config gelesen.
  - **Lazy-Init Fix in AnimationManager**: `startTime` wird erst beim ersten `update()`-Aufruf gesetzt (statt bei Tween-Erstellung). Behebt Timing-Bug wo Tweens sofort als "completed" markiert wurden weil sie zwischen Game-Loop-Zyklen erstellt wurden.
  - **Einheiten-Bug behoben**: Startpositionen wurden in Pixeln (1152Ã—720) statt Grid-Zellen (64Ã—40) berechnet â†’ Objekte starteten 97% der Dauer unsichtbar. `outsideMargin` auf 10 Grid-Zellen reduziert.
- **DebugLogService Performance-Fix**:
  - `maxChildren=50` pro Parent-Log verhindert unbegrenztes Speicherwachstum bei verschachtelten Logs.
  - `scheduleNotify()` via `requestAnimationFrame` reduziert Listener-Benachrichtigungen von hunderten/sec auf max. 1/Frame.
  - `isNotifying`-Guard verhindert rekursive Log-Kaskaden.
  - O(1) `entryMap` HashMap ersetzt rekursive `findEntry()` Baumsuche â€” bei 1000 Logs mit je 50 Kindern wurde der Baum bei JEDEM `log()`-Aufruf komplett durchsucht, was progressives Stottern verursachte.
  - **TDebugLog Visibility-Guard:** Der Subscribe-Callback und `renderLogs()` prÃ¼fen jetzt `isVisible` â€” kein DOM-Rebuild wenn das Panel unsichtbar ist. Vorher wurden 1000+ DOM-Elemente bei JEDEM Frame neu erstellt, obwohl das Panel per `translateX(100%)` ausgeblendet war.
- **FlowEditor isDirty-Guard (Robustheit)**:
  - `syncToProject()` wird jetzt NUR ausgefÃ¼hrt wenn tatsÃ¤chlich Ã„nderungen im Flow-Editor vorgenommen wurden (`isFlowDirty`-Flag).
  - Beim bloÃŸen View-Wechsel (Flow â†’ Code/Run) oder Speichern ohne Ã„nderungen wird `syncToProjectIfDirty()` aufgerufen, das den Guard prÃ¼ft.
  - Verhindert, dass korrupte `actionSequence`-Daten im LocalStorage/Autosave landen, wenn die Connection-Matching-Logik Edge-Cases nicht abfÃ¤ngt.
- **Pascal-Code Task-Filter (NEU)**:
  - In der Code-View (Pascal-Tab) gibt es nun ein Task-Dropdown, mit dem ein einzelner Task ausgewÃ¤hlt werden kann.
  - Bei Auswahl werden nur die relevanten Prozeduren angezeigt: der Task als Hauptprozedur, alle referenzierten Actions als Sub-Prozeduren, Task-Parameter als VAR-Deklarationen und Event-AuslÃ¶ser als Kommentare.
  - `PascalCodeGenerator.generateForTask()` sammelt Actions rekursiv aus `actionSequence` (inkl. `body`, `elseBody`, `thenAction`, `elseAction`).
- **Paddle Collision Bounce (`PingPong.json`)**: Implementierung des Abpralls an den Paddles (X-Achse).
  - Globale Action `NegateBallX` vom Typ `negate` erstellt, welche `velocityX` umkehrt.
  - Neuer Task `HandlePaddleCollision` auf `stage_main` angelegt, der `NegateBallX` aufruft.
  - Event-Binding `onCollision` auf dem `BallSprite` konfiguriert, sodass der Task bei jeder Sprite-Kollision (hier: Paddles) automatisch triggert.
- **Top/Bottom Ball Bounce (`PingPong.json`)**: Implementierung des Abpralls an der oberen und unteren Begrenzung.
  - Globale Action `NegateBallY` vom Typ `negate` erstellt, welche `velocityY` umkehrt. (Nutzt die automatische Fallback-Logik in `StandardActions.ts`, die `_prevVelocityY` heranzieht, wenn `velocityY` durch die Engine temporÃ¤r auf 0 gesetzt wurde).
  - Neuer Task `HandleBallBoundary` auf `stage_main` angelegt, der `NegateBallY` aufruft.
  - Event-Binding `onBoundaryHit` auf dem `BallSprite` konfiguriert, sodass der Task bei Randerkennung automatisch triggert.

### Fixed (Performance / Stottern)
- **Kollisions-Lags behoben (`GameRuntime.ts`, `GameLoopManager.ts`, `StandardActions.ts`)**: Stark frequentierte Debug-Logs (`console.info`, `console.warn` bei Event-Routing) und speicherintensive `DebugLogService`-Aufrufe in der `negate`-Action auskommentiert, da diese bei jeder Ball-Paddle/Wand BerÃ¼hrung synchrone Time-Gaps (Stottern) verursachten.

### Fixed (Paddle-Steuerung / InputController)
- **Direkte Keyboard-Verwaltung** (`EditorRunManager.ts`): Keyboard-Listener werden jetzt direkt im EditorRunManager via `setupKeyboardListeners()`/`removeKeyboardListeners()` verwaltet, statt Ã¼ber `TInputController.start()`/`stop()`. Behebt: IC's interne Methoden griffen nicht zuverlÃ¤ssig (Splash-Screen verhindert `initMainGame()`, HMR-Instanz-Inkonsistenzen).
- **InputController-Initialisierung vor Splash-Check** (`GameRuntime.ts`): Neue Methode `initInputControllers()` wird VOR dem Splash-Check in `start()` aufgerufen, damit Keyboard-Events sofort nach Spielstart funktionieren.
- **Events-Dropdown zeigt alle Tasks** (`InspectorContextBuilder.ts`): `availableTasks` nutzt jetzt `getTasks('all')` statt `getTasks('active')`, damit globale Objekte (InputController auf Blueprint-Stage) auch Spielfeld-Tasks im Dropdown sehen.

## [3.12.2] - 2026-03-12
### Fixed (AbwÃ¤rtskompatibilitÃ¤t Ã¤lterer Spiele)
- **`self`/`other` AuflÃ¶sung in Actions** (`StandardActions.ts`): `resolveTarget()` lÃ¶st jetzt `self` und `other` korrekt Ã¼ber `eventData` auf. Bei Kollisionen enthÃ¤lt eventData `{self, other, hitSide}`. Vorher wurde `self`/`other` nie aufgelÃ¶st â†’ alle `variable`-Actions mit `source: 'self'/'other'` scheiterten.
- **`calcSteps`-Auswertung im `calculate`-Handler** (`StandardActions.ts`): Wenn `formula`/`expression` fehlt aber `calcSteps` vorhanden sind, werden die Steps sequentiell ausgewertet. UnterstÃ¼tzt `operandType: 'variable'`, `'objectProperty'` und `constant` mit Operatoren `+`, `-`, `*`, `/`.
- **`self`/`other` im Evaluationskontext**: Der `calculate`-Handler injiziert jetzt `self`/`other` aus `eventData` in den `evalContext`, damit Formeln wie `self.y` oder `other.height` funktionieren.
- **`negate`-Action hinzugefÃ¼gt** (`StandardActions.ts`): Negiert numerische Properties (z.B. `velocityX * -1`). Wird in Arkanoid/Tennis fÃ¼r Ball-RichtungsÃ¤nderung bei Kollision verwendet.
- **Alle Action-Handler konsistent**: `property`, `variable`, `animate`, `move_to`, `call_method` verwenden jetzt `context.eventData` fÃ¼r Target-AuflÃ¶sung.

## [3.12.1] - 2026-03-11
### Performance (Runde 2 â€” Smooth 60fps)
- **Direkte Sprite-Referenzen statt stale Copies** (`GameLoopManager.ts`, `EditorRunManager.ts`): `spriteRenderCallback` Ã¼bergibt jetzt `this.sprites` (aktuelle Referenzen vom GameLoopManager) direkt an `renderSpritesOnly()`. Vorher wurden stale Deep-Copies aus `getObjects()` genutzt â€” Positionen blieben beim Startwert.
- **RAF-Debounce fÃ¼r GlobalListener** (`GameRuntime.ts`): Der `onRender`-Callback wird jetzt per `requestAnimationFrame` debounced. Egal wie viele Properties sich pro Frame Ã¤ndern (Score + Label + Toast + ...), es gibt nur EIN `editor.render()` pro Frame.
- **TDebugLog console.log-Spam eliminiert** (`TDebugLog.ts`): `shouldShowRecursive()` loggte bei JEDEM `renderLogs()`-Aufruf fÃ¼r ALLE matching EintrÃ¤ge â†’ exponentielles Wachstum. `subscribe`-Callback jetzt ebenfalls per RAF debounced.
- **AnimationManager Logging bereinigt** (`AnimationManager.ts`): `update()` loggte 60x/sec in die Console. Alle High-Frequency-Logs auskommentiert, `Tween completed`-Log beibehalten.

## [3.12.0] - 2026-03-11
### Performance
- **Editor-Rendering-Optimierung (60fps Sprite-Bewegung)**: Separater Fast-Path fÃ¼r Sprite-Positionen im Editor Run-Modus implementiert. Sprites werden jetzt direkt per `style.left/top` aktualisiert (Ã¤hnlich dem Standalone-Player), statt den gesamten DOM-Render-Zyklus zu durchlaufen.
  - `GameLoopManager.ts`: Neuer `spriteRenderCallback` als Fast-Path â€” nur Sprite-Positionen statt volles DOM-Rebuild.
  - `StageRenderer.ts`: Neue Methode `updateSpritePositions()` fÃ¼r direkte Pixel-Positionierung. CSS-Transition (`left 33ms linear`) entfernt, da sie mit `requestAnimationFrame`-Timing kollidiert.
  - `GameRuntime.ts`: Neues `onSpriteRender` Feld in `RuntimeOptions`, durchgereicht an `GameLoopManager`.
  - `EditorRunManager.ts`: Neue Methode `renderSpritesOnly()` filtert Sprites und ruft Fast-Path auf. `handleRuntimeEvent()` ruft kein doppeltes `editor.render()` mehr auf.
  - `Stage.ts`: `updateSpritePositions()` Delegierungsmethode (renderer bleibt private).

## [3.11.9] - 2026-03-10
### Added
- **Glow/Shadow-Effekt fÃ¼r alle Komponenten** (`src/components/TWindow.ts`, `src/editor/services/StageRenderer.ts`): Neue Properties `glowColor`, `glowBlur`, `glowSpread` und `boxShadow` (CSS-String) im Inspector unter Gruppe "GLOW-EFFEKT". Wirkt auf alle TWindow-Ableitungen (TPanel, TButton, TLabel, etc.).
- **AgentController API vervollstÃ¤ndigt** (`src/services/AgentController.ts`): 22 neue Methoden â€” Delete (Task/Action/Object/Stage/Variable), Rename (Task/Action), Read (listStages/listTasks/listActions/listVariables/listObjects/getTaskDetails), UI (setProperty/bindVariable/connectEvent), Workflow (duplicateTask), Validation (validate).

### Fixed
- **AgentController.generateTaskFlow()**: Connection-IDs, Start/End-Koordinaten und Type-Casing (kleingeschrieben) korrigiert fÃ¼r korrekte FlowEditor-Darstellung.
- **Inspector Scroll-Position**: Bleibt nach Property-Ã„nderung erhalten (kein doppeltes update bei originator='inspector').
- **Server-Endpoint** `GET /api/dev/list-projects`: Listet alle Ordner und JSON-Dateien unter `projects/` auf.
- **Dynamischer Speicherpfad** (`src/editor/services/EditorDataManager.ts`): `saveProjectToFile` nutzt jetzt `currentSavePath` statt festen Pfad `projects/master_test/`. "Speichern unter" setzt diesen Pfad via Dialog.
- **VariablePickerDialog** (`src/editor/inspector/VariablePickerDialog.ts`): Neuer modaler Dialog zur Variablen-Auswahl im Inspector. Ersetzt den bisherigen `prompt()`-Dialog. Zeigt globale und Stage-Variablen mit Subeigenschaften als Baumstruktur, Suchfeld und Gruppierung (ðŸŒ� Global / ðŸŽ­ Stage / ðŸ”„ Repeater).

### Fixed
- **Binding-Anzeige im Inspector** (`src/editor/inspector/InspectorHost.ts`): `resolveValue()` bewahrt jetzt Binding-Werte (z.B. `${currentUser.name}`) als Rohtext, statt sie erneut durch den Template-Parser zu schicken. Verhindert doppelte Template-AuflÃ¶sung, die Binding-Werte zu leeren Strings machte.
- **findObjectById gibt Original statt Preview** (`src/editor/services/EditorCommandManager.ts`): `findObjectById()` gab Preview-Objekte aus dem ObjectStore zurÃ¼ck, in denen Bindings bereits aufgelÃ¶st (= leer) waren. Jetzt wird Ã¼ber `__rawSource` das Original-Objekt mit den Roh-Binding-Werten zurÃ¼ckgegeben.
- **Falsches Dirty-Flag nach Startup** (`src/editor/EditorViewManager.ts`): `isProjectDirty` wurde bei JEDEM `DATA_CHANGED`-Event auf `true` gesetzt, auch beim initialen Laden. Jetzt wird der Originator geprÃ¼ft: Events mit `'editor-load'` oder `'autosave'` setzen das Flag nicht mehr.
- **Circular JSON beim Serialisieren** (`src/services/ProjectPersistenceService.ts`): Neuer `safeReplacer()` filtert zirkulÃ¤re Properties (`renderer`, `host`, `parent`, `stage`, `editor`, `__rawSource`) bei ALLEN `JSON.stringify`-Aufrufen (autoSave, saveProject, saveProjectToFile).
- **Stage-MenÃ¼ nach Laden** (`src/editor/services/EditorDataManager.ts`): `updateStagesMenu()` wird jetzt verzÃ¶gert am Ende von `loadProject()` aufgerufen, damit neue Stages zuverlÃ¤ssig im MenÃ¼ erscheinen.

### Changed
- **InspectorActionHandler** (`src/editor/inspector/InspectorActionHandler.ts`): `handlePickVariable()` nutzt jetzt den neuen `VariablePickerDialog` statt `prompt()`. Vereinfachte Wert-Persistierung (keine Konkatenation mehr, direktes Ersetzen).

## [3.11.8] - 2026-03-10
### Added
- **E2E-Test: Stage erzeugen** (`tests/e2e/05_StageCreation.spec.ts`): UseCase "Eine neue Stage erzeugen" â€” MenÃ¼: Stages â†’ Neue Stage, Umbenennung zu HighscoreStage, Validierung in project.stages, Speicherung.
- **E2E-Test: Action Typ Ã¤ndern** (`tests/e2e/06_ActionTypeChange.spec.ts`): UseCase "Action Typ Ã¤ndern" â€” Flow-Tab â†’ VerifyTask-Flow â†’ VerifyAction anklicken â†’ ActionTypeSelect auf navigate_stage, stageId auf HighscoreStage.
- **E2E-Test: RunButton erzeugen** (`tests/e2e/07_RunButtonCreation.spec.ts`): UseCase "RunButton erzeugen" â€” Stage-Tab â†’ Toolbox â†’ Button platzieren â†’ Inspector caption auf 'run' setzen.
- **UseCase-Beschreibungen** (`docs/UseCaseBeschreibungen/`): 3 neue UseCase-Dateien fÃ¼r Stage erzeugen, Action Typ Ã¤ndern, RunButton erzeugen.

### Fixed
- **getStageOptions Bugfix** (`src/editor/JSONDialogRenderer.ts`, L91-95): `getStageOptions()` nutzt jetzt `this.project.stages` statt `this.enrichedProject.stages`. Das `enrichedProject` war ein Snapshot vom Dialog-Konstruktor und konnte neue Stages (z.B. HighscoreStage) nicht enthalten.

### Changed
- **Test-Nummerierung**: `05_ProjectSaving.spec.ts` â†’ `08_ProjectSaving.spec.ts` (Tests 05-07 sind die neuen UseCase-Tests).

## [3.11.7] - 2026-03-09
### Added
- **UseCase: Projekt speichern** (`src/editor/services/EditorDataManager.ts`): `saveProjectToFile()` implementiert. Speichert das Projekt gemÃ¤ÃŸ den 4 UseCase-Schritten: Ã„nderungsstatus prÃ¼fen, Spielname validieren (kein 'Haupt-Level'), Datei-Existenz prÃ¼fen + Ãœberschreiben-Dialog, Speichern via `/api/dev/save-custom`. `isProjectChangeAvailable` wird VOR dem JSON.stringify zurÃ¼ckgesetzt.
- **Menu-Integration**: `EditorMenuManager.ts`: Case `'save'` leitet jetzt zu `saveProjectToFile()` um. Neuer Case `'save-dev'` ruft das alte `saveProject()` auf.
- **E2E-Test: Projekt speichern** (`tests/e2e/ProjectSaving.spec.ts`): 3 Tests fÃ¼r alle UseCase-Schritte (Abbruch kein Change, Abbruch Standard-Name, Erfolgreiche Speicherung + Round-Trip JSON-Validierung). Alle 3 passed (3.1s) âœ….

### Fixed
- **Serialization: Read-Only Getter-Fehler** (`src/utils/Serialization.ts`): Alle Read-Only Getter von `TStageController` zur `reservedKeys`-Liste hinzugefÃ¼gt: `currentStageId`, `currentStageName`, `currentStageType`, `currentStageIndex`, `stageCount`, `mainStageId`, `isOnMainStage`, `isOnSplashStage`. Verhindert mehrfache `TypeError: Cannot set property ... which has only a getter` beim Laden.
- **Laden: Endlosschleife am Lade-Dialog** (`src/editor/services/EditorDataManager.ts`): `isProjectDirty=false` wird jetzt NACH `notifyDataChanged()` (synchron + `setTimeout(100)`) in `loadProject()` gesetzt. `setProject()` und `autoSaveToLocalStorage()` lÃ¶sten `DATA_CHANGED` aus â†’ `isProjectDirty=true`. Reset wurde dadurch Ã¼berschrieben.
- **`saveProjectToFile()` Ablauf-Bug**: `changeVar.defaultValue = false` wird korrekt VOR dem `JSON.stringify`-Aufruf gesetzt.

## [3.11.6] - 2026-03-09
### Added
- **E2E-Test: Task mit Action verknÃ¼pfen** (`tests/e2e/TaskActionLinking.spec.ts`): VollstÃ¤ndiger E2E-Test fÃ¼r den UseCase "Task mit Action verknÃ¼pfen" via Flow-Editor API. Testet den gesamten Flow: Projekt erstellen, Task und Action in MainStage ablegen, auto-generierten Task-Knoten wiederverwenden, Action-Knoten erzeugen, Verbindung Ã¼ber `restoreConnection()` herstellen, JSON-Validierung (Connection + actionSequence) und Manager-View UI-PrÃ¼fung.

### Fixed
- **Flow-Editor Knoten-Duplikat-Problem**: `switchActionFlow()` erzeugt automatisch einen Task-Knoten als Startpunkt. Ein zusÃ¤tzlicher `createNode('Task', ...)` Aufruf im gleichen Kontext erzeugt einen Konflikt. Korrekte LÃ¶sung: auto-generierten Knoten per `nodes.find(n => type === 'task')` referenzieren.
- **Task/Action Speicherort**: Tasks und Actions gehÃ¶ren in `stage.tasks` / `stage.actions` der aktiven Stage (z.B. `mainStage`), nicht in `project.tasks` (Root-Level).

## [3.11.5] - 2026-03-09
### Added
- **E2E-Test: Action Umbenennen** (`tests/e2e/ActionRenaming.spec.ts`): VollstÃ¤ndiger E2E-Test fÃ¼r den UseCase "Eine Action umbenennen" via Inspector UI. Testet den gesamten Flow: Projekt erstellen, VerifyTask anlegen, Action erzeugen, per Inspector umbenennen, JSON-Validierung (alle Speicherorte) und Manager-View PrÃ¼fung.

### Fixed
- **Action-Speicherort-Logik**: Test-Assertions robustifiziert, um alle mÃ¶glichen Action-Speicherorte zu berÃ¼cksichtigen (Root-Level, alle Stages inkl. Blueprint, alle FlowCharts-EintrÃ¤ge). Actions werden gemÃ¤ÃŸ `getTargetActionCollection`-Logik in `activeStage.actions` gespeichert.
- **syncToProject nach Rename**: Explizites Aufrufen von `syncToProject()` nach dem Inspector-Rename stellt sicher, dass die Ã„nderung in der Projektstruktur persistiert wird.

## [3.11.4] - 2026-03-09
### Added
- **Blueprint-Visualisierung**: Service-Objekte (z. B. `StageController`) und globale Variablen sind nun exklusiv in der `blueprint`-Stage sichtbar.
- **Variablen-Werte auf Stage**: Variablen zeigen nun ihren Namen und ihren aktuellen Wert (oder Defaultwert) direkt auf der Stage an.

### Changed
- **Variablen-Inspector**: Variablen werden einheitlich als Textfelder (`TEdit`) dargestellt, um die explizite Anzeige von Werten wie "true" oder "false" zu ermÃ¶glichen (NutzerprÃ¤ferenz). Labels wurden auf "Default-Wert" und "Aktueller Wert" angepasst.
- **Stage-MenÃ¼ Synchronisierung**: Namen von Stages werden nun bei einer Ã„nderung im Inspector sofort im "Stages"-MenÃ¼ der MenuBar aktualisiert.
- **Snap-To-Grid**: Neue Option im Stage-Inspector, um das Einrasten am Raster beim Verschieben/Resizen zu aktivieren oder zu deaktivieren.

### Fixed
- **Datenbindung im Inspector**: Fehler behoben, bei dem Boolean `false` und `undefined` in Textfeldern verschluckt wurden.
- **Serialization-StabilitÃ¤t**: `TypeError` beim Laden von Objekten mit Read-Only Properties (z.B. `currentStageId`) behoben.

## [3.11.3] - 2026-03-09
### Fixed
- **Action-Typ-Persistenz**: Stabilisierung der strukturellen Knoten-IdentitÃ¤t in `FlowAction.ts`.
- **TypeScript-Fix**: Behebung des Fehlers TS2339 in `FlowGraphHydrator.ts` durch korrektes Casting.
- **Sync-StabilitÃ¤t**: Sicherstellung, dass Typ-Ã„nderungen im Inspector konsistent in `project.json` gespeichert werden.

## [3.11.2] - 2026-03-09
### Fixed
- **Action-Typ-Persistenz**: Behebung des Fehlers, bei dem Typ-Ã„nderungen im Inspector (z. B. zu `data_action`) nicht gespeichert wurden.
- **Dynamische Typ-Erkennung**: `FlowAction.getType()` ermittelt den Typ nun zur Laufzeit aus den Model-Daten, was eine korrekte Serialisierung in `project.json` garantiert.
- **Auto-Morphed Nodes**: Automatische Erzeugung von Success/Error-Ports bei Typ-Wechsel zu `data_action` ohne Instanz-Austausch.

## [3.11.1] - 2026-03-09
### Fixed
- **Action-Persistenz (Index-basiert)**: Umstellung der Action-Suche im `FlowNodeHandler` auf einen hochperformanten Index-Lookup via `ProjectRegistry`. Verhindert zuverlÃ¤ssig "Action not found" Fehler.
- **Broad-Field Matching**: UnterstÃ¼tzung fÃ¼r robuste Identifizierung von Action-Knoten Ã¼ber verschiedene Felder (`name`, `actionName`, `data.name`, `properties.name`, `properties.text`).
- **Orphaned Action Cleanup**: Automatische Bereinigung von verwaisten Action-Referenzen in `actionSequence`-Listen durch den `SanitizationService`.
- **Flow-Synchronisation**: Korrekte Typ-Behandlung (`actionType` -> `type`) und Synchronisation verlinkter Actions im `FlowSyncManager`.

## [3.20.1] - 2026-03-20
### Fixed
- **HTML Export Crash:** Fehler bei `exportHTML` und `exportHTMLCompressed` behoben, der durch einen TypeError (ZirkulÃ¤re Struktur in `JSON.stringify`) verursacht wurde, indem ein spezieller `safeStringify`-Filter in den `GameExporter` integriert wurde.
- **HTML Export Crash:** Fehler bei Projekt-Objekten ohne veraltetes `project.stage` Objekt behoben, indem auf die modernen `project.stages[0]` Fallbacks zurÃ¼ckgegriffen wird.

## [3.20.0] - 2026-03-20
### Added
- **Intelligentes Speichermanagement**: EinfÃ¼hrung eines `isProjectDirty` Flags zur Erkennung ungespeicherter Ã„nderungen.
- **Browser-Schutz**: `window.onbeforeunload` Guard warnt vor dem Verlassen der Seite bei ungespeicherten Daten.
- **Sicherheitsabfragen**: BestÃ¤tigungsdialoge beim Erstellen neuer Projekte oder beim Laden, falls Ã„nderungen vorliegen.

### Changed
- **Entkoppeltes Speichern**: Automatisches Speichern schreibt nur noch in den `LocalStorage` (Crash-Schutz). Das Schreiben auf die Festplatte (`project.json`) erfolgt nur noch explizit durch den Nutzer via "Speichern"-Button.

### Fixed
- Wiederherstellung der `project.json` aus der Git-Historie nach versehentlichem Ãœberschreiben.
- **E2E-Reporting**: Rekursives Parsing von Test-Ergebnissen im Test-Runner zur UnterstÃ¼tzung verschachtelter Test-Suites.
- **Server-Check**: Automatisierte PrÃ¼fung der Game-Server Erreichbarkeit vor E2E-Tests.
- **E2E-StabilitÃ¤t**: Fix der Inspector-Hydrierung in `deep_integration.spec.ts` durch Umstellung von `setProject` auf `loadProject`.
- **Code-Cleanup**: Entfernen ungenutzter Variablen und Imports in der Runtime (TSC-Fix).

## [3.9.1] - 2026-03-06
### Added
- **Phase 6.2: Deep E2E Integration**: VollstÃ¤ndige Browser-Automatisierung fÃ¼r Kern-Use-Cases.
- `tests/e2e/deep_integration.spec.ts`: Komplexer Integrationstest (D&D, Inspector, Flow, Run-Mode).
- Playwright-Konfiguration fÃ¼r stabile sequentielle TestausfÃ¼hrung.

### Fixed
- StabilitÃ¤t der Drag-and-Drop Operationen im E2E-Test.
- AmbiguitÃ¤t der Inspector-Selektoren im Playwright-Kontext.
- Toolbox-Kategorien-Expansion in `editor_smoke.spec.ts`.

## [3.9.0] - 2026-03-06
### Added
- **Phase 5 & 6**: Implementierung des Master-Test-Projekts und Playwright E2E-Infrastruktur.
- `scripts/seed_test_data.ts`: Generator fÃ¼r komplexes 3-Stage Projekt.
- `tests/e2e/editor_smoke.spec.ts`: Erster automatisierter Browser-Smoke-Test.

[... weitere EintrÃ¤ge siehe Archiv ...]

## [3.9.1] - 2026-03-31
### Changed
- CleanCode: 24 verbleibende \console.*\-Aufrufe in erfolgskritischen Modulen durch \Logger\ ersetzt (StageRenderer, GameRuntime, GameLoopManager, ReactiveRuntime, ExpressionParser, StandardActions).
- Performance: \console.table\ in \StageRenderer\ durch verschachtelten Logger-Call ausgetauscht.

[fix] Serialization: Added TVirtualGamepad class to hydrateObjects to prevent data loss in iframe runner export
[feature] VirtualGamepad: Implemented dual-stick multiplayer support (auto-detecting both WASD and Arrows)


## 08.04.2026

### Bug Fixes / Architecture
- **DeepCopy (Run Mode):** Problem behoben, dass safeDeepCopy() beim Starten des Run-Modus Getter/Setter-Eigenschaften (z. B. ackgroundImage des Ufos) ignoriert hat, wodurch Sprites falsch (rote Blï¿½cke) gerendert wurden. safeDeepCopy nutzt nun .toDTO(), falls vorhanden, um sicherzustellen, dass die geklonten Objekte alle Inspektions-Eigenschaften beinhalten.
-
**TStringMap
in
VariablePickerDialog**:
Die
Keys
einer
TStringMap
werden
nun
im
VariablePickerDialog
korrekt
zur
Auswahl
angeboten.

- **TStringMap RunMode Fix**: TypeError beim Starten des Run-Modus behoben (GameRuntime versuchte readonly value zu Ã¼berschreiben).

[UC-2026-04-10-TRichText-Fixes] TRichText in ComponentRegistry registriert, damit sie im Run-Mode nicht verschwindet. Standard-Werte für 'color' und 'fontSize' injiziert, um Editor/Run-Größenunterschiede zu fixen.


[UC-2026-04-10-ColorPicker-Bind] Option eingeführt, durch Variablen-Binding ('V' Button) die Werte des Color-Pickers (Hintergrund, Rahmenfarbe etc.) überschreiben zu können, um z.B. Game-Themes dynamisch zu realisieren.


### 2026-04-13
- **FIX**: ReactiveRuntime proxy tracking extended to TStage to guarantee grid property (backgroundColor) DOM-Updates are fired via onRender.

- **FIX**: Resolved DOMContentLoaded race-condition in execution frame for dynamically loaded Engine Script.

- **TESTS**: Added security validation coverage (Path Traversal / Sandbox Breaking) to the Regression Test Suite.

- **TESTS**: Added Playwright E2E HTML-Injection Test Suite to verify strict protection against malicious JSON payloads and UI manipulation.

- **FEATURE**: Freischaltung der Funktion 'Stage duplizieren'. User knnen nun ber Stage > Aktuelle Stage duplizieren komfortabel in-project Kopien einer ganzen Stage anlegen.

- **FEATURE**: Stage Background Context Menu. Ein verstecktes Kontextmen fr Stages hinzugefgt, welches erlaubt ausgeblendete globale Blueprint-Komponenten (excludeBlueprint) wieder einzeln einzublenden.

- **BUGFIX**: Behebung eines Maximum call stack size exceeded-Fehlers im ReferenceTracker. Ein Set zur Verfolgung bereits besuchter Objekte verhindert nun infinite Rekursionen bei circulren Referenzen innerhalb des Projekts.

- **BUGFIX**: Behebung diverser TypeScript Compiler-Fehler in EditorInteractionManager, GameExporter, MiscActions und ExpressionParser.


- **FEATURE**: Die Action \call_method\ (Methode aufrufen) nutzt nun Dropdown-Auswahlfelder f�r Ziel-Komponente und Methoden. Die auflistbaren Methoden werden live dynamisch anhand der ermittelten Typ- und Objektinformationen der Ziel-Komponente geladen.









- **Fix:** (Editor) Blueprint-Exclusion Mechanismus lste keinen Autosave aus, wodurch ausgeblendete Objekte nach Neuladen der Stage wieder auftauchten (behoben in StageInteractionManager).


- **Fix:** (Runtime) Blueprint-Exclusions wurden im Standalone-Player durch die MainStage-Fallback-Logik ueberschrieben. Der Filter in getMergedStageData greift nun ganz am Ende der Verarbeitungkette.

- **FIX**: (Electron) Behebung des Renderer-Hangs durch vollstndigen Ersatz blockierender Dialoge (alert/confirm/prompt) durch non-blocking Promise-basierte HTML-Dialoge in allen Editor-Modulen.
\n## 16.04.2026\n### Stage Import Refactoring & Electron Runtime Fix\n- **UI/UX**: Checkboxen im Stage-Import Dialog sind nun standardm��ig deaktiviert, um den Import einzelner Stages zu beschleunigen. Zuz�glich wurde ein 'Alle / Keine'-Toggle hinzugef�gt.\n- **Z-Index Layering**: Alle Promise-basierten Dialoge (ConfirmDialog, PromptDialog, NotificationToast) wurden mit extrem hohen z-index Werten (99999+) versehen, um zu verhindern, dass sie hinter anderen UI-Elementen (wie dem Verwaltungs-Dialog) verschwinden.\n- **Electron Cache Invalidation**: Nach dem Importieren von Stages wird nun explizit \projectStore.setProject(this.project)\ getriggert, sodass die IFrame-Runtime den aktualisierten GameState �ber den MediatorService (\injectedProject\) synchronisiert bekommt. Dies behebt den Fehler, dass neue Stages im Run-Modus nicht auffindbar waren.\n- **E2E Tests Fixed**: Fehlerhafter DOM-Locator im E2E Test \3_ActionRenaming.spec.ts\ auf die neuen \NotificationToast\-Klassen migriert, da \window.alert\ nicht mehr verwendet wird.\n
