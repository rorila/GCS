import { Logger } from '../utils/Logger';

export class AudioManager {
    private static instance: AudioManager;
    private static logger = Logger.get('AudioManager', 'Runtime_Execution');
    
    private context: AudioContext | null = null;
    private buffers: Map<string, AudioBuffer> = new Map();
    private activeSources: Map<string, Set<AudioBufferSourceNode>> = new Map();
    private isUnlocked = false;

    private constructor() {
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
                this.context = new AudioContextClass();
                this.setupUnlockListeners();
            } else {
                AudioManager.logger.warn('Web Audio API is not supported in this browser');
            }
        } catch (e) {
            AudioManager.logger.error('Failed to initialize AudioContext', e);
        }
    }

    public static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    public get hasUnlocked(): boolean {
        return this.isUnlocked;
    }

    /**
     * Unlock AudioContext on first user interaction (Browser Policy)
     */
    private setupUnlockListeners() {
        const unlock = () => {
            if (this.context && this.context.state === 'suspended') {
                this.context.resume().then(() => {
                    this.isUnlocked = true;
                    AudioManager.logger.debug('AudioContext unlocked automatically via user interaction');
                    document.removeEventListener('pointerdown', unlock);
                    document.removeEventListener('keydown', unlock);
                    document.removeEventListener('click', unlock);
                }).catch(e => AudioManager.logger.error('Failed to resume AudioContext', e));
            } else if (this.context && this.context.state === 'running') {
                this.isUnlocked = true;
                document.removeEventListener('pointerdown', unlock);
                document.removeEventListener('keydown', unlock);
                document.removeEventListener('click', unlock);
            }
        };
        
        document.addEventListener('pointerdown', unlock, { once: true });
        document.addEventListener('keydown', unlock, { once: true });
        document.addEventListener('click', unlock, { once: true });
    }

    /**
     * Loads and decodes an audio file (URL or base64 Data-URI) into RAM.
     * @param src URL or Base64 Data-URI
     * @returns Promise resolving to the AudioBuffer
     */
    public async loadAudio(src: string): Promise<AudioBuffer | null> {
        if (!this.context) return null;
        if (this.buffers.has(src)) {
            return this.buffers.get(src)!;
        }

        try {
            const response = await fetch(src);
            const arrayBuffer = await response.arrayBuffer();
            const decodedBuffer = await this.context.decodeAudioData(arrayBuffer);
            this.buffers.set(src, decodedBuffer);
            AudioManager.logger.debug(`Successfully preloaded and decoded audio: ${src.substring(0, 50)}...`);
            return decodedBuffer;
        } catch (error) {
            AudioManager.logger.error(`Error loading audio from src: ${src.substring(0, 50)}...`, error);
            return null;
        }
    }

    /**
     * Plays a loaded audio buffer.
     * @param audioId The unique ID of the TAudio component starting this (used for stopping)
     * @param src The source path/base64 of the audio
     * @param volume Volume (0.0 to 1.0)
     * @param loop Whether the sound should loop
     */
    public async play(audioId: string, src: string, volume: number = 1.0, loop: boolean = false): Promise<void> {
        if (!this.context) return;

        // Force resume if played programmatically and policy allows it
        if (this.context.state === 'suspended') {
            try {
                await this.context.resume();
            } catch (e) {
                AudioManager.logger.warn('Could not resume AudioContext before play. User must interact first.');
            }
        }

        // Ensure buffer is loaded
        let buffer: AudioBuffer | null | undefined = this.buffers.get(src);
        if (!buffer) {
            AudioManager.logger.warn(`Audio buffer not preloaded for src: ${src.substring(0, 50)}... Loading now causing slight delay.`);
            buffer = await this.loadAudio(src);
            if (!buffer) return;
        }

        // Create buffer source node
        const sourceNode = this.context.createBufferSource();
        sourceNode.buffer = buffer;
        sourceNode.loop = loop;

        // Create gain node for volume control
        const gainNode = this.context.createGain();
        gainNode.gain.value = Math.max(0, Math.min(1, volume));

        // Connect nodes
        sourceNode.connect(gainNode);
        gainNode.connect(this.context.destination);

        // Keep track of active sources for this audioId
        if (!this.activeSources.has(audioId)) {
            this.activeSources.set(audioId, new Set());
        }
        const sourceSet = this.activeSources.get(audioId)!;
        sourceSet.add(sourceNode);

        // Remove from tracking when playback ends naturally
        sourceNode.onended = () => {
            sourceSet.delete(sourceNode);
            sourceNode.disconnect();
            gainNode.disconnect();
        };

        // Fire
        sourceNode.start(0);
    }

    /**
     * Stops all active playbacks initiated by a specific TAudio component.
     * @param audioId The ID of the component
     */
    public stop(audioId: string): void {
        const sourceSet = this.activeSources.get(audioId);
        if (sourceSet) {
            sourceSet.forEach(source => {
                try {
                    source.stop();
                    // onended callback will handle cleanup
                } catch (e) {
                    // Ignore already stopped errors
                }
            });
            sourceSet.clear();
        }
    }

    /**
     * Stop all audio across the entire manager (useful for run stage stop)
     */
    public stopAll(): void {
        this.activeSources.forEach(sourceSet => {
            sourceSet.forEach(source => {
                try {
                    source.stop();
                } catch (e) {
                    // Ignore
                }
            });
            sourceSet.clear();
        });
        this.activeSources.clear();
    }
}
