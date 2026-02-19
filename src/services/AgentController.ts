import { GameProject, BaseAction, GameTask, ActionType, SequenceItem, ConditionOperator } from '../model/types';
import { projectRegistry } from './ProjectRegistry';
import { mediatorService } from './MediatorService';
import { serviceRegistry } from './ServiceRegistry';

/**
 * BranchBuilder
 * 
 * Hilfsklasse zum Aufbau von Then/Else-Zweigen innerhalb einer Condition.
 * Wird als Callback-Parameter an `AgentController.addBranch()` übergeben.
 */
export class BranchBuilder {
    private items: SequenceItem[] = [];
    private controller: AgentController;

    constructor(controller: AgentController) {
        this.controller = controller;
    }

    /** Referenziert eine existierende, global definierte Action. */
    addAction(actionName: string): BranchBuilder {
        this.items.push({ type: 'action', name: actionName });
        return this;
    }

    /** Definiert eine NEUE Action global und referenziert sie im Branch. */
    addNewAction(actionType: ActionType, actionName: string, params: Record<string, any> = {}): BranchBuilder {
        // Delegate global creation to AgentController
        this.controller.ensureActionDefined(actionType, actionName, params);
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
            console.warn(`[AgentController] Task '${taskName}' already exists. Skipping creation.`);
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

        // 3. Register Globally (Data) & Locally (Stage)
        if (!this.project!.tasks) this.project!.tasks = [];
        this.project!.tasks.push(newTask);

        if (stageId) {
            const stage = this.project!.stages?.find(s => s.id === stageId || s.name === stageId);
            if (stage) {
                if (!stage.tasks) stage.tasks = [];
                // We reference the SAME object to keep sync, or copy? 
                // GCS Architecture typically puts tasks EITHER in global OR in stage.
                // "Dual Booking" is risky for duplicates. 
                // Plan said: "Eintrag in project.tasks UND stage.tasks" -> let's be careful.
                // Better: Put it where requested. If stageId is provided, put it in Stage.
                stage.tasks.push(newTask);
            } else {
                console.warn(`[AgentController] Stage '${stageId}' not found. Task '${taskName}' created globally only.`);
            }
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
            // Create New Global Definition
            actionDef = {
                name: actionName,
                type: actionType,
                ...params
            };
            if (!this.project!.actions) this.project!.actions = [];
            this.project!.actions.push(actionDef);
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

        // 2. Build Branches
        const thenBranch = new BranchBuilder(this);
        thenBuilder(thenBranch);

        let elseBranch: BranchBuilder | undefined;
        if (elseBuilder) {
            elseBranch = new BranchBuilder(this);
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
     * Definiert eine Action global, ohne sie an einen Task anzuhängen.
     * Wird intern vom BranchBuilder genutzt.
     */
    public ensureActionDefined(actionType: ActionType, actionName: string, params: Record<string, any> = {}) {
        this.validateProjectLoaded();
        let actionDef = this.getActionByName(actionName);
        if (actionDef) {
            // Already exists – update params if needed
            Object.assign(actionDef, params);
        } else {
            actionDef = {
                name: actionName,
                type: actionType,
                ...params
            };
            if (!this.project!.actions) this.project!.actions = [];
            this.project!.actions.push(actionDef);
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
        return this.project!.actions?.find(a => a.name === name);
    }

    private invalidateTaskFlow(taskName: string) {
        // Remove flowChart data to force re-generation by FlowEditor from actionSequence
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
            // Try to fetch from registry if not set
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

