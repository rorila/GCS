import { mediatorService } from '../../services/MediatorService';
import { FlowElement } from '../flow/FlowElement';
import { FlowAction } from '../flow/FlowAction';
import { FlowTask } from '../flow/FlowTask';
import { FlowCondition } from '../flow/FlowCondition';
import { FlowVariable } from '../flow/FlowVariable';
import { FlowLoop } from '../flow/FlowLoop';

import { FlowThresholdVariable } from '../flow/FlowThresholdVariable';
import { FlowTriggerVariable } from '../flow/FlowTriggerVariable';
import { FlowTimerVariable } from '../flow/FlowTimerVariable';
import { FlowRangeVariable } from '../flow/FlowRangeVariable';
import { FlowListVariable } from '../flow/FlowListVariable';
import { FlowRandomVariable } from '../flow/FlowRandomVariable';
import { FlowConnection } from '../flow/FlowConnection';
import { FlowDataAction } from '../flow/FlowDataAction';
import { Logger } from '../../utils/Logger';
import { SyncValidator } from './SyncValidator';

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
    syncManager: any;
    editor?: any;
}

export class FlowSyncManager {
    public static logger = Logger.get('FlowSync', 'Flow_Synchronization');
    private static lifecycleLogger = Logger.get('FlowSync', 'Action_Lifecycle');
    private static propertyLogger = Logger.get('FlowSyncMan', 'Property_Management');
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
            this.host.project.stages.forEach((s: any) => {
                const stageTasks = s.tasks || s.Tasks;
                if (stageTasks) processCollection(stageTasks);
            });
        }
    }

    public syncActionsFromProject() {
        if (!this.host.project) return;
        this.host.nodes.forEach(node => {
            if (node.getType() === 'action' && node.data?.isLinked) {
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
        FlowSyncManager.logger.info(`[TRACE] syncToProject start (Context: ${currentContext})`);
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


        this.host.nodes.forEach(node => {
            const nodeType = node.getType().toLowerCase();
            if ((nodeType === 'action' || nodeType === 'data_action') && node.data && !node.data.isEmbeddedInternal) {
                const actionName = node.Name || node.data.name || node.data.actionName;
                if (actionName) {
                    FlowSyncManager.logger.debug(`[TRACE] syncToProject: Aktualisiere Model-Definition für "${actionName}" (isLinked=${!!node.data.isLinked})`);
                    this.updateGlobalActionDefinition({ details: (node as any).Details, ...node.data, name: actionName });
                }
            }

            if (nodeType === 'task' && node.data && !node.data.isEmbeddedInternal) {
                const taskName = node.Name || node.data.taskName;

                if (taskName) {
                    const isRefactoring = (this.host as any).editor?.commandManager?.isRefactoring;
                    FlowSyncManager.logger.debug(`[TRACE] syncToProject: Prüfe Task "${taskName}" (isRefactoring=${isRefactoring})`);
                    if (!isRefactoring) {
                        this.ensureTaskExists(taskName, (node as any).Details || "");
                    }
                }
            }
        });

        if (currentContext === 'global') {
            // Global-Kontext: weiterhin FlowChart speichern (kein Task-basierter Flow)
            if (this.host.project.flowCharts) {
                this.host.project.flowCharts.global = { elements, connections };
            } else {
                this.host.project.flow = { elements, connections };
            }
        } else {
            // =====================================================================
            // DYNAMISCHE FLOW-GENERIERUNG: Nur actionSequence + flowLayout speichern
            // Kein flowChart mehr persistieren!
            // =====================================================================
            let task = this.host.getTaskDefinitionByName(currentContext);

            // GHOST TASK FIX: If task exists in flow but not in definitions, ensure it exists
            if (!task && currentContext !== 'global') {
                FlowSyncManager.logger.info(`[TRACE] syncToProject: Ghost task detected for "${currentContext}". Creating definition.`);
                this.ensureTaskExists(currentContext, "");
                task = this.host.getTaskDefinitionByName(currentContext);
            }

            if (task) {
                FlowSyncManager.logger.info(`[TRACE] syncToProject: Synchronisiere Task-Logik für "${currentContext}". Elemente: ${elements.length}`);
                this.syncTaskFromFlow(task, elements, connections);

                // NUR Layout-Positionen speichern (statt volles FlowChart)
                task.flowLayout = this.extractLayoutOverrides(persistentNodes);

                // Standalone-Nodes speichern: Nodes die NICHT in der actionSequence enthalten sind
                // (z.B. Actions die auf dem Canvas liegen, aber noch nicht verbunden wurden)
                const sequenceNames = new Set<string>();
                const collectSeqNames = (seq: any[]) => {
                    seq?.forEach((item: any) => {
                        if (item.name) sequenceNames.add(item.name);
                        if (item.taskName) sequenceNames.add(item.taskName);
                        if (item.then) collectSeqNames(item.then);
                        if (item.else || item.elseBody) collectSeqNames(item.else || item.elseBody);
                        if (item.body) collectSeqNames(item.body);
                    });
                };
                collectSeqNames(task.actionSequence || []);
                sequenceNames.add(task.name);

                const standaloneElements = elements.filter((el: any) => {
                    const nodeName = el.properties?.name || el.data?.name || el.data?.taskName;
                    return nodeName && !sequenceNames.has(nodeName);
                });

                if (standaloneElements.length > 0) {
                    task.standaloneNodes = standaloneElements;
                    FlowSyncManager.logger.info(`[TRACE] syncToProject: ${standaloneElements.length} standalone Node(s) gespeichert für "${currentContext}"`);
                } else {
                    delete task.standaloneNodes;
                }

                // Legacy-Daten bereinigen
                delete task.flowChart;
                if ((task as any).flowGraph) delete (task as any).flowGraph;
                this.cleanupLegacyFlowData(currentContext);

                FlowSyncManager.logger.info(`[TRACE] syncToProject: flowLayout gespeichert für "${currentContext}" (${Object.keys(task.flowLayout).length} Positionen)`);
            }
        }

        if (this.host.onProjectChange) {
            FlowSyncManager.logger.info(`[TRACE] syncToProject: Löse onProjectChange (Speichern) aus.`);
            this.host.onProjectChange();
        }
        this.host.updateFlowSelector();
        mediatorService.notifyDataChanged(this.host.project, 'flow-editor');

        // Konsistenzprüfung nach Sync
        const violations = SyncValidator.validate(this.host.project, currentContext);
        if (violations.length > 0) {
            SyncValidator.logger.warn(`${violations.length} Konsistenz-Verletzung(en) nach Sync von "${currentContext}":`);
            violations.forEach(v => {
                SyncValidator.logger[v.severity](
                    `  [${v.rule}] ${v.message}${v.autoRepaired ? ' ✅ (auto-repariert)' : ''}`
                );
            });
        }
    }

    /**
     * Entfernt alle Legacy-flowChart-Einträge für einen Task aus dem gesamten Projekt.
     * Seit der dynamischen FlowChart-Generierung werden Flows nicht mehr persistiert.
     */
    private cleanupLegacyFlowData(taskName: string) {
        if (!this.host.project) return;

        // Project-Root flowCharts bereinigen
        if (this.host.project.flowCharts?.[taskName]) {
            delete this.host.project.flowCharts[taskName];
        }

        // Alle Stages bereinigen
        if (this.host.project.stages) {
            this.host.project.stages.forEach((stage: any) => {
                if (stage.flowCharts?.[taskName]) {
                    delete stage.flowCharts[taskName];
                }
            });
        }
    }

    /**
     * Extrahiert die Positionen aller persistenten Nodes als kompakte Layout-Map.
     * Nur Node-Name → {x, y} — kein Typ, keine Labels, keine Connections.
     */
    private extractLayoutOverrides(nodes: any[]): Record<string, { x: number, y: number }> {
        const layout: Record<string, { x: number, y: number }> = {};
        nodes.forEach(n => {
            const key = n.Name || n.name || n.data?.name || n.data?.taskName;
            if (key) {
                // Support sowohl FlowElement-Instanzen als auch JSON-Objekte
                const x = typeof n.X === 'number' ? n.X : (n.x ?? 0);
                const y = typeof n.Y === 'number' ? n.Y : (n.y ?? 0);
                layout[key] = { x, y };
            }
        });
        return layout;
    }

    private getBlueprintStage(): any {
        return this.host.project?.stages?.find((s: any) =>
            s.type === 'blueprint' || s.id === 'stage_blueprint' || s.id === 'blueprint'
        ) || null;
    }

    public syncVariablesFromFlow() {
        if (!this.host.project) return;
        this.host.nodes.forEach(node => {
            if (node.getType() === 'VariableDecl' && node.data?.variable) {
                const varData = node.data.variable;
                // Globale Variablen → Blueprint-Stage (NICHT project.variables)
                const blueprint = this.getBlueprintStage();
                const targetCollection = varData.scope === 'global' ?
                    (blueprint ? (blueprint.variables || (blueprint.variables = [])) : (this.host.getActiveStage()?.variables || [])) :
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

        const startNode = elements.find(e => {
            const t = (e.type || '').toLowerCase();
            return t === 'task';
        });
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

            let nodeType = (node.type || '').toLowerCase();

            // Upgrade: action -> data_action wenn data.type dies anzeigt (z.B. verlinkte Actions)
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
                const nextConns = connections.filter(c => c.startTargetId === nodeId && (c.data?.startAnchorType === 'output' || c.data?.startAnchorType === 'bottom'));
                if (nextConns.length > 0) {
                    nextConns.forEach(nc => buildSequence(nc.endTargetId, targetSeq, stopSet));
                }
            } else if (nodeType === 'condition' || nodeType === 'data_action' || nodeType === 'data_action') {
                const isData = nodeType.includes('data');
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
                    ...(isData ? nodeData : { 
                        condition: node.data?.condition ? node.data.condition : (node.properties?.text || '') 
                    }),
                    type: branchType, // Ensure correct type, overwrite if data.type was wrong
                    [isData ? 'successBody' : 'body']: [],
                    [isData ? 'errorBody' : 'elseBody']: []
                };
                targetSeq.push(branchItem);

                const trueAnchor = isData ? 'success' : 'true';
                const falseAnchor = isData ? 'error' : 'false';

                const trueConn = connections.find(c => c.startTargetId === nodeId && (
                    c.data?.startAnchorType === trueAnchor || 
                    c.data?.startAnchorType === 'right' ||
                    c.data?.startAnchorType === 'output' ||
                    c.data?.isTrueBranch === true ||
                    (isData && c.data?.startAnchorType === 'true')
                ));
                const falseConn = connections.find(c => c.startTargetId === nodeId && (
                    c.data?.startAnchorType === falseAnchor || 
                    c.data?.startAnchorType === 'bottom' ||
                    c.data?.isFalseBranch === true ||
                    (isData && c.data?.startAnchorType === 'false')
                ));

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
            } else if (nodeType === 'task' && node.id !== startNode.id) {
                FlowSyncManager.logger.debug(`Inline task call detected: ${node.properties?.name || node.id}`);
                targetSeq.push({ type: 'task', name: node.properties?.name || node.properties?.text });
                const nextConn = connections.find(c => c.startTargetId === nodeId);
                if (nextConn) buildSequence(nextConn.endTargetId, targetSeq, stopSet);
            } else if (['while', 'for', 'repeat'].includes(nodeType)) {
                FlowSyncManager.logger.debug(`Loop detected: ${node.type}`);
                const loop: any = { type: nodeType, body: [] };
                if (nodeType === 'while') loop.condition = node.properties?.text || '';
                if (nodeType === 'repeat') loop.count = parseInt(node.properties?.text) || 1;
                targetSeq.push(loop);

                const bodyConn = connections.find(c => c.startTargetId === nodeId && (c.data?.startAnchorType === 'output' || c.data?.startAnchorType === 'bottom'));
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
            FlowSyncManager.logger.info(`[TRACE] Generated sequence for task ${task.name} with ${sequence.length} items.`);
            task.actionSequence = sequence.map(item => item);
        } else {
            FlowSyncManager.logger.info(`[TRACE] Generated EMPTY sequence for task ${task.name}. Elements: ${elements.length}, Connections: ${connections.length}`);
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

        // =====================================================================
        // ORTHOGONALES LAYOUT: Alle Nodes zentriert, gleiche Breite,
        // Connections nur senkrecht/waagerecht, kein Überlappen
        // =====================================================================

        // --- Layout-Konstanten ---
        const CHAR_WIDTH = 9;           // Geschätzte Pixel pro Zeichen
        const MIN_NODE_WIDTH = 160;     // Minimale Node-Breite
        const NODE_HEIGHT = 60;         // Einheitliche Node-Höhe
        const NODE_PADDING = 50;        // Padding innerhalb des Nodes (links+rechts)
        const Y_SPACING = NODE_HEIGHT + 40; // Vertikaler Abstand (Node + Gap)
        const BRANCH_GAP = 40;          // Horizontaler Mindestabstand zwischen Branches

        // --- Schritt 1: Alle Labels sammeln um einheitliche Breite zu berechnen ---
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

        // --- Schritt 2: Root-Node (Task) ---
        const rootId = 'root_task_' + Date.now();
        const taskName = task.name || 'Unbenannter Task';
        const CENTER_X = 400;  // Alle Haupt-Nodes zentriert auf dieser X-Position

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

        // --- Schritt 3: Rekursive Positionierung ---
        let nextNodeId = 0;
        const getNewId = (type: string) => `auto_${type}_${nextNodeId++}_${Date.now()}`;

        // Branch-Offset: Genug Abstand damit sich Then/Else-Branches nicht überlappen
        const BRANCH_OFFSET = NODE_WIDTH + BRANCH_GAP;

        const process = (
            sequence: any[],
            startNodeId: string,
            startAnchor: string = 'bottom',
            centerX: number = CENTER_X,
            startY: number = 50 + Y_SPACING,
            firstEndAnchor: string = 'top'  // Erster Node im Branch bekommt diesen End-Anchor
        ): { lastId: string, endY: number } => {
            let currentY = startY;
            let lastId = startNodeId;
            let lastAnchor = startAnchor;
            let nextEndAnchor = firstEndAnchor; // Nur für den ERSTEN Node relevant

            sequence.forEach(item => {
                const id = getNewId(item.type || 'action');

                if (item.type === 'condition') {
                    // --- Condition-Node: zentriert ---
                    elements.push({
                        id, type: 'condition',
                        x: centerX, y: currentY,
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
                    nextEndAnchor = 'top'; // Ab dem zweiten Node immer top

                    // =====================================================
                    // TRUE-Branch (grüner Anchor = RECHTS): nach RECHTS
                    // FALSE-Branch (roter Anchor = UNTEN): nach UNTEN
                    // =====================================================
                    const thenX = centerX + BRANCH_OFFSET;
                    const thenY = currentY;                   // Gleiche Höhe = horizontal
                    const falseY = currentY + Y_SPACING;      // Darunter = vertikal

                    // --- TRUE-Branch: nach RECHTS (horizontal) ---
                    const thenSeq = item.body || item.then || [];

                    // --- FALSE/Else-Branch: nach UNTEN (Hauptfluss) ---
                    const elseSeq = item.elseBody || item.else || [];

                    // --- TRUE: Sequenz oder einzelne thenAction → RECHTS ---
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

                    // --- FALSE: Sequenz oder einzelne elseAction → UNTEN ---
                    if (elseSeq.length > 0) {
                        const elseRes = process(elseSeq, id, 'false', centerX, falseY, 'top');
                        currentY = elseRes.endY;
                        lastId = elseRes.lastId;
                    } else if (item.elseAction) {
                        const elseId = getNewId('action');
                        elements.push({
                            id: elseId, type: 'Action',
                            x: centerX, y: falseY,
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
                        // Kein Else → Hauptfluss geht direkt weiter
                        currentY = falseY;
                        lastId = id;
                    }
                    lastAnchor = 'bottom';

                } else if (['while', 'for', 'repeat', 'foreach'].includes(item.type)) {
                    // --- Loop-Node ---
                    elements.push({
                        id, type: item.type.charAt(0).toUpperCase() + item.type.slice(1) as any,
                        x: centerX, y: currentY,
                        width: NODE_WIDTH, height: NODE_HEIGHT,
                        properties: { text: item.condition || item.count || item.name || '' }
                    });
                    connections.push({
                        startTargetId: lastId, endTargetId: id,
                        data: { startAnchorType: lastAnchor, endAnchorType: 'top' }
                    });
                    const bodyRes = process(item.body || [], id, 'output', centerX, currentY + Y_SPACING);
                    lastId = id; lastAnchor = 'bottom';
                    currentY = bodyRes.endY + Y_SPACING;

                } else {
                    // --- Action/Task/DataAction-Node: zentriert ---
                    const isTask = item.type === 'execute_task' || item.type === 'task';
                    const isDataAction = item.type === 'data_action';
                    const itemName = item.name || item.taskName || item.action || item.type || 'Aktion';
                    const nodeType = isTask ? 'Task' : (isDataAction ? 'DataAction' : 'Action');

                    elements.push({
                        id, type: nodeType,
                        x: centerX, y: currentY,
                        width: NODE_WIDTH, height: NODE_HEIGHT,
                        properties: { name: itemName, text: itemName },
                        data: { ...item }
                    });
                    connections.push({
                        startTargetId: lastId, endTargetId: id,
                        data: { startAnchorType: lastAnchor, endAnchorType: nextEndAnchor }
                    });
                    lastId = id; lastAnchor = 'bottom';
                    nextEndAnchor = 'top'; // Ab dem zweiten Node immer top
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

        const type = (data.type || '').toLowerCase();
        switch (type) {

            case 'action':
                node = new FlowAction(data.id, data.x, data.y, canvas, cellSize);
                break;
            case 'data_action':
                node = new FlowDataAction(data.id, data.x, data.y, canvas, cellSize);
                break;
            case 'condition':
                node = new FlowCondition(data.id, data.x, data.y, canvas, cellSize);
                break;
            case 'task':
                node = new FlowTask(data.id, data.x, data.y, canvas, cellSize);
                break;
            case 'variabledecl':
                node = this.restoreVariableNode(data);
                break;
            case 'while':
            case 'for':
            case 'repeat':
                node = new FlowLoop(data.id, data.x, data.y, canvas, cellSize, type);
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

            node.data = data.data || {};

            if (data.properties) {
                if (data.properties.name) node.Name = data.properties.name;
                if (data.properties.details) node.Details = data.properties.details;
                if (data.properties.description) node.Description = data.properties.description;
                if (data.properties.text && !data.properties.name) node.Name = data.properties.text;
            }

            // Sicherstellen, dass der Knoten initial gerendert wird, 
            // falls der Name-Setter (oben) aufgrund identischer Daten geskippt wurde.
            if (node instanceof FlowTask || node instanceof FlowAction || node instanceof FlowDataAction) {
                (node as any).setShowDetails?.(this.host.showDetails || false, this.host.project);
            }

            // Breite wird NICHT mehr in restoreNode erzwungen.
            // Post-Processing in FlowGraphHydrator.formatOrthogonalLayout()
            // kümmert sich um einheitliche Breiten und Positionierung.

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
            if (node instanceof FlowCondition) (node as any).refreshVisuals?.();

            // SINGLE SOURCE OF TRUTH: For Action nodes, load data from project.actions
            // FIX (v3.3.15): Wenn die globale Def type:'data_action' ist, Knoten auf FlowDataAction upgraden
            if (type === 'action' && this.host.project) {
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

        // Actions-Array auf Blueprint-Stage sicherstellen (NICHT project.actions Root)
        const blueprintForActions = this.getBlueprintStage();
        if (blueprintForActions && !blueprintForActions.actions) blueprintForActions.actions = [];
        const taskFields = ['taskName', 'isMapLink', 'isProxy', 'stageObjectId', 'embeddedGroupId', 'parentProxyId', 'isLinked', 'isEmbeddedInternal', 'isExpanded', 'sourceTaskName', '_formValues', 'section', 'property'];
        const cleanedData = { ...actionData };

        // --- SAFE PARSING ---
        const safeParse = (val: any) => {
            if (typeof val !== 'string' || !val.trim()) return val;
            try { return JSON.parse(val); } catch (e) { return val; }
        };

        // --- WIZARD SYNC ENHANCEMENT ---
        // Wenn es eine Property-Aktion ist, mappen wir 'value' und 'property' in das 'changes' Objekt.
        if (cleanedData.type === 'property' && cleanedData.property && cleanedData.value !== undefined) {
            FlowSyncManager.propertyLogger.info(`Mapping Wizard property change: ${cleanedData.target}.${cleanedData.property} =`, cleanedData.value);
            cleanedData.changes = { [cleanedData.property]: safeParse(cleanedData.value) };
        } else if (cleanedData.changes !== undefined) {
            cleanedData.changes = safeParse(cleanedData.changes);
        }

        if (cleanedData.params !== undefined) cleanedData.params = safeParse(cleanedData.params);
        if (cleanedData.body !== undefined) cleanedData.body = safeParse(cleanedData.body);

        // Erst JETZT die Wizard-Hilfsfelder löschen
        taskFields.forEach(field => delete cleanedData[field]);

        const newAction = { ...cleanedData, name };
        FlowSyncManager.propertyLogger.info(`Final action definition for '${name}':`, newAction);

        // Only parse if we strictly have only details and nothing else (legacy support)
        if (newAction.details && !newAction.type && !newAction.target && !newAction.service && !newAction.calcSteps) {
            const parsed = this.parseDetailsToCommand(newAction.details);
            if (parsed) Object.assign(newAction, parsed);
        }

        if (newAction.actionName) delete newAction.actionName;
        const blueprintStageForAction = this.getBlueprintStage();
        const fallbackCollection = blueprintStageForAction ? (blueprintStageForAction.actions || (blueprintStageForAction.actions = [])) : [];
        const targetCollection = (this.host as any).editor ? (this.host as any).editor.getTargetActionCollection(name) : fallbackCollection;
        const idx = targetCollection.findIndex((a: any) => a.name === name);

        if (idx !== -1) {
            const existingAction = targetCollection[idx];
            const oldType = existingAction.type;
            const newType = newAction.type || oldType;

            if (oldType !== newType && newType) {
                FlowSyncManager.logger.info(`Type changed for ${name} (${oldType} -> ${newType}). Cleaning fields for referential-stable update.`);

                // --- REFERENZ-STABILES UPDATE ---
                // Wir löschen alle Felder des existierenden Objekts außer dem Namen,
                // um Inkompatibilitäten beim Typ-Wechsel zu vermeiden, aber die INSTANZ zu behalten.
                Object.keys(existingAction).forEach(key => {
                    if (key !== 'name' && key !== 'id') delete existingAction[key];
                });

                // Neue Daten in dieselbe Instanz kopieren
                Object.assign(existingAction, newAction, { type: newType });
            } else {
                // Normales Merge bei gleichem Typ
                Object.assign(existingAction, newAction, { type: newType });
            }
        } else {
            // Neue Action: Typ-spezifische Standard-Felder sicherstellen
            const typeDefaults: Record<string, Record<string, any>> = {
                'data_action': {
                    details: '(data_action)',
                    url: '',
                    method: 'GET',
                    requestJWT: false,
                    queryValue: '',
                    resultVariable: '',
                    selectFields: '*'
                },
                'navigate_stage': {
                    actionType: 'navigate_stage',
                    stageId: ''
                },
                'navigate': {
                    target: ''
                },
                'property': {
                    target: '',
                    changes: {}
                },
                'service': {
                    service: '',
                    method: '',
                    serviceParams: [],
                    resultVariable: ''
                },
                'calculate': {
                    resultVariable: '',
                    formula: ''
                }
            };

            const defaults = typeDefaults[newAction.type];
            if (defaults) {
                Object.entries(defaults).forEach(([key, defaultVal]) => {
                    if (newAction[key] === undefined) {
                        newAction[key] = defaultVal;
                    }
                });
            }

            // Wizard-Artefakte entfernen, die nicht persistiert werden sollen
            if (newAction.AddFieldDropdown !== undefined) {
                delete newAction.AddFieldDropdown;
            }
            FlowSyncManager.lifecycleLogger.info(`Neue Action "${name}" registriert (Typ: ${newAction.type || 'property'}).`);
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
                const elType = (el.type || '').toLowerCase();
                if (elType !== 'action' && elType !== 'dataaction' && elType !== 'data_action') return;

                const proxyId = el.data?.parentProxyId;
                if (!proxyId) return;

                const name = el.properties?.name || el.data?.name || el.data?.actionName;
                const isMeaningful = el.data?.type || el.data?.actionName || el.data?.taskName;
                if (name && (name !== 'Action' && name !== 'Aktion' || isMeaningful)) {
                    this.updateGlobalActionDefinition({ ...el.data, name });
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
        // Prüfe ob Task in irgendeiner Stage existiert (NICHT project.tasks Root)
        const exists = this.host.project.stages?.some((s: any) => s.tasks?.some((t: any) => t.name === name));

        if (!exists) {
            const newTask = { name, description, params: [], actionSequence: [] };
            const activeStage = this.host.getActiveStage();
            if (activeStage) {
                if (!activeStage.tasks) activeStage.tasks = [];
                activeStage.tasks.push(newTask);
            } else {
                // Fallback: Blueprint-Stage (NICHT project.tasks Root)
                const blueprint = this.getBlueprintStage();
                if (blueprint) {
                    if (!blueprint.tasks) blueprint.tasks = [];
                    blueprint.tasks.push(newTask);
                }
            }
            FlowSyncManager.logger.info(`Pre-registered new task: ${name}`);
        }
    }
}
