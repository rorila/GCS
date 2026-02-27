import { GameProject, UsageReport } from '../../model/types';
import { RefactoringUtils } from './RefactoringUtils';
import { ActionRefactoringService } from './ActionRefactoringService';

export class ObjectRefactoringService {
    /**
     * Renames an object project-wide
     */
    public static renameObject(project: GameProject, oldName: string, newName: string): void {
        if (!oldName || !newName || oldName === newName) return;

        // 1. Update object name itself (Global + Stages)
        project.objects.forEach(obj => {
            if (obj.name === oldName) obj.name = newName;
        });

        if (project.stages) {
            project.stages.forEach(stage => {
                if (stage.objects) {
                    stage.objects.forEach(obj => {
                        if (obj.name === oldName) obj.name = newName;
                    });
                }
            });
        }

        // 2. Update related actions and their targets
        const allActions = [...project.actions];
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.actions) allActions.push(...s.actions);
            });
        }

        allActions.forEach(action => {
            // Auto-rename actions that belong to this object
            if (action.name.startsWith(oldName + '.') || action.name.startsWith(oldName + '_')) {
                const newActionName = action.name.replace(oldName, newName);
                ActionRefactoringService.renameAction(project, action.name, newActionName);
                action.name = newActionName;
            }

            const anyAction = action as any;
            if (anyAction.target === oldName) anyAction.target = newName;
            if (anyAction.source === oldName) anyAction.source = newName;

            if (anyAction.changes) {
                for (const key in anyAction.changes) {
                    let val = anyAction.changes[key];
                    if (typeof val === 'string') {
                        if (val === oldName) {
                            anyAction.changes[key] = newName;
                        } else if (val.includes(`\${${oldName}`)) {
                            anyAction.changes[key] = RefactoringUtils.replaceObjectInterpolation(val, oldName, newName);
                        }
                    }
                }
            }

            if (anyAction.serviceParams) {
                for (const key in anyAction.serviceParams) {
                    let val = anyAction.serviceParams[key];
                    if (typeof val === 'string') {
                        if (val === oldName) {
                            anyAction.serviceParams[key] = newName;
                        } else if (val.includes(`\${${oldName}`)) {
                            anyAction.serviceParams[key] = RefactoringUtils.replaceObjectInterpolation(val, oldName, newName);
                        }
                    }
                }
            }
        });

        // 3. Update task sequences
        const allTasks = [...project.tasks];
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.tasks) allTasks.push(...s.tasks);
            });
        }

        allTasks.forEach(task => {
            RefactoringUtils.processSequenceItems(task.actionSequence, (item) => {
                const str = JSON.stringify(item);
                if (str.includes(`"${oldName}"`) || str.includes(`\${${oldName}`)) {
                    RefactoringUtils.replaceInObjectRecursive(item, oldName, newName);
                }
            });
        });

        // 4. Update input targets
        if (project.input) {
            if (project.input.player1Target === oldName) project.input.player1Target = newName;
            if (project.input.player2Target === oldName) project.input.player2Target = newName;
        }

        // 5. Update Flow Charts
        const charts: { [key: string]: any } = { ... (project.flowCharts || {}) };
        if (project.stages) {
            project.stages.forEach(stage => {
                if (stage.flowCharts) Object.assign(charts, stage.flowCharts);
            });
        }

        Object.keys(charts).forEach(key => {
            const chart = charts[key];
            if (chart?.elements) {
                chart.elements.forEach((el: any) => {
                    if (el.data) {
                        RefactoringUtils.replaceInObjectRecursive(el.data, oldName, newName);
                    }
                    if (el.properties) {
                        RefactoringUtils.replaceInObjectRecursive(el.properties, oldName, newName);
                    }
                });
            }
        });

        // 6. Update object properties
        const allObjectsToScan = [...project.objects];
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.objects) allObjectsToScan.push(...s.objects);
            });
        }
        allObjectsToScan.forEach(obj => {
            RefactoringUtils.replaceInObjectRecursive(obj, oldName, newName);
        });
    }

    /**
     * Returns a report on where an object is used project-wide
     */
    public static getObjectUsageReport(project: GameProject, objectName: string): UsageReport {
        const report: UsageReport = { totalCount: 0, locations: [] };
        const searchPattern = new RegExp(`(?:"${objectName}")|(?:'${objectName}')|(?:\\$\\{${objectName}\\})`, 'g');

        const scan = (obj: any, type: any, name: string) => {
            if (!obj) return;
            const str = JSON.stringify(obj);
            const matches = str.match(searchPattern);
            if (matches) {
                report.totalCount += matches.length;
                report.locations.push({ type, name, details: `${matches.length} Referenzen` });
            }
        };

        if (project.stages) {
            project.stages.forEach((s: any) => {
                scan(s.tasks, 'stage', `Stage: ${s.name} (Tasks)`);
                scan(s.actions, 'stage', `Stage: ${s.name} (Actions)`);
            });
        }
        scan(project.tasks, 'task', 'Globale Tasks');
        scan(project.actions, 'action', 'Globale Actions');

        return report;
    }
}
