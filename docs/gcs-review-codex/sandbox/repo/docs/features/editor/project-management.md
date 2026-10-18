# Feature: Projektverwaltung, Import/Export, Undo, Themes, Media-Tools

> **Status:** `entwurf` · code-belegt, nicht UI-getestet
> **Quellen:** `public/editor/menu_bar.json`, `src/editor/services/{EditorDataManager,EditorProjectLoader,EditorProjectSaver,SnapshotManager,DiskRevisionGuard,ThemeStageService}.ts`, `src/services/ProjectPersistenceService.ts`, `src/editor/EditorStageImporter.ts`, `src/editor/tools/*`, `src/editor/dialogs/*`, `src/editor/SaveAsDialog.ts`, `src/export/GameExporter.ts`

## 1. Datei-Menü (`menu_bar.json` → `EditorMenuManager`/`EditorDataManager`)

| Menüeintrag | Funktion (code-belegt) |
|---|---|
| Neues Projekt (angeleitet) | geführter Wizard |
| Neues Projekt… | `EditorProjectFactory.createDefaultProject()` direkt |
| Projekt öffnen… | `EditorProjectLoader` (JSON-Datei / Server) |
| Projekt Speichern / Speichern unter… | `EditorProjectSaver` → `ProjectPersistenceService.saveProject` / `SaveAsDialog` |
| Vom Server neu laden (Force) | hartes Neuladen ohne Cache |
| Projekteigenschaften… | `showConfigureProjectDialog` |
| Theme aus Stage exportieren | `ThemeStageService` → Theme-Export |
| AgentScript exportieren / importieren / Bibliothek | `AgentScriptDialog`, `AgentScriptLibrary` |

**Persistence-Pipeline:** `ProjectPersistenceService` → `GameExporter`-Adapter (`IExportAdapter`) — `exportHTML`/`exportJSON`/`exportHTMLCompressed`/`exportJSONCompressed` sind als `deprecated` markiert und delegieren an `executeExport(adapter)` (Z. 338–363).

**Versionierungs-Gard:** `DiskRevisionGuard` (Disk-Revision-Konflikte), `autosave`-Zähler in der Menüleiste, `EditorSessionManager.tryRestoreLastSession` stellt die letzte Sitzung wieder her.

## 2. Bearbeiten-Menü / Undo-Redo

`SnapshotManager` (Singleton):

- `pushSnapshot(projectData, label)` — Throttle **500 ms**, `maxSnapshots`-Ringpuffer, neuer Snapshot leert den Redo-Stack
- `undo()`/`redo()` → Restore-Callback → `editor.loadProject(projectData)` — **Vollständige Projekt-Rücksetzung**, kein inkrementelles Diff
- Tastatur: `Strg+Z` / `Strg+Y` / `Strg+Shift+Z` (`EditorKeyboardManager`)

**Grenze:** Snapshot-basiert — kompletter Projektstand pro Schritt (Speicher OK bei kleinen Projekten; bei sehr großen JSONs ggf. spürbar).

## 3. Plattform-Menü (Export &amp; Test)

| Eintrag | Funktion |
|---|---|
| Multiplayer testen | `openMultiplayerTest` (`EditorMultiplayerTest`) — auch `EditorCmsTest`/`EditorCmsMultiplayerTest` vorhanden |
| Export als HTML / HTML (komprimiert) | `GameExporter` — Standalone-HTML |
| Export als JSON / JSON (komprimiert) | Projekt-JSON |
| Export als ZIP (CMS-Upload) | CMS-Bundle |

## 4. Stage-Import

`EditorStageImporter.importStageFromFile()`: Fremd-Projekt-JSON wählen → importierbare Stages (ohne `blueprint`) → bei 1 Stage Direktimport, sonst Auswahldialog → `stageManager.importStageFromProject` (inkl. Abhängigkeiten).

## 5. Themes

`ThemeStageService` + Menü „Themes → Theme-Editor öffnen": Theme-Editor als Pseudo-Stage (`activeStageId === '__theme_editor__'`), `openThemeEditor`/`editActiveTheme`/`saveThemeFromEditor`/`exitThemeEditor`. Runtime: `themeRegistry`, `set_active_theme`-Action.

## 6. Werkzeuge-Menü (Media-Tools)

| Eintrag | Klasse | Zweck |
|---|---|---|
| Recording-Aktionen | `PlaybackEngine` (`services/PlaybackEngine.ts`) | Aufgenommene Aktionen abspielen |
| Seed Test Data (Dev) | `seed-data` | Testdaten erzeugen (Dev) |
| Video → SpriteSheet | `VideoToSpriteSheetTool` (+`spritesheet/`) | Video-Frames → `TImageList`-SpriteSheet |
| Bild-Optimierer | `ImageTransparencyTool`/`ImageUtils` | Transparenz/Optimierung |
| Audio Sequenzen | `AudioSequenceTool` | Audio-Sequenzen konfigurieren |
| Bild-Analyse (Performance) | `AssetAnalyzerTool`/`AssetAnalyzer` | Asset-Performance prüfen |
| — | `EditorMediaExporter` | Media-Export-Funktionen |

`VideoToSpriteSheetTool.open()` öffnet einen Overlay-Dialog mit Video-Sektion, Settings, Frame-Grid, Sheet-Vorschau (`spritesheet/VideoToSpriteSheetUI`).

## 7. Dialoge (`src/editor/dialogs/`)

`AIGenerationDialog`, `AIModelConfigDialog` (KI-Generierung, `src/ai/`), `AgentScriptDialog`, `AgentScriptLibrary`, `StageDialogs`, `StageInterfaceDialog`, `StageOverviewDialog`, `UseCaseDialog`, `handlers/`, `renderers/` — JSON-deklarierte Dialoge via `JSONDialogRenderer` + `DialogComponentFactory` + `DialogManager` (dasselbe Dialog-System wie zur Runtime).

## 8. Abhängigkeiten zwischen Features

- Export → `GameExporter` → Projekt muss konsistent sein (`ProjectIntegrityValidator`)
- Stage-Import → `EditorStageManager` + Namensauflösung
- Undo → Snapshot-Restore lädt komplettes Projekt (`loadProject`)
- Media-Tools → erzeugen `TImageList`/Asset-JSON, das via `docs/schemas` referenziert wird
- Simulator → nur relevant bei `http`-Actions im Editor-Run

## 9. Einschränkungen &amp; offene Punkte

- `exportHTML*`/`exportJSON*` deprecated → nur `executeExport` aktuell (alte Pfade existieren noch)
- Snapshot-Undo ist grobgranular — kein Per-Property-Undo
- `AgentScript`-Import/Export-Format hier nicht weiter analysiert
- `EditorCmsTest`/`EditorCmsMultiplayerTest` sind Test-Hooks in der UI — Grenze zum Produktivpfad unklar
