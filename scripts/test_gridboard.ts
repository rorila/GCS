/**
 * Sanity-Test für TGridBoard (headless, ohne DOM).
 * Ausführen: npx tsx scripts/test_gridboard.ts
 */
import { TGridBoard } from '../src/components/TGridBoard';

const g = globalThis as any;
const dispatched: string[] = [];
g.window = g.window || {};
g.window.dispatchEvent = (ev: any) => { dispatched.push(ev?.detail?.event || ''); return true; };
g.CustomEvent = class { constructor(public type: string, public detail?: any) { this.detail = detail?.detail ?? detail; } };

let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra = '') {
    if (cond) { passed++; console.log(`  ✓ ${name}`); }
    else { failed++; console.log(`  ✗ ${name} ${extra}`); }
}

const b = new TGridBoard('Board');
check('Initial: 10x20 leeres Board', b.cells.length === 20 && b.cells.every(r => r.length === 10 && r.every(c => c === 0)));

// ─── Zellen ───
b.setCell(3, 5, 2);
check('setCell/getCell', b.getCell(3, 5) === 2);
check('getCell außerhalb → -1', b.getCell(-1, 0) === -1 && b.getCell(0, 99) === -1);
b.fillAll(4);
check('fillAll füllt alles', b.cells.every(r => r.every(c => c === 4)));
b.clearBoard();
check('clearBoard leert', b.countFilled() === 0);

// ─── Formen ───
const tShape = [[0, 1, 0], [1, 1, 1]];
check('canPlaceShape: frei', b.canPlaceShape(tShape, 3, 0));
b.placeShape(tShape, 3, 0, 6);
check('placeShape schreibt 4 Zellen', b.countFilled() === 4);
check('canPlaceShape: blockiert durch gesetzte Zellen', !b.canPlaceShape(tShape, 3, 0));
check('canPlaceShape: Wand links', !b.canPlaceShape(tShape, -1, 0));
check('canPlaceShape: oberhalb erlaubt (Spawn)', b.canPlaceShape(tShape, 6, -1)); // freier Bereich; belegt bei x=3
b.removeShape(tShape, 3, 0);
check('removeShape räumt auf', b.countFilled() === 0);

// JSON-String-Eingabe (Flow-Params kommen oft als String)
check('Matrix als JSON-String akzeptiert', b.canPlaceShape(JSON.stringify(tShape), 3, 0));

// ─── Volle Reihen ───
for (let x = 0; x < 10; x++) b.setCell(x, 19, 1);
for (let x = 0; x < 10; x++) b.setCell(x, 18, x < 9 ? 1 : 0); // fast voll
check('findFullRows findet Reihe 19', JSON.stringify(b.findFullRows()) === '[19]');
const removed = b.removeRows([19]);
check('removeRows entfernt + schiebt nach', removed === 1 && b.cells[0].every(c => c === 0) && b.cells[19][9] === 0);
for (let x = 0; x < 10; x++) { b.setCell(x, 19, 1); b.setCell(x, 18, 1); }
check('clearFullRows entfernt 2 Reihen', b.clearFullRows() === 2 && b.countFilled() === 0);

// ─── Overlays ───
b.setOverlay(tShape, 3, 5, 6);
check('Overlay gesetzt', b.overlay !== null && b.overlay.x === 3 && b.overlay.v === 6);
b.setGhost(tShape, 3, 18, 6);
check('Ghost gesetzt', b.ghost !== null && b.ghost.y === 18);
b.clearOverlay(); b.clearGhost();
check('Overlays weg', b.overlay === null && b.ghost === null);
b.setOverlayText('PAUSE');
check('overlayText', b.overlayText === 'PAUSE');

// ─── Events ───
dispatched.length = 0;
b.setCell(0, 0, 1);
check('onChanged bei Mutation', dispatched.includes('onChanged'));
b.emitCellClick(2, 3);
check('onCellClick mit Koordinaten', dispatched.includes('onCellClick'));

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
process.exit(failed ? 1 : 0);
