import { GameRuntime } from '../src/runtime/GameRuntime';
import { GameProject, StageDefinition } from '../src/model/types';
import { ReactiveRuntime } from '../src/runtime/ReactiveRuntime';

// Mock Browser Environment
(global as any).window = {
    location: { hostname: 'localhost' },
    addEventListener: () => { },
    removeEventListener: () => { },
    localStorage: {
        getItem: () => null,
        setItem: () => { },
        removeItem: () => { }
    }
};
(global as any).localStorage = (global as any).window.localStorage;
(global as any).document = {
    addEventListener: () => { },
    removeEventListener: () => { }
};

// Mock TaskExecutor
class MockTaskExecutor {
    executedTasks: string[] = [];
    execute(taskName: string, _context: any) {
        this.executedTasks.push(taskName);
        console.log(`[MockTaskExecutor] Executing task: ${taskName}`);
    }
    setFlowCharts(_flowCharts: any[]) { }
    setTasks(_tasks: any[]) { }
    setActions(_actions: any[]) { }
}

async function testStageEvents() {
    console.log("=== Verifying Stage Events Trigger ===");

    const project: GameProject = {
        meta: { name: "Test Project", version: "1.0.0", author: "Test" },
        stages: [
            {
                id: "stage-1",
                name: "Stage 1",
                type: "standard",
                objects: [],
                events: {
                    onEnter: "FetchDataTask"
                }
            },
            {
                id: "stage-2",
                name: "Stage 2",
                type: "standard",
                objects: [],
                Tasks: { // Support legacy name
                    onEnter: "AnotherFetchTask"
                }
            }
        ],
        activeStageId: "stage-1",
        objects: [],
        tasks: [],
        actions: [],
        variables: []
    } as any;

    const runtime = new GameRuntime(project);
    const mockExecutor = new MockTaskExecutor();
    (runtime as any).taskExecutor = mockExecutor;

    // Trigger Stage Change
    console.log("Triggering stage change to stage-1...");
    (runtime as any).handleStageChange("", "stage-1");

    if (mockExecutor.executedTasks.includes("FetchDataTask")) {
        console.log("✅ SUCCESS: onEnter triggered for Stage 1");
    } else {
        console.log("❌ FAILURE: onEnter NOT triggered for Stage 1");
        process.exit(1);
    }

    // Trigger Stage Change to stage-2 (Legacy Tasks naming)
    mockExecutor.executedTasks = [];
    console.log("Triggering stage change to stage-2 (Legacy name)...");
    (runtime as any).handleStageChange("stage-1", "stage-2");

    if (mockExecutor.executedTasks.includes("AnotherFetchTask")) {
        console.log("✅ SUCCESS: onEnter triggered for Stage 2 (Legacy)");
    } else {
        console.log("❌ FAILURE: onEnter NOT triggered for Stage 2");
        process.exit(1);
    }

    console.log("=== Stage Events Verification Complete ===");
}

testStageEvents().catch(err => {
    console.error(err);
    process.exit(1);
});
