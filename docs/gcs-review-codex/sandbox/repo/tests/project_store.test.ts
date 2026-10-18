/**
 * ProjectStore Unit-Tests
 * 
 * Testet den zentralen State-Manager:
 * - dispatch SET_PROPERTY
 * - dispatch RENAME_ACTION / RENAME_TASK
 * - dispatch ADD/REMOVE ACTION/TASK/OBJECT
 * - onChange-Listener
 * - Guard gegen verschachtelte dispatches
 * - BATCH-Mutationen
 */

import { ProjectStore } from '../src/services/ProjectStore';

function createTestProject(): any {
    return {
        name: 'TestProject',
        activeStageId: 'stage_main',
        objects: [],
        variables: [],
        actions: [
            { name: 'NavigateToMenu', type: 'navigate_stage', target: 'stage_menu' },
            { name: 'SetScore', type: 'set_property', target: 'Score', changes: { value: 10 } }
        ],
        tasks: [
            {
                name: 'StartGame',
                actionSequence: [
                    { type: 'action', name: 'NavigateToMenu' },
                    { type: 'task', name: 'LoadAssets', thenTask: 'ShowMenu' }
                ]
            },
            {
                name: 'LoadAssets',
                actionSequence: []
            }
        ],
        stages: [
            {
                id: 'stage_main',
                name: 'Main Stage',
                objects: [
                    { id: 'obj_1', name: 'Player', className: 'TSprite', x: 100, y: 200 }
                ],
                actions: [
                    { name: 'StageAction1', type: 'set_property' }
                ],
                tasks: [
                    { name: 'StageTask1', actionSequence: [{ type: 'action', name: 'StageAction1' }] }
                ]
            },
            {
                id: 'stage_menu',
                name: 'Menu Stage',
                objects: [],
                actions: [],
                tasks: []
            }
        ]
    };
}

export function runProjectStoreTests(): void {
    console.log('🧪 ProjectStore Tests starten...');
    let passed = 0;
    let failed = 0;

    function assert(condition: boolean, testName: string): void {
        if (condition) {
            passed++;
        } else {
            failed++;
            console.error(`  ❌ FEHLER: ${testName}`);
        }
    }

    // Frische Instanz für jeden Test
    function freshStore(): ProjectStore {
        const store = ProjectStore.getInstance();
        store.setProject(createTestProject());
        return store;
    }

    // ------------------------------------------------------------------
    // Test 1: SET_PROPERTY
    // ------------------------------------------------------------------
    {
        const store = freshStore();
        const project = store.getProject()!;
        const action = project.actions![0];

        const result = store.dispatch({ type: 'SET_PROPERTY', target: action, path: 'type', value: 'show_message' });
        assert(result === true, 'T1: dispatch SET_PROPERTY gibt true zurück');
        assert(action.type === 'show_message', 'T1: Property wurde korrekt gesetzt');
    }

    // ------------------------------------------------------------------
    // Test 2: RENAME_ACTION
    // ------------------------------------------------------------------
    {
        const store = freshStore();
        const project = store.getProject()!;

        store.dispatch({ type: 'RENAME_ACTION', oldName: 'NavigateToMenu', newName: 'GoToMainMenu' });

        assert(project.actions![0].name === 'GoToMainMenu', 'T2: Action wurde global umbenannt');

        // Referenz in ActionSequence prüfen
        const task = project.tasks![0];
        assert(task.actionSequence[0].name === 'GoToMainMenu', 'T2: ActionSequence-Referenz aktualisiert');
    }

    // ------------------------------------------------------------------
    // Test 3: RENAME_TASK
    // ------------------------------------------------------------------
    {
        const store = freshStore();
        const project = store.getProject()!;

        store.dispatch({ type: 'RENAME_TASK', oldName: 'LoadAssets', newName: 'PrepareAssets' });

        assert(project.tasks![1].name === 'PrepareAssets', 'T3: Task wurde umbenannt');

        // Referenz in ActionSequence prüfen (thenTask)
        const task = project.tasks![0];
        assert(task.actionSequence[1].name === 'PrepareAssets', 'T3: Task-Referenz (type=task) aktualisiert');
    }

    // ------------------------------------------------------------------
    // Test 4: ADD_ACTION / REMOVE_ACTION
    // ------------------------------------------------------------------
    {
        const store = freshStore();
        const project = store.getProject()!;
        const initialCount = project.actions!.length;

        store.dispatch({ type: 'ADD_ACTION', action: { name: 'NewAction', type: 'play_sound' } });
        assert(project.actions!.length === initialCount + 1, 'T4: Action global hinzugefügt');

        store.dispatch({ type: 'REMOVE_ACTION', name: 'NewAction' });
        assert(project.actions!.length === initialCount, 'T4: Action global entfernt');
    }

    // ------------------------------------------------------------------
    // Test 5: ADD_ACTION auf Stage
    // ------------------------------------------------------------------
    {
        const store = freshStore();
        const project = store.getProject()!;
        const stage = project.stages![0];
        const initialCount = stage.actions!.length;

        store.dispatch({ type: 'ADD_ACTION', action: { name: 'StageNewAction', type: 'log' }, stageId: 'stage_main' });
        assert(stage.actions!.length === initialCount + 1, 'T5: Action auf Stage hinzugefügt');
    }

    // ------------------------------------------------------------------
    // Test 6: ADD_TASK / REMOVE_TASK
    // ------------------------------------------------------------------
    {
        const store = freshStore();
        const project = store.getProject()!;
        const initialCount = project.tasks!.length;

        store.dispatch({ type: 'ADD_TASK', task: { name: 'NewTask', actionSequence: [] } });
        assert(project.tasks!.length === initialCount + 1, 'T6: Task global hinzugefügt');

        store.dispatch({ type: 'REMOVE_TASK', name: 'NewTask' });
        assert(project.tasks!.length === initialCount, 'T6: Task global entfernt');
    }

    // ------------------------------------------------------------------
    // Test 7: ADD_OBJECT / REMOVE_OBJECT
    // ------------------------------------------------------------------
    {
        const store = freshStore();
        const project = store.getProject()!;
        const stage = project.stages![0];
        const initialCount = stage.objects!.length;

        store.dispatch({ type: 'ADD_OBJECT', object: { id: 'obj_new', name: 'NewObj' }, stageId: 'stage_main' });
        assert(stage.objects!.length === initialCount + 1, 'T7: Object auf Stage hinzugefügt');

        store.dispatch({ type: 'REMOVE_OBJECT', objectId: 'obj_new', stageId: 'stage_main' });
        assert(stage.objects!.length === initialCount, 'T7: Object von Stage entfernt');
    }

    // ------------------------------------------------------------------
    // Test 8: onChange-Listener
    // ------------------------------------------------------------------
    {
        const store = freshStore();
        let callCount = 0;
        let lastMutation: any = null;

        const unsubscribe = store.onChange((mutation) => {
            callCount++;
            lastMutation = mutation;
        });

        store.dispatch({ type: 'SET_PROPERTY', target: store.getProject()!.actions![0], path: 'type', value: 'test' });
        assert(callCount === 1, 'T8: onChange wurde 1x aufgerufen');
        assert(lastMutation?.type === 'SET_PROPERTY', 'T8: Mutation korrekt übergeben');

        unsubscribe();
        store.dispatch({ type: 'SET_PROPERTY', target: store.getProject()!.actions![0], path: 'type', value: 'test2' });
        assert(callCount === 1, 'T8: Nach unsubscribe kein weiterer Aufruf');
    }

    // ------------------------------------------------------------------
    // Test 9: BATCH-Mutation
    // ------------------------------------------------------------------
    {
        const store = freshStore();
        const project = store.getProject()!;

        store.dispatch({
            type: 'BATCH',
            label: 'Test-Batch',
            mutations: [
                { type: 'ADD_ACTION', action: { name: 'BatchAction1', type: 'log' } },
                { type: 'ADD_ACTION', action: { name: 'BatchAction2', type: 'log' } }
            ]
        });

        const names = project.actions!.map((a: any) => a.name);
        assert(names.includes('BatchAction1'), 'T9: Batch-Action 1 hinzugefügt');
        assert(names.includes('BatchAction2'), 'T9: Batch-Action 2 hinzugefügt');
    }

    // ------------------------------------------------------------------
    // Test 10: getStatus()
    // ------------------------------------------------------------------
    {
        const store = freshStore();
        const status = store.getStatus();
        assert(status.hasProject === true, 'T10: hasProject = true');
        assert(status.isDispatching === false, 'T10: isDispatching = false');
        assert(typeof status.listenerCount === 'number', 'T10: listenerCount ist Zahl');
    }

    // ------------------------------------------------------------------
    // Ergebnis
    // ------------------------------------------------------------------
    console.log(`\n  ProjectStore: ${passed} bestanden, ${failed} fehlgeschlagen`);
    if (failed > 0) {
        throw new Error(`ProjectStore: ${failed} Tests fehlgeschlagen!`);
    }
}
