import { GameProject, StageDefinition } from '../../model/types';
import { RefactoringManager } from '../RefactoringManager';
import { mediatorService } from '../../services/MediatorService';
import { FlowNamingService } from './FlowNamingService';
import { Logger } from '../../utils/Logger';

export interface FlowTaskHost {
    project: GameProject | null;
    currentFlowContext: string;
    editor: any;
    onProjectChange?: () => void;

    getActiveStage(): StageDefinition | null;
    getTaskDefinitionByName(name: string): any | null;
    updateFlowSelector(): void;
    switchActionFlow(context: string, addToHistory?: boolean, skipSync?: boolean): void;
    createNode(type: string, x: number, y: number, initialName?: string): any;
    syncManager: any;
    nodes: any[];
}

export class FlowTaskManager {
    private static logger = Logger.get('FlowEditor', 'Task_Management');
    constructor(private host: FlowTaskHost) { }

    public createNewTaskFlow() {
        if (!this.host.project) return;

        // 1. Generate unique Name via Service
        const name = FlowNamingService.generateUniqueTaskName(this.host.project, this.host.nodes, "ANewTask");

        // 2. Create Task
        const targetCollection = this.host.editor ? this.host.editor.getTargetTaskCollection(name) : (this.host.project.tasks || (this.host.project.tasks = []));
        targetCollection.push({
            name: name,
            actionSequence: []
        });

        // 3. Initialize flowChart for this task
        const targetCharts = this.getTargetFlowCharts(name);
        targetCharts[name] = { elements: [], connections: [] };

        // 4. Update UI
        this.host.updateFlowSelector();

        // Notify Mediator
        mediatorService.notifyDataChanged(this.host.project, 'flow-editor');

        // 5. Switch to new Task
        this.host.switchActionFlow(name);

        // 6. Automatically insert a task node
        setTimeout(() => {
            this.host.createNode('Task', 400, 200, name);
        }, 100);
    }

    public getTargetFlowCharts(taskName?: string): any {
        if (!this.host.project) return {};
        const activeStage = this.host.getActiveStage();

        // 1. Check Blueprint stage
        const blueprint = this.host.project.stages?.find(s => s.id === 'stage_blueprint' || s.type === 'blueprint');
        if (blueprint) {
            const isBlueprintTask = blueprint.tasks?.some((t: any) => t.name === taskName);
            if (isBlueprintTask) {
                return blueprint.flowCharts || (blueprint.flowCharts = {});
            }
        }

        // 2. Check global (legacy)
        const isGlobalTask = this.host.project.tasks?.some((t: any) => t.name === taskName);
        if (isGlobalTask) {
            return this.host.project.flowCharts || (this.host.project.flowCharts = {});
        }

        if (!activeStage) return this.host.project.flowCharts || (this.host.project.flowCharts = {});

        // 3. Stage task
        const isStageTask = activeStage.tasks?.some((t: any) => t.name === taskName);
        if (isStageTask) {
            return activeStage.flowCharts || (activeStage.flowCharts = {});
        }

        // Fallback
        if (activeStage.flowCharts?.[taskName || '']) return activeStage.flowCharts;
        if (blueprint?.flowCharts?.[taskName || '']) return blueprint.flowCharts;
        if (this.host.project.flowCharts?.[taskName || '']) return this.host.project.flowCharts;

        // Default to active stage
        if (!activeStage.flowCharts) activeStage.flowCharts = {};
        return activeStage.flowCharts;
    }

    public deleteCurrentTaskFlow() {
        if (!this.host.project || this.host.currentFlowContext === 'global') {
            alert('Cannot delete the Main Flow (Global).');
            return;
        }

        if (!confirm(`Are you sure you want to delete Task "${this.host.currentFlowContext}" and its flow?`)) {
            return;
        }

        RefactoringManager.deleteTask(this.host.project, this.host.currentFlowContext);

        // 2. Switch context WITHOUT syncing the deleted flow back to project!
        this.host.switchActionFlow('global', true, true);

        // 3. Force rebuild of selector options
        this.host.updateFlowSelector();
        FlowTaskManager.logger.info(`Flow-Dropdown-Liste aktualisiert.`);

        // Notify Mediator
        mediatorService.notifyDataChanged(this.host.project, 'flow-editor');
        FlowTaskManager.logger.info(`Management-Liste (Mediator) synchronisiert.`);

        if (this.host.onProjectChange) this.host.onProjectChange();
    }

    public rebuildActionRegistry() {
        if (!this.host.project) return;
        this.host.project.actions = this.host.project.actions || [];

        const register = (elements: any[]) => {
            elements.forEach(el => {
                if (el.type === 'action') {
                    const name = el.properties?.name || el.data?.name || el.data?.actionName || el.properties?.text;
                    const details = el.properties?.details || el.data?.details;
                    const isMeaningful = el.data?.type || el.data?.actionName || el.data?.taskName || (el.properties?.details && el.properties.details.trim() !== '');
                    if (name && (name !== 'Action' && name !== 'Aktion' || isMeaningful)) {
                        this.host.syncManager.updateGlobalActionDefinition({ ...el.data, name, details });
                    }
                }
            });
        };

        const globalFlowElements = this.host.project.flowCharts?.global?.elements || (this.host.project as any).flow?.elements;
        if (globalFlowElements) register(globalFlowElements);

        if (this.host.project.flowCharts) {
            Object.keys(this.host.project.flowCharts).forEach(key => {
                if (key !== 'global') {
                    const flowChart = this.host.project!.flowCharts![key];
                    if (flowChart?.elements) register(flowChart.elements);
                }
            });
        }

        if (this.host.project.stages) {
            this.host.project.stages.forEach(stage => {
                if (stage.flowCharts) {
                    Object.keys(stage.flowCharts).forEach(key => {
                        const flowChart = stage.flowCharts![key];
                        if (flowChart?.elements) register(flowChart.elements);
                    });
                }
            });
        }
    }

    public ensureTaskExists(taskName: string, description?: string) {
        if (!this.host.project) return;
        FlowTaskManager.logger.info(`[TRACE] ensureTaskExists: "${taskName}"`);
        if (!this.host.project.tasks) this.host.project.tasks = [];

        const existingTask = this.host.getTaskDefinitionByName(taskName);
        if (existingTask) {
            if (description && !existingTask.description) {
                existingTask.description = description;
            }
            if (!existingTask.triggerMode) existingTask.triggerMode = 'local-sync';
            if (!existingTask.params) existingTask.params = [];
            if (existingTask.description === undefined) existingTask.description = '';
            return;
        }

        const newTask = {
            name: taskName,
            description: description || '',
            actionSequence: [],
            triggerMode: 'local-sync' as any,
            params: []
        };

        const activeStage = this.host.getActiveStage();
        if (activeStage && activeStage.type !== 'main') {
            if (!activeStage.tasks) activeStage.tasks = [];
            activeStage.tasks.push(newTask);
        } else {
            this.host.project.tasks.push(newTask);
        }
    }
}
