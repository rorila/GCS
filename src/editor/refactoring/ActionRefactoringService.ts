import { GameProject, SequenceItem, UsageReport } from '../../model/types';
import { RefactoringUtils } from './RefactoringUtils';

export class ActionRefactoringService {
    /**
     * Renames an action project-wide
     */
    public static renameAction(project: GameProject, oldName: string, newName: string): void {
        if (!oldName || !newName || oldName === newName) return;

        // 1. Update project actions list (Global)
        project.actions.forEach(action => {
            if (action.name === oldName) action.name = newName;
        });

        // 2. Update stage-specific actions
        if (project.stages) {
            project.stages.forEach(stage => {
                if (stage.actions) {
                    stage.actions.forEach(action => {
                        if (action.name === oldName) action.name = newName;
                    });
                }
            });
        }

        // 3. Update task sequences (Global + all Stages)
        project.tasks.forEach(task => {
            RefactoringUtils.processSequenceItems(task.actionSequence, (item) => {
                const anyItem = item as any;
                if ((anyItem.type === 'action' || anyItem.type === 'data_action') && anyItem.name === oldName) {
                    anyItem.name = newName;
                }
            });
        });

        if (project.stages) {
            project.stages.forEach(stage => {
                if (stage.tasks) {
                    stage.tasks.forEach(task => {
                        RefactoringUtils.processSequenceItems(task.actionSequence, (item) => {
                            const anyItem = item as any;
                            if ((anyItem.type === 'action' || anyItem.type === 'data_action') && anyItem.name === oldName) {
                                anyItem.name = newName;
                            }
                        });
                    });
                }
            });
        }

        // 4. Update flow chart elements
        const charts: { [key: string]: any } = { ... (project.flowCharts || {}) };
        if (project.stages) {
            project.stages.forEach(stage => {
                if (stage.flowCharts) {
                    Object.assign(charts, stage.flowCharts);
                }
            });
        }

        Object.keys(charts).forEach(key => {
            const chart = charts[key];
            if (chart?.elements) {
                chart.elements.forEach((el: any) => {
                    let nodeChanged = false;

                    if (el.type === 'Action' || el.type === 'DataAction') {
                        if (el.properties && el.properties.name === oldName) {
                            el.properties.name = newName;
                            nodeChanged = true;
                        }
                        if (el.properties && el.properties.text === oldName) {
                            el.properties.text = newName;
                            nodeChanged = true;
                        }
                        if (el.data) {
                            if (el.data.name === oldName) { el.data.name = newName; nodeChanged = true; }
                            if (el.data.actionName === oldName) { el.data.actionName = newName; nodeChanged = true; }
                        }
                    } else if (el.type === 'Condition') {
                        if (el.data) {
                            if (el.data.thenAction === oldName) { el.data.thenAction = newName; nodeChanged = true; }
                            if (el.data.elseAction === oldName) { el.data.elseAction = newName; nodeChanged = true; }
                        }
                    }

                    if (el.data) {
                        if (RefactoringUtils.replaceInObjectRecursive(el.data, oldName, newName)) nodeChanged = true;
                    }

                    if (nodeChanged) {
                        console.log(`[ActionRefactoring] Treffer in Flow-Chart "${key}", Node "${el.id}": ${oldName} -> ${newName}`);
                    }
                });
            }
        });
    }

    /**
     * Returns a report on where an action is used project-wide.
     */
    public static getActionUsageReport(project: GameProject, actionName: string): UsageReport {
        const report: UsageReport = { totalCount: 0, locations: [] };

        const allTasks = [...(project.tasks || [])];
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.tasks) allTasks.push(...s.tasks);
            });
        }

        allTasks.forEach(task => {
            let usageInTask = 0;
            if (task.actionSequence) {
                RefactoringUtils.processSequenceItems(task.actionSequence, (item) => {
                    const anyItem = item as any;
                    if ((anyItem.type === 'action' || anyItem.type === 'data_action') && anyItem.name === actionName) usageInTask++;
                });
            }
            if (usageInTask > 0) {
                report.totalCount += usageInTask;
                report.locations.push({ type: 'task', name: task.name, details: `${usageInTask}x verwendet` });
            }
        });

        return report;
    }

    /**
     * Backward compatibility or simple count
     */
    public static getActionUsageCount(project: GameProject, actionName: string): number {
        return this.getActionUsageReport(project, actionName).totalCount;
    }

    /**
     * Deletes an action project-wide
     */
    public static deleteAction(project: GameProject, actionName: string): void {
        if (!actionName) return;

        // 1. Remove from lists
        project.actions = project.actions.filter(a => a.name !== actionName);
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.actions) s.actions = s.actions.filter(a => a.name !== actionName);
            });
        }

        // 2. Remove from sequences
        const allTasks = [...project.tasks];
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.tasks) allTasks.push(...s.tasks);
            });
        }

        allTasks.forEach(task => {
            if (task.actionSequence) {
                task.actionSequence = this.filterSequenceItems(task.actionSequence, actionName, 'action');
            }
        });

        // 3. Remove from flow charts
        const charts: { [key: string]: any } = { ... (project.flowCharts || {}) };
        if (project.stages) {
            project.stages.forEach(stage => {
                if (stage.flowCharts) {
                    Object.assign(charts, stage.flowCharts);
                }
            });
        }

        Object.keys(charts).forEach(key => {
            const flowChart = charts[key];
            if (flowChart?.elements) {
                flowChart.elements = flowChart.elements.filter((el: any) => {
                    const elName = el.data?.name || el.data?.actionName || el.properties?.name;
                    return !(el.type === 'Action' && elName === actionName);
                });
            }
        });
    }

    /**
     * Helper to filter out items from a sequence recursively
     */
    public static filterSequenceItems(sequence: SequenceItem[], name: string, type: 'action' | 'task'): SequenceItem[] {
        if (!sequence) return [];
        return sequence.filter(item => {
            if (!item) return false;
            if (typeof item === 'string') return item !== name;
            const seqItem = item as any;

            const isMatch = (seqItem.type === type) || (type === 'action' && seqItem.type === 'data_action');
            if (isMatch && seqItem.name === name) {
                console.log(`[ActionRefactoring] Filtering out item: ${seqItem.name} (Type: ${seqItem.type})`);
                return false;
            }

            if (seqItem.body) {
                seqItem.body = this.filterSequenceItems(seqItem.body, name, type);
            }
            if (seqItem.successBody) {
                seqItem.successBody = this.filterSequenceItems(seqItem.successBody, name, type);
            }
            if (seqItem.errorBody) {
                seqItem.errorBody = this.filterSequenceItems(seqItem.errorBody, name, type);
            }
            if (seqItem.elseBody) {
                seqItem.elseBody = this.filterSequenceItems(seqItem.elseBody, name, type);
            }

            return true;
        });
    }
}
