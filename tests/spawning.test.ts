import { GameRuntime } from '../src/runtime/GameRuntime';
import { TSprite } from '../src/components/TSprite';
import { GameProject } from '../src/model/types';

// Mock Browser Environment
(global as any).window = {
    location: { hostname: 'localhost' }
};
(global as any).requestAnimationFrame = (cb: any) => setTimeout(cb, 16);
(global as any).cancelAnimationFrame = (id: any) => clearTimeout(id);
if (!(global as any).performance) {
    (global as any).performance = { now: () => Date.now() };
}

async function testSpawning() {
    console.log("=== Verifying Object Lifecycle (Spawning & Wrecking) ===");

    const templateSprite = new TSprite();
    templateSprite.id = 'template_balloon';
    templateSprite.name = 'TemplateBalloon';
    templateSprite.x = -100;
    templateSprite.y = -100;

    const dummyProject = {
        meta: { name: "Test Project", version: "1.0", author: "Test" },
        stages: [
            {
                id: "stage-1",
                name: "Main Stage",
                type: "standard",
                objects: [templateSprite],
                variables: []
            }
        ],
        activeStageId: "stage-1",
        objects: [],
        tasks: [],
        actions: [],
        variables: []
    } as any;

    const runtime = new GameRuntime(dummyProject, undefined, { makeReactive: false, onRender: () => {} } as any);
    (runtime as any).handleStageChange("", "stage-1");

    if (runtime.getObjects().length !== 2) {
        throw new Error("❌ Init failed: Expected 2 objects in runtime (Template + VirtualStageController)");
    }

    // Spawn Trigger 1
    const clone = runtime.spawnObject('template_balloon', 50, 150);
    if (!clone || !clone.id.includes('template_balloon_') || !clone.isClone || clone.x !== 50) {
        throw new Error("❌ Spawning failed: Clone has incorrect properties");
    }

    if (runtime.getObjects().length !== 3) {
        throw new Error("❌ Spawning failed: Runtime objects length not updated");
    }

    // Destroy Trigger
    runtime.destroyObject(clone.id);
    if (runtime.getObjects().length !== 2) {
        throw new Error("❌ Destruction failed: Runtime objects length not restored");
    }

    console.log("✅ Object Lifecycle & Spawning Verification Complete!");

    console.log("=== Performance Test: Spawning 100 clones ===");
    const startTime = performance.now();
    for(let i = 0; i < 100; i++) {
        runtime.spawnObject('template_balloon', i, i);
    }
    const endTime = performance.now();
    const duration = endTime - startTime;
    console.log(`✅ 100 Clones spawned in ${duration.toFixed(2)} ms.`);
    
    // Test ActionExecutor proxying
    // ... weglassen
}

testSpawning().catch(err => {
    console.error(err);
    process.exit(1);
});
