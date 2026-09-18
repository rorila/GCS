import { TWindow } from './TWindow';
import { TPropertyDef } from '../model/InspectorTypes';
import { ImagePiece, prepareImagePieces, fitImageBounds } from '../utils/ImageSplitterModel';
import { ComponentRegistry } from '../utils/ComponentRegistry';
import { PUZZLE_TAB_DEPTH } from '../utils/PuzzleShape';

export class TImageSplitter extends TWindow {
    public className = 'TImageSplitter';
    public imageSource = '';
    public rows = 2;
    public columns = 3;
    public pieceShape: 'rectangle' | 'puzzle' = 'rectangle';
    /** Zapfentiefe relativ zur Teilegroesse (nur bei pieceShape 'puzzle'). */
    public tabSize = PUZZLE_TAB_DEPTH;
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

    /** Effektive Zapfentiefe, auf den erlaubten Bereich geklemmt. */
    public get tabDepth(): number {
        return Math.min(0.4, Math.max(0.05, Number(this.tabSize) || PUZZLE_TAB_DEPTH));
    }

    /**
     * Ablage-Raster fuer gemischte Teile: Passt das komplette Raster inklusive
     * Zapfen-Ueberhang in die Splitter-Box ein. 'scale' < 1 bedeutet: Teile
     * werden verkleinert abgelegt und erst beim Aufnehmen auf Zielgroesse
     * gebracht (fittedPieceWidth/Height).
     */
    public get trayLayout() {
        const w = this.fittedPieceWidth, h = this.fittedPieceHeight;
        const cols = Math.max(1, Number(this.columns) || 1), rows = Math.max(1, Number(this.rows) || 1);
        const tab = this.pieceShape === 'puzzle' ? Math.min(w, h) * (this.tabDepth + 0.01) : 0;
        const gap = Math.min(w, h) * 0.08;
        const needW = cols * (w + 2 * tab) + (cols - 1) * gap;
        const needH = rows * (h + 2 * tab) + (rows - 1) * gap;
        const boxW = Number(this.width) || 0, boxH = Number(this.height) || 0;
        const scale = needW > 0 && needH > 0 ? Math.min(1, boxW / needW, boxH / needH) : 1;
        return {
            x: Math.max(0, (boxW - needW * scale) / 2) + tab * scale,
            y: Math.max(0, (boxH - needH * scale) / 2) + tab * scale,
            width: w * scale, height: h * scale,
            stepX: (w + 2 * tab + gap) * scale, stepY: (h + 2 * tab + gap) * scale,
            scale
        };
    }

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
            { name: 'rows', label: 'Zeilen', type: 'number', min: 1, max: 6, step: 1, group: 'AUFTEILUNG' },
            { name: 'columns', label: 'Spalten', type: 'number', min: 1, max: 6, step: 1, group: 'AUFTEILUNG' },
            { name: 'pieceShape', label: 'Teileform', type: 'select', options: ['rectangle', 'puzzle'], group: 'AUFTEILUNG', hint: 'rectangle = Rechtecke, puzzle = klassische Puzzleteile mit passenden Zapfen.' },
            { name: 'tabSize', label: 'Zapfengröße', type: 'number', min: 0.05, max: 0.4, step: 0.01, group: 'AUFTEILUNG', dependsOn: { property: 'pieceShape', value: 'puzzle' }, hint: 'Tiefe der Zapfen relativ zur Teilegröße (0,05–0,40).' },
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
        return ['rows', 'columns', 'pieceShape', 'tabSize'].includes(propertyName) || super.applyChange(propertyName, newValue, oldValue);
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
        const cover = this.coverToAspect;
        const aspect = cover && Number(this.height) ? Number(this.width) / Number(this.height) : undefined;
        const config = { id: this.id, imageSource: this.imageSource, rows: this.rows, columns: this.columns, targetAspect: aspect, pieceShape: this.pieceShape, tabSize: this.tabDepth };
        const outputList = this.outputList;
        const pieces = await prepareImagePieces(config);
        if (generation !== this._generation || outputList !== this.outputList || config.imageSource !== this.imageSource || config.rows !== this.rows || config.columns !== this.columns || config.pieceShape !== this.pieceShape || cover !== this.coverToAspect) {
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
