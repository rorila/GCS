import { GameProject, SequenceItem, UsageReport } from '../../model/types';
import { Logger } from '../../utils/Logger';
import { RefactoringUtils } from './RefactoringUtils';

export class ActionRefactoringService {
    private static logger = Logger.get('ActionRefactoring', 'Action_Management');
    private static lifecycleLogger = Logger.get('ActionRefactoring', 'Action_Lifecycle');
    /**
     * Renames an action project-wide
     */
    public static renameAction(project: GameProject, oldName: string, newName: string): void {
        if (!oldName || !newName || oldName === newName) return;

        ActionRefactoringService.lifecycleLogger.info(`Action "${oldName}" wird in "${newName}" umbenannt.`);

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
                    const type = (el.type || '').toLowerCase();
                    let nodeChanged = false;

                    if (['action', 'dataaction', 'data_action'].includes(type)) {
                        // Prüfe ALLE Felder auf den alten Namen. Wenn IRGENDEINES passt, update alle.
                        // Dies ist kritisch/subtil: Falls durch Referenzen ein Feld (z.B. data.actionName) bereits
                        // den neuen Namen hat, aber properties.name noch den alten, muss Refactoring dennoch greifen.
                        const hasOldNameMatch = (el.data?.actionName === oldName) ||
                            (el.data?.name === oldName) ||
                            (el.properties?.name === oldName) ||
                            (el.properties?.text === oldName);

                        if (hasOldNameMatch) {
                            if (!el.data) el.data = {};
                            el.data.actionName = newName;
                            el.data.name = newName;

                            if (!el.properties) el.properties = {};
                            el.properties.name = newName;
                            el.properties.text = newName;
                            nodeChanged = true;
                        }
                    } else if (type === 'condition') {
                        if (el.data) {
                            if (el.data.thenAction === oldName) { el.data.thenAction = newName; nodeChanged = true; }
                            if (el.data.elseAction === oldName) { el.data.elseAction = newName; nodeChanged = true; }
                        }
                    }

                    if (el.data) {
                        if (RefactoringUtils.replaceInObjectRecursive(el.data, oldName, newName)) nodeChanged = true;
                    }

                    if (nodeChanged) {
                        ActionRefactoringService.logger.info(`Treffer in Flow-Chart "${key}", Node "${el.id}": ${oldName} -> ${newName}`);
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

        ActionRefactoringService.lifecycleLogger.info(`[TRACE] deleteAction gestartet für: "${actionName}"`);

        // 1. Remove from lists
        const oldGlobalCount = project.actions.length;
        project.actions = project.actions.filter(a => a.name !== actionName);
        const newGlobalCount = project.actions.length;
        if (oldGlobalCount !== newGlobalCount) {
            ActionRefactoringService.lifecycleLogger.info(`[TRACE] Aus globaler Liste entfernt: "${actionName}" (Vorher: ${oldGlobalCount}, Nachher: ${newGlobalCount})`);
        }

        if (project.stages) {
            project.stages.forEach(s => {
                if (s.actions) {
                    const oldStageCount = s.actions.length;
                    s.actions = s.actions.filter(a => a.name !== actionName);
                    const newStageCount = s.actions.length;
                    if (oldStageCount !== newStageCount) {
                        ActionRefactoringService.lifecycleLogger.info(`[TRACE] Aus Stage "${s.id}" Liste entfernt: "${actionName}" (Vorher: ${oldStageCount}, Nachher: ${newStageCount})`);
                    }
                }
            });
        }

        // 2. Remove from sequences
        const allTasks = [...project.tasks];
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.tasks) allTasks.push(...s.tasks);
            });
        }

        ActionRefactoringService.lifecycleLogger.info(`[TRACE] Scanne ${allTasks.length} Tasks nach Sequenz-Referenzen auf "${actionName}"...`);
        allTasks.forEach(task => {
            if (task.actionSequence) {
                const oldSeqLength = task.actionSequence.length;
                task.actionSequence = this.filterSequenceItems(task.actionSequence, actionName, 'action');
                const newSeqLength = task.actionSequence.length;
                if (oldSeqLength !== newSeqLength) {
                    ActionRefactoringService.lifecycleLogger.info(`[TRACE] Referenz in Task "${task.name}" Sequenz entfernt (${oldSeqLength} -> ${newSeqLength}).`);
                }
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

        ActionRefactoringService.lifecycleLogger.info(`[TRACE] Scanne ${Object.keys(charts).length} FlowCharts nach Knoten-Referenzen auf "${actionName}"...`);
        Object.keys(charts).forEach(key => {
            const flowChart = charts[key];
            if (flowChart?.elements) {
                const oldElCount = flowChart.elements.length;
                flowChart.elements = flowChart.elements.filter((el: any) => {
                    const elName = el.data?.name || el.data?.actionName || el.properties?.name;
                    const type = (el.type || '').toLowerCase();
                    const isActionNode = ['action', 'dataaction', 'httpaction'].includes(type);
                    const match = isActionNode && elName === actionName;
                    if (match) {
                        ActionRefactoringService.lifecycleLogger.info(`[TRACE] Flow-Knoten "${el.id}" (Typ: ${type}) in Chart "${key}" wird gelöscht.`);
                    }
                    return !match;
                });
                const newElCount = flowChart.elements.length;
                if (oldElCount !== newElCount) {
                    ActionRefactoringService.lifecycleLogger.info(`[TRACE] Flow-Knoten in Chart "${key}" entfernt (${oldElCount} -> ${newElCount}).`);
                }
            }
        });

        ActionRefactoringService.lifecycleLogger.info(`[TRACE] deleteAction abgeschlossen für: "${actionName}"`);
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
                ActionRefactoringService.logger.info(`Filtering out item: ${seqItem.name} (Type: ${seqItem.type})`);
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
