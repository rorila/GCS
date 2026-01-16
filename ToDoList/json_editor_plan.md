# Plan: JSON-basierter Editor ("Dogfooding")

## Vision

Der Editor wird selbst mit den gleichen JSON-Komponenten gebaut, die er zum Erstellen von Spielen verwendet. Dies validiert die Engine und macht den Editor selbst exportierbar, themebar und erweiterbar.

---

## Phase 1: Fehlende UI-Komponenten erstellen (Priorität: HOCH)

### 1.1 `TDropdown` (Select/Dropdown)

**Zweck:** Auswahl aus einer Liste von Optionen

**Properties:**
- `options: string[]` - Liste der Optionen
- `selectedIndex: number` - Aktuell ausgewählter Index
- `selectedValue: string` - Aktuell ausgewählter Wert

**Events:**
- `onChange` - Wird ausgelöst, wenn Auswahl geändert wird

**Verwendung im Editor:**
- Property-Typen auswählen (text, number, color, etc.)
- Action-Typen auswählen (property, increment, navigate, etc.)
- Objekt-Typen in Toolbox

---

### 1.2 `TCheckbox` (Checkbox/Toggle)

**Zweck:** Boolean-Werte ein/aus schalten

**Properties:**
- `checked: boolean` - Zustand (an/aus)
- `label: string` - Beschriftung neben Checkbox

**Events:**
- `onChange` - Wird ausgelöst bei Zustandsänderung

**Verwendung im Editor:**
- Grid sichtbar/unsichtbar
- Collision enabled/disabled
- Object visible/invisible

---

### 1.3 `TColorPicker` (Farbauswahl)

**Zweck:** Farben auswählen

**Properties:**
- `color: string` - Aktuelle Farbe (hex, rgb, etc.)

**Events:**
- `onChange` - Wird ausgelöst bei Farbänderung

**Verwendung im Editor:**
- Background Color
- Border Color
- Sprite Color

---

### 1.4 `TNumberInput` (Spezialisiertes Number Input)

**Zweck:** Zahlen mit Constraints eingeben

**Properties:**
- `value: number` - Aktueller Wert
- `min: number` - Minimalwert
- `max: number` - Maximalwert
- `step: number` - Schrittweite (z.B. 0.1, 1, 10)

**Events:**
- `onChange` - Wird ausgelöst bei Wertänderung

**Verwendung im Editor:**
- X, Y, Width, Height
- Velocity, Speed
- Grid Cols/Rows

---

### 1.5 `TSlider` (Range Slider)

**Zweck:** Numerische Werte visuell einstellen

**Properties:**
- `value: number`
- `min: number`
- `max: number`
- `step: number`

**Events:**
- `onChange`

**Verwendung im Editor:**
- Opacity (0-1)
- Volume (0-100)
- Speed-Einstellungen

---

## Phase 2: Reactive Variables System (Priorität: HOCH)

### 2.1 Variable Interpolation erweitern

**Aktuell:**
```typescript
// Nur in Actions: value.replace(/\$\{(\w+)\}/g, ...)
```

**Neu:**
```typescript
// In ALLEN Properties:
{
  "text": "${selectedObject.name}",
  "x": "${inspectorX}",
  "visible": "${activeTab == 'properties'}"
}
```

**Implementierung:**
- Property-Watcher in `GameRuntime`
- Auto-Update bei Variable-Änderung
- Expression-Evaluator (für `==`, `!=`, `>`, etc.)

---

### 2.2 Bidirektionales Binding

**Konzept:**
```json
{
  "className": "TTextInput",
  "name": "ObjectNameInput",
  "text": "${selectedObject.name}",  // Liest von Variable
  "Tasks": {
    "onChange": "UpdateObjectName"   // Schreibt zurück
  }
}
```

**Action:**
```json
{
  "name": "UpdateObjectName",
  "type": "property",
  "target": "$selectedObject",  // Dynamisches Target
  "changes": {
    "name": "${ObjectNameInput.text}"
  }
}
```

---

## Phase 3: Editor-Komponenten als JSON (Priorität: MITTEL)

### 3.1 Toolbar (Einfachster Start)

**Aktuell:** Hardcoded in `Editor.ts`

**Als JSON:**
```json
{
  "meta": { "name": "EditorToolbar" },
  "objects": [
    {
      "className": "TButton",
      "name": "SaveButton",
      "caption": "💾 Save",
      "x": 0, "y": 0,
      "Tasks": { "onClick": "SaveProject" }
    },
    {
      "className": "TButton",
      "name": "LoadButton",
      "caption": "📂 Load",
      "x": 5, "y": 0,
      "Tasks": { "onClick": "LoadProject" }
    },
    {
      "className": "TButton",
      "name": "PlayButton",
      "caption": "▶ Play",
      "x": 10, "y": 0,
      "Tasks": { "onClick": "PlayGame" }
    }
  ]
}
```

---

### 3.2 Toolbox (Komponenten-Palette)

**Aktuell:** `Toolbox.ts` mit hardcoded Buttons

**Als JSON:**
```json
{
  "objects": [
    {
      "className": "TButton",
      "name": "AddPanelBtn",
      "caption": "Panel",
      "Tasks": { "onClick": "AddPanel" }
    },
    {
      "className": "TButton",
      "name": "AddButtonBtn",
      "caption": "Button",
      "Tasks": { "onClick": "AddButton" }
    }
  ]
}
```

---

### 3.3 Inspector (Komplex - Hybrid-Ansatz)

**Strategie:** Inspector-Shell generiert JSON dynamisch

**TypeScript (Shell):**
```typescript
class Inspector {
    generateInspectorJSON(selectedObject: TWindow): GameProject {
        const properties = selectedObject.getInspectorProperties();
        
        const objects = properties.map((prop, index) => {
            return {
                className: this.getComponentType(prop.type),
                name: `${prop.name}Input`,
                x: 0,
                y: index * 2,
                // ... property-spezifische Konfiguration
            };
        });
        
        return { meta: {}, objects, tasks: [], actions: [] };
    }
    
    render() {
        const json = this.generateInspectorJSON(this.currentTarget);
        this.runtime = new GameRuntime(json, ...);
    }
}
```

**Vorteil:** Flexibilität + Wiederverwendung der Runtime

---

## Phase 4: Vollständiger JSON-Editor (Priorität: NIEDRIG)

### 4.1 Editor-Kern als JSON

**`editor.json`:**
```json
{
  "meta": { "name": "GameBuilderEditor" },
  "objects": [
    { "className": "TToolbar", "name": "MainToolbar" },
    { "className": "TToolbox", "name": "ComponentPalette" },
    { "className": "TStage", "name": "Canvas" },
    { "className": "TInspector", "name": "PropertyPanel" }
  ],
  "variables": [
    { "name": "selectedObject", "defaultValue": null },
    { "name": "activeTab", "defaultValue": "properties" },
    { "name": "currentProject", "defaultValue": null }
  ]
}
```

---

### 4.2 Spezielle Editor-Komponenten

**Neue Komponenten für Editor:**
- `TStage` - Canvas mit Grid, Drag & Drop
- `TInspector` - Property-Panel (generiert Sub-Components)
- `TToolbar` - Horizontale Button-Leiste
- `TToolbox` - Vertikale Komponenten-Palette
- `TTaskEditor` - Visueller Task-Editor
- `TActionEditor` - Visueller Action-Editor

---

## Implementierungs-Reihenfolge

### Woche 1-2: UI-Komponenten
1. ✅ `TDropdown` erstellen
2. ✅ `TCheckbox` erstellen
3. ✅ `TColorPicker` erstellen
4. ✅ `TNumberInput` erstellen
5. ✅ `TSlider` erstellen (optional)

### Woche 3: Reactive System
1. ✅ Variable Interpolation in Properties
2. ✅ Property-Watcher implementieren
3. ✅ Expression-Evaluator
4. ✅ Bidirektionales Binding testen

### Woche 4: Erste Editor-Komponente
1. ✅ Toolbar als JSON
2. ✅ Integration in Editor
3. ✅ Validierung & Testing

### Woche 5-6: Weitere Komponenten
1. ✅ Toolbox als JSON
2. ✅ Inspector (Hybrid-Ansatz)
3. ✅ Dialogs als JSON

### Woche 7+: Vollständiger Editor
1. ✅ Alle Editor-Teile als JSON
2. ✅ `editor.json` als Haupt-Datei
3. ✅ Export-Funktionalität

---

## Vorteile des JSON-Editors

### 1. Selbst-Validierung
- Jede Komponente wird im Editor getestet
- Bugs werden sofort sichtbar
- Feature-Parity garantiert

### 2. Exportierbarkeit
- Editor kann als Standalone-App exportiert werden
- Offline-Nutzung möglich
- Versionierung einfacher

### 3. Themes & Customization
- Editor-Layout als JSON änderbar
- Farb-Themes als JSON
- Benutzerdefinierte Layouts

### 4. Plugins & Erweiterungen
- Neue Komponenten als JSON hinzufügen
- Custom Inspectors für spezielle Objekte
- Community-Erweiterungen möglich

---

## Risiken & Mitigationen

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| Performance-Probleme bei vielen Komponenten | Mittel | Mittel | Virtual Scrolling, Lazy Loading |
| Komplexität des Reactive Systems | Hoch | Hoch | Schrittweise Implementierung, Tests |
| Breaking Changes in bestehenden Komponenten | Niedrig | Mittel | Backward-Kompatibilität, Migrations-Scripts |
| Debugging schwieriger | Mittel | Mittel | Dev-Tools, Logging, Visualisierung |

---

## Erfolgs-Kriterien

1. ✅ Alle UI-Komponenten funktionieren in Spielen UND Editor
2. ✅ Inspector kann komplett über JSON gesteuert werden
3. ✅ Editor-Toolbar ist JSON-basiert
4. ✅ Reactive Variables funktionieren zuverlässig
5. ✅ Performance ist akzeptabel (< 100ms Render-Zeit)

---

## Nächste Schritte

> [!IMPORTANT]
> **Start: UI-Komponenten erstellen**
> 
> 1. **`TDropdown`** - Am wichtigsten für Inspector
> 2. **`TCheckbox`** - Einfach zu implementieren
> 3. **`TColorPicker`** - Nutzt HTML5 `<input type="color">`
> 4. **`TNumberInput`** - Erweitert `TTextInput`
> 5. **`TSlider`** - Optional, aber nützlich
>
> Jede Komponente sollte:
> - In `src/components/` erstellt werden
> - `TComponent` erweitern
> - `getInspectorProperties()` implementieren
> - In `player.html` rendering unterstützen
> - In `Serialization.ts` registriert werden

**Zeitaufwand:** 2-3 Wochen für alle Komponenten + Reactive System
