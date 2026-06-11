# Migration: console.* → Logger

**Erstellt:** 11.06.2026  
**Überarbeitet:** 11.06.2026  
**Status:** Offen (51 aktive Stellen in 16 Dateien + 6 auskommentierte + 5 Logger-interne)  
**Ziel:** Alle `console.log/warn/error/info/debug` durch den projekteigenen `Logger` ersetzen

---

## Warum?

- Einheitliche Logging-Infrastruktur mit Kategorien und Zeitstempel
- Möglichkeit zum Deaktivieren/Filterung in Production
- Konsistentes Format für Debug-Ausgaben
- Vorbereitung für ESLint-Regel `no-console`

---

## Logger-API (bereits vorhanden)

```typescript
import { Logger } from '../utils/Logger';

// Pro Klasse/Modul eine Logger-Instanz
const logger = Logger.get('MeineKlasse');

// Level
logger.debug('Details', obj);   // Nur bei aktiviertem Debug-Level
logger.info('Info', data);      // Standard-Info
logger.warn('Warnung');         // Warnung
logger.error('Fehler', err);    // Fehler mit Stack
```

---

## Logger-Level-Konvention (VERBINDLICH)

Die Wahl des Logger-Levels muss **semantisch** erfolgen, nicht mechanisch (`console.log` ≠ automatisch `logger.info`):

| Level | Verwendung | Beispiel |
|-------|-----------|----------|
| `debug` | Entwickler-Tracing, Diagnose-Ausgaben, temporäre Debug-Hilfen. Wird in Production nicht angezeigt. | Drag-Positionen, Panel-Dimensionen, Object-IDs |
| `info` | Relevante Zustandsänderungen, die im Normalbetrieb nützlich sind. | Stage-Wechsel, Adapter-Installation, Property-Änderungen |
| `warn` | Unerwartete aber behandelte Situationen. Kein Crash, aber Aufmerksamkeit nötig. | Fehlende Callbacks, leere Filter, verworfene Logs |
| `error` | Fehler, die Funktionalität beeinträchtigen. Sofortige Aufmerksamkeit nötig. | Exceptions, kritische Build-Fehler, fehlende Elemente |

**Faustregel:** Wenn eine Ausgabe nur für aktives Debugging relevant ist → `debug`. Wenn sie auch im Staging-Betrieb sinnvoll wäre → `info`.

---

## Logger-Kategorie-Konvention

Der String für `Logger.get()` folgt diesen Regeln:

| Kontext | Kategorie-Format | Beispiel |
|---------|-------------------|----------|
| Klasse | Klassenname | `Logger.get('StageInteractionManager')` |
| Singleton/Service | Service-Name | `Logger.get('ProjectStore')` |
| Modul ohne Klasse | Dateiname ohne Extension | `Logger.get('NavigationActions')` |
| Komponente | Komponenten-Name | `Logger.get('TDebugLog')` |

---

## Vorab-Entscheidungen

### Tests: ESLint-Ausnahme (entschieden)

Test-Dateien (z. B. `ExpressionParser.test.ts`) dürfen `console.*` beibehalten. Grund: Test-Frameworks erwarten Konsolenausgaben für Ergebnis-Reporting. Die ESLint-Ausnahme wird per Datei-Override konfiguriert (siehe Abschnitt "Nach der Migration").

### Logger.ts: Selbstreferenz beibehalten

Die 5 `console.*`-Aufrufe in `Logger.ts` (Zeilen 101, 131, 134, 137, 140) sind die **interne Ausgabe-Implementierung** des Loggers selbst. Diese werden beibehalten und per `eslint-disable` markiert.

### Auskommentierter Code: Ignorieren

Die 6 auskommentierten `console.log`-Aufrufe in `GameLoopManager.ts` (Zeilen 551, 555, 560, 564, 567, 593) werden **nicht migriert**, da sie inaktiv sind. Bei Bedarf können sie beim nächsten Refactoring entfernt oder durch Logger ersetzt werden.

---

## Vollständige Fundstellenliste (priorisiert)

### Priorität 1: Kern-Editor (17 Stellen)

#### `StageInteractionManager.ts` — 7 Stellen
**Pfad:** `src/editor/services/StageInteractionManager.ts`

| Zeile | Aktuell | Neues Level | Begründung |
|-------|---------|-------------|------------|
| 180 | `console.log('[TGroupPanel Drop] Toolbox-Drop...')` | `debug` | Diagnose-Tracing für DnD |
| 199 | `console.log('[TGroupPanel Drop] Reparenting...')` | `debug` | Diagnose-Tracing für DnD |
| 521 | `console.log('[DND-LIVE-DRAG] RawMaus...')` | `debug` | Hochfrequentes Maus-Tracing |
| 631 | `console.log('[TGroupPanel DIAG] lastRenderedObjects...')` | `debug` | Diagnose-Ausgabe |
| 632 | `console.log('[TGroupPanel DIAG] Dragged obj absPos...')` | `debug` | Diagnose-Ausgabe |
| 665 | `console.log('[TGroupPanel DIAG] Panel...')` | `debug` | Diagnose-Ausgabe |
| 719 | `console.log('[DND-FLOW 1] Drag Ended...')` | `debug` | Diagnose-Tracing für DnD |

#### `InspectorEventHandler.ts` — 6 Stellen
**Pfad:** `src/editor/inspector/InspectorEventHandler.ts`

| Zeile | Aktuell | Neues Level | Begründung |
|-------|---------|-------------|------------|
| 111 | `console.info('[INSPECTOR-SYNC] BEFORE', {...})` | `debug` | Detailliertes Sync-Tracing |
| 134 | `console.info('[INSPECTOR-SYNC] handler', {...})` | `debug` | Detailliertes Sync-Tracing |
| 136 | `console.info('[INSPECTOR-SYNC] handler: <none>')` | `debug` | Detailliertes Sync-Tracing |
| 163 | `console.info('[INSPECTOR-SYNC] AFTER', {...})` | `debug` | Detailliertes Sync-Tracing |
| 171 | `console.info('[INSPECTOR-SYNC] SKIPPED...')` | `debug` | Detailliertes Sync-Tracing |
| 174 | `console.info('[INSPECTOR-SYNC] handler claimed...')` | `debug` | Detailliertes Sync-Tracing |

#### `EditorViewManager.ts` — 3 Stellen
**Pfad:** `src/editor/EditorViewManager.ts`

| Zeile | Aktuell | Neues Level | Begründung |
|-------|---------|-------------|------------|
| 299 | `console.log('[UserStories] Panel-Höhe gesetzt:...')` | `debug` | Layout-Diagnose |
| 300 | `console.log('[UserStories] Panel-Overflow gesetzt:...')` | `debug` | Layout-Diagnose |
| 301 | `console.log('[UserStories] Panel-Display gesetzt:...')` | `debug` | Layout-Diagnose |

#### `InspectorContextBuilder.ts` — 1 Stelle
**Pfad:** `src/editor/inspector/InspectorContextBuilder.ts`

| Zeile | Aktuell | Neues Level | Begründung |
|-------|---------|-------------|------------|
| 257 | `console.error('[CRITICAL] InspectorContextBuilder.build...')` | `error` | Kritischer Fehler — Level bleibt |

---

### Priorität 2: Editor-Renderer (5 Stellen)

#### `StageRenderer.ts` — 2 Stellen
**Pfad:** `src/editor/services/StageRenderer.ts`

| Zeile | Aktuell | Neues Level | Begründung |
|-------|---------|-------------|------------|
| 837 | `console.log('[VISIBILITY-DEBUG]... DESIGN MODE')` | `debug` | Sichtbarkeits-Diagnose |
| 843 | `console.log('[VISIBILITY-DEBUG]... RUN MODE')` | `debug` | Sichtbarkeits-Diagnose |

#### `ComplexComponentRenderer.ts` — 1 Stelle
**Pfad:** `src/editor/services/renderers/ComplexComponentRenderer.ts`

| Zeile | Aktuell | Neues Level | Begründung |
|-------|---------|-------------|------------|
| 401 | `console.log('[DIALOG-DEBUG] Drag START...')` | `debug` | Dialog-Drag-Diagnose |

#### `TextObjectRenderer.ts` — 1 Stelle
**Pfad:** `src/editor/services/renderers/TextObjectRenderer.ts`

| Zeile | Aktuell | Neues Level | Begründung |
|-------|---------|-------------|------------|
| 125 | `console.warn('[TextObjectRenderer] ctx.host.onEvent...')` | `warn` | Fehlendes Callback — Level bleibt |

#### `VirtualGamepadRenderer.ts` — 1 Stelle
**Pfad:** `src/editor/services/renderers/VirtualGamepadRenderer.ts`

| Zeile | Aktuell | Neues Level | Begründung |
|-------|---------|-------------|------------|
| 72 | `console.warn('[VirtualGamepadRenderer] Abgebrochen...')` | `warn` | Fehlerfall — Level bleibt |

#### `InspectorSectionRenderer.ts` — 1 Stelle
**Pfad:** `src/editor/inspector/renderers/InspectorSectionRenderer.ts`

| Zeile | Aktuell | Neues Level | Begründung |
|-------|---------|-------------|------------|
| 663 | `console.error('Fehler beim Auflösen der Repeater-Bindings:...')` | `error` | Exception-Handling — Level bleibt |

---

### Priorität 3: Services & Adapter (4 Stellen)

#### `ProjectStore.ts` — 2 Stellen
**Pfad:** `src/services/ProjectStore.ts`

| Zeile | Aktuell | Neues Level | Begründung |
|-------|---------|-------------|------------|
| 290 | `console.log('[ProjectStore] REDUCE SET_PROPERTY...')` | `debug` | State-Tracing |
| 293 | `console.log('[ProjectStore] After setPropertyValue...')` | `debug` | State-Tracing |

#### `DebugLogService.ts` — 2 Stellen
**Pfad:** `src/services/DebugLogService.ts`

| Zeile | Aktuell | Neues Level | Begründung |
|-------|---------|-------------|------------|
| 55 | `console.info('[DebugLogService] setEnabled...')` | `info` | Zustandsänderung — relevant |
| 90 | `console.warn('[DebugLogService] LOG VERWORFEN...')` | `warn` | Verworfene Logs — Warnung bleibt |

#### `TauriFSAdapter.ts` — 2 Stellen
**Pfad:** `src/utils/TauriFSAdapter.ts`

| Zeile | Aktuell | Neues Level | Begründung |
|-------|---------|-------------|------------|
| 21 | `console.error('TauriFSAdapter listFiles error:...')` | `error` | Exception — Level bleibt |
| 60 | `console.log('Tauri FS Adapter successfully installed.')` | `info` | Einmalige Init-Nachricht |

---

### Priorität 4: Komponenten & Runtime (5 Stellen)

#### `TDebugLog.ts` — 4 Stellen
**Pfad:** `src/components/TDebugLog.ts`

| Zeile | Aktuell | Neues Level | Begründung |
|-------|---------|-------------|------------|
| 383 | `console.info('[DEBUG-LOG-FILTER] active types:...')` | `debug` | Filter-Diagnose |
| 385 | `console.warn('[DEBUG-LOG-FILTER] typeFilters ist LEER...')` | `warn` | Warnung — Level bleibt |
| 444 | `console.warn('[TDebugLog] Gespeicherte typeFilters...')` | `warn` | Warnung — Level bleibt |
| 447 | `console.warn('[TDebugLog] Gespeicherte typeFilters enthielten...')` | `warn` | Warnung — Level bleibt |

#### `TStageController.ts` — 1 Stelle
**Pfad:** `src/components/TStageController.ts`

| Zeile | Aktuell | Neues Level | Begründung |
|-------|---------|-------------|------------|
| 186 | `console.log('[TStageController] Switching from...')` | `info` | Stage-Wechsel — relevante Zustandsänderung |

#### `GameRuntime.ts` — 1 Stelle
**Pfad:** `src/runtime/GameRuntime.ts`

| Zeile | Aktuell | Neues Level | Begründung |
|-------|---------|-------------|------------|
| 583 | `console.warn('⚠️ ON_ENTER WIRD AUSGEFÜHRT!...')` | `warn` | Runtime-Warnung — Level bleibt |

#### `NavigationActions.ts` — 1 Stelle
**Pfad:** `src/runtime/actions/handlers/NavigationActions.ts`

| Zeile | Aktuell | Neues Level | Begründung |
|-------|---------|-------------|------------|
| 79 | `console.warn('[restart_game] Kein onRestartGame-Callback...')` | `warn` | Fehlender Callback — Level bleibt |

---

### Ausgenommen: Tests (7 Stellen — per ESLint-Override)

#### `ExpressionParser.test.ts`
**Pfad:** `src/runtime/ExpressionParser.test.ts`

| Zeile | Aktuell | Aktion |
|-------|---------|--------|
| 9 | `console.log('--- Running ExpressionParser Tests ---')` | Beibehalten |
| 15 | `console.log('✅ PASS:...')` | Beibehalten |
| 18 | `console.error('❌ FAIL:...')` | Beibehalten |
| 19 | `console.error('   Expected:...')` | Beibehalten |
| 20 | `console.error('   Actual:...')` | Beibehalten |
| 67 | `console.log('Tests finished:...')` | Beibehalten |

---

### Ausgenommen: Logger-Interna (5 Stellen — per eslint-disable)

#### `Logger.ts`
**Pfad:** `src/utils/Logger.ts`

| Zeile | Aktuell | Aktion |
|-------|---------|--------|
| 101 | `console.log(...)` | UseCase-Header-Ausgabe — beibehalten, `eslint-disable` |
| 131 | `console.debug(prefix, ...args)` | Interne Debug-Ausgabe — beibehalten |
| 134 | `console.info(prefix, ...args)` | Interne Info-Ausgabe — beibehalten |
| 137 | `console.warn(prefix, ...args)` | Interne Warn-Ausgabe — beibehalten |
| 140 | `console.error(prefix, ...args)` | Interne Error-Ausgabe — beibehalten |

---

### Ausgenommen: Auskommentierter Code (6 Stellen — ignorieren)

#### `GameLoopManager.ts`
**Pfad:** `src/runtime/GameLoopManager.ts`

Zeilen 551, 555, 560, 564, 567, 593 — alle auskommentiert. Keine Aktion nötig.

---

## Migrationsschritte pro Datei

### 1. Import hinzufügen

```typescript
// Am Dateianfang nach den anderen Imports:
import { Logger } from '../utils/Logger';  // Pfad anpassen!
```

### 2. Logger-Instanz erstellen

**Option A: Innerhalb der Klasse (empfohlen)**

```typescript
export class StageInteractionManager {
    private static logger = Logger.get('StageInteractionManager');
    // ...
}
```

**Option B: Modul-Level (für Module ohne Klasse)**

```typescript
const logger = Logger.get('NavigationActions');

export function handleRestartGame() {
    // ...
}
```

### 3. Ersetzung durchführen (mit semantischer Level-Bewertung!)

| Alt | Neu (Faustregel) | Prüfen! |
|-----|-------------------|---------|
| `console.log('text')` | `logger.debug('text')` ← meistens! | Nur `info` wenn Zustandsänderung |
| `console.log('text', obj)` | `logger.debug('text', obj)` | — |
| `console.warn('text')` | `logger.warn('text')` | Level bleibt |
| `console.error('text', err)` | `logger.error('text', err)` | Level bleibt |
| `console.info('text')` | `logger.info('text')` oder `logger.debug('text')` | Tracing → `debug` |
| `console.debug('text')` | `logger.debug('text')` | Level bleibt |

> **WICHTIG:** `console.log` wird NICHT pauschal zu `logger.info`! Die meisten `console.log`-Ausgaben im Projekt sind Debug-/Diagnose-Tracing und gehören auf `logger.debug`.

### 4. Spezialfälle

**Template-Literals:**
```typescript
// Alt:
console.log(`Stage ID: ${stageId}`);

// Neu:
logger.debug(`Stage ID: ${stageId}`);
```

**Bedingte Logs (z. B. in StageRenderer):**
```typescript
// Alt:
if (className === 'TInfoWindow') console.log(`[VISIBILITY-DEBUG]...`);

// Neu:
if (className === 'TInfoWindow') StageRenderer.logger.debug(`[VISIBILITY-DEBUG]...`);
```

---

## Import-Pfade

| Wenn Datei in... | Dann importiere von... |
|------------------|------------------------|
| `src/editor/*.ts` | `../utils/Logger` |
| `src/editor/*/*.ts` | `../../utils/Logger` |
| `src/editor/*/*/*.ts` | `../../../utils/Logger` |
| `src/editor/*/*/*/*.ts` | `../../../../utils/Logger` |
| `src/services/*.ts` | `../utils/Logger` |
| `src/components/*.ts` | `../utils/Logger` |
| `src/runtime/*.ts` | `../utils/Logger` |
| `src/runtime/*/*.ts` | `../../utils/Logger` |
| `src/runtime/*/*/*.ts` | `../../../utils/Logger` |
| `src/utils/*.ts` | `./Logger` |

---

## Bearbeitungsreihenfolge (empfohlen)

Die Reihenfolge orientiert sich an Abhängigkeiten (Basis-Services zuerst) und Priorität:

1. **Services & Adapter** (Priorität 3) — Grundlage für alles
2. **Komponenten & Runtime** (Priorität 4) — verwendet Services
3. **Kern-Editor** (Priorität 1) — größter Umfang, am meisten Stellen
4. **Editor-Renderer** (Priorität 2) — Renderer-Schicht
5. **ESLint-Konfiguration** — erst nach vollständiger Migration

---

## Build, Test & Validierung

Nach **jeder** bearbeiteten Datei:

```bash
# 1. Build prüfen
npm run build

# 2. Tests ausführen (MANDATORISCH gemäß Projektregeln!)
npm run test
```

Keine Fehler dürfen auftreten. Ergebnis in `docs/QA_Report.md` protokollieren.

---

## Commit-Strategie (Atomic Commits)

Gemäß Projektregel „Trenne Refactoring strikt von funktionalen Änderungen" wird pro Prioritätsgruppe ein separater Commit erstellt:

```bash
# Commit 1: Services & Adapter
git add src/services/ProjectStore.ts src/services/DebugLogService.ts src/utils/TauriFSAdapter.ts
git commit -m "refactor: replace console.* with Logger in services & adapters

- ProjectStore.ts (2 Stellen → debug)
- DebugLogService.ts (2 Stellen → info/warn)
- TauriFSAdapter.ts (2 Stellen → error/info)"

# Commit 2: Komponenten & Runtime
git add src/components/ src/runtime/
git commit -m "refactor: replace console.* with Logger in components & runtime

- TDebugLog.ts (4 Stellen → debug/warn)
- TStageController.ts (1 Stelle → info)
- GameRuntime.ts (1 Stelle → warn)
- NavigationActions.ts (1 Stelle → warn)"

# Commit 3: Kern-Editor
git add src/editor/services/StageInteractionManager.ts src/editor/inspector/InspectorEventHandler.ts src/editor/EditorViewManager.ts src/editor/inspector/InspectorContextBuilder.ts
git commit -m "refactor: replace console.* with Logger in core editor modules

- StageInteractionManager.ts (7 Stellen → debug)
- InspectorEventHandler.ts (6 Stellen → debug)
- EditorViewManager.ts (3 Stellen → debug)
- InspectorContextBuilder.ts (1 Stelle → error)"

# Commit 4: Editor-Renderer
git add src/editor/services/renderers/ src/editor/services/StageRenderer.ts src/editor/inspector/renderers/
git commit -m "refactor: replace console.* with Logger in editor renderers

- StageRenderer.ts (2 Stellen → debug)
- ComplexComponentRenderer.ts (1 Stelle → debug)
- TextObjectRenderer.ts (1 Stelle → warn)
- VirtualGamepadRenderer.ts (1 Stelle → warn)
- InspectorSectionRenderer.ts (1 Stelle → error)"

# Commit 5: ESLint-Konfiguration
git add eslint.config.js src/utils/Logger.ts
git commit -m "chore: enable no-console ESLint rule with exceptions

- Logger.ts: eslint-disable for internal console usage
- eslint.config.js: no-console = error with test file override"
```

---

## Nach der Migration: ESLint-Konfiguration

Wenn alle `console.*` ersetzt sind, die ESLint-Regel in `eslint.config.js` (Flat Config Format!) aktivieren:

```javascript
// eslint.config.js — innerhalb des TypeScript-Config-Blocks:
rules: {
    // ... bestehende Regeln ...
    'no-console': 'error',  // war vorher 'off'
},

// Neuer Block für Test-Ausnahmen:
{
    files: ['src/**/*.test.ts', 'tests/**/*.ts'],
    rules: {
        'no-console': 'off',
    },
},
```

Für `Logger.ts` werden die internen Aufrufe per Inline-Kommentar freigestellt:

```typescript
// In Logger.ts, vor dem switch-Block:
// eslint-disable-next-line no-console
console.log(...);
```

---

## Zusammenfassung & Checkliste

### Zu migrieren (31 aktive Stellen in 14 Dateien)

- [ ] `ProjectStore.ts` (2 Stellen → debug)
- [ ] `DebugLogService.ts` (2 Stellen → info/warn)
- [ ] `TauriFSAdapter.ts` (2 Stellen → error/info)
- [ ] `TDebugLog.ts` (4 Stellen → debug/warn)
- [ ] `TStageController.ts` (1 Stelle → info)
- [ ] `GameRuntime.ts` (1 Stelle → warn)
- [ ] `NavigationActions.ts` (1 Stelle → warn)
- [ ] `StageInteractionManager.ts` (7 Stellen → debug)
- [ ] `InspectorEventHandler.ts` (6 Stellen → debug)
- [ ] `EditorViewManager.ts` (3 Stellen → debug)
- [ ] `InspectorContextBuilder.ts` (1 Stelle → error)
- [ ] `StageRenderer.ts` (2 Stellen → debug)
- [ ] `ComplexComponentRenderer.ts` (1 Stelle → debug)
- [ ] `TextObjectRenderer.ts` (1 Stelle → warn)
- [ ] `VirtualGamepadRenderer.ts` (1 Stelle → warn)
- [ ] `InspectorSectionRenderer.ts` (1 Stelle → error)

### Logger-Interna (eslint-disable markieren)

- [ ] `Logger.ts` (5 Stellen → eslint-disable-next-line hinzufügen)

### Abschluss

- [ ] `npm run build` erfolgreich
- [ ] `npm run test` erfolgreich, Ergebnis in `docs/QA_Report.md`
- [ ] ESLint `no-console: 'error'` in `eslint.config.js` aktivieren
- [ ] Test-Ausnahme in ESLint für `*.test.ts` konfigurieren
- [ ] Atomic Commits durchführen (5 Commits)
- [ ] `CHANGELOG.md` aktualisieren
- [ ] `DEVELOPER_GUIDELINES.md` um Logger-Level-Konvention ergänzen

---

**Statistik:**
- 31 aktive Stellen zu migrieren (in 14 Dateien)
- 5 Logger-interne Stellen (eslint-disable)
- 7 Test-Stellen (per ESLint-Override erlaubt)
- 6 auskommentierte Stellen (ignoriert)
- **Gesamt: 49 Fundstellen inventarisiert**
