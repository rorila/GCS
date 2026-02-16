
console.log('--- REFACTORING MANAGER SIMULATION ---');

// Mock Project Data
const globalVarNames = new Set(['currentPIN', 'currentUser']); // Assume these exist globally or are flagged as such
const project = {
    variables: [], // Root variables might be empty if they are ONLY in Blueprint
    stages: [
        {
            id: 'stage_blueprint',
            name: 'Blueprint',
            variables: [
                { name: 'currentPIN', scope: 'global' },
                { name: 'currentUser', scope: 'global' },
                { name: 'localVar', scope: 'stage' }
            ]
        },
        {
            id: 'stage_game',
            name: 'Game Stage',
            variables: [
                { name: 'currentPIN', scope: 'global' }, // Should be removed (duplicate)
                { name: 'levelVar', scope: 'stage' }
            ]
        }
    ]
};

const report = [];

// The Logic from RefactoringManager.ts (patched)
project.stages.forEach(stage => {
    if (stage.variables) {
        const originalCount = stage.variables.length;

        // PATCHED LOGIC: Skip Blueprint Stage
        if (stage.id !== 'stage_blueprint') {
            stage.variables = stage.variables.filter((v) => {
                const isGlobal = v.scope === 'global' || globalVarNames.has(v.name);
                return !isGlobal;
            });
        }

        if (stage.variables.length < originalCount) {
            report.push(`${originalCount - stage.variables.length} doppelte Variablen in Stage "${stage.name}" entfernt (Global Conflict Cleanup).`);
        }
    }
});

console.log('Sanitization Report:', report);

// Verify Results
const blueprint = project.stages.find(s => s.id === 'stage_blueprint');
const game = project.stages.find(s => s.id === 'stage_game');

console.log(`Blueprint Variables: ${blueprint.variables.length} (Expected: 3)`);
console.log(` - currentPIN: ${blueprint.variables.some(v => v.name === 'currentPIN')}`);
console.log(` - currentUser: ${blueprint.variables.some(v => v.name === 'currentUser')}`);

console.log(`Game Stage Variables: ${game.variables.length} (Expected: 1)`);

if (blueprint.variables.length === 3 && game.variables.length === 1) {
    console.log('[PASS] Refactoring Logic Correct: Blueprint untouched, Game Stage cleaned.');
} else {
    console.error('[FAIL] Refactoring Logic Incorrect!');
}
