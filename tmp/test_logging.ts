
import { DebugLogService } from './src/services/DebugLogService';
import { TaskExecutor } from './src/runtime/TaskExecutor';
import { ActionExecutor } from './src/runtime/ActionExecutor';

async function testLogging() {
    console.log("Testing DebugLogService...");
    const logger = DebugLogService.getInstance();
    logger.setEnabled(true);

    const project = {
        tasks: [
            {
                name: "RunTestTask",
                actionSequence: [
                    {
                        type: "property",
                        target: "TestObj",
                        changes: { color: "red" }
                    }
                ]
            }
        ]
    };

    const objects = [{ id: "TestObj", name: "TestObj", style: {} }];
    const actionExecutor = new ActionExecutor(objects);
    const taskExecutor = new TaskExecutor(project as any, [], actionExecutor);

    console.log("Executing task...");
    await taskExecutor.execute("RunTestTask", {}, {});

    const logs = (logger as any).logs || [];
    console.log("Logs counted:", logs.length);
    logs.forEach((l: any) => {
        console.log(`[${l.type}] ${l.message}`);
    });
}

testLogging().catch(console.error);
