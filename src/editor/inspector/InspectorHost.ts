import { ReactiveRuntime } from '../../runtime/ReactiveRuntime';
import { GameProject } from '../../model/types';
import { InspectorRenderer } from './InspectorRenderer';
import { InspectorEventHandler } from './InspectorEventHandler';
import { InspectorRegistry } from './InspectorRegistry';
import { InspectorTemplateLoader } from './InspectorTemplateLoader';
import { InspectorActionHandler } from './InspectorActionHandler';
import { GameObjectHandler } from './handlers/GameObjectHandler';
import { FlowNodeHandler } from './handlers/FlowNodeHandler';
import { VariableHandler } from './handlers/VariableHandler';
import { ExpressionParser } from '../../runtime/ExpressionParser';
import { mediatorService } from '../../services/MediatorService';
import { InspectorContextBuilder } from './InspectorContextBuilder';
import { PropertyHelper } from '../../runtime/PropertyHelper';

/**
 * InspectorHost - The main entry point for the new modular Inspector.
 * Coordinates selection, rendering, and property changes.
 */
export class InspectorHost {
    private renderer: InspectorRenderer;
    private eventHandler: InspectorEventHandler;
    private templateLoader: InspectorTemplateLoader;
    private actionHandler: InspectorActionHandler;
    private container: HTMLElement | null = null;
    private activeTab: string = 'properties';
    private selectedObject: any = null;

    constructor(
        private runtime: ReactiveRuntime,
        public project: GameProject
    ) {
        this.renderer = new InspectorRenderer(runtime);
        this.eventHandler = new InspectorEventHandler(runtime, project);
        this.templateLoader = new InspectorTemplateLoader(runtime);
        this.actionHandler = new InspectorActionHandler(runtime, project, this);

        // Initialize Default Handlers
        InspectorRegistry.registerHandler(new GameObjectHandler());
        InspectorRegistry.registerHandler(new FlowNodeHandler());
        InspectorRegistry.registerHandler(new VariableHandler());
    }

    /**
     * Sets or updates the active runtime
     */
    public setRuntime(runtime: ReactiveRuntime): void {
        this.runtime = runtime;
        this.renderer = new InspectorRenderer(runtime);
        this.eventHandler = new InspectorEventHandler(runtime, this.project);
        this.templateLoader = new InspectorTemplateLoader(runtime);
        this.actionHandler = new InspectorActionHandler(runtime, this.project, this);
    }

    /**
     * Sets the container element where the inspector should render
     */
    public setContainer(el: HTMLElement): void {
        this.container = el;
    }

    /**
     * Updates the inspector based on the current selection.
     * This is the main orchestrator called when an object is selected.
     */
    public async update(obj?: any): Promise<void> {
        if (!this.container) return;

        if (obj) {
            this.selectedObject = obj;
        }

        const currentObject = this.selectedObject || this.runtime.getVariable('selectedObject');
        if (!currentObject) {
            this.container.innerHTML = '<div style="padding: 20px; color: #888; text-align: center;">Kein Objekt ausgewählt</div>';
            return;
        }

        this.render(currentObject);
    }

    /**
     * Performs the actual rendering of the inspector tabs and content.
     */
    private async render(obj: any): Promise<void> {
        this.container!.innerHTML = '';

        const header = this.renderHeader(obj);
        this.container!.appendChild(header);

        const tabs = this.renderTabs();
        this.container!.appendChild(tabs);

        const content = document.createElement('div');
        content.className = 'inspector-content';
        content.style.padding = '10px';
        content.style.flex = '1';
        content.style.overflowY = 'auto';
        this.container!.appendChild(content);

        if (this.activeTab === 'properties') {
            await this.renderPropertiesContent(obj, content);
        } else if (this.activeTab === 'events') {
            this.renderEventsContent(obj, content);
        }
    }

    private renderHeader(obj: any): HTMLElement {
        const header = document.createElement('div');
        header.style.padding = '10px';
        header.style.backgroundColor = '#333';
        header.style.borderBottom = '1px solid #444';
        header.style.fontWeight = 'bold';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';

        const title = document.createElement('span');
        title.innerText = obj.name || obj.id || 'Unbenannt';
        header.appendChild(title);

        const type = document.createElement('span');
        type.style.color = '#888';
        type.style.fontSize = '10px';
        type.innerText = obj.className || obj.constructor?.name || 'Object';
        header.appendChild(type);

        return header;
    }

    private renderTabs(): HTMLElement {
        const tabs = document.createElement('div');
        tabs.style.display = 'flex';
        tabs.style.backgroundColor = '#222';
        tabs.style.borderBottom = '1px solid #444';

        const createTab = (id: string, label: string) => {
            const tab = document.createElement('div');
            tab.innerText = label;
            tab.style.padding = '8px 12px';
            tab.style.cursor = 'pointer';
            tab.style.fontSize = '11px';
            tab.style.borderBottom = this.activeTab === id ? '2px solid #0078d4' : 'none';
            tab.style.color = this.activeTab === id ? '#fff' : '#888';
            tab.onclick = () => {
                this.activeTab = id;
                this.update();
            };
            return tab;
        };

        tabs.appendChild(createTab('properties', 'Eigenschaften'));
        tabs.appendChild(createTab('events', 'Events'));

        return tabs;
    }

    private async renderPropertiesContent(obj: any, parent: HTMLElement): Promise<void> {
        // 1. Determine Template
        let inspectorFile = './inspector.json';

        // A. Priority: Specialized Handler
        const handler = InspectorRegistry.getHandler(obj);
        if (handler && typeof handler.getInspectorTemplate === 'function') {
            const customTemplate = handler.getInspectorTemplate(obj);
            if (customTemplate) inspectorFile = customTemplate;
        }
        // B. Secondary: Component-specific override
        else if (typeof (obj as any).getInspectorFile === 'function') {
            inspectorFile = (obj as any).getInspectorFile();
        }

        const staticObjects = await this.templateLoader.loadTemplate(inspectorFile, obj);

        // Only add dynamic objects if it's the generic inspector (fallback)
        const isDefaultInspector = inspectorFile === './inspector.json';
        const dynamicObjects = isDefaultInspector ? this.renderer.generateUIFromProperties(obj) : [];

        const uiObjects = [...staticObjects, ...dynamicObjects];

        // 2. Render each definition
        uiObjects.forEach(def => {
            const el = this.renderUIDefinition(def, obj);
            if (el) parent.appendChild(el);
        });
    }

    private renderUIDefinition(def: any, obj: any): HTMLElement | null {
        // --- NEW: Evaluate visibility ---
        if (def.visible !== undefined) {
            const isVisible = this.resolveRawValue(def.visible, obj);
            if (!isVisible) return null;
        }

        // --- NEW: Wrap in a labeled container if 'label' property is present ---
        if (def.label && def.className !== 'TLabel' && def.className !== 'TCheckbox' && def.className !== 'TActionParams') {
            const container = document.createElement('div');
            container.style.marginBottom = '8px';

            const label = this.renderer.renderLabel(def.label);
            container.appendChild(label);

            // Temporarily remove label to prevent recursion and render the actual control
            const shallowCopy = { ...def };
            delete shallowCopy.label;
            const control = this.renderUIDefinition(shallowCopy, obj);

            if (control) {
                container.appendChild(control);
                return container;
            }
        }

        switch (def.className) {
            case 'TLabel':
                return this.renderer.renderLabel(this.resolveValue(def.text, obj), def.style);
            case 'TEdit': {
                const value = this.resolveValue(def.text || def.value, obj);
                const input = this.renderer.renderEdit(value);
                input.onchange = () => {
                    const event = this.eventHandler.handleControlChange(def.name, input.value, obj, def);

                    if (event) {
                        mediatorService.notifyDataChanged({
                            property: event.propertyName,
                            value: event.newValue,
                            oldValue: event.oldValue,
                            object: event.object
                        }, 'inspector');
                        if (this.onObjectUpdate) this.onObjectUpdate(event);
                    }
                };
                return input;
            }
            case 'TNumberInput': {
                const value = this.resolveValue(def.text || def.value, obj);
                const input = this.renderer.renderNumberInput(Number(value), def.min, def.max, def.step);
                input.onchange = () => {
                    const event = this.eventHandler.handleControlChange(def.name, Number(input.value), obj, def);

                    if (event) {
                        mediatorService.notifyDataChanged({
                            property: event.propertyName,
                            value: event.newValue,
                            oldValue: event.oldValue,
                            object: event.object
                        }, 'inspector');
                        if (this.onObjectUpdate) this.onObjectUpdate(event);
                    }
                };
                return input;
            }
            case 'TDropdown': {
                const value = this.resolveValue(def.selectedValue, obj);
                const rawOptions = def.options || [];
                const options = (typeof rawOptions === 'string') ? this.resolveValue(rawOptions, obj) : rawOptions;
                const select = this.renderer.renderSelect(Array.isArray(options) ? options : [], value, def.placeholder);
                select.onchange = () => {
                    const event = this.eventHandler.handleControlChange(def.name, select.value, obj, def);

                    if (event) {
                        mediatorService.notifyDataChanged({
                            property: event.propertyName,
                            value: event.newValue,
                            oldValue: event.oldValue,
                            object: event.object
                        }, 'inspector');
                    }

                    // --- NEW: Handle optional action trigger ---
                    if (def.action) {
                        this.actionHandler.handleAction(def, obj);
                    }

                    this.update(obj); // Immediate re-render
                    if (this.onObjectUpdate) this.onObjectUpdate(event);
                };
                return select;
            }
            case 'TCheckbox': {
                const value = this.resolveValue(def.checked, obj);
                const container = this.renderer.renderCheckbox(!!value, def.label || '');
                const cb = (container as any).input as HTMLInputElement;
                cb.onchange = () => {
                    const event = this.eventHandler.handleControlChange(def.name, cb.checked, obj, def);

                    if (event) {
                        mediatorService.notifyDataChanged({
                            property: event.propertyName,
                            value: event.newValue,
                            oldValue: event.oldValue,
                            object: event.object
                        }, 'inspector');
                        if (this.onObjectUpdate) this.onObjectUpdate(event);
                    }
                    this.update(obj); // Immediate re-render
                };
                return container;
            }
            case 'TButton': {
                return this.renderer.renderButton(def.caption || def.name, () => {
                    this.actionHandler.handleAction(def, obj);
                });
            }
            case 'TActionParams': {
                const onUpdate = (prop: string, val: any) => {
                    const oldVal = PropertyHelper.getPropertyValue(obj, prop);
                    if (oldVal === val) return;
                    PropertyHelper.setPropertyValue(obj, prop, val);
                    mediatorService.notifyDataChanged({
                        property: prop,
                        value: val,
                        oldValue: oldVal,
                        object: obj
                    }, 'inspector');
                    this.update(obj); // Refesh UI
                    if (this.onObjectUpdate) this.onObjectUpdate({ object: obj, propertyName: prop, newValue: val, oldValue: oldVal });
                };
                return this.renderer.renderActionParams(def, obj, onUpdate);
            }
            case 'TPanel': {
                const panel = this.renderer.renderPanel(def.style);
                if (def.children && Array.isArray(def.children)) {
                    def.children.forEach((child: any) => {
                        const childEl = this.renderUIDefinition(child, obj);
                        if (childEl) panel.appendChild(childEl);
                    });
                }
                return panel;
            }
            default:
                return null;
        }
    }

    private resolveValue(expr: any, obj: any): any {
        if (typeof expr !== 'string' || !expr.includes('${')) return expr;

        // Use InspectorContextBuilder to get enriched context (availableDataStores, etc.)
        const context = InspectorContextBuilder.build(obj);

        return ExpressionParser.interpolate(expr, context);
    }

    private resolveRawValue(expr: any, obj: any): any {
        if (typeof expr !== 'string' || !expr.includes('${')) return expr;

        // Use InspectorContextBuilder to get enriched context (availableDataStores, etc.)
        const context = InspectorContextBuilder.build(obj);

        return ExpressionParser.evaluateRaw(expr, context);
    }

    private async renderEventsContent(obj: any, parent: HTMLElement): Promise<void> {
        parent.innerHTML = '';

        // Determine Event Template
        let eventsFile = './inspector_events.json';

        // Check if handler provides a specialized event template
        const handler = InspectorRegistry.getHandler(obj);
        if (handler && (handler as any).getEventsTemplate) {
            const customEventsTemplate = (handler as any).getEventsTemplate(obj);
            if (customEventsTemplate) eventsFile = customEventsTemplate;
        } else if (obj.isVariable) {
            // Fallback for variables until handler is updated
            eventsFile = './inspector_variable_events.json';
        }

        try {
            const uiObjects = await this.templateLoader.loadTemplate(eventsFile, obj);

            if (!uiObjects || uiObjects.length === 0) {
                parent.innerHTML = '<div style="color: #666; font-style: italic;">Keine Events für dieses Objekt verfügbar.</div>';
                return;
            }

            uiObjects.forEach(def => {
                const el = this.renderUIDefinition(def, obj);
                if (el) parent.appendChild(el);
            });
        } catch (e) {
            console.warn(`[InspectorHost] Could not load events template: ${eventsFile}`, e);
            parent.innerHTML = '<div style="color: #666; font-style: italic;">Events konnten nicht geladen werden.</div>';
        }
    }

    /**
     * Clears the inspector
     */
    public clear(): void {
        if (this.container) this.container.innerHTML = '';
        this.selectedObject = null;
        InspectorRegistry.clear();
    }

    // --- COMPATIBILITY METHODS FOR LEGACY INTEGRATION ---

    /**
     * Legacy getter for selected object.
     */
    public getSelectedObject(): any {
        return this.runtime.getVariable('selectedObject');
    }

    /**
     * Legacy: Sets the flow context (nodes) for the inspector.
     */
    public setFlowContext(_nodes: any[] | null): void {
        console.log('[InspectorHost] Flow context updated (Legacy Compat)');
        // In the modular system, handlers can access nodes via ProjectRegistry if needed.
    }

    /**
     * Legacy: Forces an update of available actions in dropdowns.
     */
    public updateAvailableActions(_actions?: string[]): void {
        console.log('[InspectorHost] Updating available actions (Legacy Compat)');
        this.update();
    }

    /**
     * Legacy: Set editor reference.
     */
    public setEditor(_editor: any): void {
        console.log('[InspectorHost] Editor reference set (Legacy Compat)');
    }

    /**
     * Legacy: Set project reference.
     */
    public setProject(project: GameProject): void {
        this.project = project;
    }

    // Handlers/Callbacks for Editor.ts
    public onObjectUpdate: ((event?: any) => void) | null = null;
    public onProjectUpdate: (() => void) | null = null;
    public onObjectDelete: ((obj: any) => void) | null = null;
    public onObjectSelect: ((id: string | null) => void) | null = null;
}
