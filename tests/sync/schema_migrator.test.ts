/**
 * SYNC_REFACTOR Phase 1 — SchemaMigrator Tests
 * 
 * Prüft die Alias→Kanonisch-Migration für alle 5 Feldpaare.
 * 
 * Testfälle:
 *   1. Projekt mit allen Aliasen → Migration → keine Aliase mehr
 *   2. Projekt mit gemischten Feldern → kanonische Variante gewinnt
 *   3. schemaVersion wird korrekt gesetzt
 *   4. Migration ist idempotent
 *   5. Leeres Projekt → keine Exception
 *   6. FlowChart-Elemente data werden ebenfalls migriert
 *   7. Alias UND kanonisch → kanonisch gewinnt, Alias gelöscht
 * 
 * @since Phase 1 / SYNC_REFACTOR_PLAN §6
 */

import { SchemaMigrator } from '../../src/services/SchemaMigrator';

export interface TestResult {
    name: string;
    type: string;
    expectedSuccess: boolean;
    actualSuccess: boolean;
    passed: boolean;
    details?: string;
}

function createLegacyProject(): any {
    return {
        meta: { name: 'LegacyTest', version: '1.0', author: 'Test' },
        objects: [],
        variables: [],
        tasks: [],
        actions: [
            {
                name: 'LegacyPropertyAction',
                actionType: 'property',         // → type
                propertyChanges: { visible: true }, // → changes
                target: 'Sprite1'
            },
            {
                name: 'LegacyVarAction',
                actionType: 'variable',          // → type
                variable: 'score',               // → variableName
                value: 42
            },
            {
                name: 'LegacyServiceAction',
                actionType: 'service',           // → type
                methodName: 'doStuff',           // → method
                service: 'MyService'
            },
            {
                name: 'LegacyCalcAction',
                actionType: 'calculate',         // → type
                expression: '2 + 2',             // → formula
                resultVariable: 'result'
            }
        ],
        stages: [
            {
                id: 'stage_main',
                name: 'Main',
                type: 'main',
                objects: [],
                variables: [],
                tasks: [],
                actions: [
                    {
                        name: 'StageLegacyAction',
                        actionType: 'property',
                        propertyChanges: { color: 'red' },
                        target: 'Panel1'
                    }
                ],
                flowCharts: {
                    TestTask: {
                        elements: [
                            {
                                id: 'el1',
                                type: 'action',
                                data: {
                                    name: 'FlowNodeLegacy',
                                    actionType: 'animate',
                                    expression: 'shake',
                                    methodName: 'play'
                                }
                            }
                        ],
                        connections: []
                    }
                }
            }
        ]
    };
}

export async function runSchemaMigratorTests(): Promise<TestResult[]> {
    console.log("🧪 SchemaMigrator Tests starten...");
    const results: TestResult[] = [];

    const addResult = (name: string, passed: boolean, details?: string) => {
        results.push({
            name,
            type: 'SyncRefactor-Phase1',
            expectedSuccess: true,
            actualSuccess: passed,
            passed,
            details
        });
    };

    // ===================================================================
    // Test 1: Alle Aliase werden normalisiert
    // ===================================================================
    try {
        const project = createLegacyProject();
        SchemaMigrator.migrateToV4(project);

        const a0 = project.actions[0]; // LegacyPropertyAction
        const a1 = project.actions[1]; // LegacyVarAction
        const a2 = project.actions[2]; // LegacyServiceAction
        const a3 = project.actions[3]; // LegacyCalcAction

        const ok = a0.type === 'property' && a0.actionType === undefined
                && a0.changes?.visible === true && a0.propertyChanges === undefined
                && a1.type === 'variable' && a1.variableName === 'score' && a1.variable === undefined
                && a2.type === 'service' && a2.method === 'doStuff' && a2.methodName === undefined
                && a3.type === 'calculate' && a3.formula === '2 + 2' && a3.expression === undefined;

        addResult('Phase1: Alle Aliase normalisiert', ok,
            `type=${a0.type}, changes=${!!a0.changes}, variableName=${a1.variableName}, method=${a2.method}, formula=${a3.formula}`);
    } catch (e: any) {
        addResult('Phase1: Alle Aliase normalisiert', false, `Exception: ${e.message}`);
    }

    // ===================================================================
    // Test 2: Gemischte Felder — kanonisch gewinnt
    // ===================================================================
    try {
        const project = {
            meta: { name: 'Mixed' },
            actions: [
                {
                    name: 'MixedAction',
                    type: 'navigate',         // kanonisch
                    actionType: 'property',   // Alias — muss gelöscht werden
                    changes: { x: 1 },        // kanonisch
                    propertyChanges: { x: 2 } // Alias — muss gelöscht werden
                }
            ],
            stages: []
        };

        SchemaMigrator.migrateToV4(project);
        const a = project.actions[0];

        const ok = a.type === 'navigate' && a.actionType === undefined
                && a.changes.x === 1 && a.propertyChanges === undefined;

        addResult('Phase1: Gemischt → kanonisch gewinnt', ok,
            `type=${a.type}, changes.x=${a.changes?.x}, aliasDeleted=${a.actionType === undefined && a.propertyChanges === undefined}`);
    } catch (e: any) {
        addResult('Phase1: Gemischt → kanonisch gewinnt', false, `Exception: ${e.message}`);
    }

    // ===================================================================
    // Test 3: schemaVersion wird gesetzt
    // ===================================================================
    try {
        const project = createLegacyProject();
        SchemaMigrator.migrateToV4(project);

        const ok = project.schemaVersion === '4.0.0';
        addResult('Phase1: schemaVersion = 4.0.0', ok,
            `schemaVersion=${project.schemaVersion}`);
    } catch (e: any) {
        addResult('Phase1: schemaVersion = 4.0.0', false, `Exception: ${e.message}`);
    }

    // ===================================================================
    // Test 4: Idempotenz — zweiter Aufruf ändert nichts
    // ===================================================================
    try {
        const project = createLegacyProject();
        const count1 = SchemaMigrator.migrateToV4(project);
        const snapshot = JSON.stringify(project);

        const count2 = SchemaMigrator.migrateToV4(project);
        const snapshot2 = JSON.stringify(project);

        const ok = count1 > 0 && count2 === 0 && snapshot === snapshot2;
        addResult('Phase1: Idempotenz (2. Aufruf = 0 Änderungen)', ok,
            `1. Durchlauf: ${count1} migriert, 2. Durchlauf: ${count2} migriert, JSON identisch: ${snapshot === snapshot2}`);
    } catch (e: any) {
        addResult('Phase1: Idempotenz (2. Aufruf = 0 Änderungen)', false, `Exception: ${e.message}`);
    }

    // ===================================================================
    // Test 5: Leeres/null Projekt → keine Exception
    // ===================================================================
    try {
        const count1 = SchemaMigrator.migrateToV4(null);
        const count2 = SchemaMigrator.migrateToV4({});
        const count3 = SchemaMigrator.migrateToV4({ actions: [], stages: [] });

        const ok = count1 === 0 && count2 === 0 && count3 === 0;
        addResult('Phase1: Leeres Projekt → keine Exception', ok,
            `null=${count1}, empty=${count2}, minimal=${count3}`);
    } catch (e: any) {
        addResult('Phase1: Leeres Projekt → keine Exception', false, `Exception: ${e.message}`);
    }

    // ===================================================================
    // Test 6: FlowChart-Elemente data werden migriert
    // ===================================================================
    try {
        const project = createLegacyProject();
        SchemaMigrator.migrateToV4(project);

        const flowNode = project.stages[0].flowCharts.TestTask.elements[0].data;
        const ok = flowNode.type === 'animate' && flowNode.actionType === undefined
                && flowNode.formula === 'shake' && flowNode.expression === undefined
                && flowNode.method === 'play' && flowNode.methodName === undefined;

        addResult('Phase1: FlowChart node.data migriert', ok,
            `type=${flowNode.type}, formula=${flowNode.formula}, method=${flowNode.method}`);
    } catch (e: any) {
        addResult('Phase1: FlowChart node.data migriert', false, `Exception: ${e.message}`);
    }

    // ===================================================================
    // Test 7: Stage-Actions werden migriert
    // ===================================================================
    try {
        const project = createLegacyProject();
        SchemaMigrator.migrateToV4(project);

        const stageAction = project.stages[0].actions[0];
        const ok = stageAction.type === 'property' && stageAction.actionType === undefined
                && stageAction.changes?.color === 'red' && stageAction.propertyChanges === undefined;

        addResult('Phase1: Stage-Actions migriert', ok,
            `type=${stageAction.type}, changes.color=${stageAction.changes?.color}`);
    } catch (e: any) {
        addResult('Phase1: Stage-Actions migriert', false, `Exception: ${e.message}`);
    }

    // ===================================================================
    // Test 8: Rückgabewert = Anzahl migrierter Felder
    // ===================================================================
    try {
        const project = createLegacyProject();
        const count = SchemaMigrator.migrateToV4(project);

        // 4 Root-Actions mit je 1-2 Aliase + 1 Stage-Action mit 2 Aliase + 1 FlowNode mit 3 Aliase
        // LegacyPropertyAction: actionType + propertyChanges = 2
        // LegacyVarAction: actionType + variable = 2
        // LegacyServiceAction: actionType + methodName = 2
        // LegacyCalcAction: actionType + expression = 2
        // StageLegacyAction: actionType + propertyChanges = 2
        // FlowNodeLegacy: actionType + expression + methodName = 3
        // Total: 13
        const ok = count === 13;
        addResult('Phase1: Rückgabewert = korrekte Anzahl', ok,
            `count=${count} (erwartet: 13)`);
    } catch (e: any) {
        addResult('Phase1: Rückgabewert = korrekte Anzahl', false, `Exception: ${e.message}`);
    }

    // ===================================================================
    // Phase 2 Tests: applyRegistryDefaults
    // ===================================================================

    // Test 9: Fehlende Defaults werden aus Registry aufgefüllt
    try {
        const project = {
            meta: { name: 'DefaultsTest' },
            schemaVersion: '4.0.0',
            actions: [
                { name: 'AnimAction', type: 'animate', target: 'Sprite1' }
                // 'effect', 'duration', etc. fehlen → sollen aufgefüllt werden
            ],
            stages: []
        };

        // Mock-Registry: simulate animate parameters with defaults
        const mockLookup = (type: string) => {
            if (type === 'animate') return [
                { name: 'effect', defaultValue: 'shake' },
                { name: 'duration', defaultValue: 500 },
                { name: 'targetScale', defaultValue: 2.0 },
                { name: 'target' }  // kein defaultValue → wird ignoriert
            ];
            return null;
        };

        const filled = SchemaMigrator.applyRegistryDefaults(project, mockLookup);
        const a = project.actions[0];

        const ok = filled === 3
                && a.effect === 'shake'
                && a.duration === 500
                && a.targetScale === 2.0
                && a.target === 'Sprite1'; // bereits vorhanden, nicht überschrieben

        addResult('Phase2: Registry-Defaults aufgefüllt', ok,
            `filled=${filled}, effect=${a.effect}, duration=${a.duration}, targetScale=${a.targetScale}, target=${a.target}`);
    } catch (e: any) {
        addResult('Phase2: Registry-Defaults aufgefüllt', false, `Exception: ${e.message}`);
    }

    // Test 10: Bereits vorhandene Werte werden NICHT überschrieben
    try {
        const project = {
            meta: { name: 'NoOverwrite' },
            schemaVersion: '4.0.0',
            actions: [
                { name: 'CustomAnim', type: 'animate', effect: 'explode', duration: 1000 }
            ],
            stages: []
        };

        const mockLookup = (type: string) => {
            if (type === 'animate') return [
                { name: 'effect', defaultValue: 'shake' },
                { name: 'duration', defaultValue: 500 }
            ];
            return null;
        };

        const filled = SchemaMigrator.applyRegistryDefaults(project, mockLookup);
        const a = project.actions[0];

        const ok = filled === 0 && a.effect === 'explode' && a.duration === 1000;
        addResult('Phase2: Vorhandene Werte nicht überschrieben', ok,
            `filled=${filled}, effect=${a.effect}, duration=${a.duration}`);
    } catch (e: any) {
        addResult('Phase2: Vorhandene Werte nicht überschrieben', false, `Exception: ${e.message}`);
    }

    // Test 11: Unbekannter Action-Typ → keine Exception
    try {
        const project = {
            meta: { name: 'Unknown' },
            schemaVersion: '4.0.0',
            actions: [
                { name: 'UnknownAction', type: 'custom_unknown_type' }
            ],
            stages: []
        };

        const mockLookup = (_type: string) => null;
        const filled = SchemaMigrator.applyRegistryDefaults(project, mockLookup);

        const ok = filled === 0;
        addResult('Phase2: Unbekannter Typ → 0 Defaults', ok, `filled=${filled}`);
    } catch (e: any) {
        addResult('Phase2: Unbekannter Typ → 0 Defaults', false, `Exception: ${e.message}`);
    }

    // Test 12: Stage-Actions erhalten ebenfalls Defaults
    try {
        const project = {
            meta: { name: 'StageDefaults' },
            schemaVersion: '4.0.0',
            actions: [],
            stages: [
                {
                    id: 's1', name: 'Stage1', type: 'main',
                    actions: [
                        { name: 'StageAnim', type: 'animate', target: 'Panel1' }
                    ]
                }
            ]
        };

        const mockLookup = (type: string) => {
            if (type === 'animate') return [
                { name: 'effect', defaultValue: 'shake' },
                { name: 'duration', defaultValue: 500 }
            ];
            return null;
        };

        const filled = SchemaMigrator.applyRegistryDefaults(project, mockLookup);
        const a = (project.stages[0] as any).actions[0];

        const ok = filled === 2 && a.effect === 'shake' && a.duration === 500;
        addResult('Phase2: Stage-Actions erhalten Defaults', ok,
            `filled=${filled}, effect=${a.effect}, duration=${a.duration}`);
    } catch (e: any) {
        addResult('Phase2: Stage-Actions erhalten Defaults', false, `Exception: ${e.message}`);
    }

    return results;
}

// Standalone execution
const isMain = import.meta.url.includes(process.argv[1].replace(/\\\\/g, '/')) || process.argv[1].endsWith('schema_migrator.test.ts');
if (isMain) {
    runSchemaMigratorTests().then(results => {
        results.forEach(r => {
            console.log(`${r.passed ? '✅' : '❌'} ${r.name}: ${r.details}`);
        });
        const passed = results.filter(r => r.passed).length;
        console.log(`\n  SchemaMigrator: ${passed} bestanden, ${results.length - passed} fehlgeschlagen`);
        process.exit(results.every(r => r.passed) ? 0 : 1);
    });
}
