import * as fs from 'fs';
import { GameRuntime } from '../src/runtime/GameRuntime';
const noop = () => {};
(global as any).localStorage = { getItem: () => null, setItem: noop, removeItem: noop, clear: noop };
let rafQ: any[] = [];
(global as any).requestAnimationFrame = (cb: any) => { rafQ.push(cb); return rafQ.length; };
(global as any).cancelAnimationFrame = () => {};
(global as any).HTMLElement = class {}; (global as any).Node = class {};
(global as any).window = { addEventListener: noop, removeEventListener: noop, dispatchEvent: () => true, innerWidth: 1280, innerHeight: 720, location: { search: '' }, setTimeout, clearTimeout, setInterval, clearInterval };
(global as any).document = { addEventListener: noop, removeEventListener: noop, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild: noop }), body: { appendChild: noop } };
const project = JSON.parse(fs.readFileSync('game-server/public/projects/Breakout-Lernprojekt.json', 'utf8'));
const rt: any = new GameRuntime(project, undefined, { makeReactive: true, onRender: () => {} } as any);
const g = (n: string) => rt.getObjects().find((o: any) => o.name === n);
rt.start();
rt.handleEvent(g('Start').id, 'onClick', {});
let now = 0; const ball = g('Ball');
for (let f = 0; f < 60; f++) {
    now += 16; const q = rafQ; rafQ = [];
    for (const cb of q) if (cb) cb(now);
    await Promise.resolve();
}
const s = g('Stein_5_6');
const hbB = ball.getHitbox(), hbS = s.getHitbox();
console.log('Ball pos', ball.x, ball.y, 'w', ball.width, 'h', ball.height, '| hitbox', JSON.stringify(hbB));
console.log('Stein pos', s.x, s.y, 'w', s.width, 'h', s.height, '| hitbox', JSON.stringify(hbS), 'hbW', s.hitboxWidth, 'hbH', s.hitboxHeight, 'shape', s.shape, s.hitboxShape);
const dx = (hbB.x + hbB.w / 2) - (hbS.x + hbS.w / 2);
const dy = (hbB.y + hbB.h / 2) - (hbS.y + hbS.h / 2);
console.log('dx', dx.toFixed(2), 'dy', dy.toFixed(2), 'ovX', ((hbB.w + hbS.w) / 2 - Math.abs(dx)).toFixed(2), 'ovY', ((hbB.h + hbS.h) / 2 - Math.abs(dy)).toFixed(2));
rt.stop(); process.exit(0);
