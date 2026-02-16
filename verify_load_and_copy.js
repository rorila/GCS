
import fs from 'fs';

const project = JSON.parse(fs.readFileSync('./game-server/public/platform/project.json', 'utf8'));
console.log('--- VERIFY LOAD & COPY LOGIC ---');

// Mock classes
class TVariable {
    constructor(name, x, y) {
        this.name = name;
        this.x = x;
        this.y = y;
        this.isVariable = true;
    }
}
class TStringVariable extends TVariable {
    constructor(name, x, y) { super(name, x, y); this.className = 'TStringVariable'; }
}
class TObjectVariable extends TVariable {
    constructor(name, x, y) { super(name, x, y); this.className = 'TObjectVariable'; }
}

// Hydrate Logic
function hydrateObjects(objectsData) {
    const objects = [];
    objectsData.forEach(objData => {
        let newObj = null;
        switch (objData.className) {
            case 'TStringVariable': newObj = new TStringVariable(objData.name, objData.x, objData.y); break;
            case 'TObjectVariable': newObj = new TObjectVariable(objData.name, objData.x, objData.y); break;
            default: break;
        }
        if (newObj) {
            Object.assign(newObj, objData); // Simulate property restore
            objects.push(newObj);
        }
    });
    return objects;
}

// DeepCopy Logic (Simplified from utils/DeepCopy.ts)
function safeDeepCopy(obj, seen = new WeakMap()) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (seen.has(obj)) return seen.get(obj);

    if (Array.isArray(obj)) {
        const result = [];
        seen.set(obj, result);
        for (let i = 0; i < obj.length; i++) result[i] = safeDeepCopy(obj[i], seen);
        return result;
    }

    const result = {};
    seen.set(obj, result);
    for (const key of Object.keys(obj)) {
        // Skip DOM elements mock
        // if (val instanceof HTMLElement) continue;
        result[key] = safeDeepCopy(obj[key], seen);
    }
    return result;
}

const blueprintStage = project.stages.find(s => s.id === 'stage_blueprint');
if (blueprintStage && blueprintStage.variables) {
    console.log(`Original JSON Variables: ${blueprintStage.variables.length}`);

    // 1. Hydrate
    const hydratedVars = hydrateObjects(blueprintStage.variables);
    console.log(`Hydrated Variables: ${hydratedVars.length}`);

    // Mock Editor Project Structure
    const mockProject = {
        stages: [
            { id: 'stage_blueprint', variables: hydratedVars }
        ]
    };

    // 2. DeepCopy (as done for JSON View)
    const copiedProject = safeDeepCopy(mockProject);
    const copiedStage = copiedProject.stages.find(s => s.id === 'stage_blueprint');

    console.log(`Copied Variables (JSON View): ${copiedStage.variables.length}`);

    if (copiedStage.variables.length > 0) {
        console.log('[PASS] Variables survived hydrate and deep copy.');
        copiedStage.variables.forEach(v => console.log(` - ${v.name} (${v.className})`));
    } else {
        console.error('[FAIL] Variables lost during deep copy!');
    }

} else {
    console.error('Blueprint Stage or variables not found in JSON');
}
