import { Logger } from '../../utils/Logger';
import type { AgentController } from '../AgentController';
import { AgentScript, AgentScriptOperation, AGENT_SCRIPT_VERSION, ExportOptions, ExportSelection } from './AgentScriptTypes';
import { STAGE_CONFIG_EXCLUDE } from './AgentScriptIOTypes';
import { AgentScriptAssetHelper } from './AgentScriptAssetHelper';
import { AgentScriptConditionHelper } from './AgentScriptConditionHelper';

/**
 * AgentScriptExportService
 *
 * Generiert AgentScript-Operationen aus dem aktuellen Projekt.
 * Kapselt Task-, Stage-, Projekt- und Feature-Export.
 */
export class AgentScriptExportService {
    constructor(private controller: AgentController, private logger: Logger) {}

    public exportScript(options: ExportOptions): AgentScript {
        this.controller.validateProjectLoaded?.();

        const ops: AgentScriptOperation[] = [];

        switch (options.scope) {
            case 'task':
                this.exportTask(options.targetId, undefined, ops);
                break;
            case 'stage':
                this.exportStage(options.targetId, ops, true);
                break;
            case 'project':
                this.exportProject(ops);
                break;
            case 'selection':
                if (!options.selection) throw new Error('Für scope "selection" muss options.selection angegeben werden.');
                this.exportSelection(options.selection, ops);
                break;
            case 'feature':
                this.exportFeature(options.targetId, options.featureStageId, ops, options.withPlaceholders ? (options.defaultStagePlaceholder || 'STAGE') : undefined);
                break;
            default:
                throw new Error(`Unbekannter Export-Scope: ${(options as any).scope}`);
        }

        if (options.includeOnly && options.includeOnly.length > 0) {
            const allowed = new Set(options.includeOnly);
            for (let i = ops.length - 1; i >= 0; i--) {
                if (!allowed.has(ops[i].method)) ops.splice(i, 1);
            }
        }
        if (options.exclude && options.exclude.length > 0) {
            const blocked = new Set(options.exclude);
            for (let i = ops.length - 1; i >= 0; i--) {
                if (blocked.has(ops[i].method)) ops.splice(i, 1);
            }
        }

        if (options.withPlaceholders && options.scope !== 'feature') {
            this.replaceWithPlaceholders(ops, options.defaultStagePlaceholder || 'STAGE');
        }

        const assetPaths = AgentScriptAssetHelper.collectAssetPaths(ops).filter(p => p.trim() !== '');
        return {
            version: AGENT_SCRIPT_VERSION,
            name: `Export_${options.scope}_${options.targetId || Date.now()}`,
            description: `Exportiert aus ${options.scope}${options.targetId ? ` '${options.targetId}'` : ''}`,
            scope: options.scope,
            operations: ops,
            assetPaths: assetPaths.length > 0 ? assetPaths : undefined,
        };
    }

    /**
     * Serialisiert ein Stage-Objekt für den Export.
     * Nutzt toDTO() falls verfügbar (Live-Instanz), damit Getter-Properties
     * wie `backgroundImage` korrekt als öffentliche Felder exportiert werden
     * (statt der privaten `_backgroundImage`-Backing-Felder).
     */
    private serializeObject(obj: any): any {
        if (obj && typeof obj.toDTO === 'function') {
            return obj.toDTO();
        }
        return obj;
    }

    public exportTask(taskName: string | undefined, stageId: string | undefined, ops: AgentScriptOperation[], emitCreateTask = true): void {
        if (!taskName) throw new Error('Für Task-Export muss targetId (Task-Name) angegeben werden.');
        const details = this.controller.getTaskDetails(taskName);
        if (!details) throw new Error(`Task '${taskName}' nicht gefunden.`);

        const stageParam = stageId || '${STAGE}';
        if (emitCreateTask) {
            ops.push({ method: 'createTask', params: [stageParam, details.name, details.description] });
        }

        // Bereits als global definiert exportierte Actions (Dedup für ensureActionDefined)
        const definedActions = new Set<string>();

        for (const item of details.sequence as any[]) {
            if ((item.type === 'action' || item.type === 'data_action') && item.name) {
                const action = this.controller.getActionByName?.(item.name);
                if (action) {
                    const { name, type, ...params } = action as any;
                    ops.push({ method: 'addAction', params: [details.name, type, name, params] });
                    definedActions.add(name);
                } else {
                    this.logger.warn(`exportTask: Action '${item.name}' nicht gefunden, wird übersprungen.`);
                }
            } else if (item.type === 'task' && item.name) {
                ops.push({ method: 'addTaskCall', params: [details.name, item.name] });
            } else if (item.type === 'condition' && item.condition) {
                // 1. Alle referenzierten Actions global definieren (Shortcut- UND Array-Form)
                AgentScriptConditionHelper.emitConditionActionDefs(item, ops, definedActions, this.controller, this.logger);
                // 2. Vollständiges Condition-Item unverändert übernehmen
                //    (bewahrt thenAction/elseAction/thenTask/elseTask und then/else)
                ops.push({ method: 'addConditionItem', params: [details.name, item] });
            }
        }
    }

    /**
     * Baut die generische Stage-Config (Ansatz C): alle Skalar-/Config-Felder
     * außer den Kind-Sammlungen und Positionsargumenten. Private Backing-Felder
     * (`_`-Präfix) und Funktionen werden ausgeschlossen.
     */
    private buildStageConfig(fullStage: any): Record<string, any> {
        const config: Record<string, any> = {};
        if (!fullStage) return config;
        for (const key of Object.keys(fullStage)) {
            if (STAGE_CONFIG_EXCLUDE.has(key)) continue;
            if (key.startsWith('_')) continue;
            const val = fullStage[key];
            if (val === undefined || typeof val === 'function') continue;
            config[key] = val;
        }
        return config;
    }

    private buildCreateStageParams(stage: { id?: string; name: string; type?: string }, fullStage: any): any[] {
        const config = this.buildStageConfig(fullStage);
        return Object.keys(config).length > 0
            ? [stage.id, stage.name, stage.type || 'standard', config]
            : [stage.id, stage.name, stage.type || 'standard'];
    }

    public exportStage(stageId: string | undefined, ops: AgentScriptOperation[], emitCreateStage = false): void {
        if (!stageId) throw new Error('Für Stage-Export muss targetId (Stage-ID) angegeben werden.');
        const stages = this.controller.listStages();
        const stage = stages.find(s => s.id === stageId || s.name === stageId);
        if (!stage) throw new Error(`Stage '${stageId}' nicht gefunden.`);

        const project = this.controller.getProject();
        const fullStage = project?.stages?.find((s: any) => s.id === stageId || s.name === stageId);

        // Stage selbst anlegen (nur bei eigenständigem Stage-Export, nicht im Projekt-Export)
        if (emitCreateStage) {
            ops.push({ method: 'createStage', params: this.buildCreateStageParams(stage, fullStage) });
        }

        // Objekte exportieren
        if (fullStage?.objects) {
            for (const obj of fullStage.objects) {
                const { name, className, ...rest } = this.serializeObject(obj);
                ops.push({ method: 'addObject', params: [stageId, { name, className, ...rest }] });
            }
        }

        // Stage-Variablen exportieren
        if (fullStage?.variables) {
            for (const v of fullStage.variables) {
                ops.push({ method: 'addVariable', params: [v.name, v.type, v.initialValue ?? v.defaultValue, v.scope || stageId] });
            }
        }

        // Tasks exportieren
        const taskDetails = this.controller.listTasks(stageId);
        for (const task of taskDetails) {
            this.exportTask(task.name, stageId, ops);
        }
    }

    private exportProject(ops: AgentScriptOperation[]): void {
        const stages = this.controller.listStages();
        const project = this.controller.getProject();
        for (const stage of stages) {
            if (!stage.id) continue;
            const fullStage = project?.stages?.find((s: any) => s.id === stage.id || s.name === stage.name);
            ops.push({ method: 'createStage', params: this.buildCreateStageParams(stage, fullStage) });
        }
        for (const stage of stages) {
            if (stage.id) this.exportStage(stage.id, ops);
        }
    }

    private exportSelection(selection: ExportSelection, ops: AgentScriptOperation[]): void {
        if (!selection) throw new Error('Für Selection-Export muss options.selection angegeben werden.');
        const project = this.controller.getProject();

        for (const taskName of selection.tasks || []) {
            this.exportTask(taskName, undefined, ops);
        }

        for (const stage of project?.stages || []) {
            for (const obj of stage.objects || []) {
                if (selection.objects?.includes(obj.name)) {
                    const { name, className, ...rest } = this.serializeObject(obj);
                    ops.push({ method: 'addObject', params: [stage.id || '${STAGE}', { name, className, ...rest }] });
                }
            }
            for (const v of stage.variables || []) {
                if (selection.variables?.includes(v.name)) {
                    ops.push({ method: 'addVariable', params: [v.name, v.type, v.initialValue ?? v.defaultValue, stage.id || '${STAGE}'] });
                }
            }
        }

        for (const v of project?.variables || []) {
            if (selection.variables?.includes(v.name)) {
                ops.push({ method: 'addVariable', params: [v.name, v.type, v.initialValue ?? v.defaultValue, 'global'] });
            }
        }
    }

    public exportFeature(taskNameOrFeatureId: string | undefined, explicitStageId: string | undefined, ops: AgentScriptOperation[], stagePlaceholder?: string): void {
        if (!taskNameOrFeatureId) throw new Error('Für Feature-Export muss targetId (Task-Name oder Feature-ID) angegeben werden.');
        const project = this.controller.getProject();

        // 1. Feature auflösen (falls targetId eine Feature-ID ist)
        let feature: any;
        let featureStage: any;
        let stageId = explicitStageId;

        if (stageId) {
            featureStage = project?.stages?.find((s: any) => s.id === stageId || s.name === stageId);
            feature = featureStage?.features?.find((f: any) => f.id === taskNameOrFeatureId);
        }
        if (!feature) {
            for (const s of project?.stages || []) {
                const f = s.features?.find((f: any) => f.id === taskNameOrFeatureId);
                if (f) { feature = f; featureStage = s; stageId = s.id; break; }
            }
        }

        // 2. Tasks sammeln
        const taskEntries: { name: string; stageId: string; blueprint: boolean }[] = [];
        if (feature) {
            const blueprintStageId = project?.stages?.find((s: any) => s.type === 'blueprint')?.id;
            const storyIds = new Set<string>(feature.userStoryIds || []);
            for (const us of project?.userStories?.userStories || []) {
                if (storyIds.has(us.id) && us.plannedTask) {
                    const tStage = this.findTaskStage(us.plannedTask, project);
                    taskEntries.push({ name: us.plannedTask, stageId: tStage?.id || stageId, blueprint: tStage?.id === blueprintStageId || tStage?.type === 'blueprint' });
                }
            }
            for (const tName of feature.blueprintTaskNames || []) {
                if (!taskEntries.some(e => e.name === tName)) {
                    const tStage = this.findTaskStage(tName, project);
                    taskEntries.push({ name: tName, stageId: tStage?.id || stageId, blueprint: true });
                }
            }
        } else {
            const tStage = this.findTaskStage(taskNameOrFeatureId, project);
            stageId = explicitStageId || tStage?.id;
            if (!stageId) throw new Error(`Keine Stage für Task '${taskNameOrFeatureId}' gefunden.`);
            featureStage = project?.stages?.find((s: any) => s.id === stageId || s.name === stageId);
            taskEntries.push({ name: taskNameOrFeatureId, stageId, blueprint: featureStage?.type === 'blueprint' || tStage?.type === 'blueprint' });
        }

        if (taskEntries.length === 0) throw new Error(`Keine Tasks für Feature '${taskNameOrFeatureId}' gefunden.`);
        if (!featureStage) {
            featureStage = project?.stages?.find((s: any) => s.id === stageId || s.name === stageId);
            if (!featureStage) throw new Error(`Stage '${stageId}' nicht gefunden.`);
        }

        const exportStageId = stageId || taskEntries[0].stageId;
        const STAGE_PLACEHOLDER = stagePlaceholder ? '${' + stagePlaceholder + '}' : undefined;
        const featureOwnedObjects = new Set<string>();

        // 3. Referenzierte Objekte, Variablen und Events über alle Tasks sammeln
        const allProjectObjectNames = new Set<string>();
        const objectToStageMap = new Map<string, { obj: any; stageId: string }>();

        // Priorität: Feature-Stage → Blueprint → andere Stages
        const featureStageObj = project?.stages?.find((s: any) => s.id === exportStageId);
        const blueprintStage = project?.stages?.find((s: any) => s.type === 'blueprint' || s.id === 'blueprint');

        if (featureStageObj) {
            for (const o of featureStageObj?.objects || []) {
                if (o?.name) {
                    allProjectObjectNames.add(o.name);
                    objectToStageMap.set(o.name, { obj: o, stageId: featureStageObj.id });
                }
            }
        }

        if (blueprintStage) {
            for (const o of blueprintStage?.objects || []) {
                if (o?.name) {
                    allProjectObjectNames.add(o.name);
                    if (!objectToStageMap.has(o.name)) {
                        objectToStageMap.set(o.name, { obj: o, stageId: blueprintStage.id });
                    }
                }
            }
        }

        for (const s of project?.stages || []) {
            if (s.id === featureStageObj?.id || s.id === blueprintStage?.id) continue;
            for (const o of s?.objects || []) {
                if (o?.name) {
                    allProjectObjectNames.add(o.name);
                    if (!objectToStageMap.has(o.name)) {
                        objectToStageMap.set(o.name, { obj: o, stageId: s.id });
                    }
                }
            }
        }

        const allVariableNames = new Set<string>();
        for (const v of project?.variables || []) if (v?.name) allVariableNames.add(v.name);
        for (const s of project?.stages || []) for (const v of s?.variables || []) if (v?.name) allVariableNames.add(v.name);

        const objectMap = new Map<string, { obj: any; stageId: string }>();
        const variableMap = new Map<string, { variable: any; scope: any }>();
        const connectEventOps: AgentScriptOperation[] = [];

        for (const entry of taskEntries) {
            const task = this.controller.getTaskByName(entry.name) as any;
            if (!task) continue;
            const stage = project?.stages?.find((s: any) => s.id === entry.stageId || s.name === entry.stageId);
            if (!stage) continue;

            for (const obj of stage.objects || []) {
                for (const [eventName, connectedTaskName] of Object.entries(obj.events || {})) {
                    if (connectedTaskName === entry.name) {
                        objectMap.set(obj.name, { obj, stageId: stage.id });
                        connectEventOps.push({ method: 'connectEvent', params: [entry.stageId, obj.name, eventName, entry.name] });
                    }
                }
            }

            if (task.actionSequence) {
                const referencedObjectNames = new Set<string>();
                const referencedVariableNames = new Set<string>();
                AgentScriptConditionHelper.collectReferencedEntities(task.actionSequence, allProjectObjectNames, allVariableNames, referencedObjectNames, referencedVariableNames, this.controller);

                for (const on of referencedObjectNames) {
                    const ref = objectToStageMap.get(on);
                    if (ref) {
                        objectMap.set(on, ref);
                        featureOwnedObjects.add(on);
                    }
                }

                for (const vn of referencedVariableNames) {
                    let variable: any = (project?.variables || []).find((v: any) => v.name === vn);
                    let scope: any = 'global';
                    if (!variable) {
                        const vStage = project?.stages?.find((s: any) => s.variables?.some((v: any) => v.name === vn));
                        variable = vStage?.variables?.find((v: any) => v.name === vn);
                        scope = vStage?.id;
                    }
                    if (variable) variableMap.set(vn, { variable, scope });
                }
            }
        }

        // 3a. Rekursiv: exportierte Objekte und Variablen nach Referenzen scannen
        const scanQueue: { type: 'object' | 'variable'; name: string }[] = [];
        for (const [name] of objectMap) scanQueue.push({ type: 'object', name });
        for (const [name] of variableMap) scanQueue.push({ type: 'variable', name });

        const processed = new Set<string>();
        while (scanQueue.length > 0) {
            const item = scanQueue.shift()!;
            const key = `${item.type}:${item.name}`;
            if (processed.has(key)) continue;
            processed.add(key);

            const referencedObjectNames = new Set<string>();
            const referencedVariableNames = new Set<string>();

            if (item.type === 'object') {
                const ref = objectMap.get(item.name);
                if (ref) {
                    const serialized = this.serializeObject(ref.obj);
                    AgentScriptConditionHelper.scanValueForReferences(serialized, allProjectObjectNames, allVariableNames, referencedObjectNames, referencedVariableNames);
                }
            } else {
                const v = variableMap.get(item.name);
                if (v) {
                    AgentScriptConditionHelper.scanValueForReferences(v.variable, allProjectObjectNames, allVariableNames, referencedObjectNames, referencedVariableNames);
                }
            }

            for (const on of referencedObjectNames) {
                if (!objectMap.has(on)) {
                    const newRef = objectToStageMap.get(on);
                    if (newRef) {
                        objectMap.set(on, newRef);
                        scanQueue.push({ type: 'object', name: on });
                    }
                }
            }

            for (const vn of referencedVariableNames) {
                if (!variableMap.has(vn)) {
                    let variable: any = (project?.variables || []).find((v: any) => v.name === vn);
                    let scope: any = 'global';
                    if (!variable) {
                        const vStage = project?.stages?.find((s: any) => s.variables?.some((v: any) => v.name === vn));
                        variable = vStage?.variables?.find((v: any) => v.name === vn);
                        scope = vStage?.id;
                    }
                    if (variable) {
                        variableMap.set(vn, { variable, scope });
                        scanQueue.push({ type: 'variable', name: vn });
                    }
                }
            }
        }

        // 3b. User Stories für Feature-Gruppe exportieren
        const allUserStories = project?.userStories?.userStories || [];
        const exportedUserStoryIds = new Set<string>();
        if (feature) {
            for (const usId of feature.userStoryIds || []) {
                const us = allUserStories.find((u: any) => u.id === usId);
                if (us && !exportedUserStoryIds.has(us.id)) {
                    exportedUserStoryIds.add(us.id);
                    const { id, title, description, acceptanceCriteria, priority, status, relatedComponents, relatedVariables, relatedStages, interactions, trigger, plannedComponent, plannedEvent, plannedEventParam, plannedTask, plannedActions, agentHints, featureId } = us;
                    ops.push({
                        method: 'addUserStory',
                        params: [{ id, title, description, acceptanceCriteria, priority, status, relatedComponents, relatedVariables, relatedStages, interactions, trigger, plannedComponent, plannedEvent, plannedEventParam, plannedTask, plannedActions, agentHints, featureId }]
                    });
                }
            }
        }

        // 4. createFeature für Feature-Gruppen
        if (feature) {
            const createFeatureStage = STAGE_PLACEHOLDER || exportStageId;
            ops.push({
                method: 'createFeature',
                params: [createFeatureStage, { id: feature.id, name: feature.name, description: feature.description, userStoryIds: feature.userStoryIds, blueprintTaskNames: feature.blueprintTaskNames }]
            });
        }

        // 5. Objekte und Variablen exportieren
        for (const [name, { obj, stageId: objStageId }] of objectMap) {
            const { name: exportedName, className, ...rest } = this.serializeObject(obj);
            const objectStage = (STAGE_PLACEHOLDER && featureOwnedObjects.has(name) && objStageId === exportStageId) ? STAGE_PLACEHOLDER : objStageId;
            ops.push({ method: 'addObject', params: [objectStage, { name: exportedName, className, ...rest }] });
        }

        for (const { variable, scope } of variableMap.values()) {
            const variableScope = (STAGE_PLACEHOLDER && scope === exportStageId) ? STAGE_PLACEHOLDER : (scope ?? 'global');
            ops.push({ method: 'addVariable', params: [variable.name, variable.type, variable.defaultValue ?? variable.initialValue, variableScope] });
        }

        // 6. createTask-Skeletons für alle Tasks
        for (const entry of taskEntries) {
            const task = this.controller.getTaskByName(entry.name) as any;
            if (task) {
                const taskStage = (STAGE_PLACEHOLDER && entry.stageId === exportStageId) ? STAGE_PLACEHOLDER : entry.stageId;
                ops.push({ method: 'createTask', params: [taskStage, task.name, task.description || ''] });
            }
        }

        // 7. Actions / Conditions / Task-Calls für alle Tasks
        for (const entry of taskEntries) {
            this.exportTask(entry.name, entry.stageId, ops, false);
        }

        // 8. Event-Verbindungen
        for (const op of connectEventOps) {
            const objectName = op.params[1];
            const ref = objectMap.get(objectName as string);
            if (ref) {
                op.params[0] = (STAGE_PLACEHOLDER && featureOwnedObjects.has(objectName as string) && ref.stageId === exportStageId)
                    ? STAGE_PLACEHOLDER
                    : ref.stageId;
            }
        }
        ops.push(...connectEventOps);
    }

    /** Findet die Stage, in der ein Task definiert ist. */
    private findTaskStage(taskName: string, project: any): any {
        for (const s of project?.stages || []) {
            if (s.tasks?.some((t: any) => t.name === taskName)) return s;
        }
        if (project?.tasks?.some((t: any) => t.name === taskName)) {
            return project?.stages?.find((s: any) => s.type === 'blueprint') || project?.stages?.[0];
        }
        return undefined;
    }

    private replaceWithPlaceholders(ops: AgentScriptOperation[], stagePlaceholder: string): void {
        const project = this.controller.getProject();
        const stageIds = new Set<string>((project?.stages || []).map((s: any) => s.id).filter(Boolean));
        for (const op of ops) {
            const maybeStage = op.params[0];
            if (typeof maybeStage === 'string' && stageIds.has(maybeStage)) {
                stageIds.add(maybeStage);
            }
        }
        for (const op of ops) {
            for (let i = 0; i < op.params.length; i++) {
                const p = op.params[i];
                if (typeof p === 'string' && stageIds.has(p)) {
                    op.params[i] = `\${${stagePlaceholder}}`;
                }
            }
        }
    }
}
