---
description: Blueprint-Stage Tasks im Flow-Dropdown anzeigen / debuggen / reparieren
---

# Workflow: Blueprint Flow-Dropdown

Verwendung: Wenn Blueprint-Stage Tasks (z.B. `AttemptLogin`) im Flow-Tab nicht im Dropdown erscheinen.

## Diagnose

1. **Prüfe `updateFlowSelector()`** in `src/editor/FlowEditor.ts` (ca. L535–605):
   - Ist ein Block vorhanden, der `activeStage?.flowCharts` scannt (Block `// 0.`)?
   - Ist ein Block vorhanden, der `activeStage?.tasks` scannt (Block `// 0b.`)?
   - Werden diese Blöcke **vor** dem Legacy-Scan (`project.flowCharts`, `project.tasks`) ausgeführt?

2. **Prüfe die Datenlage im Projekt-JSON** (`localStorage` oder `public/project.json`):
   - Liegen die Tasks unter `stages[?(@.type=='blueprint')].tasks[]`?
   - Oder fälschlicherweise unter `project.tasks[]` (veraltet)?

3. **Prüfe `getActiveStage()`** in `FlowEditor.ts` (L133–136):
   - Gibt die Methode die Blueprint-Stage zurück, wenn diese aktiv ist?
   - `activeStage?.id === 'stage_blueprint'` oder `activeStage?.type === 'blueprint'`?

## Fix-Implementierung

Falls Block `// 0.` oder `// 0b.` fehlt, füge sie im Blueprint-Zweig von `updateFlowSelector()` ein:

```typescript
// --- Global Section ---
if (!activeStage || isBlueprint) {
    const globalGroup = document.createElement('optgroup');
    globalGroup.label = isBlueprint ? '🔷 Blueprint / Global' : 'Global / Projekt (Infrastruktur)';
    const globalTasksFound = new Set<string>();

    // 0. Blueprint-Stage-eigene FlowCharts (SSoT)
    if (activeStage?.flowCharts) {
        Object.keys(activeStage.flowCharts).forEach(key => {
            if (key !== 'global') {
                const opt = document.createElement('option');
                opt.value = key;
                opt.text = `Task: ${key}`;
                opt.selected = this.currentFlowContext === key;
                globalGroup.appendChild(opt);
                globalTasksFound.add(key);
            }
        });
    }

    // 0b. Blueprint-Stage-eigene Tasks ohne FlowChart
    if (activeStage?.tasks) {
        activeStage.tasks.forEach(task => {
            if (!globalTasksFound.has(task.name)) {
                const opt = document.createElement('option');
                opt.value = task.name;
                opt.text = `Task: ${task.name}`;
                opt.selected = this.currentFlowContext === task.name;
                globalGroup.appendChild(opt);
                globalTasksFound.add(task.name);
            }
        });
    }

    const stageTaskKeys = new Set<string>(globalTasksFound);

    // 1. Legacy: project.flowCharts (Fallback)
    if (this.project.flowCharts) {
        Object.keys(this.project.flowCharts).forEach(key => {
            if (key !== 'global' && !stageTaskKeys.has(key)) {
                const opt = document.createElement('option');
                opt.value = key;
                opt.text = `Task: ${key}`;
                globalGroup.appendChild(opt);
                globalTasksFound.add(key);
            }
        });
    }

    // 2. Legacy: project.tasks (Fallback)
    if (this.project.tasks) {
        this.project.tasks.forEach(task => {
            if (!globalTasksFound.has(task.name) && !stageTaskKeys.has(task.name)) {
                const opt = document.createElement('option');
                opt.value = task.name;
                opt.text = `Task: ${task.name}`;
                globalGroup.appendChild(opt);
                globalTasksFound.add(task.name);
            }
        });
    }

    if (globalGroup.children.length > 0) {
        this.flowSelect.appendChild(globalGroup);
    }
}
```

## Neuen Blueprint-Task via AgentController erstellen

```typescript
// AgentController erstellt Tasks korrekt in stage_blueprint.tasks
const agent = AgentController.getInstance();
agent.setProject(project);
agent.createTask('blueprint', 'MeinNeuerTask', 'Beschreibung');
// → Task landet in stage_blueprint.tasks[] und ist sofort im Dropdown sichtbar
```

## Validierung

// turbo
1. `npm run test` ausführen — QA_Report.md muss grün sein.
2. Manuell: Im Editor Blueprint-Stage öffnen → Flow-Tab → Dropdown prüfen: `AttemptLogin` und andere Blueprint-Tasks müssen erscheinen.
3. Task im Dropdown auswählen → Flow-Diagramm muss laden (Self-Healing via `generateFlowFromActionSequence` falls noch kein Chart vorhanden).

## Referenzdokumente

- UseCase: `docs/use_cases/BlueprintFlowDropdown.md`
- Hosting-Regeln: `DEVELOPER_GUIDELINES.md` §Hosting-Regeln für globale Daten (v2.16.13)
- Blueprint Flow-System: `DEVELOPER_GUIDELINES.md` §Blueprint Flow-System (v3.3.14)
- Implementierung: `src/editor/FlowEditor.ts` Methode `updateFlowSelector()` L535–605
