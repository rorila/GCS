import { FlowListVariable } from './FlowListVariable';

export class FlowObjectListVariable extends FlowListVariable {
    protected applyVariableStyling() {
        super.applyVariableStyling();
        this.content.style.color = '#00ffff'; // Object List color (cyan)
    }

    protected getIcon(): string {
        return '🗃️';
    }

    public updateVisuals() {
        const name = this.VarName;
        const search = this.SearchValue;
        const prop = this.SearchProperty;
        const icon = this.getIcon();

        let suffix = ' (Obj-List)';
        if (search && prop) {
            suffix = ` (Find: ${prop}=${search})`;
        } else if (search) {
            suffix = ` (Search: ${search})`;
        }

        this.setText(`${icon} ${name}${suffix}`, true);
    }

    // Accessors
    public get SearchProperty(): string { return this.data.variable?.searchProperty || ''; }
    public set SearchProperty(v: string) {
        if (!this.data.variable) this.data.variable = {};
        this.data.variable.searchProperty = v;
        this.updateVisuals();
    }
}
