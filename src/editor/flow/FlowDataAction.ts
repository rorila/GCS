import { FlowAction } from './FlowAction';
import { GameProject } from '../../model/types';

export class FlowDataAction extends FlowAction {
    public getType(): string { return 'DataAction'; }

    public successAnchor!: HTMLElement;
    public errorAnchor!: HTMLElement;

    constructor(id: string, x: number, y: number, container: HTMLElement, gridSize: number) {
        super(id, x, y, container, gridSize);
        this.element.classList.add('glass-node-data'); // Add special styling for data nodes

        // Ensure it has a default action type if newly created
        if (!this.data.type || this.data.type === 'property') {
            this.data.type = 'http';
        }
    }

    // --- Inspector Proxies for DataAction ---

    public get url(): string {
        const action = this.getActionDefinition();
        const fullUrl = action?.url || '';
        const res = action?.resource;
        const qProp = action?.queryProperty;
        const qVal = action?.queryValue;

        // If we have a resource and a defined query property, we manage the URL
        if (res && qProp) {
            return `?${qProp}=${qVal || ''}`;
        }

        // Fallback: If we have a resource and the URL starts with the resource base,
        // we only return the suffix for the inspector.
        const base = `/api/data/${res}`;
        if (res && fullUrl.startsWith(base)) {
            return fullUrl.substring(base.length);
        }
        return fullUrl;
    }
    public set url(v: string) {
        const action = this.getActionDefinition();
        if (action) {
            const res = action.resource;

            // If user manually types a URL suffix that doesn't look like a simple query,
            // we might want to clear the queryProperty to avoid conflicting UI states.
            if (v && !v.startsWith('?') && !v.includes('=')) {
                action.queryProperty = '';
            }

            // If we have a resource and the user provides a suffix (doesn't start with / or http),
            // we prepend the resource base path.
            if (res && v && !v.startsWith('http') && !v.startsWith('/')) {
                // Check if it's a query param or a subpath
                const separator = v.startsWith('?') ? '' : '/';
                action.url = `/api/data/${res}${separator}${v}`;
            } else if (res && v.startsWith('/')) {
                // Leading slash means direct subpath
                action.url = `/api/data/${res}${v}`;
            } else {
                action.url = v;
            }
        }
    }

    public get queryProperty(): string {
        const action = this.getActionDefinition();
        return action?.queryProperty || '';
    }
    public set queryProperty(v: string) {
        const action = this.getActionDefinition();
        if (action) {
            action.queryProperty = v;
            this.updateAutoUrl();
        }
    }

    public get queryValue(): string {
        const action = this.getActionDefinition();
        return action?.queryValue || '';
    }
    public set queryValue(v: string) {
        const action = this.getActionDefinition();
        if (action) {
            action.queryValue = v;
            this.updateAutoUrl();
        }
    }

    private updateAutoUrl() {
        const action = this.getActionDefinition();
        if (action && action.resource && action.queryProperty) {
            action.url = `/api/data/${action.resource}?${action.queryProperty}=${action.queryValue || ''}`;
        }
    }

    public get resource(): string {
        const action = this.getActionDefinition();
        return action?.resource || '';
    }
    public set resource(v: string) {
        const action = this.getActionDefinition();
        if (action) {
            action.resource = v;
            if (v) {
                // Initial URL when resource is selected
                action.url = `/api/data/${v}`;
            }
        }
    }

    public get method(): string {
        const action = this.getActionDefinition();
        return action?.method || 'GET';
    }
    public set method(v: string) {
        const action = this.getActionDefinition();
        if (action) action.method = v;
    }

    public get body(): string {
        const action = this.getActionDefinition();
        const bodyValue = action?.body;
        // We store body as string in the inspector for simplicity
        return typeof bodyValue === 'object' ? JSON.stringify(bodyValue, null, 2) : (bodyValue || '');
    }
    public set body(v: string) {
        const action = this.getActionDefinition();
        if (action) {
            try {
                action.body = JSON.parse(v);
            } catch (e) {
                action.body = v;
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

    protected createRoot(): HTMLElement {
        const el = super.createRoot();

        // Remove standard output anchor if it exists (it's created by FlowElement.createRoot)
        if (this.outputAnchor && this.outputAnchor.parentNode === el) {
            el.removeChild(this.outputAnchor);
        }

        // Create specialized anchors
        this.successAnchor = this.createAnchor('success');
        this.errorAnchor = this.createAnchor('error');

        el.appendChild(this.successAnchor);
        el.appendChild(this.errorAnchor);

        return el;
    }

    protected createAnchor(type: string): HTMLElement {
        const anchor = super.createAnchor(type as any);

        if (type === 'success') {
            anchor.style.backgroundColor = '#4caf50'; // Green
            anchor.style.right = '-5px';
            anchor.style.top = '50%';
            anchor.title = 'Erfolg (Success)';
        } else if (type === 'error') {
            anchor.style.backgroundColor = '#f44336'; // Red
            anchor.style.bottom = '-5px';
            anchor.style.left = '50%';
            anchor.title = 'Fehler (Error)';
        }

        return anchor;
    }

    public getAnchorPosition(type: string): { x: number, y: number } {
        const centerX = this.x + (this.width / 2);
        const centerY = this.y + (this.height / 2);

        if (type === 'success') {
            return { x: this.x + this.width, y: centerY };
        } else if (type === 'error') {
            return { x: centerX, y: this.y + this.height };
        }

        return super.getAnchorPosition(type as any);
    }

    public setShowDetails(show: boolean, project: GameProject | null): void {
        super.setShowDetails(show, project);

        if (show) {
            // Additional styling or indicators for data nodes in detailed view
            const icon = document.createElement('div');
            icon.innerHTML = '🗄️';
            icon.style.cssText = 'position:absolute;top:5px;right:10px;font-size:12px;opacity:0.6';
            this.content.appendChild(icon);

            // Update details to show data-specific info
            const method = this.method;
            const url = this.url;
            const result = this.resultVariable ? ` -> ${this.resultVariable}` : '';

            // We can manually update the content for better data visualization
            const detailsEl = this.content.querySelector('div > div:nth-child(2)');
            if (detailsEl) {
                detailsEl.innerHTML = `
                    <div style="color:#ffcc00">${this.resource ? '📦 ' + this.resource : method}</div>
                    <div title="${url}" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:130px">${url}</div>
                    <div style="color:#00ff00; font-size:9px">${result}</div>
                `;
            }
        }
    }
}
