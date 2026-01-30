import { TStage } from './TStage';
export class TFlowStage extends TStage {
    constructor(name, cols = 100, rows = 100, cellSize = 20) {
        super(name, 0, 0, cols, rows, cellSize);
        this.style.backgroundColor = '#1e1e1e'; // Default dark background for Flow
        this.style.borderColor = '#444';
        // Flow Stage defaults
        this.snapToGrid = true;
        this.showGrid = true;
    }
    // Override or add specific Inspector properties if needed
    getInspectorProperties() {
        // We reuse TStage properties for now as they are perfect (cols, rows, cellSize, etc.)
        const props = super.getInspectorProperties();
        return props;
    }
    toJSON() {
        return super.toJSON();
    }
}
