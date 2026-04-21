# Tauri-Konfiguration — Audit-Report

> **Status:** Draft · **Datum:** 2026-04-21 · **Geprüfte Version:** `src-tauri/` Scaffold auf Basis Tauri 2.10.3
> **Zweck:** Systematische Bestandsaufnahme des aktuellen Tauri-Setups vor einer möglichen Migration von Electron zu Tauri.

---

## 0. Executive Summary

Das vorhandene `src-tauri/`-Verzeichnis ist ein **frischer `tauri init`-Scaffold** mit nur minimalen Anpassungen (Identifier, ProductName, CSP-Grundgerüst). Im aktuellen Zustand ist die Tauri-Konfiguration **sicherheitstechnisch schlechter** als die gehärtete Electron-Installation. Vor einem produktiven Build müssen **mindestens drei P0-Befunde** behoben werden.

**Kernaussage:** Eine Migration ohne Fix von K1–K3 würde die Security-Arbeit aus Electron (Path-Whitelist, JSEP-Migration, CSP-Härtung) de-facto aufheben.

---

## 1. Geprüfte Dateien

| Datei | Zeilen | Zustand |
|:---|:---:|:---|
| `src-tauri/tauri.conf.json` | 37 | Scaffold + minimale Anpassungen |
| `src-tauri/Cargo.toml` | 27 | Scaffold + Plugin-Dependencies |
| `src-tauri/src/main.rs` | 6 | Scaffold (Standard-Entry) |
| `src-tauri/src/lib.rs` | 18 | Plugin-Registrierung, keine Commands |
| `src-tauri/build.rs` | 3 | Scaffold (Standard) |
| `src-tauri/capabilities/default.json` | 25 | **Permissiv / unsicher** |
| `src-tauri/icons/` | 0 items | **Leer (Build-Blocker)** |
| `package.json` (Tauri-relevante Teile) | — | Dep-Kategorien falsch |

---

## 2. Befundliste mit Priorisierung

| # | Befund | Kategorie | Priorität | Aufwand |
|:---:|:---|:---:|:---:|:---:|
| **K1** | CSP erlaubt `unsafe-eval` und `unsafe-inline` | Security | 🔴 **P0** | 15 min |
| **K2** | FS-Capabilities erlauben `path: "**"` (unbegrenzter FS-Zugriff) | Security | 🔴 **P0** | 30 min |
| **K3** | Icons-Ordner leer — Build schlägt fehl | Build | 🔴 **P0** | 5 min |
| **W1** | Windows-Signing (`bundle.windows`) fehlt komplett | Distribution | 🟡 P1 | 1–2 h |
| **W2** | Keine `invoke_handler` / kein `TauriStorageAdapter` | Funktionalität | 🟡 P1 | **2–4 Tage** |
| **W3** | Logging nur in Debug-Mode → keine Production-Diagnose | Diagnostik | 🟡 P1 | 15 min |
| **W4** | `@tauri-apps/api` + Plugins in `devDependencies` statt `dependencies` | Deployment | 🟡 P1 | 2 min |
| **W5** | Window-Config: `maximized` + `width/height` widersprüchlich; `minWidth/minHeight` fehlen | UX | 🟢 P2 | 5 min |
| **C1** | `Cargo.toml`: Default-Metadaten (`name = "app"`, `authors = ["you"]`, leere `license`/`repository`) + fehlendes `[profile.release]` | Qualität | 🟢 P2 | 10 min |
| **C2** | `src-tauri/target/` im Repo-Verzeichnis (`.gitignore` greift, aber Altlasten prüfen) | Cleanup | 🟢 P3 | 2 min |

---

## 3. Kritische Befunde (P0) — Details

### K1 — CSP erlaubt `unsafe-eval` und `unsafe-inline`

**Fundstelle:**

```@C:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\src-tauri\tauri.conf.json:21-23
    "security": {
      "csp": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' asset: http://localhost:*; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com asset: http://localhost:*; font-src 'self' https://fonts.gstatic.com data: asset: http://localhost:*; img-src 'self' data: blob: asset: http://localhost:*; connect-src 'self' ws: wss: http://localhost:*;"
    }
```

**Problem:**

- `'unsafe-eval'` erlaubt `eval()` und `new Function()`.  
  → Hebt die JSEP-Migration von `@C:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\src\editor\dialogs\utils\DialogExpressionEvaluator.ts` (RCE-Härtung) faktisch auf.
- `'unsafe-inline'` im `script-src` → macht Inline-XSS wieder ausnutzbar, trotz der Absicherung in `@C:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\tests\e2e\12_Security_HTMLInjection.spec.ts`.
- `http://localhost:*` in der **Production-CSP** → gehört in `devUrl`, nicht in die produktive Sicherheitsrichtlinie.
- `style-src 'unsafe-inline'` ist bei dynamischen Style-Bindings in Komponenten (`TStickyNote`, Inspector) pragmatisch schwer vermeidbar — **aber script-seitig ist es inakzeptabel**.

**Security-Impact:** Hoch. Die hexagonale Härtungsarbeit aus Electron wird negiert.

**Lösungsvorschlag (zur Diskussion, noch nicht angewendet):**

```json
"security": {
  "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: asset:; connect-src 'self'"
}
```

Wenn `'unsafe-inline'` im `style-src` zwingend bleiben muss (wegen dynamischer Style-Props): OK, aber im `script-src` **muss** es entfernt werden. Falls eine Stelle im Code tatsächlich `eval` braucht, bitte benennen — wir haben sie im Audit nicht mehr gesehen.

---

### K2 — Capabilities erlauben unbegrenzten Filesystem-Zugriff

**Fundstelle:**

```@C:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\src-tauri\capabilities\default.json:12-23
    {
      "identifier": "fs:allow-read-text-file",
      "allow": [{ "path": "**" }]
    },
    {
      "identifier": "fs:allow-write-text-file",
      "allow": [{ "path": "**" }]
    },
    {
      "identifier": "fs:allow-read-dir",
      "allow": [{ "path": "**" }]
    }
```

**Problem:**

- `"path": "**"` erlaubt Read/Write auf **jede Datei im Dateisystem**, inkl. `C:\Windows\System32`, Registry-Hives, User-Profile anderer Accounts.
- **Regression gegenüber Electron:** `@C:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\electron\security.cjs` nutzt aktuell einen `ALLOWED_ROOTS`-Whitelist-Mechanismus + Path-Traversal-Guard. Diese Schicht fehlt in Tauri komplett.
- Ein XSS-Angriff im WebView (dessen Wahrscheinlichkeit wir mit CSP reduzieren wollen, s. K1) hätte damit direkt vollen FS-Zugriff.

**Security-Impact:** Sehr hoch. Kombiniert mit K1 entsteht ein direkter Pfad von XSS → RCE.

**Lösungsvorschlag (zur Diskussion):**

```json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    {
      "identifier": "fs:allow-read-text-file",
      "allow": [
        {"path": "$APPDATA/game-builder/**"},
        {"path": "$DOCUMENT/GameBuilder/**"},
        {"path": "$DOWNLOAD/**"}
      ]
    },
    {
      "identifier": "fs:allow-write-text-file",
      "allow": [
        {"path": "$APPDATA/game-builder/**"},
        {"path": "$DOCUMENT/GameBuilder/**"}
      ]
    },
    {
      "identifier": "fs:allow-read-dir",
      "allow": [
        {"path": "$APPDATA/game-builder/**"},
        {"path": "$DOCUMENT/GameBuilder/**"}
      ]
    }
  ]
}
```

**Offene Frage an dich:** Welche Verzeichnisse sollen tatsächlich erreichbar sein? In Electron liest ihr Projekte aus `$DOCUMENT` und speichert Settings in `$APPDATA`. Drag&Drop-Import aus beliebigen Pfaden (z.B. `$DOWNLOAD`) muss separat entschieden werden.

---

### K3 — Icons-Verzeichnis leer

**Fundstelle:**

```@C:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\src-tauri\tauri.conf.json:29-35
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
```

`@C:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\src-tauri\icons` ist im Dateisystem vorhanden, enthält aber **0 Dateien**.

**Konsequenz:** `tauri build` bricht mit `icon not found: ...` ab. Dev-Mode (`tauri dev`) funktioniert eventuell trotzdem, aber kein Release.

**Lösungsvorschlag:**

```powershell
npx @tauri-apps/cli icon <pfad-zu-master-1024x1024.png>
```

Der Befehl generiert alle 5 referenzierten Dateien (inkl. macOS-`.icns` und Windows-`.ico`) automatisch aus einem einzigen 1024×1024 PNG.

**Offene Frage an dich:** Existiert ein Master-Icon der App (z.B. aus dem aktuellen Electron-Build)? Falls ja, bitte Pfad nennen. Falls nein, muss eins gestaltet werden.

---

## 4. Wichtige Befunde (P1) — Details

### W1 — Windows-Signing komplett unkonfiguriert

**Fundstelle:** Kein `bundle.windows`-Block in `@C:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\src-tauri\tauri.conf.json`.

**Problem:** Kein Signing-Setup → kein SmartScreen-fähiger Release → **SAC-Problem bleibt identisch wie bei Electron** (siehe `@C:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\ToDoList\Tauri_Migration_Feasibility.md`).

**Lösungsvorschlag:** Sobald Entscheidung über Signing-Strategie gefallen (Azure Trusted Signing vs. EV Cert), Block ergänzen:

```json
"bundle": {
  "active": true,
  "targets": "all",
  "windows": {
    "certificateThumbprint": null,
    "digestAlgorithm": "sha256",
    "timestampUrl": "http://timestamp.digicert.com",
    "signCommand": null
  },
  "icon": [ ... ]
}
```

Oder bei Azure Trusted Signing via `signCommand` mit dem offiziellen Tool integrieren.

---

### W2 — Keine Rust-Commands, kein TauriStorageAdapter

**Fundstelle:**

```@C:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\src-tauri\src\lib.rs:2-17
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
```

**Problem:**

- Kein `.invoke_handler(tauri::generate_handler![...])`. 
- Das Frontend kann aktuell nur über `@tauri-apps/plugin-fs` auf Dateien zugreifen — es gibt **keine** Rust-seitigen Custom Commands, die die Electron-IPC-Handler (`dialog:open`, `fs:read`, `fs:write` mit Whitelist-Check) ersetzen.
- **Der `TauriStorageAdapter` als Implementierung von `@C:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\src\ports\IStorageAdapter.ts` existiert noch nicht.**

**Implication:** Das ist der **Haupt-Migrationsaufwand** (laut Machbarkeitsstudie 2–4 Tage). Muss explizit in der Studie als Knackpunkt markiert werden.

**Zwei Umsetzungsstrategien:**

- **Strategie A (Plugin-FS direkt):** Frontend nutzt `@tauri-apps/plugin-fs` direkt, Whitelist wird rein über `capabilities/default.json` (K2-Fix) erzwungen. **Weniger Rust-Code**, aber Geschäftslogik (z.B. "verhindere `../` in User-Eingaben") muss im TS liegen.
- **Strategie B (Custom Commands):** Rust-Commands wrappen FS-Zugriffe, machen Validation serverseitig. **Höherer Rust-Aufwand**, aber saubere Analogie zu eurer Electron-`security.cjs`.

**Empfehlung:** Strategie B — passt besser zur bestehenden hexagonalen Architektur und zum Defense-in-Depth-Ansatz.

---

### W3 — Kein Production-Logging

**Fundstelle:**

```@C:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\src-tauri\src\lib.rs:7-13
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
```

**Problem:** Logging nur im Debug-Build aktiv. Production-User haben **keine Logs** → bei SAC-Blockaden, Crashes oder Storage-Fehlern fehlt jede Diagnose-Möglichkeit.

**Lösungsvorschlag:** Logging generell aktivieren, aber Level unterscheiden:

```rust
app.handle().plugin(
  tauri_plugin_log::Builder::default()
    .level(if cfg!(debug_assertions) {
      log::LevelFilter::Info
    } else {
      log::LevelFilter::Warn
    })
    .target(tauri_plugin_log::Target::new(
      tauri_plugin_log::TargetKind::LogDir { file_name: Some("game-builder".into()) },
    ))
    .build(),
)?;
```

Schreibt Logs nach `$APPDATA/com.gamebuilder.app/logs/game-builder.log`.

---

### W4 — Tauri-Runtime-Dependencies in devDependencies

**Fundstelle:**

```@C:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\package.json:30-36
  "devDependencies": {
    "@playwright/test": "^1.58.2",
    "@tauri-apps/api": "^2.10.1",
    "@tauri-apps/cli": "^2.10.1",
    "@tauri-apps/plugin-dialog": "^2.7.0",
    "@tauri-apps/plugin-fs": "^2.5.0",
```

**Problem:**

| Package | Soll | Aktuell | Begründung |
|:---|:---:|:---:|:---|
| `@tauri-apps/cli` | `devDependencies` | ✅ korrekt | Build-Tool |
| `@tauri-apps/api` | **`dependencies`** | ❌ falsch | Runtime-Import im Frontend |
| `@tauri-apps/plugin-fs` | **`dependencies`** | ❌ falsch | Runtime-Import |
| `@tauri-apps/plugin-dialog` | **`dependencies`** | ❌ falsch | Runtime-Import |

**Konsequenz:** Bei `npm ci --omit=dev` (Production-Install, z.B. im CI-Release-Build) würden diese Pakete fehlen und der Frontend-Build entweder crashen oder die Tauri-APIs nicht finden.

---

## 5. Nachgeordnete Befunde (P2/P3) — Details

### W5 — Window-Config

**Fundstelle:**

```@C:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\src-tauri\tauri.conf.json:11-20
    "windows": [
      {
        "title": "Game Builder Offline Editor",
        "width": 1280,
        "height": 720,
        "resizable": true,
        "maximized": true,
        "fullscreen": false
      }
    ],
```

**Probleme:**

- `maximized: true` ignoriert `width/height` beim ersten Start.
- Kein `minWidth`/`minHeight` → Resize kann UI unbrauchbar machen.
- Kein `center: true`.

**Lösungsvorschlag:**

```json
{
  "title": "Game Builder Offline Editor",
  "width": 1280,
  "height": 720,
  "minWidth": 1024,
  "minHeight": 640,
  "resizable": true,
  "maximized": true,
  "center": true,
  "fullscreen": false
}
```

---

### C1 — `Cargo.toml` Defaults + fehlendes Release-Profile

**Fundstelle:**

```@C:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\src-tauri\Cargo.toml:1-9
[package]
name = "app"
version = "0.1.0"
description = "A Tauri App"
authors = ["you"]
license = ""
repository = ""
edition = "2021"
rust-version = "1.77.2"
```

**Probleme:**

- `name = "app"` → generischer Scaffold-Name
- `authors = ["you"]` → Placeholder
- `license`, `repository` → leer
- Kein `[profile.release]` → Binary ist ~30–50 % größer als nötig, LTO & Symbol-Stripping fehlen

**Lösungsvorschlag:**

```toml
[package]
name = "game-builder"
version = "0.1.0"
description = "Game Builder Offline Editor"
authors = ["<dein-name>"]
license = "<kommerziell|MIT|...>"
repository = "<repo-url-oder-weg>"
edition = "2021"
rust-version = "1.77.2"

[profile.release]
lto = true
opt-level = "s"
codegen-units = 1
strip = true
panic = "abort"
```

---

### C2 — `target/` im Repo-Verzeichnis

`@C:\Users\rolfr\.gemini\antigravity\scratch\game-builder-v1\src-tauri\.gitignore:1-5`

```
# Generated by Cargo
# will have compiled files and executables
/target/
/gen/schemas
```

`.gitignore` greift — gut. Nur bestätigen, dass `target/` nicht durch einen früheren Commit versehentlich im Repo gelandet ist (`git ls-files src-tauri/target` sollte leer sein).

---

## 6. Fragen zur Klärung vor Umsetzung

| # | Frage | Benötigt für |
|:---:|:---|:---|
| F1 | Welche Dateipfade muss die App lesen/schreiben können? (Nur `$APPDATA` + `$DOCUMENT`, oder auch `$DOWNLOAD`, Custom-Paths aus Dialog?) | K2 |
| F2 | Gibt es ein Master-Icon (1024×1024 PNG)? Falls ja, Pfad? | K3 |
| F3 | Wurde Azure Trusted Signing bereits evaluiert oder ist EV-Cert angeschafft? | W1 |
| F4 | Strategie A (Plugin-FS direkt) oder Strategie B (Custom Rust Commands) für Storage-Layer? | W2 |
| F5 | Muss im Produktionscode tatsächlich `eval`/`new Function` vorkommen? (Stand Audit: **nein**, JSEP deckt alles ab) | K1 |

---

## 7. Empfohlene Reihenfolge der Umsetzung

**Phase A — Konfiguration härten (halber Tag):**
1. K3 Icons generieren (`npx @tauri-apps/cli icon ...`)
2. K1 CSP in `tauri.conf.json` einschränken
3. K2 `capabilities/default.json` auf Whitelist-Scopes umstellen
4. W3 Logging in Production aktivieren
5. W4 Dep-Kategorien in `package.json` korrigieren
6. W5 Window-Config bereinigen
7. C1 `Cargo.toml` Metadaten + Release-Profile

**Phase B — Funktionale Migration (Haupt-Aufwand, 2–4 Tage):**
8. W2 `TauriStorageAdapter` implementieren (inkl. Rust-Commands, falls Strategie B)
9. Export-Pfad-Ersatz für `GameExporter` (derzeit via Electron IPC)

**Phase C — Release-Pipeline (1–2 Tage):**
10. W1 Windows-Signing konfigurieren (Azure Trusted Signing bevorzugt)
11. Tauri-Action in CI einrichten
12. Smoke-Test auf Test-Windows-11-Maschine mit SAC aktiviert

---

## 8. Status & nächste Aktion

Dieser Report ist eine **reine Bestandsaufnahme ohne Code-Änderungen**. Keine Datei im Repo wurde modifiziert.

**Nächste Aktion:** Beantworte F1–F5 (Abschnitt 6), dann können wir pro Befund entscheiden, ob und wie der Fix angewendet wird.
