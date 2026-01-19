import { TPanel } from './TPanel';
import { TPropertyDef } from './TComponent';
import { ImageFit } from './ImageCapable';

/**
 * TVideo - Eigenständige Video-Komponente
 * 
 * Zeigt ein Video an und bietet Steuerungsmethoden.
 * Erbt von TPanel für Container-Funktionalität.
 */
export class TVideo extends TPanel {
    private _videoSource: string = '';
    private _objectFit: ImageFit = 'contain';
    private _imageOpacity: number = 1;
    private _autoplay: boolean = false;
    private _loop: boolean = false;
    private _muted: boolean = false;
    private _playbackRate: number = 1;

    // Runtime state (renderer should sync with this)
    private _isPlaying: boolean = false;

    constructor(name: string, x: number, y: number, width: number = 10, height: number = 6) {
        super(name, x, y, width, height);
        this.style.backgroundColor = '#000000';
        this.style.borderWidth = 0;
    }

    get videoSource(): string { return this._videoSource; }
    set videoSource(value: string) { this._videoSource = value || ''; }

    get objectFit(): ImageFit { return this._objectFit; }
    set objectFit(value: ImageFit) { this._objectFit = value; }

    get imageOpacity(): number { return this._imageOpacity; }
    set imageOpacity(value: number) { this._imageOpacity = Math.max(0, Math.min(1, value)); }

    get autoplay(): boolean { return this._autoplay; }
    set autoplay(value: boolean) {
        this._autoplay = value;
        if (value) this._isPlaying = true;
    }

    get loop(): boolean { return this._loop; }
    set loop(value: boolean) { this._loop = value; }

    get muted(): boolean { return this._muted; }
    set muted(value: boolean) { this._muted = value; }

    get playbackRate(): number { return this._playbackRate; }
    set playbackRate(value: number) { this._playbackRate = value; }

    get isPlaying(): boolean { return this._isPlaying; }

    // ─────────────────────────────────────────────
    // Methods (callable via Action System)
    // ─────────────────────────────────────────────

    public play(): void {
        this._isPlaying = true;
        console.log(`[TVideo] ${this.name}.play()`);
    }

    public pause(): void {
        this._isPlaying = false;
        console.log(`[TVideo] ${this.name}.pause()`);
    }

    public stop(): void {
        this._isPlaying = false;
        // The renderer should reset currentTime to 0 when it sees a stop transition 
        // or we could keep a separate state for reset.
        console.log(`[TVideo] ${this.name}.stop()`);
    }

    // ─────────────────────────────────────────────
    // Inspector Properties
    // ─────────────────────────────────────────────

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        const filtered = props.filter(p =>
            !['showGrid', 'gridColor', 'gridStyle', 'caption'].includes(p.name)
        );

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

    public toJSON(): any {
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
