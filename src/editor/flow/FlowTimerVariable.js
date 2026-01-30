import { FlowVariable } from './FlowVariable';
export class FlowTimerVariable extends FlowVariable {
    applyVariableStyling() {
        super.applyVariableStyling();
        this.content.style.color = '#ffaa00'; // Timer color (orange)
    }
    getIcon() {
        return '⏳';
    }
    getInspectorProperties() {
        return [];
    }
    getEvents() {
        return [
            ...super.getEvents(),
            'onFinished',
            'onTick'
        ];
    }
    updateVisuals() {
        const name = this.VarName;
        const duration = this.Duration;
        const icon = this.getIcon();
        this.setText(`${icon} ${name} (${duration} ms)`, true);
    }
    // Accessors
    get Duration() { return this.data.variable?.duration || 0; }
    set Duration(v) {
        if (!this.data.variable)
            this.data.variable = {};
        this.data.variable.duration = v;
        this.updateVisuals();
    }
    get CurrentTime() { return this.data.variable?.currentTime || 0; }
}
