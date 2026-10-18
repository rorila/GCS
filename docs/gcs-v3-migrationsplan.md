# GCS V3 Phase 2 — Sicherungs- und Git-Migrationsvorbereitung

**Prüfzeitpunkt-Stand:** `master @ 40968be44dbe` — identisch mit Inventur, keine Abweichung
**Auftrag:** Planungs- und Prüfauftrag, READ-ONLY (keine Dateien verschoben, keine Commits, keine Pushes)

---

## A. Aktueller Git-Zustand (erneut verifiziert)

| Kennzahl | Inventur | Jetzt | Δ |
|---|---|---|---|
| HEAD | `40968be` | `40968be44dbebe5b15e94d29d1af56675ff85d8b` | — |
| Commits | 51 | 51 | — |
| Getrackte Dateien | 4 659 | 4 659 | — |
| Modified | 32 | 32 | — |
| Deleted | 1 (`docs/coding-standards.md`) | 1 | — |
| Untracked | 44 | 44 | — |
| Remote | `origin → github.com/rorila/GCS.git`, `master == origin/master` | identisch | — |
| `origin/v2` | ~7 Commits hinter master | identisch | — |

**Keine neuen Änderungen seit der Inventur.**

### Sicherungsinventar (was gesichert werden muss)

| Kategorie | Inhalt | Git-Status | Kritikalität |
|---|---|---|---|
| **Versioniert** | 4 659 Dateien @ `40968be` | committed | ✅ im Repo |
| **Nicht committete Änderungen** | 32 `M`-Dateien: gesamte SWE-2-Basis, Argon-Portal-Code + Daten (`portal-data-argon.*`), Codex-Berichts-Updates | modified | **P0** — der verifizierte A04-Endstand |
| **Unversionierte Berichte** | `A04-NACHPRUEFUNG-SWE2.md`, `A04-KORREKTUR-CODEX.md`, `RE-AUDIT-*.md` (4), `KORREKTURBERICHT-*.md` (2), `REGRESSIONSTESTS-*` (2), `ARGON-REPARATURPLAN-SWE2.md`, `SCHNITTSTELLENAENDERUNGEN-SWE2.md`, `INTEGRATION-SWE2-ARGON.md`, `TESTBERICHT-INTEGRATION-ARGON.md`, `DEVIN-SYSTEMREGELN.md`, `SYSTEM_PROMPT_REFERENCE.md`, `coding-standards_Gemini.md` | untracked | **P0** |
| **Unversionierte Test-Skripte** | `test-a04-argon.cjs`, `test-integration-argon.cjs`, `validate-swe2-schema-argon.cjs`, `test-knowledge-swe2.cjs`, `a04-fix-*.cjs`, `audit-extra-v2.cjs` | untracked | **P0** — Nachweis der Tests |
| **Unversionierte Sandboxen** | `docs/gcs-review-codex/{a04-fix,audit-v2,re-audit,sandbox}/` (~210 MB Repo-Kopien) | untracked | P3 — nicht committen |
| **Ignorierte Nutzdaten** | `game-server/data/` (34 MB: `cms.sqlite`+WAL+SHM+lock, `cms-v1.json`, `cms-v1-ops.json`, `cms-admin-auth.json`, `uploads/` 17 MB, `backups/` 9,8 MB, `tts-cache/`), `uploaded_games/`, `projects/master_test/` | ignoriert | **P0** — Live-Daten des CMS |
| **Ignorierte Secrets/Config** | `.env` (944 B), `.env.*` | ignoriert, **nicht getrackt** | **P0** — sichern, aber niemals ins Repo |
| **Ignorierte regenerierbare Daten** | `dist/` 243 MB, `node_modules/` 878 MB + `game-server/node_modules` 36 MB, `tools/speech-service/` 497 MB, `game-server/tts/` 415 MB (Voices+venv), `test-results/` 3,4 MB, `.codex-work/` 2,4 MB | ignoriert | P3 — neu erzeugbar |
| **Große getrackte Altlasten** | `artifacts/` 200 MB, `public/videos/` 153 MB, `Archiv/` 86 MB, `GCS-Medien-Pilot-Audit.zip` 83 MB, `backups/` 19 MB | **tracked** | P1 — vor V3-Übernahme archivieren |
| **Wichtige Einzeldateien** | `game-server/public/projects/GCS-CMS.json` (4 MB, die CMS-Definition selbst!), `GCS-SQL-Tool.json`, 32 Spiel-JSONs, `docs/gcs-knowledge-swe2/` (komplett, modified!), `docs/gcs-doc-portal-argon/` (modified!) | teils modified | **P0** |

---

## B. Backup-Strategie (Vorschlag — nicht ausgeführt)

### Empfohlener Ablauf (4 Schritte, getrennt gesichert)

```
Schritt 1 ─ Vollständiger Arbeitsstand in Git festschreiben
  a) Die 44 ??-Einträge aufteilen →
       • Berichte/Tests (P0) → committen
       • Sandboxen a04-fix/ audit-v2/ re-audit/ sandbox/ → NICHT committen,
         stattdessen extern (siehe Schritt 3)
  b) gezieltes Staging (KEIN git add -A):
       git add docs/gcs-knowledge-swe2 docs/gcs-doc-portal-argon \
               docs/gcs-review-codex/*.md docs/gcs-review-codex/*.json \
               docs/*.md docs/coding-standards_Gemini.md
       git add docs/gcs-review-codex/*.cjs   (Skripte, nicht Sandboxen)
       git add -u   (für die 32 Modified + die gelöschte coding-standards.md)
  c) Commit auf einem Sicherungs-Branch:
       git switch -c backup/pre-v3-inventory
       git commit -m "chore: Sicherungsstand vor V3-Migration (Inventur + Audits)"
       git push -u origin backup/pre-v3-inventory
  d) Tag setzen: git tag -a v2-final-40968be -m "Letzter V2-Stand"

Schritt 2 ─ Ignorierte Nutzdaten separat sichern (außerhalb Git!)
  Externer Ordner, z. B. ..\gcs-v2-backup\<Datum>\
    ├── env/               .env, .env.*            (Secret — nur lokal!)
    ├── cms-data/          game-server/data/  (SQLite, Uploads, Backups, auth)
    ├── local-projects/    projects/master_test/, uploaded_games/
    └── manifest.txt       Dateiliste + SHA-256 je Datei

Schritt 3 ─ Historische Artefakte extern archivieren (Schritt C)
    ..\gcs-v2-archive\<Datum>\
    ├── audit-sandboxes/   docs/gcs-review-codex/{a04-fix,audit-v2,re-audit,sandbox}
    ├── artifacts/, Archiv/, backups/, GCS-Medien-Pilot-Audit.zip …
    └── MANIFEST mit SHA-256 + Ursprungspfad

Schritt 4 ─ Verifikation
    git clone --mirror → Vergleich per `git fsck` + `git log`
    Für jede Sicherungskopie: SHA-256-Manifest gegen Quelle prüfen
    Stichprobe: sqlite-DB per `sqlite3 cms.sqlite "PRAGMA integrity_check"`
```

### Warum Branch + Tag statt nur Commit auf master?

| Option | Bewertung |
|---|---|
| `backup/pre-v3-inventory`-Branch | **Empfohlen** — hält master sauber, Migrations-Commit klar getrennt, kann später gemergt werden |
| Nur Tag auf `40968be` | **Unzureichend** — sichert nicht die 33 ungespeicherten/untracked P0-Dateien |
| `git stash` | **Nein** — fragil, nicht pushbar, keine Dauerhaftigkeit |
| `git bundle create` | Optional als **zusätzliches** Offline-Backup der Historie (1 Datei, portabel) |

**Wichtig:** `git add -A` darf nicht verwendet werden, weil die 4 Sandbox-Verzeichnisse (~210 MB Repo-Kopien) sonst committed würden.

---

## C. Archivierungsplan (extern, außerhalb V2 + V3)

Empfohlener Archivort: `..\gcs-v2-archive\<Datum>\` (Geschwister-Verzeichnis, nicht im Repo)

| Gruppe | Größe | Git | Archivziel | In V3 nötig? | Vor Entfernung sichern |
|---|---:|---|---|---|---|
| `artifacts/` | 200 MB | tracked | `archive/artifacts/` | ❌ Nein (Testnachweis-Videos) | ✅ als Archiv |
| `Archiv/` | 86 MB | tracked | `archive/archiv/` | ❌ Nein (alte Projekte) | ✅ |
| `backups/` | 19 MB | tracked | `archive/backups/` | ❌ Nein | ✅ |
| `GCS-Medien-Pilot-Audit.zip` | 83 MB | tracked | `archive/` | ❌ | ✅ |
| `public/videos/` | 153 MB | tracked | `archive/videos/` | ⚠ **Entscheidung** — produktiv in Landingpage? | ✅ |
| `docs/gcs-review-codex/*/` Sandboxen | ~210 MB | untracked | `archive/audit-sandboxes/` | ❌ | nur Berichte committen, Sandboxen extern |
| `training-data/` | 535 KB | tracked | `archive/` | ❌ (KI-Training, regenerierbar) | ✅ |
| `tmp-snippets/` | <1 KB | tracked | löschbar | ❌ | — |
| `nul` | 1 KB | ignoriert | löschbar | ❌ | — |
| `data/` (leer), `uploaded_games/` (leer) | 0 | ignoriert | — | ❌ | — |
| `test-results/` | 3,4 MB | ignoriert | löschbar | ❌ | — |
| `.codex-work/` | 2,4 MB | ignoriert | `archive/` optional | ❌ | Debug-Screenshots |
| `dist/` | 243 MB | ignoriert | neu bauen | ❌ | — |
| `tools/speech-service/`, `game-server/tts/` | ~900 MB | ignoriert | neu installieren | ❌ | nur `requirements.txt`/Setup-Doku |

**Summe zur Archivierung: ~750 MB getrackt/lokal.** Diese wandern aus dem Arbeitsbaum, bleiben aber extern wiederherstellbar. Die Audit-*Berichte* (`*.md`, `*.json`, Testskripte) sind **keine** Altlasten — sie gehören committed ins Archiv-Verzeichnis der Doku.

---

## D. Electron-/Tauri-Funktionsvergleich (geprüft, nicht vermutet)

**Befund:** Tauri ist weiter als eingeschätzt — `src-tauri/` ist vollständig aufgesetzt (tauri 2.10.3, 4 Plugins, CSP, Fenster-Config, Capabilities), und `TauriFSAdapter.ts` emuliert bereits die komplette `window.electronFS`-API. **Aber:** 5 funktionale Lücken (P1).

| Funktion | Electron | Tauri (heute) | Handlungsbedarf |
|---|---|---|---|
| Fenster/Größe/Maximierung | `BrowserWindow` + `win.maximize()` | ✅ `tauri.conf.json` (`maximized`, minSize) | — |
| CSP | Session-Header | ✅ `tauri.conf.json` `security.csp` — nahezu identisch | — |
| Kontext-Isolation | `contextIsolation:true` | ✅ inhärent (Frontend/Rust getrennt) | — |
| Shortcut-Blocker | Menü-Ausblendung | ✅ `tauri-plugin-prevent-default` (Dev: F12/F5 erlaubt, Release: alle blockiert) | — |
| `fs:readFile` (Text) | IPC + Whitelist | ⚠ `readTextFile` — funktioniert, aber **statische Scope `$HOME/**`** | **P1**: Dateien außerhalb HOME (z. B. anderes Laufwerk) schlagen fehl; dynamische Scope-Erweiterung via Dialog-Pick fehlt |
| `fs:writeFile` | IPC + `mkdirSync(recursive)` | ⚠ `writeTextFile` legt **keine Elternordner** an | **P1**: Fehlschlag bei Export in neuen Ordner |
| `fs:listFiles` | relativ zu `app.getPath('userData')` | ⚠ liest **absoluten** Pfad (`readDir(d)`) | **P1**: `NativeFileAdapter.listFiles('.', …)` liefert in Electron `userData`, in Tauri das CWD — **semantisch anders** |
| `fs:getAppPath` | `app.getAppPath()` (Installations-/Projektroot) | ⚠ `resourceDir()` (Bundle-Ressourcen) | **P1**: `GameExporter`+`LocalExportAdapter` lesen `${appPath}/dist/runtime-standalone.js` — **Pfad bricht unter Tauri** |
| `fs:showOpenDialog` / `SaveDialog` | `dialog.*` + `addAllowedPath` | ⚠ Plugin `open`/`save` vorhanden, aber keine nachfolgende Scope-Freigabe | **P1** (siehe readFile) |
| `fs:allowPath` | dynamische Whitelist + SafeBase-Check | ⚠ Stub → `true` (Scope statisch in `capabilities/*.json`) | **P1**: `EditorProjectLoader`/`Saver` rufen es nach dem Speichern auf — ohne Wirkung; Zugriff auf gerade gewählte Datei außerhalb `$HOME` scheitert |
| Ungespeicherte-Änderungen-Dialog | `will-prevent-unload` + `dialog.showMessageBoxSync` | ❌ **nicht implementiert** | **P1**: Rust-Seite `on_window_event`/`CloseRequested` fehlt — Datenverlustrisiko beim Schließen |
| Externe-Navigation-Block | `will-navigate` preventDefault | ⚠ nur CSP | **P2**: `on_navigation`-Handler in Rust fehlt |
| Popup-Block (`window.open`) | `setWindowOpenHandler(deny)` | ⚠ nicht explizit | **P2** |
| DevTools | `openDevTools()` (Dev) | ✅ `devtools`-Feature + F12 erlaubt | — |
| Binärdatei-IO | utf-8 only | utf-8 only | — (Parität) |
| File-Drop ins Fenster | — | ✅ `dragDropEnabled:false` bewusst gesetzt | — |
| Build | `electron-builder` | `tauri build` (bundle targets all) | Pipeline-Test nötig |
| Auto-Update/Installer | electron-builder | Tauri-Bundler | **P2**: ungetestet |
| Tests | `tests/electron_security.test.ts` (ElectronSecurity) | ❌ kein Tauri-Security-Test | **P1**: Pendant für Capability-Scope schreiben |
| Editor-Einstieg | `installTauriFSAdapter()` wird bereits in `main.ts` + `player-standalone.ts` aufgerufen | ✅ | — |

**Fazit Tauri:** Grundgerüst **vorhanden und lauffähig** (Dev: `tauri:dev`, Build konfiguriert), aber **5 funktionale Lücken (P1)** — hauptsächlich *dynamische Pfad-Freigabe*, *userData-Semantik von `listFiles`/`getAppPath`* und der *Unsaved-Changes-Dialog*.

---

## E. Game-Server-/CMS-Ausgliederungsplan

### Zuordnung nach `gcs-cms`

| Element | Pfad | GCS-Abhängigkeit | Maßnahme |
|---|---|---|---|
| CMS-Server + Runtime | `scripts/cms/` (117 Dateien) | liest `public/runtime-standalone.js`, projiziert `GCS-CMS.json` | verschieben nach `gcs-cms/server/` |
| Game-Server | `game-server/` (src, dist, public, data) | eigenes npm-Paket, **keine src-Imports** | verschieben nach `gcs-cms/game-server/` |
| CMS-Projekt | `game-server/public/projects/GCS-CMS.json`, `GCS-SQL-Tool.json` | — | mitnehmen |
| Spielkatalog | `game-server/public/projects/*.json` (30 Spiele) | — | mitnehmen |
| Editor-Beispiele | `public/projects/` (3) | — | → GCS oder konsolidieren |
| CMS-Build-/Add-Skripte | `scripts/cms/cms-build-*`, `cms-add-*` | `cms-build-math-puzzle.cjs` + `bundle-runtime` ziehen aus `src/` | Abhängigkeit auf Runtime-Paket umbiegen |
| CMS-Medien | `public/images`, `audio`, `videos` (via `ROOT_PUBLIC_DIR`) | **Server serviert Root-`public/` für Medien-Picker** | Assets duplizieren oder CDN-Pfad |
| CMS-Tests | `tests/cms_*.test.ts`, `editor_cms_*.test.ts`, `scripts/test-cms-*.cjs` | — | → `gcs-cms/tests/` |
| CMS-Doku | `docs/CMS-*.md` (~20) | — | → `gcs-cms/docs/` |
| Deployment | `deploy/fly/` + `game-server/fly.toml`+`Dockerfile` | — | → `gcs-cms/deploy/` |

### Verbleibende GCS-Abhängigkeiten (der eigentliche Kontrakt)

```
GCS produziert                        CMS konsumiert
─────────────────────────────────────────────────────────
src/player-standalone.ts  ──esbuild──► runtime-standalone.js
src/utils/SpokenNumber.ts ──esbuild──► cms-spoken-number.cjs
src/components/TServer*.ts (Dekl.)   ◄──► cms-server-components.cjs (Impl.)
Projekt-JSON-Schema                   ◄──► Spiel-Paket (*.json)
src/multiplayer/Protocol.ts          ◄──► game-server/src/Protocol.ts
public/images|audio                  ◄──► game-server /images,/audio
```

### Versionierter Runtime-Vertrag (Vorschlag)

```
@gcs/runtime Paket (npm oder Release-Tarball):
  package.json   { name:"@gcs/runtime", version:"<gcs-version>" }
  runtime-standalone.js
  cms-spoken-number.cjs
  manifest.json  { runtimeVersion, projectSchemaVersion,
                   componentSchemaHash, protocolVersion,
                   checksums: { "runtime-standalone.js":"sha256:…" } }

Spielpaket (Export aus GCS):
  <name>-<version>.gcspack = zip {
    project.json          (mit meta.schemaVersion)
    assets/…
    manifest.json         { gcsVersion, runtimeMin:">=x.y", sha256 }
  }
```

CMS prüft beim Import `runtimeMin ≤ eigene runtimeVersion` und `componentSchemaHash`-Kompatibilität. Das entkoppelt Releasezyklen.

---

## F. Dokumentations- und Git-Struktur

```
game-builder-v3/                     gcs-cms/
└── docs/                            └── docs/
    ├── architecture/                    ├── concepts/   (CMS-*.md)
    ├── reference/  schemas/             ├── datenschutz/
    ├── user-guide/ handbook-html/       ├── rollout/
    ├── knowledge/swe2/                  └── audits/ (nur CMS-betreffende)
    ├── portal/argon/
    └── audits/  (Codex+SWE-2-Berichte, gemeinsame Quelle)

shared/
└── contracts/  (Runtime-Vertrag, Projekt-Schema, Protocol)  ← beidseitig referenziert
```

**Commit-Strategie:** Conventional-Commit-Stil wie bisher (`feat:`, `fix:`, `chore:`, `docs:`); Migrations-Commits separat (`chore(migration): …`); **ein Commit pro logischer Einheit** — nie „Bereinigung + Feature" gemischt. Audit-/Nachweis-Dateien als `docs(audit):` taggen.

---

## G. Schrittweiser Migrationsplan (Meilensteine)

| # | Meilenstein | Ziel | Voraussetzung | Betroffene Dateien | Prüfung | Risiko | Rückfall | Freigabe nötig |
|---|---|---|---|---|---|---|---|---|
| **M0** | **Ausgangsstand sichern** | Vollständige Wiederherstellbarkeit | — | 32 M + 44 ?? + ignorierte Nutzdaten | SHA-256-Manifest vs. Quelle, `git fsck` auf Mirror-Clone | Sandboxen versehentlich committen | — | **Ja** |
| **M1** | **Sicherung verifizieren** | Backup beweisbar | M0 | Backup-Manifeste | Test-Checkout des Backup-Branch in leeres Verz.; `npm ci && npm test -- --fast` | Fehlerhaftes Backup unbemerkt | — | **Ja** |
| **M2** | **Historische Daten archivieren** | Arbeitsbaum entlasten | M1 | artifacts/, Archiv/, backups/, videos, ZIPs, Sandboxen | Archiv-Manifest + Datei-Count, Stichproben-Hash | Verlust, wenn vor git rm archiviert wird | Git-Historie + externes Archiv | **Ja** |
| **M3** | **GCS-V3-Projekt vorbereiten** | Neues Repo-Grundgerüst | M1, M2 | clone→filter, `src/`, `index/player.html`, `vite.config.ts`, `tests/`, `scripts/` (ohne cms), GCS-Docs | `npm ci`, `npm run build`, `npm test` | Zu viel/zu wenig übernommen | V2 bleibt intakt | **Ja** |
| **M4** | **Tauri-Betriebsfähigkeit** | Editor unter Tauri startklar | M3; **5 P1-Lücken aus Abschnitt D** | `src-tauri/`, `TauriFSAdapter`, `lib.rs` (unload-Dialog, Scope), `GameExporter`/`NativeFileAdapter` (getAppPath/listFiles) | `tauri:dev` startet, Projekt öffnen/speichern/exportieren, unsaved-changes-Dialog, Dateien außerhalb $HOME | Lücken übersehen → Dateizugriffe schlagen fehl | Electron parallel behalten bis M4 grün | **Ja** |
| **M5** | **GCS-CMS ausgliedern** | Eigenständiges `gcs-cms` | M3, Runtime-Vertrag (E) | `scripts/cms/`, `game-server/`, CMS-Docs, deploy/fly | `node cms-server.cjs` startet, CMS-UI lädt, Login, Spiel startet, Multiplayer-Raum | Runtime-Pfad zeigt noch ins alte Repo | V2 lauffähig | **Ja** |
| **M6** | **Runtime-Schnittstelle stabilisieren** | `@gcs/runtime` Paket | M3+M5 | `bundle-runtime.mjs`, manifest.json, Import-Pfad im CMS | Versions-Handshake, Hash-Verifikation, Import eines Pakets | Drift bei paralleler Entwicklung | direkte Datei-Kopie als Fallback | **Ja** |
| **M7** | **Tests + Funktionsvergleich** | Regressionssicherheit | M4–M6 | gesamte Test-Suites | `npm test` beider Repos, CMS-Testkatalog, manueller Editor↔CMS-Roundtrip (Spiel exportieren→importieren→spielen) | Stille Brüche | V2-Referenzverhalten | **Ja** |
| **M8** | **Repos unabhängig freigeben** | Finale Trennung | M7 ✅ | beide Repos | getrennte `npm ci`+Build+Test auf sauberer Maschine (ohne V2-Ordner) | Versteckte Pfad-Abhängigkeit auf V2 | letzter gemeinsamer Tag | **Ja** |

**Zwingend vor V3:** M0, M1, M2, M3, M5. **Später möglich:** M4-Restlücken (Electron parallel), M6-Paket (vorher Dateikopie), Assets-Videos-Entscheidung.

---

## Offene Risiken & Entscheidungen

1. **Tauri-P1-Lücken** (5 Stück) — Aufwand real, aber begrenzt; Electron bleibt bis M4 parallel.
2. **`public/videos/` 153 MB** — produktiv (Landingpage) oder Altlast?
3. **`coding-standards.md`** — Original wiederherstellen oder `_Gemini`-Variante als Ersatz + Referenzen fixen?
4. **`public/projects` vs `game-server/public/projects`** — `MauMau.json` divergiert; kanonische Quelle festlegen.
5. **`game-server` = Multiplayer + Hosting** — komplett zum CMS (empfohlen) oder Multiplayer-Kern bei GCS?
6. **Protocol.ts-Drift** — bei Trennung als gemeinsamer Contract versionieren.
7. **`.env`-Handling** — nur lokal sichern, nie ins Repo.

---

## Abschlussantworten

- **Vollständige Sicherung:** Backup-Branch `backup/pre-v3-inventory` mit gezieltem Staging (kein `add -A` wegen Sandboxen) + Tag `v2-final-40968be` + `git bundle` + separates Daten-Backup (`game-server/data`, `.env`) mit SHA-256-Manifest, verifiziert durch Test-Checkout.
- **Zwingend separat zu sichern:** `.env`, `game-server/data/` (SQLite+Uploads+auth), `projects/master_test/`, alle 44 untracked Dateien (Berichte+Tests), 32 modified Dateien.
- **Nicht nach V3:** `artifacts/`, `Archiv/`, `backups/`, Audit-Sandboxen, 83-MB-ZIP, `tmp-snippets/`, `nul`, ggf. `public/videos/`, `training-data/`, `src-tauri` (ersetzt Neubau), `electron/` (nach Tauri-Freigabe).
- **Tauri fehlt vs Electron:** dynamische Pfad-Freigabe (`allowPath` ist Stub), `listFiles`-userData-Semantik, `getAppPath`→appPath statt resourceDir, `writeFile` ohne auto-mkdir, Unsaved-Changes-Dialog, Navigation-/Popup-Blocker, Security-Test.
- **Game-Server→CMS:** als eigenes npm-Paket in `gcs-cms/game-server/`, zusammen mit `scripts/cms/`; Kopplung nur über Runtime-Artefakt + Projekt-Schema + Protocol-Contract.
- **Runtime-Kompatibilität:** versioniertes `@gcs/runtime`-Paket mit `manifest.json` (Versionen + Hashes) + `runtimeMin`-Prüfung im CMS-Import.
- **Repo-Empfehlung:** `game-builder-v3` (GCS, mit Historie via filter-repo) + `gcs-cms` (CMS, eigenes Repo, Runtime als Paket-Dep) + externes `gcs-v2-archive` (kein Repo).
- **Erster risikoarmer Schritt:** **M0** — den Backup-Branch mit den 32 M- + den P0-??-Dateien erstellen und pushen. Kostet nichts, sichert alles, ändert keinen produktiven Stand.
