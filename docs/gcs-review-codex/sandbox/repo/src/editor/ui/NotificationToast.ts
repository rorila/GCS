/**
 * NotificationToast — Non-blocking Ersatz für window.alert().
 * 
 * Electron-Bug: Nach alert() verlieren Input-Felder dauerhaft den Fokus.
 * 
 * Verwendung:
 *   NotificationToast.show('Projekt gespeichert!');
 *   NotificationToast.show('Fehler beim Laden', 'error');
 */
export class NotificationToast {

    private static container: HTMLDivElement | null = null;

    /**
     * Zeigt eine nicht-modale Toast-Benachrichtigung.
     * @param message  Nachricht (mehrzeilig mit \n möglich)
     * @param type     Typ: 'info' | 'success' | 'warning' | 'error'
     * @param duration Anzeigedauer in ms (0 = bleibt bis manuell geschlossen)
     */
    public static show(
        message: string,
        type: 'info' | 'success' | 'warning' | 'error' = 'info',
        duration: number = 4000
    ): void {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.style.cssText = 'position:fixed; top:16px; right:16px; z-index:999999; display:flex; flex-direction:column; gap:8px; pointer-events:none;';
            document.body.appendChild(this.container);
        }

        const colors: Record<string, { bg: string; border: string; icon: string }> = {
            info:    { bg: '#1a1a3e', border: '#4fc3f7', icon: 'ℹ️' },
            success: { bg: '#1a2e1a', border: '#66bb6a', icon: '✅' },
            warning: { bg: '#2e2a1a', border: '#ffa726', icon: '⚠️' },
            error:   { bg: '#2e1a1a', border: '#ef5350', icon: '❌' },
        };
        const c = colors[type] || colors.info;

        const toast = document.createElement('div');
        toast.className = 'notification-toast';
        toast.style.cssText = `
            background: ${c.bg};
            border: 1px solid ${c.border};
            border-left: 4px solid ${c.border};
            border-radius: 8px;
            padding: 12px 16px;
            color: #e0e0e0;
            font-size: 13px;
            line-height: 1.5;
            max-width: 420px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4);
            pointer-events: auto;
            cursor: pointer;
            opacity: 0;
            transform: translateX(100%);
            transition: opacity 0.3s ease, transform 0.3s ease;
            white-space: pre-wrap;
            word-break: break-word;
        `;

        const content = document.createElement('div');
        content.style.cssText = 'display:flex; align-items:flex-start; gap:8px;';
        
        const icon = document.createElement('span');
        icon.innerText = c.icon;
        icon.style.cssText = 'flex-shrink:0; font-size:16px;';
        content.appendChild(icon);

        const text = document.createElement('span');
        text.innerText = message;
        content.appendChild(text);

        toast.appendChild(content);
        this.container.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        });

        const remove = () => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                toast.remove();
                // Container aufräumen wenn leer
                if (this.container && this.container.children.length === 0) {
                    this.container.remove();
                    this.container = null;
                }
            }, 300);
        };

        // Click to dismiss
        toast.onclick = remove;

        // Auto-dismiss
        if (duration > 0) {
            setTimeout(remove, duration);
        }
    }
}
