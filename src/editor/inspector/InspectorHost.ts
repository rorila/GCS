import { ReactiveRuntime } from '../../runtime/ReactiveRuntime';
import { GameProject } from '../../model/types';
import { InspectorRenderer } from './InspectorRenderer';
import { InspectorEventHandler } from './InspectorEventHandler';
import { InspectorRegistry } from './InspectorRegistry';
import { InspectorTemplateLoader } from './InspectorTemplateLoader';
import { InspectorActionHandler } from './InspectorActionHandler';
import { GameObjectHandler } from './handlers/GameObjectHandler';
import { FlowConditionHandler } from './handlers/FlowConditionHandler';
import { FlowNodeHandler } from './handlers/FlowNodeHandler';
import { GROUP_COLORS } from '../../components/TComponent';
import { VariableHandler } from './handlers/VariableHandler';
import { StageHandler } from './handlers/StageHandler';
import { ExpressionParser } from '../../runtime/ExpressionParser';
import { mediatorService } from '../../services/MediatorService';
import { componentRegistry } from '../../services/ComponentRegistry';
import { InspectorContextBuilder } from './InspectorContextBuilder';
import { PropertyHelper } from '../../runtime/PropertyHelper';
import { Logger } from '../../utils/Logger';
import { isInspectable, IInspectable } from './types';

/**
 * InspectorHost - The main entry point for the new modular Inspector.
 * Coordinates selection, rendering, and property changes.
 */
export class InspectorHost {
    private static logger = Logger.get('InspectorHost', 'Inspector_Update');

    private renderer: InspectorRenderer;
    private eventHandler: InspectorEventHandler;
    private templateLoader: InspectorTemplateLoader;
    private actionHandler: InspectorActionHandler;
    private container: HTMLElement | null = null;
    private activeTab: string = 'properties';
    private selectedObject: any = null;
    private savedScrollTop: number = 0;

    constructor(
        private runtime: ReactiveRuntime,
        public project: GameProject
    ) {
        this.renderer = new InspectorRenderer();
        this.eventHandler = new InspectorEventHandler(runtime, project);
        this.templateLoader = new InspectorTemplateLoader(); // Removed runtime
        this.actionHandler = new InspectorActionHandler(runtime, project, this);

        // Initialize Default Handlers
        InspectorRegistry.registerHandler(new GameObjectHandler());
        InspectorRegistry.registerHandler(new FlowNodeHandler());
        InspectorRegistry.registerHandler(new FlowConditionHandler());
        InspectorRegistry.registerHandler(new VariableHandler());
        InspectorRegistry.registerHandler(new StageHandler());
    }

    /**
     * Sets or updates the active runtime
     */
    public setRuntime(runtime: ReactiveRuntime): void {
        this.runtime = runtime;
        this.renderer = new InspectorRenderer();
        this.eventHandler = new InspectorEventHandler(runtime, this.project);
        this.templateLoader = new InspectorTemplateLoader(); // Removed runtime
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
            // Bei neuem Objekt (Selektion geändert) Scroll-Position zurücksetzen
            if (this.selectedObject !== obj) {
                this.savedScrollTop = 0;
            }
            this.selectedObject = obj;
        }

        // --- NEW: Speichere aktuelle Scroll-Position vor dem Neurendern ---
        if (this.container) {
            const contentDiv = this.container.querySelector('.inspector-content');
            if (contentDiv) {
                this.savedScrollTop = contentDiv.scrollTop;
            }
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
            await this.renderEventsContent(obj, content);
        } else if (this.activeTab === 'logs') {
            InspectorHost.logger.debug('Rendering logs tab');
            await this.renderLogsContent(obj, content);
        }

        // --- NEW: Stelle Scroll-Position nach dem Rendern wieder her ---
        requestAnimationFrame(() => {
            if (content) {
                content.scrollTop = this.savedScrollTop;
            }
        });
    }

    private async renderLogsContent(obj: any, parent: HTMLElement): Promise<void> {
        InspectorHost.logger.debug('Loading inspector_logs.json');
        const staticObjects = await this.templateLoader.loadTemplate('./inspector_logs.json', obj);
        staticObjects.forEach(def => {
            const el = this.renderUIDefinition(def, obj);
            if (el) parent.appendChild(el);
        });
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
        type.style.marginRight = '10px';
        type.innerText = obj.className || obj.constructor?.name || 'Object';
        header.appendChild(type);

        // Papierkorb-Icon zum Löschen
        if (this.onObjectDelete) {
            const delBtn = document.createElement('button');
            delBtn.innerHTML = '🗑️';
            delBtn.title = 'Löschen';
            delBtn.style.cssText = 'background:none; border:none; color:#ff5252; cursor:pointer; font-size:14px; padding:0 5px;';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                this.onObjectDelete!(obj);
            };
            header.appendChild(delBtn);
        }


        return header;
    }

    private renderTabs(): HTMLElement {
        const tabs = document.createElement('div');
        tabs.style.display = 'flex';
        tabs.style.backgroundColor = '#222';
        tabs.style.borderBottom = '1px solid #444';

        const createTab = (id: string, label: string) => {
            const tab = document.createElement('div');
            tab.className = 'inspector-tab';
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
        tabs.appendChild(createTab('logs', 'Logs'));

        return tabs;
    }

    private async renderPropertiesContent(obj: any, parent: HTMLElement): Promise<void> {
        // =====================================================================
        // NEU: IInspectable-Pfad (Component-Owned Inspector)
        // =====================================================================
        if (isInspectable(obj)) {
            this.renderInspectableSections(obj, parent);
            return;
        }

        // =====================================================================
        // LEGACY: JSON-Template-Pfad (bestehende Komponenten ohne IInspectable)
        // =====================================================================
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

    /**
     * Rendert Inspector-Sektionen für IInspectable Objekte.
     * Jede Sektion wird als einklappbare Gruppe dargestellt.
     */
    private renderInspectableSections(obj: IInspectable, parent: HTMLElement): void {
        const groupColors = GROUP_COLORS;

        const sections = obj.getInspectorSections();

        sections.forEach(section => {
            // Farbe für diese Gruppe ermitteln (Key = Label in UPPERCASE)
            const colorKey = section.label.replace(/^[^\w]*/, '').trim().toUpperCase();
            const accentColor = groupColors[colorKey] || '';

            // --- Card-Container ---
            const card = document.createElement('div');
            const borderStyle = accentColor ? `border-left:4px solid ${accentColor};` : 'border-left:4px solid rgba(255,255,255,0.08);';
            const bgTint = accentColor ? `background:linear-gradient(135deg, ${accentColor}12 0%, rgba(30,30,40,0.95) 100%);` : 'background:rgba(30,30,40,0.85);';
            card.style.cssText = `${borderStyle}${bgTint}margin:8px 0;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.3);overflow:hidden;`;

            // --- Card-Header (einklappbar) ---
            const header = document.createElement('div');
            header.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;user-select:none;transition:background 0.15s;';
            header.onmouseenter = () => { header.style.background = 'rgba(255,255,255,0.05)'; };
            header.onmouseleave = () => { header.style.background = ''; };

            const headerColor = accentColor || '#aaa';
            header.innerHTML = `
                <span style="font-size:14px">${section.icon || '📋'}</span>
                <span style="font-size:12px;font-weight:700;color:${headerColor};flex:1;letter-spacing:0.3px;text-transform:uppercase">${section.label}</span>
                <span style="font-size:9px;color:#555;transition:transform 0.2s" data-collapse-icon>${section.collapsed ? '▶' : '▼'}</span>
            `;

            // --- Card-Body ---
            const body = document.createElement('div');
            body.style.cssText = 'display:flex;flex-direction:column;gap:6px;padding:6px 12px 10px;';
            if (section.collapsed) body.style.display = 'none';

            header.onclick = () => {
                const isCollapsed = body.style.display === 'none';
                body.style.display = isCollapsed ? 'flex' : 'none';
                const icon = header.querySelector('[data-collapse-icon]');
                if (icon) {
                    icon.textContent = isCollapsed ? '▼' : '▶';
                }
            };

            card.appendChild(header);
            card.appendChild(body);
            parent.appendChild(card);

            // --- Properties in der Card rendern ---
            section.properties.forEach(propDef => {
                const el = this.renderInspectableProperty(propDef, obj);
                if (el) body.appendChild(el);
            });
        });
    }

    /**
     * Rendert eine einzelne Property-Definition für ein IInspectable Objekt.
     * Nutzt die bestehende Renderer-Infrastruktur, aber delegiert Änderungen
     * an obj.applyChange() statt an die Handler-Kette.
     */
    private renderInspectableProperty(propDef: any, obj: any): HTMLElement | null {
        const container = document.createElement('div');
        container.style.marginBottom = '4px';

        // Button-Typ: spezieller Render-Pfad
        if (propDef.type === 'button') {
            const btn = document.createElement('button');
            btn.innerText = propDef.label;
            btn.style.cssText = 'width:100%;padding:6px 12px;border:none;border-radius:4px;cursor:pointer;color:#fff;font-size:11px;' +
                (propDef.style ? Object.entries(propDef.style).map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}:${v}`).join(';') : 'background:#444');
            btn.onclick = () => {
                if (propDef.action && this.actionHandler) {
                    (this.actionHandler as any).handleAction(propDef, obj);
                }
            };
            container.appendChild(btn);
            return container;
        }

        // Label
        if (propDef.label) {
            const label = this.renderer.renderLabel(propDef.label);
            container.appendChild(label);
        }

        // Wert lesen
        const currentValue = PropertyHelper.getPropertyValue(obj, propDef.name) ?? propDef.defaultValue ?? '';

        // Control rendern basierend auf Typ
        if (propDef.type === 'select') {
            let options = propDef.options || [];
            if (!Array.isArray(options) || options.length === 0) {
                if (propDef.source) {
                    options = this.renderer.getOptionsFromSource(propDef);
                }
            }
            const select = this.renderer.renderSelect(Array.isArray(options) ? options : [], currentValue, propDef.placeholder);
            // Konvention: Select name = controlName || propDef.name (E2E-Kompatibilität)
            const selectName = propDef.controlName || propDef.name || '';
            if (selectName) select.name = selectName;
            select.onchange = async () => {
                // Delegiere an Handler-Kette (FlowNodeHandler etc.)
                // Handler macht: PropertyHelper.setPropertyValue + Refactoring + Mediator
                if (this.eventHandler) {
                    this.eventHandler.handleControlChange(
                        selectName, select.value, obj,
                        { ...propDef, property: propDef.name }
                    );
                }
                // Prüfe ob Sektionen sich ändern (z.B. Typ-Wechsel)
                if (typeof obj.applyChange === 'function') {
                    const needsReRender = obj.applyChange(propDef.name, select.value, currentValue);
                    if (needsReRender) {
                        this.update(obj);
                    }
                }
            };
            container.appendChild(select);
        } else if (propDef.type === 'boolean' || propDef.type === 'checkbox') {
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = !!currentValue;
            cb.onchange = () => {
                if (this.eventHandler) {
                    this.eventHandler.handleControlChange(
                        propDef.name, cb.checked, obj,
                        { ...propDef, property: propDef.name }
                    );
                }
            };
            container.appendChild(cb);
        } else {
            // Text / Number / String Input
            const input = this.renderer.renderEdit(String(currentValue));
            if (propDef.readonly) input.readOnly = true;
            // Konvention: Input name = '{propertyName}Input' (E2E-Kompatibilität)
            if (propDef.name) input.name = propDef.name + 'Input';
            input.onchange = () => {
                const newVal = propDef.type === 'number' ? Number(input.value) : input.value;
                // Delegiere an Handler-Kette (FlowNodeHandler → Refactoring, PropertyHelper etc.)
                if (this.eventHandler) {
                    this.eventHandler.handleControlChange(
                        input.name, newVal, obj,
                        { ...propDef, property: propDef.name }
                    );
                }
            };
            container.appendChild(input);
        }

        return container;
    }

    private renderUIDefinition(def: any, obj: any): HTMLElement | null {
        // --- NEW: Evaluate visibility ---
        if (def.visible !== undefined) {
            const isVisible = this.resolveRawValue(def.visible, obj, def);
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
                return this.renderer.renderLabel(this.resolveValue(def.text, obj, def), def.style);
            case 'TEdit': {
                const value = this.resolveValue(def.text || def.value, obj, def);
                const stringValue = (value === undefined || value === null) ? '' : String(value);
                const input = this.renderer.renderEdit(stringValue);
                if (def.name) input.name = def.name;
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
                const value = this.resolveValue(def.text || def.value, obj, def);
                const input = this.renderer.renderNumberInput(Number(value), def.min, def.max, def.step);
                if (def.name) input.name = def.name;
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
            case 'TSelect':
            case 'TDropdown': {
                const value = this.resolveValue(def.selectedValue, obj, def);

                // --- NEW: Resolve Options from source OR expression ---
                let options = def.options;

                // If options is a string expression (like "${availableDataStores}"), resolve it first
                if (typeof options === 'string' && options.includes('${')) {
                    options = this.resolveValue(options, obj, def);
                }

                // If we still don't have an array, try to get from source
                if (!Array.isArray(options)) {
                    options = this.renderer.getOptionsFromSource(def);
                }

                // If specialized source is not found in registry, try resolving from context
                if ((!Array.isArray(options) || options.length === 0) && def.source) {
                    options = this.resolveRawValue(`\${${def.source}}`, obj, def);
                }

                const select = this.renderer.renderSelect(Array.isArray(options) ? options : [], value, def.placeholder);
                if (def.name) select.name = def.name;
                select.onchange = async () => {
                    InspectorHost.logger.info(`[UI-TRACE] Control="${def.name}" onchange: NewValue="${select.value}"`);
                    const event = this.eventHandler.handleControlChange(def.name, select.value, obj, def);

                    if (event) {
                        mediatorService.notifyDataChanged({
                            property: event.propertyName,
                            value: event.newValue,
                            oldValue: event.oldValue,
                            object: event.object
                        }, 'inspector');
                    }

                    // --- Handle optional action trigger (z.B. changeActionType) ---
                    // WICHTIG: handleAction ist async und ruft intern host.update() auf.
                    // Deshalb KEIN separates this.update() wenn eine Action ausgeführt wird,
                    // sonst Race-Condition: der zweite update() überschreibt mit alten Daten.
                    if (def.action) {
                        await (this.actionHandler as any).handleAction(def, obj, select.value);
                    } else {
                        this.update(obj); // Re-render nur wenn keine Action das übernimmt
                    }
                    if (this.onObjectUpdate) this.onObjectUpdate(event);
                };
                return select;
            }
            case 'TCheckbox': {
                const value = this.resolveValue(def.checked, obj, def);
                const container = this.renderer.renderCheckbox(!!value, def.label || '');
                const cb = (container as any).input as HTMLInputElement;
                if (def.name) cb.name = def.name;
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

                    // --- NEW: Handle optional action trigger ---
                    if (def.action) {
                        this.actionHandler.handleAction(def, obj, cb.checked);
                    }

                    this.update(obj); // Immediate re-render
                };
                return container;
            }
            case 'TChips': {
                const value = this.resolveValue(def.value, obj, def);
                const chips = this.renderer.renderChips(String(value || ''), (chipToRemove) => {
                    const currentValues = String(value || '').split(',').map(s => s.trim()).filter(s => s);
                    const newValues = currentValues.filter(v => v !== chipToRemove);
                    const newValueString = newValues.join(', ');

                    const event = this.eventHandler.handleControlChange(def.name, newValueString, obj, def);
                    if (event) {
                        mediatorService.notifyDataChanged({
                            property: event.propertyName,
                            value: event.newValue,
                            oldValue: event.oldValue,
                            object: event.object
                        }, 'inspector');
                        this.update(obj);
                    }
                });
                return chips;
            }
            case 'TButton': {
                return this.renderer.renderButton(def.caption || def.name, () => {
                    this.actionHandler.handleAction(def, obj);
                }, def.style);
            }
            case 'TColorInput': {
                const value = this.resolveValue(def.text || def.value, obj, def);
                const container = this.renderer.renderColorInput(String(value || '#000000'));
                const colorInput = (container as any).colorInput as HTMLInputElement;
                const textInput = (container as any).textInput as HTMLInputElement;

                const updateValue = (newValue: string) => {
                    console.info(`[InspectorHost] TColorInput changed: ${newValue} for ${def.name}`);
                    const event = this.eventHandler.handleControlChange(def.name, newValue, obj, def);
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

                colorInput.oninput = () => {
                    textInput.value = colorInput.value;
                    updateValue(colorInput.value);
                };

                textInput.oninput = () => {
                    if (textInput.value.startsWith('#') && textInput.value.length === 7) {
                        colorInput.value = textInput.value;
                        updateValue(textInput.value);
                    }
                };

                textInput.onchange = () => {
                    updateValue(textInput.value);
                };

                return container;
            }
            case 'TActionParams': {
                const onUpdate = (prop: string, val: any) => {
                    const oldVal = PropertyHelper.getPropertyValue(obj, prop);
                    if (oldVal === val) return;

                    // Route through event handler to ensure persistence!
                    const event = this.eventHandler.handleControlChange(prop, val, obj, { name: prop, property: prop });

                    if (event) {
                        mediatorService.notifyDataChanged({
                            property: event.propertyName,
                            value: event.newValue,
                            oldValue: event.oldValue,
                            object: event.object
                        }, 'inspector');
                        if (this.onObjectUpdate) this.onObjectUpdate(event);
                    }
                    this.update(obj); // Refresh UI
                };
                const onAction = (actionDef: any) => {
                    this.actionHandler.handleAction(actionDef, obj);
                };
                return this.renderer.renderActionParams(def, obj, onUpdate, onAction);
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

    private resolveValue(expr: any, obj: any, def?: any): any {
        if (typeof expr !== 'string' || !expr.includes('${')) return expr;

        const context = InspectorContextBuilder.build(obj);

        // NEW: Inject template context if present
        if (def && (def.__template_item !== undefined)) {
            context.item = def.__template_item;
            context.value = def.__template_item.value !== undefined ? def.__template_item.value : def.__template_item;
            context.index = def.__template_index;
        }

        const result = ExpressionParser.interpolate(expr, context);

        if (expr.includes('BaseVar') || expr.includes('availableVariableFields')) {
            InspectorHost.logger.debug(`resolveValue("${expr}") -> "${result}"`);
        }

        // BUGFIX: Wenn das Ergebnis selbst ein ${...}-Template ist (z.B. ein Binding-Wert
        // wie "${currentUser.name}"), darf es NICHT erneut aufgelöst werden. Wir geben
        // den Rohwert als display-String zurück.
        // Dies verhindert die doppelte Template-Auflösung, die Binding-Werte zerstört.
        if (typeof result === 'string' && result.includes('${') && result !== expr) {
            InspectorHost.logger.debug(`resolveValue: Binding-Wert erkannt, Rohwert bewahrt: "${result}"`);
            return result;
        }

        // Wenn result leer/undefined ist aber der Ausdruck selectedObject.X enthielt,
        // prüfe ob der Rohwert selbst ein Template war
        if ((result === '' || result === undefined) && expr.includes('selectedObject.')) {
            const propMatch = expr.match(/\$\{selectedObject\.(\w+)\}/);
            if (propMatch) {
                const rawVal = PropertyHelper.getPropertyValue(obj, propMatch[1]);
                if (typeof rawVal === 'string' && rawVal.includes('${')) {
                    InspectorHost.logger.debug(`resolveValue: Rohwert aus Objekt bewahrt: "${rawVal}"`);
                    return rawVal;
                }
            }
        }

        return result;
    }

    private resolveRawValue(expr: any, obj: any, def?: any): any {
        if (typeof expr !== 'string' || !expr.includes('${')) return expr;

        const context = InspectorContextBuilder.build(obj);

        // NEW: Inject template context if present
        if (def && (def.__template_item !== undefined)) {
            context.item = def.__template_item;
            context.value = def.__template_item.value !== undefined ? def.__template_item.value : def.__template_item;
            context.index = def.__template_index;
        }

        const result = ExpressionParser.evaluateRaw(expr, context);

        if (expr.includes('BaseVar') || expr.includes('availableVariableFields')) {
            InspectorHost.logger.debug(`resolveRawValue("${expr}") ->`, result);
        }

        return result;
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

        // Dynamically populate _supportedEvents for the inspector
        if (!obj._supportedEvents || obj._supportedEvents.length === 0) {
            if (typeof obj.getEvents === 'function') {
                obj._supportedEvents = obj.getEvents();
            } else {
                try {
                    obj._supportedEvents = componentRegistry.getEvents(obj);
                } catch (e) {
                    InspectorHost.logger.warn('Could not determine events for object:', obj);
                }
            }
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
            InspectorHost.logger.warn(`Could not load events template: ${eventsFile}`, e);
            parent.innerHTML = '<div style="color: #666; font-style: italic;">Events konnten nicht geladen werden.</div>';
        }
    }

    /**
     * Clears the inspector
     */
    public clear(): void {
        if (this.container) this.container.innerHTML = '';
        this.selectedObject = null;
        // InspectorRegistry.clear(); // Removing this as it wipes handlers globally for all instances!
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
        InspectorHost.logger.info('Flow context updated (Legacy Compat)');
        // In the modular system, handlers can access nodes via ProjectRegistry if needed.
    }

    /**
     * Legacy: Forces an update of available actions in dropdowns.
     */
    public updateAvailableActions(_actions?: string[]): void {
        InspectorHost.logger.info('Updating available actions (Legacy Compat)');
        this.update();
    }

    /**
     * Legacy: Set editor reference.
     */
    public setEditor(_editor: any): void {
        InspectorHost.logger.info('Editor reference set (Legacy Compat)');
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
