import { playbackEngine } from '../services/PlaybackEngine';
/**
 * PlaybackOverlay - Visualisiert das Playback im Editor
 *
 * Zeigt:
 * - Ghost-Cursor
 * - Drag-Pfad (Trail)
 * - Highlights für geklickte Objekte
 */
export class PlaybackOverlay {
    constructor(parent) {
        this.ghostCursor = null;
        this.pathCanvas = null;
        this.ctx = null;
        this.container = parent;
        this.init();
        // Listen to playback events
        playbackEngine.onActionExecuted = (action) => this.handleAction(action);
        playbackEngine.onTimeUpdate = (time) => this.update(time);
        playbackEngine.onStateChange = (state) => {
            if (state === 'stopped')
                this.clearPath();
            if (state === 'playing')
                this.show();
        };
    }
    init() {
        // Ghost Cursor
        this.ghostCursor = document.createElement('div');
        this.ghostCursor.id = 'ghost-cursor';
        this.ghostCursor.innerHTML = '📍'; // Oder Icon 🖱️
        this.ghostCursor.style.position = 'absolute';
        this.ghostCursor.style.fontSize = '24px';
        this.ghostCursor.style.pointerEvents = 'none';
        this.ghostCursor.style.zIndex = '10000';
        this.ghostCursor.style.display = 'none';
        this.ghostCursor.style.transition = 'transform 0.1s linear';
        this.container.appendChild(this.ghostCursor);
        // Canvas for paths
        this.pathCanvas = document.createElement('canvas');
        this.pathCanvas.style.position = 'absolute';
        this.pathCanvas.style.top = '0';
        this.pathCanvas.style.left = '0';
        this.pathCanvas.style.width = '100%';
        this.pathCanvas.style.height = '100%';
        this.pathCanvas.style.pointerEvents = 'none';
        this.pathCanvas.style.zIndex = '9999';
        this.container.appendChild(this.pathCanvas);
        this.ctx = this.pathCanvas.getContext('2d');
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    resizeCanvas() {
        if (!this.pathCanvas)
            return;
        this.pathCanvas.width = this.container.clientWidth;
        this.pathCanvas.height = this.container.clientHeight;
    }
    show() {
        if (this.ghostCursor)
            this.ghostCursor.style.display = 'block';
    }
    hide() {
        if (this.ghostCursor)
            this.ghostCursor.style.display = 'none';
    }
    clearPath() {
        if (!this.ctx || !this.pathCanvas)
            return;
        this.ctx.clearRect(0, 0, this.pathCanvas.width, this.pathCanvas.height);
    }
    update(_currentTime) {
        // Diese Methode wird bei jedem Tick gerufen.
        // Wir könnten hier "interpolieren", aber für's erste 
        // verlässt sich das Overlay auf handleAction.
    }
    handleAction(action) {
        if (action.type === 'drag' && action.dragPath && action.dragPath.length > 0) {
            this.animateDrag(action.dragPath);
        }
        else if (action.type === 'click' || action.type === 'property') {
            // Zeige Feedback an der Position (falls verfügbar)
            // TODO
        }
    }
    animateDrag(path) {
        if (!this.ghostCursor || !this.ctx)
            return;
        const startTime = Date.now();
        const duration = path[path.length - 1].t;
        const anim = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Finde aktuellen Punkt im Pfad
            const targetT = progress * duration;
            let point = path[0];
            for (let i = 0; i < path.length - 1; i++) {
                if (path[i + 1].t >= targetT) {
                    // Interpolation
                    const p1 = path[i];
                    const p2 = path[i + 1];
                    const t = (targetT - p1.t) / (p2.t - p1.t);
                    point = {
                        x: p1.x + (p2.x - p1.x) * t,
                        y: p1.y + (p2.y - p1.y) * t,
                        t: targetT
                    };
                    break;
                }
            }
            // Cursor positionieren (offset für Zentrierung)
            const rect = this.container.getBoundingClientRect();
            const relX = point.x - rect.left;
            const relY = point.y - rect.top;
            this.ghostCursor.style.left = `${relX - 12}px`;
            this.ghostCursor.style.top = `${relY - 12}px`;
            // Pfad zeichnen
            this.drawPointOnCanvas(relX, relY);
            if (progress < 1 && playbackEngine.getIsPlaying()) {
                requestAnimationFrame(anim);
            }
        };
        requestAnimationFrame(anim);
    }
    drawPointOnCanvas(x, y) {
        if (!this.ctx)
            return;
        this.ctx.fillStyle = 'rgba(79, 195, 247, 0.5)';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 3, 0, Math.PI * 2);
        this.ctx.fill();
    }
}
