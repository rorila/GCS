import { GameProject, StageDefinition } from '../model/types';
import { projectStore } from '../services/ProjectStore';
import { Logger } from '../utils/Logger';
import { InspectorHost } from './inspector/InspectorHost';
import { FlowEditor } from './FlowEditor';
import { FlowToolbox } from './FlowToolbox';
import { TDebugLog } from '../components/TDebugLog';
import { PascalGenerator } from './PascalGenerator';
import { PascalHighlighter } from './PascalHighlighter';
import { safeDeepCopy } from '../utils/DeepCopy';
import { mediatorService } from '../services/MediatorService';
import { MediatorEvents } from '../services/MediatorService';
import { JSONTreeViewer } from './JSONTreeViewer';
import { GameExporter } from '../export/GameExporter';
import { NotificationToast } from './ui/NotificationToast';
import { ConfirmDialog } from './ui/ConfirmDialog';

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
}

export type ViewType = 'stage' | 'json' | 'run' | 'flow' | 'code' | 'management' | 'iframe';

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

    constructor(private host: IViewHost) {
        this.initMediator();
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
        if (iframePanel) iframePanel.style.display = 'none';

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
                    toolbar = this.createJSONToolbar();
                    jsonPanel.parentNode?.insertBefore(toolbar, jsonPanel);
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
        console.log(`[EditorViewManager] ORIGINAL project store. Objects: ${origStage?.objects?.length}`, origStage?.objects);

        const cleanProjectData = exporter.getCleanProject(latestProject);

        // DEBUG: Prüfen ob das Gamepad HIER überhaupt vorhanden ist!
        const mainStage = cleanProjectData.stages?.find((s: any) => s.id === cleanProjectData.activeStageId) || cleanProjectData.stages?.[0];
        const hasGamepad = mainStage?.objects?.some((o: any) => o.className === 'TVirtualGamepad');
        console.log(`[EditorViewManager] Sende CLEAN Projekt an IFrame. Objekte: ${mainStage?.objects?.length}, Beinhaltet Gamepad? ${hasGamepad}`);
        if (!hasGamepad) {
            console.warn(`[EditorViewManager] ALARM! Das Gamepad fehlt schon BEVOR es an den IFrame gesendet wird! CLEAN Objects:`, mainStage?.objects);
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
        JSONTreeViewer.render(data, container, this.jsonMode === 'editor', (updatedData) => {
            this.workingProjectData = updatedData;
            this.isProjectDirty = true;
            this.host.refreshJSONView(); // Refresh to show apply button if implemented there
        });
    }

    private createJSONToolbar(): HTMLElement {
        const toolbar = document.createElement('div');
        toolbar.id = 'json-viewer-toolbar';
        toolbar.style.cssText = 'padding: 8px 16px; background-color: #2d2d2d; border-bottom: 1px solid #3c3c3c; display: flex; align-items: center; gap: 12px;';

        const label = document.createElement('div');
        label.style.cssText = 'color: #ccc; font-size: 12px; font-weight: bold;';
        label.textContent = 'JSON-Ansicht';
        toolbar.appendChild(label);

        const sourceSelect = document.createElement('select');
        sourceSelect.id = 'json-scope-select';
        sourceSelect.style.cssText = `background: #2d2d2d; border: 1px solid #3a3a3a; color: #fff; padding: 4px; border-radius: 4px; outline: none; cursor: pointer; margin-left: auto;`;

        this.updateScopeSelectOptions(sourceSelect);

        sourceSelect.onchange = () => {
            this.useStageIsolatedView = sourceSelect.value === 'stage';
            this.host.refreshJSONView();
        };

        toolbar.appendChild(sourceSelect);
        return toolbar;
    }

    private updateJSONToolbar(toolbar: HTMLElement) {
        toolbar.style.display = 'flex';
        const sourceSelect = toolbar.querySelector('#json-scope-select') as HTMLSelectElement;
        if (sourceSelect) {
            this.updateScopeSelectOptions(sourceSelect);
        }
    }

    private renderCodeView(codePanel: HTMLElement | null) {
        if (!codePanel) return;

        codePanel.style.display = 'flex';
        codePanel.style.flexDirection = 'column';
        codePanel.style.padding = '0';
        codePanel.style.height = '100%';
        codePanel.style.minHeight = '300px';

        // 1. Toolbar
        let toolbar = document.getElementById('code-viewer-toolbar');
        if (!toolbar) {
            toolbar = this.createCodeToolbar();
            codePanel.appendChild(toolbar);
        } else {
            this.updateCodeToolbar(toolbar);
        }

        // 2. Render Code Content
        try {
            if (this.pascalEditorMode) {
                this.renderPascalEditor(codePanel);
            } else {
                this.renderPascalStaticView(codePanel);
            }
        } catch (err) {
            logger.error('[EditorViewManager] Error generating Pascal code:', err);
            codePanel.innerHTML += `<pre style="color: red; padding: 1rem; margin: 0;" translate="no">Error generating Pascal code: ${err}</pre>`;
        }
    }

    private createCodeToolbar(): HTMLElement {
        const toolbar = document.createElement('div');
        toolbar.id = 'code-viewer-toolbar';
        toolbar.style.cssText = 'padding: 8px 16px; background-color: #2d2d2d; border-bottom: 1px solid #3c3c3c; display: flex; align-items: center; gap: 12px;';

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

        const sourceSelect = document.createElement('select');
        sourceSelect.id = 'pascal-scope-select';
        sourceSelect.style.cssText = `background: #2d2d2d; border: 1px solid #3a3a3a; color: #fff; padding: 4px; border-radius: 4px; outline: none; cursor: pointer; margin-left: auto;`;

        this.updateScopeSelectOptions(sourceSelect);

        sourceSelect.onchange = () => {
            this.useStageIsolatedView = sourceSelect.value === 'stage';
            this.switchView('code');
        };

        toolbar.appendChild(sourceSelect);

        // Task-Filter Dropdown
        const taskSelect = document.createElement('select');
        taskSelect.id = 'pascal-task-select';
        taskSelect.style.cssText = `background: #2d2d2d; border: 1px solid #3a3a3a; color: #fff; padding: 4px; border-radius: 4px; outline: none; cursor: pointer;`;
        this.updateTaskSelectOptions(taskSelect);
        taskSelect.onchange = () => {
            this.selectedPascalTask = taskSelect.value === '__all__' ? null : taskSelect.value;
            this.switchView('code');
        };
        toolbar.appendChild(taskSelect);

        return toolbar;
    }

    private updateCodeToolbar(toolbar: HTMLElement) {
        const checkbox = toolbar.querySelector('input');
        if (checkbox) checkbox.checked = this.pascalEditorMode;

        const sourceSelect = toolbar.querySelector('#pascal-scope-select') as HTMLSelectElement;
        if (sourceSelect) {
            const aStage = this.host.getActiveStage();
            const sName = aStage ? aStage.name : 'Unknown';
            if (sourceSelect.options.length > 0) {
                sourceSelect.options[0].text = `Stage: ${sName}`;
                sourceSelect.value = this.useStageIsolatedView ? 'stage' : 'project';
            }
        }

        // Update Task-Filter Dropdown
        const taskSelect = toolbar.querySelector('#pascal-task-select') as HTMLSelectElement;
        if (taskSelect) {
            this.updateTaskSelectOptions(taskSelect);
        }
    }

    private updateScopeSelectOptions(select: HTMLSelectElement) {
        select.innerHTML = '';
        const aStage = this.host.getActiveStage();
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
            select.appendChild(opt);
        });
    }

    private updateTaskSelectOptions(select: HTMLSelectElement) {
        select.innerHTML = '';
        const h = this.host;

        // "Alle Tasks" Option
        const allOpt = document.createElement('option');
        allOpt.value = '__all__';
        allOpt.textContent = '📋 Alle Tasks';
        allOpt.selected = this.selectedPascalTask === null;
        select.appendChild(allOpt);

        // Sammle alle Tasks
        const taskNames = new Set<string>();
        const activeStage = h.getActiveStage();

        // Blueprint-Stage (globale Tasks)
        const blueprint = h.project.stages?.find(s => s.type === 'blueprint');
        if (blueprint?.tasks) {
            blueprint.tasks.forEach((t: any) => { if (t.name) taskNames.add(t.name); });
        }

        // Aktive Stage Tasks
        if (activeStage?.tasks) {
            activeStage.tasks.forEach((t: any) => { if (t.name) taskNames.add(t.name); });
        }

        // Projekt-Tasks
        if (h.project.tasks) {
            h.project.tasks.forEach((t: any) => { if (t.name) taskNames.add(t.name); });
        }

        // FlowChart Task-Keys
        if (activeStage && (activeStage as any).flowCharts) {
            Object.keys((activeStage as any).flowCharts).forEach(key => taskNames.add(key));
        }

        Array.from(taskNames).sort().forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = `⚡ ${name}`;
            opt.selected = this.selectedPascalTask === name;
            select.appendChild(opt);
        });
    }

    private renderPascalEditor(codePanel: HTMLElement) {
        const h = this.host;
        const activeStage = h.getActiveStage();
        const stageToUse = (this.useStageIsolatedView && activeStage) ? activeStage : undefined;
        const plainCode = this.selectedPascalTask
            ? PascalGenerator.generateForTask(h.project, this.selectedPascalTask, false, stageToUse)
            : PascalGenerator.generateFullProgram(h.project, false, stageToUse);

        const oldContainer = document.getElementById('pascal-editor-container');
        if (oldContainer) oldContainer.remove();
        const oldContent = document.getElementById('code-viewer-content');
        if (oldContent) oldContent.remove();

        const container = document.createElement('div');
        container.id = 'pascal-editor-container';
        container.style.cssText = 'flex: 1; position: relative; font-family: \'Fira Code\', monospace; font-size: 14px; line-height: 1.5; background-color: #1e1e1e; overflow: hidden;';

        const highlightLayer = document.createElement('div');
        highlightLayer.id = 'pascal-editor-highlight';
        highlightLayer.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; padding: 1rem; color: #d4d4d4; pointer-events: none; overflow: auto; white-space: pre; box-sizing: border-box;';
        highlightLayer.innerHTML = PascalHighlighter.highlight(plainCode);

        const textarea = document.createElement('textarea');
        textarea.id = 'pascal-editor-textarea';
        textarea.value = plainCode;
        textarea.spellcheck = false;
        textarea.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; padding: 1rem; background: transparent; color: transparent; border: none; outline: none; resize: none; font-family: inherit; font-size: inherit; line-height: inherit; overflow: auto; white-space: pre; box-sizing: border-box; caret-color: #d4d4d4;';

        textarea.oninput = () => {
            highlightLayer.innerHTML = PascalHighlighter.highlight(textarea.value);
            try {
                PascalGenerator.parse(h.project, textarea.value, stageToUse);

                // Notify Mediator that project data has changed via Pascal Editor
                mediatorService.notifyDataChanged(h.project, 'pascal-editor');

                if (h.flowEditor) {
                    h.flowEditor.syncActionsFromProject();
                }

                if (h.inspector) {
                    const obj = h.currentSelectedId ? h.findObjectById(h.currentSelectedId) : null;
                    h.inspector.update(obj || h.project);
                }
                h.autoSaveToLocalStorage();
            } catch (err) {
                logger.error('[EditorViewManager] Error parsing Pascal code:', err);
            }
        };

        textarea.onscroll = () => {
            highlightLayer.scrollTop = textarea.scrollTop;
            highlightLayer.scrollLeft = textarea.scrollLeft;
        };

        container.appendChild(highlightLayer);
        container.appendChild(textarea);
        codePanel.appendChild(container);
    }

    private renderPascalStaticView(codePanel: HTMLElement) {
        const h = this.host;
        const oldContainer = document.getElementById('pascal-editor-container');
        if (oldContainer) oldContainer.remove();

        let content = document.getElementById('code-viewer-content');
        if (!content) {
            content = document.createElement('div');
            content.id = 'code-viewer-content';
            content.style.cssText = 'flex: 1; overflow: auto; padding: 1rem; background-color: #1e1e1e;';
            codePanel.appendChild(content);
        }

        const activeStage = h.getActiveStage();
        const stageToUse = (this.useStageIsolatedView && activeStage) ? activeStage : undefined;
        const plainCode = this.selectedPascalTask
            ? PascalGenerator.generateForTask(h.project, this.selectedPascalTask, false, stageToUse)
            : PascalGenerator.generateFullProgram(h.project, false, stageToUse);
        const highlightedCode = PascalHighlighter.highlight(plainCode);
        content.innerHTML = `<pre style="margin: 0; white-space: pre; color: #d4d4d4;" translate="no">${highlightedCode}</pre>`;
    }

    private renderManagementView(panel: HTMLElement) {
        panel.innerHTML = '';

        // 1. Sidebar
        const sidebar = document.createElement('div');
        sidebar.className = 'management-sidebar';

        const managers = [
            { id: 'VisualObjects', label: 'Visuelle Objekte', emoji: '🖼️' },
            { id: 'Tasks', label: 'Tasks', emoji: '⚡' },
            { id: 'Actions', label: 'Aktionen', emoji: '🎬' },
            { id: 'Variables', label: 'Variablen', emoji: '📊' },
            { id: 'FlowCharts', label: 'Ablaufdiagramme', emoji: '🗺️' },
            { id: 'Stages', label: 'Stages', emoji: '🎬' },
            { id: 'StickyNotes', label: 'Notizen', emoji: '📝' },
            { id: 'Import', label: 'Import', emoji: '📥' }
        ];

        managers.forEach(m => {
            const btn = document.createElement('button');
            btn.className = `management-sidebar-btn ${this.selectedManager === m.id ? 'active' : ''}`;
            btn.innerHTML = `${m.emoji} ${m.label}`;
            btn.onclick = () => {
                this.selectedManager = m.id;
                this.renderManagementView(panel);
            };
            sidebar.appendChild(btn);
        });

        panel.appendChild(sidebar);

        // 2. Content Area
        const content = document.createElement('div');
        content.className = 'management-content';

        if (this.selectedManager === 'Import') {
            this.renderImportView(content);
        } else if (this.selectedManager === 'StickyNotes') {
            this.renderStickyNotesView(content);
        } else {
            // Robuster Fallback: Wenn activeStageId null ist (z.B. nach globalem Flow-Kontext),
            // verwende Blueprint-Stage oder erste verfügbare Stage.
            const stage = this.host.getActiveStage()
                || this.host.project.stages?.find(s => s.type === 'blueprint' || s.id === 'stage_blueprint')
                || this.host.project.stages?.[0];
            if (stage) {
                const managerList = mediatorService.getManagersForStage(stage.id);
                const activeManager = managerList.find(m => m.name === this.selectedManager);

                if (activeManager) {
                    const listContainer = document.createElement('div');
                    listContainer.style.flex = '1';
                    listContainer.style.position = 'relative';
                    listContainer.style.overflowY = 'auto'; // Scrolling für die Cards
                    content.appendChild(listContainer);

                    const listWrap = document.createElement('div');
                    listWrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding-right:8px;padding-bottom:16px;';
                    listContainer.appendChild(listWrap);

                    const color = activeManager.style?.backgroundColor || '#89b4fa';
                    const dataList = activeManager.data || [];

                    if (dataList.length === 0) {
                        const empty = document.createElement('div');
                        empty.textContent = 'Keine Einträge gefunden.';
                        empty.style.cssText = 'color:#888; font-style:italic; padding: 16px; background: #2a2a3e; border-radius: 6px;';
                        listWrap.appendChild(empty);
                    }

                    dataList.forEach((row: any) => {
                        const item = document.createElement('div');
                        item.style.cssText = `
                            background: #2a2a3e; border-left: 4px solid ${color}; 
                            padding: 10px 14px; border-radius: 4px; cursor: pointer; transition: background 0.2s, transform 0.1s;
                        `;
                        item.onmouseenter = () => { item.style.background = '#3a3a4e'; item.style.transform = 'translateY(-1px)'; };
                        item.onmouseleave = () => { item.style.background = '#2a2a3e'; item.style.transform = 'translateY(0)'; };
                        
                        const primaryCol = activeManager.columns?.[0];
                        const primaryText = primaryCol ? row[primaryCol.property] : (row.name || row.id || 'Unbenannt');
                        
                        let html = `<div style="font-weight:bold;font-size:13px;color:#fff;margin-bottom:4px;">${this.escapeHtml(String(primaryText))}</div>`;
                        
                        // Standort (Stage/Blueprint Info) extrahieren
                        let locationText = '';
                        if (row.uiScope === 'global') locationText = 'Globale Ebene (Blueprint)';
                        else if (row.uiScope === 'stage') locationText = `Stage: ${stage.name || stage.id}`;
                        else if (row.uiScope === 'local') locationText = 'Lokal (im Task/Action)';
                        else if (row.uiScope === 'library') locationText = 'System-Bibliothek';
                        
                        if (locationText) {
                            html += `<div style="font-size:11px;color:#99aab5;margin-bottom:6px;">📍 ${this.escapeHtml(locationText)}</div>`;
                        }
                        
                        if (activeManager.columns && activeManager.columns.length > 1) {
                            const details = activeManager.columns.slice(1).map((col: any) => {
                                let val = row[col.property];
                                if (val === undefined || val === null) val = '';
                                return `<span style="color:#aaa;">${col.label}:</span> <span style="color:#ccc;">${this.escapeHtml(String(val))}</span>`;
                            }).join(' &nbsp;|&nbsp; ');

                            if (details) {
                                html += `<div style="font-size:11px;">${details}</div>`;
                            }
                        }

                        item.innerHTML = html;
                        item.onclick = () => this.handleManagerRowClick(this.selectedManager, row);
                        listWrap.appendChild(item);
                    });

                    const title = document.createElement('h2');
                    title.textContent = managers.find(m => m.id === this.selectedManager)?.label || '';
                    title.style.margin = '0 0 1rem 0';
                    content.insertBefore(title, listContainer);
                }
            }
        }

        panel.appendChild(content);
    }

    /**
     * Rendert die Notizen-Ansicht: Stage- und Flow-Notizen, gruppiert nach Farben.
     */
    private renderStickyNotesView(parent: HTMLElement): void {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;flex-direction:column;gap:16px;padding:16px;height:100%;box-sizing:border-box;overflow-y:auto;';

        const title = document.createElement('h2');
        title.textContent = '📝 Projekt Notizen-Übersicht';
        title.style.cssText = 'margin:0;color:#fff;font-size:16px;';
        wrapper.appendChild(title);

        const hint = document.createElement('div');
        hint.textContent = 'Klicken Sie auf eine Notiz, um direkt in den jeweiligen Editor und zur Ansicht zu springen.';
        hint.style.cssText = 'font-size:12px;color:#888;margin-bottom:8px;';
        wrapper.appendChild(hint);

        // Data collection
        const stageNotes: any[] = [];
        const flowNotes: any[] = [];

        const extractFlowNotes = (elements: any[], stageId: string, stageName: string, contextKey: string) => {
            if (!elements) return;
            elements.forEach(el => {
                if (el.type === 'comment') {
                    const data = (el as any).data || {};
                    flowNotes.push({
                        id: el.id,
                        title: data.name || 'Ohne Titel',
                        text: data.details || '',
                        color: data.noteColor || 'yellow',
                        stageId: stageId,
                        stageName: stageName,
                        contextKey: contextKey
                    });
                }
            });
        };

        const bpStage = this.host.project.stages?.find(s => s.type === 'blueprint' || s.id === 'stage_blueprint' || s.id === 'blueprint');
        const bpId = bpStage ? bpStage.id : (this.host.project.stages?.[0]?.id || 'stage_blueprint');
        const bpName = bpStage ? bpStage.name : 'Globale Ebene';

        // 1. Projekt-weite Flow-Notizen (Blueprint)
        if (this.host.project.flowCharts?.global?.elements) {
            extractFlowNotes(this.host.project.flowCharts.global.elements, bpId, bpName, 'global');
        } else if ((this.host.project as any).flow?.elements) {
            extractFlowNotes((this.host.project as any).flow.elements, bpId, bpName, 'global');
        }

        if (this.host.project.tasks) {
            this.host.project.tasks.forEach((t: any) => {
                if (t.standaloneNodes) extractFlowNotes(t.standaloneNodes, bpId, bpName, t.name);
            });
        }

        this.host.project.stages?.forEach(stage => {
            // Stage Notizen (Visueller Editor)
            stage.objects?.forEach(obj => {
                if (obj.className === 'TStickyNote') {
                    stageNotes.push({
                        id: obj.id,
                        title: obj.title || obj.name || 'Ohne Titel',
                        text: obj.text || '',
                        color: obj.noteColor || 'yellow',
                        stageId: stage.id,
                        stageName: stage.name
                    });
                }
            });

            // Stage Flow-Notizen (Task Standalone Nodes)
            if (stage.tasks) {
                stage.tasks.forEach((t: any) => {
                    if (t.standaloneNodes) {
                        extractFlowNotes(t.standaloneNodes, stage.id, stage.name, t.name);
                    }
                });
            }

            // Stage Flow-Notizen (FlowCharts Map)
            if (stage.flowCharts) {
                Object.keys(stage.flowCharts).forEach(contextKey => {
                    const flow = stage.flowCharts![contextKey];
                    extractFlowNotes(flow.elements || [], stage.id, stage.name, contextKey);
                });
            }
        });

        const colorMap: Record<string, { label: string, hex: string }> = {
            'yellow': { label: 'Information (Gelb)', hex: '#fff9c4' },
            'green': { label: 'Erfolg/Positiv (Grün)', hex: '#c8e6c9' },
            'blue': { label: 'Struktur/Neutral (Blau)', hex: '#bbdefb' },
            'red': { label: 'Achtung/Todo (Rot)', hex: '#ffcdd2' }
        };

        const renderGroup = (titleText: string, notes: any[], isFlow: boolean) => {
            if (notes.length === 0) return;
            const groupWrap = document.createElement('div');
            groupWrap.style.cssText = 'margin-bottom: 24px;';
            
            const groupTitle = document.createElement('h3');
            groupTitle.textContent = titleText;
            groupTitle.style.cssText = 'margin: 0 0 12px 0; color: #89b4fa; font-size: 14px; border-bottom: 1px solid #444; padding-bottom: 4px;';
            groupWrap.appendChild(groupTitle);

            // Group by color
            const byColor: Record<string, any[]> = {};
            notes.forEach(n => {
                const c = n.color || 'yellow';
                if (!byColor[c]) byColor[c] = [];
                byColor[c].push(n);
            });

            Object.keys(colorMap).forEach(colorKey => {
                const cNotes = byColor[colorKey];
                if (!cNotes || cNotes.length === 0) return;

                const colTitle = document.createElement('h4');
                colTitle.textContent = colorMap[colorKey].label;
                colTitle.style.cssText = `margin: 12px 0 8px 0; color: ${colorMap[colorKey].hex}; font-size: 13px;`;
                groupWrap.appendChild(colTitle);

                const list = document.createElement('div');
                list.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding-left:8px;';

                cNotes.forEach(n => {
                    const item = document.createElement('div');
                    item.style.cssText = `
                        background: #2a2a3e; border-left: 4px solid ${colorMap[colorKey].hex}; 
                        padding: 10px 14px; border-radius: 4px; cursor: pointer; transition: background 0.2s, transform 0.1s;
                    `;
                    item.onmouseenter = () => { item.style.background = '#3a3a4e'; item.style.transform = 'translateY(-1px)'; };
                    item.onmouseleave = () => { item.style.background = '#2a2a3e'; item.style.transform = 'translateY(0)'; };

                    let subtitle = isFlow 
                        ? `Stage: ${n.stageName} | Diagramm: ${n.contextKey}`
                        : `Stage: ${n.stageName}`;

                    item.innerHTML = `
                        <div style="font-weight:bold;font-size:13px;color:#fff;margin-bottom:4px;">${this.escapeHtml(n.title)}</div>
                        <div style="font-size:11px;color:#aaa;margin-bottom:6px;">${this.escapeHtml(subtitle)}</div>
                        <div style="font-size:12px;color:#ccc;white-space:pre-wrap;line-height:1.4;">${this.escapeHtml(n.text)}</div>
                    `;

                    item.onclick = () => {
                        // Navigiere zum Objekt
                        this.host.switchStage(n.stageId);
                        if (isFlow) {
                            this.switchView('flow');
                            setTimeout(() => {
                                if (this.host.flowEditor) {
                                    this.host.flowEditor.show();
                                    this.host.flowEditor.switchActionFlow(n.contextKey, true, false);
                                    // Kurze Verzögerung bis das Flow gerendert wurde
                                    setTimeout(() => {
                                        this.host.flowEditor?.selectNodeById(n.id);
                                    }, 100);
                                }
                            }, 50);
                        } else {
                            this.switchView('stage');
                            setTimeout(() => {
                                this.host.selectObject(n.id, true);
                            }, 50);
                        }
                    };

                    list.appendChild(item);
                });
                groupWrap.appendChild(list);
            });

            wrapper.appendChild(groupWrap);
        };

        if (stageNotes.length === 0 && flowNotes.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'Keine Notizen im Projekt gefunden.';
            empty.style.cssText = 'color:#888; font-style:italic; padding: 16px; background: #2a2a3e; border-radius: 6px;';
            wrapper.appendChild(empty);
        } else {
            renderGroup('📌 Notizen im Visual Editor', stageNotes, false);
            renderGroup('🗺️ Notizen in Flow-Diagrammen', flowNotes, true);
        }

        parent.appendChild(wrapper);
    }

    private escapeHtml(str: string): string {
        const div = document.createElement('div');
        div.innerText = str;
        return div.innerHTML;
    }

    /**
     * Rendert die Import-Ansicht: Textarea + Validierung + Laden/Kopieren-Buttons
     */
    private renderImportView(parent: HTMLElement): void {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;flex-direction:column;gap:16px;padding:16px;height:100%;box-sizing:border-box;';

        // Header
        const title = document.createElement('h2');
        title.textContent = '📥 Projekt importieren';
        title.style.cssText = 'margin:0;color:#fff;font-size:16px;';
        wrapper.appendChild(title);

        const hint = document.createElement('div');
        hint.textContent = 'Füge ein Projekt-JSON per Ctrl+V in das Textfeld ein, um es zu laden.';
        hint.style.cssText = 'font-size:12px;color:#888;margin-bottom:4px;';
        wrapper.appendChild(hint);

        // Textarea
        const textarea = document.createElement('textarea');
        textarea.placeholder = 'Projekt-JSON hier einfügen (Ctrl+V)...\n\n{\n  "name": "MeinProjekt",\n  "stages": [...]\n}';
        textarea.style.cssText = 'flex:1;min-height:200px;background:#1a1a2e;color:#e0e0e0;border:1px solid #444;border-radius:8px;padding:12px;font-family:Consolas,Monaco,monospace;font-size:12px;resize:none;outline:none;transition:border-color 0.2s;';
        textarea.onfocus = () => { textarea.style.borderColor = '#89b4fa'; };
        textarea.onblur = () => { textarea.style.borderColor = '#444'; };
        wrapper.appendChild(textarea);

        // Validierungsstatus
        const statusBar = document.createElement('div');
        statusBar.style.cssText = 'padding:10px 14px;border-radius:6px;font-size:12px;transition:all 0.2s;';
        this.updateImportStatus(statusBar, 'waiting');
        wrapper.appendChild(statusBar);

        // Button-Zeile
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:10px;';

        // 📥 Laden-Button
        const loadBtn = document.createElement('button');
        loadBtn.textContent = '📥 Projekt laden';
        loadBtn.disabled = true;
        loadBtn.style.cssText = 'flex:1;padding:10px 16px;background:#1e3a5f;color:#4fc3f7;border:1px solid #2a5a8f;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold;transition:all 0.2s;opacity:0.5;';
        btnRow.appendChild(loadBtn);

        // 📋 Kopieren-Button
        const copyBtn = document.createElement('button');
        copyBtn.textContent = '📋 Aktuelles Projekt kopieren';
        copyBtn.style.cssText = 'flex:1;padding:10px 16px;background:#2a2a3e;color:#ccc;border:1px solid #444;border-radius:6px;cursor:pointer;font-size:13px;transition:all 0.2s;';
        copyBtn.onmouseenter = () => { copyBtn.style.borderColor = '#89b4fa'; copyBtn.style.background = '#3a3a4e'; };
        copyBtn.onmouseleave = () => { copyBtn.style.borderColor = '#444'; copyBtn.style.background = '#2a2a3e'; };
        copyBtn.onclick = async () => {
            try {
                const projectJson = JSON.stringify(this.host.project, null, 2);
                await navigator.clipboard.writeText(projectJson);
                const origText = copyBtn.textContent;
                copyBtn.textContent = '✅ Kopiert!';
                copyBtn.style.borderColor = '#a6e3a1';
                setTimeout(() => {
                    copyBtn.textContent = origText;
                    copyBtn.style.borderColor = '#444';
                }, 2000);
            } catch (e) {
                NotificationToast.show('Fehler beim Kopieren: ' + e);
            }
        };
        btnRow.appendChild(copyBtn);

        wrapper.appendChild(btnRow);
        parent.appendChild(wrapper);

        // --- Validierungs-Logik ---
        let parsedProject: any = null;
        let validationTimer: number | undefined;

        textarea.oninput = () => {
            clearTimeout(validationTimer);
            validationTimer = window.setTimeout(() => {
                const text = textarea.value.trim();
                if (!text) {
                    this.updateImportStatus(statusBar, 'waiting');
                    loadBtn.disabled = true;
                    loadBtn.style.opacity = '0.5';
                    parsedProject = null;
                    return;
                }

                try {
                    const parsed = JSON.parse(text);

                    // Prüfe ob es ein GCS-Projekt ist
                    if (!parsed.stages || !Array.isArray(parsed.stages)) {
                        this.updateImportStatus(statusBar, 'error', 'Kein gültiges GCS-Projekt: "stages" Array fehlt.');
                        loadBtn.disabled = true;
                        loadBtn.style.opacity = '0.5';
                        parsedProject = null;
                        return;
                    }

                    // Stats sammeln
                    const name = parsed.name || 'Unbenannt';
                    const stageCount = parsed.stages.length;
                    let componentCount = 0;
                    let taskCount = 0;
                    parsed.stages.forEach((s: any) => {
                        componentCount += (s.objects || []).length;
                        taskCount += (s.tasks || s.Tasks || []).length;
                    });

                    parsedProject = parsed;
                    this.updateImportStatus(statusBar, 'valid',
                        `Gültiges Projekt: "${name}" (${stageCount} Stage${stageCount !== 1 ? 's' : ''}, ${componentCount} Komponenten, ${taskCount} Tasks)`
                    );
                    loadBtn.disabled = false;
                    loadBtn.style.opacity = '1';

                } catch (e: any) {
                    this.updateImportStatus(statusBar, 'error', `JSON-Syntaxfehler: ${e.message}`);
                    loadBtn.disabled = true;
                    loadBtn.style.opacity = '0.5';
                    parsedProject = null;
                }
            }, 300); // Debounce 300ms
        };

        // --- Laden-Button Handler ---
        loadBtn.onclick = async () => {
            if (!parsedProject) return;
            const name = parsedProject.name || 'Unbenannt';
            if (!await ConfirmDialog.show(`Achtung: Das aktuelle Projekt wird durch "${name}" ersetzt.\n\nFortfahren?`)) return;

            try {
                (this.host as any).loadProject(parsedProject);
                textarea.value = '';
                this.updateImportStatus(statusBar, 'loaded', `Projekt "${name}" erfolgreich geladen!`);
                loadBtn.disabled = true;
                loadBtn.style.opacity = '0.5';
                parsedProject = null;
            } catch (e: any) {
                this.updateImportStatus(statusBar, 'error', `Fehler beim Laden: ${e.message}`);
            }
        };
    }

    /**
     * Aktualisiert die Statusanzeige im Import-Tab.
     */
    private updateImportStatus(el: HTMLElement, status: 'waiting' | 'valid' | 'error' | 'loaded', message?: string): void {
        switch (status) {
            case 'waiting':
                el.style.background = 'rgba(255,255,255,0.03)';
                el.style.border = '1px solid #333';
                el.style.color = '#666';
                el.innerHTML = '⏳ Warte auf Eingabe...';
                break;
            case 'valid':
                el.style.background = 'rgba(166,227,161,0.1)';
                el.style.border = '1px solid rgba(166,227,161,0.4)';
                el.style.color = '#a6e3a1';
                el.innerHTML = `✅ ${message}`;
                break;
            case 'error':
                el.style.background = 'rgba(243,139,168,0.1)';
                el.style.border = '1px solid rgba(243,139,168,0.4)';
                el.style.color = '#f38ba8';
                el.innerHTML = `❌ ${message}`;
                break;
            case 'loaded':
                el.style.background = 'rgba(137,180,250,0.1)';
                el.style.border = '1px solid rgba(137,180,250,0.4)';
                el.style.color = '#89b4fa';
                el.innerHTML = `🎉 ${message}`;
                break;
        }
    }

    private handleManagerRowClick(managerId: string, row: any) {
        const h = this.host;

        if (managerId === 'Tasks' || managerId === 'FlowCharts') {
            // Zum Flow-Editor wechseln und den entsprechenden Task/Flow laden
            h.switchView('flow');
            if (h.flowEditor && row.name) {
                h.flowEditor.switchActionFlow(row.name);
            }
        } else if (managerId === 'VisualObjects') {
            // Visuelles Objekt auf der Stage selektieren und dorthin wechseln
            h.selectObject(row.id, true);
            h.switchView('stage');
        } else if (managerId === 'Actions' || managerId === 'Variables') {
            // Actions/Variablen sind keine visuellen Stage-Objekte.
            // Nur im Inspector anzeigen, KEIN switchView um Seiteneffekte zu vermeiden.
            h.selectObject(row.id || row.name, true);
        } else if (managerId === 'Stages') {
            // Zu einer anderen Stage wechseln
            if (row.id && (h as any).switchStage) {
                (h as any).switchStage(row.id);
            }
        }
    }
}
