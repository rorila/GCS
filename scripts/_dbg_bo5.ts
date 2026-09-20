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
const zers = () => rt.getObjects().filter((o: any) => /Stein/.test(o.name) && o.visible === false).length;
for (let f = 0; f < 400; f++) {
    now += 16; const q = rafQ; rafQ = [];
    for (const cb of q) if (cb) cb(now);
    await Promise.resolve();
    if (f % 50 === 0) console.log(`f${f} x=${ball.x.toFixed(1)} y=${ball.y.toFixed(1)} vx=${ball.velocityX.toFixed(2)} vy=${ball.velocityY.toFixed(2)} zerstoert=${zers()}`);
}
console.log('END vy=', ball.velocityY, 'zerstoert=', zers());
rt.stop(); process.exit(0);
