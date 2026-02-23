
const fs = require('fs');
const path = require('path');

const projectPath = 'game-server/public/platform/project.json';
const project = JSON.parse(fs.readFileSync(projectPath, 'utf8'));

const report = {
    global: {
        tasks: project.tasks.map(t => t.name),
        flowCharts: Object.keys(project.flowCharts || {})
    },
    stages: {}
};

project.stages.forEach(stage => {
    report.stages[stage.id || stage.name] = {
        tasks: (stage.tasks || []).map(t => t.name),
        flowCharts: Object.keys(stage.flowCharts || {}).filter(k => k !== 'global'),
        embeddedFlowCharts: (stage.tasks || []).filter(t => t.flowChart).map(t => t.name)
    };
});

console.log(JSON.stringify(report, null, 2));
