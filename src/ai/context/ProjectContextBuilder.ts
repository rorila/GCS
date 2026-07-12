import { GameProject, ComponentData, GameTask, ProjectVariable } from '../../model/types';
import { UserStory, UserStoryContainer } from '../../editor/userstories/UserStoryTypes';
import { AIGenerationRequest } from '../config/AIConfig';
import { KnowledgeBase } from '../rag/KnowledgeBase';
import { KnowledgeChunk } from '../rag/KnowledgeChunk';

/**
 * ProjectContextBuilder
 *
 * Reduziert ein GameProject auf die für das LLM relevanten Informationen.
 * Filtert Binärdaten, FlowCharts, Editor-States und große Caches heraus.
 */

export interface AIProjectContext {
    projectMeta: {
        id?: string;
        name: string;
        description?: string;
    };

    selectedUserStories: AIUserStorySummary[];

    activeStage?: {
        id: string;
        name: string;
        type: string;
        objects: AIObjectSummary[];
        tasks: AITaskSummary[];
        variables: AIVariableSummary[];
    };

    globalInventory: {
        stages: Array<{ id: string; name: string; type: string }>;
        tasks: Array<{ name: string; stageId?: string }>;
        actions: Array<{ name: string; type: string }>;
        variables: Array<{ name: string; type: string; scope?: string }>;
    };

    relevantApiDocs?: KnowledgeChunk[];
}

export interface AIObjectSummary {
    name: string;
    className: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    text?: string;
    events?: Record<string, string>;
    children?: AIObjectSummary[];
}

export interface AIUserStorySummary {
    id: string;
    title: string;
    description?: string;
    priority: 'high' | 'medium' | 'low';
    status: string;
    plannedComponent?: { compType: string; compName: string };
    plannedEvent?: string;
    plannedEventParam?: string;
    plannedTask?: string;
    plannedActions?: Array<{
        type: string;
        name: string;
        params?: Record<string, any>;
        otherDesc?: string;
    }>;
    plannedCondition?: string;
    agentHints?: string;
    agentControllerScript?: string;
}

export interface AITaskSummary {
    name: string;
    description?: string;
    actionCount: number;
    triggerMode?: string;
    actionNames?: string[];
}

export interface AIVariableSummary {
    name: string;
    type: string;
    scope?: string;
    initialValue?: any;
}

export class ProjectContextBuilder {
    constructor(private project: GameProject) {}

    public build(request: AIGenerationRequest): AIProjectContext {
        const activeStageId = this.getActiveStageId(request);
        const selectedUserStories = this.selectUserStories(request, activeStageId);

        return {
            projectMeta: this.buildProjectMeta(),
            selectedUserStories: selectedUserStories.map(s => this.summarizeUserStory(s)),
            activeStage: activeStageId ? this.summarizeActiveStage(activeStageId) : undefined,
            globalInventory: this.buildGlobalInventory(),
            relevantApiDocs: KnowledgeBase.getInstance().getRelevantChunks(request.instruction, 5),
        };
    }

    private getActiveStageId(request: AIGenerationRequest): string | undefined {
        if (request.activeStageId) {
            return this.resolveStageId(request.activeStageId);
        }

        if (this.project.activeStageId) {
            return this.resolveStageId(this.project.activeStageId);
        }

        const main = this.project.stages?.find(s => s.type === 'main' || s.type === 'standard');
        if (main) return main.id;

        return this.project.stages?.[0]?.id;
    }

    private resolveStageId(id: string): string | undefined {
        const stage = this.project.stages?.find(s => s.id === id || s.name === id);
        return stage?.id ?? id;
    }

    private selectUserStories(request: AIGenerationRequest, activeStageId?: string): UserStory[] {
        const all = this.getAllUserStories();

        switch (request.scope) {
            case 'selectedUserStory':
                if (request.selectedUserStoryIds && request.selectedUserStoryIds.length > 0) {
                    const selected = new Set(request.selectedUserStoryIds);
                    return all.filter(s => selected.has(s.id));
                }
                return all;

            case 'plannedUserStories':
                const planned = all.filter(
                    s =>
                        (s.plannedActions && s.plannedActions.length > 0) ||
                        s.agentControllerScript ||
                        s.plannedTask ||
                        s.plannedComponent
                );
                return planned.length > 0 ? planned : all;

            case 'activeStage':
                if (!activeStageId) return all;
                const related = all.filter(s => s.relatedStages?.includes(activeStageId));
                return related.length > 0 ? related : all;

            case 'project':
            default:
                return all;
        }
    }

    private getAllUserStories(): UserStory[] {
        const container = this.project.userStories as UserStoryContainer | undefined;
        if (container && Array.isArray((container as any).userStories)) {
            return (container as any).userStories as UserStory[];
        }
        if (Array.isArray((this.project.userStories as any))) {
            return this.project.userStories as any;
        }
        return [];
    }

    private buildProjectMeta(): AIProjectContext['projectMeta'] {
        return {
            id: this.project.meta?.id,
            name: this.project.meta?.name || 'Unbenannt',
            description: this.project.meta?.description || this.project.description || '',
        };
    }

    private summarizeActiveStage(stageId: string): AIProjectContext['activeStage'] {
        const stage = this.project.stages?.find(s => s.id === stageId);
        if (!stage) return undefined;

        return {
            id: stage.id,
            name: stage.name,
            type: stage.type,
            objects: (stage.objects || []).map(o => this.summarizeObject(o)),
            tasks: (stage.tasks || []).map(t => this.summarizeTask(t)),
            variables: (stage.variables || []).map(v => this.summarizeVariable(v, stage.id)),
        };
    }

    private summarizeObject(obj: ComponentData): AIObjectSummary {
        const summary: AIObjectSummary = {
            name: obj.name,
            className: obj.className,
            x: obj.x,
            y: obj.y,
            width: obj.width,
            height: obj.height,
            text: obj.text,
            events: obj.events,
        };

        if (obj.children && obj.children.length > 0) {
            summary.children = obj.children.map(child => this.summarizeObject(child));
        }

        return summary;
    }

    private summarizeTask(task: GameTask): AITaskSummary {
        return {
            name: task.name,
            description: task.description,
            actionCount: task.actionSequence?.length ?? 0,
            triggerMode: task.triggerMode,
            actionNames: (task.actionSequence || []).map(item => item.name).filter(Boolean),
        };
    }

    private summarizeVariable(variable: ProjectVariable, stageId?: string): AIVariableSummary {
        return {
            name: variable.name,
            type: variable.type,
            scope: variable.scope || stageId || 'global',
            initialValue: variable.initialValue ?? variable.defaultValue ?? variable.value,
        };
    }

    private summarizeUserStory(userStory: UserStory): AIUserStorySummary {
        return {
            id: userStory.id,
            title: userStory.title,
            description: userStory.description,
            priority: userStory.priority,
            status: userStory.status,
            plannedComponent: userStory.plannedComponent
                ? {
                      compType: userStory.plannedComponent.type,
                      compName: userStory.plannedComponent.name,
                  }
                : undefined,
            plannedEvent: userStory.plannedEvent,
            plannedEventParam: userStory.plannedEventParam,
            plannedTask: userStory.plannedTask,
            plannedActions: userStory.plannedActions,
            plannedCondition: userStory.plannedCondition,
            agentHints: userStory.agentHints,
            agentControllerScript: userStory.agentControllerScript,
        };
    }

    private buildGlobalInventory(): AIProjectContext['globalInventory'] {
        const stages = (this.project.stages || []).map(s => ({
            id: s.id,
            name: s.name,
            type: s.type,
        }));

        const taskMap = new Map<string, { name: string; stageId?: string }>();
        for (const task of this.project.tasks || []) {
            taskMap.set(task.name, { name: task.name });
        }
        for (const stage of this.project.stages || []) {
            for (const task of stage.tasks || []) {
                taskMap.set(task.name, { name: task.name, stageId: stage.id });
            }
        }

        const actionMap = new Map<string, { name: string; type: string }>();
        for (const action of this.project.actions || []) {
            actionMap.set(action.name, { name: action.name, type: action.type });
        }
        for (const stage of this.project.stages || []) {
            for (const action of stage.actions || []) {
                actionMap.set(action.name, { name: action.name, type: action.type });
            }
        }

        const variables: AIProjectContext['globalInventory']['variables'] = [];
        for (const variable of this.project.variables || []) {
            variables.push(this.summarizeVariable(variable, 'global'));
        }
        for (const stage of this.project.stages || []) {
            for (const variable of stage.variables || []) {
                variables.push(this.summarizeVariable(variable, stage.id));
            }
        }

        return {
            stages,
            tasks: Array.from(taskMap.values()),
            actions: Array.from(actionMap.values()),
            variables,
        };
    }
}
