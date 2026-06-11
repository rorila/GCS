import { IViewHost } from '../EditorViewTypes';
import { Logger } from '../../utils/Logger';
import { PascalGenerator } from '../PascalGenerator';
import { PascalHighlighter } from '../PascalHighlighter';

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
    private pascalEditorMode: boolean = false;
    private useStageIsolatedView: boolean = true;
    private selectedPascalTask: string | null = null;

    constructor(host: IViewHost) {
        this.host = host;
    }

    /**
     * Rendert die Code-Ansicht
     */
    public renderCodeView(container: HTMLElement): void {
        container.innerHTML = '';

        // Toolbar
        const toolbar = this.createCodeToolbar();
        container.appendChild(toolbar);

        // Content
        const content = document.createElement('div');
        content.id = 'code-content-area';
        content.style.cssText = 'flex: 1; overflow: auto; padding: 16px; background: #1e1e1e;';
        container.appendChild(content);

        try {
            let pascalCode: string;

            // Nur aktive Stage oder gesamtes Projekt
            if (this.useStageIsolatedView) {
                const stage = this.host.getActiveStage();
                pascalCode = stage ? PascalGenerator.generateFullProgram(this.host.project, false, stage) : '{ Keine Stage ausgewählt }';
            } else {
                pascalCode = PascalGenerator.generateFullProgram(this.host.project, false);
            }

            // Task-Filter anwenden
            if (this.selectedPascalTask) {
                pascalCode = this.filterPascalByTask(pascalCode, this.selectedPascalTask);
            }

            if (this.pascalEditorMode) {
                // Editor-Modus
                const textarea = document.createElement('textarea');
                textarea.id = 'pascal-editor';
                textarea.value = pascalCode;
                textarea.style.cssText = 'width: 100%; height: 100%; background: #1e1e1e; color: #d4d4d4; border: none; padding: 16px; font-family: "Fira Code", monospace; font-size: 13px; resize: none; outline: none;';
                textarea.spellcheck = false;
                content.appendChild(textarea);
            } else {
                // Viewer-Modus mit Syntax-Highlighting
                this.renderPascalStaticView(content, pascalCode);
            }
        } catch (err) {
            logger.error('Fehler bei Pascal-Generierung:', err);
            content.innerHTML = `<pre style="color: #ff6b6b; padding: 1rem;">Fehler: ${err}</pre>`;
        }
    }

    /**
     * Erstellt die Code Toolbar
     */
    private createCodeToolbar(): HTMLElement {
        const toolbar = document.createElement('div');
        toolbar.id = 'code-viewer-toolbar';
        toolbar.style.cssText = 'padding: 8px 16px; background-color: #2d2d2d; border-bottom: 1px solid #3c3c3c; display: flex; align-items: center; gap: 12px;';

        // Editor-Modus Toggle
        const label = document.createElement('label');
        label.style.cssText = 'display: flex; align-items: center; gap: 8px; cursor: pointer; color: #ccc; font-size: 12px;';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = this.pascalEditorMode;
        checkbox.onchange = (e) => {
            this.pascalEditorMode = (e.target as HTMLInputElement).checked;
            this.refreshView();
        };
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode('Editor-Modus'));
        toolbar.appendChild(label);

        // Scope Select
        const scopeSelect = document.createElement('select');
        scopeSelect.id = 'pascal-scope-select';
        scopeSelect.style.cssText = 'background: #2d2d2d; border: 1px solid #3a3a3a; color: #fff; padding: 4px; border-radius: 4px; font-size: 12px;';
        this.updateScopeOptions(scopeSelect);
        scopeSelect.onchange = () => {
            this.useStageIsolatedView = scopeSelect.value === 'stage';
            this.refreshView();
        };
        toolbar.appendChild(scopeSelect);

        // Copy Button
        const copyBtn = document.createElement('button');
        copyBtn.textContent = 'Kopieren';
        copyBtn.style.cssText = 'background: #3c3c3c; color: #ccc; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-left: auto;';
        copyBtn.onclick = () => this.copyPascalCode();
        toolbar.appendChild(copyBtn);

        return toolbar;
    }

    /**
     * Rendert Pascal mit statischem Syntax-Highlighting
     */
    private renderPascalStaticView(container: HTMLElement, code: string): void {
        const highlighted = PascalHighlighter.highlight(code);
        const pre = document.createElement('pre');
        pre.style.cssText = 'margin: 0; font-family: "Fira Code", monospace; font-size: 13px; line-height: 1.6;';
        pre.innerHTML = highlighted;
        container.appendChild(pre);
    }

    /**
     * Filtert Pascal-Code nach Task
     */
    private filterPascalByTask(code: string, taskName: string): string {
        const lines = code.split('\n');
        const result: string[] = [];
        let inTargetTask = false;
        let braceCount = 0;

        for (const line of lines) {
            const taskMatch = line.match(/procedure\s+(\w+)/);
            if (taskMatch) {
                inTargetTask = taskMatch[1] === taskName;
                if (inTargetTask) braceCount = 0;
            }

            if (inTargetTask) {
                result.push(line);
                braceCount += (line.match(/{/g) || []).length;
                braceCount -= (line.match(/}/g) || []).length;
                if (braceCount === 0 && line.trim() === 'end;') {
                    inTargetTask = false;
                }
            }
        }

        return result.length > 0 ? result.join('\n') : `{ Task "${taskName}" nicht gefunden }`;
    }

    /**
     * Aktualisiert Scope-Optionen
     */
    private updateScopeOptions(select: HTMLSelectElement): void {
        select.innerHTML = `
            <option value="project" ${!this.useStageIsolatedView ? 'selected' : ''}>Gesamtes Projekt</option>
            <option value="stage" ${this.useStageIsolatedView ? 'selected' : ''}>Aktive Stage</option>
        `;
    }

    /**
     * Kopiert Pascal-Code in Zwischenablage
     */
    private copyPascalCode(): void {
        const code = this.useStageIsolatedView
            ? PascalGenerator.generateFullProgram(this.host.project, false, this.host.getActiveStage()!)
            : PascalGenerator.generateFullProgram(this.host.project, false);

        navigator.clipboard.writeText(code).then(() => {
            logger.info('Pascal-Code kopiert');
        }).catch(err => {
            logger.error('Kopieren fehlgeschlagen:', err);
        });
    }

    /**
     * Triggert View-Refresh
     */
    private refreshView(): void {
        // Delegiert an Host - switchView('code') ohne Änderung
        const event = new CustomEvent('refreshcodeview');
        window.dispatchEvent(event);
    }

    /**
     * Setzt Editor-Modus
     */
    public setEditorMode(enabled: boolean): void {
        this.pascalEditorMode = enabled;
    }

    /**
     * Gibt aktuellen Editor-Modus zurück
     */
    public getEditorMode(): boolean {
        return this.pascalEditorMode;
    }
}
