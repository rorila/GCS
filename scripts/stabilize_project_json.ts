import fs from 'fs';

const projectPath = 'c:/Users/rolfr/.gemini/antigravity/scratch/game-builder-v1/game-server/public/platform/project.json';

function cleanupProject() {
    console.log('--- Stabilizing project.json (Normalizing Stages) ---');
    const data = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
    let changes = 0;

    if (data.stages) {
        data.stages.forEach(stage => {
            // 1. Tasks -> tasks
            if (stage.Tasks && !stage.tasks) {
                console.log(`Normalizing Tasks -> tasks in stage: ${stage.name}`);
                stage.tasks = stage.Tasks;
                delete stage.Tasks;
                changes++;
            }
        });
    }

    if (changes > 0) {
        fs.writeFileSync(projectPath, JSON.stringify(data, null, 2));
        console.log(`Success: stabilized ${changes} inconsistencies.`);
    } else {
        console.log('No inconsistencies found.');
    }
}

cleanupProject();
