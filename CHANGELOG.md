# Changelog

## [1.3.8] - 2026-01-23

### Fixed
- **TImage/Splashscreen nicht sichtbar**: Behebung eines kritischen Bugs, bei dem Bilder (`backgroundImage`, `src`) auf TImage- und TSprite-Komponenten im Run-Mode nicht angezeigt wurden.
    - **Ursache**: Der Spread-Operator `{...obj}` auf Proxy-Objekten (ReactiveRuntime) kopiert keine getter-basierten Properties.
    - **Lösung**: Explizites Kopieren von `backgroundImage`, `src`, `objectFit` und `imageOpacity` in `GameRuntime.getObjects()`.
- **Endlos-Rendering im Run-Tab**: Behebung von Performance-Problemen durch unnötige Render-Aufrufe.
    - **Ursache**: Die Game-Loop renderte jeden Frame, auch wenn sich nichts geändert hat.
    - **Lösung**: Dirty-Flag Logik in `GameLoopManager.loop()`: Rendering nur bei aktiven Animationen (`hasActiveTweens()`) oder bewegenden Sprites (`velocityX/Y !== 0`).
- **Export: 0 Objekte nach Stage-Wechsel**: Behebung eines kritischen Bugs im HTML-Export, bei dem nach dem Stage-Wechsel (z.B. Splash → Main) keine Objekte geladen wurden.
    - **Ursache**: Der dynamische Import von `ProjectRegistry` funktioniert nicht in gebundeltem HTML (`runtime-standalone.js`).
    - **Lösung**: Direkter Zugriff auf `project.stages` in `handleStageChange()` statt dynamischem Import.
    - **Hinweis**: Bei Änderungen an der Runtime muss `npm run bundle:runtime` ausgeführt werden, bevor ein neuer Export gemacht wird.

## [1.3.7] - 2026-01-22

### Fixed
- **Run-Mode Regressionen**: Behebung kritischer Fehler, die durch die neue Daten-Synchronisation eingeführt wurden.
    - **Infinite Loop Fix**: Der `AnimationManager` Ticker in `Editor.ts` wird nun robust gestoppt, sobald der Run-Mode beendet wird oder ein echter `GameLoop` übernimmt. Dies verhindert unnötige CPU-Last und "Geister-Loops".
    - **Stage Visibility Fix**: Beim Verlassen des Run-Modes (Stop) wird die Stage-Ansicht nun explizit neu geladen (`loadStage`), um sicherzustellen, dass die Editor-Objekte sauber wiederhergestellt werden und die Runtime-Proxies entfernt sind.
- **Run-Mode Data Sync (Improvements)**:
    - Implementierung von `syncStageObjectsToProject` in `Editor.ts`, um sicherzustellen, dass Änderungen im Editor (z.B. neue Bilder) vor dem Start der Runtime korrekt in das Projekt-JSON übernommen werden.
- **Image Browser Fix**: Korrektur der Datenbindung in `dialog_image_browser.json` (Syntax: `${dialogData.images}`), damit die rekursive Dateiliste im Dialog korrekt angezeigt wird.
- **Splashscreen Rendering Fix**: Behebung von Problemen mit Bildern auf dem Splashscreen.
    - **Editor**: `TSplashScreen` (und `TPanel`) unterstützen nun verschachtelte Kinder (`children`) im JSON und erlauben Drop-In-Reparenting.
    - **Runtime**: Objekte werden wieder mit rekursiver Z-Index-Berechnung gerendert (`Parent.z + Child.z`), was sicherstellt, dass Kinder auf High-Z Layern (wie Splash) sichtbar bleiben.

## [1.3.6] - 2026-01-22

### Fixed
- **Splash Screen Image Visibility**: Behebung eines Problems, bei dem Bilder mit Sonderzeichen oder Leerzeichen im Dateinamen im Splash-Screen nicht geladen wurden.
    - `Stage.ts`: Implementierung von URL-Encoding (`encodeURIComponent`) für Bildpfade.
    - `Stage.ts`: Zusätzliche Diagnose-Logs (`SUCCESS` / `ERROR`) für jeden Ladeversuch eines Bildes.
    - `Stage.ts`: Automatisches Fallback-Handling für Pfade mit/ohne führenden Slash.
- **GameLoop Synchronization**: Behebung von Konflikten zwischen dem Editor-Fallback-Ticker und der echten `TGameLoop`.
    - Der Fallback-Ticker wird nun automatisch gestoppt (`stopAnimationTicker`), sobald eine echte `GameLoop` Komponente erkannt wird.
- **Button Interaction**: `TButton` Komponenten im Run-Mode sind nun IMMER klickbar.
- **Runtime Robustness**: Verbesserte Sicherheitsprüfung in `Editor.ts` beim Beenden des Spiels (`stop()`).

### Changed
- **Log-Cleanup**: Deaktivierung der verbose Hydrierungs-Logs in `Serialization.ts`.

## [1.3.5] - 2026-01-22

### Added
- **Task & Action Inspector**: Implementierung einer vollständigen Inspector-Unterstützung für Tasks und Aktionen im Flow-Editor. Eigenschaften wie Name, Typ, Ziel, Parameter und Trigger-Modus können nun direkt inspiziert und bearbeitet werden.
- **Inspector Schemas**: Einführung von `inspector_task.json` und `inspector_action.json` für deklarative UI-Definitionen.
- **Lokalisierung**: Inspector-Labels für Tasks und Aktionen wurden ins Deutsche übersetzt und mit Tooltips (Hints) versehen, um die Verständlichkeit zu verbessern.
- **Layout-Optimierung**: Eigenschaften im Inspector werden nun platzsparend nebeneinander (Label links, Input rechts) dargestellt.
- **Task-Sichtbarkeit**: Im Inspector kann nun zwischen globaler (Projekt) und lokaler (Stage) Sichtbarkeit für Tasks gewechselt werden.
- **Service-Listing**: `TSelect` im Inspector unterstützt nun die automatische Auflistung verfügbarer Services.

### Fixed
- **Inspector Dropdowns**: Behebung eines Fehlers, durch den Auswahlfelder (z.B. Task-Auswahl, Ziel-Objekte) im neuen Inspector leer blieben. Die Datenquellen werden nun korrekt angebunden und Emojis dargestellt.
- **Auswahl-Binding**: Korrektur der Datenbindung für Dropdowns, sodass sowohl `selected` als auch `selectedValue` unterstützt werden. Dies behebt das Problem, dass keine Auswahl möglich war.
- **2-Wege-Binding**: Namensänderungen im Inspector werden nun sofort im Flow-Diagramm und im gesamten Projekt (via Refactoring) übernommen.
- **Mapping-Fix**: Fehlerhafte Zuordnung in `inspector_task.json` und `inspector_action.json` behoben (`Name` Property statt `TaskName`/`ActionName`), was die Bearbeitung des Namens verhinderte.
- **FlowTask Name**: Korrektur der Namensauflösung für Flow-Elemente, um leere Namen im Inspector zu verhindern.
- **Multiplayer-Default**: Der Standardwert für neue Tasks im Multiplayer-Modus wurde auf `Synchron` (local-sync) geändert.
- **Full-Property-Binding**: Vollständige Unterstützung für die Bearbeitung von Name, Beschreibung, Sichtbarkeit und Trigger-Modus im Inspector, mit direkter Synchronisation in die JSON-Projektdaten.
- **Lokale-Tasks-Persistenz**: Behebung eines Fehlers, durch den Änderungen an lokalen Tasks (Description, Multiplayer-Modus) nicht gespeichert wurden, da nur im globalen Scope gesucht wurde.
- **JSON-Vollständigkeit**: Es wird nun sichergestellt, dass Standardwerte (wie `triggerMode: "local-sync"`) auch dann explizit in die JSON-Datei geschrieben werden, wenn sie noch nicht gesetzt waren. Dies garantiert konsistente Daten für externe Player.
- **Task-Lookup-Fix**: Korrektur der `getTaskDefinition`-Logik, damit Eigenschaften von lokalen Tasks (Stage-Level) korrekt gefunden und aktualisiert werden können. Zuvor wurden Änderungen an lokalen Tasks oft ignoriert.
- **Erweiterte-Initialization**: Sicherstellung, dass auch lokale Tasks immer vollständig initialisiert werden (inklusive `params: []` und `description: ""`), damit die JSON-Struktur in allen Ansichten konsistent ist.
- **Action-Task-Association**: Behebung eines Fehlers, durch den Aktionen in der Stage-Ansicht nicht korrekt den lokalen Tasks zugeordnet wurden.
- **Code-Konsolidierung**: Zusammenführung redundanter Task-Suchlogiken in eine zentrale Methode (`getTaskDefinitionByName`), um Inkonsistenzen und "doppelte Methoden" zu vermeiden.
- **Projekt-Kompatibilität**: Korrektur der `activeStageId` in `project_NewTennis50.json` von einer Unter-Stage ('Impressum') auf die Main-Stage ('main'), damit der Run-Tab korrekt startet.

### Changed
- **FlowAction**: Interne Logik erweitert, um Lese-/Schreibzugriff auf globale Aktionsdefinitionen direkt über Getters/Setters zu ermöglichen.
- **JSONInspector**: Logik verbessert, um JSON-Definitionen mit dynamischen Code-Eigenschaften zu kombinieren (Merge-Strategie) und Labels automatisch zu rendern.

## [1.3.4] - 2026-01-21

### Changed
- **Projekt-Reset**: Das Projekt wurde auf die Login-Stage zurückgesetzt. Alle anderen Stages und nicht benötigte Variablen wurden entfernt, um Komplexität zu reduzieren und einen sauberen Neuanfang zu ermöglichen.

## [1.3.3] - 2026-01-21

### Fixed
- **FlowEditor Task-Liste**: Im Flow-Tab werden nun alle im Projekt oder in der Stage definierten Tasks im Dropdown-Menü angezeigt, auch wenn für diese noch kein Flow-Diagramm erstellt wurde. Dies ermöglicht den einfachen Wechsel zu jedem Task direkt aus der Flow-Ansicht.

## [1.3.2] - 2026-01-21

## [1.3.1] - 2026-01-20

### Fixed
- **JSON Stage-Isolation**: Behebung eines Datenverlusts in der isolierten Stage-Ansicht des JSON-Editors. Lokale Aktionen und Tasks werden nun korrekt erhalten und mit referenzierten globalen Elementen gemergt.
- **Multi-Stage Refactoring**: `RefactoringManager` wurde erweitert, um Aktionen und Tasks projektweit über alle Stages hinweg umzubenennen (behebt verwaiste Links bei lokalen Definitionen).
- **Mapping-Vervollständigung**: Korrekte Zuordnung für `set_variable`, `service` und `calculate` Actions in der internen Synchronisations-Logik.

## [1.3.0] - 2026-01-20

### Fixed
- **Action Editor Persistence**: Kritischer Fix für Datenverlust beim Speichern von Actions. `collectFormData` stellt nun sicher, dass alle Eingaben (z.B. Increment Amount) korrekt in das Modell übernommen werden.
- **Calculation Step Groups**: Behebung von Daten-Kollisionen in Berechnungs-Listen durch Einführung eindeutiger Input-Namen (`calcStep_${index}`).
- **Stale JSON View**: JSON-Anzeige im Editor aktualisiert sich nun sofort nach dem Speichern einer Action (Wiring von `onObjectUpdate` korrigiert).
- **ReferenceError Fix**: Absturz beim Öffnen des Action-Editors durch fehlerhafte Variablen-Referenz (`description`) in `dialog_action_editor.json` behoben.

### Added
- **TMemo Support**: Integration der mehrzeiligen Textarea-Komponente in den Dialog-Renderer für bessere Action-Beschreibungen.
- **Scoping Robustness**: Erweiterte Parameter-Injektion für Dialog-Expression-Evaluation.



## [1.2.0] - 2026-01-20

### Added
- **TShape Content Support**: Direkte Eigenschaft für `text` (Emojis) und `contentImage` (Bilder) in `TShape` Komponenten integriert.
- **Image Upload**: Komfortabler ⬆️- **TShape Erweiterung**: Support für Text/Emojis und Bilder direkt im Shape.
- **TShape UI**: Upload-Button für lokale Bilder im Inspector.
- **TShape Rendering**: 
    - Umstellung auf SVG-ViewBox für flüssiges Resizing.
    - Standardmäßig transparente Füllung mit blauem Rahmen.
    - Proportionales Resizing für Kreise (bleiben immer rund).
    - Echtzeit-Feedback der Form während des Ziehens.
- **Fehlerbehebungen**: 
    - TShape-Sichtbarkeitsproblem durch Logik-Konflikt mit TLabel behoben.
    - `zIndex` Serialisierung in `Serialization.ts` korrigiert.
    - Hit-Testing für transparente Shapes in `Stage.ts` verbessert (Klick-Bereich optimiert).
    - Fehlerhafte Binding-Anzeige (`${...}`) im Inspector für Farbfelder und Checkboxen behoben.
    - Quadratischen CSS-Rahmen um `TShape`-Objekte entfernt (nutzen jetzt nur noch SVG-Strokes).
    - Inspector-Labels für `TShape` auf Deutsch übersetzt für bessere Klarheit.
- **Robustness (Fix)**: Sichtbarkeit der Shapes beim ersten Platzieren garantiert durch direkte Koordinatenberechnung aus dem Modell.
- **Emoji-Login Refactoring**: Vereinfachung der `login_stage.json` durch direkte Nutzung der `TShape.text` Eigenschaft (keine verschachtelten `TLabel` mehr nötig).
- **Variables Enhancement**: Support für `value` Property (aktueller Wert) neben `defaultValue` implementiert. 
    - Inspector zeigt nun den aktuellen Wert an.
    - Variable Editor hat neues Feld "Aktueller Wert".
- **Action Editor UX**: Dynamische Labels für "Increment" und "Negate" Actions. 
    - **Variables Simplified**: Wenn eine Variable das Ziel von "Increment" ist, wird nun ein einfaches Eingabefeld für den Betrag angezeigt (Default: 1), ohne unnötige Property-Listen.
- **Runtime Increment**: `ActionExecutor` unterstützt nun `increment` und `negate` direkt auf Variablen (Target = Variablenname, Property = `value`).

## [1.1.0] - 2026-01-20

### Added
- **TShape Komponente**: Neue Basiskomponente für geometrische Formen (Kreis, Rechteck, Dreieck, Pfeil).
- **Interaktives Drag & Drop**: Erweitertes Interaktionsmodell mit Support für Verschiebemodus ('move') und Kopiermodus ('copy').
- **Visuelles Feedback**: Neue `shake` Action für Schütteleffekte bei fehlerhaften Eingaben.
- **Emoji-Login Stage**: Vollständig konfigurierte `login_stage.json` mit barrierefreier PIN-Eingabe.

### Modified
- **Editor-Integration**: `TShape` wurde zur Toolbar hinzugefügt und das Rendering in der Stage für Geometrie-Formen (SVG-basiert) implementiert.
- **Renderer-Optimierung**: `GameRuntime.getObjects()` liefert nun eine flache Liste mit absoluten Koordinaten für korrektes Rendering von Kind-Elementen. `player-standalone.ts` unterstützt nun das rekursive Objektrendering.

## [1.0.1] - 2026-01-20 (Archiviert)

- **GCS Spieleplattform Integration**:
    - **Plattform-Einstieg**: `player.html` dient nun als schlanker Bootstrapper, der automatisch das Plattform-Projekt (`/platform/project.json`) über die GCS-Runtime lädt.
    - **Multi-Stage Runtime Support**: `UniversalPlayer` (`player-standalone.ts`) wurde robust gegenüber Multi-Stage-Projekten gemacht. Er erkennt nun automatisch das `stages[]`-Array und wählt die passende Start-Stage inklusive korrekter Grid-Skalierung.
    - **Barrierefreier Emoji-Login**:
        - **Lesebefreiter Modus**: Der Login-Prozess wurde so umgestaltet, dass er ohne Namenseingabe (Lesen/Schreiben) funktioniert. Die Authentifizierung erfolgt ausschließlich über die Emoji-PIN.
        - **Backend-Update**: Der `/api/platform/login` Endpunkt identifiziert Nutzer nun primär über den `authCode`.
        - **Emoji-Keyboard**: Erweitertes Keyboard in der Login-Stage mit allen Symbolen für Superadmins und Testnutzer sowie einer Reset-Funktion (❌).
    - **Login UI Layout (Match Screenshot 2)**: Das Login-Layout wurde für ein 40x30 Grid optimiert. Titel und PIN-Anzeige sind zentriert, das Keyboard ist in einem sauberen 2-Zeilen-Grid angeordnet, und Buttons nutzen moderne Styles (abgerundete Ecken, kräftige Farben).
    - **Runtime-Fixes**: Problem mit doppelten Pfad-Präfixen (`vv1.0.0.js.js`) und Skalierungs-Abstürzen bei fehlenden Grid-Definitionen behoben.
- **Infrastruktur & Port-Optimierung**:
    - **Port-Umstellung auf 8080**: Der Game-Server und alle Client-Komponenten wurden von Port 3000 auf Port 8080 umgestellt.
    - **Betroffene Komponenten**: Backend (`server.ts`), Docker-Konfiguration, Fly.io Deployment, Frontend-Proxy (`vite.config.ts`), `NetworkManager`, `MultiplayerManager` und `TGameServer`.
    - **Tooling**: `restart_servers.bat` und `TESTING.md` aktualisiert.
    - **ImageService**: Basis-URL für API-Anfragen auf Port 8080 angepasst.
- **Async Runtime & HTTP Evolution**:
    - **Asynchrones Refactoring**: Die gesamte Ausführungskette (`TaskExecutor` -> `ActionExecutor` -> `GameRuntime.handleEvent`) wurde auf `async/await` umgestellt. Dies behebt Race Conditions bei Netzwerk- oder Animations-gesteuerten Logikketten.
    - **HTTP Body Support**: Die `http` Action unterstützt nun Request-Bodies (POST, PUT, PATCH) mit automatischer Interpolation von Variablen im Body und dem Header `Content-Type: application/json`.
    - **HTTP Fehlerbehandlung**: Verbesserte Protokollierung von HTTP-Fehlern (Status & Error-Text) im Runtime-Log und in Ergebnisvariablen.

- **Modulare Architektur (Phase 1: Lokale Scopes)**:
    - **Scoping**: Stages unterstützen nun eigene `tasks`, `actions` und `variables`. Dies erlaubt eine strikte Kapselung von Logik per Stage (z.B. Minigame-Logik).
    - **Intelligentes Routing**: Neue Logik-Elemente werden im Editor automatisch in der aktiven Stage gespeichert. Existierende globale Elemente bleiben global (Single Source of Truth).
    - **FlowEditor UX**: Der Task-Selector gruppiert Einträge nun nach Scope (Local vs Global). Die Elementeübersicht markiert lokale Komponenten visuell.
    - **Rekursives Refactoring**: `ProjectRegistry` unterstützt nun das Finden von Referenzen und Umbenennungen über alle hierarchischen Layer (Global + Local Scopes) hinweg.
    - **Runtime Sync**: `GameRuntime` synchronisiert beim Stage-Wechsel automatisch die relevanten Logik-Pakete in den `TaskExecutor`, um die korrekte Ausführung lokaler Tasks zu garantieren.
- **Modulare Architektur (Phase 3: Variable Scopes & Visibility (Runtime & UI))**:
    - UI für Variable-Scopes (Global/Local) und Sichtbarkeit (isPublic) implementiert.
    - Variable Context Proxy in `GameRuntime` verfeinert für korrekte Scoping-Präzedenz (Local > Global).
    - Cross-Stage Variablen-Zugriff via `StageName.VarName` implementiert (Read-only, nur Public).
    - Stage-Inheritance unterstützt nun das Merging von lokalen Variablen.
- **Improved Flow Registration**: `rebuildActionRegistry` scannt nun alle Stages nach Action-Definitionen, was die Konsistenz der Action-Palette verbessert.
- **Multi-Stage Refactoring**: `RefactoringManager.ts` unterstützt nun die projektweite Umbenennung von Tasks, Objekten und Variablen über alle Stages hinweg.
    - **Renaming Fix**: Das Umbenennen von Flow-Elementen ("Name" Property) im Inspector triggert nun korrekt das Refactoring.
    - **Renaming Fix**: Das Umbenennen von Flow-Elementen ("Name" Property) im Inspector triggert nun korrekt das Refactoring.
- **Stage Templates & Vererbung (Phase 2)**:
  - **Stage-Typen**: Stages können nun als `template` definiert werden (Blaupausen für Level-Layouts).
  - **InheritsFrom**: Stages können von einer anderen Stage erben.
  - **Rekursive Auflösung**: `GameRuntime` merged Objekte, Tasks und Actions aus der gesamten Vererbungskette (Stage -> Template -> Template -> ...).
  - **Editor-Ghosting**: Geerbte Objekte werden im Editor halbtransparent ("Ghosted") dargestellt und sind standardmäßig schreibgeschützt.
  - **Override-Logik**: Änderungen an einem geerbten Ghost-Objekt materialisieren dieses sofort als lokale Kopie in der aktiven Stage ("Copy-on-Write").
  - **Library-Integration**: `library.json` unterstützt nun `templates`, die direkt beim Erstellen neuer Stages verwendet werden können ("Neu aus Template...").
  - **Single Source for Templates**: Templates in the Library dienen als Blaupause für neue Levels.
  - **Unique Object IDs**: Beim Erstellen aus einem Template ("New from Template") werden Objekt-IDs nun automatisch regeneriert, um Kollisionen zu vermeiden und das unabhängige Editieren sicherzustellen.
  - **Template Units**: Templates in `library.json` nutzen nun korrekt Cell-Units (statt Pixel), um massive Skalierungsfehler zu vermeiden.
  - **Inspector Live-Update Fix**: Korrektur in `Editor.ts`, damit für Standard-Stages (auch Template-basierte) die echten, mutablen Objekte bearbeitet werden statt unsichtbarer Clones. Behebt das Problem, dass Änderungen im Inspector keine sichtbaren Auswirkungen auf der Stage hatten.
  - **Save as Template**: Neue Funktion im Stage-Menü ("Als Template speichern"), um die aktuelle Stage (inklusive aller Objekte und Grid-Einstellungen) als globales Template in die Library zu exportieren/upzudaten. Ermöglicht das Anpassen vorhandener Templates.
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

## [Unreleased]
- **Feature**: Reaktive Variablen implementiert. Variablen können nun Events (`onValueChanged`, `onValueEmpty`), Schwellenwerte (`Threshold`) und Trigger-Werte definieren, die automatisch Tasks ausführen.
- **UI**: Neuer Variablen-Editor mit Tab-Layout und erweiterten Konfigurationsmöglichkeiten.
- **Runtime**: `GameRuntime.createVariableContext` überwacht Variablenänderungen und führt konfigurierte Event-Tasks aus.
 - 2026-01-17

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
- **Fix**: Problem behoben, bei dem die Statusbar bei `align: bottom` ausserhalb des sichtbaren Bereichs platziert wurde. (Ursache: Verwechslung von Pixel- und Grid-Einheiten im Editor).
- **Feature**: "Save Stage as Template" implementiert. Ermöglicht das Speichern kompletter Stages als Vorlage.
- **Fix**: Problem behoben, bei dem der Inspector Änderungen nicht live auf der Stage aktualisierte (Klon-Problem behoben).
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

## Reaktive Variablen (Reactive Variables)
Das System unterstützt nun reaktive Variablen, die bei Werteänderungen automatisch Logik (Tasks) ausführen können.

### Konfiguration
- **onValueChanged**: Task wird ausgeführt bei jeder Werteänderung.
- **onValueEmpty**: Task wird ausgeführt, wenn der Wert `null`, `undefined` oder `""` (leerer String) ist. **Hinweis**: `0` gilt NICHT als leer.
- **Thresholds (Schwellenwerte)**: Für numerische Variablen.
  - `onThresholdReached`: Wert erreicht Schwellenwert (Übergang von `<` zu `>=`).
  - `onThresholdLeft`: Wert fällt unter Schwellenwert (Übergang von `>=` zu `<`).
  - `onThresholdExceeded`: Wert überschreitet Schwellenwert (Übergang von `<=` zu `>`).
- **TriggerValues**: Für exakte Übereinstimmungen (String/Number).
  - `onTriggerEnter`: Wert wird gleich dem Trigger-Wert.
  - `onTriggerExit`: Wert ist nicht mehr gleich dem Trigger-Wert.

### Implementierung im Runtime
Die `GameRuntime` nutzt einen Proxy im `createVariableContext`, der alle Schreibzugriffe (`set`) abfängt, Änderungen analysiert und die entsprechenden Tasks via `TaskExecutor` ausführt.

### UI
Der Variablen-Editor (`variable_editor.json`) nutzt `TSelect` mit `source="tasks"`, um verfügbare Tasks für die Events anzubieten.

