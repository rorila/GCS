/**
 * SYNC_REFACTOR Phase 0 — Layer A: Unit Reducer Tests
 * 
 * Testet die `ProjectStore.dispatch({type:'SET_PROPERTY',...})` Pfade
 * um sicherzustellen, dass Mutationen exakt eine Stelle betreffen.
 * 
 * @since Phase 0 / SYNC_REFACTOR_PLAN §5
 */

import { ProjectStore, ProjectMutation } from '../../src/services/ProjectStore';
import { PropertyHelper } from '../../src/runtime/PropertyHelper';

export interface TestResult {
    name: string;
    type: string;
    expectedSuccess: boolean;
    actualSuccess: boolean;
    passed: boolean;
    details?: string;
}

/**
 * Erzeugt eine frische ProjectStore-Instanz mit einem Minimal-Projekt.
 * Wir umgehen den Singleton, indem wir direkt setProject aufrufen.
 */
function setupStore(): { store: ProjectStore; project: any } {
    const store = ProjectStore.getInstance();
    const project = {
        meta: { name: 'SyncTest', version: '1.0', author: 'Test' },
        objects: [],
        variables: [],
        tasks: [],
        actions: [
            { name: 'TestAction', type: 'property', target: 'MySprite', changes: { visible: true } }
        ],
        stages: [
            {
                id: 'stage_main',
                name: 'Main',
                type: 'main',
                objects: [
                    { id: 'obj_1', name: 'MySprite', className: 'TSprite', x: 10, y: 20, width: 5, height: 5, style: { textAlign: 'center', backgroundColor: '#ff0000' } }
                ],
                variables: [],
                tasks: [
                    { name: 'MainTask', actionSequence: [{ type: 'action', name: 'TestAction' }] }
                ],
                actions: [
                    { name: 'StageAction', type: 'variable', variableName: 'score', value: 42 }
                ],
                flowCharts: {}
            }
        ]
    };
    store.setProject(project as any);
    return { store, project };
}

export async function runStoreSetPropertyTests(): Promise<TestResult[]> {
    console.log("🧪 Store SET_PROPERTY Tests starten...");
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
    // Test 1: SET_PROPERTY mutiert exakt das Ziel-Objekt
    // ===================================================================
    try {
        const { store, project } = setupStore();
        const targetObj = project.stages[0].objects[0];
        const oldX = targetObj.x;

        const success = store.dispatch({
            type: 'SET_PROPERTY',
            target: targetObj,
            path: 'x',
            value: 99
        });

        const ok = success && targetObj.x === 99 && oldX === 10;
        addResult('LayerA: SET_PROPERTY mutiert Ziel-Objekt', ok,
            `x: ${oldX} → ${targetObj.x}, dispatch=${success}`);
    } catch (e: any) {
        addResult('LayerA: SET_PROPERTY mutiert Ziel-Objekt', false, `Exception: ${e.message}`);
    }

    // ===================================================================
    // Test 2: SET_PROPERTY mit Dot-Path (z.B. style.textAlign)
    // ===================================================================
    try {
        const { store, project } = setupStore();
        const targetObj = project.stages[0].objects[0];

        const success = store.dispatch({
            type: 'SET_PROPERTY',
            target: targetObj,
            path: 'style.textAlign',
            value: 'right'
        });

        const actual = targetObj.style?.textAlign;
        const ok = success && actual === 'right';
        addResult('LayerA: SET_PROPERTY mit Dot-Path (style.textAlign)', ok,
            `style.textAlign=${actual}, dispatch=${success}`);
    } catch (e: any) {
        addResult('LayerA: SET_PROPERTY mit Dot-Path (style.textAlign)', false, `Exception: ${e.message}`);
    }

    // ===================================================================
    // Test 3: SET_PROPERTY ohne Projekt → gibt false zurück
    // ===================================================================
    try {
        const store = ProjectStore.getInstance();
        // Sicher die interne Projekt-Referenz auf null setzen (Sanitization umgehen)
        (store as any).project = null;

        const success = store.dispatch({
            type: 'SET_PROPERTY',
            target: {},
            path: 'x',
            value: 42
        });

        const ok = success === false;
        addResult('LayerA: SET_PROPERTY ohne Projekt → false', ok,
            `dispatch=${success}`);

        // Restore
        setupStore();
    } catch (e: any) {
        addResult('LayerA: SET_PROPERTY ohne Projekt → false', false, `Exception: ${e.message}`);
    }

    // ===================================================================
    // Test 4: Listener wird nach erfolgreicher Mutation aufgerufen
    // ===================================================================
    try {
        const { store, project } = setupStore();
        const targetObj = project.stages[0].objects[0];
        let listenerCalled = false;
        let receivedMutation: ProjectMutation | null = null;

        const unsubscribe = store.onChange((mutation) => {
            listenerCalled = true;
            receivedMutation = mutation;
        });

        store.dispatch({
            type: 'SET_PROPERTY',
            target: targetObj,
            path: 'y',
            value: 77
        });

        unsubscribe();

        const ok = listenerCalled &&
                   receivedMutation !== null &&
                   (receivedMutation as any).type === 'SET_PROPERTY' &&
                   (receivedMutation as any).path === 'y' &&
                   (receivedMutation as any).value === 77;
        addResult('LayerA: Listener wird nach Mutation aufgerufen', ok,
            `listenerCalled=${listenerCalled}, mutation.path=${(receivedMutation as any)?.path}`);
    } catch (e: any) {
        addResult('LayerA: Listener wird nach Mutation aufgerufen', false, `Exception: ${e.message}`);
    }

    // ===================================================================
    // Test 5: SET_PROPERTY auf Action-Definition (direkt)
    // ===================================================================
    try {
        const { store, project } = setupStore();
        const actionDef = project.actions[0]; // TestAction

        const success = store.dispatch({
            type: 'SET_PROPERTY',
            target: actionDef,
            path: 'type',
            value: 'navigate'
        });

        const ok = success && actionDef.type === 'navigate';
        addResult('LayerA: SET_PROPERTY auf Action-Definition', ok,
            `type=${actionDef.type}, dispatch=${success}`);
    } catch (e: any) {
        addResult('LayerA: SET_PROPERTY auf Action-Definition', false, `Exception: ${e.message}`);
    }

    // ===================================================================
    // Test 6: SET_PROPERTY verändert NUR das Ziel, nicht andere Objekte
    // ===================================================================
    try {
        const { store, project } = setupStore();
        const targetObj = project.stages[0].objects[0];
        const actionDef = project.actions[0];
        const originalActionType = actionDef.type;

        store.dispatch({
            type: 'SET_PROPERTY',
            target: targetObj,
            path: 'x',
            value: 42
        });

        const ok = targetObj.x === 42 && actionDef.type === originalActionType;
        addResult('LayerA: SET_PROPERTY Isolation — andere Objekte unverändert', ok,
            `target.x=${targetObj.x}, action.type=${actionDef.type} (unverändert: ${originalActionType})`);
    } catch (e: any) {
        addResult('LayerA: SET_PROPERTY Isolation — andere Objekte unverändert', false, `Exception: ${e.message}`);
    }

    return results;
}

// Standalone execution
const isMain = import.meta.url.includes(process.argv[1].replace(/\\\\/g, '/')) || process.argv[1].endsWith('store_set_property.test.ts');
if (isMain) {
    runStoreSetPropertyTests().then(results => {
        results.forEach(r => {
            console.log(`${r.passed ? '✅' : '❌'} ${r.name}: ${r.details}`);
        });
        const passed = results.filter(r => r.passed).length;
        console.log(`\n  Store SET_PROPERTY: ${passed} bestanden, ${results.length - passed} fehlgeschlagen`);
        process.exit(results.every(r => r.passed) ? 0 : 1);
    });
}
