import { TETRIS_COLORS } from '../../../components/TTetris';

const PIECE_ORDER = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
const PIECE_COLORS = PIECE_ORDER.map(t => TETRIS_COLORS[t as keyof typeof TETRIS_COLORS]);

/**
 * TetrisRenderer - Canvas-Darstellung einer TTetris-Komponente.
 * Zeichnet Spielfeld, Ghost-Piece, aktives Teil und eine Seitenleiste
 * mit Vorschau, Punkten, Reihen und Level. Overlay für ready/paused/gameover.
 */
export class TetrisRenderer {

    public static renderTetris(el: HTMLElement, obj: any): void {
        let canvas = el.querySelector('canvas.tetris-canvas') as HTMLCanvasElement | null;
        if (!canvas) {
            el.innerHTML = '';
            canvas = document.createElement('canvas');
            canvas.className = 'tetris-canvas';
            canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
            if (el.style.position !== 'absolute') el.style.position = 'relative';
            el.style.overflow = 'hidden';
            el.appendChild(canvas);
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

        // Layout: Spielfeld links (Seitenverhältnis cols:rows), Sidebar rechts
        const cell = Math.min(h / rows, (w * 0.68) / cols);
        const boardW = cell * cols;
        const boardH = cell * rows;
        const bx = 0, by = (h - boardH) / 2;
        const sideX = boardW + cell * 0.6;
        const sideW = Math.max(0, w - sideX);

        // Hintergrund
        ctx.fillStyle = obj.style?.backgroundColor || '#0b1020';
        ctx.fillRect(0, 0, w, h);

        // Spielfeld-Rahmen
        ctx.fillStyle = '#060a18';
        ctx.fillRect(bx - 2, by - 2, boardW + 4, boardH + 4);
        ctx.strokeStyle = obj.style?.borderColor || '#1f2a4a';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx - 2, by - 2, boardW + 4, boardH + 4);

        // Zellen-Raster
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const c = obj.board?.[y]?.[x] || 0;
                if (c) this.drawCell(ctx, bx + x * cell, by + y * cell, cell, PIECE_COLORS[c - 1]);
                else {
                    ctx.fillStyle = '#101736';
                    ctx.fillRect(bx + x * cell + 0.5, by + y * cell + 0.5, cell - 1, cell - 1);
                }
            }
        }

        // Ghost + aktives Piece
        const active = typeof obj.getActivePiece === 'function' ? obj.getActivePiece() : null;
        if (active && obj.state === 'playing') {
            if (obj.showGhost !== false) {
                const gy = obj.getGhostY();
                const color = TETRIS_COLORS[active.type as keyof typeof TETRIS_COLORS];
                this.drawMatrix(ctx, active.matrix, active.x, gy, bx, by, cell, color, true);
            }
            const color = TETRIS_COLORS[active.type as keyof typeof TETRIS_COLORS];
            this.drawMatrix(ctx, active.matrix, active.x, active.y, bx, by, cell, color, false);
        }

        // Sidebar
        if (sideW > 8) this.drawSidebar(ctx, obj, sideX, by, sideW, cell);

        // Overlays
        if (obj.state !== 'playing') {
            ctx.fillStyle = 'rgba(4,8,20,0.72)';
            ctx.fillRect(bx, by, boardW, boardH);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            if (obj.state === 'ready') {
                this.centerText(ctx, 'TETRIS', bx + boardW / 2, by + boardH / 2 - cell, cell * 0.85, '#8ab4ff', 'bold');
                this.centerText(ctx, '▶  Start drücken', bx + boardW / 2, by + boardH / 2 + cell * 0.6, cell * 0.5, '#e2e8f0', 'normal');
            } else if (obj.state === 'paused') {
                this.centerText(ctx, '⏸  PAUSE', bx + boardW / 2, by + boardH / 2, cell * 0.7, '#facc15', 'bold');
            } else if (obj.state === 'gameover') {
                this.centerText(ctx, 'GAME OVER', bx + boardW / 2, by + boardH / 2 - cell, cell * 0.7, '#ef4444', 'bold');
                this.centerText(ctx, `Punkte: ${obj.score ?? 0}`, bx + boardW / 2, by + boardH / 2 + cell * 0.4, cell * 0.5, '#e2e8f0', 'normal');
                this.centerText(ctx, '↻ Neu starten', bx + boardW / 2, by + boardH / 2 + cell * 1.6, cell * 0.45, '#94a3b8', 'normal');
            }
        }
    }

    private static drawSidebar(ctx: CanvasRenderingContext2D, obj: any, sx: number, sy: number, sw: number, cell: number): void {
        const pad = Math.max(4, cell * 0.3);
        let y = sy + pad;
        const labelSize = Math.max(9, cell * 0.42);
        const valueSize = Math.max(11, cell * 0.55);

        const label = (text: string) => {
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillStyle = '#64748b';
            ctx.font = `600 ${labelSize}px sans-serif`;
            ctx.fillText(text, sx + pad, y);
            y += labelSize * 1.6;
        };
        const value = (text: string) => {
            ctx.fillStyle = '#e2e8f0';
            ctx.font = `bold ${valueSize}px sans-serif`;
            ctx.fillText(text, sx + pad, y);
            y += valueSize * 2.1;
        };

        // Nächstes Teil
        label('NÄCHSTES');
        const next = typeof obj.getNextMatrix === 'function' ? obj.getNextMatrix() : null;
        const boxH = cell * 3;
        ctx.fillStyle = '#101736';
        ctx.fillRect(sx + pad * 0.5, y - pad * 0.4, sw - pad, boxH);
        if (next) {
            const color = TETRIS_COLORS[obj.nextPiece as keyof typeof TETRIS_COLORS];
            const mw = next[0].length, mh = next.length;
            const pc = Math.min((sw - pad * 3) / mw, boxH / mh);
            const ox = sx + pad * 0.5 + (sw - pad - mw * pc) / 2;
            const oy = y - pad * 0.4 + (boxH - mh * pc) / 2;
            for (let py = 0; py < mh; py++)
                for (let px = 0; px < mw; px++)
                    if (next[py][px]) this.drawCell(ctx, ox + px * pc, oy + py * pc, pc, color);
        }
        y += boxH + pad * 1.6;

        label('PUNKTE'); value(String(obj.score ?? 0));
        label('REIHEN'); value(String(obj.lines ?? 0));
        label('LEVEL'); value(String(obj.level ?? 1));
        label('BEST'); value(String(obj.highScore ?? 0));
    }

    private static drawMatrix(ctx: CanvasRenderingContext2D, matrix: number[][], px: number, py: number, bx: number, by: number, cell: number, color: string, ghost: boolean): void {
        for (let y = 0; y < matrix.length; y++) {
            for (let x = 0; x < matrix[y].length; x++) {
                if (!matrix[y][x]) continue;
                const dx = px + x, dy = py + y;
                if (dy < 0) continue;
                const cx = bx + dx * cell, cy = by + dy * cell;
                if (ghost) {
                    ctx.strokeStyle = color + '88';
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
        // Bevel: oben/links heller, unten/rechts dunkler
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.fillRect(x + 1, y + 1, s - 2, Math.max(1, s * 0.14));
        ctx.fillRect(x + 1, y + 1, Math.max(1, s * 0.14), s - 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x + 1, y + s - 1 - Math.max(1, s * 0.14), s - 2, Math.max(1, s * 0.14));
        ctx.fillRect(x + s - 1 - Math.max(1, s * 0.14), y + 1, Math.max(1, s * 0.14), s - 2);
    }

    private static centerText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, weight: string): void {
        ctx.fillStyle = color;
        ctx.font = `${weight} ${size}px sans-serif`;
        ctx.fillText(text, x, y);
    }
}
