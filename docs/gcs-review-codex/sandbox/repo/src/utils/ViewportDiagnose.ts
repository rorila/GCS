/**
 * ViewportDiagnose - Permanente Viewport-/Canvas-Messwerte oben links im Bild.
 *
 * Zeigt Werte an, die iPadOS beim Zoomen/Scrollen veraendert:
 * - window.innerWidth/Height
 * - visualViewport scale/width/height/offsetTop/offsetLeft
 * - devicePixelRatio
 * - document.documentElement clientWidth/clientHeight
 * - optional: Canvas-/Stage-Masse, wenn ein Callback uebergeben wird
 *
 * Aktivierung:
 * - URL-Parameter: ?diag=1 oder ?debug=viewport
 * - Oder per Code: ViewportDiagnose.getInstance().start()
 */

export interface DiagnoseMetrics {
    stageWidth?: number;
    stageHeight?: number;
    canvasCssWidth?: number;
    canvasCssHeight?: number;
    canvasBufferWidth?: number;
    canvasBufferHeight?: number;
}

export class ViewportDiagnose {
    private static instance: ViewportDiagnose | null = null;

    private el: HTMLElement | null = null;
    private rafId: number | null = null;
    private running: boolean = false;
    private getMetrics: (() => DiagnoseMetrics | undefined) | null = null;

    private constructor() {
        this.tick = this.tick.bind(this);
    }

    public static getInstance(): ViewportDiagnose {
        if (!ViewportDiagnose.instance) {
            ViewportDiagnose.instance = new ViewportDiagnose();
        }
        return ViewportDiagnose.instance;
    }

    /**
     * Startet automatisch, wenn URL-Parameter diag=1 oder debug=viewport gesetzt ist.
     */
    public static startIfRequested(): void {
        if (typeof window === 'undefined') return;

        try {
            const params = new URLSearchParams(window.location.search);
            const wanted = params.get('diag') || '';
            const debug = (params.get('debug') || '').toLowerCase();
            if (wanted === '1' || wanted.toLowerCase() === 'true' || debug === 'viewport') {
                ViewportDiagnose.getInstance().start();
            }
        } catch (e) {
            // URL nicht auswertbar -> bleibt aus
        }
    }

    public setMetricsCallback(callback: () => DiagnoseMetrics | undefined): void {
        this.getMetrics = callback;
    }

    public start(): void {
        if (this.running) return;
        this.running = true;

        const begin = () => {
            this.createElement();
            this.rafId = requestAnimationFrame(this.tick);
        };

        if (document.body) {
            begin();
        } else {
            window.addEventListener('DOMContentLoaded', begin, { once: true });
        }
    }

    public stop(): void {
        this.running = false;
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        if (this.el && this.el.parentNode) {
            this.el.parentNode.removeChild(this.el);
        }
        this.el = null;
    }

    public toggle(): void {
        if (this.running) this.stop(); else this.start();
    }

    private tick(): void {
        if (!this.running) return;

        const dpr = window.devicePixelRatio || 1;
        const vv = (window as any).visualViewport;

        const w = window.innerWidth;
        const h = window.innerHeight;
        const doc = document.documentElement;

        const scale = vv ? `${vv.scale.toFixed(2)}` : 'n/a';
        const vvW = vv ? Math.round(vv.width) : 'n/a';
        const vvH = vv ? Math.round(vv.height) : 'n/a';
        const vvOffX = vv ? Math.round(vv.offsetLeft) : 'n/a';
        const vvOffY = vv ? Math.round(vv.offsetTop) : 'n/a';

        let metricsPart = '';
        if (this.getMetrics) {
            const m = this.getMetrics();
            if (m) {
                const sw = m.stageWidth ?? '?';
                const sh = m.stageHeight ?? '?';
                const cw = m.canvasCssWidth ?? '?';
                const ch = m.canvasCssHeight ?? '?';
                const bw = m.canvasBufferWidth ?? '?';
                const bh = m.canvasBufferHeight ?? '?';
                metricsPart =
                    `stage ${sw}x${sh}\n` +
                    `css ${cw}x${ch}\n` +
                    `buf ${bw}x${bh}\n`;
            }
        }

        const text =
            `inner ${w}x${h}\n` +
            `doc   ${doc.clientWidth}x${doc.clientHeight}\n` +
            `dpr   ${dpr.toFixed(2)}\n` +
            `vv    ${vvW}x${vvH}  scale ${scale}\n` +
            `vvOff ${vvOffX},${vvOffY}\n` +
            metricsPart;

        if (this.el) {
            this.el.textContent = text;
        }

        this.rafId = requestAnimationFrame(this.tick);
    }

    private createElement(): void {
        if (this.el) return;
        const el = document.createElement('div');
        el.id = 'viewport-diagnose';
        const s = el.style;
        s.position = 'fixed';
        s.top = '0';
        s.left = '0';
        s.zIndex = '2147483646'; // eins unter PerfOverlay
        s.background = 'rgba(20, 0, 0, 0.85)';
        s.color = '#ffcc00';
        s.font = '16px/1.4 Consolas, "Courier New", monospace';
        s.padding = '10px 14px';
        s.margin = '0';
        s.whiteSpace = 'pre';
        s.pointerEvents = 'none';
        s.borderBottomRightRadius = '6px';
        s.maxWidth = '260px';
        document.body.appendChild(el);
        this.el = el;
    }
}
