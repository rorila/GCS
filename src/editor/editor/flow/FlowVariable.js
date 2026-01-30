import { FlowElement } from './FlowElement';
export class FlowVariable extends FlowElement {
    getType() { return 'VariableDecl'; }
    constructor(id, x, y, container, gridSize) {
        super(id, x, y, container, gridSize);
        this.applyVariableStyling();
    }
    applyVariableStyling() {
        this.element.classList.add('flow-element', 'flow-node-glass', 'glass-node-variable');
        // Slightly smaller default size for variables
        this.width = this.gridSize * 6;
        this.height = this.gridSize * 2;
        this.updatePosition();
        this.content.style.padding = '0 10px';
        this.content.style.fontSize = '12px';
        this.content.style.fontWeight = 'bold';
        this.content.style.color = '#ffaa00'; // Variable color
    }
    setText(text, autoSize = true) {
        super.setText(text, autoSize);
    }
    getInspectorProperties() {
        return [];
    }
    /**
     * Replaces the old getEvents logic to support the visual Properties/Events split.
     */
    getEvents() {
        return ['onChanged', 'onEmpty'];
    }
    // Property Accessors
    get VarName() { return this.data.variable?.name || this.Name; }
    set VarName(v) {
        if (!this.data.variable)
            this.data.variable = {};
        this.data.variable.name = v;
        this.Name = v;
        this.updateVisuals();
    }
    get VarType() { return this.data.variable?.type || 'string'; }
    set VarType(v) {
        if (!this.data.variable)
            this.data.variable = {};
        this.data.variable.type = v;
        this.updateVisuals();
    }
    get Value() { return this.data.variable?.value ?? this.InitialValue; }
    set Value(v) {
        if (!this.data.variable)
            this.data.variable = {};
        this.data.variable.value = v;
    }
    get InitialValue() { return this.data.variable?.initialValue || ''; }
    set InitialValue(v) {
        if (!this.data.variable)
            this.data.variable = {};
        this.data.variable.initialValue = v;
    }
    get Scope() { return this.data.variable?.scope || 'global'; }
    set Scope(v) {
        if (!this.data.variable)
            this.data.variable = {};
        this.data.variable.scope = v;
    }
    get IsPublic() { return this.data.variable?.isPublic || false; }
    set IsPublic(v) {
        if (!this.data.variable)
            this.data.variable = {};
        this.data.variable.isPublic = v;
    }
    // Event Proxy for inspector_events.json
    get Tasks() {
        return this.data.variable || {};
    }
    /**
     * Updates the visual representation of the node based on current data.
     */
    updateVisuals() {
        const name = this.VarName;
        const type = this.VarType;
        const icon = this.getIcon();
        this.setText(`${icon} ${name}: ${type}`, true);
    }
    getIcon() {
        return '📦';
    }
}
