/**
 * Project Integrity Tests – Strukturelle Validierung der aktuellen project.json
 * 
 * Testet: Orphaned Tasks, Orphaned FlowCharts, Blueprint SSoT, Duplikate,
 *         Action-Referenzen, Event→Task-Mappings.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TestResult {
    name: string;
    type: string;
    expectedSuccess: boolean;
    actualSuccess: boolean;
    passed: boolean;
    details?: string;
}

function loadProject(): any {
    const projectPath = path.join(__dirname, '../game-server/public/platform/project.json');
    if (!fs.existsSync(projectPath)) {
        throw new Error(`project.json nicht gefunden: ${projectPath}`);
    }
    return JSON.parse(fs.readFileSync(projectPath, 'utf-8'));
}

export async function runProjectIntegrityTests(): Promise<TestResult[]> {
    console.log("🧪 Project Integrity Tests starten...");
    const results: TestResult[] = [];

    const addResult = (name: string, passed: boolean, details?: string) => {
        results.push({
            name,
            type: 'Integrity',
            expectedSuccess: true,
            actualSuccess: passed,
            passed,
            details
        });
    };

    let project: any;
    try {
        project = loadProject();
    } catch (e: any) {
        addResult('Projekt laden', false, e.message);
        return results;
    }
    addResult('Projekt laden', true, `Stages: ${project.stages?.length || 0}`);

    // Sammle alle bekannten Elemente
    const allTaskNames = new Set<string>();
    const allActionNames = new Set<string>();
    const allFlowChartNames = new Set<string>();
    const taskToStage = new Map<string, string>();
    const taskDuplicates: string[] = [];

    project.stages?.forEach((stage: any) => {
        const stageId = stage.id || stage.name;

        // Tasks
        (stage.tasks || []).forEach((t: any) => {
            if (allTaskNames.has(t.name) && stageId !== 'stage_blueprint') {
                taskDuplicates.push(`${t.name} (in ${taskToStage.get(t.name)} UND ${stageId})`);
            }
            allTaskNames.add(t.name);
            taskToStage.set(t.name, stageId);
        });

        // Actions
        (stage.actions || []).forEach((a: any) => allActionNames.add(a.name));

        // FlowCharts
        if (stage.flowCharts) {
            Object.keys(stage.flowCharts).forEach(name => {
                if (name !== 'global') allFlowChartNames.add(name);
            });
        }
    });

    // Root Tasks/Actions (Legacy)
    (project.tasks || []).forEach((t: any) => allTaskNames.add(t.name));
    (project.actions || []).forEach((a: any) => allActionNames.add(a.name));

    // --- Test 1: Keine Orphaned FlowCharts (ohne zugehörigen Task) ---
    try {
        const orphanedFlowCharts: string[] = [];
        project.stages?.forEach((stage: any) => {
            if (!stage.flowCharts) return;
            Object.keys(stage.flowCharts).forEach(chartName => {
                if (chartName === 'global') return;
                if (!allTaskNames.has(chartName)) {
                    orphanedFlowCharts.push(`${chartName} (in ${stage.id})`);
                }
            });
        });

        const ok = orphanedFlowCharts.length === 0;
        addResult('Integrität: Keine verwaisten FlowCharts', ok,
            ok ? 'Alle FlowCharts haben Tasks' : `Verwaist: [${orphanedFlowCharts.join(', ')}]`);
    } catch (e: any) {
        addResult('Integrität: Keine verwaisten FlowCharts', false, `Exception: ${e.message}`);
    }

    // --- Test 2: Keine Task-Duplikate zwischen Stages ---
    try {
        const ok = taskDuplicates.length === 0;
        addResult('Integrität: Keine Task-Duplikate', ok,
            ok ? 'Keine Duplikate' : `Duplikate: [${taskDuplicates.join(', ')}]`);
    } catch (e: any) {
        addResult('Integrität: Keine Task-Duplikate', false, `Exception: ${e.message}`);
    }

    // --- Test 3: Event→Task-Mappings referenzieren existierende Tasks ---
    try {
        const brokenMappings: string[] = [];
        project.stages?.forEach((stage: any) => {
            // Stage Events
            if (stage.events) {
                Object.entries(stage.events).forEach(([evt, taskName]) => {
                    if (taskName && !allTaskNames.has(taskName as string)) {
                        brokenMappings.push(`Stage "${stage.id}" Event "${evt}" → "${taskName}"`);
                    }
                });
            }
            // Object Events
            (stage.objects || []).forEach((obj: any) => {
                const events = obj.events || obj.Tasks || {};
                Object.entries(events).forEach(([evt, taskName]) => {
                    if (taskName && !allTaskNames.has(taskName as string)) {
                        brokenMappings.push(`"${obj.name}" Event "${evt}" → "${taskName}"`);
                    }
                });
            });
        });

        const ok = brokenMappings.length === 0;
        addResult('Integrität: Event→Task-Mappings gültig', ok,
            ok ? 'Alle Mappings OK' : `Kaputt: [${brokenMappings.slice(0, 5).join(', ')}${brokenMappings.length > 5 ? '...' : ''}]`);
    } catch (e: any) {
        addResult('Integrität: Event→Task-Mappings gültig', false, `Exception: ${e.message}`);
    }

    // --- Test 4: ActionSequences referenzieren nur definierte Actions ---
    try {
        const undefinedActions: string[] = [];
        project.stages?.forEach((stage: any) => {
            (stage.tasks || []).forEach((task: any) => {
                (task.actionSequence || []).forEach((seq: any) => {
                    if (seq.type === 'action' && seq.name && !allActionNames.has(seq.name)) {
                        undefinedActions.push(`"${task.name}" → "${seq.name}" (in ${stage.id})`);
                    }
                });
            });
        });

        // Warning-Level: nicht kritisch, da Actions auch inline definiert sein können
        const ok = undefinedActions.length === 0;
        addResult('Integrität: Actions in Sequences definiert', ok,
            ok ? 'Alle Actions gefunden' : `Nicht gefunden: [${undefinedActions.slice(0, 5).join(', ')}${undefinedActions.length > 5 ? '...' : ''}]`);
    } catch (e: any) {
        addResult('Integrität: Actions in Sequences definiert', false, `Exception: ${e.message}`);
    }

    // --- Test 5: Blueprint-Stage existiert ---
    try {
        const blueprintExists = project.stages?.some((s: any) =>
            s.id === 'stage_blueprint' || s.type === 'blueprint'
        );
        addResult('Integrität: Blueprint-Stage vorhanden', blueprintExists,
            blueprintExists ? 'stage_blueprint gefunden' : 'FEHLT!');
    } catch (e: any) {
        addResult('Integrität: Blueprint-Stage vorhanden', false, `Exception: ${e.message}`);
    }

    // --- Test 6: Keine korrupten Task-Einträge (elements/connections als Task-Name) ---
    try {
        const corruptTasks: string[] = [];
        project.stages?.forEach((stage: any) => {
            (stage.tasks || []).forEach((task: any) => {
                if (['elements', 'connections', 'undefined', 'null'].includes(task.name)) {
                    corruptTasks.push(`"${task.name}" in ${stage.id}`);
                }
            });
        });

        const ok = corruptTasks.length === 0;
        addResult('Integrität: Keine korrupten Task-Einträge', ok,
            ok ? 'Alle Task-Namen gültig' : `Korrupt: [${corruptTasks.join(', ')}]`);
    } catch (e: any) {
        addResult('Integrität: Keine korrupten Task-Einträge', false, `Exception: ${e.message}`);
    }

    // --- Test 7: Keine Inline-Actions in ActionSequences ---
    // Regel: actionSequence darf NUR Referenzen enthalten ({ type: 'action', name: '...' }),
    // KEINE vollständigen Action-Definitionen (mit formula, url, method, target, changes etc.)
    try {
        const inlineActions: string[] = [];

        // Inline-Action-Erkennungsmerkmale: Felder die nur in echten Definitionen vorkommen
        const inlineIndicators = [
            'formula', 'url', 'method', 'target', 'changes', 'resource',
            'queryProperty', 'queryValue', 'storagePath', 'collection',
            'requestJWT', 'resultPath', 'selectFields', 'service',
            'calcSteps', 'serviceParams'
        ];

        const checkSequence = (seq: any[], taskName: string, stageId: string) => {
            if (!seq || !Array.isArray(seq)) return;
            seq.forEach((item: any, idx: number) => {
                if (!item || typeof item === 'string') return;

                // Prüfe ob das Sequence-Item eigene Action-Daten enthält
                const foundIndicators = inlineIndicators.filter(key => item[key] !== undefined);
                if (foundIndicators.length > 0) {
                    inlineActions.push(
                        `"${taskName}" [${idx}] in ${stageId}: Inline-Felder=[${foundIndicators.join(', ')}]`
                    );
                }

                // Rekursiv in verschachtelten Bodies suchen
                if (item.successBody) checkSequence(item.successBody, taskName + '.successBody', stageId);
                if (item.errorBody) checkSequence(item.errorBody, taskName + '.errorBody', stageId);
                if (item.elseBody) checkSequence(item.elseBody, taskName + '.elseBody', stageId);
                if (item.body) checkSequence(item.body, taskName + '.body', stageId);
            });
        };

        // Root-Level Tasks prüfen
        (project.tasks || []).forEach((task: any) => {
            checkSequence(task.actionSequence, task.name, 'root');
        });

        // Stage-Tasks prüfen
        project.stages?.forEach((stage: any) => {
            (stage.tasks || []).forEach((task: any) => {
                checkSequence(task.actionSequence, task.name, stage.id || stage.name);
            });
        });

        const ok = inlineActions.length === 0;
        addResult('Integrität: Keine Inline-Actions', ok,
            ok ? 'Alle Sequences nutzen Referenzen' : `Inline gefunden: [${inlineActions.slice(0, 5).join('; ')}${inlineActions.length > 5 ? ` (+${inlineActions.length - 5} weitere)` : ''}]`);
    } catch (e: any) {
        addResult('Integrität: Keine Inline-Actions', false, `Exception: ${e.message}`);
    }

    return results;
}

// Standalone execution
const isMain = import.meta.url.includes(process.argv[1].replace(/\\/g, '/')) || process.argv[1].endsWith('project_integrity.test.ts');
if (isMain) {
    runProjectIntegrityTests().then(results => {
        results.forEach(r => {
            console.log(`${r.passed ? '✅' : '❌'} ${r.name}: ${r.details}`);
        });
        const allPassed = results.every(r => r.passed);
        console.log(`\n🧪 Integrität: ${results.filter(r => r.passed).length}/${results.length} bestanden.`);
        process.exit(allPassed ? 0 : 1);
    });
}
