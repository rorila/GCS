import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';

export class TObjectList extends TWindow {
    public className: string = 'TObjectList';
    public items: string[] = []; // List of object IDs or names
    public searchValue: string = '';
    public searchProperty: string = 'name';

    constructor(name: string, x: number, y: number) {
        super(name, x, y, 4, 2);
        this.isVariable = true;
        this.style.backgroundColor = '#009688'; // Teal for Object Lists
        this.style.borderColor = '#00796b';
        this.style.borderWidth = 2;
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'searchValue', label: 'Suche (Wert)', type: 'string', group: 'List' },
            { name: 'searchProperty', label: 'Suche (Property)', type: 'string', group: 'List' }
        ];
    }

    public toJSON(): any {
        return {
            ...super.toJSON(),
            items: this.items,
            searchValue: this.searchValue,
            searchProperty: this.searchProperty
        };
    }
}
