/**
 * SyncValidator Tests — Prüft die 6 Validierungsregeln
 * 
 * R1: Action-Referenz-Integrität
 * R2: Task-FlowChart-Konsistenz
 * R3: Connection-Validität
 * R4: Property-Sync
 * R5: Duplikat-Erkennung
 * R6: FlowChart-Speicherort
 */

import { SyncValidator, ValidationResult } from '../src/editor/services/SyncValidator';

export interface TestResult {
    name: string;
    type: string;
    expectedSuccess: boolean;
    actualSuccess: boolean;
    passed: boolean;
    details?: string;
}

function createCleanProject(): any {
    return {
        name: 'TestProject',
        tasks: [],
        actions: [
            { name: 'GlobalAction', type: 'action' }
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
                    { name: 'BlueprintTask', actionSequence: [{ type: 'action', name: 'GlobalAction' }] }
                ],
                actions: [
                    { name: 'BlueprintAction', type: 'property' }
                ],
                objects: [],
                variables: [],
                flowCharts: {
                    BlueprintTask: {
                        elements: [
                            { id: 'node-1', type: 'task', data: { name: 'BlueprintTask' }, properties: {} },
                            { id: 'node-2', type: 'action', data: { name: 'GlobalAction', isLinked: true }, properties: {} }
                        ],
                        connections: [
                            { id: 'conn-1', startTargetId: 'node-1', endTargetId: 'node-2', data: { startAnchorType: 'output', endAnchorType: 'input' } }
                        ]
                    }
                }
            },
            {
                id: 'stage_main',
                name: 'MainStage',
                type: 'main',
                tasks: [
                    { name: 'MainTask', actionSequence: [{ type: 'action', name: 'BlueprintAction' }] }
                ],
                actions: [],
                objects: [],
                variables: [],
                flowCharts: {
                    MainTask: {
                        elements: [
                            { id: 'node-a', type: 'task', data: { name: 'MainTask' }, properties: {} }
                        ],
                        connections: []
                    }
                }
            }
        ]
    };
}

export async function runSyncValidatorTests(): Promise<TestResult[]> {
    console.log("🧪 SyncValidator Tests starten...");
    const results: TestResult[] = [];

    const addResult = (name: string, passed: boolean, details?: string) => {
        results.push({
            name,
            type: 'SyncValidator',
            expectedSuccess: true,
            actualSuccess: passed,
            passed,
            details
        });
    };

    const addNegResult = (name: string, passed: boolean, details?: string) => {
        results.push({
            name,
            type: 'SyncValidator',
            expectedSuccess: false,
            actualSuccess: !passed,
            passed: !passed === false, // passed wenn Fehler gefunden wird
            details
        });
    };

    // =========================================================================
    // Gutfall: Sauberes Projekt → 0 Verletzungen
    // =========================================================================
    try {
        const project = createCleanProject();
        const violations = SyncValidator.validate(project, 'BlueprintTask', false);
        const ok = violations.length === 0;
        addResult('R0: Sauberes Projekt → 0 Verletzungen', ok,
            ok ? 'Keine Verletzungen' : `${violations.length} Verletzungen: ${violations.map(v => `[${v.rule}] ${v.message}`).join('; ')}`);
    } catch (e: any) {
        addResult('R0: Sauberes Projekt → 0 Verletzungen', false, `Exception: ${e.message}`);
    }

    // =========================================================================
    // R1: Action-Referenz — Verwaiste Referenz erkennen
    // =========================================================================
    try {
        const project = createCleanProject();
        // Füge verwaiste Referenz hinzu
        project.stages[0].tasks[0].actionSequence.push({ type: 'action', name: 'NichtExistierendeAction' });

        const violations = SyncValidator.validate(project, 'BlueprintTask', false);
        const r1 = violations.filter(v => v.rule === 'R1');
        const ok = r1.length > 0 && r1[0].message.includes('NichtExistierendeAction');
        addResult('R1: Verwaiste Action-Referenz erkennen', ok,
            ok ? `Erkannt: ${r1[0].message}` : `Keine R1-Verletzung gefunden (${violations.length} total)`);
    } catch (e: any) {
        addResult('R1: Verwaiste Action-Referenz erkennen', false, `Exception: ${e.message}`);
    }

    // =========================================================================
    // R1: Auto-Repair — Verwaiste Referenz entfernen
    // =========================================================================
    try {
        const project = createCleanProject();
        project.stages[0].tasks[0].actionSequence.push({ type: 'action', name: 'GeloeschteAction' });
        const beforeCount = project.stages[0].tasks[0].actionSequence.length;

        const violations = SyncValidator.validate(project, 'BlueprintTask', true); // autoRepair=true
        const afterCount = project.stages[0].tasks[0].actionSequence.length;
        const r1 = violations.filter(v => v.rule === 'R1' && v.autoRepaired);

        const ok = r1.length > 0 && afterCount < beforeCount;
        addResult('R1: Auto-Repair entfernt verwaiste Referenz', ok,
            ok ? `Vorher: ${beforeCount}, Nachher: ${afterCount}` : `Kein Repair: before=${beforeCount}, after=${afterCount}`);
    } catch (e: any) {
        addResult('R1: Auto-Repair entfernt verwaiste Referenz', false, `Exception: ${e.message}`);
    }

    // =========================================================================
    // R2: FlowChart ohne Task → erkennen
    // =========================================================================
    try {
        const project = createCleanProject();
        // FlowChart für nicht-existierenden Task
        project.stages[1].flowCharts['PhantomTask'] = { elements: [], connections: [] };

        const violations = SyncValidator.validate(project, 'MainTask', false);
        const r2 = violations.filter(v => v.rule === 'R2');
        const ok = r2.length > 0 && r2[0].message.includes('PhantomTask');
        addResult('R2: FlowChart ohne Task erkennen', ok,
            ok ? `Erkannt: ${r2[0].message}` : `Keine R2-Verletzung`);
    } catch (e: any) {
        addResult('R2: FlowChart ohne Task erkennen', false, `Exception: ${e.message}`);
    }

    // =========================================================================
    // R2: Auto-Repair — Verwaisten FlowChart entfernen
    // =========================================================================
    try {
        const project = createCleanProject();
        project.stages[1].flowCharts['PhantomTask'] = { elements: [], connections: [] };
        const hadKey = !!project.stages[1].flowCharts['PhantomTask'];

        SyncValidator.validate(project, 'MainTask', true);
        const removedKey = !project.stages[1].flowCharts['PhantomTask'];

        const ok = hadKey && removedKey;
        addResult('R2: Auto-Repair entfernt verwaisten FlowChart', ok,
            ok ? 'PhantomTask-Schlüssel entfernt' : 'Schlüssel noch vorhanden');
    } catch (e: any) {
        addResult('R2: Auto-Repair entfernt verwaisten FlowChart', false, `Exception: ${e.message}`);
    }

    // =========================================================================
    // R3: Connection auf nicht-existierenden Node → erkennen
    // =========================================================================
    try {
        const project = createCleanProject();
        // Kaputte Connection
        project.stages[0].flowCharts.BlueprintTask.connections.push({
            id: 'broken-conn', startTargetId: 'non-existent-node', endTargetId: 'node-2',
            data: { startAnchorType: 'output' }
        });

        const violations = SyncValidator.validate(project, 'BlueprintTask', false);
        const r3 = violations.filter(v => v.rule === 'R3');
        const ok = r3.length > 0 && r3[0].message.includes('non-existent-node');
        addResult('R3: Kaputte Connection erkennen', ok,
            ok ? `Erkannt: ${r3[0].message}` : `Keine R3-Verletzung`);
    } catch (e: any) {
        addResult('R3: Kaputte Connection erkennen', false, `Exception: ${e.message}`);
    }

    // =========================================================================
    // R5: Task-Duplikat erkennen
    // =========================================================================
    try {
        const project = createCleanProject();
        // Gleichen Task in zwei Stages
        project.stages[1].tasks.push({ name: 'BlueprintTask', actionSequence: [] });

        const violations = SyncValidator.validate(project, 'MainTask', false);
        const r5 = violations.filter(v => v.rule === 'R5');
        const ok = r5.length > 0 && r5[0].message.includes('BlueprintTask');
        addResult('R5: Task-Duplikat erkennen', ok,
            ok ? `Erkannt: ${r5[0].message}` : `Keine R5-Verletzung`);
    } catch (e: any) {
        addResult('R5: Task-Duplikat erkennen', false, `Exception: ${e.message}`);
    }

    // =========================================================================
    // R6: FlowChart in Root UND Stage → erkennen
    // =========================================================================
    try {
        const project = createCleanProject();
        // FlowChart sowohl in Root als auch in Stage
        project.flowCharts['BlueprintTask'] = { elements: [], connections: [] };

        const violations = SyncValidator.validate(project, 'BlueprintTask', false);
        const r6 = violations.filter(v => v.rule === 'R6');
        const ok = r6.length > 0 && r6[0].message.includes('Split-Brain');
        addResult('R6: FlowChart Split-Brain erkennen', ok,
            ok ? `Erkannt: ${r6[0].message}` : `Keine R6-Verletzung`);
    } catch (e: any) {
        addResult('R6: FlowChart Split-Brain erkennen', false, `Exception: ${e.message}`);
    }

    // =========================================================================
    // R6: Auto-Repair — Root-Eintrag entfernen
    // =========================================================================
    try {
        const project = createCleanProject();
        project.flowCharts['BlueprintTask'] = { elements: [], connections: [] };
        const hadRoot = !!project.flowCharts['BlueprintTask'];

        SyncValidator.validate(project, 'BlueprintTask', true);
        const removedRoot = !project.flowCharts['BlueprintTask'];

        const ok = hadRoot && removedRoot;
        addResult('R6: Auto-Repair entfernt Root-Duplikat', ok,
            ok ? 'Root-FlowChart entfernt, Stage-Version behalten' : 'Root-FlowChart noch vorhanden');
    } catch (e: any) {
        addResult('R6: Auto-Repair entfernt Root-Duplikat', false, `Exception: ${e.message}`);
    }

    // =========================================================================
    // Spot-Validierung: validateSinglePropertySync
    // =========================================================================
    try {
        const project = createCleanProject();
        const mockObject = {
            Name: 'GlobalAction',
            name: 'GlobalAction',
            type: 'action',
            getType: () => 'action',
            data: { type: 'action' }
        };

        const violations = SyncValidator.validateSinglePropertySync(mockObject, 'type', project);
        const ok = violations.length === 0;
        addResult('Spot-Validierung: Konsistentes Objekt → 0 Verletzungen', ok,
            ok ? 'Keine Desync' : `${violations.length} Verletzungen`);
    } catch (e: any) {
        addResult('Spot-Validierung: Konsistentes Objekt → 0 Verletzungen', false, `Exception: ${e.message}`);
    }

    return results;
}

// Standalone execution
const isMain = import.meta.url.includes(process.argv[1].replace(/\\/g, '/')) || process.argv[1].endsWith('sync_validator.test.ts');
if (isMain) {
    runSyncValidatorTests().then(results => {
        results.forEach(r => {
            console.log(`${r.passed ? '✅' : '❌'} ${r.name}: ${r.details}`);
        });
        const allPassed = results.every(r => r.passed);
        console.log(`\n🧪 SyncValidator: ${results.filter(r => r.passed).length}/${results.length} bestanden.`);
        process.exit(allPassed ? 0 : 1);
    });
}
