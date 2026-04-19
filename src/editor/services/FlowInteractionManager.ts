import { FlowElement } from '../flow/FlowElement';
import { FlowConnection } from '../flow/FlowConnection';
import { FlowCondition } from '../flow/FlowCondition';

export interface FlowInteractionHost {
    canvas: HTMLElement;
    nodes: FlowElement[];
    connections: FlowConnection[];
    flowStage: any;
    currentFlowContext: string;
    showDetails: boolean;
    project: any;
    selectionManager: any;
    menuProvider: any;
    mapManager: any;
    onObjectSelect?: (obj: FlowElement | null) => void;
    onNodesChanged?: (nodes: FlowElement[]) => void;

    createNode(type: string, x: number, y: number, initialName?: string): Promise<FlowElement | null>;
    deleteNode(node: FlowElement): void;
    deleteConnection(conn: FlowConnection): void;
    syncToProject(): void;
    formatLayout?(): void;
    syncManager?: any;
    deselectAll(emitEvent?: boolean): void;
    selectConnection(conn: FlowConnection | null): void;
    handleNodeDoubleClick(node: FlowElement): void;

    // State needed for dragging
    isDraggingHandle: boolean;
    activeHandle: HTMLElement | null;
    activeConnection: FlowConnection | null;
    selectedConnection: FlowConnection | null;
}

import { DnDHelper, DnDPayload } from '../utils/DnDHelper';
import { Logger } from '../../utils/Logger';
import { SecurityUtils } from '../../utils/SecurityUtils';

const logger = Logger.get('FlowInteractionManager');

export class FlowInteractionManager {
    private host: FlowInteractionHost;
    private tooltipEl: HTMLElement | null = null;

    // Rubber-Band Selektion
    private rubberBandEl: HTMLElement | null = null;
    private isRubberBanding: boolean = false;
    private rubberBandStart = { x: 0, y: 0 };

    constructor(host: FlowInteractionHost) {
        this.host = host;
    }

    public bindEvents() {
        // Drag & Drop (Unified via DnDHelper)
        DnDHelper.setupDropTarget(
            this.host.canvas,
            (payload, e) => this.handleDrop(payload, e)
        );

        this.host.canvas.onmousedown = (e) => this.handleCanvasClick(e);
        this.host.canvas.oncontextmenu = (e) => this.handleCanvasContextMenu(e);
    }

    public handleCanvasClick(e: MouseEvent) {
        if (e.target !== this.host.canvas) return;

        // Nur Rubber-Band starten wenn KEIN Connection-Handle gedraggt wird
        if (this.host.isDraggingHandle) return;

        // Rubber-Band starten
        const rect = this.host.canvas.getBoundingClientRect();
        this.rubberBandStart = {
            x: e.clientX - rect.left + this.host.canvas.scrollLeft,
            y: e.clientY - rect.top + this.host.canvas.scrollTop
        };
        this.isRubberBanding = true;

        // Visuelles Rechteck erstellen
        this.rubberBandEl = document.createElement('div');
        this.rubberBandEl.style.cssText = `
            position: absolute;
            border: 2px dashed rgba(0, 255, 255, 0.7);
            background: rgba(0, 255, 255, 0.08);
            pointer-events: none;
            z-index: 999;
        `;
        this.host.canvas.appendChild(this.rubberBandEl);

        const onMouseMove = (moveEvt: MouseEvent) => {
            if (!this.isRubberBanding || !this.rubberBandEl) return;
            const curX = moveEvt.clientX - rect.left + this.host.canvas.scrollLeft;
            const curY = moveEvt.clientY - rect.top + this.host.canvas.scrollTop;

            const left = Math.min(this.rubberBandStart.x, curX);
            const top = Math.min(this.rubberBandStart.y, curY);
            const width = Math.abs(curX - this.rubberBandStart.x);
            const height = Math.abs(curY - this.rubberBandStart.y);

            this.rubberBandEl.style.left = `${left}px`;
            this.rubberBandEl.style.top = `${top}px`;
            this.rubberBandEl.style.width = `${width}px`;
            this.rubberBandEl.style.height = `${height}px`;
        };

        const onMouseUp = (upEvt: MouseEvent) => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            if (!this.isRubberBanding || !this.rubberBandEl) return;

            // Rubber-Band auswerten
            const curX = upEvt.clientX - rect.left + this.host.canvas.scrollLeft;
            const curY = upEvt.clientY - rect.top + this.host.canvas.scrollTop;

            const selLeft = Math.min(this.rubberBandStart.x, curX);
            const selTop = Math.min(this.rubberBandStart.y, curY);
            const selRight = Math.max(this.rubberBandStart.x, curX);
            const selBottom = Math.max(this.rubberBandStart.y, curY);

            const selWidth = selRight - selLeft;
            const selHeight = selBottom - selTop;

            // Aufzieh-Rahmen entfernen
            this.rubberBandEl.remove();
            this.rubberBandEl = null;
            this.isRubberBanding = false;

            // Mindestgröße: Wenn Rahmen zu klein, als normaler Klick behandeln
            if (selWidth < 5 && selHeight < 5) {
                if (!upEvt.shiftKey) {
                    this.host.deselectAll(false);
                    if (this.host.onObjectSelect) {
                        this.host.onObjectSelect(this.host as any);
                    }
                }
                return;
            }

            // Alle Nodes im Rahmen finden
            const nodesInRect = this.host.nodes.filter(node => {
                const nx = node.X;
                const ny = node.Y;
                const nw = node.Width;
                const nh = node.Height;
                // Node muss teilweise im Rahmen liegen
                return nx + nw > selLeft && nx < selRight &&
                       ny + nh > selTop && ny < selBottom;
            });

            if (nodesInRect.length > 0) {
                this.host.selectionManager.selectMultiple(nodesInRect);
            } else if (!upEvt.shiftKey) {
                this.host.deselectAll(false);
                if (this.host.onObjectSelect) {
                    this.host.onObjectSelect(this.host as any);
                }
            }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    public handleCanvasContextMenu(e: MouseEvent) {
        if (e.target === this.host.canvas) {
            e.preventDefault();
            this.host.menuProvider.handleCanvasContextMenu(e);
        }
    }

    public handleNodeContextMenu(e: MouseEvent, node: FlowElement) {
        e.preventDefault();
        e.stopPropagation();
        this.host.menuProvider.handleNodeContextMenu(e, node);
    }

    public handleConnectionContextMenu(e: MouseEvent, conn: FlowConnection) {
        e.preventDefault();
        e.stopPropagation();
        this.host.menuProvider.handleConnectionContextMenu(e, conn);
    }

    private handleDrop(payload: DnDPayload, e: DragEvent) {
        let type = payload.toolType;
        let name = payload.name || (type === 'task' ? 'Task' : type);

        const rect = this.host.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Snap to grid
        const gridSize = this.host.flowStage.snapToGrid ? this.host.flowStage.cellSize : 1;
        const finalX = Math.floor(x / gridSize) * gridSize;
        const finalY = Math.floor(y / gridSize) * gridSize;

        this.host.createNode(type, finalX, finalY, name);
    }

    public setupNodeListeners(node: FlowElement) {
        node.getElement().addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.host.handleNodeDoubleClick(node);
        });

        node.getElement().addEventListener('contextmenu', (e) => {
            this.handleNodeContextMenu(e, node);
        });

        node.getElement().addEventListener('mousedown', (e) => {
            e.stopPropagation();

            // Shift+Klick: Toggle Selektion
            if (e.shiftKey) {
                this.host.selectionManager.toggleSelection(node);
                return;
            }

            const selectedNodes = this.host.selectionManager.getSelectedNodes();
            const isPartOfSelection = this.host.selectionManager.isSelected(node);

            // Wenn Node NICHT Teil der Multi-Selektion ist: nur diesen Node selektieren
            if (!isPartOfSelection || selectedNodes.length <= 1) {
                this.host.selectionManager.selectNode(node);
            }

            // Allow inputs inside nodes (like Sticky Nodes) to be focused/text-selected without dragging the node
            const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
            if (targetTag === 'input' || targetTag === 'textarea') {
                return;
            }

            // --- Drag-Logik ---
            const startX = e.clientX;
            const startY = e.clientY;

            // Gruppen-Drag: Startpositionen ALLER selektierten Nodes merken
            const dragNodes = isPartOfSelection && selectedNodes.length > 1
                ? selectedNodes
                : [node];
            const startPositions = dragNodes.map((n: FlowElement) => ({ node: n, x: n.X, y: n.Y }));

            const onMouseMove = (moveEvt: MouseEvent) => {
                const dx = moveEvt.clientX - startX;
                const dy = moveEvt.clientY - startY;

                startPositions.forEach((sp: { node: FlowElement, x: number, y: number }) => {
                    let newX = sp.x + dx;
                    let newY = sp.y + dy;

                    if (this.host.flowStage.snapToGrid) {
                        const snapped = this.host.flowStage.snapToGridPosition(newX, newY);
                        newX = snapped.x;
                        newY = snapped.y;
                    }

                    sp.node.X = newX;
                    sp.node.Y = newY;
                    sp.node.updatePosition();
                    if (sp.node.onMove) sp.node.onMove();
                });
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                this.host.syncToProject();
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        node.onMove = () => {
            this.host.connections.forEach(c => {
                if (c.startTarget === node || c.endTarget === node) {
                    c.updatePosition();
                }
            });
        };
        node.onResize = () => {
            this.host.connections.forEach(c => c.updatePosition());
        };

        const setupAnchor = (anchor: HTMLElement, isOutput: boolean, branchType?: string) => {
            if (!anchor) return;
            anchor.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (!isOutput) return;

                const rect = this.host.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left + this.host.canvas.scrollLeft;
                const y = e.clientY - rect.top + this.host.canvas.scrollTop;

                const conn = new FlowConnection(this.host.canvas, x, y, x, y);
                conn.setGridConfig(this.host.flowStage.cellSize);
                conn.attachStart(node); // ATTACH TO SOURCE NODE!

                const isGhostConnection = node.data?.isEmbeddedInternal || node.data?.parentProxyId;
                conn.data = {
                    ...conn.data,
                    startAnchorType: branchType || 'output',
                    originalStartAnchorType: branchType || 'output',
                    isEmbeddedInternal: !!isGhostConnection,
                    parentProxyId: node.data?.parentProxyId
                };

                this.host.connections.push(conn);
                this.setupConnectionListeners(conn);

                this.host.isDraggingHandle = true;
                this.host.activeHandle = conn.getEndHandle();
                this.host.activeHandle.dataset.isStart = 'false';
                this.host.activeConnection = conn;

                // Disable pointer events while dragging to not obscure drop targets
                conn.getElement().style.pointerEvents = 'none';

                logger.info(`[FlowInteraction] Created new connection from node ${node.Name} (branch: ${branchType || 'output'}), dragging handle`);
            });
        };

        if (node instanceof FlowCondition) {
            setupAnchor((node as any).trueAnchor, true, 'true');
            setupAnchor((node as any).falseAnchor, true, 'false');
        } else {
            setupAnchor(node.getOutputAnchor(), true);
        }

        const customPorts = node.getElement().querySelectorAll('.flow-anchor.custom-port');
        customPorts.forEach(port => {
            const branch = (port as HTMLElement).dataset.branch;
            if (branch === 'success' || branch === 'error') {
                setupAnchor(port as HTMLElement, true, branch);
            }
        });

        setupAnchor(node.getBottomAnchor(), true, 'bottom');

        node.onHover = (e, n) => this.showTooltip(e, n);
        node.onHoverEnd = () => this.hideTooltip();
    }

    public setupConnectionListeners(conn: FlowConnection) {
        conn.getElement().addEventListener('click', (e) => {
            e.stopPropagation();
            this.host.deselectAll();
            conn.select();
            this.host.selectedConnection = conn;
        });

        conn.getElement().addEventListener('contextmenu', (e) => {
            this.handleConnectionContextMenu(e, conn);
        });

        const setupHandle = (handle: HTMLElement, isStart: boolean) => {
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.host.isDraggingHandle = true;
                this.host.activeHandle = handle;
                this.host.activeHandle.dataset.isStart = isStart ? 'true' : 'false';
                this.host.activeConnection = conn;

                // Disable pointer events while dragging
                conn.getElement().style.pointerEvents = 'none';

                // Keep selection visual but DO NOT trigger global inspector update while dragging
                conn.select();
            });
        };

        setupHandle(conn.getStartHandle(), true);
        setupHandle(conn.getEndHandle(), false);
    }

    public handleGlobalMove(e: MouseEvent) {
        if (!this.host.isDraggingHandle || !this.host.activeHandle || !this.host.activeConnection) return;
        const rect = this.host.canvas.getBoundingClientRect();
        let x = e.clientX - rect.left + this.host.canvas.scrollLeft;
        let y = e.clientY - rect.top + this.host.canvas.scrollTop;

        if (this.host.flowStage.snapToGrid) {
            const snapped = this.host.flowStage.snapToGridPosition(x, y);
            x = snapped.x;
            y = snapped.y;
        }

        const isStart = this.host.activeHandle.dataset.isStart === 'true';
        if (isStart) {
            this.host.activeConnection.updatePath(x, y, this.host.activeConnection.EndX, this.host.activeConnection.EndY);
        } else {
            this.host.activeConnection.updatePath(this.host.activeConnection.StartX, this.host.activeConnection.StartY, x, y);
        }

        // Debug Log only every ~20 frames to avoid spam
        if (Math.random() < 0.05) {
            logger.info(`[FlowInteraction] Dragging connection (isStart=${isStart}) to (${x}, ${y})`);
        }
    }

    public handleGlobalUp(e: MouseEvent) {
        if (!this.host.isDraggingHandle || !this.host.activeHandle || !this.host.activeConnection) return;

        const isStart = this.host.activeHandle.dataset.isStart === 'true';

        let targetNode: FlowElement | null = null;
        let targetAnchorType: string | null = null;

        // More robust hit test: Check all anchors on all nodes
        const padding = 15; // Increased buffer for direct anchor hits
        const bodyMagnetSize = 25; // "Magnet" area around node bodies

        // 1. PRIORITY 1: Direct Anchor Hit Test (Check all nodes first)
        for (const node of this.host.nodes) {
            const anchors = node.getElement().querySelectorAll('.flow-anchor');
            for (const anchor of Array.from(anchors) as HTMLElement[]) {
                const arect = anchor.getBoundingClientRect();
                if (e.clientX >= arect.left - padding && e.clientX <= arect.right + padding &&
                    e.clientY >= arect.top - padding && e.clientY <= arect.bottom + padding) {

                    targetNode = node;
                    if (anchor.classList.contains('input')) targetAnchorType = 'input';
                    else if (anchor.classList.contains('output')) targetAnchorType = 'output';
                    else if (anchor.classList.contains('top')) targetAnchorType = 'top';
                    else if (anchor.classList.contains('bottom')) targetAnchorType = 'bottom';
                    else if (anchor.classList.contains('success-port') || anchor.classList.contains('success')) targetAnchorType = 'success';
                    else if (anchor.classList.contains('error-port') || anchor.classList.contains('error')) targetAnchorType = 'error';
                    else if (anchor.classList.contains('true')) targetAnchorType = 'true';
                    else if (anchor.classList.contains('false')) targetAnchorType = 'false';
                    else if (anchor.dataset.branch) targetAnchorType = anchor.dataset.branch;

                    logger.info(`[FlowInteraction] Direct anchor hit: node=${node.Name}, type=${targetAnchorType}`);
                    break;
                }
            }
            if (targetNode) break;
        }

        // 2. PRIORITY 2: Node Body Magnet Hit (If no direct anchor hit found)
        if (!targetNode) {
            for (const node of this.host.nodes) {
                const nrect = node.getElement().getBoundingClientRect();
                if (e.clientX >= nrect.left - bodyMagnetSize && e.clientX <= nrect.right + bodyMagnetSize &&
                    e.clientY >= nrect.top - bodyMagnetSize && e.clientY <= nrect.bottom + bodyMagnetSize) {

                    targetNode = node;

                    // Determine NEAREST anchor type
                    const availableTypes: any[] = ['input', 'output', 'top', 'bottom'];
                    if (node instanceof FlowCondition) availableTypes.push('true', 'false');
                    if (node.getType() === 'action' && (node as any).actionType === 'data_action') availableTypes.push('success', 'error');

                    let minDistance = Infinity;
                    let nearestType = isStart ? 'output' : 'input';

                    const rect = this.host.canvas.getBoundingClientRect();
                    const mouseX = e.clientX - rect.left + this.host.canvas.scrollLeft;
                    const mouseY = e.clientY - rect.top + this.host.canvas.scrollTop;

                    availableTypes.forEach(type => {
                        const pos = node.getAnchorPosition(type);
                        const dist = Math.sqrt((pos.x - mouseX) ** 2 + (pos.y - mouseY) ** 2);
                        if (dist < minDistance) {
                            minDistance = dist;
                            nearestType = type;
                        }
                    });

                    targetAnchorType = nearestType;
                    logger.info(`[FlowInteraction] Magnet hit: node=${node.Name}, nearest type=${targetAnchorType}`);
                    break;
                }
            }
        }

        if (targetNode) {
            logger.info(`[FlowInteraction:UP_HIT] ID=${this.host.activeConnection.id} target=${targetNode.Name} isStart=${isStart}`);
            if (this.host.activeConnection) {
                this.host.activeConnection.getElement().style.pointerEvents = 'auto';
            }
            if (isStart) {
                this.host.activeConnection.attachStart(targetNode);
                if (targetAnchorType) this.host.activeConnection.data.startAnchorType = targetAnchorType;
            } else {
                this.host.activeConnection.attachEnd(targetNode);
                if (targetAnchorType) this.host.activeConnection.data.endAnchorType = targetAnchorType;
            }
            this.host.activeConnection.updatePosition();
            this.host.syncToProject();
            // Trigger immediate logic sync for connections
            if (this.host.syncManager) {
                this.host.syncManager.syncToProject(this.host.currentFlowContext);
            }
            // Auto-Formatierung nach Verbindungsherstellung
            if (this.host.formatLayout) {
                setTimeout(() => this.host.formatLayout!(), 50);
            }

            // Re-select to update Inspector with final attachment state
            // and trigger the selectConnection event AFTER attach is fully complete
            this.host.selectionManager.selectConnection(this.host.activeConnection);
        } else {
            logger.info(`[FlowInteraction:UP_MISS] ID=${this.host.activeConnection.id} - Pointed into void, keeping as floating`);
            if (this.host.activeConnection) {
                this.host.activeConnection.getElement().style.pointerEvents = 'auto';
            }

            // Allow standalone connections to exist (don't auto-delete them).
            // This allows drawing connections from the toolbox and placing them 
            // before attaching them to nodes.
            if (this.host.activeConnection) {
                this.host.activeConnection.updatePosition();

                // Only select it if it's not already fully detached and we just dropped it in nowhere
                this.host.selectionManager.selectConnection(this.host.activeConnection);
            }
        }

        this.host.isDraggingHandle = false;
        this.host.activeHandle = null;
        this.host.activeConnection = null;
    }

    private showTooltip(e: MouseEvent, node: FlowElement) {
        if (!node.Description) return;
        if (!this.tooltipEl) {
            this.tooltipEl = document.createElement('div');
            this.tooltipEl.style.cssText = `
                position: absolute; background: #252526; color: #cccccc; border: 1px solid #ffcc00;
                padding: 8px 12px; border-radius: 4px; font-family: sans-serif; font-size: 12px;
                max-width: 250px; box-shadow: 0 4px 10px rgba(0,0,0,0.5); pointer-events: none;
                z-index: 1000; line-height: 1.4;
            `;
            document.body.appendChild(this.tooltipEl);
        }
        this.tooltipEl.innerHTML = `<strong style="color: #fff; display: block; margin-bottom: 4px;">${SecurityUtils.escapeHtml(node.Name)}</strong>${SecurityUtils.escapeHtml(node.Description)}`;
        this.tooltipEl.style.display = 'block';
        this.tooltipEl.style.left = (e.pageX + 15) + 'px';
        this.tooltipEl.style.top = (e.pageY + 15) + 'px';
    }

    private hideTooltip() {
        if (this.tooltipEl) this.tooltipEl.style.display = 'none';
    }
}
