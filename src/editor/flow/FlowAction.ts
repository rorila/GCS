
import { FlowElement } from './FlowElement';
import { GameAction, GameProject } from '../../model/types';
import { ExpressionParser } from '../../runtime/ExpressionParser';

export class FlowAction extends FlowElement {
    public getType(): string { return 'Action'; }

    // originalText removed, using this.Name instead

    constructor(id: string, x: number, y: number, container: HTMLElement, gridSize: number) {
        super(id, x, y, container, gridSize);
        this.applyActionStyling();
    }

    private applyActionStyling() {
        // Clear and apply modern glass classes
        this.element.classList.add('flow-element', 'flow-node-glass', 'glass-node-action');

        // Dimensions: 8 columns wide, 3 rows high (Standard)
        this.width = this.gridSize * 8;
        this.height = this.gridSize * 3;
        this.updatePosition();

        // Reset legacy styles that would override the class
        this.element.style.backgroundColor = '';
        this.element.style.border = '';
        this.element.style.boxShadow = '';
        this.element.style.color = '';

        // Ensure content is properly centered
        this.content.style.padding = '0';
        this.content.style.width = '100%';
        this.content.style.height = '100%';
        this.content.style.display = 'flex';
        this.content.style.alignItems = 'center';
        this.content.style.justifyContent = 'center';

    }

    public setText(text: string) {
        super.setText(text);
        this.Name = text;
    }

    // Reference to project for action lookups
    private projectRef: GameProject | null = null;

    public setProjectRef(project: GameProject | null) {
        this.projectRef = project;
    }

    /**
     * Helper to get the underlying action definition
     */
    private getActionDefinition(): any | null {
        // 1. Linked Mode: Get from project/stage (Single Source of Truth)
        if (this.data?.isLinked && this.projectRef && this.Name) {
            // Priority: Global Actions
            let action = this.projectRef.actions.find(a => a.name === this.Name);
            if (action) return action;

            // Secondary: Stage Actions
            const proj = this.projectRef as any;
            if (proj.activeStageId && proj.stages) {
                const stage = proj.stages.find((s: any) => s.id === proj.activeStageId);
                if (stage?.actions) {
                    action = stage.actions.find((a: any) => a.name === this.Name);
                    if (action) return action;
                }
            }
        }

        // 2. Embedded/Local Mode: Use local data copy
        // This handles both marked 'isEmbeddedInternal' and generic local actions.
        return this.data;
    }

    // --- Inspector Property Accessors ---

    public get actionType(): string {
        const action = this.getActionDefinition();
        return action?.type || 'property';
    }
    public set actionType(v: string) {
        const action = this.getActionDefinition();
        if (action) {
            action.type = v;
            this.setShowDetails(this.showDetails, this.projectRef);
        }
    }

    public get target(): string {
        const action = this.getActionDefinition();
        return action?.target || '';
    }
    public set target(v: string) {
        const action = this.getActionDefinition();
        if (action) action.target = v;
    }

    // JSON Helper for 'changes' object
    public get changesJSON(): string {
        const action = this.getActionDefinition();
        // Support both field names for compatibility
        const changes = action?.changes || action?.propertyChanges || {};
        return JSON.stringify(changes, null, 2);
    }
    public set changesJSON(v: string) {
        const action = this.getActionDefinition();
        if (action) {
            try {
                // Determine which field to use (prefer 'changes')
                if (action.propertyChanges && !action.changes) {
                    action.propertyChanges = JSON.parse(v);
                } else {
                    action.changes = JSON.parse(v);
                }
            } catch (e) {
                console.warn('Invalid JSON for changes:', e);
            }
        }
    }

    public get variableName(): string {
        const action = this.getActionDefinition();
        return action?.variableName || ''; // Legacy?
        // Wait, standard types use 'variable' for variable name? 
        // Let's check type definition logic. Usually it's 'variable' or 'variableName'.
        // inspector_action.json uses 'variableName' as property name, but binds to what?
        // We act as proxy. Let's support both or check types.ts.
    }
    public set variableName(v: string) {
        const action = this.getActionDefinition();
        if (action) action.variableName = v;
        // Note: New standard might use 'variable'? types.ts says 'variableName' for VariableAction?
        // Let's assume variableName based on existing code.
    }

    // Support 'variable' alias if types.ts uses that
    public get variable(): string { return this.variableName; }
    public set variable(v: string) { this.variableName = v; }

    public get operation(): string {
        const action = this.getActionDefinition();
        return action?.operation || 'set';
    }
    public set operation(v: string) {
        const action = this.getActionDefinition();
        if (action) action.operation = v;
    }

    public get value(): string {
        const action = this.getActionDefinition();
        return action?.value ?? '';
    }
    public set value(v: string) {
        const action = this.getActionDefinition();
        if (action) action.value = v;
    }

    public get service(): string {
        const action = this.getActionDefinition();
        return action?.service || '';
    }
    public set service(v: string) {
        const action = this.getActionDefinition();
        if (action) action.service = v;
    }

    public get method(): string {
        const action = this.getActionDefinition();
        // Support method (standard) or methodName (legacy)
        return action?.method || action?.methodName || '';
    }
    public set method(v: string) {
        const action = this.getActionDefinition();
        if (action) action.method = v;
    }

    public get paramsJSON(): string {
        const action = this.getActionDefinition();
        const params = action?.params || [];
        return JSON.stringify(params, null, 2);
    }
    public set paramsJSON(v: string) {
        const action = this.getActionDefinition();
        if (action) {
            try {
                action.params = JSON.parse(v);
            } catch (e) {
                console.warn('Invalid JSON for params:', e);
            }
        }
    }

    public get resultVariable(): string {
        const action = this.getActionDefinition();
        return action?.resultVariable || '';
    }
    public set resultVariable(v: string) {
        const action = this.getActionDefinition();
        if (action) action.resultVariable = v;
    }

    public get calcStepsJSON(): string {
        const action = this.getActionDefinition();
        return JSON.stringify(action?.calcSteps || [], null, 2);
    }
    public set calcStepsJSON(v: string) {
        const action = this.getActionDefinition();
        if (action) {
            try {
                action.calcSteps = JSON.parse(v);
            } catch (e) {
                console.warn('Invalid JSON for calcSteps:', e);
            }
        }
    }

    // Remove getInspectorProperties so JSON takes precedence
    // We only return geometry if we call super, but JSON inspector merges.
    // Actually, if we remove it, the JSON inspector logic 'typeof object.getInspectorProperties === "function"' might fail 
    // if I check strictly.
    // BUT I updated JSONInspector to check getType() === 'Action' first.
    // So I can keep super.getInspectorProperties() if I want geometry? 
    // My JSONInspector update merges static + dynamic. 
    // So if I return [] here, I get JSON only. 
    // If I return super(), I get geometry + JSON. This is good!
    public getInspectorProperties(): any[] {
        return super.getInspectorProperties();
    }

    /**
     * Zeigt Action-Details an oder versteckt sie
     */
    public setShowDetails(show: boolean, project: GameProject | null): void {
        super.setShowDetails(show, project);
        if (project) this.setProjectRef(project);

        const title = this.Name;
        const action = this.getActionDefinition(); // Use helper

        if (!show) {
            // Konzept-Ansicht: nur Name zeigen
            this.content.innerHTML = `<span style="white-space:nowrap">${title}</span>`;
            this.element.style.borderRadius = ''; // Let CSS class handle it
            this.autoSize();
        } else {
            // Details-Ansicht: Name + Details zeigen
            // For ghost nodes (expanded library tasks), 'action' might be undefined because it's not in the project.
            // In that case, we use the local 'this.data' which contains the action logic for the ghost node.

            // Wait, getActionDefinition handles this logic now!
            const displayAction = action;
            this.Details = this.getActionDetails(displayAction);

            this.content.innerHTML = `
                <div style="text-align:center;padding:8px 4px" translate="no">
                    <div style="font-weight:bold;font-size:12px;white-space:nowrap">${title}</div>
                    <div style="font-family:'Courier New', monospace;font-size:10px;color:#00ffff;margin-top:4px;font-weight:normal;line-height:1.2">
                        ${this.Details.split(';').map(d => `<div style="white-space:nowrap">${this.formatValue(d.trim())}</div>`).join('')}
                    </div>
                </div>
            `;

            this.element.style.borderRadius = '15px';
            this.autoSize();
        }

        // Apply visual updates
        this.updatePosition();
    }


    /**
     * Generiert eine Pascal-ähnliche Darstellung der Action-Details
     */
    private getActionDetails(action: GameAction | undefined): string {
        if (!action) return '(nicht definiert)';

        // If this node has parent parameters (e.g. it is part of an expanded library task),
        // we interpolate the action logic visually to show concrete values.
        let displayAction = action;
        if (this.data?.parentParams) {
            try {
                // Create a clone for display interpolation to avoid mutating the original
                const clonedAction = JSON.parse(JSON.stringify(action));

                // Interpolate target
                if (clonedAction.target) {
                    clonedAction.target = ExpressionParser.interpolate(clonedAction.target, this.data.parentParams);
                }

                // Interpolate changes
                const changes = clonedAction.changes || (clonedAction as any).propertyChanges;
                if (changes) {
                    Object.keys(changes).forEach(prop => {
                        changes[prop] = ExpressionParser.interpolate(changes[prop], this.data.parentParams);
                    });
                }

                displayAction = clonedAction;
            } catch (e) {
                console.warn('[FlowAction] Failed to interpolate ghost node details:', e);
            }
        }

        if (!displayAction) {
            return '(Keine Action-Definition gefunden)';
        }

        console.log('[FlowAction] getActionDetails - action:', JSON.stringify(displayAction, null, 2));

        if (displayAction.type === 'property') {
            // Try multiple possible locations for changes
            const changes = displayAction.changes || (displayAction as any).propertyChanges || {};
            const entries = Object.entries(changes);
            console.log('[FlowAction] property changes:', changes, 'entries:', entries);

            if (entries.length === 0) {
                // Show target if available, otherwise show what we have
                if (displayAction.target) {
                    return `${displayAction.target} (keine Änderungen)`;
                }
                return '(property - keine Details)';
            }

            return entries
                .slice(0, 2) // Maximal 2 Änderungen anzeigen
                .map(([prop, value]) => `${displayAction.target}.${prop} := ${value}`)
                .join('; ') + (entries.length > 2 ? ` (+${entries.length - 2})` : '');
        }

        if (displayAction.type === 'variable') {
            return `${displayAction.variableName} := ${displayAction.source}.${displayAction.sourceProperty}`;
        }

        if (displayAction.type === 'service') {
            const result = displayAction.resultVariable ? `${displayAction.resultVariable} := ` : '';
            return `${result}${displayAction.service}.${displayAction.method}()`;
        }

        if (displayAction.type === 'calculate') {
            const result = displayAction.resultVariable ? `${displayAction.resultVariable} := ` : '';
            return `${result}(Berechnung)`;
        }

        if (displayAction.type === 'call_method') {
            // Cast to access properties that might be missing in strict type (until generic params are fully typed)
            const da = displayAction as any;
            const params = da.params ? (Array.isArray(da.params) ? da.params.join(', ') : da.params) : '';
            return `${da.target}.${da.method}(${params})`;
        }

        return `(${displayAction.type})`;
    }

    private formatValue(value: any): string {
        if (typeof value === 'string') {
            // Kürzen wenn zu lang
            if (value.length > 15) {
                return value.substring(0, 12) + '...';
            }
            return value;
        }
        return String(value);
    }



    /**
     * SINGLE SOURCE OF TRUTH: Override toJSON to only save minimal data for linked actions.
     * Linked actions store only the name and isLinked flag - the actual definition
     * is loaded from project.actions at runtime.
     */
    public toJSON(): any {
        const base = {
            id: this.id,
            type: this.getType(),
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            properties: {
                name: this.Name,
                details: this.Details,
                description: this.Description
            }
        };

        // SINGLE SOURCE OF TRUTH: If this action is linked to project.actions,
        // only store the reference, not the full data copy
        if (this.data?.isLinked) {
            return {
                ...base,
                data: {
                    name: this.data.name || this.Name,
                    isLinked: true
                }
            };
        }

        // Non-linked actions (copies or local definitions) store full data
        return {
            ...base,
            data: this.data
        };
    }
}
