/**
 * SYNC_REFACTOR Phase 0 — Layer B: SyncValidator Strict Mode Tests
 * 
 * Testet alle 6 Regeln (R1-R6) mit `autoRepair=false`.
 * Stellt sicher, dass JEDE Verletzung erkannt wird, ohne stumm repariert zu werden.
 * 
 * @since Phase 0 / SYNC_REFACTOR_PLAN §5
 */

import { SyncValidator, ValidationResult } from '../../src/editor/services/SyncValidator';

export interface TestResult {
    name: string;
    type: string;
    expectedSuccess: boolean;
    actualSuccess: boolean;
    passed: boolean;
    details?: string;
}

function createStrictTestProject(): any {
    return {
        name: 'StrictTestProject',
        tasks: [],
        actions: [
            { name: 'GlobalAction', type: 'property', target: 'Sprite1', changes: { visible: true } }
        ],
        variables: [],
        objects: [],
        flowCharts: {},
        stages: [
            {
                id: 'stage_blueprint',
                name: 'Blueprint',
                type: 'blueprint',
                tasks: [
                    {
                        name: 'InitTask',
                        actionSequence: [
                            { type: 'action', name: 'BlueprintAction' }
                        ]
                    }
                ],
                actions: [
                    { name: 'BlueprintAction', type: 'property', target: 'Panel1', changes: {} }
                ],
                objects: [],
                variables: [],
                flowCharts: {
                    InitTask: {
                        elements: [
                            { id: 'bp-task-1', type: 'task', data: { name: 'InitTask' }, properties: {} },
                            { id: 'bp-act-1', type: 'action', data: { name: 'BlueprintAction', type: 'property', isLinked: true }, properties: {} }
                        ],
                        connections: [
                            { id: 'bp-conn-1', startTargetId: 'bp-task-1', endTargetId: 'bp-act-1' }
                        ]
                    }
                }
            },
            {
                id: 'stage_game',
                name: 'Game',
                type: 'standard',
                tasks: [
                    {
                        name: 'GameTask',
                        actionSequence: [
                            { type: 'action', name: 'GlobalAction' }
                        ]
                    }
                ],
                actions: [
                    { name: 'LocalAction', type: 'variable', variableName: 'score' }
                ],
                objects: [],
                variables: [],
                flowCharts: {
                    GameTask: {
                        elements: [
                            { id: 'gm-task-1', type: 'task', data: { name: 'GameTask' }, properties: {} },
                            { id: 'gm-act-1', type: 'action', data: { name: 'GlobalAction', type: 'property', isLinked: true }, properties: {} }
                        ],
                        connections: [
                            { id: 'gm-conn-1', startTargetId: 'gm-task-1', endTargetId: 'gm-act-1' }
                        ]
                    }
                }
            }
        ]
    };
}

export async function runSyncValidatorStrictTests(): Promise<TestResult[]> {
    console.log("🧪 SyncValidator Strict-Mode Tests starten...");
    const results: TestResult[] = [];

    const addResult = (name: string, passed: boolean, details?: string) => {
        results.push({
            name,
            type: 'SyncRefactor-Phase0',
            expectedSuccess: true,
            actualSuccess: passed,
            passed,
            details
        });
    };

    // ===================================================================
    // Gutfall: Sauberes Projekt → 0 Verletzungen (autoRepair=false)
    // ===================================================================
    try {
        const project = createStrictTestProject();
        const violations = SyncValidator.validate(project, 'InitTask', false);
        const ok = violations.length === 0;
        addResult('Strict R0: Sauberes Projekt → 0 Verletzungen', ok,
            ok ? 'Keine Verletzungen' : `${violations.length}: ${violations.map(v => `[${v.rule}] ${v.message}`).join('; ')}`);
    } catch (e: any) {
        addResult('Strict R0: Sauberes Projekt → 0 Verletzungen', false, `Exception: ${e.message}`);
    }

    // ===================================================================
    // R1 Strict: Verwaiste Action erkennen OHNE Repair
    // ===================================================================
    try {
        const project = createStrictTestProject();
        project.stages[0].tasks[0].actionSequence.push({ type: 'action', name: 'GhostAction' });

        const violations = SyncValidator.validate(project, 'InitTask', false);
        const r1 = violations.filter(v => v.rule === 'R1');

        // Prüfe: Verletzung erkannt UND ActionSequence NICHT verändert
        const seqStillContainsGhost = project.stages[0].tasks[0].actionSequence
            .some((a: any) => a.name === 'GhostAction');

        const ok = r1.length > 0 && seqStillContainsGhost && !r1[0].autoRepaired;
        addResult('Strict R1: Verwaiste Action erkannt, NICHT repariert', ok,
            `R1-Verletzungen=${r1.length}, Ghost noch da=${seqStillContainsGhost}`);
    } catch (e: any) {
        addResult('Strict R1: Verwaiste Action erkannt, NICHT repariert', false, `Exception: ${e.message}`);
    }

    // ===================================================================
    // R2 Strict: FlowChart ohne Task erkennen OHNE Repair
    // ===================================================================
    try {
        const project = createStrictTestProject();
        project.stages[1].flowCharts['PhantomTask'] = { elements: [], connections: [] };

        const violations = SyncValidator.validate(project, 'GameTask', false);
        const r2 = violations.filter(v => v.rule === 'R2');

        // Prüfe: Verletzung erkannt UND FlowChart NICHT gelöscht
        const phantomStillExists = !!project.stages[1].flowCharts['PhantomTask'];

        const ok = r2.length > 0 && phantomStillExists && !r2[0].autoRepaired;
        addResult('Strict R2: FlowChart ohne Task erkannt, NICHT repariert', ok,
            `R2-Verletzungen=${r2.length}, Phantom noch da=${phantomStillExists}`);
    } catch (e: any) {
        addResult('Strict R2: FlowChart ohne Task erkannt, NICHT repariert', false, `Exception: ${e.message}`);
    }

    // ===================================================================
    // R3 Strict: Connection auf nicht-existierenden Node
    // ===================================================================
    try {
        const project = createStrictTestProject();
        project.stages[0].flowCharts.InitTask.connections.push({
            id: 'broken-conn', startTargetId: 'DOES_NOT_EXIST', endTargetId: 'bp-act-1'
        });

        const violations = SyncValidator.validate(project, 'InitTask', false);
        const r3 = violations.filter(v => v.rule === 'R3');

        const ok = r3.length > 0 && r3[0].message.includes('DOES_NOT_EXIST');
        addResult('Strict R3: Kaputte Connection erkannt', ok,
            `R3-Verletzungen=${r3.length}`);
    } catch (e: any) {
        addResult('Strict R3: Kaputte Connection erkannt', false, `Exception: ${e.message}`);
    }

    // ===================================================================
    // R4 Strict: Typ-Desync zwischen Flow-Node und Definition
    // ===================================================================
    try {
        const project = createStrictTestProject();
        // Setze den Node-Typ auf etwas anderes als die Definition
        project.stages[0].flowCharts.InitTask.elements[1].data.type = 'navigate';
        // Definition hat type='property' → Desync!

        const violations = SyncValidator.validate(project, 'InitTask', false);
        const r4 = violations.filter(v => v.rule === 'R4');

        const ok = r4.length > 0 && r4[0].message.includes('Typ-Desync');
        addResult('Strict R4: Typ-Desync erkannt', ok,
            `R4-Verletzungen=${r4.length}, msg=${r4[0]?.message || 'keine'}`);
    } catch (e: any) {
        addResult('Strict R4: Typ-Desync erkannt', false, `Exception: ${e.message}`);
    }

    // ===================================================================
    // R5 Strict: Task-Duplikat erkennen OHNE Repair
    // ===================================================================
    try {
        const project = createStrictTestProject();
        // Task "InitTask" in einer zweiten Stage duplizieren
        project.stages[1].tasks.push({ name: 'InitTask', actionSequence: [] });

        const violations = SyncValidator.validate(project, 'GameTask', false);
        const r5 = violations.filter(v => v.rule === 'R5');

        const ok = r5.length > 0 && r5[0].message.includes('InitTask');
        addResult('Strict R5: Task-Duplikat erkannt', ok,
            `R5-Verletzungen=${r5.length}`);
    } catch (e: any) {
        addResult('Strict R5: Task-Duplikat erkannt', false, `Exception: ${e.message}`);
    }

    // ===================================================================
    // R6 Strict: FlowChart Split-Brain erkennen OHNE Repair
    // ===================================================================
    try {
        const project = createStrictTestProject();
        // InitTask existiert in stage_blueprint UND root
        project.flowCharts['InitTask'] = { elements: [], connections: [] };

        const violations = SyncValidator.validate(project, 'InitTask', false);
        const r6 = violations.filter(v => v.rule === 'R6');

        // Prüfe: Verletzung erkannt UND Root-Eintrag NICHT gelöscht
        const rootStillExists = !!project.flowCharts['InitTask'];

        const ok = r6.length > 0 && rootStillExists && r6[0].message.includes('Split-Brain');
        addResult('Strict R6: FlowChart Split-Brain erkannt, NICHT repariert', ok,
            `R6-Verletzungen=${r6.length}, Root noch da=${rootStillExists}`);
    } catch (e: any) {
        addResult('Strict R6: FlowChart Split-Brain erkannt, NICHT repariert', false, `Exception: ${e.message}`);
    }

    return results;
}

// Standalone execution
const isMain = import.meta.url.includes(process.argv[1].replace(/\\\\/g, '/')) || process.argv[1].endsWith('sync_validator_strict.test.ts');
if (isMain) {
    runSyncValidatorStrictTests().then(results => {
        results.forEach(r => {
            console.log(`${r.passed ? '✅' : '❌'} ${r.name}: ${r.details}`);
        });
        const passed = results.filter(r => r.passed).length;
        console.log(`\n  SyncValidator Strict: ${passed} bestanden, ${results.length - passed} fehlgeschlagen`);
        process.exit(results.every(r => r.passed) ? 0 : 1);
    });
}
