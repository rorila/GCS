/**
 * ConfirmDialog — Non-blocking Ersatz für window.confirm().
 * 
 * Electron-Bug: Nach alert()/confirm() verlieren Input-Felder
 * dauerhaft den Fokus (Chromium-Issue seit Electron v5).
 * 
 * Verwendung:
 *   if (await ConfirmDialog.show('Wirklich löschen?')) { ... }
 */
export class ConfirmDialog {

    /**
     * Zeigt einen modalen Bestätigungsdialog.
     * @param message  Nachricht (mehrzeilig mit \n möglich)
     * @param title    Optionaler Titel (default: 'Bestätigung')
     * @param confirmLabel  Text des Bestätigungs-Buttons (default: 'OK')
     * @param cancelLabel   Text des Abbruch-Buttons (default: 'Abbrechen')
     */
    public static show(
        message: string,
        title: string = 'Bestätigung',
        confirmLabel: string = 'OK',
        cancelLabel: string = 'Abbrechen'
    ): Promise<boolean> {
        return new Promise((resolve) => {
            // Fokus-Zustand VOR dem Dialog merken
            const previouslyFocused = document.activeElement as HTMLElement | null;
            const overlay = ConfirmDialog.createOverlay();

            const dialog = document.createElement('div');
            dialog.style.cssText = 'min-width:340px; max-width:500px; background:#12122a; border:1px solid #333; border-radius:12px; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,0.5); overflow:hidden; animation:fadeIn 0.15s ease;';

            // Header
            const header = document.createElement('div');
            header.style.cssText = 'padding:12px 16px; border-bottom:1px solid #333; background:#1a1a2e;';
            const titleEl = document.createElement('span');
            titleEl.innerText = `⚠️ ${title}`;
            titleEl.style.cssText = 'font-weight:bold; font-size:14px; color:#fff;';
            header.appendChild(titleEl);
            dialog.appendChild(header);

            // Body
            const body = document.createElement('div');
            body.style.cssText = 'padding:16px; color:#ccc; font-size:13px; line-height:1.6; white-space:pre-wrap; max-height:300px; overflow-y:auto;';
            body.innerText = message;
            dialog.appendChild(body);

            // Footer
            const footer = document.createElement('div');
            footer.style.cssText = 'display:flex; justify-content:flex-end; gap:8px; padding:12px 16px; border-top:1px solid #333; background:#1a1a2e;';

            const cancelBtn = document.createElement('button');
            cancelBtn.innerText = cancelLabel;
            cancelBtn.style.cssText = 'padding:8px 16px; background:transparent; color:#888; border:1px solid #444; border-radius:6px; font-size:12px; cursor:pointer;';

            const confirmBtn = document.createElement('button');
            confirmBtn.innerText = confirmLabel;
            confirmBtn.style.cssText = 'padding:8px 20px; background:#6c63ff; color:#fff; border:none; border-radius:6px; font-size:12px; cursor:pointer; font-weight:bold;';

            const close = (result: boolean) => {
                overlay.remove();
                document.removeEventListener('keydown', keyHandler);
                // Fokus sauber auf das vorherige Element zurückgeben
                if (previouslyFocused && typeof previouslyFocused.focus === 'function' && document.body.contains(previouslyFocused)) {
                    previouslyFocused.focus();
                }
                resolve(result);
            };

            cancelBtn.onclick = () => close(false);
            confirmBtn.onclick = () => close(true);

            const keyHandler = (e: KeyboardEvent) => {
                if (e.key === 'Escape') close(false);
                if (e.key === 'Enter') close(true);
            };
            document.addEventListener('keydown', keyHandler);

            overlay.onclick = (e) => {
                if (e.target === overlay) close(false);
            };

            footer.appendChild(cancelBtn);
            footer.appendChild(confirmBtn);
            dialog.appendChild(footer);
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            confirmBtn.focus();
        });
    }

    private static createOverlay(): HTMLDivElement {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.6); z-index:99999; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(2px);';
        return overlay;
    }
}
