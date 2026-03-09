
import { FlowElement } from './FlowElement';
import { GameAction, GameProject } from '../../model/types';
import { ExpressionParser } from '../../runtime/ExpressionParser';
import { projectRegistry } from '../../services/ProjectRegistry';

export class FlowAction extends FlowElement {
    public getType(): string {
        return 'action';
    }

    public getEvents(): string[] {
        return []; // Standardaktionen haben keine Standard-Events
    }

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

        // Helper to create visual ports (will be functionalized in FlowEditor)
        if (this.type === 'data_action') {
            this.createDataActionPorts();
        }
    }

    private createDataActionPorts() {
        // Remove existing custom ports if any
        this.element.querySelectorAll('.flow-anchor.custom-port').forEach(el => el.remove());

        // Success Port (Green, Bottom Rightish)
        const successPort = document.createElement('div');
        successPort.className = 'flow-anchor output custom-port success-port';
        successPort.title = 'On Success';
        successPort.dataset.branch = 'success';
        successPort.style.cssText = `
            right: 20px;
            bottom: -6px;
            background-color: #4caf50;
            border-color: #2e7d32;
        `;
        this.element.appendChild(successPort);

        // Error Port (Red, Bottom Leftish)
        const errorPort = document.createElement('div');
        errorPort.className = 'flow-anchor output custom-port error-port';
        errorPort.title = 'On Error';
        errorPort.dataset.branch = 'error';
        errorPort.style.cssText = `
            right: 60px;
            bottom: -6px;
            background-color: #f44336;
            border-color: #c62828;
        `;
        this.element.appendChild(errorPort);
    }


    public setText(text: string) {
        super.setText(text);
        this.Name = text;
    }

    // Reference to project for action lookups
    protected projectRef: GameProject | null = null;

    public setProjectRef(project: GameProject | null) {
        if (this.projectRef === project) return; // Guard against infinite recursion
        this.projectRef = project;
        // SINGLE SOURCE OF TRUTH: If project is set, we can recalculate details from the true definition
        // This fixes cases where truncated "details" were loaded from saved JSON.
        if (project && this.showDetails) {
            this.setShowDetails(true, project);
        }
    }

    public getAnchorPosition(type: 'input' | 'output' | 'true' | 'false' | 'success' | 'error' | 'top' | 'bottom'): { x: number, y: number } {
        if (type === 'success' && this.type === 'data_action') {
            // Success Port: right: 20px, bottom: -6px
            // Anchor is 10x10, so center is x = width - 20 - 5, y = height + 6 - 5? No, bottom -6 means it sticks out.
            // Let's use simpler relative positions that match the visual layout.
            return { x: this.x + this.width - 25, y: this.y + this.height };
        } else if (type === 'error' && this.type === 'data_action') {
            // Error Port: right: 60px, bottom: -6px
            return { x: this.x + this.width - 65, y: this.y + this.height };
        }
        return super.getAnchorPosition(type);
    }

    /**
     * Helper to get the underlying action definition.
     * Robust resolution: Always prefers project/stage definition if a name match exists,
     * to ensure Single Source of Truth consistency.
     */
    protected getActionDefinition(): any | null {
        if (!this.Name) {
            return this.data;
        }

        // 1. Resolve from project/stage via ProjectRegistry (Single Source of Truth)
        // We match by name even if 'isLinked' is not yet set (e.g. for newly renamed nodes)
        const action = projectRegistry.findOriginalAction(this.Name);

        if (action) {
            // FIX: Ensure the node data reflects the linked state so toJSON saves only the reference
            if (this.data && !this.data.isLinked) {
                this.data.isLinked = true;
                this.data.name = action.name;
                console.log(`[FLOW-TRACE] Action "${this.Name}" is now LINKED.`);
            }
            return action;
        }

        console.warn(`[FLOW-TRACE] Action Definition NOT FOUND for "${this.Name}". Falling back to local data copy.`);
        return this.data;
    }

    // --- Inspector Property Accessors ---

    public get type(): string {
        const action = this.getActionDefinition();
        return action?.type || 'property';
    }
    public set type(v: string) {
        const action = this.getActionDefinition();
        if (action) {
            action.type = v;
            // SYNC: Update local data type to avoid stale saves in toJSON
            if (this.data) {
                this.data.type = v;
                // Sync actionType alias in data if present
                if ((this.data as any).actionType) (this.data as any).actionType = v;
            }

            // Visual Update: Data Action Ports might need to be added/removed
            this.applyActionStyling();

            this.setShowDetails(this.showDetails, this.projectRef);
        }
    }

    // Alias for compatibility with templates and hydrator
    public get actionType(): string { return this.type; }
    public set actionType(v: string) { this.type = v; }

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

    public get source(): string {
        const action = this.getActionDefinition();
        return action?.source || '';
    }
    public set source(v: string) {
        const action = this.getActionDefinition();
        if (action) action.source = v;
    }

    public get sourceProperty(): string {
        const action = this.getActionDefinition();
        return action?.sourceProperty || '';
    }
    public set sourceProperty(v: string) {
        const action = this.getActionDefinition();
        if (action) action.sourceProperty = v;
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

    public get params(): any[] {
        const action = this.getActionDefinition();
        return action?.params || [];
    }
    public set params(v: any[]) {
        const action = this.getActionDefinition();
        if (action) action.params = v;
    }

    public get paramsJSON(): string {
        const params = this.params;
        return JSON.stringify(params, null, 2);
    }
    public set paramsJSON(v: string) {
        try {
            this.params = JSON.parse(v);
        } catch (e) {
            console.warn('Invalid JSON for params:', e);
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

    // --- HTTP / API Actions ---

    public get url(): string {
        const action = this.getActionDefinition();
        return action?.url || '';
    }
    public set url(v: string) {
        const action = this.getActionDefinition();
        if (action) {
            action.url = v;
            this.updateNodeDetails();
        }
    }

    public get body(): string {
        const action = this.getActionDefinition();
        return action?.body || '';
    }
    public set body(v: string) {
        const action = this.getActionDefinition();
        if (action) action.body = v;
    }

    public get resultPath(): string {
        const action = this.getActionDefinition();
        return action?.resultPath || '';
    }
    public set resultPath(v: string) {
        const action = this.getActionDefinition();
        if (action) action.resultPath = v;
    }

    public get headersJSON(): string {
        const action = this.getActionDefinition();
        return JSON.stringify((action as any)?.headers || {}, null, 2);
    }
    public set headersJSON(v: string) {
        const action = this.getActionDefinition();
        if (action) {
            try {
                (action as any).headers = JSON.parse(v);
            } catch (e) {
                console.warn('Invalid JSON for headers:', e);
            }
        }
    }

    public get dataStore(): string {
        const action = this.getActionDefinition();
        return action?.dataStore || '';
    }
    public set dataStore(v: string) {
        const action = this.getActionDefinition();
        if (action) action.dataStore = v;
    }

    public get resource(): string {
        const action = this.getActionDefinition();
        return action?.resource || '';
    }
    public set resource(v: string) {
        const action = this.getActionDefinition();
        if (action) action.resource = v;
    }

    public get queryProperty(): string {
        const action = this.getActionDefinition();
        return action?.queryProperty || '';
    }
    public set queryProperty(v: string) {
        const action = this.getActionDefinition();
        if (action) action.queryProperty = v;
    }

    public get queryValue(): string {
        const action = this.getActionDefinition();
        return action?.queryValue || '';
    }
    public set queryValue(v: string) {
        const action = this.getActionDefinition();
        if (action) action.queryValue = v;
    }

    // --- JWT / Token Actions ---

    public get token(): string {
        const action = this.getActionDefinition();
        return (action as any)?.token || '';
    }
    public set token(v: string) {
        const action = this.getActionDefinition();
        if (action) (action as any).token = v;
    }

    public get tokenKey(): string {
        const action = this.getActionDefinition();
        return action?.tokenKey || '';
    }
    public set tokenKey(v: string) {
        const action = this.getActionDefinition();
        if (action) action.tokenKey = v;
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

    private updateNodeDetails() {
        if (this.showDetails) {
            this.setShowDetails(true, this.projectRef);
        }
    }

    // Remove getInspectorProperties so JSON takes precedence
    // We only return geometry if we call super, but JSON inspector merges.
    // Actually, if we remove it, the JSON inspector logic 'typeof object.getInspectorProperties === "function"' might fail 
    // if I check strictly.
    // InspectorHost handles type checks and merging.
    // So if I return [] here, I get JSON only. 
    // If I return super(), I get geometry + JSON. This is good!
    public getInspectorProperties(): any[] {
        const props: any[] = [];
        const type = this.data?.type || 'property';
        const isInternal = this.data?.isEmbeddedInternal;

        // Base Information Group
        props.push({ name: 'Name', label: 'Action Name', type: 'string', variable: 'Name', group: 'Allgemein', readonly: isInternal });

        if (!isInternal) {
            props.push({
                name: 'actionType',
                label: 'Aktions-Typ',
                type: 'select',
                variable: 'type', // Map to this.data.type
                group: 'Allgemein',
                options: [
                    { value: 'property', label: 'Objekt-Eigenschaft (Property)' },
                    { value: 'method', label: 'Objekt-Methode (Method)' },
                    { value: 'event', label: 'Event feuern' },
                    { value: 'variable', label: 'Variable auslesen' },
                    { value: 'calculate', label: 'Berechnung (Calculate)' }
                ]
            });
        }

        const detailsGroup = 'Konfiguration';

        // Target Object Selection (used by most action types)
        if (['property', 'method'].includes(type) && !isInternal) {
            props.push({
                name: 'target',
                label: 'Ziel-Objekt',
                type: 'select',
                variable: 'target',
                group: detailsGroup,
                source: 'objects', // Needs InspectorRenderer to resolve 'objects' source
                hint: 'Das Objekt, dessen Zustand geändert wird.'
            });
        }

        // Show properties based on type
        if (type === 'property') {
            // Property Change specifics
            props.push({ name: 'property', label: 'Eigenschaft', type: 'string', variable: 'property', group: detailsGroup });
            props.push({ name: 'changes', label: 'Neuer Wert (changes)', type: 'string', variable: 'changes', group: detailsGroup });
            // Button to inject variables into 'changes'
            props.push({
                name: 'btn_var_changes',
                label: 'Variable einfügen...',
                type: 'button',
                variable: 'btn_var_changes',
                group: detailsGroup,
                buttonType: 'secondary',
                actionData: { property: 'changes' },
                action: 'pickVariable'
            });
        } else if (type === 'method') {
            // Method Call specifics
            props.push({ name: 'method', label: 'Methode', type: 'string', variable: 'method', group: detailsGroup });
            props.push({ name: 'params', label: 'Parameter-Liste (params)', type: 'string', variable: 'params', group: detailsGroup, hint: 'Kommagetrennt' });
        } else if (type === 'event') {
            // Event Fire specifics
            props.push({ name: 'eventName', label: 'Event-Name', type: 'string', variable: 'eventName', group: detailsGroup });
            props.push({ name: 'eventPayload', label: 'Payload (JSON/Token)', type: 'string', variable: 'eventPayload', group: detailsGroup });
        } else {
            // Fallback for registry-based actions (e.g., http, service)
            try {
                const registry = (window as any).actionRegistry || (window as any).ActionRegistry;
                const meta = registry?.getMetadata?.(type);

                if (meta && meta.parameters) {
                    meta.parameters.forEach((param: any) => {
                        const field: any = {
                            name: param.name,
                            label: param.label,
                            variable: param.name,
                            type: this.mapParameterTypeToInspector(param.type),
                            hint: param.hint,
                            group: `Erweitert: ${meta.label}`
                        };

                        if (param.options) field.options = param.options.map((o: string) => ({ value: o, label: o }));
                        else if (param.source) field.source = param.source;

                        props.push(field);
                    });
                }
            } catch (e) {
                console.error('[FlowAction] Registry lookup failed:', e);
            }
        }

        return props;
    }

    private mapParameterTypeToInspector(paramType: string): string {
        switch (paramType) {
            case 'string': return 'text';
            case 'number': return 'number';
            case 'boolean': return 'checkbox';
            case 'json': return 'textarea';
            case 'select': return 'select';
            case 'variable': return 'TVariableSelect';
            case 'object': return 'TObjectSelect'; // Assumed inspector type
            case 'stage': return 'select'; // Needs stage source
            default: return 'text';
        }
    }

    /**
     * Zeigt Action-Details an oder versteckt sie
     */
    public setShowDetails(show: boolean, project: GameProject | null): void {
        super.setShowDetails(show, project);
        // Do NOT call setProjectRef here if project is already set, 
        // to avoid infinite recursion (setShowDetails -> setProjectRef -> setShowDetails)
        if (project && this.projectRef !== project) {
            this.setProjectRef(project);
        }

        const taskPrefix = (this.data && (this.data.taskName || this.data.sourceTaskName)) ? `${this.data.taskName || this.data.sourceTaskName} ---- ` : '';
        const currentName = this.Name;
        const title = taskPrefix + currentName;
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

            const allDetails = this.Details.split(';').map(d => d.trim()).filter(d => d);
            const visibleDetails = allDetails.slice(0, 2);
            const hiddenCount = allDetails.length - 2;

            this.content.innerHTML = `
                <div style="text-align:center;padding:8px 4px" translate="no">
                    <div style="font-weight:bold;font-size:12px;white-space:nowrap">${title}</div>
                    <div style="font-family:'Courier New', monospace;font-size:10px;color:#00ffff;margin-top:4px;font-weight:normal;line-height:1.2">
                    ${visibleDetails.map(d => `<div title="${d}" style="white-space:nowrap; cursor:help">${this.formatValue(d)}</div>`).join('')}
                    ${hiddenCount > 0 ? `<div style="font-size:9px;color:#888;font-style:italic;margin-top:2px">(+${hiddenCount})</div>` : ''}
                </div>
            </div>
        `;

            this.element.style.borderRadius = '15px';

            // Standard autoSize often fails with glass-node styles in some contexts, so we enforce minimum width based on text length
            this.autoSize();

            // Manual override: Check if width is enough for the content
            const maxLineLength = Math.max(title.length, ...this.Details.split(';').map(d => this.formatValue(d.trim()).length));
            // Approx 7px per char + 40px padding
            const requiredWidth = (maxLineLength * 7) + 40;
            if (this.width < requiredWidth) {
                this.width = Math.ceil(requiredWidth / this.gridSize) * this.gridSize;
                this.updatePosition();
            }
        }

        // Apply visual updates
        this.updatePosition();
    }


    /**
     * Generiert eine Pascal-ähnliche Darstellung der Action-Details
     */
    private getActionDetails(action: GameAction | undefined): string {
        if (!action) return '(nicht definiert)';

        // 1. Interpolation für "Ghost Nodes" (Library Tasks)
        // Falls dieser Knoten Parameter vom Parent hat, interpolieren wir die Werte für die Anzeige.
        let displayAction = action;
        if (this.data?.parentParams) {
            try {
                const clonedAction = JSON.parse(JSON.stringify(action));

                // Interpolate details template if exists
                if (clonedAction.details) {
                    clonedAction.details = ExpressionParser.interpolate(clonedAction.details, this.data.parentParams);
                }

                // Interpolate other fields for fallback generation
                if (clonedAction.target) clonedAction.target = ExpressionParser.interpolate(clonedAction.target, this.data.parentParams);
                if (clonedAction.formula) clonedAction.formula = ExpressionParser.interpolate(clonedAction.formula, this.data.parentParams);

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

        // 2. Single Source of Truth: Priorisiere das generierte 'details' Feld aus dem JSON
        if ((displayAction as any).details) {
            return (displayAction as any).details;
        }

        // 3. Fallback: Manuelle Generierung (falls details im JSON fehlt)
        if (displayAction.type === 'property') {
            const changes = displayAction.changes || (displayAction as any).propertyChanges || {};
            const entries = Object.entries(changes);
            if (entries.length === 0) {
                return displayAction.target ? `${displayAction.target} (keine Änderungen)` : '(property)';
            }
            return entries.map(([prop, value]) => `${displayAction.target}.${prop} := ${value}`).join('; ');
        }

        if (displayAction.type === 'variable' || displayAction.type === 'set_variable') {
            const varName = (displayAction as any).variableName || (displayAction as any).variable || '???';
            if (displayAction.source) {
                return `${varName} := ${displayAction.source}.${displayAction.sourceProperty}`;
            }
            return `${varName} := ${displayAction.value}`;
        }

        if (displayAction.type === 'service') {
            const result = (displayAction as any).resultVariable ? `${(displayAction as any).resultVariable} := ` : '';
            return `${result}${displayAction.service}.${displayAction.method}()`;
        }

        if (displayAction.type === 'calculate') {
            const result = (displayAction as any).resultVariable ? `${(displayAction as any).resultVariable} := ` : '';
            return `${result}${(displayAction as any).formula || '(Berechnung)'}`;
        }

        if (displayAction.type === 'call_method') {
            const da = displayAction as any;
            const params = da.params ? (Array.isArray(da.params) ? da.params.join(', ') : da.params) : '';
            return `${da.target}.${da.method}(${params})`;
        }

        if (displayAction.type === 'http') {
            const url = displayAction.url ? this.formatValue(displayAction.url) : '';
            const method = displayAction.method || 'GET';
            const result = (displayAction as any).resultVariable ? `${(displayAction as any).resultVariable} := ` : '';
            return `${result}HTTP ${method} ${url}`;
        }

        if ((displayAction as any).type === 'store_token') {
            const op = (displayAction as any).operation === 'delete' ? 'Delete' : 'Store';
            const key = (displayAction as any).tokenKey || 'auth_token';
            return `${op} Token [${key}]`;
        }

        return `(${displayAction.type})`;
    }

    private formatValue(value: any, truncate: boolean = true): string {
        if (typeof value === 'string') {
            // Kürzen wenn zu lang (Limit erhöht auf 100 für bessere Lesbarkeit in Flow-Diagrammen)
            if (truncate && value.length > 100) {
                return value.substring(0, 97) + '...';
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
                    name: this.Name, // Match current Name (SSoT)
                    type: this.type, // Match current Type (SSoT)
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

    protected refreshVisuals() {
        this.setShowDetails(this.showDetails, this.projectRef);
    }
}
