# GCS-Modulkarte

Stand: 2026-10-17 · Analyse-Commit: `53e3dfb`
Zweck jedes Code-Verzeichnisses mit Schlüsseldateien. Detailtiefe bewusst auf
Modulebene — Komponenten/Actions werden in AP 2/3 einzeln katalogisiert.

## `src/` — Editor, Runtime, Komponenten (Vite/TypeScript, v3.9.1)

| Verzeichnis | Module | Verantwortung | Schlüsseldateien |
|---|---|---|---|
| `src/` (Wurzel) | — | App-Einstieg, Player-Einstieg | `main.ts` (Editor-Shell, Tabs), `player.ts`, `player-standalone.ts`, `config.ts`, `style.css` |
| `src/components/` | 121 `T*`-Dateien | Alle GCS-Komponentenklassen (UI, Media, Variablen, Spiel, Server, Speech, Overlays) | `TComponent.ts` (Basis), `index.ts`, `actions/`, `debug/` |
| `src/editor/` | 42 | Editor-Shell und Fachlogik | `Editor.ts` (Orchestrator), `Stage.ts`, `FlowEditor.ts`, `JSONToolbox.ts`, `InspectorDesigner.ts`, `PascalGenerator.ts`, `RefactoringManager.ts` |
| `src/editor/services/` | 44 | Editor-Manager (Render, Daten, Menü, Run, Undo, Flow-*, Snapshot, Overlay-Validierung) | `EditorRenderManager.ts`, `EditorDataManager.ts`, `FlowTaskManager.ts`, `StageInteractionManager.ts` |
| `src/editor/services/renderers/` | 25 | Objekt-Renderer je Komponententyp | `StageObjectRenderer.ts`, `InputRenderer.ts`, `TableRenderer.ts`, `EmojiPickerRenderer.ts` |
| `src/editor/services/flow/` | — | Flow-Editor-Logik | `FlowSequenceBuilder.ts` u. a. |
| `src/editor/inspector/` | 25 | Inspector-UI (Eigenschaften, Events, Tasks, Variablen) | `InspectorHost.ts`, `InspectorRenderer.ts`, `handlers/`, `renderers/` |
| `src/editor/dialogs/` | — | Dialog-Manager-UI | siehe `public/dialog_*.json` |
| `src/editor/tools/` | 7 | Media-/Asset-Werkzeuge | `VideoToSpriteSheetTool.ts`, `AssetAnalyzer.ts`, `spritesheet/` |
| `src/editor/refactoring/` | — | Refactoring-Services | `RefactoringUtils` u. a. |
| `src/editor/userstories/`, `knowledgebase/`, `views/`, `ui/`, `utils/`, `config/`, `debug/` | — | Weitere Editor-Bereiche | — |
| `src/runtime/` | 38 | Spiellaufzeit-Kern | `GameRuntime.ts`, `ReactiveRuntime.ts`, `ActionExecutor.ts`, `TaskExecutor.ts`, `GameLoopManager.ts`, `RuntimeStageManager.ts`, `RuntimeVariableManager.ts`, `HeadlessRuntime.ts`, `HeadlessServer.ts`, `StageInterfaceService.ts`, `ExpressionParser.ts` |
| `src/runtime/actions/` | 4 | Action-Ausführung | `StandardActions.ts`, `handlers/` |
| `src/runtime/executor/` | 3 | Bedingungen/Schleifen | `TaskConditionEvaluator.ts`, `TaskLoopHandler.ts` |
| `src/runtime/services/` | 8 | Runtime-Fachservices | `RuntimeLifecycleService.ts`, `RuntimeStageService.ts`, `RuntimeTimerService.ts` u. a. |
| `src/runtime/core/` | 2 | Input/Multiplayer-Kapseln | `GameRuntimeInput.ts`, `GameRuntimeMultiplayer.ts` |
| `src/model/` | 9 | Datenmodelle/Typen | `types.ts` (GameProject), `StageInterface.ts`, `FeatureFlowAnalysis.ts`, `GameLifecycleAnalysis.ts` |
| `src/services/` | 23 | App-Services | `ProjectStore.ts`, `ComponentRegistry.ts`, `DataService.ts`, `ProjectPersistenceService.ts`, `SchemaLoader.ts`, `SchemaMigrator.ts`, `AgentController.ts`, `RemoteGameManager.ts`, `PlaybackEngine.ts`, `registry/`, `agent/` |
| `src/multiplayer/` | 7 | Multiplayer-Client | `NetworkManager.ts`, `Protocol.ts`, `MultiplayerLobby.ts`, `InputSyncer.ts`, `CollisionSyncer.ts` |
| `src/adapters/` | 17 | Plattform-Bridges | `BrowserUploadAdapter.ts`, `CmsGameHost.ts`, `CmsFrameTransport.ts`, `IndexedDBAdapter.ts`, `ServerStorageAdapter.ts`, Speech-Adapter |
| `src/ai/` | 12 | KI-Subsystem | `AIOrchestrator.ts`, `planner/`, `llm/`, `rag/`, `repair/`, `security/`, `validation/` |
| `src/export/` | 1 | Export | `GameExporter.ts` |
| `src/math/` | 1 | Mathe-Kern | `MathCore.ts` |
| `src/player/` | 1 | Lern-Shell-Player | `LearningShellPlayer.ts` |
| `src/server/` | 1 | Server-Komponenten-Design | `ServerDesignComponent.ts` |
| `src/tools/` | 3 | Werkzeuge | `TrainingDataExporter.ts`, `agent-api-schema.json` |
| `src/utils/` | — | Hilfsmodule | `Logger`, `TauriFSAdapter` u. a. |

## `game-server/` — Gehosteter Server (Express + ws)

| Pfad | Verantwortung |
|---|---|
| `game-server/src/server.ts` | App-Aufbau, Port 8080, Editor-API-Schalter, statische Auslieferung |
| `game-server/src/routes/` | `agent`, `auth`, `data`, `media`, `project`, `room` Routen |
| `game-server/src/websocket/roomManager.ts` | Raumbetrieb (WebSocket) |
| `game-server/src/tts/` | Piper-Sprachsynthese, Cache, Router |
| `game-server/src/TrainingRouter.ts` | KI-Trainingsdaten |
| `game-server/public/projects/` | ~30 GCS-Projektdateien (Spiele, CMS, SQL-Tool, Beispiele) |
| `game-server/public/` | Medien, `runtime-standalone.js`, `cms-shell.js` |
| `game-server/data/` | Laufzeitdaten (cms.json / cms.sqlite) |
| `game-server/runtimes/` | Runtime-Varianten für Uploads |
| `deploy/fly/` | Dockerfile, `fly.toml`, nginx, Entrypoint (Fly.io) |

## `scripts/` — Build-, Test- und Generator-Skripte (~150)

| Gruppe | Beispiele | Zweck |
|---|---|---|
| `scripts/build-*.ts/.mjs` | `build-cms.ts`, `build-math.mjs`, `build-snake.ts` | Projekt-/Bundle-Generatoren |
| `scripts/test-*` | ~70 Testskripte (cjs/ts/mjs) | Automatisierte Tests inkl. Browser-Akzeptanz (Playwright/Edge) |
| `scripts/cms/` | 117 Dateien | CMS-Subsystem: Laufzeit, Server-Komponenten, Stores, Generatoren |
| `scripts/gen-*` | `gen-madn-remote.cjs`, `gen-tetris-classic.mjs` | Projekt-Generatoren (Remote-/Klassik-Spiele) |
| `scripts/production/` | `start-services.mjs` | Produktionsstart |
| `scripts/bundle-runtime.mjs` | — | Erzeugt `public/runtime-standalone.js` |
| `scripts/run-tests.mjs` | — | Test-Runner |
| `scripts/generate-*.mjs/.cjs` | `generate-components-doc.mjs`, `generate-feature-inventory.cjs`, `generate-media-manifest.mjs` | Doku-/Manifest-Generatoren |

### `scripts/cms/` im Detail (Auswahl)

| Bereich | Schlüsseldateien |
|---|---|
| Server/Laufzeit | `cms-server.cjs`, `cms-runtime.cjs`, `cms-server-components.cjs`, `cms-core.cjs`, `cms-project.cjs` |
| Persistenz | `cms-store.cjs` (JSON), `cms-sqlite-store.cjs` + `cms-sqlite-schema/-import/-backup.cjs`, `cms-migrations.cjs`, `cms-credentials.cjs` |
| Domänen | `cms-parent.cjs`, `cms-sponsor.cjs`, `cms-admin.cjs`, `cms-play.cjs`, `cms-mp.cjs`, `cms-live.cjs`, `cms-uploads.cjs`, `cms-speech.cjs`, `cms-tts.cjs`, `cms-rewards.cjs`, `cms-privacy.cjs` |
| Generatoren | `cms-build-role-workspaces.cjs`, `cms-add-*-stages.cjs`, `cms-build-learning-shell.cjs`, `cms-learning-catalog.cjs` u. a. |
| Sonstiges | `cms-http-guard.cjs`, `cms-trace.cjs`, `cms-shell.js`, `cms-seed-testdata.cjs`, `cms-demo.json`, `catalogs/`, `generated/` |

## `public/` — Editor-Assets

| Pfad | Inhalt |
|---|---|
| `public/inspector_*.json` | Inspector-Templates (Stage, Objekte, Tasks, Variablen, Events, Table, Logs) |
| `public/dialog_*.json` | Dialog-Definitionen (Task-Editor, Action-Editor, Image-Browser) |
| `public/runtime-standalone.js` | Gebündelte Runtime (aus `scripts/bundle-runtime.mjs`, nicht manuell editieren) |
| `public/{audio,images,videos,themes,dialogs,editor,multiplayer}` | Assets |
| `public/media-manifest.json` | Generiert (`scripts/generate-media-manifest.mjs`) |
| `public/projects/`, `public/test-projects/` | Editor-Projekte/Testprojekte |

## `docs/` — Dokumentation

| Pfad | Inhalt |
|---|---|
| `docs/` (Wurzel) | ~135 Alt-Dokumente (inventarisiert in `inventory/DOCUMENT-INVENTORY.md`) |
| `docs/architecture/` | Diese Architektur-Doku (AP 1) |
| `docs/features/`, `docs/reference/`, `docs/tutorials/` | Phase-1-Struktur (AP 2–6) |
| `docs/inventory/` | Feature-/Dokumenten-Inventar (AP 0) |
| `docs/schemas/` | 13 Komponenten-Schemata für Editor/Inspector |
| `docs/use_cases/` | 20 Use-Case-Beschreibungen (März, siehe Inventar-Bewertung) |

## Übergreifende Artefakte

| Datei | Rolle |
|---|---|
| `package.json` | npm-Skripte: `dev` (Vite), `start` (start-local), `start:cms`, `build`, `test`, viele `test:*`-Einstiege |
| `AGENTS.md`/`coding-standards` (falls vorhanden) | ⚠ unklar — Konventionen noch zu erfassen |

## Offene Punkte

- ⚠ `src/ai/` (12 Module): Produktivreife und Verdrahtung — in AP 4 zu bewerten.
- ⚠ `src/components/actions/`, `src/components/debug/`: Unterverzeichnisse der Komponenten — in AP 2 aufzulösen.
- ⚠ Obsolete Alt-HTMLs in `public/` (`cms.html.before-*`): als Altartefakte vermerkt, keine Funktionsaussage.
