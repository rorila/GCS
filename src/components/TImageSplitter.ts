import { TWindow } from './TWindow';
import { TPropertyDef } from '../model/InspectorTypes';
import { ImagePiece, prepareImagePieces, fitImageBounds } from '../utils/ImageSplitterModel';
import { ComponentRegistry } from '../utils/ComponentRegistry';

export class TImageSplitter extends TWindow {
    public className = 'TImageSplitter';
    public imageSource = '';
    public rows = 2;
    public columns = 3;
    /** Aktiv: Ausschnitte werden auf das Seitenverhaeltnis des Splitters zugeschnitten (cover), damit Teile ihre Box komplett fuellen. */
    public coverToAspect = false;
    public showLines = true;
    public lineColor = '#ffffff';
    public previewGap = 0;
    public outputList = '';
    private _objects: any[] = [];
    private _render?: () => void;
    private _generation = 0;
    private _sourceWidth = 0;
    private _sourceHeight = 0;

    public get imageBounds() {
        return fitImageBounds(this.coverToAspect ? 0 : this._sourceWidth, this._sourceHeight, Number(this.width), Number(this.height));
    }

    public get fittedPieceWidth(): number { return this.imageBounds.width / Math.max(1, Number(this.columns) || 1); }
    public get fittedPieceHeight(): number { return this.imageBounds.height / Math.max(1, Number(this.rows) || 1); }

    constructor(name: string, x: number, y: number, width = 24, height = 16) {
        super(name, x, y, width, height);
        this.style.backgroundColor = '#182235';
    }

    public get pieceCount(): number { return this.rows * this.columns; }

    /** Stage-Breite eines Teils (Komponentenbreite / Spalten) — fuer Bindings wie ${Bildaufteiler.pieceWidth}. */
    public get pieceWidth(): number { return (Number(this.width) || 0) / Math.max(1, Number(this.columns) || 1); }

    /** Stage-Hoehe eines Teils (Komponentenhoehe / Zeilen) — fuer Bindings wie ${Bildaufteiler.pieceHeight}. */
    public get pieceHeight(): number { return (Number(this.height) || 0) / Math.max(1, Number(this.rows) || 1); }

    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...super.getInspectorProperties().filter(p => !['text', 'caption'].includes(p.name)),
            { name: 'imageSource', label: 'Bildquelle', type: 'image_picker', group: 'BILD' },
            { name: 'rows', label: 'Zeilen', type: 'number', min: 1, max: 32, step: 1, group: 'AUFTEILUNG' },
            { name: 'columns', label: 'Spalten', type: 'number', min: 1, max: 32, step: 1, group: 'AUFTEILUNG' },
            { name: 'pieceCount', label: 'Anzahl der Teile', type: 'number', readonly: true, serializable: false, group: 'AUFTEILUNG' },
            { name: 'coverToAspect', label: 'Auf Splitter-Seitenverhältnis zuschneiden', type: 'boolean', group: 'VORSCHAU', hint: 'Teile füllen ihre Boxen; Randbereiche des Bildes werden beschnitten.' },
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
        const aspect = this.coverToAspect && Number(this.height) ? Number(this.width) / Number(this.height) : undefined;
        const config = { id: this.id, imageSource: this.imageSource, rows: this.rows, columns: this.columns, targetAspect: aspect };
        const outputList = this.outputList;
        const pieces = await prepareImagePieces(config);
        if (generation !== this._generation || outputList !== this.outputList || config.imageSource !== this.imageSource || config.rows !== this.rows || config.columns !== this.columns) {
            throw new Error('Die Konfiguration wurde während der Erzeugung geändert. Bitte erneut erzeugen.');
        }
        this._sourceWidth = pieces[0].sourceWidth;
        this._sourceHeight = pieces[0].sourceHeight;
        target.recordKey = 'id';
        target.replaceRecords(pieces);
        this._render?.();
        return pieces;
    }
}

ComponentRegistry.register('TImageSplitter', (data: any) => new TImageSplitter(data.name, data.x, data.y, data.width, data.height));
