# Changelog

## [1.5.0] - 2024-05-20
### Architektur-Optimierung & Modularisierung
- **Monolithen-Aufbruch**: `Editor.ts` und `GameRuntime.ts` wurden in spezialisierte Manager modularisiert (Stage, View, Variable, Runtime).
- **Dynamisches Action-System**: Einführung der `ActionRegistry` und `StandardActions`. Aktionen werden nun rein datengetrieben über Metadaten gerendert (`TActionParams`).
- **Optimierte Exporter**: Der `GameExporter` nutzt nun eine intelligente Meta-Filterung (Whitelist + Deep-Clean), anstatt hartcodierter Listen.
- **Typensicherheit**: Umstellung von `TComponent` auf abstrakte Metadaten-Methoden (`getInspectorProperties`).
- **Performance**: Reduzierung der JSON-Schema-Größe durch dynamische Parameter-Generierung.

## [1.2.0] - 2024-05-19
- Modularisierung der Kernkomponenten
- Refactoring der Event-Struktur
- Fehlerbehebungen im Flow-Editor
