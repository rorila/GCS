# GCS-Systemarchitektur — Gesamtbild

Stand: 2026-10-17 · Analyse-Commit: `53e3dfb` · KI-System: Devin (Cognition) — SWE-2 High
Feature-IDs verweisen auf `docs/inventory/FEATURE-INVENTORY.json`.

## 1. Systemüberblick

```
┌────────────────────────────────────────────────────────────────────┐
│ Browser                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │ Editor (Vite)   │  │ Standalone-     │  │ CMS-Oberflächen     │ │
│  │ src/main.ts     │  │ Player          │  │ (/house /parent /sql│ │
│  │ Editor.ts       │  │ player-         │  │  /super …)          │ │
│  │                 │  │ standalone.ts   │  │ renderCms()         │ │
│  └────────┬────────┘  └────────┬────────┘  └──────────┬──────────┘ │
│           │ HTTP/WS            │ HTTP/WS              │ HTTP       │
└───────────┼────────────────────┼──────────────────────┼────────────┘
            │                    │                      │
   ┌────────▼─────────┐ ┌────────▼────────┐   ┌─────────▼──────────┐
   │ Game-Server      │ │ WebSocket       │   │ CMS-Server :8081   │
   │ Express :8080    │ │ roomManager     │   │ cms-server.cjs     │
   │ server.ts        │ │ (in server.ts)  │   │ deklarative Server- │
   │ REST-Routen      │ │                 │   │ Stages (GCS-CMS/    │
   │ agent/auth/data/ │ │                 │   │  SQL-Tool.json)     │
   │ media/project/   │ │                 │   │ + native Services   │
   │ room + TTS/      │ │                 │   │ (Uploads, Eltern,   │
   │ Training         │ │                 │   │  Sponsor, Speech)   │
   └────────┬─────────┘ └─────────────────┘   └─────────┬──────────┘
            │                                           │
   ┌────────▼─────────┐                        ┌────────▼──────────┐
   │ Dateisystem      │                        │ CMS-Speicher      │
   │ public/projects/ │                        │ JSON  oder        │
   │ public/media…    │                        │ SQLite (WAL)      │
   └──────────────────┘                        └───────────────────┘
```

Quellen: `src/main.ts`, `game-server/src/server.ts` (Z. 27–67),
`scripts/cms/cms-server.cjs` (Z. 21–67), `scripts/cms/cms-project.cjs` (renderCms).

## 2. Kernidee: deklaratives Projektformat (FEAT-0001)

Alles — Spiele, CMS-Oberflächen, sogar Server-Endpunkte — ist **ein JSON-Projekt**,
kein separater Controller-Code. Ein `GameProject` enthält (`src/model/types.ts`):

| Element | Rolle |
|---|---|
| `stages[]` | Bildschirm-Definitionen; Typ `standard`/`blueprint`/`splash`/`server-ähnlich` (⚠ unklar: vollständige StageType-Liste in AP 3) |
| `objects[]` (je Stage) | Komponenten-Instanzen: `className`, `id`, `name`, Position/Größe, `style`, `events` |
| `variables[]` | Typisierte Variablen (string/integer/boolean/object …) |
| `tasks[]` | `actionSequence`: Schritte vom Typ `action`, `task`, `condition`, `while` |
| `actions[]` | Benannte Aktionen; Typen u. a. `property`, `variable`, `service`, `calculate`, `method`, `audio`, `navigate`, `http`, `call_method` |
| `events` | Verknüpfung Objekt-Ereignis → Taskname |
| `features[]`, `userStories[]` | Feature-/Story-Verknüpfungen |
| `flow`, `flowCharts` | Flow-Editor-Daten |
| `schemaVersion`, `meta` | Versionierung/Metadaten |

Verifiziert an `game-server/public/projects/GCS-CMS.json` (82 Stages).

## 3. Laufzeitmodelle (vier Ausführungswege)

| Modell | Einstieg | Zweck |
|---|---|---|
| **Editor-Run** | Tab „Run“ im Editor (`EditorRunManager`, `ReactiveRuntime`) | Live-Test im Editor |
| **Standalone-Player** | `player-standalone.ts` + `public/runtime-standalone.js` (`scripts/bundle-runtime.mjs`) | Spiele/CMS-Seiten ohne Editor |
| **Eingebettete CMS-Seiten** | `renderCms()` in `scripts/cms/cms-project.cjs` liefert HTML mit Projekt + Runtime-Bundle | `/house`, `/parent`, `/sql` … |
| **Server-Runtime** | `cms-runtime.cjs` lädt `stage_server_*` und führt `TServerEndpoint`-Tasks deklarativ aus | API-Endpunkte als GCS-Workflows |

Gemeinsamer Kern: `GameRuntime` (`src/runtime/GameRuntime.ts`, FEAT-0003)
mit Service-Delegatoren (`RuntimeStageManager`, `RuntimeVariableManager`,
`ActionExecutor`, `TaskExecutor`, `RuntimeServices/*`).

Headless-Varianten (`HeadlessRuntime`, `HeadlessServer`) existieren für
serverseitige/simulierte Ausführung — Details in AP 3.

## 4. Editor-Architektur (FEAT-0002)

- `Editor.ts` ist als Orchestrator refactored (~200 Zeilen, „Ultra-Lean“ laut
  `docs/architecture.md`): Fachlogik liegt in spezialisierten Managern unter
  `src/editor/services/` (44 Module: Render-, Data-, Menu-, Keyboard-, Run-,
  Simulator-, Command-, Undo-, Flow-*-Manager, Snapshot, Overlay-Validierung …).
- Ansichts-Tabs (`src/main.ts`): Stage, Run, Run-IFrame, JSON, Flow, Pascal,
  Manager, User Stories, Wissensbasis.
- Inspector-System: `src/editor/inspector/` (25 Module, JSON-Templates unter
  `public/inspector_*.json`).
- Komponentenpalette: `JSONToolbox`/`JSONComponentPalette`, Regal
  (`EditorShelfModel`, `library.json`).

## 5. Server-Schichten

### Game-Server (FEAT-0006)

- `game-server/src/server.ts`: Express + `ws`, Port 8080, Loopback-Default.
- Routen: `routes/{agent,auth,data,media,project,room}Routes.ts`; TTS
  (`tts/SpeechRouter.ts`, Piper-Engine) und `TrainingRouter.ts`.
- Sicherheit: `JWT_SECRET` produktiv Pflicht; `GCS_EDITOR_APIS=off` blendet
  nicht authentifizierte Dev-/Agenten-/Upload-Endpunkte aus (server.ts Z. 48–61).
- WebSocket-Raumbetrieb: `websocket/roomManager.ts`.

### CMS-Server (FEAT-0008)

- `scripts/cms/cms-server.cjs` (Port 8081): lädt die Projektdatei
  `GCS-CMS.json` und führt `stage_server_*` mit `TServerEndpoint` deklarativ
  über `cms-runtime.cjs` + `cms-server-components.cjs` (Methoden-Registry) aus.
- Native Services parallel: Uploads, Eltern/Sponsor-Enroll, Play-Sessions,
  LiveSync, Speech/TTS, Editor-Test.
- Speicher wählbar: JSON (`cms-store.cjs`) oder SQLite WAL
  (`cms-sqlite-store.cjs`) — `CMS_STORAGE` (FEAT-0009).
- Begleitprojekt `GCS-SQL-Tool.json` mit eigener Runtime (FEAT-0010);
  `refreshSqlRuntime()` erlaubt Live-Änderung der Projektdatei.
- Produktionsziel: Fly.io, eine Machine + Volume + externe Backups
  (`deploy/fly/`, `docs/Flyio-Migrationsplan.md`).

## 6. Datenflüsse

**Projekt-Edit (Editor):**
Toolbox/Inspector → `ProjectStore` (SSoT) → Views (Stage/JSON/Flow) →
`EditorProjectSaver`/`ProjectPersistenceService` → Projekt-JSON.

**Spielablauf (Runtime):**
Stage laden → Objekte hydratisieren → Event (Klick/Timer/Kollision) →
`TaskExecutor` → `actionSequence` (Conditions/Loops) → `ActionExecutor` →
Property-/Variablen-Änderung → `ReactiveRuntime`/Render-Update.

**CMS-Request:**
HTTP `POST /api/cms/...` → `TServerEndpoint.onRequest` → deklarativer Task →
`TServer*`Komponenten-Methoden → `store.commit()` (atomar) → `TServerResponse`.

## 7. Verzeichnis-Gesamtstruktur (Kurzfassung)

| Pfad | Verantwortung |
|---|---|
| `src/components/` | 121 `T*`-Komponentenklassen (FEAT-0005) |
| `src/editor/` | Editor-Shell, Manager, Flow, Inspector, Refactoring |
| `src/runtime/` | GameRuntime, Executor, Manager, Services, Actions |
| `src/multiplayer/` | Netzwerk, Protokoll, Lobby, Syncer |
| `src/services/` | Registry, Store, Persistenz, DataService, Agent |
| `src/adapters/` | Plattform-/Speech-/Upload-/CMS-Bridges |
| `src/ai/` | KI-Orchestrierung (Planner, LLM, RAG, Repair) |
| `game-server/` | Express/WS-Server, gehostete Projekte, Laufzeit-Daten |
| `scripts/cms/` | CMS-Laufzeit, Server-Komponenten, Generatoren |
| `scripts/` | Build-/Test-/Generator-Skripte (~150) |
| `public/` | Editor-Assets, Inspector-JSONs, Runtime-Bundle, Projekte |
| `docs/` | Dokumentation (Altbestand + neue Struktur) |

Details: `module-map.md`.

## 8. Abhängigkeiten der Kern-Features

```
FEAT-0001 Projektformat
 ├─ FEAT-0002 Editor-Shell
 ├─ FEAT-0003 GameRuntime ──┬─ FEAT-0004 Task/Action-Executor
 │                          ├─ FEAT-0007 Multiplayer ── FEAT-0006 Game-Server
 │                          ├─ FEAT-0008 CMS-Server ────┬─ FEAT-0009 SQLite
 │                          │                           └─ FEAT-0010 SQL-Tool
 │                          └─ FEAT-0011 Standalone-Bundle
 └─ FEAT-0012 Lernwelten / Beispielprojekte (examples)
```

## 9. Offene Punkte (für AP 2+)

- ⚠ Vollständige `StageType`-Liste (standard/blueprint/splash/server) — Quelle: `src/model/types.ts`, Aufnahme in AP 3.
- ⚠ `features[]` in `GCS-CMS.json` war bei der Stichprobe leer; `addFeature()` in Generatoren füllt sie — Konsistenz prüfen.
- ⚠ Verhältnis `Editor`-Multiplayer-Test (`EditorMultiplayerTest`) vs. CMS-Partybetrieb — AP 5.
- ⚠ `src/ai/`-Subsystem (Orchestrator/Planner/LLM/RAG): Umfang und Produktivreife — AP 4.
