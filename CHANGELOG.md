# Changelog

## [2.9.0] - 2026-02-07
### Hinzugefügt
- Spezialisierte GCS-Variablentypen: `TStringVariable`, `TIntegerVariable`, `TBooleanVariable`, `TRealVariable`, `TObjectVariable`.
- Automatische Icons (Emojis) für verschiedene Variablentypen (`📝`, `🔢`, `⚖️`, `📏`, `📦`).
- Blueprint-Stage Typ (`stage_blueprint`) für systemweite Service-Visualisierung.

### Geändert
- Variablen-Scoping: Globale Variablen und Service-Objekte werden im Editor visuell nur noch auf Stages vom Typ `blueprint` gerendert.
- `EditorStageManager` refakturiert: Nutzt nun `ProjectRegistry.getObjects()` als Single Source of Truth für die Objekt-Auflösung.
- `ProjectRegistry.getObjects()` angepasst, um das neue Blueprint-Scoping zu unterstützen.
- `project.json` aktualisiert: Alle Variablen auf spezialisierte Typen umgestellt.

## [2.8.0] - 2026-02-07
### Hinzugefügt
- **Variablen-Design Verfeinerung**: Globales Redesign aller Projekt-Variablen.
- Standard-Dimensionen für Variablen auf 6x2 (Grid-Einheiten) gesetzt.
- Vertikale Anordnung der Variablen (global und lokal) implementiert.
- Schriftfarbe für Variablen auf Schwarz (`#000000`) gesetzt.
- Hintergrundfarbe für Variablen auf helles Lila (`#d1c4e9`) angepasst für optimalen Kontrast.
- `TVariable` Komponenten-Klasse mit neuen Standardwerten aktualisiert.

## [2.7.0] - 2026-02-06
### Hinzugefügt
- **Variablen-Sichtbarkeit & Rendering**: 
    - Variablen in der `variables`-Sektion besitzen nun visuelle Eigenschaften (`x`, `y`, `width`, `height`, `isVariable: true`, `className: "TVariable"`).
    - Diese Variablen werden nun automatisch auf den Stages gerendert, ohne dass sie redundant im `objects`-Array vorhanden sein müssen.
    - Unterstützung für globale Projekt-Variablen: Diese werden auf ALLEN Stages gerendert und sind zentral verschiebbar.
- **System-Synchronisation**: 
    - `Editor`, `EditorStageManager` und `ProjectRegistry` wurden synchronisiert, um Variablen als vollwertige, renderbare Objekte zu behandeln.
    - Fix für die Persistenz: `Editor.ts` nutzt nun Objektreferenzen statt Klone für aktive Stage-Elemente, wodurch Positionsänderungen im Editor korrekt gespeichert werden.
- **Daten-Bereinigung**: 
    - Redundante `TVariable`-Einträge aus den `objects`-Arrays in `project.json` wurden entfernt.
    - Alle 8 CRM-Stages wurden auf dieses neue, saubere Format migriert.

## [Unreleased] - 2026-02-05
### Hinzugefügt
- **FlowCondition**: Neuer diamantförmiger Knoten für visuelle If/Else-Logik im Flow-Editor.
- **Canvas-Kontextmenü**: Rechtsklick auf den Flow-Canvas ermöglicht nun das direkte Erstellen von Aktionen, Bedingungen und Tasks.
- **Visual Branching**: Unterstützung für spezialisierte 'true' und 'false' Output-Anchors für verzweigte Logik.
- **Konzept: Server-Architektur**: Vorbereitung der Infrastruktur für Fly.io Deployment und Service-Blueprints.

### Behoben
- **FlowEditor**: 
    - Der Flow-Generator erkennt nun alle Aktionstypen (`http`, `db_*`, `timeout`, `custom`).
    - Korrupte Task-Einträge (`elements`, `connections`) werden automatisch beim Laden bereinigt.
    - Node-Labels folgen nun dem Format `Taskname ---- Actionname` für besseren Kontext.
- **JSON-Ansicht**: 
    - Scope-Toggle (Stage vs. Projekt) in der Toolbar implementiert, um Datenverlust beim Speichern zu vermeiden.
- **EditorViewManager**: Fehlende UI-Referenz (`this.editor`) im View-Filter korrigiert.

## [2.6.0] - 2026-02-06
### Hinzugefügt
- **Phase 3: Headless Runtime & Export**: 
    - **HeadlessRuntime**: Node.js-kompatible Engine-Laufzeit ohne DOM-Abhängigkeiten.
    - **HeadlessServer**: Express-Integration zum Mapping von HTTP-Requests auf GCS-Flows.
    - **Cloud-Export**: Automatisierte Generierung von ZIP-Bundles inklusive Dockerfile und `fly.toml` für Fly.io.
    - **Action `respond_http`**: Neue Flow-Action zum Senden von Server-Antworten.
- **Phase 4: API-Tester**: Integrierter Simulator im Inspector für den `TAPIServer`.
- **Phase 5: Datenbank-Integration**: Neue Komponente `TDataStore` und Actions (`db_save`, `db_find`, `db_delete`) für persistente Datenspeicherung (JSON/localStorage).
- **Konzept: Server-Architektur ("Service Blueprint")**: Umfassende Neuausrichtung für Stage-lose Applikationen.
    - **Blueprint-Stage**: Verwendung der Stage als System-Topologie zur Visualisierung von Services und Variablen.
    - **Live-Simulation**: Nutzung der `GameRuntime` als Server-Sandbox mit Echtzeit-Debugging im Editor.
    - **Fly.io Integration**: Docker-Ready Export und Deployment-Optimierung für Cloud-Hosting.
### [Phase 2] - CRM Frontend & Login-Flow
- **Modernisierung stage_login**: Austausch der Drag-and-Drop Slots durch die neue `TEmojiPicker`-Komponente.
- **PIN-Logik**: Implementierung des `HandleEmojiPin`-Tasks für die sequentielle PIN-Eingabe.
- **Asynchrone Authentifizierung**: Integration der `http` Action für API-Abgleiche und `store_token` für das Session-Handling.
- **Dashboard Basis**: Erstellung der `stage_main` als Navigationsziel nach erfolgreichem Login.
- **Feedback-System**: Integration der `TToast`-Komponente für Nutzer-Benachrichtigungen.
- **Implementierung Phase 1 (Basiskomponenten)**:
    - **Spezial-Actions**: `http`, `store_token` und `show_toast` vollständig in der `ActionRegistry` und im Laufzeitsystem integriert.
    - **TAPIServer**: Neue visuelle System-Komponente zur Darstellung von Backend-Diensten und API-Endpunkten.
    - **TEmojiPicker**: Interaktive UI-Komponente zur Emoji-Auswahl, bereit für das Login-Flow-System.
- **Inspector-Erweiterung**: Unterstützung für den Eigenschaftstyp `json` hinzugefügt, inklusive automatischer Rendering-Logik im `JSONInspector`.
- **Typ-Sicherheit**: Erweiterung von `TPropertyDef` um den Typ `'json'`, um komplexe Datenstrukturen wie Emoji-Listen nativ zu unterstützen.
    - **Action-Parameter**: Unterstützung für vordefinierte `options` (Dropdowns) in den Aktions-Parametern.
    - **Design-System**: Einführung von `borderRadius` als Kern-Eigenschaft für alle visuellen Komponenten.
    - **Infrastruktur**: Registrierung von `TAPIServer` und `TToast` in der zentralen `ComponentRegistry`.

## [2026-02-01] - FlowEditor Modularisierung (Phase 2)
- **FlowContextMenuProvider**: Extraktion der gesamten Kontextmenü-Logik für Knoten, Verbindungen und Canvas in einen dedizierten Service.
- **Library-Task Integration**: Vollständige Portierung der komplexen "Library-Task als Vorlage"-Logik inklusive Flowchart-Cloning und Namens-Prompt in den Provider.
- **Code-Qualität**: Reduzierung der Monolithen-Größe von `FlowEditor.ts` und Bereinigung von Schnittstellen-Inkonsistenzen in `FlowSyncHost`.

## [2026-02-01] - Robuster Action-Check & Deep-Scan
- **Strategiewechsel Action-Check**: Radikale Vereinfachung durch Umstellung von Mark-and-Sweep auf statischen Deep-Scan des gesamten Projekt-JSONs.
- **Fehlerbehebung Toggle-Bug**: Robuste objektbasierte Erkennung von Definitionen verhindert Fehlmarkierungen bei wiederholtem Check.
- **Verbesserte Task-Hints**: Detaillierte Tooltips im Flow-Editor zeigen nun Trigger-Events und Aufruferketten mit Emojis (⚡, ➡️, 🎬, 📦).
- **Bereinigung**: Redundante und fehleranfällige Pfadanalyse-Methoden in `ProjectRegistry` entfernt.

## [2.5.1] - 2026-02-01
### Hinzugefügt
- **Projektweiter Action-Check (Mark-and-Sweep)**: Grundlegende Neuentwicklung der verwaisten Element-Erkennung.
    - **Statischer Deep-Scan (v2.5.2)**: Radikale Vereinfachung der `getLogicalUsage` Methode in `ProjectRegistry.ts`. Statt Mark-and-Sweep wird nun das gesamte Projekt-JSON nach Namensreferenzen gescannt. Dies ist robuster gegenüber komplexen Aufrufpfaden.
    - **Live-Check**: Der Action-Check im Flow-Editor arbeitet nun mit Live-Daten statt mit statischen Flags, was Stale-Data Fehler eliminiert.
    - **Vollständigkeit**: Einbeziehung von Tasks, Actions UND Variablen in die Analyse. Korrektur der Erkennung von direkten Action-Aufrufen in Events und erweitertes Variablen-Scanning (CalcSteps, Property-Names).
    - **Visualisierung**: Verwaiste Elemente werden im Flow-Editor rot pulsierend markiert, wobei die logische Erreichbarkeit Vorrang vor der visuellen Präsenz hat.

## [2.5.0] - 2026-02-01
### Geändert
- **FlowEditor Modularisierung (Phase 1 & 2)**: Massive Bereinigung und Strukturierung der `FlowEditor.ts`.
    - **Modularisierung**: Extraktion der Synchronisations-Logik von Visual Flow zu JSON/Pascal in den neuen `FlowSyncManager.ts`.
    - **Bereinigung**: Entfernung veralteter Overview-Methoden (`generateEventMap`, `generateElementOverview`, `toggleActionCheckMode`).
    - **UI-Cleanup**: Entfernung redundanter Buttons (Action-Check) und Filter-Eingaben aus der Header-Leiste des Flow-Editors.
    - **Code-Qualität**: Beseitigung von redundanten Props, toten Imports und ungenutzten Hilfsmethoden; Reduzierung der Dateigröße um ca. 600 Zeilen.
- **FlowEditor Interaktion & Bugfixes**:
    - **NaN Safety & cellSize Fix**: Behebung eines kritischen Fehlers, bei dem fehlende `cellSize`-Informationen beim Laden zu `NaN`-Koordinaten führten. Automatische Reparatur betroffener Knoten implementiert.
    - **Filter-Priorität**: Korrektur der Filter-Logik in der Elementübersicht; Filter werden nun vor den lokalen/globalen Ausnahmeregeln geprüft.
    - **Inspector Log Fix**: Eliminierung von `ComponentRegistry`-Warnungen durch Einführung von `getEvents()` für Flow-Knoten und Optimierung der Typerkennung im `JSONInspector`.
    - **Inspector Delete Routing**: Korrektur der Lösch-Funktion im Inspector; Löschbefehle für Flow-Elemente werden nun korrekt an den `FlowEditor` weitergeleitet (inkl. Referenzprüfung).
    - **Scroll-Offset Korrektur**: Behebung von 'dangling' Connections und fehlerhaften Snap-Punkten durch Einbeziehung des Canvas-Scroll-Offsets.
    - **Robustes Dragging**: Bereinigung der Drag-Logik in `FlowEditor.ts`; Nutzung von `node.onMove` zur Synchronisierung von Verbindungen während der Bewegung.
- **Wiederherstellung von Overviews**:
    - **Modularisierte Restauration**: "Landkarte" und "Elementenübersicht" wurden in `FlowMapManager.ts` wiederhergestellt und modularisiert.
    - **Action-Check**: Die visuelle Überprüfung auf ungenutzte Elemente (Actions/Tasks) ist wieder verfügbar.
    - **Integration**: Nahtlose Einbindung der neuen Manager in die `FlowEditor` Toolbar und Kontext-Steuerung.


## [2.4.2] - 2026-02-01
### Behoben
- **Pascal Synchronisation**: Automatisches Update des Flow-Editors bei Code-Änderungen im Pascal-Editor.
    - Integration von `flowEditor.syncActionsFromProject()` in den `oninput`-Handler des Pascal-Editors.
    - Robustere Suche nach Aktionen über alle Stages hinweg in `FlowEditor.ts`.
- **Zirkuläre Referenzen**: Behebung fälschlicher Warnungen im JSON-Inspector.
    - **Fix (Circular References)**: Zirkularitäts-Warnungen im JSON-Inspector korrigiert (pfad-basierte Prüfung statt globaler WeakSet).
- **Fix (Event Logging)**: Variablen-Events (z.B. `onTriggerEnter`, `onTimerEnd`) werden nun korrekt im Debug-Log als Event-Einträge protokolliert.
- **Sync (FlowEditor)**: Deep Cloning bei der Synchronisation von Aktionen implementiert, um Shared References zu vermeiden.
- **Persistenz & Local Storage**: Beseitigung redundanter Einträge und Vereinheitlichung der Speicherung.
    - Umstellung aller Speicheroperationen auf den einheitlichen Key `gcs_last_project`.
    - Konsolidierung der Speicherlogik in `Editor.ts` durch Nutzung des `ProjectPersistenceService`.

## [2.4.1] - 2026-02-01
### Behoben
- **Debug-Log System**: Vollständige Wiederherstellung der Funktionalität und Sichtbarkeit.
    - **Logging-Anbindung**: Integration von `GameRuntime` (Events), `PropertyWatcher` (Variablen), `ActionExecutor` (Aktionen) und `TaskExecutor` (Tasks/Conditions) an den `DebugLogService`.
    - **Hierarchische Ansicht**: Korrekte Einrückung von Kind-Aktionen unter dem auslösenden Ereignis/Task.
    - **Filter-Logik**: Entschärfung der Typ-Filter (Unabhängigkeit der Checkboxen).
    - **Lifecycle-Fix**: Behebung eines Bugs im `EditorRunManager`, der das System beim Beenden des Run-Modus zerstörte.
    - **UI-Stabilität**: Einführung eines internen Sichtbarkeits-Flags und robusterer CSS-Steuerung.

## [2.4.0] - 2026-02-01
### Behoben
- **Stage-Editor UI**: Wiederherstellung der Toolbox und des Inspectors.
    - Korrektur der Container-IDs (`json-inspector-content`, `json-toolbox-content`) in `Editor.ts`.
    - Implementierung des fehlenden Ladevorgangs für `toolbox.json`.
    - Wiederherstellung des 'Debug Logs' Buttons durch Einführung eines `toolbox-footer` Containers und Fix der Initialisierung.
 in der modernisierten `Editor.ts`.
    - Erweiterung der Sichtbarkeitssteuerung im `EditorViewManager.ts` für die `stage`- und `flow`-Ansichten.
- **Build-Stabilität**: Erfolgreiche Verifizierung des gesamten Refactorings durch `npm run build`.

## [Refactoring] - 2026-01-31
- **Editor.ts**: Massive Modularisierung und Bereinigung. Die Datei fungiert nun als schlanker Orchestrator.
- **EditorCommandManager**: Neue Komponente für Objekt-Manipulation und Befehlsausführung (Undo/Redo Support).
- **EditorRunManager**: Neue Komponente für die Verwaltung der Game-Runtime und des Game-Loops.
- **EditorStageManager**: Neue Komponente für Stage-spezifische Operationen und Objekt-Synchronisation.
- **Trinity-Sync**: Konsolidierung der Synchronisation zwischen Stage-Editor, JSON-Code und Pascal-Sicht.
- **Build & Typ-Sicherheit**:
  - Sämtliche TypeScript-Fehler (8 Fehler in 6 Dateien) behoben.
  - `ServiceRegistry` wurde korrekt typisiert, um `any`-Inferenz zu vermeiden.
  - Fehlende `renderJSONTree`-Methode in `EditorViewManager` implementiert.
  - Syntaxfehler und verwaiste Imports in `ActionEditor.ts` und `MediatorService.ts` bereinigt.
  - Erfolgreiche Verifizierung durch `npm run build`.
- **Fehlerbehebung**: Beseitigung zahlreicher Code-Duplikate und Syntaxfehler, die durch fehlerhafte Merges entstanden waren.

## [2.3.0] - 2026-01-31
### Hinzugefügt
- **Management-Tab**: Einführung eines dedizierten Tabs zur zentralen Ressourcenverwaltung.
- **Interaktive Navigation**: Klick auf Tabellenzeilen fokussiert Objekte auf der Stage (mit Highlight-Effekt) oder öffnet den Flow-Editor.
- **Event-Präzision**: Spezialisierte Variablen (Timer, Trigger, etc.) zeigen im Inspektor nur noch ihre klassenspezifischen Events an.
- **Daten-Anreicherung**: Anzeige von X/Y-Positionen, Klassen, Typen, Zielobjekten und aktuellen Werten.
- **TTable-Komponente**: Statischer Renderer für systemweite Tabellen-Visualisierung.
- **Reaktive Synchronisation**: Kopplung des Editors an den `MediatorService`. Interaktionen auf der Stage (Selektion, Verschieben, Skalieren) triggern nun automatische Updates in allen anderen Ansichten (insbes. Management-Tab).
- **Cross-Tool Synchronisation**: Nahtloser Datenfluss zwischen JSON-, Pascal-, Action- und Flow-Editor. Änderungen in einem Tool werden sofort in allen anderen Ansichten reflektiert, ohne zirkuläre Event-Schleifen zu erzeugen (Trinity-Sync).
- **Robuste Serialisierung**: Zentralisierte `toJSON`-Logik in `TComponent` unterstützt nun verschachtelte Objekt-Pfade (z.B. `style.visible`) und automatische Kind-Serialisierung.

### Behoben
- **Stage-Bereinigung**: Korrektur der Rendering-Logik; Manager-Tabellen werden nicht mehr auf der Stage angezeigt.
- **Sanitizer-Härtung**: Automatische Entfernung transienter Management-Objekte aus Projektdaten.
- **Button-Rendering**: Zusätzliche Texte auf Buttons ("(0 Einträge)") wurden entfernt.
- **TObjectList Refactoring**: Erbt nun von `TTable`, um tabellarische Eigenschaften direkt zu nutzen.
- **Image-Sichtbarkeit**: Behebung eines Fehlers, bei dem Bilder nach Pascal-Änderungen ihre Sichtbarkeitseinstellungen verloren haben.
- **Tool-Sync Stabilität**: Flow-Editor wird nicht mehr bei eigenen Änderungen neu initialisiert.
