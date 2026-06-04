/**
 * HelpOverlay
 *
 * Zeigt eine externe URL (Hilfeseite, Doku, Video) in einem Modal-Overlay
 * über dem Editor an — ohne den Editor-Kontext zu verlassen.
 *
 * Aufruf:  HelpOverlay.getInstance().show('https://...')
 * Schließen: Zurück-Button, ✕-Button oder Escape-Taste
 */
export class HelpOverlay {
    private static instance: HelpOverlay | null = null;

    private overlay: HTMLElement;
    private iframe!: HTMLIFrameElement;
    private titleEl!: HTMLElement;
    private errorBanner!: HTMLElement;

    private constructor() {
        this.overlay = this.buildOverlay();
        document.body.appendChild(this.overlay);
    }

    public static getInstance(): HelpOverlay {
        if (!HelpOverlay.instance) {
            HelpOverlay.instance = new HelpOverlay();
        }
        return HelpOverlay.instance;
    }

    public show(url: string): void {
        this.errorBanner.style.display = 'none';
        this.titleEl.textContent = url;
        this.overlay.style.display = 'flex';

        // Fallback-Link immer anzeigen (oben im Banner) damit User notfalls neuen Tab öffnen kann
        this.errorBanner.innerHTML = `
            <a href="${url}" target="_blank" rel="noopener noreferrer"
               style="color:#4fc3f7;">
               ↗ In neuem Tab öffnen
            </a>
        `;
        this.errorBanner.style.display = 'flex';

        this.iframe.src = url;
    }

    public hide(): void {
        this.overlay.style.display = 'none';
        this.iframe.src = 'about:blank';
        this.errorBanner.style.display = 'none';
    }

    private buildOverlay(): HTMLElement {
        const overlay = document.createElement('div');
        overlay.id = 'help-overlay';
        overlay.style.cssText = `
            display: none;
            position: fixed;
            inset: 0;
            z-index: 99999;
            background: rgba(0,0,0,0.75);
            flex-direction: column;
            align-items: center;
            justify-content: center;
        `;

        // Klick auf Hintergrund schließt Overlay
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.hide();
        });

        // Escape-Taste schließt Overlay
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.overlay.style.display !== 'none') {
                this.hide();
            }
        });

        // --- Fenster ---
        const window_ = document.createElement('div');
        window_.style.cssText = `
            display: flex;
            flex-direction: column;
            width: 90vw;
            height: 88vh;
            max-width: 1400px;
            background: #1e1e2e;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 24px 64px rgba(0,0,0,0.6);
        `;

        // --- Header ---
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 16px;
            background: #181825;
            border-bottom: 1px solid #313244;
            flex-shrink: 0;
        `;

        const backBtn = document.createElement('button');
        backBtn.innerHTML = '← Zurück zum Editor';
        backBtn.style.cssText = `
            background: #313244; border: none; border-radius: 5px;
            color: #cdd6f4; padding: 6px 14px; cursor: pointer; font-size: 13px;
        `;
        backBtn.onmouseenter = () => { backBtn.style.background = '#45475a'; };
        backBtn.onmouseleave = () => { backBtn.style.background = '#313244'; };
        backBtn.onclick = () => this.hide();

        const icon = document.createElement('span');
        icon.textContent = '📖';
        icon.style.cssText = 'font-size: 18px; flex-shrink: 0;';

        this.titleEl = document.createElement('span');
        this.titleEl.style.cssText = `
            flex: 1; color: #a6adc8; font-size: 12px;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        `;

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            background: transparent; border: none; color: #6c7086;
            font-size: 18px; cursor: pointer; padding: 2px 6px; border-radius: 4px;
        `;
        closeBtn.onmouseenter = () => { closeBtn.style.color = '#f38ba8'; };
        closeBtn.onmouseleave = () => { closeBtn.style.color = '#6c7086'; };
        closeBtn.onclick = () => this.hide();

        header.appendChild(backBtn);
        header.appendChild(icon);
        header.appendChild(this.titleEl);
        header.appendChild(closeBtn);

        // --- Fehler-Banner ---
        this.errorBanner = document.createElement('div');
        this.errorBanner.style.cssText = `
            display: none;
            align-items: center;
            padding: 8px 16px;
            background: #45475a;
            color: #f9e2af;
            font-size: 13px;
            flex-shrink: 0;
        `;

        // --- iFrame ---
        this.iframe = document.createElement('iframe');
        this.iframe.src = 'about:blank';
        this.iframe.style.cssText = `
            flex: 1;
            border: none;
            background: #fff;
        `;
        this.iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox');

        window_.appendChild(header);
        window_.appendChild(this.errorBanner);
        window_.appendChild(this.iframe);
        overlay.appendChild(window_);

        return overlay;
    }
}
