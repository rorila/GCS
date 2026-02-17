
import { RefactoringManager } from '../src/editor/RefactoringManager';
import { GameProject } from '../src/model/types';

const project: GameProject = {
    meta: { name: 'test', version: '1.0' },
    stages: [
        {
            id: 'stage1',
            name: 'Stage 1',
            tasks: [
                { name: 'OldTaskName', actionSequence: [] }
            ]
        }
    ],
    tasks: [],
    variables: [],
    objects: [],
    actions: []
};

console.log('--- Initial State ---');
console.log('Task Name:', project.stages![0].tasks![0].name);

const oldName = 'OldTaskName';
const newName = 'NewTaskName';

console.log(`\n--- Renaming Task: "${oldName}" -> "${newName}" ---`);
RefactoringManager.renameTask(project, oldName, newName);

const finalName = project.stages![0].tasks![0].name;
console.log('Final Task Name:', finalName);

if (finalName === newName) {
    console.log('\n✅ Task rename successful in project model!');
} else {
    console.log('\n❌ Task rename FAILED in project model!');
}
