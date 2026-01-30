import { TPanel } from './TPanel';
/**
 * TVideo - Eigenständige Video-Komponente
 *
 * Zeigt ein Video an und bietet Steuerungsmethoden.
 * Erbt von TPanel für Container-Funktionalität.
 */
export class TVideo extends TPanel {
    constructor(name, x, y, width = 10, height = 6) {
        super(name, x, y, width, height);
        this._videoSource = '';
        this._objectFit = 'contain';
        this._imageOpacity = 1;
        this._autoplay = false;
        this._loop = false;
        this._muted = false;
        this._playbackRate = 1;
        // Runtime state (renderer should sync with this)
        this._isPlaying = false;
        this.style.backgroundColor = '#000000';
        this.style.borderWidth = 0;
    }
    get videoSource() { return this._videoSource; }
    set videoSource(value) { this._videoSource = value || ''; }
    get objectFit() { return this._objectFit; }
    set objectFit(value) { this._objectFit = value; }
    get imageOpacity() { return this._imageOpacity; }
    set imageOpacity(value) { this._imageOpacity = Math.max(0, Math.min(1, value)); }
    get autoplay() { return this._autoplay; }
    set autoplay(value) {
        this._autoplay = value;
        if (value)
            this._isPlaying = true;
    }
    get loop() { return this._loop; }
    set loop(value) { this._loop = value; }
    get muted() { return this._muted; }
    set muted(value) { this._muted = value; }
    get playbackRate() { return this._playbackRate; }
    set playbackRate(value) { this._playbackRate = value; }
    get isPlaying() { return this._isPlaying; }
    // ─────────────────────────────────────────────
    // Methods (callable via Action System)
    // ─────────────────────────────────────────────
    play() {
        this._isPlaying = true;
        console.log(`[TVideo] ${this.name}.play()`);
    }
    pause() {
        this._isPlaying = false;
        console.log(`[TVideo] ${this.name}.pause()`);
    }
    stop() {
        this._isPlaying = false;
        // The renderer should reset currentTime to 0 when it sees a stop transition 
        // or we could keep a separate state for reset.
        console.log(`[TVideo] ${this.name}.stop()`);
    }
    // ─────────────────────────────────────────────
    // Inspector Properties
    // ─────────────────────────────────────────────
    getInspectorProperties() {
        const props = super.getInspectorProperties();
        const filtered = props.filter(p => !['showGrid', 'gridColor', 'gridStyle', 'caption'].includes(p.name));
        return [
            ...filtered,
            { name: 'videoSource', label: 'Video Source', type: 'string', group: 'Video' },
            {
                name: 'objectFit', label: 'Object Fit', type: 'select', group: 'Video',
                options: ['cover', 'contain', 'fill', 'none']
            },
            { name: 'imageOpacity', label: 'Opacity', type: 'number', group: 'Video' },
            { name: 'autoplay', label: 'Autoplay', type: 'boolean', group: 'Video' },
            { name: 'loop', label: 'Loop', type: 'boolean', group: 'Video' },
            { name: 'muted', label: 'Muted', type: 'boolean', group: 'Video' },
            { name: 'playbackRate', label: 'Playback Rate', type: 'number', group: 'Video' }
        ];
    }
    // ─────────────────────────────────────────────
    // Serialization
    // ─────────────────────────────────────────────
    toJSON() {
        return {
            ...super.toJSON(),
            videoSource: this._videoSource,
            objectFit: this._objectFit,
            imageOpacity: this._imageOpacity,
            autoplay: this._autoplay,
            loop: this._loop,
            muted: this._muted,
            playbackRate: this._playbackRate
        };
    }
}
