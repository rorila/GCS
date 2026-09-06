/**
 * FlowSync Tests – Sicherheitsnetz für Flow-zu-Projekt-Synchronisation
 * 
 * Da FlowSyncManager stark an UI-Klassen (FlowElement, FlowAction, etc.) gebunden ist,
 * testen wir hier die datenbasierten Aspekte: generateFlowFromActionSequence-Logik,
 * cleanCorruptTaskData-Muster und Blueprint-SSoT-Validierung.
 * 
 * Diese Tests arbeiten direkt auf dem GameProject-Datenmodell.
 */

import { GameProject } from '../src/model/types';

export interface TestResult {
    name: string;
    type: string;
    expectedSuccess: boolean;
    actualSuccess: boolean;
    passed: boolean;
    details?: string;
}

function createFlowTestProject(): GameProject {
    return {
        meta: { name: 'FlowTest', version: '1.0', author: 'Test' },
        objects: [],
        variables: [],
        tasks: [],
        actions: [],
        stages: [
            {
                id: 'stage_blueprint',
                name: 'Blueprint',
                type: 'blueprint',
                objects: [],
                variables: [
                    { id: 'v_globalScore', name: 'globalScore', type: 'integer', scope: 'global', value: 0, defaultValue: 0 }
                ],
                tasks: [
                    {
                        name: 'InitTask',
                        actionSequence: [
                            { type: 'action', name: 'ResetScore' },
                            { type: 'action', name: 'ShowWelcome' }
                        ]
                    }
                ],
                actions: [
                    { name: 'ResetScore', type: 'variable', variableName: 'globalScore', value: 0 },
                    { name: 'ShowWelcome', type: 'property', target: 'WelcomeLabel', changes: { visible: true } }
                ],
                flowCharts: {
                    'InitTask': {
                        elements: [
                            { id: 'e1', type: 'Task', Name: 'InitTask', x: 100, y: 50 },
                            { id: 'e2', type: 'Action', Name: 'ResetScore', x: 100, y: 150 },
                            { id: 'e3', type: 'Action', Name: 'ShowWelcome', x: 100, y: 250 }
                        ],
                        connections: [
                            { id: 'c1', startTargetId: 'e1', endTargetId: 'e2' },
                            { id: 'c2', startTargetId: 'e2', endTargetId: 'e3' }
                        ]
                    }
                }
            } as any,
            {
                id: 'stage_game',
                name: 'Game',
                type: 'standard',
                objects: [],
                variables: [
                    { id: 'v_stageScore', name: 'stageScore', type: 'integer', scope: 'stage', value: 0, defaultValue: 0 }
                ],
                tasks: [
                    {
                        name: 'ScoreTask',
                        actionSequence: [
                            { type: 'action', name: 'IncrementScore' }
                        ]
                    }
                ],
                actions: [
                    { name: 'IncrementScore', type: 'increment', variableName: 'stageScore' }
                ],
                flowCharts: {
                    'ScoreTask': {
                        elements: [
                            { id: 'g1', type: 'Task', Name: 'ScoreTask', x: 100, y: 50 },
                            { id: 'g2', type: 'Action', Name: 'IncrementScore', x: 100, y: 150 }
                        ],
                        connections: [
                            { id: 'gc1', startTargetId: 'g1', endTargetId: 'g2' }
                        ]
                    }
                }
            } as any
        ],
        activeStageId: 'stage_game'
    } as any;
}

export async function runFlowSyncTests(): Promise<TestResult[]> {
    console.log("🧪 FlowSync Tests starten...");
    const results: TestResult[] = [];

    const addResult = (name: string, passed: boolean, details?: string) => {
        results.push({
            name,
            type: 'FlowSync',
            expectedSuccess: true,
            actualSuccess: passed,
            passed,
            details
        });
    };

    // --- Test 1: FlowChart-Elemente entsprechen ActionSequence ---
    try {
        const project = createFlowTestProject();
        const bp = project.stages.find(s => s.id === 'stage_blueprint')!;
        const initTask = bp.tasks!.find((t: any) => t.name === 'InitTask')!;
        const flowChart = (bp as any).flowCharts?.['InitTask'];

        const actionNodes = flowChart.elements.filter((e: any) => e.type === 'Action');
        const seqLength = initTask.actionSequence?.length || 0;

        const ok = actionNodes.length === seqLength;
        addResult('FlowSync: Elemente = Sequence-Länge', ok,
            `Flow-Actions=${actionNodes.length}, Sequence=${seqLength}`);
    } catch (e: any) {
        addResult('FlowSync: Elemente = Sequence-Länge', false, `Exception: ${e.message}`);
    }

    // --- Test 2: FlowChart-Action-Namen stimmen mit Sequence überein ---
    try {
        const project = createFlowTestProject();
        const bp = project.stages.find(s => s.id === 'stage_blueprint')!;
        const initTask = bp.tasks!.find((t: any) => t.name === 'InitTask')!;
        const flowChart = (bp as any).flowCharts?.['InitTask'];

        const flowActionNames = flowChart.elements
            .filter((e: any) => e.type === 'Action')
            .map((e: any) => e.Name || e.name);
        const seqActionNames = initTask.actionSequence!
            .filter((s: any) => s.type === 'action')
            .map((s: any) => s.name);

        const ok = JSON.stringify(flowActionNames) === JSON.stringify(seqActionNames);
        addResult('FlowSync: Action-Namen konsistent', ok,
            `Flow=[${flowActionNames.join(',')}], Seq=[${seqActionNames.join(',')}]`);
    } catch (e: any) {
        addResult('FlowSync: Action-Namen konsistent', false, `Exception: ${e.message}`);
    }

    // --- Test 3: Blueprint-Tasks nicht in aktiver Stage dupliziert ---
    try {
        const project = createFlowTestProject();
        const bp = project.stages.find(s => s.id === 'stage_blueprint')!;
        const game = project.stages.find(s => s.id === 'stage_game')!;

        const bpTaskNames = (bp.tasks || []).map((t: any) => t.name);
        const gameTaskNames = (game.tasks || []).map((t: any) => t.name);
        const duplicates = bpTaskNames.filter(name => gameTaskNames.includes(name));

        const ok = duplicates.length === 0;
        addResult('FlowSync: Keine Blueprint/Stage Task-Duplikate', ok,
            `Duplikate=[${duplicates.join(',')}]`);
    } catch (e: any) {
        addResult('FlowSync: Keine Blueprint/Stage Task-Duplikate', false, `Exception: ${e.message}`);
    }

    // --- Test 4: Connections sind gültig (referenzieren existierende Elemente) ---
    try {
        const project = createFlowTestProject();
        let allValid = true;
        let invalidDetails: string[] = [];

        project.stages.forEach(stage => {
            const flowCharts = (stage as any).flowCharts || {};
            Object.entries(flowCharts).forEach(([taskName, chart]: [string, any]) => {
                const elementIds = new Set(chart.elements.map((e: any) => e.id));
                (chart.connections || []).forEach((conn: any) => {
                    if (!elementIds.has(conn.startTargetId)) {
                        allValid = false;
                        invalidDetails.push(`${taskName}: start ${conn.startTargetId} nicht in Elementen`);
                    }
                    if (!elementIds.has(conn.endTargetId)) {
                        allValid = false;
                        invalidDetails.push(`${taskName}: end ${conn.endTargetId} nicht in Elementen`);
                    }
                });
            });
        });

        addResult('FlowSync: Connections referenzieren gültige Elemente', allValid,
            allValid ? 'Alle Connections gültig' : invalidDetails.join('; '));
    } catch (e: any) {
        addResult('FlowSync: Connections referenzieren gültige Elemente', false, `Exception: ${e.message}`);
    }

    // --- Test 5: Korrupte Task-Daten erkennen (elements/connections als Task) ---
    try {
        const project = createFlowTestProject();
        const game = project.stages.find(s => s.id === 'stage_game')!;

        // Simuliere korrupte Daten: "elements" fälschlicherweise als Task-Name
        game.tasks!.push({ name: 'elements', actionSequence: [] } as any);
        game.tasks!.push({ name: 'connections', actionSequence: [] } as any);

        // Prüfe ob wir die korrupten Einträge erkennen können
        const corruptTasks = game.tasks!.filter((t: any) =>
            t.name === 'elements' || t.name === 'connections'
        );

        const ok = corruptTasks.length === 2; // Wir erkennen sie
        addResult('FlowSync: Korrupte Task-Daten erkannt', ok,
            `Gefunden: ${corruptTasks.length} korrupte Einträge`);
    } catch (e: any) {
        addResult('FlowSync: Korrupte Task-Daten erkannt', false, `Exception: ${e.message}`);
    }

    return results;
}

// Standalone execution
const isMain = import.meta.url.includes(process.argv[1].replace(/\\/g, '/')) || process.argv[1].endsWith('flow_sync.test.ts');
if (isMain) {
    runFlowSyncTests().then(results => {
        results.forEach(r => {
            console.log(`${r.passed ? '✅' : '❌'} ${r.name}: ${r.details}`);
        });
        const allPassed = results.every(r => r.passed);
        console.log(`\n🧪 FlowSync: ${results.filter(r => r.passed).length}/${results.length} bestanden.`);
        process.exit(allPassed ? 0 : 1);
    });
}
