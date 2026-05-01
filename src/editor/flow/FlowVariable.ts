import { FlowElement } from './FlowElement';
import { GameProject } from '../../model/types';

export class FlowVariable extends FlowElement {
    protected projectRef: GameProject | null = null;

    public getType(): string { return 'VariableDecl'; }

    constructor(id: string, x: number, y: number, container: HTMLElement, gridSize: number) {
        super(id, x, y, container, gridSize);
        this.applyVariableStyling();
    }

    public setProjectRef(project: GameProject | null) {
        this.projectRef = project;
        this.updateVisuals();
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

    public getEvents(): string[] {
        return ['onValueChanged'];
    }

    /**
     * Resolve the actual variable definition from the project (SSoT).
     * For scope='local': The FlowChart node IS the SSoT (not stage.variables).
     */
    protected getVariableDefinition(): any | null {
        // Local-scoped variables live only in the FlowChart node
        if (this.data.variable?.scope === 'local') {
            return this.data.variable;
        }

        if (!this.projectRef) return this.data.variable;

        const varName = this.data.variable?.name || this.Name;

        // 1. Search Global
        let v = this.projectRef.variables?.find((v: any) => v.name === varName);

        // 2. Search Stage
        if (!v && (this.projectRef as any).activeStageId) {
            const stage = (this.projectRef as any).stages?.find((s: any) => s.id === (this.projectRef as any).activeStageId);
            v = stage?.variables?.find((v: any) => v.name === varName);
        }

        if (v) {
            // Keep local data in sync for persistence in flowChart
            this.data.variable = v;
            return v;
        }

        return this.data.variable;
    }

    // --- Standard Properties for Inspector (SSoT) ---

    public get name(): string {
        const v = this.getVariableDefinition();
        return v?.name || this.Name;
    }
    public set name(val: string) {
        const v = this.getVariableDefinition();
        if (v) v.name = val;
        if (!this.data.variable) this.data.variable = {};
        this.data.variable.name = val;
        this.Name = val;
        this.updateVisuals();
    }

    public get type(): string {
        const v = this.getVariableDefinition();
        return v?.type || 'string';
    }
    public set type(val: string) {
        const v = this.getVariableDefinition();
        if (v) v.type = val;
        if (!this.data.variable) this.data.variable = {};
        this.data.variable.type = val;
        this.updateVisuals();
    }

    public get scope(): string {
        const v = this.getVariableDefinition();
        return v?.scope || v?.uiScope || 'global';
    }
    public set scope(val: string) {
        const v = this.getVariableDefinition();
        if (v) v.scope = val;
        if (!this.data.variable) this.data.variable = {};
        this.data.variable.scope = val;
        this.updateVisuals();
    }

    public get value(): any {
        const v = this.getVariableDefinition();
        return v?.value;
    }
    public set value(val: any) {
        const v = this.getVariableDefinition();
        if (v) v.value = val;
        if (!this.data.variable) this.data.variable = {};
        this.data.variable.value = val;
    }

    public get defaultValue(): any {
        const v = this.getVariableDefinition();
        return v?.defaultValue;
    }
    public set defaultValue(val: any) {
        const v = this.getVariableDefinition();
        if (v) v.defaultValue = val;
        if (!this.data.variable) this.data.variable = {};
        this.data.variable.defaultValue = val;
    }

    public get objectModel(): string {
        const v = this.getVariableDefinition();
        return v?.objectModel || '';
    }
    public set objectModel(val: string) {
        const v = this.getVariableDefinition();
        if (v) v.objectModel = val;
        if (!this.data.variable) this.data.variable = {};
        this.data.variable.objectModel = val;
    }

    // --- Legacy Aliases ---
    public get VarName(): string { return this.name; }
    public set VarName(v: string) { this.name = v; }
    public get VarType(): string { return this.type; }
    public set VarType(v: string) { this.type = v; }
    public get Value(): any { return this.value; }
    public set Value(v: any) { this.value = v; }
    public get Scope(): string { return this.scope; }
    public set Scope(v: string) { this.scope = v; }

    /**
     * Updates the visual representation of the node based on current data.
     */
    public updateVisuals() {
        const name = this.name;
        const type = this.type;
        const currentScope = this.scope;
        const icon = this.getIcon();
        const scopeLabel = currentScope === 'local' ? ' [lokal]' : '';
        this.setText(`${icon} ${name}: ${type}${scopeLabel}`, true);

        // Visual distinction for local variables
        if (currentScope === 'local') {
            this.content.style.color = '#66bb6a'; // Green for local
            this.element.classList.add('flow-variable-local');
        } else {
            this.content.style.color = '#ffaa00'; // Default variable color
            this.element.classList.remove('flow-variable-local');
        }
    }

    protected getIcon(): string {
        return this.scope === 'local' ? '🔒' : '📦';
    }

    public toJSON(): any {
        const json = super.toJSON();
        const currentScope = this.scope;

        if (currentScope === 'local') {
            // Local variables: The FlowChart node IS the SSoT.
            // Save the complete definition because it won't exist in stage.variables.
            json.data = {
                variable: {
                    name: this.name,
                    type: this.type,
                    scope: 'local',
                    value: this.value,
                    defaultValue: this.defaultValue,
                    isVariable: true
                }
            };
        } else {
            // Global/Stage variables: Only save reference, data lives in project/stage.variables.
            json.data = {
                variable: {
                    name: this.name,
                    isVariable: true
                }
            };
        }
        return json;
    }
}
