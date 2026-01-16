
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

    /**
     * Zeigt Action-Details an oder versteckt sie
     */
    public setShowDetails(show: boolean, project: GameProject | null): void {
        super.setShowDetails(show, project);
        const title = this.Name;
        const action = project?.actions.find(a => a.name === title);

        if (!show) {
            // Konzept-Ansicht: nur Name zeigen
            this.content.innerHTML = `<span style="white-space:nowrap">${title}</span>`;
            this.element.style.borderRadius = ''; // Let CSS class handle it
            this.autoSize();
        } else {
            // Details-Ansicht: Name + Details zeigen

            // For ghost nodes (expanded library tasks), 'action' might be undefined because it's not in the project.
            // In that case, we use the local 'this.data' which contains the action logic for the ghost node.
            const displayAction = action || (this.data?.isEmbeddedInternal ? this.data : undefined);
            this.Details = this.getActionDetails(displayAction);

            this.content.innerHTML = `
                <div style="text-align:center;padding:8px 4px" translate="no">
                    <div style="font-weight:bold;font-size:12px;white-space:nowrap">${title}</div>
                    <div style="font-family:'Courier New', monospace;font-size:10px;color:#00ffff;margin-top:4px;font-weight:normal;line-height:1.2">
                        ${this.Details.split(';').map(d => `<div style="white-space:nowrap">${d.trim()}</div>`).join('')}
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
                .map(([prop, value]) => `${displayAction.target}.${prop} := ${this.formatValue(value)}`)
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

    public getInspectorProperties(): any[] {
        const props = super.getInspectorProperties();
        // Note: Sync/hostOnly property removed - Multiplayer now uses Task.triggerMode
        return props;
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
