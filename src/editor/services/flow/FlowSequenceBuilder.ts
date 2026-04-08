import { FlowSyncHost } from './FlowSyncTypes';
import { Logger } from '../../../utils/Logger';

export class FlowSequenceBuilder {
    public static logger = Logger.get('FlowSequenceBuilder', 'Flow_Synchronization');

    constructor(private host: FlowSyncHost) {}

    public syncTaskFromFlow(task: any, elements: any[], connections: any[]): Set<string> {
        if (this.host.currentFlowContext === 'event-map' || this.host.currentFlowContext === 'element-overview') {
            return new Set();
        }

        const startNode = elements.find(e => {
            const t = (e.type || '').toLowerCase();
            return t === 'task';
        });
        if (!startNode) {
            FlowSequenceBuilder.logger.debug(`No start node found for task ${task.name}. Skipping sequence sync.`);
            return new Set();
        }

        const sequence: any[] = [];
        const visited = new Set<string>();

        FlowSequenceBuilder.logger.debug(`syncTaskFromFlow: elements=${elements.length}, connections=${connections.length}`);

        const buildSequence = (nodeId: string, targetSeq: any[], stopSet: Set<string> = new Set(), incomingAnchorType?: string) => {
            if (visited.has(nodeId) || stopSet.has(nodeId)) return;
            visited.add(nodeId);

            const node = elements.find(e => e.id === nodeId);
            if (!node) {
                FlowSequenceBuilder.logger.debug(`buildSequence: Node ${nodeId} not found in elements.`);
                return;
            }
            FlowSequenceBuilder.logger.debug(`buildSequence: processing node ${node.id} (${node.type})`);

            let nodeType = (node.type || '').toLowerCase();

            if (nodeType === 'action' && (node.data?.type === 'data_action' || node.data?.isLinked)) {
                const actionName = node.data?.name || node.properties?.name;
                if (node.data?.type === 'data_action') {
                    nodeType = 'data_action';
                } else if (node.data?.isLinked && actionName) {
                    const stage = this.host.getActiveStage();
                    const globalDef = (this.host.project?.actions || []).find((a: any) => a.name === actionName)
                        || (stage?.actions || []).find((a: any) => a.name === actionName);
                    if (globalDef?.type === 'data_action') nodeType = 'data_action';
                }
            }

            if (nodeType === 'action') {
                const actionName = node.data?.name || node.data?.actionName || node.properties?.name || node.properties?.text;
                if (actionName) {
                    let realType = 'action';
                    if (node.data?.isLinked) {
                        const stage = this.host.getActiveStage();
                        const globalDef = (this.host.project.actions || []).find((a: any) => a.name === actionName)
                            || (stage?.actions || []).find((a: any) => a.name === actionName);
                        if (globalDef?.type === 'data_action') realType = 'data_action';
                    } else if (node.data?.type === 'data_action') {
                        realType = 'data_action';
                    }
                    const actionItem: any = { ...node.data, type: realType, name: actionName };
                    if (incomingAnchorType === 'right') actionItem.layout = 'horizontal';
                    delete (actionItem as any).isLinked;
                    delete (actionItem as any).parentProxyId;
                    delete (actionItem as any).isEmbeddedInternal;
                    delete (actionItem as any).originalId;
                    targetSeq.push(actionItem);
                }
                const nextConns = connections.filter(c => c.startTargetId === nodeId && (c.data?.startAnchorType === 'output' || c.data?.startAnchorType === 'bottom' || c.data?.startAnchorType === 'right'));
                if (nextConns.length > 0) {
                    nextConns.forEach(nc => buildSequence(nc.endTargetId, targetSeq, stopSet, nc.data?.startAnchorType));
                }
            } else if (nodeType === 'condition' || nodeType === 'data_action' || nodeType === 'dataaction') {
                const isData = nodeType.includes('data');
                const branchType = isData ? 'data_action' : 'condition';

                let nodeData = { ...node.data };
                if (isData && nodeData.isLinked) {
                    const actionName = node.Name;
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
                    ...(isData ? nodeData : { condition: node.data?.condition ? node.data.condition : (node.properties?.text || '') }),
                    type: branchType,
                    [isData ? 'successBody' : 'body']: [],
                    [isData ? 'errorBody' : 'elseBody']: []
                };
                targetSeq.push(branchItem);

                const trueAnchor = isData ? 'success' : 'true';
                const falseAnchor = isData ? 'error' : 'false';

                const trueConn = connections.find(c => c.startTargetId === nodeId && (
                    c.data?.startAnchorType === trueAnchor || c.data?.startAnchorType === 'right' ||
                    c.data?.startAnchorType === 'output' || c.data?.isTrueBranch === true ||
                    (isData && c.data?.startAnchorType === 'true')
                ));
                const falseConn = connections.find(c => c.startTargetId === nodeId && (
                    c.data?.startAnchorType === falseAnchor || c.data?.startAnchorType === 'bottom' ||
                    c.data?.isFalseBranch === true || (isData && c.data?.startAnchorType === 'false')
                ));

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
            } else if (nodeType === 'task' && node.id !== startNode.id) {
                const actionItem: any = { type: 'task', name: node.properties?.name || node.properties?.text };
                if (incomingAnchorType === 'right') actionItem.layout = 'horizontal';
                targetSeq.push(actionItem);
                const nextConn = connections.find(c => c.startTargetId === nodeId && (c.data?.startAnchorType === 'output' || c.data?.startAnchorType === 'bottom' || c.data?.startAnchorType === 'right'));
                if (nextConn) buildSequence(nextConn.endTargetId, targetSeq, stopSet, nextConn.data?.startAnchorType);
            } else if (['while', 'for', 'repeat', 'foreach'].includes(nodeType)) {
                const loop: any = { type: nodeType, body: [] };
                if (nodeType === 'while') loop.condition = node.properties?.text || '';
                if (nodeType === 'repeat') loop.count = parseInt(node.properties?.text) || 1;
                targetSeq.push(loop);

                const bodyConn = connections.find(c => c.startTargetId === nodeId && (c.data?.startAnchorType === 'output' || c.data?.startAnchorType === 'bottom'));
                const nextConn = connections.find(c => c.startTargetId === nodeId && c.data?.startAnchorType === 'bottom');

                if (bodyConn) buildSequence(bodyConn.endTargetId, loop.body, new Set([nodeId]));
                if (nextConn) buildSequence(nextConn.endTargetId, targetSeq, stopSet);
            }
        };

        visited.add(startNode.id);

        const initialOutgoing = connections.filter(c => c.startTargetId === startNode.id);
        initialOutgoing.sort((a) => (a.data?.startAnchorType === 'output' ? -1 : 1));

        if (initialOutgoing.length > 0) {
            initialOutgoing.forEach(c => {
                buildSequence(c.endTargetId, sequence, new Set(), c.data?.startAnchorType);
            });
        }

        if (sequence.length > 0) {
            task.actionSequence = sequence.map(item => item);
        } else {
            task.actionSequence = [];
        }

        this.syncTaskParameters(task, elements);
        this.syncTaskParamValues(task, elements);

        return visited;
    }

    private syncTaskParameters(task: any, elements: any[]) {
        const usedParams = new Map<string, { types: Set<string>, sources: string[] }>();
        const paramRegex = /\$\{(\w+)\}/g;

        elements.forEach((el: any) => {
            const elType = (el.type || '').toLowerCase();
            if (elType !== 'action' && elType !== 'dataaction' && elType !== 'data_action') return;
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
        const taskNode = elements.find(el => el.type === 'task' && (el.properties?.name === task.name || el.data?.taskName === task.name));
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

        const CHAR_WIDTH = 9;
        const MIN_NODE_WIDTH = 160;
        const NODE_HEIGHT = 60;
        const NODE_PADDING = 50;
        const Y_SPACING = NODE_HEIGHT + 40;
        const BRANCH_GAP = 40;

        const allLabels: string[] = [task.name || 'Unbenannter Task'];
        const collectLabels = (seq: any[]) => {
            seq?.forEach(item => {
                const name = item.name || item.taskName || item.action || item.type || 'Aktion';
                allLabels.push(name);
                if (item.then) collectLabels(item.then);
                if (item.else || item.elseBody) collectLabels(item.else || item.elseBody);
                if (item.body) collectLabels(item.body);
            });
        };
        collectLabels(task.actionSequence || []);

        const maxLabelLength = Math.max(...allLabels.map(l => l.length));
        const NODE_WIDTH = Math.max(MIN_NODE_WIDTH, maxLabelLength * CHAR_WIDTH + NODE_PADDING);

        const rootId = 'root_task_' + Date.now();
        const taskName = task.name || 'Unbenannter Task';
        const CENTER_X = 400;

        elements.push({
            id: rootId,
            type: 'task',
            x: CENTER_X,
            y: 50,
            width: NODE_WIDTH,
            height: NODE_HEIGHT,
            properties: { name: taskName, text: taskName },
            data: { taskName: taskName }
        });

        let nextNodeId = 0;
        const getNewId = (type: string) => `auto_${type}_${nextNodeId++}_${Date.now()}`;
        const BRANCH_OFFSET = NODE_WIDTH + BRANCH_GAP;

        const process = (
            sequence: any[],
            startNodeId: string,
            startAnchor: string = 'bottom',
            centerX: number = CENTER_X,
            startY: number = 50 + Y_SPACING,
            firstEndAnchor: string = 'top'
        ): { lastId: string, endY: number } => {
            let currentY = startY;
            let currentX = centerX;
            let lastId = startNodeId;
            let lastAnchor = startAnchor;
            let nextEndAnchor = firstEndAnchor;

            sequence.forEach(item => {
                const id = getNewId(item.type || 'action');

                if (item.type === 'condition') {
                    elements.push({
                        id, type: 'condition',
                        x: currentX, y: currentY,
                        width: NODE_WIDTH, height: NODE_HEIGHT,
                        properties: {
                            text: typeof item.condition === 'string'
                                ? item.condition
                                : (item.expression || item.name || '')
                        },
                        data: {
                            condition: typeof item.condition === 'object' ? { ...item.condition } : undefined
                        }
                    });
                    connections.push({
                        startTargetId: lastId, endTargetId: id,
                        data: { startAnchorType: lastAnchor, endAnchorType: nextEndAnchor }
                    });
                    nextEndAnchor = 'top';

                    const thenX = currentX + BRANCH_OFFSET;
                    const thenY = currentY;
                    const falseY = currentY + Y_SPACING;

                    const thenSeq = item.body || item.then || [];
                    const elseSeq = item.elseBody || item.else || [];

                    if (thenSeq.length > 0) {
                        process(thenSeq, id, 'true', thenX, thenY, 'input');
                    } else if (item.thenAction) {
                        const thenId = getNewId('action');
                        elements.push({
                            id: thenId, type: 'Action',
                            x: thenX, y: thenY,
                            width: NODE_WIDTH, height: NODE_HEIGHT,
                            properties: { name: item.thenAction, text: item.thenAction },
                            data: { name: item.thenAction, isLinked: true }
                        });
                        connections.push({
                            startTargetId: id, endTargetId: thenId,
                            data: { startAnchorType: 'true', endAnchorType: 'input' }
                        });
                    }

                    if (elseSeq.length > 0) {
                        const elseRes = process(elseSeq, id, 'false', currentX, falseY, 'top');
                        currentY = elseRes.endY;
                        lastId = elseRes.lastId;
                    } else if (item.elseAction) {
                        const elseId = getNewId('action');
                        elements.push({
                            id: elseId, type: 'Action',
                            x: currentX, y: falseY,
                            width: NODE_WIDTH, height: NODE_HEIGHT,
                            properties: { name: item.elseAction, text: item.elseAction },
                            data: { name: item.elseAction, isLinked: true }
                        });
                        connections.push({
                            startTargetId: id, endTargetId: elseId,
                            data: { startAnchorType: 'false', endAnchorType: 'top' }
                        });
                        currentY = falseY + Y_SPACING;
                        lastId = elseId;
                    } else {
                        currentY = falseY;
                        lastId = id;
                    }
                    lastAnchor = 'bottom';

                } else if (['while', 'for', 'repeat', 'foreach'].includes(item.type)) {
                    elements.push({
                        id, type: item.type.charAt(0).toUpperCase() + item.type.slice(1) as any,
                        x: currentX, y: currentY,
                        width: NODE_WIDTH, height: NODE_HEIGHT,
                        properties: { text: item.condition || item.count || item.name || '' }
                    });
                    connections.push({
                        startTargetId: lastId, endTargetId: id,
                        data: { startAnchorType: lastAnchor, endAnchorType: 'top' }
                    });
                    const bodyRes = process(item.body || [], id, 'output', currentX, currentY + Y_SPACING);
                    lastId = id; lastAnchor = 'bottom';
                    currentY = bodyRes.endY + Y_SPACING;

                } else {
                    const isTask = item.type === 'execute_task' || item.type === 'task';
                    const isDataAction = item.type === 'data_action';
                    const itemName = item.name || item.taskName || item.action || item.type || 'Aktion';
                    const nodeType = isTask ? 'Task' : (isDataAction ? 'DataAction' : 'Action');

                    const isHorizontal = item.layout === 'horizontal';
                    if (isHorizontal) {
                        currentY -= Y_SPACING;
                        currentX += BRANCH_OFFSET;
                        lastAnchor = 'right';
                        nextEndAnchor = 'left';
                    }

                    elements.push({
                        id, type: nodeType,
                        x: currentX, y: currentY,
                        width: NODE_WIDTH, height: NODE_HEIGHT,
                        properties: { name: itemName, text: itemName },
                        data: { ...item }
                    });
                    connections.push({
                        startTargetId: lastId, endTargetId: id,
                        data: { startAnchorType: lastAnchor, endAnchorType: nextEndAnchor }
                    });
                    
                    lastId = id; 
                    lastAnchor = 'bottom';
                    nextEndAnchor = 'top';
                    currentY += Y_SPACING;
                }
            });
            return { lastId, endY: currentY };
        };

        if (task.actionSequence?.length > 0) {
            process(task.actionSequence, rootId);
        }
        return { elements, connections };
    }
}
