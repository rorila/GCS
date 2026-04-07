import { Stage } from './Stage';
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
import { EditorStageManager } from './EditorStageManager';
// projectPersistenceService wird via EditorDataManager genutzt (saveProject, exportHTML etc.)
import { projectRegistry } from '../services/ProjectRegistry';

import { libraryService } from '../services/LibraryService';
import { EditorViewManager, IViewHost, ViewType } from './EditorViewManager';
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
import { Logger } from '../utils/Logger';




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

    // Core State
    public project: GameProject;
    public designRuntime: ReactiveRuntime;
    public currentSelectedId: string | null = null;
    public objectStore: ObjectStore = new ObjectStore();
    private useHorizontalToolbox: boolean = false;

    public get isProjectDirty() { return this.viewManager.isProjectDirty; }
    public set isProjectDirty(v: boolean) { this.viewManager.isProjectDirty = v; }

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
        this.interactionManager = new EditorInteractionManager(this);

        // Connect global Undo/Redo Engine
        snapshotManager.setRestoreCallback((projectData) => {
            this.loadProject(projectData);
        });

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

        // Expose for E2E Testing
        if (window.location.search.includes('e2e=true')) {
            (window as any).mediatorService = mediatorService;
        }

        // 8. Browser Navigation Guard (Back-Button / Refresh)
        window.onbeforeunload = (e) => {
            if (this.isProjectDirty) {
                e.preventDefault();
                e.returnValue = ''; // Standard-Browser-Warnung auslösen
            }
        };
    }

    private createDefaultProject(): GameProject {
        const blueprintStage: StageDefinition = {
            id: 'blueprint',
            name: 'Blueprint (Global)',
            type: 'blueprint',
            objects: [
                {
                    id: 'stage_controller',
                    name: 'StageController',
                    className: 'TStageController',
                    scope: 'global',
                    isService: true,
                    x: 2,
                    y: 2,
                    width: 8,
                    height: 4
                } as any
            ],
            actions: [],
            tasks: [],
            variables: [
                {
                    id: 'var_project_change',
                    name: 'isProjectChangeAvailable',
                    type: 'boolean',
                    defaultValue: false,
                    value: false,
                    scope: 'global',
                    className: 'TVariable',
                    isVariable: true,
                    x: 12,
                    y: 2,
                    width: 10,
                    height: 4
                } as any
            ],
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
            meta: { name: "Neues Spiel", version: "1.0.0", author: "", description: "" },
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
        if (window.location.search.includes('e2e=true')) {
            Editor.logger.info('E2E mode detected: skipping session restoration');
            return;
        }

        // 1. LocalStorage-Projekt lesen
        const localJson = localStorage.getItem('gcs_last_project');
        let localProject: any = null;
        if (localJson) {
            try {
                localProject = JSON.parse(localJson);
            } catch (err) {
                Editor.logger.warn('LocalStorage project parse error, ignoring', err);
            }
        }

        // 2. LocalStorage vorhanden → direkt laden (Priorität!)
        if (localProject) {
            const name = localProject.meta?.name || 'Unbenannt';
            const sourcePath = localProject.meta?._sourcePath || `projects/${(localProject.meta?.name || 'Unbenannt').replace(/[^a-zA-Z0-9_\\-]/g, '_')}.json`;
            this.loadProject(localProject, sourcePath);
            Editor.logger.info(`Projekt aus LocalStorage geladen: "${name}" (Pfad: ${sourcePath})`);
            return;
        }

        // 3. Kein LocalStorage → leeres Projekt (User hat Cache gelöscht)
        Editor.logger.info('Kein LocalStorage-Projekt gefunden → neues leeres Projekt');
        this.switchView('stage');
    }


    // --- GETTERS ---
    public get currentObjects(): ComponentData[] { return this.stageManager.currentObjects(); }
    public set currentObjects(objs: ComponentData[]) { this.stageManager.setCurrentObjects(objs); }
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
    }
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

        const isInherited = !!obj.isInherited;
        const inheritedWarning = isInherited ? "\n\n⚠️ ACHTUNG: Dies ist ein geerbtes Objekt (aus dem Blueprint/Global).\nDas Löschen entfernt es permanent aus ALLEN Stages!" : "";

        let report;
        if (obj.className === 'TAction' || obj.type === 'action' || (obj as any).getType?.() === 'action') {
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
            const msg = `"${obj.name}" wird an ${report.totalCount} Stellen verwendet:\n\n${locations}${inheritedWarning}\n\nMöchtest du das Element und alle Referenzen wirklich löschen?`;
            if (confirm(msg)) {
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
            if (confirm(`Möchtest du "${obj.name}" wirklich löschen?${inheritedWarning}`)) {
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
        projectRegistry.setProject(project);
        projectStore.setProject(project);

        // 2. Specialized Managers
        this.stageManager.setProject(project);
        this.dialogManager.setProject(project);
        if (this.inspector) this.inspector.setProject(project);
        if (this.flowEditor) this.flowEditor.setProject(project);
        // dataManager, runManager etc. typically use this.host.project or ProjectRegistry

        // 3. UI State Reset
        this.currentSelectedId = null;
        if (this.stage) {
            const activeStage = this.getActiveStage();
            if (activeStage && activeStage.grid) {
                // WICHTIG: backgroundImage VOR grid setzen, da der grid-Setter updategrid() auslöst
                this.stage.backgroundImage = (activeStage as any).backgroundImage || '';
                this.stage.backgroundImageMode = (activeStage as any).backgroundImageMode || 'cover';
                this.stage.grid = activeStage.grid;
            } else {
                this.stage.grid = project.stage.grid;
            }
        }

        // 4. Mediator Reset
        mediatorService.reset();

        // 5. Visual Refresh
        this.render();
        this.updateStagesMenu();
        this.updateStageLabel();
    }

    public newProject() {
        if (this.isProjectDirty) {
            if (!confirm('Sie haben ungespeicherte Änderungen. Möchten Sie wirklich ein neues Projekt starten?')) {
                return;
            }
        }
        // LocalStorage komplett leeren (alte Projekt-Daten, Panel-Einstellungen etc.)
        localStorage.clear();
        Editor.logger.info('LocalStorage geleert für neues Projekt');

        const freshProject = this.createDefaultProject();
        this.loadProject(freshProject);
        Editor.logger.info('Neues Projekt initialisiert');
    }
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

    /**
     * Stage-Import: Öffnet File-Picker, zeigt Stage-Auswahl-Dialog,
     * importiert die gewählte Stage inkl. aller Abhängigkeiten.
     */
    public importStageFromFile(): void {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (re) => {
                try {
                    const sourceProject: GameProject = JSON.parse(re.target?.result as string);
                    if (!sourceProject.stages || sourceProject.stages.length === 0) {
                        alert('Das gewählte Projekt enthält keine Stages.');
                        return;
                    }

                    // Nur importierbare Stages (kein Blueprint)
                    const importableStages = sourceProject.stages.filter(s => s.type !== 'blueprint');
                    if (importableStages.length === 0) {
                        alert('Das Projekt enthält nur eine Blueprint-Stage, die nicht importiert werden kann.');
                        return;
                    }

                    // Bei nur einer Stage: direkt importieren
                    if (importableStages.length === 1) {
                        const imported = this.stageManager.importStageFromProject(sourceProject, importableStages[0].id);
                        if (imported) {
                            this.updateStagesMenu();
                            this.updateStageLabel();
                            mediatorService.notifyDataChanged(this.project, 'stage-import');
                            alert(`Stage "${imported.stage.name}" erfolgreich importiert!`);
                        }
                        return;
                    }

                    // Mehrere Stages: Auswahl-Dialog
                    this.showStageSelectionDialog(sourceProject, importableStages);
                } catch (err) {
                    alert('Fehler beim Lesen der Projektdatei: ' + (err as Error).message);
                }
            };
            reader.readAsText(file);
        };
        fileInput.click();
    }

    private showStageSelectionDialog(sourceProject: GameProject, stages: StageDefinition[]): void {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:20000;display:flex;align-items:center;justify-content:center;';

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background:#252526; border:1px solid #555; border-radius:8px;
            box-shadow:0 8px 32px rgba(0,0,0,0.6); min-width:380px; max-width:500px;
            color:#ccc; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
        `;

        const header = document.createElement('div');
        header.style.cssText = 'padding:16px 20px 12px;border-bottom:1px solid #444;font-size:15px;font-weight:600;color:#fff;';
        header.textContent = `📥 Stage importieren — ${sourceProject.meta?.name || 'Externes Projekt'}`;
        dialog.appendChild(header);

        const info = document.createElement('div');
        info.style.cssText = 'padding:8px 20px;font-size:12px;color:#888;';
        info.textContent = `${stages.length} importierbare Stage(s) gefunden. Wähle eine oder mehrere:`;
        dialog.appendChild(info);

        const list = document.createElement('div');
        list.style.cssText = 'padding:8px 20px;max-height:300px;overflow-y:auto;';

        const checkboxes: { id: string, name: string, cb: HTMLInputElement }[] = [];
        for (const stage of stages) {
            const objCount = (stage.objects || []).length;
            const taskCount = (stage.tasks || []).length;
            const actionCount = (stage.actions || []).length;

            const row = document.createElement('label');
            row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 4px;cursor:pointer;border-radius:4px;transition:background 0.15s;';
            row.onmouseenter = () => row.style.background = '#333';
            row.onmouseleave = () => row.style.background = 'transparent';

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = true;
            cb.style.cssText = 'width:16px;height:16px;accent-color:#4fc3f7;cursor:pointer;';
            row.appendChild(cb);

            const label = document.createElement('span');
            label.style.cssText = 'flex:1;font-size:13px;';
            label.textContent = `🎭 ${stage.name}`;
            row.appendChild(label);

            const details = document.createElement('span');
            details.style.cssText = 'font-size:11px;color:#888;';
            details.textContent = `${objCount} Obj · ${taskCount} Tasks · ${actionCount} Actions`;
            row.appendChild(details);

            list.appendChild(row);
            checkboxes.push({ id: stage.id, name: stage.name, cb });
        }
        dialog.appendChild(list);

        const footer = document.createElement('div');
        footer.style.cssText = 'padding:12px 20px;border-top:1px solid #444;display:flex;gap:8px;justify-content:flex-end;';

        const btnImport = document.createElement('button');
        btnImport.textContent = 'Importieren';
        btnImport.style.cssText = 'padding:6px 14px;border:none;background:#094771;color:#fff;border-radius:4px;cursor:pointer;font-size:13px;';
        btnImport.onmouseenter = () => btnImport.style.background = '#0b5d99';
        btnImport.onmouseleave = () => btnImport.style.background = '#094771';

        const btnCancel = document.createElement('button');
        btnCancel.textContent = 'Abbrechen';
        btnCancel.style.cssText = 'padding:6px 14px;border:1px solid #555;background:#333;color:#ccc;border-radius:4px;cursor:pointer;font-size:13px;';
        btnCancel.onmouseenter = () => btnCancel.style.background = '#444';
        btnCancel.onmouseleave = () => btnCancel.style.background = '#333';

        footer.appendChild(btnImport);
        footer.appendChild(btnCancel);
        dialog.appendChild(footer);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        const close = () => overlay.remove();
        overlay.addEventListener('click', (ev) => { if (ev.target === overlay) close(); });
        btnCancel.onclick = close;

        const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { close(); window.removeEventListener('keydown', onKey); } };
        window.addEventListener('keydown', onKey);

        btnImport.onclick = () => {
            const selected = checkboxes.filter(c => c.cb.checked);
            if (selected.length === 0) { alert('Keine Stage ausgewählt.'); return; }

            const importedNames: string[] = [];
            const importedStages: StageDefinition[] = [];
            const stageIdMap = new Map<string, string>();

            for (const sel of selected) {
                const result = this.stageManager.importStageFromProject(sourceProject, sel.id);
                if (result) {
                    importedNames.push(result.stage.name);
                    importedStages.push(result.stage);
                    stageIdMap.set(result.oldStageId, result.newStageId);
                }
            }

            // navigate_stage-Actions in allen importierten Stages auf neue IDs remappen
            if (stageIdMap.size > 0 && importedStages.length > 1) {
                this.stageManager.remapStageReferences(importedStages, stageIdMap);
            }

            close();
            window.removeEventListener('keydown', onKey);
            this.updateStagesMenu();
            this.updateStageLabel();
            mediatorService.notifyDataChanged(this.project, 'stage-import');
            alert(`${importedNames.length} Stage(s) importiert:\n${importedNames.join('\n')}`);
        };
    }
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

            if (update.propertyName.toLowerCase() === 'name' && update.oldValue && update.oldValue !== update.newValue) {
                Editor.logger.info(`Name geändert: ${update.oldValue} -> ${update.newValue}. Starte Refactoring...`);
                this.renameObjectWithRefactoring(update.object.id, update.newValue, update.oldValue);
            }
            this.autoSaveToLocalStorage(); // ARC-FIX: Persist property changes to disk!

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
                if (obj && obj.id) {
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
                        console.error(`\n\n================================================`);
                        console.error(`STEP 1: USER CLICKED TAB: ${view}`);
                        console.error(`================================================\n\n`);
                        alert(`Du hast auf den Tab "${view}" geklickt! Klicke auf OK, um fortzufahren.`);
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
                        console.error(`STEP 1 (Fallback): USER CLICKED TAB: ${view}`);
                        alert(`Du hast auf den Tab "${view}" geklickt!`);
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
