# Architektur: Ausführungsfluss (Event → Task → Action → Stage)

> **Status:** `entwurf` · **Analyse-Basis:** Working Tree (uncommittet)
> Vollständiger Pfad von einem Benutzerereignis bis zur sichtbaren Änderung in der GameStage. Detailreferenzen: `tasks-conditions.md`, `actions.md`, `events.md`, `expressions.md`, `variables.md`, `multiplayer-runtime.md`.

## Übersicht

```
DOM-Event (Klick, Timer, …)
   │
   ▼
[1] runtime.handleEvent(objectId, eventName, data)
       GameRuntime.ts:431 → RuntimeEventService.handleEvent()
   │
   ▼
[2] Kontextaufbau
       • Objekt per ID in runtime.objects finden (sonst stiller Abbruch)
       • TEmojiPicker-Sonderfall: selectedEmoji vorab syncen
       • eventVars = Prototype(ObjectName→Objekt-Map) + Event-Daten
         + eventData + sender + self + $event (EventContext)
   │
   ▼
[3] Zwei Ausführungspfade (parallel möglich)
       a) obj.onEvent[eventName] → Action(s) direkt an ActionExecutor
       b) taskName = events[eventName] | `${obj.name}.${eventName}`
          → TaskExecutor.execute(taskName, eventVars, contextVars, obj, 0)
   │
   ▼
[4] Task-Auflösung & -Ausführung   (TaskExecutor.execute, Rekursion ≤ 10)
       Suche: stage.tasks → stage_blueprint → project.tasks → Library → Dot-Notation
       Quelle: flowChart (Traversierung) ⊻ actionSequence (sequenziell)
   │
   ▼
[5] Pro Sequence-Item (executeSequenceItem)
       • itemCondition? → evaluateCondition → ggf. skip
       • 'action'  → resolveAction → ActionExecutor.execute
       • 'task'    → execute(name, …, depth+1)   [Rekursion]
       • 'condition' → evaluateCondition → body/then bzw. elseBody/else
       • 'while'/'for'/'foreach' → TaskLoopHandler (≤ 1000 Iterationen)
       • composite Action mit body → $params + rekursive Body-Ausführung
   │
   ▼
[6] ActionExecutor.execute(action, vars, contextVars, eventData, logId)
       • Typ-Inferenz falls 'type' fehlt
       • ${…}-Interpolation aller Parameter (PropertyHelper/ExpressionParser)
       • ActionRegistry.execute(type, params, context)
         → Diagnose-Wrapper → konkreter Handler (handlers/*.ts)
   │
   ▼
[7] Handler mutiert Zustand
       • property/variable/calculate/… → contextVars-Proxy-Set
       • move_to/animate/… → direkte Komponenten-Eigenschaft
       • spawn_object/destroy_object → Pool-Lifecycle
       • navigate_stage/restart_game → StageManager
       • http/service → asynchrone Server-Calls (Ergebnis → resultVariable)
       • bind_event → Laufzeit-Event-Map
   │
   ▼
[8] Reaktive Propagation
       Variable-Write:
         RuntimeVariableManager.contextVars.set()
           → isInteger-Floor → Scope-Auswahl (stage/global)
           → Sync in Komponente (.value/.items/.data/.records)
           → reactiveRuntime.setVariable(name, value)
           → processVariableEvents (onValueChanged, Threshold, List, …)
           → DebugLogService
       Objekt-Write:
         Component-Setter → reaktive Proxy / Render-Invalidierung
   │
   ▼
[9] Rendering
       ReactiveRuntime / StageRenderer zeichnen geänderte
       Komponenten → sichtbare GameStage-Aktualisierung
   │
   ▼
[10] Abschluss
       finally: GameLoopManager.wakeUp() — GameLoop aus Auto-Sleep holen
       triggerMode='local-sync' → sendSyncTask an Gegenspieler
```

## Schlüssel-Beobachtungen

1. **Zwei Einstiegspfade:** `onEvent` (Inline-Actions) läuft **vor** dem Task-Pfad — beide können parallel feuern.
2. **Task-Namenskonvention:** `ObjectName.EventName` ist der implizite Fallback, wenn `events[]` kein String-Mapping enthält.
3. **FlowChart schlägt ActionSequence:** Liegt ein nicht-leeres FlowChart vor, wird `actionSequence` ignoriert.
4. **Variablen sind reaktiv:** Ein einziger `property`-Write löst automatisch Komponenten-Sync, ReactiveRuntime, Variablen-Events und Logging aus.
5. **Bedingungen sind nicht-abbrechend:** Eine fehlschlagende Item-Bedingung **überspringt** das Item, bricht den Task nicht ab.
6. **Event-Payload wird zu Variablen:** `data`-Felder landen als eigene Props in `eventVars` — `${x}` ist direkt lesbar.
7. **Auto-Sleep/Wake:** Die GameLoop schläft bei Inaktivität; jedes Event weckt sie (`wakeUp()` im `finally`).
8. **Multiplayer-Integration:** `remote_task`-Messages durchlaufen denselben `execute`-Pfad (mit `isRemoteExecution`-Guard gegen Echo).

## Quellen (Zeilenanker)

| Schritt | Datei | Zeilen |
|---|---|---|
| 1–3 | `src/runtime/services/RuntimeEventService.ts` | 10–105 |
| 4 | `src/runtime/TaskExecutor.ts` | ~100–265 |
| 5 | `src/runtime/TaskExecutor.ts` | 586–855 |
| 5 | `src/runtime/executor/TaskConditionEvaluator.ts`, `TaskLoopHandler.ts` | gesamt |
| 6 | `src/runtime/ActionExecutor.ts` | gesamt (145) |
| 6 | `src/runtime/ActionRegistry.ts` | gesamt |
| 7 | `src/runtime/actions/handlers/*.ts` | — |
| 8 | `src/runtime/RuntimeVariableManager.ts` | 238–475 |
| 10 | `TaskExecutor.ts` (local-sync) | 257–261 |
| MP-Einspeisung | `src/runtime/core/GameRuntimeMultiplayer.ts` | 39–70 |
