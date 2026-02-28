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
import { Logger } from '../../utils/Logger';

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
    getTaskDefinitionByName: (name: string) => any;
    setupNodeListeners: (node: FlowElement) => void;
}

export class FlowSyncManager {
    private static logger = Logger.get('FlowSyncManager', 'Flow_Sync');
    private host: FlowSyncHost;

    constructor(host: FlowSyncHost) {
        this.host = host;
    }

    public syncAllTasksFromFlow() {
        if (!this.host.project) return;
        FlowSyncManager.logger.info('Syncing all tasks from flow...');

        const processCollection = (tasks: any[]) => {
            if (!tasks) return;
            tasks.forEach(task => {
                const collection = this.host.getTargetFlowCharts(task.name);
                // The collection is a map of taskName -> chart
                const chart = collection[task.name];

                if (chart && chart.elements) {
                    this.syncTaskFromFlow(task, chart.elements, chart.connections || []);
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
        FlowSyncManager.logger.debug(`syncToProject start for context: ${currentContext}`);
        if (currentContext === 'event-map' || currentContext === 'element-overview') {
            FlowSyncManager.logger.debug(`syncToProject skipped for special context: ${currentContext}`);
            return;
        }

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

        FlowSyncManager.logger.debug(`syncToProject: Detected ${elements.length} nodes and ${connections.length} connections.`);
        elements.forEach(el => FlowSyncManager.logger.debug(`  - Node: ${el.id} (${el.type}) name=${el.properties?.name}`));
        connections.forEach(c => FlowSyncManager.logger.debug(`  - Conn: ${c.startTargetId} -> ${c.endTargetId} (${c.data?.startAnchorType})`));

        this.host.nodes.forEach(node => {
            const nodeType = node.getType();
            if ((nodeType === 'Action' || nodeType === 'DataAction') && node.data && !node.data.isEmbeddedInternal) {
                const actionName = node.Name || node.data.name || node.data.actionName;
                if (actionName) {
                    // Critical: if it is a linked action, we ONLY sync the basic node metadata (name, positions)
                    // We must NOT call updateGlobalActionDefinition with node.data if it is sparse/linked,
                    // as that would overwrite the full global definition with minimal data.
                    if (node.data.isLinked) {
                        // Just ensure the global action exists, don't update its core logic from the sparse node
                        // However, we might want to sync 'details' if it's the only thing that changed visually?
                        // No, 'details' should be derived from global action.
                        // Let's just skip updating the logic part.
                    } else {
                        this.updateGlobalActionDefinition({ details: (node as any).Details, ...node.data, name: actionName });
                    }
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

                // FIX: Use hierarchical search instead of just root/active stage
                const task = this.host.getTaskDefinitionByName(currentContext);

                if (task) {
                    const container = (this.host as any).projectRegistry?.getTaskContainer(currentContext);
                    const containerInfo = container ? `${container.type} ${container.stageId || ''}` : 'unknown';

                    FlowSyncManager.logger.info(`Syncing task logic for "${currentContext}" (Location: ${containerInfo}). Current sequence length: ${task.actionSequence?.length || 0}`);
                    this.syncTaskFromFlow(task, elements, connections);
                    // Single Source of Truth: update the local reference too
                    task.flowChart = chartData;
                    if ((task as any).flowGraph) delete (task as any).flowGraph;

                    // Final check: did the object actually update?
                    FlowSyncManager.logger.info(`Sync completed for "${currentContext}". New sequence length: ${task.actionSequence?.length || 0}`);
                    // CLEANUP: Ensure we don't have redundant flowCharts in other stages if this is a global task
                    this.cleanupRedundantFlowCharts(currentContext, targetCharts);
                }
            }
        }

        if (this.host.onProjectChange) this.host.onProjectChange();
        this.host.updateFlowSelector();
        FlowSyncManager.logger.debug('syncToProject completed. Notifying mediator with project.');
        mediatorService.notifyDataChanged(this.host.project, 'flow-editor');
    }

    /**
     * Removes flowChart entries from other collections if they exist elsewhere.
     * Prevents split-brain scenarios.
     */
    private cleanupRedundantFlowCharts(taskName: string, primaryCollection: any) {
        if (!this.host.project) return;

        // 1. Check Root
        if (this.host.project.flowCharts && this.host.project.flowCharts !== primaryCollection) {
            if (this.host.project.flowCharts[taskName]) {
                FlowSyncManager.logger.info(`Cleanup: Removed redundant flowChart for ${taskName} from project-root.`);
                delete this.host.project.flowCharts[taskName];
            }
        }

        // 2. Check All Stages
        if (this.host.project.stages) {
            this.host.project.stages.forEach((stage: any) => {
                if (stage.flowCharts && stage.flowCharts !== primaryCollection) {
                    if (stage.flowCharts[taskName]) {
                        FlowSyncManager.logger.info(`Cleanup: Removed redundant flowChart for ${taskName} from stage ${stage.name}.`);
                        delete stage.flowCharts[taskName];
                    }
                }
            });
        }
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
        if (!startNode) {
            FlowSyncManager.logger.debug(`No start node found for task ${task.name}. Skipping sequence sync.`);
            return;
        }

        const sequence: any[] = [];
        const visited = new Set<string>();

        FlowSyncManager.logger.debug(`syncTaskFromFlow: elements=${elements.length}, connections=${connections.length}`);

        const buildSequence = (nodeId: string, targetSeq: any[], stopSet: Set<string> = new Set()) => {
            if (visited.has(nodeId) || stopSet.has(nodeId)) return;
            visited.add(nodeId);

            const node = elements.find(e => e.id === nodeId);
            if (!node) {
                FlowSyncManager.logger.debug(`buildSequence: Node ${nodeId} not found in elements.`);
                return;
            }
            FlowSyncManager.logger.debug(`buildSequence: processing node ${node.id} (${node.type})`);

            if (node.type === 'Action') {
                const actionName = node.data?.name || node.data?.actionName || node.properties?.name || node.properties?.text;
                if (actionName) {
                    // FIX (v3.3.15): Echten Typ der verlinkten Action nachschlagen
                    // Falls isLinked, könnte die globale Def type:'data_action' haben
                    let realType = 'action';
                    if (node.data?.isLinked) {
                        const stage = this.host.getActiveStage();
                        const globalDef = (this.host.project.actions || []).find((a: any) => a.name === actionName)
                            || (stage?.actions || []).find((a: any) => a.name === actionName);
                        if (globalDef?.type === 'data_action') realType = 'data_action';
                    } else if (node.data?.type === 'data_action') {
                        realType = 'data_action';
                    }
                    const actionItem = { ...node.data, type: realType, name: actionName };
                    // Remove UI-only internal data
                    delete (actionItem as any).isLinked;
                    delete (actionItem as any).parentProxyId;
                    delete (actionItem as any).isEmbeddedInternal;
                    delete (actionItem as any).originalId;

                    targetSeq.push(actionItem);
                }
                const nextConns = connections.filter(c => c.startTargetId === nodeId && c.data?.startAnchorType === 'output');
                if (nextConns.length > 0) {
                    nextConns.forEach(nc => buildSequence(nc.endTargetId, targetSeq, stopSet));
                }
            } else if (node.type === 'Condition' || node.type === 'DataAction') {
                const isData = node.type === 'DataAction';
                const branchType = isData ? 'data_action' : 'condition';

                // --- DATA ACTION ENHANCEMENT: Get full definition for linked nodes ---
                let nodeData = { ...node.data };
                if (isData && nodeData.isLinked) {
                    const actionName = node.Name;
                    // Find definition in global or current stage
                    let def = (this.host.project.actions || []).find((a: any) => a.name === actionName);
                    if (!def) {
                        const stage = this.host.getActiveStage();
                        if (stage?.actions) {
                            def = stage.actions.find((a: any) => a.name === actionName);
                        }
                    }
                    if (def) {
                        nodeData = { ...def, ...nodeData, type: 'data_action' };
                    }
                }

                const branchItem: any = {
                    ...(isData ? nodeData : { condition: node.properties?.text || '' }),
                    type: branchType, // Ensure correct type, overwrite if data.type was wrong
                    [isData ? 'successBody' : 'body']: [],
                    [isData ? 'errorBody' : 'elseBody']: []
                };
                targetSeq.push(branchItem);

                const trueAnchor = isData ? 'success' : 'true';
                const falseAnchor = isData ? 'error' : 'false';

                const trueConn = connections.find(c => c.startTargetId === nodeId && (c.data?.startAnchorType === trueAnchor || (isData && c.data?.startAnchorType === 'true')));
                const falseConn = connections.find(c => c.startTargetId === nodeId && (c.data?.startAnchorType === falseAnchor || (isData && c.data?.startAnchorType === 'false')));

                if (isData) {
                    FlowSyncManager.logger.debug(`DataAction ${node.id} connections: success=${trueConn?.endTargetId || 'none'}, error=${falseConn?.endTargetId || 'none'}`);
                } else {
                    FlowSyncManager.logger.debug(`Condition ${node.id} connections: true=${trueConn?.endTargetId || 'none'}, false=${falseConn?.endTargetId || 'none'}`);
                }

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

                if (trueConn) {
                    FlowSyncManager.logger.debug(`Building SUCCESS/TRUE branch for ${node.id}`);
                    buildSequence(trueConn.endTargetId, branchItem[isData ? 'successBody' : 'body'], mergePoints);
                }
                if (falseConn) {
                    FlowSyncManager.logger.debug(`Building ERROR/FALSE branch for ${node.id}`);
                    buildSequence(falseConn.endTargetId, branchItem[isData ? 'errorBody' : 'elseBody'], mergePoints);
                }

                const firstMerge = Array.from(mergePoints).filter(id => {
                    const incoming = connections.filter(c => c.endTargetId === id);
                    return incoming.every(c => trueVisited.has(c.startTargetId) || falseVisited.has(c.startTargetId));
                })[0];

                if (firstMerge) {
                    FlowSyncManager.logger.debug(`Merge point detected at ${firstMerge} after branch ${node.id}`);
                    visited.delete(firstMerge);
                    buildSequence(firstMerge, targetSeq, stopSet);
                }
            } else if (node.type === 'Task' && node.id !== startNode.id) {
                FlowSyncManager.logger.debug(`Inline task call detected: ${node.properties?.name || node.id}`);
                targetSeq.push({ type: 'task', name: node.properties?.name || node.properties?.text });
                const nextConn = connections.find(c => c.startTargetId === nodeId);
                if (nextConn) buildSequence(nextConn.endTargetId, targetSeq, stopSet);
            } else if (['While', 'For', 'Repeat'].includes(node.type)) {
                FlowSyncManager.logger.debug(`Loop detected: ${node.type}`);
                const loop: any = { type: node.type.toLowerCase(), body: [] };
                if (node.type === 'While') loop.condition = node.properties?.text || '';
                if (node.type === 'Repeat') loop.count = parseInt(node.properties?.text) || 1;
                targetSeq.push(loop);

                const bodyConn = connections.find(c => c.startTargetId === nodeId && c.data?.startAnchorType === 'output');
                const nextConn = connections.find(c => c.startTargetId === nodeId && c.data?.startAnchorType === 'bottom');

                if (bodyConn) {
                    FlowSyncManager.logger.debug(`Building LOOP BODY for ${node.id}`);
                    buildSequence(bodyConn.endTargetId, loop.body, new Set([nodeId]));
                }
                if (nextConn) {
                    FlowSyncManager.logger.debug(`Building AFTER-LOOP sequence for ${node.id}`);
                    buildSequence(nextConn.endTargetId, targetSeq, stopSet);
                }
            }
        };

        const initialOutgoing = connections.filter(c => c.startTargetId === startNode.id);
        FlowSyncManager.logger.debug(`Initial outgoing from ${startNode.id}: ${initialOutgoing.length} connections found.`);
        // Robustness: Sort to keep 'output' anchor first, but process ALL outgoing connections
        initialOutgoing.sort((a) => (a.data?.startAnchorType === 'output' ? -1 : 1));

        if (initialOutgoing.length > 0) {
            FlowSyncManager.logger.debug(`Following ${initialOutgoing.length} outgoing paths from start node.`);
            initialOutgoing.forEach(c => {
                FlowSyncManager.logger.debug(`Starting sequence from anchor: ${c.data?.startAnchorType || 'none'} -> ${c.endTargetId}`);
                buildSequence(c.endTargetId, sequence);
            });
        }

        if (sequence.length > 0) {
            FlowSyncManager.logger.debug(`Generated sequence for task ${task.name} with ${sequence.length} top-level items.`);
            FlowSyncManager.logger.debug(`Sequence summary:`, JSON.stringify(sequence.map(i => ({ type: i.type, name: i.name || i.condition }))));
            // --- MODIFIED: Preserve extra data from node.data to prevent loss of 'params', 'resultVariable', etc. ---
            task.actionSequence = sequence.map(item => {
                // If we have an original id, try to find the original item data to preserve fields
                // that might not be part of the visual node structure but are essential for runtime.
                // However, building 'sequence' already uses node.data where possible.
                // We just need to ensure node.data isn't just {type, name}.
                return item;
            });
        } else {
            FlowSyncManager.logger.debug(`Generated EMPTY sequence for task ${task.name}.`);
            task.actionSequence = [];
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
                    // FIX (v3.3.15): data_action Items als 'DataAction'-Knoten rendern
                    const isDataAction = item.type === 'data_action';
                    const itemName = item.name || item.taskName || item.action || item.type || 'Aktion';
                    const nodeType = isTask ? 'Task' : (isDataAction ? 'DataAction' : 'Action');

                    elements.push({
                        id, type: nodeType,
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
     * Bereinigt das Projekt von korrupten Task-Einträgen und verwaisten FlowCharts.
     */
    public cleanCorruptTaskData() {
        if (!this.host.project) return;
        FlowSyncManager.logger.info('Starte Bereinigung korrupter Task-Daten...');

        const cleanCollection = (tasks: any[]) => {
            if (!tasks) return tasks;
            return tasks.filter(t => {
                if (t.name === 'elements' || t.name === 'connections') {
                    FlowSyncManager.logger.warn(`Entferne fälschlichen Task: ${t.name}`);
                    return false;
                }
                return true;
            });
        };

        // 1. Bereinigung der Task-Einträge selbst
        this.host.project.tasks = cleanCollection(this.host.project.tasks);
        if (this.host.project.stages) {
            this.host.project.stages.forEach((s: any) => {
                s.tasks = cleanCollection(s.tasks);
            });
        }

        // 2. Bereinigung verwaister FlowCharts (Robuster Cleanup)
        const cleanFlowCharts = (flowCharts: any, definedTasks: any[]) => {
            if (!flowCharts) return;
            const definedNames = new Set(definedTasks?.map(t => t.name) || []);
            Object.keys(flowCharts).forEach(key => {
                if (key !== 'global' && !definedNames.has(key)) {
                    FlowSyncManager.logger.info(`Entferne verwaisten FlowChart: ${key} (keine Task-Definition gefunden)`);
                    delete flowCharts[key];
                }
            });
        };

        // Global (Root / Blueprint)
        const blueprintStage = this.host.project.stages?.find((s: any) => s.type === 'blueprint' || s.id === 'stage_blueprint');
        if (blueprintStage?.flowCharts) {
            cleanFlowCharts(blueprintStage.flowCharts, blueprintStage.tasks);
        }
        if (this.host.project.flowCharts) {
            cleanFlowCharts(this.host.project.flowCharts, blueprintStage?.tasks || this.host.project.tasks || []);
        }

        // Pro Stage
        if (this.host.project.stages) {
            this.host.project.stages.forEach((stage: any) => {
                if (stage.flowCharts) {
                    cleanFlowCharts(stage.flowCharts, stage.tasks);
                }
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

            // Ensure project reference is set for Action, Task and Variable nodes
            if (this.host.project && (
                node instanceof FlowTask ||
                node instanceof FlowAction ||
                node instanceof FlowVariable
            )) {
                (node as any).setProjectRef(this.host.project);
            }

            if (node instanceof FlowVariable) (node as any).updateVisuals?.();
            if (node instanceof FlowLoop) (node as any).updateVisuals?.();

            node.data = data.data || {};

            // SINGLE SOURCE OF TRUTH: For Action nodes, load data from project.actions
            // FIX (v3.3.15): Wenn die globale Def type:'data_action' ist, Knoten auf FlowDataAction upgraden
            if (data.type === 'Action' && this.host.project) {
                const actionName = data.properties?.name || data.data?.name;
                const stage = this.host.getActiveStage();
                const projectAction = (this.host.project.actions || []).find((a: any) => a.name === actionName) ||
                    (stage?.actions || []).find((a: any) => a.name === actionName);

                if (projectAction) {
                    node.data = { ...node.data, ...projectAction };

                    // UPGRADE: Falls die Action in Wirklichkeit eine DataAction ist,
                    // wird der Knoten durch einen FlowDataAction-Knoten ersetzt.
                    if (projectAction.type === 'data_action' && !(node instanceof FlowDataAction)) {
                        const upgraded = new FlowDataAction(data.id, node.X, node.Y, canvas, cellSize);
                        upgraded.setGridConfig(cellSize, snap);
                        upgraded.Width = node.Width;
                        upgraded.Height = node.Height;
                        upgraded.Name = node.Name;
                        upgraded.Details = node.Details;
                        upgraded.Description = node.Description;
                        if (this.host.project) (upgraded as any).setProjectRef?.(this.host.project);
                        upgraded.data = { ...node.data, ...projectAction };
                        this.host.setupNodeListeners(upgraded);
                        return upgraded;
                    }
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
        FlowSyncManager.logger.debug(`updateGlobalActionDefinition: name=${name}, type=${actionData.type}`);
        if (!name) return;

        // SKIP parsing/merging if this is just a minimal link from a canvas node
        const isMinimalLink = actionData.isLinked && !actionData.type && !actionData.target && !actionData.service;
        if (isMinimalLink) return;

        if (!this.host.project.actions) this.host.project.actions = [];
        const taskFields = ['taskName', 'isMapLink', 'isProxy', 'stageObjectId', 'embeddedGroupId', 'parentProxyId', 'isLinked', 'isEmbeddedInternal', 'isExpanded', 'sourceTaskName', '_formValues'];
        const cleanedData = { ...actionData };
        taskFields.forEach(field => delete cleanedData[field]);

        const newAction = { ...cleanedData, name };

        // Only parse if we strictly have only details and nothing else (legacy support)
        if (newAction.details && !newAction.type && !newAction.target && !newAction.service && !newAction.calcSteps) {
            const parsed = this.parseDetailsToCommand(newAction.details);
            if (parsed) Object.assign(newAction, parsed);
        }

        if (newAction.actionName) delete newAction.actionName;
        const targetCollection = (this.host as any).editor ? (this.host as any).editor.getTargetActionCollection(name) : (this.host.project.actions || []);
        const idx = targetCollection.findIndex((a: any) => a.name === name);

        if (idx !== -1) {
            // FIX: If types differ, we REPLACE instead of merge to get rid of incompatible fields
            // BUT: Do not overwrite with undefined if we already have a type!
            const oldType = targetCollection[idx].type;
            const newType = newAction.type || oldType;

            if (oldType !== newType && newType) {
                FlowSyncManager.logger.info(`Type changed for ${name}. Replacing definition to clean fields.`);
                targetCollection[idx] = { ...newAction, type: newType };
            } else {
                targetCollection[idx] = { ...targetCollection[idx], ...newAction, type: newType };
            }
        } else {
            targetCollection.push(newAction);
        }
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
                if (item.elseBody) processSequence(item.elseBody);
                if (item.successBody) processSequence(item.successBody);
                if (item.errorBody) processSequence(item.errorBody);
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
            FlowSyncManager.logger.info(`Pre-registered new task: ${name}`);
        }
    }
}
