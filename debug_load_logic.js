
import fs from 'fs';

const project = JSON.parse(fs.readFileSync('./game-server/public/platform/project.json', 'utf8'));
console.log('--- DEBUG LOAD LOGIC ---');

// Mock classes
class TStringVariable { constructor(name, x, y) { this.className = 'TStringVariable'; this.name = name; } }
class TObjectVariable { constructor(name, x, y) { this.className = 'TObjectVariable'; this.name = name; } }
// ... add others if needed

function hydrateObjects(objectsData) {
    const objects = [];
    objectsData.forEach(objData => {
        let newObj = null;
        switch (objData.className) {
            case 'TStringVariable':
                newObj = new TStringVariable(objData.name, objData.x, objData.y);
                break;
            case 'TObjectVariable':
                newObj = new TObjectVariable(objData.name, objData.x, objData.y);
                break;
            // ... (only checking relevant vars)
            default:
                // console.warn("Unknown class:", objData.className);
                break;
        }
        if (newObj) {
            newObj.id = objData.id;
            newObj.isVariable = objData.isVariable;
            objects.push(newObj);
        }
    });
    return objects;
}

const blueprintStage = project.stages.find(s => s.id === 'stage_blueprint');
if (blueprintStage) {
    console.log(`Blueprint Raw Variables: ${blueprintStage.variables ? blueprintStage.variables.length : 0}`);
    if (blueprintStage.variables) {
        blueprintStage.variables.forEach(v => console.log(` - ${v.name} (${v.className})`));

        const hydrated = hydrateObjects(blueprintStage.variables);
        console.log(`Hydrated Variables: ${hydrated.length}`);
        hydrated.forEach(v => console.log(` - ${v.name} [${v.className}] ID=${v.id}`));
    }
} else {
    console.error('Blueprint Stage not found');
}
