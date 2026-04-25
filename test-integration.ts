import { ReactiveRuntime } from './src/runtime/ReactiveRuntime';
import { RuntimeVariableManager } from './src/runtime/RuntimeVariableManager';
import { TaskConditionEvaluator } from './src/runtime/executor/TaskConditionEvaluator';
import { ExpressionParser } from './src/runtime/ExpressionParser';

const reactiveRuntime = new ReactiveRuntime();

const mockHost: any = {
    reactiveRuntime,
    stage: { id: 'stage_main', name: 'stage_main', variables: [] },
    project: { variables: [] },
    taskExecutor: null,
    startTimer: () => {}
};

const initialVars = {
    "State": "idle",
    "Card1_State": 0
};

const variableManager = new RuntimeVariableManager(mockHost, initialVars);

// Sync to reactive runtime (simulating GameRuntime.ts line 1034)
Object.entries(variableManager.contextVars).forEach(([key, val]) => {
    reactiveRuntime.registerVariable(key, val);
});

// Context vars proxy
const contextVars = variableManager.contextVars;
const globalVars = undefined; // GameRuntime passes undefined for globalVars to execute! Wait, no it doesn't?

const formula = 'State == "idle" && Card1_State == 0';

console.log('--- TEST ---');
console.log('State from contextVars:', contextVars['State']);
console.log('Card1_State from contextVars:', contextVars['Card1_State']);

console.log('Direct evaluate:', ExpressionParser.evaluate(formula, contextVars));

console.log('TaskConditionEvaluator:', TaskConditionEvaluator.evaluateCondition({
    variable: "CanFlip_1",
    operator: "==",
    value: "true"
}, contextVars, globalVars));

