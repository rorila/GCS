/**
 * Headless-Simulation: SuperMario.json — Physik (Landung), Kamera, Muenze,
 * Goomba-Stomp, Tod. Nutzt echte TSprite-Physik + CollisionManager.
 * Ausfuehren: npx tsx scripts/test_mario_flow.ts
 */
(globalThis as any).window ??= { addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } };
(globalThis as any).document ??= { createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {} }) };

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
import { actionRegistry } from '../src/runtime/ActionRegistry';
import { registerStandardActions } from '../src/runtime/actions/StandardActions';
import { TaskLoopHandler } from '../src/runtime/executor/TaskLoopHandler';
import { TaskConditionEvaluator } from '../src/runtime/executor/TaskConditionEvaluator';
import { CollisionManager } from '../src/runtime/CollisionManager';
registerStandardActions();
import { TSprite } from '../src/components/TSprite';

const project = JSON.parse(readFileSync(join(__dirname, '../game-server/public/projects/SuperMario.json'), 'utf8'));
const bp = project.stages[0], main = project.stages[1];

// ─── Objekte instanziieren (Welt-Kinder rekursiv) ───
const objects: any[] = [];
const panels: any[] = [];
const hydrate = (def: any, parentId?: string): any => {
    let o: any;
    if (def.className === 'TSprite') {
        o = new TSprite(def.name, def.x ?? 0, def.y ?? 0);
        Object.assign(o, def);
        o.events = def.events || {};
        if (parentId) o.parentId = parentId;
    } else if (def.className === 'TGroupPanel' || def.className === 'TPanel') {
        o = { ...def, children: [] };
        panels.push(o);
    } else {
        o = { ...def };
    }
    if (parentId && !o.parentId) o.parentId = parentId;
    objects.push(o);
    for (const c of def.children || []) hydrate(c, def.id || def.name);
    return o;
};
for (const def of [...bp.objects, ...main.objects]) hydrate(def);

// ─── Variablen-Store (wie RuntimeVariableManager) ───
const definitions = new Map<string, any>();
const registerDef = (d: any) => { if (d?.name) { definitions.set(d.name, d); if (d.id) definitions.set(d.id, d); } };
for (const vv of [...(bp.variables || []), ...(main.variables || [])]) registerDef(vv);
for (const o of objects) if (o.isVariable || o.className?.includes('Variable')) registerDef(o);

const store: Record<string, any> = {};
for (const vv of bp.variables) {
    const init = vv.initialValue !== undefined ? vv.initialValue : vv.value;
    store[vv.name] = init;
    objects.push({ ...vv, isVariable: true, value: init });
}
const normKey = (p: any) => definitions.get(String(p))?.name ?? String(p);
const contextVars: Record<string, any> = new Proxy(store, {
    get: (t, p) => t[normKey(p)],
    set: (t, p, val) => {
        // Produktionsnah: RuntimeVariableManager haelt das Variablen-Objekt
        // (.value) synchron — sonst lesen spaetere Tasks veraltete Werte,
        // wenn sie Variablen ueber die Objekt-Map (vars-Prototype) aufloesen.
        const d = definitions.get(String(p)) ?? definitions.get(normKey(p));
        if (d && typeof d === 'object' && 'value' in d) d.value = val;
        t[normKey(p)] = val;
        return true;
    },
    has: (t, p) => normKey(p) in t,
});

const nameMap: Record<string, any> = {};
for (const o of objects) if (o.name) nameMap[o.name] = o;

const actionsByName = new Map<string, any>(main.actions.map((a: any) => [a.name, a]));
const tasksByName = new Map<string, any>(main.tasks.map((t: any) => [t.name, t]));

// ─── Event-gebundene Task-Ausfuehrung (wie RuntimeEventService) ───
const context: any = { objects, vars: {}, contextVars, eventData: {} };

async function runSeq(seq: any[], vars: Record<string, any>, depth = 0): Promise<void> {
    for (const item of seq) {
        if (item.type === 'action') await runAction(actionsByName.get(item.name), vars);
        else if (item.type === 'task') await runTask(item.name, vars, depth + 1);
        else if (item.type === 'condition') {
            const ok = TaskConditionEvaluator.evaluateCondition(item.condition, vars, contextVars);
            await runSeq(ok ? item.then : (item.else || []), vars, depth);
        } else if (item.type === 'foreach' || item.type === 'for' || item.type === 'while') {
            const execBody = async (body: any[], _v: any, _g: any, _c: any, d: number) => { await runSeq(body, vars, d); };
            if (item.type === 'foreach') await TaskLoopHandler.handleForeach(item, vars, contextVars, null, depth, undefined, execBody, objects);
            else if (item.type === 'for') await TaskLoopHandler.handleFor(item, vars, contextVars, null, depth, undefined, execBody, objects);
            else await TaskLoopHandler.handleWhile(item, vars, contextVars, null, depth, undefined, execBody, objects);
        }
    }
}
async function runAction(a: any, vars: Record<string, any>): Promise<void> {
    if (!a) { console.log('  !! Action fehlt'); return; }
    const handler = actionRegistry.getHandler(a.type);
    if (!handler) { console.log(`  !! kein Handler fuer ${a.type}`); return; }
    const ctx = { ...context, vars, eventData: vars.eventData };
    await handler(a, ctx);
}
async function runTask(name: string, baseVars?: Record<string, any>, depth = 0): Promise<void> {
    const t = tasksByName.get(name);
    if (!t) { console.log(`  !! Task ${name} fehlt`); return; }
    const vars: Record<string, any> = baseVars ?? Object.create(nameMap);
    await runSeq(t.actionSequence, vars, depth);
}
async function fireEvent(objName: string, eventName: string, data: any = {}): Promise<void> {
    const obj = objects.find(o => o.name === objName || o.id === objName);
    const taskName = obj?.events?.[eventName];
    if (!taskName) return;
    const eventVars: Record<string, any> = Object.create(nameMap);
    Object.assign(eventVars, data);
    eventVars.eventData = data;
    eventVars.self = obj;
    eventVars.sender = obj;
    await runTask(taskName, eventVars);
}

// ─── Physik-Simulation ───
const sprites: TSprite[] = objects.filter(o => o.className === 'TSprite') as TSprite[];
const cm = new CollisionManager();
cm.configure(project.stage?.grid ?? null, 'event-only',
    (spriteId: string, eventName: string, data?: any) => {
        const obj = objects.find(o => o.id === spriteId);
        if (obj) fireEvent(obj.name, eventName, data);
    });
const bounds = { width: 220, height: 22, offsetTop: 0, offsetBottom: 0 };
const DT = 1 / 60;
function simFrames(n: number) {
    for (let i = 0; i < n; i++) {
        for (const s of sprites) { if (s.visible) s.update(DT, true); }
        cm.checkCollisions(sprites, panels);
        cm.checkBoundaries(sprites, panels, bounds);
        cm.checkStageExits(sprites, panels, bounds);
    }
}

let passed = 0, failed = 0;
const check = (name: string, ok: boolean, extra = '') => {
    if (ok) { passed++; console.log(`  ✓ ${name}`); }
    else { failed++; console.log(`  ✗ ${name} ${extra}`); }
};

const mario = objects.find(o => o.name === 'Mario');
const welt = objects.find(o => o.name === 'Welt');

console.log('=== SpielStarten ===');
await runTask('SpielStarten');
check('Status=playing', contextVars.Status === 'playing', `=${contextVars.Status}`);

console.log('=== Landung (120 Frames ≙ 2s) ===');
simFrames(120);
check('Mario steht auf Boden (y≈17)', Math.abs(mario.y - 17) < 0.1, `y=${mario.y.toFixed(3)}`);
check('velocityY = 0 (kein Aufschaukeln)', Math.abs(mario.velocityY) < 1e-9, `vy=${mario.velocityY}`);
const y1 = mario.y;
simFrames(60);
check('Stabil: kein Sinken nach weiteren 60 Frames', Math.abs(mario.y - y1) < 0.01, `y=${mario.y.toFixed(3)}`);
check('AmBoden via Event gesetzt', contextVars.AmBoden === 1 || contextVars.AmBoden === true, `=${contextVars.AmBoden}`);

console.log('=== Laufen + Kamera ===');
// Goombas laufen auf Mario zu — fuer den reinen Lauf/Kamera-Test parken.
const goombas = objects.filter(o => o.name?.startsWith('Goomba'));
goombas.forEach(g => { g.visible = false; });
await runTask('RechtsDruck');
for (let i = 0; i < 120; i++) {
    await runTask('Frame'); simFrames(1);
    if (i < 6 || i % 30 === 0) console.log(`   f${i}: vx=${mario.velocityX} x=${mario.x.toFixed(2)} vy=${mario.velocityY.toFixed(3)} Welt.x=${welt.x}`);
}
check('Mario laeuft nach rechts', mario.x > 10, `x=${mario.x.toFixed(2)}`);
check('Welt scrollt (Welt.x < 0)', welt.x < 0, `Welt.x=${welt.x}`);
check('Mario pinned bei Schwelle 16', Math.abs(mario.x + welt.x - 16) < 0.6, `screen=${(mario.x + welt.x).toFixed(2)}`);

console.log('=== Sprung ===');
await runTask('RechtsLos'); // sonst laeuft Mario im Sprung gegen die Ziegel bei x=18
mario.x = 10; mario.velocityX = 0; // freie Stelle
await runTask('SprungOderStart');
check('Sprung-Impuls gesetzt', mario.velocityY < 0, `vy=${mario.velocityY}`);
let maxH = 0;
for (let i = 0; i < 90; i++) { await runTask('Frame'); simFrames(1); maxH = Math.max(maxH, 19 - (mario.y + mario.height)); }
check('Sprunghoehe > 3 Zellen', maxH > 3, `maxH=${maxH.toFixed(2)}`);
check('Landet wieder (y≈17)', Math.abs(mario.y - 17) < 0.2, `y=${mario.y.toFixed(2)}`);

console.log('=== Muenze ===');
const muenze = objects.find(o => o.name === 'Muenze0'); // (8,16)
const muenzenVorher = Number(contextVars.Muenzen);
mario.x = 8; mario.y = 16; mario.velocityX = 0; mario.velocityY = 0;
simFrames(1);
await new Promise(r => setTimeout(r, 0));
check('Muenze eingesammelt', !muenze.visible, `visible=${muenze.visible}`);
check('Muenzen +1', contextVars.Muenzen === muenzenVorher + 1, `=${contextVars.Muenzen}`);
check('Punkte+50', contextVars.Punkte >= 50, `=${contextVars.Punkte}`);

console.log('=== Goomba-Stomp ===');
const goomba = objects.find(o => o.name === 'Goomba0');
goomba.visible = true;
goomba.x = 30; goomba.y = 18; goomba.velocityX = 0; goomba.velocityY = 0;
mario.x = 30; mario.y = 16.5; mario.velocityX = 0; mario.velocityY = 0.2; // faellt auf Goomba
cm.clearTrackingFor(mario.id); cm.clearTrackingFor(goomba.id); // Event-Cooldowns zuruecksetzen
simFrames(3);
await new Promise(r => setTimeout(r, 0));
check('Goomba platt (visible=false)', !goomba.visible, `visible=${goomba.visible}`);
check('Stomp-Bounce (vy<0)', mario.velocityY < 0, `vy=${mario.velocityY}`);

console.log('=== Gruben-Tod ===');
contextVars.Unbesiegbar = 0; // Respawn-Schutz aus
const lebenVorher = Number(contextVars.Leben);
mario.x = 31.5; mario.y = 25; mario.velocityY = 0.3; // unter Welt-Boden (Luecke)
simFrames(1);
await new Promise(r => setTimeout(r, 0));
check('Leben-1', contextVars.Leben === lebenVorher - 1, `=${contextVars.Leben}`);
check('Respawn: Mario.x=3', mario.x === 3, `x=${mario.x}`);
check('Unbesiegbar=1', contextVars.Unbesiegbar === 1, `=${contextVars.Unbesiegbar}`);

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
process.exit(failed ? 1 : 0);
