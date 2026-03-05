# CHANGELOG

## [3.9.4] - 2026-03-05
### Behoben
- **Event-Handling & Rendering-Fix:** `EditorRenderManager` nutzt nun im Run-Mode die dedizierte `runStage`. `StageRenderer` erkennt Klick-Events nun auch in der `events`-Property von Objekten.
- **Root-Cause Fix Dimensions-Leckage:** `Editor.getActiveStage()` priorisiert nun die Runtime-Stage im Run-Mode zur korrekten Grid-Synchronisation nach Navigation.
- **Stage-Isolation:** Implementierung einer dedizierten `runStage`-Instanz im `EditorRunManager` (inkl. `require`-Fix) für sauberes Rendering im `#run-stage` Container.
- **Layout-Reset:** `Stage.ts` säubert nun `min-width`/`min-height` beim Verlassen des Run-Modes restlos.

## [3.9.2] - 2026-03-05
### Behoben
- **Layout-Harmonisierung**: Vollständige Beseitigung der Diskrepanzen zwischen Edit- und Run-Mode.
- **Geister-Objekte**: Deaktivierung der Stage-zu-Stage Vererbung (`inheritsFrom`), um unbeabsichtigte Objekt-Überlagerungen zu stoppen.
- **Blueprint-Merging**: Umstellung auf automatisches, implizites Mergen der globalen Blueprint-Stage in alle anderen Stages.
- **Inspector-Cleanup**: Entfernung des fehleranfälligen "Erbt von" Feldes aus den Stage-Einstellungen.
- **Robustes Hydrieren**: Idempotenz bei der Objekt-Hydrierung zur Vermeidung von State-Korruption.
- **Internal Containers**: Schutz interner Kinder von `TDataList`/`TTable` vor dem Flattening im Run-Mode.

## Unreleased (WIP)
- **Bugfix:** Inspector Persistence gerettet! `FlowNodeHandler` umschreibt Action/Task-Settings direkt in die project.json und ignoriert den kaputten Default-Ansatz der mit den UUIDs crashte.
- **Bugfix:** Copy-Paste Bugs auf der Stage behoben: Klick auf der Stage nach Ctrl+C platziert die Kopie zuverlÃ¤ssig und nur einmal; `TComponent.toJSON()` Serialisierungsfehler gepatcht, um `child.toJSON is not a function` bei kopierten JSONs zu vermeiden.
- **Bugfix:** Komponenten auf der Stage lieÃŸen sich nicht mehr lÃ¶schen (Entf & KontextmenÃ¼). Ursache: Wenn der "Spiel Testen" Modus beendet wurde, hat der `EditorRunManager` fÃ¤lschlicherweise das globale `onEvent` der Stage gelÃ¶scht, wodurch die Stage blind fÃ¼r "lÃ¶schen" Events wurde. Der Event-Handler wurde nun permanent zentralisiert.
- **Wichtig:** Keine Inline-Actions mehr. `TDataList` verschwindet nicht mehr nach einem Refresh (`Serialization.ts` kennt jetzt `case 'TDataList'`). Ohne diesen Case wurde die Komponente beim Laden/Reload nicht erkannt und verschwand.
- **Inspector UX (Phase 24):** Scroll-Position bleibt nun erhalten, wenn Werte im Eigenschaften-Tab aktualisiert werden, was den Editing-Flow beim Bearbeiten von Styles (wie Abrundung) drastisch verbessert.
- **Render Bugfix (Border-Radius):** Fehler bei der Anzeige von Abrundungen (`border-radius`) in Panels behoben. `StageRenderer` setzt nun fest `overflow: hidden`, wodurch eckige Kind-Elemente korrekterweise an den runden Ecken des Eltern-Panels geclippt werden.
- **Action Parameter Formatierung (Phase 19):** Verbesserte Lesbarkeit von Zuweisungsparametern (`type: "property"`) im Inspector. Anstelle von generischen Objekten (`[object Object]`) werden Zuweisungen jetzt als klartext lesbare Strings gerendert (z.B. `text := 'anmelden'`). Ã„nderungen im Eingabefeld werden beim Speichern (OnChange) bidirektional in korrekte JSON-Objekte zurÃ¼ckgewandelt.
- **Inspector Card Layout & Stage Fix (Phase 18.6):** Komplette visuelle Ãœberarbeitung des Inspectors. Eigenschaften werden jetzt gruppiert in `TPanel`-Karten mit eigenem Hintergrund, abgerundeten Ecken, Rahmen und Schatten dargestellt. ÃœberflÃ¼ssige Properties (`name`, `id`, `Objekt lÃ¶schen`) wurden bereinigt. Raster- und Animations-Felder in Stage-Template wurden zu `inline`-Feldern optimiert. Fehler in der Stage-Farbanpassung korrigiert (Update von veralteter `TColorPicker`- zu neuer `TColorInput`-Komponente).
- **Inspector UI AufrÃ¤umen (Phase 18.5):** Doppeltes `name`-Property entfernt, `id`-Property entfernt (nicht editierbar), Objekt-lÃ¶schen-Button entfernt (redundant mit Papierkorb-Icon), `draggable`/`droppable` nebeneinander angezeigt, `Textfarbe` in TYPOGRAFIE-Gruppe verschoben.
- **Rendering-Bugfix & Live-Sync (Phase 18.3):** Behebung eines kritischen Fehlers im `StageRenderer`, bei dem Text-Labels standardmÃ¤ÃŸig weiÃŸ gerendert wurden, was sie auf weiÃŸem Hintergrund unsichtbar machte. Die Rendering-Logik wurde robuster gestaltet (Klassen-Check vor Duck-Typing). Zudem wurde ein Live-Sync fÃ¼r die Game-Runtime implementiert (`GameRuntime.updateRuntimeData`), wodurch Inspector-Ã„nderungen an Design-Eigenschaften (Farbe, Position, Sichtbarkeit) nun auch im aktiven Run-Mode sofort sichtbar werden.
- **set_variable Configuration, Action Agent & Persistence Bugfixes (Phase 16):** Die Aktion `set_variable` (Variable setzen) unterstÃ¼tzt nun offiziell die Zuweisung von festen Werten Ã¼ber den Inspector (Feld: `value`). Zudem wurde der Action-Agent aktualisiert (`action_rules.json`). **Core Bugfixes:** 1) Es wurde ein massiver Fehler im `InspectorEventHandler` behoben, der dafÃ¼r sorgte, dass sÃ¤mtliche direkte Eigenschaften von Action-Knoten (wie `source`) nicht in der *project.json* gespeichert wurden, da der Handler fÃ¤lschlicherweise bei Actions (die nur einen `.name` besitzen) wegen fehlender `.id` abbrach. 2) Ein Whitelist-Fehler im `JSONDialogRenderer` wurde behoben. Die Funktion `cleanupActionFields` hat beim Erstellen / Modifizieren durch den UI-Action-Agenten aggressiv Felder wie `source` und `sourceProperty` bei `set_variable`-Aktionen gelÃ¶scht. Beide Wege (Inspector & Agent) speichern Variablen-Quellen nun zuverlÃ¤ssig in die project.json.
- **Stage Variable Drag Persistence (Phase 15):** Behebung eines Fehlers in `EditorInteractionManager`, bei dem Variablen auf der Stage nicht mehr per Drag&Drop verschoben werden konnten. Die Funktion `getOriginalObject` durchsucht nun korrekterweise auch die `project.variables` und `stage.variables` Arrays nach den Original-Objekten.
- **Inspector Persistence Fix (Phase 14):** Inspector-Eingaben (z.B. Variablen-Werte, Koordinaten) werden nun wieder persistent in der `project.json` gespeichert. Der Fix stellt sicher, dass `InspectorEventHandler` das Original-JSON-Objekt modifiziert und dass der Editor nach jedem Inspector-Update einen Speichervorgang triggert.
- **EditorDataManager Sync-Bug behoben (Phase 13 Fortsetzung):** Die Funktion `syncStageObjectsToProject` Ã¼berschrieb fehlerhafterweise fÃ¤lschlicherweise `projectStage.objects` mit aufgelÃ¶sten Laufzeitobjekten aus der Stage. Im Headless-Modus (z. B. beim AusfÃ¼hren von npm run test) fÃ¼hrte dies dazu, dass alle Stage-Objekte durch ein leeres Array Ã¼berschrieben (gelÃ¶scht) wurden. Dies wurde korrigiert: Operationen verÃ¤ndern das JSON nun direkt, ohne verlustbehafteten Re-Sync.- **Stage Interaction & Template Stability (Phase 12):** Offset-Rechenfehler beim Drag&Drop korrigiert. Komponenten-Placement-Anchor auf `Center` angepasst (Centering-on-Drop). `InspectorTemplateLoader` iteriert nun rekursiv durch `forEach` BlÃ¶cke, um komplexe Strukturen besser abzubilden.
## [3.9.4] - 2026-03-03
### HinzugefÃ¼gt
- **Typografie UI-Optimierung**: Horizontales Layout (Inline) fÃ¼r zusammengehÃ¶rige Eigenschaften (z. B. Fett/Kursiv).
- **FarbwÃ¤hler**: UnterstÃ¼tzung fÃ¼r den Property-Typ `color` im Inspector (Textfarbe, Hintergrundfarbe, Rahmenfarbe).
- **Inline-Support**: Erweiterung von `TPropertyDef` um ein `inline` Flag fÃ¼r kompaktere Darstellungen.

### GeÃ¤ndert
- **Inspector-Layout**: Entfernung redundanter Labels bei Checkboxen und automatische Gruppierung von Inline-Elementen.
- **TTextControl**: "Fett" und "Kursiv" nun nebeneinander angeordnet.
- **FarbwÃ¤hler (Native Integration)**: Farbauswahl direkt im Inspector durch spezialisierte Eingabefelder (Farbfeld + Hex-Text). Ersetzt die vorherige, externe Button-LÃ¶sung.
- **Live-Update**: Ã„nderungen im Inspector (z. B. Farben) werden nun in Echtzeit auf der Stage visualisiert, ohne dass ein finaler "Change"-Event abgewartet werden muss.

## [3.9.3] - 2026-03-03
### Added
- UnterstÃ¼tzung fÃ¼r `opacity` (Deckkraft) in allen visuellen Komponenten (`TWindow`).
- Erweiterte Typografie-Eigenschaften fÃ¼r `TTextControl` (Fett, Kursiv, Schriftart, Ausrichtung).
- Deutsche Lokalisierung fÃ¼r alle Inspector-Labels und Gruppen.

### Changed
- **Optimierung des Inspectors**: Redundante Feld-Definitionen in `inspector.json` entfernt; Felder werden nun dynamisch und konsistent aus den Komponenten-Klassen generiert.
- Gruppierung im Inspector verbessert: **IDENTITÃ„T**, **GEOMETRIE**, **STIL**, **TYPOGRAFIE**, **BILD**, **FORM**, **INHALT**, **EINGABE**, **GITTER**.
- `TPropertyDef` erweitert um `min`, `max` und korrigierten `step`-Typ.

### Fixed
- Beseitigung von doppelten Geometrie-Eigenschaften im Inspector.
- Korrektur der Methoden-Signatur in `TButton.ts`.

## [3.9.2] - 2026-03-02
### Fixes
- **Persistenz**: Behebung des Fehlers, bei dem `source` und `sourceProperty` in `set_variable` Aktionen nicht gespeichert wurden (fehlende Accessoren in `FlowAction.ts`).
- **Synchronisation**: Korrektur des Field-Strippings in `FlowSyncManager.ts` fÃ¼r Wizard-Aktionen.
- **UI**: Verbesserung der Update-Propagierung in `ActionParamRenderer.ts`.

## [3.9.1] - 2026-03-02
### Fixed
- **Expression Parsing**: `ExpressionParser.ts` auf Balanced-Brace-Parsing umgestellt. Behebt Syntax-Fehler bei verschachtelten AusdrÃ¼cken wie `${selectedObject.events.${value}}`.
- **Interpolation Resilience**: Fail-Safe-Mechanismus hinzugefÃ¼gt, der Original-Tags (`${...}`) bei Evaluierungsfehlern (z.B. fehlender Kontext) beibehÃ¤lt, statt leere Strings oder "undefined" zu rendern.
- **Stage Placement**: Korrektur der Koordinatenberechnung in `StageInteractionManager.ts`. BerÃ¼cksichtigt nun Border und Padding der Stage-FlÃ¤che, was den 28px/8px Versatz beim Platzieren von Komponenten behebt.
- **Auto-Centering**: Komponenten werden beim "Drop" aus der Toolbox nun prÃ¤zise unter dem Mauszeiger zentriert.
- **Recursive Template Expansion**: `InspectorTemplateLoader.ts` fÃ¼hrt nun rekursive `forEach`-Expansionen durch. Stellt sicher, dass auch tief verschachtelte UI-Komponenten in Vorlagen (z.B. Events-Tab) den korrekten Variablen-Kontext (`item`, `index`, `value`) erhalten.
- **Inspector Context**: `InspectorHost.resolveValue` injiziert nun konsistent den Template-Kontext, was die korrekte Anzeige von Event-Labels (z.B. "onClick" statt "undefined") garantiert.

## [3.15.11] - 2026-03-02

## [3.15.9] - 2026-03-02
### Added
- **Dynamic Prompt Interpolation**: UnterstÃ¼tzung fÃ¼r Platzhalter im Expert Wizard (z.B. `{target}`, `{property}`).
- **Corrected Action Payload Sync**: Property-Aktionen werden nun mit der korrekten `changes`-Objektstruktur gespeichert, was die sofortige Wirksamkeit sicherstellt.
- **Dynamic Method Selection**: Resolver fÃ¼r Komponenten-Methoden im Wizard integriert.

## [3.15.8] - 2026-03-02
### Added
- **Dynamic Property Resolver**: `ExpertRuleEngine` unterstÃ¼tzt nun Funktions-Resolver zur dynamischen Generierung von Optionen basierend auf dem aktuellen Sitzungs-Status.
- **Refined Property Wizard**: Die Auswahl von Eigenschaften erfolgt nun zweistufig (Kategorie wÃ¤hlen -> Eigenschaft wÃ¤hlen) inklusive Hilfetexten und Emojis.

## [3.15.7] - 2026-03-02
### Added
- **Expert Wizard UX Expansion**: UnterstÃ¼tzung fÃ¼r dynamische Auswahl-Listen (@objects) statt Freitextfeldern.
- **Rich Interaction**: Auswahl-Tiles unterstÃ¼tzen nun Emojis (`uiEmoji`) und detaillierte Beschreibungen.
- **Improved UI Replacement**: Saubere Container-Trennung in `ExpertDialog` verhindert UI-Bleeding zwischen Schritten.

## [3.15.6] - 2026-03-02
### Fixed
- **FlowEditor Context Jump Bugfix**: Behebung des Fehlers, bei dem der FlowEditor nach der Umbenennung eines Tasks via Agent Wizard zu "Main Flow" (Global Context) zurÃ¼cksprang. 
  - Ursache: Die Methode `EditorCommandManager.findObjectById` lieferte bei Tasks und Actions rohe JSON-Objekte aus `project.json` zurÃ¼ck, welche keine `getType()` Methode besaÃŸen. Folglich schlug der `isFlowNode` Check bei der Umbenennung fehl (`type` evaluierte zu `''`), wodurch `FlowEditor.renameContext(oldName, newName)` nie aufgerufen wurde.
  - Fix: Den von `findObjectById` gefundenen raw JSON-Objekten (Task/Action) wird nun dynamisch eine `getType: () => 'task'` bzw. `'action'` Methode angehÃ¤ngt. Dadurch wird der Kontext im FlowEditor vor dem Neuladen korrekt aktualisiert, und der Editor verbleibt im selben Diagramm.
- **TypeScript & UI Bugfixes**: `TDebugLog.ts` Verlgeich auf korrekten Type (`Action`), `TDataStore.ts` Static Property Shadowing (`logger` umbenannt in `dsLogger`), sowie UI CSS Fixes (zIndex Update fÃ¼r Debug Toggle Button).

## [3.15.5] - 2026-03-02
### Fixed
### Expert System / Wizards
*   **Rich Wizard Selections**: Das AuswahlmenÃ¼ im Wizard wurde zu einer modernen Kachel-Ansicht (Tiles) umgebaut.
*   **ErlÃ¤uterungen**: Jede Option (z. B. Action-Typen, HTTP-Methoden) unterstÃ¼tzt nun zusÃ¤tzliche Beschreibungen zur besseren Orientierung.
*   **Action Wizard Refinement**: Die Reihenfolge wurde auf "Name -> Typ (mit Info)" optimiert.
*   **Action Wizard Context Menus**: Die "Expert Edit" Option steht nun auch fÃ¼r eingebettete Tasks und Actions zur VerfÃ¼gung (`showEmbeddedContextMenu`).
- **Task Rename Synchronization**: VollstÃ¤ndige Behebung des Synchronisations-Bugs bei der Umbenennung von Tasks/Actions.
  - Das Umbenennen Ã¼ber den Inspector (`InspectorEventHandler.ts` -> `Editor.ts`) sowie Ã¼ber den Expert-Wizard (`FlowContextMenuProvider.ts`) nutzt nun zentral `EditorCommandManager.renameObject`.
  - Bugfix in `EditorCommandManager.findObjectById`: Die Methode durchsucht nun explizit auch Tasks und Aktionen nach ihrem `name`-Attribut (da diese keine UUID besitzen). Dies stellt sicher, dass das Refactoring-Framework das Entity korrekt auflÃ¶st und nicht nur isoliert im UI operiert.
  - Dadurch werden JSON-Daten, Dropdown-Listen und Flow-Charts wieder zu 100 % passend umbenannt.

## [3.15.4] - 2026-03-02
### Changed
- **Systematic Case-Sensitivity Fix**: Komplette Umstellung aller Flow-Node-Typen (`Task`, `Action`, `DataAction`, `Condition`, `Start`) auf durchgÃ¤ngige Kleinschreibung im gesamten Quellcode (TypeScript) und in der Projektdatei (`project.json`). Dies verhindert fehlerhafte Vergleiche (`===`) und unbemerkte Dateninkonsistenzen in der Sequenzgenerierung oder beim LÃ¶schen von Objekten.

### Added
- **Sofortige Verbindungs-Synchronisation**: Jede neue oder gelÃ¶schte Verbindung im Flow-Diagramm wird nun unmittelbar in der `actionSequence` des JSON-Datenmodells registriert.
- **Ghost Task Auto-Creation**: Wenn ein Flow-Diagramm ohne zugehÃ¶rige Task-Definition existiert, wird diese nun automatisch erstellt und synchronisiert.
- **Casing-Robustness**: UnterstÃ¼tzung fÃ¼r beide Schreibweisen (`tasks` und `Tasks`) in Stage-Definitionen zur Vermeidung von Datenverlust.
### Fixed
- **Action-LÃ¶schung (Final Bugfix)**: VollstÃ¤ndige Korrektur der Action-LÃ¶schung aus dem Flow-Diagramm. Die Action wird nun zuverlÃ¤ssig aus allen Projekt-Strukturen (Global, Stages, Sequenzen) entfernt.
- **Case-Sensitivity**: Behebung von Fehlern bei der Erkennung von Node-Typen (Normalisierung auf Kleinschreibung 'action').
- **ProjectRegistry**: Korrektur der ReferenzprÃ¼fung (`getActionUsage`), die zuvor aufgrund von GroÃŸ-/Kleinschreibung keine Treffer in Flow-Diagrammen fand.
- **UX**: Konsolidierung der LÃ¶sch-BestÃ¤tigungsdialoge. Verhindert redundante Prompts beim LÃ¶schen Ã¼ber den Inspector oder das KontextmenÃ¼.
### Fixed
- **UI-Sync (Final Deletion Fix)**: VollstÃ¤ndige Synchronisation beim LÃ¶schen von Knoten im Flow-Editor. Inklusive Link-Count-Update (Mediator) fÃ¼r alle Knoten sowie automatischer Aktualisierung des Flow-Dropdowns bei Task-LÃ¶schungen.

## [3.14.4] - 2026-03-01
### Fixed
- **UI-Sync (Deletion)**: Behebung der fehlenden Listen-Aktualisierung beim LÃ¶schen von Actions, Tasks oder Variablen im Flow-Editor. Integration des `MediatorService` in den `FlowGraphManager`.

## [3.14.3] - 2026-03-01
### Fixed
- **Action Drop Bug**: Fix fÃ¼r Case-Sensitivity Probleme beim Drop von Actions auf das Flow-Diagramm.
- **Sync-Stabilisierung**: Sicherstellung der Projekt-Referenz (`projectRef`) fÃ¼r Aktions-Knoten in der Factory.
- **Typ-Konsistenz**: `FlowDataAction.getType()` auf `'dataaction'` (kleingeschrieben) vereinheitlicht.

## [3.14.2] - 2026-03-01
- **Fix**: Automatische Action-Registrierung beim Drop auf den Flow-Editor sichergestellt.
- **Action Manager:** Lifecycle-Logging fÃ¼r Erstellen, LÃ¶schen und Umbenennen von Actions implementiert.
- **Action Refactoring:** Fix in `deleteAction`: UnterstÃ¼tzung fÃ¼r alle Action-Typen (Normal, `DataAction`, `HttpAction`) sichergestellt; verwaiste Knoten-Reste werden nun restlos aus Flow-Charts entfernt.
- **Flow Synchronization:** Verbesserte Synchronisation im `FlowGraphManager` nach dem LÃ¶schen von Knoten.
- **Testing:** Neue CRUD-Tests fÃ¼r die Action-Verwaltung integriert (`action_crud.test.ts`).
- **Fix**: UI-SynchronitÃ¤t (Mediator) bei Projekt-DatenÃ¤nderungen verbessert (erzwingt Refresh der Manager-Listen).
- **Test**: Automatisierter Regressionstest `tests/action_registration.test.ts` zur Absicherung hinzugefÃ¼gt.

## [3.14.1] - 2026-03-01
### Fixed (Visual & Refactoring)
- **Deep Refactoring Fix**: Behebung der Namens-Inkonsistenz (Reversion auf alten Namen) im Flow-Editor.
  - EinfÃ¼hrung von Multi-Feld-Matching (`hasOldNameMatch`) in `TaskRefactoringService.ts` und `ActionRefactoringService.ts`.
  - Verhindern von "Daten-Verschmutzung" durch Aufschub der `object.Name` Zuweisung im `FlowNodeHandler.ts`.
- **FlowSyncManager**: Korrektur der Zuweisungsreihenfolge und ErgÃ¤nzung eines erzwungenen `setShowDetails()` Aufrufs in `restoreNode()`.
- **Test-Katalog**: Integration neuer Robustheits-Tests (`renaming_robustness.test.ts`).

### Refactoring (UI & Flow)
- **Stage-Inspector**: Bereinigung der `inspector_stage.json`. Entfernung redundanter Listen (Variables, Tasks, Actions, Objects) und des "+ Add Variable" Buttons zur Verbesserung der Ãœbersichtlichkeit.
- **Flow-Editor**: Behebung des Kontext-Verlusts bei Task-Umbenennungen. Der Editor behÃ¤lt nun den Fokus auf dem umbenannten Element (inkl. Scroll-Position), anstatt zum Main-Flow zurÃ¼ckzuspringen.

## [3.15.0] - 2026-02-27
### Added
- **Dashboard Finale**: Implementierung des "Layered Dark Design" fÃ¼r das Room-Dashboard.
  - Tabellen-Farben auf `#0f111a` (auÃŸen) und `#161922` (innen) angepasst.
  - Mock-Daten direkt in `project.json` injiziert (Assigned Players & Game Queue), um "Keine Daten" Anzeige zu beheben.
  - Metrik-Karten-Design vereinheitlicht.

### Fixed
- **Resizing-Bug**: Korrektur in `StageInteractionManager.ts`. Resizing-Handles funktionieren nun wieder korrekt, da `dragStartRel` beim Starten des Vorgangs initialisiert wird.
- **Grid-Sichtbarkeit**: Fix der Gitter-Steuerung im Inspector. (Phase 21)
  - `activeStage` zum Kontext des `InspectorContextBuilder` hinzugefÃ¼gt.
  - PrÃ¤fix-Behandlung fÃ¼r `activeStage.` im `StageHandler.ts` implementiert, um korrekte Modell-Updates sicherzustellen.
  - **Bugfix (TypeError)**: Methode `getActiveStage` in `ProjectRegistry.ts` ergÃ¤nzt.
  - **Bugfix (ReferenceError)**: `require` durch `import` in `StageHandler.ts` ersetzt.
- **Phase 23 & 24: Flow-Editor Robustheit & Bereinigung Geister-Tasks**
    - **Filterung im FlowEditor**: Das Dropdown zeigt nun nur noch Tasks mit gÃ¼ltiger Definition an.
    - **Auto-Healing im FlowSyncManager**: Verwaiste FlowCharts ohne zugehÃ¶rige Task werden beim Laden automatisch aus der `project.json` entfernt.
    - **Filterung im MediatorService**: Library-Tasks ohne aktive Verwendung (`usageCount == 0`) werden im Manager-Tab (Tasks âš¡) ausgeblendet, um die Ansicht sauber zu halten.
    - **Daten-IntegritÃ¤t**: Beseitigung von "Resurrection-Bugs" durch Synchronisation nach LÃ¶schvorgÃ¤ngen.
### Fixed
- **Log-Spam Reduzierung (Run-Mode)**: 
  - Fix des `runModeLogDone`-Flags im `StageRenderer`: Die Objekt-Tabelle wird nun nur noch einmalig bei Stage-Start/Wechsel ausgegeben statt bei jedem Frame.
  - Umstellung des `ReactiveProperty`-Proxys auf UseCase-basiertes Logging (`Variable_Management`).
  - Integration von `Logger` in `ReactiveProperty.ts` zur Vermeidung ungefilterter `console.log` Aufrufe.

## [3.13.0] - 2026-02-27
### Added
- **VollstÃ¤ndige Log-Migration**: Alle `console.log/warn/error` Aufrufe im `src/`-Verzeichnis wurden durch den UseCase-basierten `Logger` ersetzt.
- **Entkopplungs-Pattern**: EinfÃ¼hrung eines Filter-Registry-Mechanismus in `Logger.ts` zur Vermeidung von kreisfÃ¶rmigen AbhÃ¤ngigkeiten mit dem `UseCaseManager`.

### Fixed
- **ProjectRegistry**: Behebung von Syntaxfehlern in `getVariables` und Korrektur redundanter Attribut-Deklarationen.
- **Multi-Group Migration**: Erfolgreiche Umstellung von 8 Service-Gruppen (Inspector, Flow, Runtime, Core, UI, Infra, Utility, Assets).

## [3.12.0] - 2026-02-27
### Added
- **UseCase-basiertes Logging**: 
  - EinfÃ¼hrung des `UseCaseManager` zur Verwaltung von Diagnose-Sichten.
  - Upgrade des `Logger`-Service: Automatische Filterung von DEBUG/INFO/WARN Logs basierend auf aktiven UseCases. ERRORs bleiben immer sichtbar.
  - Neuer **Logs-Tab** im Inspector zur komfortablen Auswahl der UseCases.
- **State-Diff-Visualisierung**: 
  - `RuntimeVariableManager` zeigt nun explizit den alten Wert bei Variablen-Ã„nderungen an (`Variable := Neu (vorher: Alt)`).

## [3.11.0] - 2026-02-27
### Changed
- **Dokumentations-Optimierung**: 
  - Archivierung alter EintrÃ¤ge (vor v3.0.0) in `CHANGELOG_ARCHIVE.md` zur Performancesteigerung.
  - Umstellung des `UseCaseIndex.txt` auf "Lean-Mapping" (Entfernung von Zeilennummern fÃ¼r bessere Wartbarkeit).
- **Core-Cleanup**: 
  - Entfernung von `TaskEditor.ts` und `ActionEditor.ts` (vollstÃ¤ndige AblÃ¶sung durch modularen Inspector).
  - Integration von `StageRenderer` in `player-standalone.ts`.

## [3.10.0] - 2026-02-27
- **Pascal-Editor (Architectural Refactoring)**: Modularisierung des massiven `PascalGenerator.ts` (1100+ Zeilen).
  - Aufteilung in [PascalCodeGenerator.ts](file:///c:/Users/rolfr/.gemini/antigravity/scratch/game-builder-v1/src/editor/PascalCodeGenerator.ts) (Erzegung) und [PascalCodeParser.ts](file:///c:/Users/rolfr/.gemini/antigravity/scratch/game-builder-v1/src/editor/PascalCodeParser.ts) (Parsing).
  - `PascalGenerator.ts` fungiert nun als schlanke Fassade (Facade-Pattern).
- **Pascal-Editor (Features)**:
  - **Komponenten-Deklaration**: Automatische Deklaration aller Stage-Objekte im Pascal-Sourcecode unter `VAR { STAGE COMPONENTS }`.
  - **Parser-Upgrade**: Volle UnterstÃƒÂ¼tzung fÃƒÂ¼r `WHILE`, `FOR`, `IF-THEN-ELSE` und Inkrement/Berechnungs-Aktionen im Round-Trip.
  - **Logger-Integration**: Der Parser nutzt den zentralen `Logger`-Service zur Protokollierung des Sync-Vorgangs.
- **Config**: `src/config.ts` um SicherheitsprÃƒÂ¼fungen fÃƒÂ¼r `import.meta.env` erweitert, um KompatibilitÃƒÂ¤t mit Node/TSX-Testumgebungen sicherzustellen.

## [3.9.1] - 2026-02-27
- **Standalone Player (Refactoring)**: VollstÃƒÂ¤ndige Integration des `StageRenderer` in `player-standalone.ts`.
  - Elimination von ~300 Zeilen redundantem Rendering-Code.
  - Implementierung des `StageHost` Interfaces im `UniversalPlayer`.
  - Einheitliches Rendering-System fÃƒÂ¼r Editor und Standalone-Player.
- **Dokumentation (Restrukturierung)**: Aufteilung der `DEVELOPER_GUIDELINES.md` in spezialisierte Module.
  - Neue Dateien unter `docs/`: `architecture.md`, `runtime-guide.md`, `coding-standards.md`, `ui-inspector-guide.md`.
  - Fokus auf Cloud-native und Agent-first Entwicklungsprinzipien.
- **Cleanup (Prio 3)**: Finale Entfernung der Legacy-Module `TaskEditor.ts` und `ActionEditor.ts`.
  - Bereinigung aller Callsites im Inspector und Entkopplung via `MediatorService`.
- **Versionierung**: Projektversion in `package.json` auf 3.9.1

## [3.9.0] - 2026-02-27
- **Architecture (Modularisierung)**: Umfassende Modularisierung von `RefactoringManager.ts` und `TaskExecutor.ts`.
  - Extraktion der Refactoring-Logik in spezialisierte Services: `VariableRefactoringService`, `TaskRefactoringService`, `ActionRefactoringService`, `ObjectRefactoringService` und `SanitizationService`.
  - EinfÃƒÂ¼hrung von `RefactoringUtils` fÃƒÂ¼r shared helper Methoden.
  - Slim-down von `RefactoringManager.ts` zu einem reinen Delegator (Facade).
- **Runtime (Performance & Clutter)**: Modularisierung des `TaskExecutor.ts`.
  - Extraktion von `TaskConditionEvaluator` und `TaskLoopHandler` in das neue Verzeichnis `src/runtime/executor`.
  - Reduktion der DateigrÃƒÂ¶ÃƒÂŸe und Verbesserung der Testbarkeit der Kern-Logik.
- **Typ-Sicherheit**: EinfÃƒÂ¼hrung des globalen `UsageReport` Interfaces in `src/model/types.ts`.
- **Cleanup**: Finale Bereinigung des Projekt-Wurzelverzeichnisses von verwaisten Batch-Dateien und temporÃƒÂ¤ren Logs.

## [3.8.0] - 2026-02-27
- **Core (Type Safety)**: VollstÃƒÂ¤ndige Entfernung des `any`-Typs von `GameAction` in `types.ts`.
  - Behebung von ~13 TypeScript-Build-Fehlern in `PascalGenerator.ts`, `FlowAction.ts`, `MediatorService.ts`, `AgentController.ts` und `RefactoringManager.ts`.
  - Implementierung von Robustheits-Casts (`as any`) an strategischen Stellen, um dynamische Properties typsicher zu handhaben.
- **Cleanup (Repository)**: Bereinigung des Root-Verzeichnisses von 17 veralteten Hilfsskripten und JSON-Konfigurationen (u.a. `run_all.bat`, `temp_...`, `fix_ssot.bat`).
- **Feature (TaskExecutor Tests)**: Massive Erweiterung der Test-Suite in `tests/task_executor.expand.test.ts`. 
  - 8 neue Szenarien: Verschachtelte Bedingungen (Branching), FOR-Loops, FOREACH-Loops, Action-Bodys mit Parameter-Interpolation (`${$params.msg}`).
- **Gesamt-Status**: P1 erfolgreich abgeschlossen. Build ist sauber, alle 65 Tests (57 bestehende + 8 neue) sind grÃƒÂ¼n.

## [3.7.1] - 2026-02-27
- **Cleanup (P0 Dead Code)**: Entfernung von ~577 KB Legacy-Code zur Reduktion der Wartungsschuld.
  - GelÃƒÂ¶schte Dateien: `TaskEditor.ts`, `ActionEditor.ts`, `FlowDiagramGenerator.ts`, `old_editor.ts`, `old_editor_temp.ts`, `FlowEditor_old.ts.tmp`.
- **Architecture (Flow-Navigation)**: Umstellung von modalen "TaskEditor"-Fenstern auf direkte Navigation im `FlowEditor`.
  - Doppelklick auf einen Task-Knoten fÃƒÂ¼hrt nun direkt zum entsprechenden Diagramm via `switchActionFlow`.
  - EinfÃƒÂ¼hrung des `SWITCH_FLOW_CONTEXT` Events im `MediatorService` zur Entkopplung von Inspector und FlowEditor.
- **Fix (FlowEditor)**: Syntaxfehler und Import-Probleme wÃƒÂ¤hrend der Migration behoben. `cleanCorruptTaskData` wiederhergestellt.
- **Feature (Test-Suite)**: Umfassende Test-Suite als Sicherheitsnetz fÃƒÂ¼r Refactoring implementiert. 36 neue Tests in 5 Modulen:
  - `serialization.test.ts` (8 Tests): JSON Ã¢Â†Â” Objekt Round-Trip, `hydrateObjects`, Container-Children, Event-Fallback, Style-Merge.
  - `refactoring_manager.test.ts` (9 Tests): Rename/Delete fÃƒÂ¼r Tasks, Actions, Variablen, Objekte; Usage-Report; Sanitize.
  - `task_executor.test.ts` (7 Tests): Stage-Task, Blueprint-Hierarchie-Lookup, Action-Resolution, Condition-Branching, Recursion-Guard.
  - `flow_sync.test.ts` (5 Tests): Element/Sequence-Konsistenz, Action-Namen-Match, Blueprint/Stage-Duplikate, Connection-Validierung, korrupte Task-Erkennung.
  - `project_integrity.test.ts` (8 Tests): Orphaned FlowCharts, Task-Duplikate, EventÃ¢Â†Â’Task-Mappings, Undefined Actions, Blueprint-Existenz, korrupte EintrÃƒÂ¤ge, **Inline-Action-Erkennung**.
- **Bug Discovery**: 2 Bugs im `RefactoringManager` aufgedeckt und **behoben**:
  - Bug #1: `renameTask` aktualisiert jetzt auch Stage-Events (`onEnter`, `onLeave`) Ã¢Â€Â“ neuer Schritt 8.
  - Bug #2: `renameVariable` iteriert jetzt ÃƒÂ¼ber alle Actions (Root + Stage) und aktualisiert auch `formula`-Felder.
- **Infrastructure**: `test_runner.ts` erweitert um 5 neue Importe. `TestResult.type` auf `string` erweitert fÃƒÂ¼r neue Kategorien.
- **Gesamt-Status**: 57/57 Tests grÃƒÂ¼n (20 bestehende + 37 neue).

## [3.6.0] - 2026-02-26
- **Architecture (ObjectStore)**: EinfÃƒÂ¼hrung von `ObjectStore.ts` als **Single Source of Truth** fÃƒÂ¼r alle aktuell gerenderten Objekte. Ersetzt die 4 parallelen Listen (`lastRenderedObjects`, `currentObjects`, `getResolvedInheritanceObjects()`, `runtime.getObjects()`).
- **Architecture (Run-Mode Schutz)**: Guards in `Editor.switchStage()` und `EditorViewManager.switchView()` verhindern, dass die Runtime im Run-Mode zerstÃƒÂ¶rt wird.
- **Architecture (findObjectById)**: `EditorCommandManager.findObjectById()` liest jetzt ZUERST aus dem ObjectStore statt aus `getResolvedInheritanceObjects()` Ã¢Â€Â” behebt leeren Inspector nach Stage-Wechsel.
- **API**: Neuer `Editor.isRunning()` Getter und `IViewHost.isRunning()` Interface.
- **Fix (Stage Navigation)**: `switchStage()` hat jetzt `keepView` Parameter Ã¢Â€Â” `switchView('stage')` wird nur im Editor-Modus aufgerufen.
- **Docs**: Neue Sektion "Architektur-Regeln (v3.6.0)" in DEVELOPER_GUIDELINES.md mit ObjectStore- und Run-Mode-Schutz-Regeln.

## [3.5.17] - 2026-02-26
- **Fix (Flow Editor)**: Behebung der LÃƒÂ¶sch-Inkonsistenz durch Umstellung auf ID-basierte LÃƒÂ¶schung in `FlowGraphManager.ts`.
- **Fix (UX)**: Konsolidierung der LÃƒÂ¶sch-BestÃƒÂ¤tigungsdialoge Ã¢Â€Â” nur noch 1x Frage statt 2-3x (`InspectorActionHandler`, `FlowGraphManager.deleteNodeSilent`, `Editor.removeObjectWithConfirm`).
- **Fix (Runtime)**: Regression-Fix fÃƒÂ¼r `${currentUser.name}` Binding nach Stage-Wechsel. Globale Variablen-Komponenten werden in `GameRuntime.handleStageChange()` nicht mehr ÃƒÂ¼ber `registerObject` neu registriert (ErgÃƒÂ¤nzung zu `GlobalVariablePersistence` & `GlobalElementPersistenceFix`).
- **Workflow**: Konsolidierung aller Wartungs-Skripte in `run_all.bat` (CMD-kompatibel als PowerShell-Fallback).

## [3.5.17] - 2026-03-01
- **Fix (Refactoring)**: Behebung der Task-Duplikation durch projektweite Case-Harmonisierung der Flow-Typen auf Kleinschreibung.
- **Improved UX**: EinfÃ¼hrung eines `refreshVisuals` Hooks in `FlowElement` sorgt fÃ¼r sofortiges Re-Rendering von Flow-Knoten nach Umbenennungen.
- **Architecture**: Umstellung von `getType()` in allen Flow-Elementen (`FlowTask`, `FlowAction`, etc.) auf Lowercase-Literale.
- **Improved Robustness**: Case-insensitive Typ-Erkennung im `EditorCommandManager` und automatische Normalisierung in `FlowNodeFactory` und `FlowSyncManager`.
- **Sync**: GewÃ¤hrleistung der AbwÃ¤rtskompatibilitÃ¤t beim Laden alter PascalCase-Projekte durch On-the-fly-Konvertierung.

## [3.5.16] - 2026-02-26
- **Fix (Data Model)**: `project.json` bereinigt und mit der neuen Blueprint-Architektur synchronisiert (`currentUser` Refactoring).
- **Fix**: Radikale Bereinigung der Task-Umbenennungs-Logik ("Gefrickel-Flush").
- **Fix**: Verlagerung der Refactoring-Logik von UI-Klassen (`FlowElement`) in den `EditorCommandManager`.
- **Fix**: Verhindern von Kontext-Verlust (View-Jump) im Flow-Editor durch synchrone `renameContext`-Migration vor dem Refactoring.
- **Fix**: Korrektur der Namens-Inkonsistenz im Task-Objekt durch robuste `oldValue`-Ãœbergabe aus dem Inspector.
- **Fix (Regression)**: `TypeError` in `FlowSyncManager` beim Laden von Nodes behoben (Name-Setter in FlowTask wiederhergestellt).
- **Fix (Duplikation)**: Verhindern von Task-Duplikaten durch EinfÃ¼hrung einer Synchronisations-Sperre (`isRefactoring`) wÃ¤hrend UmbenennungsvorgÃ¤ngen.
- **Fix (Inspector)**: Behebung der Case-Sensitivity bei der Namens-Erkennung im Inspector (`Name` vs `name`).
- **Fix (Editor)**: Behebung des `TypeError` im `EditorCommandManager` durch UnterstÃ¼tzung von `Name`-Properties bei Flow-Elementen.
- **Cleanup**: Entfernung redundanter Refactoring-Hooks aus `InspectorHost`.
- **Fix (Validation)**: Validator `validate_project.cjs` an Blueprint-SSoT angepasst und eingebettete FlowCharts extrahiert.
- **Cleanup**: Entfernung von Platzhalter-Tasks und Konsolidierung der Action-Referenzen in `stage_login`.

## [3.5.15] - 2026-02-26
- **Fix (Environment)**: PowerShell-Skripte (`npm run test`) durch CMD-kompatible Batch-Dateien (`.bat`) ergÃƒÂ¤nzt, um native Windows-KompatibilitÃƒÂ¤t bei beschÃƒÂ¤digter PowerShell-Umgebung sicherzustellen.
- **Workflow**: EinfÃƒÂ¼hrung von `run_tests.bat`, `validate_project.bat` und `fix_ssot.bat` im Root-Verzeichnis.

## [3.5.14] - 2026-02-26
- **Fix (Dragging Precision)**: PrÃƒÂ¤zision beim Ziehen von Komponenten verbessert durch BerÃƒÂ¼cksichtigung der Browser-Skalierung (Zoom).
- **Performance**: DOM-Element Caching wÃƒÂ¤hrend des Draggings implementiert, um VerzÃƒÂ¶gerungen in `handleMouseMove` zu minimieren.
- **Improved UX**: Skalierungskorrektur fÃƒÂ¼r Rectangle Selection und Komponenten-Drop aus der Palette.
- **Bugfix (Snap-Back)**: Fehler behoben, bei dem Objekte nach dem Drag an ihre alte Position zurÃƒÂ¼cksprangen (fehlendes `render()` nach Style-Reset).
- **Fix (Project Creation)**: Projekt-Neuerstellung ÃƒÂ¼ber das MenÃƒÂ¼ (Datei > Neues Projekt) wiederhergestellt.
- **Architecture**: "New Project" initialisiert jetzt direkt eine Blueprint-Stage gemÃƒÂ¤ÃƒÂŸ den SSoT-Regeln.

## [3.5.13] - 2026-02-26
- **Fix (Deletion Logic)**: Wiederherstellung der LÃƒÂ¶schfunktion fÃƒÂ¼r Stage-Komponenten und Flow-Diagramm-Elemente.
- **Improved UX**: Implementierung von `removeMultipleObjectsWithConfirm` fÃƒÂ¼r das sichere LÃƒÂ¶schen mehrerer Objekte mit ReferenzprÃƒÂ¼fung.
- **Recursive Deletion**: `EditorCommandManager.removeObjectSilent` wurde um die rekursive LÃƒÂ¶schung verschachtelter Objekte (z.B. in Dialogen) erweitert.
- **Flow Editor**: EntschÃƒÂ¤rfung des `isLinked` Checks im `FlowGraphManager`, um das LÃƒÂ¶schen von verlinkten Knoten aus dem Diagramm zu ermÃƒÂ¶glichen.

## [3.5.12] - 2026-02-25
- **Feature (Inspector Discovery)**: Implementierung der dynamischen Modell- und Feld-Erkennung im `InspectorContextBuilder`. Modelle werden nun direkt aus der `db.json` geladen.
- **Auto-Sync**: EinfÃƒÂ¼hrung von automatischem Daten-Seeding beim Projekt-Laden (`EditorDataManager`), um die Konsistenz zwischen Server-Daten und LocalStorage zu garantieren.
- **Improved UX**: Kontextsensitive Singular/Plural-VorschlÃƒÂ¤ge basierend auf dem Variablentyp (`object` vs `object_list`).
- **Path Resolution**: Dynamische Ermittlung des `storagePath` aus vorhandenen `TDataStore`-Objekten.

## [3.5.11] - 2026-02-25
- **Feature (Advanced Refactoring)**: Implementation eines projektweiten Refactoring-Systems.
- **Unified Deletion**: Zentralisierte LÃƒÂ¶sch-BestÃƒÂ¤tigung mit Nutzungsberichten fÃƒÂ¼r Variablen, Tasks, Aktionen und Objekte.
- **Seamless Renaming**: Automatische Aktualisierung aller Referenzen bei NamensÃƒÂ¤nderungen im Inspector.
- **RefactoringManager**: Erweiterte Usage-Reporting-Engine zur Identifikation von AbhÃƒÂ¤ngigkeiten in Flow-Charts und Objekt-Mappings.

## [3.5.10] - 2026-02-25
- **Fix (Deletion)**: Behebung des Fehlers beim LÃƒÂ¶schen von Variablen und Objekten. `EditorCommandManager.removeObject` lÃƒÂ¶scht nun permanent via `removeObjectSilent`.
- **Fix (Inspector)**: LÃƒÂ¶schfunktion im Inspector repariert (fehlende Action-Property und VerknÃƒÂ¼pfung zum Editor korrigiert).
- **IntegritÃƒÂ¤t**: Stage-Events fÃƒÂ¼r `delete` und `deleteMultiple` in `EditorInteractionManager` angebunden, um LÃƒÂ¶schen via Entf-Taste und KontextmenÃƒÂ¼ zu unterstÃƒÂ¼tzen.

## [3.5.9] - 2026-02-25
- **Fix (Inspector)**: Behebung des Selektions-Problems fÃƒÂ¼r Variablen-Objekte (`TObjectVariable`) auf der Stage. Diese werden nun korrekt ÃƒÂ¼ber die zentrale Objekt-AuflÃƒÂ¶sung erkannt und im Inspector angezeigt.
- **Architektur (SSoT)**: Konsolidierung der Flow-Variablen auf Single Source of Truth (SSoT). Visualisierungs-Knoten halten nun Referenzen auf Projekt-Variablen statt Kopien.
- **IntegritÃƒÂ¤t**: Implementierung und AusfÃƒÂ¼hrung eines SSoT-Cleanup-Skripts zur automatischen Bereinigung redundanter Flow-Daten in der `project.json`.
- **Validierung**: Erfolgreicher Regression-Test aller kritischen Pfade (QA-Report grÃƒÂ¼n).

## [3.5.8] - 2026-02-25
- **Fix (Build)**: TypeScript-Fehler in `RefactoringManager.ts` behoben (ungenutzte Variable `originalCount` entfernt).
- **Validierung**: VollstÃƒÂ¤ndiger Projekt-Build und Regression-Tests erfolgreich durchgefÃƒÂ¼hrt. QA-Report ist grÃƒÂ¼n.

## [3.5.7] - 2026-02-24
- **Fix (IntegritÃƒÂ¤t)**: Backend-Synchronisation fÃƒÂ¼r den Editor implementiert. Die `project.json` wird nun beim Start vom Server geladen und ÃƒÂ¼berschreibt den lokalen `localStorage`, um Konsistenz sicherzustellen.
- **Fix (UX)**: Automatischer Wechsel zur visuellen 'Stage'-Ansicht, wenn ÃƒÂ¼ber das MenÃƒÂ¼ oder bei Neuanlage eine Stage gewechselt wird. Dies verhindert Verwirrung, wenn man sich in anderen Ansichten (Flow/Code) befindet.
- **Fix (Flow-Editor)**: Blueprint-Flow-Diagramme (Main Flow und Tasks) werden nun korrekt im Dropdown angezeigt und geladen, auch wenn man sich in einer anderen Stage befindet. Dies stellt sicher, dass globale Logik jederzeit editierbar ist.
- **Fix (Login)**: Der `ApiSimulator` delegiert Login- ( `/api/platform/login`) und Datenanfragen (`/api/data/*`) nun per Proxy direkt an den Server. Dadurch bleibt die `db.json` auf der Festplatte die alleinige Source of Truth und der Login im Run-Mode funktioniert zuverlÃƒÂ¤ssig ohne manuelles Seeding.

## [3.5.6] - 2026-02-24

- **Feature (Flow Editor)**: Globale/Blueprint-Tasks sind nun von JEDER Stage aus im Dropdown sichtbar. Die Gruppe "Global / Blueprint" wird permanent eingeblendet.
- **Fix (Refactoring)**: Task-LÃƒÂ¶schung ist nun robust gegen Case-Sensitivity (z.B. attemptLogin vs AttemptLogin).
- **Fix (IntegritÃƒÂ¤t)**: Automatische Bereinigung von Task-Duplikaten in `project.json` beim Laden via `RefactoringManager.sanitizeProject`.
- **IntegritÃƒÂ¤t**: `AttemptLogin` Task in `stage_login` konsolidiert und verwaiste Duplikate in anderen Stages entfernt.
- **Fix (JSON)**: Reparatur der `project.json` nach struktureller Korruption im `stage_login` Bereich. Alle Tasks, Aktionen und FlowCharts sind nun wieder syntaktisch korrekt und konsistent.

## [3.5.5] - 2026-02-24
- **Hotfix (Flow Robustheit)**: Implementierung eines mehrstufigen "Magnet-Effekts". Verbindungen rasten nun extrem zuverlÃƒÂ¤ssig ein (Anker-Puffer 15px, Knoten-KÃƒÂ¶rper-Magnet 25px).
- **Hotfix (Flow Logik)**: Korrektur eines Priorisierungsfehlers im Hit-Test, der zu instabilem Verhalten beim Verbinden von eng beieinander liegenden Knoten fÃƒÂ¼hrte.

## [3.5.4] - 2026-02-24

## [3.5.3] - 2026-02-24
- **Hotfix (Flow Interaktion)**: Behebung des Problems, dass bestehende Verbindungen nicht mehr gelÃƒÂ¶st werden konnten (Detachment-Logik in `updatePath`).
- **Hotfix (Selection & Focus)**: Korrektur des Fokusverlusts bei Verbindungen. Neue Verbindungen bleiben selektiert und werden korrekt an den Inspector gemeldet.
- **Hotfix (Inspector Support)**: `FlowConnection` bietet nun eigene Inspector-Eigenschaften zur Identifikation und Bearbeitung (Beschriftung).

## [3.5.2] - 2026-02-24

## [3.5.1] - 2026-02-24
- **Hotfix (Flow Verbindungen v2)**: Verfeinerter Anchor-Hit-Test erkennt nun auch `success`/`error` Ports und bietet 5px Puffer fÃƒÂ¼r einfachere Bedienung.
- **Hotfix (Flow Sync)**: Erweitertes Logging im `FlowSyncManager` zur Verifizierung von verzweigten Aktionen (DataAction/Condition).
- **Hotfix (Flow Verbindungen v1)**: Behebung verschwindender Verbindungen durch sofortiges Attaching beim Erstellen.
- **Hotfix (Flow Toolbox)**: Behebung der unsichtbaren Toolbox im Flow-Editor durch ErgÃƒÂ¤nzung des fehlenden `render()`-Aufrufs und Korrektur der Layout-Toggle-ID.
- **Hotfix (Stages MenÃƒÂ¼)**: Wiederherstellung der dynamischen Stage-Liste im HauptmenÃƒÂ¼ durch Korrektur der MenÃƒÂ¼-ID (`Project` -> `stages`) und automatische Aktualisierung bei Projekt-ÃƒÂ„nderungen.
- **Hotfix (MenuBar Container)**: Behebung eines UI-Crashs durch Korrektur der DOM-ID `menu-bar` in `Editor.ts`.
- **Hotfix (FlowEditor UI)**: Wiederherstellung des Flow-Editors durch Korrektur der IDs `flow-viewer` und `toolbox-content`.
- **Hotfix (StabilitÃƒÂ¤t)**: EinfÃƒÂ¼hrung von Error-Handling (Try-Catch) fÃƒÂ¼r alle Kern-UI-Komponenten in `Editor.ts`.
- **Fix**: Snap-Back Effekt beim Dragging behoben (fehlendes `render()` nach Style-Reset).
- **Dragging**: Browser-Zoom Korrektur fÃƒÂ¼r alle BÃƒÂ¼hnen-Interaktionen implementiert.
- **Stage Refactoring (Phase 1 & 2)**: VollstÃƒÂ¤ndige Modularisierung der Stage.ts zur KomplexitÃƒÂ¤tsreduktion.
  - StageRenderer.ts: ÃƒÂœbernimmt das gesamte HTML/SVG Rendering der BÃƒÂ¼hne.
  - StageInteractionManager.ts: Verwaltet alle Benutzerinteraktionen (Drag, Resize, Selection, ContextMenu).
  - Stage.ts: Fungiert nun als schlanker Orchestrator zwischen den Services.
- **Ultra-Lean FlowEditor**: VollstÃƒÂ¤ndige Modularisierung von `FlowEditor.ts` abgeschlossen. Die DateigrÃƒÂ¶ÃƒÂŸe wurde massiv reduziert, indem fast alle Fachlogiken in spezialisierte Manager-Services extrahiert wurden.
- **Neue Manager-Services**:
  - `FlowUIController`: ÃƒÂœbernimmt Grid-Management, Zoom, Scroll-Area Updates und die Mediator-Initialisierung.
  - `FlowTaskManager`: Verwaltet Task-Registry-Operationen (`rebuildActionRegistry`, `ensureTaskExists`).
  - `FlowNodeFactory`: Zentralisiert die Erstellung aller Flow-Elemente (`Action`, `Task`, `Condition`, `Variable`, `Start`).
- **Delegations-Architektur**: `FlowEditor` fungiert nun primÃƒÂ¤r als Orchestrator ("Lean Host"), was die Testbarkeit und Wartbarkeit erheblich verbessert.
- **Bugfix (Type Error)**: Behebung von Linting-Fehlern in `FlowEditor.ts` durch typsichere Delegation an Manager.
- **Fehlerbehebung (TypeScript/Linting)**: VollstÃƒÂ¤ndige Implementierung aller Host-Interfaces in `Editor.ts` (z.B. `EditorDataHost`, `EditorRenderHost`, `EditorMenuHost`). ErgÃƒÂ¤nzung fehlender Methoden in `EditorStageManager.ts` (`getResolvedInheritanceObjects`, `deleteCurrentStage`, etc.) und Behebung der `JSONComponentPalette` Konstruktor-Signatur.
- **Dokumentation**: Aktualisierung der `DEVELOPER_GUIDELINES.md` und des `UseCaseIndex.txt` zur Abbildung der neuen Multi-Manager-Architektur.
11: 
12: ## [3.3.24] - 2026-02-23
- **FlowEditor Modularisierung (Phase 2)**: Extraktion von Navigations-Logik (`FlowNavigationManager`) und Graph-Hydrierung/Import-Logik (`FlowGraphHydrator`) aus `FlowEditor.ts`.
- **Interface-Compliance**: VollstÃƒÂ¤ndige Umsetzung der Host-Interfaces fÃƒÂ¼r alle Manager-Klassen zur Sicherstellung einer sauberen Delegation.
- **Bereinigung**: Reduzierung der Zeilenanzahl von `FlowEditor.ts` und Entfernung redundanter Methoden.
- **Login Restrukturierung**: Verschiebung der Login-Tasks (`AttemptLogin`, `createAnEmojiPin`) und zugehÃƒÂ¶riger Aktionen von `stage_blueprint` in die spezialisierte `stage_login` zur besseren Kapselung.
- **SSoT Enforcement**: VollstÃƒÂ¤ndige Bereinigung der `project.json` von redundanten und verwaisten Flow-Diagrammen ("Geister-Diagramme"). Alle globalen Diagramme liegen nun exklusiv in `stage_blueprint.flowCharts`.
- **Project Validator**: Erfolgreiche Validierung des Projekts auf "Healthy" nach der Umstrukturierung.
- **Smart Variable Deletion**: Implementierung einer intelligenten LÃƒÂ¶sch-Synchronisation fÃƒÂ¼r Variablen im Flow-Editor. Beinhaltet eine projektweite NutzungsprÃƒÂ¼fung (`getVariableUsageCount`) und einen BestÃƒÂ¤tigungsdialog vor der globalen LÃƒÂ¶schung.
- **RefactoringManager**: Neue Methoden `getVariableUsageCount` und `deleteVariable` zur projektweiten Verwaltung von Variablen-Definitionen.
- **Project Validator**: Implementierung eines automatisierten IntegritÃƒÂ¤ts-Checks (`scripts/validate_project.cjs`). Das Script prÃƒÂ¼ft die Konsistenz zwischen Events, Tasks, Actions und Ressourcen-Referenzen in Pascal-AusdrÃƒÂ¼cken sowie die SynchronitÃƒÂ¤t visueller Flow-Diagramme mit der logischen Sequenz.
- **Workflow-Integration**: Neues npm-Script `npm run validate` zur projektweiten QualitÃƒÂ¤tssicherung.

### Changed
- **Action Editor Deprecation**: Der Legacy-Dialog `dialog_action_editor` wurde vollstÃƒÂ¤ndig zugunsten des modularen `InspectorHost` abgelÃƒÂ¶st. Aktionen werden nun exklusiv ÃƒÂ¼ber den Inspector bearbeitet.
- **InspectorHost Action Renaming**: Die projektweite Umbenennung von Aktionen (`RefactoringManager.renameAction`) wurde nun beim ÃƒÂ„ndern des Namensfeldes direkt in den `InspectorHost` integriert.
- **FlowAction & FlowDataAction**: Implementierung von `getInspectorProperties` auf den Flow-Knoten, um Aktionsspezifische Parameter (HTTP, Request, Query, Target etc.) dynamisch im Inspector bereitzustellen.

### Fixed
- **FlowEditor**: Behebung von massiven Syntaxfehlern in `selectNode` und Reintegration der Klassenstrukturen.
- **FlowEditor**: Integration der Variablen-LÃƒÂ¶schung in den `deleteNode`-Workflow (Smart Delete).
- **RefactoringManager**: Behebung von Typ-Warnungen und Bereinigung von statischen Methoden-Aufrufen (`filterSequenceItems`).
- **Data Integrity**: Sicherstellung der Konsistenz zwischen visuellen Flow-Knoten (`VariableDecl`) und globalen Projekt-Variablen.
- **AttemptLogin**: Synchronisierung des Flow-Diagramms durch ErgÃƒÂ¤nzung des fehlenden `httpLogin`-Knotens.
- **Fix**: Projekt-Neuerstellung ÃƒÂ¼ber das MenÃƒÂ¼ (Datei > Neues Projekt) wiederhergestellt.
- **Architecture**: "New Project" initialisiert jetzt direkt eine Blueprint-Stage gemÃƒÂ¤ÃƒÂŸ den SSoT-Regeln.
- **Admin Dashboard**: Korrektur des fehlerhaften `onEnter`-Events in der `stage_admin_dashboard` und Definition der zuvor fehlenden `SendApiResponse`-Aktion.
- **Blueprint-Stage**: Behebung struktureller JSON-Inkonsistenzen durch Bereinigung doppelter Eigenschafts-Keys.
- **Data Integrity**: Veraltete eingebettete `flowChart`-Eigenschaften aus Tasks (`AttemptLogin`, `createAnEmojiPin`, `GetRoomAdminData`) entfernt und korrekt in die `flowCharts`-Mappings ÃƒÂ¼berfÃƒÂ¼hrt. Project Validator lÃƒÂ¤uft nun zu 100% sauber durch.

## [3.3.23] - 2026-02-23
### Fixed
- **TaskExecutor**: Implementierung einer hierarchischen Task-AuflÃƒÂ¶sung (Aktive Stage -> Blueprint-Stage -> Legacy Root). Behebt das Problem, dass globale Tasks im Blueprint von der Runtime nicht gefunden wurden.
- **Flow Editor**: Behebung des "Split-Brain" Synchronisationsfehlers bei Tasks (speziell `GetRoomAdminData`).
- **Flow Engine**: Hierarchische Task-AuflÃƒÂ¶sung (Active Stage -> Blueprint -> Global) implementiert.
- **Data Integrity**: Bereinigungslogik fÃƒÂ¼r redundante FlowCharts im `FlowSyncManager` hinzugefÃƒÂ¼gt.
- **Rules**: Blueprint-Stage wird nun strikt als Single Source of Truth fÃƒÂ¼r globale Elemente bevorzugt.
- **Projekt-Design (Regel 3)**: Erneute Bereinigung von Inline-Actions in `AttemptLogin` und `GetRoomAdminData`. Alle Aktionen werden nun strikt als Referenzen auf globale Definitionen gefÃƒÂ¼hrt.
- **Daten-IntegritÃƒÂ¤t**: Behebung von JSON-Syntaxfehlern in der `project.json` (falsche Arrays und Klammern in der Blueprint-Stage).
- **Entwicklung**: Aktualisierung der `DEVELOPER_GUIDELINES.md` zur Task-Suche und Inline-Actions.


## [3.3.22] - 2026-02-22
### Fixed
- **Inspector**: Fehlende Events fÃƒÂ¼r Flow-Elements (DataActions) behoben. Durch die EinfÃƒÂ¼hrung einer dynamischen Event-Ermittlung in `InspectorHost.ts` werden `onSuccess` und `onError` nun korrekt angezeigt.
- **Inspector**: Absturz bei der Verwendung von String-Styles in JSON-Templates (`CSSStyleDeclaration` Fehler) behoben durch robustere `applyStyle`-Logik in `InspectorRenderer.ts`.
- **Inspector**: Fehlerbehebung bei der Anzeige von Event-Labels ("undefined") und der Task-Auswahl durch Korrektur der Kontext-AuflÃƒÂ¶sung in `InspectorTemplateLoader.ts`.
- **Inspector**: Persistenz-Fix fÃƒÂ¼r Event-Mappings: Auswahl bleibt nun erhalten durch korrektes Pfad-Mapping (`event_` -> `events.`) in `InspectorEventHandler.ts`.
- **Inspector**: Refaktoring der Property-Bindung: EinfÃƒÂ¼hrung des expliziten `property`-Attributs in JSON-Templates fÃƒÂ¼r robustere Datenbindung und AblÃƒÂ¶sung der namensbasierten Heuristik (inkl. Legacy-Fallback).
- **Inspector**: Integration von `availableTasks` in den Datenkontext (`InspectorContextBuilder.ts`) und Implementierung der `map_event`-Aktion.

## [3.3.21] - 2026-02-22
### Fixed
- **Variable Inspector**: Behebung eines Fehlers in `PropertyHelper.ts`, durch den Metadaten (wie `type` oder `defaultValue`) im Inspector nicht mehr angezeigt wurden, sobald eine Variable einen Wert enthielt.
- **DataAction Inspector**: HinzufÃƒÂ¼gen von Feldern fÃƒÂ¼r `Name` und `Beschreibung` im spezialisierten DataAction-Inspector.
- **Property Resolution**: Implementierung eines Fallbacks in `getPropertyValue`, der bei fehlerhafter Inhalts-AuflÃƒÂ¶sung auf die Eigenschaften der Ursprungskomponente zurÃƒÂ¼ckgreift.
- **Testing**: Neuer Regressionstest `tests/variable_inspector.test.ts` zur Absicherung der Eigenschafts-AuflÃƒÂ¶sung.

## [3.16.0] - 2026-02-27
### HinzugefÃ¼gt
- **RoomDashboard Stage**: Neues Monitoring-Interface fÃ¼r SpielrÃ¤ume (`roomDashboard`).
- **TTable Card View**: Implementierung von `displayMode: "cards"` mit expliziter Spalten-Positionierung (`x`, `y`, `width`, `height`).
- **Custom Badge Styles**: Neue Badge-Farben und Dot-Icons fÃ¼r Statusanzeigen.
- **Metric Panels**: Footer-Karten fÃ¼r Latency, Packet Loss, Tick Rate und Sessions.
- **Blueprint Integration**: Globale Datenhaltung in `stage_blueprint` fÃ¼r konsistente Dashboard-Daten.
- **Header Refinement**: Optimiertes Header-Layout (Back-Button, Title, Online-Badge) gemÃ¤ÃŸ Spezifikation.
- **Grid Visibility**: Stage-Gitter wird nun standardmÃ¤ÃŸig ausgeblendet und ist nur via Inspector steuerbar.
- **Card-Slot-Types**: Neue Slot-Typen `image`, `header`, `badge` und `meta` fÃƒÂ¼r standardisiertes Kartendesign.
- **Dynamic Data Binding**: VollstÃƒÂ¤ndige Integration mit Stage-Variablen (`TListVariable`) und reaktivem Unwrapping.
- **Inspector Upgrade**: Konditionale Sichtbarkeit fÃƒÂ¼r Karten- vs. Tabellen-Konfiguration in `inspector_table.json`.

## [3.3.20] - 2026-02-22
### Added
- **Dynamic Card Gallery**: Erhebliche Erweiterung der `TTable` Komponente um eine Gallerie-Ansicht (`displayMode: 'cards'`).
- **Absolute Positioning**: UnterstÃƒÂ¼tzung fÃƒÂ¼r `x`, `y`, `width` und `height` innerhalb von Karten, was ein stage-ÃƒÂ¤hnliches Layout ermÃƒÂ¶glicht.
- **Card-Slot-Types**: Neue Slot-Typen `image`, `header`, `badge` und `meta` fÃƒÂ¼r standardisiertes Kartendesign.
- **Dynamic Data Binding**: VollstÃƒÂ¤ndige Integration mit Stage-Variablen (`TListVariable`) und reaktivem Unwrapping.
- **Inspector Upgrade**: Konditionale Sichtbarkeit fÃƒÂ¼r Karten- vs. Tabellen-Konfiguration in `inspector_table.json`.

### Changed
- **Stage Migration**: Die `stage_room_management` wurde vollstÃƒÂ¤ndig von statischen Mockups auf dynamische `TObjectList`-Komponenten umgestellt.
- **Capacity Tracking**: Die KapazitÃƒÂ¤tsanzeige reagiert nun dynamisch auf die Anzahl der geladenen Spieler.

## [3.3.19] - 2026-02-22
### Added
- **TDataAction SQL-Style**: Umstrukturierung des Inspectors nach SQL-Logik (SELECT, FROM, WHERE, INTO).
- **Property Projection**: UnterstÃƒÂ¼tzung fÃƒÂ¼r `selectFields` in der `TDataAction` zur Filterung von Ergebnis-Objekten.
- **Auto-Schema-Detection**: '*' Support fÃƒÂ¼r SELECT-Felder im Inspector-Dropdown.

### [3.3.18] - 2026-02-21
### [2026-02-21] - TTable & Binding Fixes (Runtime Optimization)
- **ReactiveRuntime**: Umstellung auf Proxy-basierte Namespace-AuflÃƒÂ¶sung (`global.`, `stage.`) im `getContext`. GewÃƒÂ¤hrleistet zuverlÃƒÂ¤ssiges Binding von globalen Komponenten und Variablen.
- **PropertyHelper**: Fix fÃƒÂ¼r Property-Shadowing. Verhindert, dass Komponenten-Metadaten (z. B. `.name`) Variablen-Inhalte ÃƒÂ¼berschreiben, wenn diese noch leer sind (behebt "currentUser" Anzeige-Bug).
- **TTable**: Smart-Unwrapping fÃƒÂ¼r `TObjectList`-Datenquellen und automatisches Column-Inheritance implementiert.
- **ReactiveRuntime**: Deep-Watching fÃƒÂ¼r `.data` und `.items` Properties zur automatischen UI-Aktualisierung bei Listen-ÃƒÂ„nderungen.
- **Tracing**: Spezielle Diagnose-Logs fÃƒÂ¼r die Registrierung und AuflÃƒÂ¶sung von `currentRooms` in der Runtime hinzugefÃƒÂ¼gt.

### HinzugefÃƒÂ¼gt
- **Stage Events Support**: UnterstÃƒÂ¼tzung fÃƒÂ¼r `onEnter`, `onLeave` und `onRuntimeStart` Events fÃƒÂ¼r Stages. Konfiguration direkt ÃƒÂ¼ber den Inspector ermÃƒÂ¶glicht.
- **Toolbox Erweiterung**: Neue Kategorie "Daten & Auth" mit `TDataStore`, `TAuthService` und `TUserManager`.
- **Intelligente Stage-Selektion**: Der Editor wÃƒÂ¤hlt nun automatisch die Stage-Eigenschaften im Inspector aus, wenn kein Objekt selektiert ist oder ÃƒÂ¼ber das MenÃƒÂ¼ "Stage-Einstellungen".
- **Variablen-Dropdown Upgrade**: UnterstÃƒÂ¼tzung fÃƒÂ¼r Untereigenschaften (z.B. `currentUser.id`) in Dropdown-Listen fÃƒÂ¼r eine prÃƒÂ¤zisere Datenkonfiguration.
- **Scoped Variable Resolution**: Korrektur der Laufzeit-AuflÃƒÂ¶sung fÃƒÂ¼r Variablen mit `global.` und `stage.` PrÃƒÂ¤fix, um Konsistenz zwischen Inspector-Anzeige und Runtime-Execution zu gewÃƒÂ¤hrleisten.

### Gefixt
- **Debug-Log-Viewer Spam & ZuverlÃƒÂ¤ssigkeit (v3.4.2)**: 
  - `GameRuntime` loggt keine "leeren" `onStart`-Events mehr fÃƒÂ¼r Komponenten ohne Flow-Logik.
  - Interne Property-ÃƒÂ„nderungen (z.B. `eventCallback`) werden im `PropertyWatcher` maskiert.
  - Zuweisungen von HTTP-Ergebnissen (`DataAction`) an Variablen werden nun prominent im Log angezeigt.
  - Stage-Lifecycle-Events (`onEnter`, `onRuntimeStart`) werden nun korrekt im Logbuch protokolliert.
  - RuntimeVariableManager nutzt nun lesbare Variablennamen statt IDs in der Console.
  - **Behoben**: Heimlicher Absturz beim Loggen von unsauberen Objekten durch `JSON.stringify`.
  - **Behoben**: Debug-Log brach nach JEDEM erfolgreichen Stage-Wechsel (z. B. durch `navigate_stage` -> Dashboard) aufgrund eines Fehlers in `EditorViewManager.switchView()` vorzeitig ab.
- **RuntimeStageManager Caching**: 
  - Globale Variablen und Objekte (aus `blueprint` und `main` Stages) werden nun im Speicher gecacht anstatt bei jedem Stage-Wechsel neu aus dem JSON instanziiert zu werden. Dies verhindert den "GedÃƒÂ¤chtnisverlust" von globalen Variablen wÃƒÂ¤hrend Stage-ÃƒÂœbergÃƒÂ¤ngen im Play-Modus.
- **TTable Komponente (Dynamische Tabelle)**:
  - Vollwertige `TTable` Komponente hinzugefÃƒÂ¼gt und in `ComponentRegistry` sowie Toolboxen eingebunden.
  - Das HTML-Rendering in `Stage.ts` (Methode `renderTable`) greift direkt auf die gebundenen Runtime-Daten (z.B. `currentRooms.data`) zu.
  - Erlaubt Konfiguration individueller Spalten ÃƒÂ¼ber die Eigenschaft `columns` (als JSON formatiert via `inspector_table.json`).
  - **Auto-Columns**: Ist keine Konfiguration hinterlegt, werden die Eigenschaften (Keys) des ersten Daten-Elements automatisch als Spalten generiert!
- **MockTaskExecutor**: Fehlende Methoden fÃƒÂ¼r Unit-Tests ergÃƒÂ¤nzt (`setActions`, `setFlowCharts`, etc.).
- **Global Variable Cleanup**: Bereinigung von fÃƒÂ¤lschlicherweise in normalen Stages gespeicherten globalen Variablen beim Laden.
- **Fix (Stage Events)**: Exponierung von Stage-Events (`onEnter`, `onLeave`, `onRuntimeStart`) im Inspector.
  - Dediziertes `inspector_stage_events.json` Template und `StageHandler.ts` fÃƒÂ¼r die spezialisierte Behandlung von Stages im Inspector.
  - **Fix: Dynamische Ressourcen-Eigenschaften**: Der Inspector zeigt nun basierend auf dem gewÃƒÂ¤hlten `DataStore` (z.B. Rooms vs. Users) automatisch die korrekten Felder fÃƒÂ¼r die Suche an. Umgesetzt in `InspectorContextBuilder.ts`.
  - **Fix: Inspector Regressionen**: Behebung leerer Dropdowns durch korrekte AuflÃƒÂ¶sung von Ausdruck-Optionen (`${...}`) in `InspectorHost.ts` und `InspectorRenderer.ts`.
  - **Fix: Property Mapping**: Verbessertes Mapping fÃƒÂ¼r `FlowNodes` in `PropertyHelper.ts`, um Daten konsistent aus der `project.json` in den Inspector zu laden.
  - **Fix: Room Data Fetch**: Fehlerbehebung beim Laden von Raumdaten durch Flachklopfen der `db.json` Struktur, Korrektur der `queryProperty` (`adminId`) und URLs in `project.json` sowie Bereinigung von Task-Inkonsistenzen.
  - **Fix: Room Data Synchronisation**: `RuntimeVariableManager.ts` synchronisiert nun `.data`-Properties fÃƒÂ¼r `TObjectList`-Komponenten. Auto-Unwrapping von Single-Element-Arrays in `StandardActions.ts` auf JWT-Login-Responses eingeschrÃƒÂ¤nkt. Spalten von `currentRooms` auf Room-Felder (`name`, `houseId`, `adminId`) korrigiert.
  - MenÃƒÂ¼-Integration: Neuer Punkt "Stage-Einstellungen" im Stages-MenÃƒÂ¼ zur schnellen Konfiguration der aktuellen Stage.
  - UI-Refinement: Automatisches Selektieren der aktiven Stage im Inspector beim Klicken auf den BÃƒÂ¼hnenhintergrund (Deselektion von Objekten).
  - UnterstÃƒÂ¼tzung fÃƒÂ¼r das Fetch-Pattern: ErmÃƒÂ¶glicht den automatischen Datenabruf via JWT beim Eintritt in eine Stage (`onEnter`).
  - Verifizierung: Neuer Regressionstest `tests/stage_events.test.ts` zur Absicherung der Event-Trigger in der `GameRuntime`.

- **Fix (JSON Workflow Consistency)**: VollstÃƒÂ¤ndige Abbildung des Workflows im JSON-Modell.
  - **FlowSyncManager Fix**: `DataAction`-Knoten unterstÃƒÂ¼tzen nun den generischen `output`-Anker als Fallback fÃƒÂ¼r `success`, was das korrekte Verfolgen von Verzweigungen in der `actionSequence` sicherstellt.
  - **Recursive Registration**: Unter-Aktionen in `successBody`, `errorBody` und `elseBody` werden nun zuverlÃƒÂ¤ssig in die globale `actions`-Liste des Projekts aufgenommen.
  - **Single Source of Truth**: `getTargetFlowCharts` in `FlowEditor.ts` korrigiert, um redundante Speicherung von Task-Diagrammen in Stages zu verhindern. Globale Tasks werden nun primÃƒÂ¤r in `project.flowCharts` gespeichert.
  - **Data Patch**: `project.json` bereinigt und `AttemptLogin` als globalen Task mit vollstÃƒÂ¤ndiger logischer Sequenz (inkl. `Condition`) etabliert.
- **Feature (FlowCondition Inspector Editor)**: VollumfÃƒÂ¤ngliche Konfiguration von Bedingungen im Flow-Editor.
  - UnterstÃƒÂ¼tzung fÃƒÂ¼r modulare Operanden (Variable, Literal, Element-Eigenschaft).
  - Kontextsensitives UI-Template (`inspector_condition.json`) mit dynamischen Dropdowns fÃƒÂ¼r Objekt-Eigenschaften.
  - Runtime-Support im `TaskExecutor` fÃƒÂ¼r komplexere Vergleiche (z.B. `Label1.text == 'Login'`) und verschachtelte Variablenpfade (z.B. `${global.currentUser.role}`).
  - Fix: `InspectorTemplateLoader` unterstÃƒÂ¼tzt jetzt sowohl Array- als auch Objekt-Wrapper-Strukturen in JSON-Templates.
  - AbwÃƒÂ¤rtskompatibilitÃƒÂ¤t fÃƒÂ¼r bestehende einfache `variable`/`value`-Bedingungen gewÃƒÂ¤hrleistet.
- **Feature (Universal Actions)**: Universell konfigurierbare Aktionen im UI.
  - EinfÃƒÂ¼hrung der `TActionParams`-Komponente fÃƒÂ¼r dynamische Parameter-Rendering in Inspector und Action-Dialog.
  - Dynamische Methodenparameter: `call_method` Aktionen laden nun Parameter-Signaturen direkt aus der `MethodRegistry.ts`.
  - Inspector-Erweiterung: `ActionTypeSelect` erlaubt den Typwechsel direkt im Inspector mit sofortigem UI-Update.
  - Bereinigung: `dialog_action_editor.json` wurde auf das neue generische System (TActionParams) umgestellt, was Redundanzen eliminiert.
  - Fixes: `navigate_stage` und `call_method` sind nun vollstÃƒÂ¤ndig ÃƒÂ¼ber das UI konfigurierbar.
  - **Fix (Data Binding)**: Intelligentes Daten-Binding via `PropertyHelper` implementiert. Erlaubt automatischen Zugriff auf verschachtelte `.data`-Objekte von FlowNodes, wodurch Aktions-Parameter nun konsistent im Inspector angezeigt und gespeichert werden.
  - **Feature (Variable Picker)**: Wiederherstellung des Variable Pickers im Inspector. Textfelder (z.B. `Label.text`) und Aktions-Parameter (z.B. `ShowMessage`) erhalten einen Button 'V', um Variablen-Tokens `${...}` einzufÃƒÂ¼gen.
  - **Fix (Variable Binding)**: Behebung des Fehlers, bei dem Variablen-AusdrÃƒÂ¼cke wie `${currentUser.name}` im Inspector nicht aufgelÃƒÂ¶st wurden. Der `InspectorContextBuilder` stellt nun alle Variablen-Werte (inkl. PrÃƒÂ¤fix-Support fÃƒÂ¼r `global.` und `stage.`) bereit.
  - **Fix (Runtime Persistence)**: Behebung des "GedÃƒÂ¤chtnisverlusts" beim Stage-Wechsel. Die `ReactiveRuntime` bewahrt globale Variablen nun persistent ÃƒÂ¼ber Stage-Grenzen hinweg auf.
  - **Fix (Editor Preview)**: Konsistente Variablen-AuflÃƒÂ¶sung in der Stage-Vorschau durch Angleichung des `VariableContext` an die Inspector-Logik.
  - **Fix (Live-Mode Navigation)**: Behebung des Fehlers, bei dem die Sandbox-Engine (`GameRuntime`) im Editor durch den Stage-Wechsel-Aufruf (`onNavigate`) komplett beendet und neu instanziiert wurde. Der Live-Modus weitet die Navigation jetzt durch die neue Methode `switchToStage` direkt auf die laufende Engine aus, was die Zustandserhaltung garantiert.
  - **SSoT-Synchronisation (FlowSyncManager)**: Bei der grafischen Synchronisierung von canvas-nodes (`isLinked: true`) dÃƒÂ¼rfen globale Definitionen nur dann aktualisiert werden, wenn der Knoten vollstÃƒÂ¤ndige Logik-Daten enthÃƒÂ¤lt. Sparse Metadata-Updates (nur Name/Position) mÃƒÂ¼ssen von Logik-Updates getrennt bleiben, um ein ÃƒÂœberschreiben der vollen Aktionsdefinition durch Minimaldaten durch Minimaldaten zu verhindern.
- **Datenverlust-Schutz (type)**: In `updateGlobalActionDefinition` muss sichergestellt werden, dass ein bereits existierender `type` im globalen Register NICHT durch `undefined` aus den Knotendaten ÃƒÂ¼berschrieben wird. Dies ist entscheidend fÃƒÂ¼r neue Nodes, deren Metadaten noch nicht vollstÃƒÂ¤ndig im Diagramm-Zustand repliziert wurden.
- **Stabile Knoten-Referenzierung**: Verwende in Synchronisations- und Wiederherstellungs-Routinen (wie `restoreConnection`) IMMER die technische `id` des Knotens. Der Getter `name` auf `FlowElement` ist ein Alias fÃƒÂ¼r die `id`, aber fÃƒÂ¼r die Suche in Listen sollte robust gegen beide Felder (`id` ODER `name`) geprÃƒÂ¼ft werden, um AbwÃƒÂ¤rtskompatibilitÃƒÂ¤t zu gewÃƒÂ¤hrleisten.
- **Typwechsel-Logik**: Beim Wechsel von Aktionstypen im Dialog sollte die Definition ersetzt statt gemergt werden, um inkompatible Felder (z.B. alte Variablenreferenzen) restlos zu entfernen. ZusÃƒÂ¤tzlich wurde eine Endlos-Bootschleife beim Stage-Wechsel im Live-Modus via `EditorRunManager.setRunMode` durch einen Early Return behoben.
  - **Fix (Live Mode Variable Reset)**: Verhinderung des fehlerhaften `INITIAL SYNC`-ÃƒÂœberschreibens in `GameRuntime.ts`. Globale Variablen, die beim Live-Stage-Wechsel persistent bleiben, werden nun vor dem ÃƒÂœberschreiben mit Default-Werten aus Stage-Komponenten geschÃƒÂ¼tzt.
### [3.3.17] - 2026-02-19
- **Fix (StandardActions)**: `call_method` als neuer Action-Handler registriert. LÃƒÂ¶st `ShowLoginError` (Toaster.show) im Error-Pfad der DataAction korrekt auf. Reihenfolge: Projekt-Objekt Ã¢Â†Â’ Service-Registry Ã¢Â†Â’ Spezialfall Toaster.show.
- **Fix (StandardActions)**: `variable`/`set_variable`-Handler: `action.value` als direkter Literal-Fallback wenn `source` fehlt. LÃƒÂ¶st `ClearPIN` mit `{variableName: 'currentPIN', value: ''}` korrekt auf (leerer String = valider Wert).

### [3.3.16] - 2026-02-19
- **Refactor (AttemptLogin Flow)**: Redundante Condition-Raute `Login Check` entfernt. `doTheAuthenfification` (DataAction) ist jetzt direkt mit `GotoDashboard` (via `success`-Anker) und `ShowLoginError` Ã¢Â†Â’ `ClearPIN` (via `error`-Anker) verbunden. Die DataAction-eigenen AusgÃƒÂ¤nge ersetzen die Raute vollstÃƒÂ¤ndig.
  - `platform/project.json`: FlowChart-Elemente und -Verbindungen angepasst.
  - `actionSequence`: DataAction enthÃƒÂ¤lt jetzt korrekte `successBody`/`errorBody`.

### [v3.5.5] - 24.02.2026
- **Fix (Flow Editor):** Selektions-Flimmern durch Originator-Abgleich behoben ('flow-editor').
- **Fix (Inspector):** Automatisches Laden von Daten fÃƒÂ¼r existierende Aktionen (SSoT-Logic) in `FlowAction` & `FlowDataAction`.
- **Feature (Inspector):** Connections im Flow-Editor sind nun selektierbar und im Inspector konfigurierbar.
### [3.3.15] - 2026-02-19
- **Fix (FlowSyncManager)**: `doTheAuthenfification` (und alle weiteren DataActions mit `isLinked: true`) werden im Flow-Diagramm jetzt korrekt als **DataAction-Knoten** (blau, mit Success/Error-Ankern) dargestellt.
  - **Bug 1 Ã¢Â€Â“ `restoreNode()`**: LÃƒÂ¤dt ForChart-Element mit `type:'Action'`, erkennt aber jetzt ÃƒÂ¼ber die globale Def `type:'data_action'` und tauscht den instanziierten `FlowAction`-Knoten atomisch gegen `FlowDataAction` aus.
  - **Bug 2 Ã¢Â€Â“ `generateFlowFromActionSequence()`**: `data_action`-Items in der `actionSequence` erzeugen jetzt `type:'DataAction'` statt `type:'Action'` im generierten FlowChart.
  - **Bug 3 Ã¢Â€Â“ `syncTaskFromFlow()`**: Beim ZurÃƒÂ¼ckschreiben der Sequenz aus dem Canvas wird der echte Typ der verlinkten globalen Action nachgeschlagen (`data_action` statt pauschales `action`).
  - **Data-Patch**: `platform/project.json` FlowChart-Element und `actionSequence` des `AttemptLogin`-Tasks wurden direkt korrigiert (via Node-Script).

### [3.3.14] - 2026-02-19
- **Fix (FlowEditor)**: Blueprint-Stage Tasks (z.B. `AttemptLogin`) erscheinen jetzt im Flow-Dropdown.
  - `FlowEditor.ts` `updateFlowSelector()`: Im Blueprint-Zweig werden nun zuerst `activeStage.flowCharts` und `activeStage.tasks` (stage_blueprint) aufgelistet, bevor Legacy `project.flowCharts`/`project.tasks` folgen.
  - Blueprint-Gruppe im Dropdown heiÃƒÂŸt jetzt `Ã°ÂŸÂ”Â· Blueprint / Global`.

### [3.3.13] - 2026-02-19
- **Fix (Editor)**: Blueprint-Stage Flow-Tab zeigt nun den **normalen interaktiven FlowEditor** statt eines statischen Mermaid-Diagramms.
  - Entfernung des `blueprintContainer`-Blocks und `renderFlowDiagram()`-Aufrufs aus `Editor.ts` (`render()`, L458-471).
  - Entfernung der `#blueprint-viewer` DOM-Element-Initialisierung (L1789-1797) und des `blueprintContainer`-Feldes.
  - Blueprint-Stage und alle anderen Stages verhalten sich im Flow-Tab nun identisch.

### [3.3.12] - 2026-02-19
- **Fix (Editor)**: Stage/Flow-Tab Trennung vollstÃƒÂ¤ndig wiederhergestellt.
  - `Editor.ts` (`render()`, L465-470): `stage-wrapper` wird jetzt nur noch bei `currentView === 'stage'` oder `'run'` eingeblendet.
  - Bisher wurde `stage-wrapper` im `else`-Zweig bedingungslos auf `flex` gesetzt, was dazu fÃƒÂ¼hrte, dass Stage-Elemente (z.B. Login-UI) auch im Flow-, JSON-, Pascal- und Manager-Tab sichtbar waren.
  - **Alle** Stage-Typen (Blueprint, Login, Dashboard etc.) sind nun korrekt: Stage-Tab zeigt Grafik/Variablen, Flow-Tab zeigt ausschlieÃƒÂŸlich den Flow-Editor.

### [3.3.11] - 2026-02-19
- **Fix (Editor)**: Blueprint-View-Trennung implementiert. Mermaid-Diagramme erscheinen nur noch im Flow-Tab, Stage-Tab ist grafisch bearbeitbar.
- **Fix (Sichtbarkeit)**: Globale Elemente (Services, Variablen) sind auf normalen Stages nun strikt unsichtbar (Regression des `isService`-Checks behoben).
- **Fix (Mermaid)**: Syntax-Error durch Leerzeichen in IDs behoben (`querySelector` failure).
- **Fix (Runtime)**: `switchStage` Logik korrigiert, um Rendering veralteter Runtime-Objekte beim Stage-Wechsel zu verhindern.
- **Cleanup**: HTML-Overlays aus Mermaid-Diagrammen entfernt fÃƒÂ¼r saubere Darstellung.

### [3.3.10] - 2026-02-19
- **Fix (FlowDiagramGenerator)**: UnterstÃƒÂ¼tzung fÃƒÂ¼r das `events` Property (neben `Tasks`) implementiert.
- **Fix (FlowDiagramGenerator)**: Der Generator durchsucht nun alle Stages nach Objekten, Tasks und Aktionen, um vollstÃƒÂ¤ndige Diagramme im Blueprint zu gewÃƒÂ¤hrleisten.
- **Fix (Editor)**: Sichtbarkeit von Elementen auf der Blueprint-Stage wiederhergestellt (Layering-Fix fÃƒÂ¼r `stage-wrapper`).
- **Deduplizierung**: Flow-Diagramme werden nun pro Objekt+Event eindeutig identifiziert.

### [3.3.9] - 2026-02-19
### Architektur-Anpassung: Blueprint-as-SSoT
- **Core**: Die `blueprint`-Stage ist nun die "Single Source of Truth" (SSoT) fÃƒÂ¼r alle globalen Elemente (Tasks, Aktionen, Variablen, Dienste).
- **Registry**: `ProjectRegistry` angepasst, um globale Elemente dynamisch aus der Blueprint-Stage aufzulÃƒÂ¶sen, auch wenn keine Wurzel-Arrays im JSON vorhanden sind.
- **Sichtbarkeit**: Globale Dienste (wie API-Server) werden nun auf allen Stages als Referenz-Objekte ("Ghosts") angezeigt.
- **Visualisierung**: `FlowDiagramGenerator` korrigiert, um Diagramme basierend auf der Blueprint-Logik stage-ÃƒÂ¼bergreifend zu generieren.
- **Automation**: `AgentController` aktualisiert, damit neue globale Logik direkt in der Blueprint-Stage angelegt wird.

## [3.3.8] - 2026-02-19
- **Feature**: Blueprint-Flow-Visualisierung implementiert.
    - Automatisches Rendering aller Task-Flows via Mermaid beim Betreten der Blueprint-Stage.
    - Dedizierter `#blueprint-viewer` Container und CSS-Optimierung.
- **Fix**: Datenbereinigung in `project.json`.
    - Redundante globale Actions (`GotoDashboard`, `ShowLoginError`, `ClearPIN`) entfernt.
    - Single Source of Truth: Diese Aktionen werden nun korrekt aus der Blueprint-Stage geladen.

### [3.3.7] - 2026-02-19
- **Fix**: Robuste Stage-Navigation implementiert.
    - `navigate_stage` nutzt jetzt primÃƒÂ¤r `TStageController.goToStage()` direkt (host-unabhÃƒÂ¤ngig).
    - `UniversalPlayer.handleNavigation()` um `stage:`-Behandlung erweitert (Fallback).
    - Standalone-Player kann jetzt Stage-Wechsel korrekt durchfÃƒÂ¼hren.
- **Feature**: Erster UseCase via AgentController API (`build_login_flow.ts`).
    - `AttemptLogin` Task um Login-Branch erweitert (Gutfall/Schlechtfall).
    - Actions `GotoDashboard`, `ShowLoginError`, `ClearPIN` programmatisch erstellt.
    - Flow-Diagramm wird beim ÃƒÂ–ffnen automatisch regeneriert (Self-Healing).

### [3.3.6] - 2026-02-19
- **Feature**: AI Agent Controller API (`AgentController.ts`) eingefÃƒÂ¼hrt.
    - Bietet eine typsichere "High-Level" API fÃƒÂ¼r AI-Agenten zur Projekt-Manipulation.
    - **Architektur-Schutz**: Verhindert aktiv die Erstellung von Inline-Actions (erzwingt globale Definition + Referenz) und stellt konsistente Task-Registrierung (Global + Stage) sicher.
    - **Flow-Konsistenz**: Implementierung der "Scorched Earth" Strategie fÃƒÂ¼r FlowCharts Ã¢Â€Â“ bei logischen ÃƒÂ„nderungen am Task wird das Diagramm gelÃƒÂ¶scht, um eine saubere Neu-Generierung durch den `FlowEditor` zu erzwingen.

### [3.3.5] - 2026-02-19
- **Bugfix**: `RuntimeVariableManager` loggte Variablen-ÃƒÂ„nderungen als `[object Object]`.
    - Behoben durch explizite `JSON.stringify` Konvertierung von Objekten im Logging.
    - Zudem wurde der Variablen-Lookup verbessert, sodass `currentUser` auch gefunden wird, wenn der Zugriff ÃƒÂ¼ber die ID `var_currentUser` erfolgt.
- **Bugfix**: `RuntimeVariableManager` speicherte Variablen unter ihrer ID (`var_...`), wenn diese so gesetzt wurden.
    - Behoben: Variablen werden nun *immer* unter ihrem Namen (`currentUser`) gespeichert, selbst wenn der Setter die ID verwendet.
    - **Fuzzy-Lookup**: Falls der exakte Match fehlschlÃƒÂ¤gt, wird versucht, das PrÃƒÂ¤fix `var_` zu ignorieren, um die Variable zu finden.
- **Refactoring (Global Variables)**: `RuntimeVariableManager` baut nun beim Start einen Index aller globalen Variablen aus *allen* Stages auf.
    - Damit werden Variablen wie `currentUser` (definiert in `Blueprint`, genutzt in `Login`) korrekt gefunden und aufgelÃƒÂ¶st.
    - Das behebt alle Probleme mit Cross-Stage-Bindings und Variable-Settern.
- **Bugfix (Reactive Binding)**: Bindings wie `${currentUser.name}` funktionierten nicht, weil `ReactiveRuntime` Updates unter der ID (`var_currentUser`) erhielt, aber Bindings auf den Namen (`currentUser`) warteten.
    - Behoben: `RuntimeVariableManager` aktualisiert nun `ReactiveRuntime` immer unter dem Variablennamen (`actualProp`).
    - **Ergebnis**: Variablen-Werte haben nun korrekt Vorrang vor Komponenten-Objekten gleichen Namens. `${score}` liefert den Wert, nicht das Objekt.

### [3.3.4] - 2026-02-19
- **Tweak**: Verbesserte Debug-Ausgaben in `StandardActions.ts` (http/JWT).
    - **Namen statt IDs**: Das Log zeigt nun den sprechenden Variablennamen (z.B. "currentUser") anstelle der internen ID ("var_currentUser"), sofern auflÃƒÂ¶sbar.
    - **Objekt-Darstellung**: JSON-Objekte werden explizit als String (`JSON.stringify`) geloggt, um `[object Object]`-Anzeigen im Log (insb. DebugLogViewer) zu vermeiden.

### [3.3.3] - 2026-02-19
- **Feature**: Automatische JWT-Verarbeitung in `StandardActions.ts` (Action: `http`).
    - **Token**: Wird bei erfolgreichem Login (`requestJWT: true`) automatisch in `localStorage` (`auth_token`) gespeichert.
    - **User-Unwrapping**: Falls die Antwort ein `user`-Objekt enthÃƒÂ¤lt, wird dieses nun direkt in die `resultVariable` geschrieben (anstatt der vollen Response), um den Zugriff (z.B. `${currentUser.name}`) zu vereinfachen.
- **Doku**: Aktualisierung der `DEVELOPER_GUIDELINES.md` bezÃƒÂ¼glich der neuen "Magic"-Logik.

### [3.3.2] - 2026-02-19
- **Refactoring**: Entfernung aller verbleibenden Referenzen auf `JSONInspector.ts` in der Dokumentation (`DEVELOPER_GUIDELINES.md`, `UseCaseIndex.txt`, etc.). Das System nutzt nun vollstÃƒÂ¤ndig die modulare `InspectorHost`-Architektur.
- **Refactoring**: Konsistente Umbenennung von `jsonInspector` zu `inspector` im gesamten Codebase (`Editor.ts`, `EditorCommandManager.ts`).
- **Fix**: Behebung diverser TypeScript-Fehler (unused parameters, potentially undefined objects) wÃƒÂ¤hrend des Refactorings.

### [3.3.1] - 2026-02-19
- **Fixed**: Vite-Proxy fÃƒÂ¼r `/platform` hinzugefÃƒÂ¼gt (behebt JSON-Parsing-Fehler beim Force Reload).
- **Changed**: MenÃƒÂ¼-Struktur bereinigt (Redundanzen entfernt, neue Kategorien "Plattform" und "Werkzeuge").
- **Fixed**: AuthCode/currentPIN Interpolationsfehler in `project.json` behoben.

### [3.3.0] - 2026-02-19
- **Force Reload**: Implementierung einer "Vom Server neu laden" Funktion im Editor (`Editor.ts`, `PPersistenceService.ts`), um den LocalStorage gezielt zu ÃƒÂ¼berschreiben.
- **Login AuthCode Fix**: Behebung des "Missing authCode" Fehlers durch Korrektur der Variablen-Referenz (`global.currentPIN` -> `currentPIN`) in der `project.json`.
- **Architecture**: Umzug der Login-Tasks/Actions in die globale `stage_blueprint`.
- **Inline-Action Cleanup**: VollstÃƒÂ¤ndige Entfernung redundanter Inline-Aktionen aus `stage_login` und `stage_role_select`.
- **Lint**: Behebung eines Trailing-Comma Fehlers in der `project.json`.

- **JWT Runtime Safety**: Automatische URL- und Method-Absicherung in `StandardActions.ts` fÃƒÂ¼r `requestJWT` Anfragen.
- **DataAction Persistence Fix**: Robuste Eigenschafts-Synchronisation in `FlowDataAction.ts` (Mirroring) und Legacy-Fallbacks (`resource`, `property`, `variable`) in Editor und Runtime zur Sicherstellung der Datenkonsistenz.

### [0.9.4] - 2026-02-18
### Added
- **Smart Variable Inspector**: Kontextsensitive Anzeige von Feldern (Min/Max, Intervalle, Trigger) basierend auf dem gewÃƒÂ¤hlten Variablentyp via `visible`-Property in JSON-Templates.
- **Threshold Events**: Neue Events fÃƒÂ¼r Schwellwerte (`onThresholdReached`, `onThresholdLeft`, `onThresholdExceeded`) im Inspector hinzugefÃƒÂ¼gt.
- **Variable Scope**: Auswahl des Geltungsbereichs (Ã°ÂŸÂŒÂŽ Global vs Ã°ÂŸÂŽÂ­ Stage) im Inspector wiederhergestellt.
- **Event-Templates**: UnterstÃƒÂ¼tzung fÃƒÂ¼r spezialisierte Event-Templates in Handlern (`getEventsTemplate`) und Implementierung von `inspector_variable_events.json` fÃƒÂ¼r typspezifische Events.
- **InspectorContextBuilder**: Erweitert um `availableModels` zur Auswahl von Daten-Schemata bei Objekt-Variablen.
- **InspectorHost**: Implementierung der `visible`-Evaluierung fÃƒÂ¼r UI-Elemente und dynamisches Rendering des "Events"-Reiters.

### Fixed
- **Inspector Tab-Switch Fix**: Behebung des Fehlers "Kein Objekt ausgewÃƒÂ¤hlt" beim Umschalten zwischen Eigenschaften und Events durch interne Selektions-Persistenz im `InspectorHost`.

### [0.9.3] - 2026-02-17
### Added
- **Inspector**: Support for specialized, minimal templates for Flow nodes and Variables.
- **Inspector**: Added `inspector_flow.json` and `inspector_variable.json` to reduce UI clutter.
- **Inspector**: Fixed name editing in Flow nodes by binding to the `Name` property.
- **Inspector**: Removed geometry and parameter clutter from Task Inspector.
- **Inspector**: Added support for rendering klickable buttons in dynamic property lists.
- **Refactoring**: Fixed a crash in `RefactoringManager` during Task renaming when encountering malformed action sequences.
- **Refactoring**: Enabled reliable Task renaming via the Inspector.
### Fixed
- **Inspector**: Dropdowns fÃƒÂ¼r Tasks und Actions werden nun dynamisch via `ProjectRegistry` befÃƒÂ¼llt (`source: 'tasks'`), was "Geister-EintrÃƒÂ¤ge" nach dem LÃƒÂ¶schen verhindert.
- **Flow Editor:** Fix fÃƒÂ¼r die Synchronisation des Task-Dropdowns bei Umbenennungen.
- **Inspector**: Automatisches Labeling fÃƒÂ¼r JSON-Templates via `label` Property implementiert.
- **Inspector**: `InspectorContextBuilder` eingefÃƒÂ¼hrt, um Dropdown-Listen (`availableDataStores`, `availableVariablesAsTokens`, etc.) dynamisch zu befÃƒÂ¼llen.
- **Inspector**: Refinement der Dropdowns (Namen statt IDs, benutzerfreundliche Variablen-Tokens, FeldvorschlÃƒÂ¤ge angepasst an `db.json`).
- **Inspector**: Verhindert doppelte Anzeige von Standard-Eigenschaften, wenn ein spezialisiertes Template aktiv ist.
- **Inspector**: UnterstÃƒÂ¼tzung fÃƒÂ¼r Platzhalter (`placeholder`) in Dropdowns hinzugefÃƒÂ¼gt.
- **Runtime:** Verbesserung der `http` Action; unterstÃƒÂ¼tzt nun explizite `false` RÃƒÂ¼ckgabewerte bei 401/Simulationsfehlern zur Triggerung von Flow-Verzweigungen.
- **Doku:** Neuer Umsetzungsplan fÃƒÂ¼r JWT-Authentifizierung via `DataAction` (blau) Nodes.
- **FlowEditor**: Optimierung: Verhindert unnÃƒÂ¶tiges Neuladen des Diagramms (`setProject` im `Editor` fÃƒÂ¼r Inspector-Events deaktiviert) und erzwingt die Auswahl des neuen Namens (Auto-Recovery).
- [x] Korrekte Verwendung von `Name` (Setter) vs. `name` (Getter) bei Flow-Elementen sichergestellt.
- [x] Flow-Editor: Unterscheidung zwischen `Action` (orange/linear) und `DataAction` (blau/verzweigend). Nur `DataAction` unterstÃƒÂ¼tzt grafische Success/Error-Abzweigungen.
- **Dialogs**: Auch Action-Dialoge nutzen nun die dynamische `ProjectRegistry`-Quelle fÃƒÂ¼r Parameter-Dropdowns.
### Changed
- **Inspector**: Extended `IInspectorHandler` interface to allow handlers to define custom templates.

## [0.9.2] - 2026-02-17
### Fixed
- [x] Fix Flow Editor selection flickering (Originator: 'flow-editor')
- [x] Bind `flowEditor.onObjectSelect` in `Editor.ts`
- [x] Assign unique IDs to `FlowConnection`
- [x] Search for connections in `EditorCommandManager.findObjectById`
- [x] Fix `DataAction` Inspector Synchronization
    - [x] Update `FlowAction.getActionDefinition` (implicit naming lookup)
    - [x] Update `FlowDataAction.getActionDefinition` (implicit naming lookup)
    - [x] Set `isLinked` automatically on name match
    - [x] Verify fix with `npm run test`
- [x] Documentation & Finalization
    - [x] Update `UseCaseIndex.txt`
    - [x] Update `CHANGELOG.md`
    - [x] Final QA Report check
- **Fix:** Expression-Resolution im Inspector via `ExpressionParser` (unterstÃƒÂ¼tzt komplexe Bindings & selectedObject).

### [0.9.0] - 2026-02-17
### Added
- **Major Architecture Upgrade: Modular OO-Inspector**: 
  - Umstellung des `JSONInspector` auf eine objektorientierte Architektur (`InspectorHost`, `InspectorRenderer`, `InspectorEventHandler`, `InspectorRegistry`).
  - Modularisierung der Logik in spezialisierte Handler (`VariableHandler`, `FlowNodeHandler`, `InspectorActionHandler`).
  - Behebung von technischer Schuld: Eliminierung des 1600+ Zeilen Monolithen durch modernstes Clean-Code Design.
  - Implementierung einer Legacy-KompatibilitÃƒÂ¤tsschicht fÃƒÂ¼r stabilen Editor-Betrieb.

## [3.0.0] - 2026-02-17
### Added
- **Major Architecture Upgrade: Modular OO-Inspector**: 
  - Umstellung des `JSONInspector` auf eine objektorientierte Architektur (`InspectorHost`, `InspectorRenderer`, `InspectorEventHandler`, `InspectorRegistry`).
  - Modularisierung der Logik in spezialisierte Handler (`VariableHandler`, `FlowNodeHandler`, `InspectorActionHandler`).
  - Behebung von technischer Schuld: Eliminierung des 1600+ Zeilen Monolithen durch modernstes Clean-Code Design.
  - Implementierung einer Legacy-KompatibilitÃƒÂ¤tsschicht fÃƒÂ¼r stabilen Editor-Betrieb.


---

> [!NOTE]
> Weitere historische EintrÃ¤ge findest du in [CHANGELOG_ARCHIVE.md](CHANGELOG_ARCHIVE.md).
# #   [ U n r e l e a s e d ] \ n \ n # # #   F i x e d \ n -   * * F l o w E d i t o r   B u g f i x * * :   V e r b i n d u n g e n   ( A r r o w s )   z w i s c h e n   N o d e s   v e r h i e l t e n   s i c h   i n s t a b i l   u n d   b r a c h e n   b e i m   Z i e h e n   a b .   U r s a c h e   w a r   a )   e i n e   z u   e m p f i n d l i c h e   \ u p d a t e P a t h \ - T r e n n u n g ,   b )   v e r d e c k t e   H o v e r / C l i c k - E v e n t s   d u r c h   d i e   S V G / D I V   L i n i e   ( \ p o i n t e r - e v e n t s :   n o n e \   w ä h r e n d   D r a g   g e f i x t )   u n d   c )   e i n e   E n d l o s s c h l e i f e   z u m   I n s p e c t o r ,   d e r   a u f   T e i l a u s w a h l e n   v e r f r ü h t e   A u t o S a v e s   ( u n d   r e - r e n d e r s )   t r i g g e r t e . 
 
 
- **Bugfix (Layout):** Behebung von Verschiebungen im Run-Mode (Stage roomDashboard).
  - UnterstÃ¼tzung fÃ¼r TDataList im StageRenderer.ts hinzugefÃ¼gt.
  - Skalierungs-Race-Condition im UniversalPlayer.ts behoben (cellSize Sync).

### Fixed (v3.9.15)
- **Run-Mode Diskrepanz**: Bindings in x, y, width und height werden nun in GameRuntime.ts korrekt interpoliert.
- **Blueprint-Visibility**: Geerbte UI-Elemente aus der Blueprint-Stage sind nun im Run-Mode sichtbar.

- **Edit-Mode Layout**: Fix fÃ¼r Docking-Positionierung. Ausgerichtete Komponenten (Top, Bottom, etc.) ignorieren nun x/y Offsets, um Fehlplatzierungen auÃŸerhalb der Stage zu verhindern.
