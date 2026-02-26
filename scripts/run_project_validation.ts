
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TestResult {
    name: string;
    type: string;
    expectedSuccess: boolean;
    actualSuccess: boolean;
    passed: boolean;
    details?: string;
}

export async function runProjectValidation(): Promise<TestResult[]> {
    console.log("🧪 Running Project Plausibility Validation...");
    const results: TestResult[] = [];
    const projectPath = path.join(__dirname, '../game-server/public/platform/project.json');

    const addResult = (name: string, passed: boolean, details?: string) => {
        results.push({
            name,
            type: 'Plausibility',
            expectedSuccess: true,
            actualSuccess: passed,
            passed,
            details
        });
    };

    if (!fs.existsSync(projectPath)) {
        addResult("Project File Existence", false, `File not found at ${projectPath}`);
        return results;
    }

    try {
        const project = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
        addResult("Project JSON Parsing", true);

        // 1. Basic Stats
        const taskCount = (project.tasks || []).length + (project.stages || []).reduce((acc: number, s: any) => acc + (s.tasks || []).length, 0);
        const stageCount = (project.stages || []).length;
        addResult("Project Structure", true, `Stages: ${stageCount}, Total Tasks: ${taskCount}`);

        // 2. Critical Check: Event Mapping
        let eventErrors = 0;
        const allTasks = new Set();
        (project.tasks || []).forEach((t: any) => allTasks.add(t.name));
        (project.stages || []).forEach((s: any) => (s.tasks || []).forEach((t: any) => allTasks.add(t.name)));

        (project.stages || []).forEach((s: any) => {
            const checkEvents = (events: any) => {
                if (!events) return;
                Object.values(events).forEach((t: any) => {
                    if (t && !allTasks.has(t)) eventErrors++;
                });
            };
            checkEvents(s.events);
            (s.objects || []).forEach((o: any) => checkEvents(o.events));
        });

        addResult("Event-Task Mapping", eventErrors === 0, `${eventErrors} dangling event mappings found.`);

        // 3. FlowChart Check
        let flowchartErrors = 0;
        (project.stages || []).forEach((s: any) => {
            (s.tasks || []).forEach((t: any) => {
                const hasFlow = (s.flowCharts && s.flowCharts[t.name]) || (project.flowCharts && project.flowCharts[t.name]);
                if (!hasFlow) flowchartErrors++;
            });
        });
        addResult("FlowChart Integrity", flowchartErrors === 0, `${flowchartErrors} tasks missing flowcharts.`);

    } catch (e: any) {
        addResult("Validation Execution", false, e.message);
    }

    return results;
}
