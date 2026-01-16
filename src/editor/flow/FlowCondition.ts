
import { FlowElement } from './FlowElement';

export class FlowCondition extends FlowElement {
    public getType(): string { return 'Condition'; }

    public trueAnchor!: HTMLElement;
    public falseAnchor!: HTMLElement;

    constructor(id: string, x: number, y: number, container: HTMLElement, gridSize: number) {
        super(id, x, y, container, gridSize);
        this.applyConditionStyling();
    }

    protected createRoot(): HTMLElement {
        const el = super.createRoot();

        // Remove default output anchor as we need two specialized ones
        if (this.outputAnchor && this.outputAnchor.parentNode) {
            this.outputAnchor.parentNode.removeChild(this.outputAnchor);
        }

        // Create True/False Anchors
        // Input is already at the left tip (handled by FlowElement)

        // True Anchor at the Right Tip
        this.trueAnchor = this.createAnchor('output');
        this.trueAnchor.classList.add('true-branch');
        this.trueAnchor.style.background = '#4CAF50';
        this.trueAnchor.style.top = '50%';
        this.trueAnchor.style.right = '-5px';
        this.trueAnchor.title = 'True Path';

        // False Anchor at the Bottom Tip
        this.falseAnchor = this.createAnchor('output');
        this.falseAnchor.classList.add('false-branch');
        this.falseAnchor.style.background = '#F44336';
        this.falseAnchor.style.top = 'auto';
        this.falseAnchor.style.bottom = '-5px';
        this.falseAnchor.style.left = '50%';
        this.falseAnchor.style.right = 'auto';
        this.falseAnchor.style.transform = 'translateX(-50%)';
        this.falseAnchor.title = 'False Path';

        el.appendChild(this.trueAnchor);
        el.appendChild(this.falseAnchor);

        return el;
    }

    private applyConditionStyling() {
        // Clear and apply modern glass classes
        this.element.classList.add('flow-element', 'flow-node-glass', 'glass-node-condition');

        // Reset base styles to let the children handle the look
        this.element.style.backgroundColor = 'transparent';
        this.element.style.border = 'none';
        this.element.style.boxShadow = 'none';
        this.element.style.color = 'white';
        this.element.style.fontWeight = 'bold';
        this.element.style.fontFamily = 'sans-serif';

        // Create diamond glass background
        const glassBg = document.createElement('div');
        glassBg.className = 'flow-node-glass glass-node-condition';
        glassBg.style.position = 'absolute';
        glassBg.style.top = '0';
        glassBg.style.left = '0';
        glassBg.style.width = '100%';
        glassBg.style.height = '100%';
        glassBg.style.clipPath = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
        glassBg.style.zIndex = '0';
        this.element.insertBefore(glassBg, this.element.firstChild);

        // Adjust content container for diamond shape
        this.content.style.padding = '0 20px';
        this.content.style.fontSize = '11px';
        this.content.style.textAlign = 'center';
        this.content.style.position = 'relative'; // Ensure it's above glassBg
        this.content.style.zIndex = '1';

        // Dimensions are inherited from base class (gridSize * 8, gridSize * 3)
        this.updatePosition();
    }

    public getAnchorPosition(type: 'input' | 'output' | 'true' | 'false' | 'top' | 'bottom'): { x: number, y: number } {
        switch (type) {
            case 'input':
                return { x: this.x, y: this.y + this.height / 2 };  // Left tip (middle)
            case 'true':
                return { x: this.x + this.width, y: this.y + this.height / 2 };  // Right tip
            case 'false':
            case 'bottom':
                return { x: this.x + this.width / 2, y: this.y + this.height };  // Bottom tip
            case 'top':
                return { x: this.x + this.width / 2, y: this.y };  // Top tip (INPUT anchor)
            case 'output':
            default:
                return { x: this.x + this.width, y: this.y + this.height / 2 };  // Right tip
        }
    }

    public getInspectorProperties(): any[] {
        return [
            ...super.getInspectorProperties(),
            { name: 'Variable', type: 'string', label: 'Variable' },
            { name: 'Operator', type: 'select', label: 'Operator', options: ['==', '!=', '>', '<', '>=', '<='] },
            { name: 'Value', type: 'string', label: 'Value' }
        ];
    }

    // Property Accessors
    public get Variable(): string { return this.data.condition?.variable || ''; }
    public set Variable(v: string) {
        if (!this.data.condition) this.data.condition = {};
        this.data.condition.variable = v;
        this.updateText();
    }

    public get Operator(): string { return this.data.condition?.operator || '=='; }
    public set Operator(v: string) {
        if (!this.data.condition) this.data.condition = {};
        this.data.condition.operator = v;
        this.updateText();
    }

    public get Value(): string { return this.data.condition?.value || ''; }
    public set Value(v: string) {
        if (!this.data.condition) this.data.condition = {};
        this.data.condition.value = v;
        this.updateText();
    }

    private updateText() {
        const cond = this.data.condition;
        if (cond && cond.variable) {
            this.setText(`${cond.variable} ${cond.operator} ${cond.value}`, true);
        } else {
            this.setText("Bedingung", true);
        }
    }
}
