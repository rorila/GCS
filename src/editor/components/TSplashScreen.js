import { TPanel } from './TPanel';
/**
 * TSplashScreen - Intro-Bildschirm Komponente
 *
 * Zeigt ein Bild oder Video für eine bestimmte Dauer an.
 * Kann als Container für animierte Sprites (z.B. Logos) dienen.
 */
export class TSplashScreen extends TPanel {
    constructor(name, x, y, width = 32, height = 24) {
        super(name, x, y, width, height);
        this._duration = 3000;
        this._autoHide = true;
        this._videoSource = '';
        this._fadeSpeed = 0.5;
        // SplashScreen füllt standardmäßig die Stage (32x24 cells)
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.align = 'NONE';
        this.style.backgroundColor = '#000000';
        this.zIndex = 1000; // Immer oben
    }
    get duration() { return this._duration; }
    set duration(value) { this._duration = value; }
    get autoHide() { return this._autoHide; }
    set autoHide(value) { this._autoHide = value; }
    get videoSource() { return this._videoSource; }
    set videoSource(value) { this._videoSource = value || ''; }
    get fadeSpeed() { return this._fadeSpeed; }
    set fadeSpeed(value) { this._fadeSpeed = value; }
    getInspectorProperties() {
        const props = super.getInspectorProperties();
        const filtered = props.filter(p => !['showGrid', 'gridColor', 'gridStyle', 'caption'].includes(p.name));
        return [
            ...filtered,
            { name: 'duration', label: 'Duration (ms)', type: 'number', group: 'Splash' },
            { name: 'autoHide', label: 'Auto Hide', type: 'boolean', group: 'Splash' },
            { name: 'videoSource', label: 'Background Video', type: 'string', group: 'Splash' },
            { name: 'fadeSpeed', label: 'Fade Speed', type: 'number', group: 'Splash' }
        ];
    }
    getEvents() {
        return [
            ...super.getEvents(),
            'onFinish'
        ];
    }
    toJSON() {
        return {
            ...super.toJSON(),
            duration: this._duration,
            autoHide: this._autoHide,
            videoSource: this._videoSource,
            fadeSpeed: this._fadeSpeed
        };
    }
}
