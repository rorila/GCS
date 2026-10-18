/**
 * PromptDialog — Non-blocking Ersatz für window.prompt().
 * 
 * Electron-Bug: Nach alert()/confirm()/prompt() verlieren Input-Felder
 * dauerhaft den Fokus (Chromium-Issue seit Electron v5).
 * 
 * Verwendung:
 *   const name = await PromptDialog.show('Name eingeben:', 'Default');
 *   if (name !== null) { ... }
 */
export class PromptDialog {

    /**
     * Zeigt einen modalen Eingabe-Dialog.
     * @param message       Nachricht / Beschreibung
     * @param defaultValue  Vorausgefüllter Wert (default: '')
     * @param title         Optionaler Titel
     */
    public static show(
        message: string,
        defaultValue: string = '',
        title: string = 'Eingabe'
    ): Promise<string | null> {
        return new Promise((resolve) => {
            // Fokus-Zustand VOR dem Dialog merken
            const previouslyFocused = document.activeElement as HTMLElement | null;
            const overlay = PromptDialog.createOverlay();

            const dialog = document.createElement('div');
            dialog.style.cssText = 'min-width:380px; max-width:500px; background:#12122a; border:1px solid #333; border-radius:12px; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,0.5); overflow:hidden; animation:fadeIn 0.15s ease;';

            // Header
            const header = document.createElement('div');
            header.style.cssText = 'padding:12px 16px; border-bottom:1px solid #333; background:#1a1a2e;';
            const titleEl = document.createElement('span');
            titleEl.innerText = `✏️ ${title}`;
            titleEl.style.cssText = 'font-weight:bold; font-size:14px; color:#fff;';
            header.appendChild(titleEl);
            dialog.appendChild(header);

            // Body
            const body = document.createElement('div');
            body.style.cssText = 'padding:16px; display:flex; flex-direction:column; gap:10px;';

            const label = document.createElement('div');
            label.style.cssText = 'color:#ccc; font-size:13px; line-height:1.5; white-space:pre-wrap;';
            label.innerText = message;
            body.appendChild(label);

            const input = document.createElement('input');
            input.type = 'text';
            input.value = defaultValue;
            input.style.cssText = 'padding:8px 10px; background:#16162a; color:#fff; border:1px solid #333; border-radius:6px; font-size:13px; outline:none; width:100%; box-sizing:border-box;';
            input.onfocus = () => { input.style.borderColor = '#6c63ff'; };
            input.onblur = () => { input.style.borderColor = '#333'; };
            body.appendChild(input);

            dialog.appendChild(body);

            // Footer
            const footer = document.createElement('div');
            footer.style.cssText = 'display:flex; justify-content:flex-end; gap:8px; padding:12px 16px; border-top:1px solid #333; background:#1a1a2e;';

            const cancelBtn = document.createElement('button');
            cancelBtn.innerText = 'Abbrechen';
            cancelBtn.style.cssText = 'padding:8px 16px; background:transparent; color:#888; border:1px solid #444; border-radius:6px; font-size:12px; cursor:pointer;';

            const okBtn = document.createElement('button');
            okBtn.innerText = 'OK';
            okBtn.style.cssText = 'padding:8px 20px; background:#6c63ff; color:#fff; border:none; border-radius:6px; font-size:12px; cursor:pointer; font-weight:bold;';

            const close = (result: string | null) => {
                overlay.remove();
                document.removeEventListener('keydown', keyHandler);
                // Fokus sauber auf das vorherige Element zurückgeben
                if (previouslyFocused && typeof previouslyFocused.focus === 'function' && document.body.contains(previouslyFocused)) {
                    previouslyFocused.focus();
                }
                resolve(result);
            };

            cancelBtn.onclick = () => close(null);
            okBtn.onclick = () => close(input.value);

            const keyHandler = (e: KeyboardEvent) => {
                if (e.key === 'Escape') close(null);
                if (e.key === 'Enter') close(input.value);
            };
            document.addEventListener('keydown', keyHandler);

            overlay.onclick = (e) => {
                if (e.target === overlay) close(null);
            };

            footer.appendChild(cancelBtn);
            footer.appendChild(okBtn);
            dialog.appendChild(footer);
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            // Auto-Focus + Select
            setTimeout(() => {
                input.focus();
                input.select();
            }, 50);
        });
    }

    private static createOverlay(): HTMLDivElement {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.6); z-index:99999; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(2px);';
        return overlay;
    }
}
