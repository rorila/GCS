import { PascalGenerator } from './PascalGenerator';
import { PascalHighlighter } from './PascalHighlighter';
export class EditorViewManager {
    constructor(host) {
        this.host = host;
        this.currentView = 'stage';
        this.pascalEditorMode = false;
        this.jsonMode = 'viewer';
        this.useStageIsolatedView = true;
        this.workingProjectData = null;
        this.isProjectDirty = false;
    }
    switchView(view) {
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
        const tabs = document.querySelectorAll('.tab-btn');
        // Update Tabs
        tabs.forEach(t => t.classList.remove('active'));
        document.querySelector(`.tab-btn[data-view="${view}"]`)?.classList.add('active');
        // 1. Hide ALL panels
        if (stageWrapper)
            stageWrapper.style.display = 'none';
        if (jsonPanel)
            jsonPanel.style.display = 'none';
        if (flowPanel)
            flowPanel.style.display = 'none';
        if (codePanel)
            codePanel.style.display = 'none';
        // Hide standard toolboxes
        const jsonToolbox = document.getElementById('json-toolbox-content');
        if (jsonToolbox)
            jsonToolbox.style.display = 'none';
        // Hide flow toolbox if it exists
        if (h.flowToolbox)
            h.flowToolbox.hide();
        // Stop debug logging when switching views (focus loss)
        if (h.debugLog) {
            h.debugLog.setRecordingActive(false);
        }
        // 2. Show Selected Panel
        if (view === 'stage') {
            h.setRunMode(false);
            if (stageWrapper)
                stageWrapper.style.display = 'flex';
            if (jsonToolbox)
                jsonToolbox.style.display = 'block';
            if (h.jsonInspector) {
                h.jsonInspector.setFlowContext(null);
            }
        }
        else if (view === 'run') {
            h.setRunMode(true);
            if (stageWrapper)
                stageWrapper.style.display = 'flex';
        }
        else if (view === 'json') {
            h.setRunMode(false);
            if (jsonPanel) {
                jsonPanel.style.display = 'block';
                this.jsonMode = 'viewer';
                this.workingProjectData = JSON.parse(JSON.stringify(h.project));
                this.isProjectDirty = false;
                h.refreshJSONView();
            }
        }
        else if (view === 'flow') {
            h.setRunMode(false);
            if (flowPanel)
                flowPanel.style.display = 'block';
            if (h.flowEditor) {
                h.flowEditor.show();
                h.flowEditor.setProject(h.project);
                if (h.jsonInspector) {
                    h.jsonInspector.setFlowContext(h.flowEditor.getNodes());
                }
            }
            if (h.flowToolbox)
                h.flowToolbox.show();
        }
        else if (view === 'code') {
            h.setRunMode(false);
            this.renderCodeView(codePanel);
        }
        h.render();
    }
    renderCodeView(codePanel) {
        if (!codePanel)
            return;
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
        }
        else {
            this.updateCodeToolbar(toolbar);
        }
        // 2. Render Code Content
        try {
            if (this.pascalEditorMode) {
                this.renderPascalEditor(codePanel);
            }
            else {
                this.renderPascalStaticView(codePanel);
            }
        }
        catch (err) {
            console.error('[EditorViewManager] Error generating Pascal code:', err);
            codePanel.innerHTML += `<pre style="color: red; padding: 1rem; margin: 0;" translate="no">Error generating Pascal code: ${err}</pre>`;
        }
    }
    createCodeToolbar() {
        const toolbar = document.createElement('div');
        toolbar.id = 'code-viewer-toolbar';
        toolbar.style.cssText = 'padding: 8px 16px; background-color: #2d2d2d; border-bottom: 1px solid #3c3c3c; display: flex; align-items: center; gap: 12px;';
        const label = document.createElement('label');
        label.style.cssText = 'display: flex; align-items: center; gap: 8px; cursor: pointer; color: #ccc; font-size: 12px;';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = this.pascalEditorMode;
        checkbox.onchange = (e) => {
            this.pascalEditorMode = e.target.checked;
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
    updateCodeToolbar(toolbar) {
        const checkbox = toolbar.querySelector('input');
        if (checkbox)
            checkbox.checked = this.pascalEditorMode;
        const sourceSelect = toolbar.querySelector('#pascal-scope-select');
        if (sourceSelect) {
            const aStage = this.host.getActiveStage();
            const sName = aStage ? aStage.name : 'Unknown';
            if (sourceSelect.options.length > 0) {
                sourceSelect.options[0].text = `Stage: ${sName}`;
                sourceSelect.value = this.useStageIsolatedView ? 'stage' : 'project';
            }
        }
    }
    updateScopeSelectOptions(select) {
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
    renderPascalEditor(codePanel) {
        const h = this.host;
        const activeStage = h.getActiveStage();
        const stageToUse = (this.useStageIsolatedView && activeStage) ? activeStage : undefined;
        const plainCode = PascalGenerator.generateFullProgram(h.project, false, stageToUse);
        const oldContainer = document.getElementById('pascal-editor-container');
        if (oldContainer)
            oldContainer.remove();
        const oldContent = document.getElementById('code-viewer-content');
        if (oldContent)
            oldContent.remove();
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
            }
            catch (err) {
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
    renderPascalStaticView(codePanel) {
        const h = this.host;
        const oldContainer = document.getElementById('pascal-editor-container');
        if (oldContainer)
            oldContainer.remove();
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
}
