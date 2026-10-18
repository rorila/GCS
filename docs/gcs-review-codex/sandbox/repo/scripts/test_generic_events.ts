import { PascalGenerator } from '../src/editor/PascalGenerator';
import { GameProject, ProjectVariable } from '../src/model/types';

// Mock Project
const mockProject: any = {
    meta: { name: 'GenericEventTest', author: 'Test', version: '1.0', created: 0, modified: 0 },
    stages: [{
        id: 'stage1',
        name: 'MainStage',
        type: 'main',
        background: '',
        tasks: [],
        grid: { columns: 0, rows: 0, width: 0, height: 0, visible: false } // Added dummy grid
    }],
    tasks: [],
    actions: [],
    objects: [],
    variables: []
};

// Mock Variable with a STANDARD event and a CUSTOM event
// We use 'as any' to allow adding arbitrary properties not in the strict interface
const genericVar: any = {
    name: 'testVar',
    type: 'integer',
    scope: 'global',
    value: 0,
    Tasks: {
        onValueChanged: 'Task_Standard',  // Standard event in Tasks object
        onMyCustomEvent: 'Task_Custom'    // Custom/New event in Tasks object
    }
};

mockProject.variables!.push(genericVar);

// Generate Code
console.log('--- Generating Pascal Code ---');
let code = '';
try {
    code = PascalGenerator.generateFullProgram(mockProject, false); // asHtml=false for raw text
} catch (e) {
    console.error('CRITICAL ERROR:', e);
    process.exit(1);
}

console.log(code);

// Verification: Check if both events are present
if (code.includes('testVar.onValueChanged();') && code.includes('Task_Standard();')) {
    console.log('✅ Standard Event (onValueChanged) generated.');
} else {
    console.error('❌ Standard Event MISSING!');
}

if (code.includes('testVar.onMyCustomEvent();') && code.includes('Task_Custom();')) {
    console.log('✅ Custom Event (onMyCustomEvent) generated -> Generator is GENERIC!');
} else {
    console.error('❌ Custom Event MISSING -> Generator is NOT generic!');
}
