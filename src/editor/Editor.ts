import { Stage } from './Stage';
import { GameProject, StageType, StageDefinition, GameAction, GameTask, ProjectVariable } from '../model/types';
import { RefactoringManager } from './RefactoringManager';
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
import { projectPersistenceService } from '../services/ProjectPersistenceService';
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
import { ObjectStore } from './services/ObjectStore';

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
    public objectStore: ObjectStore = new ObjectStore();
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
        const blueprintStage: StageDefinition = {
            id: 'blueprint',
            name: 'Blueprint (Global)',
            type: 'blueprint',
            objects: [],
            actions: [],
            tasks: [],
            variables: [],
            grid: { cols: 64, rows: 40, cellSize: 20, snapToGrid: true, visible: true, backgroundColor: '#f5f5f5' }
        };

        const mainStage: StageDefinition = {
            id: 'main',
            name: 'Haupt-Level',
            type: 'main',
            objects: [],
            actions: [],
            tasks: [],
            variables: [],
            grid: { cols: 64, rows: 40, cellSize: 20, snapToGrid: true, visible: true, backgroundColor: '#ffffff' }
        };

        return {
            meta: { name: "Neues Spiel", version: "1.0.0", author: "Anonym" },
            stage: { grid: { cols: 64, rows: 40, cellSize: 20, snapToGrid: true, visible: true, backgroundColor: '#ffffff' } },
            flow: { stage: { cols: 100, rows: 100, cellSize: 20, snapToGrid: true, visible: true, backgroundColor: '#1e1e1e' }, elements: [], connections: [] },
            input: { player1Controls: 'arrows', player1Target: '', player1Speed: 0.2, player2Controls: 'wasd', player2Target: '', player2Speed: 0.2 },
            objects: [], splashObjects: [], splashDuration: 3000, splashAutoHide: true, actions: [], tasks: [], variables: [],
            stages: [blueprintStage, mainStage],
            activeStageId: 'main'
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

    private async tryRestoreLastSession() {
        try {
            console.log('[Editor] Fetching latest project.json from server to sync LocalStorage...');
            const serverProject = await projectPersistenceService.fetchProjectFromServer();
            if (serverProject) {
                // Overwrite LocalStorage with server state
                localStorage.setItem('gcs_last_project', JSON.stringify(serverProject));
                this.loadProject(serverProject);
                console.log('[Editor] Synchronized with server project.json');
                return;
            }
        } catch (err) {
            console.warn('[Editor] Server sync failed, falling back to LocalStorage', err);
        }

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
    public removeMultipleObjects(ids: string[]) { this.commandManager.removeObject(ids); } // CommandManager handles both string and string[]
    public removeObjectSilent(id: string) { this.commandManager.removeObjectSilent(id); }
    public selectObject(id: string | null, focus?: boolean) { this.commandManager.selectObject(id, focus); }

    public removeObjectWithConfirm(id: string) {
        const obj = this.findObjectById(id);
        if (!obj) {
            this.removeObject(id);
            return;
        }

        let report;
        if (obj.className === 'TAction' || obj.type === 'action') {
            report = RefactoringManager.getActionUsageReport(this.project, obj.name);
        } else if (obj.className === 'TTask' || obj.type === 'task') {
            report = RefactoringManager.getTaskUsageReport(this.project, obj.name);
        } else if (obj.scope === 'global' || obj.isVariable) {
            report = RefactoringManager.getVariableUsageReport(this.project, obj.name || id);
        } else {
            report = RefactoringManager.getObjectUsageReport(this.project, obj.name);
        }

        if (report && report.totalCount > 0) {
            const locations = report.locations.map(l => `- ${l.name} (${l.details})`).join('\n');
            const msg = `"${obj.name}" wird an ${report.totalCount} Stellen verwendet:\n\n${locations}\n\nMöchtest du das Element und alle Referenzen wirklich löschen?`;
            if (confirm(msg)) {
                // If the object is a FlowElement, use silent deletion to prevent double prompt
                // Casting to any to skip private check for now, or use a better way if available
                const flowManager = (this.flowEditor as any)?.graphManager;
                const nodes = flowManager?.host?.nodes;

                if (nodes && Array.isArray(nodes)) {
                    const node = nodes.find((n: any) => n.id === id);
                    if (node) {
                        flowManager.deleteNodeSilent(node);
                        return;
                    }
                }
                this.removeObject(id);
            }
        } else {
            if (confirm(`Möchtest du "${obj.name}" wirklich löschen?`)) {
                this.removeObject(id);
            }
        }
    }

    public removeMultipleObjectsWithConfirm(ids: string[]) {
        if (!ids || ids.length === 0) return;
        if (ids.length === 1) {
            this.removeObjectWithConfirm(ids[0]);
            return;
        }

        const objects = ids.map(id => this.findObjectById(id)).filter(o => o !== null);
        let totalReferences = 0;
        const allLocations: string[] = [];

        objects.forEach(obj => {
            let report;
            if (obj.className === 'TAction' || obj.type === 'action') {
                report = RefactoringManager.getActionUsageReport(this.project, obj.name);
            } else if (obj.className === 'TTask' || obj.type === 'task') {
                report = RefactoringManager.getTaskUsageReport(this.project, obj.name);
            } else if (obj.scope === 'global' || obj.isVariable) {
                report = RefactoringManager.getVariableUsageReport(this.project, obj.name || obj.id);
            } else {
                report = RefactoringManager.getObjectUsageReport(this.project, obj.name);
            }

            if (report && report.totalCount > 0) {
                totalReferences += report.totalCount;
                report.locations.forEach(l => {
                    allLocations.push(`- ${obj.name}: ${l.name} (${l.details})`);
                });
            }
        });

        if (totalReferences > 0) {
            const locations = allLocations.slice(0, 10).join('\n') + (allLocations.length > 10 ? '\n... und weitere' : '');
            const msg = `${objects.length} Elemente werden gelöscht. Es wurden ${totalReferences} Referenzen gefunden:\n\n${locations}\n\nMöchtest du alle Elemente und deren Referenzen wirklich löschen?`;
            if (confirm(msg)) {
                this.removeMultipleObjects(ids);
            }
        } else {
            if (confirm(`Möchtest du die ${objects.length} markierten Elemente wirklich löschen?`)) {
                this.removeMultipleObjects(ids);
            }
        }
    }

    public renameObjectWithRefactoring(id: string, newName: string) {
        this.commandManager.renameObject(id, newName);
    }

    public findObjectById(id: string) { return this.commandManager.findObjectById(id); }
    public findParentContainer(childId: string) { return this.commandManager.findParentContainer(childId); }
    public createObjectInstance(type: string, name: string, x: number, y: number) { return this.commandManager.createObjectInstance(type, name, x, y); }
    public setRunMode(running: boolean) { this.runManager.setRunMode(running); }
    public isRunning(): boolean { return this.runManager.runtime !== null; }
    public switchView(view: ViewType) { this.viewManager.switchView(view); }
    public createStage(type: StageType, name?: string) { return this.stageManager.createStage(type, name); }
    public switchStage(id: string, keepView?: boolean) {
        // ARCHITEKTUR-FIX: switchStage wird NUR von User-Aktionen aufgerufen (Menü, createStage).
        // Die Runtime-Navigation nutzt handleStageChange/handleStageSwitch statt switchStage.
        // Daher: Im Run-Mode erst Runtime stoppen, dann Stage wechseln.
        if (this.isRunning()) {
            this.setRunMode(false);
        }
        this.stageManager.switchStage(id);
        if (!keepView) {
            this.switchView('stage');
        }
    }
    public updateStagesMenu() { this.menuManager.updateStagesMenu(); }
    public handleRewind() { this.undoManager.handleRewind(); }
    public handleForward() { this.undoManager.handleForward(); }
    public applyRecordedAction(action: any, dir: 'rewind' | 'forward') { this.undoManager.applyRecordedAction(action, dir); }
    public loadProject(data: any) { this.dataManager.loadProject(data); }
    public newProject() {
        if (confirm('Möchtest du wirklich ein neues Projekt starten? Ungespeicherte Änderungen gehen verloren.')) {
            const freshProject = this.createDefaultProject();
            this.loadProject(freshProject);
            console.log('[Editor] Neues Projekt initialisiert');
        }
    }
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
        this.inspector.onObjectUpdate = (update: any) => {
            if (update.propertyName === 'name' && update.oldValue && update.oldValue !== update.newValue) {
                console.log(`[Editor] Name geändert: ${update.oldValue} -> ${update.newValue}. Starte Refactoring...`);
                this.renameObjectWithRefactoring(update.object.id, update.newValue);
            }
            this.renderManager.refreshAllViews('inspector');
        };
        this.inspector.onProjectUpdate = () => { this.render(); this.autoSaveToLocalStorage(); this.renderManager.refreshAllViews('inspector'); };
        this.inspector.onObjectDelete = (obj: any) => obj?.id && this.removeObjectWithConfirm(obj.id);
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

            // Binden der Selektion an den globalen Editor/Inspector
            this.flowEditor.onObjectSelect = (obj: any) => {
                if (obj && obj.id) {
                    this.selectObject(obj.id);
                } else {
                    this.selectObject(null);
                }
            };

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
