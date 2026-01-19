const fs = require('fs');
const path = require('path');

const projectPath = path.join(__dirname, 'demos/project_NewTennis50.json');
const rawData = fs.readFileSync(projectPath, 'utf8');
const project = JSON.parse(rawData);

// Simulate "Impressum" stage selection
const activeStageId = project.stages.find(s => s.name === "Impressum")?.id;
console.log("Active Stage ID:", activeStageId);

if (!activeStageId) {
    console.error("Impressum stage not found!");
    process.exit(1);
}

const workingStage = project.stages.find(s => s.id === activeStageId);
console.log("Working Stage Name:", workingStage.name);

// 1. Tasks that have a flow chart in this stage (exclude 'global' metadata key)
const stageTaskNames = Object.keys(workingStage.flowCharts || {})
    .filter(key => key !== 'global');

console.log("Stage Task Names:", stageTaskNames);

// 2. Tasks referenced by objects in this stage
const referencedTaskNames = new Set();
(workingStage.objects || []).forEach((obj) => {
    if (obj.Tasks) {
        Object.values(obj.Tasks).forEach((tName) => {
            if (tName && typeof tName === 'string' && tName.trim() !== '') {
                referencedTaskNames.add(tName);
            }
        });
    }
});

console.log("Referenced Task Names:", Array.from(referencedTaskNames));

const allRelevantNames = new Set([...stageTaskNames, ...referencedTaskNames]);
console.log("All Relevant Names:", Array.from(allRelevantNames));

const dataToShow = {};

if (allRelevantNames.size > 0) {
    dataToShow.tasks = project.tasks.filter(t => allRelevantNames.has(t.name));
    console.log("Filtered Tasks Count:", dataToShow.tasks.length);
    console.log("Filtered Tasks Names:", dataToShow.tasks.map(t => t.name));

    const usedActionNames = new Set();
    dataToShow.tasks.forEach((t) => {
        if (t.actionSequence && Array.isArray(t.actionSequence)) {
            t.actionSequence.forEach((step) => {
                if (step.type === 'action' && step.name) {
                    usedActionNames.add(step.name);
                }
            });
        }
    });

    console.log("Used Action Names:", Array.from(usedActionNames));

    if (usedActionNames.size > 0 && project.actions) {
        dataToShow.actions = project.actions.filter(a => usedActionNames.has(a.name));
        console.log("Filtered Actions Count:", dataToShow.actions.length);
        console.log("Filtered Actions Names:", dataToShow.actions.map(a => a.name));
    }
}
