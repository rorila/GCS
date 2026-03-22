# GCS AgentController API-Referenz

> **Für KI-Agenten**: Diese Referenz + `ComponentSchema.json` sind alles was du brauchst.
> Nutze `getComponentSchema(className)` um Properties, Methoden und Events einer Komponente abzufragen.

## Projekt-Struktur

### createStage(id, name, type?)
Erstellt eine neue Stage.
```typescript
agent.createStage('stage_main', 'Countdown', 'standard');
```

### addObject(stageId, objectData)
Fügt ein Objekt zu einer Stage hinzu. Schema: siehe `ComponentSchema.json`.
```typescript
agent.addObject('stage_blueprint', {
  className: 'TGameLoop', name: 'GameLoop',
  x: 2, y: 2, width: 3, height: 1,
  isService: true, isHiddenInRun: true, targetFPS: 60,
  style: { backgroundColor: '#2196f3', borderColor: '#1565c0', borderWidth: 2, color: '#fff' }
});
```

### addVariable(name, type, initialValue, scope?)
Registriert eine globale Variable.
```typescript
agent.addVariable('Countdown', 'integer', 10);
```

---

## Task-Management

### createTask(stageId, taskName, description?)
Erstellt einen neuen Task in einer Stage.
```typescript
agent.createTask('stage_main', 'StartCountdown', 'Timer starten und Button deaktivieren');
```

### addAction(taskName, actionType, actionName, params)
Definiert eine Action global und fügt sie zum Task hinzu.
```typescript
// Property ändern
agent.addAction('StartCountdown', 'property', 'SpielStarten', {
  target: 'GameState', changes: { state: 'playing' }
});

// Methode aufrufen
agent.addAction('StartCountdown', 'call_method', 'TimerStarten', {
  target: 'CountdownTimer', method: 'timerStart'
});

// Berechnung
agent.addAction('OnTimerTick', 'calculate', 'CountdownReduzieren', {
  formula: 'Countdown - 1', resultVariable: 'Countdown'
});

// Vorzeichen umkehren
agent.addAction('HandleBounce', 'negate', 'BounceX', {
  target: 'Ball', changes: { velocityX: 1 }
});
```

### addTaskCall(taskName, calledTaskName)
Fügt einen Sub-Task-Aufruf ein.
```typescript
agent.addTaskCall('SpielStarten', 'NeueAufgabe');
```

### addBranch(taskName, variable, operator, value, thenFn, elseFn?)
Fügt eine Verzweigung (Condition) hinzu.
```typescript
agent.addBranch('Auswerten', 'OpCode', '==', 1,
  (then) => {
    then.addAction('AdditionDurchfuehren');
  },
  (else_) => {
    else_.addAction('SubtraktionDurchfuehren');
  }
);
```

### setTaskTriggerMode(taskName, mode)
Setzt den Ausführungsmodus (`local-sync`, `local`, `broadcast`).

### addTaskParam(taskName, paramName, type?, defaultValue?)
Definiert einen Task-Parameter.

---

## Events

### connectEvent(stageId, objectName, eventName, taskName)
Verbindet ein Object-Event mit einem Task.
```typescript
agent.connectEvent('stage_main', 'StartButton', 'onClick', 'StartCountdown');
agent.connectEvent('stage_main', 'CountdownTimer', 'onTimer', 'OnTimerTick');
agent.connectEvent('stage_main', 'CountdownTimer', 'onMaxIntervalReached', 'OnCountdownFinish');
```

---

## Properties & Bindings

### setProperty(stageId, objectName, property, value)
Setzt eine Property. Unterstützt Dot-Notation.
```typescript
agent.setProperty('stage_main', 'StartButton', 'enabled', false);
agent.setProperty('stage_main', 'Rakete', 'style.backgroundColor', '#ff0000');
```

### bindVariable(stageId, objectName, property, expression)
Bindet eine Variable an eine Property.
```typescript
agent.bindVariable('stage_main', 'CountdownLabel', 'text', 'Countdown');
// → setzt text = '${Countdown}'
```

---

## Flow & Validation

### generateTaskFlow(taskName)
Generiert FlowChart-Layout aus der ActionSequence.

### validate()
Prüft das Projekt auf Konsistenz. Gibt `{ level, message }[]` zurück.

---

## Lesen (Inventar)

| Methode | Rückgabe |
|---------|----------|
| `listStages()` | `{ id, name, type, objectCount, taskCount }[]` |
| `listTasks(stageId?)` | `{ name, actionCount, triggerMode }[]` |
| `listActions(stageId?)` | `{ name, type }[]` |
| `listObjects(stageId)` | `{ name, className, x, y, visible }[]` |
| `listVariables(scope?)` | `{ name, type, value, scope }[]` |
| `getTaskDetails(taskName)` | `{ name, description, sequence, triggerMode }` |

---

## Löschen & Umbenennen

| Methode | Beschreibung |
|---------|-------------|
| `deleteTask(name)` | Task + Event-Refs + Flow entfernen |
| `deleteAction(name)` | Action + Refs aus allen Sequenzen |
| `deleteStage(id)` | Stage entfernen (nicht Blueprint!) |
| `deleteVariable(name)` | Variable entfernen |
| `renameTask(old, new)` | Inkl. aller Referenzen |
| `renameAction(old, new)` | Inkl. aller Sequenz-Referenzen |
| `duplicateTask(name, newName)` | Task klonen |

---

## Batch-API

### executeBatch(operations)
Atomare Mehrfach-Operationen mit automatischem Rollback bei Fehler.
```typescript
agent.executeBatch([
  { method: 'createTask', params: ['stage_main', 'NeuerTask'] },
  { method: 'addAction', params: ['NeuerTask', 'property', 'Aktion1', { target: 'Ball', changes: { x: 10 } }] },
  { method: 'connectEvent', params: ['stage_main', 'StartButton', 'onClick', 'NeuerTask'] }
]);
```

---

## ⚠️ DO / DON'T (Lessons Learned)

| ❌ DON'T | ✅ DO |
|----------|------|
| `caption` bei TLabel/TButton | `text` verwenden |
| `start()` bei TTimer | `timerStart()` verwenden |
| Inline-Actions in JSON | `addAction()` verwenden |
| Projekt ohne TGameLoop | Immer TGameLoop + TGameState in Blueprint |
| `Countdown` als Binding | `${Countdown}` mit Dollar+Klammern |
| Timer ohne maxInterval | Wenn nötig, maxInterval explizit setzen |
| Actions in Blueprint (außer globale) | Spiel-Actions in MainStage |
