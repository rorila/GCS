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
- [§2 Headless Skripte & CLI Runner](#2-headless-skripte--cli-runner)
- [§3 Die 7-Schritte-Methodik](#3-die-7-schritte-methodik)
- [§4 API-Referenz (alle Methoden)](#4-api-referenz)
- [§5 ActionType-Katalog (24 Typen)](#5-actiontype-katalog)
- [§6 Komponenten-Steckbriefe](#6-komponenten-steckbriefe)
- [§7 Workflow-Rezepte (End-to-End)](#7-workflow-rezepte)
- [§8 Anti-Pattern-Katalog](#8-anti-pattern-katalog)
- [§9 Validator-Regeln](#9-validator-regeln)
- [§10 Referenzen & verwandte Dokumente](#10-referenzen)

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

### 1.3 Das Grid-Koordinatensystem (WICHTIG!)

> [!WARNING]
> **ALLE** Geometrie-Angaben (`x`, `y`, `width`, `height`) in GCS basieren auf einem **Grid-System (Zellen)** und NICHT auf Pixeln!

Wenn Sie Objekte erstellen (z.B. per `agent.addObject(...)`), geben Sie Koordinaten in Rasterzellen an.
Die Standard-Zellengröße (`cellSize`) beträgt 20 Pixel.
- `width: 4` bedeutet 4 Zellen = 80 Pixel breit.
- `height: 2` bedeutet 2 Zellen = 40 Pixel hoch.
- `x: 10, y: 5` bedeutet Position auf der 10. Spalte und 5. Zeile.

Ein typisches Spielfeld (Stage) hat z.B. 64 Spalten und 40 Zeilen. Geben Sie niemals Pixel-Werte (wie `x: 100`, `width: 80`) an, da das Objekt sonst massiv überdimensioniert wird oder weit außerhalb des sichtbaren Bereichs landet!

### 1.4 Die fünf Kern-Invarianten

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

## §2 Headless Skripte & CLI Runner

> [!IMPORTANT]
> Wenn KI-Agenten oder LLMs vollständige Projekte über Skripte generieren, läuft dies meist headless über den `agent-run.ts` CLI-Runner ab. 

Ein solches Generator-Skript nutzt **NICHT** `AgentController.getInstance()`. Stattdessen MUSS die Datei eine **Default-Funktion** exportieren, in die der `agent` (ein `ProjectBuilder`) injiziert wird. 

**Kanonisches Setup für LLM-generierte Builder-Skripte:**
```typescript
export default function build(agent: any) {
    // 1. Meta-Daten setzen (ersetzt .createProject())
    agent.setMeta('project_id', 'Projekt Name', 'Beschreibung');

    // 2. Stages erstellen
    agent.createStage('stage_blueprint', 'Blueprint', 'blueprint');
    agent.createStage('stage_main', 'Main Game', 'standard');

    // 3. Logik und Objekte ...
    // ...
    
    // (Validierung und Speicherung übernimmt der Runner automatisch am Ende!)
}
```

---

## §3 Die 7-Schritte-Methodik

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
| `variable` | Variable direkt setzen | `variableName`, `value` |
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

### 4.1 Projekt-Struktur

#### `setMeta(id, name, description)`

Setzt die Metadaten des generierten Projekts. (Wird primär im Headless-Modus genutzt).

**Signatur:**
```typescript
setMeta(id: string, name: string, description: string): void
```

---

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

// Stage-Events (z.B. onRuntimeStart) -> objectName ist IMMER 'stage'!
agent.connectEvent('stage_main', 'stage', 'onRuntimeStart', 'InitLevel');
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
  formula?: string;            // Preferred: "${a} + ${b}" (wird via JSEP geparst)
  calcSteps?: CalcStep[];      // Legacy: strukturierte Schritte
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
| `formula` | `string` | ⚪ (empfohlen) | Ausdruck wie `"${a} * 2 + ${b}"`; wird via `ExpressionParser` (JSEP) geparst |
| `calcSteps` | `CalcStep[]` | ⚪ (legacy) | Sequenz: 1. Schritt = Startwert, folgende = Operation + Operand |

**Beispiel (`formula` — bevorzugt):**
```typescript
agent.addAction('CalcScore', 'calculate', 'ComputeTotal', {
  resultVariable: 'totalScore',
  formula: '(${baseScore} + ${bonus}) * 2'
});
```

**Beispiel (`calcSteps` — legacy):**
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

## §5 Komponenten-Steckbriefe

> [!IMPORTANT]
> **Quellen:** `docs/schemas/schema_*.json` (28 Komponenten mit vollständigem Schema) + `src/components/T*.ts` (alle 76 registrierten Klassen). Alle Komponenten erben von `TWindow` (Base-Class) und folgen den `baseProperties` aus `schema_base.json`.
>
> **Grundregel:** Jede Komponente hat einen **`className`** (z.B. `"TButton"`) und einen **`name`** (Instanz-Bezeichner, z.B. `"StartBtn"`). Der `name` ist der Referenz-Schlüssel für Actions (`target`), Event-Bindings (`connectEvent`) und `${var}`-Interpolation.

### §5.0 Gesamt-Übersicht (alle 76 Komponenten)

| # | className | Kategorie | Stage | Kurz-Zweck |
|:--:|:---|:---|:---|:---|
| 1 | `TAPIServer` | Service | blueprint | HTTP-API-Server (Mock) |
| 2 | `TAudio` | Medien | main | Audio-Player |
| 3 | `TAuthService` | Service | blueprint | Login/JWT-Auth |
| 4 | `TAvatar` | UI | main | Rundes Profilbild |
| 5 | `TBadge` | UI | main | Runde Marker-Plakette |
| 6 | `TBooleanVariable` | Variable | main | Wahrheitswert (true/false) |
| 7 | `TButton` | UI | main | Klickbarer Button |
| 8 | `TCard` | UI | main | Karten-Container (Shadow, Radius) |
| 9 | `TCheckbox` | Eingabe | main | Toggle für Boolean |
| 10 | `TColorPicker` | Eingabe | main | Farb-Auswahl |
| 11 | `TComponent` | Base | — | Abstrakte Basisklasse (nicht instanziieren) |
| 12 | `TDataList` | Daten | main | Daten-Liste-Renderer |
| 13 | `TDataStore` | Service | blueprint | Lokaler Datenspeicher |
| 14 | `TDebugLog` | Service | blueprint | Entwickler-Log-Ausgabe |
| 15 | `TDialogRoot` | Dialog | main | Modaler Dialog-Container |
| 16 | `TDropdown` | Eingabe | main | Select-Dropdown |
| 17 | `TEdit` | Eingabe | main | Einzeiliges Textfeld |
| 18 | `TEmojiPicker` | Eingabe | main | Emoji-Auswahl |
| 19 | `TFlowStage` | Service | blueprint | Flow-Diagramm-Stage |
| 20 | `TGameCard` | UI | main | Spielkarten-Element |
| 21 | `TGameHeader` | UI | main | Spiel-Kopfzeile |
| 22 | `TGameLoop` | Service | blueprint | **Pflicht** für Sprite-Physik |
| 23 | `TGameServer` | Service | blueprint | Multiplayer-Server-Client |
| 24 | `TGameState` | Service | blueprint | Globaler Spielzustand |
| 25 | `TGroupPanel` | Container | main | Unsichtbarer Template-Container |
| 26 | `THandshake` | Service | blueprint | MP-Handshake-Protocol |
| 27 | `THeartbeat` | Service | blueprint | Ping-Ausfallerkennung |
| 28 | `TImage` | Medien | main | Statisches Bild |
| 29 | `TImageList` | Medien | main | Sprite-Sheet / Bilder-Array |
| 30 | `TInfoWindow` | UI | main | Info-Popup |
| 31 | `TInputController` | Service | blueprint | Tastatur-Eingabe-Dispatcher |
| 32 | `TInspectorTemplate` | Service | blueprint | Inspector-Layout-Vorlage |
| 33 | `TIntegerVariable` | Variable | main | Ganzzahl-Variable |
| 34 | `TIntervalTimer` | Timer | main | Intervall-Timer (repeat) |
| 35 | `TKeyStore` | Daten | blueprint | Key-Value-Storage (persistent) |
| 36 | `TLabel` | UI | main | Textanzeige mit `${var}`-Bindings |
| 37 | `TList` | UI | main | Einfache Listen-Anzeige |
| 38 | `TListVariable` | Variable | main | Array-Variable |
| 39 | `TMemo` | Eingabe | main | Mehrzeiliges Textfeld |
| 40 | `TNavBar` | UI | main | Navigations-Leiste |
| 41 | `TNumberInput` | Eingabe | main | Zahlen-Eingabe mit Min/Max |
| 42 | `TNumberLabel` | UI | main | Formatierte Zahlen-Anzeige |
| 43 | `TObjectList` | Daten | main | Strukturierte Objekt-Liste |
| 44 | `TObjectVariable` | Variable | main | JSON-Objekt-Variable |
| 45 | `TPanel` | Container | main | Basis-Panel mit optionalem Gitter |
| 46 | `TProgressBar` | UI | main | Fortschrittsbalken |
| 47 | `TRandomVariable` | Variable | main | Zufallszahl-Generator |
| 48 | `TRangeVariable` | Variable | main | Min/Max-Clamping Variable |
| 49 | `TRealVariable` | Variable | main | Gleitkomma-Variable |
| 50 | `TRichText` | UI | main | Formatierter HTML-Text |
| 51 | `TShape` | UI | main | Geometrische Form |
| 52 | `TSidePanel` | Dialog | main | Side-Panel (slide-in) |
| 53 | `TSplashScreen` | UI | main | Intro-Splash-Screen |
| 54 | `TSplashStage` | Service | blueprint | Splash-Stage-Controller |
| 55 | `TSprite` | Spiel | main | Bewegbares Spielobjekt mit Physik |
| 56 | `TSpriteTemplate` | Spiel | blueprint | Object-Pool-Template für Sprites |
| 57 | `TStage` | Service | blueprint | Stage-Metadaten-Proxy |
| 58 | `TStageController` | Service | blueprint | Stage-Navigation-Dispatcher |
| 59 | `TStatusBar` | UI | main | Status-Leiste (unten) |
| 60 | `TStickyNote` | UI | main | Editor-Klebezettel (kommentar) |
| 61 | `TStringMap` | Variable | main | Key-Value-Dictionary (Strings) |
| 62 | `TStringVariable` | Variable | main | String-Variable |
| 63 | `TSystemInfo` | Service | blueprint | System-Informations-Service |
| 64 | `TTabBar` | UI | main | Tab-Leiste |
| 65 | `TTabControl` | Container | main | Tab-Panel mit Seiten |
| 66 | `TTable` | Daten | main | Tabellen-Renderer |
| 67 | `TTextControl` | UI | main | Erweitertes Text-Widget |
| 68 | `TThresholdVariable` | Variable | main | Schwellwert-Variable mit Events |
| 69 | `TTimer` | Timer | main | Wiederholender Timer |
| 70 | `TToast` | Service | blueprint | Toast-Notification-System |
| 71 | `TTriggerVariable` | Variable | main | Fire-and-Forget-Trigger |
| 72 | `TUserManager` | Service | blueprint | Benutzer-Registry |
| 73 | `TVariable` | Variable | main | Generische Variable (Fallback) |
| 74 | `TVideo` | Medien | main | Video-Player |
| 75 | `TVirtualGamepad` | Service | blueprint | On-Screen-Touch-Gamepad |
| 76 | `TWindow` | Base | — | Abstrakte Basisklasse aller Komponenten |

### §5.1 Taxonomie — 10 Kategorien

```
A. UI-Basis       → TLabel, TButton, TShape, TRichText, TNumberLabel, TCard, TBadge, TAvatar, ...  (~15)
B. Eingabe        → TEdit, TMemo, TNumberInput, TCheckbox, TDropdown, TColorPicker, TEmojiPicker    (7)
C. Container      → TPanel, TGroupPanel, TTabControl                                                 (3)
D. Dialoge        → TDialogRoot, TSidePanel, TInfoWindow                                             (3)
E. Spiel          → TSprite, TSpriteTemplate                                                         (2)
F. Medien         → TAudio, TVideo, TImage, TImageList                                               (4)
G. Timer          → TTimer, TIntervalTimer                                                           (2)
H. Variablen      → T*Variable, TStringMap, TRandomVariable, TThresholdVariable, TRangeVariable, ... (~12)
I. Daten          → TDataList, TDataStore, TObjectList, TKeyStore, TTable                            (5)
J. Services       → TGameLoop, TGameState, TInputController, TStageController, TToast, ...           (~20)
K. Sonstiges/Base → TComponent, TWindow, TStickyNote                                                  (3)
────────────────────────────────────────────────────────────────────────────────
Σ                                                                                                    76
```

### §5.2 Schema der Steckbriefe (für die 28 voll dokumentierten)

Jeder Steckbrief enthält:
1. **Zweck** — 1 Satz
2. **Stage-Empfehlung** — `blueprint` / `main` / beides
3. **Schlüssel-Properties** — Tabelle (Name, Typ, Default, Beschreibung)
4. **Methoden** — callable via `call_method`
5. **Events** — für `connectEvent(stageId, name, event, taskName)`
6. **Beispiel** — `agent.addObject(...)` Aufruf
7. **Caveats / Warnings**

---

## §5.A UI-Basis

### §5.A.1 `TLabel` — Textanzeige mit Variable-Bindings

**Zweck:** Zeigt statischen oder dynamisch gebundenen Text an (z.B. `"Score: ${score}"`).

**Stage:** `main` · **Category:** `ui`

**Properties:**

| Name | Typ | Default | Beschreibung |
|:---|:---|:---|:---|
| `text` | `string` | `""` | Anzeigetext. Bindings: `${VariablenName}` |

**Methoden:** (keine)
**Events:** `onClick`

**Beispiel:**
```typescript
agent.addObject('stage_main', {
  className: 'TLabel',
  name: 'CountdownLabel',
  x: 29, y: 18, width: 6, height: 4,
  text: '${Countdown}',
  style: { color: '#f7c948', fontSize: 72, fontWeight: 'bold', textAlign: 'center' }
});
```

**Caveats:**
- ⚠️ Variable-Bindings **müssen** `${name}` mit Dollar+Klammern sein — `$name` oder `{name}` wird nicht interpoliert.
- Property heißt **`text`**, nicht `caption` (Legacy-Alias existiert für Abwärtskompat).

---

### §5.A.2 `TButton` — Klickbarer Button

**Zweck:** Klickbarer Button mit Text und optionalem Icon. **Haupt-Trigger** für User-Interaktion.

**Stage:** `main` · **Category:** `ui`

**Properties:**

| Name | Typ | Default | Beschreibung |
|:---|:---|:---|:---|
| `text` | `string` | `""` | Button-Beschriftung |
| `enabled` | `boolean` | `true` | Kann geklickt werden |
| `icon` | `string` | `""` | Icon-URL |

**Methoden:** (keine — Interaktion über Events)
**Events:** `onClick`

**Beispiel:**
```typescript
agent.addObject('stage_main', {
  className: 'TButton',
  name: 'StartButton',
  x: 27, y: 2, width: 10, height: 2,
  text: '🚀 Start',
  style: { backgroundColor: '#0078d4', color: '#ffffff', fontWeight: 'bold', borderRadius: 8 }
});
agent.connectEvent('stage_main', 'StartButton', 'onClick', 'StartGame');
```

**Caveats:**
- ⚠️ **Property heißt `text`, nicht `caption`.** Alter Code mit `caption` funktioniert (Legacy-Alias), aber neu immer `text`.
- `enabled: false` → Button ist ausgegraut, `onClick` feuert nicht.

---

### §5.A.3 `TShape` — Geometrische Form

**Zweck:** Generische Form (Kreis, Rechteck, Dreieck, Pfeil, Linie). Kann Text/Emoji und Bild-Inhalt enthalten.

**Stage:** `main` · **Category:** `ui`

**Properties:**

| Name | Typ | Default | Beschreibung |
|:---|:---|:---|:---|
| `shapeType` | `select` | `"circle"` | `circle` \| `rect` \| `square` \| `ellipse` \| `triangle` \| `arrow` \| `line` |
| `fillColor` | `color` | `"transparent"` | Füllfarbe |
| `strokeColor` | `color` | `"#29b6f6"` | Rahmenfarbe |
| `strokeWidth` | `number` | `2` | Rahmenstärke |
| `opacity` | `number` | `1.0` | Deckkraft (0-1) |
| `text` | `string` | `""` | Text/Emoji im Shape |
| `contentImage` | `string` | `""` | Bild-URL im Shape |

**Events:** `onClick`

**Beispiel:**
```typescript
agent.addObject('stage_main', {
  className: 'TShape', name: 'IconRaster',
  x: 1, y: 1, width: 1, height: 1,
  shapeType: 'rectangle',
  style: { backgroundColor: '#8a7fff', borderRadius: 2 }
});
```

---

### §5.A.4 `TProgressBar` — Fortschrittsbalken

**Zweck:** Balkenanzeige proportional zu `value / maxValue`. Für HP, Ladebalken, XP.

**Stage:** `main` · **Category:** `ui`

**Properties:**

| Name | Typ | Default | Beschreibung |
|:---|:---|:---|:---|
| `value` | `number` | `75` | Aktueller Wert |
| `maxValue` | `number` | `100` | Maximalwert |
| `barColor` | `color` | `"#4caf50"` | Balken-Farbe |
| `barBackgroundColor` | `color` | `"#333333"` | Hintergrund leer |
| `showText` | `boolean` | `true` | Text auf Balken |
| `textTemplate` | `string` | `"${value} / ${maxValue}"` | Text-Vorlage |
| `animateChanges` | `boolean` | `true` | Wertänderungen animieren |

**Events:** `onComplete`, `onEmpty`

**Beispiel:**
```typescript
agent.addObject('stage_main', {
  className: 'TProgressBar', name: 'HPBar',
  x: 2, y: 2, width: 10, height: 2,
  value: 100, maxValue: 100, barColor: '#4caf50'
});
agent.connectEvent('stage_main', 'HPBar', 'onEmpty', 'GameOver');
```

**Caveats:**
- ⚠️ `onComplete` feuert wenn `value >= maxValue`; `onEmpty` wenn `value <= 0`.
- Für reaktives Update: `PropertyAction` auf `value` setzen — `animateChanges: true` sorgt für glatte Übergänge.

---

### §5.A.5 `TRichText` — Formatierter HTML-Inhalt

**Zweck:** WYSIWYG-HTML-Inhalt mit Variablen-Binding und XSS-Schutz.

**Stage:** `main` · **Category:** `ui`

**Properties:**

| Name | Typ | Default | Beschreibung |
|:---|:---|:---|:---|
| `htmlContent` | `string` | `"<h1>Rich Text</h1>..."` | HTML-Inhalt (sanitized) |

**Events:** `onClick`

**Beispiel:**
```typescript
agent.addObject('stage_main', {
  className: 'TRichText', name: 'InfoText',
  x: 1, y: 1, width: 8, height: 4,
  htmlContent: '<h2>Willkommen</h2><p>Dies ist <b>formatierter</b> Text.</p>'
});
```

**Caveats:**
- ⚠️ Bearbeitung über 'Text bearbeiten'-Button im Inspector (nicht direkt im Feld).
- HTML wird per DOMPurify-Filter gesäubert — `<script>`, `onerror=`, `javascript:`-URLs geblockt.

---

### §5.A.6 `TNumberLabel` — Formatierte Zahlen-Anzeige

**Zweck:** Zahl mit Prefix, Suffix und fester Dezimalstellen-Anzahl.

**Stage:** `main` · **Category:** `ui`

**Properties:**

| Name | Typ | Default | Beschreibung |
|:---|:---|:---|:---|
| `value` | `number` | `0` | Angezeigter Wert |
| `prefix` | `string` | `""` | Prefix (z.B. `"$"`) |
| `suffix` | `string` | `""` | Suffix (z.B. `"km/h"`) |
| `decimals` | `number` | `0` | Dezimalstellen |

**Beispiel:**
```typescript
agent.addObject('stage_main', {
  className: 'TNumberLabel', name: 'ScoreDisplay',
  x: 2, y: 2, width: 6, height: 2,
  value: 1500, prefix: 'Score: ', suffix: ' pts'
});
```

---

## §5.B Eingabe-Komponenten

### §5.B.1 `TEdit` — Einzeiliges Textfeld

**Properties:** `text`, `placeholder`
**Events:** `onClick`, `onFocus`, `onBlur`

```typescript
agent.addObject('stage_main', {
  className: 'TEdit', name: 'NameInput',
  x: 10, y: 5, width: 10, height: 2,
  text: '', placeholder: 'Name eingeben...'
});
```

---

### §5.B.2 `TMemo` — Mehrzeiliges Textfeld

**Properties:** `text`, `placeholder`, `readOnly`
**Events:** `onClick`, `onFocus`, `onBlur`

```typescript
agent.addObject('stage_main', {
  className: 'TMemo', name: 'LogOutput',
  x: 1, y: 1, width: 20, height: 10,
  text: '', readOnly: true,
  style: { fontFamily: 'monospace', color: '#9cdcfe' }
});
```

---

### §5.B.3 `TNumberInput` — Zahlen-Eingabe mit Min/Max

**Properties:** `value`, `min`, `max`, `step`
**Methoden:** `increment`, `decrement` (via `call_method`)
**Events:** `onClick`, `onFocus`, `onBlur`

```typescript
agent.addObject('stage_main', {
  className: 'TNumberInput', name: 'InputSpalten',
  x: 3, y: 2, width: 3, height: 1.3,
  value: 64, min: 1, max: 128, step: 1
});
```

---

### §5.B.4 `TCheckbox` — Boolean-Toggle

**Properties:** `checked`, `label`
**Methoden:** `toggle`
**Events:** `onClick`, `onChange`

```typescript
agent.addObject('stage_main', {
  className: 'TCheckbox', name: 'ChkLines',
  x: 4, y: 6, width: 1, height: 1,
  checked: true, label: 'Gitter anzeigen'
});
agent.connectEvent('stage_main', 'ChkLines', 'onChange', 'ToggleGrid');
```

---

### §5.B.5 `TDropdown` — Select mit Optionen

**Properties:** `options` (Array), `selectedIndex`, `selectedValue` (readonly)
**Methoden:** `selectValue`, `selectIndex`
**Events:** `onClick`, `onChange`

```typescript
agent.addObject('stage_main', {
  className: 'TDropdown', name: 'CmbMode',
  x: 4, y: 14, width: 10, height: 1.3,
  options: ['cover', 'contain', 'fill', 'repeat'],
  selectedValue: 'cover'
});
```

---

### §5.B.6 `TColorPicker` — Farb-Auswahl

**Properties:** `color`
**Methoden:** `setColor`
**Events:** `onClick`, `onChange`

```typescript
agent.addObject('stage_main', {
  className: 'TColorPicker', name: 'ShpLineColor',
  x: 3, y: 8, width: 1.2, height: 1.3,
  color: '#dddddd'
});
```

---

## §5.C Container

### §5.C.1 `TPanel` — Basis-Container

**Zweck:** Rechteckiger Container mit optionalem Gitter. Als Hintergrund oder Gruppierung.

**Properties:** `caption`, `showGrid`, `gridColor`, `gridStyle` (`lines` | `dots`), `collisionEnabled`, `collisionGroup`
**Events:** `onClick`, `onCollision`

```typescript
agent.addObject('stage_main', {
  className: 'TPanel', name: 'MainPanel',
  x: 1, y: 1, width: 20, height: 15,
  style: { backgroundColor: '#f0f0f0', borderColor: '#999', borderWidth: 1 }
});
```

---

### §5.C.2 `TGroupPanel` — Unsichtbarer Template-Container

**Zweck:** Logischer Container für Children mit **relativen Koordinaten**. Ideal als Template für ObjectPool (`spawn_object`-Action).

**Properties:** `isContainer` (readonly `true`), `isHiddenInRun`, `collisionEnabled`, `collisionGroup`
**Events:** `onCollision`

**Beispiel:**
```typescript
agent.addObject('stage_main', {
  className: 'TGroupPanel', name: 'InspectorContainer',
  x: 1, y: 1, width: 17, height: 16,
  style: { backgroundColor: '#18181A', borderRadius: 6 },
  children: [
    { className: 'TLabel', name: 'HeaderLabel', x: 1, y: 0.5, width: 6, height: 1, text: 'Titel' }
  ]
});
```

**⚠️ Warnings:**
- Children haben **relative Koordinaten** zum GroupPanel, **nicht** zur Stage.
- Children **müssen** im `children`-Array verschachtelt sein, NICHT als flache Objekte mit `parentId`.

---

## §5.D Dialoge

### §5.D.1 `TDialogRoot` — Modaler Dialog

**Zweck:** Modaler/Non-Modaler Dialog-Container mit Slide-In-Animation. Show/Hide/Toggle per Action.

**Properties:** `title`, `modal`, `closable`, `draggableAtRuntime`, `centerOnShow`, `slideDirection` (`left` | `right`)
**Methoden:** `show`, `hide`, `close`, `cancel`, `toggle` (alle via `call_method`)
**Events:** `onShow`, `onClose`, `onCancel`

**Beispiel:**
```typescript
agent.addObject('stage_main', {
  className: 'TDialogRoot', name: 'SettingsDialog',
  x: 10, y: 5, width: 20, height: 15,
  visible: false, modal: true, closable: true, title: 'Einstellungen',
  children: [/* ... */]
});

// Später per Action öffnen:
agent.addAction('OpenSettings', 'call_method', 'ShowDialog', {
  target: 'SettingsDialog', method: 'show'
});
```

**⚠️ Warnings:**
- `visible: false` ist der **Default**! Dialog muss per `toggle_dialog` oder `call_method 'show'` geöffnet werden.
- Im Editor sichtbar zum Editieren, im Run-Modus initial verborgen.
- Children haben **relative Koordinaten** zum Dialog, nicht zur Stage.

---

### §5.D.2 `TSidePanel` — Side-Panel (Slide-In)

**Zweck:** Panel, das von links/rechts einschiebt. Erbt von `TDialogRoot`. Volle Bühnenhöhe, optional resizable.

**Properties:** `title`, `side` (`left`|`right`), `resizable`, `overlayDimming`, `modal` (default `false`!), `closable`
**Methoden:** `show`, `hide`, `close`, `toggle`
**Events:** `onShow`, `onClose`, `onCancel`

**Beispiel:**
```typescript
agent.addObject('stage_main', {
  className: 'TSidePanel', name: 'DebugPanel',
  x: 0, y: 0, width: 15, height: 40,
  visible: false, side: 'right', resizable: true
});
```

**⚠️ Warnings:**
- `modal` ist bei `TSidePanel` default `false` (anders als bei `TDialogRoot`!)
- `centerOnShow` und `draggableAtRuntime` sind automatisch deaktiviert.

---

## §5.E Spiel-Komponenten

### §5.E.1 `TSprite` — Bewegbares Spielobjekt

**Zweck:** Spielobjekt mit **Physik** (`velocityX/Y`) und **Kollisionserkennung**. Der zentrale Baustein für Spiele.

**Stage:** `main` · **Category:** `game`

**Properties:**

| Name | Typ | Default | Beschreibung |
|:---|:---|:---|:---|
| `velocityX` | `number` | `0` | Horizontale Geschwindigkeit |
| `velocityY` | `number` | `0` | Vertikale Geschwindigkeit |
| `lerpSpeed` | `number` | `0.1` | Interpolationsgeschwindigkeit (0-1) |
| `collisionEnabled` | `boolean` | `true` | Kollisionserkennung aktiv |
| `collisionGroup` | `string` | `"default"` | Gruppe (für Filter) |
| `shape` | `select` | `"rect"` | `rect` \| `circle` |
| `spriteColor` | `color` | `"#ff6b6b"` | Grundfarbe |
| `backgroundImage` | `string` | `""` | Sprite-Bild URL |

**Events:** `onCollision`, `onCollisionLeft`, `onCollisionRight`, `onCollisionTop`, `onCollisionBottom`, `onBoundaryHit`

**Beispiel:**
```typescript
agent.addObject('stage_main', {
  className: 'TSprite', name: 'Ball',
  x: 30, y: 20, width: 2, height: 2,
  velocityX: 3, velocityY: 3,
  collisionEnabled: true, collisionGroup: 'ball',
  shape: 'circle', spriteColor: '#ff6b6b'
});
agent.connectEvent('stage_main', 'Ball', 'onCollisionLeft', 'BounceRight');
```

**Caveats:**
- **Erfordert `TGameLoop` in der Blueprint-Stage** — ohne den läuft die Physik nicht.
- `onCollision` feuert mit `$eventData.collidedWith` (Name des Partners).
- `$eventData.hitSide` in Collision-Events: `'left'` | `'right'` | `'top'` | `'bottom'`.
- ⚠️ **Lokale Bounds:** Befindet sich ein `TSprite` als Child innerhalb eines Panels (`TPanel`, `TGroupPanel`), so bezieht sich `onBoundaryHit` auf die Grenzen dieses Panels, nicht auf die globale Stage!
- ⚠️ Kollisionen mit Panels: Wenn ein Sprite frei herumfliegt und an einem Panel abprallen soll, muss das Panel `collisionEnabled: true` haben und das Event `onCollision` am Sprite belegt sein. Ohne belegtes Event fliegt das Sprite ggf. durch das Panel.

---

### §5.E.2 `TSpriteTemplate` — Object-Pool-Template

**Zweck:** Unsichtbare Blueprint-Komponente für **Object Pooling** dynamischer Sprites (z.B. Projektile). Erzeugt beim Start N Pool-Instanzen.

**Stage:** `blueprint` · **Category:** `game`

**Properties:**

| Name | Typ | Default | Beschreibung |
|:---|:---|:---|:---|
| `poolSize` | `number` | `10` | Anzahl vorinitialisierter Instanzen |
| `autoRecycle` | `boolean` | `true` | Älteste Instanz recyceln wenn Pool voll |
| `lifetime` | `number` | `0` | Lebensdauer ms (0 = unendlich) |

**Beispiel:**
```typescript
agent.addObject('stage_blueprint', {
  className: 'TSpriteTemplate', name: 'BulletTemplate',
  x: 0, y: 0, width: 1, height: 1,
  poolSize: 20, autoRecycle: true, lifetime: 3000,
  spriteColor: '#ffff00'
});

// Instanz spawnen via Action:
agent.addAction('FireBullet', 'call_method', 'SpawnBullet', {
  target: 'BulletTemplate', method: 'spawn', params: ['${playerX}', '${playerY}']
});
```

**⚠️ Warnings:**
- `TSpriteTemplate` ist zur Laufzeit **unsichtbar**.
- Nutze die Action `spawn_object` (`type: 'call_method'` auf Template), um eine Instanz zu platzieren.

---

## §5.F Medien

### §5.F.1 `TAudio` — Audio-Player

**Properties:** `src`, `autoplay`, `loop`, `volume` (0-1)
**Methoden:** `play`, `pause`, `stop`
**Events:** `onEnded`

```typescript
agent.addObject('stage_blueprint', {
  className: 'TAudio', name: 'BgMusic',
  x: 2, y: 2, width: 4, height: 2,
  isService: true, isHiddenInRun: true,
  src: './audio/background.mp3', autoplay: false, loop: true, volume: 0.5
});
```

**Caveats:** Für globale Sounds im Blueprint ablegen mit `isService: true, isHiddenInRun: true`.

---

### §5.F.2 `TVideo` — Video-Player

**Properties:** `src`, `autoplay`, `loop`, `muted`, `controls`
**Methoden:** `play`, `pause`
**Events:** `onEnded`, `onPlay`, `onPause`

```typescript
agent.addObject('stage_main', {
  className: 'TVideo', name: 'IntroVideo',
  x: 5, y: 5, width: 20, height: 12,
  src: './videos/intro.mp4', autoplay: false, controls: true
});
```

---

### §5.F.3 `TImage` — Statisches Bild

**Properties:** `src`, `objectFit` (`cover`|`contain`|`fill`|`none`), `imageOpacity`, `alt`, `fallbackColor`
**Events:** `onClick`

```typescript
agent.addObject('stage_main', {
  className: 'TImage', name: 'Logo',
  x: 1, y: 1, width: 8, height: 6,
  src: './images/logo.png', objectFit: 'contain'
});
```

---

### §5.F.4 `TImageList` — Sprite-Sheet / Bilder-Array

**Properties:** `images` (String-Array), `currentIndex`
**Methoden:** `next`, `previous`
**Events:** `onChange`

```typescript
agent.addObject('stage_main', {
  className: 'TImageList', name: 'WalkCycle',
  x: 1, y: 1, width: 4, height: 4,
  images: ['./img/walk1.png', './img/walk2.png', './img/walk3.png']
});

// Frame-Animation via sprite_animate Action:
agent.addAction('AnimateWalk', 'call_method', 'PlayCycle', {
  target: 'WalkCycle', method: 'next'
});
```

---

## §5.G Timer

### §5.G.1 `TTimer` — Wiederholender Timer

**Properties:** `interval` (ms), `enabled`, `maxInterval`, `currentInterval` (readonly)
**Methoden:** `timerStart`, `timerStop`, `reset`
**Events:** `onTimer`, `onMaxIntervalReached`

```typescript
agent.addObject('stage_main', {
  className: 'TTimer', name: 'CountdownTimer',
  x: 10, y: 2, width: 6, height: 3,
  isService: true, isHiddenInRun: true,
  interval: 1000, enabled: false, maxInterval: 10
});
agent.connectEvent('stage_main', 'CountdownTimer', 'onTimer', 'OnTimerTick');
agent.connectEvent('stage_main', 'CountdownTimer', 'onMaxIntervalReached', 'OnCountdownFinish');
```

**⚠️ Warnings:**
- Methode heißt **`timerStart`**, NICHT `start`! Auch nicht `timerStop` vs. `stop`.
- Timer mit `enabled: false` muss über `call_method 'timerStart'` gestartet werden.
- `maxInterval: 0` → Timer läuft endlos.

---

### §5.G.2 `TIntervalTimer` — Intervall-Timer

**Properties:** `duration` (ms), `count` (0=unendlich), `enabled`
**Methoden:** `start`, `stop`, `reset`
**Events:** `onIntervall`, `onTimeout`

```typescript
agent.addObject('stage_main', {
  className: 'TIntervalTimer', name: 'SpawnTimer',
  x: 2, y: 2, width: 4, height: 2,
  isService: true, isHiddenInRun: true,
  duration: 2000, count: 0, enabled: true
});
```

**⚠️ Warnings:**
- Methode heißt **`start`**, NICHT `timerStart` (anders als `TTimer`!).
- `count: 0` = unendliche Wiederholung.
- Auch als `TRepeater` (Legacy) ansprechbar.

---

## §5.H Variablen

> [!IMPORTANT]
> Alle Variable-Komponenten werden mit `isVariable: true, isHiddenInRun: true` erzeugt und über `agent.addVariable(stageId, varData)` hinzugefügt. Sie sind zur Laufzeit unsichtbar und werden über `${VariablenName}` in Properties referenziert.

### §5.H.1 `TIntegerVariable` — Ganzzahl

**Properties:** `type: 'integer'` (readonly), `defaultValue`, `value`
**Events:** `onValueChanged`

```typescript
agent.addVariable('stage_main', {
  className: 'TIntegerVariable', name: 'Countdown',
  isVariable: true, type: 'integer', defaultValue: 10, value: 10
});
```

---

### §5.H.2 `TBooleanVariable` — Wahrheitswert

**Properties:** `type: 'boolean'`, `defaultValue`, `value`
**Events:** `onValueChanged`

```typescript
agent.addVariable('stage_main', {
  className: 'TBooleanVariable', name: 'SpielAktiv',
  type: 'boolean', defaultValue: false
});
```

---

### §5.H.3 `TStringVariable` — Text

**Properties:** `type: 'string'`, `defaultValue`, `value`

```typescript
agent.addVariable('stage_main', {
  className: 'TStringVariable', name: 'Spielername',
  type: 'string', defaultValue: ''
});
```

---

### §5.H.4 `TRealVariable` — Gleitkomma

**Properties:** `type: 'real'`, `defaultValue`, `value`

```typescript
agent.addVariable('stage_main', {
  className: 'TRealVariable', name: 'Geschwindigkeit',
  type: 'real', defaultValue: 3.5
});
```

---

### §5.H.5 `TRandomVariable` — Zufallszahl-Generator

**Properties:** `min`, `max`, `isInteger`, `value` (readonly)
**Methoden:** `generate` (via `call_method`, Wert danach in `.value`)
**Events:** `onGenerated`

```typescript
agent.addVariable('stage_main', {
  className: 'TRandomVariable', name: 'Wuerfel',
  type: 'random', min: 1, max: 6, isInteger: true
});

// Neuen Wert erzeugen:
agent.addAction('RollDice', 'call_method', 'DoRoll', {
  target: 'Wuerfel', method: 'generate'
});
```

**⚠️ Warning:** Methode heißt **`generate`**. Wert danach in `${Wuerfel}` verfügbar.

---

### §5.H.6 `TObjectVariable` — JSON-Struktur

**Properties:** `type: 'object'`, `defaultValue` (Object), `value`

```typescript
agent.addVariable('stage_main', {
  className: 'TObjectVariable', name: 'PlayerData',
  type: 'object', defaultValue: { name: '', level: 1, hp: 100 }
});
```

---

### §5.H.7 `TListVariable` — Array

**Properties:** `type: 'list'`, `defaultValue` (Array), `value`
**Events:** `onValueChanged` (auch `onItemAdded`, `onItemRemoved`)

```typescript
agent.addVariable('stage_main', {
  className: 'TListVariable', name: 'Highscores',
  type: 'list', defaultValue: []
});
```

---

### §5.H.8 `TTriggerVariable` — Fire-and-Forget

**Zweck:** Feuert Event beim Setzen (keine persistierte Wertung).
**Methoden:** `fire`
**Events:** `onTrigger`

```typescript
agent.addVariable('stage_main', {
  className: 'TTriggerVariable', name: 'GameOverTrigger',
  type: 'trigger'
});
agent.connectEvent('stage_main', 'GameOverTrigger', 'onTrigger', 'ShowGameOverScreen');
```

---

### §5.H.9 `TThresholdVariable` — Schwellwert mit Events

**Properties:** `value`, `lowerBound`, `upperBound`
**Events:** `onLowerBound` (value ≤ lowerBound), `onUpperBound` (value ≥ upperBound), `onValueChanged`

```typescript
agent.addVariable('stage_main', {
  className: 'TThresholdVariable', name: 'HP',
  type: 'threshold', value: 100, lowerBound: 0, upperBound: 100
});
agent.connectEvent('stage_main', 'HP', 'onLowerBound', 'PlayerDied');
```

---

### §5.H.10 `TRangeVariable` — Min/Max-Clamping

**Properties:** `value`, `min`, `max` (Wert wird bei Zuweisung geclamped)
**Events:** `onValueChanged`

```typescript
agent.addVariable('stage_main', {
  className: 'TRangeVariable', name: 'Volume',
  type: 'range', value: 50, min: 0, max: 100
});
```

---

### §5.H.11 `TStringMap` — Key-Value-Dictionary

**Properties:** `entries` (Object)
**Events:** `onValueChanged`

```typescript
agent.addVariable('stage_main', {
  className: 'TStringMap', name: 'Translations',
  type: 'keystore', entries: { greeting: 'Hallo', farewell: 'Tschüss' }
});
```

**Hinweis:** Ideal für Theme-Switching (siehe `load_theme_map`-Action in `MiscActions.ts`).

---

## §5.I Infrastruktur-Services (Blueprint)

### §5.I.1 `TGameLoop` — 🔴 Pflicht für Spiele mit Sprites

**Zweck:** Steuert den Game-Loop (Sprite-Physik, Kollisionen, FPS). **Ohne `TGameLoop` keine Physik!**

**Stage:** `blueprint` · **Category:** `infrastructure` · `required: true`

**Properties:**

| Name | Typ | Default | Beschreibung |
|:---|:---|:---|:---|
| `targetFPS` | `number` | `60` | Ziel-Framerate |
| `boundsOffsetTop` | `number` | `0` | Oberer Offset für Spielbereich |
| `boundsOffsetBottom` | `number` | `0` | Unterer Offset |

```typescript
agent.addObject('stage_blueprint', {
  className: 'TGameLoop', name: 'GameLoop',
  x: 2, y: 2, width: 3, height: 1,
  isService: true, isHiddenInRun: true,
  targetFPS: 60
});
```

**⚠️ Warning:** PFLICHT für Spiele mit bewegten Sprites! Ohne `TGameLoop` keine Physik.

---

### §5.I.2 `TGameState` — Globaler Spielzustand

**Zweck:** Zentraler Spielzustand mit `state`, `spritesMoving`, `collisionsEnabled`.

**Stage:** `blueprint` · `required: true`

**Properties:**

| Name | Typ | Default | Optionen |
|:---|:---|:---|:---|
| `state` | `select` | `"idle"` | `menu`, `playing`, `paused`, `gameover` |
| `spritesMoving` | `boolean` | `false` | — |
| `collisionsEnabled` | `boolean` | `false` | — |

```typescript
agent.addObject('stage_blueprint', {
  className: 'TGameState', name: 'GameState',
  x: 6, y: 2, width: 4, height: 1,
  isService: true, isHiddenInRun: true,
  state: 'idle', spritesMoving: false, collisionsEnabled: false
});

// Spiel starten:
agent.addAction('StartGame', 'property', 'EnablePhysics', {
  target: 'GameState',
  changes: { state: 'playing', spritesMoving: true, collisionsEnabled: true }
});
```

---

### §5.I.3 `TInputController` — Tastatur-Dispatcher

**Zweck:** Feuert Events bei Tastendruck/Loslass mit Event-Format `onKeyDown_<KeyCode>` und `onKeyUp_<KeyCode>`.

**Stage:** `blueprint`

**Events (Beispiele):**
- `onKeyDown_KeyW`, `onKeyDown_KeyS`, `onKeyDown_KeyA`, `onKeyDown_KeyD`
- `onKeyDown_ArrowUp/Down/Left/Right`
- `onKeyDown_Space`, `onKeyDown_Enter`
- `onKeyUp_*` analog

```typescript
agent.addObject('stage_blueprint', {
  className: 'TInputController', name: 'InputController',
  x: 11, y: 2, width: 3, height: 1,
  isService: true, isHiddenInRun: true, enabled: true
});
agent.connectEvent('stage_blueprint', 'InputController', 'onKeyDown_ArrowUp', 'MoveUp');
agent.connectEvent('stage_blueprint', 'InputController', 'onKeyDown_Space', 'Fire');
```

**⚠️ Warning:** Event-Format: `onKeyDown_<KeyCode>` — mit vollständigem KeyCode (`KeyW` nicht `W`, `ArrowUp` nicht `Up`).

---

### §5.3 Undokumentierte Komponenten (Kurz-Referenz)

Für die **48 Komponenten ohne vollständiges Schema** in `docs/schemas/` — Kurz-Zweck und typische Verwendung:

| className | Zweck / Typische Verwendung |
|:---|:---|
| `TAPIServer` | Mock-HTTP-Server für lokale API-Antworten (Development) |
| `TAuthService` | Login/Logout/JWT-Token-Handling als Blueprint-Service |
| `TAvatar` | Rundes Profilbild (`src`, `initials`, `size`) |
| `TBadge` | Kreisförmige Marker-Plakette (`text`, `color`) für Benachrichtigungen |
| `TCard` | Container mit Schatten und Rundung; Child-Container für UI-Karten |
| `TComponent` | **Abstrakte Basisklasse — niemals direkt instanziieren** |
| `TDataList` | Datengetriebene Listen-Rendering (`items`, `itemTemplate`) |
| `TDataStore` | Lokaler In-Memory Datenspeicher (Key-Value, mit Subscribe) |
| `TDebugLog` | Debug-Log-Ausgabe für `Logger`-Meldungen (Overlay) |
| `TEmojiPicker` | Emoji-Grid-Picker; Event `onChange` liefert Emoji |
| `TFlowStage` | Spezial-Stage für Flow-Diagramm-Visualisierung |
| `TGameCard` | Spielkarten-Element (Front/Back, flip-Animation) |
| `TGameServer` | Multiplayer-Client für GameServer-Protokoll |
| `THandshake` | Multiplayer-Handshake-Protokoll beim Raum-Betritt |
| `THeartbeat` | Ping-basierte Ausfallerkennung für Netzwerk-Peers |
| `TInfoWindow` | Info-Popup (wie `TDialogRoot`, aber einfacher) |
| `TInspectorTemplate` | Vorlage für dynamische Inspector-Layouts |
| `TKeyStore` | Persistenter Key-Value-Store (LocalStorage-backed) |
| `TList` | Einfache Listen-Anzeige (String-Array) |
| `TNavBar` | Navigations-Leiste mit Menu-Items |
| `TObjectList` | Strukturierte Objekt-Liste mit Detail-Ansicht |
| `TSplashScreen` | Intro-Splash mit Auto-Navigation (`duration`, `nextStage`) |
| `TSplashStage` | Splash-Stage-Controller (globaler Service) |
| `TStage` | Stage-Metadaten-Proxy (lesbarer Stage-Kontext) |
| `TStageController` | **Globaler Service** für `navigate_stage`-Action |
| `TStatusBar` | Status-Leiste unten (Info, Health, Ammo) |
| `TStickyNote` | Editor-Klebezettel (Kommentare, nur im Editor sichtbar) |
| `TSystemInfo` | System-Informationen (OS, Browser, FPS) |
| `TTabBar` | Tab-Leiste (klickbare Tabs ohne Content) |
| `TTabControl` | Tab-Panel mit Content-Seiten (Container) |
| `TTable` | Tabellen-Renderer (Rows, Columns, sortierbar) |
| `TTextControl` | Erweitertes Text-Widget mit Inline-Formatierung |
| `TToast` | **Globaler Service** für Toast-Notifications (`show_toast`-Action) |
| `TUserManager` | Benutzer-Registry (List/Create/Update/Delete) |
| `TVariable` | Generische Variable (Fallback-Typ für alles nicht Typisierte) |
| `TVirtualGamepad` | On-Screen-Touch-Gamepad (Mobile) |
| `TWindow` | **Abstrakte Basisklasse aller Komponenten** — niemals direkt instanziieren |

**Empfehlung:** Wenn eine Komponente hier gelistet ist und du sie brauchst, lade ihr Schema per `agent.getComponentSchema(className)` zur Laufzeit — der `SchemaLoader` liefert dann die vollständige Property-Liste.

### §5.4 Event-Namens-Konventionen (alle Komponenten)

Alle Komponenten erben die **Base-Events** von `TWindow`:

```
onClick, onFocus, onBlur, onDragStart, onDragEnd, onDrop
```

Zusätzliche Events hängen vom Komponenten-Typ ab:

| Kategorie | Typische Events |
|:---|:---|
| UI (Button, Shape, ...) | `onClick` |
| Eingabe (Edit, Checkbox, ...) | `onClick`, `onChange`, `onFocus`, `onBlur` |
| Sprite | `onCollision`, `onCollisionLeft/Right/Top/Bottom`, `onBoundaryHit` |
| Timer | `onTimer`, `onIntervall`, `onTimeout`, `onMaxIntervalReached` |
| Variable | `onValueChanged`, `onTrigger`, `onLowerBound`, `onUpperBound`, `onItemAdded`, `onItemRemoved`, `onGenerated`, `onMinReached`, `onMaxReached`, ... |
| Dialog | `onShow`, `onClose`, `onCancel` |
| Audio/Video | `onEnded`, `onPlay`, `onPause` |
| Input | `onKeyDown_<KeyCode>`, `onKeyUp_<KeyCode>` |

**Agent-Pattern:**

```typescript
// Ein Event-Handler pro (Komponente, Event):
agent.connectEvent(stageId, objectName, eventName, taskName);

// Typische Kombinationen:
agent.connectEvent('stage_main', 'StartBtn', 'onClick', 'InitGame');
agent.connectEvent('stage_main', 'Ball', 'onCollision', 'HandleBallHit');
agent.connectEvent('stage_main', 'Timer1', 'onTimer', 'UpdateScore');
agent.connectEvent('stage_blueprint', 'InputController', 'onKeyDown_ArrowUp', 'MoveUp');
```

---

## §6 Workflow-Rezepte (End-to-End)

> [!IMPORTANT]
> Jedes Rezept ist ein **vollständiges, copy-paste-bares Agent-Script**. Es erzeugt ein lauffähiges Mini-Projekt ab einer leeren Registry (`new ProjectRegistry(); new AgentController(registry)`).
>
> **Format pro Rezept:**
> 1. **Use-Case** — Was baut das Rezept
> 2. **Erwartetes Ergebnis** — Was passiert beim Run
> 3. **Script** — Vollständiger TypeScript-Code
> 4. **Validation** — Erwartete Validator-Ausgabe
> 5. **Variationen** — Erweiterungsmöglichkeiten

### §6.0 Setup-Skeleton (für alle Rezepte)

```typescript
import { ProjectRegistry } from '@/core/ProjectRegistry';
import { AgentController } from '@/agent/AgentController';

const registry = new ProjectRegistry();
const agent    = new AgentController(registry);

// Hier kommt das Rezept-Script...

// Am Ende immer:
const result = agent.validate();
if (!result.valid) console.error('❌ Errors:', result.errors);
if (result.warnings.length) console.warn('⚠️  Warnings:', result.warnings);
```

---

### §6.1 Rezept 1: Hello-World-Button ⭐

**Use-Case:** Ein Button, der bei Klick den Text eines Labels ändert. Einfachster UI-Workflow.

**Erwartetes Ergebnis:**
- Stage mit Label (`"Klick mich"`) und Button (`"Klick!"`)
- Bei Button-Click: Label ändert sich zu `"Hallo Welt!"`

**Script:**
```typescript
const result = agent.executeBatch([
  // 1. Objekte
  { method: 'addObject', args: ['stage_main', {
    className: 'TLabel', name: 'Greeting',
    x: 10, y: 5, width: 20, height: 3,
    text: 'Klick mich', style: { fontSize: 24, textAlign: 'center' }
  }]},
  { method: 'addObject', args: ['stage_main', {
    className: 'TButton', name: 'HelloBtn',
    x: 13, y: 10, width: 14, height: 3,
    text: 'Klick!', style: { backgroundColor: '#0078d4', color: '#fff', fontWeight: 'bold' }
  }]},
  
  // 2. Action
  { method: 'addAction', args: ['SayHello', 'property', 'UpdateText', {
    target: 'Greeting', changes: { text: 'Hallo Welt!' }
  }]},
  
  // 3. Event-Binding
  { method: 'connectEvent', args: ['stage_main', 'HelloBtn', 'onClick', 'SayHello'] }
]);
```

**Validation:** `result.valid === true`, keine Warnings.

**Variationen:**
- **Toggle-Verhalten:** Zweite Action `SayBye` + `variable`-Action zum Umschalten.
- **Countdown statt Text:** Nutze `calculate` statt `property` (siehe Rezept 2).

---

### §6.2 Rezept 2: Countdown-Timer ⭐

**Use-Case:** Countdown von 10 auf 0 per Sekunde mit Timer. Bei Erreichen von 0 wird ein "Fertig!"-Dialog angezeigt.

**Erwartetes Ergebnis:**
- Label zeigt Countdown (via `${Countdown}` Binding)
- `TTimer` feuert jede Sekunde → `Countdown -= 1`
- Bei `Countdown == 0` → Dialog öffnet

**Script:**
```typescript
agent.executeBatch([
  // 1. Countdown-Variable
  { method: 'addVariable', args: ['stage_main', {
    className: 'TIntegerVariable', name: 'Countdown',
    type: 'integer', defaultValue: 10, value: 10
  }]},
  
  // 2. Label mit Binding
  { method: 'addObject', args: ['stage_main', {
    className: 'TLabel', name: 'CountLabel',
    x: 20, y: 10, width: 6, height: 4,
    text: '${Countdown}',
    style: { fontSize: 72, fontWeight: 'bold', textAlign: 'center', color: '#f7c948' }
  }]},
  
  // 3. Timer
  { method: 'addObject', args: ['stage_main', {
    className: 'TTimer', name: 'CountdownTimer',
    x: 0, y: 0, width: 1, height: 1,
    isService: true, isHiddenInRun: true,
    interval: 1000, enabled: true, maxInterval: 10
  }]},
  
  // 4. Actions
  { method: 'addAction', args: ['TickAction', 'calculate', 'DecrementCount', {
    formula: 'Countdown - 1', resultVariable: 'Countdown'
  }]},
  { method: 'addAction', args: ['FinishAction', 'property', 'ShowFinish', {
    target: 'CountLabel', changes: { text: 'Fertig!', style: { color: '#00ff00' } }
  }]},
  
  // 5. Event-Bindings
  { method: 'connectEvent', args: ['stage_main', 'CountdownTimer', 'onTimer', 'TickAction'] },
  { method: 'connectEvent', args: ['stage_main', 'CountdownTimer', 'onMaxIntervalReached', 'FinishAction'] }
]);
```

**Validation:** Alle Referenzen gültig. Wenn Stage `stage_main` nicht existiert, wird sie implizit von `addObject` erstellt.

**Variationen:**
- **Mit Reset-Button:** Action `ResetCount` (`property` auf `Countdown` = 10) + Button `onClick` → `ResetCount`.
- **Audio-Beep pro Tick:** `TAudio`-Komponente + `call_method 'play'` in `TickAction`.

---

### §6.3 Rezept 3: Würfel-Spiel ⭐⭐

**Use-Case:** Zwei Würfel (1-6) werden per Button-Klick gewürfelt. Die Summe wird angezeigt.

**Erwartetes Ergebnis:**
- Button "Würfeln!" startet beide Würfel
- Ergebnis in 3 Labels: `Würfel 1: 4`, `Würfel 2: 5`, `Summe: 9`

**Script:**
```typescript
agent.executeBatch([
  // Variablen
  { method: 'addVariable', args: ['stage_main', {
    className: 'TRandomVariable', name: 'Dice1',
    type: 'random', min: 1, max: 6, isInteger: true
  }]},
  { method: 'addVariable', args: ['stage_main', {
    className: 'TRandomVariable', name: 'Dice2',
    type: 'random', min: 1, max: 6, isInteger: true
  }]},
  { method: 'addVariable', args: ['stage_main', {
    className: 'TIntegerVariable', name: 'Sum',
    type: 'integer', defaultValue: 0, value: 0
  }]},
  
  // Labels
  { method: 'addObject', args: ['stage_main', {
    className: 'TLabel', name: 'Lbl1', x: 5, y: 5, width: 10, height: 3,
    text: 'Würfel 1: ${Dice1}', style: { fontSize: 24 }
  }]},
  { method: 'addObject', args: ['stage_main', {
    className: 'TLabel', name: 'Lbl2', x: 20, y: 5, width: 10, height: 3,
    text: 'Würfel 2: ${Dice2}', style: { fontSize: 24 }
  }]},
  { method: 'addObject', args: ['stage_main', {
    className: 'TLabel', name: 'LblSum', x: 10, y: 10, width: 20, height: 3,
    text: 'Summe: ${Sum}', style: { fontSize: 36, fontWeight: 'bold', color: '#00c8ff' }
  }]},
  
  // Button
  { method: 'addObject', args: ['stage_main', {
    className: 'TButton', name: 'RollBtn',
    x: 13, y: 15, width: 14, height: 3,
    text: '🎲 Würfeln!', style: { backgroundColor: '#c33', color: '#fff', fontSize: 20 }
  }]},
  
  // Actions (Multi-Step-Task)
  { method: 'addAction', args: ['Roll1', 'call_method', 'RollGame', {
    target: 'Dice1', method: 'generate'
  }]},
  { method: 'addAction', args: ['Roll2', 'call_method', 'RollGame', {
    target: 'Dice2', method: 'generate'
  }]},
  { method: 'addAction', args: ['CalcSum', 'calculate', 'RollGame', {
    formula: 'Dice1 + Dice2', resultVariable: 'Sum'
  }]},
  
  // Event-Binding
  { method: 'connectEvent', args: ['stage_main', 'RollBtn', 'onClick', 'RollGame'] }
]);
```

**Wichtig:** Alle drei Actions haben denselben `taskName: 'RollGame'` → sie werden nacheinander ausgeführt (Task-Sequenz).

**Variationen:**
- **Animation:** Zwischen den Roll-Actions eine `animate`-Action auf Dice-Label einfügen.
- **Highscore:** Bei `Sum > Highscore` → `property`-Action auf Highscore-Variable.

---

### §6.4 Rezept 4: Pong-Ball-Physik ⭐⭐

**Use-Case:** Einfacher bouncing Ball, der an Wänden abprallt. Grundlage für Pong/Breakout.

**Erwartetes Ergebnis:**
- Ball bewegt sich diagonal mit `velocityX: 3, velocityY: 3`
- Bei Wand-Kollision wird die entsprechende Velocity-Komponente negiert

**Script:**
```typescript
agent.executeBatch([
  // Blueprint: GameLoop + GameState (PFLICHT für Sprite-Physik)
  { method: 'addObject', args: ['stage_blueprint', {
    className: 'TGameLoop', name: 'GameLoop',
    x: 2, y: 2, width: 3, height: 1,
    isService: true, isHiddenInRun: true,
    targetFPS: 60
  }]},
  { method: 'addObject', args: ['stage_blueprint', {
    className: 'TGameState', name: 'GameState',
    x: 6, y: 2, width: 4, height: 1,
    isService: true, isHiddenInRun: true,
    state: 'playing', spritesMoving: true, collisionsEnabled: true
  }]},
  
  // Main: Ball
  { method: 'addObject', args: ['stage_main', {
    className: 'TSprite', name: 'Ball',
    x: 20, y: 15, width: 2, height: 2,
    velocityX: 3, velocityY: 3,
    collisionEnabled: true, collisionGroup: 'ball',
    shape: 'circle', spriteColor: '#ff6b6b'
  }]},
  
  // Task + Actions für Wand-Bounce erstellen
  { method: 'createTask', args: ['stage_main', 'HandleWallHit', 'Abprallen an Wänden'] },
  { method: 'addTaskParam', args: ['HandleWallHit', 'hitSide', 'string', ''] },
  
  // Left/Right: flippt X
  { method: 'addBranch', args: ['HandleWallHit', 'hitSide', '==', 'left',
    (then: any) => { then.addNewAction('negate', 'BounceX', { target: 'Ball', changes: { velocityX: 1 } }); }
  ]},
  { method: 'addBranch', args: ['HandleWallHit', 'hitSide', '==', 'right',
    (then: any) => { then.addNewAction('negate', 'BounceX', { target: 'Ball', changes: { velocityX: 1 } }); }
  ]},
  
  // Top/Bottom: flippt Y
  { method: 'addBranch', args: ['HandleWallHit', 'hitSide', '==', 'top',
    (then: any) => { then.addNewAction('negate', 'BounceY', { target: 'Ball', changes: { velocityY: 1 } }); }
  ]},
  { method: 'addBranch', args: ['HandleWallHit', 'hitSide', '==', 'bottom',
    (then: any) => { then.addNewAction('negate', 'BounceY', { target: 'Ball', changes: { velocityY: 1 } }); }
  ]},
  
  // Event-Binding: Wände (Boundaries) triggern onBoundaryHit
  { method: 'connectEvent', args: ['stage_main', 'Ball', 'onBoundaryHit', 'HandleWallHit'] }
]);
```

**Wichtig:** `negate` kehrt das Vorzeichen um → aus `velocityX: 3` wird `velocityX: -3`.

**Variationen:**
- **Geschwindigkeits-Boost:** Bei Kollision `calculate` Action mit `velocityX * 1.1`.
- **Paddle hinzufügen:** Weiteres `TSprite` namens `Paddle` mit `collisionGroup: 'paddle'` + separaten Bounce-Handlern.

---

### §6.5 Rezept 5: HP-System mit GameOver ⭐⭐

**Use-Case:** `TThresholdVariable` für HP, bei `lowerBound` (0 HP) wird automatisch das GameOver-Event gefeuert.

**Erwartetes Ergebnis:**
- HP-Balken (`TProgressBar`) zeigt aktuelle HP
- Button "Damage!" zieht 20 HP ab
- Bei HP = 0 → GameOver-Dialog erscheint

**Script:**
```typescript
agent.executeBatch([
  // Threshold-HP
  { method: 'addVariable', args: ['stage_main', {
    className: 'TThresholdVariable', name: 'HP',
    type: 'threshold', value: 100, lowerBound: 0, upperBound: 100
  }]},
  
  // HP-Balken
  { method: 'addObject', args: ['stage_main', {
    className: 'TProgressBar', name: 'HPBar',
    x: 5, y: 3, width: 20, height: 3,
    value: 100, maxValue: 100, barColor: '#4caf50', textTemplate: 'HP: ${value}/${maxValue}'
  }]},
  
  // Damage-Button
  { method: 'addObject', args: ['stage_main', {
    className: 'TButton', name: 'HitBtn',
    x: 10, y: 10, width: 10, height: 3,
    text: '💥 Damage!', style: { backgroundColor: '#c33', color: '#fff' }
  }]},
  
  // GameOver-Dialog
  { method: 'addObject', args: ['stage_main', {
    className: 'TDialogRoot', name: 'GameOverDialog',
    x: 10, y: 10, width: 20, height: 10,
    visible: false, modal: true, closable: false, title: '💀 Game Over',
    children: [
      { className: 'TLabel', name: 'GOLbl', x: 2, y: 3, width: 16, height: 3,
        text: 'Du bist tot!', style: { fontSize: 24, textAlign: 'center', color: '#f00' } }
    ]
  }]},
  
  // Actions
  { method: 'addAction', args: ['TakeDamage', 'calculate', 'DamagePlayer', {
    formula: 'HP - 20', resultVariable: 'HP'
  }]},
  { method: 'addAction', args: ['UpdateBar', 'property', 'DamagePlayer', {
    target: 'HPBar', changes: { value: '${HP}' }
  }]},
  { method: 'addAction', args: ['ShowGameOver', 'call_method', 'HandleDeath', {
    target: 'GameOverDialog', method: 'show'
  }]},
  
  // Event-Bindings
  { method: 'connectEvent', args: ['stage_main', 'HitBtn', 'onClick', 'DamagePlayer'] },
  // Automatisch: HP feuert onLowerBound wenn value <= 0
  { method: 'connectEvent', args: ['stage_main', 'HP', 'onLowerBound', 'HandleDeath'] }
]);
```

**Wichtig:** Kein manueller If-Check nötig — `TThresholdVariable` feuert `onLowerBound` automatisch, wenn `value <= lowerBound` wird.

**Variationen:**
- **Heal-Button:** Zweite Action mit `HP + 20`.
- **Audio-Feedback:** `TAudio` mit `hurt.mp3` + `call_method 'play'` bei Damage.

---

### §6.6 Rezept 6: Login-Screen mit Stage-Navigation ⭐⭐

**Use-Case:** Login-Formular in `stage_login` → bei erfolgreicher Anmeldung zu `stage_main` navigieren.

**Erwartetes Ergebnis:**
- `stage_login` mit `TEdit`-Feldern für User/Passwort
- "Login"-Button → speichert Username in Variable, wechselt zu `stage_main`
- `stage_main` zeigt "Willkommen, ${Username}"

**Script:**
```typescript
agent.executeBatch([
  // 1. Login-Stage
  { method: 'addStage', args: [{ id: 'stage_login', name: 'Login' }] },
  { method: 'addVariable', args: ['stage_login', {
    className: 'TStringVariable', name: 'Username',
    type: 'string', defaultValue: ''
  }]},
  { method: 'addObject', args: ['stage_login', {
    className: 'TLabel', name: 'Title',
    x: 15, y: 3, width: 20, height: 3,
    text: '🔐 Login', style: { fontSize: 36, textAlign: 'center' }
  }]},
  { method: 'addObject', args: ['stage_login', {
    className: 'TEdit', name: 'UserField',
    x: 15, y: 10, width: 20, height: 2,
    text: '', placeholder: 'Benutzername...'
  }]},
  { method: 'addObject', args: ['stage_login', {
    className: 'TEdit', name: 'PassField',
    x: 15, y: 13, width: 20, height: 2,
    text: '', placeholder: 'Passwort...'
  }]},
  { method: 'addObject', args: ['stage_login', {
    className: 'TButton', name: 'LoginBtn',
    x: 20, y: 17, width: 10, height: 3,
    text: 'Einloggen', style: { backgroundColor: '#0078d4', color: '#fff' }
  }]},
  
  // 2. Main-Stage
  { method: 'addObject', args: ['stage_main', {
    className: 'TLabel', name: 'WelcomeLabel',
    x: 10, y: 10, width: 30, height: 5,
    text: 'Willkommen, ${Username}!',
    style: { fontSize: 36, textAlign: 'center', color: '#00c8ff' }
  }]},
  
  // 3. Actions
  { method: 'addAction', args: ['SaveUser', 'variable', 'DoLogin', {
    source: 'UserField', sourceProperty: 'text', variableName: 'Username'
  }]},
  { method: 'addAction', args: ['NavigateMain', 'navigate_stage', 'DoLogin', {
    stageId: 'stage_main'
  }]},
  
  // 4. Binding
  { method: 'connectEvent', args: ['stage_login', 'LoginBtn', 'onClick', 'DoLogin'] }
]);
```

**Wichtig:** `variable`-Action kopiert `UserField.text` in die `Username`-Variable, bevor navigiert wird.

**Variationen:**
- **Validierung:** Vor `NavigateMain` eine `branch`-Action (Passwort-Check).
- **Logout-Button in stage_main:** `navigate_stage` zurück zu `stage_login`.

---

### §6.7 Rezept 7: Score-Counter mit calcSteps ⭐⭐

**Use-Case:** Komplexe Formel mit mehreren Zwischenschritten. Bonus-Score berechnen aus Time, Level, Kills.

**Erwartetes Ergebnis:**
- Button "Berechne" triggert mehrstufige Berechnung
- `Score = (Level * 100) + (Kills * 10) - TimeElapsed`

**Script:**
```typescript
agent.executeBatch([
  // Eingabe-Variablen
  { method: 'addVariable', args: ['stage_main', {
    className: 'TIntegerVariable', name: 'Level', type: 'integer', defaultValue: 3
  }]},
  { method: 'addVariable', args: ['stage_main', {
    className: 'TIntegerVariable', name: 'Kills', type: 'integer', defaultValue: 12
  }]},
  { method: 'addVariable', args: ['stage_main', {
    className: 'TIntegerVariable', name: 'TimeElapsed', type: 'integer', defaultValue: 45
  }]},
  { method: 'addVariable', args: ['stage_main', {
    className: 'TIntegerVariable', name: 'Score', type: 'integer', defaultValue: 0
  }]},
  
  // Score-Anzeige
  { method: 'addObject', args: ['stage_main', {
    className: 'TLabel', name: 'ScoreLbl',
    x: 10, y: 10, width: 20, height: 3,
    text: 'Score: ${Score}', style: { fontSize: 36, textAlign: 'center' }
  }]},
  { method: 'addObject', args: ['stage_main', {
    className: 'TButton', name: 'CalcBtn',
    x: 15, y: 15, width: 10, height: 2,
    text: 'Berechne', style: { backgroundColor: '#00c8ff', color: '#000' }
  }]},
  
  // Action mit calcSteps (mehrstufige Formel)
  { method: 'addAction', args: ['CalculateScore', 'calculate', 'DoCalc', {
    calcSteps: [
      { formula: 'Level * 100',       resultVariable: 'LevelBonus' },
      { formula: 'Kills * 10',        resultVariable: 'KillBonus'  },
      { formula: 'LevelBonus + KillBonus - TimeElapsed', resultVariable: 'Score' }
    ]
  }]},
  
  // Temp-Variablen für Zwischenergebnisse
  { method: 'addVariable', args: ['stage_main', {
    className: 'TIntegerVariable', name: 'LevelBonus', type: 'integer', defaultValue: 0
  }]},
  { method: 'addVariable', args: ['stage_main', {
    className: 'TIntegerVariable', name: 'KillBonus', type: 'integer', defaultValue: 0
  }]},
  
  { method: 'connectEvent', args: ['stage_main', 'CalcBtn', 'onClick', 'DoCalc'] }
]);
```

**Ergebnis:** `Score = (3 * 100) + (12 * 10) - 45 = 300 + 120 - 45 = 375`.

**Variationen:**
- **Single-Step-Alternative:** Eine `formula`-Action mit `(Level * 100) + (Kills * 10) - TimeElapsed`.
- **Ohne Temp-Vars:** Nur mit `formula` (aber dann keine Zwischenschritte sichtbar).

---

### §6.8 Rezept 8: Multi-Stage-Projekt (Menu → Game → GameOver) ⭐⭐⭐

**Use-Case:** Komplettes Mini-Spiel mit 3 Stages und Navigation.

**Erwartetes Ergebnis:**
- **Menu-Stage:** Titel + Start-Button
- **Game-Stage:** Ball-Physik (wie Rezept 4) + HP-Bar + GameOver bei HP=0
- **GameOver-Stage:** "Du bist tot!" + Restart-Button

**Script:**
```typescript
agent.executeBatch([
  // === STAGES ===
  { method: 'addStage', args: [{ id: 'stage_menu',     name: 'Hauptmenü' }] },
  { method: 'addStage', args: [{ id: 'stage_game',     name: 'Spiel' }] },
  { method: 'addStage', args: [{ id: 'stage_gameover', name: 'Game Over' }] },
  
  // === BLUEPRINT (global) ===
  { method: 'addObject', args: ['stage_blueprint', {
    className: 'TGameLoop', name: 'GameLoop',
    x: 2, y: 2, width: 3, height: 1,
    isService: true, isHiddenInRun: true, targetFPS: 60
  }]},
  { method: 'addObject', args: ['stage_blueprint', {
    className: 'TGameState', name: 'GameState',
    x: 6, y: 2, width: 4, height: 1,
    isService: true, isHiddenInRun: true,
    state: 'menu', spritesMoving: false, collisionsEnabled: false
  }]},
  
  // === MENU-STAGE ===
  { method: 'addObject', args: ['stage_menu', {
    className: 'TLabel', name: 'MenuTitle',
    x: 10, y: 5, width: 30, height: 5,
    text: '🎮 MEIN SPIEL', style: { fontSize: 64, textAlign: 'center', color: '#00c8ff' }
  }]},
  { method: 'addObject', args: ['stage_menu', {
    className: 'TButton', name: 'StartBtn',
    x: 20, y: 15, width: 10, height: 3,
    text: '▶ Start', style: { backgroundColor: '#00c8ff', color: '#000', fontSize: 20 }
  }]},
  
  // === GAME-STAGE ===
  { method: 'addVariable', args: ['stage_game', {
    className: 'TThresholdVariable', name: 'HP',
    type: 'threshold', value: 100, lowerBound: 0, upperBound: 100
  }]},
  { method: 'addObject', args: ['stage_game', {
    className: 'TProgressBar', name: 'HPBar',
    x: 2, y: 2, width: 15, height: 2,
    value: 100, maxValue: 100, barColor: '#4caf50'
  }]},
  { method: 'addObject', args: ['stage_game', {
    className: 'TSprite', name: 'Ball',
    x: 20, y: 20, width: 2, height: 2,
    velocityX: 3, velocityY: 3,
    collisionEnabled: true, shape: 'circle', spriteColor: '#ff6b6b'
  }]},
  { method: 'addObject', args: ['stage_game', {
    className: 'TButton', name: 'DamageBtn',
    x: 20, y: 2, width: 10, height: 2,
    text: 'Hit!', style: { backgroundColor: '#c33', color: '#fff' }
  }]},
  
  // === GAMEOVER-STAGE ===
  { method: 'addObject', args: ['stage_gameover', {
    className: 'TLabel', name: 'GOLbl',
    x: 10, y: 8, width: 30, height: 5,
    text: '💀 GAME OVER', style: { fontSize: 64, textAlign: 'center', color: '#f00' }
  }]},
  { method: 'addObject', args: ['stage_gameover', {
    className: 'TButton', name: 'RestartBtn',
    x: 20, y: 16, width: 10, height: 3,
    text: '🔄 Nochmal', style: { backgroundColor: '#0c0', color: '#000' }
  }]},
  
  // === ACTIONS ===
  // Menu → Game
  { method: 'addAction', args: ['StartGame', 'property', 'BeginGame', {
    target: 'GameState', changes: { state: 'playing', spritesMoving: true, collisionsEnabled: true }
  }]},
  { method: 'addAction', args: ['GoToGame', 'navigate_stage', 'BeginGame', {
    stageId: 'stage_game'
  }]},
  
  // Game: Damage
  { method: 'addAction', args: ['TakeHit', 'calculate', 'DamagePlayer', {
    formula: 'HP - 25', resultVariable: 'HP'
  }]},
  { method: 'addAction', args: ['UpdateHPBar', 'property', 'DamagePlayer', {
    target: 'HPBar', changes: { value: '${HP}' }
  }]},
  
  // Game: Ball-Bounce
  { method: 'addAction', args: ['BounceX', 'negate', 'BallHitX', {
    target: 'Ball', changes: { velocityX: 1 }
  }]},
  { method: 'addAction', args: ['BounceY', 'negate', 'BallHitY', {
    target: 'Ball', changes: { velocityY: 1 }
  }]},
  
  // Game → GameOver
  { method: 'addAction', args: ['GoToGameOver', 'navigate_stage', 'HandleDeath', {
    stageId: 'stage_gameover'
  }]},
  
  // GameOver → Menu (Reset HP)
  { method: 'addAction', args: ['ResetHP', 'property', 'Restart', {
    target: 'HP', changes: { value: 100 }
  }]},
  { method: 'addAction', args: ['GoToMenu', 'navigate_stage', 'Restart', {
    stageId: 'stage_menu'
  }]},
  
  // === EVENT-BINDINGS ===
  { method: 'connectEvent', args: ['stage_menu', 'StartBtn', 'onClick', 'BeginGame'] },
  { method: 'connectEvent', args: ['stage_game', 'DamageBtn', 'onClick', 'DamagePlayer'] },
  { method: 'connectEvent', args: ['stage_game', 'Ball', 'onCollisionLeft',   'BallHitX'] },
  { method: 'connectEvent', args: ['stage_game', 'Ball', 'onCollisionRight',  'BallHitX'] },
  { method: 'connectEvent', args: ['stage_game', 'Ball', 'onCollisionTop',    'BallHitY'] },
  { method: 'connectEvent', args: ['stage_game', 'Ball', 'onCollisionBottom', 'BallHitY'] },
  { method: 'connectEvent', args: ['stage_game', 'HP', 'onLowerBound', 'HandleDeath'] },
  { method: 'connectEvent', args: ['stage_gameover', 'RestartBtn', 'onClick', 'Restart'] }
]);
```

**Architektur-Pattern:**
1. **Blueprint** = globale Services (GameLoop, GameState) → in allen Stages aktiv
2. **Menu-Stage** = keine Physik, nur UI
3. **Game-Stage** = aktive Physik (`state: 'playing'`)
4. **GameOver-Stage** = Cleanup & Reset

**Variationen:**
- **Pause-Stage:** Zusätzliche Stage mit `state: 'paused'`, `spritesMoving: false`.
- **Level-Progression:** Nach Stage-Completion zu `stage_level2` statt `stage_gameover`.

---

### §6.9 Rezept 9: HTTP-Leaderboard laden ⭐⭐⭐

**Use-Case:** Beim Stage-Load wird per `http`-Action eine Highscore-Liste vom Server geladen und in einer `TListVariable` gespeichert.

**Erwartetes Ergebnis:**
- Button "Lade Scores" → HTTP-GET auf `/api/leaderboard`
- Antwort (JSON-Array) wird in `Scores` gespeichert
- Label zeigt `Top: ${Scores}`

**Script:**
```typescript
agent.executeBatch([
  // Variablen
  { method: 'addVariable', args: ['stage_main', {
    className: 'TListVariable', name: 'Scores',
    type: 'list', defaultValue: []
  }]},
  { method: 'addVariable', args: ['stage_main', {
    className: 'TStringVariable', name: 'LoadStatus',
    type: 'string', defaultValue: 'Bereit'
  }]},
  
  // UI
  { method: 'addObject', args: ['stage_main', {
    className: 'TLabel', name: 'StatusLbl',
    x: 5, y: 2, width: 30, height: 2,
    text: 'Status: ${LoadStatus}', style: { fontSize: 16 }
  }]},
  { method: 'addObject', args: ['stage_main', {
    className: 'TLabel', name: 'ScoresLbl',
    x: 5, y: 5, width: 30, height: 15,
    text: '🏆 Top: ${Scores}', style: { fontSize: 18 }
  }]},
  { method: 'addObject', args: ['stage_main', {
    className: 'TButton', name: 'LoadBtn',
    x: 15, y: 22, width: 10, height: 3,
    text: 'Lade Scores', style: { backgroundColor: '#0078d4', color: '#fff' }
  }]},
  
  // Actions
  { method: 'addAction', args: ['ShowLoading', 'property', 'FetchScores', {
    target: 'LoadStatus', changes: { value: '⏳ Lade...' }
  }]},
  { method: 'addAction', args: ['HTTPRequest', 'http', 'FetchScores', {
    url: 'https://api.example.com/leaderboard',
    method: 'GET',
    resultVariable: 'Scores'
  }]},
  { method: 'addAction', args: ['ShowDone', 'property', 'FetchScores', {
    target: 'LoadStatus', changes: { value: '✅ Geladen!' }
  }]},
  
  // Binding
  { method: 'connectEvent', args: ['stage_main', 'LoadBtn', 'onClick', 'FetchScores'] }
]);
```

**Wichtig:** `http` ist **async** — die Task läuft sequenziell, aber die HTTP-Response wartet. `resultVariable` speichert das Body.

**Variationen:**
- **POST mit Body:** `method: 'POST', body: { name: '${PlayerName}', score: ${Score} }`.
- **Error-Handling:** Nach der HTTP-Action eine `branch`-Action (siehe Rezept 14), die `LoadStatus === "error"` prüft.

---

### §6.10 Rezept 10: Dialog öffnen & schließen ⭐⭐

**Use-Case:** Settings-Dialog mit Open/Close-Buttons.

**Erwartetes Ergebnis:**
- Button "⚙ Einstellungen" → Dialog `show`
- Im Dialog: Close-Button → Dialog `hide`
- Bei `onClose` → Toast-Benachrichtigung "Dialog geschlossen"

**Script:**
```typescript
agent.executeBatch([
  // Hauptbutton
  { method: 'addObject', args: ['stage_main', {
    className: 'TButton', name: 'OpenSettingsBtn',
    x: 15, y: 5, width: 14, height: 3,
    text: '⚙ Einstellungen', style: { backgroundColor: '#555', color: '#fff' }
  }]},
  
  // Dialog (initial unsichtbar)
  { method: 'addObject', args: ['stage_main', {
    className: 'TDialogRoot', name: 'SettingsDialog',
    x: 10, y: 5, width: 20, height: 15,
    visible: false, modal: true, closable: true, title: '⚙ Einstellungen',
    style: { backgroundColor: 'rgba(26, 26, 46, 0.98)' },
    children: [
      { className: 'TLabel', name: 'DlgTitle', x: 2, y: 2, width: 16, height: 2,
        text: 'Optionen', style: { fontSize: 24 } },
      { className: 'TCheckbox', name: 'MusicChk', x: 2, y: 5, width: 10, height: 2,
        checked: true, label: '🎵 Musik' },
      { className: 'TCheckbox', name: 'SfxChk', x: 2, y: 7, width: 10, height: 2,
        checked: true, label: '🔊 Soundeffekte' },
      { className: 'TButton', name: 'CloseBtn', x: 6, y: 11, width: 8, height: 2,
        text: 'Schließen', style: { backgroundColor: '#c33', color: '#fff' } }
    ]
  }]},
  
  // Actions
  { method: 'addAction', args: ['ShowDialog', 'call_method', 'OpenDialog', {
    target: 'SettingsDialog', method: 'show'
  }]},
  { method: 'addAction', args: ['HideDialog', 'call_method', 'CloseDialog', {
    target: 'SettingsDialog', method: 'hide'
  }]},
  { method: 'addAction', args: ['ToastClose', 'show_toast', 'OnCloseHandler', {
    text: '✅ Dialog geschlossen', duration: 2000, position: 'bottom'
  }]},
  
  // Bindings
  { method: 'connectEvent', args: ['stage_main', 'OpenSettingsBtn', 'onClick', 'OpenDialog'] },
  { method: 'connectEvent', args: ['stage_main', 'CloseBtn', 'onClick', 'CloseDialog'] },
  { method: 'connectEvent', args: ['stage_main', 'SettingsDialog', 'onClose', 'OnCloseHandler'] }
]);
```

**Wichtig:**
- Child-Komponenten im Dialog haben **relative Koordinaten** zum Dialog.
- `onClose` wird automatisch gefeuert, wenn der Close-X (oben rechts) oder `hide` per Action getriggert wird.

**Variationen:**
- **TSidePanel** statt `TDialogRoot` für Slide-In von rechts.
- **toggle_dialog-Action:** Kombiniert `show` und `hide` in einer Action.

---

### §6.11 Rezept 11: Tastatur-gesteuerter Player ⭐⭐

**Use-Case:** Arrow-Tasten bewegen Player-Sprite um je 1 Grid-Einheit.

**Erwartetes Ergebnis:**
- Blueprint: `TInputController` feuert Key-Events
- `TSprite` Player reagiert auf `onKeyDown_ArrowLeft/Right/Up/Down`

**Script:**
```typescript
agent.executeBatch([
  // Blueprint: InputController
  { method: 'addObject', args: ['stage_blueprint', {
    className: 'TInputController', name: 'Input',
    x: 2, y: 2, width: 3, height: 1,
    isService: true, isHiddenInRun: true, enabled: true
  }]},
  
  // Main: Player-Sprite
  { method: 'addObject', args: ['stage_main', {
    className: 'TSprite', name: 'Player',
    x: 20, y: 15, width: 2, height: 2,
    velocityX: 0, velocityY: 0,
    shape: 'circle', spriteColor: '#00c8ff'
  }]},
  
  // Move-Actions (increment/decrement x/y um 1)
  { method: 'addAction', args: ['MoveLeft', 'increment', 'DoMoveLeft', {
    target: 'Player', property: 'x', amount: -1
  }]},
  { method: 'addAction', args: ['MoveRight', 'increment', 'DoMoveRight', {
    target: 'Player', property: 'x', amount: 1
  }]},
  { method: 'addAction', args: ['MoveUp', 'increment', 'DoMoveUp', {
    target: 'Player', property: 'y', amount: -1
  }]},
  { method: 'addAction', args: ['MoveDown', 'increment', 'DoMoveDown', {
    target: 'Player', property: 'y', amount: 1
  }]},
  
  // Keyboard-Bindings
  { method: 'connectEvent', args: ['stage_blueprint', 'Input', 'onKeyDown_ArrowLeft',  'DoMoveLeft'] },
  { method: 'connectEvent', args: ['stage_blueprint', 'Input', 'onKeyDown_ArrowRight', 'DoMoveRight'] },
  { method: 'connectEvent', args: ['stage_blueprint', 'Input', 'onKeyDown_ArrowUp',    'DoMoveUp'] },
  { method: 'connectEvent', args: ['stage_blueprint', 'Input', 'onKeyDown_ArrowDown',  'DoMoveDown'] }
]);
```

**Wichtig:**
- Event-Namen folgen dem Muster `onKeyDown_<KeyCode>` (volle KeyCodes, z.B. `KeyW`, `ArrowUp`, `Space`).
- Im Blueprint platzieren, damit der Controller stage-übergreifend läuft.

**Variationen:**
- **WASD-Steuerung:** `onKeyDown_KeyW/A/S/D` statt Arrow-Tasten.
- **Kontinuierliche Bewegung:** `onKeyDown` setzt `velocityX/Y`, `onKeyUp` setzt sie auf 0.
- **Sprung:** `onKeyDown_Space` → `calculate`-Action mit `velocityY = -10`.

---

### §6.12 Rezept 12: Shoot-Em-Up mit Object Pool ⭐⭐⭐⭐

**Use-Case:** Player schießt Bullets mit Leertaste. Bullets sind vorallokiert (Object Pool).

**Erwartetes Ergebnis:**
- Blueprint: `TSpriteTemplate` mit 20 Pool-Instanzen
- Space-Taste: `spawn_object` mit Player-Position als Start
- Bullets fliegen nach oben, verschwinden nach 3s (`lifetime`)

**Script:**
```typescript
agent.executeBatch([
  // Blueprint-Infrastruktur
  { method: 'addObject', args: ['stage_blueprint', {
    className: 'TGameLoop', name: 'GameLoop',
    isService: true, isHiddenInRun: true,
    x: 2, y: 2, width: 3, height: 1, targetFPS: 60
  }]},
  { method: 'addObject', args: ['stage_blueprint', {
    className: 'TGameState', name: 'GameState',
    isService: true, isHiddenInRun: true,
    x: 6, y: 2, width: 4, height: 1,
    state: 'playing', spritesMoving: true, collisionsEnabled: true
  }]},
  { method: 'addObject', args: ['stage_blueprint', {
    className: 'TInputController', name: 'Input',
    isService: true, isHiddenInRun: true,
    x: 10, y: 2, width: 3, height: 1, enabled: true
  }]},
  
  // Bullet-Template (Object Pool)
  { method: 'addObject', args: ['stage_blueprint', {
    className: 'TSpriteTemplate', name: 'BulletTemplate',
    x: 0, y: 0, width: 0.5, height: 1,
    poolSize: 20, autoRecycle: true, lifetime: 3000,
    velocityY: -5, shape: 'rect', spriteColor: '#ffff00'
  }]},
  
  // Player
  { method: 'addObject', args: ['stage_main', {
    className: 'TSprite', name: 'Player',
    x: 20, y: 30, width: 3, height: 3,
    collisionEnabled: true, collisionGroup: 'player',
    shape: 'rect', spriteColor: '#00c8ff'
  }]},
  
  // Actions
  { method: 'addAction', args: ['FireBullet', 'call_method', 'Shoot', {
    target: 'BulletTemplate', method: 'spawn',
    params: ['${Player.x}', '${Player.y}']
  }]},
  { method: 'addAction', args: ['PlayerLeft', 'increment', 'MovePlayerLeft', {
    target: 'Player', property: 'x', amount: -2
  }]},
  { method: 'addAction', args: ['PlayerRight', 'increment', 'MovePlayerRight', {
    target: 'Player', property: 'x', amount: 2
  }]},
  
  // Keyboard-Bindings
  { method: 'connectEvent', args: ['stage_blueprint', 'Input', 'onKeyDown_Space',      'Shoot'] },
  { method: 'connectEvent', args: ['stage_blueprint', 'Input', 'onKeyDown_ArrowLeft',  'MovePlayerLeft'] },
  { method: 'connectEvent', args: ['stage_blueprint', 'Input', 'onKeyDown_ArrowRight', 'MovePlayerRight'] }
]);
```

**Wichtig:**
- `TSpriteTemplate.spawn(x, y)` nimmt die Spawn-Position als Parameter.
- Der Pool verhindert GC-Hiccups — bei `poolSize: 20` können max. 20 Bullets gleichzeitig fliegen.
- Nach `lifetime: 3000` (3s) wird die Bullet automatisch ins Pool recycled.

**Variationen:**
- **Mehrere Bullet-Types:** Weitere `TSpriteTemplate`-Komponenten mit unterschiedlicher `velocityY` / Farbe.
- **Enemy-Kollision:** Zweiter Sprite-Typ mit `collisionGroup: 'enemy'`, Bullet-Kollision triggert `destroy`-Action.

---

### §6.13 Rezept 13: Loop — 10 Enemies spawnen ⭐⭐⭐

**Use-Case:** Beim Spielstart werden 10 Enemy-Sprites in einer Reihe erzeugt.

**Erwartetes Ergebnis:**
- Eine Task `SpawnWave` mit Loop iteriert 10×
- Pro Iteration: `spawn_object` mit `x = 5 + i * 3, y = 5`

**Script:**
```typescript
agent.executeBatch([
  // Infrastruktur
  { method: 'addObject', args: ['stage_blueprint', {
    className: 'TGameLoop', name: 'GameLoop',
    isService: true, isHiddenInRun: true,
    x: 2, y: 2, width: 3, height: 1, targetFPS: 60
  }]},
  { method: 'addObject', args: ['stage_blueprint', {
    className: 'TGameState', name: 'GameState',
    isService: true, isHiddenInRun: true,
    x: 6, y: 2, width: 4, height: 1,
    state: 'playing', spritesMoving: false
  }]},
  { method: 'addObject', args: ['stage_blueprint', {
    className: 'TSpriteTemplate', name: 'EnemyTemplate',
    x: 0, y: 0, width: 2, height: 2,
    poolSize: 15, shape: 'rect', spriteColor: '#ff0000',
    collisionEnabled: true, collisionGroup: 'enemy'
  }]},
  
  // Loop-Counter-Variable
  { method: 'addVariable', args: ['stage_main', {
    className: 'TIntegerVariable', name: 'i',
    type: 'integer', defaultValue: 0
  }]},
  { method: 'addVariable', args: ['stage_main', {
    className: 'TIntegerVariable', name: 'SpawnX',
    type: 'integer', defaultValue: 0
  }]},
  
  // Start-Button
  { method: 'addObject', args: ['stage_main', {
    className: 'TButton', name: 'SpawnBtn',
    x: 15, y: 25, width: 14, height: 3,
    text: 'Welle starten', style: { backgroundColor: '#0078d4', color: '#fff' }
  }]},
  
  // Loop-Actions
  // (a) Compute x-position for current i
  { method: 'addAction', args: ['ComputeX', 'calculate', 'LoopBody', {
    formula: '5 + i * 3', resultVariable: 'SpawnX'
  }]},
  // (b) Spawn Enemy at (SpawnX, 5)
  { method: 'addAction', args: ['SpawnEnemy', 'call_method', 'LoopBody', {
    target: 'EnemyTemplate', method: 'spawn',
    params: ['${SpawnX}', 5]
  }]},
  
  // Loop-Structure: iterate i from 0 to 9
  { method: 'addLoop', args: ['SpawnWave', {
    iterator: 'i', from: 0, to: 10,
    body: ['LoopBody']
  }]},
  
  // Binding
  { method: 'connectEvent', args: ['stage_main', 'SpawnBtn', 'onClick', 'SpawnWave'] }
]);
```

**Wichtig:**
- `addLoop(taskName, { iterator, from, to, body })` erzeugt eine For-Schleife.
- `body` ist ein **Array von Task-Namen**, die pro Iteration ausgeführt werden.
- Die Loop-Variable (`i`) muss existieren und wird automatisch inkrementiert.

**Variationen:**
- **Grid-Spawn (rows×cols):** Verschachtelte Loops mit zwei Iteratoren `row` und `col`.
- **Zufallige Spawn-Positionen:** `TRandomVariable` statt `i * 3`.

---

### §6.14 Rezept 14: Conditional Branch (If/Else) ⭐⭐

**Use-Case:** Bei Damage-Action wird geprüft, ob HP ≤ 0 ist. Falls ja, GameOver, sonst PlaySoundHurt.

**Erwartetes Ergebnis:**
- Nach `HP -= 20` verzweigt die Task basierend auf `HP` Wert.

**Script:**
```typescript
agent.executeBatch([
  // Variablen
  { method: 'addVariable', args: ['stage_main', {
    className: 'TIntegerVariable', name: 'HP',
    type: 'integer', defaultValue: 100
  }]},
  
  // UI
  { method: 'addObject', args: ['stage_main', {
    className: 'TLabel', name: 'HPLabel',
    x: 10, y: 5, width: 20, height: 3,
    text: 'HP: ${HP}', style: { fontSize: 24 }
  }]},
  { method: 'addObject', args: ['stage_main', {
    className: 'TButton', name: 'HitBtn',
    x: 15, y: 10, width: 10, height: 3,
    text: 'Hit!', style: { backgroundColor: '#c33', color: '#fff' }
  }]},
  
  // Step 1: Damage
  { method: 'addAction', args: ['DecrementHP', 'calculate', 'ProcessDamage', {
    formula: 'HP - 20', resultVariable: 'HP'
  }]},
  
  // Branch-Targets (Separate Tasks für True/False)
  { method: 'addAction', args: ['GameOverToast', 'show_toast', 'GameOverPath', {
    text: '💀 Du bist tot!', duration: 3000
  }]},
  { method: 'addAction', args: ['HurtToast', 'show_toast', 'HurtPath', {
    text: '💢 Aua! (-20 HP)', duration: 1000
  }]},
  
  // Step 2: Branch (if HP <= 0 then GameOverPath else HurtPath)
  { method: 'addBranch', args: ['ProcessDamage', 'HP', '<=', 0,
    (then: any) => { then.addTaskCall('GameOverPath'); },
    (elseBranch: any) => { elseBranch.addTaskCall('HurtPath'); }
  ]},
  
  // Binding
  { method: 'connectEvent', args: ['stage_main', 'HitBtn', 'onClick', 'ProcessDamage'] }
]);
```

**Wichtig:**
- `addBranch(taskName, { condition, thenTask, elseTask })` fügt eine Branch-Action zum Ende einer Task hinzu.
- `condition` ist ein JavaScript-Ausdruck mit Variablen-Namen (keine `${}`-Syntax!).
- `thenTask`/`elseTask` sind **Task-Namen** (keine Action-Namen).

**Variationen:**
- **Mehrstufige Checks:** Mehrere `addBranch`-Aufrufe für verschachtelte if-else-if.
- **Ohne else:** `elseTask` weglassen → Task terminiert lautlos.

---

### §6.15 Rezept 15: Theme-Switcher mit TStringMap ⭐⭐⭐

**Use-Case:** Zwei Themes (Light/Dark) in einer `TStringMap`. Button schaltet zwischen ihnen um und wendet die Farben auf UI-Elemente an.

**Erwartetes Ergebnis:**
- `TStringMap` mit Theme-Farben (`bg`, `fg`, `accent`)
- `load_theme_map`-Action ersetzt die aktuellen Theme-Werte
- Label & Button passen ihre Farben entsprechend an

**Script:**
```typescript
agent.executeBatch([
  // Theme-Map
  { method: 'addVariable', args: ['stage_main', {
    className: 'TStringMap', name: 'Theme',
    type: 'keystore', entries: {
      bg: '#1a1a2e',
      fg: '#f0f0f0',
      accent: '#00c8ff'
    }
  }]},
  
  // Stage-Background-Proxy
  { method: 'addObject', args: ['stage_main', {
    className: 'TPanel', name: 'BgPanel',
    x: 0, y: 0, width: 40, height: 30,
    style: { backgroundColor: '${Theme.bg}' }
  }]},
  
  // UI
  { method: 'addObject', args: ['stage_main', {
    className: 'TLabel', name: 'Title',
    x: 10, y: 5, width: 20, height: 3,
    text: '🎨 Theme-Demo',
    style: { color: '${Theme.fg}', fontSize: 32 }
  }]},
  { method: 'addObject', args: ['stage_main', {
    className: 'TButton', name: 'ToggleBtn',
    x: 15, y: 15, width: 10, height: 3,
    text: 'Toggle Theme',
    style: { backgroundColor: '${Theme.accent}', color: '${Theme.bg}' }
  }]},
  
  // Theme-Presets (als JSON in Actions)
  { method: 'addAction', args: ['LoadDark', 'load_theme_map', 'ApplyDark', {
    target: 'Theme',
    map: { bg: '#1a1a2e', fg: '#f0f0f0', accent: '#00c8ff' }
  }]},
  { method: 'addAction', args: ['LoadLight', 'load_theme_map', 'ApplyLight', {
    target: 'Theme',
    map: { bg: '#ffffff', fg: '#222222', accent: '#0078d4' }
  }]},
  
  // Toggle-Flag
  { method: 'addVariable', args: ['stage_main', {
    className: 'TBooleanVariable', name: 'IsDark',
    type: 'boolean', defaultValue: true
  }]},
  { method: 'addAction', args: ['FlipFlag', 'calculate', 'ToggleTheme', {
    formula: '!IsDark', resultVariable: 'IsDark'
  }]},
  { method: 'addBranch', args: ['ToggleTheme', 'IsDark', '==', true,
    (then: any) => { then.addTaskCall('ApplyDark'); },
    (elseBranch: any) => { elseBranch.addTaskCall('ApplyLight'); }
  ]},
  
  // Binding
  { method: 'connectEvent', args: ['stage_main', 'ToggleBtn', 'onClick', 'ToggleTheme'] }
]);
```

**Wichtig:**
- Style-Bindings: `'${Theme.bg}'` interpoliert den Wert aus der Map.
- `load_theme_map` aktualisiert alle Keys atomic → alle `${Theme.*}`-Bindings re-rendern auf einmal.

**Variationen:**
- **Mehr Themes:** `LoadOcean`, `LoadForest` usw. mit Dropdown-Menü.
- **Smooth Transitions:** Vorher `animate`-Action mit CSS-Transition auf `BgPanel`.

---

### §6.16 Rezept-Index & Kombinationen

**Komplexitäts-Pyramide:**

```
                   ┌──────────────────────────────┐
                   │ ⭐⭐⭐⭐ Rezept 12 (Pool)    │  Production
                   ├──────────────────────────────┤
                   │ ⭐⭐⭐  Rezepte 8,9,13,15    │  Fortgeschritten
                   ├──────────────────────────────┤
                   │ ⭐⭐    Rezepte 3-7,10,11,14 │  Standard
                   ├──────────────────────────────┤
                   │ ⭐      Rezepte 1,2           │  Einstieg
                   └──────────────────────────────┘
```

**Rezept-zu-ActionType-Matrix:**

| Rezept | `property` | `calculate` | `call_method` | `negate` | `variable` | `http` | `navigate_stage` | `show_toast` | `load_theme_map` | `addLoop` | `addBranch` |
|:--|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| 1 Hello-World | ✅ | | | | | | | | | | |
| 2 Countdown | ✅ | ✅ | | | | | | | | | |
| 3 Würfel | | ✅ | ✅ | | | | | | | | |
| 4 Pong-Ball | | | | ✅ | | | | | | | |
| 5 HP-System | ✅ | ✅ | ✅ | | | | | | | | |
| 6 Login | | | | | ✅ | | ✅ | | | | |
| 7 Score | | ✅ | | | | | | | | | |
| 8 Multi-Stage | ✅ | ✅ | | ✅ | | | ✅ | | | | |
| 9 HTTP | ✅ | | | | | ✅ | | | | | |
| 10 Dialog | | | ✅ | | | | | ✅ | | | |
| 11 Keyboard | | | | | | | | | | | |
| 12 Shoot-Em-Up | | | ✅ | | | | | | | | |
| 13 Loop | | ✅ | ✅ | | | | | | | ✅ | |
| 14 Branch | | ✅ | | | | | | ✅ | | | ✅ |
| 15 Theme | | ✅ | | | | | | | ✅ | | ✅ |

**Tipp — wenn du X brauchst, schaue in Rezept Y:**

| Gesuchtes Pattern | Rezept |
|:---|:---|
| Einfacher Button-Click | §6.1 |
| Variable in Label rendern | §6.2 |
| Zufallszahl generieren | §6.3 |
| Sprite-Physik & Kollision | §6.4 |
| Threshold-Events (HP=0) | §6.5 |
| Text-Eingabe lesen | §6.6 |
| Stage-Navigation | §6.6, §6.8 |
| Mehrstufige Berechnung | §6.7 |
| 3+ Stages orchestrieren | §6.8 |
| HTTP-Request (async) | §6.9 |
| Dialog Show/Hide | §6.10 |
| Keyboard-Input | §6.11 |
| Object Pool / Projectiles | §6.12 |
| For-Loop | §6.13 |
| If/Else | §6.14 |
| Theme-Switching | §6.15 |

---

## §7 Anti-Pattern-Katalog

> [!IMPORTANT]
> Diese 15 Anti-Patterns sind **dokumentierte, validator-erfasste oder runtime-kritische Fehler**, die häufig in Agent-Scripts auftreten. Jedes Pattern zeigt: ❌ **Don't** (falsches Vorgehen) + ✅ **Do** (korrekt) + 📖 **Warum** (Grundlage im Code).

### §7.0 Übersicht

| # | Anti-Pattern | Kategorie | Schweregrad |
|:--:|:---|:---|:---:|
| 1 | Inline-Actions (JSON-Injection) | API-Missbrauch | 🔴 Kritisch |
| 2 | `caption` statt `text` | Legacy-Alias | 🟡 Warning |
| 3 | `start`/`stop` bei `TTimer` | Methoden-Naming | 🔴 Runtime-Fehler |
| 4 | Reserved ActionTypes verwenden | Ungültige Actions | 🔴 Validator-Fehler |
| 5 | `set_variable` statt `variable` | Alias-Verwirrung | 🟡 Warning |
| 6 | Sprite-Physik ohne `TGameLoop` | Missing Infrastructure | 🔴 Physik läuft nicht |
| 7 | Absolute Koordinaten in Children | Koordinaten-Bezug | 🔴 Falsche Position |
| 8 | `$name` oder `{name}` statt `${name}` | Variable-Bindings | 🔴 Kein Interpolate |
| 9 | Duplicate Names | Namens-Konflikte | 🔴 Validator-Fehler |
| 10 | Hardcoded Strings statt `${var}` | Wartbarkeit | 🟡 Best-Practice |
| 11 | `parentId` statt `children`-Array | Parent-Hierarchie | 🔴 Layout-Fehler |
| 12 | UI im `stage_blueprint` | Stage-Zuordnung | 🟡 Best-Practice |
| 13 | `${var}` in `branch`-condition | Condition-Syntax | 🔴 Runtime-Fehler |
| 14 | Fehlende `name`-Property | Pflicht-Felder | 🔴 Validator-Fehler |
| 15 | Collision-Event-Conflict | Event-Überschreibung | 🟡 Unerwünscht |

---

### §7.1 ❌ Inline-Actions statt `addAction()` 🔴

**Problem:** Actions werden als JSON-Struktur direkt in ein Objekt-Event injiziert, anstatt über `addAction()` registriert zu werden.

**❌ Don't:**
```typescript
agent.addObject('stage_main', {
  className: 'TButton', name: 'Btn',
  events: {
    onClick: {
      // ❌ Inline-Action-Definition
      type: 'property',
      target: 'Label',
      changes: { text: 'Hallo' }
    }
  }
});
```

**✅ Do:**
```typescript
agent.addObject('stage_main', { className: 'TButton', name: 'Btn', x: 0, y: 0, width: 5, height: 2 });
agent.addAction('SetText', 'property', 'OnClickTask', {
  target: 'Label', changes: { text: 'Hallo' }
});
agent.connectEvent('stage_main', 'Btn', 'onClick', 'OnClickTask');
```

**📖 Warum:**
- Der `AgentController` und `TaskScheduler` kennen nur registrierte Actions. Inline-Actions werden beim Run ignoriert.
- Der Validator kann nur registrierte Actions prüfen → Inline-Actions sind ein blinder Fleck.
- Die Separation `Objects → Actions → Tasks → Events` ist eine Kernprinzip des GCS-Modells (siehe §1.3).

**Siehe auch:** §2 7-Schritte-Methodik, §3.3 `addAction()`.

---

### §7.2 ❌ `caption` statt `text` 🟡

**Problem:** Alte API-Versionen nutzten `caption` für Button-Beschriftung. Neu heißt die Property `text`.

**❌ Don't:**
```typescript
agent.addObject('stage_main', {
  className: 'TButton', name: 'StartBtn',
  x: 5, y: 5, width: 10, height: 2,
  caption: 'Start'   // ❌ Legacy-Alias
});
```

**✅ Do:**
```typescript
agent.addObject('stage_main', {
  className: 'TButton', name: 'StartBtn',
  x: 5, y: 5, width: 10, height: 2,
  text: 'Start'   // ✅ Korrekt
});
```

**📖 Warum:**
- Der Legacy-Alias `caption` funktioniert **zur Laufzeit** (wird im `TButton.setProperty` umgemappt), aber:
- Validator-Warnings werden gefeuert
- IntelliSense/AutoComplete zeigt `text`, nicht `caption`
- Neue Properties wie `icon`, `enabled` folgen dem `text`-Muster konsistent

**Siehe auch:** §5.A.2 `TButton`.

---

### §7.3 ❌ `start`/`stop` bei `TTimer` 🔴

**Problem:** `TTimer` hat andere Methoden-Namen als `TIntervalTimer`. Verwechslung führt zu stummen Runtime-Fehlern.

**❌ Don't:**
```typescript
agent.addAction('StartTimer', 'call_method', 'InitGame', {
  target: 'MyTimer', method: 'start'   // ❌ Falsch bei TTimer!
});
```

**✅ Do — bei `TTimer`:**
```typescript
agent.addAction('StartTimer', 'call_method', 'InitGame', {
  target: 'MyTimer', method: 'timerStart'   // ✅ Korrekt
});
```

**✅ Do — bei `TIntervalTimer`:**
```typescript
agent.addAction('StartIntervalTimer', 'call_method', 'InitGame', {
  target: 'MyIntervalTimer', method: 'start'   // ✅ Hier heißt es wirklich 'start'
});
```

**📖 Warum:**
- `TTimer` hat die Methoden: `timerStart`, `timerStop`, `reset`
- `TIntervalTimer` hat: `start`, `stop`, `reset`
- Der `call_method`-Handler ruft die Methode **ohne Validierung** auf. Existiert sie nicht, wird nur `Logger.warn` gefeuert, aber keine Exception.
- Methoden-Namen-Checks gibt es nur zur Laufzeit, nicht im Validator.

**Siehe auch:** §5.G.1 `TTimer`, §5.G.2 `TIntervalTimer`.

---

### §7.4 ❌ Reserved ActionTypes verwenden 🔴

**Problem:** Die Types `broadcast`, `smooth_sync`, `send_multiplayer_sync`, `server_connect`, `server_ready`, `engine_control` sind **reserviert** — sie haben keinen aktiven Handler im `ActionRegistry`.

**❌ Don't:**
```typescript
agent.addAction('SyncState', 'broadcast', 'MultiplayerTask', {
  event: 'player_moved', data: { x: 10, y: 20 }
});
// ❌ Validator: "Unknown action type: broadcast"
```

**✅ Do — Multiplayer per HTTP:**
```typescript
agent.addAction('SyncState', 'http', 'MultiplayerTask', {
  url: '/api/sync', method: 'POST',
  body: { event: 'player_moved', x: 10, y: 20 }
});
```

**📖 Warum:**
- Die reserved Types sind im Schema (`actionTypes` in `schema_base.json`) aufgeführt, aber es gibt **keinen aktiven Handler** im `ActionRegistry`.
- Der Validator warnt mit `Unknown action type: broadcast`.
- **Dokumentiert in §4.0 Übersichtstabelle** — alle `🔒 Reserved`-Markierungen.
- Multiplayer-Sync ist derzeit über `http`-Actions oder externe Services (`TGameServer`) zu lösen.

**Siehe auch:** §4.0 (Reserved-Types), §4.H Reserved-Section.

---

### §7.5 ❌ `set_variable` statt `variable` 🟡

**Problem:** Der ActionType `set_variable` ist ein **Alias** für `variable`. Beide funktionieren zur Laufzeit, aber `variable` ist der kanonische Name.

**❌ Don't:**
```typescript
agent.addAction('CopyName', 'set_variable', 'OnSubmit', {
  source: 'NameInput', sourceProperty: 'text', variableName: 'Username'
});
```

**✅ Do:**
```typescript
agent.addAction('CopyName', 'variable', 'OnSubmit', {
  source: 'NameInput', sourceProperty: 'text', variableName: 'Username'
});
```

**📖 Warum:**
- `set_variable` ist explizit als Alias dokumentiert (siehe `schema_base.json`): `"set_variable": { "description": "Variable direkt setzen (Alias für variable)" }`.
- Beide Typen werden vom `VariableActions.ts`-Handler behandelt.
- Zukünftige Versionen könnten den Alias entfernen — der kanonische Name ist stabiler.

**Siehe auch:** §4.A.2 `variable`.

---

### §7.6 ❌ Sprite-Physik ohne `TGameLoop` 🔴

**Problem:** Ein Sprite wird erstellt, bewegt sich aber nicht. Grund: `TGameLoop` fehlt in `stage_blueprint`.

**❌ Don't:**
```typescript
// Nur Main-Stage, keine Blueprint-Services
agent.addObject('stage_main', {
  className: 'TSprite', name: 'Ball',
  x: 10, y: 10, width: 2, height: 2,
  velocityX: 3, velocityY: 3
});
// ❌ Ball bewegt sich nicht! Keine Physik.
```

**✅ Do:**
```typescript
// Blueprint mit GameLoop + GameState
agent.addObject('stage_blueprint', {
  className: 'TGameLoop', name: 'GameLoop',
  x: 2, y: 2, width: 3, height: 1,
  isService: true, isHiddenInRun: true, targetFPS: 60
});
agent.addObject('stage_blueprint', {
  className: 'TGameState', name: 'GameState',
  x: 6, y: 2, width: 4, height: 1,
  isService: true, isHiddenInRun: true,
  state: 'playing', spritesMoving: true, collisionsEnabled: true
});

agent.addObject('stage_main', {
  className: 'TSprite', name: 'Ball',
  x: 10, y: 10, width: 2, height: 2,
  velocityX: 3, velocityY: 3
});
```

**📖 Warum:**
- `TGameLoop` ist die einzige Komponente, die `requestAnimationFrame` nutzt und `velocityX/Y` auf `x/y` anwendet.
- Ohne `TGameLoop` bleiben Sprites statisch — keine Fehlermeldung, nur leise Inaktivität.
- `TGameState.spritesMoving: true` ist zusätzlich nötig, um den Loop zu aktivieren.

**Siehe auch:** §5.I.1 `TGameLoop`, §6.4 Pong-Ball-Rezept.

---

### §7.7 ❌ Absolute Koordinaten in Dialog/GroupPanel-Children 🔴

**Problem:** Children in `TDialogRoot` oder `TGroupPanel` haben **relative** Koordinaten. Bei absoluten Werten werden sie an unerwarteter Position gerendert.

**❌ Don't:**
```typescript
agent.addObject('stage_main', {
  className: 'TDialogRoot', name: 'MyDialog',
  x: 10, y: 10, width: 20, height: 15,
  children: [
    {
      className: 'TLabel', name: 'DialogTitle',
      x: 12, y: 12, width: 16, height: 2,   // ❌ Absolute Koordinaten!
      text: 'Titel'
    }
  ]
});
// → Label erscheint bei (10+12, 10+12) = (22, 22), wahrscheinlich außerhalb des Dialogs!
```

**✅ Do:**
```typescript
agent.addObject('stage_main', {
  className: 'TDialogRoot', name: 'MyDialog',
  x: 10, y: 10, width: 20, height: 15,
  children: [
    {
      className: 'TLabel', name: 'DialogTitle',
      x: 2, y: 2, width: 16, height: 2,   // ✅ Relativ zum Dialog
      text: 'Titel'
    }
  ]
});
```

**📖 Warum:**
- Der Renderer addiert automatisch `parent.x + child.x` bei Layout-Berechnung.
- Bei absoluten Koordinaten: Dialog bei `(10, 10)` + Child `x: 12` → Child landet bei `x: 22`.
- Regel: **Child-Koordinaten sind immer relativ zum Parent** (Dialog/GroupPanel/Panel).

**Siehe auch:** §5.C.2 `TGroupPanel`, §5.D.1 `TDialogRoot`.

---

### §7.8 ❌ `$name` oder `{name}` statt `${name}` 🔴

**Problem:** Variable-Bindings funktionieren nur mit **exakt** der `${...}`-Syntax.

**❌ Don't:**
```typescript
agent.addObject('stage_main', {
  className: 'TLabel', name: 'ScoreLbl',
  text: '$Score'        // ❌ Kein Interpolate — Label zeigt wörtlich "$Score"
});
agent.addObject('stage_main', {
  className: 'TLabel', name: 'CountLbl',
  text: '{Countdown}'    // ❌ Kein Interpolate — Label zeigt wörtlich "{Countdown}"
});
```

**✅ Do:**
```typescript
agent.addObject('stage_main', {
  className: 'TLabel', name: 'ScoreLbl',
  text: '${Score}'       // ✅ Dollar + geschweifte Klammern
});
agent.addObject('stage_main', {
  className: 'TLabel', name: 'ComplexLbl',
  text: 'Score: ${Score} / ${MaxScore}'   // ✅ Mehrere Bindings möglich
});
```

**📖 Warum:**
- Der `VariableInterpolator` sucht strikt nach dem Regex `\$\{([^}]+)\}`.
- `$Score` allein wird als statischer Text gerendert.
- `{Score}` allein wird als statischer Text gerendert.
- Unterstützt Property-Access: `${Obj.prop}`, `${List[0]}`.

**Siehe auch:** §5.A.1 `TLabel`.

---

### §7.9 ❌ Duplicate Names über Stages hinweg 🔴

**Problem:** Zwei Objekte mit demselben `name` in verschiedenen Stages → Validator-Fehler.

**❌ Don't:**
```typescript
agent.addObject('stage_menu', {
  className: 'TButton', name: 'StartBtn', /* ... */
});
agent.addObject('stage_game', {
  className: 'TButton', name: 'StartBtn', /* ... */   // ❌ Doppelter Name!
});
// Validator: "Object name already exists: StartBtn"
```

**✅ Do:**
```typescript
agent.addObject('stage_menu', {
  className: 'TButton', name: 'MenuStartBtn', /* ... */
});
agent.addObject('stage_game', {
  className: 'TButton', name: 'GameStartBtn', /* ... */
});
```

**📖 Warum:**
- Der `ProjectRegistry` verwaltet Namen **global** über alle Stages, nicht pro Stage.
- Grund: Actions und Event-Handler referenzieren Objekte per `name` ohne Stage-Prefix.
- Konvention: Stage-Präfix (`MenuStartBtn`, `GameHPBar`) oder Rollen-Präfix (`UI_StartBtn`, `GameplayHPBar`).

**Siehe auch:** §3.2 `addObject()`.

---

### §7.10 ❌ Hardcoded Strings statt Variable-Bindings 🟡

**Problem:** Statische Werte in UI-Texten statt dynamischer Bindings → Labels aktualisieren sich nicht bei Variable-Änderung.

**❌ Don't:**
```typescript
// Variable ändert sich, aber Label zeigt weiter statischen Text
agent.addObject('stage_main', {
  className: 'TLabel', name: 'ScoreLbl',
  text: 'Score: 0'   // ❌ Statisch
});
agent.addAction('AddPoints', 'calculate', 'OnScore', {
  formula: 'Score + 10', resultVariable: 'Score'
});
// Label zeigt weiter "Score: 0", auch wenn Score = 100
```

**✅ Do:**
```typescript
agent.addVariable('stage_main', {
  className: 'TIntegerVariable', name: 'Score',
  type: 'integer', defaultValue: 0
});
agent.addObject('stage_main', {
  className: 'TLabel', name: 'ScoreLbl',
  text: 'Score: ${Score}'   // ✅ Dynamisch
});
// Label re-rendert automatisch bei Variable-Änderung
```

**📖 Warum:**
- Der `VariableInterpolator` subscribed sich auf Variable-Änderungen und re-rendert Label-Texte automatisch.
- Statische Strings brauchen manuelle `property`-Actions für jede Änderung.
- **Best Practice:** Für alles, das sich ändert → Variable + Binding.

**Siehe auch:** §5.A.1 `TLabel`, §6.2 Countdown-Rezept.

---

### §7.11 ❌ `parentId` statt `children`-Array 🔴

**Problem:** Flache Objekt-Liste mit `parentId`-Referenz statt verschachtelter `children`-Struktur.

**❌ Don't:**
```typescript
agent.addObject('stage_main', {
  className: 'TGroupPanel', name: 'Container', /* ... */
});
agent.addObject('stage_main', {
  className: 'TLabel', name: 'ChildLbl',
  parentId: 'Container',   // ❌ Wird ignoriert!
  text: 'Im Container'
});
```

**✅ Do:**
```typescript
agent.addObject('stage_main', {
  className: 'TGroupPanel', name: 'Container',
  x: 1, y: 1, width: 20, height: 15,
  children: [
    {
      className: 'TLabel', name: 'ChildLbl',
      x: 2, y: 2, width: 10, height: 2,
      text: 'Im Container'
    }
  ]
});
```

**📖 Warum:**
- Die Renderer-Hierarchie basiert auf der `children`-Array-Struktur, nicht auf `parentId`.
- `parentId` existiert nicht als Property — wird stumm ignoriert.
- Vorteil: Deterministische Render-Reihenfolge (Children nach Parent-Mount).

**Siehe auch:** §5.C.2 `TGroupPanel`.

---

### §7.12 ❌ UI-Elemente im `stage_blueprint` 🟡

**Problem:** Buttons, Labels, Sprites ins Blueprint legen statt in Main- oder Game-Stages.

**❌ Don't:**
```typescript
// Button im Blueprint → wird auf JEDER Stage angezeigt, auch im GameOver-Screen
agent.addObject('stage_blueprint', {
  className: 'TButton', name: 'PlayBtn',
  text: 'Play'
});
```

**✅ Do:**
```typescript
// UI nur auf relevanten Stages
agent.addObject('stage_menu', {
  className: 'TButton', name: 'PlayBtn',
  text: 'Play'
});

// Im Blueprint: NUR Services
agent.addObject('stage_blueprint', {
  className: 'TGameLoop', name: 'GameLoop',
  isService: true, isHiddenInRun: true
});
```

**📖 Warum:**
- `stage_blueprint` wird auf **allen Stages** aktiv/sichtbar — Services, die stage-übergreifend laufen sollen.
- UI im Blueprint → doppelte Anzeige, Z-Index-Probleme.
- **Regel:** Blueprint = Services mit `isService: true, isHiddenInRun: true`.

**Siehe auch:** §1.3 Blueprint vs. Stage.

---

### §7.13 ❌ Veraltete `addBranch`-Syntax 🔴

**Problem:** Früher nahm `addBranch` ein Option-Objekt (`{ condition, thenTask }`). Das wurde durch eine typensichere Builder-Syntax abgelöst.

**❌ Don't:**
```typescript
agent.addBranch('ProcessHit', {
  condition: 'HP <= 0',
  thenTask: 'GameOver',
  elseTask: 'Hurt'
});
```

**✅ Do:**
```typescript
agent.addBranch('ProcessHit', 'HP', '<=', 0,
  (thenBranch) => { thenBranch.addTaskCall('GameOver'); },
  (elseBranch) => { elseBranch.addTaskCall('Hurt'); }
);
```

**📖 Warum:**
- Die neue Signatur verhindert Syntax-Fehler in JS-Ausdrücken, indem sie feste Parameter erzwingt: `variable`, `operator`, `value`.
- Callback-Builder (`thenBranch`/`elseBranch`) erlauben direkte Action-Definition via `addNewAction` oder Task-Calls via `addTaskCall`.

**Siehe auch:** §3.7 `addBranch()`, §6.14 Branch-Rezept.

---

### §7.14 ❌ Fehlende `name`-Property 🔴

**Problem:** Objekt ohne `name` → Validator-Fehler + Referenzen aus Actions werden broken.

**❌ Don't:**
```typescript
agent.addObject('stage_main', {
  className: 'TButton',
  x: 5, y: 5, width: 10, height: 2,
  text: 'Click me'
  // ❌ name fehlt!
});
// Validator: "Object missing required property: name"
```

**✅ Do:**
```typescript
agent.addObject('stage_main', {
  className: 'TButton', name: 'MyBtn',   // ✅ Name ist Pflicht
  x: 5, y: 5, width: 10, height: 2,
  text: 'Click me'
});
```

**📖 Warum:**
- `name` ist das Referenz-Attribut für Actions (`target: 'MyBtn'`), Event-Bindings (`connectEvent(..., 'MyBtn', ...)`) und Variable-Bindings.
- Ohne `name` kann kein anderes System auf das Objekt verweisen.
- Der `ProjectRegistry.registerObject()` prüft Name-Uniqueness **und** Existenz.

**Siehe auch:** §3.2 `addObject()`.

---

### §7.15 ❌ Collision-Event-Conflict 🟡

**Problem:** `onCollision` und spezifische `onCollisionLeft/Right/Top/Bottom` gleichzeitig zu binden → `onCollision` überschreibt spezifische Handler (oder umgekehrt, je nach Reihenfolge).

**❌ Don't:**
```typescript
agent.connectEvent('stage_main', 'Ball', 'onCollision', 'HandleAnyHit');
agent.connectEvent('stage_main', 'Ball', 'onCollisionLeft', 'BounceX');   // ❌ Unerwartet
// onCollision feuert auch bei Left-Kollision → beide Handler aktiv?
```

**✅ Do — Option 1: Nur generisch mit hitSide-Prüfung:**
```typescript
agent.connectEvent('stage_main', 'Ball', 'onCollision', 'HandleHit');
agent.addBranch('HandleHit', {
  condition: 'eventData.hitSide === "left" || eventData.hitSide === "right"',
  thenTask: 'BounceX',
  elseTask: 'BounceY'
});
```

**✅ Do — Option 2: Nur spezifische Events:**
```typescript
agent.connectEvent('stage_main', 'Ball', 'onCollisionLeft',  'BounceX');
agent.connectEvent('stage_main', 'Ball', 'onCollisionRight', 'BounceX');
agent.connectEvent('stage_main', 'Ball', 'onCollisionTop',   'BounceY');
agent.connectEvent('stage_main', 'Ball', 'onCollisionBottom','BounceY');
```

**📖 Warum:**
- `TSprite` feuert bei Kollision **sowohl** `onCollision` als auch das spezifische Side-Event.
- Beide Handler laufen — wenn sie dieselbe Variable modifizieren, können Race Conditions entstehen.
- **Konvention:** Entweder generisch (mit Branch) **oder** alle 4 Sides — nicht gemischt.

**Siehe auch:** §5.E.1 `TSprite`, §6.4 Pong-Ball-Rezept.

---

### §7.16 Debugging-Checkliste

Wenn ein Script nicht funktioniert, prüfe in dieser Reihenfolge:

1. **Validator:** `agent.validate()` → alle Errors/Warnings lesen
2. **Console-Logs:** `Logger.warn` für ungültige `method`-Aufrufe
3. **Variable-Bindings:** Syntax `${name}` korrekt? Variable existiert?
4. **Stage-Zuordnung:** Services im `stage_blueprint`? UI in konkreten Stages?
5. **Koordinaten:** Children relativ zum Parent?
6. **Name-Duplikate:** Eindeutige Namen über alle Stages?
7. **Timer-Methoden:** `timerStart` (TTimer) vs. `start` (TIntervalTimer)?
8. **Action-Types:** Keine Reserved Types verwendet?
9. **Physik aktiv:** `TGameLoop` + `TGameState.spritesMoving: true`?
10. **Event-Bindings:** `connectEvent` korrekt aufgerufen?

**Tipp:** Ein kurzes Smoke-Test-Script zu Beginn hilft:
```typescript
const result = agent.validate();
console.log('Errors:',   result.errors);
console.log('Warnings:', result.warnings);
console.log('Valid:',    result.valid);
```

---

## §8 Validator-Regeln

> [!IMPORTANT]
> Dieser Abschnitt dokumentiert **die tatsächlich implementierten Validator-Checks** im Code. Quellen: `AgentController.validate()` und `TaskRegistry.validateTaskName()`. Andere Checks (Schema-Properties, Variable-Existenz, Methoden-Namen) laufen **zur Laufzeit** via `Logger.warn` — sie sind nicht Teil des statischen Validators.

### §8.0 Übersicht: Check-Zeitpunkte

| Check | Zeitpunkt | Ort | Konsequenz |
|:---|:---|:---|:---|
| Name-Uniqueness (Objekte) | `addObject()` | `ProjectRegistry` | Exception |
| Name-Uniqueness (Tasks, global+stage) | `addTask()`, `addAction()` | `TaskRegistry.validateTaskName()` | Exception |
| Task-Name PascalCase | `addTask()`, `addAction()` | `TaskRegistry` | Exception |
| ActionType gültig | `addAction()` | `AgentController.addAction` | Exception (`Unknown action type`) |
| Inline-Actions-Erkennung | `validate()` | `AgentController.validate()` | Error im Report |
| Action-Referenz existiert | `validate()` | `AgentController.validate()` | Error im Report |
| Action-Definition referenziert (nicht verwaist) | `validate()` | `AgentController.validate()` | Warning im Report |
| Task hat FlowChart | `validate()` | `AgentController.validate()` | Warning im Report |
| Methode existiert auf Target | **Runtime** | `call_method`-Handler | `Logger.warn`, keine Exception |
| Variable existiert bei `${var}` | **Runtime** | `VariableInterpolator` | Silent fallback (leerer String) |

### §8.1 Statische Checks im `validate()`-Report

Der Rückgabewert von `agent.validate()` ist ein Array:

```typescript
{ level: 'error' | 'warning', message: string }[]
```

#### §8.1.1 Error: Inline-Action gefunden

**Regel:** In einer `actionSequence` darf ein Action-Item **nur** die Keys `type` und `name` haben. Weitere Keys (`target`, `changes`, ...) bedeuten Inline-Action und sind verboten.

**Error-Message:**
```
Task '<taskName>': Inline-Action gefunden (<actionName>). Nur Referenzen erlaubt!
```

**Fix:** Action per `agent.addAction()` registrieren und nur den `name` im Task referenzieren.

**Siehe auch:** §7.1 Anti-Pattern Inline-Actions.

#### §8.1.2 Error: Action referenziert aber nicht definiert

**Regel:** Ein Task referenziert eine Action per `name`, aber es existiert keine Action mit diesem Namen.

**Error-Message:**
```
Task '<taskName>': Action '<actionName>' ist referenziert aber nicht definiert.
```

**Fix:**
- Action per `addAction()` erzeugen **bevor** der Task darauf verweist
- Oder Task-Binding korrigieren

#### §8.1.3 Warning: Action ist verwaist

**Regel:** Eine Action wurde per `addAction()` definiert, aber kein Task referenziert sie.

**Warning-Message:**
```
Action '<actionName>' ist definiert aber in keinem Task referenziert.
```

**Fix:**
- Action in einem Task einbauen
- Oder die ungenutzte Action entfernen

#### §8.1.4 Warning: Task ohne FlowChart

**Regel:** Ein Task hat Actions (`actionSequence.length > 0`), aber kein FlowChart-Eintrag in `project.flowCharts` oder `stage.flowCharts`.

**Warning-Message:**
```
Task '<taskName>' hat <N> Actions aber kein FlowChart.
```

**Fix:** FlowCharts werden automatisch beim `addAction()` erstellt — wenn die Warnung erscheint, hat ein manueller Task-Eintrag das verhindert. Tipp: Task über `addAction()` aufbauen.

### §8.2 Name-Validierung

#### §8.2.1 Task-Namen: PascalCase + Uniqueness

Regex: `/^[A-Z][a-zA-Z0-9]*$/`

**Gültig:** `StartGame`, `OnClickButton`, `Task1`
**Ungültig:** `startGame` (lowercase), `Task_1` (underscore), `1Task` (Ziffer vorne), `My-Task` (Bindestrich)

**Error-Messages:**
```
Tasks müssen mit einem Großbuchstaben beginnen (PascalCase).
```
```
Task-Name bereits vergeben (global oder in einer Stage).
```

**Wichtig:** Task-Namen sind **global + pro Stage** eindeutig — `TaskA` auf `stage_menu` und `TaskA` auf `stage_game` kollidieren.

#### §8.2.2 Objekt-Namen: Uniqueness

Geprüft in `ProjectRegistry.registerObject()`. Namen sind **global** über alle Stages eindeutig.

**Fehler:** Exception beim zweiten `addObject`-Call mit demselben Namen.

**Konvention:** Stage-Präfix oder Rollen-Präfix verwenden — siehe §7.9.

### §8.3 Exception-Checks bei API-Aufrufen

Diese Checks werfen **synchron Exceptions** beim Aufruf, noch vor dem `validate()`:

| API-Call | Check | Exception bei |
|:---|:---|:---|
| `addStage({ id })` | `id` ist eindeutig | Existiert bereits |
| `addObject(stageId, { name })` | `name` ist eindeutig (global) | Existiert bereits |
| `addObject(stageId, { className })` | Klasse ist registriert | Unknown component class |
| `addVariable(stageId, { name })` | Name ist eindeutig (global) | Existiert bereits |
| `addAction(name, type, ...)` | `type` ∈ {24 legale Types} | `Unknown action type: <type>` |
| `addTask(name, seq)` | Task-Name gültig + eindeutig | PascalCase-Fehler oder Doppel-Name |
| `connectEvent(stageId, objName, ...)` | Objekt existiert in Stage | Objekt nicht gefunden |

**Empfehlung:** `try/catch`-Block um Agent-Scripts, um frühe Fehler abzufangen:

```typescript
try {
  agent.executeBatch([ /* ... */ ]);
} catch (err) {
  console.error('Agent-Fehler:', err.message);
}
```

### §8.4 Runtime-Checks (nicht-statisch)

Die folgenden Fehler werden **erst zur Laufzeit** erkannt:

| Problem | Runtime-Verhalten | Log-Output |
|:---|:---|:---|
| `call_method`-Target existiert nicht | Action wird übersprungen | `Logger.warn("Action X: target 'Y' not found")` |
| `call_method`-Method existiert nicht | Action wird übersprungen | `Logger.warn("Method 'Z' not found on 'Y'")` |
| `${var}` referenziert ungültige Variable | Fallback zu leerem String | Optional: `Logger.warn` |
| `http`-Request schlägt fehl | `resultVariable` bleibt leer | `Logger.error("HTTP failed: ...")` |
| `navigate_stage`-Target existiert nicht | Navigation wird abgebrochen | `Logger.warn("Stage 'X' not found")` |
| Reserved ActionType verwendet | Action wird übersprungen | `Logger.warn("Reserved action type: broadcast")` |

**Best Practice:** Browser-Console geöffnet halten während der Entwicklung, um Runtime-Warnings nicht zu verpassen.

### §8.5 Error-Taxonomie

```
┌─────────────────────────────────────────────────────────────┐
│  Statische Exceptions (beim API-Aufruf)                     │
│  ────────────────────────────────                           │
│  • Name-Duplikate                                           │
│  • Unbekannte ActionTypes / Klassen                         │
│  • PascalCase-Verstoß bei Task-Namen                        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  validate()-Report (manuell aufrufbar)                      │
│  ────────────────────────────────                           │
│  ERRORS:                                                    │
│    • Inline-Actions in Tasks                                │
│    • Referenzen auf undefinierte Actions                    │
│  WARNINGS:                                                  │
│    • Verwaiste (unreferenzierte) Actions                    │
│    • Tasks ohne FlowChart                                   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  Runtime-Warnings (zur Laufzeit)                            │
│  ────────────────────────────────                           │
│  • Methoden-Existenz                                        │
│  • Target-Existenz                                          │
│  • Variable-Existenz                                        │
│  • HTTP-Errors                                              │
│  • Stage-Navigation-Errors                                  │
│  • Reserved-Type-Verwendung                                 │
└─────────────────────────────────────────────────────────────┘
```

**Empfehlung an Agenten:** Nach jedem `executeBatch()` ein `validate()` aufrufen und Errors + Warnings ins Log schreiben. So werden Inline-Actions, Undefined-Referenzen und verwaiste Actions früh erkannt.

```typescript
const report = agent.validate();
const errors   = report.filter(i => i.level === 'error');
const warnings = report.filter(i => i.level === 'warning');

if (errors.length) {
  console.error(`❌ ${errors.length} Error(s):`, errors);
}
if (warnings.length) {
  console.warn(`⚠️  ${warnings.length} Warning(s):`, warnings);
}
```

---

## §9 Referenzen

### §9.1 Source-File-Index

Wichtigste Implementierungs-Dateien. Pfade sind relativ zum Projekt-Root (`src/`).

#### Agent-Layer

| Datei | Inhalt |
|:---|:---|
| `services/AgentController.ts` | Hauptklasse mit allen API-Methoden (`addObject`, `addAction`, `validate`, `executeBatch`, ...) |
| `services/actions/ActionRegistry.ts` | Mapping von `ActionType` → Handler |
| `services/actions/PropertyActions.ts` | `property`, `negate`, `increment` |
| `services/actions/VariableActions.ts` | `variable`, `set_variable`, `calculate` |
| `services/actions/DialogActions.ts` | `toggle_dialog`, `hide_dialog`, `close_dialog` |
| `services/actions/MiscActions.ts` | `show_toast`, `load_theme_map`, `http`, `data_action` |
| `services/actions/GameActions.ts` | Game-spezifische Actions |

#### Registry-Layer

| Datei | Inhalt |
|:---|:---|
| `services/registry/ProjectRegistry.ts` | Globale Objekt- und Namens-Verwaltung |
| `services/registry/TaskRegistry.ts` | Task-Namen-Validierung, Task-Lookup |
| `services/registry/ActionRegistry.ts` | Action-Type-Registrierung |

#### Komponenten-Layer

| Datei | Inhalt |
|:---|:---|
| `components/TWindow.ts` | Abstrakte Basisklasse (alle Base-Properties) |
| `components/TComponent.ts` | Abstrakte Basis für Custom-Komponenten |
| `components/T*.ts` | Konkrete Komponenten (76 Klassen — siehe §5) |

#### Schema-Dateien

Alle unter `docs/schemas/` (bereits referenziert in §5):

| Datei | Inhalt |
|:---|:---|
| `schema_base.json` | `actionTypes`, `variableTypes`, `baseProperties`, `semantik` |
| `schema_services.json` | `TGameLoop`, `TGameState`, `TInputController` |
| `schema_inputs.json` | `TEdit`, `TMemo`, `TNumberInput`, `TCheckbox`, `TDropdown`, `TColorPicker` |
| `schema_containers.json` | `TPanel`, `TGroupPanel` |
| `schema_dialogs.json` | `TDialogRoot`, `TSidePanel` |
| `schema_display.json` | `TLabel`, `TButton`, `TShape`, `TProgressBar`, `TRichText`, `TImage`, `TNumberLabel` |
| `schema_game.json` | `TSprite`, `TSpriteTemplate` |
| `schema_media.json` | `TAudio`, `TVideo`, `TImageList` |
| `schema_timers.json` | `TTimer`, `TIntervalTimer` |
| `schema_variables.json` | Alle `T*Variable`-Klassen + `TStringMap` |

#### Store / Mediator

| Datei | Inhalt |
|:---|:---|
| `core/coreStore.ts` | Singleton-Store für `project`-State |
| `services/mediatorService.ts` | Event-Dispatcher für Cross-Komponenten-Changes |

### §9.2 Glossar

| Begriff | Bedeutung |
|:---|:---|
| **Action** | Eine elementare Operation (`property`, `calculate`, ...). Registriert per `addAction()`. |
| **ActionType** | Der Typ-String einer Action (z.B. `'property'`, `'calculate'`). 24 valide Types. |
| **AgentController** | Die Fassade-Klasse mit der Haupt-API für Agenten. |
| **Binding** | Automatisches Variable-Interpolate via `${name}` in Properties. |
| **Blueprint** | Die spezielle Stage `stage_blueprint` für globale Services. |
| **Child** | Objekt innerhalb eines Parent-Containers (`TPanel`, `TGroupPanel`, `TDialogRoot`). |
| **className** | Der Klassen-Bezeichner einer Komponente (z.B. `"TButton"`). |
| **Component** | Eine UI-Klasse, abgeleitet von `TWindow`. 76 Klassen registriert. |
| **connectEvent** | API-Methode zum Binden von Events an Task-Namen. |
| **Event** | Vorwiegend UI-Ereignis (`onClick`, `onChange`, ...). Siehe §5.4. |
| **executeBatch** | API für transaktionales Anwenden mehrerer Operationen. |
| **FlowChart** | Visualisierung eines Tasks als Graph. Wird automatisch erstellt. |
| **Grid-Einheit** | Einheit für Koordinaten (`x`, `y`, `width`, `height`). 1 Grid = Basis-Pixel-Multi. |
| **Inline-Action** | Falsch: Action-Definition direkt in Event-Handler (JSON). Verboten. |
| **isService** | Property für stage-übergreifende Hintergrund-Komponenten (unsichtbar). |
| **isHiddenInRun** | Im Editor sichtbar, im Run-Modus verborgen (z.B. Timer, Variablen). |
| **isVariable** | Markiert eine Komponente als Variable (nicht als UI-Element). |
| **Legacy-Alias** | Veralteter Property-/Type-Name mit Rückwärts-Kompatibilität (z.B. `caption`, `set_variable`). |
| **Main-Stage** | Erste sichtbare Stage (üblich: `stage_main`). |
| **Name** | Instanz-Bezeichner eines Objekts. Global eindeutig. |
| **ProjectRegistry** | Verwaltung aller Objekte, Variablen, Stages. |
| **Reserved** | ActionTypes ohne aktiven Handler (z.B. `broadcast`). Nicht verwenden. |
| **Schema** | JSON-Definition einer Komponente (Properties, Methods, Events). |
| **Stage** | Eine Szene/Seite mit eigenen Objekten, Variablen, Tasks. |
| **Target** | Name des Zielobjekts in einer Action (z.B. `"target": "Ball"`). |
| **Task** | Benannte Action-Sequenz. PascalCase-Name erforderlich. |
| **Task-Binding** | Verknüpfung zwischen Event und Task via `connectEvent()`. |
| **TGameLoop** | Pflicht-Komponente für Sprite-Physik. |
| **TGameState** | Globale State-Komponente (`state`, `spritesMoving`, `collisionsEnabled`). |
| **TInputController** | Keyboard-Events-Dispatcher. |
| **TProjectRegistry** | Siehe `ProjectRegistry`. |
| **TWindow** | Abstrakte Base-Class aller Komponenten. |
| **validate()** | Statische Konsistenz-Prüfung des Projekts. Rückgabe: Errors + Warnings. |
| **Variable-Interpolation** | Ersetzung von `${name}` durch aktuellen Variablen-Wert zur Render-Zeit. |

### §9.3 Referenzierte externe Dokumente

| Dokument | Zweck |
|:---|:---|
| `docs/schemas/schema_*.json` | Komponenten-Schemas (10 Dateien) |
| `src/services/AgentController.ts` | API-Implementierung (Source of Truth) |
| `docs/USER_GUIDE.md` | Endbenutzer-Dokumentation (falls vorhanden) |
| `README.md` | Projekt-Übersicht |

### §9.4 Quick-Access-Index zu diesem Dokument

| Thema | §-Abschnitt |
|:---|:---|
| Mentales Modell (Stages, Objects, Actions) | §1 |
| 7-Schritte-Methodik zum Aufbau eines Projekts | §2 |
| API-Referenz (`addObject`, `addAction`, ...) | §3 |
| ActionType-Katalog (24 Typen) | §4 |
| Komponenten-Steckbriefe (76 Klassen) | §5 |
| End-to-End-Rezepte (15 Stück) | §6 |
| Anti-Patterns (15 häufige Fehler) | §7 |
| Validator-Regeln | §8 |
| Diese Glossar + Source-Index | §9 |

### §9.5 Änderungshistorie

| Version | Datum | Änderungen |
|:---|:---|:---|
| 1.0 | 2025-XX | Initiale Version: §1-§9 vollständig erstellt |

---

## Schluss

Dieses Dokument ist die **verbindliche Referenz** für AI-Agenten, die den Game-Builder v1 programmgesteuert bedienen. Bei Abweichungen zwischen Doku und Code **gilt der Code als Source of Truth** — bitte als Issue melden.

**Feedback:** Fehler, Lücken, Verbesserungsvorschläge → bitte als Comment oder Pull-Request an die relevante Stage-Section.

**Haupt-Einstiegspunkte für Agenten:**
- **Neu im System?** → §1 Mentales Modell + §2 7-Schritte-Methodik
- **Direkt loslegen?** → §6.1 Hello-World + §3 API-Referenz
- **Fehler beheben?** → §7 Anti-Patterns + §8 Validator-Regeln
- **Spezifische Komponente?** → §5 Komponenten-Steckbriefe

**Ende des Dokuments.**
