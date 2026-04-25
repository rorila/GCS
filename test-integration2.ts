import * as fs from 'fs';
import { ReactiveRuntime } from './src/runtime/ReactiveRuntime';
import { RuntimeVariableManager } from './src/runtime/RuntimeVariableManager';
import { ExpressionParser } from './src/runtime/ExpressionParser';

const projectStr = fs.readFileSync('my_memory_game.json', 'utf8');
const project = JSON.parse(projectStr);

const reactiveRuntime = new ReactiveRuntime();

const mockHost: any = {
    reactiveRuntime,
    stage: { id: 'stage_main', name: 'stage_main', variables: project.stages[1].variables }, // main stage
    project: project,
    taskExecutor: null,
    startTimer: () => {}
};

const variableManager = new RuntimeVariableManager(mockHost, {});
variableManager.initializeVariables(project);
variableManager.initializeStageVariables(project.stages[1]); // main stage

const contextVars = variableManager.contextVars;

console.log('State:', contextVars['State']);
console.log('Card2_State:', contextVars['Card2_State']);

const formula = 'State == "idle" && Card2_State == 0';
console.log('Evaluate:', ExpressionParser.evaluate(formula, contextVars));

