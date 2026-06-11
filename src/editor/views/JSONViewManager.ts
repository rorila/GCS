import { IViewHost } from '../EditorViewTypes';
import { Logger } from '../../utils/Logger';
import { JSONTreeViewer } from '../JSONTreeViewer';

const logger = Logger.get('JSONViewManager');

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

        // Modus-Button
        const modeButton = document.createElement('button');
        modeButton.id = 'json-mode-toggle';
        modeButton.textContent = this.jsonMode === 'viewer' ? 'Zu Editor' : 'Zu Viewer';
        modeButton.style.cssText = 'background: #0e639c; color: white; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;';
        modeButton.onclick = () => {
            this.toggleMode();
        };
        toolbar.appendChild(modeButton);

        // Search box (nur im Viewer)
        if (this.jsonMode === 'viewer') {
            const searchBox = document.createElement('input');
            searchBox.type = 'text';
            searchBox.placeholder = 'Suchen...';
            searchBox.style.cssText = 'background: #3c3c3c; color: #ccc; border: 1px solid #555; padding: 4px 8px; border-radius: 4px; font-size: 12px;';
            searchBox.oninput = (e) => {
                const query = (e.target as HTMLInputElement).value;
                if (this.contentElement) {
                    JSONTreeViewer.search?.(query);
                }
            };
            toolbar.appendChild(searchBox);
        }

        // Copy Button
        const copyBtn = document.createElement('button');
        copyBtn.textContent = 'Kopieren';
        copyBtn.style.cssText = 'background: #3c3c3c; color: #ccc; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-left: auto;';
        copyBtn.onclick = () => this.copyToClipboard();
        toolbar.appendChild(copyBtn);

        return toolbar;
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
     * Kopiert JSON in die Zwischenablage
     */
    private copyToClipboard(): void {
        const project = this.host.project;
        const json = JSON.stringify(project, null, 2);
        navigator.clipboard.writeText(json).then(() => {
            logger.info('JSON in Zwischenablage kopiert');
        }).catch(err => {
            logger.error('Fehler beim Kopieren:', err);
        });
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
