import type { TestResult } from './agent_controller_helper';
import { createTestProject } from './agent_controller_helper';
import { runTests as runCoreTests } from './agent_controller_core.test';
import { runTests as runIntegrationTests } from './agent_controller_integration.test';
import { runTests as runLoopTests } from './agent_controller_loops.test';

export { createTestProject };
export type { TestResult };

export async function runTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    results.push(...(await runCoreTests()));
    results.push(...(await runIntegrationTests()));
    results.push(...(await runLoopTests()));
    return results;
}
