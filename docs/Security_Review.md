# Security Review – Game Builder v1

**Datum:** 2026-07-03  
**Fokus:** Sicherheitslücken im Zusammenhang mit AgentScript-Imports und Server-APIs  
**Status:** Review abgeschlossen – Empfehlungen ausstehend

---

## Zusammenfassung des aktuellen Sicherheitsstands

Die Import-Kette über `AgentScript` ist grundsätzlich durch eine **Methoden-Whitelist** (`ALLOWED_METHODS`) in `AgentScriptValidator.ts` geschützt. Das verhindert bereits weitgehend, dass ein importiertes Skript willkürliche Methoden des `AgentController` aufruft. Es gibt jedoch mehrere Schwachstellen, bei denen ein präparierter Import (oder ein präpariertes Projekt) Schaden anrichten kann, insbesondere im Bereich **XSS**, **Prototype Pollution** und **Path Traversal**.

**Keine Code-Execution-Schwachstelle gefunden:** Weder `eval()` noch `new Function()` werden im Client-Code verwendet. Der `ExpressionParser` ist gegen direkten Prototype-Pollution-Zugriff (`__proto__`, `constructor`, `prototype`) abgesichert.

---

## 1. Identifizierte Schwachstellen

### A. Stored XSS durch importierte Projektinhalte (mittel bis hoch)

**Befund:** Im Editor werden dynamische Inhalte (Projekt-, Stage-, Task-, Variablen- und Objekt-Namen, Beschreibungen, Texte etc.) an sehr vielen Stellen per `innerHTML` in die UI eingefügt. Einige Beispiele:
- `src/editor/JSONTreeViewer.ts`
- `src/components/TDebugLog.ts`
- `src/editor/InspectorDesigner.ts`
- `src/editor/Stage.ts`
- `src/editor/services/renderers/TextObjectRenderer.ts`
- `src/editor/userstories/UserStoriesViewManager.ts`
- `src/editor/dialogs/renderers/DialogDOMBuilder.ts`

**Risiko:** Ein importiertes Projekt kann in einem beliebigen Textfeld HTML/JavaScript enthalten, z.B.:
```json
{ "name": "<img src=x onerror=alert(document.cookie)>" }
```
Sobald das Projekt im Editor geladen wird, wird das `<img>`-Tag eingefügt und das JavaScript ausgeführt. Dasselbe gilt für Labels, Variablenbeschreibungen, Task-Namen etc.

**Empfohlene Lösung:**
1. Zentralen `escapeHtml()`-Helper einführen.
2. Alle Stellen im Editor, die `innerHTML` mit importierten Daten füllen, auf `textContent` + `escapeHtml()` umstellen, oder `DOMPurify` als Dependency einführen.
3. Bei bewusstem HTML (z.B. Hilfetexte) die Eingabe durch eine explizite Allowlist erlauben, nicht durch `innerHTML` aus Benutzerdaten.

**Priorität:** Hoch, da dies direkt über Importe eingebracht werden kann.

---

### B. Prototype Pollution über importierte Action-Parameter (mittel)

**Befund:** `PropertyHelper.setPropertyValue` verarbeitet Dot-Paths ohne Schutz von `__proto__`, `constructor` und `prototype`:
```ts
static setPropertyValue(obj: any, propPath: string, value: any): void {
    const parts = propPath.split('.');
    let current: any = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part]) {
            current[part] = {};     // erzeugt Objekte auf dem Weg
        }
        current = current[part];
    }
    current[parts[parts.length - 1]] = value;
}
```

**Risiko:** Ein importiertes Action-Item kann einen `target` oder `resultVariable` wie folgt enthalten:
```json
{ "target": "__proto__.isAdmin", "changes": { "true": true } }
```
oder
```json
{ "resultVariable": "constructor.prototype.polluted" }
```
Dadurch können Prototype-Objekte verändert werden, was zu unvorhersehbarem Verhalten oder Sicherheitslücken im Runtime-Code führt.

**Hinweis:** `Object.assign` in `AgentController.addVariable` und `ensureActionDefined` kopiert `__proto__` als normalen String-Key, was bei importierten `options`/`params` ebenfalls problematisch ist, wenn diese Keys als eigene Property-Keys interpretiert werden.

**Empfohlene Lösung:**
1. In `PropertyHelper.setPropertyValue`, `getPropertyValue`, `interpolate` und `resolveTarget` alle Keys verbieten, die `__proto__`, `constructor` oder `prototype` sind.
2. Beim Übernehmen externer `options`/`params` in `Object.assign` eine Hilfsfunktion verwenden, die diese Keys entfernt.

Beispiel für eine sichere `setPropertyValue`-Validierung:
```ts
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
if (parts.some(p => FORBIDDEN_KEYS.has(p))) return;
```

**Priorität:** Mittel, da direkte Code-Execution unwahrscheinlich, aber die Runtime-Zuverlässigkeit stark beeinträchtigt werden kann.

---

### C. Path Traversal beim Speichern von Projekten (hoch)

**Befund:** Der Endpunkt `POST /api/dev/save-project` vertraut `meta._sourcePath`, das vom Client geliefert wird:
```ts
const relativePath = projectData.meta?._sourcePath || 'projects/project.json';
const projectPath = path.join(PUBLIC_DIR, relativePath);
```
`path.join` wird nicht normalisiert und es gibt keinen `startsWith`-Check gegen `PUBLIC_DIR`.

**Risiko:** Ein präpariertes Projekt kann `_sourcePath` auf z.B. `../../../server.ts` oder `../../.env` setzen. Das Überschreiben von Server-Dateien ist damit möglich, wenn der Dev-Server öffentlich erreichbar ist.

**Empfohlene Lösung:**
```ts
const relativePath = projectData.meta?._sourcePath || 'projects/project.json';
const target = path.resolve(PUBLIC_DIR, relativePath);
if (!target.startsWith(path.resolve(PUBLIC_DIR) + path.sep)) {
    return res.status(403).json({ error: 'Ungültiger Zielpfad' });
}
const projectPath = target;
```
Zusätzlich sollten relative Pfade mit `../` komplett abgelehnt oder auf eine Whitelist erlaubter Unterverzeichnisse beschränkt werden.

**Priorität:** Hoch, da dies direkt über ein importiertes/gespeichertes Projekt auslösbar ist.

---

### D. Path Traversal beim Löschen hochgeladener Spiele (mittel)

**Befund:** `DELETE /platform/games/:filename` verwendet den User-Input direkt:
```ts
const filePath = path.join(UPLOADED_GAMES_DIR, filename);
if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
```

**Risiko:** Ein `filename` wie `../public/player.html` führt zu `path.join(UPLOADED_GAMES_DIR, '../public/player.html')`, was außerhalb des Upload-Ordners liegt. Die Existenzprüfung würde die Datei finden und sie löschen.

**Empfohlene Lösung:**
```ts
const safeName = path.basename(filename).replace(/[^a-zA-Z0-9_.-]/g, '_');
if (!safeName.endsWith('.json')) return res.status(400).json({ error: 'Ungültiger Dateiname' });
const filePath = path.join(UPLOADED_GAMES_DIR, safeName);
```

**Priorität:** Mittel, da der Endpunkt vermutlich später ohnehin Authentifizierung braucht.

---

### E. Unauthentifizierter Schreibzugriff auf Dev-APIs (hoch)

**Befund:** Endpunkte wie `/api/dev/save-project`, `/api/dev/save-custom`, `/api/dev/reset-project`, `/api/dev/data/:file`, `/api/dev/check-exists` und `/api/dev/list-projects` haben keine Authentifizierung und sind im Dev-Build verfügbar.

**Risiko:** Im Netzwerk oder über gehostete Instanzen kann jeder diese Endpunkte aufrufen, Dateien lesen/überschreiben und Projekte löschen.

**Empfohlene Lösung:**
- Für den Produktivbetrieb: Authentifizierungs-Middleware (z.B. das bestehende `authenticateToken`) hinzufügen oder diese Endpunkte nur bei `NODE_ENV === 'development'` registrieren.
- Sicherstellen, dass `/api/dev/*`-Routen nie an öffentliche Netzwerke gebunden werden.

**Priorität:** Hoch, aber nur relevant, wenn der Dev-Server öffentlich erreichbar ist.

---

### F. Schwacher JWT-Secret-Fallback (kritisch)

**Befund:** `game-server/src/server.ts`:
```ts
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-prod';
```

**Risiko:** Wenn `JWT_SECRET` nicht gesetzt ist, ist das Secret öffentlich bekannt. Jeder kann damit gültige JWTs für beliebige Rollen (z.B. `superadmin`) signieren und die geschützten `/api/platform/*`-Endpunkte nutzen.

**Empfohlene Lösung:**
```ts
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET muss gesetzt sein');
}
```
Der Server darf nicht starten, ohne dass ein sicheres, zufälliges Secret konfiguriert ist.

**Priorität:** Kritisch, da dies die gesamte Plattform-Authentifizierung untergräbt.

---

### G. Unsichere `save-custom`-Validierung (mittel)

**Befund:** `POST /api/dev/save-custom` prüft:
```ts
if (!absolutePath.startsWith(projectsRoot) && !absolutePath.startsWith(publicRoot)) {
    return res.status(403).json({ error: 'Zugriff verweigert...' });
}
```
`startsWith` ist anfällig für Race-Condition/Traversierung, wenn der Pfad z.B. mit `projectsRoot` beginnt, aber später durch Symlinks oder `../` ausbricht. Außerdem fehlt die Normalisierung des Projektpfads vor dem Check.

**Empfohlene Lösung:**
```ts
const target = path.resolve(projectsRoot, relativePath);
if (!target.startsWith(path.resolve(projectsRoot) + path.sep)) return 403;
```
Oder: relative Pfade auf eine Whitelist erlaubter Unterverzeichnisse beschränken.

**Priorität:** Mittel, da `save-custom` ebenfalls Dev-only ist.

---

## 2. Empfohlene Reihenfolge der Behebung

1. **JWT-Secret Fallback entfernen** (kritisch, klein, sofort umsetzbar)
2. **Path Traversal in `save-project` beheben** (hoch, klein)
3. **Path Traversal in `DELETE /platform/games/:filename` beheben** (mittel, klein)
4. **Stored XSS im Editor durch zentralen `escapeHtml`-Helper beheben** (hoch, größerer Flächenbrand)
5. **Prototype Pollution in `PropertyHelper` und `Object.assign`-Verwendungen beheben** (mittel, mittel)
6. **Dev-APIs absichern (Auth oder Dev-only)** (hoch, falls öffentlich)
7. **`save-custom` mit `path.resolve` + `startsWith` robust absichern** (mittel, klein)

---

## 3. Nicht sicherheitsrelevante, aber dringende Hinweise

### Lint-Fehler
`npm run lint` schlägt aktuell mit 9 Fehlern fehl:
- `'alert' is not defined` in `AgentScriptDialog.ts` und `AgentScriptLibrary.ts`

Diese Fehler verhindern, dass der `CI / build`-Job erfolgreich durchläuft. Sie sollten vor dem nächsten Push behoben werden, z.B. durch `window.alert(...)` oder ein zentrales Dialog-Helper.

---

## 4. Weitere Empfehlungen (Best Practices)

- **Content Security Policy (CSP):** Für den Editor/Player eine strikte CSP setzen, die `inline-scripts` verbietet und `eval` blockiert.
- **Import-Dateigröße limitieren:** `AgentScript`-Importe sollten eine maximale Größe haben, um DoS zu verhindern.
- **Audit-Log:** Werden Projekte importiert, sollte eine kurze Zusammenfassung der importierten Operationen angezeigt werden (bereits teilweise vorhanden).
- **Schema-Validierung:** `AgentScript`-Operationen könnten zusätzlich gegen ein JSON-Schema validiert werden, um unerwartete Parameter-Typen abzuwehren.

---

*Erstellt von Cascade im Rahmen der Sicherheitsprüfung des AgentScript-Imports.*
