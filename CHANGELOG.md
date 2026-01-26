# Changelog

## [1.7.0] - 2024-05-22
### Konsolidierung & Vereinfachung (Generalisierung)
- **Zentraler Task-Lookup**: Der `TaskExecutor` ist nun die alleinige Instanz zur Auflösung von Event-Namen (z.B. `Obj.Event`). Er unterstützt rekursive Suchen und Variablen-Scoping.
- **Einheitliche Eigenschaften**: `TWindow` und alle Subklassen (Label, Button, etc.) nutzen nun primär `text` als Inhalts-Eigenschaft. `caption` bleibt als Alias für Abwärtskompatibilität erhalten.
- **Reaktivitäts-Fix**: Durch die Nutzung nativer Properties statt verdeckter Getter/Setter löst das Setzen von Texten in Actions nun zuverlässig UI-Updates aus.
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
