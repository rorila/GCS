import { GameProject, ProjectVariable, GameTask } from '../model/types';
import { TWindow } from '../components/TWindow';

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

    // =========================================================================================
    //  Variables
    // =========================================================================================

    /**
     * Retrieves variables visible in a specific context.
     * Hierarchy: Global > Task (if in task) > Action (if in action)
     */
    public getVariables(context?: VariableScopeContext): ProjectVariable[] {
        if (!this.project) return [];

        // 1. Always include Global variables
        let visibleVars = this.project.variables.filter(v =>
            !v.scope || v.scope.toLowerCase() === 'global'
        );

        // 2. If inside a Task, include Task variables
        if (context?.taskName) {
            const taskVars = this.project.variables.filter(v =>
                v.scope === `task:${context.taskName}`
            );
            visibleVars = [...visibleVars, ...taskVars];
        }

        // 3. If inside an Action, include Action variables
        if (context?.actionId) {
            const actionVars = this.project.variables.filter(v =>
                v.scope === `action:${context.actionId}`
            );
            visibleVars = [...visibleVars, ...actionVars];
        }

        return visibleVars;
    }

    public validateVariableName(name: string, context?: VariableScopeContext): { valid: boolean; error?: string } {
        // Rule 1: CamelCase (start with lowercase)
        if (!/^[a-z][a-zA-Z0-9]*$/.test(name)) {
            return { valid: false, error: 'Variablen müssen mit einem Kleinbuchstaben beginnen (camelCase).' };
        }

        // Rule 2: Uniqueness in visible scope
        // Note: Shadowing global variables might be allowed in some langs, but here we enforce uniqueness to avoid confusion?
        // Let's enforce global uniqueness for simplicity for now, or at least check against conflicts.
        // Actually, user wants scope rules. Shadowing is typically tricky. 
        // Let's check if name already exists in the *same* scope.
        // And maybe warn if it shadows an outer scope.

        const visibleVars = this.getVariables(context);
        if (visibleVars.some(v => v.name === name)) {
            return { valid: false, error: 'Name bereits vergeben.' };
        }

        return { valid: true };
    }

    // =========================================================================================
    //  Tasks
    // =========================================================================================

    public getTasks(): GameTask[] {
        return this.project?.tasks || [];
    }

    public validateTaskName(name: string): { valid: boolean; error?: string } {
        // Rule: PascalCase (start with uppercase)
        if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
            return { valid: false, error: 'Tasks müssen mit einem Großbuchstaben beginnen (PascalCase).' };
        }

        // Rule: Unique across all tasks
        if (this.project?.tasks.some(t => t.name === name)) {
            return { valid: false, error: 'Task-Name bereits vergeben.' };
        }

        return { valid: true };
    }

    // =========================================================================================
    //  Actions
    // =========================================================================================

    public getActions(): any[] {
        return this.project?.actions || [];
    }

    // =========================================================================================
    //  Objects (Stage)
    // =========================================================================================

    private activeStageId: string | null = null;

    /**
     * Set the active stage ID to filter getObjects() results.
     * If null, returns objects from all stages.
     */
    public setActiveStageId(id: string | null): void {
        this.activeStageId = id;
    }

    public getActiveStageId(): string | null {
        return this.activeStageId;
    }

    /**
     * Returns objects for the current context:
     * - If activeStageId is set, returns objects from that stage PLUS global services from all stages
     * - Otherwise, returns all objects from all stages (plus legacy project.objects)
     */
    public getObjects(): TWindow[] {
        if (!this.project) return [];

        // Global service components (visible across all stages)
        const globalServiceClasses = [
            'TStageController',
            'TGameLoop',
            'TGameState',
            'TGameServer',
            'TInputController',
            'THandshake',
            'THeartbeat',
            'TToast',
            'TStatusBar'
        ];

        // If using multi-stage architecture
        if (this.project.stages && this.project.stages.length > 0) {
            // Context-aware collection
            const allObjects: TWindow[] = [];
            const objectIds = new Set<string>();

            // 1. Add objects from active stage (if set)
            if (this.activeStageId) {
                const activeStage = this.project.stages.find((s: any) => s.id === this.activeStageId);
                if (activeStage && activeStage.objects) {
                    activeStage.objects.forEach((obj: any) => {
                        allObjects.push(obj);
                        objectIds.add(obj.id);
                    });
                }
            }

            // 2. Add global services from ALL stages (even if not on active stage)
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

            // If no stage was active, we return everything (old behavior + global filter not needed since ID set handles it)
            if (!this.activeStageId) {
                return allObjects;
            }

            return allObjects;
        }

        // Legacy fallback: use project.objects directly
        return this.project.objects || [];
    }

    public getFlowObjects(): any[] {
        return this.project?.flow?.elements || [];
    }

    public validateObjectName(name: string): { valid: boolean; error?: string } {
        // Rule: PascalCase
        if (!/^[A-Z][a-zA-Z0-9_]*$/.test(name)) { // Allow underscores for generated names like Button_1
            return { valid: false, error: 'Objekt-Namen müssen mit einem Großbuchstaben beginnen.' };
        }

        // Rule: Unique across Stage Objects AND Flow Objects
        // Use getObjects() to get the correct object list
        const objects = this.getObjects();
        if (objects.some(o => o.name === name)) {
            return { valid: false, error: 'Objekt-Name existiert bereits auf der Stage.' };
        }
        if (this.project?.flow?.elements.some(e => e.name === name)) {
            return { valid: false, error: 'Objekt-Name existiert bereits im Flow.' };
        }

        return { valid: true };
    }

    // =========================================================================================
    //  Reference Tracking
    // =========================================================================================

    public findReferences(name: string): string[] {
        const refs: string[] = [];
        if (!this.project) return refs;

        // 1. Search in Task Sequences (for Action calls and Task calls)
        const validTaskNames = new Set((this.project.tasks || []).map(t => t.name));

        (this.project.tasks || []).forEach(task => {
            const scanSeq = (seq: any[]) => {
                if (!seq) return;
                seq.forEach(item => {
                    // Direct Action/Task call
                    if ((item.type === 'action' || item.type === 'task') && item.name === name) {
                        // Skip self-reference if searching for a task's references within itself
                        if (!(item.type === 'task' && item.name === task.name && name === task.name)) {
                            refs.push(`Task: ${task.name} -> ${item.type === 'action' ? 'Aktion' : 'Task'}: ${item.name}`);
                        }
                    }
                    // Condition branches
                    if (item.type === 'condition' || item.type === 'while') {
                        if (item.thenAction === name) refs.push(`Task: ${task.name} -> Condition (Then): ${name}`);
                        if (item.elseAction === name) refs.push(`Task: ${task.name} -> Condition (Else): ${name}`);
                        if (item.thenTask === name) refs.push(`Task: ${task.name} -> Condition (Then Task): ${name}`);
                        if (item.elseTask === name) refs.push(`Task: ${task.name} -> Condition (Else Task): ${name}`);
                    }
                    // Property Bindings/Variables
                    const str = JSON.stringify(item);
                    if (str.includes(`\${${name}}`) || str.includes(`\${${name}.`)) {
                        refs.push(`Task: ${task.name} -> Variable/Binding: ${name}`);
                    }
                    if (item.body) scanSeq(item.body);
                });
            };
            scanSeq(task.actionSequence);
        });

        // 2. Search in Flow Charts (Global + All Stages)
        const charts: { [key: string]: { chart: any, source: string } } = {};

        // Global FlowCharts
        const globalFlowCharts = this.project.flowCharts || {};
        Object.keys(globalFlowCharts).forEach(key => {
            if (validTaskNames.has(key)) {
                charts[key] = { chart: globalFlowCharts[key], source: 'Global' };
            }
        });

        // Stage FlowCharts
        if ((this.project as any).stages) {
            (this.project as any).stages.forEach((stage: any) => {
                const stageFlowCharts = stage.flowCharts || {};
                Object.keys(stageFlowCharts).forEach(key => {
                    if (validTaskNames.has(key)) {
                        charts[key] = { chart: stageFlowCharts[key], source: `Stage: ${stage.name || stage.id}` };
                    }
                });
            });
        }

        if ((this.project as any).flow) charts['__legacy_flow__'] = { chart: (this.project as any).flow, source: 'Legacy' };

        Object.keys(charts).forEach(chartKey => {
            const entry = charts[chartKey];
            const chart = entry.chart;
            const source = entry.source;
            (chart.elements || []).forEach((el: any) => {
                const elName = el.data?.name || el.data?.actionName || el.properties?.name;

                // Skip self-references: Element in its own flow chart (e.g., "StopAllSprites" in flowCharts.StopAllSprites)
                const isSelfReference = chartKey === name || chartKey === elName;

                if (elName === name && !isSelfReference) {
                    refs.push(`${source} Flow: ${chartKey} -> Element: ${name}`);
                }

                // Conditions in Flow (also check for self-references)
                if (el.type === 'Condition' && el.data) {
                    if (el.data.thenAction === name && chartKey !== name) refs.push(`${source} Flow: ${chartKey} -> Condition (Then): ${name}`);
                    if (el.data.elseAction === name && chartKey !== name) refs.push(`${source} Flow: ${chartKey} -> Condition (Else): ${name}`);
                }
            });
        });

        // 3. Search in Object Events (Tasks mapped to events) (Global + All Stages)
        const allObjects = [...(this.project.objects || [])];
        const objectSourceMap = new Map<any, string>();
        allObjects.forEach(obj => objectSourceMap.set(obj, 'Global'));

        if ((this.project as any).stages) {
            (this.project as any).stages.forEach((stage: any) => {
                const stageObjs = stage.objects || [];
                stageObjs.forEach((obj: any) => {
                    allObjects.push(obj);
                    objectSourceMap.set(obj, `Stage: ${stage.name || stage.id}`);
                });
            });
        }

        allObjects.forEach(obj => {
            const source = objectSourceMap.get(obj) || 'Unknown';
            if ((obj as any).Tasks) {
                Object.entries((obj as any).Tasks).forEach(([evt, taskName]) => {
                    if (taskName === name) {
                        refs.push(`${source} Objekt: ${obj.name} -> Event: ${evt}`);
                    }
                });
            }
            // Bindings in Object props
            const str = JSON.stringify(obj);
            if (str.includes(`\${${name}}`) || str.includes(`\${${name}.`)) {
                refs.push(`${source} Objekt: ${obj.name} -> Binding: ${name}`);
            }
        });

        // Deduplicate
        return Array.from(new Set(refs));
    }

    // =========================================================================================
    //  Renaming
    // =========================================================================================

    public renameVariable(oldName: string, newName: string): boolean {
        if (!this.project) return false;

        // 1. Validate new name
        // Scope context is hard to know here, assuming global check vs all visible for now or just generic valid check
        if (!this.validateVariableName(newName).valid) return false;

        // 2. Rename definition
        const variable = this.project.variables.find(v => v.name === oldName);
        if (variable) {
            variable.name = newName;
        } else {
            return false;
        }

        // 3. Update references
        // Update in Property Bindings: ${oldName} -> ${newName}
        this.updateReferencesInProperties(oldName, newName);

        // Update in Actions (variableName, source, arguments)
        this.updateReferencesInActions(oldName, newName);

        return true;
    }

    public renameTask(oldName: string, newName: string): boolean {
        if (!this.project) return false;
        if (!this.validateTaskName(newName).valid) return false;

        const task = this.project.tasks.find(t => t.name === oldName);
        if (task) {
            task.name = newName;
        } else {
            return false;
        }

        // Update calls to this task
        this.project.tasks.forEach(t => {
            t.actionSequence.forEach(item => {
                if (item.type === 'task' && item.name === oldName) {
                    item.name = newName;
                }
                if (item.thenTask === oldName) item.thenTask = newName;
                if (item.elseTask === oldName) item.elseTask = newName;
            });
        });

        // Update Object Events (Global + All Stages)
        const allObjects = [...(this.project.objects || [])];
        if ((this.project as any).stages) {
            (this.project as any).stages.forEach((s: any) => {
                if (s.objects) allObjects.push(...s.objects);
            });
        }

        allObjects.forEach(obj => {
            if ((obj as any).Tasks) {
                const tasks = (obj as any).Tasks;
                Object.keys(tasks).forEach(key => {
                    if (tasks[key] === oldName) {
                        tasks[key] = newName;
                    }
                });
            }
        });

        return true;
    }

    private updateReferencesInProperties(oldName: string, newName: string) {
        // Helper to replace ${oldName} with ${newName} in object and string values
        const regex = new RegExp(`\\$\\{${oldName}\\}`, 'g'); // Simple exact match ${var}
        // Also handle Nested: ${var.prop} -> ${new.prop}
        const regexNested = new RegExp(`\\$\\{${oldName}\\.`, 'g');

        const replaceInString = (str: string): string => {
            return str.replace(regex, `\${${newName}}`).replace(regexNested, `\${${newName}.`);
        };

        const traverseAndReplace = (obj: any) => {
            if (!obj) return;
            if (typeof obj === 'string') {
                return replaceInString(obj); // Can't mutate string in place
            }
            if (typeof obj === 'object') {
                Object.keys(obj).forEach(key => {
                    const val = obj[key];
                    if (typeof val === 'string') {
                        obj[key] = replaceInString(val);
                    } else if (typeof val === 'object') {
                        traverseAndReplace(val);
                    }
                });
            }
        };

        // Scan ALL Objects in ALL Stages
        const allObjects = [...(this.project!.objects || [])];
        if ((this.project as any).stages) {
            (this.project as any).stages.forEach((s: any) => {
                if (s.objects) allObjects.push(...s.objects);
            });
        }
        allObjects.forEach(obj => traverseAndReplace(obj));

        // Scan Actions properties in all Tasks
        this.project!.actions.forEach(act => traverseAndReplace(act)); // Actions definition list if it exists
        this.project!.tasks.forEach(t => traverseAndReplace(t)); // Sequence items
    }

    private updateReferencesInActions(oldName: string, newName: string) {
        // Specific Action fields that reference variables directly (not via ${})
        this.project!.tasks.forEach(task => {
            task.actionSequence.forEach(item => {
                if (item.type === 'action') {
                    const action = item as any;
                    if (action.variableName === oldName) action.variableName = newName;
                    if (action.resultVariable === oldName) action.resultVariable = newName;

                    // Calc steps
                    if (action.calcSteps) {
                        action.calcSteps.forEach((step: any) => {
                            if (step.operandType === 'variable' && step.variable === oldName) {
                                step.variable = newName;
                            }
                        });
                    }
                } else if (item.type === 'condition' || item.type === 'while') {
                    if (item.condition && item.condition.variable === oldName) {
                        item.condition.variable = newName;
                    }
                }
            });
        });
    }
}

export const projectRegistry = ProjectRegistry.getInstance();
