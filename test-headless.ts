import * as fs from 'fs';
import { HeadlessRuntime } from './src/runtime/HeadlessRuntime';
import { ExpressionParser } from './src/runtime/ExpressionParser';

import { safeDeepCopy } from './src/utils/DeepCopy';
import { hydrateObjects } from './src/utils/Serialization';

(global as any).HTMLElement = class {};
(global as any).Node = class {};
(global as any).window = { location: { search: '' }, addEventListener: () => {}, removeEventListener: () => {} };
(global as any).document = { addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => {} };

async function runTest() {
    const projectData = JSON.parse(fs.readFileSync('my_memory_game.json', 'utf8'));
    
    let hydratedProject = JSON.parse(JSON.stringify(projectData));
    hydratedProject.variables = hydrateObjects(hydratedProject.variables);
    
    const projectClone = safeDeepCopy(hydratedProject);
    console.log("Clone CanFlip_1:", JSON.stringify(projectClone.variables.find((v: any) => v.name === 'CanFlip_1')));
    
    const headless = new HeadlessRuntime(projectClone);
    headless.start();
    const { DebugLogService } = await import('./src/services/DebugLogService');
    DebugLogService.getInstance().setEnabled(true);

    // Trigger click on Card 1
    console.log("--- Triggering Click ---");
    const card1 = headless.getRuntime().objects.find(o => o.name === 'Btn_Card1');
    await headless.getRuntime().handleEvent(card1.id, 'onClick', null);
    await new Promise(resolve => setTimeout(resolve, 500));

    // Print variables
    const vars = (headless.getRuntime() as any).variableManager.contextVars;
    console.log("Variables State after click:");
    console.log("State:", vars["State"]);
    console.log("Card1_State:", vars["Card1_State"]);
    console.log("CanFlip_1:", vars["CanFlip_1"]);
    console.log("FirstCard:", vars["FirstCard"]);

    console.log("EVAL DIRECT:", ExpressionParser.evaluate('State == "idle" && Card1_State == 0', vars));

    const logs = DebugLogService.getInstance().getLogs();
    console.log("LOGS:", JSON.stringify(logs, null, 2));
}

runTest().catch(console.error);
