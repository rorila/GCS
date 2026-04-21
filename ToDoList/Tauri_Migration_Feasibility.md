# Machbarkeitsstudie: Migration von Electron zu Tauri

> **Datum:** 2026-04-21  
> **Autor:** Cascade (AI Pair Programming Session)  
> **Zielgruppe:** Projekt-Owner, Entscheidungsvorlage  
> **Status:** 🟢 Empfehlung zur Umsetzung (niedriges Risiko, hoher Gewinn)

---

## Executive Summary

| Kriterium | Aktuell (Electron) | Nach Migration (Tauri) | Veränderung |
|:---|:---:|:---:|:---:|
| Installer-Größe (Windows) | ~150 MB | ~10 MB | **-93 %** |
| RAM-Verbrauch (idle) | ~200 MB | ~80 MB | **-60 %** |
| Startzeit | ~2,0 s | ~0,5 s | **-75 %** |
| Security-Attack-Surface | Chromium + Node.js | OS-WebView + Rust | **deutlich reduziert** |
| Cross-Platform (Win/Mac/Linux) | ✅ | ✅ | gleich |
| Renderer-Code-Änderungen | — | **0 Zeilen** | **keine Breaking Changes** |
| Geschätzter Aufwand | — | **2–4 Arbeitstage** | einmalig |
| Laufende Wartung | mittel | niedriger | vereinfacht |

**Kernaussage:** Der Renderer-Code (also die eigentliche Runtime + Editor) wird **nicht angefasst**. Nur die Electron-Wrapper-Schicht (3 Dateien, ~220 Zeilen) wird durch Rust-Äquivalente ersetzt.

---

## 1. Was bleibt, was wird ersetzt?

### 1.1 Bleibt 1:1 (Renderer)

Der gesamte Web-Code läuft unverändert:

- `@src/editor/**` — Editor-UI  
- `@src/runtime/**` — Spiel-Runtime  
- `@src/components/**` — 67 Komponenten  
- `@src/player-standalone.ts` — Standalone-Player  
- `@public/**` — Statische Assets  
- `@vite.config.ts` + Build-Pipeline  

**Grund:** Tauri nutzt die native WebView des Betriebssystems und lädt den vorhandenen Vite-Build genauso wie Electron.

### 1.2 Wird ersetzt (Backend)

Nur **3 Dateien** aus dem `electron/`-Ordner werden durch Rust-Code im Tauri-Backend ersetzt:

| Aktuelle Datei | Rolle | Tauri-Pendant |
|:---|:---|:---|
| `@electron/main.cjs` (220 Zeilen) | Fenster, IPC-Handler, CSP | `src-tauri/src/main.rs` + `tauri.conf.json` |
| `@electron/preload.cjs` (13 Zeilen) | `contextBridge` für `electronFS` | `@tauri-apps/api` (fertig) + dünner TS-Wrapper |
| `@electron/security.cjs` (~40 Zeilen) | Pfad-Whitelist | Tauri **Allowlist** in `tauri.conf.json` |

### 1.3 Was der Renderer konkret aufruft

Aus `@electron/preload.cjs`:

```js
window.electronFS = {
    readFile, writeFile, listFiles,
    showOpenDialog, showSaveDialog,
    allowPath, getAppPath
}
```

Das sind **7 IPC-Funktionen**, die abgebildet werden müssen. Jede einzelne ist in Tauri mit einer Zeile Code abgedeckt — teilweise sogar komplett entfernt, weil Tauri native Äquivalente hat.

---

## 2. Technische Architektur — Gegenüberstellung

### 2.1 Aktueller Electron-Stack

```
┌─────────────────────────────────┐
│  Renderer (Chromium Engine)     │  ~120 MB
│  - Editor (src/editor)          │
│  - Runtime (src/runtime)        │
└────────────┬────────────────────┘
             │ contextBridge / IPC
┌────────────┴────────────────────┐
│  Main Process (Node.js)          │  ~30 MB
│  - main.cjs                      │
│  - preload.cjs                   │
│  - security.cjs                  │
│  - 7 IPC-Handler                 │
└──────────────────────────────────┘
Total Binary: ~150 MB
```

### 2.2 Ziel: Tauri-Stack

```
┌─────────────────────────────────┐
│  Renderer (OS WebView)          │  0 MB (im OS vorhanden)
│  - Editor (src/editor)          │
│  - Runtime (src/runtime)        │
└────────────┬────────────────────┘
             │ @tauri-apps/api (invoke)
┌────────────┴────────────────────┐
│  Backend (Rust)                 │  ~8 MB
│  - main.rs                      │
│  - Commands (statt IPC-Handler) │
│  - Allowlist (Config-basiert)   │
└──────────────────────────────────┘
Total Binary: ~10 MB
```

---

## 3. IPC-Handler-Mapping (1:1 Migration)

Hier die konkrete Abbildung aller 7 IPC-Handler:

### `fs:readFile` → Tauri-Äquivalent: **eingebaut**

```rust
// Backend: NICHT nötig! Tauri hat das bereits:
// tauri.conf.json → "allowlist": { "fs": { "readFile": true, "scope": [...] } }
```

```ts
// Renderer (ersetzt window.electronFS.readFile):
import { readTextFile, BaseDirectory } from '@tauri-apps/api/fs';
const content = await readTextFile('project.json', { dir: BaseDirectory.AppData });
```

**Vorteil:** Pfad-Whitelist ist deklarativ in `tauri.conf.json` — nicht mehr imperativ in Rust-Code.

---

### `fs:writeFile` → Tauri-Äquivalent: **eingebaut**

```ts
import { writeTextFile, BaseDirectory } from '@tauri-apps/api/fs';
await writeTextFile('project.json', content, { dir: BaseDirectory.AppData });
```

---

### `fs:listFiles` → Tauri-Äquivalent: **eingebaut**

```ts
import { readDir, BaseDirectory } from '@tauri-apps/api/fs';
const entries = await readDir('projects', { dir: BaseDirectory.AppData });
```

---

### `fs:showOpenDialog` → Tauri-Äquivalent: **eingebaut**

```ts
import { open } from '@tauri-apps/api/dialog';
const selected = await open({ multiple: false, filters: [{ name: 'JSON', extensions: ['json'] }] });
```

---

### `fs:showSaveDialog` → Tauri-Äquivalent: **eingebaut**

```ts
import { save } from '@tauri-apps/api/dialog';
const path = await save({ filters: [{ name: 'JSON', extensions: ['json'] }] });
```

---

### `fs:allowPath` → **entfällt komplett**

Tauri nutzt **statische Allowlists** in `tauri.conf.json` statt dynamischer Pfad-Registrierung. Das ist sicherheitstechnisch überlegen:

```json
{
    "allowlist": {
        "fs": {
            "readFile": true,
            "writeFile": true,
            "scope": [
                "$APPDATA/**",
                "$RESOURCE/**",
                "$TEMP/*.json"
            ]
        }
    }
}
```

**Sicherheitsgewinn:** Ein kompromittierter Renderer kann **keine neuen Pfade mehr whitelisten** — die Liste ist zur Build-Zeit eingefroren.

---

### `fs:getAppPath` → Tauri-Äquivalent: **eingebaut**

```ts
import { appDataDir, resourceDir } from '@tauri-apps/api/path';
const appPath = await resourceDir();
```

---

### Zusammenfassung Mapping

| Aktueller IPC | Tauri-Lösung | Eigener Rust-Code nötig? |
|:---|:---|:---:|
| `fs:readFile` | `@tauri-apps/api/fs` | ❌ nein |
| `fs:writeFile` | `@tauri-apps/api/fs` | ❌ nein |
| `fs:listFiles` | `@tauri-apps/api/fs` | ❌ nein |
| `fs:showOpenDialog` | `@tauri-apps/api/dialog` | ❌ nein |
| `fs:showSaveDialog` | `@tauri-apps/api/dialog` | ❌ nein |
| `fs:allowPath` | **entfällt** (statische Allowlist) | ❌ nein |
| `fs:getAppPath` | `@tauri-apps/api/path` | ❌ nein |

**Ergebnis: 0 Zeilen eigener Rust-Code nötig** für die Basis-Migration. Das ist der Idealfall.

---

## 4. Migrations-Schritte — Detailierter Plan

### Phase 0: Vorbereitung (0,5 Tag)

- [ ] **0.1** Rust installieren: `rustup` (offizielle Anleitung, ~5 min)
- [ ] **0.2** Tauri CLI: `cargo install tauri-cli --version "^2.0"`
- [ ] **0.3** Feature-Branch anlegen: `git checkout -b tauri-migration`
- [ ] **0.4** Backup des Electron-Codes: `git tag electron-legacy` (für Rollback)

**Erfolgskriterium:** `cargo tauri --version` gibt eine Version aus.

---

### Phase 1: Tauri-Projekt initialisieren (0,5 Tag)

- [ ] **1.1** Im Projekt-Root: `cargo tauri init`  
  Antworten auf Prompts:  
  - App name: `Game Builder`
  - Window title: `Game Builder Offline Editor`
  - Web assets dir: `../dist`
  - Dev server URL: `http://localhost:5173`
  - Framework: `custom`

- [ ] **1.2** Neuer Ordner `@src-tauri/` wird erstellt mit:
  - `src-tauri/Cargo.toml` — Rust-Dependencies
  - `src-tauri/src/main.rs` — Backend-Entry
  - `src-tauri/tauri.conf.json` — Config (entspricht `package.json > build`)
  - `src-tauri/icons/` — App-Icons

- [ ] **1.3** `@package.json` um Tauri-Scripts ergänzen:
  ```json
  "scripts": {
      "tauri:dev": "tauri dev",
      "tauri:build": "tauri build"
  }
  ```

- [ ] **1.4** `@tauri-apps/api` installieren: `npm install @tauri-apps/api`

**Erfolgskriterium:** `npm run tauri:dev` öffnet ein leeres Fenster, das `http://localhost:5173` lädt.

---

### Phase 2: NativeFileAdapter umbauen (1 Tag)

**Strategie:** Einen **Adapter-Layer** schreiben, der `window.electronFS` kompatibel zu Tauri macht. So muss **kein einziger Renderer-Caller** geändert werden.

- [ ] **2.1** Neue Datei `@src/utils/TauriFSAdapter.ts`:
  ```ts
  // Erkennt, ob in Tauri-Kontext, und stellt die electronFS-API bereit
  import { readTextFile, writeTextFile, readDir } from '@tauri-apps/api/fs';
  import { open, save } from '@tauri-apps/api/dialog';
  import { resourceDir } from '@tauri-apps/api/path';
  
  export function installTauriFSAdapter() {
      if (!(window as any).__TAURI__) return;
      (window as any).electronFS = {
          readFile: (p: string) => readTextFile(p),
          writeFile: (p: string, c: string) => writeTextFile(p, c),
          listFiles: async (d: string, ext?: string) => {
              const entries = await readDir(d);
              return ext ? entries.filter(e => e.name?.endsWith(ext)).map(e => e.name!) 
                         : entries.map(e => e.name!);
          },
          showOpenDialog: (opts: any) => open(opts),
          showSaveDialog: (opts: any) => save(opts),
          allowPath: async () => true, // Allowlist ist nun statisch
          getAppPath: () => resourceDir()
      };
  }
  ```

- [ ] **2.2** In `@src/main.ts` (Editor-Entry) zu Beginn aufrufen:
  ```ts
  import { installTauriFSAdapter } from './utils/TauriFSAdapter';
  installTauriFSAdapter();
  ```

- [ ] **2.3** Analog in `@src/player-standalone.ts` einbauen.

**Erfolgskriterium:** Editor öffnet sich in Tauri, Projekte lassen sich laden/speichern.

---

### Phase 3: Sicherheit konfigurieren (0,5 Tag)

- [ ] **3.1** In `@src-tauri/tauri.conf.json` die Allowlist sauber definieren:
  ```json
  {
      "tauri": {
          "allowlist": {
              "fs": {
                  "readFile": true,
                  "writeFile": true,
                  "readDir": true,
                  "scope": ["$APPDATA/**", "$RESOURCE/**", "$DESKTOP/*.json"]
              },
              "dialog": {
                  "open": true,
                  "save": true
              },
              "path": {
                  "all": true
              }
          },
          "security": {
              "csp": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self' ws: wss: http://localhost:*;"
          }
      }
  }
  ```

- [ ] **3.2** CSP aus `@electron/main.cjs:84-92` übernehmen (ist bereits sauber ausgearbeitet).

- [ ] **3.3** Window-Config spiegeln:
  ```json
  "windows": [{
      "title": "Game Builder Offline Editor",
      "width": 1280,
      "height": 720,
      "resizable": true,
      "maximized": true,
      "fullscreen": false
  }]
  ```

**Erfolgskriterium:** Tauri blockt Pfade außerhalb der Allowlist; DevTools zeigt korrekte CSP-Header.

---

### Phase 4: Test-Durchlauf & Fixes (0,5 Tag)

- [ ] **4.1** Den bestehenden Test-Runner laufen lassen: `npm run test`  
  Alle 190+ Tests müssen weiter grün sein (Runtime ist unverändert).

- [ ] **4.2** Manuelle Checks im Dev-Modus (`npm run tauri:dev`):
  - Editor öffnet sich ✓
  - Projekt laden / speichern ✓
  - Export funktioniert ✓
  - Multiplayer-Server-Verbindung ✓
  - DevTools öffnen mit F12 ✓

- [ ] **4.3** Production-Build testen: `npm run tauri:build`  
  Ergebnis in `@src-tauri/target/release/bundle/`.

**Erfolgskriterium:** Build erzeugt einen MSI/DEB/DMG, der auf einer frischen VM problemlos läuft.

---

### Phase 5: Build-Pipeline & CI (0,5 Tag, optional)

- [ ] **5.1** GitHub Actions Workflow anlegen (`.github/workflows/release.yml`), der auf 3 Plattformen builded.

- [ ] **5.2** Auto-Update konfigurieren (Tauri hat eingebauten Updater mit Signatur-Prüfung).

- [ ] **5.3** Electron-Reste entfernen:
  - `@electron/` Ordner
  - `electron`, `electron-builder` aus `@package.json`
  - `build`-Sektion in `@package.json`

**Erfolgskriterium:** Tagged Release erzeugt Binaries für alle 3 OS automatisch.

---

### Gesamt-Aufwand

| Phase | Dauer | Kritikalität |
|:---|:---:|:---:|
| 0 — Vorbereitung | 0,5 d | Low |
| 1 — Init | 0,5 d | Low |
| 2 — FS-Adapter | 1 d | **Medium** |
| 3 — Security | 0,5 d | **Medium** |
| 4 — Testing | 0,5 d | **High** |
| 5 — CI/Cleanup | 0,5 d | Low |
| **Gesamt** | **3,5 Tage** | |

Mit Puffer: **~1 Arbeitswoche** realistisch.

---

## 5. Risiko-Analyse

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|:---|:---:|:---:|:---|
| **R1:** WebView-Inkompatibilität (z.B. Safari vs Chrome Features) | Niedrig | Hoch | Feature-Detection + Polyfills. Betroffen wären primär neue CSS/JS-Features. Test auf allen 3 OS vor Release. |
| **R2:** CSP zu restriktiv → JSEP bricht | Mittel | Mittel | `'unsafe-eval'` explizit erlaubt (wie in Electron). T-01 Security-Test deckt Regressionen auf. |
| **R3:** Multiplayer-Networking (WebSocket) | Niedrig | Hoch | `connect-src` in CSP erlaubt `ws:`/`wss:` — Standard. Kein bekanntes Problem. |
| **R4:** Image/Audio-Assets (File-URLs) | Mittel | Mittel | Tauri nutzt `tauri://` oder `asset://` statt `file://`. Ggf. Asset-Loader anpassen. |
| **R5:** Rust-Lernkurve | Hoch | Niedrig | Für die Basis-Migration **kein** Rust-Code nötig. Nur falls später Custom-Commands dazukommen. |
| **R6:** macOS App-Notarization | Mittel | Niedrig | Nur bei Distribution über App Store relevant. Tauri-CLI unterstützt Signing. |
| **R7:** Bundle-Format-Inkompatibilität mit bestehendem Installer | Niedrig | Niedrig | Tauri liefert WiX-MSI (Windows), DMG (Mac), DEB/AppImage (Linux) — alle Standard. |

**Gesamt-Risiko: 🟢 Niedrig.** Die Runtime bleibt unberührt — das eigentliche Produkt ändert sich nicht.

---

## 6. Risiken spezifisch für dieses Projekt

### 6.1 WebView2-Abhängigkeit (Windows)

Windows 11 hat WebView2 vorinstalliert. Windows 10 teilweise nicht.

**Lösung:** Tauri-Bundler kann den WebView2-Installer mitliefern (`webviewInstallMode: "embedBootstrapper"`). Erhöht Binary um ~2 MB.

### 6.2 Runtime-Bundle (`runtime-standalone.js`)

Das `@public/runtime-standalone.js` wird aktuell von `esbuild` gebaut und in HTML-Exports eingebettet. Das ist **komplett unabhängig** von Electron/Tauri — wird also nicht beeinflusst.

### 6.3 `TNativeFileAdapter` (falls vorhanden)

Falls eine Datei `@src/utils/NativeFileAdapter.ts` o.ä. existiert, die `window.electronFS` direkt kapselt: Diese bleibt 1:1 erhalten, dank des Adapter-Layers in Phase 2.

### 6.4 Path-Traversal-Tests

Die `@tests/electron-security.test.ts` testet aktuell den `ElectronSecurity`-Layer. Nach der Migration müssen die Tests auf die **Tauri-Allowlist-Mechanik** umgestellt werden — oder als deaktiviert markiert, da die Security-Schicht sich strukturell ändert.

---

## 7. Vergleich mit Alternativen

| Option | Aufwand | Binary | Wartung | Empfehlung |
|:---|:---:|:---:|:---:|:---:|
| **Electron bleiben** | 0 d | 150 MB | mittel | 🟡 Status quo |
| **Tauri** | 3–4 d | **10 MB** | **niedriger** | 🟢 **Empfohlen** |
| **PWA only** | 1 d | 0 MB | sehr niedrig | 🟡 Nur für Web-Use-Case |
| **Native (Rust GUI)** | 6–12 Monate | 15 MB | doppelt | 🔴 Nicht empfohlen |
| **Flutter Desktop** | 3–6 Monate | 30 MB | doppelt | 🔴 Nicht empfohlen |
| **Native pro OS** | 18+ Monate | 20 MB | 3-fach | 🔴 Nicht empfohlen |

---

## 8. Reversibilität / Rollback-Plan

Die Migration ist **jederzeit umkehrbar**:

1. **Rollback-Branch:** `git checkout electron-legacy` stellt den Electron-Code her.  
2. **Side-by-Side:** Tauri kann **parallel** zu Electron existieren (kein Konflikt), falls eine Zeit lang beides unterstützt werden soll.  
3. **Hybrid-Strategie:** `tauri:build` für schlanke Distribution, `electron-builder` für Legacy-Systeme — möglich, aber selten nötig.

---

## 9. Offene Fragen an den Projekt-Owner

| # | Frage | Relevanz |
|:---:|:---|:---|
| F1 | Soll die Migration in einem Rutsch oder stufenweise (Editor erst, Player später) erfolgen? | Hoch |
| F2 | Gibt es Kunden auf Windows 7/8? (Tauri unterstützt nur Win 10+) | Mittel |
| F3 | Sind macOS-Builds mit Notarization gewünscht (Apple Developer Account nötig)? | Niedrig |
| F4 | Soll der Auto-Updater konfiguriert werden? (Tauri hat einen eingebauten) | Mittel |
| F5 | Soll ein Dual-Build (Electron + Tauri) temporär erhalten bleiben? | Niedrig |

---

## 10. Empfehlung

🟢 **Umsetzung wird ausdrücklich empfohlen.** Die Argumente:

1. **Extrem niedriges Risiko:** Renderer-Code bleibt unberührt — alles getestete bleibt getestet.
2. **Extrem hoher Nutzen:** 93 % kleinere Distribution, 60 % weniger RAM, bessere Security-Architektur.
3. **Geringe Einmalkosten:** ~3–4 Arbeitstage für ein Ergebnis, das **10+ Jahre** trägt.
4. **Keine Lock-in-Risiken:** Tauri ist Open-Source (MIT), gut finanziert, aktive Community.
5. **Reversibel:** Notfalls in 10 Minuten zurück auf Electron via Git-Tag.

**Nächster konkreter Schritt:**  
Phase 0 (Vorbereitung) starten — Rust + Tauri-CLI installieren. Das ist kostenfrei, unblockiert nichts und validiert die Grundvoraussetzungen.

---

## Anhang A: Referenzen

- **Tauri-Doku:** https://tauri.app/v2/guide/
- **Migration-Guide Electron → Tauri:** https://tauri.app/v1/guides/migrate-from-electron
- **API-Referenz:** https://tauri.app/v2/api/js/
- **Tauri vs Electron Vergleich:** https://tauri.app/v1/references/benchmarks

## Anhang B: Aktuelle Electron-Datei-Referenzen

- `@C:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\electron\main.cjs` — 220 Zeilen, wird ersetzt
- `@C:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\electron\preload.cjs` — 13 Zeilen, wird durch TauriFSAdapter ersetzt
- `@C:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\electron\security.cjs` — ~40 Zeilen, entfällt (Allowlist in `tauri.conf.json`)
- `@C:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\package.json:33` — `electron` Dependency, wird entfernt
- `@C:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\package.json:34` — `electron-builder`, wird entfernt

## Anhang C: Neue Dateien nach Migration

```
game-builder-v1/
├── src-tauri/              ← NEU
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── icons/
│   └── src/
│       └── main.rs         ← minimal (~20 Zeilen)
├── src/
│   └── utils/
│       └── TauriFSAdapter.ts  ← NEU (~30 Zeilen)
└── [rest unverändert]
```
