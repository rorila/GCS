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
    public dataSource: string = '';
    public keyField: string = 'id';
    public selectedKey: any = '';
    public selectedRecord: any = null;
    private tableObjects: any[] = [];
    private requestRender: (() => void) | undefined;
    private lastRows: any[] | null = null;
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

    public initRuntime(callbacks: {objects: any[]; render?: () => void}): void { this.tableObjects = callbacks.objects || []; this.requestRender = callbacks.render; this.lastRows = null; }

    public onRuntimeUpdate(): void {
        if (!this.dataSource) return;
        const rows = this.getRows();
        if (this.data !== rows) { this.data = rows; this.requestRender?.(); }
    }

    public onRuntimeStop(): void { this.tableObjects = []; this.requestRender = undefined; this.lastRows = null; }

    public setDataContext(objects: any[]): void { this.tableObjects = objects; }

    public getRows(): any[] {
        const source = this.dataSource ? this.tableObjects.find(o => o !== this && (o.id === this.dataSource || o.name === this.dataSource) && o.className === 'TObjectList') : null;
        const rows = this.dataSource ? (source?.data || []) : this.data;
        const result = Array.isArray(rows) ? rows : [];
        if (this.lastRows !== result) { this.selectedIndex = -1; this.selectedKey = ''; this.selectedRecord = null; this.lastRows = result; }
        return result;
    }

    public selectRow(index: number): void {
        const rows = this.getRows();
        this.selectedIndex = index >= 0 && index < rows.length ? index : -1;
        this.selectedRecord = rows[this.selectedIndex] || null;
        this.selectedKey = this.selectedRecord?.[this.keyField] ?? '';
    }

    public getEvents(): string[] {
        return ['onSelect', 'onRowClick', 'onSelectionChanged', 'onDoubleClick', ...super.getEvents()];
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties();
        return [
            ...props,
            { name: 'dataSource', label: 'Objektliste (Datenquelle)', type: 'select', source: 'object_lists', placeholder: '--- Keine Objektliste ---', group: 'Tabelle', hint: 'TObjectList auswählen; leer verwendet die eigene Daten-Basis.' },
            { name: 'keyField', label: 'Schlüsselfeld', type: 'string', group: 'Tabelle' },
            { name: 'selectedKey', label: 'Ausgewählter Schlüssel', type: 'string', group: 'Auswahl', readonly: true },
            { name: 'selectedRecord', label: 'Ausgewählter Datensatz', type: 'json', group: 'Auswahl', readonly: true },
            { name: 'data', label: 'Daten-Basis (JSON)', type: 'json', group: 'Tabelle', hint: 'Wird oft zur Laufzeit überschrieben' },
            { name: 'columns', label: 'Spalten (JSON)', type: 'json', group: 'Tabelle', hint: '[{"field":"id", "label":"ID"}] - Leer lassen für Auto-Columns' },
            { name: 'displayMode', label: 'Anzeige-Modus', type: 'select', options: ['table', 'cards'], group: 'Tabelle' },
            { name: 'cardConfig', label: 'Karten-Design (JSON)', type: 'json', group: 'Tabelle', hint: 'Nur im Modus "cards" relevant' },
            { name: 'rowHeight', label: 'Zeilenhöhe (px)', type: 'number', group: 'Tabelle' },
            { name: 'showHeader', label: 'Kopfzeile zeigen', type: 'boolean', group: 'Tabelle' },
            { name: 'striped', label: 'Zebra-Streifen', type: 'boolean', group: 'Tabelle' }
        ];
    }

    public toDTO(): any {
        return {
            ...super.toDTO(),
            dataSource: this.dataSource, keyField: this.keyField,
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
