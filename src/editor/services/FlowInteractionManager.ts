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

    createNode(type: string, x: number, y: number, initialName?: string): FlowElement | null;
    deleteNode(node: FlowElement): void;
    deleteConnection(conn: FlowConnection): void;
    syncToProject(): void;
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

export class FlowInteractionManager {
    private host: FlowInteractionHost;
    private tooltipEl: HTMLElement | null = null;

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
        if (e.target === this.host.canvas) {
            this.host.deselectAll(false);
            if (this.host.onObjectSelect) {
                this.host.onObjectSelect(this.host as any);
            }
        }
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
            const startX = e.clientX;
            const startY = e.clientY;
            const startNodeX = node.X;
            const startNodeY = node.Y;

            const onMouseMove = (moveEvt: MouseEvent) => {
                const dx = moveEvt.clientX - startX;
                const dy = moveEvt.clientY - startY;
                let newX = startNodeX + dx;
                let newY = startNodeY + dy;

                if (this.host.flowStage.snapToGrid) {
                    const snapped = this.host.flowStage.snapToGridPosition(newX, newY);
                    newX = snapped.x;
                    newY = snapped.y;
                }

                node.X = newX;
                node.Y = newY;
                node.updatePosition();
                if (node.onMove) node.onMove();
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                this.host.syncToProject();
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            this.host.selectionManager.selectNode(node);
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

                console.log(`[FlowInteraction] Created new connection from node ${node.Name} (branch: ${branchType || 'output'}), dragging handle`);
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
            console.log(`[FlowInteraction] Dragging connection (isStart=${isStart}) to (${x}, ${y})`);
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

                    console.log(`[FlowInteraction] Direct anchor hit: node=${node.Name}, type=${targetAnchorType}`);
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
                    console.log(`[FlowInteraction] Magnet hit: node=${node.Name}, nearest type=${targetAnchorType}`);
                    break;
                }
            }
        }

        if (targetNode) {
            console.log(`[FlowInteraction:UP_HIT] ID=${this.host.activeConnection.id} target=${targetNode.Name} isStart=${isStart}`);
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

            // Re-select to update Inspector with final attachment state
            // and trigger the selectConnection event AFTER attach is fully complete
            this.host.selectionManager.selectConnection(this.host.activeConnection);
        } else {
            console.log(`[FlowInteraction:UP_MISS] ID=${this.host.activeConnection.id} - Pointed into void, keeping as floating`);
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
        this.tooltipEl.innerHTML = `<strong style="color: #fff; display: block; margin-bottom: 4px;">${node.Name}</strong>${node.Description}`;
        this.tooltipEl.style.display = 'block';
        this.tooltipEl.style.left = (e.pageX + 15) + 'px';
        this.tooltipEl.style.top = (e.pageY + 15) + 'px';
    }

    private hideTooltip() {
        if (this.tooltipEl) this.tooltipEl.style.display = 'none';
    }
}
