import { GameProject } from '../src/model/types';
import { FlowSyncManager } from '../src/editor/services/FlowSyncManager';

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
        results.push({ name, type: 'ActionRegistration', expectedSuccess: true, actualSuccess: passed, passed, details });
    };

    // --- Mock Setup ---
    const project: GameProject = {
        meta: { name: 'Test Project', author: '', version: '1.0.0' },
        stage: { grid: { cols: 10, rows: 10, cellSize: 20, visible: true, snapToGrid: true, backgroundColor: '#ffffff' } },
        objects: [],
        actions: [],
        tasks: [],
        variables: [],
        stages: [
            {
                id: 'main',
                name: 'Main Stage',
                type: 'main',
                objects: [],
                actions: [],
                tasks: [],
                variables: []
            }
        ],
        activeStageId: 'main'
    } as any;

    const mockHost = {
        project: project,
        editor: {
            getTargetActionCollection: (name?: string) => {
                const activeStage = project.stages!.find(s => s.id === project.activeStageId);
                return activeStage?.actions || project.actions;
            }
        }
    };

    const syncManager = new FlowSyncManager(mockHost as any);

    // --- Test 1: Drop/Sync einer neuen Action ---
    try {
        const newActionData = {
            name: 'NewTestBoxAction',
            type: 'property',
            target: 'Box1',
            changes: { visible: false }
        };

        syncManager.updateGlobalActionDefinition(newActionData);

        const activeStage = project.stages!.find(s => s.id === project.activeStageId);
        const registeredAction = activeStage?.actions?.find((a: any) => a.name === 'NewTestBoxAction');

        const ok = !!registeredAction && (registeredAction as any).target === 'Box1';
        addResult('Action-Registrierung beim Drop', ok, registeredAction ? `Action gefunden, Target=${(registeredAction as any).target}` : 'Action nicht in Liste gefunden');
    } catch (e: any) {
        addResult('Action-Registrierung beim Drop', false, `Exception: ${e.message}`);
    }

    // --- Test 2: Global Scope Handling ---
    try {
        const globalActionData = {
            name: 'GlobalAction',
            type: 'event',
            scope: 'global',
            eventName: 'GameStart'
        };

        const mockHostWithGlobal = {
            project: project,
            editor: {
                getTargetActionCollection: (name?: string, action?: any) => {
                    // Simuliert die Logik von EditorStageManager
                    if (globalActionData.scope === 'global') return project.actions;
                    return project.stages![0].actions;
                }
            }
        };
        const managerWithGlobal = new FlowSyncManager(mockHostWithGlobal as any);

        managerWithGlobal.updateGlobalActionDefinition(globalActionData);

        const ok = project.actions.some(a => a.name === 'GlobalAction');
        addResult('Global Scope Handling', ok, ok ? 'In Projekt-Aktionen gefunden' : 'Nicht in Projekt-Aktionen gefunden');
    } catch (e: any) {
        addResult('Global Scope Handling', false, `Exception: ${e.message}`);
    }

    return results;
}
