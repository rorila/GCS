/**
 * Sanity-Test für die TTetris-Engine (headless, ohne DOM).
 * Ausführen: npx tsx scripts/test_tetris_engine.ts
 */
import { TTetris } from '../src/components/TTetris';

// --- DOM-Stubs (werden erst zur Laufzeit benötigt, nicht beim Import) ---
const g = globalThis as any;
let gravityTick: (() => void) | null = null;
const dispatched: string[] = [];
g.window = {
    setInterval: (fn: () => void) => { gravityTick = fn; return 1; },
    clearInterval: () => { gravityTick = null; },
    dispatchEvent: (ev: any) => { dispatched.push(ev?.detail?.event || ''); return true; },
};
// TTetris ruft clearInterval als globale Funktion auf (im Browser = window.clearInterval)
g.clearInterval = () => { gravityTick = null; };
g.CustomEvent = class { constructor(public type: string, public detail?: any) { this.detail = detail?.detail ?? detail; } };

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra = '') {
    if (cond) { passed++; console.log(`  ✓ ${name}`); }
    else { failed++; console.log(`  ✗ ${name} ${extra}`); }
}

// ─── Start ───
const t = new TTetris('Spielfeld', 0, 0, 26, 34);
check('Initial: state = ready', t.state === 'ready');
check('Board ist 20x10 leer', t.board.length === 20 && t.board.every(r => r.length === 10 && r.every(c => c === 0)));

t.startGame();
check('startGame: state = playing', t.state === 'playing');
check('startGame: aktives Piece vorhanden', !!t.getActivePiece());
check('startGame: nextPiece gesetzt', t.nextPiece !== '');
check('startGame: Gravity-Timer läuft', gravityTick !== null);

// ─── Bewegung ───
const startX = t.getActivePiece()!.x;
t.moveLeft();
check('moveLeft verschiebt -1', t.getActivePiece()!.x === startX - 1);
t.moveRight(); t.moveRight();
check('moveRight verschiebt +1', t.getActivePiece()!.x === startX + 1);

// Rand-Kollision: 20x links → muss an der Wand stoppen
for (let i = 0; i < 30; i++) t.moveLeft();
const minX = Math.min(...t.getActivePiece()!.matrix.map((row) =>
    row.reduce<number[]>((acc, v, rx) => v ? [...acc, rx] : acc, [])).flat());
check('Kollision links: Piece bleibt im Feld', t.getActivePiece()!.x + minX >= 0);

// ─── Rotation ───
const t2 = new TTetris('T2');
t2.startGame();
const p = t2.getActivePiece()!;
if (p.type === 'O') {
    // O-Piece: Rotation ändert nichts → anderen Stein erzwingen
    (p as any).matrix = [[0, 1, 0], [1, 1, 1], [0, 0, 0]]; // T-Form
}
const before = JSON.stringify(p.matrix);
t2.rotatePiece();
check('rotatePiece ändert Matrix', JSON.stringify(t2.getActivePiece()!.matrix) !== before);

// ─── Soft Drop / Hard Drop ───
const scoreBefore = t2.score;
const yBefore = t2.getActivePiece()!.y;
t2.softDrop();
check('softDrop: y+1 und +1 Punkt', t2.getActivePiece()!.y === yBefore + 1 && t2.score === scoreBefore + 1);

t2.hardDrop();
check('hardDrop: Stein gesetzt, nächster gespawnt', t2.score > scoreBefore && !!t2.getActivePiece());
check('hardDrop: Board hat belegte Zellen', t2.board.some(r => r.some(c => c !== 0)));

// ─── Reihen löschen ───
const t3 = new TTetris('T3');
t3.startGame();
// Unterste Reihe fast voll: alle außer Spalte 4..5 (I-Piece quer füllt 4 Zellen)
for (let x = 0; x < 10; x++) if (x < 4 || x > 5) t3.board[19][x] = 3;
// I-Piece horizontal auf Reihe 19 positionieren und locken
(t3 as any).active = { type: 'I', matrix: [[1, 1, 1, 1]], x: 3, y: 19 };
(t3 as any).lockPiece();
check('Reihe gelöscht: lines = 1', t3.lines === 1);
check('Reihe gelöscht: score >= 100', t3.score >= 100, `score=${t3.score}`);
check('Reihe gelöscht: unterste Reihe wieder frei', t3.board[19].every(c => c === 0));

// ─── Level-Up ───
const t4 = new TTetris('T4');
t4.startGame();
t4.lines = 9;
for (let x = 0; x < 10; x++) if (x < 4 || x > 5) t4.board[19][x] = 3;
(t4 as any).active = { type: 'I', matrix: [[1, 1, 1, 1]], x: 3, y: 19 };
(t4 as any).lockPiece();
check('Level-Up bei 10 Reihen', t4.level === 2, `level=${t4.level}`);

// ─── Pause / Resume ───
const t5 = new TTetris('T5');
t5.startGame();
t5.pauseGame();
check('pauseGame: state = paused, Timer aus', t5.state === 'paused' && gravityTick === null);
t5.resumeGame();
check('resumeGame: state = playing, Timer an', t5.state === 'playing' && gravityTick !== null);
t5.togglePause();
check('togglePause → paused', t5.state === 'paused');
t5.togglePause();
check('togglePause → playing', t5.state === 'playing');

// ─── Game Over ───
const t6 = new TTetris('T6');
t6.startGame();
// Spalte komplett füllen → nächster Spawn kollidiert
for (let y = 0; y < 20; y++) for (let x = 0; x < 10; x++) t6.board[y][x] = 1;
dispatched.length = 0;
(t6 as any).spawnPiece();
check('Game Over bei vollem Board', t6.state === 'gameover');
check('onGameOver-Event gesendet', dispatched.includes('onGameOver'));

// ─── Reset ───
t6.resetGame();
check('resetGame: state = ready, Board leer', t6.state === 'ready' && t6.board.every(r => r.every(c => c === 0)));
check('resetGame: score/lines/level zurückgesetzt', t6.score === 0 && t6.lines === 0 && t6.level === 1);

// ─── 7-Bag: 7 Züge = alle Typen genau einmal ───
const t7 = new TTetris('T7');
t7.startGame();
const drawn = new Set<string>();
drawn.add(t7.getActivePiece()!.type);
for (let i = 0; i < 6; i++) { (t7 as any).active = null; t7.hardDrop === undefined; (t7 as any).spawnPiece(); drawn.add(t7.getActivePiece()!.type); }
// Spawn verbraucht je einen Stein aus dem Bag; nach 7 Zügen müssen alle Typen gezogen sein
const bagTypes = new Set<string>();
const t8 = new TTetris('T8');
for (let i = 0; i < 7; i++) bagTypes.add((t8 as any).drawFromBag());
check('7-Bag: 7 Züge liefern alle 7 Typen', bagTypes.size === 7, `gezogen: ${[...bagTypes].join(',')}`);

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
process.exit(failed ? 1 : 0);
