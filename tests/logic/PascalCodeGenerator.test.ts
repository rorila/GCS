import { GameProject } from '../../src/model/types';
import { PascalCodeGenerator } from '../../src/editor/PascalCodeGenerator';

// A simple manual test runner function for the custom test suite
export function runPascalGeneratorTests() {
    const results = [];
    
    // Test 1: Nested / Recursively Called Tasks must be generated
    try {
        const project: GameProject = {
            stages: [
                {
                    id: 'stage_blueprint',
                    name: 'Blueprint',
                    type: 'blueprint',
                    objects: [],
                    tasks: [
                        {
                            name: 'BackToMainStage',
                            actionSequence: [ { type: 'action', name: 'GoToMain' } ]
                        } as any
                    ],
                    flowCharts: {},
                    actions: []
                },
                {
                    id: 'stage_1',
                    name: 'Stage 1',
                    type: 'main',
                    objects: [],
                    tasks: [
                        {
                            name: 'Stage1TestTask',
                            actionSequence: [ { type: 'task', name: 'BackToMainStage' } ]
                        } as any
                    ],
                    flowCharts: {
                        'Stage1TestTask': { elements: [], connections: [] } as any, 
                    },
                    actions: []
                }
            ],
            tasks: [],
            actions: [],
            objects: [],
            version: '2.0.0',
            meta: {
                name: 'Test Project',
                version: '1.0.0'
            } as any
        };

        const activeStage = (project.stages as any)[1]; // Stage 1
        
        // Let's pretend a button calls 'Stage1TestTask' (to make it a root task in the generator)
        activeStage.objects = [
            {
                id: 'btn1',
                name: 'Button_4',
                className: 'TButton',
                events: { onClick: 'Stage1TestTask' }
            } as any
        ];

        const generatedCode = PascalCodeGenerator.generateFullProgram(project, false, activeStage);
        
        // Assertions
        const hasMainTaskCall = generatedCode.includes('Stage1TestTask');
        const hasSubTaskDeclaration = generatedCode.includes('PROCEDURE BackToMainStage();');
        const hasSubTaskCall = generatedCode.includes('BackToMainStage();');

        if (hasMainTaskCall && hasSubTaskDeclaration && hasSubTaskCall) {
            results.push({ name: 'Nested Task Declaration Generation', type: 'Pascal Generator', expectedSuccess: true, actualSuccess: true, passed: true, details: 'Recursive Tasks successfully output' });
        } else {
            results.push({ name: 'Nested Task Declaration Generation', type: 'Pascal Generator', expectedSuccess: true, actualSuccess: false, passed: false, details: 'Missing sub-task procedure declaration' });
        }

    } catch (e) {
        results.push({ name: 'Nested Task Declaration Generation', type: 'Pascal Generator', expectedSuccess: true, actualSuccess: false, passed: false, details: String(e) });
    }

    return results;
}

