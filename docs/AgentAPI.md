# GCS Agent API — Vollständige Referenz

> **Zielgruppe**: KI-Agenten (Claude, Gemini, GPT) und Entwickler, die Spiele über die `AgentController`-API erstellen und manipulieren wollen.
>
> **Wichtig**: Du brauchst KEINE Kenntnis der internen JSON-Struktur, TypeScript-Klassen oder Editor-Interna. Diese API abstrahiert alles.

---

## Inhaltsverzeichnis

1. [Architektur-Überblick](#architektur-überblick)
2. [Konzepte](#konzepte)
3. [API-Methoden](#api-methoden)
4. [Action-Typ-Katalog](#action-typ-katalog)
5. [Event-Katalog](#event-katalog)
6. [Komponenten-Katalog](#komponenten-katalog)
7. [Sprite-Shortcuts (AgentShortcuts)](#sprite-shortcuts)
8. [HTTP-API](#http-api)
9. [KI-Prompt-Template](#ki-prompt-template)
10. [Vollständiges Beispiel: PingPong](#vollständiges-beispiel)

---

## Architektur-Überblick

```
┌─────────────────────────────────────┐
│  KI-Agent (Claude, Gemini, GPT...) │  ← kennt nur dieses Dokument
├─────────────────────────────────────┤
│  HTTP/WebSocket Interface           │  POST /api/agent/:method
├─────────────────────────────────────┤
│  AgentController + AgentShortcuts   │  ← API-Schicht
│  createSprite, addAction,           │
│  connectEvent, createBounceLogic... │
├─────────────────────────────────────┤
│  GCS Engine (intern)                │  ← bleibt verborgen
└─────────────────────────────────────┘
```

---

## Konzepte

### Projekt-Struktur

Ein GCS-Projekt besteht aus:

| Konzept | Beschreibung | Beispiel |
|---------|-------------|----------|
| **Stage** | Eine Szene/Level im Spiel | `stage_main`, `stage_splash`, `stage_blueprint` |
| **Objekt** | Visuelles Element auf der Stage | Sprites, Labels, Buttons, Panels |
| **Task** | Logik-Container mit Abfolge von Actions | `HandleBallBoundary`, `StartGame` |
| **Action** | Atomare Aktion (Property ändern, navigieren...) | `ResetBall`, `NegateBallX` |
| **Variable** | Datenspeicher (global oder Stage-lokal) | `score`, `isGameOver` |
| **Event** | Auslöser der einen Task startet | `onClick`, `onCollision`, `onBoundaryHit` |
| **FlowChart** | Visuelle Darstellung eines Tasks | Wird automatisch generiert |

### Wichtige Regeln

1. **Globale Elemente gehören in die Blueprint-Stage** (`stage_blueprint`): globale Variablen, globale Actions, globale Komponenten
2. **Keine Inline-Actions**: Actions werden global definiert und nur per Name referenziert
3. **Ein Task = 1 Task-Objekt + min. 1 Action + Event-Binding**
4. **Objekt-Positionen sind in Grid-Zellen** (nicht Pixel!), z.B. x=32, y=19 bei einem 64×40 Grid

### Stage-Typen

| Typ | Beschreibung | Besonderheiten |
|-----|-------------|----------------|
| `blueprint` | Globale Konfiguration | Enthält globale Variablen, Actions, Services. Immer genau eine. |
| `splash` | Startbildschirm | Wird vor der Main-Stage angezeigt. Optional. |
| `main` | Haupt-Spielfeld | Enthält die Spiellogik. |
| `standard` | Zusätzliche Stages | Highscore, Settings, etc. |

---

## API-Methoden

### 0. Projekt-Struktur

#### `createStage(id, name, type?)`
Erstellt eine neue Stage.

| Parameter | Typ | Default | Beschreibung |
|-----------|-----|---------|-------------|
| `id` | `string` | — | Eindeutige ID (z.B. `stage_main`) |
| `name` | `string` | — | Anzeigename |
| `type` | `'standard' \| 'blueprint'` | `'standard'` | Stage-Typ |

```typescript
agent.createStage('stage_main', 'Spielfeld');
agent.createStage('stage_highscore', 'Highscore');
```

---

#### `addObject(stageId, objectData)`
Fügt ein Objekt zu einer Stage hinzu.

| Parameter | Typ | Beschreibung |
|-----------|-----|-------------|
| `stageId` | `string` | ID der Stage |
| `objectData` | `object` | Objekt-Definition (siehe Komponenten-Katalog) |

```typescript
agent.addObject('stage_main', {
    name: 'BallSprite',
    className: 'TSprite',
    x: 32, y: 19, width: 2, height: 2,
    velocityX: 3, velocityY: 3,
    collisionEnabled: true,
    visible: true
});
```

---

#### `addVariable(name, type, initialValue, scope?)`
Registriert eine globale Variable.

| Parameter | Typ | Default | Beschreibung |
|-----------|-----|---------|-------------|
| `name` | `string` | — | Variablen-Name |
| `type` | `any` | — | Typ (`'number'`, `'string'`, `'boolean'`, `'object'`) |
| `initialValue` | `any` | — | Startwert |
| `scope` | `string` | `'global'` | Geltungsbereich |

```typescript
agent.addVariable('score', 'number', 0, 'global');
agent.addVariable('isGameOver', 'boolean', false, 'global');
```

---

### 1. Task-Management

#### `createTask(stageId, taskName, description?)`
Erstellt einen neuen Task.

| Parameter | Typ | Default | Beschreibung |
|-----------|-----|---------|-------------|
| `stageId` | `string` | — | Stage in der der Task liegt |
| `taskName` | `string` | — | Eindeutiger Name |
| `description` | `string` | `""` | Beschreibung |

**Rückgabewert:** `string` (taskName)

```typescript
agent.createTask('stage_main', 'HandleBallBoundary', 'Ball prallt an Wänden ab');
```

---

#### `addTaskCall(taskName, calledTaskName)`
Fügt einen Task-Aufruf in die Sequenz eines Tasks ein.

| Parameter | Typ | Beschreibung |
|-----------|-----|-------------|
| `taskName` | `string` | Task der den Aufruf enthält |
| `calledTaskName` | `string` | Task der aufgerufen wird |

```typescript
agent.addTaskCall('MainGameLoop', 'CheckCollisions');
```

---

#### `setTaskTriggerMode(taskName, mode)`
Setzt den Ausführungsmodus eines Tasks.

| Parameter | Typ | Beschreibung |
|-----------|-----|-------------|
| `taskName` | `string` | Task-Name |
| `mode` | `string` | `'local-sync'`, `'local-async'`, `'broadcast'` |

```typescript
agent.setTaskTriggerMode('HandleBallBoundary', 'local-sync');
```

---

#### `addTaskParam(taskName, paramName, type, defaultValue)`
Definiert einen Eingangsparameter für einen Task.

| Parameter | Typ | Beschreibung |
|-----------|-----|-------------|
| `taskName` | `string` | Task-Name |
| `paramName` | `string` | Parameter-Name (z.B. `hitSide`) |
| `type` | `string` | `'string'`, `'number'`, `'boolean'` |
| `defaultValue` | `any` | Standardwert |

```typescript
agent.addTaskParam('HandleBallBoundary', 'hitSide', 'string', '');
```

---

### 2. Action-Management

#### `addAction(taskName, actionType, actionName, params?)`
Fügt eine Action zu einem Task hinzu. Erstellt die Action global falls nötig.

| Parameter | Typ | Beschreibung |
|-----------|-----|-------------|
| `taskName` | `string` | Ziel-Task |
| `actionType` | `ActionType` | Typ der Action (siehe Action-Katalog) |
| `actionName` | `string` | Eindeutiger Name |
| `params` | `object` | Typ-spezifische Parameter |

```typescript
// Property setzen
agent.addAction('ResetBallTask', 'property', 'ResetBall', {
    target: 'BallSprite',
    properties: { x: 32, y: 19, velocityX: 3, velocityY: 3 }
});

// Negate (Richtungsumkehr)
agent.addAction('HandleBallBoundary', 'negate', 'NegateBallY', {
    target: 'BallSprite',
    velocityY: true
});
```

---

#### `moveActionInSequence(taskName, fromIndex, toIndex)`
Ändert die Reihenfolge einer Action innerhalb eines Tasks.

| Parameter | Typ | Beschreibung |
|-----------|-----|-------------|
| `taskName` | `string` | Task |
| `fromIndex` | `number` | Aktuelle Position (0-basiert) |
| `toIndex` | `number` | Neue Position (0-basiert) |

```typescript
agent.moveActionInSequence('MyTask', 0, 2); // Erste Action an dritte Stelle
```

---

### 3. Branch-Management

#### `addBranch(taskName, variable, operator, value, thenFn, elseFn?)`
Fügt eine Verzweigung (Condition) zur Sequenz hinzu.

| Parameter | Typ | Beschreibung |
|-----------|-----|-------------|
| `taskName` | `string` | Ziel-Task |
| `variable` | `string` | Geprüfte Variable (z.B. `hitSide`) |
| `operator` | `string` | `==`, `!=`, `>`, `<`, `>=`, `<=` |
| `value` | `string \| number` | Vergleichswert |
| `thenFn` | `(branch) => void` | Then-Zweig Builder |
| `elseFn` | `(branch) => void` | Else-Zweig Builder (optional) |

```typescript
agent.addBranch('HandleBallBoundary', 'hitSide', '==', 'top',
    (then) => { then.addAction('NegateBallY'); },
    (els) => {
        agent.addBranch('HandleBallBoundary_Inner', 'hitSide', '==', 'left',
            (then2) => { then2.addAction('ResetBall'); }
        );
    }
);
```

---

### 4. Delete-Operationen

#### `deleteTask(taskName)`
Löscht einen Task und entfernt Event-Bindings.

#### `deleteAction(actionName)`
Löscht eine Action global und aus allen Task-Sequenzen.

#### `removeObject(stageId, objectName)`
Entfernt ein Objekt aus einer Stage.

#### `deleteStage(stageId)`
Löscht eine Stage (Blueprint geschützt!).

#### `deleteVariable(variableName)`
Löscht eine Variable.

---

### 5. Rename-Operationen

#### `renameTask(oldName, newName) → boolean`
Benennt einen Task um (inkl. aller Referenzen).

#### `renameAction(oldName, newName) → boolean`
Benennt eine Action um (inkl. aller Referenzen).

---

### 6. Read-Operationen (Inventar)

#### `listStages() → [{id, name, type, objectCount, taskCount}]`
Listet alle Stages mit Statistiken.

#### `listTasks(stageId?) → [{name, actionCount, triggerMode}]`
Listet Tasks auf (optional gefiltert nach Stage).

#### `listActions(stageId?) → [{name, type}]`
Listet Actions auf.

#### `listVariables(scope?) → [{name, type, value, scope}]`
Listet Variablen auf (`'global'` oder `'stage'`).

#### `listObjects(stageId) → [{name, className, x, y, visible}]`
Listet Objekte einer Stage.

#### `getTaskDetails(taskName) → {name, description, sequence, triggerMode}`
Gibt vollständige Task-Details zurück.

---

### 7. UI-Interaktion

#### `setProperty(stageId, objectName, property, value)`
Setzt eine Property. Unterstützt Dot-Notation.

```typescript
agent.setProperty('stage_main', 'ScoreLabel', 'caption', 'Score: 0');
agent.setProperty('stage_main', 'MyPanel', 'style.backgroundColor', '#1e1e2e');
```

#### `bindVariable(stageId, objectName, property, expression)`
Bindet eine Variable an eine Property.

```typescript
agent.bindVariable('stage_main', 'ScoreLabel', 'caption', 'score');
// Erzeugt: caption = "${score}"
```

#### `connectEvent(stageId, objectName, eventName, taskName)`
Verbindet ein Event mit einem Task.

```typescript
agent.connectEvent('stage_main', 'BallSprite', 'onBoundaryHit', 'HandleBallBoundary');
agent.connectEvent('stage_main', 'BallSprite', 'onCollision', 'HandlePaddleCollision');
agent.connectEvent('stage_main', 'StartButton', 'onClick', 'StartGame');
```

---

### 8. Workflow

#### `duplicateTask(taskName, newName, stageId?) → string`
Klont einen Task mit neuem Namen (inkl. FlowChart).

#### `generateTaskFlow(taskName)`
Regeneriert das visuelle FlowChart aus der Action-Sequenz.

---

### 9. Validierung

#### `validate() → [{level, message}]`
Prüft das Projekt auf Konsistenz. Gibt Fehler/Warnungen zurück.

**Geprüft:**
- Inline-Actions (verboten)
- Verwaiste Actions (definiert aber nie referenziert)
- Fehlende Action-Definitionen (referenziert aber nicht definiert)
- Tasks ohne FlowChart

```typescript
const issues = agent.validate();
issues.forEach(i => console.log(`[${i.level}] ${i.message}`));
```

---

## Action-Typ-Katalog

### `property` — Eigenschaften setzen
Ändert eine oder mehrere Eigenschaften eines Objekts.

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|-------------|
| `target` | `string` | ✅ | Objekt-Name oder `'self'`/`'other'` |
| `properties` | `object` | ✅ | Key-Value-Paare der Properties |

```typescript
agent.addAction('MyTask', 'property', 'ResetBall', {
    target: 'BallSprite',
    properties: { x: 32, y: 19, velocityX: 3, velocityY: 3 }
});
```

---

### `negate` — Richtungsumkehr
Negiert numerische Eigenschaften (× -1). Ideal für Ball-Abprall.

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|-------------|
| `target` | `string` | ✅ | Objekt-Name |
| `velocityX` | `boolean` | — | X-Geschwindigkeit negieren |
| `velocityY` | `boolean` | — | Y-Geschwindigkeit negieren |

```typescript
agent.addAction('BounceTask', 'negate', 'NegateBallX', {
    target: 'BallSprite',
    velocityX: true
});
```

---

### `variable` — Variable lesen/schreiben
Liest einen Wert aus einer Quelle und speichert ihn in einer Variable.

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|-------------|
| `target` | `string` | ✅ | Ziel-Variable |
| `source` | `string` | ✅ | Quell-Objekt oder `'self'`/`'other'` |
| `property` | `string` | — | Quell-Property |
| `value` | `any` | — | Fester Wert (statt source) |

---

### `set_variable` — Variable direkt setzen
Setzt eine Variable auf einen bestimmten Wert.

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|-------------|
| `target` | `string` | ✅ | Variablen-Name |
| `value` | `any` | ✅ | Neuer Wert |

---

### `increment` — Variable inkrementieren
Erhöht den Wert einer Variable.

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|-------------|
| `target` | `string` | ✅ | Variablen-Name |
| `amount` | `number` | ✅ | Betrag (kann negativ sein) |

---

### `calculate` — Berechnung ausführen
Mathematische Berechnung mit Variablen.

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|-------------|
| `target` | `string` | ✅ | Ziel-Variable |
| `formula` | `string` | — | Formel als String (z.B. `"score + 10"`) |
| `calcSteps` | `array` | — | Strukturierte Berechnungsschritte |

---

### `animate` — Property animieren
Animiert eine Eigenschaft über Zeit.

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|-------------|
| `target` | `string` | ✅ | Objekt-Name |
| `property` | `string` | ✅ | Zu animierende Property |
| `to` | `number` | ✅ | Zielwert |
| `duration` | `number` | ✅ | Dauer in ms |
| `easing` | `string` | — | `'linear'`, `'easeIn'`, `'easeOut'` |

---

### `navigate` — Zu anderem Projekt wechseln
Lädt ein anderes Spiel/Projekt.

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|-------------|
| `url` | `string` | ✅ | URL zum Projekt |

---

### `navigate_stage` — Stage wechseln
Wechselt zu einer anderen Stage innerhalb des Projekts.

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|-------------|
| `stageId` | `string` | ✅ | Ziel-Stage-ID |

---

### `call_method` — Methode aufrufen
Ruft eine Methode auf einem Objekt oder Service auf.

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|-------------|
| `target` | `string` | ✅ | Objekt/Service-Name |
| `method` | `string` | ✅ | Methoden-Name |
| `args` | `array` | — | Argumente |

---

### `audio` — Sound abspielen
Spielt eine Audio-Datei ab.

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|-------------|
| `src` | `string` | ✅ | Audio-URL |
| `volume` | `number` | — | Lautstärke (0-1) |

---

### `http` — API-Call ausführen
Führt einen REST/JSON API-Call aus.

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|-------------|
| `url` | `string` | ✅ | Endpoint-URL |
| `method` | `string` | — | `'GET'`, `'POST'`, etc. |
| `body` | `object` | — | Request-Body |
| `resultVariable` | `string` | — | Variable für Response |

---

### `data_action` — Datenbank-Operation
Führt eine Daten-Aktion aus (HTTP, SQL, etc.).

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|-------------|
| `source` | `string` | ✅ | Datenquelle |
| `operation` | `string` | ✅ | `'read'`, `'write'`, `'delete'` |
| `resultVariable` | `string` | — | Variable für Ergebnis |

---

### `broadcast` — Event senden
Sendet ein Event an alle Objekte.

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|-------------|
| `eventName` | `string` | ✅ | Event-Name |
| `data` | `object` | — | Payload |

---

### `service` — Service-Methode aufrufen
Ruft eine Methode eines registrierten Services auf.

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|-------------|
| `serviceName` | `string` | ✅ | Service-Name |
| `method` | `string` | ✅ | Methoden-Name |
| `params` | `any` | — | Parameter |

---

### Multiplayer-Actions

| Typ | Beschreibung |
|-----|-------------|
| `server_connect` | Verbindet zum Multiplayer-Server |
| `server_create_room` | Erstellt einen Multiplayer-Raum |
| `server_join_room` | Tritt einem Raum bei |
| `server_ready` | Signalisiert Spielbereitschaft |
| `smooth_sync` | Synchronisiert Sprite-Positionen |
| `send_multiplayer_sync` | Sendet Custom-Sync-Daten |

---

## Event-Katalog

### Objekt-Events
Diese Events werden auf Objekten ausgelöst und können per `connectEvent()` mit Tasks verbunden werden.

| Event | Auslöser | EventData | Typische Nutzung |
|-------|---------|-----------|-----------------|
| `onClick` | User klickt auf Objekt | `{}` | Buttons, interaktive Elemente |
| `onCollision` | Zwei Sprites kollidieren | `{self, other, hitSide}` | Ball-Paddle, Gegner-Treffer |
| `onCollisionTop` | Kollision von oben | `{other}` | Richtungsspezifisch |
| `onCollisionBottom` | Kollision von unten | `{other}` | Richtungsspezifisch |
| `onCollisionLeft` | Kollision von links | `{other}` | Richtungsspezifisch |
| `onCollisionRight` | Kollision von rechts | `{other}` | Richtungsspezifisch |
| `onBoundaryHit` | Sprite berührt Spielfeldrand | `{hitSide}` | Ball-Abprall, Aus-Erkennung |
| `onStart` | Runtime wird gestartet | `{}` | Initialisierung |
| `onFinish` | Splash-Screen beendet | `{}` | Übergang zum Spiel |
| `onKeyDown` | Taste gedrückt | `{key}` | Steuerung (via InputController) |
| `onKeyUp` | Taste losgelassen | `{key}` | Steuerung |

### Stage-Events
Diese Events werden auf der Stage selbst ausgelöst (nicht auf einzelnen Objekten).

| Event | Auslöser | Beschreibung |
|-------|---------|-------------|
| `onRuntimeStart` | Stage wird aktiv | Task wird ausgeführt wenn eine Stage geladen wird |
| `onEnter` | Stage betreten | Alternative zu onRuntimeStart |

### Variable-Events

| Event | Auslöser | Beschreibung |
|-------|---------|-------------|
| `onTimerEnd` | Timer-Variable erreicht 0 | Für Countdown-Logik |

### hitSide-Werte (bei onBoundaryHit)

| Wert | Bedeutung |
|------|-----------|
| `'top'` | Oberer Rand |
| `'bottom'` | Unterer Rand |
| `'left'` | Linker Rand |
| `'right'` | Rechter Rand |

---

## Komponenten-Katalog

### TSprite — Spielfigur/Ball/Paddle

```typescript
{
    name: 'BallSprite',
    className: 'TSprite',
    x: 32,                    // Grid-Position X (0-63)
    y: 19,                    // Grid-Position Y (0-39)
    width: 2,                 // Breite in Grid-Zellen
    height: 2,                // Höhe in Grid-Zellen
    velocityX: 3,             // Geschwindigkeit X (Grid-Zellen/Frame)
    velocityY: 3,             // Geschwindigkeit Y
    collisionEnabled: true,   // Kollisionserkennung aktiv
    collisionGroup: 'ball',   // Kollisionsgruppe
    visible: true,
    color: '#ff6b6b',         // Hintergrundfarbe
    borderRadius: '50%',      // Rund = Ball
    opacity: 1
}
```

### TLabel — Text-Anzeige

```typescript
{
    name: 'ScoreLabel',
    className: 'TLabel',
    x: 28, y: 1,
    width: 8, height: 2,
    caption: 'Score: 0',
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    visible: true
}
```

### TButton — Klickbarer Button

```typescript
{
    name: 'StartButton',
    className: 'TButton',
    x: 26, y: 18,
    width: 12, height: 4,
    caption: 'Start',
    fontSize: 20,
    color: '#ffffff',
    backgroundColor: '#4CAF50',
    borderRadius: '8px',
    visible: true
}
```

### TPanel — Container/Hintergrund

```typescript
{
    name: 'GameHeader',
    className: 'TPanel',
    x: 0, y: 0,
    width: 64, height: 3,
    color: 'transparent',
    backgroundColor: '#1a1a2e',
    visible: true
}
```

### TInputController — Tastatureingabe

```typescript
{
    name: 'InputController',
    className: 'TInputController',
    x: 0, y: 0,
    width: 1, height: 1,
    visible: false,
    keyBindings: {
        'ArrowUp': { target: 'RightPaddle', action: 'moveUp', speed: 2 },
        'ArrowDown': { target: 'RightPaddle', action: 'moveDown', speed: 2 },
        'w': { target: 'LeftPaddle', action: 'moveUp', speed: 2 },
        's': { target: 'LeftPaddle', action: 'moveDown', speed: 2 }
    }
}
```

### TStageController — Stage-Navigation

```typescript
{
    name: 'StageController',
    className: 'TStageController',
    x: 0, y: 0, width: 1, height: 1,
    visible: false
}
```

---

## Sprite-Shortcuts

Die `AgentShortcuts`-Klasse bietet vereinfachte Methoden für häufige Operationen.

### `createSprite(stageId, name, x, y, w, h, options?)`

```typescript
shortcuts.createSprite('stage_main', 'BallSprite', 32, 19, 2, 2, {
    velocityX: 3, velocityY: 3,
    collisionEnabled: true,
    color: '#ff6b6b',
    borderRadius: '50%'
});
```

### `createLabel(stageId, name, x, y, text, options?)`

```typescript
shortcuts.createLabel('stage_main', 'ScoreLabel', 28, 1, 'Score: 0', {
    fontSize: 18, fontWeight: 'bold', color: '#ffffff'
});
```

### `setSpriteVelocity(stageId, spriteName, vx, vy)`

```typescript
shortcuts.setSpriteVelocity('stage_main', 'BallSprite', 3, 3);
```

### `setSpriteCollision(stageId, spriteName, enabled, group?)`

```typescript
shortcuts.setSpriteCollision('stage_main', 'BallSprite', true, 'ball');
```

### `createBounceLogic(spriteName)`
Erstellt automatisch die komplette Abprall-Logik für einen Ball:
- NegateBallX/NegateBallY Actions
- HandleBoundary Task mit Condition-Branches
- Event-Binding für onBoundaryHit + onCollision

### `createScoreSystem(labelName, incrementAmount)`
Erstellt ein Score-System:
- Variable `score` (global)
- IncrementScore Action
- Binding des Labels an `${score}`

### `createPaddleControls(paddleName, speed, keys?)`
Erstellt Paddle-Steuerung:
- InputController mit Key-Bindings
- Default: W/S für links, Pfeiltasten für rechts

---

## HTTP-API

Alle AgentController-Methoden sind über einen HTTP-Endpoint erreichbar.

### Endpoint

```
POST /api/agent/:method
Content-Type: application/json
```

### Request-Format

```json
{
    "params": ["param1", "param2", { "key": "value" }]
}
```

### Response-Format

```json
{
    "success": true,
    "data": { ... },
    "error": null
}
```

### Beispiele

```bash
# Stages auflisten
curl -X POST http://localhost:3000/api/agent/listStages \
     -H "Content-Type: application/json" \
     -d '{"params": []}'

# Objekt erstellen
curl -X POST http://localhost:3000/api/agent/addObject \
     -H "Content-Type: application/json" \
     -d '{"params": ["stage_main", {"name":"Ball","className":"TSprite","x":32,"y":19}]}'

# Event verbinden
curl -X POST http://localhost:3000/api/agent/connectEvent \
     -H "Content-Type: application/json" \
     -d '{"params": ["stage_main", "Ball", "onCollision", "HandleCollision"]}'
```

### Batch-API (Transaktionen)

Mehrere Operationen atomar ausführen. Bei Fehler: **Rollback** — nichts wird gespeichert.

```
POST /api/agent/batch
Content-Type: application/json
```

#### Request

```json
{
    "operations": [
        { "method": "addVariable", "params": ["score", "number", 0] },
        { "method": "createTask", "params": ["stage_main", "ScoreTask"] },
        { "method": "addAction", "params": ["ScoreTask", "property", "ResetScore", { "target": "ScoreLabel", "properties": { "caption": "0" } }] },
        { "method": "connectEvent", "params": ["stage_main", "StartButton", "onClick", "ScoreTask"] }
    ]
}
```

#### Response

```json
{
    "success": true,
    "results": [
        { "method": "addVariable", "success": true, "data": null, "error": null },
        { "method": "createTask", "success": true, "data": "ScoreTask", "error": null },
        { "method": "addAction", "success": true, "data": null, "error": null },
        { "method": "connectEvent", "success": true, "data": null, "error": null }
    ],
    "rollback": false
}
```

#### Fehlerfall (Rollback)

```json
{
    "success": false,
    "results": [
        { "method": "addVariable", "success": true, "data": null, "error": null },
        { "method": "setTaskTriggerMode", "success": false, "data": null, "error": "Task 'NonExistent' not found." }
    ],
    "rollback": true
}
```

> **Wichtig:** Bei `rollback: true` wurden KEINE Änderungen gespeichert — das Projekt ist im Zustand vor dem Batch.

---

## WebSocket-API

Für Echtzeit-Kommunikation können KI-Agenten auch über WebSocket API-Calls machen.

### Verbindung

```javascript
const ws = new WebSocket('ws://localhost:8080');
```

### Request (agent_call)

```json
{
    "type": "agent_call",
    "method": "listStages",
    "params": [],
    "requestId": "req_001"
}
```

### Response (agent_result)

```json
{
    "type": "agent_result",
    "requestId": "req_001",
    "success": true,
    "data": [
        { "id": "stage_blueprint", "name": "Blueprint", "type": "blueprint", "objectCount": 2, "taskCount": 0 },
        { "id": "stage_main", "name": "Spielfeld", "type": "main", "objectCount": 5, "taskCount": 3 }
    ]
}
```

### Vorteile gegenüber HTTP

- **Echtzeit**: Kein Request/Response-Overhead
- **requestId**: Tracking mehrerer paralleler Aufrufe
- **Gleiche Methoden**: Alle `/api/agent/:method`-Methoden sind auch über WebSocket verfügbar

---

## KI-Prompt-Template

> Diesen Text kann eine KI als System-Prompt erhalten, um GCS-Spiele zu erstellen.

```
Du bist ein Spieleentwickler der das GCS (Game Creation System) verwendet.

VERFÜGBARE API:
- agent.createStage(id, name, type?) — Stage erstellen
- agent.addObject(stageId, objectData) — Objekt hinzufügen
- agent.addVariable(name, type, initialValue) — Variable anlegen
- agent.createTask(stageId, taskName, description?) — Task erstellen
- agent.addAction(taskName, actionType, actionName, params) — Action hinzufügen
- agent.addBranch(taskName, variable, operator, value, thenFn, elseFn?) — Bedingung
- agent.connectEvent(stageId, objectName, eventName, taskName) — Event binden
- agent.setProperty(stageId, objectName, property, value) — Property setzen
- agent.generateTaskFlow(taskName) — FlowChart generieren

REGELN:
1. Positionen sind in GRID-ZELLEN (64×40 Standard), nicht Pixel
2. Globale Actions/Variablen gehören in stage_blueprint
3. Keine Inline-Actions — nur Referenzen
4. Nach Task-Erstellung immer generateTaskFlow() aufrufen
5. Validiere am Ende mit agent.validate()

OBJECT-TYPEN:
- TSprite: Spielfigur (Ball, Paddle) mit velocityX/Y und Collision
- TLabel: Text-Anzeige (Score, Titel)
- TButton: Klickbar (Start, Menü)
- TPanel: Container/Hintergrund
- TInputController: Tastatureingabe (unsichtbar)

ACTION-TYPEN:
- property: Properties setzen (target + properties)
- negate: Werte umkehren (target + velocityX/Y)
- variable: Variable lesen/schreiben
- calculate: Berechnung (formula)
- navigate_stage: Stage wechseln (stageId)
- animate: Property animieren (target, property, to, duration)

EVENTS:
- onClick, onCollision, onBoundaryHit, onStart, onKeyDown
```

---

## Vollständiges Beispiel

### PingPong-Spiel erstellen

```typescript
const agent = AgentController.getInstance();

// === 1. STAGES ===
agent.createStage('stage_blueprint', 'Blueprint', 'blueprint');
agent.createStage('stage_main', 'Spielfeld');

// === 2. GLOBALE VARIABLEN ===
agent.addVariable('scoreLeft', 'number', 0);
agent.addVariable('scoreRight', 'number', 0);

// === 3. SPIELFELD-OBJEKTE ===
// Ball
agent.addObject('stage_main', {
    name: 'BallSprite', className: 'TSprite',
    x: 32, y: 19, width: 2, height: 2,
    velocityX: 3, velocityY: 3,
    collisionEnabled: true,
    color: '#ff6b6b', borderRadius: '50%'
});

// Linkes Paddle
agent.addObject('stage_main', {
    name: 'LeftPaddle', className: 'TSprite',
    x: 2, y: 15, width: 2, height: 10,
    collisionEnabled: true,
    color: '#4ecdc4'
});

// Rechtes Paddle
agent.addObject('stage_main', {
    name: 'RightPaddle', className: 'TSprite',
    x: 60, y: 15, width: 2, height: 10,
    collisionEnabled: true,
    color: '#45b7d1'
});

// Score Labels
agent.addObject('stage_main', {
    name: 'ScoreLeft', className: 'TLabel',
    x: 20, y: 1, width: 5, height: 2,
    caption: '0', fontSize: 24, color: '#ffffff'
});

agent.addObject('stage_main', {
    name: 'ScoreRight', className: 'TLabel',
    x: 39, y: 1, width: 5, height: 2,
    caption: '0', fontSize: 24, color: '#ffffff'
});

// Score-Bindings
agent.bindVariable('stage_main', 'ScoreLeft', 'caption', 'scoreLeft');
agent.bindVariable('stage_main', 'ScoreRight', 'caption', 'scoreRight');

// Input Controller (in Blueprint für globalen Zugriff)
agent.addObject('stage_blueprint', {
    name: 'InputController', className: 'TInputController',
    visible: false,
    keyBindings: {
        'w': { target: 'LeftPaddle', action: 'moveUp', speed: 2 },
        's': { target: 'LeftPaddle', action: 'moveDown', speed: 2 },
        'ArrowUp': { target: 'RightPaddle', action: 'moveUp', speed: 2 },
        'ArrowDown': { target: 'RightPaddle', action: 'moveDown', speed: 2 }
    }
});

// === 4. ACTIONS (alle global in Blueprint) ===
agent.addAction('_placeholder_', 'negate', 'NegateBallX', { target: 'BallSprite', velocityX: true });
agent.addAction('_placeholder_', 'negate', 'NegateBallY', { target: 'BallSprite', velocityY: true });
agent.addAction('_placeholder_', 'property', 'ResetBall', {
    target: 'BallSprite',
    properties: { x: 32, y: 19, velocityX: 3, velocityY: 3 }
});

// === 5. TASKS ===
// Paddle-Kollision: Ball-X umkehren
agent.createTask('stage_main', 'HandlePaddleCollision', 'Ball prallt an Paddles ab');
agent.addAction('HandlePaddleCollision', 'negate', 'NegateBallX', { target: 'BallSprite', velocityX: true });

// Wand-Kollision: Top/Bottom = Abprall, Left/Right = Reset
agent.createTask('stage_main', 'HandleBallBoundary', 'Ball-Begrenzungslogik');
agent.addTaskParam('HandleBallBoundary', 'hitSide', 'string', '');
agent.addBranch('HandleBallBoundary', 'hitSide', '==', 'top',
    (then) => { then.addAction('NegateBallY'); },
    (els) => {
        els.addAction('ResetBall'); // left/right = Punkt + Reset
    }
);

// FlowCharts generieren
agent.generateTaskFlow('HandlePaddleCollision');
agent.generateTaskFlow('HandleBallBoundary');

// === 6. EVENT-BINDINGS ===
agent.connectEvent('stage_main', 'BallSprite', 'onCollision', 'HandlePaddleCollision');
agent.connectEvent('stage_main', 'BallSprite', 'onBoundaryHit', 'HandleBallBoundary');

// === 7. VALIDIERUNG ===
const issues = agent.validate();
console.log('Validierung:', issues.length === 0 ? '✅ Keine Probleme' : issues);
```
