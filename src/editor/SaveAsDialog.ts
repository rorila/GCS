/**
 * SaveAsDialog - Modaler Dialog für "Speichern unter"
 * Zeigt vorhandene Projektordner und erlaubt Ordner-/Dateiname-Auswahl.
 */
import { Logger } from '../utils/Logger';
import { NotificationToast } from './ui/NotificationToast';
import { PromptDialog } from './ui/PromptDialog';

const logger = Logger.get('SaveAsDialog');

export class SaveAsDialog {

    /**
     * Zeigt den "Speichern unter"-Dialog.
     * @param currentName Aktueller Spielname als Vorschlag
     * @returns Promise<{ folder: string, filename: string } | null>
     */
    public static async show(currentName: string): Promise<{ folder: string; filename: string } | null> {
        // Ordner vom Server laden
        let folders: { name: string; files: string[] }[] = [];
        try {
            const res = await fetch('/api/dev/list-projects');
            const data = await res.json();
            folders = data.folders || [];
        } catch (e) {
            logger.error('Fehler beim Laden der Projektordner:', e);
        }

        return new Promise((resolve) => {
            const overlay = SaveAsDialog.createOverlay();
            const dialog = SaveAsDialog.createDialog();
            overlay.appendChild(dialog);

            // Header
            const header = document.createElement('div');
            header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid #333; background:#1a1a2e;';
            const title = document.createElement('span');
            title.innerText = '💾 Speichern unter...';
            title.style.cssText = 'font-weight:bold; font-size:14px; color:#fff;';
            header.appendChild(title);
            const closeBtn = document.createElement('button');
            closeBtn.innerText = '✕';
            closeBtn.style.cssText = 'background:none; border:none; color:#888; font-size:18px; cursor:pointer; padding:0 4px;';
            closeBtn.onclick = () => { overlay.remove(); resolve(null); };
            header.appendChild(closeBtn);
            dialog.appendChild(header);

            // State
            let selectedFolder = folders.length > 0 ? folders[0].name : '';

            // --- Ordner-Auswahl ---
            const folderSection = document.createElement('div');
            folderSection.style.cssText = 'padding:12px 16px; border-bottom:1px solid #333;';
            const folderLabel = document.createElement('div');
            folderLabel.style.cssText = 'font-size:11px; color:#888; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.5px;';
            folderLabel.innerText = 'Ordner';
            folderSection.appendChild(folderLabel);

            const folderRow = document.createElement('div');
            folderRow.style.cssText = 'display:flex; gap:8px; align-items:center;';

            const folderSelect = document.createElement('select');
            folderSelect.style.cssText = 'flex:1; padding:8px 10px; background:#16162a; color:#fff; border:1px solid #333; border-radius:6px; font-size:13px; outline:none;';
            folders.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.name;
                opt.text = `📁 ${f.name}`;
                folderSelect.appendChild(opt);
            });
            folderSelect.value = selectedFolder;
            folderSelect.onchange = () => {
                selectedFolder = folderSelect.value;
                renderFiles();
            };
            folderRow.appendChild(folderSelect);

            const newFolderBtn = document.createElement('button');
            newFolderBtn.innerText = '+ Neu';
            newFolderBtn.style.cssText = 'padding:8px 12px; background:#6c63ff; color:#fff; border:none; border-radius:6px; font-size:12px; cursor:pointer; white-space:nowrap;';
            newFolderBtn.onclick = async () => {
                const name = await PromptDialog.show('Neuen Ordnernamen eingeben:');
                if (name && name.trim()) {
                    const safeName = name.trim().replace(/[^a-zA-Z0-9_\-äöüÄÖÜß ]/g, '').replace(/\s+/g, '_');
                    if (safeName) {
                        selectedFolder = safeName;
                        // Neuen Ordner zum Dropdown hinzufügen
                        const opt = document.createElement('option');
                        opt.value = safeName;
                        opt.text = `📁 ${safeName} (neu)`;
                        folderSelect.appendChild(opt);
                        folderSelect.value = safeName;
                        folders.push({ name: safeName, files: [] });
                        renderFiles();
                    }
                }
            };
            folderRow.appendChild(newFolderBtn);
            folderSection.appendChild(folderRow);
            dialog.appendChild(folderSection);

            // --- Vorhandene Dateien ---
            const filesSection = document.createElement('div');
            filesSection.style.cssText = 'padding:8px 16px; flex:1; overflow-y:auto; max-height:200px;';
            dialog.appendChild(filesSection);

            const renderFiles = () => {
                filesSection.innerHTML = '';
                const folder = folders.find(f => f.name === selectedFolder);
                if (!folder || folder.files.length === 0) {
                    const empty = document.createElement('div');
                    empty.style.cssText = 'color:#666; font-size:12px; padding:8px 0;';
                    empty.innerText = selectedFolder ? 'Noch keine Dateien in diesem Ordner.' : 'Bitte Ordner wählen.';
                    filesSection.appendChild(empty);
                    return;
                }

                const listLabel = document.createElement('div');
                listLabel.style.cssText = 'font-size:11px; color:#888; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.5px;';
                listLabel.innerText = 'Vorhandene Dateien';
                filesSection.appendChild(listLabel);

                folder.files.forEach(file => {
                    const row = document.createElement('div');
                    row.style.cssText = 'display:flex; align-items:center; padding:4px 8px; cursor:pointer; border-radius:4px; transition:background 0.15s;';
                    row.onmouseenter = () => row.style.background = '#1a1a3e';
                    row.onmouseleave = () => row.style.background = 'transparent';

                    const icon = document.createElement('span');
                    icon.style.cssText = 'margin-right:8px; font-size:12px;';
                    icon.innerText = '📄';
                    row.appendChild(icon);

                    const name = document.createElement('span');
                    name.style.cssText = 'color:#bbb; font-size:12px;';
                    name.innerText = file;
                    row.appendChild(name);

                    row.onclick = () => {
                        filenameInput.value = file.replace('.json', '');
                    };
                    filesSection.appendChild(row);
                });
            };

            // --- Dateiname-Eingabe ---
            const nameSection = document.createElement('div');
            nameSection.style.cssText = 'padding:12px 16px; border-top:1px solid #333;';
            const nameLabel = document.createElement('div');
            nameLabel.style.cssText = 'font-size:11px; color:#888; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.5px;';
            nameLabel.innerText = 'Dateiname';
            nameSection.appendChild(nameLabel);

            const nameRow = document.createElement('div');
            nameRow.style.cssText = 'display:flex; align-items:center; gap:4px;';
            const filenameInput = document.createElement('input');
            filenameInput.type = 'text';
            filenameInput.value = currentName.replace(/[^a-zA-Z0-9_\-äöüÄÖÜß ]/g, '').trim().replace(/\s+/g, '_');
            filenameInput.style.cssText = 'flex:1; padding:8px 10px; background:#16162a; color:#fff; border:1px solid #333; border-radius:6px; font-size:13px; outline:none;';
            nameRow.appendChild(filenameInput);
            const ext = document.createElement('span');
            ext.style.cssText = 'color:#888; font-size:13px;';
            ext.innerText = '.json';
            nameRow.appendChild(ext);
            nameSection.appendChild(nameRow);
            dialog.appendChild(nameSection);

            // --- Footer mit Buttons ---
            const footer = document.createElement('div');
            footer.style.cssText = 'display:flex; justify-content:flex-end; gap:8px; padding:12px 16px; border-top:1px solid #333; background:#1a1a2e;';

            const cancelBtn = document.createElement('button');
            cancelBtn.innerText = 'Abbrechen';
            cancelBtn.style.cssText = 'padding:8px 16px; background:transparent; color:#888; border:1px solid #444; border-radius:6px; font-size:12px; cursor:pointer;';
            cancelBtn.onclick = () => { overlay.remove(); resolve(null); };
            footer.appendChild(cancelBtn);

            const saveBtn = document.createElement('button');
            saveBtn.innerText = '💾 Speichern';
            saveBtn.style.cssText = 'padding:8px 20px; background:#6c63ff; color:#fff; border:none; border-radius:6px; font-size:12px; cursor:pointer; font-weight:bold;';
            saveBtn.onclick = () => {
                const filename = filenameInput.value.trim();
                if (!filename) {
                    NotificationToast.show('Bitte einen Dateinamen eingeben.');
                    return;
                }
                if (!selectedFolder) {
                    NotificationToast.show('Bitte einen Ordner wählen.');
                    return;
                }
                overlay.remove();
                resolve({
                    folder: selectedFolder,
                    filename: filename.endsWith('.json') ? filename : `${filename}.json`
                });
            };
            footer.appendChild(saveBtn);
            dialog.appendChild(footer);

            // Events
            const keyHandler = (e: KeyboardEvent) => {
                if (e.key === 'Escape') { overlay.remove(); resolve(null); document.removeEventListener('keydown', keyHandler); }
                if (e.key === 'Enter') { saveBtn.click(); document.removeEventListener('keydown', keyHandler); }
            };
            document.addEventListener('keydown', keyHandler);
            overlay.onclick = (e) => {
                if (e.target === overlay) { overlay.remove(); resolve(null); document.removeEventListener('keydown', keyHandler); }
            };

            // Rendern und anzeigen
            renderFiles();
            document.body.appendChild(overlay);
            filenameInput.focus();
            filenameInput.select();
        });
    }

    private static createOverlay(): HTMLDivElement {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.6); z-index:10000; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(2px);';
        return overlay;
    }

    private static createDialog(): HTMLDivElement {
        const dialog = document.createElement('div');
        dialog.style.cssText = 'width:480px; max-height:80vh; background:#12122a; border:1px solid #333; border-radius:12px; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,0.5); overflow:hidden;';
        return dialog;
    }
}
