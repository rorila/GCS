import { TTable } from './TTable';
import { TPropertyDef } from './TComponent';

export class TObjectList extends TTable {
    public className: string = 'TObjectList';
    public items: string[] = []; // List of object IDs or names
    public searchValue: string = '';
    public searchProperty: string = 'name';

    constructor(name: string, x: number, y: number) {
        super(name, x, y, 8, 4); // Größerer Default
        this.isVariable = true;
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
            { name: 'searchValue', label: 'Suche (Wert)', type: 'string', group: 'List' },
            { name: 'searchProperty', label: 'Suche (Property)', type: 'string', group: 'List' }
        ];
    }

    public toDTO(): any {
        return {
            ...super.toDTO(),
            items: this.items,
            searchValue: this.searchValue,
            searchProperty: this.searchProperty
        };
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TObjectList', (objData: any) => new TObjectList(objData.name, objData.x, objData.y));
