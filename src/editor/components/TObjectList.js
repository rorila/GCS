import { TWindow } from './TWindow';
export class TObjectList extends TWindow {
    constructor(name, x, y) {
        super(name, x, y, 4, 2);
        this.className = 'TObjectList';
        this.items = []; // List of object IDs or names
        this.searchValue = '';
        this.searchProperty = 'name';
        this.isVariable = true;
        this.style.backgroundColor = '#009688'; // Teal for Object Lists
        this.style.borderColor = '#00796b';
        this.style.borderWidth = 2;
    }
    getInspectorProperties() {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'searchValue', label: 'Suche (Wert)', type: 'string', group: 'List' },
            { name: 'searchProperty', label: 'Suche (Property)', type: 'string', group: 'List' }
        ];
    }
    toJSON() {
        return {
            ...super.toJSON(),
            items: this.items,
            searchValue: this.searchValue,
            searchProperty: this.searchProperty
        };
    }
}
