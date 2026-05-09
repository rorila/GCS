# Sync Refactor — Review Phasen 1–3

| | |
|:---|:---|
| **Status** | Phasen 1–3 mit Abweichungen abgeschlossen |
| **Datum** | 2026-05-09 |
| **Bezug** | `SYNC_REFACTOR_PLAN.md` §6–§8 |
| **Anlass** | Code-Review nach User-Implementation der ersten drei Phasen |

---

## §1 Status-Tabelle (vollständig)

| # | Plan-Item | Status | Beleg / Notiz |
|:---:|:---|:---:|:---|
| **Phase 1 — Schema-Normalisierung** | | | |
| 1.1 | `SchemaMigrator.ts` existiert | ✅ | `src/services/SchemaMigrator.ts:1-211` |
| 1.2 | Alle 5 Aliase migriert (`actionType`, `propertyChanges`, `variable`, `methodName`, `expression`) | ✅ | `SchemaMigrator.normalizeAction()` Z. 127-145 |
| 1.3 | Auch `flowCharts.elements[].data` wird migriert | ✅ | Z. 78-105 |
| 1.4 | Hook in Lade-Pfad | ✅ | `src/editor/services/EditorDataManager.ts:511-522` |
| 1.5 | Idempotenz | ✅ | `schemaVersion === '4.0.0'`-Check, Z. 53-57 |
| 1.6 | `schemaVersion?: string` in `GameProject` Interface | ❌ | Fehlt in `src/model/types.ts:452-484` |
| 1.7 | Schreib-Schutz beim Save (Assertion gegen Aliase) | ❌ | Nicht implementiert |
| 1.8 | Deprecation-Warnings auf FlowAction-Aliasen | ⚠️ | Bewusst weggelassen (war Approval-Frage in Plan §6.3) |
| 1.9 | Tests: `tests/sync/schema_migrator.test.ts` (12 Tests) | ✅ | Inkl. Idempotenz, Mixed-Felder, Stage-Actions, FlowChart-Nodes |
| **Phase 2 — `wasMissing` entfernen** | | | |
| 2.1 | Block 1 (string-Pfad) entfernt | ✅ | `InspectorSectionRenderer.ts:201-203` (Marker-Kommentar) |
| 2.2 | Block 2 (select-Pfad) entfernt | ✅ | `InspectorSectionRenderer.ts:227-228` |
| 2.3 | Block 3 (number-Pfad) entfernt | ✅ | `InspectorSectionRenderer.ts:276-277` |
| 2.4 | Default-Init beim **Laden** | ✅ | `applyRegistryDefaults()` in `EditorDataManager.loadProject` |
| 2.5 | Default-Init beim **Action-Create** | ❌ | **Funktionale Lücke** — Plan §7.2 Schritt 1 |
| **Phase 3 — `applyChange` als einziger Writer** | | | |
| 3.1 | ~25 FlowAction-Setter delegieren an `applyChange` | ✅ | `src/editor/flow/FlowAction.ts:233-441` |
| 3.2 | `applyChange` umgeschrieben (Single Writer) | ✅ | `FlowAction.ts:603-661` |
| 3.3 | `applyChange` dispatcht via `projectStore.dispatch` | ❌ | **Diskutabel** — direkter Mutation auf `actionDef`/`this.data` |
| 3.4 | `syncToProject()` Action-Branch vereinfacht | ✅ | `FlowSyncManager.ts:106-121` |
| 3.5 | Doppel-Dispatch im Renderer entfernt | ✅ | FlowNodes nutzen direkten `applyChange`-Pfad |
| 3.6 | `handleControlChange` vereinfacht | ⚠️ | Doppel-Dispatch unverändert, für FlowNodes umgangen |
| 3.7 | `SyncValidator.validate(autoRepair=false)` als Default | ❌ | `SyncValidator.ts:31` weiterhin `= true` |
| **Tests (Phase 0 vorgezogen)** | | | |
| 0.1 | `tests/sync/flowaction_aliases.test.ts` | ✅ | 5 Alias-Paare Roundtrip |
| 0.2 | `tests/sync/inspector_writeback.test.ts` | ✅ | `applyChange` SSoT-Konsistenz |
| 0.3 | `tests/sync/schema_migrator.test.ts` | ✅ | 12 Migrations-Tests |
| 0.4 | `tests/sync/store_set_property.test.ts` | ✅ | Store-Dispatch-Pfade |
| 0.5 | `tests/sync/sync_validator_strict.test.ts` | ✅ | Mit `autoRepair=false` |

---

## §2 Restpunkte (5 Stück, nach Priorität)

### §2.1 — Kritisch: Default-Init beim Action-Create fehlt

**Plan-Bezug:** `SYNC_REFACTOR_PLAN.md` §7.2 Schritt 1

**Problem:**  
`applyRegistryDefaults` läuft nur in `EditorDataManager.loadProject()`. Beim Erstellen einer neuen Action im laufenden Editor werden keine Defaults gesetzt — der Renderer ist nach Phase 2 read-only und zeigt leere Felder.

**Reproduktion:**
1. Editor offen, Projekt geladen.
2. Flow-Editor → `Add Action` → Typ `animate`.
3. Inspector öffnen → Felder `effect`, `duration`, `targetScale` zeigen leer.
4. User speichert ohne Eingabe → undefined Felder → Runtime-Fehler.

**Vorschlag:**
- Helper in `SchemaMigrator` erweitern: `initializeActionDefaults(action: any, registryLookup): void` (Single-Action-Variante von `applyRegistryDefaults`).
- Aufruf in 3 Pfaden:
  - `AgentController.addAction()` (zu suchen)
  - `EditorCommandManager.addAction()` (zu suchen)
  - `FlowEditor.createNode('action')` bzw. wo immer der Type initial gesetzt wird
- Auch bei **Typ-Wechsel** (`applyChange('type', newType)`) sollten Defaults für den neuen Typ aufgefüllt werden, damit Felder nicht leer bleiben.

**❓ Approval-Fragen:**
1. Soll `SchemaMigrator` um `initializeActionDefaults` erweitert werden?
2. Welcher der drei Add-Pfade ist der "kanonische"? (Cascade prüft.)
3. Soll Typ-Wechsel ebenfalls Defaults nachziehen?

**Aufwand:** 0.5–1 Tag.  
**Risiko:** niedrig (additiv).

---

### §2.2 — Wichtig: `autoRepair=true` weiterhin Standard

**Plan-Bezug:** `SYNC_REFACTOR_PLAN.md` §8.2 Schritt 5, §8.3 Approval-Tabelle

**Problem:**  
`SyncValidator.ts:31`:
```typescript
public static validate(project: GameProject, context: string, autoRepair: boolean = true)
```

Auto-Repair maskiert weiterhin Symptome stumm. Bug-Logs bleiben unsichtbar.

**Vorschlag:**
- Default in `SyncValidator.validate` auf `false` umstellen.
- `FlowSyncManager.ts:191` ruft `validate(this.host.project, currentContext)` ohne 3. Argument → würde dann `false` werden. Falls in Production weiterhin Auto-Repair gewünscht, dort explizit `true` übergeben.
- Test-Files setzen weiter explizit `false` → unverändert grün.

**❓ Approval-Frage:**  
Soll der Default-Wert auf `false` gestellt werden? (Falls ja: ggf. `FlowSyncManager` explizit `true` übergeben, um aktuelle Production-Semantik zu erhalten.)

**Aufwand:** 5 Minuten.  
**Risiko:** niedrig, falls FlowSyncManager-Aufrufer explizit gesetzt wird; mittel sonst.

---

### §2.3 — Diskutabel: `applyChange` ohne Store-Dispatch

**Plan-Bezug:** `SYNC_REFACTOR_PLAN.md` §3.1, §8.1

**Beobachtung:**  
`FlowAction.applyChange()` mutiert direkt `actionDef[prop]` und `this.data[prop]`, ohne `projectStore.dispatch()` zu rufen.

| Aspekt | Aktueller Stand | Plan-Ziel |
|:---|:---|:---|
| Single Writer | ✅ alle Pfade laufen durch `applyChange` | ✅ erfüllt |
| Store als SSoT | ⚠️ Store hält Referenz auf gleiches Objekt → Mutation sichtbar, aber nicht "informiert" | ❌ nicht erfüllt |
| Undo/Redo via SnapshotManager | ❓ abhängig davon, wann SnapshotManager Snapshots zieht | ❌ falls Snapshots an `dispatch` gekoppelt |
| Reaktivität | ✅ via `MediatorEvent` durch Renderer | ⚠️ indirekt |

**Verifikation nötig:**
- Hängt der `SnapshotManager` Snapshots an `projectStore.dispatch()` oder triggert er sich anders (z.B. via `MediatorEvent`)?
- Wenn an `dispatch` gekoppelt → Undo wird unvollständig → echte Lücke.
- Wenn an `MediatorEvent` gekoppelt → OK, weil `applyChange` indirekt einen Event auslöst.

**❓ Approval-Frage:**  
Soll Cascade die Snapshot-Kopplung verifizieren und einen Bericht liefern, **bevor** entschieden wird, ob Store-Dispatch nachgerüstet werden muss?

**Aufwand Verifikation:** 1–2 Std.  
**Aufwand Nachrüstung:** 0.5–1 Tag (falls nötig).

---

### §2.4 — Minor: `schemaVersion` fehlt im `GameProject`-Interface

**Plan-Bezug:** `SYNC_REFACTOR_PLAN.md` §6.2 Schritt 1

**Problem:**  
`src/model/types.ts:452-484` zeigt `GameProject` ohne `schemaVersion?: string`. Im `SchemaMigrator` wird das via `migrateToV4(project: any)` geschrieben — funktioniert, aber kein Type-Check für andere Reader.

**Vorschlag:**  
Eine Zeile in `GameProject` ergänzen:
```typescript
schemaVersion?: string;  // Phase 1 SYNC_REFACTOR — Schema-Versionierung
```

**❓ Approval-Frage:**  
Soll Cascade diese eine Zeile ergänzen?

**Aufwand:** 1 Minute.  
**Risiko:** niedrig.

---

### §2.5 — Minor: Schreib-Schutz beim Save fehlt

**Plan-Bezug:** `SYNC_REFACTOR_PLAN.md` §6.2 Schritt 4

**Problem:**  
Plan verlangte Assertion: *„Beim Save assertion: keine Alias-Felder mehr im JSON. Wirft Error im Dev-Mode."*

Ohne diese Assertion können neue Code-Pfade unbemerkt wieder Aliase einführen, ohne dass die CI das fängt.

**Vorschlag:**
- Helper in `SchemaMigrator`: `assertNoAliases(project): void`. Iteriert wie `migrateToV4`, wirft im Dev-Mode (`import.meta.env.DEV`) bei gefundenen Aliasen.
- Aufruf in `EditorDataManager.saveProject()` und `saveProjectToFile()` vor dem JSON.stringify.
- In Production: stilles `console.warn` statt Throw.

**❓ Approval-Frage:**  
Soll Cascade diese Assertion einbauen? (Niedrige Priorität — eher Nice-to-have, hat Wert bei Onboarding neuer Entwickler.)

**Aufwand:** 1–2 Std.  
**Risiko:** niedrig (nur Dev-Mode-Assertion).

---

## §3 Empfohlene Reihenfolge

```
1. §2.1 — Default-Init beim Create        (kritisch, funktionale Lücke)
2. §2.2 — autoRepair=false Default        (5 Min, hoher Nutzen)
3. §2.4 — schemaVersion im Interface      (1 Min, Type-Hygiene)
4. §2.3 — Store-Dispatch Verifikation     (1–2 Std, dann Entscheidung)
5. §2.5 — Save-Assertion (Schreib-Schutz) (1–2 Std, optional)
```

**Empfohlener Stop-Punkt:** Nach §2.1 + §2.2 sind die wichtigsten Punkte addressiert. §2.3–§2.5 können in eine separate Iteration.

---

## §4 Aktualisierter Phase-Status (für `SYNC_REFACTOR_PLAN.md` §14)

| Phase | Status | Notiz |
|:---:|:---|:---|
| 0 | ✅ done (Test-Netz vorgezogen) | 5 Test-Files in `tests/sync/` |
| 1 | ⚠️ done with deviations | Restpunkte: §2.4, §2.5, evtl. §1.8 |
| 2 | ⚠️ done with deviations | **Kritischer Restpunkt: §2.1** |
| 3 | ⚠️ done with deviations | Restpunkte: §2.2, §2.3, §2.6 (handleControlChange) |
| 4 | ⏳ pending | Store-Selektoren statt `node.data`-Cache |
| 5 | ⏳ pending | Generisches `SET_ACTION_PROPERTY` |

---

## §5 Funktionsänderungen, die User-Approval benötigen

Aggregiert aus den 5 Restpunkten — vor Implementierung sind diese Approvals nötig:

| # | Element | Aktion | Aufwand |
|:---:|:---|:---|:---|
| §2.1-A | `SchemaMigrator.initializeActionDefaults(action, lookup)` | **Neue Methode hinzufügen** | 0.5 Tag |
| §2.1-B | `AgentController.addAction()` | Aufruf von `initializeActionDefaults` ergänzen | 5 Min |
| §2.1-C | `EditorCommandManager.addAction()` | Aufruf ergänzen | 5 Min |
| §2.1-D | `FlowEditor.createNode('action')` | Aufruf ergänzen | 5 Min |
| §2.1-E | `FlowAction.applyChange()` Typ-Wechsel-Branch | Defaults nachziehen | 15 Min |
| §2.2 | `SyncValidator.validate(...autoRepair: boolean = false)` | Default-Wert ändern | 1 Min |
| §2.2-B | `FlowSyncManager.ts:191` | Explizit `true` übergeben (falls Production-Auto-Repair gewünscht) | 1 Min |
| §2.3 | `FlowAction.applyChange()` Store-Dispatch | **Erst Verifikation, dann ggf. Refactor** | 1–2 Std + 0.5 Tag |
| §2.4 | `GameProject.schemaVersion?: string` | Interface-Erweiterung | 1 Min |
| §2.5-A | `SchemaMigrator.assertNoAliases(project)` | **Neue Methode hinzufügen** | 30 Min |
| §2.5-B | `EditorDataManager.saveProject()` + `saveProjectToFile()` | Aufruf der Assertion ergänzen | 30 Min |

---

## §6 Status & Tracking

| Datum | Aktion |
|:---|:---|
| 2026-05-09 | Initiales Review nach User-Implementation Phase 1–3 |
| TBD | §2.1 Implementation (nach Approval) |
| TBD | §2.2 Implementation (nach Approval) |
| TBD | §2.3 Verifikation Snapshot-Kopplung |
| TBD | §2.4 + §2.5 Implementation (nach Approval) |

Bei Erledigung jeweils Eintrag in `docs/use_cases/UseCaseIndex.txt` mit Tag `[UC-YYYY-MM-DD-SyncRefactor-Phase{N}-Cleanup]`.

---

*Letzte Aktualisierung: 2026-05-09 — Initial-Review nach Phase 1–3 Implementation. Alle 5 Restpunkte warten auf User-Approval.*
