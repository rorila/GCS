# FEATURE_GAPS.md — Drei kritische Erweiterungen für GCS

> **Zielgruppe:** Entwickler, die diese drei Features eigenhändig implementieren.
> **Vorbedingung:** Vertrautheit mit `AgentController`, `TaskExecutor`, `ExpressionParser`, `ReactiveRuntime`, dem `ActionType`-Katalog (siehe `docs/AGENT_API_REFERENCE.md`).
> **Status:** ✅ **Implementiert** (25.04.2026) — Feature A, B und C sind vollständig umgesetzt und getestet (77 Tests). Siehe `AGENT_API_REFERENCE.md §10`.

---

## §0 Executive Summary

Drei Lücken im aktuellen System erzwingen Workarounds, die agent-generierten Code aufblähen und die API für Listen-/Grid-basierte Spiele (Memory, Inventar, Highscore, Galerie, Quiz) unhandlich machen:

| # | Feature | Effekt ohne | Effekt mit |
|:-:|:---|:---|:---|
| **A** | **Event-Context (`$event` + `self`)** | Pro Trigger eine eigene Task | Eine Task für N Trigger |
| **B** | **Collection-Actions (List/Map)** | 16 Einzel-Variablen statt 1 Map | Dynamische Datenstrukturen |
| **C** | **`TForEach`-Repeater** | Statisches Hardcoden von N Objekten | Deklarative, datengetriebene UI |

Diese drei sind **orthogonal**, **kombinierbar**, und **abwärtskompatibel** entworfen.

### Empfohlene Reihenfolge

1. **Feature A zuerst** — kleinster Eingriff, größter Hebel, blockiert nichts anderes.
2. **Feature B danach** — eigenständig, profitiert aber von A bei der Auflösung dynamischer Keys.
3. **Feature C zuletzt** — baut konzeptuell auf A (für `${item.*}`-Bindings) und B (für `source`-Daten) auf.

### Aufwandsschätzung (grob)

| Feature | Code-Änderung | Tests | Doku | Σ |
|:---|:---:|:---:|:---:|:---:|
| A: Event-Context | 1.5 PT | 0.5 PT | 0.5 PT | **2.5 PT** |
| B: Collection-Actions | 2 PT | 1 PT | 0.5 PT | **3.5 PT** |
| C: TForEach | 3 PT | 1 PT | 0.5 PT | **4.5 PT** |
| **Σ** | | | | **~10.5 PT** |

PT = Personentag (~6 produktive Stunden).

### Inhalt

- §1 — Konventionen (Backward-Compat, Naming, Fehler-Verhalten)
- §2 — Feature A: Event-Context
- §3 — Feature B: Collection-Actions
- §4 — Feature C: TForEach-Repeater
- §5 — End-to-End-Smoke-Test (Memory-Spiel)
- §6 — Glossar & Referenzen

---

## §1 Konventionen für alle drei Features

### §1.1 Backward-Compatibility-Doktrin

Alle drei Features **erweitern** das System ohne Bestehendes zu brechen:

- Existierende Tasks ohne `$event`/`self`-Use laufen unverändert.
- Existierende `params`-Strukturen werden nicht umbenannt.
- Neue ActionTypes ergänzen die Union, alte bleiben gültig.
- `TForEach` ist eine neue Komponente, keine Modifikation einer bestehenden.

### §1.2 Namens-Konventionen

- **Magic-Variablen** beginnen mit `$` (`$event`, `$index`, `$item`).
- **Self-Referenz** ist `self` (kein `$`-Prefix, etabliert in Branch-Builder als `${self.x}`).
- **Action-Typen** verwenden `snake_case` mit Subsystem-Prefix: `list_*`, `map_*`.
- **Component-ClassNames** bleiben in `T<PascalCase>`-Form (`TForEach`).

### §1.3 Fehler-Verhalten

- **Static-Time** (Builder/Validator): Fehler werfen `Error`-Exception in `AgentController`-Methoden.
- **Runtime** (Task-Ausführung): Fehler loggen via `console.error`, Default-Werte (`undefined`, `null`, `0`) setzen, damit Tasks nicht silent crashen.
- **Validator** (`agent.validate()`): Neue Issues mit Level `warning` oder `error` zurückgeben.

### §1.4 Test-Pyramide pro Feature

1. **Unit-Tests** für Einzel-Funktionen (Resolver, Action-Handler).
2. **Integration-Tests** über `TaskExecutor` mit echten Tasks.
3. **Smoke-Test** mit einem End-to-End-Beispiel (Memory-Spiel, sobald alle drei stehen).

---

## §2 Feature A — Event-Context (`$event` + `self`)

### §2.1 Problem-Statement

Aktuell weiß eine Task nicht, **wer** sie getriggert hat. Wenn 16 Karten alle dieselbe Task triggern sollen, muss aktuell pro Karte eine eigene Task erzeugt werden, um die Identität fest zu verdrahten:

```typescript
// HEUTE — pro Karte eine Task
agent.createTask('stage_blueprint', 'OnClickCard_0');
agent.addAction('OnClickCard_0', 'variable', 'SetId', { variableName: 'clickedId', value: '0' });
agent.addTaskCall('OnClickCard_0', 'HandleCardClick');
// ... × 16
```

### §2.2 Aktuelle Lage im Code

Es gibt bereits **partielle** Event-Daten-Übergabe:

- `addTaskParam(taskName, paramName, type)` (siehe `AgentController.ts`) — registriert benannte Parameter, aber bisher nur für Sprite-Kollisionen mit `hitSide`.
- `eventData.hitSide` (siehe `docs/AGENT_API_REFERENCE.md` §7.15) — wird beim `onBoundaryHit`-Event gesetzt.

→ Das **Konzept existiert**, ist aber nicht **universell**: `TButton.onClick`, `TTimer.onTimer`, `TEdit.onChange` haben kein dokumentiertes Event-Daten-Pattern.

### §2.3 Lösungs-Design

#### §2.3.1 Datenmodell `EventContext`

```typescript
// Neuer Typ in src/runtime/EventContext.ts
export interface EventContext {
  /** Welches Objekt das Event ausgelöst hat. */
  source: {
    name: string;        // z.B. 'Card_3'
    className: string;   // z.B. 'TButton'
    stageId: string;     // z.B. 'stage_main'
  };
  /** Welches Event ausgelöst wurde. */
  event: string;          // z.B. 'onClick'
  /** Event-spezifische Payload — Schema je Event-Typ. */
  data: Record<string, any>;
  /** Performance.now()-Timestamp beim Trigger. */
  timestamp: number;
}
```

**Event-spezifische `data`-Schemata** (nicht-erschöpfend):

| Event | `data`-Felder |
|:---|:---|
| `onClick` (TButton) | `{ x: number, y: number, button: 'left' \| 'right' }` |
| `onChange` (TEdit, TCheckbox) | `{ oldValue: any, newValue: any }` |
| `onKeyDown`/`onKeyUp` (TInputController) | `{ key: string, code: string, shift: bool, ctrl: bool }` |
| `onTimer` (TTimer, TIntervalTimer) | `{ tickCount: number }` |
| `onBoundaryHit` (TSprite) | `{ hitSide: 'top' \| 'right' \| 'bottom' \| 'left' }` |
| `onCollision` (TSprite) | `{ otherName: string, otherClassName: string }` |
| `onDragEnd` (UI-Drag) | `{ x: number, y: number, deltaX: number, deltaY: number }` |

#### §2.3.2 Lifecycle der `EventContext`-Variable

Die `EventContext` wird **nur während der Task-Ausführung** verfügbar gemacht — sie existiert nicht auf dem Projekt-Modell, sondern lebt im `TaskExecutor`-Stack-Frame.

```
Trigger (z.B. Card_3.onClick)
  ↓
TaskExecutor.execute(taskName, eventContext)
  ↓
  push(eventContext) auf Stack-Frame
  ↓
  ExpressionParser.resolve('${$event.source.name}', context)  →  'Card_3'
  ↓
  Action-Handler.execute(action, params, context)
  ↓
  pop(eventContext)
```

→ Subtasks (via `addTaskCall`) **erben** den EventContext (Stack-Vererbung), wenn nicht explizit überschrieben.

#### §2.3.3 `self`-Referenz

Innerhalb einer von Objekt `Card_3` getriggerten Task ist `${self.<prop>}` ein Alias für `${$event.source.<prop>}` und zusätzlich Zugriff auf **Live-Properties** des Objekts:

```typescript
// Beide sind äquivalent
'${self.name}'              // → 'Card_3'
'${$event.source.name}'     // → 'Card_3'

// Nur via self: Zugriff auf Live-Properties des Source-Objekts
'${self.x}'                 // → aktuelle X-Koordinate
'${self.text}'              // → aktueller Button-Text
'${self.style.backgroundColor}'  // → tiefer Property-Pfad
```

→ `self` ist ein **dynamischer Proxy** auf das Source-Objekt zur Laufzeit.

### §2.4 Konkrete Implementierungs-Schritte

#### §2.4.1 Schritt 1 — Typ-Definition (5 Min)

**Datei:** `src/runtime/EventContext.ts` (NEU)

```typescript
export interface EventContext {
  source: { name: string; className: string; stageId: string };
  event: string;
  data: Record<string, any>;
  timestamp: number;
}

export const EMPTY_EVENT_CONTEXT: EventContext = {
  source: { name: '__system__', className: '__system__', stageId: '__system__' },
  event: '__none__',
  data: {},
  timestamp: 0
};

export function buildEventContext(
  source: { name: string; className: string; stageId: string },
  event: string,
  data: Record<string, any> = {}
): EventContext {
  return { source, event, data, timestamp: performance.now() };
}
```

**Datei:** `src/model/types.ts` — Re-Export hinzufügen.

#### §2.4.2 Schritt 2 — `TaskExecutor` erweitern (~30 Min)

**Datei:** `src/runtime/TaskExecutor.ts`

Bestehende `execute(taskName, ...)`-Methode um optionalen `EventContext` ergänzen:

```typescript
// VORHER (vermutlich):
public execute(taskName: string, params?: Record<string, any>): Promise<void> { ... }

// NACHHER:
public execute(
  taskName: string,
  params?: Record<string, any>,
  eventContext?: EventContext
): Promise<void> {
  const ctx = this.buildExecutionContext(taskName, params, eventContext);
  // ... bisherige Logik, aber ctx enthält jetzt $event
}
```

**Wichtig:** Die `buildExecutionContext`-Methode muss `$event` als **reserved variable** in `ctx.vars` einsetzen und zusätzlich als Top-Level `ctx.eventContext`:

```typescript
private buildExecutionContext(taskName, params, eventContext): ExecutionContext {
  const ctx = { /* ... bestehende Felder ... */ };
  ctx.vars['$event'] = eventContext ?? EMPTY_EVENT_CONTEXT;
  ctx.eventContext = eventContext ?? EMPTY_EVENT_CONTEXT;
  return ctx;
}
```

#### §2.4.3 Schritt 3 — Event-Trigger erweitern (~45 Min)

Jeder Event-Auslöser muss den `EventContext` bauen und an `TaskExecutor.execute` weitergeben.

**Beispiel — Button-Click** (vermutlich in `src/components/buttons/TButton.ts` oder ähnlich):

```typescript
// VORHER:
private onMouseDown(e: MouseEvent): void {
  this.taskExecutor.execute(this.onClickTask);
}

// NACHHER:
private onMouseDown(e: MouseEvent): void {
  if (!this.onClickTask) return;
  const ctx = buildEventContext(
    { name: this.name, className: 'TButton', stageId: this.stageId },
    'onClick',
    { x: e.offsetX, y: e.offsetY, button: e.button === 0 ? 'left' : 'right' }
  );
  this.taskExecutor.execute(this.onClickTask, undefined, ctx);
}
```

**Diese Änderung muss in jedem Event-Auslöser erfolgen.** Liste der Auslöser, die ich im Code vermute (Pfade prüfen):

| Komponente | Datei (vermutet) | Events |
|:---|:---|:---|
| `TButton` | `src/components/.../TButton.ts` | `onClick` |
| `TEdit`, `TNumberInput` | `src/components/.../TEdit.ts` | `onChange`, `onFocus`, `onBlur` |
| `TCheckbox`, `TDropdown` | `src/components/.../*` | `onChange` |
| `TTimer`, `TIntervalTimer` | `src/components/.../TTimer.ts` | `onTimer` |
| `TInputController` | `src/components/.../TInputController.ts` | `onKeyDown`, `onKeyUp` |
| `TSprite` | `GameLoopManager.ts` | `onCollision`, `onBoundaryHit` |

→ **Tipp:** Den `buildEventContext`-Helper aus §2.4.1 nutzen, damit nicht jeder Auslöser das Boilerplate kopiert.

#### §2.4.4 Schritt 4 — `ExpressionParser` erweitern (~1 h)

**Datei:** `src/runtime/ExpressionParser.ts`

Der Parser muss `${$event.*}` und `${self.*}` als spezielle Pfade auflösen.

Pseudocode-Erweiterung:

```typescript
public resolve(expr: string, ctx: ExecutionContext): any {
  // ... bestehender Parser-Eintritt, der ${...}-Token extrahiert ...

  // NEU: Magic-Variable $event
  if (path.startsWith('$event.')) {
    return this.resolveDeepPath(ctx.eventContext, path.slice(7));
  }
  if (path === '$event') return ctx.eventContext;

  // NEU: Magic-Variable self
  if (path === 'self' || path.startsWith('self.')) {
    const sourceName = ctx.eventContext.source.name;
    const stageId = ctx.eventContext.source.stageId;
    const obj = this.runtimeStageManager.getObject(stageId, sourceName);
    if (!obj) return undefined;
    if (path === 'self') return obj;
    return this.resolveDeepPath(obj, path.slice(5));
  }

  // ... bestehende Auflösung für ${var}, ${Comp.prop}, etc. ...
}

private resolveDeepPath(root: any, path: string): any {
  return path.split('.').reduce((acc, key) => acc?.[key], root);
}
```

**Edge-Cases:**

- `${$event}` ohne Pfad → liefert das ganze EventContext-Objekt (Debug-nützlich).
- `${self}` ohne Pfad → liefert das Source-Objekt.
- `${self.x}` während die Komponente entfernt wurde → `undefined`, Warning loggen.
- `${$event.data.foo.bar}` mit fehlendem Pfad → `undefined`, **kein** Crash.

#### §2.4.5 Schritt 5 — `addTaskCall`-Vererbung (~15 Min)

**Datei:** `src/runtime/TaskExecutor.ts` (oder wo `task_call` gehandhabt wird)

Wenn eine Task eine andere Task aufruft, muss der `EventContext` mitvererbt werden:

```typescript
// Im task_call-Handler:
async function handleTaskCall(action, ctx) {
  const calleeName = action.params.taskName;
  // EventContext aus aktuellem Scope mitnehmen:
  await this.taskExecutor.execute(calleeName, action.params.params, ctx.eventContext);
}
```

→ **Optional v2:** Aufrufer kann den Context auch **explizit überschreiben** via `addTaskCall(..., { withEvent: customEventContext })`. Nicht in v1 nötig.

#### §2.4.6 Schritt 6 — Reserved-Names im Validator (~10 Min)

**Datei:** `src/services/AgentController.ts` — Methoden `addVariable`, `validate`.

```typescript
const RESERVED_NAMES = new Set(['$event', 'self', '$index', '$item']);

// In addVariable:
if (RESERVED_NAMES.has(variable.name)) {
  throw new Error(`Variable name '${variable.name}' is reserved.`);
}
```

→ Verhindert, dass User eigene Variablen mit Magic-Namen anlegen.

### §2.5 Builder-API — keine Änderung nötig

Der `AgentController` braucht **keine** neuen Methoden. Magic-Strings werden vom `ExpressionParser` zur Laufzeit aufgelöst:

```typescript
// Funktioniert automatisch nach §2.4:
agent.addAction('HandleCardClick', 'variable', 'GrabId', {
  variableName: 'clickedCardId',
  value: '${$event.source.name}'   // ← wird zur Laufzeit aufgelöst
});

agent.addAction('HandleCardClick', 'property', 'HighlightCard', {
  target: '${self.name}',          // ← Selbst-Referenz
  property: 'style.borderColor',
  value: '#ff0'
});
```

### §2.6 Test-Cases

#### §2.6.1 Unit-Tests für `ExpressionParser`

**Datei:** `src/runtime/ExpressionParser.test.ts` (existiert bereits)

```typescript
describe('EventContext-Resolution', () => {
  it('resolves $event.source.name', () => {
    const ctx = mockContext({ source: { name: 'Card_3', className: 'TButton', stageId: 's1' }});
    expect(parser.resolve('${$event.source.name}', ctx)).toBe('Card_3');
  });

  it('resolves $event.data.x', () => {
    const ctx = mockContext({ data: { x: 42, y: 10 } });
    expect(parser.resolve('${$event.data.x}', ctx)).toBe(42);
  });

  it('resolves self.x via RuntimeStageManager', () => {
    stageManager.addObject('s1', { name: 'Card_3', className: 'TButton', x: 5 });
    const ctx = mockContext({ source: { name: 'Card_3', stageId: 's1' } });
    expect(parser.resolve('${self.x}', ctx)).toBe(5);
  });

  it('returns undefined for missing self property', () => {
    expect(parser.resolve('${self.nonexistent}', emptyCtx)).toBeUndefined();
  });

  it('does not crash on $event with empty context', () => {
    expect(() => parser.resolve('${$event.source.name}', emptyCtx)).not.toThrow();
  });
});
```

#### §2.6.2 Integration-Test mit `TaskExecutor`

```typescript
it('passes EventContext through task chain', async () => {
  agent.createTask('s1', 'TaskA');
  agent.addAction('TaskA', 'variable', 'Save', {
    variableName: 'capturedName',
    value: '${$event.source.name}'
  });
  agent.addTaskCall('TaskA', 'TaskB');

  agent.createTask('s1', 'TaskB');
  agent.addAction('TaskB', 'variable', 'Save', {
    variableName: 'capturedNameInB',
    value: '${$event.source.name}'   // muss vererbt sein
  });

  const ctx = buildEventContext({ name: 'X', className: 'TButton', stageId: 's1' }, 'onClick');
  await taskExecutor.execute('TaskA', undefined, ctx);

  expect(varManager.get('capturedName')).toBe('X');
  expect(varManager.get('capturedNameInB')).toBe('X');  // vererbt
});
```

#### §2.6.3 Validator-Test

```typescript
it('rejects reserved variable names', () => {
  expect(() => agent.addVariable('s1', '$event', 'string', '')).toThrow(/reserved/);
  expect(() => agent.addVariable('s1', 'self', 'string', '')).toThrow(/reserved/);
});
```

### §2.7 Doku-Updates

Nach Implementierung:

1. **`docs/AGENT_API_REFERENCE.md` §3.2** — `addTaskParam` als optional markieren, weil `$event` jetzt der präferierte Mechanismus ist. Note: `addTaskParam` bleibt für typisierte, erwartete Parameter erhalten.
2. **`docs/AGENT_API_REFERENCE.md` §4** — Bei jedem ActionType im `params`-Block dokumentieren, dass `${$event.*}` und `${self.*}` als dynamische Werte zulässig sind.
3. **`docs/AGENT_API_REFERENCE.md` §5** — Bei jedem Komponenten-Steckbrief im `events`-Block das `data`-Schema des Events ergänzen (siehe Tabelle in §2.3.1).
4. **`docs/AGENT_API_REFERENCE.md` §6** — Neues Rezept: *„Rezept #16: Generic Click Handler mit `$event`"*.
5. **`docs/AGENT_API_REFERENCE.md` §7** — Anti-Pattern „16 Tasks für 16 Karten" hinzufügen, mit Verweis auf `$event`.

### §2.8 Akzeptanzkriterien

- [ ] `${$event.source.name}` wird in jedem ActionType-`params`-Wert korrekt aufgelöst.
- [ ] `${self.<prop>}` liefert Live-Werte des triggernden Objekts.
- [ ] Subtasks (via `addTaskCall`) erben den EventContext.
- [ ] Tasks ohne Event-Trigger (z.B. `onLoadActions`) bekommen `EMPTY_EVENT_CONTEXT`.
- [ ] Variablen mit Namen `$event` oder `self` werden vom `AgentController` abgelehnt.
- [ ] Alle 6+ Event-Auslöser-Klassen aus §2.4.3 setzen den EventContext korrekt.
- [ ] Bestehende Tests (CoordinateBinding, ExpressionParser, ReactiveRuntime) laufen weiter grün.
- [ ] Memory-Spiel-Smoke-Test (siehe §5) läuft mit **einer** Click-Handler-Task statt 16.

---
## §3 Feature B — Collection-Actions (List & Map)

### §3.1 Problem-Statement

`TListVariable` und `TStringMap` sind als **Datentypen** registriert, aber es gibt **keine ActionTypes**, um sie zur Laufzeit zu manipulieren oder zu lesen. User können Daten deklarieren, aber nicht dynamisch zugreifen.

### §3.2 Aktuelle Lage im Code

- `TListVariable` und `TStringMap` definiert in `docs/schemas/schema_variables.json`.
- `RuntimeVariableManager.ts` (20 KB) verwaltet Variablen — vermutlich existiert dort schon Code für List- und Map-Operationen, aber **nicht über ActionTypes erreichbar**.
- `${Theme.bg}` als Map-Lookup im Property-Binding ist in §6.15 dokumentiert — **statischer Key**, nicht dynamisch.

### §3.3 Lösungs-Design — 14 neue ActionTypes

| ActionType | Zweck | Pflicht-Params | Optional |
|:---|:---|:---|:---|
| `list_push` | Item ans Ende anhängen | `target`, `value` | — |
| `list_pop` | Letztes Item entfernen + speichern | `target`, `resultVariable` | — |
| `list_get` | Item bei Index lesen | `target`, `index`, `resultVariable` | `defaultValue` |
| `list_set` | Item bei Index schreiben | `target`, `index`, `value` | — |
| `list_remove` | Item bei Index entfernen | `target`, `index` | — |
| `list_clear` | Alle Items entfernen | `target` | — |
| `list_shuffle` | Fisher-Yates in-place | `target` | `seed` |
| `list_contains` | Boolean-Test | `target`, `value`, `resultVariable` | — |
| `list_length` | Anzahl Items | `target`, `resultVariable` | — |
| `map_get` | Wert bei Key lesen | `target`, `key`, `resultVariable` | `defaultValue` |
| `map_set` | Wert bei Key schreiben | `target`, `key`, `value` | — |
| `map_delete` | Eintrag entfernen | `target`, `key` | — |
| `map_has` | Boolean-Test | `target`, `key`, `resultVariable` | — |
| `map_keys` | Alle Keys als Liste | `target`, `resultVariable` | — |

### §3.4 ActionType-Definitionen im Detail

#### §3.4.1 Type-Erweiterung

**Datei:** `src/model/types.ts` — ActionType-Union erweitern.

```typescript
type ActionType =
  | 'property' | 'variable' | 'calculate' | /* ... bestehende ... */
  // List-Actions:
  | 'list_push' | 'list_pop' | 'list_get' | 'list_set'
  | 'list_remove' | 'list_clear' | 'list_shuffle'
  | 'list_contains' | 'list_length'
  // Map-Actions:
  | 'map_get' | 'map_set' | 'map_delete' | 'map_has' | 'map_keys';
```

**Interfaces (Auszug — Schema-Pattern für alle Actions identisch):**

```typescript
export interface ListPushAction extends BaseAction {
  type: 'list_push';
  params: {
    target: string;        // Variable-Name oder ${var}
    value: unknown;        // Literal oder ${var}
  };
}

export interface ListGetAction extends BaseAction {
  type: 'list_get';
  params: {
    target: string;            // List-Variable
    index: number | string;    // Number oder ${var}
    resultVariable: string;    // Wohin schreiben
    defaultValue?: unknown;    // bei out-of-bounds
  };
}

export interface ListShuffleAction extends BaseAction {
  type: 'list_shuffle';
  params: {
    target: string;
    seed?: number | string;    // Optional: deterministischer Seed
  };
}

export interface MapGetAction extends BaseAction {
  type: 'map_get';
  params: {
    target: string;            // Map-Variable
    key: string;               // Key (kann ${var} sein!)
    resultVariable: string;
    defaultValue?: unknown;
  };
}

// ... analog für die restlichen
```

#### §3.4.2 Handler-Implementierung

**Datei:** `src/runtime/actions/handlers/CollectionActions.ts` (NEU)

Skelett für alle Handler nach demselben Muster:

```typescript
import { ActionRegistry } from '../../ActionRegistry';
import { RuntimeVariableManager } from '../../RuntimeVariableManager';
import { ExpressionParser } from '../../ExpressionParser';

export function registerCollectionActions(
  registry: ActionRegistry,
  varManager: RuntimeVariableManager,
  parser: ExpressionParser
): void {

  // ─── list_push ─────────────────────────────────────────
  registry.register('list_push', async (action, ctx) => {
    const targetName = parser.resolve(action.params.target, ctx);
    const value = parser.resolve(action.params.value, ctx);
    const list = varManager.get(targetName);
    if (!Array.isArray(list)) {
      console.warn(`list_push: '${targetName}' is not a list`);
      return;
    }
    list.push(value);
    varManager.set(targetName, list);  // triggert Reactive-Updates
  });

  // ─── list_pop ──────────────────────────────────────────
  registry.register('list_pop', async (action, ctx) => {
    const targetName = parser.resolve(action.params.target, ctx);
    const resultName = action.params.resultVariable;
    const list = varManager.get(targetName);
    if (!Array.isArray(list)) return;
    const popped = list.pop();
    varManager.set(targetName, list);
    if (resultName) varManager.set(resultName, popped);
  });

  // ─── list_get ──────────────────────────────────────────
  registry.register('list_get', async (action, ctx) => {
    const targetName = parser.resolve(action.params.target, ctx);
    const index = Number(parser.resolve(action.params.index, ctx));
    const resultName = action.params.resultVariable;
    const list = varManager.get(targetName);
    if (!Array.isArray(list)) return;
    const value = (index >= 0 && index < list.length)
      ? list[index]
      : (action.params.defaultValue ?? undefined);
    varManager.set(resultName, value);
  });

  // ─── list_set ──────────────────────────────────────────
  registry.register('list_set', async (action, ctx) => {
    const targetName = parser.resolve(action.params.target, ctx);
    const index = Number(parser.resolve(action.params.index, ctx));
    const value = parser.resolve(action.params.value, ctx);
    const list = varManager.get(targetName);
    if (!Array.isArray(list)) return;
    list[index] = value;
    varManager.set(targetName, list);
  });

  // ─── list_remove ───────────────────────────────────────
  registry.register('list_remove', async (action, ctx) => {
    const targetName = parser.resolve(action.params.target, ctx);
    const index = Number(parser.resolve(action.params.index, ctx));
    const list = varManager.get(targetName);
    if (!Array.isArray(list)) return;
    if (index < 0 || index >= list.length) return;
    list.splice(index, 1);
    varManager.set(targetName, list);
  });

  // ─── list_clear ────────────────────────────────────────
  registry.register('list_clear', async (action, ctx) => {
    const targetName = parser.resolve(action.params.target, ctx);
    varManager.set(targetName, []);
  });

  // ─── list_shuffle (Fisher-Yates) ───────────────────────
  registry.register('list_shuffle', async (action, ctx) => {
    const targetName = parser.resolve(action.params.target, ctx);
    const list = varManager.get(targetName);
    if (!Array.isArray(list)) return;
    const seed = action.params.seed
      ? Number(parser.resolve(String(action.params.seed), ctx))
      : undefined;
    const rng = seed !== undefined ? mulberry32(seed) : Math.random;
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    varManager.set(targetName, list);
  });

  // ─── list_contains ─────────────────────────────────────
  registry.register('list_contains', async (action, ctx) => {
    const targetName = parser.resolve(action.params.target, ctx);
    const value = parser.resolve(action.params.value, ctx);
    const resultName = action.params.resultVariable;
    const list = varManager.get(targetName);
    const found = Array.isArray(list) && list.includes(value);
    varManager.set(resultName, found);
  });

  // ─── list_length ───────────────────────────────────────
  registry.register('list_length', async (action, ctx) => {
    const targetName = parser.resolve(action.params.target, ctx);
    const resultName = action.params.resultVariable;
    const list = varManager.get(targetName);
    varManager.set(resultName, Array.isArray(list) ? list.length : 0);
  });

  // ─── map_get ───────────────────────────────────────────
  registry.register('map_get', async (action, ctx) => {
    const targetName = parser.resolve(action.params.target, ctx);
    const key = String(parser.resolve(action.params.key, ctx));
    const resultName = action.params.resultVariable;
    const map = varManager.get(targetName);
    const value = (map && typeof map === 'object' && key in map)
      ? map[key]
      : (action.params.defaultValue ?? undefined);
    varManager.set(resultName, value);
  });

  // ─── map_set ───────────────────────────────────────────
  registry.register('map_set', async (action, ctx) => {
    const targetName = parser.resolve(action.params.target, ctx);
    const key = String(parser.resolve(action.params.key, ctx));
    const value = parser.resolve(action.params.value, ctx);
    let map = varManager.get(targetName);
    if (!map || typeof map !== 'object') map = {};
    map[key] = value;
    varManager.set(targetName, map);
  });

  // ─── map_delete ────────────────────────────────────────
  registry.register('map_delete', async (action, ctx) => {
    const targetName = parser.resolve(action.params.target, ctx);
    const key = String(parser.resolve(action.params.key, ctx));
    const map = varManager.get(targetName);
    if (!map || typeof map !== 'object') return;
    delete map[key];
    varManager.set(targetName, map);
  });

  // ─── map_has ───────────────────────────────────────────
  registry.register('map_has', async (action, ctx) => {
    const targetName = parser.resolve(action.params.target, ctx);
    const key = String(parser.resolve(action.params.key, ctx));
    const resultName = action.params.resultVariable;
    const map = varManager.get(targetName);
    const has = !!(map && typeof map === 'object' && key in map);
    varManager.set(resultName, has);
  });

  // ─── map_keys ──────────────────────────────────────────
  registry.register('map_keys', async (action, ctx) => {
    const targetName = parser.resolve(action.params.target, ctx);
    const resultName = action.params.resultVariable;
    const map = varManager.get(targetName);
    const keys = (map && typeof map === 'object') ? Object.keys(map) : [];
    varManager.set(resultName, keys);
  });
}

// Mulberry32 PRNG — deterministischer Seed-Generator (32-bit)
function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

#### §3.4.3 Registrierung im `ActionRegistry`

**Datei:** `src/runtime/actions/StandardActions.ts` (existiert bereits)

```typescript
import { registerCollectionActions } from './handlers/CollectionActions';

export function registerStandardActions(...) {
  // ... bestehende:
  registerVariableActions(...);
  registerPropertyActions(...);
  registerCalculateActions(...);
  // ... NEU:
  registerCollectionActions(registry, varManager, parser);
}
```

### §3.5 AgentController-Validierung

**Datei:** `src/services/AgentController.ts`

Die `addAction(taskName, type, name, params)`-Methode prüft, ob `type` ein bekannter ActionType ist. Mit der erweiterten Union (§3.4.1) sind die neuen Typen automatisch erlaubt.

**Optional aber empfohlen** — Pflicht-Param-Validierung:

```typescript
const REQUIRED_PARAMS: Record<ActionType, string[]> = {
  // bestehende:
  'property': ['target', 'property', 'value'],
  'variable': ['variableName'],
  // NEU:
  'list_push':     ['target', 'value'],
  'list_pop':      ['target'],
  'list_get':      ['target', 'index', 'resultVariable'],
  'list_set':      ['target', 'index', 'value'],
  'list_remove':   ['target', 'index'],
  'list_clear':    ['target'],
  'list_shuffle':  ['target'],
  'list_contains': ['target', 'value', 'resultVariable'],
  'list_length':   ['target', 'resultVariable'],
  'map_get':       ['target', 'key', 'resultVariable'],
  'map_set':       ['target', 'key', 'value'],
  'map_delete':    ['target', 'key'],
  'map_has':       ['target', 'key', 'resultVariable'],
  'map_keys':      ['target', 'resultVariable'],
};

// In addAction:
const required = REQUIRED_PARAMS[type] ?? [];
for (const p of required) {
  if (!(p in params)) throw new Error(`Action '${type}' requires param '${p}'`);
}
```

### §3.6 Dynamischer Map-Lookup in Bindings (Bonus)

**Optional, aber sehr nützlich:** Erweitere den `ExpressionParser`, sodass `${MapVar[${dynamicKey}]}` aufgelöst werden kann:

```typescript
// In ExpressionParser.ts:
const BRACKET_RE = /^([a-zA-Z_]\w*)\[([^\]]+)\]$/;

public resolve(expr: string, ctx: ExecutionContext): any {
  // ... bestehender Parser ...

  const m = path.match(BRACKET_RE);
  if (m) {
    const [, mapName, keyExpr] = m;
    const map = ctx.vars[mapName];
    const key = this.resolve('${' + keyExpr + '}', ctx);  // rekursiv
    return map?.[key];
  }
}
```

→ Ermöglicht `${CardValues[${$event.source.name}]}` direkt in Bindings.

### §3.7 Test-Cases

**Datei:** `src/runtime/actions/handlers/CollectionActions.test.ts` (NEU)

```typescript
describe('list_push / list_pop', () => {
  it('appends and removes', async () => {
    varManager.set('myList', []);
    await execute({ type: 'list_push', params: { target: 'myList', value: 'a' } });
    await execute({ type: 'list_push', params: { target: 'myList', value: 'b' } });
    expect(varManager.get('myList')).toEqual(['a', 'b']);

    await execute({ type: 'list_pop', params: { target: 'myList', resultVariable: 'r' } });
    expect(varManager.get('r')).toBe('b');
    expect(varManager.get('myList')).toEqual(['a']);
  });
});

describe('list_shuffle (deterministic with seed)', () => {
  it('shuffles deterministically with same seed', async () => {
    varManager.set('a', [1, 2, 3, 4, 5]);
    varManager.set('b', [1, 2, 3, 4, 5]);
    await execute({ type: 'list_shuffle', params: { target: 'a', seed: 42 } });
    await execute({ type: 'list_shuffle', params: { target: 'b', seed: 42 } });
    expect(varManager.get('a')).toEqual(varManager.get('b'));
  });
});

describe('map_get / map_set', () => {
  it('round-trips values', async () => {
    varManager.set('m', {});
    await execute({ type: 'map_set', params: { target: 'm', key: 'x', value: 42 } });
    await execute({ type: 'map_get', params: { target: 'm', key: 'x', resultVariable: 'r' } });
    expect(varManager.get('r')).toBe(42);
  });

  it('uses defaultValue on missing key', async () => {
    varManager.set('m', {});
    await execute({ type: 'map_get', params: { target: 'm', key: 'missing', resultVariable: 'r', defaultValue: 'fallback' } });
    expect(varManager.get('r')).toBe('fallback');
  });

  it('resolves dynamic key from $event', async () => {
    varManager.set('m', { Card_3: 'apple' });
    const ctx = mockContext({ source: { name: 'Card_3' } });
    await execute(
      { type: 'map_get', params: { target: 'm', key: '${$event.source.name}', resultVariable: 'r' } },
      ctx
    );
    expect(varManager.get('r')).toBe('apple');
  });
});
```

### §3.8 Doku-Updates

1. **`docs/AGENT_API_REFERENCE.md` §4** — 14 neue Steckbriefe ergänzen (Tabelle + Detail-Block).
2. **`docs/AGENT_API_REFERENCE.md` §5.H** (Variablen) — `TListVariable` und `TStringMap` mit konkreten Action-Beispielen ergänzen.
3. **`docs/AGENT_API_REFERENCE.md` §6** — Neues Rezept *„Rezept #17: Liste shuffeln und iterieren"*.
4. **`docs/schemas/schema_base.json`** — `actionTypes`-Section um die 14 neuen Typen erweitern.

### §3.9 Akzeptanzkriterien

- [ ] Alle 14 ActionTypes registriert und dispatchbar.
- [ ] `varManager.set(...)` löst Reactive-Updates aus (PropertyWatcher etc.).
- [ ] `map_get` mit `${$event.source.name}` als Key funktioniert (kombiniert mit Feature A).
- [ ] `list_shuffle` mit `seed` ist deterministisch.
- [ ] Out-of-Bounds bei `list_get` liefert `defaultValue` statt zu crashen.
- [ ] Validator wirft Fehler bei fehlenden Pflicht-Params.
- [ ] Bestehende `variable`/`property`-Actions unverändert.

---
## §4 Feature C — `TForEach`-Repeater

### §4.1 Problem-Statement

Eine deklarative Komponente fehlt, die ein **Template** über eine **Datenquelle** iteriert. Aktuell muss jedes Listen-Item (16 Memory-Karten, 10 Inventar-Slots, N Highscore-Einträge) einzeln im Builder-Skript per `addObject` erzeugt werden. Bei datengetriebener UI (z.B. dynamisch wachsende Highscore-Liste) ist das praktisch unmöglich, weil `addObject` eine Builder-API ist und nicht zur Laufzeit aufrufbar.

### §4.2 Konzeptioneller Vergleich

| Framework | Äquivalent |
|:---|:---|
| Vue.js | `v-for="item in items"` |
| React | `items.map(item => <Card .../>)` |
| Angular | `*ngFor="let item of items"` |
| Svelte | `{#each items as item}` |

`TForEach` bringt diese deklarative Idee in das GCS-Komponenten-Modell.

### §4.3 Schema-Definition

**Datei:** `docs/schemas/schema_containers.json` — erweitern um:

```json
{
  "TForEach": {
    "category": "container",
    "description": "Iteriert ein Template über eine Datenquelle (List oder Map). Erzeugt zur Laufzeit pro Item ein Kind-Objekt aus dem Template. Reagiert reaktiv auf Datenquelle-Änderungen.",
    "properties": {
      "x": "number", "y": "number", "width": "number", "height": "number",
      "source": {
        "type": "string",
        "description": "Name einer TListVariable oder TStringMap"
      },
      "layout": {
        "type": "string",
        "enum": ["grid", "horizontal", "vertical", "absolute"],
        "default": "grid"
      },
      "cols": { "type": "integer", "description": "Anzahl Spalten (nur layout='grid')" },
      "rows": { "type": "integer", "description": "Anzahl Zeilen (nur layout='grid'). Wenn beide gesetzt: cols × rows ist hartes Limit." },
      "gap": { "type": "number", "default": 0, "description": "Abstand zwischen Items in Grid-Cells" },
      "itemWidth": { "type": "number", "description": "Breite pro Item-Cell. Default: berechnet aus width/cols" },
      "itemHeight": { "type": "number" },
      "template": {
        "type": "object",
        "description": "Komponenten-Template wie ein normales Objekt, aber mit ${index}- und ${item.*}-Bindings"
      },
      "namePattern": {
        "type": "string",
        "default": "${name}_${index}",
        "description": "Pattern für Auto-Naming der gespawnten Items"
      },
      "emptyMessage": {
        "type": "string",
        "description": "Optional: Text/Komponente bei leerer Datenquelle"
      }
    },
    "events": {
      "onItemSpawn": "Feuert, wenn ein neues Item angelegt wird (data.index, data.itemName)",
      "onItemDestroy": "Feuert, wenn ein Item entfernt wird"
    },
    "warnings": [
      "Template-Objekte dürfen keine festen Namen haben — Naming erfolgt automatisch via namePattern.",
      "Subscribed auf source via ReactiveRuntime: jede Änderung der Liste/Map triggert Re-Render.",
      "Bei großen Listen (>100 Items) kann Layout-Berechnung teuer werden — ggf. Virtualisierung als V2."
    ],
    "example": {
      "className": "TForEach",
      "name": "CardGrid",
      "x": 5, "y": 5, "width": 32, "height": 32,
      "source": "CardData",
      "layout": "grid", "cols": 4, "gap": 1,
      "itemWidth": 7, "itemHeight": 7,
      "template": {
        "className": "TButton",
        "text": "${item.face}",
        "style": { "backgroundColor": "${item.color}" }
      }
    }
  }
}
```

### §4.4 Lifecycle

```
1. Stage-Load
   ├─ TForEach-Component instantiiert
   ├─ Subscribe auf source-Variable (ReactiveRuntime)
   ├─ Initial-Render: für jeden Item einen Klon des Templates erzeugen
   └─ Layout berechnen und positionieren

2. Datenquelle ändert sich (list_push, map_set, ...)
   ├─ Diff: alte vs. neue Items
   ├─ Add: neue Item-Komponenten instantiieren
   ├─ Remove: alte Item-Komponenten zerstören (cleanup Bindings, Events)
   └─ Re-Layout

3. Stage-Unload
   ├─ Unsubscribe von source
   ├─ Alle Item-Komponenten zerstören
   └─ Bindings cleanen
```

### §4.5 Implementierung — konkrete Schritte

#### §4.5.1 Schritt 1 — Komponenten-Klasse anlegen

**Datei:** `src/components/containers/TForEach.ts` (NEU — Pfad anpassen, falls Komponenten woanders liegen)

```typescript
import { BaseComponent } from '../BaseComponent';            // Pfad prüfen
import { ReactiveRuntime } from '../../runtime/ReactiveRuntime';
import { RuntimeStageManager } from '../../runtime/RuntimeStageManager';
import { ExpressionParser } from '../../runtime/ExpressionParser';

export class TForEach extends BaseComponent {
  // Properties (entsprechen Schema):
  source!: string;
  layout: 'grid' | 'horizontal' | 'vertical' | 'absolute' = 'grid';
  cols?: number;
  rows?: number;
  gap = 0;
  itemWidth?: number;
  itemHeight?: number;
  template!: Record<string, any>;
  namePattern = '${name}_${index}';

  // Internals:
  private spawnedItems: Map<string | number, BaseComponent> = new Map();
  private unsubscribe?: () => void;

  public onMount(): void {
    super.onMount();

    // 1. Subscribe auf Datenquelle
    this.unsubscribe = ReactiveRuntime.subscribe(this.source, (newData) => {
      this.reconcile(newData);
    });

    // 2. Initial-Render
    const initialData = ReactiveRuntime.get(this.source);
    this.reconcile(initialData);
  }

  public onUnmount(): void {
    this.unsubscribe?.();
    for (const item of this.spawnedItems.values()) {
      item.destroy();
    }
    this.spawnedItems.clear();
    super.onUnmount();
  }

  /**
   * Reconciliation: vergleicht aktuelle Items mit neuen Daten.
   * Erzeugt/entfernt/updatet Item-Komponenten minimal.
   */
  private reconcile(data: unknown): void {
    const entries = this.normalizeData(data);
    const newKeys = new Set(entries.map(e => e.key));

    // Entfernen: Items, die nicht mehr in newKeys sind
    for (const [key, comp] of this.spawnedItems) {
      if (!newKeys.has(key)) {
        comp.destroy();
        this.spawnedItems.delete(key);
        this.emit('onItemDestroy', { itemName: comp.name });
      }
    }

    // Hinzufügen / Updaten:
    for (const { key, item, index } of entries) {
      let comp = this.spawnedItems.get(key);
      if (!comp) {
        comp = this.spawnItem(item, index, key);
        this.spawnedItems.set(key, comp);
        this.emit('onItemSpawn', { index, itemName: comp.name });
      } else {
        this.updateItemBindings(comp, item, index);
      }
    }

    this.applyLayout();
  }

  /**
   * Wandelt Datenquelle (Array oder Object) in normalisierte Einträge um.
   */
  private normalizeData(data: unknown): Array<{ key: string | number; item: any; index: number }> {
    if (Array.isArray(data)) {
      return data.map((item, index) => ({ key: index, item, index }));
    }
    if (data && typeof data === 'object') {
      return Object.entries(data).map(([key, item], index) => ({ key, item, index }));
    }
    return [];
  }

  private spawnItem(item: any, index: number, key: string | number): BaseComponent {
    // 1. Template klonen
    const cloned = structuredClone(this.template);

    // 2. Auto-Name
    cloned.name = ExpressionParser.resolve(this.namePattern, {
      vars: { name: this.name, index, key }
    });

    // 3. Template-Bindings (item, index) auflösen
    this.resolveTemplateBindings(cloned, item, index);

    // 4. Komponente erzeugen via RuntimeStageManager
    const comp = RuntimeStageManager.createObject(this.stageId, cloned, this /* parent */);

    // 5. Live-Bindings für ${item.*}: bei Daten-Änderung re-resolven
    this.bindItemUpdates(comp, item, index);

    return comp;
  }

  private updateItemBindings(comp: BaseComponent, item: any, index: number): void {
    // Aktualisiert reaktive Bindings auf comp basierend auf neuem item-Wert
    this.resolveTemplateBindings(comp.props, item, index);
    comp.refreshBindings();
  }

  private resolveTemplateBindings(target: any, item: any, index: number): void {
    // Tiefe Suche nach ${item.*} und ${index}-Strings, ersetzen durch Werte
    walk(target, (value, parent, key) => {
      if (typeof value === 'string' && value.includes('${')) {
        parent[key] = ExpressionParser.resolve(value, {
          vars: { item, index, $index: index, $item: item }
        });
      }
    });
  }

  private applyLayout(): void {
    const items = Array.from(this.spawnedItems.values());
    const cols = this.cols ?? Math.ceil(Math.sqrt(items.length));
    const itemW = this.itemWidth ?? (this.width - this.gap * (cols - 1)) / cols;
    const itemH = this.itemHeight ?? itemW;

    items.forEach((comp, i) => {
      switch (this.layout) {
        case 'grid':
          comp.x = this.x + (i % cols) * (itemW + this.gap);
          comp.y = this.y + Math.floor(i / cols) * (itemH + this.gap);
          break;
        case 'horizontal':
          comp.x = this.x + i * (itemW + this.gap);
          comp.y = this.y;
          break;
        case 'vertical':
          comp.x = this.x;
          comp.y = this.y + i * (itemH + this.gap);
          break;
        case 'absolute':
          /* Template muss x/y selbst setzen */
          break;
      }
      comp.width = itemW;
      comp.height = itemH;
    });
  }
}

function walk(obj: any, fn: (value: any, parent: any, key: string) => void): void {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    fn(obj[key], obj, key);
    walk(obj[key], fn);
  }
}
```

#### §4.5.2 Schritt 2 — Komponente registrieren

**Datei:** vermutlich `src/components/ComponentRegistry.ts` oder `RuntimeStageManager.ts`

```typescript
import { TForEach } from './containers/TForEach';

ComponentRegistry.register('TForEach', TForEach);
```

#### §4.5.3 Schritt 3 — `${item.*}` und `${index}` im Parser

**Datei:** `src/runtime/ExpressionParser.ts`

Im Resolve-Pfad: wenn `ctx.vars.item` oder `ctx.vars.index` existieren, sind diese über die normale Variable-Resolution erreichbar. Keine spezielle Magic nötig, **wenn** der `TForEach` die Variablen korrekt in den Eval-Context schiebt (siehe `resolveTemplateBindings`).

→ **Alternative:** `$index` und `$item` als Magic-Names registrieren (analog zu `$event`).

#### §4.5.4 Schritt 4 — Reactive-Subscription verifizieren

**Datei:** `src/runtime/ReactiveRuntime.ts` und `src/runtime/RuntimeVariableManager.ts`

Prüfen:

- Gibt es eine `subscribe(varName, callback)`-API?
- Wird `unsubscribe` zuverlässig aufgerufen, um Memory-Leaks zu vermeiden?
- Werden Array-Mutationen (`push`, `splice`) korrekt als Änderung erkannt?

Falls nicht: Erweiterung des `RuntimeVariableManager.set(name, value)`, sodass jeder `set`-Aufruf alle Subscriber benachrichtigt — das wird für `list_push` etc. **gebraucht**.

```typescript
// In RuntimeVariableManager:
private subscribers = new Map<string, Array<(v: any) => void>>();

public subscribe(name: string, cb: (v: any) => void): () => void {
  const arr = this.subscribers.get(name) ?? [];
  arr.push(cb);
  this.subscribers.set(name, arr);
  return () => {
    const arr = this.subscribers.get(name) ?? [];
    this.subscribers.set(name, arr.filter(c => c !== cb));
  };
}

public set(name: string, value: any): void {
  this.values.set(name, value);
  for (const cb of this.subscribers.get(name) ?? []) cb(value);
}
```

#### §4.5.5 Schritt 5 — Builder-API-Validierung

**Datei:** `src/services/AgentController.ts`

Beim `addObject` mit `className: 'TForEach'`:

- Prüfen, ob `source` eine existierende Variable referenziert (Warning bei Fehlen).
- Prüfen, ob `template` ein Objekt mit `className` ist.
- Prüfen, dass `template.name` **nicht** gesetzt ist (sonst Konflikt mit `namePattern`).

```typescript
private validateForEach(obj: any): void {
  if (!obj.source) throw new Error('TForEach requires "source" property.');
  if (!obj.template?.className) throw new Error('TForEach.template must have className.');
  if (obj.template.name) {
    throw new Error('TForEach.template must not have a fixed name; use namePattern instead.');
  }
}
```

### §4.6 Edge-Cases

| Fall | Verhalten |
|:---|:---|
| `source` zeigt auf nicht-existierende Variable | Empty-Render + `console.warn` |
| `source` ist weder Array noch Object | Empty-Render |
| Datenquelle wechselt von Array zu Object | Komplettes Re-Render (alle Items destroy, dann new) |
| Item-Property ist Funktion oder undefined | Binding bleibt leer-String, kein Crash |
| `cols` und `rows` beide gesetzt + zu viele Items | Items über `cols * rows` werden nicht gerendert + Warning |
| Template enthält Sub-`TForEach` (Nested) | Sollte funktionieren via Rekursion — testen! |
| Sehr große Listen (>1000) | V1: kein Virtualization, dokumentieren. V2: Window-Rendering. |

### §4.7 Memory-Leak-Vermeidung

Kritische Punkte:

1. **`unsubscribe` muss in `onUnmount` aufgerufen werden** — sonst Subscription-Leak.
2. **Pro Item-Komponente:** alle `connectEvent`-Bindings müssen bei `destroy` gelöst werden.
3. **`structuredClone` des Templates** — verhindert, dass mehrere Items dieselbe Property-Reference teilen.
4. **PropertyWatcher** auf gespawnten Items: bei Destroy abräumen.

### §4.8 Test-Cases

**Datei:** `src/components/containers/TForEach.test.ts` (NEU)

```typescript
describe('TForEach — basic rendering', () => {
  it('renders one item per array entry', async () => {
    varManager.set('items', [{ name: 'A' }, { name: 'B' }, { name: 'C' }]);
    const fe = createForEach({
      source: 'items', layout: 'grid', cols: 3,
      template: { className: 'TButton', text: '${item.name}' }
    });
    await fe.onMount();
    expect(fe.spawnedItems.size).toBe(3);
  });

  it('reacts to array push', async () => {
    varManager.set('items', ['a']);
    const fe = createForEach({ source: 'items', /* ... */ });
    await fe.onMount();
    expect(fe.spawnedItems.size).toBe(1);

    varManager.set('items', ['a', 'b']);  // simuliert list_push
    await flushReactive();
    expect(fe.spawnedItems.size).toBe(2);
  });

  it('removes items on shrink', async () => {
    varManager.set('items', ['a', 'b', 'c']);
    const fe = createForEach({ source: 'items', /* ... */ });
    await fe.onMount();
    expect(fe.spawnedItems.size).toBe(3);

    varManager.set('items', ['a']);
    await flushReactive();
    expect(fe.spawnedItems.size).toBe(1);
  });

  it('cleans up on unmount', async () => {
    const fe = createForEach({ source: 'items', /* ... */ });
    await fe.onMount();
    await fe.onUnmount();
    expect(fe.spawnedItems.size).toBe(0);
  });
});

describe('TForEach — template bindings', () => {
  it('resolves ${item.x} per row', async () => {
    varManager.set('items', [{ x: 1 }, { x: 2 }]);
    const fe = createForEach({
      source: 'items',
      template: { className: 'TLabel', text: 'Val: ${item.x}' }
    });
    await fe.onMount();
    const labels = Array.from(fe.spawnedItems.values()) as any[];
    expect(labels[0].text).toBe('Val: 1');
    expect(labels[1].text).toBe('Val: 2');
  });

  it('resolves ${index}', async () => {
    varManager.set('items', ['a', 'b', 'c']);
    const fe = createForEach({
      source: 'items',
      template: { className: 'TLabel', text: 'Idx ${index}' }
    });
    await fe.onMount();
    const labels = Array.from(fe.spawnedItems.values()) as any[];
    expect(labels.map(l => l.text)).toEqual(['Idx 0', 'Idx 1', 'Idx 2']);
  });
});
```

### §4.9 Doku-Updates

1. **`docs/AGENT_API_REFERENCE.md` §5.C** (Container-Komponenten) — Neuer Steckbrief `TForEach`.
2. **`docs/AGENT_API_REFERENCE.md` §6** — Neues Rezept *„Rezept #18: Datengetriebenes Grid mit TForEach"*.
3. **`docs/AGENT_API_REFERENCE.md` §7** — Anti-Pattern „Statisches Hardcoden von Listen-UI" hinzufügen.
4. **`docs/schemas/schema_containers.json`** — TForEach-Schema (siehe §4.3).

### §4.10 Akzeptanzkriterien

- [ ] `TForEach` mit Array-Source rendert korrekte Anzahl Items.
- [ ] `TForEach` mit Map-Source rendert korrekte Einträge.
- [ ] `${item.<prop>}` und `${index}` im Template werden korrekt aufgelöst.
- [ ] Reactive-Updates: `list_push`, `list_pop`, `map_set`, `map_delete` lösen Re-Render aus.
- [ ] `onUnmount` lässt keine Subscriptions oder Item-Komponenten zurück.
- [ ] Auto-Naming via `namePattern` produziert eindeutige Namen.
- [ ] Layout-Modi `grid`, `horizontal`, `vertical`, `absolute` funktionieren.
- [ ] `agent.addObject({ className: 'TForEach', template: { name: 'X' } })` wirft Fehler.
- [ ] Memory-Smoke-Test (siehe §5) zeigt 16 Karten aus 1× `TForEach`.

---
## §5 End-to-End-Smoke-Test: Memory-Spiel

Nach Abschluss aller drei Features muss folgendes Skript ein lauffähiges Memory-Spiel erzeugen, **mit einer einzigen Click-Handler-Task**:

**Datei (Vorschlag):** `scripts/memory_game.ts`

```typescript
export default function build(agent: AgentController) {
  // ── Stages ──
  agent.createStage('stage_main', 'Memory');

  // ── Variablen (im Blueprint) ──
  agent.addVariable('blueprint', 'CardData',     'list',    []);
  agent.addVariable('blueprint', 'firstCardId',  'string',  '');
  agent.addVariable('blueprint', 'secondCardId', 'string',  '');
  agent.addVariable('blueprint', 'firstFace',    'string',  '');
  agent.addVariable('blueprint', 'secondFace',   'string',  '');
  agent.addVariable('blueprint', 'matchedCount', 'integer', 0);
  agent.addVariable('blueprint', 'attempts',     'integer', 0);
  agent.addVariable('blueprint', 'gamePhase',    'string',  'waiting');

  // ── Karten-Daten generieren (8 Paare, geshufflet) ──
  const faces = ['🍎','🍌','🍇','🍒','🥑','🥕','🌽','🍓'];
  const deck = [...faces, ...faces].map((face, i) => ({
    id:       'card_' + i,
    face,
    revealed: false,
    matched:  false
  }));
  // Initial-Set + Shuffle via list_shuffle in einer Init-Task:
  agent.createTask('blueprint', 'InitGame');
  agent.addAction('InitGame', 'variable',     'SeedDeck',    { variableName: 'CardData', value: deck });
  agent.addAction('InitGame', 'list_shuffle', 'ShuffleDeck', { target: 'CardData', seed: 42 });
  // → InitGame wird über stage_main.onLoadActions automatisch beim Start ausgeführt.

  // ── UI: TForEach mit Card-Template ──
  agent.addObject('stage_main', {
    className:   'TForEach',
    name:        'CardGrid',
    x: 5, y: 5, width: 32, height: 32,
    source:      'CardData',
    layout:      'grid', cols: 4, gap: 1,
    namePattern: '${item.id}',          // → Card_0, Card_1, ...
    template: {
      className: 'TButton',
      text:      '${item.revealed || item.matched ? item.face : "?"}',
      style:     {
        backgroundColor: '${item.matched ? "#9f9" : (item.revealed ? "#fff" : "#888")}'
      }
    }
  });

  // Score-Anzeige:
  agent.addObject('stage_main', {
    className: 'TLabel', name: 'ScoreLabel',
    x: 5, y: 38, width: 30, height: 2,
    text: 'Versuche: ${attempts} | Paare: ${matchedCount}/8'
  });

  // Reset-Timer (klappt Karten nach 1s wieder zu, wenn kein Match):
  agent.addObject('stage_main', {
    className: 'TIntervalTimer', name: 'ResetTimer',
    duration: 1000, count: 1, enabled: false
  });

  // ── EINE Task für ALLE Karten (dank $event) ──
  agent.createTask('blueprint', 'HandleCardClick');

  // 1. Welche Karte wurde geklickt? (kommt direkt aus $event)
  agent.addAction('HandleCardClick', 'variable', 'GrabId', {
    variableName: 'clickedId',
    value:        '${$event.source.name}'
  });

  // 2. Index aus 'card_<n>' extrahieren (für list_get)
  agent.addAction('HandleCardClick', 'calculate', 'CalcIndex', {
    formula:        '${clickedId.replace("card_","")}',     // String-Method via ExpressionParser
    resultVariable: 'clickedIndex'
  });

  // 3. Karten-Daten lesen
  agent.addAction('HandleCardClick', 'list_get', 'GetCard', {
    target:         'CardData',
    index:          '${clickedIndex}',
    resultVariable: 'clickedCard'
  });

  // 4. Karte als revealed markieren (Mutation in der Liste)
  agent.addAction('HandleCardClick', 'list_set', 'SetRevealed', {
    target: 'CardData',
    index:  '${clickedIndex}',
    value:  { id: '${clickedCard.id}', face: '${clickedCard.face}', revealed: true, matched: '${clickedCard.matched}' }
  });

  // 5. Branch nach gamePhase
  agent.addBranch('HandleCardClick', 'gamePhase', '==', 'waiting',
    (then) => {
      then.addAction('variable', 'SetFirst',     { variableName: 'firstCardId', value: '${clickedId}' });
      then.addAction('variable', 'SetFirstFace', { variableName: 'firstFace',   value: '${clickedCard.face}' });
      then.addAction('variable', 'SetPhase',     { variableName: 'gamePhase',   value: 'one-flipped' });
    },
    (els) => {
      els.addAction('variable', 'SetSecond',     { variableName: 'secondCardId', value: '${clickedId}' });
      els.addAction('variable', 'SetSecondFace', { variableName: 'secondFace',   value: '${clickedCard.face}' });
      els.addAction('variable', 'SetPhase',      { variableName: 'gamePhase',    value: 'comparing' });
      els.addTaskCall('CompareCards');
    }
  );

  // ── Vergleich-Logik ──
  agent.createTask('blueprint', 'CompareCards');
  agent.addAction('CompareCards', 'variable', 'IncAttempts', {
    variableName: 'attempts', operation: 'increment'
  });
  agent.addBranch('CompareCards', 'firstFace', '==', '${secondFace}',
    (then) => {
      // Match: matched flag in beiden Karten setzen
      then.addTaskCall('MarkMatched');
      then.addAction('variable', 'IncMatched', { variableName: 'matchedCount', operation: 'increment' });
      then.addAction('variable', 'ResetPhase', { variableName: 'gamePhase', value: 'waiting' });
      then.addTaskCall('CheckWin');
    },
    (els) => {
      // Kein Match: Timer starten, der nach 1s zurückklappt
      els.addAction('property', 'StartTimer', {
        target: 'ResetTimer', property: 'enabled', value: true
      });
    }
  );

  // ── Helper: matched-Flag setzen ──
  agent.createTask('blueprint', 'MarkMatched');
  // Beide Karten in CardData als matched markieren via map/list-Operationen
  // (Skizziert — Detail-Code analog zum SetRevealed in HandleCardClick)

  // ── Zurückklappen wenn kein Match ──
  agent.createTask('blueprint', 'ResetFlippedCards');
  // Setze revealed=false für firstCardId und secondCardId in CardData
  agent.addAction('ResetFlippedCards', 'variable', 'ResetPhase', {
    variableName: 'gamePhase', value: 'waiting'
  });

  // ── Win-Check ──
  agent.createTask('blueprint', 'CheckWin');
  agent.addBranch('CheckWin', 'matchedCount', '==', 8,
    (then) => {
      then.addAction('show_toast', 'Win', {
        message: 'Geschafft in ${attempts} Versuchen!', duration: 5000
      });
    }
  );

  // ── Stage-Lifecycle: InitGame beim Start ──
  agent.connectEvent('stage_main', 'stage_main', 'onLoad', 'InitGame');

  // ── Verkabelung: ALLE Karten triggern dieselbe Task ──
  // V1: TForEach hat Helper für Template-interne Events:
  agent.connectEventOnTemplate('CardGrid', 'onClick', 'HandleCardClick');
  // ↑ Diese Methode ist Teil von Feature C — siehe §6.3

  // Reset-Timer zurückklappen
  agent.connectEvent('stage_main', 'ResetTimer', 'onTimer', 'ResetFlippedCards');
}
```

### §5.1 Was dieses Skript erzeugt

- **Statische Builder-Zeilen:** ~80
- **Tasks:** 5 (`InitGame`, `HandleCardClick`, `CompareCards`, `MarkMatched`, `ResetFlippedCards`, `CheckWin`)
- **UI-Objekte:** 3 (`CardGrid`, `ScoreLabel`, `ResetTimer`)
- **Zur Laufzeit erzeugte Objekte:** 16 Buttons via `TForEach`

### §5.2 Was im Skript zusätzlich nötig wird (V1.1-Erweiterungen)

Beim Schreiben fielen mir folgende kleine Lücken auf, die für ein vollständig sauberes Memory-Spiel nützlich wären — sie sind **kein** Blocker, aber Quality-of-Life:

| Erweiterung | Bedeutung |
|:---|:---|
| `agent.setVariable(name, value)` als Builder-API | Initial-Werte direkt im Skript setzen ohne separate Init-Task |
| `agent.connectEventOnTemplate(forEachName, event, taskName)` | Verkabelt das Event automatisch auf alle gespawnten Items des `TForEach` |
| String-Methoden im Parser (`replace`, `split`, `slice`) | Bisher nur deklarative Bindings, keine Operationen |
| `list_update_at(target, index, partialObject)` | Statt komplettes Objekt zu ersetzen, nur Felder mergen |

Empfehlung: **V1 ohne diese Erweiterungen ausliefern**, sie als V1.1 nachschieben.

### §5.3 Erwartete Ausgabe nach Klick auf Card_3

```
$event = {
  source: { name: 'card_3', className: 'TButton', stageId: 'stage_main' },
  event:  'onClick',
  data:   { x: 12, y: 8, button: 'left' },
  timestamp: 1234567890
}

→ clickedId = 'card_3'
→ clickedIndex = 3
→ clickedCard = { id: 'card_3', face: '🍇', revealed: false, matched: false }
→ CardData[3] wird zu { id: 'card_3', face: '🍇', revealed: true, matched: false }
→ TForEach reagiert reaktiv → Card_3-Button zeigt jetzt '🍇' statt '?'
```

---

## §6 Glossar & Referenzen

### §6.1 Glossar

| Begriff | Bedeutung |
|:---|:---|
| **`$event`** | Magic-Variable, vom `TaskExecutor` während Task-Ausführung injiziert. Enthält Source, Event-Name, Daten, Timestamp. |
| **`self`** | Alias für das triggernde Objekt (`$event.source`), aber mit Live-Property-Zugriff. |
| **EventContext** | Datenstruktur, die `$event`-Inhalt typisiert. Lebt nur im Task-Stack-Frame. |
| **Reconciliation** | Diff-Algorithmus in `TForEach`, der minimal Items hinzufügt/entfernt/aktualisiert. |
| **`namePattern`** | Template für Auto-Naming der `TForEach`-Children, z.B. `${name}_${index}`. |
| **PRNG** | Pseudo-Random-Number-Generator (z.B. Mulberry32) für deterministisches Shuffling. |
| **Subscriber** | Callback, der bei Variable-Änderung aufgerufen wird (Reactive-System). |
| **Magic-Variable** | Reservierter Name (`$event`, `$index`, `$item`), vom System gesetzt, nicht User-deklarierbar. |

### §6.2 Datei-Referenzen (Quell-Code)

| Datei | Rolle bei Implementierung |
|:---|:---|
| `src/runtime/EventContext.ts` | **NEU** — Typ-Definition + Helper für Feature A |
| `src/runtime/TaskExecutor.ts` | Erweitern: `execute()` mit `EventContext`-Parameter, Vererbung an Subtasks |
| `src/runtime/ExpressionParser.ts` | Erweitern: `${$event.*}`, `${self.*}`, `${Map[${key}]}` auflösen |
| `src/runtime/RuntimeVariableManager.ts` | Erweitern: `subscribe()`/`unsubscribe()`-API für Reactive-System |
| `src/runtime/ReactiveRuntime.ts` | Verifizieren: existiert `subscribe`-API? Wenn ja, nutzen; wenn nein, ergänzen |
| `src/runtime/ActionRegistry.ts` | Registrierung der 14 neuen Collection-Actions |
| `src/runtime/actions/StandardActions.ts` | `registerCollectionActions(...)` aufrufen |
| `src/runtime/actions/handlers/CollectionActions.ts` | **NEU** — 14 Handler-Implementierungen |
| `src/components/containers/TForEach.ts` | **NEU** — Komponenten-Klasse |
| `src/components/ComponentRegistry.ts` | TForEach registrieren (Pfad ggf. anpassen) |
| `src/services/AgentController.ts` | Reserved-Names-Check, TForEach-Validierung, Pflicht-Param-Validierung |
| `src/model/types.ts` | ActionType-Union erweitern, EventContext re-exportieren |
| `docs/schemas/schema_base.json` | `actionTypes`-Section um Collection-Typen erweitern |
| `docs/schemas/schema_containers.json` | `TForEach`-Schema einfügen |
| `docs/schemas/schema_variables.json` | `TListVariable`/`TStringMap`-Methoden ergänzen |

### §6.3 Datei-Referenzen (Dokumentation)

| Datei | Was ändert sich |
|:---|:---|
| `docs/AGENT_API_REFERENCE.md` §3.2 | `addTaskParam` als optional, `$event` als Hauptweg |
| `docs/AGENT_API_REFERENCE.md` §4 | 14 neue ActionType-Steckbriefe + Magic-Variable-Hinweise |
| `docs/AGENT_API_REFERENCE.md` §5.C | TForEach-Steckbrief in Container-Sektion |
| `docs/AGENT_API_REFERENCE.md` §5 | Pro Komponente Event-`data`-Schema dokumentieren |
| `docs/AGENT_API_REFERENCE.md` §6 | Neue Rezepte 16, 17, 18 |
| `docs/AGENT_API_REFERENCE.md` §7 | Neue Anti-Patterns: „16 Tasks für 16 Karten", „Statisches UI-Hardcoden" |
| `docs/AGENT_API_REFERENCE.md` §10 | TForEach + EventContext im Quick-Index |

### §6.4 Implementierungs-Reihenfolge (empfohlen)

```
Tag 1 (Feature A — Event-Context):
  ├─ §2.4.1   EventContext.ts anlegen        [5 min]
  ├─ §2.4.2   TaskExecutor erweitern         [30 min]
  ├─ §2.4.4   ExpressionParser erweitern     [60 min]
  ├─ §2.4.5   addTaskCall-Vererbung          [15 min]
  ├─ §2.4.6   Reserved-Names-Check           [10 min]
  ├─ §2.6     Tests schreiben                [60 min]
  ├─ §2.4.3   Event-Trigger schrittweise     [90 min]
  └─ §2.7     Doku in AGENT_API_REFERENCE.md [60 min]

Tag 2-3 (Feature B — Collection-Actions):
  ├─ §3.4.1   ActionType-Union erweitern     [10 min]
  ├─ §3.4.2   CollectionActions.ts schreiben [120 min]
  ├─ §3.4.3   Registrierung                  [10 min]
  ├─ §3.5     Pflicht-Param-Validierung      [30 min]
  ├─ §3.6     Bracket-Map-Lookup (Bonus)     [60 min]
  ├─ §3.7     Tests                          [120 min]
  └─ §3.8     Doku                           [60 min]

Tag 4-6 (Feature C — TForEach):
  ├─ §4.5.4   ReactiveRuntime verifizieren   [60 min]
  ├─ §4.5.4   RuntimeVariableManager subscr. [60 min]
  ├─ §4.5.1   TForEach.ts schreiben          [240 min]
  ├─ §4.5.2   Component-Registrierung        [10 min]
  ├─ §4.5.5   Builder-Validierung            [30 min]
  ├─ §4.8     Tests                          [180 min]
  └─ §4.9     Doku + Schema                  [90 min]

Tag 7 (Smoke-Test):
  ├─ §5      Memory-Spiel-Skript schreiben   [120 min]
  ├─ Manuelle Validierung im Runtime         [120 min]
  └─ Bug-Fixes + Doku-Updates                [120 min]
```

### §6.5 Risiken & Stolperfallen

| Risiko | Mitigation |
|:---|:---|
| Reactive-System hat keine `subscribe`-API → TForEach nicht reaktiv | Vor Feature C prüfen; ggf. RuntimeVariableManager erweitern (siehe §4.5.4) |
| `structuredClone` nicht in alter Node-Version verfügbar | Polyfill via `JSON.parse(JSON.stringify(x))` als Fallback (verliert Functions/Maps) |
| Memory-Leak in TForEach bei vielen Mount/Unmount-Zyklen | Test mit 100× Mount/Unmount; `WeakRef` falls nötig |
| `${$event.*}`-Auflösung kollidiert mit existierender `${var}`-Logik | Magic-Names früh im Parser-Pfad checken (vor allgemeiner Variable-Resolution) |
| Bestehende Sprite-`hitSide`-Logik bricht | Bei Sprite-Trigger zusätzlich `data.hitSide` setzen, alte API-Felder beibehalten |
| `addTaskParam` wird obsolet, alte Tasks brechen | `addTaskParam` als no-op-kompatibel halten, nur in Doku als deprecated markieren |
| Performance: `TForEach` mit 1000+ Items rendert langsam | V1: nur dokumentieren. V2: Virtualisierung |

### §6.6 Definition of Done

Die drei Features gelten als abgeschlossen, wenn:

- [ ] Alle Akzeptanzkriterien aus §2.8, §3.9, §4.10 erfüllt sind.
- [ ] Memory-Spiel-Smoke-Test (§5) läuft mit `npm test` oder Headless-Runtime durch.
- [ ] Doku in `AGENT_API_REFERENCE.md` ist auf Stand (Sektionen aus §6.3).
- [ ] Schema-Files (`schema_*.json`) sind erweitert.
- [ ] Bestehende Tests (mind. `CoordinateBinding.test`, `ExpressionParser.test`, `ReactiveRuntime.test`, `PropertyWatcher.test`, `VariableConsolidation.test`) laufen weiter grün.
- [ ] Mindestens ein zweiter Reviewer hat die Spec-Konformität geprüft.

---

## §7 Anhang — Vor-Implementierungs-Checkliste

Bevor du mit Feature A startest, prüfe folgende Annahmen aus dieser Spec im echten Code:

```
[ ] Existiert `src/runtime/TaskExecutor.ts` mit einer `execute()`-Methode?
[ ] Existiert in `ExpressionParser.ts` ein zentraler `resolve()`-Eintrittspunkt?
[ ] Werden in `RuntimeVariableManager.set()` schon Subscribers benachrichtigt? (Falls ja, §4.5.4 obsolet.)
[ ] Existiert `ReactiveRuntime.subscribe()` öffentlich?
[ ] Sind die Event-Trigger (TButton.onClick etc.) zentralisiert oder verstreut über viele Files?
[ ] Wie heißt die BaseClass aller Komponenten? (`BaseComponent`? `TComponent`? `GCSElement`?)
[ ] Wie wird `addObject` in der Runtime instantiiert? (`RuntimeStageManager.createObject`? Anderer Name?)
```

Pro „Nein"-Antwort: kleine Anpassung der Spec-Annahmen, aber das Gesamt-Design bleibt.

---

**Ende der Spezifikation.**

