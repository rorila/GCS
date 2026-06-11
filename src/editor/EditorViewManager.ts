import { GameProject, StageDefinition } from '../model/types';
import { projectStore } from '../services/ProjectStore';
import { Logger } from '../utils/Logger';
import { InspectorHost } from './inspector/InspectorHost';
import { FlowEditor } from './FlowEditor';
import { FlowToolbox } from './FlowToolbox';
import { TDebugLog } from '../components/TDebugLog';
import { safeDeepCopy } from '../utils/DeepCopy';
import { mediatorService } from '../services/MediatorService';
import { MediatorEvents } from '../services/MediatorService';
import { GameExporter } from '../export/GameExporter';
import { StageDialogs } from './dialogs/StageDialogs';
import { UseCaseDialog } from './dialogs/UseCaseDialog';
import { ManagementViewManager } from './views/ManagementViewManager';
import { CodeViewManager } from './views/CodeViewManager';
import { JSONViewManager } from './views/JSONViewManager';
import { UserStoryDetailManager } from './userstories/UserStoryDetailManager';
import { UserStoriesViewManager } from './userstories/UserStoriesViewManager';

const logger = Logger.get('EditorViewManager');


export interface IViewHost {
    project: GameProject;
    flowEditor: FlowEditor | null;
    flowToolbox: FlowToolbox | null;
    inspector: InspectorHost | null;
    debugLog: TDebugLog | null;
    setRunMode(active: boolean): void;
    isRunning(): boolean;
    refreshJSONView(): void;
    getActiveStage(): StageDefinition | null;
    render(): void;
    findObjectById(id: string): any;
    autoSaveToLocalStorage(): void;
    currentSelectedId: string | null;
    selectObject(id: string | null, focus?: boolean): void;
    switchView(view: ViewType): void;
    switchStage(id: string, keepView?: boolean): void;
    setProject(project: GameProject): void;
    isProjectDirty: boolean;
    renderUserStoriesList(): void;
    selectedManager: string;
    useStageIsolatedView: boolean;
    workingProjectData: any;
    showAddStageDialog(onComplete?: (data: any) => void): void;
    showConfigureProjectDialog(onComplete?: (data: any) => void): void;
    showAddUseCaseDialog(stageId: string, prefilled?: { className?: string, name?: string }): void;
    navigateToFlowChart(flowChartId: string): void;
    showInteractionDiagram(userStoryId: string, interactionId: string): void;
}

export type ViewType = 'stage' | 'json' | 'run' | 'flow' | 'code' | 'management' | 'iframe' | 'userstories';

export class EditorViewManager {
    private static logger = Logger.get('ViewManager', 'Editor_Diagnostics');
    public currentView: ViewType = 'stage';
    public pascalEditorMode: boolean = false;
    public jsonMode: 'viewer' | 'editor' = 'viewer';
    public useStageIsolatedView: boolean = true;
    public workingProjectData: any = null;
    /**
     * isProjectDirty delegiert auf die Blueprint-Variable 'isProjectChangeAvailable'.
     * Diese Variable ist JSON-persistent und überlebt Browser-Reloads.
     */
    public get isProjectDirty(): boolean {
        const changeVar = this.findChangeVar();
        if (changeVar) {
            return !!(changeVar.defaultValue || (changeVar as any).value);
        }
        return false;
    }
    public set isProjectDirty(v: boolean) {
        let changeVar = this.findChangeVar();
        if (!changeVar) {
            // Fallback: If the variable doesn't exist (e.g., in a newly created or imported project), create it!
            const blueprint = this.host.project?.stages?.find(s =>
                s.id === 'blueprint' || s.id === 'stage_blueprint' || s.type === 'blueprint'
            );
            if (blueprint) {
                if (!blueprint.variables) blueprint.variables = [];
                changeVar = {
                    className: 'TBooleanVariable',
                    id: 'var_isProjectChangeAvailable',
                    name: 'isProjectChangeAvailable',
                    type: 'boolean',
                    defaultValue: false,
                    value: false,
                    isGlobal: true,
                    description: 'System internal flag to track unsaved changes'
                };
                blueprint.variables.push(changeVar);
                EditorViewManager.logger.info("Auto-created missing 'isProjectChangeAvailable' variable in blueprint stage.");
            }
        }
        
        if (changeVar) {
            changeVar.defaultValue = v;
            (changeVar as any).value = v;
        }
    }
    private findChangeVar(): any {
        const blueprint = this.host.project?.stages?.find(s =>
            s.id === 'blueprint' || s.id === 'stage_blueprint' || s.type === 'blueprint'
        );
        return blueprint?.variables?.find((v: any) => v.name === 'isProjectChangeAvailable') || null;
    }
    public selectedManager: string = 'VisualObjects';
    public selectedPascalTask: string | null = null;
    private stageDialogs!: StageDialogs;
    private useCaseDialog!: UseCaseDialog;
    private userStoryDetailManager!: UserStoryDetailManager;
    private userStoriesViewManager!: UserStoriesViewManager;
    private _lastExtractedRef: { value: any[] } = { value: [] };
    private managementViewManager!: ManagementViewManager;
    private codeViewManager!: CodeViewManager;
    private jsonViewManager!: JSONViewManager;

    constructor(private host: IViewHost) {
        this.initMediator();
        this.stageDialogs = new StageDialogs(this.host);
        this.userStoryDetailManager = new UserStoryDetailManager(this.host);
        this.userStoriesViewManager = new UserStoriesViewManager(this.host);
        this.useCaseDialog = new UseCaseDialog(this.host);
        this.managementViewManager = new ManagementViewManager(this.host);
        this.codeViewManager = new CodeViewManager(this.host);
        this.jsonViewManager = new JSONViewManager(this.host);
    }

    private initMediator() {
        mediatorService.on(MediatorEvents.DATA_CHANGED, (_data: any, originator?: string) => {
            // Mark project as dirty only on REAL user changes (not on load/autosave)
            const isLoadEvent = originator === 'editor-load' || originator === 'autosave';
            if (!isLoadEvent) {
                this.isProjectDirty = true;
            }

            // Always refresh management data if panel is present
            const panel = document.getElementById('management-viewer');
            if (panel) {
                EditorViewManager.logger.info(`Refreshing management view due to ${originator || 'external'} change`);
                this.renderManagementView(panel);
            }
        });

        mediatorService.on(MediatorEvents.OBJECT_SELECTED, (obj: any) => {
            if (this.currentView === 'management' && obj) {
                // Potential: Highlight row if manager matches object type
            }
        });
    }

    public switchView(view: ViewType) {
        const h = this.host;
        EditorViewManager.logger.info(`[TRACE] switchView called: ${this.currentView} -> ${view}`, { stack: new Error().stack });

        // Sync flow editor changes back to project before switching views
        if (this.currentView === 'flow' && h.flowEditor) {
            h.flowEditor.syncToProjectIfDirty();
            h.flowEditor.syncAllTasksFromFlow(h.project);
        }

        this.currentView = view;
        const stageWrapper = document.getElementById('stage-wrapper');
        const runStage = document.getElementById('run-stage');
        const jsonPanel = document.getElementById('json-viewer');
        const flowPanel = document.getElementById('flow-viewer');
        const codePanel = document.getElementById('code-viewer');
        const managementPanel = document.getElementById('management-viewer');
        const iframePanel = document.getElementById('iframe-viewer');
        const userstoriesPanel = document.getElementById('userstories-viewer');
        const tabs = document.querySelectorAll('.tab-btn');

        // Update Tabs
        tabs.forEach(t => t.classList.remove('active'));
        document.querySelector(`.tab-btn[data-view="${view}"]`)?.classList.add('active');

        // 1. Hide ALL panels
        if (stageWrapper) stageWrapper.style.display = 'none';
        if (runStage) runStage.style.display = 'none';
        if (jsonPanel) jsonPanel.style.display = 'none';
        const jsonToolbar = document.getElementById('json-viewer-toolbar');
        if (jsonToolbar) jsonToolbar.style.display = 'none';
        if (flowPanel) flowPanel.style.display = 'none';
        if (codePanel) codePanel.style.display = 'none';
        if (managementPanel) managementPanel.style.display = 'none';
        if (userstoriesPanel) userstoriesPanel.style.display = 'none';
        if (iframePanel) {
            iframePanel.style.display = 'none';
            if (view !== 'iframe') {
                // Ensure iframe process is terminated when hidden
                iframePanel.innerHTML = '';
            }
        }

        // Hide standard toolboxes
        // Hide flow toolbox if it exists
        if (h.flowToolbox) h.flowToolbox.hide();

        // 2. Clear state
        h.selectObject(null);

        // Hide standard toolboxes and inspectors
        const jsonToolbox = document.getElementById('json-toolbox-content');
        const jsonInspector = document.getElementById('json-inspector-content');
        const toolboxFooter = document.getElementById('toolbox-footer');
        if (jsonToolbox) jsonToolbox.style.display = 'none';
        if (jsonInspector) jsonInspector.style.display = 'none';
        if (toolboxFooter) toolboxFooter.style.display = 'none';

        // Stop debug logging and hide panel when switching away from 'run' view
        if (h.debugLog) {
            h.debugLog.setButtonVisible(view === 'run');
            if (view !== 'run') {
                h.debugLog.setRecordingActive(false);
                h.debugLog.hide();
            }
        }

        // 2. Show Selected Panel
        if (view === 'stage') {
            h.setRunMode(false);
            if (stageWrapper) stageWrapper.style.display = 'flex';
            if (runStage) runStage.style.display = 'none';
            if (jsonToolbox) jsonToolbox.style.display = 'block';
            if (jsonInspector) jsonInspector.style.display = 'block';
            // Debug Log button hidden in stage view
            if (toolboxFooter) toolboxFooter.style.display = 'none';

            if (h.inspector) {
                h.inspector.setFlowContext(null);
            }
        } else if (view === 'run') {
            if (h.debugLog) {
                h.debugLog.clearLogs();
            }
            h.setRunMode(true);
            if (stageWrapper) stageWrapper.style.display = 'none';
            if (runStage) runStage.style.display = 'flex';
            if (toolboxFooter) {
                toolboxFooter.style.display = 'block';
                toolboxFooter.style.minHeight = '60px';
            }
        } else if (view === 'json') {
            h.setRunMode(false);
            if (jsonPanel) {
                jsonPanel.style.display = 'block';
                this.jsonMode = 'viewer';
                this.workingProjectData = safeDeepCopy(h.project);
                this.isProjectDirty = false;

                // Add toolbar for JSON view if not present
                let toolbar = document.getElementById('json-viewer-toolbar');
                if (!toolbar) {
                    toolbar = this.jsonViewManager['createJSONToolbar']();
                    if (jsonPanel.parentNode) jsonPanel.parentNode.insertBefore(toolbar, jsonPanel);
                } else {
                    this.updateJSONToolbar(toolbar);
                }

                h.refreshJSONView();
            }
        } else if (view === 'flow') {
            h.setRunMode(false);
            if (flowPanel) flowPanel.style.display = 'block';
            if (jsonInspector) jsonInspector.style.display = 'block';
            // Debug Log button hidden in flow view
            if (toolboxFooter) toolboxFooter.style.display = 'none';

            if (h.flowEditor) {
                h.flowEditor.show();
                h.flowEditor.setProject(h.project);
                if (h.inspector) {
                    h.inspector.setFlowContext(h.flowEditor.getNodes());
                    // Inspector leeren – keine Stage-Daten aus dem Edit-Mode anzeigen.
                    // Erst bei Klick auf einen Flow-Node wird der Inspector befüllt.
                    h.inspector.update(null);
                }
            }
            if (h.flowToolbox) {
                h.flowToolbox.render();
                h.flowToolbox.show();
            }
        } else if (view === 'code') {
            h.setRunMode(false);
            this.renderCodeView(codePanel);
        } else if (view === 'management') {
            h.setRunMode(false);
            if (managementPanel) {
                managementPanel.style.display = 'flex';
                this.renderManagementView(managementPanel);
            }
        } else if (view === 'userstories') {
            h.setRunMode(false);
            if (userstoriesPanel) {
                userstoriesPanel.style.display = 'block';
                userstoriesPanel.style.height = '100%';
                userstoriesPanel.style.overflowY = 'auto';
                EditorViewManager.logger.debug('[UserStories] Panel-Höhe gesetzt:', userstoriesPanel.style.height);
                EditorViewManager.logger.debug('[UserStories] Panel-Overflow gesetzt:', userstoriesPanel.style.overflowY);
                EditorViewManager.logger.debug('[UserStories] Panel-Display gesetzt:', userstoriesPanel.style.display);
                this.renderUserStoriesView(userstoriesPanel);
            }
        } else if (view === 'iframe') {
            h.setRunMode(false);
            if (stageWrapper) stageWrapper.style.display = 'none';
            if (iframePanel) {
                iframePanel.style.display = 'flex';
                this.renderIFrameView(iframePanel);
            }
            if (toolboxFooter) {
                toolboxFooter.style.display = 'block';
                toolboxFooter.style.minHeight = '60px';
            }
        }

        h.render();
    }

    public render() {
        this.host.render();
    }

    private renderUserStoriesView(panel: HTMLElement) {
        this.userStoriesViewManager.renderUserStoriesView(panel);
    }

    public renderUserStoriesList() {
        this.userStoriesViewManager.renderUserStoriesList(this._lastExtractedRef);
    }


    public showAddStageDialog(onComplete?: (data: any) => void) {
        this.stageDialogs.showAddStageDialog(onComplete);
    }

    public showConfigureProjectDialog(onComplete?: (data: any) => void) {
        this.stageDialogs.showConfigureProjectDialog(onComplete);
    }

    /**
     * Dialog zum Bearbeiten der Projekt-Eigenschaften (Name, Autor, Beschreibung).
     * Erreichbar über Menü: Projekt → Eigenschaften
     */
    public showEditProjectPropertiesDialog() {
        this.stageDialogs.showEditProjectPropertiesDialog();
    }

    public showAddUseCaseDialog(stageId: string, prefilled?: { className?: string, name?: string }) {
        this.useCaseDialog.showAddUseCaseDialog(stageId, prefilled);
    }

    public editUserStory(id: string) {
        this.userStoryDetailManager.editUserStory(id);
    }

    public navigateToFlowChart(flowChartId: string) {
        this.userStoryDetailManager['navigateToFlowChart'](flowChartId);
    }

    public showInteractionDiagram(userStoryId: string, interactionId: string) {
        this.userStoryDetailManager['showInteractionDiagram'](userStoryId, interactionId);
    }

    private renderIFrameView(panel: HTMLElement) {
        panel.innerHTML = '';
        
        const iframe = document.createElement('iframe');
        const ts = Date.now();
        iframe.src = window.location.protocol === 'file:' ? `iframe-runner.html?t=${ts}` : `/iframe-runner.html?t=${ts}`;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.tabIndex = 0;

        const exporter = new GameExporter();
        
        // ── WICHTIGER FIX: Verwende projectStore statt this.host.project,
        // da this.host.project oft eine veraltete Referenz ist (Unidirectional Data Flow!)
        const latestProject = projectStore.getProject() || this.host.project;
        
        // LOGGE URSPRUNG!
        const origStage = latestProject.stages?.find((s: any) => s.id === latestProject.activeStageId) || latestProject.stages?.[0];
        logger.debug(`ORIGINAL project store. Objects: ${origStage?.objects?.length}`, origStage?.objects);

        const cleanProjectData = exporter.getCleanProject(latestProject);

        // DEBUG: Prüfen ob das Gamepad HIER überhaupt vorhanden ist!
        const mainStage = cleanProjectData.stages?.find((s: any) => s.id === cleanProjectData.activeStageId) || cleanProjectData.stages?.[0];
        const hasGamepad = mainStage?.objects?.some((o: any) => o.className === 'TVirtualGamepad');
        logger.debug(`Sende CLEAN Projekt an IFrame. Objekte: ${mainStage?.objects?.length}, Beinhaltet Gamepad? ${hasGamepad}`);
        if (!hasGamepad) {
            logger.warn(`ALARM! Das Gamepad fehlt schon BEVOR es an den IFrame gesendet wird! CLEAN Objects:`, mainStage?.objects);
        }

        // Synchrone Datenübergabe
        (iframe as any)._injectedProject = cleanProjectData;

        const messageHandler = (e: MessageEvent) => {
            if (e.data && e.data.type === 'IFRAME_READY') {
                iframe.contentWindow?.postMessage({ type: 'START_RUN', project: cleanProjectData }, '*');
                window.removeEventListener('message', messageHandler);
            }
        };
        window.addEventListener('message', messageHandler);

        panel.appendChild(iframe);
        
        // Blur whatever is currently active (e.g. the Tab Button)
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        
        // Synchronous focus so spacebar goes directly to the game!
        iframe.focus();
        if (iframe.contentWindow) iframe.contentWindow.focus();
    }

    public renderJSONTree(data: any, container: HTMLElement) {
        this.jsonViewManager.renderJSONTree(data, container);
    }


    private updateJSONToolbar(toolbar: HTMLElement) {
        this.jsonViewManager.updateJSONToolbar(toolbar);
    }

    private renderCodeView(codePanel: HTMLElement | null) {
        this.codeViewManager.renderCodeView(codePanel);
    }


    private renderManagementView(panel: HTMLElement) {
        this.managementViewManager.renderManagementView(panel);
    }
}

