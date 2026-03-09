import { GameProject } from '../../model/types';
import { Logger } from '../../utils/Logger';

export class SanitizationService {
    private static logger = Logger.get('SanitizationService', 'Project_Validation');
    /**
     * Cleans up all action sequences in the project by removing empty or invalid items.
     * Prevents "ghost" nodes in diagrams and logic issues.
     */
    public static cleanActionSequences(project: GameProject): void {
        // Collect all valid actions (Global + Stages)
        const validActions = new Set<string>();
        if (project.actions) project.actions.forEach(a => validActions.add(a.name));
        if (project.stages) {
            project.stages.forEach(s => {
                const stageActions = s.actions || (s as any).Actions;
                if (stageActions && Array.isArray(stageActions)) {
                    stageActions.forEach(a => validActions.add(a.name));
                }
            });
        }

        const allTasks = [...(project.tasks || [])];
        if (project.stages) {
            project.stages.forEach(s => {
                const stageTasks = s.tasks || (s as any).Tasks;
                if (stageTasks && Array.isArray(stageTasks)) {
                    allTasks.push(...stageTasks);
                }
            });
        }

        let removedCount = 0;
        allTasks.forEach(task => {
            if (task.actionSequence) {
                task.actionSequence = task.actionSequence.filter(item => {
                    if (!item) return false;

                    // Case 1: String (Legacy/Short-Ref)
                    if (typeof item === 'string') {
                        const exists = validActions.has(item);
                        if (!exists) removedCount++;
                        return exists;
                    }

                    // Case 2: Object Reference
                    const obj = item as any;
                    if (obj.type === 'action' && obj.name) {
                        const exists = validActions.has(obj.name);
                        if (!exists) {
                            SanitizationService.logger.warn(`Entferne verwaiste Action-Referenz "${obj.name}" aus Task "${task.name}"`);
                            removedCount++;
                        }
                        return exists;
                    }

                    // Keep other items (Conditionals, direct definitions with fields)
                    return obj.type !== undefined || obj.name !== undefined || obj.condition !== undefined;
                });
            }
        });

        if (removedCount > 0) {
            SanitizationService.logger.info(`${removedCount} verwaiste Action-Referenzen aus Sequenzen entfernt.`);
        }

        // HOTFIX: Repair corrupted UserData object name
        if (project.stages) {
            project.stages.forEach(stage => {
                if (stage.objects) {
                    const userData = stage.objects.find((o: any) => o.id === 'obj_userData');
                    if (userData && userData.name !== 'UserData') {
                        userData.name = 'UserData';
                    }
                }
            });
        }
        if (project.objects) {
            const userData = project.objects.find((o: any) => o.id === 'obj_userData');
            if (userData && userData.name !== 'UserData') {
                userData.name = 'UserData';
            }
        }
    }

    /**
     * Performs a full project hygiene check and sanitization.
     */
    public static sanitizeProject(project: GameProject): string[] {
        const report: string[] = [];
        if (!project) return report;

        const taskNames = new Set<string>();
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.tasks) s.tasks.forEach(t => taskNames.add(t.name));
            });
        }

        const rootTaskCountBefore = project.tasks.length;
        project.tasks = project.tasks.filter(t => !taskNames.has(t.name));
        if (project.tasks.length < rootTaskCountBefore) {
            const diffSize = rootTaskCountBefore - project.tasks.length;
            report.push(`${diffSize} doppelte globale Tasks wurden entfernt (bereits in Stages vorhanden).`);
        }

        const seenTasks = new Set<string>();
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.tasks) {
                    s.tasks = s.tasks.filter(t => {
                        const lower = t.name.toLowerCase();
                        if (seenTasks.has(lower)) {
                            report.push(`Task-Duplikat "${t.name}" aus Stage "${s.name}" entfernt.`);
                            return false;
                        }
                        seenTasks.add(lower);
                        return true;
                    });
                }
            });
        }

        project.tasks.forEach(t => taskNames.add(t.name));
        const cleanFlowCharts = (charts: Record<string, any> | undefined, label: string) => {
            if (!charts) return;
            Object.keys(charts).forEach(key => {
                if (key === 'global' || key === 'event-map' || key === 'element-overview' || key === '__legacy_flow__') return;

                if (!taskNames.has(key)) {
                    delete charts[key];
                    report.push(`Entfernter verwaister Flow-Chart in ${label}: ${key}`);
                }
            });
        };

        cleanFlowCharts(project.flowCharts, 'Projekt');
        if (project.stages) {
            project.stages.forEach(s => cleanFlowCharts(s.flowCharts, `Stage ${s.name}`));
        }

        const globalVarNames = new Set((project.variables || []).map(v => v.name));
        const blueprintStage = project.stages?.find(s => s.id === 'stage_blueprint');
        if (blueprintStage && blueprintStage.variables) {
            blueprintStage.variables.forEach((v: any) => globalVarNames.add(v.name));
        }

        if (project.stages) {
            project.stages.forEach(stage => {
                if (stage.variables) {
                    const originalCount = stage.variables.length;
                    if (stage.id !== 'stage_blueprint') {
                        stage.variables = stage.variables.filter((v: any) => {
                            const isDuplicateOfGlobal = globalVarNames.has(v.name);
                            return !isDuplicateOfGlobal;
                        });
                    }

                    if (stage.variables.length < originalCount) {
                        report.push(`${originalCount - stage.variables.length} doppelte Variablen in Stage "${stage.name}" entfernt.`);
                    }
                }
            });
        }

        this.cleanActionSequences(project);
        report.push('Action-Sequenzen bereinigt');

        const allObjectsScope = [...project.objects, ...(project.variables || [])];
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.objects) allObjectsScope.push(...s.objects);
                if (s.variables) allObjectsScope.push(...(s.variables as any));
            });
        }

        allObjectsScope.forEach(obj => {
            if ((obj as any).Tasks) {
                const tasks = (obj as any).Tasks;
                Object.keys(tasks).forEach(key => {
                    const mappedTask = tasks[key];
                    if (mappedTask && !taskNames.has(mappedTask)) {
                        delete tasks[key];
                        report.push(`Entfernte verwaiste Task-Zuweisung in ${obj.name}: ${key} -> ${mappedTask}`);
                    }
                });
            }
        });

        this.migrateFlowChartActions(project, report);

        const managerNames = ['VisualObjects', 'Tasks', 'Actions', 'Variables', 'FlowCharts'];
        const cleanManagers = (objs: any[]) => {
            if (!objs) return [];
            return objs.filter(obj => {
                const isMgr = (obj as any).isManager === true ||
                    (obj as any).isTransient === true ||
                    (managerNames.includes(obj.name) && (obj.className === 'TObjectList' || obj.className === 'TTable' || obj.className === 'TWindow'));
                if (isMgr) report.push(`Manager-Leiche entfernt: ${obj.name} (${obj.id})`);
                return !isMgr;
            });
        };

        if (project.objects) project.objects = cleanManagers(project.objects);
        if (project.variables) project.variables = (project.variables as any[]).filter(v => !(v as any).isManager);
        if (project.stages) {
            project.stages.forEach(s => {
                if (s.objects) s.objects = cleanManagers(s.objects);
                if (s.variables) s.variables = (s.variables as any[]).filter(v => !(v as any).isManager);
            });
        }

        return report;
    }

    /**
     * Migrates all actions in all flowCharts to links.
     */
    public static migrateFlowChartActions(project: GameProject, report: string[] = []): void {
        const transientFields = ['_formValues', 'taskName', 'actionName'];
        let cleanupCount = 0;

        if (project.actions) {
            project.actions.forEach(action => {
                transientFields.forEach(field => {
                    if ((action as any)[field] !== undefined) {
                        delete (action as any)[field];
                        cleanupCount++;
                    }
                });
            });
        }

        if (!project.flowCharts) {
            return;
        }

        const globalActionNames = new Set((project.actions || []).map(a => a.name));
        let migrationCount = 0;

        const migrateCharts = (charts: Record<string, any> | undefined) => {
            if (!charts) return;
            Object.keys(charts).forEach(contextKey => {
                const flowChart = charts[contextKey];
                if (!flowChart || !flowChart.elements) return;

                flowChart.elements.forEach((el: any) => {
                    if (el.type === 'action') {
                        const actionName = el.properties?.name || el.data?.name;

                        if (el.data) {
                            transientFields.forEach(field => {
                                if (el.data[field] !== undefined) {
                                    delete el.data[field];
                                    cleanupCount++;
                                }
                            });
                        }

                        if (actionName && globalActionNames.has(actionName)) {
                            const isMinimalLink = el.data?.isLinked && Object.keys(el.data).length <= 2;
                            if (!isMinimalLink) {
                                el.data = { name: actionName, isLinked: true };
                                migrationCount++;
                            }
                        }
                    }
                });
            });
        };

        migrateCharts(project.flowCharts);
        if (project.stages) {
            project.stages.forEach(s => migrateCharts(s.flowCharts));
        }

        if (migrationCount > 0) report.push(`${migrationCount} FlowChart-Aktionen migriert.`);
        if (cleanupCount > 0) report.push(`${cleanupCount} transiente Felder entfernt.`);
    }
}
