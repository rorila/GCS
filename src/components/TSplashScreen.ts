import { TPanel } from './TPanel';
import { TPropertyDef } from './TComponent';

/**
 * TSplashScreen - Intro-Bildschirm Komponente
 * 
 * Zeigt ein Bild oder Video für eine bestimmte Dauer an.
 * Kann als Container für animierte Sprites (z.B. Logos) dienen.
 */
export class TSplashScreen extends TPanel {
    private _duration: number = 3000;
    private _autoHide: boolean = true;
    private _videoSource: string = '';
    private _fadeSpeed: number = 0.5;

    constructor(name: string, x: number, y: number, width: number = 32, height: number = 24) {
        super(name, x, y, width, height);

        // SplashScreen füllt standardmäßig die Stage (32x24 cells)
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.align = 'NONE';

        this.style.backgroundColor = '#000000';
        this.zIndex = 1000; // Immer oben
    }

    get duration(): number { return this._duration; }
    set duration(value: number) { this._duration = value; }

    get autoHide(): boolean { return this._autoHide; }
    set autoHide(value: boolean) { this._autoHide = value; }

    get videoSource(): string { return this._videoSource; }
    set videoSource(value: string) { this._videoSource = value || ''; }

    get fadeSpeed(): number { return this._fadeSpeed; }
    set fadeSpeed(value: number) { this._fadeSpeed = value; }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        const filtered = props.filter(p =>
            !['showGrid', 'gridColor', 'gridStyle', 'caption'].includes(p.name)
        );

        return [
            ...filtered,
            { name: 'duration', label: 'Duration (ms)', type: 'number', group: 'Splash' },
            { name: 'autoHide', label: 'Auto Hide', type: 'boolean', group: 'Splash' },
            { name: 'videoSource', label: 'Background Video', type: 'video_picker', group: 'Splash' },
            { name: 'fadeSpeed', label: 'Fade Speed', type: 'number', group: 'Splash' }
        ];
    }

    public getEvents(): string[] {
        return [
            ...super.getEvents(),
            'onFinish'
        ];
    }

    public toDTO(): any {
        return {
            ...super.toDTO(),
            duration: this._duration,
            autoHide: this._autoHide,
            videoSource: this._videoSource,
            fadeSpeed: this._fadeSpeed
        };
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TSplashScreen', (objData: any) => new TSplashScreen(objData.name, objData.x, objData.y, objData.width, objData.height));
