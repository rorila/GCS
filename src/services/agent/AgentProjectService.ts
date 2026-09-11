import { projectStore } from '../ProjectStore';
import { canParentFeature } from '../../model/FeatureHierarchy';
import { ProjectVariable, VariableScope, VariableType } from '../../model/types';
import { Logger } from '../../utils/Logger';
import { RESERVED_VARIABLE_NAMES } from '../../runtime/EventContext';
import { STAGE_CONFIG_EXCLUDE } from './AgentScriptIOTypes';
import { VariableOptions } from './AgentTypes';
import type { AgentController } from '../AgentController';

/**
 * AgentProjectService
 *
 * Kapselt die Verwaltung von Projekt-Struktur-Elementen:
 * Stages, Features, User Stories, Objekte und Variablen.
 */
export class AgentProjectService {
    private logger = Logger.get('AgentProjectService', 'Editor_Diagnostics');

    constructor(private controller: AgentController) {}

    /**
     * Wendet die generische Stage-Config auf ein Stage-Objekt an.
     * Kind-Sammlungen und Positionsargumente (STAGE_CONFIG_EXCLUDE) werden
     * übersprungen, damit config niemals objects/tasks/... überschreibt.
     */
    private applyStageConfig(stage: any, config?: Record<string, any>): void {
        if (!config) return;
        for (const key of Object.keys(config)) {
            if (STAGE_CONFIG_EXCLUDE.has(key)) continue;
            if (config[key] === undefined) continue;
            stage[key] = config[key];
        }
    }

    /** Erstellt eine neue Stage. */
    public createStage(
        id: string,
        name: string,
        type: 'standard' | 'blueprint' = 'standard',
        config?: Record<string, any>
    ): void {
        this.controller.validateProjectLoaded();
        const project = this.controller.getProject()!;
        if (!project.stages) project.stages = [];

        const existingStage = project.stages.find(s => s.id === id);
        if (existingStage) {
            this.applyStageConfig(existingStage, config);
            this.logger.info(`Stage '${id}' updated from import config.`);
            this.controller.notifyChange();
            return;
        }

        const newStage: any = {
            id, name, type,
            objects: [],
            tasks: [],
            actions: [],
            variables: [],
            flowCharts: {},
            events: {}
        };
        this.applyStageConfig(newStage, config);

        project.stages.push(newStage);

        this.logger.info(`Stage '${name}' (${id}) created.`);
        this.controller.notifyChange();
    }

    /** Erstellt oder aktualisiert ein Feature in einer Stage und verknüpft User Stories. */
    public createFeature(stageId: string, featureData: any): void {
        this.controller.validateProjectLoaded();
        const project = this.controller.getProject()!;
        const stage = project.stages?.find(s => s.id === stageId);
        if (!stage) throw new Error(`Stage '${stageId}' not found.`);

        if (!stage.features) stage.features = [];

        const { id, name, description, tags, keywords, parentId, userStoryIds = [], blueprintTaskNames = [] } = featureData || {};
        if (!id) throw new Error('Feature requires an id.');
        if (!name) throw new Error('Feature requires a name.');
        if (parentId !== undefined && (typeof parentId !== 'string' || !canParentFeature(stage.features, id, parentId))) throw new Error('Ungültiger übergeordneter Feature-Bereich.');

        let feature = (stage.features as any[]).find((f: any) => f.id === id);
        if (feature) {
            feature.name = name;
            if (parentId !== undefined) { if (parentId) feature.parentId = parentId; else delete feature.parentId; }
            if (description !== undefined) feature.description = description;
            if (tags !== undefined) feature.tags = tags;
            if (keywords !== undefined) feature.keywords = keywords;
            feature.userStoryIds = userStoryIds;
            feature.blueprintTaskNames = blueprintTaskNames;
        } else {
            feature = { id, name, description, tags, keywords, parentId, userStoryIds, blueprintTaskNames };
            stage.features.push(feature);
        }

        // User Story featureId synchronisieren
        const userStories = project.userStories?.userStories || [];
        for (const us of userStories) {
            if (us.featureId === id && !userStoryIds.includes(us.id)) {
                delete (us as any).featureId;
            }
        }
        for (const usId of userStoryIds) {
            const us = userStories.find((u: any) => u.id === usId);
            if (us) (us as any).featureId = id;
        }

        this.logger.info(`Feature '${name}' (${id}) in stage '${stageId}' created/updated.`);
        this.controller.notifyChange();
    }

    /** Fügt eine User Story zum Projekt hinzu (Upsert anhand der ID). */
    public addUserStory(userStoryData: any): void {
        this.controller.validateProjectLoaded();
        const project = this.controller.getProject()!;

        if (!project.userStories) {
            project.userStories = { projectDescription: undefined, userStories: [] };
        }
        const userStories = project.userStories.userStories || [];
        project.userStories.userStories = userStories;

        const id = userStoryData?.id;
        if (!id) throw new Error('User Story benötigt eine ID.');

        const now = new Date().toISOString();
        const existing = userStories.find((us: any) => us.id === id);

        const data = {
            ...userStoryData,
            projectId: project.meta?.id || project.meta?.name || '',
            updatedAt: now,
        };

        if (!data.acceptanceCriteria) data.acceptanceCriteria = [];
        if (!data.relatedComponents) data.relatedComponents = [];
        if (!data.relatedVariables) data.relatedVariables = [];
        if (!data.relatedStages) data.relatedStages = [];
        if (!data.interactions) data.interactions = [];
        if (!data.status) data.status = 'idea';
        if (!data.priority) data.priority = 'medium';

        if (existing) {
            Object.assign(existing, data);
            existing.id = id;
            this.logger.info(`User Story '${data.title || id}' (${id}) updated.`);
        } else {
            if (!data.createdAt) data.createdAt = now;
            userStories.push(data);
            this.logger.info(`User Story '${data.title || id}' (${id}) added.`);
        }

        this.controller.notifyChange();
    }

    /** Löscht ein Feature aus einer Stage und entfernt featureId bei User Stories. */
    public deleteFeature(stageId: string, featureId: string): void {
        this.controller.validateProjectLoaded();
        const project = this.controller.getProject()!;
        const stage = project.stages?.find(s => s.id === stageId);
        if (!stage) throw new Error(`Stage '${stageId}' not found.`);

        if (stage.features) {
            const idx = stage.features.findIndex((f: any) => f.id === featureId);
            if (idx >= 0) {
                const parentId = stage.features[idx].parentId || '';
                for (const child of stage.features) {
                    if (child.parentId === featureId) projectStore.dispatch({type: 'SET_PROPERTY', target: child, path: 'parentId', value: parentId});
                }
                stage.features.splice(idx, 1);
            }
        }

        const userStories = project.userStories?.userStories || [];
        for (const us of userStories) {
            if ((us as any).featureId === featureId) {
                delete (us as any).featureId;
            }
        }

        this.logger.info(`Feature '${featureId}' removed from stage '${stageId}'.`);
        this.controller.notifyChange();
    }

    /** Fügt ein Objekt zu einer Stage hinzu (Upsert). */
    public addObject(stageId: string, objectData: any): void {
        this.controller.validateProjectLoaded();
        const project = this.controller.getProject()!;
        const stage = project.stages?.find(s => s.id === stageId);
        if (!stage) throw new Error(`Stage '${stageId}' not found.`);

        if (!stage.objects) stage.objects = [];

        // Feature C: TForEach-Validierung
        if (objectData.className === 'TForEach') {
            if (!objectData.source) throw new Error('TForEach requires "source" property (Name einer List/Map-Variable).');
            if (!objectData.template?.className) throw new Error('TForEach.template must have a className property.');
            if (objectData.template.name) {
                this.logger.warn('TForEach.template should not have a fixed name; use namePattern instead.');
                delete objectData.template.name;
            }
        }

        const existing = stage.objects.find((o: any) =>
            (objectData.name != null && objectData.name !== '' && o.name === objectData.name) ||
            (objectData.id != null && objectData.id !== '' && o.id === objectData.id));
        if (existing) {
            const originalId = existing.id;
            Object.assign(existing, objectData);
            existing.id = originalId;
            this.logger.info(`Object '${objectData.name}' updated in stage '${stageId}'.`);
        } else {
            stage.objects.push(objectData);
            this.logger.info(`Object '${objectData.name}' added to stage '${stageId}'.`);
        }

        this.controller.notifyChange();
    }

    /** Registriert eine globale Variable im Projekt. */
    public addVariable(
        name: string,
        type: VariableType | 'number' | 'boolean' | 'string' | 'object' | 'trigger',
        initialValue: any,
        scope: VariableScope = 'global',
        options?: VariableOptions
    ): void {
        this.controller.validateProjectLoaded();
        const project = this.controller.getProject()!;

        // Feature A: Reservierte Magic-Variablen-Namen blockieren
        if (RESERVED_VARIABLE_NAMES.has(name)) {
            throw new Error(`Variable name '${name}' is reserved (Magic-Variable). Reserviert: ${[...RESERVED_VARIABLE_NAMES].join(', ')}`);
        }

        if (!project.variables) project.variables = [];

        const classNameMap: Record<string, string> = {
            'number': 'TIntegerVariable',
            'integer': 'TIntegerVariable',
            'real': 'TRealVariable',
            'boolean': 'TBooleanVariable',
            'string': 'TStringVariable',
            'object': 'TObjectVariable',
            'object_list': 'TObjectList',
            'list': 'TListVariable',
            'trigger': 'TTriggerVariable',
            'threshold': 'TThresholdVariable',
            'timer': 'TTimer',
            'random': 'TRandomVariable',
            'range': 'TRangeVariable',
            'keystore': 'TKeyStore',
            'any': 'TVariable',
            'json': 'TVariable'
        };
        const className = classNameMap[type] || 'TVariable';

        const base: Partial<ProjectVariable> = {
            name,
            type: type as VariableType,
            isVariable: true,
            className,
            initialValue,
            defaultValue: initialValue,
            value: initialValue,
            scope
        };

        if (options) {
            Object.assign(base, options);
            const tasks = this.buildVariableTasks(options);
            if (tasks) base.Tasks = tasks;
        }

        const existing = project.variables.find(v => v.name === name);
        if (existing) {
            Object.assign(existing, base);
            this.logger.info(`Variable '${name}' updated.`);
        } else {
            project.variables.push(base as ProjectVariable);
            this.logger.info(`Variable '${name}' added.`);
        }

        this.controller.notifyChange();
    }

    /**
     * Baut aus den Event-Handler-Optionen einer Variable ein Tasks-Mapping.
     * Der RuntimeVariableManager erwartet Events in `varDef.Tasks`.
     */
    private buildVariableTasks(options: VariableOptions): Record<string, string> | undefined {
        const tasks: Record<string, string> = {};
        const eventNames = [
            'onValueChanged', 'onValueEmpty',
            'onThresholdReached', 'onThresholdLeft', 'onThresholdExceeded',
            'onTriggerEnter', 'onTriggerExit',
            'onFinished', 'onTick', 'onHour', 'onMinute', 'onSecond',
            'onMinReached', 'onMaxReached', 'onInside', 'onOutside',
            'onItemAdded', 'onItemRemoved', 'onContains', 'onNotContains', 'onCleared',
            'onGenerated',
            'onItemCreated', 'onItemUpdated', 'onItemDeleted', 'onItemRead', 'onNotFound'
        ];
        eventNames.forEach(eventName => {
            const taskName = (options as any)[eventName];
            if (taskName) tasks[eventName] = taskName;
        });
        return Object.keys(tasks).length > 0 ? tasks : undefined;
    }
}
