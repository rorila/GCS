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
// pro Frame: vorher/nachher bei Kollision
let lastVy = ball.velocityY, lastVx = ball.velocityX;
const origHandle = rt.handleEvent.bind(rt);
rt.handleEvent = (id: string, ev: string, data: any) => {
    if (ev === 'onCollision' && g('Ball').id === id) {
        console.log(`PRE  BallKontakt other=${data.other} side=${data.hitSide} | vx=${ball.velocityX} vy=${ball.velocityY} | ballHitbox x=${ball.x.toFixed(2)} w=${ball.width}`);
    }
    const r = origHandle(id, ev, data);
    if (ev === 'onCollision' && g('Ball').id === id) {
        Promise.resolve().then(() => console.log(`POST BallKontakt | vx=${ball.velocityX} vy=${ball.velocityY}`));
    }
    return r;
};
for (let f = 0; f < 120; f++) {
    now += 16; const q = rafQ; rafQ = [];
    for (const cb of q) if (cb) cb(now);
    await Promise.resolve();
}
rt.stop(); process.exit(0);
