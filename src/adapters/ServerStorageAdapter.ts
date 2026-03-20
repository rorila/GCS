import { GameProject } from '../model/types';
import { IStorageAdapter } from '../ports/IStorageAdapter';
import { Logger } from '../utils/Logger';

/**
 * Storage-Adapter für den Express Dev-Server.
 * Kommuniziert per fetch() mit /api/dev/save-project und /api/dev/load-project.
 * 
 * Verwendung: Entwicklungsmodus (npm run dev).
 * 
 * @since v3.22.0 (CleanCode Phase 3)
 */
export class ServerStorageAdapter implements IStorageAdapter {
    private static logger = Logger.get('ServerStorageAdapter', 'Project_Save_Load');
    readonly name = 'ServerStorage';

    isAvailable(): boolean {
        return typeof fetch !== 'undefined';
    }

    async save(project: GameProject, _filename?: string): Promise<void> {
        const res = await fetch('/api/dev/save-project', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(project)
        });
        const data = await res.json();
        if (!data.success) {
            throw new Error(`Server save failed: ${data.error || 'unknown'}`);
        }
        ServerStorageAdapter.logger.info('Projekt auf Server gespeichert.');
    }

    async load(filename?: string): Promise<GameProject | null> {
        const path = filename || './projects/project.json';
        const response = await fetch(`${path}?t=${Date.now()}`);
        if (!response.ok) return null;
        return await response.json();
    }

    async list(): Promise<string[]> {
        try {
            const res = await fetch('/api/dev/list-projects');
            if (!res.ok) return [];
            const data = await res.json();
            return data.files || [];
        } catch {
            return [];
        }
    }
}
