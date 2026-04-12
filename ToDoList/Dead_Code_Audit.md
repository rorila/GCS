# Dead Code & Redundanz-Audit

**Datum:** 12.04.2026  
**Scope:** Gesamtes `src/`-Verzeichnis

---

## Zusammenfassung

| Kategorie | Anzahl |
|-----------|--------|
| Tote Dateien (nirgends importiert) | 1 |
| Redundante Duplikate | 2 |
| Tote Exporte / Funktionen | 3 |
| Obsolete Module (veraltet / ersetzt) | 2 |
| Überflüssige Fassaden | 1 |

---

## 1. TOTE DATEIEN (nirgends importiert)

### 1.1 `src/engine/GameBase.ts` — TOTER CODE

**Befund:** `GameBase` wird **nirgends im Projekt importiert**. Keine Klasse erweitert sie, kein Import referenziert `engine/GameBase`.

**Datei:** `src/engine/GameBase.ts` (35 Zeilen)  
**Inhalt:** Leere Hülle mit `start()`, `stop()`, `pause()`, `resume()` — ohne jegliche Logik.

```typescript
export class GameBase {
    private isRunning: boolean = false;
    private isPaused: boolean = false;
    public start() { this.isRunning = true; }
    public stop() { this.isRunning = false; }
    // ...
}
```

**Empfehlung:** ❌ **Datei löschen.** Der gesamte `engine/`-Ordner kann vermutlich entfernt werden, da er nur diese eine Datei enthält.

---

## 2. REDUNDANTE DUPLIKATE

### 2.1 Multiplayer: ZWEI parallele Implementierungen

Es existieren **zwei** vollständige Multiplayer-Systeme mit überlappender Funktionalität:

| Modul | Dateien | Genutzt von |
|-------|---------|-------------|
| `src/multiplayer/` (NetworkManager, Lobby, InputSyncer, CollisionSyncer, Protocol) | 5+ Dateien | `player-standalone.ts`, `TGameServer.ts`, `EditorRunManager.ts` |
| `src/runtime/MultiplayerManager.ts` | 1 Datei | `TaskExecutor.ts`, `RemoteGameManager.ts` |

**Problem:** 
- `multiplayer/NetworkManager` und `runtime/MultiplayerManager` implementieren **beide** WebSocket-Verbindung, Room-Create/Join, Ready-Signal, State-Sync
- `multiplayer/Protocol.ts` und Import `from '../../game-server/src/Protocol'` in `MultiplayerManager.ts` — **zwei verschiedene Protocol-Definitionen**
- `multiplayer/CollisionSyncer.ts` und `multiplayer/InputSyncer.ts` sind **Pong-spezifisch** (Paddle-Logik, Ball-Sync) — gehören nicht in ein generisches Multiplayer-Modul

**Empfehlung:**
1. **Entscheidung treffen:** Welches System ist das aktive? `multiplayer/NetworkManager` (Event-basiert, Promise-API) scheint moderner.
2. **`runtime/MultiplayerManager.ts`** konsolidieren oder entfernen, falls `multiplayer/NetworkManager` alles abdeckt
3. **`CollisionSyncer.ts`** und **`InputSyncer.ts`** sind Pong-spezifisch → in ein separates Spielprojekt auslagern oder löschen
4. **Protocol-Definitionen** vereinheitlichen (eine Single-Source-of-Truth)

### 2.2 Pascal: Facade-Klasse ohne Mehrwert

**Datei:** `src/editor/PascalGenerator.ts` (50 Zeilen)

```typescript
export class PascalGenerator {
    static generateFullProgram(...) { return PascalCodeGenerator.generateFullProgram(...); }
    static generateForTask(...)     { return PascalCodeGenerator.generateForTask(...); }
    static parse(...)               { PascalCodeParser.parse(...); }
}
```

**Befund:** `PascalGenerator` ist eine reine **Pass-Through-Facade** die 1:1 an `PascalCodeGenerator` und `PascalCodeParser` delegiert. Kein eigener Code.

**Genutzt von:**
- `EditorViewManager.ts` → importiert `PascalGenerator`
- `EditorRenderManager.ts` → importiert `PascalGenerator`

**Nicht genutzt:** `FlowPascalManager.ts` importiert direkt `PascalCodeGenerator` (umgeht die Facade).

**Empfehlung:** 
- **Option A:** `PascalGenerator.ts` löschen, Imports in `EditorViewManager` und `EditorRenderManager` direkt auf `PascalCodeGenerator` / `PascalCodeParser` umstellen
- **Option B:** Facade beibehalten, aber dann `FlowPascalManager` auch über die Facade laufen lassen (Konsistenz)

---

## 3. TOTE EXPORTE / FUNKTIONEN

### 3.1 `PascalGenerator.generateProcedure()` — nie aufgerufen

```typescript
// PascalGenerator.ts Zeile 31
public static generateProcedure(project, taskName, indent, sequenceOverride, asHtml, activeStage): string {
    return PascalCodeGenerator.generateProcedure(...);
}
```

**Befund:** Diese Methode wird **nirgends aufgerufen**. `PascalCodeGenerator.generateProcedure()` wird intern verwendet, aber nie über die Facade.

### 3.2 `PascalGenerator.getLogicSignature()` — nie extern aufgerufen

```typescript
// PascalGenerator.ts Zeile 46
public static getLogicSignature(sequence): string {
    return (PascalCodeParser as any).getLogicSignature(sequence);
}
```

**Befund:** Wird **nirgends importiert oder aufgerufen**. Nur `PascalCodeParser` selbst nutzt `getLogicSignature` intern.

### 3.3 `TComponent.findChild()` — potenziell ungenutzt

```typescript
// TComponent.ts Zeile 322
public findChild(name: string): TComponent | null {
    return this.children.find(c => c.name === name) || null;
}
```

**Befund:** Keine Aufrufe von `findChild()` gefunden. Könnte aber als API-Methode beabsichtigt sein → **prüfen ob benötigt**.

---

## 4. OBSOLETE MODULE

### 4.1 `src/tools/TrainingDataExporter.ts` — CLI-Tool, nie im Browser genutzt

**Befund:** Importiert `fs` und `path` (Node.js-Module). Wird weder von der App importiert noch im Build eingebunden. Ist ein **standalone CLI-Tool**.

**Empfehlung:** 
- In ein separates `tools/`-Verzeichnis **außerhalb von `src/`** verschieben (z.B. `scripts/`)
- Oder: Aus dem `tsconfig.json` exclude-Pattern prüfen, damit es nicht mit-gebaut wird
- Alternativ: Löschen, falls nicht mehr benötigt

### 4.2 `src/stubs/` — leerer Ordner

**Befund:** Der Ordner `src/stubs/` existiert, enthält aber **keine Dateien**. Wird nirgends referenziert.

**Empfehlung:** ❌ **Leeren Ordner löschen.**

---

## 5. REDUNDANTER CODE (Patterns)

### 5.1 `PascalHighlighter.escape()` vs. `SecurityUtils.escapeHtml()`

```typescript
// PascalHighlighter.ts Zeile 77
private static escape(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
```

```typescript
// SecurityUtils.ts Zeile 56
public static escapeHtml(str: string): string {
    return String(str).replace(/[&<>"']/g, m => map[m]);
}
```

**Befund:** Nahezu identische Funktion, aber `PascalHighlighter` escaped nur `& < >`, während `SecurityUtils` auch `" '` behandelt.

**Empfehlung:** `PascalHighlighter.escape()` durch `SecurityUtils.escapeHtml()` ersetzen.

### 5.2 Multiplayer Protocol — doppelte Definition

- `src/multiplayer/Protocol.ts` — Client/Server Message-Types
- `game-server/src/Protocol.ts` — Gleiche Types, aber separat gepflegt

**Problem:** `runtime/MultiplayerManager.ts` importiert `from '../../game-server/src/Protocol'`, während der Rest `from './Protocol'` im `multiplayer/`-Ordner nutzt. Bei Änderungen muss man **beide Dateien** pflegen.

**Empfehlung:** Eine Single-Source-of-Truth erstellen (z.B. `shared/Protocol.ts`) und von beiden Seiten importieren.

---

## 6. EMPFOHLENE AKTIONEN (priorisiert)

### Sofort (Quick Wins)
1. ❌ `src/engine/GameBase.ts` + `src/engine/` Ordner löschen
2. ❌ `src/stubs/` leeren Ordner löschen
3. ❌ `PascalGenerator.generateProcedure()` und `getLogicSignature()` entfernen
4. 🔄 `PascalHighlighter.escape()` → `SecurityUtils.escapeHtml()` ersetzen

### Kurzfristig
5. 📦 `src/tools/TrainingDataExporter.ts` nach `scripts/` verschieben oder aus Build ausschließen
6. 🔄 `PascalGenerator.ts` Facade-Entscheidung treffen (löschen oder konsequent nutzen)

### Mittelfristig (größerer Refactor)
7. 🏗️ Multiplayer konsolidieren: `NetworkManager` vs. `MultiplayerManager` — eines eliminieren
8. 🏗️ Pong-spezifischen Code (`CollisionSyncer`, `InputSyncer`) aus `multiplayer/` entfernen
9. 📦 Protocol.ts Single-Source-of-Truth erstellen

---

## Hinweis

Dieses Audit deckt **strukturelle Redundanz und toten Code auf Dateiebene** ab. Für eine vollständige Analyse auf Funktionsebene (jede einzelne Methode jeder Klasse) wäre ein TypeScript-Compiler-basiertes Tool wie `ts-prune` oder `knip` empfehlenswert:

```bash
npx knip --include files,exports,dependencies
```
