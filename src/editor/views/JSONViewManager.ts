import type { IViewHost } from '../EditorViewManager';
import { JSONTreeViewer } from '../JSONTreeViewer';

/**
 * JSONViewManager - Verwaltet die JSON Viewer/Editor Ansicht.
 * 
 * Zuständig für:
 * - JSON Tree Viewer Rendering
 * - Toolbar für JSON-Operationen
 * - Modus-Umschaltung (Viewer ↔ Editor)
 */
export class JSONViewManager {
    private host: IViewHost;
    private contentElement: HTMLElement | null = null;
    private jsonMode: 'viewer' | 'editor' = 'viewer';

    constructor(host: IViewHost) {
        this.host = host;
    }

    /**
     * Rendert die JSON-Ansicht
     */
    public renderJSONTree(data: any, container: HTMLElement) {
        JSONTreeViewer.render(data, container, this.jsonMode === 'editor', (updatedData) => {
            this.host.workingProjectData = updatedData;
            this.host.isProjectDirty = true;
            this.host.refreshJSONView();
        });
    }

    public renderJSONView(container: HTMLElement, workingData: any): void {
        container.innerHTML = '';

        // Toolbar
        const toolbar = this.createJSONToolbar();
        container.appendChild(toolbar);

        // Content area
        this.contentElement = document.createElement('div');
        this.contentElement.id = 'json-content-area';
        this.contentElement.style.cssText = 'flex: 1; overflow: auto; padding: 16px;';
        container.appendChild(this.contentElement);

        if (this.jsonMode === 'viewer') {
            // Tree Viewer (statische Methode)
            JSONTreeViewer.render(workingData, this.contentElement, false);
        } else {
            // Raw Editor
            const textarea = document.createElement('textarea');
            textarea.id = 'json-editor-textarea';
            textarea.style.cssText = 'width: 100%; height: 100%; background: #1e1e1e; color: #d4d4d4; border: none; padding: 16px; font-family: monospace; font-size: 13px; resize: none; outline: none;';
            textarea.value = JSON.stringify(workingData, null, 2);
            textarea.spellcheck = false;
            this.contentElement.appendChild(textarea);
        }
    }

    /**
     * Erstellt die JSON Toolbar
     */
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
            this.host.useStageIsolatedView = sourceSelect.value === 'stage';
            this.host.refreshJSONView();
        };
        toolbar.appendChild(sourceSelect);

        return toolbar;
    }

    public updateJSONToolbar(toolbar: HTMLElement) {
        toolbar.style.display = 'flex';
        const sourceSelect = toolbar.querySelector('#json-scope-select') as HTMLSelectElement;
        if (sourceSelect) { this.updateScopeSelectOptions(sourceSelect); }
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
            opt.selected = (s.id === 'stage' && this.host.useStageIsolatedView) || (s.id === 'project' && !this.host.useStageIsolatedView);
            select.appendChild(opt);
        });
    }

    /**
     * Schaltet zwischen Viewer und Editor um
     */
    public toggleMode(): void {
        this.jsonMode = this.jsonMode === 'viewer' ? 'editor' : 'viewer';
        // Trigger re-render via host
        this.host.refreshJSONView();
    }

    /**
     * Gibt aktuellen Modus zurück
     */
    public getMode(): 'viewer' | 'editor' {
        return this.jsonMode;
    }

    /**
     * Setzt den Modus
     */
    public setMode(mode: 'viewer' | 'editor'): void {
        this.jsonMode = mode;
    }
}
