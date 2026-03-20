# Clean Code Transformation Plan (Game Builder V1)

Basiert auf den Erkenntnissen zur Verhinderung von Regressionen und der Entkopplung von UseCases (Architektur-Refactoring). Dieser Plan dient als Guideline für die schrittweise Umstellung der GCS-Basis am offenen Herzen.

## Phasenübersicht

### Phase 1: Unidirektionaler Datenfluss (ProjectStore vollenden) ✅
**Ziel:** Keine direkten Mutationen mehr an Objekten oder dem State kreuz und quer aus Inspector, Stage und Editor. Alles läuft transparent über Actions und den `ProjectStore`.
- [x] **Audit:** Identifikation aller stillen direkten State-Mutationen (z. B. `this.host.component.color = ...`).
- [x] **Action-Katalog:** Erstellen/Dokumentieren aller fehlenden Actions (z. B. `ACTION_UPDATE_UI_PROPERTY`, `ACTION_REORDER_OBJECT`).
- [x] **Refactoring Inspector:** Der ActionHandler des Inspectors sendet nur noch Store-Actions, ändert nie direkt das DOM/Objekt.
- [x] **Refactoring Editor-Canvas (Drag & Drop):** Verschieben und Skalieren von UI-Objekten sendet Actions.
- [x] **Tests:** Verifizieren der bestehenden E2E-Tests nach der Umstellung. (119/119 Unit + alle E2E grün, v3.20.1)

### Phase 2: Trennung von Editor- und Laufzeit-Datenstrukturen (Domain Model) ✅
**Ziel:** Die Runtime-Objekte (z.B. `TSprite`, `TButton`) wissen nichts von der Arbeitsumgebung Editor. (Behebt dauerhaft Zirkelreferenz-Bugs wie im GameExporter).
- [x] **Slice 2.1 — Inspector-Types extrahiert:** `TPropertyDef`, `InspectorSection`, `IInspectable` nach `src/model/InspectorTypes.ts`.
- [x] **Slice 2.2 — TWindow.align entkoppelt:** Nutzt `_gridCols`/`_gridRows` statt `window.editor`.
- [x] **Slice 2.3 — ComponentData DTO:** Interface in `types.ts`, StageDefinition/GameProject, ProjectRegistry, Editor umgestellt.
- [x] **Slice 2.5 — toDTO() Konvertierung:** `TComponent.toDTO(): ComponentData` extrahiert nur serialisierbare Properties. `toJSON()` delegiert an `toDTO()`.
- [x] **Slice 2.6 — safeReplacer eliminiert:** Alle 4 Nutzungen in `EditorDataManager.ts` entfernt. `saveProject()` nutzt `JSON.stringify(null, 2)`.
- [x] **Slice 2.7 — GameRenderer:** Analyse bestätigt: `StageRenderer` ist bereits DTO-kompatibel (`any[]`-Signatur, keine Objekt-Verunreinigung). `UniversalPlayer` implementiert `StageHost` ohne Editor-Import. Kein separater Renderer nötig.

### Phase 3: Hexagonale Architektur (Ports & Adapters für I/O) ✅
**Ziel:** Die Business-Logik (GameBuilder) ist völlig losgelöst von Browser- oder Backend-APIs (FileSystem Access, LocalStorage, Fetch).
**Hinweis:** Geplante Electron-Migration erfordert Adapter-basierte Architektur. `NativeFileAdapter` (Node.js `fs`) wird primärer Adapter in Electron.
- [x] **Slice 3.1 — Interfaces:** `IStorageAdapter` (`save`, `load`, `list`, `isAvailable`) und `IExportAdapter` in `src/ports/IStorageAdapter.ts`.
- [x] **Slice 3.2 — 3 Adapter:** `ServerStorageAdapter`, `LocalStorageAdapter`, `NativeFileAdapter` (mit Electron IPC-Bridge `window.electronFS`).
- [x] **Slice 3.3 — ProjectPersistenceService:** Adapter-Initialisierung mit automatischer Erkennung. `saveProject()`, `autoSaveToLocalStorage()`, `fetchProjectFromServer()`, `triggerLoad()` delegieren an Adapter.
- [x] **Slice 3.4 — Export:** `GameExporter.downloadFile()` Electron-kompatibel (3-stufiger Fallback: Electron IPC → FileSystem Access → Blob).

### Phase 4: Lückenloses E2E-Test-Netz für JEDEN UseCase ✅
**Ziel:** Keine versteckte Regression ("HTML-Export funktioniert schon wieder nicht") darf unbemerkt gebaut werden.
- [x] **Audit:** Systematischer Abgleich von bestehenden 11 E2E-Tests mit fehlenden UseCases (Play-Mode, Stage-Wechsel).
- [x] **Fehlende Tests implementiert:** `10_PlayModeLifecycle.spec.ts` (Run-Start/Stop/Restart), `11_StageSwitching.spec.ts` (Menü-Navigation, Blueprint-Wechsel, Hin-und-Zurück).
- [x] **Integration:** 124 Tests (119 Unit + 5 Export Integrity + 13 E2E) grün. `npm run test` sichert jeden Commit.
- [x] **DEVELOPER_GUIDELINES Konsistenz:** 5 Widersprüche nach der Transformation bereinigt.

## Spielregeln für die Transformation
- Niemals mehr als ein Refactoring eines Slices/einer Phase gleichzeitig in Angriff nehmen.
- **Jeder Pull-Request/Commit MUSS grün sein (`npm run test`).** Es werden keine "Broken"-Stände committet, um Features umzubauen.
- Wenn ein alter Test nach Umbau rot ist, darf erst an etwas anderem weitergearbeitet werden, wenn er repariert ist (oder die Spezifikation bewusst und dokumentiert verändert wurde).
- Die Entwicklerdokumentation (`DEVELOPER_GUIDELINES.md`) wird fortlaufend mit den neuen architektonischen DOs und DON'Ts (z. B. "Niemals direkte State-Mutation!") aktualisiert.
