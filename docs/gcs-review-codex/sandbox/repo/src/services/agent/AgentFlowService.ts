import { projectTaskRegistry } from '../registry/TaskRegistry';
import { ActionType, ConditionOperator, GameTask, SequenceItem } from '../../model/types';
import { Logger } from '../../utils/Logger';
import type { AgentController } from '../AgentController';

/**
 * BranchBuilder
 *
 * Hilfsklasse zum Aufbau von Then/Else-Zweigen innerhalb einer Condition.
 * Wird als Callback-Parameter an `AgentController.addBranch()` übergeben.
 */
export class BranchBuilder {
    private controller: AgentController;
    private items: SequenceItem[] = [];
    private stageId: string | undefined;

    constructor(controller: AgentController, stageId?: string) {
        this.controller = controller;
        this.stageId = stageId;
    }

    /** Referenziert eine existierende, global definierte Action. */
    addAction(actionName: string): BranchBuilder {
        this.items.push({ type: 'action', name: actionName });
        return this;
    }

    /** Definiert eine NEUE Action (global oder stage-spezifisch) und referenziert sie im Branch. */
    addNewAction(actionType: ActionType, actionName: string, params: Record<string, any> = {}): BranchBuilder {
        // Delegate creation to AgentController with stage context
        this.controller.ensureActionDefined(actionType, actionName, params, this.stageId);
        this.items.push({ type: 'action', name: actionName });
        return this;
    }

    /** Referenziert einen Task-Aufruf im Branch. */
    addTaskCall(taskName: string): BranchBuilder {
        this.items.push({ type: 'task', name: taskName });
        return this;
    }

    getItems(): SequenceItem[] {
        return this.items;
    }
}

/**
 * AgentFlowService
 *
 * Kapselt Task-, Action-, Sequence-, Branch- und Loop-Management.
 */
export class AgentFlowService {
    private logger = Logger.get('AgentFlowService', 'Editor_Diagnostics');

    constructor(private controller: AgentController) {}

    /**
     * Erstellt einen neuen Task.
     * Invarianten:
     * - Task wird global registriert (Daten).
     * - Task wird in der Stage registriert (Lokalität).
     * - Löscht existierende FlowCharts (erzwingt Neu-Generierung).
     */
    public createTask(stageId: string, taskName: string, description: string = ""): string {
        this.controller.validateProjectLoaded();
        if (!taskName) throw new Error("Task name cannot be empty");

        const project = this.controller.getProject()!;

        // 1. Check if task exists (Global or Stage)
        const exists = this.controller.getTaskByName(taskName);
        if (exists) {
            this.logger.warn(`Task '${taskName}' already exists. Skipping creation.`);
            return taskName;
        }

        // 2. Create Task Object
        const newTask: GameTask = {
            name: taskName,
            description: description,
            actionSequence: [],
            triggerMode: 'local-sync',
            params: []
        };

        // 3. Register Locally (Stage) or Globally (Blueprint)
        const targetStageId = stageId || 'stage_blueprint';
        const targetStage = project.stages?.find(s => s.id === targetStageId || s.name === targetStageId);

        if (targetStage) {
            if (!targetStage.tasks) targetStage.tasks = [];
            targetStage.tasks.push(newTask);
            this.logger.info(`Task '${taskName}' created in stage '${targetStageId}'.`);
        } else {
            // Fallback to project root if no stage found
            if (!project.tasks) project.tasks = [];
            project.tasks.push(newTask);
            this.logger.info(`Task '${taskName}' created in project root (fallback).`);
        }

        // 4. Invalidate Flow (Scorched Earth)
        this.controller.invalidateTaskFlow(taskName);

        // 5. Notify
        this.controller.notifyChange();
        return taskName;
    }

    /**
     * Fügt eine Action zu einem Task hinzu.
     * Invarianten:
     * - Keine Inline-Actions (nur Referenzen).
     * - Action muss global definiert sein.
     */
    public addAction(taskName: string, actionType: ActionType, actionName: string, params: Record<string, any> = {}) {
        this.controller.validateProjectLoaded();

        const project = this.controller.getProject()!;

        // 1. Get Task
        const task = this.controller.getTaskByName(taskName);
        if (!task) throw new Error(`Task '${taskName}' not found.`);

        // Validate required params for new actions
        const requiredParams: Record<string, string[]> = {
            'list_push': ['target', 'value'],
            'list_pop': ['target'],
            'list_get': ['target', 'index'],
            'list_set': ['target', 'index', 'value'],
            'list_remove': ['target', 'index'],
            'list_clear': ['target'],
            'list_shuffle': ['target'],
            'list_contains': ['target', 'value'],
            'list_length': ['target'],
            'map_get': ['target', 'key'],
            'map_set': ['target', 'key', 'value'],
            'map_delete': ['target', 'key'],
            'map_has': ['target', 'key'],
            'map_keys': ['target'],
            // Record-Actions (stabilisiert in Commit 5c1294d)
            // 'target' optional – leeres Ziel wird als 'self' behandelt (Runtime-Konvention)
            'record_get': ['list', 'field', 'resultVariable'],
            'record_set': ['list', 'field', 'value'],
            'record_delete': ['key'],
            // record_create hat keine zwingenden Pflicht-Params (nur optionale Felder)
        };

        if (requiredParams[actionType]) {
            for (const param of requiredParams[actionType]) {
                // Backward-compat: target | listName | mapName sind Aliasse für die Collection-Variable
                if (param === 'target') {
                    if (params['target'] === undefined && params['listName'] === undefined && params['mapName'] === undefined) {
                        throw new Error(`ActionType '${actionType}' requires parameter 'target' (or alias 'listName'/'mapName'). Provided params: ${JSON.stringify(Object.keys(params))}`);
                    }
                } else {
                    // Alle anderen Pflicht-Params (value, index, key, ...) müssen direkt vorhanden sein
                    if (params[param] === undefined) {
                        throw new Error(`ActionType '${actionType}' requires parameter '${param}'. Provided params: ${JSON.stringify(Object.keys(params))}`);
                    }
                }
            }
        }

        // 2. Define Action Globally (Identity)
        // Check if action already exists with DIFFERENT type -> Error
        let actionDef = this.controller.getActionByName(actionName);
        if (actionDef) {
            if (actionDef.type !== actionType) {
                throw new Error(`Action '${actionName}' already exists with type '${actionDef.type}', cannot redefine as '${actionType}'.`);
            }
            // Update params?
            Object.assign(actionDef, params);
        } else {
            // Create New Global Definition in Blueprint
            // Phase 4: Sofort ID vergeben für stabile Identität
            const generateId = () => {
                if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                    return crypto.randomUUID();
                }
                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                    const r = Math.random() * 16 | 0;
                    const v = c === 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
            };
            actionDef = {
                id: generateId(),
                name: actionName,
                type: actionType,
                ...params
            } as any;

            // Stage des Tasks ermitteln – Action gehört in dieselbe Stage wie der Task
            const taskContainer = projectTaskRegistry.getTaskContainer(taskName);
            const targetStage = taskContainer.type === 'stage' && taskContainer.stageId
                ? project.stages?.find(s => s.id === taskContainer.stageId)
                : undefined;

            if (targetStage) {
                if (!targetStage.actions) targetStage.actions = [];
                targetStage.actions.push(actionDef as any);
                this.logger.info(`Action '${actionName}' created in Stage '${targetStage.name}'.`);
            } else {
                // Fallback: Blueprint Stage (Legacy-Verhalten)
                const blueprintStage = project.stages?.find(s => s.type === 'blueprint');
                if (blueprintStage) {
                    if (!blueprintStage.actions) blueprintStage.actions = [];
                    blueprintStage.actions.push(actionDef as any);
                    this.logger.info(`Action '${actionName}' created in Blueprint Stage (fallback).`);
                } else {
                    if (!project.actions) project.actions = [];
                    project.actions.push(actionDef as any);
                }
            }
        }

        // 3. Add to Task Sequence (Reference Only)
        // "Keine Inline-Actions" -> Wir pushen nur { type: 'action', name: ... }
        // ABER: GCS Runtime braucht manchmal mehr Daten im Sequence-Item?
        // FlowSyncManager nutzt: { type: 'action', name: '...' } -> Das ist sauber.
        task.actionSequence.push({
            type: 'action',
            name: actionName
        });

        // 4. Invalidate Flow
        this.controller.invalidateTaskFlow(taskName);

        // 5. Notify
        this.controller.notifyChange();
    }

    /**
     * Fügt einen Task-Aufruf in die Sequenz eines anderen Tasks ein.
     */
    public addTaskCall(taskName: string, calledTaskName: string): void {
        this.controller.validateProjectLoaded();

        const task = this.controller.getTaskByName(taskName);
        if (!task) throw new Error(`Task '${taskName}' not found.`);

        const calledTask = this.controller.getTaskByName(calledTaskName);
        if (!calledTask) throw new Error(`Called task '${calledTaskName}' not found. Create it first with createTask().`);

        task.actionSequence.push({
            type: 'task',
            name: calledTaskName
        } as any);

        this.controller.invalidateTaskFlow(taskName);
        this.logger.info(`Added task call '${calledTaskName}' to '${taskName}'.`);
        this.controller.notifyChange();
    }

    /**
     * Setzt den Ausführungsmodus eines Tasks.
     */
    public setTaskTriggerMode(taskName: string, mode: 'local-sync' | 'local' | 'broadcast'): void {
        this.controller.validateProjectLoaded();

        const task = this.controller.getTaskByName(taskName);
        if (!task) throw new Error(`Task '${taskName}' not found.`);

        const validModes = ['local-sync', 'local', 'broadcast'];
        if (!validModes.includes(mode)) {
            throw new Error(`Invalid trigger mode '${mode}'. Valid: ${validModes.join(', ')}`);
        }

        task.triggerMode = mode;
        this.logger.info(`Task '${taskName}' trigger mode set to '${mode}'.`);
        this.controller.notifyChange();
    }

    /**
     * Definiert einen Eingangsparameter für einen Task.
     */
    public addTaskParam(taskName: string, paramName: string, type: string = 'string', defaultValue: any = ''): void {
        this.controller.validateProjectLoaded();

        const task = this.controller.getTaskByName(taskName);
        if (!task) throw new Error(`Task '${taskName}' not found.`);

        if (!task.params) task.params = [];

        // Prüfe ob Parameter bereits existiert
        const existing = task.params.find((p: any) => p.name === paramName);
        if (existing) {
            existing.type = type;
            existing.defaultValue = defaultValue;
            this.logger.info(`Updated param '${paramName}' on task '${taskName}'.`);
        } else {
            task.params.push({ name: paramName, type, defaultValue } as any);
            this.logger.info(`Added param '${paramName}' (${type}) to task '${taskName}'.`);
        }

        this.controller.notifyChange();
    }

    /**
     * Ändert die Reihenfolge einer Action/Element in der Sequenz eines Tasks.
     */
    public moveActionInSequence(taskName: string, fromIndex: number, toIndex: number): void {
        this.controller.validateProjectLoaded();

        const task = this.controller.getTaskByName(taskName);
        if (!task) throw new Error(`Task '${taskName}' not found.`);

        const seq = task.actionSequence;
        if (fromIndex < 0 || fromIndex >= seq.length) throw new Error(`fromIndex ${fromIndex} out of bounds (0-${seq.length - 1}).`);
        if (toIndex < 0 || toIndex >= seq.length) throw new Error(`toIndex ${toIndex} out of bounds (0-${seq.length - 1}).`);

        const [item] = seq.splice(fromIndex, 1);
        seq.splice(toIndex, 0, item);

        this.controller.invalidateTaskFlow(taskName);
        this.logger.info(`Moved action in '${taskName}' from index ${fromIndex} to ${toIndex}.`);
        this.controller.notifyChange();
    }

    /**
     * Fügt eine Condition (Verzweigung) zur actionSequence eines Tasks hinzu.
     */
    public addBranch(
        taskName: string,
        conditionVariable: string,
        operator: ConditionOperator,
        conditionValue: string | number,
        thenBuilder: (branch: BranchBuilder) => void,
        elseBuilder?: (branch: BranchBuilder) => void
    ) {
        this.controller.validateProjectLoaded();

        // 1. Get Task
        const task = this.controller.getTaskByName(taskName);
        if (!task) throw new Error(`Task '${taskName}' not found.`);

        // 2. Build Branches with stage context from Task
        const taskOwner = projectTaskRegistry.getTaskContainer(taskName);
        const stageId = taskOwner.type === 'stage' ? taskOwner.stageId : undefined;

        const thenBranch = new BranchBuilder(this.controller, stageId);
        thenBuilder(thenBranch);

        let elseBranch: BranchBuilder | undefined;
        if (elseBuilder) {
            elseBranch = new BranchBuilder(this.controller, stageId);
            elseBuilder(elseBranch);
        }

        // 3. Ensure all referenced actions exist globally
        this.controller.ensureActionsExistGlobally(thenBranch.getItems());
        if (elseBranch) {
            this.controller.ensureActionsExistGlobally(elseBranch.getItems());
        }

        // 4. Create Condition SequenceItem
        const conditionItem: SequenceItem = {
            type: 'condition',
            name: `Branch: ${conditionVariable} ${operator} ${conditionValue}`,
            condition: {
                variable: conditionVariable,
                operator: operator,
                value: conditionValue
            },
            then: thenBranch.getItems(),
            else: elseBranch ? elseBranch.getItems() : []
        };

        // 5. Add to Task Sequence
        task.actionSequence.push(conditionItem);

        // 6. Invalidate Flow
        this.controller.invalidateTaskFlow(taskName);

        // 7. Notify
        this.controller.notifyChange();
    }

    /**
     * Serialisierbare Condition-Operation für AgentScripts.
     */
    public addConditionItem(taskName: string, item: SequenceItem): void {
        this.controller.validateProjectLoaded();

        const task = this.controller.getTaskByName(taskName);
        if (!task) throw new Error(`Task '${taskName}' not found.`);

        // Referenzierte Actions prüfen (Array-Form rekursiv + Shortcut-Form)
        if (item.then) this.controller.ensureActionsExistGlobally(item.then);
        if (item.else) this.controller.ensureActionsExistGlobally(item.else);
        for (const actionName of [item.thenAction, item.elseAction]) {
            if (actionName && !this.controller.getActionByName(actionName)) {
                throw new Error(
                    `[AgentController] Action '${actionName}' is referenced in condition but not globally defined. ` +
                    `Use addAction()/ensureActionDefined() first.`
                );
            }
        }

        task.actionSequence.push({ ...item, type: 'condition' });

        this.controller.invalidateTaskFlow(taskName);
        this.controller.notifyChange();
    }

    /**
     * Fügt eine FOREACH-Schleife zur actionSequence eines Tasks hinzu.
     */
    public addForeach(
        taskName: string,
        sourceArray: string,
        itemVar: string,
        bodyBuilder: (branch: BranchBuilder) => void,
        indexVar?: string,
        iterationMode?: 'values' | 'keys' | 'entries',
        keyVar?: string
    ): void {
        this.controller.validateProjectLoaded();

        const task = this.controller.getTaskByName(taskName);
        if (!task) throw new Error(`Task '${taskName}' not found.`);
        if (!sourceArray) throw new Error('addForeach: sourceArray darf nicht leer sein.');
        if (!itemVar) throw new Error('addForeach: itemVar darf nicht leer sein.');
        if (iterationMode === 'entries' && !keyVar) {
            throw new Error('addForeach: keyVar ist bei iterationMode="entries" erforderlich.');
        }

        const taskOwner = projectTaskRegistry.getTaskContainer(taskName);
        const stageId = taskOwner.type === 'stage' ? taskOwner.stageId : undefined;

        const bodyBranch = new BranchBuilder(this.controller, stageId);
        bodyBuilder(bodyBranch);

        this.controller.ensureActionsExistGlobally(bodyBranch.getItems());

        // Name spiegelt den Modus wider für bessere Lesbarkeit im Flow-Editor
        const modeSuffix = iterationMode && iterationMode !== 'values'
            ? ` (${iterationMode})`
            : '';
        const loopItem: SequenceItem = {
            type: 'foreach',
            name: `ForEach: ${itemVar} in ${sourceArray}${modeSuffix}`,
            sourceArray,
            itemVar,
            body: bodyBranch.getItems(),
            ...(indexVar ? { indexVar } : {}),
            ...(iterationMode ? { iterationMode } : {}),
            ...(keyVar ? { keyVar } : {})
        };

        task.actionSequence.push(loopItem);

        this.controller.invalidateTaskFlow(taskName);
        this.logger.info(`addForeach: '${itemVar} in ${sourceArray}' (${iterationMode ?? 'auto'}) zu Task '${taskName}' hinzugefügt.`);
        this.controller.notifyChange();
    }

    /**
     * Fügt eine WHILE-Schleife zur actionSequence eines Tasks hinzu.
     */
    public addWhile(
        taskName: string,
        conditionVariable: string,
        operator: ConditionOperator,
        conditionValue: string | number,
        bodyBuilder: (branch: BranchBuilder) => void
    ): void {
        this.controller.validateProjectLoaded();

        const task = this.controller.getTaskByName(taskName);
        if (!task) throw new Error(`Task '${taskName}' not found.`);
        if (!conditionVariable) throw new Error('addWhile: conditionVariable darf nicht leer sein.');

        const taskOwner = projectTaskRegistry.getTaskContainer(taskName);
        const stageId = taskOwner.type === 'stage' ? taskOwner.stageId : undefined;

        const bodyBranch = new BranchBuilder(this.controller, stageId);
        bodyBuilder(bodyBranch);

        this.controller.ensureActionsExistGlobally(bodyBranch.getItems());

        const loopItem: SequenceItem = {
            type: 'while',
            name: `While: ${conditionVariable} ${operator} ${conditionValue}`,
            condition: {
                variable: conditionVariable,
                operator,
                value: conditionValue
            },
            body: bodyBranch.getItems()
        };

        task.actionSequence.push(loopItem);

        this.controller.invalidateTaskFlow(taskName);
        this.logger.info(`addWhile: '${conditionVariable} ${operator} ${conditionValue}' zu Task '${taskName}' hinzugefügt.`);
        this.controller.notifyChange();
    }

    /**
     * Fügt eine numerische FOR-Schleife zur actionSequence eines Tasks hinzu.
     */
    public addFor(
        taskName: string,
        iteratorVar: string,
        from: number | string,
        to: number | string,
        bodyBuilder: (branch: BranchBuilder) => void,
        step: number = 1
    ): void {
        this.controller.validateProjectLoaded();

        const task = this.controller.getTaskByName(taskName);
        if (!task) throw new Error(`Task '${taskName}' not found.`);
        if (!iteratorVar) throw new Error('addFor: iteratorVar darf nicht leer sein.');
        if (step === 0) throw new Error('addFor: step darf nicht 0 sein.');

        const taskOwner = projectTaskRegistry.getTaskContainer(taskName);
        const stageId = taskOwner.type === 'stage' ? taskOwner.stageId : undefined;

        const bodyBranch = new BranchBuilder(this.controller, stageId);
        bodyBuilder(bodyBranch);

        this.controller.ensureActionsExistGlobally(bodyBranch.getItems());

        const loopItem: SequenceItem = {
            type: 'for',
            name: `For: ${iteratorVar} = ${from} to ${to}${step !== 1 ? ` step ${step}` : ''}`,
            iteratorVar,
            from,
            to,
            step,
            body: bodyBranch.getItems()
        };

        task.actionSequence.push(loopItem);

        this.controller.invalidateTaskFlow(taskName);
        this.logger.info(`addFor: '${iteratorVar} = ${from}..${to}' zu Task '${taskName}' hinzugefügt.`);
        this.controller.notifyChange();
    }

    /**
     * Klont einen Task mit neuem Namen (inkl. Action-Sequenz und FlowChart).
     */
    public duplicateTask(taskName: string, newName: string, stageId?: string): string {
        this.controller.validateProjectLoaded();
        const project = this.controller.getProject()!;
        const original = this.controller.getTaskByName(taskName);
        if (!original) throw new Error(`Task '${taskName}' not found.`);
        if (this.controller.getTaskByName(newName)) throw new Error(`Task '${newName}' already exists.`);

        const clone: GameTask = JSON.parse(JSON.stringify(original));
        clone.name = newName;

        // In die richtige Stage einfügen
        const targetStageId = stageId || projectTaskRegistry.getTaskContainer(taskName).stageId || 'stage_blueprint';
        const stage = project.stages?.find(s => s.id === targetStageId);
        if (stage) {
            if (!stage.tasks) stage.tasks = [];
            stage.tasks.push(clone);
        } else {
            if (!project.tasks) project.tasks = [];
            project.tasks.push(clone);
        }

        // FlowChart generieren
        this.controller.generateTaskFlow(newName);

        this.logger.info(`Task '${taskName}' duplicated as '${newName}'.`);
        this.controller.notifyChange();
        return newName;
    }
}
