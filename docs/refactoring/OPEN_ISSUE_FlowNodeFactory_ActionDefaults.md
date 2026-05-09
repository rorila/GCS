# Open Issue — `FlowNodeFactory.createNode('action')` ohne Default-Init

| | |
|:---|:---|
| **Status** | 🟢 Closed |
| **Schweregrad** | Mittel — funktional spürbar, aber nur in einem von zwei Add-Pfaden |
| **Datum** | 2026-05-09 |
| **Bezug** | `SYNC_REFACTOR_PLAN.md` §7.2 Schritt 1, `SYNC_REFACTOR_REVIEW_PHASE1-3.md` §2.1-D |
| **Phase** | 2 (Default-Init beim Action-Create) |

---

## §1 Problem

Beim Erstellen einer Action **per Drag-Drop** im Flow-Editor (Palette → Canvas) werden die in der `ActionRegistry` definierten Default-Werte **nicht** in die Action-Definition geschrieben.

Folge: Der Inspector öffnet die neue Action mit leeren Feldern (Renderer ist seit Phase 2 read-only und schreibt **keine** Defaults mehr in die SSoT).

## §2 Reproduktion

1. Editor offen, Projekt geladen.
2. Flow-Editor → Action aus der Palette per Drag-Drop auf den Canvas ziehen, z.B. Typ `animate`.
3. Inspector öffnet sich → Felder `effect`, `duration`, `targetScale` sind **leer** statt mit Defaults gefüllt.
4. User speichert ohne Eingabe → undefined Felder → Runtime-Fehler bei Action-Ausführung.

## §3 Wurzelursache

`FlowNodeFactory.createNode()` für `case 'action'` ruft **keinen** Default-Initialisierer auf:

```@C:/Users/rolfr/.gemini/antigravity/scratch/game-builder-v1/src/editor/services/FlowNodeFactory.ts:52-68
            case 'action': {
                const actionSubtype = type.includes(':') ? type.split(':')[1] : null;
                node = new FlowAction(id, x, y, this.host.canvas, cellSize);
                if (initialName && initialName !== 'Action' && initialName !== 'Aktion') {
                    node.Name = initialName;
                } else {
                    node.Name = FlowNamingService.generateUniqueActionName(this.host.project, this.host.nodes, initialName || 'Action');
                }
                if (actionSubtype) {
                    node.data = node.data || {};
                    node.data.type = actionSubtype;
                }
                if (this.host.project) {
                    (node as FlowAction).setProjectRef(this.host.project);
                }
                break;
            }
```

Im Vergleich dazu wurde der **andere** Add-Pfad (`AgentController.addAction`) bereits korrekt umgestellt:

```@C:/Users/rolfr/.gemini/antigravity/scratch/game-builder-v1/src/services/AgentController.ts:537-545
        } else {
            actionDef = {
                name: actionName,
                type: actionType,
                ...params
            } as any;

            SchemaMigrator.initializeActionDefaults(actionDef, (type) => projectActionRegistry.getActionParams(type));
```

## §4 Auswirkung

- **Drag-Drop-Pfad:** Action erscheint mit `undefined`-Feldern.
- **API-Pfad (`AgentController.addAction`):** OK, Defaults werden gefüllt.
- **Typ-Wechsel im Inspector:** OK, `FlowAction.applyChange` ruft `initializeActionDefaults` (FlowAction.ts:651).

Drag-Drop ist im UI vermutlich der **häufigere** Pfad zum Erstellen von Actions, daher praktisch relevant.

## §5 Fix-Vorschlag

**Eine Code-Änderung in `FlowNodeFactory.ts`** (analog zur Lösung in `AgentController.ts:544`):

### §5.1 Imports ergänzen (Datei-Anfang)

```typescript
import { SchemaMigrator } from '../../services/SchemaMigrator';
import { projectActionRegistry } from '../../services/registry/ActionRegistry';
```

(Nur falls noch nicht importiert — Pfad relativ zu `src/editor/services/FlowNodeFactory.ts` ist `../../services/...`. Vor Implementation prüfen.)

### §5.2 Defaults-Initialisierung in `case 'action'` einfügen

**Vor der Änderung:**

```typescript
if (actionSubtype) {
    node.data = node.data || {};
    node.data.type = actionSubtype;
}
```

**Nach der Änderung:**

```typescript
if (actionSubtype) {
    node.data = node.data || {};
    node.data.type = actionSubtype;
    // Phase 3 SYNC_REFACTOR §2.1-D: Defaults für UI-erstellte Actions
    // (Spiegel zu AgentController.addAction Z.544)
    SchemaMigrator.initializeActionDefaults(
        node.data,
        (t) => projectActionRegistry.getActionParams(t)
    );
}
```

**Aufwand:** ~2 Minuten.  
**Risiko:** niedrig (additiv, keine Änderung bestehender Aufrufer).  
**Test:** `tests/sync/inspector_writeback.test.ts` ggf. um Drag-Drop-Szenario erweitern.

## §6 Edge-Cases

| Fall | Verhalten nach Fix |
|:---|:---|
| Action ohne Subtyp (`type === 'action'`, ohne `:subtype`) | Kein Aufruf → wie vorher (Subtyp wird später via Inspector gesetzt → dort greift `applyChange`-Defaults) |
| Action mit Subtyp (`type === 'action:animate'`) | ✅ Defaults gefüllt |
| Drag-Drop einer schon vorhandenen Action (Re-Add) | ✅ `initializeActionDefaults` ist idempotent — füllt nur fehlende Felder |
| `data_action` (separater Case Z.69-96) | ⚠️ **siehe §7** |

## §7 Verwandter Punkt — `data_action` (separater Code-Pfad)

Im `case 'dataaction'` Z.69-96 werden Defaults **manuell hardcoded** gesetzt (`type: 'data_action'`, `dataStore: ''`, `method: 'GET'`, …):

```@C:/Users/rolfr/.gemini/antigravity/scratch/game-builder-v1/src/editor/services/FlowNodeFactory.ts:78-91
                node.data = {
                    ...node.data,
                    type: 'data_action',
                    details: '(data_action)',
                    showDetails: false,
                    dataStore: '',
                    queryProperty: '',
                    queryValue: '',
                    url: '',
                    method: 'GET',
                    requestJWT: false,
                    resultVariable: '',
                    selectFields: '*'
                };
```

Das umgeht die `ActionRegistry` und ist eine **zweite Quelle der Wahrheit** für Defaults. Bei Drift zwischen Hardcoded-Liste und Registry entstehen Inkonsistenzen.

**Empfehlung (separates Issue):** Hardcoded-Defaults durch `SchemaMigrator.initializeActionDefaults` ersetzen, falls die `ActionRegistry` `data_action` registriert hat. Falls nicht: erst Registry vervollständigen.

❓ Soll für `data_action` ein eigenes Open-Issue-Dokument erstellt werden?

## §8 Verifikation nach Fix

1. **Manuell:** Drag-Drop einer `animate`-Action → Inspector öffnen → Felder `effect`/`duration`/`targetScale` zeigen Default-Werte (z.B. `'fade'`, `300`, `1.0`).
2. **Automatisiert:** `tests/sync/inspector_writeback.test.ts` um Test ergänzen:
   - Mock `FlowNodeFactory.createNode('action:animate', 0, 0)`
   - Erwartet: `node.data.effect !== undefined`
3. **Cross-Path-Konsistenz:** Vergleich `AgentController.addAction('Test','animate',{})` vs. `FlowNodeFactory.createNode('action:animate', …)` → resultierende `actionDef` muss identische Default-Felder haben.

## §9 Approvals nötig

| # | Element | Aktion | Aufwand |
|:---:|:---|:---|:---|
| 5.1 | `FlowNodeFactory.ts` Datei-Anfang | Imports `SchemaMigrator` + `projectActionRegistry` ergänzen (falls fehlend) | 1 Min |
| 5.2 | `FlowNodeFactory.ts:62` Block | `SchemaMigrator.initializeActionDefaults`-Aufruf einfügen | 1 Min |
| 8 | `tests/sync/inspector_writeback.test.ts` | Drag-Drop-Test ergänzen | 15 Min |

❓ **Approval-Frage:** Soll Cascade die unter §5 vorgeschlagene Änderung umsetzen?

## §10 Tracking

| Datum | Aktion |
|:---|:---|
| 2026-05-09 | Issue eröffnet nach Re-Review der Phase-1–3-Implementation |
| 2026-05-09 | §5 Implementation (FlowNodeFactory.ts Imports + Default Init) |
| 2026-05-09 | §8 Test-Erweiterung (inspector_writeback.test.ts Test 9 ergänzt) |
| TBD | §7 `data_action`-Konsolidierung (separates Issue) |

---

## §11 Querverweise

- `docs/refactoring/SYNC_REFACTOR_PLAN.md` §7 (Phase 2 — Default-Init)
- `docs/refactoring/SYNC_REFACTOR_REVIEW_PHASE1-3.md` §2.1 (Restpunkt-Liste)
- `src/services/SchemaMigrator.ts:217-230` (Helper-Funktion)
- `src/services/AgentController.ts:544` (Spiegel-Aufruf, korrekt umgesetzt)
- `src/editor/flow/FlowAction.ts:651` (Spiegel-Aufruf bei Typ-Wechsel, korrekt umgesetzt)

---

*Dieses Dokument bleibt offen, bis §5 implementiert und §8 verifiziert ist. Nach Schließung sollte ein Eintrag in `SYNC_REFACTOR_REVIEW_PHASE1-3.md` §6 ergänzt werden.*
