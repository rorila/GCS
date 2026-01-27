# Changelog

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
