/**
 * build_login_flow.ts (V2 - Jetzt mit FlowChart-Generierung!)
 * ============================================================
 * Erzeugt den Login-Flow und das zugehörige Flow-Diagramm.
 * Platziert Actions direkt in der Blueprint-Stage.
 * 
 * Verwendung: npx tsx scripts/build_login_flow.ts
 * ============================================================
 */
import { agentController, BranchBuilder } from '../src/services/AgentController';
import { GameProject } from '../src/model/types';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// 1. PROJEKT LADEN
// ============================================================
const projectPath = path.resolve(__dirname, '../game-server/public/platform/project.json');
console.log(`📂 Lade Projekt: ${projectPath}`);

if (!fs.existsSync(projectPath)) {
    console.error('❌ project.json nicht gefunden!');
    process.exit(1);
}

const project: GameProject = JSON.parse(fs.readFileSync(projectPath, 'utf-8'));
agentController.setProject(project);

// ============================================================
// 2. SETUP STAGE & ACTIONS
// ============================================================
const blueprint = project.stages?.find(s => s.id === 'stage_blueprint');
if (!blueprint) {
    console.error('❌ stage_blueprint nicht gefunden!');
    process.exit(1);
}

// Actions in der Blueprint Stage definieren (statt Global)
const ensureStageAction = (action: any) => {
    if (!blueprint.actions) blueprint.actions = [];
    const idx = blueprint.actions.findIndex(a => a.name === action.name);
    if (idx >= 0) {
        blueprint.actions[idx] = action;
    } else {
        blueprint.actions.push(action);
    }
    // Aus Global entfernen falls dort vorhanden (Bereinigung)
    project.actions = project.actions?.filter(a => a.name !== action.name);
};

console.log('📦 Definiere Actions in stage_blueprint...');
ensureStageAction({
    name: 'GotoDashboard',
    type: 'navigate_stage',
    stageId: 'stage_dashboard'
});
ensureStageAction({
    name: 'ShowLoginError',
    type: 'call_method',
    target: 'Toaster',
    method: 'show',
    params: ['Login fehlgeschlagen – bitte erneut versuchen', 'error']
});
ensureStageAction({
    name: 'ClearPIN',
    type: 'set_variable',
    variableName: 'currentPIN',
    value: ''
});

// ============================================================
// 3. TASK STRUKTUR GEWÄHRLEISTEN
// ============================================================
console.log('📋 Erneuere AttemptLogin actionSequence...');
const task = blueprint.tasks?.find(t => t.name === 'AttemptLogin');
if (!task) {
    console.error('❌ Task AttemptLogin nicht gefunden!');
    process.exit(1);
}

// Reset der Sequenz für sauberen Aufbau
task.actionSequence = [
    { name: 'doTheAuthenfification', type: 'action' },
    {
        type: 'condition',
        name: 'Login Check',
        condition: {
            variable: 'currentUser.role',
            operator: '!=',
            value: ''
        },
        then: [
            { type: 'action', name: 'GotoDashboard' }
        ],
        else: [
            { type: 'action', name: 'ShowLoginError' },
            { type: 'action', name: 'ClearPIN' }
        ]
    }
];

// ============================================================
// 4. FLOWCHART GENERIERUNG (Der "Manual-Healing" Part)
// ====================s=======================================
console.log('🎨 Generiere FlowChart Diagramm...');

function generateManualFlow(task: any) {
    const elements: any[] = [];
    const connections: any[] = [];
    let nextId = 1;
    const getId = (type: string) => `node-${Date.now()}-${nextId++}`;

    // Root Node
    const rootId = getId('task');
    elements.push({
        id: rootId,
        type: 'Task',
        x: 400, y: 50,
        properties: { name: task.name, text: task.name, description: task.description },
        data: { name: task.name }
    });

    let currentY = 180;
    let lastId = rootId;

    task.actionSequence.forEach((item: any) => {
        const id = getId(item.type);

        if (item.type === 'condition') {
            // Condition Diamond
            elements.push({
                id, type: 'Condition',
                x: 400, y: currentY,
                properties: { text: `${item.condition.variable} ${item.condition.operator} ${item.condition.value}` }
            });
            connections.push({
                startTargetId: lastId, endTargetId: id,
                data: { startAnchorType: 'output', endAnchorType: 'input' }
            });

            // Branches
            const branchY = currentY + 130;

            // THEN Branch
            if (item.then?.[0]) {
                const thenId = getId('action');
                elements.push({
                    id: thenId, type: 'Action',
                    x: 150, y: branchY,
                    properties: { name: item.then[0].name, text: item.then[0].name },
                    data: { name: item.then[0].name, isLinked: true }
                });
                connections.push({
                    startTargetId: id, endTargetId: thenId,
                    data: { startAnchorType: 'true', endAnchorType: 'input' }
                });
            }

            // ELSE Branch
            if (item.else?.[0]) {
                const elseId = getId('action');
                elements.push({
                    id: elseId, type: 'Action',
                    x: 650, y: branchY,
                    properties: { name: item.else[0].name, text: item.else[0].name },
                    data: { name: item.else[0].name, isLinked: true }
                });
                connections.push({
                    startTargetId: id, endTargetId: elseId,
                    data: { startAnchorType: 'false', endAnchorType: 'input' }
                });

                // Zweite Action im Else (ClearPIN)
                if (item.else?.[1]) {
                    const else2Id = getId('action');
                    elements.push({
                        id: else2Id, type: 'Action',
                        x: 650, y: branchY + 120,
                        properties: { name: item.else[1].name, text: item.else[1].name },
                        data: { name: item.else[1].name, isLinked: true }
                    });
                    connections.push({
                        startTargetId: elseId, endTargetId: else2Id,
                        data: { startAnchorType: 'output', endAnchorType: 'input' }
                    });
                }
            }

            currentY = branchY + 250;
            lastId = id; // Für Folge-Actions (hier keine)
        } else {
            // Normale Action
            elements.push({
                id, type: 'Action',
                x: 400, y: currentY,
                properties: { name: item.name, text: item.name },
                data: { name: item.name, isLinked: true }
            });
            connections.push({
                startTargetId: lastId, endTargetId: id,
                data: { startAnchorType: 'output', endAnchorType: 'input' }
            });
            lastId = id;
            currentY += 130;
        }
    });

    return { elements, connections };
}

if (!blueprint.flowCharts) blueprint.flowCharts = {};
blueprint.flowCharts['AttemptLogin'] = generateManualFlow(task);

// ============================================================
// 5. SPEICHERN
// ============================================================
console.log('💾 Speichere project.json...');
fs.writeFileSync(projectPath, JSON.stringify(project, null, 2), 'utf-8');
console.log('✅ Fertig! Bitte lade den Editor jetzt neu.');
