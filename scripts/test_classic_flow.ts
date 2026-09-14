/**
 * Headless-Simulation: Tetris_Classic.json Task-Flow mit echten Runtime-Actions.
 * Reproduziert den Editor-Lauf, um den Abbruch in SteinSpawnen zu finden.
 * Ausfuehren: npx tsx scripts/test_classic_flow.ts
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
registerStandardActions();
import { TGridBoard } from '../src/components/TGridBoard';
import { TListVariable } from '../src/components/TListVariable';
import { TStringMap } from '../src/components/TStringMap';

const project = JSON.parse(readFileSync(join(__dirname, '../game-server/public/projects/Tetris_Classic.json'), 'utf8'));
const bp = project.stages[0], main = project.stages[1];

// Objekte instanziieren
const objects: any[] = [];
for (const def of [...bp.objects, ...main.objects]) {
    if (def.className === 'TGridBoard') {
        const g = new TGridBoard();
        for (const k of ['name', 'id', 'cols', 'rows', 'palette', 'cells', 'gridLines'])
            if ((def as any)[k] !== undefined) (g as any)[k] = (def as any)[k];
        g.initRuntime({ render: () => {} });
        objects.push(g);
    } else if (def.className === 'TListVariable' || def.className === 'TStringMap') {
        const C = def.className === 'TListVariable' ? TListVariable : TStringMap;
        const o: any = new C();
        Object.assign(o, def);
        objects.push(o);
    } else {
        objects.push({ ...def }); // Timer, Labels, Buttons als Stubs
    }
}

// Produktionsnah: vars ist die task-lokale Record (startet leer). Die globalen
// Werte liegen in `store` hinter einem normalisierenden Proxy — so wie
// RuntimeVariableManager.createVariableContext: Schreibzugriffe ueber IDs
// (applyReferenceIds ersetzt Namen durch *_ref-IDs) werden auf den
// Variablen-Namen normalisiert.
const definitions = new Map<string, any>();
const registerDef = (d: any) => {
    if (!d?.name) return;
    definitions.set(d.name, d);
    if (d.id) definitions.set(d.id, d);
};
for (const v of [...(bp.variables || []), ...(main.variables || [])]) registerDef(v);
for (const o of objects) if (o.isVariable || o.className?.includes('Variable')) registerDef(o);

const store: Record<string, any> = {};
for (const v of bp.variables) {
    const init = v.initialValue !== undefined ? v.initialValue : (v.value !== undefined ? v.value : v.defaultValue);
    store[v.name] = init;
    objects.push({ ...v, isVariable: true, value: init });
}
// Variablen, die als Objekte modelliert sind (TListVariable & Co.), landen in
// Produktion ebenfalls in stageVariables (importVariablesFromObjects).
for (const o of objects) {
    if (!o.name || store[o.name] !== undefined) continue;
    if (!(o.isVariable || o.className?.includes('Variable'))) continue;
    store[o.name] = o.value !== undefined ? o.value : (o.entries ?? o.items ?? o.data);
}

const normKey = (prop: any) => {
    const d = definitions.get(String(prop));
    return d ? d.name : String(prop);
};
const contextVars: Record<string, any> = new Proxy(store, {
    get: (t, prop) => t[normKey(prop)],
    set: (t, prop, value) => { t[normKey(prop)] = value; return true; },
    has: (t, prop) => normKey(prop) in t,
});

// Wie RuntimeEventService: vars = Object.create(objectNameMap) — Objekte sind
// ueber die Prototype-Kette unter ihrem Namen erreichbar; self/sender/eventData
// sind eigene Properties.
const nameMap: Record<string, any> = {};
for (const o of objects) if (o.name) nameMap[o.name] = o;
const vars: Record<string, any> = Object.create(nameMap);
vars.eventData = {};
vars.self = objects.find(o => o.name === 'BtnStart');
vars.sender = vars.self;
const context: any = { objects, vars, contextVars, eventData: {} };

const actionsByName: Map<string, any> = new Map(main.actions.map((a: any) => [a.name, a]));
const tasksByName: Map<string, any> = new Map(main.tasks.map((t: any) => [t.name, t]));

let passed = 0, failed = 0;
const check = (name: string, cond: boolean, extra = '') => {
    if (cond) { passed++; console.log(`  ✓ ${name}`); }
    else { failed++; console.log(`  ✗ ${name} ${extra}`); }
};

async function runSeq(seq: any[], depth = 0): Promise<void> {
    for (const item of seq) {
        if (item.type === 'action') await runAction(actionsByName.get(item.name));
        else if (item.type === 'task') await runTask(item.name, depth + 1);
        else if (item.type === 'condition') {
            const ok = TaskConditionEvaluator.evaluateCondition(item.condition, vars, contextVars);
            console.log(`${'  '.repeat(depth)}  cond ${item.condition.variable}(${JSON.stringify(TaskConditionEvaluator.resolveVarPath?.(item.condition.variable, vars, contextVars))}) ${item.condition.operator} ${item.condition.value} → ${ok}`);
            await runSeq(ok ? item.then : (item.else || []), depth);
        } else if (item.type === 'foreach' || item.type === 'for' || item.type === 'while') {
            const execBody = async (body: any[], _v: any, _g: any, _c: any, d: number) => { await runSeq(body, d); };
            const contextObj = objects.find(o => o.name === 'BtnStart'); // wie in Produktion: ausloesendes Objekt
            if (item.type === 'foreach') await TaskLoopHandler.handleForeach(item, vars, contextVars, contextObj, depth, undefined, execBody, objects);
            else if (item.type === 'for') await TaskLoopHandler.handleFor(item, vars, contextVars, contextObj, depth, undefined, execBody, objects);
            else await TaskLoopHandler.handleWhile(item, vars, contextVars, contextObj, depth, undefined, execBody, objects);
        }
    }
}

async function runAction(a: any): Promise<void> {
    if (!a) { console.log('  !! Action fehlt'); return; }
    const handler = actionRegistry.getHandler(a.type);
    if (!handler) { console.log(`  !! kein Handler fuer ${a.type}`); return; }
    await handler(a, context);
}

async function runTask(name: string, depth = 0): Promise<void> {
    const t = tasksByName.get(name);
    console.log(`${'  '.repeat(depth)}▶ Task ${name}`);
    if (!t) { console.log('  !! Task fehlt'); return; }
    await runSeq(t.actionSequence, depth);
}

const board = objects.find(o => o.name === 'Spielfeld');

console.log('=== SpielStarten ===');
await runTask('SpielStarten');
console.log('Nach Start: Status=%s AktivTyp=%s AktivRot=%s AktivX=%s AktivY=%s Passt=%s',
    contextVars.Status, contextVars.AktivTyp, contextVars.AktivRot, contextVars.AktivX, contextVars.AktivY, contextVars.Passt);
console.log('AktivMatrix =', JSON.stringify(contextVars.AktivMatrix));
const bagObj = objects.find(o => o.name === 'Bag');
console.log('NaechsterTyp =', contextVars.NaechsterTyp, '| Bag.items =', JSON.stringify(bagObj?.items));
check('Status playing', contextVars.Status === 'playing', `ist ${contextVars.Status}`);
check('AktivMatrix gesetzt', typeof contextVars.AktivMatrix === 'string' && contextVars.AktivMatrix.includes('1'), `=${contextVars.AktivMatrix}`);
check('Bag gefuellt', Array.isArray(bagObj?.items) && bagObj.items.length === 5 && bagObj.items.every((t: any) => 'IJLOSTZ'.includes(t)), `=${JSON.stringify(bagObj?.items)}`);

console.log('=== Ticken ===');
await runTask('TaktSchritt');
check('Stein gesunken', Number(contextVars.AktivY) === 1, `AktivY=${contextVars.AktivY}`);

console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen`);
process.exit(failed ? 1 : 0);
