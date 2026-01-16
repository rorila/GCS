import { GameProject } from '../model/types';

import { FlowElement } from './flow/FlowElement';
import { FlowAction } from './flow/FlowAction';
import { FlowTask } from './flow/FlowTask';
import { FlowStart } from './flow/FlowStart';
import { FlowCondition } from './flow/FlowCondition';
import { FlowComponent } from './flow/FlowComponent';
import { FlowConnection } from './flow/FlowConnection';
import { FlowVariable } from './flow/FlowVariable';
import { FlowLoop } from './flow/FlowLoop';
import { FlowStateManager } from './flow/FlowStateManager';
import { TFlowStage } from '../components/TFlowStage';
import { serviceRegistry } from '../services/ServiceRegistry';
import { TaskEditor } from './TaskEditor';
import { ContextMenu, ContextMenuItem } from './ui/ContextMenu';
import { RefactoringManager } from './RefactoringManager';
import { projectRegistry } from '../services/ProjectRegistry';
import { libraryService } from '../services/LibraryService';

export class FlowEditor {
    private container: HTMLElement;
    private project: GameProject | null = null;
    public flowStage: TFlowStage; // Initialized in constructor or setProject

    // State Manager - Single Source of Truth für Flow-State
    private stateManager: FlowStateManager;

    private flowSelect!: HTMLSelectElement;

    private contextMenu: ContextMenu;

    private canvas: HTMLElement;

    public onObjectSelect?: (obj: FlowElement | null) => void;
    public onNodesChanged?: (nodes: FlowElement[]) => void;
    public onProjectChange?: () => void; // Callback to trigger auto-save in Editor

    // Interaction State
    private isDraggingHandle: boolean = false;
    private activeHandle: HTMLElement | null = null;
    private activeConnection: FlowConnection | null = null;

    // UI Elements
    private detailsToggleBtn!: HTMLButtonElement;
    private filterInput!: HTMLInputElement;
    private backButton!: HTMLButtonElement; // Zurück-Button
    public currentSelectedStageObjectId: string | null = null;
    private suggestedTaskName: string | null = null; // Für automatische Namensübernahme bei Drop

    // Navigation History
    private contextHistory: string[] = [];

    // Scroll positions per context (key = context name, value = {scrollX, scrollY})
    private scrollPositions: Map<string, { x: number; y: number }> = new Map();

    // Action-Check mode for highlighting unused actions
    private actionCheckMode: boolean = false;
    private actionCheckBtn!: HTMLButtonElement;

    // ─────────────────────────────────────────────
    // State Accessors (delegate to StateManager)
    // ─────────────────────────────────────────────
    private get nodes(): FlowElement[] {
        return this.stateManager.getNodesInternal();
    }
    private set nodes(value: FlowElement[]) {
        this.stateManager.setNodes(value);
    }
    private get connections(): FlowConnection[] {
        return this.stateManager.getConnectionsInternal();
    }
    private set connections(value: FlowConnection[]) {
        this.stateManager.setConnections(value);
    }
    private get selectedConnection(): FlowConnection | null {
        return this.stateManager.getSelectedConnection();
    }
    private set selectedConnection(value: FlowConnection | null) {
        this.stateManager.selectConnection(value);
    }
    private get currentFlowContext(): string {
        return this.stateManager.getContext();
    }
    private set currentFlowContext(value: string) {
        this.stateManager.setContext(value);
    }
    private get showDetails(): boolean {
        return this.stateManager.getShowDetails();
    }
    private set showDetails(value: boolean) {
        this.stateManager.setShowDetails(value);
    }
    private get filterText(): string {
        return this.stateManager.getFilter();
    }
    private set filterText(value: string) {
        this.stateManager.setFilter(value);
    }
    private get selectedNode(): FlowElement | null {
        return this.stateManager.getSelectedNode();
    }
    private set selectedNode(value: FlowElement | null) {
        // Note: For full selection use selectNode() method which also handles visual feedback
        // This setter is for internal state management only
        if (value) {
            this.stateManager.selectNode(value);
        } else {
            this.stateManager.selectNode(null);
        }
    }

    constructor(containerId: string) {
        const el = document.getElementById(containerId);
        if (!el) throw new Error(`Container ${containerId} not found`);
        this.container = el;

        // Initialize State Manager FIRST
        this.stateManager = new FlowStateManager();
        this.stateManager.loadShowDetailsFromStorage();

        this.contextMenu = new ContextMenu();

        // Initialize default FlowStage
        this.flowStage = new TFlowStage('FlowStage', 100, 100, 20);

        // Toolbar
        const toolbar = document.createElement('div');
        toolbar.style.cssText = 'padding:10px;border-bottom:1px solid #444;background:#252526;display:flex;gap:10px;align-items:center';

        // Flow Context Selector
        this.flowSelect = document.createElement('select');
        this.flowSelect.style.cssText = 'padding:5px;background:#333;color:white;border:1px solid #555;border-radius:4px;min-width:150px;margin-right:5px';
        this.flowSelect.onchange = () => this.switchActionFlow(this.flowSelect.value);
        toolbar.appendChild(this.flowSelect);

        // Back Button (Zurück)
        this.backButton = document.createElement('button');
        this.backButton.innerText = '← Zurück';
        this.backButton.title = 'Zurück zur vorherigen Ansicht';
        this.backButton.style.cssText = 'padding:5px 10px;background:#555;color:white;border:none;border-radius:4px;cursor:pointer;margin-right:5px;display:none';
        this.backButton.onclick = () => this.goBack();
        toolbar.appendChild(this.backButton);

        // New Task Button
        const newFlowBtn = document.createElement('button');
        newFlowBtn.innerText = '+';
        newFlowBtn.title = 'New Task Flow';
        newFlowBtn.style.cssText = 'padding:5px 10px;background:#007acc;color:white;border:none;border-radius:4px;cursor:pointer;margin-right:5px';
        newFlowBtn.onclick = () => this.createNewTaskFlow();
        toolbar.appendChild(newFlowBtn);

        // Delete Task Button
        const delFlowBtn = document.createElement('button');
        delFlowBtn.innerText = '-';
        delFlowBtn.title = 'Delete Current Task';
        delFlowBtn.style.cssText = 'padding:5px 10px;background:#ce3636;color:white;border:none;border-radius:4px;cursor:pointer;margin-right:10px';
        delFlowBtn.onclick = () => this.deleteCurrentTaskFlow();
        toolbar.appendChild(delFlowBtn);

        // Separator
        const sep = document.createElement('div');
        sep.style.cssText = 'width:1px;height:24px;background:#555;margin:0 10px';
        toolbar.appendChild(sep);

        // Details Toggle Button (showDetails already loaded from storage)
        const initialShowDetails = this.showDetails;
        this.detailsToggleBtn = document.createElement('button');
        this.detailsToggleBtn.innerText = initialShowDetails ? '📝 Details' : '📋 Konzept';
        this.detailsToggleBtn.title = 'Zwischen Konzept- und Details-Ansicht wechseln';
        this.detailsToggleBtn.style.cssText = 'padding:5px 10px;color:white;border:1px solid #666;border-radius:4px;cursor:pointer';
        this.detailsToggleBtn.style.background = initialShowDetails ? '#007acc' : '#444';
        this.detailsToggleBtn.onclick = () => this.toggleDetailsView();
        toolbar.appendChild(this.detailsToggleBtn);

        // Separator before Filter
        const sep2 = document.createElement('div');
        sep2.style.cssText = 'width:1px;height:24px;background:#555;margin:0 10px';
        toolbar.appendChild(sep2);

        // Filter Input
        toolbar.appendChild(document.createTextNode('Filter: '));
        this.filterInput = document.createElement('input');
        this.filterInput.placeholder = 'Suchen...';
        this.filterInput.style.cssText = 'padding:5px;background:#333;color:white;border:1px solid #555;border-radius:4px;width:120px';
        this.filterInput.oninput = () => {
            this.filterText = this.filterInput.value.toLowerCase();
            if (this.currentFlowContext === 'event-map') {
                this.loadFromProject();
            }
        };
        toolbar.appendChild(this.filterInput);

        // Action-Check Button (nur sichtbar in element-overview)
        this.actionCheckBtn = document.createElement('button');
        this.actionCheckBtn.innerText = '🔍 Action-Check';
        this.actionCheckBtn.title = 'Nicht verwendete Actions hervorheben';
        this.actionCheckBtn.style.cssText = 'padding:5px 10px;background:#e65100;color:white;border:none;border-radius:4px;cursor:pointer;margin-left:10px;display:none';
        this.actionCheckBtn.onclick = () => this.toggleActionCheckMode();
        toolbar.appendChild(this.actionCheckBtn);

        this.container.appendChild(toolbar);

        // Canvas (Drop Area)
        this.canvas = document.createElement('div');
        this.canvas.id = 'flow-canvas';
        this.canvas.style.cssText = 'flex:1;background:#1e1e1e;position:relative;overflow:auto;width:100%;height:calc(100% - 40px);background-image:radial-gradient(#333 1px, transparent 1px);background-size:20px 20px';

        // Add a world container that will dictate the scroll size
        const world = document.createElement('div');
        world.id = 'flow-world';
        world.style.cssText = 'position:absolute;top:0;left:0;width:5000px;height:5000px;pointer-events:none';
        this.canvas.appendChild(world);

        // Drop Handler
        this.canvas.ondragover = (e) => e.preventDefault();
        this.canvas.ondrop = (e) => this.handleDrop(e);
        this.canvas.onmousedown = (e) => this.handleCanvasClick(e);

        this.container.appendChild(this.canvas);

        // Global interaction listener for handle dragging
        document.addEventListener('mousemove', (e) => this.handleGlobalMove(e));
        document.addEventListener('mouseup', (e) => this.handleGlobalUp(e));

        // Key listener for deletion
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                // Don't delete if we are in an input field
                if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

                if (this.selectedConnection) {
                    this.deleteConnection(this.selectedConnection);
                } else if (this.selectedNode) {
                    this.deleteNode(this.selectedNode);
                }
            }
        });
    }

    public setProject(project: GameProject) {
        this.project = project;
        if (!this.project.actions) this.project.actions = [];
        if (!this.project.tasks) this.project.tasks = [];

        // Ensure global flow structure exists
        if (!this.project.flow) {
            this.project.flow = {
                stage: {
                    cols: 100, rows: 100, cellSize: 20, snapToGrid: true, visible: true, backgroundColor: '#1e1e1e'
                },
                elements: [], connections: []
            };
        }

        // Initialize FlowStage config
        this.flowStage = new TFlowStage('FlowStage',
            this.project.flow.stage?.cols ?? 100,
            this.project.flow.stage?.rows ?? 100,
            this.project.flow.stage?.cellSize ?? 20
        );
        this.flowStage.snapToGrid = this.project.flow.stage?.snapToGrid ?? true;
        this.flowStage.showGrid = this.project.flow.stage?.visible ?? true;
        this.flowStage.style.backgroundColor = this.project.flow.stage?.backgroundColor || '#1e1e1e';

        const savedContext = localStorage.getItem('gcs_last_flow_context');
        const isValidTask = this.project.tasks.some(t => t.name === savedContext);
        const isStaticContext = savedContext === 'global' || savedContext === 'event-map' || savedContext === 'element-overview';

        if (savedContext && (isStaticContext || isValidTask)) {
            this.currentFlowContext = savedContext;
        } else {
            this.currentFlowContext = 'global';
        }
        this.updateFlowSelector();

        // Load graph data
        this.loadFromProject();

        this.updateGrid();

        // Initial registry build
        this.rebuildActionRegistry();
    }

    /**
     * Synchronisiert Action-Daten in FlowCharts mit den aktuellen Definitionen aus project.actions.
     * Wichtig: Rufe diese Methode auf, nachdem Actions im JSON-Editor geändert wurden,
     * um sicherzustellen, dass FlowChart-Elemente die aktualisierten Daten verwenden.
     */
    public syncActionsFromProject(): void {
        if (!this.project) return;

        let syncCount = 0;

        // Helper: Update action data in a single element
        const syncElement = (el: any) => {
            if (el.type !== 'Action') return;

            const actionName = el.properties?.name || el.data?.name;
            if (!actionName) return;

            const projectAction = this.project!.actions.find(a => a.name === actionName);
            if (projectAction) {
                // Update the element's data with the current action definition
                // Keep node-specific properties (isEmbeddedInternal, parentProxyId, etc.)
                const preserveKeys = ['isEmbeddedInternal', 'parentProxyId', 'parentParams', 'showDetails', 'originalId'];
                const preserved: any = {};
                preserveKeys.forEach(key => {
                    if (el.data?.[key] !== undefined) preserved[key] = el.data[key];
                });

                el.data = { ...projectAction, ...preserved };
                syncCount++;
            }
        };

        // 1. Sync FlowCharts (stored in project.flowCharts)
        if (this.project.flowCharts) {
            Object.keys(this.project.flowCharts).forEach(chartKey => {
                const chart = this.project!.flowCharts![chartKey];
                if (chart?.elements) {
                    chart.elements.forEach(syncElement);
                }
            });
        }

        // 2. Sync legacy task.flowGraph (if any)
        this.project.tasks.forEach(task => {
            const anyTask = task as any;
            if (anyTask.flowGraph?.elements) {
                anyTask.flowGraph.elements.forEach(syncElement);
            }
        });

        // 3. Sync currently loaded nodes in the editor
        this.nodes.forEach(node => {
            if (node.getType() !== 'Action') return;

            const actionName = node.Name;
            const projectAction = this.project!.actions.find(a => a.name === actionName);
            if (projectAction) {
                const preserveKeys = ['isEmbeddedInternal', 'parentProxyId', 'parentParams', 'showDetails', 'originalId'];
                const preserved: any = {};
                preserveKeys.forEach(key => {
                    if (node.data?.[key] !== undefined) preserved[key] = node.data[key];
                });

                node.data = { ...projectAction, ...preserved };
            }
        });

        // Refresh the display to show updated action details
        this.updateActionDetails();
    }

    private createNewTaskFlow() {
        if (!this.project) return;

        // Prompt for Task Name (Use simple prompt for now, or DialogService later)
        const name = prompt('Enter new Task Name (PascalCase):');
        if (!name) return;

        // Validation
        if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
            alert('Task Name must be PascalCase (Start with Uppercase, no spaces/special chars).');
            return;
        }

        if (this.project.tasks.some(t => t.name === name)) {
            alert('Task with this name already exists.');
            return;
        }

        // Create Task (without flowGraph - it's stored separately)
        this.project.tasks.push({
            name: name,
            actionSequence: []
        });

        // Initialize flowChart for this task
        if (!this.project.flowCharts) this.project.flowCharts = {};
        this.project.flowCharts[name] = { elements: [], connections: [] };

        // Namen für den nächsten Drop merken
        this.suggestedTaskName = name;

        // Update UI
        this.updateFlowSelector();

        // Switch to new Task
        this.switchActionFlow(name);
    }

    private deleteCurrentTaskFlow() {
        if (!this.project || this.currentFlowContext === 'global') {
            alert('Cannot delete the Main Flow (Global).');
            return;
        }

        if (!confirm(`Are you sure you want to delete Task "${this.currentFlowContext}" and its flow?`)) {
            return;
        }

        // Use RefactoringManager for clean project-wide deletion
        RefactoringManager.deleteTask(this.project, this.currentFlowContext);

        // Switch to Global
        this.currentFlowContext = 'global';
        this.updateFlowSelector();
        this.loadFromProject();

        // Notify Editor to trigger auto-save
        if (this.onProjectChange) this.onProjectChange();
    }

    private updateFlowSelector() {
        if (!this.project) return;
        this.flowSelect.innerHTML = '';

        // Project Map Option
        const mapOpt = document.createElement('option');
        mapOpt.value = 'event-map';
        mapOpt.text = '🔍 Projekt-Landkarte (Explorer)';
        this.flowSelect.appendChild(mapOpt);

        // Elements Overview Option
        const overviewOpt = document.createElement('option');
        overviewOpt.value = 'element-overview';
        overviewOpt.text = '📋 Elementen-Übersicht (Cleanup)';
        this.flowSelect.appendChild(overviewOpt);

        // Global Option
        const globalOpt = document.createElement('option');
        globalOpt.value = 'global';
        globalOpt.text = 'Main Flow (Global)';
        this.flowSelect.appendChild(globalOpt);

        // Task Options
        this.project.tasks.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.name;
            opt.text = `Task: ${t.name}`;
            this.flowSelect.appendChild(opt);
        });

        // Set value
        this.flowSelect.value = this.currentFlowContext;
    }

    private switchActionFlow(context: string, addToHistory: boolean = true) {
        if (this.currentFlowContext === context) return;

        // 1. Save current scroll position before switching
        if (this.currentFlowContext) {
            this.scrollPositions.set(this.currentFlowContext, {
                x: this.canvas.scrollLeft,
                y: this.canvas.scrollTop
            });
        }

        // 2. Save current state
        this.syncToProject();

        // 3. Add current context to history before switching (for back navigation)
        if (addToHistory && this.currentFlowContext) {
            this.contextHistory.push(this.currentFlowContext);
            // Limit history size to prevent memory issues
            if (this.contextHistory.length > 20) {
                this.contextHistory.shift();
            }
        }

        // 4. Switch context
        this.currentFlowContext = context;
        localStorage.setItem('gcs_last_flow_context', context);

        // 5. Load new state
        this.loadFromProject();

        // 6. Reset Action-Check mode when leaving element-overview
        if (context !== 'element-overview' && this.actionCheckBtn) {
            this.actionCheckBtn.style.display = 'none';
            this.actionCheckMode = false;
            this.actionCheckBtn.style.background = '#e65100';
            this.actionCheckBtn.innerText = '🔍 Action-Check';
        }

        // 7. Update dropdown to show current context
        this.flowSelect.value = context;
        this.rebuildActionRegistry();

        // 7. Update back button visibility
        this.updateBackButtonVisibility();

        // 8. Restore scroll position for new context (or reset to top)
        const savedPos = this.scrollPositions.get(context);
        // Use requestAnimationFrame to ensure DOM is updated after loadFromProject()
        requestAnimationFrame(() => {
            if (savedPos) {
                this.canvas.scrollLeft = savedPos.x;
                this.canvas.scrollTop = savedPos.y;
            } else {
                // New context without saved position: scroll to top
                this.canvas.scrollLeft = 0;
                this.canvas.scrollTop = 0;
            }
        });
    }

    /**
     * Navigate back to the previous view context
     */
    private goBack() {
        if (this.contextHistory.length === 0) return;

        const previousContext = this.contextHistory.pop()!;
        this.switchActionFlow(previousContext, false); // Don't add to history when going back
    }

    /**
     * Update back button visibility based on history
     */
    private updateBackButtonVisibility() {
        if (this.backButton) {
            this.backButton.style.display = this.contextHistory.length > 0 ? 'block' : 'none';
        }
    }

    private rebuildActionRegistry() {
        if (!this.project) return;
        this.project.actions = this.project.actions || [];

        // Initialize registry
        this.project.actions = this.project.actions || [];

        const register = (elements: any[]) => {
            elements.forEach(el => {
                if (el.type === 'Action') {
                    // Normalize name and details
                    const name = el.properties?.name || el.data?.name || el.data?.actionName || el.properties?.text;
                    const details = el.properties?.details || el.data?.details;

                    const isMeaningful = el.data?.type || el.data?.actionName || el.data?.taskName || (el.properties?.details && el.properties.details.trim() !== '');
                    if (name && (name !== 'Action' && name !== 'Aktion' || isMeaningful)) {
                        this.updateGlobalActionDefinition({ ...el.data, name, details });
                    }
                }
            });
        };

        // 1. Scan Global Flow (legacy 'flow' or new 'flowCharts.global')
        const globalFlowElements = this.project.flowCharts?.global?.elements || this.project.flow?.elements;
        if (globalFlowElements) {
            register(globalFlowElements);
        }

        // 2. Scan Task Flows from flowCharts
        if (this.project.flowCharts) {
            Object.keys(this.project.flowCharts).forEach(key => {
                if (key !== 'global') {
                    const flowChart = this.project!.flowCharts![key];
                    if (flowChart?.elements) {
                        register(flowChart.elements);
                    }
                }
            });
        }
        console.log(`[FlowEditor] Registry rebuilt. Total actions: ${this.project.actions.length}`);
    }

    private parseDetailsToCommand(details: string): any {
        if (!details) return null;

        // Handle multiple assignments within one string (e.g., "x := 10; y := 20")
        const commands = details.split(';').map(s => s.trim()).filter(s => s.length > 0);

        if (commands.length > 1) {
            // Check if all are property assignments to the same target
            const subParses = commands.map(cmd => {
                const match = cmd.match(/^([a-zA-Z0-9_.]+)\s*:=\s*(.+)$/);
                if (match) {
                    const target = match[1];
                    const source = match[2].trim();
                    if (target.includes('.')) {
                        const [objName, propName] = target.split('.');
                        return { objName, propName, source };
                    }
                }
                return null;
            }).filter(p => p !== null);

            if (subParses.length > 0) {
                const targetObj = subParses[0]!.objName;
                // Ensure all sub-parses refer to the same object
                if (subParses.every(p => p!.objName === targetObj)) {
                    const changes: Record<string, any> = {};
                    subParses.forEach(p => {
                        let finalVal: any = p!.source;
                        if (p!.source.startsWith("'") && p!.source.endsWith("'")) {
                            finalVal = p!.source.slice(1, -1);
                        } else if (/^\d+(\.\d+)?$/.test(p!.source)) {
                            finalVal = parseFloat(p!.source);
                        } else if (/^[a-zA-Z0-9_$]+$/.test(p!.source)) {
                            finalVal = `\${${p!.source}}`;
                        }
                        changes[p!.propName] = finalVal;
                    });

                    return {
                        type: 'property',
                        target: targetObj,
                        changes: changes
                    };
                }
            }
        }

        // Fallback or single assignment logic
        const assignMatch = details.match(/^([a-zA-Z0-9_.]+)\s*:=\s*(.+)$/);
        if (assignMatch) {
            const target = assignMatch[1];
            let source = assignMatch[2].trim();

            if (target.includes('.')) {
                const [objName, propName] = target.split('.');
                let val: any = source;
                if (source.startsWith("'") && source.endsWith("'")) {
                    val = source.slice(1, -1);
                } else if (/^\d+(\.\d+)?$/.test(source)) {
                    val = parseFloat(source);
                } else if (/^[a-zA-Z0-9_$]+$/.test(source)) {
                    val = `\${${source}}`;
                }

                return {
                    type: 'property',
                    target: objName,
                    changes: { [propName]: val }
                };
            } else {
                const isNumeric = /^\d+(\.\d+)?$/.test(source);
                return {
                    type: 'calculate',
                    resultVariable: target,
                    calcSteps: [{
                        operandType: isNumeric ? 'constant' : 'variable',
                        constant: isNumeric ? parseFloat(source) : 0,
                        variable: isNumeric ? undefined : source
                    }]
                };
            }
        }
        return null;
    }

    private findActionInSequence(sequence: any[], name: string): any | null {
        if (!sequence) return null;
        for (const item of sequence) {
            const itemName = item.name || item.actionName;
            if (itemName === name) return item;
            if (item.body) {
                const found = this.findActionInSequence(item.body, name);
                if (found) return found;
            }
            if (item.then) {
                const found = this.findActionInSequence(item.then, name);
                if (found) return found;
            }
            if (item.else) {
                const found = this.findActionInSequence(item.else, name);
                if (found) return found;
            }
        }
        return null;
    }

    private updateGlobalActionDefinition(actionData: any) {
        if (!this.project) return;

        // Normalize name - handle both legacy and new standard
        const name = actionData.name || actionData.actionName;
        if (!name) {
            // console.log('[FlowEditor] Action node has no name, skipping registration.');
            return;
        }

        // Ensure actions array exists
        if (!this.project.actions) this.project.actions = [];

        // Filter out Task-specific and internal fields that don't belong in an Action
        const taskFields = ['taskName', 'isMapLink', 'isProxy', 'stageObjectId', 'embeddedGroupId', 'parentProxyId', 'isLinked', 'isEmbeddedInternal', 'isExpanded', 'sourceTaskName'];
        const cleanedData = { ...actionData };
        taskFields.forEach(field => delete cleanedData[field]);

        const newAction = {
            ...cleanedData,
            name: name
        };
        // AUTO-PARSE: If it's a "ghost" action (no logic) but has details, try to populate it
        if (newAction.details && !newAction.type && !newAction.target && !newAction.service && !newAction.calcSteps) {
            const parsed = this.parseDetailsToCommand(newAction.details);
            if (parsed) {
                console.log(`[FlowEditor] Auto-parsed logic for ${name}:`, parsed);
                Object.assign(newAction, parsed);
            }
        }

        // Clean up legacy property if it exists
        if (newAction.actionName) delete newAction.actionName;

        // Update or Add
        const idx = this.project.actions.findIndex(a => a.name === name);
        if (idx !== -1) {
            // Only update if changed? For now overwrite.
            this.project.actions[idx] = { ...this.project.actions[idx], ...newAction };
        } else {
            console.log(`[FlowEditor] Registering new global action: ${name}`);
            this.project.actions.push(newAction);
        }
    }

    /**
     * Generates a unique action name with a running number (Aktion1, Aktion2, etc.)
     * Checks both project actions and current flow nodes for uniqueness.
     */
    private generateUniqueActionName(baseName: string = 'Aktion'): string {
        let counter = 1;
        let finalName = baseName;

        // Collect all existing action names from project and current nodes
        const existingNames = new Set<string>();

        // From project actions
        if (this.project?.actions) {
            this.project.actions.forEach(a => existingNames.add(a.name));
        }

        // From current flow nodes (including unnamed ones that might not be synced yet)
        this.nodes.forEach(n => {
            if (n.getType() === 'Action') {
                existingNames.add(n.Name || n.name);
            }
        });

        // If the base name itself is taken, start numbering
        if (existingNames.has(finalName)) {
            while (existingNames.has(`${baseName}${counter}`)) {
                counter++;
            }
            finalName = `${baseName}${counter}`;
        }

        return finalName;
    }

    /**
     * Ensures a task exists in project.tasks. Creates it if not present.
     */
    private ensureTaskExists(taskName: string, description?: string) {
        if (!this.project) return;

        // Ensure tasks array exists
        if (!this.project.tasks) this.project.tasks = [];

        // Check if task already exists
        const existingTask = this.project.tasks.find(t => t.name === taskName);
        if (existingTask) {
            // Update description if provided and not already set
            if (description && !existingTask.description) {
                existingTask.description = description;
            }
            return;
        }

        // Create new task
        console.log(`[FlowEditor] Creating new task: ${taskName}`);
        this.project.tasks.push({
            name: taskName,
            description: description || '',
            actionSequence: []
        });
    }

    public syncToProject() {
        if (!this.project) return;
        if (this.currentFlowContext === 'event-map' || this.currentFlowContext === 'element-overview') return;

        // 0. CAPTURE all current ghost node positions and connection anchors into their respective proxies
        // This ensures that manual layout and anchor changes are persisted before the diagram is saved/switched
        const proxyNodes = this.nodes.filter(n => n.data?.isExpanded);
        proxyNodes.forEach(proxy => {
            // 0a. Capture Node Positions (Keyed by originalId)
            const ghosts = this.nodes.filter(n => n.data?.parentProxyId === proxy.name);
            if (ghosts.length > 0) {
                if (!proxy.data.ghostPositions) proxy.data.ghostPositions = {};
                ghosts.forEach(g => {
                    const originalId = g.data?.originalId;
                    if (originalId) {
                        proxy.data.ghostPositions[originalId] = { x: g.X, y: g.Y };
                    }
                });
            }

            // 0b. Capture ALL Connections within this expanded proxy
            const ghostConns = this.connections.filter(c => c.data?.parentProxyId === proxy.name);
            if (ghostConns.length > 0) {
                // We store the full connection state but translated back to originalIds
                // This allows us to RE-APPLY these overrides during import
                proxy.data.ghostConnections = ghostConns.map(c => {
                    const startNode = c.startTarget;
                    const endNode = c.endTarget;

                    // If both targets are known, we can store a robust reference
                    if (startNode && endNode) {
                        return {
                            startOriginalId: startNode.data?.originalId || startNode.name,
                            endOriginalId: endNode.data?.originalId || endNode.name,
                            originalStartAnchorType: c.data?.originalStartAnchorType || c.data?.startAnchorType || 'output',
                            startAnchorType: c.data?.startAnchorType,
                            endAnchorType: c.data?.endAnchorType
                        };
                    }
                    return null;
                }).filter(Boolean);
            }
        });

        // Sync Global Actions from current nodes
        let syncCount = 0;

        // Filter out elements that are internally embedded (Ghost Nodes)
        // We only want to save the "Proxy" nodes that trigger the expansion
        const persistentNodes = this.nodes.filter(n => !n.data?.isEmbeddedInternal && !n.data?.parentProxyId);
        const elements = persistentNodes.map(n => n.toJSON());

        const persistentConnections = this.connections.filter(c => {
            // A connection is persistent if it's NOT a ghost connection
            return !c.data?.isEmbeddedInternal && !c.data?.parentProxyId;
        });
        const connections = persistentConnections.map(c => c.toJSON());

        this.nodes.forEach(node => {
            if (node.getType() === 'Action' && node.data && !node.data.isEmbeddedInternal) {
                // Ensure we have a name to sync with
                const actionName = node.Name || node.data.name || node.data.actionName;
                if (actionName && actionName !== 'Aktion' && actionName !== 'Action') {
                    this.updateGlobalActionDefinition({ ...node.data, name: actionName, details: node.Details });
                    syncCount++;
                }
            }

            // SYNC TASK NODES: Create task entry if it doesn't exist
            // IMPORTANT: Do NOT create tasks for linked proxy nodes (they reference library tasks)
            // and do NOT create tasks for embedded internal nodes (ghost nodes from expansion)
            if (node.getType() === 'Task' && !node.data?.isEmbeddedInternal && !node.data?.isMapLink && !node.data?.isProxy && !node.data?.isLinked) {
                const taskName = node.Name || node.data?.name || node.data?.taskName;
                if (taskName && taskName !== 'Task') {
                    // Don't create shadow tasks for library tasks
                    if (!libraryService.getTask(taskName)) {
                        this.ensureTaskExists(taskName, node.Description);
                    }
                }
            }
        });

        if (this.currentFlowContext === 'global') {
            // Global Flow Storage - using new flowCharts.global structure
            if (!this.project.flowCharts) this.project.flowCharts = {};
            this.project.flowCharts.global = {
                elements: elements,
                connections: connections,
                stage: {
                    cols: this.flowStage.cols,
                    rows: this.flowStage.rows,
                    cellSize: this.flowStage.cellSize,
                    snapToGrid: this.flowStage.snapToGrid,
                    visible: this.flowStage.showGrid,
                    backgroundColor: this.flowStage.style.backgroundColor || '#1e1e1e'
                }
            };

            // Also keep legacy 'flow' for backwards compatibility during transition
            if (!this.project.flow) {
                this.project.flow = {
                    stage: { cols: 100, rows: 100, cellSize: 20, snapToGrid: true, visible: true, backgroundColor: '#1e1e1e' },
                    elements: [], connections: []
                };
            }
            this.project.flow.elements = elements;
            this.project.flow.connections = connections;
            this.project.flow.stage = this.project.flowCharts.global.stage!;

            // VARIABLE SYNC: Sync global variables from nodes
            this.syncVariablesFromFlow();

        } else {
            // Task Specific Flow - using flowCharts[taskName]
            const task = this.project.tasks.find(t => t.name === this.currentFlowContext);
            if (task) {
                // Store in flowCharts
                if (!this.project.flowCharts) this.project.flowCharts = {};
                console.log(`[FlowEditor] syncToProject: Saving ${elements.length} elements to project.flowCharts["${this.currentFlowContext}"]`);
                this.project.flowCharts[this.currentFlowContext] = { elements, connections };

                // LOGIC SYNC: Generate Action Sequence from Graph
                this.syncTaskFromFlow(task, elements, connections);

                // PARAMETER SYNC: Extract and sync parameters from Actions
                this.syncTaskParameters(task, elements);

                // PARAMETER VALUE SYNC: Sync edited param values from Task node to task.params defaults
                this.syncTaskParamValues(task, elements);

                // VARIABLE SYNC: Sync task-scoped variables from nodes
                this.syncVariablesFromFlow();
            }
        }

        // Notify Editor to trigger auto-save
        if (this.onProjectChange) {
            this.onProjectChange();
        }

        // Update flow selector to show any newly created tasks
        this.updateFlowSelector();
    }

    /**
     * Extracts ${param} placeholders from all Action nodes and syncs them to the task's params array.
     * Adds new params, removes unused params, warns about type conflicts.
     */
    private syncTaskParameters(task: any, elements: any[]) {
        // Extract all ${param} references from Action nodes
        const usedParams = new Map<string, { types: Set<string>, sources: string[] }>();
        const paramRegex = /\$\{(\w+)\}/g;

        elements.forEach((el: any) => {
            if (el.type !== 'Action') return;

            // Stringify the action data to find all ${param} occurrences
            const jsonStr = JSON.stringify(el.data || {});
            let match;
            while ((match = paramRegex.exec(jsonStr)) !== null) {
                const paramName = match[1];
                if (!usedParams.has(paramName)) {
                    usedParams.set(paramName, { types: new Set<string>(), sources: [] });
                }
                usedParams.get(paramName)!.sources.push(el.properties?.name || el.id);

                // Try to infer type from context
                // Look for number-ish values like velocity, speed, x, y
                if (/velocity|speed|x|y|width|height|size|delay|duration/i.test(paramName)) {
                    usedParams.get(paramName)!.types.add('number');
                } else {
                    usedParams.get(paramName)!.types.add('string');
                }
            }
        });

        // Initialize params array if not present
        if (!task.params) task.params = [];

        // Track which existing params are still used
        const existingParamNames = new Set(task.params.map((p: any) => p.name));
        const nowUsedNames = new Set(usedParams.keys());

        // Add new params
        usedParams.forEach((info, paramName) => {
            if (!existingParamNames.has(paramName)) {
                // Determine type (prefer number if any source suggests it)
                const type = info.types.has('number') ? 'number' : 'string';

                task.params.push({
                    name: paramName,
                    type: type,
                    label: paramName,
                    default: type === 'number' ? 0 : ''
                });
                console.log(`[FlowEditor] Parameter hinzugefügt: ${paramName} (${type})`);
            }

            // Check for type conflicts
            if (info.types.size > 1) {
                console.warn(`[FlowEditor] Typ-Konflikt bei Parameter "${paramName}": Verschiedene Typen in Actions ${info.sources.join(', ')}`);
            }
        });

        // Remove unused params (only if they were auto-generated, not from library)
        // We only remove params that are no longer referenced
        const removedParams: string[] = [];
        task.params = task.params.filter((p: any) => {
            // Keep library-defined params (they have metadata)
            if (p.fromLibrary) return true;

            // Remove if no longer used
            if (!nowUsedNames.has(p.name)) {
                removedParams.push(p.name);
                return false;
            }
            return true;
        });

        if (removedParams.length > 0) {
            console.log(`[FlowEditor] Unbenutzte Parameter entfernt: ${removedParams.join(', ')}`);
        }
    }

    /**
     * Syncs parameter VALUES from the Task entry node in the FlowChart back to task.params defaults.
     * This ensures edited values in the Inspector are used at runtime.
     */
    private syncTaskParamValues(task: any, elements: any[]) {
        if (!task.params || !Array.isArray(task.params)) return;

        // Find the Task entry node (same name as the task)
        const taskNode = elements.find(el =>
            el.type === 'Task' &&
            (el.properties?.name === task.name || el.data?.taskName === task.name)
        );

        if (!taskNode) return;

        // Get param values from either paramValues or params object
        const paramValues = taskNode.data?.paramValues || taskNode.data?.params;
        if (!paramValues || typeof paramValues !== 'object') return;

        let syncedCount = 0;
        task.params.forEach((p: any) => {
            if (p.name && paramValues[p.name] !== undefined) {
                const newValue = paramValues[p.name];
                if (p.default !== newValue) {
                    console.log(`[FlowEditor] syncTaskParamValues: ${task.name}.${p.name} = ${newValue}`);
                    p.default = newValue;
                    syncedCount++;
                }
            }
        });

        if (syncedCount > 0) {
            console.log(`[FlowEditor] Synced ${syncedCount} param values for task "${task.name}"`);
        }
    }

    /**
     * Synchronizes VariableDecl nodes from the current diagram with the project's variables list.
     * Only manages variables with a scope matching the current context (global or taskName).
     */
    private syncVariablesFromFlow() {
        if (!this.project) return;
        if (!this.project.variables) this.project.variables = [];

        const currentScope = this.currentFlowContext === 'global' ? 'global' : this.currentFlowContext;

        // 1. Get all VariableDecl nodes in the current diagram (ignore ghosts)
        const varNodes = this.nodes.filter(n => n.getType() === 'VariableDecl' && !n.data?.isEmbeddedInternal);
        const nodeVars = varNodes.map(n => n.data.variable).filter(v => !!v);

        console.log(`[FlowEditor] syncVariablesFromFlow: Found ${nodeVars.length} variable dec nodes in scope "${currentScope}"`);

        // 2. Identify variables that currently belong to this scope in the project
        const projectVarsInScope = this.project.variables.filter(v => v.scope === currentScope);

        // 3. Update or Add variables from nodes
        nodeVars.forEach(vData => {
            const existingIdx = this.project!.variables.findIndex(v => v.name === vData.name && v.scope === currentScope);
            if (existingIdx >= 0) {
                // Update
                this.project!.variables[existingIdx] = { ...this.project!.variables[existingIdx], ...vData, scope: currentScope };
            } else {
                // Add
                this.project!.variables.push({ ...vData, scope: currentScope });
                console.log(`[FlowEditor] Added variable "${vData.name}" to scope "${currentScope}"`);
            }
        });

        // 4. Remove variables in project that no longer have a node in the diagram (within THIS scope)
        const nodeVarNames = new Set(nodeVars.map(v => v.name));
        const toRemove = projectVarsInScope.filter(v => !nodeVarNames.has(v.name));

        if (toRemove.length > 0) {
            this.project.variables = this.project.variables.filter(v => {
                if (v.scope === currentScope && !nodeVarNames.has(v.name)) {
                    console.log(`[FlowEditor] Removed variable "${v.name}" from scope "${currentScope}" (node deleted)`);
                    return false;
                }
                return true;
            });
        }
    }

    private syncTaskFromFlow(task: any, elements: any[], connections: any[]) {
        // SAFETY: Only sync task logic if we are actually in a flow-view that contains task logic.
        // In the Event-Map or Element-Overview, we only have proxy nodes which would clear the sequence.
        if (this.currentFlowContext === 'event-map' || this.currentFlowContext === 'element-overview') {
            console.log(`[FlowEditor] syncTaskFromFlow: Skipped for task "${task.name}" (Context is "${this.currentFlowContext}")`);
            return;
        }

        const startNode = elements.find(e => e.type === 'Task' || (e.type === 'Start' && e.properties?.text?.toLowerCase() === 'start'));
        if (!startNode) {
            console.log(`[FlowEditor] syncTaskFromFlow: No start node found for task "${task.name}". Keeping existing sequence (len: ${task.actionSequence?.length || 0}).`);
            return;
        }

        console.log(`[FlowEditor] syncTaskFromFlow: Regenerating sequence for task "${task.name}" from ${elements.length} elements.`);

        const sequence: any[] = [];
        const visited = new Set<string>();

        const buildSequence = (nodeId: string, targetSeq: any[], stopSet: Set<string> = new Set()) => {
            if (!nodeId || visited.has(nodeId) || stopSet.has(nodeId)) return;

            const node = elements.find(e => e.id === nodeId);
            if (!node) return;

            // Mark as visited to avoid infinite loops in the graph
            visited.add(nodeId);

            const nodeType = node.type;
            const name = node.properties?.name || node.data?.name || node.data?.actionName || node.properties?.text;

            if (nodeType === 'Action' || nodeType === 'Task') {
                const item: any = {
                    type: nodeType === 'Task' ? 'task' : 'action',
                    name: name
                };

                // Embed local action data if not a global action
                if (node.data && nodeType === 'Action') {
                    const isGlobalAction = this.project?.actions?.some(a => a.name === name);
                    if (node.data.type && !isGlobalAction) {
                        Object.assign(item, node.data);
                        item.name = name;
                    }
                }
                targetSeq.push(item);

                // Continue to next node
                const outgoing = connections.find(c =>
                    c.startTargetId === node.id &&
                    (!c.data?.startAnchorType || ['output', 'right', 'bottom'].includes(c.data?.startAnchorType))
                );
                if (outgoing) {
                    buildSequence(outgoing.endTargetId, targetSeq, stopSet);
                }
            } else if (nodeType === 'Condition') {
                const conditionItem: any = {
                    type: 'condition',
                    condition: node.data?.condition || { variable: 'var', operator: '==', value: 'val' },
                    body: [],
                    elseBody: []
                };
                targetSeq.push(conditionItem);

                // Find True/False branches
                const trueConn = connections.find(c =>
                    c.startTargetId === node.id &&
                    (c.data?.anchorType === 'true' || c.data?.startAnchorType === 'true' || c.data?.branchType === 'true')
                );
                const falseConn = connections.find(c =>
                    c.startTargetId === node.id &&
                    (c.data?.anchorType === 'false' || c.data?.startAnchorType === 'false' || c.data?.branchType === 'false')
                );

                if (trueConn) {
                    buildSequence(trueConn.endTargetId, conditionItem.body, stopSet);
                }
                if (falseConn) {
                    // Important for else-if: Stop if hitting another condition that we will process later
                    // (Actually, recursive call is fine, but we need to manage visited set carefully)
                    buildSequence(falseConn.endTargetId, conditionItem.elseBody, stopSet);
                }
            } else if (nodeType === 'While' || nodeType === 'For') {
                const loopItem: any = {
                    type: nodeType.toLowerCase(),
                    body: []
                };
                if (nodeType === 'While') {
                    loopItem.condition = node.data?.condition || { variable: 'var', operator: '==', value: 'val' };
                } else {
                    Object.assign(loopItem, node.data?.loop || { iterator: 'i', from: 0, to: 10, step: 1 });
                }
                targetSeq.push(loopItem);

                // Body Branch (True/Body)
                const bodyConn = connections.find(c =>
                    c.startTargetId === node.id &&
                    (c.data?.anchorType === 'true' || c.data?.startAnchorType === 'true' || c.data?.branchType === 'true')
                );
                if (bodyConn) {
                    // To capture the body, we recurse but treat CURRENT LOOP NODE as a stop node
                    // We also need to temporarily REMOVE the current node from visited so we can "see" the cycle end
                    visited.delete(node.id);
                    const bodyVisited = new Set(visited); // Local visited set for the body

                    // We need a separate builder for the cycle to not mess with the global visited set too much
                    const buildSubSequence = (sNodeId: string, sTargetSeq: any[], sStopNodeId: string, sVisited: Set<string>) => {
                        if (!sNodeId || sNodeId === sStopNodeId || sVisited.has(sNodeId)) return;
                        sVisited.add(sNodeId);

                        const sNode = elements.find(e => e.id === sNodeId);
                        if (!sNode) return;

                        // Process node type (simplified Action/Task for body)
                        const sType = sNode.type;
                        const sName = sNode.properties?.name || sNode.data?.name || sNode.data?.actionName || sNode.properties?.text;

                        if (sType === 'Action' || sType === 'Task') {
                            const sItem = { type: sType === 'Task' ? 'task' : 'action', name: sName };
                            sTargetSeq.push(sItem);
                            const out = connections.find(c => c.startTargetId === sNode.id);
                            if (out) buildSubSequence(out.endTargetId, sTargetSeq, sStopNodeId, sVisited);
                        }
                        // Handle nested conditions/loops if needed... 
                        // For MVP: simple linear body
                    };

                    buildSubSequence(bodyConn.endTargetId, loopItem.body, node.id, bodyVisited);

                    // Mark loop node as visited again
                    visited.add(node.id);
                }

                // Exit Branch (False/Exit)
                const exitConn = connections.find(c =>
                    c.startTargetId === node.id &&
                    (c.data?.anchorType === 'false' || c.data?.startAnchorType === 'false' || c.data?.branchType === 'false')
                );
                if (exitConn) {
                    buildSequence(exitConn.endTargetId, targetSeq, stopSet);
                }
            } else if (nodeType === 'VariableDecl') {
                // Skip declarations in the execution sequence
                const outgoing = connections.find(c =>
                    c.startTargetId === node.id &&
                    (!c.data?.startAnchorType || ['output', 'right', 'bottom'].includes(c.data?.startAnchorType))
                );
                if (outgoing) {
                    buildSequence(outgoing.endTargetId, targetSeq, stopSet);
                }
            }
        };

        // Start from first outgoing
        const initialOutgoing = connections.filter(c => c.startTargetId === startNode.id);
        initialOutgoing.sort((a, b) => {
            const nodeA = elements.find(e => e.id === a.endTargetId);
            const nodeB = elements.find(e => e.id === b.endTargetId);
            return (nodeA?.y || 0) - (nodeB?.y || 0);
        });

        initialOutgoing.forEach(conn => {
            buildSequence(conn.endTargetId, sequence);
        });

        const sequenceToSync = sequence;
        task.actionSequence = sequenceToSync;

        const oldLen = task.actionSequence?.length || 0;

        // KRITISCHER SCHUTZ: Niemals eine existierende Sequenz mit einer leeren überschreiben!
        // Dies kann passieren, wenn der Task-Einstiegsknoten beim Import übersprungen wird
        // und syncToProject dann nur die sichtbaren (0) Aktionen sieht.
        if (sequence.length === 0 && oldLen > 0) {
            console.warn(`[FlowEditor] syncTaskFromFlow: PROTECTED! Would have deleted ${oldLen} items. Keeping existing sequence.`);
            return;
        }

        task.actionSequence = sequence;
        console.log(`[FlowEditor] syncTaskFromFlow: Task "${task.name}" sequence updated. ${oldLen} -> ${sequence.length} items.`);
    }

    private loadFromProject() {
        if (!this.project) return;

        this.clearFlowCanvas();

        if (this.currentFlowContext === 'event-map') {
            this.generateEventMap();
            return;
        }

        if (this.currentFlowContext === 'element-overview') {
            this.generateElementOverview();
            return;
        }

        let sourceData: { elements: any[], connections: any[] } | undefined;

        if (this.currentFlowContext === 'global') {
            // Load from flowCharts.global, fallback to legacy flow
            sourceData = this.project.flowCharts?.global || this.project.flow;
        } else {
            // Load from flowCharts[taskName], fallback to legacy task.flowGraph (for old projects)
            const taskFlowChart = this.project.flowCharts?.[this.currentFlowContext];
            if (taskFlowChart) {
                sourceData = taskFlowChart;
                console.log(`[FlowEditor] Loading from project.flowCharts["${this.currentFlowContext}"]: ${sourceData?.elements?.length || 0} elements`);
            } else {
                // Check if task exists and has its own flowChart
                const task = this.project.tasks.find(t => t.name === this.currentFlowContext) as any;
                console.log(`[FlowEditor] loadFromProject: Task record found: ${!!task}, hasFlowChart: ${!!task?.flowChart} (${task?.flowChart?.elements?.length || 0} elements)`);
                if (task?.flowChart) {
                    sourceData = task.flowChart;
                    console.log(`[FlowEditor] Loading elements from task.flowChart for: ${this.currentFlowContext} (Found ${sourceData?.elements?.length || 0} elements)`);
                } else if (task?.flowGraph) {
                    // Fallback: check for legacy flowGraph in task
                    sourceData = task.flowGraph;
                    console.log(`[FlowEditor] Loading elements from legacy task.flowGraph for: ${this.currentFlowContext}`);
                    // Migrate to new structure
                    if (!this.project.flowCharts) this.project.flowCharts = {};
                    this.project.flowCharts[this.currentFlowContext] = task.flowGraph;
                    delete task.flowGraph;
                } else {
                    // Initialize new empty flow for this task
                    console.warn(`[FlowEditor] No flow data found for task "${this.currentFlowContext}"! Initializing empty flow.`);
                    sourceData = { elements: [], connections: [] };

                    // Auto-Spawn "Start Node" for this Task
                    setTimeout(() => {
                        if (this.nodes.length === 0) {
                            console.log(`[FlowEditor] Auto-spawning Start node for empty task flow: ${this.currentFlowContext}`);
                            const startNode = new FlowStart('start-' + Date.now(), 50, 50, this.canvas, this.flowStage.cellSize);
                            startNode.Text = "Start";
                            this.nodes.push(startNode);

                            const taskNode = new FlowTask('task-root-' + Date.now(), 200, 50, this.canvas, this.flowStage.cellSize);
                            taskNode.Text = this.currentFlowContext;
                            taskNode.data = { taskName: this.currentFlowContext };
                            taskNode.setDetailed(true);
                            this.nodes.push(taskNode);

                            // Connect them
                            const conn = new FlowConnection(this.canvas, 0, 0, 0, 0);
                            conn.setGridConfig(this.flowStage.cellSize);
                            conn.attachStart(startNode);
                            conn.attachEnd(taskNode);
                            conn.updatePosition();
                            this.connections.push(conn);
                            this.setupConnectionListeners(conn);
                        }
                    }, 100);
                }
            }
        }

        if (!sourceData) return;

        // Restore Elements
        if (sourceData.elements) {
            sourceData.elements.forEach((data: any) => {
                const node = this.restoreNode(data);
                if (node) this.nodes.push(node);
            });
        }

        // Restore Connections
        if (sourceData.connections) {
            sourceData.connections.forEach((data: any) => {
                this.restoreConnection(data);
            });
        }

        // Automatic expansion of linked tasks on load
        // Iterate over a copy of the nodes array because refreshEmbeddedTask will modify the collection
        [...this.nodes].forEach(node => {
            if (node.data?.isExpanded) {
                this.refreshEmbeddedTask(node);
            }
        });

        // Notify listeners that nodes have changed
        if (this.onNodesChanged) {
            this.onNodesChanged(this.nodes);
        }

        // Update scroll area based on nodes
        this.updateScrollArea();

        // Ensure current detail mode is applied to all loaded nodes
        this.updateActionDetails();
    }

    private restoreNode(data: any): FlowElement | null {
        let node: FlowElement | null = null;
        const gridConfig = this.project?.flow?.stage || { cellSize: 20 };
        const snap = true;

        if (data.type === 'Start') {
            node = new FlowStart(data.id, data.x, data.y, this.canvas, gridConfig.cellSize);
        } else if (data.type === 'Action') {
            node = new FlowAction(data.id, data.x, data.y, this.canvas, gridConfig.cellSize);
        } else if (data.type === 'Condition') {
            node = new FlowCondition(data.id, data.x, data.y, this.canvas, gridConfig.cellSize);
        } else if (data.type === 'Task') {
            node = new FlowTask(data.id, data.x, data.y, this.canvas, gridConfig.cellSize);
        } else if (data.type === 'VariableDecl') {
            node = new FlowVariable(data.id, data.x, data.y, this.canvas, gridConfig.cellSize);
        } else if (['While', 'For', 'Repeat'].includes(data.type)) {
            node = new FlowLoop(data.id, data.x, data.y, this.canvas, gridConfig.cellSize, data.type);
        }

        if (node) {
            node.setGridConfig(gridConfig.cellSize, snap);

            // Restore size and position with grid snapping
            node.Width = Math.round((data.width || 150) / gridConfig.cellSize) * gridConfig.cellSize;
            node.Height = Math.round((data.height || 60) / gridConfig.cellSize) * gridConfig.cellSize;
            node.X = Math.round((data.x || 0) / gridConfig.cellSize) * gridConfig.cellSize;
            node.Y = Math.round((data.y || 0) / gridConfig.cellSize) * gridConfig.cellSize;

            if (data.properties) {
                if (data.properties.name) node.Name = data.properties.name;
                if (data.properties.details) node.Details = data.properties.details;
                if (data.properties.description) node.Description = data.properties.description;
                if (data.properties.text && !data.properties.name) node.Name = data.properties.text;
            }

            // Ensure project reference is set for Task nodes
            if (node instanceof FlowTask && this.project) {
                node.setProjectRef(this.project);
            }

            // Restore loops and variables
            if (node instanceof FlowVariable) {
                (node as any).updateVisuals?.();
            }
            if (node instanceof FlowLoop) {
                (node as any).updateVisuals?.();
            }

            if (data.data) {
                // SINGLE SOURCE OF TRUTH: For Action nodes, load data from project.actions
                // instead of using the FlowChart copy. This ensures all references to the same
                // action use the same data.
                if (data.type === 'Action' && this.project) {
                    const actionName = data.properties?.name || data.data?.name;
                    const projectAction = this.project.actions.find(a => a.name === actionName);

                    if (projectAction) {
                        // Load from project.actions (Single Source of Truth)
                        node.data = { ...projectAction, isLinked: true };
                        node.setLinked(true);
                    } else {
                        // Action not found in project.actions - use local data (legacy or copy)
                        node.data = { ...data.data };
                        console.warn(`[FlowEditor] Action "${actionName}" not found in project.actions - using local FlowChart data`);
                    }
                } else {
                    // Non-Action nodes: use FlowChart data as before
                    node.data = { ...data.data };
                }

                // Logic-aware "Detailed" state restoration
                const hasLogic = node.data.actionName || node.data.taskName || node.data.condition;
                if (hasLogic) node.setDetailed(true);

                if (data.data.isLinked) node.setLinked(true);

                // For linked Task nodes: Show the actual task name (e.g., "MoveAndLog")
                // instead of the generic "Task" placeholder
                if (node.getType() === 'Task' && node.data.taskName) {
                    node.Name = node.data.taskName;
                    node.setText(node.data.taskName);
                }

                // For Condition nodes: Display the condition expression
                if (node.getType() === 'Condition' && node.data.condition) {
                    const cond = node.data.condition;
                    if (cond.variable) {
                        node.setText(`${cond.variable} ${cond.operator || '=='} ${cond.value || ''}`, true);
                    }
                }

                // Persistence: Restore detailed view if it was saved
                if (data.data.showDetails) {
                    node.setShowDetails(true, this.project);
                }
            }

            // Ensure node is in DOM
            this.canvas.appendChild(node.getElement());

            // Note: hostOnly sync removed - Multiplayer logic now uses Task.triggerMode

            // For Task nodes: set project reference for parameter lookups
            if (node.getType() === 'Task' && this.project) {
                (node as FlowTask).setProjectRef(this.project);
            }

            // Setup events
            this.setupNodeListeners(node);
        }

        return node;
    }

    /**
     * Re-expands a Proxy node to show its internal ghost nodes
     */
    private refreshEmbeddedTask(proxyNode: FlowElement) {
        if (!this.project || !proxyNode.data?.isExpanded || !proxyNode.data?.sourceTaskName) return;

        const sourceTaskName = proxyNode.data.sourceTaskName;
        let sourceTask = this.project.tasks.find(t => t.name === sourceTaskName);
        let sourceFlowChart = this.project.flowCharts?.[sourceTaskName];

        if (!sourceTask) {
            // Check Library
            sourceTask = libraryService.getTask(sourceTaskName);
            sourceFlowChart = sourceTask?.flowChart;
        }

        if (!sourceTask || !sourceFlowChart) return;

        // 0. CAPTURE current ghost node positions BEFORE deleting them
        // This allows manual layout changes to persist across refreshes
        const existingGhostNodes = this.nodes.filter(n => n.data?.parentProxyId === proxyNode.name);
        if (existingGhostNodes.length > 0) {
            if (!proxyNode.data.ghostPositions) proxyNode.data.ghostPositions = {};
            existingGhostNodes.forEach(n => {
                // Use originalId if available, otherwise use the node name
                const originalId = n.data?.originalId || n.name;
                proxyNode.data.ghostPositions[originalId] = { x: n.X, y: n.Y };
            });
            console.log(`[FlowEditor] refreshEmbeddedTask: Saved ${existingGhostNodes.length} ghost positions for proxy "${proxyNode.name}"`);
        }

        // 1. Remove existing Ghost Nodes for this proxy
        const toDeleteNodes = this.nodes.filter(n => n.data?.parentProxyId === proxyNode.name);
        toDeleteNodes.forEach(n => {
            const el = n.getElement();
            if (el.parentNode === this.canvas) this.canvas.removeChild(el);
            const idx = this.nodes.indexOf(n);
            if (idx !== -1) this.nodes.splice(idx, 1);
        });

        // 2. Remove existing Ghost Connections for this proxy
        const toDeleteConns = this.connections.filter(c => c.data?.parentProxyId === proxyNode.name);
        toDeleteConns.forEach(c => {
            const el = c.getElement();
            const sh = c.getStartHandle();
            const eh = c.getEndHandle();
            if (el.parentNode === this.canvas) this.canvas.removeChild(el);
            if (sh.parentNode === this.canvas) this.canvas.removeChild(sh);
            if (eh.parentNode === this.canvas) this.canvas.removeChild(eh);
            const idx = this.connections.indexOf(c);
            if (idx !== -1) this.connections.splice(idx, 1);
        });

        // 3. Trigger Import as Link (Ghost Import)
        // This will create new nodes and add them to this.nodes
        const addedNodes = this.importTaskGraph(proxyNode, sourceTask, true);

        // 4. Recursive expansion for nested proxies
        if (addedNodes) {
            addedNodes.forEach(newNode => {
                if (newNode.data?.isExpanded) {
                    this.refreshEmbeddedTask(newNode);
                }
            });
        }
    }

    private restoreConnection(data: any) {
        // Find targets
        const startNode = data.startTargetId ? this.nodes.find(n => n.name === data.startTargetId) : null;
        const endNode = data.endTargetId ? this.nodes.find(n => n.name === data.endTargetId) : null;

        let x1 = data.startX || 0;
        let y1 = data.startY || 0;
        let x2 = data.endX || 0;
        let y2 = data.endY || 0;

        // Create connection
        const conn = new FlowConnection(this.canvas, x1, y1, x2, y2);
        conn.setGridConfig(this.flowStage.cellSize);
        if (data.data) conn.data = { ...data.data };

        if (startNode) conn.attachStart(startNode);
        if (endNode) conn.attachEnd(endNode);

        conn.updatePosition();

        this.connections.push(conn);

        // Setup all connection listeners including handle dragging
        this.setupConnectionListeners(conn);
    }

    private handleCanvasClick(e: MouseEvent) {
        if (e.target === this.canvas) {
            this.deselectAll(false);
            // Select Flow Editor (Project Settings) instead of TFlowStage
            if (this.onObjectSelect) {
                this.onObjectSelect(this as any);
            }
        }
    }

    private deselectAll(emitEvent: boolean = true) {
        if (this.selectedConnection) {
            this.selectedConnection.deselect();
            this.selectedConnection = null;
        }
        if (this.selectedNode) {
            this.selectedNode.getElement().style.outline = 'none';
            this.selectedNode = null;
        }

        // Notify null selection
        if (emitEvent && this.onObjectSelect) {
            this.onObjectSelect(null);
        }
    }

    public createNode(type: string, x: number, y: number, initialName?: string): FlowElement | null {
        let node: FlowElement;
        const id = 'node-' + Date.now();
        switch (type) {
            case 'Action':
                node = new FlowAction(id, x, y, this.canvas, this.flowStage.cellSize);
                // Generate unique name if not provided
                if (initialName) {
                    node.Name = initialName;
                } else {
                    node.Name = this.generateUniqueActionName();
                }
                // Apply current detail mode
                if (this.showDetails) {
                    (node as FlowAction).setShowDetails(true, this.project);
                }
                break;
            case 'Task':
                let taskName = initialName;
                if (!taskName) {
                    taskName = prompt("Name für den neuen Task:", "ANewTask") || undefined;
                }
                if (!taskName) {
                    console.log("[FlowEditor] Task creation cancelled by user.");
                    return null;
                }
                node = new FlowTask(id, x, y, this.canvas, this.flowStage.cellSize);
                node.Name = taskName;
                node.setText(taskName);
                // Set project reference for parameter lookups
                if (this.project) {
                    (node as FlowTask).setProjectRef(this.project);
                    // Nur sicherstellen wenn es nicht der generische Name "Task" ist
                    if (taskName !== 'Task') {
                        this.ensureTaskExists(taskName, "");
                    }
                }
                break;
            case 'Condition':
                node = new FlowCondition(id, x, y, this.canvas, this.flowStage.cellSize);
                node.Name = 'Bedingung';
                break;
            case 'VariableDecl':
                node = new FlowVariable(id, x, y, this.canvas, this.flowStage.cellSize);
                const scope = this.currentFlowContext === 'global' ? 'global' : this.currentFlowContext;
                node.data = { variable: { name: 'neueVariabel', type: 'number', initialValue: 0, scope } };
                (node as FlowVariable).updateVisuals?.();

                // Open Editor Dialog for new Variables
                if (!initialName) {
                    const dialogData = {
                        variable: node.data.variable,
                        project: this.project
                    };
                    serviceRegistry.call('Dialog', 'showDialog', ['variable_editor', true, dialogData]).then((result: any) => {
                        if (result) {
                            node.data.variable = { ...node.data.variable, ...result };
                            (node as FlowVariable).updateVisuals?.();
                            this.syncToProject();
                        }
                    });
                }
                break;
            case 'While':
            case 'For':
            case 'Repeat':
                node = new FlowLoop(id, x, y, this.canvas, this.flowStage.cellSize, type as any);
                node.Name = type;
                (node as FlowLoop).updateVisuals?.();
                break;
            case 'Start':
                node = new FlowStart(id, x, y, this.canvas, this.flowStage.cellSize);
                node.Name = 'Start';
                break;
            case 'Connection':
                // Logic for visual tool drop (if any)
                const conn = new FlowConnection(this.canvas, x, y, x + 100, y + 50);
                conn.setGridConfig(this.flowStage.cellSize);
                this.connections.push(conn);
                this.setupConnectionListeners(conn);
                conn.select();
                this.selectedConnection = conn;
                return null; // Connections are not FlowElements
            default:
                return null;
        }

        this.canvas.appendChild(node.getElement());
        this.nodes.push(node);

        this.setupNodeListeners(node);
        if (this.onNodesChanged) this.onNodesChanged(this.nodes);
        this.syncToProject();   // Ensure new node is persisted
        return node;
    }

    private deleteConnection(conn: FlowConnection) {
        const index = this.connections.indexOf(conn);
        if (index !== -1) {
            this.connections.splice(index, 1);
            conn.getElement().remove();
            conn.getStartHandle().remove();
            conn.getEndHandle().remove();
            if (this.selectedConnection === conn) {
                this.selectedConnection = null;
            }
            this.syncToProject();
        }
    }

    private deleteNode(node: FlowElement) {
        // Embedded elements restriction check
        if (node.data?.isLinked || node.data?.isEmbeddedInternal) {
            alert('Eingebettete Tasks können nur im Original editiert oder gelöscht werden.');
            return;
        }

        // ELEMENT OVERVIEW DELETE LOGIC
        if (this.currentFlowContext === 'element-overview' && node.data?.isOverviewLink) {
            // Referenzen werden angezeigt, blockieren aber nicht mehr das Löschen
            const elementName = node.Name || node.name;
            const liveRefs = projectRegistry.findReferences(elementName);

            // Warnung mit Referenzinfo, aber Löschung ist erlaubt
            const refWarning = liveRefs.length > 0
                ? `\n\n⚠️ Achtung: Dieses Element wird noch verwendet in:\n${liveRefs.join('\n')}\n\nReferenzen werden ebenfalls entfernt.`
                : '';

            if (confirm(`Möchtest du das Element "${node.Name}" wirklich UNWIDERRUFLICH aus dem Projekt löschen?${refWarning}`)) {
                this.deleteElementFromProject(node.data.type, node.Name, node.data.originalIndex);

                // IMPORTANT: since syncToProject() exits early in overview mode,
                // we MUST trigger the save/change notification manually here.
                if (this.onProjectChange) this.onProjectChange();

                this.loadFromProject(); // Refresh view
            }
            return;
        }

        if (confirm(`Möchtest du den Knoten "${node.Name || node.name}" wirklich löschen?`)) {
            const nodeName = node.Name || node.name;
            const nodeType = node.getType();

            this.removeNode(node.name);
            this.syncToProject();

            // --- SMART DELETE: Check if this was the last reference of an action ---
            if (nodeType === 'Action' && nodeName && nodeName !== 'Aktion' && nodeName !== 'Action') {
                // Wait a tick for syncToProject to finish potential project state changes
                setTimeout(() => {
                    const refs = projectRegistry.findReferences(nodeName);
                    // Filter out references from the current overview/global list itself? 
                    // No, findReferences is quite accurate. 
                    // If 0 references remain, we ask.
                    if (refs.length === 0) {
                        if (confirm(`Die Aktion "${nodeName}" wird nun nirgendwo mehr verwendet.\nSoll sie auch aus der globalen Aktions-Liste gelöscht werden?`)) {
                            this.deleteElementFromProject('Action', nodeName);
                            if (this.onProjectChange) this.onProjectChange();
                        }
                    } else {
                        console.log(`[FlowEditor] Action "${nodeName}" still has ${refs.length} references, keeping global definition.`);
                    }
                }, 100);
            }
        }
    }

    private deleteElementFromProject(type: 'Action' | 'Task', name: string, index?: number) {
        if (!this.project) return;
        if (type === 'Action') {
            // 1. Precise deletion from global array (handles duplicates)
            if (index !== undefined && index >= 0 && index < this.project.actions.length) {
                this.project.actions.splice(index, 1);
                console.log(`[FlowEditor] Deleted Action instance at index ${index}: ${name}`);
            } else {
                this.project.actions = this.project.actions.filter(a => a.name !== name);
                console.log(`[FlowEditor] Deleted all Action instances with name: ${name}`);
            }

            // 2. Project-wide reference cleanup (Flowcharts, Sequences)
            // Note: We only do this if no other action with the same name exists anymore?
            // Actually, if it's a duplicate, other nodes might still point to it.
            // But if it's UNUSED (red), we can clean up everything.
            const stillExists = this.project.actions.some(a => a.name === name);
            if (!stillExists) {
                RefactoringManager.deleteAction(this.project, name);
            }
        } else if (type === 'Task') {
            RefactoringManager.deleteTask(this.project, name);
            console.log(`[FlowEditor] Deleted Task project-wide: ${name}`);
        }
    }

    private handleDrop(e: DragEvent) {
        e.preventDefault();
        const type = e.dataTransfer?.getData('application/flow-item');
        if (!type) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.flowStage.snapToGrid) {
            const snapped = this.flowStage.snapToGridPosition(x, y);
            const initialName = type === 'Task' ? (this.suggestedTaskName || 'Task') : undefined;
            this.createNode(type, snapped.x, snapped.y, initialName);
            this.suggestedTaskName = null; // Nur einmal verwenden
        } else {
            const initialName = type === 'Task' ? (this.suggestedTaskName || 'Task') : undefined;
            this.createNode(type, x, y, initialName);
            this.suggestedTaskName = null; // Nur einmal verwenden
        }
    }

    private setupNodeListeners(node: FlowElement) {
        // Double Click for Detailing Phase
        node.getElement().addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.handleNodeDoubleClick(node);
        });

        // Context Menu
        node.getElement().addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.handleNodeContextMenu(e, node);
        });

        node.getElement().addEventListener('mousedown', (e) => {
            e.stopPropagation(); // specific node click logic

            // Embedded elements CAN be dragged for layout purposes
            // Only editing, deleting, and context menu actions are restricted

            const startX = e.clientX;
            const startY = e.clientY;
            const startNodeX = node.X;
            const startNodeY = node.Y;

            const onMouseMove = (moveEvt: MouseEvent) => {
                const dx = moveEvt.clientX - startX;
                const dy = moveEvt.clientY - startY;
                let newX = startNodeX + dx;
                let newY = startNodeY + dy;

                if (this.flowStage.snapToGrid) {
                    const snapped = this.flowStage.snapToGridPosition(newX, newY);
                    newX = snapped.x;
                    newY = snapped.y;
                }

                node.X = newX;
                node.Y = newY;
                node.updatePosition();
                if (node.onMove) node.onMove();

                // Update connections (Legacy or Direct logic)
                /* 
                   Wait, node.onMove() triggers the callback we set in setupNodeListeners!
                   Let's see: node.getElement().addEventListener...
                   This listener in FlowEditor duplicates logic or attempts to override?
                   
                   If FlowElement handles drag (which it does via its own mousedown), then FlowEditor's listener creates conflict?
                   
                   FlowElement.ts (lines 109+) adds mousedown.
                   FlowEditor.ts (line 691) adds mousedown with stopPropagation.
                   
                   Since FlowEditor adds stopPropagation, FlowElement's internal drag logic is BLOCKED.
                   So FlowEditor is fully responsible for dragging.
                   
                   So we need to update connections here.
                */

                this.connections.forEach(c => {
                    if (c.startTarget === node || c.endTarget === node) {
                        c.updatePosition();
                    }
                });
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                this.syncToProject();
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);

            // Select Node
            this.selectNode(node);
        });

        // Update connections when node resizes
        node.onResize = () => {
            this.connections.forEach(c => c.updatePosition());
        };

        // Connection Creation from Anchors
        const setupAnchor = (anchor: HTMLElement, isOutput: boolean, branchType?: 'true' | 'false') => {
            if (!anchor) return;
            anchor.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();

                if (!isOutput) return; // Currently we only drag from Output to Input

                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                // Create new connection
                const conn = new FlowConnection(this.canvas, x, y, x, y);
                conn.attachStart(node);

                // If starting from a ghost node, mark the connection as embedded/internal
                // This prevents it from being saved to the original task
                const isGhostConnection = node.data?.isEmbeddedInternal || node.data?.parentProxyId;

                if (branchType) {
                    conn.data = {
                        ...conn.data,
                        startAnchorType: branchType,
                        originalStartAnchorType: branchType, // Set as original too
                        isEmbeddedInternal: isGhostConnection || false,
                        parentProxyId: node.data?.parentProxyId
                    };
                } else {
                    conn.data = {
                        ...conn.data,
                        startAnchorType: 'output',
                        originalStartAnchorType: 'output', // Set as original too
                        isEmbeddedInternal: isGhostConnection || false,
                        parentProxyId: node.data?.parentProxyId
                    };
                }

                this.connections.push(conn);
                this.setupConnectionListeners(conn);

                // Active dragging global state
                this.isDraggingHandle = true;
                this.activeHandle = conn.getEndHandle();
                this.activeHandle.dataset.isStart = 'false'; // Dragging the END to find an input
                this.activeConnection = conn;

                this.deselectAll();
                conn.select();
                this.selectedConnection = conn;
            });
        };

        if (node instanceof FlowCondition) {
            setupAnchor(node.trueAnchor, true, 'true');
            setupAnchor(node.falseAnchor, true, 'false');
        } else {
            setupAnchor(node.getOutputAnchor(), true);
        }

        // Top anchor = INPUT (can't start from here, but can connect TO here)
        // Bottom anchor = OUTPUT (can start from here)
        // Note: topAnchor doesn't need setupAnchor with isOutput=true since it's an input
        setupAnchor(node.getBottomAnchor(), true, 'bottom' as any);

        // Tooltip Hooks
        node.onHover = (e, n) => this.showTooltip(e, n);
        node.onHoverEnd = () => this.hideTooltip();
    }

    // ─────────────────────────────────────────────
    // Tooltip Implementation
    // ─────────────────────────────────────────────
    private tooltipEl: HTMLElement | null = null;

    private showTooltip(e: MouseEvent, node: FlowElement) {
        if (!node.Description) return;

        if (!this.tooltipEl) {
            this.tooltipEl = document.createElement('div');
            this.tooltipEl.style.cssText = `
                position: absolute;
                background: #252526;
                color: #cccccc;
                border: 1px solid #ffcc00;
                padding: 8px 12px;
                border-radius: 4px;
                font-family: sans-serif;
                font-size: 12px;
                max-width: 250px;
                box-shadow: 0 4px 10px rgba(0,0,0,0.5);
                pointer-events: none;
                z-index: 1000;
                line-height: 1.4;
            `;
            document.body.appendChild(this.tooltipEl);
        }

        this.tooltipEl.innerHTML = `<strong style="color: #fff; display: block; margin-bottom: 4px;">${node.Name}</strong>${node.Description}`;
        this.tooltipEl.style.display = 'block';

        // Position near cursor
        this.tooltipEl.style.left = (e.pageX + 15) + 'px';
        this.tooltipEl.style.top = (e.pageY + 15) + 'px';
    }

    private hideTooltip() {
        if (this.tooltipEl) {
            this.tooltipEl.style.display = 'none';
        }
    }

    private importTaskGraph(targetNode: FlowElement, task: any, isLinked: boolean = false): FlowElement[] {
        // PREVENT RECURSIVE IMPORT: Do not expand a task into its own flow view!
        // This is the root cause of the "duplicates" in task-specific views.
        if (task.name === this.currentFlowContext) {
            console.warn(`[FlowEditor] importTaskGraph: Recursive import of current context "${task.name}" blocked.`);
            return [];
        }

        // FATAL DUPLICATE PROTECTION: Never import if ghosts for this node already exist!
        const existingGhosts = this.nodes.some(n => n.data?.parentProxyId === targetNode.name);
        if (existingGhosts) {
            console.warn(`[FlowEditor] importTaskGraph ABORTED: Node "${targetNode.name}" already has ghost elements.`);
            return [];
        }

        // Load flowChart from project or library
        const projectChart = (this.project as any)?.flowCharts?.[task.name];
        const taskChart = task.flowChart || task.flowGraph;

        // HEURISTIC: Prefer the "richest" data source. 
        // If the project chart is just a stub (Start + Identity node = 2 elements), 
        // but the task-embedded chart has more, use the task-embedded one.
        let flowChart = projectChart;
        let source = 'project.flowCharts';

        const projectCount = projectChart?.elements?.length || 0;
        const taskCount = taskChart?.elements?.length || 0;

        if (!projectChart || (projectCount <= 2 && taskCount > projectCount)) {
            if (taskChart && taskChart.elements && taskChart.elements.length > 0) {
                flowChart = taskChart;
                source = task.flowChart ? 'task.flowChart' : 'task.flowGraph';
            }
        }

        console.log(`[FlowEditor] importTaskGraph for "${task.name}": flowChart found: ${!!flowChart}, source: ${source}, elements: ${flowChart?.elements?.length || 0}`);

        if (!flowChart || !flowChart.elements || flowChart.elements.length === 0) {
            console.warn(`[FlowEditor] Task "${task.name}" has no flow elements to import. (Source: ${source})`);
            return [];
        }


        // 2. Generate unique group ID for this embedded task
        const embeddedGroupId = `embedded-${task.name}-${Date.now()}`;

        // 3. Prepare ID Mapping
        const idMap: Record<string, string> = {};
        const getNewId = (oldId: string) => {
            if (!idMap[oldId]) {
                idMap[oldId] = `imported-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            }
            return idMap[oldId];
        };

        // 4. Calculate Offset - Place imported nodes to the RIGHT of the target/proxy node
        let minX = Infinity, minY = Infinity;
        flowChart.elements.forEach((el: any) => {
            if (el.x < minX) minX = el.x;
            if (el.y < minY) minY = el.y;
        });

        const gridGap = this.flowStage.cellSize * 4;
        const offsetX = targetNode.X + targetNode.Width + gridGap - minX;
        const offsetY = targetNode.Y - minY;

        // 5. Create New Nodes
        const newNodes: FlowElement[] = [];
        let importedStart: FlowElement | null = null;

        console.log(`[FlowEditor] importTaskGraph - elements to process: ${flowChart.elements.length}`);

        flowChart.elements.forEach((data: any) => {
            // OPTIMIZATION: If this is a link/expansion, skip the "Identity" node of the task if it exists.
            // Robust check: Skip if it's a Task node with either the current name OR the original library name
            const isIdentityNode = data.type === 'Task' &&
                (data.properties?.name === task.name ||
                    data.properties?.name === task.sourceTaskName ||
                    data.properties?.name === task.copiedFromLibrary);

            if (isLinked && isIdentityNode) {
                console.log(`[FlowEditor]   -> Skipping identity node: ${data.properties?.name} (id: ${data.id})`);
                idMap[data.id] = targetNode.name;

                // IMPORTANT: Mark proxy node with the ID it represents in the original flowchart
                // This allows connections starting/ending at the proxy to be mapped correctly
                if (!targetNode.data) targetNode.data = {};
                targetNode.data.originalId = data.id;

                return;
            }

            const newData = JSON.parse(JSON.stringify(data));
            newData.id = getNewId(data.id);

            // POSITION OVERRIDE: Check if proxy has saved positions for this ghost node
            const savedPos = isLinked && targetNode.data?.ghostPositions?.[data.id];
            if (savedPos) {
                // Use saved position (absolute, from manual layout)
                newData.x = savedPos.x;
                newData.y = savedPos.y;
                console.log(`[FlowEditor]   -> Using saved position for ${data.properties?.name || data.type}: ${savedPos.x},${savedPos.y}`);
            } else {
                // Use calculated position (relative to proxy + offset)
                newData.x += offsetX;
                newData.y += offsetY;
            }

            console.log(`[FlowEditor]   -> Restoring node: ${newData.properties?.name || newData.type} at ${newData.x},${newData.y}`);
            const newNode = this.restoreNode(newData);
            if (newNode) {
                this.nodes.push(newNode);
                newNodes.push(newNode);


                // Apply linked styling
                if (isLinked) {
                    newNode.setLinked(true);
                    newNode.data = {
                        ...newNode.data,
                        isLinked: true,
                        isEmbeddedInternal: true,
                        parentProxyId: targetNode.name,
                        embeddedGroupId: embeddedGroupId,
                        parentParams: targetNode.data?.params,
                        originalId: data.id  // Store original ID for position mapping
                    };
                }

                if (newNode.getType() === 'Start') importedStart = newNode;
            }
        });

        console.log(`[FlowEditor] importTaskGraph - Processed ${newNodes.length} visible elements into DOM.`);

        // Use the first new node as a fallback entry point if no explicit Start node was found
        if (!importedStart && newNodes.length > 0) {
            importedStart = newNodes[0];
        }

        // 5. Create New Connections (Internal)
        if (flowChart.connections) {
            flowChart.connections.forEach((data: any) => {
                const startId = idMap[data.startTargetId];
                const endId = idMap[data.endTargetId];

                if (startId && endId) {
                    const startNode = this.nodes.find(n => n.name === startId);
                    const endNode = this.nodes.find(n => n.name === endId);

                    if (startNode && endNode) {
                        const conn = new FlowConnection(this.canvas, 0, 0, 0, 0);
                        conn.setGridConfig(this.flowStage.cellSize);
                        // ANCHOR OVERRIDE: Check if proxy has saved anchor types for this connection
                        const origStartId = data.startTargetId;
                        const origEndId = data.endTargetId;
                        const origStartAnchor = data.data?.startAnchorType || 'output';

                        // Look for a matching connection in saved ghostConnections array
                        const savedConn = isLinked && targetNode.data?.ghostConnections?.find((gc: any) =>
                            gc.startOriginalId === origStartId &&
                            gc.endOriginalId === origEndId &&
                            gc.originalStartAnchorType === origStartAnchor
                        );

                        if (savedConn) {
                            conn.data = {
                                ...conn.data,
                                startAnchorType: savedConn.startAnchorType,
                                endAnchorType: savedConn.endAnchorType
                            };
                            console.log(`[FlowEditor]   -> Restored ghost anchors: ${savedConn.startAnchorType}->${savedConn.endAnchorType}`);
                        } else if (data.data?.startAnchorType) {
                            // Default from original flowchart
                            conn.data = { ...conn.data, startAnchorType: data.data.startAnchorType };
                        } else if (data.data?.branchType) {
                            // Legacy support
                            conn.data = { ...conn.data, startAnchorType: data.data.branchType };
                        }

                        conn.attachStart(startNode);
                        conn.attachEnd(endNode);
                        conn.updatePosition();
                        this.connections.push(conn);
                        this.setupConnectionListeners(conn);

                        if (isLinked) {
                            conn.data = {
                                ...conn.data,
                                isEmbeddedInternal: true,
                                parentProxyId: targetNode.name,
                                // Store the original anchor type to have a stable key for layout overrides
                                originalStartAnchorType: data.data?.startAnchorType || 'output'
                            };
                        }
                    }
                }
            });
        }

        // 6. Connect Proxy to Imported Start (GCS Chain)
        // Instead of rewiring incoming connections (which isolated the proxy),
        // we keep the proxy in the chain and connect it to the internal start.
        if (isLinked && importedStart) {
            const conn = new FlowConnection(this.canvas, 0, 0, 0, 0);
            conn.setGridConfig(this.flowStage.cellSize);

            // ANCHOR OVERRIDE for entry connection
            const origStartId = targetNode.data.originalId;
            const origEndId = importedStart.data?.originalId;
            const origStartAnchor = 'output'; // Standard entry anchor

            const savedConn = targetNode.data?.ghostConnections?.find((gc: any) =>
                gc.startOriginalId === origStartId &&
                gc.endOriginalId === origEndId &&
                gc.originalStartAnchorType === origStartAnchor
            );

            if (savedConn) {
                conn.data = {
                    ...conn.data,
                    startAnchorType: savedConn.startAnchorType,
                    endAnchorType: savedConn.endAnchorType
                };
                console.log(`[FlowEditor]   -> Restored ghost entry anchors: ${savedConn.startAnchorType}->${savedConn.endAnchorType}`);
            }

            conn.attachStart(targetNode);
            conn.attachEnd(importedStart);
            conn.updatePosition();
            this.connections.push(conn);
            this.setupConnectionListeners(conn);

            conn.data = {
                ...conn.data,
                isEmbeddedInternal: true,
                parentProxyId: targetNode.name,
                originalStartAnchorType: origStartAnchor // Mark for future sync matches
            };
        }

        // 7. Handle Proxy State
        if (isLinked) {
            targetNode.data.isExpanded = true;
            targetNode.data.sourceTaskName = task.name;
            targetNode.Name = task.name;
            targetNode.Text = task.name;
            targetNode.setLinked(true); // Visual indicator on proxy too
            if (task.description) targetNode.Description = task.description;
        } else {
            // If it was a deep copy (not linked), we can remove the original
            this.removeNode(targetNode.name);
        }

        // 8. PERSISTENCE & REFRESH: Sync immediately so expansion is saved in project
        this.syncToProject();
        if (this.onNodesChanged) this.onNodesChanged(this.nodes);

        return newNodes;
    }

    private handleNodeContextMenu(e: MouseEvent, node: FlowElement) {
        if (!this.project) return;

        // For embedded nodes, show limited context menu (only delete option)
        // Check for isLinked (legacy) or isEmbeddedInternal (new)
        if (node.data?.isLinked || node.data?.isEmbeddedInternal) {
            const items: ContextMenuItem[] = [];

            items.push({
                label: 'Eingebetteten Task löschen',
                action: () => {
                    const groupId = node.data?.embeddedGroupId;
                    console.log('[FlowEditor] Delete embedded - node:', node.name, 'groupId:', groupId);
                    console.log('[FlowEditor] All nodes:', this.nodes.map(n => ({ name: n.name, groupId: n.data?.embeddedGroupId })));

                    const nodesToDelete = groupId
                        ? this.nodes.filter(n => n.data?.embeddedGroupId === groupId)
                        : [node]; // Fallback for legacy data

                    console.log('[FlowEditor] Nodes to delete:', nodesToDelete.map(n => n.name));

                    const count = nodesToDelete.length;
                    if (confirm(`Möchtest du den gesamten eingebetteten Task (${count} Elemente) wirklich löschen?`)) {
                        nodesToDelete.forEach(n => this.removeNode(n.name));

                        // Also find the parent proxy and reset its expanded state
                        const anyGhost = nodesToDelete[0];
                        if (anyGhost && anyGhost.data?.parentProxyId) {
                            const proxy = this.nodes.find(n => n.name === anyGhost.data.parentProxyId);
                            if (proxy && proxy.data) {
                                proxy.data.isExpanded = false;
                            }
                        }

                        this.syncToProject();
                    }
                }
            });

            items.push({ separator: true, label: '' });

            items.push({
                label: '➔ Zum Original-Flow springen',
                action: () => {
                    const taskName = node.data?.taskName || node.data?.name || 'original';
                    this.switchActionFlow(taskName);
                }
            });

            const menu = new ContextMenu();
            menu.show(e.clientX, e.clientY, items);
            return;
        }

        const items: ContextMenuItem[] = [];

        // 1. Basic Actions
        if (this.currentFlowContext === 'event-map' && node.data?.isMapLink && node.data?.taskName) {
            items.push({
                label: '➔ Gehe zum Task-Workflow',
                action: () => this.switchActionFlow(node.data.taskName)
            });
        }

        items.push({
            label: 'Bearbeiten...',
            action: () => this.handleNodeDoubleClick(node)
        });

        // Delete option: Immer erlaubt, aber mit Referenz-Warnung falls vorhanden
        const elementName = node.Name || node.name;
        const liveRefs = projectRegistry.findReferences(elementName);
        const refCount = liveRefs.length;

        items.push({
            label: refCount > 0 ? `Löschen (${refCount} Referenz${refCount !== 1 ? 'en' : ''})` : 'Löschen',
            action: () => this.deleteNode(node),
            color: '#ff4444'
        });

        // Expansion Option for Tasks with internal logic
        if (node instanceof FlowTask) {
            const taskDef = node.getTaskDefinition();
            const flowChart = (this.project as any)?.flowCharts?.[node.Name] || taskDef?.flowChart;
            const hasGhosts = this.nodes.some(n => n.data?.parentProxyId === node.name);
            const isExpanded = node.data?.isExpanded && hasGhosts;

            if (flowChart && flowChart.elements?.length > 0 && !isExpanded) {
                items.push({
                    label: '📂 Ausklappen (Aktionen zeigen)',
                    action: () => this.handleNodeDoubleClick(node)
                });
                items.push({ separator: true, label: '' });
            }
        }

        // 2. Assign Actions (Reuse)
        if (node.getType() === 'Task' && this.project) {
            // Option A: Link (Default)
            const linkItems: ContextMenuItem[] = this.project.tasks.map(t => ({
                label: t.name,
                action: () => this.assignTaskToNode(node, t)
            }));

            if (linkItems.length > 0) {
                items.push({
                    label: 'Use Existing Task (Link)',
                    submenu: linkItems
                });
            } else {
                items.push({ label: 'No Existing Tasks', action: () => { } });
            }

            // Option B: Import
            const importItems: ContextMenuItem[] = this.project.tasks.map(t => ({
                label: t.name,
                action: () => this.importTaskGraph(node, t)
            }));

            if (importItems.length > 0) {
                items.push({
                    label: 'Embed Task (Copy Structure)',
                    submenu: importItems
                });
            }

            // Option C: Library Tasks als Vorlage (Blaupause)
            const libraryTasks = libraryService.getTasks();
            if (libraryTasks.length > 0) {
                const libraryItems: ContextMenuItem[] = libraryTasks.map(t => ({
                    label: `📋 ${t.name}`,
                    action: () => this.copyLibraryTaskAsTemplate(node, t)
                }));
                items.push({
                    label: '📚 Library-Task als Vorlage',
                    submenu: libraryItems
                });
            }
        } else if (node.getType() === 'Action' && this.project) {
            // Option A: Link
            const linkItems: ContextMenuItem[] = this.project.actions.map(a => ({
                label: a.name,
                action: () => this.linkActionToNode(node, a)
            }));

            if (linkItems.length > 0) {
                items.push({
                    label: 'Use Existing Action (Link)',
                    submenu: linkItems
                });
            }

            // Option B: Copy
            const copyItems: ContextMenuItem[] = this.project.actions.map(a => ({
                label: a.name,
                action: () => this.copyActionToNode(node, a)
            }));

            if (copyItems.length > 0) {
                items.push({
                    label: 'Embed Action (Copy)',
                    submenu: copyItems
                });
            }
        }

        this.contextMenu.show(e.clientX, e.clientY, items);
    }

    private handleConnectionContextMenu(e: MouseEvent, conn: FlowConnection) {
        e.preventDefault();
        e.stopPropagation();

        const items: ContextMenuItem[] = [
            { label: 'Verbindung löschen', action: () => this.deleteConnection(conn), color: '#ff4444' }
        ];
        this.contextMenu.show(e.clientX, e.clientY, items);
    }

    private assignTaskToNode(node: FlowElement, task: any) {

        // For "Link" mode, we import the task's graph with hatched styling
        // This replaces the Task node with the actual content (Task + Actions)
        // All imported nodes are marked as linked (hatched)
        this.importTaskGraph(node, task, true);
    }

    private linkActionToNode(node: FlowElement, action: any) {
        // SINGLE SOURCE OF TRUTH: Linked nodes store only the name and isLinked flag.
        // The data is loaded from project.actions at runtime.
        node.data = { name: action.name, isLinked: true };
        node.setText(action.name);
        node.setDetailed(true);
        node.setLinked(true); // Apply hatched styling
        if (action.description) node.Description = action.description;
        this.syncToProject();
    }

    private copyActionToNode(node: FlowElement, action: any) {
        if (!this.project) return;

        // SINGLE SOURCE OF TRUTH: Create an independent deep copy of the action
        // and register it as a new global action with a unique name.
        const originalName = action.name;
        const newName = this.generateUniqueActionName(`${originalName}_Copy`);

        const actionCopy = JSON.parse(JSON.stringify(action));
        actionCopy.name = newName;

        // Add to project actions (Library)
        this.project.actions.push(actionCopy);

        // Update node to link to this NEW action
        node.data = { name: newName, isLinked: true, originalName: originalName, isCopy: true };
        node.setText(newName);
        node.setDetailed(true);
        node.setLinked(true); // Technically it's a link to the NEW global action

        if (action.description) node.Description = action.description;

        this.syncToProject();
    }

    private isTaskEmpty(task: any): boolean {
        if (!task) return true;

        // A Task is "empty" if it has no params AND no actionSequence.
        // We ignore the flowChart elements for this check because Auto-Spawn 
        // creates a stub diagram which would make it "not empty" 
        // otherwise, but it's still just a placeholder.
        const hasParams = task.params && task.params.length > 0;
        const hasLogic = task.actionSequence && task.actionSequence.length > 0;

        return !hasParams && !hasLogic;
    }

    /**
     * Kopiert einen Library-Task als Blaupause ins Projekt.
     * Der kopierte Task ist vollständig editierbar und unabhängig von der Library.
     */
    private copyLibraryTaskAsTemplate(node: FlowElement, libraryTask: any) {
        if (!this.project) return;

        // PRIORITÄT 1: Prüfen ob der Name, den der User dem Knoten bereits gegeben hat, 
        // existiert und leer ist -> Dann "hydrieren" wir diesen.
        const currentUserTaskName = node.Name;
        let existingTask = this.project.tasks.find(t => t.name === currentUserTaskName);
        let newName = currentUserTaskName;
        let isHydration = false;

        if (existingTask && this.isTaskEmpty(existingTask)) {
            // Hydrierung erfolgt nun automatisch ohne Rückfrage (Nutzer-Wunsch)
            isHydration = true;
            console.log(`[FlowEditor] Automatically hydrating existing empty task: ${currentUserTaskName}`);
        }

        if (!isHydration) {
            // PRIORITÄT 2: Eindeutigen Namen basierend auf Library-Namen generieren
            let baseName = libraryTask.name;
            newName = baseName;
            let counter = 1;

            // Prüfe ob Name bereits existiert und NICHT leer ist
            while (this.project.tasks.some(t => t.name === newName)) {
                const conflictTask = this.project.tasks.find(t => t.name === newName);
                if (this.isTaskEmpty(conflictTask)) {
                    // Falls wir über einen leeren Task mit dem Namen stolpern, nehmen wir den als Vorschlag
                    existingTask = conflictTask;
                    break;
                }
                newName = `${baseName}_${counter}`;
                counter++;
            }

            // User nach Namen fragen für den NEUEN (oder zu hydrierenden) Task
            const userInput = prompt(`Name für die Vorlage (basierend auf "${libraryTask.name}"):`, newName);
            if (!userInput) return;
            newName = userInput;

            // Nochmal prüfen ob der neue Name bereits existiert und leer ist
            existingTask = this.project.tasks.find(t => t.name === newName);
        }

        // 1. Create independent deep copy of library data
        const taskCopy = JSON.parse(JSON.stringify(libraryTask));
        taskCopy.name = newName;
        taskCopy.description = (libraryTask.description || '') + ' (Kopie)';
        taskCopy.sourceTaskName = libraryTask.name;

        // Mark parameters as library-born so they don't get pruned by syncTaskParameters
        if (taskCopy.params) {
            taskCopy.params.forEach((p: any) => p.fromLibrary = true);
        }

        console.log(`[FlowEditor] CLONE START: Source "${libraryTask.name}" has seq=${libraryTask.actionSequence?.length || 0}, params=${taskCopy.params?.length || 0}`);
        if (!taskCopy.actionSequence || taskCopy.actionSequence.length === 0) {
            console.warn(`[FlowEditor] CLONE WARNING: Source task "${libraryTask.name}" has NO actionSequence!`);
        }

        // 2. FlowChart auch kopieren falls vorhanden
        if (libraryTask.flowChart) {
            if (!this.project.flowCharts) this.project.flowCharts = {};

            const flowChartCopy = JSON.parse(JSON.stringify(libraryTask.flowChart));
            const idMapping: Record<string, string> = {};

            if (flowChartCopy.elements) {
                flowChartCopy.elements.forEach((el: any) => {
                    const oldId = el.id;
                    const newId = `${newName}-${oldId}`;
                    idMapping[oldId] = newId;
                    el.id = newId;

                    const actionName = el.properties?.name || el.data?.name || el.data?.actionName;
                    if (el.type === 'Action' && actionName) {
                        const actionInLibrary = this.findActionInSequence(libraryTask.actionSequence, actionName);
                        if (actionInLibrary) {
                            el.data = { ...el.data, ...actionInLibrary, name: actionName };
                        }
                    }
                });
            }

            if (flowChartCopy.connections) {
                flowChartCopy.connections.forEach((conn: any) => {
                    if (conn.startTargetId && idMapping[conn.startTargetId]) conn.startTargetId = idMapping[conn.startTargetId];
                    if (conn.endTargetId && idMapping[conn.endTargetId]) conn.endTargetId = idMapping[conn.endTargetId];
                });
            }

            // Automatisch einen Task-Knoten am Anfang einfügen (falls nicht vorhanden)
            const hasTaskNode = flowChartCopy.elements?.some((el: any) => el.type === 'Task');
            if (!hasTaskNode && flowChartCopy.elements?.length > 0) {
                const taskNodeId = `${newName}-task-entry`;
                const firstElement = flowChartCopy.elements[0];

                // Initialize paramValues with defaults from library task
                const paramValues: Record<string, any> = {};
                if (libraryTask.params && Array.isArray(libraryTask.params)) {
                    libraryTask.params.forEach((p: any) => {
                        if (p.name && p.default !== undefined) {
                            paramValues[p.name] = p.default;
                        }
                    });
                }

                // Task-Knoten vor den ersten Aktionen platzieren
                const taskNode = {
                    id: taskNodeId,
                    type: 'Task',
                    x: 40,
                    y: 60,
                    width: 160,
                    height: 60,
                    properties: {
                        name: newName,
                        details: libraryTask.description || '',
                        description: ''
                    },
                    data: {
                        taskName: newName,
                        paramValues: paramValues
                    }
                };

                // Task-Knoten an den Anfang stellen
                flowChartCopy.elements.unshift(taskNode);

                // Verbindung vom Task-Knoten zur ersten Aktion erstellen
                if (!flowChartCopy.connections) flowChartCopy.connections = [];
                flowChartCopy.connections.unshift({
                    startTargetId: taskNodeId,
                    endTargetId: firstElement.id,
                    startX: 200,
                    startY: 90,
                    endX: firstElement.x || 260,
                    endY: 90,
                    data: {
                        startAnchorType: 'output',
                        endAnchorType: 'input'
                    }
                });

                // Bestehende Elemente nach rechts verschieben
                flowChartCopy.elements.forEach((el: any, idx: number) => {
                    if (idx > 0) { // Überspringe den neuen Task-Knoten
                        el.x = (el.x || 40) + 220;
                    }
                });

                console.log(`[FlowEditor] CLONE: Added Task entry node "${newName}" to flowchart`);
            }

            // Bind fully prepared flowchart to the task copy
            taskCopy.flowChart = flowChartCopy;
            this.project.flowCharts[newName] = flowChartCopy;
        }

        // 3. ATOMIC COMMIT: Task zum Projekt hinzufügen oder existierenden "hydrieren"
        console.log(`%c[FlowEditor] CLONE STEP 3: Committing taskCopy with seq=${taskCopy.actionSequence?.length || 0}`, 'color: cyan');
        if (existingTask) {
            Object.assign(existingTask, taskCopy);
            console.log(`%c[FlowEditor] CLONE COMMIT: Hydrated "${newName}". Seq after assign: ${existingTask.actionSequence?.length || 0}`, 'color: lime');
        } else {
            this.project.tasks.push(taskCopy);
            console.log(`%c[FlowEditor] CLONE COMMIT: Pushed "${newName}". Seq after push: ${taskCopy.actionSequence?.length || 0}`, 'color: lime');
        }

        // 4. UI-Binding (Knoten im Diagramm aktualisieren)
        node.Name = newName;
        node.setText(newName);

        // Metadaten MERGEN statt überschreiben (wichtig für stageObjectId und eventName in der Map!)
        node.data = {
            ...node.data,
            name: newName,
            taskName: newName,
            copiedFromLibrary: libraryTask.name,
            sourceTaskName: libraryTask.name
        };

        // Falls wir in der Event-Map sind: Das Mapping im Projekt-Objekt sofort aktualisieren!
        if (this.currentFlowContext === 'event-map' && node.data.stageObjectId && node.data.eventName) {
            const obj = this.project.objects.find(o => o.id === node.data.stageObjectId);
            if (obj) {
                if (!(obj as any).Tasks) (obj as any).Tasks = {};
                (obj as any).Tasks[node.data.eventName] = newName;
                console.log(`[FlowEditor] CLONE: Updated mapping for ${obj.name}.${node.data.eventName} -> ${newName}`);
            }
        }
        if (libraryTask.description) node.Description = libraryTask.description;
        node.setDetailed(true);
        node.setLinked(false);

        // 5. Registry & Persistence
        this.registerActionsFromTask(existingTask || taskCopy);
        this.rebuildActionRegistry();
        this.updateFlowSelector();

        if (this.onProjectChange) this.onProjectChange();

        // Kein syncToProject nötig - Daten sind bereits korrekt im Projekt!
        // syncToProject würde die Sequenz aus dem aktuellen Diagramm (Event-Map) regenerieren
        // und dabei die gerade kopierten Daten überschreiben.

        const finalCheck = this.project.tasks.find(t => t.name === newName);
        console.log(`%c[FlowEditor] CLONE FINAL: Task "${newName}" is ready (Seq: ${finalCheck?.actionSequence?.length || 0}, Params: ${finalCheck?.params?.length || 0}).`, 'color: lime; font-weight: bold');

        // Optional: Direkt zum neuen Task-Flow wechseln
        if (confirm(`Task "${newName}" wurde erstellt. Möchtest du zum Task-Flow wechseln um ihn zu bearbeiten?`)) {
            this.switchActionFlow(newName);
        }
    }

    /**
     * Scannt einen Task rekursiv nach Aktionen und registriert diese global im Projekt.
     */
    private registerActionsFromTask(task: any) {
        if (!this.project) return;

        // 1. Aus der Sequenz registrieren (falls benannt)
        const processSequence = (sequence: any[]) => {
            if (!sequence) return;
            sequence.forEach(item => {
                const name = item.name || item.actionName;
                if (name) {
                    this.updateGlobalActionDefinition(item);
                }

                if (item.body) processSequence(item.body);
                if (item.then) processSequence(item.then);
                if (item.else) processSequence(item.else);
            });
        };
        processSequence(task.actionSequence);

        // 2. Aus dem FlowChart registrieren (sehr wichtig für Library-Blaupausen!)
        if (task.flowChart && task.flowChart.elements) {
            task.flowChart.elements.forEach((el: any) => {
                if (el.type === 'Action') {
                    const name = el.properties?.name || el.data?.name || el.data?.actionName;
                    const isMeaningful = el.data?.type || el.data?.actionName || el.data?.taskName;
                    if (name && (name !== 'Action' && name !== 'Aktion' || isMeaningful)) {
                        this.updateGlobalActionDefinition({ ...el.data, name });
                    }
                }
            });
        }

        console.log(`[FlowEditor] All actions from task "${task.name}" registered globally.`);
    }

    private handleNodeDoubleClick(node: FlowElement) {
        // DEBUG: Log every double-click to trace the issue
        console.log(`[FlowEditor] === DOUBLE-CLICK on node: ${node.name} ===`);
        console.log(`[FlowEditor]   Type: ${node.getType()}, Name: ${node.Name}`);
        console.log(`[FlowEditor]   data.isLinked: ${node.data?.isLinked}`);
        console.log(`[FlowEditor]   data.isEmbeddedInternal: ${node.data?.isEmbeddedInternal}`);
        console.log(`[FlowEditor]   data.isExpanded: ${node.data?.isExpanded}`);
        console.log(`[FlowEditor]   data.taskName: ${node.data?.taskName}`);
        console.log(`[FlowEditor]   currentFlowContext: ${this.currentFlowContext}`);

        // Feature: Task Expansion & Context Navigation
        const isTask = node instanceof FlowTask;
        const taskName = isTask ? (node.data?.taskName || node.Name) : null;

        if (isTask) {
            // PROTECTION: Never expand a task into its own view (infinite recursion/duplication)
            // The root node in a task view is already "expanded" by virtue of the view itself.
            if (taskName === this.currentFlowContext) {
                console.log(`[FlowEditor] Double-click on context root "${taskName}" - opening editor instead of expansion.`);
                this.openTaskEditor(node);
                return;
            }

            // Determine the next state based on current expansion
            // We search for ANY node that claims this task as its parent
            const ghostNodes = this.nodes.filter(n => n.data?.parentProxyId === node.name);
            const isVisuallyExpanded = ghostNodes.length > 0;
            const isMarkedExpanded = !!node.data?.isExpanded;

            if (isVisuallyExpanded || isMarkedExpanded) {
                // COLLAPSE Logic: Remove all associated ghost elements
                console.log(`[FlowEditor] COLLAPSE task: ${taskName} (ID: ${node.name})`);

                // Identify and remove ghost nodes
                ghostNodes.forEach(gn => {
                    const el = gn.getElement();
                    if (el && el.parentNode) el.parentNode.removeChild(el);
                });
                this.nodes = this.nodes.filter(n => n.data?.parentProxyId !== node.name);

                // Identify and remove ghost connections
                this.connections = this.connections.filter(c => {
                    const isGhostConnection = c.data?.parentProxyId === node.name ||
                        ghostNodes.some(gn => gn.name === c.startTarget?.name || gn.name === c.endTarget?.name);
                    if (isGhostConnection) {
                        const el = c.getElement();
                        if (el && el.parentNode) el.parentNode.removeChild(el);
                    }
                    return !isGhostConnection;
                });

                // Update persistent state
                if (node.data) {
                    node.data.isExpanded = false;
                }
                this.syncToProject();
                return;
            } else {
                // EXPAND Logic: Import the sub-graph of this task
                const taskDef = this.project?.tasks?.find(t => t.name === taskName) || (node as FlowTask).getTaskDefinition();
                if (taskDef) {
                    const flowChart = (this.project as any)?.flowCharts?.[taskName!] || taskDef?.flowChart || taskDef?.flowGraph;
                    if (flowChart && flowChart.elements?.length > 0) {
                        console.log(`[FlowEditor] EXPAND task: ${taskName} (Source: ${taskDef.name})`);
                        this.importTaskGraph(node, taskDef, true);
                        if (node.data) {
                            node.data.isExpanded = true;
                            node.data.sourceTaskName = taskName; // VITAL: Essential for refreshEmbeddedTask on load
                        }
                        this.syncToProject();
                        return;
                    }
                }
            }
        }

        // Feature: Projekt-Landkarte Navigation (Fallback if expand not possible)
        if (this.currentFlowContext === 'event-map' && node.data?.isMapLink && taskName) {
            console.log(`[FlowEditor] Event-Map: Switching to task flow: ${taskName}`);
            this.switchActionFlow(taskName);
            return;
        }

        // Default Behavior: Open Task Editor for regular tasks or toggle details for all others
        if (node instanceof FlowTask) {
            console.log(`[FlowEditor] Opening TaskEditor for: ${taskName}`);
            this.openTaskEditor(node);
            return;
        }

        // UNIFIED BEHAVIOR: Toggle details for ALL node types on double-click
        const newShowState = !node.IsDetailed;
        node.setShowDetails(newShowState, this.project);

        this.syncToProject();

        // Extra: Open Action Editor for actual (non-embedded) action nodes
        if (node.getType() === 'Action' && !node.data?.isEmbeddedInternal) {
            this.openActionEditor(node);
        }
    }

    private openTaskEditor(node: FlowElement) {
        if (!this.project) return;

        // Derive task name from Name property, data, or fallback
        const taskName = node.Name || node.data?.name || node.data?.taskName || `Task_${node.name}`;

        new TaskEditor(this.project, taskName, () => {

            // Save link to task
            node.data = { ...node.data, taskName: taskName };
            node.Text = taskName;
            node.setDetailed(true);

            this.syncToProject();
        });
    }

    private openActionEditor(node: FlowElement) {
        // Construct dialog data from node data
        const nodeData = node.data || {};
        // IMPORTANT: node.Name takes priority as user may have renamed it in Inspector
        const actionName = node.Name || nodeData.name;

        if (!this.project) return;
        const existingAction = this.project.actions.find(a => a.name === actionName);

        // Deep clone everything to prevent reference sharing
        const dialogData = existingAction
            ? JSON.parse(JSON.stringify(existingAction))
            : JSON.parse(JSON.stringify(nodeData));

        // Ensure name and other key fields are correct
        dialogData.name = actionName;
        if (!dialogData.type) dialogData.type = nodeData.type || 'property';
        if (!dialogData.target) dialogData.target = nodeData.target || '';
        if (!dialogData.changes) dialogData.changes = nodeData.changes || {};

        // Add task parameters so the dialog can show them in dropdowns
        if (this.currentFlowContext && this.currentFlowContext !== 'event-map' && this.currentFlowContext !== 'element-overview') {
            const task = this.project.tasks.find(t => t.name === this.currentFlowContext);
            if (task?.params) {
                dialogData.taskParams = task.params;
            }
        }

        console.log('[FlowEditor] openActionEditor dialogData (cloned):', dialogData);

        serviceRegistry.call('Dialog', 'showDialog', ['dialog_action_editor', true, dialogData])
            .then((result: any) => {
                if (result?.action === 'save' && result.data) {
                    const oldName = actionName;
                    const newName = result.data.name;

                    // 1. If name changed, perform project-wide refactoring FIRST
                    if (oldName && newName && oldName !== newName) {
                        console.log(`[FlowEditor] Renaming action from "${oldName}" to "${newName}"...`);
                        RefactoringManager.renameAction(this.project!, oldName, newName);

                        // Update all nodes in memory to prevent syncToProject from re-creating old actions
                        this.renameActionInMemory(oldName, newName);
                    }

                    // SINGLE SOURCE OF TRUTH: Update the global definition in project.actions
                    // Note: result.data contains the full action definition from the dialog
                    this.updateGlobalActionDefinition({ ...result.data, name: newName });

                    // Update the node's visual name
                    node.Name = newName;
                    node.setText(newName);

                    // Update node data to be a LINK (Single Source of Truth)
                    // We DON'T store the full definition here anymore
                    node.data = { name: newName, isLinked: true };
                    node.setLinked(true);

                    // 3. Sync to project to trigger auto-save and ensure consistency
                    this.syncToProject();

                    // 4. Update visual status and refresh details
                    node.setDetailed(true);

                    // For FlowAction, force refresh of details
                    if (node instanceof FlowAction) {
                        // Clear cached details now that project is synced
                        node.Details = '';
                        node.setShowDetails(this.showDetails, this.project);
                    }
                } else if (result?.action === 'delete') {
                    // Handled within dialog usually, but just in case
                }
            });
    }

    /**
     * Renames all action references in the currently loaded in-memory nodes.
     * Crucial to prevent syncToProject from seeing old names and re-creating them.
     */
    private renameActionInMemory(oldName: string, newName: string) {
        this.nodes.forEach(n => {
            if (n.getType() === 'Action') {
                if (n.Name === oldName) n.setText(newName);
                if (n.data) {
                    if (n.data.name === oldName) n.data.name = newName;
                    if (n.data.actionName === oldName) n.data.actionName = newName;
                }
            } else if (n.getType() === 'Condition') {
                if (n.data) {
                    if (n.data.thenAction === oldName) n.data.thenAction = newName;
                    if (n.data.elseAction === oldName) n.data.elseAction = newName;
                }
            }
        });
    }

    private selectNode(node: FlowElement) {
        this.deselectAll(false); // Don't trigger null select, we are about to select something
        this.selectedNode = node;

        // Visual Feedback
        node.getElement().style.outline = '2px solid cyan';

        // Ensure project reference is set for Task nodes (needed for Inspector parameters)
        if (node instanceof FlowTask && this.project) {
            node.setProjectRef(this.project);
        }

        // Feature: Projekt-Landkarte Object Selection
        if (this.currentFlowContext === 'event-map' && node.data?.isProxy && node.data?.stageObjectId) {
            this.currentSelectedStageObjectId = node.data.stageObjectId;
            // Notify Editor to select this object on stage
            serviceRegistry.call('Editor', 'selectObject', [node.data.stageObjectId]);

            // Note: We don't force a full reload here to avoid flickering, 
            // the outline already provides enough feedback.
        }

        // Notify Inspector
        if (this.onObjectSelect) {
            this.onObjectSelect(node);
        }
    }

    /**
     * Selects a node by its ID (name property) - used by Inspector dropdown
     */
    public selectNodeById(nodeId: string | null): void {
        if (!nodeId) {
            this.deselectAll(true);
            return;
        }

        const node = this.nodes.find(n => n.name === nodeId);
        if (node) {
            this.selectNode(node);
            // Scroll node into view if needed
            node.getElement().scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
    }

    /**
     * Re-renders the currently selected node to reflect property changes
     */
    public refreshSelectedNode() {
        if (!this.selectedNode) return;

        // Clear cached details to force regeneration
        if (this.selectedNode instanceof FlowAction) {
            this.selectedNode.Details = '';
            this.selectedNode.setShowDetails(this.showDetails, this.project);
        } else {
            // Task or Start node - simple text refresh
            this.selectedNode.Text = this.selectedNode.Name;
        }
    }

    private setupConnectionListeners(conn: FlowConnection) {
        // Selection
        conn.getElement().addEventListener('mousedown', (e) => {
            e.stopPropagation();
            this.deselectAll();
            conn.select();
            this.selectedConnection = conn;
        });

        // Context Menu for Connection
        conn.getElement().addEventListener('contextmenu', (e) => {
            this.handleConnectionContextMenu(e, conn);
        });

        // Handle Dragging
        const startH = conn.getStartHandle();
        const endH = conn.getEndHandle();

        const onHandleDown = (h: HTMLElement, isStart: boolean) => {
            h.addEventListener('mousedown', (e) => {
                e.stopPropagation();

                // Check if this is an INTERNAL connection (both ends are embedded internal nodes)
                // Internal connections CAN now be modified because we support persistence for ghost connections.
                // Connections TO/FROM the container are also allowed.

                this.isDraggingHandle = true;
                this.activeHandle = h;
                this.activeConnection = conn;
                // Store which handle (start or end) for the move logic
                h.dataset.isStart = isStart.toString();
            });
        };

        onHandleDown(startH, true);
        onHandleDown(endH, false);

        conn.onLabelDoubleClick = () => {
            if (conn.data && conn.data.isMapLink) {
                const { objectName, eventName } = conn.data;
                if (serviceRegistry) {
                    serviceRegistry.call('Editor', 'jumpToDebug', [objectName, eventName]);
                }
            }
        };
    }

    private handleGlobalMove(e: MouseEvent) {
        if (!this.isDraggingHandle || !this.activeConnection || !this.activeHandle) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Clear previous highlights
        this.canvas.querySelectorAll('.flow-anchor.snap-target').forEach(a => a.classList.remove('snap-target'));

        const isStart = this.activeHandle.dataset.isStart === 'true';

        // Check for magnetic snap
        // isStart=true means we're moving the START of the connection -> should snap to OUTPUTs
        // isStart=false means we're moving the END of the connection -> should snap to INPUTs
        const snapFilter = isStart ? 'output' : 'input';
        const snap = this.findClosestAnchor(x, y, 80, snapFilter);

        let targetX = x;
        let targetY = y;

        if (snap) {
            targetX = snap.pos.x;
            targetY = snap.pos.y;

            // Visual feedback: Highlight the targeted anchor
            const nodeEl = snap.node.getElement();
            const anchorTypeClass = snap.anchorType === 'input' ? 'input' :
                snap.anchorType === 'output' ? 'output' :
                    snap.anchorType === 'top' ? 'top' :
                        snap.anchorType === 'bottom' ? 'bottom' :
                            snap.anchorType === 'true' ? 'true-branch' : 'false-branch';

            const anchorEl = nodeEl.querySelector(`.flow-anchor.${anchorTypeClass}`);
            if (anchorEl) {
                anchorEl.classList.add('snap-target');
            }
        }

        if (isStart) {
            this.activeConnection.setStartPoint(targetX, targetY);
        } else {
            this.activeConnection.setEndPoint(targetX, targetY);
        }
    }

    private handleGlobalUp(e: MouseEvent) {
        if (!this.isDraggingHandle || !this.activeConnection || !this.activeHandle) return;

        const isStart = this.activeHandle.dataset.isStart === 'true';
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Final snap check
        // isStart=true means we're moving the START of the connection -> should snap to OUTPUTs
        // isStart=false means we're moving the END of the connection -> should snap to INPUTs
        const snapFilter = isStart ? 'output' : 'input';
        const snap = this.findClosestAnchor(x, y, 80, snapFilter);

        if (snap) {
            // Check if the target node is a ghost node
            const isTargetGhost = snap.node.data?.isEmbeddedInternal || snap.node.data?.parentProxyId;

            if (isStart) {
                this.activeConnection.attachStart(snap.node);
                // Update start anchor type and mark as embedded if target is ghost
                this.activeConnection.data = {
                    ...this.activeConnection.data,
                    startAnchorType: snap.anchorType,
                    isEmbeddedInternal: this.activeConnection.data?.isEmbeddedInternal || isTargetGhost || false,
                    parentProxyId: this.activeConnection.data?.parentProxyId || snap.node.data?.parentProxyId
                };
            } else {
                this.activeConnection.attachEnd(snap.node);
                // Update end anchor type and mark as embedded if target is ghost
                this.activeConnection.data = {
                    ...this.activeConnection.data,
                    endAnchorType: snap.anchorType,
                    isEmbeddedInternal: this.activeConnection.data?.isEmbeddedInternal || isTargetGhost || false,
                    parentProxyId: this.activeConnection.data?.parentProxyId || snap.node.data?.parentProxyId
                };
            }
        }
        // If not snapped, it remains detached at the dropped position (set in handleGlobalMove)

        this.isDraggingHandle = false;
        this.activeHandle = null;
        this.activeConnection = null;

        // Ensure changes are persisted immediately after connection work
        this.syncToProject();

        // Final cleanup of highlights
        this.canvas.querySelectorAll('.flow-anchor.snap-target').forEach(a => a.classList.remove('snap-target'));
    }

    /**
     * Finds the closest anchor to the given position.
     * @param x Canvas-relative X
     * @param y Canvas-relative Y
     * @param radius Snap radius in pixels
     * @param filter 'input' = only input anchors (left, top), 'output' = only output anchors (right, bottom, true, false)
     */
    private findClosestAnchor(x: number, y: number, radius: number, filter?: 'input' | 'output'): { node: FlowElement, pos: { x: number, y: number }, dist: number, anchorType: string } | null {
        let closest: { node: FlowElement, pos: { x: number, y: number }, dist: number, anchorType: string } | null = null;

        // Define which anchors are inputs vs outputs
        const inputAnchors = ['input', 'top'];  // Left, Top
        const outputAnchors = ['output', 'bottom', 'true', 'false', 'right'];  // Right, Bottom, Condition branches

        this.nodes.forEach(node => {
            // Determine which anchors to check based on node type
            let anchorsToCheck: string[];
            if (node.getType() === 'Condition') {
                anchorsToCheck = ['input', 'true', 'false', 'top', 'bottom'];
            } else {
                anchorsToCheck = ['input', 'output', 'top', 'bottom'];
            }

            // Apply filter if specified
            if (filter === 'input') {
                anchorsToCheck = anchorsToCheck.filter(a => inputAnchors.includes(a));
            } else if (filter === 'output') {
                anchorsToCheck = anchorsToCheck.filter(a => outputAnchors.includes(a));
            }

            anchorsToCheck.forEach(type => {
                const pos = (node as any).getAnchorPosition(type);
                const dist = Math.sqrt((pos.x - x) ** 2 + (pos.y - y) ** 2);
                if (dist < radius) {
                    if (!closest || dist < closest.dist) {
                        closest = { node, pos, dist, anchorType: type };
                    }
                }
            });
        });

        return closest;
    }

    public show() {
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
    }

    public hide() {
        this.container.style.display = 'none';
    }

    /**
     * Returns all nodes in the current flow diagram
     * Used by Inspector to populate object selector in Flow context
     */
    public getNodes(): FlowElement[] {
        return this.nodes;
    }

    // Grid Logic
    private updateGrid() {
        if (!this.flowStage) return;

        const cellSize = this.flowStage.cellSize;
        const bg = this.flowStage.style.backgroundColor || '#1e1e1e';
        const snap = this.flowStage.snapToGrid;

        // Propagate grid settings to all nodes
        this.nodes.forEach(node => {
            node.setGridConfig(cellSize, snap);
        });

        // Propagate grid settings to all connections
        this.connections.forEach(conn => {
            conn.setGridConfig(cellSize);
        });

        if (!this.flowStage.showGrid) {
            this.canvas.style.backgroundImage = 'none';
            this.canvas.style.backgroundColor = bg;
        } else {
            // Logical grid color based on background brightness (simple heuristic)
            const gridColor = bg === '#ffffff' ? '#ccc' : '#555';

            this.canvas.style.backgroundColor = bg;
            this.canvas.style.backgroundImage = `radial-gradient(circle at 0px 0px, ${gridColor} 1px, transparent 1px)`;
            this.canvas.style.backgroundSize = `${cellSize}px ${cellSize}px`;
        }
    }

    // Inspector Properties for Flow Editor (Grid Settings)
    public get name(): string { return 'Flow Grid Settings'; }

    public get GridColumns(): number { return this.flowStage.cols; }
    public set GridColumns(v: number) {
        this.flowStage.cols = v;
        this.updateGrid();
        this.syncToProject();
    }

    public get GridRows(): number { return this.flowStage.rows; }
    public set GridRows(v: number) {
        this.flowStage.rows = v;
        this.updateGrid();
        this.syncToProject();
    }

    public get CellSize(): number { return this.flowStage.cellSize; }
    public set CellSize(v: number) {
        this.flowStage.cellSize = v;
        this.updateGrid();
        this.syncToProject();
    }

    public get SnapToGrid(): boolean { return this.flowStage.snapToGrid; }
    public set SnapToGrid(v: boolean) {
        this.flowStage.snapToGrid = v;
        this.updateGrid();
        this.syncToProject();
    }

    public get ShowGrid(): boolean { return this.flowStage.showGrid; }
    public set ShowGrid(v: boolean) {
        this.flowStage.showGrid = v;
        this.updateGrid();
        this.syncToProject();
    }

    public get BackgroundColor(): string { return this.flowStage.style.backgroundColor || '#1e1e1e'; }
    public set BackgroundColor(v: string) {
        this.flowStage.style.backgroundColor = v;
        this.updateGrid();
        this.syncToProject();
    }

    public getInspectorProperties(): any[] {
        return [
            { name: 'GridColumns', type: 'number', label: 'Columns', group: 'Grid' },
            { name: 'GridRows', type: 'number', label: 'Rows', group: 'Grid' },
            { name: 'CellSize', type: 'number', label: 'Cell Size (px)', group: 'Grid' },
            { name: 'SnapToGrid', type: 'boolean', label: 'Snap to Grid', group: 'Grid' },
            { name: 'ShowGrid', type: 'boolean', label: 'Show Grid', group: 'Grid' },
            { name: 'BackgroundColor', type: 'color', label: 'Background', group: 'Grid' }
        ];
    }

    public hasNode(id: string): boolean {
        return this.nodes.some(n => n.name === id);
    }

    public removeNode(id: string) {
        const nodeIndex = this.nodes.findIndex(n => n.name === id);
        if (nodeIndex === -1) return;

        const node = this.nodes[nodeIndex];

        // Remove connections attached to this node
        this.connections = this.connections.filter(c => {
            const isAttached = c.startTarget === node || c.endTarget === node;
            if (isAttached) {
                const el = c.getElement();
                const sh = c.getStartHandle();
                const eh = c.getEndHandle();
                if (el.parentNode) el.parentNode.removeChild(el);
                if (sh.parentNode) sh.parentNode.removeChild(sh);
                if (eh.parentNode) eh.parentNode.removeChild(eh);
            }
            return !isAttached;
        });

        // Remove node DOM
        const el = node.getElement();
        if (el.parentNode) el.parentNode.removeChild(el);

        // Remove from list
        this.nodes.splice(nodeIndex, 1);

        // Clear Selection if needed
        if (this.selectedNode === node) {
            this.selectedNode = null;
            if (this.onObjectSelect) this.onObjectSelect(null);
        }
    }

    // ─────────────────────────────────────────────
    // Details View Toggle
    // ─────────────────────────────────────────────

    /**
     * Wechselt zwischen Konzept- und Details-Ansicht
     */
    private toggleDetailsView(): void {
        this.showDetails = !this.showDetails;
        localStorage.setItem('gcs_flow_show_details', this.showDetails.toString());

        // Button-Text aktualisieren
        this.detailsToggleBtn.innerText = this.showDetails ? '📝 Details' : '📋 Konzept';
        this.detailsToggleBtn.style.background = this.showDetails ? '#007acc' : '#444';

        // Alle Action-Knoten aktualisieren
        this.updateActionDetails();
    }

    /**
     * Aktualisiert die Anzeige aller Action-Knoten basierend auf showDetails
     */
    private updateActionDetails(): void {
        this.nodes.forEach(node => {
            node.setShowDetails(this.showDetails, this.project);
        });
    }

    /**
     * Entfernt alle Knoten und Verbindungen vom Canvas
     */
    private clearFlowCanvas(): void {
        // Clear existing nodes
        this.nodes.forEach(n => {
            if (n.getElement().parentNode === this.canvas) {
                this.canvas.removeChild(n.getElement());
            }
        });
        this.nodes = [];

        // Clear existing connections (including labels)
        this.connections.forEach(c => {
            c.destroy();
        });
        this.connections = [];
    }

    /**
     * Generiert eine automatische Übersicht über alle Objekt-Event-Task Verbindungen
     */
    private generateEventMap(): void {
        if (!this.project) return;

        // No need to clear here, loadFromProject already calls clearFlowCanvas()

        const startX = 50;
        const taskX = 600;
        let currentY = 50;
        const rowHeight = 80;
        const eventLinkSpacing = 80; // 60px node height + 20px gap

        const objectsWithTasks = this.project.objects.filter(obj => {
            const tasks = (obj as any).Tasks;
            const hasTasks = tasks && Object.keys(tasks).length > 0;

            // Auch Objekte mit Bindungen anzeigen (selbst ohne Tasks)
            let hasBindings = false;
            const checkBindings = (target: any) => {
                if (!target || hasBindings) return;
                Object.entries(target).forEach(([key, val]) => {
                    if (typeof val === 'string' && val.startsWith('${')) {
                        hasBindings = true;
                    } else if (key === 'style' && typeof val === 'object') {
                        checkBindings(val);
                    }
                });
            };
            checkBindings(obj);

            if (!hasTasks && !hasBindings) return false;

            if (this.filterText) {
                const nameMatches = obj.name.toLowerCase().includes(this.filterText);
                const taskNames = hasTasks ? Object.values(tasks) as string[] : [];
                const taskMatches = taskNames.some(t => t.toLowerCase().includes(this.filterText));
                const eventNames = hasTasks ? Object.keys(tasks) : [];
                const eventMatches = eventNames.some(e => e.toLowerCase().includes(this.filterText));

                // Auch nach Bindungen filtern? (Optional, aber hilfreich)
                // const bindingMatches = ... 

                return nameMatches || taskMatches || eventMatches || (hasBindings && obj.name.toLowerCase().includes(this.filterText));
            }
            return true;
        });

        objectsWithTasks.forEach(obj => {
            // Create Object Proxy Node
            const objNode = new FlowComponent('proxy-' + obj.id, startX, currentY, this.canvas, this.flowStage.cellSize);
            objNode.Name = obj.name;  // Use Name to set dataset.name for stable name storage
            objNode.autoSize();
            objNode.Details = (obj as any).className || 'Object';

            // Extract reactive bindings from object to show them in the diagram
            const bindings: Record<string, any> = {};
            const gatherBindings = (target: any, prefix = '') => {
                if (!target) return;
                Object.entries(target).forEach(([key, val]) => {
                    if (typeof val === 'string' && val.startsWith('${')) {
                        bindings[prefix + key] = val;
                    } else if (key === 'style' && typeof val === 'object') {
                        gatherBindings(val, 'style.');
                    }
                });
            };
            gatherBindings(obj);

            objNode.data = {
                stageObjectId: obj.id,
                isProxy: true,
                paramValues: bindings // Will be rendered by FlowComponent.setShowDetails
            };
            // Call setShowDetails to trigger updateContent and show f(x) indicator
            // The global showDetails toggle determines if we show detailed or concept view
            objNode.setShowDetails(this.showDetails && Object.keys(bindings).length > 0);

            // Highlight if selected
            if (obj.id === this.currentSelectedStageObjectId) {
                objNode.getElement().style.background = '#444400';
                objNode.getElement().style.border = '2px solid #ffcc00';
            }

            this.nodes.push(objNode);
            this.setupNodeListeners(objNode);

            // Events/Tasks for this object
            const taskMappings = (obj as any).Tasks || {};
            const events = Object.entries(taskMappings);
            console.log(`[FlowEditor] Event-Map: Object "${obj.name}" has ${events.length} events:`, events);

            events.forEach(([eventName, taskName], idx) => {
                console.log(`[FlowEditor]   Processing event ${idx}: ${eventName} -> ${taskName}`);
                if (typeof taskName !== 'string') return;

                // Create a Task Node for EACH event (no deduplication)
                const taskY = currentY + (idx * eventLinkSpacing);
                const taskNode = new FlowTask('map-task-' + eventName + '-' + taskName, taskX, taskY, this.canvas, this.flowStage.cellSize);
                taskNode.Text = taskName;
                taskNode.autoSize();

                const taskDef = this.project!.tasks.find((t: any) => t.name === taskName);
                if (taskDef && taskDef.description) {
                    taskNode.Description = taskDef.description;
                }

                // Check if this task uses a library task internally
                let usedLibraryTaskName: string | null = null;
                const flowData = (taskDef as any)?.flowChart || (taskDef as any)?.flowGraph ||
                    this.project!.flowCharts?.[taskName];

                if (flowData?.elements) {
                    for (const el of flowData.elements) {
                        const elTaskName = el.data?.taskName;
                        if (elTaskName && libraryService.getTask(elTaskName)) {
                            usedLibraryTaskName = elTaskName;
                            break;
                        }
                    }
                }

                const isLibraryBased = !!usedLibraryTaskName;

                if (isLibraryBased) {
                    taskNode.setLinked(true);
                    taskNode.Details = `📚 ${usedLibraryTaskName}`;
                }

                taskNode.data = {
                    taskName: taskName,
                    eventName: eventName,
                    stageObjectId: obj.id, // VITAL for cloning mapping update!
                    isMapLink: true,
                    isLibraryBased,
                    usedLibraryTaskName
                };
                taskNode.setDetailed(isLibraryBased);
                this.nodes.push(taskNode);
                this.setupNodeListeners(taskNode);

                // Create Connection
                const conn = new FlowConnection(this.canvas, 0, 0, 0, 0);
                conn.setGridConfig(this.flowStage.cellSize);
                conn.attachStart(objNode);
                conn.attachEnd(taskNode);
                conn.data = {
                    objectName: obj.name,
                    eventName: eventName,
                    isMapLink: true
                };
                conn.Text = eventName;
                conn.updatePosition();
                this.connections.push(conn);
                this.setupConnectionListeners(conn);
            });

            currentY += Math.max(rowHeight, events.length * eventLinkSpacing + 20);
        });

        // Notify listeners
        if (this.onNodesChanged) {
            this.onNodesChanged(this.nodes);
        }

        this.updateScrollArea();
    }

    /**
     * Generiert eine Übersicht über alle Tasks und Actions und deren Verwendungsstatus.
     * Ermöglicht das Löschen von ungenutzten Elementen.
     */
    private generateElementOverview(): void {
        if (!this.project) return;

        const actionX = 50;
        const gridSize = this.flowStage.cellSize;

        // Snap all positions to grid from the start
        const snappedActionX = Math.round(actionX / gridSize) * gridSize;
        let currentActionY = Math.round(90 / gridSize) * gridSize; // Snapped to grid
        let currentTaskY = Math.round(90 / gridSize) * gridSize;   // Snapped to grid
        const spacingY = Math.round(70 / gridSize) * gridSize; // Snap spacing to grid
        const baseNodeHeight = gridSize * 3; // 3 rows

        // 1. Calculate maximum widths for each category
        const measureTextWidth = (text: string, fontSize: number = 14): number => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return 150; // Fallback
            ctx.font = `bold ${fontSize}px Arial, sans-serif`;
            return ctx.measureText(text).width;
        };

        // Find longest action name
        let maxActionWidth = 150; // Minimum width
        this.project.actions.forEach(a => {
            const width = measureTextWidth(a.name || "") + 60; // Padding for anchors/borders
            if (width > maxActionWidth) maxActionWidth = width;
        });

        // Find longest task name
        let maxTaskWidth = 150; // Minimum width
        this.project.tasks.forEach(t => {
            const width = measureTextWidth(t.name || "") + 60;
            if (width > maxTaskWidth) maxTaskWidth = width;
        });

        // Calculate taskX position based on longest action + gap
        const taskX = actionX + maxActionWidth + 80; // 80px gap between columns

        // 2. Collect Usage Data
        const usedTasks = new Set<string>();
        const usedActions = new Set<string>();

        // Tasks used by objects
        this.project.objects.forEach(obj => {
            const mappings = (obj as any).Tasks || {};
            Object.values(mappings).forEach(t => {
                if (typeof t === 'string') usedTasks.add(t);
            });
        });

        // Actions used by tasks & charts
        this.project.tasks.forEach(t => {
            if (t.actionSequence) {
                const processSeq = (seq: any[]) => {
                    seq.forEach(item => {
                        if (item.type === 'action' && item.name) usedActions.add(item.name);
                        if (item.type === 'condition') {
                            if (item.thenAction) usedActions.add(item.thenAction);
                            if (item.elseAction) usedActions.add(item.elseAction);
                        }
                    });
                };
                processSeq(t.actionSequence);
            }
        });

        const charts: { [key: string]: any } = { ... (this.project.flowCharts || {}) };
        if ((this.project as any).flow) charts['__legacy_flow__'] = (this.project as any).flow;

        Object.values(charts).forEach(chart => {
            (chart.elements || []).forEach((el: any) => {
                const name = el.data?.name || el.data?.actionName || el.properties?.name;
                if (el.type === 'Action' && name) usedActions.add(name);
                if (el.type === 'Condition' && el.data) {
                    if (el.data.thenAction) usedActions.add(el.data.thenAction);
                    if (el.data.elseAction) usedActions.add(el.data.elseAction);
                }
            });
        });

        // Count occurrences for duplicate detection
        const actionCounts = new Map<string, number>();
        this.project.actions.forEach(a => {
            actionCounts.set(a.name, (actionCounts.get(a.name) || 0) + 1);
        });

        // 3. Render Header Labels (same width as objects below)
        const headerY = Math.round(20 / gridSize) * gridSize; // Snap to grid

        const actionHeader = new FlowStart('header-actions', snappedActionX, headerY, this.canvas, gridSize);
        actionHeader.Text = "Alle Actions";
        actionHeader.Width = maxActionWidth;
        actionHeader.Height = 40;
        actionHeader.getElement().style.color = "#00ffff";
        actionHeader.getElement().style.fontWeight = "bold";
        actionHeader.getElement().style.textAlign = "center";
        this.nodes.push(actionHeader);

        const taskHeader = new FlowStart('header-tasks', taskX, headerY, this.canvas, gridSize);
        taskHeader.Text = "Alle Tasks";
        taskHeader.Width = maxTaskWidth;
        taskHeader.Height = 40;
        taskHeader.getElement().style.color = "#00ff00";
        taskHeader.getElement().style.fontWeight = "bold";
        taskHeader.getElement().style.textAlign = "center";
        this.nodes.push(taskHeader);

        // 4. Render Actions (sorted) with unified width
        const actionItems = this.project.actions.map((action, originalIndex) => ({ action, originalIndex }));
        actionItems.sort((a, b) => (a.action.name || "").localeCompare(b.action.name || ""));

        actionItems.forEach((item, displayIdx) => {
            const action = item.action;
            const refs = projectRegistry.findReferences(action.name);
            const isUsed = refs.length > 0;
            const isDuplicate = (actionCounts.get(action.name) || 0) > 1;

            const nodeId = 'over-action-' + displayIdx + '-' + (action.name || 'unnamed').replace(/\s+/g, '_');
            const node = new FlowAction(nodeId, snappedActionX, currentActionY, this.canvas, gridSize);

            node.Name = action.name || "Unbenannte Aktion";
            node.setText(node.Name);

            // Apply uniform width and height
            node.Width = maxActionWidth;
            node.Height = baseNodeHeight;

            node.data = { isOverviewLink: true, type: 'Action', canDelete: !isUsed, originalIndex: item.originalIndex };
            node.setDetailed(true);

            (node as any).setUsageInfo(refs);
            if (!isUsed) node.setUnused(true);
            if (isDuplicate) node.setDuplicate(true);

            this.nodes.push(node);
            this.setupNodeListeners(node);
            currentActionY += spacingY;
        });

        // 5. Render Tasks (sorted) with unified width
        const sortedTasks = [...this.project.tasks].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        sortedTasks.forEach((task, idx) => {
            const refs = projectRegistry.findReferences(task.name);
            const isUsed = refs.length > 0;

            const nodeId = 'over-task-' + idx + '-' + (task.name || 'unnamed').replace(/\s+/g, '_');
            const node = new FlowTask(nodeId, taskX, currentTaskY, this.canvas, gridSize);

            node.Name = task.name || "Unbenannter Task";
            node.setText(node.Name);

            // Apply uniform width and height
            node.Width = maxTaskWidth;
            node.Height = baseNodeHeight;

            // Check if this task uses a library task internally
            let usedLibraryTaskName: string | null = null;
            const flowData = (task as any)?.flowChart || (task as any)?.flowGraph ||
                this.project!.flowCharts?.[task.name];

            if (flowData?.elements) {
                for (const el of flowData.elements) {
                    const elTaskName = el.data?.taskName;
                    if (elTaskName && libraryService.getTask(elTaskName)) {
                        usedLibraryTaskName = elTaskName;
                        break;
                    }
                }
            }

            const isLibraryBased = !!usedLibraryTaskName;

            if (isLibraryBased) {
                node.setLinked(true);
                node.Details = `📚 ${usedLibraryTaskName}`;
            }

            node.data = { isOverviewLink: true, type: 'Task', canDelete: !isUsed, isLibraryBased, usedLibraryTaskName };
            node.setDetailed(true);

            (node as any).setUsageInfo(refs);
            if (!isUsed) node.setUnused(true);

            this.nodes.push(node);
            this.setupNodeListeners(node);
            currentTaskY += spacingY;
        });

        this.updateScrollArea();

        // Show Action-Check button in element-overview context
        if (this.actionCheckBtn) {
            this.actionCheckBtn.style.display = 'inline-block';
        }

        // Re-apply highlighting if Action-Check mode is still active
        if (this.actionCheckMode) {
            this.highlightUnusedActions(true);
        }
    }

    /**
     * Toggles Action-Check mode - highlights unused actions
     */
    private toggleActionCheckMode(): void {
        this.actionCheckMode = !this.actionCheckMode;

        if (this.actionCheckMode) {
            this.actionCheckBtn.style.background = '#ff5722';
            this.actionCheckBtn.innerText = '🔴 Check AUS';
            this.highlightUnusedActions(true);
        } else {
            this.actionCheckBtn.style.background = '#e65100';
            this.actionCheckBtn.innerText = '🔍 Action-Check';
            this.highlightUnusedActions(false);
        }
    }

    /**
     * Highlights or unhighlights unused action and task nodes
     */
    private highlightUnusedActions(highlight: boolean): void {
        let unusedActionCount = 0;
        let unusedTaskCount = 0;

        this.nodes.forEach(node => {
            const nodeType = node.getType();
            const isUnused = node.data?.canDelete === true;

            if ((nodeType === 'Action' || nodeType === 'Task') && isUnused) {
                const el = node.getElement();

                if (nodeType === 'Action') unusedActionCount++;
                if (nodeType === 'Task') unusedTaskCount++;

                if (highlight) {
                    // Apply strong highlight
                    el.style.outline = '4px solid #ff5722';
                    el.style.boxShadow = '0 0 20px rgba(255, 87, 34, 0.8)';
                    el.style.animation = 'pulse-unused 1s infinite alternate';

                    // Add animation keyframes if not already present
                    if (!document.getElementById('unused-action-styles')) {
                        const style = document.createElement('style');
                        style.id = 'unused-action-styles';
                        style.textContent = `
                            @keyframes pulse-unused {
                                from { box-shadow: 0 0 10px rgba(255, 87, 34, 0.6); }
                                to { box-shadow: 0 0 25px rgba(255, 87, 34, 1); }
                            }
                        `;
                        document.head.appendChild(style);
                    }
                } else {
                    // Remove highlight
                    el.style.outline = '';
                    el.style.boxShadow = '';
                    el.style.animation = '';
                }
            }
        });

        if (highlight) {
            console.log(`[FlowEditor] Action-Check: ${unusedActionCount} nicht verwendete Actions, ${unusedTaskCount} nicht verwendete Tasks gefunden.`);
        }
    }

    /**
     * Updates the internal 'world' size to ensure the canvas is scrollable
     */
    private updateScrollArea(): void {
        const world = document.getElementById('flow-world');
        if (!world) return;

        let maxX = 2000;
        let maxY = 2000;

        this.nodes.forEach(n => {
            const bounds = { x: (n as any).x + 400, y: (n as any).y + 400 };
            if (bounds.x > maxX) maxX = bounds.x;
            if (bounds.y > maxY) maxY = bounds.y;
        });

        world.style.width = maxX + 'px';
        world.style.height = maxY + 'px';
    }
}
