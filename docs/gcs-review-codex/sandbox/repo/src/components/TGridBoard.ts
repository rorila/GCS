import { TWindow } from './TWindow';
import { TPropertyDef, IRuntimeComponent } from './TComponent';
import { Logger } from '../utils/Logger';

/**
 * TGridBoard - Generisches Raster-Anzeige- und Datenelement.
 *
 * Speichert eine Zellen-Matrix (cells[y][x] = Paletten-Index, 0 = leer)
 * und stellt generische Raster-Operationen fuer Flow-Tasks bereit:
 * Zellen setzen/lesen, Formen platzieren, volle Reihen finden/entfernen,
 * Overlay- und Ghost-Darstellung sowie Klick-Events mit Zellkoordinaten.
 *
 * Gedacht als universeller Baustein fuer Raster-Spiele (Tetris, Snake,
 * Puzzle, Minesweeper, Breakout-Levels ...). Rendering erfolgt durch
 * GridBoardRenderer (Canvas) im StageObjectRenderer.
 */

export interface GridShapePlacement { matrix: number[][]; x: number; y: number; v: number; }

export class TGridBoard extends TWindow implements IRuntimeComponent {
    private static logger = Logger.get('TGridBoard', 'Runtime');

    // ─── Konfiguration (Inspector) ───
    public cols: number = 10;
    public rows: number = 20;
    /** Paletten-Farben als Array; Index 0 = leere Zelle (wird als Hintergrund gezeichnet). */
    public palette: string[] = ['#101736'];
    /** Zellen-Matrix: cells[y][x] = Paletten-Index (0 = leer). */
    public cells: number[][] = [];
    public gridLines: boolean = true;
    /** Farbe der Gitterlinien (nur sichtbar wenn gridLines aktiv). */
    public gridColor: string = 'rgba(255,255,255,0.05)';
    /** Zentrierter Hinweistext ueber dem Board ('' = aus). */
    public overlayText: string = '';

    // ─── Laufzeit-Overlays (nicht serialisiert) ───
    public overlay: GridShapePlacement | null = null;
    public ghost: GridShapePlacement | null = null;

    // ─── Internals ───
    private requestRender: (() => void) | undefined;
    private eventCallback: ((id: string, ev: string, data?: any) => void) | undefined;

    constructor(name: string = 'GridBoard', x: number = 0, y: number = 0, width: number = 12, height: number = 22) {
        super(name, x, y, width, height);
        this.className = 'TGridBoard';
        this.style.backgroundColor = '#0b1020';
        this.style.borderColor = '#1f2a4a';
        this.style.borderWidth = 2;
        this.style.borderRadius = 6;
        this.ensureCells();
    }

    // ═══════════════════ Laufzeit-Lebenszyklus ═══════════════════

    public initRuntime(callbacks: { render?: () => void; handleEvent?: (id: string, ev: string, data?: any) => void }): void {
        this.requestRender = callbacks.render;
        this.eventCallback = callbacks.handleEvent;
        this.ensureCells();
    }

    public onRuntimeStop(): void {
        this.overlay = null;
        this.ghost = null;
    }

    // ═══════════════════ Zell-Operationen (call_method) ═══════════════════

    private ensureCells(): void {
        if (typeof this.cells === 'string') {
            try { this.cells = JSON.parse(this.cells); } catch { this.cells = []; }
        }
        if (typeof this.palette === 'string') {
            try { this.palette = JSON.parse(this.palette); } catch { /* bleibt String */ }
        }
        if (!Array.isArray(this.cells) || this.cells.length !== this.rows ||
            this.cells.some(r => !Array.isArray(r) || r.length !== this.cols)) {
            this.cells = Array.from({ length: this.rows }, () => new Array(this.cols).fill(0));
        }
    }

    private toMatrix(v: any): number[][] | null {
        if (Array.isArray(v)) return v as number[][];
        if (typeof v === 'string' && v.trim()) {
            try { const p = JSON.parse(v); return Array.isArray(p) ? p : null; }
            catch { TGridBoard.logger.warn(`Ungültige Matrix: ${v.slice(0, 60)}`); return null; }
        }
        return null;
    }

    private toIndexList(v: any): number[] {
        const m = this.toMatrix(v);
        return Array.isArray(m) ? m.map(n => Number(n)).filter(n => Number.isFinite(n)) : [];
    }

    public setCell(x: any, y: any, v: any): void {
        const xi = Number(x), yi = Number(y);
        if (xi < 0 || xi >= this.cols || yi < 0 || yi >= this.rows) return;
        this.cells[yi][xi] = Number(v) || 0;
        this.changed();
    }

    public getCell(x: any, y: any): number {
        const xi = Number(x), yi = Number(y);
        if (xi < 0 || xi >= this.cols || yi < 0 || yi >= this.rows) return -1;
        return this.cells[yi][xi];
    }

    public fillAll(v: any): void {
        const n = Number(v) || 0;
        for (const row of this.cells) row.fill(n);
        this.changed();
    }

    public clearBoard(): void { this.fillAll(0); }

    public countFilled(): number {
        let n = 0;
        for (const row of this.cells) for (const c of row) if (c) n++;
        return n;
    }

    // ═══════════════════ Form-Operationen ═══════════════════

    /** Prueft, ob eine Matrix an Position (x,y) passt. Zellen oberhalb des Boards (y<0) sind erlaubt. */
    public canPlaceShape(shape: any, x: any, y: any): boolean {
        const m = this.toMatrix(shape);
        if (!m) return false;
        const px = Number(x), py = Number(y);
        for (let sy = 0; sy < m.length; sy++) {
            for (let sx = 0; sx < m[sy].length; sx++) {
                if (!m[sy][sx]) continue;
                const bx = px + sx, by = py + sy;
                if (bx < 0 || bx >= this.cols || by >= this.rows) return false;
                if (by >= 0 && this.cells[by][bx]) return false;
            }
        }
        return true;
    }

    /** Schreibt eine Matrix in das Board; alle gesetzten Form-Zellen erhalten Wert v. */
    public placeShape(shape: any, x: any, y: any, v: any): void {
        const m = this.toMatrix(shape);
        if (!m) return;
        const px = Number(x), py = Number(y), val = Number(v) || 1;
        for (let sy = 0; sy < m.length; sy++) {
            for (let sx = 0; sx < m[sy].length; sx++) {
                if (!m[sy][sx]) continue;
                const bx = px + sx, by = py + sy;
                if (bx >= 0 && bx < this.cols && by >= 0 && by < this.rows) this.cells[by][bx] = val;
            }
        }
        this.changed();
    }

    /** Entfernt eine Matrix wieder aus dem Board (setzt ihre Zellen auf 0). */
    public removeShape(shape: any, x: any, y: any): void {
        const m = this.toMatrix(shape);
        if (!m) return;
        const px = Number(x), py = Number(y);
        for (let sy = 0; sy < m.length; sy++) {
            for (let sx = 0; sx < m[sy].length; sx++) {
                if (!m[sy][sx]) continue;
                const bx = px + sx, by = py + sy;
                if (bx >= 0 && bx < this.cols && by >= 0 && by < this.rows) this.cells[by][bx] = 0;
            }
        }
        this.changed();
    }

    // ═══════════════════ Reihen-Operationen ═══════════════════

    /** Liefert die Indizes aller vollstaendig gefuellten Reihen. */
    public findFullRows(): number[] {
        const full: number[] = [];
        for (let y = 0; y < this.rows; y++) {
            if (this.cells[y].every(c => c !== 0)) full.push(y);
        }
        return full;
    }

    /** Entfernt die angegebenen Reihen und schiebt leere Reihen oben nach. */
    public removeRows(indices: any): number {
        const list = this.toIndexList(indices).sort((a, b) => a - b);
        for (const y of list) {
            if (y >= 0 && y < this.rows) {
                this.cells.splice(y, 1);
                this.cells.unshift(new Array(this.cols).fill(0));
            }
        }
        if (list.length) this.changed();
        return list.length;
    }

    /** Entfernt alle vollen Reihen; liefert deren Anzahl. */
    public clearFullRows(): number {
        return this.removeRows(this.findFullRows());
    }

    // ═══════════════════ Overlays & Text ═══════════════════

    /** Legt eine bewegliche Form als Overlay ueber das Board (z.B. aktiver Stein). */
    public setOverlay(shape: any, x: any, y: any, v: any): void {
        const m = this.toMatrix(shape);
        this.overlay = m ? { matrix: m, x: Number(x), y: Number(y), v: Number(v) || 1 } : null;
        this.refresh();
    }

    public clearOverlay(): void { this.overlay = null; this.refresh(); }

    /** Wie setOverlay, wird aber als Umriss (Landeposition) gezeichnet. */
    public setGhost(shape: any, x: any, y: any, v: any): void {
        const m = this.toMatrix(shape);
        this.ghost = m ? { matrix: m, x: Number(x), y: Number(y), v: Number(v) || 1 } : null;
        this.refresh();
    }

    public clearGhost(): void { this.ghost = null; this.refresh(); }

    public setOverlayText(text: any): void { this.overlayText = String(text ?? ''); this.refresh(); }

    // ═══════════════════ Events & Rendering-Anbindung ═══════════════════

    /** Wird vom GridBoardRenderer bei Klick auf eine Zelle aufgerufen. */
    public emitCellClick(x: number, y: number): void {
        this.emitEvent('onCellClick', { x, y, value: this.getCell(x, y) });
    }

    private changed(): void {
        this.emitEvent('onChanged', { filled: this.countFilled() });
        this.refresh();
    }

    private emitEvent(event: string, data: any): void {
        if (this.eventCallback) {
            this.eventCallback(this.id, event, data);
        } else if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('GameRuntime_Event', {
                detail: { id: this.id, event, data }
            }));
        }
    }

    private refresh(): void { this.requestRender?.(); }

    public getEvents(): string[] {
        return ['onCellClick', 'onChanged', ...super.getEvents()];
    }

    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...super.getInspectorProperties(),
            { name: 'cols', label: 'Spalten', type: 'number', group: 'RASTER', min: 1, max: 64, defaultValue: 10 },
            { name: 'rows', label: 'Zeilen', type: 'number', group: 'RASTER', min: 1, max: 64, defaultValue: 20 },
            { name: 'palette', label: 'Palette (JSON-Array)', type: 'json', group: 'RASTER', hint: 'Index 0 = leere Zelle, danach Farben pro Wert' },
            { name: 'cells', label: 'Zellen (JSON-Matrix)', type: 'json', group: 'RASTER', hint: 'Optional: vorbelegtes Raster, z.B. fuer Level-Layouts' },
            { name: 'gridLines', label: 'Gitterlinien zeigen', type: 'boolean', group: 'RASTER' },
            { name: 'gridColor', label: 'Gitterfarbe', type: 'color', group: 'RASTER', defaultValue: 'rgba(255,255,255,0.05)' },
            { name: 'overlayText', label: 'Hinweistext', type: 'string', group: 'RASTER' },
        ];
    }

    public toDTO(): any {
        return {
            ...super.toDTO(),
            cols: this.cols,
            rows: this.rows,
            palette: this.palette,
            cells: this.cells,
            gridLines: this.gridLines,
            overlayText: this.overlayText,
        };
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TGridBoard', (objData: any) => new TGridBoard(objData.name, objData.x, objData.y, objData.width, objData.height));
