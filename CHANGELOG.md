# Changelog
3: 
4: ## [2.1.7] - 2026-01-30
- Behebung der Textkürzung: Aktionen im Flow-Diagramm werden nun nur noch visuell gekürzt dargestellt.
- Im Inspector, Pascal-Code und JSON-Export bleiben alle Texte (z.B. Nachrichten) vollständig erhalten.

## [2.1.6] - 2026-01-30
5: ### Fix: Image Visibility & Template Literals
6: - **Fix: Bild-Sichtbarkeit**: Der Stage-Renderer respektiert nun die `visible`-Eigenschaft auch dann, wenn eine Bild-Quelle (`backgroundImage` / `src`) gesetzt ist. Zuvor wurde `display: flex` erzwungen.
7: - **Verbesserung: Template-Interpolation**: `PropertyHelper.interpolate` unterstützt nun Literale (`true`, `false`, Zahlen) innerhalb von `${}`-Blöcken. Zudem werden Leerzeichen innerhalb der geschweiften Klammern (z.B. `${true }`) nun korrekt ignoriert.
8: 

## [2.1.5] - 2026-01-29
### Smart-Sync & Scoping
- **Explizites Scoping**: Einführung der `scope`-Eigenschaft für `GameAction` und `GameTask`. Neue Aktionen liegen standardmäßig im `stage`-Scope, können aber auf `global` umgestellt werden.
- **Smart-Sync im Inspector**: Verlinkte Aktionen und Tasks sind nun im Inspector editierbar. Änderungen werden automatisch in die Original-Definitionen (global oder stage-lokal) zurückgeschrieben.
- **Scope-Aware Filtering**: Der `ActionEditor` und der `JSONInspector` filtern verfügbare Variablen und Objekte nun intelligent basierend auf dem gewählten Scope.
- **Visuelles Feedback**: Emojis (🌎 für Global, 🎭 für Stage) zeigen im Inspector und Editor den Ursprung/Scope von Ressourcen an.
- **Bugfix: Options-Binding**: Fehler behoben, bei dem der Inspector beim Rendern von Dropdowns mit Bindings (`${...}`) abstürzte.
- **Bugfix: Smart-Sync Schreibschutz**: Fehler behoben, bei dem verlinkte Actions im Inspector fälschlicherweise als schreibgeschützt markiert wurden (Logikfehler in `isActionOrTask`).
- **Bugfix: Label-Persistenz**: Behebung des Fehlers, bei dem Style-Änderungen an Labels (Hintergrund, Schriftgröße, Ausrichtung) nach dem Neuladen des Projekts verloren gingen. Die Hydrierungs-Logik unterstützt nun Punkt-Notationen für verschachtelte Eigenschaften.

## [2.1.4] - 2026-01-29
### Bugfix & Flow Editor
- **Fix: Action-Details**: Behebung des Fehlers, bei dem Action-Knoten im Detail-Modus "(nicht definiert)" anzeigten. Die Logik zur Auflösung der Action-Definition wurde verbessert, um lokale Daten korrekt als Fallback zu nutzen.

## [2.1.3] - 2026-01-29
### Usability & Toolbox
- **Optimierung der Toolbox-Übersicht**: Alle Sektionen der Toolbox im Stage-Editor sind nun standardmäßig eingeklappt, um eine übersichtlichere Arbeitsumgebung zu schaffen.

## [2.1.2] - 2026-01-29
### Usability & Inspector
- **Fix: Inspector-Eigenschaften**: Spezifische Inspector-Templates (wie für Tasks und Actions) werden nun priorisiert. Dies behebt den Fehler, dass Name und Beschreibung im Inspector nicht sichtbar oder uneditierbar waren.
- **Stabilität**: Die automatische Selektion nach der Task-Erstellung wurde stabilisiert (Timing-Fix), um eine zuverlässige Anzeige im Inspector zu gewährleisten.

## [2.1.0] - 2026-01-29
### Usability & Task Creation
- **Optimierung der Task-Erstellung**: Der `prompt()` beim Erstellen eines neuen Tasks wurde entfernt. Ein Klick auf `+` generiert nun sofort einen Task mit Standardnamen (`ANewTask`), wechselt in dessen Flow-Ansicht, fügt einen Task-Node ein und selektiert diesen für den Inspector.

## [2.0.2] - 2026-01-29
### Bugfix & Event Discovery
- **Fix Variablen-Events**: Korrektur der Event-Entdeckung im Pascal-Generator. Er sucht nun sowohl in den Top-Level-Properties als auch im `Tasks`-Objekt der Variablen nach Event-Handlern. Dies stellt sicher, dass Events wie `onTriggerEnter` (die in der App im `Tasks`-Pattern gespeichert werden) korrekt generiert werden.

## [2.0.1] - 2026-01-29
### Refactoring & Stability
- **Generische Event-Generierung**: Der Pascal-Generator wurde refactored, um *alle* Variablen-Events (Pattern: `on[UpperCamelCase]`) dynamisch zu unterstützen, ohne dass diese hardcodiert sein müssen. Dies ermöglicht die nahtlose Erweiterung um eigene Events via `TKeyStore` oder Plugins.
- **Robustheit**: Verbesserte Fehlerbehandlung (`try-catch`) im Code-Generator verhindert Abstürze bei unvollständigen Projektdaten während der Entwicklung.

## [2.0.0] - 2026-01-29
### Trinity-Synchronisation (Pascal | JSON | Flow)
- **Zentraler Trinity-Sync**: Einführung von `refreshAllViews` als Hub zur sofortigen Synchronisation aller Editor-Sichten.
- **Dependency Indexing**: Neue Listen für Variablen, Tasks, Actions und Objekte in den Stage-Einstellungen inklusive Nutzungs-Häufigkeit (🔗).
- **Bugfix**: Behebung eines `Maximum call stack size exceeded` Fehlers in der `ProjectRegistry`, der durch zirkuläre Abhängigkeiten bei der Nutzungs-Berechnung verursacht wurde.
- **Automatischer Lifecycle**: 
  - Automatisches Löschen verwaister Aktionen (Orphan Cleanup).
  - Konsistente Aktualisierung von Event-Mappings nach Task-Umbenennungen.
- **Pascal-Integrität**: 
  - Synchronisation von Prozedur-Parametern und lokalen Variablen (`VAR`-Blöcke) direkt in das JSON-Datenmodell.
  - Generierung sprechender Aktions-Namen basierend auf Zielen und Properties.
- **Variablen-Events**: Vollständige Unterstützung für Variablen-Events im Pascal-Editor. Events wie `onValueChanged` oder `onThresholdReached` werden nun als Prozeduren (`PROCEDURE VariableName.EventName`) angezeigt und können direkt im Code bearbeitet werden.
- **Cross-Refactoring**: Automatische Erkennung und Umbenennung von Aktionen, die namentlich an Objekte gebunden sind (z.B. `Label.caption` -> `Neu.caption`) inklusive rekursiver Updates aller Flow-Diagramme (Global & Stage).
- **Stabilität**: Robuste JSON-Vorschau mit Deep-Copy-Isolierung für Stages.

## [1.9.9] - 2026-01-29
### Pascal-Editor & Rendering Optimierungen
- **Intelligente Action-Synchronisation**: Der Pascal-Parser erkennt nun bestehende Aktionen (`messageVar.triggerOff` etc.) anhand ihrer Position und Logik wieder und aktualisiert deren `changes`, statt neue redundante Aktionen zu erstellen.
- **Smart-Sync für Casing**: Der Parser erkennt nun die projektweit bevorzugte Schreibweise von Properties (z.B. `fillColor`). Dies verhindert Dubletten im JSON und stellt die Kompatibilität mit der Engine sicher, während der Pascal-Code weiterhin lesbare Großschreibung nutzt.
- **Namenserhalt**: Sprechende Namen von Aktionen bleiben bei Code-Änderungen erhalten.
- **Flow-Garantie**: Automatische Invalidierung und Neu-Generierung von Flow-Diagrammen sorgt für sofortige visuelle Synchronisation nach Pascal-Änderungen.
- **Bugfix**: Korrekte Unterscheidung zwischen Task-Aufrufen und Aktions-Zuweisungen im Parser.


## [1.9.7] - 2026-01-28
### Features
- **Pascal-zu-Flow Rekonstruktion**: Vollautomatische Generierung von Flow-Diagrammen aus Pascal-Code.
- **Intelligente Konnektivität**: Automatische Verknüpfung von Nodes inkl. True/False-Zweigen und Schleifen-Rücksprüngen.
- **Auto-Layout**: Räumliche Anordnung von Verzweigungen für maximale Übersichtlichkeit nach Code-Änderungen.

## [1.9.6] - 2026-01-28
### Features
- **Bidirektionaler Pascal-Editor**: Änderungen im Pascal-Code werden nun sofort in die JSON-Daten (Tasks, Variablen, Event-Mappings) zurückgeschrieben.
- **Flow-Diagramm Invalidation**: Bei Code-Änderungen an Aufgaben werden die zugehörigen Flow-Diagramme automatisch invalidiert, um eine korrekte visuelle Neu-Generierung sicherzustellen.
- **Stage-Aware Parsing**: Korrektes Zurückschreiben von Änderungen auch in isolierten Stage-Ansichten (kein Datenverlust bei globalen Aufgaben).

## [1.9.5] - 2026-01-28
### Bugfixes & Features
- **Pascal-Viewer**: Unterstützung für Objekt-Event-Handler implementiert. Events (z.B. `onClick`) werden nun als Prozeduren nach dem Muster `procedure ObjectName.EventName` angezeigt.
- **Detaillierungsgrad**: Bessere Sichtbarkeit der Verknüpfung zwischen UI-Elementen und Logik im Pascal-Code.

## [1.9.4] - 2026-01-28
### Bugfixes
- **Pascal-Viewer**: Einführung einer super-robusten Task-Aggregation, die alle Stages und FlowCharts (global & lokal) durchsucht. Behebt das Problem fehlender Tasks in isolierten Ansichten.
- **EditorViewManager**: Veraltete Stage-Filterlogik entfernt, um Konsistenz mit der Haupt-Editor-Logik sicherzustellen.
- **PascalGenerator**: Erweiterte Relevanz-Prüfung, die auch Diagramme ohne direkte Referenzierung berücksichtigt.

## [1.9.3] - 2026-01-28
### Bugfixes
- **JSON-Viewer & Editor**: Behebung von Abstürzen bei der Anzeige komplexer Projekte. Einführung von `safeDeepCopy`, um zirkuläre Referenzen und reaktive Proxies vor der Serialisierung sicher zu handhaben.
- **Pascal-Viewer**: Reparatur der Task-Anzeige. Der Generator aggregiert nun korrekt globale UND stage-lokale Tasks sowie Variablen.
- **Action-Rendering**: Erweiterung des Pascal-Generators um moderne Action-Typen wie `call_method` und `navigate_stage`.
- **Robustheit**: Implementierung von `try-catch` Blöcken in `refreshJSONView` und visuelles Feedback bei Serialisierungsfehlern statt Silent-Fails oder UI-Freezes.
- **Dienst-Integration**: Einbettung der Klon-Logik in den `Editor`-Kern zur Entkopplung von Live-Daten und UI-Vorschau.

## [1.9.2] - 2026-01-28

## [1.9.1] - 2026-01-27
### Build-Fixes & Maintenance
- **Build-Fixes**: Behebung von TypeScript-Fehlern (TS6133) durch Entfernen unbenutzter Variablen und Importe in `ChangeRecorder.ts` und `PlaybackEngine.ts`.
- **Stabilitäts-Check**: Erfolgreicher Full-Build des Projekts (`npm run build`).

## [1.9.0] - 2026-01-27
### ChangeRecorder System (Undo/Redo & Playback)
- **Undo/Redo**: Volle Unterstützung für `Strg+Z` / `Strg+Y` im Editor.
- **Recording**: Aufzeichnung von Editor-Sitzungen mit Mauspfad-Tracking (Drag-Paths).
- **Playback**: Animiertes Abspielen von Aufzeichnungen mit Ghost-Cursor und Timeline-Steuerung.
- **Export/Import**: Austausch von Aufzeichnungen via `.gcsrec` Dateien für Tutorials und Demos.
- **Batch-Actions**: Gruppierung von Aktionen (z.B. Multi-Delete) für sauberes Rückgängigmachen.

## [1.8.0] - 2026-01-27
### Neue Komponente: TKeyStore
- **Schlüssel-Wert-Speicher**: Neue Variable `TKeyStore` zum Speichern und Abrufen von Datensätzen über eindeutige Schlüssel (z.B. Kundennummer)
- **CRUD-Operationen**: `create()`, `read()`, `update()`, `delete()`, `set()`, `get()`
- **Filter & Suche**: `filter()`, `find()`, `has()`, `keys()`, `values()`, `entries()`, `count()`, `clear()`
- **Events**: `onItemCreated`, `onItemUpdated`, `onItemDeleted`, `onItemRead`, `onNotFound`, `onCleared`

## [1.7.2] - 2026-01-27
### Binding-Dropdown Verbesserung
- **Variable-Auswahl via Select-Dropdown**: Der Binding-Modus im Inspector verwendet nun ein echtes `<select>` Dropdown anstatt eines `<datalist>`. Nutzer können jetzt alle verfügbaren Variablen direkt in einem klickbaren Dropdown sehen und auswählen, anstatt tippen zu müssen.

## [1.7.1] - 2024-05-23
### Variable Lifecycle Fix & Clean Initialization
- **Präzedenz-Korrektur**: Der `RuntimeVariableManager` bevorzugt nun beim Spielstart den `defaultValue` vor dem `value`. Dies stellt sicher, dass der im Editor definierte Startzustand eines Spiels respektiert wird.
- **Automatischer Komponenten-Sync**: Die `GameRuntime` synchronisiert nun beim Start und bei jedem Stage-Wechsel alle berechneten Variablenwerte zurück in die UI-Komponenten (`TVariable`, `TShape` etc.). Dies garantiert korrekte Datenbindungen (`${...}`) ab dem ersten Frame.
- **Saubere Initialisierung**: Variablen-Komponenten initialisieren sich nun mit `undefined`, um das Projekt-JSON schlank zu halten und unerwünschte Standardwerte (wie `0`) zu vermeiden, die die Logik sabotieren könnten.
- **Bereinigung**: Entfernung von verbosen Debug-Logs in `ExpressionParser`, `ReactiveRuntime` und `GameRuntime`.

## [1.7.0] - 2024-05-22
### Konsolidierung & Vereinfachung (Generalisierung)
- **Reaktivitäts-Fix & Initialisierung (V2)**: 
  - **Value-Priorität**: Der `RuntimeVariableManager` bevorzugt nun die `value`-Eigenschaft (Laufzeitwert aus JSON) vor der `defaultValue`. Dies stellt sicher, dass manuelle Änderungen im Editor korrekt in die Runtime übernommen werden.
  - **Start-Stage Fix**: Variablen der initialen Stage werden nun beim Spielstart korrekt geladen (zuvor wurden sie nur bei einem Stage-Wechsel initialisiert).
- **Zentraler Task-Lookup**: Der `TaskExecutor` ist nun die alleinige Instanz zur Auflösung von Event-Namen (z.B. `Obj.Event`). Er unterstützt rekursive Suchen und Variablen-Scoping.
- **Einheitliche Eigenschaften**: `TWindow` und alle Subklassen (Label, Button, etc.) nutzen nun primär `text` als Inhalts-Eigenschaft. `caption` bleibt als Alias für Abwärtskompatibilität erhalten.
- **Reaktivitäts-Fix & Globale Variablen**: 
  - Fix für globale Variablen: Komponenten aus der `Main`-Stage werden nun korrekt in alle Sub-Stages übernommen.
  - Variablen-Sync: `GameRuntime` führt nun einen initialen Sync der Komponenten-Werte in das Variablen-System durch.
  - Kontext-Priorität: Variablen-Komponenten (Proxies) haben nun im Auswertungs-Kontext Vorrang vor primitiven Datenwerten, was reaktive Bindungen wie `${score}` stabilisiert.
- **Schlanke Logik**: Der `RuntimeVariableManager` wurde von redundanter Suchlogik befreit und delegiert Aufgaben direkt an den `TaskExecutor`.

## [1.6.0] - 2024-05-21
### Reatives System & UI-Binding (Major Fix)

## [1.5.0] - 2024-05-20
### Architektur-Optimierung & Modularisierung
- **Monolithen-Aufbruch**: `Editor.ts` und `GameRuntime.ts` wurden in spezialisierte Manager modularisiert (Stage, View, Variable, Runtime).
- **Dynamisches Action-System**: Einführung der `ActionRegistry` und `StandardActions`. Aktionen werden nun rein datengetrieben über Metadaten gerendert (`TActionParams`).
- **Optimierte Exporter**: Der `GameExporter` nutzt nun eine intelligente Meta-Filterung (Whitelist + Deep-Clean), anstatt hartcodierter Listen.
- **Typensicherheit**: Umstellung von `TComponent` auf abstrakte Metadaten-Methoden (`getInspectorProperties`).
- **Performance**: Reduzierung der JSON-Schema-Größe durch dynamische Parameter-Generierung.
- **Bugfix JSON-View**: Die JSON-Ansicht ist nun entkoppelt vom Spielverlauf (keine redundanten Refreshes mehr in der Loop).
- **Bugfix Action-Editor**: Parameter (z.B. `changes`) werden nun korrekt synchronisiert; Unterstützung für `key=value` Syntax.
- **Dynamisches Task-Lookup**: Ausdrücke wie `ObjectName.EventName` werden nun automatisch in die im Flow-Editor zugewiesenen Tasks aufgelöst (Allgemeingültigkeit gewährleistet).

## [1.2.0] - 2024-05-19
- Modularisierung der Kernkomponenten
- Refactoring der Event-Struktur
- Fehlerbehebungen im Flow-Editor
