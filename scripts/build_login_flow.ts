/**
 * build_login_flow.ts
 * ============================================================
 * Erster REALER Use-Case über die AgentController API!
 * 
 * Lädt die echte project.json vom Server, erweitert den bestehenden
 * AttemptLogin-Task um einen Branch (Gutfall/Schlechtfall), und
 * schreibt das Ergebnis zurück.
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
console.log(`✅ Projekt geladen: "${project.meta?.name}" (${project.stages?.length || 0} Stages)`);

// ============================================================
// 2. BESTANDSAUFNAHME
// ============================================================
const blueprint = project.stages?.find(s => s.id === 'stage_blueprint');
if (!blueprint) {
    console.error('❌ stage_blueprint nicht gefunden!');
    process.exit(1);
}

const existingTask = blueprint.tasks?.find(t => t.name === 'AttemptLogin');
if (!existingTask) {
    console.error('❌ AttemptLogin Task nicht gefunden!');
    process.exit(1);
}

console.log(`✅ AttemptLogin gefunden – aktuelle actionSequence: ${existingTask.actionSequence.length} Items`);
console.log(`   Actions: ${existingTask.actionSequence.map(a => a.name || a.type).join(' → ')}`);

const existingAuth = blueprint.actions?.find(a => a.name === 'doTheAuthenfification');
if (!existingAuth) {
    console.error('❌ Action doTheAuthenfification nicht gefunden!');
    process.exit(1);
}
console.log(`✅ doTheAuthenfification gefunden (type: ${existingAuth.type}, requestJWT: ${(existingAuth as any).requestJWT})`);

// Prüfe ob Branch bereits existiert
const hasBranch = existingTask.actionSequence.some(item => item.type === 'condition');
if (hasBranch) {
    console.log('⚠️  Branch existiert bereits – überspringe Erstellung.');
    console.log('   Bestehende Sequenz:');
    console.log(JSON.stringify(existingTask.actionSequence, null, 2));
    process.exit(0);
}

// ============================================================
// 3. BRANCH HINZUFÜGEN via AgentController API
// ============================================================
console.log('\n🔀 Füge Login-Branch hinzu...');

agentController.addBranch(
    'AttemptLogin',
    // Bedingung: currentUser.role ist NICHT leer (Login erfolgreich)
    'currentUser.role',
    '!=',
    '',
    // ================================
    // THEN (Gutfall: Login erfolgreich)
    // ================================
    (then: BranchBuilder) => {
        // Navigation zum Dashboard
        then.addNewAction('navigate_stage', 'GotoDashboard', {
            stageId: 'stage_dashboard'
        });
    },
    // ================================
    // ELSE (Schlechtfall: Login fehlgeschlagen)
    // ================================
    (els: BranchBuilder) => {
        // Fehlermeldung via Toaster
        els.addNewAction('call_method', 'ShowLoginError', {
            target: 'Toaster',
            method: 'show',
            params: ['Login fehlgeschlagen – bitte erneut versuchen', 'error']
        });

        // PIN zurücksetzen
        els.addNewAction('set_variable', 'ClearPIN', {
            variableName: 'currentPIN',
            value: ''
        });
    }
);

// ============================================================
// 4. VALIDIERUNG
// ============================================================
console.log('\n=== VALIDIERUNG ===');
let errors = 0;

// 4.1: actionSequence hat jetzt 2 Items (doAuth + Branch)
const task = blueprint.tasks?.find(t => t.name === 'AttemptLogin')!;
if (task.actionSequence.length !== 2) {
    console.error(`❌ Erwartete 2 Sequenz-Items, bekommen: ${task.actionSequence.length}`);
    errors++;
} else {
    console.log('✅ actionSequence hat 2 Items (doAuth + Branch)');
}

// 4.2: Erstes Item ist doTheAuthenfification
const firstItem = task.actionSequence[0];
if (firstItem.name !== 'doTheAuthenfification') {
    console.error(`❌ Erstes Item ist '${firstItem.name}', erwartet 'doTheAuthenfification'`);
    errors++;
} else {
    console.log('✅ Erstes Item: doTheAuthenfification (data_action)');
}

// 4.3: Zweites Item ist condition
const branchItem = task.actionSequence[1];
if (branchItem.type !== 'condition') {
    console.error(`❌ Zweites Item hat Typ '${branchItem.type}', erwartet 'condition'`);
    errors++;
} else {
    console.log('✅ Zweites Item: condition (Branch)');
}

// 4.4: Condition prüfen
if (branchItem.condition?.variable !== 'currentUser.role' || branchItem.condition?.operator !== '!=') {
    console.error('❌ Condition ist falsch!', branchItem.condition);
    errors++;
} else {
    console.log(`✅ Condition: currentUser.role != '' (Login-Check)`);
}

// 4.5: Then-Branch hat 1 Action (GotoDashboard)
if (!branchItem.then || branchItem.then.length !== 1) {
    console.error(`❌ Then-Branch: Erwarte 1 Action, bekommen: ${branchItem.then?.length}`);
    errors++;
} else {
    console.log(`✅ Then-Branch: ${branchItem.then.map((i: any) => i.name).join(' → ')}`);
}

// 4.6: Else-Branch hat 2 Actions (ShowLoginError → ClearPIN)
if (!branchItem.else || branchItem.else.length !== 2) {
    console.error(`❌ Else-Branch: Erwarte 2 Actions, bekommen: ${branchItem.else?.length}`);
    errors++;
} else {
    console.log(`✅ Else-Branch: ${branchItem.else.map((i: any) => i.name).join(' → ')}`);
}

// 4.7: Alle neuen Actions global definiert
const expectedNewActions = ['GotoDashboard', 'ShowLoginError', 'ClearPIN'];
for (const name of expectedNewActions) {
    const allActions = [
        ...(project.actions || []),
        ...(blueprint.actions || [])
    ];
    const found = allActions.find(a => a.name === name);
    if (!found) {
        console.error(`❌ Global Action '${name}' fehlt!`);
        errors++;
    } else {
        console.log(`✅ Action '${name}' global definiert (type: ${found.type})`);
    }
}

// 4.8: FlowChart wurde invalidiert
const flowCharts = blueprint.flowCharts || (project.flowCharts as any) || {};
if (flowCharts['AttemptLogin']) {
    console.error('❌ FlowChart existiert noch – sollte invalidiert sein!');
    errors++;
} else {
    console.log('✅ FlowChart wurde invalidiert (wird beim Öffnen neu generiert)');
}

// ============================================================
// 5. ERGEBNIS AUSGEBEN
// ============================================================
console.log('\n=== RESULTIERENDE actionSequence ===');
console.log(JSON.stringify(task.actionSequence, null, 2));

if (errors === 0) {
    console.log('\n🎉 ALLE VALIDIERUNGEN BESTANDEN!');

    // ============================================================
    // 6. PROJEKT SPEICHERN
    // ============================================================
    console.log('\n💾 Speichere project.json...');
    fs.writeFileSync(projectPath, JSON.stringify(project, null, 2), 'utf-8');
    console.log('✅ project.json gespeichert!');
    console.log('\n📋 Nächster Schritt: Editor öffnen → AttemptLogin Task → Flow-Diagramm prüfen');
} else {
    console.error(`\n❌ ${errors} FEHLER – Projekt wird NICHT gespeichert!`);
    process.exit(1);
}
