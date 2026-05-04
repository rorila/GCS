import { GameProject } from '../model/types';
import { IStorageAdapter } from '../ports/IStorageAdapter';
import { Logger } from '../utils/Logger';

const DB_NAME = 'gcs_project_store';
const DB_VERSION = 1;
const STORE_NAME = 'projects';
const PROJECT_KEY = 'last_project';

/**
 * Storage-Adapter für Browser-IndexedDB.
 * Ersetzt LocalStorageAdapter als Auto-Save-Ziel.
 * 
 * Vorteile gegenüber LocalStorage:
 * - Speicherlimit: ~50% der Festplatte (typisch hunderte MB bis GB)
 * - Asynchrone API: Blockiert nicht den Main-Thread
 * - Strukturierte Daten: Kein JSON.stringify/parse nötig
 * 
 * @since v3.32.0
 */
export class IndexedDBAdapter implements IStorageAdapter {
    private static logger = Logger.get('IndexedDBAdapter', 'Project_Save_Load');
    readonly name = 'IndexedDB';

    /** Cached DB-Verbindung (wird lazy initialisiert) */
    private db: IDBDatabase | null = null;

    /**
     * Öffnet die IndexedDB-Verbindung (lazy, einmalig).
     * Erstellt den ObjectStore beim ersten Aufruf automatisch.
     */
    private openDB(): Promise<IDBDatabase> {
        if (this.db) return Promise.resolve(this.db);

        return new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onerror = () => {
                IndexedDBAdapter.logger.error('IndexedDB konnte nicht geöffnet werden:', request.error);
                reject(request.error);
            };
        });
    }

    isAvailable(): boolean {
        return typeof indexedDB !== 'undefined';
    }

    async save(project: GameProject, _filename?: string): Promise<void> {
        const db = await this.openDB();

        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);

            // Projekt + Zeitstempel als ein Objekt speichern
            const record = {
                project,
                savedAt: Date.now()
            };

            const request = store.put(record, PROJECT_KEY);

            request.onsuccess = () => {
                // Größe grob schätzen (für Debug-Log)
                const sizeKB = JSON.stringify(project).length / 1024;
                IndexedDBAdapter.logger.debug(`Auto-save. Größe: ~${sizeKB.toFixed(0)} KB`);
                resolve();
            };

            request.onerror = () => {
                IndexedDBAdapter.logger.error('IndexedDB save fehlgeschlagen:', request.error);
                reject(request.error);
            };
        });
    }

    async load(_filename?: string): Promise<GameProject | null> {
        try {
            const db = await this.openDB();

            return new Promise<GameProject | null>((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const request = store.get(PROJECT_KEY);

                request.onsuccess = () => {
                    const record = request.result;
                    if (record && record.project) {
                        IndexedDBAdapter.logger.info(
                            `Projekt aus IndexedDB geladen (gespeichert: ${new Date(record.savedAt).toLocaleTimeString()})`
                        );
                        resolve(record.project);
                    } else {
                        resolve(null);
                    }
                };

                request.onerror = () => {
                    IndexedDBAdapter.logger.warn('IndexedDB load fehlgeschlagen:', request.error);
                    reject(request.error);
                };
            });
        } catch {
            return null;
        }
    }

    async list(): Promise<string[]> {
        try {
            const db = await this.openDB();

            return new Promise<string[]>((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const request = store.getAllKeys();

                request.onsuccess = () => {
                    resolve(request.result.map(k => String(k)));
                };

                request.onerror = () => {
                    resolve([]);
                };
            });
        } catch {
            return [];
        }
    }
}
