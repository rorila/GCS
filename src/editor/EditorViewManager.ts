import { GameProject, StageDefinition } from '../model/types';
import { JSONInspector } from './JSONInspector';
import { FlowEditor } from './FlowEditor';
import { FlowToolbox } from './FlowToolbox';
import { TDebugLog } from '../components/TDebugLog';
import { PascalGenerator } from './PascalGenerator';
import { PascalHighlighter } from './PascalHighlighter';
import { safeDeepCopy } from '../utils/DeepCopy';
import { mediatorService } from '../services/MediatorService';
import { Stage } from './Stage';

export interface IViewHost {
    project: GameProject;
    flowEditor: FlowEditor | null;
    flowToolbox: FlowToolbox | null;
    jsonInspector: JSONInspector | null;
    debugLog: TDebugLog | null;
    setRunMode(active: boolean): void;
    refreshJSONView(): void;
    getActiveStage(): StageDefinition | null;
    render(): void;
    findObjectById(id: string): any;
    autoSaveToLocalStorage(): void;
    currentSelectedId: string | null;
    selectObject(id: string | null, focus?: boolean): void;
    switchView(view: ViewType): void;
}

export type ViewType = 'stage' | 'json' | 'run' | 'flow' | 'code' | 'management';

export class EditorViewManager {
    public currentView: ViewType = 'stage';
    public pascalEditorMode: boolean = false;
    public jsonMode: 'viewer' | 'editor' = 'viewer';
    public useStageIsolatedView: boolean = true;
    public workingProjectData: any = null;
    public isProjectDirty: boolean = false;
    public selectedManager: string = 'VisualObjects';

    constructor(private host: IViewHost) { }

    public switchView(view: ViewType) {
        const h = this.host;

        // Sync flow editor changes back to project before switching views
        if (this.currentView === 'flow' && h.flowEditor) {
            h.flowEditor.syncToProject();
            h.flowEditor.syncAllTasksFromFlow(h.project);
        }

        this.currentView = view;
        const stageWrapper = document.getElementById('stage-wrapper');
        const jsonPanel = document.getElementById('json-viewer');
        const flowPanel = document.getElementById('flow-viewer');
        const codePanel = document.getElementById('code-viewer');
        const managementPanel = document.getElementById('management-viewer');
        const tabs = document.querySelectorAll('.tab-btn');

        // Update Tabs
        tabs.forEach(t => t.classList.remove('active'));
        document.querySelector(`.tab-btn[data-view="${view}"]`)?.classList.add('active');

        // 1. Hide ALL panels
        if (stageWrapper) stageWrapper.style.display = 'none';
        if (jsonPanel) jsonPanel.style.display = 'none';
        if (flowPanel) flowPanel.style.display = 'none';
        if (codePanel) codePanel.style.display = 'none';
        if (managementPanel) managementPanel.style.display = 'none';

        // Hide standard toolboxes
        const jsonToolbox = document.getElementById('json-toolbox-content');
        if (jsonToolbox) jsonToolbox.style.display = 'none';

        // Hide flow toolbox if it exists
        if (h.flowToolbox) h.flowToolbox.hide();

        // Stop debug logging when switching views (focus loss)
        if (h.debugLog) {
            h.debugLog.setRecordingActive(false);
        }

        // 2. Show Selected Panel
        if (view === 'stage') {
            h.setRunMode(false);
            if (stageWrapper) stageWrapper.style.display = 'flex';
            if (jsonToolbox) jsonToolbox.style.display = 'block';

            if (h.jsonInspector) {
                h.jsonInspector.setFlowContext(null);
            }
        } else if (view === 'run') {
            h.setRunMode(true);
            if (stageWrapper) stageWrapper.style.display = 'flex';
        } else if (view === 'json') {
            h.setRunMode(false);
            if (jsonPanel) {
                jsonPanel.style.display = 'block';
                this.jsonMode = 'viewer';
                this.workingProjectData = safeDeepCopy(h.project);
                this.isProjectDirty = false;
                h.refreshJSONView();
            }
        } else if (view === 'flow') {
            h.setRunMode(false);
            if (flowPanel) flowPanel.style.display = 'block';

            if (h.flowEditor) {
                h.flowEditor.show();
                h.flowEditor.setProject(h.project);
                if (h.jsonInspector) {
                    h.jsonInspector.setFlowContext(h.flowEditor.getNodes());
                }
            }
            if (h.flowToolbox) h.flowToolbox.show();
        } else if (view === 'code') {
            h.setRunMode(false);
            this.renderCodeView(codePanel);
        } else if (view === 'management') {
            h.setRunMode(false);
            if (managementPanel) {
                managementPanel.style.display = 'flex';
                this.renderManagementView(managementPanel);
            }
        }

        h.render();
    }

    public render() {
        this.host.render();
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
            console.error('[EditorViewManager] Error generating Pascal code:', err);
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

    private renderPascalEditor(codePanel: HTMLElement) {
        const h = this.host;
        const activeStage = h.getActiveStage();
        const stageToUse = (this.useStageIsolatedView && activeStage) ? activeStage : undefined;
        const plainCode = PascalGenerator.generateFullProgram(h.project, false, stageToUse);

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
                if (h.jsonInspector) {
                    const obj = h.currentSelectedId ? h.findObjectById(h.currentSelectedId) : null;
                    h.jsonInspector.update(obj || h.project);
                }
                h.autoSaveToLocalStorage();
            } catch (err) {
                console.error('[EditorViewManager] Error parsing Pascal code:', err);
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
        const plainCode = PascalGenerator.generateFullProgram(h.project, false, stageToUse);
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
            { id: 'FlowCharts', label: 'Ablaufdiagramme', emoji: '🗺️' }
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

        const stage = this.host.getActiveStage();
        if (stage) {
            const managerList = mediatorService.getManagersForStage(stage.id);
            const activeManager = managerList.find(m => m.name === this.selectedManager);

            if (activeManager) {
                // We need a way to render the TTable in a regular HTML element
                // Since TTable uses SVG/Canvas/DOM via Stage.renderTable, 
                // we'll use a hidden stage or direct table rendering.
                // For now, let's create a temporary container and use the Stage renderer.

                const tableContainer = document.createElement('div');
                tableContainer.style.flex = '1';
                tableContainer.style.position = 'relative';
                content.appendChild(tableContainer);

                // Re-purpose the Stage rendering logic for this container
                // We'll create a "Mini-Stage" for the table if needed, or just let Stage.renderTable handle it if we provide a parent.
                // Actually, TTable/TObjectList are components that normally render into the main Stage.
                // We want them here. 

                const tableEl = document.createElement('div');
                tableEl.id = `mgr-${activeManager.id}`;
                tableEl.style.width = '100%';
                tableEl.style.height = '100%';
                tableContainer.appendChild(tableEl);

                // Render the table
                (activeManager as any).onRowClick = (row: any) => {
                    this.handleManagerRowClick(this.selectedManager, row);
                };
                Stage.renderTable(tableEl, activeManager as any);

                // Add title
                const title = document.createElement('h2');
                title.textContent = managers.find(m => m.id === this.selectedManager)?.label || '';
                title.style.margin = '0 0 1rem 0';
                content.insertBefore(title, tableContainer);
            }
        }

        panel.appendChild(content);
    }

    private handleManagerRowClick(managerId: string, row: any) {
        const h = this.host;

        if (managerId === 'VisualObjects') {
            // Objekt auf der Stage selektieren und dorthin wechseln
            h.selectObject(row.id, true);
            h.switchView('stage');
        } else if (managerId === 'Variables') {
            // Variable selektieren (öffnet den Variablen-Inspektor)
            h.selectObject(row.id, true);
            h.switchView('stage');
        } else if (managerId === 'Tasks' || managerId === 'Actions') {
            // Zum Flow-Editor wechseln und den entsprechenden Task/Aktion laden
            h.switchView('flow');
            if (h.flowEditor && row.name) {
                h.flowEditor.switchActionFlow(row.name);
            }
        }
    }
}
