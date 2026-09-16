import { TWindow } from './TWindow';
import { TPropertyDef } from '../model/InspectorTypes';
import { ImagePiece, prepareImagePieces } from '../utils/ImageSplitterModel';
import { ComponentRegistry } from '../utils/ComponentRegistry';

export class TImageSplitter extends TWindow {
    public className = 'TImageSplitter';
    public imageSource = '';
    public rows = 2;
    public columns = 3;
    public showLines = true;
    public lineColor = '#ffffff';
    public previewGap = 0;
    public outputList = '';
    private _objects: any[] = [];
    private _render?: () => void;
    private _generation = 0;

    constructor(name: string, x: number, y: number, width = 24, height = 16) {
        super(name, x, y, width, height);
        this.style.backgroundColor = '#182235';
    }

    public get pieceCount(): number { return this.rows * this.columns; }

    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...super.getInspectorProperties().filter(p => !['text', 'caption'].includes(p.name)),
            { name: 'imageSource', label: 'Bildquelle', type: 'image_picker', group: 'BILD' },
            { name: 'rows', label: 'Zeilen', type: 'number', min: 1, max: 32, step: 1, group: 'AUFTEILUNG' },
            { name: 'columns', label: 'Spalten', type: 'number', min: 1, max: 32, step: 1, group: 'AUFTEILUNG' },
            { name: 'pieceCount', label: 'Anzahl der Teile', type: 'number', readonly: true, serializable: false, group: 'AUFTEILUNG' },
            { name: 'showLines', label: 'Trennlinien anzeigen', type: 'boolean', group: 'VORSCHAU' },
            { name: 'lineColor', label: 'Linienfarbe', type: 'color', group: 'VORSCHAU' },
            { name: 'previewGap', label: 'Vorschau-Abstand', type: 'number', min: 0, max: 100, step: 1, group: 'VORSCHAU', hint: 'Abstand in Bildpixeln vor der Skalierung; verändert nur die Vorschau.' },
            { name: 'outputList', label: 'Ausgabeliste', type: 'select', source: 'object_lists', group: 'AUSGABE', placeholder: 'TObjectList auswählen' },
            { name: 'generatePieces', label: 'Teile erzeugen', type: 'button', action: 'generateImageSplitterPieces', serializable: false, group: 'AUSGABE', hint: 'Schreibt Bildquelle und Ausschnitte als Datensätze in die gewählte TObjectList.' }
        ];
    }

    public applyChange(propertyName: string, newValue: any, oldValue?: any): boolean {
        return ['rows', 'columns'].includes(propertyName) || super.applyChange(propertyName, newValue, oldValue);
    }

    public initRuntime(callbacks: { objects: any[]; render?: () => void }): void {
        this._objects = callbacks.objects;
        this._render = callbacks.render;
    }

    public onRuntimeStop(): void { this._generation++; }

    public async generatePieces(): Promise<ImagePiece[]> {
        const target = this._objects.find(o => o.className === 'TObjectList' && (o.id === this.outputList || o.name === this.outputList));
        if (!target || typeof target.replaceRecords !== 'function') throw new Error('Bitte eine gültige TObjectList als Ausgabeliste auswählen.');
        const generation = ++this._generation;
        const config = { id: this.id, imageSource: this.imageSource, rows: this.rows, columns: this.columns };
        const outputList = this.outputList;
        const pieces = await prepareImagePieces(config);
        if (generation !== this._generation || outputList !== this.outputList || config.imageSource !== this.imageSource || config.rows !== this.rows || config.columns !== this.columns) {
            throw new Error('Die Konfiguration wurde während der Erzeugung geändert. Bitte erneut erzeugen.');
        }
        target.recordKey = 'id';
        target.replaceRecords(pieces);
        this._render?.();
        return pieces;
    }
}

ComponentRegistry.register('TImageSplitter', (data: any) => new TImageSplitter(data.name, data.x, data.y, data.width, data.height));
