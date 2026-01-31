import { GameProject, ProjectVariable, GameTask, GameAction } from '../model/types';

import { libraryService } from './LibraryService';
import { TWindow } from '../components/TWindow';

export type ScopedVariable = ProjectVariable & { uiScope?: 'global' | 'stage' | 'local', usageCount?: number };
export type ScopedTask = GameTask & { uiScope?: 'global' | 'stage' | 'library', usageCount?: number };
export type ScopedAction = GameAction & { uiScope?: 'global' | 'stage' | 'library', usageCount?: number };
export type ScopedObject = TWindow & { uiScope?: 'global' | 'stage', usageCount?: number };

export type VariableScopeContext = {
    taskName?: string;
    actionId?: string;
};

export class ProjectRegistry {
    private static instance: ProjectRegistry;
    private project: GameProject | null = null;

    private constructor() { }

    public static getInstance(): ProjectRegistry {
        if (!ProjectRegistry.instance) {
            ProjectRegistry.instance = new ProjectRegistry();
        }
        return ProjectRegistry.instance;
    }

    public setProject(project: GameProject) {
        this.project = project;
    }

    public getProject(): GameProject | null {
        return this.project;
    }

    // =========================================================================================
    //  Variables
    // =========================================================================================

    /**
     * Retrieves variables visible in a specific context.
     * Hierarchy: Global > Stage (if active) > Task (if in task) > Action (if in action)
     */
    public getVariables(context?: VariableScopeContext, resolveUsage: boolean = true, scopeFilter?: 'stage-only' | 'all'): ScopedVariable[] {
        if (!this.project) return [];

        let visibleVars: ScopedVariable[] = [];

        // 1. Global variables
        visibleVars = this.project.variables
            .filter(v => !v.scope || String(v.scope).toLowerCase() === 'global')
            .map(v => ({ ...v, uiScope: 'global' as const }));

        // 2. Stage variables (from active stage)
        if (this.activeStageId && this.project.stages) {
            const activeStage = this.project.stages.find(s => s.id === this.activeStageId);
            if (activeStage && activeStage.variables) {
                const stageVars = activeStage.variables.map(v => ({ ...v, uiScope: 'stage' as const }));
                visibleVars = [...visibleVars, ...stageVars];
            }

            const scopedProjectVars = this.project.variables
                .filter(v => v.scope === this.activeStageId)
                .map(v => ({ ...v, uiScope: 'stage' as const }));
            visibleVars = [...visibleVars, ...scopedProjectVars];
        }

        // 3. If inside a Task, include Task variables
        if (context?.taskName) {
            const taskVars = this.project.variables
                .filter(v => v.scope === context.taskName || v.scope === `task:${context.taskName}`)
                .map(v => ({ ...v, uiScope: 'local' as const }));
            visibleVars = [...visibleVars, ...taskVars];
        }

        // 4. If inside an Action, include Action variables
        if (context?.actionId) {
            const actionVars = this.project.variables
                .filter(v => v.scope === `action:${context.actionId}`)
                .map(v => ({ ...v, uiScope: 'local' as const }));
            visibleVars = [...visibleVars, ...actionVars];
        }

        // 5. Apply scope filter if requested
        if (scopeFilter === 'stage-only') {
            // Only keep stage/local variables
            visibleVars = visibleVars.filter(v => v.uiScope === 'stage' || v.uiScope === 'local');
        }

        // Optimization: Return without usage calculation if not requested
        if (!resolveUsage) return visibleVars as ScopedVariable[];

        const vars = visibleVars.map(v => ({
            ...v,
            usageCount: this.getVariableUsage(v.name).length
        }));
        return vars as ScopedVariable[];
    }

    public validateVariableName(name: string, context?: VariableScopeContext): { valid: boolean; error?: string } {
        // Rule 1: CamelCase (start with lowercase)
        if (!/^[a-z][a-zA-Z0-9]*$/.test(name)) {
            return { valid: false, error: 'Variablen müssen mit einem Kleinbuchstaben beginnen (camelCase).' };
        }

        // Rule 2: Uniqueness in visible scope
        const visibleVars = this.getVariables(context);
        if (visibleVars.some(v => v.name === name)) {
            return { valid: false, error: 'Name bereits vergeben.' };
        }

        return { valid: true };
    }

    // =========================================================================================
    //  Tasks
    // =========================================================================================

    /**
     * Gets tasks. By default returns Global + Active Stage tasks.
     * Set stageId to 'all' to get everything.
     */
    public getTasks(stageId: string | 'all' | 'active' = 'active', resolveUsage: boolean = true): ScopedTask[] {
        if (!this.project) return [];

        // 1. Global tasks
        const globalTasks = (this.project.tasks || []).map(t => ({ ...t, uiScope: 'global' as const }));

        // 2. Library tasks
        const libTasks = libraryService.getTasks().map(t => ({ ...t, uiScope: 'library' as const }));

        if (stageId === 'all') {
            let allTasks = [...globalTasks, ...libTasks];
            if (this.project.stages) {
                this.project.stages.forEach(stage => {
                    if (stage.tasks) {
                        allTasks = [...allTasks, ...stage.tasks.map(t => ({ ...t, uiScope: 'stage' as const }))];
                    }
                });
            }
            return allTasks.map(t => ({ ...t, usageCount: resolveUsage ? this.getTaskUsage(t.name).length : 0 }));
        }

        const targetStageId = stageId === 'active' ? this.activeStageId : stageId;
        if (targetStageId && this.project.stages) {
            const stage = this.project.stages.find(s => s.id === targetStageId);
            if (stage && stage.tasks) {
                const stageTasks = stage.tasks.map(t => ({ ...t, uiScope: 'stage' as const }));
                return [...globalTasks, ...stageTasks, ...libTasks].map(t => ({ ...t, usageCount: resolveUsage ? this.getTaskUsage(t.name).length : 0 }));
            }
        }

        return [...globalTasks, ...libTasks].map(t => ({ ...t, usageCount: resolveUsage ? this.getTaskUsage(t.name).length : 0 }));
    }

    public validateTaskName(name: string): { valid: boolean; error?: string } {
        // Rule: PascalCase (start with uppercase)
        if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
            return { valid: false, error: 'Tasks müssen mit einem Großbuchstaben beginnen (PascalCase).' };
        }

        // Rule: Unique across all tasks (Global and ALL Stages)
        if (this.getTasks().some(t => t.name === name)) {
            return { valid: false, error: 'Task-Name bereits vergeben (global oder in einer Stage).' };
        }

        return { valid: true };
    }

    // =========================================================================================
    //  Actions
    // =========================================================================================

    /**
     * Gets actions. By default returns Global + Active Stage actions.
     */
    public getActions(stageId: string | 'all' | 'active' = 'active', resolveUsage: boolean = true): ScopedAction[] {
        if (!this.project) return [];

        // 1. Global actions
        const globalActions: ScopedAction[] = (this.project.actions || []).map(a => ({ ...a, uiScope: 'global' as const }));

        if (stageId === 'all') {
            let allActions = [...globalActions];
            if (this.project.stages) {
                this.project.stages.forEach(stage => {
                    if (stage.actions) {
                        allActions = [...allActions, ...stage.actions.map(a => ({ ...a, uiScope: 'stage' as const }))];
                    }
                });
            }
            return allActions.map(a => ({ ...a, usageCount: resolveUsage ? this.getActionUsage(a.name).length : 0 }));
        }

        const targetStageId = stageId === 'active' ? this.activeStageId : stageId;
        if (targetStageId && this.project.stages) {
            const stage = this.project.stages.find(s => s.id === targetStageId);
            if (stage && stage.actions) {
                const stageActions: ScopedAction[] = stage.actions.map(a => ({ ...a, uiScope: 'stage' as const }));
                return [...globalActions, ...stageActions].map(a => ({ ...a, usageCount: resolveUsage ? this.getActionUsage(a.name).length : 0 }));
            }
        }

        return globalActions.map(a => ({
            ...a,
            uiScope: 'global',
            usageCount: resolveUsage ? this.getActionUsage(a.name).length : 0
        }));
    }

    // =========================================================================================
    //  Objects (Stage)
    // =========================================================================================

    private activeStageId: string | null = null;

    public setActiveStageId(id: string | null): void {
        this.activeStageId = id;
    }

    public getActiveStageId(): string | null {
        return this.activeStageId;
    }

    public getObjects(scopeFilter?: 'stage-only' | 'all'): TWindow[] {
        if (!this.project) return [];

        const globalServiceClasses = [
            'TStageController', 'TGameLoop', 'TGameState', 'TGameServer',
            'TInputController', 'THandshake', 'THeartbeat', 'TToast', 'TStatusBar'
        ];

        if (this.project.stages && this.project.stages.length > 0) {
            const allObjects: TWindow[] = [];
            const objectIds = new Set<string>();

            if (this.activeStageId) {
                const activeStage = this.project.stages.find((s: any) => s.id === this.activeStageId);
                if (activeStage && activeStage.objects) {
                    activeStage.objects.forEach((obj: any) => {
                        allObjects.push(obj);
                        objectIds.add(obj.id);
                    });
                }
            }

            this.project.stages.forEach((stage: any) => {
                if (stage.objects && Array.isArray(stage.objects)) {
                    stage.objects.forEach((obj: any) => {
                        if (globalServiceClasses.includes(obj.className) && !objectIds.has(obj.id)) {
                            allObjects.push(obj);
                            objectIds.add(obj.id);
                        }
                    });
                }
            });

            if (scopeFilter === 'stage-only') {
                const activeStage = this.project.stages.find((s: any) => s.id === this.activeStageId);
                return activeStage?.objects || [];
            }

            return allObjects;
        }

        return this.project.objects || [];
    }

    public getFlowObjects(): any[] {
        return this.project?.flow?.elements || [];
    }

    public getObjectsWithMetadata(resolveUsage: boolean = true): ScopedObject[] {
        const objects = this.getObjects();
        return objects.map(obj => {
            const usage = resolveUsage ? this.getObjectUsage(obj.name) : [];
            const isGlobal = this.project?.objects.some(o => o.name === obj.name);
            const scopedObj = { ...obj } as ScopedObject;
            scopedObj.uiScope = isGlobal ? ('global' as const) : ('stage' as const);
            scopedObj.usageCount = usage.length;
            return scopedObj;
        });
    }

    public validateObjectName(name: string): { valid: boolean; error?: string } {
        if (!/^[A-Z][a-zA-Z0-9_]*$/.test(name)) {
            return { valid: false, error: 'Objekt-Namen müssen mit einem Großbuchstaben beginnen.' };
        }

        const objects = this.getObjects();
        if (objects.some(o => o.name === name)) {
            return { valid: false, error: 'Objekt-Name existiert bereits auf der Stage.' };
        }

        const checkFlows = (charts: any) => {
            if (!charts) return false;
            return Object.values(charts).some((chart: any) =>
                chart.elements && chart.elements.some((e: any) => e.name === name)
            );
        };

        if (checkFlows(this.project!.flowCharts)) {
            return { valid: false, error: 'Objekt-Name wird bereits im Flow verwendet.' };
        }

        if (this.project!.stages) {
            for (const stage of this.project!.stages) {
                if (checkFlows(stage.flowCharts)) {
                    return { valid: false, error: `Objekt-Name wird bereits im Flow der Stage '${stage.name}' verwendet.` };
                }
            }
        }

        return { valid: true };
    }

    // =========================================================================================
    //  Reference Tracking
    // =========================================================================================

    public findReferences(name: string): string[] {
        const refs: string[] = [];
        if (!this.project) return refs;

        const taskRefs = this.getTaskUsage(name);
        const actionRefs = this.getActionUsage(name);
        const varRefs = this.getVariableUsage(name);
        const objRefs = this.getObjectUsage(name);

        return [...taskRefs, ...actionRefs, ...varRefs, ...objRefs].filter((v, i, a) => a.indexOf(v) === i);
    }

    public getObjectUsage(name: string): string[] {
        const refs: string[] = [];
        if (!this.project) return refs;

        this.getActions('all', false).forEach(action => {
            if (action.target === name) refs.push(`Aktion: ${action.name} -> Target ist Objekt: ${name}`);
            if (action.source === name) refs.push(`Aktion: ${action.name} -> Source ist Objekt: ${name}`);
            if (action.changes) {
                const str = JSON.stringify(action.changes);
                if (str.includes(`\${${name}.`)) refs.push(`Aktion: ${action.name} -> Referenziert Objekt: ${name}`);
            }
        });

        const checkInput = (input: any, source: string) => {
            if (input.player1Target === name) refs.push(`${source} -> Player 1 Target ist: ${name}`);
            if (input.player2Target === name) refs.push(`${source} -> Player 2 Target ist: ${name}`);
        };

        if (this.project.input) checkInput(this.project.input, 'Global Input');
        this.project.stages?.forEach(stage => {
            if (stage.input) checkInput(stage.input, `Stage: ${stage.name} Input`);
        });

        const objRegex = new RegExp(`\\$\\{${name}\\.`, 'g');
        this.getTasks('all', false).forEach(task => {
            const str = JSON.stringify(task.actionSequence);
            if (objRegex.test(str)) refs.push(`Task: ${task.name} -> Referenziert Objekt: ${name}`);
        });

        this.getAllObjectsWithSource().forEach(({ obj, source }) => {
            const str = JSON.stringify(obj);
            if (objRegex.test(str)) refs.push(`${source} Objekt: ${obj.name} -> Binding auf Objekt: ${name}`);
        });

        return refs;
    }

    public getAllReferencedTaskNames(): Set<string> {
        const referenced = new Set<string>();
        if (!this.project) return referenced;

        this.getTasks('all', false).forEach(task => {
            const scanSeq = (seq: any[]) => {
                if (!seq) return;
                seq.forEach(item => {
                    if (item.type === 'task' && item.name) referenced.add(item.name);
                    if (item.thenTask) referenced.add(item.thenTask);
                    if (item.elseTask) referenced.add(item.elseTask);
                    if (item.body) scanSeq(item.body);
                });
            };
            scanSeq(task.actionSequence);
        });

        const allPotentialHolders: any[] = [];
        this.getAllObjectsWithSource().forEach(({ obj }) => allPotentialHolders.push(obj));
        if (this.project.variables) this.project.variables.forEach(v => allPotentialHolders.push(v));
        if (this.project.stages) {
            this.project.stages.forEach(s => {
                if (s.variables) s.variables.forEach(v => allPotentialHolders.push(v));
            });
        }

        allPotentialHolders.forEach(item => {
            const checkProps = (target: any) => {
                if (!target || typeof target !== 'object') return;
                Object.entries(target).forEach(([key, val]) => {
                    if (typeof val === 'string' && (key.startsWith('on') || key === 'onChange' || key === 'onValueTrue' || key === 'onValueFalse')) {
                        referenced.add(val);
                    }
                    if (key === 'Tasks' || key === 'events' || key === 'properties') checkProps(val);
                });
            };
            checkProps(item);
        });

        return referenced;
    }

    public getTaskUsage(name: string): string[] {
        const refs: string[] = [];
        if (!this.project) return refs;

        this.getTasks('all', false).forEach(task => {
            if (task.name === name) return;
            const scanSeq = (seq: any[]) => {
                if (!seq) return;
                seq.forEach(item => {
                    if (item.type === 'task' && item.name === name) refs.push(`Task: ${task.name} -> Task-Aufruf`);
                    if (item.thenTask === name) refs.push(`Task: ${task.name} -> Then-Task`);
                    if (item.elseTask === name) refs.push(`Task: ${task.name} -> Else-Task`);
                    if (item.body) scanSeq(item.body);
                });
            };
            scanSeq(task.actionSequence);
        });

        const allPotentialHolders: { item: any, source: string }[] = [];
        this.getAllObjectsWithSource().forEach(({ obj, source }) => {
            allPotentialHolders.push({ item: obj, source: `Objekt: ${obj.name} (${source})` });
        });

        if (this.project.variables) this.project.variables.forEach(v => allPotentialHolders.push({ item: v, source: `Glb-Variable: ${v.name}` }));
        if (this.project.stages) {
            this.project.stages.forEach(s => {
                if (s.variables) s.variables.forEach(v => allPotentialHolders.push({ item: v, source: `Stage-Variable: ${v.name} (${s.name || s.id})` }));
            });
        }

        allPotentialHolders.forEach(({ item, source }) => {
            const checkProps = (target: any, path: string = '') => {
                if (!target || typeof target !== 'object') return;
                Object.entries(target).forEach(([key, val]) => {
                    if (val === name) {
                        const isLikelyEvent = key.startsWith('on') || key === 'onValueTrue' || key === 'onValueFalse' || key === 'onChange';
                        refs.push(`${source} -> ${isLikelyEvent ? 'Event' : 'Property'}: ${path}${key}`);
                    }
                    if (key === 'Tasks' || key === 'events' || key === 'properties') checkProps(val, `${key}.`);
                });
            };
            checkProps(item);
        });

        return refs;
    }

    public getActionUsage(name: string): string[] {
        // console.log(`  [ProjectRegistry] getActionUsage('${name}')`);
        const refs: string[] = [];
        if (!this.project) return refs;

        this.getTasks('all', false).forEach(task => {
            const scanSeq = (seq: any[]) => {
                if (!seq) return;
                seq.forEach(item => {
                    if (item.type === 'action' && item.name === name) refs.push(`Task: ${task.name} -> Verwendet Aktion: ${name}`);
                    if (item.thenAction === name) refs.push(`Task: ${task.name} -> Condition (Then): ${name}`);
                    if (item.elseAction === name) refs.push(`Task: ${task.name} -> Condition (Else): ${name}`);
                    if (item.body) scanSeq(item.body);
                });
            };
            scanSeq(task.actionSequence);
        });

        return refs;
    }

    public getVariableUsage(name: string): string[] {
        // console.log(`  [ProjectRegistry] getVariableUsage('${name}')`);
        const refs: string[] = [];
        if (!this.project) return refs;

        const varRegex = new RegExp(`\\$\\{${name}([.}]|$)`);
        this.getTasks('all', false).forEach(task => {
            const scanSeq = (seq: any[]) => {
                if (!seq) return;
                seq.forEach(item => {
                    if (varRegex.test(JSON.stringify(item))) refs.push(`Task: ${task.name} -> Referenziert Variable: ${name}`);
                    if (item.type === 'action') {
                        const action = item as any;
                        if (action.variableName === name || action.resultVariable === name) refs.push(`Task: ${task.name} -> Aktion nutzt Variable: ${name}`);
                    }
                    if (item.condition && (item.condition.variable === name)) refs.push(`Task: ${task.name} -> Bedingung nutzt Variable: ${name}`);
                    if (item.body) scanSeq(item.body);
                });
            };
            scanSeq(task.actionSequence);
        });

        this.getAllObjectsWithSource().forEach(({ obj, source }) => {
            if (varRegex.test(JSON.stringify(obj))) refs.push(`${source} Objekt: ${obj.name} -> Binding auf Variable: ${name}`);
        });

        return refs;
    }

    private getAllObjectsWithSource(): { obj: any, source: string }[] {
        const results: { obj: any, source: string }[] = [];
        if (!this.project) return results;
        (this.project.objects || []).forEach(obj => results.push({ obj, source: 'Global' }));
        if (this.project.stages) {
            this.project.stages.forEach(s => {
                (s.objects || []).forEach((obj: any) => results.push({ obj, source: `Stage: ${s.name || s.id}` }));
            });
        }
        return results;
    }

    public renameVariable(oldName: string, newName: string): boolean {
        if (!this.project || !this.validateVariableName(newName).valid) return false;
        const variable = this.project.variables.find(v => v.name === oldName);
        if (variable) { variable.name = newName; } else { return false; }
        this.updateReferencesInProperties(oldName, newName);
        this.updateReferencesInActions(oldName, newName);
        return true;
    }

    public renameTask(oldName: string, newName: string): boolean {
        if (!this.project || !this.validateTaskName(newName).valid) return false;
        let task = this.getTasks().find(t => t.name === oldName);
        if (task) { task.name = newName; } else { return false; }

        this.getTasks().forEach(t => {
            if (t.actionSequence) {
                t.actionSequence.forEach(item => {
                    if (item.type === 'task' && item.name === oldName) item.name = newName;
                    if (item.thenTask === oldName) item.thenTask = newName;
                    if (item.elseTask === oldName) item.elseTask = newName;
                });
            }
        });

        this.getAllObjectsWithSource().forEach(({ obj }) => {
            if (obj.Tasks) {
                Object.keys(obj.Tasks).forEach(key => { if (obj.Tasks[key] === oldName) obj.Tasks[key] = newName; });
            }
        });

        if (this.project.flowCharts && this.project.flowCharts[oldName]) {
            this.project.flowCharts[newName] = this.project.flowCharts[oldName];
            delete this.project.flowCharts[oldName];
        }
        if (this.project.stages) {
            this.project.stages.forEach(stage => {
                if (stage.flowCharts && stage.flowCharts[oldName]) {
                    stage.flowCharts[newName] = stage.flowCharts[oldName];
                    delete stage.flowCharts[oldName];
                }
            });
        }
        return true;
    }

    public deleteTask(name: string): boolean {
        if (!this.project) return false;
        const task = this.getTasks().find(t => t.name === name);
        if (!task) return false;

        const actionsToCleanup = (task.actionSequence || []).filter(item => item.type === 'action').map(item => item.name!);
        this.project.tasks = this.project.tasks.filter(t => t.name !== name);
        if (this.project.stages) {
            this.project.stages.forEach(s => {
                if (s.tasks) s.tasks = s.tasks.filter((t: any) => t.name !== name);
                if (s.flowCharts && s.flowCharts[name]) delete s.flowCharts[name];
            });
        }
        if (this.project.flowCharts && this.project.flowCharts[name]) delete this.project.flowCharts[name];

        actionsToCleanup.forEach(actionName => {
            if (this.getActionUsage(actionName).length === 0) this.deleteAction(actionName);
        });

        this.getTasks().forEach(t => {
            if (t.actionSequence) {
                t.actionSequence.forEach(item => {
                    if (item.type === 'task' && item.name === name) item.name = '';
                    if (item.thenTask === name) item.thenTask = '';
                    if (item.elseTask === name) item.elseTask = '';
                });
            }
        });

        this.getAllObjectsWithSource().forEach(({ obj }) => {
            if (obj.Tasks) {
                Object.keys(obj.Tasks).forEach(evt => { if (obj.Tasks[evt] === name) delete obj.Tasks[evt]; });
            }
        });

        return true;
    }

    public deleteAction(name: string): boolean {
        if (!this.project) return false;
        this.project.actions = this.project.actions.filter(a => a.name !== name);
        if (this.project.stages) {
            this.project.stages.forEach(s => { if (s.actions) s.actions = s.actions.filter((a: any) => a.name !== name); });
        }
        return true;
    }

    public getNextSmartActionName(action: any): string {
        const target = (action.target || 'global').replace(/[^a-zA-Z0-9]/g, '');
        let propPart = 'action';
        if (action.changes) {
            const keys = Object.keys(action.changes);
            if (keys.length > 0) {
                const firstKey = keys[0];
                const val = action.changes[firstKey];
                let valStr = String(val).replace(/[^a-zA-Z0-9]/g, '');
                if (valStr.length > 8) valStr = valStr.substring(0, 8);
                propPart = `${firstKey}_${valStr}`;
            }
        }
        const baseName = `${target}_${propPart}`;
        let finalName = baseName, counter = 1;
        const allActionNames = new Set(this.getActions().map(a => a.name));
        while (allActionNames.has(finalName)) { finalName = `${baseName}_${counter++}`; }
        return finalName;
    }

    public renameAction(oldName: string, newName: string): boolean {
        if (!this.project) return false;
        let action = this.project.actions.find((a: any) => a.name === oldName);
        if (!action && this.project.stages) {
            for (const stage of this.project.stages) {
                if (stage.actions) {
                    action = stage.actions.find((a: any) => a.name === oldName);
                    if (action) break;
                }
            }
        }
        if (action) { action.name = newName; } else { return false; }

        this.getTasks().forEach(t => {
            if (t.actionSequence) {
                t.actionSequence.forEach(item => {
                    if (item.type === 'action' && item.name === oldName) item.name = newName;
                    if (item.thenAction === oldName) item.thenAction = newName;
                    if (item.elseAction === oldName) item.elseAction = newName;
                });
            }
        });
        return true;
    }

    private updateReferencesInProperties(oldName: string, newName: string) {
        const regex = new RegExp(`\\$\\{${oldName}\\}`, 'g');
        const regexNested = new RegExp(`\\$\\{${oldName}\\.`, 'g');
        const replaceInString = (str: string) => str.replace(regex, `\${${newName}}`).replace(regexNested, `\${${newName}.`);

        const traverseAndReplace = (obj: any) => {
            if (!obj || typeof obj !== 'object') return;
            Object.keys(obj).forEach(key => {
                const val = obj[key];
                if (typeof val === 'string') { obj[key] = replaceInString(val); }
                else if (typeof val === 'object') { traverseAndReplace(val); }
            });
        };

        const allObjects = [...(this.project!.objects || [])];
        if (this.project!.stages) this.project!.stages.forEach(s => { if (s.objects) allObjects.push(...s.objects); });
        allObjects.forEach(obj => traverseAndReplace(obj));
        this.project!.actions.forEach(act => traverseAndReplace(act));
        if (this.project!.stages) this.project!.stages.forEach(stage => { if (stage.actions) stage.actions.forEach(act => traverseAndReplace(act)); });
        this.getTasks().forEach(t => traverseAndReplace(t));
    }

    private updateReferencesInActions(oldName: string, newName: string) {
        this.project!.tasks.forEach(task => {
            task.actionSequence.forEach(item => {
                if (item.type === 'action') {
                    const action = item as any;
                    if (action.variableName === oldName) action.variableName = newName;
                    if (action.resultVariable === oldName) action.resultVariable = newName;
                    if (action.calcSteps) action.calcSteps.forEach((step: any) => { if (step.operandType === 'variable' && step.variable === oldName) step.variable = newName; });
                } else if (item.type === 'condition' || item.type === 'while') {
                    if (item.condition && item.condition.variable === oldName) item.condition.variable = newName;
                }
            });
        });
    }
}

export const projectRegistry = ProjectRegistry.getInstance();
