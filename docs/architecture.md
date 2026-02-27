# Architektur-Dokumentation

## Architektur-Standards (v3.9.0)
- **Modularisierung**: Große Manager-Klassen (über 1000 Zeilen) wie `RefactoringManager` oder `TaskExecutor` MÜSSEN in spezialisierte Services aufgeteilt werden. Die Hauptklasse fungiert dann nur noch als Delegator (Facade-Muster).
- **Service-Location**: 
  - Refactoring-Services: `src/editor/refactoring/`
  - Runtime-Executor-Helpers: `src/runtime/executor/`
- **Shared Helpers**: Statische Hilfsmethoden, die von mehreren Services genutzt werden, gehören in eine `XxxUtils.ts`-Datei (z.B. `RefactoringUtils.ts`).

## Editor-Architektur (v3.5.0 "Ultra-Lean")
Die Klasse `Editor.ts` fungiert nur noch als reiner Orchestrator. Die Fachlogik liegt in hochgradig spezialisierten Manager-Klassen:
- **EditorDataManager.ts**: Zentrales Management für Projekt-Daten (Laden, Speichern, Export, Synchronisation).
- **EditorSimulatorManager.ts**: Verwaltet API-Simulationen und das Mocking von Server-Antworten.
- **EditorRenderManager.ts**: Orchestrierung des Renderings und Aktualisierung aller Editor-Ansichten.
- **EditorMenuManager.ts**: Management der Menüleiste und Shortcuts.
- **EditorKeyboardManager.ts**: Zentrale Registrierung und Verteilung von Tastaturbefehlen.
- **EditorUndoManager.ts**: Koordination der Undo/Redo/Recording-Logik.
- **EditorInteractionManager.ts**: Handling von Canvas-Interaktionen (Drop, Resize, Copy/Paste).
- **EditorStageManager.ts**: Verwaltung von Stages, Templates und der Stage-Migration.

## FlowEditor-Architektur (v3.5.0 "Ultra-Lean")
Die Klasse `FlowEditor.ts` wurde umfassend modularisiert:
- **FlowGraphManager.ts**: Kern für Graph-Manipulationen.
- **FlowUIController.ts**: Steuert Grid-Einstellungen, Zoom, Scroll-Bereiche.
- **FlowTaskManager.ts**: Zentrale für Task-Operationen.
- **FlowNodeFactory.ts**: Erstellung aller Flow-Knoten-Typen.
- **FlowGraphHydrator.ts**: Kapselt die komplexe Hydrierungs-Logik.
- **FlowSyncManager.ts**: Synchronisation zwischen visuellem Diagramm und Datenmodell.
- **FlowStateManager.ts**: UI-Zustand (Detailtiefe, Zoom).
- **FlowMapManager.ts**: Landkarten-Generierung.
- **FlowContextMenuProvider.ts**: Kontextmenüs.
- **FlowNavigationManager.ts**: Breadcrumbs und Verläufe.
- **FlowSelectionManager.ts**: Selektions-Logik.
- **FlowInteractionManager.ts**: Canvas-Interaktionen.

## Stage-Architektur (v3.5.0 "Lean Stage")
Modularisierung in `Stage.ts`:
- **StageRenderer.ts**: Rendering-Logik (HTML/SVG).
- **StageInteractionManager.ts**: Handling von Events (Mousedown, Resize, Drag).
- **Stage.ts (Host)**: Implementiert StageHost und StageInteractionHost.

## ObjectStore (Single Source of Truth)
- `ObjectStore.ts` ist die einzige authoritative Quelle für aktuell gerenderte Objekte.
- `EditorRenderManager.render()` aktualisiert den ObjectStore nach JEDEM Render.
- `EditorCommandManager.findObjectById()` liest ZUERST aus dem ObjectStore.
