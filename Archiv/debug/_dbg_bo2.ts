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

// Event-Logging
const origHandle = rt.handleEvent.bind(rt);
rt.handleEvent = (id: string, ev: string, data: any) => {
    if (ev === 'onCollision') {
        const o = rt.getObjects().find((x: any) => x.id === id);
        console.log(`EVT onCollision: ${o?.name} | other=${data?.other} hitSide=${data?.hitSide}`);
    }
    return origHandle(id, ev, data);
};
const origExec = rt.taskExecutor.execute.bind(rt.taskExecutor);
rt.taskExecutor.execute = (name: string, vars: any, gv: any, ctx: any, d: number, p: any, pr: any, r: any) => {
    if (['BallKontakt', 'SteinReflexion', 'SteinTreffer', 'SteinPruefen', 'Wandkontakt'].includes(name))
        console.log(`TASK ${name}: other=${vars?.other} hitSide=${vars?.hitSide} self=${vars?.self?.name}`);
    return origExec(name, vars, gv, ctx, d, p, pr, r);
};

rt.start();
const g = (n: string) => rt.getObjects().find((o: any) => o.name === n);
rt.handleEvent(g('Start').id, 'onClick', {});
let now = 0; const ball = g('Ball');
for (let f = 0; f < 140; f++) {
    now += 16; const q = rafQ; rafQ = [];
    for (const cb of q) if (cb) cb(now);
    await Promise.resolve();
    if (f % 20 === 0) console.log(`f${f} y=${ball.y.toFixed(1)} vy=${ball.velocityY}`);
}
rt.stop(); process.exit(0);
