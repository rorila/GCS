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
        if (!this.data.type || this.data.type === 'property' || this.data.type === 'http') {
            this.data.type = 'data_action';
        }
    }

    // --- Inspector Proxies for DataAction ---

    public get url(): string {
        const action = this.getActionDefinition();
        const fullUrl = action?.url || '';

        // If it's a JWT request, we point to the platform login
        if (action?.requestJWT) {
            return `/api/platform/login`;
        }

        const res = action?.resource || this.getAutoResource();
        const qProp = action?.queryProperty;
        const qVal = action?.queryValue;

        // If we have a resource and a defined query property, we manage the URL
        if (res && qProp) {
            return `/api/data/${res}?${qProp}=${qVal || ''}`;
        }

        // If no full URL but resource, show standard path
        if (!fullUrl && res) {
            return `/api/data/${res}`;
        }

        return fullUrl;
    }
    public set url(v: string) {
        console.log(`[FlowDataAction] Setter URL: ${v}`);

        const updateObj = (obj: any) => {
            if (!obj) return;
            // Decouple from resource/queryProperty if user sets a manual absolute URL
            const isAbsolute = v.startsWith('http://') || v.startsWith('https://');
            const isPrefixed = v.startsWith('/api/data/');

            if (isAbsolute || isPrefixed) {
                obj.url = v;
            } else {
                const res = obj.resource || obj.dataStore || this.getAutoResource();
                if (res) {
                    const separator = (v.startsWith('?') || v.startsWith('/')) ? '' : '/';
                    obj.url = `/api/data/${res}${separator}${v}`;
                } else {
                    obj.url = v;
                }
            }
        };

        updateObj(this.data); // Local mirror
        const action = this.getActionDefinition();
        if (action && action !== this.data) {
            updateObj(action); // Global definition
        }
        console.log(`[FlowDataAction] Resulting URL in model: ${action?.url || this.data.url}`);
    }

    protected getActionDefinition(): any | null {
        if (!this.projectRef) return this.data;

        // 1. Linked Mode: Get from project/stage (Single Source of Truth)
        if (this.data?.isLinked && this.Name) {
            let action = (this.projectRef.actions || []).find((a: any) => a.name === this.Name);

            // Search in stages if not found in global
            if (!action && this.projectRef.stages) {
                for (const s of this.projectRef.stages) {
                    if (s.actions) {
                        action = s.actions.find((a: any) => a.name === this.Name);
                        if (action) break;
                    }
                }
            }

            if (action) {
                // Ensure it has correct type if it was a legacy/corrupt action
                if (!action.type || action.type === 'property' || action.type === 'http') {
                    action.type = 'data_action';
                }
                return action;
            }
        }

        // 2. Embedded/Local Mode: Use local data copy
        if (this.data) {
            if (!this.data.type || this.data.type === 'property' || this.data.type === 'http') {
                this.data.type = 'data_action';
            }
        }
        return this.data;
    }

    public get queryProperty(): string {
        const action = this.getActionDefinition();
        return action?.queryProperty || action?.property || '';
    }
    public set queryProperty(v: string) {
        console.log(`[FlowDataAction] Setter queryProperty: ${v}`);
        if (this.data) this.data.queryProperty = v;
        const action = this.getActionDefinition();
        if (action && action !== this.data) {
            action.queryProperty = v;
        }
        this.updateAutoUrl();
    }

    public get queryValue(): string {
        const action = this.getActionDefinition();
        return action?.queryValue || '';
    }
    public set queryValue(v: string) {
        console.log(`[FlowDataAction] Setter queryValue: ${v}`);
        if (this.data) this.data.queryValue = v;
        const action = this.getActionDefinition();
        if (action && action !== this.data) {
            action.queryValue = v;
        }
        this.updateAutoUrl();
    }

    private updateAutoUrl() {
        const action = this.getActionDefinition();
        if (action) {
            if (action.requestJWT) {
                action.url = `/api/platform/login`;
                return;
            }
            const res = action.resource || this.getAutoResource();
            if (res && action.queryProperty) {
                action.url = `/api/data/${res}?${action.queryProperty}=${action.queryValue || ''}`;
            }
        }
    }

    public get dataStore(): string {
        const action = this.getActionDefinition();
        if (action?.dataStore) return action.dataStore;

        // Fallback: If we have a resource but no dataStore, attempt to find the component name
        if (action?.resource && this.projectRef) {
            // This is a bit of a reverse lookup, might be imperfect but better than empty
            for (const stage of this.projectRef.stages || []) {
                const ds = stage.objects?.find((o: any) => o.defaultCollection === action.resource);
                if (ds) return ds.name;
            }
            return action.resource; // Use resource name as a guess for component name
        }
        return '';
    }
    public set dataStore(v: string) {
        console.log(`[FlowDataAction] Setter dataStore: ${v}`);

        const updateObj = (obj: any) => {
            if (!obj) return;
            obj.dataStore = v;
            if (obj.resource) delete obj.resource;
        };

        updateObj(this.data);
        const action = this.getActionDefinition();
        if (action && action !== this.data) {
            updateObj(action);
        }
        this.updateAutoUrl();
    }

    public get requestJWT(): boolean {
        const action = this.getActionDefinition();
        return !!action?.requestJWT;
    }
    public set requestJWT(v: boolean) {
        console.log(`[FlowDataAction] Setter requestJWT: ${v}`);

        // Always update local data as a fallback for the actionSequence in project.json
        if (this.data) {
            this.data.requestJWT = v;
            if (v) this.data.method = 'POST';
        }

        const action = this.getActionDefinition();
        if (action) {
            action.requestJWT = v;
            if (v) {
                action.method = 'POST'; // JWT requests are always POST
            } else {
                action.method = 'GET';
            }
            this.updateAutoUrl();
        }
    }

    private getAutoResource(): string {
        const action = this.getActionDefinition();
        const dsName = action?.dataStore;
        if (!dsName || !this.projectRef) return '';

        // Find DataStore component to get its default collection
        let dsObj: any = null;
        if (this.projectRef.stages) {
            for (const stage of this.projectRef.stages) {
                dsObj = stage.objects?.find((o: any) => o.name === dsName || o.id === dsName);
                if (dsObj) break;
            }
        }

        // Return default collection or name (as fallback)
        return dsObj?.defaultCollection || (dsObj ? 'items' : '');
    }

    public get resource(): string {
        const action = this.getActionDefinition();
        return action?.resource || this.getAutoResource();
    }
    public set resource(v: string) {
        console.log(`[FlowDataAction] Setter resource: ${v}`);
        if (this.data) {
            this.data.resource = v;
            if (v) this.data.url = `/api/data/${v}`;
        }
        const action = this.getActionDefinition();
        if (action && action !== this.data) {
            action.resource = v;
            if (v) action.url = `/api/data/${v}`;
        }
    }

    public get method(): string {
        const action = this.getActionDefinition();
        return action?.method || 'GET';
    }
    public set method(v: string) {
        console.log(`[FlowDataAction] Setter method: ${v}`);
        if (this.data) this.data.method = v;
        const action = this.getActionDefinition();
        if (action && action !== this.data) action.method = v;
    }

    public get body(): string {
        const action = this.getActionDefinition();
        const bodyValue = action?.body;
        // We store body as string in the inspector for simplicity
        return typeof bodyValue === 'object' ? JSON.stringify(bodyValue, null, 2) : (bodyValue || '');
    }
    public set body(v: string) {
        console.log(`[FlowDataAction] Setter body: ${v.substring(0, 50)}...`);
        let val: any;
        try {
            val = JSON.parse(v);
        } catch (e) {
            val = v;
        }

        if (this.data) this.data.body = val;
        const action = this.getActionDefinition();
        if (action && action !== this.data) action.body = val;
    }

    public get resultVariable(): string {
        const action = this.getActionDefinition();
        return action?.resultVariable || '';
    }
    public set resultVariable(v: string) {
        console.log(`[FlowDataAction] Setter resultVariable: ${v}`);
        if (this.data) this.data.resultVariable = v;
        const action = this.getActionDefinition();
        if (action && action !== this.data) action.resultVariable = v;
    }

    public get resultPath(): string {
        const action = this.getActionDefinition();
        return action?.resultPath || '';
    }
    public set resultPath(v: string) {
        console.log(`[FlowDataAction] Setter resultPath: ${v}`);
        if (this.data) this.data.resultPath = v;
        const action = this.getActionDefinition();
        if (action && action !== this.data) action.resultPath = v;
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
            const result = this.resultVariable ? ` -> ${this.resultVariable} ` : '';

            // We can manually update the content for better data visualization
            const detailsEl = this.content.querySelector('div > div:nth-child(2)');
            if (detailsEl) {
                detailsEl.innerHTML = `
    < div style = "color:#ffcc00" > ${this.resource ? '📦 ' + this.resource : method} </div>
        < div title = "${url}" style = "white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:130px" > ${url} </div>
            < div style = "color:#00ff00; font-size:9px" > ${result} </div>
                `;
            }
        }
    }
}
