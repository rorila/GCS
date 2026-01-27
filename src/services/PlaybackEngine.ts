import { Recording, RecordedAction } from './ChangeRecorder';

/**
 * PlaybackEngine - Verantwortlich für das Abspielen von Recording-Sessions
 * 
 * Steuert das Timing und die Ausführung von aufgezeichneten Aktionen.
 */
export class PlaybackEngine {
    private currentRecording: Recording | null = null;
    private isPlaying: boolean = false;
    private playbackSpeed: number = 1.0;
    private currentTime: number = 0;
    private timer: any = null;
    private lastTick: number = 0;

    // Aktueller Index in der Liste der Aktionen
    private nextActionIndex: number = 0;

    // Callbacks für die UI
    public onStateChange?: (state: 'playing' | 'paused' | 'stopped') => void;
    public onTimeUpdate?: (currentTime: number, duration: number) => void;
    public onActionExecuted?: (action: RecordedAction) => void;

    /**
     * Lädt eine Recording-Session
     */
    public load(recording: Recording): void {
        this.stop();
        this.currentRecording = recording;
        this.currentTime = 0;
        this.nextActionIndex = 0;
        this.onTimeUpdate?.(0, recording.duration);
    }

    /**
     * Startet oder setzt das Playback fort
     */
    public play(): void {
        if (!this.currentRecording || this.isPlaying) return;

        this.isPlaying = true;
        this.lastTick = Date.now();
        this.onStateChange?.('playing');

        this.timer = requestAnimationFrame(() => this.tick());
    }

    /**
     * Pausiert das Playback
     */
    public pause(): void {
        this.isPlaying = false;
        if (this.timer) {
            cancelAnimationFrame(this.timer);
            this.timer = null;
        }
        this.onStateChange?.('paused');
    }

    /**
     * Stoppt das Playback und springt zum Anfang
     */
    public stop(): void {
        this.pause();
        this.currentTime = 0;
        this.nextActionIndex = 0;
        this.onStateChange?.('stopped');
        this.onTimeUpdate?.(0, this.currentRecording?.duration || 0);
    }

    /**
     * Setzt die Playback-Geschwindigkeit (z.B. 0.5, 1.0, 2.0)
     */
    public setSpeed(speed: number): void {
        this.playbackSpeed = speed;
    }

    /**
     * Springt zu einem bestimmten Zeitpunkt im Recording
     */
    public seek(time: number): void {
        if (!this.currentRecording) return;

        this.currentTime = Math.max(0, Math.min(time, this.currentRecording.duration));

        // Finde den passenden Index für die nächste Aktion
        this.nextActionIndex = this.currentRecording.actions.findIndex(a => a.timestamp > this.currentTime);
        if (this.nextActionIndex === -1) {
            this.nextActionIndex = this.currentRecording.actions.length;
        }

        this.onTimeUpdate?.(this.currentTime, this.currentRecording.duration);
    }

    private tick(): void {
        if (!this.isPlaying || !this.currentRecording) return;

        const now = Date.now();
        const deltaTime = (now - this.lastTick) * this.playbackSpeed;
        this.lastTick = now;

        this.currentTime += deltaTime;

        // Überprüfe ob Aktionen ausgeführt werden müssen
        while (
            this.nextActionIndex < this.currentRecording.actions.length &&
            this.currentRecording.actions[this.nextActionIndex].timestamp <= this.currentTime
        ) {
            const action = this.currentRecording.actions[this.nextActionIndex];
            this.executeAction(action);
            this.nextActionIndex++;
        }

        this.onTimeUpdate?.(this.currentTime, this.currentRecording.duration);

        // Prüfe ob Ende erreicht
        if (this.currentTime >= this.currentRecording.duration) {
            this.stop();
            return;
        }

        this.timer = requestAnimationFrame(() => this.tick());
    }

    /**
     * Führt eine einzelne Aktion aus
     */
    private executeAction(action: RecordedAction): void {
        console.log(`[PlaybackEngine] Executing: ${action.description}`);
        this.onActionExecuted?.(action);

        // In dieser Phase informieren wir nur die UI/Editor über die Aktion.
        // Die visuelle Darstellung des Cursors übernimmt das PlaybackOverlay.
        // Die wirkliche Änderung am Projekt wird hier NICHT automatisch angewendet, 
        // da das Playback oft nur zum "Anschauen" gedacht ist (außer wir wollen es als Makro nutzen).
    }

    public getIsPlaying(): boolean {
        return this.isPlaying;
    }

    public getCurrentTime(): number {
        return this.currentTime;
    }

    public getDuration(): number {
        return this.currentRecording?.duration || 0;
    }
}

// Singleton Export
export const playbackEngine = new PlaybackEngine();
