/**
 * RichTextEditorDialog - Ein nativer WYSIWYG Editor für HTML-Inhalte
 * Verwendet document.execCommand für Formatierungen und DOMParser als simplen XSS-Schutz.
 */
import { coreStore } from '../../services/registry/CoreStore';
import { SecurityUtils } from '../../utils/SecurityUtils';
export class RichTextEditorDialog {

    public static show(initialHtml: string): Promise<string | null> {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:99999; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(3px);';

            const dialog = document.createElement('div');
            dialog.style.cssText = 'width:600px; max-height:80vh; background:#12122a; border:1px solid #333; border-radius:12px; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,0.6); overflow:hidden;';
            overlay.appendChild(dialog);

            // Header
            const header = document.createElement('div');
            header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid #333; background:#1a1a2e;';
            
            const title = document.createElement('span');
            title.innerText = '🖋️ RichText Editor';
            title.style.cssText = 'font-weight:bold; font-size:14px; color:#fff;';
            header.appendChild(title);

            const closeBtn = document.createElement('button');
            closeBtn.innerText = '✕';
            closeBtn.style.cssText = 'background:none; border:none; color:#888; font-size:18px; cursor:pointer; padding:0 4px;';
            closeBtn.onclick = () => { overlay.remove(); resolve(null); };
            header.appendChild(closeBtn);
            dialog.appendChild(header);

            // Toolbar
            const toolbar = document.createElement('div');
            toolbar.style.cssText = 'display:flex; gap:6px; padding:8px 12px; border-bottom:1px solid #333; background:#1e1e36; flex-wrap:wrap;';

            const createBtn = (icon: string, command: string, arg?: string, titleText?: string) => {
                const btn = document.createElement('button');
                btn.innerHTML = icon;
                btn.title = titleText || command;
                btn.style.cssText = 'background:#2a2a4a; padding:4px 8px; border:1px solid #444; border-radius:4px; color:#ddd; cursor:pointer; font-weight:bold; font-size:14px;';
                btn.onclick = (e) => {
                    e.preventDefault();
                    document.execCommand(command, false, arg);
                };
                btn.onmousedown = (e) => e.preventDefault(); // Verhindert Fokus-Verlust vom Editor
                toolbar.appendChild(btn);
            };

            createBtn('<b>B</b>', 'bold', undefined, 'Fett');
            createBtn('<i>I</i>', 'italic', undefined, 'Kursiv');
            createBtn('<u>U</u>', 'underline', undefined, 'Unterstrichen');
            createBtn('<strike>S</strike>', 'strikeThrough', undefined, 'Durchgestrichen');
            
            // Custom Link Button
            const linkBtn = document.createElement('button');
            linkBtn.innerHTML = '🔗';
            linkBtn.title = 'Link (URL / Stage) einfügen';
            linkBtn.style.cssText = 'background:#2a2a4a; padding:4px 8px; border:1px solid #444; border-radius:4px; color:#ddd; cursor:pointer; font-weight:bold; font-size:14px;';
            linkBtn.onmousedown = (e) => e.preventDefault(); // Verhindert Fokus-Verlust
            linkBtn.onclick = (e) => {
                e.preventDefault();
                // Save textual selection range before opening modal steals focus
                const selection = window.getSelection();
                const savedRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

                RichTextEditorDialog.showLinkDialog(overlay).then(url => {
                    if (url && savedRange) {
                        // Restore selection so execCommand knows what to wrap
                        editorArea.focus();
                        const sel = window.getSelection();
                        if (sel) {
                            sel.removeAllRanges();
                            sel.addRange(savedRange);
                        }

                        document.execCommand('createLink', false, url);
                        // Force target="_blank" for external links natively via DOM query
                        if (!url.startsWith('stage:')) {
                            const newLinks = editorArea.querySelectorAll(`a[href="${url}"]`);
                            newLinks.forEach(l => l.setAttribute('target', '_blank'));
                        }
                    }
                });
            };
            toolbar.appendChild(linkBtn);

            // Trenner
            const sep = () => {
                const s = document.createElement('div');
                s.style.cssText = 'width:1px; background:#444; margin:0 4px;';
                toolbar.appendChild(s);
            }
            sep();

            createBtn('H1', 'formatBlock', 'H1', 'Überschrift 1');
            createBtn('H2', 'formatBlock', 'H2', 'Überschrift 2');
            createBtn('P', 'formatBlock', 'P', 'Normaler Text');
            
            sep();

            createBtn('≡', 'justifyLeft', undefined, 'Linksbündig');
            createBtn('≣', 'justifyCenter', undefined, 'Zentriert');
            createBtn('≡', 'justifyRight', undefined, 'Rechtsbündig');

            sep();

            // Color picker for text
            const colorPicker = document.createElement('input');
            colorPicker.type = 'color';
            colorPicker.title = 'Textfarbe';
            colorPicker.style.cssText = 'height:28px; width:28px; padding:0; border:1px solid #444; cursor:pointer; background:#2a2a4a;';
            colorPicker.onchange = (e) => {
                document.execCommand('foreColor', false, (e.target as HTMLInputElement).value);
            };
            toolbar.appendChild(colorPicker);

            dialog.appendChild(toolbar);

            // Editor Area (contenteditable)
            const editorArea = document.createElement('div');
            editorArea.className = 'richtext-editor-area';
            editorArea.contentEditable = 'true';
            editorArea.style.cssText = 'flex:1; min-height:300px; padding:16px; background:#fff; color:#000; overflow-y:auto; font-family:sans-serif; outline:none; font-size:14px; line-height:1.5;';
            editorArea.innerHTML = initialHtml || '<p></p>';
            dialog.appendChild(editorArea);

            // Footer (Save/Cancel)
            const footer = document.createElement('div');
            footer.style.cssText = 'padding:12px 16px; border-top:1px solid #333; display:flex; justify-content:flex-end; gap:8px; background:#16162a;';

            const cancelBtn = document.createElement('button');
            cancelBtn.innerText = 'Abbrechen';
            cancelBtn.style.cssText = 'padding:6px 16px; background:#444; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;';
            cancelBtn.onclick = () => { overlay.remove(); resolve(null); };

            const saveBtn = document.createElement('button');
            saveBtn.innerText = 'Übernehmen';
            saveBtn.style.cssText = 'padding:6px 16px; background:#6c63ff; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;';
            saveBtn.onclick = () => {
                const rawHtml = editorArea.innerHTML;
                const safeHtml = SecurityUtils.sanitizeHTML(rawHtml);
                overlay.remove();
                resolve(safeHtml);
            };

            footer.appendChild(cancelBtn);
            footer.appendChild(saveBtn);
            dialog.appendChild(footer);

            document.body.appendChild(overlay);
            
            // Timeout to focus the editor at the end
            setTimeout(() => {
                editorArea.focus();
                // Move cursor to end
                if (typeof window.getSelection !== 'undefined' && typeof document.createRange !== 'undefined') {
                    const range = document.createRange();
                    range.selectNodeContents(editorArea);
                    range.collapse(false);
                    const sel = window.getSelection();
                    if (sel) {
                        sel.removeAllRanges();
                        sel.addRange(range);
                    }
                }
            }, 50);
        });
    }


    private static showLinkDialog(parentOverlay: HTMLElement): Promise<string | null> {
        return new Promise(resolve => {
            const modal = document.createElement('div');
            modal.style.cssText = 'position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); background:#1a1a2e; border:1px solid #444; border-radius:8px; padding:16px; display:flex; flex-direction:column; gap:12px; z-index:100000; box-shadow:0 10px 40px rgba(0,0,0,0.8); min-width:300px; color:#fff; font-family:sans-serif;';
            
            const title = document.createElement('div');
            title.innerText = '🔗 Link einfügen';
            title.style.cssText = 'font-weight:bold; margin-bottom:8px; border-bottom:1px solid #333; padding-bottom:8px;';
            modal.appendChild(title);

            // Toggle URL / Stage
            const typeSelect = document.createElement('select');
            typeSelect.style.cssText = 'padding:6px; background:#2a2a4a; color:#fff; border:1px solid #444; border-radius:4px; outline:none;';
            typeSelect.innerHTML = `<option value="url">Web-Link (URL)</option><option value="stage">Interne Stage</option>`;
            modal.appendChild(typeSelect);

            const urlInput = document.createElement('input');
            urlInput.type = 'text';
            urlInput.placeholder = 'https://...';
            urlInput.style.cssText = 'padding:6px; background:#2a2a4a; color:#fff; border:1px solid #444; border-radius:4px; outline:none;';
            modal.appendChild(urlInput);

            const stageSelect = document.createElement('select');
            stageSelect.style.cssText = 'padding:6px; background:#2a2a4a; color:#fff; border:1px solid #444; border-radius:4px; outline:none; display:none;';
            
            const stages = coreStore.getStages();
            stages.forEach(s => {
                const opt = document.createElement('option');
                opt.value = `stage:${s.id}`;
                opt.innerText = `${s.name || s.id} (${s.id})`;
                stageSelect.appendChild(opt);
            });
            modal.appendChild(stageSelect);

            typeSelect.onchange = () => {
                if (typeSelect.value === 'url') {
                    urlInput.style.display = 'block';
                    stageSelect.style.display = 'none';
                } else {
                    urlInput.style.display = 'none';
                    stageSelect.style.display = 'block';
                }
            };

            const btnRow = document.createElement('div');
            btnRow.style.cssText = 'display:flex; justify-content:flex-end; gap:8px; margin-top:8px;';

            const cancelBtn = document.createElement('button');
            cancelBtn.innerText = 'Abbrechen';
            cancelBtn.style.cssText = 'padding:6px 12px; background:#444; color:#fff; border:none; border-radius:4px; cursor:pointer;';
            cancelBtn.onclick = () => { modal.remove(); resolve(null); };

            const okBtn = document.createElement('button');
            okBtn.innerText = 'Einfügen';
            okBtn.style.cssText = 'padding:6px 12px; background:#6c63ff; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;';
            okBtn.onclick = () => { 
                const val = typeSelect.value === 'url' ? urlInput.value : stageSelect.value;
                modal.remove(); 
                resolve(val ? val.trim() : null); 
            };

            btnRow.appendChild(cancelBtn);
            btnRow.appendChild(okBtn);
            modal.appendChild(btnRow);

            parentOverlay.appendChild(modal);
            setTimeout(() => urlInput.focus(), 50);
        });
    }
}
