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
- **Double Hydration Shield (Ansatz A + B)**: Die kritische Schutzschicht gegen versehentliche Doppel-Hydratisierung wurde auf zwei Ebenen massiv gehärtet:
  1. *Offensiv (RuntimeStageManager)*: Ein neuer `isAlreadyHydrated`-Check (Prüfung auf `instanceof TWindow`) wertet noch *vor* dem Schleifen-Durchlauf aus, ob das Array bereits lebende Instanzen enthält, und umgeht den Hydrierungszyklus komplett.
  2. *Defensiv (Serialization.ts)*: Der "Idempotency Check" wurde explizit als Hard-Fallback wieder in `hydrateObjects` integriert (`if (objData instanceof TWindow) ... return`). 
  Diese kombinierte Architektur garantiert nun ausnahmslose Stabilität, selbst wenn künftige Refactorings (wie die geplante SSoT-Trennung) Datenströme unbemerkt verändern sollten.
- **Dead Code in Serialization.ts**: Behebung eines Fehlers, bei dem das interne `isInternalContainer` Flag nicht mehr auf interne Komponenten (`TDataList`, `TTable`, `TObjectList`, `TEmojiPicker`) angewandt wurde. Durch das vorherige Registry-Refactoring wurde das Setzen der Eigenschaft unabsichtlich in einen toten Code-Pfad *vor* die eigentliche Objekterstellung (`ComponentRegistry.create`) verschoben. 
- **Double Action Logs Bug**: Behebung eines rein kosmetischen UI-Bugs, bei dem reguläre Actions (ohne Body) wie `Action_DestroyBullet` doppelt in der Runtime-Debugger-Ansicht protokolliert wurden.
  - *Ursache:* Sowohl der `TaskExecutor` als auch der `ActionExecutor` schrieben beim Aufruf einen Log-Eintrag in den `DebugLogService`.
  - *Lösung:* Das redundante Logging im `TaskExecutor` wurde entfernt. Der `TaskExecutor` loggt nun nur noch dann einen separaten Eintrag, wenn eine Action ein komplexes Kompositum (mit Body-Array) ist und schiebt diesen korrekterweise in den Context-Stack, während einfache Ausführungen exklusiv dem `ActionExecutor` überlassen werden.
- **Double Hydration Bug (Stage-Anzeige im Run-Mode)**: Behebung eines kritischen Fehlers, bei dem die Stage-Anzeige (Grid/Background) im Run-Mode korrupt werden konnte, da die Editor-Objekte doppelt hydratisiert und ihre Referenzen in der Runtime weiterverwendet wurden.
  - *Lösung:* In `EditorRunManager.ts` wird nun `safeDeepCopy(this.editor.project)` verwendet, um das Projekt strikt in ein rein datenbasiertes (JSON-Plain-Object) DTO zu entkoppeln *bevor* The Runtime startet.
- **Run-Mode Crash bei TInputController (Set/Map Clone Bug)**: Nach der Einführung von `safeDeepCopy` kam es beim Starten des Run-Modes durch den `TInputController` zu einem Crash (`keysPressed.clear is not a function`).
  - *Ursache:* `safeDeepCopy` klonte `Set`- und `Map`-Strukturen fehlerhaft zu reinen Objekten (`{}`). Beim anschließenden `hydrateObjects` wurde das `commands: new Set()` des `TInputController` mit dem defekten leeren Objekt überschrieben.
  - *Lösung:* `safeDeepCopy` in `DeepCopy.ts` unterstützt nun natives Auslesen und Klonen von `Set` und `Map`.

### Refactored
- **Dynamische Getter-Prüfung per Reflection**: Die stark fehleranfällige und manuelle `reservedKeys`-Ausschlussliste in `Serialization.ts` (welche alle Getter-only Properties diverser Komponenten händisch ausschließen musste) wurde komplett eliminiert. Die Serialisierung iteriert stattdessen live via `Object.getOwnPropertyDescriptor` über die Prototypen-Kette der Zielklasse, und prüft exakt zur Laufzeit, ob einer Eigenschaft ein `set`-Accessor zur Verfügung steht oder ob diese dynamisch schreibbar (`writable: true`) ist. Dies löst eine massive Frustrationsquelle bei der Komponentenerweiterung vollständig auf.
- **Code-Duplizierung in ComponentRegistry**: Die verschachtelte IIFE-Factory der `TSplashStage` (welche fälschlicherweise manuell `duration` und `autoHide` setzte) wurde zu einem sauberen Lambda-Einzeiler refactored. Diese spezifischen Parameterzuweisungen waren redundant, da der Magic Loop der Laufzeitumgebung sie sowieso dynamisch bedient.

- **Code-Duplizierung in Serialization.ts (Property-Zuweisung)**: Ca. 150 Zeilen redundante, statische und manuell gecastete `(newObj as any).XYZ` Property-Wiederherstellungen wurden komplett gelöscht. Diese Funktionalität wurde de facto durch den bereits existierenden, generischen "Magic Loop" erledigt, wodurch dieser massive Block komplett redundant und fehleranfällig war. Zukünftige Komponentenerweiterungen profitieren nun verlustfrei von der automatischen Generizität.
- **Open/Closed Principle in Serialization.ts**: Der 566-zeilige unersättliche Switch-Case in `hydrateObjects` wurde durch eine dynamische `ComponentRegistry` (`src/utils/ComponentRegistry.ts`) abgelöst. Um manuelle Boilerplate zu vermeiden, inkludiert nun jedes `src/components/*.ts`-Modul sein eigenes `ComponentRegistry.register()` Statement am unteren Dateiende. Eine dynamisch generierte Import-Map (`src/components/index.ts`) stellt sicher, dass alle Module während des Application-Starts geparst und registriert werden, was nun nahtloses Skalieren der UI-Komponenten ohne Editieren der Kern-Logik ermöglicht.

## [3.35.3] - 2026-04-07
- **Run-Tab UI Aktualisierungsfehler (Bindings)**: Behebung eines kritischen Fehlers, bei dem reaktive UI-Bindings (wie `Score: ${score.value}`) im Standalone-IFrame zwar korrekt aktualisiert wurden, im internen Editor-Run-Tab jedoch nicht sichtbar waren. 
  - *Ursache:* Durch frühere Refactorings wurde die Stage-Renderer-Referenz im `EditorRunManager` ungültig (`this.editor.renderer` anstatt `this.editor.stage.renderer`). Dadurch verpufften die `updateSingleObject`-Signale der Game Engine stumm im Nichts, ohne den DOM zu erreichen.
  - *Lösung:* Der Pfad wurde repariert und `StageRenderer` korrekt veröffentlicht. Variablen-Änderungen fließen nun wieder augenblicklich als UI-Updates in den DOM.
- **Log Cleaning**: Umfangreiche Bereinigung von redundanten Debugging-Meldungen (`RUNTIME G...` console.errors und blockierende `alert`-Aufrufe) aus `GameRuntime.ts` und `EditorRunManager.ts`, die für die Spurensuche des Silent Crashs benötigt wurden.

## [3.35.2] - 2026-04-07
- **Vite Dev-Server Proxy**: Die fehlende Proxy-Konfiguration für `/api` und `/platform` wurde in der `vite.config.ts` wiederhergestellt. Dadurch ist der Game-Server via `localhost:8080` wieder für den Editor (unter `localhost:5173`) erreichbar. Dies behebt den Fehler "Kritischer Fehler beim Speichern (Server nicht erreichbar)".

## [3.35.0] - 2026-04-07
### Added
- **Electron Desktop App Infrastruktur**: 
  - Einrichtung eines neuen `electron/` Ordners mit `main.cjs` (Hauptprozess) und `preload.cjs` (ContextBridge).
  - Umstieg auf direkten Dateizugriff des Betriebssystems (nativ) über `window.electronFS` statt lokaler Express Server.
  - Einführung des Single Codebase "Dual-Modes": Web-Dienste (`fetch('/api...')`) bleiben bestehen, aber im Offline-Kontext (`window.electronFS`) werden OS-native Äquivalente bevorzugt. Die Web-Version bleibt also intakt!
  - `GameExporter`: Modifiziert, damit er im Offline-Modus das `runtime-standalone.js` direkt ins ZIP/HTML bundeln kann, statt es via Fetch zu laden.
  - Integration von nativen OS-Dialogen (`showOpenDialog`, `showSaveDialog`) ins Dateisystem, damit Benutzer Projekte überall abspeichern können.
  - Migration von `EditorDataManager` (`saveProjectAs` / `saveProjectToFile`), sodass dieser via IPC native asynchrone File-Wrights durchführt.
  - Implementierung sicherer IPC-Handler (`fs:readFile`, `fs:writeFile`, `fs:listFiles`, `fs:showOpenDialog`, `fs:showSaveDialog`) via `ipcMain` und `contextBridge` unter strikter Nutzung von `contextIsolation: true` und `nodeIntegration: false`.
  - `package.json` um `dev:electron` und `build:electron` Skripte erweitert und `electron`/`electron-builder` hinzugefügt.
  - `vite.config.ts`: Proxy-Server Config auskommentiert, da Dev-Server wegfällt.

## [3.35.1] - 2026-04-07
### Fixed
- **IFrame Run-Tab**: Die Zuweisung des `iframe.src` im `EditorViewManager` wurde angepasst. Anstatt einen harten abslouten Pfad (`/iframe-runner.html`) zu setzen, der im Electron-Modus auf das Root-Laufwerk verweist, wird nun abhängig vom Protokoll `file:` oder `http/https` flexibel auf `iframe-runner.html` oder `/iframe-runner.html` zurückgegriffen.
- **Demo-Projektdaten (Spawning Shooter Demo)**: Sprite-Bilder im `Spawning_Shooter_Demo` nutzten absolute URLs (`/images/Ufos/ufo_transparet.png`), was in lokalen `file://`/Electron-Umgebungen fehlschlug. Alle Pfade in der Projekt-Datei verwenden jetzt einen relativen Start (`./images/...`).

## [3.35.0] - 2026-04-07
### Added
- **Virtual Gamepad Layout Anpassung**: 
  - Die `TVirtualGamepad` Komponente unterstützt nun die Eigenschaft `splitVerticalAlignment` (Vertikale Ausrichtung).
  - Ist das Layout auf "split" gestellt, können die Buttons wahlweise am unteren Bildschirmrand ("bottom") oder vertikal zentriert ("middle") platziert werden (nutzbar über den Inspector).

- **Ruckelfreies Label Update & Optimierung (Targeted Rendering)**: 
  - Wiederherstellung des "Targeted Rendering", um zu verhindern, dass häufige Variablen-Updates (z.B. Score, Timer) die gesamte Stage neu rendern lassen und Jitter auf mobilen Endgeräten verursachen.
  - `GameRuntime.ts`: Global-Listener umgeht Full-Render für Eigenschaften und ruft `onComponentUpdate` auf. Für Variablen-Updates (z.B. Score) wurde ein **"Soft-Render"** eingeführt, der statt eines DOM-Rebuilds alle UI-Komponenten in-place aktualisiert.
  - `StageRenderer.ts`: `updateSingleObject()` weiter verbessert und integriert, um einzelne Elemente DOM-schonend zu aktualisieren. Migration von `transform: translate3d` zu nativem CSS `translate`.
  - `style.css`: GPU-Compositing via `contain: layout style paint` für game-objects.

- **Touch & Pointer Support**: Das GCS unterstützt nun offiziell Touch-Geräte (Smartphones & Tablets)!
  - **Pointer-Events:** Die `GameRuntime` und der `StageRenderer` fangen nun Pointer-Events (`onpointerdown`, `onpointermove`, `onpointerup`) ab, um eine einheitliche Eingabeverarbeitung für Maus, Touch und Stift zu gewährleisten. Drag & Drop im Standalone-Export nutzt ebenfalls Pointer-Events mit `setPointerCapture`.
  - **Event-Namen für Non-Coders:** Im Editor und Inspector heißen die Events intuitiv `onTouchStart`, `onTouchMove` und `onTouchEnd`. So bleibt die Bedienung einfach.
  - **Performance:** Touch-Bewegungen (`onTouchMove`) sind via `requestAnimationFrame` optimiert, um 60fps bei gleichmäßiger Netzersparnis zu erhalten.
  - **CSS:** Touch-Action Scrolling/Zooming im Spielfeld über `touch-action: none` auf dem Container unterbunden.
  - **Verfügbarkeit:** Die neuen Events sind als Standard-Events an allen GCS-Komponenten (`TComponent`) registriert und können im Inspector für Flow-Tasks gebunden werden.
- **TVirtualGamepad**: Ein intelligenter, adaptiver Gamepad-Simulator (`VirtualGamepadRenderer`) für Touch-Geräte.
  - Nutzt Layout-Eigenschaften: D-Pad, Xbox-Rautenform und dynamische Action-Bars berechnen sich automatisch.
  - Skaliert mit Grid und registriert automatisiert die Tasten des bestehenden `TInputController`.
  - Zeigt sich nur auf Touch-Geräten (Auto-Hide auf PC).

## [3.33.0] - 2026-04-03
- **IFrame Run-Tab**: Ein neues Standalone-Preview Feature! Statt die GameRuntime invasiv ins Editor-DOM zu quetschen, erstellt der neue Tab `Run (IFrame)` ein abgekapseltes `<iframe src="/iframe-runner.html">` und speist es via `postMessage` mit exakt demselben sauberen JSON-Objekt, das auch `GameExporter.getCleanProject()` exportiert. Bietet 100% Export-Parität und löst Runtime/Editor Memory Leaks auf Knopfdruck ("Müllabfuhr-Prinzip").

## [3.32.1] - 2026-04-03
### Fixed
- **GroupPanel Layout Export:** Fehler im Standalone Export behoben, durch den Kind-Elemente von GroupPanels (die auch eine hierarchische Position besitzen) verschoben exportiert wurden oder unsichtbar verschachtelt waren. GameRuntime nutzt nun streng die relativen Koordinaten (copy.x = rx), was den Double-Offsetting-Bug des StageRenderer endgültig beseitigt und gleichzeitig die Parent-ID für den Z-Index beibehält.


## [3.32.0] - 2026-04-03
### Improved (CleanCode)
- **TypeScript `any`-Audit — Quick-Wins** (6 Dateien, ~30 `any` eliminiert):
  - `types.ts`: Neue Interfaces `FlowElementData` / `FlowConnectionData` für typisierte FlowCharts. `ProjectVariable.style` nutzt nun `ComponentStyle`. `LegacyGameTask` und `GameObject` mit `@deprecated` und `unknown` statt `any`.
  - `InspectorTypes.ts`: `TPropertyDef.style` → `Record<string, string>`, `actionData` → `Record<string, unknown>`.
  - `TComponent.ts`: `IRuntimeComponent.initRuntime` mit `GridConfig` und `ComponentData[]` statt `any`.
  - `ActionRegistry.ts`: `getVisibleActionTypes(project: GameProject | null)` mit typisierten Callback-Lambdas.
  - `config.ts`: `parsePrefixLogLevels(env: Record<string, string | undefined>)`.
  - `player-standalone.ts`: 13 `any`-Vorkommen durch `GameProject`, `ComponentData`, `StageDefinition`, `ServerMessage` und `HTMLElement | null` ersetzt.

## [3.31.2] - 2026-04-03
- **GroupPanel Editor-Sichtbarkeit** (`StageRenderer.ts`):
  - Wenn ein GroupPanel im Editor nicht markiert war und keine eigene Hintergrundfarbe definiert hatte, versank es in der Unsichtbarkeit, da das Standard-`TGroupPanel`-Styling (`0px solid transparent`) den Fallback-Border überschrieben hat. Das Panel hat nun im Editor-Modus stets einen leicht durchsichtigen Hintergrund und einen "dashed" (gestrichelten) Rand, der erst im Run/Standalone-Modus verschwindet.
- **GroupPanel Kind-Selektion** (`StageRenderer.ts`, `InspectorHeaderRenderer.ts`):
  - Klick-Interaktionen für verschachtelte Elemente in `TGroupPanel`s behoben. Die Render-Reihenfolge nutzt nun die Eltern-Kind-Hierarchietiefe als Fallback für den `zIndex`, wodurch Kinder verlässlich über ihrem Panel gezeichnet und somit wieder anklickbar (markierbar) werden.
  - Im Inspector-Dropdown werden untergeordnete Elemente von GroupPanels nicht mehr fälschlicherweise als `(Global)` gekennzeichnet, sondern erhalten den korrekten Tag `(Child)`.

## [3.31.1] - 2026-04-02
- **Dynamic Inspector Bugfix** (`FlowAction.ts`):
  - Behebung eines kritischen UI-Status-Fehlers, bei dem sich der Inspector nach einem Wechsel der `effect`-Eigenschaft für `visibleWhen` nicht neu gezeichnet hat.
  - Hinzufügen von `defaultValue` zum Konfigurationsobjekt der Flow-Actions, wodurch leere Number-Inputs im Inspector (z.B. bei der "Dauer") behoben wurden.

## [3.31.0] - 2026-04-02
- **Sprite-Animations-Effekte** (`AnimationManager.ts`, `AnimationActions.ts`):
  - 9 neue Animations-Effekte für das `animate`-Action:
    - `grow` — Sprite wächst (width + height Tween, beeinflusst Hitbox)
    - `shrink` — Sprite schrumpft (Gegenteil von grow, bei ≈0 → `visible=false`)
    - `explode` 💥 — Fragment-basiertes Platzen: Sprite wird in N Stücke (konfigurierbar) zerlegt, die in zufällige Richtungen wegfliegen mit Rotation, Skalierung→0 und Fade-out. Unterstützt Direktbilder, Sprite-Sheet-Frames und einfarbige Sprites.
    - `pop` — Kombination: Kurz aufblähen (grow 1.3x) → dann explode. Simuliert Platzen wie bei Luftballon.
    - `fadeIn` — Sanftes Einblenden (visible=true + Opacity 0→1)
    - `fadeOut` — Sanftes Ausblenden (Opacity 1→0 → visible=false)
    - `spin` — Rotation um eigene Achse (konfigurierbare Gradzahl)
    - `wobble` — Wackel-Effekt (Sinus-basierte Hin-und-Her-Rotation mit Dämpfung)
  - Neue dedizierte Action `sprite_animate`: Frame-Animation für TImageList (imageIndex von Frame A → Frame B, einmalig)
  - **Dynamic Inspector (visibleWhen)** (`InspectorRenderer.ts`, `ActionRegistry.ts`): Parameter in Actions unterstützen jetzt bedingte Sichtbarkeit. ActionParams wie `targetScale` oder `fragments` werden nur noch angezeigt, wenn der entsprechende Effekt (z.B. grow oder explode) ausgewählt ist. 

## [3.30.0] - 2026-04-02
### Added
- **TSprite + TImageList Integration** (`src/components/TSprite.ts`, `SpriteRenderer.ts`):
  - Sprites können nun optional ein Teilbild aus einem Sprite-Sheet (`TImageList`) anstelle eines direkten Bildes (`backgroundImage`) anzeigen.
  - Neue Properties: `imageListId` (Verweis auf eine TImageList) und `imageIndex` (0-basierter Index des Teilbildes).
  - Der `SpriteRenderer` erkennt die Verknüpfung und wendet (falls die Liste existiert) die passende `background-position` auf ein inneres DIV-Layer an. Bei Nicht-Auffinden auf der Stage wird die `ProjectRegistry` konsultiert (Fallback für ungesyncte globale ImageLists).
  - Rückwärtskompatibilität bleibt bestehen: Ohne ImageList rendert TSprite weiterhin als performantes `<img />`-Tag mit Hardware-Beschleunigung.

### Fixed
- **Sprite-Sheet-Rendering im Editor** (`SpriteRenderer.ts`, `InspectorRenderer.ts`):
  - Bug behoben: Das Ändern von `imageListId` und `imageIndex` im Inspector löste keine visuelle Aktualisierung der Stage aus.
  - Ursache: Die `imageLists`-Dropdown-Source generierte kein Leer-Option; ohne diese konnte kein initialer Wechsel von „leer" zu einer konkreten TImageList erfolgen.
  - Fix: Leere „— Keine —"-Option als Standardwert im `imageLists`-Dropdown hinzugefügt.
  - Rückwärtskompatibilität bleibt bestehen: Ohne ImageList rendert TSprite weiterhin als performantes `<img />`-Tag mit Hardware-Beschleunigung.
- **TImageList — Sprite-Sheet-Komponente** (`src/components/TImageList.ts` [NEU]):
  - Erbt von `TImage`. Zeigt ein einzelnes Teilbild aus einem Sprite-Sheet (Rasterbild) an.
  - Properties: `imageCountHorizontal`, `imageCountVertical`, `currentImageNumber` (0-basiert).
  - Berechnete Read-Only Properties: `maxImageCount` (H × V), `frameWidthPercent`, `frameHeightPercent`, `currentRow`, `currentColumn`, `backgroundPositionX`, `backgroundPositionY`.
  - Inspector-Button „🎞️ Editor öffnen" startet den dedizierten ImageListEditor-Dialog.
  - Event: `onFrameChange`.
- **ImageListEditorDialog** (`src/editor/inspector/ImageListEditorDialog.ts` [NEU]):
  - Modaler Dialog zur visuellen Konfiguration von Sprite-Sheets.
  - Links: Canvas-basierte Sprite-Sheet-Vorschau mit Raster-Overlay (gestrichelte Linien), klickbare Einzelbilder.
  - Rechts: Raster-Konfiguration (H/V), Frame-Navigation (◀ ▶), Einzelbild-Vorschau mit Schachbrett-Transparenz.
  - Quellbild-Auswahl via MediaPickerDialog.
  - Ähnliche Architektur wie `MediaPickerDialog` (statische `show()`-Methode, Promise-basiert).
- **Integration**:
  - `ComponentRegistry.ts`: Register + TypeMapping (`ImageList` → `TImageList`).
  - `Serialization.ts`: Hydration-Case für TImageList und TSprite-Properties.
  - `toolbox.json`: Eintrag in Kategorie Media (Icon: 🎞️, Label: Image List).
  - `StageRenderer.ts`: Rendering via CSS `background-size`/`background-position` Sprite-Clipping. Im Editor-Modus mit Frame-Nummer-Badge.
  - `InspectorRenderer.ts`: Die DataSource `imageLists` ermöglicht die Auswahl dynamischer ImageList-Instanzen im Inspector.
  - `InspectorActionHandler.ts`: Action `openImageListEditor` öffnet den Dialog und wendet Ergebnisse über ProjectStore an.

### Fixed
- **Default-Größen: Pixel statt Grid-Zellen bei 10 Komponenten** — Beim Erstellen via Toolbox waren folgende Komponenten massiv zu groß, da die Konstruktoren Pixelwerte statt Grid-Zellen-Werte verwendeten:
  - `TImage` 100×100 → **8×6**, `TImageList` 100×100 → **8×6**, `TShape` 100×100 → **4×4**
  - `TLabel` 100×20 → **8×2**, `TNumberLabel` 100×20 → **8×2**
  - `TGameState` 100×40 → **4×2** (Service-Komponente)
  - `TDialogRoot` 400×300 → **20×15** (Position 100,100 → **5,5**)
  - `TInfoWindow` 320×180 → **16×9**
  - `TStatusBar` 800×28 → **40×2**, `TToast` 320×60 → **16×3**
- **Drag & Drop Positionierungs-Bug (Snap-Back)** — Ein Regression-Bug, der dafür sorgte, dass gezogene Objekte auf der Stage wieder an ihre alte Position zurücksprangen oder der Inspector nicht synchron aktualisiert wurde, ist behoben.
  - Ursache: Die strikte Regel, im `store-dispatch` Flow kein `refreshAllViews()` aufzurufen, verhinderte das Springen der DOM-Elemente, koppelte den Inspector jedoch von Live-Updates ab.
  - Fix: `Editor.ts` ruft nun bei Store-Dispatches für das *gerade selektierte* Element gezielt `inspector.update()` auf. Der Drag ist nun performant, ohne DOM-Recreation-Blinken, und der Inspector fliegt live mit.
- **Serialization Proxy Bug** — Ein TypeError beim Laden ("Cannot set property maxImageCount... which has only a getter") wurde gefixt, indem Getter-Only-Properties (wie das neue `maxImageCount` bei `TImageList`) in `Serialization.ts` konsistent der `reservedKeys`-Liste hinzugefügt wurden.
- **Inspector `boxShadow`** — `boxShadow` wurde als editierbare Eigenschaft im Inspector für alle Komponenten unter der Gruppe "GLOW-EFFEKT" nutzbar gemacht, sodass nun individuelle visuelle Styles direkt in der UI angepasst werden können.
- **Transparente Bilder (PNG) Hintergrund-Fix** — `TImage` und `TImageList` haben nun standardmäßig `backgroundColor = 'transparent'`. Der störende schwarze Hintergrund beim Rendern von transparenten PNGs in der Game Engine wurde dadurch behoben. Der globale `box-shadow` für `.game-object` in `style.css`, welcher unerwünschte Rahmen um eigentlich transparente Bilder erzeugte, wurde entfernt.
- **Export-Rendering Bug (DeepClean Zerstörung)** — Beim Standalone-HTML-Export (`bundle:runtime`) wurden fälschlicherweise alle Instanz-Variablen mit Präfix `_` (wie `_backgroundImage` und viele Vue/Reactive Interna wie `__v_isRef`) in `GameExporter.ts` bereinigt. Dadurch waren alle exportierten Objekte unsichtbar oder besaßen keine Styles mehr. Die pauschale Bereinigung wurde durch eine auf Editor-Keys beschränkte Whitelist abgelöst.
- **Button Hover/Klick-Animation Bug (Transform-Zerstörung)** — Ein Fehler bei der Darstellung geklickter Buttons im Game/Runtime-Mode wurde behoben. Die bisherige Zuweisung `el.style.scale = '0.98'` manipulierte das übergeordnete `translate3d`-Koordinatensystem und führte zu Positionssprüngen des Buttons zur Mitte (origin) der Stage. Der Renderer hängt die Skalierung nun sauber an die bestehende GPU-Transformation an (`transform += ' scale(0.98)'`), sodass der Button nur noch in sich schrumpft und stabil an seiner Koordinate verankert bleibt.

## [3.29.6] - 2026-03-31
### Refactoring & CleanCode
- **FlowEditor God-Class weiter entschlackt:** Die Datei `FlowEditor.ts` (1273 Zeilen) wurde modularisiert und hält nun das <1000 Zeilen Limit streng ein (~900 Zeilen). DOM-Generierung für die Toolbar sowie komplexe Dropdown-Logiken (`updateFlowSelector`) wurden in `FlowToolbarManager` verschoben. Das Live-Code Overlay (Pascal) wird nun über den `FlowPascalManager` aufgebaut und gerendert.

### Refactoring & CleanCode
- **JSONDialogRenderer God-Class aufgelöst:** Die Datei `JSONDialogRenderer.ts` (1302 Zeilen) wurde vollständig modularisiert und das Interface `IDialogContext` eingeführt. Renderer und Code-DOM-Manipulationen wurden in `DialogDOMBuilder`, `DialogActionHandler`, `DialogStateManager`, `DialogExpressionEvaluator` und `DialogDomainHelper` abstrahiert. Dadurch ist die Hauptdatei auf saubere ~230 Zeilen gesunken.
- **StandardActions God-Class aufgelöst:** Die Datei `StandardActions.ts` (1305 Zeilen) wurde modularisiert und als Facade restrukturiert. Aktionen sind jetzt in dedizierten Dateien unter `src/runtime/actions/handlers/` gruppiert (`PropertyActions.ts`, `VariableActions.ts`, `CalculateActions.ts`, `HttpActions.ts` etc.). Die Hauptdatei hat nur noch ~20 Zeilen. Code-Duplikate (z.B. redundantes Registrieren der 'animate'-Aktion) wurden bereinigt.
- **InspectorHost God-Class aufgelöst:** Die Datei `InspectorHost.ts` wurde von massiven 1491 Zeilen auf schlanke 196 Zeilen reduziert (Einhaltung der <1000 Zeilen Guideline).
- **Zuständigkeits-Trennung (Module):** Komplexes Rendering in spezialisierte Klassen ausgelagert (`InspectorHeaderRenderer`, `InspectorPropertiesRenderer`, `InspectorSectionRenderer`, `InspectorLegacyRenderer`, `InspectorEventsRenderer`, `InspectorLogsRenderer`), gebunden über neues `IInspectorContext`-Interface. Das Inspector-System ist nun extrem wartbar und komponentenbasiert.

## [3.29.4] - 2026-03-30
### Fixed
- **Action Umbenennen E2E Fix & Two-Way-Binding Kollisionsprüfung:**
  - Das "Action Name existiert bereits"-Alert erschien fälschlicherweise bei der Eingabe im Inspector. Ursache: `FlowNodeHandler` manipulierte den Namen der Action direkt im Projekt (`Two-Way-Binding`), bevor `EditorCommandManager.renameObject` die globale Validierung (`projectRegistry.getActions()`) ausführte. Die Validierung fand dadurch die grade eben umbenannte "eigene" Action und blockierte. 
  - Fix: Vorzeitiges Überschreiben in `FlowNodeHandler` entfernt. Atomares Refactoring durch `EditorCommandManager`. 
  - E2E Test Locator `.context-menu-item` an aktuelle DOM-Struktur (`.context-menu div`) angepasst.
- **Flow-Condition Persistenz & Action-Typ-Inferenz:**
  - `FlowCondition.ts` nutzt nun direkte Setter in `applyChange()`, anstatt dass `PropertyHelper` die internen Datenstrukturen bypasst. `FlowNodeHandler` delegiert nun korrekt an `object.applyChange()` für Nodes, die `IInspectable` implementieren.
  - Im `TaskConditionEvaluator` greift `resolveVarPath` nun auf `globalVars` zurück, um Komponenten-Referenzen in If-Verzweigungen aufzulösen. Die `GameRuntime` injiziert hierfür alle Komponentenobjekte direkt in die `eventVars`.
  - Fix im `ActionExecutor`: Wenn aus dem Projekt-JSON benutzerdefinierte Actions ohne explizite `type`-Definition aber mit `target` und `changes` geladen werden (Standard-Verhalten des FlowEditors), greift nun eine automatische Typ-Inferenz (`type = 'property'`). Bisher wurden diese Actions ohne Fehler stumm vom Executor übersprungen, was dazu führte, dass visuelle Flows an dieser Stelle abbrachen.

### Added
- **Elementübersicht: Lösch-Funktion für unbenutzte Elemente** (`FlowContextMenuProvider.ts`):
  - Neues dediziertes Kontextmenü (`showOverviewContextMenu`) für Nodes in der Elementübersicht.
  - **Lösch-Option** (🗑️) für unbenutzte Actions, Tasks und Variablen, die in keinem Flow-Diagramm referenziert sind.
  - **Referenz-Info** (📋) zeigt Verwendungsorte aktiver Elemente als Alert-Dialog.
  - **Schutzmechanismus** (🔒) für verwendete Elemente — Löschen wird mit Begründung blockiert.
  - Navigation (➔) zum Task-Flow direkt aus der Übersicht.
  - Löschung erfolgt direkt über `RefactoringManager.deleteAction/deleteTask/deleteVariable` mit anschließendem automatischen Reload der Übersicht (Bypass `this.host.currentFlowContext = ''`).

### Added
- **FlowCondition Inspector (If-Knoten):** Dynamisches Dropdown-Formular für *Links Wert* und *Rechts Wert* implementiert (Auswahl aus existierenden Variablen und Komponenten-Eigenschaften statt reiner Text-Eingabe).

### Fixed
- **MenuBar/UI-Sync:** Das Label der aktuellen Stage ("Aktuelle Stage: ...") in der horizontalen Menüleiste aktualisiert sich nun reaktiv (live), wenn eine Stage umbenannt wird.
- **Rename-Validator Bug (Actions & Tasks)**: Behebung eines Fehlers in `EditorCommandManager.renameObject`, der das Umbenennen mit "Name existiert bereits" blockierte. Die Validierung für `validateTaskName` und Action-Umbenennungen ignoriert nun ordnungsgemäß die jeweils eigene Knoten-ID, damit Two-Way-Bindings die Prüfung nicht zerschießen.

### Improved
- **Inspector UX - Scope-Verschlankung:** Das Property `scope` (global, stage) wurde ersatzlos aus dem Eigenschafts-Editor aller Komponenten und Variablen entfernt. Globale Elemente definieren sich von Natur aus exklusiv durch ihre physikalische Zugehörigkeit zur *Blueprint-Stage*. Globale Elemente werden nun nur noch über den Mechanismus "Verschieben/Kopieren in Blueprint Stage" orchestriert, um die Single Source of Truth aufrechtzuerhalten.
- **Elementübersicht UX & Visualisierung** (`FlowElement.ts`, `InspectorHost.ts`):
  - **Unbenutzte Elemente:** Neben der roten Umrandung wird nun ein deutlicher "⚠️ UNBENUTZT"-Badge an verwaisten Tasks/Actions angezeigt.
  - **Hover Usage-Info:** Das native Browser-Tooltip (`title`) für Verwendungs-Referenzen (das eine Zeitverzögerung hatte) wurde durch einen sofort sichtbaren, benutzerdefinierten HTML-Tooltip (mit Glassmorphism-Design) ersetzt. Fährt der User über eine Aktion oder einen Task, wird sofort ein Fenster eingebunden, das explizit alle referenzierten Tasks, Target-Objekte oder Caller-Events auflistet. Tooltips überlappen jetzt durch Z-Index Elevation garantiert umliegende Knoten.
  - **Inspector Header Dropdown:** Im Inspector-Header blendet sich das Dropdown (Komponenten/Variablen-Auswahl) bei FlowNodes. Projekt, oder globaler Stage-Selektion jetzt konsequent aus. Stattdessen wird nur das simple statische Label gerendert, da Dropdown-Wechsel in FlowNodes oder abstrakten Game Objects sinnfrei ist.

### Fixed
- **Elementübersicht: Ungewollte Stage-Fokussierung** (`EditorCommandManager.ts`):
  - Klickte man in der Elementübersicht auf den leeren Hintergrund (Deselect All), wurde standardmäßig das globale "Active Stage"-System-Objekt in den Inspector geladen, was verwirrend war. Dies wurde unterbunden: Im Kontext `element-overview` führt ein Deselect() nun ordnungsgemäß zu einem leeren Inspector ("Kein Objekt ausgewählt").
- **Elementübersicht: Kontextmenü zeigte falsches Embedded-Menü** (`FlowContextMenuProvider.ts`):
  - Overview-Nodes erben `isLinked: true` durch das Spreizen der Action-Daten (`{ ...action, isOverviewLink: true }`).
  - Der `isOverviewLink`-Check wird nun **vor** dem `isLinked`-Check ausgeführt, damit das korrekte Overview-Menü angezeigt wird.
- **Elementübersicht: UI aktualisierte sich nicht nach Löschvorgängen** (`FlowContextMenuProvider.ts`):
  - Der Aufruf von `switchActionFlow('element-overview')` brach frühzeitig ab (`this.currentFlowContext === context`), wodurch die Übersicht nach dem Löschen nicht re-rendert wurde. Behoben durch explizites Zurücksetzen des `currentFlowContext` auf einen leeren String vor dem Switch.

## [3.29.3] - 2026-03-29
### Improved
- **Event-Aufräumung: Nicht-sichtbare Komponenten** (`TWindow.ts`):
  - `TWindow.getEvents()` filtert jetzt UI-Events (`onClick`, `onFocus`, `onBlur`, `onDragStart`, `onDragEnd`, `onDrop`) automatisch aus, wenn die Komponente `isHiddenInRun = true` ist.
  - Betrifft ~18 Unterklassen: TTimer, TGameLoop, TInputController, TAudio, TVariable (+ alle Variablen-Unterklassen), THeartbeat, THandshake, TStageController, TSpriteTemplate, TStatusBar, TToast, TGameServer, TGameState.
  - Zentrale Lösung: Alle betroffenen Komponenten profitieren automatisch über Vererbung (`...super.getEvents()` liefert jetzt `[]` statt der UI-Events).

### Changed
- **TRepeater → TIntervalTimer** (`TIntervalTimer.ts` [NEU], `TRepeater.ts` [GELÖSCHT]):
  - `TRepeater` wurde durch eine neue, saubere Komponente `TIntervalTimer` ersetzt.
  - Neue Eigenschaften: `duration` (Intervall-Dauer in ms), `count` (Anzahl, 0=∞), `enabled`.
  - Neue Events: `onIntervall` (pro abgelaufenem Intervall), `onTimeout` (alle Intervalle abgelaufen).
  - Abwärtskompatibilität: Alte Projekte mit `className: "TRepeater"` werden automatisch als TIntervalTimer geladen.
  - Migriert in: `Serialization.ts`, `ComponentRegistry.ts`, `StageRenderer.ts`, `JSONDialogRenderer.ts`, `toolbox_horizontal.json`.
  - Toolbox: Kategorie "System", Icon ⏱️, Label "Intervall-Timer".

### Added
- **TGameServer Events** (`TGameServer.ts`):
  - Neue `getEvents()` Methode mit 8 Events: `onConnected`, `onDisconnected`, `onRoomCreated`, `onRoomJoined`, `onPlayerJoined`, `onPlayerLeft`, `onGameStart`, `onError`.
  - Diese Events wurden bereits programmatisch via `triggerEvent()` gefeuert – bisher fehlte nur die Deklaration für den Inspector/Flow-Editor.
- **TGameState Events** (`TGameState.ts`):
  - Neue `getEvents()` Methode mit 4 Events: `onStateChanged`, `onGameOver`, `onLifeLost`, `onScoreChanged`.

## [3.29.2] - 2026-03-28
### Improved
- **Flow-Editor Toolbox aufgeräumt**:
  - Unnötige/redundante Flow-Elemente aus der Toolbox (`FlowToolbox.ts`) entfernt, um die Übersicht für den User zu maximieren: `Variable`, `Store Token`, `Variable Set`, `For Loop`, `While Loop` und `Repeat Until`.
  - Statt dedizierter Nodes sollen Variablen und Tokens über den Action-Configurator (mit Dropdown) modifiziert werden, und Loops können über die Pfeil-Architektur / Task-Routing gelöst werden, was visuell wesentlich übersichtlicher ist.
  - **Dynamischer Filter (Toolbox & Inspector Settings):** `HTTP Request` und `Data Action` tauchen in der Toolbox nun *nur dann* auf, wenn das Projekt einen aktiven `TGameServer` enthält. Wird dieser gelöscht, verschwinden die Actions automatisch wieder aus der Ansicht. Ebenso werden im Action-Type-Dropdown (Inspector) stark Server-bezogene Funktionen wie `HTTP Antwort senden` und `API Request verarbeiten` nur bei Server-Projekten angeboten. Multiplayer-Aktionen (`Raum erstellen/beitreten`) sind an die Existenz eines `TRemoteGameManager` gekoppelt. Redundante oder verwirrende Typen (`Variable setzen (doppelt)`, `Spiel wechseln`, `Login Request`, `Token speichern/löschen`) wurden aus den Dropdowns komplett versteckt.
- **Standalone Export (Runtime-Bundle) & Rendering-Optimierungen aktualisiert** (`player-standalone.ts`):
  - Der `UniversalPlayer` (standalone Engine) überschrieb im 60Hz Fast-Path fälschlicherweise die GPU-Beschleunigung durch direkte DOM-Manipulation (`el.style.left/top`). Der Render-Pfad delegiert nun direkt an den performanten `StageRenderer.updateSpritePositions(sprites)`.
  - `public/runtime-standalone.js` neu kompiliert: Alle Render-Optimierungen aus dem Editor (Jitter-Fix, transparente Bild-Hintergründe statt roter Artefakte, Ghost-Blink Fix bei Full Renders) greifen nun 1:1 im exportierten Spiel.
- **Bugfix: TSpriteTemplate Sichtbarkeit**:
  - `TSpriteTemplate` tauchte im Run-Modus fehlerhaft auf der Bühne auf. Ursache war die Methode `updateSpritePositions(sprites)` im `StageRenderer`, die durch den Performance-Fast-Path das Flag `isHiddenInRun` ignorierte und das CSS `display`-Property hart auf `flex` zurücksetzte. Die Sichtbarkeitsprüfung berücksichtigt jetzt `isHiddenInRun` strikt auch im 60fps-Loop. (Bundle neu erzeugt).
- **Feature: Konfigurierbare Hitboxen für Sprites** (`TSprite.ts`, `StageRenderer.ts`):
  - Sprites verfügen jetzt über eine optionale, frei konfigurierbare Hitbox (`customHitbox`), die von der visuellen Größe abweichen kann.
  - Neue Inspector-Eigenschaften: `hitboxOffsetX`, `hitboxOffsetY`, `hitboxWidth`, `hitboxHeight` sowie `hitboxShape` (`auto`, `rect`, `circle`).
  - Eine kreisförmige Kollisionsabfrage (`circle`) berechnet echte radiale Distanzen (anstatt AABB/Rechtecke). Im Falle von `rect` vs. `circle` wird eine präzise AABB-zu-Kreis-Distanzprüfung durchgeführt.
  - Sämtliche Boundary- (`isWithinBounds`) und Kollisions-Logik (`checkCollision`, `getCollisionOverlap`) basiert nun auf der logischen Hitbox und nicht mehr hart verdrahtet auf `x`/`width`.
  - Im Editor (Bau-Modus) wird eine benutzerdefinierte Hitbox durch einen roten, gestrichelten Rahmen visuell dargestellt, damit der Nutzer die Offsets pixelgenau prüfen kann. Zur Laufzeit ist die Hitbox-Skizze unsichtbar. Aufgenommen in das Standalone-Bundle.
- **Architektur & Feature: Globales Undo/Redo an UI angeschlossen**:
  - Die im Hintergrund bereits mitlaufenden Snapshots (`SnapshotManager`) wurden systemweit ins User-Interface überführt. Dazu wurde eine neue Menü-Kategorie "Bearbeiten" generiert (`menu_bar.json`), die die Buttons "Rückgängig" (`Strg+Z`) und "Wiederholen" (`Strg+Y`) enthält.
  - Der alte, fehleranfällige `EditorUndoManager` sowie der `ChangeRecorder` wurden abgekoppelt; das Betätigen der Buttons oder Hotkeys erzwingt nun ein exaktes Zurückladen (inkl. Neu-Rendern) von vollständigen JSON-Kopien (Project SSoT). Fehlerhafte Ansichten durch desynchronisierte Zustände gehören damit der Vergangenheit an.
- **GPU-Textur-Compositing für Image-Sprites** (`StageRenderer.ts`):
  - Sprite-Bilder werden nicht mehr als CSS `background-image` gerendert (CPU-Rasterung bei translate3d), sondern als natives `<img class="sprite-image-layer">` Tag (eigene GPU-VRAM-Textur, hardwarebeschleunigtes Compositing).
  - `Math.round()` für translate3d-Koordinaten entfernt: Durch die <img>-Tag-Umstellung sind Subpixel-genaue Positionierungen jetzt jitterfrei möglich.
  - Debug-Logging (`[Jitter-Debug]`) aus dem Fast-Path `updateSpritePositions()` entfernt.
  - Skalierbar für 50+ gleichzeitig animierte Sprites ohne Performanceverlust.
### Fixed
- **Top-Left (0,0) Ghost-Blink bei JEDEM Full Render behoben** (`StageRenderer.ts`):
  - Der `FULL RENDER` überschrieb fälschlicherweise das hardwarebeschleunigte `translate3d(x,y,0)` mit einem leeren String, falls das Objekt (Player, Target, Bullets) keine benutzerdefinierte CSS-Transform besaß. Dadurch wachten alle Objekte bei jedem Score-Update für einen Sekundenbruchteil ohne Koordinaten bei (0,0) oben links auf, bevor der 60Hz Fast-Path sie wieder auf ihre korrekten Koordinaten teleportierte.
- **Pool-Sprite Aufblitz-Bug** (`StageRenderer.ts`):
  - Pool-Sprites (Bullets etc.) blitzten beim Spawnen/Despawnen kurz an Position (0,0) auf, weil die `visible`-Property im 60Hz Fast-Path `updateSpritePositions()` nicht synchronisiert wurde. Der Fast-Path prüft jetzt `obj.visible` und setzt `display: none/flex` sofort, ohne auf den nächsten vollen Render-Zyklus zu warten.
- **Ghost-Image-Bug bei TSpriteTemplate** (`StageRenderer.ts`):
  - `isHiddenInRun` wurde in der Haupt-Visibility-Logik von `renderObjects()` nicht geprüft. Dadurch waren Objekte wie TSpriteTemplate (BulletTemplate) mit `visible:true` und `isHiddenInRun:true` im Run-Mode sichtbar – inklusive ihrem Bild. Das Template-Bild erschien als „Geister-Image" beim Schießen/Spawnen.
- **Bildschirm-Blink bei SpritePool.acquire() / Target-Bounces** (`GameRuntime.ts`):
  - `visible`, `_prevVelocityX`, `_prevVelocityY`, `_prevX` und `_prevY` fehlten im SPRITE_PROPS Reactive-Filter. Jeder `SpritePool.acquire()` oder Boundary-Bounce (Kollisionsabpraller beim Target) löste einen **vollständigen** `renderObjects()` Re-Render ALLER Objekte aus. Dadurch blitzten Player, Target und alle Pool-Sprites ständig auf. Fix: Diese Fast-Path-Handled-Properties triggern keinen globalen Stage-Redraw mehr.
- **Top-Left (0,0) Ghost-Blink beim Schießen behoben** (`GameRuntime.ts`):
  - `spawnObject` und `destroyObject` haben explizit `this.options.onRender()` aufgerufen, um das DOM-Element der erzeugten Kugel sichtbar zu machen. Da die Sichtbarkeit (`display: none` zu `flex`) jedoch bereits hochperformant im 60Hz-Fast-Path (`updateSpritePositions`) erledigt wird, war dieser zusätzliche Full-Render redundant und verursachte ein kurzes Aufblitzen aller UI-Elemente und Sprites an der Nullposition (Top-Left) vor dem Hardware-Transform. Der Aufruf wurde restlos entfernt.
- **Anti-Blink bei DOM-Element-Erstellung** (`StageRenderer.ts`):
  - Neue DOM-Elemente starteten mit `display: flex` und wurden sofort an den DOM angehängt, bevor Position/Transform gesetzt wurde → kurzes Aufblitzen bei (0,0). Fix: Neue Elemente starten jetzt mit `display: none` und werden erst nach vollständiger Konfiguration sichtbar.

## [3.29.1] - 2026-03-27
### Added
- **Import-Tab** in der Toolbox-Sidebar (`EditorViewManager.ts`):
  - Textarea zum Einfügen von Projekt-JSON (Ctrl+V)
  - Live-Validierung: JSON-Syntax + GCS-Projektstruktur (Name, Stages, Komponenten, Tasks)
  - "📥 Laden" Button (mit Bestätigungsdialog)
  - "📋 Aktuelles Projekt kopieren" Button (JSON → Zwischenablage)
- **Media-Picker Dialoge** (`MediaPickerDialog.ts`):
  - **Image-Picker:** Thumbnail-Grid (4 Spalten) mit Ordner-Navigation und Breadcrumb. Ersetzt `prompt()`.
  - **Audio-Picker:** Dateiliste mit ▶️ Play / ⏹ Stop Buttons und Inline-Playback.
  - **Video-Picker:** Dateiliste mit ▶️ Vorschau und Inline-Video-Player.
  - Neues Manifest-Script: `scripts/generate-media-manifest.ts` scannt `public/images/`, `audio/`, `videos/`.
- **Neue Property-Types** (`InspectorTypes.ts`): `audio_picker`, `video_picker` im Union-Type.
### Improved
- **GPU-Hardwarebeschleunigung (Anti-Jitter) in StageRenderer** (`StageRenderer.ts`):
  - Um das Ruckeln (Choppiness) bewegter Image-Sprites im Run-Mode zu verhindern, wurde das klassische Layout (`left`, `top`) komplett auf Hardware-`translate3d` umgestellt.
  - Das Grid-Resizing-System (cellSize) bleibt dabei vollständig intakt, jedoch läuft die Subpixel-Positionierung der Bilder nun auf der dedizierten Grafikkarte butterweich bei 60 FPS.
  - Fix **Subpixel Tearing** *(Zwischenlösung, ersetzt in v3.29.2)*: Float-Koordinaten bei Bitmaps wurden via `Math.round()` als Integer auf die GPU gesendet. Ersetzt durch natives `<img>`-Tag GPU-Compositing in v3.29.2.
  - Fix **Doppel-Loops & Fallback-Ticker**: Der `AnimationTicker` Fallback im EditorRunMode wurde entfernt, die GameRuntime initialisiert und startet den GameLoopManager nun EXKLUSIV, was extreme Physics-Microstutter eliminiert.
  - Fix **DeltaTime-Smoothing**: In `GameLoopManager.ts` wird das errechnete `deltaTime` nun für 60FPS Frameraten auf exakte `0.016666s` geclampt, um Physik-Ruckler durch Browser-Timer Instabilitäten aus der Berechnung fernzuhalten.
- **Inspector-Bereinigung für unsichtbare Komponenten** (`TComponent.ts`):
  - Service-Komponenten und Variablen (`isHiddenInRun = true`) zeigen im Inspector keine rein visuellen Property-Gruppen mehr an (STIL, GLOW-EFFEKT, TYPOGRAFIE, INTERAKTION, GEOMETRIE). Nur noch funktional relevante Gruppen (IDENTITÄT, komponentenspezifische) werden angezeigt.
  - Betrifft 22 Komponenten automatisch über Vererbung.
- **Vergrößerte Darstellung unsichtbarer Komponenten**:
  - Standardgröße von 3×1 auf 4×2 Grid-Einheiten erhöht für bessere Lesbarkeit der Komponentennamen auf der Stage.
  - Betrifft: TTimer, TRepeater, TInputController, TGameServer, TGameLoop, TAudio, TTriggerVariable, TThresholdVariable, TRangeVariable, TRandomVariable, THeartbeat, THandshake, TListVariable, TBadge.

## [3.29.0] - 2026-03-26
### Added
- **Object Pool Pattern für dynamische Sprites** (`TSpriteTemplate.ts`, `SpritePool.ts`):
  - Neue Komponente `TSpriteTemplate` (Blueprint) mit Pool-Konfiguration (`poolSize`, `autoRecycle`, `lifetime`).
  - Neue Actions `spawn_object` und `destroy_object` zur Interaktion mit dem Pool zur Laufzeit.
  - Leistungsfähiges Instanz-Management: Alle Pool-Objekte werden beim Start vorhydriert und erhalten permanente DOM-Elemente. Dies löst das bisherige Problem "Rendering-Disconnect", bei dem Klone nicht sichtbar wurden.
  - Unsichtbare Sprites (`visible: false`) im Leerlauf werden nun von den Physik-Checks (`updateSprites`, `checkCollisions`, `checkBoundaries`) des `GameLoopManager` ignoriert, was die CPU schont.
- **Normalisierte Target-Auflösung** (`StandardActions.ts`):
  - Target-Strings wie `%Self%`, `%self%` oder `%Other%` werden vor der Auflösung normalisiert.
  - Verbesserte Unterstützung in Actions (`spawn_object`, `destroy_object`, `negate`, etc.).
- **Intuitive Mathematische Formeln** (`ExpressionParser.ts`):
  - `type: 'calculate'` Actions und Expressions erlauben nun die direkte Eingabe nativer Template-Strings wie `${score} + 1` oder `${health} - 10`.
  - Die `evaluate()`-Methode wurde um einen Pre-Processor erweitert, der störende `${ }` und `%` Tags automatisch herausfiltert.
  - **Bugfix NaN/Suspicious Result:** Unbekannte Variablen (z. B. uninitialisiert vor Spielstart) werden konsequent als echter `ReferenceError` gefangen und zu `undefined` konvertiert, anstatt fälschlicherweise als gebundene `undefined`-Parameter für die JavaScript Engine bereitgestellt zu werden. Dies verhindert das kollabieren zu `NaN`.
  - Dadurch entfallen Type-Cast-Hacks wie `Number(score || 0) + 1` im Inspector. Die Syntax für den Benutzer wird drastisch lesbarer.
- **Bugfixes für Variablen-Verlust zur Laufzeit** (`AgentController.ts`, `RuntimeVariableManager.ts`):
  - **Bugfix AgentController & Serialization:** Globale Variablen, die per Skript `addVariable` oder UI angelegt werden, erhalten nun strikt einen `className` (z. B. `TIntegerVariable`) zugewiesen. Ohne diesen wurden Variablen in `hydrateObjects()` beim Laden aus der Runtime stillschweigend verworfen, was zu `ReferenceErrors` beim Zugriff führte.
  - **Bugfix Proxy Enumeration:** Ein doppelter und teilweise fehlgeschlagener `ownKeys` Proxy-Trap im `RuntimeVariableManager` wurde korrigiert. Der Spread-Operator bei der Bildung von `evalContext` kann nun wieder korrekt über die Variablen aus den Stages iterieren.
  - **Bugfix Inspector Rendering (Calculate Actions):** Fehlen von Formeln im FlowEditor-Inspector behoben. `FlowAction.ts` stellt nun native Getter/Setter für `formula` und das veraltete Attribut `expression` bereit, womit der Formulareditor diese Properties wieder korrekt befüllt und beim Ändern migriert.
  - **Bugfix Run2 Event Loss / Session Cleanup (CRITICAL):** Bei aufeinanderfolgenden Läufen (Run → Stop → Run) registrierte der `TInputController` keine Keyboard-Events mehr. **Root Cause:** `hydrateObjects()` gibt `instanceof TWindow`-Objekte unverändert zurück, so dass dieselbe TInputController-Instanz über Runs hinweg wiederverwendet wurde. Durch den Self-Heal-Mechanismus in `onKeyDown()` wurde `isActive` fälschlich auf `true` gesetzt, obwohl die Window-Listener bereits entfernt waren — der Guard in `start()` verhinderte dann die Neuregistrierung. **Fix:** 1) `GameRuntime.initInputControllers()` führt jetzt vor `init()/start()` ein `stop()` + `isActive=false` Force-Reset durch. 2) Self-Heal setzt `isActive` nicht mehr auf `true`.
  - **UX Bugfix Space-Key:** Die Leertaste (`Space`) sowie `Enter` wurden im `TInputController` in die Liste der `preventDefault()` Tasten aufgenommen. Dadurch löst die Leertaste im Spielmodus nicht länger ungewollt Scroll-Bewegungen oder das Klicken auf IDE-Buttons aus.

## [3.28.0] - 2026-03-25
### Added
- **Inspector Visual Mockup Generator**: Ein neues Skript (`/tmp/gen_inspector_mockups_all.js`) erzeugt exakte visuelle Nachbildungen der Inspector-Ansichten (Glow, Stil, Identität, Raster, Geometrie, Typografie, Übersicht) als spielbare GCS-Stages. Diese können interaktiv zur Dokumentation im System genutzt werden.
- **TColorPicker Native Inspector-Farbwahl**: Die Laufzeit-Komponente `TColorPicker` bettet jetzt nativ das OS-Farbauswahl-UI (HTML5 `input type='color'`) via `StageRenderer` (`opacity: 0`) ein. So können im Run-Modus System-Farbdialoge aufgerufen werden, und ihr Wert wird dem `onChange` Event der Komponente weitergeleitet.
- **TDropdown Select Integration**: Ähnlich wie beim ColorPicker bettet die `TDropdown` Komponente nun ein funktionell nutzbares `<select>` Dropdown im Run-Modus des `StageRenderers` ein. Die `options` Property (kommagetrennter String) wird automatisch in native Html-Optionen gemappt, und bei Auswahl wird das `onChange` Event geworfen.
- **Stage Keyboard Nudging**: Markierte Komponenten lassen sich im GUI-Editor nun intuitiv mit den Pfeiltasten (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`) verschieben. Die Schrittweite beträgt standardmäßig 1 Einheit (für Feinjustierung) und mit gehaltener `SHIFT`-Taste 5 Einheiten (für schnellere Positionierung). Eingaben in Textfelder unterbrechen den Nudge-Modus automatisch.

## [3.27.0] - 2026-03-24
### Added
- **TProgressBar** (`TProgressBar.ts`): Neuer Fortschrittsbalken-Baustein mit `value`, `maxValue`, `barColor`, `barBackgroundColor`, `showText`, `textTemplate`, `animateChanges`. Events: `onComplete`, `onEmpty`. Registriert in ComponentRegistry, Serialization und Toolbox (Kategorie: Game).
- **TGameState: Spielstand-Properties** (`TGameState.ts`): `score`, `level`, `lives`, `maxLives` + Inspector-Gruppe "Spielstand". State-Option `"won"` hinzugefügt.
- **TThresholdVariable: Vergleichs-Operator** (`TThresholdVariable.ts`): Neues Property `comparison` (>=, <=, ==, >, <, !=) + Methode `isThresholdReached()`.
- **Inspector Textarea-Support** (`InspectorHost.ts`, `InspectorRenderer.ts`): native, mehrzeilige Textfelder (`type: 'textarea'`) werden im Inspector unterstützt, inkl. "Übernehmen" Button für direkte Speicher-Anwendung.
- **TLabel Mehrzeilen-Unterstützung** (`TTextControl.ts`): Die Eigenschaft `text` nutzt nun den neuen Textarea-Typ, um lange Fließtexte in Dokumentations-Stages leichter pflegen zu können.
- **Stage Duplikation & Reordering** (`EditorStageManager.ts`, `MenuBar.ts`): Eine komplette Stage kann per Knopfdruck inkl. Tasks und Actions tiefen-geklont werden (neue IDs, alte Namen), ohne das Projekt zu korrumpieren. Zusätzlich wurden Buttons zum Ändern der Stage-Reihenfolge (Hoch/Runter) ins UI integriert.
- **System-Clipboard für Multi-Component Copy** (`EditorInteractionManager.ts`, `StageInteractionManager.ts`): Beim Markieren mehrerer Objekte und STRG+C wandern diese in ein globales Objekt, das Stage-übergreifend gültig ist. Beim STRG+V werden die Namen in der Ziel-Stage geprüft: wenn frei, bleibt der Originalname, sonst wird mit `_1` etc. hochgezählt.

### Changed
- **TRepeater → Intervall-Timer** (`toolbox.json`): Toolbox-Label von "Repeater" auf "Intervall-Timer" umbenannt. Klassenname TRepeater bleibt zur Kompatibilität.

### Fixed
- **SanitizationService: Task-Verlust durch Scope-Bleeding** (`SanitizationService.ts` -> `sanitizeProject()[L109-120]`): Behoben, dass valide, Stage-lokale Tasks (z. B. "NavNext") in Multi-Stage-Projekten nach dem Speichern vom Editor gelöscht wurden. Die Duplikat-Erkennung nutzte ein globales `seenTasks`-Set über alle Stages hinweg, was legitime gleichnamige Tasks in nachfolgenden Stages fälschlicherweise als Duplikate flaggte und eliminierte. Das Set ist nun strikt an den Iterationszyklus einer einzelnen Stage gekapselt.
- **Inspector: Doppelte Typografie-Felder** (`TTextControl.ts`, `TWindow.ts`): TYPOGRAFIE-Gruppe wurde doppelt angezeigt da `TTextControl.getInspectorProperties()` dieselben Felder wie `TWindow` hinzufügte. Doppelte Einträge aus TTextControl entfernt. `TWindow.fontFamily` von Freitext auf Select-Dropdown geändert.
- **TPanel Rendering-Bug** (`TPanel.ts`): Die harte Verknüpfung von `get caption()` an `this.name` wurde entfernt. Panels rendern nun nicht mehr fälschlicherweise ihren Engine-Namen in GUI-Szenen und können vollständig text-los (transparent) bleiben.
- **Inspector Textarea-Layout** (`InspectorHost.ts`): Das seitliche Label ("Inhalt") für Textareas wurde im Inspektor ausgeblendet, wodurch mehrzeilige Textfelder nun die vollen 100% Breite nutzen können.

## [3.26.4] - 2026-03-24
### Changed
- **Pascal-Panel: Task-gefilterter Code** (`FlowEditor.ts`, `PascalCodeGenerator.ts`):
  - Das Pascal-Panel zeigt jetzt nur den Code des aktuell geöffneten Tasks (statt das gesamte Programm).
  - VAR-Sektion zeigt nur die im Task verwendeten Variablen, Komponenten und Task-Parameter.
  - Neue Methode `collectVariableNames()` sammelt rekursiv Variablen-Referenzen aus Conditions, Calculations, set_variable, increment und `${}`-Referenzen.
  - Bei globaler Ansicht / Übersicht wird weiterhin das vollständige Programm angezeigt.


### Fixed
- **Inspector: Objekt-Dropdown für registry-basierte Actions** (`FlowAction.ts`):
  - Actions wie `play_audio` und `stop_audio`, die einen `type: 'object'`-Parameter mit `source: 'objects'` verwenden, zeigten im Inspector kein Dropdown zur Auswahl der Zielkomponente (z.B. TAudio).
  - Ursache: `mapParameterTypeToInspector()` mappte `'object'` auf `'TObjectSelect'`, einen nicht existierenden Inspector-Typ. Dadurch wurde der Parameter als Freitext-Feld statt als Select-Dropdown gerendert.
  - Fix: Mapping von `'object'` auf `'select'` geändert. Die `source: 'objects'`-Property wird nun korrekt an `getOptionsFromSource()` weitergereicht, das alle Objekte der aktuellen Stage + Blueprint-Services auflistet.
- **TAudio: Kein Sound bei play_audio / stop_audio** (`Serialization.ts`):
  - `TAudio` fehlte im `case`-Block von `hydrateObjects()`. Dadurch wurde die Komponente beim Laden nicht als Klasseninstanz instanziiert, sondern blieb ein flaches JSON-Objekt ohne `play()` und `stop()` Methoden.
  - Der `play_audio`-Handler prüft `typeof targetObj.play === 'function'`, was `false` ergab → kein Sound.
  - Fix: `import { TAudio }` und `case 'TAudio'` im switch-Block hinzugefügt. TAudio-Properties (`src`, `volume`, `loop`, `preload`) werden automatisch durch die Generic Property Restoration wiederhergestellt.
- **Audio-Assets: Fester Ordner `public/audio/`** (Projekt-JSON):
  - Audio-Dateien nach `public/audio/` verschoben (Vite liefert diese automatisch als statische Assets aus).
  - `Audio_25.src` von absolutem Windows-Pfad (`C:\Users\...`) auf relativen Web-Pfad (`/audio/ball_lost.wav`) korrigiert.
  - Unterverzeichnisse möglich (z.B. `public/audio/Knalleffekte/`, `public/audio/Sirenen/`).


### Added (UX: Inspector & Sichtbarkeit)
- **Inspector Dropdown für Objekt-Auswahl** (`InspectorHost.ts`):
  - Der Inspector-Header enthält nun ein Dropdown, das alle Komponenten (Objekte & Variablen) der aktuellen Stage sowie globale (Blueprint) Komponenten auflistet.
  - Ermöglicht das schnelle Finden und Markieren von Komponenten, insbesondere von unsichtbaren.
- **Sichtbarkeits-Indikator im Editor** (`StageRenderer.ts`):
  - Komponenten, deren `visible`-Eigenschaft auf `false` gesetzt ist, verschwinden im Design-Modus nicht mehr komplett von der Stage.
  - Sie werden stattdessen halb-transparent (`opacity: 0.4`) und mit einem roten, gestrichelten Rahmen dargestellt.
  - Im Run-Modus verhalten sie sich weiterhin korrekt und sind unsichtbar.
### Added
- **TAudio Komponente (Zero-Latency Audio)**:
  - Komplett latenzfreie, auf der Web Audio API (`AudioContext`) basierende Audio-Lösung für GCS-Spiele.
  - Der `AudioManager` in der Engine lädt Audio-Dateien beim Start in den RAM (`AudioBuffer`), um sofortige Starts (Polyphonie) zu ermöglichen.
  - Zwei neue Flow-Actions (`play_audio`, `stop_audio`) zur exakten Steuerung der Wiedergabe.
  - **Standalone Audio Export**: Der `GameExporter` konvertiert nun `TAudio.src` Pfade automatisch nativ in Base64 Data URLs, damit exportierte Spiele offline lauffähig bleiben.
- **Neue Action: Komponenten animieren (`StandardActions.ts`)**:
  - Neue Action `animate` hinzugefügt, mit der Komponenten (z. B. TButton, TLabel) dynamisch animiert werden können.
  - Unterstützte Effekte: `shake`, `pulse`, `bounce`, `fade`.
  - **Multi-Targeting:** Die Action akzeptiert als "Target" eine kommaseparierte Liste (z.B. `Zahl1, Zahl2, Ergebnis`), um mehrere Komponenten exakt synchron wackeln oder hüpfen zu lassen.
- **Erweitertes Animations-Core (`AnimationManager.ts`)**:
  - `addTween` unterstützt nun einen `onUpdate`-Callback für komplexe CSS-Transform-Animationen (scale, translateY).
### Added (UX: Debug Logging)
- **Copy-Button im Debug-Log-Viewer** (`TDebugLog.ts`):
  - Ein neuer Button "Copy" ermöglicht das Kopieren der aktuell angezeigten Logs in die Zwischenablage.
### Fixed (Runtime & Action-Logik)
- **Animation Bugfix (`require is not defined`)** (`AnimationManager.ts`):
  - In der Methode `addTween` kam es durch ein hart codiertes `require('./GameLoopManager')` in Browser-Umgebungen (wie Vite) zum Absturz, was alle Stage-Animationen blockierte.
  - Fix: Der Aufruf wurde durch ein asynchrones, natives ESM-`import()` ersetzt. Zirkuläre Abhängigkeiten werden weiterhin lazy aufgelöst, aber nativ und crashfrei. Die Stage-Animationen laufen wieder.
- **ExpressionParser `evaluate` Bug Fix** (`ExpressionParser.ts`):
  - Literale Zahlen wie `"0"`, `"60"` oder `"1"` wurden fälschlicherweise als nested Properties ausgewertet (weil sie die Regex `^[\w.]+$` matchten) und lieferten `undefined` statt ihres Wertes zurück.
  - Fix: Direkte Erkennung und Rückgabe von Zahlen sowie Booleans/Null/Undefined vor dem Regex-Match.
  - Verhindert NaN-Kollabieren von Timern und fehlerhafte Objekt-Stringifizierungen in der UI (`{"className":"TIntegerVariable"...}`).
- **`variable` Action: TVariable Update** (`StandardActions.ts`):
  - Action vom Typ `variable` hat den Wert zwar ins `context.vars` geschrieben, aber das zugrundeliegende `TVariable` Objekt (anders als bei `calculate`) nicht explizit aktualisiert.
  - Fix: Explizites Suchen und Setzen der `.value` Property des zugehörigen `TVariable` Objekts eingebaut, damit der `PropertyWatcher` zuverlässig UI-Updates feuert.

## [3.26.1] - 2026-03-22
### Fixed
- **Drag-and-Drop Regression behoben** (`Editor.ts`):
  - Objekte sprangen nach Verschieben auf Stage an alte Position zurück
  - Root Cause: `ProjectStore.dispatch` → Mediator-Bridge `'store-dispatch'` → `refreshAllViews()` → voller `flowEditor.setProject()` Rebuild
  - Fix: `'store-dispatch'`-Originator im `initMediator`-Listener gefiltert — nur `render()`, kein `setProject()`

## [3.26.0] - 2026-03-22
### Added (Demo 3: Mathe-Quiz)
- **Mathe-Quiz Builder** (`demos/builders/mathe-quiz.builder.ts`):
  - Additions-Quiz für Klasse 1 mit TRandomVariable, Conditions, Timer, Score
  - 5 Tasks, 26 Actions, 12 Objekte, Bindings, Event-Verkettung
  - Verzweigungen (addBranch) für Richtig/Falsch-Prüfung
  - TaskCalls (addTaskCall) für Task-Verkettung
- **ProjectBuilder erweitert** (`scripts/agent-run.ts`):
  - 8 neue Methoden: addVariable, bindVariable, setProperty, addBranch, addTaskCall, createSprite, createLabel
  - CLI-Guard für sauberen Import (kein process.exit bei Import als Modul)
- **Tests** (`tests/mathe_quiz.test.ts`): 10 Tests (Struktur, Objekte, Tasks, Branch, Bindings, Events, TaskCalls, Flows, Validierung)

## [3.25.0] - 2026-03-22
### Added (API-Realisierung Phase 2)
- **Sprite-Shortcuts** (`AgentController.ts`):
  - `createSprite()` — TSprite mit Physik-Defaults (velocity, collision, shape)
  - `createLabel()` — TLabel mit Binding + Style-Shortcuts
  - `setSpriteCollision()` — Kollisions-Konfiguration
  - `setSpriteVelocity()` — Geschwindigkeit setzen
- **Schema-API** (`AgentController.ts`):
  - `getComponentSchema(className)` — Properties, Methods, Events aus ComponentSchema.json
  - `setComponentSchema(schema)` — Schema laden (ESM-kompatibel)
- **Tests** (`agent_controller.test.ts`): 7 neue Tests (Phase 2 Sprite-Shortcuts + Schema)
- **Doku** (`AgentAPI.md`): Sprite-Shortcuts und Schema-API Sektionen hinzugefügt

### Fixed
- **Flow-Editor** (`FlowAction.ts`): navigate_stage zeigt jetzt Stage-Name statt roher ID

## [3.24.0] - 2026-03-22
### Added (Stage-Import)
- **`EditorStageManager.importStageFromProject()`** (`EditorStageManager.ts`):
  - Importiert eine Stage aus einem externen Projekt inkl. aller Abhängigkeiten
  - Deep-Clone mit automatischer ID-Generierung (keine Kollisionen)
  - Blueprint-Merge: Referenzierte Actions, Tasks und Variablen aus dem Quell-Blueprint werden in den Ziel-Blueprint kopiert
  - Transitive Dependency-Resolution: Blueprint-Action-Targets werden rekursiv aufgelöst
  - Duplikat-Schutz: Bereits vorhandene Blueprint-Elemente werden nicht dupliziert
- **`Editor.importStageFromFile()`** (`Editor.ts`):
  - File-Picker für JSON-Projekte
  - Stage-Auswahl-Dialog (Dark-Theme, Checkboxen mit Statistiken)
  - Einzel- und Multi-Stage-Import unterstützt
- **Menü-Eintrag** (`EditorMenuManager.ts`): "📥 Stage importieren" im Stages-Menü
- **Tests** (`stage_import.test.ts`): 7 Tests (Basis, ID-Remap, Blueprint-Merge, Duplikat, Type-Konvertierung, Events)
### Added (API-Realisierung Phase 1 + 1.5)
- **Schema-Registry** (`docs/ComponentSchema.json`) [NEU]:
  - 13 Komponenten-Schemata (TSprite, TButton, TLabel, TTimer, TGameLoop, TGameState, TInputController, TIntegerVariable, TBooleanVariable, TStringVariable, TRandomVariable, TEdit)
  - 14 Action-Typen mit Pflichtparametern und Beispielen
  - 15 Variable-Typen katalogisiert
  - 7-Schritte-Semantik (Ziel → Objekte → Variablen → Actions → Tasks → Events → Test)
  - Lessons-Learned-Regeln (DO/DON'T)
- **API-Referenz** (`docs/AgentAPI.md`) [NEU]:
  - Vollständige Methoden-Referenz mit Signaturen, Parametern und Beispielen
  - Inventar-Tabellen (listStages, listTasks, listActions, etc.)
  - DO/DON'T-Regeln aus echten Fehlern der Raketen-Countdown-Entwicklung
- **CLI-Runner** (`scripts/agent-run.ts`) [NEU]:
  - Headless ProjectBuilder (keine Browser-Abhängigkeiten)
  - API-kompatible Schnittstelle: createStage, addObject, createTask, addAction, connectEvent
  - Flow-Layout-Generierung, Validierung, JSON-Export
  - Aufruf: `npx tsx scripts/agent-run.ts <builder> [output.json]`
- **Builder-PoC** (`demos/builders/raketen-countdown.builder.ts`) [NEU]:
  - Raketen Countdown komplett über ProjectBuilder-API erstellt
  - Folgt der 7-Schritte-Semantik
  - Erzeugt: 2 Stages, 3 Tasks, 6 Actions, 3 FlowCharts
- **ToDoList erweitert** (`ToDoList/api_realisierung.md`):
  - Phase 1.5 (CLI-Runner) integriert
  - Demo-Roadmap: Mathe-Quiz als Runde 3
  - 9 Lessons Learned dokumentiert

### Chore
- `loaded_project.json` aus Git entfernt + `.gitignore` aktualisiert (Laufzeit-Kopie)

### Improved (Rendering)
- **Schriftgrößen-Skalierung relativ zur CellSize** (`StageRenderer.ts`):
  - Neue `scaleFontSize()` Methode: `fontSize × (cellSize / 20)`
  - Bei CellSize 20 (Referenz): keine Änderung
  - Bei CellSize 10: halbe Schriftgröße, bei CellSize 30: 1.5×
  - Betrifft alle 7 Rendering-Stellen: allgemein, Checkbox, NumberInput, TextInput, Button, Label, Panel
  - Gespeicherte Werte im JSON bleiben unverändert (immer Referenzwerte)

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
  - Nur relevant im Modus `event-only` (bei clamp/bounce verlässt kein Sprite die Stage)
  - Pro Sprite nur einmal gefeuert (exitedSprites-Tracking)
- **`GameLoopManager.checkStageExits()`** (`GameLoopManager.ts`):
  - Prüft jeden Frame ob Sprites vollständig außerhalb der Stage-Grenzen sind
  - exitedSprites-Set wird bei Stop/Reset geleert

### Added (CleanCode Phase 4: E2E-Test-Netz)
- `10_PlayModeLifecycle.spec.ts` [NEU]: Run-Start/Stop/Restart E2E-Test.
- `11_StageSwitching.spec.ts` [NEU]: Stage-Menü, Blueprint-Wechsel, Hin-und-Zurück.
- 13 E2E-Tests insgesamt (vorher 11).

### Fixed
- `DEVELOPER_GUIDELINES.md`: 5 Widersprüche nach CleanCode-Transformation bereinigt (CleanCode-Status, Server-Sync, Speichermanagement, Versionsnummer, Adapter-Hinweise).

## [3.22.0] - 2026-03-20
### Added (CleanCode Phase 3: Hexagonale Architektur)
- **Slice 3.1 – Port-Interfaces** (`src/ports/IStorageAdapter.ts` [NEU]):
  - `IStorageAdapter`: `save()`, `load()`, `list()`, `isAvailable()`.
  - `IExportAdapter`: `export()` mit `formatName` und `fileExtension`.
- **Slice 3.2 – Storage-Adapter** (3 neue Dateien):
  - `ServerStorageAdapter`: Express Dev-API (`/api/dev/save-project`).
  - `LocalStorageAdapter`: Browser-Fallback (nicht primär für Electron).
  - `NativeFileAdapter`: FileSystem Access API (Browser) + Electron IPC-Bridge (`window.electronFS`).
- **Slice 3.3 – ProjectPersistenceService refactored:**
  - Adapter-Initialisierung mit automatischer Erkennung (Electron > FS API > Server > LocalStorage).
  - `saveProject()`, `autoSaveToLocalStorage()`, `fetchProjectFromServer()`, `triggerLoad()` delegieren an Adapter.
  - Neue Methode `saveToServer()` für expliziten Server-Sync.
- **Slice 3.4 – Export Electron-kompatibel:**
  - `GameExporter.downloadFile()` 3-stufiger Fallback: Electron IPC → FileSystem Access → Blob.
- Letzter `safeReplacer()`-Aufruf in `autoSaveToLocalStorage()` eliminiert.

## [3.21.0] - 2026-03-20
### Changed (CleanCode Phase 2: Domain Model Trennung)
- **Slice 2.1 – IInspectable aus Runtime extrahiert** (`src/model/InspectorTypes.ts` [NEU]):
  - `TPropertyDef`, `InspectorSection`, `IInspectable` und `isInspectable` leben jetzt im Model-Layer.
  - `TComponent.ts` importiert nicht mehr aus `src/editor/inspector/types.ts` (Editor-Modul), sondern aus `src/model/InspectorTypes.ts`.
  - `src/editor/inspector/types.ts` re-exportiert die Typen für Abwärtskompatibilität.
- **Slice 2.2 – TWindow.align vom Editor entkoppelt** (`TWindow.ts`, `EditorDataManager.ts`):
  - `TWindow.align`-Setter greift nicht mehr auf `window.editor` zu.
  - Grid-Dimensionen werden über `_gridCols`/`_gridRows`-Properties bereitgestellt.
  - `EditorDataManager.loadProject()` injiziert Grid-Werte beim Hydratisieren.
  - `safeReplacer` in `ProjectPersistenceService.ts` filtert die neuen internen Properties.
- **Slice 2.3 – ComponentData DTO eingeführt** (`types.ts`, `ProjectRegistry.ts`, `EditorStageManager.ts`, `Editor.ts`):
  - Neues `ComponentData`-Interface als reine Datenstruktur für Komponenten im Projekt-JSON.
  - `StageDefinition.objects`, `GameProject.objects/splashObjects` verwenden `ComponentData[]` statt `TWindow[]`.
  - `ProjectRegistry.getObjects()`, `EditorStageManager.currentObjects()`, `Editor.currentObjects` auf `ComponentData[]` umgestellt.
  - `TWindow`-Import aus `Editor.ts` und `ProjectRegistry.ts` entfernt.
- **Slice 2.5 – toDTO() Konvertierung** (`TComponent.ts`, `ProjectPersistenceService.ts`):
  - `TComponent.toDTO(): ComponentData` extrahiert nur serialisierbare Properties (keine Zirkelreferenzen).
  - `toJSON()` delegiert an `toDTO()` für Abwärtskompatibilität.
  - `saveProject()` nutzt `JSON.stringify(null, 2)` statt `safeReplacer` — erster Schritt zur Eliminierung der Serialisierungs-Hacks.

## [3.20.1] - 2026-03-20
### Fixed (CleanCode Phase 1: Unidirektionaler Datenfluss)
- **ProjectStore-Referenz-Fix** (`Editor.ts`):
  - `projectStore.setProject(project)` fehlte in `Editor.setProject()`. Dadurch arbeitete der Store nach einem Projektwechsel (Neues Projekt / Laden) mit einer veralteten Referenz.
  - Auswirkungen: Inspector-Änderungen (gameName, author) wurden auf dem alten Projekt-Objekt geschrieben. Canvas-Drag-Operationen (Move, Resize) wurden zwar dispatched, aber auf dem falschen Objekt angewandt, weshalb Komponenten nach dem Loslassen zurücksprangen.
- **E2E-Test-Fix** (`01_ProjectCreation.spec.ts`):
  - Fehlerhafter `evaluate`-Block entfernt, der auf nicht-existierendes `ed.inspectorEventHandler` zugriff und den Test crashte.
- **Debug-Cleanup**: Alle temporären `console.log`/`console.warn`-Trace-Ausgaben aus `StageHandler.ts` und `EditorInteractionManager.ts` entfernt.

## [3.20.0] - 2026-03-20
### Added (Native Dateiverwaltung)
- **File System Access API (Desktop/Electron Modus)** (`ProjectPersistenceService.ts`, `EditorDataManager.ts`):
  - Komplett überarbeitetes Lade- und Speicherverhalten für einen nativen "Desktop App"-Workflow.
  - Projekte werden nun über `showOpenFilePicker()` geladen, wodurch der Editor ein echtes Datei-Handle behält.
  - Klicks auf "Speichern" schreiben nun *direkt auf die Originaldatei* auf der Festplatte zurück (z. B. im \`demos\`-Ordner), anstatt sie blind an das \`game-server\`-Backend (\`projects/\` Verzeichnis) zu senden.
  - "Speichern unter" (`saveProjectAs`) nutzt `showSaveFilePicker()` und merkt sich den neuen Pfad/das neue File Handle.
  - Erhöhte UX-Transparenz: Die Projekt-Pfade werden jetzt mit "[Lokal] Dateiname" statt "projects/Dateiname" im Editor tituliert, wenn sie lokal bezogen wurden.
  - Fallback für den Dev-Server-Ordner (\`/api/dev/save-custom\`) sowie Standard-HTML-Dialoge bleibt für Browser ohne API-Support aktiv.

## [3.19.1] - 2026-03-17
### Added (UX: Stage-Anzeige)
- **Aktuelle Stage in Menüzeile** (`MenuBar.ts`, `Editor.ts`):
  - Prominentes Label „🎭 Aktuelle Stage: \<name\>" mittig in der Menüleiste
  - Aktualisiert sich bei Stage-Wechsel, Projekt-Laden und Projekt-Reset
  - Styling: halbtransparenter Hintergrund, fetter Text, dezenter Rahmen
### Changed (UX: Flow-Editor & Inspector)
- **Blueprint-Tasks im Flow-Dropdown** (`FlowEditor.ts`):
  - Blueprint-Tasks (globale Tasks) werden im Flow-Dropdown nun *ausschließlich* angezeigt, wenn die aktive Stage die Blueprint-Stage ist.
  - Fehler behoben: Die Ausblend-Bedingung für `isBlueprint` wurde entspannt (unterstützt nun Fallback auf ID `blueprint`), um zu garantieren, dass Blueprint-Tasks im Blueprint-Editor-Modus sicher angezeigt werden.
  - Fallback-Rendering für verwaiste Root-Tasks (`project.tasks`) in der Blueprint-Stage wiederhergestellt, für Legacy-Projekte, bei denen die Migration noch aussteht.
  - **Fix:** Der hartcodierte Eintrag "Main Flow (Stage)" (intern 'global') wurde für reguläre Stages aus dem Dropdown entfernt, da er irritierte und von Benutzern als globaler Task verstanden wurde.
### Features
- **FlowEditor (3.19.1):** Ein neues, einklappbares und in der Breite ziehbares ("resizable") Sidepanel für Pascal-Code integriert. Es dockt sich rechtsbündig im Canvas an, verfügt über ein modernes Glas-Design (`backdrop-filter: blur(12px)`) und zeigt in Echtzeit den generierten Pascal-Code der gewählten Stage oder Node.
- **FlowEditor (3.19.1):** Layout-Bug behoben, der das Pascal-Panel beim Initial-Laden als durchgehendes Band am unteren Rand statt andockend positionierte. Code wird zudem dauerhaft für das komplette Programm aus der Stage (`generateFullProgram`) gerendert.
- **FlowEditor (3.19.1):** Automatischer Formatierungsschritt hinzugefügt: Beim Umschalten zwischen Kompakt- und Detail-Ansicht formatiert sich der Flow-Graph nun automatisch neu, um schräge Verbindungslinien durch geänderte Knotengrößen zu korrigieren.
- **FlowEditor (3.19.1):** Kontextmenü auf dem Canvas erweitert: Nutzer können nun über einen Rechtsklick auf den Canvas bestehende Actions (`Vorhandene Aktion einfügen`) und globale Tasks (`Globalen Task einfügen`) direkt als verlinkte ("Linked") Knoten in den Flow einhängen.

### Fixes
- **PascalCodeGenerator (3.19.1):** Fehler behoben, bei dem die eigentliche Prozedur-Deklaration (`PROCEDURE MyTask;`) für global aufgerufene Tasks (z.B. `BackToMainStage`) im generierten Code fehlte, wenn diese nur "verlinkt" waren. Der Generator löst Tasks nun rekursiv anhand der ActionSequences auf.
- **FlowTask (3.19.1):** Scope-Wechsel im Inspector (von "Stage-lokal" auf "Global") umgestellt: Das Heraufstufen von Tasks in den globalen Bereich nutzt nun korrekterweise die moderne "Blueprint-Stage" als Target, verschiebt saubere Referenzen und inkludiert die dazugehörigen Flowcharts des Tasks beim Umzug.
- **FlowEditor (3.19.1):** StageLabel in der Top-Menu-Bar ergänzt (Update bei Projekt-Setup und Stage-Switching).
- **FlowEditor (3.19.1):** Blueprint-Tasks sind nun exklusiv in der Blueprint-Stage im Dropdown sichtbar.
- **FlowEditor (3.19.1):** Entfernung der verwirrenden Option `Main Flow (Stage)` in Non-Blueprint Stages.
- **FlowEditor (3.19.1):** Ghosting-Bug beim Stage-Switching (`switchActionFlow`) behoben, indem nicht existierende Tasks einen expliziten Fallback in die "Elementenübersicht" durchführen.
- **Inspector (3.19.1):** Schwerwiegenden Anzeige-Bug im Dropdown behoben: Wenn das Ziel-Objekt einer Action in der aktuellen Stage (z.B. Blueprint) nicht sichtbar war, fiel das HTML-Select stumm auf den ersten Eintrag ('GameLoop' etc.) zurück. Die UI zeigt fehlende Referenzen nun explizit als "[Wert] (ausgeblendet / nicht in Stage)" an.
- **Inspector (3.19.1):** Das `onFrame`-Event des `TGameLoop`-Objekts wurde im Inspector freigeschaltet. Zuvor war es zwar engine-seitig funktional, aber für Anwender im UI unsichtbar.
- **Demo Projekt (3.19.1):** Die leeren und fehlerhaften Tasks `MainGameLoop` und `PlayStateLoop` wurden aus der `RetroTennis.json` komplett entfernt, um 60-FPS-Leidlauf zu verhindern. Das Demo-Spiel nutzt für Ballbewegung und Kollision ohnehin die nativen Engine-Funktionen.
- **Demo Projekt (3.19.1):** Fehlerhaftes UI-Rendering im Task `CheckWallCollisions` behoben. Conditions waren als native Strings abgelegt, weshalb der Flow-Editor den Text nicht ins UI-Element mappen konnte und Fallback-Beschriftungen ("Bedingung") erzeugte. Die Einträge wurden ins korrekte Objektformat (`leftValue`, `operator`, `rightValue`) übersetzt.
- **Inspector (3.19.1):** Bugfix für leere/unsichtbare Werte bei Key-Value-Eigenschaften vom Typ Boolean (z.B. in der `negate` Action). Der Key-Value-Renderer schränkte das Rendering auf den Action-Typ `property` ein, woraufhin ein Fallback-Renderer fälschlicherweise ein statisches Number-Feld aufspannte.
- **Flow Editor (3.19.1):** Bugfix für die Text-Auflösung auf Action-Knoten (Detail-Ansicht). Objekte (wie z.B. das `changes`-Objekt) wurden bei der Zusammenführung implizit zu `[object Object]` stringifiziert. Die Text-Engine parst sie nun sauber als kompaktes JSON.
- **Inspector (3.19.1):** Die Action-UI für "Wert negieren" (negate) von einfachem String zu einem 'keyvalue'-Dictionary (`changes`) umgebaut, da Eigenschaften sonst unsichtbar und inkompatibel zur Engine blieben.
- **Physics Engine (3.19.1):** Fehler behoben, bei dem die Retro Tennis Demo nicht funktionierte, da Kollisionen implizit im JSON deaktiviert waren und Boundary-Events durch fehlerhafte Objekt-Conditions geloggt wurden. Fehlerhafte Conditions wurden durch nativ verarbeitete String-Conditions ersetzt (`${hitSide} == 'top'`).
- **Engine Runtime (3.19.1):** Autoresolve-Fallback für Event-Variablen eingebaut. Condition-Parameter wie `${hitSide}` grasen nun automatisch das `eventData`-Root-Objekt des Call-Contexts ab, falls sie nicht direkt im `vars`-Root des Scopes existieren, wodurch User das `eventData.`-Präfix nicht zwingend kennen/schreiben müssen.
- **Logging (3.19.1):** Der `TaskExecutor` formatiert Condition-Logs bei strukturierten Bedingungen (`leftValue`/`rightValue`) wieder sauber mit echten Variablen-Namen, anstatt `undefined == undefined` auszugeben.
- **Inspector (3.19.1):** Dropdowns für Tasks und Actions beziehen globale Elemente nun einheitlich über `ProjectRegistry.getTasks('all')` anstatt der veralteten Root-Level Collection.
- **FlowEditor (3.19.1):** Bugfix für die "Landkarte (Events/Links)" und die "Elementenübersicht", welche in der Blueprint-Stage leere Graphen dargestellt hatten. Beide Übersichten beziehen globale Ressourcen nun fehlerfrei aus den Stage-Daten via ProjectRegistry.
- **FlowEditor (3.19.1):** Bugfix für die "Landkarte", da diese Events von Objekten über die veraltete Property `.Tasks` geholt hat anstatt der neuen Standard-Property `.events`.
- **FlowEditor & PascalCodeGenerator (3.19.1):** Unbekannte oder Plugin-Actions (wie `navigate_stage`) zeigen in der Node-Ansicht und im generierten Pascal-Code nun ihre echten Parameter-Werte (dynamisch aus der `ActionRegistry` bezogen) anstatt nur ihre Typ-Bezeichnung an.
- **PascalCodeGenerator (3.19.1):** Fehlende Event-Handler (z.B. `onClick`) von Stage-Komponenten wurden durch Umstellung auf die moderne `.events` Property wiederhergestellt.
- **Inspector-Task- und Action-Dropdowns** (`InspectorRenderer.ts`):
  - Für Ereignis-Inputs und Eigenschafts-Dropdowns (Tasks, Actions) wird nun projektübergreifend `projectRegistry.getTasks('all')` genutzt, damit Aufgaben der Blueprint-Stage auch als Zielaktionen abgebildet und nicht ausgeblendet werden.
- **Fehlerbehebung nach Stage-Wechsel ("Ghosting" von globalen Tasks)** (`FlowEditor.ts`):
  - Wenn ein globaler Task wie `BackToMainStage` im Blueprint gezeichnet wird und man in eine reguläre Stage wechselt, schaltet der Flow-Editor nun zwingend auf die "Elementenübersicht" dieser Stage um. Zuvor wurde der Task über einen fehlerhaften Safety-Check wieder ans Ende des Dropdowns gedrückt, selbst wenn er nicht zur Stage gehörte.

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
  - Blueprint-Stage zum Test-Projekt hinzugefügt
  - Assertions prüfen `blueprintStage.actions` statt `project.actions`

## [3.18.1] - 2026-03-16
### Added (Export-Integrität)
- **Checksummen-Test** (`tests/export_integrity.test.ts`):
  - SHA-256-Prüfung von 5 Export-Dateien (GameExporter, PersistenceService, player-standalone, GameRuntime, GameLoopManager)
  - Baseline in `tests/export_checksums.json`
  - Aktualisierung bei bewussten Änderungen: `npx tsx tests/export_integrity.test.ts --update`

## [3.18.0] - 2026-03-15
### Improved (Runtime-Optimierung)
- **Bundle-Größe halbiert** (`package.json`):
  - `--minify` zum esbuild-Befehl hinzugefügt: 580 KB → 294 KB (-50%)
- **TGameLoop stark reduziert** (`TGameLoop.ts`):
  - Von 412 auf 95 Zeilen — nur noch Konfigurations-Container (boundsOffset, targetFPS)
  - Kompletter eigener Game-Loop entfernt (war Duplikat vom GameLoopManager)
- **Sprite Fast-Path** (`player-standalone.ts`):
  - `onSpriteRender` Callback: Pro Frame nur `style.left/top` der Sprites statt Full-DOM-Rebuild
  - Deutlich bessere 60fps-Stabilität bei vielen Sprites
- **Console-Logs entfernt** (`GameLoopManager.ts`):
  - Alle Debug-Logs aus dem Game-Loop entfernt (liefen 60×/sec)
### Added (Export-Menü)
- **Komprimierte Export-Optionen** (`menu_bar.json`):
  - "Export als HTML (komprimiert)" im Plattform-Menü
  - "Export als JSON (komprimiert)" im Plattform-Menü
  - Nutzt gzip+Base64 Komprimierung (70-80% kleiner)

## [3.17.0] - 2026-03-15
### Fixed (HTML-Export Runtime)
- **Splash-Stage bleibt stehen** (`GameExporter.ts`):
  - `splashAutoHide` und `splashDuration` zur Export-Whitelist hinzugefügt — ohne diese Properties startet kein Timer und der Splash bleibt ewig
  - `objects` und `flowCharts` zur Whitelist für Legacy-Format-Kompatibilität
- **Ball bewegt sich doppelt so schnell** (`player-standalone.ts`):
  - `AnimationTicker` lief parallel zum `GameLoopManager` → doppeltes `AnimationManager.update()` und Rendering
  - Fix: Ticker prüft jetzt `GameLoopManager.isRunning()` und überspringt eigenes Update/Render
  - Veraltete `getAnimationManager()` Methode entfernt, direkte Imports verwendet
- **Reactive Bindings fehlten** (`player-standalone.ts`):
  - `makeReactive: true` in `UniversalPlayer.startProject()` hinzugefügt — ohne dieses Flag funktionieren keine Variablen-Bindings, Expressions oder automatische Re-Renders
- **Build-Pipeline** (`vite.runtime.config.ts`, `src/stubs/node-stub.ts`):
  - Separater Vite-Build als IIFE-Bundle (293 KB minifiziert) erstellt
  - Node.js-Module (fs, path, express) per `resolve.alias` auf Stub-Datei umgeleitet

## [3.16.2] - 2026-03-14
### Improved (Inspector Layout & Rasterfarbe)
- **Inspector horizontales Layout** (`InspectorHost.ts`):
  - Labels werden links neben den Eingabefeldern angezeigt (Flexbox) statt darüber
  - Inline-Properties: Konsekutive `inline: true` Properties werden paarweise in einer Zeile gruppiert (max. 2 pro Zeile)
  - Inline-Labels werden dynamisch schmal gehalten, normale Labels haben feste Breite (70-90px)
- **Fett/Kursiv als Boolean-Checkboxen** (`TWindow.ts`, `InspectorHost.ts`):
  - `style.fontWeight` und `style.fontStyle` werden als Checkboxen (statt Select-Dropdowns) gerendert
  - Automatische CSS-Wert-Konvertierung: checked → `bold`/`italic`, unchecked → `normal`
  - Fett/Kursiv Duplikat behoben: Properties nur in `TTextControl` deklariert, nicht zusätzlich in `TWindow`
- **Stage-Rasterfarbe konfigurierbar** (`Stage.ts`, `inspector_stage.json`):
  - Hardcoded `#ddd` durch `gridConfig.gridColor` ersetzt (Fallback: `#dddddd`)
  - Neues Farbpicker-Feld "Rasterfarbe" im Stage-Inspector (RASTER-Sektion, nach Checkboxen)
  - Raster wird im Run-Mode nicht angezeigt (`visible && !runMode`)

## [3.16.1] - 2026-03-14
### Fixed (Inspector-Farben & Flow-Sync)
- **Inspector-Farben sichtbar** (`InspectorHost.ts`):
  - `require()` → statischer ESM-Import für `GROUP_COLORS` — Farben werden jetzt im Inspector angezeigt
- **Flow-Sync: DataAction→Action Kette** (`FlowSyncManager.ts`):
  - `output`-Anker wird jetzt als success-Branch erkannt (Fix für Task→DataAction→Action Sequenz)
  - `buildSequence()`: Action-Knoten mit `data.type='data_action'` werden korrekt als DataAction-Branching behandelt
  - Verlinkte Actions prüfen globale Definition auf `type: 'data_action'`
- **ESM-Import-Fixes** (`FlowDataAction.ts`):
  - `actionRegistry` Import von `require()` auf statischen Import umgestellt

## [3.16.0] - 2026-03-14
### Added (DataAction Inspector & Expert-Wizard Enhancements)
- **Inspector SQL-Gruppen** (`FlowDataAction.ts`):
  - Neue Gruppen-Reihenfolge: ALLGEMEIN → FROM → SELECT → INTO → WHERE → HTTP
  - Neues `selectFields`-Property (SELECT-Felder) mit Platzhalter `* (alle Felder)`
  - `queryProperty` (WHERE-Feld) ist jetzt Select-Dropdown mit `source: 'dataStoreFields'`
  - `dataStore` (FROM) verwendet neuen `source: 'dataStores'` (filtert nur TDataStore-Objekte)
  - Erweiterte Operatoren: `>=`, `<=`, `CONTAINS`, `IN`
- **Farbige Inspector-Gruppen** (`TComponent.ts`, `InspectorHost.ts`):
  - `GROUP_COLORS` Mapping: FROM (blau #2980b9), SELECT (grün #27ae60), INTO (orange #e67e22), WHERE (rot #c0392b), HTTP (grau #7f8c8d)
  - Sektionen mit 3px farbiger Bordüre, getöntem Hintergrund und farbigem Header-Text
- **InspectorRenderer** neue Sources: `'dataStores'` und `'dataStoreFields'` mit dynamischer Feld-Erkennung
- **Expert-Wizard Redesign** (`data_action_rules.json`):
  - Neuer Flow: Name → DataStore → Resource → SELECT → INTO → WHERE (mit bedingter Verzweigung)
  - HTTP/JWT/Body aus dem Wizard-Flow entfernt (nur noch im Inspector)
  - Optionale Felder dürfen leer bleiben
- **Hybrid-Felder** (`ExpertDialog.ts`):
  - String-Eingabe mit „V"-Button für Variablen-Picker (`${variablenName}`)
  - Dynamisches Dropdown zur Variablen-Auswahl
- **Dynamic Resolver** (`FlowContextMenuProvider.ts`):
  - `@dataStores` — nur TDataStore-Objekte
  - `@dataStoreFields` — DataStore-Felder abhängig vom gewählten DataStore
  - `@variables` — Projekt-Variablen für den Expert-Wizard
- **AgentAPI.md**: `data_action`-Sektion aktualisiert (FROM/SELECT/INTO/WHERE Parameter)
- **LLM-Training-Infrastruktur** [NEU]:
  - `src/tools/TrainingDataExporter.ts` — project.json → JSONL Exporter
  - `src/tools/agent-api-schema.json` — JSON-Schema für Constrained Decoding
  - `src/tools/prompt-templates/` — JSONL-Vorlagen (Login, CRUD)
  - Regel 11 in `DEVELOPER_GUIDELINES.md` für Trainingsdaten-Pflicht
- **Unit-Test** (`tests/flow_data_action.test.ts`): 8 Tests (Gruppen-Reihenfolge, Sources, Colors, Operatoren)

## [3.15.0] - 2026-03-13
### Added (Unidirektionaler Datenfluss — Phase 1)
- **`ProjectStore`** (`src/services/ProjectStore.ts`) [NEU]:
  - Zentraler State-Manager mit dispatch/reduce/onChange Pattern
  - 11 Mutations-Typen: SET_PROPERTY, RENAME_ACTION/TASK, ADD/REMOVE ACTION/TASK/OBJECT, SET_STAGE, BATCH
  - Automatischer Snapshot vor jeder Mutation (SnapshotManager-Integration)
  - Guard gegen verschachtelte Dispatches
  - 10 Unit-Tests (SET_PROPERTY, RENAME, ADD/REMOVE, onChange, BATCH)

## [3.14.4] - 2026-03-13
### Added (Undo/Redo Snapshots)
- **`SnapshotManager`** (`src/editor/services/SnapshotManager.ts`) [NEU]:
  - Projekt-Level Undo/Redo via Deep-Copy Snapshots (ergänzt den bestehenden ChangeRecorder)
  - Integration in `InspectorEventHandler`: Snapshot VOR jeder Property-Änderung
  - Stack-Limit (30), Throttling (500ms), isRestoring Guard
  - 10 Unit-Tests (Stack-Lifecycle, Deep Copy, Throttle, Restore-Callback, clear)

## [3.14.3] - 2026-03-13
### Added (IInspectable für UI-Komponenten)
- **`TComponent` implementiert `IInspectable`** (`src/components/TComponent.ts`):
  - Auto-Konvertierung: `getInspectorProperties()` Gruppen werden automatisch zu `InspectorSection[]`
  - Alle 66 UI-Komponenten (TButton, TLabel, TPanel, etc.) bekommen IInspectable ohne Änderung
  - Icon-Mapping für 13 bekannte Gruppen (IDENTITÄT, GEOMETRIE, DARSTELLUNG, etc.)
  - `applyChange()` signalisiert Re-Render bei Name/Scope-Änderungen
  - `getInspectorEvents()` exportiert Event-Bindings für den Inspector

## [3.14.2] - 2026-03-13
### Added (Sync-Robustheit)
- **E2E Roundtrip-Test** (`tests/e2e/09_SyncRoundtrip.spec.ts`) [NEU]:
  - Szenario A: Action-Typ-Änderung (navigate_stage) → prüft JSON + Flow-Node + Pascal + JSON-View
  - Szenario B: Action-Umbenennung → prüft JSON + Flow-Node + ActionSequence + JSON-View
  - Beide Tests mit automatischem Cleanup (Zurückbenennen + Speichern)

## [3.14.1] - 2026-03-13
### Added (Sync-Robustheit)
- **`SyncValidator`** (`src/editor/services/SyncValidator.ts`) [NEU]:
  - Automatische Konsistenzprüfung nach jeder `syncToProject()`-Operation
  - 6 Validierungsregeln: R1 (Action-Referenzen), R2 (FlowChart-Task-Konsistenz), R3 (Connection-Validität), R4 (Property-Sync), R5 (Duplikate), R6 (FlowChart-Speicherort)
  - Auto-Repair für unkritische Fälle (verwaiste Referenzen, FlowChart-Duplikate)
  - Spot-Validierung in `FlowNodeHandler.handlePropertyChange()` für sofortige Desync-Erkennung
  - 10 Unit-Tests (Gutfall, Erkennung und Auto-Repair für R1/R2/R3/R5/R6, Spot-Validierung)

## [3.14.0] - 2026-03-13
### Added (Inspector Refactoring: Component-Owned Inspector)
- **`IInspectable` Interface** (`src/editor/inspector/types.ts`):
  - Neues Interface für selbstbeschreibende Inspectoren: `getInspectorSections()` und `applyChange()`
  - `InspectorSection` Typ mit einklappbaren Sektionen, Icons und Properties
  - `isInspectable()` Type Guard für polymorphe Erkennung
- **`FlowElement.ts`**: Default `getInspectorSections()` und `applyChange()` als Basis-Implementierung
- **`FlowAction.ts`**: Dynamische Sektionen basierend auf Action-Typ (property/method/event/registry)
  - `applyChange()` gibt `true` für Typ-Wechsel zurück → triggert Inspector Re-Render
  - Legacy `getInspectorProperties()` leitet aus Sektionen ab
- **`FlowTask.ts`**: 3 Sektionen (Allgemein/Konfiguration/Aktionen) mit Ausführungsmodus und Scope
- **`InspectorHost.ts`**: Neuer IInspectable-Render-Pfad mit einklappbaren Sektionen
  - `renderInspectableSections()` rendert Sektionen mit Icons und Collapse-Toggle
  - `renderInspectableProperty()` delegiert Änderungen an `eventHandler.handleControlChange()`
  - Fallback auf JSON-Template-Pfad für Objekte ohne IInspectable
  - E2E-Kompatibilität: Input name=`{prop}Input`, Select name=`controlName || propName`

### Changed
- **Inspector Rendering**: FlowAction/FlowTask rendern jetzt über IInspectable-Pfad statt JSON-Templates
- **Handler-Delegation**: Änderungen laufen weiterhin über `FlowNodeHandler` für Refactoring-Kompatibilität

## [3.13.0] - 2026-03-13
### Added (API-Realisierung Phase 1-5)
- **API-Referenzdokument** (`docs/AgentAPI.md`):
  - Vollständige Referenz aller 45+ Methoden mit Signatur, Parametern, Rückgabewerten
  - **Action-Typ-Katalog**: Alle 22 Typen mit Pflichtfeldern und Beispielen
  - **Event-Katalog**: onClick, onCollision, onBoundaryHit, onStart, onKeyDown etc.
  - **Komponenten-Katalog**: TSprite, TLabel, TButton, TPanel, TInputController
  - **Batch-API Doku**: Transaktionen mit Rollback-Semantik
  - **WebSocket-API Doku**: agent_call/agent_result Echtzeit-Protokoll
  - **KI-Prompt-Template** für externe KI-Agenten
  - **Vollständiges PingPong-Beispiel** zur Demonstration aller API-Methoden
- **AgentController.ts** — 5 neue Methoden:
  - `addTaskCall(taskName, calledTaskName)` — Task-Referenz in Sequenz
  - `setTaskTriggerMode(taskName, mode)` — broadcast/local-sync/local setzen
  - `addTaskParam(taskName, paramName, type, defaultValue)` — Task-Parameter
  - `moveActionInSequence(taskName, fromIndex, toIndex)` — Reihenfolge ändern
  - `executeBatch(operations[])` — Batch-API mit Rollback
- **AgentShortcuts.ts** [NEU] — Convenience-Layer:
  - `createSprite()`, `createLabel()`, `createButton()`, `setSpriteCollision()`, `setSpriteVelocity()`
  - `createBounceLogic()`, `createScoreSystem()`, `createPaddleControls()`
- **HTTP-Endpoints** in `game-server/src/server.ts`:
  - `POST /api/agent/:method` — Einzeln-Aufrufe
  - `POST /api/agent/batch` — Batch/Transaktionen mit Rollback
- **WebSocket-Kanal** `agent_call` / `agent_result` in `Protocol.ts` + `server.ts`
- **Tests** (`tests/agent_controller.test.ts`): 12 Tests (PingPong + Tennis-Batch + Rollback)

## [3.12.4] - 2026-03-13
### Added
- **F5-Reload Dialog (Session-Wiederherstellung)**:
  - Bei F5/Reload vergleicht der Editor jetzt LocalStorage-Projekt mit Server-Datei (`project.json`).
  - Wenn sich die Projekte unterscheiden → modaler Dialog: "📂 Lokale Version laden" vs. "🌐 Server-Version laden".
  - Zeigt Projektname und letzten Speicherzeitpunkt der lokalen Version.
  - `autoSaveToLocalStorage()` schreibt jetzt Zeitstempel (`gcs_last_save_time`).
  - Vorher: Immer hardcoded `./platform/project.json` geladen — lokale Änderungen gingen bei F5 verloren.

## [3.12.3] - 2026-03-12
### Added (Editor / Debugging)
- **Keyboard- & Runtime-Logs via UseCaseManager**: Neuer UseCase `Input_Handling` in `UseCaseManager.ts` hinzugefügt. `TInputController` wurde darauf umgestellt. `TaskExecutor` (`[TaskExecutor] EXECUTING: ...`) und `EditorRunManager` (`[RunManager] handleRuntimeEvent: ...`) verwenden nun ebenfalls konsequent die Logger-API (`Logger.get(..., 'Runtime_Execution')`). Alle störenden Event- und Ausführungs-Logs lassen sich nun gezielt im Inspector "Logs"-Tab de- und aktivieren.

### Added (Game Logic / PingPong)
- **Regelkonforme Event-Actions (`PingPong.json`)**:
  - Sämtliche vormals "inline" oder fehlerhaft referenzierten `negate`-Verhaltensweisen für den Abprall wurden zu korrekten, globalen Actions konvertiert (Regel: *Keine Inline-Actions*).
  - Die Action `NegateBallY` (Abprallen an oberer/unterer Begrenzung) ist nun als globales Element vom Typ `negate` für `BallSprite` (`velocityY: true`) in der Blueprint-Stage verankert.
- **Ball-Reset bei Aus (`PingPong.json`)**: Implementierung der Fehler-Bedingung (Ball berührt linken oder rechten Spielfeldrand).
  - Globale Action `ResetBall` vom Typ `property` erstellt, die den Ball zentriert (Grid-Koordinaten x: 32, y: 19) und die X/Y-Geschwindigkeit zurücksetzt.
  - Task `HandleBallBoundary` zu einem komplexen Ablauf umgebaut, welcher die `hitSide` Eigenschaft per konditionalen Verzweigungen testet: `top`/`bottom` führen wie bisher zu Abprallern (`NegateBallY`), `left`/`right` führen zum Aufruf von `ResetBall`.

### Fixed
- **FlowSyncManager (Condition-Nodes Bug)**:
  - Behoben: Beim Speichern (FlowChart -> actionSequence) und Parsen (actionSequence -> FlowChart) von `condition` Nodes wurden strukturierte Objektdaten (`data.condition`) zu einem platten String `text` reduziert, was zum vollständigen Verlust der Bedingungs-Logik führte.
  - Das Serialisieren/Deserialisieren unterstützt nun korrekt die Erhaltung von `data.condition` für die Editor-Anzeige und die Laufzeitauswertung.
- **Inspector Dropdowns (Variablen)**:
  - Behoben: Bislang wurden Task-bezogene Parameter (Eingangsparameter wie `hitSide`) im Variablen-Dropdown des Inspectors (z.B. in der Condition-Node) nicht angezeigt, wodurch man als User nicht sehen konnte, auf welche Laufzeit-Variablen man Zugriff hat. Der `InspectorContextBuilder` liest nun dynamisch die `params` aller Tasks in der aktuellen Stage und führt sie mit Büroklammer-Icon (📎) regulär in der Dropdown-Liste.
- **FlowCondition Text-Anzeige im Flow-Diagramm**:
  - Behoben: FlowCondition-Nodes (lila Rauten) zeigten nach dem Laden eines Projekts keinen Bedingungstext an (z.B. "hitSide == top"). Ursache: `refreshVisuals()` wurde für Condition-Nodes im `FlowSyncManager.restoreNode()` nicht aufgerufen. Der Fix ist eine einzige Zeile, die sicherstellt, dass `updateText()` nach dem Laden der `data.condition` Daten getriggert wird.
- **FlowSyncManager Connection-Matching (ROOT CAUSE BOUNCING-BUG)**:
  - Behoben: `syncToProject()` suchte true-branch Connections ausschließlich via `startAnchorType === 'true'`. FlowCondition-Connections nutzen jedoch `startAnchorType: 'right'` mit dem Flag `isTrueBranch: true`. Die Connection wurde dadurch nie gefunden, das generierte `body`-Array blieb leer und keine Action wurde bei Boundary-Hits ausgelöst. Fix: Connection-Erkennung erweitert um `'right'`/`'bottom'` Anchor-Typen und `isTrueBranch`/`isFalseBranch` Flags.
- **PascalCodeGenerator TypeError & Action-Support**:
  - Behoben: `TypeError: Cannot read properties of undefined (reading 'toString')` — der Generator erwartete `cond.value`, aber nach dem FlowSyncManager-Fix wurden Conditions mit `leftValue`/`rightValue` exportiert. Beide Formate werden jetzt unterstützt, mit durchgehender Null-Safety (`String()` statt `.toString()`).
  - Neu: `negate`-Actions werden als Pascal-Zuweisungen dargestellt (`Target.Prop := -Target.Prop;`).
  - Neu: Actions aus der Blueprint-Stage werden jetzt korrekt bei der Suche berücksichtigt.
- **Stage Start-Animation Fix**:
  - `GameRuntime.triggerStartAnimation()` unterstützt jetzt alle 12 TStage Fly-Patterns (UpLeft, BottomLeft, ChaosIn, Matrix, Random, etc.).
  - Vorher wurden nur `fade-in` und `slide-up` erkannt — alle Inspector-konfigurierten Patterns (z.B. `BottomLeft`) wurden ignoriert.
  - Easing-Konfiguration (`startAnimationEasing`) wird jetzt korrekt aus der Stage-Config gelesen.
  - **Lazy-Init Fix in AnimationManager**: `startTime` wird erst beim ersten `update()`-Aufruf gesetzt (statt bei Tween-Erstellung). Behebt Timing-Bug wo Tweens sofort als "completed" markiert wurden weil sie zwischen Game-Loop-Zyklen erstellt wurden.
  - **Einheiten-Bug behoben**: Startpositionen wurden in Pixeln (1152×720) statt Grid-Zellen (64×40) berechnet → Objekte starteten 97% der Dauer unsichtbar. `outsideMargin` auf 10 Grid-Zellen reduziert.
- **DebugLogService Performance-Fix**:
  - `maxChildren=50` pro Parent-Log verhindert unbegrenztes Speicherwachstum bei verschachtelten Logs.
  - `scheduleNotify()` via `requestAnimationFrame` reduziert Listener-Benachrichtigungen von hunderten/sec auf max. 1/Frame.
  - `isNotifying`-Guard verhindert rekursive Log-Kaskaden.
  - O(1) `entryMap` HashMap ersetzt rekursive `findEntry()` Baumsuche — bei 1000 Logs mit je 50 Kindern wurde der Baum bei JEDEM `log()`-Aufruf komplett durchsucht, was progressives Stottern verursachte.
  - **TDebugLog Visibility-Guard:** Der Subscribe-Callback und `renderLogs()` prüfen jetzt `isVisible` — kein DOM-Rebuild wenn das Panel unsichtbar ist. Vorher wurden 1000+ DOM-Elemente bei JEDEM Frame neu erstellt, obwohl das Panel per `translateX(100%)` ausgeblendet war.
- **FlowEditor isDirty-Guard (Robustheit)**:
  - `syncToProject()` wird jetzt NUR ausgeführt wenn tatsächlich Änderungen im Flow-Editor vorgenommen wurden (`isFlowDirty`-Flag).
  - Beim bloßen View-Wechsel (Flow → Code/Run) oder Speichern ohne Änderungen wird `syncToProjectIfDirty()` aufgerufen, das den Guard prüft.
  - Verhindert, dass korrupte `actionSequence`-Daten im LocalStorage/Autosave landen, wenn die Connection-Matching-Logik Edge-Cases nicht abfängt.
- **Pascal-Code Task-Filter (NEU)**:
  - In der Code-View (Pascal-Tab) gibt es nun ein Task-Dropdown, mit dem ein einzelner Task ausgewählt werden kann.
  - Bei Auswahl werden nur die relevanten Prozeduren angezeigt: der Task als Hauptprozedur, alle referenzierten Actions als Sub-Prozeduren, Task-Parameter als VAR-Deklarationen und Event-Auslöser als Kommentare.
  - `PascalCodeGenerator.generateForTask()` sammelt Actions rekursiv aus `actionSequence` (inkl. `body`, `elseBody`, `thenAction`, `elseAction`).
- **Paddle Collision Bounce (`PingPong.json`)**: Implementierung des Abpralls an den Paddles (X-Achse).
  - Globale Action `NegateBallX` vom Typ `negate` erstellt, welche `velocityX` umkehrt.
  - Neuer Task `HandlePaddleCollision` auf `stage_main` angelegt, der `NegateBallX` aufruft.
  - Event-Binding `onCollision` auf dem `BallSprite` konfiguriert, sodass der Task bei jeder Sprite-Kollision (hier: Paddles) automatisch triggert.
- **Top/Bottom Ball Bounce (`PingPong.json`)**: Implementierung des Abpralls an der oberen und unteren Begrenzung.
  - Globale Action `NegateBallY` vom Typ `negate` erstellt, welche `velocityY` umkehrt. (Nutzt die automatische Fallback-Logik in `StandardActions.ts`, die `_prevVelocityY` heranzieht, wenn `velocityY` durch die Engine temporär auf 0 gesetzt wurde).
  - Neuer Task `HandleBallBoundary` auf `stage_main` angelegt, der `NegateBallY` aufruft.
  - Event-Binding `onBoundaryHit` auf dem `BallSprite` konfiguriert, sodass der Task bei Randerkennung automatisch triggert.

### Fixed (Performance / Stottern)
- **Kollisions-Lags behoben (`GameRuntime.ts`, `GameLoopManager.ts`, `StandardActions.ts`)**: Stark frequentierte Debug-Logs (`console.info`, `console.warn` bei Event-Routing) und speicherintensive `DebugLogService`-Aufrufe in der `negate`-Action auskommentiert, da diese bei jeder Ball-Paddle/Wand Berührung synchrone Time-Gaps (Stottern) verursachten.

### Fixed (Paddle-Steuerung / InputController)
- **Direkte Keyboard-Verwaltung** (`EditorRunManager.ts`): Keyboard-Listener werden jetzt direkt im EditorRunManager via `setupKeyboardListeners()`/`removeKeyboardListeners()` verwaltet, statt über `TInputController.start()`/`stop()`. Behebt: IC's interne Methoden griffen nicht zuverlässig (Splash-Screen verhindert `initMainGame()`, HMR-Instanz-Inkonsistenzen).
- **InputController-Initialisierung vor Splash-Check** (`GameRuntime.ts`): Neue Methode `initInputControllers()` wird VOR dem Splash-Check in `start()` aufgerufen, damit Keyboard-Events sofort nach Spielstart funktionieren.
- **Events-Dropdown zeigt alle Tasks** (`InspectorContextBuilder.ts`): `availableTasks` nutzt jetzt `getTasks('all')` statt `getTasks('active')`, damit globale Objekte (InputController auf Blueprint-Stage) auch Spielfeld-Tasks im Dropdown sehen.

## [3.12.2] - 2026-03-12
### Fixed (Abwärtskompatibilität älterer Spiele)
- **`self`/`other` Auflösung in Actions** (`StandardActions.ts`): `resolveTarget()` löst jetzt `self` und `other` korrekt über `eventData` auf. Bei Kollisionen enthält eventData `{self, other, hitSide}`. Vorher wurde `self`/`other` nie aufgelöst → alle `variable`-Actions mit `source: 'self'/'other'` scheiterten.
- **`calcSteps`-Auswertung im `calculate`-Handler** (`StandardActions.ts`): Wenn `formula`/`expression` fehlt aber `calcSteps` vorhanden sind, werden die Steps sequentiell ausgewertet. Unterstützt `operandType: 'variable'`, `'objectProperty'` und `constant` mit Operatoren `+`, `-`, `*`, `/`.
- **`self`/`other` im Evaluationskontext**: Der `calculate`-Handler injiziert jetzt `self`/`other` aus `eventData` in den `evalContext`, damit Formeln wie `self.y` oder `other.height` funktionieren.
- **`negate`-Action hinzugefügt** (`StandardActions.ts`): Negiert numerische Properties (z.B. `velocityX * -1`). Wird in Arkanoid/Tennis für Ball-Richtungsänderung bei Kollision verwendet.
- **Alle Action-Handler konsistent**: `property`, `variable`, `animate`, `move_to`, `call_method` verwenden jetzt `context.eventData` für Target-Auflösung.

## [3.12.1] - 2026-03-11
### Performance (Runde 2 — Smooth 60fps)
- **Direkte Sprite-Referenzen statt stale Copies** (`GameLoopManager.ts`, `EditorRunManager.ts`): `spriteRenderCallback` übergibt jetzt `this.sprites` (aktuelle Referenzen vom GameLoopManager) direkt an `renderSpritesOnly()`. Vorher wurden stale Deep-Copies aus `getObjects()` genutzt — Positionen blieben beim Startwert.
- **RAF-Debounce für GlobalListener** (`GameRuntime.ts`): Der `onRender`-Callback wird jetzt per `requestAnimationFrame` debounced. Egal wie viele Properties sich pro Frame ändern (Score + Label + Toast + ...), es gibt nur EIN `editor.render()` pro Frame.
- **TDebugLog console.log-Spam eliminiert** (`TDebugLog.ts`): `shouldShowRecursive()` loggte bei JEDEM `renderLogs()`-Aufruf für ALLE matching Einträge → exponentielles Wachstum. `subscribe`-Callback jetzt ebenfalls per RAF debounced.
- **AnimationManager Logging bereinigt** (`AnimationManager.ts`): `update()` loggte 60x/sec in die Console. Alle High-Frequency-Logs auskommentiert, `Tween completed`-Log beibehalten.

## [3.12.0] - 2026-03-11
### Performance
- **Editor-Rendering-Optimierung (60fps Sprite-Bewegung)**: Separater Fast-Path für Sprite-Positionen im Editor Run-Modus implementiert. Sprites werden jetzt direkt per `style.left/top` aktualisiert (ähnlich dem Standalone-Player), statt den gesamten DOM-Render-Zyklus zu durchlaufen.
  - `GameLoopManager.ts`: Neuer `spriteRenderCallback` als Fast-Path — nur Sprite-Positionen statt volles DOM-Rebuild.
  - `StageRenderer.ts`: Neue Methode `updateSpritePositions()` für direkte Pixel-Positionierung. CSS-Transition (`left 33ms linear`) entfernt, da sie mit `requestAnimationFrame`-Timing kollidiert.
  - `GameRuntime.ts`: Neues `onSpriteRender` Feld in `RuntimeOptions`, durchgereicht an `GameLoopManager`.
  - `EditorRunManager.ts`: Neue Methode `renderSpritesOnly()` filtert Sprites und ruft Fast-Path auf. `handleRuntimeEvent()` ruft kein doppeltes `editor.render()` mehr auf.
  - `Stage.ts`: `updateSpritePositions()` Delegierungsmethode (renderer bleibt private).

## [3.11.9] - 2026-03-10
### Added
- **Glow/Shadow-Effekt für alle Komponenten** (`src/components/TWindow.ts`, `src/editor/services/StageRenderer.ts`): Neue Properties `glowColor`, `glowBlur`, `glowSpread` und `boxShadow` (CSS-String) im Inspector unter Gruppe "GLOW-EFFEKT". Wirkt auf alle TWindow-Ableitungen (TPanel, TButton, TLabel, etc.).
- **AgentController API vervollständigt** (`src/services/AgentController.ts`): 22 neue Methoden — Delete (Task/Action/Object/Stage/Variable), Rename (Task/Action), Read (listStages/listTasks/listActions/listVariables/listObjects/getTaskDetails), UI (setProperty/bindVariable/connectEvent), Workflow (duplicateTask), Validation (validate).

### Fixed
- **AgentController.generateTaskFlow()**: Connection-IDs, Start/End-Koordinaten und Type-Casing (kleingeschrieben) korrigiert für korrekte FlowEditor-Darstellung.
- **Inspector Scroll-Position**: Bleibt nach Property-Änderung erhalten (kein doppeltes update bei originator='inspector').
- **Server-Endpoint** `GET /api/dev/list-projects`: Listet alle Ordner und JSON-Dateien unter `projects/` auf.
- **Dynamischer Speicherpfad** (`src/editor/services/EditorDataManager.ts`): `saveProjectToFile` nutzt jetzt `currentSavePath` statt festen Pfad `projects/master_test/`. "Speichern unter" setzt diesen Pfad via Dialog.
- **VariablePickerDialog** (`src/editor/inspector/VariablePickerDialog.ts`): Neuer modaler Dialog zur Variablen-Auswahl im Inspector. Ersetzt den bisherigen `prompt()`-Dialog. Zeigt globale und Stage-Variablen mit Subeigenschaften als Baumstruktur, Suchfeld und Gruppierung (🌐 Global / 🎭 Stage / 🔄 Repeater).

### Fixed
- **Binding-Anzeige im Inspector** (`src/editor/inspector/InspectorHost.ts`): `resolveValue()` bewahrt jetzt Binding-Werte (z.B. `${currentUser.name}`) als Rohtext, statt sie erneut durch den Template-Parser zu schicken. Verhindert doppelte Template-Auflösung, die Binding-Werte zu leeren Strings machte.
- **findObjectById gibt Original statt Preview** (`src/editor/services/EditorCommandManager.ts`): `findObjectById()` gab Preview-Objekte aus dem ObjectStore zurück, in denen Bindings bereits aufgelöst (= leer) waren. Jetzt wird über `__rawSource` das Original-Objekt mit den Roh-Binding-Werten zurückgegeben.
- **Falsches Dirty-Flag nach Startup** (`src/editor/EditorViewManager.ts`): `isProjectDirty` wurde bei JEDEM `DATA_CHANGED`-Event auf `true` gesetzt, auch beim initialen Laden. Jetzt wird der Originator geprüft: Events mit `'editor-load'` oder `'autosave'` setzen das Flag nicht mehr.
- **Circular JSON beim Serialisieren** (`src/services/ProjectPersistenceService.ts`): Neuer `safeReplacer()` filtert zirkuläre Properties (`renderer`, `host`, `parent`, `stage`, `editor`, `__rawSource`) bei ALLEN `JSON.stringify`-Aufrufen (autoSave, saveProject, saveProjectToFile).
- **Stage-Menü nach Laden** (`src/editor/services/EditorDataManager.ts`): `updateStagesMenu()` wird jetzt verzögert am Ende von `loadProject()` aufgerufen, damit neue Stages zuverlässig im Menü erscheinen.

### Changed
- **InspectorActionHandler** (`src/editor/inspector/InspectorActionHandler.ts`): `handlePickVariable()` nutzt jetzt den neuen `VariablePickerDialog` statt `prompt()`. Vereinfachte Wert-Persistierung (keine Konkatenation mehr, direktes Ersetzen).

## [3.11.8] - 2026-03-10
### Added
- **E2E-Test: Stage erzeugen** (`tests/e2e/05_StageCreation.spec.ts`): UseCase "Eine neue Stage erzeugen" — Menü: Stages → Neue Stage, Umbenennung zu HighscoreStage, Validierung in project.stages, Speicherung.
- **E2E-Test: Action Typ ändern** (`tests/e2e/06_ActionTypeChange.spec.ts`): UseCase "Action Typ ändern" — Flow-Tab → VerifyTask-Flow → VerifyAction anklicken → ActionTypeSelect auf navigate_stage, stageId auf HighscoreStage.
- **E2E-Test: RunButton erzeugen** (`tests/e2e/07_RunButtonCreation.spec.ts`): UseCase "RunButton erzeugen" — Stage-Tab → Toolbox → Button platzieren → Inspector caption auf 'run' setzen.
- **UseCase-Beschreibungen** (`docs/UseCaseBeschreibungen/`): 3 neue UseCase-Dateien für Stage erzeugen, Action Typ ändern, RunButton erzeugen.

### Fixed
- **getStageOptions Bugfix** (`src/editor/JSONDialogRenderer.ts`, L91-95): `getStageOptions()` nutzt jetzt `this.project.stages` statt `this.enrichedProject.stages`. Das `enrichedProject` war ein Snapshot vom Dialog-Konstruktor und konnte neue Stages (z.B. HighscoreStage) nicht enthalten.

### Changed
- **Test-Nummerierung**: `05_ProjectSaving.spec.ts` → `08_ProjectSaving.spec.ts` (Tests 05-07 sind die neuen UseCase-Tests).

## [3.11.7] - 2026-03-09
### Added
- **UseCase: Projekt speichern** (`src/editor/services/EditorDataManager.ts`): `saveProjectToFile()` implementiert. Speichert das Projekt gemäß den 4 UseCase-Schritten: Änderungsstatus prüfen, Spielname validieren (kein 'Haupt-Level'), Datei-Existenz prüfen + Überschreiben-Dialog, Speichern via `/api/dev/save-custom`. `isProjectChangeAvailable` wird VOR dem JSON.stringify zurückgesetzt.
- **Menu-Integration**: `EditorMenuManager.ts`: Case `'save'` leitet jetzt zu `saveProjectToFile()` um. Neuer Case `'save-dev'` ruft das alte `saveProject()` auf.
- **E2E-Test: Projekt speichern** (`tests/e2e/ProjectSaving.spec.ts`): 3 Tests für alle UseCase-Schritte (Abbruch kein Change, Abbruch Standard-Name, Erfolgreiche Speicherung + Round-Trip JSON-Validierung). Alle 3 passed (3.1s) ✅.

### Fixed
- **Serialization: Read-Only Getter-Fehler** (`src/utils/Serialization.ts`): Alle Read-Only Getter von `TStageController` zur `reservedKeys`-Liste hinzugefügt: `currentStageId`, `currentStageName`, `currentStageType`, `currentStageIndex`, `stageCount`, `mainStageId`, `isOnMainStage`, `isOnSplashStage`. Verhindert mehrfache `TypeError: Cannot set property ... which has only a getter` beim Laden.
- **Laden: Endlosschleife am Lade-Dialog** (`src/editor/services/EditorDataManager.ts`): `isProjectDirty=false` wird jetzt NACH `notifyDataChanged()` (synchron + `setTimeout(100)`) in `loadProject()` gesetzt. `setProject()` und `autoSaveToLocalStorage()` lösten `DATA_CHANGED` aus → `isProjectDirty=true`. Reset wurde dadurch überschrieben.
- **`saveProjectToFile()` Ablauf-Bug**: `changeVar.defaultValue = false` wird korrekt VOR dem `JSON.stringify`-Aufruf gesetzt.

## [3.11.6] - 2026-03-09
### Added
- **E2E-Test: Task mit Action verknüpfen** (`tests/e2e/TaskActionLinking.spec.ts`): Vollständiger E2E-Test für den UseCase "Task mit Action verknüpfen" via Flow-Editor API. Testet den gesamten Flow: Projekt erstellen, Task und Action in MainStage ablegen, auto-generierten Task-Knoten wiederverwenden, Action-Knoten erzeugen, Verbindung über `restoreConnection()` herstellen, JSON-Validierung (Connection + actionSequence) und Manager-View UI-Prüfung.

### Fixed
- **Flow-Editor Knoten-Duplikat-Problem**: `switchActionFlow()` erzeugt automatisch einen Task-Knoten als Startpunkt. Ein zusätzlicher `createNode('Task', ...)` Aufruf im gleichen Kontext erzeugt einen Konflikt. Korrekte Lösung: auto-generierten Knoten per `nodes.find(n => type === 'task')` referenzieren.
- **Task/Action Speicherort**: Tasks und Actions gehören in `stage.tasks` / `stage.actions` der aktiven Stage (z.B. `mainStage`), nicht in `project.tasks` (Root-Level).

## [3.11.5] - 2026-03-09
### Added
- **E2E-Test: Action Umbenennen** (`tests/e2e/ActionRenaming.spec.ts`): Vollständiger E2E-Test für den UseCase "Eine Action umbenennen" via Inspector UI. Testet den gesamten Flow: Projekt erstellen, VerifyTask anlegen, Action erzeugen, per Inspector umbenennen, JSON-Validierung (alle Speicherorte) und Manager-View Prüfung.

### Fixed
- **Action-Speicherort-Logik**: Test-Assertions robustifiziert, um alle möglichen Action-Speicherorte zu berücksichtigen (Root-Level, alle Stages inkl. Blueprint, alle FlowCharts-Einträge). Actions werden gemäß `getTargetActionCollection`-Logik in `activeStage.actions` gespeichert.
- **syncToProject nach Rename**: Explizites Aufrufen von `syncToProject()` nach dem Inspector-Rename stellt sicher, dass die Änderung in der Projektstruktur persistiert wird.

## [3.11.4] - 2026-03-09
### Added
- **Blueprint-Visualisierung**: Service-Objekte (z. B. `StageController`) und globale Variablen sind nun exklusiv in der `blueprint`-Stage sichtbar.
- **Variablen-Werte auf Stage**: Variablen zeigen nun ihren Namen und ihren aktuellen Wert (oder Defaultwert) direkt auf der Stage an.

### Changed
- **Variablen-Inspector**: Variablen werden einheitlich als Textfelder (`TEdit`) dargestellt, um die explizite Anzeige von Werten wie "true" oder "false" zu ermöglichen (Nutzerpräferenz). Labels wurden auf "Default-Wert" und "Aktueller Wert" angepasst.
- **Stage-Menü Synchronisierung**: Namen von Stages werden nun bei einer Änderung im Inspector sofort im "Stages"-Menü der MenuBar aktualisiert.
- **Snap-To-Grid**: Neue Option im Stage-Inspector, um das Einrasten am Raster beim Verschieben/Resizen zu aktivieren oder zu deaktivieren.

### Fixed
- **Datenbindung im Inspector**: Fehler behoben, bei dem Boolean `false` und `undefined` in Textfeldern verschluckt wurden.
- **Serialization-Stabilität**: `TypeError` beim Laden von Objekten mit Read-Only Properties (z.B. `currentStageId`) behoben.

## [3.11.3] - 2026-03-09
### Fixed
- **Action-Typ-Persistenz**: Stabilisierung der strukturellen Knoten-Identität in `FlowAction.ts`.
- **TypeScript-Fix**: Behebung des Fehlers TS2339 in `FlowGraphHydrator.ts` durch korrektes Casting.
- **Sync-Stabilität**: Sicherstellung, dass Typ-Änderungen im Inspector konsistent in `project.json` gespeichert werden.

## [3.11.2] - 2026-03-09
### Fixed
- **Action-Typ-Persistenz**: Behebung des Fehlers, bei dem Typ-Änderungen im Inspector (z. B. zu `data_action`) nicht gespeichert wurden.
- **Dynamische Typ-Erkennung**: `FlowAction.getType()` ermittelt den Typ nun zur Laufzeit aus den Model-Daten, was eine korrekte Serialisierung in `project.json` garantiert.
- **Auto-Morphed Nodes**: Automatische Erzeugung von Success/Error-Ports bei Typ-Wechsel zu `data_action` ohne Instanz-Austausch.

## [3.11.1] - 2026-03-09
### Fixed
- **Action-Persistenz (Index-basiert)**: Umstellung der Action-Suche im `FlowNodeHandler` auf einen hochperformanten Index-Lookup via `ProjectRegistry`. Verhindert zuverlässig "Action not found" Fehler.
- **Broad-Field Matching**: Unterstützung für robuste Identifizierung von Action-Knoten über verschiedene Felder (`name`, `actionName`, `data.name`, `properties.name`, `properties.text`).
- **Orphaned Action Cleanup**: Automatische Bereinigung von verwaisten Action-Referenzen in `actionSequence`-Listen durch den `SanitizationService`.
- **Flow-Synchronisation**: Korrekte Typ-Behandlung (`actionType` -> `type`) und Synchronisation verlinkter Actions im `FlowSyncManager`.

## [3.20.1] - 2026-03-20
### Fixed
- **HTML Export Crash:** Fehler bei `exportHTML` und `exportHTMLCompressed` behoben, der durch einen TypeError (Zirkuläre Struktur in `JSON.stringify`) verursacht wurde, indem ein spezieller `safeStringify`-Filter in den `GameExporter` integriert wurde.
- **HTML Export Crash:** Fehler bei Projekt-Objekten ohne veraltetes `project.stage` Objekt behoben, indem auf die modernen `project.stages[0]` Fallbacks zurückgegriffen wird.

## [3.20.0] - 2026-03-20
### Added
- **Intelligentes Speichermanagement**: Einführung eines `isProjectDirty` Flags zur Erkennung ungespeicherter Änderungen.
- **Browser-Schutz**: `window.onbeforeunload` Guard warnt vor dem Verlassen der Seite bei ungespeicherten Daten.
- **Sicherheitsabfragen**: Bestätigungsdialoge beim Erstellen neuer Projekte oder beim Laden, falls Änderungen vorliegen.

### Changed
- **Entkoppeltes Speichern**: Automatisches Speichern schreibt nur noch in den `LocalStorage` (Crash-Schutz). Das Schreiben auf die Festplatte (`project.json`) erfolgt nur noch explizit durch den Nutzer via "Speichern"-Button.

### Fixed
- Wiederherstellung der `project.json` aus der Git-Historie nach versehentlichem Überschreiben.
- **E2E-Reporting**: Rekursives Parsing von Test-Ergebnissen im Test-Runner zur Unterstützung verschachtelter Test-Suites.
- **Server-Check**: Automatisierte Prüfung der Game-Server Erreichbarkeit vor E2E-Tests.
- **E2E-Stabilität**: Fix der Inspector-Hydrierung in `deep_integration.spec.ts` durch Umstellung von `setProject` auf `loadProject`.
- **Code-Cleanup**: Entfernen ungenutzter Variablen und Imports in der Runtime (TSC-Fix).

## [3.9.1] - 2026-03-06
### Added
- **Phase 6.2: Deep E2E Integration**: Vollständige Browser-Automatisierung für Kern-Use-Cases.
- `tests/e2e/deep_integration.spec.ts`: Komplexer Integrationstest (D&D, Inspector, Flow, Run-Mode).
- Playwright-Konfiguration für stabile sequentielle Testausführung.

### Fixed
- Stabilität der Drag-and-Drop Operationen im E2E-Test.
- Ambiguität der Inspector-Selektoren im Playwright-Kontext.
- Toolbox-Kategorien-Expansion in `editor_smoke.spec.ts`.

## [3.9.0] - 2026-03-06
### Added
- **Phase 5 & 6**: Implementierung des Master-Test-Projekts und Playwright E2E-Infrastruktur.
- `scripts/seed_test_data.ts`: Generator für komplexes 3-Stage Projekt.
- `tests/e2e/editor_smoke.spec.ts`: Erster automatisierter Browser-Smoke-Test.

[... weitere Einträge siehe Archiv ...]

## [3.9.1] - 2026-03-31
### Changed
- CleanCode: 24 verbleibende \console.*\-Aufrufe in erfolgskritischen Modulen durch \Logger\ ersetzt (StageRenderer, GameRuntime, GameLoopManager, ReactiveRuntime, ExpressionParser, StandardActions).
- Performance: \console.table\ in \StageRenderer\ durch verschachtelten Logger-Call ausgetauscht.

[ f i x ]   S e r i a l i z a t i o n :   A d d e d   T V i r t u a l G a m e p a d   c l a s s   t o   h y d r a t e O b j e c t s   t o   p r e v e n t   d a t a   l o s s   i n   i f r a m e   r u n n e r   e x p o r t  
 [ f e a t u r e ]   V i r t u a l G a m e p a d :   I m p l e m e n t e d   d u a l - s t i c k   m u l t i p l a y e r   s u p p o r t   ( a u t o - d e t e c t i n g   b o t h   W A S D   a n d   A r r o w s )  
 

## 08.04.2026

### Bug Fixes / Architecture
- **DeepCopy (Run Mode):** Problem behoben, dass safeDeepCopy() beim Starten des Run-Modus Getter/Setter-Eigenschaften (z. B. ackgroundImage des Ufos) ignoriert hat, wodurch Sprites falsch (rote Bl�cke) gerendert wurden. safeDeepCopy nutzt nun .toDTO(), falls vorhanden, um sicherzustellen, dass die geklonten Objekte alle Inspektions-Eigenschaften beinhalten.
