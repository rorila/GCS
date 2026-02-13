## [v2.16.23] - 2026-02-13
### Added
- Detaillierte Trace-Logs für den Flow-Synchronisationsprozess in `FlowEditor.ts`, `FlowSyncManager.ts` und `Editor.ts`.
### Fixed
- Sofortige JSON-Synchronisation: `Editor.ts` aktualisiert nun bei Mediator-Events (`DATA_CHANGED`) alle Sichten (`refreshAllViews`), was unmittelbare Sichtbarkeit im JSON-Editor nach Änderungen im Flow-Editor gewährleistet.
- **Inline-Action Fix**: Die `DataAction1` im Task `AttemptLogin` wurde von einer Inline-Action in eine verlinkte Action umgewandelt und modularisiert, um die korrekte Darstellung im Flow-Editor sicherzustellen.
- **API Simulation Fix**: `StandardActions.ts` liest nun `requestId` korrekt aus `vars.eventData`.
- **DataAction URL Fix**: `DataAction1` globalisiert, damit URL-Parameter korrekt aufgelöst werden.
- **ActionApiHandler Robustness**: Fallback-Logik implementiert, die Query-Parameter (`code`, `pin`, `authCode`) direkt aus dem Pfad parst, falls das `query`-Objekt fehlt. Dies behebt Login-Probleme bei fehlender Editor-Unterstützung für URL-Parsing.
- **TaskExecutor Resolve Fix**: Actions werden nun auch korrekt aufgelöst, wenn sie nicht vom Typ `action` sind (z.B. `data_action`), indem primär auf den Namen geprüft wird.

## [v2.16.22] - 2026-02-13
### Fixed
- **FlowSyncManager Persistence Critical Fix**:
  - Behebung eines kritischen Fehlers in `syncAllTasksFromFlow`, bei dem die Map-Struktur der FlowCharts falsch adressiert wurde, was zum Leeren der `actionSequence` führte.
  - **Metadata Merging**: Verlinkte `DataAction`-Knoten laden nun beim Synchronisieren ihre vollständigen Metadaten (URL, Method etc.) aus dem Projektmodell in das Sequenz-Item.
- **FlowDataAction.ts Logic**:
  - Bereinigung von Syntax-Fehlern und Konsolidierung der `getActionDefinition` Methode.
  - Safeguards hinzugefügt, um sicherzustellen, dass `data_action` Typen im Modell korrekt gesetzt bleiben.



## [v2.16.20] - 2026-02-13
### Fixed
- **Flow Editor Synchronization Fix**:
  - `DataAction` (z.B. `SubmitLogin`) werden nun korrekt aus Sequenzen gelöscht.
  - `RefactoringManager` durchsucht nun rekursiv `successBody`, `errorBody` und `elseBody`.
  - Unterscheidung zwischen "Force Delete" (User-Aktion) und "Smart Cleanup" (Automatisch) im `FlowEditor` geschärft.
  - Logging für Synchronisations-Prozesse erweitert (`[FlowEditor]`, `[RefactoringManager]`).

## [v2.16.19] - 2026-02-13
### Fixed
- **Action Visualisierungs-Synchronisation**: Vollständige Umsetzung der "Geraden Linie" zwischen Action-Editor und Flow-Editor.
    - Der Flow-Editor nutzt nun primär das `details`-Feld aus dem JSON-Modell (`Single Source of Truth`).
    - `JSONDialogRenderer.ts` generiert beim Speichern fachliche Beschreibungen (Pascal-Syntax).
    - `FlowAction.ts` zeigt diese 1:1 an, was absolute Konsistenz garantiert.
    - Synchronisation von Berechnungs-Aktionen (`calculate`) verbessert: Anzeige der Formel statt nur "(Berechnung)".
    - Konsolidierung der Variablen-Anzeige (`variable`, `set_variable`).

## [v2.16.18] - 2026-02-13
### Fixed
- **Calculate Action Save Fix**: Behebung des Datenverlusts von `resultVariable` und `formula` bei 'calculate' Actions.
  - Ergänzung der `action: "updateValue"` Bindings für `CalcResultVariable` und `CalcFormulaInput` in `dialog_action_editor.json`.
  - Erweiterung des `JSONDialogRenderer.ts` (`updateModelValue`), um auch `ResultVariableInput` (Service-Aktionen) korrekt auf `dialogData.resultVariable` zu mappen.
  - Dies stellt sicher, dass manuelle Eingaben und Variablen-Picker-Einfügungen sofort im Modell persistiert werden.

## [v2.16.17] - 2026-02-12
### Fixed
- Systemweite Vereinheitlichung der Event-Task-Zuordnung von `Tasks` auf `events`.
- Behebung von Ladefehlern bei Stage-Events (onEnter, onLeave).
- Korrektur der Speicherlogik im JSON-Inspektor für Event-Mappings (Schreiben in `events` statt `Tasks`).
- Migration der Event-Anzeige im Inspector auf das `events`-Property.
- Wiederherstellung fehlender Event-Mappings (PinPicker, LoginButton) und Tasks (AttemptLogin) in `project.json`.
- Fallback-Support für Altdaten im `Tasks`-Feld in der Serialisierungs- und Auflösungslogik.
- **Task Resolution Fix**: Implementierung einer robusten Auflösungslogik für punkt-separierte Task-Namen (z.B. `PinPicker.onSelect`).
    - Unterstützung für Direct Resolution via `contextObj`.
    - Vollständiger Fallback-Scan über alle Stages, Variablen und Legacy-Objekte.
    - Optimiertes Warning-Handling: Unterdrückung von Warnungen für optionale Lifecycle-Events (`onStart`, `onLoad`, etc.).

## v2.16.16 (2026-02-12)
- **Calculate Action Fix**: Wiederherstellung und Erweiterung des `calculate` Typs.
- **Formula Generation**: Der `ActionEditor` generiert nun automatisch eine JavaScript-konforme `formula` aus den visuellen Schritten.
- **String/Emoji Support**: Operanden in Berechnungen unterstützen nun Text und Emojis (automatische Anführung in der Formel).
- **Visibility Fix**: Der Typ 'calculate' ist nun zuverlässig in allen Action-Dropdowns (Inspector & Dialoge) sichtbar. Korrektur der hartcodierten Mapping-Logik in `JSONDialogRenderer.ts` und Ergänzung in `dialog_action_editor.json`.
- **Method Mapping**: Beim Hinzufügen neuer Komponenten-Klassen muss deren Methoden-Liste in `JSONDialogRenderer.getMethodsForObject` ergänzt werden, damit sie im Action Editor auftaucht.
- **Pascal Sync**: Der Pascal-Generator und -Parser wurden erweitert, um komplexe Berechnungen (`Var := A + B`) zu unterstützen und Bidirektionalität zu gewährleisten.
- **Typen-Update**: `GameAction` unterstützt nun das Feld `formula` für die Runtime-Ausführung.

## v2.16.15 (2026-02-12)
- **Task-Sync Fix**: Korrektur der Task-Synchronisation nach Umbenennung im Inspector.
- **Refactoring Fix**: Statischer Import des `RefactoringManager` in `FlowElement.ts` für zuverlässigere projektweite Umbenennungen.
- **Hygiene**: Automatische Bereinigung von Task-Duplikaten (Root vs. Stage) in `RefactoringManager.sanitizeProject`.
- **UI**: Verbessertes Filtering im Flow-Editor Dropdown zur Vermeidung von redundanten Einträgen.

## v2.16.14 (2026-02-12)

## v2.16.13 (2026-02-12)
- **Bereinigung (project.json)**: Vollständiger Neustart – alle Tasks, Actions und FlowCharts entfernt. JSON-Schlüssel korrigiert (`events`-Arrays → korrekt `tasks`).
- **Variablen-Hosting**: Globale Variablen werden jetzt ausschließlich in `stage_blueprint` gehostet (keine Duplikate mehr in `project.variables`).
- **Objekte-Hosting**: Globale Objekte werden jetzt ausschließlich in `stage_blueprint` gehostet (`project.objects` geleert). Doppelter Toaster entfernt.
- **Code**: `ProjectRegistry.getVariables()` lädt globale Variablen nun aus der Blueprint-Stage (primäre Quelle) und dedupliziert korrekt bei aktiver Blueprint-Ansicht.

## v2.16.12 (2026-02-12)
- **Fix (Flow-Editor)**: Löschen von Aktionen im Flow-Diagramm entfernt nun auch verwaiste Aktions-Definitionen aus dem Projekt-JSON (Smart Delete).
    - Generische Aktionen (z.B. `Action1`, `Aufruf`) werden automatisch bereinigt.
    - Bei benannten Aktionen erfolgt eine Sicherheitsabfrage.
- **Fix (Projekt-Daten)**: Bereinigung duplizierter globaler Variablen in `stage_login`, die fälschlicherweise als lokale Kopien gespeichert wurden.
- **Refactoring (ProjectRegistry)**: `getActionUsage` berücksichtigt nun auch visuelle Referenzen in FlowCharts, um versehentliches Löschen verwendeter Aktionen zu verhindern.
- **Fix (Blueprint)**: Wiederherstellung der visuellen Variablen in `stage_blueprint` und Implementierung einer Deduplizierungslogik in `ProjectRegistry` (Stage > Global).
- **Refactoring (JSON)**: Umbenennung des Legacy-Keys `Tasks` (Events) zu `events` in `project.json`, `GameRuntime.ts` und Templates, um Namenskonflikte mit dem `tasks`-Array (Logik) zu beheben.

## v2.16.11
- Verbesserung (Debug-Log): Tooltips für lange Zeilen hinzugefügt und manuelle Text-Kürzungen entfernt.

## v2.16.10
- Fix (Aktions-Editor): Robusterer String-Vergleich im `TDropdown` Renderer stellt sicher, dass geladene Quell-Objekte (Source) korrekt vorselektiert werden.

## v2.16.9
- Fix (Aktions-Editor): Korrekte Anzeige des Aktionstyps beim Öffnen des Dialogs (Fix der `TDropdown` `selectedIndex` Evaluierung).

## v2.16.8
 (2026-02-12)
- **Fix (Aktions-Editor)**: Fehlerbehebung bei der Typ-Synchronisation. Der Aktionstyp wird nun korrekt beim Wechsel im Dropdown aktualisiert.
- **Fix (Aktions-Editor)**: Automatische Aktualisierung des `details`-Feldes beim Speichern, für eine konsistente Anzeige im Flow-Editor.
- **Fix (Aktions-Editor)**: Korrekte Verarbeitung des `sync`-Flags in der Projekt-JSON.

## v2.16.7 (2026-02-12)
- **Refactoring**: Syntax-Bereinigung und Wiederherstellung von Member-Methoden im `JSONDialogRenderer.ts`.

## v2.16.5 (2026-02-12)
- **Fix (Editor)**: Variablen werden nun korrekt auf allen Stages angezeigt. Der `isBlueprint`-Status der Stage wird jetzt beim Wechsel (switchStage) synchronisiert.
- **Fix (Komponente)**: `TVariable` ist nicht mehr auf Blueprints beschränkt (`isBlueprintOnly = false`), um die Sichtbarkeit im Editor zu gewährleisten.
- **Fix (Aktions-Editor)**: Auswahl des Aktions-Typs in `dialog_action_editor.json` auf Objekt-Basis umgestellt (value/label), um fragile String-Vergleiche mit Emojis zu vermeiden.
- **Fix (Runtime)**: `set_variable` als Alias für `variable` in `StandardActions.ts` registriert, um UI-Konsistenz bei gleichbleibender Funktionalität zu erhalten.

## v2.16.4 (2026-02-12)
- **Fix (Read Variable)**: Die Aktion "Read Variable" (intern `variable`) unterstützt nun auch Variablen als Quelle. 
- **Fix (Editor)**: Variablen-Listen im Flow-Editor (JSONDialogRenderer) sind nun kontextsensitiv und zeigen auch lokale Task-Variablen an.
- **Fix (Aktions-Editor)**: Das Eingabefeld für die Ziel-Variable in `dialog_action_editor.json` wurde repariert (fehlende `className`) und durch ein Auswahl-Dropdown ergänzt.
- **Logik**: Der `variable`-Handler löst Quellen nun robuster auf (Objekt -> Variable -> Interpolation) und bietet detailliertes Logging im Debug-Log.

## v2.16.3 (2026-02-12)
- **Fix (Variable Events)**: Automatische Triggerung von Variablen-Events unterbunden. Events wie `onValueChanged` lösen nur noch aus, wenn sie im Flow-Editor explizit verknüpft wurden.
- **Fix (StandardActions)**: Doppelte Zuweisung in der `calculate`-Aktion entfernt, um redundante Proxy-Trigger zu vermeiden.
- **Runtime**: `onValueChanged`-Ketten werden nun asynchron (`await`) ausgeführt, um Race-Conditions zu verhindern.
- **Debug Log**: Einführung eines Kontext-Stacks, damit Variablenänderungen im Protokoll nun korrekt unter der auslösenden Aktion verschachtelt werden (behebt unsaubere Reihenfolge).
- **Dokumentation**: `DEVELOPER_GUIDELINES.md` bezüglich der neuen Event-Trigger-Logik aktualisiert.

## v2.16.1 (2026-02-11)
- Bugfix: "Ghost-Einträge" (alte Namen) im Task-Dropdown nach Umbenennung behoben (RefactoringManager fix).
- Bugfix: Kontexterhalt im Flow Editor nach Umbenennung (localStorage Sync in JSONInspector).
- Mediator-Integration im Flow Editor zur reaktiven UI-Aktualisierung hinzugefügt.
- Trinity-Sync in Editor.ts optimiert (refreshAllViews bei Inspector-Updates).

## [v2.16.0] - 2026-02-11
### Entfernt
- Alle Tasks, Actions und FlowCharts der Login-Stage auf Benutzerwunsch gelöscht.
- Task-Referenzen in Login-UI-Objekten (LoginButton, PinPicker) entfernt.

## [v2.15.0] - 2026-02-11
### Hinzugefügt
- **Modularer Login-Workflow (Refined)**:
    - Explizite Definition der Variablen `loginResult` (Ergebnis-Speicher) und `currentPIN` (Eingabequelle).
    - Einführung von `loginError` zur sauberen Fehlerbehandlung ("Schlechtfall").
    - Benennung der Verbindungen im Flow-Editor ("GUT-FALL" / "SCHLECHT-FALL").
    - Reduzierung der `SubmitLogin` Action auf den reinen API-Call zur Vermeidung von Redundanz.
- **Rollen-basiertes Routing & Multi-Role Support**:
    - Neue Stage `stage_role_select` für Benutzer mit mehreren Rollen.
    - Dynamische Befüllung der Rollenliste (`PopulateRoles`) basierend auf den Server-Daten.
    - Automatisches Dispatching (`AutoDispatch`) für Single-Role Benutzer zu ihren Dashboards (SuperAdmin, Admin, Player).
- **Session-Management im Flow**:
    - Task `ProcessSession` zur zentralen Speicherung von `authToken`, `currentUser` und Login-Status.
- **Visualisierung im Flow-Editor**:
    - Task-Knoten-Referenzen innerhalb von Diagrammen zur Verknüpfung modularer Workflows (z.B. `LoginFlow` -> `ProcessSession`).

### Behoben
- **JSON-Integrität**:
    - Fix von Syntaxfehlern (Klammersetzung) am Ende der `project.json`.
    - Entfernung von Dubletten und Konsolidierung der `flowCharts` Speicherstruktur.

## [v2.14.0] - 2026-02-09
### Hinzugefügt
- **DataAction Visualisierung & Konfiguration**:
    - Neue spezialisierte Inspector-Sicht (`inspector_data_action.json`) für `DataAction` Knoten.
    - Unterstützung für Route, Methode (GET/POST/etc.), Body (JSON) und Ziel-Variable.
    - **Variable Dropdown**: Scope-bewusste Anzeige von Variablen mit Emojis (🌎, 🎭, 📚) zur besseren Unterscheidung.
    - **URL Suggestions**: Integrierte Datalist für Server-Routen (Suggestions) in der `DataAction`.
- **FlowAction Refactoring**:
    - Umstellung der Inspector-Proxies auf `getActionDefinition()`, um Datenverlust bei verknüpften Aktionen zu verhindern.

### Behoben
- **JSONInspector Stabilität**:
    - [x] Behebung einer kritischen Fehlstruktur in der `update()` Methode, die zu zahlreichen Abstürzen führte.
    - [x] Korrektur der Fallback-Logik: Spezialisierte Templates (DataAction, Task) werden nicht mehr durch die generische `inspector.json` überschrieben.
    - [x] Unterbindung von Eigenschafts-Duplizierung im Inspector, wenn spezialisierte Templates verwendet werden.
    - [x] Fix: Variablen-Dropdown in der `DataAction` repariert (Type-Preservation in `ExpressionParser` verhindert Stringifizierung von Arrays).
    - [x] Layout-Korrektur im Inspector: Fix für Flex-Overflow und fehlerhafte Zeilen-Gruppierung von Info-Labels.
    - [x] **Inspector-Synchronisation**: Behebung des Problems, dass Suchfelder nach Ressourcen-Wahl nicht erschienen (Triggered Re-render + Naming Standardisierung).
- **Dynamisches Ressourcen-Management (Phase 2)**:
    - No-Code Suche: Automatisches Abfragen von Objekt-Eigenschaften via Server-Endpoint.
    - Intelligente UI: Dynamische Dropdowns und automatische URL-Generierung basierend auf der Feld-Auswahl.
- **Stage Management**:
    - Automatische Synchronisation der `activeStageId` im `ProjectRegistry` beim Stage-Wechsel im Editor, was die korrekte Variablen-Auflösung ermöglicht.
- **TDropdown**:
    - Korrekte Unterstützung von Placeholdern und leeren Werten ("-- Keine --").
- **UI Refinement**:
    - **DataAction Inspector**: Vereinheitlichung der UI. `queryValue` ist nun ein Dropdown mit Variablen-Support.
    - Überflüssiger Token-Button `{..}` aus dem `urlInput` entfernt.

## [2.12.0] - 2026-02-08
### Behoben
- **AppendEmoji Action ("calculate")**: Behebung des Fehlers, bei dem Variablen-Komponenten als Objekte (`[object Object]`) statt als Werte in Berechnungen verwendet wurden.

### [v2.13.0] - 2026-02-08
- **Feat**: Admin Dashboard Erweiterung (Raum-Management).
  - Implementierung einer dynamischen Raum-Liste mit Filterung nach Admin-Zuständigkeit (`managedRooms`).
  - Neue UI-Elemente: `TList` für Räume, `TButton` zum Erstellen, `TPanel` für Details.
  - Automatisierte Kontext-Auflösung via `/api/platform/context/:userId` beim Dashboard-Start.
  - Server-Anbindung für Raum-Erstellung (`POST /api/platform/rooms`) inklusive automatischer Hierarchie-Aktualisierung.
- **Tools**: Einführung von Node.js Patch-Skripten (`patch_project.cjs`) zur sicheren Manipulation sehr großer Projekt-JSON-Dateien ohne Match-Fehler.

### [v2.12.1] - 2026-02-08
- **Fix**: Reaktivitäts-Fehler bei shadowing Variablen (Global vs. Stage) behoben.
- **Fix**: `ReactiveRuntime.getContext()` bevorzugt nun explizite Variablen-Werte vor Objekt-Proxies gleichen Namens.
- **Fix**: `RuntimeVariableManager` nutzt nun die Komponenten-ID für präzise Wert-Synchronisation (löst Konflikte bei Shadowing).
- **Logging**: Detaillierte Warnungen für fehlgeschlagene Bindings mit Kontext-Analyse hinzugefügt.

- **Variablen-Konsolidierung & Reaktivität**: Systemweite Vereinheitlichung der Variablen-Auflösung ("Typ-Gewissheit").
  - **ExpressionParser Optimierung**: Alle Kontext-Variablen werden nun vor der Evaluierung in `new Function()` automatisch via `resolveValue()` aufgelöst. Dies verhindert `[object Proxy]` oder `[object Object]` Fehler in JS-Formeln.
  - **GameRuntime Fix**: Korrektur der `handleStageChange` Sequenz. Der `ActionExecutor` wird nun erst aktualisiert, nachdem alle Stage-Objekte in reaktive Proxies umgewandelt wurden.
  - **Reaktivitäts-Synchronität**: Behebung einer Race-Condition im `RuntimeVariableManager`, durch die Bindings benachrichtigt wurden, bevor die visuelle Komponente ihren neuen Wert erhalten hatte.
  - **Basis-Support**: Einführung von `valueOf()` und `toString()` in der Basisklasse `TComponent`, um Variablen direkt in JS-Ausdrücken nutzbar zu machen.
  - **Zentrale Auflösung**: Implementierung der `resolveValue()` Logik in `PropertyHelper`, die den Inhalt von Variablen (`.value` oder `.items`) extrahiert.

## [2.11.0] - 2026-02-07
### Hinzugefügt
- **Metadaten-gesteuerte Sichtbarkeit**: Einführung eines generischen Systems zur Steuerung der Sichtbarkeit von Komponenten.
  - Neue Flags in `TComponent`: `isService`, `isHiddenInRun`, `isBlueprintOnly`.
  - Automatische Persistenz dieser Flags in der `project.json` via `toJSON`.
- **System-Komponenten Optimierung**: Über 15 System-Komponenten (API-Server, Datenbank, GameLoop etc.) wurden auf das neue Sichtbarkeits-System umgestellt.
- **Daten-Synchronisierung**: Automatisches Spiegeln von Server-Daten (z.B. `users.json`) in den Simulator des Editors via `DataService.seedFromUrl`.
- **API-Simulator**: Neue Dev-Route im Game-Server (`/api/dev/data/:file`) zur Bereitstellung von Mock-Daten.
- **Debug-Logging**: Erweitertes Logging für Datenbank-Aktionen (`db_find`, `db_save`) und HTTP-Anfragen.

### Geändert
- **Zentralisierte Filter-Logik**: 
  - `Stage.renderObjects` nutzt nun die neuen Metadaten-Flags statt hartkodierter Listen.
  - System-Komponenten werden im Run-Modus sowie auf nicht-Blueprint-Stages im Editor automatisch ausgeblendet.
  - `ProjectRegistry.getObjects` erkennt Services nun dynamisch anhand der Metadaten.
- **Editor-Integration**: Der `Editor` übergibt nun den aktuellen Stage-Typ ('blueprint') an die Renderschicht.

### Behoben
- **Variablen-Sichtbarkeit**: Behebung eines Fehlers, bei dem Variablen im Run-Modus weiterhin als Boxen sichtbar waren. 
  - `TVariable` setzt nun standardmäßig `isHiddenInRun = true` und `isBlueprintOnly = true`.
  - `Stage.ts` filtert Variablen im Run-Modus nun implizit aus, auch wenn die Metadaten-Flags im JSON fehlen.
- **Build-Stabilität**: Behebung von Lint-Fehlern (ungenutzte Parameter) in `Editor.ts`.
- **System-Dienste**: Korrektur von `TStatusBar` und `TToast`, um diese im Run-Modus ebenfalls standardmäßig auszublenden.

## [2.10.3] - 2026-02-07
### Hinzugefügt
- **Automatische Blueprint-Vererbung**: Der `RuntimeStageManager` mergt nun automatisch alle Stages vom Typ `blueprint` in die aktuelle Stage. Dies ermöglicht eine systemweite Verfügbarkeit von globalen Diensten (API-Server, Datenbanken) und deren Logik (Tasks/Actions).

### Behoben
- **API-Simulation**: Behebung des "Stummen Login"-Fehlers durch Beseitigung einer Blueprint-Dublette im `project.json` und Aktivierung der Datenbank-gestützten PIN-Prüfung.
- **Variablen-Interpolation**: Systemweite Korrektur der String-Interpolation (`${...}`).
  - `PropertyHelper.interpolate` erkennt nun automatisch Variablen-Komponenten (TStringVariable etc.) und dereferenziert deren `.value`.
  - Auflösung von Objekten ohne Punkt-Notation (z.B. `${currentPIN}`) gefixt.
  - Zusammenführung von lokalem und globalem Kontext in allen Standard-Aktionen (`StandardActions.ts`).
  - Behebung von Namenskonflikten zwischen lokalen Stage-Variablen und globalen Projekt-Variablen.
  - **Dot-Notation Support**: 
    - `PropertyHelper` unterstützt nun verschachtelte Variablenpfade wie `${$params.pin}` in lokalen Scopes.
    - `TaskExecutor` löst Parameter nun rekursiv und korrekt auf, was den Login-Flow repariert hat.
- **Daten-Integrität**:
  - Hotfix in `RefactoringManager`, um korrupte `UserData` Namen (`🗄️ Benutzer-DB`) beim Laden automatisch zu korrigieren.
- **Routing & Navigation**:
  - **Feat**: Rollen-basiertes Routing in `SubmitLogin` implementiert (Superadmin -> Super Dashboard, etc.).
  - **Fix**: `StandardActions.ts` (`respond_http`) korrigiert, um Objekte bei Interpolation nicht in Strings umzuwandeln (ermöglicht Zugriff auf `user.role`).
  - **Fix**: `EditorRunManager.ts` aktualisiert, damit `navigate_stage` im Run-Modus auch tatsächlich die Stage wechselt.

## [2.10.1] - 2026-02-07
### Behoben
- **Flow-Editor Ausrichtung**: Fix des 80px Offsets bei Knoten-Koordinaten (X-Achse). Knoten und Verbindungen liegen nun wieder korrekt auf der Grid-Ebene.
- **Flow-Diagramm Persistenz**: Korrektur der `syncToProject` Logik in `FlowSyncManager.ts`. Diagramm-Daten werden nun korrekt pro Task gespeichert (statt sich gegenseitig zu überschreiben).
- **Daten-Integrität**: Implementierung eines `isLoading` Flags in `FlowEditor.ts`, um korrupte Synchronisation während des Ladevorgangs zu verhindern.
- **Render-Stabilität**: `ProjectRegistry.ts` prüft nun mit `Array.isArray` auf valide Action-Sequenzen. Dies verhindert TypeErrors bei beschädigten oder leeren Projektdaten.

## [2.10.0] - 2026-02-07
### Hinzugefügt
- **Flow-Diagramm Refactoring**: Task-Objekte dienen nun als visuelle Wurzel-Knoten in Task-Diagrammen (Ersatz der generischen Start-Knoten).
- **Obligatorische Task-Action Verbindung**: Task-Knoten sind nun zwingend mit der nachfolgenden Aktionskette verbunden.

### Geändert
- **Strikte Flow-Isolation**: Der Flow-Editor filtert nun strikt zwischen globalen und lokalen Elementen.
  - Standard-Stages zeigen nur noch ihre eigenen (lokalen) Tasks und Actions.
  - Globale "Infrastruktur"-Tasks und Actions werden ausschließlich auf der Blueprint-Stage visualisiert.
  - Dies beseitigt redundante "Müll"-Einträge in funktionalen Stages.
- **FlowMapManager & FlowSyncManager**: Logik zur Übersichtsberechnung und Flow-Generierung für das neue Scoping angepasst.

## [2.9.0] - 2026-02-07
### Hinzugefügt
- Spezialisierte GCS-Variablentypen: `TStringVariable`, `TIntegerVariable`, `TBooleanVariable`, `TRealVariable`, `TObjectVariable`.
- Automatische Icons (Emojis) für verschiedene Variablentypen (`📝`, `🔢`, `⚖️`, `📏`, `📦`).
- Blueprint-Stage Typ (`stage_blueprint`) für systemweite Service-Visualisierung.

### Geändert
- Variablen-Scoping: Globale Variablen und Service-Objekte werden im Editor visuell nur noch auf Stages vom Typ `blueprint` gerendert.
- `EditorStageManager` refaktoriert: Nutzt nun `ProjectRegistry.getObjects()` als Single Source of Truth für die Objekt-Auflösung.
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
    - **Action Visualization:** Fixed synchronization issue where deleting global actions in the Flow Editor did not correctly update project data.
- **Refactoring:** Converted `SubmitLogin` to a `DataAction` structure with `successBody` and `errorBody` for better flow visualization.
- **New Action:** Added `execute_login_request` as a primitive action for Login DataAction.-Steuerung.
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
- **UI-Verbesserung**: `selectedEmoji` ist nun im Inspector der `TEmojiPicker`-Komponente sichtbar (schreibgeschützt).
- **Bugfix (Critical)**: `TEmojiPicker` synchronisiert nun `selectedEmoji` auch bei globalen Tasks korrekt mit der Runtime.
- **Runtime-Erweiterung**: `StandardActions` (calculate) hat nun Zugriff auf alle Komponenten (`objectMap`) und Event-Daten (`$eventData`).
- **Trinity-Sync v2.16.1**: Fix für Task-Umbenennungssynchronisierung und Kontexterhalt.
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
