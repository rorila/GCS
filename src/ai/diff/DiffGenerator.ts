import { GameProject, StageDefinition, ComponentData, GameTask, ProjectVariable, GameAction } from '../../model/types';
import { ProjectDiff, EntityDiff } from './DiffTypes';

/**
 * DiffGenerator
 *
 * Erzeugt eine Übersicht der Unterschiede zwischen dem Originalprojekt
 * und dem Ergebnisprojekt eines Dry-Runs.
 */

export class DiffGenerator {
    public generate(original: GameProject, modified: GameProject): ProjectDiff {
        const diff: ProjectDiff = {
            stages: [],
            objects: [],
            tasks: [],
            actions: [],
            variables: [],
        };

        this.diffStages(original, modified, diff);
        this.diffGlobalTasks(original, modified, diff);
        this.diffGlobalActions(original, modified, diff);
        this.diffGlobalVariables(original, modified, diff);
        this.diffStageContents(original, modified, diff);

        diff.summary = this.toSummary(diff);

        return diff;
    }

    public toSummary(diff: ProjectDiff): string[] {
        const summary: string[] = [];

        for (const stage of diff.stages) {
            summary.push(`${this.symbol(stage.change)} Stage ${stage.id}`);
        }

        for (const obj of diff.objects) {
            summary.push(`${this.symbol(obj.change)} Objekt ${obj.name || obj.id}`);
        }

        for (const task of diff.tasks) {
            summary.push(`${this.symbol(task.change)} Task ${task.name || task.id}`);
        }

        for (const action of diff.actions) {
            summary.push(`${this.symbol(action.change)} Action ${action.name || action.id}`);
        }

        for (const variable of diff.variables) {
            summary.push(`${this.symbol(variable.change)} Variable ${variable.name || variable.id}`);
        }

        return summary;
    }

    private symbol(change: EntityDiff['change']): string {
        switch (change) {
            case 'added': return '+';
            case 'updated': return '~';
            case 'deleted': return '-';
            default: return '?';
        }
    }

    private diffStages(original: GameProject, modified: GameProject, diff: ProjectDiff): void {
        const originalMap = this.toMap(original.stages || [], s => s.id);
        const modifiedMap = this.toMap(modified.stages || [], s => s.id);

        for (const [id, modifiedStage] of modifiedMap) {
            const originalStage = originalMap.get(id);
            if (!originalStage) {
                diff.stages.push({
                    kind: 'stage',
                    change: 'added',
                    id,
                    name: modifiedStage.name,
                    after: { name: modifiedStage.name, type: modifiedStage.type },
                });
            } else if (this.stageChanged(originalStage, modifiedStage)) {
                diff.stages.push({
                    kind: 'stage',
                    change: 'updated',
                    id,
                    name: modifiedStage.name,
                    before: this.stageSummary(originalStage),
                    after: this.stageSummary(modifiedStage),
                    details: this.stageDetails(originalStage, modifiedStage),
                });
            }
        }

        for (const [id, originalStage] of originalMap) {
            if (!modifiedMap.has(id)) {
                diff.stages.push({
                    kind: 'stage',
                    change: 'deleted',
                    id,
                    name: originalStage.name,
                    before: { name: originalStage.name, type: originalStage.type },
                });
            }
        }
    }

    private diffGlobalTasks(original: GameProject, modified: GameProject, diff: ProjectDiff): void {
        this.diffNamedItems(
            original.tasks || [],
            modified.tasks || [],
            t => t.name,
            (t, change, before, after) => ({ kind: 'task', change, id: t.name, name: t.name, before, after, details: change === 'updated' ? this.objectShallowDiff(before, after) : undefined }),
            diff.tasks,
            (t) => this.taskSummary(t)
        );
    }

    private diffGlobalActions(original: GameProject, modified: GameProject, diff: ProjectDiff): void {
        this.diffNamedItems(
            original.actions || [],
            modified.actions || [],
            a => a.name,
            (a, change, before, after) => ({ kind: 'action', change, id: a.name, name: a.name, before, after, details: change === 'updated' ? this.objectShallowDiff(before, after) : undefined }),
            diff.actions,
            (a) => this.actionSummary(a)
        );
    }

    private diffGlobalVariables(original: GameProject, modified: GameProject, diff: ProjectDiff): void {
        this.diffNamedItems(
            original.variables || [],
            modified.variables || [],
            v => v.name,
            (v, change, before, after) => ({ kind: 'variable', change, id: v.name, name: v.name, before, after, details: change === 'updated' ? this.objectShallowDiff(before, after) : undefined }),
            diff.variables,
            (v) => this.variableSummary(v)
        );
    }

    private diffStageContents(original: GameProject, modified: GameProject, diff: ProjectDiff): void {
        const originalStages = this.toMap(original.stages || [], s => s.id);
        const modifiedStages = this.toMap(modified.stages || [], s => s.id);

        for (const [stageId, modifiedStage] of modifiedStages) {
            const originalStage = originalStages.get(stageId);
            if (!originalStage) continue;

            this.diffStageObjects(originalStage, modifiedStage, stageId, diff);
            this.diffStageTasks(originalStage, modifiedStage, stageId, diff);
            this.diffStageActions(originalStage, modifiedStage, stageId, diff);
            this.diffStageVariables(originalStage, modifiedStage, stageId, diff);
        }
    }

    private diffStageObjects(original: StageDefinition, modified: StageDefinition, stageId: string, diff: ProjectDiff): void {
        const originalMap = this.toMap(original.objects || [], o => o.name);
        const modifiedMap = this.toMap(modified.objects || [], o => o.name);

        for (const [name, modifiedObj] of modifiedMap) {
            const originalObj = originalMap.get(name);
            if (!originalObj) {
                diff.objects.push({
                    kind: 'object',
                    change: 'added',
                    id: name,
                    stageId,
                    name,
                    after: this.objectSummary(modifiedObj),
                });
            } else {
                const details = this.objectDetails(originalObj, modifiedObj);
                if (details.length > 0) {
                    diff.objects.push({
                        kind: 'object',
                        change: 'updated',
                        id: name,
                        stageId,
                        name,
                        before: this.objectSummary(originalObj),
                        after: this.objectSummary(modifiedObj),
                        details,
                    });
                }
            }
        }

        for (const [name, originalObj] of originalMap) {
            if (!modifiedMap.has(name)) {
                diff.objects.push({
                    kind: 'object',
                    change: 'deleted',
                    id: name,
                    stageId,
                    name,
                    before: this.objectSummary(originalObj),
                });
            }
        }
    }

    private diffStageTasks(original: StageDefinition, modified: StageDefinition, stageId: string, diff: ProjectDiff): void {
        this.diffNamedItems(
            original.tasks || [],
            modified.tasks || [],
            t => t.name,
            (t, change, before, after) => ({ kind: 'task', change, id: t.name, stageId, name: t.name, before, after, details: change === 'updated' ? this.objectShallowDiff(before, after) : undefined }),
            diff.tasks,
            (t) => this.taskSummary(t)
        );
    }

    private diffStageActions(original: StageDefinition, modified: StageDefinition, stageId: string, diff: ProjectDiff): void {
        this.diffNamedItems(
            original.actions || [],
            modified.actions || [],
            a => a.name,
            (a, change, before, after) => ({ kind: 'action', change, id: a.name, stageId, name: a.name, before, after, details: change === 'updated' ? this.objectShallowDiff(before, after) : undefined }),
            diff.actions,
            (a) => this.actionSummary(a)
        );
    }

    private diffStageVariables(original: StageDefinition, modified: StageDefinition, stageId: string, diff: ProjectDiff): void {
        this.diffNamedItems(
            original.variables || [],
            modified.variables || [],
            v => v.name,
            (v, change, before, after) => ({ kind: 'variable', change, id: v.name, stageId, name: v.name, before, after, details: change === 'updated' ? this.objectShallowDiff(before, after) : undefined }),
            diff.variables,
            (v) => this.variableSummary(v)
        );
    }

    private diffNamedItems<T>(
        original: T[],
        modified: T[],
        getKey: (item: T) => string,
        buildDiff: (item: T, change: EntityDiff['change'], before: unknown, after: unknown) => EntityDiff,
        target: EntityDiff[],
        summarize: (item: T) => unknown
    ): void {
        const originalMap = this.toMap(original, getKey);
        const modifiedMap = this.toMap(modified, getKey);

        for (const [key, modifiedItem] of modifiedMap) {
            const originalItem = originalMap.get(key);
            if (!originalItem) {
                target.push(buildDiff(modifiedItem, 'added', undefined, summarize(modifiedItem)));
            } else {
                const before = summarize(originalItem);
                const after = summarize(modifiedItem);
                const details = this.objectShallowDiff(before, after);
                if (details.length > 0) {
                    target.push(buildDiff(modifiedItem, 'updated', before, after));
                }
            }
        }

        for (const [key, originalItem] of originalMap) {
            if (!modifiedMap.has(key)) {
                target.push(buildDiff(originalItem, 'deleted', summarize(originalItem), undefined));
            }
        }
    }

    private toMap<T>(items: T[], getKey: (item: T) => string): Map<string, T> {
        const map = new Map<string, T>();
        for (const item of items) {
            const key = getKey(item);
            if (key) map.set(key, item);
        }
        return map;
    }

    private stageChanged(original: StageDefinition, modified: StageDefinition): boolean {
        return original.name !== modified.name ||
            original.type !== modified.type ||
            JSON.stringify(original.grid) !== JSON.stringify(modified.grid) ||
            original.backgroundColor !== modified.backgroundColor;
    }

    private stageSummary(stage: StageDefinition): unknown {
        return { name: stage.name, type: stage.type, grid: stage.grid, backgroundColor: stage.backgroundColor };
    }

    private stageDetails(original: StageDefinition, modified: StageDefinition): string[] {
        return this.objectShallowDiff(this.stageSummary(original), this.stageSummary(modified));
    }

    private taskSummary(task: GameTask): unknown {
        return {
            name: task.name,
            description: task.description,
            triggerMode: task.triggerMode,
            actionSequence: (task.actionSequence || []).map(item => item.name),
        };
    }

    private actionSummary(action: GameAction): unknown {
        return { name: action.name, type: action.type };
    }

    private variableSummary(variable: ProjectVariable): unknown {
        return { name: variable.name, type: variable.type, value: variable.initialValue ?? variable.defaultValue ?? variable.value };
    }

    private objectSummary(obj: ComponentData): unknown {
        return {
            name: obj.name,
            className: obj.className,
            x: obj.x,
            y: obj.y,
            width: obj.width,
            height: obj.height,
            text: obj.text,
            visible: obj.visible,
            events: obj.events,
        };
    }

    private objectDetails(original: ComponentData, modified: ComponentData): string[] {
        return this.objectShallowDiff(this.objectSummary(original), this.objectSummary(modified));
    }

    private objectShallowDiff(before: unknown, after: unknown): string[] {
        const details: string[] = [];
        if (typeof before !== 'object' || typeof after !== 'object' || !before || !after) {
            if (before !== after) {
                details.push(`vorher: ${JSON.stringify(before)}, nachher: ${JSON.stringify(after)}`);
            }
            return details;
        }

        const beforeObj = before as Record<string, unknown>;
        const afterObj = after as Record<string, unknown>;
        const keys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]);

        for (const key of keys) {
            if (JSON.stringify(beforeObj[key]) !== JSON.stringify(afterObj[key])) {
                details.push(`${key}: ${JSON.stringify(beforeObj[key])} → ${JSON.stringify(afterObj[key])}`);
            }
        }

        return details;
    }
}
