import { TWindow } from './TWindow';
import type { IRuntimeComponent, TPropertyDef } from './TComponent';
import type { ISpeechRecognitionAdapter } from '../ports/ISpeechRecognitionAdapter';
import { BrowserSpeechRecognitionAdapter } from '../adapters/BrowserSpeechRecognitionAdapter';
import { ComponentRegistry } from '../utils/ComponentRegistry';

export class TSpeechRecognition extends TWindow implements IRuntimeComponent {
    public className = 'TSpeechRecognition';
    public language = 'de-DE';
    public maxDurationMs = 12000;
    public silenceMs = 1000;
    public prompt = '';
    public transcript = '';
    public status = 'idle';
    public available = false;
    public errorMessage = '';
    private launchKey = '';
    private generation = 0;
    private emit = (_event: string) => {};
    private adapter: ISpeechRecognitionAdapter;

    constructor(name = 'Spracherkennung', x = 0, y = 0, adapter: ISpeechRecognitionAdapter = new BrowserSpeechRecognitionAdapter()) {
        super(name, x, y, 4, 2);
        this.adapter = adapter;
        this.isService = true;
        this.isHiddenInRun = true;
    }
    public initRuntime(callbacks: { handleEvent: (id: string, event: string) => void }): void {
        this.emit = event => callbacks.handleEvent(this.id, event);
    }
    public prepare(launchKey = ''): void {
        this.cancel();
        this.launchKey = launchKey;
        const generation = this.generation;
        this.status = 'preparing';
        this.errorMessage = '';
        void this.adapter.prepare(launchKey).then(() => {
            if (generation !== this.generation) return;
            this.available = true; this.status = 'ready'; this.emit('onReady');
        }).catch(error => this.fail(generation, error));
    }
    public start(): void {
        if (this.status === 'listening' || this.status === 'processing') return;
        if (!this.available) { this.fail(this.generation, new Error('Spracheingabe zuerst freigeben.')); return; }
        const generation = ++this.generation;
        this.status = 'listening'; this.transcript = ''; this.errorMessage = '';
        this.emit('onListening');
        void this.adapter.listen(this.launchKey, { language: this.language, maxDurationMs: this.maxDurationMs, silenceMs: this.silenceMs, prompt: this.prompt }).then(result => {
            if (generation !== this.generation) return;
            this.transcript = result.text.trim(); this.status = 'ready';
            this.emit(this.transcript ? 'onResult' : 'onNoSpeech');
        }).catch(error => this.fail(generation, error));
    }
    public stop(): void { if (this.status === 'listening') { this.status = 'processing'; this.adapter.stop(); } }
    public cancel(): void { this.generation++; this.adapter.cancel(); this.status = 'idle'; }
    public onRuntimeStop(): void { this.cancel(); this.available = false; }
    private fail(generation: number, error: unknown): void {
        if (generation !== this.generation) return;
        this.errorMessage = error instanceof Error ? error.message : 'Spracherkennung fehlgeschlagen.';
        this.status = 'error'; this.emit('onError');
    }
    public getEvents(): string[] { return [...super.getEvents(), 'onReady', 'onListening', 'onResult', 'onNoSpeech', 'onError']; }
    public getInspectorProperties(): TPropertyDef[] {
        return [...super.getInspectorProperties(),
            { name: 'language', label: 'Sprache', type: 'string', group: 'Spracheingabe' },
            { name: 'maxDurationMs', label: 'Maximale Aufnahme (ms)', type: 'number', group: 'Spracheingabe' },
            { name: 'silenceMs', label: 'Sprechpause bis Abschluss (ms)', type: 'number', group: 'Spracheingabe' },
            { name: 'prompt', label: 'Erkennungshinweis', type: 'string', group: 'Spracheingabe', hint: 'Erwartete Antwortart, z. B. „Antwort ist eine Zahl.“ – steuert den Erkennungskontext.' },
            ...['transcript', 'status', 'errorMessage'].map(name => ({ name, label: name, type: 'string' as const, readonly: true, group: 'Status' })),
            { name: 'available', label: 'Verfügbar', type: 'boolean', readonly: true, group: 'Status' }];
    }
    public toDTO(): any {
        const dto = super.toDTO();
        for (const key of ['transcript', 'status', 'available', 'errorMessage']) delete dto[key];
        return { ...dto, language: this.language, maxDurationMs: this.maxDurationMs, silenceMs: this.silenceMs, prompt: this.prompt };
    }
}
ComponentRegistry.register('TSpeechRecognition', data => new TSpeechRecognition(data.name, data.x, data.y));
