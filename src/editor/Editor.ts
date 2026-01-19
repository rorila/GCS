import { Stage } from './Stage';
import { GameProject, StageType, StageDefinition } from '../model/types';
import { TButton } from '../components/TButton';
import { TPanel } from '../components/TPanel';
import { TLabel } from '../components/TLabel';
import { TNumberLabel } from '../components/TNumberLabel';
import { TEdit } from '../components/TEdit';
import { TSystemInfo } from '../components/TSystemInfo';
import { TGameHeader } from '../components/TGameHeader';
import { TSprite } from '../components/TSprite';
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
import { TWindow } from '../components/TWindow';
import { AnimationManager } from '../runtime/AnimationManager';
import { TDebugLog } from '../components/TDebugLog';
import { hydrateObjects } from '../utils/Serialization';
import { GameExporter } from '../export/GameExporter';
import { inputSyncer, collisionSyncer, network } from '../multiplayer';
import { jsonLobby } from '../multiplayer/JSONMultiplayerLobby';
import { FlowDiagramGenerator } from './FlowDiagramGenerator';
import mermaid from 'mermaid';
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
import { projectRegistry } from '../services/ProjectRegistry';
import { libraryService } from '../services/LibraryService';

export class Editor {
    private stage: Stage;
    private jsonInspector: JSONInspector | null = null;
    private jsonToolbox: JSONToolbox | null = null;
    private flowEditor: FlowEditor | null = null;
    private flowToolbox: FlowToolbox | null = null;
    private menuBar: MenuBar | null = null;
    private componentPalette: JSONComponentPalette | null = null;
    private useStageIsolatedView = true; // Default to isolated view
    private dialogManager: DialogManager;
    private project: GameProject;
    private runtimeObjects: TWindow[] | null = null;
    private activeGameLoop: TGameLoop | null = null;
    private activeInputControllers: TInputController[] = [];
    private activeTimers: TTimer[] = [];
    private activeGameServers: TGameServer[] = [];
    private runtime: GameRuntime | null = null;
    private useHorizontalToolbox: boolean = false;
    private pascalEditorMode: boolean = false;
    private currentView: string = 'stage';
    private currentContext: 'game' | 'splash' = 'game';
    private debugLog: TDebugLog | null = null;

    // JSON View State
    private jsonMode: 'viewer' | 'editor' = 'viewer';
    private workingProjectData: any = null;
    private isProjectDirty: boolean = false;

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

        // Initialisiere Stages (Migration für Default-Projekt)
        this.migrateToStages();

        // Initialize Stage
        this.stage = new Stage('stage', this.project.stage.grid);
        this.stage.onEvent = (id, evt, data) => this.handleEvent(id, evt, data);

        // Initialize DialogManager
        this.dialogManager = new DialogManager();
        this.dialogManager.setProject(this.project);

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

    get isMultiplayer(): boolean { return this._isMultiplayer; }
    get localPlayerNumber(): 1 | 2 { return this._localPlayerNumber; }

    private get currentObjects(): TWindow[] {
        // Nutze das neue stages-Array wenn vorhanden
        if (this.project.stages && this.project.stages.length > 0) {
            const activeStage = this.getActiveStage();
            if (activeStage) {
                return activeStage.objects;
            }
        }

        // Legacy-Fallback für alte Projekte
        if (this.currentContext === 'splash') {
            if (!this.project.splashObjects) this.project.splashObjects = [];
            return this.project.splashObjects;
        }
        return this.project.objects;
    }

    private set currentObjects(objs: TWindow[]) {
        // Nutze das neue stages-Array wenn vorhanden
        if (this.project.stages && this.project.stages.length > 0) {
            const activeStage = this.getActiveStage();
            if (activeStage) {
                activeStage.objects = objs;
                return;
            }
        }

        // Legacy-Fallback
        if (this.currentContext === 'splash') {
            this.project.splashObjects = objs;
        } else {
            this.project.objects = objs;
        }
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

    private currentSelectedId: string | null = null;

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

    private switchView(view: 'stage' | 'json' | 'run' | 'flow' | 'code') {
        this.currentView = view;
        const stageWrapper = document.getElementById('stage-wrapper');
        const jsonPanel = document.getElementById('json-viewer');
        const flowPanel = document.getElementById('flow-viewer');
        const codePanel = document.getElementById('code-viewer');
        const tabs = document.querySelectorAll('.tab-btn');

        // Update Tabs
        tabs.forEach(t => t.classList.remove('active'));
        document.querySelector(`.tab-btn[data-view="${view}"]`)?.classList.add('active');

        // 1. Hide ALL panels
        if (stageWrapper) stageWrapper.style.display = 'none';
        if (jsonPanel) jsonPanel.style.display = 'none';
        if (flowPanel) flowPanel.style.display = 'none';
        if (codePanel) codePanel.style.display = 'none';

        // Hide standard toolboxes
        const jsonToolbox = document.getElementById('json-toolbox-content');
        if (jsonToolbox) jsonToolbox.style.display = 'none';

        // Hide flow toolbox if it exists
        if (this.flowToolbox) this.flowToolbox.hide();

        // Stop debug logging when switching views (focus loss)
        if (this.debugLog) {
            this.debugLog.setRecordingActive(false);
        }

        // 2. Show Selected Panel
        if (view === 'stage') {
            this.setRunMode(false);
            if (stageWrapper) stageWrapper.style.display = 'flex';
            if (jsonToolbox) jsonToolbox.style.display = 'block';

            // Reset Inspector context to Stage objects
            if (this.jsonInspector) {
                this.jsonInspector.setFlowContext(null);
            }
        } else if (view === 'run') {
            this.setRunMode(true);
            if (stageWrapper) stageWrapper.style.display = 'flex';
        } else if (view === 'json') {
            this.setRunMode(false);
            if (jsonPanel) {
                jsonPanel.style.display = 'block';
                // Reset state on entry
                this.jsonMode = 'viewer';
                this.workingProjectData = JSON.parse(JSON.stringify(this.project));
                this.isProjectDirty = false;
                this.refreshJSONView();
            }
        } else if (view === 'flow') {
            this.setRunMode(false);
            if (flowPanel) flowPanel.style.display = 'block';

            // Show Flow Editor
            if (this.flowEditor) {
                this.flowEditor.show();
                this.flowEditor.setProject(this.project);

                // Update Inspector context to show Flow elements
                if (this.jsonInspector) {
                    this.jsonInspector.setFlowContext(this.flowEditor.getNodes());
                }
            }
            // Show Flow Toolbox
            if (this.flowToolbox) {
                this.flowToolbox.show();
            }
        } else if (view === 'code') {
            console.log('[Editor] Switching to Pascal Code View');
            this.setRunMode(false);
            if (codePanel) {
                codePanel.style.display = 'flex';
                codePanel.style.flexDirection = 'column';
                codePanel.style.padding = '0';
                codePanel.style.height = '100%';
                codePanel.style.minHeight = '300px';

                // 1. Toolbar
                let toolbar = document.getElementById('code-viewer-toolbar');
                if (!toolbar) {
                    console.log('[Editor] Creating Code Viewer Toolbar');
                    toolbar = document.createElement('div');
                    toolbar.id = 'code-viewer-toolbar';
                    toolbar.style.padding = '8px 16px';
                    toolbar.style.backgroundColor = '#2d2d2d';
                    toolbar.style.borderBottom = '1px solid #3c3c3c';
                    toolbar.style.display = 'flex';
                    toolbar.style.alignItems = 'center';
                    toolbar.style.gap = '12px';

                    const label = document.createElement('label');
                    label.style.cssText = 'display: flex; align-items: center; gap: 8px; cursor: pointer; color: #ccc; font-size: 12px;';

                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.checked = this.pascalEditorMode;
                    checkbox.onchange = (e) => {
                        this.pascalEditorMode = (e.target as HTMLInputElement).checked;
                        this.switchView('code');
                    };

                    label.appendChild(checkbox);
                    label.appendChild(document.createTextNode('Editor-Modus'));
                    toolbar.appendChild(label);

                    // Scope Selector (Stage vs Project)
                    const sourceSelect = document.createElement('select');
                    sourceSelect.id = 'pascal-scope-select';
                    sourceSelect.style.cssText = `background: #2d2d2d; border: 1px solid #3a3a3a; color: #fff; padding: 4px; border-radius: 4px; outline: none; cursor: pointer; margin-left: auto;`;

                    const updateScopeOptions = () => {
                        sourceSelect.innerHTML = '';
                        const aStage = this.getActiveStage();
                        const sName = aStage ? aStage.name : 'Unknown';
                        const opts = [
                            { id: 'stage', label: `Stage: ${sName}` },
                            { id: 'project', label: 'Gesamtes Projekt' }
                        ];
                        opts.forEach(s => {
                            const opt = document.createElement('option');
                            opt.value = s.id;
                            opt.textContent = s.label;
                            opt.selected = (s.id === 'stage' && this.useStageIsolatedView) || (s.id === 'project' && !this.useStageIsolatedView);
                            sourceSelect.appendChild(opt);
                        });
                        // Hide if no active stage or main?
                        if (!aStage || aStage.type === 'main') {
                            // allow switch even in main?
                        }
                    };
                    updateScopeOptions();

                    sourceSelect.onchange = () => {
                        console.log('[Editor] Pascal Scope Toggle Changed:', sourceSelect.value);
                        this.useStageIsolatedView = sourceSelect.value === 'stage';
                        this.switchView('code');
                    };

                    toolbar.appendChild(sourceSelect);

                    codePanel.appendChild(toolbar);
                } else {
                    const checkbox = toolbar.querySelector('input');
                    if (checkbox) checkbox.checked = this.pascalEditorMode;

                    // Update dropdown options in case stage changed
                    const sourceSelect = toolbar.querySelector('#pascal-scope-select') as HTMLSelectElement;
                    if (sourceSelect) {
                        const aStage = this.getActiveStage();
                        const sName = aStage ? aStage.name : 'Unknown';
                        // Simple update of stage label, assuming order [Stage, Project]
                        if (sourceSelect.options.length > 0) {
                            sourceSelect.options[0].text = `Stage: ${sName}`;
                            sourceSelect.value = this.useStageIsolatedView ? 'stage' : 'project';
                        }
                    }
                }

                // 2. Render Code Content
                try {
                    if (this.pascalEditorMode) {
                        const activeStage = this.getActiveStage();
                        console.log('[Editor] Generating Pascal. Isolated:', this.useStageIsolatedView, 'ActiveStage:', activeStage ? activeStage.name : 'None');
                        const stageToUse = (this.useStageIsolatedView && activeStage && activeStage.type !== 'main') ? activeStage : undefined;
                        console.log('[Editor] stageToUse:', stageToUse ? stageToUse.name : 'undefined (Full Project)');

                        const plainCode = PascalGenerator.generateFullProgram(this.project, false, stageToUse);

                        // Clear previous content but keep toolbar
                        const oldContainer = document.getElementById('pascal-editor-container');
                        if (oldContainer) oldContainer.remove();
                        const oldContent = document.getElementById('code-viewer-content');
                        if (oldContent) oldContent.remove();

                        const container = document.createElement('div');
                        container.id = 'pascal-editor-container';
                        container.style.cssText = `
                            flex: 1;
                            position: relative;
                            font-family: 'Fira Code', monospace;
                            font-size: 14px;
                            line-height: 1.5;
                            background-color: #1e1e1e;
                            overflow: hidden;
                        `;

                        const highlightLayer = document.createElement('div');
                        highlightLayer.id = 'pascal-editor-highlight';
                        highlightLayer.style.cssText = `
                            position: absolute;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                            padding: 1rem;
                            color: #d4d4d4;
                            pointer-events: none; /* Allow clicks to pass through to textarea */
                            overflow: auto;
                            white-space: pre;
                            box-sizing: border-box;
                        `;
                        highlightLayer.innerHTML = PascalHighlighter.highlight(plainCode);

                        const textarea = document.createElement('textarea');
                        textarea.id = 'pascal-editor-textarea';
                        textarea.value = plainCode;
                        textarea.spellcheck = false;
                        textarea.style.cssText = `
                            position: absolute;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                            padding: 1rem;
                            background: transparent;
                            color: transparent;
                            border: none;
                            outline: none;
                            resize: none;
                            font-family: inherit;
                            font-size: inherit;
                            line-height: inherit;
                            overflow: auto;
                            white-space: pre;
                            box-sizing: border-box;
                            caret-color: #d4d4d4; /* Ensure caret is visible */
                        `;

                        // Sync highlighting on input
                        textarea.oninput = () => {
                            highlightLayer.innerHTML = PascalHighlighter.highlight(textarea.value);
                            try {
                                PascalGenerator.parse(this.project, textarea.value);
                                // Refresh inspector if it exists to show new variables/changes
                                if (this.jsonInspector) {
                                    // Use the same logic as selectObject to choose what to show in inspector
                                    const obj = (this as any).currentSelectedId ? this.findObjectById((this as any).currentSelectedId) : null;
                                    this.jsonInspector.update(obj || this.project);
                                }
                                this.autoSaveToLocalStorage();
                            } catch (err) {
                                console.error('[Editor] Error parsing Pascal code:', err);
                            }
                        };

                        // Sync scrolling
                        textarea.onscroll = () => {
                            highlightLayer.scrollTop = textarea.scrollTop;
                            highlightLayer.scrollLeft = textarea.scrollLeft;
                        };

                        container.appendChild(highlightLayer);
                        container.appendChild(textarea);
                        codePanel.appendChild(container);
                    } else {
                        // Static highlighted view - use same PascalHighlighter as Editor for consistent colors
                        const oldContainer = document.getElementById('pascal-editor-container');
                        if (oldContainer) oldContainer.remove();

                        let content = document.getElementById('code-viewer-content');
                        if (!content) {
                            content = document.createElement('div');
                            content.id = 'code-viewer-content';
                            content.style.flex = '1';
                            content.style.overflow = 'auto';
                            content.style.padding = '1rem';
                            content.style.backgroundColor = '#1e1e1e';
                            codePanel.appendChild(content);
                        }


                        // Generate plain code, then use PascalHighlighter (same as Editor)
                        const activeStage = this.getActiveStage();
                        console.log('[Editor] Generating Read-Only Pascal. Isolated:', this.useStageIsolatedView, 'ActiveStage:', activeStage ? activeStage.name : 'None');
                        const stageToUse = (this.useStageIsolatedView && activeStage && activeStage.type !== 'main') ? activeStage : undefined;

                        const plainCode = PascalGenerator.generateFullProgram(this.project, false, stageToUse);
                        const highlightedCode = PascalHighlighter.highlight(plainCode);
                        content.innerHTML = `<pre style="margin: 0; white-space: pre; color: #d4d4d4;" translate="no">${highlightedCode}</pre>`;
                    }
                } catch (err) {
                    console.error('[Editor] Error generating Pascal code:', err);
                    codePanel.innerHTML += `<pre style="color: red; padding: 1rem; margin: 0;" translate="no">Error generating Pascal code: ${err}</pre>`;
                }
            }
        }
    }



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
    private migrateToStages(): void {
        if (this.project.stages && this.project.stages.length > 0) {
            return; // Bereits migriert
        }

        console.log('[Editor] Migriere Legacy-Projekt zu stages-Array...');
        this.project.stages = [];

        // Falls SplashObjects existieren → SplashStage erstellen
        if (this.project.splashObjects && this.project.splashObjects.length > 0) {
            this.project.stages.push({
                id: 'splash',
                name: 'Splash',
                type: 'splash',
                objects: this.project.splashObjects,
                duration: this.project.splashDuration || 3000,
                autoHide: this.project.splashAutoHide ?? true,
                grid: JSON.parse(JSON.stringify(this.project.stage.grid)) // Grid kopieren
            });
        }

        // HauptStage erstellen
        this.project.stages.push({
            id: 'main',
            name: 'Hauptspiel',
            type: 'main',
            objects: this.project.objects || [],
            gameName: this.project.meta?.name || '',
            author: this.project.meta?.author || '',
            description: this.project.meta?.description || '',
            grid: JSON.parse(JSON.stringify(this.project.stage.grid)) // Grid kopieren
        });

        // Aktive Stage setzen (Splash wenn vorhanden, sonst Main)
        this.project.activeStageId = this.project.stages[0].id;
        projectRegistry.setActiveStageId(this.project.stages[0].id);

        console.log(`[Editor] Migration abgeschlossen. ${this.project.stages.length} Stages erstellt.`);
    }

    /**
     * Gibt die aktuelle Stage zurück
     */
    private getActiveStage(): StageDefinition | null {
        if (!this.project.stages || this.project.stages.length === 0) {
            return null;
        }
        const activeId = this.project.activeStageId || this.project.stages[0].id;
        return this.project.stages.find(s => s.id === activeId) || this.project.stages[0];
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
        const id = type === 'splash' ? 'splash' : `stage-${Date.now()}`;
        const name = type === 'splash' ? 'Splash' : `Stage ${stageCount + 1}`;

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

        console.log(`[Editor] Neue ${type}-Stage erstellt: ${name}`);
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
            console.warn(`[Editor] Stage nicht gefunden: ${stageId}`);
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
            : `Stage "${activeStage.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`;

        if (!confirm(confirmMsg)) return;

        // Stage entfernen
        const index = this.project.stages.findIndex(s => s.id === activeStage.id);
        this.project.stages.splice(index, 1);

        // Zur ersten verbleibenden Stage wechseln
        this.switchStage(this.project.stages[0].id);

        // Menü aktualisieren
        this.updateStagesMenu();

        console.log(`[Editor] Stage gelöscht: ${activeStage.name}`);
        this.autoSaveToLocalStorage();
    }

    /**
     * Aktualisiert das Stages-Menü dynamisch
     */
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
                id: 'delete-stage',
                label: 'Stage löschen',
                action: 'delete-stage',
                icon: '🗑️'
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
            stageItems.push({
                id: `stage-${stage.id}`,
                label: `${isActive ? '▶ ' : ''}${stage.name} (${stage.type === 'splash' ? 'Splash' : (stage.type === 'main' ? 'Haupt' : 'Standard')})`,
                action: `switch-stage-${stage.id}`,
                icon: stage.type === 'splash' ? '🚀' : (stage.type === 'main' ? '👑' : '📄')
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
                <div style="font-size: 0.85rem; color: #888;">Auslöser</div>
                <div style="font-size: 1.1rem; color: #fff; font-weight: bold;">
                    <span style="color: #81c784;">${flow.actorType}</span>: ${flow.actorName}
                    <span style="color: #4fc3f7; margin-left: 0.5rem;">→ ${flow.eventName}</span>
                </div>
            `;
            section.appendChild(actorInfo);

            // Render diagram
            const diagramDiv = document.createElement('div');
            diagramDiv.style.overflowX = 'auto';
            diagramDiv.style.padding = '1rem 0';
            try {
                const { svg } = await mermaid.render(`flow-diagram-${i}`, flow.mermaidSyntax);
                diagramDiv.innerHTML = svg;
            } catch (error) {
                console.error(`Error rendering ${flow.eventName}:`, error);
                diagramDiv.innerHTML = `<pre style="color: red;">Error: ${error}\n\n${flow.mermaidSyntax}</pre>`;
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
        const json = JSON.stringify(this.project, null, 2);
        const filename = `project_${this.project.meta.name.replace(/\s+/g, '_')}.json`;

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
            const hydratedStages = data.stages.map((s: any) => ({
                ...s,
                objects: hydrateObjects(s.objects || [])
            }));
            this.project.stages = hydratedStages;
            this.project.activeStageId = data.activeStageId || hydratedStages[0].id;
            projectRegistry.setActiveStageId(this.project.activeStageId || null);
        }

        // Restore Objects (Legacy System)
        this.project.objects = hydrateObjects(data.objects || []);
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

    private autoSaveToLocalStorage() {
        if (!this.project) return;
        try {
            // NOTE: Do NOT call syncToProject() here! It triggers onProjectChange which calls
            // autoSaveToLocalStorage again, causing infinite recursion.
            // The flowEditor should have already synced its state before this is called.

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
    }

    private removeObject(id: string) {
        this.currentObjects = this.currentObjects.filter(o => o.id !== id);
        this.selectObject(null); // Deselect
        this.render();
        this.autoSaveToLocalStorage();
    }

    /**
     * Remove object without triggering selection change or render (for batch deletion)
     */
    private removeObjectSilent(id: string) {
        const idx = this.project.objects.findIndex(o => o.id === id);
        if (idx !== -1) {
            console.log(`[Editor] Removing object: ${this.project.objects[idx].name}`);
            this.project.objects.splice(idx, 1);
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

        // Ensure bounds validation if needed, or leave to stage logic
        newObj.x = Math.max(0, x);
        newObj.y = Math.max(0, y);

        // Check if this object lands inside a TDialogRoot container
        // If so, make it a child of that dialog with relative positioning
        const dialogContainers = this.currentObjects.filter(o => {
            const cn = (o as any).className || o.constructor?.name;
            return cn === 'TDialogRoot';
        }) as TDialogRoot[];

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
    private findObjectById(id: string): any | null {
        // First search in root level
        for (const obj of this.currentObjects) {
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

    private setRunMode(running: boolean) {
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

            this.runtime = new GameRuntime(this.project, undefined, { // Force undefined objects to let Runtime load them from Stage
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

                        // Copy visual settings to the active Stage component
                        // We must ensure 'this.stage' reflects the target stage's visuals
                        if (this.stage) {
                            // Update Stage internal state (without full reload of editor)
                            // this.stage.setData(targetStage); // TStage doesn't have setData easily

                            // 1. Update Grid/Background
                            this.stage.grid = {
                                cols: targetStage.grid?.cols || 40,
                                rows: targetStage.grid?.rows || 25,
                                cellSize: targetStage.grid?.cellSize || 32,
                                snapToGrid: this.stage.grid.snapToGrid,
                                visible: targetStage.grid?.visible !== false,
                                backgroundColor: targetStage.grid?.backgroundColor || '#1e1e1e'
                            };

                            // 3. Force Repaint (handled by grid setter)
                            // this.stage.drawGrid(); // Not needed, setter calls updategrid
                        }

                        // CRITICAL: Update runtimeObjects reference as GameRuntime has replaced the objects array!
                        if (this.runtime) {
                            console.log("[Editor] Refreshing runtimeObjects reference after stage switch.");
                            this.runtimeObjects = this.runtime.getObjects();

                            // GameLoop is now managed by GameLoopManager singleton
                            // No need to manually start it - GameRuntime.start() handles this

                            this.render();
                        }
                    }
                }
            });

            // CRITICAL: The GameRuntime creates reactive proxies for our objects.
            // We MUST use these proxies for rendering and all other logic.
            this.runtimeObjects = this.runtime.getObjects();

            // Initialize Debug Logger if not already active
            if (!this.debugLog) {
                this.debugLog = new TDebugLog();
                this.debugLog.setProject(this.project);
            }

            // Start the Runtime (this starts GameLoop, Timers, InputControllers internally)
            // MOVED to end of block to ensure all systems are ready
            // this.runtime.start();
            this.activeGameLoop = (this.runtimeObjects.find((o: any) => o.className === 'TGameLoop') as TGameLoop) || null;

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
            this.activeTimers = this.runtimeObjects.filter(
                obj => (obj as any).className === 'TTimer'
            ) as TTimer[];
            this.activeTimers.forEach(timer => {
                // Register onEvent callback for maxInterval event
                if ('onEvent' in timer) {
                    (timer as any).onEvent = (eventName: string) => {
                        console.log(`[Editor] TTimer ${timer.name} fired event: ${eventName}`);
                        this.handleEvent(timer.id, eventName);
                    };
                }
                timer.start(() => {
                    this.handleEvent(timer.id, 'onTimer');
                });
            });

            // Initialize NumberLabel event callbacks (for onMaxValueReached, onMinValueReached)
            const numberLabels = this.runtimeObjects.filter(
                obj => (obj as any).className === 'TNumberLabel'
            );
            numberLabels.forEach(nl => {
                if ('onEvent' in nl) {
                    (nl as any).onEvent = (eventName: string) => {
                        console.log(`[Editor] TNumberLabel ${nl.name} fired event: ${eventName}`);
                        this.handleEvent(nl.id, eventName);
                    };
                }
            });

            // Initialize and start GameServers
            this.activeGameServers = this.runtimeObjects.filter(
                obj => (obj as any).className === 'TGameServer'
            ) as TGameServer[];
            this.activeGameServers.forEach(server => {
                server.start((eventName, data) => {
                    this.handleGameServerEvent(server.id, eventName, data);
                });
            });

            // Start Runtime - this triggers onStart events for all objects and startAnimation
            console.log("[Editor] Starting GameRuntime...");
            this.runtime.start();



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

            // Fallback: Clear manual references if they still exist
            this.activeGameLoop?.stop();
            this.activeInputControllers.forEach(ic => ic.stop());
            this.activeTimers.forEach(timer => timer.stop());
            this.activeGameServers.forEach(server => server.stop());

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
            if (!this.stage.runMode) return;
            AnimationManager.getInstance().update();
            if (AnimationManager.getInstance().hasActiveTweens()) {
                // If we are animating, we MUST render every frame to see progress
                this.render();
            } else if (!this.activeGameLoop && this.stage.runMode) {
                // Background render for run mode even if no game loop (fallback)
                this.render();
            }
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
            data.forEach((objId: string) => {
                this.removeObjectSilent(objId);
            });
            this.selectObject(null);
            this.render();
            return;
        }

        if (!this.runtime) return;
        this.runtime.handleEvent(id, eventName, data);
        this.render();
    }

    private render() {
        if (!this.project) return;
        try {
            // Render either runtime sandbox or current context objects
            // CRITICAL: Always prefer runtimeObjects when in run mode or whenever they exist,
            // as they contain the live, updated state (proxies).
            const objectsToRender = this.runtimeObjects || this.currentObjects;

            // Custom Render Callback (if needed) to inject extra logic
            // ...

            this.stage.renderObjects(objectsToRender);

            // If JSON view is active, refresh it (but only if it's visible to save performance)
            const jsonPanel = document.getElementById('json-viewer');
            if (jsonPanel && jsonPanel.style.display !== 'none') {
                const json = JSON.stringify(this.project, null, 2);
                jsonPanel.innerText = json;
            }
        } catch (err) {
            console.error("[Editor] Render error:", err);
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
                this.render();
                if (this.flowEditor) {
                    this.flowEditor.refreshSelectedNode();
                    // Sync parameter changes from flow nodes to task definitions
                    this.flowEditor.syncToProject();
                }
                // Sync workingProjectData and refresh JSON view if active
                const jsonPanel = document.getElementById('json-viewer');
                if (jsonPanel && jsonPanel.style.display !== 'none') {
                    this.workingProjectData = JSON.parse(JSON.stringify(this.project));
                    this.refreshJSONView();
                }
                this.autoSaveToLocalStorage();
            };

            this.jsonInspector.onProjectUpdate = () => {
                console.log('[Editor] Project updated, re-rendering and updating grid');

                // Update MenuBar (e.g. Stage name changes)
                this.updateStagesMenu();

                // Nutze vorrangig das Stage-spezifische Grid der aktiven Stage
                const activeStage = this.project.stages?.find(s => s.id === this.project.activeStageId);
                const g = (activeStage && activeStage.grid) || this.project.stage.grid;

                if (g) {
                    this.stage.grid = {
                        cols: g.cols,
                        rows: g.rows,
                        cellSize: g.cellSize,
                        snapToGrid: g.snapToGrid,
                        visible: g.visible,
                        backgroundColor: g.backgroundColor
                    };

                    // Sync Stage Animation properties from active stage or legacy project.stage
                    const animSource = activeStage || this.project.stage;
                    if ((animSource as any).startAnimation) {
                        this.stage.startAnimation = (animSource as any).startAnimation;
                        this.stage.startAnimationDuration = (animSource as any).startAnimationDuration;
                        this.stage.startAnimationEasing = (animSource as any).startAnimationEasing;
                    }
                }

                this.stage.updategrid();
                this.updateStagesMenu();
                this.updateAvailableActions(); // Update actions based on stage context
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
    private refreshJSONView(): void {
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

        // 2. Render Tree (using workingData copy OR activeStage)
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

                    // Force start cleanliness
                    delete dataToShow.actions;

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
                        dataToShow.tasks = this.project.tasks.filter(t => allRelevantNames.has(t.name));

                        const usedActionNames = new Set<string>();
                        dataToShow.tasks.forEach((t: any) => {
                            if (t.actionSequence && Array.isArray(t.actionSequence)) {
                                t.actionSequence.forEach((step: any) => {
                                    if (step.type === 'action' && step.name) {
                                        usedActionNames.add(step.name);
                                    }
                                });
                            }
                        });



                        if (usedActionNames.size > 0 && this.project.actions) {
                            dataToShow.actions = this.project.actions.filter(a => usedActionNames.has(a.name));
                        }
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
            this.flowEditor = new FlowEditor('flow-viewer');

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
            default:
                // Prüfe ob es eine Stage-Switch-Aktion ist
                if (action.startsWith('switch-stage-')) {
                    const stageId = action.replace('switch-stage-', '');
                    this.switchStage(stageId);
                } else {
                    console.warn('[Editor] Unknown menu action:', action);
                }
        }
    }
}
