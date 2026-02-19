# FlowEditor Refactoring - DV-Konzept

**Dokumentversion:** 1.0  
**Erstellt:** 2026-01-06  
**Status:** In Planung

---

## 1. Ausgangssituation

### 1.1 Problemstellung

Der `FlowEditor.ts` ist mit **2631 Zeilen** und **107+ Methoden** eine monolithische Klasse, die gegen das Single-Responsibility-Prinzip verstößt. Dies gefährdet die Wartbarkeit und Stabilität des Herzstücks der Applikation.

### 1.2 Identifizierte Verantwortungsbereiche

| Bereich | Methoden (ca.) | Zeilen (ca.) | Beschreibung |
|---------|----------------|--------------|--------------|
| State Management | ~15 | ~300 | Nodes, Connections, Selection, Context |
| Rendering/Grid | ~12 | ~400 | Canvas, Grid, Tooltips, Detail-Views |
| Event Handling | ~20 | ~600 | Drag & Drop, Mouse, Keyboard, Anchors |
| Project Sync | ~10 | ~500 | Load/Save, Parse, Registry, Task-Sync |
| UI/Composition | ~50 | ~800 | Toolbar, Selectors, Context-Menus, Maps |

### 1.3 Veraltete/Ungenutzte Elemente

Bei der Code-Analyse wurden folgende **potenziell veraltete** Elemente identifiziert:

#### UI-Elemente ohne klaren Verwendungszweck

| Element | Zeile | Problem | Empfehlung |
|---------|-------|---------|------------|
| `objectSelect` | 22, 94-103 | Dropdown wird im DOM gerendert, aber der Wert wird nie ausgelesen oder verwendet | Entfernen oder mit Event-Map integrieren |
| `eventSelect` | 23, 98-105 | Zeigt Events an, aber keine Aktion wird daraus gestartet | Entfernen oder funktional anbinden |
| `updateObjectList()` | 995-1010 | Nur einmal in `setProject()` aufgerufen, befüllt `objectSelect` | Entfernen zusammen mit `objectSelect` |
| `updateEventList()` | 1012-1039 | Nur durch `objectSelect.onchange` aufgerufen | Entfernen zusammen mit `eventSelect` |

#### Kandidaten zur Überprüfung

| Methode | Zeile | Analyse |
|---------|-------|---------|
| `assignTaskToNode()` | 1694-1700 | Wrapper, wird nur über ContextMenu genutzt - kann in ContextMenu-Handler inlined werden |
| `linkActionToNode()` | 1702-1711 | dto. |
| `copyActionToNode()` | 1713-1722 | dto. |

---

## 2. Zielarchitektur

Die Refaktorierung folgt dem **Facade Pattern**: Der `FlowEditor` wird zur orchestrierenden Klasse, die auf spezialisierte Module delegiert.

```
┌──────────────────────────────────────────────────────────────┐
│                     FlowEditor (Facade)                       │
│    - Toolbar-UI                                               │
│    - Public API (setProject, syncToProject, getNodes)        │
│    - Orchestrierung der Module                                │
└─────────────┬───────────────────────────────────┬────────────┘
              │                                   │
    ┌─────────▼─────────┐             ┌──────────▼──────────┐
    │ FlowStateManager  │             │   FlowSynchronizer  │
    │ - nodes[]         │             │ - syncToProject()   │
    │ - connections[]   │             │ - loadFromProject() │
    │ - selection       │             │ - rebuildRegistry() │
    │ - context         │             │ - parseDetails()    │
    └─────────┬─────────┘             └──────────┬──────────┘
              │                                   │
    ┌─────────▼─────────┐             ┌──────────▼──────────┐
    │  FlowEventHandler │             │   FlowRenderer      │
    │ - drag & drop     │             │ - updateGrid()      │
    │ - mouse events    │             │ - restoreNode()     │
    │ - keyboard        │             │ - updateDetails()   │
    │ - context menus   │             │ - tooltips          │
    └───────────────────┘             └─────────────────────┘
```

---

## 3. Modul-Spezifikationen

### 3.1 FlowStateManager

**Datei:** `src/editor/flow/FlowStateManager.ts`

**Verantwortlichkeit:** Single Source of Truth für alle Flow-Daten.

#### Properties
```typescript
interface FlowState {
    nodes: FlowElement[];
    connections: FlowConnection[];
    selectedNode: FlowElement | null;
    selectedConnection: FlowConnection | null;
    currentContext: string;  // 'global' | 'event-map' | 'element-overview' | TaskName
    showDetails: boolean;
    filterText: string;
}
```

#### Methoden
| Methode | Parameter | Rückgabe | Beschreibung |
|---------|-----------|----------|--------------|
| `addNode` | `node: FlowElement` | `void` | Fügt Node zur Collection hinzu |
| `removeNode` | `id: string` | `boolean` | Entfernt Node, gibt Erfolg zurück |
| `hasNode` | `id: string` | `boolean` | Prüft Existenz |
| `getNodes` | - | `FlowElement[]` | Kopie der Node-Liste |
| `getNodeById` | `id: string` | `FlowElement \| null` | Findet Node |
| `selectNode` | `node: FlowElement \| null` | `void` | Setzt Selection |
| `getSelectedNode` | - | `FlowElement \| null` | Aktuelle Selection |
| `addConnection` | `conn: FlowConnection` | `void` | Fügt Verbindung hinzu |
| `removeConnection` | `conn: FlowConnection` | `void` | Entfernt Verbindung |
| `getConnections` | - | `FlowConnection[]` | Kopie der Connection-Liste |
| `setContext` | `context: string` | `void` | Wechselt Flow-Context |
| `getContext` | - | `string` | Aktueller Context |
| `setShowDetails` | `show: boolean` | `void` | Toggle Details-Modus |
| `setFilter` | `text: string` | `void` | Setzt Filter-Text |

#### Events (Callbacks)
```typescript
onNodeAdded?: (node: FlowElement) => void;
onNodeRemoved?: (id: string) => void;
onSelectionChanged?: (node: FlowElement | null) => void;
onContextChanged?: (context: string) => void;
```

---

### 3.2 FlowRenderer

**Datei:** `src/editor/flow/FlowRenderer.ts`

**Verantwortlichkeit:** Visuelle Darstellung aller Flow-Elemente.

#### Konstruktor-Abhängigkeiten
```typescript
constructor(
    canvas: HTMLElement,
    stateManager: FlowStateManager,
    flowStage: TFlowStage
)
```

#### Methoden
| Methode | Beschreibung | Ursprüngliche Zeile in FlowEditor |
|---------|--------------|-----------------------------------|
| `updateGrid()` | Grid-Rendering aktualisieren | 2121-2150 |
| `updateScrollArea()` | Scroll-Bereich anpassen | 2611-2629 |
| `updateActionDetails()` | Detail-Modus auf alle Nodes anwenden | 2265-2272 |
| `clearCanvas()` | Alle Elemente entfernen | 2274-2291 |
| `restoreNode(data)` | Node aus JSON wiederherstellen | 851-911 |
| `restoreConnection(data)` | Connection aus JSON wiederherstellen | 967-991 |
| `refreshEmbeddedTask(proxy)` | Eingebettete Task-Nodes expandieren | 913-965 |
| `showTooltip(e, node)` | Tooltip anzeigen | 1345-1374 |
| `hideTooltip()` | Tooltip ausblenden | 1376-1380 |

---

### 3.3 FlowEventHandler

**Datei:** `src/editor/flow/FlowEventHandler.ts`

**Verantwortlichkeit:** Alle Benutzerinteraktionen.

#### Konstruktor-Abhängigkeiten
```typescript
constructor(
    canvas: HTMLElement,
    stateManager: FlowStateManager,
    renderer: FlowRenderer
)
```

#### Methoden
| Methode | Beschreibung | Ursprüngliche Zeile |
|---------|--------------|---------------------|
| `handleCanvasClick(e)` | Klick auf Canvas (Deselect) | 1041-1049 |
| `handleDrop(e)` | Toolbox-Drop | 1189-1204 |
| `handleGlobalMove(e)` | Mausbewegung | 2007-2046 |
| `handleGlobalUp(e)` | Maus loslassen | 2048-2080 |
| `handleNodeContextMenu(e, node)` | Rechtsklick auf Node | 1530-1682 |
| `handleConnectionContextMenu(e, conn)` | Rechtsklick auf Connection | 1684-1692 |
| `handleNodeDoubleClick(node)` | Doppelklick auf Node | 1724-1797 |
| `setupNodeListeners(node)` | Event-Binding für Node | 1207-1338 |
| `setupConnectionListeners(conn)` | Event-Binding für Connection | 1950-2005 |
| `findClosestAnchor(x, y, radius)` | Nächster Snap-Punkt | 2082-2102 |

---

### 3.4 FlowSynchronizer

**Datei:** `src/editor/flow/FlowSynchronizer.ts`

**Verantwortlichkeit:** Datensynchronisation mit dem Projekt.

#### Konstruktor-Abhängigkeiten
```typescript
constructor(
    stateManager: FlowStateManager,
    projectGetter: () => GameProject | null
)
```

#### Methoden
| Methode | Beschreibung | Ursprüngliche Zeile |
|---------|--------------|---------------------|
| `syncToProject()` | Flow → Projekt schreiben | 534-625 |
| `loadFromProject()` | Projekt → Flow laden | 748-849 |
| `syncTaskFromFlow(task, elements, connections)` | Task-Sequenz aus Flow generieren | 627-746 |
| `rebuildActionRegistry()` | Action-Registry neu aufbauen | 334-374 |
| `updateGlobalActionDefinition(actionData)` | Action registrieren/aktualisieren | 461-504 |
| `parseDetailsToCommand(details)` | Pascal-Details in Command parsen | 376-459 |
| `ensureTaskExists(taskName, description)` | Task anlegen falls nicht vorhanden | 506-532 |
| `importTaskGraph(targetNode, task, isLinked)` | Task-Graph importieren | 1382-1528 |

---

## 4. Migrations-Strategie

### Phase 1: FlowStateManager (Tag 1)
1. Neues Modul erstellen
2. Properties aus FlowEditor extrahieren
3. Getter/Setter-Methoden implementieren
4. FlowEditor auf StateManager umstellen
5. Build + Manuelle Tests

### Phase 2: FlowEventHandler (Tag 2)
1. Neues Modul erstellen
2. Event-Methoden extrahieren
3. Auf StateManager verweisen
4. FlowEditor anpassen
5. Build + Manuelle Tests

### Phase 3: FlowSynchronizer (Tag 3)
1. Neues Modul erstellen
2. Sync-Methoden extrahieren
3. Auf StateManager verweisen
4. FlowEditor anpassen
5. Build + Manuelle Tests

### Phase 4: FlowRenderer (Tag 4)
1. Neues Modul erstellen
2. Rendering-Methoden extrahieren
3. Auf StateManager verweisen
4. FlowEditor anpassen
5. Build + Manuelle Tests

### Phase 5: Cleanup (Tag 5)
1. Veraltete Elemente entfernen (`objectSelect`, `eventSelect`, etc.)
2. Dokumentation aktualisieren
3. Finale Tests

---

## 5. Verifikationsplan

### 5.1 Automatisierte Tests
```bash
npm run build    # TypeScript-Kompilierung fehlerfrei
npm run dev      # Applikation startet
```

### 5.2 Manuelle Test-Szenarien

| Test-ID | Szenario | Erwartetes Ergebnis |
|---------|----------|---------------------|
| T-01 | Tennis-Projekt laden | Alle Tasks in Flow-Selector sichtbar |
| T-02 | Neuen Task erstellen | Task erscheint in Selector, Start-Node vorhanden |
| T-03 | Action-Node erstellen | Node auf Canvas, im Details-Modus korrekt |
| T-04 | Task verlinken | Hatching korrekt, Inhalte sichtbar |
| T-05 | Verbindung ziehen | Snap-to-Anchor funktioniert |
| T-06 | Speichern und Laden | Alle Changes persistiert |
| T-07 | Element-Overview | Alle Actions/Tasks aufgelistet, Unused markiert |
| T-08 | Event-Map | Objekt-Event-Task Beziehungen korrekt |

---

## 6. Abhängigkeiten und Risiken

### 6.1 Bekannte Abhängigkeiten
- `Editor.ts` nutzt `flowEditor.setProject()`, `flowEditor.syncToProject()`, `flowEditor.getNodes()`
- `InspectorHost.ts` nutzt `flowEditor.getNodes()` für Flow-Context
- `FlowToolbox.ts` nutzt Canvas-Drop über Standard-Events

### 6.2 Risiken und Mitigationen

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| Zyklische Abhängigkeiten | Mittel | Hoch | Strenge Modul-Grenzen, Interface-First |
| Regression in Event-Handling | Hoch | Hoch | Schrittweises Refactoring, Tests nach jedem Modul |
| Performance-Einbußen | Niedrig | Mittel | Keine zusätzlichen Abstraktions-Layer |

---

## 7. Nächste Schritte

1. ✅ Implementierungsplan erstellen
2. ⏳ Genehmigung durch User
3. ⬜ FlowStateManager implementieren
4. ⬜ FlowEventHandler implementieren
5. ⬜ FlowSynchronizer implementieren
6. ⬜ FlowRenderer implementieren
7. ⬜ Cleanup veralteter Elemente
8. ⬜ Finale Tests und Dokumentation

---

*Dieses Dokument wird bei Änderungen im Refactoring-Prozess aktualisiert.*
