import { FlowVariable } from './FlowVariable';

export class FlowTimerVariable extends FlowVariable {
    protected applyVariableStyling() {
        super.applyVariableStyling();
        this.content.style.color = '#ffaa00'; // Timer color (orange)
    }

    protected getIcon(): string {
        return '⏳';
    }

    public getInspectorProperties(): any[] {
        return [];
    }

    public getEvents(): string[] {
        return [
            ...super.getEvents(),
            'onFinished',
            'onTick'
        ];
    }

    public updateVisuals() {
        const name = this.VarName;
        const duration = this.Duration;
        const icon = this.getIcon();
        this.setText(`${icon} ${name} (${duration} ms)`, true);
    }

    // Accessors
    public get Duration(): number { return this.data.variable?.duration || 0; }
    public set Duration(v: number) {
        if (!this.data.variable) this.data.variable = {};
        this.data.variable.duration = v;
        this.updateVisuals();
    }

    public get CurrentTime(): number { return this.data.variable?.currentTime || 0; }
}
