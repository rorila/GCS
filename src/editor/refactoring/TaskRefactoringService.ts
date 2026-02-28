import { GameProject, UsageReport } from '../../model/types';
import { RefactoringUtils } from './RefactoringUtils';
import { ActionRefactoringService } from './ActionRefactoringService';
import { Logger } from '../../utils/Logger';

export class TaskRefactoringService {
    private static logger = Logger.get('Refactoring', 'Task_Management');
    /**
     * Renames a task project-wide
     */
    public static renameTask(project: GameProject, oldName: string, newName: string): void {
        if (!oldName || !newName || oldName === newName) return;

        // 1. Update project tasks list (Global)
        project.tasks.forEach(task => {
            if (task.name === oldName) task.name = newName;
        });

        // 1b. Update stage-specific tasks
        if (project.stages) {
            project.stages.forEach(stage => {
                if (stage.tasks) {
                    stage.tasks.forEach(task => {
                        if (task.name === oldName) task.name = newName;
                    });
                }
            });
        }

        // 2. Update task calls in sequences (Global + all Stages)
        const allTasks = [...project.tasks];
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.tasks) allTasks.push(...s.tasks);
            });
        }

        allTasks.forEach(task => {
            RefactoringUtils.processSequenceItems(task.actionSequence, (item) => {
                const seqItem = item as any;
                if (seqItem.type === 'task' && seqItem.name === oldName) seqItem.name = newName;
                if (seqItem.thenTask === oldName) seqItem.thenTask = newName;
                if (seqItem.elseTask === oldName) seqItem.elseTask = newName;
            });
        });

        // 3. Update object event bindings
        project.objects.forEach(obj => {
            const evts = (obj as any).events || (obj as any).Tasks;
            if (evts) {
                for (const event in evts) {
                    if (evts[event] === oldName) {
                        evts[event] = newName;
                    }
                }
            }
        });

        // 4. Update variable scopes
        project.variables.forEach(v => {
            if (v.scope === oldName) v.scope = newName;
        });

        // 5. Update flowChart key if task was renamed
        if (project.flowCharts && project.flowCharts[oldName]) {
            project.flowCharts[newName] = project.flowCharts[oldName];
            delete project.flowCharts[oldName];
        }
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.flowCharts && s.flowCharts[oldName]) {
                    s.flowCharts[newName] = s.flowCharts[oldName];
                    delete s.flowCharts[oldName];
                }
            });
        }

        // 6. Update Task nodes within all flowCharts
        const charts: { [key: string]: any } = { ... (project.flowCharts || {}) };
        if (project.stages) {
            project.stages.forEach(stage => {
                if (stage.flowCharts) Object.assign(charts, stage.flowCharts);
            });
        }

        Object.keys(charts).forEach(key => {
            const flowChart = charts[key];
            if (flowChart?.elements) {
                flowChart.elements.forEach((el: any) => {
                    if (el.type === 'Task' && el.data?.taskName === oldName) {
                        el.data.taskName = newName;
                    }
                });
            }
        });

        // 7. Update bindings in all stages
        if (project.stages) {
            project.stages.forEach(stage => {
                if (stage.objects) {
                    stage.objects.forEach(obj => {
                        const evts = (obj as any).events || (obj as any).Tasks;
                        if (evts) {
                            for (const event in evts) {
                                if (evts[event] === oldName) {
                                    evts[event] = newName;
                                }
                            }
                        }
                    });
                }
                // Stage events
                if ((stage as any).events) {
                    const stageEvents = (stage as any).events;
                    for (const eventKey in stageEvents) {
                        if (stageEvents[eventKey] === oldName) {
                            stageEvents[eventKey] = newName;
                        }
                    }
                }
            });
        }
    }

    /**
     * Returns a report on where a task is used project-wide
     */
    public static getTaskUsageReport(project: GameProject, taskName: string): UsageReport {
        const report: UsageReport = { totalCount: 0, locations: [] };

        const scanObjects = (objs: any[], contextName: string) => {
            if (!objs) return;
            objs.forEach(obj => {
                if (obj.Tasks) {
                    Object.keys(obj.Tasks).forEach(evt => {
                        if (obj.Tasks[evt] === taskName) {
                            report.totalCount++;
                            report.locations.push({ type: 'object', name: obj.name, details: `Event '${evt}' in ${contextName}` });
                        }
                    });
                }
            });
        };

        scanObjects(project.objects || [], 'Global');
        if (project.stages) {
            project.stages.forEach(s => scanObjects(s.objects || [], `Stage ${s.name}`));
        }

        const searchPattern = new RegExp(`\\$?\{?${taskName}\}?`, 'g');
        const scanInterpolation = (obj: any, type: any, name: string) => {
            if (!obj) return;
            const str = JSON.stringify(obj);
            const matches = str.match(searchPattern);
            if (matches) {
                report.totalCount += matches.length;
                report.locations.push({ type, name, details: `${matches.length} Treffer in Interpolation` });
            }
        };

        if (project.stages) {
            project.stages.forEach((s: any) => {
                scanInterpolation(s.tasks, 'stage', `Stage: ${s.name} (Other Tasks)`);
                scanInterpolation(s.actions, 'stage', `Stage: ${s.name} (Actions)`);
            });
        }
        scanInterpolation(project.tasks, 'task', 'Globale Tasks');
        scanInterpolation(project.actions, 'action', 'Globale Actions');

        return report;
    }

    private static cleanupEvents(evts: any, taskName: string): void {
        if (!evts) return;
        for (const event in evts) {
            if (evts[event] === taskName) {
                evts[event] = "";
            }
        }
    }

    /**
     * Deletes a task project-wide
     */
    public static deleteTask(project: GameProject, taskName: string): void {
        const lowerName = taskName.toLowerCase();

        // 1. Remove from lists
        if (project.tasks) {
            project.tasks = project.tasks.filter(t => t.name !== taskName && t.name.toLowerCase() !== lowerName);
        }
        if (project.stages) {
            project.stages.forEach(stage => {
                if (stage.tasks) {
                    stage.tasks = stage.tasks.filter(t => t.name !== taskName && t.name.toLowerCase() !== lowerName);
                }
            });
        }

        // 2. Remove event mappings
        const cleanupEvents = (events: any) => {
            if (!events) return;
            Object.keys(events).forEach(key => {
                const mappedVal = events[key];
                if (typeof mappedVal === 'string' && (mappedVal === taskName || mappedVal.toLowerCase() === lowerName)) {
                    delete events[key];
                }
            });
        };

        if (project.stages) {
            project.stages.forEach(s => cleanupEvents(s.events));
        }

        // 3. Remove from sequences
        const allTasks = [... (project.tasks || [])];
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.tasks) allTasks.push(...s.tasks);
            });
        }
        allTasks.forEach(t => {
            if (t.actionSequence) {
                t.actionSequence = ActionRefactoringService.filterSequenceItems(t.actionSequence, taskName, 'task');
            }
        });

        // 4. Remove from Object Events (Global + all Stages)
        const scanAndCleanupObjects = (objs: any[]) => {
            if (!objs) return;
            objs.forEach(obj => {
                if (obj.events) TaskRefactoringService.cleanupEvents(obj.events, taskName);
                if (obj.Tasks) TaskRefactoringService.cleanupEvents(obj.Tasks, taskName);
                if (obj.children) scanAndCleanupObjects(obj.children);
            });
        };

        scanAndCleanupObjects(project.objects || []);
        if (project.stages) {
            project.stages.forEach(stage => {
                scanAndCleanupObjects(stage.objects || []);
            });
        }

        // 5. Remove flow charts
        if (project.flowCharts) {
            Object.keys(project.flowCharts).forEach(key => {
                if (key === taskName || key.toLowerCase() === lowerName) {
                    delete project.flowCharts![key];
                }
            });
        }
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.flowCharts) {
                    Object.keys(s.flowCharts).forEach(key => {
                        if (key === taskName || key.toLowerCase() === lowerName) {
                            delete s.flowCharts![key];
                        }
                    });
                }
            });
        }

        TaskRefactoringService.logger.info(`Task "${taskName}" erfolgreich aus dem Projekt-Modell (JSON) gelöscht.`);
    }
}
