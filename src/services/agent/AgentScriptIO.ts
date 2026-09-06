import { Logger } from '../../utils/Logger';
import type { AgentController } from '../AgentController';
import { AgentScriptValidator } from './AgentScriptValidator';
import {
    AgentScript,
    AgentScriptOperation,
    AGENT_SCRIPT_VERSION,
    ImportOptions,
    ImportResult,
    ExportOptions,
    ExportSelection,
} from './AgentScriptTypes';

/**
 * Single Source of Truth: Stage-Felder, die NICHT als generische Config
 * exportiert/übernommen werden. Positionsargumente von createStage sowie
 * Kind-Sammlungen (werden separat über eigene Operationen exportiert).
 */
export const STAGE_CONFIG_EXCLUDE = new Set<string>([
    'id', 'name', 'type',
    'objects', 'tasks', 'actions', 'variables', 'flowCharts',
]);

/**
 * AgentScriptIO
 *
 * Exportiert und importiert AgentController-Operationen als wiederverwendbare
 * JSON-Skripte. Nutzt intern `AgentController.executeBatch()` für transaktionale
 * Anwendung.
 */
export class AgentScriptIO {
    private logger = Logger.get('AgentScriptIO', 'Editor_Diagnostics');

    constructor(private controller: AgentController) {}

    // ─────────────────────────────────────────────
    // Export
    // ─────────────────────────────────────────────

    public exportScript(options: ExportOptions): AgentScript {
        this.controller['validateProjectLoaded']?.();

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

        const assetPaths = this.collectAssetPaths(ops).filter(p => p.trim() !== '');
        return {
            version: AGENT_SCRIPT_VERSION,
            name: `Export_${options.scope}_${options.targetId || Date.now()}`,
            description: `Exportiert aus ${options.scope}${options.targetId ? ` '${options.targetId}'` : ''}`,
            scope: options.scope,
            operations: ops,
            assetPaths: assetPaths.length > 0 ? assetPaths : undefined,
        };
    }

    private collectAssetPaths(operations: AgentScriptOperation[]): string[] {
        const paths = new Set<string>();
        const assetKeys = ['backgroundImage', 'videoSource', 'audioSource', 'src', 'image', 'sound', 'texture', 'icon'];

        const scan = (value: any) => {
            if (typeof value === 'string') {
                if (value.match(/\.(png|jpg|jpeg|gif|webp|mp3|wav|ogg|mp4|webm|svg|json)$/i)) {
                    paths.add(value);
                }
            } else if (Array.isArray(value)) {
                value.forEach(scan);
            } else if (value && typeof value === 'object') {
                for (const key of Object.keys(value)) {
                    if (assetKeys.includes(key) && typeof value[key] === 'string') {
                        paths.add(value[key]);
                    } else {
                        scan(value[key]);
                    }
                }
            }
        };

        for (const op of operations) {
            for (const param of op.params) {
                scan(param);
            }
        }

        return Array.from(paths);
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

    private exportTask(taskName: string | undefined, stageId: string | undefined, ops: AgentScriptOperation[], emitCreateTask = true): void {
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
                const action = this.controller['getActionByName']?.(item.name);
                if (action) {
                    const { name, type, ...params } = action;
                    ops.push({ method: 'addAction', params: [details.name, type, name, params] });
                    definedActions.add(name);
                } else {
                    this.logger.warn(`exportTask: Action '${item.name}' nicht gefunden, wird übersprungen.`);
                }
            } else if (item.type === 'task' && item.name) {
                ops.push({ method: 'addTaskCall', params: [details.name, item.name] });
            } else if (item.type === 'condition' && item.condition) {
                // 1. Alle referenzierten Actions global definieren (Shortcut- UND Array-Form)
                this.emitConditionActionDefs(item, ops, definedActions);
                // 2. Vollständiges Condition-Item unverändert übernehmen
                //    (bewahrt thenAction/elseAction/thenTask/elseTask und then/else)
                ops.push({ method: 'addConditionItem', params: [details.name, item] });
            }
        }
    }

    /**
     * Gibt ensureActionDefined-Operationen für alle in einer Condition referenzierten
     * Actions aus (Shortcut-Felder thenAction/elseAction sowie then/else-Arrays, rekursiv),
     * damit sie beim Import global existieren, ohne an die Task-Top-Level-Sequenz zu hängen.
     */
    private emitConditionActionDefs(conditionItem: any, ops: AgentScriptOperation[], defined: Set<string>): void {
        const defineByName = (name?: string) => {
            if (!name || defined.has(name)) return;
            const action = this.controller['getActionByName']?.(name);
            if (action) {
                const { name: actionName, type, ...params } = action;
                ops.push({ method: 'ensureActionDefined', params: [type, actionName, params] });
                defined.add(actionName);
            } else {
                this.logger.warn(`exportTask: Condition-Action '${name}' nicht gefunden, wird übersprungen.`);
            }
        };

        const walk = (item: any) => {
            if (!item) return;
            defineByName(item.thenAction);
            defineByName(item.elseAction);
            const branches = [
                item.then, item.else,
                item.body, item.elseBody,
                item.successBody, item.errorBody,
            ];
            for (const branch of branches) {
                if (!Array.isArray(branch)) continue;
                for (const it of branch) {
                    if (!it) continue;
                    if (it.type === 'action' || it.type === 'data_action') defineByName(it.name);
                    walk(it); // rekursiv für verschachtelte Conditions/Loops
                }
            }
        };
        walk(conditionItem);
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

    private exportStage(stageId: string | undefined, ops: AgentScriptOperation[], emitCreateStage = false): void {
        if (!stageId) throw new Error('Für Stage-Export muss targetId (Stage-ID) angegeben werden.');
        const stages = this.controller.listStages();
        const stage = stages.find(s => s.id === stageId || s.name === stageId);
        if (!stage) throw new Error(`Stage '${stageId}' nicht gefunden.`);

        const project = this.controller['project'];
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
        const project = this.controller['project'];
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
        const project = this.controller['project'];

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

    private exportFeature(taskNameOrFeatureId: string | undefined, explicitStageId: string | undefined, ops: AgentScriptOperation[], stagePlaceholder?: string): void {
        if (!taskNameOrFeatureId) throw new Error('Für Feature-Export muss targetId (Task-Name oder Feature-ID) angegeben werden.');
        const project = this.controller['project'];

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
            const task = this.controller['getTaskByName'](entry.name) as any;
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
                this.collectReferencedEntities(task.actionSequence, allProjectObjectNames, allVariableNames, referencedObjectNames, referencedVariableNames);

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
                    this.scanValueForReferences(serialized, allProjectObjectNames, allVariableNames, referencedObjectNames, referencedVariableNames);
                }
            } else {
                const v = variableMap.get(item.name);
                if (v) {
                    this.scanValueForReferences(v.variable, allProjectObjectNames, allVariableNames, referencedObjectNames, referencedVariableNames);
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
            const task = this.controller['getTaskByName'](entry.name) as any;
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
            const ref = objectMap.get(objectName);
            if (ref) {
                op.params[0] = (STAGE_PLACEHOLDER && featureOwnedObjects.has(objectName) && ref.stageId === exportStageId)
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

    private collectReferencedEntities(
        sequence: any[],
        stageObjectNames: Set<string>,
        allVariableNames: Set<string>,
        objectNames: Set<string>,
        variableNames: Set<string>
    ): void {
        if (!sequence) return;
        for (const item of sequence) {
            if (!item || typeof item !== 'object') continue;

            if (item.type === 'action' || item.type === 'data_action') {
                const action = this.controller['getActionByName']?.(item.name);
                if (action) {
                    this.scanValueForReferences(action, stageObjectNames, allVariableNames, objectNames, variableNames);
                }
            } else if (item.type === 'condition') {
                if (item.condition?.variable && allVariableNames.has(item.condition.variable)) {
                    variableNames.add(item.condition.variable);
                }
                this.collectReferencedEntities(item.then, stageObjectNames, allVariableNames, objectNames, variableNames);
                this.collectReferencedEntities(item.else, stageObjectNames, allVariableNames, objectNames, variableNames);
                this.collectReferencedEntities(item.body, stageObjectNames, allVariableNames, objectNames, variableNames);
                this.collectReferencedEntities(item.elseBody, stageObjectNames, allVariableNames, objectNames, variableNames);
                this.collectReferencedEntities(item.successBody, stageObjectNames, allVariableNames, objectNames, variableNames);
                this.collectReferencedEntities(item.errorBody, stageObjectNames, allVariableNames, objectNames, variableNames);
            } else if (item.type === 'foreach' || item.type === 'for' || item.type === 'while') {
                if (item.iteratorVar && allVariableNames.has(item.iteratorVar)) variableNames.add(item.iteratorVar);
                if (item.sourceArray && allVariableNames.has(item.sourceArray)) variableNames.add(item.sourceArray);
                if (item.itemVar && allVariableNames.has(item.itemVar)) variableNames.add(item.itemVar);
                if (item.indexVar && allVariableNames.has(item.indexVar)) variableNames.add(item.indexVar);
                if (item.keyVar && allVariableNames.has(item.keyVar)) variableNames.add(item.keyVar);
                this.collectReferencedEntities(item.body, stageObjectNames, allVariableNames, objectNames, variableNames);
            }
        }
    }

    private scanValueForReferences(
        value: any,
        stageObjectNames: Set<string>,
        allVariableNames: Set<string>,
        objectNames: Set<string>,
        variableNames: Set<string>
    ): void {
        if (value === null || value === undefined) return;
        if (typeof value === 'string') {
            if (stageObjectNames.has(value)) objectNames.add(value);
            else if (allVariableNames.has(value)) variableNames.add(value);

            const exprRegex = /\$\{([^}]+)\}/g;
            let m: RegExpExecArray | null;
            while ((m = exprRegex.exec(value)) !== null) {
                const inner = m[1].trim();
                const root = inner.split('.')[0];
                if (root) {
                    if (stageObjectNames.has(root)) objectNames.add(root);
                    if (allVariableNames.has(inner)) variableNames.add(inner);
                    if (allVariableNames.has(root) && !inner.includes('.')) variableNames.add(root);
                }
            }
        } else if (Array.isArray(value)) {
            for (const v of value) this.scanValueForReferences(v, stageObjectNames, allVariableNames, objectNames, variableNames);
        } else if (typeof value === 'object') {
            const skipKeys = new Set(['id', 'name', 'type', 'description', 'sync', 'scope', 'className']);
            for (const [key, val] of Object.entries(value)) {
                if (skipKeys.has(key)) continue;
                if (key === 'changes' && val && typeof val === 'object') {
                    for (const objProp of Object.keys(val as any)) {
                        const raw = objProp.split('.')[0].trim();
                        const objName = raw.replace(/^\$\{|\}$/g, '');
                        if (stageObjectNames.has(objName)) objectNames.add(objName);
                        this.scanValueForReferences((val as any)[objProp], stageObjectNames, allVariableNames, objectNames, variableNames);
                    }
                } else if (['variableName', 'resultVariable', 'sourceArray', 'itemVar', 'indexVar', 'keyVar', 'iteratorVar'].includes(key)) {
                    if (typeof val === 'string') {
                        if (allVariableNames.has(val)) variableNames.add(val);
                        const matches = [...val.matchAll(/\$\{([^}]+)\}/g)];
                        for (const m of matches) {
                            const inner = m[1]?.trim();
                            if (inner) {
                                const full = inner;
                                const root = inner.split('.')[0];
                                if (allVariableNames.has(full)) variableNames.add(full);
                                if (allVariableNames.has(root) && !full.includes('.')) variableNames.add(root);
                            }
                        }
                    }
                } else if (['target', 'source', 'object'].includes(key)) {
                    if (typeof val === 'string') {
                        this.scanValueForReferences(val, stageObjectNames, allVariableNames, objectNames, variableNames);
                    }
                } else {
                    this.scanValueForReferences(val, stageObjectNames, allVariableNames, objectNames, variableNames);
                }
            }
        }
    }

    private replaceWithPlaceholders(ops: AgentScriptOperation[], stagePlaceholder: string): void {
        const project = this.controller['project'];
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

    // ─────────────────────────────────────────────
    // Import
    // ─────────────────────────────────────────────

    private sortOperationsByPriority(operations: AgentScriptOperation[]): AgentScriptOperation[] {
        const priority: Record<string, number> = {
            addUserStory: 0,
            createStage: 1,
            createFeature: 2,
            addVariable: 2,
            createTask: 2,
            addObject: 2,
            createSprite: 2,
            createGroupPanel: 2,
            createDialog: 2,
            createLabel: 2,
            createTimer: 2,
            createIntervalTimer: 2,
            createThresholdVariable: 2,
            createInputController: 2,
            createButton: 2,
            createVideo: 2,
            createLink: 2,
            createProgressBar: 2,
            createStickyNote: 2,
            setProperty: 3,
            bindVariable: 3,
            addAction: 3,
            connectEvent: 10,
        };
        return [...operations].sort((a, b) => {
            const pa = priority[a.method] ?? 5;
            const pb = priority[b.method] ?? 5;
            return pa - pb;
        });
    }

    public importScript(script: AgentScript, options: ImportOptions = {}): ImportResult {
        this.controller['validateProjectLoaded']?.();

        const result: ImportResult = {
            success: false,
            phase: 'analysis',
            plannedOperations: script.operations.length,
            appliedOperations: 0,
            conflicts: [],
            warnings: [],
            errors: [],
            renamedItems: {},
            skippedItems: [],
            canUndo: false,
        };

        // 1. Grundvalidierung
        const validation = AgentScriptValidator.validate(script, this.controller, options);
        result.warnings.push(...validation.warnings);
        if (!validation.valid) {
            result.errors.push(...validation.errors);
            return result;
        }

        // 2. Asset-Prüfung
        if (script.assetPaths && script.assetPaths.length > 0) {
            for (const asset of script.assetPaths) {
                if (!this.assetExists(asset, options.projectRoot)) {
                    result.warnings.push(`Asset '${asset}' nicht gefunden. Es wird trotzdem importiert.`);
                    result.conflicts.push({ type: 'asset', name: asset, action: 'skip', message: `Asset '${asset}' nicht gefunden.` });
                }
            }
        }

        // 3. Phase: Analyse
        const analysisOptions = { ...options, dryRun: true };
        const analysisConflicts = AgentScriptValidator.validate(script, this.controller, analysisOptions);
        for (const err of analysisConflicts.errors) {
            result.conflicts.push({ type: 'reference', name: '', action: 'error', message: err });
        }

        // 4. Platzhalter auflösen (Ziel-Stage zentral bestimmen → behebt ID-Mismatch)
        const target = this.resolveTargetStageId(options.targetStageId);
        if (target.warning) result.warnings.push(target.warning);
        let operations = this.resolvePlaceholders(script.operations, options.placeholderValues || {}, target.id);

        // 4b. Ziel-Stage anlegen, falls sie noch nicht existiert
        const project = this.controller['project'];
        const stages: any[] = project?.stages || [];

        // 4a. Fehlende Stage-Referenzen in Operationen auf die Ziel-Stage umbiegen
        const existingStageIds = new Set(stages.map((s: any) => s.id));
        const stageParamIndex: Record<string, number> = {
            addObject: 0,
            createTask: 0,
            connectEvent: 0,
            createFeature: 0,
            addVariable: 3,
        };
        for (const op of operations) {
            const idx = stageParamIndex[op.method];
            if (idx === undefined) continue;
            const p = op.params[idx];
            if (typeof p !== 'string' || p === '' || p === 'global' || p === target.id || p.startsWith('${')) continue;
            if (!existingStageIds.has(p)) {
                this.logger.warn(`[Import] Stage '${p}' nicht vorhanden. ${op.method} wird auf Ziel-Stage '${target.id}' umgebogen.`);
                result.warnings.push(`Stage '${p}' nicht vorhanden. ${op.method} wird auf '${target.id}' ausgeführt.`);
                op.params[idx] = target.id;
            }
        }

        if (target.id && !stages.some((s: any) => s.id === target.id)) {
            const createStageOp: AgentScriptOperation = { method: 'createStage', params: [target.id, 'Import', 'standard'] };
            operations.unshift(createStageOp);
            result.warnings.push(`Ziel-Stage '${target.id}' wurde neu angelegt.`);
        }

        // 5. Asset-Pfade remappen
        if (options.assetRemap && Object.keys(options.assetRemap).length > 0) {
            operations = this.remapAssetPaths(operations, options.assetRemap);
        }

        // 6. Konflikte transformieren (rename/skip/overwrite)
        if (options.conflictStrategy && options.conflictStrategy !== 'error') {
            const transform = this.transformOperationsForConflicts(operations, options.conflictStrategy, options.autoRenameSuffix || '_import', options.conflictOverrides, target.id);
            operations = transform.operations;
            result.renamedItems = transform.renamedItems;
            result.skippedItems = transform.skippedItems;
            result.warnings.push(...transform.warnings);
        }

        // 6. Bei dryRun: hier zurückgeben
        if (options.dryRun) {
            result.phase = 'analysis';
            result.success = true;
            return result;
        }

        // 7. Snapshot für Undo
        const snapshot = JSON.stringify(this.controller['project']);
        result.canUndo = true;

        // 8. Anwenden via executeBatch
        operations = this.sortOperationsByPriority(operations);
        try {
            const batchResults = this.controller.executeBatch(operations);
            result.appliedOperations = batchResults.filter(r => r.success).length;

            const batchErrors = batchResults.filter(r => !r.success);
            if (batchErrors.length > 0) {
                result.errors.push(...batchErrors.map(e => `Operation '${e.method}' fehlgeschlagen: ${e.error}`));
                // Rollback
                this.controller['project'] = JSON.parse(snapshot);
                result.appliedOperations = 0;
                result.canUndo = false;
                result.phase = 'cancelled';
                return result;
            }

            // 9. FlowCharts neu generieren
            this.regenerateFlowCharts(operations);

            result.phase = 'applied';
            result.success = true;
        } catch (e: any) {
            result.errors.push(`Unerwarteter Fehler beim Import: ${e.message}`);
            this.controller['project'] = JSON.parse(snapshot);
            result.phase = 'cancelled';
        }

        return result;
    }

    /**
     * Bestimmt die effektive Ziel-Stage-ID für die ${STAGE}-Auflösung.
     * Existiert die angeforderte ID nicht (häufig: hartkodiertes 'stage_main'),
     * wird auf die aktive Stage bzw. die erste main/standard-Stage zurückgefallen.
     */
    private resolveTargetStageId(requested?: string): { id?: string; warning?: string } {
        const project = this.controller['project'];
        const stages: any[] = project?.stages || [];
        if (requested && stages.some(s => s.id === requested)) {
            return { id: requested };
        }
        const fallback = project?.activeStageId
            ?? stages.find(s => s.type === 'main' || s.type === 'standard')?.id
            ?? stages[0]?.id;
        const warning = requested && fallback
            ? `Ziel-Stage '${requested}' existiert nicht. Verwende stattdessen '${fallback}'.`
            : undefined;
        return { id: fallback, warning };
    }

    private resolvePlaceholders(
        operations: AgentScriptOperation[],
        values: Record<string, any>,
        targetStageId?: string
    ): AgentScriptOperation[] {
        return operations.map(op => ({
            method: op.method,
            params: op.params.map(p => this.resolveParam(p, values, targetStageId))
        }));
    }

    private resolveParam(param: any, values: Record<string, any>, targetStageId?: string): any {
        if (typeof param === 'string') {
            // ${STAGE} → targetStageId oder Wert aus values
            const resolved = param.replace(/\$\{([A-Za-z0-9_]+)\}/g, (match, key) => {
                if (key === 'STAGE' && targetStageId) return targetStageId;
                if (key in values) return values[key];
                return match; // Nicht aufgelöst: Warnung kommt später
            });
            return resolved;
        }
        if (Array.isArray(param)) {
            return param.map(p => this.resolveParam(p, values, targetStageId));
        }
        if (param && typeof param === 'object') {
            const out: Record<string, any> = {};
            for (const key of Object.keys(param)) {
                out[key] = this.resolveParam(param[key], values, targetStageId);
            }
            return out;
        }
        return param;
    }

    private transformOperationsForConflicts(
        operations: AgentScriptOperation[],
        strategy: string,
        suffix: string,
        overrides?: Record<string, string>,
        targetStageId?: string
    ): { operations: AgentScriptOperation[]; renamedItems: Record<string, string>; skippedItems: string[]; warnings: string[] } {
        const renamedItems: Record<string, string> = {};
        const skippedItems: string[] = [];
        const reusedItems: string[] = [];
        const warnings: string[] = [];

        const effectiveStrategy = (name: string): string => {
            return overrides?.[name] ?? strategy;
        };

        if (strategy !== 'rename' && strategy !== 'skip' && strategy !== 'reuse' && !overrides) {
            return { operations, renamedItems, skippedItems, warnings };
        }

        // Sammle existierende Namen (Objekte nur in der Ziel-Stage, da Objekte stage-lokal sind)
        const existingTasks = new Set(this.controller.listTasks().map(t => t.name));
        const existingVariables = new Set(this.controller.listVariables().map(v => v.name));
        const existingObjects = new Set<string>();
        if (targetStageId && this.controller.listObjects) {
            for (const obj of this.controller.listObjects(targetStageId)) {
                if (obj.name) existingObjects.add(obj.name);
            }
        } else {
            for (const stage of this.controller.listStages()) {
                const id = stage.id || stage.name;
                if (id) {
                    for (const obj of this.controller.listObjects(id)) {
                        if (obj.name) existingObjects.add(obj.name);
                    }
                }
            }
        }

        const needsRename = (type: 'task' | 'variable' | 'object', name: string): boolean => {
            if (type === 'task') return existingTasks.has(name);
            if (type === 'variable') return existingVariables.has(name);
            if (type === 'object') return existingObjects.has(name);
            return false;
        };

        const getNewName = (name: string): string => {
            let candidate = `${name}${suffix}`;
            let counter = 2;
            while (existingTasks.has(candidate) || existingVariables.has(candidate) || existingObjects.has(candidate)) {
                candidate = `${name}${suffix}_${counter++}`;
            }
            return candidate;
        };

        const getCreationName = (op: AgentScriptOperation): string | null => {
            if (op.method === 'createTask') return op.params[1];
            if (op.method === 'addVariable') return op.params[0];
            if (['addObject', 'createSprite', 'createGroupPanel', 'createDialog', 'createLabel', 'createTimer', 'createIntervalTimer', 'createThresholdVariable', 'createInputController', 'createButton', 'createVideo', 'createLink', 'createProgressBar', 'createStickyNote'].includes(op.method)) {
                const p = op.params[1];
                return typeof p === 'string' ? p : (p?.name ?? null);
            }
            return null;
        };

        for (const op of operations) {
            let type: 'task' | 'variable' | 'object' | null = null;

            if (op.method === 'createTask') { type = 'task'; }
            else if (op.method === 'addVariable') { type = 'variable'; }
            else if (['addObject', 'createSprite', 'createGroupPanel', 'createDialog', 'createLabel', 'createTimer', 'createIntervalTimer', 'createThresholdVariable', 'createInputController', 'createButton', 'createVideo', 'createLink', 'createProgressBar', 'createStickyNote'].includes(op.method)) {
                type = 'object';
            }

            if (type) {
                const name = getCreationName(op);
                if (name && typeof name === 'string' && needsRename(type, name)) {
                    const itemStrategy = effectiveStrategy(name);
                    if (itemStrategy === 'rename') {
                        const newName = getNewName(name);
                        renamedItems[name] = newName;
                        warnings.push(`${type === 'task' ? 'Task' : type === 'variable' ? 'Variable' : 'Objekt'} '${name}' existiert bereits und wird zu '${newName}' umbenannt.`);
                    } else if (itemStrategy === 'skip') {
                        skippedItems.push(name);
                        warnings.push(`${type === 'task' ? 'Task' : type === 'variable' ? 'Variable' : 'Objekt'} '${name}' übersprungen (existiert bereits).`);
                    } else if (itemStrategy === 'overwrite') {
                        warnings.push(`${type === 'task' ? 'Task' : type === 'variable' ? 'Variable' : 'Objekt'} '${name}' wird überschrieben (overwrite).`);
                    } else if (itemStrategy === 'reuse') {
                        reusedItems.push(name);
                        warnings.push(`${type === 'task' ? 'Task' : type === 'variable' ? 'Variable' : 'Objekt'} '${name}' existiert bereits und wird wiederverwendet.`);
                    }
                }
            }
        }

        // Wenn Rename-Strategie: Ersetze alte Namen in allen Operationen
        if (strategy === 'rename' && Object.keys(renamedItems).length > 0) {
            const replaceInParam = (p: any): any => {
                if (typeof p === 'string' && renamedItems[p]) return renamedItems[p];
                if (Array.isArray(p)) return p.map(replaceInParam);
                if (p && typeof p === 'object') {
                    const out: Record<string, any> = {};
                    for (const key of Object.keys(p)) out[key] = replaceInParam(p[key]);
                    return out;
                }
                return p;
            };

            for (const op of operations) {
                op.params = op.params.map(replaceInParam);
            }
        }

        // Bei Reuse: Erzeugungsoperationen entfernen, Referenzen bleiben unveraendert
        if (strategy === 'reuse' && reusedItems.length > 0) {
            const reuseSet = new Set(reusedItems);
            operations = operations.filter(op => {
                const name = getCreationName(op);
                return name === null || !reuseSet.has(name);
            });
        }

        // Übersprungene Items entfernen
        if (strategy === 'skip' && skippedItems.length > 0) {
            const skipSet = new Set(skippedItems);
            operations = operations.filter(op => {
                const name = getCreationName(op);
                return name === null || !skipSet.has(name);
            });
        }

        return { operations, renamedItems, skippedItems, warnings };
    }

    private regenerateFlowCharts(operations: AgentScriptOperation[]): void {
        const tasks = new Set<string>();
        for (const op of operations) {
            if (op.method === 'createTask') {
                const taskName = op.params[1];
                if (typeof taskName === 'string') tasks.add(taskName);
            }
        }
        for (const taskName of tasks) {
            try {
                this.controller['generateTaskFlow']?.(taskName);
            } catch (e: any) {
                this.logger.warn(`FlowChart für '${taskName}' konnte nicht neu generiert werden: ${e.message}`);
            }
        }
    }

    private remapAssetPaths(operations: AgentScriptOperation[], remap: Record<string, string>): AgentScriptOperation[] {
        const remapValue = (value: any): any => {
            if (typeof value === 'string' && remap[value]) {
                return remap[value];
            }
            if (Array.isArray(value)) {
                return value.map(remapValue);
            }
            if (value && typeof value === 'object') {
                const out: Record<string, any> = {};
                for (const key of Object.keys(value)) {
                    out[key] = remapValue(value[key]);
                }
                return out;
            }
            return value;
        };

        return operations.map(op => ({
            method: op.method,
            params: op.params.map(remapValue)
        }));
    }

    private assetExists(assetPath: string, projectRoot?: string): boolean {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const fs = require('fs');
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const path = require('path');
            if (fs.existsSync(assetPath)) return true;
            if (projectRoot) {
                const resolved = path.join(projectRoot, assetPath);
                if (fs.existsSync(resolved)) return true;
            }
            return false;
        } catch {
            return false;
        }
    }
}
