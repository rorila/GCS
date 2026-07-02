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
} from './AgentScriptTypes';

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
                this.exportStage(options.targetId, ops);
                break;
            case 'project':
                this.exportProject(ops);
                break;
            case 'selection':
                throw new Error('Export-Scope "selection" noch nicht implementiert.');
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

        if (options.withPlaceholders) {
            this.replaceWithPlaceholders(ops, options.defaultStagePlaceholder || 'STAGE');
        }

        return {
            version: AGENT_SCRIPT_VERSION,
            name: `Export_${options.scope}_${options.targetId || Date.now()}`,
            description: `Exportiert aus ${options.scope}${options.targetId ? ` '${options.targetId}'` : ''}`,
            operations: ops,
            assetPaths: this.collectAssetPaths(ops),
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

    private exportTask(taskName: string | undefined, stageId: string | undefined, ops: AgentScriptOperation[]): void {
        if (!taskName) throw new Error('Für Task-Export muss targetId (Task-Name) angegeben werden.');
        const details = this.controller.getTaskDetails(taskName);
        if (!details) throw new Error(`Task '${taskName}' nicht gefunden.`);

        const stageParam = stageId || '${STAGE}';
        ops.push({ method: 'createTask', params: [stageParam, details.name, details.description] });

        for (const item of details.sequence) {
            if (item.type === 'action' && item.name) {
                const action = this.controller['getActionByName']?.(item.name);
                if (action) {
                    const { name, type, ...params } = action;
                    ops.push({ method: 'addAction', params: [details.name, type, name, params] });
                }
            }
        }
    }

    private exportStage(stageId: string | undefined, ops: AgentScriptOperation[]): void {
        if (!stageId) throw new Error('Für Stage-Export muss targetId (Stage-ID) angegeben werden.');
        const stages = this.controller.listStages();
        const stage = stages.find(s => s.id === stageId || s.name === stageId);
        if (!stage) throw new Error(`Stage '${stageId}' nicht gefunden.`);

        const project = this.controller['project'];
        const fullStage = project?.stages?.find((s: any) => s.id === stageId || s.name === stageId);

        // Objekte exportieren
        if (fullStage?.objects) {
            for (const obj of fullStage.objects) {
                const { name, className, ...rest } = obj;
                ops.push({ method: 'addObject', params: [stageId, { name, className, ...rest }] });
            }
        }

        // Stage-Variablen exportieren
        if (fullStage?.variables) {
            for (const v of fullStage.variables) {
                ops.push({ method: 'addVariable', params: [v.name, v.type, v.initialValue ?? v.defaultValue, stageId] });
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
        for (const stage of stages) {
            if (stage.id) {
                ops.push({ method: 'createStage', params: [stage.id, stage.name, stage.type || 'standard'] });
            }
        }
        for (const stage of stages) {
            if (stage.id) this.exportStage(stage.id, ops);
        }
    }

    private replaceWithPlaceholders(ops: AgentScriptOperation[], stagePlaceholder: string): void {
        const stages = new Set<string>();
        for (const op of ops) {
            const maybeStage = op.params[0];
            if (typeof maybeStage === 'string' && maybeStage.startsWith('stage_')) {
                stages.add(maybeStage);
            }
        }
        for (const op of ops) {
            for (let i = 0; i < op.params.length; i++) {
                const p = op.params[i];
                if (typeof p === 'string' && stages.has(p)) {
                    op.params[i] = `\${${stagePlaceholder}}`;
                }
            }
        }
    }

    // ─────────────────────────────────────────────
    // Import
    // ─────────────────────────────────────────────

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
        const validation = AgentScriptValidator.validate(script, this.controller, { ...options, dryRun: true });
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

        // 4. Platzhalter auflösen
        let operations = this.resolvePlaceholders(script.operations, options.placeholderValues || {}, options.targetStageId);

        // 4. Konflikte transformieren (rename/skip)
        if (options.conflictStrategy && options.conflictStrategy !== 'error') {
            const transform = this.transformOperationsForConflicts(operations, options.conflictStrategy, options.autoRenameSuffix || '_import');
            operations = transform.operations;
            result.renamedItems = transform.renamedItems;
            result.skippedItems = transform.skippedItems;
            result.warnings.push(...transform.warnings);
        }

        // 5. Bei dryRun: hier zurückgeben
        if (options.dryRun) {
            result.phase = 'analysis';
            result.success = true;
            return result;
        }

        // 6. Snapshot für Undo
        const snapshot = JSON.stringify(this.controller['project']);
        result.canUndo = true;

        // 7. Anwenden via executeBatch
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

            // 8. FlowCharts neu generieren
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
        suffix: string
    ): { operations: AgentScriptOperation[]; renamedItems: Record<string, string>; skippedItems: string[]; warnings: string[] } {
        const renamedItems: Record<string, string> = {};
        const skippedItems: string[] = [];
        const warnings: string[] = [];

        if (strategy !== 'rename' && strategy !== 'skip') {
            return { operations, renamedItems, skippedItems, warnings };
        }

        // Sammle existierende Namen
        const existingTasks = new Set(this.controller.listTasks().map(t => t.name));
        const existingVariables = new Set(this.controller.listVariables().map(v => v.name));
        const existingObjects = new Set<string>();
        for (const stage of this.controller.listStages()) {
            const id = stage.id || stage.name;
            if (id) {
                for (const obj of this.controller.listObjects(id)) {
                    if (obj.name) existingObjects.add(obj.name);
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

        for (const op of operations) {
            let type: 'task' | 'variable' | 'object' | null = null;
            let paramIndex = -1;

            if (op.method === 'createTask') { type = 'task'; paramIndex = 1; }
            else if (op.method === 'addVariable') { type = 'variable'; paramIndex = 0; }
            else if (['addObject', 'createSprite', 'createGroupPanel', 'createDialog', 'createLabel', 'createTimer', 'createIntervalTimer', 'createThresholdVariable', 'createInputController', 'createButton', 'createVideo', 'createLink', 'createProgressBar', 'createStickyNote'].includes(op.method)) {
                type = 'object'; paramIndex = 1;
            }

            if (type && paramIndex >= 0) {
                const name = op.params[paramIndex];
                if (typeof name === 'string' && needsRename(type, name)) {
                    if (strategy === 'rename') {
                        const newName = getNewName(name);
                        renamedItems[name] = newName;
                        warnings.push(`${type === 'task' ? 'Task' : type === 'variable' ? 'Variable' : 'Objekt'} '${name}' existiert bereits und wird zu '${newName}' umbenannt.`);
                    } else if (strategy === 'skip') {
                        skippedItems.push(name);
                        warnings.push(`${type === 'task' ? 'Task' : type === 'variable' ? 'Variable' : 'Objekt'} '${name}' übersprungen (existiert bereits).`);
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

        // Übersprungene Items entfernen
        if (strategy === 'skip' && skippedItems.length > 0) {
            const skipSet = new Set(skippedItems);
            operations = operations.filter(op => {
                let name: any = null;
                if (op.method === 'createTask') name = op.params[1];
                else if (op.method === 'addVariable') name = op.params[0];
                else if (['addObject', 'createSprite', 'createGroupPanel', 'createDialog', 'createLabel', 'createTimer', 'createIntervalTimer', 'createThresholdVariable', 'createInputController', 'createButton', 'createVideo', 'createLink', 'createProgressBar', 'createStickyNote'].includes(op.method)) name = op.params[1];
                return !skipSet.has(name);
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

    private assetExists(assetPath: string, projectRoot?: string): boolean {
        try {
            const fs = require('fs');
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
