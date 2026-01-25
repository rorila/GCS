import { FlowVariable } from './FlowVariable';

export class FlowTriggerVariable extends FlowVariable {
    protected applyVariableStyling() {
        super.applyVariableStyling();
        this.content.style.color = '#ff4444'; // Trigger color (red)
    }

    protected getIcon(): string {
        return '🎯';
    }

    public getInspectorProperties(): any[] {
        return [];
    }

    public getEvents(): string[] {
        return [
            ...super.getEvents(),
            'onTriggerEnter',
            'onTriggerExit'
        ];
    }

    public updateVisuals() {
        const name = this.VarName;
        const triggerValue = this.TriggerValue;
        const icon = this.getIcon();
        this.setText(`${icon} ${name} (== ${triggerValue})`, true);
    }

    // Accessors
    public get TriggerValue(): any { return this.data.variable?.triggerValue || ''; }
    public set TriggerValue(v: any) {
        if (!this.data.variable) this.data.variable = {};
        this.data.variable.triggerValue = v;
        this.updateVisuals();
    }
}
