import { GameProject } from '../model/types';
import { IStorageAdapter } from '../ports/IStorageAdapter';
import { Logger } from '../utils/Logger';

const STORAGE_KEY = 'gcs_last_project';
const TIMESTAMP_KEY = 'gcs_last_save_time';

/**
 * Storage-Adapter für Browser-LocalStorage.
 * Dient als schneller Fallback wenn kein Server/Dateisystem verfügbar ist.
 * 
 * ⚠️ Nicht primär für Electron — dort NativeFileAdapter verwenden.
 * Speicherlimit: ~5-10 MB je nach Browser.
 * 
 * @since v3.22.0 (CleanCode Phase 3)
 */
export class LocalStorageAdapter implements IStorageAdapter {
    private static logger = Logger.get('LocalStorageAdapter', 'Project_Save_Load');
    readonly name = 'LocalStorage';

    isAvailable(): boolean {
        try {
            localStorage.setItem('_test', '1');
            localStorage.removeItem('_test');
            return true;
        } catch {
            return false;
        }
    }

    async save(project: GameProject, _filename?: string): Promise<void> {
        const json = JSON.stringify(project);
        localStorage.setItem(STORAGE_KEY, json);
        localStorage.setItem(TIMESTAMP_KEY, Date.now().toString());
        LocalStorageAdapter.logger.debug(`Auto-save. Size: ${(json.length / 1024).toFixed(2)} KB`);
    }

    async load(_filename?: string): Promise<GameProject | null> {
        const json = localStorage.getItem(STORAGE_KEY);
        if (!json) return null;
        try {
            return JSON.parse(json);
        } catch {
            LocalStorageAdapter.logger.warn('Korrupte Daten in localStorage.');
            return null;
        }
    }

    async list(): Promise<string[]> {
        const hasProject = localStorage.getItem(STORAGE_KEY) !== null;
        return hasProject ? ['last_project'] : [];
    }
}
