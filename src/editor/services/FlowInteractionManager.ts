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
    deselectAll(emitEvent?: boolean): void;
    syncToProject(): void;
    handleNodeDoubleClick(node: FlowElement): void;

    // State needed for dragging
    isDraggingHandle: boolean;
    activeHandle: HTMLElement | null;
    activeConnection: FlowConnection | null;
    selectedConnection: FlowConnection | null;
}

export class FlowInteractionManager {
    private host: FlowInteractionHost;
    private tooltipEl: HTMLElement | null = null;

    constructor(host: FlowInteractionHost) {
        this.host = host;
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
            this.host.menuProvider.showCanvasContextMenu(e);
        }
    }

    public handleNodeContextMenu(e: MouseEvent, node: FlowElement) {
        e.preventDefault();
        e.stopPropagation();
        this.host.menuProvider.showNodeContextMenu(e, node);
    }

    public handleConnectionContextMenu(e: MouseEvent, conn: FlowConnection) {
        e.preventDefault();
        e.stopPropagation();
        this.host.menuProvider.showConnectionContextMenu(e, conn);
    }

    public handleDrop(e: DragEvent) {
        e.preventDefault();
        const rawData = e.dataTransfer?.getData('application/flow-item');
        if (!rawData) return;

        let type = rawData;
        let data: any = null;

        if (rawData.startsWith('{')) {
            try {
                data = JSON.parse(rawData);
                type = data.type;
            } catch (err) {
                console.warn('[FlowInteractionManager] Failed to parse drop data as JSON', err);
            }
        }

        const rect = this.host.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        let finalX = x;
        let finalY = y;

        if (this.host.flowStage.snapToGrid) {
            const snapped = this.host.flowStage.snapToGridPosition(x, y);
            finalX = snapped.x;
            finalY = snapped.y;
        }

        if (type === 'Task') {
            this.host.createNode(type, finalX, finalY, data?.name || 'Task');
        } else {
            this.host.createNode(type, finalX, finalY, type);
        }
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

                this.host.deselectAll();
                conn.select();
                this.host.selectedConnection = conn;
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
                this.host.deselectAll();
                conn.select();
                this.host.selectedConnection = conn;
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
    }

    public handleGlobalUp(e: MouseEvent) {
        if (!this.host.isDraggingHandle || !this.host.activeHandle || !this.host.activeConnection) return;

        const isStart = this.host.activeHandle.dataset.isStart === 'true';

        let targetNode: FlowElement | null = null;
        let targetAnchorType: string | null = null;

        // More robust hit test: Check all anchors on all nodes
        const padding = 5; // 5px buffer for better hit-test reliability
        for (const node of this.host.nodes) {
            const anchors = node.getElement().querySelectorAll('.flow-anchor');
            let found = false;
            for (const anchor of Array.from(anchors) as HTMLElement[]) {
                const arect = anchor.getBoundingClientRect();
                // Check if mouse is within anchor bounds (including padding)
                if (e.clientX >= arect.left - padding && e.clientX <= arect.right + padding &&
                    e.clientY >= arect.top - padding && e.clientY <= arect.bottom + padding) {

                    targetNode = node;

                    // Determine anchor type from class or dataset
                    if (anchor.classList.contains('input')) targetAnchorType = 'input';
                    else if (anchor.classList.contains('output')) targetAnchorType = 'output';
                    else if (anchor.classList.contains('top')) targetAnchorType = 'top';
                    else if (anchor.classList.contains('bottom')) targetAnchorType = 'bottom';
                    else if (anchor.classList.contains('success-port') || anchor.classList.contains('success')) targetAnchorType = 'success';
                    else if (anchor.classList.contains('error-port') || anchor.classList.contains('error')) targetAnchorType = 'error';
                    else if (anchor.classList.contains('true')) targetAnchorType = 'true';
                    else if (anchor.classList.contains('false')) targetAnchorType = 'false';
                    else if (anchor.dataset.branch) targetAnchorType = anchor.dataset.branch;

                    console.log(`[FlowInteraction] Target anchor found: node=${node.Name}, type=${targetAnchorType}`);
                    found = true;
                    break;
                }
            }
            if (found) break;
        }

        if (targetNode) {
            if (isStart) {
                this.host.activeConnection.attachStart(targetNode);
                if (targetAnchorType) this.host.activeConnection.data.startAnchorType = targetAnchorType;
            } else {
                this.host.activeConnection.attachEnd(targetNode);
                if (targetAnchorType) this.host.activeConnection.data.endAnchorType = targetAnchorType;
            }
            this.host.activeConnection.updatePosition();
            this.host.syncToProject();
        } else {
            // ONLY delete if NO targets exist on either side (relaxed from "both must be set")
            // This prevents existing connections from disappearing when re-adjusting one end
            if (!this.host.activeConnection.startTarget && !this.host.activeConnection.endTarget) {
                this.host.deleteConnection(this.host.activeConnection);
            } else {
                this.host.activeConnection.updatePosition();
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
