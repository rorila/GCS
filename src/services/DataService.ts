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
            if (!response.ok) {
                console.error(`[DataService] Seeding failed: HTTP ${response.status} ${response.statusText} from ${url}`);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Validate data structure if it's db.json
            if (storagePath === 'data.json') {
                console.log(`[DataService] Validating seed data. Keys: ${Object.keys(data).join(', ')}`);
            }

            await this.writeDb(storagePath, data);
            console.log(`[DataService] Seeding successful for '${storagePath}'. Saved to localStorage as gcs_db_${storagePath}`);
        } catch (e) {
            console.error(`[DataService] Seeding CRITICAL FAILURE for '${storagePath}':`, e);
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
    public async findItems(storagePath: string, collection: string, query: any = {}, operator: string = '=='): Promise<any[]> {
        console.log(`[DataService] findItems in '${storagePath}' -> '${collection}' with query:`, JSON.stringify(query), `Operator: ${operator}`);

        const db = await this.readDb(storagePath);
        if (!db[collection]) {
            console.warn(`[DataService] Collection '${collection}' not found in '${storagePath}'`);
            return [];
        }

        const list = db[collection] || [];
        console.log(`[DataService] Searching in ${list.length} items...`);

        const results = list.filter((item: any) => {
            for (const key in query) {
                const itemValue = item[key];
                const queryValue = query[key];

                // --- Operator-Logik ---
                switch (operator) {
                    case '>':
                        if (!(Number(itemValue) > Number(queryValue))) return false;
                        break;
                    case '>=':
                        if (!(Number(itemValue) >= Number(queryValue))) return false;
                        break;
                    case '<':
                        if (!(Number(itemValue) < Number(queryValue))) return false;
                        break;
                    case '<=':
                        if (!(Number(itemValue) <= Number(queryValue))) return false;
                        break;
                    case 'CONTAINS':
                        // Suche IN Listen oder Teilstrings (Feld enthält Wert)
                        if (Array.isArray(itemValue)) {
                            if (!itemValue.includes(queryValue)) return false;
                        } else if (typeof itemValue === 'string') {
                            if (!itemValue.includes(String(queryValue))) return false;
                        } else {
                            if (itemValue != queryValue) return false;
                        }
                        break;
                    case 'IN':
                        // Wert-Menge (Wert ist einer von...)
                        const set = String(queryValue).split(',').map(s => s.trim());
                        if (!set.includes(String(itemValue))) return false;
                        break;
                    case '==':
                    default:
                        // Case 1: Loose equality (covering string/number/null)
                        if (itemValue == queryValue) continue;

                        // Case 2: Smart-Match for Arrays (e.g. Emoji-PIN Array ["🍎","🍌"] vs String "🍎🍌")
                        if (Array.isArray(itemValue) && typeof queryValue === 'string') {
                            if (itemValue.join('') === queryValue) continue;
                            if (itemValue.toString() === queryValue) return false; // explicitly fail if no match
                        } else {
                            return false;
                        }
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
     * Liefert eine Liste aller verfügbaren Collections (Modelle) in der Datenbank.
     */
    public async getModels(storagePath: string): Promise<string[]> {
        const db = await this.readDb(storagePath);
        return Object.keys(db).filter(key => Array.isArray(db[key]));
    }

    /**
     * Liefert die Felder (Keys) des ersten Eintrags eines Modells.
     * Dient als "Schema-Erkennung" für IntelliSense.
     */
    public async getModelFields(storagePath: string, modelName: string): Promise<string[]> {
        const db = await this.readDb(storagePath);
        const collection = db[modelName];

        if (!Array.isArray(collection) || collection.length === 0) {
            return [];
        }

        // Union scan of ALL items to find all available keys
        const allKeys = new Set<string>();
        collection.forEach((item: any) => {
            if (typeof item === 'object' && item !== null) {
                Object.keys(item).forEach(key => allKeys.add(key));
            }
        });

        return Array.from(allKeys);
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
