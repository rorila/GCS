import { Logger } from '../utils/Logger';

/** Ein wiederverwendbarer Satz Audio-Elemente fuer genau eine Klangquelle. */
interface AudioPool {
    elements: HTMLAudioElement[];
}

export class AudioManager {
    private static instance: AudioManager;
    private static logger = Logger.get('AudioManager', 'Runtime_Execution');
    
    /** Aktuell laufende Elemente pro audioId — Grundlage fuer stop(). */
    private activeSources: Map<string, Set<HTMLAudioElement>> = new Map();

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

    /**
     * Mehr als vier Instanzen desselben Sounds gleichzeitig sind nicht mehr
     * unterscheidbar. Die Grenze verhindert, dass eine schnelle Trefferfolge
     * unbegrenzt viele Elemente anlegt.
     */
    private readonly MAX_PER_SOUND = 4;

    private constructor() {
        // We use HTML5 Audio to avoid AudioContext decoding crashes in Electron
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

        try {
            // Ueber acquire(), damit das Element im Pool verbleibt und von play()
            // wiederverwendet wird. Zuvor wurde es sofort verworfen — die
            // Preload-Option war dadurch wirkungslos.
            const audio = this.acquire(audioId, resolvedSrc);
            audio.preload = 'auto';
            audio.load();
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
    }
}
