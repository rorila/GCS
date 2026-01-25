import { FlowVariable } from './FlowVariable';

export class FlowRangeVariable extends FlowVariable {
    protected applyVariableStyling() {
        super.applyVariableStyling();
        this.content.style.color = '#aaff00'; // Range color (lime)
    }

    protected getIcon(): string {
        return '📏';
    }

    public updateVisuals() {
        const name = this.VarName;
        const min = this.Min;
        const max = this.Max;
        const isInt = this.IsInteger;
        const icon = this.getIcon();
        const intSuffix = isInt ? ' (Int)' : '';
        this.setText(`${icon} ${name} (${min}..${max})${intSuffix}`, true);
    }

    public getInspectorProperties(): any[] {
        return [];
    }

    public getEvents(): string[] {
        return [
            ...super.getEvents(),
            'onMinReached',
            'onMaxReached',
            'onInside',
            'onOutside'
        ];
    }

    // Accessors
    public get Min(): number { return this.data.variable?.min || 0; }
    public set Min(v: number) {
        if (!this.data.variable) this.data.variable = {};
        this.data.variable.min = v;
        this.updateVisuals();
    }

    public get Max(): number { return this.data.variable?.max || 100; }
    public set Max(v: number) {
        if (!this.data.variable) this.data.variable = {};
        this.data.variable.max = v;
        this.updateVisuals();
    }

    public get IsInteger(): any { return this.data.variable?.isInteger || false; }
    public set IsInteger(v: any) {
        if (!this.data.variable) this.data.variable = {};
        this.data.variable.isInteger = v;
        this.updateVisuals();
    }
}
