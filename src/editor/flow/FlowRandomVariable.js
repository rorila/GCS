import { FlowVariable } from './FlowVariable';
export class FlowRandomVariable extends FlowVariable {
    applyVariableStyling() {
        super.applyVariableStyling();
        this.content.style.color = '#ffaa00'; // Random color (orange)
    }
    getIcon() {
        return '🎲';
    }
    updateVisuals() {
        const name = this.VarName;
        const min = this.Min;
        const max = this.Max;
        const isInt = this.IsInteger;
        const icon = this.getIcon();
        const intSuffix = isInt ? ' (Int)' : '';
        this.setText(`${icon} ${name} (Rand ${min}..${max})${intSuffix}`, true);
    }
    getInspectorProperties() {
        return [];
    }
    getEvents() {
        return [
            ...super.getEvents(),
            'onGenerated'
        ];
    }
    // Accessors
    get Min() { return this.data.variable?.min || 0; }
    set Min(v) {
        if (!this.data.variable)
            this.data.variable = {};
        this.data.variable.min = v;
        this.updateVisuals();
    }
    get Max() { return this.data.variable?.max || 100; }
    set Max(v) {
        if (!this.data.variable)
            this.data.variable = {};
        this.data.variable.max = v;
        this.updateVisuals();
    }
    get IsInteger() { return this.data.variable?.isInteger || false; }
    set IsInteger(v) {
        if (!this.data.variable)
            this.data.variable = {};
        this.data.variable.isInteger = v;
        this.updateVisuals();
    }
}
