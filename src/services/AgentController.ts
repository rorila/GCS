import { GameProject, BaseAction, GameTask, ActionType, SequenceItem, ConditionOperator } from '../model/types';
import { projectRegistry } from './ProjectRegistry';
import { mediatorService } from './MediatorService';
import { serviceRegistry } from './ServiceRegistry';
import { Logger } from '../utils/Logger';

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
 * AgentController
 * 
 * Zentrale API für den AI-Agenten (und Scripts), um das Projekt sicher und atomar zu manipulieren.
 * Enforces "Keep it Simple" & Architecture Invariants.
 */
export class AgentController {
    private static logger = Logger.get('AgentController', 'Editor_Diagnostics');
    private static instance: AgentController;
    private project: GameProject | null = null;

    private constructor() { }

    public static getInstance(): AgentController {
        if (!AgentController.instance) {
            AgentController.instance = new AgentController();
        }
        return AgentController.instance;
    }

    public setProject(project: GameProject) {
        this.project = project;
    }

    // ─────────────────────────────────────────────
    // 0. Project Structure
    // ─────────────────────────────────────────────

    /** Erstellt eine neue Stage. */
    public createStage(id: string, name: string, type: 'standard' | 'blueprint' = 'standard'): void {
        this.validateProjectLoaded();
        if (!this.project!.stages) this.project!.stages = [];

        if (this.project!.stages.find(s => s.id === id)) {
            AgentController.logger.warn(`Stage with id '${id}' already exists.`);
            return;
        }

        this.project!.stages.push({
            id, name, type,
            objects: [],
            tasks: [],
            actions: [],
            variables: [],
            flowCharts: {},
            events: {}
        } as any);

        AgentController.logger.info(`Stage '${name}' (${id}) created.`);
        this.notifyChange();
    }

    /** Fügt ein Objekt zu einer Stage hinzu. */
    public addObject(stageId: string, objectData: any): void {
        this.validateProjectLoaded();
        const stage = this.project!.stages?.find(s => s.id === stageId);
        if (!stage) throw new Error(`Stage '${stageId}' not found.`);

        if (!stage.objects) stage.objects = [];
        stage.objects.push(objectData);

        AgentController.logger.info(`Object '${objectData.name}' added to stage '${stageId}'.`);
        this.notifyChange();
    }

    /** Registriert eine globale Variable im Projekt. */
    public addVariable(name: string, type: any, initialValue: any, scope: string = 'global'): void {
        this.validateProjectLoaded();
        if (!this.project!.variables) this.project!.variables = [];

        const existing = this.project!.variables.find(v => v.name === name);
        if (existing) {
            existing.type = type;
            existing.initialValue = initialValue;
            existing.defaultValue = initialValue; // Sync
            existing.scope = scope;
        } else {
            this.project!.variables.push({
                name,
                type,
                initialValue,
                defaultValue: initialValue,
                scope
            } as any);
        }

        AgentController.logger.info(`Variable '${name}' added/updated.`);
        this.notifyChange();
    }

    // ─────────────────────────────────────────────
    // 1. Task Management
    // ─────────────────────────────────────────────

    /**
     * Erstellt einen neuen Task.
     * Invarianten:
     * - Task wird global registriert (Daten).
     * - Task wird in der Stage registriert (Lokalität).
     * - Löscht existierende FlowCharts (erzwingt Neu-Generierung).
     */
    public createTask(stageId: string, taskName: string, description: string = ""): string {
        this.validateProjectLoaded();
        if (!taskName) throw new Error("Task name cannot be empty");

        // 1. Check if task exists (Global or Stage)
        const exists = this.getTaskByName(taskName);
        if (exists) {
            AgentController.logger.warn(`Task '${taskName}' already exists. Skipping creation.`);
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
        const targetStage = this.project!.stages?.find(s => s.id === targetStageId || s.name === targetStageId);

        if (targetStage) {
            if (!targetStage.tasks) targetStage.tasks = [];
            targetStage.tasks.push(newTask);
            AgentController.logger.info(`Task '${taskName}' created in stage '${targetStageId}'.`);
        } else {
            // Fallback to project root if no stage found
            if (!this.project!.tasks) this.project!.tasks = [];
            this.project!.tasks.push(newTask);
            AgentController.logger.info(`Task '${taskName}' created in project root (fallback).`);
        }

        // 4. Invalidate Flow (Scorched Earth)
        this.invalidateTaskFlow(taskName);

        // 5. Notify
        this.notifyChange();
        return taskName;
    }

    // ─────────────────────────────────────────────
    // 2. Action Management
    // ─────────────────────────────────────────────

    /**
     * Fügt eine Action zu einem Task hinzu.
     * Invarianten:
     * - Keine Inline-Actions (nur Referenzen).
     * - Action muss global definiert sein.
     */
    public addAction(taskName: string, actionType: ActionType, actionName: string, params: Record<string, any> = {}) {
        this.validateProjectLoaded();

        // 1. Get Task
        const task = this.getTaskByName(taskName);
        if (!task) throw new Error(`Task '${taskName}' not found.`);

        // 2. Define Action Globally (Identity)
        // Check if action already exists with DIFFERENT type -> Error
        let actionDef = this.getActionByName(actionName);
        if (actionDef) {
            if (actionDef.type !== actionType) {
                throw new Error(`Action '${actionName}' already exists with type '${actionDef.type}', cannot redefine as '${actionType}'.`);
            }
            // Update params?
            Object.assign(actionDef, params);
        } else {
            // Create New Global Definition in Blueprint
            actionDef = {
                name: actionName,
                type: actionType,
                ...params
            } as any;

            const blueprintStage = this.project!.stages?.find(s => s.type === 'blueprint');
            if (blueprintStage) {
                if (!blueprintStage.actions) blueprintStage.actions = [];
                blueprintStage.actions.push(actionDef as any);
                AgentController.logger.info(`Action '${actionName}' created in Blueprint Stage.`);
            } else {
                if (!this.project!.actions) this.project!.actions = [];
                this.project!.actions.push(actionDef as any);
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
        this.invalidateTaskFlow(taskName);

        // 5. Notify
        this.notifyChange();
    }


    /**
     * Fügt einen Task-Aufruf in die Sequenz eines anderen Tasks ein.
     * Damit kann ein Task einen anderen Task als Sub-Routine aufrufen.
     */
    public addTaskCall(taskName: string, calledTaskName: string): void {
        this.validateProjectLoaded();

        const task = this.getTaskByName(taskName);
        if (!task) throw new Error(`Task '${taskName}' not found.`);

        const calledTask = this.getTaskByName(calledTaskName);
        if (!calledTask) throw new Error(`Called task '${calledTaskName}' not found. Create it first with createTask().`);

        task.actionSequence.push({
            type: 'task',
            name: calledTaskName
        } as any);

        this.invalidateTaskFlow(taskName);
        AgentController.logger.info(`Added task call '${calledTaskName}' to '${taskName}'.`);
        this.notifyChange();
    }

    /**
     * Setzt den Ausführungsmodus eines Tasks.
     * @param mode - 'local-sync' (Standard), 'local-async', 'broadcast'
     */
    public setTaskTriggerMode(taskName: string, mode: 'local-sync' | 'local' | 'broadcast'): void {
        this.validateProjectLoaded();

        const task = this.getTaskByName(taskName);
        if (!task) throw new Error(`Task '${taskName}' not found.`);

        const validModes = ['local-sync', 'local', 'broadcast'];
        if (!validModes.includes(mode)) {
            throw new Error(`Invalid trigger mode '${mode}'. Valid: ${validModes.join(', ')}`);
        }

        task.triggerMode = mode;
        AgentController.logger.info(`Task '${taskName}' trigger mode set to '${mode}'.`);
        this.notifyChange();
    }

    /**
     * Definiert einen Eingangsparameter für einen Task.
     * Parameter werden beim Event-Auslöser über eventData übergeben (z.B. hitSide bei onBoundaryHit).
     */
    public addTaskParam(taskName: string, paramName: string, type: string = 'string', defaultValue: any = ''): void {
        this.validateProjectLoaded();

        const task = this.getTaskByName(taskName);
        if (!task) throw new Error(`Task '${taskName}' not found.`);

        if (!task.params) task.params = [];

        // Prüfe ob Parameter bereits existiert
        const existing = task.params.find((p: any) => p.name === paramName);
        if (existing) {
            existing.type = type;
            existing.defaultValue = defaultValue;
            AgentController.logger.info(`Updated param '${paramName}' on task '${taskName}'.`);
        } else {
            task.params.push({ name: paramName, type, defaultValue } as any);
            AgentController.logger.info(`Added param '${paramName}' (${type}) to task '${taskName}'.`);
        }

        this.notifyChange();
    }

    /**
     * Ändert die Reihenfolge einer Action/Element in der Sequenz eines Tasks.
     * @param fromIndex - Aktuelle Position (0-basiert)
     * @param toIndex - Neue Position (0-basiert)
     */
    public moveActionInSequence(taskName: string, fromIndex: number, toIndex: number): void {
        this.validateProjectLoaded();

        const task = this.getTaskByName(taskName);
        if (!task) throw new Error(`Task '${taskName}' not found.`);

        const seq = task.actionSequence;
        if (fromIndex < 0 || fromIndex >= seq.length) throw new Error(`fromIndex ${fromIndex} out of bounds (0-${seq.length - 1}).`);
        if (toIndex < 0 || toIndex >= seq.length) throw new Error(`toIndex ${toIndex} out of bounds (0-${seq.length - 1}).`);

        const [item] = seq.splice(fromIndex, 1);
        seq.splice(toIndex, 0, item);

        this.invalidateTaskFlow(taskName);
        AgentController.logger.info(`Moved action in '${taskName}' from index ${fromIndex} to ${toIndex}.`);
        this.notifyChange();
    }


    // ─────────────────────────────────────────────
    // 3. Branch Management
    // ─────────────────────────────────────────────

    /**
     * Fügt eine Condition (Verzweigung) zur actionSequence eines Tasks hinzu.
     * 
     * Invarianten:
     * - Actions in Then/Else-Zweigen müssen global definiert sein.
     * - Flow wird nach Änderung invalidiert.
     * 
     * @param taskName - Name des Ziel-Tasks
     * @param conditionVariable - Variable die geprüft wird (z.B. 'loginResult.success')
     * @param operator - Vergleichsoperator ('==', '!=', '>', '<', '>=', '<=')
     * @param conditionValue - Vergleichswert (z.B. 'true')
     * @param thenBuilder - Callback das den Then-Zweig aufbaut
     * @param elseBuilder - Callback das den Else-Zweig aufbaut (optional)
     */
    public addBranch(
        taskName: string,
        conditionVariable: string,
        operator: ConditionOperator,
        conditionValue: string | number,
        thenBuilder: (branch: BranchBuilder) => void,
        elseBuilder?: (branch: BranchBuilder) => void
    ) {
        this.validateProjectLoaded();

        // 1. Get Task
        const task = this.getTaskByName(taskName);
        if (!task) throw new Error(`Task '${taskName}' not found.`);

        // 2. Build Branches with stage context from Task
        const taskOwner = projectRegistry.getTaskContainer(taskName);
        const stageId = taskOwner.type === 'stage' ? taskOwner.stageId : undefined;

        const thenBranch = new BranchBuilder(this, stageId);
        thenBuilder(thenBranch);

        let elseBranch: BranchBuilder | undefined;
        if (elseBuilder) {
            elseBranch = new BranchBuilder(this, stageId);
            elseBuilder(elseBranch);
        }

        // 3. Ensure all referenced actions exist globally
        this.ensureActionsExistGlobally(thenBranch.getItems());
        if (elseBranch) {
            this.ensureActionsExistGlobally(elseBranch.getItems());
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
        this.invalidateTaskFlow(taskName);

        // 7. Notify
        this.notifyChange();
    }

    /**
     * Stellt sicher, dass alle in einer Branch-Sequenz referenzierten Actions
     * global im Projekt definiert sind.
     */
    private ensureActionsExistGlobally(items: SequenceItem[]) {
        for (const item of items) {
            if (item.type === 'action' && item.name) {
                const exists = this.getActionByName(item.name);
                if (!exists) {
                    throw new Error(
                        `[AgentController] Action '${item.name}' is referenced in branch but not globally defined. ` +
                        `Use addAction() first or define it inline via BranchBuilder.addNewAction().`
                    );
                }
            }
            // Recursively check nested branches
            if (item.then) this.ensureActionsExistGlobally(item.then);
            if (item.else) this.ensureActionsExistGlobally(item.else);
        }
    }

    // ─────────────────────────────────────────────
    // Helper & Validation
    // ─────────────────────────────────────────────

    /**
     * Definiert eine Action (global oder in einer Stage), ohne sie an einen Task anzuhängen.
     * Wird intern vom BranchBuilder genutzt.
     */
    public ensureActionDefined(actionType: ActionType, actionName: string, params: Record<string, any> = {}, stageId?: string) {
        this.validateProjectLoaded();

        // 1. Suche bestehende Action (global oder in der Ziel-Stage)
        let actionDef = this.getActionByName(actionName);

        // 2. Falls stageId angegeben, prüfe ob sie dort existiert
        if (stageId) {
            const stage = this.project!.stages?.find(s => s.id === stageId);
            if (stage) {
                if (!stage.actions) stage.actions = [];
                const stageAction = stage.actions.find(a => a.name === actionName);
                if (stageAction) actionDef = stageAction;
            }
        }

        if (actionDef) {
            // Bereits existent – Parameter aktualisieren
            Object.assign(actionDef, params);
            AgentController.logger.info(`Updated existing action: ${actionName}`);
        } else {
            // Neu erstellen
            actionDef = {
                name: actionName,
                type: actionType,
                ...params
            } as any;

            if (stageId) {
                const stage = this.project!.stages?.find(s => s.id === stageId);
                if (stage) {
                    if (!stage.actions) stage.actions = [];
                    stage.actions.push(actionDef as any);
                    AgentController.logger.info(`Created new STAGE action: ${actionName} in ${stageId}`);
                    return;
                }
            }

            // Fallback: Global (Blueprint stage preferred)
            const blueprintStage = this.project!.stages?.find(s => s.type === 'blueprint');
            if (blueprintStage) {
                if (!blueprintStage.actions) blueprintStage.actions = [];
                blueprintStage.actions.push(actionDef as any);
                AgentController.logger.info(`Created new action in BLUEPRINT: ${actionName}`);
            } else {
                if (!this.project!.actions) this.project!.actions = [];
                this.project!.actions.push(actionDef as any);
                AgentController.logger.info(`Created new GLOBAL action (fallback): ${actionName}`);
            }
        }
    }

    private getTaskByName(name: string): GameTask | undefined {
        // Search Global
        let task = this.project!.tasks?.find(t => t.name === name);
        if (task) return task;

        // Search Stages
        if (this.project!.stages) {
            for (const s of this.project!.stages) {
                if (s.tasks) {
                    task = s.tasks.find(t => t.name === name);
                    if (task) return task;
                }
            }
        }
        return undefined;
    }

    private getActionByName(name: string): BaseAction | undefined {
        // Search Global
        let action = this.project!.actions?.find(a => a.name === name);
        if (action) return action;

        // Search Blueprint Stage
        const blueprintStage = this.project!.stages?.find(s => s.type === 'blueprint');
        if (blueprintStage?.actions) {
            action = blueprintStage.actions.find(a => a.name === name);
            if (action) return action;
        }

        return undefined;
    }

    /**
     * Generiert ein visuelles FlowChart Diagramm aus der actionSequence des Tasks.
     * Dies garantiert, dass der Task im Editor sofort mit richtigem Layout erscheint.
     * INVARIANTEN:
     * - Connections haben IDs und Koordinaten (für FlowGraphManager.restoreConnection)
     * - Typen sind kleingeschrieben ('task', 'action', 'condition')
     */
    public generateTaskFlow(taskName: string) {
        this.validateProjectLoaded();
        const task = this.getTaskByName(taskName);
        if (!task) throw new Error(`Task '${taskName}' not found.`);

        const elements: any[] = [];
        const connections: any[] = [];
        let nextId = 1;
        let nextConnId = 1;
        const getId = () => `node-${Date.now()}-${nextId++}`;
        const getConnId = () => `conn-${Date.now()}-${nextConnId++}`;

        // Helper: Connection mit vollständigen Daten erzeugen
        const addConnection = (fromId: string, toId: string, fromEl: any, toEl: any, anchorStart = 'output', anchorEnd = 'input') => {
            connections.push({
                id: getConnId(),
                startTargetId: fromId,
                endTargetId: toId,
                startX: fromEl.x + 50,
                startY: fromEl.y + 60,
                endX: toEl.x + 50,
                endY: toEl.y,
                data: { startAnchorType: anchorStart, endAnchorType: anchorEnd }
            });
        };

        // Root Node (Task)
        const rootEl = { id: getId(), type: 'task', x: 400, y: 50, properties: { name: task.name, text: task.name, description: task.description }, data: { name: task.name } };
        elements.push(rootEl);

        let currentY = 180;
        const SPACING = 130;

        const processItems = (sequence: any[], startEl: any, startY: number, startX: number = 400): { lastEl: any, lastY: number } => {
            let y = startY;
            let prevEl = startEl;

            for (const item of sequence) {
                if (item.type === 'condition') {
                    const condEl = { id: getId(), type: 'condition', x: startX, y, properties: { text: item.name || `${item.condition?.variable} ${item.condition?.operator} ${item.condition?.value}` } };
                    elements.push(condEl);
                    addConnection(prevEl.id, condEl.id, prevEl, condEl);

                    const branchY = y + SPACING;

                    // THEN Branch
                    if (item.then?.length > 0) {
                        const thenX = startX - 250;
                        const firstThenEl = { id: getId(), type: item.then[0].type === 'task' ? 'task' : 'action', x: thenX, y: branchY, properties: { name: item.then[0].name, text: item.then[0].name }, data: { name: item.then[0].name, isLinked: true } };
                        elements.push(firstThenEl);
                        addConnection(condEl.id, firstThenEl.id, condEl, firstThenEl, 'true', 'input');
                        if (item.then.length > 1) {
                            processItems(item.then.slice(1), firstThenEl, branchY + SPACING, thenX);
                        }
                    }

                    // ELSE Branch
                    if (item.else?.length > 0) {
                        const elseX = startX + 250;
                        const firstElseEl = { id: getId(), type: item.else[0].type === 'task' ? 'task' : 'action', x: elseX, y: branchY, properties: { name: item.else[0].name, text: item.else[0].name }, data: { name: item.else[0].name, isLinked: true } };
                        elements.push(firstElseEl);
                        addConnection(condEl.id, firstElseEl.id, condEl, firstElseEl, 'false', 'input');
                        if (item.else.length > 1) {
                            processItems(item.else.slice(1), firstElseEl, branchY + SPACING, elseX);
                        }
                    }

                    y = branchY + (Math.max(item.then?.length || 0, item.else?.length || 0) * SPACING) + 50;
                    prevEl = condEl;
                } else {
                    // Action oder Task-Referenz — Typ IMMER kleingeschrieben!
                    const nodeEl = { id: getId(), type: item.type === 'task' ? 'task' : 'action', x: startX, y, properties: { name: item.name, text: item.name }, data: { name: item.name, isLinked: true } };
                    elements.push(nodeEl);
                    addConnection(prevEl.id, nodeEl.id, prevEl, nodeEl);
                    prevEl = nodeEl;
                    y += SPACING;
                }
            }
            return { lastEl: prevEl, lastY: y };
        };

        processItems(task.actionSequence, rootEl, currentY);

        // Speichere in der entsprechenden Stage
        const container = projectRegistry.getTaskContainer(taskName);
        if (container.type === 'stage' && container.stageId) {
            const stage = this.project!.stages?.find(s => s.id === container.stageId);
            if (stage) {
                if (!stage.flowCharts) stage.flowCharts = {};
                stage.flowCharts[taskName] = { elements, connections };
                AgentController.logger.info(`Generated FlowChart for '${taskName}' in '${container.stageId}' (${elements.length} nodes, ${connections.length} connections)`);
            }
        } else {
            if (!this.project!.flowCharts) this.project!.flowCharts = {};
            this.project!.flowCharts[taskName] = { elements, connections };
            AgentController.logger.info(`Generated GLOBAL FlowChart for '${taskName}' (${elements.length} nodes, ${connections.length} connections)`);
        }
    }

    // ─────────────────────────────────────────────
    // 4. Delete Operations
    // ─────────────────────────────────────────────

    /** Löscht einen Task und seine FlowChart-Daten. Entfernt Referenzen aus Event-Bindings. */
    public deleteTask(taskName: string): void {
        this.validateProjectLoaded();

        // Aus Stages entfernen
        this.project!.stages?.forEach(s => {
            if (s.tasks) s.tasks = s.tasks.filter(t => t.name !== taskName);
            // Event-Bindings bereinigen
            if (s.objects) {
                s.objects.forEach((obj: any) => {
                    if (obj.events) {
                        for (const [key, val] of Object.entries(obj.events)) {
                            if (val === taskName) delete obj.events[key];
                        }
                    }
                });
            }
        });
        // Aus project.tasks entfernen (Legacy)
        if (this.project!.tasks) this.project!.tasks = this.project!.tasks.filter(t => t.name !== taskName);

        this.invalidateTaskFlow(taskName);
        AgentController.logger.info(`Task '${taskName}' deleted.`);
        this.notifyChange();
    }

    /** Löscht eine Action aus dem Projekt und entfernt sie aus allen Task-Sequenzen. */
    public deleteAction(actionName: string): void {
        this.validateProjectLoaded();

        // Aus allen Stages und project.actions entfernen
        this.project!.stages?.forEach(s => {
            if (s.actions) s.actions = s.actions.filter(a => a.name !== actionName);
        });
        if (this.project!.actions) this.project!.actions = this.project!.actions.filter(a => a.name !== actionName);

        // Aus allen Task-Sequenzen entfernen
        const removeFromSequence = (seq: SequenceItem[]): SequenceItem[] => {
            return seq.filter(item => {
                if (item.type === 'action' && item.name === actionName) return false;
                if (item.then) item.then = removeFromSequence(item.then);
                if (item.else) item.else = removeFromSequence(item.else);
                return true;
            });
        };

        const allTasks = [...(this.project!.tasks || []), ...(this.project!.stages?.flatMap(s => s.tasks || []) || [])];
        allTasks.forEach(t => {
            t.actionSequence = removeFromSequence(t.actionSequence);
            this.invalidateTaskFlow(t.name);
        });

        AgentController.logger.info(`Action '${actionName}' deleted from project and all sequences.`);
        this.notifyChange();
    }

    /** Entfernt ein Objekt aus einer Stage. */
    public removeObject(stageId: string, objectName: string): void {
        this.validateProjectLoaded();
        const stage = this.project!.stages?.find(s => s.id === stageId);
        if (!stage) throw new Error(`Stage '${stageId}' not found.`);
        if (!stage.objects) return;

        const before = stage.objects.length;
        stage.objects = stage.objects.filter((o: any) => o.name !== objectName && o.id !== objectName);

        if (stage.objects.length === before) {
            AgentController.logger.warn(`Object '${objectName}' not found in stage '${stageId}'.`);
            return;
        }
        AgentController.logger.info(`Object '${objectName}' removed from stage '${stageId}'.`);
        this.notifyChange();
    }

    /** Löscht eine Stage (Blueprint-Stage ist geschützt). */
    public deleteStage(stageId: string): void {
        this.validateProjectLoaded();
        if (!this.project!.stages) return;

        const stage = this.project!.stages.find(s => s.id === stageId);
        if (!stage) throw new Error(`Stage '${stageId}' not found.`);
        if (stage.type === 'blueprint') throw new Error('Blueprint-Stage darf nicht gelöscht werden.');

        this.project!.stages = this.project!.stages.filter(s => s.id !== stageId);
        AgentController.logger.info(`Stage '${stageId}' deleted.`);
        this.notifyChange();
    }

    /** Löscht eine Variable aus dem Projekt. */
    public deleteVariable(variableName: string): void {
        this.validateProjectLoaded();
        if (this.project!.variables) {
            this.project!.variables = this.project!.variables.filter(v => v.name !== variableName);
        }
        this.project!.stages?.forEach(s => {
            if (s.variables) s.variables = s.variables.filter((v: any) => v.name !== variableName);
        });
        AgentController.logger.info(`Variable '${variableName}' deleted.`);
        this.notifyChange();
    }

    // ─────────────────────────────────────────────
    // 5. Rename Operations
    // ─────────────────────────────────────────────

    /** Benennt einen Task um (inkl. Referenzen in Events, Sequences, FlowCharts). */
    public renameTask(oldName: string, newName: string): boolean {
        this.validateProjectLoaded();
        const result = projectRegistry.renameTask(oldName, newName);
        if (result) {
            AgentController.logger.info(`Task '${oldName}' renamed to '${newName}'.`);
            this.notifyChange();
        }
        return result;
    }

    /** Benennt eine Action um (inkl. Referenzen in Sequences). */
    public renameAction(oldName: string, newName: string): boolean {
        this.validateProjectLoaded();
        const result = projectRegistry.renameAction(oldName, newName);
        if (result) {
            AgentController.logger.info(`Action '${oldName}' renamed to '${newName}'.`);
            this.notifyChange();
        }
        return result;
    }

    // ─────────────────────────────────────────────
    // 6. Read Operations (Inventar)
    // ─────────────────────────────────────────────

    /** Listet alle Stages auf. */
    public listStages(): { id: string, name: string, type: string, objectCount: number, taskCount: number }[] {
        this.validateProjectLoaded();
        return (this.project!.stages || []).map(s => ({
            id: s.id, name: s.name, type: s.type || 'standard',
            objectCount: (s.objects || []).length,
            taskCount: (s.tasks || []).length
        }));
    }

    /** Listet Tasks auf (optional gefiltert nach Stage). */
    public listTasks(stageId?: string): { name: string, actionCount: number, triggerMode: string }[] {
        this.validateProjectLoaded();
        let tasks: GameTask[] = [];
        if (stageId) {
            const stage = this.project!.stages?.find(s => s.id === stageId);
            tasks = stage?.tasks || [];
        } else {
            tasks = [...(this.project!.tasks || []), ...(this.project!.stages?.flatMap(s => s.tasks || []) || [])];
        }
        return tasks.map(t => ({ name: t.name, actionCount: t.actionSequence.length, triggerMode: t.triggerMode || 'local-sync' }));
    }

    /** Listet Actions auf (optional gefiltert nach Stage). */
    public listActions(stageId?: string): { name: string, type: string }[] {
        this.validateProjectLoaded();
        let actions: BaseAction[] = [];
        if (stageId) {
            const stage = this.project!.stages?.find(s => s.id === stageId);
            actions = (stage?.actions as BaseAction[]) || [];
        } else {
            actions = [...(this.project!.actions || []), ...(this.project!.stages?.flatMap(s => (s.actions as BaseAction[]) || []) || [])];
        }
        return actions.map(a => ({ name: a.name, type: a.type }));
    }

    /** Listet Variablen auf. */
    public listVariables(scope?: 'global' | 'stage'): { name: string, type: string, value: any, scope: string }[] {
        this.validateProjectLoaded();
        const vars: any[] = [];
        if (!scope || scope === 'global') {
            (this.project!.variables || []).forEach(v => vars.push({ name: v.name, type: v.type, value: v.defaultValue ?? v.initialValue, scope: 'global' }));
        }
        if (!scope || scope === 'stage') {
            this.project!.stages?.forEach(s => {
                (s.variables || []).forEach((v: any) => vars.push({ name: v.name, type: v.type, value: v.defaultValue ?? v.initialValue, scope: s.id }));
            });
        }
        return vars;
    }

    /** Listet Objekte einer Stage auf. */
    public listObjects(stageId: string): { name: string, className: string, x: number, y: number, visible: boolean }[] {
        this.validateProjectLoaded();
        const stage = this.project!.stages?.find(s => s.id === stageId);
        if (!stage) return [];
        return (stage.objects || []).map((o: any) => ({ name: o.name, className: o.className, x: o.x || 0, y: o.y || 0, visible: o.visible !== false }));
    }

    /** Gibt detaillierte Task-Infos zurück (mit aufgelöster Sequenz). */
    public getTaskDetails(taskName: string): { name: string, description: string, sequence: SequenceItem[], triggerMode: string } | null {
        this.validateProjectLoaded();
        const task = this.getTaskByName(taskName);
        if (!task) return null;
        return { name: task.name, description: task.description || '', sequence: task.actionSequence, triggerMode: task.triggerMode || 'local-sync' };
    }

    // ─────────────────────────────────────────────
    // 7. UI Interaction
    // ─────────────────────────────────────────────

    /** Setzt eine beliebige Property auf einem Stage-Objekt. Unterstützt dot-notation (z.B. 'style.backgroundColor'). */
    public setProperty(stageId: string, objectName: string, property: string, value: any): void {
        this.validateProjectLoaded();
        const stage = this.project!.stages?.find(s => s.id === stageId);
        if (!stage) throw new Error(`Stage '${stageId}' not found.`);

        const obj = (stage.objects || []).find((o: any) => o.name === objectName || o.id === objectName);
        if (!obj) throw new Error(`Object '${objectName}' not found in stage '${stageId}'.`);

        // Dot-Notation auflösen (z.B. 'style.backgroundColor')
        const parts = property.split('.');
        let target: any = obj;
        for (let i = 0; i < parts.length - 1; i++) {
            if (target[parts[i]] === undefined) target[parts[i]] = {};
            target = target[parts[i]];
        }
        target[parts[parts.length - 1]] = value;

        AgentController.logger.info(`Set ${objectName}.${property} = ${JSON.stringify(value)}`);
        this.notifyChange();
    }

    /** Setzt ein Binding auf einem Objekt-Property (z.B. '${currentUser.name}'). */
    public bindVariable(stageId: string, objectName: string, property: string, expression: string): void {
        // Binding-Format: ${variableName.subProp}
        if (!expression.startsWith('${')) {
            expression = '${' + expression + '}';
        }
        this.setProperty(stageId, objectName, property, expression);
        AgentController.logger.info(`Bound ${objectName}.${property} to '${expression}'`);
    }

    /** Verbindet ein Event eines Objekts mit einem Task. */
    public connectEvent(stageId: string, objectName: string, eventName: string, taskName: string): void {
        this.validateProjectLoaded();
        const stage = this.project!.stages?.find(s => s.id === stageId);
        if (!stage) throw new Error(`Stage '${stageId}' not found.`);

        const obj = (stage.objects || []).find((o: any) => o.name === objectName || o.id === objectName);
        if (!obj) throw new Error(`Object '${objectName}' not found in stage '${stageId}'.`);

        // Prüfe ob Task existiert
        if (!this.getTaskByName(taskName)) {
            throw new Error(`Task '${taskName}' not found. Create it first with createTask().`);
        }

        if (!obj.events) obj.events = {};
        obj.events[eventName] = taskName;

        AgentController.logger.info(`Connected ${objectName}.${eventName} → Task '${taskName}'`);
        this.notifyChange();
    }

    // ─────────────────────────────────────────────
    // 8. Workflow
    // ─────────────────────────────────────────────

    /** Klont einen Task mit neuem Namen (inkl. Action-Sequenz und FlowChart). */
    public duplicateTask(taskName: string, newName: string, stageId?: string): string {
        this.validateProjectLoaded();
        const original = this.getTaskByName(taskName);
        if (!original) throw new Error(`Task '${taskName}' not found.`);
        if (this.getTaskByName(newName)) throw new Error(`Task '${newName}' already exists.`);

        const clone: GameTask = JSON.parse(JSON.stringify(original));
        clone.name = newName;

        // In die richtige Stage einfügen
        const targetStageId = stageId || projectRegistry.getTaskContainer(taskName).stageId || 'stage_blueprint';
        const stage = this.project!.stages?.find(s => s.id === targetStageId);
        if (stage) {
            if (!stage.tasks) stage.tasks = [];
            stage.tasks.push(clone);
        } else {
            if (!this.project!.tasks) this.project!.tasks = [];
            this.project!.tasks.push(clone);
        }

        // FlowChart generieren
        this.generateTaskFlow(newName);

        AgentController.logger.info(`Task '${taskName}' duplicated as '${newName}'.`);
        this.notifyChange();
        return newName;
    }

    // ─────────────────────────────────────────────
    // 9. Validation
    // ─────────────────────────────────────────────

    /** Validiert das Projekt auf Konsistenz. Gibt eine Liste von Problemen zurück. */
    public validate(): { level: 'error' | 'warning', message: string }[] {
        this.validateProjectLoaded();
        const issues: { level: 'error' | 'warning', message: string }[] = [];

        const allActions = [...(this.project!.actions || []), ...(this.project!.stages?.flatMap(s => (s.actions as BaseAction[]) || []) || [])];
        const actionNames = new Set(allActions.map(a => a.name));

        const allTasks = [...(this.project!.tasks || []), ...(this.project!.stages?.flatMap(s => s.tasks || []) || [])];

        // Prüfe: Inline-Actions (verboten!)
        const checkInlineActions = (seq: SequenceItem[], taskName: string) => {
            for (const item of seq) {
                if (item.type === 'action') {
                    // Nur name und type erlaubt — alles andere ist inline
                    const keys = Object.keys(item).filter(k => !['type', 'name'].includes(k));
                    if (keys.length > 0) {
                        issues.push({ level: 'error', message: `Task '${taskName}': Inline-Action gefunden (${item.name}). Nur Referenzen erlaubt!` });
                    }
                    if (item.name && !actionNames.has(item.name)) {
                        issues.push({ level: 'error', message: `Task '${taskName}': Action '${item.name}' ist referenziert aber nicht definiert.` });
                    }
                }
                if (item.then) checkInlineActions(item.then, taskName);
                if (item.else) checkInlineActions(item.else, taskName);
            }
        };

        allTasks.forEach(t => checkInlineActions(t.actionSequence, t.name));

        // Prüfe: Verwaiste Actions (definiert aber nie referenziert)
        const referencedActions = new Set<string>();
        const collectRefs = (seq: SequenceItem[]) => {
            for (const item of seq) {
                if (item.type === 'action' && item.name) referencedActions.add(item.name);
                if (item.then) collectRefs(item.then);
                if (item.else) collectRefs(item.else);
            }
        };
        allTasks.forEach(t => collectRefs(t.actionSequence));
        allActions.forEach(a => {
            if (!referencedActions.has(a.name)) {
                issues.push({ level: 'warning', message: `Action '${a.name}' ist definiert aber in keinem Task referenziert.` });
            }
        });

        // Prüfe: Tasks ohne FlowChart
        allTasks.forEach(t => {
            let hasFlow = false;
            if (this.project!.flowCharts?.[t.name]) hasFlow = true;
            this.project!.stages?.forEach(s => {
                if (s.flowCharts?.[t.name]) hasFlow = true;
            });
            if (!hasFlow && t.actionSequence.length > 0) {
                issues.push({ level: 'warning', message: `Task '${t.name}' hat ${t.actionSequence.length} Actions aber kein FlowChart.` });
            }
        });

        AgentController.logger.info(`Validation complete: ${issues.filter(i => i.level === 'error').length} errors, ${issues.filter(i => i.level === 'warning').length} warnings`);
        return issues;
    }
    // ─────────────────────────────────────────────
    // 10. Batch-API (Transaktionen)
    // ─────────────────────────────────────────────

    /**
     * Führt mehrere API-Aufrufe als Batch/Transaktion aus.
     * Bei Fehler: Rollback auf den Zustand vor dem Batch.
     * @param operations - Array von {method, params} Objekten
     * @returns Array von {method, success, data, error} Ergebnissen
     */
    public executeBatch(operations: Array<{ method: string; params: any[] }>): Array<{ method: string; success: boolean; data: any; error: string | null }> {
        this.validateProjectLoaded();

        // Snapshot für Rollback
        const snapshot = JSON.stringify(this.project);
        const results: Array<{ method: string; success: boolean; data: any; error: string | null }> = [];
        let rollback = false;

        for (const op of operations) {
            try {
                const fn = (this as any)[op.method];
                if (typeof fn !== 'function') {
                    throw new Error(`Methode '${op.method}' existiert nicht auf AgentController.`);
                }
                const result = fn.apply(this, op.params || []);
                results.push({ method: op.method, success: true, data: result ?? null, error: null });
            } catch (e: any) {
                results.push({ method: op.method, success: false, data: null, error: e.message });
                rollback = true;
                break;
            }
        }

        if (rollback) {
            // Rollback: Projekt auf Snapshot zurücksetzen
            const restored = JSON.parse(snapshot);
            Object.assign(this.project!, restored);
            AgentController.logger.warn(`Batch rolled back after error in '${results[results.length - 1]?.method}'.`);
        } else {
            AgentController.logger.info(`Batch executed: ${operations.length} operations OK.`);
        }

        return results;
    }

    // ─────────────────────────────────────────────
    // Internal Helpers
    // ─────────────────────────────────────────────

    private invalidateTaskFlow(taskName: string) {
        if (this.project!.flowCharts && this.project!.flowCharts[taskName]) {
            delete this.project!.flowCharts[taskName];
        }
        if (this.project!.stages) {
            this.project!.stages.forEach(s => {
                if (s.flowCharts && s.flowCharts[taskName]) {
                    delete s.flowCharts[taskName];
                }
            });
        }
    }

    private validateProjectLoaded() {
        if (!this.project) {
            this.project = projectRegistry.getProject();
            if (!this.project) throw new Error("AgentController: No project loaded.");
        }
    }

    private notifyChange() {
        mediatorService.notifyDataChanged(this.project!, 'agent-controller');
    }
}

// Singleton Export & Registration
export const agentController = AgentController.getInstance();
serviceRegistry.register('AgentController', agentController, 'API for AI Agent to manipulate project structure');


