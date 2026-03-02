
import { FlowElement } from './FlowElement';

export class FlowStart extends FlowElement {
    public getType(): string { return 'start'; }

    constructor(id: string, x: number, y: number, container: HTMLElement, gridSize: number) {
        super(id, x, y, container, gridSize);
        this.applyStartStyling();
    }

    private applyStartStyling() {
        // Clear previous classes if any
        this.element.classList.add('flow-element', 'flow-node-glass', 'glass-node-start', 'pulse-glow');

        // Dimensions: 8 columns wide, 3 rows high (Standard)
        this.width = this.gridSize * 8;
        this.height = this.gridSize * 3;
        this.updatePosition();
        this.element.style.borderRadius = '12px';

        // Match content from the mockup: Icon + "START" text
        this.content.innerHTML = `
            <span class="start-icon-modern">▶</span>
            <span style="font-size: 20px;">START</span>
        `;
        this.content.style.padding = '0';
        this.content.style.width = '100%';
        this.content.style.height = '100%';
        this.content.style.display = 'flex';
        this.content.style.alignItems = 'center';
        this.content.style.justifyContent = 'center';

        this.updatePosition();

        // Hide Input Anchor (Start only has output)
        if (this.inputAnchor) {
            this.inputAnchor.style.display = 'none';
        }

        // Resizing is now enabled (default behavior from base class)
        // We just ensure the resizer is visible and styled properly
        const children = Array.from(this.element.children);
        const resizer = children.find(c => (c as HTMLElement).style.cursor === 'se-resize');
        if (resizer) {
            (resizer as HTMLElement).style.display = 'block';
            (resizer as HTMLElement).style.background = 'rgba(255,255,255,0.3)';
            (resizer as HTMLElement).style.zIndex = '10';
        }
    }
}
