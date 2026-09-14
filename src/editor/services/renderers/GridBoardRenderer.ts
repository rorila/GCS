import { TGridBoard, GridShapePlacement } from '../../../components/TGridBoard';

/**
 * GridBoardRenderer - Canvas-Darstellung einer TGridBoard-Komponente.
 * Zeichnet Zellen ueber die Palette, optionale Gitterlinien, Overlay-Form,
 * Ghost-Umriss und einen zentrierten Hinweistext. Im Run-Modus werden
 * Klicks in Zellkoordinaten uebersetzt und als onCellClick gemeldet.
 */
export class GridBoardRenderer {

    public static renderGridBoard(
        el: HTMLElement,
        obj: TGridBoard,
        onEvent?: (id: string, event: string, data?: any) => void
    ): void {
        let canvas = el.querySelector('canvas.gridboard-canvas') as HTMLCanvasElement | null;
        if (!canvas) {
            el.innerHTML = '';
            canvas = document.createElement('canvas');
            canvas.className = 'gridboard-canvas';
            canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
            // 'relative' nur setzen, wenn el nicht bereits absolut positioniert ist —
            // sonst faellt das Element in den normalen Flow und wird unterhalb
            // vorheriger Flow-Elemente versetzt (Vorschau war deshalb unsichtbar).
            if (el.style.position !== 'absolute') el.style.position = 'relative';
            el.style.overflow = 'hidden';
            el.appendChild(canvas);
        }

        // Zell-Klicks (nur wenn das Event gebunden ist)
        if (onEvent && obj.events?.onCellClick && !(canvas as any).__cellClickBound) {
            (canvas as any).__cellClickBound = true;
            canvas.addEventListener('click', (e) => {
                const cell = this.cellAt(canvas!, obj, e);
                if (cell) obj.emitCellClick(cell.x, cell.y);
            });
        }

        const w = el.clientWidth, h = el.clientHeight;
        if (w < 4 || h < 4) return;

        const dpr = window.devicePixelRatio || 1;
        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = false;

        const cols = obj.cols || 10;
        const rows = obj.rows || 20;
        const cell = Math.min(w / cols, h / rows);
        const bw = cell * cols, bh = cell * rows;
        const bx = (w - bw) / 2, by = (h - bh) / 2;

        const palette: string[] = Array.isArray(obj.palette) ? obj.palette
            : (() => { try { return JSON.parse(obj.palette as any); } catch { return ['#101736']; } })();
        const emptyColor = obj.style?.backgroundColor || '#0b1020';
        // Hintergrund-Farbe des Inspectors faerbt die sichtbaren (leeren) Zellen;
        // palette[0] ist nur der Fallback, wenn keine Style-Farbe gesetzt ist.
        const cellBg = obj.style?.backgroundColor || palette[0] || '#101736';

        // Hintergrund
        ctx.fillStyle = emptyColor;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#060a18';
        ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);

        // Leere Zellen: Rasterbereich komplett mit cellBg fuellen. Die Zellen
        // duerfen NICHT einzeln mit 1px-Inset gezeichnet werden — die Spalten
        // wuerden als Gitter durchscheinen, das sich ueber gridLines nicht
        // ausschalten liesse.
        ctx.fillStyle = cellBg;
        ctx.fillRect(bx, by, bw, bh);

        // Gefuellte Zellen
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const v = obj.cells?.[y]?.[x] || 0;
                if (v && palette[v]) {
                    this.drawCell(ctx, bx + x * cell, by + y * cell, cell, palette[v]);
                }
            }
        }

        // Gitterlinien
        if (obj.gridLines !== false) {
            ctx.strokeStyle = obj.gridColor || 'rgba(255,255,255,0.05)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let x = 1; x < cols; x++) { ctx.moveTo(bx + x * cell, by); ctx.lineTo(bx + x * cell, by + bh); }
            for (let y = 1; y < rows; y++) { ctx.moveTo(bx, by + y * cell); ctx.lineTo(bx + bw, by + y * cell); }
            ctx.stroke();
        }

        // Ghost (Umriss) + Overlay (gefuellt)
        if (obj.ghost) this.drawPlacement(ctx, obj.ghost, bx, by, cell, palette, true);
        if (obj.overlay) this.drawPlacement(ctx, obj.overlay, bx, by, cell, palette, false);

        // Rahmen (Breite aus dem Inspector; 0 = kein Rahmen)
        const borderW = obj.style?.borderWidth !== undefined ? Number(obj.style.borderWidth) : 2;
        if (borderW > 0) {
            ctx.strokeStyle = obj.style?.borderColor || '#1f2a4a';
            ctx.lineWidth = borderW;
            ctx.strokeRect(bx - 2, by - 2, bw + 4, bh + 4);
        }

        // Hinweistext
        if (obj.overlayText) {
            ctx.fillStyle = 'rgba(4,8,20,0.7)';
            ctx.fillRect(bx, by, bw, bh);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#e2e8f0';
            ctx.font = `bold ${Math.max(12, cell * 0.9)}px sans-serif`;
            const lines = String(obj.overlayText).split('\n');
            const lh = cell * 1.4;
            lines.forEach((line, i) => {
                ctx.fillText(line, bx + bw / 2, by + bh / 2 + (i - (lines.length - 1) / 2) * lh);
            });
        }
    }

    private static cellAt(canvas: HTMLCanvasElement, obj: TGridBoard, e: MouseEvent): { x: number; y: number } | null {
        const rect = canvas.getBoundingClientRect();
        const w = rect.width, h = rect.height;
        const cols = obj.cols || 10, rows = obj.rows || 20;
        const cell = Math.min(w / cols, h / rows);
        const bx = (w - cell * cols) / 2, by = (h - cell * rows) / 2;
        const cx = Math.floor((e.clientX - rect.left - bx) / cell);
        const cy = Math.floor((e.clientY - rect.top - by) / cell);
        if (cx < 0 || cx >= cols || cy < 0 || cy >= rows) return null;
        return { x: cx, y: cy };
    }

    private static drawPlacement(ctx: CanvasRenderingContext2D, p: GridShapePlacement, bx: number, by: number, cell: number, palette: string[], ghost: boolean): void {
        const color = palette[p.v] || '#94a3b8';
        for (let y = 0; y < p.matrix.length; y++) {
            for (let x = 0; x < p.matrix[y].length; x++) {
                if (!p.matrix[y][x]) continue;
                const dy = p.y + y;
                if (dy < 0) continue;
                const cx = bx + (p.x + x) * cell, cy = by + dy * cell;
                if (ghost) {
                    ctx.strokeStyle = color + '99';
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(cx + 1.5, cy + 1.5, cell - 3, cell - 3);
                } else {
                    this.drawCell(ctx, cx, cy, cell, color);
                }
            }
        }
    }

    private static drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
        ctx.fillStyle = color;
        ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.fillRect(x + 1, y + 1, s - 2, Math.max(1, s * 0.14));
        ctx.fillRect(x + 1, y + 1, Math.max(1, s * 0.14), s - 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x + 1, y + s - 1 - Math.max(1, s * 0.14), s - 2, Math.max(1, s * 0.14));
        ctx.fillRect(x + s - 1 - Math.max(1, s * 0.14), y + 1, Math.max(1, s * 0.14), s - 2);
    }
}
