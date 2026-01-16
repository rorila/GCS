# Refactoring Plan: Unified Game Runtime

## Problemstellung

Aktuell existieren **zwei separate Player-Implementierungen** mit erheblicher Code-Duplizierung:

1. **`src/player.ts`** (Editor-Preview, ~329 Zeilen)
   - Läuft innerhalb des Editors
   - Nutzt `Stage.renderObjects()` für Rendering
   - Unterstützt nur Basis-Actions (property, increment, negate, variable)
   - Keine Multiplayer-Unterstützung

2. **`game-server/public/player.html`** (Standalone-Runtime, ~1398 Zeilen)
   - Läuft eigenständig im Browser
   - Eigenes DOM-Rendering für alle Komponenten
   - Vollständige Action-Unterstützung (navigate, create_room, join_room, smooth_sync, etc.)
   - Vollständige Multiplayer-Engine mit WebSocket

### Duplizierte Logik

- **Task Execution**: Fast identischer Code in beiden Dateien
- **Action Execution**: Überlappende Implementierungen
- **Property Handling**: Identische get/set-Logik
- **Event Handling**: Ähnliche Event-Dispatcher

---

## Ziele

1. ✅ **Eliminiere Code-Duplizierung** durch gemeinsame Runtime-Bibliothek
2. ✅ **Vereinfache Wartung** - Bugfixes und neue Features nur einmal implementieren
3. ✅ **Behalte Flexibilität** - Editor und Standalone können unterschiedliche Rendering-Strategien nutzen
4. ✅ **Keine Breaking Changes** - Bestehende Spiele funktionieren weiterhin

---

## Architektur-Übersicht

```
src/
  runtime/                          ← NEU: Gemeinsame Runtime-Bibliothek
    GameRuntime.ts                  ← Kern-Engine (Task/Action Execution)
    ActionExecutor.ts               ← Action-Typen (property, increment, navigate, etc.)
    PropertyHelper.ts               ← Property get/set/interpolation
    EventDispatcher.ts              ← Event-Handling-Logik
    types.ts                        ← Runtime-spezifische Typen
    
  player.ts                         ← REFACTORED: Nutzt runtime/*
  editor/
    Stage.ts                        ← Bleibt unverändert
    
game-server/
  public/
    player.html                     ← REFACTORED: Nutzt gebündeltes runtime/*
```

---

## Phasen-Plan

### **Phase 1: Runtime-Kern extrahieren** (Priorität: HOCH)

#### 1.1 Erstelle `src/runtime/PropertyHelper.ts`

**Zweck:** Gemeinsame Property-Zugriffs-Logik

**Funktionen:**
- `getPropertyValue(obj, propPath)` - Liest verschachtelte Properties (z.B. `style.backgroundColor`)
- `setPropertyValue(obj, propPath, value)` - Setzt verschachtelte Properties
- `interpolateVariables(template, vars)` - Ersetzt `${varName}` in Strings

**Quellen:**
- `player.ts:296-324`
- `player.html:1366-1390`

---

#### 1.2 Erstelle `src/runtime/ActionExecutor.ts`

**Zweck:** Alle Action-Typen zentral implementieren

**Action-Typen:**
- `variable` - Liest Property in Variable
- `set_variable` - Setzt Variable direkt
- `property` - Setzt Object-Property
- `increment` - Inkrementiert numerische Property
- `negate` - Negiert numerische Property
- `navigate` - Wechselt zu anderem Spiel
- `create_room` - Erstellt Multiplayer-Raum
- `join_room` - Tritt Multiplayer-Raum bei
- `send_multiplayer_sync` - Sendet State-Sync
- `smooth_sync` - Wendet Remote-State an

**Interface:**
```typescript
export class ActionExecutor {
    constructor(
        private objects: any[],
        private propertyHelper: PropertyHelper,
        private multiplayerManager?: MultiplayerManager
    ) {}
    
    execute(action: Action, vars: Record<string, any>): void {
        // Zentrale Action-Ausführung
    }
}
```

**Quellen:**
- `player.ts:236-293`
- `player.html:1158-1364`

---

#### 1.3 Erstelle `src/runtime/TaskExecutor.ts`

**Zweck:** Task-Sequenzen ausführen (Actions, Conditions, Sub-Tasks)

**Interface:**
```typescript
export class TaskExecutor {
    constructor(
        private tasks: Task[],
        private actionExecutor: ActionExecutor
    ) {}
    
    execute(taskName: string, vars: Record<string, any>, depth: number): void {
        // Task-Sequenz durchlaufen
        // Conditions evaluieren
        // Actions/Sub-Tasks ausführen
    }
}
```

**Quellen:**
- `player.ts:184-234`
- `player.html:1103-1156`

---

#### 1.4 Erstelle `src/runtime/GameRuntime.ts`

**Zweck:** Haupt-Orchestrator - verbindet alle Runtime-Komponenten

**Interface:**
```typescript
export class GameRuntime {
    private taskExecutor: TaskExecutor;
    private actionExecutor: ActionExecutor;
    private propertyHelper: PropertyHelper;
    
    constructor(
        private project: GameProject,
        private objects: any[],
        private options: {
            multiplayerManager?: MultiplayerManager;
            globalVars?: Record<string, any>;
        } = {}
    ) {
        this.propertyHelper = new PropertyHelper();
        this.actionExecutor = new ActionExecutor(
            objects, 
            this.propertyHelper, 
            options.multiplayerManager
        );
        this.taskExecutor = new TaskExecutor(
            project.tasks, 
            this.actionExecutor
        );
    }
    
    // Event-Handler
    handleEvent(objectId: string, eventName: string, data?: any): void {
        // Findet Task für Event
        // Initialisiert Variablen
        // Führt Task aus
    }
    
    // Getter für Objekte (für Rendering)
    getObjects(): any[] {
        return this.objects;
    }
}
```

---

### **Phase 2: Editor-Player refactoren** (Priorität: MITTEL)

#### 2.1 Refactore `src/player.ts`

**Änderungen:**
```typescript
import { GameRuntime } from './runtime/GameRuntime';

export class Player {
    private stage: Stage;
    private runtime: GameRuntime | null = null;
    
    private async loadGame() {
        // ... JSON laden ...
        
        const objects = hydrateObjects(this.project.objects);
        
        // Runtime initialisieren
        this.runtime = new GameRuntime(this.project, objects);
        
        // GameLoop/InputController starten (bleibt gleich)
        // ...
        
        // Initial render
        this.stage.renderObjects(this.runtime.getObjects());
    }
    
    private handleEvent(id: string, eventName: string) {
        if (!this.runtime) return;
        this.runtime.handleEvent(id, eventName);
        this.stage.renderObjects(this.runtime.getObjects());
    }
    
    private handleGameLoopEvent(id: string, eventName: string, data?: any) {
        if (!this.runtime) return;
        this.runtime.handleEvent(id, eventName, data);
        this.stage.renderObjects(this.runtime.getObjects());
    }
}
```

**Entfernte Methoden:**
- `executeTask()` → `GameRuntime.handleEvent()`
- `executeAction()` → `ActionExecutor.execute()`
- `getPropertyValue()` → `PropertyHelper.getPropertyValue()`
- `applyAction()` → `PropertyHelper.setPropertyValue()`

**Ergebnis:** ~150 Zeilen (statt 329)

---

### **Phase 3: Standalone-Player refactoren** (Priorität: HOCH)

#### 3.1 Build-Setup für `player.html`

**Problem:** `player.html` ist eine standalone HTML-Datei, kann TypeScript nicht direkt importieren.

**Lösung:** Webpack/Vite Bundle erstellen

**Neue Struktur:**
```
game-server/
  public/
    player.html          ← Lädt player-bundle.js
    player-bundle.js     ← Gebündeltes Runtime + Player-Logik
  src/
    player-standalone.ts ← NEU: Entry-Point für Bundle
```

**`game-server/src/player-standalone.ts`:**
```typescript
import { GameRuntime } from '../../src/runtime/GameRuntime';
import { MultiplayerManager } from './MultiplayerManager';

// Globale Klassen für player.html
(window as any).GameRuntime = GameRuntime;
(window as any).MultiplayerManager = MultiplayerManager;
```

**`player.html` Änderungen:**
```html
<!-- Statt inline <script> -->
<script src="player-bundle.js"></script>
<script>
    // Nutzt globale GameRuntime-Klasse
    const runtime = new GameRuntime(PROJECT, objects, {
        multiplayerManager: mpManager
    });
</script>
```

---

#### 3.2 Extrahiere `MultiplayerManager` in separate Datei

**Erstelle:** `game-server/src/MultiplayerManager.ts`

**Zweck:** WebSocket-Logik aus `player.html` extrahieren

**Quellen:**
- `player.html:254-431` (MultiplayerManager-Klasse)

---

#### 3.3 Refactore `player.html`

**Entfernte Logik:**
- Task/Action Execution → `GameRuntime`
- Property Handling → `PropertyHelper`
- Multiplayer-Klasse → `MultiplayerManager.ts`

**Verbleibende Logik:**
- DOM-Rendering (`render()`)
- Scaling/Responsive (`updateScale()`)
- Initialization (`loadGame()`, `switchGame()`)
- Keyboard Input (`setupKeyboard()`)

**Ergebnis:** ~600-800 Zeilen (statt 1398)

---

### **Phase 4: Testing & Validation** (Priorität: HOCH)

#### 4.1 Unit Tests für Runtime

**Erstelle:** `src/runtime/__tests__/`

**Test-Coverage:**
- `PropertyHelper.test.ts` - Property-Zugriff, Interpolation
- `ActionExecutor.test.ts` - Alle Action-Typen
- `TaskExecutor.test.ts` - Conditions, Sequenzen
- `GameRuntime.test.ts` - Integration

---

#### 4.2 End-to-End Tests

**Szenarien:**
1. ✅ Editor-Preview: Pong läuft im Editor
2. ✅ Standalone-Single: Pong läuft standalone
3. ✅ Standalone-Multi: Pong Multiplayer funktioniert
4. ✅ Lobby-Flow: Lobby → Spiel-Auswahl → Pong
5. ✅ Action-Tests: Alle Action-Typen funktionieren

---

## Migrations-Strategie

### Schritt 1: Parallel-Entwicklung (Woche 1-2)

- Erstelle `src/runtime/*` ohne bestehenden Code zu ändern
- Schreibe Unit Tests für Runtime
- Validiere mit Mock-Daten

### Schritt 2: Editor-Migration (Woche 3)

- Refactore `src/player.ts` zu Runtime
- Teste im Editor mit bestehenden Spielen
- Behebe Bugs

### Schritt 3: Standalone-Migration (Woche 4-5)

- Setup Build-Pipeline (Webpack/Vite)
- Extrahiere `MultiplayerManager`
- Refactore `player.html`
- Teste Multiplayer intensiv

### Schritt 4: Cleanup (Woche 6)

- Entferne duplizierten Code
- Dokumentation aktualisieren
- Performance-Optimierung

---

## Risiken & Mitigationen

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| Breaking Changes in bestehenden Spielen | Mittel | Hoch | Umfangreiche Tests, Feature-Flags |
| Build-Komplexität für player.html | Niedrig | Mittel | Einfaches Webpack-Setup, Fallback auf inline |
| Performance-Regression | Niedrig | Mittel | Benchmarks vorher/nachher |
| Multiplayer-Bugs | Mittel | Hoch | Separate Test-Umgebung, schrittweise Migration |

---

## Erfolgs-Kriterien

1. ✅ **Code-Reduktion:** Mindestens 40% weniger duplizierter Code
2. ✅ **Funktionalität:** Alle bestehenden Spiele funktionieren unverändert
3. ✅ **Wartbarkeit:** Neue Actions nur in einer Datei hinzufügen
4. ✅ **Performance:** Keine messbare Verschlechterung
5. ✅ **Tests:** >80% Code-Coverage für Runtime

---

## Nächste Schritte

> [!IMPORTANT]
> **Empfohlene Reihenfolge:**
> 
> 1. **Erstelle `PropertyHelper.ts`** (einfachster Start, sofort testbar)
> 2. **Erstelle `ActionExecutor.ts`** (größter Redundanz-Gewinn)
> 3. **Erstelle `TaskExecutor.ts`** (nutzt ActionExecutor)
> 4. **Erstelle `GameRuntime.ts`** (Orchestrator)
> 5. **Refactore `player.ts`** (schnelle Validierung)
> 6. **Setup Build für `player.html`** (größere Änderung)
> 7. **Refactore `player.html`** (finale Migration)

**Zeitaufwand:** 4-6 Wochen (bei Teilzeit-Entwicklung)

**Quick Win:** Starte mit Phase 1.1-1.4 und Phase 2 → Sofortiger Nutzen im Editor!
