
import { ReactiveRuntime } from '../src/runtime/ReactiveRuntime';
import { GameProject } from '../src/model/types';
import { FlowEditor } from '../src/editor/FlowEditor';
import { RefactoringManager } from '../src/editor/RefactoringManager';
import { mediatorService, MediatorEvents } from '../src/services/MediatorService';
import { projectRegistry } from '../src/services/ProjectRegistry';
import { InspectorEventHandler } from '../src/editor/inspector/InspectorEventHandler';
import { InspectorHost } from '../src/editor/inspector/InspectorHost';

// Mock DOM
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!DOCTYPE html><div id="flow-editor"><select id="flow-selector"></select></div>');
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.HTMLSelectElement = dom.window.HTMLSelectElement;
global.HTMLOptionElement = dom.window.HTMLOptionElement;

// Mock LocalStorage
global.localStorage = {
    getItem: () => null,
    setItem: () => { }
} as any;

// Setup Project
const project: GameProject = {
    meta: { name: 'Test Project', version: '1.0.0', author: 'Test' },
    tasks: [
        { name: 'Task1', actionSequence: [] }
    ],
    stages: [
        {
            id: 'stage1',
            name: 'Stage 1',
            tasks: [
                { name: 'StageTask1', actionSequence: [] }
            ],
            flowCharts: {
                'StageTask1': { elements: [], connections: [] }
            }
        }
    ],
    flowCharts: {
        'Task1': { elements: [], connections: [] }
    },
    variables: [],
    actions: [],
    objects: [],
    input: {} as any
};

projectRegistry.setProject(project);

// Setup Editor
const flowEditor = new FlowEditor('flow-editor', project);
(flowEditor as any).currentFlowContext = 'Task1'; // Set context to Task1
(flowEditor as any).activeStageId = 'stage1'; // Assuming we are in global context for now? 
// No, FlowEditor defaults to stage view usually.
// Let's assume we are viewing Global Task1.

console.log('--- Initial State ---');
console.log('Current Context:', (flowEditor as any).currentFlowContext);
(flowEditor as any).updateFlowSelector();
console.log('Selector Value:', (flowEditor as any).flowSelect.value);

// Simulate Rename via Inspector
console.log('\n--- Simulating Rename Task1 -> Task1_Renamed ---');

const oldName = 'Task1';
const newName = 'Task1_Renamed';

// 1. Emulate Inspector Event Handler logic
// Real flow: InspectorEventHandler -> FlowNodeHandler -> RefactoringManager -> Returns Event -> InspectorHost -> Mediator

// A. RefactoringManager
console.log('[Test] Calling RefactoringManager.renameTask...');
RefactoringManager.renameTask(project, oldName, newName);

// Verify Project Data
const renamedTask = project.tasks.find(t => t.name === newName);
if (renamedTask) console.log('[Test] Project Data Updated: Task found with new name.');
else console.error('[Test] FAIL: Task not found with new name in project.');

// B. InspectorHost emits Mediator Event
console.log('[Test] Emitting Mediator Event...');
mediatorService.notifyDataChanged({
    property: 'Name',
    value: newName,
    oldValue: oldName,
    object: renamedTask
}, 'inspector');

// C. Verify FlowEditor Response
console.log('\n--- Verification ---');
console.log('Current Context:', (flowEditor as any).currentFlowContext);
console.log('Selector Value:', (flowEditor as any).flowSelect.value);

if ((flowEditor as any).currentFlowContext === newName) {
    console.log('[SUCCESS] Context updated correctly.');
} else {
    console.error('[FAIL] Context NOT updated.');
}

if ((flowEditor as any).flowSelect.value === newName) {
    console.log('[SUCCESS] Dropdown value updated correctly.');
} else {
    console.error(`[FAIL] Dropdown value is "${(flowEditor as any).flowSelect.value}", expected "${newName}".`);
}
