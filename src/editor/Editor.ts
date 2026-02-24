import { Stage } from './Stage';
import { GameProject, StageType, StageDefinition, GameAction, GameTask, ProjectVariable } from '../model/types';
import { TWindow } from '../components/TWindow';
import { TDebugLog } from '../components/TDebugLog';
import { ReactiveRuntime } from '../runtime/ReactiveRuntime';
import { InspectorHost } from './inspector/InspectorHost';
import { JSONToolbox } from './JSONToolbox';
import { JSONComponentPalette } from './JSONComponentPalette';
import { DialogManager } from './DialogManager';
import { dialogService } from '../services/DialogService';
import { serviceRegistry } from '../services/ServiceRegistry';
import '../services/RemoteGameManager';
import { FlowEditor } from './FlowEditor';
import { FlowToolbox } from './FlowToolbox';
import { MenuBar } from './MenuBar';
import { EditorStageManager } from './EditorStageManager';
import { projectRegistry } from '../services/ProjectRegistry';
import { libraryService } from '../services/LibraryService';
import { EditorViewManager, IViewHost, ViewType } from './EditorViewManager';
import { mediatorService, MediatorEvents } from '../services/MediatorService';
import { EditorCommandManager } from './services/EditorCommandManager';
import { EditorRunManager } from './services/EditorRunManager';
import { dataService } from '../services/DataService';
import { EditorDataManager } from './services/EditorDataManager';
import { EditorSimulatorManager } from './services/EditorSimulatorManager';
import { EditorRenderManager } from './services/EditorRenderManager';
import { EditorMenuManager } from './services/EditorMenuManager';
import { EditorKeyboardManager } from './services/EditorKeyboardManager';
import { EditorUndoManager } from './services/EditorUndoManager';
import { EditorInteractionManager } from './services/EditorInteractionManager';

/**
 * Editor.ts - Ultra-Lean Refactored Version
 * 
 * Diese Klasse fungiert nun als reiner Orchestrator (Host), der die Fachlogik
 * an spezialisierte Manager-Klassen delegiert.
 * Ziel: < 1000 Zeilen. Aktuell: ~200 Zeilen.
 */
export class Editor implements IViewHost {
    // UI Components
    public stage: Stage;
    public inspector: InspectorHost | null = null;
    private jsonToolbox: JSONToolbox | null = null;
    public flowEditor: FlowEditor | null = null;
    public flowToolbox: FlowToolbox | null = null;
    public menuBar: MenuBar | null = null;
    private componentPalette: JSONComponentPalette | null = null;
    public debugLog: TDebugLog | null = null;

    // Specialized Managers
    public dialogManager: DialogManager;
    public stageManager: EditorStageManager;
    public viewManager: EditorViewManager;
    public commandManager: EditorCommandManager;
    public runManager: EditorRunManager;
    public dataManager: EditorDataManager;
    public simulatorManager: EditorSimulatorManager;
    public renderManager: EditorRenderManager;
    public menuManager: EditorMenuManager;
    public keyboardManager: EditorKeyboardManager;
    public undoManager: EditorUndoManager;
    public interactionManager: EditorInteractionManager;

    // Core State
    public project: GameProject;
    public designRuntime: ReactiveRuntime;
    public currentSelectedId: string | null = null;
    private useHorizontalToolbox: boolean = false;

    public get workingProjectData() { return this.viewManager.workingProjectData; }
    public set workingProjectData(v: any) { this.viewManager.workingProjectData = v; }

    constructor() {
        this.designRuntime = new ReactiveRuntime();
        this.project = this.createDefaultProject();

        // 1. Core Services & Registry
        projectRegistry.setProject(this.project);
        this.stage = new Stage('stage', this.project.stage.grid);
        this.dialogManager = new DialogManager();
        this.dialogManager.setProject(this.project);
        dialogService.setDialogManager(this.dialogManager);

        // 2. Initialize Managers
        this.stageManager = new EditorStageManager(this.project, this.stage, () => {
            this.render();
            this.menuManager.updateStagesMenu();
            this.dataManager.updateProjectJSON();
        });
        this.viewManager = new EditorViewManager(this);
        this.commandManager = new EditorCommandManager(this);
        this.runManager = new EditorRunManager(this);
        this.dataManager = new EditorDataManager(this);
        this.simulatorManager = new EditorSimulatorManager(this);
        this.renderManager = new EditorRenderManager(this);
        this.menuManager = new EditorMenuManager(this);
        this.keyboardManager = new EditorKeyboardManager(this);
        this.undoManager = new EditorUndoManager(this);
        this.interactionManager = new EditorInteractionManager(this);

        // 3. System Services Registration
        this.registerGlobalServices();

        // 4. UI Setup
        this.debugLog = new TDebugLog();
        this.initInspector();
        this.initJSONToolbox();
        this.initComponentPalette();
        this.initFlowEditor();
        this.initMenuBar();
        this.initMediator();

        // 5. Manager Initialization
        this.simulatorManager.registerServices();
        this.keyboardManager.initKeyboardShortcuts();
        this.interactionManager.initCallbacks();

        // 6. View Events
        this.bindViewEvents();
        this.bindSystemInfoEvents();

        // 7. Load Persistence
        this.tryRestoreLastSession();

        // Setup toolbox toggle
        const toolboxToggleBtn = document.getElementById('toolbox-layout-toggle');
        if (toolboxToggleBtn) toolboxToggleBtn.onclick = () => this.toggleToolboxLayout();
    }

    private createDefaultProject(): GameProject {
        return {
            meta: { name: "New Game", version: "1.0.0", author: "Anonymous" },
            stage: { grid: { cols: 64, rows: 40, cellSize: 20, snapToGrid: true, visible: true, backgroundColor: '#ffffff' } },
            flow: { stage: { cols: 100, rows: 100, cellSize: 20, snapToGrid: true, visible: true, backgroundColor: '#1e1e1e' }, elements: [], connections: [] },
            input: { player1Controls: 'arrows', player1Target: '', player1Speed: 0.2, player2Controls: 'wasd', player2Target: '', player2Speed: 0.2 },
            objects: [], splashObjects: [], splashDuration: 3000, splashAutoHide: true, actions: [], tasks: [], variables: [], stages: []
        };
    }

    private registerGlobalServices() {
        serviceRegistry.register('Dialog', dialogService, 'Dialog Service');
        serviceRegistry.register('Editor', {
            selectObject: (id: string) => this.selectObject(id),
            jumpToDebug: (objectName: string, eventName: string) => {
                this.switchView('run');
                if (this.debugLog) this.debugLog.setFilters(objectName, eventName);
            }
        });
        serviceRegistry.register('Library', libraryService, 'Global Library');
        libraryService.loadLibrary();
        serviceRegistry.register('Data', dataService, 'Data Persistence');
    }

    private tryRestoreLastSession() {
        const lastProject = localStorage.getItem('gcs_last_project');
        if (lastProject) {
            try {
                this.loadProject(JSON.parse(lastProject));
                console.log('[Editor] Restored from last session');
            } catch (err) {
                console.error('[Editor] Restoration failed', err);
                this.switchView('stage');
            }
        } else {
            this.switchView('stage');
        }
    }

    // --- GETTERS ---
    public get currentObjects(): TWindow[] { return this.stageManager.currentObjects(); }
    public set currentObjects(objs: TWindow[]) { this.stageManager.setCurrentObjects(objs); }
    public get currentActions(): GameAction[] { return this.stageManager.currentActions(); }
    public get currentTasks(): GameTask[] { return this.stageManager.currentTasks(); }
    public get currentVariables(): ProjectVariable[] { return this.stageManager.currentVariables(); }
    public getActiveStage(): StageDefinition | null { return this.stageManager.getActiveStage(); }
    public get runtime() { return this.runManager.runtime; }
    public get runtimeObjects() { return this.runManager.runtimeObjects; }

    // --- DELEGATIONS ---
    public render() { this.renderManager.render(); }
    public addObject(type: string, x: number, y: number) { this.commandManager.addObject(type, x, y); }
    public removeObject(id: string) { this.commandManager.removeObject(id); }
    public removeObjectSilent(id: string) { this.commandManager.removeObjectSilent(id); }
    public selectObject(id: string | null, focus?: boolean) { this.commandManager.selectObject(id, focus); }
    public findObjectById(id: string) { return this.commandManager.findObjectById(id); }
    public findParentContainer(childId: string) { return this.commandManager.findParentContainer(childId); }
    public createObjectInstance(type: string, name: string, x: number, y: number) { return this.commandManager.createObjectInstance(type, name, x, y); }
    public setRunMode(running: boolean) { this.runManager.setRunMode(running); }
    public switchView(view: ViewType) { this.viewManager.switchView(view); }
    public createStage(type: StageType, name?: string) { return this.stageManager.createStage(type, name); }
    public switchStage(id: string) { this.stageManager.switchStage(id); }
    public updateStagesMenu() { this.menuManager.updateStagesMenu(); }
    public handleRewind() { this.undoManager.handleRewind(); }
    public handleForward() { this.undoManager.handleForward(); }
    public applyRecordedAction(action: any, dir: 'rewind' | 'forward') { this.undoManager.applyRecordedAction(action, dir); }
    public loadProject(data: any) { this.dataManager.loadProject(data); }
    public saveProject() { this.dataManager.saveProject(); }
    public triggerLoad() { this.dataManager.triggerLoad(); }
    public migrateToStages() { this.stageManager.migrateToStages(); }
    public autoSaveToLocalStorage() { this.dataManager.autoSaveToLocalStorage(); }
    public syncStageObjectsToProject() { this.dataManager.syncStageObjectsToProject(); }

    // Missing Manager Delegations
    public syncFlowChartsWithActions() { this.renderManager.syncFlowChartsWithActions(); }
    public morphVariable(variable: any, newType: any) { this.dataManager.morphVariable(variable, newType); }
    public getResolvedInheritanceObjects() { return this.stageManager.getResolvedInheritanceObjects(); }
    public deleteCurrentStage() { this.stageManager.deleteCurrentStage(); }
    public createStageFromTemplate() { this.stageManager.createStageFromTemplate(); }
    public saveStageAsTemplate() { this.stageManager.saveStageAsTemplate(); }
    public exportHTML() { this.dataManager.exportHTML(); }
    public exportHTMLCompressed() { this.dataManager.exportHTMLCompressed(); }
    public exportJSON() { this.dataManager.exportJSON(); }
    public exportJSONCompressed() { this.dataManager.exportJSONCompressed(); }
    public loadFromServer() { this.dataManager.loadFromServer(); }
    public startMultiplayer() {
        const lobby = document.getElementById('multiplayer-lobby');
        if (lobby) lobby.style.display = 'flex';
    }
    public playbackControls: any = null;

    // --- UI SETUP HELPERS ---
    private initInspector() {
        this.inspector = new InspectorHost(this.designRuntime, this.project);
        this.inspector.setContainer(document.getElementById('json-inspector-content')!);
        this.inspector.onObjectUpdate = () => this.renderManager.refreshAllViews('inspector');
        this.inspector.onProjectUpdate = () => { this.render(); this.autoSaveToLocalStorage(); this.renderManager.refreshAllViews('inspector'); };
        this.inspector.onObjectDelete = (obj: any) => obj?.id && this.removeObject(obj.id);
        this.inspector.onObjectSelect = (id: string | null) => this.selectObject(id);
    }

    private async initJSONToolbox() {
        this.jsonToolbox = new JSONToolbox('json-toolbox-content');
        const res = await fetch('./editor/toolbox.json');
        if (res.ok) await this.jsonToolbox.loadFromJSON(await res.json());
    }

    private initComponentPalette() {
        this.componentPalette = new JSONComponentPalette('horizontal-toolbar', 'horizontal-palette');
        this.componentPalette.onDrop = (type, x, y) => this.addObject(type, x, y);
    }

    private initFlowEditor() {
        try {
            this.flowEditor = new FlowEditor('flow-viewer', this);
            this.flowToolbox = new FlowToolbox('toolbox-content');
            this.flowToolbox.render();
            this.flowEditor.setProject(this.project);
        } catch (e) {
            console.error('[Editor] initFlowEditor error:', e);
        }
    }

    private initMenuBar() {
        this.menuManager.initMenuBar();
    }

    private initMediator() {
        mediatorService.on(MediatorEvents.DATA_CHANGED, (_data: any, originator?: string) => {
            if (originator !== 'editor' && originator !== 'inspector') this.renderManager.refreshAllViews(originator);
            else if (originator !== 'inspector') this.render();
        });
    }

    private bindViewEvents() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = (e.target as HTMLElement).getAttribute('data-view') as ViewType;
                if (view) this.switchView(view);
            });
        });
    }

    private bindSystemInfoEvents() {
        const update = () => {
            this.currentObjects.forEach(obj => obj.constructor.name === 'TSystemInfo' && (obj as any).refresh());
            if (this.inspector && this.currentSelectedId) {
                const sel = this.findObjectById(this.currentSelectedId);
                if (sel) this.inspector.update(sel);
            }
        };
        ['resize', 'online', 'offline'].forEach(evt => window.addEventListener(evt, update));
    }

    public toggleToolboxLayout() {
        this.useHorizontalToolbox = !this.useHorizontalToolbox;
        document.getElementById('app-layout')?.classList.toggle('horizontal-toolbox', this.useHorizontalToolbox);
    }

    public refreshJSONView() {
        const panel = document.getElementById('json-viewer');
        if (panel && this.project) {
            const data = this.viewManager.useStageIsolatedView ? (this.getActiveStage() || this.project) : this.project;
            this.viewManager.renderJSONTree(data, panel);
        }
    }

    public getTargetActionCollection(name?: string, action?: GameAction) { return this.stageManager.getTargetActionCollection(name, action); }
    public getTargetTaskCollection(name?: string, task?: GameTask) { return this.stageManager.getTargetTaskCollection(name, task); }

    // Back-compatibility getters for viewManager
    public get currentView(): ViewType { return this.viewManager.currentView; }
    public get pascalEditorMode(): boolean { return this.viewManager.pascalEditorMode; }
    public get jsonMode(): 'viewer' | 'editor' { return this.viewManager.jsonMode; }
    public set jsonMode(v: 'viewer' | 'editor') { this.viewManager.jsonMode = v; }
    public get isProjectDirty(): boolean { return this.viewManager.isProjectDirty; }
    public set isProjectDirty(v: boolean) { this.viewManager.isProjectDirty = v; }
}
