# Zukünftige Anforderungen & Refactoring-Strategie

## 1. Neue Features (Backlog)

### [ ] Vertiefung der Trigger-Logik
- **Ziel**: Mächtigere Verknüpfungen zwischen Variablen und Objekten.
- **Konzept**: 
    - Spezialisierte Events (`onTriggerEnter`, `onValueReached`) im Flow-Editor hervorheben.
    - Visuelle Indikatoren, wenn eine Variable ein Objekt steuert.
    - Unterstützung komplexer Bedingungen direkt im Trigger-Editor.

### [ ] Inspector-UX: Suche & Filter
- **Ziel**: Schnelleres Finden von Eigenschaften in komplexen Komponenten.
- **Konzept**: 
    - Suchfeld oben im Inspektor.
    - Filter-Optionen: "Nur aktive Bindings", "Basis-Eigenschaften", "Events".
    - Gruppierung einklappbar gestalten.

### [ ] Flow-Editor: Intelligentes Auto-Layout
- **Ziel**: Automatische Erzeugung sauberer Diagramme aus Pascal-Code.
- **Konzept**: 
    - Implementierung eines Tree-Layout-Algorithmus (Sugiyama-basiert).
    - Automatische Platzierung von IF-ELSE Zweigen (True = Rechts, False = Links).
    - Grid-Ausrichtung und Kollisionsvermeidung für Pfeile.

### [ ] Dynamische Ressourcen & Visueller Data-Modeler
- **Ziel**: Wegfall von statischen URLs; Datenstrukturen werden visuell definiert.
- **Konzept**: 
    - Server scannt `db.json` und bietet Top-Level-Keys als Ressourcen an.
    - `DataAction` nutzt ein "Ressource"-Dropdown statt URL-Input.
    - Visueller Designer zur Definition von Feldern und Datentypen.
    - Automatisches API-Routing (`/api/data/:resource`) basierend auf dem Modell.

---

## 2. Modularisierung (Code-Hygiene)

### [ ] Editor.ts (Ziel: < 1000 Zeilen)
- **EditorInteractionService**: Extraktion von Tastenkombinationen, Undo/Redo und Copy/Paste.
- **EditorPersistenceManager**: Auslagerung von LocalStorage-Synchronisation, Export-Logik und Datei-Downloads.
- **EditorSyncOrchestrator**: Zentralisierung der Trinity-Sync Steuerung (Pascal <-> JSON <-> Flow).
- **EditorSelectionManager**: Management des Selektions-Status und der Highlights auf der Stage.

### [ ] InspectorHost.ts (ehemals JSONInspector)
- **InspectorUIBuilder**: Trennung der DOM-Erzeugung von der Logik.
- **InspectorFieldRegistry**: Zentralisierung der spezialisierten Editoren (Farbe, Checkbox, Select).
- **InspectorDataBinding**: Reines Management der reaktiven Bindungen an das Projekt-Objekt.

### [ ] FlowEditor.ts
- **FlowLayoutEngine**: Einführung des oben genannten Auto-Layouts als separate Klasse.
- **FlowRendererSVG**: Trennung der SVG-Darstellungs-Logik von der Knoten-Daten-Logik.
- **FlowSyncService**: Mapping zwischen `actionSequence` und den Diagramm-Knoten.
