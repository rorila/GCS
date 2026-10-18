import { GameProject, StageDefinition } from '../../model/types';
import { AgentScript, AgentScriptOperation } from '../../services/agent/AgentScriptTypes';
import { AI_ALLOWED_METHODS } from '../generation/AIAllowedMethods';
import {
    METHOD_POLICIES,
    VALID_ACTION_TYPES,
    VALID_OBJECT_EVENTS,
    VALID_STAGE_TYPES,
    VALID_VARIABLE_TYPES,
} from './MethodPolicies';

/**
 * AIValidator
 *
 * Führt eine 5-stufige Validierung von KI-generierten AgentScripts durch
 * bevor diese ausgeführt werden.
 */

export interface AIValidationIssue {
    level: 'error' | 'warning' | 'info';
    code: string;
    message: string;
    operationIndex?: number;
    method?: string;
    suggestion?: string;
}

export interface AIValidationResult {
    valid: boolean;
    issues: AIValidationIssue[];
}

interface VirtualStage {
    name: string;
    type: string;
    objects: Set<string>;
    tasks: Set<string>;
    variables: Set<string>;
    objectIds: Set<string>;
    grid: { cols: number; rows: number };
}

interface VirtualState {
    stages: Map<string, VirtualStage>;
    tasks: Set<string>;
    actions: Map<string, string>;
    variables: Set<string>;
    blueprintCount: number;
}

export class AIValidator {
    constructor(private project: GameProject) {}

    public validate(agentScript: AgentScript): AIValidationResult {
        const issues: AIValidationIssue[] = [];

        this.validateStructure(agentScript, issues);
        this.validateAllowedMethods(agentScript, issues);
        this.validateMethodSignatures(agentScript, issues);
        this.validateVirtualState(agentScript, issues);

        const errors = issues.filter(i => i.level === 'error');

        return {
            valid: errors.length === 0,
            issues,
        };
    }

    private validateStructure(agentScript: AgentScript, issues: AIValidationIssue[]): void {
        if (!agentScript) {
            issues.push(this.issue('error', 'SCRIPT_EMPTY', 'AgentScript ist leer oder undefined.'));
            return;
        }

        if (!agentScript.version || typeof agentScript.version !== 'string') {
            issues.push(this.issue('error', 'MISSING_VERSION', 'agentScript.version fehlt.'));
        }

        if (!agentScript.name || typeof agentScript.name !== 'string') {
            issues.push(this.issue('error', 'MISSING_NAME', 'agentScript.name fehlt.'));
        }

        if (!Array.isArray(agentScript.operations)) {
            issues.push(this.issue('error', 'MISSING_OPERATIONS', 'agentScript.operations muss ein Array sein.'));
            return;
        }

        for (let i = 0; i < agentScript.operations.length; i++) {
            const op = agentScript.operations[i];
            if (!op || typeof op !== 'object') {
                issues.push(this.issue('error', 'INVALID_OPERATION', `Operation ${i} ist kein Objekt.`, i));
                continue;
            }
            if (!op.method || typeof op.method !== 'string') {
                issues.push(this.issue('error', 'MISSING_METHOD', `Operation ${i} hat keine method.`, i));
            }
            if (!Array.isArray(op.params)) {
                issues.push(this.issue('error', 'MISSING_PARAMS', `Operation ${i} hat kein params-Array.`, i, op.method));
            }
        }
    }

    private validateAllowedMethods(agentScript: AgentScript, issues: AIValidationIssue[]): void {
        for (let i = 0; i < agentScript.operations.length; i++) {
            const op = agentScript.operations[i];
            if (!op || !op.method) continue;
            if (!AI_ALLOWED_METHODS.has(op.method)) {
                issues.push(
                    this.issue(
                        'error',
                        'DISALLOWED_METHOD',
                        `Methode '${op.method}' ist in der KI-Allowlist nicht erlaubt.`,
                        i,
                        op.method
                    )
                );
            }
        }
    }

    private validateMethodSignatures(agentScript: AgentScript, issues: AIValidationIssue[]): void {
        for (let i = 0; i < agentScript.operations.length; i++) {
            const op = agentScript.operations[i];
            if (!op || !op.method || !Array.isArray(op.params)) continue;

            const policy = METHOD_POLICIES[op.method];
            if (!policy) continue;

            if (op.params.length < policy.minParams || op.params.length > policy.maxParams) {
                issues.push(
                    this.issue(
                        'error',
                        'INVALID_PARAM_COUNT',
                        `Methode '${op.method}' erwartet ${policy.minParams}-${policy.maxParams} Parameter, erhalten: ${op.params.length}.`,
                        i,
                        op.method
                    )
                );
            }
        }
    }

    private validateVirtualState(agentScript: AgentScript, issues: AIValidationIssue[]): void {
        const state = this.buildInitialState();

        for (let i = 0; i < agentScript.operations.length; i++) {
            const op = agentScript.operations[i];
            if (!op || !op.method || !Array.isArray(op.params)) continue;

            this.validateAndApplyOperation(op, i, state, issues);
        }
    }

    private buildInitialState(): VirtualState {
        const state: VirtualState = {
            stages: new Map(),
            tasks: new Set(),
            actions: new Map(),
            variables: new Set(),
            blueprintCount: 0,
        };

        const defaultGrid = this.project.stage?.grid ?? { cols: 64, rows: 40 };

        for (const stage of this.project.stages || []) {
            this.addStageToState(stage, state, defaultGrid);
        }

        for (const task of this.project.tasks || []) {
            if (task.name) state.tasks.add(task.name);
        }

        for (const action of this.project.actions || []) {
            if (action.name) state.actions.set(action.name, action.type);
        }

        for (const variable of this.project.variables || []) {
            if (variable.name) state.variables.add(variable.name);
        }

        return state;
    }

    private addStageToState(stage: StageDefinition, state: VirtualState, defaultGrid: { cols: number; rows: number }): void {
        const grid = stage.grid ?? defaultGrid;
        state.stages.set(stage.id, {
            name: stage.name,
            type: stage.type,
            objects: new Set(),
            tasks: new Set(),
            variables: new Set(),
            objectIds: new Set(),
            grid,
        });

        if (stage.type === 'blueprint') {
            state.blueprintCount++;
        }

        for (const obj of stage.objects || []) {
            const s = state.stages.get(stage.id);
            if (s) {
                if (obj.name) s.objects.add(obj.name);
                if (obj.id) s.objectIds.add(obj.id);
            }
        }

        for (const task of stage.tasks || []) {
            if (task.name) {
                state.tasks.add(task.name);
                state.stages.get(stage.id)?.tasks.add(task.name);
            }
        }

        for (const variable of stage.variables || []) {
            if (variable.name) state.stages.get(stage.id)?.variables.add(variable.name);
        }

        for (const action of stage.actions || []) {
            if (action.name) state.actions.set(action.name, action.type);
        }
    }

    private validateAndApplyOperation(
        op: AgentScriptOperation,
        index: number,
        state: VirtualState,
        issues: AIValidationIssue[]
    ): void {
        switch (op.method) {
            case 'createStage':
                this.validateCreateStage(op, index, state, issues);
                break;
            case 'addObject':
                this.validateAddObject(op, index, state, issues);
                break;
            case 'addVariable':
                this.validateAddVariable(op, index, state, issues);
                break;
            case 'createTask':
                this.validateCreateTask(op, index, state, issues);
                break;
            case 'addAction':
                this.validateAddAction(op, index, state, issues);
                break;
            case 'addTaskParam':
                this.validateAddTaskParam(op, index, state, issues);
                break;
            case 'addTaskCall':
                this.validateAddTaskCall(op, index, state, issues);
                break;
            case 'connectEvent':
                this.validateConnectEvent(op, index, state, issues);
                break;
            case 'setProperty':
                this.validateSetProperty(op, index, state, issues);
                break;
            case 'bindVariable':
                this.validateBindVariable(op, index, state, issues);
                break;
            default:
                issues.push(this.issue('error', 'UNKNOWN_METHOD', `Methode '${op.method}' ist nicht bekannt.`, index, op.method));
        }
    }

    private validateCreateStage(op: AgentScriptOperation, index: number, state: VirtualState, issues: AIValidationIssue[]): void {
        const [id, name, type = 'standard'] = op.params;

        if (!VALID_STAGE_TYPES.has(type)) {
            issues.push(this.issue('error', 'INVALID_STAGE_TYPE', `Stage-Typ '${type}' ist ungültig.`, index, op.method));
        }

        if (type === 'blueprint') {
            if (state.blueprintCount > 0) {
                issues.push(this.issue('error', 'MULTIPLE_BLUEPRINTS', 'Es darf höchstens eine Blueprint-Stage existieren.', index, op.method));
            }
            state.blueprintCount++;
        }

        if (state.stages.has(id)) {
            const existing = state.stages.get(id);
            if (existing && existing.name !== name) {
                issues.push(this.issue('warning', 'STAGE_RENAME', `Stage '${id}' existiert bereits und würde aktualisiert.`, index, op.method));
            }
        } else {
            for (const [existingId, existing] of state.stages) {
                if (existing.name === name) {
                    issues.push(
                        this.issue('warning', 'DUPLICATE_STAGE_NAME', `Stage-Name '${name}' ist bereits an '${existingId}' vergeben.`, index, op.method)
                    );
                    break;
                }
            }
        }

        const defaultGrid = this.project.stage?.grid ?? { cols: 64, rows: 40 };
        state.stages.set(id, {
            name,
            type,
            objects: new Set(),
            tasks: new Set(),
            variables: new Set(),
            objectIds: new Set(),
            grid: defaultGrid,
        });
    }

    private validateAddObject(op: AgentScriptOperation, index: number, state: VirtualState, issues: AIValidationIssue[]): void {
        const [stageId, objectData] = op.params;
        const stage = state.stages.get(stageId);

        if (!stage) {
            issues.push(this.issue('error', 'STAGE_NOT_FOUND', `Stage '${stageId}' existiert nicht.`, index, op.method));
            return;
        }

        if (!objectData || typeof objectData !== 'object') {
            issues.push(this.issue('error', 'INVALID_OBJECT_DATA', 'addObject erwartet ein Objekt als zweiten Parameter.', index, op.method));
            return;
        }

        if (!objectData.name || typeof objectData.name !== 'string') {
            issues.push(this.issue('error', 'MISSING_OBJECT_NAME', 'addObject objectData benötigt einen name.', index, op.method));
            return;
        }

        if (!objectData.className || typeof objectData.className !== 'string') {
            issues.push(this.issue('error', 'MISSING_OBJECT_CLASS', 'addObject objectData benötigt einen className.', index, op.method));
            return;
        }

        if (stage.objects.has(objectData.name)) {
            issues.push(this.issue('warning', 'DUPLICATE_OBJECT', `Objekt '${objectData.name}' existiert bereits in Stage '${stageId}'.`, index, op.method));
        }

        const grid = stage.grid;
        if (objectData.x !== undefined && (objectData.x < 0 || objectData.x > grid.cols)) {
            issues.push(this.issue('warning', 'OBJECT_OUTSIDE_GRID', `Objekt '${objectData.name}' liegt außerhalb der Grid-Breite (0-${grid.cols}).`, index, op.method));
        }
        if (objectData.y !== undefined && (objectData.y < 0 || objectData.y > grid.rows)) {
            issues.push(this.issue('warning', 'OBJECT_OUTSIDE_GRID', `Objekt '${objectData.name}' liegt außerhalb der Grid-Höhe (0-${grid.rows}).`, index, op.method));
        }

        stage.objects.add(objectData.name);
        if (objectData.id) stage.objectIds.add(objectData.id);
    }

    private validateAddVariable(op: AgentScriptOperation, index: number, state: VirtualState, issues: AIValidationIssue[]): void {
        const [name, type, , scope = 'global'] = op.params;

        if (!name || typeof name !== 'string') {
            issues.push(this.issue('error', 'MISSING_VARIABLE_NAME', 'addVariable benötigt einen Namen.', index, op.method));
            return;
        }

        if (!VALID_VARIABLE_TYPES.has(type)) {
            issues.push(this.issue('error', 'INVALID_VARIABLE_TYPE', `Variablen-Typ '${type}' ist ungültig.`, index, op.method));
        }

        if (state.variables.has(name)) {
            issues.push(this.issue('warning', 'DUPLICATE_VARIABLE', `Variable '${name}' existiert bereits und wird überschrieben.`, index, op.method));
        }

        if (scope !== 'global' && scope !== 'local' && !state.stages.has(scope)) {
            issues.push(this.issue('warning', 'UNKNOWN_VARIABLE_SCOPE', `Scope '${scope}' ist weder 'global'/'local' noch eine bekannte Stage.`, index, op.method));
        }

        state.variables.add(name);
    }

    private validateCreateTask(op: AgentScriptOperation, index: number, state: VirtualState, issues: AIValidationIssue[]): void {
        const [stageId, taskName] = op.params;

        if (!taskName || typeof taskName !== 'string') {
            issues.push(this.issue('error', 'MISSING_TASK_NAME', 'createTask benötigt einen Task-Namen.', index, op.method));
            return;
        }

        if (stageId && !state.stages.has(stageId) && stageId !== 'stage_blueprint') {
            issues.push(this.issue('warning', 'TASK_STAGE_NOT_FOUND', `Stage '${stageId}' für createTask nicht bekannt.`, index, op.method));
        }

        if (state.tasks.has(taskName)) {
            issues.push(this.issue('warning', 'DUPLICATE_TASK', `Task '${taskName}' existiert bereits.`, index, op.method));
        } else {
            state.tasks.add(taskName);
            if (stageId && state.stages.has(stageId)) {
                state.stages.get(stageId)?.tasks.add(taskName);
            }
        }
    }

    private validateAddAction(op: AgentScriptOperation, index: number, state: VirtualState, issues: AIValidationIssue[]): void {
        const [taskName, actionType, actionName, params = {}] = op.params;

        if (!taskName || typeof taskName !== 'string') {
            issues.push(this.issue('error', 'MISSING_TASK_REFERENCE', 'addAction benötigt einen Task-Namen.', index, op.method));
            return;
        }

        if (!state.tasks.has(taskName)) {
            issues.push(this.issue('error', 'TASK_NOT_FOUND', `Task '${taskName}' existiert nicht. Erzeuge ihn zuerst mit createTask().`, index, op.method));
        }

        if (!VALID_ACTION_TYPES.has(actionType)) {
            issues.push(this.issue('error', 'INVALID_ACTION_TYPE', `ActionType '${actionType}' ist ungültig.`, index, op.method));
        }

        if (!actionName || typeof actionName !== 'string') {
            issues.push(this.issue('error', 'MISSING_ACTION_NAME', 'addAction benötigt einen Action-Namen.', index, op.method));
            return;
        }

        if (params && (typeof params !== 'object' || Array.isArray(params))) {
            issues.push(this.issue('error', 'INVALID_ACTION_PARAMS', 'addAction params (4. Parameter) muss ein Objekt sein, kein Array.', index, op.method));
        }

        const existingType = state.actions.get(actionName);
        if (existingType) {
            if (existingType !== actionType) {
                issues.push(
                    this.issue(
                        'error',
                        'ACTION_TYPE_CONFLICT',
                        `Action '${actionName}' existiert bereits als '${existingType}', kann nicht als '${actionType}' überschrieben werden.`,
                        index,
                        op.method
                    )
                );
            }
        } else {
            state.actions.set(actionName, actionType);
        }
    }

    private validateAddTaskParam(op: AgentScriptOperation, index: number, state: VirtualState, issues: AIValidationIssue[]): void {
        const [taskName, paramName, type = 'string'] = op.params;

        if (!taskName || typeof taskName !== 'string') {
            issues.push(this.issue('error', 'MISSING_TASK_REFERENCE', 'addTaskParam benötigt einen Task-Namen.', index, op.method));
            return;
        }

        if (!state.tasks.has(taskName)) {
            issues.push(this.issue('error', 'TASK_NOT_FOUND', `Task '${taskName}' existiert nicht. Erzeuge ihn zuerst mit createTask().`, index, op.method));
        }

        if (!paramName || typeof paramName !== 'string') {
            issues.push(this.issue('error', 'MISSING_PARAM_NAME', 'addTaskParam benötigt einen Parameter-Namen.', index, op.method));
        }

        if (!VALID_VARIABLE_TYPES.has(type)) {
            issues.push(this.issue('warning', 'UNKNOWN_PARAM_TYPE', `Parametertyp '${type}' ist nicht in der Liste bekannter Variablen-Typen.`, index, op.method));
        }
    }

    private validateAddTaskCall(op: AgentScriptOperation, index: number, state: VirtualState, issues: AIValidationIssue[]): void {
        const [taskName, calledTaskName] = op.params;

        if (!state.tasks.has(taskName)) {
            issues.push(this.issue('error', 'TASK_NOT_FOUND', `Task '${taskName}' existiert nicht.`, index, op.method));
        }

        if (!state.tasks.has(calledTaskName)) {
            issues.push(this.issue('error', 'CALLED_TASK_NOT_FOUND', `Aufgerufener Task '${calledTaskName}' existiert nicht.`, index, op.method));
        }
    }

    private validateConnectEvent(op: AgentScriptOperation, index: number, state: VirtualState, issues: AIValidationIssue[]): void {
        const [stageId, objectName, eventName, taskName] = op.params;

        const stage = state.stages.get(stageId);
        if (!stage) {
            issues.push(this.issue('error', 'STAGE_NOT_FOUND', `Stage '${stageId}' existiert nicht.`, index, op.method));
            return;
        }

        if (!stage.objects.has(objectName) && !stage.objectIds.has(objectName)) {
            issues.push(this.issue('error', 'OBJECT_NOT_FOUND', `Objekt '${objectName}' existiert nicht in Stage '${stageId}'.`, index, op.method));
        }

        if (!state.tasks.has(taskName)) {
            issues.push(this.issue('error', 'TASK_NOT_FOUND', `Task '${taskName}' existiert nicht.`, index, op.method));
        }

        if (!VALID_OBJECT_EVENTS.has(eventName)) {
            issues.push(
                this.issue('warning', 'UNKNOWN_EVENT', `Event '${eventName}' ist nicht in der Liste bekannter Objekt-Events.`, index, op.method)
            );
        }
    }

    private validateSetProperty(op: AgentScriptOperation, index: number, state: VirtualState, issues: AIValidationIssue[]): void {
        const [stageId, objectName, property] = op.params;

        const stage = state.stages.get(stageId);
        if (!stage) {
            issues.push(this.issue('error', 'STAGE_NOT_FOUND', `Stage '${stageId}' existiert nicht.`, index, op.method));
            return;
        }

        if (!stage.objects.has(objectName) && !stage.objectIds.has(objectName)) {
            issues.push(this.issue('error', 'OBJECT_NOT_FOUND', `Objekt '${objectName}' existiert nicht in Stage '${stageId}'.`, index, op.method));
        }

        if (!property || typeof property !== 'string') {
            issues.push(this.issue('error', 'MISSING_PROPERTY', 'setProperty benötigt einen Property-Namen.', index, op.method));
        }
    }

    private validateBindVariable(op: AgentScriptOperation, index: number, state: VirtualState, issues: AIValidationIssue[]): void {
        const [stageId, objectName, property, expression] = op.params;

        const stage = state.stages.get(stageId);
        if (!stage) {
            issues.push(this.issue('error', 'STAGE_NOT_FOUND', `Stage '${stageId}' existiert nicht.`, index, op.method));
            return;
        }

        if (!stage.objects.has(objectName) && !stage.objectIds.has(objectName)) {
            issues.push(this.issue('error', 'OBJECT_NOT_FOUND', `Objekt '${objectName}' existiert nicht in Stage '${stageId}'.`, index, op.method));
        }

        if (!property || typeof property !== 'string') {
            issues.push(this.issue('error', 'MISSING_PROPERTY', 'bindVariable benötigt einen Property-Namen.', index, op.method));
        }

        if (!expression || typeof expression !== 'string' || !expression.startsWith('${')) {
            issues.push(this.issue('warning', 'INVALID_BINDING', 'bindVariable expression sollte mit ${ beginnen.', index, op.method));
        }
    }

    private issue(
        level: AIValidationIssue['level'],
        code: string,
        message: string,
        operationIndex?: number,
        method?: string,
        suggestion?: string
    ): AIValidationIssue {
        return { level, code, message, operationIndex, method, suggestion };
    }
}
