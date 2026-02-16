
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

        console.log(`\n--- DataAction1 Verification ---`);
        const loginStage = project.stages.find(s => s.id === 'stage_login');
        if (loginStage) {
            const da = (loginStage.actions || []).find(a => a.name === 'DataAction1');
            if (da) {
                console.log('Found DataAction1 in stage_login actions:');
                console.log(JSON.stringify(da, null, 2));
            } else {
                console.warn('DataAction1 NOT found in stage_login.actions');
                // Check global actions
                const globalDa = (project.actions || []).find(a => a.name === 'DataAction1');
                if (globalDa) {
                    console.log('Found DataAction1 in GLOBAL actions:');
                    console.log(JSON.stringify(globalDa, null, 2));
                }
            }
        } else {
            console.error('stage_login not found');
        }

        console.log(`\n--- Project Stages (${project.stages.length}) ---`);
        project.stages.forEach(s => {
            console.log(`Stage: ${s.name} (${s.id}) | Type: ${s.type}`);
            console.log(`  - Objects: ${s.objects ? s.objects.length : 0}`);
            console.log(`  - Variables: ${s.variables ? s.variables.length : 0}`);

            if (s.objects && s.objects.length > 0) {
                console.log(`    Sample Objects: ${s.objects.slice(0, 3).map(o => o.name).join(', ')}`);
            }
        });

        const findVar = (vars, source) => {
            if (!vars) return;
            vars.forEach(v => {
                if (v.name === 'currentUser' || v.id === 'var_currentUser') {
                    console.log(`FOUND in ${source}:`);
                    console.log(JSON.stringify(v, null, 2));
                }
            });
        };

        findVar(project.variables, 'Global');

        if (project.stages) {
            project.stages.forEach(stage => {
                findVar(stage.variables, `Stage: ${stage.name}`);
            });
        }
    } else {
        console.error('project.json not found');
    }

} catch (e) {
    console.error('Error:', e);
}
