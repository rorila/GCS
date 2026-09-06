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
// Typen
// ─────────────────────────────────────────────

export type ActionType = 'property' | 'create' | 'delete' | 'drag' | 'click' | 'select' | 'batch';
export type ObjectType = 'object' | 'action' | 'task' | 'variable' | 'flow' | 'connection';

/** Position mit Zeitstempel für Drag-Pfad */
export interface DragPoint {
    x: number;
    y: number;
    t: number;  // Zeitpunkt relativ zum Drag-Start (ms)
}

/** Einzelne aufgezeichnete Aktion */
export interface RecordedAction {
    id: string;
    timestamp: number;           // Zeitpunkt relativ zum Recording-Start (ms)
    type: ActionType;
    description: string;

    // Für Property-Änderungen
    objectType?: ObjectType;
    objectId?: string;
    property?: string;
    oldValue?: any;
    newValue?: any;

    // Für Drag-Operationen
    dragPath?: DragPoint[];
    startPosition?: { x: number; y: number };
    endPosition?: { x: number; y: number };

    // Für Create/Delete
    objectData?: any;

    // Für Batch (gruppierte Änderungen)
    children?: RecordedAction[];
}

/** Komplette Recording-Session */
export interface Recording {
    id: string;
    name: string;
    description?: string;
    createdAt: number;
    duration: number;
    actions: RecordedAction[];
    metadata?: {
        projectName?: string;
        author?: string;
        version?: string;
    };
}

// ─────────────────────────────────────────────
// ChangeRecorder Service
// ─────────────────────────────────────────────

import { Logger } from '../utils/Logger';

class ChangeRecorderService {
    private static logger = Logger.get('ChangeRecorder', 'Editor_Diagnostics');
    private history: RecordedAction[] = [];
    private future: RecordedAction[] = [];
    private maxHistory: number = 100;

    /** Flag um Rekursion zu verhindern wenn Undo/Redo angewendet wird */
    private _isApplyingAction: boolean = false;

    // Recording Session
    private currentRecording: Recording | null = null;
    private recordingStartTime: number = 0;

    // Batch-Operationen
    private currentBatch: RecordedAction | null = null;

    // Callbacks für UI-Updates
    public onHistoryChange?: () => void;

    /** Prüft ob gerade eine Aktion angewendet wird (um Rekursion zu verhindern) */
    public get isApplyingAction(): boolean {
        return this._isApplyingAction;
    }

    // ─────────────────────────────────────────────
    // RECORDING - Aktionen aufzeichnen
    // ─────────────────────────────────────────────

    /**
     * Zeichnet eine Aktion auf
     */
    public record(action: Omit<RecordedAction, 'id' | 'timestamp'>): void {
        // Nicht aufzeichnen wenn gerade Undo/Redo läuft
        if (this._isApplyingAction) return;

        const recordedAction: RecordedAction = {
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

        ChangeRecorderService.logger.info(`Recorded: ${action.description}`, action);
        this.onHistoryChange?.();
    }

    // ─────────────────────────────────────────────
    // SESSION RECORDING - Für Playback/Tutorials
    // ─────────────────────────────────────────────

    /**
     * Startet eine neue Recording-Session
     */
    public startRecording(name: string, description?: string): void {
        if (this.currentRecording) {
            ChangeRecorderService.logger.warn('Recording already in progress');
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

        ChangeRecorderService.logger.info(`🔴 Recording started: ${name}`);
    }

    /**
     * Stoppt die aktuelle Recording-Session
     */
    public stopRecording(): Recording | null {
        if (!this.currentRecording) {
            ChangeRecorderService.logger.warn('No recording in progress');
            return null;
        }

        this.currentRecording.duration = Date.now() - this.recordingStartTime;
        const recording = this.currentRecording;
        this.currentRecording = null;
        this.recordingStartTime = 0;

        ChangeRecorderService.logger.info(`⏹️ Recording stopped: ${recording.name} (${recording.actions.length} actions, ${Math.round(recording.duration / 1000)}s)`);
        return recording;
    }

    /**
     * Prüft ob gerade aufgezeichnet wird
     */
    public isRecording(): boolean {
        return this.currentRecording !== null;
    }

    // ─────────────────────────────────────────────
    // BATCH OPERATIONS - Gruppierte Änderungen
    // ─────────────────────────────────────────────

    /**
     * Startet eine Batch-Operation (z.B. für Drag)
     */
    public startBatch(description: string): void {
        if (this.currentBatch) {
            ChangeRecorderService.logger.warn('Batch already in progress');
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
    public endBatch(): void {
        if (!this.currentBatch) return;

        // Nur hinzufügen wenn Batch Kinder hat
        if (this.currentBatch.children && this.currentBatch.children.length > 0) {
            this.history.push(this.currentBatch);
            this.future = [];

            if (this.currentRecording) {
                this.currentRecording.actions.push(this.currentBatch);
            }

            ChangeRecorderService.logger.info(`Batch completed: ${this.currentBatch.description} (${this.currentBatch.children.length} actions)`);
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
    public rewind(): RecordedAction | null {
        if (!this.canRewind()) return null;

        const action = this.history.pop()!;
        this.future.push(action);

        ChangeRecorderService.logger.info(`↩️ Rewind: ${action.description}`);
        this.onHistoryChange?.();

        return action;
    }

    /**
     * Stellt die letzte rückgängig gemachte Aktion wieder her (Strg+Y)
     */
    public forward(): RecordedAction | null {
        if (!this.canForward()) return null;

        const action = this.future.pop()!;
        this.history.push(action);

        ChangeRecorderService.logger.info(`↪️ Forward: ${action.description}`);
        this.onHistoryChange?.();

        return action;
    }

    /**
     * Setzt das Flag dass gerade eine Aktion angewendet wird
     */
    public beginApplyAction(): void {
        this._isApplyingAction = true;
    }

    /**
     * Beendet das Anwenden einer Aktion
     */
    public endApplyAction(): void {
        this._isApplyingAction = false;
    }

    public canRewind(): boolean {
        return this.history.length > 0;
    }

    public canForward(): boolean {
        return this.future.length > 0;
    }

    public getRewindDescription(): string | null {
        if (!this.canRewind()) return null;
        return this.history[this.history.length - 1].description;
    }

    public getForwardDescription(): string | null {
        if (!this.canForward()) return null;
        return this.future[this.future.length - 1].description;
    }

    // ─────────────────────────────────────────────
    // HISTORY MANAGEMENT
    // ─────────────────────────────────────────────

    /**
     * Löscht die gesamte History
     */
    public clear(): void {
        this.history = [];
        this.future = [];
        this.currentRecording = null;
        this.currentBatch = null;

        ChangeRecorderService.logger.info('History cleared');
        this.onHistoryChange?.();
    }

    /**
     * Gibt die aktuelle History zurück
     */
    public getHistory(): RecordedAction[] {
        return [...this.history];
    }

    /**
     * Gibt die Anzahl der Undo-Schritte zurück
     */
    public getHistoryCount(): number {
        return this.history.length;
    }

    /**
     * Gibt die Anzahl der Redo-Schritte zurück
     */
    public getFutureCount(): number {
        return this.future.length;
    }

    // ─────────────────────────────────────────────
    // EXPORT/IMPORT
    // ─────────────────────────────────────────────

    /**
     * Exportiert ein Recording als JSON-String
     */
    public exportRecording(recording: Recording): string {
        return JSON.stringify(recording, null, 2);
    }

    /**
     * Importiert ein Recording aus einem JSON-String
     */
    public importRecording(json: string): Recording {
        return JSON.parse(json) as Recording;
    }

    // ─────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────

    private generateId(): string {
        return `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Singleton Export
export const changeRecorder = new ChangeRecorderService();
