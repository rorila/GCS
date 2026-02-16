
import fs from 'fs';

// Mock Editor/Stage context
const activeStage = { id: 'stage_blueprint', type: 'blueprint' };
const currentObjects = [
    { id: 'btn1', className: 'TButton', scope: 'stage_blueprint' },
    { id: 'var_local', className: 'TStringVariable', isVariable: true, scope: 'stage_blueprint' },
    { id: 'var_global', className: 'TObjectVariable', isVariable: true, scope: 'global' } // THE TEST CASE
];

// Mock Project
const project = {
    stages: [
        { id: 'stage_blueprint', type: 'blueprint', objects: [], variables: [] }
    ]
};

console.log('--- SYNC LOGIC SIMULATION ---');

// The Logic from Editor.ts (patched)
const projectStage = project.stages.find(s => s.id === activeStage.id);

if (projectStage) {
    projectStage.objects = currentObjects.filter(o =>
        !o.isVariable && !o.isTransient &&
        (o.scope === activeStage.id || !o.scope || o.scope === 'stage')
    );

    // NEW LOGIC
    projectStage.variables = currentObjects.filter(o =>
        o.isVariable && !o.isTransient &&
        (
            o.scope === activeStage.id ||
            o.scope === 'stage' ||
            (activeStage.type === 'blueprint' && o.scope === 'global') // Allow global variables on Blueprint Stage
        )
    );

    console.log(`Synced Objects: ${projectStage.objects.length}`);
    console.log(`Synced Variables: ${projectStage.variables.length}`);

    const hasGlobal = projectStage.variables.some(v => v.id === 'var_global');
    if (hasGlobal) {
        console.log('[PASS] Global variable "var_global" preserved on Blueprint Stage.');
    } else {
        console.error('[FAIL] Global variable "var_global" was filtered out!');
    }
} else {
    console.error('Project stage not found');
}
