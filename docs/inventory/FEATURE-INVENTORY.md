# GCS Feature-Inventar

> **Generierte Datei** — Quelle: `docs/inventory/FEATURE-INVENTORY.json`.
> Neu erzeugen: `node scripts/generate-feature-inventory.cjs`. Nicht manuell editieren.
> ID- und Statusregeln: [ID-SCHEMA.md](ID-SCHEMA.md)

- Projekt: game-builder-v2 (GCS · Game Creation System)
- Analyse-Commit: `53e3dfb` — **aber:** 240 geänderte/neue Dateien gegenüber dem Commit (Stand 2026-10-17); 33 davon sind Inventar-Quellen.
- Quellen mit uncommitteten Änderungen: 33 (Details: JSON `meta.analysisBasis`)
- Generiert: 2026-10-17 · System: Devin (Cognition) — SWE-2 High

## Kennzahlen

| Merkmal | Wert |
|---|---|
| Features gesamt | 12 |
| Komponenten erfasst | 128 |
| Dokumente bewertet | 242 |

### Entwicklungsstatus
- geplant: 0
- experimentell: 0
- implementiert: 12
- veraltet: 0

### Teststatus
- nicht getestet: 0
- test vorhanden: 6
- test fehlgeschlagen: 3
- automatisiert erfolgreich: 3
- manuell geprüft: 0

## Feature-Tabelle

| ID | Name | Kategorie | Entw. | Test | Doku |
|---|---|---|---|---|---|
| `FEAT-0001` | Deklaratives GCS-Projektformat (Stages, Objekte, Variablen, Tasks, Actions) | runtime | implementiert | test fehlgeschlagen | technisch geprüft |
| `FEAT-0002` | Editor-Shell mit Ansichten (Stage, Run, Run-IFrame, JSON, Flow, Pascal, Manager, User Stories, Wissensbasis) | editor | implementiert | test vorhanden | technisch geprüft |
| `FEAT-0003` | GameRuntime-Kern mit Service-Delegatoren | runtime | implementiert | test vorhanden | technisch geprüft |
| `FEAT-0004` | Task-/Action-Ausführung mit Bedingungen und Schleifen | runtime | implementiert | test vorhanden | technisch geprüft |
| `FEAT-0005` | Komponenten-Registry und ~121 GCS-Komponenten | component | implementiert | test fehlgeschlagen | technisch geprüft |
| `FEAT-0006` | Game-Server (Express + WebSocket, Lobby/Räume, Editor-APIs) | server | implementiert | test vorhanden | technisch geprüft |
| `FEAT-0007` | Multiplayer-Subsystem (Lobby, Protocol, Synchronisation) | multiplayer | implementiert | test vorhanden | technisch geprüft |
| `FEAT-0008` | CMS-Server mit deklarativen Server-Stages (TServerEndpoint-Workflows) | cms | implementiert | automatisiert erfolgreich | technisch geprüft |
| `FEAT-0009` | SQLite-Speicher mit WAL, Migration und externen Backups | cms | implementiert | automatisiert erfolgreich | technisch geprüft |
| `FEAT-0010` | GCS-SQL-Tool (nur-lesende SQL-Konsole für SuperAdmin) | cms | implementiert | automatisiert erfolgreich | technisch geprüft |
| `FEAT-0011` | Standalone-Runtime und eingebettete CMS-Seiten (renderCms, runtime-standalone.js) | runtime | implementiert | test fehlgeschlagen | technisch geprüft |
| `FEAT-0012` | Lernwelt-Subsystem: Aufgabenbereich, Karteikasten, Lernzielkatalog | learning | implementiert | test vorhanden | entwurf |

## Details

### FEAT-0001 — Deklaratives GCS-Projektformat (Stages, Objekte, Variablen, Tasks, Actions)

_runtime · Entwicklung: **implementiert** · Test: **test fehlgeschlagen** · Doku: **technisch geprüft**_

Spiele und CMS-Oberflächen liegen als JSON-Projekt vor: meta, stages[] (objects, variables, tasks, actions, events, grid, flowCharts), projectweite tasks/actions/variables/objects, activeStageId, userStories, schemaVersion. Tasks enthalten actionSequence mit Schritten vom Typ action/task/condition/while. Aktionstypen u. a. property, variable, service, calculate, method, audio, navigate, http, call_method.

| Feld | Wert |
|---|---|
| Quellen | `src/model/types.ts`<br>`game-server/public/projects/GCS-CMS.json` |
| Tests | `scripts/test-cms-stages.cjs`<br>`scripts/validate_project.cjs` |
| Abhängigkeiten | — |
| Verwandte Doku | `docs/runtime-guide.md`<br>`docs/GCS-CMS-STAGES.md` |
| Einschränkungen | 82 Stages in GCS-CMS.json zeigen, dass Großprojekte vollständig deklarativ abgebildet werden. |
| ⚠ Offene Fragen | test-cms-stages.cjs enthält hartkodierte Stage-Anzahlen — Test-Erwartung aktualisieren (Anwendungs-/Teständerung, nicht Teil der Doku-Phase). |
| Anmerkung | Objekt-Felder verifiziert an GCS-CMS.json: className, id, name, scope, draggable, droppable, dragMode, visible, x/y/width/height, zIndex, rotation, align, collisionEnabled, protectFromOverlay, style, caption, showGrid. |
| Geprüft | 2026-10-17 · Devin (Cognition) — SWE-2 High · Commit `53e3dfb` |

**Testläufe (Belege):**

| Datum | Befehl | Ergebnis | Details |
|---|---|---|---|
| 2026-10-17 | `node scripts/test-cms-stages.cjs` | fehlgeschlagen | Assertion „39 Oberflächen + 14 Server-Stages“ ist veraltet — GCS-CMS.json hat inzwischen 65 Oberflächen + 17 Server-Stages (82). Erwartung im Test hartkodiert. |
| 2026-10-17 | `node scripts/validate_project.cjs` | ausgeführt | Lint-artige Prüfung: 11 Fehler / 4 Warnungen im geprüften Projekt (fehlende Flow-Diagramme u. a.) — kein Pass/Fail-Test. |

### FEAT-0002 — Editor-Shell mit Ansichten (Stage, Run, Run-IFrame, JSON, Flow, Pascal, Manager, User Stories, Wissensbasis)

_editor · Entwicklung: **implementiert** · Test: **test vorhanden** · Doku: **technisch geprüft**_

Der Browser-Editor (Vite-App) stellt eine Menüleiste, Toolbox, Stage-Bereich mit 9 Ansichts-Tabs und einen Inspector bereit. Editor.ts ist als dünner Orchestrator refactored und delegiert an spezialisierte Manager (Editor*Manager, InspectorHost, FlowEditor, JSONToolbox, DialogManager).

| Feld | Wert |
|---|---|
| Quellen | `src/main.ts`<br>`src/editor/Editor.ts` |
| Tests | `scripts/test-stage-interface-ui.cjs`<br>`scripts/test-editor-shelf.cjs` |
| Abhängigkeiten | `FEAT-0001` |
| Verwandte Doku | `docs/architecture.md`<br>`docs/use_cases/FlowEditorDetailAnzeige.md` |
| ⚠ Offene Fragen | Wissensbasis-Tab: Umfang/Nutzung noch nicht im Detail geprüft. |
| Anmerkung | Tabs verifiziert in src/main.ts: stage, run, iframe, json, flow, code (Pascal), management, userstories, knowledgebase. |
| Geprüft | 2026-10-17 · Devin (Cognition) — SWE-2 High · Commit `53e3dfb` |

### FEAT-0003 — GameRuntime-Kern mit Service-Delegatoren

_runtime · Entwicklung: **implementiert** · Test: **test vorhanden** · Doku: **technisch geprüft**_

GameRuntime orchestriert den Spielbetrieb und delegiert an ReactiveRuntime, ActionExecutor, TaskExecutor, AnimationManager, GameLoopManager, RuntimeVariableManager, RuntimeStageManager sowie die RuntimeServices (Lifecycle, Stage, Animation, Event, Reactive, Timer, Object). StageInterfaceService kapselt externe Stage-Schnittstellen (Eingänge/Ausgänge).

| Feld | Wert |
|---|---|
| Quellen | `src/runtime/GameRuntime.ts`<br>`src/runtime/services/`<br>`src/runtime/StageInterfaceService.ts`<br>`src/model/StageInterface.ts` |
| Tests | `scripts/test-stage-interface-ui.cjs`<br>`tests/stage_interface.test.ts`<br>`src/runtime/TaskExecutor.*`<br>`src/runtime/ReactiveRuntime.test.ts` |
| Abhängigkeiten | `FEAT-0001` |
| Verwandte Doku | `docs/runtime-guide.md`<br>`docs/Stage-Schnittstellen.md` |
| Anmerkung | Optionen (RuntimeOptions): multiplayerManager, onNavigate, initialGlobalVars, makeReactive, onRender, onComponentUpdate, onSpriteRender, startStageId, onStageSwitch, onRestartGame. |
| Geprüft | 2026-10-17 · Devin (Cognition) — SWE-2 High · Commit `53e3dfb` |

### FEAT-0004 — Task-/Action-Ausführung mit Bedingungen und Schleifen

_runtime · Entwicklung: **implementiert** · Test: **test vorhanden** · Doku: **technisch geprüft**_

TaskExecutor löst Tasknamen in actionSequence auf (Suchreihenfolge: aktive Stage → Blueprint-Stage → Projekt-Wurzel). ActionExecutor führt Einzelschritte aus; TaskConditionEvaluator wertet condition/while-Schritte aus; ExpressionParser stellt ${…}-Platzhalter und Ausdrücke bereit.

| Feld | Wert |
|---|---|
| Quellen | `src/runtime/TaskExecutor.ts`<br>`src/runtime/ActionExecutor.ts`<br>`src/runtime/executor/TaskConditionEvaluator.ts`<br>`src/runtime/ExpressionParser.ts`<br>`src/runtime/actions/` |
| Tests | `src/runtime/executor/TaskConditionEvaluator.test.ts`<br>`src/runtime/ExpressionParser.test.ts`<br>`scripts/test_calculate_robustness.ts`<br>`scripts/test_classic_flow.ts` |
| Abhängigkeiten | `FEAT-0001`<br>`FEAT-0003` |
| Verwandte Doku | `docs/runtime-guide.md`<br>`docs/use_cases/ExecuteCalculateVariable.md` |
| ⚠ Offene Fragen | Vollständige Action-/Handler-Liste wird in AP 3 katalogisiert. |
| Geprüft | 2026-10-17 · Devin (Cognition) — SWE-2 High · Commit `53e3dfb` |

### FEAT-0005 — Komponenten-Registry und ~121 GCS-Komponenten

_component · Entwicklung: **implementiert** · Test: **test fehlgeschlagen** · Doku: **technisch geprüft**_

121 T*-Komponentendateien in src/components/. Zwei parallele Registries: Editor-Broker (services/ComponentRegistry, 112 Einträge, steuert Toolbox/Inspector) und Runtime-Factory (utils/ComponentRegistry, 116 Selbstregistrierungen am Dateiende). Schemas je Kategorie unter docs/schemas definieren Inspector-Eigenschaften. Server-Komponenten haben zusätzlich eine Methoden-Registry in scripts/cms/cms-server-components.cjs (21 Module).

| Feld | Wert |
|---|---|
| Quellen | `src/services/ComponentRegistry.ts`<br>`src/utils/ComponentRegistry.ts`<br>`src/components/`<br>`docs/schemas/`<br>`scripts/cms/cms-server-components.cjs`<br>`docs/reference/components/` |
| Tests | `scripts/generate-component-cards.cjs`<br>`scripts/generate-components-doc.mjs`<br>`scripts/test-server-components.cjs` |
| Abhängigkeiten | `FEAT-0001` |
| Verwandte Doku | `docs/components-generated.md`<br>`docs/components.md`<br>`docs/reference/components/README.md`<br>`docs/reference/tasks-conditions.md`<br>`docs/reference/actions.md`<br>`docs/reference/events.md`<br>`docs/reference/expressions.md`<br>`docs/reference/variables.md`<br>`docs/reference/multiplayer-runtime.md`<br>`docs/architecture/execution-flow.md`<br>`docs/inventory/TECHNICAL-DEBT.md`<br>`docs/inventory/action-metadata.json`<br>`docs/features/editor/README.md`<br>`docs/features/editor/stage-editor.md`<br>`docs/features/editor/flow-editor.md`<br>`docs/features/editor/inspector.md`<br>`docs/features/editor/views-run-simulator.md`<br>`docs/features/editor/project-management.md` |
| Einschränkungen | 9 Dateien ohne Editor-Registrierung (TComponent, TDebugLog, TFlowStage, TForEach, TOverlay, TSlider, TSpeedlines, TSplashStage, TStage) — davon 4 interne Basis-/Stage-Klassen, TSlider experimentell, TForEach/TOverlay/TSpeedlines nur per Runtime-Factory instanziierbar.<br>TWindow nur im Editor-Broker, keine Runtime-Selbstregistrierung (Basisklasse — Instanziierung über Unterklassen). |
| ⚠ Offene Fragen | TServerPrivacy hat Server-Methoden, aber keine Client-Stub-Klasse — Editor-Speicher-Verhalten prüfen (vgl. TServerSql-Vorfall).<br>7 Schema-Einträge ohne Klasse/Methoden (TServerAuthorize, -Guardian, -RateLimit, -Progress, -Invite, -DeviceGrant): geplant oder überholt?<br>components-generated.md deckt nur 72 Komponenten ab (überspringt bewusst 11 als intern); neue Karten unter docs/reference/components/ sind vollständig (121). |
| Anmerkung | components-generated.md wird per Skript aus den Klassen erzeugt und gilt als generierte Referenz. |
| Geprüft | 2026-10-17 · Devin (Cognition) — SWE-2 High · Commit `53e3dfb` |

**Testläufe (Belege):**

| Datum | Befehl | Ergebnis | Details |
|---|---|---|---|
| 2026-10-17 | `node --import tsx --test src/runtime/ExpressionParser.test.ts` | passed | 6/6 PASS |
| 2026-10-17 | `node --import tsx --test src/runtime/executor/TaskConditionEvaluator.test.ts` | failed | 27 PASS / 7 FAIL — stale: testet entfernte Condition (TD-003) |

### FEAT-0006 — Game-Server (Express + WebSocket, Lobby/Räume, Editor-APIs)

_server · Entwicklung: **implementiert** · Test: **test vorhanden** · Doku: **technisch geprüft**_

Node/Express-Server auf Port 8080 (Loopback-Default) mit WebSocket-Raumbetrieb, REST-Routen (agent, auth, data, media, project, room), JWT-Absicherung (produktiv Pflicht), TTS- und Training-Routern. GCS_EDITOR_APIS=off blendet nicht authentifizierte Dev-/Agenten-/Upload-Endpunkte im gehosteten Betrieb aus.

| Feld | Wert |
|---|---|
| Quellen | `game-server/src/server.ts`<br>`game-server/src/routes/`<br>`game-server/src/websocket/roomManager.ts`<br>`game-server/src/tts/` |
| Tests | `scripts/test-cms-connection.cjs`<br>`scripts/test-server-pilot.cjs` |
| Abhängigkeiten | — |
| Verwandte Doku | `docs/AgentAPI.md`<br>`docs/Multiplayer_Testen.md` |
| Einschränkungen | Produktivbetrieb erwartet CMS-Server (Port 8081) als öffentlichen Einstieg. |
| Geprüft | 2026-10-17 · Devin (Cognition) — SWE-2 High · Commit `53e3dfb` |

### FEAT-0007 — Multiplayer-Subsystem (Lobby, Protocol, Synchronisation)

_multiplayer · Entwicklung: **implementiert** · Test: **test vorhanden** · Doku: **technisch geprüft**_

Clientseitiges Multiplayer-Modul mit NetworkManager, Protocol, MultiplayerLobby/JSONMultiplayerLobby, InputSyncer und CollisionSyncer; runtime-seitig GameRuntimeMultiplayer. Serverseitig liefert der Raum-Manager (WebSocket) sowie cms-mp.cjs den CMS-Partybetrieb.

| Feld | Wert |
|---|---|
| Quellen | `src/multiplayer/`<br>`src/runtime/core/GameRuntimeMultiplayer.ts`<br>`game-server/src/websocket/roomManager.ts`<br>`scripts/cms/cms-mp.cjs` |
| Tests | `scripts/test-cms-multiplayer-invitations.cjs`<br>`scripts/test-cms-madn-remote.cjs`<br>`scripts/test-cms-pingpong-remote.cjs`<br>`scripts/test-editor-multiplayer.cjs` |
| Abhängigkeiten | `FEAT-0003`<br>`FEAT-0006` |
| Verwandte Doku | `docs/Multiplayer_Testen.md`<br>`docs/PingPong-Remote-Synchronisationsplan.md`<br>`docs/CMS-HouseAdmin-RaumAdmin-Multiplayer-Konzept.md` |
| ⚠ Offene Fragen | Trennung Editor-Multiplayer-Test vs. CMS-Partybetrieb in AP 5 aufzuarbeiten. |
| Geprüft | 2026-10-17 · Devin (Cognition) — SWE-2 High · Commit `53e3dfb` |

### FEAT-0008 — CMS-Server mit deklarativen Server-Stages (TServerEndpoint-Workflows)

_cms · Entwicklung: **implementiert** · Test: **automatisiert erfolgreich** · Doku: **technisch geprüft**_

CMS-Server (Port 8081) führt TServerEndpoint-Tasks aus den Projektdateien deklarativ über cms-runtime.cjs aus; native Services für Uploads, Eltern/Sponsor, Live-Sync, Speech/TTS, Play-Sessions und Editor-Test. Speicher wählbar: JSON oder SQLite (WAL). Verwaltungsanmeldung über HttpOnly-Cookies, Http-Guards, Trace-Store.

| Feld | Wert |
|---|---|
| Quellen | `scripts/cms/cms-server.cjs`<br>`scripts/cms/cms-runtime.cjs`<br>`scripts/cms/cms-server-components.cjs`<br>`scripts/cms/cms-core.cjs`<br>`scripts/cms/cms-store.cjs`<br>`scripts/cms/cms-sqlite-store.cjs`<br>`scripts/cms/cms-http-guard.cjs` |
| Tests | `scripts/test-cms.cjs`<br>`scripts/test-cms-role-model.cjs`<br>`scripts/test-cms-role-workspaces.cjs`<br>`scripts/test-cms-sql-tool.cjs`<br>`scripts/test-cms-sqlite.cjs`<br>`scripts/test-cms-security.cjs` |
| Abhängigkeiten | `FEAT-0001`<br>`FEAT-0003` |
| Verwandte Doku | `docs/GCS-CMS-SPEZIFIKATION.md`<br>`docs/CMS-Datenseparierung-und-DB-Migrationsplan.md`<br>`docs/SQLite-Flyio-Pruefbericht.md` |
| Einschränkungen | Admin-Sitzungen sind prozesslokal (gehen bei Restart verloren). |
| Anmerkung | Verifiziert: createServer({dataPath, storage}) mit storage 'json'\|'sqlite'; sqlRuntime für GCS-SQL-Tool mit Refresh-Hook. |
| Geprüft | 2026-10-17 · Devin (Cognition) — SWE-2 High · Commit `53e3dfb` |

**Testläufe (Belege):**

| Datum | Befehl | Ergebnis | Details |
|---|---|---|---|
| 2026-10-17 | `node scripts/test-cms-resident-create-avatar-emoji.cjs` | bestanden | 6/6 Subtests (Avatar-Katalog, Standard/Custom-Avatar, Idempotenz, Stage-Struktur, Browser-Workflow). |
| 2026-10-17 | `node scripts/test-cms-role-model.cjs` | bestanden | 93/93 Checks inkl. visuellem Emoji-Code-Editor auf der Detail-Stage. |

### FEAT-0009 — SQLite-Speicher mit WAL, Migration und externen Backups

_cms · Entwicklung: **implementiert** · Test: **automatisiert erfolgreich** · Doku: **technisch geprüft**_

SQLite-Store (better-sqlite3) als Alternative zum JSON-Store: Sammlungstabellen mit strukturellen Spalten + JSON-Payload, Metatabellen (cms_metadata, cms_credentials, cms_audit, cms_deletions, cms_settings), WAL-Modus, Migrationsskripte und Backup-Werkzeug.

| Feld | Wert |
|---|---|
| Quellen | `scripts/cms/cms-sqlite-store.cjs`<br>`scripts/cms/cms-sqlite-schema.cjs`<br>`scripts/cms/cms-sqlite-import.cjs`<br>`scripts/cms/cms-sqlite-backup.cjs`<br>`scripts/cms/cms-migrations.cjs` |
| Tests | `scripts/test-cms-sqlite.cjs`<br>`scripts/test-cms-sqlite-backup.cjs` |
| Abhängigkeiten | `FEAT-0008` |
| Verwandte Doku | `docs/SQLite-Flyio-Pruefbericht.md`<br>`docs/Flyio-Migrationsplan.md`<br>`docs/CMS-Datenseparierung-und-DB-Migrationsplan.md` |
| Einschränkungen | Single-Instance-Betrieb vorgesehen (Fly.io: 1 Machine + Volume). |
| Geprüft | 2026-10-17 · Devin (Cognition) — SWE-2 High · Commit `53e3dfb` |

**Testläufe (Belege):**

| Datum | Befehl | Ergebnis | Details |
|---|---|---|---|
| 2026-10-17 | `node scripts/test-cms-sqlite.cjs` | bestanden | 12/12 Tests (Store, WAL, Migration, Backup). |

### FEAT-0010 — GCS-SQL-Tool (nur-lesende SQL-Konsole für SuperAdmin)

_cms · Entwicklung: **implementiert** · Test: **automatisiert erfolgreich** · Doku: **technisch geprüft**_

Eigenes deklaratives GCS-Projekt mit integriertem Login/Rollenwahl und SQL-Konsole: TServerSql-Komponente erlaubt ausschließlich SELECT/lesendes WITH/EXPLAIN, begrenzt Ergebnisse und liefert 51 Lern-Queryvorlagen. Endpoint POST /api/cms/admin/sql mit requireRole('superAdmin').

| Feld | Wert |
|---|---|
| Quellen | `game-server/public/projects/GCS-SQL-Tool.json`<br>`src/components/TServerSql.ts`<br>`scripts/cms/cms-server-components.cjs` |
| Tests | `scripts/test-cms-sql-tool.cjs` |
| Abhängigkeiten | `FEAT-0008`<br>`FEAT-0009` |
| Verwandte Doku | `docs/SQLite-Flyio-Pruefbericht.md` |
| Einschränkungen | Nur SQLite-Modus; im JSON-Modus klare Fehlermeldung. |
| Anmerkung | 9/9 Testfälle zuletzt grün (Sitzungsstand). |
| Geprüft | 2026-10-17 · Devin (Cognition) — SWE-2 High · Commit `53e3dfb` |

**Testläufe (Belege):**

| Datum | Befehl | Ergebnis | Details |
|---|---|---|---|
| 2026-10-17 | `node --test scripts/test-cms-sql-tool.cjs` | bestanden | 11/11 Tests (Templates, Zeilenlimit, Berechtigungen). |

### FEAT-0011 — Standalone-Runtime und eingebettete CMS-Seiten (renderCms, runtime-standalone.js)

_runtime · Entwicklung: **implementiert** · Test: **test fehlgeschlagen** · Doku: **technisch geprüft**_

Die Runtime wird als public/runtime-standalone.js gebündelt (scripts/bundle-runtime.mjs) und von renderCms() in vollständige HTML-Seiten eingebettet — so laufen CMS-Oberflächen (/house, /parent, /sql …) und Player ohne Editor. HeadlessRuntime/HeadlessServer ermöglichen serverseitige Ausführung.

| Feld | Wert |
|---|---|
| Quellen | `scripts/bundle-runtime.mjs`<br>`scripts/cms/cms-project.cjs`<br>`src/player-standalone.ts`<br>`src/runtime/HeadlessRuntime.ts`<br>`src/runtime/HeadlessServer.ts`<br>`public/runtime-standalone.js` |
| Tests | `scripts/test-cms-role-model.cjs`<br>`scripts/test-cms-resident-create-avatar-emoji.cjs` |
| Abhängigkeiten | `FEAT-0003` |
| Verwandte Doku | `docs/GCS-CMS-START.md` |
| Einschränkungen | Nach Renderer-/Komponenten-Änderungen ist ein Rebuild des Bundles nötig. |
| ⚠ Offene Fragen | test-cms-connection.cjs Timeout untersuchen: veraltete Erwartung oder reales Laufzeitproblem? |
| Anmerkung | Eingebettete CMS-Seiten (renderCms) laufen — indirekt belegt durch bestandenen Browser-Test test-cms-role-model.cjs (93/93), der CMS-Seiten lädt. |
| Geprüft | 2026-10-17 · Devin (Cognition) — SWE-2 High · Commit `53e3dfb` |

**Testläufe (Belege):**

| Datum | Befehl | Ergebnis | Details |
|---|---|---|---|
| 2026-10-17 | `node scripts/test-cms-connection.cjs` | fehlgeschlagen | Playwright-Timeout (30s) bei page.waitForFunction — Server-Rollenwahl antwortete, Browser-Navigation hängt. Ursache unklar (stale Test vs. Laufzeitproblem). |

### FEAT-0012 — Lernwelt-Subsystem: Aufgabenbereich, Karteikasten, Lernzielkatalog

_learning · Entwicklung: **implementiert** · Test: **test vorhanden** · Doku: **entwurf**_

Lernbezogene GCS-Projekte und Generatoren: Aufgabenbereich-Karteikasten (externe Stage-Schnittstellen mit Lern-Events), Karteikasten-Quiz, Lernzielkatalog, Mathe-Lernspiele (Kopfrechnen, Mathe-Insel, Zählen-Turmbau, Rechenpuzzle). Dazugehörige Builder unter scripts/cms und scripts/build-*. 

| Feld | Wert |
|---|---|
| Quellen | `game-server/public/projects/Aufgabenbereich-Karteikasten.json`<br>`game-server/public/projects/Karteikasten-Quiz.json`<br>`scripts/cms/cms-build-task-area.cjs`<br>`scripts/cms/cms-learning-catalog.cjs`<br>`scripts/cms/catalogs/` |
| Tests | `scripts/test-task-area.cjs`<br>`scripts/test-task-area-ui.cjs`<br>`scripts/test-learning-catalog.cjs`<br>`tests/learning_shell.test.ts` |
| Abhängigkeiten | `FEAT-0001`<br>`FEAT-0003` |
| Verwandte Doku | `docs/Aufgabenbereich-Bedienung-und-Umsetzungsstand.md`<br>`docs/Aufgabenbereich-Plan-und-Eventvertrag.md`<br>`docs/CMS-Karteikasten.md`<br>`docs/Lernzielkatalog.md`<br>`docs/Lernspiel-Geruest.md` |
| ⚠ Offene Fragen | Gesamtüberblick der Lernspiel-Projekte und ihrer Reife in AP 6. |
| Anmerkung | Neuester Arbeitsstand (17.10.): Aufgabenbereich-Dokumente beschreiben implementierten ersten Stand. |
| Geprüft | 2026-10-17 · Devin (Cognition) — SWE-2 High · Commit `53e3dfb` |

## Komponenten-Übersicht

Referenzkarten: [docs/reference/components/](../reference/components/README.md)

128 Einträge (inkl. Schema-only). Entwicklung: implementiert 76, geplant 51, experimentell 1. Test: test vorhanden 37, nicht getestet 91.

| Unterkategorie | Anzahl |
|---|---|
| server | 72 |
| spiel | 14 |
| system | 10 |
| anzeige | 5 |
| basis | 5 |
| container | 5 |
| daten | 4 |
| eingabe | 3 |
| overlay | 3 |
| struktur | 2 |
| zeitgeber | 2 |
| debug | 1 |
| media | 1 |
| variablen | 1 |

---
_Letzter Build: 2026-10-18_
