import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_PATH = path.join(__dirname, '../game-server/public/platform/project.json');
const GIT_HEAD_PATH = path.join(__dirname, '../temp_project_head.json');

function recoverBlueprint() {
    console.log('[Recovery] Starting Blueprint Recovery from Git HEAD...');

    // 1. Load Git HEAD Version
    if (!fs.existsSync(GIT_HEAD_PATH)) {
        console.error('[Recovery] Error: temp_project_head.json not found!');
        process.exit(1);
    }
    const gitProject = JSON.parse(fs.readFileSync(GIT_HEAD_PATH, 'utf8'));
    const gitBlueprint = gitProject.stages.find(s => s.id === 'stage_blueprint');

    if (!gitBlueprint) {
        console.error('[Recovery] Error: No stage_blueprint found in Git HEAD!');
        process.exit(1);
    }

    console.log(`[Recovery] Found Blueprint in Git: ${gitBlueprint.objects.length} objects, ${gitBlueprint.variables.length} variables.`);

    // 2. Load Current Project
    if (!fs.existsSync(PROJECT_PATH)) {
        console.error('[Recovery] Error: Current project.json not found!');
        process.exit(1);
    }
    const currentProject = JSON.parse(fs.readFileSync(PROJECT_PATH, 'utf8'));

    // 3. Find and Replace Blueprint Stage
    const currentBlueprintIndex = currentProject.stages.findIndex(s => s.id === 'stage_blueprint');

    if (currentBlueprintIndex === -1) {
        console.warn('[Recovery] Warning: stage_blueprint not found in current project. Appending it.');
        currentProject.stages.push(gitBlueprint);
    } else {
        const currentBlueprint = currentProject.stages[currentBlueprintIndex];
        console.log(`[Recovery] Replacing corrupted Blueprint (Objects: ${currentBlueprint.objects ? currentBlueprint.objects.length : 0}) with Git version.`);

        // Full replace
        currentProject.stages[currentBlueprintIndex] = gitBlueprint;
    }

    // 4. Save
    fs.writeFileSync(PROJECT_PATH, JSON.stringify(currentProject, null, 2), 'utf8');
    console.log('[Recovery] SUCCESS: project.json updated.');

    // 5. Cleanup
    try {
        if (fs.existsSync(GIT_HEAD_PATH)) {
            fs.unlinkSync(GIT_HEAD_PATH);
            console.log('[Recovery] Cleaned up temp file.');
        }
    } catch (e) {
        console.warn('[Recovery] Warning: Could not delete temp file:', e.message);
    }
}

recoverBlueprint();
