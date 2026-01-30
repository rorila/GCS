/**
 * PlaybackEngine - Verantwortlich für das Abspielen von Recording-Sessions
 *
 * Steuert das Timing und die Ausführung von aufgezeichneten Aktionen.
 */
export class PlaybackEngine {
    constructor() {
        this.currentRecording = null;
        this.isPlaying = false;
        this.playbackSpeed = 1.0;
        this.currentTime = 0;
        this.timer = null;
        this.lastTick = 0;
        // Aktueller Index in der Liste der Aktionen
        this.nextActionIndex = 0;
    }
    /**
     * Lädt eine Recording-Session
     */
    load(recording) {
        this.stop();
        this.currentRecording = recording;
        this.currentTime = 0;
        this.nextActionIndex = 0;
        this.onTimeUpdate?.(0, recording.duration);
    }
    /**
     * Startet oder setzt das Playback fort
     */
    play() {
        if (!this.currentRecording || this.isPlaying)
            return;
        this.isPlaying = true;
        this.lastTick = Date.now();
        this.onStateChange?.('playing');
        this.timer = requestAnimationFrame(() => this.tick());
    }
    /**
     * Pausiert das Playback
     */
    pause() {
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
    stop() {
        this.pause();
        this.currentTime = 0;
        this.nextActionIndex = 0;
        this.onStateChange?.('stopped');
        this.onTimeUpdate?.(0, this.currentRecording?.duration || 0);
    }
    /**
     * Setzt die Playback-Geschwindigkeit (z.B. 0.5, 1.0, 2.0)
     */
    setSpeed(speed) {
        this.playbackSpeed = speed;
    }
    /**
     * Springt zu einem bestimmten Zeitpunkt im Recording
     */
    seek(time) {
        if (!this.currentRecording)
            return;
        this.currentTime = Math.max(0, Math.min(time, this.currentRecording.duration));
        // Finde den passenden Index für die nächste Aktion
        this.nextActionIndex = this.currentRecording.actions.findIndex(a => a.timestamp > this.currentTime);
        if (this.nextActionIndex === -1) {
            this.nextActionIndex = this.currentRecording.actions.length;
        }
        this.onTimeUpdate?.(this.currentTime, this.currentRecording.duration);
    }
    tick() {
        if (!this.isPlaying || !this.currentRecording)
            return;
        const now = Date.now();
        const deltaTime = (now - this.lastTick) * this.playbackSpeed;
        this.lastTick = now;
        this.currentTime += deltaTime;
        // Überprüfe ob Aktionen ausgeführt werden müssen
        while (this.nextActionIndex < this.currentRecording.actions.length &&
            this.currentRecording.actions[this.nextActionIndex].timestamp <= this.currentTime) {
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
    executeAction(action) {
        console.log(`[PlaybackEngine] Executing: ${action.description}`);
        this.onActionExecuted?.(action);
        // In dieser Phase informieren wir nur die UI/Editor über die Aktion.
        // Die visuelle Darstellung des Cursors übernimmt das PlaybackOverlay.
        // Die wirkliche Änderung am Projekt wird hier NICHT automatisch angewendet, 
        // da das Playback oft nur zum "Anschauen" gedacht ist (außer wir wollen es als Makro nutzen).
    }
    getIsPlaying() {
        return this.isPlaying;
    }
    getCurrentTime() {
        return this.currentTime;
    }
    getDuration() {
        return this.currentRecording?.duration || 0;
    }
}
// Singleton Export
export const playbackEngine = new PlaybackEngine();
