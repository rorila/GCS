import { coreStore } from '../services/registry/CoreStore';
import { Stage } from './Stage';
import { NotificationToast } from './ui/NotificationToast';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { GameProject, StageType, StageDefinition, GameAction, GameTask, ProjectVariable, ComponentData } from '../model/types';
import { RefactoringManager } from './RefactoringManager';
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
import { EditorProjectFactory } from './EditorProjectFactory';
import { EditorSessionManager } from './EditorSessionManager';
import { EditorStageImporter } from './EditorStageImporter';
import { EditorStageManager } from './EditorStageManager';
// projectPersistenceService wird via EditorDataManager genutzt (saveProject, exportHTML etc.)


import { libraryService } from '../services/LibraryService';
import { EditorViewManager, IViewHost, ViewType } from './EditorViewManager';
import { projectObjectRegistry } from '../services/registry/ObjectRegistry';
import { projectStore } from '../services/ProjectStore';
import { mediatorService, MediatorEvents } from '../services/MediatorService';
import { EditorCommandManager } from './services/EditorCommandManager';
import { EditorRunManager } from './services/EditorRunManager';
import { dataService } from '../services/DataService';
import { EditorDataManager } from './services/EditorDataManager';
import { EditorSimulatorManager } from './services/EditorSimulatorManager';
import { EditorRenderManager } from './services/EditorRenderManager';
import { EditorMenuManager } from './services/EditorMenuManager';
import { EditorKeyboardManager } from './services/EditorKeyboardManager';
import { snapshotManager } from './services/SnapshotManager';
import { EditorInteractionManager } from './services/EditorInteractionManager';
import { ObjectStore } from './services/ObjectStore';
import { ThemeStageService } from './services/ThemeStageService';
import { themeRegistry } from '../runtime/ThemeRegistry';
import { Logger } from '../utils/Logger';
import { loadComponentSchemas } from '../services/SchemaLoader';
import { HelpOverlay } from './HelpOverlay';
import { EditorSidepanel } from './EditorSidepanel';




/**
 * Editor.ts - Ultra-Lean Refactored Version
 * 
 * Diese Klasse fungiert nun als reiner Orchestrator (Host), der die Fachlogik
 * an spezialisierte Manager-Klassen delegiert.
 * Ziel: < 1000 Zeilen. Aktuell: ~200 Zeilen.
 */
export class Editor implements IViewHost {
    private static logger = Logger.get('Editor', 'Project_Save_Load');
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
    // public undoManager: EditorUndoManager; (REMOVED)
    public interactionManager: EditorInteractionManager;
    public themeStageService: ThemeStageService;

    // Core State
    public project: GameProject;
    public designRuntime: ReactiveRuntime;
    public currentSelectedId: string | null = null;
    public objectStore: ObjectStore = new ObjectStore();
    private useHorizontalToolbox: boolean = false;

    // Sidepanel
    private sidePanel: EditorSidepanel | null = null;
    public hideManagedObjectsOnStage: boolean = true;

    private projectFactory: EditorProjectFactory;
    private sessionManager: EditorSessionManager;
    private stageImporter: EditorStageImporter;

    public get isProjectDirty() { return this.viewManager.isProjectDirty; }
    public set isProjectDirty(v: boolean) { this.viewManager.isProjectDirty = v; }
    public renderUserStoriesList(): void { this.viewManager.renderUserStoriesList(); }
    public get selectedManager() { return this.viewManager.selectedManager; }
    public set selectedManager(v: string) { this.viewManager.selectedManager = v; }
    public get useStageIsolatedView() { return this.viewManager.useStageIsolatedView; }
    public set useStageIsolatedView(v: boolean) { this.viewManager.useStageIsolatedView = v; }

    public get workingProjectData() { return this.viewManager.workingProjectData; }
    public set workingProjectData(v: any) { this.viewManager.workingProjectData = v; }
    public showAddStageDialog(onComplete?: (data: any) => void) { this.viewManager.showAddStageDialog(onComplete); }
    public showConfigureProjectDialog(onComplete?: (data: any) => void) { this.viewManager.showConfigureProjectDialog(onComplete); }
    public showAddUseCaseDialog(stageId: string, prefilled?: { className?: string, name?: string }) { this.viewManager.showAddUseCaseDialog(stageId, prefilled); }
    public navigateToFlowChart(flowChartId: string) { this.viewManager.navigateToFlowChart(flowChartId); }
    public showInteractionDiagram(userStoryId: string, interactionId: string) { this.viewManager.showInteractionDiagram(userStoryId, interactionId); }
    public showKIGenerateDialog(): void { this.viewManager.showKIGenerateDialog(); }

    constructor() {
        this.designRuntime = new ReactiveRuntime();
        this.projectFactory = new EditorProjectFactory(this);
        this.project = this.projectFactory.createDefaultProject();

        // 1. Core Services & Registry
        coreStore.setProject(this.project);
        projectStore.setProject(this.project);
        this.stage = new Stage('stage', this.project.stage?.grid || this.project.stages?.[1]?.grid || this.project.stages?.[0]?.grid || { cols: 64, rows: 40, cellSize: 20 });
        this.dialogManager = new DialogManager();
        this.dialogManager.setProject(this.project);
        dialogService.setDialogManager(this.dialogManager);

        // 2. Initialize Managers
        this.stageManager = new EditorStageManager(this.project, this.stage, () => {
            if (this.themeStageService?.isThemeEditorActive() && this.project.activeStageId !== '__theme_editor__') {
                this.themeStageService.exitThemeEditor();
            }
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
        this.interactionManager = new EditorInteractionManager(this);
        this.themeStageService = new ThemeStageService(this);
        this.stageImporter = new EditorStageImporter(this);

        // Connect global Undo/Redo Engine
        snapshotManager.setRestoreCallback((projectData) => {
            this.loadProject(projectData);
        });

        // 3. System Services Registration
        this.registerGlobalServices();

        // 4. UI Setup
        this.debugLog = new TDebugLog();
        this.debugLog.setProject(this.project);
        this.debugLog.setEditor(this);
        this.initInspector();
        this.initJSONToolbox();
        this.initComponentPalette();
        this.initFlowEditor();
        this.initMenuBar();
        this.initSidePanel();
        this.initMediator();

        // 5. Manager Initialization
        this.simulatorManager.registerServices();
        this.keyboardManager.initKeyboardShortcuts();
        this.interactionManager.initCallbacks();

        // 6. View Events
        this.bindViewEvents();
        this.bindSystemInfoEvents();

        // 7. Load Persistence
        this.sessionManager = new EditorSessionManager(this);
        this.sessionManager.tryRestoreLastSession();

        // Setup toolbox toggle
        const toolboxToggleBtn = document.getElementById('toolbox-layout-toggle');
        if (toolboxToggleBtn) toolboxToggleBtn.onclick = () => this.toggleToolboxLayout();

        // Expose for E2E Testing
        if (window.location.search.includes('e2e=true')) {
            (window as any).mediatorService = mediatorService;
        }

        // 8a. HelpOverlay global initialisieren
        (window as any).helpOverlay = HelpOverlay.getInstance();

        // 8. Browser Navigation Guard (Back-Button / Refresh)
        window.onbeforeunload = (e) => {
            if (this.isProjectDirty) {
                e.preventDefault();
                e.returnValue = ''; // Standard-Browser-Warnung auslösen
            }
        };

        // 9. Hydration Error Guard (B-2 Silent Regression Prevention)
        if (typeof document !== 'undefined') {
            document.addEventListener('gcs-hydration-error', ((e: CustomEvent) => {
                Editor.logger.error('Caught Hydration Error:', e.detail);
                NotificationToast.show(`Ladefehler: ${e.detail.className} konnte nicht erzeugt werden!`, 'error');
            }) as EventListener);
        }
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

        // ComponentSchema laden (alle Module aus docs/schemas/)
        loadComponentSchemas('./docs/').catch(err => {
            Editor.logger.warn('ComponentSchema konnte nicht geladen werden:', err);
        });
    }

    // --- GETTERS ---
    public get currentObjects(): ComponentData[] {
        return projectObjectRegistry.getObjects('all');
    }
    public get currentActions(): GameAction[] { return this.stageManager.currentActions(); }
    public get currentTasks(): GameTask[] { return this.stageManager.currentTasks(); }
    public get currentVariables(): ProjectVariable[] { return this.stageManager.currentVariables(); }
    public getActiveStage(): StageDefinition | null {
        if (this.stage.runMode && this.runtime) {
            return (this.runtime as any).stage || this.stageManager.getActiveStage();
        }
        return this.stageManager.getActiveStage();
    }
    public get runtime() { return this.runManager.runtime; }
    public get runtimeObjects() { return this.runManager.runtimeObjects; }

    // --- DELEGATIONS ---
    public render() {
        if (this.stage.runMode && this.runManager.runStage) {
            this.renderManager.render(this.runManager.runStage);
        } else {
            this.renderManager.render();
        }
        this.refreshSidepanel();
    }
    public addObject(type: string, x: number, y: number) { this.commandManager.addObject(type, x, y); }
    public removeObject(id: string) { this.commandManager.removeObject(id); }
    public removeMultipleObjects(ids: string[]) { this.commandManager.removeObject(ids); } // CommandManager handles both string and string[]
    public removeObjectSilent(id: string) { this.commandManager.removeObjectSilent(id); }
    public selectObject(id: string | null, focus?: boolean) { this.commandManager.selectObject(id, focus); }

    public async removeObjectWithConfirm(id: string) {
        const obj = this.findObjectById(id);
        if (!obj) {
            this.removeObject(id);
            return;
        }

        const isInherited = !!obj.isInherited;
        const inheritedWarning = isInherited ? "\n\n⚠️ ACHTUNG: Dies ist ein geerbtes Objekt (aus dem Blueprint/Global).\nDas Löschen entfernt es permanent aus ALLEN Stages!" : "";

        let report;
        if (obj.className === 'TAction' || obj.type === 'action' || (obj as any).getType?.() === 'action') {
            report = RefactoringManager.getActionUsageReport(this.project, obj.name);
        } else if (obj.className === 'TTask' || obj.type === 'task') {
            report = RefactoringManager.getTaskUsageReport(this.project, obj.name);
        } else if (obj.isVariable) {
            report = RefactoringManager.getVariableUsageReport(this.project, obj.name || id);
        } else {
            report = RefactoringManager.getObjectUsageReport(this.project, obj.name);
        }

        if (report && report.totalCount > 0) {
            const locations = report.locations.map(l => `- ${l.name} (${l.details})`).join('\n');
            const msg = `"${obj.name}" wird an ${report.totalCount} Stellen verwendet:\n\n${locations}${inheritedWarning}\n\nMöchtest du das Element und alle Referenzen wirklich löschen?`;
            if (await ConfirmDialog.show(msg, 'Löschen bestätigen', 'Löschen', 'Abbrechen')) {
                // If the object is a FlowElement, use silent deletion to prevent double prompt
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
            if (await ConfirmDialog.show(`Möchtest du "${obj.name}" wirklich löschen?${inheritedWarning}`, 'Löschen bestätigen', 'Löschen', 'Abbrechen')) {
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
        }
    }

    public async removeMultipleObjectsWithConfirm(ids: string[]) {
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
            } else if (obj.isVariable) {
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
            if (await ConfirmDialog.show(msg, 'Mehrfach-Löschen bestätigen', 'Alle löschen', 'Abbrechen')) {
                this.removeMultipleObjects(ids);
            }
        } else {
            if (await ConfirmDialog.show(`Möchtest du die ${objects.length} markierten Elemente wirklich löschen?`, 'Mehrfach-Löschen bestätigen', 'Alle löschen', 'Abbrechen')) {
                this.removeMultipleObjects(ids);
            }
        }
    }

    public renameObjectWithRefactoring(id: string, newName: string, oldName?: string) {
        this.commandManager.renameObject(id, newName, oldName);
    }

    public findObjectById(id: string) { return this.commandManager.findObjectById(id); }
    public findParentContainer(childId: string) { return this.commandManager.findParentContainer(childId); }
    public createObjectInstance(type: string, name: string, x: number, y: number) { return this.commandManager.createObjectInstance(type, name, x, y); }
    public setRunMode(running: boolean) { this.runManager.setRunMode(running); }
    public isRunning(): boolean { return this.runManager.runtime !== null; }
    public switchView(view: ViewType) { this.viewManager.switchView(view); }
    public createStage(type: StageType, name?: string) { return this.stageManager.createStage(type, name); }
    public openThemeEditor() { this.themeStageService.enterThemeEditor(); }
    public editActiveTheme() { this.themeStageService.enterThemeEditor(themeRegistry.getActiveThemeId()); }
    public saveThemeFromEditor() { this.themeStageService.saveThemeAs(); }
    public exitThemeEditor() { this.themeStageService.exitThemeEditor(); }
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
        this.updateStageLabel();
        this.debugLog?.updateFilterDropdowns();
        this.selectObject(null);
    }
    public updateStagesMenu() { this.menuManager.updateStagesMenu(); }

    /**
     * Aktualisiert das Stage-Label in der Menüleiste mit dem Namen der aktiven Stage.
     */
    public updateStageLabel(): void {
        if (!this.menuBar) return;
        const activeStage = this.getActiveStage();
        const stageName = activeStage?.name || this.project.activeStageId || '–';
        this.menuBar.setStageLabel(stageName);
    }
    public handleRewind() { snapshotManager.undo(this.project); }
    public handleForward() { snapshotManager.redo(this.project); }
    public loadProject(data: any, sourcePath?: string) { this.dataManager.loadProject(data, sourcePath); }

    /**
     * ZENTRAL: Ersetzt das gesamte Projekt-Objekt und informiert alle Manager.
     * Verhindert Stale-References nach dem Laden.
     */
    public setProject(project: GameProject) {
        Editor.logger.info('Updating project reference across all managers');
        this.project = project;

        // 1. Registry & Services
        coreStore.setProject(project);
        projectStore.setProject(project);

        // 2. Specialized Managers
        this.stageManager.setProject(project);
        this.dialogManager.setProject(project);
        if (this.inspector) this.inspector.setProject(project);
        if (this.flowEditor) this.flowEditor.setProject(project);
        if (this.debugLog) this.debugLog.setProject(project);
        // dataManager, runManager etc. typically use this.host.project or ProjectRegistry

        // 3. UI State Reset
        this.currentSelectedId = null;
        if (this.stage) {
            const activeStage = this.stageManager.getActiveStage();
            if (activeStage && activeStage.grid) {
                // WICHTIG: backgroundImage VOR grid setzen, da der grid-Setter updategrid() auslöst
                this.stage.backgroundImage = (activeStage as any).backgroundImage || '';
                this.stage.backgroundImageMode = (activeStage as any).backgroundImageMode || 'cover';
                this.stage.grid = { ...activeStage.grid, backgroundColor: (activeStage as any).backgroundColor || activeStage.grid.backgroundColor };
            } else {
                const stageForBg = project.stage || project.stages?.[1] || project.stages?.[0];
                const grid = project.stage?.grid || project.stages?.[1]?.grid || project.stages?.[0]?.grid || { cols: 64, rows: 40, cellSize: 20, visible: true, backgroundColor: '#1e1e2e' };
                this.stage.grid = { ...grid, backgroundColor: (stageForBg as any)?.backgroundColor || grid.backgroundColor };
            }
        }

        // 4. Mediator Reset
        mediatorService.reset();

        // 5. Visual Refresh
        this.render();
        this.updateStagesMenu();
        this.updateStageLabel();
    }

    public createDefaultProject(): GameProject { return this.projectFactory.createDefaultProject(); }
    public async newProject() { return this.projectFactory.newProject(); }
    public async newProjectDirect(): Promise<void> { return this.projectFactory.newProjectDirect(); }
    public async createStageFromWizard(): Promise<void> { return this.projectFactory.createStageFromWizard(); }

    public saveProject() { this.dataManager.saveProject(); }
    public saveProjectToFile(overwriteConfirmed?: boolean) { return this.dataManager.saveProjectToFile(overwriteConfirmed); }
    public saveProjectAs() { return this.dataManager.saveProjectAs(); }
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

    public importStageFromFile(): void { this.stageImporter.importStageFromFile(); }

    public exportHTML() { this.dataManager.exportHTML(); }
    public exportHTMLCompressed() { this.dataManager.exportHTMLCompressed(); }
    public exportJSON() { this.dataManager.exportJSON(); }
    public exportJSONCompressed() { this.dataManager.exportJSONCompressed(); }
    public exportTheme() { this.dataManager.exportTheme(); }
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

            if (update.propertyName.toLowerCase() === 'name' && update.oldValue && update.oldValue !== update.newValue) {
                Editor.logger.info(`Name geändert: ${update.oldValue} -> ${update.newValue}. Starte Refactoring...`);
                this.renameObjectWithRefactoring(update.object.id || update.oldValue, update.newValue, update.oldValue);
            }
            this.autoSaveToLocalStorage(); // ARC-FIX: Persist property changes to disk!

            // FIX: Sprite-Bilder sofort auf der Stage aktualisieren, wenn Medien-Eigenschaften geändert werden
            const spriteMediaProps = ['animationId', 'imageListId', 'imageIndex', 'appearanceMode', 'videoSource',
                'sourceWidth', 'sourceHeight', 'sourceRectX', 'sourceRectY', 'sourceRectWidth', 'sourceRectHeight'];
            if (spriteMediaProps.includes(update.propertyName) &&
                (update.object?.className === 'TSprite' || update.object?.className === 'TSpriteTemplate')) {
                this.render();
            }

            // Kaskade TImageList → TAnimation → TSprite: Änderungen an der Quelle müssen
            // sofort auf die abhängigen Sprites (Vorschau + Frame-Ausschnitt) durchschlagen.
            const animationProps = ['frameDuration', 'imageCount', 'loop', 'enabled', 'imageListId'];
            const imageListProps = ['imageCountHorizontal', 'imageCountVertical', 'currentImageNumber', 'src', 'backgroundImage'];
            if ((update.object?.className === 'TAnimation' && animationProps.includes(update.propertyName)) ||
                (update.object?.className === 'TImageList' && imageListProps.includes(update.propertyName))) {
                this.render();
                this.runManager.syncAnimationToRuntime(update.object);
            }

            this.renderManager.refreshAllViews('inspector');
        };
        this.inspector.onProjectUpdate = () => { this.render(); this.autoSaveToLocalStorage(); this.renderManager.refreshAllViews('inspector'); };
        this.inspector.onObjectDelete = (obj: any) => obj?.id && this.removeObjectWithConfirm(obj.id);
        this.inspector.onObjectSelect = (id: string | null) => this.selectObject(id);
    }

    private async initJSONToolbox() {
        this.jsonToolbox = new JSONToolbox('json-toolbox-content');
        this.jsonToolbox.onAction = (type, toolType) => {
            if (type === 'click') {
                // Place in the middle of current view or at a default position
                this.addObject(toolType, 10, 10);
            }
        };
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
                if (obj && obj.isFlowNode) {
                    // Flow-Knoten (For/While/Repeat, Task, Action ...) haben keine Projekt-Objekt-ID.
                    // Sie werden daher direkt an den Inspector uebergeben.
                    this.currentSelectedId = obj.id;
                    if (this.inspector) this.inspector.update(obj);
                } else if (obj && obj.id) {
                    this.selectObject(obj.id);
                } else {
                    this.selectObject(null);
                }
            };

            this.flowEditor.onProjectChange = () => {
                this.autoSaveToLocalStorage();
                mediatorService.notifyDataChanged(this.project, 'flow-editor');
            };

            this.flowToolbox = new FlowToolbox('toolbox-content');
            this.flowToolbox.onItemClick = (type: string) => {
                if (this.flowEditor) {
                    this.flowEditor.createNode(type, 400, 300);
                }
            };
            this.flowToolbox.render();
            this.flowEditor.setProject(this.project);
        } catch (e) {
            Editor.logger.error('initFlowEditor error:', e);
        }
    }

    private initMenuBar() {
        this.menuManager.initMenuBar();
    }

    private initSidePanel() {
        this.sidePanel = new EditorSidepanel();
        this.sidePanel.callbacks = {
            onSelect: (id) => this.selectObject(id),
            onRename: (id, newName) => {
                const raw = this.findRawObjectInProject(id);
                if (raw) {
                    raw.name = newName;
                    this.render();
                    this.autoSaveToLocalStorage();
                }
            },
            onDelete: (id) => this.removeObjectWithConfirm(id),
            onRestoreToStage: (id) => this.moveObjectFromSidepanel(id),
            onToggleHideManaged: () => {
                this.hideManagedObjectsOnStage = !this.hideManagedObjectsOnStage;
                this.render();
            }
        };

        // Hamburger-Button binden (dynamisch erzeugen, falls nicht vorhanden)
        let toggleBtn = document.getElementById('sidepanel-toggle-btn');
        if (!toggleBtn) {
            const tabsContainer = document.getElementById('view-tabs');
            if (tabsContainer) {
                toggleBtn = document.createElement('button');
                toggleBtn.id = 'sidepanel-toggle-btn';
                toggleBtn.className = 'tab-btn sidepanel-hamburger';
                toggleBtn.title = 'Komponenten-Regal';
                toggleBtn.style.fontWeight = 'bold';
                toggleBtn.textContent = '☰';
                tabsContainer.insertBefore(toggleBtn, tabsContainer.firstChild);
            }
        }
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.sidePanel?.toggle());
        }

        // Sidepanel mit aktueller Stage befüllen
        this.refreshSidepanel();
    }

    public refreshSidepanel(): void {
        if (!this.sidePanel) return;
        this.sidePanel.loadObjects(this.getSidepanelObjectSources());
    }

    private getSidepanelObjectSources(): { id: string; name: string; className: string }[] {
        const activeStage = this.getActiveStage();
        if (!activeStage?.objects) return [];
        return activeStage.objects
            .filter((o: any) => o.isManagedInSidepanel === true)
            .map((o: any) => ({ id: o.id, name: o.name, className: o.className }));
    }

    public isDialog(className?: string): boolean {
        if (!className) return false;
        return ['TDialog', 'TDialogRoot', 'TToast'].includes(className);
    }

    public canMoveToSidepanel(objOrClassName: any): boolean {
        const className = typeof objOrClassName === 'string' ? objOrClassName : objOrClassName?.className;
        if (!className) return false;
        if (objOrClassName?.isHiddenInRun === true) return true;
        if (objOrClassName?.isVariable === true) return true;
        return this.isDialog(className);
    }

    private findRawObjectInProject(id: string): any | null {
        if (this.project.objects) {
            const found = this.project.objects.find((o: any) => o.id === id);
            if (found) return found;
        }
        for (const stage of this.project.stages || []) {
            if (stage.objects) {
                const found = stage.objects.find((o: any) => o.id === id);
                if (found) return found;
            }
        }
        return null;
    }

    public moveObjectToSidepanel(objOrId: any): void {
        const obj = typeof objOrId === 'string' ? this.findObjectById(objOrId) : objOrId;
        if (!obj) return;
        if (obj.isManagedInSidepanel) return;
        if (!this.canMoveToSidepanel(obj)) return;

        const rawObj = this.findRawObjectInProject(obj.id);
        if (rawObj) {
            rawObj.isManagedInSidepanel = true;
        }
        obj.isManagedInSidepanel = true;
        this.hideManagedObjectsOnStage = true;
        this.sidePanel?.setHideManagedActive(true);
        this.refreshSidepanel();
        this.render();
        this.autoSaveToLocalStorage();
    }

    public moveObjectFromSidepanel(id: string): void {
        const rawObj = this.findRawObjectInProject(id);
        if (!rawObj || !rawObj.isManagedInSidepanel) return;
        rawObj.isManagedInSidepanel = false;
        this.sidePanel?.removeObject(id);
        this.render();
        this.autoSaveToLocalStorage();
    }

    private initMediator() {
        mediatorService.on(MediatorEvents.DATA_CHANGED, (_data: any, originator?: string) => {
            // Wenn sich Daten ändern (z.B. neue Actions hinzugefügt), müssen wir die Views aktualisieren.
            // Der Originator hilft zu vermeiden, dass wir Events im Kreis schicken.
            // 'store-dispatch' kommt von der ProjectStore-Bridge und darf NICHT refreshAllViews
            // auslösen, da der aufrufende Code (z.B. onObjectMove) bereits selbst render() aufruft.
            if (originator !== 'editor' && originator !== 'inspector' && originator !== 'store-dispatch') {
                this.renderManager.refreshAllViews(originator);
            } else if (originator === 'store-dispatch') {
                // Store-Änderungen: Nur render(), KEIN flowEditor.setProject()
                // ABER wir müssen den Inspector synchronisieren, damit verschobene/skalierte Objekte aktualisiert werden!
                this.render();
                if (this.inspector && this.currentSelectedId) {
                    const obj = this.findObjectById(this.currentSelectedId);
                    if (obj) this.inspector.update(obj);
                }
            } else {
                // Auch bei Inspector-Änderungen rendern wir sofort (Live-Preview)
                this.render();
            }
        });
    }

    private bindViewEvents() {
        const tabsContainer = document.getElementById('view-tabs');
        if (tabsContainer) {
            tabsContainer.addEventListener('click', (e) => {
                const btn = (e.target as HTMLElement).closest('.tab-btn') as HTMLElement;
                if (btn) {
                    const view = btn.getAttribute('data-view') as ViewType;
                    if (view) {
                        Editor.logger.info(`Switching view to: ${view}`);
                        this.switchView(view);
                    }
                }
            });
        } else {
            // Fallback for direct binding if container not found yet
            document.querySelectorAll('.tab-btn').forEach(btn => {
                (btn as HTMLElement).onclick = (e: MouseEvent) => {
                    const view = (e.currentTarget as HTMLElement).getAttribute('data-view') as ViewType;
                    if (view) {
                        this.switchView(view);
                    }
                };
            });
        }
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
}
