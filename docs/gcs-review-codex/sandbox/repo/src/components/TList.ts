import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';

/**
 * TList - Eine datengetriebene Listen-Komponente.
 * Zeigt eine Liste von Elementen an und erlaubt Selektion.
 * Verwendet Grid-Zellen für die Dimensionierung.
 */
export class TList extends TWindow {
    public items: any[] = [];
    public displayField: string = ''; // Falls Objekte in der Liste sind
    public selectedIndex: number = -1;
    public itemHeight: number = 1.5; // In Grid-Zellen

    constructor(name: string = 'List', x: number = 0, y: number = 0) {
        // Standardgröße: 10x12 Zellen
        super(name, x, y, 10, 12);

        this.style.backgroundColor = '#ffffff';
        this.style.borderColor = '#bdc3c7';
        this.style.borderWidth = 1;
        this.style.borderRadius = 4;
        this.style.fontSize = 14;
    }

    public getEvents(): string[] {
        return ['onSelect', 'onDoubleClick', ...super.getEvents()];
    }

    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...super.getInspectorProperties(),
            { name: 'items', label: 'Items (JSON)', type: 'json', group: 'LISTE' },
            { name: 'displayField', label: 'Anzeige-Feld', type: 'string', group: 'LISTE', hint: 'Property-Name für Objekt-Anzeige' },
            { name: 'itemHeight', label: 'Zeilenhöhe (Cells)', type: 'number', group: 'LISTE', defaultValue: 1.5 },
            { name: 'selectedIndex', label: 'Gewählter Index', type: 'number', group: 'LISTE', readonly: true }
        ];
    }

    public toDTO(): any {
        return {
            ...super.toDTO(),
            items: this.items,
            displayField: this.displayField,
            selectedIndex: this.selectedIndex,
            itemHeight: this.itemHeight
        };
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TList', (objData: any) => new TList(objData.name, objData.x, objData.y));
