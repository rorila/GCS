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
    public displayMode: 'table' | 'cards' = 'table';
    public cardConfig: any = {
        width: 250,
        height: 100,
        gap: 10,
        padding: 10,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1
    };

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
            { name: 'displayMode', label: 'Anzeige-Modus', type: 'select', options: ['table', 'cards'], group: 'Tabelle' },
            { name: 'cardConfig', label: 'Karten-Design (JSON)', type: 'json', group: 'Tabelle', hint: 'Nur im Modus "cards" relevant' },
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
            striped: this.striped,
            displayMode: this.displayMode,
            cardConfig: this.cardConfig
        };
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TTable', (objData: any) => new TTable(objData.name, objData.x, objData.y, objData.width, objData.height));
