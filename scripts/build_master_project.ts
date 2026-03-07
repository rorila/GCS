import { agentController, BranchBuilder } from '../src/services/AgentController';
import { GameProject } from '../src/model/types';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Projekt-Basis erstellen
const projectPath = path.resolve(__dirname, '../projects/master_test/project.json');
const projectsDir = path.dirname(projectPath);
if (!fs.existsSync(projectsDir)) {
    fs.mkdirSync(projectsDir, { recursive: true });
}
const project: GameProject = {
    meta: { name: "Master-Test-Project", version: "1.0.0", author: "Antigravity" },
    stage: { grid: { cols: 20, rows: 15, cellSize: 40, snapToGrid: true, visible: true, backgroundColor: "#1a1a1a" } },
    stages: [],
    objects: [],
    actions: [],
    tasks: [],
    variables: []
};

agentController.setProject(project);

console.log('🏗️  Baue Master-Test-Projekt (3 Stages)...');

// --- STAGE 0: BLUEPRINT ---
agentController.createStage('stage_blueprint', 'Blueprint (Global)', 'blueprint');
agentController.addVariable('isAuthorized', 'boolean', false);
agentController.addVariable('userScore', 'integer', 0);

// Globales Hintergrund-Objekt (Blueprint)
agentController.addObject('stage_blueprint', {
    name: 'global_bg',
    type: 'Panel',
    x: 0, y: 0, width: 800, height: 600,
    properties: { backgroundColor: '#2a2a2a', alpha: 0.5 }
});

// --- STAGE 1: START ---
agentController.createStage('stage_one', 'Initial Stage', 'standard');
agentController.addObject('stage_one', {
    name: 'btn_next',
    type: 'Button',
    x: 350, y: 250, width: 100, height: 40,
    properties: { text: 'Next Stage' },
    events: { onClick: 'CheckAuthAndNavigate' }
});

agentController.createTask('stage_one', 'CheckAuthAndNavigate', 'Prüft Auth und navigiert');
agentController.addBranch(
    'CheckAuthAndNavigate',
    'isAuthorized',
    '==',
    'true',
    (then: BranchBuilder) => {
        then.addNewAction('navigate_stage', 'GotoStageTwo', { stageId: 'stage_two' });
    },
    (els: BranchBuilder) => {
        els.addNewAction('call_method', 'ShowDenied', {
            target: 'Toaster',
            method: 'show',
            params: ['Zugriff verweigert!', 'error']
        });
    }
);
agentController.generateTaskFlow('CheckAuthAndNavigate');

// --- STAGE 2: TARGET ---
agentController.createStage('stage_two', 'Feature Stage', 'standard');
agentController.addObject('stage_two', {
    name: 'lbl_welcome',
    type: 'Label',
    x: 50, y: 50, width: 300, height: 40,
    properties: { text: 'Willkommen in Stage 2' }
});

agentController.createTask('stage_two', 'Task_RenameMe', 'Task für Rename-Vakuum-Test');
agentController.addAction('Task_RenameMe', 'call_method', 'Heartbeat', { target: 'Logger', method: 'info', params: ['I am alive'] });
agentController.generateTaskFlow('Task_RenameMe');

// 4. Speichern
fs.writeFileSync(projectPath, JSON.stringify(project, null, 2), 'utf-8');

console.log('✅ Master-Test-Projekt erfolgreich erstellt unter: ' + projectPath);
console.log('Szenarien:');
console.log('- [x] 3 Stages (Blueprint, One, Two)');
console.log('- [x] If-Bedingung (True/False Pfade) in Stage One');
console.log('- [x] Globale Variablen & Blueprint-Objekte');
console.log('- [x] Navigation-Flow');
