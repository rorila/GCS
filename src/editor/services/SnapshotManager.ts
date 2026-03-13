import { Logger } from '../../utils/Logger';

/**
 * Ein einzelner Snapshot des Projekt-Zustands.
 */
export interface Snapshot {
    /** Zeitstempel der Erstellung */
    timestamp: number;
    /** Beschreibung der Aktion die zum Snapshot führte */
    label: string;
    /** Deep-Copy des Projekt-JSON zum Zeitpunkt des Snapshots */
    projectData: any;
}

/**
 * SnapshotManager — Undo/Redo für Projekt-Daten.
 * 
 * Nimmt vor jede relevanten Änderung (Inspector, Sync) einen Snapshot
 * und ermöglicht Undo (Ctrl+Z) und Redo (Ctrl+Y).
 * 
 * Architektur:
 * - undoStack: bisherige Zustände (LIFO)
 * - redoStack: nach Undo zurückgelegte Zustände (LIFO)
 * - Bei neuem pushSnapshot() wird redoStack geleert
 * - Maximale Stack-Tiefe: 30 Snapshots (~5 MB bei 170KB pro Snapshot)
 * 
 * @since v3.14.4
 */
export class SnapshotManager {
    public static logger = Logger.get('SnapshotManager', 'Undo_Redo');

    private undoStack: Snapshot[] = [];
    private redoStack: Snapshot[] = [];
    private maxSnapshots: number;
    private isRestoring: boolean = false;

    /** Callback für Undo/Redo: lädt den Snapshot in den Editor */
    private onRestore: ((projectData: any) => void) | null = null;

    constructor(maxSnapshots: number = 30) {
        this.maxSnapshots = maxSnapshots;
    }

    /**
     * Registriert den Restore-Callback.
     * Wird aufgerufen wenn Undo/Redo den Zustand wiederherstellt.
     */
    public setRestoreCallback(cb: (projectData: any) => void): void {
        this.onRestore = cb;
    }

    /**
     * Nimmt einen Snapshot vom aktuellen Projekt-Zustand.
     * Sollte VOR jeder Datenänderung aufgerufen werden.
     * 
     * @param projectData Das aktuelle Projekt-Objekt (wird deep-cloned)
     * @param label Beschreibung der bevorstehenden Änderung
     */
    public pushSnapshot(projectData: any, label: string): void {
        // Während einer Restore-Operation keine Snapshots nehmen
        if (this.isRestoring) return;
        if (!projectData) return;

        // Throttle: Nicht öfter als 500ms snapshotten
        const now = Date.now();
        if (this.undoStack.length > 0) {
            const last = this.undoStack[this.undoStack.length - 1];
            if (now - last.timestamp < 500) {
                SnapshotManager.logger.debug(`Snapshot throttled (${now - last.timestamp}ms seit letztem).`);
                return;
            }
        }

        try {
            const snapshot: Snapshot = {
                timestamp: now,
                label,
                projectData: JSON.parse(JSON.stringify(projectData))
            };

            this.undoStack.push(snapshot);

            // Stack-Limit einhalten
            if (this.undoStack.length > this.maxSnapshots) {
                this.undoStack.shift(); // Ältesten Snapshot entfernen
            }

            // Bei neuer Aktion wird Redo-Stack geleert
            this.redoStack = [];

            SnapshotManager.logger.debug(
                `Snapshot genommen: "${label}" (Stack: ${this.undoStack.length}/${this.maxSnapshots})`
            );
        } catch (e: any) {
            SnapshotManager.logger.error(`Snapshot fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Undo: Stellt den vorherigen Zustand wieder her.
     * @param currentProjectData Das aktuelle Projekt (wird als Redo-Snapshot gesichert)
     * @returns Das wiederhergestellte Projekt-Objekt, oder null wenn kein Undo möglich
     */
    public undo(currentProjectData: any): any | null {
        if (this.undoStack.length === 0) {
            SnapshotManager.logger.info('Undo: Kein Snapshot verfügbar.');
            return null;
        }

        const snapshot = this.undoStack.pop()!;

        // Aktuellen Zustand auf Redo-Stack sichern
        try {
            this.redoStack.push({
                timestamp: Date.now(),
                label: `Redo: ${snapshot.label}`,
                projectData: JSON.parse(JSON.stringify(currentProjectData))
            });
        } catch (e: any) {
            SnapshotManager.logger.error(`Redo-Snapshot fehlgeschlagen: ${e.message}`);
        }

        SnapshotManager.logger.info(
            `Undo: "${snapshot.label}" (Undo: ${this.undoStack.length}, Redo: ${this.redoStack.length})`
        );

        // Restore auslösen
        this.isRestoring = true;
        try {
            if (this.onRestore) {
                this.onRestore(snapshot.projectData);
            }
        } finally {
            this.isRestoring = false;
        }

        return snapshot.projectData;
    }

    /**
     * Redo: Stellt den letzten rückgängig gemachten Zustand wieder her.
     * @param currentProjectData Das aktuelle Projekt (wird als Undo-Snapshot gesichert)
     * @returns Das wiederhergestellte Projekt-Objekt, oder null wenn kein Redo möglich
     */
    public redo(currentProjectData: any): any | null {
        if (this.redoStack.length === 0) {
            SnapshotManager.logger.info('Redo: Kein Snapshot verfügbar.');
            return null;
        }

        const snapshot = this.redoStack.pop()!;

        // Aktuellen Zustand auf Undo-Stack sichern (ohne Redo zu löschen)
        try {
            this.undoStack.push({
                timestamp: Date.now(),
                label: snapshot.label.replace('Redo: ', ''),
                projectData: JSON.parse(JSON.stringify(currentProjectData))
            });
        } catch (e: any) {
            SnapshotManager.logger.error(`Undo-Snapshot fehlgeschlagen: ${e.message}`);
        }

        SnapshotManager.logger.info(
            `Redo: "${snapshot.label}" (Undo: ${this.undoStack.length}, Redo: ${this.redoStack.length})`
        );

        // Restore auslösen
        this.isRestoring = true;
        try {
            if (this.onRestore) {
                this.onRestore(snapshot.projectData);
            }
        } finally {
            this.isRestoring = false;
        }

        return snapshot.projectData;
    }

    /** Prüft ob Undo möglich ist */
    public canUndo(): boolean {
        return this.undoStack.length > 0;
    }

    /** Prüft ob Redo möglich ist */
    public canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    /** Gibt die aktuelle Stack-Tiefe zurück */
    public getUndoCount(): number {
        return this.undoStack.length;
    }

    /** Gibt die aktuelle Redo-Stack-Tiefe zurück */
    public getRedoCount(): number {
        return this.redoStack.length;
    }

    /** Leert beide Stacks (z.B. nach Projekt-Laden) */
    public clear(): void {
        this.undoStack = [];
        this.redoStack = [];
        SnapshotManager.logger.debug('Stacks geleert.');
    }

    /** Status-Info für Debugging */
    public getStatus(): { undoCount: number; redoCount: number; lastLabel: string | null } {
        return {
            undoCount: this.undoStack.length,
            redoCount: this.redoStack.length,
            lastLabel: this.undoStack.length > 0
                ? this.undoStack[this.undoStack.length - 1].label
                : null
        };
    }
}

/** Globale Singleton-Instanz */
export const snapshotManager = new SnapshotManager();
