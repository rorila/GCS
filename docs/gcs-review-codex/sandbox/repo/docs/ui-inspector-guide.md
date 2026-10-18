# UI & Inspector Guide

## Inspector-Architektur
Modulares System (v3.0.0):
- **InspectorHost.ts**: Orchestrierung.
- **InspectorRenderer.ts**: Visuelle Komponenten.
- **InspectorRegistry.ts**: Mapping von Klassen auf Templates.
- **InspectorEventHandler.ts**: UI-Events.
- **Handler-Pattern**: Fachlogik in spezialisierten Handlern (z.B. `VariableHandler.ts`).

## Smart Variable Inspector
- **Sichtbarkeits-Logik**: `visible`-Eigenschaft in JSON-Templates basierend auf Regex.
- **Event-Templates**: Spezialisierte Event-Templates (z.B. `inspector_variable_events.json`).
- **Scope-Selection**: Wahl zwischen `global` (🌎) und `stage` (🎭).

## Stage Interaction & Scaling
- **Koordinaten-Korrektur**: Browser-Skalierung (Zoom) berücksichtigen (`getBoundingClientRect()`).
- **Performance**: DOM-Abfragen während `mousemove` vermeiden (Caching in `Map`).

## Dialog-Binding (v2.16.18)
- Bindings in JSON-Dialogen MÜSSEN das Binding `"action": "updateValue"` besitzen, um zum Modell (`dialogData`) zurückzuschreiben.
- **isCollectingData**: Guard im `JSONDialogRenderer`, um Re-Renders während der Datensammlung zu verhindern.

## Reactive Pfad-Auflösung
- **Transparency vs. Metadata Fallback**: `PropertyHelper` versucht zuerst, die Eigenschaft im Inhalt der Variable zu finden, dann in der Komponente selbst.
- Erlaubt `${currentUser.name}` (Daten) und `${selectedObject.value}` (Inspector) gleichzeitig.
