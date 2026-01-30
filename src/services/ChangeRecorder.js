/**
 * ChangeRecorder - Recording-System für Undo/Redo und Playback
 *
 * Features:
 * - Undo/Redo via rewind()/forward()
 * - Session-Recording für Playback/Tutorials
 * - Drag-Operations mit Mausbewegungspfaden
 * - Batch-Operationen für gruppierte Änderungen
 */
// ─────────────────────────────────────────────
// ChangeRecorder Service
// ─────────────────────────────────────────────
class ChangeRecorderService {
    constructor() {
        this.history = [];
        this.future = [];
        this.maxHistory = 100;
        /** Flag um Rekursion zu verhindern wenn Undo/Redo angewendet wird */
        this._isApplyingAction = false;
        // Recording Session
        this.currentRecording = null;
        this.recordingStartTime = 0;
        // Batch-Operationen
        this.currentBatch = null;
    }
    /** Prüft ob gerade eine Aktion angewendet wird (um Rekursion zu verhindern) */
    get isApplyingAction() {
        return this._isApplyingAction;
    }
    // ─────────────────────────────────────────────
    // RECORDING - Aktionen aufzeichnen
    // ─────────────────────────────────────────────
    /**
     * Zeichnet eine Aktion auf
     */
    record(action) {
        // Nicht aufzeichnen wenn gerade Undo/Redo läuft
        if (this._isApplyingAction)
            return;
        const recordedAction = {
            ...action,
            id: this.generateId(),
            timestamp: this.currentRecording
                ? Date.now() - this.recordingStartTime
                : Date.now()
        };
        // Wenn Batch aktiv, zur Batch hinzufügen
        if (this.currentBatch) {
            if (!this.currentBatch.children) {
                this.currentBatch.children = [];
            }
            this.currentBatch.children.push(recordedAction);
            return;
        }
        // Zur History hinzufügen
        this.history.push(recordedAction);
        // Future löschen (nach neuer Aktion kein Redo mehr möglich)
        this.future = [];
        // History-Limit einhalten
        while (this.history.length > this.maxHistory) {
            this.history.shift();
        }
        // Zur Recording-Session hinzufügen
        if (this.currentRecording) {
            this.currentRecording.actions.push(recordedAction);
        }
        console.log(`[ChangeRecorder] Recorded: ${action.description}`, action);
        this.onHistoryChange?.();
    }
    // ─────────────────────────────────────────────
    // SESSION RECORDING - Für Playback/Tutorials
    // ─────────────────────────────────────────────
    /**
     * Startet eine neue Recording-Session
     */
    startRecording(name, description) {
        if (this.currentRecording) {
            console.warn('[ChangeRecorder] Recording already in progress');
            return;
        }
        this.recordingStartTime = Date.now();
        this.currentRecording = {
            id: this.generateId(),
            name,
            description,
            createdAt: this.recordingStartTime,
            duration: 0,
            actions: []
        };
        console.log(`[ChangeRecorder] 🔴 Recording started: ${name}`);
    }
    /**
     * Stoppt die aktuelle Recording-Session
     */
    stopRecording() {
        if (!this.currentRecording) {
            console.warn('[ChangeRecorder] No recording in progress');
            return null;
        }
        this.currentRecording.duration = Date.now() - this.recordingStartTime;
        const recording = this.currentRecording;
        this.currentRecording = null;
        this.recordingStartTime = 0;
        console.log(`[ChangeRecorder] ⏹️ Recording stopped: ${recording.name} (${recording.actions.length} actions, ${Math.round(recording.duration / 1000)}s)`);
        return recording;
    }
    /**
     * Prüft ob gerade aufgezeichnet wird
     */
    isRecording() {
        return this.currentRecording !== null;
    }
    // ─────────────────────────────────────────────
    // BATCH OPERATIONS - Gruppierte Änderungen
    // ─────────────────────────────────────────────
    /**
     * Startet eine Batch-Operation (z.B. für Drag)
     */
    startBatch(description) {
        if (this.currentBatch) {
            console.warn('[ChangeRecorder] Batch already in progress');
            return;
        }
        this.currentBatch = {
            id: this.generateId(),
            timestamp: this.currentRecording
                ? Date.now() - this.recordingStartTime
                : Date.now(),
            type: 'batch',
            description,
            children: []
        };
    }
    /**
     * Beendet die aktuelle Batch-Operation
     */
    endBatch() {
        if (!this.currentBatch)
            return;
        // Nur hinzufügen wenn Batch Kinder hat
        if (this.currentBatch.children && this.currentBatch.children.length > 0) {
            this.history.push(this.currentBatch);
            this.future = [];
            if (this.currentRecording) {
                this.currentRecording.actions.push(this.currentBatch);
            }
            console.log(`[ChangeRecorder] Batch completed: ${this.currentBatch.description} (${this.currentBatch.children.length} actions)`);
            this.onHistoryChange?.();
        }
        this.currentBatch = null;
    }
    // ─────────────────────────────────────────────
    // UNDO/REDO
    // ─────────────────────────────────────────────
    /**
     * Macht die letzte Aktion rückgängig (Strg+Z)
     */
    rewind() {
        if (!this.canRewind())
            return null;
        const action = this.history.pop();
        this.future.push(action);
        console.log(`[ChangeRecorder] ↩️ Rewind: ${action.description}`);
        this.onHistoryChange?.();
        return action;
    }
    /**
     * Stellt die letzte rückgängig gemachte Aktion wieder her (Strg+Y)
     */
    forward() {
        if (!this.canForward())
            return null;
        const action = this.future.pop();
        this.history.push(action);
        console.log(`[ChangeRecorder] ↪️ Forward: ${action.description}`);
        this.onHistoryChange?.();
        return action;
    }
    /**
     * Setzt das Flag dass gerade eine Aktion angewendet wird
     */
    beginApplyAction() {
        this._isApplyingAction = true;
    }
    /**
     * Beendet das Anwenden einer Aktion
     */
    endApplyAction() {
        this._isApplyingAction = false;
    }
    canRewind() {
        return this.history.length > 0;
    }
    canForward() {
        return this.future.length > 0;
    }
    getRewindDescription() {
        if (!this.canRewind())
            return null;
        return this.history[this.history.length - 1].description;
    }
    getForwardDescription() {
        if (!this.canForward())
            return null;
        return this.future[this.future.length - 1].description;
    }
    // ─────────────────────────────────────────────
    // HISTORY MANAGEMENT
    // ─────────────────────────────────────────────
    /**
     * Löscht die gesamte History
     */
    clear() {
        this.history = [];
        this.future = [];
        this.currentRecording = null;
        this.currentBatch = null;
        console.log('[ChangeRecorder] History cleared');
        this.onHistoryChange?.();
    }
    /**
     * Gibt die aktuelle History zurück
     */
    getHistory() {
        return [...this.history];
    }
    /**
     * Gibt die Anzahl der Undo-Schritte zurück
     */
    getHistoryCount() {
        return this.history.length;
    }
    /**
     * Gibt die Anzahl der Redo-Schritte zurück
     */
    getFutureCount() {
        return this.future.length;
    }
    // ─────────────────────────────────────────────
    // EXPORT/IMPORT
    // ─────────────────────────────────────────────
    /**
     * Exportiert ein Recording als JSON-String
     */
    exportRecording(recording) {
        return JSON.stringify(recording, null, 2);
    }
    /**
     * Importiert ein Recording aus einem JSON-String
     */
    importRecording(json) {
        return JSON.parse(json);
    }
    // ─────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────
    generateId() {
        return `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
// Singleton Export
export const changeRecorder = new ChangeRecorderService();
