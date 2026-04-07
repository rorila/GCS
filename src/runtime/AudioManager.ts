import { Logger } from '../utils/Logger';

export class AudioManager {
    private static instance: AudioManager;
    private static logger = Logger.get('AudioManager', 'Runtime_Execution');
    
    private activeSources: Map<string, Set<HTMLAudioElement>> = new Map();

    private constructor() {
        // We use HTML5 Audio to avoid AudioContext decoding crashes in Electron
    }

    public static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    public async loadAudio(src: string): Promise<any> {
        // With HTML5 Audio, preloading is handled natively by the browser.
        // We just create an audio element to warm up the cache.
        try {
            const audio = new Audio(src);
            audio.preload = 'auto';
            return audio;
        } catch (error) {
            AudioManager.logger.error(`Error preloading audio from src`, error);
            return null;
        }
    }

    public async play(audioId: string, src: string, volume: number = 1.0, loop: boolean = false): Promise<void> {
        try {
            const audio = new Audio(src);
            audio.volume = Math.max(0, Math.min(1, volume));
            audio.loop = loop;
            
            if (!this.activeSources.has(audioId)) {
                this.activeSources.set(audioId, new Set());
            }
            const sourceSet = this.activeSources.get(audioId)!;
            sourceSet.add(audio);

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
