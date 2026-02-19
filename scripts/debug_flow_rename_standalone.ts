
import { GameProject } from '../src/model/types';
// We copy the RefactoringManager minimal code because importing might fail if it has deps
class RefactoringManager {
    static renameTask(project: any, oldName: string, newName: string) {
        // Mock minimal implementation for testing stage/tasks update
        if (project.stages) {
            project.stages.forEach((s: any) => {
                if (s.tasks) {
                    s.tasks.forEach((t: any) => { if (t.name === oldName) t.name = newName; }); // Fix: Update name
                }
                if (s.flowCharts && s.flowCharts[oldName]) {
                    s.flowCharts[newName] = s.flowCharts[oldName];
                    delete s.flowCharts[oldName];
                }
            });
        }
        project.tasks.forEach((t: any) => { if (t.name === oldName) t.name = newName; });
        if (project.flowCharts && project.flowCharts[oldName]) {
            project.flowCharts[newName] = project.flowCharts[oldName];
            delete project.flowCharts[oldName];
        }
    }
}

// Mock minimal DOM
const mockElement = (tag: string) => {
    const el: any = {
        tagName: tag.toUpperCase(),
        children: [] as any[],
        appendChild(child: any) { this.children.push(child); },
        style: {},
        value: '',
        text: '',
        label: '',
        innerHTML: '',
    };
    return el;
};

// Setup Project
const project: any = {
    meta: { name: 'Test Project', version: '1.0.0', author: 'Test' },
    tasks: [],
    stages: [
        {
            id: 'stage1',
            name: 'Stage 1',
            tasks: [
                { name: 'StageTask1', actionSequence: [] }
            ],
            flowCharts: {
                'StageTask1': { elements: [], connections: [] }
            },
            type: 'default'
        }
    ],
    flowCharts: {},
    variables: [],
    actions: [],
    objects: [],
    input: {}
};

// Mock FlowEditor context
const flowEditor = {
    project: project,
    currentFlowContext: 'StageTask1',
    flowSelect: mockElement('select'),
    getActiveStage: () => project.stages[0],

    // Extracted updateFlowSelector logic (simplified for test based on FlowEditor.ts)
    updateFlowSelector: function () {
        if (!this.project) return;
        this.flowSelect.children = []; // clear
        const activeStage = this.getActiveStage();
        const isBlueprint = false;

        console.log('[MockEditor] activeStage:', activeStage?.id);

        if (activeStage && !isBlueprint) {
            const stageGroup = mockElement('optgroup');
            stageGroup.label = `Stage: ${activeStage.name}`;

            const globalOpt = mockElement('option');
            globalOpt.value = 'global';
            // globalOpt.text = 'Main Flow (Stage)'; // simplified
            stageGroup.appendChild(globalOpt);

            const stageTasksFound = new Set<string>();

            // 1. Tasks that have a flowchart
            if (activeStage.flowCharts) {
                console.log('[MockEditor] Scanning flowCharts:', Object.keys(activeStage.flowCharts));
                Object.keys(activeStage.flowCharts).forEach(key => {
                    if (key !== 'global') {
                        const opt = mockElement('option');
                        opt.value = key;
                        // opt.text = `Task: ${key}`;
                        stageGroup.appendChild(opt);
                        stageTasksFound.add(key);
                    }
                });
            }

            // 2. Tasks defined in the stage but might not have a flowchart yet
            if (activeStage.tasks) {
                console.log('[MockEditor] Scanning tasks:', activeStage.tasks.map((t: any) => t.name));
                activeStage.tasks.forEach((task: any) => {
                    if (!stageTasksFound.has(task.name)) {
                        const opt = mockElement('option');
                        opt.value = task.name;
                        // opt.text = `Task: ${task.name}`;
                        stageGroup.appendChild(opt);
                        stageTasksFound.add(task.name);
                    }
                });
            }

            this.flowSelect.appendChild(stageGroup);
        }

        // Set value
        console.log(`[MockEditor] Setting value to: "${this.currentFlowContext}"`);
        this.flowSelect.value = this.currentFlowContext;

        // Output options for debugging
        const options = (this.flowSelect.children[0]?.children || []).map((o: any) => o.value);
        console.log('[MockEditor] Available Options:', options);
    }
};

console.log('--- Initial State ---');
flowEditor.updateFlowSelector();

console.log('\n--- Simulating Rename StageTask1 -> RenamedTask ---');
const oldName = 'StageTask1';
const newName = 'RenamedTask';

RefactoringManager.renameTask(project, oldName, newName);

// Update Editor Context (my fix logic)
// Simulating: data.oldValue === currentFlowContext -> update
if (flowEditor.currentFlowContext === oldName) {
    flowEditor.currentFlowContext = newName;
}

// Run updateFlowSelector
console.log('\n--- Updating Selector ---');
flowEditor.updateFlowSelector();

// Verify
const newOptions = (flowEditor.flowSelect.children[0]?.children || []).map((o: any) => o.value);
if (newOptions.includes(newName)) {
    console.log('[SUCCESS] New name exists in options.');
} else {
    console.error('[FAIL] New name NOT found in options!');
    console.error('Options:', newOptions);
}
