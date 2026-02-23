
const fs = require('fs');
const path = require('path');

/**
 * Project Validator for Game Builder v1
 * Checks project.json for consistency between:
 * - Events and Tasks
 * - Tasks and Actions
 * - Actions and Variables/Components
 * - FlowCharts and Task Definitions
 */

const projectPath = path.join(__dirname, '../game-server/public/platform/project.json');

if (!fs.existsSync(projectPath)) {
    console.error(`\x1b[31mError: project.json not found at ${projectPath}\x1b[0m`);
    process.exit(1);
}

const project = JSON.parse(fs.readFileSync(projectPath, 'utf8'));

let errorCount = 0;
let warningCount = 0;

function logError(msg) {
    console.error(`\x1b[31m[ERROR]\x1b[0m ${msg}`);
    errorCount++;
}

function logWarning(msg) {
    console.warn(`\x1b[33m[WARN]\x1b[0m ${msg}`);
    warningCount++;
}

function logInfo(msg) {
    console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`);
}

// Map representing all tasks available in the project (Global + Stage-local)
const allTasks = new Map(); // Name -> { stage: string, source: string }
const allActions = new Set(); // Global Action Names
const allVariables = new Set(); // Global Variable Names
const allObjects = new Set(); // Global Object IDs/Names

// 1. Collect Global Elements (Blueprint/Root)
(project.tasks || []).forEach(t => allTasks.set(t.name, { stage: 'global', source: 'root.tasks' }));
(project.variables || []).forEach(v => {
    allVariables.add(v.name);
    allVariables.add(v.id);
});
(project.objects || []).forEach(o => {
    allObjects.add(o.id);
    allObjects.add(o.name);
});

// 2. Collect Stage Elements
project.stages.forEach(stage => {
    const stageId = stage.id || stage.name;
    const isBlueprint = stageId === 'stage_blueprint';

    (stage.tasks || []).forEach(t => {
        if (!allTasks.has(t.name) || isBlueprint) {
            allTasks.set(t.name, { stage: stageId, source: 'stage.tasks' });
        }
    });

    (stage.actions || []).forEach(a => {
        allActions.add(a.name); // Note: actions are often shared or referenced by name
    });

    (stage.variables || []).forEach(v => {
        allVariables.add(v.name);
        allVariables.add(v.id);
    });

    (stage.objects || []).forEach(o => {
        allObjects.add(o.id);
        allObjects.add(o.name);
    });
});

logInfo(`Found ${allTasks.size} Tasks, ${allVariables.size} Variables, ${allObjects.size} Objects/Components.`);

// --- VALIDATION RUN ---

// 1. Check Events -> Tasks
project.stages.forEach(stage => {
    const checkEvents = (objName, events) => {
        if (!events) return;
        Object.entries(events).forEach(([evt, taskName]) => {
            if (!taskName) return;
            if (!allTasks.has(taskName)) {
                logError(`Stage "${stage.id}": Object "${objName}" maps event "${evt}" to non-existent Task "${taskName}"`);
            }
        });
    };

    // Stage Events
    checkEvents(`Stage:${stage.id}`, stage.events);

    // Object Events
    (stage.objects || []).forEach(obj => {
        checkEvents(obj.name || obj.id, obj.events);
    });
});

// 2. Check Tasks -> Actions & Resources
const usedActions = new Set();
const usedTasks = new Set();

// Register tasks used by events
project.stages.forEach(stage => {
    if (stage.events) Object.values(stage.events).forEach(t => usedTasks.add(t));
    (stage.objects || []).forEach(obj => {
        if (obj.events) Object.values(obj.events).forEach(t => usedTasks.add(t));
    });
});

project.stages.forEach(stage => {
    (stage.tasks || []).forEach(task => {
        if (task.actionSequence) {
            task.actionSequence.forEach(step => {
                if (step.name) {
                    usedActions.add(step.name);
                    // Check if action exists
                    if (!allActions.has(step.name)) {
                        // Some actions might be system actions or not in local list?
                        // But per rules, they should be in project.json actions list or global.
                        logWarning(`Task "${task.name}" in Stage "${stage.id}" uses Action "${step.name}" which is not defined in any Stage/Global list.`);
                    } else {
                        // Action exists, check its resources
                        // We need to find the action definition
                        const actionDef = (stage.actions || []).find(a => a.name === step.name) ||
                            (project.stages.find(s => s.id === 'stage_blueprint')?.actions || []).find(a => a.name === step.name);

                        if (actionDef) {
                            // Check variableName
                            if (actionDef.variableName && !allVariables.has(actionDef.variableName)) {
                                logError(`Action "${actionDef.name}" uses undefined Variable "${actionDef.variableName}"`);
                            }
                            if (actionDef.resultVariable && !allVariables.has(actionDef.resultVariable)) {
                                logError(`Action "${actionDef.name}" stores result in undefined Variable "${actionDef.resultVariable}"`);
                            }
                            // Check target (objects)
                            if (actionDef.target && !allObjects.has(actionDef.target)) {
                                logError(`Action "${actionDef.name}" targets non-existent Object "${actionDef.target}"`);
                            }
                            // Check Formula / Details (Pascal-style)
                            const checkRefs = (text) => {
                                if (!text) return;
                                // Regex for ${var}
                                const matches = text.match(/\$\{([^}]+)\}/g);
                                if (matches) {
                                    matches.forEach(m => {
                                        const varName = m.slice(2, -1).split('.')[0]; // Handle ${obj.prop}
                                        if (!allVariables.has(varName) && !allObjects.has(varName) && varName !== 'global' && varName !== '$eventData') {
                                            logWarning(`Action "${actionDef.name}" refers to potentially undefined entity "${varName}" in expression: ${m}`);
                                        }
                                    });
                                }
                            };
                            checkRefs(actionDef.formula);
                            checkRefs(actionDef.details);
                        }
                    }
                }
                // Check successBody/errorBody
                if (step.successBody) step.successBody.forEach(s => usedActions.add(s.name));
                if (step.errorBody) step.errorBody.forEach(e => usedActions.add(e.name));
            });
        }

        // Check Diagram Sync
        if (task.flowChart) {
            logWarning(`Task "${task.name}" has embedded flowChart (should be moved to flowCharts object).`);
        }

        const hasFlowChart = (stage.flowCharts && stage.flowCharts[task.name]) ||
            (project.flowCharts && project.flowCharts[task.name]);
        if (!hasFlowChart) {
            logError(`Task "${task.name}" has no corresponding Flow-Diagram (flowCharts["${task.name}"] missing).`);
        } else {
            // Check Flow/Pascal Sync: Number of nodes vs sequence length
            const chart = (stage.flowCharts && stage.flowCharts[task.name]) || (project.flowCharts && project.flowCharts[task.name]);
            const actionNodes = (chart.elements || []).filter(e => e.type === 'Action' || e.type === 'DataAction' || e.type === 'FlowAction');

            const countSteps = (steps) => {
                let count = 0;
                steps.forEach(s => {
                    count++;
                    if (s.successBody) count += countSteps(s.successBody);
                    if (s.errorBody) count += countSteps(s.errorBody);
                    if (s.body) count += countSteps(s.body);
                });
                return count;
            };
            const sequenceCount = countSteps(task.actionSequence || []);

            if (actionNodes.length !== sequenceCount) {
                logWarning(`Task "${task.name}": Flow-Diagram has ${actionNodes.length} Action nodes, but actionSequence has ${sequenceCount} steps (incl. branches). Possible Desync!`);
            }
        }
    });
});

// 3. Check for Orphans
allTasks.forEach((info, name) => {
    // Exception: stage_blueprint items are usually global and expected
    if (info.stage === 'stage_blueprint') return;
    if (!usedTasks.has(name)) {
        logWarning(`Task "${name}" in Stage "${info.stage}" is orphaned (not triggered by any Event).`);
    }
});

// 4. Geister-Diagramme
project.stages.forEach(stage => {
    if (stage.flowCharts) {
        Object.keys(stage.flowCharts).forEach(chartName => {
            if (chartName === 'global') return;
            if (!allTasks.has(chartName)) {
                logError(`Stage "${stage.id}" has orphaned Flow-Diagram "${chartName}" without a Task definition.`);
            }
        });
    }
});

// --- SUMMARY ---
console.log('\n--- Validation Summary ---');
if (errorCount === 0 && warningCount === 0) {
    console.log('\x1b[32m✔ Project is healthy!\x1b[0m');
} else {
    console.log(`Finished with \x1b[31m${errorCount} Errors\x1b[0m and \x1b[33m${warningCount} Warnings\x1b[0m.`);
}

if (errorCount > 0) {
    process.exit(1);
}
