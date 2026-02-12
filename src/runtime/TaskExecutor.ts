import { ActionExecutor } from './ActionExecutor';
import { DebugLogService } from '../services/DebugLogService';
import { FlowCharts, GameProject, GameTask } from '../model/types';
import { libraryService } from '../services/LibraryService';
import { MultiplayerManager } from './MultiplayerManager';

export class TaskExecutor {
    private static readonly MAX_DEPTH = 10;
    private static readonly MAX_ITERATIONS = 1000;  // Prevent infinite loops

    constructor(
        private project: GameProject,
        private actions: any[],
        private actionExecutor: ActionExecutor,
        private flowCharts?: FlowCharts,
        private multiplayerManager?: MultiplayerManager,
        private tasks?: GameTask[]
    ) {
        this.tasks = tasks || project.tasks || [];
    }

    /**
     * Aktualisiert die FlowCharts (z.B. bei Stage-Wechsel)
     */
    public setFlowCharts(flowCharts: FlowCharts): void {
        this.flowCharts = flowCharts;
    }

    public setTasks(tasks: GameTask[]): void {
        this.tasks = tasks;
    }

    public setActions(actions: any[]): void {
        this.actions = actions;
    }

    async execute(taskName: string, vars: Record<string, any>, globalVars: Record<string, any>, contextObj?: any, depth: number = 0, parentId?: string, params?: Record<string, any>, isRemoteExecution: boolean = false): Promise<void> {
        if (depth >= TaskExecutor.MAX_DEPTH) {
            console.error(`[TaskExecutor] Max recursion depth exceeded: ${taskName} `);
            return;
        }

        // Merge parameters into local variables scope
        if (params) {
            vars = { ...vars, ...params };
        }

        // 1. Resolve Task
        let task = this.tasks?.find(t => t.name === taskName) || this.project.tasks?.find(t => t.name === taskName);

        if (!task) {
            // Check Library
            task = libraryService.getTask(taskName);
        }

        // 1b. Recursive Resolution for dot-notation (e.g., ObjectName.EventName)
        if (!task && taskName.includes('.')) {
            const [objName, evtName] = taskName.split('.');
            let foundTaskName = '';

            const findDeep = (objs: any[]): any => {
                for (const o of objs) {
                    if (o.name === objName || o.id === objName) return o;
                    if (o.children && o.children.length > 0) {
                        const found = findDeep(o.children);
                        if (found) return found;
                    }
                }
                return null;
            };

            // Search in objects (recursive) and variables of all stages
            this.project.stages?.forEach(s => {
                if (foundTaskName) return;

                // Search in objects
                const obj = findDeep(s.objects || []);
                if (obj && obj.Tasks && obj.Tasks[evtName]) {
                    foundTaskName = obj.Tasks[evtName];
                }

                // Search in stage variables
                if (!foundTaskName && s.variables) {
                    const v = s.variables.find((v: any) => v.name === objName);
                    if (v && (v as any).Tasks && (v as any).Tasks[evtName]) {
                        foundTaskName = (v as any).Tasks[evtName];
                    }
                }
            });

            // Search in global project variables
            if (!foundTaskName && this.project.variables) {
                const v = this.project.variables.find((v: any) => v.name === objName);
                if (v && (v as any).Tasks && (v as any).Tasks[evtName]) {
                    foundTaskName = (v as any).Tasks[evtName];
                }
            }

            if (foundTaskName) {
                console.log(`[TaskExecutor] Resolved "${taskName}" to assigned task: "${foundTaskName}"`);
                return this.execute(foundTaskName, vars, globalVars, contextObj, depth + 1, parentId, params, isRemoteExecution);
            }
        }

        if (!task) {
            // Only warn for task names that look intentional (not just lifecycle events without handlers)
            const optionalEvents = ['onStart', 'onStop', 'onValueChanged', 'onLoad', 'onUnload', 'onFocus', 'onBlur', 'onEnter', 'onLeave'];
            const isOptionalEvent = optionalEvents.some(evt => taskName.endsWith(`.${evt}`));
            if (!isOptionalEvent) {
                console.warn(`[TaskExecutor] Task definition not found: ${taskName}`);
            }
            return;
        }

        // ─────────────────────────────────────────────
        // TriggerMode Logic (Multiplayer only)
        // ─────────────────────────────────────────────
        const triggerMode = task.triggerMode || 'local-sync';
        const isMultiplayer = this.multiplayerManager?.isConnected === true;
        const isHost = this.multiplayerManager?.isHost === true;

        if (isMultiplayer && !isRemoteExecution) {
            // broadcast: Non-host sends to host, does NOT execute locally
            if (triggerMode === 'broadcast' && !isHost) {
                console.log(`[TaskExecutor] Broadcasting task "${taskName}" to host (not executing locally)`);
                this.multiplayerManager!.sendTriggerTask(taskName, params);
                return; // Do NOT execute locally
            }
        }

        if (isMultiplayer && isRemoteExecution) {
            // broadcast + remote: Only host should execute
            if (triggerMode === 'broadcast' && !isHost) {
                console.log(`[TaskExecutor] Skipping remote broadcast task "${taskName}" - only host executes`);
                return;
            }
        }

        // 2. Merge task parameter defaults into vars (for cloned tasks with ${param} placeholders)
        // This allows direct execution of tasks without passing explicit params
        if (task.params && Array.isArray(task.params)) {
            const paramDefaults: Record<string, any> = {};
            task.params.forEach((p: any) => {
                // Only use default if param not already provided
                if (p.name && p.default !== undefined && vars[p.name] === undefined) {
                    paramDefaults[p.name] = p.default;
                }
            });
            if (Object.keys(paramDefaults).length > 0) {
                console.log(`[TaskExecutor] Applied param defaults for "${taskName}":`, paramDefaults);
                vars = { ...vars, ...paramDefaults };
            }
        }

        const taskLogId = DebugLogService.getInstance().log('Task', `START: ${taskName} `, {
            parentId,
            objectName: contextObj?.name
        });

        DebugLogService.getInstance().pushContext(taskLogId);
        try {
            // Bestimme Ausführungsquelle: Bevorzuge FlowChart (Source of Truth im Editor)
            const flowChart = this.flowCharts?.[taskName];
            const hasFlowChart = flowChart && flowChart.elements && flowChart.elements.length > 0;
            const actionSequence = task.actionSequence || [];

            if (hasFlowChart) {
                console.log(`[TaskExecutor] Nutze Flussdiagramm für "${taskName}" (Elemente: ${flowChart!.elements.length})`);
                await this.executeFlowChart(taskName, flowChart!, vars, globalVars, contextObj, depth, taskLogId);
            } else {
                if (actionSequence.length === 0) {
                    console.log(`[TaskExecutor] Task "${taskName}" hat weder FlowChart noch ActionSequence.`);
                }

                for (const seqItem of actionSequence) {
                    try {
                        await this.executeSequenceItem(seqItem, vars, globalVars, contextObj, depth, taskLogId);
                    } catch (err) {
                        console.error(`[TaskExecutor] Error in item of task ${taskName}: `, err);
                        DebugLogService.getInstance().log('Event', `ERROR executing task ${taskName}: ${err}`, { parentId: taskLogId });
                    }
                }
            }

            // local-sync: After execution, sync to other player
            if (isMultiplayer && triggerMode === 'local-sync' && !isRemoteExecution) {
                console.log(`[TaskExecutor] Syncing task "${taskName}" to other player`);
                this.multiplayerManager!.sendSyncTask(taskName, params);
            }
        } finally {
            DebugLogService.getInstance().popContext();
        }
    }

    /**
     * Execute a task's flowChart directly at runtime
     * This is a fallback for when actionSequence wasn't properly synced
     */
    private async executeFlowChart(taskName: string, flowChart: { elements: any[], connections: any[] }, vars: Record<string, any>, globalVars: Record<string, any>, contextObj: any, depth: number, parentId?: string): Promise<void> {
        const { elements, connections } = flowChart;
        const visited = new Set<string>();

        // Find the start node (Task node with same name as the task, or a Start node)
        const startNode = elements.find((e: any) =>
            (e.type === 'Task' && e.properties?.name === taskName) ||
            (e.type === 'Start')
        );

        if (!startNode) {
            console.warn(`[TaskExecutor] No start node found in flowChart for task: ${taskName}. elements:`, elements.map(e => `${e.type}:${e.properties?.name || e.id}`));
            return;
        }

        console.log(`[TaskExecutor] FlowChart Elements for "${taskName}":`, elements.map(e => `${e.type}:${e.properties?.name || e.id}`));
        console.log(`[TaskExecutor] FlowChart vars.eventData =`, vars.eventData, 'contextObj =', contextObj?.name || contextObj?.className);

        const executeNode = async (node: any): Promise<void> => {
            if (!node || visited.has(node.id)) return;
            visited.add(node.id);

            const nodeType = node.type;
            const name = node.properties?.name || node.data?.name || node.data?.actionName;

            // Skip the task node itself (it's just the entry point)
            if (nodeType === 'Task' && name === taskName) {
                // Find outgoing connections and execute them
                const outgoing = connections.filter((c: any) => c.startTargetId === node.id);
                for (const conn of outgoing) {
                    const nextNode = elements.find((e: any) => e.id === conn.endTargetId);
                    if (nextNode) await executeNode(nextNode);
                }
                return;
            }


            if (nodeType === 'Action' || nodeType === 'action') {
                // Execute this action
                const action = this.resolveAction({ type: 'action', name: name }) || node.data;
                if (action) {
                    // If action has a body (is an action-definition), we execute its body ourselves
                    if (action.body && Array.isArray(action.body)) {
                        // Resolve params from node.data (e.g., { emoji: "$eventData" })
                        const itemParams = node.data?.params || {};
                        const resolvedParams: Record<string, any> = {};
                        for (const [key, value] of Object.entries(itemParams)) {
                            if (typeof value === 'string') {
                                if (value === '$eventData') {
                                    resolvedParams[key] = vars.eventData ?? contextObj;
                                } else if (value.startsWith('${') && value.endsWith('}')) {
                                    const varName = value.slice(2, -1);
                                    resolvedParams[key] = vars[varName] ?? globalVars[varName];
                                } else if (value.startsWith('$')) {
                                    const varName = value.slice(1);
                                    resolvedParams[key] = vars[varName] ?? globalVars[varName];
                                } else {
                                    resolvedParams[key] = value;
                                }
                            } else {
                                resolvedParams[key] = value;
                            }
                        }
                        console.log(`[TaskExecutor] FlowChart: Executing action body for "${action.name}" with params:`, resolvedParams);

                        // Make $params available in the vars context for body execution
                        const bodyVars = { ...vars, $params: resolvedParams };

                        // Execute each body item
                        for (const bodyItem of action.body) {
                            await this.actionExecutor.execute(bodyItem, bodyVars, globalVars, contextObj, parentId);
                        }
                    } else {
                        // Regular action (no body), execute directly
                        await this.actionExecutor.execute(action, vars, globalVars, contextObj, parentId);
                    }
                }

                // Find and execute next node (non-conditional connection)
                const outgoing = connections.find((c: any) =>
                    c.startTargetId === node.id &&
                    !['true', 'false'].includes(c.data?.startAnchorType || c.data?.anchorType || '')
                );
                if (outgoing) {
                    const nextNode = elements.find((e: any) => e.id === outgoing.endTargetId);
                    if (nextNode) await executeNode(nextNode);
                }
                return;
            }

            if (nodeType === 'Task' || nodeType === 'task') {
                // Execute sub-task
                await this.execute(name, vars, globalVars, contextObj, depth + 1, parentId, node.data?.params);

                // Find and execute next node
                const outgoing = connections.find((c: any) =>
                    c.startTargetId === node.id &&
                    !['true', 'false'].includes(c.data?.startAnchorType || c.data?.anchorType || '')
                );
                if (outgoing) {
                    const nextNode = elements.find((e: any) => e.id === outgoing.endTargetId);
                    if (nextNode) await executeNode(nextNode);
                }
                return;
            }

            if (nodeType === 'Condition' || nodeType === 'condition') {
                const condition = node.data?.condition;
                if (!condition) {
                    console.warn(`[TaskExecutor] Condition node without condition data: ${node.id} `);
                    return;
                }

                // Evaluate the condition
                const result = this.evaluateCondition(condition, vars, globalVars);
                console.log(`[TaskExecutor] Condition ${condition.variable} ${condition.operator || '=='} ${condition.value} => ${result} `);

                // Find the appropriate branch connection
                const trueConn = connections.find((c: any) =>
                    c.startTargetId === node.id &&
                    (c.data?.startAnchorType === 'true' || c.data?.anchorType === 'true')
                );
                const falseConn = connections.find((c: any) =>
                    c.startTargetId === node.id &&
                    (c.data?.startAnchorType === 'false' || c.data?.anchorType === 'false')
                );

                if (result && trueConn) {
                    const trueNode = elements.find((e: any) => e.id === trueConn.endTargetId);
                    if (trueNode) await executeNode(trueNode);
                } else if (!result && falseConn) {
                    const falseNode = elements.find((e: any) => e.id === falseConn.endTargetId);
                    if (falseNode) await executeNode(falseNode);
                }
                return;
            }
        };

        // Start execution from start node's outgoing connections
        const initialOutgoing = connections.filter((c: any) => c.startTargetId === startNode.id);
        for (const conn of initialOutgoing) {
            const firstNode = elements.find((e: any) => e.id === conn.endTargetId);
            if (firstNode) await executeNode(firstNode);
        }
    }

    private async executeSequenceItem(seqItem: any, vars: Record<string, any>, globalVars: Record<string, any>, contextObj: any, depth: number, parentId?: string): Promise<void> {
        const item = typeof seqItem === 'string'
            ? { type: 'action', name: seqItem }
            : seqItem;

        // Debug: Log every sequence item being processed
        console.log(`[TaskExecutor] Processing item: type = "${item.type}" name = "${item.name || 'N/A'}" condition = "${item.condition?.variable || 'none'}"`);

        // Check condition if present (BUT skip checking for 'condition' type items, as they handle logic internally)
        if (item.type !== 'condition') {
            const condition = item.itemCondition || (typeof item.condition === 'string' ? item.condition : null);
            if (condition && !this.evaluateCondition(condition, vars, globalVars)) {
                console.log(`[TaskExecutor] Item condition FALSE, skipping: ${condition} `);
                return;
            }
        }

        switch (item.type) {
            case 'condition':
                await this.handleCondition(item, vars, globalVars, contextObj, depth, parentId);
                break;
            case 'data_action':
                await this.handleDataAction(item, vars, globalVars, contextObj, depth, parentId);
                break;
            case 'task':
                await this.execute(item.name, vars, globalVars, contextObj, depth + 1, parentId, item.params);
                break;
            case 'action':
                const action = this.resolveAction(item);
                if (action) {
                    // If action has a body (is an action-definition), we execute its body ourselves
                    if (action.body && Array.isArray(action.body)) {
                        // Resolve params: replace $eventData, ${var} references with actual values
                        const resolvedParams: Record<string, any> = {};
                        if (item.params) {
                            for (const [key, value] of Object.entries(item.params)) {
                                if (typeof value === 'string') {
                                    if (value === '$eventData') {
                                        // eventData is passed in vars from the event trigger
                                        resolvedParams[key] = vars.eventData ?? contextObj;
                                    } else if (value.startsWith('${') && value.endsWith('}')) {
                                        // Variable reference like ${currentPIN} or ${user.name}
                                        const varName = value.slice(2, -1);
                                        resolvedParams[key] = this.resolveVarPath(varName, vars, globalVars);
                                    } else if (value.startsWith('$')) {
                                        // Simple $variable reference (e.g. $eventData.body.pin)
                                        resolvedParams[key] = this.resolveVarPath(value, vars, globalVars);
                                    } else {
                                        resolvedParams[key] = value;
                                    }
                                } else {
                                    resolvedParams[key] = value;
                                }
                            }
                        }
                        console.log(`[TaskExecutor] Executing action body for "${action.name}" with params:`, resolvedParams);

                        // Make $params available in the vars context for body execution
                        const bodyVars = { ...vars, $params: resolvedParams };

                        // Execute each body item (these are direct action steps like { type: "calculate", ... })
                        for (const bodyItem of action.body) {
                            await this.actionExecutor.execute(bodyItem, bodyVars, globalVars, contextObj, parentId);
                        }
                    } else {
                        // Regular action (no body), execute directly
                        await this.actionExecutor.execute(action, vars, globalVars, contextObj, parentId);
                    }
                } else {
                    console.warn(`[TaskExecutor] Action definition not found: ${item.name} `);
                }
                break;
            case 'while':
                await this.handleWhile(item, vars, globalVars, contextObj, depth, parentId);
                break;
            case 'for':
                await this.handleFor(item, vars, globalVars, contextObj, depth, parentId);
                break;
            case 'foreach':
                await this.handleForeach(item, vars, globalVars, contextObj, depth, parentId);
                break;
            default:
                // Legacy: execute as direct action
                if (item.type) {
                    await this.actionExecutor.execute(item, vars, globalVars, contextObj, parentId);
                }
        }
    }

    private async executeBody(body: any[], vars: Record<string, any>, globalVars: Record<string, any>, contextObj: any, depth: number, parentId?: string): Promise<void> {
        if (!body || !Array.isArray(body)) return;
        for (const item of body) {
            await this.executeSequenceItem(item, vars, globalVars, contextObj, depth, parentId);
        }
    }

    private resolveAction(item: any): any {
        if (typeof item === 'string') {
            return this.actions.find(a => a.name === item);
        }
        if (item.type === 'action' && item.name) {
            return this.actions.find(a => a.name === item.name);
        }
        return item;
    }

    private evaluateCondition(condition: any, vars: Record<string, any>, globalVars: Record<string, any>): boolean {
        if (!condition) return false;

        let leftValue: any;
        let rightValue: any;
        let operator = '==';
        let conditionStr = '';

        // Support string condition like "isPlayer1 == 1"
        if (typeof condition === 'string') {
            conditionStr = condition;
            const parts = condition.split(/\s*(==|!=|>|<|>=|<=)\s*/);
            if (parts.length === 3) {
                const left = parts[0].trim();
                operator = parts[1];
                const right = parts[2].trim();

                // Resolve values using helper to support "object.property" and "$variable" syntax
                leftValue = this.resolveValue(left, vars, globalVars);
                rightValue = this.resolveValue(right, vars, globalVars);
            } else {
                // Boolean check for single variable
                return !!this.resolveValue(condition, vars, globalVars);
            }
        } else {
            // Object style condition
            const varName = condition.variable;
            conditionStr = `${varName} ${condition.operator || '=='} ${condition.value}`;
            leftValue = this.resolveValue(varName, vars, globalVars);
            rightValue = condition.value; // Value in object style is usually a literal
            operator = condition.operator || '==';
        }

        // Debug Log
        console.log(`[TaskExecutor] Evaluating Condition: "${conditionStr}"`);
        console.log(`               Left:  "${leftValue}" (type: ${typeof leftValue})`);
        console.log(`               Right: "${rightValue}" (type: ${typeof rightValue})`);
        console.log(`               Op:    "${operator}"`);

        switch (operator) {
            case '==': return String(leftValue) === String(rightValue);
            case '!=': return String(leftValue) !== String(rightValue);
            case '>': return Number(leftValue) > Number(rightValue);
            case '<': return Number(leftValue) < Number(rightValue);
            case '>=': return Number(leftValue) >= Number(rightValue);
            case '<=': return Number(leftValue) <= Number(rightValue);
            default: return String(leftValue) === String(rightValue);
        }
    }

    private resolveValue(value: number | string | undefined, vars: Record<string, any>, globalVars: Record<string, any>): any {
        if (typeof value === 'number') return value;
        if (typeof value === 'boolean') return value;
        if (value === undefined || value === null) return value;

        if (typeof value === 'string') {
            // 1. String Literal (quoted)
            if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
                return value.substring(1, value.length - 1);
            }

            // 2. Variable Reference with ${...}
            const match = value.match(/^\$\{(.+)\}$/);
            if (match) {
                return this.resolveVarPath(match[1], vars, globalVars);
            }

            // 3. Simple Variable Reference (starts with meaning full char or $)
            // Try to resolve as path
            return this.resolveVarPath(value, vars, globalVars);
        }
        return value;
    }

    private resolveVarPath(path: string, vars: Record<string, any>, globalVars: Record<string, any>): any {
        // Handle $ prefix (strip it if it refers to a variable scope, but keep it if the key in vars actually has it)
        // Usually vars keys do NOT have $, but usage like $eventData often map to keys like 'eventData' or '$eventData'

        let lookupPath = path;
        if (path.startsWith('$')) {
            // Try explicit lookup first (e.g. vars['$eventData'])
            if (vars[path] !== undefined) return vars[path];

            // If not found, stripping $ might help if the system stores 'eventData' but user writes '$eventData'
            // BUT: Dot notation handling checks the root object first.
        }

        // Helper to safely get nested property
        const getDeep = (obj: any, p: string) => {
            const parts = p.split('.');
            let current = obj;

            // Special handling: if first part starts with $, try both with and without $
            if (parts[0].startsWith('$') && current[parts[0]] === undefined && current[parts[0].substring(1)] !== undefined) {
                parts[0] = parts[0].substring(1);
            }

            for (const part of parts) {
                if (current === undefined || current === null) return undefined;
                current = current[part];
            }
            return current;
        };

        // 1. Try Local Params/Vars first (PropertyHelper logic style)
        let val = getDeep(vars, lookupPath);
        if (val !== undefined) return val;

        // 2. Try Global Vars
        val = getDeep(globalVars, lookupPath);
        if (val !== undefined) return val;

        // 3. Fallback: If it's a number string, return number
        if (!isNaN(Number(path))) return Number(path);

        return undefined;
    }

    private async handleCondition(item: any, vars: Record<string, any>, globalVars: Record<string, any>, contextObj: any, depth: number, parentId?: string): Promise<void> {
        if (!item.condition) return;

        const result = this.evaluateCondition(item.condition, vars, globalVars);

        // Log to DebugLogService
        let conditionExpr = '';
        let logData: any = { result };

        if (typeof item.condition === 'string') {
            conditionExpr = item.condition;
            logData.expression = item.condition;
        } else {
            const varName = item.condition.variable;
            const varValue = vars[varName] !== undefined ? vars[varName] : globalVars[varName];
            const compareValue = item.condition.value;
            const operator = item.condition.operator || '==';
            conditionExpr = `${varName} ${operator} "${compareValue}"`;
            logData = { variable: varName, value: varValue, expected: compareValue, result };
        }

        DebugLogService.getInstance().log('Condition',
            `${conditionExpr} => ${result ? 'TRUE' : 'FALSE'}`,
            {
                parentId,
                objectName: contextObj?.name,
                data: logData
            }
        );

        // Debug: Log condition evaluation for boundary checks
        console.log(`[TaskExecutor] Condition: ${conditionExpr} => ${result}`);

        if (result) {
            if (item.thenAction) {
                const action = this.resolveAction(item.thenAction);
                console.log(`[TaskExecutor] Condition TRUE, executing thenAction: ${item.thenAction} `);
                if (action) await this.actionExecutor.execute(action, vars, globalVars, contextObj, parentId);
            }
            if (item.thenTask) {
                console.log(`[TaskExecutor] Condition TRUE, executing thenTask: ${item.thenTask} `);
                await this.execute(item.thenTask, vars, globalVars, contextObj, depth + 1, parentId);
            }
            if (item.body) await this.executeBody(item.body, vars, globalVars, contextObj, depth, parentId);
        } else {
            if (item.elseAction) {
                const action = this.resolveAction(item.elseAction);
                if (action) await this.actionExecutor.execute(action, vars, globalVars, contextObj, parentId);
            }
            if (item.elseTask) await this.execute(item.elseTask, vars, globalVars, contextObj, depth + 1, parentId);
            if (item.elseBody) await this.executeBody(item.elseBody, vars, globalVars, contextObj, depth, parentId);
        }
    }

    /**
     * WHILE loop: Execute body while condition is true
     */
    private async handleWhile(item: any, vars: Record<string, any>, globalVars: Record<string, any>, contextObj: any, depth: number, parentId?: string): Promise<void> {
        if (!item.condition || !item.body) {
            console.warn('[TaskExecutor] WHILE loop missing condition or body');
            return;
        }

        let iterations = 0;
        while (this.evaluateCondition(item.condition, vars, globalVars)) {
            if (iterations++ >= TaskExecutor.MAX_ITERATIONS) {
                console.error(`[TaskExecutor] WHILE loop exceeded max iterations(${TaskExecutor.MAX_ITERATIONS})`);
                break;
            }
            await this.executeBody(item.body, vars, globalVars, contextObj, depth, parentId);
        }
        console.log(`[TaskExecutor] WHILE loop completed after ${iterations} iterations`);
    }

    /**
     * FOR loop: Execute body for each value from 'from' to 'to'
     */
    private async handleFor(item: any, vars: Record<string, any>, globalVars: Record<string, any>, contextObj: any, depth: number, parentId?: string): Promise<void> {
        if (!item.iteratorVar || !item.body) {
            console.warn('[TaskExecutor] FOR loop missing iteratorVar or body');
            return;
        }

        const from = this.resolveValue(item.from, vars, globalVars);
        const to = this.resolveValue(item.to, vars, globalVars);
        const step = item.step || 1;

        let iterations = 0;
        for (let i = from; (step > 0 ? i <= to : i >= to); i += step) {
            if (iterations++ >= TaskExecutor.MAX_ITERATIONS) {
                console.error(`[TaskExecutor] FOR loop exceeded max iterations(${TaskExecutor.MAX_ITERATIONS})`);
                break;
            }
            // Set iterator variable
            vars[item.iteratorVar] = i;
            globalVars[item.iteratorVar] = i;
            await this.executeBody(item.body, vars, globalVars, contextObj, depth, parentId);
        }
        console.log(`[TaskExecutor] FOR loop completed after ${iterations} iterations`);
    }

    /**
     * FOREACH loop: Execute body for each item in array
     */
    private async handleForeach(item: any, vars: Record<string, any>, globalVars: Record<string, any>, contextObj: any, depth: number, parentId?: string): Promise<void> {
        if (!item.sourceArray || !item.itemVar || !item.body) {
            console.warn('[TaskExecutor] FOREACH loop missing sourceArray, itemVar, or body');
            return;
        }

        // Get the array from variables
        const arrayName = item.sourceArray;
        const arr = vars[arrayName] !== undefined ? vars[arrayName] : globalVars[arrayName];

        if (!Array.isArray(arr)) {
            console.warn(`[TaskExecutor] FOREACH: ${arrayName} is not an array`);
            return;
        }

        let idx = 0;
        for (const element of arr) {
            if (idx >= TaskExecutor.MAX_ITERATIONS) {
                console.error(`[TaskExecutor] FOREACH loop exceeded max iterations(${TaskExecutor.MAX_ITERATIONS})`);
                break;
            }
            // Set item and index variables
            vars[item.itemVar] = element;
            globalVars[item.itemVar] = element;
            if (item.indexVar) {
                vars[item.indexVar] = idx;
                globalVars[item.indexVar] = idx;
            }
            await this.executeBody(item.body, vars, globalVars, contextObj, depth, parentId);
            idx++;
        }
        console.log(`[TaskExecutor] FOREACH loop completed after ${idx} iterations`);
    }

    /**
     * Executes a data action and branches based on the result
     */
    private async handleDataAction(item: any, vars: Record<string, any>, globalVars: Record<string, any>, contextObj: any, depth: number, parentId?: string): Promise<void> {
        const action = this.resolveAction(item);
        if (!action) {
            console.warn(`[TaskExecutor] DataAction definition not found: ${item.name || item.type}`);
            return;
        }

        console.log(`[TaskExecutor] Executing DataAction: ${action.name || action.type}`);

        // Execute the action and get the result
        const result = await this.actionExecutor.execute(action, vars, globalVars, contextObj, parentId);

        // Branching: result !== false is considered success
        const isSuccess = result !== false;
        console.log(`[TaskExecutor] DataAction "${action.name || action.type}" finished. Success: ${isSuccess}`);

        const body = isSuccess ? item.successBody : item.errorBody;
        if (body && Array.isArray(body)) {
            await this.executeBody(body, vars, globalVars, contextObj, depth, parentId);
        }
    }
}
