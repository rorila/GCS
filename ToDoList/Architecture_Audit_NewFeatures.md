# Architektur-Audit: Neue Features (Electron / Export / StandaloneEngine)

> **Datum:** 2026-04-18  
> **Scope:** Alle seit CleanCode Phase 3 hinzugefügten Features mit Bezug zu Electron-IPC, GameExporter und Standalone-Runtime.  
> **Methode:** Statische Code-Analyse gegen `DEVELOPER_GUIDELINES.md` und hexagonale Architekturvorgaben.

---

## Zusammenfassung

| Schweregrad | Anzahl | Status |
|:---|:---:|:---:|
| 🔴 Kritisch | 1 | Offen |
| 🟠 Hoch | 2 | Offen |
| 🟡 Mittel | 2 | Offen |
| 🟢 Niedrig | 1 | Offen |

**Gesamtbewertung:** Die neuen Features sind teilweise architekturkonform. Persistenz (Adapter-Pattern) und Electron-Grundabsicherung (Context Isolation, Preload-Bridge) sind solide. Es bestehen jedoch **3 relevante Baustellen**: eine IPC-Sicherheitslücke, absolute Pfade im Export und eine unvollständige Adapter-Migration.

---

## Findings

### F-01 🔴 Kritisch — Path-Traversal in `fs:listFiles` IPC-Handler

- **Datei:** `electron/main.cjs` (Zeile ~110)
- **Problem:** `path.resolve(app.getPath('userData'), dirPath)` wird **ohne** anschließenden `security.isPathAllowed()`-Check ausgeführt. Ein manipulierter `dirPath` (z.B. `../../Windows/System32`) kann Verzeichnisse außerhalb der Whitelist auflisten.
- **Guideline-Verstoß:** Sicherheits-Whitelist (`electron/security.cjs`) wird umgangen.
- **Risiko:** Informationsleck; potenzielle Vorstufe zu weitergehenden Angriffen.

**Empfohlener Fix:**
```js
// In electron/main.cjs — fs:listFiles Handler
const resolvedDir = path.resolve(app.getPath('userData'), dirPath);
if (!security.isPathAllowed(resolvedDir)) {
  return { error: 'Pfad nicht erlaubt' };
}
```
**Aufwand:** ~5 min, 2 Zeilen.

---

### F-02 🟠 Hoch — Absolute Medienpfade im Export brechen unter Electron `file://`

- **Datei:** `src/export/GameExporter.ts` (Zeile ~600–607)
- **Problem:** Medien werden per `fetch('/' + relativePath)` geladen. Im Electron-`file://`-Kontext löst `/` auf das Laufwerks-Root auf (z.B. `C:/`), nicht auf das App-Root.
- **Guideline-Verstoß:** `DEVELOPER_GUIDELINES.md` Zeile 283–285 verbietet absolute `/`-Pfade in Electron.
- **Risiko:** Medien-Embedding schlägt im Electron-Desktop-Build fehl; exportierte Spiele enthalten leere Assets.

**Empfohlener Fix:**
```ts
// Relative Pfade nutzen, Electron-Base-URL berücksichtigen
const basePath = window.location.origin || '.';
const fullPath = `${basePath}/${relativePath}`;
```
**Aufwand:** ~15 min. Muss mit Standalone-Export und Dev-Server getestet werden.

---

### F-03 🟠 Hoch — Runtime-Bundle-Fetch nutzt absolute URL

- **Datei:** `src/export/GameExporter.ts` (Zeile ~168)
- **Problem:** `fetch('/runtime-standalone.js')` — gleiche Problematik wie F-02. Unter `file://` nicht auflösbar.
- **Guideline-Verstoß:** Gleiche Regel wie F-02 (keine absoluten Pfade in Electron).
- **Risiko:** Server-Bundle-Export und HTML-Export funktionieren nur im Dev-Server, nicht im gepackten Electron-Build.

**Empfohlener Fix:**
```ts
const runtimeUrl = new URL('./runtime-standalone.js', window.location.href).href;
const resp = await fetch(runtimeUrl);
```
**Aufwand:** ~10 min. Regression-Test mit `npm run test` und manuellem Export-Test.

---

### F-04 🟡 Mittel — Export-Architektur: `IExportAdapter` nicht vollständig verdrahtet

- **Dateien:** `src/ports/IStorageAdapter.ts` (Zeile 37), `src/services/ProjectPersistenceService.ts` (Zeile ~257–260)
- **Problem:** Das Interface `IExportAdapter` ist definiert, aber `ProjectPersistenceService` instanziert `GameExporter` direkt (`new GameExporter()`). Der Adapter-Switch greift hier nicht.
- **Guideline-Verstoß:** Hexagonale Architektur (Phase 3) fordert I/O über Adapter-Interfaces.
- **Risiko:** Kein akuter Bug, aber erschwert zukünftige Umgebungswechsel (z.B. Electron-nativer Export via IPC) und widerspricht dem eigenen Architekturanspruch.

**Empfohlener Fix:**
1. `GameExporter` das Interface `IExportAdapter` implementieren lassen.
2. In `ProjectPersistenceService` den Export über den Adapter-Mechanismus routen.
3. Langfristig: Electron-spezifischen `NativeExportAdapter` vorsehen.

**Aufwand:** ~30–60 min.

---

### F-05 🟡 Mittel — `console.*` in Standalone-Runtime-Pfaden

- **Datei:** `src/player-standalone.ts` (Zeilen ~430, 439, 509 u.a.)
- **Problem:** Direkte `console.warn`/`console.log`-Aufrufe in Laufzeitpfaden.
- **Guideline-Verstoß:** `DEVELOPER_GUIDELINES.md` Zeile 111 verbietet `console.*` im Produktivcode. Logger-Pflicht.
- **Risiko:** Kein Funktionsbug, aber Logging-Rauschen in Production und inkonsistente Diagnose.

**Empfohlener Fix:**
```ts
private static logger = Logger.get('UniversalPlayer', 'UC_STANDALONE');
// Alle console.* durch logger.warn / logger.info ersetzen
```
**Aufwand:** ~15 min.

---

### F-06 🟢 Niedrig — Zwei konkurrierende Runtime-Build-Pipelines

- **Dateien:** `package.json` (Zeile ~10, esbuild-Skript), `vite.runtime.config.ts`
- **Problem:** Parallel existieren ein `esbuild`-basierter und ein `vite`-basierter Build für `runtime-standalone.js`. Unklar, welcher die Single Source of Truth ist.
- **Risiko:** Kein akuter Bug. Wartungsrisiko bei divergierenden Konfigurationen.

**Empfohlene Maßnahme:** Eine Pipeline als canonical markieren, die andere entfernen oder als `deprecated` kennzeichnen.

**Aufwand:** ~10 min Entscheidung + Cleanup.

---

## Positiv-Befunde (Architekturkonform)

| Bereich | Bewertung |
|:---|:---|
| Electron `contextIsolation` + `nodeIntegration: false` | ✅ Korrekt |
| Preload-Bridge über `contextBridge.exposeInMainWorld` | ✅ Sauber isoliert |
| `fs:readFile` / `fs:writeFile` mit `isPathAllowed`-Check | ✅ Abgesichert |
| `ProjectPersistenceService` mit `IStorageAdapter` | ✅ Hexagonal-konform |
| `NativeFileAdapter` mit Electron-Fallback auf FileSystem Access API | ✅ Portabel |
| ConfirmDialog / PromptDialog statt native `confirm()`/`prompt()` | ✅ Electron-safe |
| Separate Runtime-Build-Konfiguration | ✅ Richtige Trennung |

---

## Empfohlene Reihenfolge

| Prio | Finding | Geschätzter Aufwand |
|:---:|:---|:---:|
| 1 | F-01 Path-Traversal Fix | 5 min |
| 2 | F-02 + F-03 Relative Pfade im Export | 25 min |
| 3 | F-05 Logger-Migration in Standalone | 15 min |
| 4 | F-04 IExportAdapter verdrahten | 30–60 min |
| 5 | F-06 Build-Pipeline bereinigen | 10 min |

**Gesamtaufwand:** ca. 1,5–2 Stunden für alle Findings.

---

> Nächster Schritt: F-01 (Path-Traversal) hat die höchste Priorität und den geringsten Aufwand. Soll als erstes umgesetzt werden.
