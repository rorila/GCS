import { TWindow } from './TWindow';
/**
 * TKeyStore - Schlüssel-Wert-Speicher Variable
 *
 * Speichert Datensätze mit einem eindeutigen Schlüssel (z.B. Kundennummer).
 * Unterstützt CRUD-Operationen und Filterfunktionen.
 */
export class TKeyStore extends TWindow {
    constructor(name, x, y) {
        super(name, x, y, 4, 2);
        this.className = 'TKeyStore';
        /** Welche Property als Schlüssel dient (z.B. 'id', 'kundennummer') */
        this.keyProperty = 'id';
        /** Die gespeicherten Schlüssel-Wert-Paare */
        this.items = {};
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
    create(key, data) {
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
    read(key) {
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
    get(key) {
        return this.read(key);
    }
    /**
     * Aktualisiert einen bestehenden Eintrag
     * @param key - Der Schlüssel des Eintrags
     * @param data - Die neuen Daten (werden mit bestehenden gemergt)
     * @returns true bei Erfolg, false wenn Schlüssel nicht existiert
     */
    update(key, data) {
        if (!this.items.hasOwnProperty(key)) {
            this.fireEvent('onNotFound', { key });
            return false;
        }
        const oldData = this.items[key];
        // Wenn beide Objekte sind, merge sie
        if (typeof oldData === 'object' && typeof data === 'object' && oldData !== null && data !== null) {
            this.items[key] = { ...oldData, ...data };
        }
        else {
            this.items[key] = data;
        }
        this.fireEvent('onItemUpdated', { key, oldData, newData: this.items[key] });
        return true;
    }
    /**
     * Erstellt oder aktualisiert einen Eintrag (Upsert)
     */
    set(key, data) {
        const exists = this.items.hasOwnProperty(key);
        this.items[key] = data;
        if (exists) {
            this.fireEvent('onItemUpdated', { key, newData: data });
        }
        else {
            this.fireEvent('onItemCreated', { key, data });
        }
    }
    /**
     * Löscht einen Eintrag
     * @param key - Der Schlüssel des Eintrags
     * @returns true bei Erfolg, false wenn Schlüssel nicht existiert
     */
    delete(key) {
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
    filter(property, value) {
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
    find(property, value) {
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
    has(key) {
        return this.items.hasOwnProperty(key);
    }
    /**
     * Gibt alle Schlüssel zurück
     */
    keys() {
        return Object.keys(this.items);
    }
    /**
     * Gibt alle Werte zurück
     */
    values() {
        return Object.values(this.items);
    }
    /**
     * Gibt Schlüssel-Wert-Paare als Array zurück
     */
    entries() {
        return Object.entries(this.items);
    }
    /**
     * Gibt die Anzahl der Einträge zurück
     */
    count() {
        return Object.keys(this.items).length;
    }
    /**
     * Löscht alle Einträge
     */
    clear() {
        const count = this.count();
        this.items = {};
        this.fireEvent('onCleared', { count });
    }
    // ─────────────────────────────────────────────
    // Hilfsmethoden
    // ─────────────────────────────────────────────
    fireEvent(eventName, data) {
        const handler = this[eventName];
        if (handler && typeof handler === 'string') {
            // Event wird vom GameRuntime/TaskExecutor aufgelöst
            console.log(`[TKeyStore] Event ${eventName}:`, data);
        }
    }
    // ─────────────────────────────────────────────
    // Inspector Properties & Events
    // ─────────────────────────────────────────────
    getInspectorProperties() {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'keyProperty', label: 'Schlüssel-Property', type: 'string', group: 'KeyStore' }
        ];
    }
    getEvents() {
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
    toJSON() {
        return {
            ...super.toJSON(),
            keyProperty: this.keyProperty,
            items: this.items
        };
    }
}
