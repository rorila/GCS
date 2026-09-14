import { TTable } from './TTable';
import { TPropertyDef, IRuntimeComponent } from './TComponent';

export type TRecordFieldType = 'boolean' | 'number' | 'string';

export interface TRecordField {
    name: string;
    type: TRecordFieldType;
    defaultValue: any;
}

export class TObjectList extends TTable implements IRuntimeComponent {
    public className: string = 'TObjectList';
    public items: string[] = []; // List of object IDs or names
    public searchValue: string = '';
    public searchProperty: string = 'name';

    /** Schema der Zusatzfelder. Gilt list-weit fuer jede Zeile. */
    public fields: TRecordField[] = [];

    /** Werte pro Objekt: recordData[objectId][fieldName] */
    public recordData: Record<string, Record<string, any>> = {};

    /** Runtime-Only: Referenz auf alle Objekte, fuer rebuildData nach record_*-Aktionen */
    public _runtimeObjects: any[] = [];

    /** Runtime-Kompatibilität: list_*-Aktionen sprechen das Array über .value an */
    get value(): any { return this.items; }
    set value(v: any) { this.items = Array.isArray(v) ? v : []; }

    constructor(name: string, x: number, y: number) {
        super(name, x, y, 8, 4); // Größerer Default
        this.isVariable = true;
        this.isHiddenInRun = true; // Wie alle Variablen-Komponenten: nur im Edit-Mode sichtbar
        this.style.backgroundColor = '#009688';
        this.style.borderColor = '#00796b';
        this.style.borderWidth = 2;
        this.rowHeight = 28;

        // Default Spalten für Manager-Listen
        this.columns = [
            { property: 'name', label: 'Name', width: '1fr' },
            { property: 'uiScope', label: 'Scope', width: '60px' },
            { property: 'usageCount', label: 'Links', width: '50px' }
        ];
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'fields', label: 'Record-Felder (Schema)', type: 'record_schema', group: 'RECORDS', hint: 'Gilt fuer alle Zeilen der Liste' },
            { name: 'items', label: 'Enthaltene Objekte', type: 'object_list', group: 'List' },
            { name: 'searchValue', label: 'Suche (Wert)', type: 'string', group: 'List' },
            { name: 'searchProperty', label: 'Suche (Property)', type: 'string', group: 'List' }
        ];
    }

    public toDTO(): any {
        return {
            ...super.toDTO(),
            items: this.items,
            searchValue: this.searchValue,
            searchProperty: this.searchProperty,
            fields: this.fields,
            recordData: this.recordData
        };
    }

    // --- Record-Verwaltung ---

    /** Konvertiert einen Rohwert in den deklarierten Feldtyp. */
    public static coerce(value: any, type: TRecordFieldType): any {
        if (type === 'boolean') {
            if (typeof value === 'boolean') return value;
            if (typeof value === 'number') return value !== 0;
            return String(value).trim().toLowerCase() === 'true';
        }
        if (type === 'number') {
            const n = Number(value);
            return isNaN(n) ? 0 : n;
        }
        return value === undefined || value === null ? '' : String(value);
    }

    /** Legt fehlende Feldwerte mit Default an und entfernt Eintraege ohne Objekt. */
    public ensureDefaults(): void {
        if (!this.recordData || typeof this.recordData !== 'object') this.recordData = {};
        if (!Array.isArray(this.fields)) this.fields = [];

        for (const id of this.items) {
            if (!this.recordData[id]) this.recordData[id] = {};
            for (const f of this.fields) {
                if (this.recordData[id][f.name] === undefined) {
                    this.recordData[id][f.name] = TObjectList.coerce(f.defaultValue, f.type);
                }
            }
        }

        for (const id of Object.keys(this.recordData)) {
            if (!this.items.includes(id)) delete this.recordData[id];
        }
    }

    public getRecordValue(objectId: string, field: string): any {
        return this.recordData?.[objectId]?.[field];
    }

    /** Setzt einen Feldwert. Gibt false zurueck, wenn das Objekt nicht in der Liste ist. */
    public setRecordValue(objectId: string, field: string, value: any): boolean {
        if (!this.items.includes(objectId)) return false;
        if (!this.recordData[objectId]) this.recordData[objectId] = {};
        const def = this.fields.find(f => f.name === field);
        this.recordData[objectId][field] = def ? TObjectList.coerce(value, def.type) : value;
        return true;
    }

    /** Setzt ein Feld in allen Zeilen auf den Default (oder einen expliziten Wert). */
    public resetField(field: string, value?: any): number {
        const def = this.fields.find(f => f.name === field);
        const raw = value !== undefined ? value : def?.defaultValue;
        let count = 0;
        for (const id of this.items) {
            if (!this.recordData[id]) this.recordData[id] = {};
            this.recordData[id][field] = def ? TObjectList.coerce(raw, def.type) : raw;
            count++;
        }
        return count;
    }

    /** Baut data + columns aus items/fields/recordData, damit der TableRenderer sie zeigt. */
    public rebuildData(allObjects: any[] = []): void {
        this.ensureDefaults();

        this.columns = [
            { field: 'index', label: '#', width: '40px' },
            { field: 'name', label: 'Name', width: '1fr' },
            ...this.fields.map(f => ({ field: f.name, label: f.name, width: '80px' }))
        ];

        this.data = this.items.map((id, index) => {
            const o = allObjects.find((oo: any) => oo.id === id || oo.name === id);
            return {
                index,
                objectId: id,
                name: o?.name ?? id,
                ...(this.recordData[id] || {})
            };
        });
    }

    // --- IRuntimeComponent ---

    public initRuntime(callbacks: { objects: any[] } & Record<string, any>): void {
        this._runtimeObjects = callbacks.objects || [];
        this.rebuildData(this._runtimeObjects);
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TObjectList', (objData: any) => new TObjectList(objData.name, objData.x, objData.y));
