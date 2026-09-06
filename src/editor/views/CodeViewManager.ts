import type { IViewHost } from '../EditorViewManager';
import { Logger } from '../../utils/Logger';
import { PascalGenerator } from '../PascalGenerator';
import { PascalHighlighter } from '../PascalHighlighter';
import { mediatorService } from '../../services/MediatorService';

const logger = Logger.get('CodeViewManager');

/**
 * CodeViewManager - Verwaltet die Pascal Code-Ansicht.
 * 
 * Zuständig für:
 * - Pascal-Code Generierung
 * - Syntax Highlighting
 * - Editor/Viewer Modus
 */
export class CodeViewManager {
    private host: IViewHost;
    public pascalEditorMode: boolean = false;
    public useStageIsolatedView: boolean = true;
    public selectedPascalTask: string | null = null;

    constructor(host: IViewHost) {
        this.host = host;
    }

    public renderCodeView(codePanel: HTMLElement | null) {
        if (!codePanel) return;

        codePanel.style.display = 'flex';
        codePanel.style.flexDirection = 'column';
        codePanel.style.padding = '0';
        codePanel.style.height = '100%';
        codePanel.style.minHeight = '300px';

        let toolbar = document.getElementById('code-viewer-toolbar');
        if (!toolbar) {
            toolbar = this.createCodeToolbar();
            codePanel.appendChild(toolbar);
        } else {
            this.updateCodeToolbar(toolbar);
        }

        try {
            if (this.pascalEditorMode) {
                this.renderPascalEditor(codePanel);
            } else {
                this.renderPascalStaticView(codePanel);
            }
        } catch (err) {
            logger.error('[CodeViewManager] Error generating Pascal code:', err);
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
            this.host.switchView('code');
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
            this.host.switchView('code');
        };
        toolbar.appendChild(sourceSelect);

        const taskSelect = document.createElement('select');
        taskSelect.id = 'pascal-task-select';
        taskSelect.style.cssText = `background: #2d2d2d; border: 1px solid #3a3a3a; color: #fff; padding: 4px; border-radius: 4px; outline: none; cursor: pointer;`;
        this.updateTaskSelectOptions(taskSelect);
        taskSelect.onchange = () => {
            this.selectedPascalTask = taskSelect.value === '__all__' ? null : taskSelect.value;
            this.host.switchView('code');
        };
        toolbar.appendChild(taskSelect);

        return toolbar;
    }

    public updateCodeToolbar(toolbar: HTMLElement) {
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

        const taskSelect = toolbar.querySelector('#pascal-task-select') as HTMLSelectElement;
        if (taskSelect) { this.updateTaskSelectOptions(taskSelect); }
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
        const allOpt = document.createElement('option');
        allOpt.value = '__all__';
        allOpt.textContent = '📋 Alle Tasks';
        allOpt.selected = this.selectedPascalTask === null;
        select.appendChild(allOpt);

        const taskNames = new Set<string>();
        const activeStage = h.getActiveStage();
        const blueprint = h.project.stages?.find(s => s.type === 'blueprint');
        if (blueprint?.tasks) { blueprint.tasks.forEach((t: any) => { if (t.name) taskNames.add(t.name); }); }
        if (activeStage?.tasks) { activeStage.tasks.forEach((t: any) => { if (t.name) taskNames.add(t.name); }); }
        if (h.project.tasks) { h.project.tasks.forEach((t: any) => { if (t.name) taskNames.add(t.name); }); }
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

    public renderPascalEditor(codePanel: HTMLElement) {
        const h = this.host;
        const activeStage = h.getActiveStage();
        const stageToUse = (this.useStageIsolatedView && activeStage) ? activeStage : undefined;
        const plainCode = this.selectedPascalTask
            ? PascalGenerator.generateForTask(h.project, this.selectedPascalTask, false, stageToUse)
            : PascalGenerator.generateFullProgram(h.project, false, stageToUse);

        document.getElementById('pascal-editor-container')?.remove();
        document.getElementById('code-viewer-content')?.remove();

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
                mediatorService.notifyDataChanged(h.project, 'pascal-editor');
                if (h.flowEditor) { h.flowEditor.syncActionsFromProject(); }
                if (h.inspector) {
                    const obj = h.currentSelectedId ? h.findObjectById(h.currentSelectedId) : null;
                    h.inspector.update(obj || h.project);
                }
                h.autoSaveToLocalStorage();
            } catch (err) {
                logger.error('[CodeViewManager] Error parsing Pascal code:', err);
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

    public renderPascalStaticView(codePanel: HTMLElement) {
        const h = this.host;
        document.getElementById('pascal-editor-container')?.remove();

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
}
