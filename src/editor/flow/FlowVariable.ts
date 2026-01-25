import { FlowElement } from './FlowElement';

export class FlowVariable extends FlowElement {
    public getType(): string { return 'VariableDecl'; }

    constructor(id: string, x: number, y: number, container: HTMLElement, gridSize: number) {
        super(id, x, y, container, gridSize);
        this.applyVariableStyling();
    }

    protected applyVariableStyling() {
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

    public setText(text: string, autoSize: boolean = true) {
        super.setText(text, autoSize);
    }

    public getInspectorProperties(): any[] {
        return [];
    }

    /**
     * Replaces the old getEvents logic to support the visual Properties/Events split.
     */
    public getEvents(): string[] {
        return ['onChanged', 'onEmpty'];
    }

    // Property Accessors
    public get VarName(): string { return this.data.variable?.name || this.Name; }
    public set VarName(v: string) {
        if (!this.data.variable) this.data.variable = {};
        this.data.variable.name = v;
        this.Name = v;
        this.updateVisuals();
    }

    public get VarType(): string { return this.data.variable?.type || 'string'; }
    public set VarType(v: string) {
        if (!this.data.variable) this.data.variable = {};
        this.data.variable.type = v;
        this.updateVisuals();
    }

    public get Value(): any { return this.data.variable?.value ?? this.InitialValue; }
    public set Value(v: any) {
        if (!this.data.variable) this.data.variable = {};
        this.data.variable.value = v;
    }

    public get InitialValue(): string { return this.data.variable?.initialValue || ''; }
    public set InitialValue(v: string) {
        if (!this.data.variable) this.data.variable = {};
        this.data.variable.initialValue = v;
    }

    public get Scope(): string { return this.data.variable?.scope || 'global'; }
    public set Scope(v: string) {
        if (!this.data.variable) this.data.variable = {};
        this.data.variable.scope = v;
    }

    public get IsPublic(): boolean { return this.data.variable?.isPublic || false; }
    public set IsPublic(v: boolean) {
        if (!this.data.variable) this.data.variable = {};
        this.data.variable.isPublic = v;
    }

    // Event Proxy for inspector_events.json
    public get Tasks(): any {
        return this.data.variable || {};
    }

    /**
     * Updates the visual representation of the node based on current data.
     */
    public updateVisuals() {
        const name = this.VarName;
        const type = this.VarType;
        const icon = this.getIcon();
        this.setText(`${icon} ${name}: ${type}`, true);
    }

    protected getIcon(): string {
        return '📦';
    }
}
