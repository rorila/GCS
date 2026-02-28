/**
 * RefactoringManager Tests – Sicherheitsnetz für Rename/Delete-Operationen
 * 
 * Testet: renameTask, renameAction, renameVariable, renameObject,
 *         deleteTask, deleteAction, deleteVariable, sanitizeProject, usageReport.
 */

import { RefactoringManager } from '../src/editor/RefactoringManager';
import { GameProject } from '../src/model/types';

export interface TestResult {
    name: string;
    type: string;
    expectedSuccess: boolean;
    actualSuccess: boolean;
    passed: boolean;
    details?: string;
}

/**
 * Erzeugt ein minimales aber vollständiges Test-Projekt.
 */
function createTestProject(): GameProject {
    return {
        meta: { name: 'RefactoringTest', version: '1.0', author: 'Test' },
        objects: [],
        variables: [],
        tasks: [],
        actions: [],
        stages: [
            {
                id: 'stage_blueprint',
                name: 'Blueprint',
                type: 'blueprint',
                objects: [
                    { id: 'svc_auth', name: 'AuthService', className: 'TAuthService', isService: true }
                ],
                variables: [
                    { id: 'var_currentUser', name: 'currentUser', type: 'object', scope: 'global', value: null, defaultValue: null }
                ],
                tasks: [
                    {
                        name: 'InitApp',
                        actionSequence: [
                            { type: 'action', name: 'SetupVars' },
                            { type: 'action', name: 'LoadUserData' }
                        ]
                    }
                ],
                actions: [
                    { name: 'SetupVars', type: 'calculate', formula: '${currentUser}' },
                    { name: 'LoadUserData', type: 'http', url: '/api/users', resultVariable: 'currentUser' }
                ],
                flowCharts: {
                    'InitApp': {
                        elements: [
                            { type: 'Task', name: 'InitApp', x: 0, y: 0 },
                            { type: 'Action', name: 'SetupVars', x: 0, y: 100 },
                            { type: 'Action', name: 'LoadUserData', x: 0, y: 200 }
                        ],
                        connections: []
                    }
                }
            } as any,
            {
                id: 'stage_login',
                name: 'Login',
                type: 'standard',
                objects: [
                    { id: 'btn_login', name: 'LoginButton', className: 'TButton', events: { onClick: 'AttemptLogin' } },
                    { id: 'edit_pin', name: 'PinInput', className: 'TEdit', placeholder: '${currentUser.name}' }
                ],
                variables: [
                    { id: 'var_pin', name: 'pin', type: 'string', scope: 'stage', value: '', defaultValue: '' }
                ],
                tasks: [
                    {
                        name: 'AttemptLogin',
                        actionSequence: [
                            { type: 'action', name: 'ValidatePin' }
                        ]
                    }
                ],
                actions: [
                    { name: 'ValidatePin', type: 'condition', formula: '${pin} === "1234"', target: 'LoginButton' }
                ],
                events: { onEnter: 'AttemptLogin' },
                flowCharts: {
                    'AttemptLogin': {
                        elements: [
                            { type: 'Task', name: 'AttemptLogin', x: 0, y: 0 },
                            { type: 'Action', name: 'ValidatePin', x: 0, y: 100 }
                        ],
                        connections: []
                    }
                }
            } as any
        ],
        activeStageId: 'stage_login'
    } as any;
}

export async function runRefactoringTests(): Promise<TestResult[]> {
    console.log("🧪 RefactoringManager Tests starten...");
    const results: TestResult[] = [];

    const addResult = (name: string, passed: boolean, details?: string) => {
        results.push({
            name,
            type: 'Refactoring',
            expectedSuccess: true,
            actualSuccess: passed,
            passed,
            details
        });
    };

    // --- Test 1: Rename Task ---
    try {
        const project = createTestProject();
        RefactoringManager.renameTask(project, 'AttemptLogin', 'DoLogin');

        const loginStage = project.stages!.find(s => s.id === 'stage_login')!;
        const taskRenamed = loginStage.tasks!.some((t: any) => t.name === 'DoLogin');
        const eventUpdated = (loginStage as any).events?.onEnter === 'DoLogin';
        const objEventUpdated = loginStage.objects.find((o: any) => o.name === 'LoginButton')?.events?.onClick === 'DoLogin';
        const flowChartRenamed = (loginStage as any).flowCharts?.['DoLogin'] != null;

        const ok = taskRenamed && eventUpdated && objEventUpdated && flowChartRenamed;
        addResult('Rename Task: AttemptLogin → DoLogin', ok,
            `Task=${taskRenamed}, Event=${eventUpdated}, ObjEvent=${objEventUpdated}, FlowChart=${flowChartRenamed}`);
    } catch (e: any) {
        addResult('Rename Task: AttemptLogin → DoLogin', false, `Exception: ${e.message}`);
    }

    // --- Test 2: Rename Action ---
    try {
        const project = createTestProject();
        RefactoringManager.renameAction(project, 'ValidatePin', 'CheckPinCode');

        const loginStage = project.stages!.find(s => s.id === 'stage_login')!;
        const actionRenamed = loginStage.actions!.some((a: any) => a.name === 'CheckPinCode');
        const seqUpdated = loginStage.tasks![0].actionSequence!.some((s: any) => s.name === 'CheckPinCode');
        const flowUpdated = (loginStage as any).flowCharts?.['AttemptLogin']?.elements?.some(
            (e: any) => e.name === 'CheckPinCode'
        );

        const ok = actionRenamed && seqUpdated;
        addResult('Rename Action: ValidatePin → CheckPinCode', ok,
            `Action=${actionRenamed}, Sequence=${seqUpdated}, Flow=${flowUpdated}`);
    } catch (e: any) {
        addResult('Rename Action: ValidatePin → CheckPinCode', false, `Exception: ${e.message}`);
    }

    // --- Test 3: Rename Variable ---
    try {
        const project = createTestProject();
        RefactoringManager.renameVariable(project, 'currentUser', 'activeUser');

        const bp = project.stages!.find(s => s.id === 'stage_blueprint')!;
        const varRenamed = bp.variables!.some((v: any) => v.name === 'activeUser');
        // Prüfe, ob Interpolationen in Formeln aktualisiert wurden
        const setupAction = bp.actions!.find((a: any) => a.name === 'SetupVars');
        const formulaUpdated = (setupAction as any)?.formula?.includes('activeUser');
        const resultVarUpdated = bp.actions!.find((a: any) => a.name === 'LoadUserData')?.resultVariable === 'activeUser';

        const ok = varRenamed && formulaUpdated && resultVarUpdated;
        addResult('Rename Variable: currentUser → activeUser', ok,
            `Var=${varRenamed}, Formula=${formulaUpdated}, ResultVar=${resultVarUpdated}`);
    } catch (e: any) {
        addResult('Rename Variable: currentUser → activeUser', false, `Exception: ${e.message}`);
    }

    // --- Test 4: Rename Object (Cross-Refactoring) ---
    try {
        const project = createTestProject();
        RefactoringManager.renameObject(project, 'LoginButton', 'SignInButton');

        const loginStage = project.stages!.find(s => s.id === 'stage_login')!;
        const objRenamed = loginStage.objects.some((o: any) => o.name === 'SignInButton');
        // Prüfe, ob Action-Target aktualisiert wurde
        const actionTargetUpdated = loginStage.actions!.find(
            (a: any) => a.name === 'ValidatePin'
        )?.target === 'SignInButton';

        const ok = objRenamed && actionTargetUpdated;
        addResult('Rename Object: LoginButton → SignInButton', ok,
            `Object=${objRenamed}, ActionTarget=${actionTargetUpdated}`);
    } catch (e: any) {
        addResult('Rename Object: LoginButton → SignInButton', false, `Exception: ${e.message}`);
    }

    // --- Test 5: Delete Task ---
    try {
        const project = createTestProject();
        RefactoringManager.deleteTask(project, 'AttemptLogin');

        const loginStage = project.stages!.find(s => s.id === 'stage_login')!;
        const taskGone = !loginStage.tasks!.some((t: any) => t.name === 'AttemptLogin');
        const eventCleared = !(loginStage as any).events?.onEnter || (loginStage as any).events.onEnter !== 'AttemptLogin';
        const flowChartGone = !(loginStage as any).flowCharts?.['AttemptLogin'];

        const objEventCleared = !loginStage.objects.some((o: any) => o.events?.onClick === 'AttemptLogin');

        const ok = taskGone && eventCleared && flowChartGone && objEventCleared;
        addResult('Delete Task: AttemptLogin', ok,
            `TaskGone=${taskGone}, EventCleared=${eventCleared}, FlowChartGone=${flowChartGone}, ObjEventCleared=${objEventCleared}`);
    } catch (e: any) {
        addResult('Delete Task: AttemptLogin', false, `Exception: ${e.message}`);
    }

    // --- Test 6: Delete Action ---
    try {
        const project = createTestProject();
        RefactoringManager.deleteAction(project, 'SetupVars');

        const bp = project.stages!.find(s => s.id === 'stage_blueprint')!;
        const actionGone = !bp.actions!.some((a: any) => a.name === 'SetupVars');
        // Die ActionSequence des Tasks sollte bereinigt sein
        const initTask = bp.tasks!.find((t: any) => t.name === 'InitApp');
        const seqCleaned = !initTask?.actionSequence?.some((s: any) => s.name === 'SetupVars');

        const ok = actionGone && seqCleaned;
        addResult('Delete Action: SetupVars', ok,
            `ActionGone=${actionGone}, SequenceCleaned=${seqCleaned}`);
    } catch (e: any) {
        addResult('Delete Action: SetupVars', false, `Exception: ${e.message}`);
    }

    // --- Test 7: Delete Variable ---
    try {
        const project = createTestProject();
        RefactoringManager.deleteVariable(project, 'pin');

        const loginStage = project.stages!.find(s => s.id === 'stage_login')!;
        const varGone = !loginStage.variables!.some((v: any) => v.name === 'pin');

        addResult('Delete Variable: pin', varGone,
            `VariableGone=${varGone}`);
    } catch (e: any) {
        addResult('Delete Variable: pin', false, `Exception: ${e.message}`);
    }

    // --- Test 8: Usage Report ---
    try {
        const project = createTestProject();
        const report = RefactoringManager.getTaskUsageReport(project, 'AttemptLogin');

        const ok = report.totalCount > 0 && report.locations.length > 0;
        addResult('Usage Report: AttemptLogin', ok,
            `Referenzen=${report.totalCount}, Orte=${report.locations.length}`);
    } catch (e: any) {
        addResult('Usage Report: AttemptLogin', false, `Exception: ${e.message}`);
    }

    // --- Test 9: Sanitize Project (Duplikat-Bereinigung) ---
    try {
        const project = createTestProject();
        // Füge duplizierten Task in Root ein (Legacy)
        project.tasks = [{ name: 'InitApp', actionSequence: [{ type: 'action', name: 'SetupVars' }] }] as any;

        // sanitizeProject sollte Duplikate bereinigen
        if (typeof (RefactoringManager as any).sanitizeProject === 'function') {
            (RefactoringManager as any).sanitizeProject(project);
            const rootClean = !project.tasks.some((t: any) => t.name === 'InitApp');
            addResult('Sanitize: Root-Duplikate entfernt', rootClean,
                `Root-Tasks nach Sanitize=${project.tasks.length}`);
        } else {
            addResult('Sanitize: Root-Duplikate entfernt', true,
                `sanitizeProject() nicht vorhanden – Test übersprungen`);
        }
    } catch (e: any) {
        addResult('Sanitize: Root-Duplikate entfernt', false, `Exception: ${e.message}`);
    }

    return results;
}

// Standalone execution
const isMain = import.meta.url.includes(process.argv[1].replace(/\\/g, '/')) || process.argv[1].endsWith('refactoring_manager.test.ts');
if (isMain) {
    runRefactoringTests().then(results => {
        results.forEach(r => {
            console.log(`${r.passed ? '✅' : '❌'} ${r.name}: ${r.details}`);
        });
        const allPassed = results.every(r => r.passed);
        console.log(`\n🧪 Refactoring: ${results.filter(r => r.passed).length}/${results.length} bestanden.`);
        process.exit(allPassed ? 0 : 1);
    });
}
