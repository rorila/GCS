import { GameProject, BaseAction, GameTask } from '../model/types';
import { projectRegistry } from './ProjectRegistry';
import { mediatorService } from './MediatorService';
import { serviceRegistry } from './ServiceRegistry';

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
    public addAction(taskName: string, actionType: string, actionName: string, params: Record<string, any> = {}) {
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
    // Helper & Validation
    // ─────────────────────────────────────────────

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

