import { mediatorService } from '../../services/MediatorService';
import { FlowElement } from '../flow/FlowElement';
import { FlowAction } from '../flow/FlowAction';
import { FlowTask } from '../flow/FlowTask';
import { FlowCondition } from '../flow/FlowCondition';
import { FlowVariable } from '../flow/FlowVariable';
import { FlowLoop } from '../flow/FlowLoop';
import { FlowStart } from '../flow/FlowStart';
import { FlowThresholdVariable } from '../flow/FlowThresholdVariable';
import { FlowTriggerVariable } from '../flow/FlowTriggerVariable';
import { FlowTimerVariable } from '../flow/FlowTimerVariable';
import { FlowRangeVariable } from '../flow/FlowRangeVariable';
import { FlowListVariable } from '../flow/FlowListVariable';
import { FlowRandomVariable } from '../flow/FlowRandomVariable';
import { FlowConnection } from '../flow/FlowConnection';
import { FlowDataAction } from '../flow/FlowDataAction';

export interface FlowSyncHost {
    project: any;
    currentFlowContext: string;
    nodes: FlowElement[];
    connections: FlowConnection[];
    canvas: HTMLElement;
    cellSize: number;
    showDetails: boolean;
    onProjectChange?: () => void;
    updateFlowSelector: () => void;
    getActiveStage: () => any;
    getTargetFlowCharts: (context: string) => any;
    setupNodeListeners: (node: FlowElement) => void;
}

export class FlowSyncManager {
    private host: FlowSyncHost;

    constructor(host: FlowSyncHost) {
        this.host = host;
    }

    public syncAllTasksFromFlow() {
        if (!this.host.project) return;
        console.log('[FlowSyncManager] Syncing all tasks from flow...');

        const processCollection = (tasks: any[]) => {
            if (!tasks) return;
            tasks.forEach(task => {
                const targetFlow = this.host.getTargetFlowCharts(task.name);
                if (targetFlow?.elements) {
                    this.syncTaskFromFlow(task, targetFlow.elements, targetFlow.connections || []);
                }
            });
        };

        processCollection(this.host.project.tasks);
        if (this.host.project.stages) {
            this.host.project.stages.forEach((s: any) => processCollection(s.tasks));
        }
    }

    public syncActionsFromProject() {
        if (!this.host.project) return;
        this.host.nodes.forEach(node => {
            if (node.getType() === 'Action' && node.data?.isLinked) {
                const actionName = node.Name || node.data.name;
                const actionDef = this.host.project.actions.find((a: any) => a.name === actionName);
                if (actionDef) {
                    node.data = { ...node.data, ...actionDef };
                    (node as FlowAction).setShowDetails(this.host.showDetails, this.host.project);
                }
            }
        });
    }

    public syncToProject(currentContext: string) {
        if (!this.host.project) return;
        if (currentContext === 'event-map' || currentContext === 'element-overview') return;

        // Ghost node handling
        const proxyNodes = this.host.nodes.filter(n => n.data?.isExpanded);
        proxyNodes.forEach(proxy => {
            const ghosts = this.host.nodes.filter(n => n.data?.parentProxyId === proxy.name);
            const ghostPositions: Record<string, { x: number, y: number }> = {};
            ghosts.forEach(g => {
                ghostPositions[g.data.originalId] = { x: g.X, y: g.Y };
            });
            proxy.data.ghostPositions = ghostPositions;

            const ghostConns = this.host.connections.filter(c => c.data?.parentProxyId === proxy.name);
            proxy.data.ghostConnections = ghostConns.map(c => ({
                startOriginalId: c.startTarget?.data?.originalId,
                endOriginalId: c.endTarget?.data?.originalId,
                startAnchorType: c.data?.startAnchorType || 'output',
                originalStartAnchorType: c.data?.originalStartAnchorType,
                endAnchorType: c.data?.endAnchorType || 'input'
            }));
        });

        const persistentNodes = this.host.nodes.filter(n => !n.data?.isEmbeddedInternal && !n.data?.parentProxyId);
        const elements = persistentNodes.map(n => n.toJSON());

        const persistentConnections = this.host.connections.filter(c => !c.data?.isEmbeddedInternal && !c.data?.parentProxyId);
        const connections = persistentConnections.map(c => c.toJSON());

        this.host.nodes.forEach(node => {
            if (node.getType() === 'Action' && node.data && !node.data.isEmbeddedInternal) {
                const actionName = node.Name || node.data.name || node.data.actionName;
                if (actionName) {
                    this.updateGlobalActionDefinition({ details: (node as any).Details, ...node.data, name: actionName });
                }
            }

            if (node.getType() === 'Task' && node.data && !node.data.isEmbeddedInternal) {
                const taskName = node.Name || node.data.taskName;
                if (taskName) {
                    this.ensureTaskExists(taskName, (node as any).Details || "");
                }
            }
        });

        const targetCharts = this.host.getTargetFlowCharts(currentContext);
        if (currentContext === 'global') {
            if (this.host.project.flowCharts) {
                this.host.project.flowCharts.global = { elements, connections };
            } else {
                this.host.project.flow = { elements, connections };
            }
        } else {
            if (targetCharts) {
                // BUG FIX: Store under the specific task name key, not directly on the collection object
                const chartData = { elements, connections };
                targetCharts[currentContext] = chartData;

                const task = this.host.project.tasks.find((t: any) => t.name === currentContext) ||
                    this.host.getActiveStage()?.tasks.find((t: any) => t.name === currentContext);

                if (task) {
                    this.syncTaskFromFlow(task, elements, connections);
                    // Single Source of Truth: update the local reference too
                    task.flowChart = chartData;
                    if ((task as any).flowGraph) delete (task as any).flowGraph;
                }
            }
        }

        if (this.host.onProjectChange) this.host.onProjectChange();
        this.host.updateFlowSelector();
        mediatorService.notifyDataChanged(this.host.project, 'flow-editor');
    }

    public syncVariablesFromFlow() {
        if (!this.host.project) return;
        this.host.nodes.forEach(node => {
            if (node.getType() === 'VariableDecl' && node.data?.variable) {
                const varData = node.data.variable;
                const targetCollection = varData.scope === 'global' ?
                    (this.host.project.variables || (this.host.project.variables = [])) :
                    (this.host.getActiveStage()?.variables || []);

                const existingIndex = targetCollection.findIndex((v: any) => v.name === varData.name);
                if (existingIndex !== -1) {
                    targetCollection[existingIndex] = { ...targetCollection[existingIndex], ...varData };
                } else {
                    targetCollection.push(varData);
                }
            }
        });
    }

    private syncTaskFromFlow(task: any, elements: any[], connections: any[]) {
        if (this.host.currentFlowContext === 'event-map' || this.host.currentFlowContext === 'element-overview') {
            return;
        }

        const startNode = elements.find(e => e.type === 'Task' || (e.type === 'Start' && e.properties?.text?.toLowerCase() === 'start'));
        if (!startNode) return;

        const sequence: any[] = [];
        const visited = new Set<string>();

        const buildSequence = (nodeId: string, targetSeq: any[], stopSet: Set<string> = new Set()) => {
            if (visited.has(nodeId) || stopSet.has(nodeId)) return;
            visited.add(nodeId);

            const node = elements.find(e => e.id === nodeId);
            if (!node) return;

            if (node.type === 'Action') {
                const actionName = node.data?.name || node.data?.actionName || node.properties?.name || node.properties?.text;
                if (actionName) {
                    // --- MODIFIED: Use node.data to preserve ALL properties (params, etc.) ---
                    const actionItem = { ...node.data, type: 'action', name: actionName };
                    // Remove UI-only internal data
                    delete (actionItem as any).isLinked;
                    delete (actionItem as any).parentProxyId;
                    delete (actionItem as any).isEmbeddedInternal;
                    delete (actionItem as any).originalId;

                    targetSeq.push(actionItem);
                }
                const nextConn = connections.find(c => c.startTargetId === nodeId);
                if (nextConn) buildSequence(nextConn.endTargetId, targetSeq, stopSet);
            } else if (node.type === 'Condition' || node.type === 'DataAction') {
                const isData = node.type === 'DataAction';
                const branchType = isData ? 'data_action' : 'condition';
                const branchItem: any = {
                    type: branchType,
                    ...(isData ? node.data : { condition: node.properties?.text || '' }),
                    [isData ? 'successBody' : 'body']: [],
                    [isData ? 'errorBody' : 'elseBody']: []
                };
                targetSeq.push(branchItem);

                const trueAnchor = isData ? 'success' : 'true';
                const falseAnchor = isData ? 'error' : 'false';

                const trueConn = connections.find(c => c.startTargetId === nodeId && c.data?.startAnchorType === trueAnchor);
                const falseConn = connections.find(c => c.startTargetId === nodeId && c.data?.startAnchorType === falseAnchor);

                const mergePoints = new Set<string>();
                const trueVisited = new Set<string>();
                const falseVisited = new Set<string>();

                const findReachable = (id: string, v: Set<string>) => {
                    if (v.has(id)) return; v.add(id);
                    connections.filter(c => c.startTargetId === id).forEach(c => findReachable(c.endTargetId, v));
                };

                if (trueConn) findReachable(trueConn.endTargetId, trueVisited);
                if (falseConn) findReachable(falseConn.endTargetId, falseVisited);
                trueVisited.forEach(id => { if (falseVisited.has(id)) mergePoints.add(id); });

                if (trueConn) buildSequence(trueConn.endTargetId, branchItem[isData ? 'successBody' : 'body'], mergePoints);
                if (falseConn) buildSequence(falseConn.endTargetId, branchItem[isData ? 'errorBody' : 'elseBody'], mergePoints);

                const firstMerge = Array.from(mergePoints).filter(id => {
                    const incoming = connections.filter(c => c.endTargetId === id);
                    return incoming.every(c => trueVisited.has(c.startTargetId) || falseVisited.has(c.startTargetId));
                })[0];

                if (firstMerge) {
                    visited.delete(firstMerge);
                    buildSequence(firstMerge, targetSeq, stopSet);
                }
            } else if (node.type === 'Task' && node.id !== startNode.id) {
                targetSeq.push({ type: 'task', name: node.properties?.name || node.properties?.text });
                const nextConn = connections.find(c => c.startTargetId === nodeId);
                if (nextConn) buildSequence(nextConn.endTargetId, targetSeq, stopSet);
            } else if (['While', 'For', 'Repeat'].includes(node.type)) {
                const loop: any = { type: node.type.toLowerCase(), body: [] };
                if (node.type === 'While') loop.condition = node.properties?.text || '';
                if (node.type === 'Repeat') loop.count = parseInt(node.properties?.text) || 1;
                targetSeq.push(loop);

                const bodyConn = connections.find(c => c.startTargetId === nodeId && c.data?.startAnchorType === 'output');
                const nextConn = connections.find(c => c.startTargetId === nodeId && c.data?.startAnchorType === 'bottom');

                if (bodyConn) buildSequence(bodyConn.endTargetId, loop.body, new Set([nodeId]));
                if (nextConn) buildSequence(nextConn.endTargetId, targetSeq, stopSet);
            }
        };

        const initialOutgoing = connections.filter(c => c.startTargetId === startNode.id);
        initialOutgoing.sort((a) => (a.data?.startAnchorType === 'output' ? -1 : 1));
        if (initialOutgoing.length > 0) {
            buildSequence(initialOutgoing[0].endTargetId, sequence);
        }

        if (sequence.length > 0) {
            // --- MODIFIED: Preserve extra data from node.data to prevent loss of 'params', 'resultVariable', etc. ---
            task.actionSequence = sequence.map(item => {
                // If we have an original id, try to find the original item data to preserve fields
                // that might not be part of the visual node structure but are essential for runtime.
                // However, building 'sequence' already uses node.data where possible.
                // We just need to ensure node.data isn't just {type, name}.
                return item;
            });
        }

        // --- NEW: Sync Parameters and their values ---
        this.syncTaskParameters(task, elements);
        this.syncTaskParamValues(task, elements);
    }

    private syncTaskParameters(task: any, elements: any[]) {
        const usedParams = new Map<string, { types: Set<string>, sources: string[] }>();
        const paramRegex = /\$\{(\w+)\}/g;

        elements.forEach((el: any) => {
            if (el.type !== 'Action') return;
            const jsonStr = JSON.stringify(el.data || {});
            let match;
            while ((match = paramRegex.exec(jsonStr)) !== null) {
                const paramName = match[1];
                if (!usedParams.has(paramName)) {
                    usedParams.set(paramName, { types: new Set<string>(), sources: [] });
                }
                usedParams.get(paramName)!.sources.push(el.properties?.name || el.id);
                if (/velocity|speed|x|y|width|height|size|delay|duration/i.test(paramName)) {
                    usedParams.get(paramName)!.types.add('number');
                } else {
                    usedParams.get(paramName)!.types.add('string');
                }
            }
        });

        if (!task.params) task.params = [];
        const existingParamNames = new Set(task.params.map((p: any) => p.name));
        const nowUsedNames = new Set(usedParams.keys());

        usedParams.forEach((info, paramName) => {
            if (!existingParamNames.has(paramName)) {
                const type = info.types.has('number') ? 'number' : 'string';
                task.params.push({ name: paramName, type, label: paramName, default: type === 'number' ? 0 : '' });
            }
        });

        task.params = task.params.filter((p: any) => p.fromLibrary || nowUsedNames.has(p.name));
    }

    private syncTaskParamValues(task: any, elements: any[]) {
        if (!task.params || !Array.isArray(task.params)) return;
        const taskNode = elements.find(el => el.type === 'Task' && (el.properties?.name === task.name || el.data?.taskName === task.name));
        if (!taskNode) return;
        const paramValues = taskNode.data?.paramValues || taskNode.data?.params;
        if (!paramValues || typeof paramValues !== 'object') return;

        task.params.forEach((p: any) => {
            if (p.name && paramValues[p.name] !== undefined) {
                p.default = paramValues[p.name];
            }
        });
    }

    public generateFlowFromActionSequence(task: any): { elements: any[], connections: any[] } {
        const elements: any[] = [];
        const connections: any[] = [];

        // --- NEW: Use the Task itself as the root instead of a generic Start node ---
        const rootId = 'root_task_' + Date.now();
        const taskName = task.name || 'Unbenannter Task';

        elements.push({
            id: rootId,
            type: 'Task',
            x: 400,
            y: 50,
            properties: {
                name: taskName,
                text: taskName
            },
            data: { taskName: taskName }
        });

        let nextNodeId = 0;
        const getNewId = (type: string) => `auto_${type}_${nextNodeId++}_${Date.now()}`;

        const process = (sequence: any[], startNodeId: string, startAnchor: string = 'output', _branch?: 'true' | 'false', startX: number = 400, startY: number = 200): { lastId: string, endY: number } => {
            let currentY = startY;
            let lastId = startNodeId;
            let lastAnchor = startAnchor;

            sequence.forEach(item => {
                const id = getNewId(item.type || 'action');
                if (item.type === 'condition') {
                    elements.push({ id, type: 'Condition', x: startX, y: currentY, properties: { text: item.condition || item.expression || '' } });
                    connections.push({
                        startTargetId: lastId, endTargetId: id,
                        data: { startAnchorType: lastAnchor, endAnchorType: 'input' }
                    });
                    const thenRes = process(item.body || item.then || [], id, 'true', 'true', startX - 250, currentY + 120);
                    const elseRes = process(item.elseBody || item.else || [], id, 'false', 'false', startX + 250, currentY + 120);
                    currentY = Math.max(thenRes.endY, elseRes.endY) + 50;
                    const mergeId = getNewId('merge');
                    elements.push({ id: mergeId, type: 'Action', x: startX - 80, y: currentY, properties: { name: 'Merge', text: 'Merge' } });
                    connections.push({ startTargetId: thenRes.lastId, endTargetId: mergeId, data: { startAnchorType: 'output', endAnchorType: 'input' } });
                    connections.push({ startTargetId: elseRes.lastId, endTargetId: mergeId, data: { startAnchorType: 'output', endAnchorType: 'input' } });
                    lastId = mergeId; lastAnchor = 'output'; currentY += 120;
                } else if (['while', 'for', 'repeat'].includes(item.type)) {
                    elements.push({
                        id, type: item.type.charAt(0).toUpperCase() + item.type.slice(1) as any,
                        x: startX, y: currentY,
                        properties: { text: item.condition || item.count || '' }
                    });
                    connections.push({
                        startTargetId: lastId, endTargetId: id,
                        data: { startAnchorType: lastAnchor, endAnchorType: 'input' }
                    });
                    const bodyRes = process(item.body || [], id, 'output', undefined, startX, currentY + 120);
                    lastId = id; lastAnchor = 'bottom'; currentY = bodyRes.endY + 100;
                } else {
                    const isTask = item.type === 'execute_task' || item.type === 'task';
                    const itemName = item.name || item.taskName || item.action || item.type || 'Aktion';

                    elements.push({
                        id, type: isTask ? 'Task' : 'Action',
                        x: startX, y: currentY,
                        properties: {
                            name: itemName,
                            text: itemName
                        },
                        data: { ...item }
                    });
                    connections.push({
                        startTargetId: lastId, endTargetId: id,
                        data: { startAnchorType: lastAnchor, endAnchorType: 'input' }
                    });
                    lastId = id; lastAnchor = 'output'; currentY += 120;
                }
            });
            return { lastId, endY: currentY };
        };

        if (task.actionSequence?.length > 0) {
            process(task.actionSequence, rootId);
        }
        return { elements, connections };
    }

    /**
     * Bereinigt das Projekt von korrupten Task-Einträgen (z.B. "elements" oder "connections" fälschlicherweise in der Task-Liste)
     */
    public cleanCorruptTaskData() {
        if (!this.host.project) return;
        console.log('[FlowSyncManager] Starte Bereinigung korrupter Task-Daten...');

        const cleanCollection = (tasks: any[]) => {
            if (!tasks) return tasks;
            return tasks.filter(t => {
                if (t.name === 'elements' || t.name === 'connections') {
                    console.warn(`[FlowSyncManager] Entferne fälschlichen Task: ${t.name}`);
                    return false;
                }
                return true;
            });
        };

        this.host.project.tasks = cleanCollection(this.host.project.tasks);
        if (this.host.project.stages) {
            this.host.project.stages.forEach((s: any) => {
                s.tasks = cleanCollection(s.tasks);
            });
        }
    }

    public restoreNode(data: any): FlowElement | null {
        let node: FlowElement | null = null;
        const cellSize = this.host.cellSize;
        const canvas = this.host.canvas;
        const snap = true;

        switch (data.type) {
            case 'Start':
                node = new FlowStart(data.id, data.x, data.y, canvas, cellSize);
                break;
            case 'Action':
                node = new FlowAction(data.id, data.x, data.y, canvas, cellSize);
                break;
            case 'DataAction':
                node = new FlowDataAction(data.id, data.x, data.y, canvas, cellSize);
                break;
            case 'Condition':
                node = new FlowCondition(data.id, data.x, data.y, canvas, cellSize);
                break;
            case 'Task':
                node = new FlowTask(data.id, data.x, data.y, canvas, cellSize);
                break;
            case 'VariableDecl':
                node = this.restoreVariableNode(data);
                break;
            case 'While':
            case 'For':
            case 'Repeat':
                node = new FlowLoop(data.id, data.x, data.y, canvas, cellSize, data.type);
                break;
        }

        if (node) {
            node.setGridConfig(cellSize, snap);

            // Restore size and position with grid snapping and NaN safety
            const w = isNaN(data.width) ? 150 : data.width;
            const h = isNaN(data.height) ? 60 : data.height;
            const dx = isNaN(data.x) ? 0 : data.x;
            const dy = isNaN(data.y) ? 0 : data.y;

            node.Width = Math.round(w / cellSize) * cellSize;
            node.Height = Math.round(h / cellSize) * cellSize;
            node.X = Math.round(dx / cellSize) * cellSize;
            node.Y = Math.round(dy / cellSize) * cellSize;

            if (data.properties) {
                if (data.properties.name) node.Name = data.properties.name;
                if (data.properties.details) node.Details = data.properties.details;
                if (data.properties.description) node.Description = data.properties.description;
                if (data.properties.text && !data.properties.name) node.Name = data.properties.text;
            }

            // Ensure project reference is set for Action and Task nodes
            if (this.host.project && (node instanceof FlowTask || node instanceof FlowAction)) {
                (node as any).setProjectRef(this.host.project);
            }

            if (node instanceof FlowVariable) (node as any).updateVisuals?.();
            if (node instanceof FlowLoop) (node as any).updateVisuals?.();

            node.data = data.data || {};

            // SINGLE SOURCE OF TRUTH: For Action nodes, load data from project.actions
            if (data.type === 'Action' && this.host.project) {
                const actionName = data.properties?.name || data.data?.name;
                const stage = this.host.getActiveStage();
                const projectAction = (this.host.project.actions || []).find((a: any) => a.name === actionName) ||
                    (stage?.actions || []).find((a: any) => a.name === actionName);

                if (projectAction) {
                    node.data = { ...node.data, ...projectAction };
                }
            }

            this.host.setupNodeListeners(node);
        }

        return node;
    }

    private restoreVariableNode(data: any): FlowElement {
        const { id, x, y } = data;
        const kind = data.data?.variable?.type;
        let node: FlowVariable;

        if (kind === 'threshold') node = new FlowThresholdVariable(id, x, y, this.host.canvas, this.host.cellSize);
        else if (kind === 'trigger') node = new FlowTriggerVariable(id, x, y, this.host.canvas, this.host.cellSize);
        else if (kind === 'timer') node = new FlowTimerVariable(id, x, y, this.host.canvas, this.host.cellSize);
        else if (kind === 'range') node = new FlowRangeVariable(id, x, y, this.host.canvas, this.host.cellSize);
        else if (kind === 'list') node = new FlowListVariable(id, x, y, this.host.canvas, this.host.cellSize);
        else if (kind === 'random') node = new FlowRandomVariable(id, x, y, this.host.canvas, this.host.cellSize);
        else node = new FlowVariable(id, x, y, this.host.canvas, this.host.cellSize);

        return node;
    }

    public findActionInSequence(sequence: any[], name: string): any | null {
        if (!sequence) return null;
        for (const item of sequence) {
            const itemName = item.name || item.actionName;
            if (itemName === name) return item;
            if (item.body) {
                const found = this.findActionInSequence(item.body, name);
                if (found) return found;
            }
            if (item.then) {
                const found = this.findActionInSequence(item.then, name);
                if (found) return found;
            }
            if (item.else) {
                const found = this.findActionInSequence(item.else, name);
                if (found) return found;
            }
        }
        return null;
    }

    public updateGlobalActionDefinition(actionData: any) {
        if (!this.host.project) return;
        const name = actionData.name || actionData.actionName;
        if (!name) return;

        const canBeParsed = actionData.details && this.parseDetailsToCommand(actionData.details);
        const isMinimalLink = actionData.isLinked && !actionData.type && !actionData.target && !actionData.service && !canBeParsed;
        if (isMinimalLink) return;

        if (!this.host.project.actions) this.host.project.actions = [];
        const taskFields = ['taskName', 'isMapLink', 'isProxy', 'stageObjectId', 'embeddedGroupId', 'parentProxyId', 'isLinked', 'isEmbeddedInternal', 'isExpanded', 'sourceTaskName', '_formValues'];
        const cleanedData = { ...actionData };
        taskFields.forEach(field => delete cleanedData[field]);

        const newAction = { ...cleanedData, name };
        if (newAction.details && !newAction.type && !newAction.target && !newAction.service && !newAction.calcSteps) {
            const parsed = this.parseDetailsToCommand(newAction.details);
            if (parsed) Object.assign(newAction, parsed);
        }

        if (newAction.actionName) delete newAction.actionName;
        const targetCollection = (this.host as any).editor ? (this.host as any).editor.getTargetActionCollection(name) : (this.host.project.actions || []);
        const idx = targetCollection.findIndex((a: any) => a.name === name);
        if (idx !== -1) targetCollection[idx] = { ...targetCollection[idx], ...newAction };
        else targetCollection.push(newAction);
    }

    public registerActionsFromTask(task: any) {
        if (!this.host.project) return;
        const processSequence = (sequence: any[]) => {
            if (!sequence) return;
            sequence.forEach(item => {
                const name = item.name || item.actionName;
                if (name) this.updateGlobalActionDefinition(item);
                if (item.body) processSequence(item.body);
                if (item.then) processSequence(item.then);
                if (item.else) processSequence(item.else);
            });
        };
        processSequence(task.actionSequence);

        if (task.flowChart?.elements) {
            task.flowChart.elements.forEach((el: any) => {
                if (el.type === 'Action') {
                    const name = el.properties?.name || el.data?.name || el.data?.actionName;
                    const isMeaningful = el.data?.type || el.data?.actionName || el.data?.taskName;
                    if (name && (name !== 'Action' && name !== 'Aktion' || isMeaningful)) {
                        this.updateGlobalActionDefinition({ ...el.data, name });
                    }
                }
            });
        }
    }

    private parseDetailsToCommand(details: string): any {
        if (!details) return null;
        const commands = details.split(';').map(s => s.trim()).filter(s => s.length > 0);
        if (commands.length > 1) {
            const subParses = commands.map(cmd => {
                const match = cmd.match(/^([a-zA-Z0-9_.]+)\s*:=\s*(.+)$/);
                if (match) {
                    const target = match[1];
                    const source = match[2].trim();
                    if (target.includes('.')) {
                        const [objName, propName] = target.split('.');
                        return { objName, propName, source };
                    }
                }
                return null;
            }).filter(p => p !== null);

            if (subParses.length > 0) {
                const targetObj = subParses[0]!.objName;
                if (subParses.every(p => p!.objName === targetObj)) {
                    const changes: Record<string, any> = {};
                    subParses.forEach(p => {
                        let finalVal: any = p!.source;
                        if (p!.source.startsWith("'") && p!.source.endsWith("'")) finalVal = p!.source.slice(1, -1);
                        else if (/^\d+(\.\d+)?$/.test(p!.source)) finalVal = parseFloat(p!.source);
                        else if (/^[a-zA-Z0-9_$]+$/.test(p!.source)) finalVal = `\${${p!.source}}`;
                        changes[p!.propName] = finalVal;
                    });
                    return { type: 'property', target: targetObj, changes };
                }
            }
        }

        const assignMatch = details.match(/^([a-zA-Z0-9_.]+)\s*:=\s*(.+)$/);
        if (assignMatch) {
            const target = assignMatch[1];
            let source = assignMatch[2].trim();
            if (target.includes('.')) {
                const [objName, propName] = target.split('.');
                let val: any = source;
                if (source.startsWith("'") && source.endsWith("'")) val = source.slice(1, -1);
                else if (/^\d+(\.\d+)?$/.test(source)) val = parseFloat(source);
                else if (/^[a-zA-Z0-9_$]+$/.test(source)) val = `\${${source}}`;
                return { type: 'property', target: objName, changes: { [propName]: val } };
            } else {
                const isNumeric = /^\d+(\.\d+)?$/.test(source);
                return { type: 'calculate', resultVariable: target, calcSteps: [{ operandType: isNumeric ? 'constant' : 'variable', constant: isNumeric ? parseFloat(source) : 0, variable: isNumeric ? undefined : source }] };
            }
        }
        return null;
    }

    private ensureTaskExists(name: string, description: string) {
        if (!this.host.project) return;
        const exists = this.host.project.tasks.some((t: any) => t.name === name) ||
            this.host.project.stages?.some((s: any) => s.tasks?.some((t: any) => t.name === name));

        if (!exists) {
            const newTask = { name, description, params: [], actionSequence: [] };
            const activeStage = this.host.getActiveStage();
            if (activeStage) {
                if (!activeStage.tasks) activeStage.tasks = [];
                activeStage.tasks.push(newTask);
            } else {
                if (!this.host.project.tasks) this.host.project.tasks = [];
                this.host.project.tasks.push(newTask);
            }
            console.log(`[FlowSyncManager] Pre-registered new task: ${name}`);
        }
    }
}
