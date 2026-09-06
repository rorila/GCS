import { FlowVariable } from './FlowVariable';

export class FlowThresholdVariable extends FlowVariable {
    protected applyVariableStyling() {
        super.applyVariableStyling();
        this.content.style.color = '#00ccff'; // Threshold color (cyan)
    }

    protected getIcon(): string {
        return '📊';
    }

    public getInspectorProperties(): any[] {
        return [];
    }

    public getEvents(): string[] {
        return [
            ...super.getEvents(),
            'onThresholdReached',
            'onThresholdLeft',
            'onThresholdExceeded'
        ];
    }

    public updateVisuals() {
        const name = this.VarName;
        const threshold = this.Threshold;
        const icon = this.getIcon();
        this.setText(`${icon} ${name} (>= ${threshold})`, true);
    }

    // Accessors
    public get Threshold(): number { return this.data.variable?.threshold || 0; }
    public set Threshold(v: number) {
        if (!this.data.variable) this.data.variable = {};
        this.data.variable.threshold = v;
        this.updateVisuals();
    }
}
