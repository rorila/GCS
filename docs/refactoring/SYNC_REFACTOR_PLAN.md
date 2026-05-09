# Sync Refactor Plan — Inspector ↔ JSON Synchronisation

| | |
|:---|:---|
| **Status** | DRAFT (noch nicht zur Umsetzung freigegeben) |
| **Datum** | 2026-05-09 |
| **Bezug** | `DEVELOPER_GUIDELINES.md` §10 (Sync-Strategie), §13.5–13.6 (Anti-Patterns) |
| **Anlass** | Chronische Sync-Inkonsistenzen zwischen Inspector / Flow-Editor und JSON-SSoT |

---

## §0 Kontext & Anlass

### §0.1 Symptom

Der Inspector und der Flow-Inspector zeigen regelmäßig andere Werte als die JSON-Daten. Änderungen werden nicht zuverlässig persistiert. Bei Reload erscheinen alte oder Default-Werte.

### §0.2 Bug-Historie (Auswahl)

Belegt durch `docs/use_cases/UseCaseIndex.txt`:

| UseCase | Datum | Was wurde gefixt |
|:---|:---|:---|
| `UC-2026-05-09-InspectorSSoTSyncFix` | vor 2 Tagen | `wasMissing`-Block schrieb nur in `obj.data`, nicht in SSoT → `syncToProject` überschrieb SSoT mit veralteten Werten |
| `UC-2026-05-07-StageScopeFix` | vor 4 Tagen | Actions wurden in falscher Stage registriert |
| `UC-2026-05-06-ActionChainFix` | vor 5 Tagen | `FlowAction.type` persistierte Default nicht sofort |
| `UC-2026-04-19-DialogClose-RuntimeReferenzFix` | vor 3 Wochen | `visible=false` auf Spread-Kopie statt Master-Objekt |

→ Es ist kein Einzelbug, sondern eine **strukturelle Schwäche** mit regelmäßigen Manifestationen.

### §0.3 Architekturziel (laut DEVELOPER_GUIDELINES §10)

> *„**Aktueller Zustand**: Bidirektionaler Sync … funktioniert, war aber **fehleranfällig**.  
> **Ziel-Architektur**: Unidirektionaler Datenfluss — Editoren schreiben direkt JSON-Patches, Views rendern nur aus JSON.  
> **Pragmatik**: Solange Sync stabil läuft — nicht anfassen."*

Dieser Plan setzt die Ziel-Architektur in versionierten, einzeln releasbaren Phasen um.

---

## §1 Ist-Zustand: 3 Wahrheiten, 5 Schreibpfade

### §1.1 Drei konkurrierende Storage-Orte für denselben Action-Datensatz

```
┌──────────────────────────────────────────────────────────────┐
│ A) SSoT: project.stages[].actions[]  (ProjectStore)          │
│ B) FlowNode-Cache: node.data         (FlowAction.ts Feld)    │
│ C) UI-Input-Value: <input>.value     (DOM)                   │
└──────────────────────────────────────────────────────────────┘
```

### §1.2 Fünf konkurrierende Schreibpfade

```
┌─ Pfad 1 ─ Inspector-Input.onchange
│          → InspectorEventHandler.handleControlChange()
│          → projectStore.dispatch('SET_PROPERTY')   ──▶ A
│          → (auch) obj.applyChange(prop, val)       ──▶ A + B
│
├─ Pfad 2 ─ FlowAction-Setter (z.B. set target(v))
│          → getActionDefinition()[prop] = v          ──▶ A
│
├─ Pfad 3 ─ FlowAction.applyChange() (v3.24.0 SSoT-First)
│          → actionDef[prop] = v                      ──▶ A
│          → this.data[prop] = v                      ──▶ B
│          → (optional) Setter für Side-Effects       ──▶ A'
│
├─ Pfad 4 ─ InspectorSectionRenderer.wasMissing-Block
│          → obj.data[prop] = default                 ──▶ B
│          → actionDef[prop] = default (seit UC 5-9)  ──▶ A
│          RISIKO: während des Render-Pfades!
│
└─ Pfad 5 ─ FlowSyncManager.syncToProject() (Bulk)
           → Array.map(node => node.toJSON())         ──▶ Elements
           → registrySync.updateGlobalActionDefinition  ──▶ A
           → SyncValidator.validate() + autoRepair    ──▶ A (stumm!)
```

### §1.3 Pfad-Belege (Code-Stellen)

| Pfad | Datei : Zeile |
|:---:|:---|
| 1 | `src/editor/inspector/InspectorEventHandler.ts:29-148` |
| 2 | `src/editor/flow/FlowAction.ts:256-548` (alle Setter) |
| 3 | `src/editor/flow/FlowAction.ts:706-761` |
| 4 | `src/editor/inspector/renderers/InspectorSectionRenderer.ts:189-235` |
| 5 | `src/editor/services/FlowSyncManager.ts:68-204` |

---

## §2 Defekt-Klassen

### §2.1 Identitäts-Drift (kein *Single Writer*-Prinzip)

Fünf Pfade schreiben in überlappende Ziele. Bei jeder neuen Property oder jedem neuen Action-Typ entsteht potenziell ein neuer Pfad. UC-2026-05-09 zeigt das Muster:

```
1. User öffnet Inspector → wasMissing injiziert Default in obj.data (Pfad 4)
2. SSoT bleibt leer
3. User macht *keine* Änderung
4. User speichert → syncToProject bulk-serialisiert node.data ──▶ SSoT überschrieben
5. User öffnet Inspector erneut → zeigt Default, nicht den alten Wert
```

→ **Render mutiert State**, Store ist nicht autoritativ.

### §2.2 Schema-Drift (multiple Feldnamen für dasselbe)

`FlowAction.ts` führt 5 aliased Felder:

| Kanonisches Feld | Alias(e) | Beleg |
|:---|:---|:---|
| `type` | `actionType` | `src/editor/flow/FlowAction.ts:253-254` |
| `changes` | `propertyChanges` | `src/editor/flow/FlowAction.ts:270,275-280` |
| `variableName` | `variable` | `src/editor/flow/FlowAction.ts:322-323` |
| `method` | `methodName` | `src/editor/flow/FlowAction.ts:372-373` |
| `formula` | `expression` | `src/editor/flow/FlowAction.ts:530,544-548` |

Jeder Reader muss alle Fallbacks kennen. Jeder Writer muss entscheiden, welchen Namen er schreibt. Jede UI-Änderung ist *n-dimensional*.

### §2.3 Referenz-vs.-Kopie-Verwechslung

UC-2026-04-19 (`DialogClose-RuntimeReferenzFix`) zeigt es exemplarisch:

> *„Dialog-X-Button setzte `visible=false` auf Spread-Kopie. Master blieb `visible=true`."*

Im Editor durchsucht `getOriginalObject()` (`src/editor/inspector/InspectorEventHandler.ts:150-187`) das Projekt nach `id` oder `name` und findet z.B. FlowActions **gar nicht**, weil diese UUIDs haben, die nicht in `project.actions` existieren — siehe `DEVELOPER_GUIDELINES.md` §13.6.

### §2.4 Render mutiert State (Anti-Pattern)

`src/editor/inspector/renderers/InspectorSectionRenderer.ts:191-202`:

```typescript
if (wasMissing && currentValue !== undefined && currentValue !== '') {
    if (isFlowNode && obj.data) {
        obj.data[propDef.name] = currentValue;
        if (typeof obj.getActionDefinition === 'function') {
            const actionDef = obj.getActionDefinition();
            if (actionDef) actionDef[propDef.name] = currentValue;
        }
    } else {
        PropertyHelper.setPropertyValue(obj, propDef.name, currentValue);
    }
}
```

Der Renderer schreibt während des Zeichnens. In jeder UI-Architektur (React, Vue, Flutter, SwiftUI) verboten. Hier notwendig, weil Defaults nicht beim Action-Create gesetzt werden, sondern erst beim ersten Inspector-Öffnen.

### §2.5 Auto-Repair maskiert Symptome

`src/editor/services/SyncValidator.ts:31`:

```typescript
public static validate(project, context, autoRepair: boolean = true)
```

Standard: `autoRepair=true`. Der Validator repariert stumm R1 (verwaiste Actions), R2 (verwaiste FlowCharts), R6 (Split-Brain). Datenintegrität bleibt gewahrt — aber Root-Causes werden nie sichtbar.

### §2.6 Zwei Inspector-Renderer nebeneinander

`DEVELOPER_GUIDELINES.md` §20:

> *„FlowActions mit `getInspectorSections()` werden durch `InspectorSectionRenderer.renderProperty()` gerendert, NICHT durch `InspectorRenderer.renderActionParams()`. Fixes müssen in `InspectorSectionRenderer.ts` erfolgen."*

Praktisch: Jeder Fix muss in beiden Pfaden gemacht werden, sonst Desync je nach Objekt-Typ.

---

## §3 Lösungs-Säulen (Ziel-Architektur)

### §3.1 Säule 1 — Single Writer: `ProjectStore` ist die einzige autoritative Schreibstelle

- Jede Mutation läuft durch `projectStore.dispatch(intent)`.
- FlowAction-Setter werden zu **Convenience-Wrappern**, die intern dispatchen.
- Der `wasMissing`-Block im Renderer wird entfernt.
- **Invariante:** Zwischen zwei `dispatch`-Aufrufen ist der State unveränderlich.

### §3.2 Säule 2 — Ein Schema, eine Wahrheit

- Alle Aliase werden beim Laden einmalig normalisiert.
- `propertyChanges` → `changes`, `methodName` → `method`, `expression` → `formula`, `variable` → `variableName`, `actionType` → `type`.
- Schema-Version im Projekt-JSON: `{ "schemaVersion": "4.0.0", ... }`.

### §3.3 Säule 3 — FlowNodes sind *Views*, keine Caches

- `FlowAction.data` wird abgeschafft (oder zu read-only Selektor-View).
- Statt `node.data.type` → `store.selectAction(node.actionId).type`.
- Render läuft aus Selektor-Output, nicht aus `this.data`.
- **Konsequenz:** Es kann prinzipiell keinen Desync geben, weil es nur einen Storage-Ort gibt.

### §3.4 Säule 4 — Generisches Property-Dispatching

Statt handgeschriebener Setter (`set target(v)`, `set method(v)`, `set formula(v)`, …) ein **einziger** Reducer:

```
SET_ACTION_PROPERTY { actionId, propertyName, value }
```

Der Reducer validiert gegen ein Schema (z.B. aus `actionRegistry.getMetadata(type).parameters`). Neue Action-Parameter werden ausschließlich durch Schema-Erweiterung hinzugefügt.

### §3.5 Säule 5 — Observer statt Bulk-Sync

- `syncToProject()` in seiner jetzigen Form (Bulk-Serialisierung) verschwindet.
- Jeder einzelne Intent führt zu einem einzelnen State-Update.
- Views subscriben und re-rendern inkrementell.
- `SyncValidator` bleibt — aber **ohne Auto-Repair** in Production. Wird zum Sanity-Assert in Tests.

---

## §4 Universelle Prinzipien (für jede Phase gültig)

| Prinzip | Bedeutung |
|:---|:---|
| **Kein Big-Bang** | Jede Phase ist einzeln releasbar. Stop nach Phase 2 → System trotzdem stabiler als jetzt. |
| **Feature-Flags** | Neue Pfade hinter Flag (`experimental.unidirectionalSync = true`), alter Pfad bleibt parallel bis verifiziert. |
| **Regression-Test-First** | Vor jeder Code-Änderung Test schreiben, der **alten** Zustand grün dokumentiert. |
| **Doku-Trail** | Jede Phase produziert Eintrag in `docs/use_cases/UseCaseIndex.txt` mit `[UC-YYYY-MM-DD-SyncRefactor-PhaseN]`. |
| **GCS_FEATURE_MAP-Pflicht** | `DEVELOPER_GUIDELINES.md` §1: vor massivem Umbau `docs/GCS_FEATURE_MAP.md` prüfen — verpflichtend ab Phase 3. |
| **User-Approval bei Funktionsänderung** | Jede Änderung/Löschung einer existierenden Funktion erfordert explizite Freigabe (User-Regel). |

---

## §5 Phase 0 — Test-Netz

> **Ziel:** E2E- und Unit-Tests, die die Inspector↔JSON-Sync deterministisch absichern, BEVOR refactored wird.

### §5.1 Begründung

`DEVELOPER_GUIDELINES.md` Header: *„Phase 4 (E2E-Test-Netz) steht noch aus."* Ohne dieses Netz ist jeder Refactor-Schritt blind. Auto-Repair versteckt Bugs während manueller Tests.

### §5.2 Test-Layer

| Layer | Was wird abgesichert | Tool |
|:---|:---|:---|
| **A — Unit Reducer** | `projectStore.dispatch({type:'SET_PROPERTY',…})` mutiert exakt eine Stelle | Vitest |
| **B — Unit Validator** | Alle 6 Regeln R1-R6 erkennen die jeweilige Drift | Vitest |
| **C — Integration FlowAction** | Setter→`getActionDefinition` liefern konsistente Werte | Vitest |
| **D — E2E Roundtrip** | UI-Eingabe → JSON-Save → Reload → Inspector zeigt gleichen Wert | Playwright |
| **E — E2E Drift-Detector** | Nach jeder UI-Aktion State dumpen, Hash sensibler Felder vergleichen | Playwright + Snapshot |

### §5.3 Konkrete neue Test-Files

| Datei | Zweck |
|:---|:---|
| `tests/sync/store_set_property.test.ts` | Layer A — alle `SET_PROPERTY`-Pfade |
| `tests/sync/flowaction_aliases.test.ts` | Layer C — jeder Alias schreibt in das richtige kanonische Feld |
| `tests/sync/inspector_writeback.test.ts` | Layer C — `applyChange` und `wasMissing` schreiben in SSoT |
| `tests/sync/sync_validator_strict.test.ts` | Layer B — mit `autoRepair=false` müssen alle 6 Regeln greifen |
| `tests/e2e/30_InspectorJsonRoundtrip.spec.ts` | Layer D — repräsentative Action-Typen (property, calculate, http, navigate, method) |
| `tests/e2e/31_FlowEditorJsonRoundtrip.spec.ts` | Layer D — Drag-Connect-Rename-Save-Reload |

### §5.4 Test-Checkpoints

```
✓ Alle 6 SyncValidator-Regeln haben mind. 1 Negativ- und 1 Positiv-Test
✓ Jedes Alias-Paar (changes/propertyChanges, type/actionType, …) hat einen Roundtrip-Test
✓ E2E: Save → Reload → Werte gleich für mind. 5 Action-Typen
✓ Auto-Repair-Mode kann pro Test deaktiviert werden (neue Test-Util)
```

### §5.5 Aufwand & Risiko

- **Aufwand:** 3–5 Tage (12–18 Tests + Infrastruktur).
- **Risiko:** niedrig. Nur additiv. Bestehender Code bleibt unangetastet.

### §5.6 Funktions-Approvals

Keine. Phase 0 fügt nur neue Tests hinzu.

---

## §6 Phase 1 — Schema-Normalisierung

> **Ziel:** Alle Aliase werden bei Projekt-Load einmalig auf kanonische Feldnamen migriert.

### §6.1 Betroffene Aliase (vollständig)

| Kanonisch | Aliase (zu entfernen aus JSON) | Beleg |
|:---|:---|:---|
| `type` | `actionType` | `src/editor/flow/FlowAction.ts:253-254` |
| `changes` | `propertyChanges` | `src/editor/flow/FlowAction.ts:270-280` |
| `variableName` | `variable` | `src/editor/flow/FlowAction.ts:322-323` |
| `method` | `methodName` | `src/editor/flow/FlowAction.ts:372-373` |
| `formula` | `expression` | `src/editor/flow/FlowAction.ts:530-548` |

### §6.2 Schritte

1. **Schema-Version** in `GameProject` (`src/model/types.ts`): Property `schemaVersion: '4.0.0'`.
2. **Migrations-Modul** neu anlegen: `src/services/SchemaMigrator.ts` mit `migrateToV4(project): GameProject`. Iteriert über alle Stages × Actions, normalisiert Aliase.
3. **Hook in den Lade-Pfad** an einer einzigen Stelle (`ProjectPersistenceService`, Adapter-basiert): nach Laden, vor `setProject`.
4. **Schreib-Schutz**: Beim Save assertion: keine Alias-Felder mehr im JSON. Wirft Error im Dev-Mode.
5. **FlowAction-Aliase** bleiben vorerst als Deprecated-Getter mit `console.warn`. Erst in Phase 3 entfernen.

### §6.3 Funktions-Approvals nötig

Folgende Funktionen werden in Phase 1 **nicht gelöscht**, aber als deprecated markiert:

- `FlowAction.actionType` (getter/setter)
- `FlowAction.variable` (getter/setter)
- `FlowAction.expression` (getter/setter)
- `propertyChanges` / `methodName` Fallback-Branches in den anderen Gettern

→ **Approval-Frage:** Deprecation-Warnings einbauen oder zu invasiv für Phase 1?

### §6.4 Test-Checkpoints

```
✓ Test-Project mit allen Aliasen → Migration → keine Aliase mehr im JSON
✓ Test-Project mit gemischten Feldern → Migration → kanonische Variante gewinnt
✓ schemaVersion wird inkrementiert
✓ Save → Re-Load → Migration ist idempotent (zweite Migration ändert nichts)
```

### §6.5 Aufwand & Risiko

- **Aufwand:** 2–3 Tage.
- **Risiko:** niedrig–mittel. Bestehende Projekte (z.B. `projects/Tutor_Project.json`) bekommen neue Schema-Version. Migration ist nicht reversibel ohne Backup → vor erster Migration `*.bak`-Datei erzeugen.

---

## §7 Phase 2 — `wasMissing`-Writer entfernen

> **Ziel:** Render mutiert nicht mehr State. Default-Werte werden beim Action-Erzeugen einmalig persistiert.

### §7.1 Betroffene Stellen

| Datei | Zeile | Was passiert dort heute |
|:---|:---:|:---|
| `src/editor/inspector/renderers/InspectorSectionRenderer.ts` | 189–202 | Schreibt Default in `obj.data` UND `actionDef[prop]` |
| `src/editor/inspector/renderers/InspectorSectionRenderer.ts` | 217–235 | Gleicher Block für Select-Dropdowns |
| `src/editor/inspector/renderers/InspectorSectionRenderer.ts` | 275–278 | Gleicher Block für Number-Inputs |

### §7.2 Schritte

1. **Default-Initialisierung beim Action-Create** verlagern: In `AgentController.addAction`, `EditorCommandManager.addAction`, `FlowEditor.createNode('action')` werden alle Defaults aus `actionRegistry.getMetadata(type).parameters` einmalig in die JSON-Definition geschrieben.
2. **Schema-getriebene Defaults**: Audit der `actionRegistry`-Metadaten — jeder Parameter braucht `defaultValue`.
3. **`wasMissing`-Block entfernen**: alle drei Stellen oben durch reines Lesen ersetzen.
4. **Render bleibt read-only**: Wenn Wert wirklich fehlt → Eingabefeld zeigt leer / placeholder.

### §7.3 Funktions-Approvals nötig

Folgender Block (3× im Code) wird **gelöscht**:

```
src/editor/inspector/renderers/InspectorSectionRenderer.ts:191-202
        if (wasMissing && currentValue !== undefined && currentValue !== '') {
            if (isFlowNode && obj.data) {
                obj.data[propDef.name] = currentValue;
                if (typeof obj.getActionDefinition === 'function') {
                    const actionDef = obj.getActionDefinition();
                    if (actionDef) actionDef[propDef.name] = currentValue;
                }
            } else {
                PropertyHelper.setPropertyValue(obj, propDef.name, currentValue);
            }
        }
```

→ **Approval-Frage:** Diese drei Blöcke entfernen, sobald Default-Init beim Create funktioniert?

### §7.4 Test-Checkpoints

```
✓ Action-Erzeugen → JSON enthält alle Defaults sofort
✓ Inspector öffnen → liest nur, schreibt nicht (Spy auf actionDef[prop] = …)
✓ Bestehende Actions ohne Defaults → werden bei Phase-1-Migration aufgefüllt
✓ Phase-0 Roundtrip-Tests laufen weiter grün
```

### §7.5 Aufwand & Risiko

- **Aufwand:** 1 Tag (wenn Phase 0 Tests stehen) — sonst riskant.
- **Risiko:** mittel. Wenn ein Action-Typ in `actionRegistry` keinen `defaultValue` hat, fehlen Werte. Audit der Registry vor dem Entfernen Pflicht.

---

## §8 Phase 3 — `applyChange` als einziger Writer

> **Ziel:** Die fünf Schreibpfade aus §1 kollabieren auf einen. `FlowAction`-Setter werden zu Convenience-Wrappern.

### §8.1 Konsolidierung

**Heute:**
```
Pfad 1 — InspectorEventHandler.handleControlChange + projectStore.dispatch + applyChange
Pfad 2 — FlowAction Setter (set target(v) → actionDef.target = v)
Pfad 3 — FlowAction.applyChange direkt
Pfad 4 — InspectorSectionRenderer wasMissing  ← entfernt in Phase 2
Pfad 5 — FlowSyncManager.syncToProject Bulk
```

**Zukünftig:**
```
Alle Schreibvorgänge → projectStore.dispatch({type:'SET_ACTION_PROPERTY', actionId, prop, value})
                       ↓
                       Reducer mutiert SSoT
                       ↓
                       MediatorEvent DATA_CHANGED → Views re-rendern
```

### §8.2 Schritte

1. **Setter umschreiben**: `set target(v)` ruft intern `projectStore.dispatch(…)`. Kein direkter Write auf `actionDef`.
2. **`applyChange` umschreiben**: Dispatcht statt direkt zu mutieren.
3. **`InspectorEventHandler.handleControlChange`** vereinfachen: Heute Doppel-Dispatch (`projectStore.dispatch` + `obj.applyChange`). Neu: nur dispatch.
4. **`FlowSyncManager.syncToProject`** vereinfachen:
   - Bulk-Write `node.toJSON()` → SSoT entfällt.
   - Verbleibend: Layout-Persistenz (`task.flowLayout`) und Action-Sequence-Generierung (Topologie).
   - Property-Updates passieren bereits laufend via Phase-3-Setter.
5. **`SyncValidator`-Auto-Repair** im Production-Mode deaktivieren. Bleibt nur als Sanity-Assert in Tests.

### §8.3 Funktions-Approvals nötig

| Funktion | Heute | Phase 3 |
|:---|:---|:---|
| `FlowAction` 8 Setter (target, type, changes, value, formula, …) | Direkter Write auf `actionDef` | Dispatch via Store |
| `FlowAction.applyChange()` | Direkter Write + lokale data-Spiegel | Dispatch via Store |
| `FlowSyncManager.syncToProject()` | Bulk-Write aller Properties | Nur noch Topologie + Layout |
| `SyncValidator.validate(autoRepair=true)` | Standard `true` | Standard `false` (Production), `true` nur in Tests |

→ **Approval-Fragen:**
1. Setter umbauen? (Funktion bleibt, Implementierung ändert sich)
2. `syncToProject()` schlanker machen? (Topologie-Sync bleibt, Property-Sync entfällt)
3. Auto-Repair Default auf `false` setzen?

### §8.4 Test-Checkpoints

```
✓ Phase-0 Tests laufen alle weiter grün
✓ Inspector-Änderung → genau 1 Store-Dispatch (Spy)
✓ syncToProject() schreibt nur noch Layout + actionSequence
✓ SyncValidator mit autoRepair=false → keine Verletzungen nach beliebiger UI-Aktion
✓ Performance-Smoke: Inspector-Render < 50ms (nicht langsamer als jetzt)
```

### §8.5 Aufwand & Risiko

- **Aufwand:** 3–5 Tage.
- **Risiko:** mittel–hoch. Setter sind weit verstreut genutzt. Edge-Cases mit `setTimeout`/Promise prüfen — synchroner Reducer-Write garantiert dann Konsistenz.

---

## §9 Phase 4 — Store-Selektoren statt `node.data`-Cache

> **Ziel:** Flow-Nodes halten keinen Daten-Cache mehr. Sie referenzieren Actions per ID und lesen live aus dem Store. Identity-Drift wird unmöglich.

### §9.1 Architektur-Wandel

**Heute:**
```typescript
class FlowAction extends FlowElement {
    public data: any = { ... };  // ← lokaler Cache
    public get target() { return this.getActionDefinition()?.target; }
}
```

**Zukünftig:**
```typescript
class FlowAction extends FlowElement {
    public actionId: string;  // ← nur Referenz
    // Kein this.data mehr
    public get target() { return store.selectAction(this.actionId)?.target; }
}
```

### §9.2 Schritte

1. **Selektoren bauen**: `src/services/selectors/actionSelectors.ts` mit `selectActionById(state, id)`, `selectActionsByStage(…)`, etc.
2. **`node.data` durch Selektor-Aufrufe ersetzen**: schrittweise, Property für Property.
3. **`toJSON()` umschreiben**: liest aus Selektor, nicht aus `data`.
4. **`hydrateNode`** (in `FlowGraphHydrator`) liest weiterhin aus JSON, schreibt aber nur die `actionId` auf den Node.
5. **`isLinked`-Flag** (`src/editor/flow/FlowAction.ts:208-214`) wird obsolet.
6. **Migration für „unlinked" Actions** (existieren auf Canvas, nicht in `project.actions`): in Phase 1 oder Phase 4 in `project.actions` materialisieren.

### §9.3 Funktions-Approvals nötig (einschneidend!)

| Element | Wird … |
|:---|:---|
| `FlowAction.data` Property | **Gelöscht** (oder zu read-only Selektor-View) |
| `FlowAction.getActionDefinition()` | Vereinfacht zu reinem `selectActionById(this.actionId)` |
| `node.data.isLinked` Flag | **Gelöscht** (nicht mehr nötig) |
| `FlowSyncManager.syncActionsFromProject()` | **Gelöscht** (kein Cache mehr → kein Sync nötig) |
| `FlowSyncManager.syncToProject` Action-Branch | **Gelöscht** (Properties leben bereits im Store) |

→ **Approval-Frage:** Vor der Phase eine konkrete Mapping-Tabelle erstellen — *welche externen Aufrufer* nutzen heute `node.data.X`? Per `code_search` ermittelt → echte Risiko-Übersicht **bevor** wir entscheiden.

### §9.4 Test-Checkpoints

```
✓ Phase-0 bis Phase-3 Tests laufen alle weiter grün
✓ Heap-Profiler: 50% weniger Action-Daten-Duplikate im RAM
✓ E2E: 100 Actions × 10 Properties × Save/Reload → kein Drift möglich
✓ Performance: Selektor-Aufruf < 0.1ms (Memoization wenn nötig)
✓ Stress-Test: Stage-Wechsel mit 1000 Actions → keine Duplikate
```

### §9.5 Aufwand & Risiko

- **Aufwand:** 2 Wochen. Größter Brocken im Plan.
- **Risiko:** hoch. Externe Aufrufer von `node.data.X` müssen alle gefunden werden. Phase 0 Tests sind hier kritisch.

---

## §10 Phase 5 — Generisches `SET_ACTION_PROPERTY`

> **Ziel:** Neue Action-Parameter werden ausschließlich durch Schema-Erweiterung hinzugefügt — keine neuen Setter, keine neuen `applyChange`-Sonderfälle.

### §10.1 Konkrete Wirkung

**Heute:** Jeder neue Parameter braucht
1. Eintrag in `actionRegistry`
2. Getter in `FlowAction.ts`
3. Setter in `FlowAction.ts`
4. Eventuell Sonderfall in `applyChange()`
5. Eventuell Sonderfall in `mapParameterTypeToInspector()`
6. Eventuell Sonderfall in `InspectorSectionRenderer`
7. Eventuell Test-Anpassung an mehreren Stellen

**Zukünftig:** nur **1.** ändert sich.

### §10.2 Schritte

1. **Reducer `setActionProperty(state, {actionId, propName, value})`** baut auf Phase 4 auf. Validiert gegen Schema.
2. **Schema-Erweiterung** in `actionRegistry.getMetadata(type).parameters[]`: jeder Parameter bekommt
   - `name`
   - `type` (string|number|boolean|select|json|variable|…)
   - `defaultValue`
   - `validate?: (value, context) => string | null`
   - `required?: boolean`
3. **Getter in FlowAction.ts** auf eine generische Form reduzieren: alle delegieren an `selectActionProperty(this.actionId, propName)`.
4. **Inspector-Rendering** wird vollständig schemagetrieben — keine Action-Typ-Sonderfälle mehr.

### §10.3 Funktions-Approvals nötig

| Element | Heute | Phase 5 |
|:---|:---|:---|
| `FlowAction.ts` ~30 Getter/Setter | Handgeschrieben | **Generisch** (1 Getter, 1 Setter via Proxy oder Generic-Method) |
| Sonderfälle in `applyChange()` | Mehrere if-Branches | **Entfernt** |
| `mapParameterTypeToInspector()` | Hardcoded Mapping | **Schemagetrieben** |

→ **Approval-Frage:** Phase 5 ist die „Belohnung" für Phase 1–4. Verbindlich einplanen oder als optional markieren und nach Phase 4 neu bewerten?

### §10.4 Test-Checkpoints

```
✓ Phase-0 bis Phase-4 Tests laufen alle weiter grün
✓ NEU: Test-Action-Typ "test_dummy" mit 5 Parametern hinzufügen
       → keine Code-Änderungen nötig außer im actionRegistry
✓ Inspector zeigt korrekte Eingabefelder ohne Spezialfall
✓ FlowAction.ts hat < 200 Zeilen (heute: ~1041)
```

### §10.5 Aufwand & Risiko

- **Aufwand:** 5–7 Tage (wenn Phase 4 sauber steht).
- **Risiko:** niedrig. Nach Phase 4 ist die Architektur „richtig", Phase 5 ist nur Aufräumen.

---

## §11 Übersicht & Empfehlung

### §11.1 Zeitplan

```
Phase 0 — Test-Netz             ████░░░░░░  3–5 Tage   Risiko: niedrig
Phase 1 — Schema-Normalisierung ███░░░░░░░  2–3 Tage   Risiko: niedrig–mittel
Phase 2 — wasMissing entfernen  █░░░░░░░░░  1 Tag      Risiko: mittel
Phase 3 — applyChange-only      █████░░░░░  3–5 Tage   Risiko: mittel–hoch
Phase 4 — Store-Selektoren      ██████████  10–14 Tage Risiko: hoch
Phase 5 — Generisch             ███████░░░  5–7 Tage   Risiko: niedrig
─────────────────────────────────────────────────────
Gesamt                          ~5–7 Wochen
```

### §11.2 Empfohlener Stop-Punkt

**Nach Phase 2** sollten geschätzt ~70% der heutigen Sync-Bugs verschwinden:

- Schema-Aliase sind weg → Pfad-Verzweigungen weniger.
- `wasMissing`-Writer ist weg → Render mutiert nicht mehr.
- Test-Netz dokumentiert alle Sync-Pfade.

Phase 3 ist die nächste signifikante Verbesserung. Phase 4–5 sind die strategische Vollendung.

### §11.3 Erwarteter Effekt

| Metrik | Heute | Nach Phase 2 | Nach Phase 4 |
|:---|:---:|:---:|:---:|
| Sync-bezogene Bugs/Monat (Schätzung) | 4–8 | 1–3 | 0–1 |
| Code-Komplexität `FlowAction.ts` | 1041 LOC | ~900 LOC | ~600 LOC |
| Schreibpfade pro Property | 5 | 4 | 1 |
| Schema-Aliase | 5 | 0 | 0 |
| Auto-Repair-Aktivierungen/Sitzung | unbekannt (versteckt) | erkennbar | nahe 0 |

---

## §12 Funktionen, die User-Approval benötigen

Aggregierte Liste aus allen Phasen — vor Implementierung sind explizite Freigaben nötig (User-Regel):

| Phase | Funktion / Element | Aktion |
|:---|:---|:---|
| 1 | `FlowAction.actionType` getter/setter | Deprecation-Warning |
| 1 | `FlowAction.variable` getter/setter | Deprecation-Warning |
| 1 | `FlowAction.expression` getter/setter | Deprecation-Warning |
| 2 | `InspectorSectionRenderer.renderProperty` `wasMissing`-Block (3×) | **Löschen** |
| 3 | `FlowAction` 8 Setter (target, type, changes, …) | Implementierung umschreiben |
| 3 | `FlowAction.applyChange()` | Implementierung umschreiben |
| 3 | `FlowSyncManager.syncToProject()` Action-Branch | Vereinfachen |
| 3 | `SyncValidator.validate()` Default-Argument | `autoRepair=false` als Default |
| 4 | `FlowAction.data` Property | **Löschen** (oder read-only) |
| 4 | `FlowAction.getActionDefinition()` | Vereinfachen |
| 4 | `node.data.isLinked` Flag | **Löschen** |
| 4 | `FlowSyncManager.syncActionsFromProject()` | **Löschen** |
| 5 | `FlowAction.ts` ~30 Getter/Setter | Durch generische Form ersetzen |
| 5 | `applyChange` Sonderfälle | **Löschen** |

---

## §13 Anhang: Quellen

### §13.1 Code-Stellen (Stand 2026-05-09)

| Datei | Wofür relevant |
|:---|:---|
| `src/editor/flow/FlowAction.ts` | Die 30 Getter/Setter, `applyChange`, `getActionDefinition` |
| `src/editor/services/FlowSyncManager.ts` | `syncToProject` Bulk-Writer |
| `src/editor/services/SyncValidator.ts` | 6 Konsistenzregeln R1-R6, Auto-Repair |
| `src/editor/inspector/InspectorEventHandler.ts` | `handleControlChange` UI-Eintrittspunkt |
| `src/editor/inspector/renderers/InspectorSectionRenderer.ts` | `wasMissing`-Block, Render-Pfad für IInspectable |
| `src/services/ProjectStore.ts` | SSoT-Reducer |
| `src/services/MediatorService.ts` | `notifyDataChanged`-Broadcasts |
| `src/runtime/PropertyHelper.ts` | `getPropertyValue` / `setPropertyValue` Default-Pfad |

### §13.2 Dokumentation

| Datei | Bezug |
|:---|:---|
| `DEVELOPER_GUIDELINES.md` §3 | State & Datenfluss, SSoT-Prinzip |
| `DEVELOPER_GUIDELINES.md` §4 | Inspector-Patterns, IInspectable, SyncValidator |
| `DEVELOPER_GUIDELINES.md` §10 | Sync-Strategie, Ziel: unidirektional |
| `DEVELOPER_GUIDELINES.md` §13.5 | Flow-Editor & Sync Anti-Patterns |
| `DEVELOPER_GUIDELINES.md` §13.6 | Inspector Anti-Patterns |
| `DEVELOPER_GUIDELINES.md` §20 | FlowNode Property-Shadowing |
| `docs/CleanCodeTransformation.md` | Phasen 1–3 abgeschlossen, Phase 4 (E2E) ausstehend |
| `docs/use_cases/UseCaseIndex.txt` | Bug-Historie zur Validierung des Plans |

### §13.3 Verwandte Architektur-Konzepte

- **Redux/Flux**: Unidirektionaler Datenfluss, Single Store, Reducer als einziger Mutator.
- **NgRx Selectors**: Memoizierte Selektoren statt lokaler Caches.
- **Event Sourcing (light)**: Intents als unveränderliche Events, State als Projektion.
- **CQRS**: Lese- und Schreibpfade architektonisch trennen.

---

## §14 Status-Tracking

| Phase | Status | Datum | Bemerkung |
|:---:|:---|:---:|:---|
| 0 | ✅ done | 2026-05-09 | Test-Netz (28 Tests in 4 Suiten) |
| 1 | ✅ done | 2026-05-09 | Schema-Normalisierung (SchemaMigrator v4.0.0, 8 Tests) |
| 2 | ✅ done | 2026-05-09 | wasMissing entfernt, applyRegistryDefaults (4 Tests) |
| 3 | ✅ done | 2026-05-09 | `applyChange`-only (Setter-Wrapper, Doppel-Dispatch eliminiert, Bulk-Sync entfernt) |
| 4 | ⏳ pending | — | Store-Selektoren |
| 5 | ⏳ pending | — | Generisches Dispatching |

Bei Implementierungs-Beginn: Status auf `🚧 in progress`, bei Abschluss auf `✅ done` setzen, plus Eintrag in `docs/use_cases/UseCaseIndex.txt` mit Tag `[UC-YYYY-MM-DD-SyncRefactor-PhaseN]`.

---

*Letzte Aktualisierung: 2026-05-09 — Initiale Erstellung als Diskussionsgrundlage. Noch keine Phase begonnen.*
