# Referenz: Event-System

> **Status:** `entwurf` · **Analyse-Basis:** Working Tree (uncommittet)
> **Quellen:** `src/runtime/services/RuntimeEventService.ts` (106 Zeilen), `src/runtime/EventContext.ts` (64), `src/runtime/GameRuntime.ts`, `src/components/*` (`getEvents()`), `src/model/types.ts`

## 1. Was ist ein Event?

Ein **Event** ist ein benanntes Auslöse-Signal an einem Objekt (z. B. `onClick` eines `TButton`, `onTimer` eines `TTimer`, `onSelect` eines `TEmojiPicker`). Die Komponente **deklariert** ihre Event-Namen über `getEvents()`; die View- oder Runtime-Schicht **feuert** sie via `runtime.handleEvent(objectId, eventName, data)`; das Projekt **bindet** sie an Tasks über eine Zuordnung im Objekt-JSON.

## 2. Event-Quellen

| Quelle | Mechanismus | Beispiele |
|---|---|---|
| DOM/View | Benutzer-Interaktion → `handleEvent` | `onClick`, `onChange`, `onSelect`, `onEnter`, `onMouseEnter` |
| Runtime-Timer | `TTimer`, `TIntervalTimer` interne Zeitgeber | `onStart`, `onTimer`, `onFinish` |
| Stage-Lifecycle | StageManager beim Laden/Verlassen | `onLoad`, `onUnload` (Stage-Map `stage.events`) |
| Multiplayer | `GameRuntimeMultiplayer` → `_fireEvent` auf Komponenten | `onRoomCreated`, `onRoomJoined`, `onGameStart` (THandshake), `player_timeout` (THeartbeat) |
| Runtime-Bindings | `bind_event`-Action | zur Laufzeit gesetzte Zuordnungen |
| Komponenten-intern | komponenteneigene Ereignisse | `onValueChanged`, `onValueEmpty`, Threshold-Trigger auf Variablen |

## 3. Event-Deklaration (JSON)

Zwei **parallele** Zuordnungsformen auf Objektebene:

```json
{
  "name": "CMSServerPruefung",
  "className": "TTimer",
  "events": { "onStart": "CMS_Serverstatus_Pruefen", "onTimer": "CMS_Serverstatus_Pruefen" }
}
```

Quelle: `GCS-CMS.json`, `stage_blueprint` → TTimer `CMSServerPruefung`.

| Feld | Form | Semantik |
|---|---|---|
| `events` | `{ eventName: "TaskName" }` | explizite Task-Zuordnung (String) |
| `Tasks` | `{ eventName: "TaskName" }` | Legacy-Alias, wird ebenfalls gelesen (Zeile 33) |
| `onEvent` | `{ eventName: action \| action[] }` | **Inline-Actions** — direkte Action-Ausführung ohne Task-Umweg |

Steht `events[onClick]` **nicht** als String, wird nach **Konvention** `ObjectName.EventName` als Task-Name aufgelöst (Zeile 73).

## 4. Dispatch — `RuntimeEventService.handleEvent()`

`src/runtime/services/RuntimeEventService.ts` (Zeilen 10–105):

```
handleEvent(runtime, objectId, eventName, data)
  ├── __SYSTEM_NAVIGATE__ → options.onNavigate (TRichText-Links), return
  ├── Objekt per ID suchen → fehlt → stiller Return
  ├── hasOnEventMap / hasTaskMap prüfen (events + Tasks-Map)
  ├── TEmojiPicker.onSelect → selectedEmoji vorab synchronisieren (Sonderfall, Z. 51)
  ├── obj.onEvent[eventName] → Action(s) direkt via ActionExecutor
  │      vars: { self: obj, sender: obj }
  ├── hasTaskMap → taskExecutor.execute(taskName, eventVars, contextVars, obj, 0, logId)
  │      taskName = events[eventName] (string) | `${obj.name}.${eventName}`
  │      eventVars: prototype = ObjectName→Objekt-Map; eigene Props = Event-Daten
  │                 + eventData, sender, self, $event (EventContext)
  └── finally: GameLoopManager.wakeUp() (Auto-Sleep-Weck)
```

## 5. `EventContext` — die `$event`-Magic-Variable

`src/runtime/EventContext.ts` — wird beim Task-Pfad erzeugt und lebt nur im Task-Stack-Frame:

```ts
{ source: { name, className, stageId },   // auslösendes Objekt
  event: "onClick",
  data: { ... },                          // Event-Payload
  timestamp: number }                     // performance.now()
```

Zugriff in Expressions: `${$event.source.name}`, `${$event.data.x}`. Zusätzliche Magic-Variablen (`RESERVED_VARIABLE_NAMES`): `$event`, `self`, `$index`, `$item`, `stageEvent` — **dürfen nicht als Benutzer-Variablen angelegt werden**.

`EMPTY_EVENT_CONTEXT` (`source='__system__'`, `event='__none__'`) für Tasks ohne Event-Trigger (onLoad-Actions, manuelle Aufrufe).

## 6. Event-Payload (`data`)

Schema je Event-Typ — nicht zentral definiert. Bekannte Payloads:

| Event | `data`-Inhalt |
|---|---|
| `onSelect` (TEmojiPicker) | Emoji-String |
| Kollision | `{ contactX, contactY, other }` o. ä. |
| `onClick` | oft leer `{}` oder Maus-Koordinaten |
| `stage_input`-Action | beliebiges `payload`-Objekt |
| Multiplayer `player_timeout` | `{ playerNumber, reason }` |

Payload-Felder werden als **eigene Properties** in `eventVars` gelegt — Expressions können sie direkt als `${x}` lesen, zusätzlich als `${$event.data.x}`.

## 7. Events auf Variablen

`RuntimeVariableManager.processVariableEvents()` feuert bei Variablen-Schreibzugriff automatisch:

- `onValueChanged` — bei Wertänderung
- `onValueEmpty` — bei `""`/`null`/`undefined`
- `onThresholdReached` / `onThresholdLeft` — bei Schwellenwert-Über-/Unterschreitung (konfigurierbar via `threshold`, `comparison`)

## 8. Bekannte Einschränkungen &amp; Fehler

- **Zwei Parallel-Modelle** (`events`/`Tasks` vs. `onEvent`): gleiches Event kann beides auslösen — Reihenfolge: erst `onEvent`-Actions, dann Task.
- **`onEnter` vs. `onMouseEnter`** werden streng getrennt (Kommentar Z. 28) — kein Fallback-Mapping.
- Fehlendes Objekt → **stiller** Return, kein Fehler.
- TEmojiPicker hat einen hardcodierten Sonderfall (`selectedEmoji`-Sync vor Task-Start) — generisches Muster nicht vorhanden.
- Event-Daten-Felder in `eventVars` können Objekt-Namen **überschatten** (Payload schreibt eigene Props über die Prototype-Kette).

## 9. Tests

| Datei | Status |
|---|---|
| `tests/event_context.test.ts` | Test vorhanden, nicht ausgeführt |
| `tests/serialization.test.ts` | vorhanden, nicht ausgeführt |
| `src/runtime/…` | kein dedizierter RuntimeEventService-Test gefunden |
