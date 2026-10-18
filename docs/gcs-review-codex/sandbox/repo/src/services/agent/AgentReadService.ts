import { BaseAction, GameTask, SequenceItem } from '../../model/types';
import type { AgentController } from '../AgentController';

/**
 * AgentReadService
 *
 * Kapselt alle rein lesenden Inventar- und Detail-APIs.
 */
export class AgentReadService {
    constructor(private controller: AgentController) {}

    /** Listet alle Stages auf. */
    public listStages(): { id: string, name: string, type: string, objectCount: number, taskCount: number }[] {
        this.controller.validateProjectLoaded();
        const project = this.controller.getProject()!;
        return (project.stages || []).map(s => ({
            id: s.id, name: s.name, type: s.type || 'standard',
            objectCount: (s.objects || []).length,
            taskCount: (s.tasks || []).length
        }));
    }

    /** Listet Tasks auf (optional gefiltert nach Stage). */
    public listTasks(stageId?: string): { name: string, actionCount: number, triggerMode: string }[] {
        this.controller.validateProjectLoaded();
        const project = this.controller.getProject()!;
        let tasks: GameTask[] = [];
        if (stageId) {
            const stage = project.stages?.find(s => s.id === stageId);
            tasks = (stage?.tasks as GameTask[]) || [];
        } else {
            tasks = [...(project.tasks || []), ...(project.stages?.flatMap(s => s.tasks || []) || [])];
        }
        return tasks.map(t => ({ name: t.name, actionCount: t.actionSequence.length, triggerMode: t.triggerMode || 'local-sync' }));
    }

    /** Listet Actions auf (optional gefiltert nach Stage). */
    public listActions(stageId?: string): { name: string, type: string }[] {
        this.controller.validateProjectLoaded();
        const project = this.controller.getProject()!;
        let actions: BaseAction[] = [];
        if (stageId) {
            const stage = project.stages?.find(s => s.id === stageId);
            actions = (stage?.actions as BaseAction[]) || [];
        } else {
            actions = [...(project.actions || []), ...(project.stages?.flatMap(s => (s.actions as BaseAction[]) || []) || [])];
        }
        return actions.map(a => ({ name: a.name, type: a.type }));
    }

    /** Listet Variablen auf. */
    public listVariables(scope?: 'global' | 'stage'): { name: string, type: string, value: any, scope: string }[] {
        this.controller.validateProjectLoaded();
        const project = this.controller.getProject()!;
        const vars: any[] = [];
        if (!scope || scope === 'global') {
            (project.variables || []).forEach(v => vars.push({ name: v.name, type: v.type, value: v.defaultValue ?? v.initialValue, scope: 'global' }));
        }
        if (!scope || scope === 'stage') {
            project.stages?.forEach(s => {
                (s.variables || []).forEach((v: any) => vars.push({ name: v.name, type: v.type, value: v.defaultValue ?? v.initialValue, scope: s.id }));
            });
        }
        return vars;
    }

    /** Listet Objekte einer Stage auf. */
    public listObjects(stageId: string): { name: string, className: string, x: number, y: number, visible: boolean }[] {
        this.controller.validateProjectLoaded();
        const project = this.controller.getProject()!;
        const stage = project.stages?.find(s => s.id === stageId);
        if (!stage) return [];
        return (stage.objects || []).map((o: any) => ({ name: o.name, className: o.className, x: o.x || 0, y: o.y || 0, visible: o.visible !== false }));
    }

    /** Gibt detaillierte Task-Infos zurück (mit aufgelöster Sequenz). */
    public getTaskDetails(taskName: string): { name: string, description: string, sequence: SequenceItem[], triggerMode: string } | null {
        this.controller.validateProjectLoaded();
        const task = this.controller.getTaskByName(taskName);
        if (!task) return null;
        return { name: task.name, description: task.description || '', sequence: task.actionSequence, triggerMode: task.triggerMode || 'local-sync' };
    }
}
