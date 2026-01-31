import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';

export interface TColumnDef {
    property: string;
    label: string;
    width?: string; // e.g. '100px' or '1fr'
    type?: 'text' | 'image' | 'button' | 'icon' | 'status';
}

/**
 * TTable - Eine generische Tabellen-Komponente.
 * Kann beliebige Daten (Arrays von Objekten) visualisieren.
 */
export class TTable extends TWindow {
    public className: string = 'TTable';
    public data: any[] = [];
    public columns: TColumnDef[] = [];
    public selectedIndex: number = -1;
    public rowHeight: number = 30;
    public showHeader: boolean = true;
    public onRowClick?: (row: any, index: number) => void;

    constructor(name: string, x: number, y: number, width: number = 8, height: number = 6) {
        super(name, x, y, width, height);
        this.style.backgroundColor = '#2c3e50';
        this.style.color = '#ecf0f1';
        this.style.borderColor = 'rgba(255,255,255,0.1)';
        this.style.borderWidth = 1;

        // Standard-Spalten (Beispiel)
        this.columns = [
            { property: 'name', label: 'Name', width: '1fr' },
            { property: 'type', label: 'Typ', width: '80px' }
        ];
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'rowHeight', label: 'Zeilenhöhe', type: 'number', group: 'Table' },
            { name: 'showHeader', label: 'Header anzeigen', type: 'boolean', group: 'Table' }
        ];
    }

    public toJSON(): any {
        return {
            ...super.toJSON(),
            data: this.data,
            columns: this.columns,
            selectedIndex: this.selectedIndex,
            rowHeight: this.rowHeight,
            showHeader: this.showHeader
        };
    }
}
