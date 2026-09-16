/**
 * Headless-Simulation: PuzzleNeu.json — Galerie -> Splitter Fluss.
 * Simuliert die Stage-Maschine der Runtime (wie scripts/test_puzzle.ts):
 *  - Blueprint-Objekte/-Variablen bleiben ueber Stage-Wechsel erhalten (Cache).
 *  - Die 'main'-Stage wird auf FREMDEN Stages gecacht eingemischt,
 *    auf sich selbst aber FRISCH hydratisiert — darum muss SplitterInit
 *    das gewaehlte Bild beim Betreten der HauptStage anwenden.
 *  - Standard-Stage-Objekte werden bei jedem Betreten frisch hydratisiert.
 * Ausfuehren: npx tsx tests/puzzle_neu_flow.test.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
(globalThis as any).window ??= { addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } };
(globalThis as any).document ??= {
    createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {} }),
    querySelector: () => null,
    getElementById: () => null,
    head: { appendChild() {} },
    body: { appendChild() {}, style: {} },
    documentElement: { style: {} },
};

import { readFileSync } from 'node:fs';
import { actionRegistry } from '../src/runtime/ActionRegistry';
import { registerStandardActions } from '../src/runtime/actions/StandardActions';
import { TaskConditionEvaluator } from '../src/runtime/executor/TaskConditionEvaluator';
registerStandardActions();

const project = JSON.parse(readFileSync(new URL('../game-server/public/projects/PuzzleNeu.json', import.meta.url), 'utf8'));
const bpStage = project.stages.find((s: any) => s.type === 'blueprint');
const mainStage = project.stages.find((s: any) => s.id === 'stage_main');
const stageById = (id: string) => project.stages.find((s: any) => s.id === id);

const objects: any[] = [];
let navPending: Promise<void> | null = null;
const hydrate = (def: any): any => {
    const o: any = def.className === 'TStageController'
        ? { ...def, setStages() {}, setOnStageChangeCallback() {}, setCurrentStageId() {}, goToStage: (id: string) => { navPending = switchStage(id); } }
        : { ...def };
    objects.push(o);
    for (const c of def.children || []) hydrate(c);
    return o;
};
const hydrateInto = (defs: any[], arr: any[]) => { for (const d of defs) arr.push(Object.assign({}, d)); };

const bpObjs: any[] = [];
for (const def of bpStage.objects || []) {
    const o: any = def.className === 'TStageController'
        ? { ...def, setStages() {}, setOnStageChangeCallback() {}, setCurrentStageId() {}, goToStage: (id: string) => { navPending = switchStage(id); } }
        : { ...def };
    bpObjs.push(o);
}
const mainCached: any[] = [];
hydrateInto(mainStage.objects || [], mainCached);
const bpVarObjs: any[] = (bpStage.variables || []).map((v: any) => ({ ...v, isVariable: true }));

const store: Record<string, any> = {};
for (const v of bpVarObjs) store[v.name] = v.value;
const contextVars: Record<string, any> = new Proxy(store, {
    get: (t, p) => t[String(p)],
    set: (t, p, val) => {
        const d = bpVarObjs.find(v => v.name === p);
        if (d && 'value' in d) d.value = val;
        t[String(p)] = val;
        return true;
    }
});

const nameMap: Record<string, any> = {};
const rebuildNameMap = () => {
    for (const k of Object.keys(nameMap)) delete nameMap[k];
    for (const o of objects) if (o.name) nameMap[o.name] = o;
};
let tasksByName = new Map<string, any>();
const rebuildTasks = (stage: any) => {
    tasksByName = new Map();
    for (const t of [...(bpStage.tasks || []), ...(project.tasks || []), ...(stage.tasks || [])]) tasksByName.set(t.name, t);
};
const context: any = { objects, vars: {}, contextVars, eventData: {} };

async function runSeq(seq: any[], vars: Record<string, any>): Promise<void> {
    for (const item of seq) {
        if (item.type === 'task') await runTask(item.name, vars);
        else if (item.type === 'condition') {
            const ok = TaskConditionEvaluator.evaluateCondition(item.condition, vars, contextVars);
            await runSeq(ok ? item.then : (item.else || []), vars);
        } else if (item.type) {
            const handler = actionRegistry.getHandler(item.type);
            assert.ok(handler, `kein Handler fuer ${item.type}`);
            await handler(item, { ...context, vars, eventData: vars.eventData });
        }
    }
}
async function runTask(name: string, baseVars?: Record<string, any>): Promise<void> {
    const t = tasksByName.get(name);
    assert.ok(t, `Task ${name} fehlt`);
    await runSeq(t.actionSequence, baseVars ?? Object.create(nameMap));
}
async function fireEvent(objName: string, eventName: string, data: any = {}): Promise<void> {
    const obj = objects.find(o => o.name === objName || o.id === objName);
    const taskName = obj?.events?.[eventName];
    assert.ok(taskName, `${objName}.${eventName} nicht verdrahtet`);
    const eventVars: Record<string, any> = Object.create(nameMap);
    Object.assign(eventVars, data);
    eventVars.eventData = data;
    eventVars.self = obj;
    eventVars.sender = obj;
    await runTask(taskName, eventVars);
}

let currentStageId = '';
async function switchStage(stageId: string): Promise<void> {
    const st = stageById(stageId);
    assert.ok(st, `Stage ${stageId} fehlt`);
    currentStageId = stageId;
    objects.length = 0;
    objects.push(...bpObjs, ...bpVarObjs);
    if (st.id === mainStage.id) {
        for (const def of mainStage.objects || []) hydrate(def);
    } else {
        objects.push(...mainCached);
        for (const def of st.objects || []) hydrate(def);
    }
    rebuildNameMap();
    rebuildTasks(st);
    for (const o of [...objects]) {
        if (o.events?.onStart) {
            const eventVars: Record<string, any> = Object.create(nameMap);
            eventVars.self = o; eventVars.sender = o; eventVars.eventData = {};
            await runTask(o.events.onStart, eventVars);
        }
    }
}
async function settle() { while (navPending) { const p = navPending; navPending = null; await p; } }

test('Galerie-Auswahl gelangt beim Betreten der HauptStage in den Bildaufteiler', async () => {
    // Start auf der Galerie: HauptStage-Objekte sind gecacht eingemischt und werden versteckt
    await switchStage('stage_galerie');
    assert.equal(currentStageId, 'stage_galerie');
    const cachedSplitter = objects.find(o => o.name === 'Bildaufteiler');
    assert.equal(cachedSplitter.visible, false, 'GalerieInit muss den eingemischten Splitter verstecken');
    assert.equal(contextVars.GewaehltesBild, '');

    // Kind waehlt ein Bild
    const pfad = `./images/memory Tierbilder für kleine Kinder/cat-5992580_640.png`;
    await fireEvent('Galerie', 'onSelectionChanged', { path: pfad, file: 'cat-5992580_640.png' });
    assert.equal(contextVars.GewaehltesBild, pfad, 'BildGewaehlt muss den Pfad in die Blueprint-Variable schreiben');

    // Bestaetigen -> HauptStage (frisch hydratisiert!) -> SplitterInit wendet das Bild an
    await fireEvent('BtnBildNehmen', 'onClick');
    await settle();
    assert.equal(currentStageId, 'stage_main');
    const splitter = objects.find(o => o.name === 'Bildaufteiler');
    assert.notEqual(splitter, cachedSplitter, 'HauptStage muss frisch hydratisiert sein');
    assert.equal(splitter.visible, true);
    assert.equal(splitter.imageSource, pfad, 'SplitterInit muss das gewaehlte Bild laden');
    assert.equal(objects.find(o => o.name === 'BtnBildAuswaehlen').visible, true);

    // Erneut in die Galerie und zurueck ohne neue Wahl -> Bild bleibt
    await fireEvent('BtnBildAuswaehlen', 'onClick');
    await settle();
    assert.equal(currentStageId, 'stage_galerie');
    assert.equal(objects.find(o => o.name === 'Bildaufteiler').visible, false);
    await fireEvent('BtnGalerieZurueck', 'onClick');
    await settle();
    assert.equal(currentStageId, 'stage_main');
    assert.equal(objects.find(o => o.name === 'Bildaufteiler').imageSource, pfad, 'Gewaehltes Bild bleibt nach leerem Galerie-Besuch erhalten');

    // Teiledaten duerfen von der Navigation unberuehrt bleiben
    const list = objects.find(o => o.name === 'PuzzleTeile');
    assert.equal(list.records.length, 25);
});
