import { FlowVariable } from './FlowVariable';
export class FlowTriggerVariable extends FlowVariable {
    applyVariableStyling() {
        super.applyVariableStyling();
        this.content.style.color = '#ff4444'; // Trigger color (red)
    }
    getIcon() {
        return '🎯';
    }
    getInspectorProperties() {
        return [];
    }
    getEvents() {
        return [
            ...super.getEvents(),
            'onTriggerEnter',
            'onTriggerExit'
        ];
    }
    updateVisuals() {
        const name = this.VarName;
        const triggerValue = this.TriggerValue;
        const icon = this.getIcon();
        this.setText(`${icon} ${name} (== ${triggerValue})`, true);
    }
    // Accessors
    get TriggerValue() { return this.data.variable?.triggerValue || ''; }
    set TriggerValue(v) {
        if (!this.data.variable)
            this.data.variable = {};
        this.data.variable.triggerValue = v;
        this.updateVisuals();
    }
}
