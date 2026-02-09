import { GameProject, ProjectVariable, GameTask, GameAction } from '../model/types';

import { libraryService } from './LibraryService';
import { TWindow } from '../components/TWindow';

export type ScopedVariable = ProjectVariable & { uiScope?: 'global' | 'stage' | 'local', uiEmoji?: string, usageCount?: number };
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
            .map(v => ({ ...v, uiScope: 'global' as const, uiEmoji: '🌎' }));

        // 2. Stage variables (from active stage)
        if (this.activeStageId && this.project.stages) {
            const activeStage = this.project.stages.find(s => s.id === this.activeStageId);
            if (activeStage && activeStage.variables) {
                const stageVars = activeStage.variables.map(v => ({ ...v, uiScope: 'stage' as const, uiEmoji: '🎭' }));
                visibleVars = [...visibleVars, ...stageVars];
            }

            const scopedProjectVars = this.project.variables
                .filter(v => v.scope === this.activeStageId)
                .map(v => ({ ...v, uiScope: 'stage' as const, uiEmoji: '🎭' }));
            visibleVars = [...visibleVars, ...scopedProjectVars];
        }

        // 3. If inside a Task, include Task variables
        if (context?.taskName) {
            const taskVars = this.project.variables
                .filter(v => v.scope === context.taskName || v.scope === `task:${context.taskName}`)
                .map(v => ({ ...v, uiScope: 'local' as const, uiEmoji: '🎭' }));
            visibleVars = [...visibleVars, ...taskVars];
        }

        // 4. If inside an Action, include Action variables
        if (context?.actionId) {
            const actionVars = this.project.variables
                .filter(v => v.scope === `action:${context.actionId}`)
                .map(v => ({ ...v, uiScope: 'local' as const, uiEmoji: '🎭' }));
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
            'TInputController', 'THandshake', 'THeartbeat', 'TToast', 'TStatusBar',
            'TAPIServer', 'TDataStore'
        ];

        const isService = (obj: any) => (obj as any).isService === true || globalServiceClasses.includes(obj.className);

        const allObjects: TWindow[] = [];
        const objectIds = new Set<string>();

        const activeStage = this.activeStageId ? this.project.stages?.find((s: any) => s.id === this.activeStageId) : null;
        const isBlueprint = activeStage?.type === 'blueprint';

        // 1. Resolve Global Objects/Variables from Root Project Level
        if (isBlueprint) {
            const rootGlobals = [
                ...(this.project.objects || []).filter(obj => (obj as any).scope === 'global'),
                ...(this.project.variables || []).filter(v => (v as any).scope === 'global') as unknown as TWindow[]
            ];
            rootGlobals.forEach(gObj => {
                if (!objectIds.has(gObj.id)) {
                    allObjects.push(gObj);
                    objectIds.add(gObj.id);
                }
            });
        }

        if (this.project.stages && this.project.stages.length > 0) {
            if (activeStage) {
                // Include Stage Objects and Stage Variables
                const stageItems = [
                    ...(activeStage.objects || []),
                    ...(activeStage.variables || []) as unknown as TWindow[]
                ];
                stageItems.forEach((obj: any) => {
                    if (!objectIds.has(obj.id)) {
                        allObjects.push(obj);
                        objectIds.add(obj.id);
                    }
                });
            }

            // 2. Also include Global objects and Service objects from other stages
            this.project.stages.forEach((stage: any) => {
                if (stage.id === this.activeStageId) return;

                const stageGlobals = [
                    ...(stage.objects || []).filter((obj: any) => (obj as any).scope === 'global' || isService(obj)),
                    ...(stage.variables || []).filter((v: any) => (v as any).scope === 'global') as unknown as TWindow[]
                ];

                stageGlobals.forEach((obj: any) => {
                    if (!objectIds.has(obj.id)) {
                        allObjects.push(obj);
                        objectIds.add(obj.id);
                    }
                });
            });

            if (scopeFilter === 'stage-only') {
                const activeStage = this.project.stages.find((s: any) => s.id === this.activeStageId);
                return [
                    ...(activeStage?.objects || []),
                    ...(activeStage?.variables || []) as unknown as TWindow[]
                ];
            }

            return allObjects;
        }

        // Legacy Fallback
        const legacyItems = [
            ...(this.project.objects || []),
            ...(this.project.variables || []) as unknown as TWindow[]
        ];
        return legacyItems;
    }

    public getFlowObjects(): any[] {
        return this.project?.flow?.elements || [];
    }

    public getObjectsWithMetadata(resolveUsage: boolean = true): ScopedObject[] {
        const objects = this.getObjects();
        return objects.map((obj: any) => {
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
                if (!seq || !Array.isArray(seq)) return;
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
                if (!seq || !Array.isArray(seq)) return;
                seq.forEach(item => {
                    if (item.type === 'task' && item.name === name) refs.push(`➡️ Wird aufgerufen von Task: "${task.name}"`);
                    if (item.thenTask === name) refs.push(`➡️ Aufruf (Folge-Task) in: "${task.name}"`);
                    if (item.elseTask === name) refs.push(`➡️ Aufruf (Else-Zweig) in: "${task.name}"`);
                    if (item.resultTask === name) refs.push(`➡️ Aufruf (Ergebnis-Zweig) in: "${task.name}"`);
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
                        const cleanKey = key.replace(/^on/, '');
                        if (isLikelyEvent) {
                            refs.push(`⚡ Gestartet durch Event "${cleanKey}" von ${source}`);
                        } else {
                            refs.push(`🔗 Referenziert in Eigenschaft "${path}${key}" von ${source}`);
                        }
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
                if (!seq || !Array.isArray(seq)) return;
                seq.forEach(item => {
                    if (item.type === 'action' && item.name === name) refs.push(`🎬 Wird ausgeführt von Task: "${task.name}"`);
                    if (item.thenAction === name) refs.push(`🎬 Aufruf (Folge-Aktion) in: "${task.name}"`);
                    if (item.elseAction === name) refs.push(`🎬 Aufruf (Else-Zweig) in: "${task.name}"`);
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
                if (!seq || !Array.isArray(seq)) return;
                seq.forEach(item => {
                    if (varRegex.test(JSON.stringify(item))) refs.push(`📦 Referenziert in Task: "${task.name}"`);
                    if (item.type === 'action') {
                        const action = item as any;
                        if (action.variableName === name || action.resultVariable === name) {
                            refs.push(`📦 Genutzt als Ziel/Quelle in Aktion von Task: "${task.name}"`);
                        }
                    }
                    if (item.condition && (item.condition.variable === name)) {
                        refs.push(`📦 Genutzt in Bedingung von Task: "${task.name}"`);
                    }
                    if (item.body) scanSeq(item.body);
                });
            };
            scanSeq(task.actionSequence);
        });

        this.getAllObjectsWithSource().forEach(({ obj, source }) => {
            if (varRegex.test(JSON.stringify(obj))) refs.push(`🔗 Gebunden an Objekt "${obj.name}" (${source})`);
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

    /**
     * Performs a project-wide Static Deep-Scan analysis to find all logically reachable
     * Tasks, Actions, and Variables.
     */
    public getLogicalUsage(): { tasks: Set<string>, actions: Set<string>, variables: Set<string> } {
        if (!this.project) return { tasks: new Set(), actions: new Set(), variables: new Set() };
        const proj = this.project;

        const usedTasks = new Set<string>();
        const usedActions = new Set<string>();
        const usedVariables = new Set<string>();

        console.log(`[LogicalUsage] Starting Static Deep-Scan for Project: ${proj.meta.name}`);

        // 1. Inventory: Get all existing names
        const allTasks = this.getTasks('all', false).map(t => t.name.trim());
        const allActions = this.getActions('all', false).map(a => a.name.trim());
        const allVars: string[] = [];

        // Collect variable names (global + stage)
        (proj.variables || []).forEach(v => { if (v.name) allVars.push(v.name.trim()); });
        proj.stages?.forEach(s => {
            (s.variables || []).forEach(v => { if (v.name) allVars.push(v.name.trim()); });
            (s.objects || []).forEach((obj: any) => {
                if ((obj.isVariable || obj.type === 'TVariable' || obj.type === 'TTimer' || obj.type === 'TWindow') && obj.name) {
                    const trimmed = obj.name.trim();
                    if (!allVars.includes(trimmed)) allVars.push(trimmed);
                }
            });
        });

        console.log(`[LogicalUsage] Inventory: ${allTasks.length} Tasks, ${allActions.length} Actions, ${allVars.length} Variables`);

        // 2. Deep Walk: Scan entire project structure
        // We use a Set of definition objects to correctly ignore their own .name properties
        const definitionObjects = new Set<any>();
        proj.tasks?.forEach(t => definitionObjects.add(t));
        proj.actions?.forEach(a => definitionObjects.add(a));
        proj.variables?.forEach(v => definitionObjects.add(v));
        proj.stages?.forEach(s => {
            s.tasks?.forEach((t: any) => definitionObjects.add(t));
            s.actions?.forEach((a: any) => definitionObjects.add(a));
            s.variables?.forEach((v: any) => definitionObjects.add(v));
            s.objects?.forEach((o: any) => {
                if (o.isVariable || o.type === 'TVariable' || o.type === 'TTimer' || o.type === 'TWindow') {
                    definitionObjects.add(o);
                }
            });
        });

        const scanValue = (val: any, path: string = '', parentObj: any = null) => {
            if (val === null || val === undefined) return;

            if (typeof val === 'string') {
                const trimmed = val.trim();

                const key = path.split('.').pop() || '';

                // IGNORE: If this string is the NAME of its parent definition object
                // we don't want to count the definition itself as usage.
                if ((key === 'name' || key === 'taskName') && definitionObjects.has(parentObj)) {
                    return;
                }

                // Check for Task usage
                if (allTasks.includes(trimmed)) {
                    if (!usedTasks.has(trimmed)) {
                        console.log(`  [Logic-Usage] Found Task: "${trimmed}" at ${path}`);
                        usedTasks.add(trimmed);
                    }
                }
                // Check for Action usage
                else if (allActions.includes(trimmed)) {
                    if (!usedActions.has(trimmed)) {
                        console.log(`  [Logic-Usage] Found Action: "${trimmed}" at ${path}`);
                        usedActions.add(trimmed);
                    }
                }
                // Check for Variable usage (Whole string)
                else if (allVars.includes(trimmed)) {
                    if (!usedVariables.has(trimmed)) {
                        console.log(`  [Logic-Usage] Found Variable: "${trimmed}" at ${path}`);
                        usedVariables.add(trimmed);
                    }
                }

                // Check for Template Refs ${varName}
                if (trimmed.includes('${')) {
                    const regex = /\$\{([^}.]+)[}.]/g;
                    let match;
                    while ((match = regex.exec(trimmed)) !== null) {
                        const varName = match[1].trim();
                        if (allVars.includes(varName) && !usedVariables.has(varName)) {
                            // console.log(`  [Found] Template usage: "${varName}" in ${trimmed} at ${path}`);
                            usedVariables.add(varName);
                        }
                    }
                }
                return;
            }

            if (Array.isArray(val)) {
                val.forEach((item, i) => scanValue(item, `${path}[${i}]`, val));
                return;
            }

            if (typeof val === 'object') {
                Object.entries(val).forEach(([k, subVal]) => {
                    scanValue(subVal, path ? `${path}.${k}` : k, val);
                });
            }
        };

        // Start scanning at project root
        scanValue(proj);

        console.log(`[LogicalUsage] Finished. Marked as used: ${usedTasks.size} Tasks, ${usedActions.size} Actions, ${usedVariables.size} Variables.`);
        return { tasks: usedTasks, actions: usedActions, variables: usedVariables };
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
