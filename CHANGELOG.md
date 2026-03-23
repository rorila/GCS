## [3.26.3] - 2026-03-23
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
