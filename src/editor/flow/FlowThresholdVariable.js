import { FlowVariable } from './FlowVariable';
export class FlowThresholdVariable extends FlowVariable {
    applyVariableStyling() {
        super.applyVariableStyling();
        this.content.style.color = '#00ccff'; // Threshold color (cyan)
    }
    getIcon() {
        return '📊';
    }
    getInspectorProperties() {
        return [];
    }
    getEvents() {
        return [
            ...super.getEvents(),
            'onThresholdReached',
            'onThresholdLeft',
            'onThresholdExceeded'
        ];
    }
    updateVisuals() {
        const name = this.VarName;
        const threshold = this.Threshold;
        const icon = this.getIcon();
        this.setText(`${icon} ${name} (>= ${threshold})`, true);
    }
    // Accessors
    get Threshold() { return this.data.variable?.threshold || 0; }
    set Threshold(v) {
        if (!this.data.variable)
            this.data.variable = {};
        this.data.variable.threshold = v;
        this.updateVisuals();
    }
}
