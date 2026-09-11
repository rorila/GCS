import { DebugLogService } from '../../services/DebugLogService';

export interface ProjectHelperContext {
    getProject: () => any;
    getEditor: () => any;
    getService: () => DebugLogService;
    getObjectFilter: () => string;
    getEventFilter: () => string;
}

export class TDebugLogProjectHelper {
    constructor(private readonly context: ProjectHelperContext) {}

    /**
     * Liefert die fuer die Filter relevanten Stages: aktive Stage + Blueprint-Stage.
     * Anforderung: Filter beziehen sich auf die Stage im Fokus + Blueprint.
     */
    getRelevantStages(): any[] {
        const project = this.context.getProject();
        if (!project?.stages) return [];

        const editor = this.context.getEditor();
        const activeStage = editor?.getActiveStage?.() || null;
        const blueprint = project.stages.find((s: any) => s.type === 'blueprint') || null;

        const stages: any[] = [];
        if (blueprint) stages.push(blueprint);
        if (activeStage && activeStage !== blueprint) stages.push(activeStage);
        return stages;
    }

    getAllProjectObjects(): any[] {
        const project = this.context.getProject();
        if (!project) return [];

        const result: any[] = [];

        const flatten = (arr: any[]) => {
            for (const o of arr) {
                result.push(o);
                if (o.children && Array.isArray(o.children)) flatten(o.children);
            }
        };

        // Legacy root objects
        if (project.objects) flatten(project.objects);
        if (project.variables) result.push(...project.variables);

        // Nur aktive Stage + Blueprint (Stages selbst haben Events, Variables ebenso)
        for (const stage of this.getRelevantStages()) {
            result.push(stage);
            if (stage.objects) flatten(stage.objects);
            if (stage.variables) result.push(...stage.variables);
        }

        result.push(...this.getRuntimePoolInstances());
        return result;
    }

    /**
     * Liefert die zur Laufzeit aktiven Pool-Instanzen (aus TSpriteTemplate gespawnte
     * Objekte wie "CherryTemplate_pool_3").
     *
     * Diese Objekte sind transient (isTransient) und stehen NIE in project.objects.
     * Ohne sie liesse sich im Viewer nicht auf gespawnte Objekte filtern, obwohl
     * genau diese die onCollision-Events ausloesen.
     */
    getRuntimePoolInstances(): any[] {
        const editor = this.context.getEditor();
        const objects: any[] = editor?.runtimeObjects
            || editor?.runManager?.runtime?.objects
            || editor?.runtime?.objects;

        if (!Array.isArray(objects)) return [];

        return objects.filter((o: any) => o && o.isPoolInstance === true && o.name);
    }

    /**
     * Sammelt Tasks aus aktiver Stage + Blueprint.
     */
    getAllProjectTasks(): any[] {
        const project = this.context.getProject();
        if (!project) return [];

        const tasks: any[] = [];
        if (project.tasks) tasks.push(...project.tasks);

        // Nur aktive Stage + Blueprint
        for (const stage of this.getRelevantStages()) {
            if (stage.tasks) tasks.push(...stage.tasks);
            // Tasks können auch nur im FlowChart existieren (ohne ActionSequence)
            if (stage.flowCharts) {
                Object.keys(stage.flowCharts).forEach(key => {
                    if (key !== 'global' && !tasks.find(t => t.name === key)) {
                        tasks.push({ name: key });
                    }
                });
            }
        }

        return tasks;
    }

    /**
     * Sammelt Actions aus aktiver Stage + Blueprint.
     */
    getAllProjectActions(): any[] {
        const project = this.context.getProject();
        if (!project) return [];

        const actions: any[] = [];
        if (project.actions) actions.push(...project.actions);

        // Nur aktive Stage + Blueprint
        for (const stage of this.getRelevantStages()) {
            if (stage.actions) actions.push(...stage.actions);
        }

        return actions;
    }

    getAssignedEventsForObject(obj: any): string[] {
        if (!obj) return [];
        const events: string[] = [];

        if (obj.events && typeof obj.events === 'object') {
            Object.keys(obj.events).forEach(evt => {
                // Auch leere Events anzeigen, da der Nutzer wissen will, welche Events am Objekt existieren
                events.push(evt);
            });
        }

        if (obj.Tasks && typeof obj.Tasks === 'object') {
            Object.keys(obj.Tasks).forEach(evt => {
                if (!events.includes(evt)) events.push(evt);
            });
        }

        Object.keys(obj).forEach(key => {
            if (key.startsWith('on') && typeof obj[key] === 'string') {
                if (!events.includes(key)) {
                    events.push(key);
                }
            }
        });

        return events;
    }

    /**
     * Gibt die Task-Namen zurück, die einem Objekt über seine Events zugeordnet sind.
     */
    getTaskNamesForObject(obj: any): string[] {
        if (!obj) return [];
        const taskNames: string[] = [];

        if (obj.events && typeof obj.events === 'object') {
            Object.values(obj.events).forEach((taskName: any) => {
                if (taskName && String(taskName).trim() !== '' && !taskNames.includes(String(taskName))) {
                    taskNames.push(String(taskName));
                }
            });
        }

        if (obj.Tasks && typeof obj.Tasks === 'object') {
            Object.values(obj.Tasks).forEach((taskName: any) => {
                if (taskName && String(taskName).trim() !== '' && !taskNames.includes(String(taskName))) {
                    taskNames.push(String(taskName));
                }
            });
        }

        Object.keys(obj).forEach(key => {
            if (key.startsWith('on') && typeof obj[key] === 'string' && obj[key].trim() !== '') {
                const tn = obj[key];
                if (!taskNames.includes(tn)) {
                    taskNames.push(tn);
                }
            }
        });

        return taskNames;
    }

    /**
     * Gibt die Action-Namen aus der actionSequence eines Tasks zurück.
     */
    getActionNamesForTask(taskName: string): string[] {
        const allTasks = this.getAllProjectTasks();
        const task = allTasks.find((t: any) => t.name === taskName);
        if (!task || !task.actionSequence) return [];

        const actionNames: string[] = [];
        const collectActions = (seq: any[]) => {
            for (const item of seq) {
                if (item.type === 'action' && item.name && !actionNames.includes(item.name)) {
                    actionNames.push(item.name);
                }
                if (item.then) collectActions(item.then);
                if (item.else) collectActions(item.else);
                if (item.body) collectActions(item.body);
            }
        };

        collectActions(task.actionSequence);
        return actionNames;
    }

    getRelevantTasksForCurrentFilters(): string[] {
        const allProjectObjects = this.getAllProjectObjects();
        const objectFilter = this.context.getObjectFilter();
        const eventFilter = this.context.getEventFilter();

        let relevantTaskNames: string[] = [];

        if (objectFilter) {
            const objs = allProjectObjects.filter((o: any) => (o.name || o.id) === objectFilter);
            objs.forEach((obj: any) => {
                if (eventFilter) {
                    if (obj.events && obj.events[eventFilter]) {
                        relevantTaskNames.push(obj.events[eventFilter]);
                    } else if (obj.Tasks && obj.Tasks[eventFilter]) {
                        relevantTaskNames.push(obj.Tasks[eventFilter]);
                    } else if (typeof obj[eventFilter] === 'string') {
                        relevantTaskNames.push(obj[eventFilter]);
                    }
                } else {
                    relevantTaskNames.push(...this.getTaskNamesForObject(obj));
                }
            });
        } else {
            const allTasks = this.getAllProjectTasks();
            relevantTaskNames = allTasks.map((t: any) => t.name);
        }

        return Array.from(new Set(relevantTaskNames.filter(n => n && n.trim() !== ''))).sort();
    }
}
