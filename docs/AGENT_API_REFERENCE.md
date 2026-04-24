# GCS AgentController — Vollständige API-Referenz für KI-Agenten

> [!IMPORTANT]
> **Zweck:** Diese Datei ist die **kanonische Wissensbasis** für KI-Agenten (LLMs, Copiloten, Auto-Generatoren), die GCS-Projekte über den `AgentController` erstellen oder modifizieren.
>
> **Zielgruppe:**
> 1. LLMs als System-Prompt / RAG-Chunk-Quelle
> 2. Menschliche Entwickler als kompakte Referenz
> 3. Dokumentations-Generatoren (JSONL-Training, Function-Calling-Schemas)
>
> **Pflege:** Die Inhalte destillieren `src/services/AgentController.ts`, `src/model/types.ts`, `docs/schemas/*.json` und die `DEVELOPER_GUIDELINES.md`. Änderungen an diesen Quellen MÜSSEN hier reflektiert werden.

---

## Inhaltsverzeichnis

- [§1 Mentales Modell](#1-mentales-modell)
- [§2 Die 7-Schritte-Methodik](#2-die-7-schritte-methodik)
- [§3 API-Referenz (alle Methoden)](#3-api-referenz)
- [§4 ActionType-Katalog (24 Typen)](#4-actiontype-katalog)
- [§5 Komponenten-Steckbriefe](#5-komponenten-steckbriefe)
- [§6 Workflow-Rezepte (End-to-End)](#6-workflow-rezepte)
- [§7 Anti-Pattern-Katalog](#7-anti-pattern-katalog)
- [§8 Validator-Regeln](#8-validator-regeln)
- [§9 Referenzen & verwandte Dokumente](#9-referenzen)

---

## §1 Mentales Modell

### 1.1 Die fünf Entitäten im Überblick

GCS kennt **exakt fünf** Entitätsklassen. Alles andere ist Ableitung oder Infrastruktur.

| Entität | Code-Typ | Lebt in | Zweck |
|:---|:---|:---|:---|
| **Projekt** | `GameProject` | `project.json` (Root) | Container aller Stages + globaler Metadaten |
| **Stage** | `StageDefinition` | `project.stages[]` | Bildschirm + Scope-Grenze (Objekte, Tasks, Actions, Variablen) |
| **Komponente** | `ComponentData` | `stage.objects[]` | UI-Element ODER Service ODER Variable (alle per `className` diskriminiert) |
| **Task** | `GameTask` | `stage.tasks[]` | Event-getriggerte Sequenz aus Actions/Subtasks/Branches/Loops |
| **Action** | `BaseAction` (+ 9 Subtypen) | `stage.actions[]` oder `project.actions[]` (Legacy) | Atomare Operation (Property setzen, Methode rufen, HTTP, …) |

### 1.2 Hierarchie-Diagramm

```
GameProject
├── meta: { name, version, author, description }
├── stage.grid: { cols: 64, rows: 40, cellSize, snapToGrid, ... }
├── stages: StageDefinition[]
│   │
│   ├── ┌─[type: 'blueprint']────────────────────┐   ← EXAKT 1× pro Projekt
│   │   │  objects[]   → Services, glob. Vars,   │
│   │   │                Templates, UI-Overlays  │
│   │   │  actions[]   → Global sichtbare Actions│   (Default-Ziel von addAction())
│   │   │  tasks[]     → Globale Tasks           │
│   │   │  variables[] → Globale Variablen       │
│   │   │  events{}    → Globale Events          │
│   │   └─────────────────────────────────────────┘
│   │
│   ├── [type: 'main']      → Haupt-Spielbildschirm
│   ├── [type: 'splash']    → Intro-Screen (mit duration, autoHide)
│   └── [type: 'standard']  → Login, Menu, Dashboard, Level, … (beliebig viele)
│       ├── objects[]
│       ├── tasks[]
│       ├── actions[]       ← lokale Actions (selten, nur per ensureActionDefined)
│       ├── variables[]
│       ├── events{}        → z.B. { "onRuntimeStart": "InitLevel" }
│       ├── flowCharts{}    → Visuelle Task-Graphen (AUTO-GENERIERT!)
│       └── excludedBlueprintIds[] → Blueprint-Overrides
│
├── tasks[], actions[], variables[]   ← Legacy-Root (wird zu Blueprint migriert)
└── flowCharts{}                       ← Globale Flow-Graphen (Legacy)
```

### 1.3 Die fünf Kern-Invarianten

Diese Regeln sind **unverhandelbar** — der Agent muss sie erzwingen, der Validator prüft sie.

#### Invariante 1: Genau eine Blueprint-Stage

Jedes Projekt hat **exakt eine** Stage mit `type: 'blueprint'`. Sie ist:
- Das **Template** für globale Services, Variablen, Actions
- **Geschützt vor Löschung** (`deleteStage()` wirft Exception bei `type === 'blueprint'`)
- Der **Default-Speicherort** für Actions, wenn keine explizite Stage angegeben wird

**Was gehört in Blueprint:**
- Services (`TGameLoop`, `TGameState`, `TInputController`)
- Globale Variablen (Score, PlayerName, aktueller Level)
- Actions, die von mehreren Stages genutzt werden
- UI-Overlays, die überall sichtbar sein sollen (z.B. Notification-Toast)

**Was NICHT in Blueprint gehört:**
- Level-spezifische Gegner-Logik
- Lokale GameLoops pro Szene
- Templates für Spawning, die nur in einer bestimmten Stage leben

#### Invariante 2: Dual Registration

Tasks werden **atomar** an zwei Stellen eingetragen, damit sie in allen Listen konsistent erscheinen:
1. **Stage-Registrierung** (`stage.tasks[]`) — Organisations-Ebene (welche Stage "besitzt" den Task)
2. **Flow-Invalidation** (`stage.flowCharts[taskName] = delete`) — Visualisierungs-Ebene

Der `AgentController.createTask()` macht beides in einem Aufruf. Manueller JSON-Eingriff zerstört diese Konsistenz.

#### Invariante 3: No Inline Actions

> [!CAUTION]
> **NIEMALS** `actionSequence`-Items mit eingebetteten Action-Parametern erstellen!

**Falsch (Inline-Action):**
```json
{
  "type": "action",
  "name": "BallResetten",
  "target": "Ball",                    ← VERBOTEN
  "changes": { "x": 30, "y": 20 }      ← VERBOTEN
}
```

**Richtig (Referenz-Only):**
```json
// In stage_blueprint.actions[]:
{ "name": "BallResetten", "type": "property", "target": "Ball", "changes": { "x": 30, "y": 20 } }

// In task.actionSequence[]:
{ "type": "action", "name": "BallResetten" }
```

**Warum:** Der Refactoring-Manager, Inspector und FlowSyncManager erwarten Actions als eigenständige Entitäten mit eigenen IDs. Inline-Daten erzeugen Duplikate und Ghost-References.

`AgentController.validate()` meldet Inline-Actions als **Error**.

#### Invariante 4: Scorched Earth (Flow-Invalidation)

Bei **jeder** Task-Mutation wird das zugehörige `flowChart` **vollständig gelöscht**:

```typescript
// Intern in AgentController.invalidateTaskFlow(taskName):
delete project.flowCharts?.[taskName];
project.stages.forEach(s => delete s.flowCharts?.[taskName]);
```

Beim nächsten Öffnen im FlowEditor generiert der `FlowGraphHydrator` den visuellen Graphen **automatisch aus der `actionSequence` neu**.

**Konsequenz für den Agent:**
- Der Agent arbeitet NUR auf der logischen `actionSequence`.
- Der Agent ruft NIE `flowCharts[...]` direkt auf.
- Falls ein Flow-Layout gewünscht ist, nutzt der Agent `generateTaskFlow(taskName)` → schreibt `task.flowLayout`.

#### Invariante 5: Grid-System (64 × 40)

Alle visuellen Koordinaten (`x`, `y`, `width`, `height`) sind **Grid-Einheiten**, nicht Pixel!

- Standard-Grid: **64 Spalten × 40 Zeilen**
- Ein `TSprite` mit `x: 30, y: 20, width: 2, height: 2` ist ≈ in der Bildschirmmitte, 2×2 Zellen groß.
- Ein `TSprite` mit `x: 375, y: 500, width: 50, height: 50` wäre **weit außerhalb** des Viewports.
- Negative Koordinaten sind **nicht erlaubt** (`min: 0` im Inspector).
- Regel: `x + width <= 64`, `y + height <= 40`.

### 1.4 Die vier Verknüpfungs-Arten

Entitäten sind über vier **orthogonale** Verbindungen gekoppelt:

```
┌───────────────┐  connectEvent(stage, obj, event, task)
│   Komponente  ├──────────────────────────┐
│  (TButton)    │                          │
└───────────────┘                          ▼
                                   ┌────────────────┐
                    addTaskCall()  │      Task      │
                         ┌─────────┤ (TriggerFn)    │
                         │         └───────┬────────┘
                         │                 │ addAction()
                         │                 ▼
                         │         ┌────────────────┐
                         └────────▶│     Action     │
                                   │  (PropertyFn)  │
                                   └────────────────┘

┌───────────────┐  bindVariable(stage, obj, prop, '${varName}')
│   Komponente  │ ◀────────────────── ${varName} wird zur Laufzeit aufgelöst
│  (TLabel)     │
└───────────────┘
                  ┌───────────────┐
                  │   Variable    │
                  │   (score)     │
                  └───────────────┘
```

| Art | API-Methode | Schreibt nach |
|:---|:---|:---|
| Komponente → Task | `connectEvent(stageId, objName, event, taskName)` | `object.events[eventName] = taskName` |
| Task → Action | `addAction(taskName, type, actionName, params)` | `task.actionSequence.push({type:'action', name})` |
| Task → Task | `addTaskCall(taskName, calledTaskName)` | `task.actionSequence.push({type:'task', name})` |
| Komponente → Variable | `bindVariable(stageId, objName, prop, expr)` | `object[prop] = '${expr}'` |

### 1.5 Lebenszyklus einer Mutation

Jede `AgentController`-Methode folgt diesem 6-Schritt-Protokoll:

```
1. validateProjectLoaded()     → throws, wenn kein Projekt geladen
2. Finde Ziel-Entität          → z.B. getTaskByName(), stages.find()
3. Prüfe Invarianten           → z.B. ensureActionsExistGlobally()
4. Mutiere Datenmodell         → push / assign / delete
5. invalidateTaskFlow(name)    → Scorched Earth (nur bei Task-Änderungen)
6. notifyChange()              → mediatorService.notifyDataChanged → triggert Auto-Save + UI-Refresh
```

Der Agent muss **keine** dieser Schritte selbst implementieren — `AgentController`-Methoden sind atomar.

---

## §2 Die 7-Schritte-Methodik

Quelle: `docs/schemas/schema_base.json` — erweitert um konkrete API-Calls.

Um ein GCS-Projekt systematisch aufzubauen, durchläuft der Agent **immer** diese sieben Schritte:

### Schritt 1: ZIEL definieren

**Frage:** Was soll das Spiel/die App können? (Max. 1 Satz)

Beispiel: *„Ein Pong-Spiel, bei dem zwei Spieler mit Paddeln einen Ball hin- und herspielen und Punkte sammeln."*

**Agent-Verhalten:**
- Zerlege das Ziel in UI-Anforderungen (was sieht der Spieler?) und Logik-Anforderungen (was passiert?).
- Notiere die **Hauptstage** (meist `stage_main`) und ggf. Nebenstages (`stage_splash`, `stage_gameover`).

### Schritt 2: OBJEKTE planen

**Frage:** Was brauche ich auf dem Bildschirm?

| Anforderung | Komponente |
|:---|:---|
| Bewegliches Spiel-Element | `TSprite` |
| Statischer Text | `TLabel` |
| Klickbarer Button | `TButton` |
| Container/Layout | `TPanel` oder `TGroupPanel` |
| Eingabefeld | `TEdit` |
| Popup/Modal | `TDialogRoot` |
| Fortschrittsbalken | `TProgressBar` |
| Bild | `TImage` |
| Tabelle/Kartenraster | `TTable` |

**API-Calls in dieser Phase:**
- `createStage(id, name, type)` für jede Stage
- `createSprite(stageId, name, x, y, w, h, opts)` — Shortcut
- `createLabel(stageId, name, x, y, text, opts)` — Shortcut
- `createButton(stageId, name, x, y, caption, opts)` — Shortcut (über `AgentShortcuts`)
- `addObject(stageId, data)` — Roh-Methode für alle anderen Komponenten

**Grid-Erinnerung:** Alle Koordinaten in 64×40-Zellen, nicht Pixel!

### Schritt 3: VARIABLEN deklarieren

**Frage:** Welcher Zustand muss verfolgt werden?

14 Variablen-Typen stehen zur Verfügung (`schema_variables.json`):

| Typ | Klassen-Name | Zweck |
|:---|:---|:---|
| `integer` | `TIntegerVariable` | Ganzzahl (Score, Leben, Münzen) |
| `real` | `TRealVariable` | Kommazahl (Geschwindigkeit, Zeit) |
| `string` | `TStringVariable` | Text (PlayerName, Level-ID) |
| `boolean` | `TBooleanVariable` | Ja/Nein (isPlaying, hasKey) |
| `timer` | `TTimerVariable` | Countdown/Stopwatch |
| `random` | `TRandomVariable` | Zufalls-Generator mit `generate()`-Methode |
| `list` | `TListVariable` | Array beliebiger Werte |
| `object` | `TObjectVariable` | Strukturiertes Objekt (User, Item, …) |
| `object_list` | `TObjectList` | Liste von Objekten |
| `threshold` | `TThresholdVariable` | Feuert `onThresholdReached` bei Grenzwert |
| `trigger` | `TTriggerVariable` | Feuert `onTriggerEnter/Exit` bei Wert-Match |
| `range` | `TRangeVariable` | min/max mit `onMinReached`/`onMaxReached` |
| `keystore` | `TKeyStore` | Key-Value-Store mit CRUD-Events |
| `json` | — | Rohe JSON-Daten |

**API-Call:**
```typescript
agent.addVariable(name, type, initialValue, scope);
// scope: 'global' (Default) oder Stage-ID
```

### Schritt 4: ACTIONS entwerfen

**Frage:** Was kann passieren? (Atomare Operationen)

24 Action-Typen stehen zur Verfügung (Details in [§4](#4-actiontype-katalog)). Die wichtigsten:

| Typ | Zweck | Minimal-Params |
|:---|:---|:---|
| `property` | Komponenten-Property setzen | `target`, `changes` |
| `call_method` | Methode auf Objekt aufrufen | `target`, `method` |
| `calculate` | Formel berechnen | `formula`, `resultVariable` |
| `set_variable` | Variable direkt setzen | `variableName`, `value` |
| `navigate_stage` | Stage wechseln | `stageId` |
| `http` / `data_action` | API-Call / DB-Query | `url`, `method`, `body` |
| `negate` | Vorzeichen umkehren (Ping-Pong) | `target`, `changes` |
| `increment` | Zähler hochzählen | `target`, `property`, `amount` |

**API-Call:**
```typescript
agent.addAction(taskName, actionType, actionName, params);
// Beispiel:
agent.addAction('StartGame', 'property', 'ActivateGame',
  { target: 'GameState', changes: { state: 'playing' } }
);
```

**Kritisch:** Action wird **global** in `stage_blueprint.actions[]` registriert, im Task nur als Referenz.

### Schritt 5: TASKS konstruieren

**Frage:** In welcher Reihenfolge passieren die Actions?

Ein `Task` ist eine **Sequenz** aus:
- Direkten Actions (`{type:'action', name}`)
- Sub-Task-Aufrufen (`{type:'task', name}`)
- Verzweigungen (`{type:'condition', condition, then[], else[]}`)
- Schleifen (`{type:'while'|'for'|'foreach', body[]}`)

**API-Aufbau:**
```typescript
// 1. Task anlegen
agent.createTask('stage_main', 'HandleBallBoundary', 'Abprall-/Reset-Logik');

// 2. Task-Parameter (z.B. hitSide aus onBoundaryHit-Event)
agent.addTaskParam('HandleBallBoundary', 'hitSide', 'string', '');

// 3. Sequenz füllen — mit Verzweigung
agent.addBranch('HandleBallBoundary', 'hitSide', '==', 'top',
  (then) => { then.addNewAction('negate', 'NegateBallY', { target: 'Ball', changes: { velocityY: 1 } }); },
  (els)  => { els.addNewAction('property', 'ResetBall', { target: 'Ball', changes: { x: 30, y: 20 } }); }
);

// 4. Optional: Sub-Task aufrufen
agent.addTaskCall('HandleBallBoundary', 'PlayBounceSound');

// 5. Trigger-Modus setzen (Multiplayer-Sync)
agent.setTaskTriggerMode('HandleBallBoundary', 'local-sync');
```

### Schritt 6: EVENTS binden

**Frage:** Was löst die Task-Abläufe aus?

**Basis-Events** (aus `schema_base.json`): `onClick`, `onFocus`, `onBlur`, `onDragStart`, `onDragEnd`, `onDrop`

**Komponenten-spezifische Events** (Auswahl):
- `TSprite`: `onCollision`, `onCollisionLeft/Right/Top/Bottom`, `onBoundaryHit`
- `TButton`: `onClick` (aus Basis)
- `TTimer`: `onTimer`, `onMaxIntervalReached`, `onFinished`
- `TGameLoop`: `onFrame`, `onStart`, `onStop`
- `TEdit`: `onChange`, `onEnter`
- `TIntervalTimer`: `onInterval`

**Variablen-Events** (aus `ProjectVariable`):
- `TIntegerVariable`: `onValueChanged`
- `TThresholdVariable`: `onThresholdReached`, `onThresholdLeft`, `onThresholdExceeded`
- `TTriggerVariable`: `onTriggerEnter`, `onTriggerExit`
- `TRangeVariable`: `onMinReached`, `onMaxReached`, `onInside`, `onOutside`
- `TListVariable`: `onItemAdded`, `onItemRemoved`
- `TKeyStore`: `onItemCreated`, `onItemUpdated`, `onItemDeleted`, `onItemRead`, `onNotFound`

**Stage-Events** (in `stage.events{}`):
- `onRuntimeStart` — wird beim Betreten der Stage gefeuert
- `onRuntimeStop` — beim Verlassen

**API-Call:**
```typescript
agent.connectEvent(stageId, objectName, eventName, taskName);
// Beispiel:
agent.connectEvent('stage_main', 'Ball', 'onBoundaryHit', 'HandleBallBoundary');
agent.connectEvent('stage_main', 'StartBtn', 'onClick', 'StartGame');
```

### Schritt 7: TESTEN (validate)

**Frage:** Funktioniert es?

```typescript
const issues = agent.validate();
// → [{ level: 'error' | 'warning', message: string }]
```

`validate()` prüft automatisch:
- ❌ **Error:** Inline-Actions in Task-Sequenzen
- ❌ **Error:** Task-Referenzen auf nicht-existente Actions
- ⚠️ **Warning:** Actions ohne Task-Referenz (verwaist)
- ⚠️ **Warning:** Tasks mit Sequenz aber ohne FlowChart

**Agent-Verhalten bei Errors:**
Der Agent liest die Fehlermeldungen, korrigiert per weiteren API-Calls, ruft erneut `validate()` bis die Liste leer ist.

---
<a id="3-api-referenz"></a>

## §3 API-Referenz

Alle Methoden des `AgentController` (Quelle: `src/services/AgentController.ts`). Zugriff via Singleton:

```typescript
import { agentController } from './services/AgentController';
// oder
const agent = AgentController.getInstance();
```

### 3.1 Projekt-Struktur

#### `createStage(id, name, type?)`

Erstellt eine neue Stage im Projekt.

**Signatur:**
```typescript
createStage(id: string, name: string, type?: 'standard' | 'blueprint'): void
```

**Parameter:**
- `id` — Eindeutige Stage-ID (Konvention: `stage_<kurzname>`, z.B. `stage_login`, `stage_main`)
- `name` — Anzeigename in der UI
- `type` — Default: `'standard'`. Nur **eine** Stage darf `'blueprint'` sein.

**Verhalten:**
- Legt leere Arrays an: `objects`, `tasks`, `actions`, `variables`, `flowCharts`, `events`
- Warnt (ohne Fehler), wenn `id` bereits existiert

**Beispiele:**
```typescript
agent.createStage('stage_login', 'Login-Screen', 'standard');
agent.createStage('stage_main', 'Spielbildschirm', 'standard');
agent.createStage('stage_gameover', 'Game Over');  // type default
```

**Nat.-Sprach-Trigger:**
- „Erstelle eine neue Stage für den Login"
- „Füge einen Hauptbildschirm hinzu"
- „Ich brauche einen Game-Over-Screen"

---

#### `addObject(stageId, objectData)`

Fügt ein Komponenten-Objekt zu einer Stage hinzu.

**Signatur:**
```typescript
addObject(stageId: string, objectData: ComponentData): void
```

**Parameter:**
- `stageId` — Ziel-Stage-ID
- `objectData` — Komponenten-Daten mit mindestens `className` und `name`

**Verhalten:**
- Pusht Objekt in `stage.objects[]`
- Wirft Exception bei unbekannter `stageId`

**Beispiel:**
```typescript
agent.addObject('stage_main', {
  className: 'TSprite',
  name: 'Ball',
  x: 30, y: 20, width: 2, height: 2,
  velocityX: 3, velocityY: 3,
  collisionEnabled: true, collisionGroup: 'ball',
  shape: 'circle',
  style: { backgroundColor: '#ff6b6b' }
});
```

**Tipp:** Für häufige Komponenten lieber die Shortcuts nutzen: `createSprite`, `createLabel`, `createGroupPanel`, `createDialog`.

---

#### `addVariable(name, type, initialValue, scope?)`

Registriert oder aktualisiert eine Variable im Projekt.

**Signatur:**
```typescript
addVariable(name: string, type: VariableType, initialValue: any, scope?: string): void
```

**Parameter:**
- `name` — Eindeutiger Variablenname (wird in Bindings als `${name}` referenziert)
- `type` — `'number'` / `'boolean'` / `'string'` / `'object'` / `'trigger'` / … (interner Mapping auf `TIntegerVariable` / `TBooleanVariable` / …)
- `initialValue` — Startwert
- `scope` — Default: `'global'`. Andere Werte: `'stage'` oder eine Stage-ID

**Verhalten:**
- Wenn Variable existiert: aktualisiert `type`, `className`, `initialValue`, `defaultValue`, `scope`
- Sonst: legt neu in `project.variables[]` an
- `className` wird automatisch aus `type` abgeleitet

**Beispiel:**
```typescript
agent.addVariable('score', 'number', 0, 'global');
agent.addVariable('playerName', 'string', 'Player 1');
agent.addVariable('currentLevel', 'number', 1);
agent.addVariable('isMultiplayer', 'boolean', false);
```

---

### 3.2 Task-Management

#### `createTask(stageId, taskName, description?)`

Erstellt einen neuen Task.

**Signatur:**
```typescript
createTask(stageId: string, taskName: string, description?: string): string
```

**Parameter:**
- `stageId` — Ziel-Stage (Fallback: `'stage_blueprint'`)
- `taskName` — Eindeutiger Task-Name
- `description` — Optionale Beschreibung

**Verhalten:**
- Legt `GameTask` mit leerer `actionSequence` an
- `triggerMode` default: `'local-sync'`
- Registriert in `stage.tasks[]`
- **Scorched Earth:** löscht `flowCharts[taskName]` aus allen Stages

**Rückgabe:** Der `taskName` (für Chaining)

**Beispiel:**
```typescript
agent.createTask('stage_main', 'HandleBallBoundary', 'Abprall-/Reset-Logik für Ball');
```

**Nat.-Sprach-Trigger:**
- „Wenn der Ball die Wand trifft, soll …"
- „Beim Klick auf den Start-Button …"
- „Wenn die Zeit abläuft …"

---

#### `setTaskTriggerMode(taskName, mode)`

Setzt den Ausführungsmodus (relevant für Multiplayer).

**Signatur:**
```typescript
setTaskTriggerMode(taskName: string, mode: 'local-sync' | 'local' | 'broadcast'): void
```

**Modi:**
- `'local-sync'` (Default) — Lokale Ausführung, synchron mit Server
- `'local'` — Rein lokal, keine Synchronisation
- `'broadcast'` — Wird an alle verbundenen Clients gesendet

**Beispiel:**
```typescript
agent.setTaskTriggerMode('HandleMultiplayerChat', 'broadcast');
```

---

#### `addTaskParam(taskName, paramName, type?, defaultValue?)`

Definiert einen Eingangsparameter für einen Task (Event-Payload).

**Signatur:**
```typescript
addTaskParam(taskName: string, paramName: string, type?: string, defaultValue?: any): void
```

**Parameter:**
- `type` — Default: `'string'`. Andere: `'number'`, `'boolean'`, `'object'`
- `defaultValue` — Default: `''`

**Verwendung:** Event-Daten wie `hitSide` (bei `onBoundaryHit`) oder `key` (bei `onKeyPress`) werden so deklariert, damit der Inspector sie anzeigt.

**Beispiel:**
```typescript
agent.createTask('stage_main', 'HandleBoundaryHit', 'Abprall-Logik');
agent.addTaskParam('HandleBoundaryHit', 'hitSide', 'string', '');
agent.addTaskParam('HandleBoundaryHit', 'velocityBefore', 'number', 0);
```

---

#### `moveActionInSequence(taskName, fromIndex, toIndex)`

Ändert die Reihenfolge einer Sequenz-Position.

**Signatur:**
```typescript
moveActionInSequence(taskName: string, fromIndex: number, toIndex: number): void
```

**Verhalten:**
- 0-basierte Indizes
- Wirft Exception bei out-of-bounds
- Invalidiert FlowChart

**Beispiel:**
```typescript
// Verschiebe die 3. Action an Position 0
agent.moveActionInSequence('StartGame', 2, 0);
```

---

#### `duplicateTask(taskName, newName, stageId?)`

Klont einen Task (tief) inklusive `actionSequence`.

**Signatur:**
```typescript
duplicateTask(taskName: string, newName: string, stageId?: string): string
```

**Verhalten:**
- Deep-Clone via `JSON.parse(JSON.stringify())`
- Wirft Exception, wenn `newName` bereits existiert
- Generiert `flowLayout` automatisch

**Beispiel:**
```typescript
agent.duplicateTask('HandleLeftPaddle', 'HandleRightPaddle', 'stage_main');
```

---

### 3.3 Action-Management

#### `addAction(taskName, actionType, actionName, params?)`

**Die zentrale Methode für Logik-Aufbau.** Erstellt eine Action global UND fügt sie als Referenz zum Task hinzu.

**Signatur:**
```typescript
addAction(
  taskName: string,
  actionType: ActionType,
  actionName: string,
  params?: Record<string, any>
): void
```

**Verhalten (6 Schritte):**
1. Sucht Task per Name (global + alle Stages)
2. Prüft, ob Action mit diesem Namen bereits existiert
3. Wenn ja mit **anderem Type** → Exception
4. Wenn ja mit gleichem Type → `Object.assign(actionDef, params)` (Update)
5. Wenn nein → neu in `stage_blueprint.actions[]` anlegen
6. Pusht `{type: 'action', name: actionName}` in `task.actionSequence`

**Beispiele pro ActionType:**

```typescript
// Property ändern
agent.addAction('StartGame', 'property', 'ActivateGame', {
  target: 'GameState',
  changes: { state: 'playing' }
});

// Methode aufrufen
agent.addAction('StartGame', 'call_method', 'StartTimer', {
  target: 'CountdownTimer',
  method: 'timerStart'
});

// Berechnung
agent.addAction('OnTimerTick', 'calculate', 'DecrementCountdown', {
  formula: 'Countdown - 1',
  resultVariable: 'Countdown'
});

// Variable setzen
agent.addAction('OnLogin', 'set_variable', 'StoreSession', {
  variableName: 'sessionToken',
  value: '${loginResult.token}'
});

// Vorzeichen umkehren (für Abprall)
agent.addAction('HandleBounce', 'negate', 'NegateBallX', {
  target: 'Ball',
  changes: { velocityX: 1 }
});

// Stage wechseln
agent.addAction('OnGameOver', 'navigate_stage', 'GoToGameover', {
  stageId: 'stage_gameover'
});

// HTTP-Request
agent.addAction('OnSubmit', 'http', 'SendLogin', {
  url: '/api/login',
  method: 'POST',
  body: { username: '${usernameInput.text}', password: '${passwordInput.text}' },
  resultVariable: 'loginResult'
});
```

**Nat.-Sprach-Trigger:**
- „Setze X auf Y"
- „Rufe Methode Z auf"
- „Berechne die neue Punktzahl"
- „Sende eine Anfrage an …"
- „Wechsle zur Stage …"

---

#### `addTaskCall(taskName, calledTaskName)`

Fügt einen Subroutine-Aufruf in eine Task-Sequenz ein.

**Signatur:**
```typescript
addTaskCall(taskName: string, calledTaskName: string): void
```

**Verhalten:**
- Prüft, dass beide Tasks existieren (Exception sonst)
- Pusht `{type: 'task', name: calledTaskName}` in `task.actionSequence`

**Beispiel:**
```typescript
agent.createTask('stage_main', 'HandleCollision', 'Bei Kollision');
agent.createTask('stage_main', 'PlaySound', 'Sound abspielen');
agent.createTask('stage_main', 'UpdateScore', 'Score erhöhen');

agent.addTaskCall('HandleCollision', 'PlaySound');
agent.addTaskCall('HandleCollision', 'UpdateScore');
```

---

#### `ensureActionDefined(actionType, actionName, params?, stageId?)` (public Helper)

Definiert eine Action ohne sie an einen Task anzuhängen. Wird intern vom `BranchBuilder` genutzt, kann aber auch direkt verwendet werden.

**Signatur:**
```typescript
ensureActionDefined(
  actionType: ActionType,
  actionName: string,
  params?: Record<string, any>,
  stageId?: string
): void
```

**Verhalten:**
- Sucht Action global oder in `stageId`
- Wenn existent: Update
- Wenn neu: anlegen — Priorität `stageId` > Blueprint > Project-Root

**Wann nutzen:**
- Wenn Actions programmgesteuert vorbereitet werden, bevor der Task existiert
- In `addBranch`-Then/Else-Zweigen via `BranchBuilder.addNewAction()`

---

### 3.4 Branch-Management

#### `addBranch(taskName, variable, operator, value, thenBuilder, elseBuilder?)`

Fügt eine Verzweigung (If/Then/Else) in eine Task-Sequenz ein.

**Signatur:**
```typescript
addBranch(
  taskName: string,
  conditionVariable: string,
  operator: ConditionOperator,    // '==' | '!=' | '>' | '<' | '>=' | '<='
  conditionValue: string | number,
  thenBuilder: (branch: BranchBuilder) => void,
  elseBuilder?: (branch: BranchBuilder) => void
): void
```

**`BranchBuilder`-API:**
```typescript
branch.addAction(actionName: string)              // → referenziert bestehende Action
branch.addNewAction(type, name, params)           // → definiert Action inline UND referenziert
branch.addTaskCall(calledTaskName: string)        // → Subroutine im Branch
```

**Verhalten:**
1. Findet Task
2. Ermittelt Stage-Kontext via `projectTaskRegistry.getTaskContainer()`
3. Führt `thenBuilder(new BranchBuilder(this, stageId))` aus
4. `ensureActionsExistGlobally()` — wirft Exception, wenn `addAction()`-Referenz auf nicht-existente Action zeigt
5. Pusht `{type:'condition', condition:{...}, then:[...], else:[...]}` in Sequenz
6. Rekursiv: `then`/`else`-Items können selbst wieder Conditions sein

**Beispiel (Login-Validierung):**
```typescript
agent.addBranch('ValidateLogin', 'loginResult.success', '==', 'true',
  (then) => {
    then.addAction('SaveSession');           // Muss existieren
    then.addTaskCall('NavigateToDashboard');
  },
  (els) => {
    els.addNewAction('property', 'ShowError', {
      target: 'ErrorLabel',
      changes: { visible: true, text: '${loginResult.message}' }
    });
  }
);
```

**Beispiel (Pong-Abprall mit verschachtelter Condition):**
```typescript
agent.addBranch('HandleBallBoundary', 'hitSide', '==', 'top',
  (then) => { then.addNewAction('negate', 'NegateBallY', { target: 'Ball', changes: { velocityY: 1 } }); }
  // Else fehlt — hitSide bottom: gleiche Aktion
);
agent.addBranch('HandleBallBoundary', 'hitSide', '==', 'bottom',
  (then) => { then.addNewAction('negate', 'NegateBallY', { target: 'Ball', changes: { velocityY: 1 } }); }
);
agent.addBranch('HandleBallBoundary', 'hitSide', '==', 'left',
  (then) => { then.addNewAction('property', 'ScoreRight', { target: 'GameState', changes: { scoreRight: '${scoreRight + 1}' } }); }
);
```

**Nat.-Sprach-Trigger:**
- „Wenn X gleich Y ist, dann … sonst …"
- „Prüfe ob der Ball links abprallt"
- „Je nachdem ob der User eingeloggt ist"

---

### 3.5 Löschen

Alle Lösch-Methoden sind **kaskadierend** — sie bereinigen Referenzen automatisch.

#### `deleteTask(taskName)`

Löscht einen Task + alle Referenzen.

**Verhalten:**
- Entfernt aus `stage.tasks[]` (alle Stages)
- Entfernt aus `project.tasks[]` (Legacy)
- **Bereinigt Event-Bindings auf Objekten** (`object.events[...] = taskName` → delete)
- Invalidiert FlowChart

```typescript
agent.deleteTask('HandleBoundaryHit');
```

#### `deleteAction(actionName)`

Löscht eine Action + alle Sequenz-Referenzen.

**Verhalten:**
- Entfernt aus `stage.actions[]` (alle Stages) und `project.actions[]`
- Entfernt **rekursiv** aus allen Task-Sequenzen (auch in verschachtelten Branches/Loops)
- Invalidiert FlowCharts der betroffenen Tasks

```typescript
agent.deleteAction('NegateBallX');
```

#### `removeObject(stageId, objectName)`

Entfernt ein Komponenten-Objekt aus einer Stage.

```typescript
agent.removeObject('stage_main', 'OldSprite');
```

#### `deleteStage(stageId)`

Löscht eine Stage. **Blueprint-Stage ist geschützt!**

```typescript
agent.deleteStage('stage_temp');
// agent.deleteStage('stage_blueprint');  // ← wirft Exception!
```

#### `deleteVariable(variableName)`

Löscht eine Variable aus globalen + Stage-Scopes.

```typescript
agent.deleteVariable('temporaryCounter');
```

---

### 3.6 Umbenennen

#### `renameTask(oldName, newName)`

Benennt einen Task um und aktualisiert **alle** Referenzen automatisch (Events, Sub-Task-Aufrufe, FlowCharts).

**Signatur:**
```typescript
renameTask(oldName: string, newName: string): boolean
```

**Rückgabe:** `true` bei Erfolg.

**Delegiert an:** `projectTaskRegistry.renameTask()` — das zentrale Umbenennungs-Register.

```typescript
agent.renameTask('HandleClick', 'OnStartButtonClicked');
```

#### `renameAction(oldName, newName)`

Analog für Actions. Aktualisiert alle `actionSequence`-Einträge inkl. verschachtelter Branches.

```typescript
agent.renameAction('NegBall', 'NegateBallVelocityX');
```

---

### 3.7 Inventar (Read-Only)

Alle Listen-Methoden sind **Read-Only** und haben keine Nebenwirkungen.

#### `listStages()`

```typescript
agent.listStages(): { id, name, type, objectCount, taskCount }[]
```

#### `listTasks(stageId?)`

```typescript
agent.listTasks(): { name, actionCount, triggerMode }[]
agent.listTasks('stage_main');
```

#### `listActions(stageId?)`

```typescript
agent.listActions(): { name, type }[]
```

#### `listVariables(scope?)`

```typescript
agent.listVariables('global');    // nur globale
agent.listVariables('stage');     // nur Stage-lokale
agent.listVariables();            // alle
// → { name, type, value, scope }[]
```

#### `listObjects(stageId)`

```typescript
agent.listObjects('stage_main'): { name, className, x, y, visible }[]
```

#### `getTaskDetails(taskName)`

```typescript
agent.getTaskDetails('HandleClick')
// → { name, description, sequence, triggerMode }
```

Gibt die vollständige `actionSequence` zurück, inklusive verschachtelter Branches/Loops.

---
### 3.8 UI-Interaktion

#### `setProperty(stageId, objectName, property, value)`

Setzt eine beliebige Property auf einem Komponenten-Objekt. Unterstützt **Dot-Notation** für verschachtelte Felder.

**Signatur:**
```typescript
setProperty(stageId: string, objectName: string, property: string, value: any): void
```

**Verhalten:**
- Dot-Pfad wird aufgelöst (`'style.backgroundColor'` → `obj.style.backgroundColor`)
- Fehlende Zwischenobjekte werden automatisch als `{}` angelegt
- Wirft Exception bei unbekannter Stage oder unbekanntem Objekt

**Beispiele:**
```typescript
agent.setProperty('stage_main', 'StartButton', 'enabled', false);
agent.setProperty('stage_main', 'StartButton', 'text', 'Läuft…');
agent.setProperty('stage_main', 'Ball', 'style.backgroundColor', '#00ff00');
agent.setProperty('stage_main', 'ScoreLabel', 'visible', true);
```

---

#### `bindVariable(stageId, objectName, property, expression)`

Bindet eine Property an eine Variable oder einen Ausdruck.

**Signatur:**
```typescript
bindVariable(stageId: string, objectName: string, property: string, expression: string): void
```

**Verhalten:**
- Wenn `expression` **nicht** mit `${` beginnt, wird automatisch `${...}` drumgelegt
- Resultat: `object[property] = '${expression}'` — die `ReactiveRuntime` löst zur Laufzeit auf

**Beispiele:**
```typescript
// Einfache Variable
agent.bindVariable('stage_main', 'ScoreLabel', 'text', 'score');
// → ScoreLabel.text = '${score}'

// Ausdruck
agent.bindVariable('stage_main', 'StatusLabel', 'text', 'playerName + " - Level " + currentLevel');
// → StatusLabel.text = '${playerName + " - Level " + currentLevel}'

// Verschachtelt (Dot-Notation in Expression)
agent.bindVariable('stage_login', 'WelcomeLabel', 'text', 'currentUser.name');
// → WelcomeLabel.text = '${currentUser.name}'
```

**Kritisch:** Die Syntax ist **`${variableName}`** — mit Dollarzeichen UND geschweiften Klammern. Ohne Dollar wird der Text wörtlich angezeigt.

---

#### `connectEvent(stageId, objectName, eventName, taskName)`

Verbindet ein Event eines Objekts mit einem Task.

**Signatur:**
```typescript
connectEvent(stageId: string, objectName: string, eventName: string, taskName: string): void
```

**Verhalten:**
- Prüft, dass Task existiert (Exception sonst)
- Schreibt `object.events[eventName] = taskName`
- `removeObject()` bereinigt diese Bindings automatisch

**Beispiele:**
```typescript
// Button-Klick
agent.connectEvent('stage_main', 'StartBtn', 'onClick', 'StartGame');

// Kollision
agent.connectEvent('stage_main', 'Ball', 'onCollision', 'HandleCollision');

// Timer-Tick
agent.connectEvent('stage_blueprint', 'CountdownTimer', 'onTimer', 'OnTimerTick');

// Spezifische Kollisions-Seite
agent.connectEvent('stage_main', 'Ball', 'onCollisionLeft', 'BallHitLeftPaddle');

// Boundary-Hit (mit hitSide-Parameter)
agent.connectEvent('stage_main', 'Ball', 'onBoundaryHit', 'HandleBoundaryHit');
```

---

### 3.9 Komponenten-Shortcuts

Diese Methoden wrappen `addObject()` mit sinnvollen Defaults und sind der **bevorzugte** Weg für häufige Komponenten.

#### `createSprite(stageId, name, x, y, width, height, opts?)`

```typescript
agent.createSprite('stage_main', 'Ball', 30, 20, 2, 2, {
  velocityX: 3, velocityY: 3,
  collisionEnabled: true, collisionGroup: 'ball',
  shape: 'circle',
  spriteColor: '#ff6b6b',
  backgroundImage: 'assets/ball.png',
  objectFit: 'contain',
  lerpSpeed: 0.1
});
```

**Defaults:**
- `velocityX/Y`: 0
- `collisionEnabled`: `true`
- `collisionGroup`: `'default'`
- `shape`: `'rect'` (alternativ `'circle'`)
- `spriteColor`: `'#ff6b6b'`
- `style.borderRadius`: 999 wenn `shape === 'circle'`, sonst 0

---

#### `createLabel(stageId, name, x, y, text, opts?)`

```typescript
agent.createLabel('stage_main', 'ScoreLabel', 28, 2, '${score}', {
  fontSize: 32,
  fontWeight: 'bold',
  color: '#f7c948',
  textAlign: 'center',
  width: 8, height: 3
});
```

**Hinweis:** `text` kann direkt ein Variable-Binding (`'${score}'`) sein — kein separates `bindVariable()` nötig.

---

#### `createGroupPanel(stageId, name, x, y, width, height, opts?)`

```typescript
agent.createGroupPanel('stage_main', 'HUD', 0, 0, 64, 5, {
  backgroundColor: 'rgba(0,0,0,0.5)',
  borderColor: '#555',
  borderWidth: 2,
  borderRadius: 4
});
```

Panels können `children` enthalten — Kinder nutzen **relative** Koordinaten zum Panel.

---

#### `createDialog(stageId, name, x, y, width, height, opts?)`

```typescript
agent.createDialog('stage_main', 'GameOverDialog', 10, 10, 20, 10, {
  title: 'Game Over',
  modal: true,
  closable: true,
  draggable: false,
  visible: false      // Wird per property-Action eingeblendet
});
```

---

#### `setSpriteCollision(stageId, spriteName, enabled, group?)`

```typescript
agent.setSpriteCollision('stage_main', 'Ball', true, 'ball');
```

---

#### `setSpriteVelocity(stageId, spriteName, velocityX, velocityY)`

```typescript
agent.setSpriteVelocity('stage_main', 'Ball', 5, -3);
```

---

### 3.10 Flow-Layout

#### `generateTaskFlow(taskName)`

Generiert Layout-Positionen für die visuelle Flow-Darstellung aus `actionSequence`.

**Signatur:**
```typescript
generateTaskFlow(taskName: string): void
```

**Verhalten:**
- Orthogonales Layout (alle Nodes gleiche Breite, zentriert)
- Schreibt `task.flowLayout = { [actionName]: {x, y}, ... }`
- Verschachtelte Branches werden horizontal versetzt (BRANCH_GAP: 40px)
- Konstanten: `NODE_HEIGHT: 50`, `Y_SPACING: 80`, `CENTER_X: 400`

**Wann nutzen:**
- Nach größeren Task-Umbauten, wenn der Agent das visuelle Layout vorgeben will
- Normalerweise nicht nötig — der `FlowGraphHydrator` generiert beim Laden automatisch

```typescript
agent.generateTaskFlow('HandleBoundaryHit');
```

---

### 3.11 Schema-API

Die Schema-API erlaubt dem Agent, **Komponenten-Wissen** abzufragen (Properties, Methods, Events, Warnings, Beispiele).

#### `getComponentSchema(className)`

```typescript
agent.getComponentSchema('TTimer')
// → {
//     className: 'TTimer',
//     description: 'Einfacher Timer mit timerStart/timerStop/reset',
//     stage: 'blueprint',
//     category: 'timers',
//     properties: { interval: {...}, maxInterval: {...}, ... },  // inkl. baseProperties
//     methods: [{ name: 'timerStart', params: [], description: '...' }],
//     events: ['onTimer', 'onMaxIntervalReached', 'onClick', 'onFocus', ...],  // inkl. baseEvents
//     warnings: ['⚠️ Nicht start() verwenden, sondern timerStart()'],
//     example: { className: 'TTimer', name: 'MyTimer', interval: 1000, ... }
//   }
```

**Agent-Pattern:** Vor dem Aufruf von `addObject(stageId, { className: 'XYZ', ... })` kann der Agent `getComponentSchema('XYZ')` abfragen, um die gültigen Properties zu kennen.

**Voraussetzung:** Schema muss per `AgentController.setComponentSchema(schema)` geladen sein (passiert automatisch beim Start über `SchemaLoader`).

---

#### `AgentController.setComponentSchema(schema)` (statisch)

```typescript
// Im App-Start (macht SchemaLoader automatisch):
import { loadComponentSchemas } from './services/SchemaLoader';
await loadComponentSchemas();

// Oder manuell:
AgentController.setComponentSchema({
  components: {...},
  baseProperties: {...},
  actionTypes: {...},
  ...
});
```

---

### 3.12 Validierung & Batch

#### `validate()`

Prüft das Projekt auf Konsistenz.

**Signatur:**
```typescript
validate(): { level: 'error' | 'warning', message: string }[]
```

**Geprüfte Regeln:**

| Level | Regel |
|:---:|:---|
| ❌ error | Inline-Actions in Task-Sequenzen (Objekt hat mehr als `type` und `name`) |
| ❌ error | Task referenziert Action, die nicht definiert ist |
| ⚠️ warning | Action ist definiert, aber in keinem Task referenziert (verwaist) |
| ⚠️ warning | Task hat `actionSequence.length > 0`, aber kein FlowChart |

**Agent-Pattern (Self-Healing):**

```typescript
let issues = agent.validate();
while (issues.filter(i => i.level === 'error').length > 0) {
  for (const issue of issues) {
    if (issue.level === 'error') {
      // Parse message → identify missing entity → create it
      // (Dies ist der "Lehrer-Feedback-Loop" aus AI_Agent_Integration_Plan.md)
    }
  }
  issues = agent.validate();
}
```

---

#### `executeBatch(operations)`

**Atomare Mehrfach-Operationen mit automatischem Rollback bei Fehler.**

**Signatur:**
```typescript
executeBatch(operations: Array<{ method: string; params: any[] }>): Array<{
  method: string;
  success: boolean;
  data: any;
  error: string | null;
}>
```

**Verhalten:**
1. Snapshot des Projekts via `JSON.stringify(project)`
2. Führt Operationen sequenziell aus
3. Bei **erstem Fehler**: Rollback (restauriert Snapshot per `Object.assign`)
4. Gibt für jede Operation `{method, success, data, error}` zurück

**Beispiel:**
```typescript
const results = agent.executeBatch([
  { method: 'createTask', params: ['stage_main', 'NewTask'] },
  { method: 'addAction', params: ['NewTask', 'property', 'SetX', { target: 'Ball', changes: { x: 10 } }] },
  { method: 'connectEvent', params: ['stage_main', 'StartBtn', 'onClick', 'NewTask'] }
]);

// Alle 3 erfolgreich → Projekt ist mutiert
// Wenn Op 2 fehlschlägt → Rollback, NewTask wird wieder entfernt
```

**Wann nutzen:**
- **Primäre Oberfläche für LLMs** — ein Prompt → ein Batch → alles-oder-nichts
- Komplexe Workflows, die als Einheit Sinn machen
- Transaktionale Garantie bei fehlerhaften Inputs

---

<!-- ANCHOR-SECTION-4 -->

## §4 ActionType-Katalog

> [!IMPORTANT]
> **Quelle der Wahrheit:** `src/model/types.ts:88` (`export type ActionType = ...`) definiert exakt **24 legale Strings** für das Feld `action.type`. Jeder andere Wert wird vom Validator als Fehler markiert und vom Runtime-`ActionRegistry` als "unbekannt" übersprungen.
>
> **Registrierung:** Die Runtime-Handler leben in `src/runtime/actions/handlers/*.ts` und werden via `actionRegistry.register('<type>', handler, metadata)` eingehängt. Einige `ActionType`-Strings sind im Union deklariert, aber **nicht** unter diesem Namen registriert — sie sind *Reserved / Engine-intern* und werden unten explizit markiert.

### §4.0 Die 24 ActionTypes auf einen Blick

| # | ActionType | Kategorie | Pflicht-Parameter | Handler-Datei | Status |
|:--:|:---|:---|:---|:---|:---|
| 1 | `property` | A. Property & Math | `target`, `changes` | `PropertyActions.ts` | ✅ Aktiv |
| 2 | `variable` | A. Property & Math | `variableName` (+ `source`\|`value`) | `VariableActions.ts` | ✅ Aktiv |
| 3 | `set_variable` | A. Property & Math | `variableName` (+ `source`\|`value`) | `VariableActions.ts` | ⚠️ Legacy-Alias für `variable` |
| 4 | `increment` | A. Property & Math | `target`, `changes` | `PropertyActions.ts` (Teil von `property`) | ⚠️ Alias / Prop-Arithmetik |
| 5 | `negate` | A. Property & Math | `target`, `changes` | `CalculateActions.ts` | ✅ Aktiv |
| 6 | `calculate` | A. Property & Math | `resultVariable`, `calcSteps`\|`formula` | `CalculateActions.ts` | ✅ Aktiv |
| 7 | `call_method` | B. Method & Service | `target`, `method` | `MiscActions.ts` | ✅ Aktiv |
| 8 | `service` | B. Method & Service | `service`, `method` | `MiscActions.ts` | ✅ Aktiv |
| 9 | `navigate` | C. Flow & Navigation | `target` (Projekt-Name) | `NavigationActions.ts` | ⚠️ Hidden / Legacy |
| 10 | `navigate_stage` | C. Flow & Navigation | `stageId` | `NavigationActions.ts` | ✅ Aktiv |
| 11 | `broadcast` | C. Flow & Navigation | `event` | *(keine Registry; `triggerMode='broadcast'` auf Task)* | 🔒 Reserved |
| 12 | `animate` | D. Animation & Audio | `target`, `effect` | `AnimationActions.ts` | ✅ Aktiv |
| 13 | `audio` | D. Animation & Audio | `target` | *(Legacy-Alias)* | ⚠️ Alias → `play_audio` |
| 14 | `play_audio` | D. Animation & Audio | `target` | `MiscActions.ts` | ✅ Aktiv |
| 15 | `stop_audio` | D. Animation & Audio | `target` | `MiscActions.ts` | ✅ Aktiv |
| 16 | `http` | E. Network / HTTP | `url`, `method` | `HttpActions.ts` | ✅ Aktiv |
| 17 | `data_action` | E. Network / HTTP | `resource`, `method` | `HttpActions.ts` | ✅ Aktiv (High-Level) |
| 18 | `smooth_sync` | F. Multiplayer / Sync | — | *(Engine-intern, `FlowTick`)* | 🔒 Reserved |
| 19 | `send_multiplayer_sync` | F. Multiplayer / Sync | — | *(Engine-intern)* | 🔒 Reserved |
| 20 | `server_connect` | F. Multiplayer / Sync | — | *(`MultiplayerManager`)* | 🔒 Reserved |
| 21 | `server_create_room` | F. Multiplayer / Sync | `game` | `MiscActions.ts` (als `create_room`) | 🔒 Name-Mismatch |
| 22 | `server_join_room` | F. Multiplayer / Sync | `params.code` | `MiscActions.ts` (als `join_room`) | 🔒 Name-Mismatch |
| 23 | `server_ready` | F. Multiplayer / Sync | — | *(Engine-intern)* | 🔒 Reserved |
| 24 | `engine_control` | G. Engine Control | — | *(Engine-intern)* | 🔒 Reserved |

**Legende:**
- ✅ **Aktiv** — Handler unter diesem Namen registriert, volle Unterstützung in `addAction()`
- ⚠️ **Legacy / Alias** — Funktioniert, aber in Inspector `hidden: true` oder nur aus Abwärtskompatibilität
- 🔒 **Reserved / Engine-intern** — Im `ActionType`-Union deklariert, aber nicht als normale Action ausführbar; vom Agent **nicht zu erzeugen**

### §4.1 Taxonomie — 7 Kategorien

```
A. Property & Math       → Werte mutieren, lesen, berechnen            (6 Typen)
B. Method & Service      → Funktionen/Services aufrufen                (2 Typen)
C. Flow & Navigation     → Stage-Wechsel, globale Events               (3 Typen)
D. Animation & Audio     → Visuelle Effekte und Ton                    (4 Typen)
E. Network / HTTP        → REST-Aufrufe, Datenquellen                  (2 Typen)
F. Multiplayer / Sync    → Room-Management, Netzwerk-Sync              (6 Typen, meist Reserved)
G. Engine Control        → Runtime-interne Operationen                 (1 Typ,   Reserved)
────────────────────────────────────────────────────────────────────────────────
Σ                                                                      24 Typen
```

### §4.2 Konventionen für alle Steckbriefe

Jeder Steckbrief folgt diesem Schema:

1. **Zweck** — ein Satz, was die Action bewirkt
2. **TS-Interface** — die statische Typ-Signatur aus `src/model/types.ts` (falls vorhanden)
3. **Parameter-Tabelle** — Pflicht / optional mit Typ + Beschreibung
4. **Beispiel** — `agent.addAction(...)` Aufruf
5. **Runtime-Behavior** — was der Handler real tut (Quelle: `handlers/*.ts`)
6. **Validator-Regeln / Caveats** — was schiefgehen kann
7. **Legacy / Hidden** — falls zutreffend

---

## §4.A Property & Math

### §4.A.1 `property` — Eigenschaft(en) eines Objekts setzen

**Zweck:** Schreibt einen oder mehrere Property-Werte auf eine Komponente (UI-Eigenschaft, Farbe, Position, Text, …). **Die Workhorse-Action** für UI-Manipulation.

**TS-Interface:**
```typescript
interface PropertyAction extends BaseAction {
  type: 'property' | 'increment' | 'negate';
  target: string;                 // Komponentenname (aus stage.objects[].name)
  changes: Record<string, any>;   // { property: value, ... }
}
```

**Parameter:**

| Name | Typ | Pflicht | Beschreibung |
|:---|:---|:--:|:---|
| `target` | `string` | ✅ | Name des Zielobjekts (nicht `id`). Auch `${var}`-Interpolation möglich. |
| `changes` | `Record<string, any>` | ✅ | Key/Value-Map der zu setzenden Properties. Werte dürfen `${var}` enthalten. |

**Beispiel:**
```typescript
agent.addAction('UpdateScore', 'property', 'SetScoreText', {
  target: 'ScoreLabel',
  changes: { text: 'Score: ${score}', textColor: '#00ff00' }
});
```

**Runtime-Behavior:** `PropertyHelper.setPropertyValue(target, key, interpolate(value))` pro Entry in `changes`. Arithmetische Ausdrücke wie `'${hp} - 10'` werden via `ExpressionParser` (JSEP) sicher ausgewertet.

**Caveats:**
- `target` muss **exakt** dem `objectName` entsprechen — keine Fuzzy-Suche.
- Unbekannte Property-Keys werden stillschweigend ignoriert (kein Laufzeit-Fehler, aber `Logger.warn`).
- Schutz gegen Prototype-Pollution: `__proto__`, `constructor`, `prototype` sind in `PropertyHelper` geblockt.

---

### §4.A.2 `variable` — Variable aus Quelle lesen & zuweisen

**Zweck:** Liest einen Wert aus (a) einem Objekt-Property, (b) einer anderen Variable oder (c) einem Literal und **schreibt ihn in eine Ziel-Variable**.

**TS-Interface:**
```typescript
interface VariableAction extends BaseAction {
  type: 'variable' | 'set_variable';
  variableName: string;           // Ziel (muss existieren!)
  source?: string;                // Quell-Objekt oder -Variable
  sourceProperty?: string;        // Property des Quell-Objekts
  value?: any;                    // Literal / ${interpolation}
}
```

**Parameter:**

| Name | Typ | Pflicht | Beschreibung |
|:---|:---|:--:|:---|
| `variableName` | `string` | ✅ | Name der Zielvariable (muss via `addVariable` existieren) |
| `source` | `string` | ⚪ | Quell-Objekt oder -Variable; mit `sourceProperty` kombiniert |
| `sourceProperty` | `string` | ⚪ | Property am `source` (z.B. `text`, `value`) |
| `value` | `any` | ⚪ | Literal oder `'${otherVar}'` — falls keine `source` gesetzt |

**Beispiel (Literal):**
```typescript
agent.addAction('InitHP', 'variable', 'SetStartHP', {
  variableName: 'playerHP',
  value: 100
});
```

**Beispiel (aus Objekt-Property lesen):**
```typescript
agent.addAction('ReadInput', 'variable', 'CaptureName', {
  variableName: 'userName',
  source: 'NameInput',
  sourceProperty: 'text'
});
```

**Runtime-Behavior:** Auflösungsreihenfolge: (1) Objekt-Property → (2) Variable → (3) Interpolation → (4) Literal. Ziel-Variable wird in `context.vars[variableName]` geschrieben **und** das passende `TVariable`-Objekt in `context.objects` aktualisiert (für reaktive Bindings).

**Caveats:**
- `variableName` muss in `project.stages[*].variables[]` oder `project.variables[]` existieren.
- Ohne `source` und ohne `value` → Runtime-Warning, keine Zuweisung.

---

### §4.A.3 `set_variable` — Legacy-Alias für `variable`

**Zweck:** Identisch zu `variable`, aber historisch als "Zuweisung-statt-Lesen" markiert.

**Status:** ⚠️ **Hidden / Legacy.** Im Inspector mit `hidden: true` (wird nicht in Dropdowns angezeigt).

**Empfehlung für Agent:** **Immer `'variable'` erzeugen** — `set_variable` nur akzeptieren, wenn in bestehendem Projekt gefunden.

---

### §4.A.4 `increment` — Property um Delta erhöhen/verringern

**Zweck:** Arithmetische Änderung einer numerischen Property (Kurzform für `value + delta`).

**TS-Interface:** Teilt sich `PropertyAction` mit `property` (siehe §4.A.1), aber die `changes`-Werte werden als **Deltas** interpretiert.

**Parameter:**

| Name | Typ | Pflicht | Beschreibung |
|:---|:---|:--:|:---|
| `target` | `string` | ✅ | Komponentenname |
| `changes` | `Record<string, number>` | ✅ | Delta-Werte (positiv = erhöhen, negativ = verringern) |

**Beispiel:**
```typescript
agent.addAction('TakeDamage', 'increment', 'HPDown', {
  target: 'Player',
  changes: { hp: -10 }       // hp = hp - 10
});
```

**Runtime-Behavior:** Wird vom gleichen Handler wie `property` verarbeitet; der Branch `action.type === 'increment'` addiert statt überschreibt.

**Caveats:**
- Nur auf **numerische** Properties anwendbar — bei Strings/Booleans: silent ignore.
- Für komplexe Arithmetik besser `calculate` mit `calcSteps` nutzen.

---

### §4.A.5 `negate` — Numerisches Property negieren

**Zweck:** Multipliziert eine Property mit `-1` (Vorzeichen-Flip). Praktisch für Paddle-Richtung, Spiegelungen.

**Parameter:**

| Name | Typ | Pflicht | Beschreibung |
|:---|:---|:--:|:---|
| `target` | `string` | ✅ | Komponentenname |
| `changes` | `Record<string, any>` | ✅ | Keys der zu negierenden Properties (Werte ignoriert) |

**Beispiel:**
```typescript
agent.addAction('BounceBall', 'negate', 'FlipVY', {
  target: 'Ball',
  changes: { vy: true }       // vy = -vy
});
```

**Runtime-Behavior:** `CalculateActions.ts` liest aktuellen Wert, multipliziert mit `-1`, schreibt zurück.

**Caveats:** Wie `increment` — nur sinnvoll auf Number-Properties.

---

### §4.A.6 `calculate` — Schrittweise arithmetische Berechnung

**Zweck:** Berechnet einen Ausdruck aus Variablen/Konstanten über eine Kette von `CalcStep`s und speichert das Ergebnis in einer Variable.

**TS-Interface:**
```typescript
interface CalculateAction extends BaseAction {
  type: 'calculate';
  resultVariable: string;
  formula: string;             // Legacy: "${a} + ${b}" (wird geparst)
  calcSteps?: CalcStep[];      // Preferred: strukturierte Schritte
}

interface CalcStep {
  operator?: '+' | '-' | '*' | '/' | '%';  // Undefined beim 1. Schritt
  operandType: 'variable' | 'constant';
  variable?: string;           // Wenn operandType='variable'
  constant?: any;              // Wenn operandType='constant'
}
```

**Parameter:**

| Name | Typ | Pflicht | Beschreibung |
|:---|:---|:--:|:---|
| `resultVariable` | `string` | ✅ | Ziel-Variable für das Ergebnis |
| `calcSteps` | `CalcStep[]` | ⚪ (empfohlen) | Sequenz: 1. Schritt = Startwert, folgende = Operation + Operand |
| `formula` | `string` | ⚪ (legacy) | Ausdruck wie `"${a} * 2 + ${b}"`; wird via `ExpressionParser` (JSEP) geparst |

**Beispiel (`calcSteps` — bevorzugt):**
```typescript
agent.addAction('CalcScore', 'calculate', 'ComputeTotal', {
  resultVariable: 'totalScore',
  calcSteps: [
    { operandType: 'variable', variable: 'baseScore' },          // Start: baseScore
    { operator: '+', operandType: 'variable', variable: 'bonus' }, // + bonus
    { operator: '*', operandType: 'constant', constant: 2 }        // * 2
  ]
});
// → totalScore = (baseScore + bonus) * 2
```

**Beispiel (`formula` — legacy):**
```typescript
agent.addAction('CalcScore', 'calculate', 'ComputeTotal', {
  resultVariable: 'totalScore',
  formula: '(${baseScore} + ${bonus}) * 2'
});
```

**Runtime-Behavior:**
- Mit `calcSteps`: Iterative Akkumulation, Division durch 0 → `Infinity` (kein Crash).
- Mit `formula`: Interpolation + `ExpressionParser.evaluate()`. JSEP-Whitelist blockt `eval`, `Function`, DOM-Zugriff.

**Caveats:**
- `calcSteps[0].operator` muss **undefined** sein (Startwert hat keinen Operator).
- `calcSteps.length >= 1` — ein leeres Array produziert `undefined`-Ergebnis.
- `formula` darf **nur** arithmetische Ausdrücke enthalten (keine Funktions-Calls, keine `;`).

---

## §4.B Method & Service

### §4.B.1 `call_method` — Methode auf Objekt oder Service aufrufen

**Zweck:** Ruft eine Methode direkt auf einer Komponente, einem registrierten Service oder dem `Toaster` auf. **Die flexibelste Action** für alles, was nicht Property-Setzen ist.

**TS-Interface:**
```typescript
interface MethodAction extends BaseAction {
  type: 'call_method';
  target: string;              // Objekt-Name ODER Service-Name
  method: string;              // Methodenname
  params?: any[];              // Argumente (mit ${var}-Interpolation)
  resultVariable?: string;     // Optional: Rückgabewert in Variable speichern
}
```

**Parameter:**

| Name | Typ | Pflicht | Beschreibung |
|:---|:---|:--:|:---|
| `target` | `string` | ✅ | Objekt- oder Service-Name |
| `method` | `string` | ✅ | Methodenname (muss auf `target` existieren) |
| `params` | `any[]` | ⚪ | Array von Argumenten; `${var}` wird interpoliert |
| `resultVariable` | `string` | ⚪ | Ziel-Variable für Rückgabewert |

**Beispiel:**
```typescript
agent.addAction('ValidateUser', 'call_method', 'CheckLogin', {
  target: 'AuthService',
  method: 'validate',
  params: ['${userName}', '${password}'],
  resultVariable: 'isValid'
});
```

**Runtime-Behavior:**
1. Erst: `resolveTarget(target)` auf `context.objects` → wenn gefunden, `obj[method](...params)`
2. Sonst: `serviceRegistry.has(target)` → `serviceRegistry.call(target, method, params)`
3. Spezialfall: `target='Toaster'`, `method='show'` → ruft `TToast.show(msg, type)`
4. Rückgabewert (falls Promise, wird `await`ed) landet in `context.vars[resultVariable]`.

**Caveats:**
- Async-Methoden funktionieren automatisch (Handler ist `async`).
- Bei nicht-gefundener Methode: `Logger.warn`, Task läuft weiter (non-fatal).

---

### §4.B.2 `service` — Dedicated Service-Aufruf

**Zweck:** Ruft eine Methode auf einem im `serviceRegistry` registrierten Service auf (z.B. `GameEngineService`, `AuthService`). Ähnlich `call_method`, aber **exklusiv für Services**.

**TS-Interface:**
```typescript
interface ServiceAction extends BaseAction {
  type: 'service';
  service: string;
  method: string;
  serviceParams?: any[];
  resultVariable?: string;
}
```

**Parameter:**

| Name | Typ | Pflicht | Beschreibung |
|:---|:---|:--:|:---|
| `service` | `string` | ✅ | Name des Services (in `serviceRegistry`) |
| `method` | `string` | ✅ | Methodenname am Service |
| `serviceParams` | `any[]` | ⚪ | Argumente (interpoliert) |
| `resultVariable` | `string` | ⚪ | Ziel-Variable für Rückgabewert |

**Beispiel:**
```typescript
agent.addAction('StartEngine', 'service', 'InitRuntime', {
  service: 'GameEngineService',
  method: 'initialize',
  serviceParams: ['${projectId}']
});
```

**Runtime-Behavior:** Handler prüft `serviceRegistry.has(action.service)`, interpoliert Params, ruft `serviceRegistry.call(service, method, params)`.

**Caveats:**
- Wenn `service` nicht registriert → stille Abbruch, kein Fehler.
- Für Dual-Use (Objekt ODER Service) lieber `call_method` nutzen.

---

## §4.C Flow & Navigation

### §4.C.1 `navigate` — Projekt-Wechsel (Legacy)

**Zweck:** Wechselt zu einem **anderen GCS-Projekt**. Wird im Editor als `hidden: true` geführt.

**TS-Interface:** Teilweise in `BaseAction`, aber kein dediziertes Interface.

**Parameter:**

| Name | Typ | Pflicht | Beschreibung |
|:---|:---|:--:|:---|
| `target` | `string` | ✅ | Ziel-Projekt (Name/URL, interpoliert) |
| `params` | `Record<string, any>` | ⚪ | Übergabe-Parameter |

**Beispiel:**
```typescript
agent.addAction('ExitToMenu', 'navigate', 'GoToMenuProject', {
  target: 'menu'
});
```

**Runtime-Behavior:** Delegiert an `context.onNavigate(target, params)` — Callback des eingebetteten Players.

**Status:** ⚠️ **Hidden / Legacy.** Für Stage-Wechsel **immer `navigate_stage`** verwenden.

---

### §4.C.2 `navigate_stage` — Stage innerhalb des Projekts wechseln

**Zweck:** Wechselt zu einer anderen Stage desselben Projekts (z.B. Menu → Level1 → GameOver).

**TS-Interface:**
```typescript
interface NavigateAction extends BaseAction {
  type: 'navigate_stage';
  stageId: string;
}
```

**Parameter:**

| Name | Typ | Pflicht | Beschreibung |
|:---|:---|:--:|:---|
| `stageId` | `string` | ✅ | `id` der Ziel-Stage (aus `project.stages[].id`) |

**Beispiel:**
```typescript
agent.addAction('GoToLevel1', 'navigate_stage', 'EnterLevel1', {
  stageId: 'stage_level1'
});
```

**Runtime-Behavior:**
1. Sucht `TStageController` in `context.objects` (globaler Service in Blueprint) → `stageController.goToStage(stageId)`
2. Fallback: `context.onNavigate('stage:' + stageId, params)`

**Caveats:**
- `stageId` muss existieren — sonst wirft `TStageController` eine Exception, Runtime fängt ab, Stage bleibt unverändert.
- `stageId` darf `${var}` enthalten (Interpolation vor Auflösung).

---

### §4.C.3 `broadcast` — Globales Event senden (Reserved)

**Zweck:** Im Typ-Union deklariert für **Task-Broadcast** im Multiplayer, aber **kein Handler** unter diesem Namen.

**TS-Interface:**
```typescript
interface BroadcastAction extends BaseAction {
  type: 'broadcast';
  event: string;
  params?: Record<string, any>;
}
```

**Status:** 🔒 **Reserved.** Agent erzeugt **keine** Action mit `type: 'broadcast'`. Für echten Broadcast:
- Setze `task.triggerMode = 'broadcast'` via `agent.setTaskTriggerMode(taskName, 'broadcast')` — das erzeugt MP-Protocol-Frames.
- ODER: Verwende `call_method` auf einen Event-Bus-Service.

**Hintergrund:** Das `BroadcastAction`-Interface existiert für zukünftige Erweiterungen (Event-Bus als ActionType). Aktuell nicht implementiert.

---

## §4.D Animation & Audio

### §4.D.1 `animate` — Visueller Effekt auf Komponente

**Zweck:** Führt einen von 12 vordefinierten Animationseffekten auf einer Komponente aus (Shake, Pulse, Grow, Explode, FadeIn/Out, Spin, …).

**TS-Interface:** Kein dediziertes Interface — Parameter sind dynamisch, abhängig von `effect`.

**Parameter (global):**

| Name | Typ | Pflicht | Beschreibung |
|:---|:---|:--:|:---|
| `target` | `string` | ✅ | Komponentenname (oder komma-separierte Liste für Multi-Target) |
| `effect` | `string` | ✅ | Einer von: `shake`, `pulse`, `bounce`, `fade`, `grow`, `shrink`, `explode`, `pop`, `fadeIn`, `fadeOut`, `spin`, `wobble` |
| `duration` | `number` | ⚪ | Dauer in ms (Default: 500) |

**Effekt-spezifische Parameter:**

| Effekt | Extra-Parameter | Default |
|:---|:---|:---|
| `grow` / `shrink` / `pulse` | `targetScale` | 2.0 / 0.3 / 1.15 |
| `explode` | `fragments`, `spread` | 9, 120 |
| `pop` | `fragments` | 9 |
| `spin` | `degrees` | 360 |
| `wobble` / `shake` | `intensity` | 15 / 5 |
| `bounce` | `height` | 20 |
| `fade` | `targetOpacity` | 0 |
| `fadeIn` / `fadeOut` | (keine) | — |

**Beispiel:**
```typescript
agent.addAction('HitFlash', 'animate', 'ShakePlayer', {
  target: 'Player',
  effect: 'shake',
  duration: 300,
  intensity: 10
});
```

**Beispiel (Multi-Target):**
```typescript
agent.addAction('ExplodeAll', 'animate', 'BoomEnemies', {
  target: 'Enemy1, Enemy2, Enemy3',
  effect: 'explode',
  fragments: 12,
  spread: 200,
  duration: 800
});
```

**Runtime-Behavior:** `AnimationManager.getInstance().<effect>(target, params, duration)`. Multi-Target wird per Komma-Split iteriert; jede Komponente einzeln animiert.

**Caveats:**
- Unbekannter `effect` → Warning, nichts passiert.
- Legacy-Effekte (`shake`, `pulse`, `bounce`, `fade`) nutzen Duck-Typing: `(animManager as any)[effect]`.
- Animationen laufen **async** — der Task wartet **nicht** auf Abschluss.

---

### §4.D.2 `audio` — Legacy-Alias für `play_audio`/`stop_audio`

**Status:** ⚠️ **Legacy.** Im `ActionType`-Union noch deklariert, aber kein eigener Handler. Alter Code wird in `play_audio` umgeschrieben.

**Empfehlung:** **Immer `play_audio` oder `stop_audio` explizit** — niemals `'audio'`.

---

### §4.D.3 `play_audio` — Audio-Element abspielen

**Zweck:** Startet Wiedergabe eines `TAudio`-Elements (WebAudio API, zero-latency).

**TS-Interface:**
```typescript
interface AudioAction extends BaseAction {
  type: 'play_audio' | 'stop_audio';
  target: string;
}
```

**Parameter:**

| Name | Typ | Pflicht | Beschreibung |
|:---|:---|:--:|:---|
| `target` | `string` | ✅ | Name des `TAudio`-Objekts |

**Beispiel:**
```typescript
agent.addAction('Boom', 'play_audio', 'PlayExplosion', {
  target: 'ExplosionSfx'
});
```

**Runtime-Behavior:** `targetObj.play()` auf `TAudio`-Instanz. Wenn Target nicht `TAudio` → Warning.

**Caveats:**
- `TAudio`-Komponente muss in einer Stage existieren (typisch im Blueprint für globale Sounds).
- Keine Volume/Loop-Parameter hier — via `property`-Action separat setzen.

---

### §4.D.4 `stop_audio` — Audio stoppen

**Zweck:** Stoppt ein laufendes `TAudio`-Element.

**Parameter:** identisch zu `play_audio` (nur `target`).

**Beispiel:**
```typescript
agent.addAction('Silence', 'stop_audio', 'StopBGM', {
  target: 'BackgroundMusic'
});
```

**Runtime-Behavior:** `targetObj.stop()`.

---

## §4.E Network / HTTP

### §4.E.1 `http` — Roher HTTP-Request

**Zweck:** Führt einen REST-Aufruf (GET/POST/PUT/DELETE) gegen eine freie URL aus und speichert die Response optional in einer Variable.

**TS-Interface:**
```typescript
interface HttpAction extends BaseAction {
  type: 'data_action' | 'http';     // 'http' = raw, 'data_action' = higher-level
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  resource?: string;
  queryProperty?: string;
  queryValue?: string;
  queryOperator?: string;
  selectFields?: string;
  body?: any;
  resultVariable?: string;
  resultPath?: string;              // z.B. 'user' → extrahiert response.user
}
```

**Parameter:**

| Name | Typ | Pflicht | Beschreibung |
|:---|:---|:--:|:---|
| `url` | `string` | ✅ | Ziel-URL (mit `${var}`-Interpolation) |
| `method` | `'GET'\|'POST'\|'PUT'\|'DELETE'` | ✅ | HTTP-Methode |
| `body` | `any` | ⚪ | Request-Body (JSON-serialisiert bei POST/PUT) |
| `resultVariable` | `string` | ⚪ | Ziel-Variable für Response |
| `resultPath` | `string` | ⚪ | JSON-Pfad zum Extrahieren aus Response |

**Beispiel:**
```typescript
agent.addAction('LoadUserData', 'http', 'FetchUser', {
  url: 'https://api.example.com/users/${userId}',
  method: 'GET',
  resultVariable: 'userData',
  resultPath: 'user'
});
```

**Runtime-Behavior:** `fetch(url, { method, body })`, JSON-Parse, optional `resultPath` extrahieren, `context.vars[resultVariable] = result`.

**Caveats:**
- Netzwerkfehler → `Logger.error`, Variable bleibt leer, Task läuft weiter.
- CORS-Header müssen vom Server gesetzt sein (Browser-Kontext).
- Für Authentifizierung: `store_token` + manueller Header — oder über `data_action`.

---

### §4.E.2 `data_action` — High-Level Daten-Abfrage

**Zweck:** Strukturierte Abfrage gegen eine Datenquelle (REST-Resource + Query-Filter + Feld-Auswahl). Wie SQL auf HTTP.

**Parameter:**

| Name | Typ | Pflicht | Beschreibung |
|:---|:---|:--:|:---|
| `resource` | `string` | ✅ | Resource-Name (z.B. `'users'`, `'products'`) |
| `method` | `'GET'\|'POST'\|'PUT'\|'DELETE'` | ✅ | HTTP-Methode |
| `queryProperty` | `string` | ⚪ | Feld für WHERE-Filter (z.B. `'id'`) |
| `queryValue` | `string` | ⚪ | Wert für WHERE-Filter |
| `queryOperator` | `string` | ⚪ | Operator (`=`, `!=`, `>`, …); Default `=` |
| `selectFields` | `string` | ⚪ | Komma-separiert (z.B. `'id,name,email'`) |
| `body` | `any` | ⚪ | Body für POST/PUT |
| `resultVariable` | `string` | ⚪ | Ziel-Variable |

**Beispiel:**
```typescript
agent.addAction('FindUser', 'data_action', 'SearchUserByEmail', {
  resource: 'users',
  method: 'GET',
  queryProperty: 'email',
  queryOperator: '=',
  queryValue: '${searchEmail}',
  selectFields: 'id,name,email',
  resultVariable: 'foundUser'
});
```

**Runtime-Behavior:** Baut URL `<baseUrl>/<resource>?<queryProperty><queryOperator><queryValue>&fields=<selectFields>` und delegiert an `http`-Pfad.

**Caveats:**
- Base-URL muss vom Projekt konfiguriert sein (`project.meta.apiBaseUrl` oder Service-Registrierung).
- Für komplexe Queries (AND/OR/Joins) → `call_method` auf Backend-Service.

---

## §4.F Multiplayer / Sync (Reserved)

> [!WARNING]
> **Kein Agent sollte Actions mit folgenden Typen erzeugen:** `smooth_sync`, `send_multiplayer_sync`, `server_connect`, `server_create_room`, `server_join_room`, `server_ready`, `engine_control`.
>
> Diese sind im `ActionType`-Union deklariert für **Engine-interne** Multiplayer-Synchronisation via `MultiplayerManager` und `FlowTick`. Die realen Runtime-Handler heißen anders (`create_room`, `join_room`) oder sind gar nicht registriert.

### §4.F.1 `smooth_sync` — 🔒 Reserved

**Zweck:** Interpoliert Positionen/Properties remote-synchronisierter Objekte zwischen Netzwerk-Updates. **Läuft automatisch im `FlowTick`** — keine explizite Action nötig.

**Agent-Regel:** ❌ **Nie erzeugen.** Für Multiplayer-Sync auf Task-Ebene `triggerMode: 'broadcast'` setzen.

---

### §4.F.2 `send_multiplayer_sync` — 🔒 Reserved

**Zweck:** Sendet Property-Deltas an Peers (Teil des Protokolls). Engine-intern.

**Agent-Regel:** ❌ **Nie erzeugen.** Verwende `property` mit `action.sync = true` → automatischer Sync.

---

### §4.F.3 `server_connect` — 🔒 Reserved

**Zweck:** Verbindet mit MP-Server. Wird vom `MultiplayerManager` beim Start der Stage aufgerufen.

**Agent-Regel:** ❌ **Nie erzeugen.** Konfiguriere `project.meta.multiplayer.serverUrl` — Verbindung passiert automatisch.

---

### §4.F.4 `server_create_room` — 🔒 Name-Mismatch

**Zweck:** Erstellt MP-Raum. Der **real registrierte Handler heißt `create_room`** (nicht `server_create_room`).

**Runtime-Behavior (`create_room`):** `context.multiplayerManager.createRoom(action.game)` — via `game`-Parameter.

**Parameter (bei `create_room`):**

| Name | Typ | Pflicht | Beschreibung |
|:---|:---|:--:|:---|
| `game` | `string` | ✅ | Spiel-Identifikator (interpoliert) |

**Agent-Regel:** Falls du eine Room-Creation-Action brauchst, verwende `type: 'call_method'` mit `target: 'MultiplayerManager'`, `method: 'createRoom'` — das ist der sichere Weg.

---

### §4.F.5 `server_join_room` — 🔒 Name-Mismatch

**Zweck:** Betritt MP-Raum. Real registriert als `join_room`.

**Runtime-Behavior (`join_room`):** Liest `action.params.code` (≥ 4 Zeichen), ruft `multiplayerManager.joinRoom(code)`.

**Agent-Regel:** Wie bei `server_create_room` → `call_method` auf `MultiplayerManager` verwenden.

---

### §4.F.6 `server_ready` — 🔒 Reserved

**Zweck:** Signalisiert Spieler-Ready-State an Server. Engine-intern, wird vom Lobby-Flow ausgelöst.

**Agent-Regel:** ❌ **Nie erzeugen.** Via `call_method` auf `MultiplayerManager.setReady()`.

---

## §4.G Engine Control

### §4.G.1 `engine_control` — 🔒 Reserved

**Zweck:** Sammelbegriff für runtime-interne Kontrollbefehle (Pause, Resume, Reset der GameRuntime).

**Agent-Regel:** ❌ **Nie erzeugen.** Für Runtime-Kontrolle:
- Pause/Resume → `call_method` auf `GameEngineService.pause()` / `.resume()`
- Reset → `call_method` auf `GameEngineService.reset()`

---

### §4.3 Default-Parameter & Shortcut-API

Der `AgentShortcuts`-Wrapper (`src/services/AgentShortcuts.ts`) bietet typsichere Convenience-Methoden, die intern `addAction` mit den oben beschriebenen Parametern aufrufen:

```typescript
import { AgentShortcuts } from './services/AgentShortcuts';
const s = new AgentShortcuts(agent);

s.setProperty('MyTask', 'Ball', { x: 100 });     // → 'property'
s.incrementProperty('MyTask', 'Score', 'value', 10); // → 'increment'
s.callMethod('MyTask', 'Player', 'takeDamage', [10]); // → 'call_method'
s.navigateStage('MyTask', 'stage_gameover');    // → 'navigate_stage'
s.playAudio('MyTask', 'BGM');                    // → 'play_audio'
s.animate('MyTask', 'Enemy', 'explode', 600);   // → 'animate'
```

**Empfehlung für Agents:** Für **deterministisches Code-Gen** direkt `addAction` mit explizitem `actionType`-String nutzen. Shortcuts sind für **menschliche Entwickler**.

### §4.4 Validator-Matrix für Actions

| Regel | Geprüft von | Fehlermeldung |
|:---|:---|:---|
| `type` ∈ 24 legale Werte | `AgentController.addAction` | `Unknown action type: ...` |
| `name` ist eindeutig im Scope | `ProjectRegistry.validateActionName` | `Action name already exists: ...` |
| `target` (bei `property`, `animate`, etc.) existiert | `validate()` (Warning) | `Action "X" references unknown object "Y"` |
| `variableName` existiert | `validate()` (Warning) | `Action "X" references unknown variable "Y"` |
| `stageId` (bei `navigate_stage`) existiert | `validate()` (Warning) | `Action "X" references unknown stage "Y"` |
| `method` (bei `call_method`) existiert am Target | **Runtime only** | `Logger.warn` |
| Reserved types nicht verwendet | **Nicht automatisch** | Agent-Policy (dieses Dokument) |

---


