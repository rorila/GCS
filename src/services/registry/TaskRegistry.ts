import { coreStore } from './CoreStore';
import { ScopedTask } from './RegistryTypes';
import { libraryService } from '../LibraryService';
import { projectReferenceTracker } from './ReferenceTracker.ts';
import { GameTask } from '../../model/types';
import { projectActionRegistry } from './ActionRegistry.ts';

class TaskRegistry {
    public getTasks(stageId: string | 'all' | 'active' = 'active', resolveUsage: boolean = true, includeUnusedLibrary: boolean = false): ScopedTask[] {
        const project = coreStore.project;
        if (!project) return [];

        const rootTasks = (project.tasks || []).map(t => ({ ...t, uiScope: 'global' as const }));
        const blueprintStage = project.stages?.find(s => s.type === 'blueprint');
        const bpTasks = (blueprintStage?.tasks || []).map(t => ({ ...t, uiScope: 'global' as const }));

        let globalTasks = [...rootTasks];
        bpTasks.forEach(bt => {
            const idx = globalTasks.findIndex(t => t.name === bt.name);
            if (idx === -1) globalTasks.push(bt);
            else globalTasks[idx] = bt;
        });

        const libTasks = libraryService.getTasks().map(t => ({ ...t, uiScope: 'library' as const }));

        const combineAndDedup = (tasks: ScopedTask[]) => {
            const unique = new Map<string, ScopedTask>();
            tasks.forEach(t => {
                if (!unique.has(t.name)) {
                    unique.set(t.name, t);
                }
            });

            let finalTasks = Array.from(unique.values()).map(t => ({
                ...t,
                usageCount: resolveUsage ? projectReferenceTracker.getTaskUsage(t.name).length : 0
            }));

            if (!includeUnusedLibrary && resolveUsage) {
                finalTasks = finalTasks.filter(t => t.uiScope !== 'library' || (t.usageCount || 0) > 0);
            }

            return finalTasks;
        };

        if (stageId === 'all') {
            let all = [...globalTasks, ...libTasks];
            if (project.stages) {
                project.stages.forEach(stage => {
                    if (stage.type === 'blueprint') return;
                    if (stage.tasks) {
                        all = [...all, ...stage.tasks.map(t => ({ ...t, uiScope: 'stage' as const }))];
                    }
                });
            }
            return combineAndDedup(all);
        }

        const targetStageId = stageId === 'active' ? coreStore.activeStageId : stageId;
        if (targetStageId && project.stages) {
            const stage = project.stages.find(s => s.id === targetStageId);
            if (stage && stage.type !== 'blueprint' && stage.tasks) {
                const stageTasks = stage.tasks.map(t => ({ ...t, uiScope: 'stage' as const }));
                return combineAndDedup([...globalTasks, ...stageTasks, ...libTasks]);
            }
        }

        return combineAndDedup([...globalTasks, ...libTasks]);
    }

    public getTaskContainer(taskName: string): { type: 'global' | 'stage' | 'none', stageId?: string } {
        const project = coreStore.project;
        if (!project) return { type: 'none' };

        if (project.tasks && project.tasks.some(t => t.name === taskName)) {
            return { type: 'global' };
        }

        if (project.stages) {
            for (const stage of project.stages) {
                if (stage.tasks && stage.tasks.some(t => t.name === taskName)) {
                    return { type: 'stage', stageId: stage.id };
                }
            }
        }

        return { type: 'none' };
    }

    public validateTaskName(name: string, ignoreId?: string): { valid: boolean; error?: string } {
        if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
            return { valid: false, error: 'Tasks müssen mit einem Großbuchstaben beginnen (PascalCase).' };
        }

        const allTasks = this.getTasks('all');
        const matches = allTasks.filter(t => t.name === name);

        if (matches.length === 0) return { valid: true };

        for (const match of matches) {
            const mId = (match as any).id;
            const isMe = ignoreId && (
                (mId !== undefined && mId === ignoreId) || 
                (match.name !== undefined && match.name === ignoreId)
            );

            if (!isMe) {
                return { valid: false, error: 'Task-Name bereits vergeben (global oder in einer Stage).' };
            }
        }

        return { valid: true };
    }

    public findOriginalTask(name: string): GameTask | null {
        const project = coreStore.project;
        if (!project) return null;

        const globalTask = (project.tasks || []).find(t => t.name === name);
        if (globalTask) return globalTask;

        if (project.stages) {
            for (const stage of project.stages) {
                const stageTask = (stage.tasks || []).find((t: any) => t.name === name);
                if (stageTask) return stageTask;
            }
        }

        return null;
    }

    public renameTask(oldName: string, newName: string): boolean {
        const project = coreStore.project;
        if (!project || !this.validateTaskName(newName).valid) return false;
        
        let task = this.getTasks('all', false).find(t => t.name === oldName);
        if (task) { task.name = newName; } else { return false; }

        this.getTasks('all', false).forEach(t => {
            if (t.actionSequence) {
                t.actionSequence.forEach(item => {
                    if (item.type === 'task' && item.name === oldName) item.name = newName;
                    if (item.thenTask === oldName) item.thenTask = newName;
                    if (item.elseTask === oldName) item.elseTask = newName;
                });
            }
        });

        projectReferenceTracker.getAllObjectsWithSource().forEach(({ obj }: { obj: any }) => {
            if (obj.Tasks) {
                Object.keys(obj.Tasks).forEach(key => { if (obj.Tasks[key] === oldName) obj.Tasks[key] = newName; });
            }
        });

        if (project.flowCharts && project.flowCharts[oldName]) {
            project.flowCharts[newName] = project.flowCharts[oldName];
            delete project.flowCharts[oldName];
        }
        if (project.stages) {
            project.stages.forEach(stage => {
                if (stage.flowCharts && stage.flowCharts[oldName]) {
                    stage.flowCharts[newName] = stage.flowCharts[oldName];
                    delete stage.flowCharts[oldName];
                }
            });
        }
        return true;
    }

    public deleteTask(name: string): boolean {
        const project = coreStore.project;
        if (!project) return false;
        
        const task = this.getTasks('all', false).find(t => t.name === name);
        if (!task) return false;

        const actionsToCleanup = (task.actionSequence || []).filter(item => item.type === 'action').map(item => item.name!);
        project.tasks = project.tasks.filter(t => t.name !== name);
        
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.tasks) s.tasks = s.tasks.filter((t: any) => t.name !== name);
                if (s.flowCharts && s.flowCharts[name]) delete s.flowCharts[name];
            });
        }
        if (project.flowCharts && project.flowCharts[name]) delete project.flowCharts[name];

        actionsToCleanup.forEach(actionName => {
            if (projectReferenceTracker.getActionUsage(actionName).length === 0) projectActionRegistry.deleteAction(actionName);
        });

        this.getTasks('all', false).forEach(t => {
            if (t.actionSequence) {
                t.actionSequence.forEach(item => {
                    if (item.type === 'task' && item.name === name) item.name = '';
                    if (item.thenTask === name) item.thenTask = '';
                    if (item.elseTask === name) item.elseTask = '';
                });
            }
        });

        projectReferenceTracker.getAllObjectsWithSource().forEach(({ obj }: { obj: any }) => {
            if (obj.Tasks) {
                Object.keys(obj.Tasks).forEach(evt => { if (obj.Tasks[evt] === name) delete obj.Tasks[evt]; });
            }
        });

        return true;
    }
}

export const projectTaskRegistry = new TaskRegistry();
