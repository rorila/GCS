import { PascalGenerator } from '../src/editor/PascalGenerator';
// Mock Project
const mockProject = {
    meta: { name: 'TestProject', version: '1.0', author: 'Debug' },
    stage: {
        grid: { cols: 20, rows: 15, cellSize: 32, visible: true, backgroundColor: '#000', snapToGrid: true }
    },
    stages: [],
    flowCharts: {},
    tasks: [
        { name: 'OnValChangedTask', actionSequence: [] }
    ],
    actions: [],
    variables: [
        {
            name: 'GlobalScore',
            type: 'integer',
            defaultValue: 0,
            scope: 'global',
            onValueChanged: 'OnValChangedTask' // The event we expect to see
        }
    ],
    objects: [],
    input: {
        player1Controls: 'none',
        player1Target: '',
        player1Speed: 0,
        player2Controls: 'none',
        player2Target: '',
        player2Speed: 0
    }
};
// Mock Active Stage
const mockStage = {
    name: 'MainStage',
    variables: [
        {
            name: 'LocalVar',
            type: 'string',
            defaultValue: '',
            scope: 'local',
            onValueEmpty: 'OnValChangedTask'
        }
    ],
    objects: []
};
console.log('--- START DEBUGGING ---');
console.log('Global Variables:', mockProject.variables);
const generatedCode = PascalGenerator.generateFullProgram(mockProject, false, mockStage);
console.log('--- GENERATED CODE SNIPPET (Variables) ---');
// Extract relevant parts
if (generatedCode.includes('PROCEDURE GlobalScore.onValueChanged')) {
    console.log('SUCCESS: GlobalScore.onValueChanged found.');
}
else {
    console.log('FAILURE: GlobalScore.onValueChanged NOT found.');
}
if (generatedCode.includes('PROCEDURE LocalVar.onValueEmpty')) {
    console.log('SUCCESS: LocalVar.onValueEmpty found.');
}
else {
    console.log('FAILURE: LocalVar.onValueEmpty NOT found.');
}
console.log('--- FULL GENERATED CODE (Partial) ---');
console.log(generatedCode.substring(0, 2000)); // Print first 2000 chars
