# Developer Guidelines

## Rendering & Game Loop
- **GameRuntime Authority**: Die `GameRuntime` ist die "Source of Truth" für den Spielzustand im Run-Modus.
- **Keine manuelle GameLoop-Init**: Der `Editor` darf den `TGameLoop` nicht manuell initialisieren (`init/start`), wenn die `GameRuntime` verwendet wird. Die `GameRuntime.start()` Methode übernimmt dies.
- **Render-Callback**: Übergib den Render-Callback (`onRender`) direkt an den `GameRuntime`-Konstruktor (`options.onRender`).
- **Proxy-Verwendung**: Verwende immer die Objekte aus `runtime.getObjects()` für das Rendering, da diese die reaktiven Proxies enthalten.

## FlowChart-Daten-Synchronisierung
- **Doppelte Datenquellen**: Action-Daten existieren sowohl in `project.actions` als auch als Kopie in `flowCharts[].elements[].data`.
- **Nach JSON-Editor Änderungen**: Immer `Editor.syncFlowChartsWithActions()` aufrufen, um FlowChart-Elementdaten zu aktualisieren.
- **FlowEditor.syncActionsFromProject()**: Synchronisiert aktive Nodes im Editor mit `project.actions`.
- **Wichtige Dateien**: `Editor.ts` (applyJSONChanges, syncFlowChartsWithActions), `FlowEditor.ts` (syncActionsFromProject)

## Debugging
- **Identitäts-Prüfung**: Bei Verdacht auf "Geister-Objekte" (Logik läuft, Rendering steht), prüfe die Objekt-Identität mit einem temporären "Tag" (`__debugId`), das vor der Proxy-Erstellung angehängt wird.
- **JSON-Vergleich**: Nutze `JSON.stringify`, um tiefere Unterschiede in Objekt-Strukturen zu erkennen, falls die Identität gleich scheint.
