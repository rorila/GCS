# Changelog

## [Current] - 2026-01-18

- **Modulare Architektur (Phase 1: Lokale Scopes)**:
    - **Scoping**: Stages unterstützen nun eigene `tasks`, `actions` und `variables`. Dies erlaubt eine strikte Kapselung von Logik per Stage (z.B. Minigame-Logik).
    - **Intelligentes Routing**: Neue Logik-Elemente werden im Editor automatisch in der aktiven Stage gespeichert. Existierende globale Elemente bleiben global (Single Source of Truth).
    - **FlowEditor UX**: Der Task-Selector gruppiert Einträge nun nach Scope (Local vs Global). Die Elementeübersicht markiert lokale Komponenten visuell.
    - **Rekursives Refactoring**: `ProjectRegistry` unterstützt nun das Finden von Referenzen und Umbenennungen über alle hierarchischen Layer (Global + Local Scopes) hinweg.
    - **Runtime Sync**: `GameRuntime` synchronisiert beim Stage-Wechsel automatisch die relevanten Logik-Pakete in den `TaskExecutor`, um die korrekte Ausführung lokaler Tasks zu garantieren.
- **Improved Flow Registration**: `rebuildActionRegistry` scannt nun alle Stages nach Action-Definitionen, was die Konsistenz der Action-Palette verbessert.
- **Multi-Stage Refactoring**: `RefactoringManager.ts` unterstützt nun die projektweite Umbenennung von Tasks, Objekten und Variablen über alle Stages hinweg.
    - **Renaming Fix**: Das Umbenennen von Flow-Elementen ("Name" Property) im Inspector triggert nun korrekt das Refactoring.
- **Library Export Fix**: Task-FlowCharts werden nun auch korrekt exportiert, wenn sie in einer Stage (z.B. Splash) gespeichert sind.
- **UI Synchronisierung**: Stage-Umbenennungen im Inspector aktualisieren nun sofort das Hauptmenü.
- **FlowEditor Interaktion**: 
    - **Doppelklick-Vereinfachung**: Doppelklick öffnet nun *immer* den Editor. Die Expansions-Funktion (Shift+Click) wurde entfernt, um Konflikte zu vermeiden. Expansion ist weiterhin über das Kontextmenü möglich.
- **Stage JSON View**: 
    - **Verbesserte Injektion**: Zeigt nun stage-relevante Tasks UND deren referenzierte Actions an, um eine vollständige Ansicht zu gewährleisten.
- **Flow Storage Fix**: Tasks werden nicht mehr versehentlich in Stages "entführt", wenn sie bereits global existieren. Der Editor prüft nun zuerst auf globale Existenz vor der Speicherung.
- **Automatischer Library-Export**:
  - Tasks können nun direkt aus dem Editor in die `public/library.json` gespeichert werden (per Button im Export-Dialog).
  - Neuer Server-Endpunkt `POST /api/library/tasks` für automatisiertes Speichern ohne manuelles Copy-Paste.
- **Dialog-System Fixes**:
  - `TMemo` (Textarea) Komponente als neue Basis-Komponente implementiert.
  - Support im `DialogManager` und `Serialization` hinzugefügt (behebt den leeren Export-Dialog).
  - Datenbindung und -erfassung für Textareas korrigiert.
- **Globale Objekte (Services)**: Zentrale Komponenten (StageController, GameLoop, GameState etc.) sind nun auf JEDER Stage erreichbar, unabhängig davon, wo sie platziert wurden. Behebt Navigationsprobleme auf Neben-Stages (z.B. Impressum).
- **Runtime & Parameter Robustheit**:
  - Fix: `autoConvert` wird nun konsistent auf alle interpolierten Parameter angewendet.
  - Cleanup: Überflüssige Debug-Logs aus der Konsole entfernt.

## [Unreleased] - 2026-01-17

- **GameLoop Singleton Refactoring**:
  - `GameLoopManager` als Singleton implementiert, um Proxy-relevante Bindungsprobleme mit Arrow-Functions zu beheben.
  - Der GameLoop ist kein Stage-Objekt mehr und arbeitet zuverlässig über alle Stages hinweg.
  - Ballbewegung und Paddel-Steuerung in `project_NewTennis50.json` wiederhergestellt.
- **Stage Separation & Cleanup**:
  - `GameRuntime` führt nun beim Stage-Wechsel einen vollständigen Cleanup durch (`ReactiveRuntime.clear()`, `AnimationManager.clear()`).
  - Verhindert das "Überlaufen" von Elementen oder Animationen einer vorherigen Stage (z.B. Splash) in die neue Stage (Main).
  - **Migration `project_NewTennis50.json`**: Redundante Root-Level Objekte wurden entfernt, um die Datenintegrität des Multi-Stage-Systems sicherzustellen.
- **GameLoop Persistence & Physics Fixes**:
  - `GameRuntime.stop()` beendet nun explizit den `GameLoopManager`-Singleton, um unendliche Hintergrundläufe beim Tab-Wechsel zu verhindern.
  - `GameLoopManager.triggerBoundaryEvent` optimiert: Einführung eines `EPSILON`-Offsets beim Clamping und einer Geschwindigkeitsprüfung (Velocity Protection), um "Sticky Boundaries" und doppelte Trigger-Events zu vermeiden.
- **Fixed**:
  - `Editor.ts`: Manueller GameLoop-Handling-Code entfernt (wird nun zentral durch `GameRuntime` via `GameLoopManager` gesteuert).
  - TypeScript-Error in `Editor.ts` (Property `grid` on `GameProject`) behoben durch korrekten Zugriff via `activeStage`.

- **Multi-Stage System**:
  - Kontextsensitiver Inspector: Erkennt die aktive Stage und bindet Feld-Eigenschaften (Name, Typ, Beschreibung) dynamisch.
  - **Sichtbarkeits-Fix**: Korrekte Evaluierung von `visible`-Ausdrücken im Inspector inklusive Support für gruppierte Felder (`renderInlineRow`).
  - **Cache-Busting**: Konfigurationsdateien werden nun mit Zeitstempel geladen, um Browser-Caching zu verhindern.
  - **GameRuntime Build-Fix**: Ergänzung fehlender Methoden (`getObjects`, `triggerRemoteEvent`, etc.) für konsistenten Build.
  - **Stage-spezifische Grid-Einstellungen:** Jede Stage verwaltet nun ihr eigenes Raster (Farbe, Größe, Sichtbarkeit), ohne andere Stages zu beeinflussen.
  - **Animations-Support pro Stage:** Start-Animationen und deren Dauer/Easing können nun für jede Stage individuell gesetzt werden.
  - **Playback-Support:** GameRuntime lädt nun automatisch die Objekte und Konfiguration der als `activeStageId` markierten Stage.
  - **Splash-Transition Fix:** Der Editor aktualisiert nun zuverlässig die Objekt-Referenzen und das Hintergrundraster beim Wechsel von Splash- zu Main-Stage.
  - **Log-Cleanup:** Entfernung redundanter Console-Logs ("PeriodicSync", "Timer Interval") für eine saubere Developer-Console.
- **TStageController**: Neue Systemkomponente zur Steuerung von Stage-Wechseln via Actions/Flow.
- **Stage-spezifische Flow-Diagramme**:
  - Jede Stage kann nun eigene Landkarten, Elementeübersichten und Tasks besitzen.
  - **Diagramm-Isolation**: Flow-Diagramme werden nun strikt pro Stage isoliert. Globale Tasks wurden in spezifischen Stages ausgeblendet.
- **UI View Management**: Automatischer Wechsel zur Stage-Ansicht beim Laden eines Projekts oder Wechseln der Stage.
- **Daten-Isolation**: JSON- und Pascal-Ansichten bieten nun Dropdowns, um zwischen aktiver Stage und Gesamtprojekt umzuschalten.
  - Der Flow-Selector im Editor gruppiert Einträge nun nach Stage und Global.
  - Automatischer Sync stellt sicher, dass alle stage-spezifischen Tasks konsistent bleiben.
  - Abwärtskompatibilität: Bestehende Diagramme werden als "Global" behandelt.

### TStageController Komponente 🎬
- **Neue Komponente:** `TStageController` - platzierbare Komponente für zentrale Stage-Verwaltung.
- **Stage-Typen:** `main` (HauptStage mit Meta), `splash` (Intro), `standard` (alle weiteren).
- **HauptStage:** Nur eine pro Projekt mit `gameName`, `author`, `description`.
- **Methoden:** `nextStage()`, `previousStage()`, `goToStage(stageId)`, `goToMainStage()`
- **Events:** `onStageChange`, `onAllStagesCompleted`, `onSplashFinished`

### Export & Standalone Support 📦
- **Standalone Player:** Unterstützt nun komplett das Multi-Stage System (Splash -> Main) und nutzt die korrekten Grid-Einstellungen pro Stage.
- **GameExporter:** Exportiert Stages als Teil der Projektstruktur. Global FlowCharts werden bereinigt (da Tasks synchronisiert sind), Stage-Flows bleiben erhalten.
- **Multiplayer:** Funktioniert transparent mit Stage-Wechseln (via Task-Broadcast). `navigate_stage` wird auf allen Clients ausgeführt.
- **Fix:** `TStageController` ist im Standalone-Player nun unsichtbar (war zuvor fälschlicherweise sichtbar).
- **Fix:** Hintergrund-Update im Standalone-Player korrigiert (nutzt nun dynamisch die `activeStage`-Eigenschaften statt der Projekt-Defaults).
- **Fix:** `Stage` Interaktionen im Editor (Run-Mode) funktionieren wieder. Event-Handler (`onClick` etc.) werden nun korrekt an die `GameRuntime` weitergeleitet.
- **Improved:** `GameRuntime` Event-System modernisiert. `handleEvent` verarbeitet nun generisch alle Property-basierten Events und unterstützt optionales Daten-Payload (für Multiplayer Sync).
- **Refactoring:** `TStageController` ist jetzt die zentrale Stage-Verwaltung. `GameRuntime` nutzt den `TStageController.setOnStageChangeCallback()` für Stage-Wechsel statt manueller Logik. Dies vereinfacht den Code und macht Stage-Wechsel zuverlässiger.

## [Previous] - 2026-01-16

### Zwei-Stage Architektur (Splash -> Game) 🎭

### Refactoring: FlowCharts als Single Source of Truth 🚀
- **Architektur:** FlowChart-Elemente (Actions) speichern jetzt nur noch Links (`isLinked: true`) auf globale Action-Definitionen. Die vollständigen Logik-Daten liegen ausschließlich in `project.actions`.
- **Primat der FlowCharts:** Flow-Diagramme sind nun die definitive "Single Source of Truth" für die Aufgaben-Logik.
- **Automatischer Sync:** Alle Tasks im Projekt werden vor dem Speichern oder Exportieren (`HTML/JSON`) automatisch aus den Diagrammen regeneriert (`syncAllTasksFromFlow`).
- **UI-Schutz:** Im `TaskEditor` ist die `actionSequence`-Liste schreibgeschützt (🔒), wenn ein Flow für den Task existiert. Ein Tooltip informiert über das Primat des Flow-Editors.
- **Automatische Migration:** Bestehende Projekte werden beim Öffnen im Flow-Editor automatisch in das neue Link-Format migriert (Single Source of Truth).
- **Copy-Logik:** "Embed Action (Copy)" im Kontextmenü erstellt nun eine echte 1:1 Kopie als neue globale Action mit eindeutigem Namen (z.B. `Original_Copy1`).
- **Action-Editor:** Änderungen im Action-Editor aktualisieren direkt die globale Definition und halten den FlowChart-Node synchron.
- **Z-Index Schutz:** `updateGlobalActionDefinition` schützt nun valide Action-Definitionen davor, durch minimale Link-Daten überschrieben zu werden.
- **TVideo Komponente:** Neue Komponente für HTML5 Video-Wiedergabe mit Support für `autoplay`, `loop`, `muted` und `playbackRate`. 🎬
- **TSplashScreen Komponente:** Spezialisierte Intro-Komponente mit konfigurierbarer `duration` und `onFinish` Event. 🚀
- **Media Kategorie:** Neue Kategorie in der Editor-Toolbox für Bilder und Videos.
- **Gzip Export & Upload:** Unterstützung für komprimierte Projektdaten (.json und .html). 📦

### Fixed
- **LocalStorage Persistenz:** Änderungen im JSON-Editor werden nun korrekt ins LocalStorage übernommen. Vorher wurden FlowChart-Elementdaten nicht mit `project.actions` synchronisiert.

## [Previous] - 2026-01-15

### Added
- Debug-Logging für `AnimationManager` und `JSONInspector` (temporär während Debugging). 🎾 ✨

### Fixed
- **Inspector Events:** Fix für fehlende Anzeige des `onClick`-Events bei Buttons. `TPanel` mit `_isRowWrapper` wird nun korrekt als eigenständiges Element behandelt und nicht mehr fälschlicherweise als Input mit dem vorherigen Label gruppiert. 🎾 ✨
- **Ball Bewegung:** Problem behoben, bei dem der Ball während der Start-Animation bereits Boundary-Events auslöste. `TGameLoop` überspringt nun Physik- und Boundary-Checks für Sprites, die gerade animiert werden (`isAnimating`). 🎾 ✨
- **Inspector-Display Fix:** Beim Laden des Projekts werden nun auch die Stage-Animationseigenschaften (`startAnimation` etc.) korrekt wiederhergestellt, sodass sie im Inspector sichtbar bleiben. 🎾 ✨
- **Start-Animation Persistence:** Die Einstellungen für Start-Animationen (`startAnimation`, `duration`, `easing`) werden nun korrekt vom Inspektor in das Projekt-File und in die Editor-Stage übertragen und somit gespeichert. 🎾 ✨
- **Fix**: Rendering-Bug behoben, bei dem Objekte im "Run"-Modus nicht aktualisiert wurden (Fix der doppelten GameLoop-Initialisierung).
- **Refactor**: Editor-Initialisierung bereinigt, `GameRuntime` übernimmt nun die Kontrolle über den Render-Loop.
- **Cleanup**: Debug-Logs und unnötige Kommentare entfernt.
- **Animation Robustheit:** `AnimationManager` setzt nun das `isAnimating`-Flag auch beim Abbrechen von Tweens (`cancelTween`) zuverlässig zurück, um die Physik-Reaktivierung zu garantieren. 🎾 ✨
- **Grid Bounds:** Fix für fehlerhafte Grenzerkennung im GameLoop. Der Zugriff auf `cols` und `rows` unterstützt nun auch verschachtelte Grid-Konfigurationen (`grid.cols`/`grid.rows`), was verfrühte "Bottom-Hits" bei 24 Zeilen (statt 40) verhindert. 🎾 ✨
- **Game Runtime:** Fehlende Check-Abfrage für `moveTo` in `GameRuntime.ts` hinzugefügt, um Abstürze bei nicht-visuellen Objekten zu vermeiden. 🎾 ✨
- **Fix**: Data Persistence im Action Editor korrigiert (Parametereingaben werden jetzt gespeichert).
- **Fix**: Rendering-Performance im Run-Mode verbessert (Doppelten Render-Loop entfernt, "Zappeln" behoben).
- **Fix**: Syntax-Fehler im `JSONDialogRenderer` behoben, der den Action-Editor blockierte.
- **Improved**: `Stage`-Klasse um fehlende Animations-Eigenschaften erweitert.
- **Improved**: `TDebugLog` zeigt nun Methoden-Details (Parameter) für `call_method`-Actions an. 🎾 ✨
- **Improved**: `TaskExecutor` loggt nun Fehler bei der Action-Ausführung explizit in den Debug-Viewer ("ERROR"-Event). 🎾 ✨
