/**
 * RichTextEditorDialog - Ein nativer WYSIWYG Editor für HTML-Inhalte
 * Verwendet document.execCommand für Formatierungen und DOMParser als simplen XSS-Schutz.
 */
export class RichTextEditorDialog {

    public static show(initialHtml: string): Promise<string | null> {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:10000; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(3px);';

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
                const safeHtml = RichTextEditorDialog.sanitizeHTML(rawHtml);
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

    /**
     * Einfache Bereinigung von potenziell gefährlichen Tags und Attributen,
     * um Cross-Site Scripting (XSS) zu verhindern.
     */
    private static sanitizeHTML(html: string): string {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const removeDangerousNodes = (node: Node) => {
            const el = node as HTMLElement;
            
            if (el.tagName) {
                const tag = el.tagName.toLowerCase();
                // Gefährliche Tags komplett entfernen
                if (['script', 'iframe', 'object', 'embed', 'applet', 'meta', 'link'].includes(tag)) {
                    el.remove();
                    return;
                }

                // Gefährliche Attribute (wie onload, onerror) entfernen
                if (el.attributes) {
                    for (let i = el.attributes.length - 1; i >= 0; i--) {
                        const attr = el.attributes[i];
                        if (attr.name.toLowerCase().startsWith('on')) {
                            el.removeAttribute(attr.name);
                        }
                        if (attr.name.toLowerCase() === 'href' || attr.name.toLowerCase() === 'src') {
                            if (attr.value.toLowerCase().trim().startsWith('javascript:')) {
                                el.removeAttribute(attr.name);
                            }
                        }
                    }
                }
            }

            // Schleife Rückwärts, weil remove() die Länge children verändert
            for (let i = node.childNodes.length - 1; i >= 0; i--) {
                removeDangerousNodes(node.childNodes[i]);
            }
        };

        removeDangerousNodes(doc.body);
        return doc.body.innerHTML;
    }
}
