import { Stage } from './Stage';
import { GameProject, StageType, StageDefinition, GameAction, GameTask, ProjectVariable } from '../model/types';
import { TWindow } from '../components/TWindow';
import { TGameLoop } from '../components/TGameLoop';
import { TDebugLog } from '../components/TDebugLog';
import { hydrateObjects } from '../utils/Serialization';
import { unwrap } from '../runtime/ReactiveProperty';
import { inputSyncer, collisionSyncer, network } from '../multiplayer';
import { jsonLobby } from '../multiplayer/JSONMultiplayerLobby';
import { FlowDiagramGenerator } from './FlowDiagramGenerator';
import mermaid from 'mermaid';
import { ExpressionParser } from '../runtime/ExpressionParser';
import { JSONInspector } from './JSONInspector';
import { JSONToolbox } from './JSONToolbox';
import { JSONComponentPalette } from './JSONComponentPalette';
import { DialogManager } from './DialogManager';
import { dialogService } from '../services/DialogService';
import { serviceRegistry } from '../services/ServiceRegistry';
import '../services/RemoteGameManager';
import { PascalGenerator } from './PascalGenerator';
import { PascalHighlighter } from './PascalHighlighter';
import { FlowEditor } from './FlowEditor';
import { FlowToolbox } from './FlowToolbox';
import { MenuBar } from './MenuBar';
import { RefactoringManager } from './RefactoringManager';
import { EditorStageManager } from './EditorStageManager';
import { projectRegistry } from '../services/ProjectRegistry';
import { libraryService } from '../services/LibraryService';
import { EditorViewManager, IViewHost, ViewType } from './EditorViewManager';
import { changeRecorder, RecordedAction } from '../services/ChangeRecorder';
import { PlaybackControls } from '../components/PlaybackControls';
import { PlaybackOverlay } from '../components/PlaybackOverlay';
import { playbackEngine } from '../services/PlaybackEngine';
import { safeDeepCopy } from '../utils/DeepCopy';
import { mediatorService, MediatorEvents } from '../services/MediatorService';
import { projectPersistenceService } from '../services/ProjectPersistenceService';
import { EditorCommandManager } from './services/EditorCommandManager';
import { EditorRunManager } from './services/EditorRunManager';
import { dataService } from '../services/DataService';

export class Editor implements IViewHost {
    public stage: Stage;
    public jsonInspector: JSONInspector | null = null;
    private jsonToolbox: JSONToolbox | null = null;
    public flowEditor: FlowEditor | null = null;
    public flowToolbox: FlowToolbox | null = null;
    private menuBar: MenuBar | null = null;
    private componentPalette: JSONComponentPalette | null = null;
    public playbackControls: PlaybackControls | null = null;
    public playbackOverlay: PlaybackOverlay | null = null;
    public dialogManager: DialogManager;
    public stageManager: EditorStageManager;
    public viewManager: EditorViewManager;
    public commandManager: EditorCommandManager;
    public runManager: EditorRunManager;
    public project: GameProject;
    public debugLog: TDebugLog | null = null;
    public currentSelectedId: string | null = null;
    private useHorizontalToolbox: boolean = false;

    public get workingProjectData() { return this.viewManager.workingProjectData; }
    public set workingProjectData(v: any) { this.viewManager.workingProjectData = v; }

    constructor() {
        // Initialize Default Project
        this.project = {
            meta: {
                name: "New Game",
                version: "1.0.0",
                author: "Anonymous"
            },
            stage: {
                grid: {
                    cols: 64,
                    rows: 40,
                    cellSize: 20, // 1280x800 resolution base (tablet)
                    snapToGrid: true,
                    visible: true,
                    backgroundColor: '#ffffff'
                }
            },
            flow: {
                stage: {
                    cols: 100,
                    rows: 100,
                    cellSize: 20,
                    snapToGrid: true,
                    visible: true,
                    backgroundColor: '#1e1e1e' // Dark background for Flow Editor
                },
                elements: [],
                connections: []
            },
            input: {
                player1Controls: 'arrows',
                player1Target: '',
                player1Speed: 0.2,
                player2Controls: 'wasd',
                player2Target: '',
                player2Speed: 0.2
            },
            objects: [],
            splashObjects: [],
            splashDuration: 3000,
            splashAutoHide: true,
            actions: [],
            tasks: [],
            variables: []
        };

        // Initialize ProjectRegistry
        projectRegistry.setProject(this.project);

        // Initialize Stage
        this.stage = new Stage('stage', this.project.stage.grid);

        // Initialize StageManager
        this.stageManager = new EditorStageManager(this.project, this.stage, () => {
            this.render();
            this.updateProjectJSON();
        });

        // Initialize ViewManager
        this.viewManager = new EditorViewManager(this);
        this.commandManager = new EditorCommandManager(this);
        this.runManager = new EditorRunManager(this);

        // Initialisiere Stages (Migration für Default-Projekt)
        this.migrateToStages();
        this.stage.onEvent = (id, evt, data) => this.handleEvent(id, evt, data);

        // Initialize DialogManager
        this.dialogManager = new DialogManager();
        this.dialogManager.setProject(this.project);

        // Ensure ProjectRegistry knows about the initial project
        projectRegistry.setProject(this.project);

        // Register DialogService in ServiceRegistry
        dialogService.setDialogManager(this.dialogManager);
        serviceRegistry.register('Dialog', dialogService, 'Dialog Service for opening dialogs');

        // Register Editor service
        serviceRegistry.register('Editor', {
            selectObject: (id: string) => this.selectObject(id),
            jumpToDebug: (objectName: string, eventName: string) => {
                this.switchView('run');
                if (this.debugLog) {
                    this.debugLog.setFilters(objectName, eventName);
                }
            }
        });
        // Register Library service
        serviceRegistry.register('Library', libraryService, 'Global Library for Tasks and Actions');
        libraryService.loadLibrary();

        // Register Data service
        serviceRegistry.register('Data', dataService, 'Data Persistence Service');

        // Auto-seed important data from server for the Editor simulator (Dev Mode)
        if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
            dataService.seedFromUrl('users.json', '/api/dev/data/users.json');
        }

        // Register Mock HttpServer for API Simulation in Editor
        serviceRegistry.register('HttpServer', {
            respond: (requestId: string, status: number, data: any) => {
                if (requestId && requestId.startsWith('sim-')) {
                    console.log(`[Editor] Sim-Response empfangen für ${requestId}:`, data);
                    // Suche nach der TAPIServer Komponente im Projekt
                    const allObjects = projectRegistry.getObjects();
                    const server = allObjects.find(o => (o as any).className === 'TAPIServer');
                    if (server) {
                        (server as any).testResponse = `Status: ${status}\n\n${JSON.stringify(data, null, 2)}`;
                        // Update Inspector falls dieses Objekt ausgewählt ist
                        if (this.jsonInspector && this.jsonInspector.getSelectedObject() === server) {
                            this.jsonInspector.update(server);
                        }
                    }
                }
                // Store response for ApiSimulator to retrieve
                if ((window as any).__pendingApiResponses) {
                    const resolver = (window as any).__pendingApiResponses.get(requestId);
                    if (resolver) {
                        resolver({ status, data });
                        (window as any).__pendingApiResponses.delete(requestId);
                    }
                }
            }
        });

        // Register ApiSimulator service for intercepting http action requests in Editor
        (window as any).__pendingApiResponses = new Map();
        serviceRegistry.register('ApiSimulator', {
            request: async (method: string, url: string, body: any): Promise<any> => {
                return new Promise((resolve) => {
                    const requestId = 'sim-' + Math.floor(Math.random() * 1000000);

                    // Parse URL to extract path
                    let path = url;
                    try {
                        const urlObj = new URL(url);
                        path = urlObj.pathname;
                    } catch (e) {
                        // URL is already a path
                    }

                    console.log(`[ApiSimulator] Simulating: ${method} ${path}`, body);

                    // Store resolver for when respond is called
                    (window as any).__pendingApiResponses.set(requestId, (response: any) => {
                        console.log(`[ApiSimulator] Response received for ${requestId}:`, response);
                        resolve(response.data);
                    });

                    // Find TAPIServer and trigger onRequest event
                    const allObjects = projectRegistry.getObjects();
                    const server = allObjects.find(o => (o as any).className === 'TAPIServer') as any;

                    if (server && this.runManager && this.runManager.runtime) {
                        const runtime = this.runManager.runtime;
                        runtime.handleEvent(server.id, 'onRequest', {
                            method,
                            path,
                            body,
                            requestId,
                            isSimulation: true
                        });
                    } else {
                        // No TAPIServer found, return mock error
                        console.warn('[ApiSimulator] No TAPIServer found. Returning mock error.');
                        resolve({ error: 'No API Server configured', status: 503 });
                    }

                    // Timeout after 5 seconds
                    setTimeout(() => {
                        if ((window as any).__pendingApiResponses.has(requestId)) {
                            (window as any).__pendingApiResponses.delete(requestId);
                            console.warn(`[ApiSimulator] Timeout for request ${requestId}`);
                            resolve({ error: 'Simulation timeout - no respond_http action executed', status: 504 });
                        }
                    }, 5000);
                });
            }
        }, 'API Request Simulator for Editor Mode');

        // Initialize JSON-based UI components
        this.debugLog = new TDebugLog();
        this.initJSONInspector();
        this.initJSONToolbox();
        this.initComponentPalette();
        this.initFlowEditor();
        this.initMenuBar();
        this.initMediator();

        // Note: Toolbar is now inside Toolbox
        this.init();
        this.bindViewEvents();
        this.bindSystemInfoEvents();

        // Check for auto-save data in localStorage
        const lastProject = localStorage.getItem('gcs_last_project');
        if (lastProject) {
            try {
                const data = JSON.parse(lastProject);
                this.loadProject(data);
                console.log('[Editor] Restored project from last session');

                // Show notification if a toast component is available or create a temporary one
                setTimeout(() => {
                    const toast = this.project.objects.find(o => (o as any).className === 'TToast') as any;
                    if (toast && typeof toast.info === 'function') {
                        toast.info('Projekt aus der letzten Sitzung wiederhergestellt.');
                    }
                }, 1000);
            } catch (err) {
                console.error('[Editor] Failed to restore project from last session:', err);
                this.switchView('stage');
            }
        } else {
            // No last project, ensure we are in stage view
            this.switchView('stage');
        }

        // Setup toolbox layout toggle button
        const toolboxToggleBtn = document.getElementById('toolbox-layout-toggle');
        if (toolboxToggleBtn) {
            toolboxToggleBtn.onclick = () => this.toggleToolboxLayout();
        }

        // Context switcher buttons removed in favor of Stages menu
    }

    // Multiplayer state
    private _isMultiplayer: boolean = false;
    private _localPlayerNumber: 1 | 2 = 1;

    public get isMultiplayer(): boolean { return this._isMultiplayer; }
    public get localPlayerNumber(): 1 | 2 { return this._localPlayerNumber; }

    public get currentObjects(): TWindow[] { return this.stageManager.currentObjects(); }
    public set currentObjects(objs: TWindow[]) { this.stageManager.setCurrentObjects(objs); }
    public get currentActions(): GameAction[] { return this.stageManager.currentActions(); }
    public get currentTasks(): GameTask[] { return this.stageManager.currentTasks(); }
    public get currentVariables(): ProjectVariable[] { return this.stageManager.currentVariables(); }

    public getActiveStage(): StageDefinition | null { return this.stageManager.getActiveStage(); }
    private migrateToStages(): void { this.stageManager.migrateToStages(); }

    public get runtime() { return this.runManager.runtime; }
    public get runtimeObjects() { return this.runManager.runtimeObjects; }
    public get activeGameLoop() { return this.runManager.activeGameLoop; }
    public get activeTimers() { return this.runManager.activeTimers; }

    // --- COMMAND DELEGATIONS ---
    public addObject(type: string, x: number, y: number) { this.commandManager.addObject(type, x, y); }
    public removeObject(id: string) { this.commandManager.removeObject(id); }
    public removeObjectSilent(id: string) { this.commandManager.removeObjectSilent(id); }
    public selectObject(id: string | null, focus?: boolean) { this.commandManager.selectObject(id, focus); }
    public findObjectById(id: string) { return this.commandManager.findObjectById(id); }
    public findParentContainer(childId: string) { return this.commandManager.findParentContainer(childId); }
    public createObjectInstance(type: string, name: string, x: number, y: number) { return this.commandManager.createObjectInstance(type, name, x, y); }

    // --- RUN MODE DELEGATION ---
    public setRunMode(running: boolean) { this.runManager.setRunMode(running); }
    // --- VIEW DELEGATIONS ---
    public switchView(view: ViewType) { this.viewManager.switchView(view); }
    public refreshJSONView() {
        const jsonPanel = document.getElementById('json-viewer');
        if (jsonPanel && this.project) {
            const data = (this.viewManager.useStageIsolatedView) ? (this.getActiveStage() || this.project) : this.project;
            this.viewManager.renderJSONTree(data, jsonPanel);
        }
    }

    public render() {
        if (!this.project) return;
        try {
            // Set Blueprint Mode on stage
            const activeStage = this.getActiveStage();
            this.stage.isBlueprint = activeStage?.type === 'blueprint';

            // CRITICAL: Always get fresh objects from runtime if available
            let objectsToRender = this.runtime ? this.runtime.getObjects() : (this.runtimeObjects || this.getResolvedInheritanceObjects());

            // Resolve preview (bindings, etc) for non-run mode
            if (!this.runtime) {
                const varContext = this.getVariableContext();
                objectsToRender = objectsToRender.map(obj => this.resolveObjectPreview(obj, varContext));
            }

            this.stage.renderObjects(objectsToRender);
        } catch (err) {
            console.error("[Editor] Render error:", err);
        }
    }

    private resolveObjectPreview(obj: any, context: Record<string, any>): any {
        if (!obj || typeof obj !== 'object') return obj;
        const rawObj = unwrap(obj);

        // Preserve prototype for rendering getters like backgroundImage, src
        const previewObj = Object.create(Object.getPrototypeOf(rawObj));
        Object.assign(previewObj, rawObj);

        // Resolve nested bindings ${varName}
        const resolveProps = (target: any) => {
            if (!target || typeof target !== 'object') return;
            Object.keys(target).forEach(key => {
                const val = target[key];
                if (typeof val === 'string' && val.includes('${')) {
                    try { target[key] = ExpressionParser.interpolate(val, context); } catch (e) { }
                } else if (val && typeof val === 'object' && !Array.isArray(val) && (key === 'style' || key === 'grid')) {
                    target[key] = { ...val };
                    resolveProps(target[key]);
                }
            });
        };
        resolveProps(previewObj);

        if (previewObj.children && Array.isArray(previewObj.children)) {
            previewObj.children = previewObj.children.map((child: any) => this.resolveObjectPreview(child, context));
        }
        return previewObj;
    }

    private getVariableContext(): Record<string, any> {
        const context: Record<string, any> = {
            project: this.project,
            isMultiplayer: this._isMultiplayer,
            playerNumber: this._localPlayerNumber
        };
        projectRegistry.getVariables().forEach(v => { context[v.name] = v.defaultValue; });
        return context;
    }

    public autoSaveToLocalStorage() {
        this.updateProjectJSON();
    }



    /**
     * Gibt die passende Liste (Global vs Stage) für eine neue Action zurück
     */
    public getTargetActionCollection(actionName?: string, action?: GameAction): GameAction[] {
        const activeStage = this.getActiveStage();

        // 1. Explicit Scope Check
        if (action?.scope === 'global') return this.project.actions || (this.project.actions = []);
        if (action?.scope === 'stage' && activeStage) return activeStage.actions || (activeStage.actions = []);

        if (!activeStage) return this.project.actions || (this.project.actions = []);

        // 2. Existence Check (Existing logic)
        // ... rest of the logic ...
        if (activeStage.actions && activeStage.actions.find(a => a.name === actionName)) {
            return activeStage.actions;
        }

        if (this.project.actions && this.project.actions.find(a => a.name === actionName)) {
            return this.project.actions;
        }

        // Neue Actions standardmäßig in der Stage speichern, wenn Modus aktiv
        if (!activeStage.actions) activeStage.actions = [];
        return activeStage.actions;
    }

    /**
     * Gibt die passende Liste (Global vs Stage) für einen neuen Task zurück
     */
    public getTargetTaskCollection(taskName?: string, task?: GameTask): GameTask[] {
        const activeStage = this.getActiveStage();

        // 1. Explicit Scope Check
        if (task?.scope === 'global') return this.project.tasks || (this.project.tasks = []);
        if (task?.scope === 'stage' && activeStage) return activeStage.tasks || (activeStage.tasks = []);

        if (!activeStage) return this.project.tasks || (this.project.tasks = []);

        if (activeStage.tasks && activeStage.tasks.find(t => t.name === taskName)) {
            return activeStage.tasks;
        }

        if (this.project.tasks && this.project.tasks.find(t => t.name === taskName)) {
            return this.project.tasks;
        }

        if (!activeStage.tasks) activeStage.tasks = [];
        return activeStage.tasks;
    }

    /**
     * Start multiplayer mode - show lobby
     */
    private startMultiplayer(): void {
        const stageContainer = document.getElementById('stage-container');
        if (!stageContainer) return;

        // Initialize JSON Lobby if not already loaded
        this.initJSONLobby().then(() => {
            const gameName = this.project.meta.name || 'Unknown Game';
            jsonLobby.show(stageContainer, gameName, (playerNumber, _seed) => {
                console.log(`[Multiplayer] Game starting as Player ${playerNumber}`);
                this._isMultiplayer = true;
                this._localPlayerNumber = playerNumber;

                // Set player number on network manager so GameRuntime can read it
                network.playerNumber = playerNumber;

                // Initialize syncers
                const gameLoop = this.project.objects.find(o =>
                    (o as any).className === 'TGameLoop'
                ) as TGameLoop | undefined;

                const boundsTop = gameLoop?.boundsOffsetTop ?? 0;
                const boundsBottom = gameLoop?.boundsHeight ?? 24;

                inputSyncer.init(playerNumber, boundsTop, boundsBottom);
                collisionSyncer.init(playerNumber);

                // Setup opponent paddle name based on player number
                const opponentPaddleName = playerNumber === 1 ? 'PaddleRight' : 'PaddleLeft';

                // Track current movement direction (for detecting changes)
                let currentDirection: 'up' | 'down' | 'none' = 'none';

                // Setup global callback for local input events - ONLY sends on key events
                (window as any).__multiplayerInputCallback = (key: string, action: 'down' | 'up') => {
                    console.log(`[MP] Sending input: ${key} ${action}`);
                    // Send the input event to the server (no polling!)
                    network.sendInput(key, action);
                };

                // Listen for remote input events - trigger Tasks via event system
                network.on((msg: any) => {
                    if (msg.type === 'remote_input') {
                        // Find opponent paddle
                        const objects = this.runtimeObjects || this.project.objects;
                        const opponentPaddle = objects.find(o => o.name === opponentPaddleName);
                        if (!opponentPaddle) return;

                        // Translate opponent's key to movement direction
                        const isUpKey = msg.key === 'KeyW' || msg.key === 'ArrowUp';
                        const isDownKey = msg.key === 'KeyS' || msg.key === 'ArrowDown';

                        // Determine new direction based on current state
                        let newDirection: 'up' | 'down' | 'none' = currentDirection;

                        if (isUpKey) {
                            if (msg.action === 'down') {
                                newDirection = 'up';
                            } else if (currentDirection === 'up') {
                                newDirection = 'none';
                            }
                        } else if (isDownKey) {
                            if (msg.action === 'down') {
                                newDirection = 'down';
                            } else if (currentDirection === 'down') {
                                newDirection = 'none';
                            }
                        }

                        // Only trigger event if direction changed
                        if (newDirection !== currentDirection) {
                            currentDirection = newDirection;

                            // Build variables for task execution
                            const vars: Record<string, any> = { direction: newDirection };

                            if (newDirection === 'none') {
                                // Trigger stop event
                                if (this.runtime) {
                                    console.log(`[MP] Executing Task via Runtime on ${opponentPaddleName}`);
                                    this.runtime.handleEvent(opponentPaddle.id, 'onRemoteMoveStop', vars);
                                    this.render();
                                }
                            } else {
                                // Trigger start event with direction context
                                if (this.runtime) {
                                    console.log(`[MP] Executing Task via Runtime on ${opponentPaddleName} (direction: ${newDirection})`);
                                    this.runtime.handleEvent(opponentPaddle.id, 'onRemoteMoveStart', vars);
                                    this.render();
                                }
                            }
                        }
                    } else if (msg.type === 'remote_state') {
                        // Generic state sync for any object - use runtime.updateRemoteState like player-standalone.ts
                        if (this.runtime) {
                            console.log(`[MP] Received remote_state for ${msg.objectId}:`, msg);
                            this.runtime.updateRemoteState(msg.objectId, msg);
                            this.render();
                        } else {
                            console.warn('[MP] remote_state ignored: No runtime available');
                        }
                    }
                });

                // Start the game
                this.setRunMode(true);
            });
        });
    }

    private bindViewEvents() {
        const tabs = document.querySelectorAll('.tab-btn');
        tabs.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                const view = target.getAttribute('data-view') as ViewType;
                if (view) {
                    this.switchView(view);
                }
            });
        });
    }

    public refreshPascalView() {
        if (this.currentView !== 'code') return;
        try {
            const activeStage = this.getActiveStage();
            const stageToUse = (this.viewManager.useStageIsolatedView && activeStage) ? activeStage : undefined;
            const plainCode = PascalGenerator.generateFullProgram(this.project, false, stageToUse);

            if (this.viewManager.pascalEditorMode) {
                const highlightLayer = document.getElementById('pascal-editor-highlight');
                if (highlightLayer) {
                    highlightLayer.innerHTML = PascalHighlighter.highlight(plainCode);
                }
                const textarea = document.getElementById('pascal-editor-textarea') as HTMLTextAreaElement;
                if (textarea && textarea.value !== plainCode) {
                    const scrollTop = textarea.scrollTop;
                    const scrollLeft = textarea.scrollLeft;
                    const selectionStart = textarea.selectionStart;
                    const selectionEnd = textarea.selectionEnd;
                    textarea.value = plainCode;
                    textarea.scrollTop = scrollTop;
                    textarea.scrollLeft = scrollLeft;
                    textarea.selectionStart = selectionStart;
                    textarea.selectionEnd = selectionEnd;
                }
            } else {
                const content = document.getElementById('code-viewer-content');
                if (content) {
                    const highlightedCode = PascalHighlighter.highlight(plainCode);
                    content.innerHTML = `<pre style="margin: 0; white-space: pre; color: #d4d4d4;" translate="no">${highlightedCode}</pre>`;
                }
            }
        } catch (err) {
            console.error("[Editor] Failed to refresh Pascal view:", err);
        }
    }

    private bindSystemInfoEvents() {
        const updateSystemInfoObjects = () => {
            this.currentObjects.forEach(obj => {
                if (obj.constructor.name === 'TSystemInfo') {
                    (obj as any).refresh();
                }
            });
            // Re-render inspector if a TSystemInfo is currently selected
            if (this.jsonInspector && this.currentSelectedId) {
                const selectedObj = this.findObjectById(this.currentSelectedId);
                if (selectedObj) {
                    this.jsonInspector.update(selectedObj);
                }
            }
        };

        window.addEventListener('resize', updateSystemInfoObjects);
        window.addEventListener('online', updateSystemInfoObjects);
        window.addEventListener('offline', updateSystemInfoObjects);
    }

    // View State Getters for back-compatibility
    public get currentView(): ViewType { return this.viewManager.currentView; }
    public get pascalEditorMode(): boolean { return this.viewManager.pascalEditorMode; }
    public get useStageIsolatedView(): boolean { return this.viewManager.useStageIsolatedView; }
    public set useStageIsolatedView(v: boolean) { this.viewManager.useStageIsolatedView = v; }
    public get jsonMode(): 'viewer' | 'editor' { return this.viewManager.jsonMode; }
    public set jsonMode(v: 'viewer' | 'editor') { this.viewManager.jsonMode = v; }
    public get isProjectDirty(): boolean { return this.viewManager.isProjectDirty; }
    public set isProjectDirty(v: boolean) { this.viewManager.isProjectDirty = v; }

    /**
     * Prüft ob bereits ein Splashscreen existiert
     */
    private hasSplashStage(): boolean {
        if (!this.project.stages) return false;
        return this.project.stages.some(s => s.type === 'splash');
    }

    /**
     * Migriert Legacy-Projekte (objects/splashObjects) zum neuen stages-Array
     */

    /**
     * Erstellt eine neue Stage basierend auf einem Template
     */
    private async createStageFromTemplate(): Promise<void> {
        // Fetch templates from library
        const templates = libraryService.getTemplates();
        if (!templates || templates.length === 0) {
            alert('Keine Templates in der Library gefunden.');
            return;
        }

        // Prepare selection dialog
        const templateOptions = templates.map(t => ({ value: t.id, text: t.name }));

        // Show dialog
        try {
            const result = await serviceRegistry.call('Dialog', 'showDialog', ['template_selector', true, { templateIdOptions: templateOptions }]);

            if (result.action === 'select' && result.data.templateId) {
                const tplId = result.data.templateId;
                const template = libraryService.getTemplate(tplId);

                if (!template) return;

                // Create new stage based on template (Clone structure)
                const stageCount = this.project.stages!.length;
                const id = `stage - ${Date.now()} `;
                const name = `${template.name} ${stageCount + 1} `;

                // Helper to recursively regenerate IDs
                const regenerateIds = (objs: any[]): any[] => {
                    return objs.map(obj => {
                        const newObj = { ...obj };
                        // Generate new ID: preserve logic of name but make unique
                        if (newObj.id) {
                            // If it's a template ID (e.g. tpl_header_panel), keep base name but unique-ify
                            // Or just use name + random?
                            // Let's use: name + timestamp + random to be safe and readable
                            const baseName = newObj.name || newObj.id;
                            newObj.id = `${baseName}_${Date.now()}_${Math.floor(Math.random() * 1000)} `;
                        }

                        if (newObj.children && Array.isArray(newObj.children)) {
                            newObj.children = regenerateIds(newObj.children);
                        }
                        return newObj;
                    });
                };

                const clonedObjects = JSON.parse(JSON.stringify(template.objects || []));
                const uniqueObjects = regenerateIds(clonedObjects);

                const newStage: StageDefinition = {
                    id,
                    name,
                    type: 'standard',
                    objects: uniqueObjects,
                    grid: template.grid ? JSON.parse(JSON.stringify(template.grid)) : JSON.parse(JSON.stringify(this.project.stage.grid))
                };

                this.project.stages!.push(newStage);
                this.switchStage(id);
                this.updateStagesMenu();
                this.autoSaveToLocalStorage();

                console.log(`[Editor] Created stage from template: ${template.name} `);
            }
        } catch (e) {
            console.error('[Editor] Template selection failed:', e);
        }
    }

    /**
     * Setzt eine Stage als Hauptstage (exklusiv)
     */
    public setStageAsMain(stageId: string) {
        if (!this.project.stages) return;
        this.project.stages.forEach(s => {
            if (s.id === stageId) {
                s.type = 'main';
            } else if (s.type === 'main') {
                s.type = 'standard';
            }
        });
        this.updateStagesMenu();
        this.render();
        this.autoSaveToLocalStorage();
        // Update JSON/Pascal immediately
        this.refreshJSONView();
        this.refreshPascalView();
        console.log(`[Editor] Stage ${stageId} is now the Main Stage.`);
    }

    /**
     * Importiert eine globale Instanz eines Objekts aus einer anderen Stage
     */
    public importGlobalObject(id: string) {
        const activeStage = this.getActiveStage();
        if (!activeStage) return;

        // Check if already there
        if ((activeStage.objects || []).some(o => o.id === id)) {
            console.log(`[Editor] Object ${id} already in active stage.`);
            return;
        }

        // Find the global object anywhere in the project
        let globalObj: TWindow | null = null;
        for (const s of (this.project.stages || [])) {
            const found = (s.objects || []).find(o => o.id === id && o.scope === 'global');
            if (found) {
                globalObj = found;
                break;
            }
        }

        if (globalObj) {
            // Add reference
            if (!activeStage.objects) activeStage.objects = [];
            activeStage.objects.push(globalObj);
            this.render();
            this.autoSaveToLocalStorage();
            console.log(`[Editor] Imported global object ${globalObj.name} into stage ${activeStage.name}`);
        } else {
            console.warn(`[Editor] Could not find global object with ID ${id}`);
        }
    }

    /**
     * Saves the current active stage as a template.
     */
    private async saveStageAsTemplate() {
        const stage = this.getActiveStage();
        if (!stage) return;

        const name = stage.name;

        // Validation: Templates must have a name
        if (!name || name.trim() === '') {
            alert('Bitte gib der Stage zuerst einen Namen.');
            return;
        }

        // Check availability
        const existing = libraryService.getTemplates().find(t => t.name === name);
        if (existing) {
            if (!confirm(`Ein Template mit dem Namen "${name}" ist schon vorhanden.\nMöchten Sie es ersetzen ? `)) {
                return;
            }
        } else {
            if (!confirm(`Möchten Sie die aktuelle Stage als neues Template "${name}" speichern ? `)) {
                return;
            }
        }

        // Resolve all objects (merge inheritance) so the template is a complete snapshot
        // We temporarily treat it as if we need resolved objects for export
        const objectsToSave = this.getResolvedInheritanceObjects();

        // Create clean copies of objects (remove runtime properties if any, though JSON.stringify usually handles this)
        const cleanObjects = JSON.parse(JSON.stringify(objectsToSave));

        // Remove isInherited flag from template objects - they are now the definition!
        cleanObjects.forEach((o: any) => {
            delete o.isInherited;
        });

        const templateData = {
            id: name, // Use Name as ID for library templates
            name: name,
            description: `Template created from Stage '${name}'`,
            grid: stage.grid, // Preserve grid settings
            objects: cleanObjects,
            // metadata
            version: "1.0.0",
            created: Date.now()
        };

        // NOTE: We intentionally DO NOT include 'inheritsFrom'. 
        // A saved template becomes a new base.

        const success = await libraryService.saveTemplate(templateData);
        if (success) {
            alert(`Template "${name}" erfolgreich gespeichert!`);
            // Refresh library locally handled by service, triggers might needed?
            // Nothing explicitly needed if we stay on same page, but maybe refresh inspector options?
        } else {
            alert(`Fehler beim Speichern des Templates "${name}".Bitte Konsole prüfen.`);
        }
    }

    /**
     * Erstellt eine neue Stage
     */
    private createStage(type: StageType): void {
        // Stelle sicher dass stages-Array existiert
        if (!this.project.stages) {
            this.migrateToStages();
        }

        // Nur ein Splash erlaubt
        if (type === 'splash' && this.hasSplashStage()) {
            alert('Es existiert bereits ein Splashscreen. Pro Projekt ist nur ein Splashscreen erlaubt.');
            return;
        }

        // Generiere eindeutige ID
        const stageCount = this.project.stages!.filter(s => s.type === type).length;
        const id = type === 'splash' ? 'splash' : `stage - ${Date.now()} `;
        const name = type === 'splash' ? 'Splash' : `Stage ${stageCount + 1} `;

        const newStage: StageDefinition = {
            id,
            name,
            type,
            objects: [],
            grid: JSON.parse(JSON.stringify(this.project.stage.grid)) // Aktuelles Grid kopieren
        };

        // Splash-spezifische Properties
        if (type === 'splash') {
            newStage.duration = 3000;
            newStage.autoHide = true;
        }

        // Splash immer an erster Stelle, sonst am Ende
        if (type === 'splash') {
            this.project.stages!.unshift(newStage);
        } else {
            this.project.stages!.push(newStage);
        }

        // Zur neuen Stage wechseln
        this.switchStage(id);

        // Menü aktualisieren
        this.updateStagesMenu();

        console.log(`[Editor] Neue ${type} -Stage erstellt: ${name} `);
        this.autoSaveToLocalStorage();
    }

    /**
     * Wechselt zur angegebenen Stage
     */
    private switchStage(stageId: string): void {
        if (!this.project.stages) {
            this.migrateToStages();
        }

        const stage = this.project.stages!.find(s => s.id === stageId);
        if (!stage) {
            console.warn(`[Editor] Stage nicht gefunden: ${stageId} `);
            return;
        }

        // Aktive Stage setzen
        this.project.activeStageId = stageId;
        projectRegistry.setActiveStageId(stageId);
        this.stage.isBlueprint = stage.type === 'blueprint';

        // Update flow editor dropdown to reflect new stage context
        if (this.flowEditor) {
            this.flowEditor.updateFlowSelector();
        }

        // Stage-spezifisches Grid anwenden
        if (stage.grid) {
            this.stage.grid = stage.grid;
        }


        // Deselect current
        this.selectObject(null);
        this.render();

        // Menü aktualisieren
        this.updateStagesMenu();

        // Zur visuellen Stage-Bearbeitung wechseln
        this.switchView('stage');

        console.log(`[Editor] Gewechselt zu Stage: ${stage.name} (${stage.type})`);
        this.autoSaveToLocalStorage();
    }

    /**
     * Löscht die aktuell aktive Stage
     */
    private deleteCurrentStage(): void {
        if (!this.project.stages || this.project.stages.length <= 1) {
            alert('Die letzte Stage kann nicht gelöscht werden.');
            return;
        }

        const activeStage = this.getActiveStage();
        if (!activeStage) return;

        const confirmMsg = activeStage.type === 'splash'
            ? 'Splashscreen wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.'
            : `Stage "${activeStage.name}" wirklich löschen ? Diese Aktion kann nicht rückgängig gemacht werden.`;

        if (!confirm(confirmMsg)) return;

        // Stage entfernen
        const index = this.project.stages.findIndex(s => s.id === activeStage.id);
        this.project.stages.splice(index, 1);

        // Zur ersten verbleibenden Stage wechseln
        this.switchStage(this.project.stages[0].id);

        // Menü aktualisieren
        this.updateStagesMenu();

        console.log(`[Editor] Stage gelöscht: ${activeStage.name} `);
        this.autoSaveToLocalStorage();
    }

    /**
     * Resolves objects from inheritance chain for editor display.
     * Inherited objects are marked with isInherited: true to allow the stage to render them as ghosts.
     */
    private getResolvedInheritanceObjects(): any[] {
        const activeStage = this.getActiveStage();
        const mergedMap = new Map<string, any>();

        // 1. Start with Project Level Globals (References!)
        const rootGlobals = [
            ...(this.project.objects || []).filter(obj => (obj as any).scope === 'global'),
            ...(this.project.variables || []).filter(v => (v as any).scope === 'global') as unknown as any[]
        ];

        rootGlobals.forEach(obj => {
            mergedMap.set(obj.id || obj.name, obj);
        });

        if (!activeStage) return Array.from(mergedMap.values());

        // 2. Resolve Inheritance Chain (if any)
        const chain: StageDefinition[] = [];
        let curr: StageDefinition | undefined = activeStage;
        const seen = new Set<string>();
        while (curr) {
            if (seen.has(curr.id)) break;
            seen.add(curr.id);
            chain.push(curr);
            const parentId: string | undefined = curr.inheritsFrom;
            curr = parentId ? (this.project.stages || []).find(s => s.id === parentId) : undefined;
        }

        // bottom-up merge: start from most distant ancestor so children can override
        for (let i = chain.length - 1; i >= 0; i--) {
            const s = chain[i];
            const isTopLevel = (i === 0);

            // Merge BOTH objects and variables from this stage
            const combined = [
                ...(s.objects || []),
                ...(s.variables || []) as unknown as any[]
            ];

            combined.forEach(obj => {
                if (isTopLevel) {
                    // Current Stage objects: Use Reference
                    mergedMap.set(obj.id || obj.name, obj);
                } else {
                    // Inherited objects: Clone and mark as ghost
                    const copy = JSON.parse(JSON.stringify(obj));
                    (copy as any).isInherited = true;
                    mergedMap.set(obj.id || obj.name, copy);
                }
            });
        }
        return Array.from(mergedMap.values());
    }

    private updateStagesMenu(): void {
        if (!this.menuBar || !this.project.stages) return;

        const stageItems = [
            {
                id: 'new-stage',
                label: 'Neue Stage',
                action: 'new-stage',
                icon: '📄'
            },
            {
                id: 'new-splash',
                label: 'Neuer Splashscreen',
                action: 'new-splash',
                icon: '🚀'
            },
            {
                id: 'new-from-template',
                label: 'Neu aus Template...',
                action: 'new-from-template',
                icon: '📋'
            },


            {
                id: 'delete-stage',
                label: 'Stage löschen',
                action: 'delete-stage',
                icon: '🗑️'
            },
            {
                id: 'save-as-template',
                label: 'Als Template speichern',
                action: 'save-as-template',
                icon: '💾'
            },
            {
                id: 'separator',
                label: '----------------',
                action: 'separator'
            }
        ];

        // Alle vorhandenen Stages hinzufügen
        this.project.stages.forEach(stage => {
            const isActive = stage.id === this.project.activeStageId;
            let typeLabel = 'Standard';
            if (stage.type === 'splash') typeLabel = 'Splash';
            else if (stage.type === 'main') typeLabel = 'Haupt';
            else if (stage.type === 'template') typeLabel = 'Template';

            let icon = '📄';
            if (stage.type === 'splash') icon = '🚀';
            else if (stage.type === 'main') icon = '👑';
            else if (stage.type === 'template') icon = '🧩';

            stageItems.push({
                id: `stage - ${stage.id} `,
                label: `${isActive ? '▶ ' : ''}${stage.name} (${typeLabel})`,
                action: `switch-stage - ${stage.id}`,
                icon: icon
            });
        });

        // "Neuer Splashscreen" deaktivieren/verbergen wenn bereits vorhanden
        const hasSplash = this.hasSplashStage();
        if (hasSplash) {
            const splashIdx = stageItems.findIndex(i => i.id === 'new-splash');
            if (splashIdx !== -1) {
                stageItems.splice(splashIdx, 1);
            }
        }

        this.menuBar.updateMenu('stages', stageItems);
    }

    private async renderFlowDiagram(container: HTMLElement) {
        // Generate separate diagrams for each event flow
        const flows = FlowDiagramGenerator.generate(this.project);
        console.log('Generated flows:', flows);

        // Initialize Mermaid
        mermaid.initialize({ startOnLoad: false, theme: 'dark' });

        // Clear container
        container.innerHTML = '';

        // Add options toolbar
        const toolbar = document.createElement('div');
        toolbar.style.cssText = 'padding: 12px; background: #1e1e1e; border-bottom: 1px solid #3a3a3a; margin-bottom: 16px; display: flex; align-items: center; gap: 16px;';

        // Toggle for action details
        const detailsLabel = document.createElement('label');
        detailsLabel.style.cssText = 'display: flex; align-items: center; gap: 8px; cursor: pointer; color: #ccc; font-size: 13px;';
        const detailsCheckbox = document.createElement('input');
        detailsCheckbox.type = 'checkbox';
        detailsCheckbox.checked = FlowDiagramGenerator.showActionDetails;
        detailsCheckbox.style.cursor = 'pointer';
        detailsCheckbox.onchange = () => {
            FlowDiagramGenerator.showActionDetails = detailsCheckbox.checked;
            this.renderFlowDiagram(container);
        };
        detailsLabel.appendChild(detailsCheckbox);
        detailsLabel.appendChild(document.createTextNode('Action-Details anzeigen'));
        toolbar.appendChild(detailsLabel);

        container.appendChild(toolbar);

        // Render each flow as a separate section
        for (let i = 0; i < flows.length; i++) {
            const flow = flows[i];

            // Create section container
            const section = document.createElement('div');
            section.className = 'flow-section';
            section.style.marginBottom = '2rem';
            section.style.padding = '1.5rem';
            section.style.backgroundColor = '#2a2a2a';
            section.style.borderRadius = '8px';
            section.style.border = '1px solid #3a3a3a';

            // Actor/Trigger info (above diagram)
            const actorInfo = document.createElement('div');
            actorInfo.style.marginBottom = '1rem';
            actorInfo.style.padding = '0.75rem';
            actorInfo.style.backgroundColor = '#1e1e1e';
            actorInfo.style.borderRadius = '4px';
            actorInfo.style.borderLeft = '3px solid #4fc3f7';
            actorInfo.innerHTML = `
    < div style = "font-size: 0.85rem; color: #888;" > Auslöser </div>
        < div style = "font-size: 1.1rem; color: #fff; font-weight: bold;" >
            <span style="color: #81c784;" > ${flow.actorType} </span>: ${flow.actorName}
                < span style = "color: #4fc3f7; margin-left: 0.5rem;" >→ ${flow.eventName} </span>
                    </div>
                        `;
            section.appendChild(actorInfo);

            // Render diagram
            const diagramDiv = document.createElement('div');
            diagramDiv.style.overflowX = 'auto';
            diagramDiv.style.padding = '1rem 0';
            try {
                const { svg } = await mermaid.render(`flow - diagram - ${i} `, flow.mermaidSyntax);
                diagramDiv.innerHTML = svg;
            } catch (error) {
                console.error(`Error rendering ${flow.eventName}: `, error);
                diagramDiv.innerHTML = `< pre style = "color: red;" > Error: ${error} \n\n${flow.mermaidSyntax} </pre>`;
            }
            section.appendChild(diagramDiv);

            // Description (below diagram)
            const descDiv = document.createElement('div');
            descDiv.style.marginTop = '1rem';
            descDiv.style.padding = '0.75rem';
            descDiv.style.backgroundColor = '#1e1e1e';
            descDiv.style.borderRadius = '4px';
            descDiv.style.color = '#aaa';
            descDiv.style.fontSize = '0.9rem';
            descDiv.style.lineHeight = '1.5';
            descDiv.innerHTML = `
                <div style="margin-bottom: 0.5rem;">${flow.description}</div>
                <div style="font-size: 0.8rem; color: #666;">
                    <span style="color: #888;">Beteiligte Objekte:</span> 
                    ${flow.involvedObjects.map(o => `<span style="color: #ffb74d; background: #3a3a3a; padding: 2px 6px; border-radius: 3px; margin-left: 4px;">${o}</span>`).join('')}
                </div>
            `;
            section.appendChild(descDiv);

            container.appendChild(section);
        }

        // If no flows, show message
        if (flows.length === 0) {
            container.innerHTML = '<p style="color: #888;">Keine Event-Flows gefunden. Lade ein Projekt mit Tasks.</p>';
        }
    }

    // Helper to trigger hidden file input from Toolbox button
    private async triggerLoad() {
        try {
            const json = await projectPersistenceService.triggerLoad();
            if (json) {
                this.loadProject(json);
            }
        } catch (err) {
            alert("Error loading project: " + err);
        }
    }

    private async saveProject() {
        if (this.flowEditor) {
            this.flowEditor.syncToProject();
            this.flowEditor.syncAllTasksFromFlow(this.project);
        }

        this.syncStageObjectsToProject();

        await projectPersistenceService.saveProject(this.project);
        alert('Projekt erfolgreich gespeichert!');
    }

    private async exportHTML() {
        if (this.flowEditor) this.flowEditor.syncAllTasksFromFlow(this.project);
        this.syncStageObjectsToProject();
        await projectPersistenceService.exportHTML(this.project);
    }

    private async exportJSON() {
        if (this.flowEditor) this.flowEditor.syncAllTasksFromFlow(this.project);
        this.syncStageObjectsToProject();
        await projectPersistenceService.exportJSON(this.project);
    }

    private async exportHTMLCompressed() {
        if (this.flowEditor) this.flowEditor.syncAllTasksFromFlow(this.project);
        this.syncStageObjectsToProject();
        await projectPersistenceService.exportHTMLCompressed(this.project);
    }

    private async exportJSONCompressed() {
        if (this.flowEditor) this.flowEditor.syncAllTasksFromFlow(this.project);
        this.syncStageObjectsToProject();
        await projectPersistenceService.exportJSONCompressed(this.project);
    }

    private loadProject(data: any) {
        if (!data) return;

        // CLEAR old LocalStorage before loading new project
        localStorage.removeItem('gcs_last_project');
        console.log('[Editor] LocalStorage cleared for fresh project load');

        // Clean up data artifacts before loading
        RefactoringManager.cleanActionSequences(data);

        // Metadata wiederherstellen
        if (data.meta) this.project.meta = data.meta;
        if (data.stage && data.stage.grid) this.project.stage.grid = data.stage.grid;

        // Cleanup korrupter Task-Daten
        if (this.flowEditor) {
            this.flowEditor.cleanCorruptTaskData();
        }

        // Actions, Tasks, Variables
        this.project.actions = data.actions || [];
        this.project.tasks = data.tasks || [];
        this.project.variables = data.variables || [];

        // Restore Flow Data
        if (data.flowCharts) {
            this.project.flowCharts = data.flowCharts;
            const flowCharts = data.flowCharts as any;
            if (flowCharts.global) {
                this.project.flow = flowCharts.global;
            }
        } else if (data.flow) {
            this.project.flow = data.flow;
            this.project.flowCharts = { global: data.flow };
        } else {
            // Standard-Flow falls nichts vorhanden
            const defaultGrid = {
                cols: 100,
                rows: 100,
                cellSize: 20,
                snapToGrid: true,
                visible: true,
                backgroundColor: '#1e1e1e'
            };
            this.project.flow = {
                stage: defaultGrid,
                elements: [],
                connections: []
            };
            this.project.flowCharts = { global: this.project.flow };
        }

        // Restore Stages (New System)
        if (data.stages && data.stages.length > 0) {
            const hydratedStages = data.stages.map((s: any) => {
                return {
                    ...s,
                    objects: hydrateObjects(s.objects || []),
                    variables: hydrateObjects(s.variables || []) as any
                };
            });
            this.project.stages = hydratedStages;
            this.project.activeStageId = data.activeStageId || hydratedStages[0].id;
            projectRegistry.setActiveStageId(this.project.activeStageId || null);
        }

        // Restore Objects (Legacy System)
        this.project.objects = hydrateObjects(data.objects || []);
        this.project.variables = hydrateObjects(data.variables || []) as any;
        this.project.splashObjects = hydrateObjects(data.splashObjects || []);
        this.project.splashDuration = data.splashDuration ?? 3000;
        this.project.splashAutoHide = data.splashAutoHide ?? true;

        // Migration falls nötig (wenn keine Stages im geladenen Projekt waren)
        if (!this.project.stages || this.project.stages.length === 0) {
            this.migrateToStages();
        }

        // Sicherstellen, dass jede Stage ein eigenes Grid-Objekt hat (Deep Copy)
        if (this.project.stages) {
            this.project.stages.forEach(s => {
                if (!s.grid) {
                    s.grid = JSON.parse(JSON.stringify(this.project.stage.grid));
                }
            });
        }

        // Sync UI
        if (this.jsonInspector) this.jsonInspector.setProject(this.project);
        if (this.dialogManager) this.dialogManager.setProject(this.project);

        // Stage-spezifisches Grid anwenden
        const activeStage = this.project.stages?.find(s => s.id === this.project.activeStageId);
        if (activeStage && activeStage.grid) {
            this.stage.grid = activeStage.grid;
            this.stage.isBlueprint = activeStage.type === 'blueprint';
        } else {
            this.stage.grid = this.project.stage.grid;
            this.stage.isBlueprint = false;
        }

        if (this.flowEditor) this.flowEditor.setProject(this.project);
        projectRegistry.setProject(this.project);

        // Sanitize project
        RefactoringManager.sanitizeProject(this.project);

        this.render();
        this.selectObject(null);
        this.updateStagesMenu(); // WICHTIG: Menü aktualisieren
        this.switchView('stage'); // Zur visuellen Bearbeitung wechseln

        console.log("[Editor] Projekt geladen und Stages initialisiert", this.project);
        this.autoSaveToLocalStorage();

        // Show success notification
        setTimeout(() => {
            const toast = this.project?.objects.find(o => (o as any).className === 'TToast') as any;
            if (toast && typeof toast.success === 'function') {
                toast.success('Projekt geladen und im Browser gespeichert.');
            } else {
                console.log('%c[Editor] Project loaded & persisted to LocalStorage', 'color: #4caf50; font-weight: bold;');
            }
        }, 500);
    }




    private init() {
        console.log("Editor initialized", this.project);
        console.log("Components:", this.jsonToolbox, this.stage);

        this.stage.onDropCallback = (type, gridX, gridY) => {
            this.addObject(type, gridX, gridY);
        };

        this.stage.onSelectCallback = (ids) => {
            // Multi-selection: select the first ID as primary for inspector
            if (ids.length > 0) {
                this.selectObject(ids[0]);
                console.log(`[Editor] Selected ${ids.length} object(s):`, ids);
            } else {
                this.selectObject(null);
            }

            // Notify Mediator about selection change
            const selectedObj = ids.length > 0 ? this.findObjectById(ids[0]) : null;
            mediatorService.notifyObjectSelected(selectedObj);
        };

        this.stage.onObjectMove = (id, newX, newY) => {
            if (this.stage.runMode) {
                // Runtime Mode: Update runtime object only (reactive)
                if (this.runtimeObjects) {
                    const runtimeObj = this.runtimeObjects.find(ro => ro.id === id);
                    if (runtimeObj) {
                        runtimeObj.x = newX;
                        runtimeObj.y = newY;
                    }
                }
                return;
            }

            const obj = this.findObjectById(id);
            if (obj) {
                // Check if this object is a child of a container
                const parent = this.findParentContainer(id);
                if (parent) {
                    // Calculate relative coordinates within parent
                    // Account for title bar offset (30px converted to grid units)
                    const titleBarOffset = Math.round(30 / this.project.stage.grid.cellSize);
                    const relX = newX - parent.x;
                    const relY = newY - parent.y - titleBarOffset;
                    obj.x = Math.max(0, relX);
                    obj.y = Math.max(0, relY);
                    console.log(`[Editor] Moved child ${obj.name} to relative (${obj.x}, ${obj.y}) within ${parent.name}`);
                } else {
                    // Root level object - use absolute coordinates
                    obj.x = newX;
                    obj.y = newY;
                }
                if (this.jsonInspector) this.jsonInspector.update(obj);
                this.render();
                this.autoSaveToLocalStorage();

                // Notify Mediator about data change (debounced move)
                mediatorService.notifyDataChanged({ object: obj, property: 'position', type: 'move' });
            }
        };

        this.stage.onObjectResize = (id, newWidth, newHeight) => {
            const obj = this.findObjectById(id);
            if (obj) {
                obj.width = newWidth;
                obj.height = newHeight;
                if (this.jsonInspector) this.jsonInspector.update(obj);
                this.render();
                this.autoSaveToLocalStorage();

                // Notify Mediator about data change (debounced resize)
                mediatorService.notifyDataChanged({ object: obj, property: 'size', type: 'resize' });
            }
        };

        // Copy callback - return a deep clone of the object
        this.stage.onCopyCallback = (id) => {
            const obj = this.findObjectById(id);
            if (!obj) return null;

            // Deep clone the object
            const clone = JSON.parse(JSON.stringify(obj));
            // Generate new ID and name
            clone.id = crypto.randomUUID();
            clone.name = `${obj.name}_copy`;
            return clone;
        };

        // onDragStart: Runtime Event
        this.stage.onDragStart = (id) => {
            if (this.stage.runMode && !changeRecorder.isApplyingAction) {
                // Determine if we should record or just handle
                // For tutorials/undo we might record drag end position later
                this.runtime?.handleEvent(id, 'onDragStart');
            }
        };

        this.stage.onObjectCopy = (id, x, y) => {
            if (this.stage.runMode) {
                // Runtime Drop & Clone Logic (GCS-Style)
                const original = this.runtimeObjects?.find(o => o.id === id);
                if (!original) return;

                // 1. Calculate drop rect (Model-based)
                // x, y are grid coords from Stage.
                // Assuming objects interact on Grid or Pixel level?
                // lastRenderedObjects used pixels for AABB.
                // Here we have grid coords x,y from Stage.

                // Convert grid to pixels for AABB check
                const grid = this.project.stage?.grid || (this.project as any).grid;
                const cellSize = grid?.cellSize || 20;

                const dropRect = {
                    left: x * cellSize,
                    top: y * cellSize,
                    right: (x * cellSize) + (original.width || 100),
                    bottom: (y * cellSize) + (original.height || 100)
                };

                let dropTarget: any = null;

                // 2. Collision Check against Droppables
                // Iterate runtimeObjects
                if (this.runtimeObjects) {
                    for (const target of this.runtimeObjects) {
                        // Skip self and non-droppables
                        if (target.id === id || !target.droppable) continue;

                        // Target Rect
                        const tRect = {
                            left: target.x * cellSize,
                            top: target.y * cellSize,
                            right: (target.x * cellSize) + (target.width || 100),
                            bottom: (target.y * cellSize) + (target.height || 100)
                        };

                        // AABB Intersection
                        const intersects = !(
                            dropRect.right < tRect.left ||
                            dropRect.left > tRect.right ||
                            dropRect.bottom < tRect.top ||
                            dropRect.top > tRect.bottom
                        );

                        if (intersects) {
                            dropTarget = target;
                            break; // First match wins strategy
                        }
                    }
                }

                if (dropTarget) {
                    // Success!
                    console.log(`[Editor] Drop success on target: ${dropTarget.name}`);

                    // 3. Create Clone & Snap
                    const clone = JSON.parse(JSON.stringify(original));
                    clone.id = crypto.randomUUID();
                    clone.name = `${original.name}_copy_${Date.now()}`;
                    // Snap to Target Position
                    clone.x = dropTarget.x;
                    clone.y = dropTarget.y;

                    this.runtimeObjects?.push(clone);

                    // 4. Fire Events
                    // onDrop (Target)
                    this.runtime?.handleEvent(dropTarget.id, 'onDrop', {
                        sourceId: original.id,
                        cloneId: clone.id
                    });

                    // onDragEnd (Source) - Success
                    this.runtime?.handleEvent(original.id, 'onDragEnd', {
                        targetId: dropTarget.id,
                        success: true,
                        cloneId: clone.id
                    });

                    this.render();

                } else {
                    // Fail
                    console.log(`[Editor] Drop failed: No target hit.`);
                    // onDragEnd (Source) - Fail
                    this.runtime?.handleEvent(original.id, 'onDragEnd', {
                        targetId: null,
                        success: false,
                        cloneId: null
                    });
                }
            }
        };

        // Paste callback - add cloned object at position
        this.stage.onPasteCallback = (jsonObj, x, y) => {
            if (!jsonObj) return null;

            // Determine type from className (usually removes the leading 'T')
            let type = jsonObj.className;
            if (type && type.startsWith('T')) {
                type = type.substring(1);
            }

            // Create fresh instance with correct methods/prototype
            const newObj = this.createObjectInstance(type, jsonObj.name, x, y);
            if (!newObj) {
                console.error(`[Editor] Failed to hydrate object of type ${type}`);
                return null;
            }

            // Copy all properties from the clone into the fresh instance
            Object.assign(newObj, jsonObj);

            // Ensure the position and ID are exactly what we want
            newObj.x = x;
            newObj.y = y;
            newObj.id = jsonObj.id;

            const list = this.currentObjects;
            list.push(newObj);
            this.currentObjects = list;

            // Select the new object
            this.selectObject(newObj.id);
            this.render();
            this.autoSaveToLocalStorage();

            console.log(`[Editor] Hydrated and pasted object ${newObj.name} at (${x}, ${y})`);
            return newObj.id;
        };

        // JSONInspector handles updates via callbacks passed during initialization

        this.render();
        // Select project by default
        this.selectObject(null);

        // Initialize Undo/Redo keyboard shortcuts
        this.initKeyboardShortcuts();

        // Initialize Playback UI (hidden by default)
        this.playbackControls = new PlaybackControls(document.body);
        this.playbackOverlay = new PlaybackOverlay(document.getElementById('stage-container') || document.body);
    }

    /**
     * Initialisiert Keyboard-Shortcuts für Undo/Redo
     */
    private initKeyboardShortcuts(): void {
        document.addEventListener('keydown', (e) => {
            // Ignoriere wenn in einem Input-Feld
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            // Strg+Z = Undo (Rewind)
            if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.handleRewind();
            }

            // Strg+Y oder Strg+Shift+Z = Redo (Forward)
            if (e.ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                this.handleForward();
            }
        });

        console.log('[Editor] Keyboard shortcuts initialized (Strg+Z/Y for Undo/Redo)');
    }

    /**
     * Führt Undo aus (Strg+Z)
     */
    private handleRewind(): void {
        const action = changeRecorder.rewind();
        if (action) {
            this.applyRecordedAction(action, 'rewind');
        } else {
            console.log('[Editor] Nothing to undo');
        }
    }

    /**
     * Führt Redo aus (Strg+Y)
     */
    private handleForward(): void {
        const action = changeRecorder.forward();
        if (action) {
            this.applyRecordedAction(action, 'forward');
        } else {
            console.log('[Editor] Nothing to redo');
        }
    }

    /**
     * Wendet eine aufgezeichnete Aktion an (für Undo/Redo)
     */
    private applyRecordedAction(action: RecordedAction, direction: 'rewind' | 'forward'): void {
        changeRecorder.beginApplyAction();

        try {
            switch (action.type) {
                case 'property':
                    this.applyPropertyChange(action, direction);
                    break;

                case 'drag':
                    this.applyDragChange(action, direction);
                    break;

                case 'batch':
                    // Batch-Aktionen: Alle Kinder einzeln anwenden
                    if (action.children) {
                        const children = direction === 'rewind'
                            ? [...action.children].reverse()
                            : action.children;
                        for (const child of children) {
                            this.applyRecordedAction(child, direction);
                        }
                    }
                    break;

                case 'create':
                    if (direction === 'rewind') {
                        // Undo Create = Delete
                        if (action.objectId) {
                            this.removeObjectSilent(action.objectId);
                        }
                    } else {
                        // Redo Create = Recreate
                        if (action.objectData) {
                            this.recreateObject(action.objectData);
                        }
                    }
                    break;

                case 'delete':
                    if (direction === 'rewind') {
                        // Undo Delete = Recreate
                        if (action.objectData) {
                            this.recreateObject(action.objectData);
                        }
                    } else {
                        // Redo Delete = Delete again
                        if (action.objectId) {
                            this.removeObjectSilent(action.objectId);
                        }
                    }
                    break;
            }

            this.render();
            this.autoSaveToLocalStorage();
            console.log(`[Editor] Applied ${direction}: ${action.description}`);

        } finally {
            changeRecorder.endApplyAction();
        }
    }

    /**
     * Wendet Property-Änderung an
     */
    private applyPropertyChange(action: RecordedAction, direction: 'rewind' | 'forward'): void {
        if (!action.objectId || !action.property) return;

        const value = direction === 'rewind' ? action.oldValue : action.newValue;

        // Object finden
        const obj = this.findObjectById(action.objectId);
        if (obj) {
            this.setNestedProperty(obj, action.property, value);
            if (this.jsonInspector) {
                this.jsonInspector.update(obj);
            }
            return;
        }

        // Action/Task/Variable suchen
        // TODO: Erweitern für andere ObjectTypes
    }

    /**
     * Wendet Drag-Änderung an
     */
    private applyDragChange(action: RecordedAction, direction: 'rewind' | 'forward'): void {
        if (!action.objectId) return;

        const position = direction === 'rewind' ? action.startPosition : action.endPosition;
        if (!position) return;

        const obj = this.findObjectById(action.objectId);
        if (obj) {
            obj.x = position.x;
            obj.y = position.y;
            if (this.jsonInspector) {
                this.jsonInspector.update(obj);
            }
        }
    }

    /**
     * Erstellt ein Objekt neu (für Undo Delete / Redo Create)
     */
    private recreateObject(objectData: any): void {
        const list = this.currentObjects;
        // Hydrate the object
        const hydrated = hydrateObjects([objectData]);
        if (hydrated.length > 0) {
            list.push(hydrated[0]);
            this.currentObjects = list;
        }
    }

    /**
     * Setzt eine verschachtelte Property (z.B. "style.backgroundColor")
     */
    private setNestedProperty(obj: any, path: string, value: any): void {
        const parts = path.split('.');
        let current = obj;

        for (let i = 0; i < parts.length - 1; i++) {
            if (current[parts[i]] === undefined) {
                current[parts[i]] = {};
            }
            current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = value;
    }

    public restoreStageEventHandler() {
        if (this.stage) {
            this.stage.onEvent = (id, eventName, data) => this.handleEvent(id, eventName, data);
        }
    }

    private handleEvent(id: string, eventName: string, data?: any) {
        // Handle delete event specially
        if (eventName === 'delete') {
            this.removeObject(id);
            this.selectObject(null); // Deselect
            this.render();
            this.autoSaveToLocalStorage();
            return;
        }

        // Handle multi-delete event
        if (eventName === 'deleteMultiple' && Array.isArray(data)) {
            console.log(`[Editor] Deleting ${data.length} objects:`, data);
            if (!changeRecorder.isApplyingAction) {
                changeRecorder.startBatch(`${data.length} Objekte gelöscht`);
            }
            data.forEach((objId: string) => {
                this.removeObject(objId);
            });
            if (!changeRecorder.isApplyingAction) {
                changeRecorder.endBatch();
            }
            this.selectObject(null);
            this.render();
            this.autoSaveToLocalStorage();
            return;
        }

        if (!this.runtime) {
            // In editor mode, some events should trigger an immediate save
            if (eventName === 'move' || eventName === 'resize' || eventName === 'propertyChange') {
                this.autoSaveToLocalStorage();
            }
            return;
        }

        this.runtime.handleEvent(id, eventName, data);
        this.render();

        // Also save if property changed via runtime interaction (rare in editor but possible)
        if (eventName === 'propertyChange') {
            this.autoSaveToLocalStorage();
        }
    }

    public refreshAllViews(originator?: string): void {
        console.log('[Editor] Refreshing all views (Trinity-Sync)...');
        this.render();
        this.updateAvailableActions();
        this.refreshJSONView();

        if (this.flowEditor && this.currentView === 'flow' && originator !== 'flow-editor') {
            this.flowEditor.setProject(this.project);
            this.flowEditor.show();
        }

        if (this.jsonInspector && this.currentSelectedId) {
            const obj = this.findObjectById(this.currentSelectedId);
            this.jsonInspector.update(obj || this.project);
        }

        this.autoSaveToLocalStorage();
    }

    /**
     * Prompts the user to apply changes and updates the permanent project state
     */
    public applyJSONChanges(): void {
        const confirmed = confirm('Möchten Sie die Änderungen am Projekt wirklich übernehmen? Dies kann nicht rückgängig gemacht werden und wird sofort wirksam.');
        if (confirmed && this.workingProjectData) {
            // Apply sync to project before loading back
            this.syncFlowChartsWithActions();

            this.loadProject(safeDeepCopy(this.workingProjectData));
            this.isProjectDirty = false;
            this.refreshJSONView(); // Hide apply button

            // Notify Mediator that project data has changed via JSON Editor
            mediatorService.notifyDataChanged(this.project, 'json-editor');
        }
    }



    /**
     * Updates the 'availableActions' variable in JSONInspector based on the active stage.
     * Filters out actions that belong to objects in other stages, keeping only:
     * 1. Actions for objects in the current stage.
     * 2. Global service actions (not belonging to any stage object).
     */
    private updateAvailableActions(): void {
        if (!this.jsonInspector || !this.project || !this.project.actions) return;

        const activeStage = this.getActiveStage();
        const activeStageId = activeStage ? activeStage.id : null;

        // Map ObjectName -> StageId for all objects in the project
        const objectStageMap = new Map<string, string>();

        if (this.project.stages) {
            this.project.stages.forEach(stage => {
                if (stage.objects) {
                    stage.objects.forEach((obj: any) => {
                        objectStageMap.set(obj.name, stage.id);
                    });
                }
            });
        }

        // Also map objects from legacy 'this.project.objects' if not migrated yet (safety)
        if (this.project.objects) {
            this.project.objects.forEach((obj: any) => {
                // Assume legacy objects are MainStage if not found
                if (!objectStageMap.has(obj.name)) {
                    // Use a placeholder ID for legacy/global objects not in stages array
                    objectStageMap.set(obj.name, 'legacy_main');
                }
            });
        }

        const allActions = this.project.actions;
        const filteredActions = allActions.filter(action => {
            const actionName = action.name;
            if (!actionName) return false;

            // Heuristic: Action name is "Target.Method"
            const dotIndex = actionName.indexOf('.');
            if (dotIndex !== -1) {
                const targetName = actionName.substring(0, dotIndex);

                // If target is a known object
                if (objectStageMap.has(targetName)) {
                    const targetStageId = objectStageMap.get(targetName);

                    // If we have an active stage, compare IDs
                    if (activeStageId) {
                        // Allow if object is in current stage
                        if (targetStageId === activeStageId) return true;

                        // HIDE if object is in a DIFFERENT stage
                        return false;
                    }
                }
            }

            // If target is NOT a known stage object, assume it is a Global Service (e.g. StageController) -> Show it
            return true;
        });

        // Update the inspector variable
        const visibleActionNames = filteredActions.map(a => a.name);
        this.jsonInspector.updateAvailableActions(visibleActionNames);
        console.log(`[Editor] Context-Aware Actions: Showing ${visibleActionNames.length} of ${allActions.length} actions for stage '${activeStage?.name}'`);
    }

    /**
     * Synchronisiert FlowChart-Element-Daten mit den aktuellen Action-Definitionen.
     * Dies stellt sicher, dass Änderungen im JSON-Editor auch in den FlowCharts übernommen werden.
     */
    private syncFlowChartsWithActions(): void {
        if (!this.project?.flowCharts || !this.project?.actions) return;

        let syncCount = 0;

        Object.keys(this.project.flowCharts).forEach(chartKey => {
            const chart = this.project!.flowCharts![chartKey];
            if (!chart?.elements) return;

            chart.elements.forEach((el: any) => {
                if (el.type !== 'Action') return;

                const actionName = el.properties?.name || el.data?.name;
                if (!actionName) return;

                const projectAction = this.project!.actions.find(a => a.name === actionName);
                if (projectAction) {
                    // Preserve node-specific properties
                    const preserveKeys = ['isEmbeddedInternal', 'parentProxyId', 'parentParams', 'showDetails', 'originalId'];
                    const preserved: any = {};
                    preserveKeys.forEach(key => {
                        if (el.data?.[key] !== undefined) preserved[key] = el.data[key];
                    });

                    el.data = { ...projectAction, ...preserved };
                    syncCount++;
                }
            });
        });
    }

    /**
     * Initializes the horizontal component palette
     */
    private async initComponentPalette(): Promise<void> {
        try {
            this.componentPalette = new JSONComponentPalette('horizontal-toolbar', 'horizontal-palette');

            // Register action handlers
            this.componentPalette.registerAction('save', () => this.saveProject());
            this.componentPalette.registerAction('load', () => this.triggerLoad());
            this.componentPalette.registerAction('export', () => this.exportHTML());
            this.componentPalette.registerAction('multiplayer', () => this.startMultiplayer());
            this.componentPalette.registerAction('start', () => this.switchView('run'));
            this.componentPalette.registerAction('stop', () => this.switchView('stage'));
            this.componentPalette.registerAction('toggleLayout', () => this.toggleToolboxLayout());

            const response = await fetch('./editor/toolbox_horizontal.json');
            const paletteJSON = await response.json();
            await this.componentPalette.loadFromJSON(paletteJSON);

            // Palette toggle button removed - now using only JSON-based layout

            console.log('[Editor] JSONComponentPalette initialized');
        } catch (error) {
            console.error('[Editor] Failed to initialize JSONComponentPalette:', error);
        }
    }

    /**
     * Toggles between vertical sidebar and horizontal header toolbox
     */
    private toggleToolboxLayout(): void {
        this.useHorizontalToolbox = !this.useHorizontalToolbox;

        const editorContainer = document.getElementById('editor-container');
        const toolboxPanel = document.getElementById('toolbox');
        const horizontalHeader = document.getElementById('horizontal-header');

        if (editorContainer && toolboxPanel && horizontalHeader) {
            if (this.useHorizontalToolbox) {
                toolboxPanel.style.display = 'none';
                horizontalHeader.style.display = 'block';
                // Update grid to remove toolbox column
                editorContainer.style.gridTemplateColumns = '1fr 5px auto';
                console.log('[Editor] Switched to Horizontal Layout');
            } else {
                toolboxPanel.style.display = 'flex';
                horizontalHeader.style.display = 'none';
                // Restore grid with toolbox column
                editorContainer.style.gridTemplateColumns = 'auto 1fr 5px auto';
                console.log('[Editor] Switched to Vertical Toolbox');
            }
        }
    }

    private initFlowEditor() {
        // Initialize Flow Editor
        try {
            this.flowEditor = new FlowEditor('flow-viewer', this);

            // Connect Selection to Inspector
            this.flowEditor.onObjectSelect = (obj) => {
                if (this.jsonInspector) {
                    if (obj) {
                        this.jsonInspector.update(obj);
                    } else {
                        // Revert to project inspector if nothing selected in flow
                        if (this.project) {
                            this.jsonInspector.update(this.project);
                        }
                    }
                }
            };

            // Update Inspector's flow context when nodes change
            this.flowEditor.onNodesChanged = (nodes) => {
                if (this.jsonInspector && this.currentView === 'flow') {
                    this.jsonInspector.setFlowContext(nodes);
                }
            };

            // Wire up auto-save when project data changes in FlowEditor
            this.flowEditor.onProjectChange = () => {
                this.autoSaveToLocalStorage();
            };

            // Re-set project if available (since we just created the editor)
            if (this.project) {
                this.flowEditor.setProject(this.project);
            }

            // Initialize Flow Toolbox (append to toolbox aside, but manage visibility)
            // We create a container div for it
            const toolboxContainer = document.getElementById('toolbox');
            if (toolboxContainer) {
                const flowToolboxContainer = document.createElement('div');
                flowToolboxContainer.id = 'flow-toolbox-content';
                flowToolboxContainer.style.display = 'none'; // Hidden by default
                toolboxContainer.appendChild(flowToolboxContainer);

                this.flowToolbox = new FlowToolbox('flow-toolbox-content');
                this.flowToolbox.render();
            }
        } catch (e) {
            console.error('Failed to initialize Flow Editor:', e);
        }
    }

    /**
     * Initialize the menu bar
     */
    private async initMenuBar() {
        try {
            // Menu bar container is already in HTML template
            const menuBarContainer = document.getElementById('menu-bar');
            if (!menuBarContainer) {
                console.warn('[Editor] menu-bar container not found');
                return;
            }

            // Create MenuBar instance
            this.menuBar = new MenuBar('menu-bar');

            // Load menu configuration
            await this.menuBar.loadFromJSON('./editor/menu_bar.json');

            // Initial Stages Menu Update
            this.updateStagesMenu();

            // Wire up action handlers
            this.menuBar.onAction = (action: string) => {
                this.handleMenuAction(action);
            };

            console.log('[Editor] MenuBar initialized');
        } catch (e) {
            console.error('[Editor] Failed to initialize MenuBar:', e);
        }
    }

    /**
     * Handle menu bar actions
     */
    private handleMenuAction(action: string) {
        switch (action) {
            case 'save':
                this.saveProject();
                break;
            case 'load':
                this.triggerLoad();
                break;
            case 'export-html':
                this.exportHTML();
                break;
            case 'export-html-gzip':
                this.exportHTMLCompressed();
                break;
            case 'export-json':
                this.exportJSON();
                break;
            case 'export-json-gzip':
                this.exportJSONCompressed();
                break;
            case 'export-exe':
                alert('Exe-Export ist für eine zukünftige Version geplant.');
                break;
            case 'multiplayer':
                // Open multiplayer lobby - existing functionality
                const lobby = document.getElementById('multiplayer-lobby');
                if (lobby) {
                    lobby.style.display = 'flex';
                }
                break;
            // Stage-Verwaltung
            case 'new-stage':
                this.createStage('standard');
                break;
            case 'new-splash':
                this.createStage('splash');
                break;
            case 'delete-stage':
                this.deleteCurrentStage();
                break;
            case 'new-from-template':
                this.createStageFromTemplate();
                break;
            case 'save-as-template':
                this.saveStageAsTemplate();
                break;
            default:
                // Prüfe ob es eine Stage-Switch-Aktion ist
                // Robustere Prüfung für Leerzeichen (z.B. "switch-stage - main")
                const normalizedAction = action.replace(/\s+/g, '');
                if (normalizedAction.startsWith('switch-stage-')) {
                    const stageId = normalizedAction.replace('switch-stage-', '');
                    this.switchStage(stageId);
                } else {
                    // Recording Aktionen
                    this.handleRecordingAction(action);
                }
        }
    }

    /**
     * Spezielle Behandlung für Recording-Aktionen
     */
    private handleRecordingAction(action: string): void {
        switch (action) {
            case 'record-start':
                const name = prompt('Name für das Recording:', `Tutorial_${new Date().toLocaleTimeString()}`);
                if (name) changeRecorder.startRecording(name);
                break;

            case 'record-stop':
                const recording = changeRecorder.stopRecording();
                if (recording) {
                    alert(`Recording "${recording.name}" gestoppt. ${recording.actions.length} Aktionen aufgezeichnet.`);
                    playbackEngine.load(recording);
                    this.playbackControls?.show();
                }
                break;

            case 'playback-show':
                this.playbackControls?.show();
                break;

            case 'recording-export':
                const currentRec = (playbackEngine as any).currentRecording;
                if (currentRec) {
                    const json = JSON.stringify(currentRec, null, 2);
                    const blob = new Blob([json], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${currentRec.name}.gcsrec`;
                    a.click();
                    URL.revokeObjectURL(url);
                } else {
                    alert('Kein Recording zum Exportieren vorhanden.');
                }
                break;

            case 'recording-import':
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.gcsrec, .json';
                input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (re) => {
                            try {
                                const rec = JSON.parse(re.target?.result as string);
                                playbackEngine.load(rec);
                                this.playbackControls?.show();
                                alert(`Recording "${rec.name}" erfolgreich importiert.`);
                            } catch (err) {
                                alert('Fehler beim Importieren des Recordings.');
                            }
                        };
                        reader.readAsText(file);
                    }
                };
                input.click();
                break;
            default:
                console.warn('[Editor] Unknown menu action:', action);
        }
    }

    private initJSONInspector() {
        this.jsonInspector = new JSONInspector('json-inspector-content');
        this.jsonInspector.setProject(this.project);
        this.jsonInspector.setEditor(this);

        this.jsonInspector.onObjectUpdate = () => {
            this.refreshAllViews('inspector');
            mediatorService.notifyDataChanged({ object: null, property: 'all', type: 'update' }, 'inspector');
        };

        this.jsonInspector.onProjectUpdate = () => {
            this.render();
            this.autoSaveToLocalStorage();
            this.refreshAllViews('inspector');
        };

        this.jsonInspector.onObjectDelete = (obj: any) => {
            // Check if this is a Flow Element delegated to FlowEditor
            if (this.currentView === 'flow' && this.flowEditor) {
                // Try to find the node in FlowEditor
                const flowNode = this.flowEditor.getNodes().find(n => n.id === obj.id);
                if (flowNode) {
                    this.flowEditor.deleteNode(flowNode);
                    return;
                }
            }

            if (obj && obj.id) {
                this.commandManager.removeObject(obj.id);
            }
        };

        this.jsonInspector.onObjectSelect = (id: string | null) => {
            this.selectObject(id);
        };
    }

    private async initJSONToolbox() {
        this.jsonToolbox = new JSONToolbox('json-toolbox-content');
        try {
            const response = await fetch('./editor/toolbox.json');
            if (response.ok) {
                const config = await response.json();
                await this.jsonToolbox.loadFromJSON(config);
            }
        } catch (error) {
            console.error('[Editor] Failed to load toolbox configuration:', error);
        }
    }

    private initMediator() {
        mediatorService.on(MediatorEvents.DATA_CHANGED, (_data: any, originator?: string) => {
            if (originator !== 'editor' && originator !== 'inspector' && this.project) {
                this.render();
            }
        });
    }

    private async initJSONLobby(): Promise<void> {
        try {
            const response = await fetch('./multiplayer/lobby_config.json');
            if (response.ok) {
                const config = await response.json();
                await jsonLobby.loadFromJSON(config);
                console.log('[Editor] Multiplayer Lobby initialized');
            }
        } catch (e) {
            console.error('[Editor] Failed to initialize Multiplayer Lobby:', e);
        }
    }

    public updateProjectJSON() {
        if (this.project) {
            projectPersistenceService.autoSaveToLocalStorage(this.project);
        }
    }

    /**
     * Synchronizes the current stage objects from the Editor (this.stage.objects)
     * back into the project structure (this.project.stages).
     * This is crucial before starting the runtime, otherwise the runtime will assume
     * the state of the last load/save, missing recent edits.
     */
    private syncStageObjectsToProject() {
        // Use getActiveStage() to get the current stage context
        const activeStage = this.getActiveStage();
        if (!this.stage || !activeStage) return;

        // Managers removed from stage sync

        console.log(`[Editor] Syncing objects for stage "${activeStage.id}" to project JSON...`);

        const projectStage = this.project.stages?.find((s: any) => s.id === activeStage.id);
        if (projectStage) {
            // Keep LIVE instances in the project structure to preserve methods and reactivity.
            // JSON.stringify will handle serialization when saving to localStorage.
            const allObjs = this.currentObjects;

            // STRICT SEPARATION: Filter objects and variables
            // WICHTIG: Transiente Objekte (Manager-Listen) herausfiltern!
            projectStage.objects = allObjs.filter(o => !o.isVariable && !o.isTransient);
            (projectStage as any).variables = allObjs.filter(o => o.isVariable && !o.isTransient);

            const varCount = (projectStage.variables || []).length;
            console.log(`[Editor] Synced ${projectStage.objects.length} objects and ${varCount} variables (Instances preserved).`);
        } else {
            console.warn(`[Editor] Could not find stage "${activeStage.id}" in project to sync objects.`);
        }
    }
}

