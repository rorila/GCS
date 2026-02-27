import { GameProject, UsageReport } from '../../model/types';
import { RefactoringUtils } from './RefactoringUtils';

export class VariableRefactoringService {
    /**
     * Renames a variable project-wide
     */
    public static renameVariable(project: GameProject, oldName: string, newName: string): void {
        if (!oldName || !newName || oldName === newName) return;

        // 1. Update project variables list
        project.variables.forEach(v => {
            if (v.name === oldName) v.name = newName;
        });

        // 1b. Update stage-local variables list
        if (project.stages) {
            project.stages.forEach(stage => {
                if (stage.variables) {
                    stage.variables.forEach(v => {
                        if (v.name === oldName) v.name = newName;
                    });
                }
            });
        }

        // 2. Update actions (Global + all Stages)
        const allActions = [...project.actions];
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.actions) allActions.push(...s.actions);
            });
        }

        allActions.forEach(action => {
            const anyAction = action as any;
            // Variable assignments and reads
            if (anyAction.variableName === oldName) anyAction.variableName = newName;
            if (anyAction.resultVariable === oldName) anyAction.resultVariable = newName;

            // Calculation steps
            if (anyAction.calcSteps) {
                anyAction.calcSteps.forEach((step: any) => {
                    if (step.operandType === 'variable' && step.variable === oldName) {
                        step.variable = newName;
                    }
                });
            }

            // String interpolation in property changes
            if (anyAction.type === 'property' && anyAction.changes) {
                for (const key in anyAction.changes) {
                    let val = anyAction.changes[key];
                    if (typeof val === 'string') {
                        anyAction.changes[key] = RefactoringUtils.replaceInterpolation(val, oldName, newName);
                    }
                }
            }

            // Formula interpolation
            if ((action as any).formula && typeof (action as any).formula === 'string') {
                (action as any).formula = RefactoringUtils.replaceInterpolation((action as any).formula, oldName, newName);
            }

            // Service params interpolation
            if (anyAction.serviceParams) {
                for (const key in anyAction.serviceParams) {
                    anyAction.serviceParams[key] = RefactoringUtils.replaceInterpolation(anyAction.serviceParams[key], oldName, newName);
                }
            }
        });

        // 3. Update task sequences
        project.tasks.forEach(task => {
            RefactoringUtils.processSequenceItems(task.actionSequence, (item) => {
                const seqItem = item as any;
                if (seqItem.type === 'condition' && seqItem.condition) {
                    if (seqItem.condition.variable === oldName) seqItem.condition.variable = newName;
                }
                if (seqItem.type === 'while' && seqItem.condition) {
                    if (seqItem.condition.variable === oldName) seqItem.condition.variable = newName;
                }
                if (seqItem.type === 'for') {
                    if (seqItem.iteratorVar === oldName) seqItem.iteratorVar = newName;
                    if (typeof seqItem.from === 'string') seqItem.from = RefactoringUtils.replaceInterpolation(seqItem.from, oldName, newName);
                    if (typeof seqItem.to === 'string') seqItem.to = RefactoringUtils.replaceInterpolation(seqItem.to, oldName, newName);
                }
                if (seqItem.type === 'foreach') {
                    if (seqItem.sourceArray === oldName) seqItem.sourceArray = newName;
                    if (seqItem.itemVar === oldName) seqItem.itemVar = newName;
                    if (seqItem.indexVar === oldName) seqItem.indexVar = newName;
                }
            });
        });

        // 5. Update all stages
        if (project.stages) {
            project.stages.forEach(stage => {
                // Update stage objects
                if (stage.objects) {
                    stage.objects.forEach(obj => {
                        // String interpolation in properties
                        for (const key in obj) {
                            if (typeof (obj as any)[key] === 'string') {
                                (obj as any)[key] = RefactoringUtils.replaceInterpolation((obj as any)[key], oldName, newName);
                            }
                        }
                    });
                }

                // Update stage flow charts
                if (stage.flowCharts) {
                    Object.keys(stage.flowCharts).forEach(key => {
                        const flowChart = stage.flowCharts![key];
                        if (flowChart?.elements) {
                            flowChart.elements.forEach((el: any) => {
                                if (el.type === 'Condition' && el.data?.condition) {
                                    if (el.data.condition.variable === oldName) {
                                        el.data.condition.variable = newName;
                                    }
                                }
                            });
                        }
                    });
                }
            });
        }
    }

    /**
     * Returns a report on where a variable is used project-wide.
     */
    public static getVariableUsageReport(project: GameProject, varName: string): UsageReport {
        const report: UsageReport = { totalCount: 0, locations: [] };
        const searchPattern = new RegExp(`\\$?\{?${varName}\}?`, 'g');

        const scan = (obj: any, type: any, name: string) => {
            if (!obj) return;
            const str = JSON.stringify(obj);
            const matches = str.match(searchPattern);
            if (matches) {
                report.totalCount += matches.length;
                report.locations.push({ type, name, details: `${matches.length} Treffer` });
            }
        };

        if (project.stages) {
            project.stages.forEach((s: any) => {
                scan(s.objects, 'stage', `Stage: ${s.name} (Objekte)`);
                scan(s.tasks, 'stage', `Stage: ${s.name} (Tasks)`);
                scan(s.actions, 'stage', `Stage: ${s.name} (Actions)`);
                scan(s.events, 'stage', `Stage: ${s.name} (Events)`);
            });
        }

        scan(project.tasks, 'task', 'Globale Tasks');
        scan(project.actions, 'action', 'Globale Actions');
        if ((project as any).objects) scan((project as any).objects, 'object', 'Globale Objekte');

        return report;
    }

    /**
     * Checks how many times a variable is used project-wide ($variableName or ${variableName})
     */
    public static getVariableUsageCount(project: GameProject, varName: string): number {
        return this.getVariableUsageReport(project, varName).totalCount;
    }

    /**
     * Deletes a variable project-wide
     */
    public static deleteVariable(project: GameProject, variableNameOrId: string): string[] {
        const report: string[] = [];
        let deleted = false;

        const filterVars = (vars: any[]) => {
            if (!vars) return vars;
            const initialLen = vars.length;
            const filtered = vars.filter(v => v.id !== variableNameOrId && v.name !== variableNameOrId);
            if (filtered.length < initialLen) deleted = true;
            return filtered;
        };

        if (project.variables) {
            const result = filterVars(project.variables);
            if (deleted) {
                project.variables = result;
                report.push(`Globale Variable "${variableNameOrId}" entfernt.`);
            }
        }

        if (project.stages) {
            project.stages.forEach((s: any) => {
                const wasDeleted = deleted;
                deleted = false;
                if (s.variables) {
                    const result = filterVars(s.variables);
                    if (deleted) {
                        s.variables = result;
                        report.push(`Variable "${variableNameOrId}" aus Stage "${s.name}" entfernt.`);
                    }
                }
                deleted = wasDeleted || deleted;
            });
        }

        return report;
    }
}
