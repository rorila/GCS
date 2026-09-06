/**
 * TaskExecutor Expansion Tests
 * 
 * Testet fortgeschrittene Szenarien:
 * - Verschachtelte Bedingungen
 * - Loops (FOR, WHILE, FOREACH)
 * - DataAction Verzweigungen
 * - Variable Interpolation (${var})
 * - Body-Sequenzen (thenBody, elseBody)
 */

import { TaskExecutor } from '../src/runtime/TaskExecutor';
import { ActionExecutor } from '../src/runtime/ActionExecutor';
import { GameProject } from '../src/model/types';

// --- Mocks ---
class MockActionExecutor {
    executedActions: any[] = [];

    async execute(action: any, vars: Record<string, any>, globalVars: Record<string, any>, contextObj?: any, parentId?: string): Promise<any> {
        // Clone action and interpolate changes locally for the test
        const interp = (val: any) => {
            if (typeof val !== 'string') return val;
            return val.replace(/\$\{(.+?)\}/g, (_, g) => {
                const parts = g.split('.');
                let current: any = vars;
                for (const p of parts) {
                    if (current && current[p] !== undefined) current = current[p];
                    else return globalVars[g] ?? `\${${g}}`;
                }
                return String(current);
            })
                .replace(/\$(\w+)/g, (_, g) => vars[g] ?? globalVars[g] ?? `\$${g}`);
        };

        const resolvedAction = { ...action };
        if (resolvedAction.changes) {
            resolvedAction.changes = { ...resolvedAction.changes };
            for (const key in resolvedAction.changes) {
                resolvedAction.changes[key] = interp(resolvedAction.changes[key]);
            }
        }

        this.executedActions.push({ ...resolvedAction, _vars: { ...vars }, _globalVars: { ...globalVars } });

        // Simuliere Erfolg/Fehler für DataActions
        if (action.type === 'data_action' || action.type === 'service') {
            return action.mockSuccess !== false;
        }

        // Simuliere Variablen-Änderungen (z.B. für Loops)
        if (action.type === 'increment' && action.target) {
            vars[action.target] = (vars[action.target] || 0) + 1;
        }

        return undefined;
    }
}

function createComplexProject(): GameProject {
    return {
        meta: { name: 'ComplexTest', version: '1.0', author: 'Test' },
        objects: [],
        variables: [],
        tasks: [],
        actions: [],
        stages: [
            {
                id: 'stage1',
                name: 'Stage 1',
                type: 'standard',
                objects: [],
                variables: [],
                tasks: [
                    {
                        name: 'NestedTask',
                        actionSequence: [
                            {
                                type: 'condition',
                                condition: { variable: 'x', operator: '==', value: '1' },
                                body: [
                                    {
                                        type: 'condition',
                                        condition: { variable: 'y', operator: '==', value: '2' },
                                        thenAction: 'ActionY2',
                                        elseAction: 'ActionYNot2'
                                    }
                                ],
                                elseBody: [
                                    { type: 'action', name: 'ActionXNot1' }
                                ]
                            }
                        ]
                    },
                    {
                        name: 'ForLoopTask',
                        actionSequence: [
                            {
                                type: 'for',
                                iteratorVar: 'i',
                                from: 1,
                                to: 3,
                                body: [{ type: 'action', name: 'LoopAction' }]
                            }
                        ]
                    },
                    {
                        name: 'ForeachTask',
                        actionSequence: [
                            {
                                type: 'foreach',
                                sourceArray: 'items',
                                itemVar: 'current',
                                body: [{ type: 'action', name: 'ItemAction' }]
                            }
                        ]
                    },
                    {
                        name: 'InterpolationTask',
                        actionSequence: [
                            {
                                type: 'action',
                                name: 'ParamAction',
                                params: {
                                    text: 'Val: ${myVar}',
                                    simple: '$anotherVar'
                                }
                            }
                        ]
                    }
                ],
                actions: [
                    { name: 'ActionY2', type: 'property', target: 'T', changes: { val: 'Y2' } },
                    { name: 'ActionYNot2', type: 'property', target: 'T', changes: { val: 'YNot2' } },
                    { name: 'ActionXNot1', type: 'property', target: 'T', changes: { val: 'XNot1' } },
                    { name: 'LoopAction', type: 'property', target: 'T', changes: { step: 1 } },
                    { name: 'ItemAction', type: 'property', target: 'T', changes: { processed: true } },
                    { name: 'ParamAction', type: 'property', target: 'T', changes: { info: '' } }
                ]
            } as any
        ],
        activeStageId: 'stage1'
    } as any;
}

export async function runExpandedTests() {
    console.log("🧪 TaskExecutor Expansion Tests starten...");
    let passedCount = 0;
    let totalCount = 0;

    const assert = (name: string, condition: boolean) => {
        totalCount++;
        if (condition) {
            console.log(`✅ ${name}`);
            passedCount++;
        } else {
            console.error(`❌ ${name}`);
        }
    };

    const project = createComplexProject();
    const stage = project.stages[0];
    const mock = new MockActionExecutor();
    const executor = new TaskExecutor(project, stage.actions, mock as any as ActionExecutor, {}, undefined, stage.tasks);

    // 1. Nested Condition: X=1, Y=2
    mock.executedActions = [];
    await executor.execute('NestedTask', { x: '1', y: '2' }, {});
    assert("Nested Condition (X=1, Y=2) → ActionY2", mock.executedActions.length === 1 && mock.executedActions[0].name === 'ActionY2');

    // 2. Nested Condition: X=1, Y=0
    mock.executedActions = [];
    await executor.execute('NestedTask', { x: '1', y: '0' }, {});
    assert("Nested Condition (X=1, Y=0) → ActionYNot2", mock.executedActions.length === 1 && mock.executedActions[0].name === 'ActionYNot2');

    // 3. Nested Condition: X=0
    mock.executedActions = [];
    await executor.execute('NestedTask', { x: '0' }, {});
    assert("Nested Condition (X=0) → ActionXNot1", mock.executedActions.length === 1 && mock.executedActions[0].name === 'ActionXNot1');

    // 4. For Loop: 1 to 3
    mock.executedActions = [];
    await executor.execute('ForLoopTask', {}, {});
    assert("For Loop (1-3) → 3 Executions", mock.executedActions.length === 3);
    assert("For Loop Context → Iterator i correct", mock.executedActions[0]._vars.i === 1 && mock.executedActions[2]._vars.i === 3);

    // 5. Foreach Loop
    mock.executedActions = [];
    const items = ['A', 'B'];
    await executor.execute('ForeachTask', { items }, {});
    assert("Foreach Loop → 2 Executions", mock.executedActions.length === 2);
    assert("Foreach Context → item 'current' correct", mock.executedActions[0]._vars.current === 'A' && mock.executedActions[1]._vars.current === 'B');

    // 6. Action with Body and Interpolation
    stage.actions.push({
        name: 'BodyAction',
        type: 'calculate',
        body: [
            { type: 'property', target: 'Obj', changes: { text: '${$params.msg}' } }
        ]
    } as any);
    stage.tasks.push({
        name: 'BodyTask',
        actionSequence: [{ type: 'action', name: 'BodyAction', params: { msg: 'TestValue' } }]
    } as any);

    mock.executedActions = [];
    await executor.execute('BodyTask', {}, {});
    const innerAction = mock.executedActions[0];
    assert("Action with Body interpolation → ${$params.msg} resolved", innerAction.changes?.text === 'TestValue');

    console.log(`\n🧪 Ergebnis: ${passedCount}/${totalCount} bestanden.`);
    process.exit(passedCount === totalCount ? 0 : 1);
}

runExpandedTests();
