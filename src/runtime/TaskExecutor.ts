import { ActionExecutor } from './ActionExecutor';
import { DebugLogService } from '../services/DebugLogService';
import { FlowCharts, GameProject, GameTask } from '../model/types';
import { libraryService } from '../services/LibraryService';
import { MultiplayerManager } from './MultiplayerManager';
import { TaskConditionEvaluator } from './executor/TaskConditionEvaluator';
import { TaskLoopHandler } from './executor/TaskLoopHandler';
import { Logger } from '../utils/Logger';

const logger = Logger.get('TaskExecutor', 'Runtime_Execution');

export class TaskExecutor {
    private static readonly MAX_DEPTH = 10;

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

    public async execute(
        taskName: string,
        vars: Record<string, any> = {},
        globalVars: Record<string, any> = {},
        contextObj: any = null,
        depth: number = 0,
        parentId?: string,
        params: any = null,
        isRemoteExecution: boolean = false
    ): Promise<void> {
        if (depth > TaskExecutor.MAX_DEPTH) {
            logger.error(`Max recursion depth reached for task ${taskName}`);
            return;
        }

        const isMultiplayer = !!this.multiplayerManager;

        // 2. Logging (ZENTRAL: Ganz am Anfang, damit E2E-Tests JEDEM Startversuch sehen)
        const isEnabled = DebugLogService.getInstance().isEnabled();
        // Fallback für E2E Sichtbarkeit und UseCase Routing
        if (isEnabled) {
            logger.info(`[TaskExecutor] EXECUTING: ${taskName} (depth: ${depth}, context: ${contextObj?.name || 'none'})`);
        }

        const taskLogId = DebugLogService.getInstance().log('Task', `START: ${taskName}`, {
            parentId,
            objectName: contextObj?.name,
            flatten: depth > 0 // Bei Rekursion flach halten für E2E Sichtbarkeit
        });

        // 1. Resolve Task
        // Search order: Active Stage (this.tasks) -> Blueprint Stage -> Legacy Project Tasks
        let task = this.tasks?.find(t => t.name === taskName);

        if (!task) {
            const blueprintStage = this.project.stages?.find(s => s.type === 'blueprint' || s.id === 'stage_blueprint');
            if (blueprintStage) {
                task = blueprintStage.tasks?.find(t => t.name === taskName);
            }
        }

        if (!task) {
            task = this.project.tasks?.find(t => t.name === taskName);
        }

        if (!task) {
            // Check Library
            task = libraryService.getTask(taskName);
        }

        // 1b. Recursive Resolution for dot-notation (e.g., ObjectName.EventName)
        if (!task && taskName.includes('.')) {
            const [objName, evtName] = taskName.split('.');
            let foundTaskName = '';
            let objectFound: any = null;

            // STRATEGY 1: Check Context Object directly (Robust & Fast)
            if (contextObj && (contextObj.name === objName || contextObj.id === objName)) {
                objectFound = contextObj;
                const evts = (contextObj as any).events || (contextObj as any).Tasks;
                if (evts && evts[evtName]) {
                    foundTaskName = evts[evtName];
                    logger.debug(`Resolved "${taskName}" via direct contextObj match: "${foundTaskName}"`);
                }
            }

            if (!foundTaskName) {
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

                // STRATEGY 2: Search in all stages (Standard)
                this.project.stages?.forEach(s => {
                    if (foundTaskName) return;

                    // Search in objects
                    const obj = findDeep(s.objects || []);
                    if (obj) {
                        objectFound = obj; // Track the object found
                        if ((obj.events || obj.Tasks) && (obj.events || obj.Tasks)[evtName]) {
                            foundTaskName = (obj.events || obj.Tasks)[evtName];
                        }
                    }

                    // Search in stage variables
                    if (!foundTaskName && s.variables) {
                        const v = s.variables.find((v: any) => v.name === objName);
                        if (v) {
                            objectFound = v;
                            if ((v as any).events && (v as any).events[evtName]) {
                                foundTaskName = (v as any).events[evtName];
                            } else if ((v as any).Tasks && (v as any).Tasks[evtName]) {
                                foundTaskName = (v as any).Tasks[evtName];
                            }
                        }
                    }
                });

                // STRATEGY 3: Search in global project variables
                if (!foundTaskName && this.project.variables) {
                    const v = this.project.variables.find((v: any) => v.name === objName);
                    if (v) {
                        objectFound = v;
                        if ((v as any).events && (v as any).events[evtName]) {
                            foundTaskName = (v as any).events[evtName];
                        } else if ((v as any).Tasks && (v as any).Tasks[evtName]) {
                            foundTaskName = (v as any).Tasks[evtName];
                        }
                    }
                }

                // STRATEGY 4: Search in legacy project objects
                if (!foundTaskName && this.project.objects) {
                    const obj = findDeep(this.project.objects);
                    if (obj) {
                        objectFound = obj;
                        if ((obj.events || obj.Tasks) && (obj.events || obj.Tasks)[evtName]) {
                            foundTaskName = (obj.events || obj.Tasks)[evtName];
                        }
                    }
                }
            }

            if (foundTaskName) {
                logger.debug(`Final resolution for "${taskName}": "${foundTaskName}"`);
                return this.execute(foundTaskName, vars, globalVars, objectFound, depth + 1, taskLogId, params, isRemoteExecution);
            }

            // Only warn if it's NOT an optional event and NOT found
            const optionalEvents = ['onStart', 'onStop', 'onValueChanged', 'onLoad', 'onUnload', 'onFocus', 'onBlur', 'onEnter', 'onLeave'];
            const isOptionalEvent = optionalEvents.includes(evtName);

            if (!isOptionalEvent) {
                if (objectFound) {
                    logger.warn(`Object "${objName}" found, but no task mapping for event "${evtName}".`);
                } else {
                    logger.warn(`Could not resolve dot-notation "${taskName}". Object "${objName}" not found in current project.`);
                }
            }
            return;
        }

        if (!task) {
            // Check if we have a flow chart at least
            const flowChart = this.flowCharts?.[taskName];
            const hasFlowChart = flowChart && flowChart.elements && flowChart.elements.length > 0;

            if (!hasFlowChart) {
                // This is for direct task calls (not dot-notation) without any definition
                logger.warn(`Task definition or FlowChart not found: ${taskName}`);
                return;
            }
        }

        // ─────────────────────────────────────────────
        // TriggerMode Logic (Multiplayer only)
        // ─────────────────────────────────────────────
        const triggerMode = task?.triggerMode || 'local-sync';

        DebugLogService.getInstance().pushContext(taskLogId);
        try {
            // Bestimme Ausführungsquelle: Bevorzuge FlowChart (Source of Truth im Editor)
            const flowChart = this.flowCharts?.[taskName];
            const hasFlowChart = flowChart && flowChart.elements && flowChart.elements.length > 0;
            const actionSequence = task?.actionSequence || [];

            // console.info(`[DIAGNOSTIC-TASK] "${taskName}": hasFlowChart=${hasFlowChart}, actionSequenceLen=${actionSequence.length}`);
            // if (actionSequence.length > 0) {
            //     console.info(`[DIAGNOSTIC-TASK] ActionSequence:`, JSON.stringify(actionSequence));
            // }

            if (hasFlowChart) {
                logger.info(`Nutze Flussdiagramm für "${taskName}" (Elemente: ${flowChart!.elements.length})`);
                await this.executeFlowChart(taskName, flowChart!, vars, globalVars, contextObj, depth, taskLogId);
            } else {
                if (actionSequence.length === 0) {
                    logger.debug(`Task "${taskName}" hat weder FlowChart noch ActionSequence.`);
                }

                for (const seqItem of actionSequence) {
                    try {
                        await this.executeSequenceItem(seqItem, vars, globalVars, contextObj, depth, taskLogId);
                    } catch (err) {
                        logger.error(`Error in item of task ${taskName}: ${err}`);
                        DebugLogService.getInstance().log('Event', `ERROR executing task ${taskName}: ${err}`, { parentId: taskLogId });
                    }
                }
            }

            // local-sync: After execution, sync to other player
            if (isMultiplayer && triggerMode === 'local-sync' && !isRemoteExecution) {
                logger.info(`Syncing task "${taskName}" to other player`);
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
            (e.type === 'task' && e.properties?.name === taskName) ||
            (e.type === 'start')
        );

        if (!startNode) {
            logger.warn(`No start node found in flowChart for task: ${taskName}. elements:`, elements.map(e => `${e.type}:${e.properties?.name || e.id}`));
            return;
        }

        logger.debug(`FlowChart Elements for "${taskName}":`, elements.map(e => `${e.type}:${e.properties?.name || e.id}`));
        logger.debug(`FlowChart vars.eventData =`, vars.eventData, 'contextObj =', contextObj?.name || contextObj?.className);

        const executeNode = async (node: any): Promise<void> => {
            if (!node || visited.has(node.id)) return;
            visited.add(node.id);

            const nodeType = node.type;
            const name = node.properties?.name || node.data?.name || node.data?.actionName;

            // Skip the task node itself (it's just the entry point)
            if (nodeType === 'task' && name === taskName) {
                // Find outgoing connections and execute them
                const outgoing = connections.filter((c: any) => c.startTargetId === node.id);
                for (const conn of outgoing) {
                    const nextNode = elements.find((e: any) => e.id === conn.endTargetId);
                    if (nextNode) await executeNode(nextNode);
                }
                return;
            }


            if (nodeType === 'action') {
                // Execute this action
                // Try to resolve custom action definition FIRST
                let action = this.resolveAction({ type: 'action', name: name });

                // If no custom definition found, OR it's just a placeholder without body, use local node data
                if (!action || (action.type === 'action' && !action.body)) {
                    action = node.data;
                }

                // SAFETY FALLBACK: If we still have an action but it's missing the 'type', 
                // it might be a corrupted link. Try to fix it.
                if (action && (!action.type || action.type === 'action') && name) {
                    logger.warn(`Action "${name}" is missing or has generic type. Attempting rescue via resolveAction.`);
                    const rescued = this.resolveAction(name); // Search by name directly
                    if (rescued && rescued !== action && rescued.type && rescued.type !== 'action') {
                        action = { ...rescued, ...action, type: rescued.type };
                    } else if (node.data?.type && node.data.type !== 'action') {
                        action.type = node.data.type; // Fallback to raw data
                    }
                }

                if (action && action.type && action.type !== 'action') {
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
                                    resolvedParams[key] = TaskConditionEvaluator.resolveVarPath(varName, vars, globalVars);
                                } else if (value.startsWith('$')) {
                                    const varName = value.slice(1);
                                    resolvedParams[key] = TaskConditionEvaluator.resolveVarPath(varName, vars, globalVars);
                                } else {
                                    resolvedParams[key] = value;
                                }
                            } else {
                                resolvedParams[key] = value;
                            }
                        }
                        logger.debug(`FlowChart: Executing action body for "${action.name}" with params:`, resolvedParams);

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

            if (nodeType === 'task' || nodeType === 'task') {
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

            if (nodeType === 'data_action' || nodeType === 'data_action') {
                // Execute DataAction
                const action = this.resolveAction({ type: 'data_action', name: name }) || node.data;

                if (action) {
                    logger.info(`FlowChart: Executing DataAction "${name}"`);
                    const result = await this.actionExecutor.execute(action, vars, globalVars, contextObj, parentId);
                    const isSuccess = result !== false;

                    logger.info(`DataAction "${name}" finished. Success: ${isSuccess}`);

                    // Find the appropriate branch connection
                    const successConn = connections.find((c: any) =>
                        c.startTargetId === node.id &&
                        (c.data?.startAnchorType === 'success' || c.data?.anchorType === 'success' || c.data?.startAnchorType === 'true')
                    );
                    const errorConn = connections.find((c: any) =>
                        c.startTargetId === node.id &&
                        (c.data?.startAnchorType === 'error' || c.data?.anchorType === 'error' || c.data?.startAnchorType === 'false')
                    );

                    if (isSuccess && successConn) {
                        const successNode = elements.find((e: any) => e.id === successConn.endTargetId);
                        if (successNode) await executeNode(successNode);
                    } else if (!isSuccess && errorConn) {
                        const errorNode = elements.find((e: any) => e.id === errorConn.endTargetId);
                        if (errorNode) await executeNode(errorNode);
                    } else {
                        // Fallback: regular outgoing connection
                        const outgoing = connections.find((c: any) =>
                            c.startTargetId === node.id &&
                            !['success', 'error', 'true', 'false'].includes(c.data?.startAnchorType || c.data?.anchorType || '')
                        );
                        if (outgoing) {
                            const nextNode = elements.find((e: any) => e.id === outgoing.endTargetId);
                            if (nextNode) await executeNode(nextNode);
                        }
                    }
                }
                return;
            }

            if (nodeType === 'condition' || nodeType === 'condition') {
                const condition = node.data?.condition;
                if (!condition) {
                    logger.warn(`Condition node without condition data: ${node.id} `);
                    return;
                }

                // Evaluate the condition
                const result = this.evaluateCondition(condition, vars, globalVars);
                const left = condition.leftValue || condition.variable || '?';
                const right = condition.rightValue || condition.value || '?';
                logger.debug(`Condition ${left} ${condition.operator || '=='} ${right} => ${result} `);

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
        logger.debug(`Processing item: type = "${item.type}" name = "${item.name || 'N/A'}" condition = "${item.condition?.variable || 'none'}"`);

        // Check condition if present (BUT skip checking for 'condition' type items, as they handle logic internally)
        if (item.type !== 'condition') {
            const condition = item.itemCondition || (typeof item.condition === 'string' ? item.condition : null);
            if (condition && !this.evaluateCondition(condition, vars, globalVars)) {
                logger.debug(`Item condition FALSE, skipping: ${condition} `);
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
                    // Log the action name to DebugLogService
                    DebugLogService.getInstance().log('Action', action.name || item.name, {
                        parentId,
                        data: action
                    });
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
                                        resolvedParams[key] = TaskConditionEvaluator.resolveVarPath(varName, vars, globalVars);
                                    } else if (value.startsWith('$')) {
                                        // Simple $variable reference (e.g. $eventData.body.pin)
                                        resolvedParams[key] = TaskConditionEvaluator.resolveVarPath(value, vars, globalVars);
                                    } else {
                                        resolvedParams[key] = value;
                                    }
                                } else {
                                    resolvedParams[key] = value;
                                }
                            }
                        }
                        logger.debug(`Executing action body for "${action.name}" with params:`, resolvedParams);

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
                    logger.warn(`Action definition not found: ${item.name}`);
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
        if (!item) return null;
        if (typeof item === 'string') {
            return this.actions.find(a => a.name === item) || null;
        }

        // Lookup by name if present
        if (item.name) {
            const found = this.actions.find(a => a.name === item.name);
            if (found) return found;
        }

        // If it was a generic search for 'action' type and not found in custom actions, 
        // return null to allow fallback to node data
        if (item.type === 'action' && !item.body) {
            return null;
        }

        return item;
    }

    private evaluateCondition(condition: any, vars: Record<string, any>, globalVars: Record<string, any>): boolean {
        return TaskConditionEvaluator.evaluateCondition(condition, vars, globalVars);
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
            const varName = item.condition.leftValue || item.condition.variable || '???';
            // Variable resolves either against vars or globalVars
            const varValue = TaskConditionEvaluator.resolveVarPath(varName, vars, globalVars);
            const compareValue = item.condition.rightValue || item.condition.value || '???';
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
        logger.debug(`Condition: ${conditionExpr} => ${result}`);

        if (result) {

            if (item.thenAction) {
                const action = this.resolveAction(item.thenAction);
                logger.debug(`Condition TRUE, executing thenAction: ${item.thenAction} `);
                if (action) await this.actionExecutor.execute(action, vars, globalVars, contextObj, parentId);
            }
            if (item.thenTask) {
                logger.debug(`Condition TRUE, executing thenTask: ${item.thenTask} `);
                await this.execute(item.thenTask, vars, globalVars, contextObj, depth + 1, parentId);
            }
            if (item.body) {

                await this.executeBody(item.body, vars, globalVars, contextObj, depth, parentId);
            }
            if (item.then) await this.executeBody(item.then, vars, globalVars, contextObj, depth, parentId);
        } else {

            if (item.elseAction) {
                const action = this.resolveAction(item.elseAction);
                if (action) await this.actionExecutor.execute(action, vars, globalVars, contextObj, parentId);
            }
            if (item.elseTask) await this.execute(item.elseTask, vars, globalVars, contextObj, depth + 1, parentId);
            if (item.elseBody) {

                await this.executeBody(item.elseBody, vars, globalVars, contextObj, depth, parentId);
            }
            if (item.else) await this.executeBody(item.else, vars, globalVars, contextObj, depth, parentId);
        }
    }

    /**
     * WHILE loop: Execute body while condition is true
     */
    private async handleWhile(item: any, vars: Record<string, any>, globalVars: Record<string, any>, contextObj: any, depth: number, parentId?: string): Promise<void> {
        await TaskLoopHandler.handleWhile(item, vars, globalVars, contextObj, depth, parentId, this.executeBody.bind(this));
    }

    /**
     * FOR loop: Execute body for each value from 'from' to 'to'
     */
    private async handleFor(item: any, vars: Record<string, any>, globalVars: Record<string, any>, contextObj: any, depth: number, parentId?: string): Promise<void> {
        await TaskLoopHandler.handleFor(item, vars, globalVars, contextObj, depth, parentId, this.executeBody.bind(this));
    }

    /**
     * FOREACH loop: Execute body for each item in array
     */
    private async handleForeach(item: any, vars: Record<string, any>, globalVars: Record<string, any>, contextObj: any, depth: number, parentId?: string): Promise<void> {
        await TaskLoopHandler.handleForeach(item, vars, globalVars, contextObj, depth, parentId, this.executeBody.bind(this));
    }

    /**
     * Executes a data action and branches based on the result
     */
    private async handleDataAction(item: any, vars: Record<string, any>, globalVars: Record<string, any>, contextObj: any, depth: number, parentId?: string): Promise<boolean> {
        const action = this.resolveAction(item);
        if (!action) {
            logger.warn(`DataAction definition not found: ${item.name || item.type}`);
            return false;
        }

        logger.debug(`Executing DataAction: ${action.name || action.type}`);

        // Execute the action and get the result
        const result = await this.actionExecutor.execute(action, vars, globalVars, contextObj, parentId);

        // Branching: result !== false is considered success
        const isSuccess = result !== false;
        logger.debug(`DataAction "${action.name || action.type}" finished. Success: ${isSuccess}`);

        const body = isSuccess ? item.successBody : item.errorBody;
        if (body && Array.isArray(body)) {
            await this.executeBody(body, vars, globalVars, contextObj, depth, parentId);
        }

        return isSuccess;
    }
}
