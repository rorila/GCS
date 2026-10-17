# Feature: Flow-Editor, Task- &amp; Action-Editor, Event-Verbindungen

> **Status:** `entwurf` · code-belegt, nicht UI-getestet
> **Quellen:** `src/editor/FlowEditor.ts` (1000 Z.), `src/editor/FlowToolbox.ts`, `src/editor/flow/*.ts` (17 Klassen), `src/editor/services/Flow*Manager.ts` (~15 Services), `src/runtime/TaskExecutor.ts` (Ausführung)

## 1. Zweck &amp; Benutzerperspektive

Der Flow-Editor ist der **visuelle Programmeditor**: Tasks werden als Graphen aus Knoten (Actions, Bedingungen, Schleifen) und Kanten modelliert. Er ist die **primäre Quelle** der Task-Logik — die Runtime bevorzugt `flowChart` vor `actionSequence` (TaskExecutor Z. 229–235).

## 2. Ort &amp; Bedienung

- **View `flow`** (`switchView('flow')`), eigene Toolbox `FlowToolbox` (Container `toolbox-content`)
- Knoten werden per **Drag &amp; Drop** aus der FlowToolbox auf die Fläche gezogen; `onItemClick` als Fallback
- Kanten werden per Verbindungs-Element („Pfeil") gezogen — `FlowConnection`, `FlowInteractionManager`, `FlowSelectionManager`
- `FlowGraphManager` hält Knoten/Kanten; `FlowGraphHydrator` rekonstruiert den Graphen aus Projekt-JSON
- `FlowSyncManager` synchronisiert Graph ↔ `actionSequence`/`flowChart` im Projektmodell
- `FlowNamingService`, `FlowNavigationManager`, `FlowMapManager`, `FlowTaskManager`, `FlowToolbarManager`, `FlowUIController`, `FlowContextMenuProvider`, `FlowPascalManager` — jeweils eigene Zuständigkeit

## 3. FlowToolbox-Elemente (code-belegt, `FlowToolbox.ts` Z. 21–31)

| Element | Typ | Runtime-Gegenstück |
|---|---|---|
| ⚡ Task | `task` | `GameTask` in `stage.tasks` |
| 🎬 Action | `action` | Action in `stage.actions` |
| ❓ If Condition | `condition` | `TaskConditionEvaluator` |
| 🔁 For Loop | `for` | `TaskLoopHandler` |
| 🔄 ForEach Loop | `foreach` | `TaskLoopHandler` |
| 🔂 While Loop | `while` | `TaskLoopHandler` |
| ⏭️ Repeat Loop | `repeat` | **Hinweis:** kein `repeat`-Item in `TaskExecutor` gefunden → offen |
| 📦 Variable | `VariableDecl` | Variablen-Deklaration |
| 🔗 Pfeil | `Connection` | Kontrollfluss-Kante |
| 📝 Notiz | `comment` | nur Editor, keine Runtime |
| 🌐 HTTP Request / 📊 Data Action | `Action:http` / `data_action` | **nur sichtbar, wenn Projekt ein `TGameServer`-Objekt enthält** (Z. 34–43) |

## 4. Knotentypen (`src/editor/flow/`)

`FlowTask`, `FlowAction`, `FlowCondition`, `FlowLoop`, `FlowConnection`, `FlowCommentNode`, `FlowDataAction`, `FlowElement`, `FlowListVariable`, `FlowObjectListVariable`, `FlowRandomVariable`, `FlowRangeVariable`, `FlowThresholdVariable`, `FlowTimerVariable`, `FlowTriggerVariable`, `FlowVariable`, `FlowComponent`, `FlowStateManager`.

## 5. Kanten-Semantik (aus `TaskExecutor.executeFlowChart`, Z. 308+)

- **Unbedingte Kante** → nächster Knoten
- **Condition-Knoten** → `success`/`error`-bzw. True/False-Kanten (`falseConn`, Z. 554)
- **API-Knoten** → `successBody`/`errorBody` (Z. 848–851)
- Composite Actions mit `body` → `$params`-Binding, rekursive Body-Ausführung (Z. 412–447)

## 6. Pascal-Synchronisation

`PascalGenerator.ts`, `PascalCodeGenerator.ts`, `PascalCodeParser.ts`, `PascalHighlighter.ts`, `FlowPascalManager` — bidirektionale Sicht Flow ↔ Pascal-Code (View `code`). Umfang der Roundtrip-Fähigkeit **nicht** in dieser Analyse verifiziert.

## 7. Refactoring &amp; Sicherheit

- Löschen von Action-/Task-/Variablen-Knoten zeigt den **Usage-Report** (`RefactoringManager.get*UsageReport`) mit allen Verwendungsstellen
- `FlowContextMenuProvider` — Kontextmenü pro Knoten
- Umbenennen über `renameObjectWithRefactoring` aktualisiert Referenzen

## 8. Einschränkungen &amp; offene Punkte

- **`repeat`-Loop-Element in der Toolbox ohne erkennbares Runtime-Item** — `TaskExecutor` kennt `while`/`for`/`foreach`, kein `repeat`; möglicherweise Editor-Artefakt → **unklar**
- FlowChart vs. `actionSequence`: Editor erzeugt primär `flowChart`; die Sequenz ist Sync-Ableitung (`FlowSyncManager`)
- Kein Zoom-/Minimap-Feature in dieser Analyse verifiziert (`FlowMapManager` könnte Übersicht sein — Namen nicht belegt)
- Performance bei großen Graphen unbekannt

## 9. Beispiel

„Bei Klick auf StartButton → Task `SpielStarten` → Condition `Spieler > 1` → dann `Task NeueRunde`, sonst `Toast 'zu wenig Spieler'`": In der Flow-View `SpielStarten`-Knoten → If-Condition-Knoten → zwei Kanten (true/false) zu den Folge-Knoten. Runtime löst über `stage.tasks` + `flowChart` aus.
