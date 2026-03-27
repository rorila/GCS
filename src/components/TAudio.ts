import { IRuntimeComponent } from './TComponent';
import { TPropertyDef, IInspectable } from '../model/InspectorTypes';
import { TWindow } from './TWindow';
import { AudioManager } from '../runtime/AudioManager';

export class TAudio extends TWindow implements IRuntimeComponent, IInspectable {
    public className: string = 'TAudio';
    public src: string = '';
    public volume: number = 1.0;
    public loop: boolean = false;
    public preload: boolean = true;

    constructor(name: string, x: number, y: number) {
        super(name, x, y, 4, 2);
        this.isVariable = true;

        // Visibility & Scoping Meta-Flags
        this.isService = true;
        this.isHiddenInRun = true;

        // Editor styling – similar to TTimer (compact service block)
        this.style.backgroundColor = '#7e57c2';
        this.style.borderColor = '#512da8';
        this.style.borderWidth = 2;
        this.style.color = '#fff';
    }

    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...super.getInspectorProperties(),
            { name: 'src', label: 'Audio Datei', type: 'audio_picker', group: 'Audio', hint: 'Pfad oder Base64 (wird beim Export eingebettet)' },
            { name: 'volume', label: 'Lautstärke (0.0-1.0)', type: 'number', group: 'Audio' },
            { name: 'loop', label: 'Wiederholen (Loop)', type: 'boolean', group: 'Audio' },
            { name: 'preload', label: 'Preload in RAM (Zero-Latency)', type: 'boolean', group: 'Audio', hint: 'Sollte für Soundeffekte immer an sein' }
        ];
    }
    
    public getEvents(): string[] {
        return [
            ...super.getEvents(),
            'onPlay',
            'onStop'
        ];
    }

    public toJSON(): any {
        const json = super.toJSON();
        json.src = this.src;
        json.volume = this.volume;
        json.loop = this.loop;
        json.preload = this.preload;
        return json;
    }



    // ----------------------------------------------------
    // Runtime Behaviour
    // ----------------------------------------------------

    public initRuntime(_callbacks: { handleEvent: any }): void {
        // Prepare preloading if configured
        if (this.preload && this.src) {
            AudioManager.getInstance().loadAudio(this.src);
        }
    }

    public onRuntimeStart(): void {
        // Nothing strictly needed on start, wait for Actions
    }

    public onRuntimeStop(): void {
        // Ensure this audio stops playing when game stops
        this.stop();
    }

    /**
     * Public method to play the audio (can be called by play_audio action or call_method)
     */
    public play(): void {
        if (!this.src) return;
        AudioManager.getInstance().play(this.id, this.src, this.volume, this.loop);
    }

    /**
     * Public method to stop the audio
     */
    public stop(): void {
        AudioManager.getInstance().stop(this.id);
    }
}
