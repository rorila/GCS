import { runTests } from './tests/agent_controller.test.ts';

async function main() {
    const res = await runTests();
    const fails = res.filter((r: any) => !r.passed);
    if(fails.length > 0) {
        console.error("FAILS:", JSON.stringify(fails, null, 2));
    } else {
        console.log("ALL PASSED", res.length);
    }
}
main();
