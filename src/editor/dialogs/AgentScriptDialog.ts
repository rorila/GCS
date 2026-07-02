import { Logger } from '../../utils/Logger';
import { AgentController } from '../../services/AgentController';
import { AgentScript, ExportOptions } from '../../services/agent/AgentScriptTypes';

const logger = Logger.get('AgentScriptDialog');

/**
 * AgentScriptDialog
 *
 * Minimaler modal-Dialog für Import/Export von AgentScript-Dateien.
 * Kann später mit einem vollwertigen Vorschau-Dialog erweitert werden.
 */
export class AgentScriptDialog {
    private static createOverlay(): HTMLElement {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:10000;';
        return overlay;
    }

    private static createDialog(width = '480px'): HTMLElement {
        const dialog = document.createElement('div');
        dialog.style.cssText = `width:${width}; max-height:80vh; background:#1a1a2e; border:1px solid #333; border-radius:8px; display:flex; flex-direction:column; color:#fff; font-family:sans-serif;`;
        return dialog;
    }

    private static createHeader(title: string, onClose: () => void): HTMLElement {
        const header = document.createElement('div');
        header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid #333; background:#16162a; border-radius:8px 8px 0 0;';
        const titleEl = document.createElement('span');
        titleEl.innerText = title;
        titleEl.style.cssText = 'font-weight:bold; font-size:14px;';
        const closeBtn = document.createElement('button');
        closeBtn.innerText = '✕';
        closeBtn.style.cssText = 'background:none; border:none; color:#888; font-size:18px; cursor:pointer;';
        closeBtn.onclick = onClose;
        header.appendChild(titleEl);
        header.appendChild(closeBtn);
        return header;
    }

    /**
     * Export-Dialog. Der User wählt Scope und erhält eine .agent.json-Datei zum Download.
     */
    public static showExport(): void {
        const agent = AgentController.getInstance();
        const overlay = AgentScriptDialog.createOverlay();
        const dialog = AgentScriptDialog.createDialog();
        overlay.appendChild(dialog);

        const close = () => overlay.remove();
        dialog.appendChild(AgentScriptDialog.createHeader('📤 AgentScript exportieren', close));

        const body = document.createElement('div');
        body.style.cssText = 'padding:16px; display:flex; flex-direction:column; gap:12px;';

        const scopeLabel = document.createElement('label');
        scopeLabel.innerText = 'Scope';
        scopeLabel.style.cssText = 'font-size:11px; color:#888; text-transform:uppercase;';
        const scopeSelect = document.createElement('select');
        scopeSelect.style.cssText = 'padding:8px; background:#16162a; color:#fff; border:1px solid #333; border-radius:6px;';
        ['task', 'stage', 'project'].forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.text = s;
            scopeSelect.appendChild(opt);
        });

        const targetLabel = document.createElement('label');
        targetLabel.innerText = 'Ziel-ID (Task/Stage, optional)';
        targetLabel.style.cssText = 'font-size:11px; color:#888; text-transform:uppercase;';
        const targetInput = document.createElement('input');
        targetInput.type = 'text';
        targetInput.placeholder = 'z.B. Tick oder stage_main';
        targetInput.style.cssText = 'padding:8px; background:#16162a; color:#fff; border:1px solid #333; border-radius:6px;';

        const exportBtn = document.createElement('button');
        exportBtn.innerText = 'Exportieren & Download';
        exportBtn.style.cssText = 'padding:10px; background:#4caf50; color:#fff; border:none; border-radius:6px; cursor:pointer;';
        exportBtn.onclick = () => {
            try {
                const options: ExportOptions = {
                    scope: scopeSelect.value as any,
                    targetId: targetInput.value || undefined,
                };
                const script = agent.exportScript(options);
                const blob = new Blob([JSON.stringify(script, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${script.name}.agent.json`;
                a.click();
                URL.revokeObjectURL(url);
                close();
            } catch (e: any) {
                logger.error('Export fehlgeschlagen:', e);
                alert('Export fehlgeschlagen: ' + e.message);
            }
        };

        body.appendChild(scopeLabel);
        body.appendChild(scopeSelect);
        body.appendChild(targetLabel);
        body.appendChild(targetInput);
        body.appendChild(exportBtn);
        dialog.appendChild(body);

        document.body.appendChild(overlay);
    }

    /**
     * Import-Dialog. Der User lädt eine .agent.json-Datei hoch und sieht eine Vorschau.
     */
    public static showImport(): void {
        const agent = AgentController.getInstance();
        const overlay = AgentScriptDialog.createOverlay();
        const dialog = AgentScriptDialog.createDialog('520px');
        overlay.appendChild(dialog);

        const close = () => overlay.remove();
        dialog.appendChild(AgentScriptDialog.createHeader('📥 AgentScript importieren', close));

        const body = document.createElement('div');
        body.style.cssText = 'padding:16px; display:flex; flex-direction:column; gap:12px;';

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.agent.json,.json';
        fileInput.style.cssText = 'color:#fff;';

        const targetLabel = document.createElement('label');
        targetLabel.innerText = 'Ziel-Stage (optional)';
        targetLabel.style.cssText = 'font-size:11px; color:#888; text-transform:uppercase;';
        const targetInput = document.createElement('input');
        targetInput.type = 'text';
        targetInput.placeholder = 'z.B. stage_main';
        targetInput.style.cssText = 'padding:8px; background:#16162a; color:#fff; border:1px solid #333; border-radius:6px;';

        const strategyLabel = document.createElement('label');
        strategyLabel.innerText = 'Konflikt-Strategie';
        strategyLabel.style.cssText = 'font-size:11px; color:#888; text-transform:uppercase;';
        const strategySelect = document.createElement('select');
        strategySelect.style.cssText = 'padding:8px; background:#16162a; color:#fff; border:1px solid #333; border-radius:6px;';
        ['error', 'rename', 'overwrite', 'skip'].forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.text = s;
            strategySelect.appendChild(opt);
        });

        const placeholderContainer = document.createElement('div');
        placeholderContainer.style.cssText = 'display:flex; flex-direction:column; gap:8px;';

        let placeholderInputs: Record<string, HTMLInputElement> = {};

        const renderPlaceholders = (script: AgentScript) => {
            placeholderContainer.innerHTML = '';
            placeholderInputs = {};
            if (!script.placeholderSchema || script.placeholderSchema.length === 0) return;

            const title = document.createElement('div');
            title.innerText = 'Platzhalter';
            title.style.cssText = 'font-size:11px; color:#888; text-transform:uppercase;';
            placeholderContainer.appendChild(title);

            for (const ph of script.placeholderSchema) {
                const label = document.createElement('label');
                label.innerText = `${ph.name}${ph.required ? ' *' : ''}`;
                label.style.cssText = 'font-size:11px; color:#aaa;';

                const input = document.createElement('input');
                input.type = ph.type === 'number' ? 'number' : ph.type === 'boolean' ? 'checkbox' : 'text';
                input.placeholder = ph.description || ph.default || '';
                if (ph.default !== undefined && input.type !== 'checkbox') input.value = String(ph.default);
                if (ph.default !== undefined && input.type === 'checkbox') input.checked = Boolean(ph.default);
                input.style.cssText = 'padding:8px; background:#16162a; color:#fff; border:1px solid #333; border-radius:6px;';

                placeholderInputs[ph.name] = input;
                placeholderContainer.appendChild(label);
                placeholderContainer.appendChild(input);
            }
        };

        const preview = document.createElement('pre');
        preview.style.cssText = 'max-height:200px; overflow:auto; background:#0f0f1a; padding:8px; border-radius:6px; font-size:11px; color:#aaa;';
        preview.innerText = 'Vorschau erscheint hier nach Datei-Auswahl...';

        let currentScript: AgentScript | null = null;

        const collectPlaceholderValues = (): Record<string, any> => {
            const values: Record<string, any> = {};
            for (const key of Object.keys(placeholderInputs)) {
                const input = placeholderInputs[key];
                values[key] = input.type === 'checkbox' ? input.checked : input.value;
            }
            return values;
        };

        const updatePreview = () => {
            if (!currentScript) return;
            const result = agent.importScript(currentScript, {
                targetStageId: targetInput.value || undefined,
                conflictStrategy: strategySelect.value as any,
                placeholderValues: collectPlaceholderValues(),
                dryRun: true
            });
            let text = `Geplante Operationen: ${result.plannedOperations}\n`;
            text += `Fehler: ${result.errors.join('\n') || '-'}\n`;
            text += `Warnungen: ${result.warnings.join('\n') || '-'}\n`;
            if (result.conflicts.length > 0) {
                text += 'Konflikte:\n' + result.conflicts.map(c => `- [${c.type}] ${c.name}: ${c.action} - ${c.message}`).join('\n');
            }
            preview.innerText = text;
        };

        fileInput.onchange = () => {
            const file = fileInput.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    currentScript = JSON.parse(reader.result as string) as AgentScript;
                    renderPlaceholders(currentScript);
                    updatePreview();
                } catch (e: any) {
                    preview.innerText = 'Fehler beim Parsen: ' + e.message;
                    currentScript = null;
                    renderPlaceholders({ placeholderSchema: [] } as any);
                }
            };
            reader.readAsText(file);
        };

        targetInput.onchange = updatePreview;
        strategySelect.onchange = updatePreview;

        const importBtn = document.createElement('button');
        importBtn.innerText = 'Importieren';
        importBtn.style.cssText = 'padding:10px; background:#2196f3; color:#fff; border:none; border-radius:6px; cursor:pointer;';
        importBtn.onclick = () => {
            if (!currentScript) {
                alert('Bitte zuerst eine Datei auswählen.');
                return;
            }
            try {
                const result = agent.importScript(currentScript, {
                    targetStageId: targetInput.value || undefined,
                    conflictStrategy: strategySelect.value as any,
                    placeholderValues: collectPlaceholderValues(),
                });
                if (result.success) {
                    alert(`Import erfolgreich: ${result.appliedOperations} Operationen angewendet.`);
                    close();
                } else {
                    alert('Import fehlgeschlagen:\n' + result.errors.join('\n'));
                }
            } catch (e: any) {
                logger.error('Import fehlgeschlagen:', e);
                alert('Import fehlgeschlagen: ' + e.message);
            }
        };

        body.appendChild(fileInput);
        body.appendChild(targetLabel);
        body.appendChild(targetInput);
        body.appendChild(strategyLabel);
        body.appendChild(strategySelect);
        body.appendChild(placeholderContainer);
        body.appendChild(preview);
        body.appendChild(importBtn);
        dialog.appendChild(body);

        document.body.appendChild(overlay);
    }
}
