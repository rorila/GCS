import { FlowSyncManager, FlowSyncHost } from 'c:/Users/rolfr/.gemini/antigravity/scratch/game-builder-v1/src/editor/services/FlowSyncManager';

async function runTest() {
    console.log('--- Pure Logic Connection Sync Test ---');

    const project = {
        name: 'TestProject',
        tasks: [{ name: 'Task1', actionSequence: [] }],
        actions: [],
        flowCharts: {}
    };

    const host: any = {
        project,
        currentFlowContext: 'Task1',
        nodes: [
            {
                id: 'node-task',
                getType: () => 'Task',
                Name: 'Task1',
                toJSON: () => ({ id: 'node-task', type: 'Task', properties: { name: 'Task1', text: 'Task1' } }),
                data: { taskName: 'Task1' }
            },
            {
                id: 'node-action',
                getType: () => 'Action',
                Name: 'Action1',
                toJSON: () => ({ id: 'node-action', type: 'Action', properties: { name: 'Action1', text: 'Action1' } }),
                data: { name: 'Action1' }
            }
        ],
        connections: [
            {
                id: 'conn1',
                startTarget: { id: 'node-task', name: 'node-task' },
                endTarget: { id: 'node-action', name: 'node-action' },
                data: { startAnchorType: 'output', endAnchorType: 'input' },
                toJSON: function () {
                    return {
                        id: this.id,
                        startTargetId: this.startTarget.id,
                        endTargetId: this.endTarget.id,
                        data: this.data
                    };
                }
            }
        ],
        cellSize: 20,
        showDetails: false,
        updateFlowSelector: () => { },
        getActiveStage: () => null,
        getTargetFlowCharts: (ctx) => {
            if (!project.flowCharts[ctx]) project.flowCharts[ctx] = { elements: [], connections: [] };
            return project.flowCharts;
        },
        getTaskDefinitionByName: (name) => project.tasks.find(t => t.name === name),
        setupNodeListeners: () => { },
        syncManager: null
    };

    const syncManager = new FlowSyncManager(host as any);
    host.syncManager = syncManager;

    console.log('Triggering syncToProject...');
    syncManager.syncToProject('Task1');

    const taskDef = project.tasks[0];
    console.log('Resulting actionSequence:', JSON.stringify(taskDef.actionSequence, null, 2));

    if (taskDef.actionSequence && taskDef.actionSequence.length > 0 && taskDef.actionSequence[0].name === 'Action1') {
        console.log('SUCCESS: Action1 found in actionSequence');
    } else {
        console.log('FAILURE: Action1 NOT found in actionSequence');
        // process.exit(1);
    }
}

runTest().catch(err => {
    console.error(err);
    process.exit(1);
});
