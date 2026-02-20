
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
            { group: 'Condition', name: 'LeftOperandType', type: 'select', label: 'Links Typ', options: ['variable', 'literal', 'property'] },
            { group: 'Condition', name: 'LeftOperandValue', type: 'string', label: 'Links Wert' },
            { group: 'Condition', name: 'Operator', type: 'select', label: 'Operator', options: ['==', '!=', '>', '<', '>=', '<='] },
            { group: 'Condition', name: 'RightOperandType', type: 'select', label: 'Rechts Typ', options: ['variable', 'literal', 'property'] },
            { group: 'Condition', name: 'RightOperandValue', type: 'string', label: 'Rechts Wert' }
        ];
    }

    // Property Accessors
    public get LeftOperandType(): string { return this.data.condition?.leftType || 'variable'; }
    public set LeftOperandType(v: string) {
        if (!this.data.condition) this.data.condition = {};
        this.data.condition.leftType = v;
        this.updateText();
    }

    public get LeftOperandValue(): string {
        const v = this.data.condition?.leftValue || this.data.condition?.variable || '';
        console.log(`[FlowCondition] get LeftOperandValue: "${v}"`);
        return v;
    }
    public set LeftOperandValue(v: string) {
        console.log(`[FlowCondition] set LeftOperandValue: "${v}"`);
        if (!this.data.condition) this.data.condition = {};
        this.data.condition.leftValue = v;
        this.updateText();
    }

    // --- Helper for Sub-Properties ---
    public get LeftOperandBaseVar(): string {
        const full = this.LeftOperandValue;
        if (!full.includes('${')) return full;

        const parts = full.split('.');
        let result = full;
        if (parts.length >= 2) {
            // Reconstruct ${scope.var}
            const base = parts[0] + '.' + parts[1];
            result = base.includes('}') ? base : base + '}';
        }
        console.log(`[FlowCondition] get LeftOperandBaseVar for "${full}" -> "${result}"`);
        return result;
    }
    public set LeftOperandBaseVar(v: string) {
        console.log(`[FlowCondition] set LeftOperandBaseVar: "${v}"`);
        this.LeftOperandValue = v; // Resets sub-prop when base changes
    }

    public get LeftOperandSubProp(): string {
        const full = this.LeftOperandValue;
        if (!full.includes('${')) return '';

        const parts = full.split('.');
        if (parts.length >= 3) {
            // Extract 'prop' from ${scope.var.prop}
            return parts[2].replace('}', '').trim();
        }
        return '';
    }
    public set LeftOperandSubProp(v: string) {
        console.log(`[FlowCondition] set LeftOperandSubProp: "${v}"`);
        if (!v) {
            this.LeftOperandValue = this.LeftOperandBaseVar;
            return;
        }
        const base = this.LeftOperandBaseVar.replace('}', '');
        this.LeftOperandValue = `${base}.${v}}`;
    }

    public get RightOperandType(): string { return this.data.condition?.rightType || 'literal'; }
    public set RightOperandType(v: string) {
        if (!this.data.condition) this.data.condition = {};
        this.data.condition.rightType = v;
        this.updateText();
    }

    public get RightOperandValue(): string {
        const v = this.data.condition?.rightValue || this.data.condition?.value || '';
        // console.log(`[FlowCondition] get RightOperandValue: "${v}"`);
        return v;
    }
    public set RightOperandValue(v: string) {
        if (!this.data.condition) this.data.condition = {};
        this.data.condition.rightValue = v;
        this.updateText();
    }

    public get RightOperandBaseVar(): string {
        const full = this.RightOperandValue;
        if (!full.includes('${')) return full;

        const parts = full.split('.');
        if (parts.length >= 2) {
            const base = parts[0] + '.' + parts[1];
            return base.includes('}') ? base : base + '}';
        }
        return full;
    }
    public set RightOperandBaseVar(v: string) {
        this.RightOperandValue = v;
    }

    public get RightOperandSubProp(): string {
        const full = this.RightOperandValue;
        if (!full.includes('${')) return '';

        const parts = full.split('.');
        if (parts.length >= 3) {
            return parts[2].replace('}', '').trim();
        }
        return '';
    }
    public set RightOperandSubProp(v: string) {
        if (!v) {
            this.RightOperandValue = this.RightOperandBaseVar;
            return;
        }
        const base = this.RightOperandBaseVar.replace('}', '');
        this.RightOperandValue = `${base}.${v}}`;
    }

    // Legacy Support (maps to LeftOperandValue)
    public get VariableName(): string { return this.LeftOperandValue; }
    public set VariableName(v: string) { this.LeftOperandValue = v; }

    public get Operator(): string { return this.data.condition?.operator || '=='; }
    public set Operator(v: string) {
        if (!this.data.condition) this.data.condition = {};
        this.data.condition.operator = v;
        this.updateText();
    }

    public get Value(): string { return this.RightOperandValue; }
    public set Value(v: string) { this.RightOperandValue = v; }

    private updateText() {
        const cond = this.data.condition;
        if (cond) {
            const left = cond.leftValue || cond.variable || '?';
            const right = cond.rightValue || cond.value || '?';
            const op = cond.operator || '==';
            this.setText(`${left} ${op} ${right}`, true);
        } else {
            this.setText("Bedingung", true);
        }
    }
}
