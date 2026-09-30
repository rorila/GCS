import { TTable } from './TTable';
import { TPropertyDef } from './TComponent';
import { ComponentRegistry } from '../utils/ComponentRegistry';

/**
 * TCardZone - Datengebundene Anzeige fuer eine Kartensammlung.
 *
 * Die Karten sind Datensaetze einer TObjectList. Die Zone filtert und sortiert
 * diese Datensaetze und rendert sie als klickbare Bildkarten. So bleibt der
 * Fachzustand deklarativ in den Records, ohne fuer jede Karte ein eigenes
 * visuelles Stage-Objekt verwalten zu muessen.
 */
export class TCardZone extends TTable {
    public className: string = 'TCardZone';

    /** Feld des Datensatzes, das den sichtbaren Kartenwert traegt. */
    public imageField: string = 'image';
    /** Feld des Datensatzes, das Front-/Rueckseite umschaltet. */
    public faceUpField: string = 'faceUp';
    /** Feld des Datensatzes, das die Karte hervorhebt. */
    public highlightField: string = '';
    /** Datensatzfeld fuer den Zonen-Filter. */
    public searchProperty: string = '';
    /** Erwarteter Wert des Zonen-Filters. */
    public searchValue: any = '';
    /** Datensatzfeld fuer die Sortierung. */
    public sortField: string = '';
    /** Rueckseitenbild, wenn faceUpField nicht gesetzt oder false ist. */
    public src: string = '';
    /** Kartenbreite in Grid-Cells. */
    public itemWidth: number = 3.1;
    /** Kartenhoehe in Grid-Cells. */
    public itemHeight: number = 4.5;
    /** Abstand zwischen Karten in Grid-Cells. */
    public gap: number = 0.4;
    /** Anordnung der Karten innerhalb der Zone. */
    public orientation: 'horizontal' | 'vertical' | 'stack' = 'horizontal';
    /** Farbe fuer ausgewaehlte oder markierte Karten. */
    public selectionColor: string = '#0ed7b5';

    private zoneRequestRender: (() => void) | undefined;
    private lastSourceRows: any[] | null = null;

    constructor(name: string = 'CardZone', x: number = 0, y: number = 0, width: number = 20, height: number = 7) {
        super(name, x, y, width, height);
        this.className = 'TCardZone';
        this.displayMode = 'cards';
        this.style.backgroundColor = 'transparent';
        this.style.borderColor = 'transparent';
        this.style.borderWidth = 0;
        this.cardConfig = {
            padding: 0,
            borderRadius: 8,
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            borderWidth: 0
        };
    }

    public initRuntime(callbacks: { objects: any[]; render?: () => void }): void {
        super.initRuntime(callbacks);
        this.zoneRequestRender = callbacks.render;
        this.lastSourceRows = null;
    }

    public onRuntimeStop(): void {
        super.onRuntimeStop();
        this.zoneRequestRender = undefined;
        this.lastSourceRows = null;
    }

    /**
     * Prueft nur die Quellzeilen. Die gefilterte Ansicht wird nicht als
     * Aenderung behandelt, damit sortierte Kopien keine Render-Schleife erzeugen.
     */
    public onRuntimeUpdate(): void {
        if (!this.dataSource) return;
        const sourceRows = super.getRows();
        if (this.lastSourceRows !== sourceRows) {
            this.lastSourceRows = sourceRows;
            this.zoneRequestRender?.();
        }
    }

    /** Liefert die fuer diese Zone gefilterten und sortierten Datensaetze. */
    public getRows(): any[] {
        let rows = super.getRows();
        if (this.searchProperty) {
            rows = rows.filter(row => this.matches(row?.[this.searchProperty], this.searchValue));
        }
        if (this.sortField) {
            rows = [...rows].sort((a, b) => this.compareValues(a?.[this.sortField], b?.[this.sortField]));
        }
        return rows;
    }

    public applyChange(propertyName: string, newValue: any, oldValue?: any): boolean {
        if (['searchProperty', 'searchValue', 'sortField'].includes(propertyName)) {
            this.selectedIndex = -1;
            this.selectedKey = '';
            this.selectedRecord = null;
        }
        return super.applyChange(propertyName, newValue, oldValue);
    }

    private matches(value: any, expected: any): boolean {
        if (expected === undefined || expected === null || expected === '') return true;
        if (value === expected) return true;
        return String(value) === String(expected);
    }

    private compareValues(a: any, b: any): number {
        const na = Number(a), nb = Number(b);
        if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
        return String(a ?? '').localeCompare(String(b ?? ''));
    }

    public getInspectorProperties(): TPropertyDef[] {
        const props = super.getInspectorProperties()
            .filter(p => !['columns', 'data', 'rowHeight', 'showHeader', 'striped', 'displayMode'].includes(p.name))
            .map(p => p.name === 'cardConfig'
                ? { ...p, label: 'Karten-Stil (JSON)', hint: 'Nur Darstellung; itemWidth, itemHeight und gap steuern die Grid-Größe.' }
                : p);
        return [
            ...props,
            { name: 'itemWidth', label: 'Kartenbreite (Cells)', type: 'number', min: 0.5, max: 20, step: 0.1, group: 'LAYOUT' },
            { name: 'itemHeight', label: 'Kartenhöhe (Cells)', type: 'number', min: 0.5, max: 20, step: 0.1, group: 'LAYOUT' },
            { name: 'gap', label: 'Abstand (Cells)', type: 'number', min: 0, max: 10, step: 0.1, group: 'LAYOUT' },
            { name: 'orientation', label: 'Ausrichtung', type: 'select', options: ['horizontal', 'vertical', 'stack'], group: 'LAYOUT' },
            { name: 'searchProperty', label: 'Filterfeld', type: 'string', group: 'DATEN', hint: 'Record-Feld, z. B. owner' },
            { name: 'searchValue', label: 'Filterwert', type: 'string', group: 'DATEN', hint: 'Nur Datensaetze mit diesem Wert anzeigen' },
            { name: 'sortField', label: 'Sortierfeld', type: 'string', group: 'DATEN', hint: 'z. B. handIndex oder pileIndex' },
            { name: 'imageField', label: 'Bildfeld', type: 'string', group: 'KARTEN', hint: 'Record-Feld mit dem Bildpfad' },
            { name: 'faceUpField', label: 'Aufgedeckt-Feld', type: 'string', group: 'KARTEN', hint: 'true = Bildfeld, false = Rückseite' },
            { name: 'src', label: 'Rückseite', type: 'string', group: 'KARTEN', hint: 'Bildpfad fuer verdeckte Karten' },
            { name: 'highlightField', label: 'Markierungsfeld', type: 'string', group: 'KARTEN', hint: 'Record-Feld fuer die Spielbar-Markierung' },
            { name: 'selectionColor', label: 'Auswahlfarbe', type: 'color', group: 'AUSWAHL' }
        ];
    }

    public toDTO(): any {
        return {
            ...super.toDTO(),
            orientation: this.orientation,
            itemWidth: this.itemWidth,
            itemHeight: this.itemHeight,
            gap: this.gap,
            searchProperty: this.searchProperty,
            searchValue: this.searchValue,
            sortField: this.sortField,
            imageField: this.imageField,
            faceUpField: this.faceUpField,
            src: this.src,
            highlightField: this.highlightField,
            selectionColor: this.selectionColor
        };
    }
}

ComponentRegistry.register('TCardZone', (objData: any) => new TCardZone(objData.name, objData.x, objData.y, objData.width, objData.height));
