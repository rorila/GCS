import { ReactiveRuntime } from '../runtime/ReactiveRuntime';
import { GameProject } from '../model/types';
import { DialogManager } from './DialogManager';
import { TInspectorTemplate } from '../components/TInspectorTemplate';
import { TaskEditor } from './TaskEditor';
import { serviceRegistry } from '../services/ServiceRegistry';
import { RefactoringManager } from './RefactoringManager';
import { projectRegistry } from '../services/ProjectRegistry';
import { imageService } from '../services/ImageService'; // Added import
import { actionRegistry } from '../runtime/ActionRegistry';
import { changeRecorder } from '../services/ChangeRecorder';

type InspectorTab = 'properties' | 'events';

/**
 * JSONInspector - Inspector built from JSON definition
 * Uses ReactiveRuntime for automatic UI updates
 */
export class JSONInspector {
    private runtime: ReactiveRuntime;
    private container: HTMLElement;
    private inspectorObjects: any[] = [];
    private project: GameProject | null = null;
    private dialogManager: DialogManager | null = null;
    private activeTab: InspectorTab = 'properties';
    private layoutConfig: any = null; // Custom inspector layout configuration

    // Flow Editor context - when set, selector shows flow elements instead of stage objects
    private flowElements: any[] = [];
    private isFlowContext: boolean = false;

    // Callbacks
    public onObjectUpdate?: () => void;
    public onObjectDelete?: (obj: any) => void;
    public onProjectUpdate?: () => void;
    public onObjectSelect?: (objectId: string | null) => void;
    public onFlowObjectSelect?: (objectId: string | null) => void; // For flow element selection
    public onSave?: () => void;
    private editor: any | null = null;

    constructor(containerId: string) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container ${containerId} not found`);
        }
        this.container = container;
        this.runtime = new ReactiveRuntime();


        // Load custom layout configuration
        this.loadLayoutConfig();
    }

    /**
     * Loads the inspector layout configuration from server
     */
    private async loadLayoutConfig(): Promise<void> {
        try {
            const response = await fetch('./editor/inspector_layout.json');
            if (response.ok) {
                this.layoutConfig = await response.json();
            }
        } catch (error) {
            console.log('[JSONInspector] No custom layout found, using defaults');
        }
    }

    /**
     * Sets the project reference (for accessing tasks, actions, variables)
     */
    public setProject(project: GameProject) {
        this.project = project;
        this.runtime.registerVariable('project', project);

        // Reset flow context when a new project is set
        this.isFlowContext = false;
        this.flowElements = [];

        // Register available tasks as variable
        const taskNames = project.tasks?.map(t => t.name) || [];
        this.runtime.registerVariable('availableTasks', taskNames);

        // Register available actions as variable
        const actionNames = project.actions?.map(a => a.name) || [];
        this.runtime.registerVariable('availableActions', actionNames);

        this.runtime.registerVariable('getAllActionTypes', () => {
            return actionRegistry.getAllMetadata().map(m => ({ value: m.type, label: m.label }));
        });


        // Always trigger update to refresh object dropdown
        const currentObject = this.runtime.getVariable('selectedObject');
        // If an object is selected, update it; otherwise update with project (Stage)
        this.update(currentObject || project);
    }

    /**
     * Sets the editor reference
     */
    public setEditor(editor: any) {
        this.editor = editor;
    }

    /**
     * Sets the dialog manager
     */
    public setDialogManager(dialogManager: DialogManager) {
        this.dialogManager = dialogManager;
    }

    /**
     * Updates the list of available actions (e.g. for dropdowns)
     */
    public updateAvailableActions(actions: string[]) {
        this.runtime.setVariable('availableActions', actions);
    }

    /**
     * Sets the Flow Editor context - when set, selector shows flow elements instead of stage objects
     * @param elements Array of FlowElements from the current flow diagram
     */
    public setFlowContext(elements: any[] | null) {
        if (elements === null) {
            this.isFlowContext = false;
            this.flowElements = [];
        } else {
            this.isFlowContext = true;
            this.flowElements = elements;
        }

        // Force re-render to update the selector dropdown
        const currentObject = this.runtime.getVariable('selectedObject');
        // Fallback to project (Stage) if no object selected
        this.update(currentObject || this.project);
    }

    /**
     * Loads inspector UI from JSON definition
     */
    public async loadFromJSON(jsonData: any) {

        // Keep objects as plain JSON to preserve custom properties (action, taskName, etc.)
        this.inspectorObjects = jsonData.objects;

        // Register all inspector objects
        this.inspectorObjects.forEach(obj => {
            this.runtime.registerObject(obj.name, obj, false);
        });

        // Register selectedObject variable (initially null)
        this.runtime.registerVariable('selectedObject', null);

        // Setup reactive bindings
        this.setupBindings();

        // Initial render
        this.render();

    }

    /**
     * Sets up reactive bindings for all inspector objects
     */
    private setupBindings() {
        let bindingCount = 0;

        const processObject = (obj: any) => {
            // Bind all properties containing ${...}
            Object.keys(obj).forEach(prop => {
                const value = (obj as any)[prop];

                if (typeof value === 'string' && value.includes('${')) {
                    this.runtime.bind(obj, prop, value);
                    bindingCount++;
                }

                // Check nested style properties
                if (prop === 'style' && typeof value === 'object') {
                    Object.keys(value).forEach(styleProp => {
                        const styleValue = value[styleProp];
                        if (typeof styleValue === 'string' && styleValue.includes('${')) {
                            this.runtime.bind(value, styleProp, styleValue);
                            bindingCount++;
                        }
                    });
                }
            });

            // Process nested _rowItems (from TForEach with rowLayout)
            if (obj._rowItems && Array.isArray(obj._rowItems)) {
                obj._rowItems.forEach((item: any) => processObject(item));
            }
        };

        this.inspectorObjects.forEach(obj => processObject(obj));

    }

    /**
     * Updates the inspector with a new selected object
     */
    public async update(object: any) {
        // CRITICAL: Clear previous bindings and objects to prevent memory leaks and log floods
        this.runtime.clear();

        // Re-register required base variables after clear
        if (this.project) {
            this.runtime.registerVariable('project', this.project);
            this.runtime.registerVariable('availableTasks', this.project.tasks?.map(t => t.name) || []);
            this.runtime.registerVariable('availableActions', this.project.actions?.map(a => a.name) || []);
            this.runtime.registerVariable('getAllActionTypes', () => {
                return actionRegistry.getAllMetadata().map(m => ({ value: m.type, label: m.label }));
            });
            const activeStage = this.project.stages?.find(s => s.id === this.project?.activeStageId);
            this.runtime.registerVariable('activeStage', activeStage || null);
        }

        let inspectorFile = './inspector.json';

        // Check if this is a TInspectorTemplate - use special designer
        if (object && object.className === 'TInspectorTemplate') {
            this.runtime.setVariable('selectedObject', object);
            this.renderInspectorDesigner(object as TInspectorTemplate);
            return;
        }

        // Detect if this is a Project (has meta property) or a regular Object
        const isProject = object && object.meta !== undefined;

        if (isProject) {
            // Load Stage inspector from JSON
            inspectorFile = './inspector_stage.json';

            // Registriere die aktive Stage als Variable für den Inspector
            if (this.project) {
                const activeStage = this.project.stages?.find(s => s.id === this.project?.activeStageId);
                this.runtime.setVariable('activeStage', activeStage || null);
            }

            try {
                // Add version parameter to bypass browser cache
                const response = await fetch(`${inspectorFile}?v=${Date.now()}`);
                const inspectorJSON = await response.json();

                // Clear and reload inspector objects with TForEach expansion
                this.inspectorObjects = this.expandForEach(inspectorJSON.objects, object);

                // Re-register all inspector objects
                this.inspectorObjects.forEach(obj => {
                    this.runtime.registerObject(obj.name, obj, false);
                });

                // Setup bindings for new objects
                this.setupBindings();

                // Update selectedObject variable with the project
                this.runtime.setVariable('selectedObject', object);

                // Re-render the inspector UI
                this.render();

            } catch (error) {
                console.error('[JSONInspector] Failed to load inspector:', error);
            }
            return;
        } else if (object) {
            // --- GENERIC INSPECTOR LOADING ---
            // We prioritize dynamic generation via getInspectorProperties() to ensure
            // that ALL properties defined in code are visible, without relying on static JSONs.

            inspectorFile = './inspector.json'; // Default fallback

            // 1. Determine Inspector File (mainly for Header/Layout or Special Tabs)
            if (this.activeTab === 'events') {
                inspectorFile = './inspector_events.json';
            } else if (this.activeTab === 'properties') {
                // For Properties, we use the minimal header and generate the rest dynamically
                inspectorFile = './inspector_header.json';

                // Special handling for Flow Elements if they don't support getInspectorProperties fully yet
                // (Though the goal is they SHOULD)
                const type = object.getType ? object.getType() : (object.type || '');
                if (type === 'Task') {
                    inspectorFile = './inspector_task.json'; // Keep specific task layout for now if complex
                } else if (type === 'Action') {
                    inspectorFile = './inspector_action.json';
                }

                // FORCE HEADER only if we have dynamic properties to show
                // BUT: Keep Specific Templates (Task/Action) if they were already selected!
                if (typeof object.getInspectorProperties === 'function') {
                    if (inspectorFile !== './inspector_task.json' && inspectorFile !== './inspector_action.json') {
                        inspectorFile = './inspector_header.json';
                    }
                }
            }

            // 2. Load Static JSON (Header/Framework)
            let staticObjects: any[] = [];
            try {
                if (inspectorFile) {
                    const response = await fetch(`${inspectorFile}?v=${Date.now()}`);
                    if (response.ok) {
                        const inspectorJSON = await response.json();
                        staticObjects = this.expandForEach(inspectorJSON.objects, object);
                    }
                }
            } catch (error) {
                console.error('[JSONInspector] Failed to load inspector JSON:', error);
            }

            // 3. Generate Dynamic UI
            let dynamicObjects: any[] = [];
            const hasDynamicProps = typeof (object as any).getInspectorProperties === 'function';
            let useDynamic = false;

            if (this.activeTab === 'properties' && hasDynamicProps) {
                try {
                    console.log('[JSONInspector] Generating dynamic UI for:', object.name || object.className);
                    dynamicObjects = this.generateUIFromProperties(object, true);
                    console.log('[JSONInspector] Generated dynamic objects count:', dynamicObjects.length);
                    // Only switch to dynamic if we actually got results (all TWindows should return props)
                    if (dynamicObjects.length > 0) {
                        useDynamic = true;
                    }
                } catch (err) {
                    console.error('[JSONInspector] Error generating properties:', err);
                }
            }

            // FALLBACK: If dynamic generation yielded nothing, but we expected it, 
            // OR if we didn't try dynamic, we might need to load inspector.json content if header only?
            // Actually, if we used inspector_header.json (staticObjects has header), and dynamicObjects is empty,
            // the user sees empty inspector.
            // Force load inspector.json properties if dynamic failed/empty?
            if (!useDynamic && this.activeTab === 'properties' && inspectorFile !== './inspector.json') {
                console.warn('[JSONInspector] Dynamic generation failed/empty. Falling back to inspector.json');
                try {
                    const fbRes = await fetch(`./inspector.json?v=${Date.now()}`);
                    const fbJson = await fbRes.json();
                    const fbObjs = this.expandForEach(fbJson.objects, object);
                    // Filter out Title/Name if header already has them? 
                    // Or just append everything (might duplicate title).
                    // Simplify: Just use what we got.
                    staticObjects = fbObjs; // Replace header with full inspector
                } catch (e) { console.error('Fallback failed', e); }
            }

            // Detect definition for Variables
            if ((object as any).variableType || (object as any).value !== undefined) {
                // It's likely a ProjectVariable
                const variableEvents = [
                    'onValueChanged', 'onValueEmpty',
                    'onThresholdReached', 'onThresholdLeft', 'onThresholdExceeded',
                    'onTriggerEnter', 'onTriggerExit',
                    'onFinished', 'onTick', 'onHour', 'onMinute', 'onSecond',
                    'onMinReached', 'onMaxReached', 'onInside',
                    'onItemCreated', 'onItemUpdated', 'onItemDeleted', 'onItemRead', 'onNotFound', 'onCleared'
                ];
                (object as any)._supportedEvents = variableEvents.map(evt => ({ key: evt }));
            }

            // 4. Combine & Render
            // Static (Title) + Dynamic (Properties)
            this.inspectorObjects = [...staticObjects, ...dynamicObjects];

            // Register
            this.inspectorObjects.forEach(obj => {
                this.runtime.registerObject(obj.name, obj, false);
            });

            // Events Fallback Logic (if strictly needed for virtual property)
            if (!object._supportedEvents) {
                const events = typeof (object as any).getEvents === 'function'
                    ? (object as any).getEvents()
                    : ['onClick', 'onDragStart', 'onDragEnd', 'onDrop'];
                (object as any)._supportedEvents = events.map((evt: string) => ({ key: evt }));
            }

            this.setupBindings();
            this.runtime.setVariable('selectedObject', object);
            this.render();
            return;
        }
    }

    /**
     * Renders the Inspector Designer for TInspectorTemplate objects
     */
    private renderInspectorDesigner(template: TInspectorTemplate): void {
        this.container.innerHTML = '';

        // Header
        const header = document.createElement('div');
        header.style.cssText = 'font-weight:bold;padding:12px;background:#333;border-bottom:1px solid #444;color:#fff';
        header.innerHTML = '📋 Inspector Layout Designer';
        this.container.appendChild(header);

        // Toolbar
        const toolbar = document.createElement('div');
        toolbar.style.cssText = 'display:flex;gap:4px;padding:8px;background:#2a2a2a;border-bottom:1px solid #444;flex-wrap:wrap';

        const exportBtn = document.createElement('button');
        exportBtn.innerHTML = '💾 Export';
        exportBtn.style.cssText = 'padding:6px 10px;background:#0e639c;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px';
        exportBtn.onclick = () => this.exportInspectorLayout(template);
        toolbar.appendChild(exportBtn);

        const importBtn = document.createElement('button');
        importBtn.innerHTML = '📂 Import';
        importBtn.style.cssText = 'padding:6px 10px;background:#0e639c;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px';
        importBtn.onclick = () => this.importInspectorLayout(template);
        toolbar.appendChild(importBtn);

        const loadDefaultBtn = document.createElement('button');
        loadDefaultBtn.innerHTML = '🔄 Default';
        loadDefaultBtn.style.cssText = 'padding:6px 10px;background:#4caf50;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px';
        loadDefaultBtn.title = 'Lade Standard-Layout';
        loadDefaultBtn.onclick = () => this.loadDefaultLayout(template);
        toolbar.appendChild(loadDefaultBtn);

        // Layout version selector
        const versionLabel = document.createElement('span');
        versionLabel.innerText = 'Version:';
        versionLabel.style.cssText = 'color:#888;font-size:11px;margin-left:8px;align-self:center';
        toolbar.appendChild(versionLabel);

        const versionSelect = document.createElement('select');
        versionSelect.style.cssText = 'padding:4px 8px;background:#444;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px';

        const versions = [
            { file: 'layout_minimal.json', label: '📦 Minimal' },
            { file: 'layout_designer.json', label: '🎨 Designer' },
            { file: 'layout_developer.json', label: '🔧 Entwickler' }
        ];

        versions.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.file;
            opt.text = v.label;
            versionSelect.appendChild(opt);
        });

        versionSelect.onchange = () => this.loadLayoutVersion(template, versionSelect.value);
        toolbar.appendChild(versionSelect);

        this.container.appendChild(toolbar);

        // Groups section
        const groupsHeader = document.createElement('div');
        groupsHeader.style.cssText = 'font-size:11px;color:#888;padding:8px;border-bottom:1px solid #333';
        groupsHeader.innerText = 'GRUPPEN';
        this.container.appendChild(groupsHeader);

        const groupsList = document.createElement('div');
        groupsList.style.cssText = 'padding:8px;display:flex;flex-direction:column;gap:4px';

        template.layoutConfig.groups.forEach((group, idx) => {
            const row = this.createGroupRow(group, idx, template);
            groupsList.appendChild(row);
        });
        this.container.appendChild(groupsList);

        // Properties section
        const propsHeader = document.createElement('div');
        propsHeader.style.cssText = 'font-size:11px;color:#888;padding:8px;border-top:1px solid #444;border-bottom:1px solid #333';
        propsHeader.innerText = 'PROPERTIES';
        this.container.appendChild(propsHeader);

        const propsList = document.createElement('div');
        propsList.style.cssText = 'padding:8px;display:flex;flex-direction:column;gap:4px;overflow-y:auto;flex:1';

        const sortedProps = Object.values(template.layoutConfig.properties)
            .sort((a, b) => a.order - b.order);

        sortedProps.forEach((propConfig, idx) => {
            const row = this.createPropertyRow(propConfig, idx, template);
            propsList.appendChild(row);
        });
        this.container.appendChild(propsList);
    }

    /**
     * Creates a group row for the designer
     */
    private createGroupRow(group: any, _index: number, template: TInspectorTemplate): HTMLElement {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:4px;padding:6px;background:#333;border-radius:4px';
        row.draggable = true;

        const handle = document.createElement('span');
        handle.innerHTML = '☰';
        handle.style.cssText = 'cursor:grab;color:#666';
        row.appendChild(handle);

        const labelInput = document.createElement('input');
        labelInput.type = 'text';
        labelInput.value = group.label;
        labelInput.style.cssText = 'flex:1;background:#444;border:none;color:#fff;padding:4px;border-radius:2px;font-size:12px';
        labelInput.onchange = () => {
            group.label = labelInput.value;
            if (this.onObjectUpdate) this.onObjectUpdate();
        };
        row.appendChild(labelInput);

        const collapseBtn = document.createElement('button');
        collapseBtn.innerHTML = group.collapsed ? '▶' : '▼';
        collapseBtn.style.cssText = 'background:none;border:none;color:#888;cursor:pointer;font-size:10px';
        collapseBtn.onclick = () => {
            group.collapsed = !group.collapsed;
            this.renderInspectorDesigner(template);
        };
        row.appendChild(collapseBtn);

        return row;
    }

    /**
     * Creates a property row for the designer
     */
    private createPropertyRow(propConfig: any, _index: number, template: TInspectorTemplate): HTMLElement {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:4px;padding:6px;background:#333;border-radius:4px';
        row.draggable = true;

        const handle = document.createElement('span');
        handle.innerHTML = '☰';
        handle.style.cssText = 'cursor:grab;color:#666';
        row.appendChild(handle);

        const visBtn = document.createElement('button');
        visBtn.innerHTML = propConfig.visible ? '👁' : '👁‍🗨';
        visBtn.style.cssText = 'background:none;border:none;cursor:pointer;opacity:' + (propConfig.visible ? '1' : '0.4');
        visBtn.onclick = () => {
            propConfig.visible = !propConfig.visible;
            this.renderInspectorDesigner(template);
            if (this.onObjectUpdate) this.onObjectUpdate();
        };
        row.appendChild(visBtn);

        const labelInput = document.createElement('input');
        labelInput.type = 'text';
        labelInput.value = propConfig.label;
        labelInput.style.cssText = 'flex:1;background:#444;border:none;color:#fff;padding:4px;border-radius:2px;font-size:11px;min-width:60px';
        labelInput.onchange = () => {
            propConfig.label = labelInput.value;
            if (this.onObjectUpdate) this.onObjectUpdate();
        };
        row.appendChild(labelInput);

        const typeSpan = document.createElement('span');
        typeSpan.innerHTML = this.getPropertyTypeIcon(propConfig.type);
        typeSpan.style.cssText = 'font-size:10px;color:#888';
        typeSpan.title = propConfig.type;
        row.appendChild(typeSpan);

        const styleBtn = document.createElement('button');
        styleBtn.innerHTML = '🎨';
        styleBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:12px';
        styleBtn.title = 'Style bearbeiten';
        styleBtn.onclick = () => this.openPropertyStyleEditor(propConfig, template);
        row.appendChild(styleBtn);

        const groupSelect = document.createElement('select');
        groupSelect.style.cssText = 'background:#444;border:none;color:#fff;padding:2px;border-radius:2px;font-size:10px';
        template.layoutConfig.groups.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.text = g.label;
            opt.selected = g.id === propConfig.groupId;
            groupSelect.appendChild(opt);
        });
        groupSelect.onchange = () => {
            propConfig.groupId = groupSelect.value;
            if (this.onObjectUpdate) this.onObjectUpdate();
        };
        row.appendChild(groupSelect);

        return row;
    }

    /**
     * Get icon for property type
     */
    private getPropertyTypeIcon(type: string): string {
        switch (type) {
            case 'string': return '📝';
            case 'number': return '🔢';
            case 'boolean': return '☑️';
            case 'color': return '🎨';
            case 'select': return '📋';
            case 'image_picker': return '🖼️'; // Added image_picker icon
            default: return '❓';
        }
    }

    /**
     * Opens style editor modal for a property
     */
    private openPropertyStyleEditor(propConfig: any, _template: TInspectorTemplate): void {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1000;display:flex;justify-content:center;align-items:center';

        const modal = document.createElement('div');
        modal.style.cssText = 'background:#2a2a2a;border:1px solid #444;padding:16px;border-radius:8px;min-width:300px';

        const style = propConfig.style || {};
        modal.innerHTML = `
            <div style="font-weight:bold;margin-bottom:12px;color:#fff">Style: ${propConfig.label}</div>
            <div style="display:flex;flex-direction:column;gap:8px">
                <label style="display:flex;align-items:center;gap:8px;color:#ccc;font-size:12px">
                    <span style="width:100px">Textfarbe:</span>
                    <input type="color" id="style-color" value="${style.color || '#ffffff'}" style="flex:1;background:#333;border:none">
                </label>
                <label style="display:flex;align-items:center;gap:8px;color:#ccc;font-size:12px">
                    <span style="width:100px">Schriftgröße:</span>
                    <input type="number" id="style-fontSize" value="${parseInt(style.fontSize || '12')}" min="8" max="24" style="flex:1;background:#333;border:none;color:#fff;padding:4px">
                </label>
                <label style="display:flex;align-items:center;gap:8px;color:#ccc;font-size:12px">
                    <span style="width:100px">Hintergrund:</span>
                    <input type="color" id="style-bgColor" value="${style.backgroundColor || '#333333'}" style="flex:1;background:#333;border:none">
                </label>
            </div>
            <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
                <button id="style-cancel" style="padding:6px 12px;background:#444;color:#fff;border:none;border-radius:4px;cursor:pointer">Abbrechen</button>
                <button id="style-save" style="padding:6px 12px;background:#0e639c;color:#fff;border:none;border-radius:4px;cursor:pointer">Speichern</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        modal.querySelector('#style-cancel')?.addEventListener('click', () => overlay.remove());
        modal.querySelector('#style-save')?.addEventListener('click', () => {
            const colorInput = modal.querySelector('#style-color') as HTMLInputElement;
            const fontSizeInput = modal.querySelector('#style-fontSize') as HTMLInputElement;
            const bgColorInput = modal.querySelector('#style-bgColor') as HTMLInputElement;

            propConfig.style = {
                color: colorInput.value,
                fontSize: fontSizeInput.value + 'px',
                backgroundColor: bgColorInput.value
            };

            if (this.onObjectUpdate) this.onObjectUpdate();
            overlay.remove();
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
    }

    /**
     * Exports the inspector layout to JSON file
     */
    private exportInspectorLayout(template: TInspectorTemplate): void {
        const json = JSON.stringify(template.layoutConfig, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'inspector_layout.json';
        a.click();

        URL.revokeObjectURL(url);
    }

    /**
     * Imports inspector layout from a JSON file
     */
    private importInspectorLayout(template: TInspectorTemplate): void {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            try {
                const text = await file.text();
                const config = JSON.parse(text);

                // Validate basic structure
                if (!config.version || !config.groups || !config.properties) {
                    alert('Ungültiges Layout-Format. Benötigt: version, groups, properties');
                    return;
                }

                template.layoutConfig = config;

                // IMPORTANT: Also update global layoutConfig so it applies to ALL objects
                this.layoutConfig = config;

                console.log('[JSONInspector] Layout imported:', file.name);
                console.log('[JSONInspector] Layout config properties:', Object.keys(config.properties).length);
                console.log('[JSONInspector] Global layoutConfig updated - will apply to all objects');

                // Re-render to show new layout
                this.renderInspectorDesigner(template);
                if (this.onObjectUpdate) {
                    console.log('[JSONInspector] Calling onObjectUpdate callback');
                    this.onObjectUpdate();
                }
            } catch (error) {
                console.error('[JSONInspector] Import error:', error);
                alert('Fehler beim Importieren: ' + (error as Error).message);
            }
        };

        input.click();
    }

    /**
     * Loads the default inspector layout from server
     */
    private async loadDefaultLayout(template: TInspectorTemplate): Promise<void> {
        try {
            const response = await fetch('./editor/inspector_layout.json');
            if (!response.ok) {
                throw new Error('Konnte Standard-Layout nicht laden');
            }

            const config = await response.json();
            template.layoutConfig = config;
            console.log('[JSONInspector] Default layout loaded');

            // Re-render to show new layout
            this.renderInspectorDesigner(template);
            if (this.onObjectUpdate) this.onObjectUpdate();
        } catch (error) {
            console.error('[JSONInspector] Load default error:', error);
            alert('Fehler beim Laden des Standard-Layouts: ' + (error as Error).message);
        }
    }

    /**
     * Loads a specific layout version from the layouts folder
     */
    private async loadLayoutVersion(template: TInspectorTemplate, filename: string): Promise<void> {
        try {
            const response = await fetch(`./editor/layouts/${filename}`);
            if (!response.ok) {
                throw new Error(`Konnte Layout ${filename} nicht laden`);
            }

            const config = await response.json();
            template.layoutConfig = config;

            // Also update global layoutConfig for all objects
            this.layoutConfig = config;

            console.log('[JSONInspector] Layout version loaded:', config.name || filename);
            console.log('[JSONInspector] Global layoutConfig updated');

            // Re-render to show new layout
            this.renderInspectorDesigner(template);
            if (this.onObjectUpdate) this.onObjectUpdate();
        } catch (error) {
            console.error('[JSONInspector] Load layout version error:', error);
            alert('Fehler beim Laden: ' + (error as Error).message);
        }
    }
    private generateUIFromProperties(object: any, isMerging: boolean = false): any[] {
        const properties = object.getInspectorProperties();
        const uiObjects: any[] = [];

        // Title - only if not merging with static JSON
        if (!isMerging) {
            uiObjects.push({
                className: 'TLabel',
                name: 'TitleLabel',
                text: object.name || 'Object',
                style: { fontSize: 16, fontWeight: 'bold', color: '#fff', marginBottom: 16 }
            });
        }

        // Group properties by group
        const grouped: Map<string, typeof properties> = new Map();
        properties.forEach((prop: any) => {
            const group = prop.group || 'General';
            if (!grouped.has(group)) {
                grouped.set(group, []);
            }
            grouped.get(group)!.push(prop);
        });

        // Render each group
        grouped.forEach((props, groupName) => {
            console.log(`[JSONInspector] Rendering group: ${groupName} with ${props.length} properties`);
            // Group header
            uiObjects.push({
                className: 'TLabel',
                name: `${groupName}Header`,
                text: groupName.toUpperCase(),
                style: { fontSize: 10, fontWeight: 'bold', color: '#888', marginTop: 12, marginBottom: 6 }
            });

            // Properties in group
            props.forEach((prop: any, idx: number) => {
                // Debug: Log property processing
                console.log(`[JSONInspector] Processing prop: ${prop.name} (Group: ${groupName})`);

                // Debug: Log layoutConfig state for first property
                if (idx === 0 && groupName === 'Geometry') {
                    console.log('[JSONInspector] layoutConfig state:', this.layoutConfig ? 'loaded' : 'null');
                    console.log('[JSONInspector] Looking for prop:', prop.name, '-> found:', this.layoutConfig?.properties?.[prop.name]);
                }

                // Check layout config for this property
                const layoutProp = this.layoutConfig?.properties?.[prop.name];

                // Skip if visibility is false in layout
                if (layoutProp?.visible === false) {
                    return;
                }

                // Use custom label from layout or default
                const label = layoutProp?.label || prop.label;

                // Apply custom styles from layout
                const labelStyle: any = { fontSize: 12, color: '#aaa' };
                if (layoutProp?.style) {
                    if (layoutProp.style.color) labelStyle.color = layoutProp.style.color;
                    if (layoutProp.style.fontSize) labelStyle.fontSize = parseInt(layoutProp.style.fontSize);
                    if (layoutProp.style.backgroundColor) labelStyle.backgroundColor = layoutProp.style.backgroundColor;
                }

                // Label
                uiObjects.push({
                    className: 'TLabel',
                    name: `${prop.name}Label`,
                    text: `${label}:`,
                    style: labelStyle,
                    readOnly: prop.readOnly // Propagate readOnly flag
                });

                // Input based on type
                const inputName = `${prop.name}Input`;
                const binding = `\${selectedObject.${prop.name}}`;

                if (prop.type === 'number') {
                    uiObjects.push({
                        className: 'TNumberInput',
                        name: inputName,
                        value: binding,
                        min: 0,
                        step: 0.1
                    });
                } else if (prop.type === 'string') {
                    uiObjects.push({
                        className: 'TEdit',
                        name: inputName,
                        text: binding
                    });
                } else if (prop.type === 'boolean') {
                    uiObjects.push({
                        className: 'TCheckbox',
                        name: inputName,
                        checked: binding,
                        label: prop.label
                    });
                } else if (prop.type === 'color') {
                    // Color picker with transparency option
                    uiObjects.push({
                        className: 'TPanel',
                        name: `${prop.name}Wrapper`,
                        style: { display: 'flex', gap: '4px', marginBottom: '8px', padding: '0' },
                        children: [
                            {
                                className: 'TColorPicker',
                                name: inputName,
                                color: binding,
                                style: { flex: 1, marginBottom: '0' }
                            },
                            {
                                className: 'TButton',
                                name: `${prop.name}ClearBtn`,
                                caption: '🚫',
                                style: { width: '32px', padding: '0', fontSize: '14px', backgroundColor: '#444' },
                                action: 'setTransparent',
                                actionData: { property: prop.name }
                            }
                        ]
                    });
                } else if (prop.type === 'select') {
                    let options = prop.options || [];

                    // Dynamic Source from ProjectRegistry
                    if (prop.source) {
                        if (prop.source === 'variables') {
                            const vars = projectRegistry.getVariables();
                            options = vars.map(v => v.name);
                        } else if (prop.source === 'tasks') {
                            options = projectRegistry.getTasks().map(t => t.name);
                        } else if (prop.source === 'objects') {
                            options = projectRegistry.getObjects().map(o => o.name);
                        } else if (prop.source === 'flow') {
                            options = projectRegistry.getFlowObjects().map(f => f.name);
                        } else if (prop.source === 'availableActions') {
                            // Use the filtered list from Editor.ts
                            options = this.runtime.getVariable('availableActions') || [];
                        }
                    }

                    uiObjects.push({
                        className: 'TDropdown',
                        name: inputName,
                        options: options,
                        selectedValue: binding
                    });
                } else if (prop.type === 'image_picker') {
                    // Image picker: Text input + Browse button
                    uiObjects.push({
                        className: 'TPanel',
                        name: `${prop.name}Wrapper`,
                        style: { display: 'flex', gap: '4px', marginBottom: '8px', padding: '0' },
                        children: [
                            {
                                className: 'TEdit',
                                name: inputName,
                                text: binding,
                                style: { flex: 1, marginBottom: '0' }
                            },
                            {
                                className: 'TButton',
                                name: `${prop.name}BrowseBtn`,
                                caption: '...',
                                action: 'browseImage',
                                actionData: { property: prop.name, inputName: inputName },
                                style: { width: '32px', padding: '4px', marginTop: '0' }
                            },
                            {
                                className: 'TButton',
                                name: `${prop.name}UploadBtn`,
                                caption: '⬆️',
                                action: 'uploadLocalImage',
                                actionData: { property: prop.name, inputName: inputName },
                                style: { width: '32px', padding: '4px', marginTop: '0' }
                            }
                        ]
                    });
                } else if (prop.type === 'button') {
                    uiObjects.push({
                        className: 'TButton',
                        name: prop.name,
                        caption: prop.label,
                        action: prop.action,
                        actionData: prop.actionData,
                        style: prop.style || { backgroundColor: '#0e639c', color: '#fff', marginTop: 12 }
                    });
                }

                // Check if this is an embedded/linked element (read-only)
                const isLinked = object.data?.isLinked || object.data?.isEmbeddedInternal;
                const isActionOrTask = (typeof object.getType === 'function') && (object.getType() === 'Action' || object.getType() === 'Task');

                // Mark the input UI object as read-only based on the property definition
                // OR if the object is linked and it's NOT a dynamic parameter (param_ prefix)
                // SMART-SYNC EXCEPTION: Allow editing linked Actions/Tasks
                const uiInput = uiObjects[uiObjects.length - 1];
                if (uiInput) {
                    const isParameter = prop.name.startsWith('param_');
                    const isReadOnlyProp = prop.readOnly === true;

                    if (isReadOnlyProp) {
                        uiInput.readOnly = true;
                    } else if (isLinked && !isParameter) {
                        // Allow editing if it's an action/task (Smart-Sync)
                        uiInput.readOnly = !isActionOrTask;
                    } else {
                        uiInput.readOnly = false;
                    }
                }
            });
        });

        // Check if this is an embedded/linked element (read-only)
        const isEmbeddedElement = object.data?.isLinked || object.data?.isEmbeddedInternal;

        if (isEmbeddedElement) {
            const isActionOrTask = (typeof object.getType === 'function') && (object.getType() === 'Action' || object.getType() === 'Task');
            const scope = object.data?.scope || 'stage';
            const scopeEmoji = scope === 'global' ? '🌎 Global' : '🎭 Stage';

            // Show scope notice instead of read-only block if it's an action/task
            uiObjects.push({
                className: 'TLabel',
                name: 'EmbeddedNoticeLabel',
                text: isActionOrTask
                    ? `🔗 Verlinktes Element (${scopeEmoji}) - Änderungen synchronisieren`
                    : '🔒 Eingebettetes Element (schreibgeschützt)',
                style: { fontSize: 11, color: isActionOrTask ? '#4caf50' : '#ff9800', marginTop: 16, fontStyle: 'italic' }
            });
        } else {
            // Delete button (Skip for Stages)
            if (object.constructor.name !== 'TStage' && object.constructor.name !== 'TFlowStage') {
                uiObjects.push({
                    className: 'TButton',
                    name: 'DeleteButton',
                    caption: '🗑️ Delete Object',
                    style: { backgroundColor: '#c82333', color: '#fff', marginTop: 16 }
                });
            }
        }

        return uiObjects;
    }

    /**
     * Expands TForEach directives into actual UI objects
     */
    private expandForEach(objects: any[], selectedObject: any): any[] {
        const expanded: any[] = [];

        objects.forEach(obj => {
            if (obj.className === 'TForEach') {
                // Evaluate source expression
                const sourceData = this.evaluateExpression(obj.source, selectedObject);

                if (!sourceData) {
                    console.warn(`[JSONInspector] TForEach source "${obj.source}" is empty or undefined`);
                    return;
                }

                // Convert to array of items
                let items: any[] = [];
                if (Array.isArray(sourceData)) {
                    items = sourceData;
                } else if (typeof sourceData === 'object') {
                    // Convert object to array of {key, value} pairs
                    items = Object.entries(sourceData).map(([key, value]) => ({ key, value }));
                }

                // Apply filter if specified
                if (obj.filter && items.length > 0) {
                    items = items.filter((item: any) => {
                        try {
                            const filterFn = new Function('item', 'selectedObject', `return ${obj.filter}`);
                            return filterFn(item, selectedObject);
                        } catch (e) {
                            console.error(`[JSONInspector] Filter error:`, e);
                            return true;
                        }
                    });
                }

                // Render template for each item
                items.forEach((item: any, index: number) => {
                    // Check if rowLayout is enabled - wrap template items in a horizontal row
                    if (obj.rowLayout) {
                        const rowWrapper: any = {
                            className: 'TPanel',
                            name: `ForEachRow_${index}`,
                            style: {
                                display: 'flex',
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: '8px',
                                marginBottom: '4px'
                            },
                            _isRowWrapper: true,
                            _rowItems: [] as any[]
                        };

                        obj.template.forEach((templateObj: any) => {
                            const instance = JSON.parse(JSON.stringify(templateObj));
                            this.replaceTemplateVars(instance, item, index);
                            rowWrapper._rowItems.push(instance);
                        });

                        expanded.push(rowWrapper);
                    } else {
                        // Original behavior - add items individually
                        obj.template.forEach((templateObj: any) => {
                            const instance = JSON.parse(JSON.stringify(templateObj)); // Deep clone

                            // Replace template variables
                            this.replaceTemplateVars(instance, item, index);

                            expanded.push(instance);
                        });
                    }
                });
            } else {
                // Regular object, add as-is
                expanded.push(obj);
            }
        });

        return expanded;
    }

    /**
     * Evaluates an expression in the context of selectedObject
     */
    private evaluateExpression(expr: string, selectedObject: any): any {
        try {
            // Add safety check for selectedObject
            if (!selectedObject) return undefined;

            const fn = new Function('selectedObject', 'project', 'activeStage', 'projectRegistry', `
                try {
                    return ${expr.startsWith('${') ? expr.slice(2, -1) : expr};
                } catch(e) {
                    return undefined;
                }
            `);
            const activeStage = this.runtime.getVariable('activeStage');
            return fn(selectedObject, this.project, activeStage, projectRegistry);
        } catch (e) {
            return undefined;
        }
    }

    /**
     * Replaces template variables in an object
     */
    private replaceTemplateVars(obj: any, item: any, index: number) {
        // Determine emoji based on available metadata
        let uiEmoji = '';
        const scope = (item.scope || 'global').toLowerCase();
        const uiScope = item.uiScope; // Metadata from ProjectRegistry

        if (uiScope === 'library') uiEmoji = '📚';
        else if (scope === 'global') uiEmoji = '🌎';
        else if (scope === 'local' || scope.startsWith('stage:')) uiEmoji = '🎭';
        else if (scope.startsWith('task:') || scope.startsWith('action:')) uiEmoji = '📍';
        else uiEmoji = '🎭'; // Default for other local scopes

        const replacements: any = {
            '${key}': item.key || index,
            '${value}': item.value || item,
            '${item.name}': item.name,
            '${item.type}': item.type,
            '${item.scope}': item.scope || 'global',
            '${item.uiEmoji}': uiEmoji,
            '${item.isPublic}': item.isPublic || false,
            '${item.publicIcon}': item.isPublic ? '🌐' : '',
            '${item.defaultValue}': item.defaultValue,
            '${item.description}': item.description || '',
            '${item.usageCount}': item.usageCount || 0,
            '${item.className}': item.className || '',
            '${item}': item,
            '${index}': index
        };

        // Recursively replace in all string properties
        const replace = (target: any) => {
            if (typeof target === 'string') {
                let result = target;
                Object.entries(replacements).forEach(([key, value]) => {
                    result = result.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(value));
                });
                return result;
            } else if (typeof target === 'object' && target !== null) {
                Object.keys(target).forEach(key => {
                    target[key] = replace(target[key]);
                });
            }
            return target;
        };

        replace(obj);
    }

    /**
     * Renders the inspector UI
     */
    private render() {
        // Clear container
        this.container.innerHTML = '';
        console.log('%c[JSONInspector] Rendering UI v2.0.1', 'color: #007bff; font-weight: bold');

        // ===== Object Selector Dropdown =====
        const selectorWrapper = document.createElement('div');
        selectorWrapper.className = 'object-selector';
        selectorWrapper.style.padding = '8px';
        selectorWrapper.style.borderBottom = '1px solid #444';
        selectorWrapper.style.marginBottom = '8px';

        const selectorLabel = document.createElement('label');
        selectorLabel.innerText = 'Objekt (v2.0.1):';
        selectorLabel.style.fontSize = '11px';
        selectorLabel.style.color = '#888';
        selectorLabel.style.marginRight = '8px';

        const selector = document.createElement('select');
        selector.style.flex = '1';
        selector.style.padding = '6px 8px';
        selector.style.backgroundColor = '#333';
        selector.style.color = '#fff';
        selector.style.border = '1px solid #555';
        selector.style.borderRadius = '4px';
        selector.style.fontSize = '12px';
        selector.style.cursor = 'pointer';
        selector.style.width = '100%';
        selector.style.marginTop = '4px';

        // Add first option based on context
        const firstOption = document.createElement('option');
        firstOption.value = '';
        if (this.isFlowContext) {
            firstOption.text = '📋 Flow Diagram';
            selectorLabel.innerText = 'Flow-Element:';
        } else {
            firstOption.text = '🎬 Stage / Game Settings';
        }
        selector.appendChild(firstOption);

        // Add objects based on context
        if (this.isFlowContext) {
            // Show Flow elements
            this.flowElements.forEach((el: any) => {
                const option = document.createElement('option');
                option.value = el.name; // FlowElements use id as identifier (name property returns id)
                // Get display name (Name with capital N returns the actual display name)
                const displayName = el.Name || el.name;
                // Icon based on type
                const type = el.getType ? el.getType() : 'Unknown';
                let icon = '⬜';
                if (type === 'Task') icon = '📋';
                else if (type === 'Action') icon = '⚡';
                else if (type === 'Start') icon = '🟢';
                // Mark linked elements
                if (el.data?.isLinked || el.data?.isEmbeddedInternal) icon = '🔗' + icon;
                option.text = `${icon} ${displayName}`;
                selector.appendChild(option);
            });
        } else {
            // Show Stage objects
            const objects = projectRegistry.getObjects();
            objects.forEach((obj: any) => {
                const option = document.createElement('option');
                option.value = obj.id;
                // Show icon based on type
                const icon = this.getObjectIcon(obj);
                option.text = `${icon} ${obj.name}`;
                selector.appendChild(option);
            });
        }

        // Select current object
        const selectedObject = this.runtime.getVariable('selectedObject');
        const isProjectSelected = selectedObject && selectedObject.meta !== undefined;
        if (isProjectSelected) {
            selector.value = '';
        } else if (selectedObject) {
            selector.value = selectedObject.id || '';
        }

        // Handle selection change
        selector.onchange = () => {
            const objectId = selector.value || null;
            if (this.isFlowContext) {
                // Flow context - notify FlowEditor to select the node
                if (this.onFlowObjectSelect) {
                    this.onFlowObjectSelect(objectId);
                }
            } else {
                // Stage context - existing behavior
                if (this.onObjectSelect) {
                    this.onObjectSelect(objectId);
                }
            }
        };

        selectorWrapper.appendChild(selectorLabel);
        selectorWrapper.appendChild(selector);
        this.container.appendChild(selectorWrapper);

        // ===== Rest of Inspector =====
        if (!selectedObject) {
            this.container.innerHTML += '<div style="padding:1rem; color:#888;">Select an object or stage</div>';
            return;
        }

        // isProjectSelected already defined above
        const isProject = isProjectSelected;

        // Render Tabs (only for objects, not for Stage/Project)
        if (!isProject) {
            const tabsContainer = document.createElement('div');
            tabsContainer.className = 'inspector-tabs';
            tabsContainer.style.display = 'flex';
            tabsContainer.style.borderBottom = '1px solid #444';
            tabsContainer.style.marginBottom = '0.5rem';

            const createTab = (id: InspectorTab, label: string) => {
                const btn = document.createElement('button');
                btn.className = `inspector-tab ${this.activeTab === id ? 'active' : ''}`;
                btn.innerText = label;
                btn.style.flex = '1 1 auto';
                btn.style.minWidth = '60px';
                btn.style.padding = '6px 4px';
                btn.style.background = this.activeTab === id ? '#333' : '#2a2a2a';
                btn.style.border = 'none';
                btn.style.color = this.activeTab === id ? 'white' : '#888';
                btn.style.cursor = 'pointer';
                btn.style.fontSize = '0.8rem';
                btn.style.borderBottom = this.activeTab === id ? '2px solid #007bff' : 'none';

                btn.onclick = () => {
                    this.activeTab = id;
                    // Call update() to reload JSON for new tab
                    const currentObject = this.runtime.getVariable('selectedObject');
                    if (currentObject) {
                        this.update(currentObject);
                    } else {
                        this.render();
                    }
                };
                return btn;
            };

            tabsContainer.appendChild(createTab('properties', 'Properties'));
            tabsContainer.appendChild(createTab('events', 'Events'));


            this.container.appendChild(tabsContainer);
        }

        // Create wrapper for tab content
        const wrapper = document.createElement('div');
        wrapper.className = 'json-inspector';
        wrapper.style.width = '100%';
        wrapper.style.height = '100%';
        wrapper.style.overflow = 'auto';
        wrapper.style.padding = '8px';

        // Render content based on active tab
        if (isProject || this.activeTab === 'properties') {
            this.renderPropertiesTab(wrapper);
        } else if (this.activeTab === 'events') {
            // Events and Actions are now JSON-based, render like properties
            this.renderPropertiesTab(wrapper);
        }

        this.container.appendChild(wrapper);
    }

    /**
     * Checks if an inspector object is visible based on its expression
     */
    private isObjectVisible(obj: any): boolean {
        if (obj.visible === undefined) return true;

        const val = obj.visible;

        // Handle string representation ("true", "false", or expression "${...}")
        if (typeof val === 'string') {
            if (val === 'true') return true;
            if (val === 'false') return false;

            if (val.startsWith('${')) {
                const resolved = this.runtime.evaluate(val);
                return resolved === 'true' || (resolved !== 'false' && !!resolved);
            }

            // Any other non-empty string is considered true, 
            // but typical evaluatable values that are falsy are handled above.
            return val !== '' && val !== 'undefined' && val !== 'null';
        }

        // Handle boolean visible property
        if (typeof val === 'boolean') return val;

        return true;
    }

    /**
     * Renders the Properties tab content
     */
    private renderPropertiesTab(wrapper: HTMLElement) {
        // Group label+input pairs for inline rendering
        const groupedObjects: any[] = [];
        for (let i = 0; i < this.inspectorObjects.length; i++) {
            const obj = this.inspectorObjects[i];
            const nextObj = this.inspectorObjects[i + 1];

            // Check if this is a label followed by an input
            // Note: TPanel with _isRowWrapper should NOT be grouped as input (it's a row from TForEach)
            const isNextInput = nextObj && (
                nextObj.className === 'TEdit' ||
                nextObj.className === 'TNumberInput' ||
                nextObj.className === 'TColorPicker' ||
                nextObj.className === 'TDropdown' ||
                nextObj.className === 'TCheckbox' ||
                nextObj.className === 'TSelect' ||
                (nextObj.className === 'TPanel' && !nextObj._isRowWrapper)
            );

            if (obj.className === 'TLabel' && isNextInput) {
                // Group them together
                groupedObjects.push({ label: obj, input: nextObj, type: 'inline' });
                i++; // Skip next object
            } else {
                // Standalone object
                groupedObjects.push({ object: obj, type: 'standalone' });
            }
        }

        // Render grouped objects
        groupedObjects.forEach(group => {
            if (group.type === 'inline') {
                const row = this.renderInlineRow(group.label, group.input);
                if (row) wrapper.appendChild(row);
            } else {
                const el = this.renderObject(group.object);
                if (el) wrapper.appendChild(el);
            }
        });

        this.container.appendChild(wrapper);
    }

    /**
     * Renders a label+input pair inline
     */
    private renderInlineRow(label: any, input: any): HTMLElement | null {
        // Visibility check - if either is hidden, hide the whole row
        if (!this.isObjectVisible(label) || !this.isObjectVisible(input)) return null;

        // Properties that should NEVER have a binding toggle (ID, Name, etc.)
        const propName = input.name.replace('Input', '');
        const blacklist = ['name', 'id', 'className', 'type', 'order', 'groupId'];
        const isBlacklisted = blacklist.includes(propName);

        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.marginBottom = '6px';
        row.style.gap = '4px';

        // Label (left side)
        const labelEl = document.createElement('label');
        labelEl.innerText = label.text || '';
        labelEl.style.minWidth = '80px';
        labelEl.style.flexShrink = '0';
        labelEl.style.fontSize = label.style?.fontSize ? `${label.style.fontSize}px` : '11px';
        labelEl.style.color = label.style?.color || '#ccc';

        if (label.style?.backgroundColor) {
            labelEl.style.backgroundColor = label.style.backgroundColor;
            labelEl.style.padding = '2px 4px';
            labelEl.style.borderRadius = '2px';
        }

        // --- Binding Toggle Feature ---
        const inputWrapper = document.createElement('div');
        inputWrapper.style.display = 'flex';
        inputWrapper.style.flex = '1';
        inputWrapper.style.alignItems = 'center';
        inputWrapper.style.gap = '4px';

        // Determine if property is currently bound
        const currentVal = input.checked ?? input.value ?? input.text ?? input.selectedValue ?? input.color ?? '';
        let isBound = typeof currentVal === 'string' && currentVal.startsWith('${');

        // Store original type to allow switching back
        if (!input._originalClassName) {
            input._originalClassName = input.className;
        }

        const renderCurrentInput = () => {
            inputWrapper.innerHTML = '';

            const prevClass = input.className;
            if (isBound) {
                // In binding mode, render a SELECT dropdown instead of a text input with datalist
                const select = document.createElement('select');
                select.style.cssText = 'flex: 1; padding: 4px 6px; background-color: #333; color: #fff; border: 1px solid #555; border-radius: 3px; font-size: 11px; cursor: pointer;';

                // Get current value
                const currentBinding = (typeof currentVal === 'string' && currentVal.startsWith('${'))
                    ? currentVal
                    : (typeof input.text === 'string' && input.text.startsWith('${') ? input.text : '');

                // Get all suggestions
                const suggestions = this.getBindingSuggestions();

                // Add empty option for manual entry
                const emptyOpt = document.createElement('option');
                emptyOpt.value = '';
                emptyOpt.text = '-- Binding auswählen --';
                select.appendChild(emptyOpt);

                // Add all suggestions as options
                suggestions.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s;
                    opt.text = s;
                    opt.selected = s === currentBinding;
                    select.appendChild(opt);
                });

                // If current value is not in suggestions, add it as an option
                if (currentBinding && !suggestions.includes(currentBinding)) {
                    const customOpt = document.createElement('option');
                    customOpt.value = currentBinding;
                    customOpt.text = currentBinding + ' (custom)';
                    customOpt.selected = true;
                    select.appendChild(customOpt);
                }

                select.onchange = () => {
                    if (select.value) {
                        input.text = select.value;
                        this.handleObjectChange(input);
                    }
                };

                inputWrapper.appendChild(select);
                input.className = prevClass;
                return; // Early return - rest of the function is for non-bound mode
            }

            const inputEl = this.renderInput(input);

            // Clean up temporary flag
            if (input.noEval) delete input.noEval;

            if (inputEl) {
                inputEl.style.flex = '1';
                inputWrapper.appendChild(inputEl);
            }

            input.className = prevClass;

            // Only add Toggle Button if not blacklisted
            if (!isBlacklisted) {
                const toggle = document.createElement('button');
                toggle.innerHTML = '<i>f</i><sub>(x)</sub>';
                toggle.title = isBound ? 'Zurück zum Standard-Eingabefeld' : 'Als Ausdruck/Bindung bearbeiten';
                toggle.style.padding = '2px 4px';
                toggle.style.fontSize = '10px';
                toggle.style.backgroundColor = isBound ? '#4a90e2' : '#444';
                toggle.style.color = '#fff';
                toggle.style.border = '1px solid #666';
                toggle.style.borderRadius = '3px';
                toggle.style.cursor = 'pointer';
                toggle.style.minWidth = '28px';
                toggle.style.transition = 'opacity 0.2s';

                // Entschärfung: Verstecke Button standardmäßig, außer er ist aktiv
                const updateToggleVisibility = (isHovering: boolean) => {
                    if (isBound) {
                        toggle.style.opacity = '1';
                        toggle.style.visibility = 'visible';
                    } else {
                        toggle.style.opacity = isHovering ? '0.6' : '0';
                        toggle.style.visibility = isHovering ? 'visible' : 'hidden';
                    }
                };

                updateToggleVisibility(false);

                toggle.onclick = (e) => {
                    e.stopPropagation();
                    isBound = !isBound;

                    if (isBound) {
                        input.className = 'TEdit';
                        input.noEval = true; // Prevent evaluation to show raw binding string
                        input.text = '${';
                    } else {
                        input.className = input._originalClassName;
                        // Clear conflicting properties so handleObjectChange picks the right one
                        delete input.text;

                        if (input.className === 'TCheckbox') {
                            input.checked = false;
                            delete input.value;
                        }
                        else if (input.className === 'TNumberInput') input.value = 0;
                        else if (input.className === 'TColorPicker') input.color = '#ffffff';
                        // For others, text might be valid or value might be valid
                    }

                    renderCurrentInput();
                    this.handleObjectChange(input);
                };

                // Add hover events to the entire ROW to show the toggle
                row.onmouseenter = () => updateToggleVisibility(true);
                row.onmouseleave = () => updateToggleVisibility(false);

                inputWrapper.appendChild(toggle);
            }
        };

        renderCurrentInput();

        row.appendChild(labelEl);
        row.appendChild(inputWrapper);

        return row;
    }

    /**
     * Renders just the input element (without wrapper)
     */
    private renderInput(obj: any): HTMLElement | null {
        const className = obj.className;

        if (className === 'TEdit') {
            const input = document.createElement('input');
            input.type = 'text';
            // Handle variable placeholders - resolve via runtime
            let textValue = (obj.text !== undefined && obj.text !== null) ? String(obj.text) : '';
            if (textValue.startsWith('${') && !obj.noEval) {
                const resolved = this.runtime.evaluate(textValue);
                textValue = resolved !== undefined && resolved !== null ? String(resolved) : '';
            }
            input.value = textValue;
            input.style.flex = '1';
            input.style.padding = '4px 6px';
            input.style.backgroundColor = '#333';
            input.style.color = '#fff';
            input.style.border = '1px solid #555';
            input.style.borderRadius = '3px';
            input.style.fontSize = '11px';

            input.onchange = () => {
                obj.text = input.value;
                this.handleObjectChange(obj);
            };

            if (obj.readOnly) {
                input.disabled = true;
                input.style.opacity = '0.6';
                input.style.cursor = 'not-allowed';
            }

            return input;
        }
        else if (className === 'TNumberInput') {
            const input = document.createElement('input');
            input.type = 'number';

            // Handle variable placeholders or numeric values
            let numericValue: number = 0;
            if (typeof obj.value === 'string' && obj.value.startsWith('${')) {
                const resolved = this.runtime.evaluate(obj.value);
                numericValue = typeof resolved === 'number' ? resolved : parseFloat(String(resolved)) || 0;
            } else {
                numericValue = typeof obj.value === 'number' ? obj.value : parseFloat(String(obj.value)) || 0;
            }

            input.value = numericValue.toString();
            if (obj.min !== undefined) input.min = obj.min.toString();
            if (obj.max !== undefined) input.max = obj.max.toString();
            if (obj.step !== undefined) input.step = obj.step.toString();

            input.style.flex = '1';
            input.style.padding = '4px 6px';
            input.style.backgroundColor = '#333';
            input.style.color = '#fff';
            input.style.border = '1px solid #555';
            input.style.borderRadius = '3px';
            input.style.fontSize = '11px';

            input.onchange = () => {
                const val = parseFloat(input.value);
                if (!isNaN(val)) {
                    // Update UI object (for local state)
                    obj.value = val;
                    // Trigger sync to selectedObject
                    this.handleObjectChange(obj);
                }
            };

            if (obj.readOnly) {
                input.disabled = true;
                input.style.opacity = '0.6';
                input.style.cursor = 'not-allowed';
            }

            return input;
        }
        else if (className === 'TColorPicker') {
            const wrapper = document.createElement('div');
            wrapper.style.display = 'flex';
            wrapper.style.gap = '6px';
            wrapper.style.flex = '1';

            const input = document.createElement('input');
            input.type = 'color';

            // Handle variable placeholders for color
            let colorValue = obj.color || '#000000';
            if (typeof colorValue === 'string' && colorValue.startsWith('${')) {
                const resolved = this.runtime.evaluate(colorValue);
                colorValue = resolved !== undefined && resolved !== null ? String(resolved) : '#000000';
            }
            input.value = colorValue;
            input.style.width = '32px';
            input.style.height = '24px';
            input.style.border = '1px solid #555';
            input.style.borderRadius = '3px';
            input.style.cursor = 'pointer';

            const textInput = document.createElement('input');
            textInput.type = 'text';
            textInput.value = colorValue;
            textInput.style.flex = '1';
            textInput.style.padding = '4px 6px';
            textInput.style.backgroundColor = '#333';
            textInput.style.color = '#fff';
            textInput.style.border = '1px solid #555';
            textInput.style.borderRadius = '3px';
            textInput.style.fontSize = '11px';

            input.onchange = () => {
                obj.color = input.value;
                textInput.value = input.value;
                this.handleObjectChange(obj);
            };

            textInput.oninput = () => {
                if (/^#[0-9A-F]{6}$/i.test(textInput.value)) {
                    obj.color = textInput.value;
                    input.value = textInput.value;
                    this.handleObjectChange(obj);
                }
            };

            wrapper.appendChild(input);
            wrapper.appendChild(textInput);
            return wrapper;
        }
        else if (className === 'TDropdown') {
            const select = document.createElement('select');
            select.style.flex = '1';
            select.style.padding = '4px 6px';
            select.style.backgroundColor = '#333';
            select.style.color = '#fff';
            select.style.border = '1px solid #555';
            select.style.borderRadius = '3px';
            select.style.fontSize = '11px';
            select.style.cursor = 'pointer';

            // Resolve selectedValue binding for initial render
            let selectedVal = obj.selectedValue || '';
            let bindingExpression: string | null = null;
            if (selectedVal && String(selectedVal).startsWith('${')) {
                const expr: string = selectedVal;
                bindingExpression = expr;
                const resolved = this.runtime.evaluate(expr);
                selectedVal = resolved !== undefined && resolved !== null ? String(resolved) : '';
            }

            const optionsArr = obj.options || [];
            optionsArr.forEach((opt: any) => {
                const option = document.createElement('option');
                const val = (typeof opt === 'object' && opt !== null) ? opt.value : opt;
                const label = (typeof opt === 'object' && opt !== null) ? opt.label : opt;

                option.value = val;
                option.text = label;
                option.selected = String(val) === String(selectedVal);
                select.appendChild(option);
            });

            // Set up reactive binding Data -> DOM
            if (bindingExpression) {
                const expr: string = bindingExpression;
                this.runtime.bind(select, 'value', expr);
            }

            select.onchange = () => {
                obj.selectedValue = select.value;
                this.handleObjectChange(obj);
            };

            if (obj.readOnly) {
                select.disabled = true;
                select.style.opacity = '0.6';
                select.style.cursor = 'not-allowed';
            }

            return select;
        }
        else if (className === 'TCheckbox') {
            const label = document.createElement('label');
            label.style.display = 'flex';
            label.style.alignItems = 'center';
            label.style.cursor = 'pointer';
            label.style.flex = '1';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';

            // Resolve checked binding
            let isChecked = obj.checked || false;
            if (typeof isChecked === 'string' && isChecked.startsWith('${')) {
                const resolved = this.runtime.evaluate(isChecked);
                isChecked = !!resolved;
            }
            checkbox.checked = !!isChecked;
            checkbox.style.marginRight = '6px';
            checkbox.style.cursor = 'pointer';

            checkbox.onchange = () => {
                obj.checked = checkbox.checked;
                this.handleObjectChange(obj);
            };

            const text = document.createElement('span');
            text.innerText = obj.label || '';
            text.style.fontSize = '11px';
            text.style.color = '#fff';

            label.appendChild(checkbox);
            label.appendChild(text);
            return label;
        }
        else if (className === 'TSelect') {
            // TSelect - Dropdown with dynamic source
            const select = document.createElement('select');
            select.style.flex = '1';
            select.style.padding = '4px 6px';
            select.style.backgroundColor = '#333';
            select.style.color = '#fff';
            select.style.border = '1px solid #555';
            select.style.borderRadius = '3px';
            select.style.fontSize = '11px';
            select.style.cursor = 'pointer';

            // Apply additional styles
            if (obj.style) {
                if (obj.style.flex) select.style.flex = obj.style.flex;
                if (obj.style.minWidth) select.style.minWidth = obj.style.minWidth;
            }

            // Get options from source
            let options: { value: string, text: string }[] = [];
            if (obj.source === 'tasks') {
                options = projectRegistry.getTasks().map(t => {
                    let emoji = '🎭';
                    if (t.uiScope === 'global') emoji = '🌎';
                    else if (t.uiScope === 'library') emoji = '📚';
                    return { value: t.name, text: `${emoji} ${t.name}` };
                });
            } else if (obj.source === 'actions') {
                options = projectRegistry.getActions().map(a => {
                    const emoji = a.uiScope === 'global' ? '🌎' : '🎭';
                    return { value: a.name, text: `${emoji} ${a.name}` };
                });
            } else if (obj.source === 'objects') {
                options = projectRegistry.getObjects().map(o => ({ value: o.name, text: o.name }));
            } else if (obj.source === 'variables') {
                options = projectRegistry.getVariables().map(v => {
                    let emoji = '🎭';
                    if (v.uiScope === 'global') emoji = '🌎';
                    else if (v.uiScope === 'local' || v.scope?.startsWith('task:') || v.scope?.startsWith('action:')) emoji = '📍';
                    return { value: v.name, text: `${emoji} ${v.name}` };
                });
            } else if (obj.source === 'stages') {
                options = (this.project?.stages || []).map((s: any) => ({ value: s.id, text: s.name || s.id }));
            } else if (obj.source === 'services') {
                options = serviceRegistry.listServices().map(s => ({ value: s, text: s }));
            } else if (Array.isArray(obj.options)) {
                options = obj.options.map((opt: any) =>
                    typeof opt === 'string' ? { value: opt, text: opt } : { value: opt.value, text: opt.label || opt.text }
                );
            }

            // Add empty option if allowed
            if (obj.allowEmpty) {
                const emptyOpt = document.createElement('option');
                emptyOpt.value = '';
                emptyOpt.text = obj.emptyLabel || '-- Select --';
                select.appendChild(emptyOpt);
            }

            // Resolve selectedValue binding
            let selectedVal = String(obj.selectedValue || '');
            if (selectedVal.startsWith('${')) {
                const resolved = this.runtime.evaluate(selectedVal);
                selectedVal = resolved !== undefined && resolved !== null ? String(resolved) : '';
            }

            // Add options
            options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.text = opt.text;
                option.selected = opt.value === selectedVal;
                select.appendChild(option);
            });

            // If no option is selected and selectedVal is empty, select the empty option
            if (!selectedVal && obj.allowEmpty) {
                select.value = '';
            }

            select.onchange = () => {
                obj.selectedValue = select.value;
                this.handleObjectChange(obj);
            };

            if (obj.readOnly) {
                select.disabled = true;
                select.style.opacity = '0.6';
                select.style.cursor = 'not-allowed';
            }

            return select;
        }
        else if (className === 'TPanel') {
            const panel = document.createElement('div');
            panel.style.display = obj.style?.display || 'flex';
            panel.style.flexDirection = obj.style?.flexDirection || 'row';
            panel.style.alignItems = obj.style?.alignItems || 'center';
            panel.style.gap = obj.style?.gap || '4px';
            panel.style.flex = '1';

            if (obj.children && Array.isArray(obj.children)) {
                obj.children.forEach((child: any) => {
                    const childEl = this.renderInput(child);
                    if (childEl) panel.appendChild(childEl);
                });
            }
            return panel;
        }
        else if (className === 'TButton') {
            const button = document.createElement('button');
            button.innerText = obj.caption || obj.name;
            button.style.padding = obj.style?.padding || '2px 8px';
            button.style.fontSize = obj.style?.fontSize ? `${obj.style.fontSize}px` : '11px';
            button.style.backgroundColor = obj.style?.backgroundColor || '#0e639c';
            button.style.color = '#fff';
            button.style.border = 'none';
            button.style.borderRadius = '2px';
            button.style.cursor = 'pointer';

            if (obj.style?.width) button.style.width = obj.style.width;

            button.onclick = () => {
                if (obj.action) this.handleButtonAction(obj);
                else this.handleObjectClick(obj);
            };

            return button;
        }

        return null;
    }

    /**
     * Renders a single inspector object
     */
    private renderObject(obj: any): HTMLElement | null {
        // Visibility check - return null if hidden
        if (!this.isObjectVisible(obj)) return null;

        const className = obj.className || obj.constructor?.name;

        const el = document.createElement('div');
        el.className = `inspector-object ${className}`;
        el.style.marginBottom = '8px';

        // Auto-render Label if provided (and not handled by component itself)
        if (obj.label && className !== 'TLabel' && className !== 'TCheckbox' && className !== 'TButton') {
            // Use Flex layout for side-by-side (Inline) labels
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'space-between';
            el.style.marginBottom = '4px'; // Tighten vertical spacing

            const labelEl = document.createElement('div');
            labelEl.className = 'inspector-label';
            labelEl.innerText = obj.label + ':'; // Add colon
            labelEl.style.fontSize = '11px';
            labelEl.style.color = '#ccc';
            labelEl.style.width = '100px'; // Fixed label width for alignment
            labelEl.style.flexShrink = '0';
            labelEl.style.marginRight = '8px';

            // Optional: Support help tooltip
            if (obj.hint) {
                labelEl.title = obj.hint;
                labelEl.style.cursor = 'help';
                labelEl.style.textDecoration = 'underline dotted #666';
            }
            el.appendChild(labelEl);
        }

        // Render based on type
        if (className === 'TLabel') {
            // Check if this is a group header (all uppercase text)
            const isGroupHeader = obj.text && obj.text === obj.text.toUpperCase() && obj.text.length > 3;

            if (isGroupHeader) {
                // Group header styling
                el.innerText = obj.text || '';
                el.style.fontSize = '10px';
                el.style.fontWeight = 'bold';
                el.style.color = '#888';
                el.style.marginTop = obj.style?.marginTop ? `${obj.style.marginTop}px` : '12px';
                el.style.marginBottom = obj.style?.marginBottom ? `${obj.style.marginBottom}px` : '6px';
                el.style.paddingBottom = '4px';
                el.style.borderBottom = '1px solid #444';
                el.style.display = 'block';
            } else {
                // Regular label styling
                el.innerText = obj.text || '';
                el.style.fontSize = obj.style?.fontSize ? `${obj.style.fontSize}px` : '11px';
                el.style.fontWeight = obj.style?.fontWeight || 'normal';
                el.style.color = obj.style?.color || '#ccc';
                el.style.marginBottom = obj.style?.marginBottom ? `${obj.style.marginBottom}px` : '4px';
                el.style.marginTop = obj.style?.marginTop ? `${obj.style.marginTop}px` : '0';
                // Apply flex styles for row layout
                if (obj.style?.flex) el.style.flex = obj.style.flex;
                if (obj.style?.minWidth) el.style.minWidth = obj.style.minWidth;
            }
        }
        else if (className === 'TEdit') {
            const input = document.createElement('input');
            input.type = 'text';
            // Handle variable placeholders - resolve via runtime
            let textValue = (obj.text !== undefined && obj.text !== null) ? String(obj.text) : '';
            if (textValue.startsWith('${')) {
                // Try to resolve the binding expression
                const resolved = this.runtime.evaluate(textValue);
                textValue = resolved !== undefined && resolved !== null ? String(resolved) : '';
            }
            input.value = textValue;
            if (obj.placeholder) input.placeholder = obj.placeholder;

            // Base styles
            input.style.padding = '6px';
            input.style.backgroundColor = '#333';
            input.style.color = '#fff';
            input.style.border = '1px solid #555';
            input.style.borderRadius = '3px';
            input.style.boxSizing = 'border-box';
            input.style.fontSize = '12px';

            // Apply flex styles if specified, otherwise default
            if (obj.style?.flex) {
                input.style.flex = obj.style.flex;
            } else {
                input.style.width = '100%';
            }

            // Extract property name to check if validation is needed
            let propertyName = obj.name;
            if (propertyName.endsWith('Input')) {
                propertyName = propertyName.slice(0, -5);
            }

            // Initial validation
            const selectedObject = this.runtime.getVariable('selectedObject');
            if (selectedObject && propertyName === 'name') {
                this.validateInput(input, propertyName, input.value, selectedObject);
            }

            input.oninput = () => {
                // Real-time validation
                if (selectedObject && propertyName === 'name') {
                    this.validateInput(input, propertyName, input.value, selectedObject);
                }
            }

            input.onchange = () => {
                obj.text = input.value;
                this.handleObjectChange(obj);
            };

            el.appendChild(input);
        }
        else if (className === 'TNumberInput') {
            const input = document.createElement('input');
            input.type = 'number';

            // Handle variable placeholders or numeric values
            let numericValue: number = 0;
            if (typeof obj.value === 'string' && obj.value.startsWith('${')) {
                const resolved = this.runtime.evaluate(obj.value);
                numericValue = typeof resolved === 'number' ? resolved : parseFloat(String(resolved)) || 0;
            } else {
                numericValue = typeof obj.value === 'number' ? obj.value : parseFloat(String(obj.value)) || 0;
            }

            input.value = numericValue.toString();
            if (obj.min !== undefined) input.min = obj.min.toString();
            if (obj.max !== undefined) input.max = obj.max.toString();
            if (obj.step !== undefined) input.step = obj.step.toString();

            input.style.width = '100%';
            input.style.padding = '6px';
            input.style.backgroundColor = '#333';
            input.style.color = '#fff';
            input.style.border = '1px solid #555';
            input.style.borderRadius = '3px';
            input.style.boxSizing = 'border-box';
            input.style.fontSize = '12px';
            input.style.fontSize = '12px';

            input.onchange = () => {
                const val = parseFloat(input.value);
                if (!isNaN(val)) {
                    obj.value = val;
                    this.handleObjectChange(obj);
                }
            };

            if (obj.readOnly) {
                input.disabled = true;
                input.style.opacity = '0.6';
                input.style.cursor = 'not-allowed';
            }

            el.appendChild(input);
        }
        else if (className === 'TColorPicker') {
            const wrapper = document.createElement('div');
            wrapper.style.display = 'flex';
            wrapper.style.gap = '8px';
            wrapper.style.alignItems = 'center';
            wrapper.style.alignItems = 'center';

            const input = document.createElement('input');
            input.type = 'color';

            // Handle variable placeholders for color
            let colorValue = obj.color || '#000000';
            if (typeof colorValue === 'string' && colorValue.startsWith('${')) {
                const resolved = this.runtime.evaluate(colorValue);
                colorValue = resolved !== undefined && resolved !== null ? String(resolved) : '#000000';
            }
            input.value = colorValue;
            input.style.width = '40px';
            input.style.height = '28px';
            input.style.border = '1px solid #555';
            input.style.borderRadius = '3px';
            input.style.cursor = 'pointer';

            const textInput = document.createElement('input');
            textInput.type = 'text';
            textInput.value = colorValue;
            textInput.style.flex = '1';
            textInput.style.padding = '6px';
            textInput.style.backgroundColor = '#333';
            textInput.style.color = '#fff';
            textInput.style.border = '1px solid #555';
            textInput.style.borderRadius = '3px';
            textInput.style.fontSize = '12px';

            input.onchange = () => {
                obj.color = input.value;
                textInput.value = input.value;
                this.handleObjectChange(obj);
            };

            textInput.oninput = () => {
                if (/^#[0-9A-F]{6}$/i.test(textInput.value)) {
                    obj.color = textInput.value;
                    input.value = textInput.value;
                    this.handleObjectChange(obj);
                }
            };

            wrapper.appendChild(input);
            wrapper.appendChild(textInput);
            el.appendChild(wrapper);
        }
        else if (className === 'TDropdown') {
            const select = document.createElement('select');
            select.style.width = '100%';
            select.style.padding = '6px';
            select.style.backgroundColor = '#333';
            select.style.color = '#fff';
            select.style.border = '1px solid #555';
            select.style.borderRadius = '3px';
            select.style.boxSizing = 'border-box';
            select.style.fontSize = '12px';
            select.style.cursor = 'pointer';

            // Resolve selectedValue binding for initial render
            let selectedVal = obj.selectedValue || '';
            let bindingExpression: string | null = null;
            if (selectedVal && String(selectedVal).startsWith('${')) {
                const expr: string = selectedVal;
                bindingExpression = expr;
                const resolved = this.runtime.evaluate(expr);
                selectedVal = resolved !== undefined && resolved !== null ? String(resolved) : '';
            }

            let optionsArr = obj.options || [];
            if (typeof optionsArr === 'string' && optionsArr.startsWith('${')) {
                const resolved = this.runtime.evaluate(optionsArr);
                optionsArr = Array.isArray(resolved) ? resolved : [];
            }

            if (Array.isArray(optionsArr)) {
                optionsArr.forEach((opt: any) => {
                    const option = document.createElement('option');
                    const val = (typeof opt === 'object' && opt !== null) ? opt.value : opt;
                    const label = (typeof opt === 'object' && opt !== null) ? opt.label : opt;

                    option.value = val;
                    option.text = label;
                    option.selected = String(val) === String(selectedVal);
                    select.appendChild(option);
                });
            }

            // Set up reactive binding Data -> DOM (only after options are present)
            if (bindingExpression) {
                const expr: string = bindingExpression;
                this.runtime.bind(select, 'value', expr);
            }

            select.onchange = () => {
                obj.selectedValue = select.value;
                this.handleObjectChange(obj);
            };

            el.appendChild(select);
        }
        else if (className === 'TCheckbox') {
            const label = document.createElement('label');
            label.style.display = 'flex';
            label.style.alignItems = 'center';
            label.style.cursor = 'pointer';
            label.style.color = '#fff';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';

            // Resolve checked binding
            let isChecked = obj.checked || false;
            if (typeof isChecked === 'string' && isChecked.startsWith('${')) {
                const resolved = this.runtime.evaluate(isChecked);
                isChecked = !!resolved;
            }
            checkbox.checked = !!isChecked;
            checkbox.style.marginRight = '8px';
            checkbox.style.cursor = 'pointer';

            checkbox.onchange = () => {
                obj.checked = checkbox.checked;
                this.handleObjectChange(obj);
            };

            const text = document.createElement('span');
            text.innerText = obj.label || '';
            text.style.fontSize = '12px';

            label.appendChild(checkbox);
            label.appendChild(text);
            el.appendChild(label);
        }
        else if (className === 'TSelect') {
            // TSelect - Dropdown with dynamic source
            const select = document.createElement('select');

            // Base styles
            select.style.padding = '4px 6px';
            select.style.backgroundColor = '#333';
            select.style.color = '#fff';
            select.style.border = '1px solid #555';
            select.style.borderRadius = '3px';
            select.style.fontSize = '11px';
            select.style.cursor = 'pointer';

            // Apply flex styles if specified
            if (obj.style?.flex) {
                select.style.flex = obj.style.flex;
            } else {
                select.style.width = '100%';
            }
            if (obj.style?.minWidth) select.style.minWidth = obj.style.minWidth;

            // Get options from source
            // Get options from source
            let options: { value: string, text: string }[] = [];
            if (obj.source === 'tasks') {
                options = projectRegistry.getTasks().map(t => {
                    let emoji = '🎭';
                    if (t.uiScope === 'global') emoji = '🌎';
                    else if (t.uiScope === 'library') emoji = '📚';
                    return { value: t.name, text: `${emoji} ${t.name}` };
                });
            } else if (obj.source === 'actions') {
                options = projectRegistry.getActions().map(a => {
                    const emoji = a.uiScope === 'global' ? '🌎' : '🎭';
                    return { value: a.name, text: `${emoji} ${a.name}` };
                });
            } else if (obj.source === 'objects') {
                options = projectRegistry.getObjects().map(o => ({ value: o.name, text: o.name }));
            } else if (obj.source === 'variables') {
                options = projectRegistry.getVariables().map(v => {
                    let emoji = '🎭';
                    if (v.uiScope === 'global') emoji = '🌎';
                    else if (v.uiScope === 'local' || v.scope?.startsWith('task:') || v.scope?.startsWith('action:')) emoji = '📍';
                    return { value: v.name, text: `${emoji} ${v.name}` };
                });
            } else if (obj.source === 'stages') {
                options = (this.project?.stages || []).map((s: any) => ({ value: s.id, text: s.name || s.id }));
            } else if (obj.source === 'services') {
                options = serviceRegistry.listServices().map(s => ({ value: s, text: s }));
            } else {
                let sourceArr = obj.options || obj.items;
                if (typeof sourceArr === 'string' && sourceArr.startsWith('${')) {
                    sourceArr = this.runtime.evaluate(sourceArr);
                }

                if (Array.isArray(sourceArr)) {
                    options = sourceArr.map((opt: any) =>
                        typeof opt === 'string' ? { value: opt, text: opt } : { value: opt.value, text: (opt.label || opt.text || opt) }
                    );
                }
            }

            // Add empty option if allowed
            if (obj.allowEmpty) {
                const emptyOpt = document.createElement('option');
                emptyOpt.value = '';
                emptyOpt.text = obj.emptyLabel || '-- Select --';
                select.appendChild(emptyOpt);
            }

            // Resolve selectedValue binding (support 'selected' as alias)
            let selectedVal: any = obj.selectedValue || obj.selected || '';
            let bindingExpression: string | null = null;
            if (selectedVal && String(selectedVal).startsWith('${')) {
                const expr: string = selectedVal;
                bindingExpression = expr;
                const resolved = this.runtime.evaluate(expr);
                selectedVal = resolved !== undefined && resolved !== null ? String(resolved) : '';
            }

            // Add options
            options.forEach((opt: any) => {
                const option = document.createElement('option');
                const val = (typeof opt === 'object' && opt !== null) ? opt.value : opt;
                const label = (typeof opt === 'object' && opt !== null) ? (opt.label || opt.text) : opt;

                option.value = val;
                option.text = label;
                option.selected = String(val) === String(selectedVal);
                select.appendChild(option);
            });

            // Double check selection after options are added
            if (selectedVal) {
                select.value = String(selectedVal);
            }

            // Set up reactive binding Data -> DOM (only after options are present)
            if (bindingExpression) {
                const expr: string = bindingExpression;
                this.runtime.bind(select, 'value', expr);
            }

            // If no option is selected and selectedVal is empty, select the empty option
            if (!selectedVal && obj.allowEmpty) {
                select.value = '';
            }

            select.onchange = () => {
                obj.selectedValue = select.value;
                if (obj.selected !== undefined) obj.selected = select.value;
                this.handleObjectChange(obj);
            };

            el.appendChild(select);
        }
        else if (className === 'TButton') {
            const button = document.createElement('button');
            button.innerText = obj.caption || obj.name;

            // Base styles
            button.style.padding = obj.style?.padding || '8px 12px';
            button.style.backgroundColor = obj.style?.backgroundColor || '#0e639c';
            button.style.color = obj.style?.color || '#fff';
            button.style.border = 'none';
            button.style.borderRadius = '3px';
            button.style.cursor = 'pointer';
            button.style.fontSize = obj.style?.fontSize ? `${obj.style.fontSize}px` : '12px';
            button.style.fontWeight = '500';
            button.style.transition = 'background-color 0.2s';

            // Apply flex styles if specified, otherwise default to full width
            if (obj.style?.flex) {
                button.style.flex = obj.style.flex;
                if (obj.style.minWidth) button.style.minWidth = obj.style.minWidth;
            } else {
                button.style.width = '100%';
                button.style.marginTop = '12px';
            }

            button.onmouseover = () => {
                const bgColor = obj.style?.backgroundColor || '#0e639c';
                button.style.backgroundColor = this.adjustBrightness(bgColor, 1.2);
            };

            button.onmouseout = () => {
                button.style.backgroundColor = obj.style?.backgroundColor || '#0e639c';
            };

            button.onclick = () => {
                if (obj.action) {
                    // Use action handler for dialog buttons
                    this.handleButtonAction(obj);
                } else {
                    // Use old click handler
                    this.handleObjectClick(obj);
                }
            };

            el.appendChild(button);
        }
        else if (className === 'TActionParams') {
            const selectedObject = this.runtime.getVariable('selectedObject');
            if (selectedObject && selectedObject.type) {
                const meta = actionRegistry.getMetadata(selectedObject.actionType || selectedObject.type);
                if (meta) {
                    const container = document.createElement('div');
                    container.className = 'action-params-container';
                    container.style.display = 'flex';
                    container.style.flexDirection = 'column';
                    container.style.gap = '8px';
                    container.style.marginTop = '8px';

                    meta.parameters.forEach(param => {
                        const row = document.createElement('div');
                        row.style.display = 'flex';
                        row.style.alignItems = 'center';
                        row.style.gap = '8px';
                        row.style.marginBottom = '4px';

                        const label = document.createElement('label');
                        label.innerText = param.label;
                        label.style.minWidth = '80px';
                        label.style.fontSize = '11px';
                        label.style.color = '#888';
                        row.appendChild(label);

                        let input: HTMLElement | null = null;
                        const currentVal = selectedObject[param.name];

                        if (param.type === 'object' || param.type === 'variable' || param.type === 'select' || param.type === 'stage') {
                            const select = document.createElement('select');
                            select.style.flex = '1';
                            select.style.padding = '4px';
                            select.style.backgroundColor = '#333';
                            select.style.color = '#fff';
                            select.style.border = '1px solid #555';
                            select.style.borderRadius = '3px';
                            select.style.fontSize = '11px';

                            let items: any[] = [];
                            if (param.source === 'objects') items = projectRegistry.getObjects().map(o => o.name);
                            else if (param.source === 'variables') items = projectRegistry.getVariables().map(v => v.name);
                            else if (param.source === 'stages') items = (this.project?.stages || []).map((s: any) => s.id);
                            else if (param.source === 'services') items = serviceRegistry.listServices();
                            else if (param.source === 'easing-functions') items = ['linear', 'easeIn', 'easeOut', 'easeInOut'];

                            const empty = document.createElement('option');
                            empty.value = '';
                            empty.text = '--';
                            select.appendChild(empty);

                            items.forEach(it => {
                                const opt = document.createElement('option');
                                opt.value = it;
                                opt.text = it;
                                if (currentVal === it) opt.selected = true;
                                select.appendChild(opt);
                            });

                            select.onchange = () => {
                                selectedObject[param.name] = select.value;
                                this.handleObjectChange({ name: `${param.name}Input`, value: select.value });
                            };
                            input = select;
                        } else {
                            const edit = document.createElement('input');
                            edit.type = 'text';
                            edit.style.flex = '1';
                            edit.style.padding = '4px';
                            edit.style.backgroundColor = '#333';
                            edit.style.color = '#fff';
                            edit.style.border = '1px solid #555';
                            edit.style.borderRadius = '3px';
                            edit.style.fontSize = '11px';
                            edit.value = currentVal !== undefined ? (typeof currentVal === 'object' ? JSON.stringify(currentVal) : String(currentVal)) : '';

                            edit.onchange = () => {
                                let val: any = edit.value;
                                if (param.type === 'number') val = Number(val);
                                if (param.type === 'json') { try { val = JSON.parse(val); } catch (e) { } }
                                selectedObject[param.name] = val;
                                this.handleObjectChange({ name: `${param.name}Input`, value: val });
                            };
                            input = edit;
                        }

                        if (input) row.appendChild(input);
                        container.appendChild(row);
                    });
                    el.appendChild(container);
                }
            }
        }
        else if (className === 'TPanel') {
            // Apply flex styles if specified
            if (obj.style) {
                if (obj.style.display) el.style.display = obj.style.display;
                if (obj.style.flexDirection) el.style.flexDirection = obj.style.flexDirection;
                if (obj.style.alignItems) el.style.alignItems = obj.style.alignItems;
                if (obj.style.gap) el.style.gap = obj.style.gap;
                if (obj.style.marginBottom) el.style.marginBottom = typeof obj.style.marginBottom === 'number' ? `${obj.style.marginBottom}px` : obj.style.marginBottom;
            }

            // Render children
            if (obj.children && Array.isArray(obj.children)) {
                obj.children.forEach((child: any) => {
                    const childEl = this.renderObject(child);
                    if (childEl) el.appendChild(childEl);
                });
            }

            // Add action support for panels
            if (obj.action) {
                el.style.cursor = 'pointer';
                el.onclick = () => {
                    this.handleButtonAction(obj);
                };
            }

            // Render _rowItems (from rowLayout TForEach)
            if (obj._rowItems && Array.isArray(obj._rowItems)) {
                obj._rowItems.forEach((item: any) => {
                    const itemEl = this.renderObject(item);
                    if (itemEl) {
                        // Remove default margins for inline items
                        itemEl.style.marginBottom = '0';
                        el.appendChild(itemEl);
                    }
                });
            }
        }
        else {
            // Fallback rendering
            el.innerText = `[${className}] ${obj.name}`;
            el.style.color = '#666';
        }

        return el;
    }

    /**
     * Returns an icon for an object based on its className
     */
    private getObjectIcon(obj: any): string {
        const className = obj.className || obj.constructor?.name || '';
        const iconMap: Record<string, string> = {
            'TButton': '🔘',
            'TPanel': '⬜',
            'TLabel': '📝',
            'TEdit': '✏️',
            'TTextInput': '✏️',
            'TSprite': '🎯',
            'TGameLoop': '🔄',
            'TInputController': '🎹',
            'TTimer': '⏲️',
            'TRepeater': '🔁',
            'TGameCard': '🃏',
            'TGameServer': '🌐',
            'TGameHeader': '🎮',
            'TDropdown': '📋',
            'TCheckbox': '☑️',
            'TColorPicker': '🎨',
            'TNumberInput': '🔢',
            'TNumberLabel': '🔢',
            'TTabControl': '📑',
            'TSystemInfo': '💻'
        };
        return iconMap[className] || '📦';
    }

    /**
     * Helper to adjust color brightness
     */
    private adjustBrightness(color: string, factor: number): string {
        const hex = color.replace('#', '');
        const r = Math.min(255, Math.floor(parseInt(hex.substr(0, 2), 16) * factor));
        const g = Math.min(255, Math.floor(parseInt(hex.substr(2, 2), 16) * factor));
        const b = Math.min(255, Math.floor(parseInt(hex.substr(4, 2), 16) * factor));
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    /**
     * Validates an input field and updates its style
     */
    private validateInput(input: HTMLInputElement, property: string, value: string, object: any) {
        if (!value) return;

        let result: { valid: boolean; error?: string } = { valid: true };

        if (property === 'name') {
            // Determine type of object
            const isTask = this.project?.tasks.some(t => t === object) || (object.actions !== undefined && object.variables !== undefined && !object.className);
            const isObject = object.className !== undefined && object.className !== 'TGameLoop'; // Exclude special managers if needed

            if (isTask) {
                result = projectRegistry.validateTaskName(value);
            } else if (isObject) {
                // If it's the current name, it's valid (ignoring uniqueness check against self)
                if (value === object.name) {
                    result = { valid: true };
                } else {
                    result = projectRegistry.validateObjectName(value);
                }
            }
        }

        if (!result.valid) {
            input.style.borderColor = '#ff4444';
            input.style.backgroundColor = '#330000';
            input.title = result.error || 'Invalid value';
        } else {
            input.style.borderColor = '#555';
            input.style.backgroundColor = '#333';
            input.title = '';
        }
    }

    /**
     * Handles object changes (input, etc.)
     */
    private handleObjectChange(obj: any) {
        console.log('[JSONInspector] Object changed:', obj.name, obj);

        // Get selectedObject
        const selectedObject = this.runtime.getVariable('selectedObject');
        if (!selectedObject) {
            console.warn('[JSONInspector] No selectedObject - cannot apply change');
            return;
        }

        // Block changes for embedded/linked elements
        const isEmbeddedElement = selectedObject.data?.isLinked || selectedObject.data?.isEmbeddedInternal;

        // Dynamic property extraction from input name
        // Input names follow pattern: "propertyNameInput" or "nested.prop.nameInput"
        let propertyName = obj.name;

        // Remove "Input" suffix to get property name
        // Special handling for Event inputs (pattern: EventInput_<eventName>)
        if (propertyName.startsWith('EventInput_')) {
            const eventName = propertyName.replace('EventInput_', '');
            propertyName = `Tasks.${eventName}`;
            console.log(`[JSONInspector] Event binding detected: ${propertyName}`);
        } else if (propertyName.endsWith('Input')) {
            propertyName = propertyName.slice(0, -5); // Remove "Input"
        }

        // Remove "Label" suffix if present
        if (propertyName.endsWith('Label')) {
            propertyName = propertyName.slice(0, -5);
        }

        // EXCEPTION: Allow dynamic parameters (param_ prefix) even for embedded elements
        const isParameter = propertyName.startsWith('param_');
        const isActionOrTask = selectedObject.data?.type === 'Action' || (selectedObject.constructor.name === 'FlowTask');

        if (isEmbeddedElement && !isParameter && !isActionOrTask) {
            console.warn('[JSONInspector] Cannot modify embedded element - it is read-only');
            alert('Eingebettete Elemente können nicht bearbeitet werden.\n\nBitte wechsle zum Original-Flow-Diagramm.');
            return;
        }

        // Check if this is a project or object
        const isProject = selectedObject && selectedObject.meta !== undefined;

        console.log(`[JSONInspector] Extracted property: ${propertyName}`);

        // Capture old value BEFORE applying the change (for ChangeRecorder)
        let previousValue: any = undefined;
        try {
            previousValue = this.getNestedProperty(selectedObject, propertyName);
        } catch (e) {
            // Property might not exist yet
        }

        // Get the value from the inspector object based on its type
        let value: any;
        if (obj.value !== undefined) {
            value = obj.value;
        } else if (obj.text !== undefined) {
            value = obj.text;
        } else if (obj.color !== undefined) {
            value = obj.color;
        } else if (obj.checked !== undefined) {
            value = obj.checked;
        } else if (obj.selectedValue !== undefined) {
            value = obj.selectedValue;
        } else {
            console.warn('[JSONInspector] Could not extract value from:', obj);
            return;
        }

        // Capture old name for refactoring BEFORE applying new value
        const isStageNameChange = propertyName === 'activeStage.name' && this.project;
        const isFlowNameChange = propertyName === 'Name' && this.project;
        const isStandardNameChange = propertyName === 'name' && this.project;
        const isNameChange = isStandardNameChange || isFlowNameChange || isStageNameChange;

        let oldValue = null;
        if (isNameChange) {
            if (isStageNameChange && this.project) {
                const activeStage = this.project.stages?.find((s: any) => s.id === this.project!.activeStageId);
                oldValue = activeStage?.name;
            } else {
                // For FlowElements, Name is a getter/setter that might return the new value if already applied
                // but handleObjectChange is called AFTER the inspector component (TEdit) changed.
                // However, the selectedObject is what we are refactoring.
                oldValue = (selectedObject as any).Name || (selectedObject as any).name;
            }
        }

        // Trigger Refactoring if name changed
        if (isNameChange && oldValue && value && oldValue !== value && this.project) {
            console.log(`[JSONInspector] Refactoring for name change: "${oldValue}" -> "${value}"`);

            // Identify object type for correct refactoring
            const isFlowElement = typeof (selectedObject as any).getType === 'function';
            const flowType = isFlowElement ? (selectedObject as any).getType() : null;

            // DUPLICATE CHECK for Actions
            if (flowType === 'Action') {
                const existingAction = this.project.actions.find(a => a.name === value && a !== selectedObject);
                if (existingAction) {
                    // Name already exists! Block and revert
                    alert(`Eine Action mit dem Namen "${value}" existiert bereits.\nBitte wähle einen anderen eindeutigen Namen.`);
                    return; // Abort
                }
                RefactoringManager.renameAction(this.project, oldValue, value);
            } else if (flowType === 'Task') {
                RefactoringManager.renameTask(this.project, oldValue, value);
            } else if (this.project.variables.some(v => v === selectedObject) ||
                this.project.stages?.some((s: any) => s.variables?.some((v: any) => v === selectedObject))) {
                RefactoringManager.renameVariable(this.project, oldValue, value);
            } else if (this.project.objects.some(o => o === selectedObject) ||
                this.project.stages?.some((s: any) => s.objects?.some((o: any) => o === selectedObject))) {
                console.log(`[JSONInspector] Triggering renameObject for: ${oldValue} -> ${value}`);
                RefactoringManager.renameObject(this.project, oldValue, value);
            } else {
                console.warn('[JSONInspector] Name change detected but could not identify object type for refactoring', selectedObject);
            }

            // After refactoring, the object's name property in the project list might already have been updated
            // by the RefactoringManager. We still apply it here to be sure.
        }

        // Handle nested properties like "style.backgroundColor" or "Tasks.onClick"
        if (propertyName.includes('.')) {
            const parts = propertyName.split('.');
            let target: any = selectedObject;

            // WICHTIG: Falls der Pfad mit 'activeStage.' beginnt, ist das Ziel die aktive Stage
            if (parts[0] === 'activeStage' && this.project) {
                const activeStage = this.project.stages?.find((s: any) => s.id === this.project?.activeStageId);
                if (activeStage) {
                    target = activeStage;
                    parts.shift(); // 'activeStage' entfernen damit der Restpfad relativ zur Stage ist
                }
            }

            for (let i = 0; i < parts.length - 1; i++) {
                if (!target[parts[i]]) {
                    target[parts[i]] = {};
                }
                target = target[parts[i]];
            }

            // Special handling for Tasks: Delete empty event mappings instead of setting to empty string
            const lastPart = parts[parts.length - 1];
            if (parts[0] === 'Tasks' && (!value || value === '')) {
                delete target[lastPart];
                console.log(`[JSONInspector] Removed empty event mapping: Tasks.${lastPart}`);
            } else {
                target[lastPart] = value;
            }
        } else {
            // Simple property - write directly
            selectedObject[propertyName] = value;
        }

        // If name changed, force re-render of the selector and inspector UI to update the name in the dropdown
        if (isNameChange) {
            this.render();
        }

        // Trigger appropriate callback
        if (isProject && this.onProjectUpdate) {
            this.onProjectUpdate();
        } else if (this.onObjectUpdate) {
            this.onObjectUpdate();
        }

        // SMART-SYNC: If this is a linked action/task, sync back to project registry
        if (selectedObject.data?.isLinked && isActionOrTask && !isParameter) {
            const name = selectedObject.data.name;
            const scope = selectedObject.data.scope;

            console.log(`[JSONInspector] Smart-Sync for linked element: ${name} (Scope: ${scope})`);

            if (this.editor) {
                if (selectedObject.data.type === 'Action') {
                    const targetCollection = this.editor.getTargetActionCollection(name, selectedObject.data);
                    const index = targetCollection.findIndex((a: any) => a.name === name);
                    if (index !== -1) {
                        targetCollection[index] = { ...targetCollection[index], ...selectedObject.data };
                        console.log(`[JSONInspector] Updated original action definition in ${scope} scope`);
                    }
                } else {
                    const targetCollection = this.editor.getTargetTaskCollection(name, selectedObject.data);
                    const index = targetCollection.findIndex((t: any) => t.name === name);
                    if (index !== -1) {
                        targetCollection[index] = { ...targetCollection[index], ...selectedObject.data };
                        console.log(`[JSONInspector] Updated original task definition in ${scope} scope`);
                    }
                }

                // Triggers auto-save
                if (this.onSave) this.onSave();
            }
        }

        // Record change for Undo/Redo (only if value actually changed)
        if (previousValue !== value && !changeRecorder.isApplyingAction) {
            changeRecorder.record({
                type: 'property',
                description: `${(selectedObject as any).name || 'Object'}.${propertyName} geändert`,
                objectType: 'object',
                objectId: (selectedObject as any).id,
                property: propertyName,
                oldValue: previousValue,
                newValue: value
            });
        }
    }

    /**
     * Liest eine verschachtelte Eigenschaft (z.B. "style.backgroundColor")
     */
    private getNestedProperty(obj: any, path: string): any {
        if (!path.includes('.')) return obj[path];

        const parts = path.split('.');
        let current = obj;
        for (const part of parts) {
            if (current === undefined || current === null) return undefined;
            // Falls der Pfad 'activeStage' enthält, müssen wir in das interne Stage-Objekt schauen
            if (part === 'activeStage' && this.project) {
                current = this.project.stages?.find((s: any) => s.id === this.project?.activeStageId);
            } else {
                current = current[part];
            }
        }
        return current;
    }


    /**
     * Handles button actions (e.g., opening dialogs)
     */
    private async handleButtonAction(buttonDef: any) {
        if (!this.dialogManager) {
            console.error('[JSONInspector] DialogManager not set');
            return;
        }

        const selectedObject = this.runtime.getVariable('selectedObject');

        switch (buttonDef.action) {
            case 'browseImage': {
                const propName = buttonDef.actionData?.property;

                console.log('[JSONInspector] Opening Image Browser for:', propName);

                // Fetch image list and flatten it for the simple browser view
                const imageTree = await imageService.listImages();
                const flatImages = imageService.flattenImages(imageTree);

                // Open browser dialog
                const result = await this.dialogManager.showDialog('image_browser', true, {
                    images: flatImages,
                    selectedPath: selectedObject[propName] || ''
                });

                console.log('[JSONInspector] Dialog closed. result:', result);

                if (result.action === 'select' && result.data.selectedPath) {
                    const selPath = result.data.selectedPath;
                    console.log('[JSONInspector] Applying image selection:', selPath, 'to property:', propName, 'on object:', selectedObject.name);

                    // Update the object property
                    if (selectedObject && propName) {
                        try {
                            // Support dotted paths if needed, but usually it's just a direct property like 'src'
                            if (propName.includes('.')) {
                                const parts = propName.split('.');
                                let target = selectedObject;
                                for (let i = 0; i < parts.length - 1; i++) target = target[parts[i]];
                                target[parts[parts.length - 1]] = selPath;
                            } else {
                                (selectedObject as any)[propName] = selPath;
                                // Also update backgroundImage if it's a TImage/TSprite
                                if (propName === 'src' && 'backgroundImage' in selectedObject) {
                                    (selectedObject as any).backgroundImage = selPath;
                                }
                            }

                            console.log('[JSONInspector] Property updated successfully. New value:', selectedObject[propName]);

                            // Notify updates
                            if (this.onObjectUpdate) this.onObjectUpdate();
                            // Re-render
                            this.update(selectedObject);
                        } catch (e) {
                            console.error('[JSONInspector] Error applying property update:', e);
                        }
                    } else {
                        console.warn('[JSONInspector] No selectedObject or propName found for update');
                    }
                }
                break;
            }

            case 'uploadLocalImage': {
                const propName = buttonDef.actionData?.property;
                console.log('[JSONInspector] Opening Local File Picker for:', propName);

                // Create hidden file input
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = 'image/*';
                fileInput.style.display = 'none';
                document.body.appendChild(fileInput);

                fileInput.onchange = async (e: any) => {
                    const file = e.target.files?.[0];
                    if (file) {
                        try {
                            console.log('[JSONInspector] Reading file:', file.name);
                            const base64 = await imageService.readFileAsBase64(file);

                            if (selectedObject && propName) {
                                (selectedObject as any)[propName] = base64;

                                // Also update backgroundImage if applicable
                                if (propName === 'src' && 'backgroundImage' in selectedObject) {
                                    (selectedObject as any).backgroundImage = base64;
                                }
                                if (propName === 'contentImage' && 'backgroundImage' in selectedObject) {
                                    (selectedObject as any).backgroundImage = base64;
                                }

                                console.log('[JSONInspector] Local image applied as Base64');
                                if (this.onObjectUpdate) this.onObjectUpdate();
                                this.update(selectedObject);
                            }
                        } catch (err) {
                            console.error('[JSONInspector] Upload error:', err);
                        }
                    }
                    document.body.removeChild(fileInput);
                };

                fileInput.click();
                break;
            }

            case 'setTransparent': {
                const propName = buttonDef.actionData?.property;
                if (selectedObject && propName) {
                    console.log('[JSONInspector] Setting property to transparent:', propName);

                    if (propName.includes('.')) {
                        const parts = propName.split('.');
                        let target = selectedObject;
                        for (let i = 0; i < parts.length - 1; i++) target = target[parts[i]];
                        target[parts[parts.length - 1]] = 'transparent';
                    } else {
                        (selectedObject as any)[propName] = 'transparent';
                    }

                    if (this.onObjectUpdate) this.onObjectUpdate();
                    this.update(selectedObject);
                }
                break;
            }

            case 'openTaskEditor': {
                // Get taskName from eventKey (simplified approach)
                const eventKey = buttonDef.eventKey;
                let taskName = '';

                if (eventKey) {
                    if (selectedObject?.Tasks) {
                        // Object Style: Tasks map
                        taskName = selectedObject.Tasks[eventKey] || '';
                    } else if (selectedObject && (selectedObject as any)[eventKey]) {
                        // Variable Style: Direct property
                        taskName = (selectedObject as any)[eventKey] || '';
                    }
                }

                if (!taskName && buttonDef.taskName) {
                    // Fallback to old approach if taskName is directly specified
                    taskName = this.evaluateExpression(buttonDef.taskName, selectedObject);
                }

                console.log('[JSONInspector] Opening Task Editor - eventKey:', eventKey, 'taskName:', taskName);

                // Use legacy TaskEditor class (has inline Service Action form)
                if (!this.project) {
                    console.error('[JSONInspector] No project available');
                    return;
                }

                new TaskEditor(this.project, taskName, () => {
                    console.log('[JSONInspector] Task saved');
                    if (this.onObjectUpdate) this.onObjectUpdate();
                    // Re-render inspector to reflect any changes
                    this.update(selectedObject);
                });
                break;
            }

            case 'openActionEditor': {
                const actionName = buttonDef.actionName || buttonDef.actionData?.actionName;
                const evaluatedActionName = actionName ? this.evaluateExpression(actionName, selectedObject) : '';

                console.log('[JSONInspector] Opening Action Editor:', evaluatedActionName);

                // Find existing action data
                const actionIndex = this.project?.actions.findIndex((a: any) => a.name === evaluatedActionName) ?? -1;
                const existingAction = actionIndex !== -1 ? this.project?.actions[actionIndex] : null;

                // Deep clone the data to prevent shared references and accidental partial updates on cancel
                const dialogData = existingAction
                    ? JSON.parse(JSON.stringify(existingAction))
                    : {
                        name: evaluatedActionName,
                        target: selectedObject?.name,
                        type: 'property',
                        changes: {}
                    };

                // Ensure actionName is set for the dialog (template expectation)
                dialogData.actionName = dialogData.name;

                const result = await this.dialogManager.showDialog('action_editor', true, dialogData);

                if (result.action === 'save') {
                    console.log('[JSONInspector] Action saved:', result.data);

                    const oldName = evaluatedActionName;
                    const newName = result.data.name;

                    if (this.project) {
                        // ALWAYS check if new name already exists (different action)
                        const existingActionWithSameName = this.project.actions.find((a: any) => a.name === newName);
                        const isSameAction = oldName === newName; // Editing existing action without changing name

                        // If name exists AND it's not the same action we're editing → conflict!
                        if (existingActionWithSameName && !isSameAction) {
                            // Name conflict! Ask user what to do
                            const refs = projectRegistry.findReferences(newName);
                            const refInfo = refs.length > 0
                                ? `\n\nDiese Action wird in folgenden Tasks verwendet:\n- ${refs.join('\n- ')}`
                                : '';

                            const choice = confirm(
                                `Eine Action mit dem Namen "${newName}" existiert bereits.${refInfo}\n\n` +
                                `Möchtest du eine Referenz auf die vorhandene Action einrichten?\n\n` +
                                `⚠️ Änderungen an dieser Action betreffen dann auch andere Stellen!\n\n` +
                                `[OK] = Referenz einrichten (deine Eingaben werden verworfen)\n[Abbrechen] = Anderen Namen wählen`
                            );

                            if (choice) {
                                // User wants to reference existing action
                                console.log(`[JSONInspector] User chose to reference existing action: ${newName}`);

                                // Delete the old "shell" action if it was a temporary one (Aktion1, Aktion2, etc.)
                                if (oldName && oldName.match(/^Aktion\d+$/)) {
                                    const oldIdx = this.project.actions.findIndex((a: any) => a.name === oldName);
                                    if (oldIdx !== -1) {
                                        this.project.actions.splice(oldIdx, 1);
                                        console.log(`[JSONInspector] Removed shell action: ${oldName}`);
                                    }
                                }

                                // Update the selected flow node to use the existing action's name
                                if (selectedObject && typeof selectedObject.Name !== 'undefined') {
                                    selectedObject.Name = newName;
                                    if (selectedObject.data) selectedObject.data.name = newName;
                                }

                                // DON'T save result.data - we're using the existing action!
                            } else {
                                // User wants to choose different name - abort save
                                alert('Bitte wähle einen anderen eindeutigen Namen für die Action.');
                                return;
                            }
                        } else {
                            // No conflict - normal save flow

                            // 1. If name changed, perform project-wide refactoring FIRST
                            if (oldName && newName && oldName !== newName) {
                                console.log(`[JSONInspector] Renaming action from "${oldName}" to "${newName}"...`);
                                RefactoringManager.renameAction(this.project, oldName, newName);
                            }

                            // 2. Update/Record the action data
                            const finalActionIndex = this.project.actions.findIndex((a: any) => a.name === newName);
                            if (finalActionIndex !== -1) {
                                this.project.actions[finalActionIndex] = result.data;
                            } else {
                                // New action - add it
                                this.project.actions.push(result.data);
                            }
                        }
                    }

                    if (this.onObjectUpdate) this.onObjectUpdate();
                    this.update(selectedObject);
                } else if (result.action === 'delete') {
                    console.log('[JSONInspector] Action delete requested:', evaluatedActionName);

                    // Referenzen prüfen und als Warnung anzeigen (aber nicht blockieren)
                    const refs = projectRegistry.findReferences(evaluatedActionName);
                    const refWarning = refs.length > 0
                        ? `\n\n⚠️ Achtung: Diese Action wird noch verwendet in:\n${refs.join('\n')}\n\nReferenzen werden ebenfalls entfernt.`
                        : '';

                    if (!confirm(`Möchtest du die Action "${evaluatedActionName}" wirklich löschen?${refWarning}`)) {
                        return; // Abbruch durch Benutzer
                    }

                    if (this.project) {
                        // Use RefactoringManager for clean project-wide deletion
                        RefactoringManager.deleteAction(this.project, evaluatedActionName);
                        console.log('[JSONInspector] Action deleted via RefactoringManager:', evaluatedActionName);

                        if (this.onObjectUpdate) this.onObjectUpdate();
                        this.update(selectedObject);
                    }
                }
                break;
            }

            case 'exportToLibrary': {
                if (!selectedObject) return;
                const taskName = selectedObject.data?.taskName || selectedObject.Name;
                const task = this.project?.tasks.find((t: any) => t.name === taskName);
                if (!task) {
                    alert('Task-Definition nicht im Projekt gefunden!');
                    return;
                }

                // Find flow chart in potential locations
                const activeStage = this.project?.stages?.find(s => s.id === this.project?.activeStageId);
                const flowChart = (task as any).flowChart || (task as any).flowGraph ||
                    this.project?.flowCharts?.[taskName] ||
                    activeStage?.flowCharts?.[taskName] ||
                    { elements: [], connections: [] };

                // Prepare library entry - extract essential fields
                const libraryEntry = {
                    name: task.name,
                    category: (task as any).category || "User",
                    description: task.description || "",
                    params: JSON.parse(JSON.stringify(task.params || [])),
                    actionSequence: JSON.parse(JSON.stringify(task.actionSequence || [])),
                    flowChart: JSON.parse(JSON.stringify(flowChart))
                };

                const dialogData = {
                    json: JSON.stringify(libraryEntry, null, 4),
                    JsonOutput: JSON.stringify(libraryEntry, null, 4), // Matches component name in JSON
                    taskName: task.name
                };

                const result = await this.dialogManager.showDialog('export_dialog', true, dialogData);

                if (result.action === 'saveToLibrary') {
                    console.log('[JSONInspector] Saving task directly to library:', task.name);
                    try {
                        const response = await fetch('./api/library/tasks', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(libraryEntry)
                        });

                        if (response.ok) {
                            alert(`Task "${task.name}" wurde erfolgreich in der Library gespeichert!`);
                        } else {
                            const err = await response.json();
                            alert(`Fehler beim Speichern in der Library: ${err.error || response.statusText}`);
                        }
                    } catch (e) {
                        console.error('[JSONInspector] Error saving to library:', e);
                        alert('Netzwerkfehler beim Speichern in der Library.');
                    }
                }
                break;
            }

            case 'createAction': {
                const newActionNameInput = document.querySelector('input[placeholder="New Action Name"]') as HTMLInputElement;
                const newActionName = newActionNameInput?.value.trim();

                if (!newActionName) {
                    alert('Please enter an action name');
                    return;
                }

                if (this.project?.actions.find((a: any) => a.name === newActionName)) {
                    alert('Action with this name already exists');
                    return;
                }

                console.log('[JSONInspector] Creating new action:', newActionName);

                const result = await this.dialogManager.showDialog('action_editor', true, {
                    actionName: newActionName,
                    name: newActionName,
                    target: selectedObject?.name,
                    type: 'property',
                    changes: {}
                });

                if (result.action === 'save' && this.project) {
                    // result.data already contains the final structure - use a deep copy
                    const newAction = JSON.parse(JSON.stringify(result.data));

                    // Ensure name matches the intended name if it was changed or missing in result
                    newAction.name = result.data.name || result.data.actionName || newActionName;

                    this.project.actions.push(newAction);

                    if (newActionNameInput) newActionNameInput.value = '';
                    this.update(selectedObject);
                }
                break;
            }

            case 'addVariable': {
                console.log('[JSONInspector] Adding new variable via DialogService');

                // Use DialogService to show variable editor dialog
                serviceRegistry.call('Dialog', 'showDialog', ['variable_editor', true])
                    .then((result: any) => {
                        if (result?.action === 'save' && result.data) {
                            const data = result.data;

                            // Get values from dialog
                            const name = data.varName || '';
                            const typeValue = data.varType || 'Integer';
                            const type = typeValue.toLowerCase();
                            const scopeValue = data.varScope || 'Global';
                            const scope = scopeValue.toLowerCase();
                            const isPublic = data.isPublic === true;
                            let defaultValue: any = data.defaultValue || '';
                            const description = data.description || '';

                            // Validate using ProjectRegistry
                            const validation = projectRegistry.validateVariableName(name);
                            if (!validation.valid) {
                                alert(validation.error);
                                return;
                            }

                            // Convert to proper type
                            if (type === 'integer') {
                                defaultValue = parseInt(defaultValue) || 0;
                            } else if (type === 'real') {
                                defaultValue = parseFloat(defaultValue) || 0.0;
                            } else if (type === 'boolean') {
                                defaultValue = defaultValue === 'true' || defaultValue === true;
                            }

                            const newVariable = {
                                name,
                                type,
                                scope,
                                isPublic,
                                defaultValue,
                                value: defaultValue, // Initialize value with defaultValue
                                description
                            };

                            if (this.project) {
                                this.project.variables.push(newVariable);
                                console.log('[JSONInspector] Variable added:', newVariable);
                                this.update(selectedObject);
                                if (this.onProjectUpdate) this.onProjectUpdate();
                            }
                        }
                    })
                    .catch((err: any) => {
                        console.error('[JSONInspector] Dialog error:', err);
                    });
                break;
            }

            case 'editVariable':
            case 'deleteVariable': {
                if (!selectedObject) return;

                // Get index from element data (provided by TForEach)
                const varIndex = parseInt(buttonDef.variableIndex) || 0;
                if (varIndex === -1) return;

                if (buttonDef.action === 'deleteVariable') {
                    const variable = this.project?.variables[varIndex];
                    if (!variable) return;

                    // Check for references before deleting
                    const refs = projectRegistry.findReferences(variable.name);
                    let warning = '';
                    if (refs.length > 0) {
                        warning = `\n\nACHTUNG: Diese Variable wird an ${refs.length} Stellen verwendet:\n- ` +
                            refs.slice(0, 3).join('\n- ') +
                            (refs.length > 3 ? `\n... und ${refs.length - 3} weitere` : '');
                    }

                    if (confirm(`Möchtest du die Variable "${variable.name}" wirklich löschen?${warning}`)) {
                        if (this.project) {
                            this.project.variables.splice(varIndex, 1);
                            this.update(selectedObject);
                            if (this.onProjectUpdate) this.onProjectUpdate();
                        }
                    }
                } else { // editVariable
                    const variable = this.project?.variables[varIndex];
                    if (!variable) return;

                    console.log('[JSONInspector] Editing variable via DialogService:', variable);
                    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

                    const dialogData = {
                        varName: variable.name,
                        varType: capitalize(variable.type),
                        varScope: variable.scope || 'global',
                        isPublic: variable.isPublic || false,
                        defaultValue: String(variable.defaultValue),
                        value: String(variable.value !== undefined ? variable.value : variable.defaultValue),
                        description: variable.description || ''
                    };

                    // Use DialogService with pre-filled data
                    serviceRegistry.call('Dialog', 'showDialog', ['variable_editor', true, dialogData])
                        .then((result: any) => {
                            if (result?.action === 'save' && result.data) {
                                const data = result.data;

                                // Get values from dialog
                                const newName = data.varName || variable.name;
                                const typeValue = data.varType || 'Integer';
                                const newType = typeValue.toLowerCase();
                                const scopeValue = data.varScope || 'Global';
                                const newScope = scopeValue.toLowerCase();
                                const newIsPublic = data.isPublic === true;
                                let newDefaultValue: any = data.defaultValue || '';
                                let newValue: any = data.value !== undefined ? data.value : newDefaultValue;
                                const newDescription = data.description || '';

                                // Validate name if changed
                                if (newName !== variable.name) {
                                    const validation = projectRegistry.validateVariableName(newName);
                                    if (!validation.valid) {
                                        alert(validation.error);
                                        return;
                                    }

                                    // Use ProjectRegistry renaming logic if name changed
                                    if (projectRegistry.renameVariable(variable.name, newName)) {
                                        // Success, variable name updated in registry/project
                                    } else {
                                        alert('Fehler beim Umbenennen der Variable.');
                                        return;
                                    }
                                }

                                // Update other properties
                                // Note: if renamed via registry, the reference 'variable' might still be valid as it points to object in array
                                // But renameVariable updates the name property on it.
                                variable.type = newType;
                                variable.scope = newScope;
                                variable.isPublic = newIsPublic;
                                variable.defaultValue = newDefaultValue;
                                variable.value = newValue;
                                variable.description = newDescription;

                                console.log('[JSONInspector] Variable updated:', variable);
                                this.update(selectedObject);
                                if (this.onProjectUpdate) this.onProjectUpdate();
                            }
                        })
                        .catch((err: any) => {
                            console.error('[JSONInspector] Dialog error:', err);
                        });
                }
                break;
            }

            case 'copyVariable': {
                const varIndex = parseInt(buttonDef.variableIndex) || 0;
                const variable = this.project?.variables[varIndex];

                if (!variable) {
                    console.error('[JSONInspector] Variable not found at index:', varIndex);
                    return;
                }

                // Find unique copy name
                const baseName = variable.name.replace(/_Copy\d+$/, ''); // Remove existing _CopyN suffix
                let copyNum = 1;
                let newName = `${baseName}_Copy${copyNum}`;

                while (this.project?.variables.find((v: any) => v.name === newName)) {
                    copyNum++;
                    newName = `${baseName}_Copy${copyNum}`;
                }

                // Create copy
                const newVariable = {
                    name: newName,
                    type: variable.type,
                    scope: variable.scope || 'global',
                    defaultValue: variable.defaultValue,
                    description: variable.description || ''
                };

                this.project!.variables.push(newVariable);
                console.log('[JSONInspector] Variable copied:', variable.name, '->', newName);
                this.update(selectedObject);
                if (this.onProjectUpdate) this.onProjectUpdate();
                break;
            }

            default:
                console.warn('[JSONInspector] Unknown action:', buttonDef.action);
        }
    }

    /**
     * Handles object clicks (buttons)
     */
    private handleObjectClick(obj: any) {
        console.log('[JSONInspector] Object clicked:', obj.name);

        // Handle special buttons
        if (obj.name === 'DeleteButton') {
            const selectedObject = this.runtime.getVariable('selectedObject');
            if (!selectedObject) return;

            // Check if this is a Flow Element (Action or Task) and protect if referenced
            const elementType = selectedObject.getType?.();
            const elementName = selectedObject.Name || selectedObject.name;

            if (elementType === 'Action' || elementType === 'Task') {
                // Referenzen prüfen und als Warnung anzeigen (aber nicht blockieren)
                const refs = projectRegistry.findReferences(elementName);
                if (refs.length > 0) {
                    const refWarning = `⚠️ Achtung: Dieses ${elementType} wird noch verwendet in:\n${refs.join('\n')}\n\nReferenzen werden ebenfalls entfernt.`;
                    if (!confirm(`Möchtest du "${elementName}" wirklich löschen?\n\n${refWarning}`)) {
                        return; // Abbruch durch Benutzer
                    }
                }
            }

            if (this.onObjectDelete) {
                this.onObjectDelete(selectedObject);
            }
        }
    }

    /**
     * Debug: Shows reactive runtime stats
     */
    public debug() {
        this.runtime.debug();
    }

    /**
     * Clears the inspector
     */
    public clear() {
        this.container.innerHTML = '';
        this.runtime.clear();
    }

    /**
     * Get suggestions for binding variables
     */
    private getBindingSuggestions(): string[] {
        const suggestions = [
            '${isMultiplayer}',
            '${isHost}',
            '${playerNumber}',
            '${selectedObject.name}',
            '${selectedObject.id}'
        ];

        // Use ProjectRegistry to get all visible variables (Global, Stage, etc.)
        const visibleVars = projectRegistry.getVariables();
        visibleVars.forEach(v => {
            suggestions.push(`\${${v.name}}`);
        });

        return suggestions;
    }

}
