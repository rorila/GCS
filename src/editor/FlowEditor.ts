import { GameProject, StageDefinition } from '../model/types';

import { FlowElement } from './flow/FlowElement';
import { FlowAction } from './flow/FlowAction';
import { FlowTask } from './flow/FlowTask'; import { FlowStart } from './flow/FlowStart';
import { FlowCondition } from './flow/FlowCondition';


import { FlowConnection } from './flow/FlowConnection';
import { FlowVariable } from './flow/FlowVariable';
import { FlowThresholdVariable } from './flow/FlowThresholdVariable';
import { FlowTriggerVariable } from './flow/FlowTriggerVariable';
import { FlowTimerVariable } from './flow/FlowTimerVariable';
import { FlowRangeVariable } from './flow/FlowRangeVariable';
import { FlowListVariable } from './flow/FlowListVariable';
import { FlowRandomVariable } from './flow/FlowRandomVariable';
import { FlowLoop } from './flow/FlowLoop';
import { FlowStateManager } from './flow/FlowStateManager';
import { TFlowStage } from '../components/TFlowStage';
import { serviceRegistry } from '../services/ServiceRegistry';
import { mediatorService } from '../services/MediatorService';
import { TaskEditor } from './TaskEditor';
import { ContextMenu } from './ui/ContextMenu';
import { RefactoringManager } from './RefactoringManager';
import { projectRegistry } from '../services/ProjectRegistry';
import { libraryService } from '../services/LibraryService';
import { FlowSyncManager } from './services/FlowSyncManager';
import { FlowMapManager, FlowMapHost } from './services/FlowMapManager';
import { FlowContextMenuProvider, FlowContextMenuHost } from './services/FlowContextMenuProvider';


export class FlowEditor implements FlowMapHost {
    private container: HTMLElement;
    public project: GameProject | null = null;
    public flowStage: TFlowStage; // Initialized in constructor or setProject

    // State Manager - Single Source of Truth für Flow-State
    private stateManager: FlowStateManager;

    // Sync Manager - Kapselt Synchronisations-Logik
    private syncManager: FlowSyncManager;

    // Map Manager - Kapselt Landkarte/Übersicht
    private mapManager: FlowMapManager;
    private menuProvider: FlowContextMenuProvider;
    public actionCheckMode: boolean = false;
    public filterText: string = "";

    private flowSelect!: HTMLSelectElement;
    public contextMenu: ContextMenu;

    public canvas: HTMLElement;

    public onObjectSelect?: (obj: FlowElement | null) => void;
    public onNodesChanged?: (nodes: FlowElement[]) => void;
    public onProjectChange?: () => void; // Callback to trigger auto-save in Editor

    // Interaction State
    private isDraggingHandle: boolean = false;
    private activeHandle: HTMLElement | null = null;
    private activeConnection: FlowConnection | null = null;

    // UI Elements
    private detailsToggleBtn!: HTMLButtonElement;
    public actionCheckBtn!: HTMLButtonElement;
    private filterInput!: HTMLInputElement;
    private backButton!: HTMLButtonElement; // Zurück-Button
    public currentSelectedStageObjectId: string | null = null;
    private suggestedTaskName: string | null = null; // Für automatische Namensübernahme bei Drop

    // Navigation History
    private contextHistory: string[] = [];

    // Scroll positions per context (key = context name, value = {scrollX, scrollY})
    private scrollPositions: Map<string, { x: number; y: number }> = new Map();


    // ─────────────────────────────────────────────
    // State Accessors (delegate to StateManager)
    // ─────────────────────────────────────────────
    public get nodes(): FlowElement[] {
        return this.stateManager.getNodesInternal();
    }
    public set nodes(value: FlowElement[]) {
        this.stateManager.setNodes(value);
    }
    public get connections(): FlowConnection[] {
        return this.stateManager.getConnectionsInternal();
    }
    public set connections(value: FlowConnection[]) {
        this.stateManager.setConnections(value);
    }
    private get selectedConnection(): FlowConnection | null {
        return this.stateManager.getSelectedConnection();
    }
    private set selectedConnection(value: FlowConnection | null) {
        this.stateManager.selectConnection(value);
    }
    public get currentFlowContext(): string {
        return this.stateManager.getContext();
    }
    public set currentFlowContext(value: string) {
        this.stateManager.setContext(value);
    }
    public get showDetails(): boolean {
        return this.stateManager.getShowDetails();
    }
    public set showDetails(value: boolean) {
        this.stateManager.setShowDetails(value);
    }
    private get selectedNode(): FlowElement | null {
        return this.stateManager.getSelectedNode();
    }

    public get cellSize(): number {
        return this.flowStage ? this.flowStage.cellSize : 20;
    }

    public syncAllTasksFromFlow(_project: GameProject): void {
        this.syncManager.syncAllTasksFromFlow();
    }

    private set selectedNode(value: FlowElement | null) {
        if (value) {
            this.stateManager.selectNode(value);
        } else {
            this.stateManager.selectNode(null);
        }
    }

    public getActiveStage(): StageDefinition | null {
        if (!this.project || !this.project.stages) return null;
        return this.project.stages.find(s => s.id === this.project!.activeStageId) || this.project.stages[0] || null;
    }

    private getTaskDefinitionByName(taskName: string): any | null {
        if (!this.project) return null;

        // 1. Try current stage tasks - PRIORITY for local context!
        const activeStage = this.getActiveStage();
        if (activeStage && activeStage.tasks) {
            const task = activeStage.tasks.find(t => t.name === taskName);
            if (task) return task;
        }

        // 2. Try global tasks
        let task = this.project.tasks.find(t => t.name === taskName);
        if (task) return task;

        // 3. Search all other stages as fallback
        if (this.project.stages) {
            for (const s of this.project.stages) {
                if (s.tasks) {
                    task = s.tasks.find(t => t.name === taskName);
                    if (task) return task;
                }
            }
        }

        return null;
    }

    // --- Helpers for MapManager (Host Implementation) ---

    public getCurrentObjects(): any[] {
        if (!this.project) return [];
        const activeStage = this.getActiveStage();
        if (activeStage) return activeStage.objects || [];
        return this.project.objects || [];
    }

    public getAllVariables(): any[] {
        if (!this.project) return [];
        const activeStage = this.getActiveStage();
        const globalVars = this.project.variables || [];
        const stageVars = activeStage?.variables || [];
        return [...globalVars, ...stageVars];
    }




    private editor: any; // Reference to main Editor for routing logic

    constructor(containerId: string, editor?: any) {
        this.editor = editor;
        const el = document.getElementById(containerId);
        if (!el) throw new Error(`Container ${containerId} not found`);
        this.container = el;

        // Initialize State Manager FIRST
        this.stateManager = new FlowStateManager();
        this.stateManager.loadShowDetailsFromStorage();

        // Initialize Sync Manager
        this.syncManager = new FlowSyncManager(this);

        // Initialize Map Manager
        this.mapManager = new FlowMapManager(this);

        // Initialize Context Menu Provider
        this.menuProvider = new FlowContextMenuProvider(this as any as FlowContextMenuHost);

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

        // Separator
        const sep2 = document.createElement('div');
        sep2.style.cssText = 'width:1px;height:24px;background:#555;margin:0 10px';
        toolbar.appendChild(sep2);

        // Action Check Button
        this.actionCheckBtn = document.createElement('button');
        this.actionCheckBtn.innerText = '🔍 Action-Check';
        this.actionCheckBtn.title = 'Ungenutzte Elemente hervorheben';
        this.actionCheckBtn.style.cssText = 'padding:5px 10px;background:#e65100;color:white;border:none;border-radius:4px;cursor:pointer;margin-right:10px;display:none';
        this.actionCheckBtn.onclick = () => this.mapManager.toggleActionCheckMode();
        toolbar.appendChild(this.actionCheckBtn);

        // Filter Input
        this.filterInput = document.createElement('input');
        this.filterInput.type = 'text';
        this.filterInput.placeholder = 'Filter...';
        this.filterInput.style.cssText = 'padding:5px;background:#333;color:white;border:1px solid #555;border-radius:4px;margin-right:10px;width:120px;display:none';
        this.filterInput.oninput = (e) => {
            this.filterText = (e.target as HTMLInputElement).value.toLowerCase();
            this.loadFromProject(); // Refresh view with filter
        };
        toolbar.appendChild(this.filterInput);

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
        this.canvas.oncontextmenu = (e) => this.handleCanvasContextMenu(e);

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

    /**
     * Delegiert die Bereinigung korrupter Task-Daten an den SyncManager
     */
    public cleanCorruptTaskData() {
        if (this.syncManager) {
            this.syncManager.cleanCorruptTaskData();
        }
    }

    public setProject(project: GameProject) {
        this.project = project;
        if (!this.project.actions) this.project.actions = [];
        if (!this.project.tasks) this.project.tasks = [];

        // Bereinigung korrupter Daten beim Laden
        this.cleanCorruptTaskData();

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
        const isStaticContext = savedContext === 'global';

        if (savedContext && (isStaticContext || isValidTask)) {
            this.currentFlowContext = savedContext;
        } else {
            this.currentFlowContext = 'global';
        }
        this.updateFlowSelector();

        // Load graph data
        this.loadFromProject();

        this.updateGrid();

        this.rebuildActionRegistry();
    }

    public syncActionsFromProject(): void {
        this.syncManager.syncActionsFromProject();
    }

    private createNewTaskFlow() {
        if (!this.project) return;

        // 1. Generate unique Name (No more prompt!)
        const name = this.generateUniqueTaskName("ANewTask");

        // 2. Create Task (Standardmäßig in die aktive Stage via Editor)
        const targetCollection = this.editor ? this.editor.getTargetTaskCollection(name) : (this.project.tasks || (this.project.tasks = []));
        targetCollection.push({
            name: name,
            actionSequence: []
        });

        // 3. Initialize flowChart for this task
        const targetCharts = this.getTargetFlowCharts(name);
        targetCharts[name] = { elements: [], connections: [] };

        // 4. Update UI
        this.updateFlowSelector();

        // Notify Mediator that project data has changed
        if (this.project) {
            mediatorService.notifyDataChanged(this.project, 'flow-editor');
        }

        // 5. Switch to new Task (Canvas wird geleert)
        this.switchActionFlow(name);

        // 6. Automatically insert a task node representing itself
        // (x=400, y=200 matches the layout start of generateFlowFromActionSequence)
        // Use a small timeout to ensure the canvas is fully ready after the switch
        setTimeout(() => {
            this.createNode('Task', 400, 200, name);
        }, 100);
    }

    /**
     * Ermittelt die passende FlowCharts-Collection (Global vs Stage)
     */
    public getTargetFlowCharts(taskName?: string): any {
        if (!this.project) return {};
        const activeStage = this.getActiveStage();
        if (!activeStage) return this.project.flowCharts || (this.project.flowCharts = {});

        // Wenn der Chart bereits in der Stage existiert
        if (activeStage.flowCharts && activeStage.flowCharts[taskName || '']) {
            return activeStage.flowCharts;
        }

        // Wenn er global existiert
        if (this.project.flowCharts && this.project.flowCharts[taskName || '']) {
            return this.project.flowCharts;
        }

        // Neue Charts in der aktiven Stage anlegen
        if (!activeStage.flowCharts) activeStage.flowCharts = {};
        return activeStage.flowCharts;
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

    public updateFlowSelector() {
        if (!this.project) return;
        this.flowSelect.innerHTML = '';
        const activeStage = this.getActiveStage();

        // --- Overviews ---
        const optOverviewGroup = document.createElement('optgroup');
        optOverviewGroup.label = '🗺️ OVERVIEWS';

        const mapOpt = document.createElement('option');
        mapOpt.value = 'event-map';
        mapOpt.innerText = '🗺️ Landkarte (Events/Links)';
        mapOpt.selected = this.currentFlowContext === 'event-map';
        optOverviewGroup.appendChild(mapOpt);

        const overOpt = document.createElement('option');
        overOpt.value = 'element-overview';
        overOpt.innerText = '📊 Elementenübersicht';
        overOpt.selected = this.currentFlowContext === 'element-overview';
        optOverviewGroup.appendChild(overOpt);

        this.flowSelect.appendChild(optOverviewGroup);

        // --- Current Stage Section ---
        if (activeStage) {
            const stageGroup = document.createElement('optgroup');
            stageGroup.label = `Stage: ${activeStage.name}`;

            const globalOpt = document.createElement('option');
            globalOpt.value = 'global';
            globalOpt.text = 'Main Flow (Stage)';
            stageGroup.appendChild(globalOpt);

            // Tasks in this stage
            const stageTasksFound = new Set<string>();

            // 1. Tasks that have a flowchart
            if (activeStage.flowCharts) {
                Object.keys(activeStage.flowCharts).forEach(key => {
                    if (key !== 'global') {
                        const opt = document.createElement('option');
                        opt.value = key;
                        opt.text = `Task: ${key}`;
                        stageGroup.appendChild(opt);
                        stageTasksFound.add(key);
                    }
                });
            }

            // 2. Tasks defined in the stage but might not have a flowchart yet
            if (activeStage.tasks) {
                activeStage.tasks.forEach(task => {
                    if (!stageTasksFound.has(task.name)) {
                        const opt = document.createElement('option');
                        opt.value = task.name;
                        opt.text = `Task: ${task.name}`;
                        stageGroup.appendChild(opt);
                        stageTasksFound.add(task.name);
                    }
                });
            }

            this.flowSelect.appendChild(stageGroup);
        }

        // --- Global Section ---
        // Nur anzeigen, wenn wir in der Haupt-Stage sind oder keine Stage definiert ist (Legacy).
        // Dies sorgt für die gewünschte Isolation in Splash- oder Standard-Stages.
        if (!activeStage || activeStage.type === 'main') {
            const globalGroup = document.createElement('optgroup');
            globalGroup.label = 'Global / Projekt';

            const globalTasksFound = new Set<string>();
            const stageTaskKeys = activeStage?.flowCharts ? Object.keys(activeStage.flowCharts) : [];

            // 1. Global tasks with flowchart
            if (this.project.flowCharts) {
                Object.keys(this.project.flowCharts).forEach(key => {
                    // Nur anzeigen, wenn nicht im global-Key (Landkarte/Übersicht) 
                    // UND wenn nicht bereits in der Stage definiert
                    if (key !== 'global' && !stageTaskKeys.includes(key)) {
                        const opt = document.createElement('option');
                        opt.value = key;
                        opt.text = `Task: ${key}`;
                        globalGroup.appendChild(opt);
                        globalTasksFound.add(key);
                    }
                });
            }

            // 2. Global tasks without flowchart
            if (this.project.tasks) {
                this.project.tasks.forEach(task => {
                    if (!globalTasksFound.has(task.name) && !stageTaskKeys.includes(task.name)) {
                        const opt = document.createElement('option');
                        opt.value = task.name;
                        opt.text = `Task: ${task.name}`;
                        globalGroup.appendChild(opt);
                        globalTasksFound.add(task.name);
                    }
                });
            }

            // Nur hinzufügen, wenn die Gruppe nicht leer ist
            if (globalGroup.children.length > 0) {
                this.flowSelect.appendChild(globalGroup);
            }
        }

        // Set value
        this.flowSelect.value = this.currentFlowContext;
    }

    public switchActionFlow(context: string, addToHistory: boolean = true) {
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

        // cleanup

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
        // 1. Clear project.actions if we want to rebuild from scratch (optional, but keep for now)
        this.project.actions = this.project.actions || [];

        const register = (elements: any[]) => {
            elements.forEach(el => {
                if (el.type === 'Action') {
                    // Normalize name and details
                    const name = el.properties?.name || el.data?.name || el.data?.actionName || el.properties?.text;
                    const details = el.properties?.details || el.data?.details;

                    const isMeaningful = el.data?.type || el.data?.actionName || el.data?.taskName || (el.properties?.details && el.properties.details.trim() !== '');
                    if (name && (name !== 'Action' && name !== 'Aktion' || isMeaningful)) {
                        this.syncManager.updateGlobalActionDefinition({ ...el.data, name, details });
                    }
                }
            });
        };

        // 1. Scan Global Flow (legacy 'flow' or new 'flowCharts.global')
        const globalFlowElements = this.project.flowCharts?.global?.elements || this.project.flow?.elements;
        if (globalFlowElements) {
            register(globalFlowElements);
        }

        // 2. Scan Task Flows from global flowCharts
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

        // 3. Scan Stage-local flows
        if (this.project.stages) {
            this.project.stages.forEach(stage => {
                if (stage.flowCharts) {
                    Object.keys(stage.flowCharts).forEach(key => {
                        const flowChart = stage.flowCharts![key];
                        if (flowChart?.elements) {
                            register(flowChart.elements);
                        }
                    });
                }
            });
        }

        const totalActions = (this.project.actions?.length || 0) +
            (this.project.stages?.reduce((acc, s) => acc + (s.actions?.length || 0), 0) || 0);

        console.log(`[FlowEditor] Registry rebuilt. Total actions found: ${totalActions}`);
    }

    // parseDetailsToCommand, updateGlobalActionDefinition, ensureTaskExists ... sind nun im SyncManager delegiert oder redundant.

    /**
     * Generates a unique action name with a running number (Action1, Action2, etc.)
     * Checks both project actions and current flow nodes for uniqueness.
     */
    public generateUniqueActionName(baseName: string = 'Action'): string {
        let counter = 1;
        let finalName = `${baseName}${counter}`;

        // Collect all existing action names from project and current nodes
        const existingNames = new Set<string>();

        // From project actions
        if (this.project?.actions) {
            this.project.actions.forEach(a => existingNames.add(a.name));
        }

        // From all stages
        if (this.project?.stages) {
            this.project.stages.forEach(s => {
                if (s.actions) s.actions.forEach(a => existingNames.add(a.name));
            });
        }

        // From current flow nodes (including unnamed ones that might not be synced yet)
        this.nodes.forEach(n => {
            if (n.getType() === 'Action') {
                existingNames.add(n.Name || n.name);
            }
        });

        // Loop until we find a free number
        while (existingNames.has(finalName)) {
            counter++;
            finalName = `${baseName}${counter}`;
        }

        return finalName;
    }

    public generateUniqueVariableName(baseName: string = 'neueVariabel'): string {
        let counter = 1;
        let finalName = baseName;
        const existingNames = new Set<string>();

        if (this.project?.variables) {
            this.project.variables.forEach(v => existingNames.add(v.name));
        }
        if (this.project?.stages) {
            this.project.stages.forEach(s => {
                if (s.variables) s.variables.forEach(v => existingNames.add(v.name));
            });
        }
        this.nodes.forEach(n => {
            if (n.getType() === 'VariableDecl') {
                const name = n.data?.variable?.name;
                if (name) existingNames.add(name);
            }
        });

        if (existingNames.has(finalName)) {
            while (existingNames.has(`${baseName}${counter}`)) {
                counter++;
            }
            finalName = `${baseName}${counter}`;
        }
        return finalName;
    }

    public generateUniqueTaskName(baseName: string = 'Task'): string {
        let counter = 1;
        let finalName = baseName;
        const existingNames = new Set<string>();

        if (this.project?.tasks) {
            this.project.tasks.forEach(t => existingNames.add(t.name));
        }
        if (this.project?.stages) {
            this.project.stages.forEach(s => {
                if (s.tasks) s.tasks.forEach(t => existingNames.add(t.name));
            });
        }
        this.nodes.forEach(n => {
            if (n.getType() === 'Task') {
                existingNames.add(n.Name || n.name);
            }
        });

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
    public ensureTaskExists(taskName: string, description?: string) {
        if (!this.project) return;

        // Ensure tasks array exists
        if (!this.project.tasks) this.project.tasks = [];

        // Check if task already exists (globally or in stages)
        // Check if task already exists (globally or in stages)
        const existingTask = this.getTaskDefinitionByName(taskName);
        if (existingTask) {
            console.log(`[FlowEditor] Task "${taskName}" already exists. Updating metadata only.`);
            // Update description if provided and not already set
            if (description && !existingTask.description) {
                existingTask.description = description;
            }
            // Backfill defaults if missing
            if (!existingTask.triggerMode) {
                existingTask.triggerMode = 'local-sync';
            }
            if (!existingTask.params) {
                existingTask.params = [];
            }
            if (existingTask.description === undefined) {
                existingTask.description = '';
            }
            return;
        }

        // Create new task ONLY if it doesn't exist anywhere
        console.log(`[FlowEditor] Creating NEW task: ${taskName} (not found in project)`);

        const newTask = {
            name: taskName,
            description: description || '',
            actionSequence: [],
            triggerMode: 'local-sync' as 'local-sync' | 'local' | 'broadcast',
            params: []
        };

        const activeStage = this.getActiveStage();
        // If we have an active stage (and it's not the main wrapper), save task there to keep it local/clean
        if (activeStage && activeStage.type !== 'main') {
            if (!activeStage.tasks) activeStage.tasks = [];
            activeStage.tasks.push(newTask);
            console.log(`[FlowEditor] Saved new task "${taskName}" to stage "${activeStage.name}"`);
        } else {
            // Fallback to global project tasks
            this.project.tasks.push(newTask);
            console.log(`[FlowEditor] Saved new task "${taskName}" to global project tasks`);
        }
    }

    public syncToProject() {
        this.syncManager.syncToProject(this.currentFlowContext);
    }

    // syncTaskParameters, syncTaskParamValues, syncVariablesFromFlow, syncTaskFromFlow sind nun im SyncManager.

    private loadFromProject() {
        if (!this.project) return;

        this.clearFlowCanvas();

        // Hide special buttons by default
        if (this.actionCheckBtn) this.actionCheckBtn.style.display = 'none';
        if (this.filterInput) this.filterInput.style.display = 'none';

        if (this.currentFlowContext === 'event-map') {
            if (this.filterInput) this.filterInput.style.display = 'inline-block';
            this.mapManager.generateEventMap();
            return;
        }

        if (this.currentFlowContext === 'element-overview') {
            if (this.actionCheckBtn) this.actionCheckBtn.style.display = 'inline-block';
            if (this.filterInput) this.filterInput.style.display = 'inline-block';
            this.mapManager.generateElementOverview();
            return;
        }

        let sourceData: { elements: any[], connections: any[] } | undefined;

        const activeStage = this.getActiveStage();

        if (this.currentFlowContext === 'global') {
            // Priority: Active Stage Flow -> Project Global Flow -> Legacy Flow
            const stageFlowIdx = activeStage?.flowCharts?.global;
            const projectFlowIdx = (this.project.flowCharts?.global) || (this.project as any).flow;
            sourceData = stageFlowIdx || projectFlowIdx;
            if (sourceData) console.log(`[FlowEditor] SUCCESS: Loaded GLOBAL flow from ${stageFlowIdx ? 'STAGE' : 'PROJECT'}.`);
        } else {
            // Priority: Active Stage Chart -> Global Project Chart -> Task Internal Chart
            const stageFlowChart = activeStage?.flowCharts?.[this.currentFlowContext];
            const globalFlowChart = this.project.flowCharts?.[this.currentFlowContext];

            // 3. Fallback: Search in ANY stage (important if activeStage is not the owner of the task)
            let fallbackStageChart = null;
            if (!stageFlowChart && !globalFlowChart && this.project.stages) {
                for (const s of this.project.stages) {
                    if (s.flowCharts?.[this.currentFlowContext]) {
                        fallbackStageChart = s.flowCharts[this.currentFlowContext];
                        console.log(`[FlowEditor] Found flowChart for "${this.currentFlowContext}" in stage "${s.name}" (fallback)`);
                        break;
                    }
                }
            }

            if (stageFlowChart) {
                sourceData = stageFlowChart;
                console.log(`[FlowEditor] SUCCESS: Loaded from ACTIVE STAGE "${activeStage?.name}" charts.`);
            } else if (globalFlowChart) {
                sourceData = globalFlowChart;
                console.log(`[FlowEditor] SUCCESS: Loaded from GLOBAL project charts.`);
            } else if (fallbackStageChart) {
                sourceData = fallbackStageChart;
                console.log(`[FlowEditor] SUCCESS: Loaded from FALLBACK STAGE charts.`);
            } else {
                // EXHAUSTIVE DIAGNOSTIC LOGGING
                console.warn(`[FlowEditor] FAILURE: No visual flow data found for context "${this.currentFlowContext}".`);
                const globalKeys = Object.keys(this.project.flowCharts || {});
                console.log(`[FlowEditor] DIAG: Available GLOBAL charts: [${globalKeys.join(', ')}]`);

                if (this.project.stages) {
                    this.project.stages.forEach(s => {
                        const stageKeys = Object.keys(s.flowCharts || {});
                        console.log(`[FlowEditor] DIAG: Stage "${s.name}" charts: [${stageKeys.join(', ')}]`);
                    });
                }

                // Check if task exists (in global or stage)
                let task = this.getTaskDefinitionByName(this.currentFlowContext);

                console.log(`[FlowEditor] DIAG: Task record for "${this.currentFlowContext}" exists: ${!!task}. Internal .flowChart: ${!!task?.flowChart}`);

                if (task?.flowChart) {
                    sourceData = task.flowChart;
                    console.log(`[FlowEditor] SUCCESS (LEGACY): Loading from task.flowChart object.`);
                } else if (task?.flowGraph) {
                    // Fallback: check for legacy flowGraph in task
                    sourceData = task.flowGraph;
                    console.log(`[FlowEditor] SUCCESS (LEGACY): Loading from legacy task.flowGraph.`);
                    // Migrate to new structure (using helper for correct collection)
                    const targetCharts = this.getTargetFlowCharts(this.currentFlowContext);
                    targetCharts[this.currentFlowContext] = task.flowGraph;
                    delete (task as any).flowGraph;
                } else if (task) {
                    // AUTO-RECONSTRUCT: If task has an actionSequence but no flowChart, generate one
                    console.log(`[FlowEditor] Task "${this.currentFlowContext}" exists but has no visual flow data. Reconstruction needed.`);
                    sourceData = this.syncManager.generateFlowFromActionSequence(task);
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
                        }
                    }, 100);
                }
            }
        }

        if (!sourceData) return;

        // Restore Elements
        if (sourceData.elements) {
            sourceData.elements.forEach((data: any) => {
                const node = this.syncManager.restoreNode(data);
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

    // restoreNode wurde in den FlowSyncManager verschoben.

    /**
     * Re-expands a Proxy node to show its internal ghost nodes
     */
    public refreshEmbeddedTask(proxyNode: FlowElement) {
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

    // generateFlowFromActionSequence wurde in den FlowSyncManager verschoben.

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

    public deselectAll(emitEvent: boolean = true) {
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
        const baseType = type.includes(':') ? type.split(':')[0] : type;
        switch (baseType) {
            case 'Action':
                node = new FlowAction(id, x, y, this.canvas, this.flowStage.cellSize);
                // Generate unique name if not provided or if it's a generic default name
                if (initialName && initialName !== 'Action' && initialName !== 'Aktion') {
                    node.Name = initialName;
                } else {
                    node.Name = this.generateUniqueActionName(initialName || 'Action');
                }
                // Apply current detail mode
                if (this.showDetails) {
                    (node as FlowAction).setShowDetails(true, this.project);
                }
                break;
            case 'Condition':
                node = new FlowCondition(id, x, y, this.canvas, this.flowStage.cellSize);
                node.Name = initialName || 'Bedingung';
                break;
            case 'Task':
                let taskName = initialName;
                if (!taskName) {
                    taskName = prompt("Name für den neuen Task:", this.generateUniqueTaskName("ANewTask")) || undefined;
                }
                if (!taskName) {
                    console.log("[FlowEditor] Task creation cancelled by user.");
                    return null;
                }

                // Only enforce uniqueness if we are creating a fresh task (no initialName provided)
                // If initialName WAS provided, it means we are referencing an existing task!
                if (!initialName) {
                    taskName = this.generateUniqueTaskName(taskName);
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
            case 'VariableDecl':
                // Check for kind in type string (e.g. "VariableDecl:threshold")
                const kind = type.split(':')[1];
                if (kind === 'threshold') {
                    node = new FlowThresholdVariable(id, x, y, this.canvas, this.flowStage.cellSize);
                } else if (kind === 'trigger') {
                    node = new FlowTriggerVariable(id, x, y, this.canvas, this.flowStage.cellSize);
                } else if (kind === 'timer') {
                    node = new FlowTimerVariable(id, x, y, this.canvas, this.flowStage.cellSize);
                } else if (kind === 'range') {
                    node = new FlowRangeVariable(id, x, y, this.canvas, this.flowStage.cellSize);
                } else if (kind === 'list') {
                    node = new FlowListVariable(id, x, y, this.canvas, this.flowStage.cellSize);
                } else if (kind === 'random') {
                    node = new FlowRandomVariable(id, x, y, this.canvas, this.flowStage.cellSize);
                } else {
                    node = new FlowVariable(id, x, y, this.canvas, this.flowStage.cellSize);
                }

                const scope = this.currentFlowContext === 'global' ? 'global' : this.currentFlowContext;
                const varName = this.generateUniqueVariableName('neueVariabel');
                node.data = { variable: { name: varName, type: kind || 'integer', initialValue: 0, scope } };

                // Set default values based on kind
                if (kind === 'threshold') node.data.variable.threshold = 0;
                if (kind === 'trigger') node.data.variable.triggerValue = '';
                if (kind === 'timer') node.data.variable.duration = 5000;
                if (kind === 'range') { node.data.variable.min = 0; node.data.variable.max = 100; }
                if (kind === 'list') { node.data.variable.type = 'list'; node.data.variable.initialValue = '[]'; }
                if (kind === 'random') { node.data.variable.min = 0; node.data.variable.max = 100; node.data.variable.isRandom = true; }

                (node as FlowVariable).updateVisuals?.();

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
        this.selectNode(node); // Auto-select new node
        this.syncToProject();   // Ensure new node is persisted
        return node;
    }

    public deleteConnection(conn: FlowConnection) {
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

    public deleteNode(node: FlowElement) {
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
            let deletedGlobal = false;
            if (index !== undefined && index >= 0 && index < this.project.actions.length) {
                this.project.actions.splice(index, 1);
                console.log(`[FlowEditor] Deleted Action instance at index ${index}: ${name}`);
                deletedGlobal = true;
            } else {
                const initialLen = this.project.actions.length;
                this.project.actions = this.project.actions.filter(a => a.name !== name);
                if (this.project.actions.length < initialLen) {
                    console.log(`[FlowEditor] Deleted all Global Action instances with name: ${name}`);
                    deletedGlobal = true;
                }
            }

            // 1b. Delete from matching Stage lists (Robust multi-scope cleanup)
            let deletedStage = false;
            if (this.project.stages) {
                this.project.stages.forEach(stage => {
                    if (stage.actions) {
                        const sLen = stage.actions.length;
                        stage.actions = stage.actions.filter(a => a.name !== name);
                        if (stage.actions.length < sLen) {
                            console.log(`[FlowEditor] Deleted Action "${name}" from Stage "${stage.name || stage.id}"`);
                            deletedStage = true;
                        }
                    }
                });
            }

            console.log(`[FlowEditor] Deletion Verification for "${name}": Global=${deletedGlobal}, Stage=${deletedStage}`);

            // 2. Project-wide reference cleanup (Flowcharts, Sequences)
            // If we deleted it from everywhere, we should definitely clean up references
            if (deletedGlobal || deletedStage) {
                RefactoringManager.deleteAction(this.project, name);
            }
        } else if (type === 'Task') {
            RefactoringManager.deleteTask(this.project, name);
            console.log(`[FlowEditor] Deleted Task project-wide: ${name}`);
        }
    }

    private handleDrop(e: DragEvent) {
        e.preventDefault();
        const rawData = e.dataTransfer?.getData('application/flow-item');
        if (!rawData) return;

        let type = rawData;
        let data: any = null;

        // Try parsing JSON payload for advanced drops (e.g. specific task reference)
        if (rawData.startsWith('{')) {
            try {
                data = JSON.parse(rawData);
                type = data.type;
            } catch (err) {
                console.warn('[FlowEditor] Failed to parse drop data as JSON, using raw string.', err);
            }
        }

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        let finalX = x;
        let finalY = y;

        if (this.flowStage.snapToGrid) {
            const snapped = this.flowStage.snapToGridPosition(x, y);
            finalX = snapped.x;
            finalY = snapped.y;
        }

        // Logic for Task Drops: New vs. Reference
        if (type === 'Task') {
            if (data?.name) {
                console.log(`[FlowEditor] Dropping EXISTING task reference: ${data.name}`);
                // Pass existing name to createNode - this should link it, not create new
                this.createNode(type, finalX, finalY, data.name);
            } else {
                // Generic drop - create NEW task
                const initialName = this.suggestedTaskName || 'Task';
                this.createNode(type, finalX, finalY, initialName);
            }
        } else {
            // Other types (Action, etc.)
            const initialName = (this.suggestedTaskName || type);
            this.createNode(type, finalX, finalY, initialName);
        }

        this.suggestedTaskName = null; // Reset
    }

    public setupNodeListeners(node: FlowElement) {
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

        // Update connections when node moves/resizes
        node.onMove = () => {
            this.connections.forEach(c => {
                if (c.startTarget === node || c.endTarget === node) {
                    c.updatePosition();
                }
            });
        };
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
                const x = e.clientX - rect.left + this.canvas.scrollLeft;
                const y = e.clientY - rect.top + this.canvas.scrollTop;

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

    public importTaskGraph(targetNode: FlowElement, task: any, isLinked: boolean = false): FlowElement[] {
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
            const newNode = this.syncManager.restoreNode(newData);
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
                                originalStartAnchorType: origStartAnchor // Mark for future sync matches
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
        this.menuProvider.handleNodeContextMenu(e, node);
    }

    private handleCanvasContextMenu(e: MouseEvent) {
        this.menuProvider.handleCanvasContextMenu(e);
    }

    private handleConnectionContextMenu(e: MouseEvent, conn: FlowConnection) {
        this.menuProvider.handleConnectionContextMenu(e, conn);
    }


    private handleNodeDoubleClick(node: FlowElement) {
        // DEBUG: Log every double-click
        console.log(`[FlowEditor] === DOUBLE-CLICK on node: ${node.name} ===`);

        const isTask = node instanceof FlowTask;
        const taskName = isTask ? (node.data?.taskName || node.Name) : null;

        // 1. Feature: Map Navigation
        if (this.currentFlowContext === 'event-map' && node.data?.isMapLink && taskName) {
            console.log(`[FlowEditor] Event-Map: Switching to task flow: ${taskName}`);
            this.switchActionFlow(taskName);
            return;
        }

        // 2. Standard Behavior: Open Task Editor for tasks
        if (isTask) {
            console.log(`[FlowEditor] Opening TaskEditor for: ${taskName}`);
            this.openTaskEditor(node);
            return;
        }

        // 3. Fallback: Toggle details for ALL other node types (Start, Action, etc.)
        const newShowState = !node.IsDetailed;
        node.setShowDetails(newShowState, this.project);

        this.syncToProject();

        // 4. Extra: Open Action Editor for actual (non-embedded) action nodes
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

        // Add task context so the dialog can resolve local variables and show task parameters
        if (this.currentFlowContext && this.currentFlowContext !== 'event-map' && this.currentFlowContext !== 'element-overview') {
            const task = this.project.tasks.find(t => t.name === this.currentFlowContext);
            dialogData.taskName = this.currentFlowContext;
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
                    this.syncManager.updateGlobalActionDefinition({ ...result.data, name: newName });

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

    public setupConnectionListeners(conn: FlowConnection) {
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
        const x = e.clientX - rect.left + this.canvas.scrollLeft;
        const y = e.clientY - rect.top + this.canvas.scrollTop;

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
        const x = e.clientX - rect.left + this.canvas.scrollLeft;
        const y = e.clientY - rect.top + this.canvas.scrollTop;

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
     * Updates the internal 'world' size to ensure the canvas is scrollable
     */
    public updateScrollArea(): void {
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
