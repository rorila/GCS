import { GameProject, StageDefinition } from '../model/types';
import { PascalCodeGenerator } from './PascalCodeGenerator';


import { FlowElement } from './flow/FlowElement';
import { FlowAction } from './flow/FlowAction';
import { FlowTask } from './flow/FlowTask';
import { FlowDataAction } from './flow/FlowDataAction';
import { FlowConnection } from './flow/FlowConnection';
import { FlowVariable } from './flow/FlowVariable';
import { FlowLoop } from './flow/FlowLoop';
import { FlowStateManager } from './flow/FlowStateManager';
import { TFlowStage } from '../components/TFlowStage';
import { ContextMenu } from './ui/ContextMenu';
import { mediatorService, MediatorEvents } from '../services/MediatorService';
import { Logger } from '../utils/Logger';
import { projectRegistry } from '../services/ProjectRegistry';
import { FlowSyncManager } from './services/FlowSyncManager';
import { FlowNamingService } from './services/FlowNamingService';
import { FlowMapManager, FlowMapHost } from './services/FlowMapManager';
import { FlowContextMenuProvider, FlowContextMenuHost } from './services/FlowContextMenuProvider';
import { FlowSelectionManager } from './services/FlowSelectionManager';
import { FlowGraphManager, FlowGraphHost } from './services/FlowGraphManager';
import { FlowInteractionManager, FlowInteractionHost } from './services/FlowInteractionManager';
import { FlowNavigationManager, FlowNavigationHost } from './services/FlowNavigationManager';
import { FlowGraphHydrator, FlowGraphHydrationHost } from './services/FlowGraphHydrator';
import { FlowUIController, FlowUIHost } from './services/FlowUIController';
import { FlowTaskManager, FlowTaskHost } from './services/FlowTaskManager';
import { FlowNodeFactory, FlowNodeHost } from './services/FlowNodeFactory';
import { Editor } from './Editor';


export class FlowEditor implements FlowMapHost, FlowGraphHost, FlowInteractionHost, FlowNavigationHost, FlowGraphHydrationHost, FlowUIHost, FlowTaskHost, FlowNodeHost {
    private static logger = Logger.get('FlowEditor', 'Flow_Synchronization');
    private container: HTMLElement;
    public project: GameProject | null = null;
    public editor: Editor | null = null;
    public flowStage: TFlowStage; // Initialized in constructor or setProject

    // State Manager - Single Source of Truth für Flow-State
    private stateManager: FlowStateManager;

    // Sync Manager - Kapselt Synchronisations-Logik
    public syncManager: FlowSyncManager;

    public mapManager: FlowMapManager;
    public menuProvider: FlowContextMenuProvider;
    public selectionManager: FlowSelectionManager;
    public graphManager: FlowGraphManager;
    public interactionManager: FlowInteractionManager;
    public uiController!: FlowUIController;
    public taskManager!: FlowTaskManager;
    public nodeFactory!: FlowNodeFactory;
    public actionCheckMode: boolean = false;
    public filterText: string = "";

    public flowSelect!: HTMLSelectElement;
    public contextMenu: ContextMenu;

    public canvas: HTMLElement;

    public onObjectSelect?: (obj: FlowElement | null) => void;
    public onNodesChanged?: (nodes: FlowElement[]) => void;
    public onProjectChange?: () => void; // Callback to trigger auto-save in Editor

    // Navigation and Hydration Managers
    public navigationManager!: FlowNavigationManager;
    public hydrationManager!: FlowGraphHydrator;

    // Interaction State
    public isDraggingHandle: boolean = false;
    public isLoading: boolean = false;
    /** Guard: Nur true wenn der User tatsächlich Flow-Elemente geändert hat */
    public isFlowDirty: boolean = false;
    public activeHandle: HTMLElement | null = null;
    public activeConnection: FlowConnection | null = null;

    // UI Elements
    public detailsToggleBtn!: HTMLButtonElement;
    public actionCheckBtn!: HTMLButtonElement;
    public filterInput!: HTMLInputElement;
    public backButton!: HTMLButtonElement; // Zurück-Button
    public currentSelectedStageObjectId: string | null = null;
    public suggestedTaskName: string | null = null; // Für automatische Namensübernahme bei Drop

    // Pascal-Panel
    private pascalPanel!: HTMLElement;
    private pascalToggleBtn!: HTMLButtonElement;
    private pascalVisible: boolean = false;


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
    public get selectedConnection(): FlowConnection | null {
        return this.stateManager.getSelectedConnection();
    }
    public set selectedConnection(value: FlowConnection | null) {
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
    public get selectedNode(): FlowElement | null {
        return this.stateManager.getSelectedNode();
    }
    public set selectedNode(v: FlowElement | null) {
        this.stateManager.selectNode(v);
    }

    public get cellSize(): number {
        return this.flowStage ? this.flowStage.cellSize : 20;
    }

    public syncAllTasksFromFlow(_project: GameProject): void {
        this.syncManager.syncAllTasksFromFlow();
    }

    public renameObjectWithRefactoring(id: string, newName: string, oldName?: string) {
        if (this.editor) {
            this.editor.renameObjectWithRefactoring(id, newName, oldName);
        }
    }

    /**
     * Updates the visual representation of a single node based on its internal `data`.
     * This prevents complete canvas re-renders and preserves selection state.
     */
    public syncNodeVisuals(nodeId: string): void {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) return;

        // 1. Sync standard properties from data
        if (node.data) {
            if (node.data.name !== undefined) node.Name = node.data.name;
            else if (node.data.taskName !== undefined) node.Name = node.data.taskName;
            else if (node.data.actionName !== undefined) node.Name = node.data.actionName;

            if (node.data.details !== undefined) node.Details = node.data.details;
            if (node.data.description !== undefined) node.Description = node.data.description;

            // For conditions and loops
            if (node.data.condition !== undefined) node.Name = node.data.condition;
            if (node.data.count !== undefined) node.Name = String(node.data.count);
        }

        // 2. Refresh extra visuals (Variables, Details string generation)
        if (node instanceof FlowVariable || node instanceof FlowLoop) {
            (node as any).updateVisuals?.();
        } else if (node instanceof FlowAction || node instanceof FlowDataAction || node instanceof FlowTask) {
            // Force recalculation of details text
            (node as any).setShowDetails?.(this.showDetails, this.project);
        }

        console.log(`[FlowEditor] Successfully synced visuals for node ${nodeId}`);
    }



    public getActiveStage(): StageDefinition | null {
        if (!this.project || !this.project.stages) return null;
        return this.project.stages.find(s => s.id === this.project!.activeStageId) || this.project.stages[0] || null;
    }

    public getTaskDefinitionByName(taskName: string): any | null {
        if (!this.project) return null;

        // 1. Try current stage tasks - PRIORITY for local context!
        const activeStage = this.getActiveStage();
        if (activeStage && activeStage.tasks) {
            const task = activeStage.tasks.find(t => t.name === taskName);
            if (task) return task;
        }

        // 2. Try Blueprint stage - SSoT for global elements
        if (this.project.stages) {
            const blueprint = this.project.stages.find(s => s.id === 'stage_blueprint' || s.type === 'blueprint');
            if (blueprint?.tasks) {
                const task = blueprint.tasks.find(t => t.name === taskName);
                if (task) return task;
            }
        }

        // 3. Try legacy global tasks (project root)
        let task = this.project.tasks?.find(t => t.name === taskName);
        if (task) return task;

        // 4. Search all other stages as fallback
        if (this.project.stages) {
            for (const s of this.project.stages) {
                // Skip active and blueprint as they are already checked
                if (s.id === activeStage?.id || s.id === 'stage_blueprint' || s.type === 'blueprint') continue;
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
        const blueprintStage = this.project.stages?.find(s => s.type === 'blueprint' || s.id === 'stage_blueprint' || s.id === 'blueprint');
        
        const globalVars = blueprintStage?.variables || this.project.variables || [];
        
        // Wenn current stage die blueprint stage ist, nicht verdoppeln
        if (activeStage && blueprintStage && activeStage.id === blueprintStage.id) {
            return [...globalVars];
        }
        
        const stageVars = activeStage?.variables || [];
        return [...globalVars, ...stageVars];
    }






    constructor(containerId: string, editor?: any) {
        this.editor = editor;
        const el = document.getElementById(containerId);
        if (!el) throw new Error(`Container ${containerId} not found`);
        this.container = el;

        // Initialize State Manager FIRST
        this.stateManager = new FlowStateManager();
        this.stateManager.loadShowDetailsFromStorage();

        const thisRef = this;
        this.selectionManager = new FlowSelectionManager({
            stateManager: this.stateManager,
            get project() { return thisRef.project; },
            get currentFlowContext() { return thisRef.currentFlowContext; },
            get editor() { return thisRef.editor; },
            get detailsToggleBtn() { return thisRef.detailsToggleBtn; },
            syncNodeVisuals: (id) => thisRef.syncNodeVisuals(id),
            get onObjectSelect() { return thisRef.onObjectSelect; }
        });

        // Initialize Sync Manager
        this.syncManager = new FlowSyncManager(this);

        // Initialize Map Manager
        this.mapManager = new FlowMapManager(this);

        // Initialize Context Menu Provider
        this.menuProvider = new FlowContextMenuProvider(this as any as FlowContextMenuHost);

        this.graphManager = new FlowGraphManager(this);
        this.interactionManager = new FlowInteractionManager(this);
        this.navigationManager = new FlowNavigationManager(this);
        this.hydrationManager = new FlowGraphHydrator(this);
        this.uiController = new FlowUIController(this);
        this.taskManager = new FlowTaskManager(this);
        this.nodeFactory = new FlowNodeFactory(this);

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

        // Separator vor Pascal-Button
        const sep3 = document.createElement('div');
        sep3.style.cssText = 'width:1px;height:24px;background:#555;margin:0 10px';
        toolbar.appendChild(sep3);

        // Pascal-Toggle-Button
        this.pascalVisible = localStorage.getItem('gcs_flow_pascal_visible') === 'true';
        this.pascalToggleBtn = document.createElement('button');
        this.pascalToggleBtn.innerText = '🔤 Pascal';
        this.pascalToggleBtn.title = 'Pascal-Sequenz ein-/ausblenden (Klick: Toggle)';
        this.pascalToggleBtn.style.cssText = `padding:5px 10px;color:white;border:1px solid #666;border-radius:4px;cursor:pointer;background:${this.pascalVisible ? '#5c2d91' : '#444'}`;
        this.pascalToggleBtn.onclick = () => this.togglePascalPanel();
        toolbar.appendChild(this.pascalToggleBtn);

        this.container.appendChild(toolbar);

        // Canvas Wrapper (für side-by-side Layout bei rechts-Position)
        const canvasWrapper = document.createElement('div');
        canvasWrapper.id = 'flow-canvas-wrapper';
        canvasWrapper.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:0';

        // Canvas (Drop Area)
        this.canvas = document.createElement('div');

        this.canvas.id = 'flow-canvas';
        this.canvas.style.cssText = 'flex:1;background:#1e1e1e;position:relative;overflow:auto;width:100%;height:calc(100% - 40px);background-image:radial-gradient(#333 1px, transparent 1px);background-size:20px 20px';

        // Add a world container that will dictate the scroll size
        const world = document.createElement('div');
        world.id = 'flow-world';
        world.style.cssText = 'position:absolute;top:0;left:0;width:5000px;height:5000px;pointer-events:none';
        this.canvas.appendChild(world);

        // Events logic unified in InteractionManager
        this.interactionManager.bindEvents();

        canvasWrapper.appendChild(this.canvas);

        // Pascal-Panel
        this.pascalPanel = document.createElement('div');
        this.pascalPanel.id = 'flow-pascal-panel';
        this.pascalPanel.className = 'flow-pascal-panel';
        canvasWrapper.appendChild(this.pascalPanel);

        this.container.appendChild(canvasWrapper);

        // INITIALISIERE LAYOUT KORREKT BEIM START
        this.applyPascalLayout();



        // Global interaction listener for handle dragging
        document.addEventListener('mousemove', (e) => this.interactionManager.handleGlobalMove(e));
        document.addEventListener('mouseup', (e) => this.interactionManager.handleGlobalUp(e));

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

        this.initMediator();
    }

    private initMediator() {
        this.uiController.initMediator();

        // Listen for context switch requests (e.g. from Inspector)
        mediatorService.on(MediatorEvents.SWITCH_FLOW_CONTEXT, (data: any) => {
            if (data && data.taskName) {
                FlowEditor.logger.info(`Received SWITCH_FLOW_CONTEXT request for: ${data.taskName}`);
                this.switchActionFlow(data.taskName);
            }
        });

        // Listen for rename events to update internal context pointer and nodes
        mediatorService.on(MediatorEvents.TASK_RENAMED, (data: { oldName: string, newName: string }) => {
            FlowEditor.logger.info(`Received TASK_RENAMED event: ${data.oldName} -> ${data.newName}`);
            this.renameContext(data.oldName, data.newName);

            if (this.currentFlowContext === data.newName) {
                localStorage.setItem('gcs_last_flow_context', data.newName);
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
        console.warn('[DEBUG-RENAME] >>> setProject() aufgerufen!', new Error().stack);
        this.project = project;

        // ================================================================
        // MIGRATION: Root-Level → Blueprint-Stage (Einmalig beim Laden)
        // project.tasks/actions/variables gehören in die Blueprint-Stage.
        // Root-Level-Arrays sind Legacy und werden hier bereinigt.
        // ================================================================
        this.migrateRootToBlueprint();

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
        const blueprint = this.project.stages?.find(s => s.type === 'blueprint' || s.id === 'stage_blueprint' || s.id === 'blueprint');
        const isValidBlueprintTask = blueprint?.tasks?.some(t => t.name === savedContext);
        const isValidStageTask = this.getActiveStage()?.tasks?.some(t => t.name === savedContext);
        const isStaticContext = savedContext === 'global';

        if (savedContext && (isStaticContext || isValidBlueprintTask || isValidStageTask)) {
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

    /**
     * Migriert Legacy Root-Level-Daten (project.tasks/actions/variables/flowCharts)
     * in die Blueprint-Stage. Root-Arrays werden danach geleert.
     */
    private migrateRootToBlueprint() {
        if (!this.project) return;
        const blueprint = this.project.stages?.find(s =>
            s.type === 'blueprint' || s.id === 'stage_blueprint' || s.id === 'blueprint'
        );
        if (!blueprint) return; // Ohne Blueprint-Stage keine Migration möglich

        if (!blueprint.tasks) blueprint.tasks = [];
        if (!blueprint.actions) blueprint.actions = [];
        if (!blueprint.variables) blueprint.variables = [];
        if (!blueprint.flowCharts) blueprint.flowCharts = {};

        let migrated = false;

        // Tasks migrieren
        if (this.project.tasks && this.project.tasks.length > 0) {
            const existingNames = new Set(blueprint.tasks.map(t => t.name));
            for (const task of this.project.tasks) {
                if (!existingNames.has(task.name)) {
                    blueprint.tasks.push(task);
                    FlowEditor.logger.info(`[MIGRATION] Task "${task.name}" von Root nach Blueprint-Stage verschoben.`);
                    migrated = true;
                }
            }
            this.project.tasks = [];
        }

        // Actions migrieren
        if (this.project.actions && this.project.actions.length > 0) {
            const existingNames = new Set(blueprint.actions.map(a => a.name));
            for (const action of this.project.actions) {
                if (!existingNames.has(action.name)) {
                    blueprint.actions.push(action);
                    FlowEditor.logger.info(`[MIGRATION] Action "${action.name}" von Root nach Blueprint-Stage verschoben.`);
                    migrated = true;
                }
            }
            this.project.actions = [];
        }

        // Variables migrieren
        if (this.project.variables && this.project.variables.length > 0) {
            const existingNames = new Set(blueprint.variables.map((v: any) => v.name));
            for (const variable of this.project.variables) {
                if (!existingNames.has((variable as any).name)) {
                    blueprint.variables.push(variable);
                    FlowEditor.logger.info(`[MIGRATION] Variable "${(variable as any).name}" von Root nach Blueprint-Stage verschoben.`);
                    migrated = true;
                }
            }
            this.project.variables = [];
        }

        // FlowCharts migrieren
        if (this.project.flowCharts) {
            for (const [key, chart] of Object.entries(this.project.flowCharts)) {
                if (!blueprint.flowCharts![key]) {
                    blueprint.flowCharts![key] = chart;
                    FlowEditor.logger.info(`[MIGRATION] FlowChart "${key}" von Root nach Blueprint-Stage verschoben.`);
                    migrated = true;
                }
            }
            this.project.flowCharts = {};
        }

        if (migrated) {
            FlowEditor.logger.info('[MIGRATION] Root-Level-Daten erfolgreich in Blueprint-Stage migriert.');
        }
    }

    public syncActionsFromProject(): void {
        this.syncManager.syncActionsFromProject();
    }

    private createNewTaskFlow() {
        this.taskManager.createNewTaskFlow();
    }

    /**
     * Ermittelt die passende FlowCharts-Collection (Global vs Stage)
     */
    public getTargetFlowCharts(taskName?: string): any {
        return this.taskManager.getTargetFlowCharts(taskName);
    }

    private deleteCurrentTaskFlow() {
        this.taskManager.deleteCurrentTaskFlow();
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

        const isBlueprint = activeStage?.type === 'blueprint' || activeStage?.id === 'stage_blueprint' || activeStage?.id === 'blueprint';

        // --- Current Stage Section ---
        if (activeStage && !isBlueprint) {
            const stageGroup = document.createElement('optgroup');
            stageGroup.label = `Stage: ${activeStage.name}`;

            // Tasks in this stage
            const stageTasksFound = new Set<string>();

            // 1. Tasks that have a flowchart (and are actually defined in tasks)
            if (activeStage.flowCharts) {
                const definedTaskNames = new Set(activeStage.tasks?.map(t => t.name) || []);
                Object.keys(activeStage.flowCharts).forEach(key => {
                    if (key !== 'global' && definedTaskNames.has(key)) {
                        const opt = document.createElement('option');
                        opt.value = key;
                        opt.text = `Task: ${key}`;
                        opt.selected = this.currentFlowContext === key;
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
                        opt.selected = this.currentFlowContext === task.name;
                        stageGroup.appendChild(opt);
                        stageTasksFound.add(task.name);
                    }
                });
            }

            this.flowSelect.appendChild(stageGroup);
        }

        // --- Global Section ---
        // Blueprint-Tasks nur anzeigen wenn die aktive Stage die Blueprint-Stage ist
        if (isBlueprint) {
            const globalGroup = document.createElement('optgroup');
            globalGroup.label = '🔷 Blueprint / Global';

            // 0. Blueprint Main Flow (SSoT für Infrastructure)
            const blueprintStage = this.project.stages?.find(s => s.type === 'blueprint' || s.id === 'stage_blueprint' || s.id === 'blueprint');
            if (blueprintStage) {
                const bpGlobalOpt = document.createElement('option');
                bpGlobalOpt.value = 'global';
                bpGlobalOpt.text = 'Main Flow (Blueprint)';
                // Wenn wir in einer anderen Stage sind, bezieht sich 'global' auf die Stage. 
                // Wenn wir in Blueprint sind, bezieht sich 'global' auf Blueprint.
                bpGlobalOpt.selected = isBlueprint && this.currentFlowContext === 'global';
                globalGroup.appendChild(bpGlobalOpt);
            }

            const globalTasksFound = new Set<string>();

            // 1. Blueprint-Stage-eigene FlowCharts (SSoT für globale Tasks)
            if (blueprintStage?.flowCharts) {
                const definedGlobalTaskNames = new Set(blueprintStage.tasks?.map(t => t.name) || []);
                Object.keys(blueprintStage.flowCharts).forEach(key => {
                    if (key !== 'global' && definedGlobalTaskNames.has(key)) {
                        const opt = document.createElement('option');
                        opt.value = key;
                        opt.text = `Task: ${key}`;
                        opt.selected = this.currentFlowContext === key;
                        globalGroup.appendChild(opt);
                        globalTasksFound.add(key);
                    }
                });
            }

            // 2. Blueprint-Stage-eigene Tasks ohne FlowChart
            if (blueprintStage?.tasks) {
                blueprintStage.tasks.forEach(task => {
                    if (!globalTasksFound.has(task.name)) {
                        const opt = document.createElement('option');
                        opt.value = task.name;
                        opt.text = `Task: ${task.name}`;
                        opt.selected = this.currentFlowContext === task.name;
                        globalGroup.appendChild(opt);
                        globalTasksFound.add(task.name);
                    }
                });
            }


            // 3. Legacy Root-Level project.tasks/flowCharts Fallback
            if (this.project.tasks) {
                this.project.tasks.forEach(task => {
                    if (!globalTasksFound.has(task.name)) {
                        const opt = document.createElement('option');
                        opt.value = task.name;
                        opt.text = `Task: ${task.name}`;
                        opt.selected = this.currentFlowContext === task.name;
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

        // --- SAFETY CHECK: Ensure current context is in the list ---
        if (this.currentFlowContext && this.currentFlowContext !== 'global' && this.currentFlowContext !== 'event-map' && this.currentFlowContext !== 'element-overview') {
            let found = false;
            // Check if value exists in options (recursively through optgroups)
            for (let i = 0; i < this.flowSelect.options.length; i++) {
                if (this.flowSelect.options[i].value === this.currentFlowContext) {
                    found = true;
                    break;
                }
            }

            if (!found) {
                FlowEditor.logger.warn(`Current context "${this.currentFlowContext}" nicht im Dropdown gefunden (falsche Stage?). Wechsle zur Übersicht.`, { activeStage: activeStage?.id });
                this.currentFlowContext = 'element-overview';
                
                // Asynchron den Flow wechseln, damit das UI nicht blockiert/Schleifen erzeugt
                setTimeout(() => {
                    this.switchActionFlow('element-overview', false, true);
                }, 10);
            }
        }

        // Set value
        this.flowSelect.value = this.currentFlowContext;
    }

    public switchActionFlow(context: string, addToHistory: boolean = true, skipSync: boolean = false) {
        if (this.currentFlowContext === context) return;

        // 1. Save current scroll position before switching
        if (this.currentFlowContext) {
            this.scrollPositions.set(this.currentFlowContext, {
                x: this.canvas.scrollLeft,
                y: this.canvas.scrollTop
            });
        }

        // 2. Save current state
        if (!skipSync) {
            this.syncToProject();
        }

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

        // --- NEW: Sync activeStageId based on Task location ---
        if (context !== 'global' && context !== 'event-map' && context !== 'element-overview') {
            const container = projectRegistry.getTaskContainer(context);
            if (container.type === 'stage' && container.stageId) {
                FlowEditor.logger.info(`Auto-switching projectRegistry.activeStageId to ${container.stageId} for task ${context}`);
                projectRegistry.setActiveStageId(container.stageId);
            } else if (container.type === 'global') {
                FlowEditor.logger.info(`Auto-switching projectRegistry.activeStageId to null (global) for task ${context}`);
                projectRegistry.setActiveStageId(null);
            }
        }

        // 5. Load new state
        this.loadFromProject();
        this.updatePascalPanel();


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
     * Renames a flow context (e.g. when a task is renamed)
     */
    public renameContext(oldName: string, newName: string) {
        if (!oldName || !newName || oldName === newName) return;

        // 1. Update Scroll Positions map
        const pos = this.scrollPositions.get(oldName);
        if (pos) {
            this.scrollPositions.delete(oldName);
            this.scrollPositions.set(newName, pos);
        }

        // 2. Update localStorage for scroll positions
        const savedScroll = localStorage.getItem(`gcs_flow_scroll_${oldName}`);
        if (savedScroll) {
            localStorage.setItem(`gcs_flow_scroll_${newName}`, savedScroll);
            localStorage.removeItem(`gcs_flow_scroll_${oldName}`);
        }

        // 3. Update history
        this.contextHistory = this.contextHistory.map(h => h === oldName ? newName : h);

        FlowEditor.logger.info(`[TRACE] renameContext: "${oldName}" -> "${newName}"`);
        // 4. CRITICAL: Update ALL live nodes that might still have the old name in their data
        // This prevents the syncManager from recreating the old task as a "ghost"
        // regardless of whether we are currently in that task's flow or not.
        this.nodes.forEach(node => {
            const type = (node as any).getType?.();
            if (type === 'task' && (node.data?.taskName === oldName || node.Name === oldName)) {
                node.Name = newName;
                if (node.data) node.data.taskName = newName;
            } else if (type === 'action' && (node.data?.name === oldName || node.Name === oldName)) {
                node.Name = newName;
                if (node.data) node.data.name = newName;
            }
        });

        // 5. Update StateManager if it's the current context
        if (this.currentFlowContext === oldName) {
            this.currentFlowContext = newName;
            this.stateManager.renameContext(oldName, newName);
            // Refresh dropdown to show new name instead of falling back to global
            this.updateFlowSelector();
        }
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

    public rebuildActionRegistry() {
        this.taskManager.rebuildActionRegistry();
    }

    public ensureTaskExists(taskName: string, description?: string) {
        this.taskManager.ensureTaskExists(taskName, description);
    }

    public syncToProject() {
        if (this.isLoading) {
            FlowEditor.logger.info("Skipping syncToProject: isLoading is true");
            return;
        }
        this.isFlowDirty = true; // Interne Aufrufe implizieren immer eine Änderung
        FlowEditor.logger.info(`syncToProject triggered for context: ${this.currentFlowContext}`);
        this.syncManager.syncToProject(this.currentFlowContext);
        this.updatePascalPanel();
    }


    /**
     * Formatiert das Layout des aktuellen Flow-Diagramms.
     * Wird nach Verbindungsherstellung automatisch aufgerufen.
     */
    public formatLayout() {
        if (this.currentFlowContext !== 'global' && this.nodes.length > 1) {
            this.hydrationManager.formatOrthogonalLayout();
        }
    }

    // ─────────────────────────────────────────────
    // Pascal-Panel Methoden
    // ─────────────────────────────────────────────

    private togglePascalPanel() {
        this.pascalVisible = !this.pascalVisible;
        localStorage.setItem('gcs_flow_pascal_visible', String(this.pascalVisible));
        this.pascalToggleBtn.style.background = this.pascalVisible ? '#5c2d91' : '#444';
        this.pascalPanel.style.display = this.pascalVisible ? 'block' : 'none';
        this.applyPascalLayout();
        if (this.pascalVisible) this.updatePascalPanel();
    }


    private applyPascalLayout() {
        const wrapper = document.getElementById('flow-canvas-wrapper');
        if (!wrapper) return;

        if (this.pascalVisible) {
            wrapper.style.flexDirection = 'row';
            // Modern resizable glassmorphic panel
            this.pascalPanel.style.cssText = `
                direction: rtl; /* Trick: Resize handle on the left side */
                resize: horizontal;
                overflow: auto;
                width: 400px;
                min-width: 250px;
                max-width: 900px;
                background: rgba(25, 25, 25, 0.85);
                backdrop-filter: blur(12px);
                border-left: 1px solid rgba(255, 255, 255, 0.1);
                border-top: none;
                box-shadow: -5px 0 20px rgba(0, 0, 0, 0.5);
                display: flex;
                flex-direction: column;
                color: #e0e0e0;
                font-family: 'Consolas', 'Courier New', monospace;
                z-index: 100;
            `;
            this.canvas.style.flex = '1';
        } else {
            this.pascalPanel.style.display = 'none';
        }
    }

    public updatePascalPanel() {
        if (!this.pascalVisible || !this.pascalPanel || !this.project) return;

        const ctx = this.currentFlowContext;
        const activeStage = this.getActiveStage();
        
        let code = '';
        let title = '';

        if (ctx === 'global' || ctx === 'event-map' || ctx === 'element-overview') {
            title = '🔤 Stage: ' + (activeStage ? activeStage.name : 'Global');
            code = PascalCodeGenerator.generateFullProgram(this.project, true, activeStage || undefined);
        } else {
            title = '🔤 Task: ' + ctx;
            code = PascalCodeGenerator.generateForTask(this.project, ctx, true, activeStage || undefined);
        }

        // Wrap inner content with LTR to fix text reading direction after RTL trick
        this.pascalPanel.innerHTML = `
            <div style="direction: ltr; display: flex; flex-direction: column; min-width: 100%; height: 100%;">
                <div class="pascal-header" style="padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3); font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #4ec9b0; font-family: sans-serif;">${title}</span>
                    <button class="pascal-close-btn" title="Panel schließen" style="background: none; border: none; color: #aaa; cursor: pointer; font-size: 16px; padding: 0 5px;">✖</button>
                </div>
                <div class="pascal-body" style="padding: 15px; overflow-y: auto; overflow-x: auto; flex: 1; font-size: 13px; line-height: 1.5; white-space: pre-wrap;">${code}</div>
            </div>
        `;

        const closeBtn = this.pascalPanel.querySelector('.pascal-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.togglePascalPanel());
        }
    }


    /** Nur synchronisieren wenn tatsächlich Änderungen vorgenommen wurden.
     *  Wird von switchView() aufgerufen, NICHT von internen Service-Managern. */
    public syncToProjectIfDirty() {
        if (!this.isFlowDirty) {
            FlowEditor.logger.info("Skipping syncToProject: keine Änderungen im Flow-Editor (isFlowDirty=false)");
            return;
        }
        this.syncToProject();
        this.isFlowDirty = false;
    }

    // syncTaskParameters, syncTaskParamValues, syncVariablesFromFlow, syncTaskFromFlow sind nun im SyncManager.

    public loadFromProject(contextName?: string) {
        console.warn('[DEBUG-RENAME] >>> loadFromProject() aufgerufen! context=', contextName, new Error().stack);
        this.hydrationManager.loadFromProject(contextName);
        this.updatePascalPanel();
    }


    // restoreNode wurde in den FlowSyncManager verschoben.

    /**
     * Re-expands a Proxy node to show its internal ghost nodes
     */
    public refreshEmbeddedTask(proxyNode: FlowElement) {
        this.hydrationManager.refreshEmbeddedTask(proxyNode);
    }

    // generateFlowFromActionSequence wurde in den FlowSyncManager verschoben.

    public restoreConnection(data: any) {
        this.graphManager.restoreConnection(data);
    }

    public setupConnectionListeners(conn: FlowConnection) {
        this.interactionManager.setupConnectionListeners(conn);
    }

    // handleCanvasClick wurde in den FlowInteractionManager verschoben.

    public deselectAll(emitEvent: boolean = true) {
        this.selectionManager.deselectAll(emitEvent);
    }

    public createNode(type: string, x: number, y: number, initialName?: string): FlowElement | null {
        return this.nodeFactory.createNode(type, x, y, initialName);
    }

    public deleteConnection(conn: FlowConnection) {
        this.graphManager.deleteConnection(conn);
    }

    public deleteNode(node: FlowElement) {
        this.graphManager.deleteNode(node);
    }

    public generateUniqueActionName(base: string): string {
        return FlowNamingService.generateUniqueActionName(this.project, this.nodes, base);
    }
    public generateUniqueTaskName(base: string): string {
        return FlowNamingService.generateUniqueTaskName(this.project, this.nodes, base);
    }
    public generateUniqueVariableName(base: string): string {
        return FlowNamingService.generateUniqueVariableName(this.project, this.nodes, base);
    }


    // handleDrop wurde in den FlowInteractionManager verschoben.

    public setupNodeListeners(node: FlowElement) {
        this.interactionManager.setupNodeListeners(node);
    }

    // ─────────────────────────────────────────────
    // Tooltip Implementation
    // ─────────────────────────────────────────────

    // Tooltip Implementation wurde in den FlowInteractionManager verschoben.

    public importTaskGraph(targetNode: FlowElement, task: any, isLinked: boolean = false): FlowElement[] {
        return this.hydrationManager.importTaskGraph(targetNode, task, isLinked);
    }

    public handleNodeDoubleClick(node: FlowElement) {
        // DEBUG: Log every double-click
        FlowEditor.logger.info(`=== DOUBLE-CLICK on node: ${node.name} ===`);

        const isTask = node instanceof FlowTask;
        const taskName = isTask ? (node.data?.taskName || node.Name) : null;

        // 1. Feature: Map Navigation
        if (this.currentFlowContext === 'event-map' && node.data?.isMapLink && taskName) {
            FlowEditor.logger.info(`Event-Map: Switching to task flow: ${taskName}`);
            this.switchActionFlow(taskName);
            return;
        }

        // 2. Standard Behavior: Switch directly to Task Flow
        if (isTask && taskName) {
            FlowEditor.logger.info(`Switching to Task Flow: ${taskName}`);
            this.switchActionFlow(taskName);
            return;
        }

        // 3. Fallback: Toggle details for ALL other node types (Start, Action, etc.)
        const newShowState = !node.IsDetailed;
        node.setShowDetails(newShowState, this.project);

        this.syncToProject();
    }

    public selectNode(node: FlowElement | null) {
        if (node && node.data?.isProxy && node.data?.stageObjectId) {
            this.currentSelectedStageObjectId = node.data.stageObjectId;
        }
        this.selectionManager.selectNode(node);
    }

    /**
     * Selects a node by its ID (name property) - used by Inspector dropdown
     */
    public selectNodeById(nodeId: string | null): void {
        this.selectionManager.selectNodeById(nodeId);
    }

    public selectConnection(conn: FlowConnection | null) {
        this.selectionManager.selectConnection(conn);
    }

    /**
     * Re-renders the currently selected node to reflect property changes
     */
    public refreshSelectedNode() {
        this.selectionManager.refreshSelectedNode();
    }

    // handleGlobalMove, handleGlobalUp und findClosestAnchor wurden in den FlowInteractionManager verschoben.

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
        this.uiController.updateGrid();
    }

    // Inspector Properties for Flow Editor (Grid Settings)
    public get name(): string { return 'Flow Grid Settings'; }

    public get GridColumns(): number { return this.uiController.getGridColumns(); }
    public set GridColumns(v: number) { this.uiController.setGridColumns(v); }

    public get GridRows(): number { return this.uiController.getGridRows(); }
    public set GridRows(v: number) { this.uiController.setGridRows(v); }

    public get CellSize(): number { return this.uiController.getCellSize(); }
    public set CellSize(v: number) { this.uiController.setCellSize(v); }

    public get SnapToGrid(): boolean { return this.uiController.getSnapToGrid(); }
    public set SnapToGrid(v: boolean) { this.uiController.setSnapToGrid(v); }

    public get ShowGrid(): boolean { return this.uiController.getShowGrid(); }
    public set ShowGrid(v: boolean) { this.uiController.setShowGrid(v); }

    public get BackgroundColor(): string { return this.uiController.getBackgroundColor(); }
    public set BackgroundColor(v: string) { this.uiController.setBackgroundColor(v); }

    public getInspectorProperties(): any[] {
        return this.uiController.getInspectorProperties();
    }

    public hasNode(id: string): boolean {
        return this.nodes.some(n => n.name === id);
    }

    public removeNode(id: string) {
        this.graphManager.removeNode(id);
    }

    // ─────────────────────────────────────────────
    // Details View Toggle
    // ─────────────────────────────────────────────

    /**
     * Wechselt zwischen Konzept- und Details-Ansicht
     */
    private toggleDetailsView(): void {
        this.selectionManager.toggleDetailsView();
        
        // Neu: Da sich die Höhe/Breite der Knoten ändert, formatiert sich das Layout automatisch neu,
        // um schräge Verbindungen zu korrigieren. Delay stellt sicher, dass DOM-Größen messbar sind.
        setTimeout(() => {
            if (this.currentFlowContext !== 'global' && this.currentFlowContext !== 'event-map' && this.currentFlowContext !== 'element-overview') {
                this.formatLayout();
                this.syncToProject();
            }
        }, 50);
    }

    /**
     * Aktualisiert die Anzeige aller Action-Knoten basierend auf showDetails
     */
    public updateActionDetails(): void {
        this.selectionManager.updateActionDetails();
    }

    /**
     * Entfernt alle Knoten und Verbindungen vom Canvas
     */
    public clearFlowCanvas(): void {
        this.graphManager.clearFlowCanvas();
    }

    /**
     * Updates the internal 'world' size to ensure the canvas is scrollable
     */
    public updateScrollArea(): void {
        this.uiController.updateScrollArea();
    }
}
