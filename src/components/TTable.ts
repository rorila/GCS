import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';

export interface TColumnDef {
    field: string;
    label: string;
    width?: string;
}

/**
 * TTable - Eine dynamische Tabellen-Komponente.
 * Visualisiert Arrays von Objekten (z.B. aus APIs oder Variablen).
 * Besitzt Auto-Column-Generierung als Fallback in Stage.ts.
 */
export class TTable extends TWindow {
    public className: string = 'TTable';
    public data: any[] = [];         // Daten-Basis (gebunden via RuntimeVariableManager)
    public columns: any = [];        // JSON-Konfiguration (TColumnDef[])
    public selectedIndex: number = -1;
    public rowHeight: number = 30;
    public showHeader: boolean = true;
    public striped: boolean = true;

    constructor(name: string = 'Table', x: number = 0, y: number = 0, width: number = 10, height: number = 8) {
        super(name, x, y, width, height);
        this.style.backgroundColor = '#ffffff';
        this.style.color = '#333333';
        this.style.borderColor = '#bdc3c7';
        this.style.borderWidth = 1;
        this.style.borderRadius = 4;
        this.style.fontSize = 14;
    }

    public getEvents(): string[] {
        return ['onSelect', 'onDoubleClick', ...super.getEvents()];
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'data', label: 'Daten-Basis (JSON)', type: 'json', group: 'Tabelle', hint: 'Wird oft zur Laufzeit überschrieben' },
            { name: 'columns', label: 'Spalten (JSON)', type: 'json', group: 'Tabelle', hint: '[{"field":"id", "label":"ID"}] - Leer lassen für Auto-Columns' },
            { name: 'rowHeight', label: 'Zeilenhöhe (px)', type: 'number', group: 'Tabelle' },
            { name: 'showHeader', label: 'Kopfzeile zeigen', type: 'boolean', group: 'Tabelle' },
            { name: 'striped', label: 'Zebra-Streifen', type: 'boolean', group: 'Tabelle' }
        ];
    }

    public toJSON(): any {
        return {
            ...super.toJSON(),
            data: this.data,
            columns: this.columns,
            selectedIndex: this.selectedIndex,
            rowHeight: this.rowHeight,
            showHeader: this.showHeader,
            striped: this.striped
        };
    }
}
