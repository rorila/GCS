
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
    const projectPath = path.resolve(__dirname, '../game-server/public/platform/project.json');
    console.log('Reading project.json from:', projectPath);

    if (fs.existsSync(projectPath)) {
        const content = fs.readFileSync(projectPath, 'utf8');
        const project = JSON.parse(content);

        console.log('--- Global Variables ---');
        if (project.variables) {
            project.variables.forEach(v => {
                console.log(`ID: ${v.id}, Name: ${v.name}, Type: ${v.type}, Model: ${v.objectModel || 'N/A'}`);
            });
        }

        console.log('\n--- Stage Variables ---');
        if (project.stages) {
            project.stages.forEach(stage => {
                if (stage.variables && stage.variables.length > 0) {
                    console.log(`Stage: ${stage.name} (${stage.id})`);
                    stage.variables.forEach(v => {
                        console.log(`  ID: ${v.id}, Name: ${v.name}, Type: ${v.type}, Model: ${v.objectModel || 'N/A'}`);
                    });
                }
            });
        }
    } else {
        console.error('project.json not found');
    }

} catch (e) {
    console.error('Error:', e);
}
