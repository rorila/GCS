import { FlowVariable } from './FlowVariable';

export class FlowListVariable extends FlowVariable {
    protected applyVariableStyling() {
        super.applyVariableStyling();
        this.content.style.color = '#ffffff'; // List color (white)
    }

    protected getIcon(): string {
        return '📋';
    }

    public getInspectorProperties(): any[] {
        return [];
    }

    public getEvents(): string[] {
        return [
            ...super.getEvents(),
            'onItemAdded',
            'onItemRemoved',
            'onContains',
            'onNotContains',
            'onCleared'
        ];
    }

    public updateVisuals() {
        const name = this.VarName;
        const search = this.SearchValue;
        const icon = this.getIcon();
        const suffix = search ? ` (Search: ${search})` : ' (List)';
        this.setText(`${icon} ${name}${suffix}`, true);
    }

    // Accessors
    public get SearchValue(): any { return this.data.variable?.searchValue || ''; }
    public set SearchValue(v: any) {
        if (!this.data.variable) this.data.variable = {};
        this.data.variable.searchValue = v;
        this.updateVisuals();
    }
}
