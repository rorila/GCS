import { libraryService } from './LibraryService';
export class ProjectRegistry {
    static instance;
    project = null;
    constructor() { }
    static getInstance() {
        if (!ProjectRegistry.instance) {
            ProjectRegistry.instance = new ProjectRegistry();
        }
        return ProjectRegistry.instance;
    }
    setProject(project) {
        this.project = project;
    }
    // =========================================================================================
    //  Variables
    // =========================================================================================
    /**
     * Retrieves variables visible in a specific context.
     * Hierarchy: Global > Stage (if active) > Task (if in task) > Action (if in action)
     */
    getVariables(context, resolveUsage = true) {
        if (!this.project)
            return [];
        let visibleVars = [];
        // 1. Global variables
        visibleVars = this.project.variables
            .filter(v => !v.scope || String(v.scope).toLowerCase() === 'global')
            .map(v => ({ ...v, uiScope: 'global' }));
        // 2. Stage variables (from active stage)
        if (this.activeStageId && this.project.stages) {
            const activeStage = this.project.stages.find(s => s.id === this.activeStageId);
            if (activeStage && activeStage.variables) {
                const stageVars = activeStage.variables.map(v => ({ ...v, uiScope: 'stage' }));
                visibleVars = [...visibleVars, ...stageVars];
            }
            const scopedProjectVars = this.project.variables
                .filter(v => v.scope === this.activeStageId)
                .map(v => ({ ...v, uiScope: 'stage' }));
            visibleVars = [...visibleVars, ...scopedProjectVars];
        }
        // 3. If inside a Task, include Task variables
        if (context?.taskName) {
            const taskVars = this.project.variables
                .filter(v => v.scope === context.taskName || v.scope === `task:${context.taskName}`)
                .map(v => ({ ...v, uiScope: 'local' }));
            visibleVars = [...visibleVars, ...taskVars];
        }
        // 4. If inside an Action, include Action variables
        if (context?.actionId) {
            const actionVars = this.project.variables
                .filter(v => v.scope === `action:${context.actionId}`)
                .map(v => ({ ...v, uiScope: 'local' }));
            visibleVars = [...visibleVars, ...actionVars];
        }
        const vars = visibleVars.map(v => ({
            ...v,
            usageCount: resolveUsage ? this.getVariableUsage(v.name).length : 0
        }));
        return vars;
    }
    validateVariableName(name, context) {
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
    /**
     * Gets tasks. By default returns Global + Active Stage tasks.
     * Set stageId to 'all' to get everything.
     */
    getTasks(stageId = 'active', resolveUsage = true) {
        if (!this.project)
            return [];
        // 1. Global tasks
        const globalTasks = (this.project.tasks || []).map(t => ({ ...t, uiScope: 'global' }));
        // 2. Library tasks
        const libTasks = libraryService.getTasks().map(t => ({ ...t, uiScope: 'library' }));
        if (stageId === 'all') {
            let allTasks = [...globalTasks, ...libTasks];
            if (this.project.stages) {
                this.project.stages.forEach(stage => {
                    if (stage.tasks) {
                        allTasks = [...allTasks, ...stage.tasks.map(t => ({ ...t, uiScope: 'stage' }))];
                    }
                });
            }
            return allTasks.map(t => ({ ...t, usageCount: resolveUsage ? this.getTaskUsage(t.name).length : 0 }));
        }
        const targetStageId = stageId === 'active' ? this.activeStageId : stageId;
        if (targetStageId && this.project.stages) {
            const stage = this.project.stages.find(s => s.id === targetStageId);
            if (stage && stage.tasks) {
                const stageTasks = stage.tasks.map(t => ({ ...t, uiScope: 'stage' }));
                return [...globalTasks, ...stageTasks, ...libTasks].map(t => ({ ...t, usageCount: resolveUsage ? this.getTaskUsage(t.name).length : 0 }));
            }
        }
        return [...globalTasks, ...libTasks].map(t => ({ ...t, usageCount: resolveUsage ? this.getTaskUsage(t.name).length : 0 }));
    }
    validateTaskName(name) {
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
    getActions(stageId = 'active', resolveUsage = true) {
        if (!this.project)
            return [];
        // 1. Global actions
        const globalActions = (this.project.actions || []).map(a => ({ ...a, uiScope: 'global' }));
        if (stageId === 'all') {
            let allActions = [...globalActions];
            if (this.project.stages) {
                this.project.stages.forEach(stage => {
                    if (stage.actions) {
                        allActions = [...allActions, ...stage.actions.map(a => ({ ...a, uiScope: 'stage' }))];
                    }
                });
            }
            return allActions.map(a => ({ ...a, usageCount: resolveUsage ? this.getActionUsage(a.name).length : 0 }));
        }
        const targetStageId = stageId === 'active' ? this.activeStageId : stageId;
        if (targetStageId && this.project.stages) {
            const stage = this.project.stages.find(s => s.id === targetStageId);
            if (stage && stage.actions) {
                const stageActions = stage.actions.map(a => ({ ...a, uiScope: 'stage' }));
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
    activeStageId = null;
    /**
     * Set the active stage ID to filter getObjects() results.
     * If null, returns objects from all stages.
     */
    setActiveStageId(id) {
        this.activeStageId = id;
    }
    getActiveStageId() {
        return this.activeStageId;
    }
    /**
     * Returns objects for the current context:
     * - If activeStageId is set, returns objects from that stage PLUS global services from all stages
     * - Otherwise, returns all objects from all stages (plus legacy project.objects)
     */
    getObjects() {
        if (!this.project)
            return [];
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
            const allObjects = [];
            const objectIds = new Set();
            // 1. Add objects from active stage (if set)
            if (this.activeStageId) {
                const activeStage = this.project.stages.find((s) => s.id === this.activeStageId);
                if (activeStage && activeStage.objects) {
                    activeStage.objects.forEach((obj) => {
                        allObjects.push(obj);
                        objectIds.add(obj.id);
                    });
                }
            }
            // 2. Add global services from ALL stages (even if not on active stage)
            this.project.stages.forEach((stage) => {
                if (stage.objects && Array.isArray(stage.objects)) {
                    stage.objects.forEach((obj) => {
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
    getFlowObjects() {
        return this.project?.flow?.elements || [];
    }
    getObjectsWithMetadata(resolveUsage = true) {
        const objects = this.getObjects();
        return objects.map(obj => {
            const usage = resolveUsage ? this.getObjectUsage(obj.name) : [];
            const isGlobal = this.project?.objects.some(o => o.name === obj.name);
            const scopedObj = { ...obj };
            scopedObj.uiScope = isGlobal ? 'global' : 'stage';
            scopedObj.usageCount = usage.length;
            return scopedObj;
        });
    }
    validateObjectName(name) {
        // Rule: PascalCase
        if (!/^[A-Z][a-zA-Z0-9_]*$/.test(name)) { // Allow underscores for generated names like Button_1
            return { valid: false, error: 'Objekt-Namen müssen mit einem Großbuchstaben beginnen.' };
        }
        // Rule: Unique across Stage Objects AND Flow Objects
        // Use getObjects() to get the correct object list (which includes active stage + globals)
        const objects = this.getObjects();
        if (objects.some(o => o.name === name)) {
            return { valid: false, error: 'Objekt-Name existiert bereits auf der Stage.' };
        }
        // Check Flow Objects in ALL charts
        const checkFlows = (charts) => {
            if (!charts)
                return false;
            return Object.values(charts).some((chart) => chart.elements && chart.elements.some((e) => e.name === name));
        };
        if (checkFlows(this.project.flowCharts)) {
            return { valid: false, error: 'Objekt-Name wird bereits im Flow verwendet.' };
        }
        if (this.project.stages) {
            for (const stage of this.project.stages) {
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
    /**
     * Finds all references to a specific named entity (Task, Action, Variable or Object)
     */
    findReferences(name) {
        const refs = [];
        if (!this.project)
            return refs;
        // Combine all specific usages
        return [
            ...this.getTaskUsage(name),
            ...this.getActionUsage(name),
            ...this.getVariableUsage(name),
            ...this.getObjectUsage(name)
        ].filter((v, i, a) => a.indexOf(v) === i); // Deduplicate
    }
    getObjectUsage(name) {
        const refs = [];
        if (!this.project)
            return refs;
        // 1. Used in Actions (Target or Source or interpolations) - AVOID RECURSION
        this.getActions('all', false).forEach(action => {
            if (action.target === name) {
                refs.push(`Aktion: ${action.name} -> Target ist Objekt: ${name}`);
            }
            if (action.source === name) {
                refs.push(`Aktion: ${action.name} -> Source ist Objekt: ${name}`);
            }
            // Interpolations in changes
            if (action.changes) {
                const str = JSON.stringify(action.changes);
                if (str.includes(`\${${name}.`)) {
                    refs.push(`Aktion: ${action.name} -> Referenziert Objekt: ${name}`);
                }
            }
        });
        // 2. Used in Input Configuration
        const checkInput = (input, source) => {
            if (input.player1Target === name)
                refs.push(`${source} -> Player 1 Target ist: ${name}`);
            if (input.player2Target === name)
                refs.push(`${source} -> Player 2 Target ist: ${name}`);
        };
        if (this.project.input)
            checkInput(this.project.input, 'Global Input');
        this.project.stages?.forEach(stage => {
            if (stage.input)
                checkInput(stage.input, `Stage: ${stage.name} Input`);
        });
        // 3. Expressions in Tasks/Sequences - AVOID RECURSION
        const objRegex = new RegExp(`\\$\\{${name}\\.`, 'g');
        this.getTasks('all', false).forEach(task => {
            const str = JSON.stringify(task.actionSequence);
            if (objRegex.test(str)) {
                refs.push(`Task: ${task.name} -> Referenziert Objekt: ${name}`);
            }
        });
        // 4. Object Bindings
        this.getAllObjectsWithSource().forEach(({ obj, source }) => {
            const str = JSON.stringify(obj);
            if (objRegex.test(str)) {
                refs.push(`${source} Objekt: ${obj.name} -> Binding auf Objekt: ${name}`);
            }
        });
        return refs;
    }
    getTaskUsage(name) {
        const refs = [];
        if (!this.project)
            return refs;
        // 1. Calls in other Tasks - AVOID RECURSION (resolveUsage = false)
        this.getTasks('all', false).forEach(task => {
            if (task.name === name)
                return; // Skip self
            const scanSeq = (seq) => {
                if (!seq)
                    return;
                seq.forEach(item => {
                    if (item.type === 'task' && item.name === name) {
                        refs.push(`Task: ${task.name} -> Ruft Task auf: ${name}`);
                    }
                    if (item.thenTask === name)
                        refs.push(`Task: ${task.name} -> Condition (Then): ${name}`);
                    if (item.elseTask === name)
                        refs.push(`Task: ${task.name} -> Condition (Else): ${name}`);
                    if (item.body)
                        scanSeq(item.body);
                });
            };
            scanSeq(task.actionSequence);
        });
        // 2. Object Events
        this.getAllObjectsWithSource().forEach(({ obj, source }) => {
            if (obj.Tasks) {
                Object.entries(obj.Tasks).forEach(([evt, taskName]) => {
                    if (taskName === name) {
                        refs.push(`${source} Objekt: ${obj.name} -> Event: ${evt}`);
                    }
                });
            }
        });
        return refs;
    }
    getActionUsage(name) {
        const refs = [];
        if (!this.project)
            return refs;
        // 1. Used in Tasks - AVOID RECURSION
        this.getTasks('all', false).forEach(task => {
            const scanSeq = (seq) => {
                if (!seq)
                    return;
                seq.forEach(item => {
                    if (item.type === 'action' && item.name === name) {
                        refs.push(`Task: ${task.name} -> Verwendet Aktion: ${name}`);
                    }
                    if (item.thenAction === name)
                        refs.push(`Task: ${task.name} -> Condition (Then): ${name}`);
                    if (item.elseAction === name)
                        refs.push(`Task: ${task.name} -> Condition (Else): ${name}`);
                    if (item.body)
                        scanSeq(item.body);
                });
            };
            scanSeq(task.actionSequence);
        });
        return refs;
    }
    getVariableUsage(name) {
        const refs = [];
        if (!this.project)
            return refs;
        const varRegex = new RegExp(`\\$\\{${name}([.}]|$)`); // Matches ${var} or ${var.prop}
        // 1. Used in Task Actions / Expressions
        this.getTasks('all', false).forEach(task => {
            const scanSeq = (seq) => {
                if (!seq)
                    return;
                seq.forEach(item => {
                    const str = JSON.stringify(item);
                    if (varRegex.test(str)) {
                        refs.push(`Task: ${task.name} -> Referenziert Variable: ${name}`);
                    }
                    // Direct Action fields
                    if (item.type === 'action') {
                        const action = item;
                        if (action.variableName === name || action.resultVariable === name) {
                            refs.push(`Task: ${task.name} -> Aktion nutzt Variable: ${name}`);
                        }
                    }
                    if (item.condition && (item.condition.variable === name)) {
                        refs.push(`Task: ${task.name} -> Bedingung nutzt Variable: ${name}`);
                    }
                    if (item.body)
                        scanSeq(item.body);
                });
            };
            scanSeq(task.actionSequence);
        });
        // 2. Used in Object Properties (Bindings)
        this.getAllObjectsWithSource().forEach(({ obj, source }) => {
            const str = JSON.stringify(obj);
            if (varRegex.test(str)) {
                refs.push(`${source} Objekt: ${obj.name} -> Binding auf Variable: ${name}`);
            }
        });
        return refs;
    }
    getAllObjectsWithSource() {
        const results = [];
        if (!this.project)
            return results;
        (this.project.objects || []).forEach(obj => results.push({ obj, source: 'Global' }));
        if (this.project.stages) {
            this.project.stages.forEach(s => {
                (s.objects || []).forEach((obj) => results.push({ obj, source: `Stage: ${s.name || s.id}` }));
            });
        }
        return results;
    }
    // =========================================================================================
    //  Renaming
    // =========================================================================================
    renameVariable(oldName, newName) {
        if (!this.project)
            return false;
        // 1. Validate new name
        // Scope context is hard to know here, assuming global check vs all visible for now or just generic valid check
        if (!this.validateVariableName(newName).valid)
            return false;
        // 2. Rename definition
        const variable = this.project.variables.find(v => v.name === oldName);
        if (variable) {
            variable.name = newName;
        }
        else {
            return false;
        }
        // 3. Update references
        // Update in Property Bindings: ${oldName} -> ${newName}
        this.updateReferencesInProperties(oldName, newName);
        // Update in Actions (variableName, source, arguments)
        this.updateReferencesInActions(oldName, newName);
        return true;
    }
    renameTask(oldName, newName) {
        if (!this.project)
            return false;
        if (!this.validateTaskName(newName).valid)
            return false;
        // Find and rename in whichever collection it resides
        let task;
        task = this.getTasks().find(t => t.name === oldName);
        if (task) {
            task.name = newName;
        }
        else {
            console.warn(`[ProjectRegistry] renameTask: Task '${oldName}' not found.`);
            return false;
        }
        // 1. Update calls to this task in ALL Task Sequences
        this.getTasks().forEach(t => {
            if (t.actionSequence) {
                t.actionSequence.forEach(item => {
                    if (item.type === 'task' && item.name === oldName)
                        item.name = newName;
                    if (item.thenTask === oldName)
                        item.thenTask = newName;
                    if (item.elseTask === oldName)
                        item.elseTask = newName;
                });
            }
        });
        // 2. Update Object Events
        this.getAllObjectsWithSource().forEach(({ obj }) => {
            if (obj.Tasks) {
                Object.keys(obj.Tasks).forEach(key => {
                    if (obj.Tasks[key] === oldName)
                        obj.Tasks[key] = newName;
                });
            }
        });
        // 3. Rename Flow Charts
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
    deleteTask(name) {
        if (!this.project)
            return false;
        // 1. Find the task to get its actions before deletion
        const allTasks = this.getTasks();
        const task = allTasks.find(t => t.name === name);
        if (!task)
            return false;
        const actionsToCleanup = (task.actionSequence || [])
            .filter(item => item.type === 'action')
            .map(item => item.name);
        // 2. Remove Task from project/stages
        this.project.tasks = this.project.tasks.filter(t => t.name !== name);
        if (this.project.stages) {
            this.project.stages.forEach(s => {
                if (s.tasks)
                    s.tasks = s.tasks.filter((t) => t.name !== name);
                if (s.flowCharts && s.flowCharts[name])
                    delete s.flowCharts[name];
            });
        }
        if (this.project.flowCharts && this.project.flowCharts[name])
            delete this.project.flowCharts[name];
        // 3. Orphan Action Cleanup
        actionsToCleanup.forEach(actionName => {
            if (this.getActionUsage(actionName).length === 0) {
                console.log(`[ProjectRegistry] Cleaning up orphan action: ${actionName}`);
                this.deleteAction(actionName);
            }
        });
        // 4. Update References (Calls/Events)
        // Clear references in other tasks
        this.getTasks().forEach(t => {
            if (t.actionSequence) {
                t.actionSequence.forEach(item => {
                    if (item.type === 'task' && item.name === name) {
                        item.name = ''; // Or keep as placeholder? For now clear.
                    }
                    if (item.thenTask === name)
                        item.thenTask = '';
                    if (item.elseTask === name)
                        item.elseTask = '';
                });
            }
        });
        // Clear Object Events
        this.getAllObjectsWithSource().forEach(({ obj }) => {
            if (obj.Tasks) {
                Object.keys(obj.Tasks).forEach(evt => {
                    if (obj.Tasks[evt] === name)
                        delete obj.Tasks[evt];
                });
            }
        });
        return true;
    }
    deleteAction(name) {
        if (!this.project)
            return false;
        this.project.actions = this.project.actions.filter(a => a.name !== name);
        if (this.project.stages) {
            this.project.stages.forEach(s => {
                if (s.actions)
                    s.actions = s.actions.filter((a) => a.name !== name);
            });
        }
        return true;
    }
    /**
     * Generates a smart name for a new action based on its initial content
     */
    getNextSmartActionName(action) {
        const target = (action.target || 'global').replace(/[^a-zA-Z0-9]/g, '');
        let propPart = 'action';
        if (action.changes) {
            const keys = Object.keys(action.changes);
            if (keys.length > 0) {
                const firstKey = keys[0];
                const val = action.changes[firstKey];
                let valStr = String(val).replace(/[^a-zA-Z0-9]/g, '');
                if (valStr.length > 8)
                    valStr = valStr.substring(0, 8);
                propPart = `${firstKey}_${valStr}`;
            }
        }
        const baseName = `${target}_${propPart}`;
        let finalName = baseName;
        let counter = 1;
        const allActionNames = new Set(this.getActions().map(a => a.name));
        while (allActionNames.has(finalName)) {
            finalName = `${baseName}_${counter++}`;
        }
        return finalName;
    }
    renameAction(oldName, newName) {
        if (!this.project)
            return false;
        let action;
        action = this.project.actions.find(a => a.name === oldName);
        if (!action && this.project.stages) {
            for (const stage of this.project.stages) {
                if (stage.actions) {
                    action = stage.actions.find(a => a.name === oldName);
                    if (action)
                        break;
                }
            }
        }
        if (action) {
            action.name = newName;
        }
        else {
            return false;
        }
        // Update references in all Task Sequences
        const allTasks = this.getTasks();
        allTasks.forEach(t => {
            if (t.actionSequence) {
                t.actionSequence.forEach(item => {
                    if (item.type === 'action' && item.name === oldName)
                        item.name = newName;
                    if (item.thenAction === oldName)
                        item.thenAction = newName;
                    if (item.elseAction === oldName)
                        item.elseAction = newName;
                });
            }
        });
        return true;
    }
    updateReferencesInProperties(oldName, newName) {
        // Helper to replace ${oldName} with ${newName} in object and string values
        const regex = new RegExp(`\\$\\{${oldName}\\}`, 'g'); // Simple exact match ${var}
        // Also handle Nested: ${var.prop} -> ${new.prop}
        const regexNested = new RegExp(`\\$\\{${oldName}\\.`, 'g');
        const replaceInString = (str) => {
            return str.replace(regex, `\${${newName}}`).replace(regexNested, `\${${newName}.`);
        };
        const traverseAndReplace = (obj) => {
            if (!obj)
                return;
            if (typeof obj === 'string') {
                return replaceInString(obj); // Can't mutate string in place
            }
            if (typeof obj === 'object') {
                Object.keys(obj).forEach(key => {
                    const val = obj[key];
                    if (typeof val === 'string') {
                        obj[key] = replaceInString(val);
                    }
                    else if (typeof val === 'object') {
                        traverseAndReplace(val);
                    }
                });
            }
        };
        // Scan ALL Objects in ALL Stages
        const allObjects = [...(this.project.objects || [])];
        if (this.project.stages) {
            this.project.stages.forEach(s => {
                if (s.objects)
                    allObjects.push(...s.objects);
            });
        }
        allObjects.forEach(obj => traverseAndReplace(obj));
        // Scan Actions properties in all Tasks (Global + Stages)
        this.project.actions.forEach(act => traverseAndReplace(act));
        if (this.project.stages) {
            this.project.stages.forEach(stage => {
                if (stage.actions)
                    stage.actions.forEach(act => traverseAndReplace(act));
            });
        }
        const allTasks = this.getTasks();
        allTasks.forEach(t => traverseAndReplace(t)); // Sequence items
    }
    updateReferencesInActions(oldName, newName) {
        // Specific Action fields that reference variables directly (not via ${})
        this.project.tasks.forEach(task => {
            task.actionSequence.forEach(item => {
                if (item.type === 'action') {
                    const action = item;
                    if (action.variableName === oldName)
                        action.variableName = newName;
                    if (action.resultVariable === oldName)
                        action.resultVariable = newName;
                    // Calc steps
                    if (action.calcSteps) {
                        action.calcSteps.forEach((step) => {
                            if (step.operandType === 'variable' && step.variable === oldName) {
                                step.variable = newName;
                            }
                        });
                    }
                }
                else if (item.type === 'condition' || item.type === 'while') {
                    if (item.condition && item.condition.variable === oldName) {
                        item.condition.variable = newName;
                    }
                }
            });
        });
    }
}
export const projectRegistry = ProjectRegistry.getInstance();
