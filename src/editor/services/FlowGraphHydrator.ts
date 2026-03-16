import { FlowElement } from '../flow/FlowElement';
import { FlowAction } from '../flow/FlowAction';
import { FlowConnection } from '../flow/FlowConnection';
import { FlowStart } from '../flow/FlowStart';
import { libraryService } from '../../services/LibraryService';
import { Logger } from '../../utils/Logger';

export interface FlowGraphHydrationHost {
    project: any;
    currentFlowContext: string;
    nodes: FlowElement[];
    connections: FlowConnection[];
    canvas: HTMLElement;
    flowStage: any;
    isLoading: boolean;
    syncManager: any;
    graphManager: any;
    mapManager: any;
    onNodesChanged?: (nodes: FlowElement[]) => void;

    getActiveStage(): any;
    getTaskDefinitionByName(name: string): any;
    getTargetFlowCharts(name: string): any;
    clearFlowCanvas(): void;
    updateScrollArea(): void;
    updateActionDetails(): void;
    setupConnectionListeners(conn: FlowConnection): void;
    syncToProject(): void;
    handleNodeDoubleClick(node: FlowElement): void;
}

export class FlowGraphHydrator {
    private static logger = Logger.get('FlowGraphHydrator', 'Flow_Synchronization');

    constructor(private host: FlowGraphHydrationHost) { }

    public loadFromProject(contextName?: string) {
        if (!this.host.project) return;

        if (contextName) {
            (this.host as any).currentFlowContext = contextName;
        }

        this.host.isLoading = true;
        this.host.clearFlowCanvas();

        if (this.host.currentFlowContext === 'event-map') {
            this.host.mapManager.generateEventMap();
            return;
        }

        if (this.host.currentFlowContext === 'element-overview') {
            this.host.mapManager.generateElementOverview();
            return;
        }

        let sourceData: { elements: any[], connections: any[] } | undefined;
        const activeStage = this.host.getActiveStage();

        if (this.host.currentFlowContext === 'global') {
            // Global-Kontext: Bestehende Logik beibehalten
            const blueprintStage = this.host.project.stages?.find((s: any) => s.type === 'blueprint' || s.id === 'stage_blueprint');
            const blueprintFlowIdx = blueprintStage?.flowCharts?.global;
            const stageFlowIdx = activeStage?.flowCharts?.global;
            const projectFlowIdx = (this.host.project.flowCharts?.global) || (this.host.project as any).flow;
            sourceData = stageFlowIdx || blueprintFlowIdx || projectFlowIdx;
        } else {
            // =====================================================================
            // DYNAMISCHE FLOW-GENERIERUNG: FlowCharts aus actionSequence erzeugen
            // Layout-Overrides (flowLayout) werden nachträglich angewendet
            // =====================================================================
            const task = this.host.getTaskDefinitionByName(this.host.currentFlowContext);
            if (task && task.actionSequence?.length > 0) {
                sourceData = this.host.syncManager.generateFlowFromActionSequence(task);
                // Layout-Overrides anwenden (User-Positionen)
                this.applyLayoutOverrides(sourceData!, task.flowLayout);
                FlowGraphHydrator.logger.info(`Flow dynamisch generiert für "${task.name}" (${sourceData!.elements.length} Nodes). Layout-Overrides: ${task.flowLayout ? Object.keys(task.flowLayout).length : 0}`);
            } else if (task) {
                // Task existiert aber hat leere actionSequence → leerer Flow
                sourceData = { elements: [], connections: [] };
                setTimeout(() => {
                    if (this.host.nodes.length === 0) {
                        const startNode = new FlowStart('start-' + Date.now(), 50, 50, this.host.canvas, this.host.flowStage.cellSize);
                        startNode.Text = "Start";
                        this.host.nodes.push(startNode);
                    }
                }, 100);
            } else {
                sourceData = { elements: [], connections: [] };
            }
        }

        if (!sourceData) return;

        if (sourceData.elements) {
            sourceData.elements.forEach((data: any) => {
                const node = this.host.syncManager.restoreNode(data);
                if (node) this.host.nodes.push(node);
            });
        }

        if (sourceData.connections) {
            FlowGraphHydrator.logger.info(`[TRACE] loadFromProject: Found ${sourceData.connections.length} connections in source data.`);
            sourceData.connections.forEach((data: any) => {
                this.host.graphManager.restoreConnection(data);
            });
        }

        [...this.host.nodes].forEach(node => {
            if (node.data?.isExpanded) {
                this.refreshEmbeddedTask(node);
            }
        });

        if (this.host.onNodesChanged) {
            this.host.onNodesChanged(this.host.nodes);
        }

        this.host.updateScrollArea();
        this.host.updateActionDetails();
        this.host.isLoading = false;

        // =====================================================================
        // POST-PROCESSING: Orthogonales Layout formatieren
        // Muss NACH allen autoSize()-Aufrufen laufen.
        // setTimeout garantiert, dass dies NACH allen synchronen Calls passiert.
        // =====================================================================
        if (this.host.currentFlowContext !== 'global' && this.host.nodes.length > 1) {
            // Nodes off-screen nach links verschieben (unsichtbar für User)
            this.host.nodes.forEach(n => {
                const el = (n as any).element;
                if (el) {
                    el.style.transform = 'translateX(-2000px)';
                    el.style.transition = 'none'; // Kein Übergang beim Verstecken
                }
            });
            // Connections verstecken (kein translateX möglich bei SVG-Lines)
            (this.host.connections || []).forEach((c: any) => {
                if (c.element) {
                    c.element.style.opacity = '0';
                    c.element.style.transition = 'none';
                }
            });

            setTimeout(() => {
                this.formatOrthogonalLayout();

                // Nach Formatierung: Nodes sanft in den sichtbaren Bereich schieben
                requestAnimationFrame(() => {
                    this.host.nodes.forEach(n => {
                        const el = (n as any).element;
                        if (el) {
                            el.style.transition = 'transform 0.5s ease-out';
                            el.style.transform = 'translateX(0)';
                        }
                    });
                    // Connections sanft einblenden
                    (this.host.connections || []).forEach((c: any) => {
                        if (c.element) {
                            c.element.style.transition = 'opacity 0.5s ease-out';
                            c.element.style.opacity = '1';
                        }
                    });
                });
            }, 50);
        }
    }

    /**
     * POST-PROCESSING: Orthogonales Layout formatieren.
     * Wird NACH allen autoSize()-Aufrufen ausgeführt.
     */
    private formatOrthogonalLayout(): void {
        const nodes = this.host.nodes;
        const connections = this.host.connections || [];
        if (nodes.length < 2) return;

        const cellSize = this.host.flowStage?.cellSize || 20;
        const Y_GAP = 40;
        const X_GAP = 40;
        const MAIN_X = 40;

        // --- Schritt 1: Vertikale Kette (Root → bottom/false → top) ---
        const rootNode = nodes.find(n =>
            n.getType().toLowerCase() === 'task' && !n.data?.isEmbeddedInternal
        ) || nodes[0];

        const verticalChain: any[] = [rootNode];
        const horizontalNodes: { node: any, sourceNode: any }[] = [];
        const visited = new Set<string>();
        visited.add(rootNode.id);

        let current = rootNode;
        let safety = 0;
        while (safety++ < 50) {
            // Finde ausgehende vertikale Connections (bottom, output, false)
            const verticalConn = connections.find((c: any) =>
                c.startTarget === current && (
                    c.data?.startAnchorType === 'bottom' ||
                    c.data?.startAnchorType === 'output' ||
                    c.data?.startAnchorType === 'false'
                ) && c.endTarget && (
                    c.data?.endAnchorType === 'top' ||
                    c.data?.endAnchorType === 'input'
                )
            );
            if (!verticalConn || !verticalConn.endTarget) break;

            const nextNode = verticalConn.endTarget;
            if (visited.has(nextNode.id)) break;
            visited.add(nextNode.id);

            verticalChain.push(nextNode);
            current = nextNode;
        }

        // --- Schritt 1b: Horizontale Branch-Nodes (true/right/success) ---
        connections.forEach((c: any) => {
            if (c.data?.startAnchorType === 'true' ||
                c.data?.startAnchorType === 'right' ||
                c.data?.startAnchorType === 'success') {
                if (c.startTarget && c.endTarget) {
                    const endNodeId = c.endTarget.id;
                    if (!visited.has(endNodeId)) {
                        horizontalNodes.push({ node: c.endTarget, sourceNode: c.startTarget });
                        visited.add(endNodeId);
                    }
                }
            }
        });

        FlowGraphHydrator.logger.info(
            `formatOrthogonalLayout: ${verticalChain.length} vertikal, ${horizontalNodes.length} horizontal`
        );

        // --- Schritt 2: Breite der vertikalen Nodes vereinheitlichen ---
        const maxWidth = Math.max(...verticalChain.map(n => n.width));
        const normalizedWidth = Math.ceil(maxWidth / cellSize) * cellSize;

        // --- Schritt 3: Vertikale Positionen ---
        let currentY = MAIN_X;
        verticalChain.forEach(node => {
            node.x = MAIN_X;
            node.y = currentY;
            node.width = normalizedWidth;
            node.updatePosition();
            currentY += node.height + Y_GAP;
        });

        // --- Schritt 4: Horizontale Nodes positionieren ---
        horizontalNodes.forEach(({ node, sourceNode }) => {
            node.x = MAIN_X + normalizedWidth + X_GAP;
            node.y = sourceNode.y;
            node.width = Math.ceil(node.width / cellSize) * cellSize;
            node.updatePosition();
        });

        // --- Schritt 5: Connections aktualisieren ---
        connections.forEach((c: any) => c.updatePosition?.());

        FlowGraphHydrator.logger.info(
            `formatOrthogonalLayout fertig: Breite=${normalizedWidth}px, Nodes=${nodes.length}`
        );
    }

    /**
     * Wendet gespeicherte Layout-Positionen auf dynamisch generierte Flow-Elemente an.
     * Jeder Node wird über seinen Namen identifiziert (statt generierter ID).
     */
    private applyLayoutOverrides(
        data: { elements: any[], connections: any[] },
        layout?: Record<string, { x: number, y: number }>
    ): void {
        if (!layout || !data.elements) return;
        data.elements.forEach(el => {
            const key = el.properties?.name || el.data?.name || el.data?.taskName;
            if (key && layout[key]) {
                el.x = layout[key].x;
                el.y = layout[key].y;
            }
        });
    }

    public refreshEmbeddedTask(proxyNode: FlowElement) {
        if (!this.host.project || !proxyNode.data?.isExpanded || !proxyNode.data?.sourceTaskName) return;

        const sourceTaskName = proxyNode.data.sourceTaskName;
        let sourceTask = this.host.project.tasks?.find((t: any) => t.name === sourceTaskName);
        let sourceFlowChart = this.host.project.flowCharts?.[sourceTaskName];

        if (!sourceTask) {
            sourceTask = libraryService.getTask(sourceTaskName);
            sourceFlowChart = sourceTask?.flowChart;
        }

        if (!sourceTask || !sourceFlowChart) return;

        const existingGhostNodes = this.host.nodes.filter(n => n.data?.parentProxyId === proxyNode.name);
        if (existingGhostNodes.length > 0) {
            if (!proxyNode.data.ghostPositions) proxyNode.data.ghostPositions = {};
            existingGhostNodes.forEach(n => {
                const originalId = n.data?.originalId || n.name;
                proxyNode.data.ghostPositions[originalId] = { x: n.X, y: n.Y };
            });
        }

        const toDeleteNodes = this.host.nodes.filter(n => n.data?.parentProxyId === proxyNode.name);
        toDeleteNodes.forEach(n => {
            const el = n.getElement();
            if (el.parentNode === this.host.canvas) this.host.canvas.removeChild(el);
            const idx = this.host.nodes.indexOf(n);
            if (idx !== -1) this.host.nodes.splice(idx, 1);
        });

        const toDeleteConns = this.host.connections.filter(c => c.data?.parentProxyId === proxyNode.name);
        toDeleteConns.forEach(c => {
            const el = c.getElement();
            const sh = c.getStartHandle();
            const eh = c.getEndHandle();
            if (el.parentNode === this.host.canvas) this.host.canvas.removeChild(el);
            if (sh.parentNode === this.host.canvas) this.host.canvas.removeChild(sh);
            if (eh.parentNode === this.host.canvas) this.host.canvas.removeChild(eh);
            const idx = this.host.connections.indexOf(c);
            if (idx !== -1) this.host.connections.splice(idx, 1);
        });

        const addedNodes = this.importTaskGraph(proxyNode, sourceTask, true);

        if (addedNodes) {
            addedNodes.forEach(newNode => {
                if (newNode.data?.isExpanded) {
                    this.refreshEmbeddedTask(newNode);
                }
            });
        }
    }

    public importTaskGraph(targetNode: FlowElement, task: any, isLinked: boolean = false): FlowElement[] {
        if (task.name === this.host.currentFlowContext) {
            return [];
        }

        const existingGhosts = this.host.nodes.some(n => n.data?.parentProxyId === targetNode.name);
        if (existingGhosts) {
            return [];
        }

        const projectChart = (this.host.project as any)?.flowCharts?.[task.name];
        const taskChart = task.flowChart || task.flowGraph;

        let flowChart = projectChart;
        const projectCount = projectChart?.elements?.length || 0;
        const taskCount = taskChart?.elements?.length || 0;

        if (!projectChart || (projectCount <= 2 && taskCount > projectCount)) {
            if (taskChart && taskChart.elements && taskChart.elements.length > 0) {
                flowChart = taskChart;
            }
        }

        if (!flowChart || !flowChart.elements || flowChart.elements.length === 0) {
            return [];
        }

        const embeddedGroupId = `embedded-${task.name}-${Date.now()}`;
        const idMap: Record<string, string> = {};
        const getNewId = (oldId: string) => {
            if (!idMap[oldId]) {
                idMap[oldId] = `imported-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            }
            return idMap[oldId];
        };

        let minX = Infinity, minY = Infinity;
        flowChart.elements.forEach((el: any) => {
            if (el.x < minX) minX = el.x;
            if (el.y < minY) minY = el.y;
        });

        const gridGap = this.host.flowStage.cellSize * 4;
        const offsetX = targetNode.X + targetNode.Width + gridGap - minX;
        const offsetY = targetNode.Y - minY;

        const newNodes: FlowElement[] = [];
        let importedStart: FlowElement | null = null;

        flowChart.elements.forEach((data: any) => {
            const isIdentityNode = data.type?.toLowerCase() === 'task' &&
                (data.properties?.name === task.name ||
                    data.properties?.name === task.sourceTaskName ||
                    data.properties?.name === task.copiedFromLibrary);

            if (isLinked && isIdentityNode) {
                idMap[data.id] = targetNode.name;
                if (!targetNode.data) targetNode.data = {};
                targetNode.data.originalId = data.id;
                return;
            }

            const newData = JSON.parse(JSON.stringify(data));
            newData.id = getNewId(data.id);

            const savedPos = isLinked && targetNode.data?.ghostPositions?.[data.id];
            if (savedPos) {
                newData.x = savedPos.x;
                newData.y = savedPos.y;
            } else {
                newData.x += offsetX;
                newData.y += offsetY;
            }

            const newNode = this.host.syncManager.restoreNode(newData);
            if (newNode) {
                this.host.nodes.push(newNode);
                newNodes.push(newNode);

                if (isLinked) {
                    newNode.setLinked(true);
                    newNode.data = {
                        ...newNode.data,
                        isLinked: true,
                        isEmbeddedInternal: true,
                        parentProxyId: targetNode.name,
                        embeddedGroupId: embeddedGroupId,
                        parentParams: targetNode.data?.params,
                        originalId: data.id
                    };
                }

                if (newNode.getType() === 'start') importedStart = newNode;
            }
        });

        if (!importedStart && newNodes.length > 0) {
            importedStart = newNodes[0];
        }

        if (flowChart.connections) {
            flowChart.connections.forEach((data: any) => {
                // Map IDs using idMap for proxies/embedded flows
                const startId = data.startTargetId ? (idMap[data.startTargetId] || data.startTargetId) : null;
                const endId = data.endTargetId ? (idMap[data.endTargetId] || data.endTargetId) : null;

                // Create a temporary data object with mapped IDs
                const mappedData = {
                    ...data,
                    startTargetId: startId,
                    endTargetId: endId
                };

                // Use the centralized restoreConnection logic to handle the rest
                this.host.graphManager.restoreConnection(mappedData);

                // Add embedded metadata if needed
                const lastConn = this.host.connections[this.host.connections.length - 1];
                if (isLinked && lastConn && lastConn.id === data.id) { // id check to be sure we got the right one
                    lastConn.data = {
                        ...lastConn.data,
                        isEmbeddedInternal: true,
                        parentProxyId: targetNode.name,
                        originalStartAnchorType: data.data?.startAnchorType || 'output'
                    };
                }
            });
        }

        if (isLinked && importedStart) {
            const conn = new FlowConnection(this.host.canvas, 0, 0, 0, 0);
            conn.setGridConfig(this.host.flowStage.cellSize);

            const origStartId = targetNode.data.originalId;
            const origEndId = importedStart.data?.originalId;
            const origStartAnchor = 'output';

            const savedConn = targetNode.data?.ghostConnections?.find((gc: any) =>
                gc.startOriginalId === origStartId &&
                gc.endOriginalId === origEndId &&
                gc.originalStartAnchorType === origStartAnchor
            );

            if (savedConn) {
                conn.data = {
                    ...conn.data,
                    startAnchorType: savedConn.startAnchorType,
                    endAnchorType: savedConn.endAnchorType
                };
            }

            conn.attachStart(targetNode);
            conn.attachEnd(importedStart);
            conn.updatePosition();
            this.host.connections.push(conn);
            this.host.setupConnectionListeners(conn);

            conn.data = {
                ...conn.data,
                isEmbeddedInternal: true,
                parentProxyId: targetNode.name,
                originalStartAnchorType: origStartAnchor
            };
        }

        if (isLinked) {
            targetNode.data.isExpanded = true;
            targetNode.data.sourceTaskName = task.name;
            targetNode.Name = task.name;
            targetNode.Text = task.name;
            targetNode.setLinked(true);
            if (task.description) targetNode.Description = task.description;
        }

        newNodes.forEach(node => {
            if (node.getType() === 'action' && (node as FlowAction).actionType === 'data_action') {
                this.expandDataActionFlow(node as FlowAction);
            }
        });

        this.host.syncToProject();
        if (this.host.onNodesChanged) this.host.onNodesChanged(this.host.nodes);

        return newNodes;
    }

    public expandDataActionFlow(dataActionNode: FlowAction) {
        if (!dataActionNode.data) return;

        const createChain = (actions: any[], branchType: 'success' | 'error', startOffsetY: number) => {
            if (!actions || actions.length === 0) return;

            let previousNode: FlowElement = dataActionNode;
            let currentX = dataActionNode.X + 250;
            let currentY = dataActionNode.Y + startOffsetY;

            actions.forEach((actionData, index) => {
                const ghostId = `${dataActionNode.id}-${branchType}-${index}`;
                if (this.host.nodes.some(n => n.id === ghostId)) return;

                const nodeData = {
                    ...actionData,
                    id: ghostId,
                    x: currentX,
                    y: currentY,
                    isEmbeddedInternal: true,
                    parentProxyId: dataActionNode.id,
                    isLinked: true
                };

                const newNode = this.host.syncManager.restoreNode(nodeData);
                if (newNode) {
                    newNode.setLinked(true);
                    this.host.nodes.push(newNode);

                    const conn = new FlowConnection(this.host.canvas, 0, 0, 0, 0);

                    if (previousNode === dataActionNode) {
                        conn.attachStart(dataActionNode);
                        conn.attachEnd(newNode);
                        conn.data = {
                            startAnchorType: branchType,
                            endAnchorType: 'input',
                            isEmbeddedInternal: true,
                            parentProxyId: dataActionNode.id
                        };
                    } else {
                        conn.attachStart(previousNode);
                        conn.attachEnd(newNode);
                        conn.data = {
                            startAnchorType: 'output',
                            endAnchorType: 'input',
                            isEmbeddedInternal: true,
                            parentProxyId: dataActionNode.id
                        };
                    }

                    conn.updatePosition();
                    this.host.connections.push(conn);
                    this.host.setupConnectionListeners(conn);

                    previousNode = newNode;
                    currentX += 200;
                }
            });
        };

        if (dataActionNode.data.successBody) {
            createChain(dataActionNode.data.successBody, 'success', 0);
        }

        if (dataActionNode.data.errorBody) {
            createChain(dataActionNode.data.errorBody, 'error', 120);
        }
    }
}
