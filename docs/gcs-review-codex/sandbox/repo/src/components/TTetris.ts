import { TWindow } from './TWindow';
import { TPropertyDef, IRuntimeComponent } from './TComponent';
import { Logger } from '../utils/Logger';

/**
 * TTetris - Vollständige Tetris-Spielkomponente.
 *
 * Kapselt Board, Tetromino-Logik (7-Bag, Wall-Kicks), Reihenauflösung,
 * Punkte/Level und die Gravity-Schleife. Nach außen steuerbar über
 * call_method (startGame, moveLeft, moveRight, rotatePiece, softDrop,
 * hardDrop, togglePause, resetGame) und Events (onGameOver, onLineClear,
 * onLevelUp, onStateChanged).
 *
 * Rendering erfolgt durch TetrisRenderer (Canvas) im StageObjectRenderer.
 */

type PieceType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';
export type TetrisState = 'ready' | 'playing' | 'paused' | 'gameover';

interface ActivePiece { type: PieceType; matrix: number[][]; x: number; y: number; }

const BASE_SHAPES: Record<PieceType, number[][]> = {
    I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    J: [[1,0,0],[1,1,1],[0,0,0]],
    L: [[0,0,1],[1,1,1],[0,0,0]],
    O: [[1,1],[1,1]],
    S: [[0,1,1],[1,1,0],[0,0,0]],
    T: [[0,1,0],[1,1,1],[0,0,0]],
    Z: [[1,1,0],[0,1,1],[0,0,0]],
};

export const TETRIS_COLORS: Record<PieceType, string> = {
    I: '#22d3ee', J: '#3b82f6', L: '#f97316', O: '#facc15',
    S: '#22c55e', T: '#a855f7', Z: '#ef4444',
};

const PIECE_TYPES = Object.keys(BASE_SHAPES) as PieceType[];

function rotateCW(m: number[][]): number[][] {
    const n = m.length;
    return m.map((row, y) => row.map((_, x) => m[n - 1 - x][y]));
}
function rotateCCW(m: number[][]): number[][] {
    const n = m.length;
    return m.map((row, y) => row.map((_, x) => m[x][n - 1 - y]));
}
function cloneMatrix(m: number[][]): number[][] { return m.map(r => r.slice()); }

export class TTetris extends TWindow implements IRuntimeComponent {
    private static logger = Logger.get('TTetris', 'Runtime');

    // ─── Konfiguration (Inspector) ───
    public cols: number = 10;
    public rows: number = 20;
    public baseInterval: number = 700;   // Gravity-Schritt in ms (Level 1)
    public levelLines: number = 10;      // Reihen pro Level-Aufstieg
    public showGhost: boolean = true;

    // ─── Spielzustand (bindbar) ───
    public state: TetrisState = 'ready';
    public score: number = 0;
    public lines: number = 0;
    public level: number = 1;
    public highScore: number = 0;
    public nextPiece: PieceType | '' = '';
    public board: number[][] = [];        // 0 = leer, sonst PieceType-Index +1
    public lastClear: number = 0;         // Zeilen des letzten Clears (für Effekte)

    // ─── Internals ───
    private active: ActivePiece | null = null;
    private bag: PieceType[] = [];
    private gravityTimer: number | null = null;
    private requestRender: (() => void) | undefined;
    private eventCallback: ((id: string, ev: string, data?: any) => void) | undefined;
    private clearingRows: number[] = [];

    constructor(name: string = 'Tetris', x: number = 0, y: number = 0, width: number = 22, height: number = 24) {
        super(name, x, y, width, height);
        this.className = 'TTetris';
        this.style.backgroundColor = '#0b1020';
        this.style.borderColor = '#1f2a4a';
        this.style.borderWidth = 2;
        this.style.borderRadius = 8;
        this.initBoard();
    }

    // ═══════════════════ Laufzeit-Lebenszyklus ═══════════════════

    public initRuntime(callbacks: { render?: () => void; handleEvent?: (id: string, ev: string, data?: any) => void }): void {
        this.requestRender = callbacks.render;
        this.eventCallback = callbacks.handleEvent;
    }

    public onRuntimeStop(): void {
        this.resetGame();
    }

    // ═══════════════════ Öffentliche Spiel-Methoden (call_method) ═══════════════════

    public startGame(): void {
        this.initBoard();
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.lastClear = 0;
        this.bag = [];
        this.nextPiece = this.drawFromBag();
        this.spawnPiece();
        this.setState('playing');
        this.startGravity();
    }

    public resetGame(): void {
        this.stopGravity();
        this.initBoard();
        this.active = null;
        this.nextPiece = '';
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.lastClear = 0;
        this.setState('ready');
        this.refresh();
    }

    public togglePause(): void {
        if (this.state === 'playing') { this.pauseGame(); }
        else if (this.state === 'paused') { this.resumeGame(); }
    }

    public pauseGame(): void {
        if (this.state !== 'playing') return;
        this.stopGravity();
        this.setState('paused');
        this.refresh();
    }

    public resumeGame(): void {
        if (this.state !== 'paused') return;
        this.setState('playing');
        this.startGravity();
    }

    public moveLeft(): void { this.tryMove(-1, 0); }
    public moveRight(): void { this.tryMove(1, 0); }

    public rotatePiece(): void { this.tryRotate(rotateCW); }
    public rotatePieceCCW(): void { this.tryRotate(rotateCCW); }

    /** Sanfter Fall: eine Zeile, +1 Punkt. */
    public softDrop(): void {
        if (this.state !== 'playing' || !this.active) return;
        if (this.tryMove(0, 1)) {
            this.score += 1;
        } else {
            this.lockPiece();
        }
        this.refresh();
    }

    /** Sofortiger Fall bis unten, +2 Punkte pro Zeile. */
    public hardDrop(): void {
        if (this.state !== 'playing' || !this.active) return;
        let dropped = 0;
        while (this.canPlace(this.active.matrix, this.active.x, this.active.y + 1)) {
            this.active.y++;
            dropped++;
        }
        this.score += dropped * 2;
        this.lockPiece();
        this.refresh();
    }

    // ═══════════════════ Kern-Logik ═══════════════════

    private initBoard(): void {
        this.board = Array.from({ length: this.rows }, () => new Array(this.cols).fill(0));
    }

    private drawFromBag(): PieceType {
        if (this.bag.length === 0) {
            this.bag = [...PIECE_TYPES];
            for (let i = this.bag.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
            }
        }
        return this.bag.pop()!;
    }

    private spawnPiece(): void {
        const type = this.nextPiece as PieceType || this.drawFromBag();
        this.nextPiece = this.drawFromBag();
        const matrix = cloneMatrix(BASE_SHAPES[type]);
        const piece: ActivePiece = {
            type,
            matrix,
            x: Math.floor((this.cols - matrix[0].length) / 2),
            y: type === 'I' ? -1 : 0,
        };
        if (!this.canPlace(piece.matrix, piece.x, piece.y)) {
            this.active = piece;
            this.gameOver();
            return;
        }
        this.active = piece;
        this.emitEvent('onSpawn', { piece: type });
    }

    private canPlace(matrix: number[][], px: number, py: number): boolean {
        for (let y = 0; y < matrix.length; y++) {
            for (let x = 0; x < matrix[y].length; x++) {
                if (!matrix[y][x]) continue;
                const bx = px + x, by = py + y;
                if (bx < 0 || bx >= this.cols || by >= this.rows) return false;
                if (by >= 0 && this.board[by][bx]) return false;
            }
        }
        return true;
    }

    private tryMove(dx: number, dy: number): boolean {
        if (this.state !== 'playing' || !this.active) return false;
        if (!this.canPlace(this.active.matrix, this.active.x + dx, this.active.y + dy)) return false;
        this.active.x += dx;
        this.active.y += dy;
        this.refresh();
        return true;
    }

    private tryRotate(rotFn: (m: number[][]) => number[][]): void {
        if (this.state !== 'playing' || !this.active) return;
        const rotated = rotFn(this.active.matrix);
        // Einfache Wall-Kicks: zuerst in-place, dann seitliche Verschiebung
        for (const kick of [0, -1, 1, -2, 2]) {
            if (this.canPlace(rotated, this.active.x + kick, this.active.y)) {
                this.active.matrix = rotated;
                this.active.x += kick;
                this.refresh();
                return;
            }
        }
    }

    /** Y-Position des Ghost-Pieces (Landeposition). */
    public getGhostY(): number {
        if (!this.active) return 0;
        let gy = this.active.y;
        while (this.canPlace(this.active.matrix, this.active.x, gy + 1)) gy++;
        return gy;
    }

    private lockPiece(): void {
        if (!this.active) return;
        const colorIdx = PIECE_TYPES.indexOf(this.active.type) + 1;
        for (let y = 0; y < this.active.matrix.length; y++) {
            for (let x = 0; x < this.active.matrix[y].length; x++) {
                if (!this.active.matrix[y][x]) continue;
                const by = this.active.y + y, bx = this.active.x + x;
                if (by < 0) { this.gameOver(); return; }   // Lock-Out über dem Spielfeld
                this.board[by][bx] = colorIdx;
            }
        }
        this.active = null;
        this.emitEvent('onLock', {});
        this.clearLines();
        if (this.state === 'playing') this.spawnPiece();
    }

    private clearLines(): void {
        const full: number[] = [];
        for (let y = 0; y < this.rows; y++) {
            if (this.board[y].every(c => c !== 0)) full.push(y);
        }
        if (full.length === 0) { this.lastClear = 0; return; }

        this.clearingRows = full;
        for (const y of full) {
            this.board.splice(y, 1);
            this.board.unshift(new Array(this.cols).fill(0));
        }
        const cleared = full.length;
        this.lastClear = cleared;
        this.lines += cleared;
        this.score += [0, 100, 300, 500, 800][cleared] * this.level;

        const newLevel = Math.floor(this.lines / this.levelLines) + 1;
        if (newLevel !== this.level) {
            this.level = newLevel;
            this.restartGravity();
            this.emitEvent('onLevelUp', { level: this.level });
        }
        this.emitEvent('onLineClear', { count: cleared, score: this.score });
        this.clearingRows = [];
    }

    private gameOver(): void {
        this.stopGravity();
        this.active = null;
        if (this.score > this.highScore) this.highScore = this.score;
        TTetris.logger.info(`Game Over – Punkte: ${this.score}, Reihen: ${this.lines}, Level: ${this.level}`);
        this.setState('gameover');
        this.emitEvent('onGameOver', { score: this.score, lines: this.lines, level: this.level });
        this.refresh();
    }

    // ─── Gravity ───

    private speedMs(): number {
        return Math.max(60, Math.round(this.baseInterval * Math.pow(0.85, this.level - 1)));
    }

    private startGravity(): void {
        this.stopGravity();
        this.gravityTimer = window.setInterval(() => this.gravityTick(), this.speedMs());
    }

    private restartGravity(): void {
        if (this.state === 'playing') this.startGravity();
    }

    private stopGravity(): void {
        if (this.gravityTimer !== null) { clearInterval(this.gravityTimer); this.gravityTimer = null; }
    }

    private gravityTick(): void {
        if (this.state !== 'playing') return;
        if (!this.active) { this.spawnPiece(); this.refresh(); return; }
        if (!this.tryMove(0, 1)) this.lockPiece();
        this.refresh();
    }

    // ─── Events & Rendering-Anbindung ───

    private setState(s: TetrisState): void {
        if (this.state === s) return;
        this.state = s;
        this.emitEvent('onStateChanged', { state: s });
    }

    private emitEvent(event: string, data: any): void {
        if (this.eventCallback) {
            this.eventCallback(this.id, event, data);
        } else {
            window.dispatchEvent(new CustomEvent('GameRuntime_Event', {
                detail: { id: this.id, event, data }
            }));
        }
    }

    private refresh(): void { this.requestRender?.(); }

    // Für TetrisRenderer: Daten des nächsten Pieces als Matrix
    public getNextMatrix(): number[][] | null {
        return this.nextPiece ? cloneMatrix(BASE_SHAPES[this.nextPiece]) : null;
    }

    public getActivePiece(): ActivePiece | null { return this.active; }
    public getClearingRows(): number[] { return this.clearingRows; }

    public getEvents(): string[] {
        return ['onGameOver', 'onLineClear', 'onLevelUp', 'onStateChanged', 'onSpawn', 'onLock', ...super.getEvents()];
    }

    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...super.getInspectorProperties(),
            { name: 'cols', label: 'Spalten', type: 'number', group: 'SPIELFELD', min: 4, max: 30, defaultValue: 10 },
            { name: 'rows', label: 'Zeilen', type: 'number', group: 'SPIELFELD', min: 4, max: 40, defaultValue: 20 },
            { name: 'baseInterval', label: 'Startgeschwindigkeit (ms)', type: 'number', group: 'SPIELFELD', min: 100, max: 2000, defaultValue: 700, hint: 'Gravity-Schritt auf Level 1; wird pro Level ~15% schneller' },
            { name: 'levelLines', label: 'Reihen pro Level', type: 'number', group: 'SPIELFELD', min: 1, max: 50, defaultValue: 10 },
            { name: 'showGhost', label: 'Ghost-Piece zeigen', type: 'boolean', group: 'SPIELFELD' },
            { name: 'state', label: 'Zustand', type: 'string', group: 'STATUS', readonly: true },
            { name: 'score', label: 'Punkte', type: 'number', group: 'STATUS', readonly: true },
            { name: 'lines', label: 'Reihen', type: 'number', group: 'STATUS', readonly: true },
            { name: 'level', label: 'Level', type: 'number', group: 'STATUS', readonly: true },
            { name: 'highScore', label: 'Highscore', type: 'number', group: 'STATUS', readonly: true },
            { name: 'nextPiece', label: 'Nächster Stein', type: 'string', group: 'STATUS', readonly: true },
        ];
    }

    public toDTO(): any {
        return {
            ...super.toDTO(),
            cols: this.cols,
            rows: this.rows,
            baseInterval: this.baseInterval,
            levelLines: this.levelLines,
            showGhost: this.showGhost,
        };
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TTetris', (objData: any) => new TTetris(objData.name, objData.x, objData.y, objData.width, objData.height));
