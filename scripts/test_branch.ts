/**
 * Test: addBranch() Methode des AgentControllers
 * Verifiziert, dass Branches korrekt in die actionSequence eingefügt werden.
 */
import { agentController, BranchBuilder } from '../src/services/AgentController';
import { GameProject } from '../src/model/types';

// Setup Mock-Projekt
const mockProject: GameProject = {
    meta: { name: 'BranchTest' } as any,
    stage: { grid: {} } as any,
    objects: [],
    tasks: [],
    stages: [{ id: 's1', name: 'TestStage', tasks: [], variables: [] } as any],
    actions: [],
    variables: [],
    flowCharts: {}
};

agentController.setProject(mockProject);

// 1. Task erstellen
console.log('1. Task erstellen...');
agentController.createTask('s1', 'LoginFlow', 'Login mit Branch');

// 2. Lineare Action
console.log('2. Lineare Action hinzufügen...');
agentController.addAction('LoginFlow', 'data_action', 'doAuth', { url: '/api/login' });

// 3. Branch hinzufügen
console.log('3. Branch hinzufügen...');
agentController.addBranch(
    'LoginFlow',
    'loginResult.success',
    '==',
    'true',
    // THEN (Gutfall)
    (then) => {
        then.addNewAction('service', 'StoreJWT', { token: '${loginResult.token}' });
        then.addNewAction('navigate_stage', 'GotoDashboard', { targetStage: 'stage_dashboard' });
    },
    // ELSE (Schlechtfall)
    (els) => {
        els.addNewAction('service', 'ShowError', { message: 'Login fehlgeschlagen' });
        els.addNewAction('set_variable', 'ClearPIN', { variableName: 'currentPIN', value: '' });
    }
);

// === VALIDIERUNG ===
let errors = 0;

// Check: actionSequence hat 2 Einträge (doAuth + Branch)
const task = mockProject.tasks!.find(t => t.name === 'LoginFlow');
if (!task) { console.error('❌ Task nicht gefunden!'); process.exit(1); }

if (task.actionSequence.length !== 2) {
    console.error(`❌ Erwartete 2 Sequenz-Items, bekommen: ${task.actionSequence.length}`);
    errors++;
} else {
    console.log('✅ actionSequence hat 2 Items (Action + Branch)');
}

// Check: Erstes Item ist doAuth
const firstItem = task.actionSequence[0];
if (firstItem.type !== 'action' || firstItem.name !== 'doAuth') {
    console.error('❌ Erstes Item ist nicht doAuth!');
    errors++;
} else {
    console.log('✅ Erstes Item: doAuth (action)');
}

// Check: Zweites Item ist condition
const branchItem = task.actionSequence[1];
if (branchItem.type !== 'condition') {
    console.error(`❌ Zweites Item hat Typ '${branchItem.type}', erwarte 'condition'`);
    errors++;
} else {
    console.log('✅ Zweites Item: condition');
}

// Check: Branch condition
if (branchItem.condition?.variable !== 'loginResult.success' || branchItem.condition?.operator !== '==') {
    console.error('❌ Condition ist falsch!', branchItem.condition);
    errors++;
} else {
    console.log('✅ Condition: loginResult.success == true');
}

// Check: Then-Branch hat 2 Actions
if (!branchItem.then || branchItem.then.length !== 2) {
    console.error(`❌ Then-Branch: Erwarte 2 Actions, bekommen: ${branchItem.then?.length}`);
    errors++;
} else {
    console.log(`✅ Then-Branch: ${branchItem.then.map((i: any) => i.name).join(' → ')}`);
}

// Check: Else-Branch hat 2 Actions
if (!branchItem.else || branchItem.else.length !== 2) {
    console.error(`❌ Else-Branch: Erwarte 2 Actions, bekommen: ${branchItem.else?.length}`);
    errors++;
} else {
    console.log(`✅ Else-Branch: ${branchItem.else.map((i: any) => i.name).join(' → ')}`);
}

// Check: Alle Actions global definiert
const expectedActions = ['doAuth', 'StoreJWT', 'GotoDashboard', 'ShowError', 'ClearPIN'];
for (const name of expectedActions) {
    const found = mockProject.actions?.find(a => a.name === name);
    if (!found) {
        console.error(`❌ Global Action '${name}' fehlt!`);
        errors++;
    }
}
console.log(`✅ ${expectedActions.length} Actions global definiert`);

// Check: FlowChart wurde invalidiert (sollte nicht existieren)
if (mockProject.flowCharts && (mockProject.flowCharts as any)['LoginFlow']) {
    console.error('❌ FlowChart existiert noch – sollte gelöscht sein!');
    errors++;
} else {
    console.log('✅ FlowChart wurde invalidiert');
}

// Zusammenfassung
console.log('\n=== actionSequence (JSON) ===');
console.log(JSON.stringify(task.actionSequence, null, 2));

if (errors === 0) {
    console.log('\n🎉 ALLE addBranch TESTS BESTANDEN!');
} else {
    console.error(`\n❌ ${errors} FEHLER aufgetreten!`);
    process.exit(1);
}
