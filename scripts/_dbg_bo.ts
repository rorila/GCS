import * as fs from 'fs';
import { GameRuntime } from '../src/runtime/GameRuntime';
const noop = () => {};
(global as any).localStorage = { getItem: () => null, setItem: noop, removeItem: noop, clear: noop };
let rafQ: any[] = [];
(global as any).requestAnimationFrame = (cb: any) => { rafQ.push(cb); return rafQ.length; };
(global as any).cancelAnimationFrame = (id: any) => { rafQ[id - 1] = null; };
(global as any).HTMLElement = class {}; (global as any).Node = class {};
(global as any).window = { addEventListener: noop, removeEventListener: noop, dispatchEvent: () => true, innerWidth: 1280, innerHeight: 720, location: { search: '' }, setTimeout, clearTimeout, setInterval, clearInterval };
(global as any).document = { addEventListener: noop, removeEventListener: noop, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild: noop }), body: { appendChild: noop } };
const project = JSON.parse(fs.readFileSync('game-server/public/projects/Breakout-Lernprojekt.json', 'utf8'));
const rt: any = new GameRuntime(project, undefined, { makeReactive: true, onRender: () => {} } as any);
rt.start();
const g = (n: string) => rt.getObjects().find((o: any) => o.name === n);
// Start auslösen
const startBtn = g('Start');
rt.handleEvent(startBtn.id, 'onClick', {});
// Frames manuell treiben
let now = 0;
const ball = g('Ball');
const zers = () => rt.getObjects().filter((o: any) => /Stein/.test(o.name) && o.visible === false).length;
let bounced = false, maxDestroyedAtBounce = 0;
for (let f = 0; f < 600; f++) {
    now += 16;
    const q = rafQ; rafQ = [];
    for (const cb of q) if (cb) cb(now);
    await Promise.resolve();
    if (!bounced && ball.velocityY > 0) { bounced = true; maxDestroyedAtBounce = zers(); console.log(`Frame ${f}: Ball prallte ab bei y=${ball.y.toFixed(1)}, zerstoerte Steine=${maxDestroyedAtBounce}`); }
    if (f % 100 === 0) console.log(`f${f} ball x=${ball.x.toFixed(1)} y=${ball.y.toFixed(1)} vx=${ball.velocityX} vy=${ball.velocityY} zerstoert=${zers()}`);
}
console.log('END: vy=', ball.velocityY, 'zerstoert=', zers());
rt.stop();
process.exit(0);
