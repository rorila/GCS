import { FlowElement } from './FlowElement';
import { InspectorSection } from '../inspector/types';
import { PropertyHelper } from '../../runtime/PropertyHelper';
import { projectRegistry } from '../../services/ProjectRegistry';
import { componentRegistry } from '../../services/ComponentRegistry';
import { Logger } from '../../utils/Logger';

const logger = Logger.get('FlowCondition');

export class FlowCondition extends FlowElement {
    public getType(): string { return 'condition'; }

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
        const props: any[] = [
            ...super.getInspectorProperties(),
            { group: 'Condition', name: 'LeftOperandType', type: 'select', label: 'Links Typ', options: ['variable', 'literal', 'property'] }
        ];

        // --- LINKS OPARAND ---
        if (this.LeftOperandType === 'variable') {
            const legacyVars = projectRegistry.getVariables(undefined, true, 'all').map(v => v.name);
            const compVars = projectRegistry.getObjects('all').filter(c => (c.className || c.type || '').endsWith('Variable')).map(c => c.name);
            const allVars = Array.from(new Set([...legacyVars, ...compVars]));
            const options = allVars.map(n => `\${${n}}`);
            props.push({ group: 'Condition', name: 'LeftOperandValue', type: 'select', label: 'Links Variable', options: options.length ? options : ['(Keine Variable gefunden)'] });
        } else if (this.LeftOperandType === 'property') {
            const comps = projectRegistry.getObjects('all')
                .filter(c => c.name)
                .map(c => ({
                    value: c.uiScope === 'global' ? `global.${c.name}` : c.name,
                    label: c.uiScope === 'global' ? `${c.name} (global)` : c.name
                }));
            props.push({ group: 'Condition', name: 'LeftOperandBaseVar', type: 'select', label: 'Links Objekt', options: comps.length ? comps : ['(Keine Elemente)'] });

            let availableProps: string[] = ['(Auswählen)'];
            const baseVarStr = this.LeftOperandBaseVar || '';
            const cleanTarget = baseVarStr.replace(/^global\./, '');
            const targetObj = projectRegistry.getObjects('all').find(c => c.name === cleanTarget);
            if (targetObj) {
                const inspProps = componentRegistry.getInspectorProperties(targetObj) || [];
                availableProps = inspProps.map((p: any) => p.name).filter((n: string) => n);
            }
            props.push({ group: 'Condition', name: 'LeftOperandSubProp', type: 'select', label: 'Links Eigenschaft', options: availableProps.length ? availableProps : ['(Keine)'] });
        } else {
            props.push({ group: 'Condition', name: 'LeftOperandValue', type: 'string', label: 'Links Wert' });
        }

        props.push({ group: 'Condition', name: 'Operator', type: 'select', label: 'Operator', options: ['==', '!=', '>', '<', '>=', '<='] });
        props.push({ group: 'Condition', name: 'RightOperandType', type: 'select', label: 'Rechts Typ', options: ['variable', 'literal', 'property'] });

        // --- RECHTS OPERAND ---
        if (this.RightOperandType === 'variable') {
            const legacyVars = projectRegistry.getVariables(undefined, true, 'all').map(v => v.name);
            const compVars = projectRegistry.getObjects('all').filter(c => (c.className || c.type || '').endsWith('Variable')).map(c => c.name);
            const allVars = Array.from(new Set([...legacyVars, ...compVars]));
            const options = allVars.map(n => `\${${n}}`);
            props.push({ group: 'Condition', name: 'RightOperandValue', type: 'select', label: 'Rechts Variable', options: options.length ? options : ['(Keine Variable gefunden)'] });
        } else if (this.RightOperandType === 'property') {
            const comps = projectRegistry.getObjects('all')
                .filter(c => c.name)
                .map(c => ({
                    value: c.uiScope === 'global' ? `global.${c.name}` : c.name,
                    label: c.uiScope === 'global' ? `${c.name} (global)` : c.name
                }));
            props.push({ group: 'Condition', name: 'RightOperandBaseVar', type: 'select', label: 'Rechts Objekt', options: comps.length ? comps : ['(Keine Elemente)'] });

            let availableProps: string[] = ['(Auswählen)'];
            const baseVarStr = this.RightOperandBaseVar || '';
            const cleanTarget = baseVarStr.replace(/^global\./, '');
            const targetObj = projectRegistry.getObjects('all').find(c => c.name === cleanTarget);
            if (targetObj) {
                const inspProps = componentRegistry.getInspectorProperties(targetObj) || [];
                availableProps = inspProps.map((p: any) => p.name).filter((n: string) => n);
            }
            props.push({ group: 'Condition', name: 'RightOperandSubProp', type: 'select', label: 'Rechts Eigenschaft', options: availableProps.length ? availableProps : ['(Keine)'] });
        } else {
            props.push({ group: 'Condition', name: 'RightOperandValue', type: 'string', label: 'Rechts Wert' });
        }

        return props;
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
        logger.info(`[FlowCondition] get LeftOperandValue: "${v}"`);
        return v;
    }
    public set LeftOperandValue(v: string) {
        logger.info(`[FlowCondition] set LeftOperandValue: "${v}"`);
        if (!this.data.condition) this.data.condition = {};
        this.data.condition.leftValue = v;
        this.updateText();
    }

    // --- Helper for Sub-Properties (Property-Typ) ---
    // Gespeichertes Format: "Button_36.visible" oder "global.Button_36.visible"
    // BaseVar = "Button_36" oder "global.Button_36"
    // SubProp = "visible"

    public get LeftOperandBaseVar(): string {
        const full = this.LeftOperandValue;
        // Erster Punkt trennt BaseVar von SubProp
        const parts = full.split('.');
        if (parts[0] === 'global' && parts.length >= 2) {
            // global.Button_36.visible → BaseVar = global.Button_36
            return parts.slice(0, 2).join('.');
        }
        // Button_36.visible → BaseVar = Button_36
        return parts[0];
    }
    public set LeftOperandBaseVar(v: string) {
        this.LeftOperandValue = v; // Resets sub-prop when base changes
    }

    public get LeftOperandSubProp(): string {
        const full = this.LeftOperandValue;
        const parts = full.split('.');
        if (parts[0] === 'global' && parts.length >= 3) {
            // global.Button_36.visible → SubProp = visible
            return parts.slice(2).join('.');
        }
        if (parts.length >= 2) {
            // Button_36.visible → SubProp = visible
            return parts.slice(1).join('.');
        }
        return '';
    }
    public set LeftOperandSubProp(v: string) {
        if (!v) {
            this.LeftOperandValue = this.LeftOperandBaseVar;
            return;
        }
        this.LeftOperandValue = `${this.LeftOperandBaseVar}.${v}`;
    }

    public get RightOperandType(): string { return this.data.condition?.rightType || 'literal'; }
    public set RightOperandType(v: string) {
        if (!this.data.condition) this.data.condition = {};
        this.data.condition.rightType = v;
        this.updateText();
    }

    public get RightOperandValue(): string {
        const v = this.data.condition?.rightValue || this.data.condition?.value || '';
        // logger.info(`[FlowCondition] get RightOperandValue: "${v}"`);
        return v;
    }
    public set RightOperandValue(v: string) {
        if (!this.data.condition) this.data.condition = {};
        this.data.condition.rightValue = v;
        this.updateText();
    }

    public get RightOperandBaseVar(): string {
        const full = this.RightOperandValue;
        const parts = full.split('.');
        if (parts[0] === 'global' && parts.length >= 2) {
            return parts.slice(0, 2).join('.');
        }
        return parts[0];
    }
    public set RightOperandBaseVar(v: string) {
        this.RightOperandValue = v;
    }

    public get RightOperandSubProp(): string {
        const full = this.RightOperandValue;
        const parts = full.split('.');
        if (parts[0] === 'global' && parts.length >= 3) {
            return parts.slice(2).join('.');
        }
        if (parts.length >= 2) {
            return parts.slice(1).join('.');
        }
        return '';
    }
    public set RightOperandSubProp(v: string) {
        if (!v) {
            this.RightOperandValue = this.RightOperandBaseVar;
            return;
        }
        this.RightOperandValue = `${this.RightOperandBaseVar}.${v}`;
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

    protected refreshVisuals() {
        this.updateText();
    }

    // =====================================================================
    // IInspectable Implementation – Dynamischer Inspector Re-Render
    // =====================================================================

    /**
     * Packt die dynamischen Properties (inkl. Typ-abhängiger Dropdowns)
     * in eine Inspector-Sektion.
     */
    public getInspectorSections(): InspectorSection[] {
        return [
            {
                id: 'condition',
                label: 'Allgemein',
                icon: '❓',
                properties: this.getInspectorProperties()
            }
        ];
    }

    /**
     * Wendet eine Property-Änderung an.
     * Gibt true zurück wenn LeftOperandType oder RightOperandType geändert wurde,
     * damit der Inspector sich komplett neu rendert und die dynamischen
     * Felder (Variable-Dropdown / Property-Objekt+Eigenschaft / Literal-Textfeld)
     * korrekt angezeigt werden.
     */
    public applyChange(propertyName: string, newValue: any, _oldValue?: any): boolean {
        // WICHTIG: Direkt über die TypeScript-Setter zuweisen!
        // PropertyHelper.setPropertyValue() schreibt bei FlowNodes in this.data[prop]
        // statt den Setter aufzurufen. Die Setter leiten aber korrekt nach
        // this.data.condition.leftValue/rightValue um.
        const knownSetters = [
            'LeftOperandType', 'LeftOperandValue', 'LeftOperandBaseVar', 'LeftOperandSubProp',
            'RightOperandType', 'RightOperandValue', 'RightOperandBaseVar', 'RightOperandSubProp',
            'Operator', 'Name'
        ];
        if (knownSetters.includes(propertyName)) {
            (this as any)[propertyName] = newValue;
        } else {
            PropertyHelper.setPropertyValue(this, propertyName, newValue);
        }

        // Bei Typ-Wechsel oder Objekt-Wechsel: vollständiger Re-Render nötig
        const reRenderTriggers = [
            'LeftOperandType', 'RightOperandType',
            'LeftOperandBaseVar', 'RightOperandBaseVar'
        ];
        return reRenderTriggers.includes(propertyName);
    }
}
