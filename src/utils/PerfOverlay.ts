import { GameLoopManager } from '../runtime/GameLoopManager';

/**
 * PerfOverlay - Diagnose-Anzeige direkt im Spiel.
 *
 * Zweck: Auf schwacher Zielhardware (Kinder-Geraete) ist keine Entwickler-Konsole
 * erreichbar. Diese Overlay-Box zeigt die entscheidenden Messwerte sichtbar im
 * Bild an, damit sich ein Ruckeln einordnen laesst:
 *
 *  - FPS und schlechteste Frame-Zeit der letzten Sekunde
 *  - Anzahl der Aussetzer (Frames ueber HITCH_MS)
 *  - Allokationsrate in MB/s sowie erkannte GC-Laeufe
 *    → Ein regelmaessiges Ruckeln im Sekundentakt bei hoher Allokationsrate
 *      ist der Fingerabdruck einer Garbage-Collection-Pause.
 *  - Hardware-Einordnung (RAM, Kerne, GPU, Pixelverhaeltnis)
 *
 * Wichtig: Die Anzeige darf das Problem nicht selbst verursachen. Im rAF-Takt
 * werden ausschliesslich Zahlen verrechnet; der DOM wird nur einmal pro Sekunde
 * angefasst.
 *
 * Aktivierung ueber URL-Parameter: ?perf=1  (oder ?debug=perf)
 */

interface HeapInfo {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
}

export class PerfOverlay {
    private static instance: PerfOverlay | null = null;

    private el: HTMLElement | null = null;
    private rafId: number | null = null;
    private running: boolean = false;

    // Frame-Messung der laufenden Sekunde
    private lastFrameTime: number = 0;
    private secondStart: number = 0;
    private frameCount: number = 0;
    private worstFrameMs: number = 0;

    // Kumulative Werte
    private hitchCount: number = 0;
    private worstEverMs: number = 0;
    private gcCount: number = 0;

    // Heap-Beobachtung
    private lastHeap: number = 0;
    private allocBytes: number = 0;

    // Trennung: eigene JS-Arbeit im Loop vs. alles andere (Paint/Raster/Compositing)
    private workStart: number = 0;
    private lastWorkMs: number = 0;
    private worstWorkMs: number = 0;
    private worstRestMs: number = 0;
    private shownWorkMs: number = 0;
    private shownRestMs: number = 0;

    // Anzeigewerte der letzten abgeschlossenen Sekunde
    private fps: number = 0;
    private shownWorstMs: number = 0;
    private allocPerSec: number = 0;

    // Snapshot des letzten sichtbaren Aussetzers (bleibt 3 Sekunden stehen)
    private lastHitchSnapshot: { frameMs: number; workMs: number; restMs: number; time: number } | null = null;
    private readonly HITCH_FREEZE_MS = 3000;

    private staticInfo: string = '';

    /** Ab dieser Frame-Dauer gilt ein Frame als sichtbarer Aussetzer. */
    private readonly HITCH_MS = 50;

    private constructor() {
        this.tick = this.tick.bind(this);
    }

    public static getInstance(): PerfOverlay {
        if (!PerfOverlay.instance) {
            PerfOverlay.instance = new PerfOverlay();
        }
        return PerfOverlay.instance;
    }

    /**
     * Prueft die URL und startet die Anzeige nur bei ausdruecklicher Anforderung.
     * Zusaetzlich werden Umschalter registriert, weil sich auf einem fremden
     * Geraet die URL oft nicht bequem aendern laesst.
     */
    public static startIfRequested(): void {
        if (typeof window === 'undefined') return;

        PerfOverlay.installCornerGesture();

        // Falls eine Tastatur vorhanden ist: F9 oder Strg+Shift+P.
        window.addEventListener('keydown', (e: KeyboardEvent) => {
            const isF9 = e.key === 'F9';
            const isCombo = e.ctrlKey && e.shiftKey && (e.key === 'P' || e.key === 'p');
            if (isF9 || isCombo) {
                PerfOverlay.getInstance().toggle();
            }
        });

        try {
            const params = new URLSearchParams(window.location.search);
            const wanted = params.get('perf') || '';
            const debugParam = (params.get('debug') || '').toLowerCase();
            const enabled = wanted === '1' || wanted.toLowerCase() === 'true' || debugParam === 'perf';
            if (enabled) {
                PerfOverlay.getInstance().start();
            }
        } catch (e) {
            // URL nicht auswertbar → Anzeige bleibt aus
        }
    }

    /**
     * Aktivierung ohne Tastatur: dreimal kurz hintereinander in die linke obere
     * Bildschirmecke tippen oder klicken.
     *
     * Bewusst so gewaehlt, dass es das Spiel nicht stoert:
     * - Nur ein kleines Eckfeld reagiert.
     * - Es sind drei Beruehrungen innerhalb von 1,5 Sekunden noetig.
     * - Das Ereignis wird nur mitgelesen (capture) und NICHT abgefangen —
     *   `preventDefault`/`stopPropagation` werden nicht aufgerufen, damit die
     *   Spielsteuerung unveraendert weiterlaeuft.
     */
    private static installCornerGesture(): void {
        const CORNER_PX = 64;
        const WINDOW_MS = 1500;
        const NEEDED_TAPS = 3;

        let tapCount = 0;
        let firstTapTime = 0;

        window.addEventListener('pointerdown', (e: PointerEvent) => {
            if (e.clientX > CORNER_PX || e.clientY > CORNER_PX) return;

            const now = performance.now();
            if (now - firstTapTime > WINDOW_MS) {
                firstTapTime = now;
                tapCount = 1;
                return;
            }

            tapCount++;
            if (tapCount >= NEEDED_TAPS) {
                tapCount = 0;
                firstTapTime = 0;
                PerfOverlay.getInstance().toggle();
            }
        }, true);
    }

    public toggle(): void {
        if (this.running) {
            this.stop();
        } else {
            this.start();
        }
    }

    /**
     * Markiert den Beginn der eigenen Loop-Arbeit (Physik, Kollision, DOM-Update).
     * Ist die Anzeige aus, kostet der Aufruf nur eine Null-Pruefung.
     */
    public static markWorkBegin(): void {
        const inst = PerfOverlay.instance;
        if (!inst || !inst.running) return;
        inst.workStart = performance.now();
    }

    /** Markiert das Ende der eigenen Loop-Arbeit. */
    public static markWorkEnd(): void {
        const inst = PerfOverlay.instance;
        if (!inst || !inst.running || inst.workStart === 0) return;
        const ms = performance.now() - inst.workStart;
        inst.workStart = 0;
        inst.lastWorkMs = ms;
        if (ms > inst.worstWorkMs) inst.worstWorkMs = ms;
    }

    public start(): void {
        if (this.running) return;
        this.running = true;

        this.staticInfo = this.collectStaticInfo();

        const begin = () => {
            this.createElement();
            const now = performance.now();
            this.lastFrameTime = now;
            this.secondStart = now;
            this.lastHeap = this.readHeap()?.usedJSHeapSize || 0;
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

    // ─────────────────────────────────────────────────────────────
    // Messung
    // ─────────────────────────────────────────────────────────────

    private tick(now: number): void {
        if (!this.running) return;

        // 1. Frame-Dauer bewerten (rein numerisch, keine Allokation)
        const frameMs = now - this.lastFrameTime;
        this.lastFrameTime = now;
        this.frameCount++;

        if (frameMs > this.worstFrameMs) this.worstFrameMs = frameMs;
        if (frameMs > this.worstEverMs) this.worstEverMs = frameMs;
        if (frameMs > this.HITCH_MS) {
            this.hitchCount++;
            this.lastHitchSnapshot = {
                frameMs,
                workMs: this.lastWorkMs,
                restMs: frameMs - this.lastWorkMs,
                time: now
            };
        }

        // Anteil, der NICHT auf eigenes JavaScript entfaellt. Bei einem langen
        // Frame mit kurzer JS-Zeit steckt die Zeit im Zeichnen, Dekodieren oder
        // Zusammensetzen der Ebenen — nicht in unserem Code.
        const restMs = frameMs - this.lastWorkMs;
        if (restMs > this.worstRestMs) this.worstRestMs = restMs;

        // 2. Heap beobachten: Anstieg = Allokation, Abfall = Garbage Collection
        const heap = this.readHeap();
        if (heap) {
            const used = heap.usedJSHeapSize;
            const delta = used - this.lastHeap;
            if (delta > 0) {
                this.allocBytes += delta;
            } else if (delta < 0) {
                this.gcCount++;
            }
            this.lastHeap = used;
        }

        // 3. Anzeige nur einmal pro Sekunde aktualisieren
        const elapsed = now - this.secondStart;
        if (elapsed >= 1000) {
            this.fps = Math.round((this.frameCount * 1000) / elapsed);
            this.shownWorstMs = this.worstFrameMs;
            this.shownWorkMs = this.worstWorkMs;
            this.shownRestMs = this.worstRestMs;
            this.allocPerSec = this.allocBytes;

            this.frameCount = 0;
            this.worstFrameMs = 0;
            this.worstWorkMs = 0;
            this.worstRestMs = 0;
            this.allocBytes = 0;
            this.secondStart = now;

            this.render();
        }

        this.rafId = requestAnimationFrame(this.tick);
    }

    private readHeap(): HeapInfo | null {
        const mem = (performance as any).memory;
        if (mem && typeof mem.usedJSHeapSize === 'number') {
            return mem as HeapInfo;
        }
        return null;
    }

    // ─────────────────────────────────────────────────────────────
    // Darstellung
    // ─────────────────────────────────────────────────────────────

    private createElement(): void {
        if (this.el) return;
        const el = document.createElement('div');
        el.id = 'perf-overlay';
        const s = el.style;
        s.position = 'fixed';
        s.top = '0';
        s.left = '0';
        s.zIndex = '2147483647';
        s.background = 'rgba(0, 0, 0, 0.88)';
        s.color = '#00ff66';
        s.font = '16px/1.45 Consolas, "Courier New", monospace';
        s.padding = '10px 14px';
        s.minWidth = '200px';
        s.margin = '0';
        s.whiteSpace = 'pre';
        s.pointerEvents = 'none';
        s.borderBottomRightRadius = '4px';
        s.textShadow = 'none';
        document.body.appendChild(el);
        this.el = el;
    }

    private render(): void {
        if (!this.el) return;

        const heap = this.readHeap();
        const usedMb = heap ? (heap.usedJSHeapSize / 1048576).toFixed(1) : '?';
        const limitMb = heap ? (heap.jsHeapSizeLimit / 1048576).toFixed(0) : '?';
        const allocMb = (this.allocPerSec / 1048576).toFixed(2);

        // Farbe als Sofort-Indikator: rot sobald Aussetzer auftreten.
        this.el.style.color = this.shownWorstMs > this.HITCH_MS ? '#ff5555' : '#00ff66';

        const target = GameLoopManager.getInstance().getTargetFPS();

        let frozenLine = '';
        if (this.lastHitchSnapshot) {
            const age = performance.now() - this.lastHitchSnapshot.time;
            if (age < this.HITCH_FREEZE_MS) {
                frozenLine = `LAST DROP  ${this.lastHitchSnapshot.frameMs.toFixed(0)}ms  js ${this.lastHitchSnapshot.workMs.toFixed(1)}  rest ${this.lastHitchSnapshot.restMs.toFixed(0)}\n`;
            }
        }

        this.el.textContent =
            `FPS ${this.fps}   target ${target}   worst ${this.shownWorstMs.toFixed(0)}ms\n` +
            `js ${this.shownWorkMs.toFixed(1)}ms   rest ${this.shownRestMs.toFixed(0)}ms\n` +
            `hitches ${this.hitchCount}  (max ${this.worstEverMs.toFixed(0)}ms)\n` +
            frozenLine +
            `alloc ${allocMb} MB/s   GC ${this.gcCount}\n` +
            `heap ${usedMb} / ${limitMb} MB\n` +
            this.staticInfo;
    }

    private collectStaticInfo(): string {
        const nav = navigator as any;
        const ram = typeof nav.deviceMemory === 'number' ? `${nav.deviceMemory} GB` : '?';
        const cores = typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : '?';
        const dpr = window.devicePixelRatio || 1;
        const w = window.innerWidth;
        const h = window.innerHeight;

        return `RAM ${ram}  cores ${cores}  dpr ${dpr}\n` +
            `view ${w}x${h}\n` +
            `gpu ${this.detectGpu()}`;
    }

    /**
     * Liest den GPU-Namen einmalig ueber WebGL aus. Die Grafikspeichergroesse
     * ist im Browser grundsaetzlich nicht abfragbar — nur der Treibername.
     */
    private detectGpu(): string {
        try {
            const canvas = document.createElement('canvas');
            const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
            if (!gl) return 'kein WebGL';

            const info = gl.getExtension('WEBGL_debug_renderer_info');
            let name = 'unbekannt';
            if (info) {
                name = String(gl.getParameter((info as any).UNMASKED_RENDERER_WEBGL) || 'unbekannt');
            }

            const lose = gl.getExtension('WEBGL_lose_context');
            if (lose) (lose as any).loseContext();

            return name.length > 38 ? name.substring(0, 38) : name;
        } catch (e) {
            return 'nicht ermittelbar';
        }
    }
}
