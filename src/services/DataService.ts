/**
 * DataService - Kapselt die Persistenz für GCS-Projekte.
 * Unterstützt localStorage im Browser (Editor/Player) und das Dateisystem in Node.js (Server).
 */
export class DataService {
    private static instance: DataService;

    private constructor() { }

    public static getInstance(): DataService {
        if (!DataService.instance) {
            DataService.instance = new DataService();
        }
        return DataService.instance;
    }

    /**
     * Lädt Daten von einer URL und speichert sie im localStorage (Seeding).
     */
    public async seedFromUrl(storagePath: string, url: string): Promise<void> {
        if (typeof window === 'undefined') return;

        try {
            console.log(`[DataService] Seeding '${storagePath}' from ${url}...`);
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            await this.writeDb(storagePath, data);
            console.log(`[DataService] Seeding successful for '${storagePath}'`);
        } catch (e) {
            console.error(`[DataService] Seeding failed for '${storagePath}':`, e);
        }
    }

    /**
     * Speichert oder aktualisiert ein Objekt in einer Collection.
     */
    public async saveItem(storagePath: string, collection: string, item: any): Promise<any> {
        if (!item.id) item.id = 'id_' + Math.random().toString(36).substr(2, 9);

        const db = await this.readDb(storagePath);
        if (!db[collection]) db[collection] = [];

        const index = db[collection].findIndex((i: any) => i.id === item.id);
        if (index !== -1) {
            db[collection][index] = { ...db[collection][index], ...item };
        } else {
            db[collection].push(item);
        }

        await this.writeDb(storagePath, db);
        return item;
    }

    /**
     * Findet Objekte in einer Collection basierend auf Filtern.
     */
    public async findItems(storagePath: string, collection: string, query: any = {}): Promise<any[]> {
        console.log(`[DataService] findItems in '${storagePath}' -> '${collection}' with query:`, JSON.stringify(query));

        const db = await this.readDb(storagePath);
        if (!db[collection]) {
            console.warn(`[DataService] Collection '${collection}' not found in '${storagePath}'`);
            return [];
        }

        const list = db[collection] || [];
        console.log(`[DataService] Searching in ${list.length} items...`);

        const results = list.filter((item: any) => {
            for (const key in query) {
                // Fuzzy check for loose type matching (e.g. number vs string)
                if (item[key] != query[key]) {
                    // console.log(`[DataService] Mismatch: item.${key}=${item[key]} != query.${key}=${query[key]}`);
                    return false;
                }
            }
            return true;
        });

        console.log(`[DataService] Found ${results.length} matches.`);
        if (results.length === 0 && list.length > 0) {
            console.log('[DataService] No matches found. Dump first item for debug:', list[0]);
        }
        return results;
    }

    /**
     * Löscht ein Objekt anhand seiner ID.
     */
    public async deleteItem(storagePath: string, collection: string, id: string): Promise<boolean> {
        const db = await this.readDb(storagePath);
        if (!db[collection]) return false;

        const initialLength = db[collection].length;
        db[collection] = db[collection].filter((item: any) => item.id !== id);

        if (db[collection].length !== initialLength) {
            await this.writeDb(storagePath, db);
            return true;
        }
        return false;
    }

    /**
     * Interne Methode zum Lesen der gesamten DB-Struktur
     */
    private async readDb(storagePath: string): Promise<any> {
        if (typeof window !== 'undefined') {
            // Browser / Editor
            const key = `gcs_db_${storagePath}`;
            const content = localStorage.getItem(key);
            console.log(`[DataService] Reading from localStorage: ${key} (${content ? 'found' : 'not found'})`);
            try {
                return content ? JSON.parse(content) : {};
            } catch (e) {
                return {};
            }
        } else {
            // Node.js - Dynamischer Import von 'fs' um Browser-Builds nicht zu stören
            try {
                const fs = await import('fs/promises');
                const path = await import('path');
                const fullPath = path.join(process.cwd(), 'data', storagePath);

                console.log(`[DataService] Reading from file: ${fullPath}`);
                const content = await fs.readFile(fullPath, 'utf-8');
                return JSON.parse(content);
            } catch (e) {
                return {};
            }
        }
    }

    /**
     * Interne Methode zum Schreiben der gesamten DB-Struktur
     */
    private async writeDb(storagePath: string, db: any): Promise<void> {
        if (typeof window !== 'undefined') {
            const key = `gcs_db_${storagePath}`;
            localStorage.setItem(key, JSON.stringify(db));
        } else {
            try {
                const fs = await import('fs/promises');
                const path = await import('path');
                const dir = path.join(process.cwd(), 'data');
                const fullPath = path.join(dir, storagePath);

                // Sicherstellen, dass das Verzeichnis existiert
                try {
                    await fs.mkdir(dir, { recursive: true });
                } catch (e) { }

                await fs.writeFile(fullPath, JSON.stringify(db, null, 2));
            } catch (e) {
                console.error('[DataService] Fehler beim Schreiben der Datei:', e);
            }
        }
    }
}

// Export Singleton
export const dataService = DataService.getInstance();
