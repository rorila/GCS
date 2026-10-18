import { TWindow } from './TWindow';
import { IRuntimeComponent } from './TComponent';
import { TPropertyDef } from '../model/InspectorTypes';
import { ISpeechAudioAdapter } from '../ports/ISpeechAudioAdapter';
import { CmsSpeechAudioAdapter } from '../adapters/CmsSpeechAudioAdapter';
import { ComponentRegistry } from '../utils/ComponentRegistry';
import { Logger } from '../utils/Logger';

/** GCS-Service: Konfiguration im JSON, I/O über einen austauschbaren Port. */
export class TTextToSpeech extends TWindow implements IRuntimeComponent {
    public className = 'TTextToSpeech';
    public endpoint = '/api/tts';
    private launchKey = '';
    public text = '';
    public voice = 'default';
    public volume = 1;
    public lastError = '';
    public audioUrl = '';
    private enabled = true;
    private generation = 0;
    private request?: AbortController;
    private audio?: HTMLAudioElement;
    private prepared = new Map<string, HTMLAudioElement>();
    private prefetchRequests = new Set<AbortController>();
    private emit: (event: string, data?: unknown) => void = () => {};
    private static logger = Logger.get('TTextToSpeech', 'Runtime_Execution');

    constructor(name = 'SprachAusgabe', x = 0, y = 0,
        private adapter: ISpeechAudioAdapter = new CmsSpeechAudioAdapter()) {
        super(name, x, y, 4, 2);
        this.isService = true;
        this.isHiddenInRun = true;
        this.style.backgroundColor = '#7e57c2';
    }
    get active(): boolean { return this.enabled; }
    set active(value: boolean) { this.enabled = value; if (!value) this.stop(); }

    getInspectorProperties(): TPropertyDef[] {
        return [...super.getInspectorProperties(),
            { name: 'endpoint', label: 'Sprachserver-URL', type: 'string', group: 'Sprache' },
            { name: 'text', label: 'Sprechtext', type: 'string', group: 'Sprache' },
            { name: 'voice', label: 'Stimmen-ID', type: 'string', group: 'Sprache' },
            { name: 'volume', label: 'Lautstärke', type: 'number', min: 0, max: 1, group: 'Sprache' },
            { name: 'active', label: 'Aktiv', type: 'boolean', group: 'Sprache' }
        ];
    }
    getEvents(): string[] { return [...super.getEvents(), 'onReady', 'onPlay', 'onEnded', 'onStop', 'onError']; }
    toDTO(): any {
        return super.toDTO(); // Bewahrt auch die ursprünglichen GCS-Binding-Ausdrücke.
    }
    initRuntime(callbacks: { handleEvent: (id: string, event: string, data?: unknown) => void; contextVars?: Record<string, any> }): void {
        const key = callbacks.contextVars?.CMS_LAUNCH;
        this.launchKey = typeof key === "string" ? key : key?.value || "";
        this.emit = (event, data) => callbacks.handleEvent(this.id, event, data);
    }
    onRuntimeStop(): void {
        this.stop();
        for (const request of this.prefetchRequests) request.abort();
        this.prefetchRequests.clear();
        for (const audio of this.prepared.values()) this.releaseAudio(audio);
        this.prepared.clear();
        this.emit = () => {};
    }

    /** Lädt eine nächste Ansage vor. Leerer Parameter verwendet die Eigenschaft text. */
    async prefetch(text = this.text): Promise<string | undefined> {
        if (!this.active || this.prefetchRequests.size >= 2) return;
        const key = this.preparedKey(text);
        const existing = this.prepared.get(key);
        if (existing) return existing.src;
        const request = new AbortController();
        this.prefetchRequests.add(request);
        const timeout = setTimeout(() => request.abort(), 60_000);
        try {
            const url = await this.adapter.prepare(this.endpoint, text, this.voice, request.signal, this.launchKey);
            if (request.signal.aborted || !this.active) { this.adapter.releaseAudio?.(url); return; }
            const audio = this.adapter.createAudio();
            audio.preload = 'auto';
            audio.src = url;
            audio.load();
            if (this.prepared.size >= 2) {
                const oldest = this.prepared.keys().next().value!;
                this.releaseAudio(this.prepared.get(oldest)!);
                this.prepared.delete(oldest);
            }
            const previous = this.prepared.get(key);
            if (previous) this.releaseAudio(previous);
            this.prepared.set(key, audio);
            this.emit('onReady', { audioUrl: url });
            return url;
        } catch (error) { if (!request.signal.aborted) this.fail(error); return undefined; }
        finally { clearTimeout(timeout); this.prefetchRequests.delete(request); }
    }
    async speak(text = this.text): Promise<string | undefined> { return this.prepare(text, true); }

    private async prepare(text: string, play: boolean): Promise<string | undefined> {
        if (!this.active) return;
        this.stop(false);
        const generation = this.generation;
        const request = this.request = new AbortController();
        const timeout = setTimeout(() => request.abort(), 60_000);
        this.lastError = '';
        try {
            const key = this.preparedKey(text);
            const prepared = this.prepared.get(key);
            const url = prepared?.src || await this.adapter.prepare(this.endpoint, text, this.voice, request.signal, this.launchKey);
            if (generation !== this.generation) { this.adapter.releaseAudio?.(url); return; }
            this.audioUrl = url;
            const audio = this.audio = prepared || this.adapter.createAudio();
            this.prepared.delete(key);
            audio.preload = 'auto';
            audio.src = url;
            audio.volume = Math.max(0, Math.min(1, Number(this.volume) || 0));
            audio.onended = () => { if (generation === this.generation) this.emit('onEnded'); };
            audio.onerror = () => { if (generation === this.generation) this.fail(new Error('Audio konnte nicht geladen werden.')); };
            audio.load();
            this.emit('onReady', { audioUrl: url });
            if (play && generation === this.generation) {
                await audio.play();
                if (generation === this.generation) this.emit('onPlay');
            }
            return url;
        } catch (error) {
            if (generation === this.generation) this.fail(error);
            return undefined; // Audiofehler dürfen den Task/das Spiel nicht abbrechen.
        } finally { clearTimeout(timeout); }
    }
    private fail(error: unknown): void {
        this.lastError = error instanceof Error ? error.message : String(error);
        TTextToSpeech.logger.error(this.lastError);
        this.emit('onError', { message: this.lastError });
    }
    private preparedKey(text: string): string { return JSON.stringify([this.endpoint, this.voice, text]); }
    private releaseAudio(audio: HTMLAudioElement): void {
        audio.onended = null;
        audio.onerror = null;
        audio.pause();
        this.adapter.releaseAudio?.(audio.src);
        audio.removeAttribute('src');
        audio.load();
    }
    stop(notify = true): void {
        this.generation++;
        this.request?.abort();
        this.request = undefined;
        if (this.audio) {
            this.releaseAudio(this.audio);
            this.audio = undefined;
        }
        if (notify) this.emit('onStop');
    }
}
ComponentRegistry.register('TTextToSpeech', data => new TTextToSpeech(data.name, data.x, data.y));
