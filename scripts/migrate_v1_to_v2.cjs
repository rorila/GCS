/**
 * Migration Script v2: Hybrid v1/v2 → sauberes v2 (Multi-Stage) Format
 * 
 * Das Tennis-Projekt hat bereits stages[] mit Objekten, aber tasks/actions/flowCharts
 * liegen auf Root-Ebene statt in den Stages. Dieses Script verschiebt sie.
 */
const fs = require('fs');
const path = require('path');

const INPUT = path.join(__dirname, '..', 'demos', 'project_NewTennis50.json');
const OUTPUT = path.join(__dirname, '..', 'demos', 'project_NewTennis50_v2.json');

console.log('📦 Lade:', INPUT);
const raw = fs.readFileSync(INPUT, 'utf-8');
const project = JSON.parse(raw);

// ─────────────────────────────────────────────
// 1. Conditions: body/elseBody → then/else (rekursiv)
// ─────────────────────────────────────────────
function migrateConditions(sequence) {
    if (!Array.isArray(sequence)) return sequence;
    return sequence.map(item => {
        if (item.type === 'condition') {
            const migrated = { ...item };
            if (item.body && !item.then) {
                migrated.then = migrateConditions(item.body);
                delete migrated.body;
            } else if (item.then) {
                migrated.then = migrateConditions(item.then);
            }
            if (item.elseBody && !item.else) {
                migrated.else = migrateConditions(item.elseBody);
                delete migrated.elseBody;
            } else if (item.else) {
                migrated.else = migrateConditions(item.else);
            }
            if (migrated.condition && !migrated.condition.operator) {
                migrated.condition.operator = '==';
            }
            return migrated;
        }
        return item;
    });
}

// ─────────────────────────────────────────────
// 2. FlowGraph Typen normalisieren (Groß → Klein)
// ─────────────────────────────────────────────
function normalizeFlowTypes(flowData) {
    if (!flowData || !flowData.elements) return flowData;
    flowData.elements = flowData.elements.map(el => {
        if (el.type === 'Task') el.type = 'task';
        if (el.type === 'Action') el.type = 'action';
        if (el.type === 'Condition') el.type = 'condition';
        return el;
    });
    if (flowData.connections) {
        let connIdx = 1;
        flowData.connections = flowData.connections.map(c => {
            if (!c.id) c.id = `conn-migrated-${connIdx++}`;
            return c;
        });
    }
    return flowData;
}

// ─────────────────────────────────────────────
// 3. Tasks: Conditions migrieren + flowGraph extrahieren
// ─────────────────────────────────────────────
const migratedFlowCharts = {};
const migratedTasks = (project.tasks || []).map(task => {
    const migrated = { ...task };
    migrated.actionSequence = migrateConditions(task.actionSequence || []);
    // flowGraph (inline am Task) → flowCharts extrahieren
    if (task.flowGraph) {
        migratedFlowCharts[task.name] = normalizeFlowTypes(JSON.parse(JSON.stringify(task.flowGraph)));
        delete migrated.flowGraph;
    }
    if (!migrated.triggerMode) migrated.triggerMode = 'local-sync';
    return migrated;
});

// ─────────────────────────────────────────────
// 4. Root-Level flowCharts normalisieren und übernehmen
// ─────────────────────────────────────────────
if (project.flowCharts) {
    for (const [name, chart] of Object.entries(project.flowCharts)) {
        migratedFlowCharts[name] = normalizeFlowTypes(JSON.parse(JSON.stringify(chart)));
    }
}

// ─────────────────────────────────────────────
// 5. Stages aufbauen — bestehende Stages übernehmen + Daten rein
// ─────────────────────────────────────────────
const newStages = [];

// Blueprint Stage: Actions hierhin
const blueprintStage = {
    id: 'stage_blueprint',
    name: 'Blueprint',
    type: 'blueprint',
    objects: [],
    tasks: [],
    actions: project.actions || [],
    variables: project.variables || [],
    flowCharts: {},
    events: {}
};
newStages.push(blueprintStage);

// Bestehende Stages übernehmen
if (Array.isArray(project.stages)) {
    for (const stage of project.stages) {
        const enhanced = {
            ...stage,
            tasks: stage.tasks || [],
            actions: stage.actions || [],
            variables: stage.variables || [],
            flowCharts: stage.flowCharts || {},
            events: stage.events || {}
        };

        // Main Stage bekommt Tasks und FlowCharts
        if (stage.id === 'main' || stage.id === project.activeStageId) {
            enhanced.id = 'stage_main';
            enhanced.tasks = migratedTasks;
            enhanced.flowCharts = { ...enhanced.flowCharts, ...migratedFlowCharts };

            // Input-Config in die Stage übertragen
            if (project.input) {
                enhanced.input = project.input;
            }
        }

        // Splash Stage ID normalisieren
        if (stage.id === 'splash') {
            enhanced.id = 'stage_splash';
            enhanced.type = 'splash';
        }

        newStages.push(enhanced);
    }
}

// ─────────────────────────────────────────────
// 6. Neues Projekt zusammenbauen
// ─────────────────────────────────────────────
const migratedProject = {
    meta: project.meta || { name: 'MigratedProject', version: '2.0.0' },
    stages: newStages,
    // Root-Level Felder für Abwärtskompatibilität (Editor greift darauf zu)
    objects: [],
    actions: [],
    tasks: [],
    variables: [],
    stage: project.stage,
    flow: project.flow,
    input: project.input,
    splashDuration: project.splashDuration,
    splashAutoHide: project.splashAutoHide,
    activeStageId: 'stage_main'
};


// ─────────────────────────────────────────────
// 7. Statistik
// ─────────────────────────────────────────────
console.log('\n📊 Migrations-Statistik:');
newStages.forEach(s => {
    console.log(`   Stage "${s.name}" (${s.id}):`);
    console.log(`     Objects:    ${(s.objects || []).length}`);
    console.log(`     Tasks:      ${(s.tasks || []).length}`);
    console.log(`     Actions:    ${(s.actions || []).length}`);
    console.log(`     FlowCharts: ${Object.keys(s.flowCharts || {}).length}`);
});

const condCount = (JSON.stringify(migratedProject).match(/"then"/g) || []).length;
console.log(`\n   Conditions body→then: ${condCount}x konvertiert`);
console.log(`   FlowChart Type-Fixes: Task→task, Action→action`);

// ─────────────────────────────────────────────
// 8. Speichern
// ─────────────────────────────────────────────
fs.writeFileSync(OUTPUT, JSON.stringify(migratedProject, null, 2), 'utf-8');
console.log(`\n✅ Migration erfolgreich! Gespeichert als: ${OUTPUT}`);
console.log(`   Dateigröße: ${(fs.statSync(OUTPUT).size / 1024).toFixed(1)} KB`);
