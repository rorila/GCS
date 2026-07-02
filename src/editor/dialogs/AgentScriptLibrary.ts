import { Logger } from '../../utils/Logger';
import { AgentController } from '../../services/AgentController';
import { AgentScriptRepository } from '../../services/agent/AgentScriptRepository';
import { AgentScriptDialog } from './AgentScriptDialog';

const logger = Logger.get('AgentScriptLibrary');

/**
 * AgentScriptLibrary
 *
 * Einfache Bibliothek für gespeicherte AgentScript-Snippets.
 * Zeigt alle .agent.json Dateien aus dem Snippet-Ordner an und erlaubt
 * direktes Importieren oder Öffnen des Import-Dialogs.
 */
export class AgentScriptLibrary {
    private static createOverlay(): HTMLElement {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:10000;';
        return overlay;
    }

    private static createDialog(): HTMLElement {
        const dialog = document.createElement('div');
        dialog.style.cssText = 'width:560px; max-height:80vh; background:#1a1a2e; border:1px solid #333; border-radius:8px; display:flex; flex-direction:column; color:#fff; font-family:sans-serif;';
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

    public static async show(): Promise<void> {
        const agent = AgentController.getInstance();
        const repo = new AgentScriptRepository('./snippets');
        const overlay = AgentScriptLibrary.createOverlay();
        const dialog = AgentScriptLibrary.createDialog();
        overlay.appendChild(dialog);

        const close = () => overlay.remove();
        dialog.appendChild(AgentScriptLibrary.createHeader('📚 AgentScript-Bibliothek', close));

        const body = document.createElement('div');
        body.style.cssText = 'padding:16px; display:flex; flex-direction:column; gap:12px;';

        const snippets = repo.list();

        if (snippets.length === 0) {
            const empty = document.createElement('div');
            empty.innerText = 'Keine Snippets gefunden. Speichern Sie ein Skript mit dem Export-Dialog.';
            empty.style.cssText = 'color:#888; font-size:13px; text-align:center; padding:24px;';
            body.appendChild(empty);
        } else {
            const list = document.createElement('div');
            list.style.cssText = 'display:flex; flex-direction:column; gap:8px; max-height:400px; overflow:auto;';

            for (const entry of snippets) {
                const item = document.createElement('div');
                item.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:10px; background:#0f0f1a; border:1px solid #333; border-radius:6px;';

                const info = document.createElement('div');
                info.style.cssText = 'display:flex; flex-direction:column; gap:4px;';

                const name = document.createElement('span');
                name.innerText = entry.script?.name || entry.name;
                name.style.cssText = 'font-weight:bold; font-size:13px;';

                const desc = document.createElement('span');
                desc.innerText = entry.script?.description || entry.script?.operations.length + ' Operationen' || 'Keine Details';
                desc.style.cssText = 'font-size:11px; color:#888;';

                info.appendChild(name);
                info.appendChild(desc);

                const actions = document.createElement('div');
                actions.style.cssText = 'display:flex; gap:8px;';

                const importBtn = document.createElement('button');
                importBtn.innerText = 'Importieren';
                importBtn.style.cssText = 'padding:6px 12px; background:#2196f3; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:12px;';
                importBtn.onclick = () => {
                    try {
                        const script = repo.load(entry.path);
                        const result = agent.importScript(script, { targetStageId: 'stage_main', conflictStrategy: 'rename' });
                        if (result.success) {
                            alert(`Import erfolgreich: ${result.appliedOperations} Operationen.`);
                            close();
                        } else {
                            alert('Import fehlgeschlagen:\n' + result.errors.join('\n'));
                        }
                    } catch (e: any) {
                        logger.error('Import aus Bibliothek fehlgeschlagen:', e);
                        alert('Fehler: ' + e.message);
                    }
                };

                const previewBtn = document.createElement('button');
                previewBtn.innerText = 'Vorschau';
                previewBtn.style.cssText = 'padding:6px 12px; background:#6c63ff; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:12px;';
                previewBtn.onclick = () => {
                    close();
                    AgentScriptDialog.showImport();
                };

                actions.appendChild(importBtn);
                actions.appendChild(previewBtn);
                item.appendChild(info);
                item.appendChild(actions);
                list.appendChild(item);
            }

            body.appendChild(list);
        }

        const openImportBtn = document.createElement('button');
        openImportBtn.innerText = 'Datei importieren...';
        openImportBtn.style.cssText = 'padding:10px; background:#4caf50; color:#fff; border:none; border-radius:6px; cursor:pointer;';
        openImportBtn.onclick = () => {
            close();
            AgentScriptDialog.showImport();
        };
        body.appendChild(openImportBtn);

        dialog.appendChild(body);
        document.body.appendChild(overlay);
    }
}
