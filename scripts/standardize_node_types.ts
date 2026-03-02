import fs from 'fs';
import path from 'path';

const SRC_DIR = 'c:/Users/rolfr/.gemini/antigravity/scratch/game-builder-v1/src';
const PROJECT_JSON_PATH = 'c:/Users/rolfr/.gemini/antigravity/scratch/game-builder-v1/game-server/public/platform/project.json';

// Mapping for standardizing types
const TYPE_MAP: Record<string, string> = {
    'Task': 'task',
    'Action': 'action',
    'DataAction': 'data_action',
    'Condition': 'condition',
    'Start': 'start',
    'dataaction': 'data_action'
};

function processTsFiles(dir: string) {
    const files = fs.readdirSync(dir);
    let changedFilesCount = 0;

    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            changedFilesCount += processTsFiles(fullPath);
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let originalContent = content;

            // Equality checks like: e.type === 'Task', if (nodeType == "Action"), getType() === 'Task'
            content = content.replace(/(type|className|nodeType|baseType|getType\s*\(\w*\))\s*(===|!==|==|!=)\s*(['"])(Task|Action|DataAction|Condition|Start|dataaction)\3/g, (m, t, op, q, val) => `${t} ${op} ${q}${TYPE_MAP[val]}${q}`);

            // Equality checks where literal is on the left: 'Action' === type
            content = content.replace(/(['"])(Task|Action|DataAction|Condition|Start|dataaction)\1\s*(===|!==|==|!=)\s*(.*(?:type|className|nodeType|baseType|getType\s*\(\w*\)))/g, (m, q, val, op, t) => `${q}${TYPE_MAP[val]}${q} ${op} ${t}`);

            // Assignment / object prop like: type: 'Task'
            content = content.replace(/(type)\s*(:|=)\s*(['"])(Task|Action|DataAction|Condition|Start|dataaction)\3/g, (m, t, op, q, val) => `${t}${op === ':' ? ':' : ' ='} ${q}${TYPE_MAP[val]}${q}`);

            // Switch cases: case 'Task':
            content = content.replace(/case\s+(['"])(Task|Action|DataAction|Condition|Start|dataaction)\1\s*:/g, (m, q, val) => `case ${q}${TYPE_MAP[val]}${q}:`);

            // Returns from getType
            content = content.replace(/return\s+(['"])(Task|Action|DataAction|Condition|Start|dataaction)\1/g, (m, q, val) => `return ${q}${TYPE_MAP[val]}${q}`);

            if (originalContent !== content) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Updated TS file: ${fullPath}`);
                changedFilesCount++;
            }
        }
    }
    return changedFilesCount;
}

function processProjectJson() {
    console.log('--- Stabilizing project.json (Normalizing Types) ---');
    if (!fs.existsSync(PROJECT_JSON_PATH)) {
        console.log('project.json not found!');
        return;
    }

    let content = fs.readFileSync(PROJECT_JSON_PATH, 'utf8');
    let originalContent = content;
    const data = JSON.parse(content);
    let changes = 0;

    const normalizeType = (obj: any) => {
        if (obj && obj.type && TYPE_MAP[obj.type]) {
            obj.type = TYPE_MAP[obj.type];
            changes++;
        }
        if (obj && obj.type === 'dataaction') {
            obj.type = 'data_action';
            changes++;
        }
    };

    const processElements = (elements: any[]) => {
        if (!elements) return;
        elements.forEach(el => normalizeType(el));
    };

    // Normalize flow elements in stages
    if (data.stages) {
        data.stages.forEach((stage: any) => {
            if (stage.flowCharts) {
                Object.values(stage.flowCharts).forEach((flow: any) => {
                    processElements(flow.elements);
                });
            }
            if (stage.tasks) {
                stage.tasks.forEach((task: any) => {
                    if (task.flowChart) processElements(task.flowChart.elements);
                });
            }
        });
    }

    // Global tasks
    if (data.tasks) {
        data.tasks.forEach((task: any) => {
            if (task.flowChart) processElements(task.flowChart.elements);
        });
    }

    // Global flowCharts
    if (data.flowCharts) {
        Object.values(data.flowCharts).forEach((flow: any) => {
            processElements(flow.elements);
        });
    }

    if (changes > 0) {
        fs.writeFileSync(PROJECT_JSON_PATH, JSON.stringify(data, null, 2), 'utf8');
        console.log(`Success: updated ${changes} node types in project.json.`);
    } else {
        console.log('No inconsistent node types found in project.json.');
    }
}

const count = processTsFiles(SRC_DIR);
console.log(`\nUpdated ${count} TypeScript files.`);
processProjectJson();
