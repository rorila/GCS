# Migration: console.* → Logger

**Erstellt:** 11.06.2026  
**Status:** Offen (53 Stellen in 25+ Dateien)  
**Ziel:** Alle `console.log/warn/error/info` durch den projekteigenen `Logger` ersetzen

---

## Warum?

- Einheitliche Logging-Infrastruktur mit Kategorien
- Möglichkeit zum Deaktivieren/Filterung in Production
- Konsistentes Format für Debug-Ausgaben
- Vorbereitung für ESLint-Regel `no-console`

---

## Logger-API (bereits vorhanden)

```typescript
import { Logger } from './utils/Logger';

// Pro Klasse ein Logger-Instance
const logger = Logger.get('MeineKlasse');

// Level
logger.debug('Details', obj);   // Nur bei aktiviertem Debug-Level
logger.info('Info', data);      // Standard-Info
logger.warn('Warnung');         // Warnung
logger.error('Fehler', err);    // Fehler mit Stack
```

---

## Betroffene Dateien (priorisiert)

### Hohe Priorität (Kern-Editor)

| Datei | Anzahl | Pfad |
|-------|--------|------|
| `StageInteractionManager.ts` | 7 | `src/editor/interactions/StageInteractionManager.ts` |
| `InspectorEventHandler.ts` | 6 | `src/editor/inspector/InspectorEventHandler.ts` |
| `GameLoopManager.ts` | 6 | `src/editor/GameLoopManager.ts` |
| `EditorViewManager.ts` | 3 | `src/editor/EditorViewManager.ts` |
| `ProjectStore.ts` | 2 | `src/services/ProjectStore.ts` |

### Mittlere Priorität (Services & UI)

| Datei | Anzahl | Pfad |
|-------|--------|------|
| `DebugLogService.ts` | 2 | `src/services/DebugLogService.ts` |
| `TauriFSAdapter.ts` | 2 | `src/adapter/TauriFSAdapter.ts` |
| `TDebugLog.ts` | 4 | `src/components/TDebugLog.ts` |

### Tests (separate Behandlung)

| Datei | Anzahl | Pfad |
|-------|--------|------|
| `ExpressionParser.test.ts` | 7 | `src/test/ExpressionParser.test.ts` |

> **Hinweis zu Tests:** In Tests ist `console.log` oft akzeptabel (Test-Debugging). Alternativ: Logger-Mock einrichten oder `console` in Test-Dateien explizit erlauben.

### Weitere Dateien (Rest)

- `Logger.ts` (5 Aufrufe) — Selbstreferenz, ggf. beibehalten oder interne Debug-Ausgaben
- ~15 weitere Dateien mit 1–2 Aufrufen

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

**Option B: Modul-Level (für Singletons/Module)**

```typescript
const logger = Logger.get('ProjectStore');

export class ProjectStore {
    // ...
}
```

### 3. Ersetzung durchführen

| Alt | Neu |
|-----|-----|
| `console.log('text')` | `logger.info('text')` |
| `console.log('text', obj)` | `logger.info('text', obj)` |
| `console.warn('text')` | `logger.warn('text')` |
| `console.error('text', err)` | `logger.error('text', err)` |
| `console.info('text')` | `logger.info('text')` |
| `console.debug('text')` | `logger.debug('text')` |

### 4. Spezialfälle

**Template-Literals:**
```typescript
// Alt:
console.log(`Stage ID: ${stageId}`);

// Neu:
logger.info(`Stage ID: ${stageId}`);
```

**Interpolierte Strings mit Objekten:**
```typescript
// Alt:
console.log('Stage:', stage, 'Objects:', objects);

// Neu:
logger.info('Stage:', stage, 'Objects:', objects);
// oder:
logger.info('Stage: %O, Objects: %O', stage, objects);
```

---

## Beispiel: StageInteractionManager.ts

### Vorher

```typescript
// src/editor/interactions/StageInteractionManager.ts
export class StageInteractionManager {
    private stage: Stage;
    
    constructor(stage: Stage) {
        this.stage = stage;
        console.log('StageInteractionManager initialized', stage);
    }
    
    handleClick(event: MouseEvent) {
        console.warn('Click not handled', event.target);
        const element = this.findElement(event);
        if (!element) {
            console.error('Element not found at', event.clientX, event.clientY);
            return;
        }
        console.log('Found element', element);
    }
}
```

### Nachher

```typescript
// src/editor/interactions/StageInteractionManager.ts
import { Logger } from '../../utils/Logger';

export class StageInteractionManager {
    private static logger = Logger.get('StageInteractionManager');
    private stage: Stage;
    
    constructor(stage: Stage) {
        this.stage = stage;
        StageInteractionManager.logger.info('Initialized', stage);
    }
    
    handleClick(event: MouseEvent) {
        StageInteractionManager.logger.warn('Click not handled', event.target);
        const element = this.findElement(event);
        if (!element) {
            StageInteractionManager.logger.error('Element not found at', event.clientX, event.clientY);
            return;
        }
        StageInteractionManager.logger.info('Found element', element);
    }
}
```

---

## Imports pro Dateipfad

| Wenn Datei in... | Dann importiere von... |
|------------------|------------------------|
| `src/editor/*.ts` | `../utils/Logger` |
| `src/editor/*/*.ts` | `../../utils/Logger` |
| `src/editor/*/*/*.ts` | `../../../utils/Logger` |
| `src/services/*.ts` | `../utils/Logger` |
| `src/components/*.ts` | `../utils/Logger` |
| `src/adapter/*.ts` | `../utils/Logger` |

---

## Build & Test

Nach jeder bearbeiteten Datei:

```bash
npm run build
```

Keine Fehler sollten auftreten. Der Logger ist bereits Teil der Codebase.

---

## Commit-Vorschlag

```bash
git add src/
git commit -m "refactor: replace console.* with Logger in core modules

- StageInteractionManager.ts
- InspectorEventHandler.ts  
- GameLoopManager.ts
- EditorViewManager.ts
- ProjectStore.ts
- DebugLogService.ts
- TauriFSAdapter.ts
- TDebugLog.ts"
```

---

## Nach der Migration

Wenn alle `console.*` ersetzt sind:

1. **ESLint-Regel aktivieren:**
   ```json
   // eslint.config.js
   {
     "rules": {
       "no-console": "error"
     }
   }
   ```

2. **Ausnahmen definieren (falls nötig):**
   - Tests dürfen ggf. `console` nutzen
   - Logger.ts selbst (interne Debug-Ausgaben)
   - Build-Skripte / CLI-Tools

---

## Zusammenfassung Checklist

- [ ] `StageInteractionManager.ts` (7 Stellen)
- [ ] `InspectorEventHandler.ts` (6 Stellen)
- [ ] `GameLoopManager.ts` (6 Stellen)
- [ ] `EditorViewManager.ts` (3 Stellen)
- [ ] `ProjectStore.ts` (2 Stellen)
- [ ] `DebugLogService.ts` (2 Stellen)
- [ ] `TauriFSAdapter.ts` (2 Stellen)
- [ ] `TDebugLog.ts` (4 Stellen)
- [ ] Tests entscheiden: entweder migrieren oder ESLint-Ausnahme
- [ ] ESLint `no-console` aktivieren
- [ ] Build testen
- [ ] Commit durchführen

---

**Hinweis:** Die Datei `Logger.ts` hat 5 eigene `console.*` Aufrufe. Diese sind für interne Bootstrap/Debug-Ausgaben des Loggers selbst und können beibehalten oder durch `// eslint-disable-next-line no-console` markiert werden.
