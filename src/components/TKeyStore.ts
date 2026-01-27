import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';

/**
 * TKeyStore - Schlüssel-Wert-Speicher Variable
 * 
 * Speichert Datensätze mit einem eindeutigen Schlüssel (z.B. Kundennummer).
 * Unterstützt CRUD-Operationen und Filterfunktionen.
 */
export class TKeyStore extends TWindow {
    public className: string = 'TKeyStore';

    /** Welche Property als Schlüssel dient (z.B. 'id', 'kundennummer') */
    public keyProperty: string = 'id';

    /** Die gespeicherten Schlüssel-Wert-Paare */
    public items: Record<string, any> = {};

    constructor(name: string, x: number, y: number) {
        super(name, x, y, 4, 2);
        this.isVariable = true;
        this.style.backgroundColor = '#00796b'; // Teal für KeyStore
        this.style.borderColor = '#004d40';
        this.style.borderWidth = 2;
    }

    // ─────────────────────────────────────────────
    // CRUD Operations
    // ─────────────────────────────────────────────

    /**
     * Erstellt einen neuen Eintrag
     * @param key - Der eindeutige Schlüssel
     * @param data - Die zu speichernden Daten
     * @returns true bei Erfolg, false wenn Schlüssel bereits existiert
     */
    public create(key: string, data: any): boolean {
        if (this.items.hasOwnProperty(key)) {
            return false; // Schlüssel existiert bereits
        }
        this.items[key] = data;
        this.fireEvent('onItemCreated', { key, data });
        return true;
    }

    /**
     * Liest einen Eintrag anhand des Schlüssels
     * @param key - Der Schlüssel des Eintrags
     * @returns Die Daten oder undefined
     */
    public read(key: string): any {
        const data = this.items[key];
        if (data !== undefined) {
            this.fireEvent('onItemRead', { key, data });
            return data;
        }
        this.fireEvent('onNotFound', { key });
        return undefined;
    }

    /**
     * Alias für read - für intuitivere Nutzung
     */
    public get(key: string): any {
        return this.read(key);
    }

    /**
     * Aktualisiert einen bestehenden Eintrag
     * @param key - Der Schlüssel des Eintrags
     * @param data - Die neuen Daten (werden mit bestehenden gemergt)
     * @returns true bei Erfolg, false wenn Schlüssel nicht existiert
     */
    public update(key: string, data: any): boolean {
        if (!this.items.hasOwnProperty(key)) {
            this.fireEvent('onNotFound', { key });
            return false;
        }
        const oldData = this.items[key];
        // Wenn beide Objekte sind, merge sie
        if (typeof oldData === 'object' && typeof data === 'object' && oldData !== null && data !== null) {
            this.items[key] = { ...oldData, ...data };
        } else {
            this.items[key] = data;
        }
        this.fireEvent('onItemUpdated', { key, oldData, newData: this.items[key] });
        return true;
    }

    /**
     * Erstellt oder aktualisiert einen Eintrag (Upsert)
     */
    public set(key: string, data: any): void {
        const exists = this.items.hasOwnProperty(key);
        this.items[key] = data;
        if (exists) {
            this.fireEvent('onItemUpdated', { key, newData: data });
        } else {
            this.fireEvent('onItemCreated', { key, data });
        }
    }

    /**
     * Löscht einen Eintrag
     * @param key - Der Schlüssel des Eintrags
     * @returns true bei Erfolg, false wenn Schlüssel nicht existiert
     */
    public delete(key: string): boolean {
        if (!this.items.hasOwnProperty(key)) {
            this.fireEvent('onNotFound', { key });
            return false;
        }
        const data = this.items[key];
        delete this.items[key];
        this.fireEvent('onItemDeleted', { key, data });
        return true;
    }

    // ─────────────────────────────────────────────
    // Filter & Suche
    // ─────────────────────────────────────────────

    /**
     * Filtert Einträge nach einer Property
     * @param property - Die zu prüfende Property
     * @param value - Der gesuchte Wert
     * @returns Array der passenden Einträge
     */
    public filter(property: string, value: any): any[] {
        return Object.values(this.items).filter(item => {
            if (typeof item === 'object' && item !== null) {
                return item[property] === value;
            }
            return false;
        });
    }

    /**
     * Findet den ersten Eintrag mit passendem Property-Wert
     * @param property - Die zu prüfende Property
     * @param value - Der gesuchte Wert
     * @returns Der gefundene Eintrag oder null
     */
    public find(property: string, value: any): any | null {
        for (const item of Object.values(this.items)) {
            if (typeof item === 'object' && item !== null && item[property] === value) {
                return item;
            }
        }
        return null;
    }

    /**
     * Prüft ob ein Schlüssel existiert
     */
    public has(key: string): boolean {
        return this.items.hasOwnProperty(key);
    }

    /**
     * Gibt alle Schlüssel zurück
     */
    public keys(): string[] {
        return Object.keys(this.items);
    }

    /**
     * Gibt alle Werte zurück
     */
    public values(): any[] {
        return Object.values(this.items);
    }

    /**
     * Gibt Schlüssel-Wert-Paare als Array zurück
     */
    public entries(): [string, any][] {
        return Object.entries(this.items);
    }

    /**
     * Gibt die Anzahl der Einträge zurück
     */
    public count(): number {
        return Object.keys(this.items).length;
    }

    /**
     * Löscht alle Einträge
     */
    public clear(): void {
        const count = this.count();
        this.items = {};
        this.fireEvent('onCleared', { count });
    }

    // ─────────────────────────────────────────────
    // Hilfsmethoden
    // ─────────────────────────────────────────────

    private fireEvent(eventName: string, data: any): void {
        const handler = (this as any)[eventName];
        if (handler && typeof handler === 'string') {
            // Event wird vom GameRuntime/TaskExecutor aufgelöst
            console.log(`[TKeyStore] Event ${eventName}:`, data);
        }
    }

    // ─────────────────────────────────────────────
    // Inspector Properties & Events
    // ─────────────────────────────────────────────

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'keyProperty', label: 'Schlüssel-Property', type: 'string', group: 'KeyStore' }
        ];
    }

    public getEvents(): string[] {
        return [
            ...super.getEvents(),
            'onItemCreated',
            'onItemUpdated',
            'onItemDeleted',
            'onItemRead',
            'onNotFound',
            'onCleared'
        ];
    }

    public toJSON(): any {
        return {
            ...super.toJSON(),
            keyProperty: this.keyProperty,
            items: this.items
        };
    }
}
