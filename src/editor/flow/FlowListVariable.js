import { FlowVariable } from './FlowVariable';
export class FlowListVariable extends FlowVariable {
    applyVariableStyling() {
        super.applyVariableStyling();
        this.content.style.color = '#ffffff'; // List color (white)
    }
    getIcon() {
        return '📋';
    }
    getInspectorProperties() {
        return [];
    }
    getEvents() {
        return [
            ...super.getEvents(),
            'onItemAdded',
            'onItemRemoved',
            'onContains',
            'onNotContains',
            'onCleared'
        ];
    }
    updateVisuals() {
        const name = this.VarName;
        const search = this.SearchValue;
        const icon = this.getIcon();
        const suffix = search ? ` (Search: ${search})` : ' (List)';
        this.setText(`${icon} ${name}${suffix}`, true);
    }
    // Accessors
    get SearchValue() { return this.data.variable?.searchValue || ''; }
    set SearchValue(v) {
        if (!this.data.variable)
            this.data.variable = {};
        this.data.variable.searchValue = v;
        this.updateVisuals();
    }
}
