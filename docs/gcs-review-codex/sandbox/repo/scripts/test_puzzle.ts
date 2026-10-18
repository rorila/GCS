/**
 * Headless-Simulation: Puzzle.json — Multi-Stage-Version.
 * Simuliert die Stage-Maschine der Runtime:
 *  - Blueprint- + Main-Objekte werden EINMAL hydratisiert und bleiben
 *    ueber Stage-Wechsel erhalten (wie der Objekt-Cache der Runtime).
 *  - Standard-Stage-Objekte werden bei jedem Betreten frisch hydratisiert.
 *  - navigate_stage -> TStageController.goToStage -> Stage-Wechsel +
 *    onStart auf allen Objekten (wie handleStageChange).
 * Ausfuehren: npx tsx scripts/test_puzzle.ts
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
registerStandardActions();
import { TSprite } from '../src/components/TSprite';
import { TObjectList } from '../src/components/TObjectList';

const project = JSON.parse(readFileSync(join(__dirname, '../game-server/public/projects/Puzzle.json'), 'utf8'));
const bpStage = project.stages.find((s: any) => s.type === 'blueprint');
const menuStage = project.stages.find((s: any) => s.type === 'main'); // Menue = HauptStage
const stageById = (id: string) => project.stages.find((s: any) => s.id === id);

// ─── Objekte instanziieren ───
const objects: any[] = [];
const hydrateInto = (def: any, arr: any[]): any => {
    let o: any;
    if (def.className === 'TSprite') {
        o = new TSprite(def.name, def.x ?? 0, def.y ?? 0, def.width ?? 1, def.height ?? 1);
        Object.assign(o, def);
        o.events = def.events || {};
    } else if (def.className === 'TObjectList') {
        o = new TObjectList(def.name, def.x ?? 0, def.y ?? 0);
        Object.assign(o, def);
    } else if (def.className === 'TStageController') {
        // Stub: goToStage loest den Harness-Stage-Wechsel aus
        o = {
            ...def,
            setStages() {}, setOnStageChangeCallback() {}, setCurrentStageId() {},
            goToStage: (id: string) => { navPending = switchStage(id); },
        };
    } else {
        o = { ...def };
    }
    arr.push(o);
    for (const c of def.children || []) hydrateInto(c, arr);
    return o;
};

// Blueprint-Objekte: einmalig hydratisiert, persistent (Cache-Verhalten).
// Menue = HauptStage: ihre Objekte werden auf ANDEREN Stages als Cache
// gemergt; auf der Menue-Stage selbst werden sie frisch hydratisiert.
const bpObjs: any[] = [];
for (const def of bpStage.objects || []) hydrateInto(def, bpObjs);
const menuCached: any[] = [];
for (const def of menuStage.objects || []) hydrateInto(def, menuCached);

// ─── Variablen-Store (Live-Referenzen, persistent) ───
const definitions = new Map<string, any>();
const registerDef = (d: any) => { if (d?.name) { definitions.set(d.name, d); if (d.id) definitions.set(d.id, d); } };
const bpVarObjs: any[] = [];
for (const vv of bpStage.variables || []) {
    const vo = { ...vv, isVariable: true };
    bpVarObjs.push(vo);
    registerDef(vo);
}

const store: Record<string, any> = {};
for (const vv of bpVarObjs) {
    store[vv.name] = vv.initialValue !== undefined ? vv.initialValue : vv.value;
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
const rebuildNameMap = () => {
    for (const k of Object.keys(nameMap)) delete nameMap[k];
    for (const o of objects) if (o.name) nameMap[o.name] = o;
};

// Gemeinsame Tasks: Blueprint-Tasks + Tasks der aktiven Stage (Stage-Tasks
// ueberschreiben gleichnamige — wie getMergedStageData).
let tasksByName = new Map<string, any>();
const rebuildTasks = (stage: any) => {
    tasksByName = new Map();
    for (const t of [...(bpStage.tasks || []), ...(project.tasks || []), ...(stage.tasks || [])]) {
        tasksByName.set(t.name, t);
    }
};

const context: any = { objects, vars: {}, contextVars, eventData: {} };

async function runSeq(seq: any[], vars: Record<string, any>, depth = 0): Promise<void> {
    for (const item of seq) {
        if (item.type === 'task') await runTask(item.name, vars, depth + 1);
        else if (item.type === 'condition') {
            const ok = TaskConditionEvaluator.evaluateCondition(item.condition, vars, contextVars);
            await runSeq(ok ? item.then : (item.else || []), vars, depth);
        } else if (item.type === 'foreach' || item.type === 'for' || item.type === 'while') {
            const execBody = async (body: any[], _v: any, _g: any, _c: any, d: number) => { await runSeq(body, vars, d); };
            if (item.type === 'foreach') await TaskLoopHandler.handleForeach(item, vars, contextVars, null, depth, undefined, execBody, objects);
            else if (item.type === 'for') await TaskLoopHandler.handleFor(item, vars, contextVars, null, depth, undefined, execBody, objects);
            else await TaskLoopHandler.handleWhile(item, vars, contextVars, null, depth, undefined, execBody, objects);
        } else if (item.type) {
            await runAction(item, vars);
        }
    }
}
async function runAction(a: any, vars: Record<string, any>): Promise<void> {
    if (!a) return;
    const handler = actionRegistry.getHandler(a.type);
    if (!handler) { console.log(`  !! kein Handler fuer ${a.type}`); return; }
    await handler(a, { ...context, vars, eventData: vars.eventData });
}
async function runTask(name: string, baseVars?: Record<string, any>, depth = 0): Promise<void> {
    const t = tasksByName.get(name);
    if (!t) { console.log(`  !! Task ${name} fehlt`); return; }
    await runSeq(t.actionSequence, baseVars ?? Object.create(nameMap), depth);
}
async function fireEvent(objName: string, eventName: string, data: any = {}): Promise<void> {
    const obj = objects.find(o => o.name === objName || o.id === objName);
    const taskName = obj?.events?.[eventName];
    if (!taskName) { console.log(`  !! ${objName}.${eventName} nicht verdrahtet`); return; }
    const eventVars: Record<string, any> = Object.create(nameMap);
    Object.assign(eventVars, data);
    eventVars.eventData = data;
    eventVars.self = obj;
    eventVars.sender = obj;
    await runTask(taskName, eventVars);
}

// ─── Stage-Wechsel (simuliert RuntimeStageService.handleStageChange) ───
let currentStageId = '';
let navPending: Promise<void> | null = null;

async function switchStage(stageId: string): Promise<void> {
    const st = stageById(stageId);
    if (!st) { console.log(`  !! Stage ${stageId} fehlt`); return; }
    currentStageId = stageId;

    // Blueprint bleibt erhalten; Menue-Objekte auf fremden Stages gecacht,
    // auf der Menue-Stage selbst frisch; Level-Objekte immer frisch.
    objects.length = 0;
    objects.push(...bpObjs, ...bpVarObjs);
    if (st.id === menuStage.id) {
        for (const def of menuStage.objects || []) hydrateInto(def, objects);
    } else {
        objects.push(...menuCached);
        for (const def of st.objects || []) hydrateInto(def, objects);
    }
    for (const o of objects.filter(o => o.className === 'TObjectList')) o.initRuntime({ objects });
    rebuildNameMap();
    rebuildTasks(st);

    // onStart auf allen Objekten — wie handleStageChange / initMainGame
    for (const o of [...objects]) {
        const taskName = o.events?.onStart;
        if (taskName) {
            const eventVars: Record<string, any> = Object.create(nameMap);
            eventVars.self = o; eventVars.sender = o; eventVars.eventData = {};
            await runTask(taskName, eventVars);
        }
    }
}
async function settle() { while (navPending) { const p = navPending; navPending = null; await p; } }

let passed = 0, failed = 0;
const check = (name: string, ok: boolean, extra = '') => {
    if (ok) { passed++; console.log(`  ✓ ${name}`); }
    else { failed++; console.log(`  ✗ ${name} ${extra}`); }
};

// Echter Browser-Ablauf: onDragStart am Teil (schreibt dataTransfer/sourceId),
// onDrop auf dem Slot, danach onDragEnd am Teil (verbraucht das DropAufSlot-Flag).
async function dropOn(slotName: string, teilName: string, teilId: string, x = 30, y = 12) {
    await fireEvent(teilName, 'onDragStart', { x: 5, y: 5 });
    await fireEvent(slotName, 'onDrop', { sourceId: teilId, x, y });
    await fireEvent(teilName, 'onDragEnd', { x, y });
}

const pl = () => objects.find(o => o.name === 'PuzzleListe') as TObjectList;
const sl = () => objects.find(o => o.name === 'SlotListe') as TObjectList;
const teil = (s: number, i: number) => objects.find(o => o.id === `pz_t${s}_${i}`);
const slot = (s: number, i: number) => objects.find(o => o.id === `pz_s${s}_${i}`);
const prec = (s: number, i: number) => pl().recordData[`pz_t${s}_${i}`];
const srec = (s: number, i: number) => sl().recordData[`pz_s${s}_${i}`];

// ─── Initial laden: aktive Stage = Menue ───
await switchStage(project.activeStageId);

console.log('=== Projekt-Grundlagen ===');
check('5 Stages vorhanden', project.stages.length === 5, `=${project.stages.length}`);
check('Start auf Menue-Stage', currentStageId === 'stage_menue', `=${currentStageId}`);
check('Menue sichtbar', nameMap['OverlayStart'].visible !== false && nameMap['BtnStart1'].visible !== false, '');
check('Status=menu (via OverlayStart.onStart -> MenueInit)', contextVars.Status === 'menu', `=${contextVars.Status}`);
check('Level-HUD im Menue versteckt', nameMap['LblFortschritt'].visible === false && nameMap['BtnNeu'].visible === false, '');
check('Gewinn-Overlay (Blueprint) versteckt', nameMap['OverlayGewinn'].visible === false && nameMap['BtnNochmal'].visible === false, '');
check('Keine Puzzleteile auf der Menue-Stage', teil(1, 0) === undefined && pl() === undefined, '');
check('KonturRegler ist TSlider (Blueprint-Chassis)', nameMap['KonturRegler']?.className === 'TSlider', '');

console.log('=== Navigation: Menue -> Stufe 1 (3x2) ===');
await fireEvent('BtnStart1', 'onClick');
await settle();
check('Auf stage_einfach gewechselt', currentStageId === 'stage_einfach', `=${currentStageId}`);
check('Status=playing (via LevelInit.onStart -> LevelStarten)', contextVars.Status === 'playing', `=${contextVars.Status}`);
check('NLevel=6', contextVars.NLevel === 6, `=${contextVars.NLevel}`);
check('PuzzleListe hat nur 6 Teile', pl().items.length === 6, `=${pl().items.length}`);
check('SlotListe hat nur 6 Slots', sl().items.length === 6, `=${sl().items.length}`);
check('6 Teile sichtbar', [0, 1, 2, 3, 4, 5].every(i => teil(1, i)?.visible === true));
check('6 Slots sichtbar, Opacity=KonturA', [0, 1, 2, 3, 4, 5].every(i => slot(1, i)?.visible === true) && Math.abs(slot(1, 0).style.opacity - 0.6) < 0.01, `op=${slot(1, 0).style.opacity}`);
check('Level-HUD sichtbar', nameMap['LblFortschritt'].visible === true && nameMap['BtnNeu'].visible === true, '');
check('Menue-Objekte auf Level versteckt (gecacht gemergt)', nameMap['OverlayStart'].visible === false && nameMap['BtnStart1'].visible === false, '');
const dec = (s: any) => decodeURIComponent(String(s ?? ''));
check('Slot hat Kontur + Gruen-Variante', dec(srec(1, 0).normal).includes('<svg') && dec(srec(1, 0).gruen).includes('#2ecc60'), '');
check('Teil hat onDragStart verdrahtet (sonst leere sourceId!)', teil(1, 0).events?.onDragStart === 'TeilGenommen', '');

console.log('=== Falscher Drop -> Ruecksprung ===');
const p1 = teil(1, 1);
const h1 = { x: prec(1, 1).heimX, y: prec(1, 1).heimY };
await dropOn('Slot_1_2', 'Teil_1_1', 'pz_t1_1');
check('Falsches Teil zurueck an Heim', Math.abs(p1.x - h1.x) < 0.01 && Math.abs(p1.y - h1.y) < 0.01, `=(${p1.x},${p1.y}) heim=(${h1.x},${h1.y})`);
check('Nicht platziert, Slot frei', prec(1, 1).platziert === 0 && srec(1, 2).gefuellt === 0);

console.log('=== Parken per DragEnd ===');
await fireEvent('Teil_1_1', 'onDragEnd', { x: 10, y: 8 });
check('Teil zentriert am Zeiger', Math.abs(p1.x - 6.8) < 0.01 && Math.abs(p1.y - 4.8) < 0.01, `=(${p1.x},${p1.y})`);
check('Heim-Position aktualisiert', Math.abs(prec(1, 1).heimX - 6.8) < 0.01 && Math.abs(prec(1, 1).heimY - 4.8) < 0.01, `heim=(${prec(1, 1).heimX},${prec(1, 1).heimY})`);

console.log('=== Richtiger Drop -> einrasten + gruene Kontur ===');
await dropOn('Slot_1_1', 'Teil_1_1', 'pz_t1_1');
check('Teil eingerastet', Math.abs(p1.x - srec(1, 1).sx) < 0.01 && Math.abs(p1.y - srec(1, 1).sy) < 0.01, `=(${p1.x},${p1.y})`);
check('platziert=1, Slot gefuellt', prec(1, 1).platziert === 1 && srec(1, 1).gefuellt === 1);
check('Kontur gruen + voll sichtbar', slot(1, 1).backgroundImage === srec(1, 1).gruen && Number(slot(1, 1).style.opacity) === 1, `op=${slot(1, 1).style.opacity}`);
check('Fertig=1', contextVars.Fertig === 1, `=${contextVars.Fertig}`);
await fireEvent('Teil_1_1', 'onDragEnd', { x: 4, y: 4 });
check('Platziertes Teil bleibt liegen', Math.abs(p1.x - srec(1, 1).sx) < 0.01, `x=${p1.x}`);

console.log('=== Slider: Kontur-Transparenz ===');
await fireEvent('KonturRegler', 'onChange', { value: 20 });
check('KonturA=0.2', Math.abs(contextVars.KonturA - 0.2) < 0.001, `=${contextVars.KonturA}`);
check('Freie Kontur auf 0.2', Math.abs(Number(slot(1, 0).style.opacity) - 0.2) < 0.001, `=${slot(1, 0).style.opacity}`);
check('Geloeste Kontur bleibt 1', Number(slot(1, 1).style.opacity) === 1, `=${slot(1, 1).style.opacity}`);

console.log('=== Motivwechsel im Level ===');
await fireEvent('BtnMotiv2', 'onClick');
check('MotivNr=2', contextVars.MotivNr === 2);
check('Aktives Teil zeigt Bild 2', teil(1, 0).backgroundImage === prec(1, 0).b2, '');

console.log('=== Restliche Teile legen -> Gewonnen ===');
for (const i of [0, 2, 3, 4, 5]) {
    await dropOn(`Slot_1_${i}`, `Teil_1_${i}`, `pz_t1_${i}`);
}
check('Alle platziert', [0, 1, 2, 3, 4, 5].every(i => prec(1, i).platziert === 1));
check('Status=won', contextVars.Status === 'won', `=${contextVars.Status}`);
check('Gewinn-Overlay sichtbar (Panel + Mitglieder)', nameMap['OverlayGewinn'].visible === true && nameMap['BtnNochmal'].visible === true && nameMap['LblGewinn'].visible === true, '');

console.log('=== Nochmal-Replay auf derselben Stage ===');
await fireEvent('BtnNochmal', 'onClick');
check('Status wieder playing', contextVars.Status === 'playing', `=${contextVars.Status}`);
check('Fertig=0, Teile zurueck an Heim', contextVars.Fertig === 0 && prec(1, 0).platziert === 0 && Math.abs(teil(1, 0).x - prec(1, 0).heimX) < 0.01, '');

console.log('=== Zurueck ins Menue ===');
await fireEvent('BtnNeu', 'onClick');
await settle();
check('Wieder auf stage_menue', currentStageId === 'stage_menue', `=${currentStageId}`);
check('Status=menu', contextVars.Status === 'menu', `=${contextVars.Status}`);
check('Menue sichtbar (frisch hydratisiert)', nameMap['OverlayStart'].visible !== false, '');
check('Gewinn-Overlay wieder versteckt', nameMap['OverlayGewinn'].visible === false, '');
check('Motiv-Wahl blieb erhalten (Blueprint-Variable)', contextVars.MotivNr === 2, `=${contextVars.MotivNr}`);

console.log('=== Navigation: Menue -> Stufe 3 (6x4, Jigsaw + Rotation) ===');
await fireEvent('BtnStart3', 'onClick');
await settle();
check('Auf stage_schwer gewechselt', currentStageId === 'stage_schwer', `=${currentStageId}`);
check('NLevel=24, RotModus=1', contextVars.NLevel === 24 && contextVars.RotModus === 1);
check('PuzzleListe hat 24 Teile', pl().items.length === 24, `=${pl().items.length}`);
check('Stufe-1-Teile existieren hier nicht', teil(1, 0) === undefined, '');
check('Teil hat Jigsaw-SVG', dec(prec(3, 5).b1).includes('clipPath') && dec(prec(3, 5).b1).includes('C '), '');

// Rotation erzwingen: Teil 5 auf 90 Grad -> Drop muss scheitern
await runAction({ type: 'record_set', list: 'PuzzleListe', target: 'pz_t3_5', field: 'rot', value: '90' }, {});
await dropOn('Slot_3_5', 'Teil_3_5', 'pz_t3_5');
check('Falsch gedreht -> zurueck', prec(3, 5).platziert === 0 && Math.abs(teil(3, 5).x - prec(3, 5).heimX) < 0.01, `x=${teil(3, 5).x} heim=${prec(3, 5).heimX}`);

// Drehen per Klick: 270 -> 0
await runAction({ type: 'record_set', list: 'PuzzleListe', target: 'pz_t3_5', field: 'rot', value: '270' }, {});
await fireEvent('Teil_3_5', 'onClick');
check('Klick dreht 270->0', prec(3, 5).rot === 0 && teil(3, 5).rotation === 0, `rot=${prec(3, 5).rot} r=${teil(3, 5).rotation}`);
await dropOn('Slot_3_5', 'Teil_3_5', 'pz_t3_5');
check('Richtig gedreht -> eingerastet', prec(3, 5).platziert === 1 && srec(3, 5).gefuellt === 1);

console.log('=== Touch-Pfad (Tablet) ===');
const t0 = teil(3, 0), s0 = srec(3, 0);
await runAction({ type: 'record_set', list: 'PuzzleListe', target: 'pz_t3_0', field: 'rot', value: '0' }, {});
await fireEvent('Teil_3_0', 'onTouchStart', { x: t0.x + 2, y: t0.y + 2 });
await fireEvent('Teil_3_0', 'onTouchMove', { x: s0.sx + 2.2, y: s0.sy + 2.1 });
check('Touch bewegt Teil live', Math.abs(t0.x - (s0.sx + 0.2)) < 0.01 && Math.abs(t0.y - (s0.sy + 0.1)) < 0.01, `=(${t0.x},${t0.y})`);
await fireEvent('Teil_3_0', 'onTouchEnd', { x: s0.sx + 2.2, y: s0.sy + 2.1 });
check('Touch-Drop rastet ein', prec(3, 0).platziert === 1 && Math.abs(t0.x - s0.sx) < 0.01, `=(${t0.x},${t0.y})`);
check('Touch-Slot gruen', slot(3, 0).backgroundImage === s0.gruen, '');

// Touch ohne Treffer -> parken
const t2 = teil(3, 2);
await runAction({ type: 'record_set', list: 'PuzzleListe', target: 'pz_t3_2', field: 'rot', value: '0' }, {});
await fireEvent('Teil_3_2', 'onTouchStart', { x: t2.x + 1, y: t2.y + 1 });
await fireEvent('Teil_3_2', 'onTouchMove', { x: 5, y: 17 });
await fireEvent('Teil_3_2', 'onTouchEnd', { x: 5, y: 17 });
check('Touch-Parken aktualisiert Heim', prec(3, 2).platziert === 0 && Math.abs(prec(3, 2).heimX - t2.x) < 0.01, `heim=${prec(3, 2).heimX} x=${t2.x}`);

console.log('=== Escape -> Menue ===');
await fireEvent('Tastatur', 'onKeyDown_Escape');
await settle();
check('Zurueck auf stage_menue', currentStageId === 'stage_menue', `=${currentStageId}`);
check('Status=menu', contextVars.Status === 'menu', `=${contextVars.Status}`);

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
process.exit(failed ? 1 : 0);
