# Referenz: Tasks, Bedingungen &amp; Schleifen

> **Status:** `entwurf` · **Analyse-Basis:** Working Tree (Stand: 2025-01, Commit `53e3dfb` + uncommittete Änderungen)
> **Quellen:** `src/runtime/TaskExecutor.ts` (855 Zeilen), `src/runtime/executor/TaskConditionEvaluator.ts` (152), `src/runtime/executor/TaskLoopHandler.ts` (176), `src/model/types.ts`, `src/runtime/ActionExecutor.ts`, `src/runtime/ActionRegistry.ts`

Ein **Task** ist die Ausführungseinheit der GCS-Runtime: Eine benannte Folge von Actions, Bedingungen, Schleifen und Task-Aufrufen. Tasks sind deklarativ in `stage.tasks[]` definiert und werden von `TaskExecutor` interpretiert — es gibt keinen kompilierten Code-Pfad.

---

## 1. Task-Definition (Datenstruktur)

Quelle: `src/model/types.ts` (~Zeile 285ff.)

| Feld | Typ | Bedeutung |
|---|---|---|
| `name` | string | Eindeutiger Name, Aufrufschlüssel |
| `id` | string | Stabile ID |
| `description` | string | Editor-Dokumentation |
| `actionSequence` | Item[] | Sequenzielle Deklaration (s. u.) |
| `triggerMode` | `'local' \| 'local-sync' \| 'broadcast'` | Multiplayer-Modus, Default: `'local-sync'` |
| `params` | string[] | Parameterliste für `$params`-Binding |
| `scope` | `'global' \| string` | `'global'` = für alle Stages sichtbar |

Beispiel aus `GCS-CMS.json` (`stage_blueprint` → Task `AbmeldenTask`):

```json
{
  "id": "…",
  "name": "AbmeldenTask",
  "description": "Meldet den Benutzer beim Server ab",
  "actionSequence": [ /* items */ ],
  "triggerMode": "local",
  "params": [],
  "scope": "global"
}
```

## 2. Task-Auflösung

`TaskExecutor.execute()` löst Task-Namen in dieser Reihenfolge auf:

1. **Stage-lokale Tasks** — `stage.tasks` der aktiven Stage
2. **Blueprint-Stage** — `stage_blueprint` ist implizit immer erreichbar
3. **Projekt-Tasks** — `project.tasks`
4. **Bibliothek** — `libraryService` (Task-Bibliothek aus dem Editor)
5. **Dot-Notation** — `ObjectName.EventName` wird zu Task `EventName` in dem Stage-Kontext, der `ObjectName` enthält; bei Pool-Instanzen wird die **Live-Instanz** als `self` bevorzugt (`preferLiveInstance`, Zeilen 282–302)

Danach wird die **Ausführungsquelle** gewählt — in dieser Priorität:

- **`flowChart`** (falls vorhanden & nicht leer) — die FlowChart-Elemente werden traversiert, dabei gilt die Kanten-Logik (`success`, `error`, `else`-Connections)
- **`actionSequence`** — Fallback, wenn kein FlowChart existiert

## 3. ActionSequence — Item-Typen

| `type` | Bedeutung | Zusatzfelder |
|---|---|---|
| `action` | Verweis auf Action in `stage.actions[]` | `name` |
| `task` | Task-Aufruf (Rekursion) | `name`, optional `params` |
| `condition` | Verzweigung | `condition`, `then`/`body`, `else`/`elseBody`, `thenTask`, `thenAction`, `elseTask`, `elseAction` |
| `while` | Bedingte Schleife | `condition`, `body` |
| `for` | Zählschleife | `iteratorVar`, `from`, `to`, `step`, `body` |
| `foreach` | Sammlungs-Iteration | `sourceArray`/`array`, `itemVar`, `indexVar`, `iterationMode`, `keyVar`, `body` |
| `api` | Erfolgs-/Fehlerpfad | `successBody`, `errorBody` |

Item-Bedingung (`itemCondition` oder String-`condition`) auf **jedem** Item-Typ: Item wird übersprungen, wenn FALSE.

### Bedingung — zwei Syntaxvarianten (beide akzeptiert)

```json
{ "type": "condition", "condition": { "variable": "Busy", "operator": "==", "value": 0 },
  "then": [{ "type": "task", "name": "AbmeldenTask" }], "else": [] }
```

```json
{ "type": "condition", "condition": { "variable": "TmpMat", "operator": "==", "value": "true" },
  "body": [{ "type": "action", "name": "Sicht Paar" }], "elseBody": [...] }
```

Beide Formen (`then`/`else` und `body`/`elseBody`) werden in `executeSequenceItem` (Zeilen 788–804) gleichwertig behandelt.

## 4. Bedingungs-Semantik (`TaskConditionEvaluator`)

Zwei Eingabeformen:

**String-Form:** `TaskConditionEvaluator` splittet auf `==`, `!=`, `>=`, `<=`, `>`, `<`. Links und rechts werden via `resolveOperand()` aufgelöst.

**Objekt-Form:**

```json
{ "leftType": "variable|expression|value", "leftValue": "…",
  "operator": "==|!=|>|<|>=|<=|truthy|falsy|in|not in",
  "rightType": "variable|expression|value", "rightValue": "…" }
```

Alias: `variable` statt `leftValue`, `value` statt `rightValue`.

Semantik-Regeln (aus dem Quelltext):

- `==`/`!=` vergleichen **String-Repräsentationen** (nicht `===`)
- `>`, `<`, `>=`, `<=` koerzieren mit `Number()` — `"12" > "2"` ist `true` (12 &gt; 2)
- `truthy` / `falsy`: `"false"` wird als falsch gewertet; `0`, `""`, `null`, `undefined` ebenfalls
- `in` / `not in`: rechte Seite **muss** ein echtes Array sein, sonst FALSE; Vergleich als Strings
- Variable-Auflösung: `${…}`, `global.X`, `stage.X`, rohe Pfade, Fallbacks auf Event-Daten und globale Objekte

## 5. Schleifen (`TaskLoopHandler`)

Alle drei Varianten haben ein **härtes Limit von 1000 Iterationen** (`MAX_ITERATIONS`), danach Abbruch mit Warn-Log. Schleifenvariablen werden in `vars`, `globalVars` **und** ggf. in das zugehörige Variablen-Komponentenobjekt synchronisiert.

### `while`

```json
{ "type": "while",
  "condition": { "leftValue": "${Var_AblageLen}", "operator": ">", "rightValue": 1 },
  "body": [ /* items */ ] }
```

Quelle: `MauMau.json` → `StapelNachmischen`.

### `for`

```json
{ "type": "for", "iteratorVar": "i", "from": 0, "to": 19, "step": 1,
  "body": [ /* items */ ] }
```

Quelle: `ElinsMemoryRemote.json` → `MpPacken`. `step` ist optional (Default 1).

### `foreach`

```json
{ "type": "foreach", "name": "ForEach: Stein in Steine",
  "sourceArray": "Steine", "itemVar": "Stein",
  "body": [{ "type": "action", "name": "Act_SteinWiederherstellen" }] }
```

Quelle: `Breakout-Lernprojekt.json` → `NeuesSpiel`.

Zusatzoptionen: `indexVar` (Index), `iterationMode` für Maps (`keys` | `values` | `entries`), `keyVar` (Schlüssel bei Map-Iteration).

## 6. Task-Aufrufe, Parameter &amp; Rekursion

- **Aufruf:** `{"type": "task", "name": "X"}` oder `{"type": "task", "name": "X", "params": {...}}`
- **Rekursionslimit:** `MAX_DEPTH = 10` (Zeile ~33). Tieferer Aufruf wird mit Warnung abgebrochen
- **`$params`:** Aufgelöste Parameter werden in den Task-Vars als `$params`-Objekt injiziert (Zeilen 442–443)
- **`isRemoteExecution`**-Flag: verhindert Rück-Propagation bei `local-sync` (Zeile 258)

## 7. Ausführungskontext

Jeder Item-Aufruf erhält:

| Context | Inhalt |
|---|---|
| `vars` | Task-lokale Variablen + `$event`, `$params`, `self`, `sender`, Event-Payload-Felder |
| `globalVars` / `contextVars` | `RuntimeVariableManager.contextVars` — Proxy über `projectVariables` + `stageVariables` |
| `contextObj` | Auslösendes Objekt (Objekt der Dot-Notation oder Event-Source) |
| `parentId` / `logId` | Debug-Log-Verkettung |

## 8. Bekannte Einschränkungen &amp; Fehler

- **1000-Iterations-Limit** — kein Early-Exit bei `while` ohne Fortschritts-Action (Deadlock-Guard, nicht als Bug, aber erwähnenswert)
- **Kein `break`/`continue`** — Schleifen laufen immer zu Ende (oder bis 1000)
- **Dot-Notation-Kollision** — `preferLiveInstance` bevorzugt Pool-Instanz; für echten Projekt-Kontext kann das unerwartet sein
- **Condition mit `==` ist String-Vergleich** — `1 == "1"` ist `true`, aber `01 != "1"`
- **`itemCondition` vs. `condition` als String** — ein String-`condition` auf einem Nicht-`condition`-Item wirkt als Item-Filter, auf einem `condition`-Item ist es die Verzweigungslogik (implizit, nicht dokumentiert)

## 9. Vorhandene Tests

| Datei | Status |
|---|---|
| `src/runtime/executor/TaskConditionEvaluator.test.ts` | Test vorhanden, **nicht ausgeführt** in dieser Analyse |
| `tests/foreach_repeater.test.ts` | vorhanden, nicht ausgeführt |
| `tests/event_context.test.ts` | vorhanden, nicht ausgeführt |
| `tests/stage_import.test.ts` | vorhanden, nicht ausgeführt |
| `tests/reactive_runtime.test.ts` | vorhanden, nicht ausgeführt |

Test-Existenz ≠ Ausführungsnachweis (siehe ID-SCHEMA).

## 10. Abhängigkeiten

- `ActionExecutor` (Dispatch der `action`-Items)
- `ActionRegistry` (Typ→Handler-Mapping)
- `TaskConditionEvaluator` + `TaskLoopHandler`
- `RuntimeVariableManager.contextVars` (global/stage Variablen)
- `DebugLogService` (Task-/Item-Logging)
- `GameRuntime` (Stage-Wechsel, Task-Registry)
- `MultiplayerManager` (nur bei `triggerMode !== 'local'`)
