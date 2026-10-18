/**
 * Renaming Robustness Tests - Deep Refactoring Fix Verification
 * Absicherung gegen Namens-Inkonsistenzen und Reversionen.
 */

import { TaskRefactoringService } from '../src/editor/refactoring/TaskRefactoringService';
import { ActionRefactoringService } from '../src/editor/refactoring/ActionRefactoringService';
import { GameProject } from '../src/model/types';

export interface TestResult {
    name: string;
    type: string;
    expectedSuccess: boolean;
    actualSuccess: boolean;
    passed: boolean;
    details?: string;
}

function createCorruptTestProject(oldName: string): GameProject {
    return {
        meta: { name: 'RobustnessTest', version: '1.0', author: 'Test' },
        tasks: [],
        actions: [],
        objects: [],
        variables: [],
        stages: [
            {
                id: 'stage_test',
                name: 'Test Stage',
                flowCharts: {
                    'MainTask': {
                        elements: [
                            // Teilweise korrupter Knoten: data.taskName ist schon neu, properties aber noch alt
                            {
                                id: 'node_1',
                                type: 'Task',
                                data: { taskName: 'NEW_NAME_ALREADY_HERE' },
                                properties: { name: oldName, text: oldName }
                            },
                            // Condition die auf den alten Namen zeigt
                            {
                                id: 'node_2',
                                type: 'Condition',
                                data: { thenTask: oldName, elseTask: 'Other' }
                            }
                        ]
                    }
                }
            } as any
        ]
    } as any;
}

export async function runRenamingRobustnessTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const addResult = (name: string, passed: boolean, details?: string) => {
        results.push({ name, type: 'Robustness', expectedSuccess: true, actualSuccess: passed, passed, details });
    };

    // --- Test 1: Multi-Feld-Matching (Task) ---
    try {
        const oldName = 'OldTask';
        const newName = 'SolidTask';
        const project = createCorruptTestProject(oldName);

        // Simuliere Refactoring
        TaskRefactoringService.renameTask(project, oldName, newName);

        const chart = project.stages![0].flowCharts!['MainTask'];
        const taskNode = chart.elements.find((el: any) => el.id === 'node_1');

        const ok = taskNode.data.taskName === newName &&
            taskNode.data.name === newName &&
            taskNode.properties.name === newName;

        addResult('Multi-Feld-Matching: Erfasst teil-aktualisierte Knoten', ok,
            `data.taskName=${taskNode.data.taskName}, properties.name=${taskNode.properties.name}`);
    } catch (e: any) {
        addResult('Multi-Feld-Matching: Task', false, `Exception: ${e.message}`);
    }

    // --- Test 2: Condition Update (Task) ---
    try {
        const oldName = 'OldTask';
        const newName = 'SolidTask';
        const project = createCorruptTestProject(oldName);

        TaskRefactoringService.renameTask(project, oldName, newName);

        const chart = project.stages![0].flowCharts!['MainTask'];
        const condNode = chart.elements.find((el: any) => el.type === 'Condition');

        const ok = condNode.data.thenTask === newName;
        addResult('Condition-Update: thenTask/elseTask Referenzen', ok, `thenTask=${condNode.data.thenTask}`);
    } catch (e: any) {
        addResult('Condition-Update: Task', false, `Exception: ${e.message}`);
    }

    // --- Test 3: Case-Insensitivity (Type Matching) ---
    try {
        const project: GameProject = {
            tasks: [],
            actions: [],
            objects: [],
            variables: [],
            stages: [{
                flowCharts: {
                    'Test': {
                        elements: [
                            { type: 'task', data: { taskName: 'Old' }, properties: { name: 'Old' } }, // klein geschrieben
                            { type: 'TASK', data: { taskName: 'Old2' }, properties: { name: 'Old2' } }  // GROSS geschrieben
                        ]
                    }
                }
            } as any]
        } as any;

        TaskRefactoringService.renameTask(project, 'Old', 'New');
        TaskRefactoringService.renameTask(project, 'Old2', 'New2');

        const elements = project.stages![0].flowCharts!['Test'].elements;
        const ok = elements[0].data.taskName === 'New' && elements[1].data.taskName === 'New2';

        addResult('Case-Insensitivity: Erkennt "task" und "TASK"', ok, `lower=${elements[0].data.taskName}, upper=${elements[1].data.taskName}`);
    } catch (e: any) {
        addResult('Case-Insensitivity', false, `Exception: ${e.message}`);
    }

    return results;
}

// Standalone execution support
const isMain = import.meta.url.includes(process.argv[1]?.replace(/\\/g, '/')) || process.argv[1]?.endsWith('renaming_robustness.test.ts');
if (isMain) {
    runRenamingRobustnessTests().then(results => {
        results.forEach(r => console.log(`${r.passed ? '✅' : '❌'} ${r.name}: ${r.details}`));
        process.exit(results.every(r => r.passed) ? 0 : 1);
    });
}
