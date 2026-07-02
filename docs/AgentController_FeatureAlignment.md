# AgentController Feature Alignment – Abarbeitungsplan

Ziel: Den `AgentController` (und ggf. `AgentShortcuts`) so erweitern, dass er alle aktuell in der App verfügbaren Gameplay-Features programmatisch erzeugen/manipulieren kann.

Status: **Schritt 1–7 abgeschlossen** – alle AgentController-API-Erweiterungen, Tests und Dokumentation sind aktualisiert.

---

## Gefundene Lücken (Übersicht)

1. **Variablen-Typen unvollständig**: `addVariable()` unterstützt nur 5 alte Aliasse, obwohl das Datenmodell 15+ Typen definiert.
2. **Action-Typen veraltet**: `ActionType` in `model/types.ts` deckt nicht alle tatsächlich registrierten Action-Handler ab.
3. **Komponenten-Shortcuts lückenhaft**: Neuere Komponenten wie `TTimer`, `TThresholdVariable`, `TInputController`, `TLink`, `TVideo` haben keine Convenience-API.
4. **User-Story-Interaktionen**: UseCase-Grund-API existiert, aber Interaktions-Diagramme und Extraktions-Logik sind nicht programmatisch erreichbar.

---

## Schritt 1: VariableType im AgentController vollständig unterstützen

### Warum
Der letzte Commit `fix: Threshold-Variable Auflösung und User-Story Diagramm-Anzeige` hat die Runtime für `TThresholdVariable` repariert. Der `AgentController` kann aber weiterhin keine Threshold-, Timer-, Random-, Range- oder List-Variablen anlegen.

### Betroffene Dateien
- `src/services/AgentController.ts` (Methode `addVariable`)
- `src/model/types.ts` (ggf. Erweiterung der Hilfs-Maps)

### Akzeptanzkriterien
- [ ] `addVariable()` akzeptiert alle Werte aus `VariableType`:
  - `integer`, `real`, `string`, `boolean`
  - `timer`, `interval` (falls gewünscht)
  - `random`, `range`
  - `list`, `object_list`, `map`
  - `threshold`, `trigger`
  - `keystore`, `json`, `any`
- [ ] Für jeden Typ wird ein sinnvoller `className` gesetzt (`TIntegerVariable`, `TRealVariable`, `TTimer`, `TRandomVariable`, `TRangeVariable`, `TListVariable`, `TObjectList`, `TStringMap`, `TThresholdVariable`, `TTriggerVariable`, `TKeyStore`, etc.).
- [ ] Threshold-Variablen können `threshold`, `comparison`, `onThresholdReached`, `onThresholdLeft` übergeben bekommen.
- [ ] Timer-/Random-/Range-Variablen können ihre spezifischen Eigenschaften (`duration`, `min`, `max`, `isRandom`, `isInteger`) übergeben bekommen.
- [ ] Scope-Handling bleibt konsistent (`global`, `stage`, `local`).
- [ ] Bestehende Variablen-Tests laufen noch.

### Vorschlag für neue Signatur
```ts
public addVariable(
  name: string,
  type: VariableType,
  initialValue: any,
  scope: VariableScope = 'global',
  options?: {
    threshold?: number;
    comparison?: ThresholdComparison;
    onThresholdReached?: string;
    onThresholdLeft?: string;
    duration?: number;
    min?: number;
    max?: number;
    isRandom?: boolean;
    isInteger?: boolean;
    className?: string;
  }
): void
```

---

## Schritt 2: ActionType mit Runtime synchronisieren

### Warum
`model/types.ts` definiert eine feste Union `ActionType`, die viele neuere Action-Handler nicht enthält. Dadurch kann `AgentController.addAction()` diese Actions nicht typsicher erzeugen.

### Betroffene Dateien
- `src/model/types.ts` (`ActionType` Union)
- `src/services/AgentController.ts` (`addAction` / `ensureActionDefined`)
- `src/runtime/actions/handlers/*.ts` (nur lesend zur Abgleich)

### Akzeptanzkriterien
- [ ] `ActionType` enthält alle tatsächlich registrierten Action-Handler:
  - `property`, `increment`, `negate`
  - `variable`, `set_variable`
  - `calculate`, `call_method`
  - `navigate`, `navigate_stage`, `restart_game`
  - `play_audio`, `stop_audio`
  - `spawn_object`, `destroy_object`
  - `list_*`, `map_*`
  - `bind_event`, `unbind_event`
  - `show_toast`, `toggle_dialog`
  - `move_to`, `sprite_animate`
  - `set_child_property`
  - `http`, `respond_http`, `handle_api_request`, `execute_login_request`
  - `service`, `data_action`
  - `store_token`, `load_theme_map`
  - `create_room`, `join_room`
- [ ] Verwaiste/umbrauchte Typen (`audio`, `smooth_sync`, `send_multiplayer_sync`, `engine_control`, `server_connect`, `server_create_room`, `server_join_room`, `server_ready`, `broadcast`) werden als veraltet markiert oder entfernt.
- [ ] `AgentController.addAction()` validiert ggf. `requiredParams` für die neuen Action-Typen (optional).
- [ ] Bestehende Action-Tests laufen noch.

---

## Schritt 3: Komponenten-Shortcuts für neue Komponenten

### Warum
`addObject()` ist generisch, aber für LLM-generierte Builder-Scripts braucht man typsichere Convenience-Methoden mit sinnvollen Defaults.

### Betroffene Dateien
- `src/services/AgentController.ts` (neue Methoden)
- `src/services/AgentShortcuts.ts` (ggf. Ergänzungen)

### Akzeptanzkriterien
- [ ] `createTimer(stageId, name, x, y, opts)` – `TTimer` / `TIntervalTimer` mit `interval`, `enabled`, `maxInterval`.
- [ ] `createThresholdVariable(stageId, name, x, y, opts)` – `TThresholdVariable` mit `threshold`, `comparison`, `value`, `onThresholdReached`.
- [ ] `createInputController(stageId, name, opts)` – `TInputController` mit `keyBindings`.
- [ ] `createButton(stageId, name, x, y, caption, opts)` – `TButton` (falls nicht schon in `AgentShortcuts` ausreichend).
- [ ] `createVideo(stageId, name, x, y, width, height, videoSource, opts)` – `TVideo`.
- [ ] `createLink(stageId, name, x, y, url, opts)` – `TLink`.
- [ ] `createStickyNote(stageId, name, x, y, text, opts)` – `TStickyNote` (wenn relevant für Gameplay-Builder).
- [ ] `createProgressBar(stageId, name, x, y, width, height, opts)` – `TProgressBar`.
- [ ] Dokumentation in `docs/AGENT_API_REFERENCE.md` wird aktualisiert.

---

## Schritt 4: Event- und Binding-API für Variablen erweitern

### Warum
Threshold- und Timer-Variablen brauchen Task-Events (`onThresholdReached`, `onTimer`). Der AgentController hat `connectEvent()` für Objekte, aber Variablen-Events werden nicht explizit unterstützt.

### Betroffene Dateien
- `src/services/AgentController.ts`

### Akzeptanzkriterien
- [ ] `connectVariableEvent(variableName, eventName, taskName)` ermöglicht das Verknüpfen von Variablen-Events mit Tasks.
- [ ] Oder: `addVariable()` akzeptiert direkt `onThresholdReached`/`onTimer`/`onValueChanged` als Task-Name und speichert sie im `ProjectVariable`.
- [ ] Validierung: referenzierter Task muss existieren.

---

## Schritt 5: AgentShortcuts aktualisieren

### Warum
`AgentShortcuts` soll die neuen AgentController-Methoden für typische Game-Patterns nutzen (z.B. Score-System mit Timer, Timer-getriggerte Thresholds).

### Betroffene Dateien
- `src/services/AgentShortcuts.ts`

### Akzeptanzkriterien
- [ ] `createTimerBasedScoreSystem()` oder ähnliches Template nutzt `createTimer` + `createThresholdVariable`.
- [ ] `createCountdownTimer(name, stageId, seconds)` erzeugt einen Countdown mit `TTimer`/`TIntervalTimer`.
- [ ] `createThresholdTrigger(name, threshold, taskName)` erzeugt eine Threshold-Variable und verbindet `onThresholdReached`.
- [ ] Keine doppelten Methoden zwischen `AgentController` und `AgentShortcuts` (z.B. `createButton` ggf. verschieben).

---

## Schritt 6: Tests und Validierung

### Betroffene Dateien
- `tests/agent_controller.test.ts`
- ggf. neue Test-Dateien

### Akzeptanzkriterien
- [ ] Test: Threshold-Variable über `AgentController.addVariable()` anlegen.
- [ ] Test: `onThresholdReached` mit Task verknüpfen.
- [ ] Test: Timer-Variable anlegen und `connectEvent` verwenden.
- [ ] Test: Neue Action-Typen (`show_toast`, `bind_event`, `navigate_stage`) über `addAction()` erzeugen.
- [ ] Test: `AgentController.validate()` erkennt keine Inline-Actions und keine fehlenden Referenzen.
- [ ] Gesamte Test-Suite läuft erfolgreich.

---

## Schritt 7: Dokumentation aktualisieren

### Betroffene Dateien
- `docs/AGENT_API_REFERENCE.md`
- `docs/AgentController_FeatureAlignment.md` (diese Datei – Status anpassen)

### Akzeptanzkriterien
- [ ] API-Reference listet alle neuen Methoden und Parameter.
- [ ] Beispiel-Builder-Script verwendet Threshold-Variable + Timer.
- [ ] Dieser Plan wird durchgestrichen/aktualisiert, sobald ein Schritt erledigt ist.

---

## Nicht in Scope (UI-only Features)

Folgende Features sind eher UI/Editor-relevant und müssen nicht zwingend in den AgentController:

- HelpOverlay (reiner Editor-Dialog)
- Sticky-Note Toolbar / Formatierung
- User-Story-Interaktions-Diagramme (sind Anzeige-Feature, keine Gameplay-Logik)
- Management-Tab / Refactoring-Dialoge
- `EditorViewManager`-Rendering-Details

Falls gewünscht, können diese später in einem separaten Schritt 8 ergänzt werden.

---

## Nächster Schritt vorschlagen

Empfohlene Reihenfolge: **Schritt 1 → Schritt 2 → Schritt 3 → Schritt 4 → Schritt 5 → Schritt 6 → Schritt 7**.

Soll ich mit **Schritt 1** (`addVariable()` für alle Variablen-Typen erweitern) beginnen?
