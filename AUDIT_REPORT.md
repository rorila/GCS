# Audit-Report: Game Builder v1

**Datum:** 11.06.2026
**Stand:** Commit-Reihe bis `6c1a4d52` (main)
**Umfang:** 310 TypeScript-Dateien, ~67.000 Zeilen Code (ohne Tests/Server)

---

## Executive Summary

Das Projekt ist funktional weit fortgeschritten und architektonisch grundsätzlich solide
(Manager-Pattern, Service-Registry, Adapter-Ports). Um ein professionelles Niveau zu
erreichen, sind jedoch Maßnahmen in fünf Bereichen erforderlich — sortiert nach Dringlichkeit:

| # | Bereich | Schweregrad | Aufwand |
|---|---------|-------------|---------|
| 1 | Sicherheit (Dependencies, XSS) | 🔴 Kritisch | Mittel |
| 2 | Repository-Hygiene | 🔴 Hoch | Gering |
| 3 | Code-Qualität (Typisierung, Globals) | 🟡 Mittel | Hoch |
| 4 | Test- & CI-Infrastruktur | 🟡 Mittel | Mittel |
| 5 | Architektur & Wartbarkeit | 🟢 Niedrig | Hoch |

---

## 1. Sicherheit — 🔴 Kritisch

### 1.1 Verwundbare Dependencies

`npm audit` meldet **29 Schwachstellen**: 1 kritisch, 14 hoch, 13 mittel, 1 niedrig.

**Maßnahmen:**
- [ ] `npm audit` ausführen und Report analysieren
- [ ] `npm audit fix` für unkritische Updates
- [ ] Major-Updates (z.B. Electron 28 → aktuell) gezielt planen und testen
- [ ] Dependabot/Renovate einrichten für automatische Update-PRs

### 1.2 XSS-Angriffsfläche durch innerHTML

**184 direkte `innerHTML`-Zuweisungen** im Quellcode. Besonders kritisch:
- Sticky-Notes rendern Benutzer-HTML ungehärtet (`TextObjectRenderer.renderStickyNote`)
- `EditorViewManager.renderStickyNotesView` rendert `n.text` als HTML (bewusste Entscheidung
  für klickbare Links, aber ohne Sanitizing)
- Projektdaten aus JSON-Dateien fließen teils ungefiltert in den DOM

**Maßnahmen:**
- [ ] DOMPurify (o.ä.) als zentrale Sanitizing-Schicht einführen
- [ ] Wrapper-Funktion `setSafeHTML(el, html)` erstellen und `innerHTML`-Stellen migrieren
- [ ] Mindestens alle Stellen härten, an denen **Benutzereingaben** oder **geladene
  Projektdaten** in den DOM gelangen
- [ ] ESLint-Regel `no-unsanitized` aktivieren um Rückfälle zu verhindern

### 1.3 Veraltetes execCommand

**8 Verwendungen** von `document.execCommand` (deprecated, kann jederzeit aus Browsern
entfernt werden). Betrifft die Rich-Text-Funktionen der Sticky-Notes.

**Maßnahmen:**
- [ ] Mittelfristig auf `Selection`/`Range`-API oder eine schlanke Editor-Bibliothek
  (z.B. ProseMirror-Core, Tiptap headless) migrieren
- [ ] Kurzfristig: Funktionalität dokumentieren und mit E2E-Tests absichern,
  damit eine Migration risikofrei möglich ist

### 1.4 eval / new Function

**1 Fundstelle** von `eval(`/`new Function(`. Auch wenn `jsep` für Expressions verwendet
wird (gut!), muss die verbleibende Stelle geprüft werden.

**Maßnahmen:**
- [ ] Fundstelle prüfen und durch jsep-basierte Auswertung ersetzen
- [ ] CSP in `tauri.conf.json` enthält `'unsafe-eval'` — nach Beseitigung entfernen

### 1.5 Browser-Dialoge (prompt/alert)

**3 Verwendungen** von nativem `prompt()` (z.B. Link-URL-Eingabe in Sticky-Notes).
Native Dialoge blockieren den Main-Thread und sind in Tauri/Electron teils
abgeschaltet (`default_script_dialogs(false)` im prevent-default-Plugin!).

**Maßnahmen:**
- [ ] **Wichtig:** Durch das neu eingebaute `tauri-plugin-prevent-default` könnten
  native Dialoge in Tauri nicht mehr funktionieren — prüfen!
- [ ] Auf den vorhandenen `DialogService` / `DialogManager` umstellen

---

## 2. Repository-Hygiene — 🔴 Hoch

### 2.1 Wurzelverzeichnis ist vermüllt

Über **70 Dateien im Root**, darunter:
- ~35 Test-Output-Artefakte (`test_output_deep_utf8_v3.txt`, `e2e_results.json`, …)
- Debug-Logs (`debug-log.txt`, `build_errors.log`, `ts_errors.log`)
- Ad-hoc-Patches (`patch2.cjs`, `patch3.cjs`, `fix_menu.cjs`, `scratch.ts`)
- **`rustup-init.exe`** (Binary, ~10+ MB, gehört nie ins Repo)
- Lose Testdateien (`test-ast.ts`, `test-expr.ts`, `test_timer.ts`, …)

**Maßnahmen:**
- [ ] Alle `*_output*.txt`, `*_results*.json`, `*.log` löschen und in `.gitignore` aufnehmen
- [ ] `rustup-init.exe` löschen (+ ggf. aus Git-Historie entfernen: `git filter-repo`)
- [ ] Ad-hoc-Scripts: löschen oder nach `scripts/archive/` verschieben
- [ ] Lose `test-*.ts` in `tests/`-Ordner konsolidieren oder löschen
- [ ] `.gitignore` erweitern: `*.log`, `test_output*`, `e2e_results*`, `report*.json`, `*.exe`

### 2.2 tsconfig referenziert tote Dateien

`tsconfig.json` → `include` enthält `test_serialization_verify.ts` und
`test_loader_logic.ts` als Einzeldateien sowie `demos`.

**Maßnahmen:**
- [ ] `include` auf `src` (+ `tests`) reduzieren
- [ ] Separates `tsconfig.test.json` für Testdateien

---

## 3. Code-Qualität — 🟡 Mittel

### 3.1 Typisierung

- **~1.890 `any`-Typen** — das hebelt `strict: true` praktisch aus
- Zentrale Datenflüsse (Renderer, Actions, Inspector) arbeiten mit `obj: any`
- `ComponentData` existiert als Typ, wird aber oft umgangen

**Maßnahmen (inkrementell):**
- [ ] ESLint mit `@typescript-eslint/no-explicit-any` als `warn` einführen
- [ ] Neue/geänderte Dateien: `any` verboten (Boy-Scout-Regel)
- [ ] Renderer-Schicht zuerst typisieren (`IRenderContext`, Component-DTOs) —
  hier entstehen die meisten Laufzeitfehler
- [ ] Discriminated Unions für Actions (`NavigateAction | AudioAction | …`) konsequent
  nutzen statt `action: any`

### 3.2 Globale Zustände

- **108× `(window as any)`** — u.a. `window.editor`, `window.helpOverlay`,
  `window.electronFS`, `window.PROJECT`
- Erschwert Tests, versteckt Abhängigkeiten, keine Typsicherheit

**Maßnahmen:**
- [ ] Zentrale typisierte Deklaration: `declare global { interface Window { … } }`
  in `vite-env.d.ts` (eine Stunde Aufwand, sofortiger Gewinn)
- [ ] Mittelfristig: Zugriffe über die vorhandene `serviceRegistry` statt `window`

### 3.3 Monolithische Dateien

| Datei | Größe |
|---|---|
| `EditorViewManager.ts` | **241 KB** (~5.000+ Zeilen) |
| `AgentController.ts` | 63 KB |
| `StageRenderer.ts` | 63 KB |
| `InspectorRenderer.ts` | 60 KB |
| `Editor.ts` | 57 KB (Kommentar behauptet „~200 Zeilen, Ziel <1000" — Realität: >1.200) |

**Maßnahmen:**
- [ ] `EditorViewManager` nach Views aufteilen (`StickyNotesView`, `ManagementView`,
  `UserStoriesView` …) — das Muster existiert bereits bei den Renderern
- [ ] Richtlinie: max. ~800 Zeilen pro Datei, in `DEVELOPER_GUIDELINES.md` festhalten

### 3.4 Logging

- 60 direkte `console.*`-Aufrufe parallel zum vorhandenen `Logger`
- Logger existiert und ist gut — wird nur nicht konsequent genutzt

**Maßnahmen:**
- [ ] `console.*` durch `Logger` ersetzen (mechanische Änderung)
- [ ] ESLint-Regel `no-console` aktivieren

### 3.5 Kein Linter konfiguriert

Es gibt **keine ESLint-Konfiguration** — nur TypeScript-Compiler-Checks.

**Maßnahmen:**
- [ ] ESLint 9 (flat config) + `typescript-eslint` einrichten
- [ ] Prettier oder ESLint-Stylistic für einheitliche Formatierung
- [ ] `npm run lint` als Script; später CI-Gate

---

## 4. Tests & CI — 🟡 Mittel

### Befund

- ✅ 72 Unit-/Integrationstests, 20 Playwright-Specs, eigener `test_runner.ts` — gute Basis!
- ❌ **Keine CI-Pipeline** (`.github/workflows` fehlt)
- ❌ Test-Ergebnisse landen als Textdateien im Repo statt in CI-Artefakten
- ❌ Keine Coverage-Messung

**Maßnahmen:**
- [ ] GitHub Actions (o.ä.) Workflow: `tsc --noEmit` → `npm run lint` → `npm test`
  → `npm run test:e2e` bei jedem Push/PR
- [ ] Coverage-Reporting (c8/istanbul) mit realistischem Startziel (z.B. 40%, steigend)
- [ ] Kritische Pfade priorisiert testen: `GameExporter` (Export-Korrektheit),
  `TaskExecutor`, `ActionRegistry`, Serialisierung (`getCleanProject`/`deepClean`)
- [ ] Tauri-Build in CI (mind. `cargo check`) damit Rust-Änderungen nicht erst lokal brechen

---

## 5. Architektur & Wartbarkeit — 🟢 Niedrig (aber strategisch)

### 5.1 Plattform-Strategie klären

Das Projekt unterstützt aktuell **vier Zielplattformen** gleichzeitig:
Browser (Vite), Electron, Tauri, Standalone-HTML-Export. Tauri soll primär werden.

**Maßnahmen:**
- [ ] Entscheidung dokumentieren: Wird Electron entfernt? (spart 2 große Dev-Dependencies,
  `electron/main.cjs`, Build-Konfiguration, Update-Aufwand)
- [ ] Plattform-Zugriffe (FS, Dialoge) hinter den vorhandenen Adapter-Ports
  (`IStorageAdapter`) konsequent kapseln — `(window as any).electronFS`-Aufrufe
  in `GameExporter`/`ProjectPersistenceService` verletzen das bereits vorhandene Muster

### 5.2 Versions-/Release-Disziplin

- `package.json` v3.9.1, `tauri.conf.json` v0.1.0, `RUNTIME_VERSION` 1.5.0 —
  drei unabhängige Versionsnummern
- `CHANGELOG.md` vorhanden (gut), aber Releases sind nicht getaggt

**Maßnahmen:**
- [ ] Eine Quelle der Wahrheit für die App-Version (Sync-Script für tauri.conf.json)
- [ ] Git-Tags für Releases (`v3.9.1`), idealerweise mit CI-Release-Build
- [ ] `RUNTIME_VERSION` separat lassen (ist fachlich korrekt eigenständig),
  aber Kompatibilitätsmatrix dokumentieren

### 5.3 Dokumentation

- ✅ `README.md`, `DEVELOPER_GUIDELINES.md`, `TESTING.md`, `README-AI.md` vorhanden
- ❌ Keine Architektur-Übersicht (Manager-Beziehungen, Datenfluss Editor↔Runtime)
- ❌ Komponenten-Katalog (TButton, TPanel, TVideo, …) fehlt für Endnutzer

**Maßnahmen:**
- [ ] `docs/ARCHITECTURE.md` mit einem Diagramm: Editor → Manager → Services → Runtime
- [ ] Komponenten-Referenz generieren (die `getInspectorProperties()`-Metadaten
  könnten dafür automatisiert ausgelesen werden)

---

## Priorisierter Maßnahmenplan

### Phase 1 — Sofort (1–2 Tage)
1. Repository aufräumen + `.gitignore` erweitern (§2.1)
2. `rustup-init.exe` entfernen (§2.1)
3. `npm audit fix` + kritische/hohe CVEs adressieren (§1.1)
4. Typisierte `Window`-Deklaration (§3.2)
5. Prüfen: native Dialoge (`prompt`) vs. `prevent-default`-Plugin (§1.5)

### Phase 2 — Kurzfristig (1–2 Wochen)
6. ESLint + Prettier einrichten, `no-console`, `no-explicit-any` als warn (§3.5)
7. CI-Pipeline: Typecheck, Lint, Tests, E2E (§4)
8. DOMPurify einführen, benutzergesteuerte `innerHTML`-Stellen härten (§1.2)
9. `console.*` → `Logger` (§3.4)
10. Plattform-Entscheidung Electron dokumentieren (§5.1)

### Phase 3 — Mittelfristig (1–2 Monate)
11. `EditorViewManager` aufteilen (§3.3)
12. `any`-Reduktion in der Renderer-Schicht (§3.1)
13. `execCommand`-Ablösung planen (§1.3)
14. Coverage-Ziel etablieren, kritische Pfade testen (§4)
15. Architektur-Doku + Komponenten-Referenz (§5.3)

---

## Positiv hervorzuheben

- **Manager-/Service-Architektur** mit klarer Delegation (Editor als Orchestrator)
- **Adapter-Ports** (`IStorageAdapter`, `IExportAdapter`) — sauberes Hexagonal-Ansatz-Muster
- **Eigenes Logging-Framework** mit Kategorien
- **Vorhandene Testbasis** (Unit + E2E mit Playwright) — überdurchschnittlich für ein Projekt dieser Art
- **Sicherheitsbewusstsein** stellenweise vorhanden (`SecurityUtils.escapeHtml`,
  `</script>`-Escaping im Export, CSP in Tauri konfiguriert)
- **Dokumentationskultur** (CHANGELOG, Guidelines, Testing-Docs)
