import { Logger } from '../utils/Logger';

/** Ein wiederverwendbarer Satz Audio-Elemente fuer genau eine Klangquelle. */
interface AudioPool {
    elements: HTMLAudioElement[];
}

/** Einmalig dekodierte PCM-Daten fuer Web Audio. */
interface WebAudioBuffer {
    buffer: AudioBuffer;
    audioId: string;
    src: string;
}

export class AudioManager {
    private static instance: AudioManager;
    private static logger = Logger.get('AudioManager', 'Runtime_Execution');

    /** Aktuell laufende HTML5-Audio-Elemente pro audioId. */
    private activeSources: Map<string, Set<HTMLAudioElement>> = new Map();

    /** Aktuell laufende Web-Audio-Sources pro audioId. */
    private activeWebSources: Map<string, Set<AudioBufferSourceNode>> = new Map();

    /**
     * PERF: Wiederverwendbare Audio-Elemente pro audioId+src.
     *
     * Zuvor erzeugte jede Wiedergabe ein neues `Audio`-Objekt. Im Standalone-Export
     * ist `src` eine eingebettete Base64-Data-URL (siehe GameExporter.embedMedia) —
     * jeder Soundeffekt kostete damit das Parsen eines bis zu mehrere MB grossen
     * Strings plus vollstaendiges Dekodieren, und zwar bei jedem Treffer, Sprung
     * oder Einsammeln. Genau in diesen Momenten brach die Framerate ein.
     *
     * Jetzt wird ein bereits dekodiertes Element zurueckgespult und erneut
     * abgespielt. Dekodiert wird nur noch einmal pro Klangquelle.
     */
    private pools: Map<string, AudioPool> = new Map();

    /** Einmalig dekodierte AudioBuffer fuer Web Audio. */
    private webBuffers: Map<string, WebAudioBuffer> = new Map();

    private audioContext: AudioContext | null = null;

    /**
     * Mehr als vier Instanzen desselben Sounds gleichzeitig sind nicht mehr
     * unterscheidbar. Die Grenze verhindert, dass eine schnelle Trefferfolge
     * unbegrenzt viele Elemente anlegt.
     */
    private readonly MAX_PER_SOUND = 4;

    private constructor() {
        // We use HTML5 Audio to avoid AudioContext decoding crashes in Electron.
        // In Browsern (iPad, Safari) wird zusaetzlich Web Audio fuer Soundeffekte genutzt.
    }

    /**
     * Heuristische Erkennung von Electron. Dort ist AudioContext historisch
     * instabil, deshalb bleiben wir bei HTML5 Audio.
     */
    private static isElectron(): boolean {
        if (typeof window === 'undefined') return false;
        const ua = (navigator.userAgent || '').toLowerCase();
        return ua.includes('electron') || !!(window as any).process?.versions?.electron;
    }

    private static isWebAudioSupported(): boolean {
        return typeof window !== 'undefined' && !AudioManager.isElectron() && (!!(window as any).AudioContext || !!(window as any).webkitAudioContext);
    }

    private initAudioContext(): AudioContext | null {
        if (this.audioContext) return this.audioContext;
        if (!AudioManager.isWebAudioSupported()) return null;

        const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
        try {
            this.audioContext = new AC();
            return this.audioContext;
        } catch (e) {
            AudioManager.logger.warn('AudioContext konnte nicht erstellt werden', e);
            return null;
        }
    }

    /**
     * Laedt die Klangdatei fuer Web Audio und dekodiert sie einmalig.
     * Bei Erfolg wird der gepoolte HTML5-Audio-Weg bei play() nicht verwendet.
     */
    private async loadAudioBuffer(resolvedSrc: string, audioId: string): Promise<AudioBuffer | null> {
        const key = AudioManager.poolKey(audioId, resolvedSrc);
        if (this.webBuffers.has(key)) {
            return this.webBuffers.get(key)!.buffer;
        }

        const ctx = this.initAudioContext();
        if (!ctx) return null;

        try {
            const response = await fetch(resolvedSrc);
            if (!response.ok) {
                AudioManager.logger.warn(`Audio-Datei nicht ladbar: ${resolvedSrc} (${response.status})`);
                return null;
            }
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            this.webBuffers.set(key, { buffer: audioBuffer, audioId, src: resolvedSrc });
            return audioBuffer;
        } catch (e) {
            AudioManager.logger.warn(`Web Audio Dekodierung fehlgeschlagen fuer ${resolvedSrc}`, e);
            return null;
        }
    }

    private getWebBuffer(audioId: string, resolvedSrc: string): AudioBuffer | null {
        const key = AudioManager.poolKey(audioId, resolvedSrc);
        return this.webBuffers.get(key)?.buffer || null;
    }

    private async playWebAudio(audioId: string, resolvedSrc: string, volume: number, loop: boolean): Promise<void> {
        const buffer = this.getWebBuffer(audioId, resolvedSrc);
        if (!buffer) return;

        const ctx = this.audioContext!;

        // iOS Safari: AudioContext muss in User-Gesture resume() bekommen haben.
        if (ctx.state === 'suspended') {
            try {
                await ctx.resume();
            } catch (e) {
                // Falls resume fehlschlaegt, versuchen wir trotzdem start()
            }
        }

        const source = ctx.createBufferSource();
        const gain = ctx.createGain();
        source.buffer = buffer;
        source.loop = loop;
        gain.gain.value = Math.max(0, Math.min(1, volume));

        source.connect(gain);
        gain.connect(ctx.destination);

        if (!this.activeWebSources.has(audioId)) {
            this.activeWebSources.set(audioId, new Set());
        }
        const sourceSet = this.activeWebSources.get(audioId)!;
        sourceSet.add(source);

        source.onended = () => {
            try {
                source.disconnect();
                gain.disconnect();
            } catch (e) { }
            sourceSet.delete(source);
        };

        source.start();
    }

    public static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    /** Pfad-Aufloesung wie bisher: absolute Projektpfade werden relativ gemacht. */
    private static resolveSrc(src: string): string {
        if (src.startsWith('/audio/') || src.startsWith('/images/')) {
            return '.' + src;
        }
        return src;
    }

    private static poolKey(audioId: string, resolvedSrc: string): string {
        return `${audioId}::${resolvedSrc}`;
    }

    /**
     * Liefert ein abspielbereites Element — bevorzugt ein bereits dekodiertes,
     * das gerade nicht laeuft.
     */
    private acquire(audioId: string, resolvedSrc: string): HTMLAudioElement {
        const key = AudioManager.poolKey(audioId, resolvedSrc);
        let pool = this.pools.get(key);
        if (!pool) {
            pool = { elements: [] };
            this.pools.set(key, pool);
        }

        // 1. Freies Element wiederverwenden — kein erneutes Dekodieren.
        for (const el of pool.elements) {
            if (el.paused || el.ended) return el;
        }

        // 2. Noch Platz: zusaetzliches Element fuer Ueberlappungen anlegen.
        if (pool.elements.length < this.MAX_PER_SOUND) {
            const el = new Audio(resolvedSrc);
            el.preload = 'auto';
            pool.elements.push(el);
            return el;
        }

        // 3. Alle belegt: das aelteste uebernehmen (Round-Robin).
        const oldest = pool.elements.shift()!;
        pool.elements.push(oldest);
        try {
            oldest.pause();
        } catch (e) { }
        return oldest;
    }

    /**
     * Laedt eine Klangquelle vorab in den Pool, damit die erste Wiedergabe
     * ohne Dekodier-Verzoegerung startet (TAudio.preload).
     */
    public async loadAudio(src: string, audioId: string = '__shared__'): Promise<any> {
        if (!src) return null;
        const resolvedSrc = AudioManager.resolveSrc(src);

        // Parallel: HTML5-Audio-Element vorbereiten UND Web-Audio-Buffer dekodieren.
        // Letzteres geschieht asynchron und blockiert den Main Thread nicht.
        try {
            const audio = this.acquire(audioId, resolvedSrc);
            audio.preload = 'auto';
            audio.load();

            // Web-Audio-Dekodierung im Hintergrund starten, damit play() spaeter
            // den schnelleren Pfad waehlen kann.
            void this.loadAudioBuffer(resolvedSrc, audioId);

            return audio;
        } catch (error) {
            AudioManager.logger.error(`Error preloading audio from src`, error);
            return null;
        }
    }

    public async play(audioId: string, src: string, volume: number = 1.0, loop: boolean = false): Promise<void> {
        if (!src) return;
        const resolvedSrc = AudioManager.resolveSrc(src);

        try {
            // Browser: Web Audio verwenden, falls der Sound bereits dekodiert wurde.
            // Das vermeidet den synchronen HTML5-Audio-Overhead auf iOS.
            const webBuffer = this.getWebBuffer(audioId, resolvedSrc);
            if (webBuffer) {
                await this.playWebAudio(audioId, resolvedSrc, volume, loop);
                return;
            }

            const audio = this.acquire(audioId, resolvedSrc);
            audio.volume = Math.max(0, Math.min(1, volume));
            audio.loop = loop;

            // Wiederverwendetes Element an den Anfang zuruecksetzen.
            if (audio.currentTime > 0) {
                try {
                    audio.currentTime = 0;
                } catch (e) { }
            }

            if (!this.activeSources.has(audioId)) {
                this.activeSources.set(audioId, new Set());
            }
            const sourceSet = this.activeSources.get(audioId)!;
            sourceSet.add(audio);

            // Nur aus der Aktiv-Liste entfernen; im Pool bleibt das Element erhalten.
            audio.onended = () => {
                sourceSet.delete(audio);
            };

            await audio.play();
        } catch (e) {
            AudioManager.logger.warn('Audio playback failed', e);
        }
    }

    public stop(audioId: string): void {
        const sourceSet = this.activeSources.get(audioId);
        if (sourceSet) {
            sourceSet.forEach(audio => {
                try {
                    audio.pause();
                    audio.currentTime = 0;
                } catch (e) { }
            });
            sourceSet.clear();
        }

        const webSourceSet = this.activeWebSources.get(audioId);
        if (webSourceSet) {
            webSourceSet.forEach(source => {
                try {
                    source.stop();
                    source.disconnect();
                } catch (e) { }
            });
            webSourceSet.clear();
        }
    }

    /**
     * Stoppt alle laufenden Klaenge. Die dekodierten Elemente bleiben absichtlich
     * im Pool, damit ein Neustart des Spiels ohne erneutes Dekodieren auskommt.
     */
    public stopAll(): void {
        this.activeSources.forEach(sourceSet => {
            sourceSet.forEach(audio => {
                try {
                    audio.pause();
                    audio.currentTime = 0;
                } catch (e) { }
            });
            sourceSet.clear();
        });
        this.activeSources.clear();

        this.activeWebSources.forEach(sourceSet => {
            sourceSet.forEach(source => {
                try {
                    source.stop();
                    source.disconnect();
                } catch (e) { }
            });
            sourceSet.clear();
        });
        this.activeWebSources.clear();
    }
}
