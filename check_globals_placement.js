
import fs from 'fs';

const path = './game-server/public/platform/project.json';

try {
    const project = JSON.parse(fs.readFileSync(path, 'utf8'));
    console.log('--- GLOBAL PLACEMENT CHECK ---');

    project.stages.forEach(stage => {
        const isBlueprint = stage.id === 'stage_blueprint';

        // Check Variables
        if (stage.variables) {
            stage.variables.forEach(v => {
                if (v.scope === 'global' && !isBlueprint) {
                    console.log(`[FAIL] Global Variable "${v.name}" found on non-blueprint stage "${stage.id}"`);
                }
                if (isBlueprint && !v.isVariable) { // Assuming isVariable or className check
                    // strict check might be hard on raw JSON, usually variable classes start with T...Variable
                }
            });
        }

        // Check Objects
        if (stage.objects) {
            stage.objects.forEach(o => {
                if (o.scope === 'global' && !isBlueprint) {
                    console.log(`[FAIL] Global Object "${o.name}" found on non-blueprint stage "${stage.id}"`);
                }

                // Check if Variable is in Objects array
                if (isBlueprint && (o.isVariable || o.className.includes('Variable'))) {
                    console.log(`[WARN] Variable "${o.name}" found in OBJECTS array of Blueprint Stage! This makes it visible everywhere.`);
                }
            });
        }

        // Check Tasks
        if (stage.tasks) {
            stage.tasks.forEach(t => {
                if (t.scope === 'global' && !isBlueprint) {
                    console.log(`[FAIL] Global Task "${t.name}" found on non-blueprint stage "${stage.id}"`);
                }
            });
        }
    });

    console.log('--- Check Complete ---');

} catch (e) {
    console.error('Error:', e);
}
