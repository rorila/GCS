# AgentController-Skript Import/Export – Implementierungsplan

## Ziel

Nutzer sollen einzelne, wiederverwendbare **AgentController-Logik-Bausteine** (Snippets) als JSON-basierte Operation-Listen exportieren und in andere Projekte/Stages importieren können. Das ist bewusst kein Ersatz für den bestehenden Spiel/Stage-JSON-Export, sondern eine Ergänzung auf **Skript-Ebene**.

---

## 1. Grundidee: Skript als JSON-Operation-Liste

Ein AgentController-Skript ist eine deklarative Liste von Methodenaufrufen, die 1:1 an `AgentController.executeBatch()` übergeben werden kann.

```json
{
  "version": "1.0",
  "name": "CountdownScoreSystem",
  "description": "Timer erhöht Score jede Sekunde. Optional: Highscore-Toast bei Threshold.",
  "author": "game-builder",
  "requiredVariables": [],
  "createdAt": "2026-07-02T12:00:00Z",
  "operations": [
    { "method": "addVariable", "params": ["score", "integer", 0, "global"] },
    { "method": "createIntervalTimer", "params": ["stage_main", "ScoreTimer", 0, 0, { "duration": 1000, "count": 0, "enabled": false }] },
    { "method": "createTask", "params": ["stage_main", "IncrementScore", "Score +1"] },
    { "method": "addAction", "params": ["IncrementScore", "calculate", "AddScore", { "formula": "score + 1", "resultVariable": "score" }] },
    { "method": "connectEvent", "params": ["stage_main", "ScoreTimer", "onIntervall", "IncrementScore"] }
  ]
}
```

**Vorteile dieses Formats:**
- Kein ausführbarer Code → kein XSS/Eval-Risiko
- Direkt mit `executeBatch()` anwendbar
- Lesbar, diffbar, LLM-generierbar
- Kleine Dateien im Vergleich zu vollständigem Stage-JSON

---

## 2. Datenmodell

### 2.1 `AgentScript`

```typescript
export interface AgentScript {
  version: string;              // z.B. "1.0"
  name: string;                 // Identifier, Dateiname-Vorschlag
  description?: string;
  author?: string;
  tags?: string[];              // ["timer", "score", "ui"]
  requiredVariables?: string[]; // Namen, die im Zielprojekt existieren müssen
  requiredStages?: string[];    // z.B. ["stage_main", "stage_blueprint"]
  placeholderSchema?: PlaceholderSchema[]; // Für UI-Dialog
  operations: AgentScriptOperation[];
}

export interface AgentScriptOperation {
  method: string;               // Muss eine public Methode auf AgentController sein
  params: any[];
}

export interface PlaceholderSchema {
  name: string;                 // z.B. "scoreVariable"
  type: 'variable' | 'stage' | 'object' | 'task' | 'text' | 'number' | 'boolean';
  default?: any;
  description?: string;
  required: boolean;
}
```

### 2.2 `AgentScriptIO`

```typescript
export interface ImportOptions {
  targetStageId?: string;       // Stage, in die importiert wird (falls Skript stage-agnostisch ist)
  conflictStrategy: 'error' | 'rename' | 'overwrite' | 'skip';
  autoRenameSuffix?: string;    // default: "_import"
  dryRun?: boolean;             // Nur validieren, nicht anwenden
  placeholderValues?: Record<string, any>;
}

export interface ImportResult {
  success: boolean;
  appliedOperations: number;
  warnings: string[];
  errors: string[];
  renamedItems: Record<string, string>; // original → renamed
  projectSnapshotBefore?: string;       // Für Undo
}

export interface ExportOptions {
  scope: 'project' | 'stage' | 'task' | 'selection';
  targetId?: string;            // Stage- oder Task-Name
  includeOnly?: string[];       // Filter nach Methoden, z.B. ["createTimer", "addAction"]
  exclude?: string[];           // z.B. ["createSprite", "setProperty"]
  withPlaceholders?: boolean;   // Ersetze konkrete Namen durch ${PLACEHOLDER}
}
```

---

## 3. Architektur

### 3.1 Neue Dateien

```
src/services/agent/
├── AgentProjectModule.ts     # (geplant) Stages, Objects, Variables
├── AgentTaskModule.ts        # (geplant) Tasks, Actions, Branches
├── AgentUIModule.ts          # (geplant) Bindings, Events, Properties
├── AgentShortcutModule.ts    # Komponenten-Shortcuts (bereits ausgelagert)
├── AgentScriptIO.ts          # Import/Export-Logik
├── AgentScriptValidator.ts   # Schema- & Konsistenz-Validierung
└── AgentScriptRepository.ts  # Speichern/Laden aus Datei/Storage
```

### 3.2 Integration in AgentController

```typescript
export class AgentController {
  private shortcutModule: AgentShortcutModule;
  private scriptIO: AgentScriptIO;

  public exportScript(options: ExportOptions): AgentScript {
    return this.scriptIO.exportScript(options);
  }

  public importScript(script: AgentScript, options?: ImportOptions): ImportResult {
    return this.scriptIO.importScript(script, options);
  }
}
```

### 3.3 Zusammenhang mit `executeBatch`

`AgentScriptIO.importScript()` nutzt intern `executeBatch()` mit dem Skript-Operationen-Array. Dadurch:
- Transaktionale Garantie (Rollback bei Fehler)
- Sofortige Verfügbarkeit aller AgentController-Methoden
- Keine neue Ausführungsengine nötig

### 3.4 Zusammenhang mit Modularisierung

Die laufende Aufteilung des `AgentController` in Module passt perfekt zu `AgentScriptIO`:

| Modul | Exportierbare Operationen | Beispiel-Operationen im Skript |
|---|---|---|
| `AgentProjectModule` | Projekt-Struktur | `createStage`, `addObject`, `addVariable` |
| `AgentTaskModule` | Logik & Ablauf | `createTask`, `addAction`, `addBranch` |
| `AgentUIModule` | Interaktion | `connectEvent`, `connectVariableEvent`, `bindVariable` |
| `AgentShortcutModule` | Komponenten-Factory | `createSprite`, `createTimer`, `createButton` |
| `AgentScriptIO` | Meta-Operationen | `exportScript`, `importScript` (nicht exportierbar) |

**Vorteile der Kombination:**

1. **Jedes Modul kann seine Operationen selbst beschreiben.**
   Statt `AgentScriptValidator` hartkodiert alle Methoden zu prüfen, könnte jedes Modul eine `getSupportedOperations()`-Methode bereitstellen.

2. **Export wird modular.**
   `exportScript()` fragt das passende Modul: Export eines Tasks → `AgentTaskModule`, Export eines Objekts → `AgentProjectModule` / `AgentShortcutModule`.

3. **Import-Validierung ist sauberer.**
   Der Validator prüft, ob eine Operation auf einem der bekannten Module existiert, anstatt `AgentController` reflektieren zu müssen.

4. **Erweiterbarkeit.**
   Ein neues Modul (z.B. `AgentMultiplayerModule`) meldet automatisch seine Operationen an – Skript-Support kommt quasi gratis.

---

## 4. Implementierungsschritte

### Schritt 1: TypeScript-Interfaces definieren (ca. 1h)

Datei: `src/model/agentScript.ts` oder `src/services/agent/AgentScriptIO.ts`

- `AgentScript`, `AgentScriptOperation`, `PlaceholderSchema`, `ImportOptions`, `ImportResult`, `ExportOptions`
- Version-Konstante `AGENT_SCRIPT_VERSION = '1.0'`

### Schritt 2: `AgentScriptValidator` implementieren (ca. 2h)

Datei: `src/services/agent/AgentScriptValidator.ts`

**Validierungsregeln:**

1. **Schema-Validierung:**
   - `version` vorhanden und unterstützt
   - `name` vorhanden und nicht leer
   - `operations` ist ein Array
   - Jede Operation hat `method` (string) und `params` (array)

2. **Methoden-Validierung:**
   - `method` ist eine public Methode auf `AgentController`
   - `method` ist nicht auf einer Blockliste (z.B. `deleteTask`, `executeBatch` selbst, `setProject`)

3. **Referenz-Validierung:**
   - In `requiredVariables` genannte Variablen existieren im Zielprojekt
   - In `requiredStages` genannte Stages existieren
   - In Operationen referenzierte Task-Namen, Action-Namen und Objekt-Namen sind konsistent

4. **Konflikt-Vorabprüfung:**
   - Wenn `conflictStrategy === 'error'`: Vorhandene Namen im Skript führen zu Fehler

```typescript
export class AgentScriptValidator {
  public static validate(script: AgentScript, controller: AgentController, options?: ImportOptions): { valid: boolean; errors: string[]; warnings: string[] };
  public static validateMethod(methodName: string): boolean;
}
```

### Schritt 3: `AgentScriptRepository` implementieren (ca. 1,5h)

Datei: `src/services/agent/AgentScriptRepository.ts`

Zuständigkeiten:
- Speichern eines Skripts als JSON-Datei
- Laden eines Skripts aus JSON-Datei
- Liste verfügbarer Skripte im Workspace/Storage

```typescript
export class AgentScriptRepository {
  public save(script: AgentScript, path: string): void;
  public load(path: string): AgentScript;
  public list(directory: string): AgentScript[];
}
```

Im Browser kann diese Klasse gegen einen Storage-Adapter (LocalStorage, IndexedDB, Backend) austauschbar gemacht werden.

### Schritt 4: `AgentScriptIO` implementieren (ca. 3h)

Datei: `src/services/agent/AgentScriptIO.ts`

#### Export-Algorithmus

**Export-Scope: `stage`**

1. Stage anhand `targetId` finden
2. Alle Tasks der Stage sammeln
3. Für jeden Task:
   - `createTask(stageId, taskName, description)` als Operation
   - Für jedes `SequenceItem` vom Typ `action`:
     - Action-Definition aus `stage.actions` oder `blueprint.actions` finden
     - `addAction(taskName, actionType, actionName, params)` als Operation
   - Für jedes Event-Binding auf Objekten:
     - `connectEvent(stageId, objectName, eventName, taskName)` als Operation
4. Alle Stage-Variablen als `addVariable` oder `addObject` (je nach Typ) exportieren
5. Optional: FlowChart-Layout-Informationen ignorieren (wird neu generiert)

**Export-Scope: `task`**

Nur Schritt 3 für einen einzelnen Task.

**Export-Scope: `selection`**

Nutzer wählt im Editor mehrere Tasks/Actions/Objekte aus. Es werden nur diese exportiert.

#### Import-Algorithmus

1. **Snapshot** des aktuellen Projekts speichern (für Rollback)
2. **Platzhalter auflösen:**
   - Ersetze `${STAGE}` durch `targetStageId`
   - Ersetze benutzerdefinierte Platzhalter durch Werte aus `placeholderValues`
3. **Konflikte vorab prüfen:**
   - Sammle alle Namen, die das Skript erzeugen will
   - Vergleiche mit existierenden Namen
   - Wende `conflictStrategy` an (`error`, `rename`, `overwrite`, `skip`)
4. **Operationen transformieren:**
   - Bei Rename: tausche alten Namen in allen `params` gegen neuen Namen aus
5. **Validierung laufen lassen:**
   - `AgentScriptValidator.validate()`
   - Bei `dryRun`: Ergebnis zurückgeben, ohne anzuwenden
6. **Anwenden via `executeBatch()`**
7. **FlowCharts neu generieren** für alle betroffenen Tasks
8. **Ergebnisobjekt zurückgeben** mit `warnings`, `errors`, `renamedItems`

#### Konfliktstrategien im Detail

| Strategie | Verhalten bei doppeltem Namen |
|---|---|
| `error` | Import bricht ab, Fehler wird gemeldet |
| `rename` | Neuer Name bekommt Suffix (z.B. `Ball_import`). Referenzen im Skript werden angepasst |
| `overwrite` | Bestehendes Objekt/Task/Action wird überschrieben |
| `skip` | Bereits existierende Items werden übersprungen, neue trotzdem erstellt |

### Risiken minimieren – Konflikterkennung & Warn-Dialog

Bevor ein Skript angewendet wird, soll der Nutzer eine **klare Übersicht** über mögliche Probleme bekommen. Ziel: Keine Überraschungen, keine ungewollten Überschreibungen.

#### Vorschau-Dialog (Dry-Run)

Vor dem echten Import führt der Import-Dialog immer einen `dryRun` aus und zeigt:

1. **Zu erstellende Elemente** (grün)
   - 3 Objekte: `Ball`, `Paddle`, `ScoreLabel`
   - 2 Tasks: `MoveBall`, `OnScoreChanged`
   - 2 Actions: `UpdateBall`, `ShowToast`
   - 1 Variable: `score`

2. **Warnungen** (gelb)
   - `Task 'MoveBall' existiert bereits.`
   - `Variable 'score' existiert bereits.`
   - `Objekt 'Ball' wird umbenannt zu 'Ball_import'.`

3. **Fehler, die einen Import verhindern** (rot)
   - `Stage 'stage_main' aus dem Skript existiert nicht im Zielprojekt.`
   - `Action 'UpdateBall' referenziert Task 'OnScoreChanged', der im Zielprojekt nicht existiert.`
   - `ActionType 'show_toast' ist in dieser Version der Runtime nicht registriert.`

4. **Abhängigkeiten**
   - `Skript benötigt Variable 'score' – existiert und ist Typ 'integer'. ✅`
   - `Skript benötigt Stage 'stage_blueprint' – existiert. ✅`

#### Konflikt-Auflösung pro Item

Statt einer globalen Strategie kann der Nutzer pro Konflikt entscheiden:

| Konflikt | Mögliche Aktionen |
|---|---|
| Task existiert | überspringen / umbenennen / überschreiben / abbrechen |
| Variable existiert | überspringen / umbenennen / überschreiben / verbinden |
| Objekt existiert | überspringen / umbenennen / überschreiben |
| Action existiert | überspringen / umbenennen / überschreiben |
| Referenz fehlt | ignorieren (wird Fehler) / Auto-Import / abbrechen |

#### Automatische Vorschläge

- Bei `rename`: `Ball` → `Ball_import` (oder fortlaufend `Ball_import_2`, falls auch das existiert)
- Bei `overwrite`: Bestehendes Element vorselektieren, Vorschau der Unterschiede anzeigen
- Bei Stage-Mismatch: Vorschlag, `stage_main` aus dem Skript auf die aktuell offene Stage zu mappen

#### Import-Report nach Anwendung

Sofort nach dem Import zeigt der Editor einen Report:

```
Import erfolgreich: 7/7 Operationen angewendet
- Erstellt: 3 Objekte, 2 Tasks, 2 Actions, 1 Variable
- Umbenannt: Ball → Ball_import
- Übersprungen: Task 'MoveBall'
- Warnungen: 1 (siehe Details)
```

Mit einem **Undo-Button** („Import rückgängig machen“), der das Projekt auf den Snapshot vor dem Import zurücksetzt.

#### Implementierungsanpassung für den Import-Algorithmus

`AgentScriptIO.importScript()` sollte in drei Phasen arbeiten:

1. **Analyse**: Sammle alle geplanten Änderungen und Konflikte
2. **Interaktion**: Zeige Vorschau (bei UI) oder wende `conflictStrategy` an (bei headless)
3. **Anwendung**: Nur wenn Nutzer bestätigt oder `autoApply: true`

```typescript
export interface ImportResult {
  success: boolean;
  phase: 'analysis' | 'applied' | 'cancelled';
  plannedOperations: number;
  appliedOperations: number;
  conflicts: ImportConflict[];
  warnings: string[];
  errors: string[];
  renamedItems: Record<string, string>;
  skippedItems: string[];
  canUndo: boolean;
}

export interface ImportConflict {
  type: 'task' | 'action' | 'object' | 'variable' | 'stage' | 'reference' | 'api_version';
  name: string;
  existingType?: string;
  scriptType?: string;
  action: 'error' | 'rename' | 'overwrite' | 'skip' | 'pending_user_choice';
  message: string;
  suggestedName?: string;
}
```

### Schritt 5: AgentController-Integration (ca. 1h)

- `AgentScriptIO` als private Feld in `AgentController` hinzufügen
- Public Methoden `exportScript()` und `importScript()` delegieren dorthin
- Keine Breaking Changes an der bestehenden API

### Schritt 6: UI-Integration (ca. 3–5h)

**Editor-Oberfläche:**

1. **Export-Dialog:**
   - Auswahl: Gesamtes Spiel / Stage / Ausgewählte Tasks / Ausgewählte Objekte
   - Name und Beschreibung eingeben
   - Checkbox: „Platzhalter für Stages/Variablen verwenden“
   - Download als `.agent.json`-Datei

2. **Import-Dialog:**
   - Datei hochladen oder aus Bibliothek wählen
   - Vorschau der Operationen anzeigen
   - Platzhalter-Werte abfragen (falls im Skript definiert)
   - Konfliktstrategie wählen
   - „Trockenlauf“-Button für Validierung ohne Anwendung

3. **Snippet-Bibliothek:**
   - Liste gespeicherter Skripte im Projekt/Workspace
   - Drag-and-Drop in Stage/FlowChart
   - Tags und Filter

### Schritt 7: Tests (ca. 2h)

Datei: `tests/agent_script_io.test.ts`

**Testfälle:**

1. Export einer Stage mit Objekten, Tasks und Actions
2. Export eines einzelnen Tasks
3. Import eines Skripts in leeres Projekt
4. Import mit `conflictStrategy: 'rename'`
5. Import mit `conflictStrategy: 'overwrite'`
6. Import mit `dryRun: true`
7. Import mit ungültiger Methode → Fehler
8. Import mit fehlenden `requiredVariables` → Fehler
9. Platzhalter-Ersetzung während Import
10. Rollback bei fehlerhaftem Import

---

## 5. Beispiel: Pong-Ball-Snippet

### Exportiertes Skript

```json
{
  "version": "1.0",
  "name": "PongBallPhysics",
  "description": "Erstellt einen Ball-Sprite mit Kollision und Reflexions-Task.",
  "tags": ["physics", "sprite", "pong"],
  "requiredVariables": [],
  "requiredStages": ["stage_main"],
  "placeholderSchema": [
    { "name": "STAGE", "type": "stage", "default": "stage_main", "required": true },
    { "name": "BALL_NAME", "type": "text", "default": "Ball", "required": true }
  ],
  "operations": [
    {
      "method": "createSprite",
      "params": ["${STAGE}", "${BALL_NAME}", 18, 10, 2, 2, { "velocityX": 3, "velocityY": 3, "collisionEnabled": true, "shape": "circle" }]
    },
    {
      "method": "createTask",
      "params": ["${STAGE}", "BounceBall", "Ball-Reflexion"]
    },
    {
      "method": "addAction",
      "params": ["BounceBall", "calculate", "FlipX", { "formula": "${BALL_NAME}.velocityX * -1", "resultVariable": "${BALL_NAME}.velocityX" }]
    }
  ]
}
```

### Import-Aufruf

```typescript
const script = repository.load('./snippets/PongBallPhysics.agent.json');
const result = agent.importScript(script, {
  targetStageId: 'stage_main',
  conflictStrategy: 'rename',
  placeholderValues: { BALL_NAME: 'MyBall' },
  dryRun: false
});

console.log(result.warnings);
console.log(result.renamedItems);
```

---

## 6. Sicherheitsaspekte

| Gefahr | Maßnahme |
|---|---|
| XSS durch `eval()` | Keine JavaScript-Ausführung. Skripte sind JSON-Operation-Listen |
| Überschreiben wichtiger Daten | `conflictStrategy` default = `error`, Undo-Snapshot vor Import |
| Import inkompatibler API-Version | `version` prüfen; Migrationen für zukünftige Versionen vorsehen |
| Privatmethoden aufrufen | `AgentScriptValidator` prüft, ob Methode public und auf Allowlist ist |
| Endlosschleifen / teure Operationen | Optional: Limit für max. Operationen pro Import |

---

## 7. Dateiendung & Speicherort

- **Endung:** `.agent.json` (oder `.gbs` = Game Builder Script)
- **Standard-Speicherort:**
  - Node/Electron: `snippets/` im Projektordner oder globaler App-Data-Pfad
  - Browser: IndexedDB / LocalStorage

---

## 8. Offene Design-Entscheidungen

1. **Sollen FlowChart-Layouts exportiert werden?**
   - ✅ Akzeptiert: Nein. Layouts werden nach dem Import via `generateTaskFlow()` neu erzeugt.

2. **Sollen IDs stabil bleiben?**
   - ✅ Akzeptiert: Beim Import neue IDs generieren, um Kollisionen zu vermeiden. Bei `overwrite` IDs des bestehenden Items übernehmen.

3. **Sollen Variablen global oder stage-lokal importiert werden?**
   - ✅ Akzeptiert: Wie im Skript definiert. Falls `targetStageId` angegeben und Skript stage-agnostisch, dann Stage-Scope verwenden.

4. **Wie werden Referenzen auf externe Assets (Bilder, Sounds, Videos) behandelt?**
   - ✅ Akzeptiert: Beim Export werden alle Asset-Pfade gesammelt. Beim Import wird geprüft, ob die Dateien existieren. Falls nicht: Warnung, aber Import wird nicht blockiert.
   - Optional: Nutzer kann Pfade während des Imports remappen (z.B. `old/assets/ball.png` → `new/assets/ball.png`).

---

## 9. Aufwandsschätzung

| Schritt | Geschätzter Aufwand |
|---|---|
| Interfaces & Datenmodell | 1h |
| Validator | 2h |
| Repository | 1,5h |
| AgentScriptIO (Export/Import) | 3h |
| AgentController-Integration | 1h |
| UI-Dialoge | 4h |
| Tests | 2h |
| Dokumentation | 1h |
| **Gesamt** | **~15,5h** |

---

## 10. Umsetzungsstand

| Schritt | Status | Dateien |
|---|---|---|
| 1. Interfaces & Datenmodell | ✅ Erledigt | `src/services/agent/AgentScriptTypes.ts` |
| 2. Validator | ✅ Erledigt | `src/services/agent/AgentScriptValidator.ts` |
| 3. Repository | ✅ Erledigt | `src/services/agent/AgentScriptRepository.ts` |
| 4. AgentScriptIO (Export/Import) | ✅ Grundgerüst erledigt | `src/services/agent/AgentScriptIO.ts` |
| 5. AgentController-Integration | ✅ Erledigt | `src/services/AgentController.ts` |
| 6. UI-Integration | ✅ Minimaler Dialog erledigt | `src/editor/dialogs/AgentScriptDialog.ts` |
| 7. Tests | ✅ Grundlegend erledigt | `tests/agent_script_io.test.ts` |
| 8. Dokumentation | ✅ Erledigt | `docs/AGENT_API_REFERENCE.md` |

**Noch offen / Ausbau:**
- Interaktiver Vorschau-Dialog mit Konflikt-Auflösung pro Item
- Snippet-Bibliothek im Editor
- Verdrahtung in Menüleiste / Toolbar

## 11. Empfohlener Start

1. Mit **Schritt 1–3** beginnen (Interfaces, Validator, Repository). Rückenrat hohes Fundament.
2. Dann **Schritt 4** implementieren, zuerst nur Export-Scope `task` und Import-Mode `error`.
3. Schnelles Demo: Ein Task als `.agent.json` exportieren und in ein anderes Projekt importieren.
4. Danach Schritt für Schritt erweitern: `stage`-Scope, `rename`, Platzhalter, UI.
