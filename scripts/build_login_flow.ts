/**
 * build_login_flow.ts (V3 - THE AGENT INTERFACE MASTERPIECE 🏆)
 * ============================================================
 * Nutzt AUSSCHLIESSLICH die AgentController-API.
 * - Automatische Stage-Action Erkennung (Blueprint).
 * - Automatische FlowChart-Generierung mit Layout.
 * - Keine manuellen JSON-Manipulationen.
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

// 1. Projekt laden
const projectPath = path.resolve(__dirname, '../game-server/public/platform/project.json');
const project: GameProject = JSON.parse(fs.readFileSync(projectPath, 'utf-8'));
agentController.setProject(project);

console.log('🚀 Erstelle Login-Flow (V3 API)...');

// 2. Logic via API (Der Agent muss sich nicht um die Lokalität kümmern!)
agentController.addBranch(
    'AttemptLogin',
    'currentUser.role',
    '!=',
    '',
    (then: BranchBuilder) => {
        then.addNewAction('navigate_stage', 'GotoDashboard', {
            stageId: 'stage_dashboard'
        });
    },
    (els: BranchBuilder) => {
        els.addNewAction('call_method', 'ShowLoginError', {
            target: 'Toaster',
            method: 'show',
            params: ['Login fehlgeschlagen – bitte erneut versuchen', 'error']
        });
        els.addNewAction('set_variable', 'ClearPIN', {
            variableName: 'currentPIN',
            value: ''
        });
    }
);

// 3. Flow-Diagramm generieren (Jetzt offizieller Teil der API!)
agentController.generateTaskFlow('AttemptLogin');

// 4. Speichern
fs.writeFileSync(projectPath, JSON.stringify(project, null, 2), 'utf-8');

console.log('✅ Flow & Diagramm erfolgreich über AgentController API erstellt!');
