import { Stage } from './Stage';
import { GameProject, StageType, StageDefinition, GameAction, GameTask, ProjectVariable } from '../model/types';
import { TButton } from '../components/TButton';
import { TPanel } from '../components/TPanel';
import { TLabel } from '../components/TLabel';
import { TNumberLabel } from '../components/TNumberLabel';
import { TEdit } from '../components/TEdit';
import { TSystemInfo } from '../components/TSystemInfo';
import { TGameHeader } from '../components/TGameHeader';
import { TSprite } from '../components/TSprite';
import { TShape } from '../components/TShape';
import { TGameLoop } from '../components/TGameLoop';
import { TInputController } from '../components/TInputController';
import { TTimer } from '../components/TTimer';
import { TRepeater } from '../components/TRepeater';
import { TGameCard } from '../components/TGameCard';
import { TGameServer } from '../components/TGameServer';
import { TDropdown } from '../components/TDropdown';
import { TCheckbox } from '../components/TCheckbox';
import { TColorPicker } from '../components/TColorPicker';
import { TNumberInput } from '../components/TNumberInput';
import { TTabControl } from '../components/TTabControl';
import { TInspectorTemplate } from '../components/TInspectorTemplate';
// New dialog components
import { TDialogRoot } from '../components/TDialogRoot';
import { TInfoWindow } from '../components/TInfoWindow';
import { TToast } from '../components/TToast';
import { TStatusBar } from '../components/TStatusBar';
import { TGameState } from '../components/TGameState';
import { THandshake } from '../components/THandshake';
import { THeartbeat } from '../components/THeartbeat';
import { TImage } from '../components/TImage';
import { TVideo } from '../components/TVideo';
import { TSplashScreen } from '../components/TSplashScreen';
import { TStageController } from '../components/TStageController';
import { TVariable } from '../components/TVariable';
import { TObjectList } from '../components/TObjectList';
import { TThresholdVariable } from '../components/TThresholdVariable';
import { TTriggerVariable } from '../components/TTriggerVariable';
import { TRangeVariable } from '../components/TRangeVariable';
import { TListVariable } from '../components/TListVariable';
import { TRandomVariable } from '../components/TRandomVariable';
import { TKeyStore } from '../components/TKeyStore';
import { TWindow } from '../components/TWindow';
import { AnimationManager } from '../runtime/AnimationManager';
import { TDebugLog } from '../components/TDebugLog';
import { hydrateObjects } from '../utils/Serialization';
import { GameExporter } from '../export/GameExporter';
import { inputSyncer, collisionSyncer, network } from '../multiplayer';
import { jsonLobby } from '../multiplayer/JSONMultiplayerLobby';
import { FlowDiagramGenerator } from './FlowDiagramGenerator';
import mermaid from 'mermaid';
import { ExpressionParser } from '../runtime/ExpressionParser';
import { JSONInspector } from './JSONInspector';
import { JSONToolbox } from './JSONToolbox';
import { JSONComponentPalette } from './JSONComponentPalette';
import { DialogManager } from './DialogManager';
import { GameRuntime } from '../runtime/GameRuntime';
// Import services to trigger auto-registration
import '../services/RemoteGameManager';
import { dialogService } from '../services/DialogService';
import { serviceRegistry } from '../services/ServiceRegistry';
import { PascalGenerator } from './PascalGenerator';
import { PascalHighlighter } from './PascalHighlighter';
import { JSONTreeViewer } from './JSONTreeViewer';
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

export class Editor implements IViewHost {
    private stage: Stage;
    public jsonInspector: JSONInspector | null = null;
    private jsonToolbox: JSONToolbox | null = null;
    public flowEditor: FlowEditor | null = null;
    public flowToolbox: FlowToolbox | null = null;
    private menuBar: MenuBar | null = null;
    private componentPalette: JSONComponentPalette | null = null;
    public playbackControls: PlaybackControls | null = null;
    public playbackOverlay: PlaybackOverlay | null = null;
    private dialogManager: DialogManager;
    private stageManager: EditorStageManager;
    private viewManager: EditorViewManager;
    public project: GameProject;
    private runtimeObjects: TWindow[] | null = null;
    private activeGameLoop: TGameLoop | null = null;
    private activeInputControllers: TInputController[] = [];
    private activeTimers: TTimer[] = [];
    private activeGameServers: TGameServer[] = [];
    private runtime: GameRuntime | null = null;
    private useHorizontalToolbox: boolean = false;
    private currentContext: 'game' | 'splash' = 'game';
    public debugLog: TDebugLog | null = null;
    public currentSelectedId: string | null = null;

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

        // Initialisiere Stages (Migration für Default-Projekt)
        this.migrateToStages();
        this.stage.onEvent = (id, evt, data) => this.handleEvent(id, evt, data);

        // Initialize DialogManager
        this.dialogManager = new DialogManager();
        this.dialogManager.setProject(this.project);

        // Ensure ProjectRegistry knows about the initial project
        projectRegistry.setProject(this.project);
        projectRegistry.setActiveStageId(null);

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

        // Initialize JSON-based UI components
        this.initJSONInspector();
        this.initJSONToolbox();
        this.initComponentPalette();
        this.initFlowEditor();
        this.initMenuBar();

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
            }
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

    // --- DELEGATIONS ---
    public get currentObjects(): TWindow[] { return this.stageManager.currentObjects(); }
    public get currentActions(): GameAction[] { return this.stageManager.currentActions(); }
    public get currentTasks(): GameTask[] { return this.stageManager.currentTasks(); }
    public get currentVariables(): ProjectVariable[] { return this.stageManager.currentVariables(); }

    public getActiveStage(): StageDefinition | null { return this.stageManager.getActiveStage(); }
    private migrateToStages(): void { this.stageManager.migrateToStages(); }
    // --- END DELEGATIONS ---

    private set currentObjects(objs: TWindow[]) {
        // IMPORTANT: The setter must only save objects that BELONG to the active stage.
        const activeStage = this.getActiveStage();
        if (activeStage) {
            const localObjs = objs.filter(obj => {
                const isAlreadyLocal = (activeStage.objects || []).some(o => o.id === obj.id) ||
                    (activeStage.variables || []).some(v => (v as any).id === obj.id);
                if (isAlreadyLocal) return true;

                // If it's NEW (not in any stage), it belongs here.
                const existsElsewhere = (this.project.stages || []).some(s =>
                    s.id !== activeStage.id && (
                        (s.objects || []).some(o => o.id === obj.id) ||
                        (s.variables || []).some(v => (v as any).id === obj.id)
                    )
                );
                return !existsElsewhere;
            });

            // STRICT SEPARATION: Split into objects and variables
            activeStage.objects = localObjs.filter(o => !o.isVariable);
            activeStage.variables = localObjs.filter(o => o.isVariable) as any;
            return;
        }

        // Legacy-Fallback
        if (this.currentContext === 'splash') {
            this.project.splashObjects = objs;
        } else {
            this.project.objects = objs.filter(o => !o.isVariable);
            this.project.variables = objs.filter(o => o.isVariable) as any;
        }
    }



    /**
     * Gibt die passende Liste (Global vs Stage) für eine neue Action zurück
     */
    public getTargetActionCollection(actionName?: string): GameAction[] {
        const activeStage = this.getActiveStage();
        if (!activeStage) return this.project.actions || (this.project.actions = []);

        // Wenn die Action bereits in der Stage existiert (oder dorthin gehört)
        if (activeStage.actions && activeStage.actions.find(a => a.name === actionName)) {
            return activeStage.actions;
        }

        // Wenn sie global existiert
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
    public getTargetTaskCollection(taskName?: string): GameTask[] {
        const activeStage = this.getActiveStage();
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
    }/**
     * Bind window events to update TSystemInfo components live
     */
    private bindSystemInfoEvents() {
        const updateSystemInfoObjects = () => {
            this.currentObjects.forEach(obj => {
                if (obj.constructor.name === 'TSystemInfo') {
                    (obj as any).refresh();
                }
            });
            // Re-render inspector if a TSystemInfo is currently selected
            if (this.jsonInspector && this.currentSelectedId) {
                const selectedObj = this.currentObjects.find(o => o.id === this.currentSelectedId);
                if (selectedObj) {
                    this.stage.selectedObject = selectedObj;
                    this.jsonInspector.update(selectedObj);
                }
            }
        };

        window.addEventListener('resize', updateSystemInfoObjects);
        window.addEventListener('online', updateSystemInfoObjects);
        window.addEventListener('offline', updateSystemInfoObjects);
    }


    private bindViewEvents() {
        const tabs = document.querySelectorAll('.tab-btn');
        tabs.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                const view = target.getAttribute('data-view');
                if (view === 'stage' || view === 'json' || view === 'run' || view === 'flow' || view === 'code') {
                    this.switchView(view as any);
                }
            });
        });
    }

    public switchView(view: ViewType) {
        this.viewManager.switchView(view);
    }

    // View State Getters for back-compatibility
    public get currentView(): string { return this.viewManager.currentView; }
    public get pascalEditorMode(): boolean { return this.viewManager.pascalEditorMode; }
    public get useStageIsolatedView(): boolean { return this.viewManager.useStageIsolatedView; }
    public set useStageIsolatedView(v: boolean) { this.viewManager.useStageIsolatedView = v; }
    public get jsonMode(): 'viewer' | 'editor' { return this.viewManager.jsonMode; }
    public set jsonMode(v: 'viewer' | 'editor') { this.viewManager.jsonMode = v; }
    public get workingProjectData(): any { return this.viewManager.workingProjectData; }
    public set workingProjectData(v: any) { this.viewManager.workingProjectData = v; }
    public get isProjectDirty(): boolean { return this.viewManager.isProjectDirty; }
    public set isProjectDirty(v: boolean) { this.viewManager.isProjectDirty = v; }



    // ─────────────────────────────────────────────
    // Multi-Stage Verwaltung
    // ─────────────────────────────────────────────

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

        // Update flow editor dropdown to reflect new stage context
        if (this.flowEditor) {
            this.flowEditor.updateFlowSelector();
        }

        // Stage-spezifisches Grid anwenden
        if (stage.grid) {
            this.stage.grid = stage.grid;
        }

        // currentContext für Legacy-Kompatibilität aktualisieren
        this.currentContext = stage.type === 'splash' ? 'splash' : 'game';

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
        if (!activeStage) return this.project.objects || [];

        // OPTIMIZATION: If no inheritance, return fresh merged objects directly 
        // to allow editing and include both variables and objects!
        if (!activeStage.inheritsFrom) {
            return [
                ...(activeStage.objects || []),
                ...(activeStage.variables || []) as unknown as any[]
            ];
        }

        // Build chain (child -> parent -> grandparent)
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

        const mergedMap = new Map<string, any>();

        // bottom-up merge: start from most distant ancestor so children can override
        for (let i = chain.length - 1; i >= 0; i--) {
            const s = chain[i];
            const isTopLevel = (i === 0);

            // Merge BOTH objects and variables
            const combined = [
                ...(s.objects || []),
                ...(s.variables || []) as unknown as any[]
            ];

            combined.forEach(obj => {
                // We clone to avoid polluting the original data with 'isInherited' flag
                const copy = JSON.parse(JSON.stringify(obj));
                if (!isTopLevel) {
                    (copy as any).isInherited = true;
                }
                mergedMap.set(obj.name, copy);
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
    private triggerLoad() {
        // We create a temporary input if needed, or reuse one.
        // For simplicity, create dynamic one here to avoid DOM clutter in main layout
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';
        fileInput.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const json = JSON.parse(evt.target?.result as string);
                    this.loadProject(json);
                } catch (err) {
                    alert("Error loading project: " + err);
                }
            };
            reader.readAsText(file);
        };
        document.body.appendChild(fileInput); // Needs to be in DOM for some browsers?
        fileInput.click();
        document.body.removeChild(fileInput);
    }

    private async saveProject() {
        if (this.flowEditor) {
            this.flowEditor.syncToProject();
            this.flowEditor.syncAllTasksFromFlow(this.project);
        }

        // Variables and Objects are already separated due to the currentObjects setter/getter logic.
        // We just need to ensure everything is synced one last time.
        this.syncStageObjectsToProject();

        const json = JSON.stringify(this.project, null, 2);

        const projName = this.project.stages?.find((s: any) => s.type === 'main')?.gameName || this.project.meta.name || 'New Game';
        const filename = `project_${projName.replace(/\s+/g, '_')}.json`;

        // Try File System Access API (modern browsers)
        if ('showSaveFilePicker' in window) {
            try {
                const handle = await (window as any).showSaveFilePicker({
                    suggestedName: filename,
                    types: [{
                        description: 'JSON Project File',
                        accept: { 'application/json': ['.json'] }
                    }]
                });
                const writable = await handle.createWritable();
                await writable.write(json);
                await writable.close();
                alert(`Project saved successfully!\n\nFile: ${handle.name}`);
                return;
            } catch (err: any) {
                // User cancelled or error - fall through to legacy method
                if (err.name === 'AbortError') return;
                console.warn('File System Access API failed, using fallback:', err);
            }
        }

        // Fallback for browsers without File System Access API
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => document.body.removeChild(a), 2000);
        alert(`Project saved to Downloads folder.\n\nFile: ${filename}`);
    }

    private async exportHTML() {
        if (this.flowEditor) this.flowEditor.syncAllTasksFromFlow(this.project);
        const exporter = new GameExporter();
        await exporter.exportHTML(this.project);
    }

    private async exportJSON() {
        if (this.flowEditor) this.flowEditor.syncAllTasksFromFlow(this.project);
        const exporter = new GameExporter();
        await exporter.exportJSON(this.project);
    }

    private async exportHTMLCompressed() {
        if (this.flowEditor) this.flowEditor.syncAllTasksFromFlow(this.project);
        const exporter = new GameExporter();
        await exporter.exportHTMLCompressed(this.project);
    }

    private async exportJSONCompressed() {
        if (this.flowEditor) this.flowEditor.syncAllTasksFromFlow(this.project);
        const exporter = new GameExporter();
        await exporter.exportJSONCompressed(this.project);
    }

    private loadProject(data: any) {
        if (!data) return;

        // Clean up data artifacts before loading
        RefactoringManager.cleanActionSequences(data);

        // Metadata wiederherstellen
        if (data.meta) this.project.meta = data.meta;
        if (data.stage && data.stage.grid) this.project.stage.grid = data.stage.grid;

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
        } else {
            this.stage.grid = this.project.stage.grid;
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

    public autoSaveToLocalStorage() {
        if (!this.project) return;
        try {
            // Ensure the latest stage state (objects & variables) is synced to the project JSON
            this.syncStageObjectsToProject();

            const json = JSON.stringify(this.project);
            localStorage.setItem('gcs_last_project', json);
        } catch (err) {
            console.error('[Editor] Auto-save to localStorage failed:', err);
        }
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
            if (this.stage.runMode) {
                console.log(`[Editor] onDragStart: ${id}`);
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


    private removeObject(id: string) {
        const obj = this.findObjectById(id);
        if (obj && !changeRecorder.isApplyingAction) {
            changeRecorder.record({
                type: 'delete',
                description: `${obj.name} gelöscht`,
                objectId: id,
                objectData: JSON.parse(JSON.stringify(obj))
            });
        }

        this.currentObjects = this.currentObjects.filter(o => o.id !== id);
        this.selectObject(null); // Deselect
        this.render();
        this.autoSaveToLocalStorage();
    }

    /**
     * Remove object without triggering selection change or render (for batch deletion)
     */
    private removeObjectSilent(id: string) {
        // Search in all potential lists
        const activeStage = this.getActiveStage();
        if (activeStage) {
            const objIdx = (activeStage.objects || []).findIndex(o => o.id === id);
            if (objIdx !== -1) {
                console.log(`[Editor] Removing UI object: ${activeStage.objects[objIdx].name}`);
                activeStage.objects.splice(objIdx, 1);
                return;
            }

            const varIdx = (activeStage.variables || []).findIndex(v => (v as any).id === id);
            if (varIdx !== -1) {
                console.log(`[Editor] Removing variable: ${(activeStage.variables as any)[varIdx].name}`);
                activeStage.variables!.splice(varIdx, 1);
                return;
            }
        }

        // Legacy/Global Fallback
        const objIdx = this.project.objects.findIndex(o => o.id === id);
        if (objIdx !== -1) {
            this.project.objects.splice(objIdx, 1);
            return;
        }

        const varIdx = this.project.variables.findIndex(v => (v as any).id === id);
        if (varIdx !== -1) {
            this.project.variables.splice(varIdx, 1);
            return;
        }
    }

    private createObjectInstance(type: string, name: string, x: number, y: number): TWindow | null {
        let newObj: TWindow;

        switch (type) {
            case 'Button':
                newObj = new TButton(name, x, y, 6, 2);
                break;
            case 'Panel':
                newObj = new TPanel(name, x, y, 10, 5);
                break;
            case 'Image':
                newObj = new TImage(name, x, y, 5, 5);
                break;
            case 'Video':
                newObj = new TVideo(name, x, y, 10, 6);
                break;
            case 'SplashScreen':
                newObj = new TSplashScreen(name, x, y, 32, 24);
                break;
            case 'Label':
                newObj = new TLabel(name, x, y);
                newObj.width = 6;
                newObj.height = 1;
                break;
            case 'NumberLabel':
                newObj = new TNumberLabel(name, x, y, 0);
                newObj.width = 6;
                newObj.height = 1;
                break;
            case 'Edit':
                newObj = new TEdit(name, x, y, 8, 2);
                break;
            case 'SystemInfo':
                newObj = new TSystemInfo(name) as unknown as TWindow;
                break;
            case 'GameHeader':
                newObj = new TGameHeader(name, x, y, 32, 2);
                break;
            case 'Sprite':
                newObj = new TSprite(name, x, y, 2, 2);
                break;
            case 'Shape':
                newObj = new TShape(name, x, y, 5, 5);
                break;
            case 'GameLoop':
                newObj = new TGameLoop(name, x, y);
                break;
            case 'InputController':
                newObj = new TInputController(name, x, y);
                break;
            case 'Timer':
                newObj = new TTimer(name, x, y);
                break;
            case 'Repeater':
                newObj = new TRepeater(name, x, y);
                break;
            case 'GameCard':
                newObj = new TGameCard(name, x, y);
                break;
            case 'GameServer':
                newObj = new TGameServer(name, x, y);
                break;
            case 'Dropdown':
                newObj = new TDropdown(name, x, y, 8, 2);
                break;
            case 'Checkbox':
                newObj = new TCheckbox(name, x, y, 8, 2);
                break;
            case 'ColorPicker':
                newObj = new TColorPicker(name, x, y, 8, 2);
                break;
            case 'NumberInput':
                newObj = new TNumberInput(name, x, y, 8, 2);
                break;
            case 'TabControl':
                newObj = new TTabControl(name, x, y, 20, 10);
                break;
            case 'InspectorTemplate':
                newObj = new TInspectorTemplate(name, x, y, 15, 20);
                break;
            case 'DialogRoot':
                newObj = new TDialogRoot(name, x, y, 20, 15);
                break;
            case 'InfoWindow':
                newObj = new TInfoWindow(name, x, y);
                break;
            case 'Toast':
                newObj = new TToast(name);
                break;
            case 'StatusBar':
                newObj = new TStatusBar(name, x, y, 40, 2);
                break;
            case 'GameState':
                newObj = new TGameState(name, x, y);
                break;
            case 'Handshake':
                newObj = new THandshake(name, x, y);
                break;
            case 'Heartbeat':
                newObj = new THeartbeat(name, x, y);
                break;
            case 'StageController':
                newObj = new TStageController(name, x, y);
                break;
            case 'Variable':
                newObj = new TVariable(name, x, y);
                break;
            case 'ObjectList':
                newObj = new TObjectList(name, x, y);
                break;
            case 'Threshold':
                newObj = new TThresholdVariable(name, x, y);
                break;
            case 'Trigger':
                newObj = new TTriggerVariable(name, x, y);
                break;
            case 'Range':
                newObj = new TRangeVariable(name, x, y);
                break;
            case 'List':
                newObj = new TListVariable(name, x, y);
                break;
            case 'Random':
                newObj = new TRandomVariable(name, x, y);
                break;
            case 'KeyStore':
                newObj = new TKeyStore(name, x, y);
                break;
            default:
                console.warn("Unknown type:", type);
                return null;
        }
        return newObj;
    }

    private addObject(type: string, x: number, y: number) {
        const name = `${type}_${this.currentObjects.length + 1}`;
        const newObj = this.createObjectInstance(type, name, x, y);
        if (!newObj) return;

        // Default Scoping Rules:
        // Main-Stage -> Global
        // Other Stages -> Stage-local
        const activeStage = this.getActiveStage();
        if (activeStage && activeStage.type === 'main') {
            newObj.scope = 'global';
        } else {
            newObj.scope = 'stage';
        }

        // Explicitly set className for robust identification (minification-proof)
        (newObj as any).className = `T${type}`;

        // Ensure bounds validation if needed, or leave to stage logic
        newObj.x = Math.max(0, x);
        newObj.y = Math.max(0, y);

        // Check if this object lands inside a Container (TDialogRoot, TSplashScreen)
        // If so, make it a child with relative positioning
        const dialogContainers = this.currentObjects.filter(o => {
            const cn = (o as any).className || o.constructor?.name;
            return cn === 'TDialogRoot' || cn === 'TSplashScreen';
        }) as any[];

        console.log(`[Editor] Adding ${newObj.name} at (${newObj.x}, ${newObj.y}). Found ${dialogContainers.length} dialog containers.`);

        let parentDialog: TDialogRoot | null = null;
        for (const dialog of dialogContainers) {
            if (dialog.containsObject && dialog.containsObject(newObj)) {
                parentDialog = dialog;
                break;
            }
        }

        if (parentDialog) {
            // Convert to relative coordinates within the dialog
            newObj.x = newObj.x - parentDialog.x;
            newObj.y = newObj.y - parentDialog.y;

            // Add as child of dialog
            parentDialog.addChild(newObj);
            console.log(`[Editor] ✓ Added ${newObj.name} as CHILD of ${parentDialog.name} at relative (${newObj.x}, ${newObj.y})`);
        } else {
            // Add to root level objects
            const list = this.currentObjects;
            list.push(newObj);
            this.currentObjects = list;
            console.log(`[Editor] Added ${newObj.name} to ROOT level`);
        }

        this.render();

        // Auto-select the newly created object
        this.selectObject(newObj.id);
        this.autoSaveToLocalStorage();

        // Record creation for Undo/Redo
        if (!changeRecorder.isApplyingAction) {
            changeRecorder.record({
                type: 'create',
                description: `${newObj.name} erstellt`,
                objectId: newObj.id,
                objectData: JSON.parse(JSON.stringify(newObj))
            });
        }
    }

    private selectObject(id: string | null) {
        this.currentSelectedId = id;
        if (id) {
            const obj = this.findObjectById(id);
            this.stage.selectedObject = obj || null;
            if (this.jsonInspector) this.jsonInspector.update(obj || null);
        } else {
            this.stage.selectedObject = null;
            if (this.jsonInspector) this.jsonInspector.update(this.project);
        }
        console.log("Selected:", id ? id : "Stage");
        this.render(); // Update stage to show selection visually
    }

    /**
     * Find an object by ID, searching recursively in containers
     */
    /**
     * Find an object by ID, searching recursively in containers.
     * Searches in RESOLVED objects (including inherited ones).
     */
    public findObjectById(id: string): any | null {
        // Use resolved objects to find everything including inherited ones
        const objects = this.getResolvedInheritanceObjects();

        // First search in root level
        for (const obj of objects) {
            if (obj.id === id) return obj;

            // Search in children (for containers like TDialogRoot)
            if (obj.children && Array.isArray(obj.children)) {
                for (const child of obj.children) {
                    if (child.id === id) return child;
                }
            }
        }
        return null;
    }

    /**
     * Find the parent container for a child object
     */
    private findParentContainer(childId: string): any | null {
        for (const obj of this.currentObjects) {
            if (obj.children && Array.isArray(obj.children)) {
                for (const child of obj.children) {
                    if (child.id === childId) {
                        return obj; // Return the parent container
                    }
                }
            }
        }
        return null;
    }

    public setRunMode(running: boolean) {
        this.stage.runMode = running;
        this.stage.updateBorder(); // Update border color based on mode
        if (running) {
            this.selectObject(null); // Deselect everything
            console.log("Game Running...");

            // Create Snapshot for Sandbox
            // 1. Serialize current objects

            // 3. Initialize Unified GameRuntime
            // In multiplayer mode, pass the network manager for player number and state sync
            const mpManager = this._isMultiplayer ? network : undefined;

            // Context-Aware Run: If we are in a sub-stage (not Main/Splash), start directly there
            const activeStage = this.getActiveStage();
            let startStageId: string | undefined;
            if (activeStage && activeStage.type !== 'main' && activeStage.type !== 'splash') {
                startStageId = activeStage.id;
                console.log(`[Editor] Context-Aware Run: Starting in stage '${activeStage.name}' (${startStageId})`);
            }

            let runtimeInstance: any = null;

            // Sync current editor state to project JSON before starting runtime
            // This ensures that changes made in the editor (e.g. image src) are available to the runtime
            this.syncStageObjectsToProject();

            runtimeInstance = new GameRuntime(this.project, undefined, { // Force undefined objects to let Runtime load them from Stage
                onNavigate: (_target) => this.switchView('run'), // Standalone would use real nav
                makeReactive: true,
                multiplayerManager: mpManager,
                onRender: () => this.render(),
                startStageId: startStageId,
                onStageSwitch: (stageId: string) => {
                    // Runtime (e.g. Splash finished) wants to switch background/grid context
                    const targetStage = this.project.stages?.find((s: any) => s.id === stageId);
                    if (targetStage) {
                        console.log(`[Editor] Runtime requested stage switch to: ${targetStage.name}`);

                        // Update Stage background/grid
                        if (this.stage) {
                            this.stage.grid = {
                                cols: targetStage.grid?.cols || 32,
                                rows: targetStage.grid?.rows || 24,
                                cellSize: targetStage.grid?.cellSize || 20,
                                snapToGrid: targetStage.grid?.snapToGrid ?? true,
                                visible: (this.stage?.runMode) ? (targetStage.grid?.visible ?? false) : (targetStage.grid?.visible ?? true),
                                backgroundColor: targetStage.grid?.backgroundColor || '#1e1e1e'
                            };
                        }

                        // CRITICAL: Refresh runtimeObjects from the instance (even if not yet assigned to this.runtime)
                        const rt = runtimeInstance || this.runtime;
                        if (rt) {
                            console.log("[Editor] Refreshing runtimeObjects reference after stage switch.");
                            this.runtimeObjects = rt.getObjects();

                            // UPDATE GameLoop reference to allow ticker to pause correctly!
                            if (this.runtimeObjects) {
                                this.activeGameLoop = (this.runtimeObjects.find((o: any) => o.className === 'TGameLoop') as any) || null;
                                if (this.activeGameLoop) {
                                    console.log("[Editor] GameLoop found after stage switch. Stopping fallback ticker.");
                                    this.stopAnimationTicker();
                                }
                            }

                            this.render();
                        }
                    }
                }
            });

            this.runtime = runtimeInstance;

            // CRITICAL: The GameRuntime creates reactive proxies for our objects.
            // We MUST use these proxies for rendering and all other logic.
            if (this.runtime) {
                this.runtimeObjects = this.runtime.getObjects();
                this.activeGameLoop = (this.runtimeObjects.find((o: any) => o.className === 'TGameLoop') as any) || null;
            }

            // Initialize Debug Logger if not already active
            if (!this.debugLog) {
                this.debugLog = new TDebugLog();
                this.debugLog.setProject(this.project);
            }

            // Start the Runtime (this starts GameLoop, Timers, InputControllers internally)
            // MOVED to end of block to ensure all systems are ready
            // this.runtime.start();
            if (this.runtimeObjects) {
                this.activeGameLoop = (this.runtimeObjects.find((o: any) => o.className === 'TGameLoop') as TGameLoop) || null;
            }

            // Connect Stage Events to Runtime
            if (this.stage) {
                this.stage.onEvent = (objectId: string, eventName: string) => {
                    console.log(`[Editor] Stage Event: ${objectId}.${eventName}`);
                    if (this.runtime) {
                        this.runtime.handleEvent(objectId, eventName);
                    }
                };
            }

            if (!this.activeGameLoop) {
                console.warn("[Editor] No GameLoop component found. Starting animation ticker fallback.");
                this.startAnimationTicker();
            }

            // Initialize and start Timers
            if (this.runtimeObjects) {
                this.activeTimers = this.runtimeObjects.filter(
                    obj => (obj as any).className === 'TTimer'
                ) as any[];
                this.activeTimers.forEach(timer => {
                    // Register onEvent callback for maxInterval event
                    if (timer && 'onEvent' in timer) {
                        (timer as any).onEvent = (eventName: string) => {
                            console.log(`[Editor] TTimer ${timer.name} fired event: ${eventName}`);
                            this.handleEvent(timer.id, eventName);
                        };
                    }
                    if (timer && typeof timer.start === 'function') {
                        timer.start(() => {
                            this.handleEvent(timer.id, 'onTimer');
                        });
                    }
                });
            }

            // Initialize NumberLabel event callbacks (for onMaxValueReached, onMinValueReached)
            if (this.runtimeObjects) {
                const numberLabels = this.runtimeObjects.filter(
                    obj => (obj as any).className === 'TNumberLabel'
                );
                numberLabels.forEach(nl => {
                    if (nl && 'onEvent' in nl) {
                        (nl as any).onEvent = (eventName: string) => {
                            console.log(`[Editor] TNumberLabel ${nl.name} fired event: ${eventName}`);
                            this.handleEvent(nl.id, eventName);
                        };
                    }
                });
            }

            // Initialize and start GameServers
            if (this.runtimeObjects) {
                this.activeGameServers = this.runtimeObjects.filter(
                    obj => (obj as any).className === 'TGameServer'
                ) as any[];
                this.activeGameServers.forEach(server => {
                    if (server && typeof server.start === 'function') {
                        server.start((eventName: string, data: any) => {
                            this.handleGameServerEvent(server.id, eventName, data);
                        });
                    }
                });
            }

            // Start Runtime - this triggers onStart events for all objects and startAnimation
            console.log("[Editor] Starting GameRuntime...");
            if (this.runtime) {
                this.runtime.start();
            }



            this.render(); // Render runtime objects
        } else {
            // console.log("Game Stopped.");

            // 1. Stop GameRuntime (which stops Loop, Timers, Server, Animation internally)
            if (this.runtime) {
                this.runtime.stop();
                this.runtime = null;
            }

            // 2. Clear Stage Events
            if (this.stage) {
                this.stage.onEvent = null;
            }

            // NEW: Robust stop calls
            if (this.activeGameLoop && typeof (this.activeGameLoop as any).stop === 'function') {
                (this.activeGameLoop as any).stop();
            }

            this.activeInputControllers.forEach(ic => {
                if (typeof (ic as any).stop === 'function') ic.stop();
            });
            this.activeTimers.forEach(timer => {
                if (typeof (timer as any).stop === 'function') timer.stop();
            });
            this.activeGameServers.forEach(server => {
                if (typeof (server as any).stop === 'function') server.stop();
            });

            this.activeGameLoop = null;
            this.activeInputControllers = [];
            this.activeTimers = [];
            this.activeGameServers = [];
            this.runtimeObjects = null; // discard snapshot
            this.stopAnimationTicker();

            // Remove Debug Logger when stopping
            if (this.debugLog) {
                this.debugLog.dispose();
                this.debugLog = null;
            }

            this.render(); // Render editor objects

            // CRITICAL FIX: Force reload - Removed due to recursion loop
            // this.render() should be sufficient as runtime is nullified.
        }
    }


    private handleGameServerEvent(id: string, eventName: string, data?: any) {
        if (!this.runtime) return;
        this.runtime.handleEvent(id, eventName, data);
        this.render();
    }

    private animationTickerId: number | null = null;
    private startAnimationTicker() {
        if (this.animationTickerId) return;
        const tick = () => {
            // STOP condition 1: Run mode disabled
            if (!this.stage || !this.stage.runMode) {
                this.stopAnimationTicker();
                return;
            }

            // STOP condition 2: GameLoop is active (it handles rendering)
            if (this.activeGameLoop) {
                // But wait, if we stop here, we lose animation support if GameLoop doesn't use AnimationManager?
                // TGameLoop DOES call AnimationManager.update().
                // So we can safely stop this ticker if a real loop exists.
                console.log("[Editor] GameLoop detected, stopping fallback ticker.");
                this.stopAnimationTicker();
                return;
            }

            AnimationManager.getInstance().update();

            const hasTweens = AnimationManager.getInstance().hasActiveTweens();
            // Render on animation or first frame
            if (hasTweens || !(this as any).firstRunRenderDone) {
                this.render();
                if (!hasTweens) (this as any).firstRunRenderDone = true;
            }

            // Continue loop
            this.animationTickerId = requestAnimationFrame(tick);
        };
        this.animationTickerId = requestAnimationFrame(tick);
    }

    private stopAnimationTicker() {
        if (this.animationTickerId) {
            cancelAnimationFrame(this.animationTickerId);
            this.animationTickerId = null;
        }
    }

    private handleEvent(id: string, eventName: string, data?: any) {
        // Handle delete event specially
        if (eventName === 'delete') {
            this.removeObject(id);
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

    public render() {
        if (!this.project) return;
        try {
            // CRITICAL: Always get fresh objects from runtime if available, 
            // as the runtime might replace the objects array on stage switches.
            let objectsToRender = this.runtime ? this.runtime.getObjects() : (this.runtimeObjects || this.getResolvedInheritanceObjects());

            // NEW: In Editor-Mode (no runtime active), resolve property bindings (${varName}) for visual preview
            if (!this.runtime) {
                const varContext = this.getVariableContext();
                objectsToRender = objectsToRender.map(obj => this.resolveObjectPreview(obj, varContext));
            }

            // Custom Render Callback (if needed) to inject extra logic
            // ...

            this.stage.renderObjects(objectsToRender);

            // JSON-View Refresh entfernt (darf nicht vom Spielverlauf tangiert sein)
        } catch (err) {
            console.error("[Editor] Render error:", err);
        }
    }

    /**
     * Creates a temporary copy of an object for rendering with resolved bindings.
     * Does NOT modify the original project data.
     */
    private resolveObjectPreview(obj: any, context: Record<string, any>): any {
        // Create a shallow copy + deep copy of relevant properties to avoid modifying original
        // We only need to resolve string properties that start with ${
        const previewObj = { ...obj };

        // Helper to resolve nested props
        const resolveProps = (target: any) => {
            if (!target || typeof target !== 'object') return;

            Object.keys(target).forEach(key => {
                const val = target[key];
                if (typeof val === 'string' && val.includes('${')) {
                    try {
                        target[key] = ExpressionParser.interpolate(val, context);
                    } catch (e) {
                        // Keep original on error
                    }
                } else if (val && typeof val === 'object' && !Array.isArray(val) && key === 'style') {
                    // Dive into style
                    target[key] = { ...val };
                    resolveProps(target[key]);
                }
            });
        };

        resolveProps(previewObj);

        // Also handle children if it's a TDialogRoot or similar
        if (previewObj.children && Array.isArray(previewObj.children)) {
            previewObj.children = previewObj.children.map((child: any) => this.resolveObjectPreview(child, context));
        }

        return previewObj;
    }

    /**
     * Generates a context for ExpressionParser based on all active project variables
     */
    private getVariableContext(): Record<string, any> {
        const context: Record<string, any> = {
            project: this.project,
            // Add system-like variables that are also available in ReactiveRuntime
            isMultiplayer: this._isMultiplayer,
            playerNumber: this._localPlayerNumber
        };

        // Add all variables from registry (Global + Scoped)
        const variables = projectRegistry.getVariables();
        variables.forEach(v => {
            // Use defaultValue for preview in editor
            context[v.name] = v.defaultValue;
        });

        return context;
    }

    /**
     * Refreshes the Pascal Code Viewer if it is currently active.
     */
    public refreshPascalView() {
        if (this.currentView !== 'pascal') return;

        try {
            const activeStage = this.getActiveStage();
            const stageToUse = (this.useStageIsolatedView && activeStage && activeStage.type !== 'main') ? activeStage : undefined;
            const plainCode = PascalGenerator.generateFullProgram(this.project, false, stageToUse);

            // Update Highlight Layer based on mode
            if (this.pascalEditorMode) {
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

    /**
     * Initializes the JSON-based Inspector
     */
    private async initJSONInspector() {
        try {
            // Create JSONInspector instance
            this.jsonInspector = new JSONInspector('json-inspector-content');

            // Set project and dialog manager
            this.jsonInspector.setProject(this.project);
            this.jsonInspector.setDialogManager(this.dialogManager);

            // Load inspector UI from JSON
            const response = await fetch('./inspector.json');
            const inspectorJSON = await response.json();
            await this.jsonInspector.loadFromJSON(inspectorJSON);

            // Ensure we start in Stage context and populate dropdown
            this.jsonInspector.setFlowContext(null);

            // Wire up callbacks
            this.jsonInspector.onObjectUpdate = () => {
                // Check if the modified object was an inherited one
                const selObj = this.stage.selectedObject as any;
                if (selObj && selObj.isInherited) {
                    // Materialize: create a local copy in the active stage
                    const activeStage = this.getActiveStage();
                    if (activeStage) {
                        console.log(`[Editor] Materializing inherited object: ${selObj.name}`);
                        const copy = JSON.parse(JSON.stringify(selObj));
                        delete copy.isInherited; // It's now local

                        // Add to current stage
                        if (!activeStage.objects) activeStage.objects = [];

                        // Check if it already exists
                        const existingIdx = activeStage.objects.findIndex(o => o.name === copy.name);
                        if (existingIdx >= 0) {
                            activeStage.objects[existingIdx] = copy;
                        } else {
                            activeStage.objects.push(copy);
                        }

                        this.render();
                        this.selectObject(copy.id);
                    }
                }

                this.render();
                this.refreshPascalView(); // Ensure Pascal code stays in sync
                if (this.flowEditor) {
                    this.flowEditor.refreshSelectedNode();
                    this.flowEditor.syncToProject();
                }

                // Refresh JSON view if active
                if (this.currentView === 'json') {
                    this.workingProjectData = JSON.parse(JSON.stringify(this.project));
                    this.refreshJSONView();
                }

                this.autoSaveToLocalStorage();
            };

            this.jsonInspector.onProjectUpdate = () => {
                this.updateStagesMenu();
                const activeStage = this.project.stages?.find(s => s.id === this.project.activeStageId);
                const g = (activeStage && activeStage.grid) || this.project.stage.grid;

                if (g) {
                    this.stage.grid = {
                        cols: g.cols, rows: g.rows, cellSize: g.cellSize,
                        snapToGrid: g.snapToGrid, visible: g.visible,
                        backgroundColor: g.backgroundColor
                    };
                }

                this.stage.updategrid();
                this.updateAvailableActions();
                this.render();
                this.autoSaveToLocalStorage();
            };

            this.jsonInspector.onObjectDelete = (obj) => {
                if (!obj) return;

                const type = obj.getType ? obj.getType() : (obj.type || '');
                const name = obj.Name || obj.name;

                if (type === 'Task') {
                    if (confirm(`Möchten Sie den Task "${name}" wirklich unwiderruflich löschen?`)) {
                        RefactoringManager.deleteTask(this.project, name);
                        if (this.flowEditor) this.flowEditor.setProject(this.project);
                        this.render();
                        this.autoSaveToLocalStorage();
                        serviceRegistry.call('Dialog', 'showToast', [`Task "${name}" wurde gelöscht.`, 'success']);
                    }
                    return;
                }

                if (type === 'Action') {
                    if (confirm(`Möchten Sie die Aktion "${name}" wirklich unwiderruflich löschen?`)) {
                        RefactoringManager.deleteAction(this.project, name);
                        if (this.flowEditor) this.flowEditor.setProject(this.project);
                        this.render();
                        this.autoSaveToLocalStorage();
                        serviceRegistry.call('Dialog', 'showToast', [`Aktion "${name}" wurde gelöscht.`, 'success']);
                    }
                    return;
                }

                // Stage Objects
                if (this.flowEditor && this.flowEditor.hasNode(obj.id)) {
                    this.flowEditor.removeNode(obj.id);
                } else {
                    this.removeObject(obj.id);
                }
            };

            // Wire up object selection from dropdown (Stage context)
            this.jsonInspector.onObjectSelect = (objectId) => {
                this.selectObject(objectId);
            };

            // Wire up flow object selection from dropdown (Flow context)
            this.jsonInspector.onFlowObjectSelect = (objectId) => {
                if (this.flowEditor) {
                    this.flowEditor.selectNodeById(objectId);
                }
            };

            // Initial update to show project/Stage settings
            this.jsonInspector.update(this.project);

            // Initial filtered actions update
            this.updateAvailableActions();

            console.log('[Editor] JSONInspector initialized');

        } catch (error) {
            console.error('[Editor] Failed to initialize JSONInspector:', error);
        }
    }

    /**
     * Initializes the JSON-based Toolbox
     */
    private async initJSONToolbox() {
        try {
            this.jsonToolbox = new JSONToolbox('json-toolbox-content');

            // Register action handlers
            this.jsonToolbox.registerAction('save', () => this.saveProject());
            this.jsonToolbox.registerAction('load', () => this.triggerLoad());
            this.jsonToolbox.registerAction('export', () => this.exportHTML());
            this.jsonToolbox.registerAction('multiplayer', () => this.startMultiplayer());
            this.jsonToolbox.registerAction('start', () => this.switchView('run'));
            this.jsonToolbox.registerAction('stop', () => this.switchView('stage'));

            // Load toolbox config from JSON
            const response = await fetch('./editor/toolbox.json');
            const toolboxJSON = await response.json();
            await this.jsonToolbox.loadFromJSON(toolboxJSON);

            console.log('[Editor] JSONToolbox initialized');
        } catch (error) {
            console.error('[Editor] Failed to initialize JSONToolbox:', error);
        }
    }

    /**
     * Initializes the JSON-based Multiplayer Lobby
     */
    private async initJSONLobby(): Promise<void> {
        try {
            const response = await fetch('./multiplayer/lobby.json');
            const lobbyJSON = await response.json();
            await jsonLobby.loadFromJSON(lobbyJSON);
            console.log('[Editor] JSONMultiplayerLobby initialized');
        } catch (error) {
            console.error('[Editor] Failed to initialize JSONMultiplayerLobby:', error);
        }
    }

    // Legacy toggle method removed - now using only JSON-based UI

    /**
     * Refreshes the JSON Tree View and its toolbar
     */
    public refreshJSONView(): void {
        const jsonPanel = document.getElementById('json-viewer');
        if (!jsonPanel) return;

        jsonPanel.innerHTML = '';

        // 1. Create Toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'json-toolbar';
        toolbar.style.cssText = `
            display: flex; gap: 12px; padding: 8px 16px; margin-bottom: 8px;
            border-bottom: 1px solid #3a3a3a; align-items: center;
            position: sticky; top: 0; background: #1e1e1e; z-index: 10;
        `;

        // Mode Selector
        const modeLabel = document.createElement('span');
        modeLabel.textContent = 'Modus:';
        modeLabel.style.color = '#888';
        modeLabel.style.fontSize = '12px';

        const modeSelect = document.createElement('select');
        modeSelect.style.cssText = `background: #2d2d2d; border: 1px solid #3a3a3a; color: #fff; padding: 4px; border-radius: 4px; outline: none; cursor: pointer;`;
        ['viewer', 'editor'].forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m.charAt(0).toUpperCase() + m.slice(1);
            opt.selected = this.jsonMode === m;
            modeSelect.appendChild(opt);
        });
        modeSelect.onchange = () => {
            this.jsonMode = modeSelect.value as 'viewer' | 'editor';
            this.refreshJSONView();
        };

        // Source Selector (Active Stage vs Project)
        const sourceSelect = document.createElement('select');
        sourceSelect.style.cssText = `background: #2d2d2d; border: 1px solid #3a3a3a; color: #fff; padding: 4px; border-radius: 4px; outline: none; cursor: pointer; margin-left: auto;`;

        const activeStage = this.getActiveStage();
        const stageName = activeStage ? activeStage.name : 'Unknown';

        const scopes = [
            { id: 'stage', label: `Stage: ${stageName}` },
            { id: 'project', label: 'Gesamtes Projekt' }
        ];

        scopes.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.label;
            // Default to 'stage' if we are not in main/legacy, otherwise 'project' mostly fine
            // But requirement is: Show active stage data by default.
            // Let's verify what 'showActiveStageOnly' state we want. 
            // We can store a minimal view state for this? Or just check if displayed
            opt.selected = (s.id === 'stage' && this.useStageIsolatedView) || (s.id === 'project' && !this.useStageIsolatedView);
            sourceSelect.appendChild(opt);
        });

        if (!activeStage || activeStage.type === 'main') {
            // If main stage, maybe "stage" view is effectively same as project? 
            // Or Main Stage object specifically?
            // Let's allow switching if user wants to see ONLY main stage object structure
        }

        sourceSelect.onchange = () => {
            this.useStageIsolatedView = sourceSelect.value === 'stage';
            this.updateAvailableActions(); // Ensure context is correct when switching view/stage implies focus change
            this.refreshJSONView();
        };

        // Search Input
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Im JSON suchen...';
        searchInput.style.cssText = `flex: 1; padding: 6px 10px; background: #2d2d2d; border: 1px solid #3a3a3a; border-radius: 4px; color: #fff; font-size: 13px; outline: none;`;
        searchInput.oninput = () => JSONTreeViewer.search(searchInput.value);

        // Apply Changes Button (only in editor mode + dirty)
        const applyBtn = document.createElement('button');
        applyBtn.textContent = 'Änderungen anwenden';
        applyBtn.style.cssText = `
            background: #28a745; border: none; color: #fff; padding: 6px 12px; border-radius: 4px; 
            cursor: pointer; font-size: 13px; font-weight: bold;
            display: ${this.jsonMode === 'editor' && this.isProjectDirty ? 'block' : 'none'};
        `;
        applyBtn.onclick = () => this.applyJSONChanges();

        toolbar.appendChild(modeLabel);
        toolbar.appendChild(modeSelect);

        // Add Source Selector to toolbar
        const spacer = document.createElement('div');
        spacer.style.flex = '1';
        toolbar.appendChild(spacer);
        toolbar.appendChild(sourceSelect);

        // toolbar.appendChild(searchInput); // Moved search to right or below?
        // Layout: [Mode] [Spacer] [Source] [Search] [Apply] ? 
        // Original layout: Mode, Search, Apply.
        // Let's re-arrange: Mode, Source, Search, Apply.
        spacer.remove();

        toolbar.appendChild(sourceSelect);
        toolbar.appendChild(searchInput);
        toolbar.appendChild(applyBtn);
        jsonPanel.appendChild(toolbar);

        // 2. Refresh working data from live project if in viewer mode (Flow edits might have occurred)
        if (this.jsonMode === 'viewer') {
            this.workingProjectData = JSON.parse(JSON.stringify(this.project));
        }

        const treeContainer = document.createElement('div');
        jsonPanel.appendChild(treeContainer);

        let dataToShow = this.workingProjectData;
        if (this.useStageIsolatedView && activeStage) {
            // We need to pick the "live" object from workingProjectData that corresponds to activeStage
            // workingProjectData IS a project structure.
            // We need to find the stage within workingProjectData.stages
            if (this.workingProjectData.stages) {
                const workingStage = this.workingProjectData.stages.find((s: any) => s.id === activeStage.id);
                if (workingStage) {
                    // Create a deep copy to avoid modifying the original stage in a way that breaks serialization
                    dataToShow = JSON.parse(JSON.stringify(workingStage));

                    // Inject relevant tasks for better visibility

                    // 1. Tasks that have a flow chart in this stage (exclude 'global' metadata key)
                    const stageTaskNames = Object.keys(workingStage.flowCharts || {})
                        .filter(key => key !== 'global');

                    const globalTaskNames = new Set(this.project.tasks.map(t => t.name));

                    // 2. Tasks referenced by objects in this stage
                    const referencedTaskNames = new Set<string>();
                    (workingStage.objects || []).forEach((obj: any) => {
                        if (obj.Tasks) {
                            Object.values(obj.Tasks).forEach((tName: any) => {
                                if (tName && typeof tName === 'string' && tName.trim() !== '') {
                                    // Only add if task actually exists globally
                                    if (globalTaskNames.has(tName)) {
                                        referencedTaskNames.add(tName);
                                    }
                                }
                            });
                        }
                    });

                    const allRelevantNames = new Set([...stageTaskNames, ...referencedTaskNames]);

                    if (allRelevantNames.size > 0) {
                        // MERGE: Keep existing local tasks and add relevant global tasks
                        const existingLocalTasks = dataToShow.tasks || [];
                        const localTaskNames = new Set(existingLocalTasks.map((t: any) => t.name));

                        const relevantGlobalTasks = this.project.tasks.filter(t =>
                            allRelevantNames.has(t.name) && !localTaskNames.has(t.name)
                        );

                        dataToShow.tasks = [...existingLocalTasks, ...relevantGlobalTasks];
                    }

                    // Actions: Always check ALL tasks now in dataToShow (local + injected global)
                    // for referenced global actions and ensure they are present in definitions
                    const existingLocalActions = dataToShow.actions || [];
                    const localActionNames = new Set(existingLocalActions.map((a: any) => a.name));
                    const usedActionNames = new Set<string>();

                    if (dataToShow.tasks) {
                        const usedTaskNamesInSeq = new Set<string>();
                        const scanSequence = (seq: any[]) => {
                            if (!seq || !Array.isArray(seq)) return;
                            seq.forEach((item: any) => {
                                if ((item.type === 'action' || !item.type) && item.name) {
                                    usedActionNames.add(item.name);
                                } else if (item.type === 'task' && item.name) {
                                    usedTaskNamesInSeq.add(item.name);
                                } else if (item.type === 'condition') {
                                    if (item.thenAction) usedActionNames.add(item.thenAction);
                                    if (item.elseAction) usedActionNames.add(item.elseAction);
                                    if (item.thenTask) usedTaskNamesInSeq.add(item.thenTask);
                                    if (item.elseTask) usedTaskNamesInSeq.add(item.elseTask);
                                    if (item.body) scanSequence(item.body);
                                    if (item.elseBody) scanSequence(item.elseBody);
                                } else if (item.type === 'while' || item.type === 'for' || item.type === 'foreach') {
                                    if (item.body) scanSequence(item.body);
                                }
                            });
                        };

                        // Initial scan of already included tasks
                        dataToShow.tasks.forEach((t: any) => {
                            scanSequence(t.actionSequence);
                        });

                        // If we found new task dependencies, inject them and scan them too (recursive)
                        if (usedTaskNamesInSeq.size > 0) {
                            const localTaskNames = new Set((dataToShow.tasks || []).map((t: any) => t.name));
                            const newGlobalTasks = this.project.tasks.filter(t =>
                                usedTaskNamesInSeq.has(t.name) && !localTaskNames.has(t.name)
                            );
                            if (newGlobalTasks.length > 0) {
                                dataToShow.tasks = [...dataToShow.tasks, ...newGlobalTasks];
                                // Rescan to find actions used by these newly injected tasks
                                newGlobalTasks.forEach(t => scanSequence(t.actionSequence));
                            }
                        }
                    }

                    if (usedActionNames.size > 0 && this.project.actions) {
                        const relevantGlobalActions = this.project.actions.filter(a =>
                            usedActionNames.has(a.name) && !localActionNames.has(a.name)
                        );
                        dataToShow.actions = [...existingLocalActions, ...relevantGlobalActions];
                    }
                }
            }
        }

        JSONTreeViewer.render(dataToShow, treeContainer, this.jsonMode === 'editor', (newData) => {
            this.isProjectDirty = true;
            // If we are editing a sub-object (stage), we need to merge it back into workingProjectData
            if (this.useStageIsolatedView && activeStage && this.workingProjectData.stages) {
                const idx = this.workingProjectData.stages.findIndex((s: any) => s.id === activeStage.id);
                if (idx !== -1) {
                    this.workingProjectData.stages[idx] = newData;
                }
            } else {
                this.workingProjectData = newData;
            }
            applyBtn.style.display = 'block';
        });
    }

    /**
     * Prompts the user to apply changes and updates the permanent project state
     */
    private applyJSONChanges(): void {
        const confirmed = confirm('Möchten Sie die Änderungen am Projekt wirklich übernehmen? Dies kann nicht rückgängig gemacht werden und wird sofort wirksam.');
        if (confirmed) {
            this.project = JSON.parse(JSON.stringify(this.workingProjectData));

            // Re-sync registries
            projectRegistry.setProject(this.project);
            // Sanitize project to remove orphaned flow charts and invalid sequences
            RefactoringManager.sanitizeProject(this.project);
            if (this.dialogManager) this.dialogManager.setProject(this.project);

            // IMPORTANT: First sync action data in FlowCharts before setting project on FlowEditor
            // This ensures FlowChart elements use the updated action definitions
            if (this.flowEditor) {
                // Sync the action data directly in project.flowCharts BEFORE loading into FlowEditor
                this.syncFlowChartsWithActions();
                this.flowEditor.setProject(this.project);
                // After loading, sync the currently displayed nodes as well
                this.flowEditor.syncActionsFromProject();
            }

            this.isProjectDirty = false;
            this.autoSaveToLocalStorage();
            this.refreshJSONView(); // Hide apply button

            // Show success toast
            const toast = this.project.objects.find(o => (o as any).className === 'TToast');
            if (toast && typeof (toast as any).success === 'function') {
                (toast as any).success('Projekt-Daten wurden erfolgreich aktualisiert.');
            }
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
    public updateProjectJSON() {
        if (this.project) {
            this.workingProjectData = JSON.parse(JSON.stringify(this.project));
            localStorage.setItem('last_project', JSON.stringify(this.project));
            console.log('[Editor] Project JSON updated in localStorage');
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

        console.log(`[Editor] Syncing objects for stage "${activeStage.id}" to project JSON...`);

        const projectStage = this.project.stages?.find((s: any) => s.id === activeStage.id);
        if (projectStage) {
            // Keep LIVE instances in the project structure to preserve methods and reactivity.
            // JSON.stringify will handle serialization when saving to localStorage.
            const allObjs = this.currentObjects;

            // STRICT SEPARATION: Filter objects and variables
            projectStage.objects = allObjs.filter(o => !o.isVariable);
            (projectStage as any).variables = allObjs.filter(o => o.isVariable);

            const varCount = (projectStage.variables || []).length;
            console.log(`[Editor] Synced ${projectStage.objects.length} objects and ${varCount} variables (Instances preserved).`);
        } else {
            console.warn(`[Editor] Could not find stage "${activeStage.id}" in project to sync objects.`);
        }
    }
}

