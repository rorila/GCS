# Refactor-Plan: Beseitigung der namensbasierten Identitäts-Mehrdeutigkeit (Tasks & Actions)

> Erstellt: 2026-05-31
> Kontext: Audit von `game-builder-v1`. Wiederkehrende Bug-Klasse "Actions/Tasks werden der
> falschen Stage zugeordnet" bei gleichnamigen Tasks in mehreren Stages (z.B. Lektion 5/6/7).

---

## 1. Ausgangslage & Bereits durchgeführte Fixes

### Symptom
Beim Hinzufügen einer Action zu einem Task in Stage "Lektion 7" landete die Action
fälschlich in Stage "Lektion 5", weil derselbe Task-Name in mehreren Stages existiert.

### Bereits behoben (taktische Fixes, stabil)
- `src/services/registry/TaskRegistry.ts` → `getTaskContainer()` priorisiert jetzt die **aktive Stage**.
- `src/editor/services/FlowSyncManager.ts` → `getStageForContext()` priorisiert jetzt die **aktive Stage**.
- `src/editor/services/EditorRunManager.ts` → toter Code (`source === 'FILE_SYSTEM'`) entfernt.

Diese Fixes lösen den konkreten Editor-Workflow. Sie beseitigen aber **nicht** die
strukturelle Ursache (siehe unten).

---

## 2. Strukturelle Ursache (Root Cause)

`GameTask` und `BaseAction` (`src/model/types.ts`) besitzen **keine eindeutige ID**.
Sie werden ausschließlich über `name` identifiziert. Da derselbe Name in mehreren
Stages existieren darf, entsteht Mehrdeutigkeit bei jeder Auflösung.

### Verbreitung der namensbasierten Auflösung (kartiert)

Die Identität über `name` durchzieht **drei Ebenen**:

**A) Referenzformat (Serialisierung)**
- `actionSequence`-Items: `{ type: 'action', name: '...' }`
- `obj.events`: EventName → TaskName (string)
- `thenTask` / `elseTask` / `thenAction` / `elseAction`: Namen
- `flowCharts`: **per Task-Name indiziert** → `Record<taskName, FlowChart>`

**B) Lookup-Logik (verstreut, name-basiert `find(x => x.name === ...)`)**
- `src/services/registry/TaskRegistry.ts`: `getTaskContainer`, `findOriginalTask`,
  `renameTask`, `deleteTask`, `validateTaskName`, `getTasks` (dedup per name)
- `src/services/registry/ActionRegistry.ts`: `findOriginalAction` (hat bereits id-Teil-Support!),
  `renameAction`, `deleteAction`, `getNextSmartActionName`
- `src/services/ProjectStore.ts`: `reduceRenameAction`, `reduceRenameTask`,
  `updateActionReferences`, `updateTaskReferences`
- `src/services/AgentController.ts`: `getTaskByName`, `getActionByName`, `deleteAction`, `addAction`
- `src/editor/services/FlowSyncManager.ts`: `getStageForContext`, `getTaskDefinitionByName`
- `src/editor/FlowEditor.ts`: `getTaskDefinitionByName`
- `src/editor/EditorStageManager.ts`: `getTargetActionCollection`, `getTargetTaskCollection`
- `src/runtime/TaskExecutor.ts`: `resolveAction`, Task-Auflösung per name

**C) Rename/Delete**
- Trifft jeweils nur den **ersten** Namens-Treffer → die eigentlichen Sonderfall-Risiken.

### Schlüssel-Erkenntnis
Die Mehrdeutigkeit entsteht **nur**, weil Lookups *global über alle Stages* laufen.
**Innerhalb einer einzelnen Stage ist der Name bereits eindeutig** (erzwungen durch den
Editor beim Anlegen). Die Lösung ist daher:

1. **Stabile IDs** für Task/Action → robustes Rename/Delete.
2. **Durchgängig stage-kontextbezogene Auflösung** → keine globale Namenssuche, die "rät".

> Wichtig: Eine vollständige Umstellung des **Referenzformats** (Ebene A) auf IDs ist ein
> Big-Bang-Refactor mit hohem Risiko und **nicht nötig**, um den Missstand zu beheben.
> Das Referenzformat bleibt name-basiert; IDs sind interne Identität.

---

## 3. Leitprinzipien

- **Rückwärtskompatibel** — alte Projekte ohne IDs laden weiter (IDs beim Laden nachrüsten).
- **Inkrementell** — jede Phase ist für sich lauffähig und testbar, kein Big Bang.
- **Referenzformat bleibt name-basiert** — minimiert Risiko.
- **Single Source of Truth** für Auflösung (ein zentraler Resolver statt ~8 Kopien der Suchlogik).

---

## 4. Phasenplan

### Phase 0 — Absicherung (Fundament)
- Regressionstests schreiben, die das **heutige** Verhalten festschreiben:
  gleichnamiger Task in 2 Stages → Action wird der aktiven Stage zugeordnet.
- Betroffen: neue Testdatei (Vitest bzw. vorhandener `scripts/test_runner.ts`).
- Risiko: sehr gering. Aufwand: gering.

### Phase 1 — IDs additiv einführen
- `id?: string` zu `GameTask` und `BaseAction` in `src/model/types.ts` ergänzen.
- **Migration beim Laden (Hydration):** jede Task/Action ohne `id` bekommt eine generierte ID.
  (Ort: zentrale Lade-/Hydrationsroutine, z.B. ProjectStore-Load / Migrationsschicht.)
- Task/Action-Erstellung vergibt künftig sofort IDs:
  - `src/services/AgentController.ts` → `addAction`
  - `src/editor/services/FlowTaskManager.ts` → `createNewTaskFlow`
- Noch **keine** Verhaltensänderung — rein additiv.
- Risiko: gering. Aufwand: gering–mittel.

### Phase 4 — Rename/Delete über ID (vorgezogen, behebt Sonderfälle)
> Bewusst nach Phase 1 sinnvoll machbar, ohne Phase 2/3.
- `renameTask` / `deleteTask` (`TaskRegistry.ts`) und `renameAction` / `deleteAction`
  (`ActionRegistry.ts`, `ProjectStore.ts`, `AgentController.ts`) operieren auf `id`
  statt "erster Namens-Treffer".
- Behebt die Restrisiken bei gleichnamigen Tasks (Rename/Delete trifft das richtige Element).
- Risiko: gering. Aufwand: gering.

### Phase 2 — Zentraler `ScopedResolver`
- Ein einziger Service mit Pflicht-Parameter `stageContext`:
  - `resolveTask(name, stageId)`, `resolveAction(name, stageId)`, `getTaskContainer(taskOrId)`.
- Feste Auflösungsreihenfolge: **aktive/kontext-Stage → Blueprint → Legacy-Root**.
- Ersetzt die verstreuten Such-Helfer schrittweise.
- Risiko: gering. Aufwand: mittel.

### Phase 3 — Call-Sites auf Resolver umstellen
- `TaskRegistry`, `ActionRegistry`, `ProjectStore`, `AgentController`, `FlowSyncManager`,
  `FlowEditor`, `TaskExecutor` nutzen nur noch den Resolver.
- Pro Datei eine eigene, klein gehaltene Änderung → einzeln testbar.
- Risiko: mittel. Aufwand: mittel–hoch.

### Phase 5 — Validator & Aufräumen
- Neue `SyncValidator`-Regel (`src/editor/services/SyncValidator.ts`):
  "Innerhalb einer Stage keine doppelten Task-/Action-Namen; IDs projektweit eindeutig."
- Legacy-Fallbacks (`project.actions/tasks` Root) als deprecated kennzeichnen,
  Suchpfade reduzieren.
- Risiko: sehr gering. Aufwand: gering.

---

## 5. Aufwand & Risiko (Übersicht)

| Phase | Inhalt | Aufwand | Risiko | Nutzen |
|-------|--------|---------|--------|--------|
| 0 | Regressionstests | gering | sehr gering | sichert alles ab |
| 1 | IDs additiv + Migration | gering–mittel | gering | Fundament |
| 4 | Rename/Delete über ID | gering | gering | schließt Sonderfälle |
| 2 | Zentraler Resolver | mittel | gering | beseitigt Duplizierung |
| 3 | Call-Sites migrieren | mittel–hoch | mittel | Kern der Konsolidierung |
| 5 | Validator + Cleanup | gering | sehr gering | dauerhafte Absicherung |

---

## 6. Empfehlung

Inkrementell starten mit **Phase 0 → 1 → 4** (geringes Risiko, hoher Sofortnutzen:
stabile IDs + sichere Rename/Delete). Danach entscheiden, ob die Konsolidierung
(Phasen 2–3) den Aufwand wert ist. Phase 5 schließt das Thema dauerhaft ab.

---

## 7. Weitere Audit-Befunde (Kontext, nicht Teil dieses Refactors)

- **SSoT verletzt:** Actions/Tasks/Variablen existieren dreifach parallel
  (`project.*` Root, Blueprint-Stage, je Stage). Erzwingt komplexe Fallback-Logik.
- **God-Objects:** `StageRenderer.ts` (58KB), `GameRuntime.ts` (56KB),
  `StageInteractionManager.ts` (52KB), `EditorDataManager.ts` (46KB),
  `TaskExecutor.ts` (40KB), `FlowContextMenuProvider.ts` (38KB).
- **Typsicherheit:** `ComponentData`/`ProjectVariable` mit `[key: string]: any` bzw.
  ~40 optionalen Event-Feldern in einem Interface (sollte diskriminierte Union sein);
  häufige `(x as any)`-Casts.
- **Fehlendes Tooling:** kein ESLint/Prettier; eigener Test-Runner statt Vitest/Jest.

### Positiv (professionelles Niveau)
- Sauberes diskriminiertes Typsystem für `GameAction`.
- Konsequente Modularisierung (Editor delegiert an spezialisierte Manager).
- `SyncValidator` mit 6 Konsistenzregeln + Auto-Repair.
- Unit-Tests (Runtime) + Playwright-E2E vorhanden.
- Deprecation-Disziplin bei Legacy-Feldern.
