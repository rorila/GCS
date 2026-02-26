const fs = require('fs');
const path = require('path');

const projectPath = path.join(__dirname, '../game-server/public/platform/project.json');

if (!fs.existsSync(projectPath)) {
    console.error('Project file not found:', projectPath);
    process.exit(1);
}

const project = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
let changes = 0;

function cleanNode(node) {
    if (!node.data) return;

    // SSoT for Variables
    if (node.type === 'VariableDecl' || node.data.isVariable) {
        if (node.data.variable && (node.data.variable.type || node.data.variable.value !== undefined)) {
            console.log(`Cleaning Variable node: ${node.id} (${node.data.variable.name})`);
            node.data.variable = {
                name: node.data.variable.name,
                isVariable: true
            };
            changes++;
        }
    }

    // SSoT for Actions
    if ((node.type === 'Action' || node.type === 'DataAction') && node.data.isLinked) {
        const keys = Object.keys(node.data);
        const hasRedundancy = keys.some(k => !['name', 'isLinked', 'showDetails'].includes(k));

        if (hasRedundancy) {
            console.log(`Cleaning Action node: ${node.id} (${node.data.name})`);
            node.data = {
                name: node.data.name,
                isLinked: true,
                showDetails: node.data.showDetails || false
            };
            changes++;
        }
    }
}

function processFlowChart(flowChart) {
    if (!flowChart || !flowChart.elements) return;
    flowChart.elements.forEach(cleanNode);
}

// 1. Root Flow
processFlowChart(project.flow);

// 2. Global Tasks Flow (Old format)
if (project.tasks) {
    project.tasks.forEach(task => processFlowChart(task.flowChart));
}

// 3. Stage Flows
if (project.stages) {
    project.stages.forEach(stage => {
        // Stage tasks
        if (stage.tasks) {
            stage.tasks.forEach(task => processFlowChart(task.flowChart));
        }
        // Stage flowCharts collection
        if (stage.flowCharts) {
            Object.values(stage.flowCharts).forEach(processFlowChart);
        }
    });
}

if (changes > 0) {
    fs.writeFileSync(projectPath, JSON.stringify(project, null, 2), 'utf8');
    console.log(`Successfully cleaned ${changes} nodes in project.json.`);
} else {
    console.log('No redundant SSoT data found. project.json is already clean.');
}
