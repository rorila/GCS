import { TWindow } from './TWindow';
import { TPropertyDef } from './TComponent';
import { Logger } from '../utils/Logger';
import { fitImageBounds } from '../utils/ImageSplitterModel';
import { PropertyHelper } from '../runtime/PropertyHelper';

const logger = Logger.get('TPuzzleBoard', 'Runtime_Execution');

/**
 * TPuzzleBoard – Zielablage fuer Puzzleteile (Kleinkind-Modus).
 *
 * Zeigt das Zielbild transparent als Orientierungshilfe (Geisterbild).
 * Puzzleteile, die in der Naehe ihrer Zielzelle fallen gelassen werden,
 * rasten automatisch ein und werden arretiert (draggable=false).
 *
 * Typischer Flow:
 *   onDrop (dieses Board) → Task → call_method tryPlacePiece(${draggedObj})
 *
 * Events:
 *   onPiecePlaced – ein Teil wurde korrekt eingerastet (data: piece, placedCount)
 *   onComplete    – alle Zellen belegt (placedCount === columns * rows)
 */
export class TPuzzleBoard extends TWindow {
    public className = 'TPuzzleBoard';

    /** Zielbild (wird transparent als Orientierungshilfe dargestellt). */
    public imageSource = '';

    /** Spalten des Zielrasters. */
    public columns = 2;

    /** Zeilen des Zielrasters. */
    public rows = 2;

    /** Deckkraft des Geisterbilds (0 = unsichtbar, 1 = voll sichtbar). */
    public ghostOpacity = 0.3;

    /** Einrast-Genauigkeit in Grid-Zellen (Abstand Teilzentrum ↔ Zielzellen-Zentrum). */
    public snapRadius = 4;

    /** Anzahl korrekt eingerasteter Teile (Laufzeit-Status). */
    public placedCount = 0;

    /** Runtime-Callbacks, gesetzt via initRuntime(). */
    private _handleEvent?: (objectId: string, eventName: string, data?: unknown) => void;
    private _render?: () => void;
    /** Laufzeit-Kontext zum Aufloesen gebundener Properties (${Obj.prop}). */
    private _objects: any[] = [];
    private _contextVars: Record<string, any> = {};

    constructor(name: string, x: number, y: number, width = 19, height = 25) {
        super(name, x, y, width, height);
        this.droppable = true;
        this.style.backgroundColor = '#182235';
    }

    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...super.getInspectorProperties().filter(p => !['text', 'caption'].includes(p.name)),
            { name: 'imageSource', label: 'Zielbild', type: 'image_picker', group: 'BILD' },
            { name: 'columns', label: 'Spalten', type: 'number', min: 1, max: 6, step: 1, group: 'RASTER' },
            { name: 'rows', label: 'Zeilen', type: 'number', min: 1, max: 6, step: 1, group: 'RASTER' },
            { name: 'ghostOpacity', label: 'Bild-Transparenz', type: 'number', min: 0, max: 1, step: 0.05, group: 'VORSCHAU', hint: '0 = unsichtbar, 1 = voll sichtbar. Hilfestellung fuer die Kinder.' },
            { name: 'snapRadius', label: 'Einrast-Genauigkeit (Zellen)', type: 'number', min: 0.5, max: 12, step: 0.5, group: 'ABLEGEN', hint: 'Wie nahe ein Teil am Zentrum seiner Zielzelle losgelassen werden muss.' },
            { name: 'placedCount', label: 'Gelegte Teile', type: 'number', readonly: true, serializable: false, group: 'STATUS' },
        ];
    }

    public initRuntime(callbacks: { handleEvent?: (objectId: string, eventName: string, data?: unknown) => void; render?: () => void; objects?: any[]; contextVars?: Record<string, any> }): void {
        this._handleEvent = callbacks.handleEvent;
        this._render = callbacks.render;
        this._objects = callbacks.objects || [];
        this._contextVars = callbacks.contextVars || {};
    }

    public onRuntimeStop(): void {
        this.placedCount = 0;
        this._handleEvent = undefined;
        this._render = undefined;
        this._objects = [];
        this._contextVars = {};
    }

    /**
     * Liefert den numerischen Wert eines Properties. Ist das Property als
     * Ausdruck gebunden ("${Obj.prop}") und vom Reaktiv-System noch nicht
     * aufgeloest worden, wird er hier ueber den Laufzeit-Kontext ausgewertet.
     * @returns NaN wenn der Wert nicht aufloesbar ist.
     */
    private resolveNumber(raw: any): number {
        if (typeof raw === 'number') return raw;
        if (PropertyHelper.isBinding(raw)) {
            const resolved = PropertyHelper.resolveBinding(raw, this._contextVars || {}, this._objects || []);
            return Number(resolved);
        }
        return Number(raw);
    }

    /**
     * Versucht ein Puzzleteil einrasten zu lassen.
     * Die Zielzelle ergibt sich aus piece.imageIndex (bzw. matchValue "r{row}_c{col}").
     * Liegt das Teilzentrum innerhalb von snapRadius Zellen um das Zellzentrum,
     * wird das Teil exakt auf die Zelle gesetzt und arretiert.
     * @returns true wenn das Teil eingerastet wurde.
     */
    public tryPlacePiece(piece: any): boolean {
        if (!piece) return false;
        const index = this.resolvePieceIndex(piece);
        const cols = Math.max(1, Number(this.columns) || 1);
        const rows = Math.max(1, Number(this.rows) || 1);
        if (index == null || index < 0 || index >= cols * rows) {
            logger.warn(`tryPlacePiece: Teil "${piece.name || piece.id}" hat keinen gueltigen Zielindex (${piece.matchValue ?? piece.imageIndex}).`);
            return false;
        }

        const boardW = this.resolveNumber(this.width);
        const boardH = this.resolveNumber(this.height);
        const boardX = this.resolveNumber(this.x);
        const boardY = this.resolveNumber(this.y);
        if (!Number.isFinite(boardW) || !Number.isFinite(boardH) || boardW <= 0 || boardH <= 0) {
            logger.warn(`tryPlacePiece: Board-Geometrie nicht aufloesbar (width=${this.width}, height=${this.height}). Drop wird abgelehnt.`);
            return false;
        }

        const col = index % cols;
        const row = Math.floor(index / cols);
        const bounds = fitImageBounds(Number(piece.sourceWidth), Number(piece.sourceHeight), boardW, boardH);
        const cellW = bounds.width / cols;
        const cellH = bounds.height / rows;
        const targetX = (Number.isFinite(boardX) ? boardX : 0) + bounds.x + col * cellW;
        const targetY = (Number.isFinite(boardY) ? boardY : 0) + bounds.y + row * cellH;

        const dx = ((Number(piece.x) || 0) + (Number(piece.width) || 0) / 2) - (targetX + cellW / 2);
        const dy = ((Number(piece.y) || 0) + (Number(piece.height) || 0) / 2) - (targetY + cellH / 2);
        const radius = Math.max(0, Number(this.snapRadius) || 0);
        if (Math.hypot(dx, dy) > radius) return false;

        piece.x = targetX;
        piece.y = targetY;
        piece.width = cellW;
        piece.height = cellH;
        piece.draggable = false;
        this.placedCount++;
        this._render?.();
        this._handleEvent?.(this.id, 'onPiecePlaced', { piece: piece.name || piece.id, placedCount: this.placedCount });
        if (this.placedCount >= cols * rows) {
            this._handleEvent?.(this.id, 'onComplete', { placedCount: this.placedCount });
        }
        return true;
    }

    /** Setzt den Ablege-Zaehler zurueck (z. B. vor einem neuen Durchlauf). */
    public resetBoard(): void {
        this.placedCount = 0;
        this._render?.();
    }

    /** Ermittelt den Zielzellen-Index eines Puzzleteils (imageIndex oder matchValue "r{row}_c{col}"). */
    private resolvePieceIndex(piece: any): number | null {
        const direct = Number(piece.imageIndex);
        if (Number.isInteger(direct) && direct >= 0) return direct;
        const m = typeof piece.matchValue === 'string' ? piece.matchValue.match(/^r(\d+)_c(\d+)$/) : null;
        if (m) return Number(m[1]) * Math.max(1, Number(this.columns) || 1) + Number(m[2]);
        return null;
    }

    public getEvents(): string[] {
        return [...super.getEvents(), 'onPiecePlaced', 'onComplete'];
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TPuzzleBoard', (objData: any) => new TPuzzleBoard(objData.name, objData.x, objData.y, objData.width, objData.height));
