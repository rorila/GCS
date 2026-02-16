
import fs from 'fs';

const path = './game-server/public/platform/project.json';

try {
    const project = JSON.parse(fs.readFileSync(path, 'utf8'));
    console.log('--- MOVING GLOBALS TO BLUEPRINT ---');

    // 1. Find or Create Blueprint Stage
    let blueprintStage = project.stages.find(s => s.id === 'stage_blueprint');
    if (!blueprintStage) {
        console.error('CRITICAL: Blueprint Stage not found!');
        process.exit(1);
    }

    if (!blueprintStage.objects) blueprintStage.objects = [];
    if (!blueprintStage.variables) blueprintStage.variables = [];

    const globalObjMap = new Map();
    // Pre-populate with existing blueprint objects
    blueprintStage.objects.forEach(o => globalObjMap.set(o.name, o));

    let movedCount = 0;

    // Helper to process stage
    function processStage(stage) {
        if (stage.id === 'stage_blueprint') return;

        // Objects
        if (stage.objects) {
            const localObjects = [];
            stage.objects.forEach(o => {
                if (o.scope === 'global') {
                    console.log(`Moving global object "${o.name}" from "${stage.id}" to Blueprint.`);
                    if (!globalObjMap.has(o.name)) {
                        globalObjMap.set(o.name, o);
                        movedCount++;
                    } else {
                        console.log(` -> Merged/Skipped duplicate "${o.name}"`);
                    }
                } else {
                    localObjects.push(o);
                }
            });
            stage.objects = localObjects;
        }
    }

    // Process all stages
    if (project.stages) {
        project.stages.forEach(processStage);
    }

    // Re-populate Blueprint Objects
    blueprintStage.objects = Array.from(globalObjMap.values());
    console.log(`Blueprint now has ${blueprintStage.objects.length} global objects (Moved: ${movedCount}).`);

    // Write back
    fs.writeFileSync(path, JSON.stringify(project, null, 2));
    console.log('Project JSON updated.');

} catch (e) {
    console.error('Error:', e);
}
