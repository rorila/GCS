import { GameProject } from '../model/types';

/**
 * Abstrakte Schnittstelle für Projekt-Persistenz.
 * Ermöglicht den Austausch der I/O-Schicht ohne Änderung der Business-Logik.
 * 
 * Implementierungen:
 * - ServerStorageAdapter: Express API (Entwicklungsmodus)
 * - LocalStorageAdapter: Browser-Fallback (5-10 MB Limit)
 * - NativeFileAdapter: FileSystem Access API / Node.js fs (Electron)
 * 
 * @since v3.22.0 (CleanCode Phase 3)
 */
export interface IStorageAdapter {
    /** Eindeutiger Name des Adapters (für Logs und Diagnostik) */
    readonly name: string;

    /** Prüft ob dieser Adapter in der aktuellen Umgebung verfügbar ist */
    isAvailable(): boolean;

    /** Speichert ein Projekt */
    save(project: GameProject, filename?: string): Promise<void>;

    /** Lädt ein Projekt */
    load(filename?: string): Promise<GameProject | null>;

    /** Listet verfügbare Projekte */
    list(): Promise<string[]>;
}

/**
 * Abstrakte Schnittstelle für Projekt-Export.
 * Trennt Export-Formate von der Export-Logik.
 * 
 * @since v3.22.0 (CleanCode Phase 3)
 */
export interface IExportAdapter {
    /** Eindeutiger Name des Export-Formats */
    readonly formatName: string;

    /** Dateiendung (z.B. '.html', '.json') */
    readonly fileExtension: string;

    /** Exportiert ein Projekt in das jeweilige Format */
    export(project: GameProject): Promise<Blob>;
}
