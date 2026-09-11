import { Logger } from '../../utils/Logger';
import type { AgentController } from '../AgentController';
import { AgentScript, AgentScriptOperation, ImportOptions, ImportResult } from './AgentScriptTypes';
import { AgentScriptValidator } from './AgentScriptValidator';
import { AgentScriptAssetHelper } from './AgentScriptAssetHelper';

/**
 * AgentScriptImportService
 *
 * Validiert und importiert AgentScript-Operationen via AgentController.executeBatch().
 * Kapselt Platzhalter-Auflösung, Konflikt-Strategien, Asset-Remapping und FlowChart-Regeneration.
 */
export class AgentScriptImportService {
    constructor(private controller: AgentController, private logger: Logger) {}

    public importScript(script: AgentScript, options: ImportOptions = {}): ImportResult {
        this.controller.validateProjectLoaded?.();

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
                if (!AgentScriptAssetHelper.assetExists(asset, options.projectRoot)) {
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
        const project = this.controller.getProject();
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
            operations = AgentScriptAssetHelper.remapAssetPaths(operations, options.assetRemap);
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
        const snapshot = JSON.stringify(this.controller.getProject());
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
                this.controller.setProject(JSON.parse(snapshot));
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
            this.controller.setProject(JSON.parse(snapshot));
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
        const project = this.controller.getProject();
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
                this.controller.generateTaskFlow?.(taskName);
            } catch (e: any) {
                this.logger.warn(`FlowChart für '${taskName}' konnte nicht neu generiert werden: ${e.message}`);
            }
        }
    }
}
