
import { agentController } from '../src/services/AgentController';
import { projectRegistry } from '../src/services/ProjectRegistry';
import { GameProject } from '../src/model/types';

// Mock Project
const mockProject: GameProject = {
    metadata: {
        name: "TestProject",
        version: "1.0.0",
        author: "Tester"
    },
    tasks: [],
    stages: [
        {
            id: 'stage1',
            name: 'MainStage',
            tasks: [],
            variables: [],
            elements: [],
            background: '#000000'
        }
    ],
    actions: [],
    variables: [],
    flowCharts: {
        'ExistingTask': { elements: [], connections: [] } // Simulate existing flow
    }
};

// Initialize Controller
console.log("1. Initializing AgentController...");
agentController.setProject(mockProject);

// Test 1: Create Task
console.log("\n2. Testing Create Task...");
const taskName = "AgentCreatedTask";
agentController.createTask('stage1', taskName, "Created by Agent Test");

// Verify Task Existence
const globalTask = mockProject.tasks?.find(t => t.name === taskName);
const stageTask = mockProject.stages![0].tasks?.find(t => t.name === taskName);

if (globalTask && stageTask) {
    console.log("✅ Task created in Global AND Stage!");
} else {
    console.error("❌ Task creation failed!", { global: !!globalTask, stage: !!stageTask });
    process.exit(1);
}

// Test 2: Add Action
console.log("\n3. Testing Add Action...");
try {
    agentController.addAction(taskName, 'log', 'LogStart', { message: 'Hello Agent' });

    // Verify Action Global Definition
    const actionDef = mockProject.actions?.find(a => a.name === 'LogStart');
    if (!actionDef || actionDef.type !== 'log') {
        console.error("❌ Action global definition missing or wrong type!");
        process.exit(1);
    }

    // Verify Task Sequence
    const task = mockProject.tasks!.find(t => t.name === taskName);
    const seqItem = task?.actionSequence.find(i => i.name === 'LogStart');
    if (!seqItem || seqItem.type !== 'action') {
        process.exit(1);
        console.error("❌ Action missing from Task Sequence!");
    }
    console.log("✅ Action added correctly (Global + Sequence)!");

} catch (e) {
    console.error("❌ Add Action failed:", e);
    process.exit(1);
}

// Test 3: Flow Invalidation
console.log("\n4. Testing Flow Invalidation...");
// We expect 'AgentCreatedTask' to NOT have a flowChart (was cleared/never created)
if (mockProject.flowCharts && mockProject.flowCharts[taskName]) {
    console.error("❌ FlowChart should not exist for new task!");
    process.exit(1);
}

// Create a task that HAS a flow chart, then update it
mockProject.tasks!.push({ name: 'ExistingTask', actionSequence: [] });
// (Simulate existing flow chart above in mockProject definition)

console.log("   Updating 'ExistingTask'...");
agentController.addAction('ExistingTask', 'wait', 'Wait1s');

if (mockProject.flowCharts && mockProject.flowCharts['ExistingTask']) {
    console.error("❌ FlowChart should have been DELETED after update!");
    process.exit(1);
} else {
    console.log("✅ FlowChart successfully invalidated!");
}

console.log("\n🎉 ALL TESTS PASSED!");
