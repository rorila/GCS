import { GameProject } from '../src/model/types';
import { FlowSyncManager } from '../src/editor/services/FlowSyncManager';
import { ActionRefactoringService } from '../src/editor/refactoring/ActionRefactoringService';

export interface TestResult {
    name: string;
    type: string;
    expectedSuccess: boolean;
    actualSuccess: boolean;
    passed: boolean;
    details?: string;
}

export async function runTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const addResult = (name: string, passed: boolean, details?: string) => {
        results.push({ name, type: 'ActionCRUD', expectedSuccess: true, actualSuccess: passed, passed, details });
    };

    // --- Mock Setup ---
    const project: GameProject = {
        meta: { name: 'CRUD Test Project', author: '', version: '1.0.0' },
        stage: { grid: { cols: 10, rows: 10, cellSize: 20, visible: true, snapToGrid: true, backgroundColor: '#ffffff' } },
        objects: [],
        actions: [],
        tasks: [
            {
                name: 'TestTask',
                actionSequence: [
                    { type: 'action', name: 'OriginalAction' }
                ]
            }
        ],
        variables: [],
        stages: [
            {
                id: 'blueprint',
                name: 'Blueprint (Global)',
                type: 'blueprint',
                objects: [],
                actions: [],
                tasks: [],
                variables: [],
                flowCharts: {}
            },
            {
                id: 'stage_1',
                name: 'Stage 1',
                type: 'standard',
                objects: [],
                actions: [],
                tasks: [],
                variables: [],
                flowCharts: {
                    'TestTask': {
                        elements: [
                            { id: 'node1', type: 'Action', data: { name: 'OriginalAction' }, properties: { name: 'OriginalAction' } }
                        ],
                        connections: []
                    }
                }
            }
        ],
        activeStageId: 'stage_1'
    } as any;

    const blueprintStage = project.stages![0];

    const mockHost = {
        project: project,
        getActiveStage: () => project.stages![1],
        getTargetActionCollection: (name?: string) => blueprintStage.actions,
        updateFlowSelector: () => { },
        onProjectChange: () => { }
    };

    const syncManager = new FlowSyncManager(mockHost as any);

    // --- 1. CREATE Test ---
    try {
        const createData = {
            name: 'NewAction',
            type: 'property',
            target: 'AnyObject',
            changes: { visible: true }
        };
        syncManager.updateGlobalActionDefinition(createData);

        const created = blueprintStage.actions.find(a => a.name === 'NewAction');
        const ok = !!created && (created as any).target === 'AnyObject';
        addResult('Action Create', ok, ok ? 'Action erfolgreich in Blueprint-Stage erstellt.' : 'Action wurde nicht erstellt.');
    } catch (e: any) {
        addResult('Action Create', false, `Fehler: ${e.message}`);
    }

    // --- 2. READ Test ---
    try {
        const action = blueprintStage.actions.find(a => a.name === 'NewAction');
        const ok = !!action && action.type === 'property';
        addResult('Action Read', ok, ok ? 'Action-Eigenschaften korrekt gelesen.' : 'Action konnte nicht korrekt gelesen werden.');
    } catch (e: any) {
        addResult('Action Read', false, `Fehler: ${e.message}`);
    }

    // --- 3. UPDATE (Rename/Refactoring) Test ---
    try {
        // Wir benennen 'OriginalAction' in 'RenamedAction' um
        ActionRefactoringService.renameAction(project, 'OriginalAction', 'RenamedAction');

        // Check in Tasks
        const taskMatch = project.tasks[0].actionSequence.some((item: any) => item.name === 'RenamedAction');
        // Check in FlowCharts
        const flowMatch = project.stages![1].flowCharts!['TestTask'].elements.some((el: any) => el.data.name === 'RenamedAction');

        const ok = taskMatch && flowMatch;
        addResult('Action Update (Rename)', ok, ok ? 'Refactoring erfolgreich: Task & FlowChart aktualisiert.' : `Fehler: TaskMatch=${taskMatch}, FlowMatch=${flowMatch}`);
    } catch (e: any) {
        addResult('Action Update (Rename)', false, `Fehler: ${e.message}`);
    }

    // --- 4. DELETE Test ---
    try {
        // Lösche die neu erstellte 'NewAction' (Typ: property/action)
        ActionRefactoringService.deleteAction(project, 'NewAction');
        const existsAfterDelete = blueprintStage.actions!.some(a => a.name === 'NewAction');

        // Teste Löschung einer DataAction (Bugfix-Verifizierung)
        const dataActionName = 'DataActionToDelete';
        const stage = project.stages![1];
        stage.flowCharts!['TestTask'].elements.push({
            id: 'node_data',
            type: 'DataAction',
            data: { name: dataActionName },
            properties: { name: dataActionName }
        } as any);

        ActionRefactoringService.deleteAction(project, dataActionName);
        const dataActionExists = stage.flowCharts!['TestTask'].elements.some((el: any) =>
            (el.data?.name === dataActionName || el.properties?.name === dataActionName)
        );

        // Teste Löschung einer normalen Action im FlowChart (Zusatz-Verifizierung für User)
        const normalActionName = 'NormalActionToDelete';
        stage.flowCharts!['TestTask'].elements.push({
            id: 'node_normal',
            type: 'Action',
            data: { name: normalActionName },
            properties: { name: normalActionName }
        } as any);

        ActionRefactoringService.deleteAction(project, normalActionName);
        const normalActionExists = stage.flowCharts!['TestTask'].elements.some((el: any) =>
            (el.data?.name === normalActionName || el.properties?.name === normalActionName)
        );

        // Lösche 'RenamedAction' und prüfe, ob sie aus Tasks verschwindet
        ActionRefactoringService.deleteAction(project, 'RenamedAction');
        const taskExists = project.tasks[0].actionSequence.some((item: any) => item.name === 'RenamedAction');

        const ok = !existsAfterDelete && !taskExists && !dataActionExists && !normalActionExists;
        addResult('Action Delete', ok, ok ? 'Aktion (Normal & Data) restlos entfernt.' : `Fehler: existsAfterDelete=${existsAfterDelete}, taskExists=${taskExists}, dataActionExists=${dataActionExists}, normalActionExists=${normalActionExists}`);
    } catch (e: any) {
        addResult('Action Delete', false, `Fehler: ${e.message}`);
    }

    return results;
}
