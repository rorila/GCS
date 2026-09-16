/**
 * Headless-Simulation: Mine2D.json — Blockwelt aus TGridBoard, Grid-Physik
 * via call_method getCell/setCell, Mobs aus TSpriteTemplates (record-getrieben
 * ueber MobListe/TObjectList), Inventar via record_get/record_set (Rucksack).
 * Ausfuehren: npx tsx scripts/test_mine2d.ts
 */
(globalThis as any).window ??= { addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } };
(globalThis as any).document ??= {
    createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {} }),
    querySelector: () => null,
    getElementById: () => null,
    head: { appendChild() {} },
    body: { appendChild() {}, style: {} },
    documentElement: { style: {} },
};

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
import { actionRegistry } from '../src/runtime/ActionRegistry';
import { registerStandardActions } from '../src/runtime/actions/StandardActions';
import { TaskLoopHandler } from '../src/runtime/executor/TaskLoopHandler';
import { TaskConditionEvaluator } from '../src/runtime/executor/TaskConditionEvaluator';
import { CollisionManager } from '../src/runtime/CollisionManager';
import { SpritePool } from '../src/runtime/SpritePool';
registerStandardActions();
import { TSprite } from '../src/components/TSprite';
import { TSpriteTemplate } from '../src/components/TSpriteTemplate';
import { TGridBoard } from '../src/components/TGridBoard';
import { TObjectList } from '../src/components/TObjectList';

const project = JSON.parse(readFileSync(join(__dirname, '../game-server/public/projects/Mine2D.json'), 'utf8'));
const bp = project.stages[0], main = project.stages[1];

// ─── Objekte instanziieren (Welt-Kinder rekursiv) ───
const objects: any[] = [];
const panels: any[] = [];
const hydrate = (def: any, parentId?: string): any => {
    let o: any;
    if (def.className === 'TSprite' || def.className === 'TSpriteTemplate') {
        const Klass = def.className === 'TSpriteTemplate' ? TSpriteTemplate : TSprite;
        o = new Klass(def.name, def.x ?? 0, def.y ?? 0, def.width ?? 1, def.height ?? 1);
        Object.assign(o, def);
        o.events = def.events || {};
    } else if (def.className === 'TGridBoard') {
        o = new TGridBoard(def.name, def.x ?? 0, def.y ?? 0, def.width ?? 1, def.height ?? 1);
        Object.assign(o, def);
        o.initRuntime({ render: () => {}, handleEvent: () => {} });
    } else if (def.className === 'TObjectList') {
        o = new TObjectList(def.name, def.x ?? 0, def.y ?? 0);
        Object.assign(o, def);
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

// TObjectLists: rebuildData (wie initRuntime in Produktion)
for (const o of objects.filter(o => o.className === 'TObjectList')) {
    o.initRuntime({ objects });
}

// ─── SpritePools ───
const pool = new SpritePool();
for (const t of objects.filter(o => o.className === 'TSpriteTemplate')) {
    pool.init(t as TSpriteTemplate, objects, {});
}

// ─── Variablen-Store ───
const definitions = new Map<string, any>();
const registerDef = (d: any) => { if (d?.name) { definitions.set(d.name, d); if (d.id) definitions.set(d.id, d); } };
for (const vv of [...(bp.variables || []), ...(main.variables || [])]) registerDef(vv);
for (const o of objects) if (o.isVariable || o.className?.includes('Variable')) registerDef(o);

const store: Record<string, any> = {};
for (const vv of bp.variables) {
    const init = vv.initialValue !== undefined ? vv.initialValue : vv.value;
    store[vv.name] = init;
    // WICHTIG: die Definition selbst pushen (keine Kopie!) — nameMap['Status']
    // muss live mit contextVars.Status synchron bleiben, sonst lesen
    // Bedingungen ueber den Prototype den veralteten .value ('ready').
    objects.push(definitions.get(vv.name));
}
const normKey = (p: any) => definitions.get(String(p))?.name ?? String(p);
const contextVars: Record<string, any> = new Proxy(store, {
    get: (t, p) => t[normKey(p)],
    set: (t, p, val) => {
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

const context: any = {
    objects, vars: {}, contextVars, eventData: {},
    spawnObject: (templateId: string, x?: number, y?: number) => {
        const template = objects.find(o => o.id === templateId || o.name === templateId);
        if (!template) { console.log(`  !! Template ${templateId} nicht gefunden`); return null; }
        return pool.acquire(template.id, x ?? template.x, y ?? template.y, template as TSpriteTemplate);
    },
    destroyObject: (instanceId: string) => {
        if (!pool.release(instanceId)) pool.releaseByName(instanceId);
    },
};

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
        } else if (item.type) {
            await runAction(actionsByName.get(item.name) ?? item, vars);
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

// ─── Physik ───
const sprites: TSprite[] = objects.filter(o => o.className === 'TSprite') as TSprite[];
const cm = new CollisionManager();
cm.configure(project.stage?.grid ?? null, 'event-only',
    (spriteId: string, eventName: string, data?: any) => {
        const obj = objects.find(o => o.id === spriteId);
        if (obj) fireEvent(obj.name, eventName, data);
    });
const bounds = { width: 140, height: 30, offsetTop: 0, offsetBottom: 0 };
const DT = 1 / 60;
async function simFrames(n: number, mitFrame = true) {
    for (let i = 0; i < n; i++) {
        for (const s of sprites) { if (s.visible) s.update(DT, true); }
        cm.checkCollisions(sprites, panels);
        if (mitFrame) await runTask('Frame');
    }
}

let passed = 0, failed = 0;
const check = (name: string, ok: boolean, extra = '') => {
    if (ok) { passed++; console.log(`  ✓ ${name}`); }
    else { failed++; console.log(`  ✗ ${name} ${extra}`); }
};

const steve = objects.find(o => o.name === 'Steve');
const bloecke = objects.find(o => o.name === 'Bloecke') as TGridBoard;
const welt = objects.find(o => o.name === 'Welt');
const rucksack = objects.find(o => o.name === 'Rucksack') as TObjectList;
const mobListe = objects.find(o => o.name === 'MobListe') as TObjectList;
const nacht = objects.find(o => o.name === 'NachtPanel');

console.log('=== SpielInit via Welt.onStart ===');
await fireEvent('Welt', 'onStart');
check('Steve am Spawn (x=8, y=12.1)', Math.abs(steve.x - 8) < 0.01 && Math.abs(steve.y - 12.1) < 0.01, `=(${steve.x},${steve.y})`);
check('Schwerkraft noch aus', steve.gravity === 0, `=${steve.gravity}`);

console.log('=== Ready: Steve faellt nicht ===');
await simFrames(120, false);
check('Steve steht noch (y=12.1)', Math.abs(steve.y - 12.1) < 0.01, `y=${steve.y}`);
check('Status noch ready', contextVars.Status === 'ready', `=${contextVars.Status}`);

console.log('=== SpielStarten ===');
await runTask('SpielStarten');
check('Status=playing', contextVars.Status === 'playing', `=${contextVars.Status}`);
check('Schwerkraft an', steve.gravity === 1.5, `=${steve.gravity}`);
check('10 Mob-Instanzen aktiv', pool.getActiveInstances().length === 10, `=${pool.getActiveInstances().length}`);
check('Mob erbt parentId=Welt', objects.find(o => o.name === 'TplZombie_pool_0')?.parentId === 'stage_main_Welt');

console.log('=== Stehen auf Gras (Grid-Physik) ===');
await simFrames(90);
check('Steve steht (y≈12.1)', Math.abs(steve.y - 12.1) < 0.05, `y=${steve.y.toFixed(3)}`);
check('vy=0 (kein Aufschaukeln)', Math.abs(steve.velocityY) < 1e-9, `vy=${steve.velocityY}`);
check('AmBoden gesetzt', contextVars.AmBoden === 1 || contextVars.AmBoden === true, `=${contextVars.AmBoden}`);
const y0 = steve.y;
await simFrames(60);
check('Stabil: kein Sinken', Math.abs(steve.y - y0) < 0.01, `y=${steve.y.toFixed(3)}`);

console.log('=== Laufen + Kamera (x UND y) ===');
await runTask('RechtsDruck');
await simFrames(120);
check('Steve laeuft nach rechts', steve.x > 10, `x=${steve.x.toFixed(2)}`);
check('Welt scrollt horizontal', welt.x < 0, `Welt.x=${welt.x.toFixed(2)}`);
check('Welt scrollt vertikal', welt.y < 0, `Welt.y=${welt.y.toFixed(2)}`);
await runTask('RechtsLos');

console.log('=== Sprung (1 Block + Puffer) ===');
// Freie Spalte suchen: 3 Luftzeilen ueber festem Boden (Baeume/Hoehlen meiden)
let sx = 8;
for (let x = 3; x < 25; x++) {
    if (bloecke.getCell(x, 11) === 0 && bloecke.getCell(x, 12) === 0 && bloecke.getCell(x, 13) === 0
        && bloecke.getCell(x, 14) >= 1 && bloecke.getCell(x, 14) <= 9) { sx = x; break; }
}
steve.x = sx + 0.05; steve.y = 12.1; steve.velocityX = 0; steve.velocityY = 0;
await simFrames(10); // settle -> AmBoden=1
await runTask('SprungOderStart');
check('Sprung-Impuls', steve.velocityY < 0, `vy=${steve.velocityY}`);
let maxH = 0;
for (let i = 0; i < 90; i++) {
    for (const s of sprites) { if (s.visible) s.update(DT, true); }
    await runTask('Frame');
    maxH = Math.max(maxH, (14 - (steve.y + steve.height)));
}
check('Sprunghoehe 0.8-3.0 Zellen', maxH > 0.8 && maxH < 3.0, `maxH=${maxH.toFixed(2)}`);

console.log('=== Abbauen (onCellClick) ===');
steve.x = 8; steve.y = 12.1; steve.velocityX = 0; steve.velocityY = 0; // in Grab-Reichweite
const grasZelle = { x: 8, y: 14 };
await fireEvent('Bloecke', 'onCellClick', { x: grasZelle.x, y: grasZelle.y, value: bloecke.getCell(grasZelle.x, grasZelle.y) });
check('Gras abgebaut (Zelle=0)', bloecke.getCell(8, 14) === 0, `=${bloecke.getCell(8, 14)}`);
check('Rucksack: Gras +1', rucksack.recordData?.['Gras']?.anzahl === 1, `=${rucksack.recordData?.['Gras']?.anzahl}`);

console.log('=== Abbauen: Bedrock + Reichweite ===');
await fireEvent('Bloecke', 'onCellClick', { x: 8, y: 29, value: bloecke.getCell(8, 29) });
check('Bedrock bleibt', bloecke.getCell(8, 29) === 10, `=${bloecke.getCell(8, 29)}`);
await fireEvent('Bloecke', 'onCellClick', { x: 30, y: 14, value: bloecke.getCell(30, 14) });
check('Ausser Reichweite ignoriert', bloecke.getCell(30, 14) !== 0, `=${bloecke.getCell(30, 14)}`);

console.log('=== Setzen ===');
contextVars.Ausgewaehlt = 1; // Gras (Bestand=1)
await fireEvent('Bloecke', 'onCellClick', { x: 9, y: 13, value: bloecke.getCell(9, 13) });
check('Gras gesetzt', bloecke.getCell(9, 13) === 1, `=${bloecke.getCell(9, 13)}`);
check('Rucksack: Gras -1', rucksack.recordData?.['Gras']?.anzahl === 0, `=${rucksack.recordData?.['Gras']?.anzahl}`);
contextVars.Ausgewaehlt = 3; // Stein (Bestand=0)
await fireEvent('Bloecke', 'onCellClick', { x: 10, y: 13, value: bloecke.getCell(10, 13) });
check('Ohne Bestand nicht gesetzt', bloecke.getCell(10, 13) === 0, `=${bloecke.getCell(10, 13)}`);

console.log('=== MobTakt: Zombie steuert + Physik ===');
const zRec = Object.values(mobListe.recordData).find((r: any) => r.tpl === 'TplZombie' && r.n === 0) as any;
const zInst = objects.find(o => o.name === 'TplZombie_pool_0');
const zX0 = zRec.x; const zY0 = zRec.y;
await runTask('MobTakt');
check('Zombie-Record bewegt sich', zRec.x !== zX0 || zRec.y !== zY0, `x=${zRec.x} y=${zRec.y}`);
check('Zombie-Instanz synchronisiert', Math.abs(zInst.x - zRec.x) < 0.001, `inst=${zInst.x} rec=${zRec.x}`);
check('Zombie laeuft auf Steve zu (dir=-1)', zRec.dir === -1, `dir=${zRec.dir}`);
const zBoden = bloecke.getCell(Math.floor(zRec.x + 0.45), Math.floor(zRec.y + zRec.h));
check('Zombie steht auf festem Boden', zBoden !== 0 && zBoden !== 11 && zBoden !== 12, `z=${zBoden}`);

console.log('=== Zombie-Schaden + Stomp ===');
const lebenVorher = Number(contextVars.Leben);
await fireEvent('TplZombie_pool_0', 'onCollision', { other: 'Steve', hitSide: 'left', self: zInst });
check('Leben-1', contextVars.Leben === lebenVorher - 1, `=${contextVars.Leben}`);
check('Unbesiegbar=1', contextVars.Unbesiegbar === 1, `=${contextVars.Unbesiegbar}`);
await fireEvent('TplZombie_pool_1', 'onCollision', { other: 'Steve', hitSide: 'top', self: objects.find(o => o.name === 'TplZombie_pool_1') });
check('Stomp released Zombie', !objects.find(o => o.name === 'TplZombie_pool_1')?.visible, '');

console.log('=== Creeper-Explosion ===');
// Creeper per record_set neben Steve (aktualisiert recordData + rebuilt data)
const cId = mobListe.items.find((id: string) => mobListe.recordData[id]?.tpl === 'TplCreeper' && mobListe.recordData[id]?.n === 0);
await runAction({ type: 'record_set', list: 'MobListe', target: cId, field: 'x', value: String(steve.x + 0.5) }, {});
await runAction({ type: 'record_set', list: 'MobListe', target: cId, field: 'y', value: String(steve.y) }, {});
const boomZelle = { x: 9, y: 13 }; // die zuvor gesetzte Gras-Zelle, liegt im 3x3-Radius
const zVor = bloecke.getCell(boomZelle.x, boomZelle.y);
await runTask('MobTakt');
await new Promise(r => setTimeout(r, 0));
const cInst = objects.find(o => o.name === 'TplCreeper_pool_0');
check('Creeper explodiert (released)', !cInst?.visible, `visible=${cInst?.visible}`);
check('Boom-Zelle geloescht', zVor === 1 && bloecke.getCell(boomZelle.x, boomZelle.y) === 0,
    `vorher=${zVor} nachher=${bloecke.getCell(boomZelle.x, boomZelle.y)}`);

console.log('=== Tag/Nacht ===');
await runTask('TagNacht');
check('Nacht=1', contextVars.Nacht === 1, `=${contextVars.Nacht}`);
check('NachtPanel sichtbar', nacht.visible === 1 || nacht.visible === true, `=${nacht.visible}`);
check('Himmel dunkel', bloecke.style.backgroundColor === '#0e1a3c', `=${bloecke.style.backgroundColor}`);

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
process.exit(failed ? 1 : 0);
