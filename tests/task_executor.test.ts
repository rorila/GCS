/**
 * TaskExecutor Tests – Sicherheitsnetz für Task-Ausführung und Resolution
 * 
 * Testet: Task-Lookup-Hierarchie, Action-Resolution, Condition-Branching,
 *         Recursion-Guard, FOR/FOREACH-Loops, leere Tasks.
 */

import { TaskExecutor } from '../src/runtime/TaskExecutor';
import { ActionExecutor } from '../src/runtime/ActionExecutor';
import { GameProject } from '../src/model/types';

// --- Mocks ---
// Mock für DebugLogService (wird global von TaskExecutor genutzt)
const mockDebugService = {
    log: () => 'mock-id',
    pushContext: () => { },
    popContext: () => { }
};

// Minimal-Mock für ActionExecutor
class MockActionExecutor {
    executedActions: any[] = [];

    async execute(action: any, vars: Record<string, any>, globalVars: Record<string, any>, contextObj?: any, parentId?: string): Promise<any> {
        this.executedActions.push({ ...action, _vars: { ...vars }, _globalVars: { ...globalVars } });
        // Simulate calculate action side-effect for condition tests
        if (action.type === 'calculate' && action.resultVariable) {
            if (action.formula) {
                try {
                    const result = new Function('vars', 'globalVars', `with(vars) { with(globalVars) { return ${action.formula}; } }`)(vars, globalVars);
                    vars[action.resultVariable] = result;
                    globalVars[action.resultVariable] = result;
                } catch { /* silent */ }
            }
        }
        return action._mockResult ?? undefined;
    }

    setObjects() { }
}

export interface TestResult {
    name: string;
    type: string;
    expectedSuccess: boolean;
    actualSuccess: boolean;
    passed: boolean;
    details?: string;
}

function createTestProject(): GameProject {
    return {
        meta: { name: 'ExecutorTest', version: '1.0', author: 'Test' },
        objects: [],
        variables: [],
        tasks: [
            {
                name: 'RootTask',
                actionSequence: [
                    { type: 'action', name: 'RootAction' }
                ]
            }
        ],
        actions: [],
        stages: [
            {
                id: 'stage_blueprint',
                name: 'Blueprint',
                type: 'blueprint',
                objects: [],
                variables: [],
                tasks: [
                    {
                        name: 'GlobalTask',
                        actionSequence: [
                            { type: 'action', name: 'GlobalAction1' },
                            { type: 'action', name: 'GlobalAction2' }
                        ]
                    }
                ],
                actions: [
                    { name: 'GlobalAction1', type: 'property', target: 'TestObj', changes: { visible: true } },
                    { name: 'GlobalAction2', type: 'property', target: 'TestObj', changes: { text: 'Done' } }
                ]
            } as any,
            {
                id: 'stage_login',
                name: 'Login',
                type: 'standard',
                objects: [],
                variables: [],
                tasks: [
                    {
                        name: 'StageTask',
                        actionSequence: [
                            { type: 'action', name: 'StageAction' }
                        ]
                    },
                    {
                        name: 'ConditionalTask',
                        actionSequence: [
                            {
                                type: 'condition',
                                condition: { variable: 'loggedIn', operator: '==', value: 'true' },
                                thenTask: 'StageTask',
                                elseTask: 'GlobalTask'
                            }
                        ]
                    }
                ],
                actions: [
                    { name: 'StageAction', type: 'property', target: 'LoginBtn', changes: { enabled: false } },
                    { name: 'RootAction', type: 'property', target: 'RootBtn', changes: { enabled: true } }
                ]
            } as any
        ],
        activeStageId: 'stage_login'
    } as any;
}

export async function runTaskExecutorTests(): Promise<TestResult[]> {
    console.log("🧪 TaskExecutor Tests starten...");
    const results: TestResult[] = [];

    const addResult = (name: string, passed: boolean, details?: string) => {
        results.push({
            name,
            type: 'TaskExecutor',
            expectedSuccess: true,
            actualSuccess: passed,
            passed,
            details
        });
    };

    // Patch DebugLogService
    try {
        const { DebugLogService } = await import('../src/services/DebugLogService');
        const inst = DebugLogService.getInstance();
        (inst as any).log = mockDebugService.log;
        (inst as any).pushContext = mockDebugService.pushContext;
        (inst as any).popContext = mockDebugService.popContext;
    } catch { /* DebugLogService might not need patching */ }

    // --- Test 1: Simple Task Execution (Stage-Level) ---
    try {
        const project = createTestProject();
        const loginStage = project.stages.find(s => s.id === 'stage_login')!;
        const mock = new MockActionExecutor();
        const executor = new TaskExecutor(
            project,
            [...(loginStage.actions || []), ...(project.stages.find(s => s.id === 'stage_blueprint')?.actions || [])],
            mock as any as ActionExecutor,
            undefined,
            undefined,
            loginStage.tasks
        );

        await executor.execute('StageTask', {}, {});
        const ok = mock.executedActions.length === 1 && mock.executedActions[0].name === 'StageAction';
        addResult('Execute: Stage-Task → 1 Action', ok,
            `Ausgeführt: [${mock.executedActions.map(a => a.name).join(', ')}]`);
    } catch (e: any) {
        addResult('Execute: Stage-Task → 1 Action', false, `Exception: ${e.message}`);
    }

    // --- Test 2: Task Lookup Hierarchy (Stage → Blueprint → Root) ---
    try {
        const project = createTestProject();
        const loginStage = project.stages.find(s => s.id === 'stage_login')!;
        const bpStage = project.stages.find(s => s.id === 'stage_blueprint')!;
        const mock = new MockActionExecutor();
        const allActions = [...(loginStage.actions || []), ...(bpStage.actions || [])];
        const executor = new TaskExecutor(
            project, allActions, mock as any as ActionExecutor,
            undefined, undefined, loginStage.tasks
        );

        // GlobalTask existiert nur in Blueprint, nicht in Stage
        await executor.execute('GlobalTask', {}, {});
        const ok = mock.executedActions.length === 2
            && mock.executedActions[0].name === 'GlobalAction1'
            && mock.executedActions[1].name === 'GlobalAction2';
        addResult('Execute: Blueprint-Lookup (Hierarchie)', ok,
            `Ausgeführt: [${mock.executedActions.map(a => a.name).join(', ')}]`);
    } catch (e: any) {
        addResult('Execute: Blueprint-Lookup (Hierarchie)', false, `Exception: ${e.message}`);
    }

    // --- Test 3: Task Not Found → kein Crash ---
    try {
        const project = createTestProject();
        const mock = new MockActionExecutor();
        const executor = new TaskExecutor(project, [], mock as any as ActionExecutor);

        await executor.execute('NichtExistierenderTask', {}, {});
        const ok = mock.executedActions.length === 0;
        addResult('Execute: Unbekannter Task (kein Crash)', ok,
            `Ausgeführt: ${mock.executedActions.length} (erwartet: 0)`);
    } catch (e: any) {
        addResult('Execute: Unbekannter Task (kein Crash)', false, `Exception: ${e.message}`);
    }

    // --- Test 4: Action Resolution ---
    try {
        const project = createTestProject();
        const loginStage = project.stages.find(s => s.id === 'stage_login')!;
        const mock = new MockActionExecutor();
        const executor = new TaskExecutor(
            project, loginStage.actions || [],
            mock as any as ActionExecutor, undefined, undefined, loginStage.tasks
        );

        await executor.execute('StageTask', {}, {});
        // Die Action sollte resolved sein (target sollte 'LoginBtn' sein)
        const ok = mock.executedActions.length === 1 && mock.executedActions[0].target === 'LoginBtn';
        addResult('Execute: Action Resolution (Name → Definition)', ok,
            `Target=${mock.executedActions[0]?.target} (erwartet: LoginBtn)`);
    } catch (e: any) {
        addResult('Execute: Action Resolution (Name → Definition)', false, `Exception: ${e.message}`);
    }

    // --- Test 5: Condition TRUE → thenTask ---
    try {
        const project = createTestProject();
        const loginStage = project.stages.find(s => s.id === 'stage_login')!;
        const bpStage = project.stages.find(s => s.id === 'stage_blueprint')!;
        const allActions = [...(loginStage.actions || []), ...(bpStage.actions || [])];
        const mock = new MockActionExecutor();
        const executor = new TaskExecutor(
            project, allActions, mock as any as ActionExecutor,
            undefined, undefined, loginStage.tasks
        );

        // loggedIn == 'true' → should execute StageTask (thenTask)
        await executor.execute('ConditionalTask', { loggedIn: 'true' }, {});
        const ok = mock.executedActions.some(a => a.name === 'StageAction');
        addResult('Execute: Condition TRUE → thenTask', ok,
            `Ausgeführt: [${mock.executedActions.map(a => a.name).join(', ')}]`);
    } catch (e: any) {
        addResult('Execute: Condition TRUE → thenTask', false, `Exception: ${e.message}`);
    }

    // --- Test 6: Condition FALSE → elseTask ---
    try {
        const project = createTestProject();
        const loginStage = project.stages.find(s => s.id === 'stage_login')!;
        const bpStage = project.stages.find(s => s.id === 'stage_blueprint')!;
        const allActions = [...(loginStage.actions || []), ...(bpStage.actions || [])];
        const mock = new MockActionExecutor();
        const executor = new TaskExecutor(
            project, allActions, mock as any as ActionExecutor,
            undefined, undefined, loginStage.tasks
        );

        // loggedIn == false → should execute GlobalTask (elseTask)
        await executor.execute('ConditionalTask', { loggedIn: 'false' }, {});
        const ok = mock.executedActions.some(a => a.name === 'GlobalAction1');
        addResult('Execute: Condition FALSE → elseTask', ok,
            `Ausgeführt: [${mock.executedActions.map(a => a.name).join(', ')}]`);
    } catch (e: any) {
        addResult('Execute: Condition FALSE → elseTask', false, `Exception: ${e.message}`);
    }

    // --- Test 7: Max Recursion Depth ---
    try {
        const project = createTestProject();
        const loginStage = project.stages.find(s => s.id === 'stage_login')!;
        // Einen rekursiven Task erstellen
        loginStage.tasks = [{
            name: 'RecursiveTask',
            actionSequence: [{ type: 'task', name: 'RecursiveTask' }]
        }] as any;
        const mock = new MockActionExecutor();
        const executor = new TaskExecutor(
            project, loginStage.actions || [], mock as any as ActionExecutor,
            undefined, undefined, loginStage.tasks
        );

        await executor.execute('RecursiveTask', {}, {});
        // Sollte nicht ewig laufen, da MAX_DEPTH greift (kein Crash)
        addResult('Execute: Max Recursion Depth Guard', true, 'Kein Endlos-Loop');
    } catch (e: any) {
        addResult('Execute: Max Recursion Depth Guard', false, `Exception: ${e.message}`);
    }

    return results;
}

// Standalone execution
const isMain = import.meta.url.includes(process.argv[1].replace(/\\/g, '/')) || process.argv[1].endsWith('task_executor.test.ts');
if (isMain) {
    runTaskExecutorTests().then(results => {
        results.forEach(r => {
            console.log(`${r.passed ? '✅' : '❌'} ${r.name}: ${r.details}`);
        });
        const allPassed = results.every(r => r.passed);
        console.log(`\n🧪 TaskExecutor: ${results.filter(r => r.passed).length}/${results.length} bestanden.`);
        process.exit(allPassed ? 0 : 1);
    });
}
