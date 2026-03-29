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

        if (obj === null) {
            // Explizit leeren (z.B. beim Wechsel zum Flow-Editor)
            this.selectedObject = null;
            this.savedScrollTop = 0;
        } else if (obj) {
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
        header.style.alignItems = 'center';

        const selectContainer = document.createElement('div');
        selectContainer.style.display = 'flex';
        selectContainer.style.alignItems = 'center';
        selectContainer.style.gap = '8px';
        selectContainer.style.flex = '1';

        const type = document.createElement('span');
        type.style.color = '#888';
        type.style.fontSize = '10px';
        type.innerText = obj.className || obj.constructor?.name || 'Object';
        
        const select = document.createElement('select');
        select.style.cssText = 'flex: 1; min-width: 0; padding: 4px; background: #222; color: #fff; border: 1px solid #555; border-radius: 4px; font-size: 13px; font-weight: bold; cursor: pointer;';
        
        let allObjects: any[] = [];
        const activeStage = this.project.stages?.find(s => s.id === this.project.activeStageId);
        if (activeStage) {
            allObjects = [...(activeStage.objects || []), ...(activeStage.variables || [])];
        }
        const blueprintStage = this.project.stages?.find(s => s.type === 'blueprint');
        if (blueprintStage && activeStage?.type !== 'blueprint') {
             allObjects = [...allObjects, ...(blueprintStage.objects || []), ...(blueprintStage.variables || [])];
        }

        const uniqueObjects = Array.from(new Map(allObjects.map(o => [o.id, o])).values());
        
        uniqueObjects.sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(o => {
            const opt = document.createElement('option');
            opt.value = o.id;
            opt.textContent = o.name || o.id || 'Unbenannt';
            
            if (activeStage && !activeStage.objects?.find(ao => ao.id === o.id) && !activeStage.variables?.find(av => av.id === o.id)) {
                opt.textContent += ' (Global)';
            }
            if (o.id === obj.id) {
                opt.selected = true;
            }
            select.appendChild(opt);
        });

        select.onchange = () => {
            const selectedId = select.value;
            if (selectedId && (this as any).onObjectSelect) {
                (this as any).onObjectSelect(selectedId);
            }
        };

        selectContainer.appendChild(select);
        selectContainer.appendChild(type);
        header.appendChild(selectContainer);

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
        // NEU: Handler-Sektionen-Pfad (z.B. StageHandler)
        // Handler liefert InspectorSection[] → gleicher Rendering-Pfad wie IInspectable
        // =====================================================================
        const handler = InspectorRegistry.getHandler(obj);
        if (handler && typeof (handler as any).getSections === 'function') {
            const sections = (handler as any).getSections(obj, this.project);
            if (sections && sections.length > 0) {
                // Proxy: Alle Properties vom Original-Objekt durchreichen,
                // aber getInspectorSections/applyChange injizieren
                const stageObj = obj;
                const proxy = new Proxy(stageObj, {
                    get(target: any, prop: string) {
                        if (prop === 'getInspectorSections') return () => sections;
                        if (prop === 'applyChange') return (propertyName: string, newValue: any) => {
                            PropertyHelper.setPropertyValue(target, propertyName, newValue);
                            return propertyName === 'type';
                        };
                        return target[prop];
                    }
                });
                this.renderInspectableSections(proxy as any, parent);
                return;
            }
        }

        // =====================================================================
        // LEGACY: JSON-Template-Pfad (bestehende Komponenten ohne IInspectable)
        // =====================================================================
        // 1. Determine Template
        let inspectorFile = './inspector.json';

        // A. Priority: Specialized Handler
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
            const accentColor = groupColors[colorKey] || '#4da6ff';

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

            // --- Properties in der Card rendern (mit Inline-Gruppierung) ---
            const props = section.properties;
            let i = 0;
            while (i < props.length) {
                const propDef = props[i];

                // Prüfe ob eine Gruppe von inline-Properties beginnt
                if (propDef.inline && i + 1 < props.length && props[i + 1].inline) {
                    // Sammle max. 2 aufeinanderfolgende inline-Properties pro Zeile
                    const inlineRow = document.createElement('div');
                    inlineRow.style.cssText = 'display:flex;gap:8px;margin-bottom:4px;';

                    let count = 0;
                    while (i < props.length && props[i].inline && count < 2) {
                        const el = this.renderInspectableProperty(props[i], obj);
                        if (el) {
                            el.style.flex = '1';
                            el.style.marginBottom = '0';
                            inlineRow.appendChild(el);
                        }
                        i++;
                        count++;
                    }
                    body.appendChild(inlineRow);
                } else {
                    const el = this.renderInspectableProperty(propDef, obj);
                    if (el) body.appendChild(el);
                    i++;
                }
            }
        });
    }

    /**
     * Rendert eine einzelne Property-Definition für ein IInspectable Objekt.
     * Nutzt die bestehende Renderer-Infrastruktur, aber delegiert Änderungen
     * an obj.applyChange() statt an die Handler-Kette.
     */
    private renderInspectableProperty(propDef: any, obj: any): HTMLElement | null {
        const container = document.createElement('div');
        const isInline = !!propDef.inline;
        // Horizontales Layout: Label links, Eingabefeld rechts
        container.style.cssText = `display:flex;align-items:center;gap:${isInline ? '4' : '8'}px;margin-bottom:4px;`;

        // Button-Typ: spezieller Render-Pfad (volle Breite, kein Label daneben)
        if (propDef.type === 'button') {
            container.style.display = 'block'; // Buttons nehmen volle Breite
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

        // Info-Typ: Reines Anzeige-Element (z.B. Badge für globale Actions)
        if (propDef.type === 'info') {
            container.style.display = 'block';
            const info = document.createElement('div');
            info.textContent = propDef.label || '';
            // Custom Style oder Fallback
            if (propDef.style) {
                info.style.cssText = Object.entries(propDef.style)
                    .map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}:${v}`)
                    .join(';');
            } else {
                info.style.cssText = 'font-size:11px;color:#8c9eff;padding:4px 8px;border-radius:4px;background:rgba(63,81,181,0.3);border:1px solid rgba(63,81,181,0.5)';
            }
            container.appendChild(info);
            return container;
        }

        // Label (links, Breite abhängig von inline-Flag)
        if (propDef.label && propDef.type !== 'textarea') {
            const label = this.renderer.renderLabel(propDef.label);
            label.style.marginBottom = '0';
            label.style.flexShrink = '0';
            if (propDef.type === 'keyvalue') {
                // keyvalue: Label als Header in voller Breite (kein Truncation)
                label.style.whiteSpace = 'normal';
            } else if (isInline) {
                // Inline: Label nur so breit wie nötig
                label.style.whiteSpace = 'nowrap';
            } else {
                // Normal: Label feste Breite
                label.style.minWidth = '70px';
                label.style.maxWidth = '90px';
                label.style.whiteSpace = 'nowrap';
                label.style.overflow = 'hidden';
                label.style.textOverflow = 'ellipsis';
            }
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
                    const event = this.eventHandler.handleControlChange(
                        selectName, select.value, obj,
                        { ...propDef, property: propDef.name }
                    );
                    if (event) {
                        mediatorService.notifyDataChanged({
                            property: event.propertyName,
                            value: event.newValue,
                            oldValue: event.oldValue,
                            object: event.object
                        }, 'inspector');
                        if (this.onObjectUpdate) this.onObjectUpdate(event);
                    }
                }
                // Prüfe ob Sektionen sich ändern (z.B. Typ-Wechsel)
                if (typeof obj.applyChange === 'function') {
                    const needsReRender = obj.applyChange(propDef.name, select.value, currentValue);
                    if (needsReRender) {
                        this.update(obj);
                    }
                }
            };
            select.style.flex = '1';
            container.appendChild(select);
        } else if (propDef.type === 'boolean' || propDef.type === 'checkbox') {
            const cb = document.createElement('input');
            cb.type = 'checkbox';

            // CSS-String-Properties: fontWeight ('bold'/'normal'), fontStyle ('italic'/'normal')
            const isFontWeight = propDef.name === 'style.fontWeight';
            const isFontStyle = propDef.name === 'style.fontStyle';

            if (isFontWeight) {
                cb.checked = currentValue === 'bold' || currentValue === '700' || currentValue === '800' || currentValue === '900';
            } else if (isFontStyle) {
                cb.checked = currentValue === 'italic';
            } else {
                cb.checked = !!currentValue;
            }

            cb.onchange = () => {
                let newValue: any = cb.checked;
                if (isFontWeight) newValue = cb.checked ? 'bold' : 'normal';
                if (isFontStyle) newValue = cb.checked ? 'italic' : 'normal';

                if (this.eventHandler) {
                    const event = this.eventHandler.handleControlChange(
                        propDef.name, newValue, obj,
                        { ...propDef, property: propDef.name }
                    );
                    if (event) {
                        mediatorService.notifyDataChanged({
                            property: event.propertyName,
                            value: event.newValue,
                            oldValue: event.oldValue,
                            object: event.object
                        }, 'inspector');
                        if (this.onObjectUpdate) this.onObjectUpdate(event);
                    }
                }
            };
            container.appendChild(cb);
        } else if (propDef.type === 'color') {
            // Farbpicker: Nativer HTML5-Farbwähler + Textfeld
            const colorContainer = this.renderer.renderColorInput(String(currentValue || '#000000'));
            const colorInput = (colorContainer as any).colorInput as HTMLInputElement;
            const textInput = (colorContainer as any).textInput as HTMLInputElement;

            const updateColorValue = (newValue: string) => {
                if (this.eventHandler) {
                    const event = this.eventHandler.handleControlChange(
                        propDef.name, newValue, obj,
                        { ...propDef, property: propDef.name }
                    );
                    if (event) {
                        mediatorService.notifyDataChanged({
                            property: event.propertyName,
                            value: event.newValue,
                            oldValue: event.oldValue,
                            object: event.object
                        }, 'inspector');
                        if (this.onObjectUpdate) this.onObjectUpdate(event);
                    }
                }
            };

            colorInput.oninput = () => {
                textInput.value = colorInput.value;
                updateColorValue(colorInput.value);
            };

            textInput.oninput = () => {
                if (textInput.value.startsWith('#') && textInput.value.length === 7) {
                    colorInput.value = textInput.value;
                    updateColorValue(textInput.value);
                }
            };

            textInput.onchange = () => {
                updateColorValue(textInput.value);
            };

            colorContainer.style.flex = '1';
            container.appendChild(colorContainer);
        } else if (propDef.type === 'keyvalue') {
            // ─────────────────────────────────────────────
            // Key-Value-Editor: Eigenschafts-Änderungen
            // ─────────────────────────────────────────────
            container.style.display = 'block'; // Volle Breite, kein inline
            container.style.marginBottom = '8px';

            // Header: Label wird bereits von der Section-Property-Iteration gerendert,
            // daher hier KEINEN zusätzlichen Header setzen.

            // Hint
            if (propDef.hint) {
                const hint = document.createElement('div');
                hint.style.cssText = 'font-size:10px;color:#666;margin-bottom:6px;font-style:italic;';
                hint.textContent = propDef.hint;
                container.appendChild(hint);
            }

            // Aktuelles changes-Objekt lesen (direkt übergeben oder aus obj auslesen)
            const changes: Record<string, any> = propDef.value || {};
            const entries = Object.entries(changes);

            // Rows-Container
            const rowsContainer = document.createElement('div');
            rowsContainer.style.cssText = 'display:flex;flex-direction:column;gap:4px;';

            const self = this;

            // Hilfsfunktion: Changes in Action schreiben + Inspector aktualisieren
            const applyChanges = (newChanges: Record<string, any>) => {
                // Schreibe in den SSoT (Action-Definition)
                if (typeof obj.applyChange === 'function') {
                    obj.applyChange('changes', newChanges);
                } else {
                    PropertyHelper.setPropertyValue(obj, 'changes', newChanges);
                }
                // Visuelles Update triggern
                if (typeof obj.refreshVisuals === 'function') obj.refreshVisuals();
                // Inspector komplett neu rendern
                self.update(obj);
            };

            // Ziel-Objekt Properties auflösen (für Dropdown)
            let targetPropertyOptions: { name: string, label: string, type: string, options?: any[] }[] = [];
            if (obj.target && (obj as any).projectRef) {
                const project = (obj as any).projectRef;
                // Ziel-Objekt in allen Stages suchen
                let targetObj: any = null;
                for (const stage of (project.stages || [])) {
                    const found = (stage.objects || []).find((o: any) => o.name === obj.target || o.id === obj.target);
                    if (found) { targetObj = found; break; }
                    const foundVar = (stage.variables || []).find((v: any) => v.name === obj.target || v.id === obj.target);
                    if (foundVar) { targetObj = foundVar; break; }
                }
                if (targetObj?.className) {
                    const props = componentRegistry.getInspectorProperties({ className: targetObj.className });
                    targetPropertyOptions = props
                        .filter((p: any) => p.name && p.name !== 'name' && p.name !== 'id')
                        .map((p: any) => ({
                            name: p.name,
                            label: p.label || p.name,
                            type: p.type || 'string',
                            options: p.options
                        }));
                }
            }

            if (entries.length === 0) {
                const emptyHint = document.createElement('div');
                emptyHint.style.cssText = 'font-size:10px;color:#666;padding:6px 8px;background:rgba(255,255,255,0.03);border-radius:4px;text-align:center;font-style:italic;';
                emptyHint.textContent = 'Keine Eigenschafts-Änderungen definiert';
                rowsContainer.appendChild(emptyHint);
            } else {
                entries.forEach(([key, value]) => {
                    const row = document.createElement('div');
                    row.style.cssText = 'display:flex;align-items:center;gap:4px;padding:4px 6px;background:rgba(255,255,255,0.04);border-radius:4px;border:1px solid rgba(255,255,255,0.08);';

                    // Property-Typ-Info auflösen (mit Fallback auf propDef.valueType für spezielle Renderer wie negate)
                    const propInfo = targetPropertyOptions.find(p => p.name === key);
                    const propType = propDef.valueType || propInfo?.type || 'string';

                    // Property-Name (Dropdown wenn Properties verfügbar, sonst Freitext)
                    let keyElement: HTMLSelectElement | HTMLInputElement;
                    if (targetPropertyOptions.length > 0) {
                        const keySelect = document.createElement('select');
                        keySelect.title = 'Eigenschafts-Name';
                        keySelect.style.cssText = 'flex:1;padding:3px 6px;background:#2a2a3e;color:#e0d4f5;border:1px solid #444;border-radius:3px;font-size:11px;font-family:Consolas,monospace;min-width:60px;cursor:pointer;';
                        for (const propOpt of targetPropertyOptions) {
                            const opt = document.createElement('option');
                            opt.value = propOpt.name;
                            opt.textContent = `${propOpt.label} (${propOpt.name})`;
                            if (propOpt.name === key) opt.selected = true;
                            keySelect.appendChild(opt);
                        }
                        if (key && !targetPropertyOptions.find(p => p.name === key)) {
                            const customOpt = document.createElement('option');
                            customOpt.value = key;
                            customOpt.textContent = `${key} (benutzerdefiniert)`;
                            customOpt.selected = true;
                            keySelect.insertBefore(customOpt, keySelect.firstChild);
                        }
                        keySelect.onchange = () => {
                            const newKey = keySelect.value.trim();
                            if (!newKey || newKey === key) return;
                            const newChanges: Record<string, any> = {};
                            for (const [k, v] of Object.entries(changes)) {
                                newChanges[k === key ? newKey : k] = v;
                            }
                            applyChanges(newChanges);
                        };
                        keyElement = keySelect;
                    } else {
                        const keyInput = document.createElement('input');
                        keyInput.type = 'text';
                        keyInput.value = key;
                        keyInput.title = 'Eigenschafts-Name';
                        keyInput.style.cssText = 'flex:1;padding:3px 6px;background:#2a2a3e;color:#e0d4f5;border:1px solid #444;border-radius:3px;font-size:11px;font-family:Consolas,monospace;min-width:60px;';
                        keyInput.onchange = () => {
                            const newKey = keyInput.value.trim();
                            if (!newKey || newKey === key) return;
                            const newChanges: Record<string, any> = {};
                            for (const [k, v] of Object.entries(changes)) {
                                newChanges[k === key ? newKey : k] = v;
                            }
                            applyChanges(newChanges);
                        };
                        keyElement = keyInput;
                    }

                    // Doppelpunkt-Trenner
                    const sep = document.createElement('span');
                    sep.textContent = ':';
                    sep.style.cssText = 'color:#888;font-size:11px;font-weight:bold;flex-shrink:0;';

                    // --- Value-Feld: typ-abhängig ---
                    let valElement: HTMLElement;

                    if (propType === 'boolean') {
                        // Boolean → Checkbox-Toggle
                        const cbLabel = document.createElement('label');
                        cbLabel.style.cssText = 'flex:1;display:flex;align-items:center;gap:6px;cursor:pointer;padding:2px 6px;';
                        const cb = document.createElement('input');
                        cb.type = 'checkbox';
                        cb.checked = value === true || value === 'true';
                        cb.style.cssText = 'width:14px;height:14px;accent-color:#4fc3f7;cursor:pointer;';
                        const cbText = document.createElement('span');
                        cbText.textContent = cb.checked ? 'Ja' : 'Nein';
                        cbText.style.cssText = 'font-size:11px;color:#4fc3f7;';
                        cb.onchange = () => {
                            cbText.textContent = cb.checked ? 'Ja' : 'Nein';
                            const newChanges = { ...changes };
                            newChanges[key] = cb.checked;
                            applyChanges(newChanges);
                        };
                        cbLabel.appendChild(cb);
                        cbLabel.appendChild(cbText);
                        valElement = cbLabel;

                    } else if (propType === 'select' && propInfo?.options) {
                        // Select → Dropdown
                        const valSelect = document.createElement('select');
                        valSelect.style.cssText = 'flex:1;padding:3px 6px;background:#2a2a3e;color:#4fc3f7;border:1px solid #444;border-radius:3px;font-size:11px;cursor:pointer;';
                        for (const opt of propInfo.options) {
                            const optEl = document.createElement('option');
                            if (typeof opt === 'object' && opt.value !== undefined) {
                                optEl.value = opt.value;
                                optEl.textContent = opt.label || opt.value;
                            } else {
                                optEl.value = String(opt);
                                optEl.textContent = String(opt);
                            }
                            if (String(opt?.value ?? opt) === String(value)) optEl.selected = true;
                            valSelect.appendChild(optEl);
                        }
                        // Falls aktueller Wert nicht in Optionen
                        if (value && !propInfo.options.find((o: any) => String(o?.value ?? o) === String(value))) {
                            const customOpt = document.createElement('option');
                            customOpt.value = String(value);
                            customOpt.textContent = `${value} (aktuell)`;
                            customOpt.selected = true;
                            valSelect.insertBefore(customOpt, valSelect.firstChild);
                        }
                        valSelect.onchange = () => {
                            const newChanges = { ...changes };
                            newChanges[key] = valSelect.value;
                            applyChanges(newChanges);
                        };
                        valElement = valSelect;

                    } else if (propType === 'color') {
                        // Color → Farbwähler
                        const colorRow = document.createElement('div');
                        colorRow.style.cssText = 'flex:1;display:flex;align-items:center;gap:4px;';
                        const colorInput = document.createElement('input');
                        colorInput.type = 'color';
                        colorInput.value = String(value || '#000000');
                        colorInput.style.cssText = 'width:24px;height:20px;border:none;cursor:pointer;background:transparent;';
                        const colorText = document.createElement('input');
                        colorText.type = 'text';
                        colorText.value = String(value || '');
                        colorText.style.cssText = 'flex:1;padding:3px 6px;background:#2a2a3e;color:#4fc3f7;border:1px solid #444;border-radius:3px;font-size:11px;font-family:Consolas,monospace;';
                        colorInput.oninput = () => {
                            colorText.value = colorInput.value;
                            const newChanges = { ...changes };
                            newChanges[key] = colorInput.value;
                            applyChanges(newChanges);
                        };
                        colorText.onchange = () => {
                            colorInput.value = colorText.value;
                            const newChanges = { ...changes };
                            newChanges[key] = colorText.value;
                            applyChanges(newChanges);
                        };
                        colorRow.appendChild(colorInput);
                        colorRow.appendChild(colorText);
                        valElement = colorRow;

                    } else if (propType === 'number') {
                        // Number → Number-Input
                        const numInput = document.createElement('input');
                        numInput.type = 'number';
                        numInput.value = String(value ?? '');
                        numInput.title = 'Numerischer Wert';
                        numInput.style.cssText = 'flex:1;padding:3px 6px;background:#2a2a3e;color:#4fc3f7;border:1px solid #444;border-radius:3px;font-size:11px;font-family:Consolas,monospace;min-width:60px;';
                        numInput.onchange = () => {
                            const newChanges = { ...changes };
                            newChanges[key] = Number(numInput.value) || 0;
                            applyChanges(newChanges);
                        };
                        valElement = numInput;

                    } else {
                        // String (Default) → Text-Input
                        const valInput = document.createElement('input');
                        valInput.type = 'text';
                        valInput.value = String(value);
                        valInput.title = 'Wert';
                        valInput.style.cssText = 'flex:1;padding:3px 6px;background:#2a2a3e;color:#4fc3f7;border:1px solid #444;border-radius:3px;font-size:11px;font-family:Consolas,monospace;min-width:60px;';
                        valInput.onchange = () => {
                            const newChanges = { ...changes };
                            const raw = valInput.value.trim();
                            const num = Number(raw);
                            newChanges[key] = (!isNaN(num) && raw !== '') ? num : raw;
                            applyChanges(newChanges);
                        };
                        valElement = valInput;
                    }

                    // Löschen-Button
                    const delBtn = document.createElement('button');
                    delBtn.textContent = '🗑️';
                    delBtn.title = 'Diese Eigenschaft entfernen';
                    delBtn.style.cssText = 'padding:2px 4px;background:#d11a2a;color:white;border:none;border-radius:3px;cursor:pointer;font-size:10px;flex-shrink:0;';
                    delBtn.onclick = () => {
                        const newChanges = { ...changes };
                        delete newChanges[key];
                        applyChanges(newChanges);
                    };

                    row.appendChild(keyElement);
                    row.appendChild(sep);
                    row.appendChild(valElement);
                    row.appendChild(delBtn);
                    rowsContainer.appendChild(row);
                });
            }

            container.appendChild(rowsContainer);

            // Add-Button
            const addBtn = document.createElement('button');
            addBtn.textContent = '+ Eigenschaft hinzufügen';
            addBtn.style.cssText = 'margin-top:6px;width:100%;padding:5px 10px;background:#2e7d32;color:white;border:none;border-radius:4px;cursor:pointer;font-size:11px;';
            addBtn.onclick = () => {
                // Erste freie Property als Default wählen
                const usedKeys = Object.keys(changes);
                const freeOpt = targetPropertyOptions.find(p => !usedKeys.includes(p.name));
                const defaultKey = freeOpt ? freeOpt.name : '';
                const newChanges = { ...changes, [defaultKey]: '' };
                applyChanges(newChanges);
            };
            container.appendChild(addBtn);

            return container;
        } else if (propDef.type === 'image_picker' || propDef.type === 'audio_picker' || propDef.type === 'video_picker') {
            // ─────────────────────────────────────────────
            // Media-Picker: Textfeld + Browse-Button
            // ─────────────────────────────────────────────
            const pickerIcon = propDef.type === 'image_picker' ? '🖼️'
                             : propDef.type === 'audio_picker' ? '🔊'
                             : '🎬';
            const pickerAction = propDef.type === 'image_picker' ? 'browseImage'
                               : propDef.type === 'audio_picker' ? 'browseAudio'
                               : 'browseVideo';

            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'display:flex;gap:4px;flex:1;align-items:center;';

            const input = this.renderer.renderEdit(String(currentValue));
            input.style.flex = '1';
            if (propDef.name) input.name = propDef.name + 'Input';
            input.onchange = () => {
                if (this.eventHandler) {
                    const event = this.eventHandler.handleControlChange(
                        input.name, input.value, obj,
                        { ...propDef, property: propDef.name }
                    );
                    if (event) {
                        mediatorService.notifyDataChanged({
                            property: event.propertyName,
                            value: event.newValue,
                            oldValue: event.oldValue,
                            object: event.object
                        }, 'inspector');
                        if (this.onObjectUpdate) this.onObjectUpdate(event);
                    }
                }
            };

            const browseBtn = document.createElement('button');
            browseBtn.textContent = pickerIcon;
            browseBtn.title = propDef.type === 'image_picker' ? 'Bild auswählen'
                            : propDef.type === 'audio_picker' ? 'Audio auswählen'
                            : 'Video auswählen';
            browseBtn.style.cssText = 'padding:4px 8px;background:#2a2a3e;color:#fff;border:1px solid #555;border-radius:4px;cursor:pointer;font-size:14px;flex-shrink:0;transition:all 0.15s;';
            browseBtn.onmouseenter = () => { browseBtn.style.borderColor = '#89b4fa'; browseBtn.style.background = '#3a3a4e'; };
            browseBtn.onmouseleave = () => { browseBtn.style.borderColor = '#555'; browseBtn.style.background = '#2a2a3e'; };
            browseBtn.onclick = () => {
                if (this.actionHandler) {
                    (this.actionHandler as any).handleAction(
                        { action: pickerAction, property: propDef.name },
                        obj
                    );
                }
            };

            wrapper.appendChild(input);
            wrapper.appendChild(browseBtn);

            // 📋 Paste-Button (nur für image_picker)
            if (propDef.type === 'image_picker') {
                const pasteBtn = document.createElement('button');
                pasteBtn.textContent = '📋';
                pasteBtn.title = 'Bild aus Zwischenablage einfügen (Base64)';
                pasteBtn.style.cssText = 'padding:4px 8px;background:#2a2a3e;color:#fff;border:1px solid #555;border-radius:4px;cursor:pointer;font-size:14px;flex-shrink:0;transition:all 0.15s;';
                pasteBtn.onmouseenter = () => { pasteBtn.style.borderColor = '#a6e3a1'; pasteBtn.style.background = '#2a3e2e'; };
                pasteBtn.onmouseleave = () => { pasteBtn.style.borderColor = '#555'; pasteBtn.style.background = '#2a2a3e'; };
                pasteBtn.onclick = async () => {
                    try {
                        const clipboardItems = await navigator.clipboard.read();
                        let imageBlob: Blob | null = null;
                        for (const item of clipboardItems) {
                            const imageType = item.types.find(t => t.startsWith('image/'));
                            if (imageType) {
                                imageBlob = await item.getType(imageType);
                                break;
                            }
                        }
                        if (!imageBlob) {
                            alert('Kein Bild in der Zwischenablage gefunden.');
                            return;
                        }
                        // Blob → Base64 Data-URL
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            const dataUrl = reader.result as string;
                            input.value = dataUrl;
                            input.dispatchEvent(new Event('change'));
                            // Visuelles Feedback
                            pasteBtn.textContent = '✅';
                            setTimeout(() => { pasteBtn.textContent = '📋'; }, 1500);
                        };
                        reader.readAsDataURL(imageBlob);
                    } catch (e: any) {
                        alert('Fehler beim Lesen der Zwischenablage: ' + e.message);
                    }
                };
                wrapper.appendChild(pasteBtn);
            }

            container.appendChild(wrapper);
        } else {
            // Text / Number / String / Textarea Input
            let input: HTMLInputElement | HTMLTextAreaElement;
            if (propDef.type === 'textarea') {
                input = this.renderer.renderTextArea(String(currentValue));
            } else {
                input = this.renderer.renderEdit(String(currentValue));
            }
            input.style.flex = '1';
            if (propDef.readonly) input.readOnly = true;
            // Konvention: Input name = '{propertyName}Input' (E2E-Kompatibilität)
            if (propDef.name) input.name = propDef.name + 'Input';
            
            const submitChange = () => {
                const newVal = propDef.type === 'number' ? Number(input.value) : input.value;
                // Delegiere an Handler-Kette (FlowNodeHandler → Refactoring, PropertyHelper etc.)
                if (this.eventHandler) {
                    const event = this.eventHandler.handleControlChange(
                        input.name, newVal, obj,
                        { ...propDef, property: propDef.name }
                    );
                    if (event) {
                        mediatorService.notifyDataChanged({
                            property: event.propertyName,
                            value: event.newValue,
                            oldValue: event.oldValue,
                            object: event.object
                        }, 'inspector');
                        if (this.onObjectUpdate) this.onObjectUpdate(event);
                    }
                }
            };
            
            input.onchange = submitChange;
            
            if (propDef.type === 'textarea') {
                const wrapper = document.createElement('div');
                wrapper.style.display = 'flex';
                wrapper.style.flexDirection = 'column';
                wrapper.style.gap = '4px';
                wrapper.style.width = '100%';
                
                const btn = document.createElement('button');
                btn.textContent = 'Übernehmen';
                btn.title = 'Text speichern und anzeigen';
                btn.style.cssText = 'padding: 4px 8px; background: #2e7d32; color: #fff; border: 1px solid #1b5e20; border-radius: 3px; cursor: pointer; font-size: 11px; align-self: flex-end;';
                btn.onclick = submitChange;
                
                wrapper.appendChild(input);
                wrapper.appendChild(btn);
                container.appendChild(wrapper);
            } else {
                container.appendChild(input);
            }
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
                        this.update(obj);
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
        // KRITISCH: EventHandler muss die neue Projekt-Referenz bekommen,
        // sonst zeigt er auf das alte Projekt (z.B. nach newProject/loadProject).
        // Ohne diesen Fix werden Meta-Felder (gameName, author) auf dem alten Projekt gesetzt.
        if (this.eventHandler) this.eventHandler.setProject(project);
    }

    // Handlers/Callbacks for Editor.ts
    public onObjectUpdate: ((event?: any) => void) | null = null;
    public onProjectUpdate: (() => void) | null = null;
    public onObjectDelete: ((obj: any) => void) | null = null;
    public onObjectSelect: ((id: string | null) => void) | null = null;
}
