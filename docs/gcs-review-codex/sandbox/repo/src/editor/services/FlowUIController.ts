import { FlowElement } from '../flow/FlowElement';
import { FlowConnection } from '../flow/FlowConnection';
import { mediatorService, MediatorEvents } from '../../services/MediatorService';


// const logger = Logger.get('FlowUIController');

export interface FlowUIHost {
    flowStage: any;
    nodes: FlowElement[];
    connections: FlowConnection[];
    canvas: HTMLElement;
    project: any;
    currentFlowContext: string;
    flowSelect: HTMLSelectElement;

    syncToProject(): void;
    updateFlowSelector(): void;
    loadFromProject(contextName?: string): void;
}

export class FlowUIController {
    constructor(private host: FlowUIHost) { }

    public updateGrid() {
        if (!this.host.flowStage) return;

        const cellSize = this.host.flowStage.cellSize;
        const bg = this.host.flowStage.style.backgroundColor || '#1e1e1e';
        const snap = this.host.flowStage.snapToGrid;

        // Propagate grid settings to all nodes
        this.host.nodes.forEach(node => {
            node.setGridConfig(cellSize, snap);
        });

        // Propagate grid settings to all connections
        this.host.connections.forEach(conn => {
            conn.setGridConfig(cellSize);
        });

        if (!this.host.flowStage.showGrid) {
            this.host.canvas.style.backgroundImage = 'none';
            this.host.canvas.style.backgroundColor = bg;
        } else {
            const gridColor = bg === '#ffffff' ? '#ccc' : '#555';
            this.host.canvas.style.backgroundColor = bg;
            this.host.canvas.style.backgroundImage = `radial-gradient(circle at 0px 0px, ${gridColor} 1px, transparent 1px)`;
            this.host.canvas.style.backgroundSize = `${cellSize}px ${cellSize}px`;
        }
    }

    public getInspectorProperties(): any[] {
        return [
            { name: 'GridColumns', type: 'number', label: 'Columns', group: 'Grid' },
            { name: 'GridRows', type: 'number', label: 'Rows', group: 'Grid' },
            { name: 'CellSize', type: 'number', label: 'Cell Size (px)', group: 'Grid' },
            { name: 'SnapToGrid', type: 'boolean', label: 'Snap to Grid', group: 'Grid' },
            { name: 'ShowGrid', type: 'boolean', label: 'Show Grid', group: 'Grid' },
            { name: 'BackgroundColor', type: 'color', label: 'Background', group: 'Grid' }
        ];
    }

    public initMediator() {
        mediatorService.on(MediatorEvents.DATA_CHANGED, (data: any, originator?: string) => {

            if (originator !== 'flow-editor' && this.host.project) {
                if (data && (data.property === 'Name' || data.property === 'name')) {
                    if (data.oldValue === this.host.currentFlowContext && data.value) {

                        (this.host as any).currentFlowContext = data.value;
                        localStorage.setItem('gcs_last_flow_context', data.value);
                        this.host.loadFromProject(data.value);
                    }
                }
                this.host.updateFlowSelector();
            }
        });
    }

    // Property Accessors (to be called from FlowEditor)
    public getGridColumns(): number { return this.host.flowStage.cols; }
    public setGridColumns(v: number) {
        this.host.flowStage.cols = v;
        this.updateGrid();
        this.host.syncToProject();
    }

    public getGridRows(): number { return this.host.flowStage.rows; }
    public setGridRows(v: number) {
        this.host.flowStage.rows = v;
        this.updateGrid();
        this.host.syncToProject();
    }

    public getCellSize(): number { return this.host.flowStage.cellSize; }
    public setCellSize(v: number) {
        this.host.flowStage.cellSize = v;
        this.updateGrid();
        this.host.syncToProject();
    }

    public getSnapToGrid(): boolean { return this.host.flowStage.snapToGrid; }
    public setSnapToGrid(v: boolean) {
        this.host.flowStage.snapToGrid = v;
        this.updateGrid();
        this.host.syncToProject();
    }

    public getShowGrid(): boolean { return this.host.flowStage.showGrid; }
    public setShowGrid(v: boolean) {
        this.host.flowStage.showGrid = v;
        this.updateGrid();
        this.host.syncToProject();
    }

    public getBackgroundColor(): string { return this.host.flowStage.style.backgroundColor || '#1e1e1e'; }
    public setBackgroundColor(v: string) {
        this.host.flowStage.style.backgroundColor = v;
        this.updateGrid();
        this.host.syncToProject();
    }

    /**
     * Updates the internal 'world' size to ensure the canvas is scrollable
     */
    public updateScrollArea(): void {
        const world = document.getElementById('flow-world');
        if (!world) return;

        let maxX = 2000;
        let maxY = 2000;

        this.host.nodes.forEach(n => {
            const bounds = { x: (n as any).x + 400, y: (n as any).y + 400 };
            if (bounds.x > maxX) maxX = bounds.x;
            if (bounds.y > maxY) maxY = bounds.y;
        });

        world.style.width = maxX + 'px';
        world.style.height = maxY + 'px';
    }
}
