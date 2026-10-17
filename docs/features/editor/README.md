# Editor-Feature-Katalog (AP 4)

> **Status:** `entwurf` · **Analyse-Basis:** Working Tree über `53e3dfb` (uncommittet) · Stand 2026-10-17
> **Methode:** Quellcode-Analyse. Features sind als **„code-belegt"** markiert, wenn das Verhalten im Quelltext nachgewiesen ist. **„UI-getestet"** wäre ein durchgeführter Oberflächen-Test — in dieser Phase wurden **keine** UI-Tests ausgeführt; alle Einträge sind daher code-belegt, aber nicht UI-verifiziert.

## Editor-Grundlayout (aus `Editor.ts` + `index.html`-Containern)

```
┌──────────────────────────────────────────────────────────────────┐
│ MenuBar (Datei | Bearbeiten | Plattform | Themes | Stages | Werkzeuge) │
├──────────┬──────────────────────────────────────────┬────────────┤
│ Toolbox/ │                                          │ Inspector  │
│ Palette/ │   Arbeitsfläche (View)                   │ (Tabs:     │
│ FlowTb   │   stage | flow | run | json | code | …   │  Eigens-   │
│          │                                          │  chaften/  │
│ Sidepanel│                                          │  Events/   │
│ (Regal)  │                                          │  Logs)     │
└──────────┴──────────────────────────────────────────┴────────────┘
```

**Views** (`EditorViewManager.ts`, `ViewType`): `stage` · `flow` · `run` · `json` · `code` (Pascal) · `management` (User Stories) · `iframe` · `userstories` · `knowledgebase`.

**Orchestrierung:** `src/editor/Editor.ts` ist ein schlanker Host, der Fachlogik an ~20 Manager delegiert (`EditorStageManager`, `EditorCommandManager`, `EditorRunManager`, `EditorSimulatorManager`, `EditorUndoManager`→`SnapshotManager`, `EditorDataManager`, `EditorMenuManager`, `EditorKeyboardManager`, `EditorInteractionManager`, `EditorViewManager`, `ThemeStageService`, `EditorStageImporter`).

## Feature-Dokumente

| Datei | Inhalt |
|---|---|
| [stage-editor.md](stage-editor.md) | Stage-Arbeitsfläche, Toolbox, Komponenten-Palette, Sidepanel-Regal, Stage-Verwaltung |
| [flow-editor.md](flow-editor.md) | Flow-Editor, FlowToolbox, Task-/Action-Knoten, Event-Verbindungen, Pascal-Sync |
| [inspector.md](inspector.md) | Inspector-Tabs, Property-Editoren, Picker-Dialoge, Event-Bindings |
| [views-run-simulator.md](views-run-simulator.md) | Run-Modus, API-Simulator, Debug-Log, JSON-/Code-/Management-Views |
| [project-management.md](project-management.md) | Datei-Menü, Import/Export, Undo/Redo, Themes, Media-Tools, AgentScript |

## Globale Bedienkonzepte (code-belegt)

- **Tastatur:** `Strg+Z` Undo, `Strg+Y`/`Strg+Shift+Z` Redo, `Strg+S` Speichern (`EditorKeyboardManager.ts`)
- **Autosave-Zähler** rechts in der Menüleiste (`MenuBar.setAutosaveCount`)
- **Dirty-Guard:** `window.onbeforeunload` warnt bei ungespeichertem Projekt
- **Stage-Label:** `🎭 Aktuelle Stage: <name>` prominent in der Menüleiste
- **E2E-Modus:** URL-Param `e2e=true` exponiert `mediatorService` für Tests
- **Menü ist datengetrieben:** `public/editor/menu_bar.json` wird zur Laufzeit geladen (`MenuBar.loadFromJSON`)
- **Toolbox umschaltbar** vertikal/horizontal (`toolbox-layout-toggle`, `toolbox_horizontal.json`)
