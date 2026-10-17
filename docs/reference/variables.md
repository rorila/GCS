# Referenz: Variablensystem

> **Status:** `entwurf` · **Analyse-Basis:** Working Tree (uncommittet)
> **Quellen:** `src/runtime/RuntimeVariableManager.ts` (552 Zeilen), `src/runtime/ReactiveRuntime.ts`, `src/model/types.ts`, `src/components/*Variable*.ts`

## 1. Scopes

`RuntimeVariableManager` verwaltet drei Ebenen:

| Ebene | Feld | Lebensdauer |
|---|---|---|
| **Projekt / global** | `projectVariables` | gesamte Laufzeit, über Stage-Wechsel hinweg |
| **Stage** | `stageVariables` | bis Stage-Wechsel / `reset` |
| **Task / event** | `vars` im `ActionContext` | nur Stack-Frame des Tasks (`$event`, `$params`, `self`, `sender`, Schleifen-Vars) |

`scope` auf der Variablen-Definition: `'global'` (oder fehlend) → Projekt; sonst `'stage'`/lokal.

## 2. Wo Variablen definiert sind

- `project.variables[]`
- `stage.variables[]` (inkl. `stage_blueprint` — deren `global`-Variablen gelten überall)
- **Objekt-Liste** (`stage.objects[]`) mit `isVariable: true` — z. B. `TVariable`, `TStringVariable`, `TIntegerVariable`, `TStringMap`, `TObjectList`, `TThresholdVariable`, `TRangeVariable`, `TRandomVariable` (Legacy-Pfad, wird importiert)

**Explizit ausgenommen:** `TTimer`, `TIntervalTimer` — obwohl sie teils `isVariable: true` tragen, werden sie **nicht** als Variable importiert (hardcoded `EXCLUDED_TIMER_CLASSES`, Z. 82).

Beispiel aus `GCS-CMS.json` (`stage_blueprint`):

```json
{ "className": "TStringVariable", "id": "cms_var_Token", "name": "Token",
  "scope": "global", "isVariable": true, "type": "string",
  "defaultValue": "", "value": "" }
```

## 3. Der `contextVars`-Proxy

Alle Variablen-Zugriffe laufen durch einen `Proxy` (`createVariableContext`, Z. 227–369):

**Lesen:**
- `global.X` → `projectVariables`; `stage.X` → `stageVariables` (Scope-Prefixe)
- `X` → erst `stageVariables`, dann `projectVariables` (Stage schlägt Global)
- List-Komponenten: gespeicherter Snapshot wird gegen die Live-Komponente aufgelöst (`resolveStoredValue`, Z. 188–204) — `records` (records-Modus) bzw. `items` (objects-Modus) sind kanonisch, `data` ist abgeleitet

**Schreiben:**
- Ziel-Lookup: 1. aktuelle Stage-Definition → 2. `globalDefinitions`-Registry (enthält Globals aller Stages + Blueprint, keyed by Name **und** ID) → 3. `var_`-Prefix-Fuzzy-Match
- `isInteger`-Definitionen → `Math.floor(value)` (Z. 264)
- Schreibort: vorhandener Scope, sonst **Default = stageVariables** (Z. 271–278)
- Seiteneffekte nach Set:
  1. Sync in die Komponente (`.value`, `.items`, `.data`/`.records`, verschachtelte Pfade via `setNestedProperty`)
  2. `reactiveRuntime.setVariable(name, value)` → UI-Reaktivität
  3. `processVariableEvents` → siehe §5
  4. `DebugLogService` Eintrag (`name := wert (vorher: …)`)

## 4. Datentypen &amp; Variablen-Klassen

| `className` / `type` | Verhalten |
|---|---|
| `TVariable`, `TStringVariable` | Freier Wert |
| `TIntegerVariable` | `isInteger` → floor beim Schreiben |
| `TRandomVariable` | `isRandom` → `onGenerated`-Event bei Änderung |
| `TThresholdVariable` | `threshold` + `comparison` → Threshold-Events |
| `TRangeVariable` | `min` + `max` → `onMinReached`/`onMaxReached`/`onInside`/`onOutside` |
| `TStringMap` | Key→Value-Map (`entries`), Basis der `map_*`-Actions & Themes |
| `TObjectList` | Liste/Records — `sourceMode: 'records'` vs. objects |
| `type: 'list'` | `onItemAdded`/`onItemRemoved`/`onContains`/`onNotContains` |
| `type: 'timer'` | Startet `host.startTimer` beim ersten Setzen &gt; 0 |

Initialwert-Priorisierung (Z. 139–144): `value` &gt; `defaultValue` &gt; `entries`/`items`/`data` — Editor-Design-Wert schlägt Default, damit Run-Mode dem Edit-Mode entspricht.

## 5. Automatische Variablen-Events

Bei jedem Schreibzugriff (`processVariableEvents`, Z. 372–475) — **nur wenn `varDef.Tasks[eventName]` explizit gemappt ist** (Z. 487):

| Event | Bedingung |
|---|---|
| `onValueChanged` | `old !== new` |
| `onValueEmpty` | `""`/`null`/`undefined` |
| `onThresholdReached` / `onThresholdLeft` / `onThresholdExceeded` | Schwellen-Übergänge (Kriterium `>=`, `<=`, `>`, `<`, `==`, `!=`; `threshold` darf `${…}` enthalten) |
| `onTriggerEnter` / `onTriggerExit` | Wert erreicht/verlässt `triggerValue` (loose `==`) |
| `onMinReached` / `onMaxReached` / `onInside` / `onOutside` | `min`/`max` definiert |
| `onGenerated` | `isRandom`-Variable wurde geschrieben |
| `onItemAdded` / `onItemRemoved` / `onContains` / `onNotContains` | `type: 'list'`, `searchValue` optional |

Aufruf als `${VarName}.${EventName}`-Task (Dot-Notation).

## 6. Stage-Proxy (Cross-Stage-Zugriff)

`createStageProxy(stage)` (Z. 206–225): Lese-Proxy für **öffentliche** Variablen anderer Stages (`isPublic !== false` sonst `undefined` + Warnung). Schreiben ist verboten (`Cannot set properties on Stage Proxy`).

## 7. Magic- / reservierte Variablen

`RESERVED_VARIABLE_NAMES` (aus `EventContext.ts`): `$event`, `self`, `$index`, `$item`, `stageEvent` — nicht als Benutzer-Variablen erlaubt. Zusätzlich injiziert der `TaskExecutor` `$params` und `$event` in die Task-Vars.

## 8. Bekannte Einschränkungen &amp; Fehler

- **Stage überschreibt Global beim Lesen** — Namenskollision zwischen Stage- und Projekt-Variable liefert stillschweigend den Stage-Wert.
- **`var_`-Prefix-Fuzzy** (Z. 253–261) ist ein Heuristik-Fallback, der Namen mit/ohne Präfix gleichsetzt — kann unerwartete Treffer liefern.
- **Array-Vergleich per `JSON.stringify`** bei items/data-Sync (Z. 306, 312) — teuer bei großen Listen.
- **`has`-Trap** des Proxys enthält `global`/`stage` — `in`-Checks und `ownKeys` spiegeln die Registry; `set` legt unbekannte Namen in `stageVariables` an (Auto-Create).
- **Timer-Exklusion** ist hartcodiert — andere Service-Komponenten mit `isVariable: true` können theoretisch dieselbe Proxy-Überschattung auslösen (Fix ist spezifisch, nicht generisch).

## 9. Tests

| Datei | Status |
|---|---|
| `tests/reactive_runtime.test.ts` | vorhanden, nicht ausgeführt |
| `tests/event_context.test.ts` | vorhanden, nicht ausgeführt |
| `tests/serialization.test.ts` | vorhanden, nicht ausgeführt |
